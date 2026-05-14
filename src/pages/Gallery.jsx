import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, increment, startAfter } from 'firebase/firestore';
import CustomModal from '../components/CustomModal';

const TAGS = [
  { id: 'all', label: { ko: '전체', en: 'All', ja: 'すべて', zh: '全部' } },
  { id: 'general', label: { ko: '범용성', en: 'General', ja: '汎用性', zh: '泛用性' } },
  { id: 'cc', label: { ko: '위기협약', en: 'Contingency Contract', ja: '危機契約', zh: '危机合约' } },
  { id: 'is', label: { ko: '통합전략(로그라이크)', en: 'Integrated Strategies', ja: '統合戦略', zh: '集成战略' } },
  { id: 'other', label: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' } },
];

const TIERS = ['OP', 'S', 'A', 'B', 'C', 'D'];
const TIER_COLORS = { 'OP': '#ff7f7f', 'S': '#ffbf7f', 'A': '#ffff7f', 'B': '#7fff7f', 'C': '#7fbfff', 'D': '#bfbfbf' };

const MSG = {
  ko: { reportConfirm: '이 티어표를 신고하시겠습니까?', reported: '신고가 접수되었습니다.', clickToExpand: '▼ 클릭하여 전체 보기 ▼', reportTitle: '신고', alertTitle: '알림', cancel: '취소', serverGlobal: '글로벌 서버', serverCN: '중국 서버', serverAll: '전체 서버', reportBtn: '🚨 신고하기', alreadyReported: '이미 신고한 게시물입니다.' },
  en: { reportConfirm: 'Report this tier list?', reported: 'Report has been submitted.', clickToExpand: '▼ Click to expand ▼', reportTitle: 'Report', alertTitle: 'Notice', cancel: 'Cancel', serverGlobal: 'Global', serverCN: 'CN', serverAll: 'All Servers', reportBtn: '🚨 Report', alreadyReported: 'You have already reported this.' },
  ja: { reportConfirm: 'このティアリストを通報しますか？', reported: '通報を受け付けました。', clickToExpand: '▼ クリックしてすべて表示 ▼', reportTitle: '通報', alertTitle: 'お知らせ', cancel: 'キャンセル', serverGlobal: 'グローバル', serverCN: '中国サーバー', serverAll: '全サーバー', reportBtn: '🚨 通報', alreadyReported: 'すでに通報済みです。' },
  zh: { reportConfirm: '举报此节奏榜？', reported: '举报已提交。', clickToExpand: '▼ 点击展开全部 ▼', reportTitle: '举报', alertTitle: '提示', cancel: '取消', serverGlobal: '国际服', serverCN: '国服', serverAll: '所有服务器', reportBtn: '🚨 举报', alreadyReported: '您已经举报过此内容。' },
};

const LANG_MAP = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };

