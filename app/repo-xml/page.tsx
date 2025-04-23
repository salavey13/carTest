"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback } from "react"; // Added ReactNode, useCallback

import { useSearchParams } from 'next/navigation';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, // Keep this import for the NEW component
    RepoXmlPageProvider, // Keep this import for the LAYOUT component
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask
} from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger"; // Use debugLogger
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong, FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye } from "react-icons/fa6";
import Link from "next/link";

// --- I18N Translations ---
const translations = {
  en: {
    loading: "Loading SUPERVIBE...",
    pageTitle: "SUPERVIBE STUDIO",
    welcome: "Yo,", // Personalized welcome
    intro1: "Still scared of 'code'? Forget that noise! This is the **FUTURE**, your personal code accelerant.",
    intro2: "Think of this like a magic playground. You have ideas? Cool. You speak 'em, AI builds 'em, I make sure it all works. Simple.",
    intro3: "Stop being a consumer, start being a CREATOR. This tool helps you build YOUR reality, solve YOUR problems, **validate ideas FAST**, maybe even make cash doing what YOU vibe with.", // Added validation mention
    philosophyTitle: "The Philosophy: Why This Shit Works (Tap to Learn)",
    philosophy1: "This isn't just about building apps. It's about unlocking YOUR potential (like in", // Simplified
    philosophyLink1: "/purpose-profit",
    philosophyLink1Text: "Purpose & Profit ideas",
    philosophy2: "). Stop chasing jobs, start building YOUR world. You ARE the niche.",
    philosophy3: "AI isn't here to replace you, dude. It's your superpower, your co-pilot. Learn to leverage it (ideas in", // Changed to leverage
    philosophyLink2: "/selfdev",
    philosophyLink2Text: "SelfDev Path",
    philosophy4: "), or get left behind. Simple choice.", // Simplified
    philosophy5: "This studio makes it easy. Grab ideas, talk to the AI, see magic happen. No scary code monsters.",
    philosophy6: "**Validate first!** Use AI to check if your idea has legs *before* building (more on this in", // NEW: Validation emphasis
    philosophyLink3: "/selfdev#validation", // NEW: Link to validation section
    philosophyLink3Text: "SelfDev Validation", // NEW
    philosophy7: "). Kill bad ideas quickly, save time & money.", // NEW
    stepsTitle: "Quick Vibe Guide (It's Easy AF):",
    step1Title: "1. Grab + Wish:",
    step1Desc: "Point at app part -> Hit", // Download icon inserted below
    step1DescEnd: "-> Pick bits -> Tell AI your idea.",
    step2Title: "2. AI Magic -> Reality:",
    step2Desc: "Hit", // Robot icon inserted below
    step2Button: "Ask AI",
    step2DescMid: "-> Go to Magic Assist", // Robot icon inserted below
    step2DescMid2: "-> Hit '➡️' -> Check magic", // Wand icon inserted below
    step2DescEnd: "-> Add to idea / Start new!", // Github icon inserted below
    readyButton: "OKAY, I'M READY! SHOW ME THE MAGIC!",
    componentsTitle: "Alright, Let's F*cking GO!",
    ctaTitle: "Ready to ACTUALLY Vibe?",
    ctaDesc: "Seriously, {USERNAME}, stop hesitating. This shit's bangin' where I'm from, even if it looks weird where you are.",
    ctaHotChick: "If you're a hot chick, ditch the hesitation & hit me up **@SALAVEY13** NOW! Let's build something incredible together in a personal SUPERVIBE session!", // Bolder CTA
    ctaDude: "(Dudes? Stop overthinking! Just fucking try it. Satisfaction guaranteed, or... well, you tried! Good luck!)", // More direct
    navGrabber: "Idea Grabber",
    navAssistant: "Magic Assistant",
    navIntro: "What is This?!",
  },
  ru: {
    loading: "Загрузка SUPERVIBE...",
    pageTitle: "SUPERVIBE СТУДИЯ",
    welcome: "Йоу,", // Personalized welcome
    intro1: "Все еще боишься 'кода'? Забудь эту хрень! Это **БУДУЩЕЕ**, твой личный ускоритель кода.", // Updated
    intro2: "Думай об этом как о волшебной песочнице. Есть идеи? Круто. Ты их говоришь, AI их строит, я слежу, чтобы все работало. Просто.",
    intro3: "Хватит быть потребителем, стань ТВОРЦОМ. Этот инструмент поможет тебе строить ТВОЮ реальность, решать ТВОИ проблемы, **быстро валидировать идеи**, может даже заработать на том, что ТЕБЕ по кайфу.", // Added validation mention
    philosophyTitle: "Философия: Почему Эта Хрень Работает (Нажми Узнать)",
    philosophy1: "Это не просто про создание приложений. Это про раскрытие ТВОЕГО потенциала (как в", // Simplified
    philosophyLink1: "/purpose-profit",
    philosophyLink1Text: "идеях Purpose & Profit",
    philosophy2: "). Хватит гоняться за работами, начни строить СВОЙ мир. Ты И ЕСТЬ ниша.",
    philosophy3: "AI здесь не чтобы заменить тебя, чувак. Это твоя суперсила, твой второй пилот. Научись использовать его рычаги (идеи в", // Changed to leverage
    philosophyLink2: "/selfdev",
    philosophyLink2Text: "Пути SelfDev",
    philosophy4: "), или останешься позади. Простой выбор.", // Simplified
    philosophy5: "Эта студия делает все просто. Хватай идеи, говори с AI, наблюдай магию. Никаких страшных код-монстров.",
    philosophy6: "**Сначала валидируй!** Используй AI, чтобы проверить, взлетит ли твоя идея, *прежде* чем строить (подробнее в", // NEW: Validation emphasis
    philosophyLink3: "/selfdev#validation", // NEW: Link to validation section
    philosophyLink3Text: "SelfDev Валидации", // NEW
    philosophy7: "). Убивай плохие идеи быстро, экономь время и деньги.", // NEW
    stepsTitle: "Краткий Vibe-Гайд (Это П*здец Как Просто):",
    step1Title: "1. Хватай + Желай:",
    step1Desc: "Укажи на часть -> Жми", // Download icon inserted below
    step1DescEnd: "-> Выбери -> Скажи AI идею.",
    step2Title: "2. AI Магия -> Реальность:",
    step2Desc: "Жми", // Robot icon inserted below
    step2Button: "Спросить AI",
    step2DescMid: "-> Иди в Magic Assist", // Robot icon inserted below
    step2DescMid2: "-> Жми '➡️' -> Проверь магию", // Wand icon inserted below
    step2DescEnd: "-> Добавь к идее / Начни новую!", // Github icon inserted below
    readyButton: "ОКЕЙ, Я ГОТОВ(А)! ПОКАЖИ МНЕ МАГИЮ!",
    componentsTitle: "Ну Всё, Бл*дь, Погнали!",
    ctaTitle: "Готов(а) РЕАЛЬНО Вайбить?",
    ctaDesc: "Серьезно, {USERNAME}, хватит сомневаться. Там, откуда я, эта хрень взрывает, даже если там, где ты, она выглядит странно.",
    ctaHotChick: "Если ты горячая чика, бросай сомнения и пиши мне **@SALAVEY13** СЕЙЧАС! Давай создадим что-то невероятное вместе на личной SUPERVIBE сессии!", // Bolder CTA
    ctaDude: "(Пацаны? Хватит думать! Просто, бл*дь, попробуйте. Удовлетворение гарантировано, или... ну, вы хотя бы попробовали! Удачи!)", // More direct
    navGrabber: "Граббер Идей",
    navAssistant: "Магический Помощник",
    navIntro: "Что Это Такое?!",
  }
};
// --- End I18N ---

