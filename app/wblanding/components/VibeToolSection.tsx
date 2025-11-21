// /app/wblanding/components/VibeToolSection.tsx
"use client";

import { motion } from "framer-motion";
import { Sparkles, Terminal, Workflow, GitPullRequest, Zap, Wand2 } from "lucide-react";

export const VibeToolSection = () => {
  const features = [
    {
      icon: Wand2,
      title: "Идея → Код",
      desc: "Напиши любую мысль — от автоотчёта до тёмной темы — и Vibe Tool сформирует техзадание."
    },
    {
      icon: Terminal,
      title: "AI → Ready Patch",
      desc: "AI генерирует код, инструкции и модификации файлов в markdown, понятном Vibe Tool."
    },
    {
      icon: Workflow,
      title: "1 Клик → Парсинг",
      desc: "Vibe Tool понимает структуру проекта, находит нужные файлы и собирает патч."
    },
    {
      icon: GitPullRequest,
      title: "PR + Preview Build",
      desc: "Автоматически создаётся ветка, коммит, пуш и Pull Request с pre-production сборкой."
    },
    {
      icon: Zap,
      title: "3 минуты до продакшена",
      desc: "Ты просто жмёшь Merge — новая фича появляется в твоём реальном складе."
    }
  ];

  return (
    <section className="py-24 bg-black border-y border-white/5 relative overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-black to-black pointer-events-none"></div>

      <div className="max-w-5xl mx-auto px-4 relative z-10">

        {/* HEADER */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Sparkles className="w-12 h-12 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
          </div>

          <h2 className="text-3xl md:text-5xl font-orbitron font-bold text-white mb-4">
            VIBE TOOL — ЧИТКОД ДЛЯ ТВОЕГО СКЛАДА
          </h2>

          <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base font-mono">
            Нажми <span className="text-purple-400 font-bold">💥 Vibe it</span> —
            и твой склад сам себе допиливает.  
            Любая фича. Без разработчиков. За 3–7 минут.
          </p>
        </div>

        {/* FEATURES */}
        <div className="grid md:grid-cols-3 gap-10 mt-12">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              viewport={{ once: true }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl hover:border-purple-500/40 transition-colors"
            >
              <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mb-6 border border-zinc-700 shadow-inner">
                <f.icon className="w-8 h-8 text-purple-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* BOTTOM CTA */}
        <div className="text-center mt-20">
          <p className="text-gray-400 text-sm mb-3 font-mono">Это уже работает. У реальных складов. Прямо сейчас.</p>
          <p className="text-purple-400 font-bold text-lg font-orbitron">Vibe Tool = смерть всем SaaS-подпискам.</p>
        </div>
      </div>
    </section>
  );
};
