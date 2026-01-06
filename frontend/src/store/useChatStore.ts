import { create } from 'zustand';
import { IMessage, IUser, IConversation } from '@repo/shared';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  messages: Record<string, IMessage[]>; // conversationId -> messages
  conversations: IConversation[];
  activeConversationId: string | null;
  onlineUsers: string[];
  
  // Actions
  setMessages: (conversationId: string, messages: IMessage[]) => void;
  addMessage: (message: IMessage) => void;
  setConversations: (conversations: IConversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setOnlineUsers: (userIds: string[]) => void;
  markOneAsRead: (conversationId: string) => void;
  
  // UI State
  isInfoSidebarOpen: boolean;
  setInfoSidebarOpen: (isOpen: boolean) => void;
  toggleInfoSidebarOpen: () => void;
  
  // Mobile view state
  mobileView: 'chats' | 'friends' | 'chat' | 'profile';
  setMobileView: (view: 'chats' | 'friends' | 'chat' | 'profile') => void;
  
  addReaction: (conversationId: string, reaction: any) => void;
  removeReaction: (conversationId: string, messageId: string, userId: string, emoji: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  conversations: [],
  activeConversationId: null,
  onlineUsers: [],
  isInfoSidebarOpen: false, // Hidden by default
  mobileView: 'chats', // Default mobile view

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  addMessage: (message) =>
    set((state) => {
      const currentMessages = state.messages[message.conversationId] || [];
      // Prevent duplicates
      if (currentMessages.some(m => m.id === message.id)) {
          return state;
      }
      
      const isActive = state.activeConversationId === message.conversationId;
      
      const currentUserId = useAuthStore.getState().user?.id;

      // Update conversations with new message preview and unread count
      const updatedConversations = state.conversations.map(c => {
         if (c.id === message.conversationId) {
             const isMe = message.senderId === currentUserId;
             const newCount = isActive ? 0 : (isMe ? (c.unreadCount || 0) : (c.unreadCount || 0) + 1);
             
             console.log(`[Store] Updating conv ${c.id}: isActive=${isActive}, isMe=${isMe}, oldUnread=${c.unreadCount}, newUnread=${newCount}`);
             
             return {
                 ...c,
                 lastMessage: {
                     content: message.content,
                     createdAt: message.createdAt,
                     senderId: message.senderId
                 },
                 unreadCount: newCount
             };
         }
         return c;
      });
      console.log(`[Store] addMessage complete. Updated conversations:`, updatedConversations.length);
      console.log(`[Store] addMessage complete. Updated conversations:`, updatedConversations.length);

      return {
        messages: {
          ...state.messages,
          [message.conversationId]: [...currentMessages, message],
        },
        conversations: updatedConversations,
      };
    }),

  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),
  markOneAsRead: (conversationId) => set((state) => ({
    conversations: state.conversations.map(c => 
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    )

  })),

  setInfoSidebarOpen: (isOpen) => set({ isInfoSidebarOpen: isOpen }),
  toggleInfoSidebarOpen: () => set((state) => ({ isInfoSidebarOpen: !state.isInfoSidebarOpen })),
  
  setMobileView: (view) => set({ mobileView: view }),

  addReaction: (conversationId, reaction) => set((state) => {
    const messages = state.messages[conversationId] || [];
    return {
      messages: {
        ...state.messages,
        [conversationId]: messages.map(msg => {
          if (msg.id === reaction.messageId) {
            const existingReactions = msg.reactions || [];
            // Check for duplicate (same id, or same user+emoji combo)
            const isDuplicate = existingReactions.some(r =>
              r.id === reaction.id || (r.userId === reaction.userId && r.emoji === reaction.emoji)
            );
            if (isDuplicate) {
              return msg; // Don't add duplicate
            }
            return {
              ...msg,
              reactions: [...existingReactions, reaction]
            };
          }
          return msg;
        })
      }
    };
  }),

  removeReaction: (conversationId, messageId, userId, emoji) => set((state) => {
    const messages = state.messages[conversationId] || [];
    return {
      messages: {
        ...state.messages,
        [conversationId]: messages.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter(r => !(r.userId === userId && r.emoji === emoji))
            };
          }
          return msg;
        })
      }
    };
  }),
}));
