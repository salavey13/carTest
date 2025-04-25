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
            // Consolidated loading check
            const isAnyLoading = isFetcherLoading || assistantLoading || aiActionLoading || loadingPrs || isParsing;
            const effectiveBranch = manualBranchName.trim() || targetBranchName;
            const branchInfo = effectiveBranch ? ` (${effectiveBranch})` : ' (default)';
            const createOrUpdateActionText = effectiveBranch ? `Обновить Ветку '${effectiveBranch}'` : "Создать PR";
            const createOrUpdateIcon = effectiveBranch ? <FaCodeBranch /> : <FaGithub />;
            const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

            // Helper to add suggestions, including the unified loading check
            const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
                if (condition) {
                    // Disable most actions if any loading is happening, with specific exceptions
                    let isDisabled = isAnyLoading && !['retry-fetch', 'toggle-settings-close', 'goto-', 'clear-all'].some(prefix => id.startsWith(prefix));
                     // Explicitly allow settings toggle even when loading (useful for changing URL/branch)
                     if (id === 'toggle-settings-open' || id === 'toggle-settings-close') isDisabled = false; // Allow toggling settings always
                     // Explicitly disable image status action if assistant is busy elsewhere
                     if (id === 'img-replace-status' && assistantLoading) isDisabled = true;
                     // Apply the passed disabled prop if true
                     if (disabled) isDisabled = true;

                     suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
                }
            };

             // --- Image Replace Task Flow ---
             if (imageReplaceTask) {
                 logger.log("AutomationBuddy: Image Replace Task active, generating specific suggestions.");
                 addSuggestion( "img-replace-status", assistantLoading ? "Замена Картинки..." : "Задача Замены Активна", () => {}, assistantLoading ? <FaSpinner className="animate-spin text-blue-400"/> : <FaImages className="text-blue-400"/>, true, assistantLoading );
                 addSuggestion( "goto-pr-form-img", "К Статусу Задачи", () => scrollToSection('executor'), <FaRocket />, true, assistantLoading ); // Go to assistant section for status
                 const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
                 addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true ); // Allow settings toggle
                 return suggestionsList; // Return only image-related suggestions
             }

             // --- Standard Workflow ---
             // logger.log(`AutomationBuddy: Standard flow, currentStep: ${currentStep}`); // Can be verbose
             const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
             addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true ); // Allow settings toggle

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
                 case 'files_fetched':
                     addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                     addSuggestion("ask-ai-empty", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                     break;
                 case 'files_fetched_highlights':
                     addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />);
                     addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                     addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, selectedFetcherFiles.size > 0, false, "Добавить выбранные файлы в поле запроса");
                     addSuggestion("ask-ai-highlights", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, selectedFetcherFiles.size > 0, false, "Добавить выбранные и сразу спросить AI");
                    break;
                 case 'files_selected':
                    addSuggestion("add-selected", "Добавить (+) => Запрос", () => triggerAddSelectedToKwork(false), <FaPlus />, true, false, "Добавить выбранные файлы в поле запроса");
                    addSuggestion("ask-ai-selected", "🤖 Спросить AI (с Добавл.)", async () => { await triggerAddSelectedToKwork(false); await triggerAskAi(); }, <FaRobot />, true, false, "Добавить выбранные и сразу спросить AI");
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
                     addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                     addSuggestion("goto-assistant-files", "К Файлам Ниже", () => scrollToSection('executor'), <FaEye />);
                     addSuggestion( effectiveBranch ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0, selectedAssistantFiles.size === 0 ? "Выбери файлы для коммита" : "" );
                     addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('prSection'), <FaRocket />);
                     break;
                 default: break;
             }

             // Clear All button available in most steps if there's something to clear
             if (fetcherRef?.current?.clearAll && !imageReplaceTask && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) {
                 addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaBroom/>, true);
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
        currentAiRequestId, imageReplaceTask,
        // Context triggers are generally stable, but include if they might change identity
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, fetcherRef
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
                // Optionally check if any were removed (less common to cause notification)
                // if (!changed) { for (const id of prevIds) { if (!currentIds.has(id)) { changed = true; break; } } }
            }

            // Only set notification if there was a change AND it's meaningful (not just loading indicator toggle)
            const meaningfulChange = Array.from(currentIds).some(id => !id.includes('loading-indicator') && id !== 'img-replace-status') || Array.from(prevIds).some(id => !id.includes('loading-indicator') && id !== 'img-replace-status');

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
        if(suggestion.disabled)return; logger.log("Buddy Click:",suggestion.id); if(suggestion.action){ const r=suggestion.action(); if(!suggestion.id.startsWith('goto-')&&suggestion.id!=='loading-indicator'&&suggestion.id!=='toggle-settings-close'&& suggestion.id!=='toggle-settings-open' && suggestion.id !== 'img-replace-status'){setIsOpen(false);} else if(suggestion.id.startsWith('goto-')){setTimeout(()=>setIsOpen(false),300);} if(r instanceof Promise){r.catch(err=>{logger.error(`Buddy action (${suggestion.id}) error:`, err); toast.error(`Действие "${suggestion.text}" не удалось.`);});} } else {setIsOpen(false);}
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