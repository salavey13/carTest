// /app/sauna-rent/page.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

export default function SaunaPage() {
  return (
    <div className="relative min-h-screen bg-slate-800 text-amber-50 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/IMG_20250812_205713_766.jpg" alt="Sauna interior" layout="fill" objectFit="cover" className="opacity-30" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
      </div>
      
      <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="relative z-10 flex flex-col items-center justify-center h-screen text-center p-4"
      >
          <VibeContentRenderer content="::FaHotTubPerson::" className="text-7xl text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.7)]" />
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-amber-100">LÖYLY VIBE</h1>
          <p className="max-w-2xl mx-auto mt-4 text-lg text-amber-50/80">
              Ваше пространство для перезагрузки. Аутентичная сауна, созданная для полного расслабления и восстановления.
          </p>
          <div className="mt-8">
              <Link href="#">
                  <Button size="lg" className="font-sans text-lg bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-lg shadow-amber-500/30 transition-all duration-300 transform hover:scale-105">
                      Забронировать сеанс
                  </Button>
              </Link>
          </div>
      </motion.div>
    </div>
  );
}