"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useSearchParams } from 'next/navigation';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, RepoXmlPageProvider,
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask,
    RepoXmlPageContextType // Import RepoXmlPageContextType
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
    FaTools, FaCode, FaVideo, FaDatabase, FaBug, FaMicrophone, FaLink, FaServer, FaRocket
} from "react-icons/fa6";
import Link from "next/link";
import { motion } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer';

// --- I18N Translations (Unchanged) ---
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
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> is your <strong>cyberchest</strong>. This Studio + AI? Your interface to <strong>remix and transmute</strong> that knowledge into new vibes, features, fixes... <strong>instantly</strong>.",
    cyberVibe3: "You're not <em>learning</em> code; you're <strong>remixing the matrix</strong>. You interact, you understand structure, you <strong>command the AI</strong>. You're the Vibe Master.",
    cyberVibe4: "It's <strong>co-creation</strong> with the machine. Push boundaries. Earn bandwidth. Infinite context. Infinite power. This is <strong>CYBERVIBE 2.0</strong>.",
    philosophyTitle: "Your Vibe Path: The Inevitable Level Up (Tap)",
    philosophyVideoTitle: "Watch: The Level System Explained <FaVideo/>:",
    philosophyCore: "The secret? <strong>You're not asking the bot for help, YOU are helping the BOT</strong>. Each level adds <strong>+1 Vibe Perk</strong>, one more click, one more skill to guide the AI. It's not a grind, it's evolution. You get lazy doing the old stuff, so you <em>automatically</em> level up. And there's <strong>NO GOING BACK!</strong>",
    philosophyLvl0_1: "<strong>Lv.0 -> 1 <FaBolt/> (Instant Win):</strong> Fix a broken image. Copy URL -> Paste -> Upload new -> <strong>DONE</strong>. System auto-PRs. <strong>ANYONE</strong> can do this <em>NOW</em>. This is your entry point.",
    philosophyLvl1_2: "<strong>Lv.1 -> 2 <FaTools/> (+1 File/AI):</strong> Simple idea? Change text/button? Give AI the idea + 1 file context -> PR. <strong>DONE.</strong>",
    philosophyLvl2_3: "<strong>Lv.2 -> 3 <FaCode/> (+Multi-File):</strong> Slightly complex? 2-5 files? Give AI idea + context -> Check -> PR. <strong>DONE.</strong>",
    philosophyLvl3_4: "<strong>Lv.3 -> 4 <FaBug/> (+Log Check):</strong> Build failed? Runtime error? 99% it's a bad icon! Check Vercel logs (link in PR comment!) -> Copy red lines -> Feed error to AI -> <strong>FIXED.</strong> +1 Vibe Perk: Debugging.",
    philosophyLvl4_5: "<strong>Lv.4 -> 5 <FaLink/> (+Icon Hunt):</strong> Tired of icon errors? Find the <em>perfect</em> Fa6 icon yourself! Use <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold'>FontAwesome Search <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></a> -> Add link to Assistant Quick Links -> Fix icons proactively. +1 Perk: Resourcefulness.",
    philosophyLvl5_6: "<strong>Lv.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Multimedia):</strong> Use audio commands! Attach videos! Watch them turn into page content automatically. +1 Perk: Multi-modal Input.",
    philosophyLvl6_7: "<strong>Lv.6 -> 7 <FaDatabase/> (+SQL/DB):</strong> Discover new file types! AI generates SQL -> Paste into Supabase (1 click) -> <strong>DONE.</strong> Same flow, different context. +1 Perk: Data Handling.",
    philosophyLvl8_10: "<strong>Lv.8-10+ <FaServer/>/<FaRocket/> (+Independence):</strong> Deploy your OWN CyberVibe! Use/steal my Supabase! Set your own Bot Token! Build your own XTRs! <strong>UNLIMITED POWER!</strong>",
    philosophyEnd: "Step-by-step, level-up is <strong>inevitable</strong>. You're too lazy for the old shit. One extra click, one new skill, and you're automatically stronger. Welcome, <strong>Neo</strong>.",
    stepsTitle: "Quick Start Guide:",
    step1Title: "1. Grab Repo / Point Wish:",
    step1Desc: "Enter GitHub URL -> Hit <FaDownload class='inline mx-1 text-purple-400'/> OR Spot bug/idea -> Activate Buddy <FaRobot class='inline mx-1 text-indigo-400'/> -> Describe.",
    step1DescEnd: "For images (Lv.1): Copy broken URL, paste in Buddy/Input.",
    step2Title: "2. AI Magic & Ship:",
    step2Desc: "If needed (Lv.2+), use <span class='text-blue-400 font-semibold'>\"🤖 Ask AI\"</span> -> Check Assistant <FaWandMagicSparkles class='inline mx-1 text-yellow-400'/> -> Hit <FaGithub class='inline mx-1 text-green-400'/> PR Button.",
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
  ru: { // --- RUSSIAN TRANSLATIONS (Unchanged) ---
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    welcome: "Йоу,",
    intro1: "Код пугает? Забудь! Это <strong>СЕЙЧАС</strong>. Твой личный <strong>dev-ускоритель</strong>. Мгновенный Level UP!",
    intro2: "Думай: Волшебная Песочница. Есть идеи? Говори. AI строит, система чекает, PR улетает. <strong>Бум.</strong> Ты рулишь процессом.",
    intro3: "Хватит потреблять, стань <strong>ТВОРЦОМ</strong>. Строй СВОЮ реальность, решай СВОИ проблемы, <strong>валидируй идеи МГНОВЕННО</strong>. Вот это вайб.",
    cyberVibeTitle: "Петля Вайба: Твой Движок Прокачки <FaUpLong/>",
    cyberVibe1: "Это не просто тулзы – это <strong>накопительная петля обратной связи</strong>. Каждое действие качает тебя, делает следующий шаг легче. Ты эволюционируешь.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400'/> - твой <strong>кибер-сундук</strong>. Эта Студия + AI? Твой интерфейс для <strong>ремикса и трансмутации</strong> этих знаний в новые вайбы, фичи, фиксы... <strong>мгновенно</strong>.",
    cyberVibe3: "Ты не <em>учишь</em> код; ты <strong>ремиксуешь матрицу</strong>. Взаимодействуешь, понимаешь структуру, <strong>командуешь AI</strong>. Ты - Вайб Мастер.",
    cyberVibe4: "Это <strong>со-творчество</strong> с машиной. Двигай границы. Зарабатывай bandwidth. Бесконечный контекст. Бесконечная мощь. Это <strong>CYBERVIBE 2.0</strong>.",
    philosophyTitle: "Твой Путь Вайба: Неизбежный Level Up (Жми)",
    philosophyVideoTitle: "Смотри: Объяснение Системы Уровней <FaVideo/>:",
    philosophyCore: "Секрет? <strong>Не ты просишь бота помочь, а ТЫ помогаешь БОТУ</strong>. Каждый левел дает <strong>+1 Вайб Перк</strong>, +1 клик, +1 скилл, чтобы направлять AI. Это не гринд, это эволюция. Тебе становится лень делать старое, и ты <em>автоматически</em> апаешь левел. И <strong>НАЗАД ДОРОГИ НЕТ!</strong>",
    philosophyLvl0_1: "<strong>Лв.0 -> 1 <FaBolt/> (Мгновенный Вин):</strong> Починить битую картинку. Скопируй URL -> Вставь -> Загрузи новую -> <strong>ГОТОВО</strong>. Система авто-PR. <strong>ЛЮБОЙ</strong> может это <em>ПРЯМО СЕЙЧАС</em>. Это твой вход.",
    philosophyLvl1_2: "<strong>Лв.1 -> 2 <FaTools/> (+1 Файл/AI):</strong> Простая идея? Текст/кнопку поменять? Дай AI идею + 1 файл контекста -> PR. <strong>ГОТОВО.</strong>",
    philosophyLvl2_3: "<strong>Лв.2 -> 3 <FaCode/> (+Мульти-Файл):</strong> Чуть сложнее? 2-5 файлов? Дай AI идею + контекст -> Проверь -> PR. <strong>ГОТОВО.</strong>",
    philosophyLvl3_4: "<strong>Лв.3 -> 4 <FaBug/> (+Чек Логов):</strong> Упала сборка? Ошибка в рантайме? 99% - еб*ная иконка! Открой логи Vercel (ссылка в комменте PR!) -> Скопируй красные строки -> Скорми ошибку AI -> <strong>ПОЧИНЕНО.</strong> +1 Вайб Перк: Дебаггинг.",
    philosophyLvl4_5: "<strong>Лв.4 -> 5 <FaLink/> (+Охота за Иконками):</strong> Зае*али ошибки иконок? Найди <em>идеальную</em> Fa6 иконку сам! Юзай <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold'>Поиск FontAwesome <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-1'/></a> -> Добавь в Быстрые Ссылки Ассистента -> Фикси иконки проактивно. +1 Перк: Находчивость.",
    philosophyLvl5_6: "<strong>Лв.5 -> 6 <FaMicrophone/>/<FaVideo/> (+Мультимедиа):</strong> Используй аудио-команды! Прикрепляй видосы! Смотри, как они автоматом становятся контентом страницы. +1 Перк: Мультимодальный Ввод.",
    philosophyLvl6_7: "<strong>Лв.6 -> 7 <FaDatabase/> (+SQL/БД):</strong> Открой новые типы файлов! AI генерит SQL -> Вставь в Supabase (1 клик) -> <strong>ГОТОВО.</strong> Тот же флоу, другой контекст. +1 Перк: Работа с Данными.",
    philosophyLvl8_10: "<strong>Лв.8-10+ <FaServer/>/<FaRocket/> (+Независимость):</strong> Разверни свой CyberVibe! Юзай/спи*ди мою Supabase! Поставь свой Токен Бота! Строй свои XTR-ы! <strong>БЕЗГРАНИЧНАЯ МОЩЬ!</strong>",
    philosophyEnd: "Шаг за шагом, левел-ап <strong>неизбежен</strong>. Тебе слишком лень для старой х*йни. Один лишний клик, один новый скилл - и ты автоматом сильнее. Добро пожаловать, <strong>Нео</strong>.",
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400'/> ИЛИ Видишь баг/идею -> Вызови Бадди <FaRobot class='inline mx-1 text-indigo-400'/> -> Опиши.",
    step1DescEnd: "Для картинок (Лв.1): Скопируй битый URL, вставь Бадди/в Инпут.",
    step2Title: "2. AI Магия & Отправка:",
    step2Desc: "Если нужно (Лв.2+), юзай <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Проверь Ассистента <FaWandMagicSparkles class='inline mx-1 text-yellow-400'/> -> Жми <FaGithub class='inline mx-1 text-green-400'/> Кнопку PR.",
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

// --- getPlainText helper (Unchanged) ---
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
        logger.error("[getPlainText] Error stripping HTML for title:", e, "Input:", htmlString);
        return htmlString; // Return original on error
    }
};


