"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bike,
  Bot,
  Brain,
  ClipboardCheck,
  Cpu,
  Crosshair,
  FlaskConical,
  KanbanSquare,
  Network,
  Rocket,
  ShieldCheck,
  Store,
  Target,
  TimerReset,
  TrendingUp,
  Users,
  WandSparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CapabilityLaunchGrid } from "@/components/CapabilityLaunchGrid";
import { GreenboxIntegrationMatrix } from "@/components/GreenboxIntegrationMatrix";

const pillars = [
  {
    icon: Cpu,
    title: "Умная инфраструктура",
    text: "Один контур для идей, автоматизаций и релизов без ручной рутины.",
  },
  {
    icon: Network,
    title: "Связанные инструменты",
    text: "Codex, Nexus и Repo XML работают как единая операционная среда.",
  },
  {
    icon: ShieldCheck,
    title: "Контроль качества",
    text: "Прозрачные сценарии, проверяемые шаги и меньше регрессий.",
  },
  {
    icon: Rocket,
    title: "Быстрый запуск",
    text: "Из прототипа в рабочий сценарий — за часы, а не за недели.",
  },
];

const pilotKpiFunnel = [
  {
    stage: "Лиды",
    value: "100",
    detail: "Telegram, лендинг, рекомендации",
    accent: "text-cyan-300",
  },
  {
    stage: "Квалификация",
    value: "37%",
    detail: "понятен запрос, есть контакт, выбран сценарий",
    accent: "text-sky-300",
  },
  {
    stage: "Тест-райд / бронь",
    value: "18%",
    detail: "оператор подтвердил слот и байк",
    accent: "text-violet-300",
  },
  {
    stage: "Оплата / сделка",
    value: "9%",
    detail: "аренда, покупка, сервис или партнёрский пакет",
    accent: "text-emerald-300",
  },
];

const pilotKpiSignals = [
  {
    icon: TrendingUp,
    label: "Conversion",
    value: "9%",
    hint: "lead → paid booking",
  },
  {
    icon: TimerReset,
    label: "SLA ответа",
    value: "≤ 15 мин",
    hint: "первый операторский контакт",
  },
  {
    icon: Users,
    label: "Партнёры",
    value: "3 пилота",
    hint: "готовы к франшизной упаковке",
  },
  {
    icon: ClipboardCheck,
    label: "PR-срез",
    value: "FRZ-R5",
    hint: "KPI board для SupaPlan",
  },
];

const readyExamples = [
  {
    title: "Image Swap Lab",
    description: "Туториал и боевой флоу замены изображений с AI-подсказками.",
    href: "/tutorials/image-swap",
    icon: FlaskConical,
    tag: "TUTORIAL",
  },
  {
    title: "Repo XML Assistant",
    description: "Сбор контекста, генерация патчей и PR-цикл внутри одного контура.",
    href: "/repo-xml",
    icon: Bot,
    tag: "DEV FLOW",
  },
  {
    title: "Strikeball Ops",
    description: "Игровой geo/live-модуль с лобби, логистикой и live HUD.",
    href: "/strikeball",
    icon: Crosshair,
    tag: "LIVE OPS",
  },
  {
    title: "WB Landing / Ops",
    description: "Операционные дашборды для коммерческих сценариев и аналитики.",
    href: "/wblanding",
    icon: Store,
    tag: "BIZ OPS",
  },
  {
    title: "Leads Engine",
    description: "Пайплайн лидов, промпты и инструменты поддержки продаж.",
    href: "/leads",
    icon: Target,
    tag: "PIPELINE",
  },
  {
    title: "CyberVibe Strategy",
    description: "Стратегический слой: планирование, гипотезы и roadmap под запуск.",
    href: "/cybervibe",
    icon: Brain,
    tag: "STRATEGY",
  },
];

