"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaRobot, FaStar, FaArrowRight, FaCodeBranch, FaClipboardCheck, FaWandMagicSparkles, FaListCheck, FaPaperPlane, FaHighlighter } from "react-icons/fa6"; // Using Fa6 for newer icons
import Image from "next/image";
import clsx from "clsx";
import { useRepoXmlPageContext, RepoXmlPageProvider } from '@/contexts/RepoXmlPageContext'; // Import context hook AND PROVIDER

// --- Constants & Types (Keep previous ones) ---
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Нанять меня за звезды";
const FIX_PAGE_ID = "fix-current-page";

interface Suggestion {
  id: string;
  text: string;
  link?: string; // Link is optional now, actions might not navigate
  action?: () => void; // Action callback
  icon?: React.ReactNode; // Optional icon
  isHireMe?: boolean;
  isFixAction?: boolean;
}

// --- Animation Variants // --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0, x: -300 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 15,
      when: "beforeChildren",
      staggerChildren: 0.1, // Slightly faster stagger
    },
  },
  exit: { opacity: 0, x: -300, transition: { duration: 0.3 } },
};
const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }, // Add exit variant for children
};
const fabVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        rotate: [0, 10, -10, 5, -5, 0], // More subtle rotation
        transition: {
            scale: { duration: 0.4, ease: "easeOut" },
            opacity: { duration: 0.4, ease: "easeOut" },
            rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 } // Slower, delayed rotation
        }
    },
    exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } }
};
containerVariants.visible.transition.staggerChildren = 0.08; // Faster stagger for actions

