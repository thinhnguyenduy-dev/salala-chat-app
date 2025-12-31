import { create } from 'zustand';
import { IMessage, IUser, IConversation } from '@repo/shared';

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
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  conversations: [],
  activeConversationId: null,
  onlineUsers: [],

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  addMessage: (message) =>
    set((state) => {
      const currentMessages = state.messages[message.conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [message.conversationId]: [...currentMessages, message],
        },
      };
    }),

  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),
}));
