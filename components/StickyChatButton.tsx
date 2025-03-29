"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaRobot, FaStar } from "react-icons/fa";
import Image from "next/image";
import clsx from "clsx"; // Using clsx for cleaner conditional classes

// --- Constants ---
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Нанять меня за звезды"; // Using constant for comparison
const FIX_PAGE_ID = "fix-current-page";

// --- Types ---
interface Suggestion {
  id: string; // Unique identifier for keys and logic
  text: string;
  link: string;
  isHireMe?: boolean; // Flag for special styling/icon
  isFixAction?: boolean; // Flag to track the "fix page" action
}

// --- Animation Variants ---
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


// --- Component ---
const StickyChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fixActionClicked, setFixActionClicked] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  // State to hold the suggestion displayed in the bubble, fixed when opened
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);

  const currentPath = usePathname();
  const router = useRouter();

  // Memoize folderPath calculation
  const folderPath = useMemo(() => {
    // Basic calculation, adjust if your routing structure is complex (e.g., route groups)
    return currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`; // Remove query params
  }, [currentPath]);

  // Memoize suggestions array
  const suggestions = useMemo((): Suggestion[] => [
    // Conditionally include the "fix page" suggestion
    ...(!fixActionClicked
      ? [
          {
            id: FIX_PAGE_ID,
            text: "Исправить текущую страницу",
            link: `/repo-xml?path=${folderPath}`, // Use dynamic folderPath
            isFixAction: true,
          },
        ]
      : []),
    { id: "add-new", text: "Добавить что-то новое", link: "/repo-xml" },
    { id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true },
  ], [fixActionClicked, folderPath]);

  // --- Effects ---

  // Auto-open timer
  useEffect(() => {
    if (!hasAutoOpened && !isOpen) { // Only run if not already opened or auto-opened
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoOpened(true); // Mark as auto-opened
      }, AUTO_OPEN_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [hasAutoOpened, isOpen]); // Depend on isOpen to stop timer if manually opened

  // Select a random suggestion when the menu opens
  useEffect(() => {
    if (isOpen && !activeSuggestion && suggestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * suggestions.length);
      setActiveSuggestion(suggestions[randomIndex]);
    } else if (!isOpen) {
      setActiveSuggestion(null); // Reset when closed
    }
  }, [isOpen, suggestions, activeSuggestion]); // Re-run if suggestions change while open (e.g., fix clicked)

  // Handle Escape key press to close the menu
  const handleEscKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Add focus trapping logic here if needed (e.g., using libraries like focus-trap-react)
      // document.body.style.overflow = 'hidden'; // Optional: Prevent body scroll when modal is open
    } else {
      document.removeEventListener('keydown', handleEscKey);
      // document.body.style.overflow = ''; // Restore body scroll
    }
    // Cleanup listener
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      // document.body.style.overflow = ''; // Ensure scroll is restored on unmount
    };
  }, [isOpen, handleEscKey]);


  // --- Handlers ---
  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.isFixAction) {
      setFixActionClicked(true); // Mark the fix action as clicked
    }
    setIsOpen(false); // Close menu on click
    router.push(suggestion.link);
  };

  const handleOverlayClick = () => {
    setIsOpen(false);
  };

  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Prevent closing when clicking inside the dialog content
  };

  const handleFabClick = () => {
      setIsOpen(true);
  }

  // --- Render ---
  return (
    // AnimatePresence handles the mounting/unmounting animation
    <AnimatePresence>
      {isOpen ? (
        // Overlay and Dialog Container
        <div
          key="dialog-overlay" // Need key for AnimatePresence
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-30 backdrop-blur-sm" // Added backdrop blur
          onClick={handleOverlayClick}
          aria-modal="true" // Accessibility: Mark as modal
          role="dialog"      // Accessibility: Define role
          aria-labelledby="chat-suggestions-title" // Accessibility: Labelled by hidden title (or use aria-label)
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative p-5 w-full max-w-sm sm:max-w-xs md:max-w-sm flex flex-col items-center sm:items-start bg-transparent" // Responsive width
            onClick={handleDialogClick} // Prevent overlay click from closing
          >
            {/* Hidden Title for Accessibility */}
            <h2 id="chat-suggestions-title" className="sr-only">Chat Suggestions</h2>

            {/* Speech Bubble */}
            {activeSuggestion && (
              <motion.div
                key={`bubble-${activeSuggestion.id}`} // Key ensures animation if suggestion changes
                variants={childVariants}
                className="relative mb-4 w-full bg-white bg-opacity-95 p-4 rounded-lg shadow-[0_0_15px_rgba(0,255,157,0.6)]"
              >
                {/* Removed unprofessional language, kept the suggestion */}
                <p className="text-sm text-gray-800 font-semibold">
                  {/* Using a more neutral and encouraging tone */}
                  Может, <span className="font-bold text-cyan-700">{activeSuggestion.text.toLowerCase()}</span>? Я могу помочь!
                </p>
                {/* Speech bubble pointer - adjusted positioning */}
                <div className="absolute -bottom-2 left-1/2 sm:left-16 transform -translate-x-1/2 sm:translate-x-0 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white" />
              </motion.div>
            )}

            {/* Character Image */}
            <motion.div
              variants={childVariants}
              className="mb-4 self-center sm:self-start sm:pl-8" // Center on small screens, align left on larger
            >
              <Image
                src={CHARACTER_IMAGE_URL}
                alt={CHARACTER_ALT_TEXT}
                width={150} // Slightly smaller? Adjust as needed
                height={150}
                priority // Preload image if it's important LCP
                className="drop-shadow-[0_0_12px_rgba(0,255,157,0.6)]"
              />
            </motion.div>

            {/* Suggestion Buttons */}
            <motion.div
                variants={childVariants} // Animate the container
                className="space-y-2.5 w-full" // Slightly more space
            >
                <AnimatePresence initial={false}> {/* Animate buttons individually */}
                    {suggestions.map((suggestion) => (
                        <motion.button
                            key={suggestion.id} // Use stable ID for key
                            // Apply child variants for stagger and exit animation
                            variants={childVariants}
                            initial="hidden" // Needed because parent uses staggerChildren
                            animate="visible"
                            exit="exit"
                            layout // Animate layout changes (e.g., when 'fix' button is removed)
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={clsx(
                                "block w-full text-left px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ease-in-out",
                                "shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_14px_rgba(0,255,157,0.6)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75", // Added focus state
                                {
                                "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400": suggestion.isHireMe,
                                "bg-gray-700 bg-opacity-80 text-cyan-400 hover:bg-opacity-90 hover:text-cyan-300": !suggestion.isHireMe,
                                }
                            )}
                        >
                        {suggestion.isHireMe && <FaStar className="inline mr-1.5 mb-0.5" aria-hidden="true" />}
                        {suggestion.text}
                        </motion.button>
                    ))}
                </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>
      ) : (
        // Floating Action Button (FAB)
        <motion.button
          key="fab" // Need key for AnimatePresence
          aria-label="Открыть меню помощи" // Accessibility: Clear label
          onClick={handleFabClick}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-16 bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.7)] hover:shadow-[0_0_20px_rgba(0,255,157,0.9)] transition-all duration-200 ease-in-out z-40 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900" // Style update, added focus state
          variants={fabVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          whileHover={{ scale: 1.1 }} // Add hover effect
          whileTap={{ scale: 0.95 }}  // Add tap effect
        >
          <FaRobot className="text-2xl" aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default StickyChatButton;