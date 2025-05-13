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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"; 
import {
    FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong,
    FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye,
    FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner, FaBolt,
    FaToolbox, FaCode, FaVideo, FaDatabase, FaBug, FaMicrophone, FaLink, FaServer, FaRocket,
    FaMagnifyingGlass, FaMemory, FaKeyboard, FaBriefcase, FaMagnifyingGlassChart, FaTree, FaEye,
    FaUsers, FaQuoteLeft, FaQuoteRight, FaCircleXmark, FaAnglesDown, FaAnglesUp, FaVideoSlash, FaCommentDots,
    FaCheckDouble, FaLightbulb, FaPaintRoller
} from "react-icons/fa6";
import Link from "next/link";
import { motion } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import * as repoUtils from "@/lib/repoUtils";
import { cn } from "@/lib/utils";

// --- I18N Translations ---
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
    communityWisdomTitle: "Community Wisdom <FaUsers/>",
    quote1: "Sam Altman on the dream: 'Getting the whole app after a prompt.' That's what we're building. Full app from a thought. <a href='https://youtube.com/clip/Ugkx1LAX6-gO4J8hC6HoHbg0_KMlBHcsKX3V' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Clip <FaArrowUpRightFromSquare className='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote2: "Vibecoding? 'Yeah, he does.' From video idea to gamified app. Turning vision into interactive reality. <a href='https://youtube.com/clip/UgkxZVMHbEo2XwO-sayoxskH89zzrDdN6vsx' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Clip <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote3: "Monetization: 'Sell outcomes, not just pickaxes.' Automated, 10x cheaper solutions. That's the real product. <a href='https://youtube.com/clip/UgkxvGYsRm3HezCgOyqszCbn5DfDDx7LixPE' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Clip <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    ctaHotChickQuote: "Got the fire? Let's build something epic. Hit me up <strong>@SALAVEY13</strong> NOW!",
    philosophyCore: "The secret? <strong>You're not asking the bot for help, YOU are helping the BOT</strong>. Each level adds <strong>+1 Vibe Perk</strong>, one more click, one more skill to guide the AI. It's not a grind, it's evolution. You get lazy doing the old stuff, so you <em>automatically</em> level up. And there's <strong>NO GOING BACK!</strong>",
    philosophyLvl0_1: "<strong>Lv.0 -> 1 <FaBolt/> (Instant Win / Image Swap Flow):</strong> Fix a broken image. Copy URL -> Paste -> Upload new -> <strong>DONE</strong>. System auto-PRs. <strong>ANYONE</strong> can do this <em>NOW</em>. This is your entry point.",
    philosophyLvl1_2: "<strong>Lv.1 -> 2 <FaToolbox/> (+1 File/AI / Generic Idea Flow):</strong> Simple idea? Change text/button? Give AI the idea + 1 file context -> PR. <strong>DONE.</strong>",
    philosophyLvl2_3: "<strong>Lv.2 -> 3 <FaCode/> (+Multi-File / Generic Idea Flow):</strong> Slightly complex? 2-5 files? Give AI idea + context -> Check -> PR. <strong>DONE.</strong>",
    philosophyLvl3_4: "<strong>Lv.3 -> 4 <FaBug/> (+Log Check / Error Fix Flow):</strong> Build failed? Runtime error? Use Dev Overlay (<FaBug /> icon top-right on error) to copy error + logs -> Feed to AI with file context -> <strong>FIXED.</strong> +1 Vibe Perk: Debugging.",
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
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400 align-baseline'/> OR Spot bug/idea -> Activate Buddy <FaRobot class='inline mx-1 text-indigo-400 align-baseline'/> -> Describe.",
    step1DescEnd: "Для картинок (Лв.1): Copy broken URL, paste in Buddy/Input.",
    step2Title: "2. AI Магия & Ship:",
    step2Desc: "If needed (Lv.2+), use <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Check Assistant <FaWandMagicSparkles class='inline mx-1 text-yellow-400 align-baseline'/> -> Hit <FaGithub class='inline mx-1 text-green-400 align-baseline'/> PR Button.",
    step2DescEnd: "<strong>DONE.</strong> Site updates automagically.",
    readyButton: "LET'S F*CKING GO!",
    componentsTitle: "Врубай Движки Вайба!",
    ctaTitle: "Ready to Level Up, {USERNAME}?",
    ctaDesc: "Seriously. Stop doubting. Start <strong>DOING</strong>. That first level is calling. Level up NOW!",
    ctaDude: "(Everyone else? Just f*cking try it. Level 1 is a button click away. You got this!)",
    navGrabber: "Grabber <FaDownload/>",
    navAssistant: "Assistant <FaRobot/>",
    navIntro: "Intro <FaCircleInfo/>",
    navCyberVibe: "Vibe Loop <FaUpLong/>",
    collapseAll: "Collapse All Sections",
    expandAll: "Expand All Sections",
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
    communityWisdomTitle: "Мудрость Сообщества <FaUsers/>",
    quote1: "Сэм Альтман о мечте: 'Получить целое приложение после промпта.' Это то, что мы строим. Целое приложение из мысли. <a href='https://youtube.com/clip/Ugkx1LAX6-gO4J8hC6HoHbg0_KMlBHcsKX3V' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Альтман чухает фишку <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote2: "Вайбкодинг? 'Ага, он могёт.' От идеи видео до геймифицированного приложения. Превращение видения в интерактивную реальность. <a href='https://youtube.com/clip/UgkxZVMHbEo2XwO-sayoxskH89zzrDdN6vsx' target='_blank' class='text-brand-blue hover:underline font-semibold'>(I do vibe <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote3: "Монетизация: 'Продавай результаты, а не просто кирки.' Автоматизированные, в 10 раз дешевле решения. Вот настоящий продукт. <a href='https://youtube.com/clip/UgkxvGYsRm3HezCgOyqszCbn5DfDDx7LixPE' target='_blank' class='text-brand-blue hover:underline font-semibold'>('Fucking ez' <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    ctaHotChickQuote: "Есть искра? Давай замутим что-то эпичное. Пиши <strong>@SALAVEY13</strong> СЕЙЧАС!",
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
    ctaDude: "(Все остальные? Просто, бл*ть, попробуйте. Левел 1 - это клик мышки. У вас получится!)",
    navGrabber: "Граббер <FaDownload/>",
    navAssistant: "Ассистент <FaRobot/>",
    navIntro: "Интро <FaCircleInfo/>",
    navCyberVibe: "Петля Вайба <FaUpLong/>",
    collapseAll: "Свернуть Все Секции",
    expandAll: "Развернуть Все Секции",
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
        text = text.replace(/::(Fa[A-Z][a-zA-Z0-9]+.*?)::/g, ''); 
        text = text.replace(/\[\?\]/g, '');
        text = text.replace(/\[ICON ERR!\]/g, '');
        text = text.replace(/<[^>]*>/g, ''); 
        return text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    } catch (e) {
        console.error("[getPlainText] Error stripping HTML for title:", e, "Input:", htmlString);
        return htmlString.replace(/<[^>]*>/g, '').trim();
    }
};

