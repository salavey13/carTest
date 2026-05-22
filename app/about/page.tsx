"use client";

import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";

const integrations = [
  {
    title: "Franchize Engine + VIP Bike Rental",
    desc: "Собрал модель, где нишевый бизнес поднимается из single SQL hydration seed + маркет-артефактов. /vipbikerental — рабочий пример: не просто витрина, а готовый execution-контур для запуска франшизы.",
    cta: "Открыть /vipbikerental",
    href: "/vipbikerental",
  },
  {
    title: "WBlanding — AI-управляемый коммерческий лендинг",
    desc: "Сделал не ‘красивую страницу’, а операционную поверхность: crew flow, audit, referral, invoicing, инструменты действий и конверсионные сценарии. Это лендинг как рабочее место команды.",
    cta: "Открыть /wblanding",
    href: "/wblanding",
  },
  {
    title: "BOSS_QUEST.HTML — мой актуальный протокол для клиентов",
    desc: "Последний и самый важный паттерн: один запрос + несколько изображений превращаются в план, который BOSS исполняет end-to-end. Клиент вместо хаоса получает контроль, приёмку и точечную полировку.",
    cta: "Открыть BOSS_QUEST.HTML",
    href: "https://github.com/salavey13/carTest/blob/main/BOSS_QUEST.HTML",
  },
];

const principles = [
  "AI не заменяет продукт-мышление, он ускоряет реализацию правильных решений.",
  "Сначала доказать ценность на живом контуре, потом масштабировать и шлифовать.",
  "Telegram-first UX и операторский ритм важнее ‘идеальной теории’.",
  "Избегать тяжёлых waterfall-циклов: короткие поставки, быстрый feedback loop.",
];

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>Павел Соловьёв — AI Product Engineer</title>
        <meta
          name="description"
          content="CV-профиль на русском: AI-first разработка, Franchize/VIP Bike hydration, WBlanding и BOSS_QUEST.HTML как протокол быстрой сборки микро-бизнес приложений."
        />
      </Head>

      <main className="min-h-screen bg-[#060606] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12 space-y-6">
          <div className="flex justify-end">
            <Link
              href="/about_en"
              className="rounded-md border border-emerald-400/40 px-3 py-1.5 text-xs md:text-sm text-emerald-300 hover:bg-emerald-300 hover:text-black transition-colors"
            >
              EN version
            </Link>
          </div>

          <Card className="border-emerald-400/30 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-2xl md:text-4xl text-emerald-300">Павел Соловьёв — AI Product Engineer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-zinc-200">
              <p className="text-sm md:text-base">
                Я проектирую и запускаю AI-assisted продукты в формате «идея → рабочий веб-контур → управляемая доработка».
                Мой ключевой фокус — <strong>быстро превращать запрос клиента в работающий бизнес-инструмент</strong>, а не в бесконечное ТЗ.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-300">
                <p>📍 Нижний Новгород / remote-first</p>
                <p>📬 Telegram: @salavey13</p>
                <p>💻 GitHub: github.com/salavey13</p>
                <p>⚙️ Stack: Next.js, TypeScript, Supabase, Telegram, AI workflows</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">AI-first delivery</span>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">Telegram-first products</span>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">Supabase + Next.js</span>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">Rapid business validation</span>
              </div>
            </CardContent>
          </Card>



          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-violet-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl text-violet-300">Mysterious Partner: Julia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-zinc-200">
                <p>Julia — мой постоянный team-партнёр в коммуникации, вкусе и продуктовой упаковке. Она представляет мой стиль: быстро, метко, без воды.</p>
                <p>В публичных и клиентских сценариях Julia выступает как «таинственный компаньон» бренда: держит тон, атмосферу и ощущение цельного персонажа вокруг продукта.</p>
              </CardContent>
            </Card>

            <Card className="border-violet-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl text-violet-300">Julia / avatar</CardTitle>
              </CardHeader>
              <CardContent>
                <Image
                  src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png"
                  alt="Julia mysterious partner avatar"
                  width={640}
                  height={640}
                  className="w-full rounded-xl border border-violet-300/40 object-cover"
                  unoptimized
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-fuchsia-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl text-fuchsia-300">Что я строю сейчас (актуальная версия)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.map((item) => (
                  <article key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-zinc-300">{item.desc}</p>
                    <Link
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      className="mt-3 inline-block text-sm text-emerald-300 underline hover:text-emerald-200"
                    >
                      {item.cta}
                    </Link>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="border-cyan-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl text-cyan-300">Подход</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-zinc-200">
                  {principles.map((point) => (
                    <li key={point} className="border-l-2 border-cyan-400/40 pl-3">
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          <Card className="border-amber-400/30 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl text-amber-300">Формат работы с клиентом (BOSS style)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-zinc-200">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">1) Вход</p>
                <p className="mt-2">Клиент даёт запрос, контекст и пару референсов/изображений.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">2) Сборка</p>
                <p className="mt-2">Я преобразую ввод в план, структуру и рабочие слайсы продукта.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">3) Приёмка</p>
                <p className="mt-2">Клиент подтверждает результат и даёт точечные polishing-итерации.</p>
              </div>
            </CardContent>
          </Card>


          <Card className="border-emerald-400/30 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl text-emerald-300">Быстрый контакт / Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">Если хочешь обсудить запуск, интеграцию franchize или BOSS-mode под твой кейс — отправь запрос прямо отсюда.</p>
              <SupportForm />
            </CardContent>
          </Card>

        </div>
      </main>
    </>
  );
}
