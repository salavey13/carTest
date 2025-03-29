"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaRobot, FaStar, FaArrowRight, FaCodeBranch, FaClipboardCheck,
    FaWandMagicSparkles, FaListCheck, FaPaperPlane, FaHighlighter,
    FaDownload, FaPlus, FaPoo, FaSpinner
} from "react-icons/fa6"; // Using Fa6 for consistent icons
import Image from "next/image";
import clsx from "clsx";
// Import context hook AND RepoXmlPageContextType for type checking
import { useRepoXmlPageContext, RepoXmlPageContextType, WorkflowStep } from '@/contexts/RepoXmlPageContext'; // Adjust path if needed

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS = 13000; // Auto-open after 13 seconds
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Нанять меня за звезды";
const FIX_PAGE_ID = "fix-current-page";

interface Suggestion {
  id: string;
  text: string;
  link?: string; // Optional navigation link
  action?: () => void | Promise<void>; // Optional action callback (can be async)
  icon?: React.ReactNode; // Optional icon for the button
  isHireMe?: boolean; // Special styling for "Hire Me" button
  isFixAction?: boolean; // Identifies the "Fix this page" action
  disabled?: boolean; // Optional disabled state for buttons
}

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0, x: -300 }, // Slide in from left
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring", // Use spring physics for a bouncy effect
      stiffness: 120,
      damping: 15,
      when: "beforeChildren", // Ensure container animates before children
      staggerChildren: 0.08, // Stagger children animation slightly
    },
  },
  exit: { opacity: 0, x: -300, transition: { duration: 0.3 } }, // Slide out to left
};

const childVariants = {
  hidden: { opacity: 0, y: 20 }, // Start slightly down and invisible
  visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, // Bounce up into view
  exit: { opacity: 0, transition: { duration: 0.2 } }, // Fade out quickly
};

const fabVariants = {
    hidden: { scale: 0, opacity: 0 }, // Start scaled down and invisible
    visible: {
        scale: 1,
        opacity: 1,
        rotate: [0, 10, -10, 5, -5, 0], // Subtle rotation animation on appear
        transition: {
            scale: { duration: 0.4, ease: "easeOut" },
            opacity: { duration: 0.4, ease: "easeOut" },
            rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 } // Gentle infinite rotation after delay
        }
    },
    exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } // Scale down and fade out on exit
};

