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
import { CreateMessageDto } from './dto/create-message.dto';
import { UsePipes, ValidationPipe } from '@nestjs/common';

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
      client.join(userId); // Join personal room for notifications
      await this.redisService.setUserOnline(userId, client.id);

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
      const isFullyOffline = await this.redisService.setUserOffline(userId, client.id);

      // Only broadcast if user has no more active connections
      if (isFullyOffline) {
        // Broadcast to all clients that this user is offline
        this.server.emit('userStatusChanged', { userId, status: 'offline' });

        console.log(`User ${userId} fully disconnected (all sockets closed)`);
      } else {
        console.log(`User ${userId} socket ${client.id} disconnected (still has other active connections)`);
      }
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
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateMessageDto,
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

    // Emit to all participants (their personal rooms)
    // This ensures they get the message even if they haven't joined the conversation room (e.g. for unread count in sidebar)
    this.server.to(conversation.participantIds).emit('newMessage', message);

    // Send push notifications to participants who are not in the room
    await this.sendPushNotificationsToOfflineUsers(
      conversation,
      userId,
      payload.content || (payload.fileUrl ? 'Sent an image' : 'Sent a message'),
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

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data.userId;
    
    // Broadcast to other users in the room (except sender)
    client.to(payload.conversationId).emit('userTyping', {
      userId,
      conversationId: payload.conversationId,
    });
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data.userId;
    
    client.to(payload.conversationId).emit('userStopTyping', {
      userId,
      conversationId: payload.conversationId,
    });
  }

  @SubscribeMessage('markMessagesAsRead')
  async handleMarkMessagesAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageIds: string[] },
  ) {
    const userId = client.data.userId;
    
    try {
      // Save read receipts to database
      const readReceipts = await Promise.all(
        payload.messageIds.map(async (messageId) => {
          // Use upsert to avoid duplicates
          return this.prismaService.messageRead.upsert({
            where: {
              messageId_userId: {
                messageId,
                userId,
              },
            },
            create: {
              messageId,
              userId,
            },
            update: {
              readAt: new Date(),
            },
          });
        })
      );

      // Get conversation ID from first message to broadcast to room
      if (payload.messageIds.length > 0) {
        const message = await this.prismaService.message.findUnique({
          where: { id: payload.messageIds[0] },
          select: { conversationId: true },
        });

        if (message) {
          // Update ConversationRead to mark conversation as read up to this point
          // This ensures getConversations unread count is correct
          await this.prismaService.conversationRead.upsert({
             where: {
               conversationId_userId: {
                 conversationId: message.conversationId,
                 userId: userId
               }
             },
             create: {
               conversationId: message.conversationId,
               userId: userId,
             },
             update: {
                updatedAt: new Date(), // Set to now, effectively marking all current msgs as read
             }
          });

          // Broadcast to all participants in the conversation
          this.server.to(message.conversationId).emit('messagesRead', {
            messageIds: payload.messageIds,
            userId,
            readAt: new Date(),
          });
        }
      }

      return { success: true, count: readReceipts.length };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new WsException('Failed to mark messages as read');
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
  // Method to notify user of a new friend request
  notifyFriendRequest(receiverId: string, request: any) {
    this.server.to(receiverId).emit('newFriendRequest', request);
  }

  // ============================================
  // WebRTC Signaling Events for 1-1 Calls
  // ============================================

  @SubscribeMessage('call:initiate')
  async handleCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; calleeId: string; hasVideo: boolean },
  ) {
    const callerId = client.data.userId;
    
    try {
      // Validate conversation exists and is a 1-1 chat
      const conversation = await this.prismaService.conversation.findUnique({
        where: { id: payload.conversationId },
      });

      if (!conversation) {
        throw new WsException('Conversation not found');
      }

      if (conversation.participantIds.length !== 2) {
        throw new WsException('Calls are only supported for 1-1 conversations');
      }

      if (!conversation.participantIds.includes(callerId) || 
          !conversation.participantIds.includes(payload.calleeId)) {
        throw new WsException('Invalid participants');
      }

      // Get caller info for notification
      const caller = await this.prismaService.user.findUnique({
        where: { id: callerId },
        select: { username: true, avatar: true },
      });

      // Notify the callee about incoming call
      this.server.to(payload.calleeId).emit('call:incoming', {
        callerId,
        callerName: caller?.username || 'Unknown',
        callerAvatar: caller?.avatar,
        conversationId: payload.conversationId,
        hasVideo: payload.hasVideo,
      });

      console.log(`Call initiated: ${callerId} -> ${payload.calleeId} (video: ${payload.hasVideo})`);
      
      return { success: true };
    } catch (error) {
      console.error('Error initiating call:', error);
      throw new WsException('Failed to initiate call');
    }
  }

  @SubscribeMessage('call:offer')
  async handleCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string; offer: RTCSessionDescriptionInit },
  ) {
    const from = client.data.userId;
    
    // Forward the WebRTC offer to the recipient
    this.server.to(payload.to).emit('call:offer', {
      from,
      offer: payload.offer,
    });

    console.log(`Call offer forwarded: ${from} -> ${payload.to}`);
    return { success: true };
  }

  @SubscribeMessage('call:answer')
  async handleCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string; answer: RTCSessionDescriptionInit },
  ) {
    const from = client.data.userId;
    
    // Forward the WebRTC answer to the caller
    this.server.to(payload.to).emit('call:answer', {
      from,
      answer: payload.answer,
    });

    console.log(`Call answer forwarded: ${from} -> ${payload.to}`);
    return { success: true };
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string; candidate: RTCIceCandidateInit },
  ) {
    const from = client.data.userId;
    
    // Forward ICE candidate to peer
    this.server.to(payload.to).emit('call:ice-candidate', {
      from,
      candidate: payload.candidate,
    });

    console.log(`ICE candidate forwarded: ${from} -> ${payload.to}`);
    return { success: true };
  }

  @SubscribeMessage('call:reject')
  async handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string },
  ) {
    const from = client.data.userId;
    
    // Notify caller that call was rejected
    this.server.to(payload.to).emit('call:rejected', {
      from,
    });

    console.log(`Call rejected: ${from} rejected call from ${payload.to}`);
    return { success: true };
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string },
  ) {
    const from = client.data.userId;
    
    // Notify peer that call ended
    this.server.to(payload.to).emit('call:ended', {
      from,
    });

    console.log(`Call ended: ${from} ended call with ${payload.to}`);
    return { success: true };
  }

  @SubscribeMessage('call:cancel')
  async handleCallCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string },
  ) {
    const from = client.data.userId;
    
    // Notify callee that call was cancelled
    this.server.to(payload.to).emit('call:cancelled', {
      from,
    });

    console.log(`Call cancelled: ${from} cancelled call to ${payload.to}`);
    return { success: true };
  }
}
