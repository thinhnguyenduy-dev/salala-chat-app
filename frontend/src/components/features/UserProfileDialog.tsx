import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, Phone, Info, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from '@/lib/i18n';
import { IUser } from "@repo/shared";

interface UserProfileDialogProps {
  user: IUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ user, open, onOpenChange }: UserProfileDialogProps) {
  const { t } = useTranslation();
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Thông tin người dùng</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-6 py-6">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
              <AvatarImage src={user.avatar} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-secondary text-white text-3xl font-bold">
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-background ${
                user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>

          {/* Name & Status */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">{user.displayName || user.username}</h2>
            {user.displayName && <p className="text-sm text-muted-foreground">@{user.username}</p>}
            <Badge variant={user.status === 'online' ? 'default' : 'secondary'} className="px-3">
              {user.status === 'online' ? t('common.online') : t('common.offline')}
            </Badge>
          </div>

          {/* Details */}
          <div className="w-full space-y-4 px-4">
             {/* Email */}
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 bg-background rounded-full">
                 <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('profile.email')}</p>
                <p className="font-medium truncate">{user.email}</p>
              </div>
            </div>

            {/* Phone (New) */}
            {user.phoneNumber && (
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-background rounded-full">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('profile.phone')}</p>
                    <p className="font-medium truncate">{user.phoneNumber}</p>
                </div>
                </div>
            )}

            {/* Date of Birth (New) */}
            {user.dateOfBirth && (
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-background rounded-full">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('profile.dob')}</p>
                    <p className="font-medium text-sm">
                        {new Date(user.dateOfBirth).toLocaleDateString(i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US', {
                             year: 'numeric',
                             month: 'long', 
                             day: 'numeric'
                        })}
                    </p>
                </div>
                </div>
            )}


            {/* Bio (New) */}
            {user.bio && (
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-background rounded-full">
                    <Info className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('profile.bio')}</p>
                    <p className="font-medium text-sm whitespace-pre-wrap">{user.bio}</p>
                </div>
                </div>
            )}

            {/* Member Since */}
            {/* Member Since */}
            {user.createdAt && (
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-background rounded-full">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('profile.joined')}</p>
                    <p className="font-medium">
                        {new Date(user.createdAt).toLocaleDateString(i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                </div>
                </div>
            )}
            
             {/* ID (Optional debug info) */}
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
               <div className="p-2 bg-background rounded-full">
                 <UserIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">ID</p>
                <p className="text-xs font-mono text-muted-foreground truncate">{user.id}</p>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
