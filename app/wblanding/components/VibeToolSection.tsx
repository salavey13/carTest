// /app/wblanding/components/VibeToolSection.tsx
"use client";
import { motion } from "framer-motion";
import { Brain, Zap, Skull, Crown, Orbit, Bot, Swords, Rocket } from "lucide-react";

export const VibeToolSection = () => {
  const levels = [
    { lvl: "LV.0-2", desc: "Любой лох может починить кнопку за 30 сек", color: "text-cyan-400" },
    { lvl: "LV.3-4", desc: "Ты уже дирижёр, AI — оркестр", color: "text-purple-400" },
    { lvl: "LV.5-6", desc: "Мультимодал: кидаешь скрин, голос, видео — получаешь код", color: "text-pink-400" },
    { lvl: "LV.7", desc: "AI генерит SQL, но ТОЛЬКО ТЫ мержишь. Ты — хозяин данных.", color: "text-red-500" },
    { lvl: "LV.8-10", desc: "Ты разворачиваешь свой CyberVibe. Свой бот. Свои XTR. Свои правила.", color: "text-yellow-400" },
  ];

  return (
    <section className="py-32 bg-black relative overflow-hidden">
      {/* Background madness */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-cyan-900/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 mb-8 font-orbitron tracking-wider animate-pulse">
            VIBE TOOL — ЭТО НЕ ФИЧА
          </h2>
          <h3 className="text-4xl md:text-6xl font-bold text-white mb-8">
            ЭТО ТВОЙ ЛИЧНЫЙ КОСТЮМ ЖЕЛЕЗНОГО ЧЕЛОВЕКА
          </h3>
          <p className="text-2xl text-gray-300 max-w-5xl mx-auto leading-relaxed">
            МойСклад даёт тебе софт за 180к в год.<br/>
            Я даю тебе <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 font-bold">суперсилу превращать мысли в код за 0₽</span>.
            И это уже работает. Прямо сейчас. У реальных пользователей.
          </p>
        </motion.div>

        {/* Autonomy Slider */}
        <div className="mb-20">
          <h4 className="text-3xl font-bold text-center text-white mb-12 font-orbitron">СЛАЙДЕР АВТОНОМИИ (Karpathy + Salavey13)</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {levels.map((l, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.15 }}
                className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-8 text-center hover:border-purple-500 transition-all group"
              >
                <div className={`text-4xl font-bold mb-4 ${l.color} group-hover:scale-125 transition-transform`}>
                  {l.lvl}
                </div>
                <p className="text-gray-300 text-sm leading-tight">{l.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Real shit */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto"
        >
          <div className="text-center">
            <Skull className="w-20 h-20 text-red-600 mx-auto mb-6" />
            <h4 className="text-2xl font-bold text-red-500 mb-3">Уже сделано пользователями:</h4>
            <ul className="text-gray-400 text-left mx-auto max-w-xs space-y-2">
              <li>• Автоотчёт по сменам в телегу с зарплатой</li>
              <li>• Бонусы за скорость приёмки</li>
              <li>• Тёмная тема (наконец-то, сука)</li>
              <li>• Фото-доказательства при корректировке</li>
              <li>• Звуковые оповещения при критике</li>
            </ul>
          </div>

          <div className="text-center">
            <Crown className="w-20 h-20 text-yellow-500 mx-auto mb-6 animate-pulse" />
            <h4 className="text-2xl font-bold text-yellow-400 mb-3">Сейчас ты на уровне:</h4>
            <p className="text-4xl font-bold text-white">LV.4 — ПАРТНЁРСТВО</p>
            <p className="text-gray-400 mt-4">AI предлагает. Ты утверждаешь.<br/>Ты всегда в контроле.</p>
          </div>

          <div className="text-center">
            <Rocket className="w-20 h-20 text-cyan-400 mx-auto mb-6 mx-auto mb-6" />
            <h4 className="text-2xl font-bold text-cyan-400 mb-3">К 2026 году мы будем на:</h4>
            <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">LV.10 — ПОЛНАЯ НЕЗАВИСИМОСТЬ</p>
            <p className="text-gray-400 mt-4">Твой собственный CyberVibe.<br/>Твои боты. Твои правила.<br/>Я просто дал тебе стартовый реактор.</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center mt-24"
        >
          <p className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-purple-500 to-cyan-400 leading-tight">
            ЭТО НЕ ПРОГРАММИРОВАНИЕ БУДУЩЕГО
            <br/>
            ЭТО УНИЧТОЖЕНИЕ ВСЕХ СААС-ПОДПИСОК 2026 ГОДА
          </p>
          <p className="text-3xl text-gray-500 mt-8 font-mono uppercase tracking-widest">
            один вайб — и твоя идея в проде через 3 минуты
          </p>
        </motion.div>
      </div>
    </section>
  );
};