type Language = 'en' | 'ru';

// --- NEW: Component containing the actual page logic and consuming context ---
function ActualPageContent() {
    // Refs for direct interaction within this component/passing down
    const localFetcherRef = useRef<RepoTxtFetcherRef | null>(null); // Renamed for clarity
    const localAssistantRef = useRef<AICodeAssistantRef | null>(null); // Renamed for clarity
    const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
    const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
    const prSectionRef = useRef<HTMLElement | null>(null); // Ref needed for scrolling target

    // State
    const { user } = useAppContext(); // Consumes AppContext
    // Get context refs AND the setter for the image task
    const {
        setImageReplaceTask,
        fetcherRef: contextFetcherRef, // Get the ref object held by context
        assistantRef: contextAssistantRef // Get the ref object held by context
    } = useRepoXmlPageContext();
    const [isMounted, setIsMounted] = useState(false);
    const [lang, setLang] = useState<Language>('en');
    const [showComponents, setShowComponents] = useState(false);

    // Hooks
    const searchParams = useSearchParams(); // Needs Suspense boundary higher up

    // --- NEW EFFECT: Link local refs to context refs ---
    useEffect(() => {
        // Assign the component instance refs obtained locally
        // to the refs managed by the context provider.
        if (localFetcherRef.current && contextFetcherRef) {
            contextFetcherRef.current = localFetcherRef.current;
            logger.log("[ActualPageContent] Fetcher ref linked to context.");
        }
        if (localAssistantRef.current && contextAssistantRef) {
            contextAssistantRef.current = localAssistantRef.current;
            logger.log("[ActualPageContent] Assistant ref linked to context.");
            // Optional: Trigger pending task if needed (context logic might handle this)
            // const task = useRepoXmlPageContext.getState().imageReplaceTask; // Example hypothetical access
            // if (task && localAssistantRef.current) {
            //     logger.log("[ActualPageContent Effect] Assistant ready, attempting to trigger pending task.");
            //     localAssistantRef.current.handleDirectImageReplace(task)
            //        .catch(e => logger.error("Error re-triggering task from effect:", e));
            // }
        }
        // Dependencies: Run when local refs change or context refs become available.
        // Using .current directly isn't ideal, but we rely on mount/context availability.
    }, [contextFetcherRef, contextAssistantRef, localFetcherRef.current, localAssistantRef.current]); // Include local refs' .current

    // --- Existing useEffect for Params ---
    useEffect(() => {
      setIsMounted(true);
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const telegramLang = user?.language_code;
      const initialLang = telegramLang === 'ru' || (!telegramLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(initialLang);
      logger.log(`[ActualPageContent] Mounted. Browser lang: ${browserLang}, TG lang: ${telegramLang}, Initial selected: ${initialLang}`);

      const pathParam = searchParams.get("path");
      const ideaParam = searchParams.get("idea");

      if (pathParam && ideaParam) {
           const decodedIdea = decodeURIComponent(ideaParam);
            const decodedPath = decodeURIComponent(pathParam);

            if (decodedIdea.startsWith("ImageReplace|")) {
                logger.log("[ActualPageContent] Image Replace task detected in URL params.");
                try {
                    const parts = decodedIdea.split('|');
                    const oldUrlPart = parts.find(p => p.startsWith("OldURL="));
                    const newUrlPart = parts.find(p => p.startsWith("NewURL="));

                    if (oldUrlPart && newUrlPart) {
                        const oldUrl = decodeURIComponent(oldUrlPart.substring("OldURL=".length));
                        const newUrl = decodeURIComponent(newUrlPart.substring("NewURL=".length));

                        if (decodedPath && oldUrl && newUrl) {
                            const task: ImageReplaceTask = { targetPath: decodedPath, oldUrl, newUrl };
                            logger.log("[ActualPageContent] Setting image replace task in context:", task);
                            // Use the setter obtained from context
                            setImageReplaceTask(task);
                        } else {
                             logger.error("[ActualPageContent] Invalid image replace task data:", { decodedPath, oldUrl, newUrl });
                             setImageReplaceTask(null);
                        }
                    } else {
                         logger.error("[ActualPageContent] Could not parse OldURL/NewURL from image replace idea:", decodedIdea);
                         setImageReplaceTask(null);
                    }
                } catch (e) {
                    logger.error("[ActualPageContent] Error parsing image replace task:", e);
                    setImageReplaceTask(null);
                }
            } else {
                 // --- It's a regular idea ---
                 logger.log("[ActualPageContent] Regular 'path' and 'idea' params found.");
                 setImageReplaceTask(null); // Ensure image task is cleared via context setter
                 // Populate kwork input using the ref created within this component
                 if (kworkInputRef.current) {
                      kworkInputRef.current.value = decodedIdea;
                      // Optionally trigger input event if needed by AICodeAssistant
                      const event = new Event('input', { bubbles: true });
                      kworkInputRef.current.dispatchEvent(event);
                      logger.log("[ActualPageContent] Populated kwork input with idea from URL.");
                 } else {
                     // This might happen briefly on initial render before refs are assigned
                     logger.warn("[ActualPageContent] kworkInputRef is null when trying to populate idea from URL.");
                     // Retry slightly later? Or rely on component rendering cycle.
                     // For now, just warn. If it persists, it's an issue.
                 }
            }

            // Auto-show components if path and idea/task are present
            setShowComponents(true);
            logger.log("[ActualPageContent] Auto-showing components due to URL params.");

      } else {
           // No path/idea params, clear any potential image task via context
           setImageReplaceTask(null);
           logger.log("[ActualPageContent] No path/idea params found in URL.");
      }
      // Added context refs to ensure effect runs after context is potentially available
    }, [user, searchParams, setImageReplaceTask, kworkInputRef, contextFetcherRef, contextAssistantRef]);

    const t = translations[lang];
    const userName = user?.first_name || (lang === 'ru' ? 'Чувак/Чика' : 'Dude/Chica');

    // Scroll function adjusted to show components if needed
    const scrollToSectionNav = (id: string) => {
      if (id === 'extractor' || id === 'executor') {
        if (!showComponents) {
          setShowComponents(true);
          // Use setTimeout to allow components to render before scrolling
          setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                const rect = element.getBoundingClientRect();
                // Adjust scroll position slightly (-80px) to account for fixed headers/nav
                window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
            } else { logger.error(`Element with id "${id}" not found post-reveal.`); }
          }, 100); // Small delay
          return; // Exit early as scrolling is handled in setTimeout
        }
      }
      // Default scroll for intro or if components already shown
      const element = document.getElementById(id);
      if (element) {
          const rect = element.getBoundingClientRect();
          window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
      } else { logger.error(`Element with id "${id}" not found.`); }
    };

    // Loading state based on mount status (basic client-side loading indicator)
    if (!isMounted) {
      // Use the loading text from translations
      const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
      const loadingText = translations[loadingLang].loading;
      return (
        <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
          <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p>
        </div>
      );
    }

    // --- RENDER THE ACTUAL UI ---
    // This component renders the visible page content
    return (
        <>
            {/* Viewport meta tag for responsive design */}
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />

            {/* Main container */}
            <div className="min-h-screen bg-gray-950 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">

                {/* === TOP SECTION: Intro & Persuasion === */}
                <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                    {/* SVG Icon */}
                    <div className="flex justify-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12"> <path fill="#333" d="M0 0h200v100H0z"/><path fill="#E1FF01" d="M50 20h100v60H50z"/><path fill="#444" d="M60 30h80v40H60z"/><path fill="#E1FF01" d="M70 40h60v20H70z"/><path fill="#555" d="M80 45h40v10H80z"/><path fill="#E1FF01" d="M90 48h20v4H90z"/><path fill="#333" d="M40 10h120v80H40z" opacity=".1"/><path fill="url(#a)" d="M0 0h200v100H0z"/> <defs> <radialGradient id="a" cx="50%" cy="50%" r="70%" fx="50%" fy="50%"> <stop offset="0%" stop-color="#fff" stop-opacity=".1"/> <stop offset="100%" stop-color="#fff" stop-opacity="0"/> </radialGradient> </defs> </svg>
                    </div>
                    {/* Page Title */}
                    <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse"> {t.pageTitle} </h1>
                    {/* Welcome Message */}
                    <p className="text-xl text-gray-200 mt-4 font-semibold">
                        {t.welcome} <span className="text-brand-cyan">{userName}!</span>
                    </p>
                    {/* Introductory Paragraphs */}
                    <p className="text-lg text-gray-300 mt-2" dangerouslySetInnerHTML={{ __html: t.intro1.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-300">$1</strong>') }}></p>
                    <p className="text-lg text-gray-300 mt-2">{t.intro2}</p>
                    <p className="text-lg text-gray-300 mt-2" dangerouslySetInnerHTML={{ __html: t.intro3.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-300">$1</strong>') }}></p>

                     {/* *** MAIN CALL TO ACTION *** */}
                     <div className="mt-8 bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50">
                         <h3 className="text-2xl font-bold text-white mb-3">{t.ctaTitle}</h3>
                         {/* CTA Description with username */}
                         <p className="text-white text-lg mb-4">
                             {t.ctaDesc.replace('{USERNAME}', userName)}
                         </p>
                         {/* Bolder CTA for "Hot Chicks" */}
                         <p className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded">
                            <FaHeart className="inline mr-2 text-red-400 animate-ping"/>
                            <span dangerouslySetInnerHTML={{ __html: t.ctaHotChick.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-300">$1</strong>') }}></span>
                            <FaUserAstronaut className="inline ml-2 text-pink-300"/>
                         </p>
                         {/* CTA for "Dudes" */}
                         <p className="text-gray-300 text-base">
                             {t.ctaDude}
                         </p>
                     </div>
                </section>

                {/* === MIDDLE SECTION: Collapsible Philosophy & Steps === */}
                <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                    {/* Details element for collapsible section */}
                    <details open className="bg-gray-900/70 border border-gray-700 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4">
                        {/* Summary acts as the clickable header */}
                        <summary className="text-xl font-semibold text-brand-purple p-4 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800/50 rounded-t-lg">
                            <span>{t.philosophyTitle}</span>
                            {/* Optional: Add an icon to indicate open/close state */}
                            {/* <FaUpLong className="text-gray-500 group-open:rotate-180 transition-transform" /> */}
                        </summary>
                        {/* Content of the collapsible section */}
                        <div className="px-6 pt-2 text-gray-300 space-y-3 text-base">
                            {/* Philosophy points with links */}
                            <p>{t.philosophy1} <Link href={t.philosophyLink1} className="text-brand-purple hover:underline font-semibold">{t.philosophyLink1Text} <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1" /></Link> {t.philosophy2}</p>
                            <p>{t.philosophy3} <Link href={t.philosophyLink2} className="text-brand-blue hover:underline font-semibold">{t.philosophyLink2Text} <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1" /></Link>{t.philosophy4}</p>
                            <p>{t.philosophy5}</p>
                            {/* Validation point with icon and link */}
                            <p className="font-semibold text-yellow-400 flex items-center gap-1" dangerouslySetInnerHTML={{
                                __html: `<svg class="inline-block h-4 w-4 text-yellow-500 mr-1" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/></svg> ${t.philosophy6.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-300">$1</strong>')} <a href="${t.philosophyLink3}" class="text-brand-yellow hover:underline font-semibold">${t.philosophyLink3Text} <svg class="inline h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4 0l6-6m-2 0h4v4"></path></svg></a> ${t.philosophy7}`
                            }}>
                            </p>

                            {/* Divider */}
                            <hr className="border-gray-700 my-4"/>
                            {/* Quick Steps Title */}
                            <h4 className="text-lg font-semibold text-cyan-400 pt-2">{t.stepsTitle}</h4>
                            {/* Steps Description */}
                            <div className="text-sm space-y-2">
                                 <p><strong className="text-cyan-500">{t.step1Title}</strong> {t.step1Desc} <FaDownload className="inline mx-1 text-blue-400"/> {t.step1DescEnd}</p>
                                 <p><strong className="text-cyan-500">{t.step2Title}</strong> {t.step2Desc} <span className="text-blue-400 font-semibold">"🤖 {t.step2Button}"</span> {t.step2DescMid} <FaRobot className="inline mx-1 text-purple-400"/> {t.step2DescMid2} <FaWandMagicSparkles className="inline mx-1 text-yellow-400" /> {t.step2DescEnd} <FaGithub className="inline mx-1 text-green-400" /> </p>
                            </div>
                        </div>
                    </details>
                </section>

                {/* === COMMITMENT STEP: Button to Reveal Components === */}
                {/* This button is only shown if the components are hidden */}
                {!showComponents && (
                    <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                         <Button
                            onClick={() => setShowComponents(true)}
                            className="bg-gradient-to-r from-green-500 to-cyan-500 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce"
                            size="lg"
                          >
                            <FaHandSparkles className="mr-2"/> {t.readyButton}
                         </Button>
                    </section>
                )}

                {/* === BOTTOM SECTION: The "Workhorse" Components (Conditionally Rendered) === */}
                {/* This section is shown only after the user clicks the button or if params are present */}
                {showComponents && (
                    <>
                      {/* Title for the components section */}
                      <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse">{t.componentsTitle}</h2>

                      {/* RepoTxtFetcher Section (Idea Grabber) */}
                      <Suspense fallback={<div className="text-white p-4 text-center">{t.loading}</div>}>
                          <section id="extractor" className="mb-12 w-full max-w-4xl">
                              <Card className="bg-gray-900/80 border border-blue-700/50 shadow-lg">
                                <CardContent className="p-4">
                                  {/* Pass the LOCAL ref */}
                                  <RepoTxtFetcher ref={localFetcherRef} />
                                </CardContent>
                              </Card>
                          </section>
                      </Suspense>

                      {/* AICodeAssistant Section (Magic Assistant / Executor) */}
                       {/* Assign the ref for scrolling target */}
                       <section id="executor" ref={prSectionRef} className="mb-12 w-full max-w-4xl pb-16">
                           <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg">
                             <CardContent className="p-4">
                               {/* Pass the LOCAL ref */}
                               <AICodeAssistant ref={localAssistantRef} kworkInputRefPassed={kworkInputRef} aiResponseInputRefPassed={aiResponseInputRef} />
                             </CardContent>
                           </Card>
                       </section>
                    </>
                )}

                {/* === Navigation Icons (Always Visible) === */}
                 <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-40">
                   {/* Button to scroll to Intro */}
                   <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition shadow-md" title={t.navIntro}> <FaCircleInfo className="text-lg text-gray-200" /> </button>
                   {/* Button to scroll to/reveal Extractor */}
                   <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition shadow-md" title={t.navGrabber}> <FaDownload className="text-lg text-white" /> </button>
                   {/* Button to scroll to/reveal Executor */}
                   <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition shadow-md" title={t.navAssistant}> <FaRobot className="text-lg text-white" /> </button>
                 </nav>

                {/* Automation Buddy - Renders INSIDE the main div, so it's within provider scope */}
                <AutomationBuddy />

            </div>
        </>
    );
}


// --- MODIFIED: Layout component that SETS UP the Provider ---
// This component's primary role is to establish the context provider.
function RepoXmlPageLayout() {
    // Create refs HERE in the component that RENDERS the provider.
    // These refs are specifically for the Provider's configuration/needs.
    const fetcherRefForProvider = useRef<RepoTxtFetcherRef | null>(null);
    const assistantRefForProvider = useRef<AICodeAssistantRef | null>(null);
    const kworkInputRefForProvider = useRef<HTMLTextAreaElement | null>(null);
    const aiResponseInputRefForProvider = useRef<HTMLTextAreaElement | null>(null);
    const prSectionRefForProvider = useRef<HTMLElement | null>(null);

    // Note: The refs created in ActualPageContent are distinct from these.
    // The provider *receives* these refs. The context hook (`useRepoXmlPageContext`)
    // will then make the *values* or *functions* derived from these refs available
    // to consumers like ActualPageContent or its children (AICodeAssistant, etc.).

    return (
        <RepoXmlPageProvider
            // Pass the refs created specifically for the provider
            fetcherRef={fetcherRefForProvider}
            assistantRef={assistantRefForProvider}
            kworkInputRef={kworkInputRefForProvider}
            aiResponseInputRef={aiResponseInputRefForProvider}
            prSectionRef={prSectionRefForProvider}
        >
            {/* Render the component that USES the context */}
            {/* ActualPageContent and its children can now safely call useRepoXmlPageContext */}
            <ActualPageContent />
        </RepoXmlPageProvider>
    );
}

// Export the main component wrapped in Suspense for useSearchParams
// This is the entry point component for this page route.
export default function RepoXmlPage() {
    // Use a generic loading message here, as language preference isn't known yet.
    const fallbackLoading = (
        <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
            <p className="text-brand-green animate-pulse text-xl font-mono">Loading SUPERVIBE...</p>
        </div>
    );

    return (
        <Suspense fallback={fallbackLoading}>
            {/* Render the LAYOUT component which provides the context */}
            <RepoXmlPageLayout />
        </Suspense>
    );
}