"use client";

import Link from "next/link";
import { FaInstagram, FaTelegram, FaWhatsapp, FaPhone, FaMapLocationDot } from "react-icons/fa6";

export default function SaunaFooter() {
  const footerLinkClass = "text-sm text-amber-50 hover:text-amber-300 font-sans flex items-center gap-2 transition-colors duration-200";
  
  return (
    <footer className="bg-slate-900 py-10 md:py-12 border-t-2 border-amber-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          <div>
            <h3 className="text-xl font-sans font-semibold text-amber-200 mb-4">
              LÖYLY VIBE SAUNA
            </h3>
            <p className="text-xs text-amber-50/70 font-sans leading-relaxed">
              Аутентичная финская сауна. Пространство для перезагрузки тела и духа.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-sans font-semibold text-amber-200 mb-4">Навигация</h3>
            <ul className="space-y-3">
              <li><Link href="/sauna-rent#cabins" className={footerLinkClass}>Наши Парилки</Link></li>
               <li><Link href="/sauna-rent#rules" className={footerLinkClass}>Правила</Link></li>
               <li><Link href="/sauna-rent#faq" className={footerLinkClass}>FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-sans font-semibold text-amber-200 mb-4">Соцсети</h3>
            <ul className="space-y-2.5">
              <li><a href="#" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaInstagram className="w-4 h-4" /> Instagram</a></li>
              <li><a href="#" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaTelegram className="w-4 h-4" /> Telegram</a></li>
            </ul>
          </div>
          <div>
             <h3 className="text-xl font-sans font-semibold text-amber-200 mb-4">Связь</h3>
             <ul className="space-y-2.5">
                <li><a href="#" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaWhatsapp className="w-4 h-4" /> WhatsApp</a></li>
                <li><a href="tel:#" className={footerLinkClass}><FaPhone className="w-4 h-4" /> +7 (XXX) XXX-XX-XX</a></li>
                <li className={`${footerLinkClass} items-start`}>
                    <FaMapLocationDot className="w-4 h-4 mt-1 flex-shrink-0" /> 
                    <span>Адрес вашей сауны</span>
                </li>
             </ul>
          </div>
        </div>
        <div className="mt-10 md:mt-12 pt-6 border-t border-amber-800/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-amber-50/60 font-sans text-xs">
            <p>© {new Date().getFullYear()} Löyly Vibe Sauna</p>
            <p>Powered by <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-amber-200/80 hover:text-amber-200">oneSitePls</a></p>
          </div>
        </div>
      </div>
    </footer>
  );
}