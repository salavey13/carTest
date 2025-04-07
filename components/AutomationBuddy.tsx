// /components/AutomationBuddy.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck, FaRobot, FaRedo, FaArrowsRotate, FaAngrycreative
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Context Import
import { useRepoXmlPageContext, FetchStatus } from "@/contexts/RepoXmlPageContext";

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS_BUDDY = 5000;
const BUDDY_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png"; // Placeholder
const BUDDY_ALT_TEXT = "Automation Buddy";

interface Suggestion {
    id: string;
    text: string;
    action?: () => void | Promise<void>;
    icon?: React.ReactNode;
    disabled?: boolean;
    tooltip?: string;
}

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, -15, 15, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.5 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };

// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);

    // --- Context ---
    const {
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading,
        triggerFetch = () => console.warn("triggerFetch not available"),
        triggerSelectHighlighted = () => console.warn("triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = () => console.warn("triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => console.warn("triggerCopyKwork not available"),
        triggerParseResponse = async () => console.warn("triggerParseResponse not available"),
        triggerSelectAllParsed = () => console.warn("triggerSelectAllParsed not available"),
        triggerCreatePR = async () => console.warn("triggerCreatePR not available"),
        scrollToSection = () => console.warn("scrollToSection not available"),
        getXuinityMessage = () => "Контекст рабочего процесса недоступен.",
    } = useRepoXmlPageContext();

    // --- Define Suggestions (Driven by Context incl. fetchStatus) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying' || assistantLoading; // Combined loading state

        const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            if (condition) {
                // Disable most buttons during any loading, except specific allowed ones (like retry after failure)
                const isDisabled = disabled || (isLoading && id !== 'retry-fetch'); // Allow retry even if assistant is loading? Maybe not. Let's disable if ANY loading.
                suggestionsList.push({ id, text, action, icon, disabled: isDisabled || isLoading, tooltip });
            }
        };

        // Build suggestions based on the current workflow step AND fetch status
        switch (currentStep) {
            case 'need_repo_url':
                 addSuggestion("goto-fetcher-settings", "Указать URL Репо", () => scrollToSection('fetcher'), <FaKeyboard />);
                 break;
            case 'ready_to_fetch':
                addSuggestion("fetch", "Извлечь Файлы", () => triggerFetch(), <FaDownload />, true, !repoUrlEntered, !repoUrlEntered ? "Сначала введи URL репо" : "");
                break;
            case 'fetching':
                addSuggestion("loading-indicator", fetchStatus === 'retrying' ? "Повтор Запроса..." : "Загрузка Файлов...", () => {}, <FaArrowsRotate className="animate-spin"/>, true, true ); // Disabled indicator shows status
                break;
            case 'fetch_failed':
                addSuggestion("retry-fetch", "Попробовать Снова?", () => triggerFetch(true), <FaRedo />, true, isLoading); // Allow retry click even if assistant loading? Check this interaction. Disable if isLoading.
                addSuggestion("goto-fetcher-settings", "Проверить URL/Токен", () => scrollToSection('fetcher'), <FaKeyboard />, !isLoading); // Disable if any loading
                break;
            // --- States after successful fetch ---
            case 'files_fetched':
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("add-selected", "Добавить в Запрос", triggerAddSelectedToKwork, <FaPlus />, selectedFetcherFiles.size > 0);
                break;
            case 'files_fetched_highlights':
                 addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />);
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("add-selected", "Добавить в Запрос", triggerAddSelectedToKwork, <FaPlus />, selectedFetcherFiles.size > 0);
                break;
            case 'files_selected':
                addSuggestion("add-selected", "Добавить в Запрос", triggerAddSelectedToKwork, <FaPlus />);
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;
            case 'request_written':
                addSuggestion("copy-kwork", "Скопировать Запрос", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent, !kworkInputHasContent ? "Запрос пуст" : "");
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;
            case 'request_copied':
                addSuggestion("goto-ai-response", "К Вводу Ответа AI", () => scrollToSection('aiResponseInput'), <FaArrowRight />);
                addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                break;
            case 'response_pasted':
                 addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                 addSuggestion("goto-ai-response", "К Редактору Ответа", () => scrollToSection('aiResponseInput'), <FaKeyboard />);
                break;
            case 'parsing_response':
                 addSuggestion("loading-indicator", "Разбор Ответа...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 break;
            case 'response_parsed':
                 addSuggestion("select-all-parsed", "Выбрать Все для PR", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                 addSuggestion("goto-assistant-files", "К Файлам для PR", () => scrollToSection('assistant'), <FaEye />);
                 addSuggestion("create-pr", "Создать PR", triggerCreatePR, <FaGithub />, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0, selectedAssistantFiles.size === 0 ? "Выбери файлы для PR" : "");
                break;
             case 'pr_ready':
                addSuggestion("create-pr", "Создать PR", triggerCreatePR, <FaGithub />);
                addSuggestion("goto-pr-form", "К Форме PR", () => scrollToSection('assistant'), <FaRocket />);
                break;
            default: // idle
                 addSuggestion("goto-start", "К Началу...", () => scrollToSection('fetcher'), <FaCircleInfo />);
        }
        // Add common actions if needed, disabling based on `isLoading`
        // e.g., addSuggestion("clear-all", "Очистить?", clearAllAction, <FaBroom/>, true, isLoading);

        return suggestionsList.map(s => ({ ...s, disabled: s.disabled || isLoading })); // Ensure disabled if any loading

    }, [ // Dependencies
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading,
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        scrollToSection
    ]);

    // --- Get Active Message from Context ---
    const activeMessage = useMemo(() => getXuinityMessage(), [getXuinityMessage]);

    // --- Auto-open Timer ---
    useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS_BUDDY); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); } }, []);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => { if (suggestion.disabled) return; console.log("Automation Buddy Suggestion Clicked:", suggestion.id); if (suggestion.action) { const result = suggestion.action(); if (result instanceof Promise) { result.catch(err => console.error("Error executing buddy action:", err)); } } };
    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => { setIsOpen(!isOpen); if (!isOpen) setHasAutoOpened(true); };


    // --- Render Logic ---
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="buddy-dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 bg-black bg-opacity-40 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-modal="true" role="dialog" aria-labelledby="buddy-suggestions-title">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-end bg-transparent" onClick={handleDialogClick}>
                        <h2 id="buddy-suggestions-title" className="sr-only">Automation Buddy Suggestions</h2>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />
                        <div className="flex flex-col sm:flex-row-reverse items-center sm:items-end w-full gap-4">
                            <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                            <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-end" />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                <div className="fixed bottom-4 left-4 z-40">
                    <FloatingActionButton onClick={handleFabClick} variants={fabVariants} icon={<FaAngrycreative className="text-xl" />} className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white" />
                </div>
            )}
        </AnimatePresence>
    );
};
export default AutomationBuddy;
