import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Maker from "./pages/Maker";
import Gallery from "./pages/Gallery";
import Stats from "./pages/Stats";
import logoImg from "./assets/ri-logo.webp";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const isDark = theme === 'dark';

  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ko');
  const [langOpen, setLangOpen] = useState(false);
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);

  const location = useLocation();

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const navLinks = [
    { path: "/", label: { en: "Make List", ko: "제작하기", ja: "作成", zh: "制作" } },
    { path: "/gallery", label: { en: "Gallery", ko: "갤러리", ja: "ギャラリー", zh: "画廊" } },
    { path: "/stats", label: { en: "Stats", ko: "통계", ja: "統計", zh: "统计" } }
  ];

  const langs = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文' };
  const title = { en: "Arknights Tier List", ko: "명일방주 티어표 제작", ja: "アークナイツ ティアリスト", zh: "明日方舟 节奏榜" }[lang];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
      <header className={`sticky top-0 z-50 backdrop-blur border-b ${isDark ? 'bg-zinc-900/80 border-zinc-700' : 'bg-white/80 border-slate-300'}`}>
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Logo" className="w-8 h-8 object-contain drop-shadow-md" />
            <div className="text-xl font-black uppercase tracking-wide">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setLangOpen(!langOpen)} 
                onBlur={() => setTimeout(() => setLangOpen(false), 200)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-2 transition focus:outline-none ${isDark ? 'bg-zinc-800 border-zinc-600 hover:bg-zinc-700 shadow-sm' : 'bg-white border-slate-300 hover:bg-slate-50 shadow-sm'}`}
              >
                <span>🌐 {langs[lang]}</span>
                <span className="text-[10px] opacity-60">▼</span>
              </button>
              {langOpen && (
                <div className={`absolute top-full mt-1 right-0 w-32 rounded-xl shadow-2xl border overflow-hidden z-50 ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
                  {Object.entries(langs).map(([k, v]) => (
                    <button 
                      key={k} 
                      onClick={() => { setLang(k); setLangOpen(false); }} 
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition ${lang === k ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700') : (isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-slate-100 text-slate-700')}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {navLinks.map(link => (
                <Link 
                  key={link.path} 
                  to={link.path} 
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                    location.pathname === link.path 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                      : (isDark ? 'bg-zinc-800 border-zinc-600 hover:bg-zinc-700 text-zinc-300' : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-600')
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
