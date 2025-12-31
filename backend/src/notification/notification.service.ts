import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private firebaseApp: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

      if (!projectId || !privateKey || !clientEmail) {
        this.logger.warn('Firebase credentials not configured. Push notifications will be disabled.');
        return;
      }

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  async sendPushNotification(
    token: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<boolean> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized. Skipping notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        token,
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            requireInteraction: false,
          },
          fcmOptions: {
            link: payload.data?.url || '/',
          },
        },
      };

      await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully to token: ${token.substring(0, 20)}...`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      
      // If token is invalid, we should remove it from the database
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`Invalid token detected: ${token.substring(0, 20)}...`);
      }
      
      return false;
    }
  }

  async sendToMultipleDevices(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.firebaseApp || tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        tokens,
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            requireInteraction: false,
          },
          fcmOptions: {
            link: payload.data?.url || '/',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      this.logger.log(
        `Multicast notification sent. Success: ${response.successCount}, Failure: ${response.failureCount}`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`Failed to send multicast notification: ${error.message}`);
      return { successCount: 0, failureCount: tokens.length };
    }
  }
}
