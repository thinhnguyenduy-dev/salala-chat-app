import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useCallStore } from '@/store/useCallStore';
import { toast } from 'sonner';

// STUN server configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

interface UseWebRTCProps {
  socket: Socket | null;
  userId: string;
  onCallEnd?: () => void;
}

export const useWebRTC = ({ socket, userId, onCallEnd }: UseWebRTCProps) => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const { peerId, callType, setCallStatus, setCallConnected } = useCallStore();

  // Internal queue for ICE candidates received before remote description
  const remoteCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const isAnsweringRef = useRef(false); // Prevent duplicate answerCall
  const isProcessingRemoteAnswerRef = useRef(false); // Prevent duplicate handleAnswer

  // Refs for cleanup (to avoid state dependencies changes triggering cleanup)
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Cleanup function - STABLE REFERENCE (No deps)
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up connection');
    
    // Stop all local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Stop all remote stream tracks
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear candidate queue
    remoteCandidatesQueue.current = [];
  }, []);

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
          if (socket) {
            const currentPeerId = useCallStore.getState().peerId;
            if (currentPeerId) {
                socket.emit('call:ice-candidate', {
                  to: currentPeerId,
                  candidate: event.candidate.toJSON(),
                });
            }
          }
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      remoteStreamRef.current = stream;
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        setCallConnected();
        toast.success('Call connected');
      } else if (
        peerConnection.connectionState === 'disconnected' ||
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'closed'
      ) {
        cleanup();
        onCallEnd?.();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [socket, setCallConnected, onCallEnd, cleanup]);

  // Get user media (camera/microphone)
  const getUserMedia = useCallback(async (hasVideo: boolean) => {
    try {
      const constraints = {
        audio: true,
        video: hasVideo ? { width: 1280, height: 720 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error('[WebRTC] Error accessing media devices:', error);
      toast.error('Failed to access camera/microphone');
      throw error;
    }
  }, []);

  // Process queued ICE candidates
  const processQueuedCandidates = useCallback(async () => {
    if (!peerConnectionRef.current || remoteCandidatesQueue.current.length === 0) {
      return;
    }

    console.log(`[WebRTC] Processing ${remoteCandidatesQueue.current.length} queued candidates`);
    
    for (const candidate of remoteCandidatesQueue.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[WebRTC] Error adding queued candidate:', error);
      }
    }
    
    remoteCandidatesQueue.current = [];
  }, []);

  // Start call (create offer)
  const startCall = useCallback(async () => {
    if (!socket || !peerId || !callType) {
      console.error('[WebRTC] Cannot start call: missing socket, peerId, or callType');
      return;
    }

    // Force cleanup old connection
    if (peerConnectionRef.current) {
        cleanup();
    }

    try {
      setCallStatus('connecting');
      
      const stream = await getUserMedia(callType === 'video');
      const peerConnection = createPeerConnection();

      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit('call:offer', {
        to: peerId,
        offer: peerConnection.localDescription,
      });
    } catch (error) {
      console.error('[WebRTC] Error starting call:', error);
      toast.error('Failed to start call');
      cleanup();
      onCallEnd?.();
    }
  }, [socket, peerId, callType, getUserMedia, createPeerConnection, setCallStatus, onCallEnd, cleanup]);

  // Answer call (create answer)
  const answerCall = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!socket || !peerId || !callType) {
      console.error('[WebRTC] Cannot answer call: missing socket, peerId, or callType');
      return;
    }

    // Prevent duplicate/concurrent answerCall executions
    if (isAnsweringRef.current) {
        console.warn('[WebRTC] Already answering a call, ignoring duplicate');
        return;
    }
    isAnsweringRef.current = true;

    try {
      cleanup(); // Close any existing connection

      setCallStatus('connecting');
      
      const stream = await getUserMedia(callType === 'video');
      const peerConnection = createPeerConnection();

      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Set remote description (offer)
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Process any candidates that arrived before we processed the offer
      await processQueuedCandidates();

      // Check state before createAnswer
      if (peerConnection.signalingState !== 'have-remote-offer') {
          console.error('[WebRTC] Wrong state for createAnswer:', peerConnection.signalingState);
          throw new Error('Invalid signaling state for answer');
      }

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('call:answer', {
        to: peerId,
        answer: peerConnection.localDescription,
      });
    } catch (error) {
      console.error('[WebRTC] Error answering call:', error);
      toast.error('Failed to answer call');
      cleanup();
      onCallEnd?.();
    } finally {
      isAnsweringRef.current = false;
    }
  }, [socket, peerId, callType, getUserMedia, createPeerConnection, setCallStatus, onCallEnd, processQueuedCandidates, cleanup]);

  // Handle received offer
  const handleOffer = useCallback(
    (offer: RTCSessionDescriptionInit) => {
      answerCall(offer);
    },
    [answerCall]
  );

  // Handle received answer
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error('[WebRTC] No peer connection to set answer');
      return;
    }

    // Check lock to prevent race conditions
    if (isProcessingRemoteAnswerRef.current) {
        console.warn('[WebRTC] Already processing an answer, ignoring duplicate');
        return;
    }

    // Prevent "stable" state error (Duplicate answer or stale)
    if (peerConnectionRef.current.signalingState === 'stable') {
        console.warn('[WebRTC] Received answer but already in stable state, ignoring');
        return;
    }

    try {
      isProcessingRemoteAnswerRef.current = true;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      await processQueuedCandidates();
    } catch (error) {
      console.error('[WebRTC] Error setting remote answer:', error);
      toast.error('Connection error');
    } finally {
      isProcessingRemoteAnswerRef.current = false;
    }
  }, [processQueuedCandidates]);

  // Handle received ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    // If no peer connection OR no remote description, queue the candidate
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
        remoteCandidatesQueue.current.push(candidate);
        return;
    }

    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // End call
  const endCall = useCallback(() => {
    cleanup();
    onCallEnd?.();
  }, [cleanup, onCallEnd]);

  return {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    startCall,
    answerCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    endCall,
  };
};
