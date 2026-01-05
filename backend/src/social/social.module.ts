import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, ChatModule, RedisModule],
  providers: [SocialService],
  controllers: [SocialController],
})
export class SocialModule {}
