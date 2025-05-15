"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard,
    FaPaperPlane, FaLightbulb, FaImages, FaSquareArrowUpRight, FaFileImport,
    FaClipboardList, FaCircleCheck, FaCommentDots 
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";
import { ImageReplaceTool } from "@/components/stickyChat_components/ImageReplaceTool";
import { toast } from "sonner";

// Import Context & Actions
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";
import { debugLogger as logger, type LogRecord } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";
import useInactivityTimer from "@/hooks/useInactivityTimer"; 
import { checkAndUnlockFeatureAchievement, Achievement } from "@/hooks/cyberFitnessSupabase"; 

// --- Constants & Types ---
const INACTIVITY_TIMEOUT_MS = 60000; 
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Найми меня! ✨";
const REPLACE_IMAGE_ID = "replace-image-trigger";
const ADD_NEW_ID = "add-new"; 
const HIRE_ME_ID = "hire-me";
const COPY_LOGS_ID = "copy-logs"; 

interface Suggestion { id: string; text: string; link?: string; action?: () => void; icon?: React.ReactNode; isHireMe?: boolean; isFixAction?: boolean; isImageReplaceAction?: boolean; disabled?: boolean; tooltip?: string; }
interface GitHubProfile { login: string; avatar_url: string; html_url: string; name?: string | null; }

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0, x: -300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: -300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = {
  hidden: { scale: 0, opacity: 0, rotate: -45 },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 260, damping: 20 }
  },
  exit: { scale: 0, opacity: 0, rotate: 45, transition: { duration: 0.2 } }
};

