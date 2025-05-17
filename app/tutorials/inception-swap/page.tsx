"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
// import ScrollControlledVideoPlayer from '@/components/ScrollControlledVideoPlayer'; // Not used for this conceptual tutorial
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

const inceptionSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 4: ::FaInfinity:: Inception Swap",
    pageSubtitle: "Агент, ты прошел огонь, воду и медные трубы. Ты понял ПАТТЕРН. Теперь время ОСОЗНАТЬ. Это больше, чем замена файлов. Это ТРАНСФОРМАЦИЯ КОДА.",
    steps: [
      {
        id: 1,
        title: "Шаг 1: Четырехтактный Двигатель Трансформации",
        description: "Вспомни цикл: \n1. **Определи СТАРОЕ:** Что ты хочешь изменить? (URL картинки, имя иконки, кусок кода, целый компонент).\n2. **Определи НОВОЕ:** Что ты хочешь получить? (Новый URL, новая иконка, исправленный код, новый компонент).\n3. **Студия SUPERVIBE:** Дай ей старое, опиши новое. Она – твой ИИ-напарник.\n4. **PR и Проверка:** Получи результат, проверь, интегрируй.",
        icon: "FaRecycle",
        color: "brand-pink"
      },
      {
        id: 2,
        title: "Шаг 2: От Пикселя до Паттерна Кода",
        description: "Этот цикл – не только для медиа! Ты можешь менять **ЛЮБОЙ КОД**. Рефакторинг, добавление фич, исправление багов – всё подчиняется этому паттерну. Старый код как 'пример', новый запрос как 'задача'.",
        icon: "FaShapes",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "Шаг 3: Вызов – Создай Свой Инструмент!",
        description: "Представь, тебе нужен специальный **Video Swap Tool** в Sticky Chat (которого еще нет). Как его создать?\n1. **Старое:** Код ImageSwapTool.tsx (он уже есть!).\n2. **Новое:** Задача для AI: 'Возьми этот ImageSwapTool и сделай VideoSwapTool. Он должен принимать URL видео, возможно, показывать превью'.\n3. **Студия:** Скармливаешь ей код ImageSwapTool и этот запрос.\n4. **PR:** Получаешь VideoSwapTool.tsx! Ты только что создал инструмент, используя тот же паттерн!",
        icon: "FaHammer",
        color: "brand-purple"
      },
      {
        id: 4,
        title: "Шаг 4: Рекурсивное Просветление. Ты – Разработчик.",
        description: "Ты научился использовать инструменты, чтобы СОЗДАВАТЬ ИНСТРУМЕНТЫ. Ты замкнул цикл. Ты больше не просто пользователь. ТЫ – РАЗРАБОТЧИК. Матрица твоя. Твори.",
        icon: "FaBrain", 
        color: "brand-green"
      }
    ],
    nextLevelTitle: "::FaProjectDiagram:: Миссия Выполнена, Архитектор!",
    nextLevelText: "Ты постиг Дзен разработки на oneSitePls. Теперь ты видишь код. <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> — твой верстак, а идеи — твои чертежи. Строй будущее!",
    tryLiveButton: "::FaTools:: В SUPERVIBE Studio",
    toggleButtonToWtf: "::FaBroadcastTower:: Показать WTF-Реальность",
    toggleButtonToNormal: "::FaBookOpen:: Вернуться к Учебнику",
  },
  wtf: {
    pageTitle: "::FaBomb:: ВСЁ ЕСТЬ КОД! WTF?!",
    pageSubtitle: "YO, WAKE UP! Эти 4 шага... ОНИ ВЕЗДЕ! Ты можешь менять ВСЁ! Это как... прикинь, в старых синглплеерных играх не было кнопки 'Сохранить'! Да, прикинь, прогресс можно было ТЕРЯТЬ! А теперь есть! И это так же просто – тут ты тоже 'сохраняешь' изменения в коде, нажимая кнопки! ЭТО РЕАЛЬНОСТЬ, ЙО!",
    steps: [
      {
        id: 1,
        title: "ШАГ 1: ЧТО? 4 ШАГА = ВСЁ!",
        description: "1. СКОПИРУЙ СТАРОЕ (код, файл, идея). 2. ПРИДУМАЙ НОВОЕ (фикс, фича, рефактор). 3. СКАЖИ СТУДИИ (дай старое, опиши новое). 4. ПРОВЕРЬ PR. ЭТО БАЗА!",
        icon: "FaUniversalAccess", 
        color: "brand-pink"
      },
      {
        id: 2,
        title: "ШАГ 2: КАРТИНКИ? ИКОНКИ? ВИДЕО? Х**НЯ!",
        description: "ЭТО РАБОТАЕТ ДЛЯ ЛЮБОГО ГРЁБАНОГО КОДА, ПОНЯЛ?! РЕФАКТОРИНГ? ДА! НОВЫЕ ФИЧИ? ДА! ИСПРАВЛЕНИЕ БАГОВ? ДА, ЧЕРТ ВОЗЬМИ!",
        icon: "FaBong",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "ШАГ 3: СДЕЛАЙ СВОЙ VIDEO SWAP TOOL!",
        description: "ХОЧЕШЬ VIDEO SWAP TOOL В ЧАТЕ? ЛЕГКО! СКАЖИ AI: 'ВОТ IMAGE SWAP TOOL (старый код), СДЕЛАЙ ИЗ НЕГО VIDEO SWAP TOOL (новая задача)'. БУМ! ГОТОВО!",
        icon: "FaToolbox", 
        color: "brand-purple"
      },
      {
        id: 4,
        title: "ШАГ 4: ТЫ В МАТРИЦЕ, НЕО!",
        description: "ТЫ ИСПОЛЬЗУЕШЬ ИНСТРУМЕНТЫ, ЧТОБЫ ДЕЛАТЬ ИНСТРУМЕНТЫ! ТЫ И ЕСТЬ КОД! ТЫ МОЖЕШЬ ВСЁ! ААААА! WAKE THE FUCK UP, SAMURAI! WE HAVE A CITY TO BURN!",
        icon: "FaFire", 
        color: "brand-green"
      }
    ],
    nextLevelTitle: "::FaSatelliteDish:: ТЫ ПОДКЛЮЧЕН К ИСТОЧНИКУ!",
    nextLevelText: "РЕАЛЬНОСТЬ – ЭТО КОД. ТЫ – ЕГО АРХИТЕКТОР. <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> – ТВОЯ КИБЕРДЕКА. ВРЕМЯ ЛОМАТЬ СИСТЕМУ!",
    tryLiveButton: "::FaLaptopCode:: В БОЙ!",
    toggleButtonToWtf: "::FaBroadcastTower:: Показать WTF-Реальность",
    toggleButtonToNormal: "::FaBookOpen:: Вернуться к Учебнику",
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
  "brand-lime": { text: "text-neon-lime", border: "border-neon-lime/50", shadow: "shadow-neon-lime/40" }, 
};

