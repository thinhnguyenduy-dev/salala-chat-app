import { Controller, Post, Delete, Body, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('register')
  async registerToken(@Body() body: { userId: string; token: string }) {
    const { userId, token } = body;

    // Add token to user's fcmTokens array if not already present
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.fcmTokens.includes(token)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          fcmTokens: {
            push: token,
          },
        },
      });
    }

    return { success: true, message: 'Token registered successfully' };
  }

  @Delete('unregister/:userId/:token')
  async unregisterToken(
    @Param('userId') userId: string,
    @Param('token') token: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedTokens = user.fcmTokens.filter((t) => t !== token);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fcmTokens: updatedTokens,
      },
    });

    return { success: true, message: 'Token unregistered successfully' };
  }
}
