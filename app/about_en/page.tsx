"use client";

import Head from "next/head";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";

const portfolioTracks = [
  {
    title: "Трек A · Franchize-конструктор",
    bullets: [
      "Шаблонный запуск веб-бизнеса из hydration SQL + market-пакета.",
      "Флагман: /vipbikerental как рабочий контур, а не ‘презенташка’.",
      "Подходит для быстрого MVP/SMB запуска под конкретную нишу.",
    ],
  },
  {
    title: "Трек B · WBlanding execution surface",
    bullets: [
      "Конверсионный фронт + операционный слой (crew, audit, referral, invoicing).",
      "Сценарии собраны вокруг реальных действий команды и денег.",
      "Удобно масштабировать по модулям без переписывания ядра.",
    ],
  },
  {
    title: "Трек C · BOSS_QUEST протокол",
    bullets: [
      "Клиент приносит запрос + референсы/изображения.",
      "Я превращаю это в поэтапный executable-план с контролем качества.",
      "Фокус клиента: принимать результат и задавать точечную полировку.",
    ],
  },
];

export default function AboutEnPage() {
  return (
    <>
      <Head>
        <title>about_en — отдельное портфолио (RU)</title>
        <meta name="description" content="Отдельная русская portfolio-страница с другим контентом: проектные треки, формат сотрудничества и BOSS delivery." />
      </Head>

      <main className="min-h-screen bg-[#07070b] text-zinc-100">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 md:pt-28 space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.2em] uppercase text-zinc-400">about_en / ru-portfolio</p>
            <Link href="/about" className="rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-300 hover:text-black transition-colors">back to about CV</Link>
          </div>

          <Card className="border-cyan-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-3xl md:text-5xl text-cyan-300">Портфолио формата «запрос → рабочий продукт»</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-zinc-200">
              <p className="text-base md:text-lg">Эта страница специально отдельная от `/about`: здесь не CV, а витрина delivery-подхода и продуктовых треков.</p>
              <p className="text-sm md:text-base">Если `/about` продаёт меня как специалиста, то `/about_en` продаёт мой формат исполнения задач и типовые траектории, по которым быстро собираются рабочие веб-контуры.</p>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-3">
            {portfolioTracks.map((track) => (
              <Card key={track.title} className="border-fuchsia-400/25 bg-zinc-950/90">
                <CardHeader><CardTitle className="text-xl text-fuchsia-300">{track.title}</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {track.bullets.map((b) => <li key={b} className="border-l-2 border-fuchsia-400/35 pl-3">{b}</li>)}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card className="border-emerald-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-emerald-300">Формат сотрудничества</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 text-sm text-zinc-300">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">Для владельца бизнеса</p>
                <p className="mt-2">Минимум бюрократии: цель, ограничения, материалы. На выходе — рабочий план и реализация, где видны этапы и прогресс.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">Для команды/продакта</p>
                <p className="mt-2">Интеграция в текущий стек и процессы: усиливаю delivery через AI + архитектурную дисциплину без поломки существующей логики.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-violet-300">Связаться / SupportForm</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">Опишите задачу, желаемый срок и что уже есть (контент/SQL/референсы) — отвечу с практичным планом внедрения.</p>
              <SupportForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
