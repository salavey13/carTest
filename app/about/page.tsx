"use client";

import Head from "next/head";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";

const cvHighlights = [
  "AI Product Engineer: превращаю запрос в рабочий продуктовый контур без затяжного waterfall.",
  "Telegram-first delivery: UX и операции изначально проектируются под мобильный ритм и быстрые касания.",
  "Next.js + Supabase + AI workflows: от архитектуры до прод-ready execution и сопровождения.",
  "Продуктовый режим: сначала ценность на живом контуре, потом масштаб и полировка.",
];

const flagshipCases = [
  {
    title: "Franchize / VIP Bike Rental",
    subtitle: "Полноценный бизнес-контур из одного hydration SQL",
    desc: "Собрал механику, где новый франшизный веб-контур поднимается из single SQL seed + market/items конфигурации. /vipbikerental — демонстрация того, как быстро развернуть рабочую модель, а не просто лендинг.",
    href: "/vipbikerental",
    cta: "Открыть живой пример",
  },
  {
    title: "WBlanding",
    subtitle: "Коммерческий лендинг как операционный центр",
    desc: "Это не витрина, а рабочее место: action-слои, crew flow, audit, referral, invoicing, воронка и исполнение в одном ритме. Сайт живёт как инструмент команды и продаж.",
    href: "/wblanding",
    cta: "Открыть WBlanding",
  },
  {
    title: "BOSS_QUEST.HTML",
    subtitle: "Главный клиентский протокол (актуальная версия)",
    desc: "Мой текущий фрейм: клиент даёт запрос + пару картинок, я раскладываю это в управляемый квест-план, где BOSS исполняет delivery end-to-end. Клиент фокусируется на приёмке и polishing, а не на хаосе процесса.",
    href: "https://github.com/salavey13/carTest/blob/main/BOSS_QUEST.HTML",
    cta: "Читать BOSS_QUEST",
  },
];

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>Павел Соловьёв — CV / AI Product Engineer</title>
        <meta
          name="description"
          content="CV-страница Павла Соловьёва: Franchize/VIP Bike hydration SQL, WBlanding, BOSS_QUEST.HTML и AI-first delivery для запуска микро-бизнес веб-продуктов."
        />
      </Head>

      <main className="min-h-screen bg-[#050507] text-zinc-100">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-16 md:pt-24 space-y-8">
          <div className="flex justify-between items-center gap-3">
            <p className="text-xs md:text-sm tracking-[0.16em] text-zinc-400 uppercase">about / cv-mode</p>
            <Link href="/about_en" className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-xs md:text-sm text-cyan-300 hover:bg-cyan-300 hover:text-black transition-colors">EN Portfolio</Link>
          </div>

          <Card className="border-emerald-400/30 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-3xl md:text-5xl text-emerald-300 leading-tight">Павел Соловьёв — AI Product Engineer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-base md:text-lg text-zinc-200">Делаю продукты, которые продают и работают: от идеи и контекста клиента до живого веб-контура с понятной приёмкой.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-300">
                <p>📍 Нижний Новгород / remote-first</p><p>📬 Telegram: @salavey13</p>
                <p>💻 GitHub: github.com/salavey13</p><p>⚙️ Stack: Next.js, TypeScript, Supabase, AI, Telegram</p>
              </div>
              <ul className="space-y-2 text-sm md:text-base text-zinc-200">
                {cvHighlights.map((item) => <li key={item} className="border-l-2 border-emerald-400/40 pl-3">{item}</li>)}
              </ul>
            </CardContent>
          </Card>

          <section className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-violet-400/30 bg-zinc-950/90">
              <CardHeader><CardTitle className="text-2xl text-violet-300">Julia — mysterious partner</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-zinc-200 text-sm md:text-base">
                <p>Julia — партнёр-персона бренда: отвечает за атмосферу, тон и цельный характер презентации. Это отдельный образ, не подмена моей личности.</p>
                <p>В клиентских сценариях Julia усиливает упаковку и эмоциональный контур, пока я держу архитектуру, delivery и бизнес-результат.</p>
              </CardContent>
            </Card>
            <Card className="border-violet-400/30 bg-zinc-950/90">
              <CardHeader><CardTitle className="text-xl text-violet-300">Avatar signal</CardTitle></CardHeader>
              <CardContent>
                <div className="aspect-square rounded-xl border border-violet-300/40 bg-[radial-gradient(circle_at_30%_20%,#8b5cf655,#0a0a0f_55%),linear-gradient(140deg,#111827,#3f3f46)] p-4 flex items-end">
                  <p className="text-xs text-violet-200/90 tracking-[0.2em] uppercase">JULIA / SIGNAL</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-fuchsia-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-fuchsia-300">Флагманские интеграции и демо</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {flagshipCases.map((item) => (
                <article key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-fuchsia-200">{item.subtitle}</p>
                  <p className="mt-3 text-sm text-zinc-300">{item.desc}</p>
                  <Link href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} className="mt-3 inline-block text-sm text-emerald-300 underline hover:text-emerald-200">{item.cta}</Link>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-amber-300">BOSS-mode: как я веду клиента</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4 text-sm text-zinc-200">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4"><p className="font-semibold text-white">01 · Intake</p><p className="mt-2">Запрос, цель, пара визуальных ориентиров.</p></div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4"><p className="font-semibold text-white">02 · Decompose</p><p className="mt-2">Разбор на работающие product-слайсы и операционный план.</p></div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4"><p className="font-semibold text-white">03 · Deliver</p><p className="mt-2">Быстрый выкат контуров, где клиент уже может щупать ценность.</p></div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4"><p className="font-semibold text-white">04 · Polish</p><p className="mt-2">Точечная полировка до уровня «готово к бою».</p></div>
            </CardContent>
          </Card>

          <Card className="border-emerald-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-emerald-300">Support / старт диалога</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">Если нужен запуск под ключ или адаптация BOSS-модели под ваш кейс — напишите здесь, соберём execution-путь.</p>
              <SupportForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
