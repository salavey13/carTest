"use client";

import { FixedHeader } from "../components/FixedHeader";
import { WbFooter } from "../components/WbFooter";
import { ReferralPirateCard } from "../components/ReferralPirateCard";
import { ReferralHowItWorks } from "../components/ReferralHowItWorks"; // See below
import { motion } from "framer-motion";
import { FaUsers, FaMoneyBillWave, FaHandshake } from "react-icons/fa6";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ReferralPage() {
  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans overflow-x-hidden">
      <FixedHeader />

      {/* HERO: The Pitch */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-indigo-950/30 to-black relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
         <div className="container mx-auto px-4 text-center relative z-10">
            <motion.div 
               initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
               className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-full mb-6 border border-indigo-500/20 font-mono text-sm"
            >
               <FaUsers /> PARTNER PROGRAM v1.0
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-bold font-orbitron text-white mb-6">
               ЗАРАБАТЫВАЙ НА <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">ХАОСЕ ДРУГИХ</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
               У каждого владельца склада есть друг, который тонет в Excel. <br/>
               Спаси друга — получи 20% от нашей прибыли.
            </p>
         </div>
      </section>

      {/* THE CARD */}
      <section className="py-12 container mx-auto px-4">
         <div className="max-w-3xl mx-auto">
             <ReferralPirateCard />
         </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-zinc-900/50 border-y border-white/5">
         <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-16 text-white font-orbitron">КАК ЭТО РАБОТАЕТ</h2>
            <ReferralHowItWorks />
         </div>
      </section>

      {/* WHY JOIN */}
      <section className="py-20 bg-black">
         <div className="container mx-auto px-4 max-w-4xl">
            <div className="grid md:grid-cols-2 gap-12">
               <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                     <FaMoneyBillWave className="text-neon-lime" /> Живой Кэш
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                     Мы не начисляем мифические "баллы". Мы платим реальные деньги за продажу настройки (10 000₽). 
                     <br/><br/>
                     Твоя доля: <strong>2 000 ₽</strong> с каждого клиента. Вывод на карту или оплата PRO-тарифа.
                  </p>
               </div>
               <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                     <FaHandshake className="text-brand-cyan" /> Репутация
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                     Ты не "впариваешь" ерунду. Ты даешь другу инструмент, который реально спасает его бизнес от штрафов.
                     <br/><br/>
                     Плюс, твой промокод дает ему скидку. Ты — герой в этой истории.
                  </p>
               </div>
            </div>
         </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-24 text-center">
         <h2 className="text-3xl font-bold text-white mb-6">Готов стать партнером?</h2>
         <Link href="/wblanding">
            <Button size="lg" className="bg-white text-black hover:bg-gray-200 px-10 py-6 text-lg rounded-full font-bold">
               ВЕРНУТЬСЯ В ШТАБ
            </Button>
         </Link>
      </section>

      <WbFooter />
    </div>
  );
}