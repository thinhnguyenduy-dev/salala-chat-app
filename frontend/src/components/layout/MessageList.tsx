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
}

export const MessageList = memo(function MessageList({
  messages,
  currentUser,
  participants,
  messageReadBy,
  isFetchingNextPage,
  onProfileClick,
  onImageClick,
  topRef,
  lastMessageRef
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
            const isSequence = prevMsg && prevMsg.senderId === msg.senderId;
            
            return (
              <div key={msg.id} className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} group ${isSequence ? 'mt-1' : 'mt-4'}`}> 
                  {!isOwnMessage && (
                      <div className="w-8 flex-shrink-0 flex flex-col items-center">
                          {!isSequence ? (
                              <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => sender && onProfileClick(sender)}>
                                  <AvatarImage src={sender?.avatar} />
                                  <AvatarFallback>
                                    {sender?.displayName?.slice(0, 2).toUpperCase() || sender?.username?.slice(0,2).toUpperCase() || 'U'}
                                  </AvatarFallback>
                              </Avatar>
                          ) : <div className="w-8" />}
                      </div>
                  )}

                  {isOwnMessage && (
                     <div className="w-8 flex-shrink-0 flex flex-col items-center">
                          {!isSequence ? (
                            <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => sender && onProfileClick(sender)}>
                                  <AvatarImage src={sender?.avatar} />
                                  <AvatarFallback className='bg-gradient-to-br from-purple-500 to-pink-500 text-white'>
                                    {sender?.displayName?.slice(0, 2).toUpperCase() || sender?.username?.slice(0,2).toUpperCase() || 'U'}
                                  </AvatarFallback>
                            </Avatar>
                          ) : <div className="w-8" />}
                     </div>
                  )}

                  <div className="flex flex-col max-w-[70%]">
                      {!isOwnMessage && !isSequence && (
                        <span className="text-xs text-muted-foreground mb-1 ml-1 cursor-pointer hover:underline" onClick={() => sender && onProfileClick(sender)}>
                          {sender?.displayName || sender?.username || 'Unknown'}
                        </span>
                      )}
                      <div className={`p-3 rounded-lg ${
                        isOwnMessage 
                          ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' 
                          : 'bg-muted'
                      }`}>
                           <p className={`${
                               /^[\p{Emoji}\u200d\s]+$/u.test(msg.content || '') && (msg.content || '').length < 10 
                                 ? 'text-4xl leading-relaxed' 
                                 : 'text-sm'
                           }`}>{msg.content}</p>
                           {msg.fileUrl && (
                              isAudioUrl(msg.fileUrl) ? (
                                <div className="mt-2">
                                  <AudioPlayer src={msg.fileUrl} isOwnMessage={isOwnMessage} />
                                </div>
                              ) : (
                                <div className="mt-2 relative w-48 h-48 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onImageClick(msg.fileUrl!)}>
                                  <Image
                                    src={msg.fileUrl}
                                    alt="Shared image"
                                    fill
                                    className="object-cover rounded-md"
                                  />
                                </div>
                              )
                           )}
                           <span suppressHydrationWarning className={`text-[10px] block mt-1 text-right ${
                             isOwnMessage ? 'opacity-80' : 'opacity-70'
                           }`}>
                              {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                           </span>
                      </div>
                      
                      {/* Read Receipts - Only show for own messages */}
                      {isOwnMessage && messageReadBy.get(msg.id) && messageReadBy.get(msg.id)!.size > 0 && (
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <div className="flex -space-x-2">
                            {Array.from(messageReadBy.get(msg.id)!).slice(0, 3).map((readerId) => {
                              const reader = participants.get(readerId);
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
                            {messageReadBy.get(msg.id)!.size > 3 
                              ? `Đã xem bởi ${messageReadBy.get(msg.id)!.size} người` 
                              : messageReadBy.get(msg.id)!.size === 1
                              ? 'Đã xem'
                              : `Đã xem bởi ${messageReadBy.get(msg.id)!.size} người`}
                          </span>
                        </div>
                      )}
                  </div>
              </div>
            );
        })}
        <div ref={lastMessageRef} />
    </div>
  );
});
