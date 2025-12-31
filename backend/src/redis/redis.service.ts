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

  onModuleDestroy() {
    this.client.quit();
  }

  async setUserOnline(userId: string, socketId: string) {
    await this.client.sadd(`online_users`, userId);
    await this.client.set(`user_socket:${userId}`, socketId);
  }

  async setUserOffline(userId: string) {
    await this.client.srem(`online_users`, userId);
    await this.client.del(`user_socket:${userId}`);
  }

  async checkUserOnline(userId: string): Promise<boolean> {
    const isOnline = await this.client.sismember(`online_users`, userId);
    return isOnline === 1;
  }

  async getUserSocket(userId: string): Promise<string | null> {
    return this.client.get(`user_socket:${userId}`);
  }
}
