import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async setUserOnline(userId: string, socketId: string) {
    // Add socket to user's socket set
    await this.client.sadd(`user_sockets:${userId}`, socketId);
    // Add user to online users set
    await this.client.sadd(`online_users`, userId);
  }

  async setUserOffline(userId: string, socketId: string) {
    // Remove this specific socket from user's socket set
    await this.client.srem(`user_sockets:${userId}`, socketId);

    // Check if user has any remaining sockets
    const remainingSockets = await this.client.scard(`user_sockets:${userId}`);

    // Only mark user as offline if they have no more active sockets
    if (remainingSockets === 0) {
      await this.client.srem(`online_users`, userId);
      await this.client.del(`user_sockets:${userId}`);
      return true; // User is now offline
    }

    return false; // User still has active connections
  }

  async checkUserOnline(userId: string): Promise<boolean> {
    const isOnline = await this.client.sismember(`online_users`, userId);
    return isOnline === 1;
  }

  async checkUsersOnline(userIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    if (userIds.length === 0) {
      return result;
    }

    // Use pipeline for efficiency
    const pipeline = this.client.pipeline();
    userIds.forEach((userId) => {
      pipeline.sismember('online_users', userId);
    });

    const responses = await pipeline.exec();

    userIds.forEach((userId, index) => {
      const [err, isOnline] = responses?.[index] || [null, 0];
      result.set(userId, !err && isOnline === 1);
    });

    return result;
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.client.smembers('online_users');
  }

  async getUserSocketCount(userId: string): Promise<number> {
    return this.client.scard(`user_sockets:${userId}`);
  }
}
