"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback } from "react";

import { useSearchParams } from 'next/navigation'; // Keep this import if used within ActualPageContent
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, RepoXmlPageProvider,
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask
    // Provider no longer needed here for refs
} from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong, FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye, FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner, FaLevelUpAlt, FaBolt, FaTools, FaCode } from "react-icons/fa"; // Added FaLevelUpAlt, FaBolt, FaTools, FaCode etc. Import all Fa6 below
import Link from "next/link";
import * as FaIcons from "react-icons/fa6"; // Import all for dynamic render helper

// --- I18N Translations (CYBERVIBE 2.0 Overhaul) ---
const translations = {
  en: {
    loading: "Booting SUPERVIBE ENGINE...",
    pageTitle: "SUPERVIBE STUDIO 2.0",
    welcome: "Yo,",
    intro1: "Code scary? Forget that noise! This is the **NOW**. Your personal **dev accelerator**. Instant Level UP!",
    intro2: "Think: Magic Playground. Got ideas? Speak 'em. AI builds, system checks, PR ships. **Boom.**",
    intro3: "Stop consuming, start **CREATING**. Build YOUR reality, crush YOUR problems, **validate ideas INSTANTLY**. This is how you vibe.",
    cyberVibeTitle: "The Vibe Loop: Your Level Up Engine <FaLevelUpAlt/>",
    cyberVibe1: "This ain't just tools – it's a **compounding feedback loop**. Every action levels you up, makes the next step easier.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> becomes your infinite **cyberchest** of knowledge. This Studio + AI? Your keys to **remix and transmute** that knowledge into new vibes, features, fixes... **instantly**.",
    cyberVibe3: "You're not just *learning* code; you're **remixing the damn matrix** on the fly. You see the structure, you interact, you **evolve**.",
    cyberVibe4: "It's **co-creation** with the machine mind. Push boundaries. Earn your bandwidth. The goal? Infinite context. Infinite power. This is **CYBERVIBE 2.0**.",
    philosophyTitle: "Your Vibe Path: Level Up Guide (Tap)",
    philosophy1: "This is about unlocking **YOUR** potential. Build **YOUR** world. Stop chasing, start **creating**. You ARE the niche.",
    philosophy2: "AI isn't replacement, it's your **ultimate leverage**. Your force multiplier. Use it (ideas in <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev Path <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></Link>) or get left behind.",
    philosophy3: "**LEVEL 1: INSTANT WIN!** Got a broken image link? Copy, paste, upload new one. **DONE.** Auto-magic fixes it. **You can do this NOW.**",
    philosophy4: "**LEVEL 2: Simple Fix:** Need to change text? Button style? Tell the AI Helper. **DONE.** System guides you.",
    philosophy5: "**LEVEL 3+: Multi-File Magic:** More complex? Change logic? AI helps, you guide. Step-by-step, you'll handle 5, 10, 20+ files like a pro.",
    philosophy6: "**Validate FAST!** Use AI to check ideas *before* code (<Link href='/selfdev#validation' class='text-brand-yellow hover:underline font-semibold'>SelfDev Validation <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></Link>). Kill bad vibes quick.",
    philosophy7: "This Studio makes it easy. **Grab code -> Point -> Wish -> AI Magic -> Ship it!**",
    stepsTitle: "Quick Start Guide:",
    step1Title: "1. Grab Repo / Point Wish:",
    step1Desc: "Enter GitHub URL -> Hit <FaDownload class='inline mx-1 text-purple-400'/> OR Just spot a bug/idea on a page -> Activate Buddy <FaRobot class='inline mx-1 text-indigo-400'/> -> Describe.",
    step1DescEnd: "For images: Copy broken URL, paste in Buddy/Input.", // Simplified image step hint
    step2Title: "2. AI Magic & Ship:",
    step2Desc: "If needed, use <span class='text-blue-400 font-semibold'>\"🤖 Ask AI\"</span> -> Check result in Assistant <FaWandMagicSparkles class='inline mx-1 text-yellow-400'/> -> Hit <FaGithub class='inline mx-1 text-green-400'/> to create/update PR.",
    step2DescEnd: "**DONE.** Site updates automagically.", // Emphasize automation
    readyButton: "LET'S F*CKING GO!", // More energy
    componentsTitle: "Engage Vibe Engines!", // New title
    ctaTitle: "Ready to Ascend, {USERNAME}?", // Updated CTA
    ctaDesc: "Seriously. Stop doubting. Start **DOING**. That first level is calling.",
    ctaHotChick: "Got the fire? Let's build something epic. Hit me up **@SALAVEY13** NOW!", // Kept original contact info
    ctaDude: "(Everyone else? Just f*cking try it. You got this!)", // More encouraging
    navGrabber: "Grabber <FaDownload/>", // Added icon
    navAssistant: "Assistant <FaRobot/>", // Added icon
    navIntro: "Intro <FaCircleInfo/>",
    navCyberVibe: "Vibe Loop <FaLevelUpAlt/>", // Updated name
  },
  ru: {
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    welcome: "Йоу,",
    intro1: "Код пугает? Забудь! Это **СЕЙЧАС**. Твой личный **dev-ускоритель**. Мгновенный Level UP!",
    intro2: "Думай: Волшебная Песочница. Есть идеи? Говори. AI строит, система чекает, PR улетает. **Бум.**",
    intro3: "Хватит потреблять, стань **ТВОРЦОМ**. Строй СВОЮ реальность, решай СВОИ проблемы, **валидируй идеи МГНОВЕННО**. Вот это вайб.",
    cyberVibeTitle: "Петля Вайба: Твой Движок Прокачки <FaLevelUpAlt/>",
    cyberVibe1: "Это не просто тулзы – это **накопительная петля обратной связи**. Каждое действие качает тебя, делает следующий шаг легче.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> становится твоим бесконечным **кибер-сундуком** знаний. Эта Студия + AI? Твои ключи к **ремиксу и трансмутации** этих знаний в новые вайбы, фичи, фиксы... **мгновенно**.",
    cyberVibe3: "Ты не просто *учишь* код; ты **ремиксуешь саму матрицу** на лету. Ты видишь структуру, взаимодействуешь, **эволюционируешь**.",
    cyberVibe4: "Это **со-творчество** с машинным разумом. Двигай границы. Зарабатывай свой 'bandwidth'. Цель? Бесконечный контекст. Бесконечная мощь. Это **CYBERVIBE 2.0**.",
    philosophyTitle: "Твой Путь Вайба: Гайд по Левелам (Жми)",
    philosophy1: "Это про раскрытие **ТВОЕГО** потенциала. Строй **СВОЙ** мир. Хватит гоняться, начни **создавать**. Ты = ниша.",
    philosophy2: "AI не замена, это твой **ультимативный рычаг**. Твой силовой множитель. Юзай его (идеи в <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev Пути <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></Link>) или останешься позади.",
    philosophy3: "**УРОВЕНЬ 1: МГНОВЕННАЯ ПОБЕДА!** Битый линк картинки? Скопируй, вставь, загрузи новую. **ГОТОВО.** Авто-магия все пофиксит. **Ты можешь это ПРЯМО СЕЙЧАС.**",
    philosophy4: "**УРОВЕНЬ 2: Простой Фикс:** Текст поменять? Стиль кнопки? Скажи AI Помощнику. **ГОТОВО.** Система направит.",
    philosophy5: "**УРОВЕНЬ 3+: Мульти-Файл Магия:** Сложно? Логика? AI помогает, ты рулишь. Шаг за шагом, будешь ворочать 5, 10, 20+ файлами как профи.",
    philosophy6: "**Валидируй БЫСТРО!** Чекай идеи с AI *до* кода (<Link href='/selfdev#validation' class='text-brand-yellow hover:underline font-semibold'>SelfDev Валидация <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></Link>). Убивай мертвые вайбы сразу.",
    philosophy7: "Студия упрощает. **Хватай код -> Укажи -> Желай -> AI Магия -> Отправляй!**",
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400'/> ИЛИ Просто видишь баг/идею на странице -> Вызови Бадди <FaRobot class='inline mx-1 text-indigo-400'/> -> Опиши.",
    step1DescEnd: "Для картинок: Скопируй битый URL, вставь Бадди/в Инпут.", // Упрощенный хинт
    step2Title: "2. AI Магия & Отправка:",
    step2Desc: "Если нужно, юзай <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Проверь результат в Ассистенте <FaWandMagicSparkles class='inline mx-1 text-yellow-400'/> -> Жми <FaGithub class='inline mx-1 text-green-400'/> для создания/обновления PR.",
    step2DescEnd: "**ГОТОВО.** Сайт обновляется авто-магически.", // Акцент на автоматизации
    readyButton: "ПОГНАЛИ, БЛ*ТЬ!", // Больше энергии
    componentsTitle: "Врубай Движки Вайба!", // Новый заголовок
    ctaTitle: "Готов(а) к Вознесению, {USERNAME}?", // Обновленный CTA
    ctaDesc: "Серьезно. Хватит сомневаться. Начни **ДЕЛАТЬ**. Первый левел зовет.",
    ctaHotChick: "Есть искра? Давай замутим что-то эпичное. Пиши **@SALAVEY13** СЕЙЧАС!", // Контакт остался
    ctaDude: "(Все остальные? Просто, бл*ть, попробуйте. У вас получится!)", // Более ободряюще
    navGrabber: "Граббер <FaDownload/>", // Иконка
    navAssistant: "Ассистент <FaRobot/>", // Иконка
    navIntro: "Интро <FaCircleInfo/>",
    navCyberVibe: "Петля Вайба <FaLevelUpAlt/>", // Обновленное имя
  }
};
// --- End I18N ---

