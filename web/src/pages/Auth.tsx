import { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { useGameStore } from '../store/gameStore';
import { getUserProfile, saveUserProfile } from '../services/userService';
import { Mic, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const setMyUid = useGameStore(state => state.setMyUid);
  const setMyName = useGameStore(state => state.setMyName);
  const setMyPhotoURL = useGameStore(state => state.setMyPhotoURL);
  const setMyEmail = useGameStore(state => state.setMyEmail);

  // Sync user profile after successful login
  const handleAuthSuccess = async (user: any, customName?: string) => {
    setMyUid(user.uid);
    setMyEmail(user.email || null);

    // Check if user already has an existing profile in Firestore
    const existing = await getUserProfile(user.uid);
    if (existing) {
      setMyName(existing.name || user.displayName || 'ผู้เล่น');
      setMyPhotoURL(existing.photoURL || user.photoURL || null);
    } else {
      const initialName = customName || user.displayName || 'ผู้เล่น';
      const initialPhoto = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid.slice(0, 5)}`;
      
      await saveUserProfile(user.uid, {
        name: initialName,
        email: user.email || '',
        photoURL: initialPhoto,
      });

      setMyName(initialName);
      setMyPhotoURL(initialPhoto);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await handleAuthSuccess(result.user);
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, do nothing
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('กรุณาเปิดใช้งาน Google Sign-In ใน Firebase Console (Authentication > Sign-in method > Google)');
      } else {
        setError(err.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    if (isRegister && !displayName.trim()) {
      setError('กรุณากรอกชื่อของคุณ');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCred.user, { displayName: displayName.trim() });
        await handleAuthSuccess(userCred.user, displayName.trim());
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await handleAuthSuccess(userCred.user);
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('กรุณาเปิดใช้งาน Email/Password ใน Firebase Console (Authentication > Sign-in method > Email/Password)');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ');
      } else if (err.code === 'auth/weak-password') {
        setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      } else if (err.code === 'auth/invalid-email') {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 bg-background min-h-screen">
      {/* Brand Header */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="bg-primary/20 p-4 rounded-full mb-4 shadow-lg ring-4 ring-primary/10">
          <Mic className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-main tracking-tight mb-2">
          Word Chain Voice
        </h1>
        <p className="text-muted text-base md:text-lg font-medium">
          ต่อคำให้ทัน แถให้รอด! เล่นสนุกกับเพื่อนแบบ Real-time
        </p>
      </div>

      <div className="w-full max-w-md bg-elevated p-8 rounded-[28px] shadow-2xl border border-border">
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm font-bold p-4 rounded-2xl mb-6 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-6 rounded-[18px] border border-gray-200 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 text-base mb-6"
        >
          {googleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{googleLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยบัญชี Google'}</span>
        </button>

        {/* Divider */}
        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink mx-4 text-xs font-bold text-muted uppercase tracking-wider">
            หรือใช้อีเมล
          </span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                ชื่อที่ใช้ในเกม
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="เช่น สมชาย สายแถ"
                className="w-full px-4 py-3 rounded-[16px] bg-surface border border-border text-main placeholder-muted text-sm font-medium focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              อีเมล
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              required
              className="w-full px-4 py-3 rounded-[16px] bg-surface border border-border text-main placeholder-muted text-sm font-medium focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-[16px] bg-surface border border-border text-main placeholder-muted text-sm font-medium focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-[16px] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 text-base mt-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{isRegister ? 'สร้างบัญชีผู้ใช้' : 'เข้าสู่ระบบ'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle between Login and Register */}
        <div className="mt-6 text-center text-sm font-medium text-muted">
          {isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="ml-2 text-primary font-bold hover:underline"
          >
            {isRegister ? 'เข้าสู่ระบบที่นี่' : 'สมัครสมาชิกฟรี'}
          </button>
        </div>
      </div>
    </div>
  );
}
