"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaRobot, FaStar, FaArrowRight, FaCodeBranch, FaClipboardCheck,
    FaWandMagicSparkles, FaListCheck, FaPaperPlane, FaHighlighter,
    FaDownload, FaPlus, FaPoo, FaSpinner, FaCode, // Added FaCode
    FaFileCode, FaGithub, FaExchangeAlt // Added more icons
} from "react-icons/fa6"; // Using Fa6 for consistent icons
import Image from "next/image";
import clsx from "clsx";
// Import context hook AND RepoXmlPageContextType for type checking (Restored based on context ~line 12)
import { useRepoXmlPageContext, RepoXmlPageContextType, WorkflowStep } from '@/contexts/RepoXmlPageContext'; // Adjust path if needed

// --- Constants & Types --- (Restored based on context)
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Нанять меня за звезды";
const FIX_PAGE_ID = "fix-current-page";

interface Suggestion {
  id: string;
  text: string;
  link?: string;
  action?: () => void | Promise<void>;
  icon?: React.ReactNode;
  isHireMe?: boolean;
  isFixAction?: boolean;
  disabled?: boolean;
}

// --- Animation Variants --- (Restored based on context)
const containerVariants = {
  hidden: { opacity: 0, x: -300 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, },
  exit: { opacity: 0, x: -300, transition: { duration: 0.3 } },
};

const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const fabVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1, rotate: [0, 10, -10, 5, -5, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 } } },
    exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } }
};

