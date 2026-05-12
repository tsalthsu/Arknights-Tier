import React, { useState, useEffect, useMemo } from 'react';
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

const SCORE_MAP = { 'OP': 6, 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
const TIER_COLORS = { 'OP': '#ff7f7f', 'S': '#ffbf7f', 'A': '#ffff7f', 'B': '#7fff7f', 'C': '#7fbfff', 'D': '#bfbfbf' };

export default function Stats({ lang, isDark }) {
  const [selectedTag, setSelectedTag] = useState('general');
  const [starFilter, setStarFilter] = useState('all');
  const [selectedTfs, setSelectedTfs] = useState({ '1m': false, '3m': false, '6m': false, '1y': false, 'all': true });
  const [loading, setLoading] = useState(true);
  
  const [rawStats, setRawStats] = useState({});
  const [charList, setCharList] = useState([]);

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
                 if (!score || !items) return;
                 items.forEach(itemId => {
                     if (!skinMap[itemId]) skinMap[itemId] = { total: 0, count: 0 };
                     skinMap[itemId].total += score;
                     skinMap[itemId].count += 1;
                 });
             });
         });
         
         const averages = {};
         Object.keys(skinMap).forEach(k => {
             averages[k] = skinMap[k].total / skinMap[k].count;
         });
         return averages;
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
          if (Object.values(next).every(v => !v)) next['all'] = true; // prevent all unselected
          return next;
      });
  };

  const sortedChars = useMemo(() => {
      let filtered = charList;
      if (starFilter !== 'all') {
          filtered = filtered.filter(c => c.star === parseInt(starFilter));
      }
      return [...filtered].sort((a,b) => (b.releaseTimestamp || 0) - (a.releaseTimestamp || 0));
  }, [charList, starFilter]);

  const activeTfIds = TIMEFRAMES.filter(t => selectedTfs[t.id]).map(t => t.id);

  // Math to spread D tier further down.
  // OP(6)=0%, S(5)=18.18%, A(4)=36.36%, B(3)=54.54%, C(2)=72.72%, D(1)=90.9%
  const getTopPercent = (avg) => ((6.0 - avg) / 5.5) * 100;
  
  const getMainTierColor = (avg) => {
    if (avg >= 5.5) return TIER_COLORS['OP'];
    if (avg >= 4.5) return TIER_COLORS['S'];
    if (avg >= 3.5) return TIER_COLORS['A'];
    if (avg >= 2.5) return TIER_COLORS['B'];
    if (avg >= 1.5) return TIER_COLORS['C'];
    return TIER_COLORS['D'];
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
              {TAGS.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setSelectedTag(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedTag === t.id ? 'bg-blue-600 text-white' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-100 hover:bg-slate-200')}`}
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
        
        <div className="flex flex-wrap gap-2 items-start md:justify-end">
            <span className={`text-sm font-bold opacity-70 mr-2 mt-2 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Timeframes:</span>
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
      </div>

      <div className={`p-6 rounded-xl shadow-lg border relative overflow-hidden flex flex-col ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-xl font-bold bg-black/10 backdrop-blur-sm z-50">Loading...</div>}
        
        <div className="w-full pb-6">
            <div 
              className="relative h-[800px] sm:h-[1000px] border-l-2 border-b-2 bg-[length:100%_18.18%] bg-top mt-10 mb-10 ml-[40px] sm:ml-[50px] transition-all" 
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
                      const avg = rawStats[tfId]?.[skin.id];
                      if (avg !== undefined) points.push({ tfId, avg, y: getTopPercent(avg) });
                  });
                  
                  if (points.length === 0) return null;
                  
                  const x = 2 + (i / Math.max(1, sortedChars.length - 1)) * 96; // 2% to 98%
                  const recentPt = points[0]; 
                  const oldestPt = points[points.length - 1];
                  const diff = recentPt.avg - oldestPt.avg;
                  const lineColor = diff > 0 ? '#22c55e' : (diff < 0 ? '#ef4444' : '#94a3b8');
                  
                  return (
                     <div key={skin.id} className="absolute w-0 h-full group" style={{ left: `${x}%`, top: 0 }}>
                         {/* Draw Line */}
                         {points.length > 1 && (
                             <div className="absolute w-[3px] -ml-[1.5px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity" style={{
                                 top: `${Math.min(recentPt.y, oldestPt.y)}%`,
                                 height: `${Math.abs(recentPt.y - oldestPt.y)}%`,
                                 backgroundColor: lineColor,
                                 zIndex: 10
                             }}/>
                         )}
                         
                         {/* Draw Points */}
                         {points.map((pt, idx) => {
                             const isMain = idx === 0;
                             if (isMain) {
                                const tooltipPos = pt.y < 20 ? 'top-[120%]' : 'bottom-[120%]';
                                return (
                                    <div key={pt.tfId} className="absolute w-10 h-10 bg-cover bg-center rounded-full border-[3px] transform -translate-x-1/2 -translate-y-1/2 transition hover:scale-[1.8] hover:z-[60] cursor-pointer shadow-lg"
                                      style={{
                                        top: `${pt.y}%`,
                                        backgroundImage: `url(https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${skin.id}.png)`,
                                        borderColor: getMainTierColor(pt.avg),
                                        zIndex: 20
                                      }}
                                    >
                                        <div className={`absolute ${tooltipPos} left-1/2 -translate-x-1/2 bg-black/90 text-white p-3 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-2xl border border-zinc-700 z-[70]`}>
                                            <div className="font-bold mb-2 text-sm text-center">{skin.nameMap?.[lang] || skin.label}</div>
                                            {points.map(p => (
                                               <div key={p.tfId} className="flex justify-between gap-4 py-0.5">
                                                  <span className="opacity-70">{TIMEFRAMES.find(t=>t.id===p.tfId).label[lang]}:</span>
                                                  <span className="font-bold" style={{ color: getMainTierColor(p.avg) }}>{p.avg.toFixed(2)}</span>
                                               </div>
                                            ))}
                                            {points.length > 1 && (
                                                <div className={`mt-2 pt-2 border-t border-white/20 text-center font-bold ${diff > 0 ? 'text-green-400' : (diff < 0 ? 'text-red-400' : 'text-slate-300')}`}>
                                                    {diff > 0 ? '▲' : (diff < 0 ? '▼' : '-')} {Math.abs(diff).toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                             } else {
                                return (
                                    <div key={pt.tfId} className="absolute w-3 h-3 rounded-full border border-black/50 transform -translate-x-1/2 -translate-y-1/2 opacity-70 group-hover:opacity-100" 
                                        style={{ top: `${pt.y}%`, backgroundColor: getMainTierColor(pt.avg), zIndex: 15 }}
                                    />
                                )
                             }
                         })}
                     </div>
                  )
              })}
            </div>
        </div>
      </div>
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
