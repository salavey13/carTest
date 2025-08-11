"use client";

import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SupportForm from "@/components/SupportForm";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

export default function RentAYogForMePage() {
  return (
    <>
      <Head>
        <title>Аренда Йога Разума — oneSitePls / VIBE</title>
        <meta name="description" content="Йог для ума, сауна, байки и SelfDev. Плати звёздами в Telegram - быстро, по делу, без блядства." />
      </Head>

      {/* Always dark mode — black edition */}
      <div className="relative min-h-screen bg-black text-white">
        <style>{`
          @keyframes glitch-clip {
            0% { clip-path: inset(0 0 0 0); transform: translate(0);} 
            10% { clip-path: inset(10% 0 60% 0); transform: translate(-2px, -1px) skew(-0.5deg);} 
            20% { clip-path: inset(30% 0 40% 0); transform: translate(2px, 1px) skew(0.5deg);} 
            30% { clip-path: inset(5% 0 70% 0); transform: translate(-1px, 0) skew(-0.2deg);} 
            50% { clip-path: inset(0 0 0 0); transform: translate(0);} 
            100% { clip-path: inset(0 0 0 0); transform: translate(0);} 
          }
          .glitch-wrap { position: relative; display: inline-block; }
          .glitch-censor {
            position: absolute; inset: 0; pointer-events: none;
            background: linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(255,0,150,0.06) 35%, rgba(0,0,0,0.65) 100%);
            mix-blend-mode: multiply; animation: glitch-clip 2.2s infinite; opacity: 0.98;
          }
          .glitch-text { position: relative; display: inline-block; }
          .badge-neon { display:inline-block; padding:6px 10px; border-radius:999px; background: linear-gradient(90deg,#00ff9d33,#ff49c833); color:#030303; font-weight:700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; }
          .hero-pan { transform-origin:center; will-change:transform; animation: heroPan 30s linear infinite; }
          @keyframes heroPan { 0% { transform: scale(1.02) translateY(0px);} 50% { transform: scale(1.05) translateY(-10px);} 100% { transform: scale(1.02) translateY(0px);} }
        `}</style>

        {/* HERO — taller and mobile-optimized */}
        <section className="relative h-[80vh] min-h-[720px] flex items-center justify-center text-center p-6 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/hero-4f94e671-c5c8-4405-ab08-8f9a47e1ad69.jpg"
              alt="hero"
              layout="fill"
              objectFit="cover"
              className="brightness-40 hero-pan"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/88 to-transparent" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 text-white">
            <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight tracking-tight">
              <span className="block">АРЕНДУЙ ВАЙБ</span>
              <span className="block text-primary">Йог. Сауна. Байк. Разум.</span>
            </h1>

            <p className="mt-5 text-sm sm:text-base md:text-lg text-gray-300 font-light max-w-3xl mx-auto">
              Возьми не услугу — возьми опыт. Плати звёздами (Telegram Stars) — быстро, без посредников.
              Ты не покупаешь «сессию» — ты покупаешь <strong className="text-accent-text">результат</strong>.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link href="/rent-bike" legacyBehavior>
                <a aria-label="Арендовать байк" className="w-full sm:w-auto">
                  <Button size="lg" variant="accent" className="font-orbitron w-full sm:w-auto">
                    <VibeContentRenderer content="::FaMotorcycle:: Арендовать байк" />
                  </Button>
                </a>
              </Link>

              {/* RENT A YOG -> leads to /about#mind (you) */}
              <Link href="/about#mind" legacyBehavior>
                <a aria-label="Арендовать йога для ума" className="w-full sm:w-auto">
                  <Button size="lg" variant="ghost" className="font-orbitron w-full sm:w-auto">
                    <VibeContentRenderer content="::FaPersonChalkboard:: Арендовать йога (для ума)" />
                  </Button>
                </a>
              </Link>
            </div>

            <div className="mt-5 text-xs text-gray-400 font-mono">
              <span className="badge-neon">НЕОН-ЛАЙФХАК</span>
              <span className="ml-2">— дропни этот линк в телеграм чат и попроси оплатить 3★ — прямо сейчас.</span>
            </div>
          </div>
        </section>

        {/* MAIN GRID */}
        <main className="container mx-auto px-4 py-10 space-y-10">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-[#070707] border-border">
              <CardHeader>
                <CardTitle className="font-orbitron text-2xl flex items-center gap-3 text-white">
                  <VibeContentRenderer content="::FaMotorcycle::" /> VIP-Аренда Байков
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 mb-4">Байк — это ритуал. Чистый железный друг, страховка, защита и трек в кармане.</p>
                <ul className="list-disc list-inside text-sm space-y-2 mb-4 text-gray-300">
                  <li>Сервис, страховка и экипировка</li>
                  <li>Промо-код: ЛЕТО2025 — скидка 10%</li>
                  <li>Быстрая бронь — без бумажной волокиты</li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/rent-bike"><a className="w-full sm:w-auto"><Button className="w-full">Забронировать</Button></a></Link>
                  <Link href="/vipbikerental"><a className="w-full sm:w-auto"><Button variant="secondary" className="w-full">Детали</Button></a></Link>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#070707] border-border">
              <CardHeader>
                <CardTitle className="font-orbitron text-2xl flex items-center gap-3 text-white">
                  <VibeContentRenderer content="::FaFire::" /> Сауна &amp; Ресет
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 mb-4">Тёплая комната, минимум разговоров, максимум эффект. Идеально после дороги или перед важной задачей.</p>
                <ul className="list-disc list-inside text-sm space-y-2 mb-4 text-gray-300">
                  <li>Частные сессии по времени</li>
                  <li>Ароматы, полотенца, chill-zone</li>
                  <li>Можно бронировать группой — делится опытом</li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/sauna-rent"><a className="w-full sm:w-auto"><Button className="w-full">Забронировать сауну</Button></a></Link>
                  <Link href="/about#sauna"><a className="w-full sm:w-auto"><Button variant="secondary" className="w-full">Подробнее</Button></a></Link>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#070707] border-border">
              <CardHeader>
                <CardTitle className="font-orbitron text-2xl flex items-center gap-3 text-white">
                  <VibeContentRenderer content="::FaHandsHelping::" /> Йог ума (я — твой йог)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 mb-4">Я — йог для ума: сажаю порядок в голове, режу страхи, учу фокусироваться. Не буддизм — результат.</p>
                <ul className="list-disc list-inside text-sm space-y-2 mb-4 text-gray-300">
                  <li>Индивидуальные сессии — практики концентрации</li>
                  <li>Короткие циклы для собственников и байкеров</li>
                  <li>Оплата — только Telegram Stars (XTR)</li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/about#mind"><a className="w-full sm:w-auto"><Button className="w-full">Арендовать Йога — 3★</Button></a></Link>
                  <Link href="/selfdev"><a className="w-full sm:w-auto"><Button variant="secondary" className="w-full">Методика SelfDev</Button></a></Link>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* About / SelfDev punchy block */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-[#050505] border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-orbitron flex items-center gap-3 text-white">
                    <VibeContentRenderer content="::FaGlobe::" /> oneSitePls — философия VIBE
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300 mb-4">Я — Павел. Делаю так, чтобы AI работал на реальные деньги и реальные жизни. VIBE — это про быстрые проверки, минимальный риск и реальную доставку.</p>

                  <div className="relative">
                    <div className="glitch-wrap">
                      <h4 className="text-xl font-bold mb-2 glitch-text">Коротко: тестируй идеи, продавай результат.</h4>
                      <div className="glitch-censor" aria-hidden />
                    </div>
                    <p className="mt-3 text-sm text-gray-400">Ненавижу «настройку среды». Люблю реультат. Монетизация через Telegram Stars — это честно, быстро и удобно для локальных сервисов.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div className="p-4 bg-[#0b0b0b] rounded-lg border border-border">
                      <h5 className="font-semibold text-accent-text mb-2">Validation</h5>
                      <p className="text-xs text-gray-300">Fake-door, AI research, быстрый запуск — убей плохую идею до траты денег.</p>
                    </div>
                    <div className="p-4 bg-[#0b0b0b] rounded-lg border border-border">
                      <h5 className="font-semibold text-accent-text mb-2">Security</h5>
                      <p className="text-xs text-gray-300">SAST, PR scans, zero-trust — скорость без дуры.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-orbitron flex items-center gap-3 text-white">
                    <VibeContentRenderer content="::FaLightbulb::" /> SelfDev: стань своим продуктом
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4">Не работай на чужой ритм. Создавай сервисы вокруг своей жизни: сауна, байк, менторство. Я учу делать это быстро и без стыда.</p>

                  <ol className="list-decimal list-inside text-sm text-gray-300 space-y-3 pl-4">
                    <li>Начни с высокочековой услуги и протестируй спрос.</li>
                    <li>Задействуй AI: контент, аутрич, автоматизация.</li>
                    <li>Делегируй друзьям — растите вместе (я могу обучить).</li>
                  </ol>

                  <p className="mt-4 text-xs text-gray-400">Хочешь, чтобы я помог лично? Бронирование — по звёздам. Быстро, честно, без разводов.</p>
                </CardContent>
              </Card>
            </div>

            {/* Right column - Support Form + CTA (sticky on md+, relative on mobile) */}
            <aside className="">
              <Card className="bg-[#080808] border-border md:sticky md:top-24 relative">
                <CardHeader>
                  <CardTitle className="text-xl font-orbitron flex items-center gap-3 text-white">
                    <VibeContentRenderer content="::FaHandsHelping::" /> Быстрая помощь — оплати звёздами
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4">Нужна консультация, VIP-сессия или быстрый тест идеи? Выбирай уровень — счёт придёт в Telegram. Я увижу и отвечу.</p>

                  <div className="mb-4">
                    <SupportForm />
                  </div>

                  <div className="text-xs text-gray-400">
                    <p className="mb-2"><strong>Почему Stars?</strong> Микроплатёж, низкий порог, быстро.</p>
                    <p>Если надо — пиши напрямую: <a href="mailto:salavey13@gmail.com" className="text-accent-text hover:underline">salavey13@gmail.com</a> или <a href="https://t.me/salavey13" className="text-accent-text hover:underline">Telegram</a>.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#070707] border-border mt-6">
                <CardContent>
                  <h4 className="font-semibold text-accent-text mb-2">Быстрые ссылки</h4>
                  <ul className="text-sm list-inside space-y-2 text-gray-300">
                    <li><Link href="/vipbikerental"><a className="hover:underline">VIP Байк</a></Link></li>
                    <li><Link href="/sauna-rent"><a className="hover:underline">Сауна</a></Link></li>
                    <li><Link href="/about#mind"><a className="hover:underline">Аренда йога — я</a></Link></li>
                    <li><Link href="/repo-xml"><a className="hover:underline">/repo-xml Studio</a></Link></li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </section>

          {/* FOOTER CTA */}
          <section className="py-8 text-center">
            <p className="text-sm text-gray-400 mb-4">Хочешь чтобы я помог с продажами/аутричем для твоего локального сервиса? Сначала — одна сессия за 3★, дальше — как договоримся.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link href="/repo-xml"><a className="w-full sm:w-auto"><Button variant="outline" className="w-full sm:w-auto">Remix / Contribute</Button></a></Link>
              <Link href="/selfdev"><a className="w-full sm:w-auto"><Button variant="secondary" className="w-full sm:w-auto">Начать SelfDev</Button></a></Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}