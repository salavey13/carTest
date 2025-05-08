"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowRotateRight, FaArrowsRotate, FaAngrycreative, FaPoo,
    FaList, FaCodeBranch, FaExclamation, FaImages, FaSpinner, FaUpLong
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Context Import & Types
import {
    useRepoXmlPageContext, FetchStatus, WorkflowStep, FileNode, SimplePullRequest, ImageReplaceTask
} from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from '@/lib/debugLogger';
import { useAppToast } from "@/hooks/useAppToast";

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS_BUDDY = 4000;
const AUTO_OPEN_DELAY_MS_BUDDY_SIMPLE_CASE = 42000; // Longer delay if no params
const BUDDY_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const BUDDY_ALT_TEXT = "Automation Buddy";

interface Suggestion {
    id: string;
    text: string;
    action?: () => void | Promise<void>;
    icon?: React.ReactNode;
    isHireMe?: boolean;
    isFixAction?: boolean;
    isImageReplaceAction?: boolean;
    disabled?: boolean;
    tooltip?: string;
}

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, -15, 10, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0.8 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };
const notificationVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } }, exit: { scale: 0, opacity: 0 } };


// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    logger.log("[AutomationBuddy] START Render");
    // --- State ---
    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
    const previousSuggestionIds = useRef<Set<string>>(new Set());
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

    // --- Hooks ---
    const searchParams = useSearchParams(); // Assuming safe here
    const { error: toastError } = useAppToast();

    // --- Context ---
    const context = useRepoXmlPageContext();
    // Destructure ALL relevant state pieces needed for suggestion calculation
    const {
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, kworkInputValue,
        aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, manualBranchName, isSettingsModalOpen, isParsing,
        currentAiRequestId, imageReplaceTask, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, showComponents,
        // Destructure ALL necessary triggers
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed,
        triggerCreateOrUpdatePR, triggerToggleSettingsModal, scrollToSection,
        triggerClearKworkInput, getXuinityMessage
    } = context;
    logger.debug(`[AutomationBuddy] Context State Read: currentStep=${currentStep}, fetchStatus=${fetchStatus}, imageTask=${!!imageReplaceTask}, showComponents=${showComponents}`);

    // --- Effects ---
    useEffect(() => { setIsMounted(true); logger.debug("[AutomationBuddy Effect] Mounted"); }, []);

    // --- Get Active Message ---
    const activeMessage = useMemo(() => {
        logger.debug(`[AutomationBuddy Memo] Calculating activeMessage.`);
        if (!isMounted) return "Загрузка Бадди...";
        // Log the state getXuinityMessage sees
        if (typeof getXuinityMessage === 'function') {
            const message = getXuinityMessage();
            logger.debug(`[AutomationBuddy Memo] getXuinityMessage returned: "${message}"`);
            return message;
        }
        logger.error("[AutomationBuddy Memo] getXuinityMessage is not a function!");
        return "Ошибка получения статуса...";
    }, [isMounted, getXuinityMessage]); // Dependency is the stable function itself


    // --- Calculate Suggestions ---
    useEffect(() => {
        logger.debug("[AutomationBuddy Effect] Calculating suggestions START");
        if (!isMounted || typeof triggerFetch !== 'function') {
            logger.warn("[AutomationBuddy Effect] Skipping suggestion calc (not mounted or context triggers not ready)");
            setSuggestions([]); return;
        }

        // Use the directly destructured context values
        // No need for a separate snapshot object

        const calculateSuggestions = (): Suggestion[] => {
            const suggestionsList: Suggestion[] = [];
            const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
            const isAssistantProcessing = assistantLoading || isParsing; // Combined parsing state
            const isAiGenerating = aiActionLoading && !!currentAiRequestId;
            const isAnyLoading = isFetcherLoading || isAssistantProcessing || isAiGenerating || loadingPrs;
            const effectiveBranch = manualBranchName.trim() || targetBranchName || 'default';
            const branchInfo = effectiveBranch === 'default' ? '' : ` (${effectiveBranch})`;
            const createOrUpdateActionText = targetBranchName ? `Обновить Ветку '${targetBranchName}'` : "Создать PR";
            const createOrUpdateIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
            const hasAnyHighlights = !!primaryHighlightedPath || Object.values(secondaryHighlightedPaths).some(arr => arr.length > 0);
            const canShowComponentActions = showComponents;

            const addSuggestion = (id: string, text: string, action: (() => any) | undefined, icon: React.ReactNode, condition = true, disabled = false, tooltip = '', requiresComponents = false) => {
                const safeAction = typeof action === 'function' ? action : () => logger.warn(`No action defined for suggestion ID: ${id}`);
                if (requiresComponents && !canShowComponentActions) { condition = false; }
                if (condition) {
                    let isDisabled = disabled || isAnyLoading;
                    // Specific overrides based on ID and current state
                    if (['fetch', 'retry-fetch', 'retry-fetch-img'].includes(id)) isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || loadingPrs;
                    if (['add-selected', 'copy-kwork', 'clear-all'].includes(id)) isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || loadingPrs;
                    if (id.includes('ask-ai')) isDisabled = disabled || isAiGenerating;
                    if (id === 'parse-response') isDisabled = disabled || isParsing || isAiGenerating || !aiResponseHasContent;
                    if (id === 'create-pr' || id === 'update-branch') isDisabled = disabled || isAssistantProcessing || selectedAssistantFiles.size === 0;
                    if (id.includes('toggle-settings')) isDisabled = disabled || isAssistantProcessing || isAiGenerating || loadingPrs;
                    if (id === 'select-highlighted') { isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || !hasAnyHighlights; if (!hasAnyHighlights) tooltip = "Нет связанных файлов для выбора"; }
                    if (id === 'add-selected') isDisabled = disabled || selectedFetcherFiles.size === 0;
                    if (id === 'copy-kwork') isDisabled = disabled || !kworkInputHasContent; // Disable copy if no content based on boolean flag
                    if (id === 'clear-all') isDisabled = disabled || (!selectedFetcherFiles.size && !kworkInputHasContent && !aiResponseHasContent && !filesParsed); // Check if anything exists to clear

                    suggestionsList.push({ id, text, action: safeAction, icon, disabled: isDisabled, tooltip });
                }
            };

            // --- Image Replace Task Flow ---
             if (imageReplaceTask) {
                 logger.debug("[Suggestion Calc] Image Task Flow");
                 const targetFileExists = filesFetched && allFetchedFiles?.some(f => f.path === imageReplaceTask.targetPath);
                 const isErrorState = fetchStatus === 'error' || fetchStatus === 'failed_retries' || (fetchStatus === 'success' && !targetFileExists && filesFetched);
                 addSuggestion( 'toggle-settings', isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка)", triggerToggleSettingsModal, <FaCodeBranch />, true, assistantLoading, '', true );
                 if (isErrorState) { addSuggestion("retry-fetch-img", `Ошибка! Попробовать Загрузить Снова?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight className="text-red-400"/>, true, false, '', true); }
                 else if (fetchStatus === 'loading' || fetchStatus === 'retrying') { addSuggestion("img-loading", "Загрузка Файла...", undefined, <FaSpinner className="animate-spin text-blue-400"/>, true, true, '', true); }
                 else if (assistantLoading) { addSuggestion("img-processing", "Замена и PR/Обновление...", undefined, <FaSpinner className="animate-spin text-purple-400"/>, true, true, '', true); }
                 else if (fetchStatus === 'success' && targetFileExists) { addSuggestion("img-ready", "Файл готов к замене Ассистентом", () => scrollToSection('executor'), <FaCheck className="text-green-400"/>, true, true, '', true); }
                 addSuggestion("goto-status", "К Статусу Замены", () => scrollToSection('executor'), <FaEye />, true, false, '', true);
                 return suggestionsList;
             }

             // --- Standard Workflow ---
             logger.debug("[Suggestion Calc] Standard Workflow");
             addSuggestion( 'toggle-settings', isSettingsModalOpen ? "Закрыть Настройки" : `Настройки (Цель: ${effectiveBranch})`, triggerToggleSettingsModal, <FaCodeBranch />, true, false, '', true );

             switch (currentStep) { // Use the destructured currentStep
                 case 'idle': // No fetch yet
                    addSuggestion("fetch-initial", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, repoUrlEntered, false, '', true);
                    break;
                 case 'ready_to_fetch':
                     addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, repoUrlEntered, false, '', true);
                     break;
                 case 'fetching': break; // Global loading indicator will show
                 case 'fetch_failed':
                     addSuggestion("retry-fetch", `Ошибка! Попробовать Снова${branchInfo}?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight className="text-red-400"/>, true, false, '', true);
                     break;
                 case 'files_fetched': // Files loaded, no highlights or selection yet
                     addSuggestion("goto-files", `К Списку Файлов (${allFetchedFiles.length})`, () => scrollToSection('file-list-container'), <FaEye />, filesFetched, false, '', true);
                     // Suggest writing prompt if input is empty
                     if(!kworkInputHasContent) addSuggestion("goto-kwork-empty", "Написать Запрос AI?", () => scrollToSection('kwork-input-section'), <FaKeyboard />, filesFetched, false, '', true);
                     break;
                 case 'files_fetched_highlights': {
                     addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />, true, false, '', true);
                     addSuggestion("goto-files", `К Списку Файлов (${allFetchedFiles.length})`, () => scrollToSection('file-list-container'), <FaEye />, true, false, '', true);
                     if(selectedFetcherFiles.size > 0) addSuggestion("add-selected", `Добавить Выбранные (${selectedFetcherFiles.size})`, () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса", true);
                     if(!kworkInputHasContent) addSuggestion("goto-kwork-empty", "Написать Запрос AI?", () => scrollToSection('kwork-input-section'), <FaKeyboard />, filesFetched, false, '', true);
                     break;
                 }
                 case 'files_selected':
                    addSuggestion("add-selected", `Добавить Выбранные (${selectedFetcherFiles.size})`, () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса", true);
                    if(!kworkInputHasContent) addSuggestion("goto-kwork-empty", "Написать Запрос AI?", () => scrollToSection('kwork-input-section'), <FaKeyboard />, filesFetched, false, '', true);
                    else addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true, false, '', true);
                    break;
                 case 'request_written':
                     addSuggestion("copy-kwork", "Скопировать Запрос -> AI", triggerCopyKwork, <FaCopy />, kworkInputHasContent, false, '', true);
                     addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true, false, '', true);
                    break;
                 case 'request_copied':
                    addSuggestion("goto-ai-response", "К Полю Ответа AI", () => scrollToSection('response-input'), <FaArrowRight />, true, false, '', true);
                    addSuggestion("parse-response", "➡️ Вставил Ответ? Разбери!", triggerParseResponse, <FaWandMagicSparkles />, true, false, '', true);
                    break;
                 case 'response_pasted':
                     addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, false, '', true);
                     addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('response-input'), <FaKeyboard />, true, false, '', true);
                    break;
                 case 'parsing_response': break; // Global loading indicator
                 case 'pr_ready':
                     addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed, false, '', true);
                     addSuggestion("goto-assistant-files", "К Разобранным Файлам", () => scrollToSection('executor'), <FaEye />, true, false, '', true);
                     addSuggestion( targetBranchName ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, true, selectedAssistantFiles.size === 0, '', true); // Disable if no files selected
                     addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('pr-form-container'), <FaRocket />, true, false, '', true);
                     break;
                 default: break;
             }

            // --- Add Clear All if applicable ---
            const canClear = selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent || filesParsed;
            if (!imageReplaceTask && canClear) { addSuggestion("clear-all", "Очистить Все?", triggerClearKworkInput, <FaBroom/>, true, false, '', true); }

            // --- General Loading Indicator ---
             if (isAnyLoading && !suggestionsList.some(s => s.id.includes('loading') || s.id.includes('img-'))) {
                let loadingText = "Обработка...";
                if (isFetcherLoading) loadingText = `Загрузка${branchInfo}...`;
                else if (isParsing) loadingText = "Разбор ответа...";
                else if (isAiGenerating) loadingText = `Жду AI (${currentAiRequestId?.substring(0,6)}...)`;
                else if (assistantLoading) loadingText = "Работа с GitHub...";
                 addSuggestion("loading-indicator", loadingText, undefined, <FaSpinner className="animate-spin"/>, true, true, '', true);
             }

            return suggestionsList;
        };

        const newSuggestions = calculateSuggestions();
        logger.debug(`[AutomationBuddy Effect] Calculated ${newSuggestions.length} suggestions.`);
        setSuggestions(newSuggestions);
        logger.debug("[AutomationBuddy Effect] Calculating suggestions END");

    }, [ // Dependencies based on DIRECTLY destructured context values
        isMounted, currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, kworkInputValue,
        aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs, targetBranchName, manualBranchName,
        isSettingsModalOpen, isParsing, currentAiRequestId, imageReplaceTask, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, showComponents,
        // Stable Context Triggers (listed explicitly)
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, triggerClearKworkInput,
        logger // Logger assumed stable
    ]);


    // --- Suggestion Change Detection ---
    useEffect(() => {
        if (!isMounted || isOpen) { if (isOpen) logger.debug("[AutomationBuddy Effect] Suggestion Change - Resetting notification (buddy open)"); setHasNewSuggestions(false); return; }
        const currentIds = new Set(suggestions.map(s => s.id)); const prevIds = previousSuggestionIds.current;
        const meaningfulChange = ![...currentIds].every(id => prevIds.has(id)) || ![...prevIds].every(id => currentIds.has(id));
        if (meaningfulChange && !suggestions.every(s => s.id.includes('loading') || s.id.includes('img-'))) { setHasNewSuggestions(true); logger.info("[AutomationBuddy Effect] New suggestions available!"); }
        previousSuggestionIds.current = currentIds;
    }, [isMounted, suggestions, isOpen, logger]);


    // --- Auto-open Timer ---
    useEffect(() => {
        let t: NodeJS.Timeout | null = null;
        if (isMounted && !hasAutoOpened && !isOpen) {
            const hasParams = searchParams.has("path") || searchParams.has("idea");
            const delayMs = hasParams ? AUTO_OPEN_DELAY_MS_BUDDY : AUTO_OPEN_DELAY_MS_BUDDY_SIMPLE_CASE;
            logger.log(`[AutomationBuddy Effect] Setting auto-open timer for ${delayMs}ms (hasParams: ${hasParams})`);
            t = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); logger.info(`[AutomationBuddy Effect] Auto-opened after ${delayMs}ms`); }, delayMs);
        }
        return () => { if (t) clearTimeout(t); };
    }, [isMounted, hasAutoOpened, isOpen, searchParams, logger]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((e:KeyboardEvent) => { if(e.key==='Escape'&&isOpen) { logger.debug("[AutomationBuddy CB] Escape key pressed, closing."); setIsOpen(false);} }, [isOpen, logger]);
    useEffect(() => { document.addEventListener('keydown',handleEscKey); return()=>{document.removeEventListener('keydown',handleEscKey);}; }, [handleEscKey]);

    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if(suggestion.disabled){ logger.debug(`[Buddy Click] Suggestion ${suggestion.id} clicked but disabled.`); return; }
        logger.info(`[Buddy Click] Suggestion clicked: ${suggestion.id}`);
        if(suggestion.action){
             const r=suggestion.action();
             if (!suggestion.id.startsWith('goto-') && !suggestion.id.includes('toggle-settings') && !suggestion.id.includes('retry-fetch') && suggestion.id !== 'img-replace-status') { logger.debug(`[Buddy Click] Closing buddy after action: ${suggestion.id}`); setIsOpen(false); }
             else if (suggestion.id.startsWith('goto-')) { logger.debug(`[Buddy Click] Delaying close for navigation: ${suggestion.id}`); setTimeout(() => setIsOpen(false), 300); }
             else { logger.debug(`[Buddy Click] Keeping buddy open for action: ${suggestion.id}`); }
             if(r instanceof Promise){ r.catch(err=>{logger.error(`[Buddy Click] Action (${suggestion.id}) failed:`, err); toastError(`Действие "${suggestion.text}" не удалось.`);});}
        } else { logger.debug(`[Buddy Click] No action for suggestion ${suggestion.id}, closing.`); setIsOpen(false); }
    };
    const handleOverlayClick = () => { logger.debug("[Buddy Click] Overlay clicked, closing."); setIsOpen(false); requestAnimationFrame(() => document.body.focus()); };
    const handleDialogClick = (e:React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => {
        logger.info(`[Buddy Click] FAB clicked. Current state: ${isOpen ? 'Open' : 'Closed'}`);
        setIsOpen(prev => { const nextOpen = !prev; if (!nextOpen) { requestAnimationFrame(() => document.body.focus()); } return nextOpen; });
        if(!isOpen){ logger.debug("[Buddy Click] FAB click opened buddy, resetting auto-open/notification."); setHasAutoOpened(true);setHasNewSuggestions(false);}
    };

    // --- Render Logic ---
    if (!isMounted) return null;

    logger.debug(`[AutomationBuddy Render] Final render. isOpen=${isOpen}, hasNewSuggestions=${hasNewSuggestions}`);
    try {
        return (
            <AnimatePresence>
                {isOpen ? (
                    <motion.div key="buddy-dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 bg-black bg-opacity-60 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-modal="true" role="dialog" aria-labelledby="buddy-suggestions-title" >
                        <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-end bg-transparent" onClick={handleDialogClick} >
                            <h2 id="buddy-suggestions-title" className="sr-only">Automation Buddy Suggestions</h2>
                            <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />
                            <div className="flex flex-col sm:flex-row-reverse items-center sm:items-end w-full gap-4 mt-2">
                                <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                                <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-end" />
                            </div>
                        </motion.div>
                    </motion.div>
                ) : (
                    <div className="fixed bottom-4 right-4 z-50">
                        <motion.div variants={fabVariants} initial="hidden" animate="visible" exit="exit" className="relative">
                             <FloatingActionButton onClick={handleFabClick} icon={<FaAngrycreative className="text-xl" />} className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl rounded-full" aria-label="Open Automation Buddy" />
                             <AnimatePresence> {hasNewSuggestions && ( <motion.div key="buddy-notification" variants={notificationVariants} initial="hidden" animate="visible" exit="exit" className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-gray-900 shadow-md" aria-hidden="true" > <FaExclamation className="text-white text-xs" /> </motion.div> )} </AnimatePresence>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        );
    } catch (renderError: any) {
        logger.fatal("[AutomationBuddy] CRITICAL RENDER ERROR:", renderError);
        return <div className="fixed bottom-4 right-4 w-12 h-12 rounded-full bg-red-700 flex items-center justify-center text-white z-50" title={`Buddy Error: ${renderError.message}`}><FaBug /></div>;
    } finally {
         logger.log("[AutomationBuddy] END Render");
    }
};
export default AutomationBuddy;