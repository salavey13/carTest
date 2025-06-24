"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaExclamation, FaSpinner } from "react-icons/fa6";
import { FloatingActionButton } from "./stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "./stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "./stickyChat_components/CharacterDisplay";
import { SuggestionList } from "./stickyChat_components/SuggestionList";
import { useRepoXmlPageContext, WorkflowStep } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from '@/lib/debugLogger';
import useInactivityTimer from "@/hooks/useInactivityTimer";
import VibeContentRenderer from './VibeContentRenderer';

// --- Constants & Types ---
const INACTIVITY_TIMEOUT_MS = 60000;
const BUDDY_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const BUDDY_ALT_TEXT = "Automation Buddy";
interface Suggestion { id: string; text: string; action?: () => any; icon?: React.ReactNode; disabled?: boolean; tooltip?: string; }

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0, x: 300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: 300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0, rotate: 45 }, visible: { scale: 1, opacity: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }, exit: { scale: 0, opacity: 0, rotate: -45, transition: { duration: 0.2 } } };
const notificationVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } }, exit: { scale: 0, opacity: 0 } };

// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const hasOpenedDueToInactivityRef = useRef(false);
    
    // Using the context directly for state and triggers
    const context = useRepoXmlPageContext();
    const { getXuinityMessage, ...triggers } = context;

    useInactivityTimer(INACTIVITY_TIMEOUT_MS, () => {
        if (!isOpen && !hasOpenedDueToInactivityRef.current && context.showComponents) {
            setIsOpen(true);
            hasOpenedDueToInactivityRef.current = true;
        }
    }, undefined, "AutomationBuddy");
    
    const activeMessage = useMemo(() => {
        return typeof getXuinityMessage === 'function' ? getXuinityMessage() : "Analyzing...";
    }, [getXuinityMessage]);

    const suggestions = useMemo((): Suggestion[] => {
        if (!triggers.triggerFetch) return []; // Context not ready
        
        const {
            currentStep, fetchStatus, repoUrlEntered, filesFetched, selectedFetcherFiles, kworkInputHasContent,
            aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
            loadingPrs, targetBranchName, manualBranchName, isParsing, imageReplaceTask
        } = triggers;

        const isAnyLoading = fetchStatus === 'loading' || fetchStatus === 'retrying' || assistantLoading || isParsing || aiActionLoading || loadingPrs;
        const suggestionsList: Suggestion[] = [];
        
        if (imageReplaceTask) {
             suggestionsList.push({ id: 'img-task-active', text: "Задача: Замена Картинки", icon: <VibeContentRenderer content="::FaImages::" />, disabled: true, tooltip: "Авто-процесс активен." });
             return suggestionsList;
        }

        switch (currentStep) {
            case 'idle':
            case 'ready_to_fetch':
                if(repoUrlEntered) suggestionsList.push({ id: 'fetch', text: `Извлечь Файлы`, action: triggers.triggerFetch, icon: <VibeContentRenderer content="::FaDownload::" /> });
                break;
            case 'fetch_failed':
                suggestionsList.push({ id: 'retry-fetch', text: "Ошибка! Попробовать Снова?", action: () => triggers.triggerFetch(true), icon: <VibeContentRenderer content="::FaArrowRotateRight className='text-red-400'::" /> });
                break;
            case 'files_fetched':
            case 'files_fetched_highlights':
                if (triggers.primaryHighlightedPath) suggestionsList.push({ id: 'select-highlighted', text: "Выбрать Связанные", action: triggers.triggerSelectHighlighted, icon: <VibeContentRenderer content="::FaHighlighter::" /> });
                if (selectedFetcherFiles.size > 0) suggestionsList.push({ id: 'add-selected', text: `В Контекст (${selectedFetcherFiles.size})`, action: triggers.triggerAddSelectedToKwork, icon: <VibeContentRenderer content="::FaPlus::" /> });
                if (!kworkInputHasContent) suggestionsList.push({ id: 'goto-kwork-empty', text: "Написать Запрос AI?", action: () => triggers.scrollToSection('kwork-input-section'), icon: <VibeContentRenderer content="::FaKeyboard::" /> });
                break;
            case 'files_selected':
            case 'request_written':
                if (selectedFetcherFiles.size > 0) suggestionsList.push({ id: 'add-selected', text: `В Контекст (${selectedFetcherFiles.size})`, action: triggers.triggerAddSelectedToKwork, icon: <VibeContentRenderer content="::FaPlus::" /> });
                if (kworkInputHasContent) suggestionsList.push({ id: 'copy-kwork', text: "Скопировать Запрос", action: triggers.triggerCopyKwork, icon: <VibeContentRenderer content="::FaCopy::" /> });
                break;
            case 'request_copied':
            case 'response_pasted':
                 if (aiResponseHasContent) suggestionsList.push({ id: 'parse-response', text: "➡️ Разобрать Ответ", action: triggers.triggerParseResponse, icon: <VibeContentRenderer content="::FaWandMagicSparkles::" /> });
                break;
            case 'pr_ready':
                const actionText = targetBranchName ? `Обновить Ветку` : "Создать PR";
                const actionIcon = targetBranchName ? "::FaCodeBranch::" : "::FaGithub::";
                if (filesParsed) suggestionsList.push({ id: 'create-pr', text: actionText, action: triggers.triggerCreateOrUpdatePR, icon: <VibeContentRenderer content={actionIcon} />, disabled: selectedAssistantFiles.size === 0 });
                if (filesParsed) suggestionsList.push({ id: 'select-all-parsed', text: "Выбрать Все", action: triggers.triggerSelectAllParsed, icon: <VibeContentRenderer content="::FaListCheck::" /> });
                break;
            default: break;
        }

        if (isAnyLoading) {
            suggestionsList.unshift({ id: 'loading', text: 'Обработка...', icon: <VibeContentRenderer content="::FaSpinner className='animate-spin'::" />, disabled: true });
        }
        
        return suggestionsList;
    }, [getXuinityMessage, triggers]);
    
    const handleFabClick = () => { setIsOpen(prev => !prev); hasOpenedDueToInactivityRef.current = true; };
    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();

    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="buddy-overlay" className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-2 sm:p-4 w-full max-w-xs sm:max-w-sm flex flex-col items-center bg-transparent" onClick={handleDialogClick}>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="right" />
                        <div className="flex flex-col-reverse sm:flex-row items-center sm:items-end w-full gap-2 mt-2">
                            <div className="flex-grow w-full">
                                <SuggestionList suggestions={suggestions} onSuggestionClick={(s) => { if(s.action) s.action(); setIsOpen(false); }} listVariants={childVariants} itemVariants={childVariants} className="items-stretch sm:items-end" />
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
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
export default AutomationBuddy;