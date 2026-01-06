"use client";

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Info } from 'lucide-react';
import { IMessage, IUser } from '@repo/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadFile, uploadAudio } from '@/lib/upload';
import Image from 'next/image';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';
import { useMessagesInfinite } from '@/hooks/useMessagesInfinite';
import { useChatStore } from '@/store/useChatStore';
import { useInView } from 'react-intersection-observer';
import { useAuthStore } from '@/store/useAuthStore';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { UserProfileDialog } from '@/components/features/UserProfileDialog';

import { useTranslation } from 'react-i18next';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ArrowLeft } from 'lucide-react';
import { CallButton } from '@/components/features/CallButton';

export function ChatArea() {
  const { t } = useTranslation();
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const messagesMap = useChatStore((state) => state.messages);
  const markOneAsRead = useChatStore((state) => state.markOneAsRead); // Direct selector for stability
  const toggleInfoSidebarOpen = useChatStore((state) => state.toggleInfoSidebarOpen);
  const isInfoSidebarOpen = useChatStore((state) => state.isInfoSidebarOpen);
  const setMobileView = useChatStore((state) => state.setMobileView);
  const realtimeMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];
  
  const { user } = useAuthStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { ref: topRef, inView } = useInView();
  
  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | undefined>(undefined);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<IMessage | null>(null);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Read receipts state: Map<messageId, Set<userId>>
  const [messageReadBy, setMessageReadBy] = useState<Map<string, Set<string>>>(new Map());

  const { socket, sendMessage: socketSendMessage, joinRoom, emitTyping, emitStopTyping, emitMarkAsRead } = useSocket();
  const conversations = useChatStore((state) => state.conversations);

  // Memoized callbacks for ChatInput
  const handleTyping = useCallback(() => {
    if (activeConversationId && emitTyping) {
      emitTyping(activeConversationId);
    }
  }, [activeConversationId, emitTyping]);

  const handleStopTyping = useCallback(() => {
    if (activeConversationId && emitStopTyping) {
      emitStopTyping(activeConversationId);
    }
  }, [activeConversationId, emitStopTyping]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setSelectedFileUrl(URL.createObjectURL(file));
  }, []);

  const handleClearFile = useCallback(() => {
    if (selectedFileUrl) {
      URL.revokeObjectURL(selectedFileUrl);
    }
    setSelectedFile(null);
    setSelectedFileUrl(undefined);
  }, [selectedFileUrl]);

  const handleSendMessage = useCallback(async (content: string, fileUrlFromInput?: string, replyToId?: string) => {
    if (!activeConversationId || (!content.trim() && !selectedFile)) return;

    let fileUrl = fileUrlFromInput;
    if (selectedFile && !fileUrl) {
      setIsUploading(true);
      try {
        fileUrl = await uploadFile(selectedFile);
      } catch (e) {
        console.error(e);
        toast.error('Upload failed: ' + (e as Error).message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    if (socketSendMessage) {
      socketSendMessage(activeConversationId, content, fileUrl, replyToId);
      handleClearFile();
      setReplyingTo(null);
    }
  }, [activeConversationId, selectedFile, socketSendMessage, handleClearFile]);

  const handleVoiceSend = useCallback(async (audioBlob: Blob) => {
    if (!activeConversationId) return;

    setIsUploading(true);
    try {
      const fileUrl = await uploadAudio(audioBlob);
      if (socketSendMessage) {
        socketSendMessage(activeConversationId, '', fileUrl, replyingTo?.id);
        setReplyingTo(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to upload voice message');
    } finally {
      setIsUploading(false);
    }
  }, [activeConversationId, socketSendMessage, replyingTo?.id]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleReactionAdd = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${apiUrl}/social/messages/${messageId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, emoji })
      });
      // Store update handled by socket event
    } catch (e) {
      console.error('Failed to add reaction', e);
    }
  };

  const handleReactionRemove = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${apiUrl}/social/messages/${messageId}/reaction/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, emoji })
      });
    } catch (e) {
      console.error('Failed to remove reaction', e);
    }
  };

  const handleReply = useCallback((message: IMessage) => {
    setReplyingTo(message);
  }, []);

  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    status 
  } = useMessagesInfinite(activeConversationId);

  // Load more when scrolling to top
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Combined messages: Flatten pages (history is desc: newest first in API, so Page 1 is [Newest...Older])
  const displayMessages = useMemo(() => {
    const historyMessages = data?.pages.flatMap((page) => page.data) || [];
    const allMessagesMap = new Map();
    // Add history (reversed to be chronological for processing)
    [...historyMessages].reverse().forEach(m => allMessagesMap.set(m.id, m));
    // Add real-time
    realtimeMessages.forEach(m => allMessagesMap.set(m.id, m));
    return Array.from(allMessagesMap.values());
  }, [data?.pages, realtimeMessages]);

  // Clear unread count when opening chat
  useEffect(() => {
    if (activeConversationId) {
      markOneAsRead(activeConversationId);
    }
  }, [activeConversationId, markOneAsRead]);

  // Join room when conversation changes
  useEffect(() => {
    if (activeConversationId && joinRoom) {
      joinRoom(activeConversationId);
    }
  }, [activeConversationId, joinRoom]);

  // Scroll to bottom on load/message update
  useEffect(() => {
    if (scrollAreaRef.current) {
         // Use setTimeout to ensure DOM is updated
         setTimeout(() => {
             const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
             if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
             }
         }, 100);
    }
  }, [activeConversationId, displayMessages.length]);

  // Listen for typing events
  useEffect(() => {
    const handleUserTyping = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { userId, conversationId } = customEvent.detail;
      if (conversationId === activeConversationId) {
        setTypingUsers(prev => new Set(prev).add(userId));
      }
    };
    
    const handleUserStopTyping = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { userId } = customEvent.detail;
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };
    
    window.addEventListener('userTyping', handleUserTyping);
    window.addEventListener('userStopTyping', handleUserStopTyping);
    
    return () => {
      window.removeEventListener('userTyping', handleUserTyping);
      window.removeEventListener('userStopTyping', handleUserStopTyping);
    };
  }, [activeConversationId]);

  // Stop typing when leaving conversation
  useEffect(() => {
    return () => {
      if (activeConversationId && emitStopTyping) {
        emitStopTyping(activeConversationId);
      }
    };
  }, [activeConversationId, emitStopTyping]);

  // Listen for read receipts events
  useEffect(() => {
    const handleMessagesRead = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { messageIds, userId } = customEvent.detail;
      
      setMessageReadBy(prev => {
        const newMap = new Map(prev);
        messageIds.forEach((msgId: string) => {
          const readers = newMap.get(msgId) || new Set<string>();
          readers.add(userId);
          newMap.set(msgId, readers);
        });
        return newMap;
      });
    };
    
    window.addEventListener('messagesRead', handleMessagesRead);
    
    return () => {
      window.removeEventListener('messagesRead', handleMessagesRead);
    };
  }, []);

  // Hydrate read receipts from fetched messages (history)
  useEffect(() => {
    if (displayMessages.length > 0) {
        setMessageReadBy(prev => {
            const next = new Map(prev);
            let changed = false;
            displayMessages.forEach(msg => {
                if ((msg as any).reads && Array.isArray((msg as any).reads)) {
                    const existing = next.get(msg.id) || new Set();
                    (msg as any).reads.forEach((r: any) => {
                        if (!existing.has(r.userId) && r.userId !== user?.id) { // Don't count self if returned
                            existing.add(r.userId);
                            changed = true;
                        }
                    });
                    if (existing.size > 0) next.set(msg.id, existing);
                }
            });
            return changed ? next : prev;
        });
    }
  }, [displayMessages]);

  // Track which messages we've already marked as read to avoid excessive API calls
  const markedMessagesRef = useRef<Set<string>>(new Set());

  // Auto-mark messages as read when they come into view
  useEffect(() => {
    if (!activeConversationId || !emitMarkAsRead || displayMessages.length === 0 || !user?.id) return;
    
    // Get unread messages (messages not sent by current user and not already marked)
    const unreadMessages = displayMessages.filter(
      msg => msg.senderId !== user.id && !markedMessagesRef.current.has(msg.id)
    );
    
    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(msg => msg.id);
      
      // Mark as read after a short delay to ensure user actually sees them
      const timer = setTimeout(() => {
        emitMarkAsRead(messageIds);
        // Update local store to clear unread badge immediately
        markOneAsRead(activeConversationId);
        // Add to marked set to prevent re-marking
        messageIds.forEach(id => markedMessagesRef.current.add(id));
      }, 1000); // Increased delay to 1 second
      
      return () => clearTimeout(timer);
    }
  }, [displayMessages.length, activeConversationId, user?.id, emitMarkAsRead, markOneAsRead]); // Only depend on length, not entire array

  // Clear marked messages when switching conversations
  useEffect(() => {
    markedMessagesRef.current.clear();
  }, [activeConversationId]);

  // Auto-scroll to bottom on NEW real-time message (basic implementation)
  const lastMessageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      // Logic to only scroll if already at bottom or if it's my message could be added here
      lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [realtimeMessages.length]);

  // Fetch conversation details for header
  const [conversationName, setConversationName] = useState<string>('Chat');
  const [participants, setParticipants] = useState<Map<string, any>>(new Map());
  const [otherUser, setOtherUser] = useState<IUser | null>(null);

  useEffect(() => {
    if (!activeConversationId) return;

    const fetchConversationInfo = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/social/conversations/${user?.id}`);
        const conversations = await res.json();
        
        const currentConv = conversations.find((c: any) => c.id === activeConversationId);
        
        setOtherUser(null); // Reset
        
        if (currentConv) {
          if (currentConv.isGroup) {
            setConversationName(currentConv.name || 'Nhóm chat');
          } else {
            // For 1-on-1, show other person's name
            const otherUserId = currentConv.participantIds.find((id: string) => id !== user?.id);
            if (otherUserId) {
              const userRes = await fetch(`${apiUrl}/social/user/${otherUserId}`);
              const userData = await userRes.json();
              setConversationName(userData.displayName || userData.username);
              setOtherUser(userData);
            }
          }

          // Fetch all participants info
          const participantMap = new Map();
          for (const participantId of currentConv.participantIds) {
            const userRes = await fetch(`${apiUrl}/social/user/${participantId}`);
            const userData = await userRes.json();
            participantMap.set(participantId, userData);
          }
          setParticipants(participantMap);
        }
      } catch (error) {
        console.error('Error fetching conversation info:', error);
      }
    };

    fetchConversationInfo();
  }, [activeConversationId, user?.id]);

  const [selectedProfileUser, setSelectedProfileUser] = useState<IUser | null>(null);

  // Helper to open profile from header (only if 1-on-1)
  const handleHeaderProfileClick = async () => {
      // Find the user object for the other person
      if (!activeConversationId) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/social/conversations/${user?.id}`);
        const convs = await res.json();
        const currentConv = convs.find((c: any) => c.id === activeConversationId);
        
        if (currentConv && !currentConv.isGroup) {
            const otherUserId = currentConv.participantIds.find((id: string) => id !== user?.id);
            if (otherUserId) {
                // Check if we already have it in participants map
                if (participants.has(otherUserId)) {
                    setSelectedProfileUser(participants.get(otherUserId));
                } else {
                    // Fetch
                    const userRes = await fetch(`${apiUrl}/social/user/${otherUserId}`);
                    const userData = await userRes.json();
                    setSelectedProfileUser(userData);
                }
            }
        }
      } catch (e) {
          console.error(e);
      }
  };

  const handleProfileClick = useMemo(() => (u: IUser) => setSelectedProfileUser(u), []);
  const handleImageClick = useMemo(() => (url: string) => setViewImage(url), []);

  if (!activeConversationId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Chọn một cuộc trò chuyện</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background h-screen">
      {/* Header */}
      <div className="h-14 border-b flex items-center px-4 justify-between bg-card/50 backdrop-blur">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setMobileView('chats')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleHeaderProfileClick}>
             <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                    {conversationName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
              </Avatar>
              <span className="font-bold">{conversationName}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {otherUser && activeConversationId && (
            <CallButton 
              conversationId={activeConversationId}
              otherUserId={otherUser.id}
              otherUserName={otherUser.displayName || otherUser.username}
              otherUserAvatar={otherUser.avatar || null}
            />
          )}

          <Button variant="ghost" size="icon" onClick={() => toggleInfoSidebarOpen()} title="Thông tin hội thoại">
              <Info className={`h-5 w-5 ${isInfoSidebarOpen ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0">
          <ScrollArea className="h-full p-4">
        <div className="space-y-4 flex flex-col justify-end min-h-full">
            {/* Loading Indicator at Top */}
            <div ref={topRef} className="h-4 w-full flex justify-center p-2">
                {isFetchingNextPage && <span className="text-xs text-muted-foreground">Đang tải...</span>}
            </div>

            <MessageList 
                messages={displayMessages}
                currentUser={user as any} 
                participants={participants}
                messageReadBy={messageReadBy}
                isFetchingNextPage={isFetchingNextPage}
                onProfileClick={handleProfileClick}
                onImageClick={handleImageClick}
                topRef={topRef}
                lastMessageRef={lastMessageRef}
                onReactionAdd={handleReactionAdd}
                onReactionRemove={handleReactionRemove}
                onReply={handleReply}
            />
            <div ref={lastMessageRef} />
        </div>
      </ScrollArea>
      </div>

      <UserProfileDialog 
        user={selectedProfileUser} 
        open={!!selectedProfileUser} 
        onOpenChange={(open) => !open && setSelectedProfileUser(null)} 
      />

      {/* Input Area */}
      {/* Typing Indicator */}
      {typingUsers.size > 0 && (
          <div className="px-4 pb-2 text-xs text-muted-foreground italic animate-pulse">
            {Array.from(typingUsers).map(uid => {
                const p = participants.get(uid);
                return p?.displayName || p?.username || 'Someone';
            }).join(', ')} {t('common.is_typing') || 'đang soạn tin...'}
          </div>
      )}
      <ChatInput
        onSendMessage={handleSendMessage}
        onVoiceSend={handleVoiceSend}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
        replyingTo={replyingTo}
        onCancelReply={handleCancelReply}
        replyToName={replyingTo ? (participants.get(replyingTo.senderId)?.displayName || participants.get(replyingTo.senderId)?.username) : undefined}
        isUploading={isUploading}
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        onClearFile={handleClearFile}
        selectedFileUrl={selectedFileUrl}
      />

      {/* Image Viewer Dialog */}
      <Dialog open={!!viewImage} onOpenChange={(open) => !open && setViewImage(null)}>
        <DialogContent className="max-w-screen-lg w-full h-[90vh] p-0 bg-transparent border-0 shadow-none flex items-center justify-center [&>button]:hidden">
          <DialogTitle className="sr-only">Image Viewer</DialogTitle>
          <div className="relative w-full h-full">
            {viewImage && (
              <Image
                src={viewImage}
                alt="Full screen view"
                fill
                className="object-contain"
                priority
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
