import { useState, useMemo } from 'react';
import { Trophy, X, Flame, BookOpen, Percent } from 'lucide-react';
import type { Player } from '../store/gameStore';

interface ScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Record<string, Player>;
  myUid: string | null;
}

type ScoreboardTab = 'match' | 'wins' | 'words' | 'winrate';

export default function ScoreboardModal({ isOpen, onClose, players, myUid }: ScoreboardModalProps) {
  const [tab, setTab] = useState<ScoreboardTab>('match');

  const sortedPlayers = useMemo(() => {
    const list = Object.values(players);
    if (tab === 'match') {
      return list.sort((a, b) => {
        if (a.alive !== b.alive) return a.alive ? -1 : 1;
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.wins || 0) - (a.wins || 0);
      });
    }
    if (tab === 'wins') {
      return list.sort((a, b) => {
        const winsA = a.wins || 0;
        const winsB = b.wins || 0;
        if (winsB !== winsA) return winsB - winsA;
        return (b.score || 0) - (a.score || 0);
      });
    }
    if (tab === 'words') {
      return list.sort((a, b) => {
        const wordsA = a.wordCount || 0;
        const wordsB = b.wordCount || 0;
        if (wordsB !== wordsA) return wordsB - wordsA;
        return (b.wins || 0) - (a.wins || 0);
      });
    }
    if (tab === 'winrate') {
      return list.sort((a, b) => {
        const rateA = a.gamesPlayed ? ((a.wins || 0) / a.gamesPlayed) : 0;
        const rateB = b.gamesPlayed ? ((b.wins || 0) / b.gamesPlayed) : 0;
        if (Math.abs(rateB - rateA) > 0.0001) return rateB - rateA;
        if ((b.gamesPlayed || 0) !== (a.gamesPlayed || 0)) return (b.gamesPlayed || 0) - (a.gamesPlayed || 0);
        return (b.wins || 0) - (a.wins || 0);
      });
    }
    return list;
  }, [players, tab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-elevated border border-border w-full max-w-2xl rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="bg-warning/20 p-2.5 rounded-2xl text-warning">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-main">กระดานคะแนน (Scoreboard)</h2>
              <p className="text-xs text-muted font-medium">อันดับผู้เล่นและสถิติในห้องนี้</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted hover:text-main rounded-full hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 mx-6 mt-4 bg-surface rounded-[16px] border border-border">
          <button
            onClick={() => setTab('match')}
            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              tab === 'match'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-main hover:bg-elevated'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>รอบนี้</span>
          </button>

          <button
            onClick={() => setTab('wins')}
            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              tab === 'wins'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-main hover:bg-elevated'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>จำนวนชนะ</span>
          </button>

          <button
            onClick={() => setTab('words')}
            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              tab === 'words'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-main hover:bg-elevated'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>จำนวนคำ</span>
          </button>

          <button
            onClick={() => setTab('winrate')}
            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              tab === 'winrate'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-main hover:bg-elevated'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Win Rate</span>
          </button>
        </div>

        {/* Player List Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-3">
            {sortedPlayers.map((p, index) => {
              const isMe = p.uid === myUid;
              const winRate = p.gamesPlayed ? Math.round(((p.wins || 0) / p.gamesPlayed) * 100) : 0;
              
              return (
                <div 
                  key={p.uid}
                  className={`p-4 rounded-[20px] border transition-all flex items-center gap-4 ${
                    isMe 
                      ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30' 
                      : (p.alive ? 'bg-surface border-border' : 'bg-surface/50 border-border/50 opacity-60')
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 flex items-center justify-center font-black text-lg">
                    {index === 0 && <span className="text-2xl" title="อันดับ 1">🥇</span>}
                    {index === 1 && <span className="text-2xl" title="อันดับ 2">🥈</span>}
                    {index === 2 && <span className="text-2xl" title="อันดับ 3">🥉</span>}
                    {index > 2 && <span className="text-muted text-base">#{index + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center border-2 border-border flex-shrink-0">
                    {p.photoURL ? (
                      <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-primary text-xl">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name & Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-main text-base truncate">{p.name}</span>
                      {isMe && <span className="text-primary text-xs font-bold">(คุณ)</span>}
                      <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                        🎖️ {p.title || 'ผู้ฝึกต่อคำ'}
                      </span>
                      {!p.alive && !p.isSpectator && (
                        <span className="text-[10px] bg-danger/20 text-danger px-2 py-0.5 rounded-full font-bold">ตกรอบ</span>
                      )}
                      {p.isSpectator && (
                        <span className="text-[10px] bg-muted/20 text-muted px-2 py-0.5 rounded-full font-bold">ผู้ชม</span>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-success font-bold flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" />
                        ต่อได้ {p.score || 0} คำ
                      </span>
                      <span>•</span>
                      <span className="text-primary font-bold">
                        📖 คลังศัพท์ {p.wordCount || 0} คำ
                      </span>
                    </div>
                  </div>

                  {/* Stats based on active tab */}
                  <div className="flex items-center gap-4 text-right flex-shrink-0">
                    {tab === 'match' && (
                      <>
                        <div>
                          <div className="text-xs text-muted font-medium">รอบนี้</div>
                          <div className="text-sm font-bold text-success flex items-center justify-end gap-1">
                            <Flame className="w-3.5 h-3.5" /> {p.score || 0} คำ
                          </div>
                        </div>
                        <div className="w-16">
                          <div className="text-xs text-muted font-medium">ชนะรวม</div>
                          <div className="text-sm font-bold text-warning">{p.wins || 0}</div>
                        </div>
                      </>
                    )}
                    {tab === 'wins' && (
                      <>
                        <div>
                          <div className="text-xs text-muted font-medium">ชนะ / ทั้งหมด</div>
                          <div className="text-sm font-bold text-main">
                            <span className="text-warning font-black">{p.wins || 0}</span> / {p.gamesPlayed || 0}
                          </div>
                        </div>
                        <div className="w-16">
                          <div className="text-xs text-muted font-medium">Win Rate</div>
                          <div className="text-sm font-black text-primary">{winRate}%</div>
                        </div>
                      </>
                    )}
                    {tab === 'words' && (
                      <>
                        <div>
                          <div className="text-xs text-muted font-medium">คลังคำศัพท์</div>
                          <div className="text-sm font-black text-success flex items-center justify-end gap-1">
                            <BookOpen className="w-3.5 h-3.5" /> {(p.wordCount || 0).toLocaleString()} คำ
                          </div>
                        </div>
                        <div className="w-16">
                          <div className="text-xs text-muted font-medium">รอบนี้</div>
                          <div className="text-sm font-bold text-main">{p.score || 0} คำ</div>
                        </div>
                      </>
                    )}
                    {tab === 'winrate' && (
                      <>
                        <div>
                          <div className="text-xs text-muted font-medium">ชนะ / ทั้งหมด</div>
                          <div className="text-sm font-bold text-main">
                            <span className="text-warning">{p.wins || 0}</span> / {p.gamesPlayed || 0}
                          </div>
                        </div>
                        <div className="w-16">
                          <div className="text-xs text-muted font-medium">Win Rate</div>
                          <div className="text-sm font-black text-primary">{winRate}%</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-[14px] bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all shadow-md"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
