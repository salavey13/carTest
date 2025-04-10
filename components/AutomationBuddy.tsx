// /components/AutomationBuddy.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowRotateRight, FaArrowsRotate, FaAngrycreative, FaPoo, // Keep buddy icon
    FaList, FaCodeBranch // Added icons
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Context Import
import { useRepoXmlPageContext, FetchStatus, WorkflowStep, SimplePullRequest } from "@/contexts/RepoXmlPageContext"; // Import types

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
        selectedAssistantFiles, assistantLoading, aiActionLoading,
        loadingPrs, openPrs, targetBranchName, // Added PR/Branch states
        // Repo URL needed for fetching PRs
        fetcherRef, assistantRef, // Keep refs for actions

        // Triggers
        triggerFetch = () => console.warn("triggerFetch not available"),
        triggerGetOpenPRs = async (url: string) => console.warn("triggerGetOpenPRs not available"), // Added PR fetch trigger
        triggerSelectHighlighted = () => console.warn("triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = async () => console.warn("triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => console.warn("triggerCopyKwork not available"),
        triggerAskAi = async () => console.warn("triggerAskAi not available"),
        triggerParseResponse = async () => console.warn("triggerParseResponse not available"),
        triggerSelectAllParsed = () => console.warn("triggerSelectAllParsed not available"),
        triggerCreatePR = async () => console.warn("triggerCreatePR not available"),
        scrollToSection = () => console.warn("scrollToSection not available"),

        // Messages
        getXuinityMessage = () => "Контекст рабочего процесса недоступен.",

    } = useRepoXmlPageContext();

    // Memoize repoUrl from fetcher ref if possible (less ideal, but avoids prop drilling)
    // TODO: Ideally repoUrl should be part of the context state
    const repoUrl = useMemo(() => {
        // Attempt to get URL from assistant first (as it might be updated there)
        // This is a bit hacky, context state is better
        // const assistantUrl = assistantRef?.current?.getRepoUrl?.(); // Assuming assistant has getRepoUrl
        // if (assistantUrl) return assistantUrl;
        // Fallback to potentially undefined fetcher state
        // return fetcherRef?.current?.repoUrl || ""; // Assuming fetcher has repoUrl
        return "https://github.com/salavey13/cartest"; // Hardcode for now, NEEDS proper context state
    }, []); // Refs might not be ready initially

    // --- Define Suggestions (Driven by Context) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
        // Combined loading state
        const isAnyLoading = isFetcherLoading || assistantLoading || aiActionLoading || loadingPrs;
        const branchInfo = targetBranchName ? ` (${targetBranchName})` : ' (default)';

        const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            if (condition) {
                const isDisabled = disabled || (isAnyLoading && !['retry-fetch', 'loading-indicator', 'load-prs-indicator'].includes(id));
                suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
            }
        };

        // Build suggestions based on the current workflow step
        switch (currentStep) {
            case 'need_repo_url':
                 addSuggestion("goto-fetcher-settings", "Указать URL/Токен/Ветку", () => scrollToSection('fetcher'), <FaKeyboard />);
                 break;
            case 'ready_to_fetch':
                addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, triggerFetch, <FaDownload />, true, !repoUrlEntered, !repoUrlEntered ? "Сначала введи URL репо" : "");
                addSuggestion("load-prs", "Загрузить PR (для выбора ветки)", () => triggerGetOpenPRs(repoUrl), <FaList />, true, !repoUrlEntered);
                addSuggestion("goto-fetcher-settings", "Изменить URL/Токен/Ветку", () => scrollToSection('fetcher'), <FaKeyboard />);
                break;
            case 'fetching':
                addSuggestion("loading-indicator", `Загрузка Файлов${branchInfo}...`, () => {}, <FaArrowsRotate className="animate-spin"/>, true, true );
                break;
             case 'loading_prs': // Hypothetical step if we add one
                 addSuggestion("load-prs-indicator", "Загрузка PR...", () => {}, <FaArrowsRotate className="animate-spin"/>, true, true );
                 break;
            case 'fetch_failed':
                addSuggestion("retry-fetch", `Попробовать Снова${branchInfo}?`, () => triggerFetch(true), <FaArrowRotateRight />, true, isAnyLoading);
                addSuggestion("goto-fetcher-settings", "Проверить URL/Токен/Ветку", () => scrollToSection('fetcher'), <FaKeyboard />, !isAnyLoading);
                if (openPrs.length === 0) {
                    addSuggestion("load-prs", "Загрузить PR?", () => triggerGetOpenPRs(repoUrl), <FaList />, !isAnyLoading);
                }
                break;
            // --- States after successful fetch ---
            case 'files_fetched':
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("ask-ai-empty", "🤖 Спросить AI (без контекста)", triggerAskAi, <FaRobot />);
                 if (openPrs.length > 0) {
                     addSuggestion("goto-pr-selector", "К Выбору PR Ветки", () => scrollToSection('prSelector'), <FaCodeBranch />);
                 } else {
                     addSuggestion("load-prs", "Загрузить PR?", () => triggerGetOpenPRs(repoUrl), <FaList />, !isAnyLoading);
                 }
                 break;
            case 'files_fetched_highlights':
                 addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />);
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("add-selected", "Добавить Выбранные в Запрос", () => triggerAddSelectedToKwork(true), <FaPlus />, selectedFetcherFiles.size > 0);
                 addSuggestion("ask-ai-highlights", "🤖 Спросить AI (без контекста)", triggerAskAi, <FaRobot />);
                 if (openPrs.length > 0) {
                    addSuggestion("goto-pr-selector", "К Выбору PR Ветки", () => scrollToSection('prSelector'), <FaCodeBranch />);
                 }
                break;
            case 'files_selected':
                addSuggestion("add-selected", "Добавить в Запрос и Спросить AI", () => triggerAddSelectedToKwork(true), <FaPlus />);
                addSuggestion("ask-ai-selected", "🤖 Спросить AI (без добавления)", triggerAskAi, <FaRobot />);
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                 if (openPrs.length > 0) {
                    addSuggestion("goto-pr-selector", "Изменить Ветку PR", () => scrollToSection('prSelector'), <FaCodeBranch />);
                 }
                break;
            case 'request_written':
                addSuggestion("ask-ai-written", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                addSuggestion("copy-kwork", "Скопировать Запрос (Вручную)", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent, !kworkInputHasContent ? "Запрос пуст" : "");
                addSuggestion("goto-kwork", "К Редактору Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;
            case 'generating_ai_response':
                 addSuggestion("loading-indicator", "Gemini Думает...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 break;
            case 'request_copied':
                addSuggestion("goto-ai-response", "К Вводу Ответа AI", () => scrollToSection('aiResponseInput'), <FaArrowRight />);
                addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                break;
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
                addSuggestion("goto-pr-form", "К Форме PR", () => scrollToSection('prSection'), <FaRocket />);
                break;
            default:
                 addSuggestion("goto-start", "К Началу...", () => scrollToSection('fetcher'), <FaCircleInfo />);
        }

        // Add Clear All if appropriate
         if (fetcherRef?.current?.clearAll && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) {
             addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaPoo/>, true, isAnyLoading);
         }

        // Final check on disabled state
        return suggestionsList.map(s => ({ ...s, disabled: s.disabled || (isAnyLoading && !['retry-fetch', 'loading-indicator', 'load-prs-indicator'].includes(s.id)) }));

    }, [ // Dependencies
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs, openPrs, // Added PR/loading states
        targetBranchName, // Added targetBranchName
        triggerFetch, triggerGetOpenPRs, // Added PR fetch trigger
        triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        scrollToSection, fetcherRef, repoUrl // Added repoUrl
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
            if (!suggestion.id.startsWith('goto-') && suggestion.id !== 'loading-indicator' && suggestion.id !== 'load-prs-indicator') {
                setIsOpen(false);
            } else {
                 setTimeout(() => setIsOpen(false), 300);
            }
            if (result instanceof Promise) {
                result.catch(err => console.error(`Error executing buddy action (${suggestion.id}):`, err));
            }
        } else {
             setIsOpen(false);
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
                            <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                            <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-end" />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                <div className="fixed bottom-4 right-4 z-50">
                    <FloatingActionButton onClick={handleFabClick} variants={fabVariants} icon={<FaAngrycreative className="text-xl" />} className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white" />
                </div>
            )}
        </AnimatePresence>
    );
};
export default AutomationBuddy;