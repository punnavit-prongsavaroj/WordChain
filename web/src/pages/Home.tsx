import { useState, useRef, useEffect } from 'react';
import { createRoom, joinRoomByCode, subscribeToRoom } from '../services/roomService';
import { useGameStore } from '../store/gameStore';
import { checkWordWithAPI } from '../services/apiClient';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { Mic, Video, Copy, LogOut } from 'lucide-react';

export default function Home() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Test Feature State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{text: string, valid: boolean, reason?: string} | null>(null);
  const [testError, setTestError] = useState<string>('');
  
  // Camera Preview
  const videoRef = useRef<HTMLVideoElement>(null);

  const myUid = useGameStore(state => state.myUid);
  const myName = useGameStore(state => state.myName);
  const setMyName = useGameStore(state => state.setMyName);

  useEffect(() => {
     navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
           if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {});
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
      } catch (err) {
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
      const { roomId } = await createRoom(myUid, myName);
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
      const roomId = await joinRoomByCode(code, myUid, myName);
      subscribeToRoom(roomId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 md:p-12 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div className="font-bold text-main text-xl flex items-center gap-2">
          <Mic className="w-6 h-6 text-primary" />
          Word Chain Voice
        </div>
        <div className="flex items-center gap-4">
           <span className="text-muted font-bold text-sm hidden md:inline">สวัสดี, {myName}</span>
           <button 
             onClick={() => setMyName(null)}
             className="text-sm text-danger hover:text-danger/80 underline font-bold"
           >
             เปลี่ยนชื่อ
           </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
         {/* Left Col: Join / Create */}
         <div className="flex-1 flex flex-col">
            <div className="mb-8">
               <h1 className="text-4xl md:text-5xl font-black text-main mb-4">ต่อคำให้ทัน<br/><span className="text-primary">แถให้รอด!</span></h1>
               <p className="text-muted text-lg">เกมต่อคำด้วยเสียง ที่เพื่อนคุณพร้อมประท้วงทุกเมื่อ</p>
            </div>

            <div className="bg-elevated rounded-[24px] shadow-lg border border-border p-6 mb-6">
              
              {error && <div className="bg-danger/20 text-danger border border-danger/30 text-sm p-3 rounded-lg mb-4 font-bold">{error}</div>}

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
         </div>

         {/* Right Col: Preview & Mic Test */}
         <div className="flex-1 flex flex-col gap-6">
            {/* Camera Preview */}
            <div className="bg-elevated rounded-[24px] shadow-lg border border-border overflow-hidden relative aspect-video flex items-center justify-center bg-black">
               <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-80"></video>
               <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-white font-bold text-sm flex items-center gap-2">
                  <Video className="w-4 h-4 text-success" />
                  กล้องของคุณพร้อมแล้ว
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
    </div>
  );
}
