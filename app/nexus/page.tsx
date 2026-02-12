"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, ShieldCheck, Rocket, Network, WandSparkles, FlaskConical, Target, Bot, Crosshair, Store, Brain } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