// --- Component ---
const StickyChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fixActionClicked, setFixActionClicked] = useState(false); // Keep track if "fix" was the *reason* for navigating
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [activeMessage, setActiveMessage] = useState<string>("Привет! Чем могу помочь?"); // Dynamic message

  const currentPath = usePathname();
  const router = useRouter();

  // --- Contextual Logic for RepoXmlPage ---
  const isOnRepoXmlPage = currentPath === '/repo-xml';
  let repoContext: ReturnType<typeof useRepoXmlPageContext> | null = null;
  try {
      if (isOnRepoXmlPage) {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          repoContext = useRepoXmlPageContext(); // Use context ONLY if on the page
      }
  } catch (e) {
      // Context not available (e.g., page hasn't mounted provider yet, or not on the page)
      // This is expected during initial render or if not on /repo-xml
      // console.warn("RepoXmlPageContext not yet available or not on repo-xml page.");
  }


  // Determine base suggestions (non-repo-xml page or fallback)
  const getBaseSuggestions = useMemo((): Suggestion[] => {
    // Calculate folderPath only when needed
    const folderPath = currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`;
    return [
        // Conditionally include the "fix page" suggestion
        ...(!fixActionClicked
        ? [
            {
                id: FIX_PAGE_ID,
                text: "Исправить эту страницу",
                link: `/repo-xml?path=${folderPath}`,
                isFixAction: true,
                icon: <FaHighlighter className="mr-1.5" />
            },
            ]
        : []),
        { id: "add-new", text: "Создать что-то новое", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" /> },
        { id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> },
    ];
  }, [currentPath, fixActionClicked]);


  // Determine suggestions based on context or base
  const suggestions = useMemo((): Suggestion[] => {
    if (isOnRepoXmlPage && repoContext) {
        const contextSuggestions: Suggestion[] = [];
        const step = repoContext.currentStep;

        // Always add a way back or to general actions
        contextSuggestions.push({ id: 'goto-dev', text: 'Другие опции...', action: () => setIsOpen(false) /* or show base suggestions? */, icon: <FaRobot /> });

        // Add contextual actions based on workflow step
        switch(step) {
            case 'need_fetch':
                 if (!repoContext.repoUrlEntered) {
                    contextSuggestions.push({ id: 'focus-url', text: 'Указать URL репозитория', action: () => repoContext.scrollToSection('fetcher'), icon: <FaArrowRight /> });
                 } else {
                     contextSuggestions.push({ id: 'trigger-fetch', text: 'Извлечь файлы', action: repoContext.triggerFetch, icon: <FaArrowRight /> });
                 }
                 break;
            case 'files_fetched':
                if(repoContext.primaryHighlightedPath) {
                    contextSuggestions.push({ id: 'select-highlighted', text: 'Выбрать подсвеченные', action: repoContext.triggerSelectHighlighted, icon: <FaHighlighter /> });
                }
                contextSuggestions.push({ id: 'scroll-kwork', text: 'Перейти к запросу', action: () => repoContext.scrollToSection('kworkInput'), icon: <FaArrowRight /> });
                 break;
             case 'files_selected':
                contextSuggestions.push({ id: 'add-selected', text: 'Добавить файлы в запрос', action: repoContext.triggerAddSelectedToKwork, icon: <FaArrowRight /> });
                contextSuggestions.push({ id: 'scroll-kwork', text: 'Перейти к запросу', action: () => repoContext.scrollToSection('kworkInput'), icon: <FaArrowRight /> });
                 break;
            case 'request_written':
                contextSuggestions.push({ id: 'copy-kwork', text: 'Скопировать запрос', action: repoContext.triggerCopyKwork, icon: <FaClipboardCheck /> });
                 break;
            case 'request_copied':
                contextSuggestions.push({ id: 'scroll-ai', text: 'Перейти к вводу ответа AI', action: () => repoContext.scrollToSection('aiResponseInput'), icon: <FaArrowRight /> });
                 break;
             case 'response_pasted':
                 contextSuggestions.push({ id: 'parse-response', text: 'Разобрать ответ AI', action: repoContext.triggerParseResponse, icon: <FaWandMagicSparkles /> });
                 break;
             case 'response_parsed':
                 contextSuggestions.push({ id: 'select-all-parsed', text: 'Выбрать все для PR', action: repoContext.triggerSelectAllParsed, icon: <FaListCheck /> });
                 contextSuggestions.push({ id: 'scroll-pr', text: 'Перейти к PR', action: () => repoContext.scrollToSection('prSection'), icon: <FaArrowRight /> });
                 break;
             case 'pr_ready':
                 contextSuggestions.push({ id: 'create-pr', text: 'Создать Pull Request', action: repoContext.triggerCreatePR, icon: <FaCodeBranch /> });
                 break;
            default:
                 contextSuggestions.push({ id: 'scroll-fetcher', text: 'К началу (Извлечение)', action: () => repoContext.scrollToSection('fetcher'), icon: <FaArrowRight /> });
                 contextSuggestions.push({ id: 'scroll-assistant', text: 'К концу (PR)', action: () => repoContext.scrollToSection('assistant'), icon: <FaArrowRight /> });
        }

         // Add hire me link always?
         const hireMe = getBaseSuggestions.find(s => s.isHireMe);
         if (hireMe) contextSuggestions.push(hireMe);

        return contextSuggestions;

    } else {
        // Not on repo-xml page or context not ready, show base suggestions
        return getBaseSuggestions;
    }
  }, [isOnRepoXmlPage, repoContext, getBaseSuggestions]); // Dependencies


  // Update active message based on context or keep default
  useEffect(() => {
      if (isOnRepoXmlPage && repoContext) {
          setActiveMessage(repoContext.getXuinityMessage());
      } else {
           // Maybe show a random hint or the default message
           const hints = [
               "Привет! Чем могу помочь?",
               "Готов ускорить разработку!",
               "Есть идея? Давай реализуем!",
               "Нужна помощь с кодом?",
               "Нажми на меня для опций!"
           ];
           setActiveMessage(hints[Math.floor(Math.random() * hints.length)]);
      }
  }, [isOnRepoXmlPage, repoContext, isOpen]); // Update message when context or open state changes


  // Auto-open timer (remains the same)
  useEffect(() => {
    if (!hasAutoOpened && !isOpen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoOpened(true);
      }, AUTO_OPEN_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [hasAutoOpened, isOpen]);

  // Handle Escape key (remains the same)
   const handleEscKey = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
        }
    }, []);
   useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscKey);
        } else {
            document.removeEventListener('keydown', handleEscKey);
        }
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen, handleEscKey]);


  // --- Handlers ---
  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.link) {
        if (suggestion.isFixAction) {
            setFixActionClicked(true); // Mark fix action was clicked before navigation
        }
         router.push(suggestion.link);
    } else if (suggestion.action) {
        suggestion.action();
    }
    setIsOpen(false); // Close menu after action/navigation
  };

  const handleOverlayClick = () => {
    setIsOpen(false);
  };

  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleFabClick = () => {
    setIsOpen(!isOpen); // Toggle open state
    if (!isOpen) {
        setHasAutoOpened(true); // Prevent auto-open if manually opened
    }
  }

  // --- Render ---
  return (
    <AnimatePresence>
      {isOpen ? (
        // Overlay and Dialog Container
        <motion.div
          key="dialog-overlay"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-40 backdrop-blur-sm" // Increased opacity slightly
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }} // Animate overlay fade in
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="chat-suggestions-title"
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-start bg-transparent" // Adjusted max width slightly
            onClick={handleDialogClick}
          >
            <h2 id="chat-suggestions-title" className="sr-only">Chat Suggestions</h2>

            {/* Speech Bubble */}
            <motion.div
                key={activeMessage} // Animate message change
                variants={childVariants}
                className="relative mb-3 w-full bg-white bg-opacity-95 p-3 rounded-lg shadow-[0_0_15px_rgba(0,255,157,0.6)]"
            >
                <p className="text-sm text-gray-800 font-semibold text-center sm:text-left">
                    {activeMessage}
                </p>
                {/* Speech bubble pointer */}
                <div className="absolute -bottom-2 left-1/2 sm:left-16 transform -translate-x-1/2 sm:translate-x-0 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white border-opacity-95" />
            </motion.div>

            {/* Character Image & Actions */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                 {/* Character Image */}
                 <motion.div
                    variants={childVariants}
                    className="flex-shrink-0 self-center sm:self-end" // Align bottom on larger screens
                    style={{ perspective: '500px' }} // For 3D effect on hover
                    >
                    <motion.div
                         whileHover={{ scale: 1.05, rotateY: 10 }} // Subtle hover effect
                         transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    >
                        <Image
                            src={CHARACTER_IMAGE_URL}
                            alt={CHARACTER_ALT_TEXT}
                            width={120} // Slightly smaller for action list
                            height={120}
                            priority
                            className="drop-shadow-[0_0_12px_rgba(0,255,157,0.6)]"
                        />
                    </motion.div>
                </motion.div>

                {/* Suggestion Buttons */}
                <motion.div
                    variants={childVariants} // Animate the container
                    className="space-y-2 w-full flex-grow" // Take remaining space
                >
                    <AnimatePresence initial={false}>
                        {suggestions.map((suggestion) => (
                            <motion.button
                                key={suggestion.id}
                                variants={childVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                                onClick={() => handleSuggestionClick(suggestion)}
                                className={clsx(
                                    "flex items-center w-full text-left px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ease-in-out",
                                    "shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_14px_rgba(0,255,157,0.6)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75",
                                    {
                                        "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400": suggestion.isHireMe,
                                        "bg-gray-700 bg-opacity-80 text-cyan-400 hover:bg-opacity-90 hover:text-cyan-300": !suggestion.isHireMe,
                                    }
                                )}
                            >
                            {suggestion.icon || (suggestion.link ? <FaPaperPlane className="mr-1.5" /> : <FaArrowRight className="mr-1.5" />)} {/* Default icons */}
                             <span className="flex-grow">{suggestion.text}</span>
                            </motion.button>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </div>

          </motion.div>
        </motion.div>
      ) : (
        // Floating Action Button (FAB)
        <motion.button
          key="fab"
          aria-label="Открыть меню помощи Xuinity"
          onClick={handleFabClick}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-16 bg-cyan-600 hover:bg-cyan-500 text-white p-3.5 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.7)] hover:shadow-[0_0_20px_rgba(0,255,157,0.9)] transition-all duration-200 ease-in-out z-40 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900" // Slightly larger padding
          variants={fabVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaRobot className="text-2xl" aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};


// Wrap the export with the context provider IF needed globally,
// but it's better to provide it only on the specific page.
// If StickyChatButton is used OUTSIDE RepoXmlPage, the context hook will safely return null or throw (as handled above).
export default StickyChatButton;