// --- Helper Functions ---
const isValidUrl = (url: string): boolean => { if (!url) return false; try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol); } catch (_) { return false; } };
const isImageUrl = (url: string): boolean => { if (!url || !isValidUrl(url)) { return false; } const knownImageServiceHosts = ['placehold.co', 'via.placeholder.com', 'picsum.photos', 'dummyimage.com', 'source.unsplash.com']; const imageFormatSegmentsOrExt = /\.(png|jpg|jpeg|gif|webp|svg)$|\/(png|jpg|jpeg|gif|webp|svg)([\/?#]|$)/i; try { const parsedUrl = new URL(url); const pathnameLower = parsedUrl.pathname.toLowerCase(); const hostnameLower = parsedUrl.hostname.toLowerCase(); if (imageFormatSegmentsOrExt.test(pathnameLower)) { return true; } if (knownImageServiceHosts.some(host => hostnameLower.endsWith(host))) { return parsedUrl.pathname !== '/'; } if (hostnameLower.includes('githubusercontent.com') && pathnameLower.includes('/u/')) { return true; } if (hostnameLower.includes('googleusercontent.com') && pathnameLower.includes('/a/')) { return true; } return false; } catch (e) { console.error("[StickyChatButton] Error parsing URL in isImageUrl:", e); return false; } };

// --- Main Component (Orchestrator) ---
const StickyChatButton: React.FC = () => {
    logger.debug("[StickyChatButton] START Render");
    // --- State ---
    const [isOpen, setIsOpen] = useState(false); 
    const hasOpenedDueToInactivityRef = useRef(false); 
    const [activeMessage, setActiveMessage] = useState<string>("Загрузка..."); 
    const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null); 
    const [githubLoading, setGithubLoading] = useState<boolean>(false); 
    const [prevGithubLoading, setPrevGithubLoading] = useState<boolean>(false); 
    const [customIdea, setCustomIdea] = useState<string>(""); 
    const [potentialOldImageUrl, setPotentialOldImageUrl] = useState<string | null>(null); 
    const [showReplaceTool, setShowReplaceTool] = useState<boolean>(false);
    const [logsCopied, setLogsCopied] = useState(false); 
    
    // --- Hooks ---
    const currentPath = usePathname(); 
    const router = useRouter(); 
    const { user: appContextUser, isLoading: isAppLoading, dbUser } = useAppContext(); // appContextUser.id is TG ID (number), dbUser.user_id is Supabase Auth ID (string)
    const { success: toastSuccess, error: toastError, info: toastInfo, addToast } = useAppToast();

    const enableInactivityOpen = currentPath !== '/repo-xml';
    useInactivityTimer(
        INACTIVITY_TIMEOUT_MS,
        () => { 
            if (enableInactivityOpen && !isOpen && !hasOpenedDueToInactivityRef.current) {
                logger.log("[StickyChatButton] Inactivity detected, auto-opening.");
                setIsOpen(true);
                hasOpenedDueToInactivityRef.current = true;
            }
        },
        undefined, 
        "StickyChatButton"
    );

    useEffect(() => { 
        logger.debug(`[StickyChatButton Effect GitHubProfile] isOpen: ${isOpen}, isAppLoading: ${isAppLoading}, appContextUser: ${!!appContextUser}, githubProfile: ${!!githubProfile}, githubLoading: ${githubLoading}`);
        setPrevGithubLoading(githubLoading); 
        if (isOpen && !isAppLoading && appContextUser?.username && !githubProfile && !githubLoading) { 
            const fetchProfile = async () => { 
                logger.info(`[StickyChatButton Effect GitHubProfile] Fetching GitHub profile for ${appContextUser.username}`);
                setGithubLoading(true); 
                const result = await getGitHubUserProfile(appContextUser.username!); 
                if (result.success && result.profile) { 
                    setGithubProfile(result.profile); 
                    logger.info(`[StickyChatButton Effect GitHubProfile] Fetched profile: ${result.profile.login}`);
                } else { 
                    logger.warn("[StickyChatButton Effect GitHubProfile] GitHub fetch failed:", result.error); 
                    setGithubProfile(null); 
                } 
                setGithubLoading(false); 
            }; 
            fetchProfile(); 
        } 
        if (!appContextUser) { 
            setGithubProfile(null); 
            setGithubLoading(false); 
            logger.debug("[StickyChatButton Effect GitHubProfile] No appContextUser, cleared GitHub profile state.");
        } 
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading]);

    const handleCopyLogs = useCallback(async () => {
        const plannedAction = "[StickyChatButton] Plan: Copy internal logs to clipboard.";
        if (typeof logger === 'undefined' || typeof logger.getInternalLogRecords !== 'function') {
             logger.error("[StickyChatButton] Error: logger is not defined or not initialized!");
             toastError("Ошибка: Логгер недоступен для копирования.");
             return;
        }
        logger.info(plannedAction);
        let success = false;
        try {
            if (!navigator?.clipboard?.writeText) {
                throw new Error("Clipboard API (writeText) not available or not permitted in this context.");
            }
            const logRecords: ReadonlyArray<LogRecord> = logger.getInternalLogRecords();
            if (logRecords.length === 0) {
                logger.warn("[StickyChatButton] HasBeenPlanter: Copy logs failed - No logs found.");
                toastInfo("Нет логов для копирования.");
                return; 
            }
            const formattedLogs = logRecords.map(log =>
                `[${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase().padEnd(5)}: ${log.message}`
            ).join("\n");

            await navigator.clipboard.writeText(formattedLogs);
            success = true; 
            logger.info(`[StickyChatButton] HasBeenPlanter: Copy logs SUCCESS - Copied ${logRecords.length} records.`);
            toastSuccess("Логи скопированы в буфер обмена!");
            setLogsCopied(true);
            setTimeout(() => setLogsCopied(false), 2000); 

            if (dbUser?.user_id) { // Use dbUser.user_id (string) for Supabase
                logger.debug(`[StickyChatButton handleCopyLogs] Attempting to log 'copy_logs_used' for user ${dbUser.user_id}.`);
                const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'copy_logs_used');
                newAchievements?.forEach(ach => {
                    addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                    logger.info(`[StickyChatButton handleCopyLogs] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
                });
            } else {
                logger.warn("[StickyChatButton handleCopyLogs] Cannot log 'copy_logs_used': dbUser.user_id is missing.");
            }

        } catch (err: any) {
            success = false;
            logger.error("[StickyChatButton] HasBeenPlanter: Copy logs FAILED.", { plannedAction, error: err?.message ?? err });
            toastError(`Не удалось скопировать логи: ${err?.message ?? 'Unknown error'}`);
        }
    }, [toastSuccess, toastError, toastInfo, dbUser?.user_id, addToast]);

    const suggestions = useMemo((): Suggestion[] => {
        const baseSuggestions: Suggestion[] = []; const isToolPage = currentPath === '/repo-xml'; const cleanPath = currentPath.split('?')[0]; const trimmedCustomIdea = customIdea.trim(); const hasCustomIdea = trimmedCustomIdea.length > 0 && !potentialOldImageUrl;
        if (!isToolPage) {
            if (hasCustomIdea) { baseSuggestions.push({ id: ADD_NEW_ID, text: "Передать Идею в Студию 🚀", link: "/repo-xml", icon: <FaFileImport className="mr-1.5 text-green-400"/>, tooltip: `Передать идею "${trimmedCustomIdea.substring(0, 30)}..." и контекст страницы в Студию` }); }
            else { baseSuggestions.push({ id: ADD_NEW_ID, text: "Создать Новое с Нуля ✨", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" />, tooltip: "Перейти в СуперВайб Студию без контекста" }); }
        }
        baseSuggestions.push({ id: HIRE_ME_ID, text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" />, tooltip: "Узнать о SelfDev пути и заказать консультацию" });
        if (potentialOldImageUrl && !isToolPage && !showReplaceTool) { baseSuggestions.unshift({ id: REPLACE_IMAGE_ID, text: "Заменить Картинку? 🖼️", action: () => { logger.debug("[Flow 1 - Image Swap] StickyChatButton: Replace Image suggestion clicked."); setShowReplaceTool(true); }, icon: <FaImages className="mr-1.5 text-blue-400" />, tooltip: `Начать процесс замены картинки: ${potentialOldImageUrl.substring(0, 30)}...` }); } 
        baseSuggestions.push({ id: COPY_LOGS_ID, text: logsCopied ? "Логи скопированы!" : "Скопировать Логи", action: handleCopyLogs, icon: logsCopied ? <FaCircleCheck className="mr-1.5 text-green-400"/> : <FaClipboardList className="mr-1.5" />, tooltip: "Скопировать историю системных логов в буфер обмена для отладки" });
        return baseSuggestions;
    }, [currentPath, potentialOldImageUrl, showReplaceTool, customIdea, logsCopied, handleCopyLogs]);

    useEffect(() => {
        logger.debug(`[StickyChatButton Effect ActiveMessage] isAppLoading: ${isAppLoading}, githubLoading: ${githubLoading}`);
        if (isAppLoading || githubLoading) { let loadingMsg = "Подключаюсь..."; if (githubLoading) loadingMsg = `Ищу твой профиль GitHub... 🧐`; setActiveMessage(loadingMsg); return; } let userIdentifier = githubProfile?.name || appContextUser?.first_name || appContextUser?.username || null; const baseGreeting = userIdentifier ? `Здарова, ${userIdentifier}!` : "Эй, Кодер!"; const justLoadedProfile = prevGithubLoading && !githubLoading && githubProfile; const cleanPath = currentPath.split('?')[0]; const isToolPage = cleanPath === '/repo-xml'; let message = "";
        if (isToolPage) { message = `${baseGreeting} Ты в СуперВайб Студии! ✨ Используй Бадди справа для помощи.`; }
        else { const pageName = cleanPath === '/' ? 'главную' : `страницу (${cleanPath})`; if (showReplaceTool) { message = `Окей, ${userIdentifier || 'дружок'}, давай заменим картинку! 👇`; } else if (potentialOldImageUrl) { message = `${baseGreeting} Заметил URL картинки. Хочешь заменить её?`; } else if (customIdea.trim().length > 0) { message = `${baseGreeting} Вижу твою идею! Жми "Передать Идею в Студию", чтобы начать магию. ✨`; } else if (justLoadedProfile) { message = `ВОУ, ${userIdentifier}! ✨ Нашел твой GitHub! Хочешь ${pageName} прокачать? 😉 Или введи идею/URL картинки!`; } else if (githubProfile) { message = `${baseGreeting} Рад видеть твой GitHub! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем править? Или введи идею/URL картинки.`; } else { message = `${baseGreeting} GitHub не найден... Не важно! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем улучшать? 😉 Или введи идею/URL картинки!`; } }
        setActiveMessage(message);
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath, potentialOldImageUrl, showReplaceTool, customIdea]);

    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape' && isOpen) { logger.debug("[StickyChatButton] Escape key pressed, closing."); setIsOpen(false); setShowReplaceTool(false); } }, [isOpen]);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);
    
    useEffect(() => { 
        logger.debug("[StickyChatButton Effect PathChange] Path changed, resetting chat state.");
        setCustomIdea(""); 
        setPotentialOldImageUrl(null); 
        setShowReplaceTool(false); 
        hasOpenedDueToInactivityRef.current = false; 
        setLogsCopied(false); 
    }, [currentPath]);
    
    useEffect(() => { 
        const trimmedIdea = customIdea.trim(); 
        if (trimmedIdea && isImageUrl(trimmedIdea)) { 
            logger.debug(`[Flow 1 - Image Swap] StickyChatButton: Detected image URL in input: ${trimmedIdea}`); 
            setPotentialOldImageUrl(trimmedIdea); 
        } else { 
            if(potentialOldImageUrl) logger.debug(`[StickyChatButton Effect CustomIdea] Input changed, clearing potential image URL.`); 
            setPotentialOldImageUrl(null); 
            if (showReplaceTool) { setShowReplaceTool(false); } 
        } 
    }, [customIdea, showReplaceTool, potentialOldImageUrl]); 

    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return; 
        logger.info("[StickyChatButton] Suggestion Clicked:", { id: suggestion.id, text: suggestion.text }); 
        if (suggestion.action) { suggestion.action(); }
        else if (suggestion.link) {
            let finalLink = suggestion.link; const trimmedCustomIdea = customIdea.trim();
            const isGenericIdeaFlow = trimmedCustomIdea && !potentialOldImageUrl && suggestion.id !== HIRE_ME_ID && suggestion.link === '/repo-xml';

            if (isGenericIdeaFlow) {
                 const cleanPath = currentPath.split('?')[0]; let targetPath = cleanPath === "/" ? "app/page.tsx" : `app${cleanPath}`; if (!targetPath.match(/\.(tsx|jsx|js|ts)$/)) { targetPath = targetPath.endsWith('/') ? targetPath + 'page.tsx' : targetPath + '/page.tsx'; } if (!targetPath.startsWith('app/')) targetPath = 'app/' + targetPath;
                 const encodedTargetPath = encodeURIComponent(targetPath);
                 const encodedIdea = encodeURIComponent(trimmedCustomIdea); 
                 finalLink = `/repo-xml?path=${encodedTargetPath}&idea=${encodedIdea}`;
                 logger.info(`[Flow 2/3 - Generic/Error Idea] StickyChatButton: Constructed URL: ${finalLink}`); 
                 toast.info("🚀 Отправляю идею в Студию!");
            } else {
                 logger.debug(`[StickyChatButton] Navigating to simple link: ${finalLink}`); 
                 toast.info("🚀 Перехожу...");
            }
            router.push(finalLink); setIsOpen(false);
        }
        if (suggestion.id !== REPLACE_IMAGE_ID && suggestion.id !== COPY_LOGS_ID) {
            setIsOpen(false);
        }
    };
    const handleReplaceConfirmed = (newImageUrl: string) => {
        if (!potentialOldImageUrl) { logger.error("[Flow 1 - Image Swap] StickyChatButton: handleReplaceConfirmed called but old URL is missing!"); toastError("Ошибка: Старый URL не найден."); return; } 
        logger.info("[Flow 1 - Image Swap] StickyChatButton: Replace confirmed.", { oldUrl: potentialOldImageUrl, newUrl: newImageUrl }); 
        const structuredIdea = `ImageReplace|OldURL=${encodeURIComponent(potentialOldImageUrl)}|NewURL=${encodeURIComponent(newImageUrl)}`;
        const cleanPath = currentPath.split('?')[0]; let targetPath = cleanPath === "/" ? "app/page.tsx" : `app${cleanPath}`; if (!targetPath.match(/\.(tsx|jsx|js|ts)$/)) { targetPath = targetPath.endsWith('/') ? targetPath + 'page.tsx' : targetPath + '/page.tsx'; } if (!targetPath.startsWith('app/')) targetPath = 'app/' + targetPath; const encodedTargetPath = encodeURIComponent(targetPath);
        const redirectUrl = `/repo-xml?path=${encodedTargetPath}&idea=${structuredIdea}`; 
        logger.info(`[Flow 1 - Image Swap] StickyChatButton: Constructed redirect URL: ${redirectUrl}`); 
        toastInfo("🚀 Перехожу в Студию для замены..."); router.push(redirectUrl); setIsOpen(false); setShowReplaceTool(false);
    };
    const handleCancelReplace = () => { logger.debug("[Flow 1 - Image Swap] StickyChatButton: Replace cancelled."); setShowReplaceTool(false); }; 
    const handleOverlayClick = () => { logger.debug("[StickyChatButton] Overlay clicked, closing."); setIsOpen(false); setShowReplaceTool(false); requestAnimationFrame(() => document.body.focus()); }; 
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = async () => { 
        const newIsOpenState = !isOpen;
        logger.info(`[StickyChatButton] FAB clicked. Will open: ${newIsOpenState}`); 
        setIsOpen(newIsOpenState); 
        if (newIsOpenState) { 
            hasOpenedDueToInactivityRef.current = true; 
            setShowReplaceTool(false); 
            setCustomIdea(""); 
            setPotentialOldImageUrl(null); 
            setLogsCopied(false); 
            if(dbUser?.user_id){ // Use dbUser.user_id (string) for Supabase
                logger.debug(`[StickyChatButton handleFabClick] User ${dbUser.user_id} opened chat. Attempting to log feature 'sticky_chat_opened'.`);
                const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'sticky_chat_opened');
                newAchievements?.forEach(ach => {
                    addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                    logger.info(`[StickyChatButton handleFabClick] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
                });
            } else {
                logger.warn("[StickyChatButton handleFabClick] Cannot log 'sticky_chat_opened': dbUser.user_id is missing.");
            }
        } else { 
            setShowReplaceTool(false); 
            requestAnimationFrame(() => document.body.focus()); 
        }
    }; 

    const showInputArea = isOpen && !showReplaceTool && currentPath !== '/repo-xml';
    logger.debug("[StickyChatButton] Rendering...", { isOpen, showInputArea, showReplaceTool, potentialOldImageUrl }); 

    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-40 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-modal="true" role="dialog" aria-labelledby="chat-suggestions-title">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-start bg-transparent" onClick={handleDialogClick}>
                        <h2 id="chat-suggestions-title" className="sr-only">Xuinity Suggestions</h2>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="left" />
                        <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4 mt-2">
                            <CharacterDisplay githubProfile={githubProfile} characterImageUrl={CHARACTER_IMAGE_URL} characterAltText={CHARACTER_ALT_TEXT} variants={childVariants} />
                            <div className="flex flex-col items-center sm:items-start gap-2 w-full">
                                {showReplaceTool && potentialOldImageUrl ? ( <ImageReplaceTool oldImageUrl={potentialOldImageUrl} onReplaceConfirmed={handleReplaceConfirmed} onCancel={handleCancelReplace} /> ) : (
                                    <> {showInputArea && ( <motion.div variants={childVariants} className="w-full"> <label htmlFor="custom-idea-input" className="block text-xs font-medium mb-1 text-gray-300 flex items-center"> <FaLightbulb className="text-yellow-400 mr-1.5 text-sm" /> Введи идею / URL картинки: </label> <textarea id="custom-idea-input" rows={2} value={customIdea} onChange={(e) => setCustomIdea(e.target.value)} className="w-full p-2 text-sm bg-gray-700/80 backdrop-blur-sm border border-gray-600/50 rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none text-white placeholder-gray-400 simple-scrollbar resize-none" placeholder="Напр: 'Добавь кнопку Х' или https://..." /> </motion.div> )} <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-start" /> </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            ) : ( 
                !isAppLoading && <div className="fixed bottom-16 left-4 z-40 sm:bottom-4"> 
                    <FloatingActionButton onClick={handleFabClick} variants={fabVariants} icon={<FaCommentDots />} /> 
                </div> 
            )}
        </AnimatePresence>
    );
};

export default StickyChatButton;