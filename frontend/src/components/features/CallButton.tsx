import { Button } from '@/components/ui/button';
import { Phone, Video } from 'lucide-react';
import { useCallStore } from '@/store/useCallStore';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface CallButtonProps {
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
}

export function CallButton({ conversationId, otherUserId, otherUserName, otherUserAvatar }: CallButtonProps) {
  const { initiateCall } = useSocket();
  const { setOutgoingCall, isInCall } = useCallStore();
  const { user } = useAuthStore();

  const handleCall = (video: boolean) => {
    if (isInCall) {
      // Force reset if stuck, or just warn?
      // For now, let's assume if they click it again, they want to start a new call or reset.
      // But better UX is to not allow if genuinely in call.
      // Given the bug report, forcing reset is safest for now.
      console.warn('Overriding existing call state');
      useCallStore.getState().resetCallState();
    }

    // Update store state
    setOutgoingCall(otherUserId, otherUserName, otherUserAvatar, conversationId, video);
    
    // Initiate call via socket
    if (initiateCall) {
      initiateCall(conversationId, otherUserId, video);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleCall(false)}
        title="Voice Call"
      >
        <Phone className="h-5 w-5" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleCall(true)}
        title="Video Call"
      >
        <Video className="h-5 w-5" />
      </Button>
    </div>
  );
}
