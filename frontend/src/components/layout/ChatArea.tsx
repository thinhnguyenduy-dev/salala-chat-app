"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip, Smile } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadFile } from '@/lib/upload';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';
import { useMessagesInfinite } from '@/hooks/useMessagesInfinite';
import { useChatStore } from '@/store/useChatStore';
import { useInView } from 'react-intersection-observer';
import { useAuthStore } from '@/store/useAuthStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { UserProfileDialog } from '@/components/features/UserProfileDialog';
import { IUser } from '@repo/shared';

import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useTranslation } from 'react-i18next';

export function ChatArea() {
  const { t } = useTranslation();
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const messagesMap = useChatStore((state) => state.messages);
  const markOneAsRead = useChatStore((state) => state.markOneAsRead); // Direct selector for stability
  const realtimeMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];
  
  const { user } = useAuthStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { ref: topRef, inView } = useInView();
  
  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const { socket, sendMessage: socketSendMessage, joinRoom } = useSocket();
  const conversations = useChatStore((state) => state.conversations);
  
  // Mark as read when active conversation changes
  useEffect(() => {
    if (activeConversationId && user?.id) {
       // Optimistic update
       markOneAsRead(activeConversationId);
       
       // Call API
       const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
       fetch(`${apiUrl}/social/conversation/${activeConversationId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
       }).catch(console.error);
    }
  }, [activeConversationId, user?.id, markOneAsRead]);

  const handleSendMessage = async () => {
    if (!activeConversationId || (!inputText.trim() && !selectedFile)) return;
    
    let fileUrl = undefined;
    if (selectedFile) {
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
        socketSendMessage(activeConversationId, inputText, fileUrl);
        setInputText('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
 const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



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
  // TanStack Query pages: [Page1, Page2, ...]
  // We want to display oldest at top.
  // So we reverse the *entire* list? 
  // API returns DESC. Page 1: 10:00, 09:59... Page 2: 09:58, 09:57...
  // Flattened: [10:00, 09:59... 09:57...]
  // Reversed for UI: [...09:57, ...09:59, 10:00] -> Correct chronological order.
  
  const historyMessages = data?.pages.flatMap((page) => page.data) || [];
  
  // MERGE STRATEGY: 
  // Real-time messages are usually *after* history.
  // But history fetches might overlap if real-time messages came in while we were fetching?
  // Ideally, use a Map to dedup by ID.
  const allMessagesMap = new Map();
  // Add history (reversed to be chronological for processing)
  [...historyMessages].reverse().forEach(m => allMessagesMap.set(m.id, m));
  // Add real-time
  realtimeMessages.forEach(m => allMessagesMap.set(m.id, m));
  
  const displayMessages = Array.from(allMessagesMap.values());

  // Join room when conversation changes
  useEffect(() => {
    if (activeConversationId && joinRoom) {
      joinRoom(activeConversationId);
      
      // Mark conversation as read when opening it
      if (displayMessages.length > 0 && user?.id) {
        const lastMessage = displayMessages[displayMessages.length - 1];
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        fetch(`${apiUrl}/social/conversation/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: activeConversationId,
            userId: user.id,
            lastMessageId: lastMessage.id,
          }),
        }).catch(err => console.error('Failed to mark as read:', err));
      }
    }
  }, [activeConversationId, joinRoom, displayMessages.length, user?.id]);

  // Auto-scroll to bottom on NEW real-time message (basic implementation)
  const lastMessageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      // Logic to only scroll if already at bottom or if it's my message could be added here
      lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [realtimeMessages.length]);

  // Fetch conversation details for header
  const [conversationName, setConversationName] = useState<string>('Chat');
  const [participants, setParticipants] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!activeConversationId) return;

    const fetchConversationInfo = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/social/conversations/${user?.id}`);
        const conversations = await res.json();
        
        const currentConv = conversations.find((c: any) => c.id === activeConversationId);
        
        if (currentConv) {
          if (currentConv.isGroup) {
            setConversationName(currentConv.name || 'Nhóm chat');
          } else {
            // For 1-on-1, show other person's name
            const otherUserId = currentConv.participantIds.find((id: string) => id !== user?.id);
            if (otherUserId) {
              const userRes = await fetch(`${apiUrl}/social/user/${otherUserId}`);
              const userData = await userRes.json();
              setConversationName(userData.username);
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

  // ... (keep existing effects)

  // Helper to open profile from header (only if 1-on-1)
  const handleHeaderProfileClick = async () => {
      // Find the user object for the other person
      if (!activeConversationId) return;
       // We need to find the other participant ID
       // We can use the participants Map if we have it
       // But participants map keys are IDs, values are User objects.
       
       // If it's a group, maybe show group members list? For now let's focus on 1-on-1 profile
       // Check conversation type
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

  if (!activeConversationId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Chọn một cuộc trò chuyện</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background h-screen">
      {/* Header */}
      <div className="h-14 border-b flex items-center px-4 justify-between bg-card/50 backdrop-blur">
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleHeaderProfileClick}>
           <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {conversationName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="font-bold">{conversationName}</span>
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

            {displayMessages.map((msg, i) => {
                const isOwnMessage = msg.senderId === user?.id;
                const sender = participants.get(msg.senderId);
                
                return (
                  <div key={msg.id} className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} group`}> 
                      <Avatar className="h-8 w-8 mt-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => sender && setSelectedProfileUser(sender)}>
                          <AvatarImage src={sender?.avatar} />
                          <AvatarFallback className={isOwnMessage ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' : ''}>
                            {sender?.username?.slice(0,2).toUpperCase() || 'U'}
                          </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col max-w-[70%]">
                          {!isOwnMessage && (
                            <span className="text-xs text-muted-foreground mb-1 ml-1 cursor-pointer hover:underline" onClick={() => sender && setSelectedProfileUser(sender)}>
                              {sender?.username || 'Unknown'}
                            </span>
                          )}
                          <div className={`p-3 rounded-lg ${
                            isOwnMessage 
                              ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' 
                              : 'bg-muted'
                          }`}>
                               <p className={`${
                                   /^[\p{Emoji}\u200d\s]+$/u.test(msg.content) && msg.content.length < 10 
                                     ? 'text-4xl leading-relaxed' 
                                     : 'text-sm'
                               }`}>{msg.content}</p>
                               {msg.fileUrl && (
                                   <div className="mt-2 relative w-48 h-48 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setViewImage(msg.fileUrl)}>
                                       <Image 
                                          src={msg.fileUrl} 
                                          alt="Shared image" 
                                          fill 
                                          className="object-cover rounded-md"
                                       />
                                   </div>
                               )}
                               <span className={`text-[10px] block mt-1 text-right ${
                                 isOwnMessage ? 'opacity-80' : 'opacity-70'
                               }`}>
                                  {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                               </span>
                          </div>
                      </div>
                  </div>
                );
            })}
            <div ref={lastMessageRef} />
        </div>
      </ScrollArea>
      </div>

     {/* ... Input Area ... */}
      
      {/* ... Image Viewer ... */}

      <UserProfileDialog 
        user={selectedProfileUser} 
        open={!!selectedProfileUser} 
        onOpenChange={(open) => !open && setSelectedProfileUser(null)} 
      />




      {/* Input Area */}
      <div className="p-4 border-t bg-card/50 backdrop-blur">
        {selectedFile && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg w-fit">
                <div className="relative w-12 h-12 rounded overflow-hidden">
                    <Image 
                        src={URL.createObjectURL(selectedFile)} 
                        alt="Preview" 
                        fill 
                        className="object-cover"
                    />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-medium max-w-[150px] truncate">{selectedFile.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 ml-1 rounded-full hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                >
                    <span className="sr-only">Remove</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>
                </Button>
            </div>
        )}
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                    setSelectedFile(e.target.files[0]);
                }
            }} 
        />
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl">
             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-background" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
            </Button>
            <Input 
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground" 
                placeholder={isUploading ? t('common.uploading') : t('common.type_message')}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isUploading}
            />
            <div className="relative">
                {showEmojiPicker && (
                    <div className="absolute bottom-12 right-0 z-10 shadow-xl rounded-xl">
                        <EmojiPicker 
                            onEmojiClick={(emojiData) => setInputText((prev) => prev + emojiData.emoji)}
                            width={300}
                            height={400}
                        />
                    </div>
                )}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-9 w-9 rounded-full text-muted-foreground hover:bg-background ${showEmojiPicker ? 'text-primary bg-background' : ''}`}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                    <Smile className="h-5 w-5" />
                </Button>
            </div>
            <Button size="icon" className="h-9 w-9 rounded-full" onClick={handleSendMessage} disabled={isUploading || (!inputText.trim() && !selectedFile)}>
                <Send className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {/* Image Viewer Dialog */}
      <Dialog open={!!viewImage} onOpenChange={(open) => !open && setViewImage(null)}>
        <DialogContent className="max-w-screen-lg w-full h-[90vh] p-0 bg-transparent border-0 shadow-none flex items-center justify-center">
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
