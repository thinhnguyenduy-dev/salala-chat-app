"use client";

import { useEffect, useState } from 'react';
import { requestNotificationPermission, onMessageListener } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';

export function useNotifications() {
  const { user } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);

  useEffect(() => {
    const initNotifications = async () => {
      if (!user?.id) return;

      try {
        // Request permission and get token
        const fcmToken = await requestNotificationPermission();
        
        if (fcmToken) {
          setToken(fcmToken);
          
          // Register token with backend
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          await fetch(`${apiUrl}/notification/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, token: fcmToken }),
          });
          
          console.log('FCM token registered with backend');
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initNotifications();

    // Listen for foreground messages
    const unsubscribe = onMessageListener().then((payload: any) => {
      setNotification(payload);
      console.log('Foreground notification:', payload);
      
      // Show browser notification even in foreground
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || 'New Message', {
          body: payload.notification?.body,
          icon: '/icon-192x192.png',
          tag: payload.data?.conversationId,
        });
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, [user?.id]);

  return { token, notification };
}
