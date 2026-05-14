import React, { useState, useEffect, memo, forwardRef } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { fetchCharacters } from '../utils/dataFetcher';
import { db } from '../firebase';
import { collection, doc, increment, getDoc, writeBatch } from 'firebase/firestore';
import CustomModal from '../components/CustomModal';

const INITIAL_TIERS = [
  { id: 'OP', color: '#ff7f7f', items: [] },
  { id: 'S', color: '#ffbf7f', items: [] },
  { id: 'A', color: '#ffff7f', items: [] },
  { id: 'B', color: '#7fff7f', items: [] },
  { id: 'C', color: '#7fbfff', items: [] },
  { id: 'D', color: '#bfbfbf', items: [] },
];

const SCORE_MAP = { 'OP': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1, 'D': 0 };

const TAGS = [
  { id: 'general', label: { ko: '범용성', en: 'General', ja: '汎用性', zh: '泛用性' } },
  { id: 'cc', label: { ko: '위기협약', en: 'Contingency Contract', ja: '危機契約', zh: '危机合约' } },
  { id: 'is', label: { ko: '통합전략(로그라이크)', en: 'Integrated Strategies', ja: '統合戦略', zh: '集成战略' } },
  { id: 'other', label: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' } },
];

const MSG = {
  ko: { load3: '3성 불러오기', load4: '4성 불러오기', load5: '5성 불러오기', load6: '6성 불러오기', loadAll: '전체 불러오기', hideNames: '이름 숨기기', showNames: '이름 표시', reset: '초기화', submit: '제출', pool: '대기열', resetConfirm: '모든 배치를 초기화하시겠습니까?', submitConfirm: '최소 5개 이상의 캐릭터를 배치해주세요.', submitSuccess: '제출이 완료되었습니다!', submitTitle: '티어표 제출', submitDesc: '태그를 선택해주세요:', cancel: '취소', loadSuccess: '불러오기 완료!', errorTitle: '오류 발생', alertTitle: '알림', confirmTitle: '확인', sortRelease: '출시순', sortName: '이름순', sortStar: '성급순' },
  en: { load3: 'Load 3★', load4: 'Load 4★', load5: 'Load 5★', load6: 'Load 6★', loadAll: 'Load All', hideNames: 'Hide Names', showNames: 'Show Names', reset: 'Reset', submit: 'Submit', pool: 'Unranked Pool', resetConfirm: 'Reset all?', submitConfirm: 'Please place at least 5 characters.', submitSuccess: 'Submitted!', submitTitle: 'Submit Tier List', submitDesc: 'Select a category tag:', cancel: 'Cancel', loadSuccess: 'Load complete!', errorTitle: 'Error', alertTitle: 'Notice', confirmTitle: 'Confirm', sortRelease: 'Release', sortName: 'Name', sortStar: 'Rarity' },
  ja: { load3: '★3 読込', load4: '★4 読込', load5: '★5 読込', load6: '★6 読込', loadAll: '全て読込', hideNames: '名前非表示', showNames: '名前表示', reset: 'リセット', submit: '提出', pool: '未配置', resetConfirm: 'すべてリセットしますか？', submitConfirm: '5つ以上のキャラクターを配置してください。', submitSuccess: '提出しました！', submitTitle: 'ティアリスト提出', submitDesc: 'タグを選択してください:', cancel: 'キャンセル', loadSuccess: '読込完了！', errorTitle: 'エラー', alertTitle: 'お知らせ', confirmTitle: '確認', sortRelease: '実装順', sortName: '名前順', sortStar: 'レア順' },
  zh: { load3: '加载 3★', load4: '加载 4★', load5: '加载 5★', load6: '加载 6★', loadAll: '加载全部', hideNames: '隐藏名称', showNames: '显示名称', reset: '重置', submit: '提交', pool: '未分类', resetConfirm: '重置所有？', submitConfirm: '请至少放置5个角色。', submitSuccess: '提交成功！', submitTitle: '提交节奏榜', submitDesc: '请选择标签:', cancel: '取消', loadSuccess: '加载完成！', errorTitle: '错误', alertTitle: '提示', confirmTitle: '确认', sortRelease: '实装顺序', sortName: '名称顺序', sortStar: '星级顺序' },
};

export default function Maker({ lang, isDark }) {
  const [tiers, setTiers] = useState(INITIAL_TIERS);
  const [pool, setPool] = useState([]);
  const [showNames, setShowNames] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState('general');
  const [sortConfig, setSortConfig] = useState({ key: 'name', dir: 'asc' });

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });

  const t = (key) => MSG[lang]?.[key] || MSG.en[key];

  const showAlert = (title, message) => {
    setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: () => setModalConfig({ ...modalConfig, isOpen: false }) });
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

  const getSortedArray = (arr, key, dir) => {
    return [...arr].sort((a, b) => {
       if (key === 'name') {
         const valA = a.nameMap[lang] || a.label;
         const valB = b.nameMap[lang] || b.label;
         return dir === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
       }
       const valA = key === 'release' ? (a.releaseTimestamp || 0) : (a.star || 0);
       const valB = key === 'release' ? (b.releaseTimestamp || 0) : (b.star || 0);
       if (valA === valB) {
           const nA = a.nameMap[lang] || a.label;
           const nB = b.nameMap[lang] || b.label;
           return nA.localeCompare(nB);
       }
       return dir === 'desc' ? valB - valA : valA - valB;
    });
  };

  const handleLoad = async (starTarget) => {
    setLoading(true);
    const chars = await fetchCharacters();
    let filtered = chars;
    if (starTarget !== 'all') {
      filtered = chars.filter(c => c.star === parseInt(starTarget));
    }
    
    const existingIds = new Set();
    tiers.forEach(t => t.items.forEach(i => existingIds.add(i.id)));
    pool.forEach(i => existingIds.add(i.id));

    const newItems = filtered.filter(c => !existingIds.has(c.id));
    
    // 항상 현재 정렬 상태(이름순/언어)에 맞춰서 병합 후 정렬
    setPool(prev => getSortedArray([...prev, ...newItems], sortConfig.key, sortConfig.dir));
    
    setLoading(false);
    showAlert(t('alertTitle'), t('loadSuccess'));
  };

  const handleReset = () => {
    showConfirm(t('confirmTitle'), t('resetConfirm'), () => {
      setTiers(INITIAL_TIERS);
      setPool([]);
    });
  };

  const handleSortPool = (key) => {
    let dir = 'desc';
    if (sortConfig.key === key) dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    else if (key === 'name') dir = 'asc'; // 이름순 정렬 초기 클릭 시 오름차순(A-Z) 기본
    setSortConfig({ key, dir });

    setPool(prev => getSortedArray(prev, key, dir));
  };

  const handleSubmit = async () => {
    let placedCount = 0;
    const tierData = {};
    tiers.forEach(t => {
      tierData[t.id] = t.items.map(i => i.id);
      placedCount += t.items.length;
    });

    if (placedCount < 5) {
      showAlert(t('alertTitle'), t('submitConfirm'));
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);

      const newResultRef = doc(collection(db, "tier_results"));
      batch.set(newResultRef, {
        timestamp: new Date().toISOString(),
        tag: selectedTag,
        tiers: tierData,
        reports: 0
      });

      const statsRef = doc(db, "statistics", `summary_${selectedTag}`);
      const statsDoc = await getDoc(statsRef);
      if (!statsDoc.exists()) {
        batch.set(statsRef, { totalSubmissions: 0, skins: {} });
      }

      const updates = {
        totalSubmissions: increment(1),
        lastUpdated: new Date().toISOString()
      };

      tiers.forEach(t => {
        const score = SCORE_MAP[t.id];
        if (!score && score !== 0) return;
        t.items.forEach(item => {
          const safeKey = item.id.replace(/\./g, '_');
          updates[`skins.${safeKey}.totalScore`] = increment(score);
          updates[`skins.${safeKey}.count`] = increment(1);
          updates[`skins.${safeKey}.tierCounts.${t.id}`] = increment(1);
          updates[`skins.${safeKey}.id`] = item.id;
          updates[`skins.${safeKey}.image`] = item.image;
        });
      });

      batch.update(statsRef, updates);
      await batch.commit();

      setSubmitModal(false);
      showAlert(t('alertTitle'), t('submitSuccess'));
    } catch (e) {
      console.error(e);
      showAlert(t('errorTitle'), "Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

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

      <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-3 shadow-sm ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <button onClick={() => handleLoad('3')} disabled={loading} className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50">{t('load3')}</button>
        <button onClick={() => handleLoad('4')} disabled={loading} className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50">{t('load4')}</button>
        <button onClick={() => handleLoad('5')} disabled={loading} className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50">{t('load5')}</button>
        <button onClick={() => handleLoad('6')} disabled={loading} className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50">{t('load6')}</button>
        <button onClick={() => handleLoad('all')} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">{t('loadAll')}</button>
        <div className="flex-grow"></div>
        <button onClick={() => setShowNames(!showNames)} className={`px-4 py-2 rounded border ${isDark ? 'border-zinc-600 hover:bg-zinc-700' : 'border-slate-300 hover:bg-slate-100'}`}>
          {showNames ? t('hideNames') : t('showNames')}
        </button>
        <button onClick={handleReset} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500">{t('reset')}</button>
        <button onClick={() => setSubmitModal(true)} className="px-6 py-2 rounded bg-emerald-600 font-bold text-white hover:bg-emerald-500">{t('submit')}</button>
      </div>

      <div className="flex flex-col gap-2">
        {tiers.map((tier) => (
          <div key={tier.id} className={`flex min-h-[120px] rounded-lg border overflow-hidden ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-300'}`}>
            <div className="w-24 shrink-0 flex items-center justify-center font-black text-3xl text-zinc-900 border-r border-black/10" style={{ backgroundColor: tier.color }}>
              {tier.id}
            </div>
            <ReactSortable
              group="shared"
              animation={150}
              delay={0}
              scroll={true}
              scrollSensitivity={150}
              scrollSpeed={20}
              forceFallback={true}
              fallbackClass="sortable-fallback"
              ghostClass="sortable-ghost"
              dragClass="sortable-drag"
              fallbackOnBody={true}
              list={tier.items}
              setList={(newState) => {
                setTiers(prev => prev.map(t => t.id === tier.id ? { ...t, items: newState } : t));
              }}
              className={`flex-1 p-2 flex flex-wrap content-start gap-2 ${isDark ? 'hover:bg-zinc-700/30' : 'hover:bg-slate-50/50'} transition-colors`}
            >
              {tier.items.map(item => (
                <CharacterCard key={item.id} item={item} showNames={showNames} lang={lang} isDark={isDark} />
              ))}
            </ReactSortable>
          </div>
        ))}
      </div>

      <div className={`mt-4 p-4 rounded-xl border min-h-[200px] ${isDark ? 'bg-zinc-800/30 border-zinc-700' : 'bg-white border-slate-300'}`}>
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-sm font-semibold text-zinc-500">{t('pool')} ({pool.length})</h3>
          <div className="flex gap-2">
            {['release', 'name', 'star'].map(k => (
              <button 
                key={k} 
                onClick={() => handleSortPool(k)}
                className={`px-3 py-1 text-xs font-medium rounded transition ${sortConfig.key === k ? 'bg-blue-600 text-white' : (isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}`}
              >
                {k === 'release' ? t('sortRelease') : k === 'name' ? t('sortName') : t('sortStar')}
                {sortConfig.key === k && (sortConfig.dir === 'desc' ? ' ↓' : ' ↑')}
              </button>
            ))}
          </div>
        </div>
        <ReactSortable
          group="shared"
          animation={0} // 애니메이션 제거하여 대기열 렉 방지
          delay={0}
          scroll={true}
          scrollSensitivity={150}
          scrollSpeed={20}
          forceFallback={true}
          fallbackClass="sortable-fallback"
          ghostClass="sortable-ghost"
          dragClass="sortable-drag"
          fallbackOnBody={true}
          list={pool}
          setList={setPool}
          className="flex flex-wrap items-start gap-2 min-h-[150px]"
        >
          {pool.map(item => (
            <CharacterCard key={item.id} item={item} showNames={showNames} lang={lang} isDark={isDark} />
          ))}
        </ReactSortable>
      </div>

      {submitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className={`max-w-md w-full p-6 rounded-2xl shadow-2xl ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">{t('submitTitle')}</h2>
            <p className="mb-4 text-sm opacity-80">{t('submitDesc')}</p>
            <div className="flex flex-col gap-2 mb-6">
              {TAGS.map(t => (
                <label key={t.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${selectedTag === t.id ? 'border-blue-500 bg-blue-500/10' : (isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-50')}`}>
                  <input type="radio" name="tag" value={t.id} checked={selectedTag === t.id} onChange={(e) => setSelectedTag(e.target.value)} className="w-4 h-4 text-blue-600"/>
                  <span className="font-medium">{t.label[lang]}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setSubmitModal(false)} className={`px-4 py-2 rounded border ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-slate-300 hover:bg-slate-100'}`}>{t('cancel')}</button>
              <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                {loading ? 'Submitting...' : t('submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CharacterCard = memo(forwardRef(({ item, showNames, lang, isDark }, ref) => {
  const displayName = item.nameMap[lang] || item.label;
  const [imgSrc, setImgSrc] = useState(item.image);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      const prtsUrl = `https://prts.wiki/w/Special:FilePath/头像_${item.nameMap.zh}.png`;
      setImgSrc(`https://wsrv.nl/?url=${encodeURIComponent(prtsUrl)}&w=120`);
      setHasError(true);
    } else {
      setImgSrc('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    }
  };

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
    <div
      ref={ref}
      data-id={item.id}
      className={`relative w-20 flex flex-col rounded-md overflow-hidden border shadow-sm select-none cursor-grab
        hover:shadow-lg hover:-translate-y-1 hover:z-10
        ${isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-slate-300'}
      `}
      style={{ touchAction: 'none', transform: 'translate3d(0,0,0)' }}
    >
      <div className="w-full h-20 bg-zinc-200/20 relative pointer-events-none">
        <img 
          src={imgSrc} 
          alt={displayName} 
          className="w-full h-full object-cover pointer-events-none"
          draggable="false"
          onDragStart={(e) => e.preventDefault()}
          onError={handleError}
        />
        <div className="absolute top-0 right-0 bg-black/60 text-yellow-400 text-[10px] px-1 font-bold rounded-bl">{item.star}★</div>
      </div>
      {showNames && <div className={`text-center py-1 px-0.5 text-[10px] font-semibold truncate ${getNameBgColor(item)}`}>{displayName}</div>}
    </div>
  );
}));