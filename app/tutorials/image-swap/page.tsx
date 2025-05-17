"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import ScrollControlledVideoPlayer from '@/components/ScrollControlledVideoPlayer';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

const imageSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 1: Охота на Битый Пиксель",
    pageSubtitle: "Агент, твоя задача: освоить замену изображений в коде! Думай об этом как о реанимации цифрового артефакта: ::FaImageSlash:: -> ::FaToolbox:: -> ::FaImagePortrait::. Без регистрации, только чистый скилл-ап!",
    steps: [ // Changed from 'videos' to 'steps' for consistency
      {
        id: 1,
        title: "Шаг 1: Захват URL Старого Артефакта",
        description: "Первая задача, оперативник: обнаружить в кодовой базе изображение, требующее замены. Найдя, скопируй его полный URL. Это твоя основная цель!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4",
        icon: "FaLink",
        color: "brand-pink"
      },
      {
        id: 2,
        title: "Шаг 2: Развертывание Нового Актива",
        description: "Далее, загрузи свой новенький, сияющий файл замены. Рекомендуем Supabase Storage для гладкой интеграции, но подойдет любой публично доступный URL. Защити новую ссылку!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4",
        icon: "FaUpload",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "Шаг 3: Активация VIBE-Трансмутации!",
        description: "Время магии! Направляйся в SUPERVIBE Studio. Введи URL старого изображения, затем нового. Наш AI-агент обработает модификации кода и подготовит замену.",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4",
        icon: "FaWandMagicSparkles",
        color: "brand-purple"
      },
      {
        id: 4,
        title: "Шаг 4: Операция Успешна! Анализ PR",
        description: "Миссия выполнена! Pull Request с заменой изображения сгенерирован автоматически. Осталось лишь проверить, смерджить и наслаждаться результатом. Профит!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4",
        icon: "FaCheckDouble",
        color: "brand-green"
      }
    ],
    nextLevelTitle: "::FaPlayCircle:: Новый Уровень Разблокирован!",
    nextLevelText: "Основы у тебя в кармане, Агент! Готов применить эти навыки в реальном бою? <Link href='/repo-xml?flow=imageSwap' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> ждет твоих команд.",
    tryLiveButton: "::FaWandMagicSparkles:: Попробовать в Студии",
    toggleButtonToWtf: "::FaBrain:: Переключить на WTF-инструкцию",
    toggleButtonToNormal: "::FaBookOpen:: Вернуться к нормальной инструкции",
  },
  wtf: {
    pageTitle: "Замена Картинок для Чайников",
    pageSubtitle: "Просто, как дважды два. Следуй видосам! ::FaThumbsUp::",
    steps: [ // Changed from 'videos' to 'steps' for consistency
      {
        id: 1,
        title: "Шаг 1: Скопируй Старый Адрес",
        description: "Найди в коде СТАРУЮ картинку. Скопируй её АДРЕС (URL). Это просто!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4",
        icon: "FaLink",
        color: "brand-pink"
      },
      {
        id: 2,
        title: "Шаг 2: Загрузи Новую, Скопируй Адрес",
        description: "Загрузи НОВУЮ картинку (куда-нибудь, где есть ссылка). Скопируй её АДРЕС (URL).",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4",
        icon: "FaUpload",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "Шаг 3: Студия Сделает Магию",
        description: "Иди в SUPERVIBE Studio. Вставь СТАРЫЙ адрес, потом НОВЫЙ. Наш AI всё сделает сам и подготовит PR.",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4",
        icon: "FaWandMagicSparkles",
        color: "brand-purple"
      },
      {
        id: 4,
        title: "Шаг 4: Готово! Проверь PR",
        description: "PR создан! Просто проверь и смерджи. Картинка заменена! Ты молодец!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4",
        icon: "FaCheckDouble",
        color: "brand-green"
      }
    ],
    nextLevelTitle: "::FaAward:: Мастер Пикселей!",
    nextLevelText: "Теперь ты меняешь картинки как босс! Готов к реальным задачам? <Link href='/repo-xml?flow=imageSwap' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> заряжена.",
    tryLiveButton: "::FaWandMagicSparkles:: В Студию!",
    toggleButtonToWtf: "::FaBrain:: Переключить на WTF-инструкцию",
    toggleButtonToNormal: "::FaBookOpen:: Вернуться к нормальной инструкции",
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
};

