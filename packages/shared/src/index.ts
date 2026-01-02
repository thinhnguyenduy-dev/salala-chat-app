export interface IUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  friendIds: string[];
  status: string;
  createdAt: Date;
  phoneNumber?: string;
  bio?: string;
  displayName?: string;
  dateOfBirth?: Date;
}

export interface IFriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | string;
  createdAt: Date;
}

export interface IConversation {
  id: string;
  name?: string;
  isGroup: boolean;
  participantIds: string[];
  lastMessageId?: string;
  updatedAt: Date;
  unreadCount?: number;
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content?: string;
  fileUrl?: string;
  createdAt: Date;
}
