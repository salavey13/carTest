"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Code2,
  Crown,
  FileCode2,
  Flame,
  GitPullRequest,
  Lightbulb,
  Rocket,
  Skull,
  Sparkles,
  Users,
  Wand2,
  Zap,
} from "lucide-react";

const ETERNAL_TRUTHS = [
  {
    emoji: "📂",
    question: "Где лежат миграции Supabase?",
    answer: "supabase/migrations/",
    color: "from-emerald-500 to-teal-600",
  },
  {
    emoji: "🔥",
    question: "Какое слово запускает новый Supabase-проект?",
    answer: "init",
    color: "from-amber-500 to-orange-600",
  },
  {
    emoji: "🪄",
    question: "Где искать имя таблицы в миграции?",
    answer: "Первая строка с TABLE",
    color: "from-purple-500 to-pink-600",
  },
  {
    emoji: "🧩",
    question: "Что написать в первой строке client page?",
    answer: '"use client";',
    color: "from-cyan-500 to-blue-600",
  },
  {
    emoji: "✨",
    question: "Какие импорты чаще всего нужны в UI?",
    answer: 'import { motion } from "framer-motion";\nimport { cn } from "@/lib/utils";',
    color: "from-violet-500 to-fuchsia-600",
  },
  {
    emoji: "🚀",
    question: "Что делать со всем остальным SQL / Java / boilerplate?",
    answer: "Спроси у агента",
    color: "from-red-500 to-rose-600",
    final: true,
  },
];

const AI_FACTS = [
  {
    icon: "🎵",
    title: "Spotify HONK",
    desc: "Внутренний AI-пайплайн: инженеры направляют систему, а не пишут вручную каждую строчку.",
    stat: "0% героического ручного кода",
  },
  {
    icon: "🤖",
    title: "OpenAI Codex",
    desc: "Флот агентов делает реализацию, тесты и рефакторинг параллельно.",
    stat: "95%+ кода делает AI",
  },
  {
    icon: "⚡",
    title: "Copilot экосистема",
    desc: "Рутинный код всё чаще пишется ассистентом, человек управляет и проверяет.",
    stat: "ускорение итераций",
  },
  {
    icon: "🧠",
    title: "Новая норма",
    desc: "Кодинг становится задачей машины. Человек проектирует, декомпозирует и принимает решения.",
    stat: "роль: bot manager",
  },
];

const OLD_HABITS = [
  "«Я сам быстро допишу SQL» → нет, делегируй агенту.",
  "«Я сам помню синтаксис JOIN» → не трать голову на справочник.",
  "«Я вручную поправлю миграцию» → агент сделает чище и безопаснее.",
  "«Я сам наклепаю API-слой» → дай спецификацию, агент сгенерит.",
  "«Я сам потом всё протестирую» → пусть агент сразу добавит проверки.",
  "«Я учу Java/SQL годами перед стартом» → начни строить продукт сегодня.",
];

const MANAGER_PLAYBOOK = [
  "Формулируешь задачу как бизнес-результат.",
  "Делишь на шаги: схема, API, UI, тесты, деплой.",
  "Назначаешь шаги агенту и требуешь артефакты.",
  "Ревьюишь, мерджишь, двигаешься дальше.",
];

const ROLE_SHIFT = [
  { oldRole: "Кодер", newRole: "Менеджер ботов", oldIcon: Code2, newIcon: Bot },
  { oldRole: "Фиксер багов", newRole: "Оператор флота", oldIcon: GitPullRequest, newIcon: Users },
  { oldRole: "Ревьюер строк", newRole: "Архитектор решений", oldIcon: Brain, newIcon: Wand2 },
];

