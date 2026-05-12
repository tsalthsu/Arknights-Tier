import React, { useState, useEffect, memo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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

const SCORE_MAP = { 'OP': 6, 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };

const TAGS = [
  { id: 'general', label: { ko: '범용성', en: 'General', ja: '汎用性', zh: '泛用性' } },
  { id: 'cc', label: { ko: '위기협약(CC)', en: 'CC', ja: '危機契約', zh: '危机合约' } },
  { id: 'is', label: { ko: '로그라이크(IS)', en: 'IS', ja: 'ローグライク', zh: '集成战略' } },
  { id: 'other', label: { ko: '그외', en: 'Other', ja: 'その他', zh: '其他' } },
];

const MSG = {
  ko: { load4: '4성 불러오기', load5: '5성 불러오기', load6: '6성 불러오기', loadAll: '전체 불러오기', hideNames: '이름 숨기기', showNames: '이름 표시', reset: '초기화', submit: '제출', pool: '대기열', resetConfirm: '모든 배치를 초기화하시겠습니까?', submitConfirm: '최소 5개 이상의 캐릭터를 배치해주세요.', submitSuccess: '제출이 완료되었습니다!', submitTitle: '티어표 제출', submitDesc: '태그를 선택해주세요:', cancel: '취소', loadSuccess: '불러오기 완료!', errorTitle: '오류 발생', alertTitle: '알림', confirmTitle: '확인' },
  en: { load4: 'Load 4★', load5: 'Load 5★', load6: 'Load 6★', loadAll: 'Load All', hideNames: 'Hide Names', showNames: 'Show Names', reset: 'Reset', submit: 'Submit', pool: 'Unranked Pool', resetConfirm: 'Reset all?', submitConfirm: 'Please place at least 5 characters.', submitSuccess: 'Submitted!', submitTitle: 'Submit Tier List', submitDesc: 'Select a category tag:', cancel: 'Cancel', loadSuccess: 'Load complete!', errorTitle: 'Error', alertTitle: 'Notice', confirmTitle: 'Confirm' },
  ja: { load4: '★4 読込', load5: '★5 読込', load6: '★6 読込', loadAll: '全て読込', hideNames: '名前非表示', showNames: '名前表示', reset: 'リセット', submit: '提出', pool: '未配置', resetConfirm: 'すべてリセットしますか？', submitConfirm: '5つ以上のキャラクターを配置してください。', submitSuccess: '提出しました！', submitTitle: 'ティアリスト提出', submitDesc: 'タグを選択してください:', cancel: 'キャンセル', loadSuccess: '読込完了！', errorTitle: 'エラー', alertTitle: 'お知らせ', confirmTitle: '確認' },
  zh: { load4: '加载 4★', load5: '加载 5★', load6: '加载 6★', loadAll: '加载全部', hideNames: '隐藏名称', showNames: '显示名称', reset: '重置', submit: '提交', pool: '未分类', resetConfirm: '重置所有？', submitConfirm: '请至少放置5个角色。', submitSuccess: '提交成功！', submitTitle: '提交节奏榜', submitDesc: '请选择标签:', cancel: '取消', loadSuccess: '加载完成！', errorTitle: '错误', alertTitle: '提示', confirmTitle: '确认' },
};

export default function Maker({ lang, isDark }) {
  const [tiers, setTiers] = useState(INITIAL_TIERS);
  const [pool, setPool] = useState([]);
  const [showNames, setShowNames] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState('general');

  // Custom Modal States
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
    setPool(prev => [...prev, ...newItems]);
    setLoading(false);
    showAlert(t('alertTitle'), t('loadSuccess'));
  };

  const handleReset = () => {
    showConfirm(t('confirmTitle'), t('resetConfirm'), () => {
      setTiers(INITIAL_TIERS);
      setPool([]);
    });
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    let sourceList, destList;
    if (source.droppableId === 'pool') sourceList = Array.from(pool);
    else sourceList = Array.from(tiers.find(t => t.id === source.droppableId).items);

    if (destination.droppableId === 'pool') destList = source.droppableId === 'pool' ? sourceList : Array.from(pool);
    else destList = source.droppableId === destination.droppableId ? sourceList : Array.from(tiers.find(t => t.id === destination.droppableId).items);

    const [removed] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, removed);

    if (source.droppableId === 'pool') setPool(sourceList);
    else setTiers(prev => prev.map(t => t.id === source.droppableId ? { ...t, items: sourceList } : t));

    if (source.droppableId !== destination.droppableId) {
      if (destination.droppableId === 'pool') setPool(destList);
      else setTiers(prev => prev.map(t => t.id === destination.droppableId ? { ...t, items: destList } : t));
    }
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
        if (!score) return;
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

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-2">
          {tiers.map((tier) => (
            <div key={tier.id} className={`flex min-h-[120px] rounded-lg border overflow-hidden ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-300'}`}>
              <div className="w-24 shrink-0 flex items-center justify-center font-black text-3xl text-zinc-900 border-r border-black/10" style={{ backgroundColor: tier.color }}>{tier.id}</div>
              <Droppable droppableId={tier.id} direction="horizontal">
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 p-2 flex flex-wrap content-start gap-2 ${snapshot.isDraggingOver ? (isDark ? 'bg-zinc-700' : 'bg-slate-50') : ''}`}>
                    {tier.items.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => <CharacterCard item={item} provided={provided} snapshot={snapshot} showNames={showNames} lang={lang} isDark={isDark} />}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>

        <div className={`mt-4 p-4 rounded-xl border min-h-[200px] ${isDark ? 'bg-zinc-800/30 border-zinc-700' : 'bg-white border-slate-300'}`}>
          <h3 className="text-sm font-semibold text-zinc-500 mb-3">{t('pool')}</h3>
          <Droppable droppableId="pool">
            {(provided, snapshot) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-2 min-h-[150px]">
                {pool.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => <CharacterCard item={item} provided={provided} snapshot={snapshot} showNames={showNames} lang={lang} isDark={isDark} />}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>

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

const CharacterCard = memo(({ item, provided, snapshot, showNames, lang, isDark }) => {
  const displayName = item.nameMap[lang] || item.label;
  const [imgSrc, setImgSrc] = useState(item.image);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      // Fallback 1: PRTS Wiki via proxy (wsrv.nl handles image proxying and resizing reliably)
      const prtsUrl = `https://prts.wiki/w/Special:FilePath/头像_${item.nameMap.zh}.png`;
      setImgSrc(`https://wsrv.nl/?url=${encodeURIComponent(prtsUrl)}&w=120`);
      setHasError(true);
    } else {
      // Fallback 2: Empty placeholder
      setImgSrc('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    }
  };

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`relative w-20 flex flex-col rounded-md overflow-hidden border shadow-sm transition-shadow select-none
        ${snapshot.isDragging ? 'shadow-2xl scale-105 z-50 ring-2 ring-blue-500' : 'hover:shadow-md'} 
        ${isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-slate-300'}
      `}
      style={{ ...provided.draggableProps.style }}
    >
      <div className="w-full h-20 bg-zinc-200/20 relative">
        <img 
          src={imgSrc} 
          alt={displayName} 
          className="w-full h-full object-cover pointer-events-none"
          draggable="false"
          onError={handleError}
        />
        <div className="absolute top-0 right-0 bg-black/60 text-yellow-400 text-[10px] px-1 font-bold rounded-bl">{item.star}★</div>
      </div>
      {showNames && <div className={`text-center py-1 px-0.5 text-[10px] font-semibold truncate ${isDark ? 'bg-zinc-900/50' : 'bg-slate-100'}`}>{displayName}</div>}
    </div>
  );
});