// --- Component ---
const StickyChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false); // Controls dialog visibility
  const [fixActionClicked, setFixActionClicked] = useState(false); // Tracks if "Fix page" was clicked (to avoid showing it again immediately)
  const [hasAutoOpened, setHasAutoOpened] = useState(false); // Tracks if the dialog auto-opened once
  const [activeMessage, setActiveMessage] = useState<string>("Привет! Чем могу помочь?"); // Message displayed in the bubble

  const currentPath = usePathname(); // Get current URL path
  const router = useRouter(); // Next.js router for navigation

  // --- Contextual Logic ---
  const isOnRepoXmlPage = currentPath === '/repo-xml';
  // Attempt to get context; will be undefined if Provider isn't above this component
  const repoContext = useRepoXmlPageContext();

  // --- Base Suggestions (for pages other than /repo-xml or as fallback) ---
  const getBaseSuggestions = useMemo((): Suggestion[] => {
    // Determine the potential folder path for the "Fix page" action
    const folderPath = currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`;
    return [
      // Show "Fix page" only if not clicked AND not already on repo-xml page
      ...(!fixActionClicked && !isOnRepoXmlPage
        ? [{ id: FIX_PAGE_ID, text: "Исправить эту страницу", link: `/repo-xml?path=${folderPath}`, isFixAction: true, icon: <FaHighlighter className="mr-1.5" /> }]
        : []),
      { id: "add-new", text: "Создать что-то новое", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" /> },
      { id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> },
    ];
  }, [currentPath, fixActionClicked, isOnRepoXmlPage]); // Dependencies for recalculation

  // --- Contextual Suggestions (for /repo-xml page when context is available) ---
  const getRepoContextSuggestions = useCallback((): Suggestion[] => {
    if (!repoContext) return []; // Should not happen if isOnRepoXmlPage is true, but good safeguard

    const suggestions: Suggestion[] = [];
    const step = repoContext.currentStep; // Get current step from context
    const isLoading = repoContext.fetcherLoading || repoContext.assistantLoading; // Check loading states from context

    // Helper function to create suggestion objects, applying disabled state based on loading
    const createSuggestion = (
        id: string,
        text: string,
        action: (() => void | Promise<void>) | null, // Action can be null for informative states
        icon: JSX.Element,
        forceDisabled: boolean = false // Optional flag to disable even if not loading
        ): Suggestion => ({
            id, text, action: action ?? undefined, icon, disabled: isLoading || forceDisabled
    });

    // Generate suggestions based on the current workflow step from context
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
        if (repoContext.primaryHighlightedPath) { // If a file was highlighted via URL param
          suggestions.push(createSuggestion('select-highlighted', 'Выбрать подсвеченные', repoContext.triggerSelectHighlighted, <FaHighlighter />));
        }
        // Always allow skipping to the request input
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
         suggestions.push(createSuggestion('select-all-parsed', 'Выбрать все для PR ✅', repoContext.triggerSelectAllParsed, <FaListCheck />, !repoContext.filesParsed)); // Disable if parsing conceptually failed
         suggestions.push(createSuggestion('scroll-pr', 'Перейти к PR 🚀', () => repoContext.scrollToSection('prSection'), <FaArrowRight />));
         break;
      case 'parsed_files_selected':
        suggestions.push(createSuggestion('create-pr', 'Создать Pull Request', repoContext.triggerCreatePR, <FaCodeBranch />, repoContext.selectedAssistantFiles.size === 0));
        break;
       case 'creating_pr':
         suggestions.push(createSuggestion('loading-pr', 'Создаю PR...', null, <FaSpinner className="animate-spin" />, true));
         break;
       case 'pr_created':
         suggestions.push(createSuggestion('start-again', 'Начать новый цикл? ✨', () => window.location.reload(), <FaWandMagicSparkles />)); // Simple page reload
         break;
      default: // Fallback / Catch-all for unexpected states
        suggestions.push(createSuggestion('scroll-fetcher', 'К началу (Извлечение)', () => repoContext.scrollToSection('fetcher'), <FaArrowRight />));
        suggestions.push(createSuggestion('scroll-assistant', 'К концу (PR)', () => repoContext.scrollToSection('assistant'), <FaArrowRight />));
    }

     // Always add the "Hire me" suggestion at the end if available
     const hireMe = getBaseSuggestions.find(s => s.isHireMe);
     if (hireMe) suggestions.push({...hireMe, disabled: isLoading }); // Disable if context actions are loading

    return suggestions;

  }, [repoContext, getBaseSuggestions]); // Dependencies for recalculation

  // --- Determine Final Suggestions List ---
  const suggestions = useMemo(() => {
      // Use contextual suggestions ONLY if on the page AND context is available
      return isOnRepoXmlPage && repoContext ? getRepoContextSuggestions() : getBaseSuggestions;
  }, [isOnRepoXmlPage, repoContext, getBaseSuggestions, getRepoContextSuggestions]);

  // --- Update Active Message in Speech Bubble ---
  useEffect(() => {
      if (isOnRepoXmlPage && repoContext) {
          // If on the target page and context exists, use its message
          setActiveMessage(repoContext.getXuinityMessage());
      } else {
           // Otherwise, use a default message for other pages
           setActiveMessage("Привет! Чем могу помочь?");
           // Could also randomize hints here if desired
      }
  // Update when context availability/state changes, or when dialog opens/closes
  }, [isOnRepoXmlPage, repoContext, isOpen]);

  // --- Auto-open Timer ---
  useEffect(() => {
    // Only run the timer if it hasn't auto-opened yet and isn't currently open
    if (!hasAutoOpened && !isOpen) {
      const timer = setTimeout(() => {
        setIsOpen(true); // Open the dialog
        setHasAutoOpened(true); // Mark that it has auto-opened
      }, AUTO_OPEN_DELAY_MS);
      // Cleanup function to clear the timer if the component unmounts or state changes
      return () => clearTimeout(timer);
    }
  }, [hasAutoOpened, isOpen]); // Dependencies: only run when these change

  // --- Handle Escape Key to Close Dialog ---
   const handleEscKey = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            setIsOpen(false); // Close the dialog on Escape press
        }
    }, []); // No dependencies, function definition doesn't change

   useEffect(() => {
        if (isOpen) {
            // Add listener when dialog opens
            document.addEventListener('keydown', handleEscKey);
        } else {
            // Remove listener when dialog closes
            document.removeEventListener('keydown', handleEscKey);
        }
        // Cleanup function to remove listener if component unmounts while open
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen, handleEscKey]); // Dependencies: run when open state or handler changes


  // --- Event Handlers ---
  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.disabled) return; // Ignore clicks on disabled buttons

    if (suggestion.link) {
        // If it's a link suggestion
        if (suggestion.isFixAction) {
            setFixActionClicked(true); // Mark that "Fix page" was clicked
        }
         router.push(suggestion.link); // Navigate using Next.js router
    } else if (suggestion.action) {
        // If it's an action suggestion
        suggestion.action(); // Execute the callback function
    }
    setIsOpen(false); // Close the dialog after interaction
  };

  // Close dialog when clicking the background overlay
  const handleOverlayClick = () => setIsOpen(false);
  // Prevent clicks inside the dialog content from closing it
  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
  // Toggle dialog visibility when clicking the FAB
  const handleFabClick = () => {
    setIsOpen(!isOpen);
    // If manually opening, prevent auto-open timer from running again
    if (!isOpen) setHasAutoOpened(true);
  };


  // --- Render Logic ---
  return (
    <AnimatePresence> {/* Enables exit animations */}
      {isOpen ? (
        // --- Overlay and Dialog ---
        <motion.div
          key="dialog-overlay" // Unique key for AnimatePresence
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-40 backdrop-blur-sm"
          onClick={handleOverlayClick} // Click overlay to close
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="chat-suggestions-title"
        >
          {/* Dialog Content Container */}
          <motion.div
            variants={containerVariants} // Apply container animation variants
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-start bg-transparent" // Responsive width
            onClick={handleDialogClick} // Prevent closing when clicking dialog itself
          >
            <h2 id="chat-suggestions-title" className="sr-only">Chat Suggestions</h2>

            {/* Speech Bubble */}
            <motion.div
                key={activeMessage} // Animate message change
                variants={childVariants} // Apply child animation variants
                className="relative mb-3 w-full bg-white bg-opacity-95 p-3 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.6)]"
            >
                <p className="text-sm text-gray-800 font-semibold text-center sm:text-left">{activeMessage}</p>
                {/* Triangle pointer for the bubble */}
                <div className="absolute -bottom-2 left-1/2 sm:left-16 transform -translate-x-1/2 sm:translate-x-0 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white border-opacity-95" />
            </motion.div>

            {/* Character Image & Actions Container */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                {/* Character Image */}
                 <motion.div
                    variants={childVariants} // Apply child animation variants
                    className="flex-shrink-0 self-center sm:self-end" // Center on small, align bottom on larger screens
                    style={{ perspective: '500px' }} // Enable 3D perspective for hover effect
                 >
                    <motion.div
                         whileHover={{ scale: 1.05, rotateY: 10 }} // Subtle 3D rotation on hover
                         transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    >
                        {/* Use next/image for optimized loading and preloading via 'priority' */}
                        <Image
                            src={CHARACTER_IMAGE_URL}
                            alt={CHARACTER_ALT_TEXT}
                            width={120}
                            height={120}
                            priority // Signals Next.js to preload/prioritize this image
                            className="rounded-full drop-shadow-[0_0_12px_rgba(0,255,157,0.6)]"
                        />
                    </motion.div>
                </motion.div>

                {/* Suggestion Buttons List */}
                <motion.div
                    variants={childVariants} // Apply child animation variants to the list container
                    className="space-y-2 w-full flex-grow" // Allow list to grow and add space between buttons
                >
                    <AnimatePresence initial={false}> {/* Animate changes within the list */}
                        {suggestions.map((suggestion) => (
                            <motion.button
                                key={suggestion.id} // Unique key for list items
                                variants={childVariants} // Apply child animation to each button
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout // Animate layout changes (e.g., when items are added/removed)
                                onClick={() => handleSuggestionClick(suggestion)}
                                disabled={suggestion.disabled} // Apply disabled state from suggestion object
                                className={clsx( // Dynamically apply classes using clsx
                                    "flex items-center w-full text-left px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ease-in-out",
                                    "shadow-[0_0_8px_rgba(0,255,157,0.3)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75",
                                    { // Conditional classes based on suggestion properties
                                        "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400": suggestion.isHireMe && !suggestion.disabled,
                                        "bg-gray-700 bg-opacity-80 text-cyan-400 hover:bg-opacity-90 hover:text-cyan-300": !suggestion.isHireMe && !suggestion.disabled,
                                        "bg-gray-600 bg-opacity-50 text-gray-400 cursor-not-allowed": suggestion.disabled, // Style for disabled buttons
                                        "hover:shadow-[0_0_14px_rgba(0,255,157,0.6)]": !suggestion.disabled, // Hover shadow only if not disabled
                                    }
                                )}
                            >
                             {suggestion.icon || <FaPaperPlane className="mr-1.5" />} {/* Display icon or default */}
                             <span className="flex-grow">{suggestion.text}</span> {/* Button text */}
                            </motion.button>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        // --- Floating Action Button (FAB) --- Rendered when dialog is closed
        <motion.button
          key="fab" // Unique key for AnimatePresence
          aria-label="Открыть меню помощи Xuinity"
          onClick={handleFabClick} // Click to toggle dialog
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-16 bg-cyan-600 hover:bg-cyan-500 text-white p-3.5 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.7)] hover:shadow-[0_0_20px_rgba(0,255,157,0.9)] transition-all duration-200 ease-in-out z-40 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
          variants={fabVariants} // Apply FAB animation variants
          initial="hidden"
          animate="visible"
          exit="exit"
          whileHover={{ scale: 1.1 }} // Scale up slightly on hover
          whileTap={{ scale: 0.95 }} // Scale down slightly on click
        >
          <FaRobot className="text-2xl" aria-hidden="true" /> {/* Robot icon */}
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default StickyChatButton;