// --- ActualPageContent Component ---
function ActualPageContent() {
    logger.log("[ActualPageContent] START Render - Top Level");

    // --- HOOKS (Called Unconditionally at Top Level) ---
    const { user } = useAppContext();
    logger.log("[ActualPageContent] useAppContext DONE");
    const pageContext = useRepoXmlPageContext();
    logger.log("[ActualPageContent] useRepoXmlPageContext DONE");
    const { info: toastInfo, error: toastError } = useAppToast();
    logger.log("[ActualPageContent] useAppToast DONE");

    // Refs
    const fetcherRef = pageContext?.fetcherRef; // Get refs from context
    const assistantRef = pageContext?.assistantRef;
    const kworkInputRef = pageContext?.kworkInputRef;
    const aiResponseInputRef = pageContext?.aiResponseInputRef;

    // State
    logger.log("[ActualPageContent] Initializing State...");
    const [lang, setLang] = useState<Language>('en');
    const [showComponents, setShowComponents] = useState(false);
    const [initialIdea, setInitialIdea] = useState<string | null>(null);
    const [initialIdeaProcessed, setInitialIdeaProcessed] = useState<boolean>(false);
    const [t, setT] = useState<TranslationSet | null>(null);
    const [isPageLoading, setIsPageLoading] = useState<boolean>(true); // NEW Loading state
    logger.log("[ActualPageContent] useState DONE");

    // Search Params (with error handling)
    let searchParams: URLSearchParams | null = null;
    let searchParamsError: Error | null = null;
    try {
      searchParams = useSearchParams();
      logger.log("[ActualPageContent] useSearchParams DONE");
    } catch (e: any) {
      searchParamsError = e;
      logger.error("[ActualPageContent] Error initializing useSearchParams:", e);
    }

    // --- CONTEXT VALIDATION ---
    if (!pageContext || typeof pageContext.addToast !== 'function') {
         logger.fatal("[ActualPageContent] CRITICAL: RepoXmlPageContext is missing or invalid!");
         return <div className="text-red-500 p-4">Критическая ошибка: Контекст страницы не загружен.</div>;
    }
    logger.log("[ActualPageContent] pageContext VALUE:", pageContext ? "Available" : "NULL");

    // --- Destructure context ---
    const {
        // Keep destructuring state used in effects or callbacks
        setImageReplaceTask, setKworkInputHasContent, fetchStatus,
        imageReplaceTask, allFetchedFiles, selectedFetcherFiles,
        repoUrl, setRepoUrl, addToast,
        // No need to destructure refs again if taken above
    } = pageContext;

    // --- Effects ---
    useEffect(() => {
        logger.log("[ActualPageContent] Client-side hydration COMPLETE.");
        // Determine initial loading state based on translation availability
        setIsPageLoading(!t);
        return () => {
          logger.log("[ActualPageContent] Unmounting.");
        };
      }, [t]); // Re-evaluate loading when t changes

    useEffect(() => {
      logger.debug("[Effect Lang] START");
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const resolvedLang = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(resolvedLang);
      const newTranslations = translations[resolvedLang] ?? translations.en;
      setT(newTranslations); // Set translations
      setIsPageLoading(false); // Set loading to false *after* translations are set
      logger.info(`[Effect Lang] Language set to: ${resolvedLang}. Page loading set to false.`);
    }, [user]);

    useEffect(() => {
      if (!searchParams) {
          logger.warn("[Effect URL Params] Skipping effect, searchParams failed to initialize.");
          setInitialIdeaProcessed(true);
          return;
      }
      logger.debug("[Effect URL Params] START");
      const pathParam = searchParams.get("path");
      const ideaParam = searchParams.get("idea");
      const repoParam = searchParams.get("repo");

      if (repoParam) {
           try {
               const decodedRepoUrl = decodeURIComponent(repoParam);
               if (decodedRepoUrl && typeof decodedRepoUrl === 'string' && decodedRepoUrl.includes("github.com")) {
                   setRepoUrl(decodedRepoUrl);
                   logger.info(`[Effect URL Params] Repo URL set from param: ${decodedRepoUrl}`);
               } else { logger.warn(`[Effect URL Params] Invalid or empty repo URL from param: ${repoParam}`); }
           } catch (e) { logger.error("[Effect URL Params] Error decoding repo URL param:", e); }
       }

        if (pathParam && ideaParam) {
            let decodedIdea: string | null = null; let decodedPath: string | null = null;
            try {
                decodedPath = decodeURIComponent(pathParam); decodedIdea = decodeURIComponent(ideaParam);
                if (decodedIdea?.startsWith("ImageReplace|")) {
                   logger.log("[Effect URL Params] Processing Image Replace task from URL.");
                    try {
                        const parts = decodedIdea.split('|');
                        const oldUrlParam = parts.find(p => p.startsWith("OldURL=")); const newUrlParam = parts.find(p => p.startsWith("NewURL="));
                        if (oldUrlParam && newUrlParam && decodedPath) {
                            const oldUrl = decodeURIComponent(oldUrlParam.substring(7)); const newUrl = decodeURIComponent(newUrlParam.substring(7));
                            if (oldUrl && newUrl) {
                                const task: ImageReplaceTask = { targetPath: decodedPath, oldUrl: oldUrl, newUrl: newUrl };
                                setImageReplaceTask(task); setInitialIdea(null); logger.info(`[Effect URL Params] Setting ImageReplaceTask`, task);
                            } else { logger.error("[Effect URL Params] Invalid image task URL data", { decodedPath, oldUrl, newUrl }); setImageReplaceTask(null); setInitialIdea(null); }
                        } else { logger.error("[Effect URL Params] Could not parse ImageReplace parts:", decodedIdea); setImageReplaceTask(null); setInitialIdea(null); }
                    } catch (splitError) { logger.error("[Effect URL Params] Error splitting ImageReplace task:", splitError); setImageReplaceTask(null); setInitialIdea(null); }
                   setInitialIdeaProcessed(true);
                } else if (decodedIdea) {
                   logger.log("[Effect URL Params] Regular idea param found:", decodedIdea.substring(0, 50) + "...");
                    setInitialIdea(decodedIdea); setImageReplaceTask(null); setInitialIdeaProcessed(false);
                } else { logger.warn("[Effect URL Params] Decoded idea empty/invalid."); setImageReplaceTask(null); setInitialIdea(null); setInitialIdeaProcessed(true); }
            } catch (decodeError) { logger.error("[Effect URL Params] Error decoding params:", decodeError); setImageReplaceTask(null); setInitialIdea(null); setInitialIdeaProcessed(true); }
            if (decodedPath || decodedIdea) {
                logger.debug("[Effect URL Params] Setting showComponents=true"); setShowComponents(true);
            }
        } else {
            logger.log(`[Effect URL Params] No valid path/idea params.`);
            setImageReplaceTask(null); setInitialIdea(null); setInitialIdeaProcessed(true);
        }
       logger.debug("[Effect URL Params] END");
    }, [searchParams, setImageReplaceTask, setRepoUrl, addToast]);

     useEffect(() => {
        logger.debug("[Effect Kwork Populate] Check START");
        const fetchAttemptFinished = ['success', 'error', 'failed_retries'].includes(fetchStatus);

        if (fetchAttemptFinished && initialIdea && !initialIdeaProcessed && !imageReplaceTask && kworkInputRef?.current) { // Added null check for ref
           logger.info(`[Effect Kwork Populate] Fetch finished (${fetchStatus}). Populating kwork.`);
            kworkInputRef.current.value = initialIdea;
            try { kworkInputRef.current.dispatchEvent(new Event('input', { bubbles: true })); }
            catch (eventError) { logger.error("[Effect Kwork Populate] Dispatch input event error:", eventError); }
            setKworkInputHasContent(initialIdea.trim().length > 0);

            if (fetcherRef?.current?.handleAddSelected) { // Added null check
                if (selectedFetcherFiles.size > 0) {
                     logger.log("[Effect Kwork Populate] Calling fetcherRef.handleAddSelected.");
                     const filesToAdd = selectedFetcherFiles ?? new Set<string>();
                     const allFilesData = allFetchedFiles ?? [];
                     (async () => {
                        try { await fetcherRef.current!.handleAddSelected(filesToAdd, allFilesData); logger.log("[Effect Kwork Populate] handleAddSelected success."); }
                        catch (err) { logger.error("[Effect Kwork Populate] handleAddSelected error:", err); }
                     })();
                } else { logger.log("[Effect Kwork Populate] Skipping handleAddSelected (empty selection)."); }
            } else { logger.warn("[Effect Kwork Populate] handleAddSelected not found or fetcherRef null."); }

            const kworkElement = document.getElementById('kwork-input-section');
            if (kworkElement) { setTimeout(() => { try { kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); logger.log("[Effect Kwork Populate] Scrolled to kwork."); } catch (e) { logger.error("Error scrolling to kwork:", e); } }, 250); }
            setInitialIdeaProcessed(true);
        } else if (fetchAttemptFinished && !initialIdeaProcessed) {
            setInitialIdeaProcessed(true);
            logger.log(`[Effect Kwork Populate] Fetch finished (${fetchStatus}), no pending idea/kworkInputRef.`);
        }
        logger.debug("[Effect Kwork Populate] Check END");
     }, [ fetchStatus, initialIdea, initialIdeaProcessed, imageReplaceTask, kworkInputRef, setKworkInputHasContent, fetcherRef, allFetchedFiles, selectedFetcherFiles, addToast ]);


    // --- Callbacks (Defined Unconditionally) ---
    const memoizedGetPlainText = useCallback(getPlainText, []);

    const scrollToSectionNav = useCallback((id: string) => {
        logger.debug(`[CB ScrollNav] Attempting scroll to: ${id}`);
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps'];
        const targetElement = document.getElementById(id);

        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            logger.info(`[CB ScrollNav] Revealing components for "${id}"`);
            setShowComponents(true);
            requestAnimationFrame(() => {
                const revealedElement = document.getElementById(id);
                if (revealedElement) {
                     try { const offsetTop = window.scrollY + revealedElement.getBoundingClientRect().top - 80; window.scrollTo({ top: offsetTop, behavior: 'smooth' }); logger.log(`[CB ScrollNav] Scrolled to revealed "${id}"`); }
                     catch (e) { logger.error(`[CB ScrollNav] Error scrolling to revealed "${id}":`, e); }
                } else { logger.error(`[CB ScrollNav] Target "${id}" not found after reveal attempt.`); }
            });
        } else if (targetElement) {
             try { const offsetTop = window.scrollY + targetElement.getBoundingClientRect().top - 80; window.scrollTo({ top: offsetTop, behavior: 'smooth' }); logger.log(`[CB ScrollNav] Scrolled to "${id}"`); }
             catch (e) { logger.error(`[CB ScrollNav] Error scrolling to "${id}":`, e); }
        } else { logger.error(`[CB ScrollNav] Target element with id "${id}" not found.`); }
    }, [showComponents]);

    const handleShowComponents = useCallback(() => {
        logger.info("[Button Click] handleShowComponents (Reveal)");
        setShowComponents(true);
        toastInfo("Компоненты загружены!", { duration: 1500 });
    }, [toastInfo]); // Added toastInfo dependency

    // --- Derived State (Calculated Unconditionally) ---
    logger.log("[ActualPageContent] Calculating derived state");
    const userName = user?.first_name || 'Vibe Master';
    const navTitleIntro = useMemo(() => t ? memoizedGetPlainText(t.navIntro) : "Intro", [t, memoizedGetPlainText]);
    const navTitleVibeLoop = useMemo(() => t ? memoizedGetPlainText(t.navCyberVibe) : "Vibe Loop", [t, memoizedGetPlainText]);
    const navTitleGrabber = useMemo(() => t ? memoizedGetPlainText(t.navGrabber) : "Grabber", [t, memoizedGetPlainText]);
    const navTitleAssistant = useMemo(() => t ? memoizedGetPlainText(t.navAssistant) : "Assistant", [t, memoizedGetPlainText]);

    // --- Render Helper (Defined Unconditionally) ---
    const renderVibeContent = useCallback((contentKey: keyof TranslationSet, wrapperClassName?: string) => {
         const content = t?.[contentKey];
         return content ? <VibeContentRenderer content={content} className={wrapperClassName} /> : `[Missing Translation: ${contentKey}]`;
    }, [t]);

    // --- Loading / Error States (Checked before main return) ---
     if (searchParamsError) {
        logger.error("[Render] ActualPageContent: Rendering error state due to searchParams failure.");
        return <div className="text-red-500 p-4">Ошибка: Не удалось инициализировать параметры URL ({searchParamsError.message}).</div>;
     }
     if (isPageLoading || !t) { // Use combined loading check
         logger.log("[Render] ActualPageContent: Rendering Loading State");
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang]?.loading ?? translations.en.loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }

    // --- Main Render Logic ---
    logger.log("[ActualPageContent] Proceeding to main JSX RETURN");
    try {
        return (
            <>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                 {/* Main container rendered unconditionally */}
                <div className="min-h-screen bg-gray-950 p-4 sm:p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">
                     {/* Conditional rendering *inside* the main container */}

                    {/* Intro Section */}
                    <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                         <div className="flex justify-center mb-4"> <FaBolt className="w-16 h-16 text-[#E1FF01] text-shadow-[0_0_15px_#E1FF01] animate-pulse" /> </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-4"> {renderVibeContent('pageTitle')} </h1>
                        <p className="text-xl md:text-2xl text-gray-200 mt-4 font-semibold"> {renderVibeContent('welcome')} <span className="text-brand-cyan">{userName}!</span> </p>
                        <div className="text-lg md:text-xl text-gray-300 mt-3 space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-yellow-300 prose-em:text-purple-300 max-w-none">
                            {renderVibeContent('intro1')}
                            {renderVibeContent('intro2')}
                            <div className="font-semibold text-brand-green">{renderVibeContent('intro3')}</div>
                        </div>
                    </section>

                    {/* === The Vibe Loop Section === */}
                    <section id="cybervibe-section" className="mb-12 w-full max-w-3xl">
                         <Card className="bg-gradient-to-br from-purple-900/40 via-black/60 to-indigo-900/40 border border-purple-600/60 shadow-xl rounded-lg p-6 backdrop-blur-sm">
                             <CardHeader className="p-0 mb-4">
                                 <CardTitle className="text-2xl md:text-3xl font-bold text-center text-brand-purple flex items-center justify-center gap-2">
                                    <FaAtom className="animate-spin-slow"/> {renderVibeContent('cyberVibeTitle')} <FaBrain className="animate-pulse"/>
                                </CardTitle>
                             </CardHeader>
                             <CardContent className="p-0 text-gray-300 text-base md:text-lg space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-purple-300 prose-em:text-cyan-300 max-w-none">
                                {renderVibeContent('cyberVibe1')}
                                {renderVibeContent('cyberVibe2')}
                                {renderVibeContent('cyberVibe3')}
                                <div className="text-purple-300 font-semibold">{renderVibeContent('cyberVibe4')}</div>
                             </CardContent>
                         </Card>
                     </section>

                    {/* Your Vibe Path Section - NEW PHILOSOPHY */}
                    <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                        <details className="bg-gray-900/80 border border-gray-700 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4 open:shadow-lg open:border-indigo-500/50">
                            <summary className="text-xl md:text-2xl font-semibold text-brand-green p-4 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800/50 rounded-t-lg transition-colors group">
                                <span className="flex items-center gap-2"><FaCodeBranch /> {renderVibeContent('philosophyTitle')}</span>
                                <span className="text-xs text-gray-500 group-open:rotate-180 transition-transform duration-300">▼</span>
                            </summary>
                            <div className="px-6 pt-2 text-gray-300 space-y-4 text-base prose prose-invert prose-p:my-2 prose-li:my-1 prose-strong:text-yellow-300 prose-em:text-cyan-300 prose-a:text-brand-blue max-w-none">
                                 <div className="my-4 not-prose">
                                     <h4 className="text-lg font-semibold text-cyan-400 mb-2">{renderVibeContent('philosophyVideoTitle')}</h4>
                                     <div className="aspect-video w-full rounded-lg overflow-hidden border border-cyan-700/50 shadow-lg">
                                         <iframe className="w-full h-full" src="https://www.youtube.com/embed/imxzYWYKCyQ" title="YouTube video player - Vibe Level Explanation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
                                     </div>
                                 </div>
                                <hr className="border-gray-700 my-3"/>
                                 <div className="text-purple-300 italic">{renderVibeContent('philosophyCore')}</div>
                                 <hr className="border-gray-700 my-3"/>
                                <h4 className="text-lg font-semibold text-cyan-400 pt-1">Level Progression (+1 Vibe Perk):</h4>
                                <ul className="list-none space-y-2 pl-2 text-sm md:text-base">
                                    <li>{renderVibeContent('philosophyLvl0_1')}</li>
                                    <li>{renderVibeContent('philosophyLvl1_2')}</li>
                                    <li>{renderVibeContent('philosophyLvl2_3')}</li>
                                    <li>{renderVibeContent('philosophyLvl3_4')}</li>
                                    <li>{renderVibeContent('philosophyLvl4_5')}</li>
                                    <li>{renderVibeContent('philosophyLvl5_6')}</li>
                                    <li>{renderVibeContent('philosophyLvl6_7')}</li>
                                    <li>{renderVibeContent('philosophyLvl8_10')}</li>
                                </ul>
                                <hr className="border-gray-700 my-3"/>
                                <div className="font-bold text-brand-green">{renderVibeContent('philosophyEnd')}</div>
                                <hr className="border-gray-700 my-4"/>
                                <h4 className="text-lg font-semibold text-cyan-400 pt-2">{renderVibeContent('stepsTitle')}</h4>
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
                            {logger.debug("[Render] Rendering Reveal Button")}
                            <Button onClick={handleShowComponents} className="bg-gradient-to-r from-green-500 via-cyan-500 to-purple-600 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce hover:animate-none ring-2 ring-offset-2 ring-offset-gray-950 ring-transparent hover:ring-cyan-300" size="lg">
                                <FaHandSparkles className="mr-2"/> {renderVibeContent('readyButton')}
                            </Button>
                        </section>
                    )}

                    {/* WORKHORSE Components */}
                    {showComponents && (
                         <>
                            {logger.debug("[Render] Rendering Workhorse Components Container")}
                            <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse">{renderVibeContent('componentsTitle')}</h2>
                             <section id="extractor" className="mb-12 w-full max-w-4xl">
                               {logger.debug("[Render] Rendering RepoTxtFetcher Component Wrapper...")}
                                 <Card className="bg-gray-900/80 border border-blue-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <RepoTxtFetcher ref={fetcherRef} />
                                     </CardContent>
                                 </Card>
                               {logger.debug("[Render] Rendering RepoTxtFetcher Component Wrapper DONE")}
                             </section>

                             <section id="executor" className="mb-12 w-full max-w-4xl pb-16">
                                {logger.debug("[Render] Rendering AICodeAssistant Component Wrapper...")}
                                 <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <AICodeAssistant ref={assistantRef} kworkInputRefPassed={kworkInputRef} aiResponseInputRefPassed={aiResponseInputRef} />
                                     </CardContent>
                                 </Card>
                                {logger.debug("[Render] Rendering AICodeAssistant Component Wrapper DONE")}
                             </section>
                            {logger.debug("[Render] Rendering Workhorse Components Container DONE")}
                         </>
                     )}

                    {/* Final CTA */}
                     {showComponents && (
                         <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                              {logger.debug("[Render] Rendering Final CTA")}
                              <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50 prose prose-invert prose-p:my-2 prose-strong:text-yellow-200 max-w-none">
                                 <h3 className="text-2xl font-bold text-white mb-3"><VibeContentRenderer content={t?.ctaTitle?.replace('{USERNAME}', userName) ?? ''} /></h3>
                                 <div className="text-white text-lg mb-4"> {renderVibeContent('ctaDesc')} </div>
                                 <div className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded"> <FaHeart className="inline mr-2 text-red-400 animate-ping"/> {renderVibeContent('ctaHotChick')} <FaUserAstronaut className="inline ml-2 text-pink-300"/> </div>
                                 <div className="text-gray-300 text-base"> {renderVibeContent('ctaDude')} </div>
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
                    <Suspense fallback={<LoadingBuddyFallback />}>
                        {logger.debug("[Render] Rendering AutomationBuddy Wrapper (Suspense)")}
                        <AutomationBuddy />
                        {logger.debug("[Render] Rendering AutomationBuddy Wrapper DONE")}
                    </Suspense>
                    {logger.log("[ActualPageContent] Main Content Rendered Successfully")}
                </div>
                {logger.log("[ActualPageContent] RETURN JSX COMPLETED NORMALLY")}
            </>
        );
    } catch (renderError: any) {
         logger.fatal("[ActualPageContent] CRITICAL RENDER ERROR in return JSX:", renderError);
         return <div className="text-red-500 p-4">Критическая ошибка рендеринга страницы: {renderError.message}</div>;
    } finally {
        logger.log("[ActualPageContent] END Render");
    }
}

