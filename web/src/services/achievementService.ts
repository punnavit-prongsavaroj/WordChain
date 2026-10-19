import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

export interface Achievement {
  id: string;
  threshold: number;
  title: string;
  description: string;
  icon: string;
  badgeColor: string; // Tailwind color styling
  borderGradient: string;
}

export const DEFAULT_TITLE = 'ผู้ฝึกต่อคำ';

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'tier_100',
    threshold: 100,
    title: 'นักสะสมคำฝึกหัด',
    description: 'ก้าวแรกสู่โลกแห่งภาษา สะสมคำศัพท์ครบ 100 คำ',
    icon: '🥉',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    borderGradient: 'from-amber-600 to-yellow-500'
  },
  {
    id: 'tier_500',
    threshold: 500,
    title: 'ผู้เชี่ยวชาญถ้อยคำ',
    description: 'คลังคำศัพท์เริ่มกว้างขวาง สะสมคำศัพท์ครบ 500 คำ',
    icon: '🥉',
    badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    borderGradient: 'from-amber-500 to-yellow-400'
  },
  {
    id: 'tier_1000',
    threshold: 1000,
    title: 'พจนานุกรมเดินได้',
    description: 'จดจำคำศัพท์ได้นับพันคำ สะสมคำศัพท์ครบ 1,000 คำ',
    icon: '🥈',
    badgeColor: 'text-slate-300 bg-slate-300/10 border-slate-300/30',
    borderGradient: 'from-slate-400 to-slate-200'
  },
  {
    id: 'tier_2000',
    threshold: 2000,
    title: 'ปราชญ์ภาษา',
    description: 'ผู้รอบรู้ลึกซึ้งในความหมาย สะสมคำศัพท์ครบ 2,000 คำ',
    icon: '🥈',
    badgeColor: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
    borderGradient: 'from-teal-500 to-emerald-400'
  },
  {
    id: 'tier_3000',
    threshold: 3000,
    title: 'เจ้าบทเจ้ากลอน',
    description: 'วาจาไพเราะ ไหลลื่นทุกการต่อคำ สะสมคำศัพท์ครบ 3,000 คำ',
    icon: '🥈',
    badgeColor: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
    borderGradient: 'from-cyan-500 to-blue-400'
  },
  {
    id: 'tier_4000',
    threshold: 4000,
    title: 'มหาบัณฑิตวจี',
    description: 'ปัญญาเฉียบแหลม เชี่ยวชาญทุกศาสตร์คำ สะสมคำศัพท์ครบ 4,000 คำ',
    icon: '🥇',
    badgeColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    borderGradient: 'from-yellow-500 to-amber-300'
  },
  {
    id: 'tier_5000',
    threshold: 5000,
    title: 'เซียนคำไร้พ่าย',
    description: 'เซียนผู้ต่อคำได้ไม่มีสะดุด สะสมคำศัพท์ครบ 5,000 คำ',
    icon: '🥇',
    badgeColor: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    borderGradient: 'from-orange-500 to-amber-400'
  },
  {
    id: 'tier_10000',
    threshold: 10000,
    title: 'เทพอักษร',
    description: 'หนึ่งหมื่นคำในกำมือ บัญชาคำศัพท์ดั่งเทพ สะสมคำศัพท์ครบ 10,000 คำ',
    icon: '💎',
    badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    borderGradient: 'from-blue-600 to-indigo-400'
  },
  {
    id: 'tier_20000',
    threshold: 20000,
    title: 'จอมยุทธ์ร้อยพจนานุกรม',
    description: 'ท่องยุทธภพแห่งคำศัพท์ไร้ผู้เทียมทาน สะสมคำศัพท์ครบ 20,000 คำ',
    icon: '💎',
    badgeColor: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
    borderGradient: 'from-indigo-600 to-purple-400'
  },
  {
    id: 'tier_30000',
    threshold: 30000,
    title: 'ผู้รู้แจ้งแห่งภาษา',
    description: 'บรรลุแก่นแท้แห่งถ้อยคำและภาษา สะสมคำศัพท์ครบ 30,000 คำ',
    icon: '👑',
    badgeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    borderGradient: 'from-purple-600 to-pink-400'
  },
  {
    id: 'tier_40000',
    threshold: 40000,
    title: 'ปรมาจารย์วจีสวรรค์',
    description: 'เสกคำศัพท์ได้ดั่งเวทมนตร์ สะสมคำศัพท์ครบ 40,000 คำ',
    icon: '👑',
    badgeColor: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
    borderGradient: 'from-pink-600 to-rose-400'
  },
  {
    id: 'tier_50000',
    threshold: 50000,
    title: 'ตำนานวจีพิภพ',
    description: 'หนึ่งในผู้ครอบครองพจนานุกรมทั้งโลก สะสมคำศัพท์ครบ 50,000 คำ',
    icon: '🌟',
    badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
    borderGradient: 'from-rose-600 to-amber-400'
  },
  {
    id: 'tier_100000',
    threshold: 100000,
    title: 'ราชันเจ้าปัญญา',
    description: 'จุดสูงสุดแห่งปัญญา ปรมาจารย์ผู้ครอบครองหนึ่งแสนคำ',
    icon: '🏆',
    badgeColor: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/40 ring-1 ring-yellow-300/40',
    borderGradient: 'from-yellow-400 via-amber-300 to-yellow-500'
  }
];

