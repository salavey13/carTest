"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck, FaRobot
} from "react-icons/fa6";

// Import Subcomponents (can reuse or create specific ones)
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton"; // Can reuse FAB
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble"; // Reuse SpeechBubble
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay"; // Reuse CharacterDisplay (or use a different image)
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList"; // Reuse SuggestionList

// ****** CONTEXT IMPORT ******
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS_BUDDY = 5000; // Faster auto-open maybe?
const BUDDY_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/automation_buddy.png"; // Placeholder - Replace with actual buddy image
const BUDDY_ALT_TEXT = "Automation Buddy";

interface Suggestion {
    id: string;
    text: string;
    action?: () => void | Promise<void>;
    icon?: React.ReactNode;
    disabled?: boolean;
    tooltip?: string; // Optional tooltip for buttons
}

// --- Animation Variants --- (Can be same or different)
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
// FAB specific variants, maybe rotate differently or use a different icon
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, -15, 15, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.5 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };


// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    // Message and suggestions come from context now

    // ****** GET CONTEXT ******
    const {
        // State needed for suggestions/messages
        currentStep,
        repoUrlEntered,
        filesFetched,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        selectedFetcherFiles,
        kworkInputHasContent,
        requestCopied,
        aiResponseHasContent,
        filesParsed,
        selectedAssistantFiles,
        assistantLoading,
        // Needed for enabling/disabling buttons based on state
        parsedFiles, // Assuming this might be added to context or derived if needed
        validationStatus, // Assuming this might be added to context
        prTitle, // Assuming this might be added to context for PR button disable logic
        // Trigger functions
        triggerFetch = () => console.warn("triggerFetch not available"),
        triggerSelectHighlighted = () => console.warn("triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = () => console.warn("triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => console.warn("triggerCopyKwork not available"),
        triggerParseResponse = async () => console.warn("triggerParseResponse not available"),
        triggerSelectAllParsed = () => console.warn("triggerSelectAllParsed not available"),
        triggerCreatePR = async () => console.warn("triggerCreatePR not available"),
        // Scroll function
        scrollToSection = () => console.warn("scrollToSection not available"),
        // Message function
        getXuinityMessage = () => "Контекст рабочего процесса недоступен.",
        // Refs (potentially needed for more complex scroll logic, but getXuinityMessage is primary)
        // kworkInputRef, aiResponseInputRef, etc.
    } = useRepoXmlPageContext();


    // --- Define Suggestions (Driven *only* by Context) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];

        // Helper to add suggestion with less repetition
        const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            if (condition) {
                suggestionsList.push({ id, text, action, icon, disabled, tooltip });
            }
        };

        // Build suggestions based on the current workflow step
        switch (currentStep) {
            case 'need_fetch':
                addSuggestion("fetch", "Извлечь Файлы", triggerFetch, <FaDownload />, true, !repoUrlEntered || assistantLoading, !repoUrlEntered ? "Сначала введи URL репо" : "");
                break;

            case 'files_fetched':
                 addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />, !!(primaryHighlightedPath || secondaryHighlightedPaths?.length > 0));
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("add-selected", "Добавить в Запрос", triggerAddSelectedToKwork, <FaPlus />, selectedFetcherFiles.size > 0);
                break;

            case 'files_selected':
                addSuggestion("add-selected", "Добавить в Запрос", triggerAddSelectedToKwork, <FaPlus />, true, assistantLoading);
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;

            case 'request_written':
                addSuggestion("copy-kwork", "Скопировать Запрос", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent || assistantLoading, !kworkInputHasContent ? "Запрос пуст" : "");
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;

            case 'request_copied':
                addSuggestion("goto-ai-response", "К Вводу Ответа AI", () => scrollToSection('aiResponseInput'), <FaArrowRight />);
                addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, assistantLoading || !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                break;

            case 'response_pasted':
                 addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, assistantLoading || !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                 addSuggestion("goto-ai-response", "К Редактору Ответа", () => scrollToSection('aiResponseInput'), <FaKeyboard />);
                break;

            case 'response_parsed':
                 // Assuming context provides `parsedFiles` count or `filesParsed` boolean indicates > 0 files
                 // Let's rely on `filesParsed` and `selectedAssistantFiles.size`
                 addSuggestion("select-all-parsed", "Выбрать Все для PR", triggerSelectAllParsed, <FaListCheck />, filesParsed /*&& selectedAssistantFiles.size < parsedFiles.length*/ ); // Simplified condition
                 addSuggestion("goto-assistant-files", "К Файлам для PR", () => scrollToSection('assistant'), <FaEye />);
                 addSuggestion("create-pr", "Создать PR", triggerCreatePR, <FaGithub />, selectedAssistantFiles.size > 0, assistantLoading /*|| validationStatus === 'error'*/, "Выбери файлы для PR"); // Add more complex disable logic if needed
                break;

             case 'pr_ready':
                addSuggestion("create-pr", "Создать PR", triggerCreatePR, <FaGithub />, true, assistantLoading /*|| validationStatus === 'error'*/);
                addSuggestion("goto-pr-form", "К Форме PR", () => scrollToSection('assistant'), <FaRocket />); // Scroll towards PR button area
                break;

            default: // idle or other states
                 addSuggestion("goto-start", "К Началу...", () => scrollToSection('fetcher'), <FaCircleInfo />);
        }

        // Maybe add a generic "Scroll to Top/Bottom" or "Clear All" action?
         // addSuggestion("clear-all", "Очистить все?", () => { /* Call context clear function if exists */ }, <FaBroom />);

        return suggestionsList;
    }, [ // Ensure ALL context values affecting suggestions are listed
        currentStep, repoUrlEntered, primaryHighlightedPath, secondaryHighlightedPaths,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, /* validationStatus, */ /* prTitle */
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        scrollToSection
    ]);

    // --- Get Active Message from Context ---
    const activeMessage = useMemo(() => {
        return getXuinityMessage(); // Directly use the context message getter
    }, [getXuinityMessage]); // Depends only on the stable getter function

    // --- Auto-open Timer ---
    useEffect(() => {
        if (!hasAutoOpened && !isOpen) {
            const timer = setTimeout(() => {
                setIsOpen(true);
                setHasAutoOpened(true);
            }, AUTO_OPEN_DELAY_MS_BUDDY);
            return () => clearTimeout(timer);
        }
    }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key ---
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


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        console.log("Automation Buddy Suggestion Clicked:", suggestion.id);
        if (suggestion.action) {
            const result = suggestion.action();
             if (result instanceof Promise) {
                result.catch(err => console.error("Error executing buddy action:", err));
             }
        }
        // Don't close automatically? Or maybe close after certain actions? User preference.
        // setIsOpen(false);
    };
    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setHasAutoOpened(true); // Mark as manually opened if closed then reopened
    };


    // --- Render Logic ---
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    key="buddy-dialog-overlay"
                    // Changed position: items-center justify-end (right side)
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 bg-black bg-opacity-40 backdrop-blur-sm"
                    onClick={handleOverlayClick}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-modal="true" role="dialog" aria-labelledby="buddy-suggestions-title"
                >
                    {/* Changed animation direction */}
                    <motion.div
                        variants={containerVariants} initial="hidden" animate="visible" exit="exit"
                        className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-end bg-transparent"
                        onClick={handleDialogClick}
                    >
                        <h2 id="buddy-suggestions-title" className="sr-only">Automation Buddy Suggestions</h2>

                        {/* Changed bubble position */}
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />

                        <div className="flex flex-col sm:flex-row-reverse items-center sm:items-end w-full gap-4">
                            {/* Changed character position */}
                            <CharacterDisplay
                                // Use buddy image/alt
                                characterImageUrl={BUDDY_IMAGE_URL}
                                characterAltText={BUDDY_ALT_TEXT}
                                // No github profile needed here
                                githubProfile={null}
                                variants={childVariants}
                            />
                            {/* Changed suggestion list alignment? */}
                            <SuggestionList
                                suggestions={suggestions}
                                onSuggestionClick={handleSuggestionClick}
                                listVariants={childVariants}
                                itemVariants={childVariants}
                                // Custom class for purple theme maybe?
                                className="items-center sm:items-end" // Align text right on larger screens
                            />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                 // Render FAB on the right side
                <div className="fixed bottom-4 right-4 z-40">
                    <FloatingActionButton
                        onClick={handleFabClick}
                        variants={fabVariants}
                        // Use a different icon/color
                        icon={<FaRobot className="text-xl" />}
                        className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white"
                    />
                </div>
            )}
        </AnimatePresence>
    );
};

export default AutomationBuddy;