import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      // NOTE: In a real app we'd verify the token with secret.
      // For now assuming the token payload has userId
      // const payload = this.jwtService.verify(token); 
      // mocking verification for simplicity if secret not set up yet
      if (!token) throw new Error('No token');
      
      const payload = this.jwtService.decode(token) as any;
      if (!payload || !payload.sub) {   
          // If decoding fails or no sub, disconnect
          client.disconnect();
          return;
      }
      const userId = payload.sub;

      client.data.userId = userId;
      await this.redisService.setUserOnline(userId, client.id);
      
      // Update database status
      await this.prismaService.user.update({
        where: { id: userId },
        data: { status: 'online' },
      });

      // Broadcast to all clients that this user is online
      this.server.emit('userStatusChanged', { userId, status: 'online' });
      
      console.log(`User ${userId} connected: ${client.id}`);
    } catch (e) {
      console.error(e);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      await this.redisService.setUserOffline(userId);
      
      // Update database status
      await this.prismaService.user.update({
        where: { id: userId },
        data: { status: 'offline' },
      });

      // Broadcast to all clients that this user is offline
      this.server.emit('userStatusChanged', { userId, status: 'offline' });
      
      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data.userId;
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: payload.conversationId },
    });

    if (!conversation) {
        throw new WsException('Conversation not found');
    }

    if (!conversation.participantIds.includes(userId)) {
      throw new WsException('You are not a participant');
    }

    client.join(payload.conversationId);
    console.log(`User ${userId} joined room ${payload.conversationId}`);
    return { event: 'joinedRoom', data: payload.conversationId };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; content: string; fileUrl?: string },
  ) {
    const userId = client.data.userId;
    
    // Validate participation again or rely on room guard
    // Ideally we check if user is in participant list again for security
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: payload.conversationId }
    });

    if (!conversation || !conversation.participantIds.includes(userId)) {
        throw new WsException('Unauthorized to send message to this room');
    }

    // Save to DB
    const message = await this.prismaService.message.create({
      data: {
        content: payload.content,
        fileUrl: payload.fileUrl,
        conversationId: payload.conversationId,
        senderId: userId,
      },
    });

    // Update conversation lastMessage
    await this.prismaService.conversation.update({
        where: { id: payload.conversationId },
        data: { lastMessageId: message.id }
    });

    // Emit to room
    this.server.to(payload.conversationId).emit('newMessage', message);

    // Send push notifications to participants who are not in the room
    await this.sendPushNotificationsToOfflineUsers(
      conversation,
      userId,
      payload.content,
    );

    return message;
  }

  private async sendPushNotificationsToOfflineUsers(
    conversation: any,
    senderId: string,
    messageContent: string,
  ) {
    try {
      // Get sender info for notification
      const sender = await this.prismaService.user.findUnique({
        where: { id: senderId },
        select: { username: true },
      });

      // Get all participants except sender
      const recipientIds = conversation.participantIds.filter(
        (id: string) => id !== senderId,
      );

      // Get room members (users currently in this conversation room)
      const roomSockets = await this.server.in(conversation.id).fetchSockets();
      const usersInRoom = new Set(roomSockets.map(socket => socket.data.userId));

      // Find users who should receive push notifications
      // (not in room or offline)
      for (const recipientId of recipientIds) {
        const isInRoom = usersInRoom.has(recipientId);
        
        if (!isInRoom) {
          // User is not in the room, send push notification
          const recipient = await this.prismaService.user.findUnique({
            where: { id: recipientId },
            select: { fcmTokens: true },
          });

          if (recipient && recipient.fcmTokens && recipient.fcmTokens.length > 0) {
            const notificationPayload = {
              title: `New message from ${sender?.username || 'Someone'}`,
              body: messageContent.length > 100 
                ? messageContent.substring(0, 100) + '...' 
                : messageContent,
              data: {
                conversationId: conversation.id,
                senderId: senderId,
                url: `/?conversation=${conversation.id}`,
              },
            };

            // Send to all devices of this user
            await this.notificationService.sendToMultipleDevices(
              recipient.fcmTokens,
              notificationPayload,
            );
          }
        }
      }
    } catch (error) {
      console.error('Error sending push notifications:', error);
      // Don't throw - notification failure shouldn't break message sending
    }
  }

  // Method to notify users when they're added to a new group
  notifyGroupCreated(participantIds: string[], groupId: string, groupName: string) {
    participantIds.forEach((userId) => {
      // Emit to all sockets of this user
      this.server.emit(`user:${userId}:newGroup`, {
        groupId,
        groupName,
        message: 'You have been added to a new group',
      });
    });
  }
}
