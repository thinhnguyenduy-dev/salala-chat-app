"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, X } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';

interface Friend {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

export function CreateGroupDialog({ 
  children, 
  initialSelectedIds = [] 
}: { 
  children: React.ReactNode;
  initialSelectedIds?: string[];
}) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set(initialSelectedIds));
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchFriends = async () => {
    if (!user?.id) return;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/social/friends/${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setFriends(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchFriends();
      setSelectedFriends(new Set());
      setGroupName('');
    }
  };

  const toggleFriend = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleCreateGroup = async () => {
    if (!user?.id || !groupName.trim() || selectedFriends.size < 2) {
      toast.warning(t('toast.group_validation'));
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/social/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          creatorId: user.id,
          participantIds: Array.from(selectedFriends),
        }),
      });

      if (res.ok) {
        setOpen(false);
        // Optionally refresh conversations list
        window.location.reload(); // Simple refresh for now
      } else {
        toast.error(t('toast.group_create_fail'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('toast.group_create_fail'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialog.create_group_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">{t('dialog.group_name')}</label>
            <Input
              placeholder={t('dialog.group_name_placeholder')}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('dialog.select_members')} ({selectedFriends.size})
            </label>
            <ScrollArea className="h-64 border rounded-lg p-2">
              {friends.length > 0 ? (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => toggleFriend(friend.id)}
                    >
                      <Checkbox
                        checked={selectedFriends.has(friend.id)}
                        onCheckedChange={() => toggleFriend(friend.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.avatar} />
                        <AvatarFallback>
                          {friend.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{friend.username}</div>
                        <div className="text-xs text-muted-foreground">{friend.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  {t('dialog.no_friends_found')}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={loading || !groupName.trim() || selectedFriends.size < 2}
            >
              <Users className="h-4 w-4 mr-2" />
              {t('common.create_group')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
