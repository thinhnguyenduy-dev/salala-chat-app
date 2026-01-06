import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IUser, IConversation, IFriendRequest } from '@repo/shared';
import { ChatGateway } from '../chat/chat.gateway';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
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
      throw new BadRequestException(
        'Request already exists or already friends',
      );
    }

    return this.prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING',
      },
    });
  }

  async rejectFriendRequest(requestId: string, userId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.receiverId !== userId)
      throw new BadRequestException('Not your request');
    if (request.status !== 'PENDING')
      throw new BadRequestException('Request already handled');

    // Update status to REJECTED
    await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });

    return { success: true };
  }

  async acceptFriendRequest(requestId: string, userId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.receiverId !== userId)
      throw new BadRequestException('Not your request');
    if (request.status !== 'PENDING')
      throw new BadRequestException('Request already handled');

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
      orderBy: { updatedAt: 'desc' },
    });

    // Manually fetch lastMessage for each conversation
    const conversWithLastMessage = await Promise.all(
      convers.map(async (c) => {
        let lastMessage = null;
        if (c.lastMessageId) {
          lastMessage = await this.prisma.message.findUnique({
            where: { id: c.lastMessageId },
          });
        }
        return { ...c, lastMessage };
      }),
    );

    // Populate participants manually efficiently
    const allParticipantIds = Array.from(
      new Set(convers.flatMap((c) => c.participantIds)),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: allParticipantIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatar: true,
        createdAt: true,
        friendIds: true,
      },
    });

    // Get online status from Redis
    const onlineStatusMap =
      await this.redisService.checkUsersOnline(allParticipantIds);

    // Convert to Map for O(1) lookup, adding status from Redis
    const userMap = new Map(
      users.map((u) => [
        u.id,
        {
          ...u,
          status: onlineStatusMap.get(u.id) ? 'online' : 'offline',
        },
      ]),
    );

    // Fetch unread counts
    const unreadCounts = await Promise.all(
      convers.map(async (c) => {
        const readRecord = await this.prisma.conversationRead.findUnique({
          where: {
            conversationId_userId: {
              conversationId: c.id,
              userId: userId,
            },
          },
        });

        const lastReadTime = readRecord?.updatedAt || new Date(0);

        const count = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            createdAt: { gt: lastReadTime },
            senderId: { not: userId },
          },
        });

        return { id: c.id, count };
      }),
    );

    const unreadMap = new Map(unreadCounts.map((u) => [u.id, u.count]));

    // Attach participants
    return conversWithLastMessage.map((c) => ({
      ...c,
      participants: c.participantIds
        .map((pid) => userMap.get(pid))
        .filter(Boolean),
      unreadCount: unreadMap.get(c.id) || 0,
    }));
  }

  async getMessages(
    conversationId: string,
    cursor?: string,
    limit: number = 20,
  ) {
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
        reads: {
          select: { userId: true, readAt: true },
        },
        reactions: {
          select: {
            id: true,
             emoji: true,
             userId: true,
             messageId: true,
             createdAt: true
          }
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: { username: true }
            }
          }
        }
      },
    });

    // We return messages in DESC order (newest first) for pagination convenience.
    // The frontend might want to reverse them to show oldest->newest.
    const nextCursor =
      messages.length === limit ? messages[messages.length - 1].id : null;

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
        displayName: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    // Get online status from Redis
    const onlineStatusMap = await this.redisService.checkUsersOnline(
      user.friendIds,
    );

    // Add status to each friend
    return friends.map((friend) => ({
      ...friend,
      status: onlineStatusMap.get(friend.id) ? 'online' : 'offline',
    }));
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
        displayName: true,
        email: true,
        avatar: true,
        createdAt: true,
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
            displayName: true,
            email: true,
            avatar: true,
            createdAt: true,
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

  async updateProfile(
    userId: string,
    data: {
      phoneNumber?: string;
      bio?: string;
      displayName?: string;
      dateOfBirth?: Date | string;
      avatar?: string;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.phoneNumber !== undefined && {
          phoneNumber: data.phoneNumber,
        }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.displayName !== undefined && {
          displayName: data.displayName,
        }),
        ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
        ...(data.avatar && { avatar: data.avatar }),
      },
    });
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        displayName: true,
        phoneNumber: true,
        dateOfBirth: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get online status from Redis
    const isOnline = await this.redisService.checkUserOnline(userId);

    return {
      ...user,
      status: isOnline ? 'online' : 'offline',
    };
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

  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    // Get the last read message for this user in this conversation
    const readStatus = await this.prisma.conversationRead.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!readStatus || !readStatus.lastReadMessageId) {
      // If never read, maybe return all? Or 0?
      // For simplicity let's return count of all messages if never read, or just 0 to be safe/less annoying initially.
      // Actually, usually if no read status, everything is unread.
      // But for new users in new groups, they might not have read status yet.
      return 0; // consistent with "mark as read" logic creating the record
    }

    // Count messages after the last read message
    // We need to find the createdAt of the lastReadMessageId to be precise, or just use ID comparison if ObjectIDs are monotonic (usually are)
    // Prisma Mongo IDs are not strictly monotonic by default unless configured.
    // Let's look up the message to get createdAt
    const lastReadMsg = await this.prisma.message.findUnique({
      where: { id: readStatus.lastReadMessageId },
      select: { createdAt: true },
    });

    if (!lastReadMsg) return 0;

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId }, // Don't count own messages
        createdAt: { gt: lastReadMsg.createdAt },
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
  async updateConversation(conversationId: string, data: { name?: string }) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        name: data.name,
      },
    });
  }

  async getConversationMedia(conversationId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        fileUrl: { not: null },
      },
      select: {
        id: true,
        fileUrl: true,
        content: true,
        createdAt: true,
        sender: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return messages;
  }

  async markAsRead(userId: string, conversationId: string) {
    // Find the latest message to mark as read point (optional, but good for sync)
    // For now, simple Upsert on updatedAt is enough for our logic

    return this.prisma.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      create: {
        conversationId,
        userId,
        updatedAt: new Date(),
      },
      update: {
        updatedAt: new Date(),
      },
    });
  }

  async addReaction(userId: string, messageId: string, emoji: string) {
    // Check if reaction exists
    // We update if it exists or create new? Schema has unique constraint.
    // Usually toggling is handled by frontend calling remove, but here we explicitly add.
    // If we want to allow changing emoji, we might need to delete old one if we want single reaction per user-message.
    // But our schema allows unique [messageId, userId, emoji], so user can react with multiple emojis.
    // So we just create.

    try {
      const reaction = await this.prisma.messageReaction.create({
        data: {
          userId,
          messageId,
          emoji,
        },
      });

      // Get conversation to broadcast to all participants
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: {
          conversationId: true,
          conversation: { select: { participantIds: true } }
        },
      });

      if (message && this.chatGateway) {
         // Emit to all participants' personal rooms (not just conversation room)
         this.chatGateway.server.to(message.conversation.participantIds).emit('message:reaction:add', reaction);
      }

      return reaction;
    } catch (e) {
      // Ignore if duplicate (already reacted with this emoji)
      return null;
    }
  }

  async removeReaction(userId: string, messageId: string, emoji: string) {
    try {
      // We need the ID or deleteMany
      const result = await this.prisma.messageReaction.deleteMany({
        where: {
          userId,
          messageId,
          emoji,
        },
      });

      if (result.count > 0) {
         // Get conversation to broadcast to all participants
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
            select: {
              conversationId: true,
              conversation: { select: { participantIds: true } }
            },
        });

        if (message && this.chatGateway) {
            // Emit to all participants' personal rooms
            this.chatGateway.server.to(message.conversation.participantIds).emit('message:reaction:remove', {
                messageId,
                userId,
                emoji
            });
        }
      }
      
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
}
