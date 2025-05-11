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
    FaMagnifyingGlass, FaMemory, FaKeyboard, FaBriefcase, FaMagnifyingGlassChart, FaTree, FaEye
} from "react-icons/fa6";
import Link from "next/link";
import { motion } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import * as repoUtils from "@/lib/repoUtils";
import { cn } from "@/lib/utils";

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
    philosophyLvl4_5: "<strong>Лв.4 -> 5 <FaLink/> (+Icon Hunt / Proactive Log Check):</strong> Проверяй логи Vercel (ссылка в комменте PR!) даже *без* ошибок. Ищи варнинги, странности. Устал от ошибок иконок? Найди <em>идеальную</em> Fa6 иконку сам! Юзай <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-blue hover:underline font-semibold px-1'>Поиск FontAwesome <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/></a> -> Добавь в Быстрые Ссылки -> Фикси проактивно. +1 Перк: Находчивость/Предусмотрительность.",
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
    ctaTitle: "Готов(а) Апнуться, {USERNAME}?",
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

// --- ActualPageContent Component (moved from being default export of page) ---
interface ActualPageContentProps {
  initialPath: string | null;
  initialIdea: string | null;
}
function ActualPageContent({ initialPath, initialIdea }: ActualPageContentProps) {
    const log = logger.log;
    const debug = logger.debug;
    // const warn = logger.warn; // Not used
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
    const [lang, setLang] = useState<keyof typeof translations>('en'); 
    const [t, setT] = useState<typeof translations.en | null>(null); 
    const [isPageLoading, setIsPageLoading] = useState<boolean>(true); // Only for translations now
    log("[ActualPageContent] useState DONE");
    
    // --- CONTEXT VALIDATION ---
    if (!pageContext || typeof pageContext.addToast !== 'function' || typeof pageContext.setRepoUrl !== 'function' || typeof pageContext.setImageReplaceTask !== 'function' || typeof pageContext.triggerFetch !== 'function') {
         error("[ActualPageContent] CRITICAL: RepoXmlPageContext is missing or key functions are invalid!");
         return <div className="text-red-500 p-4">Критическая ошибка: Контекст страницы не загружен или неполный.</div>;
    }
    log("[ActualPageContent] pageContext check passed.");

    // --- Destructure context ---
    const {
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, 
        showComponents, setShowComponents,
        setRepoUrl: contextSetRepoUrl, 
        setImageReplaceTask: contextSetImageReplaceTask,
        triggerFetch: contextTriggerFetch,
        repoUrl: contextRepoUrl,
        addToast: contextAddToast,
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
    }, [user]); 

    // --- Effect 2: Page Loading Status (Only for translations now) ---
    useEffect(() => {
        log("[ActualPageContent Effect] Loading status check.");
        setIsPageLoading(!t);
        log(`[ActualPageContent Effect] Loading check: translations=${!!t}, resulting isPageLoading=${!t}`);
    }, [t]);

    // --- Effect 3: Process Initial Idea ---
    useEffect(() => {
        const ideaIsImageReplace = initialIdea && initialIdea.startsWith('ImageReplace|');
        
        if (ideaIsImageReplace && initialPath && fetcherRef.current && contextSetRepoUrl && contextSetImageReplaceTask && contextTriggerFetch && contextAddToast) {
            logger.info(`[ActualPageContent InitialIdea Effect - IMG] Processing ImageReplace initialIdea: ${initialIdea.substring(0,50)}...`);
            const parsedTask = repoUtils.parseImageReplaceIdea(initialIdea, initialPath); 
            
            if (parsedTask && parsedTask.targetPath) {
                let finalRepoUrl = contextRepoUrl && contextRepoUrl.includes("github.com") ? contextRepoUrl : "https://github.com/salavey13/oneSitePls";
                const githubUrlPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/[^\/]+\/(.+)$/;
                const match = initialPath.match(githubUrlPattern);
                if (match) {
                    finalRepoUrl = `https://github.com/${match[1]}/${match[2]}`;
                    if (parsedTask.targetPath !== match[3]) {
                        logger.warn(`[ActualPageContent InitialIdea Effect - IMG] Mismatch in targetPath from initialPath (${match[3]}) and parsedTask (${parsedTask.targetPath}). Using initialPath's file path.`);
                        parsedTask.targetPath = match[3];
                    }
                }

                if (finalRepoUrl !== contextRepoUrl) {
                    logger.info(`[ActualPageContent InitialIdea Effect - IMG] Setting repoUrl for ImageReplace task: ${finalRepoUrl}`);
                    contextSetRepoUrl(finalRepoUrl); 
                }
                
                contextSetImageReplaceTask(parsedTask);

                setTimeout(() => {
                    logger.info(`[ActualPageContent InitialIdea Effect - IMG] Triggering fetch for parsed task. Repo: ${finalRepoUrl}, Task Path: ${parsedTask.targetPath}`);
                    contextTriggerFetch(false, null); 
                }, 100); 
            } else {
                logger.error(`[ActualPageContent InitialIdea Effect - IMG] Failed to parse ImageReplaceTask from initialIdea: ${initialIdea} or missing targetPath from initialPath: ${initialPath}`);
                contextAddToast("Ошибка: Не удалось обработать задачу замены изображения из URL.", "error");
            }
        } else if (initialIdea && !ideaIsImageReplace && initialPath && fetcherRef.current?.setKworkInputValue) {
            // This is for the "normal" flow.
            // The actual fetch based on highlightedPathProp and setting KWork input
            // is handled within RepoTxtFetcher's useEffect based on its props.
            // No direct fetch trigger is needed here for this specific case,
            // as RepoTxtFetcher will react to its props.
            logger.info(`[ActualPageContent InitialIdea Effect - NORMAL] Normal idea and path detected. Props will be passed to RepoTxtFetcher. Path: ${initialPath}, Idea: ${initialIdea.substring(0,50)}...`);
        }
    }, [initialIdea, initialPath, fetcherRef, contextSetRepoUrl, contextSetImageReplaceTask, contextTriggerFetch, contextRepoUrl, contextAddToast, logger]);
    
    // --- Callbacks ---
    const memoizedGetPlainText = useCallback(getPlainText, []);
    const scrollToSectionNav = useCallback((id: string) => {
        debug(`[CB ScrollNav] Attempting scroll to: ${id}`);
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps'];
        const targetElement = document.getElementById(id);
        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            log(`[CB ScrollNav] Revealing components for "${id}"`);
            setShowComponents(true);
            requestAnimationFrame(() => { 
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
     if (isPageLoading) {
         log(`[Render] ActualPageContent: Rendering Loading State (Waiting for translations)`);
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
                                    {/* Standard Levels */}
                                    {[t.philosophyLvl0_1, t.philosophyLvl1_2, t.philosophyLvl2_3, t.philosophyLvl3_4, t.philosophyLvl4_5, t.philosophyLvl5_6, t.philosophyLvl6_7, t.philosophyLvl8_10].map((levelContent, index) => (
                                        <li key={`std-lvl-${index}`}><VibeContentRenderer content={levelContent} /></li>
                                    ))}
                                    {/* Meta Levels (11-15) with special styling */}
                                    {[t.philosophyLvl11, t.philosophyLvl12, t.philosophyLvl13, t.philosophyLvl14, t.philosophyLvl15].map((levelContent, index) => (
                                        <li key={`meta-lvl-${index}`}>
                                            <div className="p-2 rounded-md border border-purple-600/40 bg-purple-900/20 my-1 shadow-inner shadow-purple-950/50">
                                                <VibeContentRenderer content={levelContent} />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <hr className="border-gray-700 my-3"/>
                                <div className="font-bold text-brand-green"><VibeContentRenderer content={t.philosophyEnd} /></div>
                                <hr className="border-gray-700 my-4"/>
                                <h4 className="text-lg font-semibold text-cyan-400 pt-2"><VibeContentRenderer content={t.stepsTitle} /></h4>
                                <ol className="list-decimal list-inside text-sm space-y-1">
                                     <li><VibeContentRenderer content={"Настрой <FaCodeBranch title='Настройки' class='inline text-cyan-400'/>"} /></li>
                                     <li><VibeContentRenderer content={"Жми <span class='font-bold text-purple-400 mx-1'>\"Извлечь файлы\"</span>"} /></li>
                                     <li><VibeContentRenderer content={"Выбери файлы или <span class='font-bold text-teal-400 mx-1'>связанные</span> / <span class='font-bold text-orange-400 mx-1'>важные</span>"} /></li>
                                     <li><VibeContentRenderer content={"Опиши задачу ИЛИ добавь файлы <FaPlus title='Добавить выбранные в запрос' class='inline text-sm'/> / все <FaTree title='Добавить все файлы в запрос' class='inline text-sm'/>"} /></li>
                                     <li><VibeContentRenderer content={"Скопируй <FaCopy title='Скопировать запрос' class='inline text-sm mx-px'/> или передай дальше"} /></li>
                                </ol>
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
                                         <RepoTxtFetcher
                                             ref={fetcherRef}
                                             highlightedPathProp={initialPath} // Pass from props
                                             ideaProp={initialIdea} // Pass from props
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

// --- New Internal Component to handle useSearchParams ---
function RepoXmlPageInternalContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path');
  const idea = searchParams.get('idea');
  logger.log(`[RepoXmlPageInternalContent] Extracted from URL - path: ${path}, idea: ${idea ? idea.substring(0,30)+'...' : null}`);
  return <ActualPageContent initialPath={path} initialIdea={idea} />;
}

// --- Layout Component ---
function RepoXmlPageLayout() {
    const log = logger.log;
    const error = logger.error;

    log("[RepoXmlPageLayout] START Render");
    try {
      return (
           <RepoXmlPageProvider>
               <RepoXmlPageInternalContent /> {/* Use the new internal component */}
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