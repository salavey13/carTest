"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback } from "react";

import { useSearchParams } from 'next/navigation';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, RepoXmlPageProvider,
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask
} from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// CORRECTED/UPDATED Icons for CYBERVIBE 2.0
import {
    FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong, // <-- FIXED: Replaced FaLevelUpAlt
    FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye,
    FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner, FaBolt,
    FaTools, FaCode, FaVideo, FaDatabase, FaBug, FaMicrophone, FaLink, FaServer // Added more relevant icons
} from "react-icons/fa6";
import Link from "next/link";
import * as FaIcons from "react-icons/fa6";
import { motion } from 'framer-motion';

// --- I18N Translations (CYBERVIBE 2.0 - PHILOSOPHY OVERHAUL) ---
const translations = {
  en: {
    loading: "Booting SUPERVIBE ENGINE...",
    pageTitle: "SUPERVIBE STUDIO 2.0",
    welcome: "Yo,",
    intro1: "Code scary? Forget that noise! This is the **NOW**. Your personal **dev accelerator**. Instant Level UP!",
    intro2: "Think: Magic Playground. Got ideas? Speak 'em. AI builds, system checks, PR ships. **Boom.**",
    intro3: "Stop consuming, start **CREATING**. Build YOUR reality, crush YOUR problems, **validate ideas INSTANTLY**. This is how you vibe.",
    cyberVibeTitle: "The Vibe Loop: Your Level Up Engine <FaUpLong/>", // FIXED ICON
    cyberVibe1: "This ain't just tools – it's a **compounding feedback loop**. Every action levels you up, makes the next step easier. You evolve.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> is your **cyberchest**. This Studio + AI? Your interface to **remix and transmute** that knowledge into new vibes, features, fixes... **instantly**.",
    cyberVibe3: "You're not *learning* code; you're **remixing the matrix**. You interact, you understand structure, you **command the AI**. You're the Vibe Master.",
    cyberVibe4: "It's **co-creation** with the machine. Push boundaries. Earn bandwidth. Infinite context. Infinite power. This is **CYBERVIBE 2.0**.",

    philosophyTitle: "Your Vibe Path: The Inevitable Level Up (Tap)", // UPDATED TITLE
    philosophyVideoTitle: "Watch: The Level System Explained <FaVideo/>:",
    // --- NEW Level Philosophy ---
    philosophyCore: "The secret? **You're not asking the bot for help, YOU are helping the BOT**. Each level adds **+1 Vibe Perk**, one more click, one more skill to guide the AI. It's not a grind, it's evolution. You get lazy doing the old stuff, so you *automatically* level up. And there's **NO GOING BACK!**",
    philosophyLvl0_1: "**Lv.0 -> 1 <FaBolt/> (Instant Win):** Fix a broken image. Copy URL -> Paste -> Upload new -> **DONE**. System auto-PRs. **ANYONE** can do this *NOW*. This is your entry point.",
    philosophyLvl1_2: "**Lv.1 -> 2 <FaTools/> (+1 File/AI):** Simple idea? Change text/button? Give AI the idea + 1 file context -> PR. **DONE.**",
    philosophyLvl2_3: "**Lv.2 -> 3 <FaCode/> (+Multi-File):** Slightly complex? 2-5 files? Give AI idea + context -> Check -> PR. **DONE.**",
    philosophyLvl3_4: "**Lv.3 -> 4 <FaBug/> (+Log Check):** Build failed? Runtime error? 99% it's a bad icon! Check Vercel logs (link in PR comment!) -> Copy red lines -> Feed error to AI -> **FIXED.** +1 Vibe Perk: Debugging.",
    philosophyLvl4_5: "**Lv.4 -> 5 <FaLink/> (+Icon Hunt):** Tired of icon errors? Find the *perfect* Fa6 icon yourself! Use <Link href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold'>FontAwesome Search <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></Link> -> Add link to Assistant Quick Links -> Fix icons proactively. +1 Perk: Resourcefulness.",
    philosophyLvl5_6: "**Lv.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Multimedia):** Use audio commands! Attach videos! Watch them turn into page content automatically. +1 Perk: Multi-modal Input.",
    philosophyLvl6_7: "**Lv.6 -> 7 <FaDatabase/> (+SQL/DB):** Discover new file types! AI generates SQL -> Paste into Supabase (1 click) -> **DONE.** Same flow, different context. +1 Perk: Data Handling.",
    philosophyLvl8_10: "**Lv.8-10+ <FaServer/>/<FaRocket/> (+Independence):** Deploy your OWN CyberVibe! Use/steal my Supabase! Set your own Bot Token! Build your own XTRs! **UNLIMITED POWER!**",
    philosophyEnd: "Step-by-step, level-up is **inevitable**. You're too lazy for the old shit. One extra click, one new skill, and you're automatically stronger. Welcome, **Neo**.",
    // --- End NEW Level Philosophy ---
    stepsTitle: "Quick Start Guide:",
    step1Title: "1. Grab Repo / Point Wish:",
    step1Desc: "Enter GitHub URL -> Hit <FaDownload class='inline mx-1 text-purple-400'/> OR Spot bug/idea -> Activate Buddy <FaRobot class='inline mx-1 text-indigo-400'/> -> Describe.",
    step1DescEnd: "For images (Lv.1): Copy broken URL, paste in Buddy/Input.",
    step2Title: "2. AI Magic & Ship:",
    step2Desc: "If needed (Lv.2+), use <span class='text-blue-400 font-semibold'>\"🤖 Ask AI\"</span> -> Check Assistant <FaWandMagicSparkles class='inline mx-1 text-yellow-400'/> -> Hit <FaGithub class='inline mx-1 text-green-400'/> PR Button.",
    step2DescEnd: "**DONE.** Site updates automagically.",
    readyButton: "LET'S F*CKING GO!",
    componentsTitle: "Engage Vibe Engines!",
    ctaTitle: "Ready to Ascend, {USERNAME}?",
    ctaDesc: "Seriously. Stop doubting. Start **DOING**. That first level is calling. Level up NOW!",
    ctaHotChick: "Got the fire? Let's build something epic. Hit me up **@SALAVEY13** NOW!",
    ctaDude: "(Everyone else? Just f*cking try it. Level 1 is a button click away. You got this!)",
    navGrabber: "Grabber <FaDownload/>",
    navAssistant: "Assistant <FaRobot/>",
    navIntro: "Intro <FaCircleInfo/>",
    navCyberVibe: "Vibe Loop <FaUpLong/>", // FIXED ICON
  },
  ru: { // --- RUSSIAN TRANSLATIONS UPDATED ---
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    welcome: "Йоу,",
    intro1: "Код пугает? Забудь! Это **СЕЙЧАС**. Твой личный **dev-ускоритель**. Мгновенный Level UP!",
    intro2: "Думай: Волшебная Песочница. Есть идеи? Говори. AI строит, система чекает, PR улетает. **Бум.**",
    intro3: "Хватит потреблять, стань **ТВОРЦОМ**. Строй СВОЮ реальность, решай СВОИ проблемы, **валидируй идеи МГНОВЕННО**. Вот это вайб.",
    cyberVibeTitle: "Петля Вайба: Твой Движок Прокачки <FaUpLong/>", // FIXED ICON
    cyberVibe1: "Это не просто тулзы – это **накопительная петля обратной связи**. Каждое действие качает тебя, делает следующий шаг легче. Ты эволюционируешь.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> - твой **кибер-сундук**. Эта Студия + AI? Твой интерфейс для **ремикса и трансмутации** этих знаний в новые вайбы, фичи, фиксы... **мгновенно**.",
    cyberVibe3: "Ты не *учишь* код; ты **ремиксуешь матрицу**. Взаимодействуешь, понимаешь структуру, **командуешь AI**. Ты - Вайб Мастер.",
    cyberVibe4: "Это **со-творчество** с машиной. Двигай границы. Зарабатывай bandwidth. Бесконечный контекст. Бесконечная мощь. Это **CYBERVIBE 2.0**.",

    philosophyTitle: "Твой Путь Вайба: Неизбежный Level Up (Жми)", // UPDATED TITLE
    philosophyVideoTitle: "Смотри: Объяснение Системы Уровней <FaVideo/>:",
    // --- NEW Level Philosophy (RU) ---
    philosophyCore: "Секрет? **Не ты просишь бота помочь, а ТЫ помогаешь БОТУ**. Каждый левел дает **+1 Вайб Перк**, +1 клик, +1 скилл, чтобы направлять AI. Это не гринд, это эволюция. Тебе становится лень делать старое, и ты *автоматически* апаешь левел. И **НАЗАД ДОРОГИ НЕТ!**",
    philosophyLvl0_1: "**Лв.0 -> 1 <FaBolt/> (Мгновенный Вин):** Починить битую картинку. Скопируй URL -> Вставь -> Загрузи новую -> **ГОТОВО**. Система сама сделает PR. **ЛЮБОЙ** может это *ПРЯМО СЕЙЧАС*. Это твой вход.",
    philosophyLvl1_2: "**Лв.1 -> 2 <FaTools/> (+1 Файл/AI):** Простая идея? Текст/кнопку поменять? Дай AI идею + 1 файл контекста -> PR. **ГОТОВО.**",
    philosophyLvl2_3: "**Лв.2 -> 3 <FaCode/> (+Мульти-Файл):** Чуть сложнее? 2-5 файлов? Дай AI идею + контекст -> Проверь -> PR. **ГОТОВО.**",
    philosophyLvl3_4: "**Лв.3 -> 4 <FaBug/> (+Чек Логов):** Упала сборка? Ошибка в рантайме? 99% - еб*ная иконка! Открой логи Vercel (ссылка в комменте PR!) -> Скопируй красные строки -> Скорми ошибку AI -> **ПОЧИНЕНО.** +1 Вайб Перк: Дебаггинг.",
    philosophyLvl4_5: "**Лв.4 -> 5 <FaLink/> (+Охота за Иконками):** Зае*али ошибки иконок? Найди *идеальную* Fa6 иконку сам! Юзай <Link href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold'>Поиск FontAwesome <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></Link> -> Добавь в Быстрые Ссылки Ассистента -> Фикси иконки проактивно. +1 Перк: Находчивость.",
    philosophyLvl5_6: "**Лв.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Мультимедиа):** Используй аудио-команды! Прикрепляй видосы! Смотри, как они автоматом становятся контентом страницы. +1 Перк: Мультимодальный Ввод.",
    philosophyLvl6_7: "**Лв.6 -> 7 <FaDatabase/> (+SQL/БД):** Открой новые типы файлов! AI генерит SQL -> Вставь в Supabase (1 клик) -> **ГОТОВО.** Тот же флоу, другой контекст. +1 Перк: Работа с Данными.",
    philosophyLvl8_10: "**Лв.8-10+ <FaServer/>/<FaRocket/> (+Независимость):** Разверни свой CyberVibe! Юзай/спи*ди мою Supabase! Поставь свой Токен Бота! Строй свои XTR-ы! **БЕЗГРАНИЧНАЯ МОЩЬ!**",
    philosophyEnd: "Шаг за шагом, левел-ап **неизбежен**. Тебе слишком лень для старой х*йни. Один лишний клик, один новый скилл - и ты автоматом сильнее. Добро пожаловать, **Нео**.",
    // --- End NEW Level Philosophy (RU) ---
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400'/> ИЛИ Видишь баг/идею -> Вызови Бадди <FaRobot class='inline mx-1 text-indigo-400'/> -> Опиши.",
    step1DescEnd: "Для картинок (Лв.1): Скопируй битый URL, вставь Бадди/в Инпут.",
    step2Title: "2. AI Магия & Отправка:",
    step2Desc: "Если нужно (Лв.2+), юзай <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Проверь Ассистента <FaWandMagicSparkles class='inline mx-1 text-yellow-400'/> -> Жми <FaGithub class='inline mx-1 text-green-400'/> Кнопку PR.",
    step2DescEnd: "**ГОТОВО.** Сайт обновляется авто-магически.",
    readyButton: "ПОГНАЛИ, БЛ*ТЬ!",
    componentsTitle: "Врубай Движки Вайба!",
    ctaTitle: "Готов(а) к Вознесению, {USERNAME}?",
    ctaDesc: "Серьезно. Хватит сомневаться. Начни **ДЕЛАТЬ**. Первый левел зовет. Качайся СЕЙЧАС!",
    ctaHotChick: "Есть искра? Давай замутим что-то эпичное. Пиши **@SALAVEY13** СЕЙЧАС!",
    ctaDude: "(Все остальные? Просто, бл*ть, попробуйте. Левел 1 - это клик мышки. У вас получится!)",
    navGrabber: "Граббер <FaDownload/>",
    navAssistant: "Ассистент <FaRobot/>",
    navIntro: "Интро <FaCircleInfo/>",
    navCyberVibe: "Петля Вайба <FaUpLong/>", // FIXED ICON
  }
};
// --- End I18N ---