// --- Layout Component ---
function RepoXmlPageLayout() {
    logger.log("[RepoXmlPageLayout] START Render");
    try {
      // Wrap provider initialization in try-catch
      return (
           <RepoXmlPageProvider>
               <ActualPageContent />
           </RepoXmlPageProvider>
       );
    } catch (layoutError: any) {
      logger.fatal("[RepoXmlPageLayout] CRITICAL RENDER ERROR:", layoutError);
      return <div className="text-red-500 p-4">Критическая ошибка в слое разметки: {layoutError.message}</div>;
    } finally {
       logger.log("[RepoXmlPageLayout] END Render");
    }
}

// --- Exported Page Component ---
export default function RepoXmlPage() {
     logger.log("[RepoXmlPage] START Render (Exported Component)");
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
    const fallbackLoadingText = translations[fallbackLoadingLang]?.loading ?? translations.en.loading;
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p> </div> );

    try {
        return (
            <Suspense fallback={fallbackLoading}>
                <RepoXmlPageLayout />
            </Suspense>
        );
    } catch (pageError: any) {
         logger.fatal("[RepoXmlPage] CRITICAL RENDER ERROR:", pageError);
         return <div className="text-red-500 p-4">Критическая ошибка рендеринга компонента страницы: {pageError.message}</div>;
    } finally {
        logger.log("[RepoXmlPage] END Render (Exported Component)");
    }
}