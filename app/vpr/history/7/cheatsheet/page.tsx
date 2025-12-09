"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { ShieldAlert, Radio, FileWarning, Search, Skull, History, ArrowLeft, EyeOff } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

export default function History7Cheatsheet() {
  return (
    <div className="min-h-screen bg-stone-950 text-amber-50 p-4 md:p-8 font-sans selection:bg-amber-900 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="text-center space-y-4 mb-12 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-amber-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="inline-flex items-center justify-center p-3 bg-amber-900/30 rounded-full border border-amber-600/30 mb-4 backdrop-blur-md">
            <History className="w-6 h-6 text-amber-500 mr-2" />
            <span className="text-amber-200 font-mono tracking-widest uppercase text-sm">История XX века // Declassified</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-400 to-red-500 drop-shadow-sm">
            АНАТОМИЯ КОНФЛИКТА
          </h1>
          <p className="text-stone-400 max-w-2xl mx-auto text-lg leading-relaxed font-mono">
            Как отличить исторический факт от пропаганды? <br/>
            Разбор механик на примере <span className="text-amber-500 font-bold">Зимней войны (1939-1940)</span>.
          </p>
        </header> 

        {/* SECTION 1: CASUS BELLI */}
        <Card className="bg-stone-900/80 border-red-900/30 overflow-hidden relative group">
            <div className="absolute -right-10 -top-10 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert size={150} /></div>
            <CardHeader>
                <CardTitle className="flex items-center text-2xl text-red-400 font-bold">
                    <span className="bg-red-500/10 w-10 h-10 rounded-lg flex items-center justify-center mr-4 text-lg border border-red-500/30">01</span>
                    Инцидент в Майниле: "Они начали первые!"
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
                <div className="bg-stone-950/80 p-5 rounded-xl border-l-4 border-red-600">
                    <h4 className="text-lg font-bold text-white mb-2">Официальная версия (Газета "Правда", 1939):</h4>
                    <p className="italic text-stone-400">"Финская артиллерия обстреляла советских солдат у деревни Майнила. Мы вынуждены ответить, чтобы отодвинуть угрозу от Ленинграда."</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-sm">
                            <Search className="w-4 h-4" /> Реальность (Архивы)
                        </div>
                        <p className="text-sm text-stone-300 leading-relaxed">
                            Финских орудий в этом районе <strong>не было</strong> (они были отведены, чтобы не провоцировать). Выстрелы были произведены с советской стороны силами НКВД.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-sm">
                            <EyeOff className="w-4 h-4" /> Зачем это нужно?
                        </div>
                        <p className="text-sm text-stone-300 leading-relaxed">
                            <strong>Casus Belli</strong> (повод к войне). Агрессору всегда нужно выглядеть жертвой в глазах своего населения. "Нас вынудили".
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* SECTION 2: PUPPET GOVERNMENT */}
        <Card className="bg-stone-900/80 border-amber-600/30 overflow-hidden">
            <CardHeader>
                <CardTitle className="flex items-center text-2xl text-amber-400 font-bold">
                    <span className="bg-amber-500/10 w-10 h-10 rounded-lg flex items-center justify-center mr-4 text-lg border border-amber-500/30">02</span>
                    "Финляндская Демократическая Республика"
                </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6">
                 <div className="md:col-span-2 space-y-4">
                    <p className="text-stone-300">
                        СССР заявил, что не воюет с Финляндией, а "помогает" законному правительству рабочих.
                    </p>
                    <ul className="space-y-3">
                        <li className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                            <span className="text-amber-500 font-bold">Фейк:</span> Создано марионеточное правительство в г. Терийоки (Отто Куусинен), которое "попросило" ввести войска.
                        </li>
                        <li className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                            <span className="text-amber-500 font-bold">Цель:</span> Создать иллюзию гражданской войны или освобождения, а не захвата.
                        </li>
                        <li className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                            <span className="text-amber-500 font-bold">Итог:</span> Никто (даже сами финские рабочие) в это не поверил. Когда блицкриг провалился, про это "правительство" СССР просто забыл.
                        </li>
                    </ul>
                 </div>
                 <div className="bg-black/40 p-4 rounded-xl border border-stone-700 flex flex-col justify-center items-center text-center">
                    <FileWarning className="w-12 h-12 text-red-500 mb-2 opacity-80" />
                    <p className="text-xs text-stone-500 font-mono">
                        УРОК:<br/>Если кто-то создает "Народную Республику" на границе перед вторжением — это шаблон 1939 года.
                    </p>
                 </div>
            </CardContent>
        </Card>

        {/* SECTION 3: MOLOTOV'S BREADBASKETS */}
        <Card className="bg-stone-900/80 border-stone-700 overflow-hidden">
            <CardHeader>
                <CardTitle className="flex items-center text-2xl text-stone-300 font-bold">
                    <span className="bg-stone-700/50 w-10 h-10 rounded-lg flex items-center justify-center mr-4 text-lg border border-stone-600">03</span>
                    Хлебницы Молотова (Newspeak)
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <div className="bg-stone-800 p-4 rounded-xl">
                            <p className="text-sm text-stone-400 mb-1 font-mono">ЗАЯВЛЕНИЕ МИД СССР (1939):</p>
                            <p className="text-lg text-white font-serif">"Мы не бомбим Хельсинки! Мы сбрасываем голодающим финским рабочим хлеб!"</p>
                        </div>
                        <div className="bg-stone-950 p-4 rounded-xl border border-stone-800">
                             <p className="text-sm text-stone-400 mb-1 font-mono">РЕАКЦИЯ ФИННОВ:</p>
                             <p className="text-stone-300 text-sm">
                                Финны назвали советские кассетные бомбы <strong>"Хлебницами Молотова"</strong>. <br/>
                                А в ответ придумали зажигательную смесь для танков — <strong>"Коктейль ДЛЯ Молотова"</strong> (позже название сократилось).
                             </p>
                        </div>
                    </div>
                    <div className="relative h-full flex items-center justify-center bg-gradient-to-b from-stone-800 to-stone-900 rounded-xl p-6 border border-stone-700">
                        <div className="text-center">
                            <Radio className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                            <h4 className="font-bold text-amber-500">Тотальная Ложь</h4>
                            <p className="text-xs text-stone-400 mt-2">
                                Отрицание очевидного (бомбежек) — стандартная тактика. 
                                "Нас там нет", "Это не мы", "Они сами себя".
                            </p>
                        </div>
                    </div>
                 </div>
            </CardContent>
        </Card>

        {/* SECTION 4: THE PRICE OF "MOGILIZATION" */}
        <section className="space-y-6">
            <div className="flex items-center gap-3">
                <Skull className="text-stone-500 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">Цена "Маленькой победоносной"</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-red-950/20 p-6 rounded-xl border border-red-900/30">
                    <h3 className="text-red-400 font-bold mb-2">План</h3>
                    <p className="text-stone-400 text-sm">Захватить Финляндию за 2 недели к дню рождения Сталина.</p>
                </div>
                <div className="bg-orange-950/20 p-6 rounded-xl border border-orange-900/30">
                    <h3 className="text-orange-400 font-bold mb-2">Реальность</h3>
                    <p className="text-stone-400 text-sm">3.5 месяца тяжелейших боев. Линия Маннергейма. "Мясные штурмы" против дотов.</p>
                </div>
                <div className="bg-stone-800/50 p-6 rounded-xl border border-stone-700">
                    <h3 className="text-white font-bold mb-2">Итог (Цифры)</h3>
                    <p className="text-stone-400 text-sm">
                        СССР: ~127,000 убитых / пропавших.<br/>
                        Финляндия: ~26,000.<br/>
                        <span className="text-amber-500 italic block mt-2">СССР исключили из Лиги Наций как агрессора.</span>
                    </p>
                </div>
            </div>
        </section>

        {/* FINAL MESSAGE */}
        <div className="bg-gradient-to-r from-stone-900 to-amber-950/30 border border-amber-600/30 rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-4">VPN для твоего мозга 🧠</h3>
                <p className="text-stone-300 max-w-2xl mx-auto mb-6">
                    История не повторяется, она рифмуется. Если ты видишь по телевизору те же приемы, что и в 1939 году (обстрел своих, марионетки, "мы только защищаемся"), — 
                    <strong> включай критическое мышление</strong>.
                </p>
                <Link href="/vpr-tests" className="inline-flex items-center justify-center px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-amber-900/50">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Вернуться в Базу
                </Link>
            </div>
        </div>

      </div>
    </div>
  );
}