// MODIFICATIONS:
// - Added check for `imageReplaceTask` at the beginning of suggestion calculation.
// - If `imageReplaceTask` exists, generate specific suggestions for image replacement flow.
// - Return *only* image-related suggestions when the task is active.
// - Ensured loading states correctly disable suggestions in both standard and image flows.
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowRotateRight, FaArrowsRotate, FaAngrycreative, FaPoo,
    FaList, FaCodeBranch, FaExclamation, FaImages, FaSpinner // Ensured FaSpinner, FaImages are imported
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
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, -15, 10, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0.8 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };
const notificationVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } }, exit: { scale: 0, opacity: 0 } };


// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    // --- State ---
    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
    const previousSuggestionIds = useRef<Set<string>>(new Set());
    // <<< --- Use useState for suggestions instead of useMemo --- >>>
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

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

    // --- Effects ---
    useEffect(() => { setIsMounted(true); }, []); // Set mounted state

    // --- Get Active Message (Uses Context's getXuinityMessage) ---
    // No changes needed here, useMemo is fine for this simple derivation
    const activeMessage = useMemo(() => {
        if (!isMounted) return "Загрузка..."; // Default message before mount
        return getBaseMessage();
    }, [isMounted, getBaseMessage]);

    // --- <<< Calculate Suggestions in useEffect >>> ---
    useEffect(() => {
        // Only calculate after mount
        if (!isMounted) {
            setSuggestions([]); // Ensure it's empty before mount
            return;
        }

        // The entire suggestion calculation logic is moved here
        const calculateSuggestions = (): Suggestion[] => {
            const suggestionsList: Suggestion[] = [];
            const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
            // Consolidated loading check (includes assistant loading for PRs/parsing/image replace)
            const isAnyLoading = isFetcherLoading || assistantLoading || aiActionLoading || loadingPrs || isParsing;
            const effectiveBranch = manualBranchName.trim() || targetBranchName;
            const branchInfo = effectiveBranch ? ` (${effectiveBranch})` : ' (default)';
            const createOrUpdateActionText = effectiveBranch ? `Обновить Ветку '${effectiveBranch}'` : "Создать PR";
            const createOrUpdateIcon = effectiveBranch ? <FaCodeBranch /> : <FaGithub />;
            const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

            // Helper to add suggestions, including the unified loading check
            const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
                if (condition) {
                     // Disable most actions if any general loading is happening
                     let isDisabled = isAnyLoading;

                     // --- SPECIFIC EXCEPTIONS ---
                     // Allow retrying fetch even if loading stuck (but not if other things are loading)
                     if (id === 'retry-fetch') isDisabled = assistantLoading || aiActionLoading || loadingPrs || isParsing; // Only disable if OTHER things are loading
                     // Always allow toggling settings
                     if (id === 'toggle-settings-close' || id === 'toggle-settings-open') isDisabled = false;
                     // Always allow scrolling
                     if (id.startsWith('goto-')) isDisabled = false;
                     // Allow clearing ONLY if the fetcher/assistant isn't actively doing something critical
                     if (id === 'clear-all') isDisabled = isFetcherLoading || assistantLoading || aiActionLoading || isParsing;
                     // Allow image status view unless something critical is happening
                     if (id === 'img-replace-status') isDisabled = isFetcherLoading || aiActionLoading || isParsing || loadingPrs; // Allow if only assistantLoading (PR creation) is true

                    // Apply the passed disabled prop if true (overrides exceptions if needed)
                    if (disabled) isDisabled = true;

                     suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
                }
            };

             // --- MODIFICATION: Image Replace Task Flow ---
             if (imageReplaceTask) {
                 logger.log("AutomationBuddy: Image Replace Task active, generating specific suggestions.");
                 const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
                 addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true, false ); // Settings always allowed

                 // Status suggestion based on fetch/assistant state
                 let statusText = "Задача Замены Активна";
                 let statusIcon: React.ReactNode = <FaImages className="text-blue-400"/>;
                 let statusDisabled = false; // Disable interaction with status itself

                 if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                     statusText = "Загрузка Файла...";
                     statusIcon = <FaSpinner className="animate-spin text-blue-400"/>;
                 } else if (fetchStatus === 'success' && assistantLoading) {
                     statusText = "Замена и PR...";
                     statusIcon = <FaSpinner className="animate-spin text-purple-400"/>;
                 } else if (fetchStatus === 'error' || fetchStatus === 'failed_retries') {
                     statusText = "Ошибка Загрузки Файла!";
                     statusIcon = <FaExclamation className="text-red-500"/>;
                 } else if (fetchStatus === 'success' && !assistantLoading) {
                     // This state might be brief before PR creation starts
                     statusText = "Файл Загружен, Готовлю PR";
                     statusIcon = <FaCheck className="text-green-400"/>;
                 }

                 addSuggestion( "img-replace-status", statusText, () => scrollToSection('executor'), statusIcon, true, statusDisabled ); // Link to assistant section for details
                // Add retry fetch button only on failure
                 if (fetchStatus === 'error' || fetchStatus === 'failed_retries') {
                    addSuggestion("retry-fetch-img", `Попробовать Снова Загрузить?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight />, true);
                 }

                 return suggestionsList; // Return only image-related suggestions
             }
             // --- END IMAGE REPLACE MODIFICATION ---

             // --- Standard Workflow (Only runs if imageReplaceTask is null) ---
             const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
             addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true, false ); // Settings always allowed

             switch (currentStep) {
                 case 'ready_to_fetch':
                     addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, true, !repoUrlEntered, !repoUrlEntered ? "Сначала укажи URL" : "");
                     break;
                 case 'fetching':
                     addSuggestion("loading-indicator", `Загрузка Файлов${branchInfo}...`, () => {}, <FaArrowsRotate className="animate-spin"/>, true, true ); // Disabled interaction
                     break;
                 case 'fetch_failed':
                     addSuggestion("retry-fetch", `Попробовать Снова${branchInfo}?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight />, true); // Allow retry unless other things loading
                     break;
                 case 'files_fetched':
                     addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('file-list-container'), <FaEye />, true); // Changed target ID
                     addSuggestion("ask-ai-empty", "🤖 Спросить AI", triggerAskAi, <FaRobot />, true, isWaitingForAi, isWaitingForAi ? "Запрос уже отправлен" : "");
                     break;
                 case 'files_fetched_highlights':
                     addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />, true);
                     addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('file-list-container'), <FaEye />, true); // Changed target ID
                     addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, selectedFetcherFiles.size > 0, false, "Добавить выбранные файлы в поле запроса");
                     addSuggestion("ask-ai-highlights", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, selectedFetcherFiles.size > 0, isWaitingForAi, isWaitingForAi ? "Запрос уже отправлен" : "Добавить выбранные и сразу спросить AI");
                    break;
                 case 'files_selected':
                    addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса");
                    addSuggestion("ask-ai-selected", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, true, isWaitingForAi, isWaitingForAi ? "Запрос уже отправлен" : "Добавить выбранные и сразу спросить AI");
                    addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true); // Changed target ID
                    break;
                 case 'request_written':
                     addSuggestion("ask-ai-written", "🤖 Спросить AI", triggerAskAi, <FaRobot />, true, isWaitingForAi, isWaitingForAi ? "Запрос уже отправлен" : "");
                     addSuggestion("copy-kwork", "Скопировать Запрос", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent, !kworkInputHasContent ? "Запрос пуст" : "");
                     addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true); // Changed target ID
                     break;
                 case 'generating_ai_response':
                     addSuggestion("loading-indicator", `⏳ Жду AI (${currentAiRequestId?.substring(0,6)}...)`, () => {}, <FaBrain className="animate-pulse"/>, true, true ); // Disabled interaction
                     addSuggestion("goto-ai-response-wait", "К Полю Ответа AI", () => scrollToSection('response-input'), <FaKeyboard />, true); // Changed target ID
                     break;
                 case 'request_copied':
                    addSuggestion("goto-ai-response", "К Полю Ответа AI", () => scrollToSection('response-input'), <FaArrowRight />, true); // Changed target ID
                    addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, !aiResponseHasContent || isParsing, !aiResponseHasContent ? "Вставь ответ AI" : (isParsing ? "Уже разбираю..." : ""));
                    break;
                 case 'response_pasted':
                     addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, !aiResponseHasContent || isParsing, !aiResponseHasContent ? "Нет ответа" : (isParsing ? "Уже разбираю..." : ""));
                     addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('response-input'), <FaKeyboard />, true); // Changed target ID
                    break;
                 case 'parsing_response':
                     addSuggestion("loading-indicator", "Разбор Ответа...", () => {}, <FaBrain className="animate-pulse"/>, true, true ); // Disabled interaction
                     break;
                 case 'response_parsed': // Fallthrough intended
                 case 'pr_ready':
                     addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                     addSuggestion("goto-assistant-files", "К Файлам Ниже", () => scrollToSection('executor'), <FaEye />, true); // Changed target ID (executor contains assistant)
                     addSuggestion( effectiveBranch ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0 || assistantLoading, selectedAssistantFiles.size === 0 ? "Выбери файлы для коммита" : (assistantLoading ? "Обработка..." : "") );
                     addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('pr-form-container'), <FaRocket />, true); // Changed target ID
                     break;
                 default: break;
             }

             // Clear All button available in most standard steps
             if (fetcherRef?.current?.clearAll && !imageReplaceTask && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) {
                 addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaBroom/>, true); // Disabled state handled by helper now
             }

            return suggestionsList;
        };

        // Calculate and set the suggestions state
        const newSuggestions = calculateSuggestions();
        setSuggestions(newSuggestions);

    // <<< --- Dependency Array for the useEffect --- >>>
    // List all external variables and context values the calculation depends on
    }, [
        isMounted, currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, manualBranchName, isSettingsModalOpen, isParsing,
        currentAiRequestId, imageReplaceTask, // Added imageReplaceTask
        // Context triggers are generally stable, but include if they might change identity
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, fetcherRef, getBaseMessage // Added getBaseMessage
    ]);

    // --- Suggestion Change Detection for Notification (No change needed) ---
    useEffect(() => {
        if (!isMounted) return;
        const currentIds = new Set(suggestions.map(s => s.id));
        const prevIds = previousSuggestionIds.current;

        if (isOpen) {
            setHasNewSuggestions(false); // Reset notification when opened
            previousSuggestionIds.current = currentIds; // Update ref when opened
        } else {
            // Check if IDs actually changed since last time (when closed)
            let changed = currentIds.size !== prevIds.size;
            if (!changed) { // If size is same, check content
                for (const id of currentIds) { if (!prevIds.has(id)) { changed = true; break; } }
            }

            // Only set notification if there was a change AND it's meaningful
            // (exclude loading indicators and potentially the image status which might flicker)
            const meaningfulChange = Array.from(currentIds).some(id => !id.includes('loading-indicator') && !id.includes('img-replace-status'))
                                || Array.from(prevIds).some(id => !id.includes('loading-indicator') && !id.includes('img-replace-status'));

            if (changed && meaningfulChange && !hasNewSuggestions) {
                setHasNewSuggestions(true);
                logger.log("Buddy: New suggestions available!");
            }
             // Update ref *only if IDs changed* to correctly detect next change
             if(changed) {
                 previousSuggestionIds.current = currentIds;
             }
        }
    }, [isMounted, suggestions, isOpen, hasNewSuggestions]); // Depends on calculated suggestions state

    // --- Auto-open Timer (No change needed) ---
    useEffect(() => { let t:NodeJS.Timeout|null=null; if(isMounted && !hasAutoOpened&&!isOpen){t=setTimeout(()=>{setIsOpen(true);setHasAutoOpened(true);},AUTO_OPEN_DELAY_MS_BUDDY);} return()=>{if(t)clearTimeout(t);}; }, [isMounted, hasAutoOpened, isOpen]);
    // --- Handle Escape Key (No change needed) ---
    const handleEscKey = useCallback((e:KeyboardEvent) => { if(e.key==='Escape'&&isOpen)setIsOpen(false);}, [isOpen]);
    useEffect(() => { document.addEventListener('keydown',handleEscKey); return()=>{document.removeEventListener('keydown',handleEscKey);}; }, [handleEscKey]);

    // --- Event Handlers (No change needed) ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if(suggestion.disabled)return; logger.log("Buddy Click:",suggestion.id); if(suggestion.action){ const r=suggestion.action(); if(!suggestion.id.startsWith('goto-')&&suggestion.id!=='loading-indicator'&&suggestion.id!=='toggle-settings-close'&& suggestion.id!=='toggle-settings-open' && suggestion.id !== 'img-replace-status' && !suggestion.id.startsWith('retry-fetch')){setIsOpen(false);} else if(suggestion.id.startsWith('goto-')){setTimeout(()=>setIsOpen(false),300);} if(r instanceof Promise){r.catch(err=>{logger.error(`Buddy action (${suggestion.id}) error:`, err); toast.error(`Действие "${suggestion.text}" не удалось.`);});} } else {setIsOpen(false);}
    };
    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e:React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => { setIsOpen(!isOpen); if(!isOpen){setHasAutoOpened(true);setHasNewSuggestions(false);} };

    // --- Render Logic ---
    if (!isMounted) {
        // Render nothing during SSR/build to be safe
        return null;
    }

    // Now we can safely render based on the 'suggestions' state
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="buddy-dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 bg-black bg-opacity-60 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-modal="true" role="dialog" aria-labelledby="buddy-suggestions-title" >
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-end bg-transparent" onClick={handleDialogClick} >
                        <h2 id="buddy-suggestions-title" className="sr-only">Automation Buddy Suggestions</h2>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />
                        <div className="flex flex-col sm:flex-row-reverse items-center sm:items-end w-full gap-4 mt-2">
                            <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                            {/* <<< --- Render using the suggestions state variable --- >>> */}
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