"use client";

import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { IUser } from '@repo/shared';
import { Separator } from '@/components/ui/separator';
import { Users, PlusCircle, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CreateGroupDialog } from '@/components/features/CreateGroupDialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export function SidebarRight() {
  const { t } = useTranslation();
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const { user } = useAuthStore();
  const [participants, setParticipants] = useState<IUser[]>([]);
  const [conversationInfo, setConversationInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'media'>('info');
  const [media, setMedia] = useState<any[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const setConversations = useChatStore((state) => state.setConversations);
  const conversations = useChatStore((state) => state.conversations);

  const handleSaveGroupName = async () => {
    if (!activeConversationId || !newGroupName.trim()) return;

    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/social/conversation/${activeConversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newGroupName })
        });

        if (res.ok) {
            const updated = await res.json();
            setConversationInfo(updated);
            setIsEditingName(false);
            
            // Update global store
            const updatedConversations = conversations.map(c => 
                c.id === activeConversationId ? { ...c, name: newGroupName } : c
            );
            setConversations(updatedConversations);
        }
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    if (!activeConversationId) {
      setParticipants([]);
      setConversationInfo(null);
      setMedia([]);
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
            .filter((id: string) => id !== user?.id)
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

  useEffect(() => {
    if (activeConversationId && activeTab === 'media') {
       const fetchMedia = async () => {
         try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const res = await fetch(`${apiUrl}/social/conversation/${activeConversationId}/media`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setMedia(data);
            }
         } catch (e) {
             console.error(e);
         }
       };
       fetchMedia();
    }
  }, [activeConversationId, activeTab]);

  if (!activeConversationId) {
    return (
       <div className="w-80 border-l bg-background flex-col hidden lg:flex h-full">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg">{t('sidebar_right.info')}</h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
            <Users className="h-12 w-12 opacity-20" />
            <p>{t('sidebar_right.select_chat')}</p>
          </div>
       </div>
    );
  }

  return (
    <div className="w-80 border-l bg-background flex-col hidden lg:flex h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">{t('sidebar_right.title')}</h2>
      </div>

      {/* Tabs */}
      <div className="flex p-1 m-4 bg-muted/50 rounded-lg">
         <button 
           className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'info' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
           onClick={() => setActiveTab('info')}
         >
           {t('sidebar_right.members')}
         </button>
         <button 
           className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'media' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
           onClick={() => setActiveTab('media')}
         >
           {t('sidebar_right.media')}
         </button>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === 'info' ? (
            <div className="p-4 pt-0">
                {/* Header Info */}
                <div className="flex flex-col items-center gap-3 mb-6">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand to-brand-secondary flex items-center justify-center shadow-lg">
                        {conversationInfo?.isGroup ? (
                            <Users className="h-10 w-10 text-white" />
                        ) : (
                            <Avatar className="h-20 w-20 border-4 border-background">
                                <AvatarImage src={participants[0]?.avatar} />
                                <AvatarFallback className="text-2xl">{participants[0]?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-lg flex items-center gap-2 justify-center">
                            {conversationInfo?.isGroup ? (
                                isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            className="border rounded px-2 py-1 text-sm text-black"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            autoFocus
                                        />
                                        <Button size="sm" onClick={handleSaveGroupName}>Lưu</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>Hủy</Button>
                                    </div>
                                ) : (
                                    <>
                                        {conversationInfo.name}
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                            setNewGroupName(conversationInfo.name);
                                            setIsEditingName(true);
                                        }}>
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </>
                                )
                            ) : participants[0]?.username}
                        </h3>
                        {!conversationInfo?.isGroup && (
                             <div className="flex flex-col items-center gap-1 mt-1">
                                <p className="text-sm text-muted-foreground">{participants[0]?.email}</p>
                                <div className={`text-xs flex items-center gap-1.5 px-2 py-0.5 rounded-full ${participants[0]?.status === 'online' ? 'bg-green-500/10 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${participants[0]?.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                    {participants[0]?.status === 'online' ? t('common.online') : t('common.offline')}
                                </div>
                             </div>
                        )}
                    </div>
                </div>

                <Separator className="my-4" />

                {conversationInfo?.isGroup ? (
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {t('sidebar_right.members')} ({participants.length + 1})
                        </h3>
                        
                        <div className="space-y-3">
                            {/* Me */}
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                                <Avatar className="h-10 w-10 border border-border">
                                    <AvatarImage src={user?.avatar} />
                                    <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{user?.username} <span className="text-muted-foreground text-xs">(Bạn)</span></div>
                                    <div className="text-xs text-green-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
                                    </div>
                                </div>
                            </div>

                            {/* Others */}
                            {participants.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                                    <Avatar className="h-10 w-10 border border-border">
                                        <AvatarImage src={p.avatar} />
                                        <AvatarFallback>{p.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{p.username}</div>
                                        <div className={`text-xs flex items-center gap-1 ${p.status === 'online' ? 'text-green-500' : 'text-muted-foreground'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                            {p.status === 'online' ? 'Online' : 'Offline'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('sidebar_right.personal_info')}</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-muted-foreground">{t('profile.display_name')}:</span>
                                    <span className="font-medium text-right">{participants[0]?.displayName || participants[0]?.username}</span>
                                </div>
                                
                                {participants[0]?.phoneNumber && (
                                  <div className="flex justify-between border-b pb-2">
                                      <span className="text-muted-foreground">{t('profile.phone')}:</span>
                                      <span className="font-medium text-right">{participants[0]?.phoneNumber}</span>
                                  </div>
                                )}

                                {participants[0]?.dateOfBirth && (
                                  <div className="flex justify-between border-b pb-2">
                                      <span className="text-muted-foreground">{t('profile.dob')}:</span>
                                      <span suppressHydrationWarning className="font-medium text-right">
                                        {format(new Date(participants[0].dateOfBirth), 'dd/MM/yyyy')}
                                      </span>
                                  </div>
                                )}
                            </div>
                        </div>

                        <CreateGroupDialog initialSelectedIds={[participants[0]?.id]}>
                          <Button className="w-full" variant="outline">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {t('common.create_group')}
                          </Button>
                        </CreateGroupDialog>
                    </div>
                )}
            </div>
        ) : (
            <div className="p-4 pt-0">
                <div className="grid grid-cols-3 gap-2">
                    {media.map((item) => (
                        <div key={item.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted group cursor-pointer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src={item.fileUrl} 
                                alt="Shared media" 
                                className="object-cover w-full h-full transition-transform group-hover:scale-105"
                            />
                        </div>
                    ))}
                </div>
                {media.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        {t('sidebar_right.no_media')}
                    </div>
                )}
            </div>
        )}
      </ScrollArea>
    </div>
  );
}
