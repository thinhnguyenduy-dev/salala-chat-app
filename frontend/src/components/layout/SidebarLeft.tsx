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
  const { user, logout } = useAuthStore();
  const { setActiveConversationId, activeConversationId } = useChatStore();
  
  const [friends, setFriends] = useState<IUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<'groups' | 'friends'>('groups');

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
            Moji
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
              Thêm bạn
            </Button>
          </AddFriendDialog>
          
          <CreateGroupDialog>
            <Button variant="secondary" className="flex-1 justify-start" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Tạo nhóm
            </Button>
          </CreateGroupDialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'groups' 
              ? 'text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            NHÓM CHAT
          </div>
          {activeTab === 'groups' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'friends' 
              ? 'text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <UserIcon className="h-4 w-4" />
            BẠN BÈ
          </div>
          {activeTab === 'friends' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.filter(c => c.isGroup).map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleConversationClick(conv.id)}
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
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center px-1.5">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.participantIds.length} thành viên
                  </p>
                </div>
              </div>
            ))}
            {conversations.filter(c => c.isGroup).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Chưa có nhóm chat nào
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
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
                  <div className="relative">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={friend.avatar} />
                      <AvatarFallback>
                        {friend.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {friend.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{friend.username}</span>
                      {friendConv?.unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center px-1.5">
                          {friendConv.unreadCount > 99 ? '99+' : friendConv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {friend.status === 'online' ? 'Đang hoạt động' : 'Không hoạt động'}
                    </p>
                  </div>
                </div>
              );
            })}
            {friends.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Chưa có bạn bè nào
              </div>
            )}
          </div>
        </ScrollArea>
      )}
      {/* User Profile Footer */}
      <div className="p-4 border-t mt-auto">
        <div className="flex items-center justify-between gap-3">
             <div className="flex items-center gap-2 flex-1 overflow-hidden">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      {user?.username?.slice(0,2).toUpperCase() || 'ME'}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium text-sm truncate">{user?.username || 'Guest'}</div>
                  <div className="text-xs text-muted-foreground">Đang hoạt động</div>
                </div>
             </div>
             <Button variant="ghost" size="icon" onClick={handleLogout} title="Đăng xuất">
                 <LogOut className="h-4 w-4" />
             </Button>
        </div>
      </div>
    </div>
  );
}
