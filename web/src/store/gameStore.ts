import { create } from 'zustand';

export type GameStatus = 'lobby' | 'playing' | 'challenge' | 'finished';

export interface Player {
  uid: string;
  name: string;
  photoURL?: string;
  alive: boolean;
  joinedAt: number;
  order: number;
  isSpectator?: boolean;
  peerId?: string;
}

export interface GameState {
  roomId: string | null;
  code: string | null;
  hostUid: string | null;
  status: GameStatus;
  players: Record<string, Player>;
  usedSyllables: string[];
  words: string[]; // history of words
  turnUid: string | null;
  turnEndTime: number | null;
  myUid: string | null;
  myName: string | null;
  myPhotoURL: string | null;
  myEmail: string | null;
  challenge: any | null; // challenge object
  
  // Actions
  setRoomData: (data: Partial<GameState>) => void;
  setMyUid: (uid: string | null) => void;
  setMyName: (name: string | null) => void;
  setMyPhotoURL: (photoURL: string | null) => void;
  setMyEmail: (email: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomId: localStorage.getItem('wordChainRoomId'),
  code: localStorage.getItem('wordChainRoomCode'),
  hostUid: null,
  status: 'lobby',
  players: {},
  usedSyllables: [],
  words: [],
  turnUid: null,
  turnEndTime: null,
  myUid: null,
  myName: localStorage.getItem('wordChainName'),
  myPhotoURL: localStorage.getItem('wordChainPhotoURL'),
  myEmail: null,
  challenge: null,

  setRoomData: (data) => set((state) => ({ ...state, ...data })),
  setMyUid: (uid) => set({ myUid: uid }),
  setMyName: (name) => {
    if (name) localStorage.setItem('wordChainName', name);
    else localStorage.removeItem('wordChainName');
    set({ myName: name });
  },
  setMyPhotoURL: (photoURL) => {
    if (photoURL) localStorage.setItem('wordChainPhotoURL', photoURL);
    else localStorage.removeItem('wordChainPhotoURL');
    set({ myPhotoURL: photoURL });
  },
  setMyEmail: (email) => set({ myEmail: email }),
  reset: () => set({
    roomId: null, code: null, hostUid: null, status: 'lobby',
    players: {}, usedSyllables: [], words: [], turnUid: null, turnEndTime: null, challenge: null
  }),
}));