export default function Gallery({ lang, isDark }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTag, setSelectedTag] = useState('all');
  const [serverFilter, setServerFilter] = useState('all');
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });
  const t = (key) => MSG[lang]?.[key] || MSG.en[key];

  useEffect(() => {
    fetchGallery(true);
  }, [selectedTag, serverFilter]);

  const fetchGallery = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setSubmissions([]);
    } else {
      setLoadingMore(true);
    }

    try {
      let q = collection(db, "tier_results");
      let constraints = [orderBy("timestamp", "desc"), limit(40)]; // Fetch 40 to account for local filtering
      
      if (!reset && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      q = query(q, ...constraints);
      const snap = await getDocs(q);
      
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      let filteredData = data;
      if (selectedTag !== 'all') {
        filteredData = filteredData.filter(d => d.tag === selectedTag);
      }
      if (serverFilter !== 'all') {
        // Handle older submissions without server field by defaulting them to 'global', or strict match
        filteredData = filteredData.filter(d => (d.server || 'global') === serverFilter);
      }

      if (reset) {
        setSubmissions(filteredData);
      } else {
        setSubmissions(prev => [...prev, ...filteredData]);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 40); 

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const showConfirm = (title, message, onConfirmAction) => {
    setModalConfig({
      isOpen: true, title, message, type: 'confirm',
      onConfirm: () => {
        setModalConfig({ ...modalConfig, isOpen: false });
        onConfirmAction();
      }
    });
  };

  const showAlert = (title, message) => {
    setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: () => setModalConfig({ ...modalConfig, isOpen: false }) });
  };

  const handleReport = (id) => {
    const reportedItems = JSON.parse(localStorage.getItem('reportedItems') || '[]');
    if (reportedItems.includes(id)) {
      showAlert(t('alertTitle'), t('alreadyReported'));
      return;
    }

    showConfirm(t('reportTitle'), t('reportConfirm'), async () => {
      try {
        await updateDoc(doc(db, "tier_results", id), {
          reports: increment(1)
        });
        
        reportedItems.push(id);
        localStorage.setItem('reportedItems', JSON.stringify(reportedItems));

        showAlert(t('alertTitle'), t('reported'));
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, reports: (s.reports || 0) + 1 } : s));
      } catch (e) {
        console.error(e);
      }
    });
  };

  const filtered = submissions;

  return (
    <div className="flex flex-col gap-6">
      <CustomModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        isDark={isDark}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.type === 'confirm' ? () => setModalConfig({ ...modalConfig, isOpen: false }) : null}
        confirmText="OK"
        cancelText={t('cancel')}
      />

      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-wrap gap-2">
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
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-between md:justify-end border-t border-zinc-200 dark:border-zinc-700 pt-3 md:pt-0 md:border-t-0">
          <div className="flex gap-2">
            {[
              { id: 'all', label: t('serverAll') },
              { id: 'global', label: t('serverGlobal') },
              { id: 'cn', label: t('serverCN') }
            ].map(s => (
              <button 
                key={s.id}
                onClick={() => setServerFilter(s.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${serverFilter === s.id ? 'bg-indigo-600 text-white' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-slate-100 hover:bg-slate-200')}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={() => fetchGallery(true)} disabled={loading} className={`px-4 py-2 rounded-lg text-sm border ${isDark ? 'border-zinc-600 hover:bg-zinc-700' : 'border-slate-300 hover:bg-slate-100'}`}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading && <div className="col-span-full text-center py-10 opacity-50">Loading...</div>}
        {!loading && filtered.length === 0 && <div className="col-span-full text-center py-10 opacity-50">No submissions found.</div>}
        
        {filtered.map(sub => (
          <SubmissionCard key={sub.id} sub={sub} lang={lang} isDark={isDark} handleReport={handleReport} t={t} />
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

function SubmissionCard({ sub, lang, isDark, handleReport, t }) {
  const [expanded, setExpanded] = useState(false);
  const firstTier = TIERS.find(t => sub.tiers[t] && sub.tiers[t].length > 0) || 'OP';
  
  const formattedDate = new Intl.DateTimeFormat(LANG_MAP[lang] || 'ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(sub.timestamp));

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm transition-colors ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
      <div className={`px-4 py-3 border-b flex justify-between items-center ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-bold ${isDark ? 'bg-zinc-700' : 'bg-slate-200'}`}>
            {TAGS.find(t => t.id === sub.tag)?.label[lang] || sub.tag}
          </span>
          <span className="text-sm opacity-60">{formattedDate}</span>
        </div>
        <button onClick={() => handleReport(sub.id)} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1 font-medium">
          {t('reportBtn')}
        </button>
      </div>
      <div 
        className={`p-4 flex flex-col gap-2 cursor-pointer transition ${isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-slate-50'}`} 
        onClick={() => setExpanded(!expanded)}
      >
        {TIERS.map(tier => {
          const items = sub.tiers[tier] || [];
          if (items.length === 0) return null;
          if (!expanded && tier !== firstTier) return null; 
          
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
            {t('clickToExpand')}
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
