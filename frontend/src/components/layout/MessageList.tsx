import React, { memo } from 'react';
import { IMessage, IUser } from '@repo/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import Image from 'next/image';

function isAudioUrl(url: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac'];
  const lowerUrl = url.toLowerCase();
  return audioExtensions.some((ext) => lowerUrl.includes(ext)) || lowerUrl.includes('/video/upload/');
}

interface MessageListProps {
  messages: IMessage[];
  currentUser: IUser | null;
  participants: Map<string, any>;
  messageReadBy: Map<string, Set<string>>;
  isFetchingNextPage: boolean;
  onProfileClick: (user: IUser) => void;
  onImageClick: (url: string) => void;
  topRef: React.Ref<HTMLDivElement>;
  lastMessageRef: React.Ref<HTMLDivElement>;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onReactionRemove: (messageId: string, emoji: string) => void;
  onReply: (message: IMessage) => void;
}

import { MessageItem } from './MessageItem';

export const MessageList = memo(function MessageList({
  messages,
  currentUser,
  participants,
  messageReadBy,
  isFetchingNextPage,
  onProfileClick,
  onImageClick,
  topRef,
  lastMessageRef,
  onReactionAdd: handleReactionAdd,
  onReactionRemove: handleReactionRemove,
  onReply: handleReply
}: MessageListProps) {
  return (
    <div className="space-y-4 flex flex-col justify-end min-h-full">
        {/* Loading Indicator at Top */}
        <div ref={topRef} className="h-4 w-full flex justify-center p-2">
            {isFetchingNextPage && <span className="text-xs text-muted-foreground">Đang tải...</span>}
        </div>

        {messages.map((msg, i) => {
            const isOwnMessage = msg.senderId === currentUser?.id;
            const sender = participants.get(msg.senderId);
            const prevMsg = i > 0 ? messages[i - 1] : null;
            const isSequence = !!(prevMsg && prevMsg.senderId === msg.senderId);
            
            return (
                <MessageItem 
                    key={msg.id}
                    message={msg}
                    isOwnMessage={isOwnMessage}
                    sender={sender}
                    currentUser={currentUser || undefined} // Fix type mismatch null vs undefined
                    onProfileClick={onProfileClick}
                    onImageClick={onImageClick}
                    onReactionAdd={handleReactionAdd}
                    onReactionRemove={handleReactionRemove}
                    onReply={handleReply}
                    showAvatar={!isOwnMessage && !isSequence}
                    showSenderName={!isOwnMessage && !isSequence}
                    isSequence={isSequence}
                    messageReadBy={messageReadBy.get(msg.id)}
                    getReaderName={(id) => participants.get(id)}
                />
            );
        })}
        <div ref={lastMessageRef} />
    </div>
  );
});
