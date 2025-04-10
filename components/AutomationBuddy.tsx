// /components/AutomationBuddy.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaCopy, FaListCheck, FaBug, FaSync, FaPlus, FaPaperPlane, FaBroom, FaCheck,
    FaRobot, FaArrowRotateRight, FaArrowsRotate, FaAngrycreative, FaPoo,
    FaList, FaCodeBranch, FaCog, FaExclamation // Added Cog and Exclamation
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
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false); // NEW: Indicator state
    const previousSuggestionIds = useRef<Set<string>>(new Set()); // Store previous suggestion IDs

    // --- Context ---
    const {
        // States
        currentStep, fetchStatus, repoUrlEntered, filesFetched,
        selectedFetcherFiles, kworkInputHasContent, aiResponseHasContent, filesParsed,
        selectedAssistantFiles, assistantLoading, aiActionLoading, loadingPrs,
        targetBranchName, manualBranchName, // Read branch states for context/text
        isSettingsModalOpen, // Read modal state

        // Triggers
        triggerFetch = () => console.warn("triggerFetch not available"),
        triggerSelectHighlighted = () => console.warn("triggerSelectHighlighted not available"),
        triggerAddSelectedToKwork = async () => console.warn("triggerAddSelectedToKwork not available"),
        triggerCopyKwork = () => console.warn("triggerCopyKwork not available"),
        triggerAskAi = async () => console.warn("triggerAskAi not available"),
        triggerParseResponse = async () => console.warn("triggerParseResponse not available"),
        triggerSelectAllParsed = () => console.warn("triggerSelectAllParsed not available"),
        triggerCreatePR = async () => console.warn("triggerCreatePR not available"), // Points to combined create/update handler
        triggerToggleSettingsModal = () => console.warn("triggerToggleSettingsModal not available"), // Settings modal toggle
        scrollToSection = () => console.warn("scrollToSection not available"),

        // Messages
        getXuinityMessage: getBaseMessage, // Use the base message logic

        // Refs (primarily for clearing)
        fetcherRef,

    } = useRepoXmlPageContext();

    // --- Get Welcoming Message ---
    // Overrides the base context message for a friendlier tone
    const getXuinityMessage = useCallback((): string => {
        const effectiveBranch = manualBranchName.trim() || targetBranchName;
        const branchInfo = effectiveBranch ? ` (ветка: ${effectiveBranch})` : '';
        const settingsIcon = "<FaCog className='inline mx-1 text-cyan-400'/>"; // Represent icon in text

        switch (currentStep) {
          case 'idle': return `Йо! Готов(а) кодить в потоке? ✨ Начнем!`;
          case 'need_repo_url': return `Давай начнем! Открой настройки ${settingsIcon}, чтобы указать ссылку на GitHub репо.`;
          case 'ready_to_fetch': return repoUrlEntered ? `Репо есть! 👍 Жми "Извлечь файлы"${branchInfo} или загляни в настройки ${settingsIcon} для выбора ветки/PR.` : `Сначала укажи URL репо в настройках ${settingsIcon}.`;
          case 'fetching': return `Минутку, получаю код из ${branchInfo}... ⏳`;
          case 'fetch_failed': return `Упс! 😬 Не смог получить файлы${branchInfo}. Проверь ссылку/токен/ветку в настройках ${settingsIcon} или попробуй снова?`;
          case 'files_fetched': return `Код здесь! ✅ Выбери нужные файлы для AI или чекни настройки ${settingsIcon} для другой ветки.`;
          case 'files_fetched_highlights': return `Есть связанные файлы! 😎 Выбери их или настрой контекст сам(а). Ветку можно сменить в ${settingsIcon}.`;
          case 'files_selected': return `Отлично, файлы выбраны${branchInfo}! Добавь их в запрос кнопкой (+) или сразу жми "🤖 Спросить AI"!`;
          case 'request_written': return `Запрос готов! 🔥 Отправляй его AI ("🤖 Спросить AI") или скопируй для другого бота.`;
          case 'generating_ai_response': return `Общаюсь с AI... 🤖💭 Магия происходит!`;
          case 'request_copied': return `Скопировано! ✅ Жду ответ от твоего AI. Вставляй его в Ассистента ниже.`;
          case 'response_pasted': return `Ответ получен! 🤘 Нажми '➡️' рядом с полем ввода, чтобы я его разобрал.`;
          case 'parsing_response': return `Анализирую ответ AI... 🧠 Почти готово!`;
          case 'response_parsed': return `Разобрал! 💪 Проверь результат, выбери файлы и можно создавать/обновлять PR!`;
          case 'pr_ready': return assistantLoading
                               ? (effectiveBranch ? `Обновляю ветку ${branchInfo}...` : "Создаю PR...")
                               : (effectiveBranch ? `Готов(а) обновить ветку ${branchInfo}?` : "Готов(а) создать Pull Request?");
          default: return "Что дальше? 😉"; // Default friendly message
        }
      }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, targetBranchName, manualBranchName]); // Dependencies

    const activeMessage = useMemo(() => getXuinityMessage(), [getXuinityMessage]);


    // --- Define Suggestions (Updated for Modal & Tone) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        const isFetcherLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
        const isAnyLoading = isFetcherLoading || assistantLoading || aiActionLoading || loadingPrs;
        const effectiveBranch = manualBranchName.trim() || targetBranchName;
        const branchInfo = effectiveBranch ? ` (${effectiveBranch})` : ' (default)';

        const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            if (condition) {
                // Disable most actions when *anything* is loading, except retries and toggling settings *off*
                const isDisabled = disabled || (isAnyLoading && !['retry-fetch', 'loading-indicator', 'toggle-settings'].includes(id));
                // Special case: Allow closing settings even if loading
                if (id === 'toggle-settings' && isSettingsModalOpen) {
                     suggestionsList.push({ id, text, action, icon, disabled: false, tooltip }); // Always allow closing
                } else {
                     suggestionsList.push({ id, text, action, icon, disabled: isDisabled, tooltip });
                }
            }
        };

        // --- Core Suggestions ---

        // Settings Modal Toggle (Always available, conditionally disabled)
        addSuggestion(
            "toggle-settings",
            isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)",
            triggerToggleSettingsModal,
            <FaCog />,
            true
        );

        // Main Actions based on step
        switch (currentStep) {
            case 'ready_to_fetch':
                addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, triggerFetch, <FaDownload />, true, !repoUrlEntered, !repoUrlEntered ? "URL?" : "");
                break;
            case 'fetching':
                addSuggestion("loading-indicator", `Загрузка Файлов${branchInfo}...`, () => {}, <FaArrowsRotate className="animate-spin"/>, true, true );
                break;
            case 'fetch_failed':
                addSuggestion("retry-fetch", `Попробовать Снова${branchInfo}?`, () => triggerFetch(true), <FaArrowRotateRight />, true, isAnyLoading);
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
                addSuggestion("ask-ai-written", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                addSuggestion("copy-kwork", "Скопировать Запрос", triggerCopyKwork, <FaCopy />, true, !kworkInputHasContent, !kworkInputHasContent ? "Запрос пуст" : "");
                addSuggestion("goto-kwork", "К Полю Запроса", () => scrollToSection('kworkInput'), <FaKeyboard />);
                break;
            case 'generating_ai_response':
                 addSuggestion("loading-indicator", "AI Думает...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 break;
            case 'request_copied':
                addSuggestion("goto-ai-response", "К Полю Ответа AI", () => scrollToSection('aiResponseInput'), <FaArrowRight />);
                addSuggestion("parse-response", "Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, aiResponseHasContent, !aiResponseHasContent, !aiResponseHasContent ? "Вставь ответ AI" : "");
                break;
            case 'response_pasted':
                 addSuggestion("parse-response", "➡️ Разобрать Ответ", triggerParseResponse, <FaWandMagicSparkles />, true, !aiResponseHasContent, !aiResponseHasContent ? "Нет ответа" : "");
                 addSuggestion("goto-ai-response", "К Полю Ответа", () => scrollToSection('aiResponseInput'), <FaKeyboard />);
                break;
            case 'parsing_response':
                 addSuggestion("loading-indicator", "Разбор Ответа...", () => {}, <FaBrain className="animate-pulse"/>, true, true );
                 break;
            case 'response_parsed':
            case 'pr_ready': // Combine suggestions for these states
                 addSuggestion("select-all-parsed", "Выбрать Все Файлы", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                 addSuggestion("goto-assistant-files", "К Файлам Ниже", () => scrollToSection('assistant'), <FaEye />);
                 if (effectiveBranch) {
                      addSuggestion("update-branch", `Обновить Ветку '${effectiveBranch}'`, triggerCreatePR, <FaCodeBranch />, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0, "Выбери файлы");
                 } else {
                      addSuggestion("create-pr", "Создать PR", triggerCreatePR, <FaGithub />, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0, "Выбери файлы");
                 }
                 addSuggestion("goto-pr-form", "К Форме PR/Ветки", () => scrollToSection('prSection'), <FaRocket />);
                break;
            default:
                 // If idle or unknown, main suggestion is usually to open settings
                 break;
        }

        // --- Clear All Suggestion ---
        // Use optional chaining for safety, check if clearAll exists on the ref's current value
         if (fetcherRef?.current?.clearAll && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) {
             addSuggestion("clear-all", "Очистить Все?", fetcherRef.current.clearAll, <FaBroom/>, true, isAnyLoading); // Use Broom icon
         }

        // Final processing (no changes needed here, happens in addSuggestion)
        return suggestionsList;

    }, [ // Dependencies
        currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles,
        kworkInputHasContent, aiResponseHasContent, filesParsed, selectedAssistantFiles,
        assistantLoading, aiActionLoading, loadingPrs, targetBranchName, manualBranchName,
        isSettingsModalOpen, // Need modal state for toggle button logic
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        triggerToggleSettingsModal, // Need toggle trigger
        scrollToSection, fetcherRef // Need ref for clearAll access
    ]);


    // --- Suggestion Change Detection for Notification ---
    useEffect(() => {
        const currentIds = new Set(suggestions.map(s => s.id));

        if (isOpen) {
            // Reset notification when buddy is opened
            setHasNewSuggestions(false);
            // Update previous suggestions when opened, so closing doesn't immediately trigger notification
             previousSuggestionIds.current = currentIds;
        } else {
            // Check for changes only when closed
            let changed = currentIds.size !== previousSuggestionIds.current.size;
            if (!changed) {
                for (const id of currentIds) {
                    if (!previousSuggestionIds.current.has(id)) {
                        changed = true;
                        break;
                    }
                }
            }
            // Set notification flag if suggestions changed meaningfully (ignore just loading indicators changing)
             const meaningfulChange = Array.from(currentIds).some(id => !id.includes('loading-indicator')) ||
                                     Array.from(previousSuggestionIds.current).some(id => !id.includes('loading-indicator'));

            if (changed && meaningfulChange) {
                // Only set to true if not already true
                if (!hasNewSuggestions) {
                     setHasNewSuggestions(true);
                     console.log("Buddy: New suggestions available!");
                }
            }
            // Update previous suggestions reference *only when closing* or when suggestions change while closed
            // Let's update it here directly after comparison
             previousSuggestionIds.current = currentIds;

        }
    // Run whenever suggestions change OR when the buddy opens/closes
    }, [suggestions, isOpen, hasNewSuggestions]);


    // --- Auto-open Timer ---
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (!hasAutoOpened && !isOpen) {
             timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS_BUDDY);
        }
        return () => { if (timer) clearTimeout(timer); }; // Cleanup timer
    }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen) { setIsOpen(false); }
    }, [isOpen]);
    useEffect(() => {
        document.addEventListener('keydown', handleEscKey);
        return () => { document.removeEventListener('keydown', handleEscKey); };
    }, [handleEscKey]);


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        console.log("Automation Buddy Suggestion Clicked:", suggestion.id, suggestion.text);
        if (suggestion.action) {
            const result = suggestion.action();
            // Close immediately unless it's a scroll, settings toggle, or loading indicator
            if (!suggestion.id.startsWith('goto-') && suggestion.id !== 'loading-indicator' && suggestion.id !== 'toggle-settings') {
                setIsOpen(false);
            } else if (suggestion.id.startsWith('goto-')) {
                 // Delay closing for scroll actions to let scroll finish
                 setTimeout(() => setIsOpen(false), 300);
            } // Keep open for settings toggle and loading indicators

            // Handle potential promise errors from async actions
            if (result instanceof Promise) {
                result.catch(err => {
                     console.error(`Error executing buddy action (${suggestion.id}):`, err);
                     // Optionally show a toast message on error
                     toast.error(`Действие "${suggestion.text}" не удалось.`);
                });
            }
        } else {
             // Close if no action defined (shouldn't happen often with defined actions)
             setIsOpen(false);
        }
    };

    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation(); // Prevent closing when clicking inside dialog
    const handleFabClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) { // If opening
             setHasAutoOpened(true); // Mark as manually opened/interacted
             setHasNewSuggestions(false); // Clear notification on open
        }
    };


    // --- Render Logic ---
    return (
        <AnimatePresence>
            {isOpen ? (
                // --- Dialog Overlay & Content ---
                <motion.div
                    key="buddy-dialog-overlay"
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 bg-black bg-opacity-60 backdrop-blur-sm" // Slightly darker overlay
                    onClick={handleOverlayClick}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                    aria-modal="true" role="dialog" aria-labelledby="buddy-suggestions-title"
                >
                    <motion.div
                        variants={containerVariants} initial="hidden" animate="visible" exit="exit"
                        className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-end bg-transparent" // Dialog container
                        onClick={handleDialogClick} // Prevent closing on inner click
                    >
                        <h2 id="buddy-suggestions-title" className="sr-only">Automation Buddy Suggestions</h2>
                        {/* Speech Bubble with Message */}
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />
                        {/* Character & Suggestions List */}
                        <div className="flex flex-col sm:flex-row-reverse items-center sm:items-end w-full gap-4 mt-2">
                            <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                            <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-end" />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                // --- Floating Action Button (FAB) ---
                <div className="fixed bottom-4 right-4 z-50">
                    <motion.div variants={fabVariants} initial="hidden" animate="visible" exit="exit" className="relative">
                         <FloatingActionButton
                            onClick={handleFabClick}
                            icon={<FaAngrycreative className="text-xl" />} // Main icon
                            className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl" // Styling
                            aria-label="Open Automation Buddy"
                         />
                         {/* NEW: Notification Badge */}
                         <AnimatePresence>
                              {hasNewSuggestions && (
                                   <motion.div
                                        key="buddy-notification"
                                        variants={notificationVariants}
                                        initial="hidden" animate="visible" exit="exit"
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-gray-900 shadow-md"
                                        aria-hidden="true" // Decorative element
                                   >
                                        <FaExclamation className="text-white text-xs" />
                                   </motion.div>
                              )}
                         </AnimatePresence>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
export default AutomationBuddy;