export default function SqlCheatsheet2026() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#22d3ee1c_1px,transparent_1px)] bg-[length:28px_28px] sm:bg-[length:42px_42px]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <section className="mb-10 text-center sm:mb-14">
          <Badge className="mb-4 border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-mono sm:mb-6 sm:text-sm">
            SQL CHEATSHEET 2026 — КОДИТ БОТ, ЧЕЛОВЕК УПРАВЛЯЕТ
          </Badge>
          <h1 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-5xl md:text-6xl">
            Кодинг — работа бота.
            <br />
            Твоя работа — управлять ботами.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
            Хватит поклоняться синтаксису. SQL, Java и прочий шаблонный шум делает агент — ты строишь продукт, скорость и систему.
          </p>
          <p className="mx-auto mt-3 max-w-2xl rounded-xl border border-border bg-card/70 px-4 py-2 text-xs text-muted-foreground sm:text-sm">
            Эта страница сделана человеком, который год не мог нормально въехать в SQL, а потом собрал её за 5 минут.
          </p>
        </section>

        <section className="mb-12 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {AI_FACTS.map((fact, idx) => (
            <motion.article
              key={fact.title}
              initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="mb-2 text-3xl">{fact.icon}</div>
              <h3 className="text-base font-bold">{fact.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{fact.desc}</p>
              <div className="mt-3 inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                {fact.stat}
              </div>
            </motion.article>
          ))}
        </section>

        <section className="mb-12 grid grid-cols-1 gap-4 sm:mb-16 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ETERNAL_TRUTHS.map((truth, i) => (
            <motion.article
              key={truth.question}
              initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn("rounded-2xl bg-gradient-to-br p-px", truth.color)}
            >
              <div className="flex h-full min-h-[210px] flex-col rounded-[15px] border border-border/60 bg-card p-4 sm:p-5">
                <div className="mb-3 text-4xl">{truth.emoji}</div>
                <h3 className="mb-3 text-base font-bold leading-snug">{truth.question}</h3>
                <div className="mt-auto">
                  <code className="block overflow-x-auto rounded-lg border border-emerald-500/30 bg-background px-3 py-2 font-mono text-xs text-emerald-500 sm:text-sm">
                    {truth.answer}
                  </code>
                  {truth.final ? <p className="mt-2 text-xs text-emerald-500/80">← Вот это и есть главная шпаргалка.</p> : null}
                </div>
              </div>
            </motion.article>
          ))}
        </section>

        <section className="mb-12 grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-red-500/30 bg-card p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <Skull className="h-7 w-7 text-red-500" />
              <div>
                <h2 className="text-xl font-black text-red-400 sm:text-2xl">Старый путь: страдать в синтаксисе</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">Слишком дорого по времени и нервам.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {OLD_HABITS.map((habit) => (
                <div key={habit} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
                  <span className="pt-0.5 text-red-500">×</span>
                  <p className="text-sm text-muted-foreground">{habit}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
              <Lightbulb className="h-4 w-4" /> Новый путь: формулируй задачу, а не печатай шум.
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black">
              <Crown className="h-5 w-5 text-amber-400" /> Playbook менеджера ботов
            </h3>
            <ol className="space-y-3">
              {MANAGER_PLAYBOOK.map((step, idx) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-400">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-400" />
              KPI дня: shipped changes, не выученный синтаксис.
            </div>
          </aside>
        </section>

        <section className="mb-14">
          <h2 className="mb-5 text-center text-2xl font-black sm:text-3xl">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Новые роли</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ROLE_SHIFT.map(({ oldRole, newRole, oldIcon: OldIcon, newIcon: NewIcon }) => (
              <div key={oldRole} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 text-center">
                    <OldIcon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground line-through">{oldRole}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-purple-400" />
                  <div className="flex-1 text-center">
                    <NewIcon className="mx-auto mb-2 h-5 w-5 text-cyan-400" />
                    <p className="text-sm font-semibold text-foreground">{newRole}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl rounded-3xl border border-border bg-gradient-to-br from-card via-card to-card/70 p-6 text-center sm:p-10">
          <Flame className="mx-auto mb-3 h-7 w-7 text-orange-400" />
          <h2 className="mb-2 text-2xl font-black sm:text-3xl">Хватит учить «языки ради языков»</h2>
          <p className="mb-5 text-sm text-muted-foreground sm:text-base">
            Ты не нанят как принтер SQL/Java. Ты нанят как человек, который запускает фичи, проверяет качество и двигает продукт.
          </p>
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><Zap className="h-3.5 w-3.5" /> build fast</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><FileCode2 className="h-3.5 w-3.5" /> delegate code</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><Sparkles className="h-3.5 w-3.5" /> ship daily</span>
          </div>
          <Button size="lg" className="h-11 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-bold text-white hover:from-purple-500 hover:to-pink-500 sm:h-12 sm:w-auto sm:px-8 sm:text-base" asChild>
            <a href="https://chatgpt.com/codex" target="_blank" rel="noopener noreferrer">
              <Rocket className="mr-2 h-4 w-4" /> Открыть Codex и начать строить
            </a>
          </Button>
        </section>
      </div>
    </main>
  );
}
