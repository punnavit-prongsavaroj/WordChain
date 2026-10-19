import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useGameStore } from './store/gameStore';
import { getUserProfile } from './services/userService';
import { getHighestTitle, DEFAULT_TITLE } from './services/achievementService';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDashboard, setIsDashboard] = useState<boolean>(() => {
    return window.location.hash === '#admin' || window.location.hash === '#/admin' || window.location.hash === '#dashboard';
  });

  const status = useGameStore(state => state.status);
  const roomId = useGameStore(state => state.roomId);
  const setMyUid = useGameStore(state => state.setMyUid);
  const setMyName = useGameStore(state => state.setMyName);
  const setMyPhotoURL = useGameStore(state => state.setMyPhotoURL);
  const setMyEmail = useGameStore(state => state.setMyEmail);
  const setMyStats = useGameStore(state => state.setMyStats);
  const setMyWordStats = useGameStore(state => state.setMyWordStats);

  useEffect(() => {
    const handleHash = () => {
      setIsDashboard(
        window.location.hash === '#admin' ||
        window.location.hash === '#/admin' ||
        window.location.hash === '#dashboard'
      );
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setMyUid(user.uid);
        setMyEmail(user.email || null);

        // Fetch user's persistent profile from Firestore
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setMyName(profile.name || user.displayName || 'ผู้เล่น');
          setMyStats(profile.wins || 0, profile.gamesPlayed || 0);
          setMyWordStats(profile.wordCount || 0, profile.title || getHighestTitle(profile.wordCount || 0));
          if (profile.photoURL) {
            setMyPhotoURL(profile.photoURL);
          } else if (user.photoURL) {
            setMyPhotoURL(user.photoURL);
          }
        } else {
          setMyName(user.displayName || 'ผู้เล่น');
          setMyStats(0, 0);
          setMyWordStats(0, DEFAULT_TITLE);
          if (user.photoURL) setMyPhotoURL(user.photoURL);
        }
      } else {
        setCurrentUser(null);
        setMyUid(null);
        setMyName(null);
        setMyPhotoURL(null);
        setMyEmail(null);
        setMyWordStats(0, DEFAULT_TITLE);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [setMyUid, setMyName, setMyPhotoURL, setMyEmail, setMyStats, setMyWordStats]);

  useEffect(() => {
    if (roomId && isAuthReady && currentUser) {
      import('./services/roomService').then(({ subscribeToRoom }) => {
        subscribeToRoom(roomId);
      });
    }
  }, [roomId, isAuthReady, currentUser]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted font-bold animate-pulse">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  // Not logged in -> Show Google & Email Auth page
  if (!currentUser) {
    return <Auth />;
  }

  // Admin / Analytics Dashboard
  if (isDashboard) {
    return (
      <AdminDashboard
        onBack={() => {
          window.location.hash = '';
          setIsDashboard(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-main">
      <div className="max-w-6xl mx-auto min-h-screen bg-surface md:shadow-2xl relative flex flex-col md:border-x border-border">
        {!roomId && <Home />}
        {roomId && status === 'lobby' && <Lobby />}
        {roomId && (status === 'playing' || status === 'challenge' || status === 'finished') && <Game />}
      </div>
    </div>
  );
}

export default App;
