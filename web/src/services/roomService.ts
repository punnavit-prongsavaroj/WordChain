import { collection, doc, setDoc, getDocs, query, where, onSnapshot, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useGameStore, type Player } from '../store/gameStore';
import { getUserProfile } from './userService';

const ROOMS_COLLECTION = 'rooms';

export const createRoom = async (hostUid: string, hostName: string, photoURL?: string | null) => {
  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  const roomRef = doc(collection(db, ROOMS_COLLECTION));
  const roomId = roomRef.id;

  const userProfile = await getUserProfile(hostUid);

  await setDoc(roomRef, {
    code,
    hostUid,
    status: 'lobby',
    createdAt: serverTimestamp(),
    usedSyllables: [],
    hasRecordedStats: false
  });

  // Add host as first player
  await setDoc(doc(db, `${ROOMS_COLLECTION}/${roomId}/players`, hostUid), {
    name: hostName,
    photoURL: photoURL || userProfile?.photoURL || null,
    alive: true,
    joinedAt: Date.now(),
    order: 0,
    wins: userProfile?.wins || 0,
    gamesPlayed: userProfile?.gamesPlayed || 0,
    score: 0
  });

  localStorage.setItem('wordChainRoomId', roomId);
  localStorage.setItem('wordChainRoomCode', code);

  return { roomId, code };
};

export const joinRoomByCode = async (code: string, uid: string, name: string, photoURL?: string | null) => {
  const q = query(collection(db, ROOMS_COLLECTION), where("code", "==", code));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error("ไม่พบห้องนี้");
  }

  const roomDoc = snapshot.docs[0];
  const roomId = roomDoc.id;
  const roomData = roomDoc.data();

  const isSpectator = roomData.status !== 'lobby';

  // Get current players to determine order
  const playersSnapshot = await getDocs(collection(db, `${ROOMS_COLLECTION}/${roomId}/players`));
  const order = playersSnapshot.size;

  const userProfile = await getUserProfile(uid);

  await setDoc(doc(db, `${ROOMS_COLLECTION}/${roomId}/players`, uid), {
    name,
    photoURL: photoURL || userProfile?.photoURL || null,
    alive: !isSpectator,
    isSpectator,
    joinedAt: Date.now(),
    order,
    wins: userProfile?.wins || 0,
    gamesPlayed: userProfile?.gamesPlayed || 0,
    score: 0
  });

  localStorage.setItem('wordChainRoomId', roomId);
  localStorage.setItem('wordChainRoomCode', code);

  return roomId;
};

let unsubscribeRoom: (() => void) | null = null;
let unsubscribePlayers: (() => void) | null = null;

export const subscribeToRoom = (roomId: string) => {
  // Cleanup previous subscriptions
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribePlayers) unsubscribePlayers();

  unsubscribeRoom = onSnapshot(doc(db, ROOMS_COLLECTION, roomId), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      useGameStore.getState().setRoomData({
        roomId,
        code: data.code,
        hostUid: data.hostUid,
        status: data.status,
        usedSyllables: data.usedSyllables || [],
        words: data.words || [],
        challenge: data.challenge || null,
        turnUid: data.turnUid || null,
        turnEndTime: data.turnEndTime || null
      });
    }
  });

  unsubscribePlayers = onSnapshot(collection(db, `${ROOMS_COLLECTION}/${roomId}/players`), (snapshot) => {
    const players: Record<string, Player> = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      players[doc.id] = { 
        uid: doc.id, 
        wins: data.wins || 0,
        gamesPlayed: data.gamesPlayed || 0,
        score: data.score || 0,
        ...data 
      } as Player;
    });
    useGameStore.getState().setRoomData({ players });
  });
};

export const leaveRoom = async () => {
  const state = useGameStore.getState();
  const { roomId, myUid, status, players } = state;

  if (roomId && myUid) {
     const isLastPlayer = Object.keys(players).length <= 1;

     if (isLastPlayer) {
        // Delete the room if we are the last one leaving
        try {
           await deleteDoc(doc(db, `${ROOMS_COLLECTION}/${roomId}/players`, myUid));
           await deleteDoc(doc(db, ROOMS_COLLECTION, roomId));
        } catch(e) { console.error(e); }
     } else {
        if (status === 'lobby') {
           // Remove from lobby
           try {
              await deleteDoc(doc(db, `${ROOMS_COLLECTION}/${roomId}/players`, myUid));
              // Note: If host leaves, we could re-assign host, but for simplicity we'll just remove them.
           } catch(e) { console.error(e); }
        } else {
           // Surrender/Die in game
           try {
              await updateDoc(doc(db, `${ROOMS_COLLECTION}/${roomId}/players`, myUid), { alive: false });
           } catch(e) { console.error(e); }
        }
     }
  }

  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribePlayers) unsubscribePlayers();
  
  localStorage.removeItem('wordChainRoomId');
  localStorage.removeItem('wordChainRoomCode');
  
  state.reset();
};
