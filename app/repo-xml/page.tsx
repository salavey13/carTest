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
import {
    FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong,
    FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye,
    FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner, FaBolt,
    FaTools, FaCode, FaVideo, FaDatabase, FaBug, FaMicrophone, FaLink, FaServer, FaRocket
} from "react-icons/fa6";
import Link from "next/link";
import * as FaIcons from "react-icons/fa6";
import { motion } from 'framer-motion';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps } from 'html-react-parser';


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
  ru: { // --- RUSSIAN TRANSLATIONS (KEEP Vibe 2.0 Philosophy) ---
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    welcome: "Йоу,",
    intro1: "Код пугает? Забудь! Это <strong>СЕЙЧАС</strong>. Твой личный <strong>dev-ускоритель</strong>. Мгновенный Level UP!",
    intro2: "Думай: Волшебная Песочница. Есть идеи? Говори. AI строит, система чекает, PR улетает. <strong>Бум.</strong> Ты рулишь процессом.",
    intro3: "Хватит потреблять, стань <strong>ТВОРЦОМ</strong>. Строй СВОЮ реальность, решай СВОИ проблемы, <strong>валидируй идеи МГНОВЕННО</strong>. Вот это вайб.",
    cyberVibeTitle: "Петля Вайба: Твой Движок Прокачки <FaUpLong/>", // FIXED ICON
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
    navCyberVibe: "Петля Вайба <FaUpLong/>", // FIXED ICON
  }
};
// --- End I18N ---

type Language = 'en' | 'ru';
type TranslationSet = typeof translations['en'];




// --- ВСТАВЛЯЕМ ОПРЕДЕЛЕНИЕ ToastInjector ЗДЕСЬ ---
const ToastInjector: React.FC<{ id: string; context: RepoXmlPageContextType | null }> = ({ id, context }) => {
    if (!context || !context.addToast) { // Добавили проверку на addToast
        // Не можем показать тост, если контекст или функция недоступны
        if (!context) logger.warn(`ToastInjector ${id}: Context is null`);
        else if (!context.addToast) logger.warn(`ToastInjector ${id}: context.addToast is not available`);
        return null;
    }
    try {
        // Вызываем addToast сразу во время рендера
        context.addToast(`[DEBUG_INJECT] ToastInjector Rendered: ${id}`, 'info', 500);
    } catch (e) {
        // Логируем ошибку, если сам вызов тоста падает
        logger.error(`ToastInjector ${id} failed to toast:`, e);
    }
    return null; // Компонент ничего не рендерит визуально
};
// --- КОНЕЦ ОПРЕДЕЛЕНИЯ ToastInjector ---

