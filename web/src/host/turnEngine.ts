import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useHostLoop() {
  const isHost = useGameStore(state => state.myUid === state.hostUid);
  const roomId = useGameStore(state => state.roomId);
  const status = useGameStore(state => state.status);
  const turnUid = useGameStore(state => state.turnUid);
  const turnEndTime = useGameStore(state => state.turnEndTime);
  const players = useGameStore(state => state.players);

  const isProcessing = useRef(false);
  const currentTurnUidRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const turnStartTimeRef = useRef<number>(Date.now());
  const prevTurnEndTimeRef = useRef<number | null>(null);
  const lastProcessedTurnUid = useRef<string | null>(null);

  // Track when a new turn begins on Host to prevent clock-skew instant kills
  useEffect(() => {
    if (status === 'playing' && turnUid) {
      const isNewTurnUid = turnUid !== currentTurnUidRef.current;
      const isNewStatus = prevStatusRef.current !== 'playing';
      // If turnEndTime was pushed forward by > 5 seconds, treat as fresh turn window
      const isTurnExtended = Boolean(
        turnEndTime && 
        prevTurnEndTimeRef.current && 
        (turnEndTime - prevTurnEndTimeRef.current > 5000)
      );

      if (isNewTurnUid || isNewStatus || isTurnExtended) {
        currentTurnUidRef.current = turnUid;
        turnStartTimeRef.current = Date.now();
        isProcessing.current = false;
        lastProcessedTurnUid.current = null;
      }
    } else if (status !== 'playing') {
      currentTurnUidRef.current = null;
      lastProcessedTurnUid.current = null;
      isProcessing.current = false;
    }
    prevStatusRef.current = status;
    prevTurnEndTimeRef.current = turnEndTime;
  }, [turnUid, status, turnEndTime]);

  useEffect(() => {
    if (!isHost || status !== 'playing' || !roomId || !turnUid || !turnEndTime) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const elapsedSinceTurnStart = now - turnStartTimeRef.current;
      
      // Both server turnEndTime must be expired AND host must have observed at least 14s elapsed
      const isExpiredByTimestamp = now >= turnEndTime;
      const hasHadFullTurnTime = elapsedSinceTurnStart >= 14000;
      // Fallback safeguard: if host observed >= 16s elapsed since turn start, consider expired
      const isSafetyTimeout = elapsedSinceTurnStart >= 16000;

      // Only expire if:
      // 1. (Server turnEndTime has passed AND host observed >= 14s) OR
      // 2. Host observed >= 16s as safety fallback
      // AND we are not already processing this turn
      if (((isExpiredByTimestamp && hasHadFullTurnTime) || isSafetyTimeout) && !isProcessing.current) {
        if (lastProcessedTurnUid.current === turnUid) return;

        isProcessing.current = true;
        lastProcessedTurnUid.current = turnUid;

        try {
          const updatedPlayers = { ...players };
          if (updatedPlayers[turnUid]) {
            updatedPlayers[turnUid].alive = false;
          }

          // Find alive players
          const sortedPlayers = Object.values(updatedPlayers).sort((a, b) => a.order - b.order);
          const alivePlayers = sortedPlayers.filter(p => p.alive && !p.isSpectator);

          if (alivePlayers.length <= 1) {
            // Game Over
            await updateDoc(doc(db, `rooms/${roomId}/players`, turnUid), {
              alive: false
            });
            await updateDoc(doc(db, 'rooms', roomId), {
              status: 'finished',
              turnUid: null,
              turnEndTime: null
            });
          } else {
            // Move to next player
            const currentIndex = sortedPlayers.findIndex(p => p.uid === turnUid);
            let nextIndex = (currentIndex + 1) % sortedPlayers.length;
            let loopCount = 0;
            while ((!sortedPlayers[nextIndex].alive || sortedPlayers[nextIndex].isSpectator) && loopCount < sortedPlayers.length) {
              nextIndex = (nextIndex + 1) % sortedPlayers.length;
              loopCount++;
            }

            const nextPlayerUid = sortedPlayers[nextIndex].uid;

            // Mark current player dead & set next player with a full 15-second window from NOW
            await updateDoc(doc(db, `rooms/${roomId}/players`, turnUid), {
              alive: false
            });
            await updateDoc(doc(db, 'rooms', roomId), {
              turnUid: nextPlayerUid,
              turnEndTime: Date.now() + 15000
            });
          }
        } catch (err) {
          console.error("Host turn timeout error:", err);
        } finally {
          isProcessing.current = false;
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isHost, status, roomId, turnEndTime, turnUid, players]);
}
