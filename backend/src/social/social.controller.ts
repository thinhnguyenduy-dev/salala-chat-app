import { Controller, Post, Body, Get, UseGuards, Request, Param, Query, Optional, Inject, Patch } from '@nestjs/common';
import { SocialService } from './social.service';
import { ChatGateway } from '../chat/chat.gateway';
// Assuming we create an AuthGuard later or extract userId from mock/headers for now if Auth not fully ready?
// But plan says "JWT Auth" was for Gateway. For HTTP we should probably use Guard too, 
// but user didn't explicitly ask for HTTP Auth setup yet aside from Gateway.
// I'll assume we pass userId in body for simplicity or TODO AuthGuard. 
// Actually, let's just use a simple mock decorator or assume headers for now to keep momentum, 
// OR better: Just assume req.user exists if we had a global guard.
// For this task, I will accept userId in body to enable testing easily without full Auth setup.

@Controller('social')
export class SocialController {
  constructor(
    private readonly socialService: SocialService,
    @Optional() @Inject(ChatGateway) private readonly chatGateway?: ChatGateway,
  ) {}

  @Post('friend-request')
  async sendFriendRequest(@Body() body: { senderId: string; receiverId: string }) {
    const request = await this.socialService.sendFriendRequest(body.senderId, body.receiverId);

    // Notify receiver via WebSocket for real-time notification
    if (this.chatGateway) {
      // Get sender info to include in notification
      const sender = await this.socialService.getUserById(body.senderId);
      this.chatGateway.notifyFriendRequest(body.receiverId, {
        ...request,
        sender,
      });
    }

    return request;
  }

  @Post('friend-request/accept')
  async acceptFriendRequest(@Body() body: { requestId: string; userId: string }) {
    return this.socialService.acceptFriendRequest(body.requestId, body.userId);
  }

  @Post('friend-request/reject')
  async rejectFriendRequest(@Body() body: { requestId: string; userId: string }) {
    return this.socialService.rejectFriendRequest(body.requestId, body.userId);
  }

  @Get('conversations/:userId')
  async getConversations(@Param('userId') userId: string) {
    return this.socialService.getConversations(userId);
  }

  @Get('messages/:conversationId')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.socialService.getMessages(conversationId, cursor, limit ? parseInt(limit) : 20);
  }

  @Get('friends/:userId')
  async getFriends(@Param('userId') userId: string) {
    return this.socialService.getFriends(userId);
  }

  @Get('search')
  async searchUsers(@Query('q') query: string, @Query('userId') userId?: string) {
    return this.socialService.searchUsers(query, userId);
  }

  @Post('conversation/mark-read')
  async markConversationAsRead(@Body() body: { conversationId: string; userId: string; lastMessageId: string }) {
    return this.socialService.markConversationAsRead(
      body.conversationId,
      body.userId,
      body.lastMessageId
    );
  }

  @Get('friend-requests/:userId')
  async getPendingRequests(@Param('userId') userId: string) {
    return this.socialService.getPendingRequests(userId);
  }

  @Get('user/:userId')
  async getUserById(@Param('userId') userId: string) {
    return this.socialService.getUserById(userId);
  }

  @Post('group')
  async createGroup(@Body() body: { name: string; creatorId: string; participantIds: string[] }) {
    const group = await this.socialService.createGroup(body.name, body.creatorId, body.participantIds);
    
    // Notify all participants via WebSocket
    if (this.chatGateway) {
      this.chatGateway.notifyGroupCreated(
        [body.creatorId, ...body.participantIds],
        group.id,
        body.name
      );
    }
    
    return group;
  }

  @Post('conversation/with')
  async getOrCreateConversation(@Body() body: { userId: string; friendId: string }) {
    return this.socialService.getOrCreateConversation(body.userId, body.friendId);
  }

  @Post('profile')
  async updateProfile(@Body() body: { 
    userId: string; 
    phoneNumber?: string; 
    bio?: string;
    displayName?: string;
    dateOfBirth?: string;
    avatar?: string;
  }) {
    return this.socialService.updateProfile(body.userId, {
        phoneNumber: body.phoneNumber,
        bio: body.bio,
        displayName: body.displayName,
        dateOfBirth: body.dateOfBirth,
        avatar: body.avatar
    });
  }

  @Patch('conversation/:conversationId')
  async updateConversation(
    @Param('conversationId') conversationId: string,
    @Body() body: { name: string }
  ) {
    const updated = await this.socialService.updateConversation(conversationId, { name: body.name });
    // Notify via socket
    if (this.chatGateway) {
         // We don't have a specific event for "ConversationUpdated" yet in Gateway public API, 
         // but we can add one or use a generic invalidation.
         // Let's assume we want to broadcast to room.
         // Wait, ChatGateway needs to expose server or a method.
         // I'll check ChatGateway first.
         // For now I'll just return it. Realtime update is better but I can do polling/refresh on frontend for MVP if needed.
         // But "feature" implies proper logic.
         this.chatGateway.server.to(conversationId).emit('conversationUpdated', updated);
    }
    return updated;
  }

  @Get('conversation/:conversationId/media')
  async getConversationMedia(@Param('conversationId') conversationId: string) {
    return this.socialService.getConversationMedia(conversationId);
  }

  @Post('conversation/:conversationId/read')
  async markAsRead(
    @Param('conversationId') conversationId: string,
    @Body() body: { userId: string }
  ) {
    return this.socialService.markAsRead(body.userId, conversationId);
  }
}
