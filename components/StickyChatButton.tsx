"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
// Restore specific icons from context (~7)
import {
    FaRobot, FaStar, FaArrowRight, FaCodeBranch, FaClipboardCheck,
    FaWandMagicSparkles, FaListCheck, FaPaperPlane, FaHighlighter,
    FaDownload, FaPlus, FaPoo, FaSpinner, FaGithub // FaCode removed as not in context, FaGithub kept for profile link
} from "react-icons/fa6";
import Image from "next/image";
import clsx from "clsx";
import { useRepoXmlPageContext, RepoXmlPageContextType, WorkflowStep } from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";

// --- Constants & Types --- (Restore from context ~17)
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Нанять меня за звезды";
const FIX_PAGE_ID = "fix-current-page";

// Suggestion Interface restored from context
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
// GitHub Profile interface kept from previous improvement
interface GitHubProfile {
    login: string;
    avatar_url: string;
    html_url: string;
    name?: string | null;
}


// --- Animation Variants --- (Restore from context ~27)
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
  // Restore state variables from context (~67, ~70, ~73)
  const [isOpen, setIsOpen] = useState(false);
  const [fixActionClicked, setFixActionClicked] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [activeMessage, setActiveMessage] = useState<string>("Привет! Чем могу помочь?");
  // Keep GitHub profile state
  const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
  const [githubLoading, setGithubLoading] = useState<boolean>(false);

  const currentPath = usePathname();
  const router = useRouter();
  const isOnRepoXmlPage = currentPath === '/repo-xml';
  const repoContext = useRepoXmlPageContext();
  const { user: appContextUser } = useAppContext();

  // --- Fetch GitHub Profile --- (Keep improved logic)
  useEffect(() => {
    if (isOpen && appContextUser?.username && !githubProfile && !githubLoading) {
        const fetchProfile = async () => {
            setGithubLoading(true);
            const result = await getGitHubUserProfile(appContextUser.username!);
            if (result.success && result.profile) { setGithubProfile(result.profile); }
            else { console.warn("GitHub profile fetch failed:", result.error); }
            setGithubLoading(false);
        };
        fetchProfile();
    }
  }, [isOpen, appContextUser, githubProfile, githubLoading]);


  // --- Base Suggestions --- (Restore from context ~109)
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

  // --- Contextual Suggestions --- (Restore structure from context ~139, ~142, ~146, ~155, keep improved logic)
  const getRepoContextSuggestions = useCallback((): Suggestion[] => {
    if (!repoContext) return [];
    const suggestions: Suggestion[] = [];
    const step = repoContext.currentStep;
    const isLoading = repoContext.fetcherLoading || repoContext.assistantLoading;

    // Restore helper function definition from context
    const createSuggestion = (
        id: string,
        text: string,
        action: (() => void | Promise<void>) | null,
        icon: JSX.Element,
        forceDisabled: boolean = false
        ): Suggestion => ({
            id, text, action: action ?? undefined, icon, disabled: isLoading || forceDisabled
    });

    // Restore switch logic structure from context
    switch (step) {
      case 'idle': suggestions.push(createSuggestion('focus-url', 'Указать URL репозитория', () => repoContext.scrollToSection('fetcher'), <FaArrowRight />)); break;
      case 'need_fetch': suggestions.push(createSuggestion('trigger-fetch', 'Извлечь файлы', repoContext.triggerFetch, <FaDownload />, !repoContext.repoUrlEntered)); break;
      case 'fetching': suggestions.push(createSuggestion('loading-fetch', 'Идет извлечение...', null, <FaSpinner className="animate-spin" />, true)); break;
      case 'fetch_failed': suggestions.push(createSuggestion('retry-fetch', 'Повторить извлечение', repoContext.triggerFetch, <FaDownload />)); break;
      case 'files_fetched':
        if (repoContext.primaryHighlightedPath) { suggestions.push(createSuggestion('select-highlighted', 'Выбрать подсвеченные', repoContext.triggerSelectHighlighted, <FaHighlighter />)); }
        suggestions.push(createSuggestion('scroll-kwork', 'Перейти к Запросу ✍️', () => repoContext.scrollToSection('kworkInput'), <FaArrowRight />)); break;
      case 'files_selected': suggestions.push(createSuggestion('add-selected', 'Добавить файлы в Запрос', repoContext.triggerAddSelectedToKwork, <FaPlus />, repoContext.selectedFetcherFiles.size === 0)); break;
      case 'request_ready': suggestions.push(createSuggestion('copy-kwork', 'Скопировать Запрос 📋', repoContext.triggerCopyKwork, <FaClipboardCheck />, !repoContext.kworkInputHasContent)); break;
      case 'request_copied': suggestions.push(createSuggestion('scroll-ai', 'Перейти к Ответу AI 👇', () => repoContext.scrollToSection('aiResponseInput'), <FaArrowRight />)); break;
      case 'response_pasted': suggestions.push(createSuggestion('parse-response', 'Разобрать Ответ AI ➡️', repoContext.triggerParseResponse, <FaWandMagicSparkles />, !repoContext.aiResponseHasContent)); break;
      case 'parsing': suggestions.push(createSuggestion('loading-parse', 'Разбираю ответ...', null, <FaSpinner className="animate-spin" />, true)); break;
      case 'parse_failed': suggestions.push(createSuggestion('check-response', 'Проверить формат ответа AI', () => repoContext.scrollToSection('aiResponseInput'), <FaPoo />)); break;
      case 'response_parsed':
         suggestions.push(createSuggestion('select-all-parsed', 'Выбрать все для PR ✅', repoContext.triggerSelectAllParsed, <FaListCheck />, !repoContext.filesParsed));
         suggestions.push(createSuggestion('scroll-pr', 'Перейти к PR 🚀', () => repoContext.scrollToSection('prSection'), <FaArrowRight />)); break;
      case 'parsed_files_selected': suggestions.push(createSuggestion('create-pr', 'Создать Pull Request', repoContext.triggerCreatePR, <FaCodeBranch />, repoContext.selectedAssistantFiles.size === 0)); break;
      case 'creating_pr': suggestions.push(createSuggestion('loading-pr', 'Создаю PR...', null, <FaSpinner className="animate-spin" />, true)); break;
      case 'pr_created': suggestions.push(createSuggestion('start-again', 'Начать новый цикл? ✨', () => window.location.reload(), <FaWandMagicSparkles />)); break;
      default:
        suggestions.push(createSuggestion('scroll-fetcher', 'К началу (Извлечение)', () => repoContext.scrollToSection('fetcher'), <FaArrowRight />));
        suggestions.push(createSuggestion('scroll-assistant', 'К концу (PR)', () => repoContext.scrollToSection('assistant'), <FaArrowRight />));
    }

     // Restore logic for adding "Hire me" from context
     const hireMe = getBaseSuggestions.find(s => s.isHireMe);
     if (hireMe) suggestions.push({...hireMe, disabled: isLoading });

    return suggestions;
  }, [repoContext, getBaseSuggestions]);

  // --- Determine Final Suggestions List --- (Restore from context ~159)
  const suggestions = useMemo(() => {
      return isOnRepoXmlPage && repoContext ? getRepoContextSuggestions() : getBaseSuggestions;
  }, [isOnRepoXmlPage, repoContext, getBaseSuggestions, getRepoContextSuggestions]);

  // --- Update Active Message in Speech Bubble --- (Restore structure ~166, keep enhanced logic)
  useEffect(() => {
      let baseGreeting = "Привет";
      let userIdentifier = "";
      if (githubProfile?.name) { userIdentifier = githubProfile.name; }
      else if (appContextUser?.first_name) { userIdentifier = appContextUser.first_name; }
      else if (appContextUser?.username) { userIdentifier = appContextUser.username; }
      if (userIdentifier) { baseGreeting += `, ${userIdentifier}`; }
      baseGreeting += "!";

      let message = `${baseGreeting} Что будем делать?`; // Fallback

      if (isOnRepoXmlPage && repoContext) {
          const step = repoContext.currentStep;
          // Get the message from context based on the step
          // This uses the *context's* message generation logic which was requested to be more detailed
          message = repoContext.getXuinityMessage();
           // Prepend the greeting if the message doesn't already seem personalized
           if (!message.toLowerCase().startsWith('привет') && !message.toLowerCase().includes(userIdentifier.toLowerCase())) {
               message = `${baseGreeting} ${message.charAt(0).toLowerCase() + message.slice(1)}`;
           }

      } else if (!isOnRepoXmlPage) {
          message = `${baseGreeting} Хочешь что-то улучшить на этой странице (${currentPath})? 😉`;
      }

      // Append GitHub info if available and loading finished
      // if (!githubLoading && githubProfile) {
      //    message += ` (GitHub: ${githubProfile.login})`; // Keep it subtle
      // }

      setActiveMessage(message);
  // Dependencies restored from context, added GitHub related state
  }, [isOnRepoXmlPage, repoContext, currentPath, isOpen, appContextUser, githubProfile, githubLoading]);


  // --- Auto-open Timer --- (Keep improved version)
  useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

  // --- Handle Escape Key to Close Dialog --- (Keep improved version)
   const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); } }, []);
   useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);

  // --- Event Handlers --- (Keep improved version)
  const handleSuggestionClick = (suggestion: Suggestion) => { if (suggestion.disabled) return; if (suggestion.link) { if (suggestion.isFixAction) { setFixActionClicked(true); } router.push(suggestion.link); } else if (suggestion.action) { suggestion.action(); } setIsOpen(false); };
  const handleOverlayClick = () => setIsOpen(false);
  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
  const handleFabClick = () => { setIsOpen(!isOpen); if (!isOpen) setHasAutoOpened(true); };


  // --- Render Logic --- (Restore structure from context ~208, integrate dynamic message/avatar)
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
            {/* Speech Bubble restored structure, uses activeMessage */}
            <motion.div
                key={activeMessage}
                variants={childVariants}
                className="relative mb-3 w-full bg-white bg-opacity-95 p-3 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.6)]"
            >
                <p className="text-[13px] sm:text-sm text-gray-800 font-semibold text-center sm:text-left">{activeMessage}</p>
                <div className="absolute -bottom-2 left-1/2 sm:left-16 transform -translate-x-1/2 sm:translate-x-0 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white border-opacity-95" />
            </motion.div>
            {/* Character/Actions container restored */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                 {/* Character Image container restored, uses dynamic avatar */}
                 <motion.div
                    variants={childVariants}
                    className="flex-shrink-0 self-center sm:self-end"
                    style={{ perspective: '500px' }}
                 >
                    <motion.div whileHover={{ scale: 1.05, rotateY: 10 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
                        <Image
                            src={githubProfile?.avatar_url || CHARACTER_IMAGE_URL} // Keep dynamic avatar
                            alt={githubProfile?.login || CHARACTER_ALT_TEXT} // Keep dynamic alt
                            width={120} height={120} priority
                            className="rounded-full drop-shadow-[0_0_12px_rgba(0,255,157,0.6)] border-2 border-cyan-400/50" // Keep border
                            unoptimized={!!githubProfile?.avatar_url} // Keep unoptimized flag
                        />
                    </motion.div>
                     {/* Keep GitHub profile link */}
                     {githubProfile && (
                         <a href={githubProfile.html_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center justify-center text-xs text-cyan-400 hover:text-cyan-300 transition opacity-80 hover:opacity-100" title={`GitHub: ${githubProfile.login}`}>
                             <FaGithub className="mr-1"/> {githubProfile.login}
                         </a>
                     )}
                </motion.div>
                 {/* Suggestions list container restored */}
                <motion.div variants={childVariants} className="space-y-2 w-full flex-grow">
                    <AnimatePresence initial={false}>
                        {suggestions.map((suggestion) => (
                            <motion.button
                                key={suggestion.id} variants={childVariants} initial="hidden" animate="visible" exit="exit" layout
                                onClick={() => handleSuggestionClick(suggestion)}
                                disabled={suggestion.disabled}
                                // Classes restored from context
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
         // FAB restored from context
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