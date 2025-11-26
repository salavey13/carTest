"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { Bug, Dna, Microscope, Waves } from "lucide-react";

// Промпты для генерации изображений (вставь ссылки, когда сгенеришь)
const imageUrls: Record<string, string> = {
  // Prompt: "Microscopic view of Amoeba proteus and Euglena viridis, colorful scientific illustration, dark background, neon outlines"
  'bio7-protozoa': 'https://placehold.co/600x400/102020/00ff00?text=Простейшие+(Amoeba+Euglena)',
  
  // Prompt: "Hydra polyp anatomy diagram, cross section showing two layers of cells, ectoderm and endoderm, scientific schematic style"
  'bio7-hydra': 'https://placehold.co/600x400/102020/00ccff?text=Кишечнополостные+(Hydra)',
  
  // Prompt: "Comparison of Flatworm, Roundworm and Annelid (earthworm) anatomy, cross sections, biology textbook style"
  'bio7-worms': 'https://placehold.co/600x400/201010/ff5555?text=Типы+Червей',
  
  // Prompt: "Detailed structure of a Crustacean (Crayfish) and Arachnid (Spider), showing external skeleton and legs, vintage biology poster style"
  'bio7-arthropods': 'https://placehold.co/600x400/202010/ffff00?text=Членистоногие',
};

