"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useSearchParams } from 'next/navigation';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, RepoXmlPageProvider,
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask,
    RepoXmlPageContextType, FileNode // Import FileNode here if used locally
} from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger"; // Use logger
import { useAppToast } from "@/hooks/useAppToast"; // Use toast hook
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong, // Added FaUpLong
    FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye,
    FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner, FaBolt,
    FaToolbox, // Corrected: FaTools -> FaToolbox
    FaCode, FaVideo, FaDatabase, FaBug, FaMicrophone, FaLink, FaServer, FaRocket
} from "react-icons/fa6"; // Keep icon imports for direct use if any (like in buttons)
import Link from "next/link";
import { motion } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer'; // <-- Keep this import
import * as repoUtils from "@/lib/repoUtils"; // <-- Import for effect dependency


// --- I18N Translations (Corrected FaToolbox) ---
const translations = {
  en: {
    loading: "Booting SUPERVIBE ENGINE...",
    pageTitle: "SUPERVIBE STUDIO 2.0",
    welcome: "Yo,",
    intro1: "Code scary? Forget that noise! This is the <strong>NOW</strong>. Your personal <strong>dev accelerator</strong>. Instant Level UP!",
    intro2: "Think: Magic Playground. Got ideas? Speak 'em. AI builds, system checks, PR ships. <strong>Boom.</strong> You guide the process.",
    intro3: "Stop consuming, start <strong>CREATING</strong>. Build YOUR reality, crush YOUR problems, <strong>validate ideas INSTANTLY</strong>. This is how you vibe.",
    cyberVibeTitle: "The Vibe Loop: Your Level Up Engine <FaUpLong/>",
    cyberVibe1: "This ain't just tools – it's a <strong>compounding feedback loop</strong>. Every action levels you up, makes the next step easier. You evolve.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400 align-baseline'/> is your <strong>cyberchest</strong>. This Studio + AI? Your interface to <strong>remix and transmute</strong> that knowledge into new vibes, features, fixes... <strong>instantly</strong>.", // Added align-baseline
    cyberVibe3: "You're not <em>learning</em> code; you're <strong>remixing the matrix</strong>. You interact, you understand structure, you <strong>command the AI</strong>. You're the Vibe Master.",
    cyberVibe4: "It's <strong>co-creation</strong> with the machine. Push boundaries. Earn bandwidth. Infinite context. Infinite power. This is <strong>CYBERVIBE 2.0</strong>.",
    philosophyTitle: "Your Vibe Path: The Inevitable Level Up (Tap)",
    philosophyVideoTitle: "Watch: The Level System Explained <FaVideo/>:",
    philosophyCore: "The secret? <strong>You're not asking the bot for help, YOU are helping the BOT</strong>. Each level adds <strong>+1 Vibe Perk</strong>, one more click, one more skill to guide the AI. It's not a grind, it's evolution. You get lazy doing the old stuff, so you <em>automatically</em> level up. And there's <strong>NO GOING BACK!</strong>",
    philosophyLvl0_1: "<strong>Lv.0 -> 1 <FaBolt/> (Instant Win):</strong> Fix a broken image. Copy URL -> Paste -> Upload new -> <strong>DONE</strong>. System auto-PRs. <strong>ANYONE</strong> can do this <em>NOW</em>. This is your entry point.",
    philosophyLvl1_2: "<strong>Lv.1 -> 2 <FaToolbox/> (+1 File/AI):</strong> Simple idea? Change text/button? Give AI the idea + 1 file context -> PR. <strong>DONE.</strong>", // Corrected: FaTools -> FaToolbox
    philosophyLvl2_3: "<strong>Lv.2 -> 3 <FaCode/> (+Multi-File):</strong> Slightly complex? 2-5 files? Give AI idea + context -> Check -> PR. <strong>DONE.</strong>",
    philosophyLvl3_4: "<strong>Lv.3 -> 4 <FaBug/> (+Log Check):</strong> Build failed? Runtime error? 99% it's a bad icon! Check Vercel logs (link in PR comment!) -> Copy red lines -> Feed error to AI -> <strong>FIXED.</strong> +1 Vibe Perk: Debugging.",
    philosophyLvl4_5: "<strong>Lv.4 -> 5 <FaLink/> (+Icon Hunt):</strong> Tired of icon errors? Find the <em>perfect</em> Fa6 icon yourself! Use <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold px-1'>FontAwesome Search <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/></a> -> Add link to Assistant Quick Links -> Fix icons proactively. +1 Perk: Resourcefulness.", // Added align-baseline/spacing
    philosophyLvl5_6: "<strong>Lv.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Multimedia):</strong> Use audio commands! Attach videos! Watch them turn into page content automatically. +1 Perk: Multi-modal Input.",
    philosophyLvl6_7: "<strong>Lv.6 -> 7 <FaDatabase/> (+SQL/DB):</strong> Discover new file types! AI generates SQL -> Paste into Supabase (1 click) -> <strong>DONE.</strong> Same flow, different context. +1 Perk: Data Handling.",
    philosophyLvl8_10: "<strong>Lv.8-10+ <FaServer/>/<FaRocket/> (+Independence):</strong> Deploy your OWN CyberVibe! Use/steal my Supabase! Set your own Bot Token! Build your own XTRs! <strong>UNLIMITED POWER!</strong>",
    philosophyEnd: "Step-by-step, level-up is <strong>inevitable</strong>. You're too lazy for the old shit. One extra click, one new skill, and you're automatically stronger. Welcome, <strong>Neo</strong>.",
    stepsTitle: "Quick Start Guide:",
    step1Title: "1. Grab Repo / Point Wish:",
    step1Desc: "Enter GitHub URL -> Hit <FaDownload class='inline mx-1 text-purple-400 align-baseline'/> OR Spot bug/idea -> Activate Buddy <FaRobot class='inline mx-1 text-indigo-400 align-baseline'/> -> Describe.", // Added align-baseline
    step1DescEnd: "For images (Lv.1): Copy broken URL, paste in Buddy/Input.",
    step2Title: "2. AI Magic & Ship:",
    step2Desc: "If needed (Lv.2+), use <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Check Assistant <FaWandMagicSparkles class='inline mx-1 text-yellow-400 align-baseline'/> -> Hit <FaGithub class='inline mx-1 text-green-400 align-baseline'/> PR Button.", // Added align-baseline
    step2DescEnd: "<strong>DONE.</strong> Site updates automagically.",
    readyButton: "LET'S F*CKING GO!",
    componentsTitle: "Engage Vibe Engines!",
    ctaTitle: "Ready to Ascend, {USERNAME}?",
    ctaDesc: "Seriously. Stop doubting. Start <strong>DOING</strong>. That first level is calling. Level up NOW!",
    ctaHotChick: "Got the fire? Let's build something epic. Hit me up <strong>@SALAVEY13</strong> NOW!",
    ctaDude: "(Everyone else? Just f*cking try it. Level 1 is a button click away. You got this!)",
    navGrabber: "Grabber <FaDownload/>",
    navAssistant: "Assistant <FaRobot/>",
    navIntro: "Intro <FaCircleInfo/>",
    navCyberVibe: "Vibe Loop <FaUpLong/>",
  },
  ru: { // --- RUSSIAN TRANSLATIONS (Corrected FaToolbox) ---
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    welcome: "Йоу,",
    intro1: "Код пугает? Забудь! Это <strong>СЕЙЧАС</strong>. Твой личный <strong>dev-ускоритель</strong>. Мгновенный Level UP!",
    intro2: "Думай: Волшебная Песочница. Есть идеи? Говори. AI строит, система чекает, PR улетает. <strong>Бум.</strong> Ты рулишь процессом.",
    intro3: "Хватит потреблять, стань <strong>ТВОРЦОМ</strong>. Строй СВОЮ реальность, решай СВОИ проблемы, <strong>валидируй идеи МГНОВЕННО</strong>. Вот это вайб.",
    cyberVibeTitle: "Петля Вайба: Твой Движок Прокачки <FaUpLong/>",
    cyberVibe1: "Это не просто тулзы – это <strong>накопительная петля обратной связи</strong>. Каждое действие качает тебя, делает следующий шаг легче. Ты эволюционируешь.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400 align-baseline'/> - твой <strong>кибер-сундук</strong>. Эта Студия + AI? Твой интерфейс для <strong>ремикса и трансмутации</strong> этих знаний в новые вайбы, фичи, фиксы... <strong>мгновенно</strong>.", // Added align-baseline
    cyberVibe3: "Ты не <em>учишь</em> код; ты <strong>ремиксуешь матрицу</strong>. Взаимодействуешь, понимаешь структуру, <strong>командуешь AI</strong>. Ты - Вайб Мастер.",
    cyberVibe4: "Это <strong>со-творчество</strong> с машиной. Двигай границы. Зарабатывай bandwidth. Бесконечный контекст. Бесконечная мощь. Это <strong>CYBERVIBE 2.0</strong>.",
    philosophyTitle: "Твой Путь Вайба: Неизбежный Level Up (Жми)",
    philosophyVideoTitle: "Смотри: Объяснение Системы Уровней <FaVideo/>:",
    philosophyCore: "Секрет? <strong>Не ты просишь бота помочь, а ТЫ помогаешь БОТУ</strong>. Каждый левел дает <strong>+1 Вайб Перк</strong>, +1 клик, +1 скилл, чтобы направлять AI. Это не гринд, это эволюция. Тебе становится лень делать старое, и ты <em>автоматически</em> апаешь левел. И <strong>НАЗАД ДОРОГИ НЕТ!</strong>",
    philosophyLvl0_1: "<strong>Лв.0 -> 1 <FaBolt/> (Мгновенный Вин):</strong> Починить битую картинку. Скопируй URL -> Вставь -> Загрузи новую -> <strong>ГОТОВО</strong>. Система авто-PR. <strong>ЛЮБОЙ</strong> может это <em>ПРЯМО СЕЙЧАС</em>. Это твой вход.",
    philosophyLvl1_2: "<strong>Лв.1 -> 2 <FaToolbox/> (+1 Файл/AI):</strong> Простая идея? Текст/кнопку поменять? Дай AI идею + 1 файл контекста -> PR. <strong>ГОТОВО.</strong>", // Corrected: FaTools -> FaToolbox
    philosophyLvl2_3: "<strong>Лв.2 -> 3 <FaCode/> (+Мульти-Файл):</strong> Чуть сложнее? 2-5 файлов? Дай AI идею + контекст -> Проверь -> PR. <strong>ГОТОВО.</strong>",
    philosophyLvl3_4: "<strong>Лв.3 -> 4 <FaBug/> (+Чек Логов):</strong> Упала сборка? Ошибка в рантайме? 99% - еб*ная иконка! Открой логи Vercel (ссылка в комменте PR!) -> Скопируй красные строки -> Скорми ошибку AI -> <strong>ПОЧИНЕНО.</strong> +1 Вайб Перк: Дебаггинг.",
    philosophyLvl4_5: "<strong>Лв.4 -> 5 <FaLink/> (+Охота за Иконками):</strong> Зае*али ошибки иконок? Найди <em>идеальную</em> Fa6 иконку сам! Юзай <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold px-1'>Поиск FontAwesome <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/></a> -> Добавь в Быстрые Ссылки Ассистента -> Фикси иконки проактивно. +1 Перк: Находчивость.", // Added align-baseline/spacing
    philosophyLvl5_6: "<strong>Лв.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Мультимедиа):</strong> Используй аудио-команды! Прикрепляй видосы! Смотри, как они автоматом становятся контентом страницы. +1 Перк: Мультимодальный Ввод.",
    philosophyLvl6_7: "<strong>Лв.6 -> 7 <FaDatabase/> (+SQL/БД):</strong> Открой новые типы файлов! AI генерит SQL -> Вставь в Supabase (1 клик) -> <strong>ГОТОВО.</strong> Тот же флоу, другой контекст. +1 Перк: Работа с Данными.",
    philosophyLvl8_10: "<strong>Лв.8-10+ <FaServer/>/<FaRocket/> (+Независимость):</strong> Разверни свой CyberVibe! Юзай/спи*ди мою Supabase! Поставь свой Токен Бота! Строй свои XTR-ы! <strong>БЕЗГРАНИЧНАЯ МОЩЬ!</strong>",
    philosophyEnd: "Шаг за шагом, левел-ап <strong>неизбежен</strong>. Тебе слишком лень для старой х*йни. Один лишний клик, один новый скилл - и ты автоматом сильнее. Добро пожаловать, <strong>Нео</strong>.",
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400 align-baseline'/> ИЛИ Видишь баг/идею -> Вызови Бадди <FaRobot class='inline mx-1 text-indigo-400 align-baseline'/> -> Опиши.", // Added align-baseline
    step1DescEnd: "Для картинок (Лв.1): Скопируй битый URL, вставь Бадди/в Инпут.",
    step2Title: "2. AI Магия & Отправка:",
    step2Desc: "Если нужно (Лв.2+), юзай <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Проверь Ассистента <FaWandMagicSparkles class='inline mx-1 text-yellow-400 align-baseline'/> -> Жми <FaGithub class='inline mx-1 text-green-400 align-baseline'/> Кнопку PR.", // Added align-baseline
    step2DescEnd: "<strong>ГОТОВО.</strong> Сайт обновляется авто-магически.",
    readyButton: "ПОГНАЛИ, БЛ*ТЬ!",
    componentsTitle: "Врубай Движки Вайба!",
    ctaTitle: "Готов(а) к Вознесению, {USERNAME}?",
    ctaDesc: "Серьезно. Хватит сомневаться. Начни <strong>ДЕЛАТЬ</strong>. Первый левел зовет. Качайся СЕЙЧАС!",
    ctaHotChick: "Есть искра? Давай замутим что-то эпичное. Пиши <strong>@SALAVEY13</strong> СЕЙЧАС!",
    ctaDude: "(Все остальные? Просто, бл*ть, попробуйте. Левел 1 - это клик мышки. У вас получится!)",
    navGrabber: "Граббер <FaDownload/>",
    navAssistant: "Ассистент <FaRobot/>",
    navIntro: "Интро <FaCircleInfo/>",
    navCyberVibe: "Петля Вайба <FaUpLong/>",
  }
};
// --- End I18N ---

