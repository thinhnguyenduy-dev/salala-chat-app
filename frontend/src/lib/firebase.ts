import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase Cloud Messaging
let messaging: ReturnType<typeof getMessaging> | null = null;

export const initializeMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported && typeof window !== 'undefined') {
      messaging = getMessaging(app);
      return messaging;
    }
    return null;
  } catch (error) {
    console.error('Firebase messaging not supported:', error);
    return null;
  }
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('This browser does not support notifications');
      return null;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted');
      
      if (!messaging) {
        await initializeMessaging();
      }
      
      if (messaging) {
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.error('Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY');
            return null;
        }
        
        const token = await getToken(messaging, {
          vapidKey: vapidKey,
        });
        
        console.log('FCM Token:', token);
        return token;
      }
    } else {
      console.log('Notification permission denied');
    }
    
    return null;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) {
      initializeMessaging().then((msg) => {
        if (msg) {
          onMessage(msg, (payload) => {
            console.log('Message received (foreground):', payload);
            resolve(payload);
          });
        }
      });
    } else {
      onMessage(messaging, (payload) => {
        console.log('Message received (foreground):', payload);
        resolve(payload);
      });
    }
  });

export { app, messaging };
