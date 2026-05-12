import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Maker from "./pages/Maker";
import Gallery from "./pages/Gallery";
import Stats from "./pages/Stats";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const isDark = theme === 'dark';

  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ko');
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);

  const location = useLocation();

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const navLinks = [
    { path: "/", label: { en: "Make List", ko: "제작하기", ja: "作成", zh: "制作" } },
    { path: "/gallery", label: { en: "Gallery", ko: "갤러리", ja: "ギャラリー", zh: "画廊" } },
    { path: "/stats", label: { en: "Stats", ko: "통계", ja: "統計", zh: "统计" } }
  ];

  const title = { en: "Arknights Tier List", ko: "명일방주 티어표 제작", ja: "アークナイツ ティアリスト", zh: "明日方舟 节奏榜" }[lang];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
      <header className={`sticky top-0 z-50 backdrop-blur border-b ${isDark ? 'bg-zinc-900/80 border-zinc-700' : 'bg-white/80 border-slate-300'}`}>
        <div className="mx-auto max-w-[1600px] px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xl font-bold uppercase tracking-wide">
            {title}
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={lang} 
              onChange={e => setLang(e.target.value)}
              className={`px-2 py-1 rounded border text-sm focus:outline-none ${isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-slate-300'}`}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>
            <div className="flex gap-2">
              {navLinks.map(link => (
                <Link 
                  key={link.path} 
                  to={link.path} 
                  className={`px-4 py-2 rounded text-sm font-medium transition ${
                    location.pathname === link.path 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : (isDark ? 'bg-zinc-800 border-zinc-600 hover:bg-zinc-700' : 'bg-white border-slate-300 hover:bg-slate-200')
                  } border`}
                >
                  {link.label[lang]}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <Routes>
          <Route path="/" element={<Maker lang={lang} isDark={isDark} />} />
          <Route path="/gallery" element={<Gallery lang={lang} isDark={isDark} />} />
          <Route path="/stats" element={<Stats lang={lang} isDark={isDark} />} />
        </Routes>
      </main>

      <button 
        onClick={toggleTheme}
        className={`fixed bottom-6 left-6 w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg border-2 z-50 transition ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white border-slate-300 text-black'}`}
      >
        {isDark ? '☀️' : '🌙'}
      </button>
    </div>
  );
}
