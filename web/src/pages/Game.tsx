import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useHostLoop } from '../host/turnEngine';
import { useChallengeEngine } from '../host/challengeEngine';
import { checkWordWithAPI } from '../services/apiClient';
import { leaveRoom } from '../services/roomService';
import { recordGameFinished, recordSpeechTelemetry } from '../services/userService';
import { addWordToDictionary, type Achievement } from '../services/achievementService';
import ScoreboardModal from '../components/ScoreboardModal';
import DictionaryModal from '../components/DictionaryModal';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Trophy, BookOpen, Sparkles } from 'lucide-react';

export default function Game() {
  const roomId = useGameStore(state => state.roomId);
  const myUid = useGameStore(state => state.myUid);
  const hostUid = useGameStore(state => state.hostUid);
  const isHost = myUid === hostUid;
  const turnUid = useGameStore(state => state.turnUid);
  const turnEndTime = useGameStore(state => state.turnEndTime);
  const players = useGameStore(state => state.players);
  const usedSyllables = useGameStore(state => state.usedSyllables);
  const words = useGameStore(state => state.words);
  const challenge = useGameStore(state => state.challenge);
  const status = useGameStore(state => state.status);
  const setMyWordStats = useGameStore(state => state.setMyWordStats);
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [turnAttempts, setTurnAttempts] = useState<number>(0);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState<boolean>(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState<boolean>(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);
  const [deathReason, setDeathReason] = useState<string>('');
  
  // Enable speech only if it's my turn
  const isMyTurn = myUid === turnUid;

  // Reset attempt count when it's our turn
  useEffect(() => {
    if (turnUid === myUid) {
      setTurnAttempts(0);
    }
  }, [turnUid, myUid]);

  useEffect(() => {
    if (status === 'lobby') {
      setDeathReason('');
    }
  }, [status]);

  // Auto record match stats when game finishes
  useEffect(() => {
    if (status === 'finished' && roomId && isHost) {
      const winner = Object.values(players).find(p => p.alive && !p.isSpectator);
      recordGameFinished(roomId, players, winner?.uid);
    }
  }, [status, roomId, isHost, players]);

  // Run Host Logic (will do nothing if not host)
  useHostLoop();
  useChallengeEngine();

  // Speech processing
  const micReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSpeaking = () => {
    if (micReleaseTimerRef.current) clearTimeout(micReleaseTimerRef.current);
    setFeedback('');
    setIsSpeaking(true);
  };

  const stopSpeaking = () => {
    setIsSpeaking(false);
    if (micReleaseTimerRef.current) clearTimeout(micReleaseTimerRef.current);
    micReleaseTimerRef.current = setTimeout(() => {
      setFeedback(prev => {
        if (!prev || prev === 'กำลังฟัง...') {
          return 'ฟังไม่ชัดเจน กดไมค์พูดใหม่ได้เลยครับ';
        }
        return prev;
      });
    }, 700);
  };

  const { interimText, error: speechError } = useSpeechRecognition({
    active: isMyTurn && status === 'playing' && isSpeaking,
    onFinalResult: async (text) => {
      if (!isMyTurn || status !== 'playing') return;
      if (micReleaseTimerRef.current) clearTimeout(micReleaseTimerRef.current);

      const trimmed = text.trim();
      const hasLetters = /[ก-๙a-zA-Z]/.test(trimmed);

      // ถ้าฟังไม่รู้เรื่อง (ไม่มีตัวอักษร / ว่างเปล่า / เสียงรบกวนสั้นๆ): ให้พูดใหม่ ไม่ตาย!
      if (!hasLetters || trimmed.length === 0) {
        setFeedback('ฟังไม่ชัดเจน กดไมค์พูดใหม่ได้เลยครับ');
        setIsSpeaking(false);
        return;
      }

      const currentAttempt = turnAttempts + 1;
      setTurnAttempts(currentAttempt);

      setFeedback(`กำลังตรวจสอบ: "${trimmed}"...`);
      try {
        const result = await checkWordWithAPI(trimmed, usedSyllables);
        if (result.valid) {
          // Success! Next player's turn
          if (myUid) {
            recordSpeechTelemetry(myUid, {
              attemptSuccess: true,
              isFirstAttempt: currentAttempt === 1,
              turnCompleted: true
            });
          }
          await handleTurnSuccess(result.syllables, trimmed);
          setFeedback('');
        } else {
          // ฟังรู้เรื่องแต่ผิดกฎ (คำซ้ำ, พยางค์ซ้ำ, ไม่ใช่คำนาม, เป็นประโยค) -> ตายเลย! (Sudden Death)
          if (myUid) {
            recordSpeechTelemetry(myUid, {
              attemptSuccess: false,
              isFirstAttempt: currentAttempt === 1,
              turnCompleted: false
            });
          }
          const failureReason = result.reason === 'is_sentence' 
            ? 'เป็นประโยค' 
            : result.reason === 'not_a_noun' 
            ? 'ไม่ใช่คำนาม' 
            : result.reason;
          setFeedback(`คำว่า "${trimmed}" ไม่ผ่าน: ${failureReason} (ผิดกฎ ตกรอบทันที!)`);
          await handleTurnFailure(failureReason, trimmed);
        }
      } catch (err) {
        // ตรวจสอบกับระบบไม่สำเร็จ (เช่น ปัญหาเน็ต) -> ให้พูดใหม่ได้ ไม่ตาย!
        if (myUid) {
          recordSpeechTelemetry(myUid, {
            attemptSuccess: false
          });
        }
        setFeedback(`ตรวจสอบไม่สำเร็จ ลองกดไมค์พูดใหม่ครับ`);
      }
      setIsSpeaking(false);
    }
  });

  const handleTurnFailure = async (failureReason: string, word: string) => {
    if (!roomId || !turnUid || status !== 'playing') return;

    setDeathReason(`คำว่า "${word}" ${failureReason}`);

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
      // Find next alive player
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
  };

  const handleTurnSuccess = async (newSyllables: string[], word: string) => {
    if (!roomId || !turnUid) return;
    
    // Calculate next player
    const sortedPlayers = Object.values(players).sort((a, b) => a.order - b.order);
    const currentIndex = sortedPlayers.findIndex(p => p.uid === turnUid);
    let nextIndex = (currentIndex + 1) % sortedPlayers.length;
    let loopCount = 0;
    while ((!sortedPlayers[nextIndex].alive || sortedPlayers[nextIndex].isSpectator) && loopCount < sortedPlayers.length) {
        nextIndex = (nextIndex + 1) % sortedPlayers.length;
        loopCount++;
    }
    const nextPlayerUid = sortedPlayers[nextIndex].uid;

    await updateDoc(doc(db, 'rooms', roomId), {
      usedSyllables: arrayUnion(...newSyllables),
      words: arrayUnion(word),
      turnUid: nextPlayerUid,
      turnEndTime: Date.now() + 15000,
    });

    // Increment player match score
    await updateDoc(doc(db, `rooms/${roomId}/players`, turnUid), {
      score: (players[turnUid]?.score || 0) + 1
    }).catch(() => {});

    // Save word to player's personal dictionary & check achievements
    if (myUid) {
      addWordToDictionary(myUid, word).then((res) => {
        if (res.isNewWord) {
          setMyWordStats(res.newCount, res.newTitle);
          updateDoc(doc(db, `rooms/${roomId}/players`, myUid), {
            wordCount: res.newCount,
            title: res.newTitle
          }).catch(() => {});
        }
        if (res.unlockedAchievement) {
          setUnlockedAchievement(res.unlockedAchievement);
        }
      }).catch((e) => console.error('Dictionary update error:', e));
    }
  };

  const handleChallenge = async () => {
     if (!roomId || !myUid || status !== 'playing' || words.length === 0) return;
     // The person who just played is the one before turnUid.
     // For simplicity, we just take the last word's speaker. Wait, we didn't save speaker uid per word.
     // Let's assume the previous alive player is the speaker.
     const sortedPlayers = Object.values(players).sort((a, b) => a.order - b.order);
     const currentIndex = sortedPlayers.findIndex(p => p.uid === turnUid);
     let prevIndex = (currentIndex - 1 + sortedPlayers.length) % sortedPlayers.length;
     while (!sortedPlayers[prevIndex].alive) {
         prevIndex = (prevIndex - 1 + sortedPlayers.length) % sortedPlayers.length;
     }
     const speakerUid = sortedPlayers[prevIndex].uid;

     if (myUid === speakerUid) return; // Can't challenge yourself

     await updateDoc(doc(db, 'rooms', roomId), {
        status: 'challenge',
        turnEndTime: null,
        challenge: {
           challengerUid: myUid,
           speakerUid: speakerUid,
           phase: 'voting',
           endTime: Date.now() + 180000, // 3 minutes
           votes: {},
           nextTurnUid: turnUid,
           resumeTime: turnEndTime
        }
     });
  };

  const submitVote = async (vote: boolean) => {
     if (!roomId || !myUid) return;
     await updateDoc(doc(db, 'rooms', roomId), {
        [`challenge.votes.${myUid}`]: vote
     });
  };

  // Timer Countdown Display
  useEffect(() => {
    if (status === 'playing' && turnUid) {
      const turnStart = Date.now();
      setTimeLeft(15);

      const interval = setInterval(() => {
        const now = Date.now();
        if (turnEndTime) {
          const serverRemaining = Math.max(0, Math.ceil((turnEndTime - now) / 1000));
          setTimeLeft(serverRemaining);
        } else {
          const localElapsed = (now - turnStart) / 1000;
          const localRemaining = Math.max(0, Math.ceil(15 - localElapsed));
          setTimeLeft(localRemaining);
        }
      }, 100);
      return () => clearInterval(interval);
    } else if (status === 'challenge' && challenge?.endTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((challenge.endTime - Date.now()) / 1000));
        setTimeLeft(remaining);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [turnUid, turnEndTime, status, challenge]);

  const sortedPlayers = Object.values(players).sort((a, b) => a.order - b.order);
  const myPlayer = players[myUid || ''];

  let lastSpeakerUid = null;
  if (words.length > 0 && turnUid) {
     const currentIndex = sortedPlayers.findIndex(p => p.uid === turnUid);
     if (currentIndex !== -1) {
         let prevIndex = (currentIndex - 1 + sortedPlayers.length) % sortedPlayers.length;
         let loops = 0;
         while (!sortedPlayers[prevIndex].alive && loops < sortedPlayers.length) {
             prevIndex = (prevIndex - 1 + sortedPlayers.length) % sortedPlayers.length;
             loops++;
         }
         lastSpeakerUid = sortedPlayers[prevIndex].uid;
     }
  }

  const renderDeadOrFinishedOverlay = () => {
     if (status === 'finished') {
       const winner = Object.values(players).find(p => p.alive && !p.isSpectator);
       return (
         <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center text-main overflow-y-auto">
           <div className="w-full max-w-lg bg-elevated border border-border p-8 rounded-[28px] shadow-2xl flex flex-col items-center animate-fade-in">
             <div className="text-6xl mb-3 animate-bounce">🏆</div>
             <h2 className="text-xl font-bold mb-2 text-warning uppercase tracking-wider">ผู้ชนะการต่อคำ!</h2>
             
             {/* Winner avatar */}
             <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-warning shadow-lg my-3 bg-surface flex items-center justify-center">
                {winner?.photoURL ? (
                  <img src={winner.photoURL} alt={winner.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-warning">
                    {winner?.name.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
             </div>

             <div className="text-3xl sm:text-4xl text-main font-black mb-2 drop-shadow-md">{winner?.name || 'ไม่มีผู้ชนะ'}</div>
             <p className="mb-6 text-sm font-medium text-muted">คำศัพท์ที่พูดไปในรอบนี้ทั้งหมด {words.length} คำ</p>

             {/* Action buttons */}
             <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
               <button 
                 onClick={() => setIsScoreboardOpen(true)}
                 className="bg-surface hover:bg-border border border-border text-main px-6 py-3.5 rounded-[16px] font-bold text-base shadow transition-all active:scale-95 flex items-center justify-center gap-2"
               >
                 <Trophy className="w-4 h-4 text-warning" />
                 ดูกระดานคะแนน
               </button>
               {isHost && (
                 <button 
                   onClick={() => updateDoc(doc(db, 'rooms', roomId!), { status: 'lobby' })} 
                   className="bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-[16px] font-bold text-base shadow-lg transition-all active:scale-95"
                 >
                   เล่นอีกครั้ง 🔄
                 </button>
               )}
             </div>
           </div>
         </div>
       );
     }

     // Only show the dead screen when playing. If challenging, the challenge modal will cover it.
     if (!myPlayer?.alive && status === 'playing') {
       return (
         <div className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-center p-8 text-center">
           <div className="bg-elevated/95 p-8 rounded-[24px] pointer-events-auto shadow-2xl backdrop-blur-md border border-border w-full max-w-sm">
             {myPlayer?.isSpectator ? (
                <>
                   <h1 className="text-3xl font-bold mb-4 text-primary">คุณคือผู้ชม 🍿</h1>
                   <p className="text-lg text-muted">รอเกมจบเพื่อเข้าร่วมในรอบถัดไป...</p>
                </>
             ) : (
                <>
                   <h1 className="text-4xl font-black mb-2 text-danger drop-shadow-md">คุณตกรอบแล้ว!</h1>
                   {deathReason ? (
                     <div className="bg-danger/10 text-danger border border-danger/20 font-bold px-3 py-1.5 rounded-xl text-sm mb-3">
                       {deathReason}
                     </div>
                   ) : (
                     <p className="text-sm text-danger/80 font-bold mb-3">หมดเวลา 15 วินาที</p>
                   )}
                   <p className="text-sm text-muted">รอเกมจบ หรือรอดูการ Challenge เพื่อช่วยเพื่อนโหวต...</p>
                </>
             )}
            </div>
          </div>
        );
     }
     return null;
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 relative h-screen max-h-screen">
      {/* Top Header Buttons */}
      <div className="absolute top-4 inset-x-4 flex justify-between items-center z-30 pointer-events-none">
        <button 
          onClick={leaveRoom}
          className="pointer-events-auto text-muted hover:text-danger font-bold transition-colors bg-background/80 hover:bg-surface px-4 py-2 rounded-full backdrop-blur-sm border border-border flex items-center gap-2 shadow-sm text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          ออกจากห้อง
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsDictionaryOpen(true)}
            className="text-main hover:text-primary font-bold transition-all bg-background/80 hover:bg-surface px-3.5 py-2 rounded-full backdrop-blur-sm border border-border flex items-center gap-2 shadow-sm text-sm"
            title="พจนานุกรมและฉายา"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">คลังศัพท์</span>
          </button>

          <button 
            onClick={() => setIsScoreboardOpen(true)}
            className="text-main hover:text-primary font-bold transition-all bg-background/80 hover:bg-surface px-3.5 py-2 rounded-full backdrop-blur-sm border border-border flex items-center gap-2 shadow-sm text-sm"
          >
            <Trophy className="w-4 h-4 text-warning" />
            <span className="hidden sm:inline">กระดานคะแนน</span>
          </button>
        </div>
      </div>

      {renderDeadOrFinishedOverlay()}

      {/* Challenge Modal Overlay */}
      {status === 'challenge' && challenge && (
         <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center text-main">
            <h2 className="text-4xl font-black text-warning mb-2 drop-shadow-md">มีคนประท้วง!</h2>
            <p className="text-xl text-muted mb-8">
               <span className="font-bold text-main">{players[challenge.challengerUid]?.name}</span> ประท้วงคำของ <span className="font-bold text-main">{players[challenge.speakerUid]?.name}</span>
            </p>
            
            <p className="text-2xl mb-8">
               <span className="text-4xl font-bold text-primary block my-4">
                 {words.length > 1 && <>{words[words.length-2]} <span className="text-muted">→</span></>} {words[words.length-1]}
               </span>
               {words.length > 1 ? 'สองคำนี้เกี่ยวข้องกันไหม?' : 'คำนี้เป็นคำนามที่ถูกต้องใช่ไหม?'}
            </p>
            
            {challenge.phase === 'voting' ? (
              <>
                 <div className="text-xl mb-6 font-bold">เวลาโหวต: <span className="text-warning font-mono text-3xl">{timeLeft}</span> วินาที</div>
                 {myUid !== challenge.speakerUid && myUid !== challenge.challengerUid && challenge.votes?.[myUid!] === undefined && !myPlayer?.isSpectator ? (
                   <div className="flex gap-4 w-full max-w-sm mt-4">
                     <button onClick={() => submitVote(true)} className="flex-1 bg-success hover:bg-success/90 text-background py-5 rounded-[16px] font-bold text-xl transition-transform active:scale-95 shadow-lg shadow-success/20">เกี่ยวข้อง ให้ผ่าน</button>
                     <button onClick={() => submitVote(false)} className="flex-1 bg-danger hover:bg-danger/90 text-white py-5 rounded-[16px] font-bold text-xl transition-transform active:scale-95 shadow-lg shadow-danger/20">ไม่เกี่ยว ปัดตก</button>
                   </div>
                 ) : (
                   <div className="bg-surface border border-border px-8 py-4 rounded-[16px] mt-4">
                      <div className="text-muted text-lg font-bold">
                        {myUid === challenge.speakerUid && "นับเสียงคุณเป็นให้ผ่าน 1 เสียงแล้ว"}
                        {myUid === challenge.challengerUid && "นับเสียงคุณเป็นปัดตก 1 เสียงแล้ว"}
                        {challenge.votes?.[myUid!] !== undefined && "คุณลงคะแนนแล้ว รอผลตัดสิน..."}
                        {myPlayer?.isSpectator && "คุณกำลังรับชม ไม่มีสิทธิ์โหวต"}
                      </div>
                   </div>
                 )}
                 <div className="mt-8 text-sm text-primary font-bold animate-pulse flex items-center gap-2">
                   <div className="w-2 h-2 bg-primary rounded-full"></div>
                   AI กำลังพิจารณาความเกี่ยวโยง... (AI 0.5 เสียง, ผู้เล่นคนละ 1 เสียง)
                 </div>
              </>
            ) : (
              <div className="bg-elevated border border-border text-main rounded-[24px] p-8 w-full max-w-md shadow-2xl">
                 <h3 className="text-3xl font-black mb-6">ผลการตัดสิน</h3>
                 <div className="flex justify-between items-center mb-6 text-2xl bg-surface p-4 rounded-[16px]">
                    <span className="text-success font-bold flex items-center gap-2"><span className="text-3xl">✅</span> {challenge.result?.passCount} เสียง</span>
                    <span className="text-danger font-bold flex items-center gap-2">{challenge.result?.failCount} เสียง <span className="text-3xl">❌</span></span>
                 </div>
                 <div className="p-4 bg-surface/50 border border-border rounded-[16px] mb-6 text-sm text-left">
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-primary block">ความเห็นจาก AI (0.5 เสียง): </strong>
                      {challenge.aiVote?.semanticScore && (
                        <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                          ความเชื่อมโยง: {challenge.aiVote.semanticScore}/5 ⭐
                        </span>
                      )}
                    </div>
                    <span className="text-main font-bold">{challenge.aiVote?.pass ? '✅ ให้ผ่าน' : '❌ ปัดตก'}</span> <br/>
                    <span className="text-muted mt-1 block leading-relaxed">{challenge.aiVote?.reason}</span>
                 </div>
                 <div className={`text-3xl font-black ${challenge.result?.outcome === 'pass' ? 'text-success' : 'text-danger'}`}>
                    {challenge.result?.outcome === 'pass' ? 'คำนี้รอด คนประท้วงตกรอบ!' : 'คำนี้ไม่ผ่าน คนพูดตกรอบ!'}
                 </div>
                 <p className="text-sm text-muted mt-4 font-bold animate-pulse">กำลังกลับเข้าเกม...</p>
              </div>
            )}
         </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-6 h-full overflow-hidden">
         {/* Left 65%: Video Grid */}
         <div className="flex-[6.5] flex items-center justify-center bg-elevated rounded-[24px] border border-border p-6 overflow-y-auto">
            <div className="flex flex-wrap justify-center gap-4 w-full">
              {sortedPlayers.map(p => {
                const isMe = p.uid === myUid;
                const winRate = p.gamesPlayed ? Math.round(((p.wins || 0) / p.gamesPlayed) * 100) : 0;
                
                return (
                  <div 
                    key={p.uid} 
                    className={`relative group rounded-[20px] overflow-hidden shadow-lg transition-all duration-300 bg-surface ${
                      p.uid === turnUid 
                        ? 'border-4 border-primary scale-105 shadow-primary/20 ring-2 ring-primary/30' 
                        : (p.alive ? 'border border-border' : 'opacity-40 grayscale border border-border')
                    }`} 
                    style={{ width: 'min(100%, 220px)', aspectRatio: '1/1' }}
                  >
                    
                    <div className="w-full h-full flex items-center justify-center relative">
                       {/* Decorative background shape */}
                       <div className="absolute inset-0 bg-gradient-to-br from-surface to-background opacity-50"></div>
                       
                       <div className={`relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-transform duration-300 ${p.uid === turnUid ? 'scale-110 ring-4 ring-primary shadow-primary/40' : 'border-2 border-border'}`}>
                          {p.photoURL ? (
                            <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center text-5xl font-black ${p.uid === turnUid ? 'bg-primary text-background' : 'bg-elevated text-muted'}`}>
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                       </div>
                    </div>
                    
                    {/* Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent p-4 flex flex-col justify-end">
                       <span className="font-bold truncate text-sm text-main drop-shadow-md">
                          {p.name} {isMe && <span className="text-muted">(คุณ)</span>}
                       </span>
                    </div>

                    {/* Status Badges */}
                    {!p.alive && !p.isSpectator && (
                       <div className="absolute top-2 right-2 bg-danger/80 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                         ตกรอบแล้ว
                       </div>
                    )}
                    {p.isSpectator && (
                       <div className="absolute top-2 right-2 bg-muted/80 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                         ผู้ชม
                       </div>
                    )}
                    {p.alive && p.uid === turnUid && (
                       <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded-md shadow-md animate-pulse">
                         กำลังต่อคำ...
                       </div>
                    )}

                    {/* Hover Stats Tooltip Card */}
                    <div className="absolute inset-0 bg-background/95 backdrop-blur-md p-3.5 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30 border border-primary/40 rounded-[20px] shadow-2xl">
                       <div>
                          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/80">
                             <div className="w-6 h-6 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                                {p.photoURL ? (
                                  <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-bold text-[10px] text-primary">{p.name.charAt(0)}</span>
                                )}
                             </div>
                             <div className="min-w-0 flex-1">
                                <div className="font-black text-main text-xs truncate">{p.name}</div>
                                <div className="text-[10px] text-primary font-bold truncate">🎖️ {p.title || 'ผู้ฝึกต่อคำ'}</div>
                             </div>
                          </div>

                          <div className="space-y-1 text-[11px]">
                             <div className="flex justify-between items-center">
                                <span className="text-muted font-medium">🏆 ชนะ:</span>
                                <span className="font-bold text-warning">{p.wins || 0} ครั้ง</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted font-medium">🎮 เล่นทั้งหมด:</span>
                                <span className="font-bold text-main">{p.gamesPlayed || 0} เกม</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted font-medium">📊 Win Rate:</span>
                                <span className="font-black text-primary">{winRate}%</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted font-medium">📖 คลังศัพท์:</span>
                                <span className="font-bold text-primary">{p.wordCount || 0} คำ</span>
                             </div>
                             <div className="flex justify-between items-center border-t border-border/50 pt-1 mt-1">
                                <span className="text-muted font-medium">💬 ต่อได้รอบนี้:</span>
                                <span className="font-bold text-success">{p.score || 0} คำ</span>
                             </div>
                          </div>
                       </div>

                       <div className="text-[10px] text-center text-muted font-bold bg-surface/80 py-1 rounded-lg">
                          {p.alive ? '🟢 ยังอยู่ในเกม' : (p.isSpectator ? '👀 ผู้ชม' : '💀 ตกรอบแล้ว')}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
         </div>

         {/* Right 35%: Word Panel & Controls */}
         <div className="flex-[3.5] flex flex-col gap-4 max-h-full">
            
            {/* Word Panel */}
            <div className="bg-elevated rounded-[24px] border border-border p-8 flex flex-col items-center text-center relative overflow-hidden shrink-0">
               <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-success"></div>
               
               <p className="text-sm font-bold text-muted mb-2 uppercase tracking-widest">ต่อจากคำนี้</p>
               <div className="text-4xl md:text-5xl font-black text-main mb-6 drop-shadow-sm min-h-[3rem]">
                  {words.length > 0 ? words[words.length-1] : '- เริ่มเกมได้ -'}
               </div>
               
               <div className="relative flex items-center justify-center mb-6">
                  <svg className="w-24 h-24 transform -rotate-90">
                     <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-surface" />
                     <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent"
                        strokeDasharray={276}
                        strokeDashoffset={276 - (276 * (timeLeft / 15))}
                        className={`transition-all duration-200 ${timeLeft <= 5 ? 'text-danger' : 'text-primary'}`} 
                     />
                  </svg>
                  <div className={`absolute text-3xl font-black ${timeLeft <= 5 ? 'text-danger' : 'text-main'}`}>
                    {timeLeft}
                  </div>
               </div>

               <div className="text-lg text-muted font-medium mb-4">
                  เทิร์นของ <span className="text-primary font-bold">{players[turnUid || '']?.name || '...'}</span>
               </div>

               {words.length > 0 && myPlayer?.alive && !myPlayer?.isSpectator && myUid !== lastSpeakerUid && (
                 <button 
                    onClick={handleChallenge}
                    className="w-full bg-warning/20 text-warning hover:bg-warning/30 border border-warning/50 font-bold py-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 mb-4"
                 >
                    <span className="text-xl">✋</span> ยกมือประท้วง!
                 </button>
               )}
            </div>

            {/* Talk Control Panel */}
            <div className="bg-elevated rounded-[24px] border border-border p-6 flex flex-col items-center justify-center flex-1">
               {isMyTurn ? (
                 <>
                   <button
                     onMouseDown={startSpeaking}
                     onMouseUp={stopSpeaking}
                     onTouchStart={startSpeaking}
                     onTouchEnd={stopSpeaking}
                     className={`w-28 h-28 rounded-full transition-all flex items-center justify-center shadow-xl mb-4 ${isSpeaking ? 'bg-danger scale-105 animate-pulse shadow-danger/40' : 'bg-primary hover:bg-primary/90 hover:scale-105 shadow-primary/30'}`}
                   >
                     <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                     </svg>
                   </button>
                   
                   <div className="text-sm font-bold text-muted mb-4 uppercase tracking-wider">
                     {isSpeaking ? 'กำลังฟัง...' : 'กดค้างเพื่อพูด'}
                   </div>

                   <div className="min-h-[3rem] w-full flex flex-col items-center justify-center text-center">
                     {interimText && <div className="text-main font-bold text-lg mb-1 drop-shadow-sm">{interimText}</div>}
                     
                     {(feedback || speechError) && !interimText && !isSpeaking && (
                       <div className={`font-bold text-sm px-4 py-2 rounded-lg border ${feedback.includes('กำลัง') ? 'bg-surface border-border text-muted' : (feedback.includes('ผิด') || feedback.includes('ไม่') || speechError ? 'bg-danger/10 border-danger/20 text-danger' : 'bg-success/10 border-success/20 text-success')}`}>
                         {speechError || feedback}
                       </div>
                     )}
                   </div>
                 </>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full opacity-50">
                    <div className="w-20 h-20 rounded-full bg-surface border-2 border-border flex items-center justify-center mb-4">
                       <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                       </svg>
                    </div>
                    {myPlayer?.alive ? (
                       <span className="font-bold text-muted">รอเทิร์นของคุณ...</span>
                    ) : (
                       <span className="font-bold text-danger text-center">คุณตกรอบแล้ว<br/>รอโหวตเมื่อมีการประท้วง</span>
                    )}
                 </div>
               )}
            </div>
         </div>
      </div>
      {/* Scoreboard Modal */}
      <ScoreboardModal 
        isOpen={isScoreboardOpen} 
        onClose={() => setIsScoreboardOpen(false)} 
        players={players} 
        myUid={myUid} 
      />

      {/* Dictionary & Titles Modal */}
      <DictionaryModal
        isOpen={isDictionaryOpen}
        onClose={() => setIsDictionaryOpen(false)}
      />

      {/* Achievement Unlocked Celebration Popup */}
      {unlockedAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="bg-elevated border-2 border-warning/60 p-6 md:p-8 rounded-[28px] max-w-md w-full text-center shadow-2xl relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-warning via-primary to-warning animate-pulse" />
            <div className="text-5xl md:text-6xl mb-3 animate-bounce">🏆</div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-warning/20 text-warning text-xs font-black rounded-full mb-3 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> ปลดล็อคความสำเร็จใหม่!
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-main mb-2">
              สะสมคำครบ {unlockedAchievement.threshold.toLocaleString()} คำ!
            </h3>
            <p className="text-sm text-muted mb-4">คุณได้รับฉายาใหม่สุดเท่</p>
            <div className="inline-block px-5 py-2.5 bg-primary/20 border border-primary/40 rounded-2xl text-xl font-black text-primary mb-6 shadow-inner">
              🎖️ {unlockedAchievement.title}
            </div>
            <div>
              <button
                onClick={() => setUnlockedAchievement(null)}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95"
              >
                สุดยอดเลย! 🎉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
