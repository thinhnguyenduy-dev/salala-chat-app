import { useEffect, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/useChatStore';
import { IMessage } from '@repo/shared';
import { useAuthStore } from '@/store/useAuthStore';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Singleton socket instance
let socketInstance: Socket | null = null;
let currentToken: string | null = null;
let refCount = 0;
let listenersAttached = false;

function getSocket(token: string): Socket {
  // If token changed, disconnect old socket
  if (socketInstance && currentToken !== token) {
    socketInstance.disconnect();
    socketInstance = null;
    listenersAttached = false;
  }

  if (!socketInstance) {
    currentToken = token;
    socketInstance = io(SOCKET_URL, {
      query: { token },
      transports: ['websocket'],
    });
  }

  return socketInstance;
}

function attachListeners(socket: Socket, userId: string | undefined) {
  if (listenersAttached) return;
  listenersAttached = true;

  socket.on('connect', () => {
    console.log('Connected to socket');
    window.dispatchEvent(new CustomEvent('refreshFriends'));
  });

  socket.on('newMessage', (message: IMessage) => {
    console.log('[Socket] Received newMessage:', message);
    useChatStore.getState().addMessage(message);
  });

  socket.on('userStatusChanged', (data: { userId: string; status: string }) => {
    console.log('User status changed:', data);
    window.dispatchEvent(new CustomEvent('userStatusChanged', { detail: data }));
  });

  socket.on('userTyping', (data: { userId: string; conversationId: string }) => {
    console.log('[Socket] User typing:', data);
    window.dispatchEvent(new CustomEvent('userTyping', { detail: data }));
  });

  socket.on('userStopTyping', (data: { userId: string; conversationId: string }) => {
    console.log('[Socket] User stopped typing:', data);
    window.dispatchEvent(new CustomEvent('userStopTyping', { detail: data }));
  });

  socket.on('messagesRead', (data: { messageIds: string[]; userId: string; readAt: Date }) => {
    console.log('[Socket] Messages read:', data);
    window.dispatchEvent(new CustomEvent('messagesRead', { detail: data }));
  });

  if (userId) {
    socket.on(`user:${userId}:newGroup`, (data: any) => {
      console.log('New group created:', data);
      window.dispatchEvent(new CustomEvent('refreshConversations'));
    });

    socket.on('newFriendRequest', (data: any) => {
      console.log('New friend request:', data);
      window.dispatchEvent(new CustomEvent('newFriendRequest', { detail: data }));
    });
  }

  // WebRTC Call Event Listeners
  socket.on('call:incoming', (data: {
    callerId: string;
    callerName: string;
    callerAvatar: string | null;
    conversationId: string;
    hasVideo: boolean;
  }) => {
    console.log('[Socket] Incoming call:', data);
    window.dispatchEvent(new CustomEvent('call:incoming', { detail: data }));
  });

  socket.on('call:offer', (data: { from: string; offer: RTCSessionDescriptionInit }) => {
    console.log('[Socket] Received call offer');
    window.dispatchEvent(new CustomEvent('call:offer', { detail: data }));
  });

  socket.on('call:answer', (data: { from: string; answer: RTCSessionDescriptionInit }) => {
    console.log('[Socket] Received call answer');
    window.dispatchEvent(new CustomEvent('call:answer', { detail: data }));
  });

  socket.on('call:ice-candidate', (data: { from: string; candidate: RTCIceCandidateInit }) => {
    console.log('[Socket] Received ICE candidate');
    window.dispatchEvent(new CustomEvent('call:ice-candidate', { detail: data }));
  });

  socket.on('call:rejected', (data: { from: string }) => {
    console.log('[Socket] Call rejected');
    window.dispatchEvent(new CustomEvent('call:rejected', { detail: data }));
  });

  socket.on('call:ended', (data: { from: string }) => {
    console.log('[Socket] Call ended by peer');
    window.dispatchEvent(new CustomEvent('call:ended', { detail: data }));
  });

  socket.on('call:cancelled', (data: { from: string }) => {
    console.log('[Socket] Call cancelled');
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: data }));
  });

  // Reaction listeners
  socket.on('message:reaction:add', (reaction: any) => {
    console.log('[Socket] Reaction added:', reaction);
    const state = useChatStore.getState();
    let foundConversationId = null;
    for (const [convId, msgs] of Object.entries(state.messages)) {
      if (msgs.some(m => m.id === reaction.messageId)) {
        foundConversationId = convId;
        break;
      }
    }
    if (foundConversationId) {
      useChatStore.getState().addReaction(foundConversationId, reaction);
    }
  });

  socket.on('message:reaction:remove', (data: { messageId: string, userId: string, emoji: string }) => {
    console.log('[Socket] Reaction removed:', data);
    const state = useChatStore.getState();
    let foundConversationId = null;
    for (const [convId, msgs] of Object.entries(state.messages)) {
      if (msgs.some(m => m.id === data.messageId)) {
        foundConversationId = convId;
        break;
      }
    }
    if (foundConversationId) {
      useChatStore.getState().removeReaction(foundConversationId, data.messageId, data.userId, data.emoji);
    }
  });
}

export const useSocket = (tokenProp?: string | null) => {
  const storeToken = useAuthStore((state) => state.token);
  const { user } = useAuthStore();
  const token = tokenProp ?? storeToken;

  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);
    attachListeners(socket, user?.id);
    refCount++;

    return () => {
      refCount--;
      // Only disconnect if no components are using the socket
      if (refCount === 0 && socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        currentToken = null;
        listenersAttached = false;
      }
    };
  }, [token, user?.id]);

  const joinRoom = useCallback((conversationId: string) => {
    socketInstance?.emit('joinRoom', { conversationId });
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string, fileUrl?: string, replyToId?: string) => {
    socketInstance?.emit('sendMessage', { conversationId, content, fileUrl, replyToId });
  }, []);

  const emitTyping = useCallback((conversationId: string) => {
    socketInstance?.emit('typing', { conversationId });
  }, []);

  const emitStopTyping = useCallback((conversationId: string) => {
    socketInstance?.emit('stopTyping', { conversationId });
  }, []);

  const emitMarkAsRead = useCallback((messageIds: string[]) => {
    socketInstance?.emit('markMessagesAsRead', { messageIds });
  }, []);

  // WebRTC Call Emit Functions
  const initiateCall = useCallback((conversationId: string, calleeId: string, hasVideo: boolean) => {
    socketInstance?.emit('call:initiate', { conversationId, calleeId, hasVideo });
  }, []);

  const sendOffer = useCallback((to: string, offer: RTCSessionDescriptionInit) => {
    socketInstance?.emit('call:offer', { to, offer });
  }, []);

  const sendAnswer = useCallback((to: string, answer: RTCSessionDescriptionInit) => {
    socketInstance?.emit('call:answer', { to, answer });
  }, []);

  const sendIceCandidate = useCallback((to: string, candidate: RTCIceCandidateInit) => {
    socketInstance?.emit('call:ice-candidate', { to, candidate });
  }, []);

  const rejectCall = useCallback((to: string) => {
    socketInstance?.emit('call:reject', { to });
  }, []);

  const endCall = useCallback((to: string) => {
    socketInstance?.emit('call:end', { to });
  }, []);

  const cancelCall = useCallback((to: string) => {
    socketInstance?.emit('call:cancel', { to });
  }, []);

  return {
    socket: socketInstance,
    joinRoom,
    sendMessage,
    emitTyping,
    emitStopTyping,
    emitMarkAsRead,
    initiateCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    rejectCall,
    endCall,
    cancelCall,
  };
};
