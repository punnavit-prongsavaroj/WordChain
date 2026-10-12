import { useState, useEffect } from 'react';
import { createRoom, joinRoomByCode, subscribeToRoom } from '../services/roomService';
import { useGameStore } from '../store/gameStore';
import { checkWordWithAPI } from '../services/apiClient';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { getGlobalLeaderboard, type UserProfile } from '../services/userService';
import ProfileModal from '../components/ProfileModal';
import { Mic, User, Edit3, Sparkles, Trophy, RotateCcw } from 'lucide-react';

export default function Home() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  
  // Test Feature State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{text: string, valid: boolean, reason?: string} | null>(null);
  const [testError, setTestError] = useState<string>('');

  const myUid = useGameStore(state => state.myUid);
  const myName = useGameStore(state => state.myName);
  const myPhotoURL = useGameStore(state => state.myPhotoURL);
  const myEmail = useGameStore(state => state.myEmail);
  const myWins = useGameStore(state => state.myWins);
  const myGamesPlayed = useGameStore(state => state.myGamesPlayed);

  const loadLeaderboard = async () => {
    setIsLeaderboardLoading(true);
    try {
      const data = await getGlobalLeaderboard(15);
      setLeaderboard(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const { interimText, error: speechError } = useSpeechRecognition({
    active: isTesting,
    onFinalResult: async (text) => {
      setTestError('');
      setTestResult({ text, valid: false, reason: 'กำลังตรวจสอบ...' });
      try {
        const result = await checkWordWithAPI(text, []);
        if (result.valid) {
          setTestResult({ text, valid: true });
        } else {
          let errorMsg = result.reason;
          if (result.reason === 'is_sentence') errorMsg = 'เป็นประโยค (มีสรรพนาม+กริยา)';
          if (result.reason === 'not_a_noun') errorMsg = 'ไม่ใช่คำนาม / ตรวจพบคำกริยา';
          setTestResult({ text, valid: false, reason: errorMsg });
        }
      } catch {
        setTestResult({ text, valid: false, reason: 'ระบบตรวจสอบขัดข้อง' });
      }
      setIsTesting(false);
    }
  });

  const startTest = () => {
     setTestResult(null);
     setTestError('');
     setIsTesting(true);
  };

  const stopTest = () => {
     setIsTesting(false);
     setTimeout(() => {
        setTestError(prev => prev || 'ไม่เข้าใจ ลองพูดใหม่ครับ');
     }, 500);
  };

  const handleCreate = async () => {
    if (!myUid || !myName) return;
    setIsLoading(true);
    setError('');
    try {
      const { roomId } = await createRoom(myUid, myName, myPhotoURL);
      subscribeToRoom(roomId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) return setError('กรุณาใส่รหัสห้อง');
    if (!myUid || !myName) return;
    setIsLoading(true);
    setError('');
    try {
      const roomId = await joinRoomByCode(code, myUid, myName, myPhotoURL);
      subscribeToRoom(roomId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 md:p-12 overflow-y-auto">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-8">
        <div className="font-bold text-main text-xl flex items-center gap-2">
          <Mic className="w-6 h-6 text-primary" />
          Word Chain Voice
        </div>
        
        {/* Profile Button in Navbar */}
        <button 
          onClick={() => setIsProfileOpen(true)}
          className="flex items-center gap-3 bg-surface hover:bg-elevated border border-border px-3.5 py-2 rounded-full transition-all group shadow-sm active:scale-95"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center border border-primary/30">
            {myPhotoURL ? (
              <img src={myPhotoURL} alt={myName || ''} className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-primary" />
            )}
          </div>
          <span className="text-main font-bold text-sm hidden sm:inline max-w-[120px] truncate">
            {myName || 'ผู้เล่น'}
          </span>
          <Edit3 className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
         {/* Left Col: Join / Create */}
         <div className="flex-1 flex flex-col">
            <div className="mb-8">
               <h1 className="text-4xl md:text-5xl font-black text-main mb-4 leading-tight">
                 ต่อคำให้ทัน<br/><span className="text-primary">แถให้รอด!</span>
               </h1>
               <p className="text-muted text-lg">เกมต่อคำด้วยเสียง ที่เพื่อนคุณพร้อมประท้วงทุกเมื่อ</p>
            </div>

            <div className="bg-elevated rounded-[24px] shadow-lg border border-border p-6 mb-6">
              {error && (
                <div className="bg-danger/20 text-danger border border-danger/30 text-sm p-3 rounded-lg mb-4 font-bold">
                  {error}
                </div>
              )}

              <button 
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-[16px] transition-colors disabled:opacity-50 shadow-md mb-6 text-lg"
              >
                สร้างห้องใหม่
              </button>

              <div className="relative py-4 mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-elevated px-4 text-sm text-muted font-bold">หรือเข้าร่วมห้องเพื่อน</span>
                </div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 px-4 py-4 rounded-[16px] bg-surface border border-border focus:ring-2 focus:ring-primary outline-none text-center tracking-widest text-xl font-mono uppercase text-main placeholder-muted"
                  placeholder="รหัส 6 หลัก"
                  maxLength={6}
                />
                <button 
                  onClick={handleJoin}
                  disabled={isLoading}
                  className="bg-surface hover:bg-border border border-border text-main font-bold px-8 py-4 rounded-[16px] transition-colors disabled:opacity-50 shadow-md text-lg"
                >
                  เข้าร่วม
                </button>
              </div>
            </div>

            {/* Global Leaderboard Card */}
            <div className="bg-elevated rounded-[24px] shadow-lg border border-border p-6 flex flex-col mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="bg-warning/20 p-2.5 rounded-2xl text-warning">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-main text-lg flex items-center gap-2">
                      อันดับรวมทั้งหมด (Global Scoreboard)
                    </h3>
                    <p className="text-xs text-muted font-medium">รวมคะแนนชนะและสถิติของผู้เล่นทุกคน</p>
                  </div>
                </div>

                <button 
                  onClick={loadLeaderboard}
                  disabled={isLeaderboardLoading}
                  className="p-2 text-muted hover:text-main rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors disabled:opacity-50"
                  title="รีเฟรชอันดับ"
                >
                  <RotateCcw className={`w-4 h-4 ${isLeaderboardLoading ? 'animate-spin text-primary' : ''}`} />
                </button>
              </div>

              {isLeaderboardLoading && leaderboard.length === 0 ? (
                <div className="py-8 text-center text-muted font-bold text-sm animate-pulse">
                  กำลังโหลดอันดับผู้เล่น...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-8 text-center text-muted font-bold text-sm bg-surface rounded-2xl border border-border">
                  ยังไม่มีสถิติการแข่งขัน เล่นเกมให้จบเพื่อขึ้นกระดานอันดับ!
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {leaderboard.map((u, idx) => {
                    const isMe = u.uid === myUid;
                    const winRate = u.gamesPlayed ? Math.round(((u.wins || 0) / u.gamesPlayed) * 100) : 0;
                    
                    return (
                      <div
                        key={u.uid}
                        className={`p-3 rounded-[16px] border transition-all flex items-center gap-3 ${
                          isMe 
                            ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30' 
                            : (idx === 0 
                                ? 'bg-warning/10 border-warning/30' 
                                : 'bg-surface border-border hover:bg-surface/80')
                        }`}
                      >
                        {/* Rank Badge */}
                        <div className="w-7 text-center font-black text-base flex-shrink-0">
                          {idx === 0 && <span className="text-xl" title="อันดับ 1">🥇</span>}
                          {idx === 1 && <span className="text-xl" title="อันดับ 2">🥈</span>}
                          {idx === 2 && <span className="text-xl" title="อันดับ 3">🥉</span>}
                          {idx > 2 && <span className="text-muted text-xs">#{idx + 1}</span>}
                        </div>

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center border border-border flex-shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-black text-primary text-sm">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Name & Stats */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-main text-sm truncate flex items-center gap-1.5">
                            {u.name}
                            {isMe && <span className="text-primary text-[10px] font-bold px-1.5 py-0.5 bg-primary/20 rounded-md">(คุณ)</span>}
                          </div>
                          <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                            <span>{u.gamesPlayed || 0} เกม</span>
                            <span>•</span>
                            <span className="text-primary font-bold">{winRate}% Win Rate</span>
                          </div>
                        </div>

                        {/* Wins Count */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-black text-warning flex items-center justify-end gap-1">
                            <Trophy className="w-3.5 h-3.5" />
                            {u.wins || 0}
                          </div>
                          <div className="text-[10px] text-muted font-medium">ชนะ</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
         </div>

         {/* Right Col: User Profile Card & Mic Test */}
         <div className="flex-1 flex flex-col gap-6">
            {/* User Profile Card (Replaced Camera Preview) */}
            <div className="bg-elevated rounded-[24px] shadow-lg border border-border p-6 relative overflow-hidden flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/30 shadow-md bg-surface flex items-center justify-center">
                  {myPhotoURL ? (
                    <img src={myPhotoURL} alt={myName || ''} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-primary">
                      {myName?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-success rounded-full border-2 border-elevated flex items-center justify-center shadow" title="ออนไลน์">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full mb-1">
                  <Sparkles className="w-3 h-3" />
                  พร้อมเล่น
                </div>
                <h3 className="text-2xl font-black text-main truncate">
                  {myName || 'ผู้เล่น'}
                </h3>
                {myEmail && (
                  <p className="text-xs text-muted truncate">
                    {myEmail}
                  </p>
                )}

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 py-2 max-w-xs mx-auto sm:mx-0">
                  <div className="bg-surface/80 border border-border p-2 rounded-xl text-center">
                    <div className="text-[10px] text-muted font-bold">🏆 ชนะ</div>
                    <div className="text-sm font-black text-warning">{myWins}</div>
                  </div>
                  <div className="bg-surface/80 border border-border p-2 rounded-xl text-center">
                    <div className="text-[10px] text-muted font-bold">🎮 ทั้งหมด</div>
                    <div className="text-sm font-black text-main">{myGamesPlayed}</div>
                  </div>
                  <div className="bg-surface/80 border border-border p-2 rounded-xl text-center">
                    <div className="text-[10px] text-muted font-bold">📊 Win Rate</div>
                    <div className="text-sm font-black text-primary">
                      {myGamesPlayed ? Math.round((myWins / myGamesPlayed) * 100) : 0}%
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => setIsProfileOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-surface hover:bg-primary/10 border border-primary/20 px-3.5 py-2 rounded-xl transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    เปลี่ยนชื่อ / รูปโปรไฟล์
                  </button>
                </div>
              </div>
            </div>

            {/* Mic Test Section */}
            <div className="bg-elevated rounded-[24px] p-6 border border-border flex flex-col items-center">
              <h3 className="font-bold text-main mb-2 flex items-center gap-2">
                ทดสอบไมค์และคำศัพท์
              </h3>
              <p className="text-sm text-muted mb-6 text-center">
                ลองพูดเพื่อดูว่าระบบมองเป็น "คำนาม" หรือไม่
              </p>
              
              <div className="text-center mb-6">
                <button
                  onMouseDown={startTest}
                  onMouseUp={stopTest}
                  onTouchStart={startTest}
                  onTouchEnd={stopTest}
                  className={`rounded-full p-6 transition-all shadow-lg ${isTesting ? 'bg-danger scale-110 animate-pulse shadow-danger/50' : 'bg-primary hover:bg-primary/90 shadow-primary/30'}`}
                >
                  <Mic className="w-10 h-10 text-white" />
                </button>
                <div className="mt-4 text-sm font-bold text-muted">
                  {isTesting ? 'กำลังฟัง...' : 'กดค้างเพื่อพูด'}
                </div>
              </div>

              <div className="min-h-[4rem] w-full flex flex-col justify-center items-center text-center">
                {interimText && <div className="text-primary italic mb-1 font-bold">{interimText}</div>}
                {(speechError || (testError && !testResult && !interimText && !isTesting)) && (
                   <div className="text-danger text-sm font-bold bg-danger/10 border border-danger/20 px-4 py-2 rounded-xl">
                      {speechError || testError}
                   </div>
                )}
                
                {testResult && !isTesting && !interimText && (
                  <div className="bg-surface px-6 py-4 rounded-[16px] shadow-inner border border-border w-full flex flex-col items-center gap-2">
                     <div className="text-muted text-sm font-bold">ระบบได้ยินว่า:</div>
                     <div className="text-xl font-bold text-main">"{testResult.text}"</div>
                     {testResult.valid ? (
                       <div className="text-success font-bold text-sm mt-2 px-3 py-1 bg-success/10 rounded-lg">
                         ✅ เป็นคำนาม ใช้ได้
                       </div>
                     ) : (
                       <div className="text-danger font-bold text-sm mt-2 px-3 py-1 bg-danger/10 rounded-lg">
                         ❌ {testResult.reason}
                       </div>
                     )}
                  </div>
                )}
              </div>
            </div>
         </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </div>
  );
}
