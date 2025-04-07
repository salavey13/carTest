"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard
} from "react-icons/fa6"; // Keep icons needed for non-repo pages

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Import Context & Actions (ONLY AppContext and GitHub actions)
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";
// ****** REMOVED RepoXmlPageContext import ******

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Найми меня! ✨";
const FIX_PAGE_ID = "fix-current-page"; // ID for the "Fix this page" action
// REMOVED DEFAULT_TASK_IDEA - Not needed here anymore

interface Suggestion {
    id: string;
    text: string;
    link?: string; // Only links needed now for this component
    // REMOVED action?: () => void | Promise<void>;
    icon?: React.ReactNode;
    isHireMe?: boolean;
    isFixAction?: boolean; // Keep to track which link is the "fix" link
    disabled?: boolean; // Keep for potential future use
}
interface GitHubProfile {
    login: string;
    avatar_url: string;
    html_url: string;
    name?: string | null;
}

// --- Helper Function for Predefined Tasks (REMOVED - Not needed here) ---
// const getPredefinedTaskForPath = ...;

// --- Animation Variants --- (Keep as is)
const containerVariants = { hidden: { opacity: 0, x: -300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: -300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, 10, -10, 5, -5, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };


// --- Main Component (Orchestrator) ---
const StickyChatButton: React.FC = () => {
    // --- State --- (Keep as is)
    const [isOpen, setIsOpen] = useState(false);
    const [fixActionClicked, setFixActionClicked] = useState(false); // Keep to hide button after click
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [activeMessage, setActiveMessage] = useState<string>("Загрузка...");
    const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
    const [githubLoading, setGithubLoading] = useState<boolean>(false);
    const [prevGithubLoading, setPrevGithubLoading] = useState<boolean>(false);

    // --- Hooks --- (Keep as is)
    const currentPath = usePathname();
    const router = useRouter();
    const { user: appContextUser, isLoading: isAppLoading } = useAppContext();
    // ****** REMOVED useRepoXmlPageContext hook ******

    // --- Fetch GitHub Profile --- (Keep as is)
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


    // --- Define Suggestions (Simplified - No Repo Page Logic) ---
    const suggestions = useMemo((): Suggestion[] => {
        // REMOVED: const isOnRepoXmlPage = currentPath === '/repo-xml';
        // REMOVED: if (isOnRepoXmlPage) { ... }

        // --- Base Suggestions (Always shown when open, except on /repo-xml maybe?) ---
        // We could hide this entire button on /repo-xml, or just show generic links.
        // Let's hide the "Fix this page" link when ON the tool page itself.
        const baseSuggestions: Suggestion[] = [];
        const isToolPage = currentPath === '/repo-xml';

        // Helper for page path (needed for fix link)
        const getFixPageLink = () => {
            // Use a generic "analyze this page" task idea if none provided by URL
            const taskIdea = "Проанализируй код этой страницы и предложи улучшения.";
            const folderPath = currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`;
            const encodedTaskIdea = encodeURIComponent(taskIdea);
            return `/repo-xml?path=${encodeURIComponent(folderPath)}&idea=${encodedTaskIdea}`;
        };

        // Only show "Fix this Page" if not clicked *and* not on root *and* not on the tool page itself
        if (!fixActionClicked && currentPath !== '/' && !isToolPage) {
            baseSuggestions.push({
                id: FIX_PAGE_ID,
                text: "Прокачать эту Страницу? 🤩",
                link: getFixPageLink(), // Generate link dynamically
                isFixAction: true,
                icon: <FaHighlighter className="mr-1.5" />
             });
        }
         // Offer "Create New" which goes to repo-xml without parameters
        if (!isToolPage) { // Don't offer "Create New" when already on the tool page
            baseSuggestions.push({ id: "add-new", text: "Создать Новое с Нуля ✨", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" /> });
        }
        // Always show "Hire Me"
        baseSuggestions.push({ id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> });

        return baseSuggestions;

    }, [currentPath, fixActionClicked, router]); // Dependencies simplified


    // --- Update Active Message Logic (Simplified - No Repo Context) ---
    useEffect(() => {
        // Loading messages
        if (isAppLoading || githubLoading) {
             let loadingMsg = "Подключаюсь...";
             if (githubLoading) loadingMsg = `Ищу твой профиль на GitHub... 🧐`;
             setActiveMessage(loadingMsg);
             return;
        }

        // Determine user identifier
        let userIdentifier = githubProfile?.name || appContextUser?.first_name || appContextUser?.username || null;
        const baseGreeting = userIdentifier ? `Здарова, ${userIdentifier}!` : "Эй, Кодер!";
        const justLoadedProfile = prevGithubLoading && !githubLoading && githubProfile;
        const isToolPage = currentPath === '/repo-xml';

        let message = "";

        // --- Message Logic (No Repo Context/Workflow) ---
         if (isToolPage) {
             // Specific message for when user is ON the tool page
             if (githubProfile) {
                 message = `${baseGreeting} Ты на странице автоматизации! ✨ Используй Ассистента справа для помощи.`;
             } else {
                 message = `${baseGreeting} Ты на странице автоматизации! Используй Ассистента справа для помощи.`;
             }
         } else {
            // On other pages, use the GitHub profile based greeting + offer to fix/create
            if (justLoadedProfile) {
                message = `ВОУ, ${userIdentifier}! ✨ Нашел твой GitHub! Хочешь эту страницу (${currentPath}) прокачать? 😉`;
            } else if (githubProfile) {
                message = `${baseGreeting} Рад видеть твой GitHub! Эту страницу (${currentPath}) будем править?`;
            } else {
                message = `${baseGreeting} GitHub-профиль не найден... Это не важно! Эту страницу (${currentPath}) будем улучшать? 😉`;
            }
             if (currentPath === '/') { // Special case for root
                 if (githubProfile) message = `${baseGreeting} Рад видеть твой GitHub! Готов создать что-то новое или прокачать страницу?`;
                 else message = `${baseGreeting} Готов создать что-то новое или прокачать страницу? 😎`;
             }
        }

        setActiveMessage(message);

        // REMOVED getXuinityMessage from dependency array
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath]);


    // --- Auto-open Timer --- (Keep as is)
    useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key --- (Keep as is)
    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); } }, []);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);

    // Reset fixActionClicked on path change (Keep as is)
    useEffect(() => { setFixActionClicked(false); }, [currentPath]);


    // --- Event Handlers --- (Simplified handleSuggestionClick)
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        console.log("(StickyChat) Suggestion Clicked:", suggestion.id);
        if (suggestion.link) {
            if (suggestion.isFixAction) {
                setFixActionClicked(true); // Keep track locally if the "fix" link was clicked
            }
            router.push(suggestion.link); // Navigate to the link
        }
        // REMOVED: else if (suggestion.action) { ... }
        setIsOpen(false); // Close after click
    };
    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => { setIsOpen(!isOpen); if (!isOpen) setHasAutoOpened(true); };


    // --- Render Logic --- (Keep as is, FAB renders based on isOpen)
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    key="dialog-overlay"
                    // Position left
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-40 backdrop-blur-sm"
                    onClick={handleOverlayClick}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-modal="true" role="dialog" aria-labelledby="chat-suggestions-title"
                >
                    <motion.div
                        variants={containerVariants} initial="hidden" animate="visible" exit="exit"
                        className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-start bg-transparent"
                        onClick={handleDialogClick}
                    >
                        <h2 id="chat-suggestions-title" className="sr-only">Xuinity Suggestions</h2>

                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="left" />

                        <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                            <CharacterDisplay
                                githubProfile={githubProfile} // Still show GitHub profile here
                                characterImageUrl={CHARACTER_IMAGE_URL}
                                characterAltText={CHARACTER_ALT_TEXT}
                                variants={childVariants}
                            />
                            <SuggestionList
                                suggestions={suggestions} // Use the simplified suggestions list
                                onSuggestionClick={handleSuggestionClick}
                                listVariants={childVariants}
                                itemVariants={childVariants}
                                className="items-center sm:items-start" // Align left
                            />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                 // Render FAB on the left side
                 !isAppLoading && // Optionally hide FAB until app context loads
                 <div className="fixed bottom-4 left-4 z-40">
                     <FloatingActionButton
                        onClick={handleFabClick}
                        variants={fabVariants}
                        // Keep original icon/style
                     />
                 </div>
            )}
        </AnimatePresence>
    );
};

export default StickyChatButton;