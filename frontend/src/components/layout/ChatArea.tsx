"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip, Smile } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadFile } from '@/lib/upload';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useMessagesInfinite } from '@/hooks/useMessagesInfinite';
import { useChatStore } from '@/store/useChatStore';
import { useInView } from 'react-intersection-observer';
import { useAuthStore } from '@/store/useAuthStore';

export function ChatArea() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const messagesMap = useChatStore((state) => state.messages);
  const realtimeMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];
  
  const { user } = useAuthStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { ref: topRef, inView } = useInView();
  
  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [inputText, setInputText] = useState('');
  
  const { socket, sendMessage: socketSendMessage, joinRoom } = useSocket();

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

  const handleSendMessage = async () => {
    if (!activeConversationId || (!inputText.trim() && !fileInputRef.current?.files?.length)) return;
    
    let fileUrl = undefined;
    if (fileInputRef.current?.files?.length) {
        setIsUploading(true);
        try {
            fileUrl = await uploadFile(fileInputRef.current.files[0]);
        } catch (e) {
            console.error(e);
            alert('Upload failed');
            setIsUploading(false);
            return;
        }
        setIsUploading(false);
    }

    if (socketSendMessage) {
        socketSendMessage(activeConversationId, inputText, fileUrl);
        setInputText('');
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

  if (!activeConversationId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Chọn một cuộc trò chuyện</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background h-screen">
      {/* Header */}
      <div className="h-14 border-b flex items-center px-4 justify-between bg-card/50 backdrop-blur">
        <div className="flex items-center gap-3">
           <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {conversationName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="font-bold">{conversationName}</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
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
                      <Avatar className="h-8 w-8 mt-1">
                          <AvatarImage src={sender?.avatar} />
                          <AvatarFallback className={isOwnMessage ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' : ''}>
                            {sender?.username?.slice(0,2).toUpperCase() || 'U'}
                          </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col max-w-[70%]">
                          {!isOwnMessage && (
                            <span className="text-xs text-muted-foreground mb-1 ml-1">
                              {sender?.username || 'Unknown'}
                            </span>
                          )}
                          <div className={`p-3 rounded-lg ${
                            isOwnMessage 
                              ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' 
                              : 'bg-muted'
                          }`}>
                               <p className="text-sm">{msg.content}</p>
                               {msg.fileUrl && (
                                   <div className="mt-2 relative w-48 h-48">
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

      {/* Input Area */}
      <div className="p-4 border-t bg-card/50 backdrop-blur">
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={() => {
                // Optional: Show preview or auto-send. For now, just having it selected is enough to trigger logic on Send.
                // Or maybe better UX: Show file name?
            }} 
        />
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl">
             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-background" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
            </Button>
            <Input 
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground" 
                placeholder={isUploading ? "Uploading..." : "Type a message..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isUploading}
            />
             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-background">
                <Smile className="h-5 w-5" />
            </Button>
            <Button size="icon" className="h-9 w-9 rounded-full" onClick={handleSendMessage} disabled={isUploading}>
                <Send className="h-4 w-4" />
            </Button>
        </div>
      </div>
    </div>
  );
}
