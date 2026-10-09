import { useGameStore } from '../store/gameStore';
import { leaveRoom } from '../services/roomService';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Copy, Users, User, LogOut, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function Lobby() {
  const code = useGameStore(state => state.code);
  const roomId = useGameStore(state => state.roomId);
  const players = useGameStore(state => state.players);
  const myUid = useGameStore(state => state.myUid);
  const hostUid = useGameStore(state => state.hostUid);
  const [copied, setCopied] = useState(false);
  
  const isHost = myUid === hostUid;
  const playerList = Object.values(players).sort((a, b) => a.order - b.order);

  const handleStartGame = async () => {
    if (!roomId) return;
    
    // Reset all players to alive in their respective subcollection documents
    const batch = writeBatch(db);
    
    playerList.forEach(p => {
      const playerRef = doc(db, 'rooms', roomId, 'players', p.uid);
      batch.update(playerRef, {
        alive: true,
        isSpectator: false
      });
    });

    const roomRef = doc(db, 'rooms', roomId);
    batch.update(roomRef, {
      status: 'playing',
      turnUid: playerList[0]?.uid || null,
      turnEndTime: Date.now() + 15000,
      words: [],
      usedSyllables: [],
      challenge: null
    });

    await batch.commit();
  };

  const copyCode = () => {
     if (!code) return;
     navigator.clipboard.writeText(code);
     setCopied(true);
     setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-6 md:p-12 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={leaveRoom}
          className="flex items-center gap-2 text-muted hover:text-danger font-bold transition-colors"
        >
          <LogOut className="w-5 h-5" />
          ออกจากห้อง
        </button>
        <div className="flex items-center gap-2 text-primary font-bold bg-primary/10 px-4 py-2 rounded-full">
          <Users className="w-5 h-5" />
          {playerList.length}/10
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
         <div className="flex-1 flex flex-col">
            <div className="bg-elevated rounded-[24px] shadow-lg border border-border p-6 md:p-8 mb-6 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-success"></div>
              <h2 className="text-muted font-bold mb-4">รหัสห้องของคุณ</h2>
              <div className="text-6xl md:text-7xl font-mono font-black tracking-[0.2em] text-main mb-6 drop-shadow-md">
                {code}
              </div>
              <button 
                 onClick={copyCode}
                 className="flex items-center justify-center gap-2 mx-auto bg-surface hover:bg-border border border-border px-6 py-3 rounded-full text-main font-bold transition-all active:scale-95"
              >
                 {copied ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5 text-muted" />}
                 {copied ? <span className="text-success">คัดลอกแล้ว!</span> : 'คัดลอกรหัส'}
              </button>
            </div>

            <div className="bg-elevated rounded-[24px] shadow-lg border border-border p-6">
              <h3 className="font-bold text-main mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                ผู้เล่นรอในห้อง
              </h3>
              <ul className="space-y-3">
                {playerList.map(p => (
                  <li key={p.uid} className="bg-surface border border-border p-4 rounded-[16px] shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                       <User className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-bold text-main text-lg flex-1">{p.name} {p.uid === myUid && <span className="text-muted text-sm ml-2">(คุณ)</span>}</span>
                    {p.uid === hostUid && (
                      <span className="text-xs bg-warning/20 text-warning px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
                        HOST
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
         </div>

         <div className="flex-1 flex flex-col gap-6">
            <div className="bg-surface rounded-[24px] shadow-inner border border-border p-8">
               <h3 className="text-xl font-bold text-main mb-6 flex items-center gap-2">
                  📜 กติกาฉบับย่อ
               </h3>
               <ul className="space-y-4 text-muted font-medium">
                  <li className="flex items-start gap-3">
                     <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">1</span>
                     <span>เมื่อถึงเทิร์น ให้กดปุ่มไมค์ค้างไว้แล้วพูด <strong>"คำนาม"</strong> ภายในเวลา 15 วินาที</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">2</span>
                     <span>คำที่พูดจะต้อง <strong>"มีความเกี่ยวโยง"</strong> กับคำของคนก่อนหน้า</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <span className="bg-danger/20 text-danger w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">3</span>
                     <span><strong>ห้ามใช้พยางค์ซ้ำ</strong> กับคำที่เคยพูดไปแล้วในเกมนี้เด็ดขาด (ระบบจะเตือนทันที)</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <span className="bg-warning/20 text-warning w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">4</span>
                     <span>ถ้าเพื่อนพูดคำที่ไม่เกี่ยวข้องกัน คุณสามารถกด <strong>"ยกมือประท้วง"</strong> เพื่อให้เพื่อนในวงช่วยกันโหวตปัดตกได้!</span>
                  </li>
               </ul>
            </div>

            {isHost ? (
              <button 
                onClick={handleStartGame}
                disabled={playerList.length < 2}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-surface disabled:text-muted disabled:border disabled:border-border text-white font-bold py-5 rounded-[16px] transition-all shadow-lg hover:shadow-primary/20 text-xl disabled:shadow-none"
              >
                {playerList.length < 2 ? 'รอเพื่อนอย่างน้อย 2 คน...' : 'เริ่มเกม! 🚀'}
              </button>
            ) : (
              <div className="w-full bg-surface border border-border text-muted text-center font-bold py-5 rounded-[16px] text-xl flex items-center justify-center gap-3">
                <span className="animate-pulse w-3 h-3 bg-primary rounded-full"></span>
                รอเจ้าของห้องเริ่มเกม...
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