type Language = 'en' | 'ru';

// --- Fallback component for AutomationBuddy ---
function LoadingBuddyFallback() {
    return ( <div className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 animate-pulse" aria-hidden="true" ></div> );
}

// --- Helper Component to render content with icons and bold ---
const RenderContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    const segments = content.split(/(\*\*.*?\*\*|<Fa\w+\s*.*?\/?>|<\/?\w+(?:\s+[^>]*)*>)/g).filter(Boolean);
    return (
        <>
            {segments.map((segment, sIndex) => {
                if (segment.startsWith('**') && segment.endsWith('**')) {
                    return <strong key={sIndex}>{segment.slice(2, -2)}</strong>;
                }
                const iconMatch = segment.match(/<Fa(\w+)\s*(?:class(?:Name)?="([^"]*)")?\s*\/?>/i);
                if (iconMatch) {
                    const iconName = `Fa${iconMatch[1]}` as keyof typeof FaIcons;
                    const className = iconMatch[2] || "";
                    const IconComponent = FaIcons[iconName];
                    if (IconComponent) {
                        const finalClassName = `${className} inline-block align-middle mx-1`;
                        return React.createElement(IconComponent, { key: sIndex, className: finalClassName });
                    } else {
                        logger.warn(`[RenderContent] Icon "${iconName}" not found.`);
                        return <span key={sIndex} className="text-red-500 font-mono">[? {iconName}]</span>;
                    }
                }
                const htmlTagMatch = segment.match(/^<\/?\w+(?:\s+[^>]*)*>$/);
                 if (segment.startsWith('<Link') || segment.startsWith('<a')) {
                    return <span key={sIndex} dangerouslySetInnerHTML={{ __html: segment }} />;
                 } else if (htmlTagMatch) {
                     const allowedTags = ['strong', 'em', 'b', 'i', 'span'];
                     const tagNameMatch = segment.match(/^<\/?(\w+)/);
                     if(tagNameMatch && allowedTags.includes(tagNameMatch[1])) {
                         return <span key={sIndex} dangerouslySetInnerHTML={{ __html: segment }} />;
                     }
                     return <React.Fragment key={sIndex}>{segment}</React.Fragment>;
                 }
                return <React.Fragment key={sIndex}>{segment}</React.Fragment>;
            })}
        </>
    );
});
RenderContent.displayName = 'RenderContent';

