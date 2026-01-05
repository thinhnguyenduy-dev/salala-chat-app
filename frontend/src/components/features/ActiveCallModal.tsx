'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import { useCallStore } from '@/store/useCallStore';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ActiveCallModal() {
  const { 
    isInCall, 
    callStatus, 
    peerName, 
    peerAvatar, 
    callType, 
    isIncoming,
    incomingOffer,
    endCall: endCallAction,
    resetCallState,
    setCallStatus
  } = useCallStore();
  
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const [minimized, setMinimized] = useState(false);
  const [duration, setDuration] = useState(0);
  
  // Use a ref to track if we've already answered to prevent double answering
  const hasAnsweredRef = useRef(false);
  
  const { endCall: socketEndCall } = useSocket();

  const handleCallEnd = () => {
    resetCallState();
    setMinimized(false);
    setDuration(0);
    hasAnsweredRef.current = false;
  };

  const {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    startCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    endCall: webrtcEndCall,
  } = useWebRTC({
    socket,
    userId: user?.id || '',
    onCallEnd: handleCallEnd
  });
  
  const handleManualEndCall = () => {
      // Notify peer
      if (useCallStore.getState().peerId) {
          socketEndCall(useCallStore.getState().peerId!);
      }
      // Local cleanup
      webrtcEndCall();
  };

  // Local video ref
  const localVideoRef = useRef<HTMLVideoElement>(null);
  // Remote video ref
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Set video sources when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle call logic
  useEffect(() => {
    if (!isInCall) return;

    // Listen for WebRTC events from window (dispatched by useSocket)
    // Note: call:offer is handled via store (incomingOffer) to avoid duplicates
    
    const onCallAnswer = (e: Event) => {
      const data = (e as CustomEvent).detail;
      handleAnswer(data.answer);
    };

    const onIceCandidate = (e: Event) => {
      const data = (e as CustomEvent).detail;
      handleIceCandidate(data.candidate);
    };

    const onCallEnded = () => {
      toast.info('Call ended');
      webrtcEndCall();
    };

    window.addEventListener('call:answer', onCallAnswer);
    window.addEventListener('call:ice-candidate', onIceCandidate);
    window.addEventListener('call:ended', onCallEnded);
    window.addEventListener('call:rejected', onCallEnded);

    return () => {
      window.removeEventListener('call:answer', onCallAnswer);
      window.removeEventListener('call:ice-candidate', onIceCandidate);
      window.removeEventListener('call:ended', onCallEnded);
      window.removeEventListener('call:rejected', onCallEnded);
    };
  }, [isInCall, handleAnswer, handleIceCandidate, webrtcEndCall]);

  // Start call flow & Process Buffered Candidates
  useEffect(() => {
    // CALLEE LOGIC: When status becomes connecting (after accept), and we have offer
    if (isIncoming && callStatus === 'connecting' && !hasAnsweredRef.current && incomingOffer) {
        handleOffer(incomingOffer);
        hasAnsweredRef.current = true;
    } 
    // CALLER LOGIC: When status is ringing or connecting (we started it)
    else if (!isIncoming && !hasAnsweredRef.current && (callStatus === 'ringing' || callStatus === 'connecting')) {
        if (callStatus === 'ringing') {
            setCallStatus('connecting');
        }
        startCall();
        hasAnsweredRef.current = true;
    }

    // Process buffered ICE candidates (for both)
    // Only process if we have started/answered (connection exists)
    if (hasAnsweredRef.current) {
        const queue = useCallStore.getState().iceCandidatesQueue;
        if (queue.length > 0) {
            queue.forEach(candidate => {
                handleIceCandidate(candidate);
            });
            useCallStore.getState().clearIceCandidatesQueue();
        }
    }
  }, [callStatus, isIncoming, incomingOffer, startCall, handleOffer, handleIceCandidate, setCallStatus]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isInCall) return null;
  // Hide modal only if it's an incoming call ringing (show IncomingCallDialog instead).
  // If it's outgoing ringing, we MUST show this modal to initialize WebRTC and show "Calling..."
  if (isIncoming && callStatus === 'ringing') return null;
  if (callStatus === 'idle') return null;

  // Mini view
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-48 h-36 bg-background border rounded-lg shadow-xl overflow-hidden shadow-primary/20 cursor-pointer transition-all hover:scale-105" onClick={() => setMinimized(false)}>
         {callType === 'video' && (remoteStream || localStream) ? (
            <video 
              ref={remoteStream ? remoteVideoRef : localVideoRef}
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
         ) : (
             <div className="flex flex-col items-center justify-center h-full bg-muted">
                 <Avatar className="h-10 w-10 mb-2">
                    <AvatarImage src={peerAvatar || undefined} />
                    <AvatarFallback>{peerName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-xs font-semibold">{peerName}</div>
                <div className="text-[10px] text-green-500">{formatDuration(duration)}</div>
             </div>
         )}
         <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full">
            <Maximize2 className="h-3 w-3 text-white" />
         </div>
      </div>
    );
  }

  // Full view
  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-screen-lg w-full h-[80vh] p-0 bg-black border-0 shadow-2xl overflow-hidden focus:outline-none [&>button]:hidden">
        <DialogTitle className="sr-only">Active Call</DialogTitle>
        <div className="relative w-full h-full flex flex-col">


          {/* Main Video Area */}
          <div className="flex-1 relative bg-zinc-900 flex items-center justify-center overflow-hidden">
            {callType === 'video' && remoteStream ? (
               <video 
               ref={remoteVideoRef}
               autoPlay 
               playsInline 
               className="w-full h-full object-contain"
             />
            ) : callType === 'video' && !remoteStream ? (
                <div className="flex flex-col items-center animate-pulse">
                    <Avatar className="h-24 w-24 mb-4 border-4 border-zinc-700">
                        <AvatarImage src={peerAvatar || undefined} />
                        <AvatarFallback>{peerName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-white text-lg">{callStatus === 'connecting' ? 'Connecting...' : 'Waiting for video...'}</div>
                </div>
            ) : (
                // Audio call UI
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <Avatar className="h-32 w-32 border-4 border-zinc-700 shadow-xl">
                            <AvatarImage src={peerAvatar || undefined} />
                            <AvatarFallback className="text-4xl">{peerName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                         {/* Pulse effect when connected */}
                        {callStatus === 'connected' && (
                            <span className="absolute inset-0 rounded-full animate-ping bg-green-500/20"></span>
                        )}
                    </div>
                    <h2 className="text-white text-2xl font-bold mt-6">{peerName}</h2>
                    <p className="text-zinc-400 mt-2">{callStatus === 'connected' ? formatDuration(duration) : 'Calling...'}</p>
                </div>
            )}

            {/* Local Video (PiP) */}
            {callType === 'video' && (
                <div className="absolute top-4 right-4 w-32 h-48 bg-zinc-800 rounded-lg overflow-hidden shadow-lg border border-zinc-700 z-10 transition-all hover:scale-105">
                     <video 
                        ref={localVideoRef}
                        autoPlay 
                        playsInline 
                        muted
                        className={cn("w-full h-full object-cover", !isVideoEnabled && "opacity-0")}
                      />
                      {!isVideoEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                              <VideoOff className="h-6 w-6 text-zinc-500" />
                          </div>
                      )}
                </div>
            )}
            
            {/* Header Controls */}
            <div className="absolute top-4 left-4 z-20">
               <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setMinimized(true)}>
                   <Minimize2 className="h-6 w-6" />
               </Button>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="h-20 bg-zinc-900/90 backdrop-blur flex items-center justify-center gap-6 pb-4">
             <Button 
                variant={isAudioEnabled ? "secondary" : "destructive"}
                size="icon" 
                className="h-12 w-12 rounded-full"
                onClick={toggleAudio}
             >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
             </Button>
             
             {callType === 'video' && (
                <Button 
                    variant={isVideoEnabled ? "secondary" : "destructive"}
                    size="icon" 
                    className="h-12 w-12 rounded-full"
                    onClick={toggleVideo}
                >
                    {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
             )}

             <Button 
                variant="destructive" 
                size="icon" 
                className="h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
                onClick={handleManualEndCall}
             >
                <PhoneOff className="h-6 w-6" />
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
