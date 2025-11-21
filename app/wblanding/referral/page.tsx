"use client";

import { FixedHeader } from "../components/FixedHeader";
import { WbFooter } from "../components/WbFooter";
import { ReferralPirateCard } from "../components/ReferralPirateCard";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, UserPlus, CreditCard, Gem, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VibeToolSection } from "../components/VibeToolSection";
const steps = [
    { icon: Copy, title: "1. ИДЕНТИФИКАЦИЯ", desc: "Твой Telegram Username = Твой Промокод. Никаких сложных цифр. Это твой бренд." },
    { icon: UserPlus, title: "2. ВЕРБОВКА", desc: "Отправь ссылку в чат селлеров. Предложи им скидку 1000₽, которую нельзя получить на сайте." },
    { icon: CreditCard, title: "3. ЭКСТРАКЦИЯ", desc: "Друг платит 9000₽. Ты моментально получаешь 2000₽ на счет." }
];

export default function ReferralPage() {
  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans overflow-x-hidden">
      <FixedHeader />

      {/* HERO: The Pitch */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-indigo-950/50 to-black relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
         <div className="container mx-auto px-4 text-center relative z-10">
            <Link href="/wblanding" className="inline-flex items-center text-zinc-500 hover:text-white mb-8 transition-colors text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Назад в Штаб
            </Link>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-neon-lime/30 bg-neon-lime/10 text-neon-lime font-mono text-xs mb-6">
                    <Gem className="w-3 h-3" /> MLM ON STEROIDS
                </div>
                <h1 className="text-4xl md:text-7xl font-bold font-orbitron text-white mb-6 leading-tight">
                   СИНДИКАТ <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">CYBERVIBE</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
                   Преврати свой нетворкинг в актив. Самая агрессивная партнерская программа в e-com.
                </p>
            </motion.div>
         </div>
      </section>

      {/* THE CARD */}
      <section className="py-12 container mx-auto px-4">
         <div className="max-w-3xl mx-auto">
             <ReferralPirateCard />
         </div>
      </section>

      {/* THE MATH: NO BULLSHIT */}
      <section className="py-20 bg-zinc-900/50 border-y border-white/5">
         <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-16 text-white font-orbitron">МАТЕМАТИКА ВЫГОДЫ</h2>
            
            <div className="grid md:grid-cols-3 gap-8 text-center">
               {/* The "Loh" */}
               <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 opacity-50 hover:opacity-100 transition-opacity">
                   <h3 className="text-gray-500 font-mono text-sm uppercase mb-4">Обычный клиент</h3>
                   <div className="text-4xl font-bold text-gray-400 mb-2 line-through">10 000 ₽</div>
                   <p className="text-gray text-sm">Платит полную цену за настройку. Никто не получает бонус.</p>
               </div>

               {/* The Friend */}
               <div className="bg-black p-8 rounded-2xl border-2 border-brand-cyan relative transform md:-translate-y-4 shadow-2xl shadow-cyan-500/10">
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-cyan text-black px-4 py-1 rounded-full text-xs font-bold">ТВОЙ ДРУГ</div>
                   <h3 className="text-brand-cyan font-mono text-sm uppercase mb-4">Smart Client</h3>
                   <div className="text-5xl font-black text-white mb-2">9 000 ₽</div>
                   <p className="text-gray-400 text-sm">Получает скидку 1000₽ по твоему коду. Ему выгодно знать тебя.</p>
               </div>

               {/* YOU */}
               <div className="bg-black p-8 rounded-2xl border-2 border-neon-lime relative transform md:-translate-y-4 shadow-2xl shadow-lime-500/10">
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-1 rounded-full text-xs font-bold">ТЫ (АГЕНТ)</div>
                   <h3 className="text-white font-mono text-sm uppercase mb-4">Cashback King</h3>
                   <div className="text-5xl font-black text-white mb-2">+2 000 ₽</div>
                   <p className="text-gray-400 text-sm">Получаешь 20% кэшем. 5 друзей = 10 000 ₽ (Полная окупаемость).</p>
               </div>
            </div>
         </div>
      </section>

      {/* CHAIN REACTION */}
      <section className="py-24 bg-black text-center">
         <div className="container mx-auto px-4 max-w-3xl">
            <TrendingUp className="w-16 h-16 text-purple-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-6 font-orbitron">ЭФФЕКТ ЭХА (Depth 13)</h2>
            <p className="text-gray-400 text-lg leading-relaxed">
               Мы платим не только за личных друзей. Если твой друг пригласит друга, ты тоже получишь долю.
               <br/>Система работает на <strong>13 уровней</strong> в глубину. 
               <br/><br/>
               <span className="text-white">Lvl 1:</span> 2000₽<br/>
               <span className="text-white">Lvl 2:</span> 300₽<br/>
               <span className="text-zinc-500">Lvl 3-13:</span> 50₽ (Passive Flow)
            </p>
         </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-24 text-center bg-zinc-900 border-t border-zinc-800">
         <h2 className="text-3xl font-bold text-white mb-8">Твоя сеть начинается сегодня</h2>
         <Link href="/wblanding">
            <Button size="lg" className="bg-white text-black hover:bg-gray-200 px-12 py-8 text-l rounded-full font-bold shadow-xl">
               ВЕРНУТЬСЯ И КОПИРОВАТЬ КОД
            </Button>
         </Link>
      </section>
      <VibeToolSection />
      <WbFooter />
    </div>
  );
}