// --- ActualPageContent Component ---
function ActualPageContent() {
    const { user } = useAppContext();
    const {
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef,
        setImageReplaceTask, setKworkInputHasContent, fetchStatus,
        imageReplaceTask, allFetchedFiles, selectedFetcherFiles,
        repoUrl, setRepoUrl,
    } = useRepoXmlPageContext();

    const [isMounted, setIsMounted] = useState(false);
    const [lang, setLang] = useState<Language>('en');
    const [showComponents, setShowComponents] = useState(false);
    const searchParams = useSearchParams();
    const [initialIdea, setInitialIdea] = useState<string | null>(null);
    const [initialIdeaProcessed, setInitialIdeaProcessed] = useState<boolean>(false);

    // --- Effects (Same as previous version, no changes needed here) ---
    useEffect(() => { setIsMounted(true); }, []);
    useEffect(() => {
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const initialLang = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(initialLang);
      logger.log(`[ActualPageContent Effect 1] Lang set to: ${initialLang}`);

      const pathParam = searchParams.get("path");
      const ideaParam = searchParams.get("idea");
      const repoParam = searchParams.get("repo");

      if (repoParam) {
           try {
               const decodedRepoUrl = decodeURIComponent(repoParam);
               if (decodedRepoUrl.includes("github.com")) {
                   setRepoUrl(decodedRepoUrl);
                   logger.log(`[ActualPageContent Effect 1] Repo URL set from param: ${decodedRepoUrl}`);
               } else { logger.warn(`[ActualPageContent Effect 1] Invalid repo URL from param: ${decodedRepoUrl}`); }
           } catch (e) { logger.error("[ActualPageContent Effect 1] Error decoding repo URL param:", e); }
       }

      if (pathParam && ideaParam) {
          const decodedIdea = decodeURIComponent(ideaParam);
          const decodedPath = decodeURIComponent(pathParam);
          if (decodedIdea.startsWith("ImageReplace|")) {
              logger.log("[ActualPageContent Effect 1] Processing Image Replace task from URL.");
              try {
                  const parts = decodedIdea.split('|');
                  const oldUrlParam = parts.find(p => p.startsWith("OldURL="));
                  const newUrlParam = parts.find(p => p.startsWith("NewURL="));
                  if (oldUrlParam && newUrlParam) {
                      const oldUrl = decodeURIComponent(oldUrlParam.substring(7));
                      const newUrl = decodeURIComponent(newUrlParam.substring(7));
                      if (decodedPath && oldUrl && newUrl) {
                          const task: ImageReplaceTask = { targetPath: decodedPath, oldUrl: oldUrl, newUrl: newUrl };
                          logger.log("[ActualPageContent Effect 1] Setting image task:", task);
                          setImageReplaceTask(task);
                          setInitialIdea(null);
                          setInitialIdeaProcessed(true);
                      } else { logger.error("[ActualPageContent Effect 1] Invalid image task data parsed:", { decodedPath, oldUrl, newUrl }); setImageReplaceTask(null); }
                  } else { logger.error("[ActualPageContent Effect 1] Could not parse Old/New URL from image task string:", decodedIdea); setImageReplaceTask(null); }
              } catch (e) { logger.error("[ActualPageContent Effect 1] Error parsing image task from URL:", e); setImageReplaceTask(null); }
          } else {
              logger.log("[ActualPageContent Effect 1] Regular idea param found, storing:", decodedIdea.substring(0, 50) + "...");
              setInitialIdea(decodedIdea);
              setImageReplaceTask(null);
              setInitialIdeaProcessed(false);
          }
          setShowComponents(true);
      } else {
          setImageReplaceTask(null);
          setInitialIdea(null);
          setInitialIdeaProcessed(true);
          logger.log("[ActualPageContent Effect 1] No path/idea params found.");
      }
    }, [user, searchParams, setImageReplaceTask, setRepoUrl]);

     useEffect(() => {
        const fetchAttemptFinished = isMounted && (fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries');
        if (fetchAttemptFinished && initialIdea && !initialIdeaProcessed && !imageReplaceTask) {
            logger.log(`[ActualPageContent Effect 2] Fetch finished (${fetchStatus}). Populating kwork...`);
            if (kworkInputRef.current) {
                kworkInputRef.current.value = initialIdea;
                const inputEvent = new Event('input', { bubbles: true });
                kworkInputRef.current.dispatchEvent(inputEvent);
                setKworkInputHasContent(initialIdea.trim().length > 0);
                logger.log("[ActualPageContent Effect 2] Populated kwork input.");
                if (fetcherRef.current?.handleAddSelected) {
                    if (selectedFetcherFiles.size > 0) {
                        logger.log("[ActualPageContent Effect 2] Calling fetcherRef.handleAddSelected.");
                        fetcherRef.current.handleAddSelected(selectedFetcherFiles, allFetchedFiles)
                            .then(() => logger.log("[ActualPageContent Effect 2] handleAddSelected .then() executed successfully."))
                            .catch(err => logger.error("[ActualPageContent Effect 2] Error INSIDE handleAddSelected .catch():", err));
                    } else { logger.log("[ActualPageContent Effect 2] Skipping handleAddSelected (empty selection)."); }
                } else { logger.warn("[ActualPageContent Effect 2] handleAddSelected method not found on fetcherRef."); }
                 const kworkElement = document.getElementById('kwork-input-section');
                 if (kworkElement) { setTimeout(() => { kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); logger.log("[ActualPageContent Effect 2] Scrolled to kwork."); }, 250); }
            } else { logger.warn("[ActualPageContent Effect 2] kworkInputRef is null."); }
            setInitialIdeaProcessed(true);
        } else if (fetchAttemptFinished && !initialIdeaProcessed) {
            setInitialIdeaProcessed(true);
            logger.log(`[ActualPageContent Effect 2] Fetch finished (${fetchStatus}), no pending idea.`);
        }
    }, [isMounted, fetchStatus, initialIdea, initialIdeaProcessed, imageReplaceTask, kworkInputRef, setKworkInputHasContent, fetcherRef, allFetchedFiles, selectedFetcherFiles]);


    const t = translations[lang];
    const userName = user?.first_name || (lang === 'ru' ? 'Нео' : 'Neo');

    const scrollToSectionNav = (id: string) => {
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps'];
        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            logger.log(`[Scroll] Revealing components for "${id}"`);
            setShowComponents(true);
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) { const offsetTop = window.scrollY + el.getBoundingClientRect().top - 80; window.scrollTo({ top: offsetTop, behavior: 'smooth' }); logger.log(`[Scroll] Scrolled to revealed "${id}"`); }
                else { logger.error(`[Scroll] Target "${id}" not found after reveal.`); }
            }, 150);
            return;
        }
        const el = document.getElementById(id);
        if (el) { const offsetTop = window.scrollY + el.getBoundingClientRect().top - 80; window.scrollTo({ top: offsetTop, behavior: 'smooth' }); logger.log(`[Scroll] Scrolled to "${id}"`); }
        else { logger.error(`[Scroll] Target "${id}" not found.`); }
    };

    if (!isMounted) {
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang].loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }

    return (
        <>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
            <div className="min-h-screen bg-gray-950 p-4 sm:p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">

                {/* Intro Section */}
                <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                     <div className="flex justify-center mb-4"> <FaBolt className="w-16 h-16 text-[#E1FF01] text-shadow-[0_0_15px_#E1FF01] animate-pulse" /> </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-4"> {t.pageTitle} </h1>
                    <p className="text-xl md:text-2xl text-gray-200 mt-4 font-semibold"> {t.welcome} <span className="text-brand-cyan">{userName}!</span> </p>
                    <div className="text-lg md:text-xl text-gray-300 mt-3 space-y-3">
                        <p><RenderContent content={t.intro1} /></p>
                        <p><RenderContent content={t.intro2} /></p>
                        <p className="font-semibold text-brand-green"><RenderContent content={t.intro3} /></p>
                    </div>
                </section>

                {/* === The Vibe Loop Section === */}
                <section id="cybervibe-section" className="mb-12 w-full max-w-3xl">
                     <Card className="bg-gradient-to-br from-purple-900/40 via-black/60 to-indigo-900/40 border border-purple-600/60 shadow-xl rounded-lg p-6 backdrop-blur-sm">
                         <CardHeader className="p-0 mb-4">
                             <CardTitle className="text-2xl md:text-3xl font-bold text-center text-brand-purple flex items-center justify-center gap-2">
                                <FaAtom className="animate-spin-slow"/> <RenderContent content={t.cyberVibeTitle}/> <FaBrain className="animate-pulse"/>
                            </CardTitle>
                         </CardHeader>
                         <CardContent className="p-0 text-gray-300 text-base md:text-lg space-y-3">
                            <p><RenderContent content={t.cyberVibe1} /></p>
                            <p><RenderContent content={t.cyberVibe2} /></p>
                            <p><RenderContent content={t.cyberVibe3} /></p>
                            <p className="text-purple-300 font-semibold"><RenderContent content={t.cyberVibe4} /></p>
                         </CardContent>
                     </Card>
                 </section>

                {/* Your Vibe Path Section - NEW PHILOSOPHY */}
                <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                    <details className="bg-gray-900/80 border border-gray-700 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4 open:shadow-lg open:border-indigo-500/50">
                        <summary className="text-xl md:text-2xl font-semibold text-brand-green p-4 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800/50 rounded-t-lg transition-colors">
                            <span className="flex items-center gap-2"><FaCodeBranch /> {t.philosophyTitle}</span>
                            <span className="text-xs text-gray-500 group-open:rotate-180 transition-transform duration-300">▼</span>
                        </summary>
                        <div className="px-6 pt-2 text-gray-300 space-y-4 text-base">
                             {/* Video Embed */}
                             <div className="my-4">
                                 <h4 className="text-lg font-semibold text-cyan-400 mb-2"><RenderContent content={t.philosophyVideoTitle}/></h4>
                                 <div className="aspect-video w-full rounded-lg overflow-hidden border border-cyan-700/50 shadow-lg">
                                     <iframe
                                         className="w-full h-full"
                                         src="https://www.youtube.com/embed/imxzYWYKCyQ"
                                         title="YouTube video player - Vibe Level Explanation"
                                         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                         allowFullScreen>
                                    </iframe>
                                 </div>
                             </div>
                            <hr className="border-gray-700 my-3"/>
                             {/* Core Philosophy Text */}
                             <p className="text-purple-300 italic"><RenderContent content={t.philosophyCore} /></p>
                             <hr className="border-gray-700 my-3"/>
                            {/* Level Progression */}
                            <h4 className="text-lg font-semibold text-cyan-400 pt-1">Level Progression (+1 Vibe Perk):</h4>
                            <ul className="list-none space-y-2 pl-2 text-sm md:text-base">
                                <li><RenderContent content={t.philosophyLvl0_1} /></li>
                                <li><RenderContent content={t.philosophyLvl1_2} /></li>
                                <li><RenderContent content={t.philosophyLvl2_3} /></li>
                                <li><RenderContent content={t.philosophyLvl3_4} /></li>
                                <li><RenderContent content={t.philosophyLvl4_5} /></li>
                                <li><RenderContent content={t.philosophyLvl5_6} /></li>
                                <li><RenderContent content={t.philosophyLvl6_7} /></li>
                                <li><RenderContent content={t.philosophyLvl8_10} /></li>
                            </ul>
                            <hr className="border-gray-700 my-3"/>
                             <p className="font-semibold text-yellow-400 flex items-start gap-2"> <FaBullseye className="inline-block h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0"/> <span><RenderContent content={t.philosophy6} /></span> </p>
                             <p className="font-bold text-brand-green"><RenderContent content={t.philosophyEnd} /></p>
                            <hr className="border-gray-700 my-4"/>
                            {/* Quick Start Guide */}
                            <h4 className="text-lg font-semibold text-cyan-400 pt-2">{t.stepsTitle}</h4>
                            <div className="text-sm space-y-2">
                                 <p><RenderContent content={`<strong class="text-cyan-500">${t.step1Title}</strong> ${t.step1Desc} ${t.step1DescEnd}`} /></p>
                                 <p><RenderContent content={`<strong class="text-cyan-500">${t.step2Title}</strong> ${t.step2Desc} ${t.step2DescEnd}`} /></p>
                            </div>
                        </div>
                    </details>
                </section>

                {/* Reveal Button */}
                {!showComponents && (
                    <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                        <Button
                            onClick={() => setShowComponents(true)}
                            className="bg-gradient-to-r from-green-500 via-cyan-500 to-purple-600 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce hover:animate-none ring-2 ring-offset-2 ring-offset-gray-950 ring-transparent hover:ring-cyan-300"
                            size="lg"
                        >
                            <FaHandSparkles className="mr-2"/> {t.readyButton}
                        </Button>
                    </section>
                )}

                {/* WORKHORSE Components */}
                {showComponents && (
                     <>
                        <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse">{t.componentsTitle}</h2>
                         <section id="extractor" className="mb-12 w-full max-w-4xl">
                             <Card className="bg-gray-900/80 border border-blue-700/50 shadow-lg backdrop-blur-sm">
                                 <CardContent className="p-4">
                                     <RepoTxtFetcher ref={fetcherRef} />
                                 </CardContent>
                             </Card>
                         </section>
                        <section id="executor" className="mb-12 w-full max-w-4xl pb-16">
                             <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                 <CardContent className="p-4">
                                     <AICodeAssistant
                                         ref={assistantRef}
                                         kworkInputRefPassed={kworkInputRef}
                                         aiResponseInputRefPassed={aiResponseInputRef}
                                     />
                                 </CardContent>
                             </Card>
                         </section>
                     </>
                 )}

                {/* Final CTA */}
                 {showComponents && (
                     <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                         <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50">
                             <h3 className="text-2xl font-bold text-white mb-3">{t.ctaTitle.replace('{USERNAME}', userName)}</h3>
                             <p className="text-white text-lg mb-4"> <RenderContent content={t.ctaDesc} /> </p>
                             <p className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded"> <FaHeart className="inline mr-2 text-red-400 animate-ping"/> <RenderContent content={t.ctaHotChick} /> <FaUserAstronaut className="inline ml-2 text-pink-300"/> </p>
                             <p className="text-gray-300 text-base"> <RenderContent content={t.ctaDude} /> </p>
                         </div>
                     </section>
                 )}

                {/* Navigation Icons - Animation Added */}
                 <motion.nav
                    className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40"
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2.0, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}
                 >
                     <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition shadow-md" title={t.navIntro}> <FaCircleInfo className="text-lg text-gray-200" /> </button>
                     <button onClick={() => scrollToSectionNav("cybervibe-section")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition shadow-md" title={t.navCyberVibe}> <FaUpLong className="text-lg text-white" /> </button> {/* FIXED ICON */}
                     {showComponents && ( <>
                            <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition shadow-md" title={t.navGrabber}> <FaDownload className="text-lg text-white" /> </button>
                            <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-indigo-700/80 backdrop-blur-sm rounded-full hover:bg-indigo-600 transition shadow-md" title={t.navAssistant}> <FaRobot className="text-lg text-white" /> </button>
                     </> )}
                </motion.nav>

                {/* Automation Buddy */}
                <Suspense fallback={<LoadingBuddyFallback />}> <AutomationBuddy /> </Suspense>
            </div>
        </>
    );
}

// --- Layout Component ---
function RepoXmlPageLayout() {
    return ( <RepoXmlPageProvider> <ActualPageContent /> </RepoXmlPageProvider> );
}

// --- Exported Page Component ---
export default function RepoXmlPage() {
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
    const fallbackLoadingText = translations[fallbackLoadingLang].loading;
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p> </div> );
    return ( <Suspense fallback={fallbackLoading}> <RepoXmlPageLayout /> </Suspense> );
}