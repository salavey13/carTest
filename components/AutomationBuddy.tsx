"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
// Removed direct sonner import import { toast } from "sonner";
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
const AUTO_OPEN_DELAY_MS_BUDDY_SIMPLE_CASE = 42000; // Keep this distinction
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
    logger.debug("[AutomationBuddy] Rendering");
    // --- State ---
    const [isMounted, setIsMounted] = useState(false); // Keep isMounted for client-side logic
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
    const previousSuggestionIds = useRef<Set<string>>(new Set());
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

    // --- Hooks ---
    const searchParams = useSearchParams();
    const { error: toastError } = useAppToast(); // Get toast hook function

    // --- Context ---
    const {
        // States
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, manualBranchName, isSettingsModalOpen, isParsing,
        currentAiRequestId, imageReplaceTask, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, // Get highlight info

        // Triggers
        triggerFetch = () => logger.warn("[Buddy] triggerFetch not available"),
        triggerSelectHighlighted = () => logger.warn("[Buddy] triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = async () => logger.warn("[Buddy] triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => { logger.warn("[Buddy] triggerCopyKwork not available"); return false; },
        triggerAskAi = async () => { logger.warn("[Buddy] triggerAskAi not available"); return { success: false, error: "Context unavailable" }; },
        triggerParseResponse = async () => logger.warn("[Buddy] triggerParseResponse not available"),
        triggerSelectAllParsed = () => logger.warn("[Buddy] triggerSelectAllParsed not available"),
        triggerCreateOrUpdatePR = async () => logger.warn("[Buddy] triggerCreateOrUpdatePR not available"),
        triggerToggleSettingsModal = () => logger.warn("[Buddy] triggerToggleSettingsModal not available"),
        scrollToSection = () => logger.warn("[Buddy] scrollToSection not available"),

        // Refs
        fetcherRef,

    } = useRepoXmlPageContext();
    logger.debug(`[AutomationBuddy] Context State: currentStep=${currentStep}, fetchStatus=${fetchStatus}, imageTask=${!!imageReplaceTask}`);

    // --- Effects ---
    useEffect(() => {
        setIsMounted(true);
        logger.debug("[AutomationBuddy Effect] Mounted");
     }, []);

    // --- Get Active Message (NEW VIBE LOGIC) ---
    const activeMessage = useMemo(() => {
        logger.debug(`[AutomationBuddy Memo] Calculating activeMessage. currentStep=${currentStep}, fetchStatus=${fetchStatus}`);
        if (!isMounted) return "Загрузка Бадди...";

        // --- Level 1 Task: Image Replacement ---
        if (imageReplaceTask) {
            if (fetchStatus === 'loading' || fetchStatus === 'retrying') return "Гружу файл для замены картинки...";
            if (fetchStatus === 'error' || fetchStatus === 'failed_retries') return "Опа! Не смог загрузить файл для замены. Проверь URL/ветку и жми 'Попробовать Снова'.";
            const targetFileExists = allFetchedFiles?.some(f => f.path === imageReplaceTask.targetPath);
            if (fetchStatus === 'success' && !targetFileExists && filesFetched) return "Файл для замены не найден в репе! Проверь путь/ветку.";
            if (fetchStatus === 'success' && targetFileExists) {
                if (assistantLoading) return "Меняю картинку и делаю PR... Магия в процессе!";
                return "Файл загружен! Сейчас Ассистент заменит картинку и создаст PR автоматом.";
            }
            return "Готовлюсь к замене картинки..."; // Default for image task
        }

        // --- Standard Levels & Vibe Philosophy ---
        switch (currentStep) {
            case 'idle': return "Введи URL репы GitHub или найди баг/идею на странице и скажи мне!";
            case 'ready_to_fetch': return "Окей, URL есть. Жми 'Извлечь Файлы', чтобы я загрузил код для AI.";
            case 'fetching': return `Качаю файлы из ветки (${manualBranchName.trim() || targetBranchName || 'default'})... Дай мне секунду.`;
            case 'fetch_failed': return "Бл*ть, не смог скачать файлы. Сеть? Права? URL? Попробуй еще раз.";
            case 'files_fetched': return "Файлы загружены! Можешь выбрать нужные вручную или сразу дать AI общую идею.";
            case 'files_fetched_highlights': return "Нашел связанные файлы (компоненты, хуки)! Выбери их (+1 Vibe Perk!) или добавь в запрос (+), чтобы AI точно понял контекст.";
            case 'files_selected': return `Выбрано ${selectedFetcherFiles.size} файлов. Добавь их в запрос (+) или сразу проси AI их обработать (с добавл.).`;
            case 'request_written': return "Запрос готов! Можешь скопировать его или сразу отправить AI на обработку.";
            case 'request_copied': return "Запрос скопирован. Теперь вставляй его в AI (ChatGPT, Gemini...) и жди ответ. Потом вставь ответ в поле ниже.";
            case 'generating_ai_response':
                if (aiActionLoading) return `Жду ответ от AI... (ID: ${currentAiRequestId?.substring(0,6)}...)`;
                if (assistantLoading) return "Обрабатываю ответ AI / Создаю или обновляю PR... Почти готово!";
                return "Обработка..."; // Fallback
            case 'response_pasted': return "Ответ AI получен! Жми '➡️', чтобы я его разобрал по файлам и проверил.";
            case 'parsing_response': return "Разбираю ответ AI на файлы... Проверяю код...";
            case 'response_parsed': // Fallthrough to 'pr_ready'
            case 'pr_ready':
                 if (selectedAssistantFiles.size === 0) return "Файлы разобраны! Теперь выбери, какие из них включить в PR/обновление.";
                 return `Выбрано ${selectedAssistantFiles.size} файлов для ${targetBranchName ? 'обновления ветки' : 'создания PR'}. Жми кнопку ниже!`;
            default: return "Готов к вайбу! Что будем делать?";
        }
    }, [
        isMounted, currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles.size, aiResponseHasContent, filesParsed, assistantLoading, aiActionLoading,
        loadingPrs, targetBranchName, manualBranchName, currentAiRequestId, imageReplaceTask,
        allFetchedFiles, // Need this for image task check
    ]);


    // --- Calculate Suggestions (NEW VIBE LOGIC) ---
    useEffect(() => {
        logger.debug("[AutomationBuddy Effect] Calculating suggestions START");
        if (!isMounted) { logger.debug("[AutomationBuddy Effect] Skipping suggestion calc (not mounted)"); setSuggestions([]); return; }

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

            const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
                if (condition) {
                    let isDisabled = disabled || isAnyLoading; // Start with general loading disable
                    logger.debug(`[Suggestion Add] ID: ${id}, Initial Disabled: ${isDisabled}`);
                    // Specific overrides/checks
                    if (['fetch', 'retry-fetch', 'retry-fetch-img', 'clear-all'].includes(id)) isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating;
                    if (id.includes('ask-ai')) isDisabled = disabled || isAiGenerating;
                    if (id === 'parse-response') isDisabled = disabled || isParsing || isAiGenerating || !aiResponseHasContent; // Disable if no response
                    if (id === 'create-pr' || id === 'update-branch') isDisabled = disabled || isAssistantProcessing || selectedAssistantFiles.size === 0; // Disable if no files selected
                    if (id.includes('toggle-settings')) isDisabled = disabled || isAssistantProcessing || isAiGenerating; // Settings allowed unless Assistant/AI busy
                    const hasAnyHighlights = !!primaryHighlightedPath || Object.values(secondaryHighlightedPaths).some(arr => arr.length > 0);
                    if (id === 'select-highlighted') {
                         isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || !hasAnyHighlights;
                         if (!hasAnyHighlights) tooltip = "Нет связанных файлов для выбора";
                    }
                    if (id === 'add-selected') isDisabled = disabled || isFetcherLoading || isAssistantProcessing || isAiGenerating || selectedFetcherFiles.size === 0;
                    if (id.includes('ask-ai') && id !== 'ask-ai-empty') isDisabled = isDisabled || selectedFetcherFiles.size === 0; // Needs selection if not empty ask

                    logger.debug(`[Suggestion Add] ID: ${id}, Final Disabled: ${isDisabled}, Tooltip: ${tooltip}`);
                    suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
                } else {
                     logger.debug(`[Suggestion Add] ID: ${id} skipped (condition false)`);
                }
            };

            // --- Image Replace Task Flow ---
             if (imageReplaceTask) {
                 logger.debug("[Suggestion Calc] Image Task Flow");
                 const targetFileExists = filesFetched && allFetchedFiles?.some(f => f.path === imageReplaceTask.targetPath);
                 const isErrorState = fetchStatus === 'error' || fetchStatus === 'failed_retries' || (fetchStatus === 'success' && !targetFileExists && filesFetched);

                 addSuggestion( 'toggle-settings', isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка)", triggerToggleSettingsModal, <FaCodeBranch />, true, assistantLoading );

                 if (isErrorState) {
                     addSuggestion("retry-fetch-img", `Ошибка! Попробовать Загрузить Снова?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight className="text-red-400"/>, true);
                 } else if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                     addSuggestion("img-loading", "Загрузка Файла...", () => {}, <FaSpinner className="animate-spin text-blue-400"/>, true, true);
                 } else if (assistantLoading) {
                     addSuggestion("img-processing", "Замена и PR/Обновление...", () => {}, <FaSpinner className="animate-spin text-purple-400"/>, true, true);
                 } else if (fetchStatus === 'success' && targetFileExists) {
                     addSuggestion("img-ready", "Файл готов к замене Ассистентом", () => scrollToSection('executor'), <FaCheck className="text-green-400"/>, true, true); // Mostly indicates status
                 }
                 addSuggestion("goto-status", "К Статусу Замены", () => scrollToSection('executor'), <FaEye />, true);
                 return suggestionsList;
             }

             // --- Standard Workflow ---
             logger.debug("[Suggestion Calc] Standard Workflow");
             addSuggestion( 'toggle-settings', isSettingsModalOpen ? "Закрыть Настройки" : `Настройки (Цель: ${effectiveBranch})`, triggerToggleSettingsModal, <FaCodeBranch />, true );

             switch (currentStep) {
                 case 'ready_to_fetch':
                     addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, repoUrlEntered);
                     break;
                 case 'fetching': /* Loading indicator handled by general logic */ break;
                 case 'fetch_failed':
                     addSuggestion("retry-fetch", `Ошибка! Попробовать Снова${branchInfo}?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight className="text-red-400"/>, true);
                     break;
                 case 'files_fetched':
                     addSuggestion("goto-files", `К Списку Файлов (${allFetchedFiles.length})`, () => scrollToSection('file-list-container'), <FaEye />, filesFetched);
                     // Removed "Ask AI empty" - user should add context or write request first
                     break;
                 case 'files_fetched_highlights': {
                     const hasHighlights = !!(primaryHighlightedPath || Object.values(secondaryHighlightedPaths).flat().length > 0);
                     addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />, true); // Disable handled by addSuggestion
                     addSuggestion("goto-files", `К Списку Файлов (${allFetchedFiles.length})`, () => scrollToSection('file-list-container'), <FaEye />, true);
                     addSuggestion("add-selected", `Добавить Выбранные (${selectedFetcherFiles.size})`, () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса"); // Disable handled by addSuggestion
                     // Removed "Ask AI highlights" - force adding context first
                     break;
                 }
                 case 'files_selected':
                    addSuggestion("add-selected", `Добавить Выбранные (${selectedFetcherFiles.size})`, () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса"); // Disable handled by addSuggestion
                    // Removed "Ask AI selected" - force adding context first
                    addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true);
                    break;
                 case 'request_written':
                     addSuggestion("copy-kwork", "Скопировать Запрос -> AI", triggerCopyKwork, <FaCopy />, kworkInputHasContent);
                     addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true);
                     break;
                 case 'request_copied': // User needs to paste response
                    addSuggestion("goto-ai-response", "К Полю Ответа AI", () => scrollToSection('response-input'), <FaArrowRight />, true);
                    addSuggestion("parse-response", "➡️ Вставил Ответ? Разбери!", triggerParseResponse, <FaWandMagicSparkles />, true); // Disable handled by addSuggestion
                    break;
                 case 'response_pasted': // Response is pasted, ready to parse
                     addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true); // Disable handled by addSuggestion
                     addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('response-input'), <FaKeyboard />, true);
                    break;
                 case 'parsing_response': /* Loading indicator handled by general logic */ break;
                 case 'response_parsed': // Fallthrough intended
                 case 'pr_ready':
                     addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                     addSuggestion("goto-assistant-files", "К Разобранным Файлам", () => scrollToSection('executor'), <FaEye />, true);
                     addSuggestion( targetBranchName ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, true); // Disable handled by addSuggestion
                     addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('pr-form-container'), <FaRocket />, true);
                     break;
                 default: break;
             }

            // --- Add Clear All if applicable ---
            const canClear = selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent || filesParsed;
            if (!imageReplaceTask && canClear && fetcherRef?.current?.clearAll) {
                addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaBroom/>, true);
            }

             // --- General Loading Indicator ---
             if (isAnyLoading && !suggestionsList.some(s => s.id.includes('loading') || s.id.includes('img-'))) {
                let loadingText = "Обработка...";
                if (isFetcherLoading) loadingText = `Загрузка${branchInfo}...`;
                else if (isParsing) loadingText = "Разбор ответа...";
                else if (aiActionLoading) loadingText = `Жду AI (${currentAiRequestId?.substring(0,6)}...)`;
                else if (assistantLoading) loadingText = "Работа с GitHub...";
                 addSuggestion("loading-indicator", loadingText, () => {}, <FaSpinner className="animate-spin"/>, true, true);
             }


            return suggestionsList;
        };

        const newSuggestions = calculateSuggestions();
        logger.debug(`[AutomationBuddy Effect] Calculated ${newSuggestions.length} suggestions.`);
        setSuggestions(newSuggestions);
        logger.debug("[AutomationBuddy Effect] Calculating suggestions END");

    }, [
        isMounted, currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs, targetBranchName, manualBranchName, isSettingsModalOpen, isParsing, currentAiRequestId, imageReplaceTask, allFetchedFiles, primaryHighlightedPath, secondaryHighlightedPaths, // State dependencies
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerToggleSettingsModal, scrollToSection, fetcherRef // Context triggers & Ref
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
    }, [isMounted, suggestions, isOpen]);


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
    }, [isMounted, hasAutoOpened, isOpen, searchParams]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((e:KeyboardEvent) => { if(e.key==='Escape'&&isOpen) { logger.debug("[AutomationBuddy CB] Escape key pressed, closing."); setIsOpen(false);} }, [isOpen]);
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

    logger.debug(`[AutomationBuddy Render] Final render. isOpen=${isOpen}, hasNewSuggestions=${hasNewSuggestions}`);
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
};
export default AutomationBuddy;