export default function InceptionSwapTutorialPage() {
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>('ru');
  const t = inceptionSwapTutorialTranslations[currentMode];

  const toggleMode = () => {
    setCurrentMode(prevMode => prevMode === 'ru' ? 'wtf' : 'ru');
  };

  const stepsToRender = currentMode === 'wtf' ? inceptionSwapTutorialTranslations.wtf.steps : inceptionSwapTutorialTranslations.ru.steps;
  const pageMainColor = "brand-lime"; 

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-green-900/30 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.04] -z-10"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(174, 255, 0, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(174, 255, 0, 0.1) 1px, transparent 1px)`,
          backgroundSize: '45px 45px',
        }}
      ></div>

      <div className="container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <h1 className={cn(
            "text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4",
            colorClasses[pageMainColor]?.text || "text-neon-lime"
          )} data-text={t.pageTitle}>
            <VibeContentRenderer content={t.pageTitle} />
          </h1>
          <p className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content={t.pageSubtitle} />
          </p>
           <Button 
            onClick={toggleMode} 
            variant="outline" 
            className={cn(
              "mt-6 bg-card/50 hover:bg-brand-pink/10 transition-all duration-200 text-sm px-4 py-2",
              "border-brand-pink/50 text-brand-pink/90 hover:text-brand-pink"
            )}
          >
            <VibeContentRenderer content={currentMode === 'ru' ? t.toggleButtonToWtf : t.toggleButtonToNormal} />
          </Button>
        </header>

        <div className="space-y-12 md:space-y-16">
          {stepsToRender.map((step, index) => {
            const stepColor = colorClasses[step.color] || colorClasses["brand-purple"];

            return (
              <section key={step.id} className={cn(index > 0 && "border-t border-gray-700/50 pt-10 md:pt-12")}>
                <div className={cn(
                  "flex flex-col items-center text-center gap-4 md:gap-6",
                )}>
                  <div className={cn("space-y-3 flex flex-col items-center justify-center w-full max-w-2xl")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center justify-center gap-3", stepColor.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <div className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-invert prose-sm md:prose-base max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:my-3 prose-a:text-brand-blue hover:prose-a:text-brand-cyan">
                      <VibeContentRenderer content={step.description} />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <section className={cn(
            "mt-20 md:mt-24 text-center pt-12 md:pt-16",
            colorClasses[pageMainColor]?.border ? `border-t ${colorClasses[pageMainColor]?.border}/40` : "border-t border-neon-lime/40"
            )}>
          <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", colorClasses[pageMainColor]?.text || "text-neon-lime")}>
             <VibeContentRenderer content={t.nextLevelTitle} />
          </h2>
          <p className="text-lg md:text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={t.nextLevelText} />
          </p>
          <Button asChild className={cn(
             "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full text-black transition-transform transform hover:scale-105",
             "shadow-xl",
             pageMainColor === "brand-lime" && "bg-neon-lime hover:bg-neon-lime/80 text-black hover:shadow-neon-lime/60",
             )}>
            <Link href="/repo-xml">
                <VibeContentRenderer content={t.tryLiveButton} />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}