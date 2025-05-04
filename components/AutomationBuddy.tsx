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
import { debugLogger as logger } from '@/lib/debugLogger'; // Use logger
import { useAppToast } from "@/hooks/useAppToast"; // Use toast hook

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS_BUDDY = 4000;
const AUTO_OPEN_DELAY_MS_BUDDY_SIMPLE_CASE = 42000;
const BUDDY_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const BUDDY_ALT_TEXT = "Automation Buddy";

interface Suggestion {
    id: string;
    text: string;
    action?: () => void | Promise<void>;
    icon?: React.ReactNode;
    isHireMe?: boolean;
    isFixAction?: boolean;
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
    logger.log("[AutomationBuddy] START Render"); // ADDED Log
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
    const {
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, manualBranchName, isSettingsModalOpen, isParsing,
        currentAiRequestId, imageReplaceTask, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths,
        showComponents, // <<< Get showComponents state
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed,
        triggerCreateOrUpdatePR, triggerToggleSettingsModal, scrollToSection,
        triggerClearKworkInput, getXuinityMessage
    } = context;
    logger.debug(`[AutomationBuddy] Context State Read: currentStep=${currentStep}, fetchStatus=${fetchStatus}, imageTask=${!!imageReplaceTask}, showComponents=${showComponents}`);

    // --- Effects ---
    useEffect(() => {
        setIsMounted(true);
        logger.debug("[AutomationBuddy Effect] Mounted");
     }, []);

    // --- Get Active Message (Uses stable function from context) ---
    const activeMessage = useMemo(() => {
        logger.debug(`[AutomationBuddy Memo] Calculating activeMessage. Using getXuinityMessage from context.`);
        if (!isMounted) return "Загрузка Бадди...";
        // Ensure the function exists before calling - defensive check
        return typeof getXuinityMessage === 'function' ? getXuinityMessage() : "Ошибка получения статуса...";
    }, [isMounted, getXuinityMessage]); // Dependency is the stable function itself


