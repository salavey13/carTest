// /components/AutomationBuddy.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRepoXmlPageContext, WorkflowStep } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from '@/lib/debugLogger';
import useInactivityTimer from "@/hooks/useInactivityTimer";

// Subcomponents
import { FloatingActionButton } from "./stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "./stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "./stickyChat_components/CharacterDisplay";
import { SuggestionList } from "./stickyChat_components/SuggestionList";
import VibeContentRenderer from './VibeContentRenderer';

// --- Constants & Types ---
const INACTIVITY_TIMEOUT_MS = 60000;
const BUDDY_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const BUDDY_ALT_TEXT = "Automation Buddy";
interface Suggestion { id: string; text: string; action?: () => any; icon?: React.ReactNode; disabled?: boolean; tooltip?: string; }

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08 } }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } } };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } } };
const fabVariants = { hidden: { scale: 0, opacity: 0, rotate: 45 }, visible: { scale: 1, opacity: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }, exit: { scale: 0, opacity: 0, rotate: -45, transition: { duration: 0.2 } } };
const notificationVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } }, exit: { scale: 0, opacity: 0 } };

const AutomationBuddy: React.FC = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const hasOpenedDueToInactivityRef = useRef(false);
    const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
    const previousSuggestionIds = useRef<Set<string>>(new Set());
    
    const context = useRepoXmlPageContext();
    const { getXuinityMessage, ...triggers } = context;

    // Inactivity timer to prompt the user
    useInactivityTimer(INACTIVITY_TIMEOUT_MS, () => {
        if (isMounted && !isOpen && !hasOpenedDueToInactivityRef.current && context.showComponents) {
            logger.log("[AutomationBuddy] Inactivity detected, auto-opening.");
            setIsOpen(true);
            hasOpenedDueToInactivityRef.current = true;
            setHasNewSuggestions(false);
        }
    }, undefined, "AutomationBuddy");
    
    const activeMessage = useMemo(() => {
        if (!isMounted) return "Загрузка...";
        return typeof getXuinityMessage === 'function' ? getXuinityMessage() : "Анализ ситуации...";
    }, [isMounted, getXuinityMessage]);

    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        if (!isMounted || !triggers.triggerFetch) return [];

        const {
            currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles, kworkInputHasContent,
            aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
            loadingPrs, targetBranchName, manualBranchName, isParsing, currentAiRequestId, imageReplaceTask
        } = triggers;

        const isAnyLoading = fetchStatus === 'loading' || fetchStatus === 'retrying' || assistantLoading || isParsing || aiActionLoading || loadingPrs;
        const effectiveBranch = manualBranchName?.trim() || targetBranchName || 'default';
        const createOrUpdateActionText = targetBranchName ? `Обновить Ветку '${targetBranchName}'` : "Создать PR";

        // This function encapsulates adding a suggestion to the list with all checks
        const add = (id: string, text: string, action: (() => any) | undefined, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            if (condition) {
                const finalDisabled = disabled || isAnyLoading; // Global loading state check
                suggestionsList.push({ id, text, action: action || (() => {}), icon, disabled: finalDisabled, tooltip });
            }
        };

        if (imageReplaceTask) {
            add('img-task-active', "Задача: Замена Картинки", undefined, <VibeContentRenderer content="::FaImages::" />, true, true, "Автоматический процесс замены изображения активен.");
            return suggestionsList;
        }

        switch (currentStep) {
            case 'idle':
            case 'ready_to_fetch':
                add('fetch', `Извлечь Файлы (${effectiveBranch})`, triggers.triggerFetch, <VibeContentRenderer content="::FaDownload::" />, repoUrlEntered);
                break;
            case 'fetch_failed':
                add('retry-fetch', "Ошибка! Попробовать Снова?", triggers.triggerFetch, <VibeContentRenderer content="::FaArrowRotateRight className='text-red-400'::" />);
                break;
            case 'files_fetched':
            case 'files_fetched_highlights':
                add('select-highlighted', "Выбрать Связанные", triggers.triggerSelectHighlighted, <VibeContentRenderer content="::FaHighlighter::" />);
                add('add-selected', `В Контекст (${selectedFetcherFiles.size})`, triggers.triggerAddSelectedToKwork, <VibeContentRenderer content="::FaPlus::" />, selectedFetcherFiles.size > 0);
                add('copy-kwork', "Скопировать Запрос", triggers.triggerCopyKwork, <VibeContentRenderer content="::FaCopy::" />, kworkInputHasContent);
                break;
            case 'files_selected':
            case 'request_written':
                add('add-selected', `В Контекст (${selectedFetcherFiles.size})`, triggers.triggerAddSelectedToKwork, <VibeContentRenderer content="::FaPlus::" />, selectedFetcherFiles.size > 0);
                add('copy-kwork', "Скопировать Запрос", triggers.triggerCopyKwork, <VibeContentRenderer content="::FaCopy::" />, kworkInputHasContent);
                break;
            case 'request_copied':
            case 'response_pasted':
                add('parse-response', "➡️ Разобрать Ответ", triggers.triggerParseResponse, <VibeContentRenderer content="::FaWandMagicSparkles::" />, aiResponseHasContent);
                break;
            case 'pr_ready':
                add('create-pr', createOrUpdateActionText, triggers.triggerCreateOrUpdatePR, <VibeContentRenderer content={targetBranchName ? "::FaCodeBranch::" : "::FaGithub::"} />, selectedAssistantFiles.size > 0);
                add('select-all-parsed', "Выбрать Все", triggers.triggerSelectAllParsed, <VibeContentRenderer content="::FaListCheck::" />, filesParsed);
                break;
        }

        if (isAnyLoading) {
            let loadingText = "Обработка...";
            if (fetchStatus === 'loading' || fetchStatus === 'retrying') loadingText = "Загрузка...";
            if (isParsing) loadingText = "Разбор ответа...";
            if (aiActionLoading) loadingText = `Жду AI...`;
            add('loading-indicator', loadingText, undefined, <VibeContentRenderer content="::FaSpinner className='animate-spin'::" />, true, true);
        }

        return suggestionsList;
    }, [isMounted, getXuinityMessage, triggers]);
    
    // --- Lifecycle & Handlers ---
    useEffect(() => { setIsMounted(true); }, []);
    
    useEffect(() => {
        if (!isMounted || isOpen) {
            if(isOpen) setHasNewSuggestions(false);
            return;
        }
        const currentIds = new Set(suggestions.map(s => s.id));
        const prevIds = previousSuggestionIds.current;
        const hasMeaningfulChange = suggestions.length !== prevIds.size || ![...currentIds].every(id => prevIds.has(id));
        if (hasMeaningfulChange && !suggestions.every(s => s.id.includes('loading'))) {
            setHasNewSuggestions(true);
        }
        previousSuggestionIds.current = currentIds;
    }, [isMounted, suggestions, isOpen]);

    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled || !suggestion.action) return;
        suggestion.action();
        if (!suggestion.id.includes('toggle-settings')) {
            setIsOpen(false);
        }
    };
    
    const handleFabClick = () => {
        const newIsOpenState = !isOpen;
        setIsOpen(newIsOpenState);
        if (newIsOpenState) {
            hasOpenedDueToInactivityRef.current = true;
            setHasNewSuggestions(false);
        } else {
            requestAnimationFrame(() => document.body.focus());
        }
    };

    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();

    // The component render logic
    if (!isMounted || !context.showComponents) return null;

    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="buddy-dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-2 sm:p-4 w-full max-w-xs sm:max-w-sm flex flex-col items-center sm:items-end bg-transparent" onClick={handleDialogClick}>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />
                        <div className="flex flex-col-reverse sm:flex-row items-center sm:items-end w-full gap-2 sm:gap-4 mt-2">
                            <div className="flex-grow w-full">
                                <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-stretch sm:items-end" />
                            </div>
                            <CharacterDisplay characterImageUrl={BUDDY_IMAGE_URL} characterAltText={BUDDY_ALT_TEXT} githubProfile={null} variants={childVariants} />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                <div className="fixed bottom-[80px] sm:bottom-4 right-4 z-40">
                    <motion.div variants={fabVariants} initial="hidden" animate="visible" exit="exit" className="relative">
                         <FloatingActionButton 
                            onClick={handleFabClick} 
                            icon={<VibeContentRenderer content="::FaAngrycreative::" />} 
                            className="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl rounded-full"
                            aria-label="Открыть Automation Buddy"
                         />
                         <AnimatePresence>
                             {hasNewSuggestions && (
                                 <motion.div key="buddy-notification" variants={notificationVariants} initial="hidden" animate="visible" exit="exit" className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-gray-900 shadow-md">
                                     <VibeContentRenderer content="::FaExclamation::" className="text-white text-xs" />
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