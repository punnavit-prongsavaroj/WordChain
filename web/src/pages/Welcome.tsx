import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Mic } from 'lucide-react';

export default function Welcome() {
  const [name, setNameInput] = useState('');
  const setMyName = useGameStore(state => state.setMyName);

  const handleStart = () => {
    if (!name.trim()) return;
    setMyName(name.trim());
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
      <div className="text-center mb-10 flex flex-col items-center">
        <div className="bg-primary/20 p-4 rounded-full mb-6">
           <Mic className="w-12 h-12 text-primary animate-pulse" />
        </div>
        <h1 className="text-5xl font-extrabold text-main mb-2 tracking-tight">Word Chain Voice</h1>
        <p className="text-lg text-muted font-medium">ต่อคำให้ทัน แถให้รอด!</p>
      </div>

      <div className="w-full max-w-sm bg-elevated p-8 rounded-[20px] shadow-2xl border border-border">
        <label className="block text-muted font-bold mb-3 text-lg">
          คุณชื่ออะไร?
        </label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          className="w-full px-4 py-4 rounded-[16px] bg-surface border border-border text-main placeholder-muted focus:ring-2 focus:ring-primary outline-none transition-all text-lg mb-6"
          placeholder="เช่น สมชาย"
          autoFocus
        />

        <button 
          onClick={handleStart}
          disabled={!name.trim()}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-[16px] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/20"
        >
          เข้าสู่เกม
        </button>
      </div>
    </div>
  );
}