export const getHighestTitle = (wordCount: number): string => {
  let highest = DEFAULT_TITLE;
  for (const ach of ACHIEVEMENTS) {
    if (wordCount >= ach.threshold) {
      highest = ach.title;
    }
  }
  return highest;
};

export const getNextAchievement = (wordCount: number): { next: Achievement | null; progress: number; current: Achievement | null } => {
  let current: Achievement | null = null;
  let next: Achievement | null = null;

  for (const ach of ACHIEVEMENTS) {
    if (wordCount >= ach.threshold) {
      current = ach;
    } else if (!next) {
      next = ach;
    }
  }

  if (!next) {
    return { next: null, progress: 100, current };
  }

  const prevThreshold = current ? current.threshold : 0;
  const progress = Math.min(100, Math.max(0, Math.round(((wordCount - prevThreshold) / (next.threshold - prevThreshold)) * 100)));

  return { next, progress, current };
};

// In-memory cache for user's dictionary during session
const dictionaryCache: Record<string, Set<string>> = {};

export const getPlayerDictionary = async (uid: string): Promise<string[]> => {
  try {
    if (dictionaryCache[uid]) {
      return Array.from(dictionaryCache[uid]);
    }
    const dictDoc = await getDoc(doc(db, 'users', uid, 'meta', 'dictionary'));
    if (dictDoc.exists()) {
      const words: string[] = dictDoc.data().words || [];
      dictionaryCache[uid] = new Set(words);
      return words;
    }
  } catch (error) {
    console.error('Error fetching player dictionary:', error);
  }
  return [];
};

export const addWordToDictionary = async (
  uid: string,
  rawWord: string
): Promise<{
  isNewWord: boolean;
  newCount: number;
  newTitle: string;
  unlockedAchievement: Achievement | null;
}> => {
  const word = rawWord.trim();
  if (!word) {
    return { isNewWord: false, newCount: 0, newTitle: DEFAULT_TITLE, unlockedAchievement: null };
  }

  // Ensure cache is loaded
  if (!dictionaryCache[uid]) {
    await getPlayerDictionary(uid);
  }

  const userCache = dictionaryCache[uid] || new Set();

  if (userCache.has(word)) {
    // Already in dictionary
    const currentCount = userCache.size;
    return {
      isNewWord: false,
      newCount: currentCount,
      newTitle: getHighestTitle(currentCount),
      unlockedAchievement: null
    };
  }

  // New word!
  userCache.add(word);
  dictionaryCache[uid] = userCache;

  const newCount = userCache.size;
  const oldTitle = getHighestTitle(newCount - 1);
  const newTitle = getHighestTitle(newCount);

  let unlockedAchievement: Achievement | null = null;
  for (const ach of ACHIEVEMENTS) {
    if (newCount === ach.threshold) {
      unlockedAchievement = ach;
      break;
    }
  }

  try {
    // 1. Add to dictionary document
    const dictRef = doc(db, 'users', uid, 'meta', 'dictionary');
    await setDoc(dictRef, {
      words: arrayUnion(word),
      updatedAt: Date.now()
    }, { merge: true });

    // 2. Update user profile wordCount and title
    const userRef = doc(db, 'users', uid);
    const updates: any = {
      wordCount: newCount,
      updatedAt: Date.now()
    };
    if (newTitle !== oldTitle) {
      updates.title = newTitle;
    }

    await updateDoc(userRef, updates).catch(async (e: any) => {
      if (e.code === 'not-found') {
        await setDoc(userRef, { uid, wordCount: newCount, title: newTitle }, { merge: true });
      }
    });
  } catch (err) {
    console.error('Error saving word to dictionary:', err);
  }

  return {
    isNewWord: true,
    newCount,
    newTitle,
    unlockedAchievement
  };
};

export const equipPlayerTitle = async (uid: string, title: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      title,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error('Error equipping title:', err);
  }
};
