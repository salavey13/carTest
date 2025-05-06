"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useSearchParams } from 'next/navigation';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, RepoXmlPageProvider,
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask,
    RepoXmlPageContextType, FileNode, TargetPrData, PendingFlowDetails
} from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong,
    FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye,
    FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner, FaBolt,
    FaToolbox, FaCode, FaVideo, FaDatabase, FaBug, FaMicrophone, FaLink, FaServer, FaRocket,
    FaFastForward, FaMemory, FaKeyboard, FaBriefcase, FaMagnifyingGlassChart, FaTree, FaEye // Added FaEye, FaMagnifyingGlass
} from "react-icons/fa6";
import Link from "next/link";
import { motion } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import * as repoUtils from "@/lib/repoUtils";

// --- I18N Translations (Full) ---
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
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400 align-baseline'/> is your <strong>cyberchest</strong>. This Studio + AI? Your interface to <strong>remix and transmute</strong> that knowledge into new vibes, features, fixes... <strong>instantly</strong>.",
    cyberVibe3: "You're not <em>learning</em> code; you're <strong>remixing the matrix</strong>. You interact, you understand structure, you <strong>command the AI</strong>. You're the Vibe Master.",
    cyberVibe4: "It's <strong>co-creation</strong> with the machine. Push boundaries. Earn bandwidth. Infinite context. Infinite power. This is <strong>CYBERVIBE 2.0</strong>.",
    philosophyTitle: "Your Vibe Path: The Inevitable Level Up (Tap)",
    philosophyVideoTitle: "Watch: The Level System Explained <FaVideo/>:",
    philosophyCore: "The secret? <strong>You're not asking the bot for help, YOU are helping the BOT</strong>. Each level adds <strong>+1 Vibe Perk</strong>, one more click, one more skill to guide the AI. It's not a grind, it's evolution. You get lazy doing the old stuff, so you <em>automatically</em> level up. And there's <strong>NO GOING BACK!</strong>",
    philosophyLvl0_1: "<strong>Lv.0 -> 1 <FaBolt/> (Instant Win):</strong> Fix a broken image. Copy URL -> Paste -> Upload new -> <strong>DONE</strong>. System auto-PRs. <strong>ANYONE</strong> can do this <em>NOW</em>. This is your entry point.",
    philosophyLvl1_2: "<strong>Lv.1 -> 2 <FaToolbox/> (+1 File/AI):</strong> Simple idea? Change text/button? Give AI the idea + 1 file context -> PR. <strong>DONE.</strong>",
    philosophyLvl2_3: "<strong>Lv.2 -> 3 <FaCode/> (+Multi-File):</strong> Slightly complex? 2-5 files? Give AI idea + context -> Check -> PR. <strong>DONE.</strong>",
    philosophyLvl3_4: "<strong>Lv.3 -> 4 <FaBug/> (+Log Check):</strong> Build failed? Runtime error? Use Dev Overlay (<FaBug /> icon top-right on error) to copy error + logs -> Feed to AI with file context -> <strong>FIXED.</strong> +1 Vibe Perk: Debugging.",
    philosophyLvl4_5: "<strong>Lv.4 -> 5 <FaLink/> (+Icon Hunt / Proactive Log Check):</strong> Tired of icon errors? Find the <em>perfect</em> Fa6 icon yourself! Use <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold px-1'>FontAwesome Search <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/></a> -> Add link to Assistant Quick Links -> Fix icons proactively. Check Vercel logs (link in PR comment!) even without errors. +1 Perk: Resourcefulness.",
    philosophyLvl5_6: "<strong>Lv.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Multimedia):</strong> Use audio commands! Attach videos! Watch them turn into page content automatically. +1 Perk: Multi-modal Input.",
    philosophyLvl6_7: "<strong>Lv.6 -> 7 <FaDatabase/> (+SQL/DB):</strong> Discover new file types! AI generates SQL -> Paste into Supabase (1 click) -> <strong>DONE.</strong> Same flow, different context. +1 Perk: Data Handling.",
    philosophyLvl8_10: "<strong>Lv.8-10+ <FaServer/>/<FaRocket/> (+Independence):</strong> Deploy your OWN CyberVibe! Use/steal my Supabase! Set your own Bot Token! Build your own XTRs! <strong>UNLIMITED POWER!</strong>",
    philosophyLvl11: "<strong>Lv.11 <FaMagnifyingGlass/> (Code Scanner):</strong> Your eyes <FaEye /> become <em>code scanners</em>. Instantly spot missing imports, typos, or logic flaws just by scrolling. You see the matrix.",
    philosophyLvl12: "<strong>Lv.12 <FaMemory/> (Context Commander):</strong> 65k tokens? <em class='text-purple-300'>Pfft, child's play.</em> You effortlessly juggle massive code context, guiding the AI through complex refactors like a <FaUserAstronaut /> surfing a nebula.",
    philosophyLvl13: "<strong>Lv.13 <FaKeyboard/> (Vibe Channeler):</strong> Forget typing; you <em>channel</em> the vibe <FaHeart className='text-pink-400' />. Detailed prompts, intricate edits, non-stop creation for 10+ minutes. You're not working; you're in <em>flow</em>, bending the digital world to your will.",
    philosophyLvl14: "<strong>Lv.14 <FaBriefcase/> (Efficiency Ninja):</strong> Why make two trips? You seamlessly weave small, unrelated tasks into larger AI requests. <em class='text-cyan-300'>Maximum efficiency, minimum context switching.</em> Your workflow is a finely tuned engine.",
    philosophyLvl15: "<strong>Lv.15 <FaMagnifyingGlassChart/> (Log Whisperer <FaBrain/>):</strong> WITH AI! You don't just read logs; you <em class='text-yellow-300'>interrogate</em> them. Spotting the delta between the *plan* (HasBeenPlanter logs) and the *reality* becomes second nature. Root causes reveal themselves.",
    philosophyEnd: "Step-by-step, level-up is <strong>inevitable</strong>. You're too lazy for the old shit. One extra click, one new skill, and you're automatically stronger. Welcome, <strong>Neo</strong>.",
    stepsTitle: "Quick Start Guide:",
    step1Title: "1. Grab Repo / Point Wish:",
    step1Desc: "Enter GitHub URL -> Hit <FaDownload class='inline mx-1 text-purple-400 align-baseline'/> OR Spot bug/idea -> Activate Buddy <FaRobot class='inline mx-1 text-indigo-400 align-baseline'/> -> Describe.",
    step1DescEnd: "For images (Lv.1): Copy broken URL, paste in Buddy/Input.",
    step2Title: "2. AI Magic & Ship:",
    step2Desc: "If needed (Lv.2+), use <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Check Assistant <FaWandMagicSparkles class='inline mx-1 text-yellow-400 align-baseline'/> -> Hit <FaGithub class='inline mx-1 text-green-400 align-baseline'/> PR Button.",
    step2DescEnd: "<strong>DONE.</strong> Site updates automagically.",
    readyButton: "LET'S F*CKING GO!",
    componentsTitle: "Engage Vibe Engines!",
    ctaTitle: "Ready to Level Up, {USERNAME}?",
    ctaDesc: "Seriously. Stop doubting. Start <strong>DOING</strong>. That first level is calling. Level up NOW!",
    ctaHotChick: "Got the fire? Let's build something epic. Hit me up <strong>@SALAVEY13</strong> NOW!",
    ctaDude: "(Everyone else? Just f*cking try it. Level 1 is a button click away. You got this!)",
    navGrabber: "Grabber <FaDownload/>",
    navAssistant: "Assistant <FaRobot/>",
    navIntro: "Intro <FaCircleInfo/>",
    navCyberVibe: "Vibe Loop <FaUpLong/>",
  },
  ru: {
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    welcome: "Йоу,",
    intro1: "Код пугает? Забудь! Это <strong>СЕЙЧАС</strong>. Твой личный <strong>dev-ускоритель</strong>. Мгновенный Level UP!",
    intro2: "Думай: Волшебная Песочница. Есть идеи? Говори. AI строит, система чекает, PR улетает. <strong>Бум.</strong> Ты рулишь процессом.",
    intro3: "Хватит потреблять, стань <strong>ТВОРЦОМ</strong>. Строй СВОЮ реальность, решай СВОИ проблемы, <strong>валидируй идеи МГНОВЕННО</strong>. Вот это вайб.",
    cyberVibeTitle: "Петля Вайба: Твой Движок Прокачки <FaUpLong/>",
    cyberVibe1: "Это не просто тулзы – это <strong>накопительная петля обратной связи</strong>. Каждое действие качает тебя, делает следующий шаг легче. Ты эволюционируешь.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400 align-baseline'/> - твой <strong>кибер-сундук</strong>. Эта Студия + AI? Твой интерфейс для <strong>ремикса и трансмутации</strong> этих знаний в новые вайбы, фичи, фиксы... <strong>мгновенно</strong>.",
    cyberVibe3: "Ты не <em>учишь</em> код; ты <strong>ремиксуешь матрицу</strong>. Взаимодействуешь, понимаешь структуру, <strong>командуешь AI</strong>. Ты - Вайб Мастер.",
    cyberVibe4: "Это <strong>со-творчество</strong> с машиной. Двигай границы. Зарабатывай bandwidth. Бесконечный контекст. Бесконечная мощь. Это <strong>CYBERVIBE 2.0</strong>.",
    philosophyTitle: "Твой Путь Вайба: Неизбежный Level Up (Жми)",
    philosophyVideoTitle: "Смотри: Объяснение Системы Уровней <FaVideo/>:",
    philosophyCore: "Секрет? <strong>Не ты просишь бота помочь, а ТЫ помогаешь БОТУ</strong>. Каждый левел дает <strong>+1 Вайб Перк</strong>, +1 клик, +1 скилл, чтобы направлять AI. Это не гринд, это эволюция. Тебе становится лень делать старое, и ты <em>автоматически</em> апаешь левел. И <strong>НАЗАД ДОРОГИ НЕТ!</strong>",
    philosophyLvl0_1: "<strong>Лв.0 -> 1 <FaBolt/> (Мгновенный Вин / Image Swap Flow):</strong> Починить битую картинку. Скопируй URL -> Вставь -> Загрузи новую -> <strong>ГОТОВО</strong>. Это <strong>полный автомат</strong> - система сама создаст PR! <strong>ЛЮБОЙ</strong> может это <em>ПРЯМО СЕЙЧАС</em>. Твой вход в матрицу.",
    philosophyLvl1_2: "<strong>Лв.1 -> 2 <FaToolbox/> (Простая Идея / Generic Idea Flow):</strong> Простая идея? Текст/кнопку поменять? Дай AI идею + 1 файл контекста -> PR. <strong>ГОТОВО.</strong> Ты сказал - AI сделал.",
    philosophyLvl2_3: "<strong>Лв.2 -> 3 <FaCode/> (+Мульти-Файл / Generic Idea Flow):</strong> Чуть сложнее? 2-5 файлов? Дай AI идею + контекст -> Проверь ответ AI в Ассистенте -> PR. <strong>ГОТОВО.</strong> Ты контролируешь больше.",
    philosophyLvl3_4: "<strong>Лв.3 -> 4 <FaBug/> (Дебаг Логов / Error Fix Flow):</strong> Упала сборка? Ошибка в рантайме? Используй Оверлей Ошибки (<FaBug/> иконка вверху справа при ошибке), чтобы скопировать ошибку и логи -> Скорми AI + <strong>контекст файла</strong> -> <strong>ПОЧИНЕНО.</strong> +1 Вайб Перк: Дебаггинг.",
    philosophyLvl4_5: "<strong>Лв.4 -> 5 <FaLink/> (Проактивный Дебаг / Icon Hunt):</strong> Проверяй логи Vercel (ссылка в комменте PR!) даже *без* ошибок. Ищи варнинги, странности. Устал от ошибок иконок? Найди <em>идеальную</em> Fa6 иконку сам! Юзай <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold px-1'>Поиск FontAwesome <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/></a> -> Добавь в Быстрые Ссылки -> Фикси проактивно. +1 Перк: Находчивость/Предусмотрительность.",
    philosophyLvl5_6: "<strong>Лв.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Мультимедиа):</strong> Используй аудио-команды! Прикрепляй видосы! Смотри, как они автоматом становятся контентом страницы. +1 Перк: Мультимодальный Ввод.",
    philosophyLvl6_7: "<strong>Лв.6 -> 7 <FaDatabase/> (+SQL/БД):</strong> Открой новые типы файлов! AI генерит SQL -> Вставь в Supabase (1 клик) -> <strong>ГОТОВО.</strong> Тот же флоу, другой контекст. +1 Перк: Работа с Данными.",
    philosophyLvl8_10: "<strong>Лв.8-10+ <FaServer/>/<FaRocket/> (+Независимость):</strong> Разверни свой CyberVibe! Юзай/спи*ди мою Supabase! Поставь свой Токен Бота! Строй свои XTR-ы! <strong>БЕЗГРАНИЧНАЯ МОЩЬ!</strong>",
    philosophyLvl11: "<strong>Лв.11 <FaMagnifyingGlass/> (Сканер Кода):</strong> Твои глаза <FaEye /> становятся <em>сканерами кода</em>. Мгновенно видишь пропущенные импорты, опечатки, логические дыры, просто скролля. Ты видишь матрицу.",
    philosophyLvl12: "<strong>Лв.12 <FaMemory/> (Коммандер Контекста):</strong> 65к токенов? <em class='text-purple-300'>Пфф, детский сад.</em> Ты легко жонглируешь гигантским контекстом кода, ведя AI через сложнейшие рефакторинги, как <FaUserAstronaut /> на серфе по небуле.",
    philosophyLvl13: "<strong>Лв.13 <FaKeyboard/> (Ченнелер Вайба):</strong> Забудь про 'печатать', ты <em>ченнелишь</em> вайб <FaHeart className='text-pink-400' />. Детальные промпты, сложные правки, непрерывное творение >10 минут. Ты не работаешь, ты в <em>потоке</em>, изменяя цифровую реальность под себя.",
    philosophyLvl14: "<strong>Лв.14 <FaBriefcase/> (Ниндзя Эффективности):</strong> Зачем ходить дважды? Ты легко вплетаешь мелкие, несвязанные задачи в крупные запросы к AI. <em class='text-cyan-300'>Максимум эффективности, минимум переключений.</em> Твой воркфлоу - идеально настроенный движок.",
    philosophyLvl15: "<strong>Лв.15 <FaMagnifyingGlassChart/> (Шепчущий с Логами <FaBrain/>):</strong> С ПОМОЩЬЮ AI! Ты не читаешь логи, ты их <em class='text-yellow-300'>допрашиваешь</em>. Увидеть разницу между *планом* (логи HasBeenPlanter) и *реальностью* становится второй натурой. Корневые причины сами себя выдают.",
    philosophyEnd: "Шаг за шагом, левел-ап <strong>неизбежен</strong>. Тебе слишком лень для старой х*йни. Один лишний клик, один новый скилл - и ты автоматом сильнее. Добро пожаловать, <strong>Нео</strong>.",
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400 align-baseline'/> ИЛИ Видишь баг/идею -> Вызови Бадди <FaRobot class='inline mx-1 text-indigo-400 align-baseline'/> -> Опиши.",
    step1DescEnd: "Для картинок (Лв.1): Скопируй битый URL, вставь Бадди/в Инпут.",
    step2Title: "2. AI Магия & Отправка:",
    step2Desc: "Если нужно (Лв.2+), юзай <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Проверь Ассистента <FaWandMagicSparkles class='inline mx-1 text-yellow-400 align-baseline'/> -> Жми <FaGithub class='inline mx-1 text-green-400 align-baseline'/> Кнопку PR.",
    step2DescEnd: "<strong>ГОТОВО.</strong> Сайт обновляется авто-магически.",
    readyButton: "ПОГНАЛИ, БЛ*ТЬ!",
    componentsTitle: "Врубай Движки Вайба!",
    ctaTitle: "Готов(а) Апнуться, {USERNAME}?", // Изменено здесь
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
    const [lang, setLang] = useState<keyof typeof translations>('en'); // Use keyof for Language type
    const [t, setT] = useState<typeof translations.en | null>(null); // Use typeof for TranslationSet type
    const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
    const [searchParamsReady, setSearchParamsReady] = useState(false);
    const [searchParamsError, setSearchParamsError] = useState<Error | null>(null);
    const [derivedHighlightedPath, setDerivedHighlightedPath] = useState<string | null>(null);
    const [derivedIdea, setDerivedIdea] = useState<string | null>(null);
    const [initialUrlProcessed, setInitialUrlProcessed] = useState<boolean>(false);
    const hasProcessedInitialIdea = useRef(false);
    log("[ActualPageContent] useState DONE");


    // --- useSearchParams Hook Call ---
    let searchParams: URLSearchParams | null = null;
    try {
        searchParams = useSearchParams();
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
        triggerFetch // Added triggerFetch <<< THIS FUNCTION FROM CONTEXT IS STABLE
    } = pageContext;

    // --- Effect 1: Language ---
    useEffect(() => {
      debug("[Effect Lang] START");
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const resolvedLang: keyof typeof translations = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
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
        const ideaParam = searchParams.get("idea"); // This holds the structured 'ImageReplace|...' or 'ErrorFix|...' or simple text
        const repoParam = searchParams.get("repo");
        const targetBranchParam = searchParams.get("targetBranch");
        const prNumberParam = searchParams.get("prNumber");
        const prUrlParam = searchParams.get("prUrl");

        log(`[Effect URL Params] Raw Params: path=${pathParam}, idea=${ideaParam?.substring(0, 50)}..., repo=${repoParam}, targetBranch=${targetBranchParam}, prNum=${prNumberParam}, prUrl=${prUrlParam}`);


        let needsComponentReveal = false;
        let newRepoUrl: string | null = null;
        let flowType: 'ImageSwap' | 'ErrorFix' | 'Simple' | null = null;
        let flowTargetPath: string | null = null;
        let flowDetails: any = null;
        let suggestedBranch: string | null = null;
        let simpleIdeaText: string | null = null; // Will only be set if flowType is 'Simple'
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
                 log(`[Effect URL Params] Decoded path: ${pathForHighlight}`);

                if (ideaParam) {
                    // --- Decode ideaParam HERE, ONCE ---
                    let decodedIdea = "";
                    try {
                         decodedIdea = decodeURIComponent(ideaParam);
                         log(`[Effect URL Params] Decoded idea: ${decodedIdea.substring(0, 100)}...`);
                    } catch (e) {
                         error("Error decoding 'idea' parameter:", e);
                         simpleIdeaText = ideaParam; // Use raw value if decode fails? Risky.
                         flowType = null;
                    }
                    // --- END DECODE ---

                    if (decodedIdea.startsWith("ImageReplace|")) {
                        flowType = 'ImageSwap';
                        log(`[Flow 1 - Image Swap] RepoXML: Determined Flow Type: ${flowType}`);
                        try {
                            // Split the already decoded string
                            const parts = decodedIdea.split('|');
                            // --- Get the values directly, they should be decoded by the initial decodeURIComponent ---
                            const oldUrlPart = parts.find(p => p.startsWith("OldURL="));
                            const newUrlPart = parts.find(p => p.startsWith("NewURL="));

                            // Check if parts were found before trying to extract value
                            if (oldUrlPart && newUrlPart) {
                                const oldUrl = oldUrlPart.substring(7); // No decodeURIComponent needed
                                const newUrl = newUrlPart.substring(7); // No decodeURIComponent needed

                                if (oldUrl && newUrl) {
                                    flowDetails = { oldUrl, newUrl };
                                    suggestedBranch = targetBranchParam ? decodeURIComponent(targetBranchParam) : repoUtils.guessBranchNameFromPath(flowTargetPath) || 'image-update-' + Date.now().toString(36);
                                    log(`[Flow 1 - Image Swap] RepoXML: ImageSwap details parsed. Old: ${oldUrl.substring(0,30)}, New: ${newUrl.substring(0,30)}, Suggested Branch: ${suggestedBranch}`);
                                } else {
                                    flowType = null; // Reset flow type if parsing fails
                                    warn("[Flow 1 - Image Swap] RepoXML: ImageSwap parsing failed (missing Old/New URL value after substring)");
                                }
                            } else {
                                 flowType = null; // Reset flow type if parts not found
                                 warn("[Flow 1 - Image Swap] RepoXML: ImageSwap parsing failed (could not find OldURL= or NewURL= parts)");
                            }
                             // --- END FIX ---
                        } catch(e) {
                            flowType = null; // Reset flow type on error
                            error("[Flow 1 - Image Swap] RepoXML: Error parsing ImageSwap details:", e);
                        }
                    } else if (decodedIdea.startsWith("ErrorFix|")) {
                        flowType = 'ErrorFix';
                        log(`[Flow 3 - Error Fix] RepoXML: Determined Flow Type: ${flowType}`);
                        try {
                            // Split the already decoded string
                            const detailParts = decodedIdea.substring(9).split('|');
                            const parsedDetails: Record<string, string> = {};
                            detailParts.forEach(part => {
                                const eqIndex = part.indexOf('=');
                                if (eqIndex > 0) {
                                    // Decode individual parts
                                    try {
                                        parsedDetails[part.substring(0, eqIndex)] = decodeURIComponent(part.substring(eqIndex + 1));
                                    } catch (partDecodeError) {
                                         error(`[Flow 3 - Error Fix] RepoXML: Error decoding part '${part.substring(0, eqIndex)}':`, partDecodeError);
                                         parsedDetails[part.substring(0, eqIndex)] = part.substring(eqIndex + 1); // Use raw value as fallback
                                    }
                                }
                            });
                            if (parsedDetails.Message) {
                                flowDetails = parsedDetails;
                                suggestedBranch = targetBranchParam ? decodeURIComponent(targetBranchParam) : ('error-fix-' + Date.now().toString(36).substring(0, 6));
                                log(`[Flow 3 - Error Fix] RepoXML: ErrorFix details parsed. Suggested Branch: ${suggestedBranch}`);
                            } else {
                                flowType = null; // Reset flow type if parsing fails
                                warn("[Flow 3 - Error Fix] RepoXML: ErrorFix parsing failed (missing Message)");
                            }
                        } catch(e) {
                             flowType = null; // Reset flow type on error
                             error("[Flow 3 - Error Fix] RepoXML: Error parsing ErrorFix details:", e);
                        }
                    } else {
                        flowType = 'Simple';
                        simpleIdeaText = decodedIdea; // Store the idea only if it's simple text
                        suggestedBranch = targetBranchParam ? decodeURIComponent(targetBranchParam) : null;
                         log(`[Flow 2 - Generic Idea] RepoXML: Determined Flow Type: ${flowType}. Idea: ${simpleIdeaText.substring(0,50)}... Suggested Branch: ${suggestedBranch}`);
                    }
                }
            } catch (decodeError) { error("Error decoding path param:", decodeError); needsComponentReveal = false; flowType = null; flowTargetPath = null; pathForHighlight = null; simpleIdeaText = null; }
        } else if (ideaParam) {
             try { // Idea only (must be simple text if no path)
                const decodedIdea = decodeURIComponent(ideaParam);
                 log(`[Effect URL Params] Decoded idea (no path): ${decodedIdea.substring(0, 100)}...`);
                 if (!decodedIdea.startsWith("ImageReplace|") && !decodedIdea.startsWith("ErrorFix|")) {
                    simpleIdeaText = decodedIdea;
                    flowType = 'Simple'; // Set flow type here as well
                    needsComponentReveal = true;
                    log(`[Flow 2 - Generic Idea] RepoXML: Determined Flow Type (no path): ${flowType}. Idea: ${simpleIdeaText.substring(0,50)}...`);
                 } else {
                    warn(`[Effect URL Params] Structured idea (${decodedIdea.split('|')[0]}) found without a 'path' parameter. Discarding.`);
                 }
             } catch (e) { error("Error decoding idea param:", e); }
        }

        // --- ACTIONS based on processed params ---
        if (newRepoUrl && repoUrl !== newRepoUrl) { debug(`[Effect URL Params] Setting Repo URL: ${newRepoUrl}`); setRepoUrl(newRepoUrl); }
        if (JSON.stringify(targetPrData) !== JSON.stringify(newTargetPrData)) { debug(`[Effect URL Params] Setting Target PR Data:`, newTargetPrData); setTargetPrData(newTargetPrData); }

        debug(`[Effect URL Params] Setting derived props: path=${pathForHighlight}, simpleIdea=${simpleIdeaText ? simpleIdeaText.substring(0,20)+'...' : null}`);
        setDerivedHighlightedPath(pathForHighlight);
        setDerivedIdea(simpleIdeaText); // Only set the simple text idea derived from the URL

        if ((flowType === 'ImageSwap' || flowType === 'ErrorFix') && flowTargetPath && flowDetails && suggestedBranch && (newRepoUrl || repoUrl)) {
             const flowLogPrefix = flowType === 'ImageSwap' ? '[Flow 1 - Image Swap]' : '[Flow 3 - Error Fix]';
             log(`${flowLogPrefix} RepoXML: Setting Pending Flow: ${flowType}, Branch Suggestion: ${suggestedBranch}. Triggering PreCheck.`);
             setPendingFlowDetails({ type: flowType, targetPath: flowTargetPath, details: flowDetails });
             // --- FIX: Set imageReplaceTask ONLY for ImageSwap Flow ---
             if (flowType === 'ImageSwap') {
                 setImageReplaceTask({
                     targetPath: flowTargetPath,
                     oldUrl: flowDetails.oldUrl,
                     newUrl: flowDetails.newUrl
                 });
                 log(`${flowLogPrefix} setImageReplaceTask called with:`, flowDetails);
             } else {
                  setImageReplaceTask(null); // Ensure it's null for other flows
             }
             // --- END FIX ---
             // Trigger pre-check which will then trigger fetch with the right branch
             triggerPreCheckAndFetch(newRepoUrl || repoUrl, suggestedBranch, flowType, flowDetails, flowTargetPath)
                 .then(() => log(`${flowLogPrefix} RepoXML: PreCheck for ${flowType} completed.`))
                 .catch(preCheckErr => error(`${flowLogPrefix} RepoXML: Error during ${flowType} pre-check trigger:`, preCheckErr));
        } else if (flowType === 'Simple' && suggestedBranch) {
             log(`[Flow 2 - Generic Idea] RepoXML: Simple flow with specific branch target: ${suggestedBranch}. Clearing pending flow.`);
             setTargetBranchName(suggestedBranch); setManualBranchName(''); setPendingFlowDetails(null); setImageReplaceTask(null);
             // We might still need to trigger fetch if simpleIdeaText exists and requires context
             if(simpleIdeaText && needsComponentReveal) {
                 log(`[Flow 2 - Generic Idea] RepoXML: Triggering fetch for simple idea with target branch.`);
                 // Use the stable triggerFetch from context directly
                 triggerFetch(false, suggestedBranch).catch(fetchErr => error(`Error triggering fetch for simple idea:`, fetchErr));
             }
        } else {
            log(`[Effect URL Params] No specific flow trigger or no branch specified for simple flow. Clearing pending flow.`);
            setPendingFlowDetails(null); setImageReplaceTask(null);
             // We might still need to trigger fetch if simpleIdeaText exists and requires context, using default branch
             if(flowType === 'Simple' && simpleIdeaText && needsComponentReveal) {
                 log(`[Flow 2 - Generic Idea] RepoXML: Triggering fetch for simple idea with default branch.`);
                 // Use the stable triggerFetch from context directly
                 triggerFetch(false, null).catch(fetchErr => error(`Error triggering fetch for simple idea (default):`, fetchErr));
             }
        }

        if (needsComponentReveal && !showComponents) { debug("[Effect URL Params] Setting showComponents=true"); setShowComponents(true); }

        setInitialUrlProcessed(true);
        debug("[Effect URL Params] Processing END, marked as processed.");

    }, [ // Dependencies remain the same
        searchParamsReady, searchParams, searchParamsError, initialUrlProcessed, // Effect guards
        setDerivedHighlightedPath, setDerivedIdea, setInitialUrlProcessed, // Stable local setters
        setRepoUrl, setTargetPrData, setPendingFlowDetails, setImageReplaceTask, // Stable context setters
        setTargetBranchName, setManualBranchName, setShowComponents, // Stable context setters
        triggerPreCheckAndFetch, // Stable context trigger
        repoUrl, targetPrData, showComponents, // Context values read for comparison
        addToast, error, warn, log, debug, // Utilities
        triggerFetch // Still needed for access inside, not as dependency causing re-run
    ]);


    // --- Effect 4: Populate Kwork Input ---
    useEffect(() => {
        // Guards
        if (!initialUrlProcessed || hasProcessedInitialIdea.current || fetchStatus !== 'success' || isPreChecking) {
            debug("[Effect Populate Kwork] Skipping:", { initialUrlProcessed, hasProcessed: hasProcessedInitialIdea.current, fetchStatus, isPreChecking });
            if (initialUrlProcessed && !hasProcessedInitialIdea.current && (fetchStatus === 'error' || fetchStatus === 'failed_retries')) {
                warn("[Effect Populate Kwork] Fetch failed, marking idea as processed to prevent loops.");
                hasProcessedInitialIdea.current = true;
            }
            return;
        }
        // --- FIX: Skip if imageReplaceTask IS active ---
        if (imageReplaceTask) {
             debug("[Effect Populate Kwork] Skipping: ImageReplaceTask is active.");
             // Mark as processed even if skipped due to image task
             if (!hasProcessedInitialIdea.current) {
                 hasProcessedInitialIdea.current = true;
                 log("[Effect Populate Kwork] Marked idea as processed (skipped due to image task).");
             }
             return;
        }
        // --- END FIX ---

        debug("[Effect Populate Kwork] Conditions met (no image task), checking derived idea...");

        // Only populate if a 'Simple' idea was derived from URL params
        if (typeof derivedIdea === 'string' && derivedIdea.trim() !== '') {
             const flowLogPrefix = derivedIdea.startsWith("Fix error in") ? '[Flow 3 - Error Fix]' : '[Flow 2 - Generic Idea]';
             log(`${flowLogPrefix} RepoXML: Populating kwork with simple idea: ${derivedIdea.substring(0, 30)}...`);

            setKworkInputValue(prev => {
                const currentVal = prev ?? '';
                const ideaToAdd = derivedIdea || "";
                const valueToSet = currentVal.includes(ideaToAdd)
                    ? currentVal
                    : currentVal + (currentVal.trim() ? "\n\n" : "") + ideaToAdd;

                 log(`${flowLogPrefix} RepoXML: [Effect Populate Kwork - Setter] Prev: '${prev?.substring(0,20)}...', Idea: '${ideaToAdd.substring(0,20)}...', Setting: '${valueToSet.substring(0,40)}...'`);
                 return valueToSet;
            });

            // Auto-add highlighted file context
            if (derivedHighlightedPath && fetcherRef?.current && allFetchedFiles.some(f => f.path === derivedHighlightedPath)) {
                if (!selectedFetcherFiles.has(derivedHighlightedPath)) {
                    log(`${flowLogPrefix} RepoXML: [Effect Populate Kwork] Auto-adding highlighted file context:`, derivedHighlightedPath);
                    setTimeout(() => { try { fetcherRef.current?.handleAddSelected?.(new Set([derivedHighlightedPath]), allFetchedFiles); } catch(addErr) { error("[Effect Populate Kwork] Error calling handleAddSelected imperatively:", addErr); } }, 50);
                } else { log(`${flowLogPrefix} RepoXML: [Effect Populate Kwork] Highlighted file already selected, skipping auto-add context.`); }
            } else if (derivedHighlightedPath) { warn(`${flowLogPrefix} RepoXML: [Effect Populate Kwork] Highlighted path exists, but file/ref not found for auto-add context.`); }

            // Scroll to input
            const kworkElement = document.getElementById('kwork-input-section');
            if (kworkElement) { setTimeout(() => { try { kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){ error("Scroll error:", e); } }, 250); }

            hasProcessedInitialIdea.current = true; // Mark as processed AFTER attempt
            log(`${flowLogPrefix} RepoXML: [Effect Populate Kwork] Simple idea processed.`);
        } else {
             log("[Effect Populate Kwork] Fetch successful, but no simple idea to populate.");
             hasProcessedInitialIdea.current = true; // Mark as processed anyway
        }
        debug("[Effect Populate Kwork] END");

    }, [ // Dependencies: React to fetch status, pre-check status, the derived idea/path, and URL processing completion.
        fetchStatus, isPreChecking, initialUrlProcessed, derivedIdea, derivedHighlightedPath, // Core triggers
        fetcherRef, allFetchedFiles, selectedFetcherFiles, // Refs/state needed *inside*
        imageReplaceTask, // <<< ADD imageReplaceTask dependency to skip population when active
        setKworkInputValue, // Stable context setter
        // DO NOT add kworkInputValue here - prevents infinite loop
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

                    {/* --- FULL INTRO SECTION --- */}
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

                    {/* --- FULL VIBE LOOP SECTION --- */}
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

                    {/* --- FULL PHILOSOPHY SECTION --- */}
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
                                    {/* --- UPDATED META LEVELS --- */}
                                    <li><VibeContentRenderer content={t.philosophyLvl11} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl12} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl13} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl14} /></li>
                                    <li><VibeContentRenderer content={t.philosophyLvl15} /></li>
                                    {/* --- END UPDATED META LEVELS --- */}
                                </ul>
                                <hr className="border-gray-700 my-3"/>
                                <div className="font-bold text-brand-green"><VibeContentRenderer content={t.philosophyEnd} /></div>
                                <hr className="border-gray-700 my-4"/>
                                <h4 className="text-lg font-semibold text-cyan-400 pt-2"><VibeContentRenderer content={t.stepsTitle} /></h4>
                                 {/* --- Quick Start Guide: Reverted to <ol> for proper numbering --- */}
                                <ol className="list-decimal list-inside text-sm space-y-1">
                                     <li><VibeContentRenderer content={"Настрой <FaCodeBranch title='Настройки' class='inline text-cyan-400'/>"} /></li>
                                     <li><VibeContentRenderer content={"Жми <span class='font-bold text-purple-400 mx-1'>\"Извлечь файлы\"</span>"} /></li>
                                     <li><VibeContentRenderer content={"Выбери файлы или <span class='font-bold text-teal-400 mx-1'>связанные</span> / <span class='font-bold text-orange-400 mx-1'>важные</span>"} /></li>
                                     <li><VibeContentRenderer content={"Опиши задачу ИЛИ добавь файлы <FaPlus title='Добавить выбранные в запрос' class='inline text-sm'/> / все <FaTree title='Добавить все файлы в запрос' class='inline text-sm'/>"} /></li>
                                     <li><VibeContentRenderer content={"Скопируй <FaCopy title='Скопировать запрос' class='inline text-sm mx-px'/> или передай дальше"} /></li>
                                </ol>
                                 {/* --- END Quick Start Guide Fix --- */}
                            </div>
                        </details>
                    </section>

                    {/* --- FULL REVEAL BUTTON SECTION --- */}
                    {!showComponents && (
                        <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                            {(() => { debug("[Render] Rendering Reveal Button"); return null; })()}
                            <Button onClick={handleShowComponents} className="bg-gradient-to-r from-green-500 via-cyan-500 to-purple-600 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce hover:animate-none ring-2 ring-offset-2 ring-offset-gray-950 ring-transparent hover:ring-cyan-300" size="lg">
                                <FaHandSparkles className="mr-2"/> <VibeContentRenderer content={t.readyButton} />
                            </Button>
                        </section>
                    )}

                    {/* --- FULL WORKHORSE COMPONENTS SECTION --- */}
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

                    {/* --- FULL FINAL CTA SECTION --- */}
                     {showComponents && (
                         <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                              {(() => { debug("[Render] Rendering Final CTA"); return null; })()}
                              <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50 prose prose-invert prose-p:my-2 prose-strong:text-yellow-200 max-w-none">
                                 <h3 className="text-2xl font-bold text-white mb-3"><VibeContentRenderer content={t?.ctaTitle?.replace('{USERNAME}', userName) ?? ''} /></h3>
                                 <div className="text-white text-lg mb-4"> <VibeContentRenderer content={t.ctaDesc} /> </div>
                                 <div className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded"> <FaRocket className="inline mr-2 text-cyan-300 animate-pulse"/> <VibeContentRenderer content={t.ctaHotChick} /> <FaUserAstronaut className="inline ml-2 text-pink-300"/> </div>
                                 <div className="text-gray-300 text-base"> <VibeContentRenderer content={t.ctaDude} /> </div>
                             </div>
                         </section>
                     )}

                    {/* --- FULL NAVIGATION ICONS --- */}
                     <motion.nav className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40" animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2.0, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}>
                         <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition shadow-md" title={navTitleIntro} aria-label={navTitleIntro || "Scroll to Intro"} > <FaCircleInfo className="text-lg text-gray-200" /> </button>
                         <button onClick={() => scrollToSectionNav("cybervibe-section")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition shadow-md" title={navTitleVibeLoop} aria-label={navTitleVibeLoop || "Scroll to Vibe Loop"} > <FaUpLong className="text-lg text-white" /> </button>
                         {showComponents && ( <>
                                <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition shadow-md" title={navTitleGrabber} aria-label={navTitleGrabber || "Scroll to Grabber"} > <FaDownload className="text-lg text-white" /> </button>
                                <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-indigo-700/80 backdrop-blur-sm rounded-full hover:bg-indigo-600 transition shadow-md" title={navTitleAssistant} aria-label={navTitleAssistant || "Scroll to Assistant"} > <FaRobot className="text-lg text-white" /> </button>
                         </> )}
                    </motion.nav>

                    {/* --- FULL AUTOMATION BUDDY SECTION --- */}
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
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );

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