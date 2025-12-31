import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IUser } from "@repo/shared";
import { useAuthStore } from "@/store/useAuthStore";
import { uploadFile } from "@/lib/upload";
import { Loader2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: IUser | null;
}

export function ProfileSettingsDialog({ open, onOpenChange, currentUser }: ProfileSettingsDialogProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState("");
  const [avatar, setAvatar] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, login } = useAuthStore(); // We might need to handle user update

  useEffect(() => {
    if (currentUser) {
      setPhone(currentUser.phoneNumber || "");
      setBio(currentUser.bio || "");
      setDisplayName(currentUser.displayName || "");
      setAvatar(currentUser.avatar || "");
      
      if (currentUser.dateOfBirth) {
         // Format date to YYYY-MM-DD for input type="date"
         const date = new Date(currentUser.dateOfBirth);
         const year = date.getFullYear();
         const month = String(date.getMonth() + 1).padStart(2, '0');
         const day = String(date.getDate()).padStart(2, '0');
         setDob(`${year}-${month}-${day}`);
      } else {
          setDob("");
      }
    }
  }, [currentUser, open]);

  const handleAvatarClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const url = await uploadFile(file);
          setAvatar(url);
      } catch (error) {
          console.error("Avatar upload failed:", error);
          console.error("Avatar upload failed:", error);
          toast.error(t('common.upload_failed'));
      } finally {
          setIsUploading(false);
      }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
       const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
       const res = await fetch(`${apiUrl}/social/profile`, {
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
               userId: currentUser.id,
               phoneNumber: phone,
               bio: bio,
               displayName: displayName,
               dateOfBirth: dob,
               avatar: avatar
           })
       });

       if (!res.ok) throw new Error('Failed to update profile');
       
       const updatedUser = await res.json();
       
       // Update local auth store immediatey
       // We re-use login function which sets user and token. 
       // We can grab current token from store or just assume we don't need to change it if we had a dedicated setUser.
       // Since useAuthStore has login(token, user), we need the token.
       // Let's assume we can get it from store (it's persisted).
       const currentToken = useAuthStore.getState().token;
       if (currentToken) {
           useAuthStore.getState().login(currentToken, updatedUser);
       }

       onOpenChange(false);
       onOpenChange(false);
       toast.success(t('common.success'));
       // We don't necessarily need reload if we updated the store, SidebarLeft should react to store user change.
       // But to be safe and ensure all other components (like chat header) update, we can reload or just trust React.
       // Let's trust React first. SidebarLeft listens to `user` from store.
       
    } catch (e) {
        console.error(e);
        console.error(e);
        toast.error(t('profile.update_error'));
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('profile.title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
             <div className="relative cursor-pointer group" onClick={handleAvatarClick}>
                <Avatar className="h-24 w-24 border-2">
                    <AvatarImage src={avatar} />
                    <AvatarFallback className="text-2xl">{currentUser?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Upload className="h-6 w-6 text-white" />}
                </div>
             </div>
             <p className="text-xs text-muted-foreground">{t('profile.change_avatar_hint')}</p>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="grid gap-4">
            {/* Display Name */}
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="displayName" className="text-right">{t('profile.display_name')}</Label>
                <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="col-span-3"
                placeholder={currentUser?.username}
                />
            </div>

            {/* Phone */}
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">{t('profile.phone')}</Label>
                <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="col-span-3"
                placeholder="+84..."
                />
            </div>

            {/* Date of Birth */}
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dob" className="text-right">{t('profile.dob')}</Label>
                <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="col-span-3"
                />
            </div>

            {/* Bio */}
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bio" className="text-right">{t('profile.bio')}</Label>
                <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="col-span-3"
                placeholder={t('profile.bio_placeholder')}
                rows={3}
                />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave} disabled={isLoading || isUploading}>
            {isLoading ? t('profile.saving') : t('profile.save_changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
