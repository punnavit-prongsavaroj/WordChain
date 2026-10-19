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
  title?: string;
  wordCount?: number;

  // 1. ทักษะการออกเสียง (Pronunciation / Speech Fluency)
  speechAttempts?: number;
  speechSuccesses?: number;
  firstPassCount?: number;
  speechTurns?: number;

  // 2. ทักษะการจำคำศัพท์ (Vocabulary Recall & Depth)
  maxWordsInMatch?: number;
  totalMatchWords?: number;

  // 3. ทักษะการเชื่อมโยงภาษาไทย (Semantic Association)
  challengesFaced?: number;
  challengesWon?: number;
  totalAiScore?: number;
  aiJudgedCount?: number;
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

export const recordSpeechTelemetry = async (
  uid: string,
  data: {
    attemptSuccess: boolean;
    isFirstAttempt?: boolean;
    turnCompleted?: boolean;
  }
) => {
  try {
    const userRef = doc(db, 'users', uid);
    const updates: any = {
      speechAttempts: increment(1),
      ...(data.attemptSuccess ? { speechSuccesses: increment(1) } : {}),
      ...(data.isFirstAttempt ? { firstPassCount: increment(1) } : {}),
      ...(data.turnCompleted ? { speechTurns: increment(1) } : {})
    };
    await updateDoc(userRef, updates).catch(async (e: any) => {
      if (e.code === 'not-found') {
        await setDoc(userRef, {
          uid,
          speechAttempts: 1,
          speechSuccesses: data.attemptSuccess ? 1 : 0,
          firstPassCount: data.isFirstAttempt ? 1 : 0,
          speechTurns: data.turnCompleted ? 1 : 0
        }, { merge: true });
      }
    });
  } catch (err) {
    console.error('Error recording speech telemetry:', err);
  }
};

export const recordChallengeTelemetry = async (
  speakerUid: string,
  passed: boolean,
  aiScore?: number
) => {
  try {
    const userRef = doc(db, 'users', speakerUid);
    const updates: any = {
      challengesFaced: increment(1),
      ...(passed ? { challengesWon: increment(1) } : {}),
      ...(typeof aiScore === 'number' ? {
        totalAiScore: increment(aiScore),
        aiJudgedCount: increment(1)
      } : {})
    };
    await updateDoc(userRef, updates).catch(async (e: any) => {
      if (e.code === 'not-found') {
        await setDoc(userRef, {
          uid: speakerUid,
          challengesFaced: 1,
          challengesWon: passed ? 1 : 0,
          totalAiScore: aiScore || 0,
          aiJudgedCount: typeof aiScore === 'number' ? 1 : 0
        }, { merge: true });
      }
    });
  } catch (err) {
    console.error('Error recording challenge telemetry:', err);
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
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() || {};
      const wordsInMatch = player.score || 0;
      const curMax = userData.maxWordsInMatch || 0;
      const newMax = Math.max(curMax, wordsInMatch);

      await updateDoc(userRef, {
        gamesPlayed: increment(1),
        totalMatchWords: increment(wordsInMatch),
        maxWordsInMatch: newMax,
        ...(isWinner ? { wins: increment(1) } : {})
      }).catch(async (e: any) => {
        if (e.code === 'not-found') {
          await setDoc(userRef, {
            uid: player.uid,
            name: player.name,
            gamesPlayed: 1,
            wins: isWinner ? 1 : 0,
            totalMatchWords: wordsInMatch,
            maxWordsInMatch: wordsInMatch
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

export const getGlobalLeaderboard = async (): Promise<UserProfile[]> => {
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
        gamesPlayed: data.gamesPlayed || 0,
        title: data.title || 'ผู้ฝึกต่อคำ',
        wordCount: data.wordCount || 0,
        speechAttempts: data.speechAttempts || 0,
        speechSuccesses: data.speechSuccesses || 0,
        firstPassCount: data.firstPassCount || 0,
        speechTurns: data.speechTurns || 0,
        maxWordsInMatch: data.maxWordsInMatch || 0,
        totalMatchWords: data.totalMatchWords || 0,
        challengesFaced: data.challengesFaced || 0,
        challengesWon: data.challengesWon || 0,
        totalAiScore: data.totalAiScore || 0,
        aiJudgedCount: data.aiJudgedCount || 0
      });
    });

    return users;
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    return [];
  }
};
