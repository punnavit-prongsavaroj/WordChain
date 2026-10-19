import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { 
  ACHIEVEMENTS, 
  getNextAchievement, 
  getPlayerDictionary, 
  equipPlayerTitle,
  DEFAULT_TITLE 
} from '../services/achievementService';
import { BookOpen, Trophy, X, Search, Check, Lock, Sparkles, Loader2 } from 'lucide-react';

interface DictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DictionaryModal({ isOpen, onClose }: DictionaryModalProps) {
  const myUid = useGameStore(state => state.myUid);
  const myWordCount = useGameStore(state => state.myWordCount);
  const myTitle = useGameStore(state => state.myTitle);
  const setMyWordStats = useGameStore(state => state.setMyWordStats);

  const [activeTab, setActiveTab] = useState<'dictionary' | 'achievements'>('dictionary');
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [equippingTitle, setEquippingTitle] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && myUid) {
      setLoading(true);
      getPlayerDictionary(myUid)
        .then((dict) => {
          setWords(dict);
          // Sync actual word count if different
          if (dict.length !== myWordCount) {
            setMyWordStats(dict.length);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, myUid, myWordCount, setMyWordStats]);

  const { next, progress, current } = useMemo(() => {
    return getNextAchievement(myWordCount);
  }, [myWordCount]);

  const filteredWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return words;
    return words.filter(w => w.toLowerCase().includes(q));
  }, [words, searchQuery]);

  const handleEquipTitle = async (title: string) => {
    if (!myUid || myTitle === title) return;
    setEquippingTitle(title);
    try {
      await equipPlayerTitle(myUid, title);
      setMyWordStats(myWordCount, title);
    } catch (e) {
      console.error(e);
    } finally {
      setEquippingTitle(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-elevated border border-border w-full max-w-2xl rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2.5 rounded-2xl text-primary">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-main">พจนานุกรม & ฉายา</h2>
              <p className="text-xs text-muted font-medium">คลังคำศัพท์สะสมและฉายาเกียรติยศของคุณ</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted hover:text-main rounded-full hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-surface/30 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'dictionary'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            คลังคำศัพท์ ({myWordCount} คำ)
          </button>

          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'achievements'
                ? 'border-warning text-warning'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            <Trophy className="w-4 h-4" />
            ฉายา & ความสำเร็จ
          </button>
        </div>

        {/* Tab 1: Dictionary Content */}
        {activeTab === 'dictionary' && (
          <div className="p-6 overflow-y-auto flex-1 flex flex-col">
            {/* Search Box */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาคำศัพท์ในพจนานุกรมของคุณ..."
                className="w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-[16px] text-main placeholder-muted text-sm font-medium focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-main bg-elevated px-2 py-1 rounded-md"
                >
                  ล้าง
                </button>
              )}
            </div>

            {/* Word Count Indicator */}
            <div className="flex items-center justify-between text-xs text-muted font-bold mb-3 px-1">
              <span>พบ {filteredWords.length} คำ {searchQuery && `(จากทั้งหมด ${words.length} คำ)`}</span>
              <span className="text-primary">ฉายาปัจจุบัน: {myTitle || DEFAULT_TITLE}</span>
            </div>

            {/* Words Container */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                <span className="text-sm font-bold">กำลังเปิดหน้าพจนานุกรม...</span>
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-muted bg-surface/40 rounded-2xl border border-dashed border-border p-6">
                <BookOpen className="w-12 h-12 text-muted/40 mb-3" />
                <div className="text-base font-bold text-main mb-1">
                  {searchQuery ? 'ไม่พบคำศัพท์ที่ค้นหา' : 'ยังไม่มีคำศัพท์ในพจนานุกรม'}
                </div>
                <p className="text-xs text-muted max-w-sm">
                  {searchQuery 
                    ? 'ลองค้นหาด้วยคำอื่น หรือเล่นเกมเพื่อสะสมคำศัพท์เพิ่ม' 
                    : 'เมื่อคุณต่อคำสำเร็จในเกม คำศัพท์จะถูกบันทึกเข้าพจนานุกรมส่วนตัวของคุณอัตโนมัติ!'}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[380px] p-1">
                {filteredWords.map((word, index) => (
                  <div
                    key={`${word}-${index}`}
                    className="bg-surface hover:bg-elevated border border-border hover:border-primary/40 px-3.5 py-1.5 rounded-xl text-sm font-bold text-main shadow-sm transition-all"
                  >
                    {word}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Achievements & Titles Content */}
        {activeTab === 'achievements' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* Current Title & Next Progress Card */}
            <div className="bg-gradient-to-br from-surface to-elevated border border-border p-5 rounded-[22px] shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-warning" />
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">ฉายาปัจจุบัน</span>
                </div>
                <div className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  {myWordCount} / 100,000 คำ
                </div>
              </div>

              <div className="text-2xl font-black text-main flex items-center gap-2 mb-3">
                <span>{current ? current.icon : '🌱'}</span>
                <span>{myTitle || DEFAULT_TITLE}</span>
              </div>

              {/* Progress to next tier */}
              {next ? (
                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-muted mb-1.5">
                    <span>ฉายาถัดไป: <strong className="text-main">{next.icon} {next.title}</strong></span>
                    <span className="text-primary">{myWordCount} / {next.threshold.toLocaleString()} คำ ({progress}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-warning transition-all duration-500 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted text-right mt-1">
                    อีก {(next.threshold - myWordCount).toLocaleString()} คำเพื่อปลดล็อก
                  </div>
                </div>
              ) : (
                <div className="bg-warning/10 border border-warning/30 text-warning text-xs font-bold p-3 rounded-xl text-center">
                  👑 คุณบรรลุจุดสูงสุดแห่งปัญญา ครอบครองทุกคำศัพท์แล้ว!
                </div>
              )}
            </div>

            {/* Achievement Tiers List */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-muted uppercase tracking-wider px-1">
                ระดับฉายาทั้งหมด ({ACHIEVEMENTS.filter(a => myWordCount >= a.threshold).length} / {ACHIEVEMENTS.length} ปลดล็อกแล้ว)
              </div>

              {ACHIEVEMENTS.map((ach) => {
                const isUnlocked = myWordCount >= ach.threshold;
                const isEquipped = myTitle === ach.title;

                return (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-[20px] border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isEquipped
                        ? 'bg-primary/10 border-primary ring-1 ring-primary/40 shadow-md'
                        : isUnlocked
                        ? 'bg-surface border-border hover:border-border/80'
                        : 'bg-surface/30 border-border/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="text-3xl p-2 bg-background/50 rounded-2xl border border-border flex items-center justify-center shrink-0">
                        {isUnlocked ? ach.icon : '🔒'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-main text-base truncate">{ach.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ach.badgeColor}`}>
                            {ach.threshold.toLocaleString()} คำ
                          </span>
                          {isEquipped && (
                            <span className="text-[10px] bg-success/20 text-success border border-success/30 px-2 py-0.5 rounded-full font-bold">
                              กำลังสวมใส่
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted font-medium mt-1 leading-relaxed">
                          {ach.description}
                        </p>
                      </div>
                    </div>

                    {/* Action / Status */}
                    <div className="self-end sm:self-center shrink-0">
                      {isUnlocked ? (
                        isEquipped ? (
                          <div className="text-xs font-bold text-success flex items-center gap-1.5 bg-success/10 px-3 py-1.5 rounded-xl border border-success/20">
                            <Check className="w-3.5 h-3.5" />
                            ใช้งานอยู่
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEquipTitle(ach.title)}
                            disabled={equippingTitle === ach.title}
                            className="text-xs font-bold text-main hover:text-primary bg-surface hover:bg-elevated border border-border hover:border-primary/40 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            {equippingTitle === ach.title ? 'กำลังสวมใส่...' : 'สวมใส่ฉายานี้'}
                          </button>
                        )
                      ) : (
                        <div className="text-xs font-bold text-muted flex items-center gap-1 bg-background/60 px-3 py-1.5 rounded-xl border border-border/50">
                          <Lock className="w-3.5 h-3.5" />
                          {myWordCount} / {ach.threshold.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
