"use client";

import Link from 'next/link';
import { FaGithub, FaShieldHalved, FaFileContract } from 'react-icons/fa6';

export const WbFooter = () => {
  return (
    <footer className="bg-black py-12 border-t border-white/10 text-zinc-500 text-xs sm:text-sm font-mono">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="text-center md:text-left">
          <p className="text-gray-300 font-bold mb-1">oneSitePls v2.0</p>
          <p>© {new Date().getFullYear()} Powered by CyberVibe.</p>
          <p className="mt-2 text-zinc-600">
            Created by <a href="https://t.me/salavey13" target="_blank" className="hover:text-brand-cyan transition-colors">@SALAVEY13</a>
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
          <Link 
            href="https://github.com/salavey13/carTest" 
            target="_blank" 
            className="flex items-center gap-2 hover:text-white transition-colors group"
          >
            <FaGithub className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Open Source Repo</span>
          </Link>
          
          <Link 
            href="https://github.com/salavey13/carTest/blob/main/README.md" 
            target="_blank" 
            className="flex items-center gap-2 hover:text-brand-cyan transition-colors"
          >
            <FaShieldHalved className="w-4 h-4" />
            <span>Privacy & Terms</span>
          </Link>
          
          <Link 
            href="https://github.com/salavey13/carTest/blob/main/LICENSE" 
            target="_blank" 
            className="flex items-center gap-2 hover:text-brand-cyan transition-colors"
          >
            <FaFileContract className="w-4 h-4" />
            <span>License (MIT)</span>
          </Link>
        </div>
      </div>
    </footer>
  );
};