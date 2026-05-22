"use client";

import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";

const coreBlocks = [
  {
    title: "Кто я",
    text: "13+ лет в разработке (C++/Java/TS), сегодня — AI Product Engineer. Моя зона силы: быстро превращать бизнес-запрос в рабочий веб-контур с понятной приёмкой и дальнейшим ростом.",
  },
  {
    title: "Что даю клиенту",
    text: "Не просто ‘страницу’, а работающий продуктовый ритм: архитектура, интеграции, операционный UX, быстрые итерации и контроль качества по живым результатам.",
  },
  {
    title: "Как работаю",
    text: "BOSS-mode delivery: intake запроса → декомпозиция → быстрый выкат рабочих слайсов → полировка под реальный контекст команды и продаж.",
  },
];

const flagship = [
  {
    name: "Franchize + VIP Bike",
    proof: "Полноценный запуск через hydration SQL",
    details:
      "Модель, где новый бизнес-контур собирается из single SQL seed + market/items. /vipbikerental показывает, как быстро запустить не мокап, а живую систему.",
    href: "/vipbikerental",
  },
  {
    name: "WBlanding",
    proof: "Лендинг как операционная панель",
    details:
      "Action-слои, crew, audit, referral, invoicing и коммерческая логика в одном пространстве. Это интерфейс для действий, а не ‘декоративная обложка’.",
    href: "/wblanding",
  },
  {
    name: "BOSS_QUEST.HTML",
    proof: "Последний и главный протокол взаимодействия",
    details:
      "Один запрос + пару изображений превращаю в исполнимый квест-план: BOSS ведёт delivery end-to-end, клиент концентрируется на acceptance и polishing.",
    href: "https://github.com/salavey13/carTest/blob/main/BOSS_QUEST.HTML",
  },
];

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>Павел Соловьёв — About / CV</title>
        <meta name="description" content="CV-страница Павла Соловьёва: опыт, flagship-кейсы Franchize/VIP Bike, WBlanding, BOSS_QUEST и формат BOSS-mode delivery." />
      </Head>

      <main className="min-h-screen bg-[#06070b] text-zinc-100">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 md:pt-28 space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.2em] uppercase text-zinc-400">about / ru</p>
            <Link href="/about_en" className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-300 hover:text-black transition-colors">about_en (RU portfolio)</Link>
          </div>

          <Card className="border-emerald-400/35 bg-zinc-950/90">
            <CardContent className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:p-8">
              <div>
                <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png" alt="Павел Соловьёв" width={700} height={900} className="h-full w-full rounded-2xl border border-emerald-300/40 object-cover" unoptimized />
              </div>
              <div className="space-y-4">
                <h1 className="text-3xl md:text-5xl font-semibold text-emerald-300">Павел Соловьёв</h1>
                <p className="text-base md:text-lg text-zinc-200">AI Product Engineer · Telegram-first builder · архитектура + скорость + бизнес-результат</p>
                <div className="grid grid-cols-1 gap-2 text-sm text-zinc-300 md:grid-cols-2">
                  <p>📍 Нижний Новгород / remote</p><p>📬 Telegram: @salavey13</p>
                  <p>💻 github.com/salavey13</p><p>⚙️ Next.js · Supabase · AI workflows</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-3">
            {coreBlocks.map((b) => (
              <Card key={b.title} className="border-cyan-400/25 bg-zinc-950/90">
                <CardHeader><CardTitle className="text-xl text-cyan-300">{b.title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-zinc-300">{b.text}</CardContent>
              </Card>
            ))}
          </section>

          <Card className="border-fuchsia-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-fuchsia-300">Ключевые интеграции и демо</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {flagship.map((item) => (
                <article key={item.name} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="mt-1 text-xs text-fuchsia-200">{item.proof}</p>
                  <p className="mt-3 text-sm text-zinc-300">{item.details}</p>
                  <Link href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} className="mt-3 inline-block text-sm text-emerald-300 underline">Открыть</Link>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="border-violet-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-violet-300">Julia — mysterious partner</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
              <p className="text-sm md:text-base text-zinc-300">Julia — отдельный бренд-персонаж и партнёр по подаче: атмосфера, эмоциональный контур и цельный стиль коммуникации. Это дополнительный слой бренда рядом с моим основным инженерным и продуктовым контуром.</p>
              <div className="rounded-xl border border-violet-300/40 bg-[radial-gradient(circle_at_30%_20%,#8b5cf666,#09090b_65%)] p-4 text-xs uppercase tracking-[0.22em] text-violet-200">Julia / signal</div>
            </CardContent>
          </Card>

          <Card className="border-amber-400/35 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-amber-300">SupportForm / быстрый старт</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">Нужен запуск или перезапуск продукта, BOSS-mode, franchize hydration или жёсткая полировка действующего контура — напишите детали, я соберу конкретный execution-план.</p>
              <SupportForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
