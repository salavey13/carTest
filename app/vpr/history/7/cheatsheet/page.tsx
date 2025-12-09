"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
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
  Database
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
              Архив НКВД // Рассекречено // 2025
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
                Разбираем механику Зимней войны (1939-1940), чтобы твой мозг не взломали сегодня.
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
                    <strong>Casus Belli</strong> (лат.) — формальный повод для объявления войны. Если повода нет, его придумывают.
                </p>
            </div>
            
            <Card className="lg:col-span-8 bg-stone-900/80 border-red-900/30 overflow-hidden relative group hover:border-red-500/50 transition-colors">
                <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-15 transition-opacity"><ShieldAlert size={200} /></div>
                <CardHeader>
                    <CardTitle className="text-2xl text-red-400 font-bold">
                        Инцидент в Майниле: "Они начали первые!"
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                    <div className="bg-stone-950/80 p-5 rounded-xl border-l-4 border-red-600 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Официальная версия (Газета "Правда", 1939)</h4>
                            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                        </div>
                        <p className="italic text-xl text-stone-200 font-serif">"Наглая финская военщина обстреляла советских солдат у деревни Майнила. Мы вынуждены отодвинуть границу ради безопасности Ленинграда!"</p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2 bg-stone-800/30 p-4 rounded-lg">
                            <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-xs tracking-widest">
                                <Search className="w-4 h-4" /> Реальность (Архивы)
                            </div>
                            <p className="text-sm text-stone-300 leading-relaxed">
                                Финских орудий в этом районе <strong>физически не было</strong> (они были отведены на 20 км, чтобы не провоцировать). Выстрелы были произведены с советской стороны силами НКВД.
                            </p>
                        </div>
                        <div className="space-y-2 bg-stone-800/30 p-4 rounded-lg">
                            <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-xs tracking-widest">
                                <EyeOff className="w-4 h-4" /> Зачем это нужно?
                            </div>
                            <p className="text-sm text-stone-300 leading-relaxed">
                                Агрессору всегда нужно выглядеть жертвой в глазах своего населения. Никто не хочет быть злодеем. Все хотят "защищать родину", даже если для этого нужно напасть на соседа.
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
                            СССР заявил, что не воюет с Финляндией. Он "помогает" законному правительству рабочих, которое... только что создали в Москве.
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 bg-stone-950/50 p-3 rounded border border-stone-800">
                                <div className="bg-amber-500/20 p-1 rounded text-amber-500 mt-1"><FileWarning size={16} /></div>
                                <div>
                                    <span className="text-amber-500 font-bold text-xs uppercase block">Фейк</span>
                                    <span className="text-stone-400 text-sm">В первом захваченном дачном поселке (Терийоки) посадили коммуниста Отто Куусинена и объявили его президентом.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-stone-950/50 p-3 rounded border border-stone-800">
                                <div className="bg-green-500/20 p-1 rounded text-green-500 mt-1"><Skull size={16} /></div>
                                <div>
                                    <span className="text-green-500 font-bold text-xs uppercase block">Итог</span>
                                    <span className="text-stone-400 text-sm">Финны (даже коммунисты) не поверили и начали стрелять. Когда блицкриг провалился, СССР тихо "распустил" это правительство и забыл о нём.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gradient-to-b from-stone-800 to-black p-4 rounded-xl border border-stone-700 flex flex-col justify-center items-center text-center shadow-2xl">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-4 text-white font-black text-2xl border-4 border-stone-900 shadow-lg">
                            🛑
                        </div>
                        <p className="text-xs text-stone-500 font-mono leading-tight">
                            УРОК:<br/>Если перед вторжением на границе внезапно появляется "Народная Республика", которая просит ввести войска — это сценарий 1939 года.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* --- BLOCK 3: NEWSPEAK --- */}
        <Card className="bg-stone-900 border-stone-800 overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5"></div>
            <CardHeader className="text-center pb-2">
                 <div className="inline-block bg-stone-800 px-4 py-1 rounded-full text-xs text-stone-400 font-mono mb-2">Лингвистическая экспертиза</div>
                <CardTitle className="text-3xl text-stone-200 font-bold">
                    Хлебницы Молотова 🍞💣
                </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
                 <div className="grid md:grid-cols-2 gap-0 md:gap-12 items-center relative">
                    {/* Divider for desktop */}
                    <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-stone-600 to-transparent"></div>
                    
                    <div className="space-y-4 text-center md:text-right">
                        <div className="inline-block bg-red-900/30 text-red-400 px-3 py-1 rounded text-xs font-bold uppercase">Заявление</div>
                        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-xl">
                            <p className="text-sm text-stone-500 mb-2 font-mono">Вячеслав Молотов (Глава МИД СССР):</p>
                            <p className="text-xl text-white font-serif italic">"Советская авиация не бомбит Хельсинки! Мы сбрасываем голодающим финским рабочим корзины с хлебом!"</p>
                        </div>
                    </div>

                    <div className="space-y-4 text-center md:text-left mt-8 md:mt-0">
                        <div className="inline-block bg-green-900/30 text-green-400 px-3 py-1 rounded text-xs font-bold uppercase">Реальность</div>
                        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-xl">
                            <p className="text-sm text-stone-500 mb-2 font-mono">Финская армия:</p>
                            <p className="text-sm text-stone-300">
                                Это были кассетные бомбы. В ответ финны придумали зажигательную смесь, чтобы "запивать хлеб". Назвали её: <br/>
                                <span className="text-xl text-amber-500 font-black block mt-2">"Коктейль ДЛЯ Молотова"</span>
                                (Позже предлог "для" потерялся).
                            </p>
                        </div>
                    </div>
                 </div>
                 <div className="mt-8 text-center bg-stone-800/50 p-4 rounded-lg">
                    <p className="text-stone-400 text-sm">
                        <span className="text-white font-bold">Тотальная ложь</span> — это не баг, а фича. Отрицай очевидное до конца. "Нас там нет", "Они сами себя", "Это не взрывы, а хлопки".
                    </p>
                 </div>
            </CardContent>
        </Card>

        {/* --- BLOCK 4: THE GRINDER --- */}
        <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
                <h2 className="text-3xl font-bold text-stone-200 flex items-center gap-3">
                    <span className="text-6xl opacity-20 font-black absolute -left-8">04</span>
                    Цена величия
                </h2>
                <p className="text-stone-400 text-sm">
                    Маленькая победоносная война, которая пошла не по плану.
                </p>
            </div>
            
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-950/20 p-6 rounded-xl border border-red-900/30 flex flex-col justify-between">
                    <div>
                        <h3 className="text-red-400 font-bold mb-2 uppercase tracking-wide text-xs">План</h3>
                        <p className="text-stone-300 font-serif text-lg leading-tight">"Парад в Хельсинки через 2 недели (к дню рождения Сталина)."</p>
                    </div>
                    <Flame className="w-8 h-8 text-red-900 mt-4 self-end" />
                </div>
                <div className="bg-orange-950/20 p-6 rounded-xl border border-orange-900/30 flex flex-col justify-between">
                    <div>
                        <h3 className="text-orange-400 font-bold mb-2 uppercase tracking-wide text-xs">Реальность</h3>
                        <p className="text-stone-300 text-sm">3.5 месяца ада в снегах. Линия Маннергейма. Советские колонны, зажатые на лесных дорогах и уничтоженные лыжниками.</p>
                    </div>
                    <Skull className="w-8 h-8 text-orange-900 mt-4 self-end" />
                </div>
                <div className="bg-stone-800/50 p-6 rounded-xl border border-stone-700 flex flex-col justify-between">
                    <div>
                        <h3 className="text-white font-bold mb-2 uppercase tracking-wide text-xs">Счет (Убитые)</h3>
                        <div className="space-y-1 font-mono text-sm">
                            <div className="flex justify-between"><span>СССР:</span> <span className="text-red-500">~127,000+</span></div>
                            <div className="flex justify-between"><span>Финляндия:</span> <span className="text-green-500">~26,000</span></div>
                        </div>
                    </div>
                    <p className="text-xs text-stone-500 mt-4 pt-4 border-t border-stone-700">
                        СССР выгнали из Лиги Наций как агрессора и изгоя.
                    </p>
                </div>
            </div>
        </div>

        {/* --- CLASSIFIED SECTION: MODERN WARFARE 2.0 (THE REQUESTED UPDATE) --- */}
        <section className="mt-24 relative">
            {/* Security Tape Design */}
            <div className="absolute -top-6 -left-10 -right-10 h-12 bg-yellow-500/10 -rotate-1 flex items-center overflow-hidden pointer-events-none">
                <div className="animate-marquee whitespace-nowrap font-mono text-yellow-500 font-bold text-xs tracking-[1em]">
                    CLASSIFIED // EYES ONLY // 21 CENTURY PROTOCOLS // DO NOT DISTRIBUTE // CLASSIFIED // EYES ONLY
                </div>
            </div>

            <div className="bg-black border border-stone-800 rounded-3xl p-1 overflow-hidden shadow-2xl shadow-red-900/20">
                <div className="bg-stone-950 rounded-[20px] p-6 md:p-10 relative">
                    <div className="absolute top-0 right-0 p-4">
                        <Lock className="w-6 h-6 text-red-600 animate-pulse" />
                    </div>

                    <div className="flex flex-col md:flex-row items-baseline gap-4 mb-10 border-b border-stone-800 pb-6">
                        <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter">
                            Апдейт <span className="text-red-600">XXI</span> Века
                        </h2>
                        <span className="font-mono text-stone-500 text-sm">
                            Почему тактика "Дедов" больше не работает?
                        </span>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-12">
                        
                        {/* THE MERCHANT VS THE PHYSICIST */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                    <Globe className="w-6 h-6 text-amber-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-stone-200">Торговец vs Физик</h3>
                            </div>
                            
                            <div className="relative pl-6 border-l-2 border-stone-800 space-y-8">
                                {/* Merchant */}
                                <div className="relative group">
                                    <div className="absolute -left-[31px] top-0 w-4 h-4 bg-stone-800 rounded-full border-2 border-stone-600 group-hover:border-amber-500 transition-colors"></div>
                                    <h4 className="text-stone-400 font-bold uppercase text-xs tracking-widest mb-1">Старая Школа (Merchant)</h4>
                                    <p className="text-stone-300 text-sm leading-relaxed">
                                        В XX веке войны выигрывали ресурсы. У кого больше стали, нефти и людей — тот и прав. Торговец думает, что можно купить территории или обменять их на мир. Он верит в договоры на бумаге.
                                        <br/><span className="text-red-400 italic">Слабость:</span> Если у тебя кончаются снаряды, ты проиграл (как Финляндия в 1940).
                                    </p>
                                </div>

                                {/* Physicist */}
                                <div className="relative group">
                                    <div className="absolute -left-[31px] top-0 w-4 h-4 bg-stone-800 rounded-full border-2 border-stone-600 group-hover:border-blue-500 transition-colors"></div>
                                    <h4 className="text-blue-400 font-bold uppercase text-xs tracking-widest mb-1">Новая Школа (Physicist)</h4>
                                    <p className="text-stone-300 text-sm leading-relaxed">
                                        В XXI веке физик не верит в бумагу. Он верит в баллистику и термодинамику. Если ты не можешь победить армию врага в поле, ты уничтожаешь его экономику (НПЗ, заводы), не выходя из дома.
                                        <br/><span className="text-blue-400 italic">Сила:</span> Глобальная логистика + Starlink + Собственные технологии. Изоляция больше не работает, если у тебя есть интернет.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* MEAT WAVES VS DRONES */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                    <Flame className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-stone-200">"Мясные Штурмы" vs Дроны</h3>
                            </div>

                            <div className="grid gap-4">
                                <Card className="bg-stone-900 border-stone-800">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-mono text-xs text-stone-500">ТАКТИКА 1940</span>
                                            <span className="text-stone-600">🏰</span>
                                        </div>
                                        <p className="text-sm text-stone-300">
                                            <strong>Масса решает.</strong> 1000 плохо обученных солдат с винтовками всегда победят 100 профессионалов в окопе, просто потому что у защитников кончатся патроны. Потери можно скрыть в лесах.
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-stone-900 border-stone-800 relative overflow-hidden">
                                    <div className="absolute right-0 top-0 p-10 bg-blue-500/5 blur-3xl"></div>
                                    <CardContent className="p-4 relative z-10">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-mono text-xs text-blue-400">ТАКТИКА 2025</span>
                                            <span className="text-blue-500"><Zap size={16}/></span>
                                        </div>
                                        <p className="text-sm text-stone-300">
                                            <strong>Точность решает.</strong> Один оператор FPV-дрона ($500) может остановить танковую колонну ($10,000,000). 
                                            <br/><span className="text-amber-400 font-bold block mt-2">Туман войны исчез.</span>
                                            Спутники и OSINT видят каждое движение. Скрыть потери невозможно — они в 4K разрешении в интернете через 5 минут.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                    </div>

                    {/* THE FINAL LESSON */}
                    <div className="mt-12 pt-8 border-t border-stone-800">
                         <div className="bg-stone-800/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 border border-stone-700/50">
                            <div className="p-4 bg-stone-900 rounded-full shadow-inner">
                                <BrainCircuit className="w-10 h-10 text-stone-400" />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h4 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Главный баг диктаторов</h4>
                                <p className="text-stone-300 italic text-lg leading-relaxed">
                                    "Диктаторы любят косплей — они надевают фуражки времен Второй Мировой и думают, что это дает +100 к силе. 
                                    Но <span className="text-red-500 font-bold">баллистика не уважает их исторические костюмы</span>. 
                                    В современной войне побеждает не тот, у кого больше солдат на параде, а тот, кто быстрее адаптирует технологии и уничтожает экономику врага (НПЗ, свет, логистику), даже не переходя границу."
                                </p>
                            </div>
                         </div>
                    </div>

                    {/* Signature */}
                    <div className="absolute bottom-2 right-4 text-[10px] text-stone-700 font-mono">
                        ANALYSIS COMPLETE // PHYSICS WINS
                    </div>
                </div>
            </div>
        </section>

        {/* FINAL CTA */}
        <div className="flex justify-center pb-12">
             <Link href="/vpr-tests" className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-stone-900 transition-all duration-200 bg-amber-500 font-mono rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 hover:bg-amber-400 hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                <ArrowLeft className="mr-2 w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span>ВЕРНУТЬСЯ В РЕАЛЬНОСТЬ</span>
            </Link>
        </div>

      </div>
    </div>
  );
}