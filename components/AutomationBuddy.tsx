"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaArrowRotateRight, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowsRotate, FaAngrycreative, FaPoo,
    FaList, FaCodeBranch, FaExclamation, FaImages, FaSpinner, FaUpLong,
    FaAnglesDown, FaAnglesUp // Added for the new suggestion
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
import useInactivityTimer from "@/hooks/useInactivityTimer"; // Import the new hook

// --- Constants & Types ---
const INACTIVITY_TIMEOUT_MS = 60000; // 1 minute
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

interface AnimatedBuddyVisualProps {
    message: string;
    initialPos: { x: number; y: number };
    targetPos: { x: number; y: number };
}

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = {
    hidden: { scale: 0, opacity: 0, rotate: 45 },
    visible: {
        scale: 1,
        opacity: 1,
        rotate: 0,
        transition: { type: "spring", stiffness: 260, damping: 20 }
    },
    exit: { scale: 0, opacity: 0, rotate: -45, transition: { duration: 0.2 } }
};
const notificationVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } }, exit: { scale: 0, opacity: 0 } };

// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    logger.log("[AutomationBuddy] START Render");
    // --- State ---
    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const hasOpenedDueToInactivityRef = useRef(false);
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
    const previousSuggestionIds = useRef<Set<string>>(new Set());
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

    const animatedBuddyControls = useAnimationControls();
    const [animatedBuddyData, setAnimatedBuddyData] = useState<AnimatedBuddyVisualProps | null>(null);


    // --- Hooks ---
    const searchParams = useSearchParams(); 
    const { error: toastError } = useAppToast();

    // --- Context ---
    const context = useRepoXmlPageContext();
    const {
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, kworkInputValue,
        aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, manualBranchName, isSettingsModalOpen, isParsing,
        currentAiRequestId, imageReplaceTask, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, showComponents,
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed,
        triggerCreateOrUpdatePR, triggerToggleSettingsModal, scrollToSection,
        triggerClearKworkInput, getXuinityMessage,
        triggerToggleAllSectionsGlobally, // New context function
        sectionsCollapsed, // New context state
    } = context;
    logger.debug(`[AutomationBuddy] Context State Read: currentStep=${currentStep}, fetchStatus=${fetchStatus}, imageTask=${!!imageReplaceTask}, showComponents=${showComponents}, sectionsCollapsed=${sectionsCollapsed}`);

    // --- Effects ---
    useEffect(() => { setIsMounted(true); logger.debug("[AutomationBuddy Effect] Mounted"); }, []);

    // --- Inactivity Timer ---
    useInactivityTimer(
        INACTIVITY_TIMEOUT_MS,
        () => { 
            if (isMounted && !isOpen && !hasOpenedDueToInactivityRef.current && !animatedBuddyData) { // Don't auto-open if visual action is happening
                logger.log("[AutomationBuddy] Inactivity detected, auto-opening.");
                setIsOpen(true);
                hasOpenedDueToInactivityRef.current = true;
                setHasNewSuggestions(false); 
            }
        },
        undefined, 
        "AutomationBuddy"
    );
    
    const activeMessage = useMemo(() => {
        logger.debug(`[AutomationBuddy Memo] Calculating activeMessage.`);
        if (!isMounted) return "Загрузка Бадди...";
        if (animatedBuddyData) return animatedBuddyData.message; // Show action message if performing visual action
        if (typeof getXuinityMessage === 'function') {
            const message = getXuinityMessage();
            logger.debug(`[AutomationBuddy Memo] getXuinityMessage returned: "${message}"`);
            return message;
        }
        logger.error("[AutomationBuddy Memo] getXuinityMessage is not a function!");
        return "Ошибка получения статуса...";
    }, [isMounted, getXuinityMessage, animatedBuddyData]);

    // --- Quick Action Handler ---
    const handleQuickCollapseAll = async () => {
        logger.info("[AutomationBuddy] handleQuickCollapseAll triggered.");
        if (isOpen) setIsOpen(false); 
    
        await new Promise(resolve => setTimeout(resolve, isOpen ? 300 : 50)); // Ensure dialog is gone / allow UI to settle
    
        const fabContainer = document.getElementById("automation-buddy-fab-container");
        let initialX = window.innerWidth - 80; 
        let initialY = window.innerHeight - 100; 
        if (fabContainer) {
            const fabRect = fabContainer.getBoundingClientRect();
            initialX = fabRect.left + fabRect.width / 2 - 32; 
            initialY = fabRect.top + fabRect.height / 2 - 32; 
        }
    
        const collapseBtn = document.getElementById("master-toggle-sections-button");
        let targetX = 30; 
        let targetY = 80; 
        if (collapseBtn) {
            const btnRect = collapseBtn.getBoundingClientRect();
            targetX = btnRect.left + btnRect.width / 2 - 32; 
            targetY = btnRect.top + btnRect.height / 2 - 32; 
        }
        
        logger.debug(`QuickCollapse: Initial: (${initialX},${initialY}), Target: (${targetX},${targetY})`);
    
        const message = sectionsCollapsed ? "Раскрываю секции для тебя!" : "Сворачиваю секции для тебя!";
        setAnimatedBuddyData({
            message: message,
            initialPos: { x: initialX, y: initialY },
            targetPos: { x: targetX, y: targetY },
        });
    
        try {
            // Appear at initial position
            await animatedBuddyControls.start({
                x: initialX, y: initialY,
                opacity: 1, scale: 1,
                transition: { duration: 0.2, ease: "easeOut" }
            });
            // Move to target
            await animatedBuddyControls.start({
                x: targetX, y: targetY,
                transition: { type: "spring", stiffness: 110, damping: 18, duration: 0.7 }
            });
    
            if (typeof triggerToggleAllSectionsGlobally === 'function') {
                triggerToggleAllSectionsGlobally();
                logger.info("[AutomationBuddy] Collapse/Expand action triggered via context.");
            } else {
                logger.error("[AutomationBuddy] triggerToggleAllSectionsGlobally is not a function!");
            }
            
            // Hide
            await animatedBuddyControls.start({
                opacity: 0, scale: 0,
                transition: { delay: 0.4, duration: 0.3, ease: "easeIn" }
            });
        } catch (error) {
            logger.error("[AutomationBuddy] QuickCollapse animation sequence error:", error);
        } finally {
            setAnimatedBuddyData(null); // Cleanup visual effect state
        }
    };

    useEffect(() => {
        logger.debug("[AutomationBuddy Effect] Calculating suggestions START");
        if (!isMounted || typeof triggerFetch !== 'function') {
            logger.warn("[AutomationBuddy Effect] Skipping suggestion calc (not mounted or context triggers not ready)");
            setSuggestions([]); return;
        }

        const calculateSuggestions = (): Suggestion[] => {
            const suggestionsList: Suggestion[] = [];
            const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
            const isAssistantProcessing = assistantLoading || isParsing; 
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
                    let isDisabled = disabled || isAnyLoading || !!animatedBuddyData; // Disable if visual action is happening
                    if (['fetch', 'retry-fetch', 'retry-fetch-img'].includes(id)) isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || loadingPrs;
                    if (['add-selected', 'copy-kwork', 'clear-all'].includes(id)) isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || loadingPrs;
                    if (id.includes('ask-ai')) isDisabled = disabled || isAiGenerating;
                    if (id === 'parse-response') isDisabled = disabled || isParsing || isAiGenerating || !aiResponseHasContent;
                    if (id === 'create-pr' || id === 'update-branch') isDisabled = disabled || isAssistantProcessing || selectedAssistantFiles.size === 0;
                    if (id.includes('toggle-settings')) isDisabled = disabled || isAssistantProcessing || isAiGenerating || loadingPrs;
                    if (id === 'select-highlighted') { isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || !hasAnyHighlights; if (!hasAnyHighlights) tooltip = "Нет связанных файлов для выбора"; }
                    if (id === 'add-selected') isDisabled = disabled || selectedFetcherFiles.size === 0;
                    if (id === 'copy-kwork') isDisabled = disabled || !kworkInputHasContent; 
                    if (id === 'clear-all') isDisabled = disabled || (!selectedFetcherFiles.size && !kworkInputHasContent && !aiResponseHasContent && !filesParsed); 
                    if (id === 'quick-collapse-all') isDisabled = disabled || !showComponents; // Only if components are shown

                    suggestionsList.push({ id, text, action: safeAction, icon, disabled: isDisabled, tooltip });
                }
            };

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

             logger.debug("[Suggestion Calc] Standard Workflow");
             addSuggestion( 'toggle-settings', isSettingsModalOpen ? "Закрыть Настройки" : `Настройки (Цель: ${effectiveBranch})`, triggerToggleSettingsModal, <FaCodeBranch />, true, false, '', true );
            
             // Add the new collapse/expand suggestion
             if (showComponents) { // Only show if components area is visible
                const collapseSuggestionText = sectionsCollapsed ? "Развернуть инфо-секции?" : "Свернуть инфо-секции?";
                const collapseSuggestionIcon = sectionsCollapsed ? <FaAnglesUp /> : <FaAnglesDown />;
                addSuggestion("quick-collapse-all", collapseSuggestionText, handleQuickCollapseAll, collapseSuggestionIcon, true, false, "Позволь мне быстро свернуть/раскрыть инфо-секции");
             }


             switch (currentStep) { 
                 case 'idle': 
                    addSuggestion("fetch-initial", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, repoUrlEntered, false, '', true);
                    break;
                 case 'ready_to_fetch':
                     addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, repoUrlEntered, false, '', true);
                     break;
                 case 'fetching': break; 
                 case 'fetch_failed':
                     addSuggestion("retry-fetch", `Ошибка! Попробовать Снова${branchInfo}?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight className="text-red-400"/>, true, false, '', true);
                     break;
                 case 'files_fetched': 
                     addSuggestion("goto-files", `К Списку Файлов (${allFetchedFiles.length})`, () => scrollToSection('file-list-container'), <FaEye />, filesFetched, false, '', true);
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
                 case 'parsing_response': break; 
                 case 'pr_ready':
                     addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed, false, '', true);
                     addSuggestion("goto-assistant-files", "К Разобранным Файлам", () => scrollToSection('executor'), <FaEye />, true, false, '', true);
                     addSuggestion( targetBranchName ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, true, selectedAssistantFiles.size === 0, '', true); 
                     addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('pr-form-container'), <FaRocket />, true, false, '', true);
                     break;
                 default: break;
             }

            const canClear = selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent || filesParsed;
            if (!imageReplaceTask && canClear) { addSuggestion("clear-all", "Очистить Все?", triggerClearKworkInput, <FaBroom/>, true, false, '', true); }

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

    }, [ 
        isMounted, currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, kworkInputValue,
        aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs, targetBranchName, manualBranchName,
        isSettingsModalOpen, isParsing, currentAiRequestId, imageReplaceTask, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, showComponents,
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, triggerClearKworkInput,
        logger, sectionsCollapsed, animatedBuddyData // Added dependencies for new suggestion
    ]);

    useEffect(() => {
        if (!isMounted || isOpen || animatedBuddyData) { // Also don't show notification if visual action is happening
            if (isOpen || animatedBuddyData) logger.debug("[AutomationBuddy Effect] Suggestion Change - Resetting notification (buddy open or visual action)"); 
            setHasNewSuggestions(false); 
            return; 
        }
        const currentIds = new Set(suggestions.map(s => s.id)); const prevIds = previousSuggestionIds.current;
        const meaningfulChange = ![...currentIds].every(id => prevIds.has(id)) || ![...prevIds].every(id => currentIds.has(id));
        if (meaningfulChange && !suggestions.every(s => s.id.includes('loading') || s.id.includes('img-') || s.id === 'quick-collapse-all')) { 
            setHasNewSuggestions(true); 
            logger.info("[AutomationBuddy Effect] New suggestions available!"); 
        }
        previousSuggestionIds.current = currentIds;
    }, [isMounted, suggestions, isOpen, logger, animatedBuddyData]);

    const handleEscKey = useCallback((e:KeyboardEvent) => { 
        if(e.key==='Escape' && isOpen) { 
            logger.debug("[AutomationBuddy CB] Escape key pressed, closing dialog."); 
            setIsOpen(false);
        }
        // Note: Visual action buddy doesn't have an escape handler, it's too quick.
    }, [isOpen, logger]);
    useEffect(() => { document.addEventListener('keydown',handleEscKey); return()=>{document.removeEventListener('keydown',handleEscKey);}; }, [handleEscKey]);

    const handleSuggestionClick = (suggestion: Suggestion) => {
        if(suggestion.disabled){ logger.debug(`[Buddy Click] Suggestion ${suggestion.id} clicked but disabled.`); return; }
        logger.info(`[Buddy Click] Suggestion clicked: ${suggestion.id}`);
        if(suggestion.action){
             const r=suggestion.action();
             // For quick-collapse-all, the dialog is already handled by the action itself (setIsOpen(false))
             if (!suggestion.id.startsWith('goto-') && !suggestion.id.includes('toggle-settings') && !suggestion.id.includes('retry-fetch') && suggestion.id !== 'img-replace-status' && suggestion.id !== 'quick-collapse-all') { 
                 logger.debug(`[Buddy Click] Closing buddy after action: ${suggestion.id}`); 
                 setIsOpen(false); 
             }
             else if (suggestion.id.startsWith('goto-')) { 
                 logger.debug(`[Buddy Click] Delaying close for navigation: ${suggestion.id}`); 
                 setTimeout(() => setIsOpen(false), 300); 
             }
             else { logger.debug(`[Buddy Click] Keeping buddy open or action handles close: ${suggestion.id}`); }
             if(r instanceof Promise){ r.catch(err=>{logger.error(`[Buddy Click] Action (${suggestion.id}) failed:`, err); toastError(`Действие "${suggestion.text}" не удалось.`);});}
        } else { logger.debug(`[Buddy Click] No action for suggestion ${suggestion.id}, closing.`); setIsOpen(false); }
    };
    const handleOverlayClick = () => { if (!animatedBuddyData) { logger.debug("[Buddy Click] Overlay clicked, closing."); setIsOpen(false); requestAnimationFrame(() => document.body.focus()); }};
    const handleDialogClick = (e:React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => {
        if (animatedBuddyData) return; // Don't allow FAB click if visual action is in progress
        logger.info(`[Buddy Click] FAB clicked. Current state: ${isOpen ? 'Open' : 'Closed'}`);
        const newIsOpenState = !isOpen;
        setIsOpen(newIsOpenState);
        if (newIsOpenState) { 
            hasOpenedDueToInactivityRef.current = true; 
            setHasNewSuggestions(false);
        } else { 
            requestAnimationFrame(() => document.body.focus());
        }
    };

    if (!isMounted) return null;

    logger.debug(`[AutomationBuddy Render] Final render. isOpen=${isOpen}, hasNewSuggestions=${hasNewSuggestions}, animatedBuddyData=${!!animatedBuddyData}`);
    try {
        return (
            <>
                <AnimatePresence>
                    {isOpen && !animatedBuddyData && ( // Only show dialog if not doing visual action
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
                    )}
                </AnimatePresence>

                {!isOpen && !animatedBuddyData && ( // Only show FAB if dialog is closed and no visual action
                    <div className="fixed bottom-12 right-4 z-50">
                        <motion.div 
                            id="automation-buddy-fab-container"
                            variants={fabVariants} 
                            initial="hidden" 
                            animate="visible" 
                            exit="exit" 
                            className="relative"
                        >
                             <FloatingActionButton onClick={handleFabClick} icon={<FaAngrycreative className="text-xl" />} className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl rounded-full" aria-label="Open Automation Buddy" />
                             <AnimatePresence> {hasNewSuggestions && ( <motion.div key="buddy-notification" variants={notificationVariants} initial="hidden" animate="visible" exit="exit" className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-gray-900 shadow-md" aria-hidden="true" > <FaExclamation className="text-white text-xs" /> </motion.div> )} </AnimatePresence>
                        </motion.div>
                    </div>
                )}

                <AnimatePresence>
                    {animatedBuddyData && (
                        <motion.div
                            key="animated-buddy-visual"
                            className="fixed z-[60] flex flex-col items-center pointer-events-none"
                            style={{ 
                                x: animatedBuddyData.initialPos.x, 
                                y: animatedBuddyData.initialPos.y 
                            }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={animatedBuddyControls}
                        >
                            <img src={BUDDY_IMAGE_URL} alt="Action Buddy" className="w-16 h-16 rounded-full shadow-lg" />
                            <SpeechBubble 
                                message={animatedBuddyData.message} 
                                className="mt-1 text-xs p-1 px-2 shadow-md bg-card text-card-foreground rounded-md" // Ensure proper styling
                                bubblePosition="top" 
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </>
        );
    } catch (renderError: any) {
        logger.fatal("[AutomationBuddy] CRITICAL RENDER ERROR:", renderError);
        return <div className="fixed bottom-12 right-4 w-12 h-12 rounded-full bg-red-700 flex items-center justify-center text-white z-50" title={`Buddy Error: ${renderError.message}`}><FaBug /></div>;
    } finally {
         logger.log("[AutomationBuddy] END Render");
    }
};
export default AutomationBuddy;