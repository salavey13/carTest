"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback } from "react";

import { useSearchParams } from 'next/navigation'; // Keep this import if used within ActualPageContent
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
import { FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong, FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye, FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner } from "react-icons/fa6"; // Ensure FaSpinner is imported
import Link from "next/link";
import * as FaIcons from "react-icons/fa6"; // Import all for dynamic render helper

// --- I18N Translations (with CyberVibe) ---
const translations = {
  en: { /* ... English translations ... */ loading: "Loading SUPERVIBE...", pageTitle: "SUPERVIBE STUDIO", welcome: "Yo,", intro1: "Still scared of 'code'? Forget that noise! This is the **FUTURE**, your personal code accelerant.", intro2: "Think of this like a magic playground. You have ideas? Cool. You speak 'em, AI builds 'em, I make sure it all works. Simple.", intro3: "Stop being a consumer, start being a CREATOR. This tool helps you build YOUR reality, solve YOUR problems, **validate ideas FAST**, maybe even make cash doing what YOU vibe with.", cyberVibeTitle: "Beyond Tools: Enter the CyberVibe ⚛️", cyberVibe1: "This ain't just about AI – it's a **feedback loop**, a compounding effect. Each interaction builds on the last.", cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> becomes your knowledge base, your **cyberchest**. The Studio & AI are your interface to **remix and transmute** that knowledge into new vibes, new features, instantly.", cyberVibe3: "You're not just learning Kung Fu; you're **remixing the training program** on the fly because you understand the structure through **interaction**.", cyberVibe4: "It's **co-creation** with the machine, pushing boundaries together. That 200kb bandwidth wasn't instant – it was earned. The goal? Infinite context. This is the **CyberVibe**.", philosophyTitle: "The Philosophy: Why This Works (Tap)", philosophy1: "This isn't just building apps. It's unlocking YOUR potential (like in", philosophyLink1: "/purpose-profit", philosophyLink1Text: "Purpose & Profit ideas", philosophy2: "). Stop chasing jobs, build YOUR world. You ARE the niche.", philosophy3: "AI isn't here to replace you. It's your superpower. Learn to leverage it (ideas in", philosophyLink2: "/selfdev", philosophyLink2Text: "SelfDev Path", philosophy4: "), or get left behind.", philosophy5: "This studio makes it easy. Grab ideas, talk to AI, see magic happen.", philosophy6: "**Validate first!** Use AI to check ideas *before* building (more in", philosophyLink3: "/selfdev#validation", philosophyLink3Text: "SelfDev Validation", philosophy7: "). Kill bad ideas fast.", stepsTitle: "Quick Vibe Guide:", step1Title: "1. Grab + Wish:", step1Desc: "Point -> Hit", step1DescEnd: "-> Pick -> Tell AI.", step2Title: "2. AI Magic -> Reality:", step2Desc: "Hit", step2Button: "Ask AI", step2DescMid: "-> Magic Assist", step2DescMid2: "-> Hit '➡️' -> Check", step2DescEnd: "-> Add / New!", readyButton: "OKAY, SHOW ME THE MAGIC!", componentsTitle: "Alright, Let's GO!", ctaTitle: "Ready to Vibe?", ctaDesc: "Seriously, {USERNAME}, stop hesitating.", ctaHotChick: "Hot chick? Hit me up **@SALAVEY13** NOW! Let's build!", ctaDude: "(Dudes? Try it. Good luck!)", navGrabber: "Grabber", navAssistant: "Assistant", navIntro: "Intro?!", navCyberVibe: "CyberVibe?!" },
  ru: { /* ... Russian translations ... */ loading: "Загрузка SUPERVIBE...", pageTitle: "SUPERVIBE СТУДИЯ", welcome: "Йоу,", intro1: "Все еще боишься 'кода'? Забудь! Это **БУДУЩЕЕ**, твой ускоритель.", intro2: "Это волшебная песочница. Есть идеи? Круто. Ты говоришь, AI строит, я проверяю. Просто.", intro3: "Хватит потреблять, стань ТВОРЦОМ. Строй СВОЮ реальность, решай СВОИ проблемы, **валидируй идеи БЫСТРО**, зарабатывай на своем вайбе.", cyberVibeTitle: "Больше чем Инструменты: Врубай CyberVibe ⚛️", cyberVibe1: "Дело не просто в AI – а в **петле обратной связи**, в накопительном эффекте. Каждое взаимодействие строится на предыдущем.", cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> становится твоей базой знаний, **кибер-сундуком**. Студия и AI – твой интерфейс для **ремикса и трансмутации** этих знаний в новые вайбы, фичи, мгновенно.", cyberVibe3: "Ты не просто учишь Кунг-Фу; ты **ремиксуешь программу обучения** на лету, потому что понимаешь структуру через **взаимодействие**.", cyberVibe4: "Это **со-творчество** с машиной, совместное расширение границ. Твои 200кб пропускной способности не взялись из ниоткуда – они заработаны. Цель? Бесконечный контекст. Это **CyberVibe**.", philosophyTitle: "Философия: Почему Работает (Жми)", philosophy1: "Не просто про приложения. Это про ТВОЙ потенциал (см.", philosophyLink1: "/purpose-profit", philosophyLink1Text: "Purpose & Profit", philosophy2: "). Строй СВОЙ мир. Ты = ниша.", philosophy3: "AI - твой ко-пилот. Используй его рычаги (идеи в", philosophyLink2: "/selfdev", philosophyLink2Text: "SelfDev", philosophy4: "), или останешься позади.", philosophy5: "Студия упрощает: Хватай -> Говори -> Магия.", philosophy6: "**Валидируй!** Проверь идею с AI *до* кода (см.", philosophyLink3: "/selfdev#validation", philosophyLink3Text: "SelfDev Валидацию", philosophy7: "). Убивай плохие идеи быстро.", stepsTitle: "Краткий Vibe-Гайд:", step1Title: "1. Хватай + Желай:", step1Desc: "Укажи -> Жми", step1DescEnd: "-> Выбери -> Скажи AI.", step2Title: "2. AI Магия -> Реальность:", step2Desc: "Жми", step2Button: "Ask AI", step2DescMid: "-> В Ассистент", step2DescMid2: "-> Жми '➡️' -> Проверь", step2DescEnd: "-> Добавь / Новая!", readyButton: "ОК, ПОКАЖИ МАГИЮ!", componentsTitle: "Ну Всё, Погнали!", ctaTitle: "Готов(а) Вайбить?", ctaDesc: "Серьезно, {USERNAME}, хватит думать.", ctaHotChick: "Горячая чика? Пиши **@SALAVEY13** СЕЙЧАС! Завайбим вместе!", ctaDude: "(Пацаны? Просто пробуйте. Удачи!)", navGrabber: "Граббер", navAssistant: "Ассистент", navIntro: "Интро?!", navCyberVibe: "CyberVibe?!" }
};
// --- End I18N ---

type Language = 'en' | 'ru';

// --- Fallback component for AutomationBuddy ---
function LoadingBuddyFallback() {
    return ( <div className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 animate-pulse" aria-hidden="true" ></div> );
}
// ------------------------------------------

// --- Helper Component to render content with icons and bold ---
const RenderContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    const segments = content.split(/(\*\*.*?\*\*|<Fa\w+\s*.*?\/?>|<\/?\w+(?:\s+[^>]*)*>)/g).filter(Boolean);
    return (
        <>
            {segments.map((segment, sIndex) => {
                if (segment.startsWith('**') && segment.endsWith('**')) { return <strong key={sIndex}>{segment.slice(2, -2)}</strong>; }
                const iconMatch = segment.match(/<Fa(\w+)\s*(?:class(?:Name)?="([^"]*)")?\s*\/?>/i);
                if (iconMatch) {
                    const iconName = `Fa${iconMatch[1]}` as keyof typeof FaIcons;
                    const className = iconMatch[2] || "";
                    const IconComponent = FaIcons[iconName];
                    if (IconComponent) {
                        const finalClassName = `${className} inline-block align-middle mx-1`;
                        return React.createElement(IconComponent, { key: sIndex, className: finalClassName });
                    } else { logger.warn(`[RenderContent] Icon "${iconName}" not found.`); return <span key={sIndex} className="text-red-500 font-mono">[? {iconName}]</span>; }
                }
                const htmlTagMatch = segment.match(/^<\/?\w+(?:\s+[^>]*)*>$/);
                if (htmlTagMatch || segment.startsWith('<Link') || segment.startsWith('<a')) { return <span key={sIndex} dangerouslySetInnerHTML={{ __html: segment }} />; }
                return <React.Fragment key={sIndex}>{segment}</React.Fragment>;
            })}
        </>
    );
});
RenderContent.displayName = 'RenderContent';

// --- ActualPageContent Component (Needs to read params, so it uses useSearchParams) ---
function ActualPageContent() {
    const localFetcherRef = useRef<RepoTxtFetcherRef | null>(null);
    const localAssistantRef = useRef<AICodeAssistantRef | null>(null);
    const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
    const prSectionRef = useRef<HTMLElement | null>(null);
    const { user } = useAppContext();
    const {
        setImageReplaceTask,
        fetcherRef: contextFetcherRef,
        assistantRef: contextAssistantRef,
        kworkInputRef: contextKworkInputRef,
        setKworkInputHasContent,
        fetchStatus,
        imageReplaceTask,
        allFetchedFiles,
        selectedFetcherFiles, // Get context selection state
    } = useRepoXmlPageContext();
    const [isMounted, setIsMounted] = useState(false);
    const [lang, setLang] = useState<Language>('en');
    const [showComponents, setShowComponents] = useState(false);
    const searchParams = useSearchParams();

    // --- State to hold the idea from URL ---
    const [initialIdea, setInitialIdea] = useState<string | null>(null);
    const [initialIdeaProcessed, setInitialIdeaProcessed] = useState<boolean>(false);

    // --- Link refs to context ---
    useEffect(() => {
        if (localFetcherRef.current && contextFetcherRef) contextFetcherRef.current = localFetcherRef.current;
        if (localAssistantRef.current && contextAssistantRef) contextAssistantRef.current = localAssistantRef.current;
    }, [contextFetcherRef, contextAssistantRef, localFetcherRef, localAssistantRef]);

    // --- Effect 1: Process URL Params and Set Initial State ---
    useEffect(() => {
      setIsMounted(true);
      const bL = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const tL = user?.language_code;
      const iL = tL === 'ru' || (!tL && bL === 'ru') ? 'ru' : 'en';
      setLang(iL);
      logger.log(`[ActualPageContent Effect 1] Lang: ${iL}`);

      const pP = searchParams.get("path");
      const iP = searchParams.get("idea");

      if (pP && iP) {
          const dI = decodeURIComponent(iP);
          const dP = decodeURIComponent(pP);
          if (dI.startsWith("ImageReplace|")) {
              logger.log("[ActualPageContent Effect 1] Img Replace task.");
              try {
                  const pts = dI.split('|');
                  const oUP = pts.find(p => p.startsWith("OldURL="));
                  const nUP = pts.find(p => p.startsWith("NewURL="));
                  if (oUP && nUP) {
                      const oU = decodeURIComponent(oUP.substring(7));
                      const nU = decodeURIComponent(nUP.substring(7));
                      if (dP && oU && nU) {
                          const task: ImageReplaceTask = { targetPath: dP, oldUrl: oU, newUrl: nU };
                          logger.log("[ActualPageContent Effect 1] Setting img task:", task);
                          setImageReplaceTask(task);
                          setInitialIdea(null);
                          setInitialIdeaProcessed(true);
                      } else { logger.error("[ActualPageContent Effect 1] Invalid img task data:", { dP, oU, nU }); setImageReplaceTask(null); }
                  } else { logger.error("[ActualPageContent Effect 1] Could not parse Old/New URL:", dI); setImageReplaceTask(null); }
              } catch (e) { logger.error("[ActualPageContent Effect 1] Error parsing img task:", e); setImageReplaceTask(null); }
          } else {
              logger.log("[ActualPageContent Effect 1] Regular idea param found, storing:", dI);
              setInitialIdea(dI);
              setImageReplaceTask(null);
              setInitialIdeaProcessed(false);
          }
          setShowComponents(true);
      } else {
          setImageReplaceTask(null);
          setInitialIdea(null);
          setInitialIdeaProcessed(true);
          logger.log("[ActualPageContent Effect 1] No params.");
      }
    }, [user, searchParams, setImageReplaceTask]);


    // --- Effect 2: Populate Kwork Input AFTER Initial Fetch Attempt ---
    useEffect(() => {
      const fetchAttemptFinished = isMounted && (fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries');

      if (fetchAttemptFinished && initialIdea && !initialIdeaProcessed && !imageReplaceTask) {
          logger.log(`[ActualPageContent Effect 2] Fetch finished (${fetchStatus}). Populating kwork with stored idea:`, initialIdea.substring(0,50) + "...");
          if (contextKworkInputRef.current) {
              // Set the idea text first
              contextKworkInputRef.current.value = initialIdea;
              const inputEvent = new Event('input', { bubbles: true });
              contextKworkInputRef.current.dispatchEvent(inputEvent);
              setKworkInputHasContent(initialIdea.trim().length > 0);
              logger.log("[ActualPageContent Effect 2] Populated kwork input via context ref.");

              // Now, trigger adding the selected files to this idea text
              if (contextFetcherRef.current?.handleAddSelected) {
                    // Ensure files have been potentially auto-selected by Fetcher before calling this
                    // Check if selection state has files (it should have been updated by Fetcher)
                    if (selectedFetcherFiles.size > 0) {
                        logger.log("[ActualPageContent Effect 2] Calling fetcherRef.handleAddSelected to append auto-selected files to the idea.");
                        // Pass undefined to use the context's selection state
                        contextFetcherRef.current.handleAddSelected(undefined, allFetchedFiles)
                            .then(() => logger.log("[ActualPageContent Effect 2] handleAddSelected call finished."))
                            .catch(err => logger.error("[ActualPageContent Effect 2] Error calling handleAddSelected:", err));
                    } else {
                        logger.log("[ActualPageContent Effect 2] Skipping handleAddSelected as context selection is empty.");
                    }
              } else {
                   logger.warn("[ActualPageContent Effect 2] fetcherRef.current.handleAddSelected not available.");
              }

              // Scroll to kwork input
               const kworkElement = document.getElementById('kwork-input-section');
               if (kworkElement) {
                    setTimeout(() => { // Delay scroll slightly
                        kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        logger.log("[ActualPageContent Effect 2] Scrolled to kwork input.");
                    }, 200); // Increased delay slightly more
               }

          } else {
              logger.warn("[ActualPageContent Effect 2] Context kworkInputRef is null when trying to populate idea.");
          }
          setInitialIdeaProcessed(true); // Mark as processed
      } else if (fetchAttemptFinished && !initialIdeaProcessed) {
          setInitialIdeaProcessed(true);
           logger.log(`[ActualPageContent Effect 2] Fetch finished (${fetchStatus}), no pending idea to process.`);
      }
    // Added selectedFetcherFiles dependency to ensure handleAddSelected uses updated selection
    }, [isMounted, fetchStatus, initialIdea, initialIdeaProcessed, imageReplaceTask, contextKworkInputRef, setKworkInputHasContent, contextFetcherRef, allFetchedFiles, selectedFetcherFiles]);

    const t = translations[lang];
    const userName = user?.first_name || (lang === 'ru' ? 'Чувак/Чика' : 'Dude/Chica');

    const scrollToSectionNav = (id: string) => {
        if (['extractor', 'executor', 'cybervibe-section'].includes(id)) {
            if (!showComponents) {
                setShowComponents(true);
                setTimeout(() => {
                    const el = document.getElementById(id);
                    if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 80, behavior: 'smooth' });
                    else logger.error(`Scroll target "${id}" not found after revealing.`);
                }, 100);
                return;
            }
        }
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 80, behavior: 'smooth' });
        } else {
            logger.error(`Scroll target "${id}" not found.`);
        }
    };

    // Render loading state based on isMounted
    if (!isMounted) {
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang].loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }

    return (
        <>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
            <div className="min-h-screen bg-gray-950 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">
                {/* Intro Section */}
                <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                     <div className="flex justify-center mb-4"> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12"> <path fill="#333" d="M0 0h200v100H0z"/><path fill="#E1FF01" d="M50 20h100v60H50z"/><path fill="#444" d="M60 30h80v40H60z"/><path fill="#E1FF01" d="M70 40h60v20H70z"/><path fill="#555" d="M80 45h40v10H80z"/><path fill="#E1FF01" d="M90 48h20v4H90z"/><path fill="#333" d="M40 10h120v80H40z" opacity=".1"/><path fill="url(#a)" d="M0 0h200v100H0z"/> <defs> <radialGradient id="a" cx="50%" cy="50%" r="70%" fx="50%" fy="50%"> <stop offset="0%" stop-color="#fff" stop-opacity=".1"/> <stop offset="100%" stop-color="#fff" stop-opacity="0"/> </radialGradient> </defs> </svg> </div>
                    <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse"> {t.pageTitle} </h1>
                    <p className="text-xl text-gray-200 mt-4 font-semibold"> {t.welcome} <span className="text-brand-cyan">{userName}!</span> </p>
                    <p className="text-lg text-gray-300 mt-2"><RenderContent content={t.intro1} /></p>
                    <p className="text-lg text-gray-300 mt-2"><RenderContent content={t.intro2} /></p>
                    <p className="text-lg text-gray-300 mt-2"><RenderContent content={t.intro3} /></p>
                </section>

                {/* === CyberVibe Section === */}
                <section id="cybervibe-section" className="mb-12 w-full max-w-3xl">
                     <Card className="bg-gradient-to-br from-purple-900/30 via-black/50 to-blue-900/30 border border-purple-600/50 shadow-xl rounded-lg p-6">
                         <CardHeader className="p-0 mb-4"> <CardTitle className="text-2xl font-bold text-center text-brand-purple flex items-center justify-center gap-2"> <FaAtom className="animate-spin-slow"/> {t.cyberVibeTitle} <FaBrain className="animate-pulse"/> </CardTitle> </CardHeader>
                         <CardContent className="p-0 text-gray-300 text-base space-y-3"> <p><RenderContent content={t.cyberVibe1} /></p> <p><RenderContent content={t.cyberVibe2} /></p> <p><RenderContent content={t.cyberVibe3} /></p> <p><RenderContent content={t.cyberVibe4} /></p> </CardContent>
                     </Card>
                 </section>

                {/* Philosophy & Steps Section */}
                <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                    <details className="bg-gray-900/70 border border-gray-700 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4">
                        <summary className="text-xl font-semibold text-brand-purple p-4 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800/50 rounded-t-lg"> <span>{t.philosophyTitle}</span> </summary>
                        <div className="px-6 pt-2 text-gray-300 space-y-3 text-base">
                            <p> <RenderContent content={t.philosophy1 + " "} /> <Link href={t.philosophyLink1} className="text-brand-purple hover:underline font-semibold"> <RenderContent content={t.philosophyLink1Text} /> <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1" /> </Link> <RenderContent content={" " + t.philosophy2} /> </p>
                            <p> <RenderContent content={t.philosophy3 + " "} /> <Link href={t.philosophyLink2} className="text-brand-blue hover:underline font-semibold"> <RenderContent content={t.philosophyLink2Text} /> <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1" /> </Link> <RenderContent content={t.philosophy4} /> </p>
                            <p><RenderContent content={t.philosophy5} /></p>
                            <p className="font-semibold text-yellow-400 flex items-start gap-1"> <FaBullseye className="inline-block h-4 w-4 text-yellow-500 mr-1 mt-1 flex-shrink-0"/> <span> <RenderContent content={t.philosophy6 + " "} /> <a href={t.philosophyLink3} className="text-brand-yellow hover:underline font-semibold"> <RenderContent content={t.philosophyLink3Text} /> <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1"/> </a> <RenderContent content={" " + t.philosophy7} /> </span> </p>
                            <hr className="border-gray-700 my-4"/>
                            <h4 className="text-lg font-semibold text-cyan-400 pt-2">{t.stepsTitle}</h4>
                            <div className="text-sm space-y-2">
                                 <p><RenderContent content={`<strong class="text-cyan-500">${t.step1Title}</strong> ${t.step1Desc} <FaDownload class="inline mx-1 text-blue-400"/> ${t.step1DescEnd}`} /></p>
                                 <p><RenderContent content={`<strong class="text-cyan-500">${t.step2Title}</strong> ${t.step2Desc} <span class="text-blue-400 font-semibold">"🤖 ${t.step2Button}"</span> ${t.step2DescMid} <FaRobot class="inline mx-1 text-purple-400"/> ${t.step2DescMid2} <FaWandMagicSparkles class="inline mx-1 text-yellow-400" /> ${t.step2DescEnd} <FaGithub class="inline mx-1 text-green-400" />`} /></p>
                            </div>
                        </div>
                    </details>
                </section>

                {/* Reveal Button */}
                {!showComponents && ( <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center"> <Button onClick={() => setShowComponents(true)} className="bg-gradient-to-r from-green-500 to-cyan-500 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce" size="lg"> <FaHandSparkles className="mr-2"/> {t.readyButton} </Button> </section> )}

                {/* WORKHORSE Components */}
                {showComponents && (
                     <>
                        <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse">{t.componentsTitle}</h2>
                         <section id="extractor" className="mb-12 w-full max-w-4xl"> <Card className="bg-gray-900/80 border border-blue-700/50 shadow-lg"> <CardContent className="p-4"> <RepoTxtFetcher ref={localFetcherRef} /> </CardContent> </Card> </section>
                        <section id="executor" ref={prSectionRef} className="mb-12 w-full max-w-4xl pb-16"> <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg"> <CardContent className="p-4"> <AICodeAssistant ref={localAssistantRef} kworkInputRefPassed={contextKworkInputRef} aiResponseInputRefPassed={aiResponseInputRef} /> </CardContent> </Card> </section>
                     </>
                 )}

                {/* Final CTA */}
                 {showComponents && ( <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center"> <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50"> <h3 className="text-2xl font-bold text-white mb-3">{t.ctaTitle}</h3> <p className="text-white text-lg mb-4"> {t.ctaDesc.replace('{USERNAME}', userName)} </p> <p className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded"> <FaHeart className="inline mr-2 text-red-400 animate-ping"/> <RenderContent content={t.ctaHotChick} /> <FaUserAstronaut className="inline ml-2 text-pink-300"/> </p> <p className="text-gray-300 text-base"> {t.ctaDude} </p> </div> </section> )}

                {/* Navigation Icons */}
                 <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40"> <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition shadow-md" title={t.navIntro}> <FaCircleInfo className="text-lg text-gray-200" /> </button> <button onClick={() => scrollToSectionNav("cybervibe-section")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition shadow-md" title={t.navCyberVibe}> <FaAtom className="text-lg text-white" /> </button> {showComponents && ( <> <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition shadow-md" title={t.navGrabber}> <FaDownload className="text-lg text-white" /> </button> <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition shadow-md" title={t.navAssistant}> <FaRobot className="text-lg text-white" /> </button> </> )} </nav>

                {/* Wrap AutomationBuddy in Suspense */}
                <Suspense fallback={<LoadingBuddyFallback />}> <AutomationBuddy /> </Suspense>
            </div>
        </>
    );
}

// --- Layout Component & Suspense ---
function RepoXmlPageLayout() {
    const fetcherRefForProvider = useRef<RepoTxtFetcherRef | null>(null); const assistantRefForProvider = useRef<AICodeAssistantRef | null>(null); const kworkInputRefForProvider = useRef<HTMLTextAreaElement | null>(null); const aiResponseInputRefForProvider = useRef<HTMLTextAreaElement | null>(null); const prSectionRefForProvider = useRef<HTMLElement | null>(null);
    return ( <RepoXmlPageProvider fetcherRef={fetcherRefForProvider} assistantRef={assistantRefForProvider} kworkInputRef={kworkInputRefForProvider} aiResponseInputRef={aiResponseInputRefForProvider} prSectionRef={prSectionRefForProvider} > <ActualPageContent /> </RepoXmlPageProvider> );
}

// --- Exported Page Component ---
export default function RepoXmlPage() {
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en'; const fallbackLoadingText = translations[fallbackLoadingLang].loading;
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p> </div> );
    return ( <Suspense fallback={fallbackLoading}> <RepoXmlPageLayout /> </Suspense> );
}