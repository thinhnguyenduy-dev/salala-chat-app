import React, { useState, useRef } from 'react';
import { IMessage, IUser, IMessageReaction } from '@repo/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import Image from 'next/image';
import { Smile, Reply, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MessageItemProps {
  message: IMessage;
  isOwnMessage: boolean;
  sender?: IUser;
  onProfileClick: (user: IUser) => void;
  onImageClick: (url: string) => void;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onReactionRemove: (messageId: string, emoji: string) => void;
  onReply: (message: IMessage) => void;
  currentUser?: IUser;
  showAvatar?: boolean;
  showSenderName?: boolean;
  isSequence?: boolean;
  messageReadBy?: Set<string>;
  getReaderName?: (userId: string) => IUser | undefined;
}

function isAudioUrl(url: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac'];
  const lowerUrl = url.toLowerCase();
  return audioExtensions.some((ext) => lowerUrl.includes(ext)) || lowerUrl.includes('/video/upload/');
}

export const MessageItem = React.memo(({
  message,
  isOwnMessage,
  sender,
  onProfileClick,
  onImageClick,
  onReactionAdd,
  onReactionRemove,
  onReply,
  currentUser,
  showAvatar,
  showSenderName,
  isSequence,
  messageReadBy,
  getReaderName
}: MessageItemProps) => {
  const [showActions, setShowActions] = useState(false);
  
  // Group reactions by emoji
  const reactionCounts = React.useMemo(() => {
    if (!message.reactions) return {};
    const counts: Record<string, { count: number, hasReacted: boolean }> = {};
    
    message.reactions.forEach(r => {
      if (!counts[r.emoji]) {
        counts[r.emoji] = { count: 0, hasReacted: false };
      }
      counts[r.emoji].count++;
      if (r.userId === currentUser?.id) {
        counts[r.emoji].hasReacted = true;
      }
    });
    return counts;
  }, [message.reactions, currentUser?.id]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onReactionAdd(message.id, emojiData.emoji);
    setShowActions(false); // Close actions on select? Maybe keep open? Close is cleaner.
  };

  const handleReactionClick = (emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      onReactionRemove(message.id, emoji);
    } else {
      onReactionAdd(message.id, emoji);
    }
  };

  return (
    <div 
      className={cn(
        "flex gap-3 group relative", 
        isOwnMessage ? "flex-row-reverse" : "",
        isSequence ? "mt-1" : "mt-4"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
        {/* Avatar Area */}
        <div className="w-8 flex-shrink-0 flex flex-col items-center">
            {showAvatar && !isOwnMessage && (
                <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => sender && onProfileClick(sender)}>
                    <AvatarImage src={sender?.avatar} />
                    <AvatarFallback>
                        {sender?.displayName?.slice(0, 2).toUpperCase() || sender?.username?.slice(0,2).toUpperCase() || 'U'}
                    </AvatarFallback>
                </Avatar>
            )}
        </div>

        {/* Message Content Area */}
        <div className="flex flex-col max-w-[70%]">
             {/* Read Receipts (Left side for own message? No, currently bottom right inside bubble or below) 
                 We will keep read receipts inside/below as before.
             */}
             
             {showSenderName && !isOwnMessage && (
                <span className="text-xs text-muted-foreground mb-1 ml-1 cursor-pointer hover:underline" onClick={() => sender && onProfileClick(sender)}>
                  {sender?.displayName || sender?.username || 'Unknown'}
                </span>
              )}

             {/* Message Bubble */}
             <div className={cn(
                "relative p-3 rounded-lg min-w-[60px]", // min-w for timestamp
                isOwnMessage 
                  ? "bg-gradient-to-br from-brand to-brand-secondary text-white" 
                  : "bg-muted"
             )}>
                  {/* Quoted Message */}
                  {message.replyTo && (
                    <div className="mb-2 p-2 rounded bg-black/10 border-l-4 border-brand-400 text-xs flex flex-col cursor-pointer opacity-80 hover:opacity-100">
                        <span className="font-bold mb-0.5">
                            {message.replyTo.senderId === currentUser?.id ? 'Bạn' : (message.replyTo as any).sender?.username || 'Someone'}
                        </span>
                        <span className="truncate max-w-[200px] block">
                            {message.replyTo.content || (message.replyTo.fileUrl ? 'Media file' : 'No content')}
                        </span>
                    </div>
                  )}

                  <p className={cn(
                      /^[\p{Emoji}\u200d\s]+$/u.test(message.content || '') && (message.content || '').length < 10 
                          ? "text-4xl leading-relaxed" 
                          : "text-sm"
                  )}>
                      {message.content}
                  </p>
                  
                  {message.fileUrl && (
                      isAudioUrl(message.fileUrl) ? (
                        <div className="mt-2">
                          <AudioPlayer src={message.fileUrl} isOwnMessage={isOwnMessage} />
                        </div>
                      ) : (
                        <div className="mt-2 relative w-48 h-48 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onImageClick(message.fileUrl!)}>
                          <Image
                            src={message.fileUrl}
                            alt="Shared image"
                            fill
                            className="object-cover rounded-md"
                          />
                        </div>
                      )
                  )}

                  <span suppressHydrationWarning className={cn(
                      "text-[10px] block mt-1 text-right",
                      isOwnMessage ? "opacity-80" : "opacity-70"
                  )}>
                      {new Date(message.createdAt).toLocaleTimeString('vi-VN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                  </span>
                  
                  {/* Reactions Display (Absolute positioned bottom-left overlapping?) 
                      Or just flex flow below content? 
                      Let's put it overlapping bottom-left if space, or flow below.
                      Flow below inside the bubble usually looks bad.
                      Flow below OUTSIDE the bubble is standard (Slack/Discord).
                      Let's try putting it OUTSIDE the bubble first, overlapping the bottom edge.
                  */}
             </div>

             {/* Reactions Row */}
             {Object.keys(reactionCounts).length > 0 && (
                 <div className="flex flex-wrap gap-1 mt-1">
                     {Object.entries(reactionCounts).map(([emoji, { count, hasReacted }]) => (
                         <button
                            key={emoji}
                            className={cn(
                                "text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-colors hover:bg-muted-foreground/10",
                                hasReacted ? "bg-brand-100 border-brand-300 text-brand-700" : "bg-background border-border text-foreground"
                            )}
                            onClick={() => handleReactionClick(emoji, hasReacted)}
                         >
                             <span>{emoji}</span>
                             {count > 1 && <span className="font-medium text-[10px]">{count}</span>}
                         </button>
                     ))}
                 </div>
             )}

              {/* Read Receipts */}
              {isOwnMessage && messageReadBy && messageReadBy.size > 0 && (
                <div className="flex items-center gap-1 mt-1 justify-end">
                  <div className="flex -space-x-2">
                    {Array.from(messageReadBy).slice(0, 3).map((readerId) => {
                      const reader = getReaderName ? getReaderName(readerId) : undefined;
                      return (
                        <Avatar key={readerId} className="h-4 w-4 border border-background" title={reader?.username || 'Unknown'}>
                          <AvatarImage src={reader?.avatar} />
                          <AvatarFallback className="text-[8px]">
                            {reader?.username?.slice(0, 1).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {messageReadBy.size > 3 
                      ? `+${messageReadBy.size - 3}` 
                      : ''}
                  </span>
                </div>
              )}
        </div>

        {/* Action Buttons (Hover) - positioned above message bubble */}
        <div className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 absolute -top-3 z-10",
            isOwnMessage ? "right-0" : "left-10"
        )}>
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-background border shadow-sm hover:bg-muted">
                        <Smile className="h-3 w-3 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 border-none bg-transparent shadow-none" side="top">
                    <EmojiPicker 
                        onEmojiClick={handleEmojiClick}
                        width={280}
                        height={350}
                        lazyLoadEmojis={true}
                    />
                </PopoverContent>
             </Popover>

             <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full bg-background border shadow-sm hover:bg-muted"
                onClick={() => onReply(message)}
             >
                <Reply className="h-3 w-3 text-muted-foreground" />
             </Button>
        </div>
    </div>
  );
});
