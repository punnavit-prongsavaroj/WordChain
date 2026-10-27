import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { judgeWordWithAPI } from '../services/apiClient';
import { recordChallengeTelemetry } from '../services/userService';

export function useChallengeEngine() {
  const isHost = useGameStore(state => state.myUid === state.hostUid);
  const roomId = useGameStore(state => state.roomId);
  const status = useGameStore(state => state.status);
  const challenge = useGameStore(state => state.challenge);
  const players = useGameStore(state => state.players);
  const words = useGameStore(state => state.words);
  const usedSyllables = useGameStore(state => state.usedSyllables);

  const isTallyingRef = useRef(false);
  const aiJudgingRef = useRef(false);

  useEffect(() => {
    if (status !== 'challenge' || !challenge || challenge.phase !== 'voting') {
      isTallyingRef.current = false;
      aiJudgingRef.current = false;
    }
  }, [status, challenge]);

  useEffect(() => {
    if (!isHost || status !== 'challenge' || !roomId || !challenge || challenge.phase !== 'voting') return;

    // AI Judge automatically if not yet judged
    if (challenge.aiVote === undefined && !aiJudgingRef.current) {
      aiJudgingRef.current = true;
      const getAiVote = async () => {
        try {
          const previousWord = words.length >= 2 ? words[words.length - 2] : '';
          const currentWord = words[words.length - 1] || '';
          const aiResult = await judgeWordWithAPI(previousWord, currentWord);
          await updateDoc(doc(db, 'rooms', roomId), {
            'challenge.aiVote': aiResult
          });
        } catch (e) {
           console.error("AI API failed:", e);
           await updateDoc(doc(db, 'rooms', roomId), {
            'challenge.aiVote': { pass: true, reason: 'เชื่อมต่อ AI ไม่ได้ ระบบอนุโลมให้ผ่าน' }
          });
        }
      };
      getAiVote();
    }

    // Check if voting time is up or everyone has voted
    const interval = setInterval(async () => {
      const now = Date.now();
      const votingPlayers = Object.values(players).filter(p => !p.isSpectator && p.uid !== challenge.speakerUid && p.uid !== challenge.challengerUid);
      const allVoted = votingPlayers.every(p => challenge.votes?.[p.uid] !== undefined);
      const aiVoted = challenge.aiVote !== undefined;

      if (now >= challenge.endTime || (allVoted && aiVoted)) {
        if (isTallyingRef.current) return;
        isTallyingRef.current = true;
        clearInterval(interval);

        // Tally votes
        let passCount = 0;
        let failCount = 0;
        
        // Speaker wants their word to pass
        passCount++;
        // Challenger wants the word to fail
        failCount++;
        
        // Count other non-spectator players (default pass if not voted)
        for (const p of votingPlayers) {
           const vote = challenge.votes?.[p.uid];
           if (vote === false) failCount++;
           else passCount++; // True or undefined means pass
        }

        // Add AI vote (AI has 0.5 vote weight, players have 1 vote)
        if (challenge.aiVote) {
           if (challenge.aiVote.pass) passCount += 0.5;
           else failCount += 0.5;
        }

        // If votes are equal, the word passes (benefit of the doubt)
        const outcome = failCount > passCount ? 'fail' : 'pass';

        // Record Challenge Telemetry for the speaker
        recordChallengeTelemetry(
           challenge.speakerUid,
           outcome === 'pass',
           challenge.aiVote?.semanticScore
        );

        // Set revealed phase
        await updateDoc(doc(db, 'rooms', roomId), {
          'challenge.phase': 'revealed',
          'challenge.result': { passCount, failCount, outcome }
        });

        // After 5 seconds, resume game with a fresh 15-second turn
        setTimeout(async () => {
           const latestStore = useGameStore.getState();
           const latestPlayers = latestStore.players;
           const latestWords = latestStore.words;

           let nextTurnUid = challenge.speakerUid;
           let updatedWords = [...latestWords];

           if (outcome === 'fail') {
               // Speaker dies
               await updateDoc(doc(db, `rooms/${roomId}/players`, challenge.speakerUid), {
                   alive: false
               });
               
               // Revert word
               if (updatedWords.length > 0) {
                 updatedWords.pop();
               }
               
               // Turn goes to challenger or next alive
               nextTurnUid = challenge.challengerUid;
           } else {
               // Challenger dies
               await updateDoc(doc(db, `rooms/${roomId}/players`, challenge.challengerUid), {
                   alive: false
               });
               nextTurnUid = challenge.nextTurnUid;
           }

           // If the assigned nextTurnUid is dead (e.g. they were the challenger or speaker who just died),
           // find the next alive player
           const sortedPlayers = Object.values(latestPlayers).sort((a, b) => a.order - b.order);
           let targetIndex = sortedPlayers.findIndex(p => p.uid === nextTurnUid);
           if (targetIndex === -1) targetIndex = 0;
           
           // Temporarily mark the newly dead person as dead in our local array for the loop check
           const deadUid = outcome === 'fail' ? challenge.speakerUid : challenge.challengerUid;
           const simulatedPlayers = sortedPlayers.map(p => p.uid === deadUid ? { ...p, alive: false } : p);

           let loops = 0;
           while (!simulatedPlayers[targetIndex]?.alive && loops < simulatedPlayers.length) {
               targetIndex = (targetIndex + 1) % simulatedPlayers.length;
               loops++;
           }
           
           nextTurnUid = simulatedPlayers[targetIndex]?.uid;

           // Check if game is over (only 1 or 0 alive left)
           const aliveCount = simulatedPlayers.filter(p => p.alive && !p.isSpectator).length;
           if (aliveCount <= 1) {
               await updateDoc(doc(db, 'rooms', roomId), {
                   status: 'finished',
                   challenge: null,
                   turnUid: null,
                   turnEndTime: null
               });
               return;
           }

           // Give a fresh full 15-second turn window from the exact moment we resume
           const freshTurnEndTime = Date.now() + 15000;

           await updateDoc(doc(db, 'rooms', roomId), {
               status: 'playing',
               challenge: null,
               turnUid: nextTurnUid,
               turnEndTime: freshTurnEndTime,
               words: updatedWords
           });

        }, 5000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, status, roomId, challenge, players, words, usedSyllables]);
}
