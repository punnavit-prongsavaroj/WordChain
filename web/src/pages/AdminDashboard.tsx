import { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';
import { getGlobalLeaderboard, type UserProfile } from '../services/userService';
import {
  ArrowLeft,
  RotateCcw,
  Download,
  Users,
  Gamepad2,
  Mic,
  BookOpen,
  Sparkles,
  Trophy,
  Search,
  CheckCircle2,
  TrendingUp,
  Brain,
  Award,
  ChevronRight,
  Lightbulb
} from 'lucide-react';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler
);

// Chart.js dark theme styling
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';

interface AdminDashboardProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'individual'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [sortBy, setSortBy] = useState<'words' | 'accuracy' | 'maxWords' | 'aiScore' | 'wins'>('words');

  // Load user data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getGlobalLeaderboard();
      setUsers(data);
      if (data.length > 0 && !selectedUid) {
        setSelectedUid(data[0].uid);
      }
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let list = users.filter(u =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return list.sort((a, b) => {
      if (sortBy === 'words') return (b.wordCount || 0) - (a.wordCount || 0);
      if (sortBy === 'wins') return (b.wins || 0) - (a.wins || 0);
      if (sortBy === 'maxWords') return (b.maxWordsInMatch || 0) - (a.maxWordsInMatch || 0);
      if (sortBy === 'accuracy') {
        const accA = a.speechAttempts ? ((a.speechSuccesses || 0) / a.speechAttempts) : 0;
        const accB = b.speechAttempts ? ((b.speechSuccesses || 0) / b.speechAttempts) : 0;
        return accB - accA;
      }
      if (sortBy === 'aiScore') {
        const scoreA = a.aiJudgedCount ? ((a.totalAiScore || 0) / a.aiJudgedCount) : 0;
        const scoreB = b.aiJudgedCount ? ((b.totalAiScore || 0) / b.aiJudgedCount) : 0;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [users, searchQuery, sortBy]);

  // Selected single user
  const selectedUser = useMemo(() => {
    return users.find(u => u.uid === selectedUid) || users[0] || null;
  }, [users, selectedUid]);

  // Overall Cohort Aggregations
  const cohortMetrics = useMemo(() => {
    const totalUsers = users.length;
    if (totalUsers === 0) {
      return {
        totalUsers: 0,
        totalGames: 0,
        avgAccuracy: 0,
        avgFirstPass: 0,
        avgWords: 0,
        avgMaxWords: 0,
        avgAiScore: 0,
        totalWordsRecalled: 0
      };
    }

    const totalGames = users.reduce((acc, u) => acc + (u.gamesPlayed || 0), 0);
    const totalWords = users.reduce((acc, u) => acc + (u.wordCount || 0), 0);
    const totalMatchWords = users.reduce((acc, u) => acc + (u.totalMatchWords || 0), 0);

    // Pronunciation accuracy
    const totalAttempts = users.reduce((acc, u) => acc + (u.speechAttempts || 0), 0);
    const totalSuccesses = users.reduce((acc, u) => acc + (u.speechSuccesses || 0), 0);
    const avgAccuracy = totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : 0;

    // First pass rate
    const totalTurns = users.reduce((acc, u) => acc + (u.speechTurns || 0), 0);
    const totalFirstPass = users.reduce((acc, u) => acc + (u.firstPassCount || 0), 0);
    const avgFirstPass = totalTurns > 0 ? Math.round((totalFirstPass / totalTurns) * 100) : 0;

    // Max words in match
    const avgMaxWords = Math.round(users.reduce((acc, u) => acc + (u.maxWordsInMatch || 0), 0) / totalUsers);

    // AI Semantic score
    const totalAiScore = users.reduce((acc, u) => acc + (u.totalAiScore || 0), 0);
    const totalAiJudged = users.reduce((acc, u) => acc + (u.aiJudgedCount || 0), 0);
    const avgAiScore = totalAiJudged > 0 ? +(totalAiScore / totalAiJudged).toFixed(1) : 0;

    return {
      totalUsers,
      totalGames,
      avgAccuracy,
      avgFirstPass,
      avgWords: Math.round(totalWords / totalUsers),
      avgMaxWords,
      avgAiScore,
      totalWordsRecalled: totalMatchWords
    };
  }, [users]);

  // Export CSV Function (UTF-8 with BOM for Excel)
  const exportToCSV = () => {
    if (users.length === 0) return;

    const headers = [
      'UID',
      'ชื่อผู้เล่น',
      'อีเมล',
      'ฉายา',
      'เกมที่เล่นทั้งหมด',
      'ชนะ (ครั้ง)',
      'อัตราการชนะ (Win Rate %)',
      'คลังคำศัพท์สะสม (คำ)',
      'คำสูงสุดใน 1 ตา (คำ)',
      'คำทั้งหมดที่พูดในเกม (คำ)',
      'ความแม่นยำการออกเสียง (%)',
      'อัตราพูดรอบเดียวผ่าน (%)',
      'จำนวนครั้งที่พูดทั้งหมด',
      'จำนวนครั้งที่พูดผ่าน',
      'ถูก Challenge (ครั้ง)',
      'Challenge ชนะ (ครั้ง)',
      'คะแนนความเชื่อมโยง AI เฉลี่ย (เต็ม 5)'
    ];

    const rows = users.map(u => {
      const winRate = u.gamesPlayed ? Math.round(((u.wins || 0) / u.gamesPlayed) * 100) : 0;
      const speechAcc = u.speechAttempts ? Math.round(((u.speechSuccesses || 0) / u.speechAttempts) * 100) : 0;
      const firstPass = u.speechTurns ? Math.round(((u.firstPassCount || 0) / u.speechTurns) * 100) : 0;
      const aiScore = u.aiJudgedCount ? ((u.totalAiScore || 0) / u.aiJudgedCount).toFixed(2) : '0';

      return [
        `"${u.uid}"`,
        `"${u.name.replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.title || 'ผู้ฝึกต่อคำ').replace(/"/g, '""')}"`,
        u.gamesPlayed || 0,
        u.wins || 0,
        winRate,
        u.wordCount || 0,
        u.maxWordsInMatch || 0,
        u.totalMatchWords || 0,
        speechAcc,
        firstPass,
        u.speechAttempts || 0,
        u.speechSuccesses || 0,
        u.challengesFaced || 0,
        u.challengesWon || 0,
        aiScore
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wordchain_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Vocabulary Distribution Chart Data
  const vocabDistributionData = useMemo(() => {
    const buckets = {
      '0-99 คำ': 0,
      '100-499 คำ': 0,
      '500-999 คำ': 0,
      '1,000-1,999 คำ': 0,
      '2,000+ คำ': 0
    };

    users.forEach(u => {
      const count = u.wordCount || 0;
      if (count < 100) buckets['0-99 คำ']++;
      else if (count < 500) buckets['100-499 คำ']++;
      else if (count < 1000) buckets['500-999 คำ']++;
      else if (count < 2000) buckets['1,000-1,999 คำ']++;
      else buckets['2,000+ คำ']++;
    });

    return {
      labels: Object.keys(buckets),
      datasets: [
        {
          label: 'จำนวนผู้เรียน (คน)',
          data: Object.values(buckets),
          backgroundColor: [
            'rgba(59, 130, 246, 0.7)',
            'rgba(16, 185, 129, 0.7)',
            'rgba(245, 158, 11, 0.7)',
            'rgba(139, 92, 246, 0.7)',
            'rgba(236, 72, 153, 0.7)'
          ],
          borderRadius: 8,
          borderWidth: 0
        }
      ]
    };
  }, [users]);

  // 2. Cohort Pronunciation Doughnut Data
  const cohortPronunciationData = useMemo(() => {
    const totalSuccesses = users.reduce((acc, u) => acc + (u.speechSuccesses || 0), 0);
    const totalFirstPass = users.reduce((acc, u) => acc + (u.firstPassCount || 0), 0);
    const multiAttemptPass = Math.max(0, totalSuccesses - totalFirstPass);
    const totalAttempts = users.reduce((acc, u) => acc + (u.speechAttempts || 0), 0);
    const failedAttempts = Math.max(0, totalAttempts - totalSuccesses);

    return {
      labels: ['พูดรอบเดียวผ่าน (First-Pass)', 'พูดซ้ำจนผ่าน (Retry Pass)', 'ออกเสียงไม่ผ่าน (Retry Needed)'],
      datasets: [
        {
          data: [totalFirstPass || 1, multiAttemptPass, failedAttempts],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',
            'rgba(59, 130, 246, 0.85)',
            'rgba(239, 68, 68, 0.85)'
          ],
          borderColor: '#1e293b',
          borderWidth: 2
        }
      ]
    };
  }, [users]);

  // 3. AI Semantic Score Distribution
  const aiScoreDistributionData = useMemo(() => {
    const scoreBuckets = {
      '1 ดาว (ไม่เกี่ยว)': 0,
      '2 ดาว (เชื่อมโยงน้อย)': 0,
      '3 ดาว (พอถูไถ)': 0,
      '4 ดาว (เกี่ยวข้องกัน)': 0,
      '5 ดาว (ชัดเจนมาก)': 0
    };

    users.forEach(u => {
      if (u.aiJudgedCount && u.aiJudgedCount > 0) {
        const avg = Math.round((u.totalAiScore || 0) / u.aiJudgedCount);
        if (avg <= 1) scoreBuckets['1 ดาว (ไม่เกี่ยว)']++;
        else if (avg === 2) scoreBuckets['2 ดาว (เชื่อมโยงน้อย)']++;
        else if (avg === 3) scoreBuckets['3 ดาว (พอถูไถ)']++;
        else if (avg === 4) scoreBuckets['4 ดาว (เกี่ยวข้องกัน)']++;
        else scoreBuckets['5 ดาว (ชัดเจนมาก)']++;
      }
    });

    return {
      labels: Object.keys(scoreBuckets),
      datasets: [
        {
          label: 'จำนวนผู้เรียน (คน)',
          data: Object.values(scoreBuckets),
          backgroundColor: 'rgba(168, 85, 247, 0.75)',
          borderRadius: 8
        }
      ]
    };
  }, [users]);

  // 4. Cohort Radar Chart (Normalized 0 - 100%)
  const cohortRadarData = useMemo(() => {
    return {
      labels: [
        'ความแม่นยำเสียง (%)',
        'พูดรอบเดียวผ่าน (%)',
        'การดึงคำศัพท์ต่อตา (เทียบ 20 คำ)',
        'คลังคำศัพท์สะสม (เทียบ 500 คำ)',
        'คะแนนเชื่อมโยง AI (เทียบ 5 ดาว)'
      ],
      datasets: [
        {
          label: 'ค่าเฉลี่ยของทั้งกลุ่ม (Cohort Average)',
          data: [
            cohortMetrics.avgAccuracy,
            cohortMetrics.avgFirstPass,
            Math.min(100, Math.round((cohortMetrics.avgMaxWords / 20) * 100)),
            Math.min(100, Math.round((cohortMetrics.avgWords / 500) * 100)),
            Math.min(100, Math.round((cohortMetrics.avgAiScore / 5) * 100))
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.25)',
          borderColor: 'rgba(59, 130, 246, 0.9)',
          borderWidth: 2,
          pointBackgroundColor: '#3b82f6'
        }
      ]
    };
  }, [cohortMetrics]);

  // Individual Student Radar Data (Comparison with Cohort)
  const individualRadarData = useMemo(() => {
    if (!selectedUser) return null;

    const userAcc = selectedUser.speechAttempts
      ? Math.round(((selectedUser.speechSuccesses || 0) / selectedUser.speechAttempts) * 100)
      : 0;

    const userFirstPass = selectedUser.speechTurns
      ? Math.round(((selectedUser.firstPassCount || 0) / selectedUser.speechTurns) * 100)
      : 0;

    const userMaxWordsScale = Math.min(100, Math.round(((selectedUser.maxWordsInMatch || 0) / 20) * 100));
    const userVocabScale = Math.min(100, Math.round(((selectedUser.wordCount || 0) / 500) * 100));
    const userAiScore = selectedUser.aiJudgedCount
      ? (selectedUser.totalAiScore || 0) / selectedUser.aiJudgedCount
      : 0;
    const userAiScale = Math.min(100, Math.round((userAiScore / 5) * 100));

    return {
      labels: [
        'ความแม่นยำเสียง (%)',
        'พูดรอบเดียวผ่าน (%)',
        'การดึงคำศัพท์ต่อตา',
        'คลังคำศัพท์สะสม',
        'คะแนนเชื่อมโยง AI'
      ],
      datasets: [
        {
          label: `${selectedUser.name} (ผู้เรียน)`,
          data: [userAcc, userFirstPass, userMaxWordsScale, userVocabScale, userAiScale],
          backgroundColor: 'rgba(16, 185, 129, 0.35)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'ค่าเฉลี่ยทั้งกลุ่ม (Cohort Avg)',
          data: [
            cohortMetrics.avgAccuracy,
            cohortMetrics.avgFirstPass,
            Math.min(100, Math.round((cohortMetrics.avgMaxWords / 20) * 100)),
            Math.min(100, Math.round((cohortMetrics.avgWords / 500) * 100)),
            Math.min(100, Math.round((cohortMetrics.avgAiScore / 5) * 100))
          ],
          backgroundColor: 'rgba(148, 163, 184, 0.15)',
          borderColor: 'rgba(148, 163, 184, 0.6)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointBackgroundColor: '#94a3b8'
        }
      ]
    };
  }, [selectedUser, cohortMetrics]);

  // Individual Student Pronunciation Doughnut
  const individualPronunciationData = useMemo(() => {
    if (!selectedUser) return null;
    const totalSuccess = selectedUser.speechSuccesses || 0;
    const firstPass = selectedUser.firstPassCount || 0;
    const retryPass = Math.max(0, totalSuccess - firstPass);
    const attempts = selectedUser.speechAttempts || 0;
    const failed = Math.max(0, attempts - totalSuccess);

    return {
      labels: ['รอบเดียวผ่าน (First-Pass)', 'พูดซ้ำจนผ่าน (Retry Pass)', 'ไม่ผ่าน (Failed)'],
      datasets: [
        {
          data: [firstPass || (attempts === 0 ? 1 : 0), retryPass, failed],
          backgroundColor: [
            'rgba(16, 185, 129, 0.9)',
            'rgba(59, 130, 246, 0.9)',
            'rgba(239, 68, 68, 0.9)'
          ],
          borderColor: '#1e293b',
          borderWidth: 2
        }
      ]
    };
  }, [selectedUser]);

  // Individual Student Vocabulary Comparison Bar
  const individualVocabBarData = useMemo(() => {
    if (!selectedUser) return null;
    const games = selectedUser.gamesPlayed || 0;
    const avgWords = games > 0 ? +((selectedUser.totalMatchWords || 0) / games).toFixed(1) : 0;

    return {
      labels: ['คำสูงสุดใน 1 ตา', 'คำเฉลี่ยต่อแมตช์', 'ค่าเฉลี่ยทั้งกลุ่ม'],
      datasets: [
        {
          label: 'จำนวนคำ (คำ)',
          data: [selectedUser.maxWordsInMatch || 0, avgWords, cohortMetrics.avgMaxWords],
          backgroundColor: [
            'rgba(245, 158, 11, 0.85)',
            'rgba(59, 130, 246, 0.85)',
            'rgba(148, 163, 184, 0.5)'
          ],
          borderRadius: 8
        }
      ]
    };
  }, [selectedUser, cohortMetrics]);

  // Pedagogical Insights Recommendation for selected user
  const studentRecommendations = useMemo(() => {
    if (!selectedUser) return [];
    const notes: { type: 'success' | 'warning' | 'info'; title: string; desc: string }[] = [];

    const userAcc = selectedUser.speechAttempts
      ? Math.round(((selectedUser.speechSuccesses || 0) / selectedUser.speechAttempts) * 100)
      : 0;
    const userFirstPass = selectedUser.speechTurns
      ? Math.round(((selectedUser.firstPassCount || 0) / selectedUser.speechTurns) * 100)
      : 0;
    const userWords = selectedUser.wordCount || 0;
    const aiScore = selectedUser.aiJudgedCount
      ? +((selectedUser.totalAiScore || 0) / selectedUser.aiJudgedCount).toFixed(1)
      : 0;

    // Pronunciation recommendation
    if (selectedUser.speechAttempts && selectedUser.speechAttempts > 3) {
      if (userAcc >= 85) {
        notes.push({
          type: 'success',
          title: 'การออกเสียงชัดเจนเป็นเลิศ (High Pronunciation Accuracy)',
          desc: `ออกเสียงผ่านเกณฑ์ถึง ${userAcc}% และผ่านรอบแรกถึง ${userFirstPass}% มีความคล่องแคล่วในการพูดภาษาไทยสูงมาก`
        });
      } else if (userAcc < 65) {
        notes.push({
          type: 'warning',
          title: 'ข้อเสนอแนะด้านการออกเสียง (Pronunciation Coaching)',
          desc: `ความแม่นยำเสียงอยู่ที่ ${userAcc}% แนะนำให้ฝึกเว้นวรรคและออกเสียงพยัญชนะต้น ร/ล และตัวสะกดมาตราแม่กน/แม่กด ให้ชัดเจนก่อนกดไมค์`
        });
      }
    }

    // Vocabulary recall recommendation
    if (userWords >= 100) {
      notes.push({
        type: 'success',
        title: 'คลังคำศัพท์กว้างขวาง (Broad Vocabulary Depth)',
        desc: `สะสมคำศัพท์ไม่ซ้ำในพจนานุกรมถึง ${userWords} คำ และต่อคำสูงสุดใน 1 ตาได้ ${selectedUser.maxWordsInMatch || 0} คำ แสดงถึงความสามารถในการดึงคำศัพท์ออกจากความจำระยะยาวได้ดี`
      });
    } else {
      notes.push({
        type: 'info',
        title: 'การส่งเสริมคลังคำศัพท์ (Vocabulary Expansion)',
        desc: `ปัจจุบันสะสมคำศัพท์ได้ ${userWords} คำ แนะนำให้ส่งเสริมการอ่านวรรณกรรมหรือบทความสารคดีเพื่อเพิ่มพูนคำนามและคำประสมใหม่ๆ`
      });
    }

    // Semantic association recommendation
    if (selectedUser.aiJudgedCount && selectedUser.aiJudgedCount > 0) {
      if (aiScore >= 4.0) {
        notes.push({
          type: 'success',
          title: 'ทักษะการเชื่อมโยงความหมายระดับสูง (Strong Semantic Connection)',
          desc: `ได้รับคะแนนประเมินความสัมพันธ์ของคำจาก AI เฉลี่ย ${aiScore}/5.0 ดาว สามารถมองเห็นความเชื่อมโยงของบริบทคำได้อย่างเฉียบคม`
        });
      } else {
        notes.push({
          type: 'info',
          title: 'ข้อสังเกตการเชื่อมโยงคำ (Contextual Relevance)',
          desc: `คะแนนความเชื่อมโยงความหมายเฉลี่ย ${aiScore}/5.0 ดาว แนะนำให้เน้นการต่อคำนามที่มีความสัมพันธ์เชิงหมวดหมู่หรือบริบทการใช้งานที่ชัดเจนยิ่งขึ้น`
        });
      }
    }

    return notes;
  }, [selectedUser]);

  return (
    <div className="min-h-screen bg-background text-main p-4 sm:p-8 flex flex-col max-w-7xl mx-auto animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-surface hover:bg-border text-muted hover:text-main transition-colors border border-border"
            title="กลับสู่หน้าเกม"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Brain className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-main tracking-tight">
                ระบบวิเคราะห์ทักษะการเรียนรู้ (Learning Analytics Dashboard)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted font-medium mt-1">
              รายงานผลสัมฤทธิ์และสถิติภาพรวม/รายบุคคล 3 ทักษะ: การออกเสียง, การจำคำศัพท์, และการเชื่อมโยงความหมาย
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-surface hover:bg-border border border-border text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรชข้อมูล
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            ส่งออก CSV
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 my-6 p-1 bg-surface rounded-2xl border border-border max-w-md">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted hover:text-main'
          }`}
        >
          <Users className="w-4 h-4" />
          ภาพรวมทั้งกลุ่ม ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'individual'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted hover:text-main'
          }`}
        >
          <Trophy className="w-4 h-4" />
          วิเคราะห์รายบุคคล
        </button>
      </div>

      {/* TAB 1: COHORT OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted text-xs font-bold mb-1">
                <Users className="w-4 h-4 text-primary" />
                ผู้เรียนทั้งหมด
              </div>
              <div className="text-2xl font-black text-main">{cohortMetrics.totalUsers} คน</div>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted text-xs font-bold mb-1">
                <Gamepad2 className="w-4 h-4 text-warning" />
                แมตช์ที่เล่นสะสม
              </div>
              <div className="text-2xl font-black text-warning">{cohortMetrics.totalGames} เกม</div>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted text-xs font-bold mb-1">
                <Mic className="w-4 h-4 text-success" />
                ความแม่นยำเสียงเฉลี่ย
              </div>
              <div className="text-2xl font-black text-success">{cohortMetrics.avgAccuracy}%</div>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted text-xs font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                รอบเดียวผ่านเฉลี่ย
              </div>
              <div className="text-2xl font-black text-primary">{cohortMetrics.avgFirstPass}%</div>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted text-xs font-bold mb-1">
                <BookOpen className="w-4 h-4 text-warning" />
                คลังศัพท์เฉลี่ย
              </div>
              <div className="text-2xl font-black text-warning">{cohortMetrics.avgWords} คำ/คน</div>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted text-xs font-bold mb-1">
                <Sparkles className="w-4 h-4 text-success" />
                คะแนน AI เฉลี่ย
              </div>
              <div className="text-2xl font-black text-success">{cohortMetrics.avgAiScore} / 5.0 ⭐</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Cohort 3-Skills Radar */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    ดัชนี 3 ทักษะเฉลี่ยของทั้งชั้นเรียน
                  </h3>
                  <p className="text-xs text-muted">แสดงความสมดุลทางการเรียนรู้ทั้ง 5 แกนชี้วัด</p>
                </div>
              </div>
              <div className="h-72 flex items-center justify-center">
                <Radar
                  data={cohortRadarData}
                  options={{
                    maintainAspectRatio: false,
                    scales: {
                      r: {
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: { stepSize: 20, color: '#64748b', backdropColor: 'transparent' },
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                        pointLabels: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' }
                      }
                    },
                    plugins: { legend: { position: 'bottom' } }
                  }}
                />
              </div>
            </div>

            {/* Chart 2: Vocabulary Distribution */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-warning" />
                    การกระจายตัวของคลังคำศัพท์ (Vocabulary Retention)
                  </h3>
                  <p className="text-xs text-muted">แบ่งตามจำนวนคำศัพท์ที่ไม่ซ้ำที่ผู้เรียนสะสมได้</p>
                </div>
              </div>
              <div className="h-72">
                <Bar
                  data={vocabDistributionData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Chart 3: Pronunciation Fluency Doughnut */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <Mic className="w-5 h-5 text-success" />
                    สัดส่วนความคล่องแคล่วในการออกเสียง (Pronunciation Fluency)
                  </h3>
                  <p className="text-xs text-muted">เปรียบเทียบการพูดรอบเดียวผ่าน vs การพูดซ้ำ</p>
                </div>
              </div>
              <div className="h-72 flex items-center justify-center">
                <Doughnut
                  data={cohortPronunciationData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 11 } } }
                    }
                  }}
                />
              </div>
            </div>

            {/* Chart 4: AI Semantic Score Breakdown */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    การกระจายคะแนนความเชื่อมโยงโดย AI (1 - 5 ดาว)
                  </h3>
                  <p className="text-xs text-muted">วิเคราะห์ความสัมพันธ์ของคำศัพท์ที่ผู้เรียนเชื่อมโยงในเกม</p>
                </div>
              </div>
              <div className="h-72">
                <Bar
                  data={aiScoreDistributionData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Student Master Table */}
          <div className="bg-surface rounded-3xl border border-border p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-main flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  ตารางรายชื่อและคะแนนสัมฤทธิ์ของผู้เรียนทั้งหมด ({filteredUsers.length} คน)
                </h3>
                <p className="text-xs text-muted">คลิกที่แถวของนักเรียนเพื่อเจาะลึกดูผลการวิเคราะห์รายบุคคล</p>
              </div>

              {/* Search & Sort Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ หรืออีเมล..."
                    className="pl-9 pr-3 py-2 rounded-xl bg-background border border-border text-xs font-bold focus:ring-2 focus:ring-primary outline-none w-48 sm:w-60"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-background border border-border text-xs font-bold text-main outline-none"
                >
                  <option value="words">เรียงตาม: คลังคำศัพท์สะสม</option>
                  <option value="accuracy">เรียงตาม: ความแม่นยำเสียง</option>
                  <option value="maxWords">เรียงตาม: คำสูงสุดต่อตา</option>
                  <option value="aiScore">เรียงตาม: คะแนน AI</option>
                  <option value="wins">เรียงตาม: จำนวนชนะ</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-background/80 border-b border-border text-muted uppercase font-bold text-[11px]">
                    <th className="py-3.5 px-4">ผู้เรียน</th>
                    <th className="py-3.5 px-3">ฉายา</th>
                    <th className="py-3.5 px-3 text-center">คลังคำศัพท์</th>
                    <th className="py-3.5 px-3 text-center">คำสูงสุด/ตา</th>
                    <th className="py-3.5 px-3 text-center">ความแม่นยำเสียง</th>
                    <th className="py-3.5 px-3 text-center">รอบเดียวผ่าน</th>
                    <th className="py-3.5 px-3 text-center">คะแนน AI</th>
                    <th className="py-3.5 px-3 text-center">เล่น/ชนะ</th>
                    <th className="py-3.5 px-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.map((u) => {
                    const acc = u.speechAttempts
                      ? Math.round(((u.speechSuccesses || 0) / u.speechAttempts) * 100)
                      : 0;
                    const firstPass = u.speechTurns
                      ? Math.round(((u.firstPassCount || 0) / u.speechTurns) * 100)
                      : 0;
                    const aiScore = u.aiJudgedCount
                      ? ((u.totalAiScore || 0) / u.aiJudgedCount).toFixed(1)
                      : '-';

                    return (
                      <tr
                        key={u.uid}
                        onClick={() => {
                          setSelectedUid(u.uid);
                          setActiveTab('individual');
                        }}
                        className="hover:bg-primary/5 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-background border border-border flex items-center justify-center font-bold text-primary flex-shrink-0">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              u.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-main group-hover:text-primary transition-colors">
                              {u.name}
                            </div>
                            {u.email && <div className="text-[10px] text-muted">{u.email}</div>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">
                            🎖️ {u.title || 'ผู้ฝึกต่อคำ'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-black text-warning">
                          {u.wordCount || 0} คำ
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-main">
                          {u.maxWordsInMatch || 0} คำ
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-black ${acc >= 75 ? 'text-success' : acc >= 50 ? 'text-primary' : 'text-danger'}`}>
                            {acc}%
                          </span>
                          <span className="text-[10px] text-muted block">({u.speechSuccesses || 0}/{u.speechAttempts || 0})</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-primary">
                          {firstPass}%
                          <span className="text-[10px] text-muted block">({u.firstPassCount || 0} ตา)</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-warning">
                          {aiScore !== '-' ? `${aiScore} ⭐` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-muted">
                          {u.gamesPlayed || 0} / <span className="text-main font-bold">{u.wins || 0}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:underline">
                            ดูเจาะลึก <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL STUDENT ANALYSIS */}
      {activeTab === 'individual' && selectedUser && (
        <div className="space-y-6">
          {/* Student Selector Bar */}
          <div className="bg-surface p-4 rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-muted uppercase">เลือกผู้เรียน:</label>
              <select
                value={selectedUid}
                onChange={e => setSelectedUid(e.target.value)}
                className="px-4 py-2 rounded-xl bg-background border border-border text-sm font-bold text-main focus:ring-2 focus:ring-primary outline-none"
              >
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.name} ({u.title || 'ผู้ฝึกต่อคำ'} - {u.wordCount || 0} คำ)
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-muted font-medium">
              กำลังแสดงรายงานของ: <strong className="text-main">{selectedUser.name}</strong>
            </div>
          </div>

          {/* Student Profile Overview Card */}
          <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-primary/40 bg-background flex items-center justify-center font-black text-2xl text-primary shadow-lg flex-shrink-0">
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt={selectedUser.name} className="w-full h-full object-cover" />
                ) : (
                  selectedUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-main flex items-center gap-2">
                  {selectedUser.name}
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">
                    🎖️ {selectedUser.title || 'ผู้ฝึกต่อคำ'}
                  </span>
                </div>
                {selectedUser.email && (
                  <div className="text-xs text-muted font-medium">{selectedUser.email}</div>
                )}
                <div className="text-xs text-muted pt-1">
                  รหัสผู้เรียน (UID): <span className="font-mono text-[11px] text-main">{selectedUser.uid}</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <div className="bg-background/60 p-3 rounded-2xl border border-border text-center min-w-[90px]">
                <div className="text-[11px] text-muted font-bold mb-1">🎮 แข่งขัน</div>
                <div className="text-lg font-black text-main">{selectedUser.gamesPlayed || 0} เกม</div>
              </div>
              <div className="bg-background/60 p-3 rounded-2xl border border-border text-center min-w-[90px]">
                <div className="text-[11px] text-muted font-bold mb-1">🏆 ชนะ</div>
                <div className="text-lg font-black text-warning">{selectedUser.wins || 0} ครั้ง</div>
              </div>
              <div className="bg-background/60 p-3 rounded-2xl border border-border text-center min-w-[90px]">
                <div className="text-[11px] text-muted font-bold mb-1">📊 Win Rate</div>
                <div className="text-lg font-black text-primary">
                  {selectedUser.gamesPlayed
                    ? Math.round(((selectedUser.wins || 0) / selectedUser.gamesPlayed) * 100)
                    : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row: Radar Comparison & Deep-Dive Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student vs Cohort Radar */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    เปรียบเทียบทักษะ: ผู้เรียน vs ค่าเฉลี่ยทั้งกลุ่ม
                  </h3>
                  <p className="text-xs text-muted">เส้นสีเขียว = {selectedUser.name} | เส้นประสีเทา = ค่าเฉลี่ยทั้งชั้น</p>
                </div>
              </div>
              <div className="h-80 flex items-center justify-center">
                {individualRadarData && (
                  <Radar
                    data={individualRadarData}
                    options={{
                      maintainAspectRatio: false,
                      scales: {
                        r: {
                          suggestedMin: 0,
                          suggestedMax: 100,
                          ticks: { stepSize: 20, color: '#64748b', backdropColor: 'transparent' },
                          grid: { color: 'rgba(255, 255, 255, 0.08)' },
                          angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                          pointLabels: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' }
                        }
                      },
                      plugins: { legend: { position: 'bottom' } }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Skill 1: Pronunciation Deep-Dive */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-bold text-primary uppercase">ทักษะที่ 1</div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <Mic className="w-5 h-5 text-primary" />
                    การออกเสียงคำศัพท์ (Pronunciation Fluency)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-primary">
                    {selectedUser.speechAttempts
                      ? Math.round(((selectedUser.speechSuccesses || 0) / selectedUser.speechAttempts) * 100)
                      : 0}%
                  </span>
                  <span className="text-[10px] text-muted block">ความแม่นยำ</span>
                </div>
              </div>
              <div className="h-64 flex items-center justify-center">
                {individualPronunciationData && (
                  <Doughnut
                    data={individualPronunciationData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
                    }}
                  />
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-border/50 text-xs mt-2">
                <div>
                  <span className="text-muted block text-[11px]">พูดทั้งหมด</span>
                  <strong className="text-main">{selectedUser.speechAttempts || 0} ครั้ง</strong>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">พูดสำเร็จ</span>
                  <strong className="text-success">{selectedUser.speechSuccesses || 0} ครั้ง</strong>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">รอบเดียวผ่าน</span>
                  <strong className="text-primary">{selectedUser.firstPassCount || 0} ตา</strong>
                </div>
              </div>
            </div>

            {/* Skill 2: Vocabulary Recall Deep-Dive */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-bold text-warning uppercase">ทักษะที่ 2</div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-warning" />
                    การจำคำศัพท์ (Vocabulary Recall & Depth)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-warning">{selectedUser.wordCount || 0}</span>
                  <span className="text-[10px] text-muted block">คำในคลังศัพท์</span>
                </div>
              </div>
              <div className="h-64">
                {individualVocabBarData && (
                  <Bar
                    data={individualVocabBarData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true } }
                    }}
                  />
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-border/50 text-xs mt-2">
                <div>
                  <span className="text-muted block text-[11px]">คำสูงสุด/ตา</span>
                  <strong className="text-warning">{selectedUser.maxWordsInMatch || 0} คำ</strong>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">คำรวมทั้งหมด</span>
                  <strong className="text-main">{selectedUser.totalMatchWords || 0} คำ</strong>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">คำเฉลี่ย/เกม</span>
                  <strong className="text-primary">
                    {selectedUser.gamesPlayed
                      ? ((selectedUser.totalMatchWords || 0) / selectedUser.gamesPlayed).toFixed(1)
                      : 0} คำ
                  </strong>
                </div>
              </div>
            </div>

            {/* Skill 3: Semantic Association Deep-Dive */}
            <div className="bg-surface p-6 rounded-3xl border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-bold text-success uppercase">ทักษะที่ 3</div>
                  <h3 className="text-lg font-black text-main flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-success" />
                    การเชื่อมโยงทางภาษา (Semantic Association)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-success">
                    {selectedUser.aiJudgedCount
                      ? ((selectedUser.totalAiScore || 0) / selectedUser.aiJudgedCount).toFixed(1)
                      : '-'}
                  </span>
                  <span className="text-[10px] text-muted block">คะแนน AI / 5.0 ⭐</span>
                </div>
              </div>
              
              <div className="space-y-4 my-auto p-4 bg-background/50 rounded-2xl border border-border">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted font-bold">อัตราการรอดเมื่อถูก Challenge:</span>
                  <span className="font-black text-primary text-base">
                    {selectedUser.challengesFaced
                      ? Math.round(((selectedUser.challengesWon || 0) / selectedUser.challengesFaced) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-surface rounded-full h-3 overflow-hidden border border-border">
                  <div
                    className="bg-primary h-3 rounded-full transition-all duration-700"
                    style={{
                      width: `${
                        selectedUser.challengesFaced
                          ? Math.round(((selectedUser.challengesWon || 0) / selectedUser.challengesFaced) * 100)
                          : 0
                      }%`
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                  <div className="bg-surface p-3 rounded-xl border border-border text-center">
                    <span className="text-muted block text-[11px]">ถูกประท้วงทั้งหมด</span>
                    <strong className="text-main text-base">{selectedUser.challengesFaced || 0} ครั้ง</strong>
                  </div>
                  <div className="bg-surface p-3 rounded-xl border border-border text-center">
                    <span className="text-muted block text-[11px]">โหวตให้ผ่าน (รอด)</span>
                    <strong className="text-success text-base">{selectedUser.challengesWon || 0} ครั้ง</strong>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted text-center pt-4 border-t border-border/50">
                คะแนน AI คำนวณจากแบบจำลอง Gemini ในการวัดความสัมพันธ์เชิงอรรถศาสตร์ของคำ
              </div>
            </div>
          </div>

          {/* Pedagogical Insights and Recommendations */}
          <div className="bg-surface p-6 rounded-3xl border border-border space-y-4">
            <h3 className="text-lg font-black text-main flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-warning" />
              ข้อเสนอแนะเพื่อการพัฒนาการเรียนรู้เฉพาะบุคคล (Pedagogical Recommendations)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {studentRecommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border ${
                    rec.type === 'success'
                      ? 'bg-success/5 border-success/30 text-main'
                      : rec.type === 'warning'
                      ? 'bg-danger/5 border-danger/30 text-main'
                      : 'bg-primary/5 border-primary/30 text-main'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {rec.type === 'success' && <Award className="w-4 h-4 text-success" />}
                    {rec.type === 'warning' && <Mic className="w-4 h-4 text-danger" />}
                    {rec.type === 'info' && <BookOpen className="w-4 h-4 text-primary" />}
                    <span className={rec.type === 'success' ? 'text-success' : rec.type === 'warning' ? 'text-danger' : 'text-primary'}>
                      {rec.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{rec.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
