"use client";

import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

export default function SaunaRentPage() {
  return (
    <>
      <Head>
        <title>Сауна — Reset / oneSitePls VIBE</title>
        <meta name="description" content="LÖYLY VIBE — сауна для тех, кто не любит блаженство без результата. Бронируй через Telegram Stars. Быстро, честно, по делу." />
      </Head>

      <div className="relative min-h-screen bg-black text-white selection:bg-accent/30 selection:text-black">
        {/* Inline styles for glitch and hero pan */}
        <style>{`
          @keyframes heroPan {
            0% { transform: scale(1.03) translateY(0px); }
            50% { transform: scale(1.07) translateY(-12px); }
            100% { transform: scale(1.03) translateY(0px); }
          }
          @keyframes glitchClip {
            0% { clip-path: inset(0 0 0 0); transform: translate(0); }
            8% { clip-path: inset(8% 0 60% 0); transform: translate(-2px, -1px) skew(-0.5deg); }
            18% { clip-path: inset(30% 0 40% 0); transform: translate(2px, 1px) skew(0.5deg); }
            28% { clip-path: inset(5% 0 70% 0); transform: translate(-1px, 0) skew(-0.2deg); }
            50% { clip-path: inset(0 0 0 0); transform: translate(0); }
            100% { clip-path: inset(0 0 0 0); transform: translate(0); }
          }
          .hero-pan { animation: heroPan 32s linear infinite; will-change: transform; }
          .glitch-wrap { position: relative; display: inline-block; }
          .glitch-censor {
            position: absolute; inset: 0; pointer-events: none;
            background: linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(255,0,150,0.06) 30%, rgba(0,0,0,0.72) 100%);
            mix-blend-mode: screen; animation: glitchClip 2.4s infinite; opacity: 0.95;
            filter: drop-shadow(0 6px 18px rgba(0,0,0,0.6));
          }
          .hero-title { text-shadow: 0 6px 30px rgba(0,0,0,0.65); }
          /* Make buttons pop on black */
          .cta-btn { box-shadow: 0 10px 30px rgba(255,165,0,0.08); }
          @media (max-width: 640px) {
            .hero-title { font-size: 1.35rem !important; }
          }
        `}</style>

        {/* HERO */}
        <section
          className="relative h-[86vh] min-h-[820px] flex items-center justify-center text-center px-6 overflow-hidden"
          aria-labelledby="sauna-hero-title"
        >
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1583416277334-221539234853?q=80&w=2000&auto=format&fit=crop"
              alt="Sauna interior warm lighting"
              layout="fill"
              objectFit="cover"
              className="brightness-40 hero-pan"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/80 to-transparent" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.1 }}
            className="relative z-10 max-w-4xl mx-auto"
          >
            <div className="mb-6">
              <div className="glitch-wrap inline-block">
                <h1 id="sauna-hero-title" className="hero-title font-orbitron text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight tracking-tight">
                  LÖYLY VIBE
                </h1>
                <div className="glitch-censor" aria-hidden />
              </div>
            </div>

            <p className="mx-auto max-w-3xl text-sm sm:text-base md:text-lg text-amber-100/95 font-light">
              Не «спа» для инстаграма — сауна как инструмент: очистка, ритуал и перезагрузка перед важной задачей.
              За 60–90 минут ты получаешь не отдых, а состояние — ясность, контроль, готовность к действию.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a href="#book" className="w-full sm:w-auto">
                <Button aria-label="Забронировать сауну" size="lg" className={cn("cta-btn w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-900 font-orbitron")}>
                  <VibeContentRenderer content="::FaHotTubPerson:: Забронировать сеанс" />
                </Button>
              </a>

              <Link href="/about#mind" legacyBehavior>
                <a className="w-full sm:w-auto">
                  <Button size="lg" variant="ghost" className="w-full sm:w-auto">
                    <VibeContentRenderer content="::FaPersonChalkboard:: Йог для ума (арендовать)" />
                  </Button>
                </a>
              </Link>
            </div>

            <div className="mt-5 text-xs text-gray-400 font-mono">
              <span className="inline-block px-3 py-1 rounded-full bg-white/5 text-amber-200 font-semibold">Оплата — Telegram Stars</span>
              <span className="ml-3">— мгновенно, локально, честно.</span>
            </div>
          </motion.div>
        </section>

        {/* CONTENT / DETAILS */}
        <main className="container mx-auto px-4 py-12 space-y-10">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-[#060606] border border-[#222]">
              <CardHeader>
                <CardTitle className="font-orbitron text-xl text-amber-200 flex items-center gap-3">
                  <VibeContentRenderer content="::FaFire::" /> Что внутри
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 mb-3">Приватная финская сауна, холодный купель / душевая, зона отдыха, полотенца и ароматическая подача. Никакой трепанины — только работа с состоянием.</p>
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
                  <li>60–90 минутные сессии</li>
                  <li>Группа до 6 человек — закрытая бронь</li>
                  <li>Возможно сочетание с дыхательной практикой и короткой «mind-yoga»</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-[#060606] border border-[#222]">
              <CardHeader>
                <CardTitle className="font-orbitron text-xl text-amber-200 flex items-center gap-3">
                  <VibeContentRenderer content="::FaClock::" /> Процедура
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-2 pl-4">
                  <li>Встреча — короткая инструкция и цели (5 мин)</li>
                  <li>Сауна — циклы жара + охлаждение (45–60 мин)</li>
                  <li>Завершение — чай и интеграция, краткая медитация (10–20 мин)</li>
                </ol>
                <p className="mt-3 text-xs text-gray-400">Результат — снятие ментального шума и восстановленная способность фокусироваться.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#060606] border border-[#222]">
              <CardHeader>
                <CardTitle className="font-orbitron text-xl text-amber-200 flex items-center gap-3">
                  <VibeContentRenderer content="::FaTag::" /> Цены / Уровни
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 mb-2">Оплата через Telegram Stars (XTR) — простой честный поток.</p>
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
                  <li>3★ — Быстрая сессия (60 мин)</li>
                  <li>5★ — Ритуал + дыхание (90 мин)</li>
                  <li>Группы и корпоративные запросы — по договорённости</li>
                </ul>
                <p className="mt-3 text-xs text-gray-400">После оплаты бот пришлёт счёт и отметку — я отвечаю и подтверждаю бронь.</p>
              </CardContent>
            </Card>
          </section>

          {/* Why this works + controversy punch */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-[#050505] border border-[#222]">
                <CardHeader>
                  <CardTitle className="font-orbitron text-2xl text-white">Почему это не обычная сауна</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4">
                    Я не обещаю просветления. Я предлагаю инструмент: <strong className="text-amber-200">сбить шум</strong>, сделать кровь текучей и вернуть твою работоспособность.  
                    Люди приходят не за «релаксом в пижаме» — они приходят за результатом, который можно быстро измерить.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="p-4 bg-[#0b0b0b] rounded-lg border border-[#222]">
                      <h4 className="font-semibold text-amber-200 mb-2">Контрастный эффект</h4>
                      <p className="text-xs text-gray-300">Тепло + холод + дыхание = быстрый сдвиг в бодрости и ясности.</p>
                    </div>
                    <div className="p-4 bg-[#0b0b0b] rounded-lg border border-[#222]">
                      <h4 className="font-semibold text-amber-200 mb-2">Честная монетизация</h4>
                      <p className="text-xs text-gray-300">Stars — легко, локально, без лишней бухгалтерии.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border border-[#222]">
                <CardHeader>
                  <CardTitle className="font-orbitron text-2xl text-white">Риски и правила</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-2 pl-4">
                    <li>Не для людей с острыми сердечными проблемами — проконсультируйтесь с врачом.</li>
                    <li>Приходите вовремя — сессии идут строго по расписанию.</li>
                    <li>Алкоголь и агрессивное поведение — под запретом.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Booking / SupportForm */}
            <aside id="book" className="relative">
              <Card className="bg-[#080808] border border-[#222] md:sticky md:top-24">
                <CardHeader>
                  <CardTitle className="font-orbitron text-xl text-amber-200">Забронировать — оплатить Stars</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4">Выбери уровень — счёт придёт в Telegram. Оплатил — я получаю уведомление и подтверждаю бронь.</p>

                  <div className="mb-4">
                    <SupportForm />
                  </div>

                  <div className="text-xs text-gray-400">
                    <p className="mb-2">Или пиши напрямую: <a href="https://t.me/salavey13" target="_blank" rel="noreferrer" className="text-amber-200 hover:underline">Telegram</a>.</p>
                    <p className="text-xxs">После оплаты бот: пришлёт подтверждение → я отмечаю бронь → мы договариваемся по времени.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#070707] border border-[#222] mt-6">
                <CardContent>
                  <h4 className="font-semibold text-amber-200 mb-2">Быстрые ссылки</h4>
                  <ul className="text-sm list-inside space-y-2 text-gray-300">
                    <li><Link href="/vipbikerental"><a className="hover:underline">VIP Байк</a></Link></li>
                    <li><Link href="/rent-bike"><a className="hover:underline">Каталог байков</a></Link></li>
                    <li><Link href="/about#mind"><a className="hover:underline">Йог для ума — я</a></Link></li>
                    <li><Link href="/repo-xml"><a className="hover:underline">/repo-xml Studio</a></Link></li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </section>

          {/* Footer CTA */}
          <section className="py-8 text-center">
            <p className="text-sm text-gray-400 mb-4">Пробный ритуал за 3★ — хочешь проверить эффект прямо сейчас? Оплати, и сделаем быстрый reset.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a href="#book" className="w-full sm:w-auto"><Button className="w-full sm:w-auto">Забронировать — 3★</Button></a>
              <Link href="/selfdev"><a className="w-full sm:w-auto"><Button variant="secondary" className="w-full sm:w-auto">SelfDev: методика</Button></a></Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}