// --- ActualPageContent Component ---
interface ActualPageContentProps {
  initialPath: string | null;
  initialIdea: string | null;
}
function ActualPageContent({ initialPath, initialIdea }: ActualPageContentProps) {
    const log = logger.log;
    const debug = logger.debug;
    const error = logger.error;

    log("[ActualPageContent] START Render - Top Level");

    const { user } = useAppContext();
    const pageContext = useRepoXmlPageContext();
    const { info: toastInfo, error: toastError } = useAppToast();

    const [lang, setLang] = useState<keyof typeof translations>('en');
    const [t, setT] = useState<typeof translations.en | null>(null);
    const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
    
    // State for sections visibility
    const [isIntroVisible, setIsIntroVisible] = useState(true);
    const [isCyberVibeVisible, setIsCyberVibeVisible] = useState(true);
    const [isCommunityWisdomVisible, setIsCommunityWisdomVisible] = useState(true);
    const [isPhilosophyStepsVisible, setIsPhilosophyStepsVisible] = useState(true);
    const [isPhilosophyDetailsOpen, setIsPhilosophyDetailsOpen] = useState(true);
    const [isCtaVisible, setIsCtaVisible] = useState(true); 
    const [sectionsCollapsed, setSectionsCollapsed] = useState(false);


    if (!pageContext || typeof pageContext.addToast !== 'function') {
         error("[ActualPageContent] CRITICAL: RepoXmlPageContext is missing or invalid!");
         return <div className="text-red-500 p-4">Критическая ошибка: Контекст страницы не загружен.</div>;
    }

    const {
        fetcherRef, assistantRef, kworkInputRef,
        showComponents, setShowComponents,
    } = pageContext;

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

    useEffect(() => {
        log("[ActualPageContent Effect] Loading status check.");
        setIsPageLoading(!t);
        log(`[ActualPageContent Effect] Loading check: translations=${!!t}, resulting isPageLoading=${!t}`);
    }, [t]);

    const toggleAllSections = useCallback(() => {
        const newCollapsedState = !sectionsCollapsed;
        setSectionsCollapsed(newCollapsedState);
        // When using the master toggle, all sections follow this state
        const newVisibility = !newCollapsedState;
        setIsIntroVisible(newVisibility);
        setIsCyberVibeVisible(newVisibility);
        setIsCommunityWisdomVisible(newVisibility);
        setIsPhilosophyStepsVisible(newVisibility);
        setIsPhilosophyDetailsOpen(newVisibility); 
        if (showComponents) { // Only toggle CTA if components are already shown
            setIsCtaVisible(newVisibility);
        }
        log(`[CB MasterToggle] All sections visibility set to: ${newVisibility}. SectionsCollapsed: ${newCollapsedState}`);
    }, [sectionsCollapsed, showComponents, log]);
    
    const handleShowComponents = useCallback(() => {
        log("[Button Click] handleShowComponents (Reveal)");
        setShowComponents(true);
        setIsCtaVisible(true); // Explicitly show CTA
    
        // If master toggle had collapsed sections, expand them
        if (sectionsCollapsed) {
            setSectionsCollapsed(false); // This will trigger the effect below to show all sections
            setIsIntroVisible(true);
            setIsCyberVibeVisible(true);
            setIsCommunityWisdomVisible(true);
            setIsPhilosophyStepsVisible(true);
            setIsPhilosophyDetailsOpen(true);
        }
        
        toastInfo("Компоненты загружены!", { duration: 1500 });
        setTimeout(() => scrollToSectionNav('extractor'), 100);
    }, [setShowComponents, toastInfo, log, scrollToSectionNav, sectionsCollapsed]);

    const memoizedGetPlainText = useCallback(getPlainText, []);
    const scrollToSectionNav = useCallback((id: string) => {
        debug(`[CB ScrollNav] Attempting scroll to: ${id}`);
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps', 'community-wisdom-section'];
        const targetElement = document.getElementById(id);
        const headerOffset = 80; 

        const scroll = (element: HTMLElement) => {
             try {
                const elementTop = element.getBoundingClientRect().top + window.scrollY;
                const offsetTop = elementTop - headerOffset;
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                log(`[CB ScrollNav] Scrolled to "${id}" at offsetTop: ${offsetTop}`);
            } catch (e) {
                error(`[CB ScrollNav] Error scrolling to "${id}":`, e);
            }
        };

        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            log(`[CB ScrollNav] Revealing components for "${id}"`);
            // Call handleShowComponents to ensure consistent state update
            handleShowComponents(); 
            // Scrolling will be handled by handleShowComponents's timeout
            return; 
        }
        
        if (targetElement) {
            // Ensure the specific section is visible if it was individually closed
            if (id === 'intro' && !isIntroVisible) setIsIntroVisible(true);
            if (id === 'cybervibe-section' && !isCyberVibeVisible) setIsCyberVibeVisible(true);
            if (id === 'community-wisdom-section' && !isCommunityWisdomVisible) setIsCommunityWisdomVisible(true);
            if (id === 'philosophy-steps') {
                if(!isPhilosophyStepsVisible) setIsPhilosophyStepsVisible(true);
                if(!isPhilosophyDetailsOpen) setIsPhilosophyDetailsOpen(true);
            }
            // Add a slight delay for section visibility to update before scrolling
            requestAnimationFrame(() => scroll(targetElement));
        } else {
            error(`[CB ScrollNav] Target element "${id}" not found.`);
        }
    }, [showComponents, handleShowComponents, isIntroVisible, isCyberVibeVisible, isCommunityWisdomVisible, isPhilosophyStepsVisible, isPhilosophyDetailsOpen, log, debug, error]);


     if (isPageLoading) {
         log(`[Render] ActualPageContent: Rendering Loading State (Waiting for translations)`);
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang]?.loading ?? translations.en.loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-dark-bg"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }
     if (!t) {
         error("[Render] ActualPageContent: Critical - translations (t) are null after loading.");
         return <div className="text-red-500 p-4">Критическая ошибка: Не удалось загрузить тексты страницы.</div>;
     }

    const userName = user?.first_name || 'Vibe Master';
    const navTitleIntro = memoizedGetPlainText(t.navIntro);
    const navTitleVibeLoop = memoizedGetPlainText(t.navCyberVibe);
    const navTitleGrabber = memoizedGetPlainText(t.navGrabber);
    const navTitleAssistant = memoizedGetPlainText(t.navAssistant);
    const masterToggleTitle = sectionsCollapsed ? t.expandAll : t.collapseAll;

    const CloseButton = ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
        <button
            onClick={onClick}
            className="absolute top-2 right-2 text-slate-400 hover:text-white z-20 p-1 rounded-full hover:bg-black/30 transition-colors"
            aria-label={ariaLabel}
        >
            <FaCircleXmark className="w-5 h-5" />
        </button>
    );

    log("[ActualPageContent] Preparing to render JSX...");

    try {
       return (
            <>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <div className="min-h-screen bg-dark-bg p-4 sm:p-6 pt-24 text-light-text flex flex-col items-center relative overflow-y-auto">
                    
                    <button
                        onClick={toggleAllSections}
                        className="fixed top-20 left-4 sm:left-6 text-slate-300 hover:text-white z-50 p-2 rounded-full bg-dark-card/70 hover:bg-dark-card/90 backdrop-blur-sm shadow-lg border border-slate-700 hover:border-slate-500 transition-all"
                        title={masterToggleTitle}
                        aria-label={masterToggleTitle}
                    >
                        {sectionsCollapsed ? <FaAnglesUp className="w-5 h-5" /> : <FaAnglesDown className="w-5 h-5" />}
                    </button>

                    {isIntroVisible && (
                        <section id="intro" className="mb-12 text-center max-w-3xl w-full relative">
                            <CloseButton onClick={() => setIsIntroVisible(false)} ariaLabel="Close Intro Section" />
                            <div className="flex justify-center mb-4"> <FaBolt className="w-16 h-16 text-brand-yellow text-shadow-[0_0_15px_hsl(var(--brand-yellow))] animate-pulse" /> </div>
                            <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-brand-yellow text-shadow-[0_0_10px_hsl(var(--brand-yellow))] mb-4">
                               <VibeContentRenderer content={t.pageTitle} />
                            </h1>
                            <p className="text-xl md:text-2xl text-light-text mt-4 font-semibold">
                               <VibeContentRenderer content={t.welcome} /> <span className="text-brand-cyan">{userName}!</span>
                            </p>
                            <div className="text-lg md:text-xl text-muted-foreground mt-3 space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-brand-yellow prose-em:text-brand-purple prose-a:text-brand-blue max-w-none">
                                <VibeContentRenderer content={t.intro1} />
                                <VibeContentRenderer content={t.intro2} />
                                <div className="font-semibold text-brand-green"><VibeContentRenderer content={t.intro3} /></div>
                            </div>
                        </section>
                    )}

                    {isCyberVibeVisible && (
                        <section id="cybervibe-section" className="mb-12 w-full max-w-3xl relative">
                            <CloseButton onClick={() => setIsCyberVibeVisible(false)} ariaLabel="Close Vibe Loop Section" />
                            <Card className="bg-gradient-to-br from-purple-900/40 via-black/60 to-indigo-900/40 border border-purple-600/60 shadow-xl rounded-lg p-6 backdrop-blur-sm bg-dark-card/80">
                                 <CardHeader className="p-0 mb-4">
                                     <CardTitle className="text-2xl md:text-3xl font-bold text-center text-brand-purple flex items-center justify-center gap-2">
                                        <FaAtom className="animate-spin-slow"/> <VibeContentRenderer content={t.cyberVibeTitle} /> <FaBrain className="animate-pulse"/>
                                    </CardTitle>
                                 </CardHeader>
                                 <CardContent className="p-0 text-muted-foreground text-base md:text-lg space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-brand-purple prose-em:text-brand-cyan prose-a:text-brand-blue max-w-none">
                                    <VibeContentRenderer content={t.cyberVibe1} />
                                    <VibeContentRenderer content={t.cyberVibe2} />
                                    <VibeContentRenderer content={t.cyberVibe3} />
                                    <div className="text-purple-300 font-semibold"><VibeContentRenderer content={t.cyberVibe4} /></div>
                                 </CardContent>
                             </Card>
                         </section>
                     )}
                    
                    {isCommunityWisdomVisible && (
                        <section id="community-wisdom-section" className="mb-12 w-full max-w-3xl relative">
                            <CloseButton onClick={() => setIsCommunityWisdomVisible(false)} ariaLabel="Close Community Wisdom Section" />
                            <h3 className="text-2xl md:text-3xl font-orbitron text-brand-cyan mb-6 text-center flex items-center justify-center gap-2">
                               <VibeContentRenderer content={t.communityWisdomTitle} />
                            </h3>
                            <div className="space-y-8">
                                {[
                                    { videoId: "ctcMA6chfDY", start: 1201, title: "YouTube: Sam Altman's Dream", quote: t.quote1, borderColor: "border-brand-cyan", inspiredBy: "- Inspired by Sam Altman" },
                                    { videoId: "dq8MhTFCs80", start: 1197, title: "YouTube: Do you Vibecode?", quote: t.quote2, borderColor: "border-brand-pink", inspiredBy: "- Inspired by Vibe Master" },
                                    { videoId: "xlQB_0Nzoog", start: 743, title: "YouTube: Really F*cking EZ!", quote: t.quote3, borderColor: "border-brand-yellow", inspiredBy: "- Inspired by Strategic Thinking" }
                                ].map(item => (
                                    <div key={item.videoId}>
                                        <div className={`aspect-video w-full rounded-lg overflow-hidden border-2 ${item.borderColor}/50 shadow-lg`}>
                                            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${item.videoId}?start=${item.start}`} title={item.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                        </div>
                                        <div className={`mt-3 p-3 bg-dark-card/70 border-l-4 ${item.borderColor} rounded-r-md text-muted-foreground max-w-none`}>
                                            <div className="flex items-start">
                                                <VibeContentRenderer content="::FaQuoteLeft className='text-current opacity-70 text-lg mr-2 shrink-0'::" />
                                                <div className="prose prose-sm prose-invert max-w-none flex-grow">
                                                    <VibeContentRenderer content={item.quote} />
                                                </div>
                                            </div>
                                            <p className="text-xs text-right opacity-70 mt-1">{item.inspiredBy}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {isPhilosophyStepsVisible && (
                        <section id="philosophy-steps" className="mb-12 w-full max-w-3xl relative">
                            <CloseButton onClick={() => setIsPhilosophyStepsVisible(false)} ariaLabel="Close Philosophy/Steps Section" />
                            <details className="bg-dark-card/80 border border-border rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4 open:shadow-lg open:border-indigo-500/50" open={isPhilosophyDetailsOpen}>
                                <summary 
                                    className="text-xl md:text-2xl font-semibold text-brand-green p-4 cursor-pointer list-none flex justify-between items-center hover:bg-card/50 rounded-t-lg transition-colors group"
                                    onClick={(e) => { e.preventDefault(); setIsPhilosophyDetailsOpen(prev => !prev); }}
                                >
                                    <span className="flex items-center gap-2"><FaCodeBranch /> <VibeContentRenderer content={t.philosophyTitle} /></span>
                                    <span className={`text-xs text-gray-500 transition-transform duration-300 ${isPhilosophyDetailsOpen ? "rotate-180" : ""}`}>▼</span>
                                </summary>
                                <div className="px-6 pt-2 text-muted-foreground space-y-4 text-base prose prose-invert prose-p:my-2 prose-li:my-1 prose-strong:text-brand-yellow prose-em:text-brand-cyan prose-a:text-brand-blue max-w-none">
                                     <div className="my-4 not-prose">
                                         <h4 className="text-lg font-semibold text-brand-cyan mb-2"><VibeContentRenderer content={t.philosophyVideoTitle} /></h4>
                                         <div className="aspect-video w-full rounded-lg overflow-hidden border border-cyan-700/50 shadow-lg">
                                             <iframe className="w-full h-full" src="https://www.youtube.com/embed/imxzYWYKCyQ" title="YouTube video player - Vibe Level Explanation by Salavey13" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                         </div>
                                     </div>
                                    <hr className="border-border my-3"/>
                                     <div className="text-purple-300 italic"><VibeContentRenderer content={t.philosophyCore} /></div>
                                     <hr className="border-border my-3"/>
                                    <h4 className="text-lg font-semibold text-brand-cyan pt-1">Level Progression (+1 Vibe Perk):</h4>
                                    <ul className="list-none space-y-2 pl-2 text-sm md:text-base">
                                        {[t.philosophyLvl0_1, t.philosophyLvl1_2, t.philosophyLvl2_3, t.philosophyLvl3_4, t.philosophyLvl4_5, t.philosophyLvl5_6, t.philosophyLvl6_7, t.philosophyLvl8_10].map((levelContent, index) => (
                                            <li key={`std-lvl-${index}`}><VibeContentRenderer content={levelContent} /></li>
                                        ))}
                                        {[t.philosophyLvl11, t.philosophyLvl12, t.philosophyLvl13, t.philosophyLvl14, t.philosophyLvl15].map((levelContent, index) => (
                                            <li key={`meta-lvl-${index}`}>
                                                <div className="p-2 rounded-md border border-purple-600/40 bg-purple-900/20 my-1 shadow-inner shadow-purple-950/50 bg-dark-card/50">
                                                    <VibeContentRenderer content={levelContent} />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <hr className="border-border my-3"/>
                                    <div className="font-bold text-brand-green"><VibeContentRenderer content={t.philosophyEnd} /></div>
                                    <hr className="border-border my-4"/>
                                    <h4 className="text-lg font-semibold text-brand-cyan pt-2"><VibeContentRenderer content={t.stepsTitle} /></h4>
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
                    )}

                    {!showComponents && (
                        <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                            <Button onClick={handleShowComponents} className="bg-gradient-to-r from-brand-green via-brand-cyan to-brand-purple text-black font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce hover:animate-none ring-2 ring-offset-2 ring-offset-dark-bg ring-transparent hover:ring-brand-cyan" size="lg">
                                <FaHandSparkles className="mr-2"/> <VibeContentRenderer content={t.readyButton} />
                            </Button>
                        </section>
                    )}

                    {showComponents && ( // Core components are always shown if showComponents is true
                         <>
                            <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse"><VibeContentRenderer content={t.componentsTitle} /></h2>
                             <section id="extractor" className="mb-12 w-full max-w-4xl">
                                 <Card className="bg-dark-card/80 border border-blue-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <RepoTxtFetcher
                                             ref={fetcherRef}
                                             highlightedPathProp={initialPath}
                                             ideaProp={initialIdea}
                                         />
                                     </CardContent>
                                 </Card>
                             </section>

                             <section id="executor" className="mb-12 w-full max-w-4xl pb-16">
                                 <Card className="bg-dark-card/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <AICodeAssistant ref={assistantRef} kworkInputRefPassed={kworkInputRef} aiResponseInputRefPassed={pageContext.aiResponseInputRef} />
                                     </CardContent>
                                 </Card>
                             </section>
                         </>
                     )}

                    {isCtaVisible && ( 
                        <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                            {/* Outer Border Div */}
                            <div className="relative p-1.5 rounded-xl bg-gradient-to-b from-blue-800 to-purple-700 shadow-2xl">
                                {/* Middle Border Div */}
                                <div className="p-1 rounded-lg bg-gradient-to-b from-orange-400 via-pink-400 to-purple-700">
                                    {/* Content Div */}
                                    <div className="relative bg-gradient-to-b from-indigo-600 via-pink-600 to-orange-500 p-6 rounded-md prose-strong:text-yellow-200 prose-a:text-brand-blue max-w-none">
                                        <button 
                                            onClick={() => setIsCtaVisible(false)} 
                                            className="absolute top-2 right-2 text-white/70 hover:text-white z-20 p-1 rounded-full hover:bg-black/50 transition-colors"
                                            aria-label="Close CTA"
                                        >
                                            <FaCircleXmark className="w-6 h-6" />
                                        </button>
                                        <h3 className="text-2xl font-bold text-white mb-3 prose-invert"><VibeContentRenderer content={t?.ctaTitle?.replace('{USERNAME}', userName) ?? ''} /></h3>
                                        <div className="text-white text-lg mb-4 prose-invert"> <VibeContentRenderer content={t.ctaDesc} /> </div>
                                        
                                        <div className="aspect-video w-full rounded-lg overflow-hidden border-2 border-orange-500/70 shadow-lg my-6">
                                            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/qCkPM_f3V5c`} title="YouTube: GTA Vibe" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                        </div>
                                        
                                        <div className="mt-3 mb-4 p-3 bg-black/50 border-l-4 border-pink-500 rounded-r-md text-white max-w-none">
                                            <div className="flex items-center">
                                                <VibeContentRenderer content="::FaQuoteLeft className='text-current opacity-80 text-xl mr-2 shrink-0'::" />
                                                <div className="prose prose-sm prose-invert text-center flex-grow max-w-none">
                                                    <VibeContentRenderer content={t.ctaHotChickQuote} />
                                                </div>
                                                <VibeContentRenderer content="::FaQuoteRight className='text-current opacity-80 text-xl ml-2 shrink-0'::" />
                                            </div>
                                            <p className="text-xs text-right opacity-70 mt-1">- Vibe by @SALAVEY13</p>
                                        </div>
                                        <div className="text-slate-300 text-base prose-invert"> <VibeContentRenderer content={t.ctaDude} /> </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}


                     <motion.nav className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40" animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2.0, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}>
                         <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-muted/80 backdrop-blur-sm rounded-full hover:bg-muted/60 transition shadow-md" title={navTitleIntro} aria-label={navTitleIntro || "Scroll to Intro"} > <FaCircleInfo className="text-lg text-foreground/80" /> </button>
                         <button onClick={() => scrollToSectionNav("cybervibe-section")} className="p-2 bg-brand-purple/80 backdrop-blur-sm rounded-full hover:bg-brand-purple/70 transition shadow-md" title={navTitleVibeLoop} aria-label={navTitleVibeLoop || "Scroll to Vibe Loop"} > <FaUpLong className="text-lg text-white" /> </button>
                         {showComponents && ( /* Navigation for components is always available if showComponents is true, regardless of sectionsCollapsed */
                            <>
                                <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-brand-blue/80 backdrop-blur-sm rounded-full hover:bg-brand-blue/70 transition shadow-md" title={navTitleGrabber} aria-label={navTitleGrabber || "Scroll to Grabber"} > <FaDownload className="text-lg text-white" /> </button>
                                <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-brand-cyan/80 backdrop-blur-sm rounded-full hover:bg-brand-cyan/70 transition shadow-md" title={navTitleAssistant} aria-label={navTitleAssistant || "Scroll to Assistant"} > <FaRobot className="text-lg text-white" /> </button>
                            </> 
                         )}
                    </motion.nav>

                    <Suspense fallback={<LoadingBuddyFallback />}>
                        <AutomationBuddy />
                    </Suspense>
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

function RepoXmlPageInternalContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path');
  const idea = searchParams.get('idea');
  logger.log(`[RepoXmlPageInternalContent] Extracted from URL - path: ${path}, idea: ${idea ? idea.substring(0,30)+'...' : null}`);
  return <ActualPageContent initialPath={path} initialIdea={idea} />;
}

function RepoXmlPageLayout() {
    const log = logger.log;
    const error = logger.error;

    log("[RepoXmlPageLayout] START Render");
    try {
      return (
           <RepoXmlPageProvider>
               <RepoXmlPageInternalContent />
           </RepoXmlPageProvider>
       );
    } catch (layoutError: any) {
      error("[RepoXmlPageLayout] CRITICAL RENDER ERROR:", layoutError);
      return <div className="text-red-500 p-4">Критическая ошибка в слое разметки: {layoutError.message}</div>;
    } finally {
       log("[RepoXmlPageLayout] END Render");
    }
}

export default function RepoXmlPage() {
     const log = logger.log;
     const error = logger.error;

     log("[RepoXmlPage] START Render (Exported Component)");
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
    const fallbackLoadingText = translations[fallbackLoadingLang]?.loading ?? translations.en.loading;
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-dark-bg"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p> </div> );

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