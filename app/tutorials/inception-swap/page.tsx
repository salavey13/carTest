"use client";

import React, { useState, useEffect, Suspense, useCallback, useId } from 'react'; 
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import TutorialLoader from '../TutorialLoader'; 
import { useAppContext } from '@/contexts/AppContext';
import { markTutorialAsCompleted } from '@/hooks/cyberFitnessSupabase';
import { useAppToast } from '@/hooks/useAppToast';

import TutorialPageContainer from '../TutorialPageContainer';
import RockstarHeroSection from '../RockstarHeroSection';
import TutorialContentContainer from '../TutorialContentContainer';
import TutorialStepSection from '../TutorialStepSection';
import NextLevelTeaser from '../NextLevelTeaser';


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
    nextLevelText: "Ты постиг Дзен разработки на oneSitePls. Теперь ты видишь код. <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующая Миссия</Link> — твой верстак, а идеи — твои чертежи. Строй будущее!",
    tryLiveButton: "::FaTools:: В SUPERVIBE Studio",
    toggleButtonToWtf: "::FaPooStorm:: Включить Режим БОГА (WTF?!)",
  },
  wtf: {
    pageTitle: "::FaBomb:: ВСЁ ЕСТЬ КОД! WTF?!",
    pageSubtitle: "YO, WAKE UP! Эти 4 шага... ОНИ ВЕЗДЕ! Ты можешь менять ВСЁ! Это как... прикинь, в старых синглплеерных играх не было кнопки 'Сохранить'! Да, прикинь, прогресс можно было ТЕРЯТЬ! А теперь есть! И это так же просто – тут ты тоже 'сохраняешь' изменения в коде, нажимая кнопки! ЭТО РЕАЛЬНОСТЬ, ЙО!",
    steps: [
      {
        id: 1,
        title: "ШАГ 1: ЧТО? 4 ШАГА = ВСЁ!",
        description: "1. СКОПИРУЙ СТАРОЕ (код, файл, идея). 2. ПРИДУМАЙ НОВОЕ (фикс, фича, рефактор). 3. СКАЖИ СТУДИИ (дай старое, опиши новое). 4. ПРОВЕРЬ PR. ЭТО БАЗА! Как F5 в Доте, только для кода!",
        icon: "FaUniversalAccess", 
        color: "brand-pink"
      },
      {
        id: 2,
        title: "ШАГ 2: КАРТИНКИ? ИКОНКИ? ВИДЕО? Х**НЯ!",
        description: "ЭТО РАБОТАЕТ ДЛЯ ЛЮБОГО ГРЁБАНОГО КОДА, ПОНЯЛ?! РЕФАКТОРИНГ? ДА! НОВЫЕ ФИЧИ? ДА! ИСПРАВЛЕНИЕ БАГОВ? ДА, ЧЕРТ ВОЗЬМИ! Это как закуп в Доте – меняешь старый арт на новый, становишься сильнее!",
        icon: "FaBong",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "ШАГ 3: СДЕЛАЙ СВОЙ VIDEO SWAP TOOL!",
        description: "ХОЧЕШЬ VIDEO SWAP TOOL В ЧАТЕ? ЛЕГКО! СКАЖИ AI: 'ВОТ IMAGE SWAP TOOL (старый код), СДЕЛАЙ ИЗ НЕГО VIDEO SWAP TOOL (новая задача)'. БУМ! ГОТОВО! Это как скрафтить новый имба-айтем из существующих!",
        icon: "FaToolbox", 
        color: "brand-purple"
      },
      {
        id: 4,
        title: "ШАГ 4: ТЫ В МАТРИЦЕ, НЕО!",
        description: "ТЫ ИСПОЛЬЗУЕШЬ ИНСТРУМЕНТЫ, ЧТОБЫ ДЕЛАТЬ ИНСТРУМЕНТЫ! ТЫ И ЕСТЬ КОД! ТЫ МОЖЕШЬ ВСЁ! ААААА! WAKE THE FUCK UP, SAMURAI! WE HAVE A CITY TO BURN! Пора ломать трон кодинга!",
        icon: "FaFire", 
        color: "brand-green"
      }
    ],
    nextLevelTitle: "::FaSatelliteDish:: ТЫ ПОДКЛЮЧЕН К ИСТОЧНИКУ!",
    nextLevelText: "РЕАЛЬНОСТЬ – ЭТО КОД. ТЫ – ЕГО АРХИТЕКТОР. <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующая Миссия</Link> – ТВОЯ КИБЕРДЕКА. ВРЕМЯ ЛОМАТЬ СИСТЕМУ!",
    tryLiveButton: "::FaLaptopCode:: В БОЙ!",
    toggleButtonToNormal: "::FaBook:: Вернуть Скучную Инструкцию", 
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
  "brand-lime": { text: "text-neon-lime", border: "border-neon-lime/50", shadow: "shadow-neon-lime/40" }, 
};

function InceptionSwapTutorialContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dbUser, isAuthenticated } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger";

  const initialModeFromUrl = searchParams.get('mode') === 'wtf';
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>(initialModeFromUrl ? 'wtf' : 'ru');
  
  const t = inceptionSwapTutorialTranslations[currentMode];
  const tutorialQuestId = "inception-swap-mission";

  const handleTutorialCompletion = useCallback(async () => {
    if (isAuthenticated && dbUser?.user_id) {
      const result = await markTutorialAsCompleted(dbUser.user_id, tutorialQuestId);
      if (result.success && result.kiloVibesAwarded && result.kiloVibesAwarded > 0) {
        addToast(`::FaCircleCheck:: Миссия "${inceptionSwapTutorialTranslations.ru.pageTitle}" пройдена! +${result.kiloVibesAwarded} KiloVibes!`, "success");
      }
      result.newAchievements?.forEach(ach => {
        addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
      });
    }
  }, [isAuthenticated, dbUser, addToast, tutorialQuestId]);

  useEffect(() => {
    handleTutorialCompletion();
  }, [handleTutorialCompletion]);

  const toggleMode = () => {
    const newMode = currentMode === 'ru' ? 'wtf' : 'ru';
    setCurrentMode(newMode);
    if (newMode === 'wtf') {
      router.replace(`/tutorials/inception-swap?mode=wtf`);
    }
  };

  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (modeFromUrl !== currentMode) {
      setCurrentMode(modeFromUrl);
    }
  }, [searchParams, currentMode]);

  const stepsToRender = t.steps;
  const pageMainColorKey = "brand-lime"; 

  return (
    <TutorialPageContainer>
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        mainBackgroundImageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//Screenshot_2025-05-17-11-07-09-401_org.telegram.messenger.jpg" 
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png"
      >
        {!initialModeFromUrl && currentMode === 'ru' && (
           <Button 
            onClick={toggleMode} 
            variant="outline" 
            size="lg"
            className={cn(
              "bg-card/80 backdrop-blur-md hover:bg-pink-600/30 transition-all duration-200 font-semibold shadow-xl hover:shadow-pink-600/50 focus:ring-offset-background active:scale-95 transform hover:scale-105",
              "border-pink-500/80 text-pink-400 hover:text-pink-200 focus:ring-2 focus:ring-pink-500" 
            )}
          >
            <VibeContentRenderer content={inceptionSwapTutorialTranslations.ru.toggleButtonToWtf} />
          </Button>
          )}
        {initialModeFromUrl && currentMode === 'wtf' && (
           <Button 
            onClick={toggleMode} 
            variant="outline" 
            size="lg"
            className={cn(
              "bg-card/80 backdrop-blur-md hover:bg-blue-600/30 transition-all duration-200 font-semibold shadow-xl hover:shadow-blue-600/50 focus:ring-offset-background active:scale-95 transform hover:scale-105",
              "border-blue-500/80 text-blue-400 hover:text-blue-200 focus:ring-2 focus:ring-blue-500"
            )}
          >
            <VibeContentRenderer content={inceptionSwapTutorialTranslations.wtf.toggleButtonToNormal} />
          </Button>
        )}
      </RockstarHeroSection>

      <div id={heroTriggerId} style={{ height: '250vh' }} aria-hidden="true" />

      <TutorialContentContainer className="relative">
        <div className="space-y-12 md:space-y-16">
          {stepsToRender.map((step, index) => {
            const stepColorData = colorClasses[step.color as keyof typeof colorClasses] || colorClasses["brand-purple"];

            return (
              <TutorialStepSection 
                key={step.id} 
                className={cn(index > 0 && "pt-12 md:pt-16")} 
                isLastStep={index === stepsToRender.length -1}
              >
                <div className={cn(
                  "flex flex-col items-center text-center gap-4 md:gap-6",
                )}>
                  <div className={cn("space-y-3 flex flex-col items-center justify-center w-full max-w-2xl")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center justify-center gap-3", stepColorData.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <div className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-invert prose-sm md:prose-base max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:my-3 prose-a:text-brand-blue hover:prose-a:text-brand-cyan">
                      <VibeContentRenderer content={step.description} />
                    </div>
                  </div>
                </div>
              </TutorialStepSection>
            );
          })}
        </div>
      </TutorialContentContainer>
      
      <NextLevelTeaser 
        title={t.nextLevelTitle}
        text={t.nextLevelText}
        buttonText={t.tryLiveButton}
        buttonLink="/start-training" 
        mainColorClassKey={pageMainColorKey}
      />
    </TutorialPageContainer>
  );
}

export default function InceptionSwapTutorialPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <InceptionSwapTutorialContent />
    </Suspense>
  );
}