type Language = 'en' | 'ru';
type TranslationSet = typeof translations['en'];

// --- Fallback component for AutomationBuddy ---
function LoadingBuddyFallback() {
    return ( <div className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 animate-pulse" aria-hidden="true" ></div> );
}

// --- getPlainText helper (Restored) ---
const getPlainText = (htmlString: string | null | undefined): string => {
    // logger.debug("[getPlainText] Stripping HTML:", htmlString ? htmlString.substring(0, 50) + "..." : "null/undefined");
    if (typeof htmlString !== 'string' || !htmlString) { return ''; }
    try {
        // Remove potential icon tags AND placeholders first
        let text = htmlString.replace(/<Fa[A-Z][a-zA-Z0-9]+(?:\s+[^>]*?)?\s*\/?>/g, ''); // Remove <Fa...> tags
        text = text.replace(/\[\?\]/g, ''); // Remove [?] placeholder
        text = text.replace(/\[ICON ERR!\]/g, ''); // Remove [ICON ERR!] placeholder
        // Remove other HTML tags
        text = text.replace(/<[^>]*>/g, '');
        // Decode common HTML entities
        return text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    } catch (e) {
        // Use console.error as logger might not be defined if this helper is called very early
        console.error("[getPlainText] Error stripping HTML for title:", e, "Input:", htmlString);
        return htmlString; // Return original on error
    }
};


// --- ActualPageContent Component ---
function ActualPageContent() {
    // --- Logging Setup (Console fallback) ---
    const log = typeof logger !== 'undefined' ? logger.log : console.log;
    const debug = typeof logger !== 'undefined' ? logger.debug : console.debug;
    const warn = typeof logger !== 'undefined' ? logger.warn : console.warn;
    const error = typeof logger !== 'undefined' ? logger.error : console.error;

    log("[ActualPageContent] START Render - Top Level");

    // --- HOOKS (MUST be called at the top level unconditionally) ---
    const { user } = useAppContext();
    log("[ActualPageContent] useAppContext DONE");
    const pageContext = useRepoXmlPageContext();
    log("[ActualPageContent] useRepoXmlPageContext DONE");
    const { info: toastInfo, error: toastError } = useAppToast();
    log("[ActualPageContent] useAppToast DONE");

    // --- State Initialization ---
    log("[ActualPageContent] Initializing State...");
    const [lang, setLang] = useState<Language>('en');
    const [initialIdea, setInitialIdea] = useState<string | null>(null);
    const [initialIdeaProcessed, setInitialIdeaProcessed] = useState<boolean>(false);
    const [t, setT] = useState<TranslationSet | null>(null);
    const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
    const [searchParamsReady, setSearchParamsReady] = useState(false); // <<< NEW State
    const [searchParamsError, setSearchParamsError] = useState<Error | null>(null); // <<< NEW State
    const [highlightedPathProp, setHighlightedPathProp] = useState<string | null>(null);
    const [ideaProp, setIdeaProp] = useState<string | null>(null);
    log("[ActualPageContent] useState DONE");


    // --- useSearchParams Hook Call (MUST BE UNCONDITIONAL, with error handling) ---
    let searchParams: URLSearchParams | null = null;
    try {
        searchParams = useSearchParams();
        // Check if searchParams is not null to signal readiness
        if (searchParams !== null && !searchParamsReady && searchParamsError === null) {
             debug("[ActualPageContent] useSearchParams() call SUCCEEDED in this render.");
             setSearchParamsReady(true); // Signal readiness only if not already ready/errored
        }
    } catch (e: any) {
        // Catch potential errors *during* the hook call (e.g., if used outside Suspense)
        if (searchParamsError === null) { // Only set error if not already set
            error("[ActualPageContent] useSearchParams() call FAILED:", e);
            setSearchParamsError(e);
            setSearchParamsReady(false); // Ensure not ready on error
        }
    }

    // --- CONTEXT VALIDATION ---
    if (!pageContext || typeof pageContext.addToast !== 'function') {
         error("[ActualPageContent] CRITICAL: RepoXmlPageContext is missing or invalid!");
         return <div className="text-red-500 p-4">Критическая ошибка: Контекст страницы не загружен.</div>;
    }
    log("[ActualPageContent] pageContext check passed.");

    // --- Destructure context ---
    const {
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef,
        setImageReplaceTask, setKworkInputHasContent, fetchStatus,
        imageReplaceTask, allFetchedFiles, selectedFetcherFiles,
        repoUrl, setRepoUrl, addToast,
        targetPrData, setTargetPrData,
        isPreChecking, setPendingFlowDetails,
        pendingFlowDetails,
        setTargetBranchName, setManualBranchName, // Needed for URL param effect
        showComponents, setShowComponents // Get showComponents state and setter
    } = pageContext;

    // --- Effects ---
    useEffect(() => {
        log("[ActualPageContent Effect] Client-side hydration detection.");
        // Consider page loaded when translations are available AND searchParams are ready (or errored)
        setIsPageLoading(!t || (!searchParamsReady && !searchParamsError));
        return () => { log("[ActualPageContent Effect] Unmounting."); };
    }, [t, searchParamsReady, searchParamsError]); // Depend on translation and searchParams readiness/error

    useEffect(() => {
      debug("[Effect Lang] START");
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const resolvedLang = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(resolvedLang);
      const newTranslations = translations[resolvedLang] ?? translations.en;
      setT(newTranslations);
      // Don't set loading false here, let the other effect handle it based on t AND searchParams
      log(`[Effect Lang] Language set to: ${resolvedLang}. Translations loaded.`);
    }, [user]); // Only depends on user

    // --- Effect for URL Params (Depends on searchParamsReady) ---
    useEffect(() => {
        // !! CRITICAL !!: Only run if searchParams hook is ready and didn't error
        if (!searchParamsReady) {
            if (searchParamsError) { warn("[Effect URL Params] Skipping effect, searchParams hook failed to initialize."); }
            else { log("[Effect URL Params] Skipping effect, searchParams hook not ready yet."); }
            // Only mark as processed if params failed, otherwise wait for them
            if (searchParamsError) setInitialIdeaProcessed(true);
            // --- Reset props if params not ready/errored ---
            setHighlightedPathProp(null);
            setIdeaProp(null);
            return;
        }
        // Additional safety check, though searchParamsReady should cover this
        if (!searchParams) {
            error("[Effect URL Params] Skipping effect, searchParams object is unexpectedly null despite being ready.");
            setInitialIdeaProcessed(true);
            setHighlightedPathProp(null);
            setIdeaProp(null);
            return;
        }

        // Proceed only if searchParams are ready and valid
        debug("[Effect URL Params] START (searchParams are ready and valid)");

        // --- PARAMETER PROCESSING ---
        const pathParam = searchParams.get("path");
        const ideaParam = searchParams.get("idea");
        const repoParam = searchParams.get("repo");
        const targetBranchParam = searchParams.get("targetBranch"); // Can be the PR *base* branch initially
        const prNumberParam = searchParams.get("prNumber");
        const prUrlParam = searchParams.get("prUrl");

        // --- Set props based on params ---
        setHighlightedPathProp(pathParam); // Store path for prop
        // Store decoded idea for prop, excluding ImageReplace format
        const decodedIdeaForProp = ideaParam ? decodeURIComponent(ideaParam) : null;
        if (decodedIdeaForProp && !decodedIdeaForProp.startsWith("ImageReplace|") && !decodedIdeaForProp.startsWith("ErrorFix|")) {
            setIdeaProp(decodedIdeaForProp);
        } else {
            setIdeaProp(null); // Reset if it's a special flow or no idea
        }
        // --- End Set props ---

        // .. Repo processing
        if (repoParam) {
             try {
                 const decodedRepoUrl = decodeURIComponent(repoParam);
                 if (decodedRepoUrl && typeof decodedRepoUrl === 'string' && decodedRepoUrl.includes("github.com")) {
                     if (repoUrl !== decodedRepoUrl) { // Only set if different
                         setRepoUrl(decodedRepoUrl);
                         log(`[Effect URL Params] Repo URL set from param: ${decodedRepoUrl}`);
                     }
                 } else { warn(`[Effect URL Params] Invalid or empty repo URL from param: ${repoParam}`); }
             } catch (e) { error("[Effect URL Params] Error decoding repo URL param:", e); }
         }

         let prDetails = null;
         if (prNumberParam && prUrlParam) {
              try {
                  const prNum = parseInt(decodeURIComponent(prNumberParam), 10);
                  const prUrl = decodeURIComponent(prUrlParam);
                  if (!isNaN(prNum) && prUrl) {
                      prDetails = { number: prNum, url: prUrl };
                      log(`[Effect URL Params] Target PR Data parsed from param: #${prNum}`);
                  }
              } catch (e) { error("Error parsing PR number/url from URL params", e); }
         }
         // Only update context if different
         if (JSON.stringify(targetPrData) !== JSON.stringify(prDetails)) {
            setTargetPrData(prDetails); // Use context setter
         }


        // .. Path/Idea processing for flows
          let needsProcessing = false; // Flag to track if we should scroll/show components
          if (pathParam && ideaParam) {
              let decodedIdea: string | null = null; let decodedPath: string | null = null;
              try {
                  decodedPath = decodeURIComponent(pathParam);
                  decodedIdea = decodeURIComponent(ideaParam);
                  needsProcessing = true; // Params exist

                  if (decodedIdea?.startsWith("ImageReplace|")) {
                      log("[Effect URL Params] Image Replace flow detected.");
                      try {
                          const parts = decodedIdea.split('|');
                          const oldUrlParam = parts.find(p => p.startsWith("OldURL="));
                          const newUrlParam = parts.find(p => p.startsWith("NewURL="));
                          if (oldUrlParam && newUrlParam && decodedPath) {
                              const oldUrl = decodeURIComponent(oldUrlParam.substring(7));
                              const newUrl = decodeURIComponent(newUrlParam.substring(7));
                              if (oldUrl && newUrl) {
                                  const flowDetails = { oldUrl, newUrl };
                                  if (pageContext.triggerPreCheckAndFetch && repoUrl) {
                                      log(`[Effect URL Params] Triggering pre-check and fetch for ImageSwap`);
                                      // const potentialBranch = repoUtils.guessBranchNameFromPath(decodedPath) || 'image-update-' + Date.now().toString(36); // Let context handle branch name logic
                                      // Trigger but don't await here, let the context manage the async flow
                                      pageContext.triggerPreCheckAndFetch(repoUrl, 'image-update', 'ImageSwap', flowDetails, decodedPath)
                                           .catch(preCheckErr => error("Error during ImageSwap pre-check trigger:", preCheckErr));
                                  } else {
                                      error("[Effect URL Params] Cannot trigger pre-check/fetch: function or repoUrl missing.");
                                      setPendingFlowDetails({ type: 'ImageSwap', targetPath: decodedPath, details: flowDetails }); // Fallback to just setting pending state
                                  }
                              } else { error("[Effect URL Params] Invalid image task URL data", { decodedPath, oldUrl, newUrl }); setPendingFlowDetails(null); }
                          } else { error("[Effect URL Params] Could not parse ImageReplace parts:", decodedIdea); setPendingFlowDetails(null); }
                      } catch (splitError) { error("[Effect URL Params] Error splitting ImageReplace task:", splitError); setPendingFlowDetails(null); }
                      setInitialIdeaProcessed(true); // Mark processed for this flow type
                      setInitialIdea(null); setImageReplaceTask(null); // Clear local state

                  } else if (decodedIdea?.startsWith("ErrorFix|")) {
                        log("[Effect URL Params] Error Fix flow detected.");
                         try {
                             const parts = decodedIdea.substring(9).split('|');
                             const details: Record<string, string> = {};
                             parts.forEach(part => {
                                 const eqIndex = part.indexOf('=');
                                 if (eqIndex > 0) {
                                     const key = part.substring(0, eqIndex);
                                     const value = decodeURIComponent(part.substring(eqIndex + 1));
                                     details[key] = value;
                                 }
                             });
                             if (decodedPath && details.Message) {
                                if(pageContext.triggerPreCheckAndFetch && repoUrl) {
                                      log(`[Effect URL Params] Triggering pre-check and fetch for ErrorFix`);
                                      // Use PR branch if available, otherwise suggest a name
                                      const suggestedBranchName = targetBranchParam ? decodeURIComponent(targetBranchParam) : ('error-fix-' + Date.now().toString(36).substring(0,6));
                                      // Trigger but don't await
                                      pageContext.triggerPreCheckAndFetch(repoUrl, suggestedBranchName, 'ErrorFix', details, decodedPath)
                                        .catch(preCheckErr => error("Error during ErrorFix pre-check trigger:", preCheckErr));
                                  } else {
                                      error("[Effect URL Params] Cannot trigger pre-check/fetch: function or repoUrl missing.");
                                      setPendingFlowDetails({ type: 'ErrorFix', targetPath: decodedPath, details }); // Fallback
                                  }
                             } else { error("[Effect URL Params] Invalid ErrorFix data (missing path or message)", { decodedPath, details }); setPendingFlowDetails(null); }
                         } catch (parseError) { error("[Effect URL Params] Error parsing ErrorFix task:", parseError); setPendingFlowDetails(null); }
                         setInitialIdeaProcessed(false); // Keep as false to allow populate effect
                         setInitialIdea(null); setImageReplaceTask(null); // Clear local state

                  } else if (decodedIdea) {
                     log("[Effect URL Params] Simple idea param found:", decodedIdea.substring(0, 50) + "...");
                     if (initialIdea !== decodedIdea) setInitialIdea(decodedIdea); // Set local state for populate effect
                     if (imageReplaceTask) setImageReplaceTask(null);
                     if (pendingFlowDetails) setPendingFlowDetails(null);
                     setInitialIdeaProcessed(false); // Keep as false to allow populate effect

                      // Trigger fetch for simple idea only if repoUrl is available
                      if (fetcherRef?.current?.handleFetch && repoUrl) {
                          log("[Effect URL Params] Triggering fetch for simple idea.");
                          const branchToUse = targetBranchParam ? decodeURIComponent(targetBranchParam) : null;
                          // Don't await fetch here
                          fetcherRef.current.handleFetch(false, branchToUse)
                             .catch(fetchErr => error("Error triggering fetch for simple idea:", fetchErr));
                      } else {
                          warn("[Effect URL Params] Cannot trigger fetch for simple idea (ref or repoUrl missing).");
                      }
                  } else {
                      // .. Handle empty/invalid idea
                      warn("[Effect URL Params] Decoded idea empty/invalid.");
                      setInitialIdea(null); setImageReplaceTask(null); setPendingFlowDetails(null); setInitialIdeaProcessed(true);
                      needsProcessing = false; // No valid idea/path
                  }
              } catch (decodeError) { error("[Effect URL Params] Error decoding params:", decodeError); setInitialIdea(null); setImageReplaceTask(null); setPendingFlowDetails(null); setInitialIdeaProcessed(true); needsProcessing = false;}

              // Set showComponents only if valid path/idea params existed and were processed
              if (needsProcessing && !showComponents) {
                  debug("[Effect URL Params] Setting showComponents=true based on valid params");
                  setShowComponents(true);
              }

          } else {
              // .. Handle no path/idea params
              log(`[Effect URL Params] No path/idea params found.`);
              setInitialIdea(null); setImageReplaceTask(null); setPendingFlowDetails(null); setInitialIdeaProcessed(true);
          }

         debug("[Effect URL Params] END");
      // --- DEPENDENCIES ---
      }, [
          // Core dependencies for reading params
          searchParamsReady, searchParams, searchParamsError, // Depend on error state too
          // Context setters (stable refs assumed, used for updates)
          setRepoUrl, addToast, setPendingFlowDetails,
          setTargetBranchName, setManualBranchName, setTargetPrData,
          setImageReplaceTask, setShowComponents,
          // Functions from context/refs (should be stable)
          pageContext.triggerPreCheckAndFetch, fetcherRef,
          // State values read for comparison or triggering actions
          repoUrl, showComponents, initialIdea, imageReplaceTask, pendingFlowDetails, targetPrData,
          // External Utils (constant)
          // repoUtils.guessBranchNameFromPath, // Removed - logic moved to context potentially
      ]); // Added state values read inside


       // --- Effect for Kwork/Task Population ---
       useEffect(() => {
            debug("[Effect Populate] Check START", { fetchStatus, isPreChecking, pendingFlow: !!pendingFlowDetails, initialIdea: !!initialIdea, initialIdeaProcessed });

            // Wait for fetch success AND pre-check to be finished
            if (fetchStatus === 'success' && !isPreChecking && !initialIdeaProcessed) {
                 const flow = pendingFlowDetails;
                 if (flow) {
                      log(`[Effect Populate] Processing Pending Flow: ${flow.type}`);
                      if (flow.type === 'ImageSwap') {
                          // ImageSwap setup is now handled earlier in handleSetFilesFetchedStable
                          log("[Effect Populate] ImageSwap flow processing handled earlier.");
                          setInitialIdea(null); // Clear local idea state if any
                      } else if (flow.type === 'ErrorFix' && kworkInputRef?.current) {
                           const { Message, Stack, Logs, Source } = flow.details;
                           const prompt = `Fix error in ${flow.targetPath}:\n\nMessage: ${Message}\nSource: ${Source || 'N/A'}\n\nStack:\n\`\`\`\n${Stack || 'N/A'}\n\`\`\`\n\nLogs:\n${Logs || 'N/A'}\n\nProvide ONLY the corrected code block or full file content.`;
                           if (kworkInputRef.current.value !== prompt) { // Prevent infinite loops
                              kworkInputRef.current.value = prompt;
                              try { kworkInputRef.current.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { error("Dispatch input event error:", e); }
                           }
                           setKworkInputHasContent(true);
                           log("[Effect Populate] Kwork populated for ErrorFix flow.");
                            // Auto-select the target file in the fetcher
                           if(fetcherRef?.current && allFetchedFiles.some(f => f.path === flow.targetPath) && !selectedFetcherFiles.has(flow.targetPath)) {
                                // fetcherRef.current.toggleFileSelection?.(flow.targetPath); // Use toggle to ensure selection
                                // Add to kwork directly via imperative handle
                                setTimeout(() => {
                                    fetcherRef.current?.handleAddSelected?.(new Set([flow.targetPath]), allFetchedFiles);
                                    log("[Effect Populate] Target error file added to kwork context via imperative handle.");
                                }, 100); // Delay slightly
                            } else if (selectedFetcherFiles.has(flow.targetPath)) {
                                log("[Effect Populate] Target error file already selected.");
                            } else {
                                warn("[Effect Populate] Could not auto-select/add error file (ref or file missing).");
                            }
                           setPendingFlowDetails(null); // Clear the flow details once processed
                           const targetElement = document.getElementById('executor'); // Scroll to assistant after populating
                           if (targetElement) { setTimeout(() => { try { targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){ error("Scroll error:",e); } }, 250); }
                      }
                      setInitialIdeaProcessed(true); // Mark processed after handling flow
                 } else if (initialIdea && !imageReplaceTask && kworkInputRef?.current) {
                     log(`[Effect Populate] Populating kwork with simple initialIdea.`);
                     if (kworkInputRef.current.value !== initialIdea) { // Prevent loops
                        kworkInputRef.current.value = initialIdea;
                        try { kworkInputRef.current.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { error("Dispatch input event error:", e); }
                     }
                     setKworkInputHasContent(initialIdea.trim().length > 0);

                      // Auto-select the target file if highlightedPathProp exists and is fetched
                      if (highlightedPathProp && fetcherRef?.current && allFetchedFiles.some(f => f.path === highlightedPathProp) && !selectedFetcherFiles.has(highlightedPathProp)) {
                          log("[Effect Populate] Auto-adding highlighted file for simple idea:", highlightedPathProp);
                          // fetcherRef.current.toggleFileSelection?.(highlightedPathProp); // Use toggle
                          setTimeout(() => { // Delay adding to kwork slightly
                             fetcherRef.current?.handleAddSelected?.(new Set([highlightedPathProp]), allFetchedFiles);
                             log("[Effect Populate] Highlighted file added to kwork context for simple idea via imperative handle.");
                          }, 100);
                      } else if (highlightedPathProp && selectedFetcherFiles.has(highlightedPathProp)) {
                          log("[Effect Populate] Highlighted file already selected for simple idea.");
                      }

                     const kworkElement = document.getElementById('kwork-input-section');
                     if (kworkElement) { setTimeout(() => { try { kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){ error("Scroll error:", e); } }, 250); }
                     setInitialIdeaProcessed(true); // Mark as processed here
                 } else { // No flow, no idea, but fetch is done and not pre-checking
                      log(`[Effect Populate] Fetch finished (${fetchStatus}), no pending idea/flow to process.`);
                      setInitialIdeaProcessed(true); // Mark processed to prevent re-running
                 }
            } else if (!isPreChecking && fetchStatus !== 'loading' && fetchStatus !== 'retrying' && fetchStatus !== 'idle' && !initialIdeaProcessed) {
                // Handle cases where fetch might fail but we still need to mark as processed
                 warn(`[Effect Populate] Fetch status is '${fetchStatus}' and not loading/idle/pre-checking. Marking initial idea as processed.`);
                 setInitialIdeaProcessed(true);
            }

            debug("[Effect Populate] Check END");
        }, [
            fetchStatus, isPreChecking, pendingFlowDetails, initialIdea, initialIdeaProcessed, imageReplaceTask, // Core state dependencies
            kworkInputRef, fetcherRef, allFetchedFiles, highlightedPathProp, selectedFetcherFiles, // Refs and derived/passed state
            addToast, setKworkInputHasContent, setImageReplaceTask, setPendingFlowDetails, // Context setters used inside
            logger // Logger (assuming stable)
        ]);


    // --- Callbacks ---
    const memoizedGetPlainText = useCallback(getPlainText, []);
    const scrollToSectionNav = useCallback((id: string) => {
        // .. (Function content unchanged)
        debug(`[CB ScrollNav] Attempting scroll to: ${id}`);
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps'];
        const targetElement = document.getElementById(id);
        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            log(`[CB ScrollNav] Revealing components for "${id}"`);
            setShowComponents(true);
            requestAnimationFrame(() => {
                const el = document.getElementById(id);
                if (el) {
                    try {
                        const offsetTop = window.scrollY + el.getBoundingClientRect().top - 80; // Adjusted offset for header
                        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                        log(`[CB ScrollNav] Scrolled to revealed "${id}"`);
                    } catch (e) {
                        error(`[CB ScrollNav] Error scrolling:`, e);
                    }
                } else {
                    error(`[CB ScrollNav] Target "${id}" not found after reveal.`);
                }
            });
        } else if (targetElement) {
            try {
                const offsetTop = window.scrollY + targetElement.getBoundingClientRect().top - 80; // Adjusted offset for header
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                log(`[CB ScrollNav] Scrolled to "${id}"`);
            } catch (e) {
                error(`[CB ScrollNav] Error scrolling:`, e);
            }
        } else {
            error(`[CB ScrollNav] Target element "${id}" not found.`);
        }
    }, [showComponents, setShowComponents, log, debug, error]); // Added setShowComponents and loggers

    const handleShowComponents = useCallback(() => {
        log("[Button Click] handleShowComponents (Reveal)");
        setShowComponents(true);
        toastInfo("Компоненты загружены!", { duration: 1500 });
    }, [setShowComponents, toastInfo, log]); // Added setShowComponents and log


    // --- Loading / Error States ---
     if (searchParamsError) {
          error("[Render] Rendering error state due to searchParams hook failure.");
          return <div className="text-red-500 p-4">Ошибка инициализации URL: {searchParamsError.message}. Попробуйте перезагрузить страницу.</div>;
     }
     // --- UPDATED Loading Check ---
     if (isPageLoading) {
         const reason = !t ? "translations" : "searchParams";
         log(`[Render] ActualPageContent: Rendering Loading State (Waiting for ${reason})`);
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang]?.loading ?? translations.en.loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }
     // --- End Loading Check ---
     if (!t) {
         error("[Render] ActualPageContent: Critical - translations (t) are null after loading.");
         return <div className="text-red-500 p-4">Критическая ошибка: Не удалось загрузить тексты страницы.</div>;
     }

    // --- Derived State ---
    log("[ActualPageContent] Calculating derived state");
    const userName = user?.first_name || 'Vibe Master';
    const navTitleIntro = memoizedGetPlainText(t.navIntro);
    const navTitleVibeLoop = memoizedGetPlainText(t.navCyberVibe);
    const navTitleGrabber = memoizedGetPlainText(t.navGrabber);
    const navTitleAssistant = memoizedGetPlainText(t.navAssistant);


    // --- Log before return ---
    log("[ActualPageContent] Preparing to render JSX...");

    // --- MAIN JSX RENDER ---
    try {
       return (
            <>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <div className="min-h-screen bg-gray-950 p-4 sm:p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">

                    {/* Intro Section */}
                    <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                         <div className="flex justify-center mb-4"> <FaBolt className="w-16 h-16 text-[#E1FF01] text-shadow-[0_0_15px_#E1FF01] animate-pulse" /> </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-4">
                           <VibeContentRenderer content={t.pageTitle} />
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-200 mt-4 font-semibold">
                           <VibeContentRenderer content={t.welcome} /> <span className="text-brand-cyan">{userName}!</span>
                        </p>
                        <div className="text-lg md:text-xl text-gray-300 mt-3 space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-yellow-300 prose-em:text-purple-300 max-w-none">
                            <VibeContentRenderer content={t.intro1} />
                            <VibeContentRenderer content={t.intro2} />
                            <div className="font-semibold text-brand-green"><VibeContentRenderer content={t.intro3} /></div>
                        </div>
                    </section>

                    {/* === The Vibe Loop Section === */}
                    <section id="cybervibe-section" className="mb-12 w-full max-w-3xl">
                         <Card className="bg-gradient-to-br from-purple-900/40 via-black/60 to-indigo-900/40 border border-purple-600/60 shadow-xl rounded-lg p-6 backdrop-blur-sm">
                             <CardHeader className="p-0 mb-4">
                                 <CardTitle className="text-2xl md:text-3xl font-bold text-center text-brand-purple flex items-center justify-center gap-2">
                                    <FaAtom className="animate-spin-slow"/> <VibeContentRenderer content={t.cyberVibeTitle} /> <FaBrain className="animate-pulse"/>
                                </CardTitle>
                             </CardHeader>
                             <CardContent className="p-0 text-gray-300 text-base md:text-lg space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-purple-300 prose-em:text-cyan-300 max-w-none">
                                <VibeContentRenderer content={t.cyberVibe1} />
                                <VibeContentRenderer content={t.cyberVibe2} />
                                <VibeContentRenderer content={t.cyberVibe3} />
                                <div className="text-purple-300 font-semibold"><VibeContentRenderer content={t.cyberVibe4} /></div>
                             </CardContent>
                         </Card>
                     </section>

                    {/* Your Vibe Path Section - NEW PHILOSOPHY */}
                    <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                        <details className="bg-gray-900/80 border border-gray-700 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4 open:shadow-lg open:border-indigo-500/50">
                            <summary className="text-xl md:text-2xl font-semibold text-brand-green p-4 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800/50 rounded-t-lg transition-colors group">
                                <span className="flex items-center gap-2"><FaCodeBranch /> <VibeContentRenderer content={t.philosophyTitle} /></span>
                                <span className="text-xs text-gray-500 group-open:rotate-180 transition-transform duration-300">▼</span>
                            </summary>
                            <div className="px-6 pt-2 text-gray-300 space-y-4 text-base prose prose-invert prose-p:my-2 prose-li:my-1 prose-strong:text-yellow-300 prose-em:text-cyan-300 prose-a:text-brand-blue max-w-none">
                                 <div className="my-4 not-prose">
                                     <h4 className="text-lg font-semibold text-cyan-400 mb-2"><VibeContentRenderer content={t.philosophyVideoTitle} /></h4>
                                     <div className="aspect-video w-full rounded-lg overflow-hidden border border-cyan-700/50 shadow-lg">
                                         <iframe className="w-full h-full" src="https://www.youtube.com/embed/imxzYWYKCyQ" title="YouTube video player - Vibe Level Explanation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
                                     </div>
                                 </div>
                                <hr className="border-gray-700 my-3"/>
                                 <div className="text-purple-300 italic"><VibeContentRenderer content={t.philosophyCore} /></div>
                                 <hr className="border-gray-700 my-3"/>
                                <h4 className="text-lg font-semibold text-cyan-400 pt-1">Level Progression (+1 Vibe Perk):</h4>
                                <ul className="list-none space-y-2 pl-2 text-sm md:text-base">
                                    <li><VibeContentRenderer content={t.philosophyLvl0_1} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl1_2} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl2_3} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl3_4} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl4_5} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl5_6} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl6_7} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl8_10} /></li>
                                </ul>
                                <hr className="border-gray-700 my-3"/>
                                <div className="font-bold text-brand-green"><VibeContentRenderer content={t.philosophyEnd} /></div>
                                <hr className="border-gray-700 my-4"/>
                                <h4 className="text-lg font-semibold text-cyan-400 pt-2"><VibeContentRenderer content={t.stepsTitle} /></h4>
                                <div className="text-sm space-y-2">
                                     <VibeContentRenderer content={t?.step1Title ? `<strong>${t.step1Title}</strong> ${t.step1Desc ?? ''} ${t.step1DescEnd ?? ''}` : ''} wrapperClassName="block" />
                                     <VibeContentRenderer content={t?.step2Title ? `<strong>${t.step2Title}</strong> ${t.step2Desc ?? ''} ${t.step2DescEnd ?? ''}` : ''} wrapperClassName="block" />
                                </div>
                            </div>
                        </details>
                    </section>

                    {/* Reveal Button */}
                    {!showComponents && (
                        <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                            {(() => { debug("[Render] Rendering Reveal Button"); return null; })()}
                            <Button onClick={handleShowComponents} className="bg-gradient-to-r from-green-500 via-cyan-500 to-purple-600 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce hover:animate-none ring-2 ring-offset-2 ring-offset-gray-950 ring-transparent hover:ring-cyan-300" size="lg">
                                <FaHandSparkles className="mr-2"/> <VibeContentRenderer content={t.readyButton} />
                            </Button>
                        </section>
                    )}

                    {/* WORKHORSE Components */}
                    {showComponents && (
                         <>
                            {(() => { debug("[Render] Rendering Workhorse Components Container"); return null; })()}
                            <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse"><VibeContentRenderer content={t.componentsTitle} /></h2>
                             <section id="extractor" className="mb-12 w-full max-w-4xl">
                               {(() => { debug("[Render] Rendering RepoTxtFetcher Component Wrapper..."); return null; })()}
                                 <Card className="bg-gray-900/80 border border-blue-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         {/* --- Pass derived props --- */}
                                         <RepoTxtFetcher
                                             ref={fetcherRef}
                                             highlightedPathProp={highlightedPathProp}
                                             ideaProp={ideaProp}
                                         />
                                     </CardContent>
                                 </Card>
                               {(() => { debug("[Render] Rendering RepoTxtFetcher Component Wrapper DONE"); return null; })()}
                             </section>

                             <section id="executor" className="mb-12 w-full max-w-4xl pb-16">
                                {(() => { debug("[Render] Rendering AICodeAssistant Component Wrapper..."); return null; })()}
                                 <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <AICodeAssistant ref={assistantRef} kworkInputRefPassed={kworkInputRef} aiResponseInputRefPassed={aiResponseInputRef} />
                                     </CardContent>
                                 </Card>
                                {(() => { debug("[Render] Rendering AICodeAssistant Component Wrapper DONE"); return null; })()}
                             </section>
                            {(() => { debug("[Render] Rendering Workhorse Components Container DONE"); return null; })()}
                         </>
                     )}

                    {/* Final CTA */}
                     {showComponents && (
                         <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                              {(() => { debug("[Render] Rendering Final CTA"); return null; })()}
                              <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50 prose prose-invert prose-p:my-2 prose-strong:text-yellow-200 max-w-none">
                                 <h3 className="text-2xl font-bold text-white mb-3"><VibeContentRenderer content={t?.ctaTitle?.replace('{USERNAME}', userName) ?? ''} /></h3>
                                 <div className="text-white text-lg mb-4"> <VibeContentRenderer content={t.ctaDesc} /> </div>
                                 <div className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded"> <FaHeart className="inline mr-2 text-red-400 animate-ping"/> <VibeContentRenderer content={t.ctaHotChick} /> <FaUserAstronaut className="inline ml-2 text-pink-300"/> </div>
                                 <div className="text-gray-300 text-base"> <VibeContentRenderer content={t.ctaDude} /> </div>
                             </div>
                         </section>
                     )}

                    {/* Navigation Icons */}
                     <motion.nav className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40" animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2.0, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}>
                         <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition shadow-md" title={navTitleIntro} aria-label={navTitleIntro || "Scroll to Intro"} > <FaCircleInfo className="text-lg text-gray-200" /> </button>
                         <button onClick={() => scrollToSectionNav("cybervibe-section")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition shadow-md" title={navTitleVibeLoop} aria-label={navTitleVibeLoop || "Scroll to Vibe Loop"} > <FaUpLong className="text-lg text-white" /> </button>
                         {showComponents && ( <>
                                <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition shadow-md" title={navTitleGrabber} aria-label={navTitleGrabber || "Scroll to Grabber"} > <FaDownload className="text-lg text-white" /> </button>
                                <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-indigo-700/80 backdrop-blur-sm rounded-full hover:bg-indigo-600 transition shadow-md" title={navTitleAssistant} aria-label={navTitleAssistant || "Scroll to Assistant"} > <FaRobot className="text-lg text-white" /> </button>
                         </> )}
                    </motion.nav>

                    {/* Automation Buddy */}
                     {(() => { debug("[Render] Preparing AutomationBuddy Wrapper (Suspense)"); return null; })()}
                    <Suspense fallback={<LoadingBuddyFallback />}>
                        <AutomationBuddy />
                    </Suspense>
                    {(() => { debug("[Render] AutomationBuddy Wrapper Rendered"); return null; })()}
                </div>
            </>
       );
    } catch (renderError: any) {
         error("[ActualPageContent] CRITICAL RENDER ERROR in return JSX:", renderError);
         return <div className="text-red-500 p-4">Критическая ошибка рендеринга страницы: {renderError.message}</div>;
    } finally {
        log("[ActualPageContent] END Render");
    }
}

