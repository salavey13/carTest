"use client";

import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

export default function Sly13CyberVibeLanding() {
  return (
    <>
      <Head>
        <title>SLY13 CYBERVIBE — AI Operator & Product Studio</title>
        <meta
          name="description"
          content="AI ко-пилот для запуска продуктов, прокачки навыков и ускорения мышления. Telegram-first. Cyber dark mode only."
        />
      </Head>

      <div className="min-h-screen bg-[#0A0F1C] text-white relative overflow-hidden">
        <style>{`
          .cyber-glow {
            text-shadow: 0 0 12px rgba(34,211,238,0.25),
                         0 0 24px rgba(34,211,238,0.12);
          }

          @keyframes floatSlow {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }

          .float {
            animation: floatSlow 6s ease-in-out infinite;
          }
        `}</style>

        {/* HERO */}
        <section className="relative h-[90vh] flex items-center justify-center text-center px-6">
          <div className="absolute inset-0">
            <Image
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg"
              alt="cyber hero"
              fill
              className="object-cover opacity-40"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F1C]/80 via-[#0A0F1C]/60 to-[#0A0F1C]" />
          </div>

          <div className="relative z-10 max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-bold cyber-glow">
              SLY13 CYBERVIBE
            </h1>

            <p className="mt-5 text-lg md:text-xl text-slate-300">
              AI-ко-пилот для запуска продуктов, прокачки навыков и ускорения мышления.
            </p>

            <p className="mt-3 text-sm text-slate-400">
              От идеи → до работающего продукта за дни, а не месяцы.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/franchize/sly13/catalog">
                <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
                  <VibeContentRenderer content="::FaBolt:: Запустить CyberVIBE" />
                </Button>
              </Link>

              <Link href="/franchize/sly13/contacts">
                <Button variant="secondary">
                  <VibeContentRenderer content="::FaTelegram:: Связаться" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* CORE SERVICES */}
        <main className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-6">

          <Card className="bg-[#111827] border-[#334155]">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <VibeContentRenderer content="::FaBolt::" />
                CyberVIBE Sprint
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300">
                Быстрый запуск продукта от идеи до MVP с AI-структурой.
              </p>
              <ul className="text-sm text-slate-400 mt-3 space-y-1">
                <li>• AI-планирование продукта</li>
                <li>• быстрый прототип</li>
                <li>• упаковка оффера</li>
              </ul>
              <Link href="/franchize/sly13/catalog#cyber">
                <Button className="mt-4 w-full">Запустить</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-[#111827] border-[#334155]">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <VibeContentRenderer content="::FaBrain::" />
                AI Workflow Custom
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300">
                Персональный AI-флоу под твой бизнес или жизнь.
              </p>
              <ul className="text-sm text-slate-400 mt-3 space-y-1">
                <li>• автоматизация задач</li>
                <li>• AI-ассистент под тебя</li>
                <li>• ускорение решений</li>
              </ul>
              <Link href="/franchize/sly13/order">
                <Button className="mt-4 w-full">Собрать флоу</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-[#111827] border-[#334155]">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <VibeContentRenderer content="::FaFire::" />
                Trade-in Хаоса
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300">
                Разгребаем бизнес/жизнь/проекты → в систему.
              </p>
              <ul className="text-sm text-slate-400 mt-3 space-y-1">
                <li>• аудит процессов</li>
                <li>• чистка задач</li>
                <li>• фокусировка</li>
              </ul>
              <Button className="mt-4 w-full">Почистить</Button>
            </CardContent>
          </Card>

          <Card className="bg-[#111827] border-[#334155]">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <VibeContentRenderer content="::FaGamepad::" />
                Coaching / Labs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300">
                Разбор проектов, мышления и performance.
              </p>
              <ul className="text-sm text-slate-400 mt-3 space-y-1">
                <li>• разбор продукта</li>
                <li>• разбор мышления</li>
                <li>• игровые разборы (Dota / Snowboard)</li>
              </ul>
              <Button className="mt-4 w-full">Разобрать себя</Button>
            </CardContent>
          </Card>
        </main>

        {/* ABOUT */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <Card className="bg-[#0F172A] border-[#334155]">
            <CardHeader>
              <CardTitle className="text-2xl cyber-glow">
                Что такое SLY13?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-3 text-sm">
              <p>
                Это AI-операторская система: не курс, не агентство, не коучинг.
                Это ускоритель мышления и запуска продуктов.
              </p>

              <p>
                Я работаю как ко-пилот: помогаю тебе думать быстрее, собирать продукты
                и выходить в реальный рынок.
              </p>

              <p className="text-cyan-300">
                Telegram-first. Stars-based. Без бюрократии.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="text-center py-14">
          <h2 className="text-3xl font-bold cyber-glow">
            Готов включить CyberVIBE?
          </h2>

          <p className="text-slate-400 mt-3">
            1 сессия → быстрый результат → дальше масштабируем
          </p>

          <div className="mt-6 flex justify-center gap-3 flex-col sm:flex-row">
            <Link href="/franchize/sly13/order">
              <Button className="bg-cyan-500 text-black font-bold">
                Забронировать сессию
              </Button>
            </Link>

            <Link href="/franchize/sly13/contacts">
              <Button variant="secondary">
                Написать в Telegram
              </Button>
            </Link>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center text-xs text-slate-500 py-10">
          © 2026 SLY13 CYBERVIBE — AI Operator Studio
        </footer>
      </div>
    </>
  );
}
