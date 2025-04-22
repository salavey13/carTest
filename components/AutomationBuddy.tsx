"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner"; // Assuming sonner is available
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowRotateRight, FaArrowsRotate, FaAngrycreative, FaPoo,
    FaList, FaCodeBranch, FaExclamation, FaImages // Added FaImages
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Context Import
import { useRepoXmlPageContext, FetchStatus, WorkflowStep } from "@/contexts/RepoXmlPageContext";

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS_BUDDY = 4000; // Slightly faster auto-open
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
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false); // Indicator state
    const previousSuggestionIds = useRef<Set<string>>(new Set()); // Store previous suggestion IDs

    // --- Context ---
    const {
        // States
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, // Read effective target branch
        manualBranchName, // Read manual input
        isSettingsModalOpen, // Read modal state
        isParsing,
        currentAiRequestId, // ID of request being monitored
        imageReplaceTask, // Get image replace task

        // Triggers
        triggerFetch = () => console.warn("triggerFetch not available"),
        triggerSelectHighlighted = () => console.warn("triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = async () => console.warn("triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => console.warn("triggerCopyKwork not available"),
        triggerAskAi = async () => { console.warn("triggerAskAi not available"); return { success: false, error: "Context unavailable" }; }, // Updated return type
        triggerParseResponse = async () => console.warn("triggerParseResponse not available"),
        triggerSelectAllParsed = () => console.warn("triggerSelectAllParsed not available"),
        triggerCreateOrUpdatePR = async () => console.warn("triggerCreateOrUpdatePR not available"), // Using the combined trigger
        triggerToggleSettingsModal = () => console.warn("triggerToggleSettingsModal not available"), // Settings modal toggle
        scrollToSection = () => console.warn("scrollToSection not available"),

        // Messages
        getXuinityMessage: getBaseMessage, // Use the base message logic

        // Refs (primarily for clearing)
        fetcherRef,

    } = useRepoXmlPageContext();

    // --- Get Welcoming Message (Uses Context's getXuinityMessage) ---
    const activeMessage = useMemo(() => getBaseMessage(), [getBaseMessage]);

    // --- Define Suggestions (Updated for Image Replace) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
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
                 let isDisabled = isAnyLoading && !['retry-fetch', 'toggle-settings-close', 'goto-'].some(prefix => id.startsWith(prefix));

                 // Specific overrides or conditions
                 if (id === 'toggle-settings-open' && !isAnyLoading) isDisabled = false;
                 if (disabled) isDisabled = true; // Explicitly passed disabled prop overrides

                 suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
            }
        };

        const settingsButtonId = isSettingsModalOpen ? 'toggle-settings-close' : 'toggle-settings-open';
        addSuggestion( settingsButtonId, isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)", triggerToggleSettingsModal, <FaCodeBranch />, true );

        // --- Suggestions based on Workflow Step ---
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
            // *** NEW: Suggestions for Image Replace Step ***
            case 'files_fetched_image_replace':
                 addSuggestion("loading-indicator-img", "Замена Картинки...", () => {}, <FaImages className="animate-pulse text-blue-400"/>, true, true );
                 addSuggestion("goto-pr-form-img", "К Статусу Задачи", () => scrollToSection('executor'), <FaRocket />); // Scroll to assistant where msg is shown
                 break;
            case 'files_fetched':
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("ask-ai-empty", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                 break;
            case 'files_fetched_highlights':
                 addSuggestion("select-highlighted", "Выбрать Связанные", triggerSelectHighlighted, <FaHighlighter />);
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("add-selected", "Добавить (+)", () => triggerAddSelectedToKwork(true), <FaPlus />, selectedFetcherFiles.size > 0);
                 addSuggestion("ask-ai-highlights", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                break;
            case 'files_selected':
                addSuggestion("add-selected", "Добавить (+) и Спросить AI", () => triggerAddSelectedToKwork(true), <FaPlus />);
                addSuggestion("ask-ai-selected", "🤖 Спросить AI (с тем что есть)", triggerAskAi, <FaRobot />);
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
                addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                break;
            case 'response_pasted':
                 addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, !aiResponseHasContent || !!imageReplaceTask, !aiResponseHasContent ? "Нет ответа" : (!!imageReplaceTask ? "Замена картинки" : "")); // Disable parse during img replace
                 addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('aiResponseInput'), <FaKeyboard />);
                break;
            case 'parsing_response':
                 addSuggestion("loading-indicator", "Разбор Ответа...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 break;
            case 'response_parsed': // Fallthrough intended
            case 'pr_ready':
                // Show PR/Update button ONLY if NOT an image replace task OR if image replace is finished (assistantLoading is false)
                if (!imageReplaceTask || (imageReplaceTask && !assistantLoading)) {
                    addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed && !imageReplaceTask); // Hide if image replace task was just done
                    addSuggestion("goto-assistant-files", "К Файлам Ниже", () => scrollToSection('executor'), <FaEye />);
                    addSuggestion( effectiveBranch ? "update-branch" : "create-pr", createOrUpdateActionText, triggerCreateOrUpdatePR, createOrUpdateIcon, selectedAssistantFiles.size > 0 && !imageReplaceTask, selectedAssistantFiles.size === 0 || !!imageReplaceTask, selectedAssistantFiles.size === 0 ? "Выбери файлы для коммита" : (!!imageReplaceTask ? "Замена картинки" : "") ); // Disable if image replace
                    addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('prSection'), <FaRocket />);
                } else if (imageReplaceTask && assistantLoading) {
                    // Show loading specifically for the image PR/update
                    addSuggestion("loading-indicator-pr", effectiveBranch ? "Обновляю ветку..." : "Создаю PR...", () => {}, <FaArrowsRotate className="animate-spin text-blue-400"/>, true, true );
                }
                break;
            default: break;
        }

        // --- Clear All Suggestion ---
        // Hide Clear All during image replace flow
         if (fetcherRef?.current?.clearAll && !imageReplaceTask && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) {
             addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaBroom/>, true);
         }

        return suggestionsList;

    }, [ // Dependencies
        currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles,
        kworkInputHasContent, aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs, isParsing, currentAiRequestId,
        targetBranchName, manualBranchName, isSettingsModalOpen, imageReplaceTask, // Added imageReplaceTask
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerToggleSettingsModal, scrollToSection, fetcherRef
    ]);


    // --- Suggestion Change Detection for Notification ---
    useEffect(() => {
        const currentIds = new Set(suggestions.map(s => s.id)); const prevIds = previousSuggestionIds.current;
        if (isOpen) { setHasNewSuggestions(false); previousSuggestionIds.current = currentIds; }
        else { let changed = currentIds.size !== prevIds.size; if (!changed) { for (const id of currentIds) { if (!prevIds.has(id)) { changed = true; break; } } if (!changed) { for (const id of prevIds) { if (!currentIds.has(id)) { changed = true; break; } } } }
            const meaningfulChange = Array.from(currentIds).some(id => !id.includes('loading-indicator')) || Array.from(prevIds).some(id => !id.includes('loading-indicator'));
            if (changed && meaningfulChange && !hasNewSuggestions) { setHasNewSuggestions(true); console.log("Buddy: New suggestions available!"); }
            if(changed) { previousSuggestionIds.current = currentIds; }
        }
    }, [suggestions, isOpen, hasNewSuggestions]);


    // --- Auto-open Timer ---
    useEffect(() => { let t:NodeJS.Timeout|null=null; if(!hasAutoOpened&&!isOpen){t=setTimeout(()=>{setIsOpen(true);setHasAutoOpened(true);},AUTO_OPEN_DELAY_MS_BUDDY);} return()=>{if(t)clearTimeout(t);}; }, [hasAutoOpened, isOpen]);
    // --- Handle Escape Key ---
    const handleEscKey = useCallback((e:KeyboardEvent) => { if(e.key==='Escape'&&isOpen)setIsOpen(false);}, [isOpen]);
    useEffect(() => { document.addEventListener('keydown',handleEscKey); return()=>{document.removeEventListener('keydown',handleEscKey);}; }, [handleEscKey]);

    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => { if(suggestion.disabled)return; console.log("Buddy Click:",suggestion.id); if(suggestion.action){ const r=suggestion.action(); if(!suggestion.id.startsWith('goto-')&&suggestion.id!=='loading-indicator'&&suggestion.id!=='toggle-settings-close'&& suggestion.id!=='toggle-settings-open'){setIsOpen(false);} else if(suggestion.id.startsWith('goto-')){setTimeout(()=>setIsOpen(false),300);} if(r instanceof Promise){r.catch(err=>{console.error(`Buddy action (${suggestion.id}) error:`, err); toast.error(`Действие "${suggestion.text}" не удалось.`);});} } else {setIsOpen(false);} };
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