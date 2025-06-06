"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation"; // useRouter imported
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaFileImport, FaClipboardList, FaCircleCheck, FaCommentDots,
    FaLightbulb, FaImages, FaIcons, FaUpload, FaToolbox // FaToolbox added
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";
import { ImageReplaceTool } from "@/components/stickyChat_components/ImageReplaceTool";
import { IconReplaceTool } from "@/components/stickyChat_components/IconReplaceTool";
import { SimpleImageUploadTool } from "@/components/stickyChat_components/SimpleImageUploadTool"; // New tool
import { ToolsMenu } from "@/components/assistant_components/ToolsMenu"; // Tools Menu from assistant
import { toast } from "sonner";
import VibeContentRenderer from '@/components/VibeContentRenderer';

// Import Context & Actions
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";
import { debugLogger as logger, type LogRecord } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";
import useInactivityTimer from "@/hooks/useInactivityTimer"; 
import { checkAndUnlockFeatureAchievement } from "@/hooks/cyberFitnessSupabase"; 

// --- Constants & Types ---
const INACTIVITY_TIMEOUT_MS = 60000; 
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Найми меня! ✨";
const REPLACE_IMAGE_ID = "replace-image-trigger";
const REPLACE_ICON_ID = "replace-icon-trigger"; 
const ADD_NEW_ID = "add-new"; 
const HIRE_ME_ID = "hire-me";
const COPY_LOGS_ID = "copy-logs"; 
const UPLOAD_IMAGE_GET_URL_ID = "upload-image-get-url"; // New ID
const REPO_XML_PAGE_PATH = '/repo-xml'; // Constant for repo-xml path

