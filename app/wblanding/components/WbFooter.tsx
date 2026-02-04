"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  FaGithub, 
  FaShieldHalved, 
  FaFileContract, 
  FaScroll, 
  FaSpinner, 
  FaHeart,
  FaBus // Icon for the LOH/Bus philosophy
} from "react-icons/fa6";
import { PrivacyModal } from "./PrivacyModal";

// --- GENERIC MARKDOWN MODAL ---
const MarkdownModal = ({ 
  isOpen, 
  onClose, 
  url, 
  title, 
  icon: Icon,
  colorClass 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  url: string; 
  title: string; 
  icon: any; 
  colorClass: string;
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch(url)
        .then(res => res.ok ? res.text() : "# Error\nSource unavailable.")
        .then(text => {
          // Remove potential file path comments like "// /loh.md"
          setContent(text.replace(/^\/\/.*$/gm, '').trim());
          setLoading(false);
        })
        .catch(() => {
          setContent("# Connection Lost\nNetwork error.");
          setLoading(false);
        });
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="sticky top-0 bg-black/95 border-b border-zinc-800 p-4 flex justify-between items-center backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 bg-zinc-900 rounded-lg border border-zinc-800 ${colorClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white font-orbitron tracking-wider">
              {title}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-2 rounded-full hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0a0a0a] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-600 space-y-4">
              <FaSpinner className="w-8 h-8 animate-spin text-zinc-500" />
              <p className="font-mono text-xs">FETCHING SOURCE...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm md:prose-base max-w-none font-mono 
              prose-headings:font-orbitron prose-headings:text-white
              prose-h1:text-2xl prose-h1:border-b prose-h1:border-zinc-800 prose-h1:pb-4 prose-h1:mb-6
              prose-strong:text-white
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-li:text-zinc-400
              prose-blockquote:border-l-zinc-700 prose-blockquote:bg-zinc-900/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- MAIN FOOTER ---
export const WbFooter = () => {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);
  const [isLohOpen, setIsLohOpen] = useState(false);

  return (
    <>
      <footer className="bg-black py-12 border-t border-zinc-900 font-sans relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            
            {/* Left: Identity */}
            <div className="text-center md:text-left">
              <span className="text-white font-bold font-orbitron text-xl tracking-tight block mb-2">
                oneSitePls <span className="text-zinc-600 text-sm align-top">V2</span>
              </span>
              <p className="text-zinc-500 text-xs font-mono">
                Decentralized Warehouse Operations<br/>
                No Vendor Lock. Just Vibe.
              </p>
            </div>

            {/* Right: The Grid */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-xs font-medium text-zinc-400">
              
              <button 
                onClick={() => setIsLohOpen(true)}
                className="flex items-center gap-2 hover:text-pink-500 transition-colors group"
                title="Manifesto"
              >
                <FaBus className="w-4 h-4 group-hover:animate-bounce" />
                <span>L.O.H. PROTOCOL</span>
              </button>

              <button 
                onClick={() => setIsConstitutionOpen(true)}
                className="flex items-center gap-2 hover:text-green-500 transition-colors"
                title="Constitution"
              >
                <FaScroll className="w-4 h-4" />
                <span>CONSTITUTION</span>
              </button>

              <Link 
                href="https://github.com/salavey13/carTest" 
                target="_blank" 
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <FaGithub className="w-4 h-4" />
                <span>SOURCE</span>
              </Link>

              <button 
                onClick={() => setIsPrivacyOpen(true)}
                className="hover:text-white transition-colors"
              >
                PRIVACY
              </button>

              <Link 
                href="https://github.com/salavey13/carTest/blob/main/LICENSE" 
                target="_blank" 
                className="hover:text-white transition-colors"
              >
                MIT LICENSE
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      
      <MarkdownModal 
        isOpen={isConstitutionOpen} 
        onClose={() => setIsConstitutionOpen(false)}
        url="https://raw.githubusercontent.com/salavey13/carTest/main/CONSTITUTION.md"
        title="CONSTITUTION.MD"
        icon={FaScroll}
        colorClass="text-green-500"
      />

      <MarkdownModal 
        isOpen={isLohOpen} 
        onClose={() => setIsLohOpen(false)}
        url="https://raw.githubusercontent.com/salavey13/carTest/main/loh.md"
        title="L.O.H. MANIFESTO"
        icon={FaBus} // The Po-Shen Bus
        colorClass="text-pink-500"
      />
    </>
  );
};