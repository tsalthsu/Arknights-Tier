import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { fetchCharacters } from '../utils/dataFetcher';

const TAGS = [
  { id: 'general', label: { ko: '범용성', en: 'General', ja: '汎用性', zh: '泛用性' } },
  { id: 'cc', label: { ko: '위기협약', en: 'Contingency Contract', ja: '危機契約', zh: '危机合约' } },
  { id: 'is', label: { ko: '통합전략(로그라이크)', en: 'Integrated Strategies', ja: '統合戦略', zh: '集成战略' } },
  { id: 'other', label: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' } },
];

const STAR_FILTERS = [
  { id: 'all', label: { ko: '전체', en: 'All', ja: 'すべて', zh: '全部' } },
  { id: '6', label: { ko: '6성', en: '6★', ja: '★6', zh: '6★' } },
  { id: '5', label: { ko: '5성', en: '5★', ja: '★5', zh: '5★' } },
  { id: '4', label: { ko: '4성', en: '4★', ja: '★4', zh: '4★' } },
];

const SCORE_MAP = { 'OP': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1, 'D': 0 };
const TIER_COLORS = { 'OP': '#ff7f7f', 'S': '#ffbf7f', 'A': '#ffff7f', 'B': '#7fff7f', 'C': '#7fbfff', 'D': '#bfbfbf' };
const DIST_COLORS = { 'OP': '#ec4899', 'S': '#f97316', 'A': '#eab308', 'B': '#22c55e', 'C': '#3b82f6', 'D': '#64748b' };
const TIER_ORDER = ['OP', 'S', 'A', 'B', 'C', 'D'];

const MSG = {
  ko: { sortScore: '점수순', sortRelease: '출시순', viewChart: '그래프 📊', viewTable: '리스트 📋', noData: '데이터가 없습니다.', avgScore: '현재 메타 점수', votes: '이번 달 투표수', trend: '최근 6개월 트렌드', serverGlobal: '글로벌 서버', serverCN: '중국 서버', serverAll: '전체 서버', thRank: '순위', thChar: '캐릭터', thTierDist: '티어 분포도' },
  en: { sortScore: 'Score', sortRelease: 'Release', viewChart: 'Chart 📊', viewTable: 'List 📋', noData: 'No data available.', avgScore: 'Current Meta Score', votes: 'Votes this month', trend: '6-Month Trend', serverGlobal: 'Global', serverCN: 'CN', serverAll: 'All Servers', thRank: '#', thChar: 'Character', thTierDist: 'Tier Distribution' },
  ja: { sortScore: 'スコア順', sortRelease: '実装順', viewChart: 'グラフ 📊', viewTable: 'リスト 📋', noData: 'データがありません。', avgScore: '現在のスコア', votes: '今月の投票数', trend: '直近6ヶ月のトレンド', serverGlobal: 'グローバル', serverCN: '中国サーバー', serverAll: '全サーバー', thRank: '順位', thChar: 'キャラクター', thTierDist: 'ティア分布' },
  zh: { sortScore: '评分', sortRelease: '实装', viewChart: '图表 📊', viewTable: '列表 📋', noData: '暂无数据。', avgScore: '当前环境得分', votes: '本月票数', trend: '近6个月趋势', serverGlobal: '国际服', serverCN: '国服', serverAll: '所有服务器', thRank: '排名', thChar: '干员', thTierDist: '梯队分布' }
};

// Generate an array of the last N months (e.g. ["2023-11", "2023-12", "2024-01"])
const getRecentMonths = (count) => {
    const arr = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
};

export default function Stats({ lang, isDark }) {
  const [selectedTag, setSelectedTag] = useState('general');
  const [starFilter, setStarFilter] = useState('all');
  const [serverFilter, setServerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'score', dir: 'desc' });
  const [viewMode, setViewMode] = useState('table'); // Default to table to show off the cool sparklines
  
  const [charHistory, setCharHistory] = useState({});
  const [charList, setCharList] = useState([]);
  const [targetMonths, setTargetMonths] = useState([]);
  
  const chartRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState({ active: false, chars: [], x: 0, y: 0 });

  const t = (key) => MSG[lang]?.[key] || MSG.en[key];

  useEffect(() => {
    loadData(selectedTag, serverFilter);
  }, [selectedTag, serverFilter]);

  const loadData = async (tag, server) => {
    setLoading(true);
    try {
      const chars = await fetchCharacters();
      setCharList(chars);

      const q = query(collection(db, "tier_results"), where("tag", "==", tag));
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data());

      const bucketMap = {};
      
      // Group by YYYY-MM
      results.forEach(r => {
         // Apply Server Filter
         if (server !== 'all' && (r.server || 'global') !== server) return;

         const date = new Date(r.timestamp);
         const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
         
         if (!bucketMap[monthKey]) bucketMap[monthKey] = {};
         
         if (!r.tiers) return;
         Object.entries(r.tiers).forEach(([tier, items]) => {
             const score = SCORE_MAP[tier];
             if (score === undefined || !items) return;
             items.forEach(itemId => {
                 if (!bucketMap[monthKey][itemId]) {
                     bucketMap[monthKey][itemId] = { total: 0, count: 0, tiers: { OP:0, S:0, A:0, B:0, C:0, D:0 } };
                 }
                 bucketMap[monthKey][itemId].total += score;
                 bucketMap[monthKey][itemId].count += 1;
                 bucketMap[monthKey][itemId].tiers[tier] += 1;
             });
         });
      });

      // We want to analyze the last 6 months up to now.
      const months = getRecentMonths(6);
      setTargetMonths(months);

      // Build continuous history per character
      const history = {};
      chars.forEach(char => {
          let lastKnownAvg = null; // Carry over past scores if no votes in a month
          
          // Pre-scan older buckets (before the 6 month window) to establish an initial baseline if possible
          const allBuckets = Object.keys(bucketMap).sort();
          for (const bKey of allBuckets) {
              if (bKey >= months[0]) break; // Stop when we reach our 6-month window
              const b = bucketMap[bKey]?.[char.id];
              if (b) lastKnownAvg = b.total / b.count;
          }

          const timeline = months.map(m => {
              const b = bucketMap[m]?.[char.id];
              if (b) {
                  const avg = b.total / b.count;
                  lastKnownAvg = avg;
                  return { month: m, avg, count: b.count, tiers: b.tiers, hasData: true };
              } else {
                  return { month: m, avg: lastKnownAvg, count: 0, tiers: null, hasData: false };
              }
          });
          
          history[char.id] = timeline;
      });

      setCharHistory(history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let dir = 'desc';
    if (sortConfig.key === key) dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    setSortConfig({ key, dir });
  };

  // The "Current" score is always the last item in the 6-month timeline
  const getCurrentStats = (charId) => {
      const timeline = charHistory[charId];
      if (!timeline || timeline.length === 0) return null;
      return timeline[timeline.length - 1]; // Current month
  };

  const sortedChars = useMemo(() => {
      let filtered = charList;
      if (starFilter !== 'all') {
          filtered = filtered.filter(c => c.star === parseInt(starFilter));
      }
      
      // Filter out characters that have NO data in the entire 6 month timeline
      filtered = filtered.filter(c => {
          const t = charHistory[c.id];
          if (!t) return false;
          return t.some(m => m.avg !== null);
      });
      
      return [...filtered].sort((a,b) => {
          if (sortConfig.key === 'release') {
              const valA = a.releaseTimestamp || 0;
              const valB = b.releaseTimestamp || 0;
              return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
          } else {
              const statsA = getCurrentStats(a.id);
              const statsB = getCurrentStats(b.id);
              const avgA = statsA?.avg ?? -1;
              const avgB = statsB?.avg ?? -1;
              
              if (avgA === avgB) {
                  const valA = a.releaseTimestamp || 0;
                  const valB = b.releaseTimestamp || 0;
                  return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
              }
              return sortConfig.dir === 'desc' ? avgB - avgA : avgA - avgB;
          }
      });
  }, [charList, starFilter, sortConfig, charHistory]);

  const getTopPercent = (avg) => ((5.0 - avg) / 5.5) * 100;
  
  const getMainTierColor = (avg) => {
    if (avg >= 4.5) return TIER_COLORS['OP'];
    if (avg >= 3.5) return TIER_COLORS['S'];
    if (avg >= 2.5) return TIER_COLORS['A'];
    if (avg >= 1.5) return TIER_COLORS['B'];
    if (avg >= 0.5) return TIER_COLORS['C'];
    return TIER_COLORS['D'];
  };

  const charPositions = useMemo(() => {
      const positions = [];
      sortedChars.forEach((skin, i) => {
          const stats = getCurrentStats(skin.id);
          if (!stats || stats.avg === null) return;
          const x = 2 + (i / Math.max(1, sortedChars.length - 1)) * 96; 
          const y = getTopPercent(stats.avg);
          positions.push({ skin, x, y, stats });
      });
      return positions;
  }, [sortedChars, charHistory]);

  const handleMouseMove = (e) => {
      if (!chartRef.current) return;
      const rect = chartRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;

      const nearby = charPositions.filter(p => {
          const dx = p.x - mx;
          const dy = p.y - my;
          return Math.sqrt(dx*dx + dy*dy) < 2.5; 
      });

      if (nearby.length > 0) {
          setHoverInfo({ active: true, chars: nearby, x: mx, y: my });
      } else {
          setHoverInfo({ active: false, chars: [], x: 0, y: 0 });
      }
  };

  const handleMouseLeave = () => {
      setHoverInfo({ active: false, chars: [], x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className={`p-4 rounded-xl border flex flex-col xl:flex-row gap-4 justify-between ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
              {TAGS.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setSelectedTag(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedTag === t.id ? 'bg-blue-600 text-white shadow-md' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-100 hover:bg-slate-200')}`}
                >
                  {t.label[lang]}
                </button>
              ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
              {STAR_FILTERS.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setStarFilter(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${starFilter === t.id ? 'bg-slate-600 text-white' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-100 hover:bg-slate-200')}`}
                >
                  {t.label[lang]}
                </button>
              ))}
          </div>
        </div>
        
        <div className="flex flex-col gap-3 xl:items-end justify-between">
            <div className="flex flex-wrap gap-2 items-center justify-start xl:justify-end">
                <span className={`text-sm font-bold opacity-70 mr-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Server:</span>
                {[
                  { id: 'all', label: t('serverAll') },
                  { id: 'global', label: t('serverGlobal') },
                  { id: 'cn', label: t('serverCN') }
                ].map(s => (
                  <button 
                    key={s.id}
                    onClick={() => setServerFilter(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${serverFilter === s.id ? 'bg-emerald-600 text-white shadow-sm' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-100 hover:bg-slate-200')}`}
                  >
                    {s.label}
                  </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-start xl:justify-end border-t pt-3 w-full xl:border-t-0 xl:pt-0">
                <button 
                  onClick={() => setViewMode('chart')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'chart' ? 'bg-indigo-600 text-white shadow-md' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}`}
                >
                  {t('viewChart')}
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-md' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}`}
                >
                  {t('viewTable')}
                </button>
                <div className="w-px h-6 bg-slate-300 mx-2 hidden sm:block"></div>
                <button 
                  onClick={() => handleSort('score')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${sortConfig.key === 'score' ? 'bg-blue-600 text-white' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-200 hover:bg-slate-300')}`}
                >
                  {t('sortScore')} {sortConfig.key === 'score' && (sortConfig.dir === 'desc' ? '↓' : '↑')}
                </button>
                <button 
                  onClick={() => handleSort('release')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${sortConfig.key === 'release' ? 'bg-blue-600 text-white' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-200 hover:bg-slate-300')}`}
                >
                  {t('sortRelease')} {sortConfig.key === 'release' && (sortConfig.dir === 'desc' ? '↓' : '↑')}
                </button>
            </div>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className={`p-6 rounded-xl shadow-lg border relative overflow-hidden flex flex-col ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
            {loading && <div className="absolute inset-0 flex items-center justify-center text-xl font-bold bg-black/10 backdrop-blur-sm z-50">Loading...</div>}
            
            <div className="w-full pb-6 overflow-x-auto">
                <div 
                  ref={chartRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  className="relative h-[800px] sm:h-[1000px] border-l-2 border-b-2 bg-[length:100%_18.18%] bg-top mt-10 mb-10 ml-[40px] sm:ml-[50px] transition-all min-w-[800px]" 
                  style={{ 
                    width: 'calc(100% - 60px)',
                    backgroundImage: `linear-gradient(${isDark ? '#3f3f46' : '#e2e8f0'} 1px, transparent 1px)`,
                    borderColor: isDark ? '#52525b' : '#cbd5e1'
                  }}
                >
                  <GuideLabel top={0} label="OP" color={TIER_COLORS['OP']} isDark={isDark} />
                  <GuideLabel top={18.18} label="S" color={TIER_COLORS['S']} isDark={isDark} />
                  <GuideLabel top={36.36} label="A" color={TIER_COLORS['A']} isDark={isDark} />
                  <GuideLabel top={54.54} label="B" color={TIER_COLORS['B']} isDark={isDark} />
                  <GuideLabel top={72.72} label="C" color={TIER_COLORS['C']} isDark={isDark} />
                  <GuideLabel top={90.90} label="D" color={TIER_COLORS['D']} isDark={isDark} />

                  {sortedChars.map((skin, i) => {
                      const timeline = charHistory[skin.id];
                      if (!timeline) return null;
                      
                      const validPoints = timeline.filter(m => m.avg !== null);
                      if (validPoints.length === 0) return null;
                      
                      const currentPoint = validPoints[validPoints.length - 1]; // most recent available
                      const oldestPoint = validPoints[0];
                      const diff = currentPoint.avg - oldestPoint.avg;
                      const x = 2 + (i / Math.max(1, sortedChars.length - 1)) * 96; 
                      
                      const isHovered = hoverInfo.active && hoverInfo.chars.some(c => c.skin.id === skin.id);
                      const baseZIndex = isHovered ? 40 : 20;

                      return (
                         <div key={skin.id} className="absolute w-0 h-full pointer-events-none" style={{ left: `${x}%`, top: 0 }}>
                             {validPoints.length > 1 && (
                                 <div className={`absolute w-[2px] -ml-[1px] rounded-full transition-opacity ${isHovered ? 'opacity-100 w-[4px] -ml-[2px]' : 'opacity-10'}`} style={{
                                     top: `${Math.min(getTopPercent(currentPoint.avg), getTopPercent(oldestPoint.avg))}%`,
                                     height: `${Math.abs(getTopPercent(currentPoint.avg) - getTopPercent(oldestPoint.avg))}%`,
                                     backgroundColor: diff > 0 ? '#22c55e' : (diff < 0 ? '#ef4444' : '#94a3b8'),
                                     zIndex: baseZIndex - 5
                                 }}/>
                             )}
                             
                             <div className={`absolute bg-cover bg-center rounded-full border-[2px] transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 shadow-md ${isHovered ? 'w-14 h-14 border-[3px] scale-110 shadow-xl z-50 ring-4 ring-white/20' : 'w-9 h-9 opacity-90'}`}
                               style={{
                                 top: `${getTopPercent(currentPoint.avg)}%`,
                                 backgroundImage: `url(https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${skin.id}.png)`,
                                 borderColor: getMainTierColor(currentPoint.avg),
                                 zIndex: baseZIndex
                               }}
                             />
                         </div>
                      )
                  })}
                  
                  {hoverInfo.active && hoverInfo.chars.length > 0 && (() => {
                      const rootX = hoverInfo.x;
                      const rootY = hoverInfo.chars[0].y;

                      let xClass = '-translate-x-1/2';
                      if (rootX < 20) xClass = 'translate-x-0 ml-6';
                      else if (rootX > 80) xClass = '-translate-x-full -ml-6';

                      let yClass = '-translate-y-full -mt-6';
                      if (rootY < 20) yClass = 'translate-y-0 mt-6';

                      return (
                          <div className={`absolute transform ${xClass} ${yClass} z-[100] pointer-events-none transition-transform duration-75`} style={{ left: `${rootX}%`, top: `${rootY}%` }}>
                              <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-md border min-w-[300px] flex flex-col gap-4 ${isDark ? 'bg-zinc-900/95 border-zinc-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900'}`}>
                                  <div className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-center">
                                      {hoverInfo.chars.length > 1 ? `${hoverInfo.chars.length} Characters in cluster` : 'Character Info'}
                                  </div>
                              {hoverInfo.chars.map(c => (
                                  <div key={c.skin.id} className="flex flex-col gap-2 border-b border-current pb-3 last:border-0 last:pb-0">
                                      <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-3">
                                              <img src={`https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${c.skin.id}.png`} className="w-10 h-10 rounded-full shadow-sm bg-zinc-200" alt=""/>
                                              <span className="font-bold text-sm">{c.skin.nameMap?.[lang] || c.skin.label}</span>
                                          </div>
                                          <div className="flex flex-col items-end">
                                              <span className="font-black text-xl" style={{ color: getMainTierColor(c.stats.avg) }}>{c.stats.avg.toFixed(2)}</span>
                                              <span className="text-[10px] opacity-70 font-semibold">{c.stats.count} {t('votes')}</span>
                                          </div>
                                      </div>
                                      {c.stats.tiers && <DistributionBar tiers={c.stats.tiers} total={c.stats.count} showLabels />}
                                  </div>
                              ))}
                          </div>
                      </div>
                      );
                  })()}

                </div>
            </div>
        </div>
      ) : (
        <div className={`p-0 rounded-xl shadow-lg border relative overflow-hidden ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className={`text-sm ${isDark ? 'bg-zinc-900/50 text-zinc-400' : 'bg-slate-50 text-slate-500'}`}>
                            <th className="p-4 font-semibold w-12">#</th>
                            <th className="p-4 font-semibold min-w-[150px]">{t('thChar')}</th>
                            <th className="p-4 font-semibold w-[150px] text-center">{t('trend')}</th>
                            <th className="p-4 font-semibold text-right min-w-[100px]">{t('avgScore')}</th>
                            <th className="p-4 font-semibold w-[250px] hidden sm:table-cell">{t('thTierDist')}</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {sortedChars.map((skin, i) => {
                            const timeline = charHistory[skin.id];
                            if (!timeline) return null;
                            const currentStats = getCurrentStats(skin.id);
                            if (!currentStats || currentStats.avg === null) return null;

                            return (
                                <tr key={skin.id} className={`border-t transition ${isDark ? 'border-zinc-700 hover:bg-zinc-700/30' : 'border-slate-100 hover:bg-slate-50'}`}>
                                    <td className="p-4 font-medium opacity-50">{i + 1}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={`https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${skin.id}.png`} className="w-10 h-10 rounded shadow-sm bg-zinc-200" alt=""/>
                                            <span className="font-bold text-base">{skin.nameMap?.[lang] || skin.label}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Sparkline timeline={timeline} isDark={isDark} />
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-lg" style={{ color: getMainTierColor(currentStats.avg) }}>{currentStats.avg.toFixed(2)}</span>
                                            <span className="text-[10px] opacity-50 font-semibold">{currentStats.count} {t('votes')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle hidden sm:table-cell">
                                        {currentStats.tiers ? <DistributionBar tiers={currentStats.tiers} total={currentStats.count} showLabels /> : <span className="opacity-30">N/A</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
}

// 6-Month Sparkline Component (SVG)
function Sparkline({ timeline, isDark }) {
    const width = 100;
    const height = 30;
    
    const validPoints = timeline.filter(m => m.avg !== null);
    if (validPoints.length < 2) return <span className="text-[10px] opacity-30">Not enough data</span>;

    const maxPoints = timeline.length; // usually 6
    const stepX = width / (maxPoints - 1);
    
    let pathD = "";
    let isFirst = true;

    const points = [];
    timeline.forEach((m, idx) => {
        if (m.avg !== null) {
            const x = idx * stepX;
            // Map avg (0-5) to y (0-30). Invert Y axis: avg=5 -> y=0, avg=0 -> y=30
            const y = height - (m.avg / 5.0) * height;
            points.push({x, y, avg: m.avg});
            if (isFirst) {
                pathD += `M ${x} ${y} `;
                isFirst = false;
            } else {
                pathD += `L ${x} ${y} `;
            }
        }
    });

    const diff = validPoints[validPoints.length - 1].avg - validPoints[0].avg;
    const strokeColor = diff > 0 ? '#22c55e' : (diff < 0 ? '#ef4444' : '#94a3b8');

    return (
        <svg width={width} height={height} className="overflow-visible inline-block">
            {/* Background guide lines */}
            <line x1={0} y1={0} x2={width} y2={0} stroke={isDark ? '#3f3f46' : '#e2e8f0'} strokeWidth={1} strokeDasharray="2,2"/>
            <line x1={0} y1={height} x2={width} y2={height} stroke={isDark ? '#3f3f46' : '#e2e8f0'} strokeWidth={1} strokeDasharray="2,2"/>
            
            {/* The trend line */}
            <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            
            {/* The final dot (current score) */}
            {points.length > 0 && (
                <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill={strokeColor} />
            )}
        </svg>
    );
}

function DistributionBar({ tiers, total, showLabels = false }) {
    if (!total) return null;
    return (
        <div className="flex flex-col gap-1 w-full mt-1">
            <div className="flex w-full h-2 rounded-full overflow-hidden border border-black/10 shadow-inner bg-zinc-200/20">
                {TIER_ORDER.map(tier => {
                    const count = tiers[tier] || 0;
                    if (count === 0) return null;
                    const pct = (count / total) * 100;
                    return (
                        <div 
                            key={tier} 
                            style={{ width: `${pct}%`, backgroundColor: DIST_COLORS[tier] }}
                            className="h-full transition-all duration-500"
                            title={`${tier}: ${count} (${pct.toFixed(1)}%)`}
                        />
                    );
                })}
            </div>
            {showLabels && (
                <div className="flex justify-between text-[10px] opacity-60 font-medium">
                    <span style={{ color: DIST_COLORS['OP'] }}>OP {((tiers['OP']||0)/total*100).toFixed(0)}%</span>
                    <span style={{ color: DIST_COLORS['D'] }}>D {((tiers['D']||0)/total*100).toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
}

function GuideLabel({ top, label, color, isDark }) {
  return (
    <>
      <div className="absolute left-0 right-0 border-t" style={{ top: `${top}%`, borderColor: isDark ? '#52525b' : '#cbd5e1' }} />
      <div 
        className="absolute w-[50px] text-right pr-3 font-bold text-2xl transform -translate-y-1/2"
        style={{ top: `${top}%`, left: '-50px', color: color }}
      >
        {label}
      </div>
    </>
  );
}