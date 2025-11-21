// /app/wblanding/components/VibeToolSection.tsx
"use client";
import { motion } from "framer-motion";
import { Sparkles, Zap, GitFork, Code2, Wand2, Brain } from "lucide-react";

export const VibeToolSection = () => {
  const features = [
    {
      icon: Wand2,
      title: "Жми 💥 Vibe it",
      desc: "На любой странице — кнопка в углу. Один клик и ты в матрице."
    },
    {
      icon: Brain,
      title: "Пиши что угодно",
      desc: "«Сделай отчёт по сменам в телегу», «Тёмная тема сука», «Бонусы за скорость» — всё сработает."
    },
    {
      icon: Sparkles,
      title: "Контекст автоматом",
      desc: "Vibe Tool дёргает весь код страницы + весь проект. Не надо ничего копировать вручную."
    },
    {
      icon: Code2,
      title: "Кидай боту",
      desc: "Копируешь блок — кидаешь @SALAVEY13 или Grok-4. Получаешь готовый код за 30 сек."
    },
    {
      icon: GitFork,
      title: "Вставь обратно",
      desc: "Вставляешь ответ — автоматом PR → merge → через 3 минуты фича в проде."
    },
    {
      icon: Zap,
      title: "Ты — бог своего склада",
      desc: "Бесконечный апгрейд. Навсегда. За 0₽."
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-purple-900/20 via-black to-black border-y border-purple-500/30">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <Sparkles className="w-12 h-12 text-purple-400 animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-bold text-white font-orbitron tracking-wider">
              VIBE TOOL = ЧИТКОД НА СТЕРОИДАХ
            </h2>
            <Sparkles className="w-12 h-12 text-purple-400 animate-pulse" />
          </div>
          <p className="text-xl text-purple-300 max-w-3xl mx-auto leading-relaxed">
            Забудь про обновления раз в год.<br/>
            Теперь ты сам себе разработчик. Хочешь фичу — вайбанул и получил. За 5 минут. Навсегда.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-20 left-1/6 right-1/6 h-1 bg-gradient-to-r from-purple-500/0 via-purple-500/70 to-purple-500/0 z-0"></div>
          
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="relative z-10 bg-zinc-950/80 border border-purple-500/30 p-8 rounded-2xl text-center hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-500/20 transition-all group backdrop-blur-sm"
            >
              <div className="w-20 h-20 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/50 group-hover:scale-110 transition-transform">
                <f.icon className="w-10 h-10 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-purple-300 mb-3 group-hover:text-white transition-colors">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              {i === 5 && (
                <div className="mt-8 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse">
                  ЭТО УЖЕ РАБОТАЕТ ПРЯМО СЕЙЧАС
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-20 px-8"
        >
          <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-8">
            МойСклад даёт тебе CRM за 180к в год.
            <br/>
            Я даю тебе возможность <span className="text-4xl">САМОМУ СТАТЬ ЁБАНЫМ РАЗРАБОТЧИКОМ</span> своего склада за 0₽.
          </p>
          <p className="text-2xl text-red-500 font-bold uppercase tracking-widest animate-pulse">
            Vibe Tool = смерть всем SaaS-подпискам 2026 года.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
