import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { fetchCharacters } from '../utils/dataFetcher';

const TAGS = [
  { id: 'general', label: { ko: '범용성', en: 'General', ja: '汎用性', zh: '泛用性' } },
  { id: 'cc', label: { ko: '위기협약(CC)', en: 'CC', ja: '危機契約', zh: '危机合约' } },
  { id: 'is', label: { ko: '로그라이크(IS)', en: 'IS', ja: 'ローグライク', zh: '集成战略' } },
  { id: 'other', label: { ko: '그외', en: 'Other', ja: 'その他', zh: '其他' } },
];

const STAR_FILTERS = [
  { id: 'all', label: { ko: '전체 성급', en: 'All Stars', ja: '全レア', zh: '全部星级' } },
  { id: '6', label: { ko: '6성', en: '6★', ja: '★6', zh: '6★' } },
  { id: '5', label: { ko: '5성', en: '5★', ja: '★5', zh: '5★' } },
  { id: '4', label: { ko: '4성', en: '4★', ja: '★4', zh: '4★' } },
];

const TIMEFRAMES = [
  { id: '1m', label: { ko: '최근 1달', en: '1 Month', ja: '1ヶ月', zh: '最近1月' }, days: 30 },
  { id: '3m', label: { ko: '최근 3달', en: '3 Months', ja: '3ヶ月', zh: '最近3月' }, days: 90 },
  { id: '6m', label: { ko: '최근 6달', en: '6 Months', ja: '6ヶ月', zh: '最近6月' }, days: 180 },
  { id: '1y', label: { ko: '최근 1년', en: '1 Year', ja: '1年', zh: '最近1年' }, days: 365 },
  { id: 'all', label: { ko: '전체 데이터', en: 'All Time', ja: '全期間', zh: '全部' }, days: Infinity },
];

const SCORE_MAP = { 'OP': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1, 'D': 0 };
const TIER_COLORS = { 'OP': '#ff7f7f', 'S': '#ffbf7f', 'A': '#ffff7f', 'B': '#7fff7f', 'C': '#7fbfff', 'D': '#bfbfbf' };
const DIST_COLORS = { 'OP': '#ec4899', 'S': '#f97316', 'A': '#eab308', 'B': '#22c55e', 'C': '#3b82f6', 'D': '#64748b' };
const TIER_ORDER = ['OP', 'S', 'A', 'B', 'C', 'D'];

const MSG = {
  ko: { sortScore: '점수순 정렬', sortRelease: '출시순 정렬', viewChart: '그래프 뷰 📊', viewTable: '리스트 뷰 📋', noData: '데이터가 없습니다.', avgScore: '평균 점수', votes: '투표수' },
  en: { sortScore: 'Sort by Score', sortRelease: 'Sort by Release', viewChart: 'Chart View 📊', viewTable: 'List View 📋', noData: 'No data available.', avgScore: 'Avg Score', votes: 'Votes' },
  ja: { sortScore: 'スコア順', sortRelease: '実装順', viewChart: 'グラフ 📊', viewTable: 'リスト 📋', noData: 'データがありません。', avgScore: '平均スコア', votes: '投票数' },
  zh: { sortScore: '按评分排序', sortRelease: '按实装排序', viewChart: '图表视图 📊', viewTable: '列表视图 📋', noData: '暂无数据。', avgScore: '平均分', votes: '票数' }
};

