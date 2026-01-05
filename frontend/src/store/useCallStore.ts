import { create } from 'zustand';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

interface CallState {
  // Call state
  isInCall: boolean;
  callType: CallType | null;
  peerId: string | null;
  peerName: string | null;
  peerAvatar: string | null;
  conversationId: string | null;
  isIncoming: boolean;
  callStatus: CallStatus;
  incomingOffer: RTCSessionDescriptionInit | null;
  iceCandidatesQueue: RTCIceCandidateInit[];

  // Actions
  setIncomingCall: (
    peerId: string,
    peerName: string,
    peerAvatar: string | null,
    conversationId: string,
    hasVideo: boolean
  ) => void;
  setOutgoingCall: (
    peerId: string,
    peerName: string,
    peerAvatar: string | null,
    conversationId: string,
    hasVideo: boolean
  ) => void;
  setIncomingOffer: (offer: RTCSessionDescriptionInit) => void;
  addIceCandidateToQueue: (candidate: RTCIceCandidateInit) => void;
  clearIceCandidatesQueue: () => void;
  setCallStatus: (status: CallStatus) => void;
  setCallConnected: () => void;
  endCall: () => void;
  resetCallState: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  // Initial state
  isInCall: false,
  callType: null,
  peerId: null,
  peerName: null,
  peerAvatar: null,
  conversationId: null,
  isIncoming: false,
  callStatus: 'idle',
  incomingOffer: null,
  iceCandidatesQueue: [],

  // Actions
  setIncomingCall: (peerId, peerName, peerAvatar, conversationId, hasVideo) =>
    set({
      isInCall: true,
      callType: hasVideo ? 'video' : 'audio',
      peerId,
      peerName,
      peerAvatar,
      conversationId,
      isIncoming: true,
      callStatus: 'ringing',
      incomingOffer: null,
      iceCandidatesQueue: [],
    }),

  setOutgoingCall: (peerId, peerName, peerAvatar, conversationId, hasVideo) =>
    set({
      isInCall: true,
      callType: hasVideo ? 'video' : 'audio',
      peerId,
      peerName,
      peerAvatar,
      conversationId,
      isIncoming: false,
      callStatus: 'ringing',
      incomingOffer: null,
      iceCandidatesQueue: [],
    }),

  setIncomingOffer: (offer) =>
    set({
      incomingOffer: offer,
    }),

  addIceCandidateToQueue: (candidate) =>
    set((state) => ({
      iceCandidatesQueue: [...state.iceCandidatesQueue, candidate],
    })),

  clearIceCandidatesQueue: () =>
    set({
      iceCandidatesQueue: [],
    }),

  setCallStatus: (status) =>
    set({
      callStatus: status,
    }),

  setCallConnected: () =>
    set({
      callStatus: 'connected',
    }),

  endCall: () =>
    set({
      callStatus: 'ended',
    }),

  resetCallState: () =>
    set({
      isInCall: false,
      callType: null,
      peerId: null,
      peerName: null,
      peerAvatar: null,
      conversationId: null,
      isIncoming: false,
      callStatus: 'idle',
      incomingOffer: null,
      iceCandidatesQueue: [],
    }),
}));
