"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub
} from "react-icons/fa6"; // Minimal necessary icons for this level

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";

// Import Context & Actions
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Нанять меня за звезды";
const FIX_PAGE_ID = "fix-current-page";

// Keep types here or move to a shared types file
interface Suggestion {
    id: string;
    text: string;
    link?: string;
    action?: () => void | Promise<void>;
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

// --- Animation Variants --- (Keep variants definitions)
const containerVariants = { hidden: { opacity: 0, x: -300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: -300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, 10, -10, 5, -5, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };


// --- Main Component (Orchestrator) ---
const StickyChatButton: React.FC = () => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false);
    const [fixActionClicked, setFixActionClicked] = useState(false); // Track "Fix page" click
    const [hasAutoOpened, setHasAutoOpened] = useState(false); // Track auto-open
    const [activeMessage, setActiveMessage] = useState<string>("Привет! Чем могу помочь?"); // Default message
    const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
    const [githubLoading, setGithubLoading] = useState<boolean>(false);

    // --- Hooks ---
    const currentPath = usePathname();
    const router = useRouter();
    const { user: appContextUser, isLoading: isAppLoading } = useAppContext(); // Get user and loading status

    // --- Fetch GitHub Profile ---
    useEffect(() => {
        // Fetch only when dialog opens AND app isn't loading AND user exists AND profile not yet fetched/loading
        if (isOpen && !isAppLoading && appContextUser?.username && !githubProfile && !githubLoading) {
            const fetchProfile = async () => {
                setGithubLoading(true);
                console.log(`Fetching GitHub profile for: ${appContextUser.username}`); // Debug Log
                const result = await getGitHubUserProfile(appContextUser.username!);
                if (result.success && result.profile) {
                    console.log("GitHub profile found:", result.profile); // Debug Log
                    setGithubProfile(result.profile);
                } else {
                    console.warn("GitHub profile fetch failed:", result.error); // Debug Log
                    // Keep profile null if not found or error
                }
                setGithubLoading(false);
            };
            fetchProfile();
        }
        // Optional: Reset profile on close?
        // if (!isOpen) setGithubProfile(null);
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading]);


    // --- Base Suggestions ---
    // This logic remains here as it depends on currentPath and state managed here
    const suggestions = useMemo((): Suggestion[] => {
        const isOnRepoXmlPage = currentPath === '/repo-xml'; // Check path directly here
        const folderPath = currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`;

        const baseSuggestions: Suggestion[] = [];

        // Suggest "Fix page" only if NOT on repo-xml page and not clicked yet
        if (!isOnRepoXmlPage && !fixActionClicked) {
            baseSuggestions.push({
                id: FIX_PAGE_ID,
                text: "Исправить эту страницу",
                link: `/repo-xml?path=${folderPath}`,
                isFixAction: true,
                icon: <FaHighlighter className="mr-1.5" />
            });
        }

        // Add standard suggestions
        baseSuggestions.push({
            id: "add-new",
            text: "Создать что-то новое",
            link: "/repo-xml", // Link to the main tool page
            icon: <FaWandMagicSparkles className="mr-1.5" />
        });
        baseSuggestions.push({
            id: "hire-me",
            text: HIRE_ME_TEXT,
            link: "/selfdev", // Assuming this is the correct link
            isHireMe: true,
            icon: <FaStar className="mr-1.5" />
        });

        return baseSuggestions;
        // Dependencies: path, click state
    }, [currentPath, fixActionClicked]);


    // --- Update Active Message Logic (Enhanced) ---
    useEffect(() => {
        // Don't update message if app context is still loading
        if (isAppLoading) {
            setActiveMessage("Загрузка...");
            return;
        }

        let baseGreeting = "Привет";
        let userIdentifier = "";
        let profileFound = false;

        // Use GitHub name or TG first name if available
        if (githubProfile?.name) {
            userIdentifier = githubProfile.name;
            profileFound = true;
        } else if (appContextUser?.first_name) {
            userIdentifier = appContextUser.first_name;
        } else if (appContextUser?.username) {
            userIdentifier = appContextUser.username; // Fallback to username
        }

        if (userIdentifier) {
            baseGreeting += `, ${userIdentifier}`;
        }
        baseGreeting += "!";

        let message = "";

        if (profileFound) {
            // Special message if GitHub profile was found
            message = `${baseGreeting} Рада видеть твой GitHub-профиль! ✨ Чем займемся сегодня?`;
        } else if (githubLoading) {
             // Loading message
            message = `Привет${userIdentifier ? ', ' + userIdentifier : ''}! Ищу твой профиль на GitHub... 🧐`;
        }
         else {
            // Message if no GitHub profile found (or username wasn't available)
            message = `${baseGreeting} GitHub-профиль не найден (или не указан), но это не страшно! 😉 Что будем кодить?`;
        }

        // Add hint for the current page if not on repo-xml
        const isOnRepoXmlPage = currentPath === '/repo-xml';
        if (!isOnRepoXmlPage) {
            message += ` Может, улучшим эту страницу (${currentPath})?`;
        }

        setActiveMessage(message);
        // Dependencies: Include all factors affecting the message
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, currentPath]);


    // --- Auto-open Timer ---
    useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key to Close Dialog ---
    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); } }, []);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        if (suggestion.link) {
            if (suggestion.isFixAction) { setFixActionClicked(true); }
            router.push(suggestion.link);
        } else if (suggestion.action) {
            suggestion.action(); // Contextual actions are removed, this might be unused now
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
                // --- Overlay and Dialog ---
                <motion.div
                    key="dialog-overlay"
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

                        {/* Render Subcomponents */}
                        <SpeechBubble message={activeMessage} variants={childVariants} />

                        <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                            <CharacterDisplay
                                githubProfile={githubProfile}
                                characterImageUrl={CHARACTER_IMAGE_URL}
                                characterAltText={CHARACTER_ALT_TEXT}
                                variants={childVariants}
                            />
                            <SuggestionList
                                suggestions={suggestions} // Use base suggestions
                                onSuggestionClick={handleSuggestionClick}
                                listVariants={childVariants} // Use same variant for list container
                                itemVariants={childVariants} // Use same variant for items
                            />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                // --- Floating Action Button ---
                <FloatingActionButton onClick={handleFabClick} variants={fabVariants} />
            )}
        </AnimatePresence>
    );
};

export default StickyChatButton;