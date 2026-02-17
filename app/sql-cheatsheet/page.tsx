"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Terminal, Zap, Brain, Rocket, ChevronRight, Skull, Crown, Lightbulb, Database } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "SQL Шпаргалка 2026 — Последняя, которую ты увидишь",
  description: "4 вопроса, которые нужно знать. Всё остальное — спроси у своего кибердемона.",
};

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
    question: "Где в огромном миграционном файле написано имя таблицы?",
    answer: "Первая строка с ключевым словом TABLE",
    color: "from-purple-500 to-pink-600",
  },
  {
    emoji: "🚀",
    question: "А что делать со всем остальным SQL?",
    answer: "Спроси у агента (Codex / Grok)",
    color: "from-cyan-500 to-blue-600",
    final: true,
  },
];

const OBSOLETE_PAIN = [
  "Ты больше не должен помнить 47 видов JOIN и когда какой использовать",
  "Ты больше не должен вручную писать EXPLAIN ANALYZE и читать 300 строк плана",
  "Ты больше не должен знать разницу между SERIAL и BIGSERIAL наизусть",
  "Ты больше не должен помнить все 12 уровней изоляции транзакций",
  "Ты больше не должен вручную писать CTE с рекурсией для иерархий",
  "Ты больше не должен знать, когда делать VACUUM FULL, а когда ANALYZE",
  "Ты больше не должен помнить синтаксис PARTITION BY RANGE на 2026 год",
  "Ты больше не должен вручную писать триггеры на 400 строк",
  "Ты больше не должен знать все 9 типов индексов и когда какой ставить",
  "Ты больше не должен помнить, как правильно экранировать кавычки в raw SQL",
  "Ты больше не должен писать миграции вручную на 800 строк",
  "Ты больше не должен учить 50 функций работы с датами PostgreSQL",
  "Ты больше не должен знать порядок выполнения запроса (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT)",
];

export default function SqlCheatsheet2026() {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-16 sm:pt-20 pb-20 overflow-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 bg-[radial-gradient(#22d3ee20_1px,transparent_1px)] bg-[length:40px_40px] pointer-events-none" />
      <motion.div 
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 18, repeat: Infinity }}
        className="fixed top-40 -left-40 w-[900px] h-[900px] bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-[180px]"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <div className="text-center mb-16">
          <Badge className="mb-6 px-6 py-2 bg-gradient-to-r from-red-500 to-purple-600 text-white border-0 font-mono tracking-widest">
            SQL ШПАРГАЛКА 2026 — ПОСЛЕДНЯЯ В ТВОЕЙ ЖИЗНИ
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-[-2px] bg-gradient-to-b from-white via-cyan-300 to-purple-300 bg-clip-text text-transparent">
            Забудь зубрёжку SQL
          </h1>
          <p className="mt-6 text-xl sm:text-2xl text-zinc-400 max-w-3xl mx-auto">
            Раньше люди учили 500 команд и страдали 3 года.<br />
            Теперь достаточно знать <span className="text-emerald-400 font-bold">4 вещи</span> — остальное делает твой кибердемон.
          </p>
        </div>

        {/* 4 Eternal Truths */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {ETERNAL_TRUTHS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "relative group rounded-3xl p-px bg-gradient-to-br",
                t.color || "from-zinc-800 to-zinc-900"
              )}
            >
              <div className="bg-zinc-950 rounded-[22px] p-8 h-full flex flex-col">
                <div className="text-6xl mb-6">{t.emoji}</div>
                <h3 className="text-xl font-bold text-white mb-4 min-h-[3.5em]">{t.question}</h3>
                <div className="mt-auto">
                  <div className="inline-block px-6 py-3 rounded-2xl bg-black border border-emerald-500/30 text-2xl font-mono text-emerald-400">
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

        {/* Obsolescence Wall — inspired by VPS transcript */}
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-8">
            <Skull className="w-9 h-9 text-red-500" />
            <div>
              <div className="text-3xl font-black text-red-400">Что раньше приходилось зубрить вручную</div>
              <div className="text-zinc-500">…а теперь просто скажи агенту: «Сделай мне это»</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 text-sm text-zinc-400">
            {OBSOLETE_PAIN.map((pain, i) => (
              <div key={i} className="flex gap-4">
                <div className="text-red-500/70 mt-0.5">×</div>
                <div>{pain}</div>
              </div>
            ))}
            {/* Extra long painful ones to match VPS vibe */}
            <div className="flex gap-4 col-span-full sm:col-span-2 text-red-400/80 italic mt-4 border-t border-red-500/20 pt-6">
              Ты больше не должен знать, как правильно писать миграции на 1200 строк, вручную добавлять индексы, бороться с deadlocks, настраивать connection pooling, писать stored procedures на PL/pgSQL, помнить порядок выполнения 9 этапов запроса, оптимизировать под конкретную версию Postgres, писать свои vacuum политики и ещё 47 вещей, которые раньше заставляли людей плакать в 3 часа ночи.
            </div>
          </div>
        </div>

        {/* Quick Reference (still useful to roughly know) */}
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center text-emerald-300">Быстрый ориентир (чтобы не выглядеть совсем нубом перед агентом)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "SELECT + WHERE", code: "SELECT * FROM users WHERE active = true LIMIT 10;" },
              { title: "JOIN", code: "JOIN profiles ON users.id = profiles.user_id" },
              { title: "GROUP BY", code: "GROUP BY user_id HAVING COUNT(*) > 5" },
              { title: "INSERT / UPDATE", code: "INSERT INTO ... VALUES ... ON CONFLICT DO UPDATE" },
            ].map((item, i) => (
              <Card key={i} className="bg-zinc-900/70 border-zinc-800 hover:border-emerald-500/30 transition-all">
                <CardHeader>
                  <CardTitle className="text-emerald-400 text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-black p-4 rounded-xl text-xs overflow-x-auto font-mono text-emerald-300/90">{item.code}</pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex flex-col items-center">
            <div className="text-4xl mb-4">😈</div>
            <div className="text-2xl font-black mb-2">Ты больше не SQL-раб.</div>
            <div className="text-zinc-400 max-w-md mb-8">
              Ты — владелец кибердемона, который пишет SQL лучше любого senior-разработчика 2024 года.
            </div>
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-12 py-7 text-lg font-bold rounded-2xl" asChild>
              <a href="https://chatgpt.com/codex" target="_blank" rel="noopener noreferrer">
                Открыть Codex и больше никогда не зубрить SQL
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}