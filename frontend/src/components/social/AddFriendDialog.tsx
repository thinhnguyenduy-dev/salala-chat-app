"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Search, Check } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { IUser } from "@repo/shared";

export function AddFriendDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/social/search?q=${encodeURIComponent(query)}&userId=${user?.id}`);
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, user?.id]);

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/social/friend-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: user.id, receiverId }),
      });
      
      if (res.ok) {
        setSentRequests(prev => new Set(prev).add(receiverId));
      }
    } catch (e) {
      console.error("Failed to send request", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
             {loading && <p className="text-center text-sm text-muted-foreground">Searching...</p>}
             {!loading && results.length === 0 && query && (
                <p className="text-center text-sm text-muted-foreground">No users found.</p>
             )}
             {results.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                   <div className="flex items-center gap-3">
                     <Avatar>
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                     </Avatar>
                     <div className="overflow-hidden">
                        <p className="text-sm font-medium">{u.username}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{u.email}</p>
                     </div>
                   </div>
                   <Button 
                     size="sm" 
                     variant={sentRequests.has(u.id) ? "ghost" : "default"}
                     onClick={() => sendRequest(u.id)}
                     disabled={sentRequests.has(u.id)}
                   >
                     {sentRequests.has(u.id) ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                   </Button>
                </div>
             ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