// --- Fallback component for AutomationBuddy ---
function LoadingBuddyFallback() {
    return ( <div className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 animate-pulse" aria-hidden="true" ></div> );
}

// --- html-react-parser Configuration (No Toasts) ---
const parserOptions: HTMLReactParserOptions = {
  replace: (domNode) => {
    if (!(domNode instanceof Element && domNode.attribs)) { return undefined; }

    const { name, attribs, children } = domNode;
    const lowerCaseName = name?.toLowerCase();

    // Handle Font Awesome Icons
    if (name && typeof name === 'string' && name.startsWith('Fa') && FaIcons[name as keyof typeof FaIcons]) {
      try {
          const iconCompFn = FaIcons[name as keyof typeof FaIcons];
          const isFunction = typeof iconCompFn === 'function';

          if (!isFunction) {
              logger.error(`[parserOptions] FaIcon <${name}> is not a function!`);
              return <span>{`[Icon Load Error: ${name} is not a Function]`}</span>;
          }
          const IconComponent = iconCompFn;
          const props = attributesToProps(attribs);
          const baseClassName = "inline-block align-middle mx-1";
          const specificClassName = props.className || '';
          props.className = `${baseClassName} ${specificClassName}`.trim();
          return React.createElement(IconComponent, props);
      } catch (iconError) {
          logger.error(`[parserOptions] Error rendering FaIcon <${name}>:`, iconError);
          return <span>{`[Icon Render Error: ${name}]`}</span>;
      }
    }

    // Handle Internal Links
    if (lowerCaseName === 'a') {
      const props = attributesToProps(attribs);
      const isInternal = props.href && (props.href.startsWith('/') || props.href.startsWith('#'));
      const parsedChildren = children ? domToReact(children, parserOptions) : null;
      if (isInternal && !props.target) {
          const { class: _, ...validProps } = props;
          try { return <Link href={props.href} {...validProps} className={props.className}>{parsedChildren}</Link>; }
          catch (linkError) { logger.error("[parserOptions] Error creating Next Link:", linkError, props); return <a {...props}>{parsedChildren}</a>; }
      }
      return <a {...props}>{parsedChildren}</a>;
    }

    // Handle other standard HTML tags
    if (typeof name === 'string' && /^[a-z][a-z0-9-]*$/.test(lowerCaseName || '')) {
      try {
          return React.createElement(lowerCaseName!, attributesToProps(attribs), children ? domToReact(children, parserOptions) : undefined);
      } catch (createElementError) {
          logger.error(`[parserOptions] Error React.createElement for <${lowerCaseName}>:`, createElementError);
          return <>{children ? domToReact(children, parserOptions) : null}</>;
      }
    }

    return undefined;
  },
};

// --- RenderContent Component ---
const RenderContent: React.FC<{ content: string | null | undefined }> = React.memo(({ content }) => {
    if (typeof content !== 'string' || !content.trim()) {
        return null;
    }
    const contentWithStrong = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    try {
      const parsedContent = parse(contentWithStrong, parserOptions);
      return <>{parsedContent}</>;
    } catch (error) {
      logger.error("[RenderContent] Error during parse:", error, "Input:", contentWithStrong);
      return <span dangerouslySetInnerHTML={{ __html: `[Parse Error] ${contentWithStrong.substring(0, 100)}...` }} />;
    }
});
RenderContent.displayName = 'RenderContent';

// --- getPlainText helper ---
const getPlainText = (htmlString: string | null | undefined): string => {
    if (typeof htmlString !== 'string' || !htmlString) { return ''; }
    try {
        const withoutIcons = htmlString.replace(/<Fa[A-Z][a-zA-Z0-9]+(?:\s+[^>]*?)?\s*\/?>/g, '');
        const plainText = withoutIcons.replace(/<[^>]*>/g, '');
        return plainText.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    } catch (e) {
        logger.error("Error stripping HTML for title:", e, "Input:", htmlString);
        return htmlString;
    }
};


// --- Helper to Inject Toast ---
// This component will attempt to call addToast during the render phase.
// If it succeeds before the error, we'll see the toast.
const ToastInjector: React.FC<{ id: string; context: ReturnType<typeof useRepoXmlPageContext> | null }> = ({ id, context }) => {
    if (!context) {
        // Cannot toast if context is not available yet (shouldn't happen if used correctly)
        return null;
    }
    try {
        // Attempt to call addToast immediately during render
        context.addToast(`[DEBUG_INJECT] ToastInjector Rendered: ${id}`, 'info', 500);
    } catch (e) {
        // Log error if toasting itself fails, but don't crash the render
        logger.error(`ToastInjector ${id} failed to toast:`, e);
    }
    return null; // This component doesn't render anything visually
};


// --- ActualPageContent Component ---
function ActualPageContent() {
    logger.log("[CONSOLE_LOG] ActualPageContent START RENDER");

    const { user } = useAppContext();
    logger.log("[CONSOLE_LOG] ActualPageContent -> useAppContext DONE");
    const pageContext = useRepoXmlPageContext(); // Get context ONCE
    logger.log("[CONSOLE_LOG] ActualPageContent -> useRepoXmlPageContext DONE");

    const {
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef,
        setImageReplaceTask, setKworkInputHasContent, fetchStatus,
        imageReplaceTask, allFetchedFiles, selectedFetcherFiles,
        repoUrl, setRepoUrl, addToast // Destructure addToast from context
    } = pageContext; // Use the retrieved context

    const [lang, setLang] = useState<Language>('en');
    const [showComponents, setShowComponents] = useState(false);
    const searchParams = useSearchParams();
    const [initialIdea, setInitialIdea] = useState<string | null>(null);
    const [initialIdeaProcessed, setInitialIdeaProcessed] = useState<boolean>(false);
    const [t, setT] = useState<TranslationSet | null>(null);
    logger.log("[CONSOLE_LOG] ActualPageContent -> useState DONE");

    // --- Effects ---
    useEffect(() => {
      addToast("[DEBUG_EFFECT] ActualPageContent -> useEffect 1 (Lang) START", 'info', 500); // Use addToast
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const resolvedLang = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(resolvedLang);
      setT(translations[resolvedLang] ?? translations.en);
      logger.log(`[ActualPageContent Effect 1] Lang set to: ${resolvedLang}`);
      addToast("[DEBUG_EFFECT] ActualPageContent -> useEffect 1 (Lang) END", 'info', 500); // Use addToast
    }, [user, addToast]); // Add addToast dependency

    useEffect(() => {
      addToast("[DEBUG_EFFECT] ActualPageContent -> useEffect 2 (URL) START", 'info', 500); // Use addToast
      console.log(
        "%c🚀 CyberVibe Studio 2.0 Initialized! 🚀\n%cCo-created with the Vibe Community & AI. Let's build!\n%cEaster Egg added by request. 😉",
        "color: #E1FF01; font-size: 1.2em; font-weight: bold; text-shadow: 0 0 5px #E1FF01;",
        "color: #00FF9D; font-size: 0.9em;",
        "color: #888; font-size: 0.8em;"
      );

      const pathParam = searchParams.get("path");
      const ideaParam = searchParams.get("idea");
      const repoParam = searchParams.get("repo");

      if (repoParam) {
           try {
               const decodedRepoUrl = decodeURIComponent(repoParam);
               if (decodedRepoUrl && typeof decodedRepoUrl === 'string' && decodedRepoUrl.includes("github.com")) {
                   setRepoUrl(decodedRepoUrl);
                   logger.log(`[ActualPageContent Effect 2] Repo URL set from param: ${decodedRepoUrl}`);
               } else { logger.warn(`[ActualPageContent Effect 2] Invalid or empty repo URL from param: ${repoParam}`); }
           } catch (e) { logger.error("[ActualPageContent Effect 2] Error decoding repo URL param:", e); }
       }

        if (pathParam && ideaParam) {
            let decodedIdea: string | null = null; let decodedPath: string | null = null;
            try {
                decodedPath = decodeURIComponent(pathParam); decodedIdea = decodeURIComponent(ideaParam);
                if (decodedIdea && decodedIdea.startsWith("ImageReplace|")) {
                   logger.log("[ActualPageContent Effect 2] Processing Image Replace task from URL.");
                   // ... (image replace logic)
                   setImageReplaceTask(/*...*/); // Assuming task is constructed
                   setInitialIdea(null);
                   setInitialIdeaProcessed(true);
                } else if (decodedIdea) {
                   logger.log("[ActualPageContent Effect 2] Regular idea param found, storing:", decodedIdea.substring(0, 50) + "...");
                    setInitialIdea(decodedIdea);
                    setImageReplaceTask(null);
                    setInitialIdeaProcessed(false);
                } else {
                   logger.warn("[ActualPageContent Effect 2] Decoded idea is empty or invalid.");
                   setImageReplaceTask(null); setInitialIdea(null); setInitialIdeaProcessed(true);
                }
            } catch (decodeError) {
                 logger.error("[ActualPageContent Effect 2] Error decoding path or idea params:", decodeError);
                 setImageReplaceTask(null); setInitialIdea(null); setInitialIdeaProcessed(true);
            }
            if (decodedPath || decodedIdea) {
                addToast("[DEBUG_EFFECT] ActualPageContent -> useEffect 2: Setting showComponents=true due to URL params", 'info', 500);
                setShowComponents(true);
            }
        } else {
            logger.log(`[ActualPageContent Effect 2] No valid path/idea params found.`);
            setImageReplaceTask(null); setInitialIdea(null); setInitialIdeaProcessed(true);
        }
       addToast("[DEBUG_EFFECT] ActualPageContent -> useEffect 2 (URL) END", 'info', 500); // Use addToast
    }, [searchParams, setImageReplaceTask, setRepoUrl, addToast]); // Add addToast dependency

     useEffect(() => {
        addToast("[DEBUG_EFFECT] ActualPageContent -> useEffect 3 (Kwork Populate) START", 'info', 500); // Use addToast
        const fetchAttemptFinished = ['success', 'error', 'failed_retries'].includes(fetchStatus);

        if (fetchAttemptFinished && initialIdea && !initialIdeaProcessed && !imageReplaceTask && kworkInputRef.current) {
           logger.log(`[ActualPageContent Effect 3] Fetch finished (${fetchStatus}). Populating kwork...`);
            kworkInputRef.current.value = initialIdea;
            try { const inputEvent = new Event('input', { bubbles: true }); kworkInputRef.current.dispatchEvent(inputEvent); }
            catch (eventError) { logger.error("[ActualPageContent Effect 3] Error dispatching input event:", eventError); }
            setKworkInputHasContent(initialIdea.trim().length > 0);
            logger.log("[ActualPageContent Effect 3] Populated kwork input.");

            if (fetcherRef.current?.handleAddSelected) {
                if (selectedFetcherFiles.size > 0) {
                     logger.log("[ActualPageContent Effect 3] Calling fetcherRef.handleAddSelected.");
                     // ... (async call)
                } else { logger.log("[ActualPageContent Effect 3] Skipping handleAddSelected (empty selection)."); }
            } else { logger.warn("[ActualPageContent Effect 3] handleAddSelected not found or fetcherRef null."); }

            const kworkElement = document.getElementById('kwork-input-section');
            if (kworkElement) { setTimeout(() => { try { kworkElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); logger.log("[ActualPageContent Effect 3] Scrolled to kwork."); } catch (scrollError) { logger.error("[ActualPageContent Effect 3] Error scrolling to kwork:", scrollError); } }, 250); }
             setInitialIdeaProcessed(true);
        } else if (fetchAttemptFinished && !initialIdeaProcessed) {
             setInitialIdeaProcessed(true);
             logger.log(`[ActualPageContent Effect 3] Fetch finished (${fetchStatus}), no pending idea or kworkInputRef not ready.`);
        }
       addToast("[DEBUG_EFFECT] ActualPageContent -> useEffect 3 (Kwork Populate) END", 'info', 500); // Use addToast
     }, [ fetchStatus, initialIdea, initialIdeaProcessed, imageReplaceTask, kworkInputRef, setKworkInputHasContent, fetcherRef, allFetchedFiles, selectedFetcherFiles, addToast ]); // Add addToast dependency


    // --- Callbacks ---
    const memoizedGetPlainText = useCallback(getPlainText, []);

    const scrollToSectionNav = useCallback((id: string) => {
        addToast(`[DEBUG_CB] scrollToSectionNav for ${id}`, 'info', 500); // Use addToast
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps'];
        const targetElement = document.getElementById(id);

        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            logger.log(`[Scroll] Revealing components for "${id}"`);
            setShowComponents(true);
            requestAnimationFrame(() => { // Wait for next frame after re-render
                const revealedElement = document.getElementById(id);
                if (revealedElement) {
                     try {
                         const offsetTop = window.scrollY + revealedElement.getBoundingClientRect().top - 80;
                         window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                         logger.log(`[Scroll] Scrolled to revealed "${id}"`);
                     } catch (scrollError) { logger.error(`[Scroll] Error scrolling to revealed "${id}":`, scrollError); }
                } else { logger.error(`[Scroll] Target "${id}" not found after reveal attempt.`); }
            });
        } else if (targetElement) {
             try {
                 const offsetTop = window.scrollY + targetElement.getBoundingClientRect().top - 80;
                 window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                 logger.log(`[Scroll] Scrolled to "${id}"`);
             } catch (scrollError) { logger.error(`[Scroll] Error scrolling to "${id}":`, scrollError); }
        } else { logger.error(`[Scroll] Target element with id "${id}" not found.`); }
    }, [showComponents, addToast]); // Add addToast dependency

    const handleShowComponents = () => {
        addToast("[DEBUG_CB] handleShowComponents START", 'info', 500); // Use addToast
        logger.log("[DEBUG] Reveal Button Clicked. Before setShowComponents.");
        setShowComponents(true);
        logger.log("[DEBUG] showComponents set to true by button click.");
        addToast("[DEBUG_CB] handleShowComponents END - setShowComponents(true) called", 'info', 500); // Use addToast
    };

    // --- Loading / Initial State ---
     if (!t) { // Убрали isMounted из проверки, т.к. он больше не нужен
         logger.log("[CONSOLE_LOG] ActualPageContent Render: Early return (!t)"); // <--- LOG
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang]?.loading ?? translations.en.loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }

    // --- Derived State & Safe Render ---
    logger.log("[CONSOLE_LOG] ActualPageContent -> Calculating derived state"); // <--- LOG
    const userName = user?.first_name || (lang === 'ru' ? 'Нео' : 'Neo');
    const navTitleIntro = memoizedGetPlainText(t.navIntro);
    const navTitleVibeLoop = memoizedGetPlainText(t.navCyberVibe);
    const navTitleGrabber = memoizedGetPlainText(t.navGrabber);
    const navTitleAssistant = memoizedGetPlainText(t.navAssistant);

    const renderSafeContent = (contentKey: keyof TranslationSet) => {
        const content = t?.[contentKey];
        return content ? <RenderContent content={content} /> : `[${contentKey}]`;
    };

    logger.log("[CONSOLE_LOG] ActualPageContent -> BEFORE RETURN JSX"); // <--- LOG
    addToast("[DEBUG_RENDER] ActualPageContent: Before Return JSX", 'info', 500); // <--- РАННИЙ ТОСТ РЕНДЕРА

    return (
        <>
            {/* Inject toasts at critical render points */}
            <ToastInjector id="ActualPageContent-Top" context={pageContext} />

            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <div className="min-h-screen bg-gray-950 p-4 sm:p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">
                 <ToastInjector id="ActualPageContent-InsideMainDiv" context={pageContext} />

                {/* Intro Section */}
                <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                     {/* ... intro content ... */}
                     <ToastInjector id="ActualPageContent-AfterIntro" context={pageContext} />
                </section>

                {/* === The Vibe Loop Section === */}
                <section id="cybervibe-section" className="mb-12 w-full max-w-3xl">
                     {/* ... vibe loop content ... */}
                      <ToastInjector id="ActualPageContent-AfterVibeLoop" context={pageContext} />
                 </section>

                {/* Your Vibe Path Section - NEW PHILOSOPHY */}
                <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                   {/* ... philosophy content ... */}
                    <ToastInjector id="ActualPageContent-AfterPhilosophy" context={pageContext} />
                </section>

                 <ToastInjector id="ActualPageContent-BeforeRevealButtonCheck" context={pageContext} />
                {/* Reveal Button */}
                {!showComponents && (
                    <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                       <ToastInjector id="ActualPageContent-RenderingRevealButton" context={pageContext} />
                        <Button
                            onClick={handleShowComponents}
                            className="bg-gradient-to-r from-green-500 via-cyan-500 to-purple-600 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce hover:animate-none ring-2 ring-offset-2 ring-offset-gray-950 ring-transparent hover:ring-cyan-300"
                            size="lg"
                        >
                            <FaHandSparkles className="mr-2"/> {renderSafeContent('readyButton')}
                        </Button>
                    </section>
                )}

                 <ToastInjector id="ActualPageContent-BeforeShowComponentsCheck" context={pageContext} />
                {/* WORKHORSE Components */}
                {showComponents && (
                     <>
                        <ToastInjector id="ActualPageContent-InsideShowComponentsStart" context={pageContext} />
                        <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse">{renderSafeContent('componentsTitle')}</h2>
                         <section id="extractor" className="mb-12 w-full max-w-4xl">
                           <ToastInjector id="ActualPageContent-BeforeRepoFetcherRender" context={pageContext} />
                             <Card className="bg-gray-900/80 border border-blue-700/50 shadow-lg backdrop-blur-sm">
                                 <CardContent className="p-4">
                                     <RepoTxtFetcher ref={fetcherRef} />
                                 </CardContent>
                             </Card>
                            <ToastInjector id="ActualPageContent-AfterRepoFetcherRender" context={pageContext} />
                         </section>
                         <section id="executor" className="mb-12 w-full max-w-4xl pb-16">
                           <ToastInjector id="ActualPageContent-BeforeAIAssistantRender" context={pageContext} />
                             <Card className="bg-gray-900/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                 <CardContent className="p-4">
                                     <AICodeAssistant
                                         ref={assistantRef}
                                         kworkInputRefPassed={kworkInputRef}
                                         aiResponseInputRefPassed={aiResponseInputRef}
                                     />
                                 </CardContent>
                             </Card>
                            <ToastInjector id="ActualPageContent-AfterAIAssistantRender" context={pageContext} />
                         </section>
                         <ToastInjector id="ActualPageContent-InsideShowComponentsEnd" context={pageContext} />
                     </>
                 )}

                {/* Final CTA */}
                 {showComponents && (
                     <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                         {/* ... cta content ... */}
                     </section>
                 )}

                {/* Navigation Icons */}
                 <motion.nav
                    className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40"
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2.0, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}
                 >
                    {/* ... nav buttons ... */}
                 </motion.nav>

                {/* Automation Buddy */}
                <Suspense fallback={<LoadingBuddyFallback />}> <AutomationBuddy /> </Suspense>
                <ToastInjector id="ActualPageContent-End" context={pageContext} />
            </div>
        </>
    );
}

// --- Layout Component ---
function RepoXmlPageLayout() {
    // Добавим лог сюда тоже, чтобы видеть инициализацию Provider
    logger.log("[CONSOLE_LOG] RepoXmlPageLayout rendering RepoXmlPageProvider");
    return ( <RepoXmlPageProvider> <ActualPageContent /> </RepoXmlPageProvider> );
}

// --- Exported Page Component ---
export default function RepoXmlPage() {
     logger.log("[CONSOLE_LOG] RepoXmlPage START RENDER");
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
    const fallbackLoadingText = translations[fallbackLoadingLang]?.loading ?? translations.en.loading; // Fallback to English
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-950"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p> </div> );
    return ( <Suspense fallback={fallbackLoading}> <RepoXmlPageLayout /> </Suspense> );
}