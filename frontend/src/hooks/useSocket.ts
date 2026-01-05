import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/useChatStore';
import { IMessage } from '@repo/shared';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

import { useAuthStore } from '@/store/useAuthStore';
import { useCallStore } from '@/store/useCallStore';

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
      // Trigger friends list refresh to get latest online status
      window.dispatchEvent(new CustomEvent('refreshFriends'));
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

    // Listen for typing indicators
    socketRef.current.on('userTyping', (data: { userId: string; conversationId: string }) => {
      console.log('[Socket] User typing:', data);
      window.dispatchEvent(new CustomEvent('userTyping', { detail: data }));
    });

    socketRef.current.on('userStopTyping', (data: { userId: string; conversationId: string }) => {
      console.log('[Socket] User stopped typing:', data);
      window.dispatchEvent(new CustomEvent('userStopTyping', { detail: data }));
    });

    // Listen for read receipts
    socketRef.current.on('messagesRead', (data: { messageIds: string[]; userId: string; readAt: Date }) => {
      console.log('[Socket] Messages read:', data);
      window.dispatchEvent(new CustomEvent('messagesRead', { detail: data }));
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

    // ============================================
    // WebRTC Call Event Listeners
    // ============================================

    socketRef.current.on('call:incoming', (data: {
      callerId: string;
      callerName: string;
      callerAvatar: string | null;
      conversationId: string;
      hasVideo: boolean;
    }) => {
      console.log('[Socket] Incoming call:', data);
      window.dispatchEvent(new CustomEvent('call:incoming', { detail: data }));
    });

    socketRef.current.on('call:offer', (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log('[Socket] Received call offer');
      window.dispatchEvent(new CustomEvent('call:offer', { detail: data }));
    });

    socketRef.current.on('call:answer', (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log('[Socket] Received call answer');
      window.dispatchEvent(new CustomEvent('call:answer', { detail: data }));
    });

    socketRef.current.on('call:ice-candidate', (data: { from: string; candidate: RTCIceCandidateInit }) => {
      console.log('[Socket] Received ICE candidate');
      window.dispatchEvent(new CustomEvent('call:ice-candidate', { detail: data }));
    });

    socketRef.current.on('call:rejected', (data: { from: string }) => {
      console.log('[Socket] Call rejected');
      window.dispatchEvent(new CustomEvent('call:rejected', { detail: data }));
    });

    socketRef.current.on('call:ended', (data: { from: string }) => {
      console.log('[Socket] Call ended by peer');
      window.dispatchEvent(new CustomEvent('call:ended', { detail: data }));
    });

    socketRef.current.on('call:cancelled', (data: { from: string }) => {
      console.log('[Socket] Call cancelled');
      window.dispatchEvent(new CustomEvent('call:cancelled', { detail: data }));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [token, addMessage, user?.id]);

  const joinRoom = useCallback((conversationId: string) => {
    socketRef.current?.emit('joinRoom', { conversationId });
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string, fileUrl?: string) => {
    socketRef.current?.emit('sendMessage', { conversationId, content, fileUrl });
  }, []);

  const emitTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  const emitStopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('stopTyping', { conversationId });
  }, []);

  const emitMarkAsRead = useCallback((messageIds: string[]) => {
    socketRef.current?.emit('markMessagesAsRead', { messageIds });
  }, []);

  // ============================================
  // WebRTC Call Emit Functions
  // ============================================

  const initiateCall = useCallback((conversationId: string, calleeId: string, hasVideo: boolean) => {
    socketRef.current?.emit('call:initiate', { conversationId, calleeId, hasVideo });
  }, []);

  const sendOffer = useCallback((to: string, offer: RTCSessionDescriptionInit) => {
    socketRef.current?.emit('call:offer', { to, offer });
  }, []);

  const sendAnswer = useCallback((to: string, answer: RTCSessionDescriptionInit) => {
    socketRef.current?.emit('call:answer', { to, answer });
  }, []);

  const sendIceCandidate = useCallback((to: string, candidate: RTCIceCandidateInit) => {
    socketRef.current?.emit('call:ice-candidate', { to, candidate });
  }, []);

  const rejectCall = useCallback((to: string) => {
    socketRef.current?.emit('call:reject', { to });
  }, []);

  const endCall = useCallback((to: string) => {
    socketRef.current?.emit('call:end', { to });
  }, []);

  const cancelCall = useCallback((to: string) => {
    socketRef.current?.emit('call:cancel', { to });
  }, []);

  return {
    socket: socketRef.current,
    joinRoom,
    sendMessage,
    emitTyping,
    emitStopTyping,
    emitMarkAsRead,
    // Call functions
    initiateCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    rejectCall,
    endCall,
    cancelCall,
  };
};
