import { doc, getDoc, setDoc, updateDoc, increment, getDocs, collection } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';
import { useGameStore, type Player } from '../store/gameStore';

export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  wins?: number;
  gamesPlayed?: number;
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
  return null;
};

export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>) => {
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      ...profile,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving user profile to Firestore:', error);
  }
};

export const updateCurrentProfile = async (name: string, photoURL?: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  // 1. Update Firebase Auth Profile
  await updateProfile(currentUser, {
    displayName: name,
    photoURL: photoURL || currentUser.photoURL || ''
  });

  // 2. Save to Firestore users collection
  await saveUserProfile(currentUser.uid, {
    name,
    photoURL: photoURL || '',
    email: currentUser.email || ''
  });

  // 3. Update Zustand Store
  useGameStore.getState().setMyName(name);
  if (photoURL) {
    useGameStore.getState().setMyPhotoURL(photoURL);
  }
};

export const recordGameFinished = async (
  roomId: string,
  players: Record<string, Player>,
  winnerUid?: string
) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    if (roomSnap.data()?.hasRecordedStats) {
      return;
    }

    await updateDoc(roomRef, { hasRecordedStats: true });

    const playerList = Object.values(players).filter(p => !p.isSpectator);
    for (const player of playerList) {
      const isWinner = player.uid === winnerUid;
      const userRef = doc(db, 'users', player.uid);

      await updateDoc(userRef, {
        gamesPlayed: increment(1),
        ...(isWinner ? { wins: increment(1) } : {})
      }).catch(async (e: any) => {
        if (e.code === 'not-found') {
          await setDoc(userRef, {
            uid: player.uid,
            name: player.name,
            gamesPlayed: 1,
            wins: isWinner ? 1 : 0
          }, { merge: true });
        }
      });

      const roomPlayerRef = doc(db, `rooms/${roomId}/players`, player.uid);
      await updateDoc(roomPlayerRef, {
        gamesPlayed: (player.gamesPlayed || 0) + 1,
        ...(isWinner ? { wins: (player.wins || 0) + 1 } : {})
      }).catch(() => {});
    }

    const myUid = useGameStore.getState().myUid;
    if (myUid && players[myUid] && !players[myUid].isSpectator) {
      const curWins = useGameStore.getState().myWins;
      const curGames = useGameStore.getState().myGamesPlayed;
      useGameStore.getState().setMyStats(
        curWins + (myUid === winnerUid ? 1 : 0),
        curGames + 1
      );
    }
  } catch (err) {
    console.error('Error recording game finished stats:', err);
  }
};

export const getGlobalLeaderboard = async (limitCount = 20): Promise<UserProfile[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        uid: docSnap.id,
        name: data.name || 'ผู้เล่น',
        email: data.email || '',
        photoURL: data.photoURL || '',
        wins: data.wins || 0,
        gamesPlayed: data.gamesPlayed || 0
      });
    });

    // Sort by wins desc, then winRate desc
    users.sort((a, b) => {
      const winsA = a.wins || 0;
      const winsB = b.wins || 0;
      if (winsB !== winsA) return winsB - winsA;
      const rateA = a.gamesPlayed ? winsA / a.gamesPlayed : 0;
      const rateB = b.gamesPlayed ? winsB / b.gamesPlayed : 0;
      return rateB - rateA;
    });

    return users.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    return [];
  }
};