export default function ImageSwapTutorialPage() {
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>('ru');
  const t = imageSwapTutorialTranslations[currentMode];

  const toggleMode = () => {
    setCurrentMode(prevMode => prevMode === 'ru' ? 'wtf' : 'ru');
  };

  const stepsToRender = currentMode === 'wtf' ? imageSwapTutorialTranslations.wtf.steps : imageSwapTutorialTranslations.ru.steps;
  const pageMainColor = "brand-green"; // Main color for this tutorial page

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-5 -z-10"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <div className="container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <h1 className={cn(
            "text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4",
             colorClasses[pageMainColor]?.text || "text-brand-green"
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
              "mt-6 bg-card/50 hover:bg-brand-cyan/10 transition-all duration-200 text-sm px-4 py-2",
              colorClasses["brand-cyan"]?.border || "border-brand-cyan/50", // WTF button always cyan for contrast
              `${colorClasses["brand-cyan"]?.text}/90 hover:${colorClasses["brand-cyan"]?.text}`
            )}
          >
            <VibeContentRenderer content={currentMode === 'ru' ? t.toggleButtonToWtf : t.toggleButtonToNormal} />
          </Button>
        </header>

        <div className="space-y-16 md:space-y-24">
          {stepsToRender.map((step, index) => {
            const stepColor = colorClasses[step.color] || colorClasses["brand-purple"];
            // Ensure videoSrc is checked correctly for each step
            const hasVideo = !!(step as any).videoSrc && typeof (step as any).videoSrc === 'string';

            return (
              <section key={step.id} className={cn(index > 0 && "border-t border-gray-700/50 pt-12 md:pt-16")}>
                <div className={cn(
                  "flex flex-col gap-6 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  <div className={cn("space-y-4 flex flex-col items-start justify-center", hasVideo ? "md:w-2/5 lg:w-1/3" : "w-full")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center gap-3", stepColor.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      <VibeContentRenderer content={step.description} />
                    </p>
                    {step.id === 3 && ( // Check original step ID for button placement
                      <Button asChild className={cn(
                        "inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-black transition-colors shadow-lg mt-4",
                        "bg-brand-yellow hover:bg-brand-yellow/80 hover:shadow-yellow-glow/50"
                        )}>
                        <Link href="/repo-xml?flow=imageSwap">
                           <VibeContentRenderer content="К Студии SUPERVIBE ::FaExternalLinkAlt::" />
                        </Link>
                      </Button>
                    )}
                  </div>
                 
                  {hasVideo && (
                    <div className="md:w-3/5 lg:w-2/3">
                      <div className={cn("rounded-xl overflow-hidden border-2 shadow-2xl", stepColor.border, stepColor.shadow, "bg-black")}>
                        <ScrollControlledVideoPlayer 
                          src={(step as any).videoSrc} // Cast to any to access videoSrc
                          className="w-full" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <section className={cn(
            "mt-20 md:mt-32 text-center pt-12 md:pt-16",
            colorClasses[pageMainColor]?.border ? `border-t ${colorClasses[pageMainColor]?.border}/40` : "border-t border-brand-green/40"
            )}>
          <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", colorClasses[pageMainColor]?.text || "text-brand-green")}>
             <VibeContentRenderer content={t.nextLevelTitle} />
          </h2>
          <p className="text-lg md:text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={t.nextLevelText} />
          </p>
          <Button asChild className={cn(
             "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full text-black transition-transform transform hover:scale-105",
             "shadow-xl",
              pageMainColor === "brand-green" && "bg-brand-green hover:bg-brand-green/80 hover:shadow-green-glow/60",
             // Add other color conditions if this page type can have variable main colors
             )}>
            <Link href="/repo-xml?flow=imageSwap">
                <VibeContentRenderer content={t.tryLiveButton} />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}