import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [JwtModule, RedisModule, PrismaModule, NotificationModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