export default function Stats({ lang, isDark }) {
  const [selectedTag, setSelectedTag] = useState('general');
  const [starFilter, setStarFilter] = useState('all');
  const [selectedTfs, setSelectedTfs] = useState({ '1m': false, '3m': false, '6m': false, '1y': false, 'all': true });
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'release', dir: 'desc' });
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table'
  
  const [rawStats, setRawStats] = useState({});
  const [charList, setCharList] = useState([]);
  
  const chartRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState({ active: false, chars: [], x: 0, y: 0 });

  const t = (key) => MSG[lang]?.[key] || MSG.en[key];

  useEffect(() => {
    loadData(selectedTag);
  }, [selectedTag]);

  const loadData = async (tag) => {
    setLoading(true);
    try {
      const chars = await fetchCharacters();
      setCharList(chars);

      const q = query(collection(db, "tier_results"), where("tag", "==", tag));
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data());

      const now = new Date().getTime();
      const calcForDays = (daysLimit) => {
         const valid = results.filter(r => {
             if (daysLimit === Infinity) return true;
             const t = new Date(r.timestamp).getTime();
             return (now - t) <= daysLimit * 24 * 60 * 60 * 1000;
         });
         
         const skinMap = {};
         valid.forEach(r => {
             if (!r.tiers) return;
             Object.entries(r.tiers).forEach(([tier, items]) => {
                 const score = SCORE_MAP[tier];
                 if (score === undefined || !items) return;
                 items.forEach(itemId => {
                     if (!skinMap[itemId]) skinMap[itemId] = { total: 0, count: 0, tiers: { OP:0, S:0, A:0, B:0, C:0, D:0 } };
                     skinMap[itemId].total += score;
                     skinMap[itemId].count += 1;
                     skinMap[itemId].tiers[tier] += 1;
                 });
             });
         });
         
         const statsObj = {};
         Object.keys(skinMap).forEach(k => {
             statsObj[k] = {
                 avg: skinMap[k].total / skinMap[k].count,
                 count: skinMap[k].count,
                 tiers: skinMap[k].tiers
             };
         });
         return statsObj;
      };

      const byTf = {};
      TIMEFRAMES.forEach(tf => {
          byTf[tf.id] = calcForDays(tf.days);
      });
      setRawStats(byTf);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTf = (id) => {
      setSelectedTfs(prev => {
          const next = { ...prev, [id]: !prev[id] };
          if (Object.values(next).every(v => !v)) next['all'] = true; 
          return next;
      });
  };

  const handleSort = (key) => {
    let dir = 'desc';
    if (sortConfig.key === key) dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    setSortConfig({ key, dir });
  };

  const activeTfIds = TIMEFRAMES.filter(t => selectedTfs[t.id]).map(t => t.id);
  const primaryTfId = activeTfIds[0] || 'all';

  const sortedChars = useMemo(() => {
      let filtered = charList;
      if (starFilter !== 'all') {
          filtered = filtered.filter(c => c.star === parseInt(starFilter));
      }
      
      return [...filtered].sort((a,b) => {
          if (sortConfig.key === 'release') {
              const valA = a.releaseTimestamp || 0;
              const valB = b.releaseTimestamp || 0;
              return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
          } else {
              const avgA = rawStats[primaryTfId]?.[a.id]?.avg ?? -1;
              const avgB = rawStats[primaryTfId]?.[b.id]?.avg ?? -1;
              
              if (avgA === avgB) {
                  const valA = a.releaseTimestamp || 0;
                  const valB = b.releaseTimestamp || 0;
                  return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
              }
              return sortConfig.dir === 'desc' ? avgB - avgA : avgA - avgB;
          }
      });
  }, [charList, starFilter, sortConfig, rawStats, primaryTfId]);

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
          const stats = rawStats[primaryTfId]?.[skin.id];
          if (!stats) return;
          const x = 2 + (i / Math.max(1, sortedChars.length - 1)) * 96; 
          const y = getTopPercent(stats.avg);
          positions.push({ skin, x, y, stats });
      });
      return positions;
  }, [sortedChars, rawStats, primaryTfId]);

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
                <span className={`text-sm font-bold opacity-70 mr-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Timeframes:</span>
                {TIMEFRAMES.map(tf => (
                    <button 
                      key={tf.id}
                      onClick={() => toggleTf(tf.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedTfs[tf.id] ? 'bg-emerald-600 text-white shadow-sm' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-100 hover:bg-slate-200')}`}
                    >
                      {tf.label[lang]}
                    </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-start xl:justify-end">
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
                      const points = [];
                      activeTfIds.forEach(tfId => {
                          const stats = rawStats[tfId]?.[skin.id];
                          if (stats !== undefined) points.push({ tfId, avg: stats.avg, y: getTopPercent(stats.avg) });
                      });
                      
                      if (points.length === 0) return null;
                      
                      const x = 2 + (i / Math.max(1, sortedChars.length - 1)) * 96; 
                      const recentPt = points[0]; 
                      const oldestPt = points[points.length - 1];
                      const diff = recentPt.avg - oldestPt.avg;
                      const lineColor = diff > 0 ? '#22c55e' : (diff < 0 ? '#ef4444' : '#94a3b8');
                      
                      const isHovered = hoverInfo.active && hoverInfo.chars.some(c => c.skin.id === skin.id);
                      const baseZIndex = isHovered ? 40 : 20;

                      return (
                         <div key={skin.id} className="absolute w-0 h-full pointer-events-none" style={{ left: `${x}%`, top: 0 }}>
                             {points.length > 1 && (
                                 <div className={`absolute w-[2px] -ml-[1px] rounded-full transition-opacity ${isHovered ? 'opacity-100 w-[4px] -ml-[2px]' : 'opacity-30'}`} style={{
                                     top: `${Math.min(recentPt.y, oldestPt.y)}%`,
                                     height: `${Math.abs(recentPt.y - oldestPt.y)}%`,
                                     backgroundColor: lineColor,
                                     zIndex: baseZIndex - 5
                                 }}/>
                             )}
                             
                             {points.map((pt, idx) => {
                                 const isMain = idx === 0;
                                 if (isMain) {
                                    return (
                                        <div key={pt.tfId} className={`absolute bg-cover bg-center rounded-full border-[2px] transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 shadow-md ${isHovered ? 'w-14 h-14 border-[3px] scale-110 shadow-xl z-50 ring-4 ring-white/20' : 'w-9 h-9 opacity-90'}`}
                                          style={{
                                            top: `${pt.y}%`,
                                            backgroundImage: `url(https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${skin.id}.png)`,
                                            borderColor: getMainTierColor(pt.avg),
                                            zIndex: baseZIndex
                                          }}
                                        />
                                    )
                                 } else {
                                    return (
                                        <div key={pt.tfId} className={`absolute rounded-full border border-black/50 transform -translate-x-1/2 -translate-y-1/2 transition-all ${isHovered ? 'w-4 h-4 opacity-100' : 'w-2.5 h-2.5 opacity-50'}`} 
                                            style={{ top: `${pt.y}%`, backgroundColor: getMainTierColor(pt.avg), zIndex: baseZIndex - 1 }}
                                        />
                                    )
                                 }
                             })}
                         </div>
                      )
                  })}
                  
                  {hoverInfo.active && hoverInfo.chars.length > 0 && (
                      <div className="absolute transform -translate-x-1/2 -translate-y-full mb-8 z-[100] pointer-events-none" style={{ left: `${hoverInfo.x}%`, top: `${hoverInfo.chars[0].y}%` }}>
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
                                      <DistributionBar tiers={c.stats.tiers} total={c.stats.count} showLabels />
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

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
                            <th className="p-4 font-semibold min-w-[150px]">Character</th>
                            <th className="p-4 font-semibold text-right min-w-[100px]">{t('avgScore')}</th>
                            <th className="p-4 font-semibold w-[250px] hidden sm:table-cell">Tier Distribution</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {sortedChars.map((skin, i) => {
                            const stats = rawStats[primaryTfId]?.[skin.id];
                            if (!stats) return null;
                            return (
                                <tr key={skin.id} className={`border-t transition ${isDark ? 'border-zinc-700 hover:bg-zinc-700/30' : 'border-slate-100 hover:bg-slate-50'}`}>
                                    <td className="p-4 font-medium opacity-50">{i + 1}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={`https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${skin.id}.png`} className="w-10 h-10 rounded shadow-sm bg-zinc-200" alt=""/>
                                            <span className="font-bold text-base">{skin.nameMap?.[lang] || skin.label}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-lg" style={{ color: getMainTierColor(stats.avg) }}>{stats.avg.toFixed(2)}</span>
                                            <span className="text-[10px] opacity-50 font-semibold">{stats.count} {t('votes')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle hidden sm:table-cell">
                                        <DistributionBar tiers={stats.tiers} total={stats.count} showLabels />
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