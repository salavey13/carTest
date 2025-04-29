"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation"; // Import useSearchParams
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
const AUTO_OPEN_DELAY_MS_BUDDY_SIMPLE_CASE = 42000; // <-- NEW: Delay for simple case
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
    // Use useState for suggestions for reliability with useEffect updates
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

    // --- Hooks ---
    const searchParams = useSearchParams(); // <-- Get search params

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
        imageReplaceTask, // <<< Get image replace task >>>
        allFetchedFiles, // <<< Get all files to check target existence >>>

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
        getXuinityMessage, // Use the message from context

        // Refs
        fetcherRef,

    } = useRepoXmlPageContext();

    // --- Effects ---
    useEffect(() => { setIsMounted(true); }, []); // Set mounted state

    // --- Get Active Message (Uses Context's getXuinityMessage) ---
    // UseMemo is fine here as getXuinityMessage itself depends on changing context state
    const activeMessage = useMemo(() => {
        if (!isMounted) return "Загрузка..."; // Default message before mount
        return getXuinityMessage();
    }, [isMounted, getXuinityMessage]);

    // --- Calculate Suggestions in useEffect (with added check for fetcherRef.current.clearAll) ---
    useEffect(() => {
        // Only calculate after mount
        if (!isMounted) {
            setSuggestions([]); // Ensure it's empty before mount
            return;
        }

        const calculateSuggestions = (): Suggestion[] => {
            const suggestionsList: Suggestion[] = [];
            const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
            // More granular busy states
            const isAssistantProcessing = assistantLoading || isParsing; // Assistant busy with parsing or PR/update
            const isAiGenerating = aiActionLoading && !!currentAiRequestId;
            // Combined loading state for general UI disable
            const isAnyLoading = isFetcherLoading || isAssistantProcessing || isAiGenerating || loadingPrs;

            const effectiveBranch = manualBranchName.trim() || targetBranchName;
            const branchInfo = effectiveBranch ? ` (${effectiveBranch})` : ' (default)';
            const createOrUpdateActionText = effectiveBranch ? `Обновить Ветку '${effectiveBranch}'` : "Создать PR";
            const createOrUpdateIcon = effectiveBranch ? <FaCodeBranch /> : <FaGithub />;

            // Helper to add suggestions, considering loading states
            const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
                if (condition) {
                    // Start with explicit disabled flag
                    let isDisabled = disabled;

                    // --- General Loading Overrides ---
                    // Disable most actions if *anything* is loading/processing, unless explicitly allowed below
                    if (!isDisabled && isAnyLoading) {
                         // Check for exceptions where action IS allowed despite loading
                         if (!(id.startsWith('goto-') || id.includes('toggle-settings') || id.includes('retry-fetch') || id === 'img-replace-status')) {
                             isDisabled = true;
                         }
                    }

                    // --- Specific Disabling Logic (can override general loading disable) ---
                    if (id === 'fetch' || id === 'retry-fetch' || id === 'retry-fetch-img') { // Disable fetch/retry if assistant/AI is busy
                        isDisabled = isDisabled || isAssistantProcessing || isAiGenerating;
                    }
                    if (id.includes('ask-ai')) { // Disable asking AI if already generating
                        isDisabled = isDisabled || isAiGenerating;
                    }
                    if (id === 'parse-response') { // Disable parsing if already parsing or AI generating
                        isDisabled = isDisabled || isParsing || isAiGenerating;
                    }
                    if (id === 'create-pr' || id === 'update-branch') { // Disable PR/update if assistant busy
                         isDisabled = isDisabled || isAssistantProcessing;
                    }
                    if (id === 'clear-all') { // Disable clear if fetcher/assistant/AI busy
                         isDisabled = isDisabled || isFetcherLoading || isAssistantProcessing || isAiGenerating;
                    }
                    // Settings toggle allowed unless assistant/AI busy
                    if (id.includes('toggle-settings')) {
                         isDisabled = isAssistantProcessing || isAiGenerating;
                    }

                    suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
                }
            };

            // --- Image Replace Task Flow ---
             if (imageReplaceTask) {
                 logger.log("AutomationBuddy: Image Replace Task active, generating suggestions.");
                 const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
                 // Settings: Disabled if Assistant is processing the image replace PR/update
                 addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true );

                 let statusText = "Задача Замены Активна";
                 let statusIcon: React.ReactNode = <FaImages className="text-blue-400"/>;
                 let statusDisabled = true; // Disable interaction by default
                 let statusAction: (() => void) | undefined = () => scrollToSection('executor');
                 let isErrorState = false;

                 // Check if target file exists in the fetched files (only if fetch completed)
                 const targetFileExists = filesFetched && allFetchedFiles?.some(f => f.path === imageReplaceTask.targetPath);

                 if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                     statusText = "Загрузка Файла...";
                     statusIcon = <FaSpinner className="animate-spin text-blue-400"/>;
                 } else if (fetchStatus === 'error' || fetchStatus === 'failed_retries' || (fetchStatus === 'success' && !targetFileExists && filesFetched)) {
                     statusText = "Ошибка Загрузки/Поиска Файла!";
                     statusIcon = <FaExclamation className="text-red-500"/>;
                     statusDisabled = false; // Allow retry
                     statusAction = () => triggerFetch(true, effectiveBranch || null);
                     isErrorState = true;
                 } else if (fetchStatus === 'success' && targetFileExists) {
                     if (assistantLoading) { // Assistant is processing (set via handleDirectImageReplace)
                         statusText = "Замена и PR/Обновление...";
                         statusIcon = <FaSpinner className="animate-spin text-purple-400"/>;
                     } else { // Assistant is ready or finished (task might be cleared soon)
                         statusText = "Файл Загружен, Готов к Замене";
                         statusIcon = <FaCheck className="text-green-400"/>;
                     }
                 }

                 // Add the main status/action suggestion
                 addSuggestion( "img-replace-status", statusText, statusAction || (() => {}), statusIcon, true, statusDisabled, isErrorState ? "Нажмите, чтобы попробовать снова" : "Нажмите, чтобы перейти к статусу" );

                 // Only add explicit retry button if in error state
                 if (isErrorState) {
                    addSuggestion("retry-fetch-img", `Попробовать Снова Загрузить?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight />, true);
                 }

                 return suggestionsList; // Return only image-related suggestions
             }
             // --- END IMAGE REPLACE MODIFICATION ---


             // --- Standard Workflow (Only runs if imageReplaceTask is null) ---
             const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
             addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true );

             switch (currentStep) {
                 case 'ready_to_fetch':
                     addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, () => triggerFetch(false, effectiveBranch || null), <FaDownload />, true, false, "");
                     break;
                 case 'fetching':
                     addSuggestion("loading-indicator", `Загрузка Файлов${branchInfo}...`, () => {}, <FaArrowsRotate className="animate-spin"/>, true, true );
                     break;
                 case 'fetch_failed':
                     addSuggestion("retry-fetch", `Попробовать Снова${branchInfo}?`, () => triggerFetch(true, effectiveBranch || null), <FaArrowRotateRight />, true);
                     break;
                 case 'files_fetched':
                     addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('file-list-container'), <FaEye />, true);
                     addSuggestion("ask-ai-empty", "🤖 Спросить AI", triggerAskAi, <FaRobot />, true, false, isAiGenerating ? "Запрос уже отправлен" : "");
                     break;
                 case 'files_fetched_highlights':
                     addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />, true);
                     addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('file-list-container'), <FaEye />, true);
                     addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, selectedFetcherFiles.size > 0, false, "Добавить выбранные файлы в поле запроса");
                     addSuggestion("ask-ai-highlights", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, selectedFetcherFiles.size > 0, false, isAiGenerating ? "Запрос уже отправлен" : "Добавить выбранные и сразу спросить AI");
                    break;
                 case 'files_selected':
                    addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса");
                    addSuggestion("ask-ai-selected", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, true, false, isAiGenerating ? "Запрос уже отправлен" : "Добавить выбранные и сразу спросить AI");
                    addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true);
                    break;
                 case 'request_written':
                     addSuggestion("ask-ai-written", "🤖 Спросить AI", triggerAskAi, <FaRobot />, true, false, isAiGenerating ? "Запрос уже отправлен" : "");
                     addSuggestion("copy-kwork", "Скопировать Запрос", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent, !kworkInputHasContent ? "Запрос пуст" : "");
                     addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kwork-input-section'), <FaKeyboard />, true);
                     break;
                 case 'generating_ai_response': // Covers AI generation AND PR processing
                     const loadingText = aiActionLoading ? `⏳ Жду AI (${currentAiRequestId?.substring(0,6)}...)` : assistantLoading ? "⚙️ Обработка PR/Ветки..." : "⏳ Обработка...";
                     addSuggestion("loading-indicator", loadingText, () => {}, <FaBrain className="animate-pulse"/>, true, true );
                     addSuggestion("goto-assistant-loading", "К Ассистенту", () => scrollToSection('executor'), <FaKeyboard />, true);
                     break;
                 case 'request_copied':
                    addSuggestion("goto-ai-response", "К Полю Ответа AI", () => scrollToSection('response-input'), <FaArrowRight />, true);
                    addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, false, !aiResponseHasContent ? "Вставь ответ AI" : (isParsing ? "Уже разбираю..." : ""));
                    break;
                 case 'response_pasted':
                     addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, false, !aiResponseHasContent ? "Нет ответа" : (isParsing ? "Уже разбираю..." : ""));
                     addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('response-input'), <FaKeyboard />, true);
                    break;
                 case 'parsing_response':
                     addSuggestion("loading-indicator", "Разбор Ответа...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                     break;
                 case 'response_parsed': // Fallthrough intended
                 case 'pr_ready':
                     addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                     addSuggestion("goto-assistant-files", "К Файлам Ниже", () => scrollToSection('executor'), <FaEye />, true);
                     addSuggestion( effectiveBranch ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, selectedAssistantFiles.size > 0, false, selectedAssistantFiles.size === 0 ? "Выбери файлы для коммита" : (assistantLoading ? "Обработка..." : "") );
                     addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('pr-form-container'), <FaRocket />, true);
                     break;
                 default: break;
             }

            // Clear All button available in most standard steps
            // --- ADDED DEFENSIVE CHECK ---
            if (fetcherRef?.current?.clearAll && // Check if ref.current and method exist
                !imageReplaceTask &&
                (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent || filesParsed)
            ) {
                // Use a function wrapper to call the ref method
                const clearAction = () => {
                    if (fetcherRef.current?.clearAll) {
                        fetcherRef.current.clearAll();
                    } else {
                        logger.error("[AutomationBuddy] clearAll action called but fetcherRef.current.clearAll is missing!");
                    }
                };
                addSuggestion("clear-all", "Очистить Все?", clearAction, <FaBroom/>, true);
            } else if (!imageReplaceTask && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent || filesParsed)) {
                // Log if clearAll is expected but not available
                 logger.warn("[AutomationBuddy] ClearAll suggestion not added. fetcherRef.current:", fetcherRef?.current);
            }
            // --- END DEFENSIVE CHECK ---


            return suggestionsList;
        };

        // Calculate and set the suggestions state
        const newSuggestions = calculateSuggestions();
        setSuggestions(newSuggestions);

    // Dependencies updated for image task logic AND DEFENSIVE CHECK
    }, [
        isMounted, currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, manualBranchName, isSettingsModalOpen, isParsing,
        currentAiRequestId, imageReplaceTask,
        allFetchedFiles, // Added allFetchedFiles for image task check
        // Context triggers
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, getXuinityMessage,
        fetcherRef // Added fetcherRef dependency for the clearAll check
    ]);

    // --- Suggestion Change Detection for Notification ---
    useEffect(() => {
        if (!isMounted) return;
        const currentIds = new Set(suggestions.map(s => s.id));
        const prevIds = previousSuggestionIds.current;

        if (isOpen) {
            setHasNewSuggestions(false);
            previousSuggestionIds.current = currentIds;
        } else {
            let changed = currentIds.size !== prevIds.size || ![...currentIds].every(id => prevIds.has(id));
            // Check if change is "meaningful" (not just loading indicator changes)
            const meaningfulChange = [...currentIds].some(id => !id.includes('loading-indicator') && !id.includes('img-replace-status')) ||
                                   [...prevIds].some(id => !id.includes('loading-indicator') && !id.includes('img-replace-status'));

            if (changed && meaningfulChange && !hasNewSuggestions) {
                setHasNewSuggestions(true);
                logger.log("Buddy: New suggestions available!");
            }
             // Update previous IDs only if there was *any* change, meaningful or not
             if(changed) {
                 previousSuggestionIds.current = currentIds;
             }
        }
    }, [isMounted, suggestions, isOpen, hasNewSuggestions]);

    // --- Auto-open Timer (Modified for simple case) ---
    useEffect(() => {
        let t: NodeJS.Timeout | null = null;
        if (isMounted && !hasAutoOpened && !isOpen) {
            // Determine delay based on search params
            const hasParams = searchParams.has("path") || searchParams.has("idea");
            const delayMs = hasParams ? AUTO_OPEN_DELAY_MS_BUDDY : AUTO_OPEN_DELAY_MS_BUDDY_SIMPLE_CASE;
            logger.log(`Buddy: Setting auto-open timer for ${delayMs}ms (hasParams: ${hasParams})`);
            t = setTimeout(() => {
                setIsOpen(true);
                setHasAutoOpened(true);
                logger.log(`Buddy: Auto-opened after ${delayMs}ms`);
            }, delayMs);
        }
        return () => { if (t) clearTimeout(t); };
    }, [isMounted, hasAutoOpened, isOpen, searchParams]); // Added searchParams dependency

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((e:KeyboardEvent) => { if(e.key==='Escape'&&isOpen)setIsOpen(false);}, [isOpen]);
    useEffect(() => { document.addEventListener('keydown',handleEscKey); return()=>{document.removeEventListener('keydown',handleEscKey);}; }, [handleEscKey]);

    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if(suggestion.disabled)return; logger.log("Buddy Click:",suggestion.id); if(suggestion.action){ const r=suggestion.action(); // Close dialog unless it's just scrolling, settings toggle, retry, or status view
             if (!suggestion.id.startsWith('goto-') && !suggestion.id.includes('toggle-settings') && !suggestion.id.includes('retry-fetch') && suggestion.id !== 'img-replace-status') {
                 setIsOpen(false);
             } else if (suggestion.id.startsWith('goto-')) {
                 // Delay closing slightly for scroll actions
                 setTimeout(() => setIsOpen(false), 300);
             } if(r instanceof Promise){r.catch(err=>{logger.error(`Buddy action (${suggestion.id}) error:`, err); toast.error(`Действие "${suggestion.text}" не удалось.`);});} } else {setIsOpen(false);} // Close if no action defined
    };
    const handleOverlayClick = () => {
        setIsOpen(false);
        // FIX: Try to return focus to the body
        requestAnimationFrame(() => document.body.focus());
    };
    const handleDialogClick = (e:React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => {
        setIsOpen(prev => {
             const nextOpen = !prev;
             if (!nextOpen) {
                 // FIX: Try to return focus to the body when closing via FAB
                 requestAnimationFrame(() => document.body.focus());
             }
             return nextOpen;
        });
        if(!isOpen){setHasAutoOpened(true);setHasNewSuggestions(false);}
    };

    // --- Render Logic ---
    if (!isMounted) {
        return null; // Render nothing server-side or before mount
    }

    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="buddy-dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 bg-black bg-opacity-60 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-modal="true" role="dialog" aria-labelledby="buddy-suggestions-title" >
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-end bg-transparent" onClick={handleDialogClick} >
                        <h2 id="buddy-suggestions-title" className="sr-only">Automation Buddy Suggestions</h2>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />
                        <div className="flex flex-col sm:flex-row-reverse items-center sm:items-end w-full gap-4 mt-2">
                            <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                            {/* Render using the suggestions state variable */}
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