"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { 
  ShieldAlert, 
  Radio, 
  FileWarning, 
  Search, 
  Skull, 
  History, 
  ArrowLeft, 
  EyeOff, 
  Lock, 
  Globe, 
  Flame, 
  Zap,
  BrainCircuit,
  FileX,
  TrendingDown,
  Rocket
} from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

export default function History7Cheatsheet() {
  return (
    <div className="min-h-screen bg-stone-950 text-amber-50 p-4 md:p-8 font-sans selection:bg-amber-900 selection:text-white overflow-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
      </div>

      <div className="max-w-6xl mx-auto space-y-16 relative z-10">
        
        {/* HEADER */}
        <header className="text-center space-y-6 pt-12 relative">
          <div className="inline-flex items-center justify-center p-3 bg-stone-900/50 rounded-full border border-amber-500/30 mb-4 backdrop-blur-md shadow-lg shadow-amber-900/20 animate-fade-in-up">
            <History className="w-5 h-5 text-amber-500 mr-3" />
            <span className="text-amber-200 font-mono tracking-[0.2em] uppercase text-xs md:text-sm">
              Архив НКВД // Рассекречено // 2025 UPDATE
            </span>
            <div className="w-2 h-2 rounded-full bg-red-500 ml-3 animate-pulse"></div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-400 to-orange-600 drop-shadow-2xl tracking-tighter">
            АНАТОМИЯ<br className="md:hidden" /> КОНФЛИКТА
          </h1>
          
          <div className="max-w-3xl mx-auto bg-stone-900/80 border-l-4 border-amber-500 p-6 rounded-r-xl shadow-xl backdrop-blur-sm">
            <p className="text-stone-300 text-lg md:text-xl leading-relaxed font-serif italic">
              "История не повторяется, но она рифмуется." <br/>
              <span className="text-amber-500 not-italic font-bold text-base mt-2 block font-sans">
                Разбираем механику войн: от Зимней войны (1939) до Блэкаута в Шатуре (2025).
              </span>
            </p>
          </div>
        </header> 

        {/* --- BLOCK 1: THE FAKE START (CASUS BELLI) --- */}
        <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
                <h2 className="text-3xl font-bold text-red-500 flex items-center gap-3">
                    <span className="text-6xl opacity-20 font-black absolute -left-8">01</span>
                    Casus Belli
                </h2>
                <p className="text-stone-400 text-sm">
                    <strong>Casus Belli</strong> (лат.) — формальный повод для объявления войны. Если повода нет, его придумывают (как обстрел в Майниле).
                </p>
            </div>
            
            <Card className="lg:col-span-8 bg-stone-900/80 border-red-900/30 overflow-hidden relative group hover:border-red-500/50 transition-colors">
                <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-15 transition-opacity"><ShieldAlert size={200} /></div>
                <CardHeader>
                    <CardTitle className="text-2xl text-red-400 font-bold">
                        1939: "Они начали первые!"
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                    <div className="bg-stone-950/80 p-5 rounded-xl border-l-4 border-red-600 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Официальная версия</h4>
                            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                        </div>
                        <p className="italic text-xl text-stone-200 font-serif">"Финская артиллерия обстреляла советских солдат. Мы вынуждены отодвинуть границу!"</p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2 bg-stone-800/30 p-4 rounded-lg">
                            <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-xs tracking-widest">
                                <Search className="w-4 h-4" /> Реальность
                            </div>
                            <p className="text-sm text-stone-300 leading-relaxed">
                                Финских орудий там <strong>не было</strong>. Выстрелы произвело НКВД. Это классическая "провокация под чужим флагом".
                            </p>
                        </div>
                        <div className="space-y-2 bg-stone-800/30 p-4 rounded-lg">
                            <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-xs tracking-widest">
                                <EyeOff className="w-4 h-4" /> Цель
                            </div>
                            <p className="text-sm text-stone-300 leading-relaxed">
                                Агрессору нужно выглядеть жертвой в телевизоре, чтобы солдаты не задавали вопросов "Зачем мы умираем в чужом лесу?".
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* --- BLOCK 2: THE PUPPET SHOW --- */}
        <div className="grid lg:grid-cols-12 gap-8">
             <div className="lg:col-span-4 lg:order-2 space-y-4 text-right">
                <h2 className="text-3xl font-bold text-amber-400 flex items-center justify-end gap-3">
                    Марионетки
                    <span className="text-6xl opacity-20 font-black absolute -right-8">02</span>
                </h2>
                <p className="text-stone-400 text-sm">
                    Если страну нельзя захватить, нужно создать её "правильную" версию.
                </p>
            </div>

            <Card className="lg:col-span-8 lg:order-1 bg-stone-900/80 border-amber-600/30 overflow-hidden hover:border-amber-500/50 transition-colors">
                <CardHeader>
                    <CardTitle className="text-2xl text-amber-200 font-bold">
                        "Финляндская Демократическая Республика" (ФДР)
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                        <p className="text-stone-300 text-lg">
                            СССР заявил, что не воюет с народом Финляндии, а "помогает" правительству рабочих, которое... создали в Москве за 1 день.
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 bg-stone-950/50 p-3 rounded border border-stone-800">
                                <div className="bg-amber-500/20 p-1 rounded text-amber-500 mt-1"><FileWarning size={16} /></div>
                                <div>
                                    <span className="text-amber-500 font-bold text-xs uppercase block">Фейк</span>
                                    <span className="text-stone-400 text-sm">В первом захваченном поселке (Терийоки) посадили коммуниста Куусинена и объявили его президентом.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-stone-950/50 p-3 rounded border border-stone-800">
                                <div className="bg-green-500/20 p-1 rounded text-green-500 mt-1"><Skull size={16} /></div>
                                <div>
                                    <span className="text-green-500 font-bold text-xs uppercase block">Итог</span>
                                    <span className="text-stone-400 text-sm">Когда блицкриг провалился, про это "правительство" просто забыли. Точно так же исчезают современные "гауляйтеры".</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* --- CLASSIFIED SECTION: MODERN WARFARE 2.0 (THE UPDATE) --- */}
        <section className="mt-32 relative">
            {/* Security Tape */}
            <div className="absolute -top-8 -left-20 -right-20 h-16 bg-yellow-500 -rotate-2 flex items-center justify-center overflow-hidden z-20 shadow-xl shadow-yellow-900/50">
                <div className="font-black text-black text-xl tracking-[0.5em] animate-pulse">
                    ⚠️ CLASSIFIED // NOV 2025 UPDATE // EYES ONLY ⚠️
                </div>
            </div>

            <div className="bg-stone-950 border-2 border-stone-800 rounded-3xl p-1 overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)] relative z-10">
                <div className="bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] rounded-[20px] p-6 md:p-12 relative">
                    
                    <div className="flex flex-col gap-2 mb-12 border-b-2 border-stone-800 pb-8">
                        <div className="flex items-center gap-3">
                            <Lock className="w-8 h-8 text-red-600" />
                            <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter">
                                Битва 21 Века
                            </h2>
                        </div>
                        <span className="font-mono text-stone-400 text-lg">
                            <span className="text-amber-500">&gt;</span> Операция "Фламинго": Как Физика победила Маркетинг
                        </span>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-16">
                        
                        {/* THEORY 1: MERCHANT VS PHYSICIST */}
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
                                    <Globe className="w-8 h-8 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-stone-200">Торговец vs Физик</h3>
                                    <p className="text-xs text-stone-500 font-mono">ТИПОЛОГИЯ ЛИДЕРОВ</p>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                {/* Merchant */}
                                <div className="bg-stone-900/80 p-5 rounded-xl border-l-4 border-stone-600 group hover:bg-stone-900 transition-colors">
                                    <h4 className="text-stone-400 font-bold uppercase text-xs tracking-widest mb-2 flex justify-between">
                                        Торговец (The Merchant)
                                        <FileX className="w-4 h-4" />
                                    </h4>
                                    <p className="text-stone-300 text-sm leading-relaxed">
                                        Верит в сделки. Думает, что войну можно остановить, подписав бумагу ("Мирный план"). Боится эскалации. Хочет продать мир как товар.
                                        <br/><span className="text-red-400 font-bold block mt-2">Ошибка:</span> Диктаторы не уважают контракты. Они уважают только силу.
                                    </p>
                                </div>

                                {/* Physicist */}
                                <div className="bg-stone-900/80 p-5 rounded-xl border-l-4 border-blue-500 group hover:bg-stone-900 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                    <h4 className="text-blue-400 font-bold uppercase text-xs tracking-widest mb-2 flex justify-between">
                                        Физик (The Physicist)
                                        <Rocket className="w-4 h-4" />
                                    </h4>
                                    <p className="text-stone-300 text-sm leading-relaxed">
                                        Не верит в слова. Верит в <strong>Термодинамику</strong>. Знает, что если уничтожить генератор, свет погаснет, что бы там ни говорили по телевизору.
                                        <br/><span className="text-blue-400 font-bold block mt-2">Метод:</span> Если враг не хочет переговоров, ты выключаешь ему свет (Крым, Шатура) и сжигаешь его топливо (Сызрань). Это называется <strong>Кинетический Аргумент</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* THEORY 2: THE 13 KOPECK LIE */}
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/30">
                                    <Zap className="w-8 h-8 text-green-500" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-stone-200">Экономика Лжи</h3>
                                    <p className="text-xs text-stone-500 font-mono">СИНДРОМ "13 КОПЕЕК"</p>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <Card className="bg-stone-900 border-stone-800">
                                    <CardContent className="p-5 flex items-start gap-4">
                                        <div className="text-3xl">📰</div>
                                        <div>
                                            <span className="font-bold text-stone-300 block mb-1">Новости (Пропаганда):</span>
                                            <p className="text-sm text-stone-400">
                                                "Бензин подешевел на 13 копеек! Экономика растет! Мы сбили все дроны!"
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex justify-center">
                                    <TrendingDown className="w-8 h-8 text-red-500" />
                                </div>

                                <Card className="bg-stone-900 border-stone-800 relative overflow-hidden border-b-4 border-b-red-600">
                                    <div className="absolute right-0 top-0 p-12 bg-red-500/10 blur-3xl"></div>
                                    <CardContent className="p-5 flex items-start gap-4 relative z-10">
                                        <div className="text-3xl">🔥</div>
                                        <div>
                                            <span className="font-bold text-white block mb-1">Реальность (Физика):</span>
                                            <p className="text-sm text-stone-300">
                                                НПЗ горит. Бензина на заправке нет (поэтому цена "теоретическая"). Завод в Якутии не может платить зарплату.
                                                <br/><span className="text-amber-500 font-bold block mt-2">Урок:</span> Пропаганда (Skybox) может нарисовать любую картинку, но она не может согреть батареи, если ГРЭС взорвана.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                    </div>

                    {/* THE FINAL LESSON BOX */}
                    <div className="mt-16 pt-10 border-t border-stone-800">
                         <div className="bg-stone-800/30 rounded-2xl p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 border border-stone-700/50 shadow-2xl">
                            <div className="p-6 bg-black rounded-full shadow-[0_0_30px_rgba(255,255,255,0.1)] border border-stone-700">
                                <BrainCircuit className="w-12 h-12 text-stone-200" />
                            </div>
                            <div className="flex-1 text-center md:text-left space-y-4">
                                <h4 className="text-2xl font-black text-white uppercase tracking-wide">Косплей Диктатора</h4>
                                <p className="text-stone-300 text-lg leading-relaxed font-serif">
                                    "Диктаторы любят надевать фуражки времен Второй Мировой (косплей) и пугать картами. Это работает на Торговцев. <br/>
                                    Но это не работает на Физиков. 
                                    <span className="text-red-500 font-bold bg-red-900/10 px-1 rounded"> Баллистика не уважает исторические костюмы.</span> 
                                    В современной войне побеждает тот, кто строит свои дроны (Фламинго/Лютый) и выключает рубильник врагу, пока тот читает лекцию про Рюрика."
                                </p>
                                <div className="text-xs font-mono text-stone-500 pt-2">
                                    STATUS: PEACE PLAN DESTROYED // KINETIC ARGUMENT ACCEPTED
                                </div>
                            </div>
                         </div>
                    </div>

                </div>
            </div>
        </section>

        {/* FINAL CTA */}
        <div className="flex justify-center pb-12">
             <Link href="/vpr-tests" className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-stone-900 transition-all duration-200 bg-amber-500 font-mono rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 hover:bg-amber-400 hover:scale-105 shadow-[0_0_30px_rgba(245,158,11,0.4)]">
                <ArrowLeft className="mr-3 w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                <span className="text-lg">ВЕРНУТЬСЯ В РЕАЛЬНОСТЬ</span>
            </Link>
        </div>

      </div>
    </div>
  );
}