type Language = 'en' | 'ru';

// --- Fallback component for AutomationBuddy ---
function LoadingBuddyFallback() {
    return ( <div className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 animate-pulse" aria-hidden="true" ></div> );
}
// ------------------------------------------

// --- Helper Component to render content with icons and bold ---
// Use React.memo for performance if content updates frequently but is often the same
const RenderContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    // Split by bold tags, icon tags, or general HTML tags
    const segments = content.split(/(\*\*.*?\*\*|<Fa\w+\s*.*?\/?>|<\/?\w+(?:\s+[^>]*)*>)/g).filter(Boolean);
    return (
        <>
            {segments.map((segment, sIndex) => {
                // Handle Bold
                if (segment.startsWith('**') && segment.endsWith('**')) {
                    return <strong key={sIndex}>{segment.slice(2, -2)}</strong>;
                }
                // Handle Icons (<FaIconName class="..."/>)
                const iconMatch = segment.match(/<Fa(\w+)\s*(?:class(?:Name)?="([^"]*)")?\s*\/?>/i);
                if (iconMatch) {
                    const iconName = `Fa${iconMatch[1]}` as keyof typeof FaIcons;
                    const className = iconMatch[2] || "";
                    const IconComponent = FaIcons[iconName]; // Dynamically get the component
                    if (IconComponent) {
                        // Apply default styling + any provided class
                        const finalClassName = `${className} inline-block align-middle mx-1`; // Adjust styling as needed
                        return React.createElement(IconComponent, { key: sIndex, className: finalClassName });
                    } else {
                        // Fallback for unknown icons
                        logger.warn(`[RenderContent] Icon "${iconName}" not found.`);
                        return <span key={sIndex} className="text-red-500 font-mono">[? {iconName}]</span>;
                    }
                }
                // Handle simple HTML tags (like <Link> or <a> from translations)
                // Use dangerouslySetInnerHTML ONLY if you trust the source (your translations)
                const htmlTagMatch = segment.match(/^<\/?\w+(?:\s+[^>]*)*>$/);
                if (htmlTagMatch || segment.startsWith('<Link') || segment.startsWith('<a')) {
                    // WARNING: Ensure your translation strings don't contain user-generated content
                    // if using dangerouslySetInnerHTML. For simple links/formatting, it's okay.
                    return <span key={sIndex} dangerouslySetInnerHTML={{ __html: segment }} />;
                }
                // Handle regular text
                return <React.Fragment key={sIndex}>{segment}</React.Fragment>;
            })}
        </>
    );
});
RenderContent.displayName = 'RenderContent'; // Helps in React DevTools

