import { useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { updateCurrentProfile } from '../services/userService';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { X, Check, Upload, User, Sparkles, RotateCcw, LogOut, Mail, Edit3, Loader2 } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Preset avatars from popular DiceBear collections
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cosmo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Sparky',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zack',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Happy',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cool',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Fire',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Mia',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Leo',
  'https://api.dicebear.com/7.x/thumbs/svg?seed=Victory',
];

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const myName = useGameStore(state => state.myName);
  const myPhotoURL = useGameStore(state => state.myPhotoURL);
  const myEmail = useGameStore(state => state.myEmail);
  const myWins = useGameStore(state => state.myWins);
  const myGamesPlayed = useGameStore(state => state.myGamesPlayed);
  const resetStore = useGameStore(state => state.reset);

  const [name, setName] = useState(myName || '');
  const [selectedPhoto, setSelectedPhoto] = useState<string>(myPhotoURL || PRESET_AVATARS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle local image file upload & resize to lightweight Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to 160x160 using HTML5 Canvas for super lightweight storage
        const canvas = document.createElement('canvas');
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Center crop
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setSelectedPhoto(compressedDataUrl);
          setError('');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('กรุณากรอกชื่อของคุณ');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await updateCurrentProfile(name.trim(), selectedPhoto);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToGoogle = () => {
    const googlePhoto = auth.currentUser?.photoURL;
    if (googlePhoto) {
      setSelectedPhoto(googlePhoto);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      resetStore();
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-elevated border border-border w-full max-w-lg rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-black text-main">โปรไฟล์ผู้เล่น</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted hover:text-main rounded-full hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm font-bold p-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Current Avatar & Name Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-5 bg-surface p-5 rounded-[22px] border border-border">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/40 shadow-lg bg-background flex items-center justify-center">
                {selectedPhoto ? (
                  <img src={selectedPhoto} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-primary">{name.charAt(0).toUpperCase() || '?'}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-xs font-bold"
                title="เปลี่ยนรูปภาพ"
              >
                <Upload className="w-5 h-5 mb-1" />
                อัปโหลด
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="text-xl font-bold text-main">{name || 'ยังไม่ได้ตั้งชื่อ'}</div>
              {myEmail && (
                <div className="text-xs text-muted font-medium flex items-center justify-center sm:justify-start gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {myEmail}
                </div>
              )}
              <div className="text-xs text-primary font-bold pt-1">
                {selectedPhoto.startsWith('data:') ? 'รูปที่คุณอัปโหลดเอง' : 'อวตารของระบบ'}
              </div>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-3 bg-surface p-4 rounded-[20px] border border-border text-center">
            <div className="bg-background/50 p-2.5 rounded-[14px] border border-border/50">
              <div className="text-xs text-muted font-bold mb-1">🏆 ชนะ</div>
              <div className="text-lg font-black text-warning">{myWins} ครั้ง</div>
            </div>
            <div className="bg-background/50 p-2.5 rounded-[14px] border border-border/50">
              <div className="text-xs text-muted font-bold mb-1">🎮 ทั้งหมด</div>
              <div className="text-lg font-black text-main">{myGamesPlayed} เกม</div>
            </div>
            <div className="bg-background/50 p-2.5 rounded-[14px] border border-border/50">
              <div className="text-xs text-muted font-bold mb-1">📊 Win Rate</div>
              <div className="text-lg font-black text-primary">
                {myGamesPlayed ? Math.round((myWins / myGamesPlayed) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Edit Name Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-main flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-primary" />
              ชื่อที่ใช้ในเกม
            </label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="กรอกชื่อของคุณ"
              maxLength={20}
              className="w-full px-4 py-3.5 rounded-[16px] bg-surface border border-border text-main font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          {/* Choose Avatar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-main flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-warning" />
                เลือกรูปโปรไฟล์
              </label>
              
              <div className="flex gap-2">
                {auth.currentUser?.photoURL && (
                  <button
                    type="button"
                    onClick={handleResetToGoogle}
                    className="text-xs text-muted hover:text-primary font-bold flex items-center gap-1 bg-surface px-2.5 py-1 rounded-lg border border-border transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    ใช้รูป Google
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary font-bold flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  อัปโหลดรูป
                </button>
              </div>
            </div>

            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Avatar Preset Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 p-3 bg-surface rounded-[20px] border border-border max-h-48 overflow-y-auto">
              {PRESET_AVATARS.map((url, idx) => {
                const isSelected = selectedPhoto === url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhoto(url)}
                    className={`relative aspect-square rounded-2xl p-1 transition-all overflow-hidden border-2 ${
                      isSelected 
                        ? 'border-primary ring-2 ring-primary/40 scale-105 bg-primary/20' 
                        : 'border-transparent hover:border-border hover:bg-background/50'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover rounded-xl" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5 shadow">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-between gap-3 bg-surface/50">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-danger hover:bg-danger/10 px-4 py-3 rounded-[14px] text-sm font-bold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-[14px] border border-border text-muted hover:text-main font-bold text-sm transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-3 rounded-[14px] text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {success ? 'บันทึกแล้ว!' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
