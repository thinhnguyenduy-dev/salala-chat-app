'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallStore } from '@/store/useCallStore';
import { useSocket } from '@/hooks/useSocket';

export function IncomingCallDialog() {
  const { 
    isIncoming, 
    callStatus, 
    peerName, 
    peerAvatar, 
    callType, 
    setCallStatus, 
    resetCallState,
    peerId 
  } = useCallStore();
  
  const { rejectCall, socket } = useSocket();
  const [audio] = useState(typeof Audio !== 'undefined' ? new Audio('/sounds/ringtone.mp3') : null);

  // Play/stop ringtone
  useEffect(() => {
    if (isIncoming && callStatus === 'ringing' && audio) {
      audio.loop = true;
      audio.play().catch(e => console.log('Audio autoplay failed', e));
    } else if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    
    return () => {
      audio?.pause();
      if (audio) audio.currentTime = 0;
    };
  }, [isIncoming, callStatus, audio]);

  const handleAccept = () => {
    setCallStatus('connecting');
  };

  const handleReject = () => {
    if (peerId && rejectCall) {
      rejectCall(peerId);
    }
    resetCallState();
  };

  const showDialog = isIncoming && callStatus === 'ringing';

  if (!showDialog) return null;

  return (
    <Dialog open={showDialog} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogTitle className="sr-only">Incoming Call</DialogTitle>
        <div className="flex flex-col items-center justify-center p-6 space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
              <AvatarImage src={peerAvatar || undefined} />
              <AvatarFallback className="text-2xl">{peerName?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-semibold">{peerName}</h3>
            <p className="text-muted-foreground flex items-center gap-2">
              {callType === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              {callType === 'video' ? 'Incoming Video Call...' : 'Incoming Voice Call...'}
            </p>
          </div>

          <div className="flex items-center gap-8 w-full justify-center">
            <Button 
              size="lg" 
              variant="destructive" 
              className="rounded-full h-14 w-14 p-0 shadow-lg"
              onClick={handleReject}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            
            <Button 
              size="lg" 
              className="rounded-full h-14 w-14 p-0 bg-green-500 hover:bg-green-600 shadow-lg animate-pulse"
              onClick={handleAccept}
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
