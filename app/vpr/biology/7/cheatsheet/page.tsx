"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { Bug, Dna, Microscope, Waves, Skull, ShieldAlert, Activity } from "lucide-react";

// Обновленные ссылки на изображения
const imageUrls: Record<string, string> = {
  'bio7-protozoa': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/IMG_20251126_214900-cb9221fd-8197-4c43-9a49-232a287f880b.jpg',
  'bio7-hydra': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/IMG_20251126_215159-943d4b87-c2a8-45ca-b4e9-0518881e3b71.jpg',
  'bio7-worms': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/IMG_20251126_215325-84ebcac3-91e9-49a1-b816-4c2f4c6bd8f1.jpg',
  'bio7-arthropods': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/2a29d09b-61f7-4006-a442-5bbb505200b3-d206ca8c-f707-43a5-ba69-bcc30d277a06.png',
};

export default function Biology7Cheatsheet() {
  return (
    <div className="min-h-screen bg-stone-950 text-emerald-100 p-4 md:p-8 font-sans selection:bg-emerald-900 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-900/30 rounded-full border border-emerald-500/30 mb-4 animate-pulse">
            <Bug className="w-6 h-6 text-emerald-400 mr-2" />
            <span className="text-emerald-300 font-mono tracking-widest uppercase text-sm">Зоология v.7.0 // Database Access</span>
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-lime-400 drop-shadow-md">
            ЦАРСТВО ЖИВОТНЫХ
          </h1>
          <p className="text-stone-400 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            От микроскопических монстров до бронированных рыцарей. 
            <br/><span className="text-emerald-500 font-bold">Задача:</span> Выжить на ВПР, зная, кто кусается, а кто полезен.
          </p>
        </header>

        {/* SECTION 1: PROTOZOA */}
        <Card className="bg-stone-900/80 border-emerald-500/30 overflow-hidden relative shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:shadow-[0_0_40px_rgba(16,185,129,0.2)] transition-all duration-500">
            <div className="absolute top-4 right-4 opacity-20"><Microscope size={80} /></div>
            <CardHeader>
                <CardTitle className="flex items-center text-3xl text-emerald-400 font-bold">
                    <span className="bg-emerald-500/20 w-10 h-10 rounded-lg flex items-center justify-center mr-4 text-lg border border-emerald-500/50">01</span>
                    Простейшие (Соло-игроки)
                </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-6 text-stone-300 text-lg">
                    <div className="bg-stone-950/50 p-4 rounded-xl border-l-4 border-emerald-500">
                        <p className="italic">"Весь организм — это всего <strong>одна клетка</strong>. Но она умеет всё: охотиться, дышать и даже убегать от проблем."</p>
                    </div>
                    <ul className="space-y-4">
                        <li className="group bg-stone-800/40 p-3 rounded-xl border border-stone-700 hover:border-emerald-500 transition-colors">
                            <div className="flex justify-between items-center mb-1">
                                <strong className="text-emerald-300 text-xl">Амёба</strong>
                                <span className="text-xs bg-stone-700 px-2 py-0.5 rounded text-stone-300">Слизень 1 lvl</span>
                            </div>
                            <span className="text-sm">Формы нет (течет как желе). Движется <strong>ложноножками</strong>. Захватывает еду всем телом (фагоцитоз).</span>
                        </li>
                        <li className="group bg-stone-800/40 p-3 rounded-xl border border-stone-700 hover:border-green-500 transition-colors">
                             <div className="flex justify-between items-center mb-1">
                                <strong className="text-green-300 text-xl">Эвглена</strong>
                                <span className="text-xs bg-stone-700 px-2 py-0.5 rounded text-stone-300">Гибрид</span>
                            </div>
                            <span className="text-sm">Днем — растение (фотосинтез, зеленая), ночью — хищник. Двигатель: <strong>жгутик</strong>. Есть "глазок" (стигма).</span>
                        </li>
                        <li className="group bg-stone-800/40 p-3 rounded-xl border border-stone-700 hover:border-teal-500 transition-colors">
                             <div className="flex justify-between items-center mb-1">
                                <strong className="text-teal-300 text-xl">Инфузория</strong>
                                <span className="text-xs bg-stone-700 px-2 py-0.5 rounded text-stone-300">Танк</span>
                            </div>
                            <span className="text-sm">Самая сложная. <strong>2 ядра</strong> (База данных + Размножение). Покрыта ресничками (турбо-скорость).</span>
                        </li>
                    </ul>
                </div>
                <div className="relative group rounded-xl overflow-hidden border-2 border-emerald-500/20 shadow-2xl">
                    <Image src={imageUrls['bio7-protozoa']} alt="Микроскопический мир" width={600} height={600} className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                        <p className="text-emerald-200 text-xs font-mono">BIO-SCAN: AMOEBA & EUGLENA</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* SECTION 2: COELENTERATES */}
        <Card className="bg-stone-900/80 border-cyan-500/30 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)]">
            <CardHeader>
                <CardTitle className="flex items-center text-3xl text-cyan-400 font-bold">
                    <span className="bg-cyan-500/20 w-10 h-10 rounded-lg flex items-center justify-center mr-4 text-lg border border-cyan-500/50">02</span>
                    Кишечнополостные (Гидра & Медузы)
                </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8 items-center">
                <div className="order-2 md:order-1 relative rounded-xl overflow-hidden border-2 border-cyan-500/20 shadow-2xl h-full min-h-[300px]">
                     <Image src={imageUrls['bio7-hydra']} alt="Анатомия Гидры" width={600} height={600} className="object-cover w-full h-full transform hover:scale-105 transition-transform duration-500" />
                     <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-cyan-500/30 text-xs text-cyan-300 font-mono">
                        SCAN: HYDRA
                     </div>
                </div>
                <div className="order-1 md:order-2 space-y-6 text-stone-300">
                    <div className="flex items-start gap-4">
                         <div className="bg-cyan-900/50 p-3 rounded-full"><Waves className="w-8 h-8 text-cyan-400" /></div>
                         <div>
                             <h4 className="text-xl font-bold text-white mb-1">Двухслойный мешок</h4>
                             <p className="text-base text-stone-400">Первые многоклеточные. Тело состоит всего из двух слоев: <strong>Эктодерма</strong> (броня снаружи) и <strong>Энтодерма</strong> (пищеварение внутри).</p>
                         </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-cyan-950/50 to-transparent p-5 rounded-xl border border-cyan-500/20 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert size={100} /></div>
                        <h4 className="font-bold text-cyan-300 mb-2 flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Супер-способность: ЯД
                        </h4>
                        <p className="text-sm mb-3">
                            В эктодерме есть <strong>стрекательные клетки</strong>. Они выстреливают гарпуном с ядом. Ожог медузы — это работа миллионов таких микро-пушек.
                        </p>
                        <div className="inline-block bg-cyan-500/20 px-3 py-1 rounded text-xs text-cyan-200 font-mono border border-cyan-500/30">
                            + Регенерация (Бессмертие?)
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* SECTION 3: WORMS */}
        <section className="space-y-6">
            <div className="flex items-center gap-3">
                <Skull className="text-pink-500 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">Эволюция Червей</h2>
            </div>
            
            {/* Visual Analysis Card */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-1 overflow-hidden">
                <div className="relative h-64 md:h-80 w-full rounded-xl overflow-hidden">
                    <Image 
                        src={imageUrls['bio7-worms']} 
                        alt="Сравнение типов червей" 
                        fill
                        className="object-cover opacity-90 hover:opacity-100 transition-opacity duration-500"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent p-6 pt-12">
                        <h3 className="text-xl font-bold text-white">Сравнительный анализ</h3>
                        <p className="text-stone-400 text-sm">От плоских паразитов до продвинутых кольчатых инженеров почвы.</p>
                    </div>
                </div>
            </div>

            {/* Detailed Grid */}
            <div className="grid md:grid-cols-3 gap-4">
                {/* Flatworms */}
                <div className="bg-stone-900/80 p-5 rounded-xl border border-stone-800 hover:border-pink-500/50 transition-all hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-xl text-pink-400">Плоские</h3>
                        <span className="text-xs bg-pink-900/30 text-pink-300 px-2 py-1 rounded border border-pink-500/20">Паразиты</span>
                    </div>
                    <p className="text-xs text-stone-500 mb-4 font-mono">Примеры: Планария, Бычий цепень</p>
                    <ul className="text-sm space-y-2 list-disc pl-4 text-stone-300 marker:text-pink-500">
                        <li><strong>Тело:</strong> Плоское как лента.</li>
                        <li><strong>Полость тела:</strong> НЕТ (забито паренхимой).</li>
                        <li><strong>Пищеварение:</strong> Тупик. Едят ртом, выбрасывают остатки... тоже ртом.</li>
                        <li><strong>Опасность:</strong> Многие — опасные паразиты! Мойте руки!</li>
                    </ul>
                </div>

                {/* Roundworms */}
                <div className="bg-stone-900/80 p-5 rounded-xl border border-stone-800 hover:border-orange-500/50 transition-all hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-xl text-orange-400">Круглые</h3>
                        <span className="text-xs bg-orange-900/30 text-orange-300 px-2 py-1 rounded border border-orange-500/20">Upgrade</span>
                    </div>
                    <p className="text-xs text-stone-500 mb-4 font-mono">Примеры: Аскарида, Острица</p>
                    <ul className="text-sm space-y-2 list-disc pl-4 text-stone-300 marker:text-orange-500">
                        <li><strong>Тело:</strong> Круглое в разрезе, веретено.</li>
                        <li><strong>Полость тела:</strong> Первичная (жидкость под давлением — гидроскелет).</li>
                        <li><strong>Пищеварение:</strong> <span className="text-orange-300 font-bold">Сквозное!</span> Есть анальное отверстие (революция!).</li>
                    </ul>
                </div>

                {/* Annelids */}
                <div className="bg-stone-900/80 p-5 rounded-xl border border-stone-800 hover:border-purple-500/50 transition-all hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-xl text-purple-400">Кольчатые</h3>
                        <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/20">Элита</span>
                    </div>
                    <p className="text-xs text-stone-500 mb-4 font-mono">Примеры: Дождевой червь, Пиявка</p>
                    <ul className="text-sm space-y-2 list-disc pl-4 text-stone-300 marker:text-purple-500">
                        <li><strong>Тело:</strong> Сегменты (колечки).</li>
                        <li><strong>Полость тела:</strong> Вторичная (Целом).</li>
                        <li><strong>Кровь:</strong> <span className="text-purple-300 font-bold">Замкнутая система</span> (есть сосуды и "сердца").</li>
                        <li><strong>Роль:</strong> Рыхлят землю, создают гумус.</li>
                    </ul>
                </div>
            </div>
        </section>

        {/* SECTION 4: ARTHROPODS */}
        <Card className="bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
            <CardHeader>
                <CardTitle className="text-yellow-400 flex items-center gap-3 text-3xl">
                    <Dna className="w-8 h-8" /> Членистоногие (Владыки мира)
                </CardTitle>
                <p className="text-stone-400 text-sm md:text-base">
                    Самая успешная группа животных. Они везде: в воде, на суше и в воздухе.
                </p>
            </CardHeader>
            <CardContent>
                <div className="grid lg:grid-cols-2 gap-8 mb-8">
                     <div className="relative rounded-xl overflow-hidden border border-yellow-500/20 h-64 lg:h-auto">
                        <Image src={imageUrls['bio7-arthropods']} alt="Строение рака и паука" fill className="object-contain bg-stone-950/50 p-2" />
                        <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded text-xs font-bold border border-yellow-500/30">
                            EXOSKELETON: ACTIVE
                        </div>
                     </div>
                     <div className="space-y-6">
                        <div className="bg-stone-950/50 p-4 rounded-xl border-l-4 border-yellow-500">
                            <h4 className="text-yellow-400 font-bold mb-2 text-lg">Секрет успеха: Броня</h4>
                            <p className="text-stone-300 text-sm">
                                У них есть наружный скелет из <strong>хитина</strong>. Это броня от врагов и защита от высыхания. 
                                <br/>Минус: Он не растет. Приходится <strong>линять</strong> (сбрасывать старую броню и быстро расти, пока новая мягкая).
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="bg-stone-800/50 p-3 rounded-lg text-center">
                                 <div className="text-2xl font-bold text-white mb-1">3</div>
                                 <div className="text-xs text-stone-400 uppercase">Отедела тела у насекомых</div>
                             </div>
                             <div className="bg-stone-800/50 p-3 rounded-lg text-center">
                                 <div className="text-2xl font-bold text-white mb-1">∞</div>
                                 <div className="text-xs text-stone-400 uppercase">Разнообразие</div>
                             </div>
                        </div>
                     </div>
                </div>

                {/* Comparative Table via Grid */}
                <div className="grid md:grid-cols-3 gap-0 border border-stone-700 rounded-2xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-stone-700 bg-stone-900/50">
                    {/* Crustaceans */}
                    <div className="p-6 hover:bg-stone-800/80 transition duration-300 group">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform w-fit">🦞</div>
                        <h4 className="font-bold text-xl text-white mb-3">Ракообразные</h4>
                        <div className="space-y-2 text-sm text-stone-300">
                            <p><span className="text-stone-500">База:</span> Вода</p>
                            <p><span className="text-stone-500">Усики:</span> <span className="text-yellow-200 font-bold">2 пары</span></p>
                            <p><span className="text-stone-500">Ноги:</span> 5 пар (клешни!)</p>
                            <p><span className="text-stone-500">Дыхание:</span> Жабры</p>
                        </div>
                    </div>

                    {/* Arachnids */}
                    <div className="p-6 hover:bg-stone-800/80 transition duration-300 group">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform w-fit">🕷️</div>
                        <h4 className="font-bold text-xl text-white mb-3">Паукообразные</h4>
                        <div className="space-y-2 text-sm text-stone-300">
                            <p><span className="text-stone-500">База:</span> Суша</p>
                            <p><span className="text-stone-500">Усики:</span> <span className="text-red-400 font-bold">НЕТ</span></p>
                            <p><span className="text-stone-500">Ноги:</span> 4 пары (8 шт)</p>
                            <p><span className="text-stone-500">Фишка:</span> Паутина и внекишечное пищеварение (коктейль из мухи)</p>
                        </div>
                    </div>

                    {/* Insects */}
                    <div className="p-6 hover:bg-stone-800/80 transition duration-300 group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 bg-yellow-500/5 rounded-full blur-2xl"></div>
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform w-fit">🐞</div>
                        <h4 className="font-bold text-xl text-white mb-3">Насекомые</h4>
                        <div className="space-y-2 text-sm text-stone-300">
                            <p><span className="text-stone-500">База:</span> Везде</p>
                            <p><span className="text-stone-500">Усики:</span> 1 пара</p>
                            <p><span className="text-stone-500">Ноги:</span> 3 пары (6 шт)</p>
                            <p><span className="text-stone-500">Ультимейт:</span> <span className="text-green-400 font-bold">КРЫЛЬЯ</span> ✈️</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-center mt-12 pb-8">
            <Link href="/vpr-tests" className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-emerald-600 font-mono rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 hover:bg-emerald-500 hover:scale-105 shadow-lg shadow-emerald-900/50">
                <span>ВЕРНУТЬСЯ НА БАЗУ</span>
                <Dna className="ml-2 w-5 h-5 group-hover:animate-spin" />
            </Link>
        </div>

      </div>
    </div>
  );
}