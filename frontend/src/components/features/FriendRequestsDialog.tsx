"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, X } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface FriendRequest {
  id: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
}

export function FriendRequestsDialog({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchRequests = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/social/friend-requests/${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
       fetchRequests();

       const handleNewRequest = () => {
         fetchRequests();
         toast.info(t('common.new_friend_request') || 'New friend request received');
       };

       window.addEventListener('newFriendRequest', handleNewRequest);
       return () => window.removeEventListener('newFriendRequest', handleNewRequest);
    }
  }, [user?.id]);

  const handleAccept = async (requestId: string) => {
    if (!user) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/social/friend-request/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, userId: user.id }),
      });
      
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
      } else {
        toast.error(t('toast.req_accepted_fail'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      // We need a reject endpoint, for now just remove from UI
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="relative">
          {children}
          {requests.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {requests.length}
            </Badge>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialog.friend_requests_title')}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
           {loading ? (
             <div className="text-center py-8 text-sm text-muted-foreground">
               Đang tải...
             </div>
           ) : requests.length > 0 ? (
             <ScrollArea className="h-96">
               <div className="space-y-3">
                 {requests.map(req => (
                   <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3 flex-1">
                         <Avatar>
                            <AvatarImage src={req.sender.avatar} />
                            <AvatarFallback>{req.sender.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                         </Avatar>
                         <div className="text-sm flex-1">
                            <div className="font-medium">{req.sender.username}</div>
                            <div className="text-xs text-muted-foreground">{req.sender.email}</div>
                         </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleAccept(req.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                           <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleReject(req.id)}
                        >
                           <X className="h-4 w-4" />
                        </Button>
                      </div>
                   </div>
                 ))}
               </div>
             </ScrollArea>
           ) : (
             <div className="text-center text-sm text-muted-foreground py-8">
               Không có lời mời kết bạn nào
             </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
