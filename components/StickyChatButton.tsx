"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Import Context & Actions (ONLY AppContext and GitHub actions)
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Найми меня! ✨";
const FIX_PAGE_ID = "fix-current-page";

interface Suggestion {
    id: string;
    text: string;
    link?: string;
    icon?: React.ReactNode;
    isHireMe?: boolean;
    isFixAction?: boolean;
    disabled?: boolean;
}
interface GitHubProfile {
    login: string;
    avatar_url: string;
    html_url: string;
    name?: string | null;
}

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0, x: -300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: -300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, 10, -10, 5, -5, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };


// --- Main Component (Orchestrator) ---
const StickyChatButton: React.FC = () => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false);
    const [fixActionClicked, setFixActionClicked] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [activeMessage, setActiveMessage] = useState<string>("Загрузка...");
    const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
    const [githubLoading, setGithubLoading] = useState<boolean>(false);
    const [prevGithubLoading, setPrevGithubLoading] = useState<boolean>(false);

    // --- Hooks ---
    const currentPath = usePathname(); // Includes query params, need to clean for path matching
    const router = useRouter();
    const { user: appContextUser, isLoading: isAppLoading } = useAppContext();

    // --- Fetch GitHub Profile ---
    useEffect(() => {
        setPrevGithubLoading(githubLoading);
        if (isOpen && !isAppLoading && appContextUser?.username && !githubProfile && !githubLoading) {
            const fetchProfile = async () => {
                setGithubLoading(true);
                console.log(`(StickyChat) Fetching GitHub profile for: ${appContextUser.username}`);
                const result = await getGitHubUserProfile(appContextUser.username!);
                if (result.success && result.profile) {
                    console.log("(StickyChat) GitHub profile found:", result.profile);
                    setGithubProfile(result.profile);
                } else {
                    console.warn("(StickyChat) GitHub profile fetch failed:", result.error);
                    setGithubProfile(null);
                }
                setGithubLoading(false);
            };
            fetchProfile();
        }
        if (!appContextUser) {
            setGithubProfile(null);
            setGithubLoading(false);
        }
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading]);


    // --- Define Suggestions (Simplified) ---
    const suggestions = useMemo((): Suggestion[] => {
        const baseSuggestions: Suggestion[] = [];
        const isToolPage = currentPath === '/repo-xml';
        const cleanPath = currentPath.split('?')[0]; // Use path without query params for logic

        // --- Helper to get the correct link for fixing the current page ---
        const getFixPageLink = (): string => {
            let taskIdea = "";
            // SPECIAL CASE: /vpr-test/*
            if (cleanPath.startsWith('/vpr-test/')) {
                taskIdea = "скрой кнопку включения подсказок, пожалуйста";
                console.log("Special task for /vpr-test/*:", taskIdea);
            } else {
                // Default task for other pages
                taskIdea = `Проанализируй код страницы ${cleanPath || '/'} и предложи улучшения или найди баги.`;
                 console.log("Default task for", cleanPath, ":", taskIdea);
            }

            // Determine the corresponding code path (simple mapping for demo)
            // This logic should mirror getPageFilePath in RepoTxtFetcher if possible,
            // but here we only need the *source* path param, not the resolved file.
            const folderPathParam = cleanPath === "/" ? "app" : `app${cleanPath}`; // Path param sent to repo-xml

            const encodedTaskIdea = encodeURIComponent(taskIdea);
            const encodedPathParam = encodeURIComponent(folderPathParam);

            return `/repo-xml?path=${encodedPathParam}&idea=${encodedTaskIdea}`;
        };

        // Only show "Fix this Page" if not clicked *and* not on root *and* not on the tool page itself
        if (!fixActionClicked && cleanPath !== '/' && !isToolPage) {
            baseSuggestions.push({
                id: FIX_PAGE_ID,
                text: "Прокачать эту Страницу? 🤩",
                link: getFixPageLink(), // Generate link with correct path and idea
                isFixAction: true,
                icon: <FaHighlighter className="mr-1.5" />
             });
        }
        // Offer "Create New" only if NOT on the tool page
        if (!isToolPage) {
            baseSuggestions.push({ id: "add-new", text: "Создать Новое с Нуля ✨", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" /> });
        }
        // Always show "Hire Me"
        baseSuggestions.push({ id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> });

        return baseSuggestions;

    }, [currentPath, fixActionClicked, router]); // router dependency might not be needed if only using link


    // --- Update Active Message Logic (Simplified) ---
    useEffect(() => {
        if (isAppLoading || githubLoading) {
             let loadingMsg = "Подключаюсь...";
             if (githubLoading) loadingMsg = `Ищу твой профиль на GitHub... 🧐`;
             setActiveMessage(loadingMsg);
             return;
        }

        let userIdentifier = githubProfile?.name || appContextUser?.first_name || appContextUser?.username || null;
        const baseGreeting = userIdentifier ? `Здарова, ${userIdentifier}!` : "Эй, Кодер!";
        const justLoadedProfile = prevGithubLoading && !githubLoading && githubProfile;
        const cleanPath = currentPath.split('?')[0]; // Path without query params
        const isToolPage = cleanPath === '/repo-xml';

        let message = "";

        if (isToolPage) {
             if (githubProfile) message = `${baseGreeting} Ты на странице автоматизации! ✨ Используй Бадди справа для помощи.`;
             else message = `${baseGreeting} Ты на странице автоматизации! Используй Бадди справа для помощи.`;
         } else {
            const pageName = cleanPath === '/' ? 'главную' : `страницу (${cleanPath})`;
            if (justLoadedProfile) message = `ВОУ, ${userIdentifier}! ✨ Нашел твой GitHub! Хочешь ${pageName} прокачать? 😉`;
            else if (githubProfile) message = `${baseGreeting} Рад видеть твой GitHub! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем править?`;
            else message = `${baseGreeting} GitHub-профиль не найден... Это не важно! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем улучшать? 😉`;
        }

        setActiveMessage(message);

    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath]);


    // --- Auto-open Timer ---
    useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); } }, []);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);

    // Reset fixActionClicked on path change
    useEffect(() => { setFixActionClicked(false); }, [currentPath]);


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        console.log("(StickyChat) Suggestion Clicked:", suggestion.id);
        if (suggestion.link) {
            if (suggestion.isFixAction) setFixActionClicked(true);
            router.push(suggestion.link);
        }
        setIsOpen(false);
    };
    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => { setIsOpen(!isOpen); if (!isOpen) setHasAutoOpened(true); };


    // --- Render Logic ---
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-40 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-modal="true" role="dialog" aria-labelledby="chat-suggestions-title">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-start bg-transparent" onClick={handleDialogClick}>
                        <h2 id="chat-suggestions-title" className="sr-only">Xuinity Suggestions</h2>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="left" />
                        <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                            <CharacterDisplay githubProfile={githubProfile} characterImageUrl={CHARACTER_IMAGE_URL} characterAltText={CHARACTER_ALT_TEXT} variants={childVariants} />
                            <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-start" />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                 !isAppLoading &&
                 <div className="fixed bottom-4 left-4 z-40">
                     <FloatingActionButton onClick={handleFabClick} variants={fabVariants} />
                 </div>
            )}
        </AnimatePresence>
    );
};

export default StickyChatButton;