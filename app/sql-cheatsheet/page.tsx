"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skull, Crown, Rocket, Zap, Brain, FileCode, Lightbulb, RefreshCw } from "lucide-react";

const ETERNAL_TRUTHS = [
  {
    emoji: "📂",
    question: "В какой папке лежат миграции Supabase?",
    answer: "supabase/migrations/",
    color: "from-emerald-500 to-teal-600",
  },
  {
    emoji: "🔥",
    question: "Какое английское слово запускает новый Supabase-проект?",
    answer: "init",
    color: "from-amber-500 to-orange-600",
  },
  {
    emoji: "🪄",
    question: "Где в огромном миграционном файле имя таблицы?",
    answer: "Первая строка с TABLE",
    color: "from-purple-500 to-pink-600",
  },
  {
    emoji: "🧩",
    question: "Что нужно написать в первой строке страницы с хуками и анимациями?",
    answer: `"use client";`,
    color: "from-cyan-500 to-blue-600",
  },
  {
    emoji: "✨",
    question: "Какие два импорта нужно добавить в клиентскую страницу?",
    answer: `import { motion } from "framer-motion";\nimport { cn } from "@/lib/utils";`,
    color: "from-violet-500 to-fuchsia-600",
  },
  {
    emoji: "🚀",
    question: "А что делать со всем остальным SQL?",
    answer: "Спроси у агента",
    color: "from-red-500 to-rose-600",
    final: true,
  },
];

const OLD_HABITS = [
  "«Я быстро сам добавлю import { motion } и cn» → fuck it, скажи агенту и сохрани как скилл",
  "«Можно скопировать из истории, я потом поправлю» → нет, пусть агент сделает чисто и добавит в AGENTS.md",
  "«Это мелкая правка, я сам допишу» → агент сделает без опечаток и сохранит навсегда",
  "«Я помню, как выглядит этот JOIN» → лучше спроси агента — он не забудет и не ошибётся",
  "«Можно быстро пофиксить миграцию вручную» → скажи агенту «исправь и сохрани»",
  "«Я сам разберусь с этим индексом» → агент сделает оптимально и добавит в репо",
  "«Это всего 3 строки, я быстро» → агент сделает за секунду и создаст шаблон",
  "«Я знаю, как правильно экранировать» → пусть агент сделает безопасно и протестирует",
];

export default function SqlCheatsheet2026() {
  return (
    <div className="min-h-screen bg-background text-foreground pt-16 sm:pt-20 pb-20 overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(#22d3ee15_1px,transparent_1px)] bg-[length:40px_40px] pointer-events-none dark:bg-[radial-gradient(#67e8f915_1px,transparent_1px)]" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <div className="text-center mb-16">
          <Badge className="mb-6 px-6 py-2 text-sm font-mono border-emerald-500/40 bg-emerald-950/30 dark:bg-emerald-950/50">
            SQL ШПАРГАЛКА 2026 — ПОСЛЕДНЯЯ В ТВОЕЙ ЖИЗНИ
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-[-2px] bg-gradient-to-b from-foreground via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Забудь зубрёжку SQL
          </h1>

          <p className="mt-6 text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Раньше ты думал: «Я быстро сам починю».<br />
            Теперь говоришь агенту — и навык живёт вечно.
          </p>
        </div>

        {/* Eternal Truths */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {ETERNAL_TRUTHS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-3xl p-px bg-gradient-to-br ${t.color}`}
            >
              <div className="bg-card rounded-[22px] p-8 h-full flex flex-col border border-border/50">
                <div className="text-6xl mb-6">{t.emoji}</div>
                <h3 className="text-xl font-bold mb-4 min-h-[3.5em]">{t.question}</h3>
                <div className="mt-auto">
                  <div className="inline-block px-6 py-3 rounded-2xl bg-background border border-emerald-500/30 text-xl font-mono text-emerald-500 whitespace-pre-wrap">
                    {t.answer}
                  </div>
                  {t.final && (
                    <p className="mt-4 text-xs text-emerald-400/70 italic">← Это всё, что нужно держать в голове навсегда</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Old Habits → New Reality */}
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-8">
            <Skull className="w-9 h-9 text-red-500" />
            <div>
              <div className="text-3xl font-black text-red-400">Старое мышление</div>
              <div className="text-muted-foreground">«Я быстро сам починю / скопирую / допишу»</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 text-sm text-muted-foreground">
            {OLD_HABITS.map((habit, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="text-red-500 mt-1 text-xl group-hover:scale-110 transition-transform">×</div>
                <div>{habit}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center text-emerald-400 font-medium flex items-center justify-center gap-3">
            <Lightbulb className="w-5 h-5" />
            Новый подход: «Fuck it — пусть агент сделает идеально и сохранит навсегда в AGENTS.md»
          </div>
        </div>

        {/* Final CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex flex-col items-center max-w-md">
            <div className="text-5xl mb-6">😈</div>
            <div className="text-3xl font-black mb-3">Ты больше не фиксер</div>
            <div className="text-muted-foreground text-lg mb-8">
              Ты — владелец кибердемона.<br />
              Говоришь — он делает лучше и сохраняет навсегда.
            </div>
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-12 py-7 text-lg font-bold rounded-2xl" asChild>
              <a href="https://chatgpt.com/codex" target="_blank" rel="noopener noreferrer">
                Открыть Codex и жить по-новому
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}