import { useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useGameStore } from './store/gameStore';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

import Welcome from './pages/Welcome';

function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const status = useGameStore(state => state.status);
  const roomId = useGameStore(state => state.roomId);
  const setMyUid = useGameStore(state => state.setMyUid);
  const myName = useGameStore(state => state.myName);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setMyUid(user.uid);
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, [setMyUid]);

  useEffect(() => {
     if (roomId && isAuthReady) {
        import('./services/roomService').then(({ subscribeToRoom }) => {
           subscribeToRoom(roomId);
        });
     }
  }, [roomId, isAuthReady]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted font-bold animate-pulse">กำลังเชื่อมต่อระบบ...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-main">
      <div className="max-w-6xl mx-auto min-h-screen bg-surface md:shadow-2xl relative flex flex-col md:border-x border-border">
        {!myName && <Welcome />}
        {myName && !roomId && <Home />}
        {roomId && status === 'lobby' && <Lobby />}
        {roomId && (status === 'playing' || status === 'challenge' || status === 'finished') && <Game />}
      </div>
    </div>
  );
}

export default App;