// --- Component ---
const StickyChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fixActionClicked, setFixActionClicked] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [activeMessage, setActiveMessage] = useState<string>("Привет! Чем могу помочь?");

  const currentPath = usePathname();
  const router = useRouter();

  // --- Contextual Logic --- (Restored based on context ~line 78)
  const isOnRepoXmlPage = currentPath === '/repo-xml';
  const repoContext = useRepoXmlPageContext();

  // --- Base Suggestions (Restored based on context) ---
  const getBaseSuggestions = useMemo((): Suggestion[] => {
    const folderPath = currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`;
    return [
      ...(!fixActionClicked && !isOnRepoXmlPage
        ? [{ id: FIX_PAGE_ID, text: "Исправить эту страницу", link: `/repo-xml?path=${folderPath}`, isFixAction: true, icon: <FaHighlighter className="mr-1.5" /> }]
        : []),
      { id: "add-new", text: "Создать что-то новое", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" /> },
      { id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> },
    ];
  }, [currentPath, fixActionClicked, isOnRepoXmlPage]);

  // --- Contextual Suggestions (Restored based on context ~line 97) ---
  const getRepoContextSuggestions = useCallback((): Suggestion[] => {
    if (!repoContext) return [];

    const suggestions: Suggestion[] = [];
    const step = repoContext.currentStep;
    const isLoading = repoContext.fetcherLoading || repoContext.assistantLoading;

    // Helper function (Restored based on context ~line 105)
    const createSuggestion = (
        id: string,
        text: string,
        action: (() => void | Promise<void>) | null,
        icon: JSX.Element,
        forceDisabled: boolean = false
        ): Suggestion => ({
            id, text, action: action ?? undefined, icon, disabled: isLoading || forceDisabled
    });

    // Generate suggestions based on step (Restored switch logic based on context ~line 114)
    switch (step) {
      case 'idle':
        suggestions.push(createSuggestion('focus-url', 'Указать URL репозитория', () => repoContext.scrollToSection('fetcher'), <FaArrowRight />));
        break;
      case 'need_fetch':
        suggestions.push(createSuggestion('trigger-fetch', 'Извлечь файлы', repoContext.triggerFetch, <FaDownload />, !repoContext.repoUrlEntered));
        break;
      case 'fetching':
        suggestions.push(createSuggestion('loading-fetch', 'Идет извлечение...', null, <FaSpinner className="animate-spin" />, true));
        break;
       case 'fetch_failed':
        suggestions.push(createSuggestion('retry-fetch', 'Повторить извлечение', repoContext.triggerFetch, <FaDownload />));
        break;
      case 'files_fetched':
        if (repoContext.primaryHighlightedPath) {
          suggestions.push(createSuggestion('select-highlighted', 'Выбрать подсвеченные', repoContext.triggerSelectHighlighted, <FaHighlighter />));
        }
        suggestions.push(createSuggestion('scroll-kwork', 'Перейти к Запросу ✍️', () => repoContext.scrollToSection('kworkInput'), <FaArrowRight />));
        break;
      case 'files_selected':
        suggestions.push(createSuggestion('add-selected', 'Добавить файлы в Запрос', repoContext.triggerAddSelectedToKwork, <FaPlus />, repoContext.selectedFetcherFiles.size === 0));
        break;
      case 'request_ready':
        suggestions.push(createSuggestion('copy-kwork', 'Скопировать Запрос 📋', repoContext.triggerCopyKwork, <FaClipboardCheck />, !repoContext.kworkInputHasContent));
        break;
      case 'request_copied':
        suggestions.push(createSuggestion('scroll-ai', 'Перейти к Ответу AI 👇', () => repoContext.scrollToSection('aiResponseInput'), <FaArrowRight />));
        break;
      case 'response_pasted':
        suggestions.push(createSuggestion('parse-response', 'Разобрать Ответ AI ➡️', repoContext.triggerParseResponse, <FaWandMagicSparkles />, !repoContext.aiResponseHasContent));
        break;
      case 'parsing':
        suggestions.push(createSuggestion('loading-parse', 'Разбираю ответ...', null, <FaSpinner className="animate-spin" />, true));
        break;
      case 'parse_failed':
          suggestions.push(createSuggestion('check-response', 'Проверить формат ответа AI', () => repoContext.scrollToSection('aiResponseInput'), <FaPoo />));
          break;
      case 'response_parsed':
         suggestions.push(createSuggestion('select-all-parsed', 'Выбрать все для PR ✅', repoContext.triggerSelectAllParsed, <FaListCheck />, !repoContext.filesParsed));
         suggestions.push(createSuggestion('scroll-pr', 'Перейти к PR 🚀', () => repoContext.scrollToSection('prSection'), <FaArrowRight />));
         break;
      case 'parsed_files_selected':
        suggestions.push(createSuggestion('create-pr', 'Создать Pull Request', repoContext.triggerCreatePR, <FaCodeBranch />, repoContext.selectedAssistantFiles.size === 0));
        break;
       case 'creating_pr':
         suggestions.push(createSuggestion('loading-pr', 'Создаю PR...', null, <FaSpinner className="animate-spin" />, true));
         break;
       case 'pr_created':
         suggestions.push(createSuggestion('start-again', 'Начать новый цикл? ✨', () => window.location.reload(), <FaWandMagicSparkles />));
         break;
      default:
        suggestions.push(createSuggestion('scroll-fetcher', 'К началу (Извлечение)', () => repoContext.scrollToSection('fetcher'), <FaArrowRight />));
        suggestions.push(createSuggestion('scroll-assistant', 'К концу (PR)', () => repoContext.scrollToSection('assistant'), <FaArrowRight />));
    }

     // Always add the "Hire me" suggestion (Restored based on context ~line 174)
     const hireMe = getBaseSuggestions.find(s => s.isHireMe);
     if (hireMe) suggestions.push({...hireMe, disabled: isLoading });

    return suggestions;

  }, [repoContext, getBaseSuggestions]);

  // --- Determine Final Suggestions List --- (Restored based on context)
  const suggestions = useMemo(() => {
      return isOnRepoXmlPage && repoContext ? getRepoContextSuggestions() : getBaseSuggestions;
  }, [isOnRepoXmlPage, repoContext, getBaseSuggestions, getRepoContextSuggestions]);

  // --- Update Active Message in Speech Bubble --- (Using Enhanced Logic from previous response)
  useEffect(() => {
      let message = "Привет! Вижу, ты здесь. Что будем делать?"; // Default fallback

      if (isOnRepoXmlPage && repoContext) {
          const step = repoContext.currentStep;
          switch (step) { // Using the more detailed messages
                case 'idle': message = "Укажи репозиторий GitHub, чтобы начать магию!"; break;
                case 'need_fetch': message = "Репозиторий указан! Готов извлечь код?"; break;
                case 'fetching': message = "Подключаюсь к GitHub... Извлекаю код! 👾"; break;
                case 'fetch_failed': message = "Упс! Не удалось извлечь. Проверь URL/токен и попробуй снова?"; break;
                case 'files_fetched': message = repoContext.primaryHighlightedPath
                        ? `Вижу, ты хочешь изменить ${repoContext.primaryHighlightedPath.split('/').pop()}! 😉 Выбери подсвеченные файлы или сразу опиши задачу.`
                        : "Код извлечен! Выбери нужные файлы для контекста и опиши задачу в 'Запросе'.";
                    break;
                case 'files_selected': message = `Выбрано ${repoContext.selectedFetcherFiles.size} файлов. Отлично! Добавь их в 'Запрос' или опиши задачу.`; break;
                case 'request_ready': message = "Запрос готов! Скопируй его (📋) и отправь своему AI (Grok?). Потом вставь ответ ниже."; break;
                case 'request_copied': message = "Запрос скопирован! Жду ответ от твоего AI в поле ниже... 👇"; break;
                case 'response_pasted': message = "Ответ AI вставлен! Нажми '➡️', чтобы я его разобрал и проверил."; break;
                case 'parsing': message = "Анализирую ответ AI... Ищу код и проверяю его... 🧐"; break;
                case 'parse_failed': message = "Хм, не смог разобрать ответ AI. Проверь формат: нужны блоки кода с ```язык..."; break;
                case 'response_parsed': message = `Разобрал ответ! ${repoContext.parsedFiles.length} файлов найдено. Проверь ошибки, выбери нужные и переходи к созданию PR.`; break;
                case 'parsed_files_selected': message = `Выбрано ${repoContext.selectedAssistantFiles.size} файлов для PR. Заполни детали и нажимай 'Создать PR'! 🚀`; break;
                case 'creating_pr': message = "Создаю Pull Request на GitHub... Держу кулачки! 🤞"; break;
                case 'pr_created': message = "Pull Request создан! Отличная работа! ✨ Хочешь начать заново?"; break;
                default: message = "Так... на чем мы остановились? 🤔 Выбери следующее действие.";
          }
      } else if (!isOnRepoXmlPage) {
          message = `Привет! Хочешь что-то улучшить на этой странице (${currentPath})? 😉`;
      }

      setActiveMessage(message);
  }, [isOnRepoXmlPage, repoContext, currentPath, isOpen]); // Dependencies restored

  // --- Auto-open Timer --- (Restored based on context)
  useEffect(() => {
    if (!hasAutoOpened && !isOpen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoOpened(true);
      }, AUTO_OPEN_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [hasAutoOpened, isOpen]);

  // --- Handle Escape Key to Close Dialog --- (Restored based on context)
   const handleEscKey = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
        }
    }, []);
   useEffect(() => {
        if (isOpen) { document.addEventListener('keydown', handleEscKey); }
        else { document.removeEventListener('keydown', handleEscKey); }
        return () => { document.removeEventListener('keydown', handleEscKey); };
    }, [isOpen, handleEscKey]);

  // --- Event Handlers --- (Restored based on context)
  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.disabled) return;
    if (suggestion.link) {
        if (suggestion.isFixAction) { setFixActionClicked(true); }
         router.push(suggestion.link);
    } else if (suggestion.action) {
        suggestion.action();
    }
    setIsOpen(false);
  };
  const handleOverlayClick = () => setIsOpen(false);
  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
  const handleFabClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setHasAutoOpened(true);
  };


  // --- Render Logic --- (Restored based on context, integrated dynamic message)
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="dialog-overlay"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-40 backdrop-blur-sm"
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-modal="true" role="dialog" aria-labelledby="chat-suggestions-title"
        >
          <motion.div
            variants={containerVariants} initial="hidden" animate="visible" exit="exit"
            className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-start bg-transparent"
            onClick={handleDialogClick}
          >
            <h2 id="chat-suggestions-title" className="sr-only">Chat Suggestions</h2>
            <motion.div
                key={activeMessage} // Animate message change
                variants={childVariants}
                className="relative mb-3 w-full bg-white bg-opacity-95 p-3 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.6)]"
            >
                <p className="text-[13px] sm:text-sm text-gray-800 font-semibold text-center sm:text-left">{activeMessage}</p>
                <div className="absolute -bottom-2 left-1/2 sm:left-16 transform -translate-x-1/2 sm:translate-x-0 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white border-opacity-95" />
            </motion.div>
            <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                 <motion.div
                    variants={childVariants}
                    className="flex-shrink-0 self-center sm:self-end"
                    style={{ perspective: '500px' }}
                 >
                    <motion.div whileHover={{ scale: 1.05, rotateY: 10 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
                        <Image src={CHARACTER_IMAGE_URL} alt={CHARACTER_ALT_TEXT} width={120} height={120} priority className="rounded-full drop-shadow-[0_0_12px_rgba(0,255,157,0.6)]" />
                    </motion.div>
                </motion.div>
                <motion.div variants={childVariants} className="space-y-2 w-full flex-grow">
                    <AnimatePresence initial={false}>
                        {suggestions.map((suggestion) => (
                            <motion.button
                                key={suggestion.id} variants={childVariants} initial="hidden" animate="visible" exit="exit" layout
                                onClick={() => handleSuggestionClick(suggestion)}
                                disabled={suggestion.disabled}
                                className={clsx(
                                    "flex items-center w-full text-left px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ease-in-out",
                                    "shadow-[0_0_8px_rgba(0,255,157,0.3)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75",
                                    { "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400": suggestion.isHireMe && !suggestion.disabled,
                                      "bg-gray-700 bg-opacity-80 text-cyan-400 hover:bg-opacity-90 hover:text-cyan-300": !suggestion.isHireMe && !suggestion.disabled,
                                      "bg-gray-600 bg-opacity-50 text-gray-400 cursor-not-allowed": suggestion.disabled,
                                      "hover:shadow-[0_0_14px_rgba(0,255,157,0.6)]": !suggestion.disabled,
                                    }
                                )}
                            >
                             {suggestion.icon || <FaPaperPlane className="mr-1.5" />}
                             <span className="flex-grow">{suggestion.text}</span>
                            </motion.button>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.button
          key="fab"
          aria-label="Открыть меню помощи Xuinity"
          onClick={handleFabClick}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-16 bg-cyan-600 hover:bg-cyan-500 text-white p-3.5 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.7)] hover:shadow-[0_0_20px_rgba(0,255,157,0.9)] transition-all duration-200 ease-in-out z-40 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
          variants={fabVariants} initial="hidden" animate="visible" exit="exit"
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
        >
          <FaRobot className="text-2xl" aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default StickyChatButton;