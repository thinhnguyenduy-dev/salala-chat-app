"use client";

import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { IUser } from '@repo/shared';
import { Separator } from '@/components/ui/separator';
import { Users } from 'lucide-react';

export function SidebarRight() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const { user } = useAuthStore();
  const [participants, setParticipants] = useState<IUser[]>([]);
  const [conversationInfo, setConversationInfo] = useState<any>(null);

  useEffect(() => {
    if (!activeConversationId) {
      setParticipants([]);
      setConversationInfo(null);
      return;
    }

    const fetchConversationDetails = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/social/conversations/${user?.id}`);
        const conversations = await res.json();
        
        const currentConv = conversations.find((c: any) => c.id === activeConversationId);
        
        if (currentConv) {
          setConversationInfo(currentConv);
          
          // Fetch participant details
          const participantPromises = currentConv.participantIds
            .filter((id: string) => id !== user?.id) // Exclude current user
            .map(async (id: string) => {
              const userRes = await fetch(`${apiUrl}/social/user/${id}`);
              return userRes.json();
            });
          
          const participantData = await Promise.all(participantPromises);
          setParticipants(participantData);
        }
      } catch (error) {
        console.error('Error fetching conversation details:', error);
      }
    };

    fetchConversationDetails();
  }, [activeConversationId, user?.id]);

  if (!activeConversationId) {
    return (
      <div className="w-64 border-l bg-background flex-col hidden lg:flex h-full">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm text-muted-foreground">Thông tin</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Chọn một cuộc trò chuyện để xem thông tin
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-l bg-background flex-col hidden lg:flex h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm">Thông tin cuộc trò chuyện</h2>
      </div>

      <ScrollArea className="flex-1">
        {/* Group Info */}
        {conversationInfo?.isGroup && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-medium">{conversationInfo.name || 'Nhóm chat'}</div>
                <div className="text-xs text-muted-foreground">
                  {conversationInfo.participantIds.length} thành viên
                </div>
              </div>
            </div>
            <Separator />
          </div>
        )}

        {/* Participants */}
        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">
            Thành viên ({participants.length + 1})
          </h3>
          
          <div className="space-y-2">
            {/* Current User */}
            <div className="flex items-center gap-3 p-2 rounded-lg">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {user?.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-sm font-medium">{user?.username} (Bạn)</div>
                <div className="text-xs text-muted-foreground">
                  {user?.status === 'online' ? 'Đang hoạt động' : 'Không hoạt động'}
                </div>
              </div>
              {user?.status === 'online' && (
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
              )}
            </div>

            {/* Other Participants */}
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={participant.avatar} />
                  <AvatarFallback>
                    {participant.username?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{participant.username}</div>
                  <div className="text-xs text-muted-foreground">
                    {participant.status === 'online' ? 'Đang hoạt động' : 'Không hoạt động'}
                  </div>
                </div>
                {participant.status === 'online' && (
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                )}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