    // --- Calculate Suggestions (Uses stable functions from context) ---
    useEffect(() => {
        logger.debug("[AutomationBuddy Effect] Calculating suggestions START");
        if (!isMounted || typeof triggerFetch !== 'function') { // Added check for core trigger function availability
            logger.warn("[AutomationBuddy Effect] Skipping suggestion calc (not mounted or context triggers not ready)");
            setSuggestions([]);
            return;
        }

        // Read current state values inside the effect for safety
        const currentContextState = {
            currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles,
            kworkInputHasContent, aiResponseHasContent, filesParsed, selectedAssistantFiles,
            assistantLoading, aiActionLoading, loadingPrs, targetBranchName, manualBranchName,
            isSettingsModalOpen, isParsing, currentAiRequestId, imageReplaceTask, allFetchedFiles,
            primaryHighlightedPath, secondaryHighlightedPaths,
            showComponents // <<< Read showComponents state
        };

        const calculateSuggestions = (): Suggestion[] => {
            const {
                currentStep: step, fetchStatus: status, repoUrlEntered: urlEntered, filesFetched: fetched,
                selectedFetcherFiles: selectedFetch, kworkInputHasContent: kworkContent, aiResponseHasContent: aiContent,
                filesParsed: parsed, selectedAssistantFiles: selectedAssist, assistantLoading: assistLoading,
                aiActionLoading: aiLoading, loadingPrs: prsLoading, targetBranchName: targetBranch,
                manualBranchName: manualBranch, isSettingsModalOpen: settingsOpen, isParsing: parsing,
                currentAiRequestId: reqId, imageReplaceTask: task, allFetchedFiles: allFiles,
                primaryHighlightedPath: primaryHighlight, secondaryHighlightedPaths: secondaryHighlights,
                showComponents: componentsVisible // <<< Use local copy of showComponents
            } = currentContextState; // Use local copy

            const suggestionsList: Suggestion[] = [];
            const isFetcherLoading = status === 'loading' || status === 'retrying';
            const isAssistantProcessing = assistLoading || parsing;
            const isAiGenerating = aiLoading && !!reqId;
            const isAnyLoading = isFetcherLoading || isAssistantProcessing || isAiGenerating || prsLoading;
            const effectiveBranch = manualBranch.trim() || targetBranch || 'default';
            const branchInfo = effectiveBranch === 'default' ? '' : ` (${effectiveBranch})`;
            const createOrUpdateActionText = targetBranch ? `Обновить Ветку '${targetBranch}'` : "Создать PR";
            const createOrUpdateIcon = targetBranch ? <FaCodeBranch /> : <FaGithub />;
            const hasAnyHighlights = !!primaryHighlight || Object.values(secondaryHighlights).some(arr => arr.length > 0);

            // Only show component-dependent actions if components are visible
            const canShowComponentActions = componentsVisible;

            const addSuggestion = (id: string, text: string, action: (() => any) | undefined, icon: React.ReactNode, condition = true, disabled = false, tooltip = '', requiresComponents = false) => {
                // Ensure action is a function if provided
                const safeAction = typeof action === 'function' ? action : () => logger.warn(`No action defined for suggestion ID: ${id}`);

                // Check component visibility requirement
                if (requiresComponents && !canShowComponentActions) {
                    condition = false;
                }

                if (condition) {
                    let isDisabled = disabled || isAnyLoading;
                    // Specific overrides
                    if (['fetch', 'retry-fetch', 'retry-fetch-img', 'clear-all'].includes(id)) isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating;
                    if (id.includes('ask-ai')) isDisabled = disabled || isAiGenerating;
                    if (id === 'parse-response') isDisabled = disabled || parsing || isAiGenerating || !aiContent;
                    if (id === 'create-pr' || id === 'update-branch') isDisabled = disabled || isAssistantProcessing || selectedAssist.size === 0;
                    if (id.includes('toggle-settings')) isDisabled = disabled || isAssistantProcessing || isAiGenerating;
                    if (id === 'select-highlighted') {
                         isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || !hasAnyHighlights;
                         if (!hasAnyHighlights) tooltip = "Нет связанных файлов для выбора";
                    }
                    if (id === 'add-selected') isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || selectedFetch.size === 0;
                    if (id.includes('ask-ai') && id !== 'ask-ai-empty') isDisabled = isDisabled || selectedFetch.size === 0;

                    suggestionsList.push({ id, text, action: safeAction, icon, disabled: isDisabled, tooltip });
                }
            };

            // --- Image Replace Task Flow ---
             if (task) {
                 logger.debug("[Suggestion Calc] Image Task Flow");
                 const targetFileExists = fetched && allFiles?.some(f => f.path === task.targetPath);
                 const isErrorState = status === 'error' || status === 'failed_retries' || (status === 'success' && !targetFileExists && fetched);

                 addSuggestion( 'toggle-settings', settingsOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка)", triggerToggleSettingsModal, <FaCodeBranch />, true, assistLoading, '', true ); // Requires components

                 if (isErrorState) {
                     addSuggestion("retry-fetch-img", `Ошибка! Попробовать Загрузить Снова?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight className="text-red-400"/>, true, false, '', true); // Requires components
                 } else if (status === 'loading' || status === 'retrying') {
                     addSuggestion("img-loading", "Загрузка Файла...", undefined, <FaSpinner className="animate-spin text-blue-400"/>, true, true, '', true); // Requires components
                 } else if (assistLoading) {
                     addSuggestion("img-processing", "Замена и PR/Обновление...", undefined, <FaSpinner className="animate-spin text-purple-400"/>, true, true, '', true); // Requires components
                 } else if (status === 'success' && targetFileExists) {
                     addSuggestion("img-ready", "Файл готов к замене Ассистентом", () => scrollToSection('executor'), <FaCheck className="text-green-400"/>, true, true, '', true); // Requires components
                 }
                 addSuggestion("goto-status", "К Статусу Замены", () => scrollToSection('executor'), <FaEye />, true, false, '', true); // Requires components
                 return suggestionsList;
             }

             // --- Standard Workflow ---
             logger.debug("[Suggestion Calc] Standard Workflow");
             addSuggestion( 'toggle-settings', settingsOpen ? "Закрыть Настройки" : `Настройки (Цель: ${effectiveBranch})`, triggerToggleSettingsModal, <FaCodeBranch />, true, false, '', true ); // Requires components

             switch (step) {
                 case 'ready_to_fetch':
                     addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, urlEntered, false, '', true); // Requires components
                     break;
                 case 'fetching': break; // Loading handled globally
                 case 'fetch_failed':
                     addSuggestion("retry-fetch", `Ошибка! Попробовать Снова${branchInfo}?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight className="text-red-400"/>, true, false, '', true); // Requires components
                     break;
                 case 'files_fetched':
                     addSuggestion("goto-files", `К Списку Файлов (${allFiles.length})`, () => scrollToSection('file-list-container'), <FaEye />, fetched, false, '', true); // Requires components
                     break;
                 case 'files_fetched_highlights': {
                     addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />, true, false, '', true); // Requires components
                     addSuggestion("goto-files", `К Списку Файлов (${allFiles.length})`, () => scrollToSection('file-list-container'), <FaEye />, true, false, '', true); // Requires components
                     addSuggestion("add-selected", `Добавить Выбранные (${selectedFetch.size})`, () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса", true); // Requires components
                     break;
                 }
                 case 'files_selected':
                    addSuggestion("add-selected", `Добавить Выбранные (${selectedFetch.size})`, () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса", true); // Requires components
                    addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true, false, '', true); // Requires components
                    break;
                 case 'request_written':
                     addSuggestion("copy-kwork", "Скопировать Запрос -> AI", triggerCopyKwork, <FaCopy />, kworkContent, false, '', true); // Requires components
                     addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true, false, '', true); // Requires components
                    break;
                 case 'request_copied':
                    addSuggestion("goto-ai-response", "К Полю Ответа AI", () => scrollToSection('response-input'), <FaArrowRight />, true, false, '', true); // Requires components
                    addSuggestion("parse-response", "➡️ Вставил Ответ? Разбери!", triggerParseResponse, <FaWandMagicSparkles />, true, false, '', true); // Requires components
                    break;
                 case 'response_pasted':
                     addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, false, '', true); // Requires components
                     addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('response-input'), <FaKeyboard />, true, false, '', true); // Requires components
                    break;
                 case 'parsing_response': break; // Loading handled globally
                 case 'pr_ready':
                     addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, parsed, false, '', true); // Requires components
                     addSuggestion("goto-assistant-files", "К Разобранным Файлам", () => scrollToSection('executor'), <FaEye />, true, false, '', true); // Requires components
                     addSuggestion( targetBranch ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, true, false, '', true); // Requires components
                     addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('pr-form-container'), <FaRocket />, true, false, '', true); // Requires components
                     break;
                 default: break;
             }

            // --- Add Clear All if applicable ---
            const canClear = selectedFetch.size > 0 || kworkContent || aiContent || parsed;
            if (!task && canClear) {
                addSuggestion("clear-all", "Очистить Все?", triggerClearKworkInput, <FaBroom/>, true, false, '', true); // Requires components
            }

             // --- General Loading Indicator ---
             if (isAnyLoading && !suggestionsList.some(s => s.id.includes('loading') || s.id.includes('img-'))) {
                let loadingText = "Обработка...";
                if (isFetcherLoading) loadingText = `Загрузка${branchInfo}...`;
                else if (parsing) loadingText = "Разбор ответа...";
                else if (aiLoading) loadingText = `Жду AI (${reqId?.substring(0,6)}...)`;
                else if (assistLoading) loadingText = "Работа с GitHub...";
                 addSuggestion("loading-indicator", loadingText, undefined, <FaSpinner className="animate-spin"/>, true, true, '', true); // Requires components (it relates to them)
             }


            return suggestionsList;
        };

        const newSuggestions = calculateSuggestions();
        logger.debug(`[AutomationBuddy Effect] Calculated ${newSuggestions.length} suggestions.`);
        setSuggestions(newSuggestions);
        logger.debug("[AutomationBuddy Effect] Calculating suggestions END");

    }, [
        isMounted, // Standard mount check
        // Context State Values (read inside the effect)
        currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles,
        kworkInputHasContent, aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs, targetBranchName, manualBranchName,
        isSettingsModalOpen, isParsing, currentAiRequestId, imageReplaceTask, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, showComponents, // <<< Added showComponents
        // Context Triggers (stable references from context)
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, triggerClearKworkInput,
        logger // Added logger
    ]);

    // --- Suggestion Change Detection ---
    useEffect(() => {
        if (!isMounted || isOpen) {
            if (isOpen) logger.debug("[AutomationBuddy Effect] Suggestion Change - Resetting notification (buddy open)");
            setHasNewSuggestions(false);
            return;
        }
        const currentIds = new Set(suggestions.map(s => s.id));
        const prevIds = previousSuggestionIds.current;
        const meaningfulChange = ![...currentIds].every(id => prevIds.has(id)) || ![...prevIds].every(id => currentIds.has(id));
        if (meaningfulChange && !suggestions.every(s => s.id.includes('loading') || s.id.includes('img-'))) {
             setHasNewSuggestions(true);
             logger.info("[AutomationBuddy Effect] New suggestions available!");
        }
        previousSuggestionIds.current = currentIds;
    }, [isMounted, suggestions, isOpen, logger]); // Added logger


    // --- Auto-open Timer ---
    useEffect(() => {
        let t: NodeJS.Timeout | null = null;
        if (isMounted && !hasAutoOpened && !isOpen) {
            const hasParams = searchParams.has("path") || searchParams.has("idea");
            const delayMs = hasParams ? AUTO_OPEN_DELAY_MS_BUDDY : AUTO_OPEN_DELAY_MS_BUDDY_SIMPLE_CASE;
            logger.log(`[AutomationBuddy Effect] Setting auto-open timer for ${delayMs}ms (hasParams: ${hasParams})`);
            t = setTimeout(() => {
                setIsOpen(true);
                setHasAutoOpened(true);
                logger.info(`[AutomationBuddy Effect] Auto-opened after ${delayMs}ms`);
            }, delayMs);
        }
        return () => { if (t) clearTimeout(t); };
    }, [isMounted, hasAutoOpened, isOpen, searchParams, logger]); // Added logger

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((e:KeyboardEvent) => { if(e.key==='Escape'&&isOpen) { logger.debug("[AutomationBuddy CB] Escape key pressed, closing."); setIsOpen(false);} }, [isOpen, logger]); // Added logger
    useEffect(() => { document.addEventListener('keydown',handleEscKey); return()=>{document.removeEventListener('keydown',handleEscKey);}; }, [handleEscKey]);

    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if(suggestion.disabled){ logger.debug(`[Buddy Click] Suggestion ${suggestion.id} clicked but disabled.`); return; }
        logger.info(`[Buddy Click] Suggestion clicked: ${suggestion.id}`);
        if(suggestion.action){
             const r=suggestion.action();
             // Keep open for navigation, settings, retry actions
             if (!suggestion.id.startsWith('goto-') && !suggestion.id.includes('toggle-settings') && !suggestion.id.includes('retry-fetch') && suggestion.id !== 'img-replace-status') {
                 logger.debug(`[Buddy Click] Closing buddy after action: ${suggestion.id}`);
                 setIsOpen(false);
             } else if (suggestion.id.startsWith('goto-')) {
                  logger.debug(`[Buddy Click] Delaying close for navigation: ${suggestion.id}`);
                  setTimeout(() => setIsOpen(false), 300);
             } else {
                 logger.debug(`[Buddy Click] Keeping buddy open for action: ${suggestion.id}`);
             }
             if(r instanceof Promise){ r.catch(err=>{logger.error(`[Buddy Click] Action (${suggestion.id}) failed:`, err); toastError(`Действие "${suggestion.text}" не удалось.`);});}
        } else {
            logger.debug(`[Buddy Click] No action for suggestion ${suggestion.id}, closing.`);
            setIsOpen(false);
        }
    };
    const handleOverlayClick = () => { logger.debug("[Buddy Click] Overlay clicked, closing."); setIsOpen(false); requestAnimationFrame(() => document.body.focus()); };
    const handleDialogClick = (e:React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => {
        logger.info(`[Buddy Click] FAB clicked. Current state: ${isOpen ? 'Open' : 'Closed'}`);
        setIsOpen(prev => { const nextOpen = !prev; if (!nextOpen) { requestAnimationFrame(() => document.body.focus()); } return nextOpen; });
        if(!isOpen){ logger.debug("[Buddy Click] FAB click opened buddy, resetting auto-open/notification."); setHasAutoOpened(true);setHasNewSuggestions(false);}
    };

    // --- Render Logic ---
    if (!isMounted) return null; // Render nothing server-side or before mount

    // Log before final render
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