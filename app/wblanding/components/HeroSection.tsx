"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FaSkullCrossbones, FaFire, FaFileCsv } from 'react-icons/fa6';
import Link from "next/link";

export const HeroSection = ({ onAuditClick }: { onAuditClick: () => void }) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Video */}
      <div className="absolute inset-0 w-full h-full z-0">
        <video 
          className="w-full h-full object-cover brightness-[0.3] grayscale" 
          autoPlay loop muted playsInline
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black"></div>
        {/* Cyber Overlay */}
        <div className="absolute inset-0 bg-[url('https://i.pinimg.com/originals/2b/2b/e4/2b2be452536454126e86014092321051.gif')] opacity-5 bg-cover bg-center mix-blend-overlay pointer-events-none"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            <span className="inline-block py-1 px-3 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs md:text-sm font-mono mb-6 backdrop-blur-md">
                <FaSkullCrossbones className="inline mr-2 mb-0.5"/>
                МЫ УКРАЛИ ИДЕЮ У МОЙСКЛАД, ЧТОБЫ ВЫ НЕ ПЛАТИЛИ
            </span>
        </motion.div>

        <motion.h1 
            className="text-4xl md:text-7xl font-bold mb-6 leading-tight font-orbitron"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
        >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">Ваши данные.</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-blue-500 to-purple-600 glitch" data-text="ВАШИ ПРАВИЛА">ВАШИ ПРАВИЛА</span>
        </motion.h1>

        <motion.p 
            className="text-lg md:text-2xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed font-mono drop-shadow-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
        >
            Импорт из Excel за секунды. Песочница для тестов. 
            <br className="hidden md:block"/>
            Никаких API ключей на старте — <span className="text-neon-lime font-bold">мы не просим ключи от квартиры</span>, пока вы не решите там жить.
        </motion.p>

        <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
        >
            <Button onClick={onAuditClick} size="lg" className="bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold px-8 py-6 rounded-none skew-x-[-10deg] border-r-4 border-b-4 border-white transition-all active:translate-y-1 active:border-0 shadow-[0_0_20px_rgba(0,255,255,0.3)]">
                <span className="skew-x-[10deg] flex items-center gap-2">
                    <FaFire /> СКОЛЬКО Я ТЕРЯЮ?
                </span>
            </Button>
            
            <Link href="#migrator">
                {/* FIXED CONTRAST: bg-black/50 backdrop-blur border-white text-white */}
                <Button variant="outline" size="lg" className="bg-black/60 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white hover:text-black transition-all px-8 py-6 rounded-none skew-x-[-10deg]">
                    <span className="skew-x-[10deg] flex items-center gap-2">
                        <FaFileCsv className="w-5 h-5" /> ЗАГРУЗИТЬ CSV
                    </span>
                </Button>
            </Link>
        </motion.div>
      </div>
    </section>
  );
};