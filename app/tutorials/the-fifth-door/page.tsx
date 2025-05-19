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

const theFifthDoorTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 5: ::FaKey:: Пятая Дверь",
    pageSubtitle: "Агент, это финал. Ты прошел все круги обучения. Остался последний шаг – обрести ПОЛНУЮ СВОБОДУ и контроль. За этой дверью – реальный мир.",
    steps: [
      {
        id: 1,
        title: "Шаг 1: Паттерн Осознан (Снова!)",
        description: "Ты уже знаешь: Старое -> Новое -> Studio -> PR. Этот паттерн – ключ ко всему. Но чтобы им владеть в полной мере, нужна безопасная 'песочница' и полный доступ.",
        icon: "FaRecycle",
        color: "brand-pink"
      },
      {
        id: 2,
        title: "Шаг 2: Google Аккаунт – Ключ к Вселенной",
        description: "Без Google-аккаунта в 2024 – никуда. Он нужен для GitHub, для аутентификации во многих сервисах. Если у тебя его еще нет (серьезно?!), <Link href='https://accounts.google.com/signup' target='_blank' class='text-brand-blue hover:underline'>создай</Link>. Это твоя цифровая личность.",
        icon: "FaGoogle",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "Шаг 3: GitHub – Твоя Цифровая Крепость",
        description: "Зарегистрируйся на <Link href='https://github.com/signup' target='_blank' class='text-brand-blue hover:underline'>GitHub</Link> используя свой Google-аккаунт. GitHub – это место, где хранится код, где ты будешь видеть свои PR, управлять версиями. Это твой дом как разработчика.",
        icon: "FaGithub",
        color: "brand-purple"
      },
      {
        id: 4,
        title: "Шаг 4: 2FA – Щит Агента",
        description: "Безопасность превыше всего. Настрой двухфакторную аутентификацию (2FA) на GitHub. Это как дополнительный замок на твоей крепости. Используй приложение-аутентификатор (Google Authenticator, Authy и т.п.).",
        icon: "FaUserShield",
        color: "brand-green"
      },
      {
        id: 5,
        title: "Шаг 5: Пятая Дверь Открыта!",
        description: "Поздравляю, Агент! Ты полностью экипирован. У тебя есть знания (миссии 1-4), понимание (миссия 4) и теперь – безопасный, интегрированный доступ (миссия 5). Ты готов создавать, изменять и управлять своими проектами. Мир – твоя песочница. THE END... IS JUST THE BEGINNING.",
        icon: "FaDoorOpen",
        color: "brand-yellow"
      }
    ],
    nextLevelTitle: "::FaInfinity:: Ты – Повелитель Кода!",
    nextLevelText: "Все миссии пройдены. Все печати сломаны. Теперь у тебя есть всё, чтобы стать легендой. <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> ждет твоих гениальных идей. Вперёд, творить историю!",
    tryLiveButton: "::FaRocket:: К ЗВЁЗДАМ!",
    toggleButtonToWtf: "::FaPooStorm:: Включить Режим БОГА (WTF?!)",
    toggleButtonToNormal: "::FaBook:: Вернуть Скучную Инструкцию", 
  },
  wtf: {
    pageTitle: "::FaKey:: ПЯТАЯ ДВЕРЬ! ВЫХОД ИЗ МАТРИЦЫ, БЛ*ТЬ!",
    pageSubtitle: "ХВАТИТ ДРОЧИТЬ НА ЛОКАЛКЕ И СМОТРЕТЬ ЮТУБЧИК! ВРЕМЯ СТАТЬ РЕАЛЬНЫМ КИБЕР-ПАПОЙ, КОТОРЫЙ КОНТРОЛИРУЕТ СВОЙ КОД И СВОЮ ЖИЗНЬ! ЭТО ФИНАЛЬНЫЙ БОСС ОБУЧЕНИЯ – ТЫ САМ!",
    steps: [
      {
        id: 1,
        title: "ШАГ 1: 4 ШАГА? ТЫ УЖЕ БОГ ЭТОГО ДЕРЬМА!",
        description: "Старое -> Новое -> Studio -> PR. Если ты до сих пор не понял этот прикол, то тебе не сюда, братан. Это как пытаться играть в Доту без мышки. Закрывай вкладку.",
        icon: "FaRecycle",
        color: "brand-pink"
      },
      {
        id: 2,
        title: "ШАГ 2: GOOGLE АКК – ТВОЙ ПАСПОРТ В КИБЕРПАНК!",
        description: "Нет гугл-акка? Ты типа из пещеры вылез? <Link href='https://accounts.google.com/signup' target='_blank' class='text-brand-blue hover:underline'>БЕГОМ ДЕЛАТЬ!</Link> Google - это Твой ПапаРимский в Инете!",
        icon: "FaGoogle",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "ШАГ 3: GITHUB – ТВОЯ КИБЕР-БАЗА ОПЕРАЦИЙ!",
        description: "<Link href='https://github.com/signup' target='_blank' class='text-brand-blue hover:underline'>Регай GitHub</Link> через Google. Там твой код будет жить, там твои PR-чики. Это как твоя личная корпорация Arasaka, только ты тут решаешь.",
        icon: "FaGithub",
        color: "brand-purple"
      },
      {
        id: 4,
        title: "ШАГ 4: 2FA – ТВОЙ ЛИЧНЫЙ \"SANDIVISTAN\"!",
        description: "Двухфакторка на GitHub – ОБЯЗАТЕЛЬНО! Чтобы никакой netrunner не угнал твой код. Скачай Authy или Google Authenticator. Это как имплант для кибер-ниндзя – без него ты мясо.",
        icon: "FaUserShield",
        color: "brand-green"
      },
      {
        id: 5,
        title: "ШАГ 5: ДВЕРЬ ОТКРЫТА! ТЫ – JOHNNY SILVERHAND!",
        description: "ВСЁ! Ты прошел игру! У тебя есть скиллы, мозг и теперь полный доступ! Ты не просто кодер, ты – КИБЕРБОГ своего проекта! Иди и WAKE THE FUCK UP, SAMURAI! WE HAVE A CITY TO BURN!",
        icon: "FaDoorOpen",
        color: "brand-yellow"
      }
    ],
    nextLevelTitle: "::FaSatelliteDish:: ТЫ НЕ ПРОСТО В МАТРИЦЕ, ТЫ И ЕСТЬ МАТРИЦА!",
    nextLevelText: "Ты – Джонни Сильверхенд этого города. Код – твоя гитара. <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> – твоя сцена. Зажги!",
    tryLiveButton: "::FaGuitar:: ВПЕРЕД, В NIGHT CITY!",
    toggleButtonToWtf: "::FaPooStorm:: Включить Режим БОГА (WTF?!)", 
    toggleButtonToNormal: "::FaBook:: Вернуть Скучную Инструкцию", 
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
  "brand-yellow": { text: "text-brand-yellow", border: "border-brand-yellow/50", shadow: "shadow-brand-yellow/40" }, 
  "brand-lime": { text: "text-neon-lime", border: "border-neon-lime/50", shadow: "shadow-neon-lime/40" }, 
};

function TheFifthDoorTutorialContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dbUser, isAuthenticated } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger";

  const initialModeFromUrl = searchParams.get('mode') === 'wtf';
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>(initialModeFromUrl ? 'wtf' : 'ru');
  
  const t = theFifthDoorTutorialTranslations[currentMode];
  const tutorialQuestId = "the-fifth-door-mission";

  const handleTutorialCompletion = useCallback(async () => {
    if (isAuthenticated && dbUser?.user_id) {
      const result = await markTutorialAsCompleted(dbUser.user_id, tutorialQuestId);
      if (result.success && result.kiloVibesAwarded && result.kiloVibesAwarded > 0) {
        addToast(`::FaCircleCheck:: Миссия "${theFifthDoorTutorialTranslations.ru.pageTitle}" пройдена! +${result.kiloVibesAwarded} KiloVibes!`, "success");
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
    // router.replace(`/tutorials/the-fifth-door${newMode === 'wtf' ? '?mode=wtf' : ''}`, { scroll: false });
    // Per original logic, this button only appears in RU mode to go to WTF, so no need to toggle back if started in WTF
    if (newMode === 'wtf') {
      router.replace(`/tutorials/the-fifth-door?mode=wtf`, { scroll: false });
    } else {
      router.replace(`/tutorials/the-fifth-door`, { scroll: false });
    }
  };

  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (modeFromUrl !== currentMode) {
      setCurrentMode(modeFromUrl);
    }
  }, [searchParams, currentMode]);

  const stepsToRender = t.steps;
  const pageMainColorKey = "brand-yellow"; 

  return (
    <TutorialPageContainer>
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        // mainBackgroundImageUrl uses new default from RockstarHeroSection if not overridden
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png"
      >
           {/* Logic for button visibility based on original page structure */}
           {currentMode === 'ru' && (
           <Button 
            onClick={toggleMode} 
            variant="outline" 
            size="lg"
            className={cn(
              "backdrop-blur-lg transition-all duration-300 font-orbitron active:scale-95 transform hover:scale-105 focus:ring-offset-background",
              "bg-brand-pink/10 border-2 border-brand-pink text-brand-pink shadow-md shadow-brand-pink/40 hover:bg-brand-pink/20 hover:text-white hover:shadow-pink-glow focus:ring-2 focus:ring-brand-pink"
            )}
          >
            <VibeContentRenderer content={theFifthDoorTutorialTranslations.ru.toggleButtonToWtf} />
          </Button>
           )}
        {currentMode === 'wtf' && initialModeFromUrl && ( // Show "back to normal" only if started in WTF
           <Button 
            onClick={toggleMode} 
            variant="outline" 
            size="lg"
            className={cn(
              "backdrop-blur-lg transition-all duration-300 font-orbitron active:scale-95 transform hover:scale-105 focus:ring-offset-background",
              "bg-brand-blue/10 border-2 border-brand-blue text-brand-blue shadow-md shadow-brand-blue/40 hover:bg-brand-blue/20 hover:text-white hover:shadow-blue-glow focus:ring-2 focus:ring-brand-blue"
            )}
          >
            <VibeContentRenderer content={theFifthDoorTutorialTranslations.wtf.toggleButtonToNormal} />
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
        buttonLink="/repo-xml" 
        mainColorClassKey={pageMainColorKey}
      />
    </TutorialPageContainer>
  );
}

export default function TheFifthDoorPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <TheFifthDoorTutorialContent />
    </Suspense>
  );
}