import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IUser, IConversation, IFriendRequest } from '@repo/shared';

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async sendFriendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('Cannot add yourself');
    }

    const existingRequest = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    if (existingRequest) {
      throw new BadRequestException('Request already exists or already friends');
    }

    return this.prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING',
      },
    });
  }

  async acceptFriendRequest(requestId: string, userId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.receiverId !== userId) throw new BadRequestException('Not your request');
    if (request.status !== 'PENDING') throw new BadRequestException('Request already handled');

    // 1. Update Request
    await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });

    // 2. Add to Friend List (Sender)
    await this.prisma.user.update({
      where: { id: request.senderId },
      data: {
        friendIds: { push: request.receiverId },
      },
    });

    // 3. Add to Friend List (Receiver)
    await this.prisma.user.update({
      where: { id: request.receiverId },
      data: {
        friendIds: { push: request.senderId },
      },
    });

    // 4. Create Conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: false,
        participantIds: [request.senderId, request.receiverId],
      },
    });

    return conversation;
  }

  async getConversations(userId: string) {
    const convers = await this.prisma.conversation.findMany({
      where: {
        participantIds: { has: userId },
      },
      include: {
        lastMessage: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Populate participants manually efficiently
    const allParticipantIds = Array.from(new Set(convers.flatMap(c => c.participantIds)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: allParticipantIds } },
      select: { id: true, username: true, email: true, status: true, createdAt: true, friendIds: true }, // Select safe fields
    });
    
    // Convert to Map for O(1) lookup
    const userMap = new Map(users.map(u => [u.id, u]));

    // Attach participants
    return convers.map(c => ({
      ...c,
      participants: c.participantIds.map(pid => userMap.get(pid)).filter(Boolean),
    }));
  }

  async getMessages(conversationId: string, cursor?: string, limit: number = 20) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    // We return messages in DESC order (newest first) for pagination convenience.
    // The frontend might want to reverse them to show oldest->newest.
    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      data: messages,
      nextCursor,
    };
  }
  async getFriends(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { friendIds: true },
    });

    if (!user || user.friendIds.length === 0) {
      return [];
    }

    const friends = await this.prisma.user.findMany({
      where: { id: { in: user.friendIds } },
      select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          status: true,
      }
    });

    return friends;
  }

  async searchUsers(query: string, currentUserId?: string) {
    if (!query) return [];
    
    return this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
        AND: currentUserId ? { id: { not: currentUserId } } : undefined,
      },
      select: {
         id: true,
         username: true,
         email: true,
         avatar: true,
      },
      take: 10,
    });
  }

  async getPendingRequests(userId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return requests;
  }

  async getOrCreateConversation(userId: string, friendId: string) {
    // First, check if a conversation already exists between these two users
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participantIds: { has: userId } },
          { participantIds: { has: friendId } },
        ],
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Create a new conversation if none exists
    const newConversation = await this.prisma.conversation.create({
      data: {
        isGroup: false,
        participantIds: [userId, friendId],
      },
    });

    return newConversation;
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createGroup(name: string, creatorId: string, participantIds: string[]) {
    // Include creator in participants
    const allParticipants = [creatorId, ...participantIds];

    const group = await this.prisma.conversation.create({
      data: {
        name,
        isGroup: true,
        participantIds: allParticipants,
      },
    });

    return group;
  }

  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    // Get the last read message for this user in this conversation
    const readStatus = await this.prisma.conversationRead.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    // Count messages after the last read message
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId }, // Don't count own messages
        ...(readStatus?.lastReadMessageId
          ? {
              createdAt: {
                gt: (
                  await this.prisma.message.findUnique({
                    where: { id: readStatus.lastReadMessageId },
                    select: { createdAt: true },
                  })
                )?.createdAt,
              },
            }
          : {}),
      },
    });

    return unreadCount;
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string,
    lastMessageId: string,
  ) {
    await this.prisma.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      update: {
        lastReadMessageId: lastMessageId,
      },
      create: {
        conversationId,
        userId,
        lastReadMessageId: lastMessageId,
      },
    });

    return { success: true };
  }
}
