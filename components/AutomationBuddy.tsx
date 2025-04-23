"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowRotateRight, FaArrowsRotate, FaAngrycreative, FaPoo,
    FaList, FaCodeBranch, FaExclamation, FaImages, FaSpinner // Added FaSpinner, FaImages
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Context Import
import { useRepoXmlPageContext, FetchStatus, WorkflowStep } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from '@/lib/debugLogger'; // Use debugLogger

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS_BUDDY = 4000;
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
// ... (Animation variants remain the same) ...
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, -15, 10, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0.8 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };
const notificationVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } }, exit: { scale: 0, opacity: 0 } };


// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
    const previousSuggestionIds = useRef<Set<string>>(new Set());

    // --- Context ---
    const {
        // States
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName,
        manualBranchName,
        isSettingsModalOpen,
        isParsing,
        currentAiRequestId,
        imageReplaceTask, // Get image replace task

        // Triggers
        triggerFetch = () => logger.warn("triggerFetch not available"),
        triggerSelectHighlighted = () => logger.warn("triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = async () => logger.warn("triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => logger.warn("triggerCopyKwork not available"),
        triggerAskAi = async () => { logger.warn("triggerAskAi not available"); return { success: false, error: "Context unavailable" }; },
        triggerParseResponse = async () => logger.warn("triggerParseResponse not available"),
        triggerSelectAllParsed = () => logger.warn("triggerSelectAllParsed not available"),
        triggerCreateOrUpdatePR = async () => logger.warn("triggerCreateOrUpdatePR not available"),
        triggerToggleSettingsModal = () => logger.warn("triggerToggleSettingsModal not available"),
        scrollToSection = () => logger.warn("scrollToSection not available"),

        // Messages
        getXuinityMessage: getBaseMessage,

        // Refs
        fetcherRef,

    } = useRepoXmlPageContext();

    // --- Get Active Message (Uses Context's getXuinityMessage) ---
    const activeMessage = useMemo(() => getBaseMessage(), [getBaseMessage]);

    // --- Define Suggestions (Updated for Image Replace) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
        // Combine all major loading states
        const isAnyLoading = isFetcherLoading || assistantLoading || aiActionLoading || loadingPrs || isParsing;
        const effectiveBranch = manualBranchName.trim() || targetBranchName;
        const branchInfo = effectiveBranch ? ` (${effectiveBranch})` : ' (default)';
        const createOrUpdateActionText = effectiveBranch ? `Обновить Ветку '${effectiveBranch}'` : "Создать PR";
        const createOrUpdateIcon = effectiveBranch ? <FaCodeBranch /> : <FaGithub />;
        const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

        // Helper to add suggestions with loading state check
        const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            if (condition) {
                 // Apply general loading disable logic first
                 // Allow retry, close settings, and goto actions even when loading
                 let isDisabled = isAnyLoading && !['retry-fetch', 'toggle-settings-close', 'goto-'].some(prefix => id.startsWith(prefix));

                 // Specific overrides or conditions
                 if (id === 'toggle-settings-open' && !isAnyLoading) isDisabled = false; // Allow opening settings if not loading
                 if (id === 'img-replace-status' && assistantLoading) isDisabled = true; // Disable status button if assistant is busy with PR
                 if (disabled) isDisabled = true; // Explicitly passed disabled prop overrides

                 suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
            }
        };

        // <<< --- CHECK FOR IMAGE REPLACE TASK FIRST --- >>>
        if (imageReplaceTask) {
            logger.log("AutomationBuddy: Image Replace Task active, generating specific suggestions.");
            addSuggestion(
                "img-replace-status",
                assistantLoading ? "Замена Картинки..." : "Задача Замены Активна",
                () => {}, // No action needed for status display
                assistantLoading ? <FaSpinner className="animate-spin text-blue-400"/> : <FaImages className="text-blue-400"/>,
                true,
                assistantLoading // Disable if assistant is processing the PR
            );
            addSuggestion(
                "goto-pr-form-img",
                "К Статусу Задачи",
                () => scrollToSection('executor'), // Scroll to assistant where msg is shown
                <FaRocket />,
                true,
                assistantLoading // Disable scroll if processing
            );
            // Allow opening/closing settings even during image replace (unless assistant is creating PR)
            const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
            addSuggestion(
                settingsButtonId,
                isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)",
                triggerToggleSettingsModal,
                <FaCodeBranch />,
                true,
                assistantLoading // Disable if assistant is busy
            );
            return suggestionsList; // Return early, don't show standard suggestions
        }

        // --- Proceed with standard suggestions ONLY if NOT image replace ---
        logger.log(`AutomationBuddy: Standard flow, currentStep: ${currentStep}`);
        const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
        addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true );

        switch (currentStep) {
            case 'ready_to_fetch':
                addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, true, !repoUrlEntered, !repoUrlEntered ? "Сначала укажи URL" : "");
                break;
            case 'fetching':
                addSuggestion("loading-indicator", `Загрузка Файлов${branchInfo}...`, () => {}, <FaArrowsRotate className="animate-spin"/>, true, true );
                break;
            case 'fetch_failed':
                addSuggestion("retry-fetch", `Попробовать Снова${branchInfo}?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight />, true);
                break;
            // files_fetched_image_replace case is handled by the initial check
            case 'files_fetched':
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("ask-ai-empty", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                 break;
            case 'files_fetched_highlights':
                 addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />);
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, selectedFetcherFiles.size > 0, false, "Добавить выбранные файлы в поле запроса"); // Modified text/tooltip
                 addSuggestion("ask-ai-highlights", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, selectedFetcherFiles.size > 0, false, "Добавить выбранные и сразу спросить AI"); // Combined action
                break;
            case 'files_selected':
                addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса");
                addSuggestion("ask-ai-selected", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, true, false, "Добавить выбранные и сразу спросить AI"); // Combined action
                addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;
            case 'request_written':
                 addSuggestion("ask-ai-written", "🤖 Спросить AI", triggerAskAi, <FaRobot />, true, isWaitingForAi, isWaitingForAi ? "Запрос уже отправлен" : "");
                 addSuggestion("copy-kwork", "Скопировать Запрос", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent, !kworkInputHasContent ? "Запрос пуст" : "");
                 addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                 break;
            case 'generating_ai_response':
                 addSuggestion("loading-indicator", `⏳ Жду AI (${currentAiRequestId?.substring(0,6)}...)`, () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 addSuggestion("goto-ai-response-wait", "К Полю Ответа AI", () => scrollToSection('aiResponseInput'), <FaKeyboard />);
                 break;
            case 'request_copied':
                addSuggestion("goto-ai-response", "К Полю Ответа AI", () => scrollToSection('aiResponseInput'), <FaArrowRight />);
                addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                break;
            case 'response_pasted':
                 addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, !aiResponseHasContent, !aiResponseHasContent ? "Нет ответа" : "");
                 addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('aiResponseInput'), <FaKeyboard />);
                break;
            case 'parsing_response':
                 addSuggestion("loading-indicator", "Разбор Ответа...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 break;
            case 'response_parsed': // Fallthrough intended
            case 'pr_ready':
                 // Standard PR/Update flow (only reachable if not image replace)
                 addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                 addSuggestion("goto-assistant-files", "К Файлам Ниже", () => scrollToSection('executor'), <FaEye />);
                 addSuggestion( effectiveBranch ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0, selectedAssistantFiles.size === 0 ? "Выбери файлы для коммита" : "" );
                 addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('prSection'), <FaRocket />);
                 break;
            default: break;
        }

        // --- Clear All Suggestion (Hide if image replace) ---
        if (fetcherRef?.current?.clearAll && !imageReplaceTask && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) {
             addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaBroom/>, true);
        }

        return suggestionsList;

    }, [ // Dependencies
        currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles,
        kworkInputHasContent, aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs, isParsing, currentAiRequestId,
        targetBranchName, manualBranchName, isSettingsModalOpen, imageReplaceTask, // <<< ADDED imageReplaceTask
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, fetcherRef
    ]);


    // --- Suggestion Change Detection for Notification ---
    useEffect(() => {
        // ... (Suggestion change detection - no changes needed) ...
        const currentIds = new Set(suggestions.map(s => s.id)); const prevIds = previousSuggestionIds.current;
        if (isOpen) { setHasNewSuggestions(false); previousSuggestionIds.current = currentIds; }
        else { let changed = currentIds.size !== prevIds.size; if (!changed) { for (const id of currentIds) { if (!prevIds.has(id)) { changed = true; break; } } if (!changed) { for (const id of prevIds) { if (!currentIds.has(id)) { changed = true; break; } } } }
            // Only show notification for meaningful changes (not just loading indicators changing)
            const meaningfulChange = Array.from(currentIds).some(id => !id.includes('loading-indicator') && id !== 'img-replace-status') || Array.from(prevIds).some(id => !id.includes('loading-indicator') && id !== 'img-replace-status');
            if (changed && meaningfulChange && !hasNewSuggestions) { setHasNewSuggestions(true); logger.log("Buddy: New suggestions available!"); }
            if(changed) { previousSuggestionIds.current = currentIds; }
        }
    }, [suggestions, isOpen, hasNewSuggestions]);


    // --- Auto-open Timer ---
    useEffect(() => { let t:NodeJS.Timeout|null=null; if(!hasAutoOpened&&!isOpen){t=setTimeout(()=>{setIsOpen(true);setHasAutoOpened(true);},AUTO_OPEN_DELAY_MS_BUDDY);} return()=>{if(t)clearTimeout(t);}; }, [hasAutoOpened, isOpen]);
    // --- Handle Escape Key ---
    const handleEscKey = useCallback((e:KeyboardEvent) => { if(e.key==='Escape'&&isOpen)setIsOpen(false);}, [isOpen]);
    useEffect(() => { document.addEventListener('keydown',handleEscKey); return()=>{document.removeEventListener('keydown',handleEscKey);}; }, [handleEscKey]);

    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        // ... (handleSuggestionClick - no changes needed) ...
        if(suggestion.disabled)return; logger.log("Buddy Click:",suggestion.id); if(suggestion.action){ const r=suggestion.action(); if(!suggestion.id.startsWith('goto-')&&suggestion.id!=='loading-indicator'&&suggestion.id!=='toggle-settings-close'&& suggestion.id!=='toggle-settings-open' && suggestion.id !== 'img-replace-status'){setIsOpen(false);} else if(suggestion.id.startsWith('goto-')){setTimeout(()=>setIsOpen(false),300);} if(r instanceof Promise){r.catch(err=>{logger.error(`Buddy action (${suggestion.id}) error:`, err); toast.error(`Действие "${suggestion.text}" не удалось.`);});} } else {setIsOpen(false);}
    };
    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e:React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => { setIsOpen(!isOpen); if(!isOpen){setHasAutoOpened(true);setHasNewSuggestions(false);} };

    // --- Render Logic ---
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