export default function Biology7Cheatsheet() {
  return (
    <div className="min-h-screen bg-stone-950 text-emerald-100 p-4 md:p-8 font-sans selection:bg-emerald-900 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-900/30 rounded-full border border-emerald-500/30 mb-4">
            <Bug className="w-6 h-6 text-emerald-400 mr-2" />
            <span className="text-emerald-300 font-mono tracking-widest uppercase text-sm">Зоология v.7.0</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-lime-400">
            ЦАРСТВО ЖИВОТНЫХ
          </h1>
          <p className="text-stone-400 max-w-2xl mx-auto text-lg">
            От одной клетки до сложных систем. Разбор беспозвоночных для выживания на ВПР.
          </p>
        </header>

        {/* SECTION 1: PROTOZOA */}
        <Card className="bg-stone-900/80 border-emerald-500/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Microscope size={100} /></div>
            <CardHeader>
                <CardTitle className="flex items-center text-2xl text-emerald-400">
                    <span className="bg-emerald-500/20 w-8 h-8 rounded flex items-center justify-center mr-3 text-sm">01</span>
                    Простейшие (Одноклеточные)
                </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 relative z-10">
                <div className="space-y-4 text-stone-300">
                    <p>Весь организм — это <strong>одна клетка</strong>, но она умеет всё: есть, дышать, двигаться.</p>
                    <ul className="space-y-2">
                        <li className="flex gap-2 bg-stone-800/50 p-2 rounded border border-stone-700">
                            <strong className="text-emerald-300 min-w-[80px]">Амёба:</strong> 
                            <span>Не имеет формы, движется ложноножками (фагоцитоз).</span>
                        </li>
                        <li className="flex gap-2 bg-stone-800/50 p-2 rounded border border-stone-700">
                            <strong className="text-green-300 min-w-[80px]">Эвглена:</strong> 
                            <span>"Растение-животное". На свету фотосинтезирует (есть хлоропласты), в темноте ест готовое. Есть жгутик.</span>
                        </li>
                        <li className="flex gap-2 bg-stone-800/50 p-2 rounded border border-stone-700">
                            <strong className="text-teal-300 min-w-[80px]">Инфузория:</strong> 
                            <span>Сложная! 2 ядра (большое и малое), реснички, клеточный рот.</span>
                        </li>
                    </ul>
                </div>
                <div className="relative group cursor-help">
                    <Image src={imageUrls['bio7-protozoa']} alt="Простейшие" width={600} height={400} className="rounded-lg border border-emerald-500/30 object-cover w-full h-full" />
                    <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 text-xs rounded text-emerald-200">Сгенерировано AI</div>
                </div>
            </CardContent>
        </Card>

        {/* SECTION 2: COELENTERATES */}
        <Card className="bg-stone-900/80 border-cyan-500/30 overflow-hidden">
            <CardHeader>
                <CardTitle className="flex items-center text-2xl text-cyan-400">
                    <span className="bg-cyan-500/20 w-8 h-8 rounded flex items-center justify-center mr-3 text-sm">02</span>
                    Кишечнополостные (Гидра, Медузы)
                </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="order-2 md:order-1 relative">
                     <Image src={imageUrls['bio7-hydra']} alt="Гидра" width={600} height={400} className="rounded-lg border border-cyan-500/30 object-cover w-full h-full" />
                </div>
                <div className="order-1 md:order-2 space-y-4 text-stone-300">
                    <div className="flex items-start gap-3">
                         <Waves className="w-6 h-6 text-cyan-500 mt-1" />
                         <div>
                             <h4 className="font-bold text-white mb-1">Многоклеточные, двухслойные!</h4>
                             <p className="text-sm">Тело — мешок. Стенки из двух слоев клеток: <strong>Эктодерма</strong> (наружный) и <strong>Энтодерма</strong> (внутренний).</p>
                         </div>
                    </div>
                    <div className="bg-cyan-950/30 p-4 rounded-lg border border-cyan-500/20">
                        <h4 className="font-bold text-cyan-300 mb-2">Супер-способность: Стрекательные клетки 🔥</h4>
                        <p className="text-sm">Находятся в эктодерме. Выстреливают ядовитой нитью для защиты и охоты. Также есть регенерация (промежуточные клетки).</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* SECTION 3: WORMS */}
        <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-stone-900 p-4 rounded-xl border border-stone-800 hover:border-pink-500/50 transition-colors">
                <h3 className="font-bold text-pink-400 mb-2">Плоские черви</h3>
                <p className="text-xs text-stone-400 mb-2">Планалия, Сосальщики, Цепни</p>
                <ul className="text-sm space-y-1 list-disc pl-4 text-stone-300">
                    <li>Тело плоское</li>
                    <li>Нет полости тела (паренхима)</li>
                    <li>Слепой кишечник (нет анального отв.)</li>
                    <li>Гермафродиты</li>
                </ul>
            </div>
            <div className="bg-stone-900 p-4 rounded-xl border border-stone-800 hover:border-orange-500/50 transition-colors">
                <h3 className="font-bold text-orange-400 mb-2">Круглые черви</h3>
                <p className="text-xs text-stone-400 mb-2">Аскарида, Острица</p>
                <ul className="text-sm space-y-1 list-disc pl-4 text-stone-300">
                    <li>Тело круглое в сечении</li>
                    <li>Есть полость тела (первичная)</li>
                    <li><strong>Сквозной кишечник</strong> (есть анальное отв.)</li>
                    <li>Раздельнополые</li>
                </ul>
            </div>
            <div className="bg-stone-900 p-4 rounded-xl border border-stone-800 hover:border-purple-500/50 transition-colors">
                <h3 className="font-bold text-purple-400 mb-2">Кольчатые черви</h3>
                <p className="text-xs text-stone-400 mb-2">Дождевой червь, Пиявки</p>
                <ul className="text-sm space-y-1 list-disc pl-4 text-stone-300">
                    <li>Тело из колец (сегменты)</li>
                    <li>Вторичная полость (целом)</li>
                    <li>Есть <strong>кровеносная система</strong> (замкнутая)</li>
                    <li>Дышат кожей</li>
                </ul>
            </div>
        </div>

        {/* SECTION 4: ARTHROPODS */}
        <Card className="bg-gradient-to-br from-stone-900 to-stone-800 border-yellow-500/30">
            <CardHeader>
                <CardTitle className="text-yellow-400 flex items-center gap-2">
                    <Dna className="w-6 h-6" /> Членистоногие (ТОП эволюции беспозвоночных)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="mb-4 text-stone-300">
                    Общее: <strong>Хитиновый покров</strong> (наружный скелет), членистые ноги, рост через линьку.
                </div>
                <div className="grid md:grid-cols-3 gap-0 border border-stone-700 rounded-lg overflow-hidden divide-y md:divide-y-0 md:divide-x divide-stone-700">
                    <div className="p-4 bg-stone-900/50 hover:bg-stone-800 transition">
                        <h4 className="font-bold text-white mb-2 text-center">Ракообразные 🦞</h4>
                        <div className="text-sm text-stone-400 space-y-1">
                            <p>Среда: Вода</p>
                            <p>Усики: 2 пары</p>
                            <p>Ноги: 5 пар (ходильных)</p>
                            <p>Органы: Жаберное дыхание</p>
                        </div>
                    </div>
                    <div className="p-4 bg-stone-900/50 hover:bg-stone-800 transition">
                        <h4 className="font-bold text-white mb-2 text-center">Паукообразные 🕷️</h4>
                        <div className="text-sm text-stone-400 space-y-1">
                            <p>Среда: Суша</p>
                            <p>Усики: НЕТ</p>
                            <p>Ноги: 4 пары</p>
                            <p>Органы: Легочные мешки и трахеи</p>
                        </div>
                    </div>
                    <div className="p-4 bg-stone-900/50 hover:bg-stone-800 transition">
                        <h4 className="font-bold text-white mb-2 text-center">Насекомые 🐞</h4>
                        <div className="text-sm text-stone-400 space-y-1">
                            <p>Среда: Везде!</p>
                            <p>Усики: 1 пара</p>
                            <p>Ноги: 3 пары</p>
                            <p>Органы: Трахеи. Есть крылья!</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-center mt-8">
            <Link href="/vpr-tests" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-emerald-500/20 transition-all transform hover:scale-105">
                Загрузить тесты (Вернуться)
            </Link>
        </div>

      </div>
    </div>
  );
}