interface Suggestion { id: string; text: string | React.ReactNode; link?: string; action?: () => void; icon?: React.ReactNode; isHireMe?: boolean; isFixAction?: boolean; isImageReplaceAction?: boolean; disabled?: boolean; tooltip?: string; }
interface GitHubProfile { login: string; avatar_url: string; html_url: string; name?: string | null; }
interface IconReplaceDetails { oldIconName: string; newIconName: string; componentProps?: string; }

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
const isIconNameInput = (input: string): boolean => {
    if (!input) return false;
    const trimmed = input.trim();
    return /^(Fa[A-Z0-9][a-zA-Z0-9]*|fa(-[a-z0-9]+)+)$/i.test(trimmed) && !trimmed.includes(" ") && trimmed.length > 2;
};

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
    const [showIconReplaceTool, setShowIconReplaceTool] = useState<boolean>(false); 
    const [showSimpleImageUploader, setShowSimpleImageUploader] = useState<boolean>(false); // New state
    const [logsCopied, setLogsCopied] = useState(false); 
    
    // --- Hooks ---
    const pathname = usePathname(); 
    const currentPath = pathname ?? ''; // Handle null pathname
    const router = useRouter(); 
    const { user: appContextUser, isLoading: isAppLoading, dbUser } = useAppContext(); 
    const { success: toastSuccess, error: toastError, info: toastInfo, addToast } = useAppToast();

    const isToolPage = currentPath === REPO_XML_PAGE_PATH;
    const enableInactivityOpen = !isToolPage;

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
            logger.info(`[StickyChatButton] HasBeenPlanter: Copy logs SUCCESS - Copied ${logRecords.length} records.`);
            toastSuccess("Логи скопированы в буфер обмена!");
            setLogsCopied(true);
            setTimeout(() => setLogsCopied(false), 2000); 

            if (dbUser?.user_id) { 
                logger.debug(`[StickyChatButton handleCopyLogs] Attempting to log 'copy_logs_used' for user ${dbUser.user_id}.`);
                const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'copy_logs_used');
                newAchievements?.forEach(ach => {
                    addToast(<VibeContentRenderer content={`🏆 Ачивка: ${ach.name}!`} />, "success", 5000, { description: <VibeContentRenderer content={ach.description} /> });
                    logger.info(`[StickyChatButton handleCopyLogs] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
                });
            } else {
                logger.warn("[StickyChatButton handleCopyLogs] Cannot log 'copy_logs_used': dbUser.user_id is missing.");
            }

        } catch (err: any) {
            logger.error("[StickyChatButton] HasBeenPlanter: Copy logs FAILED.", { plannedAction, error: err?.message ?? err });
            toastError(`Не удалось скопировать логи: ${err?.message ?? 'Unknown error'}`);
        }
    }, [toastSuccess, toastError, toastInfo, dbUser?.user_id, addToast]);

    const suggestions = useMemo((): Suggestion[] => {
        const baseSuggestions: Suggestion[] = []; 
        const trimmedCustomIdea = customIdea.trim(); 
        const isLikelyIconInput = isIconNameInput(trimmedCustomIdea);
        const hasGenericCustomIdea = trimmedCustomIdea.length > 0 && !potentialOldImageUrl && !isLikelyIconInput;

        if (!isToolPage) {
            if (hasGenericCustomIdea) { 
                baseSuggestions.push({ id: ADD_NEW_ID, text: <VibeContentRenderer content="Передать Идею в Студию ::FaRocket::" />, link: REPO_XML_PAGE_PATH, icon: <FaFileImport className="mr-1.5 text-green-400"/>, tooltip: `Передать идею "${trimmedCustomIdea.substring(0, 30)}..." и контекст страницы в Студию` }); 
            } else if (!potentialOldImageUrl && !isLikelyIconInput) { 
                baseSuggestions.push({ id: ADD_NEW_ID, text: <VibeContentRenderer content="Создать Новое с Нуля ::FaWandMagicSparkles::" />, link: REPO_XML_PAGE_PATH, tooltip: "Перейти в СуперВайб Студию без контекста" }); 
            }
        }
        
        baseSuggestions.push({ id: HIRE_ME_ID, text: <VibeContentRenderer content={`${HIRE_ME_TEXT} ::FaStar::`} />, link: "/selfdev", isHireMe: true, tooltip: "Узнать о SelfDev пути и заказать консультацию" });
        
        if (potentialOldImageUrl && !isToolPage && !showReplaceTool && !showIconReplaceTool && !showSimpleImageUploader) { 
            baseSuggestions.unshift({ id: REPLACE_IMAGE_ID, text: <VibeContentRenderer content="Заменить Картинку? ::FaImages::" />, action: () => { logger.debug("[Flow 1 - Image Swap] StickyChatButton: Replace Image suggestion clicked."); setShowReplaceTool(true); setShowIconReplaceTool(false); setShowSimpleImageUploader(false); }, tooltip: `Начать процесс замены картинки: ${potentialOldImageUrl.substring(0, 30)}...` }); 
        } else if (isLikelyIconInput && !isToolPage && !showIconReplaceTool && !showReplaceTool && !showSimpleImageUploader) {
            baseSuggestions.unshift({ id: REPLACE_ICON_ID, text: <VibeContentRenderer content="Заменить Иконку? ::FaIcons::" />, action: () => { logger.debug("[Flow X - Icon Swap] StickyChatButton: Replace Icon suggestion clicked."); setShowIconReplaceTool(true); setShowReplaceTool(false); setShowSimpleImageUploader(false); }, tooltip: `Начать процесс замены иконки, начиная с: ${trimmedCustomIdea}`});
        }
        
        if (!isToolPage && !showReplaceTool && !showIconReplaceTool && !showSimpleImageUploader) { // Only show if no other tool is active
            baseSuggestions.push({ 
                id: UPLOAD_IMAGE_GET_URL_ID, 
                text: <VibeContentRenderer content="Загрузить файл & URL ::FaUpload::" />, 
                action: () => {
                    logger.info("[StickyChatButton] 'Upload file & get URL' suggestion clicked.");
                    setShowSimpleImageUploader(true);
                    setShowReplaceTool(false);
                    setShowIconReplaceTool(false);
                }, 
                tooltip: "Загрузить изображение или видео и скопировать его URL" 
            });
        }

        baseSuggestions.push({ id: COPY_LOGS_ID, text: <VibeContentRenderer content={logsCopied ? "Логи скопированы! ::FaCircleCheck::" : "Скопировать Логи ::FaClipboardList::"} />, action: handleCopyLogs, tooltip: "Скопировать историю системных логов в буфер обмена для отладки" });
        return baseSuggestions;
    }, [currentPath, isToolPage, potentialOldImageUrl, showReplaceTool, showIconReplaceTool, showSimpleImageUploader, customIdea, logsCopied, handleCopyLogs]);

    useEffect(() => { 
        logger.debug(`[StickyChatButton Effect ActiveMessage] isAppLoading: ${isAppLoading}, githubLoading: ${githubLoading}`);
        if (isAppLoading || githubLoading) { let loadingMsg = "Подключаюсь..."; if (githubLoading) loadingMsg = `Ищу твой профиль GitHub... 🧐`; setActiveMessage(loadingMsg); return; } 
        const userIdentifier = appContextUser?.username || appContextUser?.first_name || githubProfile?.name || null; 
        const baseGreeting = userIdentifier ? `Здарова, ${userIdentifier}!` : "Эй, Кодер!"; 
        const justLoadedProfile = prevGithubLoading && !githubLoading && githubProfile; 
        const cleanPath = currentPath.split('?')[0]; 
        let message = "";

        if (showSimpleImageUploader) {
            message = `Окей, ${userIdentifier || 'Чемпион'}, выбери файл для загрузки 👇`;
        } else if (isToolPage) { 
            message = `${baseGreeting} Ты в СуперВайб Студии! ✨ Используй Бадди справа для помощи.`; 
        } else { 
            const pageName = cleanPath === '/' ? 'главную' : `страницу (${cleanPath})`; 
            if (showReplaceTool) { 
                message = `Окей, ${userIdentifier || 'дружок'}, давай заменим картинку! 👇`; 
            } else if (showIconReplaceTool) {
                message = `Отлично, ${userIdentifier || 'агент'}. Какую иконку на какую меняем? 🎨`;
            } else if (potentialOldImageUrl) { 
                message = `${baseGreeting} Заметил URL картинки. Хочешь заменить её?`; 
            } else if (isIconNameInput(customIdea.trim())) {
                 message = `${baseGreeting} Вижу имя иконки! Хочешь её заменить?`;
            } else if (customIdea.trim().length > 0) { 
                message = `${baseGreeting} Вижу твою идею! Жми "Передать Идею в Студию", чтобы начать магию. ✨`; 
            } else if (justLoadedProfile) { 
                message = `ВОУ, ${userIdentifier}! ✨ Нашел твой GitHub! Хочешь ${pageName} прокачать? 😉 Или введи идею/URL/иконку!`; 
            } else if (githubProfile) { 
                message = `${baseGreeting} Рад видеть твой GitHub! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем править? Или введи идею/URL/иконку.`; 
            } else { 
                message = `${baseGreeting} GitHub не найден... Не важно! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем улучшать? 😉 Или введи идею/URL/иконку!`; 
            } 
        }
        setActiveMessage(message);
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath, isToolPage, potentialOldImageUrl, showReplaceTool, showIconReplaceTool, showSimpleImageUploader, customIdea]);

    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape' && isOpen) { logger.debug("[StickyChatButton] Escape key pressed, closing."); setIsOpen(false); setShowReplaceTool(false); setShowIconReplaceTool(false); setShowSimpleImageUploader(false); } }, [isOpen]);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);
    
    useEffect(() => { 
        logger.debug("[StickyChatButton Effect PathChange] Path changed, resetting chat state.");
        setCustomIdea(""); 
        setPotentialOldImageUrl(null); 
        setShowReplaceTool(false); 
        setShowIconReplaceTool(false);
        setShowSimpleImageUploader(false);
        hasOpenedDueToInactivityRef.current = false; 
        setLogsCopied(false); 
    }, [currentPath]);
    
    useEffect(() => { 
        const trimmedIdea = customIdea.trim(); 
        if (trimmedIdea && isImageUrl(trimmedIdea)) { 
            logger.debug(`[Flow 1 - Image Swap] StickyChatButton: Detected image URL in input: ${trimmedIdea}`); 
            setPotentialOldImageUrl(trimmedIdea); 
            setShowIconReplaceTool(false); 
            setShowSimpleImageUploader(false);
        } else if (!isIconNameInput(trimmedIdea)) { 
            if(potentialOldImageUrl) logger.debug(`[StickyChatButton Effect CustomIdea] Input changed (not image URL, not icon), clearing potential image URL.`); 
            setPotentialOldImageUrl(null); 
            if (showReplaceTool) { setShowReplaceTool(false); } 
        }
    }, [customIdea, showReplaceTool, potentialOldImageUrl]); 

    const handleSuggestionClick = async (suggestion: Suggestion) => {
        if (suggestion.disabled) return; 
        logger.info("[StickyChatButton] Suggestion Clicked:", { id: suggestion.id, text: suggestion.text }); 
        if (suggestion.action) { suggestion.action(); }
        else if (suggestion.link) {
            let finalLink = suggestion.link; 
            const trimmedCustomIdea = customIdea.trim();
            const isGenericIdeaFlow = trimmedCustomIdea && !potentialOldImageUrl && !isIconNameInput(trimmedCustomIdea) && suggestion.id !== HIRE_ME_ID && suggestion.link === REPO_XML_PAGE_PATH;

            if (isGenericIdeaFlow) {
                 const cleanPath = currentPath.split('?')[0]; let targetPath = cleanPath === "/" ? "app/page.tsx" : `app${cleanPath}`; if (!targetPath.match(/\.(tsx|jsx|js|ts)$/)) { targetPath = targetPath.endsWith('/') ? targetPath + 'page.tsx' : targetPath + '/page.tsx'; } if (!targetPath.startsWith('app/')) targetPath = 'app/' + targetPath;
                 const encodedTargetPath = encodeURIComponent(targetPath);
                 const encodedIdea = encodeURIComponent(trimmedCustomIdea); 
                 finalLink = `${REPO_XML_PAGE_PATH}?path=${encodedTargetPath}&idea=${encodedIdea}`;
                 logger.info(`[Flow 2/3 - Generic/Error Idea] StickyChatButton: Constructed URL: ${finalLink}`); 
                 toastInfo("🚀 Отправляю идею в Студию!");
                 if (dbUser?.user_id) {
                    const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'idea_sent_to_studio');
                    newAchievements?.forEach(ach => addToast(<VibeContentRenderer content={`🏆 Ачивка: ${ach.name}!`} />, "success", 5000, { description: <VibeContentRenderer content={ach.description} /> }));
                 }
            } else {
                 logger.debug(`[StickyChatButton] Navigating to simple link: ${finalLink}`); 
                 toastInfo("🚀 Перехожу...");
            }
            router.push(finalLink); setIsOpen(false);
        }
        // Close main dialog only if it's not a tool trigger or log copy
        if (suggestion.id !== REPLACE_IMAGE_ID && suggestion.id !== REPLACE_ICON_ID && suggestion.id !== COPY_LOGS_ID && suggestion.id !== UPLOAD_IMAGE_GET_URL_ID) {
            setIsOpen(false);
        }
    };

    const handleReplaceConfirmed = async (newImageUrl: string) => {
        if (!potentialOldImageUrl) { logger.error("[Flow 1 - Image Swap] StickyChatButton: handleReplaceConfirmed called but old URL is missing!"); toastError("Ошибка: Старый URL не найден."); return; } 
        logger.info("[Flow 1 - Image Swap] StickyChatButton: Replace confirmed.", { oldUrl: potentialOldImageUrl, newUrl: newImageUrl }); 
        const structuredIdea = `ImageReplace|OldURL=${encodeURIComponent(potentialOldImageUrl)}|NewURL=${encodeURIComponent(newImageUrl)}`;
        const cleanPath = currentPath.split('?')[0]; let targetPath = cleanPath === "/" ? "app/page.tsx" : `app${cleanPath}`; if (!targetPath.match(/\.(tsx|jsx|js|ts)$/)) { targetPath = targetPath.endsWith('/') ? targetPath + 'page.tsx' : targetPath + '/page.tsx'; } if (!targetPath.startsWith('app/')) targetPath = 'app/' + targetPath; const encodedTargetPath = encodeURIComponent(targetPath);
        const redirectUrl = `${REPO_XML_PAGE_PATH}?path=${encodedTargetPath}&idea=${structuredIdea}`; 
        logger.info(`[Flow 1 - Image Swap] StickyChatButton: Constructed redirect URL: ${redirectUrl}`); 
        toastInfo("🚀 Перехожу в Студию для замены картинки..."); router.push(redirectUrl); setIsOpen(false); setShowReplaceTool(false);
        if (dbUser?.user_id) {
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'image_replace_initiated');
            newAchievements?.forEach(ach => addToast(<VibeContentRenderer content={`🏆 Ачивка: ${ach.name}!`} />, "success", 5000, { description: <VibeContentRenderer content={ach.description} /> }));
        }
    };

    const handleIconReplaceConfirmed = async (details: IconReplaceDetails) => {
        logger.info("[Flow X - Icon Swap] StickyChatButton: Icon Replace confirmed.", details);
        let ideaParts = [`IconSwap`];
        ideaParts.push(`OldIconName=${encodeURIComponent(details.oldIconName)}`);
        ideaParts.push(`NewIconName=${encodeURIComponent(details.newIconName)}`);
        if (details.componentProps) { 
            ideaParts.push(`ComponentProps=${encodeURIComponent(details.componentProps)}`);
        }
        const structuredIdea = ideaParts.join('|');
        
        const cleanPath = currentPath.split('?')[0]; 
        let targetPath = cleanPath === "/" ? "app/page.tsx" : `app${cleanPath}`; 
        if (!targetPath.match(/\.(tsx|jsx|js|ts|md)$/)) { 
            targetPath = targetPath.endsWith('/') ? targetPath + 'page.tsx' : targetPath + '/page.tsx'; 
        } 
        if (!targetPath.startsWith('app/')) targetPath = 'app/' + targetPath; 
        
        const encodedTargetPath = encodeURIComponent(targetPath);
        const redirectUrl = `${REPO_XML_PAGE_PATH}?path=${encodedTargetPath}&idea=${structuredIdea}`; 
        logger.info(`[Flow X - Icon Swap] StickyChatButton: Constructed redirect URL for icon swap: ${redirectUrl}`); 
        toastInfo("🚀 Перехожу в Студию для замены иконки..."); 
        router.push(redirectUrl); 
        setIsOpen(false); 
        setShowIconReplaceTool(false);
        if (dbUser?.user_id) {
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'icon_replace_initiated');
            newAchievements?.forEach(ach => addToast(<VibeContentRenderer content={`🏆 Ачивка: ${ach.name}!`} />, "success", 5000, { description: <VibeContentRenderer content={ach.description} /> }));
        }
    };

    const handleSimpleUploadComplete = (url: string) => {
        logger.info(`[StickyChatButton] Simple Upload Complete. URL: ${url}`);
        navigator.clipboard.writeText(url).then(() => {
            toast.success("Файл загружен! URL скопирован.", {
                description: <VibeContentRenderer content={`URL: <Link href="${url}" target="_blank" className="text-cyan-400 hover:underline">${url.substring(0,35)}...</Link>`} />,
                duration: 7000,
            });
        }).catch(err => {
            logger.error("[StickyChatButton] Failed to copy URL from simple upload:", err);
            toast.success("Файл загружен!", {
                 description: <VibeContentRenderer content={`URL: <Link href="${url}" target="_blank" className="text-cyan-400 hover:underline">${url.substring(0,35)}...</Link>`} />,
                 duration: 7000,
            });
        });
        // Keep the tool open for further actions or until user cancels
        // setShowSimpleImageUploader(false); // Or let user close it via its own cancel
    };

    const handleCancelReplace = () => { logger.debug("[Flow 1/X - Image/Icon Swap] StickyChatButton: Replace cancelled."); setShowReplaceTool(false); setShowIconReplaceTool(false); }; 
    const handleCancelSimpleUpload = () => { logger.debug("[StickyChatButton] Simple image uploader cancelled/closed."); setShowSimpleImageUploader(false); };

    const handleOverlayClick = () => { logger.debug("[StickyChatButton] Overlay clicked, closing."); setIsOpen(false); setShowReplaceTool(false); setShowIconReplaceTool(false); setShowSimpleImageUploader(false); requestAnimationFrame(() => document.body.focus()); }; 
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = async () => { 
        const newIsOpenState = !isOpen;
        logger.info(`[StickyChatButton] FAB clicked. Will open: ${newIsOpenState}`); 
        setIsOpen(newIsOpenState); 
        if (newIsOpenState) { 
            hasOpenedDueToInactivityRef.current = true; 
            setShowReplaceTool(false); 
            setShowIconReplaceTool(false);
            setShowSimpleImageUploader(false);
            setCustomIdea(""); 
            setPotentialOldImageUrl(null); 
            setLogsCopied(false); 
            if(dbUser?.user_id){ 
                logger.debug(`[StickyChatButton handleFabClick] User ${dbUser.user_id} opened chat. Attempting to log feature 'sticky_chat_opened'.`);
                const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'sticky_chat_opened');
                newAchievements?.forEach(ach => {
                    addToast(<VibeContentRenderer content={`🏆 Ачивка: ${ach.name}!`} />, "success", 5000, { description: <VibeContentRenderer content={ach.description} /> });
                    logger.info(`[StickyChatButton handleFabClick] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
                });
            } else {
                logger.warn("[StickyChatButton handleFabClick] Cannot log 'sticky_chat_opened': dbUser.user_id is missing.");
            }
        } else { 
            setShowReplaceTool(false); 
            setShowIconReplaceTool(false);
            setShowSimpleImageUploader(false);
            requestAnimationFrame(() => document.body.focus()); 
        }
    }; 

    const showInputArea = isOpen && !showReplaceTool && !showIconReplaceTool && !showSimpleImageUploader && !isToolPage;
    const currentToolActive = showReplaceTool || showIconReplaceTool || showSimpleImageUploader;

    logger.debug("[StickyChatButton] Rendering...", { isOpen, showInputArea, currentToolActive, isToolPage }); 

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
                                <AnimatePresence mode="wait">
                                {showReplaceTool && potentialOldImageUrl ? ( <ImageReplaceTool oldImageUrl={potentialOldImageUrl} onReplaceConfirmed={handleReplaceConfirmed} onCancel={handleCancelReplace} /> ) 
                                : showIconReplaceTool ? ( <IconReplaceTool oldIconNameInput={isIconNameInput(customIdea.trim()) ? customIdea.trim() : ""} onReplaceConfirmed={handleIconReplaceConfirmed} onCancel={handleCancelReplace} />) 
                                : showSimpleImageUploader ? ( <SimpleImageUploadTool onUploadComplete={handleSimpleUploadComplete} onCancel={handleCancelSimpleUpload} />)
                                : ( // Default view with suggestions and input
                                    <motion.div key="default-view" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full flex flex-col gap-2">
                                        {/* ToolsMenu Integration */}
                                        {!isToolPage && ( // Only show ToolsMenu if not on tool page and no other tool is active
                                            <motion.div variants={childVariants} className="w-full flex justify-center sm:justify-start">
                                                <ToolsMenu
                                                    customLinks={[]}
                                                    onAddCustomLink={() => {
                                                        toast.info("Управление ссылками в СуперВайб Студии.", {
                                                            description: "Хотите перейти?",
                                                            action: { label: "Вперед!", onClick: () => { router.push(REPO_XML_PAGE_PATH); setIsOpen(false); } }
                                                        });
                                                    }}
                                                />
                                            </motion.div>
                                        )}
                                        {showInputArea && ( <motion.div variants={childVariants} className="w-full"> <label htmlFor="custom-idea-input" className="block text-xs font-medium mb-1 text-gray-300 flex items-center"> <VibeContentRenderer content="::FaLightbulb className='text-yellow-400 mr-1.5 text-sm'::" /> Введи идею / URL картинки / Имя иконки:</label> <textarea id="custom-idea-input" rows={2} value={customIdea} onChange={(e) => setCustomIdea(e.target.value)} className="w-full p-2 text-sm bg-gray-700/80 backdrop-blur-sm border border-gray-600/50 rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none text-white placeholder-gray-400 simple-scrollbar resize-none" placeholder="Напр: 'Добавь кнопку Х', https://..., FaBeer" /> </motion.div> )} 
                                        <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-start" /> 
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            ) : ( 
                !isAppLoading && <div className="fixed bottom-16 left-4 z-40 sm:bottom-4"> 
                    <FloatingActionButton onClick={handleFabClick} variants={fabVariants} icon={<VibeContentRenderer content="::FaCommentDots::" />} /> 
                </div> 
            )}
        </AnimatePresence>
    );
};

export default StickyChatButton;