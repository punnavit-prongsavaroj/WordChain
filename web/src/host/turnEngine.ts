import { useEffect } from 'react';
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

  useEffect(() => {
    if (!isHost || status !== 'playing' || !roomId || !turnEndTime) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      if (now >= turnEndTime) {
        // Time is up for current player
        if (!turnUid) return;

        const updatedPlayers = { ...players };
        if (updatedPlayers[turnUid]) {
           updatedPlayers[turnUid].alive = false;
        }

        // Find next alive player
        const sortedPlayers = Object.values(updatedPlayers).sort((a, b) => a.order - b.order);
        const alivePlayers = sortedPlayers.filter(p => p.alive);

        if (alivePlayers.length <= 1) {
          // Game Over
          await updateDoc(doc(db, 'rooms', roomId), {
             status: 'finished',
             turnUid: null,
          });
          // Update player alive status
          await updateDoc(doc(db, `rooms/${roomId}/players`, turnUid), {
             alive: false
          });
        } else {
          // Move to next player
          const currentIndex = sortedPlayers.findIndex(p => p.uid === turnUid);
          let nextIndex = (currentIndex + 1) % sortedPlayers.length;
          while (!sortedPlayers[nextIndex].alive) {
             nextIndex = (nextIndex + 1) % sortedPlayers.length;
          }

          const nextPlayerUid = sortedPlayers[nextIndex].uid;

          // Perform updates
          await updateDoc(doc(db, `rooms/${roomId}/players`, turnUid), {
             alive: false
          });
          await updateDoc(doc(db, 'rooms', roomId), {
             turnUid: nextPlayerUid,
             turnEndTime: Date.now() + 15000 // 15 seconds for next player
          });
        }
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [isHost, status, roomId, turnEndTime, turnUid, players]);
}
