"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import ScrollControlledVideoPlayer from '@/components/ScrollControlledVideoPlayer';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

const videoSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 3: Видео-Рендер",
    pageSubtitle: "Агент, время для тяжелой артиллерии – замена видео! Это как обновить голографическую проекцию в штабе: ::FaVideoSlash:: -> ::FaToolbox:: -> ::FaVideo::. Принцип тот же, что и с картинками, но файлы больше, ответственность выше!",
    steps: [
      {
        id: 1,
        title: "Шаг 1: Идентификация Старого Видео-потока (URL)",
        description: "Твоя первая задача: найти в коде компонент или тег, отображающий видео, которое нужно заменить. Скопируй полный URL текущего видео-источника (атрибут `src` или аналогичный). Это твоя цель номер один.",
        icon: "FaLink",
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4" // Placeholder
      },
      {
        id: 2,
        title: "Шаг 2: Загрузка и Получение URL Нового Видео-файла",
        description: "Загрузи новый видео-файл на хостинг (например, Supabase Storage). Убедись, что файл доступен по публичному URL. Скопируй этот новый URL – это твой ключ к обновлению.",
        icon: "FaUpload",
        color: "brand-blue",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4" // Placeholder
      },
      {
        id: 3,
        title: "Шаг 3: Активация Замены в SUPERVIBE Studio",
        description: "Перейди в SUPERVIBE Studio. В специальном интерфейсе для замены (Image/Video Swap) укажи старый URL видео и новый URL. AI-ассистент проанализирует код и подготовит необходимые изменения.",
        icon: "FaWandMagicSparkles",
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4" // Placeholder
      },
      {
        id: 4,
        title: "Шаг 4: Верификация Замены и Интеграция (PR)",
        description: "Миссия почти выполнена! SUPERVIBE Studio автоматически создаст Pull Request с изменениями. Твоя задача – проверить корректность замены в PR, смерджить его и убедиться, что новое видео отображается на сайте. Победа!",
        icon: "FaCheckDouble",
        color: "brand-green",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4" // Placeholder
      }
    ],
    nextLevelTitle: "::FaFilm:: Киномеханик Готов!",
    nextLevelText: "Отличная работа, Агент! Ты освоил замену видео. <Link href='/repo-xml?flow=imageSwap' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> ждет твоих новых подвигов с видео-контентом. *Заметка: для видео используется тот же ImageSwap флоу в студии.*",
    tryLiveButton: "::FaWandMagicSparkles:: Попробовать в Студии",
    toggleButtonToWtf: "::FaBrain:: Переключить на WTF-инструкцию",
    toggleButtonToNormal: "::FaBookOpen:: Вернуться к нормальной инструкции",
  },
  wtf: {
    pageTitle: "Замена Видео для Полных Нубов",
    pageSubtitle: "Смотри видосы, повторяй, ПРОФИТ! ::FaFilm:: Это так же просто, как с картинками!",
    steps: [
      {
        id: 1,
        title: "Шаг 1: Скопируй Старый Адрес Видео",
        description: "Найди в коде СТАРОЕ видео. Скопируй его АДРЕС (URL).",
        icon: "FaLink",
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4" // Placeholder from image-swap
      },
      {
        id: 2,
        title: "Шаг 2: Загрузи Новое Видео, Скопируй Адрес",
        description: "Загрузи НОВОЕ видео (на хостинг, где есть ссылка). Скопируй его АДРЕС (URL).",
        icon: "FaUpload",
        color: "brand-blue",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4" // Placeholder from image-swap
      },
      {
        id: 3,
        title: "Шаг 3: Студия Сделает Магию (Видео)",
        description: "Иди в SUPERVIBE Studio (используй флоу для картинок). Вставь СТАРЫЙ адрес, потом НОВЫЙ. AI всё сделает.",
        icon: "FaWandMagicSparkles",
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4" // Placeholder from image-swap
      },
      {
        id: 4,
        title: "Шаг 4: Готово! Проверь PR (Видео)",
        description: "PR создан! Просто проверь и смерджи. Видео заменено! Ты – режиссер своей страницы!",
        icon: "FaCheckDouble",
        color: "brand-green",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4" // Placeholder from image-swap
      }
    ],
    nextLevelTitle: "::FaAward:: Видео-Мастер!",
    nextLevelText: "Теперь и видео тебе по плечу! Продолжай в том же духе! <Link href='/repo-xml?flow=imageSwap' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> (да, та же кнопка для картинок) всегда готова помочь.",
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
  "brand-cyan": { text: "text-brand-cyan", border: "border-brand-cyan/50", shadow: "shadow-brand-cyan/40" }, // Added cyan
  "brand-orange": { text: "text-brand-orange", border: "border-brand-orange/50", shadow: "shadow-brand-orange/40" }, // Added orange for consistency if needed
};