export default function NexusPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-white pb-16">
      <section className="container mx-auto px-4 pt-28 sm:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl"
        >
          <p className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-mono tracking-wide text-cyan-300">
            <WandSparkles className="mr-2 h-3.5 w-3.5" /> THE NEW ERA
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold leading-tight">
            NEXUS: точка сборки новой цифровой эпохи
          </h1>
          <p className="mt-4 text-zinc-300 max-w-2xl">
            Здесь соединяются автоматизация, инженерные практики и продуктовая скорость.
            Nexus помогает команде быстрее двигаться от идеи к результату без хаоса и лишних переключений.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
              <Link href="/repo-xml">
                Перейти в Repo XML <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-zinc-700 hover:bg-zinc-800">
              <Link href="/">На главную</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="container mx-auto px-4 mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-2 gap-4">
        {pillars.map((pillar, index) => {
          const Icon = pillar.icon;
          return (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * index }}
            >
              <Card className="h-full border-zinc-800 bg-zinc-900/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center text-zinc-100">
                    <Icon className="mr-2 h-5 w-5 text-cyan-300" />
                    {pillar.title}
                  </CardTitle>
                  <CardDescription className="text-zinc-400">Nexus Pillar {index + 1}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-300">{pillar.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </section>

      <section className="container mx-auto mt-8 px-4">
        <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-zinc-100">Единый вход в исполнительные поверхности</CardTitle>
            <CardDescription className="text-zinc-400">Те же capability-кнопки вынесены в общий компонент, чтобы /, /nexus и /greenbox держали один и тот же маршрутный контракт.</CardDescription>
          </CardHeader>
          <CardContent>
            <CapabilityLaunchGrid includeVipBikeRental className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" />
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto mt-8 px-4">
        <Card className="border-cyan-500/30 bg-cyan-500/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <KanbanSquare className="h-5 w-5 text-cyan-300" />
              FRZ-R3 analytics deck: VIP Bike franchize status
            </CardTitle>
            <CardDescription className="text-zinc-300">
              Отдельный операторский board сопоставляет клиентские идеи с SupaPlan задачами и статусами на человеческом языке.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
              <Link href="/supaplan/franchize">
                Open /supaplan/franchize <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-zinc-700 hover:bg-zinc-800">
              <Link href="/franchize/vip-bike/map-riders">
                <Bike className="mr-2 h-4 w-4" /> VIP Bike Map Riders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto mt-8 px-4">
        <Card className="overflow-hidden border-emerald-500/30 bg-emerald-500/5 backdrop-blur">
          <CardHeader className="border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardDescription className="font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-300">
                  FRZ-R5 · pilot KPI scoreboard
                </CardDescription>
                <CardTitle className="mt-2 flex items-center gap-2 text-2xl text-zinc-100">
                  <BarChart3 className="h-6 w-6 text-emerald-300" />
                  Воронка франшизы без табличного ада
                </CardTitle>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
                  Быстрый операторский срез показывает, где VIP Bike теряет или выигрывает деньги:
                  от входящего лида до оплаченной брони, сделки или партнёрского пакета. Значения — пилотные
                  ориентиры для еженедельной сверки, не фейковая live-аналитика.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-black/30 px-4 py-3 text-sm text-zinc-300">
                <div className="text-xs font-mono uppercase tracking-widest text-emerald-300">North Star</div>
                <div className="mt-1 text-2xl font-bold text-white">lead → paid booking</div>
                <div className="mt-1 text-xs text-zinc-400">единый язык для продаж, аренды и onboarding</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {pilotKpiSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div key={signal.label} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">{signal.label}</p>
                      <Icon className="h-4 w-4 text-emerald-300" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white">{signal.value}</p>
                    <p className="mt-1 text-xs text-zinc-400">{signal.hint}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              {pilotKpiFunnel.map((step, index) => (
                <div key={step.stage} className="relative rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  {index < pilotKpiFunnel.length - 1 ? (
                    <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-emerald-400/40 lg:block" />
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-mono text-zinc-400">
                      STEP {index + 1}
                    </span>
                    <span className={`text-xl font-black ${step.accent}`}>{step.value}</span>
                  </div>
                  <h3 className="mt-4 font-semibold text-zinc-100">{step.stage}</h3>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">{step.detail}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-300">
                Следующий полезный шаг: подключить эти KPI к реальным событиям заказа и MapRiders без изменения
                текущих публичных маршрутов.
              </p>
              <Button asChild variant="outline" className="border-emerald-500/40 hover:bg-emerald-500/10">
                <Link href="/supaplan/franchize">
                  Открыть задачи франшизы <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <GreenboxIntegrationMatrix />

      <section className="container mx-auto px-4 mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Готовые примеры из текущего репо</h2>
          <p className="text-xs font-mono text-zinc-400">Подобрано по реальным маршрутам app/*/page.tsx</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readyExamples.map((example, index) => {
            const Icon = example.icon;
            return (
              <motion.div
                key={example.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * index }}
              >
                <Link href={example.href} className="block h-full">
                  <Card className="h-full border-zinc-800 bg-zinc-900/60 hover:border-cyan-400/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-[10px] font-mono tracking-wide text-cyan-300">{example.tag}</CardDescription>
                      <CardTitle className="text-base flex items-center text-zinc-100">
                        <Icon className="mr-2 h-4 w-4 text-cyan-300" /> {example.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-zinc-400">{example.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
