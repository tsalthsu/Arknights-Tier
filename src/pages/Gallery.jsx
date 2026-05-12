import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, increment, startAfter } from 'firebase/firestore';

const TAGS = [
  { id: 'all', label: { ko: '전체', en: 'All', ja: 'すべて', zh: '全部' } },
  { id: 'general', label: { ko: '범용성', en: 'General', ja: '汎用性', zh: '泛用性' } },
  { id: 'cc', label: { ko: '위기협약(CC)', en: 'CC', ja: '危機契約', zh: '危机合约' } },
  { id: 'is', label: { ko: '로그라이크(IS)', en: 'IS', ja: 'ローグライク', zh: '集成战略' } },
  { id: 'other', label: { ko: '그외', en: 'Other', ja: 'その他', zh: '其他' } },
];

const TIERS = ['OP', 'S', 'A', 'B', 'C', 'D'];
const TIER_COLORS = { 'OP': '#ff7f7f', 'S': '#ffbf7f', 'A': '#ffff7f', 'B': '#7fff7f', 'C': '#7fbfff', 'D': '#bfbfbf' };

export default function Gallery({ lang, isDark }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTag, setSelectedTag] = useState('all');
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchGallery(true);
  }, [selectedTag]);

  const fetchGallery = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setSubmissions([]);
    } else {
      setLoadingMore(true);
    }

    try {
      let q = collection(db, "tier_results");
      let constraints = [orderBy("timestamp", "desc"), limit(20)];
      
      if (!reset && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      q = query(q, ...constraints);
      const snap = await getDocs(q);
      
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      let filteredData = data;
      if (selectedTag !== 'all') {
        filteredData = data.filter(d => d.tag === selectedTag);
      }

      if (reset) {
        setSubmissions(filteredData);
      } else {
        setSubmissions(prev => [...prev, ...filteredData]);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 20); 

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleReport = async (id) => {
    if (!window.confirm("이 티어표를 신고하시겠습니까? (Report this tier list?)")) return;
    try {
      await updateDoc(doc(db, "tier_results", id), {
        reports: increment(1)
      });
      alert("신고가 접수되었습니다. (Reported)");
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, reports: (s.reports || 0) + 1 } : s));
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = submissions.filter(s => {
    if ((s.reports || 0) >= 5) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className={`p-4 rounded-xl border flex flex-wrap gap-2 ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        {TAGS.map(t => (
          <button 
            key={t.id}
            onClick={() => setSelectedTag(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedTag === t.id ? 'bg-blue-600 text-white' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-100 hover:bg-slate-200')}`}
          >
            {t.label[lang]}
          </button>
        ))}
        <div className="flex-grow"></div>
        <button onClick={() => fetchGallery(true)} disabled={loading} className={`px-4 py-2 rounded-lg text-sm border ${isDark ? 'border-zinc-600 hover:bg-zinc-700' : 'border-slate-300 hover:bg-slate-100'}`}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading && <div className="col-span-full text-center py-10 opacity-50">Loading...</div>}
        {!loading && filtered.length === 0 && <div className="col-span-full text-center py-10 opacity-50">No submissions found.</div>}
        
        {filtered.map(sub => (
          <SubmissionCard key={sub.id} sub={sub} lang={lang} isDark={isDark} handleReport={handleReport} />
        ))}
        
        {!loading && hasMore && (
          <button 
            onClick={() => fetchGallery(false)} 
            disabled={loadingMore}
            className={`col-span-full py-3 rounded-xl border font-bold ${isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-white border-slate-300 hover:bg-slate-100'}`}
          >
            {loadingMore ? 'Loading More...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
}

function SubmissionCard({ sub, lang, isDark, handleReport }) {
  const [expanded, setExpanded] = useState(false);

  // Find the highest tier that actually has items to show as the preview
  const firstTier = TIERS.find(t => sub.tiers[t] && sub.tiers[t].length > 0) || 'OP';

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm transition-colors ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
      <div className={`px-4 py-3 border-b flex justify-between items-center ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-bold ${isDark ? 'bg-zinc-700' : 'bg-slate-200'}`}>
            {TAGS.find(t => t.id === sub.tag)?.label[lang] || sub.tag}
          </span>
          <span className="text-sm opacity-60">{new Date(sub.timestamp).toLocaleString()}</span>
        </div>
        <button onClick={() => handleReport(sub.id)} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1 font-medium">
          🚨 Report
        </button>
      </div>
      <div 
        className={`p-4 flex flex-col gap-2 cursor-pointer transition ${isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-slate-50'}`} 
        onClick={() => setExpanded(!expanded)}
      >
        {TIERS.map(tier => {
          const items = sub.tiers[tier] || [];
          if (items.length === 0) return null;
          if (!expanded && tier !== firstTier) return null; // Show only the highest tier when collapsed
          
          return (
            <div key={tier} className="flex gap-2">
              <div className="w-12 h-12 shrink-0 flex items-center justify-center font-bold text-black rounded" style={{ backgroundColor: TIER_COLORS[tier] }}>
                {tier}
              </div>
              <div className="flex flex-wrap gap-1">
                {items.map(imgId => (
                  <GalleryImage key={imgId} imgId={imgId} />
                ))}
              </div>
            </div>
          );
        })}
        
        {!expanded && (
          <div className="text-center mt-2 text-sm font-bold opacity-40 hover:opacity-80 transition">
            ▼ Click to expand (클릭하여 전체 보기) ▼
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryImage({ imgId }) {
  const [imgSrc, setImgSrc] = useState(`https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${imgId}.png`);
  
  return (
    <img 
      src={imgSrc} 
      alt={imgId}
      className="w-12 h-12 object-cover rounded bg-zinc-200"
      onError={(e) => { 
        if (!imgSrc.includes('wsrv.nl')) {
          e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; 
        }
      }}
    />
  );
}