// --- ActualPageContent Component (Ref handling removed) ---
function ActualPageContent() {
    // REMOVED: localFetcherRef, localAssistantRef, aiResponseInputRef, prSectionRef
    const { user } = useAppContext();
    const {
        // Get refs DIRECTLY from context
        fetcherRef,
        assistantRef,
        kworkInputRef,
        aiResponseInputRef,
        // Other context values...
        setImageReplaceTask,
        setKworkInputHasContent,
        fetchStatus,
        imageReplaceTask,
        allFetchedFiles,
        selectedFetcherFiles,
        repoUrl, // Get repoUrl from context
        setRepoUrl, // Get repoUrl setter from context
    } = useRepoXmlPageContext();

    const [isMounted, setIsMounted] = useState(false);
    const [lang, setLang] = useState<Language>('en');
    const [showComponents, setShowComponents] = useState(false);
    const searchParams = useSearchParams();

    // --- State to hold the idea from URL ---
    const [initialIdea, setInitialIdea] = useState<string | null>(null);
    const [initialIdeaProcessed, setInitialIdeaProcessed] = useState<boolean>(false);

    // REMOVED: useEffect that linked local refs to context refs

    // --- Effect 1: Process URL Params and Set Initial State (no changes) ---
    useEffect(() => {
      setIsMounted(true);
      // Determine language based on user profile or browser default
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const initialLang = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(initialLang);
      logger.log(`[ActualPageContent Effect 1] Lang set to: ${initialLang}`);

      // Get URL parameters
      const pathParam = searchParams.get("path");
      const ideaParam = searchParams.get("idea");
      const repoParam = searchParams.get("repo"); // Check for repo URL param

       // --- NEW: Handle Repo URL Param ---
       if (repoParam) {
           try {
               const decodedRepoUrl = decodeURIComponent(repoParam);
               // Basic validation
               if (decodedRepoUrl.includes("github.com")) {
                   setRepoUrl(decodedRepoUrl); // Update context state
                   logger.log(`[ActualPageContent Effect 1] Repo URL set from param: ${decodedRepoUrl}`);
                   // Optionally trigger fetch or PR list update here if needed immediately
                   // triggerGetOpenPRs(decodedRepoUrl);
               } else {
                   logger.warn(`[ActualPageContent Effect 1] Invalid repo URL from param: ${decodedRepoUrl}`);
               }
           } catch (e) {
               logger.error("[ActualPageContent Effect 1] Error decoding repo URL param:", e);
           }
       }
       // --- END NEW ---


      if (pathParam && ideaParam) {
          const decodedIdea = decodeURIComponent(ideaParam);
          const decodedPath = decodeURIComponent(pathParam);
          // Check if it's an image replacement task
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
                          setImageReplaceTask(task); // Set task in context
                          setInitialIdea(null); // No regular idea needed
                          setInitialIdeaProcessed(true); // Mark as processed
                      } else {
                          logger.error("[ActualPageContent Effect 1] Invalid image task data parsed:", { decodedPath, oldUrl, newUrl });
                          setImageReplaceTask(null);
                      }
                  } else {
                      logger.error("[ActualPageContent Effect 1] Could not parse Old/New URL from image task string:", decodedIdea);
                      setImageReplaceTask(null);
                  }
              } catch (e) {
                  logger.error("[ActualPageContent Effect 1] Error parsing image task from URL:", e);
                  setImageReplaceTask(null);
              }
          } else {
              // Regular idea parameter
              logger.log("[ActualPageContent Effect 1] Regular idea param found, storing:", decodedIdea.substring(0, 50) + "...");
              setInitialIdea(decodedIdea);
              setImageReplaceTask(null); // Ensure no image task
              setInitialIdeaProcessed(false); // Mark as NOT processed yet (wait for fetch)
          }
          // Show components immediately if params are present
          setShowComponents(true);
      } else {
          // No path/idea params
          setImageReplaceTask(null);
          setInitialIdea(null);
          setInitialIdeaProcessed(true); // Nothing to process
          logger.log("[ActualPageContent Effect 1] No path/idea params found.");
      }
    // Dependencies include user (for lang), searchParams, context setters
    }, [user, searchParams, setImageReplaceTask, setRepoUrl]);


    // --- Effect 2: Populate Kwork Input AFTER Initial Fetch Attempt (Includes defensive checks) ---
    useEffect(() => {
      // Check if fetch attempt (auto or manual) has finished
      const fetchAttemptFinished = isMounted && (fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries');

      // Conditions to populate: fetch finished, there's a stored initial idea, it hasn't been processed yet, and it's not an image task
      if (fetchAttemptFinished && initialIdea && !initialIdeaProcessed && !imageReplaceTask) {
          logger.log(`[ActualPageContent Effect 2] Fetch finished (${fetchStatus}). Populating kwork with stored idea:`, initialIdea.substring(0,50) + "...");

          // Ensure the kwork input ref is available
          if (kworkInputRef.current) { // Use context ref directly
              // Set the idea text first
              kworkInputRef.current.value = initialIdea;
              // Dispatch an 'input' event to simulate user typing, which triggers internal state updates if needed
              const inputEvent = new Event('input', { bubbles: true });
              kworkInputRef.current.dispatchEvent(inputEvent);
              setKworkInputHasContent(initialIdea.trim().length > 0); // Update context state
              logger.log("[ActualPageContent Effect 2] Populated kwork input via context ref.");

              // Now, trigger adding the auto-selected files (if any) to this idea text
              // --- DEFENSIVE CHECK ---
              if (fetcherRef.current) { // Check if the fetcher ref itself is populated
                   if (fetcherRef.current.handleAddSelected) { // Check if the method exists
                        // Check if there are actually selected files in the context state
                        if (selectedFetcherFiles.size > 0) {
                            logger.log("[ActualPageContent Effect 2] Calling fetcherRef.handleAddSelected to append auto-selected files.");
                            // Call the method using files from context state
                            fetcherRef.current.handleAddSelected(selectedFetcherFiles, allFetchedFiles)
                                .then(() => logger.log("[ActualPageContent Effect 2] handleAddSelected call finished."))
                                .catch(err => logger.error("[ActualPageContent Effect 2] Error calling handleAddSelected:", err));
                        } else {
                            logger.log("[ActualPageContent Effect 2] Skipping handleAddSelected as no files were auto-selected.");
                        }
                  } else {
                       logger.warn("[ActualPageContent Effect 2] fetcherRef.current.handleAddSelected method not available on ref.");
                  }
              } else {
                   logger.warn("[ActualPageContent Effect 2] fetcherRef.current is null when trying to call handleAddSelected.");
              }
              // --- END DEFENSIVE CHECK ---

              // Scroll to the kwork input section to make it visible
               const kworkElement = document.getElementById('kwork-input-section');
               if (kworkElement) {
                    // Use a timeout to ensure rendering is complete before scrolling
                    setTimeout(() => {
                        kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        logger.log("[ActualPageContent Effect 2] Scrolled to kwork input.");
                    }, 250); // Slightly increased delay
               }

          } else {
              logger.warn("[ActualPageContent Effect 2] Context kworkInputRef is null when trying to populate idea.");
          }
          setInitialIdeaProcessed(true); // Mark the initial idea as processed
      } else if (fetchAttemptFinished && !initialIdeaProcessed) {
          // If fetch finished but there was no idea or it was already processed, mark as processed
          setInitialIdeaProcessed(true);
           logger.log(`[ActualPageContent Effect 2] Fetch finished (${fetchStatus}), no pending idea to process or already processed.`);
      }
    // Dependencies ensure this runs when fetch status changes, idea/task states change, or refs become available
    }, [isMounted, fetchStatus, initialIdea, initialIdeaProcessed, imageReplaceTask, kworkInputRef, setKworkInputHasContent, fetcherRef, allFetchedFiles, selectedFetcherFiles]);

    const t = translations[lang]; // Get translations for the current language
    const userName = user?.first_name || (lang === 'ru' ? 'Нео' : 'Neo'); // Use user's name or a default

    // --- Scroll Helper ---
    const scrollToSectionNav = (id: string) => {
        // Target sections that require revealing the components first
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps']; // Added CyberVibe & Philosophy

        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            logger.log(`[Scroll] Revealing components to scroll to "${id}"`);
            setShowComponents(true);
            // Wait for components to render before scrolling
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) {
                    // Calculate offset scroll position (adjust 80px as needed for fixed header)
                    const offsetTop = window.scrollY + el.getBoundingClientRect().top - 80;
                    window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                     logger.log(`[Scroll] Scrolled to revealed "${id}" at offset ${offsetTop}`);
                } else {
                    logger.error(`[Scroll] Target "${id}" not found after revealing components.`);
                }
            }, 150); // Adjust delay if needed
            return;
        }

        // If components are already shown or the section doesn't require reveal
        const el = document.getElementById(id);
        if (el) {
             const offsetTop = window.scrollY + el.getBoundingClientRect().top - 80;
            window.scrollTo({ top: offsetTop, behavior: 'smooth' });
             logger.log(`[Scroll] Scrolled to "${id}" at offset ${offsetTop}`);
        } else {
            logger.error(`[Scroll] Target "${id}" not found.`);
        }
    };


    // Render loading state if component hasn't mounted yet
    if (!isMounted) {
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang].loading;
         return (
             <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950">
                 <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" />
                 <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p>
             </div>
         );
     }

    return (
        <>
            {/* Ensure viewport settings are applied */}
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
            {/* Main container */}
            <div className="min-h-screen bg-gray-950 p-4 sm:p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">

                {/* Intro Section - CYBERVIBE Overhaul */}
                <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                     {/* Logo/Icon */}
                     <div className="flex justify-center mb-4">
                        <FaBolt className="w-16 h-16 text-[#E1FF01] text-shadow-[0_0_15px_#E1FF01] animate-pulse" />
                    </div>
                    {/* Title */}
                    <h1 className="text-4xl md:text-5xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-4">
                        {t.pageTitle}
                    </h1>
                    {/* Welcome Message */}
                    <p className="text-xl md:text-2xl text-gray-200 mt-4 font-semibold">
                        {t.welcome} <span className="text-brand-cyan">{userName}!</span>
                    </p>
                    {/* Intro Text */}
                    <div className="text-lg md:text-xl text-gray-300 mt-3 space-y-3">
                        <p><RenderContent content={t.intro1} /></p>
                        <p><RenderContent content={t.intro2} /></p>
                        <p className="font-semibold text-brand-green"><RenderContent content={t.intro3} /></p>
                    </div>
                </section>

                {/* === The Vibe Loop Section (CyberVibe Renamed) === */}
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

                {/* Your Vibe Path Section (Philosophy & Steps Renamed) */}
                <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                    {/* Use <details> for collapsibility, styled */}
                    <details className="bg-gray-900/80 border border-gray-700 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4 open:shadow-lg open:border-indigo-500/50">
                        {/* Summary acts as the clickable header */}
                        <summary className="text-xl md:text-2xl font-semibold text-brand-green p-4 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800/50 rounded-t-lg transition-colors">
                            <span className="flex items-center gap-2"><FaCodeBranch /> {t.philosophyTitle}</span>
                            <span className="text-xs text-gray-500 group-open:rotate-180 transition-transform duration-300">▼</span> {/* Simple indicator */}
                        </summary>
                        {/* Content inside the details */}
                        <div className="px-6 pt-2 text-gray-300 space-y-4 text-base">
                            {/* Core Philosophy */}
                            <p><RenderContent content={t.philosophy1} /></p>
                            <p><RenderContent content={t.philosophy2} /></p>
                            <hr className="border-gray-700 my-3"/>
                            {/* Level Progression */}
                            <h4 className="text-lg font-semibold text-cyan-400 pt-1">Level Progression:</h4>
                            <ul className="list-none space-y-2 pl-2">
                                <li><span className="font-bold text-yellow-400 mr-2">Lv.1 <FaBolt/>:</span> <RenderContent content={t.philosophy3} /></li>
                                <li><span className="font-bold text-yellow-400 mr-2">Lv.2 <FaTools/>:</span> <RenderContent content={t.philosophy4} /></li>
                                <li><span className="font-bold text-yellow-400 mr-2">Lv.3+ <FaCode/>:</span> <RenderContent content={t.philosophy5} /></li>
                            </ul>
                            <hr className="border-gray-700 my-3"/>
                            {/* Validation Emphasis */}
                            <p className="font-semibold text-yellow-400 flex items-start gap-2">
                                <FaBullseye className="inline-block h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0"/>
                                <span><RenderContent content={t.philosophy6} /></span>
                            </p>
                             <p><RenderContent content={t.philosophy7} /></p>
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

                {/* WORKHORSE Components (Render when showComponents is true) */}
                {showComponents && (
                     <>
                        {/* Title for the main components */}
                        <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse">{t.componentsTitle}</h2>

                         {/* Extractor Section */}
                         <section id="extractor" className="mb-12 w-full max-w-4xl">
                             <Card className="bg-gray-900/80 border border-blue-700/50 shadow-lg backdrop-blur-sm">
                                 <CardContent className="p-4">
                                     {/* Pass CONTEXT ref directly */}
                                     <RepoTxtFetcher ref={fetcherRef} />
                                 </CardContent>
                             </Card>
                         </section>

                         {/* Executor Section */}
                        <section id="executor" /* ref={prSectionRef} - Removed if not used elsewhere */ className="mb-12 w-full max-w-4xl pb-16">
                             <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                 <CardContent className="p-4">
                                     {/* Pass CONTEXT refs directly */}
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

                {/* Final CTA (Render when showComponents is true) */}
                 {showComponents && (
                     <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                         <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50">
                             <h3 className="text-2xl font-bold text-white mb-3">{t.ctaTitle.replace('{USERNAME}', userName)}</h3>
                             <p className="text-white text-lg mb-4">
                                <RenderContent content={t.ctaDesc} />
                             </p>
                             {/* Specific CTA for "Hot Chicks" / Contact */}
                             <p className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded">
                                 <FaHeart className="inline mr-2 text-red-400 animate-ping"/> <RenderContent content={t.ctaHotChick} /> <FaUserAstronaut className="inline ml-2 text-pink-300"/>
                             </p>
                             {/* General CTA for "Dudes" */}
                             <p className="text-gray-300 text-base">
                                <RenderContent content={t.ctaDude} />
                             </p>
                         </div>
                     </section>
                 )}

                {/* Floating Navigation Icons */}
                 <nav className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40">
                     {/* Intro Button */}
                     <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition shadow-md" title={t.navIntro}>
                         <FaCircleInfo className="text-lg text-gray-200" />
                     </button>
                     {/* Vibe Loop Button */}
                     <button onClick={() => scrollToSectionNav("cybervibe-section")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition shadow-md" title={t.navCyberVibe}>
                         <FaLevelUpAlt className="text-lg text-white" />
                     </button>
                     {/* Buttons shown only when components are visible */}
                     {showComponents && (
                         <>
                             {/* Grabber Button */}
                             <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition shadow-md" title={t.navGrabber}>
                                 <FaDownload className="text-lg text-white" />
                             </button>
                             {/* Assistant Button */}
                             <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-indigo-700/80 backdrop-blur-sm rounded-full hover:bg-indigo-600 transition shadow-md" title={t.navAssistant}>
                                 <FaRobot className="text-lg text-white" />
                             </button>
                         </>
                     )}
                </nav>

                {/* Automation Buddy (Wrapped in Suspense for client-side hooks) */}
                <Suspense fallback={<LoadingBuddyFallback />}>
                    <AutomationBuddy />
                </Suspense>
            </div>
        </>
    );
}

// --- Layout Component (Ref creation REMOVED) ---
// This component sets up the Context Provider
function RepoXmlPageLayout() {
    // REMOVED: fetcherRefForProvider, assistantRefForProvider, etc.
    return (
        // The Provider initializes the context and manages the state
        // REMOVED: Passing refs as props to Provider
        <RepoXmlPageProvider>
            {/* The actual page content component consumes the context */}
            <ActualPageContent />
        </RepoXmlPageProvider>
    );
}

// --- Exported Page Component ---
// This is the component Next.js renders for the page route
export default function RepoXmlPage() {
    // Determine fallback language based on browser before full mount
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
    const fallbackLoadingText = translations[fallbackLoadingLang].loading;
    // Define a fallback UI for Suspense
    const fallbackLoading = (
        <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950">
            <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" />
            <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p>
        </div>
    );
    // Wrap the Layout (which includes the Provider and Page Content) in Suspense
    // This handles loading states for hooks like useSearchParams within ActualPageContent
    return (
        <Suspense fallback={fallbackLoading}>
            <RepoXmlPageLayout />
        </Suspense>
    );
}