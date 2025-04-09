// /components/AutomationBuddy.tsx
"use client";

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowRotateRight, FaArrowsRotate, FaAngrycreative, FaPoo // Added FaPoo, FaRobot
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Context Import
import { useRepoXmlPageContext, FetchStatus, WorkflowStep } from "@/contexts/RepoXmlPageContext"; // Import types

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS_BUDDY = 5000;
const BUDDY_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
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
// .. (keep existing variants)
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
        // States
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, // Use both loading states

        // Triggers
        triggerFetch = () => console.warn("triggerFetch not available"),
        triggerSelectHighlighted = () => console.warn("triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = async () => console.warn("triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => console.warn("triggerCopyKwork not available"),
        triggerAskAi = async () => console.warn("triggerAskAi not available"), // Add AI trigger
        triggerParseResponse = async () => console.warn("triggerParseResponse not available"),
        triggerSelectAllParsed = () => console.warn("triggerSelectAllParsed not available"),
        triggerCreatePR = async () => console.warn("triggerCreatePR not available"),
        scrollToSection = () => console.warn("scrollToSection not available"),

        // Messages
        getXuinityMessage = () => "Контекст рабочего процесса недоступен.",

        // Refs (primarily for clearing)
        fetcherRef,
        // assistantRef, // Not directly used here for actions

    } = useRepoXmlPageContext();

    // --- Define Suggestions (Driven by Context incl. fetchStatus & aiActionLoading) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
        // Combined loading state for disabling most actions
        const isAnyLoading = isFetcherLoading || assistantLoading || aiActionLoading;

        const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            if (condition) {
                // Disable most buttons during any loading, except specific allowed ones (like retry fetch)
                const isDisabled = disabled || (isAnyLoading && id !== 'retry-fetch');
                suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
            }
        };

        // Build suggestions based on the current workflow step
        switch (currentStep) {
            case 'need_repo_url':
                 addSuggestion("goto-fetcher-settings", "Указать URL Репо", () => scrollToSection('fetcher'), <FaKeyboard />);
                 break;
            case 'ready_to_fetch':
                addSuggestion("fetch", "Извлечь Файлы", () => triggerFetch(), <FaDownload />, true, !repoUrlEntered, !repoUrlEntered ? "Сначала введи URL репо" : "");
                break;
            case 'fetching':
                addSuggestion("loading-indicator", fetchStatus === 'retrying' ? "Повтор Запроса..." : "Загрузка Файлов...", () => {}, <FaArrowsRotate className="animate-spin"/>, true, true );
                break;
            case 'fetch_failed':
                // Only allow retry if NOT currently loading anything else
                addSuggestion("retry-fetch", "Попробовать Снова?", () => triggerFetch(true), <FaArrowRotateRight />, true, isAnyLoading);
                addSuggestion("goto-fetcher-settings", "Проверить URL/Токен", () => scrollToSection('fetcher'), <FaKeyboard />, !isAnyLoading);
                break;
            // --- States after successful fetch ---
            case 'files_fetched':
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 // Suggest asking AI immediately if files fetched but nothing selected/written
                 addSuggestion("ask-ai-empty", "🤖 Спросить AI (без контекста)", triggerAskAi, <FaRobot />);
                break;
            case 'files_fetched_highlights':
                 addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />);
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("add-selected", "Добавить Выбранные в Запрос", () => triggerAddSelectedToKwork(true), <FaPlus />, selectedFetcherFiles.size > 0); // Auto-ask = true
                 addSuggestion("ask-ai-highlights", "🤖 Спросить AI (без контекста)", triggerAskAi, <FaRobot />);
                break;
            case 'files_selected':
                addSuggestion("add-selected", "Добавить в Запрос и Спросить AI", () => triggerAddSelectedToKwork(true), <FaPlus />); // Auto-ask = true
                addSuggestion("ask-ai-selected", "🤖 Спросить AI (без добавления)", triggerAskAi, <FaRobot />); // Ask with current kwork content
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;
            case 'request_written':
                addSuggestion("ask-ai-written", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                addSuggestion("copy-kwork", "Скопировать Запрос (Вручную)", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent, !kworkInputHasContent ? "Запрос пуст" : "");
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;
            // --- New AI Step ---
            case 'generating_ai_response':
                 addSuggestion("loading-indicator", "Gemini Думает...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 break;
            // --- Manual Copy Step ---
            case 'request_copied':
                addSuggestion("goto-ai-response", "К Вводу Ответа AI", () => scrollToSection('aiResponseInput'), <FaArrowRight />);
                addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                break;
            // --- After AI Response (API or Manual) ---
            case 'response_pasted':
                 addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, !aiResponseHasContent, !aiResponseHasContent ? "Нет ответа для разбора" : "");
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
                addSuggestion("goto-pr-form", "К Форме PR", () => scrollToSection('prSection'), <FaRocket />); // Target PR section directly
                break;
            default: // idle or unknown
                 addSuggestion("goto-start", "К Началу...", () => scrollToSection('fetcher'), <FaCircleInfo />);
        }

        // Add Clear All if appropriate (not during critical loading)
         if (fetcherRef?.current?.clearAll && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) {
             addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaPoo/>, true, isAnyLoading);
         }

        // Ensure all suggestions reflect the *final* disabled state based on isAnyLoading
        return suggestionsList.map(s => ({ ...s, disabled: s.disabled || (isAnyLoading && s.id !== 'retry-fetch' && s.id !== 'loading-indicator') }));

    }, [ // Dependencies
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, // Added aiActionLoading
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, // Added AI trigger
        triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        scrollToSection, fetcherRef // Added fetcherRef for clearAll access
    ]);

    // --- Get Active Message from Context ---
    const activeMessage = useMemo(() => getXuinityMessage(), [getXuinityMessage]);

    // --- Auto-open Timer ---
    useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS_BUDDY); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); } }, []);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        console.log("Automation Buddy Suggestion Clicked:", suggestion.id);
        if (suggestion.action) {
            const result = suggestion.action();
            // Close immediately unless it's a scroll action
            if (!suggestion.id.startsWith('goto-')) {
                setIsOpen(false);
            } else {
                 // Delay closing for scroll actions
                 setTimeout(() => setIsOpen(false), 300);
            }
            // Handle potential promise errors from async actions
            if (result instanceof Promise) {
                result.catch(err => {
                     console.error(`Error executing buddy action (${suggestion.id}):`, err);
                     // Optionally show a toast message on error
                     // toast.error(`Action "${suggestion.text}" failed.`);
                });
            }
        } else {
             setIsOpen(false); // Close if no action defined
        }
    };
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
                            {/* Character is purely visual for the buddy */}
                            <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                            <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-end" />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                <div className="fixed bottom-4 right-4 z-50"> {/* Ensure FAB is above potential dialog overlay if z-index matters */}
                    <FloatingActionButton onClick={handleFabClick} variants={fabVariants} icon={<FaAngrycreative className="text-xl" />} className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white" />
                </div>
            )}
        </AnimatePresence>
    );
};
export default AutomationBuddy;