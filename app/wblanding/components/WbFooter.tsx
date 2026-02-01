"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FaGithub, FaShieldHalved, FaFileContract, FaScroll, FaGavel, FaSpinner, FaExternalLinkAlt } from "react-icons/fa6";
import { PrivacyModal } from "./PrivacyModal";

// Компонент для отображения raw Markdown (constitution)
const ConstitutionModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Digital Company принцип: тянем истину из репо, не дублируем её в UI
  useEffect(() => {
    if (isOpen) {
      // Используем raw GitHub для получения актуальной версии (или local fallback)
      const constitutionUrl = 'https://raw.githubusercontent.com/salavey13/carTest/main/CONSTITUTION.md';
      
      fetch(constitutionUrl)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: Конституция недоступна`);
          return res.text();
        })
        .then(text => {
          // Убираем первую строку HTML-комментария (мета-инфа), если она есть
          const cleanText = text.replace(/^<!--.*?-->\s*/s, '');
          setContent(cleanText);
          setLoading(false);
        })
        .catch(err => {
          console.error('Constitution fetch failed:', err);
          setError('Не удалось загрузить Конституцию из реестра. Возможно, GitHub недоступен или файл перемещён.');
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-brand-cyan/30 rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,255,255,0.15)] flex flex-col">
        
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950/95 border-b border-brand-cyan/20 p-4 flex justify-between items-center backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <FaGavel className="text-brand-cyan w-6 h-6 animate-pulse" />
            <div>
              <h2 className="text-2xl font-bold text-white font-orbitron tracking-wider">
                КОНСТИТУЦИЯ <span className="text-brand-cyan text-sm align-top">LIVE</span>
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-1">
                Загружено напрямую из репозитория (Single Source of Truth)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href="https://github.com/salavey13/carTest/blob/main/CONSTITUTION.md"
              target="_blank"
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-brand-cyan border border-brand-cyan/30 rounded transition-all"
            >
              <FaExternalLinkAlt /> GitHub
            </Link>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-zinc-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
              <FaSpinner className="w-8 h-8 animate-spin mb-4 text-brand-cyan" />
              <p className="font-mono text-sm">Загрузка из Company Ledger...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-400">
              <p className="font-mono mb-4">{error}</p>
              <Link 
                href="https://github.com/salavey13/carTest/blob/main/CONSTITUTION.md"
                target="_blank"
                className="text-brand-cyan hover:underline text-sm"
              >
                Открыть оригинал на GitHub →
              </Link>
            </div>
          ) : (
            <div className="prose prose-invert prose-lg max-w-none font-mono">
              {/* Простой рендеринг markdown без парсера (для надёжности) 
                  или можно использовать react-markdown, но здесь чистый vibe */}
              <pre className="whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed bg-transparent p-0 font-mono">
                {content}
              </pre>
            </div>
          )}
        </div>

        {/* Constitutional Footer */}
        <div className="sticky bottom-0 bg-zinc-950 border-t border-brand-cyan/20 p-4 flex justify-between items-center text-xs text-zinc-600 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Amendment #912 Active
          </div>
          <div>
            salavey13/carTest/main/CONSTITUTION.md
          </div>
        </div>
      </div>
    </div>
  );
};

export const WbFooter = () => {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);

  return (
    <>
      <footer className="bg-black py-10 border-t border-zinc-800 text-zinc-500 text-xs sm:text-sm font-mono relative overflow-hidden">
        {/* Глитч-эффект для цифровой эстетики */}
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(transparent_50%,rgba(0,255,255,0.1)_50%)] bg-[length:100%_4px]" />
        
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <div className="text-center md:text-left space-y-1">
            <p className="text-white font-bold text-lg tracking-tight">oneSitePls <span className="text-brand-cyan">v2.0</span></p>
            <p>© {new Date().getFullYear()} // Digital Organism Mode</p>
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest">
              Powered by <span className="text-brand-cyan">CyberVibe</span> • <span className="text-brand-pink">Sovereign Software</span>
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-5 sm:gap-8 items-center">
            <Link 
              href="https://github.com/salavey13/carTest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-white transition-colors group text-xs sm:text-sm"
            >
              <FaGithub className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Source</span>
            </Link>
            
            <button 
              onClick={() => setIsConstitutionOpen(true)}
              className="flex items-center gap-2 hover:text-brand-cyan transition-colors cursor-pointer bg-transparent border-none group text-xs sm:text-sm font-bold"
              title="Читать Конституцию Синдиката (живой документ из репо)"
            >
              <FaScroll className="w-4 h-4 text-brand-cyan group-hover:animate-bounce" />
              <span>Конституция</span>
            </button>
            
            <button 
              onClick={() => setIsPrivacyOpen(true)}
              className="flex items-center gap-2 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-xs sm:text-sm"
            >
              <FaShieldHalved className="w-4 h-4" />
              <span>Privacy</span>
            </button>
            
            <Link 
              href="https://github.com/salavey13/carTest/blob/main/LICENSE" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-zinc-300 transition-colors text-xs sm:text-sm"
            >
              <FaFileContract className="w-4 h-4" />
              <span>MIT</span>
            </Link>
          </div>
        </div>
        
        {/* Статус-бар Digital Company */}
        <div className="max-w-6xl mx-auto px-4 mt-8 pt-4 border-t border-zinc-900 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-zinc-700 uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Syndicate Member
            </span>
            <span className="hidden sm:inline text-zinc-800">|</span>
            <span className="text-brand-cyan/60">amendment-912</span>
          </div>
          
          <div className="font-mono text-zinc-800">
            Repo: salavey13/carTest // Branch: main // File: CONSTITUTION.md
          </div>
        </div>
      </footer>

      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <ConstitutionModal isOpen={isConstitutionOpen} onClose={() => setIsConstitutionOpen(false)} />
    </>
  );
};