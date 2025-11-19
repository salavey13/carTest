"use client";

import { FixedHeader } from "../components/FixedHeader";
import { WbFooter } from "../components/WbFooter";
import { ReferralPirateCard } from "../components/ReferralPirateCard";
import { motion } from "framer-motion";
import { FaUsers, FaMoneyBillWave, FaHandshake } from "react-icons/fa6";
import { ArrowLeft, Copy, UserPlus, CreditCard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
    { icon: Copy, title: "1. Твой Ник = Твой Код", desc: "Никаких цифр. Твой Telegram Username — это промокод." },
    { icon: UserPlus, title: "2. Скинь в чат", desc: "Отправь ссылку другу-селлеру, который ноет про штрафы." },
    { icon: CreditCard, title: "3. Забери 20%", desc: "Друг оплачивает настройку (10к) — тебе сразу летит 2к." }
];

export default function ReferralPage() {
  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans overflow-x-hidden">
      <FixedHeader />

      {/* HERO */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-indigo-950/40 to-black relative">
         <div className="container mx-auto px-4 text-center relative z-10">
            <Link href="/wblanding" className="inline-flex items-center text-zinc-500 hover:text-white mb-8 transition-colors text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Назад в Штаб
            </Link>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl md:text-6xl font-bold font-orbitron text-white mb-6 leading-tight">
                   СИНДИКАТ <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">CYBERVIBE</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
                   Мы не тратим деньги на рекламу. Мы платим их вам.<br/>
                   Преврати свой нетворкинг в пассивный доход.
                </p>
            </motion.div>
         </div>
      </section>

      {/* THE CARD */}
      <section className="py-8 container mx-auto px-4">
         <div className="max-w-3xl mx-auto">
             <ReferralPirateCard />
         </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-zinc-900/30 border-y border-white/5">
         <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-16 text-white font-orbitron">МЕХАНИКА</h2>
            <div className="grid md:grid-cols-3 gap-8">
               {steps.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }} 
                    className="bg-black border border-zinc-800 p-8 rounded-2xl text-center hover:border-indigo-500/50 transition-colors group">
                     <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-700 group-hover:scale-110 transition-transform">
                        <s.icon className="w-8 h-8 text-indigo-400" />
                     </div>
                     <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                     <p className="text-zinc-400 text-sm">{s.desc}</p>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      <WbFooter />
    </div>
  );
}