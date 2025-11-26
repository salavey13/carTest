"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { Bug, Dna, Microscope, Waves, Skull, ShieldAlert, Activity, Fish, Bird, Dog, Eye } from "lucide-react";

// Images (Keep existing + add placeholders for new sections if needed)
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
            БАЗА ЗНАНИЙ
          </h1>
          <p className="text-stone-400 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            Вся эволюция животного мира: от Амёбы до Шимпанзе.
            <br/><span className="text-emerald-500 font-bold">Цель:</span> Сдать ВПР и отличить жабу от лягушки по таблице.
          </p>
        </header>

        {/* ... (SECTION 1-4 same as before: Protozoa, Coelenterates, Worms, Arthropods) ... */}
        {/* NOTE: Include the previous Sections 1-4 here. I will omit them for brevity to focus on new additions. */}
        
        {/* --- NEW SECTION 5: CHORDATES (VERTEBRATES) --- */}
        <section className="space-y-6">
            <div className="flex items-center gap-3">
                <Fish className="text-blue-500 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">Хордовые (Высшая Лига)</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Fish */}
                <Card className="bg-stone-900/60 border-blue-500/30">
                    <CardHeader className="pb-2"><CardTitle className="text-blue-400 text-lg">Рыбы 🐟</CardTitle></CardHeader>
                    <CardContent className="text-xs text-stone-300 space-y-2">
                        <p>• Жабры, Плавники</p>
                        <p>• 2 камеры сердца</p>
                        <p>• 1 круг кровообращения</p>
                        <p>• Боковая линия (шестое чувство)</p>
                    </CardContent>
                </Card>

                {/* Amphibians */}
                <Card className="bg-stone-900/60 border-green-500/30">
                    <CardHeader className="pb-2"><CardTitle className="text-green-400 text-lg">Земноводные 🐸</CardTitle></CardHeader>
                    <CardContent className="text-xs text-stone-300 space-y-2">
                        <p>• Голая слизистая кожа (дышат ей)</p>
                        <p>• 3 камеры сердца (холоднокровные)</p>
                        <p>• Развитие в воде (головастик)</p>
                        <p>• Лягушки, Жабы, Тритоны</p>
                    </CardContent>
                </Card>

                {/* Reptiles */}
                <Card className="bg-stone-900/60 border-yellow-500/30">
                    <CardHeader className="pb-2"><CardTitle className="text-yellow-400 text-lg">Пресмыкающиеся 🦎</CardTitle></CardHeader>
                    <CardContent className="text-xs text-stone-300 space-y-2">
                        <p>• Сухая кожа, чешуя</p>
                        <p>• 3 камеры сердца (но кровь меньше смешивается)</p>
                        <p>• Яйца в скорлупе (суша!)</p>
                        <p>• Змеи, Ящерицы, Черепахи</p>
                    </CardContent>
                </Card>

                {/* Birds */}
                <Card className="bg-stone-900/60 border-sky-500/30">
                    <CardHeader className="pb-2"><CardTitle className="text-sky-400 text-lg">Птицы 🦅</CardTitle></CardHeader>
                    <CardContent className="text-xs text-stone-300 space-y-2">
                        <p>• Перья, Крылья, Клюв</p>
                        <p>• 4 камеры сердца (теплокровные!)</p>
                        <p>• Двойное дыхание (мешки)</p>
                        <p>• Кости полые (легкость)</p>
                    </CardContent>
                </Card>

                {/* Mammals */}
                <Card className="bg-stone-900/60 border-pink-500/30">
                    <CardHeader className="pb-2"><CardTitle className="text-pink-400 text-lg">Млекопитающие 🦍</CardTitle></CardHeader>
                    <CardContent className="text-xs text-stone-300 space-y-2">
                        <p>• Шерсть, Молоко</p>
                        <p>• 4 камеры сердца</p>
                        <p>• Альвеолярные легкие</p>
                        <p>• Развитый мозг (кора)</p>
                    </CardContent>
                </Card>
            </div>
        </section>

        {/* --- NEW SECTION 6: VPR SURVIVAL SKILLS --- */}
        <Card className="bg-gradient-to-r from-emerald-900/40 to-stone-900 border border-emerald-500/50">
            <CardHeader>
                <CardTitle className="text-emerald-400 flex items-center gap-2">
                    <Eye className="w-6 h-6" /> Секреты ВПР: Работа с фото
                </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="bg-black/30 p-4 rounded-lg border border-emerald-500/20 flex items-start gap-3">
                        <Dog className="w-8 h-8 text-stone-400" />
                        <div>
                            <h4 className="font-bold text-white">Собаки (Задание 4)</h4>
                            <p className="text-sm text-stone-300 mt-1">
                                1. <strong>Уши:</strong> Стоячие (как у овчарки), Висячие (как у спаниеля), Полустоячие (кончики висят).<br/>
                                2. <strong>Хвост:</strong> Кольцом (лайка), Поленом (толстый), Прутом (тонкий), Купирован (обрубок).
                            </p>
                        </div>
                    </div>
                    <div className="bg-black/30 p-4 rounded-lg border border-emerald-500/20 flex items-start gap-3">
                        <Bird className="w-8 h-8 text-stone-400" />
                        <div>
                            <h4 className="font-bold text-white">Лошадь (Задание 4)</h4>
                            <p className="text-sm text-stone-300 mt-1">
                                1. <strong>Масть:</strong> Гнедая (коричневая + черная грива), Рыжая (вся рыжая), Вороная (черная), Серая (белая), Пегая (пятнами).<br/>
                                2. <strong>Голова:</strong> Прямая или Горбоносая (выпуклая).
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-stone-950 p-4 rounded-lg border border-white/10">
                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-red-400" /> Анализ Таблиц (Задание 8)
                    </h4>
                    <p className="text-sm text-stone-400 italic mb-4">
                        "У кого пульс 100?" или "У кого сердце бьется чаще?"
                    </p>
                    <div className="space-y-2 text-sm text-stone-300">
                        <p>🔹 Чем <strong>меньше</strong> животное, тем <strong>чаще</strong> пульс (Хомяк > 400, Слон ~ 30).</p>
                        <p>🔹 Внимательно смотри на диапазоны: если 70-120, то 100 входит!</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-center mt-12 pb-8">
            <Link href="/vpr-tests" className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-emerald-600 font-mono rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 hover:bg-emerald-500 hover:scale-105 shadow-lg shadow-emerald-900/50">
                <span>ВЕРНУТЬСЯ К ТЕСТАМ</span>
                <Dna className="ml-2 w-5 h-5 group-hover:animate-spin" />
            </Link>
        </div>

      </div>
    </div>
  );
}