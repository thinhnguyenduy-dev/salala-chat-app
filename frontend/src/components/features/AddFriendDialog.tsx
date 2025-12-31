"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserPlus, Check } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserResult {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

export function AddFriendDialog({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Debounced search could be better, but simple handler for MVP
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/social/search?q=${encodeURIComponent(query)}&userId=${user?.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/social/friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: user.id, receiverId }),
      });
      
      if (res.ok) {
        setSentRequests(prev => new Set(prev).add(receiverId));
      } else {
        toast.error("Failed to send request. Maybe already sent?");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a Friend</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSearch} className="flex gap-2">
           <Input 
             placeholder="Search by username or email..." 
             value={query}
             onChange={(e) => setQuery(e.target.value)}
           />
           <Button type="submit" size="icon" disabled={loading}>
             <Search className="h-4 w-4" />
           </Button>
        </form>

        <div className="mt-4">
           {results.length > 0 ? (
             <ScrollArea className="h-64">
               <div className="space-y-2">
                 {results.map(u => (
                   <div key={u.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div className="flex items-center gap-3">
                         <Avatar>
                            <AvatarImage src={u.avatar} />
                            <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                         </Avatar>
                         <div className="text-sm">
                            <div className="font-medium">{u.username}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                         </div>
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant={sentRequests.has(u.id) ? "secondary" : "default"}
                        onClick={() => !sentRequests.has(u.id) && sendRequest(u.id)}
                        disabled={sentRequests.has(u.id)}
                      >
                         {sentRequests.has(u.id) ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      </Button>
                   </div>
                 ))}
               </div>
             </ScrollArea>
           ) : (
             <div className="text-center text-sm text-muted-foreground py-8">
               {query ? 'No users found.' : 'Search for users to add them as friends.'}
             </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
