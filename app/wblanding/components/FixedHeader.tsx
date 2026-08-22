"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Menu, X, Zap, Sparkles, Github, MessageCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";

export function FixedHeader() {
  const { dbUser } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navLinks = useMemo(() => [
      { href: "#features", label: "Фишки", icon: <Zap className="w-4 h-4" /> },
      { href: "#pricing", label: "Цены", icon: <Sparkles className="w-4 h-4" /> },
      { href: "#migrator", label: "Мигратор" },
      { href: "https://github.com/salavey13/carTest", label: "Code", icon: <Github className="w-4 h-4" />, external: true },
  ], []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-black/90 backdrop-blur-lg border-b border-white/10" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
             <div className="relative">
                <div className="absolute inset-0 bg-neon-lime blur-md opacity-20 group-hover:opacity-50 transition-opacity"/>
                <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png" alt="Logo" width={32} height={32} className="rounded-full relative z-10" />
             </div>
             <span className="font-orbitron font-bold text-white tracking-widest">
                WAREHOUSE<span className="text-neon-lime">BOT</span>
             </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
             {navLinks.map(link => (
                <Link key={link.label} href={link.href} target={link.external ? "_blank" : undefined} className="px-4 py-2 rounded-full text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2">
                   {link.icon}
                   {link.label}
                </Link>
             ))}
          </nav>

          {/* User / Auth */}
          <div className="flex items-center gap-4">
             {dbUser ? (
                <div className="relative" ref={userMenuRef}>
                   <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-full hover:border-neon-lime/50 transition-colors">
                      <div className="w-6 h-6 bg-neon-lime rounded-full flex items-center justify-center text-black font-bold text-xs">
                         {dbUser.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="hidden sm:inline text-sm text-white font-mono">{dbUser.username}</span>
                   </button>
                   <AnimatePresence>
                      {isUserMenuOpen && (
                         <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:10}} className="absolute right-0 mt-2 w-48 bg-black border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                            <Link href="/settings" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-zinc-900 hover:text-white">
                               <Settings className="w-4 h-4" /> Настройки
                            </Link>
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>
             ) : (
                <Link href="/wb">
                   <Button className="bg-white text-black hover:bg-gray-200 font-bold rounded-full h-9">Войти</Button>
                </Link>
             )}
             <button className="md:hidden text-white p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X /> : <Menu />}
             </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <AnimatePresence>
         {isMenuOpen && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-40 bg-black/95 pt-24 px-6 md:hidden">
               <div className="flex flex-col gap-6">
                  {navLinks.map(link => (
                     <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)} className="text-2xl font-orbitron text-white border-b border-white/10 pb-4">
                        {link.label}
                     </Link>
                  ))}
               </div>
            </motion.div>
         )}
      </AnimatePresence>
    </>
  );
}