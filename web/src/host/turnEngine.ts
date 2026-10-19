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
  const turnStartTimeRef = useRef<number>(Date.now());
  const lastProcessedTurnUid = useRef<string | null>(null);

  // Track when a new turn begins on Host to prevent clock-skew instant kills
  useEffect(() => {
    if (turnUid !== currentTurnUidRef.current) {
      currentTurnUidRef.current = turnUid;
      turnStartTimeRef.current = Date.now();
      isProcessing.current = false;
      lastProcessedTurnUid.current = null;
    }
  }, [turnUid]);

  useEffect(() => {
    if (!isHost || status !== 'playing' || !roomId || !turnUid) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const elapsedSinceTurnStart = now - turnStartTimeRef.current;
      
      // Player has 15 seconds. Must have elapsed at least 15 seconds on Host's clock!
      const isExpiredByTimestamp = turnEndTime ? now >= turnEndTime : false;
      const hasHadFullTurnTime = elapsedSinceTurnStart >= 15000;

      // Only expire if BOTH (or if elapsed time on Host is >= 15 seconds)
      // and we are not already processing this turn
      if ((hasHadFullTurnTime || (isExpiredByTimestamp && elapsedSinceTurnStart >= 14000)) && !isProcessing.current) {
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
