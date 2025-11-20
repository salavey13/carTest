"use client";
import { motion } from "framer-motion";
import { UserPlus, Copy, CreditCard } from "lucide-react";

export const ReferralHowItWorks = () => {
  const steps = [
    {
      icon: Copy,
      title: "1. Копируй Код",
      desc: "В личном кабинете возьми свой уникальный промокод (твой Telegram Username)."
    },
    {
      icon: UserPlus,
      title: "2. Отправь Другу",
      desc: "Скинь ссылку другу-селлеру, который мучается с Excel или платит 15к за МойСклад."
    },
    {
      icon: CreditCard,
      title: "3. Получи %",
      desc: "Когда друг оплатит настройку, тебе прилетит уведомление и 2000₽ на баланс."
    }
  ];

  return (
    <div className="grid md:grid-cols-3 gap-8 relative">
       {/* Connecting Line (Desktop) */}
       <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0 z-0"></div>

       {steps.map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2 }}
            className="relative z-10 bg-black border border-zinc-800 p-8 rounded-2xl text-center hover:border-indigo-500/50 transition-colors"
          >
             <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-700 shadow-lg">
                <s.icon className="w-8 h-8 text-indigo-400" />
             </div>
             <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
             <p className="text-zinc-400 text-sm">{s.desc}</p>
          </motion.div>
       ))}
    </div>
  );
};