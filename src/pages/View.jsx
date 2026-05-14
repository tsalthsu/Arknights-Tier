import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { fetchCharacters } from '../utils/dataFetcher';
import ExportPNG from '../components/ExportPNG';

const TIERS = ['OP', 'S', 'A', 'B', 'C', 'D'];
const TIER_COLORS = { 'OP': '#ff7f7f', 'S': '#ffbf7f', 'A': '#ffff7f', 'B': '#7fff7f', 'C': '#7fbfff', 'D': '#bfbfbf' };

const TAGS = [
  { id: 'general', label: { ko: '범용성', en: 'General', ja: '汎用性', zh: '泛用性' } },
  { id: 'cc', label: { ko: '위기협약', en: 'Contingency Contract', ja: '危機契約', zh: '危机合约' } },
  { id: 'is', label: { ko: '통합전략(로그라이크)', en: 'Integrated Strategies', ja: '統合戦略', zh: '集成战略' } },
  { id: 'other', label: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' } },
];

const LANG_MAP = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };

const MSG = {
  ko: { hideNames: '이름 숨기기', showNames: '이름 표시', makeOwn: '나만의 티어표 만들기' },
  en: { hideNames: 'Hide Names', showNames: 'Show Names', makeOwn: 'Make Your Own' },
  ja: { hideNames: '名前非表示', showNames: '名前表示', makeOwn: '作成する' },
  zh: { hideNames: '隐藏名称', showNames: '显示名称', makeOwn: '制作自己的' },
};

export default function View({ lang, isDark }) {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [charMap, setCharMap] = useState({});
  const [showNames, setShowNames] = useState(true);

  const t = (key) => MSG[lang]?.[key] || MSG.en[key];

  useEffect(() => {
    async function load() {
      try {
        const chars = await fetchCharacters();
        const map = {};
        chars.forEach(c => map[c.id] = c);
        setCharMap(map);

        const docRef = doc(db, "tier_results", id);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          setData(snap.data());
        } else {
          setError(true);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20 opacity-50 font-bold">Loading...</div>;
  if (error || !data) return <div className="flex justify-center py-20 text-red-500 font-bold">Tier list not found.</div>;

  const tagName = TAGS.find(t => t.id === data.tag)?.label[lang] || data.tag;
  const serverName = data.server === 'cn' ? 'CN Server' : 'Global Server';
  const formattedDate = new Intl.DateTimeFormat(LANG_MAP[lang] || 'ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(data.timestamp));

  const getNameBgColor = (item) => {
    const IS_EXCLUSIVE_IDS = new Set([
      'char_507_rsnipe', 'char_504_rguard', 'char_506_rmedic', 
      'char_514_rdefend', 'char_514_rdfend', 'char_505_rcast', 
      'char_513_apionr', 'char_510_amedic', 'char_511_asnipe', 
      'char_508_aguard', 'char_509_acast'
    ]);

    if (IS_EXCLUSIVE_IDS.has(item.id)) {
      return isDark ? 'bg-zinc-800/80 text-zinc-300' : 'bg-slate-700 text-slate-100';
    }

    switch (item.star) {
      case 6: return isDark ? 'bg-orange-900/40 text-orange-200' : 'bg-orange-100 text-orange-800';
      case 5: return isDark ? 'bg-yellow-900/40 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
      case 4: return isDark ? 'bg-purple-900/40 text-purple-200' : 'bg-purple-100 text-purple-800';
      case 3: return isDark ? 'bg-sky-900/40 text-sky-200' : 'bg-sky-100 text-sky-800';
      case 2: return isDark ? 'bg-lime-900/40 text-lime-200' : 'bg-lime-100 text-lime-800';
      case 1:
      default: return isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-slate-200 text-slate-700';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full mx-auto">
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide mb-1 flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded text-white ${data.server === 'cn' ? 'bg-red-600' : 'bg-blue-600'}`}>{serverName}</span>
            {tagName}
          </h1>
          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{formattedDate}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button onClick={() => setShowNames(!showNames)} className={`px-4 py-2 rounded text-sm font-bold border transition ${isDark ? 'border-zinc-600 hover:bg-zinc-700' : 'border-slate-300 hover:bg-slate-100'}`}>
              {showNames ? t('hideNames') : t('showNames')}
            </button>
            <Link to="/" className={`px-4 py-2 rounded font-bold text-sm border transition ${isDark ? 'border-zinc-600 hover:bg-zinc-700' : 'border-slate-300 hover:bg-slate-100'}`}>
              {t('makeOwn')}
            </Link>
            <ExportPNG targetId="tierboard" fileName={`tierlist_${id}`} bgColor={isDark ? '#27272a' : '#f8fafc'} />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div id="tierboard" className="flex flex-col gap-2 p-4 rounded-xl min-w-[800px] w-full mx-auto border border-transparent">
          {TIERS.map(tier => {
            const items = data.tiers[tier] || [];
            return (
              <div key={tier} className={`tier-row flex min-h-[100px] rounded-lg border overflow-hidden ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-300'}`}>
                <div className="w-20 shrink-0 flex items-center justify-center font-black text-3xl text-zinc-900 border-r border-black/10" style={{ backgroundColor: TIER_COLORS[tier] }}>
                  {tier}
                </div>
                <div className="tier-items flex-1 p-2 flex flex-wrap content-start items-start gap-2">
                  {items.map(itemId => {
                    const char = charMap[itemId];
                    if (!char) return null;
                    
                    const displayName = char.nameMap[lang] || char.label;
                    
                    return (
                      <div key={char.id} className={`relative w-16 flex flex-col rounded-md overflow-hidden border shadow-sm ${isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-slate-300'}`}>
                        <div className="w-full h-16 bg-zinc-200/20 relative">
                          <img 
                            src={`https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${char.id}.png`}
                            alt={displayName} 
                            className="w-full h-full object-cover"
                            draggable="false"
                            onError={(e) => { 
                              if (!e.target.src.includes('wsrv.nl')) {
                                e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; 
                              }
                            }}
                          />
                          <div data-export-hide="true" className="absolute top-0 right-0 bg-black/60 text-yellow-400 text-[10px] px-1 font-bold rounded-bl">{char.star}★</div>
                        </div>
                        {showNames && (
                          <div className={`text-center py-1 px-0.5 text-[9px] font-semibold truncate ${getNameBgColor(char)}`}>
                            {displayName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
