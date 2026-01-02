import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/useChatStore';
import { IMessage } from '@repo/shared';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

import { useAuthStore } from '@/store/useAuthStore';

export const useSocket = (tokenProp?: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const addMessage = useChatStore((state) => state.addMessage);
  const storeToken = useAuthStore((state) => state.token);
  const { user } = useAuthStore();
  const token = tokenProp ?? storeToken;

  useEffect(() => {
    if (!token) return;

    socketRef.current = io(SOCKET_URL, {
      query: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to socket');
    });

    socketRef.current.on('newMessage', (message: IMessage) => {
      console.log('[Socket] Received newMessage:', message);
      addMessage(message);
    });

    // Listen for user status changes
    socketRef.current.on('userStatusChanged', (data: { userId: string; status: string }) => {
      console.log('User status changed:', data);
      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent('userStatusChanged', { detail: data }));
    });

    // Listen for new group notifications
    if (user?.id) {
      socketRef.current.on(`user:${user.id}:newGroup`, (data: any) => {
        console.log('New group created:', data);
        // Trigger a refresh of conversations
        window.dispatchEvent(new CustomEvent('refreshConversations'));
      });

      socketRef.current.on('newFriendRequest', (data: any) => {
        console.log('New friend request:', data);
        window.dispatchEvent(new CustomEvent('newFriendRequest', { detail: data }));
      });
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, [token, addMessage, user?.id]);

  const joinRoom = (conversationId: string) => {
    socketRef.current?.emit('joinRoom', { conversationId });
  };

  const sendMessage = (conversationId: string, content: string, fileUrl?: string) => {
    socketRef.current?.emit('sendMessage', { conversationId, content, fileUrl });
  };

  return { socket: socketRef.current, joinRoom, sendMessage };
};
