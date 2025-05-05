"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useSearchParams } from 'next/navigation';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, RepoXmlPageProvider,
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask,
    RepoXmlPageContextType, FileNode, TargetPrData, PendingFlowDetails // Import FileNode here if used locally
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

// --- Fallback component for AutomationBuddy ---
function LoadingBuddyFallback() {
    return ( <div className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 animate-pulse" aria-hidden="true" ></div> );
}

// --- getPlainText helper ---
const getPlainText = (htmlString: string | null | undefined): string => {
    if (typeof htmlString !== 'string' || !htmlString) { return ''; }
    try {
        let text = htmlString.replace(/<Fa[A-Z][a-zA-Z0-9]+(?:\s+[^>]*?)?\s*\/?>/g, '');
        text = text.replace(/\[\?\]/g, '');
        text = text.replace(/\[ICON ERR!\]/g, '');
        text = text.replace(/<[^>]*>/g, '');
        return text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    } catch (e) {
        console.error("[getPlainText] Error stripping HTML for title:", e, "Input:", htmlString);
        return htmlString;
    }
};


// --- ActualPageContent Component ---
function ActualPageContent() {
    const log = logger.log;
    const debug = logger.debug;
    const warn = logger.warn;
    const error = logger.error;

    log("[ActualPageContent] START Render - Top Level");

    // --- HOOKS ---
    const { user } = useAppContext();
    log("[ActualPageContent] useAppContext DONE");
    const pageContext = useRepoXmlPageContext();
    log("[ActualPageContent] useRepoXmlPageContext DONE");
    const { info: toastInfo, error: toastError } = useAppToast();
    log("[ActualPageContent] useAppToast DONE");

    // --- State Initialization ---
    log("[ActualPageContent] Initializing State...");
    const [lang, setLang] = useState<Language>('en');
    const [t, setT] = useState<TranslationSet | null>(null);
    const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
    const [searchParamsReady, setSearchParamsReady] = useState(false);
    const [searchParamsError, setSearchParamsError] = useState<Error | null>(null);
    // -- State derived from URL params, processed by an effect --
    const [derivedHighlightedPath, setDerivedHighlightedPath] = useState<string | null>(null); // For RepoTxtFetcher prop
    const [derivedIdea, setDerivedIdea] = useState<string | null>(null); // Simple idea text for RepoTxtFetcher prop AND populating kwork
    const [initialUrlProcessed, setInitialUrlProcessed] = useState<boolean>(false); // Track if URL params effect has run
    const hasProcessedInitialIdea = useRef(false); // Ref to track if the *population* effect ran
    log("[ActualPageContent] useState DONE");


    // --- useSearchParams Hook Call ---
    let searchParams: URLSearchParams | null = null;
    try {
        searchParams = useSearchParams();
        // Use effect below depends on searchParamsReady, set it here
        if (searchParams !== null && !searchParamsReady && searchParamsError === null) {
             debug("[ActualPageContent] useSearchParams() succeeded in this render, setting ready state.");
             setSearchParamsReady(true);
        }
    } catch (e: any) {
        if (searchParamsError === null) {
            error("[ActualPageContent] useSearchParams() call FAILED:", e);
            setSearchParamsError(e);
            setSearchParamsReady(false);
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
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, // Refs
        setImageReplaceTask, setKworkInputValue, fetchStatus, setKworkInputHasContent, // State setters
        imageReplaceTask, allFetchedFiles, selectedFetcherFiles, kworkInputValue, // State values
        repoUrl, setRepoUrl, addToast,
        targetPrData, setTargetPrData,
        isPreChecking, setPendingFlowDetails, pendingFlowDetails,
        setTargetBranchName, setManualBranchName, showComponents, setShowComponents,
        triggerPreCheckAndFetch, // Stable trigger
    } = pageContext;

    // --- Effect 1: Language ---
    useEffect(() => {
      debug("[Effect Lang] START");
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const resolvedLang = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(resolvedLang);
      const newTranslations = translations[resolvedLang] ?? translations.en;
      setT(newTranslations);
      log(`[Effect Lang] Language set to: ${resolvedLang}. Translations loaded.`);
    }, [user]); // Only depends on user

    // --- Effect 2: Page Loading Status ---
    useEffect(() => {
        log("[ActualPageContent Effect] Loading status check.");
        const paramsAttemptComplete = searchParamsReady || searchParamsError !== null;
        setIsPageLoading(!t || !paramsAttemptComplete);
        log(`[ActualPageContent Effect] Loading check: translations=${!!t}, paramsAttemptComplete=${paramsAttemptComplete}, resulting isPageLoading=${!t || !paramsAttemptComplete}`);
    }, [t, searchParamsReady, searchParamsError]);

    // --- Effect 3: Process URL Params (sets intermediate state) ---
    useEffect(() => {
        // Guards
        if (!searchParamsReady && !searchParamsError) { log("[Effect URL Params] Skipping, searchParams not ready and no error."); return; }
        if (searchParamsError) { warn("[Effect URL Params] Skipping, searchParams hook failed."); setInitialUrlProcessed(true); return; }
        if (!searchParams) { error("[Effect URL Params] Skipping, searchParams object is null despite readiness signal."); setInitialUrlProcessed(true); return; }
        if (initialUrlProcessed) { debug("[Effect URL Params] Skipping, already processed initial URL."); return; }

        debug("[Effect URL Params] Processing START (searchParams ready, valid, and not processed yet)");

        const pathParam = searchParams.get("path");
        const ideaParam = searchParams.get("idea");
        const repoParam = searchParams.get("repo");
        const targetBranchParam = searchParams.get("targetBranch");
        const prNumberParam = searchParams.get("prNumber");
        const prUrlParam = searchParams.get("prUrl");

        let needsComponentReveal = false;
        let newRepoUrl: string | null = null;
        let flowType: 'ImageSwap' | 'ErrorFix' | 'Simple' | null = null;
        let flowTargetPath: string | null = null;
        let flowDetails: any = null;
        let suggestedBranch: string | null = null;
        let simpleIdeaText: string | null = null;
        let pathForHighlight: string | null = null;
        let newTargetPrData: TargetPrData | null = null;

        // Repo URL
        if (repoParam) {
            try { const decodedRepoUrl = decodeURIComponent(repoParam); if (decodedRepoUrl?.includes("github.com")) newRepoUrl = decodedRepoUrl; }
            catch (e) { error("Error decoding repo URL param:", e); }
        }

        // PR Data
        if (prNumberParam && prUrlParam) {
            try { const prNum = parseInt(decodeURIComponent(prNumberParam), 10); const prUrl = decodeURIComponent(prUrlParam); if (!isNaN(prNum) && prUrl) newTargetPrData = { number: prNum, url: prUrl }; }
            catch (e) { error("Error parsing PR data from URL params", e); }
        }

        // Path / Idea / Flow Type Determination
        if (pathParam) {
            try {
                 pathForHighlight = decodeURIComponent(pathParam);
                 flowTargetPath = pathForHighlight;
                 needsComponentReveal = true; // Assume reveal if path exists

                if (ideaParam) {
                    const decodedIdea = decodeURIComponent(ideaParam);
                    if (decodedIdea.startsWith("ImageReplace|")) {
                        flowType = 'ImageSwap';
                        try {
                            const parts = decodedIdea.split('|'); const oldUrl = decodeURIComponent(parts.find(p => p.startsWith("OldURL="))?.substring(7) || ''); const newUrl = decodeURIComponent(parts.find(p => p.startsWith("NewURL="))?.substring(7) || '');
                            if (oldUrl && newUrl) { flowDetails = { oldUrl, newUrl }; suggestedBranch = targetBranchParam ? decodeURIComponent(targetBranchParam) : repoUtils.guessBranchNameFromPath(flowTargetPath) || 'image-update-' + Date.now().toString(36); }
                            else flowType = null;
                        } catch { flowType = null; }
                    } else if (decodedIdea.startsWith("ErrorFix|")) {
                        flowType = 'ErrorFix';
                        try {
                            const detailParts = decodedIdea.substring(9).split('|'); const parsedDetails: Record<string, string> = {}; detailParts.forEach(part => { const eqIndex = part.indexOf('='); if (eqIndex > 0) parsedDetails[part.substring(0, eqIndex)] = decodeURIComponent(part.substring(eqIndex + 1)); });
                            if (parsedDetails.Message) { flowDetails = parsedDetails; suggestedBranch = targetBranchParam ? decodeURIComponent(targetBranchParam) : ('error-fix-' + Date.now().toString(36).substring(0, 6)); }
                            else flowType = null;
                        } catch { flowType = null; }
                    } else { flowType = 'Simple'; simpleIdeaText = decodedIdea; suggestedBranch = targetBranchParam ? decodeURIComponent(targetBranchParam) : null; }
                }
                // If only path, flowType remains null, simpleIdeaText remains null
            } catch (decodeError) { error("Error decoding path/idea params:", decodeError); needsComponentReveal = false; flowType = null; flowTargetPath = null; pathForHighlight = null; simpleIdeaText = null; }
        } else if (ideaParam) {
             try { // Idea only
                const decodedIdea = decodeURIComponent(ideaParam);
                 if (!decodedIdea.startsWith("ImageReplace|") && !decodedIdea.startsWith("ErrorFix|")) { simpleIdeaText = decodedIdea; needsComponentReveal = true; }
             } catch (e) { error("Error decoding idea param:", e); }
        }

        // --- ACTIONS based on processed params ---
        if (newRepoUrl && repoUrl !== newRepoUrl) { debug(`[Effect URL Params] Setting Repo URL: ${newRepoUrl}`); setRepoUrl(newRepoUrl); }
        if (JSON.stringify(targetPrData) !== JSON.stringify(newTargetPrData)) { debug(`[Effect URL Params] Setting Target PR Data:`, newTargetPrData); setTargetPrData(newTargetPrData); }

        // Set derived state for children *before* potentially triggering fetches that depend on them
        debug(`[Effect URL Params] Setting derived props: path=${pathForHighlight}, simpleIdea=${simpleIdeaText ? simpleIdeaText.substring(0,20)+'...' : null}`);
        setDerivedHighlightedPath(pathForHighlight);
        setDerivedIdea(simpleIdeaText);

        if ((flowType === 'ImageSwap' || flowType === 'ErrorFix') && flowTargetPath && flowDetails && suggestedBranch && (newRepoUrl || repoUrl)) {
             debug(`[Effect URL Params] Setting Pending Flow: ${flowType}, Branch Suggestion: ${suggestedBranch}`);
             setPendingFlowDetails({ type: flowType, targetPath: flowTargetPath, details: flowDetails });
             setImageReplaceTask(null);
             triggerPreCheckAndFetch(newRepoUrl || repoUrl, suggestedBranch, flowType, flowDetails, flowTargetPath).catch(preCheckErr => error(`Error during ${flowType} pre-check trigger:`, preCheckErr));
        } else if (flowType === 'Simple' && suggestedBranch) {
             debug(`[Effect URL Params] Simple flow with specific branch target: ${suggestedBranch}`);
             setTargetBranchName(suggestedBranch); setManualBranchName(''); setPendingFlowDetails(null); setImageReplaceTask(null);
        } else {
            debug(`[Effect URL Params] No specific flow trigger or no branch specified for simple flow.`);
            setPendingFlowDetails(null); setImageReplaceTask(null);
            // Don't reset branches if no specific request came from URL
        }

        if (needsComponentReveal && !showComponents) { debug("[Effect URL Params] Setting showComponents=true"); setShowComponents(true); }

        setInitialUrlProcessed(true);
        debug("[Effect URL Params] Processing END, marked as processed.");

    }, [ // Dependencies: Only react to searchParams readiness/error and stable context functions/refs.
        searchParamsReady, searchParams, searchParamsError, initialUrlProcessed, // Effect guards
        setDerivedHighlightedPath, setDerivedIdea, setInitialUrlProcessed, // Stable local setters
        setRepoUrl, setTargetPrData, setPendingFlowDetails, setImageReplaceTask, // Stable context setters
        setTargetBranchName, setManualBranchName, setShowComponents, // Stable context setters
        triggerPreCheckAndFetch, // Stable context trigger
        repoUrl, targetPrData, showComponents, // Context values read for comparison
        addToast, error, warn, log, debug, // Utilities
    ]);


    // --- Effect 4: Populate Kwork Input ---
    useEffect(() => {
        // Guards
        if (!initialUrlProcessed || hasProcessedInitialIdea.current || fetchStatus !== 'success' || isPreChecking || !kworkInputRef?.current) {
            debug("[Effect Populate Kwork] Skipping:", { initialUrlProcessed, hasProcessed: hasProcessedInitialIdea.current, fetchStatus, isPreChecking, hasRef: !!kworkInputRef?.current });
            if (initialUrlProcessed && !hasProcessedInitialIdea.current && (fetchStatus === 'error' || fetchStatus === 'failed_retries')) {
                warn("[Effect Populate Kwork] Fetch failed, marking idea as processed to prevent loops.");
                hasProcessedInitialIdea.current = true;
            }
            return;
        }
        // This effect should ONLY populate for the 'Simple' derived idea now. ErrorFix is handled by handleSetFilesFetchedStable.
        if (derivedIdea) {
            log(`[Effect Populate Kwork] Populating kwork with simple idea: ${derivedIdea.substring(0, 30)}...`);
            // Use functional update to avoid stale state issues if this runs quickly
            setKworkInputValue(prev => {
                const currentVal = prev || "";
                const ideaToAdd = derivedIdea; // Use stable derivedIdea
                if (!currentVal.includes(ideaToAdd)) {
                    return (currentVal ? currentVal + "\n\n" : "") + ideaToAdd;
                }
                debug("[Effect Populate Kwork] Input already contains the idea, skipping update.");
                return currentVal; // Return unchanged value
            });

            // Auto-add highlighted file context
            if (derivedHighlightedPath && fetcherRef?.current && allFetchedFiles.some(f => f.path === derivedHighlightedPath)) {
                if (!selectedFetcherFiles.has(derivedHighlightedPath)) {
                    log("[Effect Populate Kwork] Auto-adding highlighted file context:", derivedHighlightedPath);
                    setTimeout(() => { // Delay slightly
                        try { fetcherRef.current?.handleAddSelected?.(new Set([derivedHighlightedPath]), allFetchedFiles); }
                        catch(addErr) { error("[Effect Populate Kwork] Error calling handleAddSelected imperatively:", addErr); }
                    }, 50);
                } else { log("[Effect Populate Kwork] Highlighted file already selected, skipping auto-add context."); }
            } else if (derivedHighlightedPath) { warn("[Effect Populate Kwork] Highlighted path exists, but file/ref not found for auto-add context."); }

            // Scroll to input
            const kworkElement = document.getElementById('kwork-input-section');
            if (kworkElement) { setTimeout(() => { try { kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){ error("Scroll error:", e); } }, 250); }

            hasProcessedInitialIdea.current = true; // Mark as processed AFTER attempt
            log("[Effect Populate Kwork] Simple idea processed.");
        } else {
             log("[Effect Populate Kwork] Fetch successful, but no simple idea to populate.");
             hasProcessedInitialIdea.current = true; // Mark as processed anyway
        }
        debug("[Effect Populate Kwork] END");

    }, [ // Dependencies: React to fetch status, pre-check status, the derived idea/path, and URL processing completion.
        fetchStatus, isPreChecking, initialUrlProcessed, derivedIdea, derivedHighlightedPath, // Core triggers
        kworkInputRef, fetcherRef, allFetchedFiles, selectedFetcherFiles, // Refs/state needed *inside*
        setKworkInputValue, // Stable context setter
        error, warn, log, debug, // Utilities
    ]);

    // --- Callbacks ---
    const memoizedGetPlainText = useCallback(getPlainText, []);
    const scrollToSectionNav = useCallback((id: string) => {
        debug(`[CB ScrollNav] Attempting scroll to: ${id}`);
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps'];
        const targetElement = document.getElementById(id);
        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            log(`[CB ScrollNav] Revealing components for "${id}"`);
            setShowComponents(true);
            requestAnimationFrame(() => { // Wait for next frame after state update
                const el = document.getElementById(id);
                if (el) {
                    try { const offsetTop = window.scrollY + el.getBoundingClientRect().top - 80; window.scrollTo({ top: offsetTop, behavior: 'smooth' }); }
                    catch (e) { error(`[CB ScrollNav] Error scrolling:`, e); }
                } else { error(`[CB ScrollNav] Target "${id}" not found after reveal.`); }
            });
        } else if (targetElement) {
            try { const offsetTop = window.scrollY + targetElement.getBoundingClientRect().top - 80; window.scrollTo({ top: offsetTop, behavior: 'smooth' }); }
            catch (e) { error(`[CB ScrollNav] Error scrolling:`, e); }
        } else { error(`[CB ScrollNav] Target element "${id}" not found.`); }
    }, [showComponents, setShowComponents, log, debug, error]);

    const handleShowComponents = useCallback(() => {
        log("[Button Click] handleShowComponents (Reveal)");
        setShowComponents(true);
        toastInfo("Компоненты загружены!", { duration: 1500 });
    }, [setShowComponents, toastInfo, log]);


    // --- Loading / Error States ---
     if (searchParamsError) {
          error("[Render] Rendering error state due to searchParams hook failure.");
          return <div className="text-red-500 p-4">Ошибка инициализации URL: {searchParamsError.message}. Попробуйте перезагрузить страницу.</div>;
     }
     if (isPageLoading) {
         const reason = !t ? "translations" : (!searchParamsReady && !searchParamsError) ? "searchParams" : "unknown";
         log(`[Render] ActualPageContent: Rendering Loading State (Waiting for ${reason})`);
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang]?.loading ?? translations.en.loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }
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
                                         {/* Pass derived state from URL effect */}
                                         <RepoTxtFetcher
                                             ref={fetcherRef}
                                             highlightedPathProp={derivedHighlightedPath}
                                             ideaProp={derivedIdea}
                                         />
                                     </CardContent>
                                 </Card>
                               {(() => { debug("[Render] Rendering RepoTxtFetcher Component Wrapper DONE"); return null; })()}
                             </section>

                             <section id="executor" className="mb-12 w-full max-w-4xl pb-16">
                                {(() => { debug("[Render] Rendering AICodeAssistant Component Wrapper..."); return null; })()}
                                 <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <AICodeAssistant ref={assistantRef} kworkInputRefPassed={kworkInputRef} aiResponseInputRefPassed={pageContext.aiResponseInputRef} />
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
    const log = logger.log;
    const error = logger.error;

    log("[RepoXmlPageLayout] START Render");
    try {
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
     const log = logger.log;
     const error = logger.error;

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