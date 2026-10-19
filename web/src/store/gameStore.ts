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
  wins?: number;
  gamesPlayed?: number;
  score?: number;
  title?: string;
  wordCount?: number;
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
  myWins: number;
  myGamesPlayed: number;
  myWordCount: number;
  myTitle: string;
  challenge: any | null; // challenge object
  
  // Actions
  setRoomData: (data: Partial<GameState>) => void;
  setMyUid: (uid: string | null) => void;
  setMyName: (name: string | null) => void;
  setMyPhotoURL: (photoURL: string | null) => void;
  setMyEmail: (email: string | null) => void;
  setMyStats: (wins: number, gamesPlayed: number) => void;
  setMyWordStats: (wordCount: number, title?: string) => void;
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
  myWins: 0,
  myGamesPlayed: 0,
  myWordCount: 0,
  myTitle: 'ผู้ฝึกต่อคำ',
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
  setMyStats: (wins, gamesPlayed) => set({ myWins: wins, myGamesPlayed: gamesPlayed }),
  setMyWordStats: (wordCount, title) => set((state) => ({
    myWordCount: wordCount,
    myTitle: title || state.myTitle
  })),
  reset: () => set({
    roomId: null, code: null, hostUid: null, status: 'lobby',
    players: {}, usedSyllables: [], words: [], turnUid: null, turnEndTime: null, challenge: null
  }),
}));
