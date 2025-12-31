"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, LogOut, Users, User as UserIcon, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useRouter } from 'next/navigation';
import { IUser } from '@repo/shared';
import { AddFriendDialog } from '@/components/features/AddFriendDialog';
import { FriendRequestsDialog } from '@/components/features/FriendRequestsDialog';
import { CreateGroupDialog } from '@/components/features/CreateGroupDialog';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { UserProfileDialog } from '@/components/features/UserProfileDialog';

import { ProfileSettingsDialog } from '@/components/features/ProfileSettingsDialog';
import { Settings } from 'lucide-react';
import '@/lib/i18n'; // Init i18n
import { useTranslation } from 'react-i18next';

interface Conversation {
  id: string;
  name?: string;
  isGroup: boolean;
  participantIds: string[];
  participants?: IUser[];
  lastMessage?: {
    content?: string;
    createdAt: Date;
  };
}

export function SidebarLeft() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const { setActiveConversationId, activeConversationId } = useChatStore();
  
  const [friends, setFriends] = useState<IUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<IUser | null>(null);

  useEffect(() => {
    if (user?.id) {
       const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
       
       const fetchData = () => {
         // Fetch friends
         fetch(`${apiUrl}/social/friends/${user.id}`)
           .then(res => res.json())
           .then(data => {
              if (Array.isArray(data)) setFriends(data);
           })
           .catch(err => console.error(err));
           
         // Fetch conversations
         fetch(`${apiUrl}/social/conversations/${user.id}`)
           .then(res => res.json())
           .then(data => {
              if (Array.isArray(data)) setConversations(data);
           })
           .catch(err => console.error(err));
       };

       fetchData();

       // Listen for new group events
       const handleRefresh = () => {
         console.log('Refreshing conversations...');
         fetchData();
       };

       // Listen for user status changes
       const handleStatusChange = (event: any) => {
         const { userId, status } = event.detail;
         setFriends(prevFriends => 
           prevFriends.map(friend => 
             friend.id === userId ? { ...friend, status } : friend
           )
         );
       };

       window.addEventListener('refreshConversations', handleRefresh);
       window.addEventListener('userStatusChanged', handleStatusChange);

       return () => {
         window.removeEventListener('refreshConversations', handleRefresh);
         window.removeEventListener('userStatusChanged', handleStatusChange);
       };
    }
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleFriendClick = async (friendId: string) => {
      if (!user?.id) return;
      
      try {
         const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
         const res = await fetch(`${apiUrl}/social/conversation/with`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ userId: user.id, friendId }),
         });
         
         if (res.ok) {
           const conversation = await res.json();
           setActiveConversationId(conversation.id);
         } else {
           console.error('Failed to get/create conversation');
         }
      } catch (e) {
          console.error(e);
      }
  };

  const groupChats = conversations.filter(c => c.isGroup);
  const directChats = conversations.filter(c => !c.isGroup);

  return (
    <div className="w-80 border-r bg-background flex flex-col hidden md:flex h-full">
      {/* Header with Search */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-bold text-xl bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Salala
          </h1>
          <div className="flex items-center gap-2">
            <FriendRequestsDialog>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
            </FriendRequestsDialog>
            <ThemeToggle />
          </div>
        </div>
        
        <div className="flex gap-2">
          <AddFriendDialog>
            <Button variant="secondary" className="flex-1 justify-start" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('common.add_friend')}
            </Button>
          </AddFriendDialog>
          
          <CreateGroupDialog>
            <Button variant="secondary" className="flex-1 justify-start" size="sm">
              <Users className="h-4 w-4 mr-2" />
              {t('common.create_group')}
            </Button>
          </CreateGroupDialog>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          
          {/* Groups Section */}
          <div className="space-y-1">
             <div className="px-3 py-2 text-xs font-semibold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>{t('common.groups')}</span>
                <span className="bg-muted px-2 py-0.5 rounded-full text-[10px]">{groupChats.length}</span>
             </div>
             {groupChats.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  activeConversationId === conv.id
                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                    : 'hover:bg-accent/50'
                }`}
              >
                <div className="relative">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      <Users className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{conv.name || 'Nhóm chat'}</span>
                    {(conv as any).unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center px-1.5">
                        {(conv as any).unreadCount > 99 ? '99+' : (conv as any).unreadCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.participantIds.length} {t('common.members')}
                  </p>
                </div>
              </div>
            ))}
            {groupChats.length === 0 && (
               <div className="text-center text-xs text-muted-foreground py-4 italic opacity-70">
                {t('common.no_groups')}
              </div>
            )}
          </div>

          <Separator />
  
          {/* Friends Section */}
          <div className="space-y-1">
             <div className="px-3 py-2 text-xs font-semibold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>{t('common.friends')}</span>
                <span className="bg-muted px-2 py-0.5 rounded-full text-[10px]">{friends.length}</span>
             </div>
             {friends.map((friend) => {
              const friendConv = conversations.find(c => 
                !c.isGroup && c.participantIds.includes(friend.id)
              );
              
              return (
                <div
                  key={friend.id}
                  onClick={() => handleFriendClick(friend.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    friendConv && activeConversationId === friendConv.id
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <div className="relative cursor-pointer" onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProfileUser(friend);
                  }}>
                    <Avatar className="h-11 w-11 hover:opacity-80 transition-opacity">
                      <AvatarImage src={friend.avatar} />
                      <AvatarFallback>
                        {friend.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {friend.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => handleFriendClick(friend.id)}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{friend.username}</span>
                      {friendConv && (friendConv as any).unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center px-1.5">
                          {(friendConv as any).unreadCount > 99 ? '99+' : (friendConv as any).unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {friend.status === 'online' ? t('common.online') : t('common.offline')}
                    </p>
                  </div>
                </div>
              );
            })}
            {friends.length === 0 && (
               <div className="text-center text-xs text-muted-foreground py-4 italic opacity-70">
                {t('common.no_friends')}
              </div>
            )}
          </div>
          
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t mt-auto">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => user && setSelectedProfileUser(user as any)}>
            <AvatarImage src={user?.avatar || ''} />
            <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title={t('common.settings')}>
            <Settings className="h-4 w-4" />
          </Button>
           <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => i18n.changeLanguage(i18n.language.startsWith('en') ? 'vi' : 'en')}
            title="Switch Language"
            className="font-bold text-xs"
          >
            {i18n.language.startsWith('en') ? 'EN' : 'VN'}
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <CreateGroupDialog 
        open={showCreateGroup} 
        onOpenChange={setShowCreateGroup}
        friends={friends}
        currentUserId={user?.id || ''}
      />

      <UserProfileDialog 
        user={selectedProfileUser} 
        open={!!selectedProfileUser} 
        onOpenChange={(open) => !open && setSelectedProfileUser(null)} 
      />
      
      <ProfileSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        currentUser={user as any}
      />
    </div>
  );
}