export default function VideoSwapTutorialPage() {
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>('ru');
  const t = videoSwapTutorialTranslations[currentMode];

  const toggleMode = () => {
    setCurrentMode(prevMode => prevMode === 'ru' ? 'wtf' : 'ru');
  };

  const stepsToRender = currentMode === 'wtf' ? videoSwapTutorialTranslations.wtf.steps : videoSwapTutorialTranslations.ru.steps;
  const pageMainColor = "brand-cyan"; // Main color for this tutorial page

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-blue-900/30 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.04] -z-10"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 194, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 194, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: '45px 45px',
        }}
      ></div>

      <div className="container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <h1 className={cn(
            "text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4",
            colorClasses[pageMainColor]?.text || "text-brand-cyan"
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
              colorClasses[pageMainColor]?.border || "border-brand-cyan/50",
              `${colorClasses[pageMainColor]?.text}/90 hover:${colorClasses[pageMainColor]?.text}`
            )}
          >
            <VibeContentRenderer content={currentMode === 'ru' ? t.toggleButtonToWtf : t.toggleButtonToNormal} />
          </Button>
        </header>

        <div className="space-y-12 md:space-y-20">
          {stepsToRender.map((step, index) => {
            const stepColor = colorClasses[step.color] || colorClasses["brand-purple"];
            const hasVideo = step.hasOwnProperty('videoSrc') && (step as any).videoSrc;

            return (
              <section key={step.id} className={cn(index > 0 && "border-t border-gray-700/50 pt-10 md:pt-14")}>
                <div className={cn(
                  "flex flex-col gap-6 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  <div className={cn("space-y-4 flex flex-col items-start justify-center", hasVideo ? "md:w-2/5 lg:w-1/3" : "w-full")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center gap-3", stepColor.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <div className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-invert prose-sm md:prose-base max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:my-3 prose-a:text-brand-blue hover:prose-a:text-brand-cyan">
                      <VibeContentRenderer content={step.description} />
                    </div>
                  </div>

                  {hasVideo && (
                    <div className="md:w-3/5 lg:w-2/3">
                      <div className={cn("rounded-xl overflow-hidden border-2 shadow-2xl", stepColor.border, stepColor.shadow, "bg-black")}>
                        <ScrollControlledVideoPlayer 
                          src={(step as any).videoSrc}
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
            colorClasses[pageMainColor]?.border ? `border-t ${colorClasses[pageMainColor]?.border}/40` : "border-t border-brand-cyan/40"
            )}>
          <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", colorClasses[pageMainColor]?.text || "text-brand-cyan")}>
             <VibeContentRenderer content={t.nextLevelTitle} />
          </h2>
          <p className="text-lg md:text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={t.nextLevelText} />
          </p>
          <Button asChild className={cn(
             "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full text-black transition-transform transform hover:scale-105",
             "shadow-xl",
             pageMainColor === "brand-cyan" && "bg-brand-cyan hover:bg-brand-cyan/80 hover:shadow-cyan-glow/60",
             pageMainColor === "brand-green" && "bg-brand-green hover:bg-brand-green/80 hover:shadow-green-glow/60",
             pageMainColor === "brand-purple" && "bg-brand-purple hover:bg-brand-purple/80 hover:shadow-purple-glow/60"
             // Add more colors if needed, or a default
            // !colorClasses[pageMainColor] && "bg-primary hover:bg-primary/80" // Example default
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