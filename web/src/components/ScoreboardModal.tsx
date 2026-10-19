import { Trophy, X, Flame } from 'lucide-react';
import type { Player } from '../store/gameStore';

interface ScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Record<string, Player>;
  myUid: string | null;
}

export default function ScoreboardModal({ isOpen, onClose, players, myUid }: ScoreboardModalProps) {
  if (!isOpen) return null;

  // Sort players: alive first, then by match score desc, then total wins desc
  const sortedPlayers = Object.values(players).sort((a, b) => {
    // 1. Alive before dead
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    // 2. Score in match
    const scoreA = a.score || 0;
    const scoreB = b.score || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    // 3. Overall wins
    const winsA = a.wins || 0;
    const winsB = b.wins || 0;
    return winsB - winsA;
  });

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

                  {/* Name & Match Score */}
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

                  {/* Stats (Wins, Games, Win Rate) */}
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-xs text-muted font-medium">ชนะ / ทั้งหมด</div>
                      <div className="text-sm font-bold text-main">
                        <span className="text-warning">{p.wins || 0}</span> / {p.gamesPlayed || 0}
                      </div>
                    </div>

                    <div className="w-16">
                      <div className="text-xs text-muted font-medium">Win Rate</div>
                      <div className="text-sm font-black text-primary">
                        {winRate}%
                      </div>
                    </div>
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
