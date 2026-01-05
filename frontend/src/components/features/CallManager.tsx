'use client';

import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useCallStore } from '@/store/useCallStore';
import { ActiveCallModal } from './ActiveCallModal';
import { IncomingCallDialog } from './IncomingCallDialog';
import { toast } from 'sonner';

export function CallManager() {
  const { socket } = useSocket(); // Ensure socket connection is active
  const { setIncomingCall, setIncomingOffer, setCallStatus, endCall, isInCall } = useCallStore();

  useEffect(() => {
    // These listeners are global and need to run even if not in a call
    // Logic for handling socket events is in useSocket, which dispatches window events.
    // CallManager listens to these window events to update the global store.

    const onIncomingCall = (e: Event) => {
      const data = (e as CustomEvent).detail;
      
      const currentState = useCallStore.getState();
      if (currentState.isInCall) {
          return;
      }
      
      setIncomingCall(
        data.callerId,
        data.callerName,
        data.callerAvatar,
        data.conversationId,
        data.hasVideo
      );
    };

    const onCallOffer = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setIncomingOffer(data.offer);
    };

    const onIceCandidate = (e: Event) => {
      const data = (e as CustomEvent).detail;
      useCallStore.getState().addIceCandidateToQueue(data.candidate);
    };
    
    const onCallCancelled = () => {
        toast.info('Call cancelled');
        useCallStore.getState().resetCallState();
    };

    const onCallRejected = () => {
        toast.info('Call rejected');
        useCallStore.getState().resetCallState();
    };

    window.addEventListener('call:incoming', onIncomingCall);
    window.addEventListener('call:offer', onCallOffer);
    window.addEventListener('call:ice-candidate', onIceCandidate);
    window.addEventListener('call:cancelled', onCallCancelled);
    // call:rejected handled in component usually, but good to have global reset safety
    window.addEventListener('call:rejected', onCallRejected);

    return () => {
      window.removeEventListener('call:incoming', onIncomingCall);
      window.removeEventListener('call:offer', onCallOffer);
      window.removeEventListener('call:ice-candidate', onIceCandidate);
      window.removeEventListener('call:cancelled', onCallCancelled);
      window.removeEventListener('call:rejected', onCallRejected);
    };
  }, [setIncomingCall, setIncomingOffer]);

  return (
    <>
      <IncomingCallDialog />
      <ActiveCallModal />
    </>
  );
}
