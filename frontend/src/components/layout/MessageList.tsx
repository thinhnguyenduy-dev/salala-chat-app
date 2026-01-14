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

  // Calculate which read receipts to show (only the latest message for each reader)
  const shownReadReceipts = React.useMemo(() => {
    const shown = new Map<string, Set<string>>(); // messageId -> Set<userId>
    const userReadMap = new Set<string>(); // Set of users whose read receipt has been placed

    // Iterate backwards (newest to oldest)
    // Note: 'messages' should be sorted chronologically (oldest first) which is standard for chat logs
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const readers = messageReadBy.get(msg.id);

        if (readers) {
            readers.forEach(userId => {
                if (!userReadMap.has(userId)) {
                     // This is the latest message this user has read
                     if (!shown.has(msg.id)) {
                         shown.set(msg.id, new Set());
                     }
                     shown.get(msg.id)?.add(userId);
                     userReadMap.add(userId);
                }
            });
        }
    }
    return shown;
  }, [messages, messageReadBy]);

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
                    messageReadBy={shownReadReceipts.get(msg.id)}
                    getReaderName={(id) => participants.get(id)}
                />
            );
        })}
        <div ref={lastMessageRef} />
    </div>
  );
});