// --- Layout Component ---
function RepoXmlPageLayout() {
    // --- Logging Setup (Console fallback) ---
    const log = typeof logger !== 'undefined' ? logger.log : console.log;
    const error = typeof logger !== 'undefined' ? logger.error : console.error;

    log("[RepoXmlPageLayout] START Render");
    try {
      // Wrap provider initialization in try-catch
      return (
           <RepoXmlPageProvider>
               <ActualPageContent />
           </RepoXmlPageProvider>
       );
    } catch (layoutError: any) {
      error("[RepoXmlPageLayout] CRITICAL RENDER ERROR:", layoutError);
      return <div className="text-red-500 p-4">Критическая ошибка в слое разметки: {layoutError.message}</div>;
    } finally {
       log("[RepoXmlPageLayout] END Render");
    }
}

// --- Exported Page Component ---
export default function RepoXmlPage() {
     // --- Logging Setup (Console fallback) ---
     const log = typeof logger !== 'undefined' ? logger.log : console.log;
     const error = typeof logger !== 'undefined' ? logger.error : console.error;

     log("[RepoXmlPage] START Render (Exported Component)");
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
    const fallbackLoadingText = translations[fallbackLoadingLang]?.loading ?? translations.en.loading;
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p> </div> );

    try {
        return (
            // Wrap Layout in Suspense for useSearchParams
            <Suspense fallback={fallbackLoading}>
                <RepoXmlPageLayout />
            </Suspense>
        );
    } catch (pageError: any) {
         error("[RepoXmlPage] CRITICAL RENDER ERROR:", pageError);
         return <div className="text-red-500 p-4">Критическая ошибка рендеринга компонента страницы: {pageError.message}</div>;
    } finally {
        log("[RepoXmlPage] END Render (Exported Component)");
    }
}