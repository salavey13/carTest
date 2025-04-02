"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    // Icons for Repo XML page suggestions
    FaDownload, FaCode, FaBrain, FaRocket, FaEye // Added more specific icons
} from "react-icons/fa6";

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
const HIRE_ME_TEXT = "Найми меня! ✨"; // More vibrant
const FIX_PAGE_ID = "fix-current-page";

// Re-define Suggestion type here or import from a shared types file
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
// Re-define profile type here or import from a shared types file
interface GitHubProfile {
    login: string;
    avatar_url: string;
    html_url: string;
    name?: string | null;
}

// --- Animation Variants --// --- Animation Variants --- (Keep variants definitions)
const containerVariants = { hidden: { opacity: 0, x: -300 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 15, when: "beforeChildren", staggerChildren: 0.08, }, }, exit: { opacity: 0, x: -300, transition: { duration: 0.3 } }, };
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };
const fabVariants = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, rotate: [0, 10, -10, 5, -5, 0], transition: { scale: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.4, ease: "easeOut" }, rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 } } }, exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } } };


// --- Main Component (Orchestrator) ---
const StickyChatButton: React.FC = () => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false);
    const [fixActionClicked, setFixActionClicked] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [activeMessage, setActiveMessage] = useState<string>("Загрузка..."); // Initial loading message
    const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
    const [githubLoading, setGithubLoading] = useState<boolean>(false);
    const [prevGithubLoading, setPrevGithubLoading] = useState<boolean>(false); // Track previous loading state

    // --- Hooks ---
    const currentPath = usePathname();
    const router = useRouter();
    const { user: appContextUser, isLoading: isAppLoading } = useAppContext();

    // --- Fetch GitHub Profile ---
    useEffect(() => {
        setPrevGithubLoading(githubLoading); // Update previous state *before* potential new fetch
        if (isOpen && !isAppLoading && appContextUser?.username && !githubProfile && !githubLoading) {
            const fetchProfile = async () => {
                setGithubLoading(true);
                console.log(`Fetching GitHub profile for: ${appContextUser.username}`);
                const result = await getGitHubUserProfile(appContextUser.username!);
                if (result.success && result.profile) {
                    console.log("GitHub profile found:", result.profile);
                    setGithubProfile(result.profile);
                } else {
                    console.warn("GitHub profile fetch failed:", result.error);
                }
                setGithubLoading(false);
            };
            fetchProfile();
        }
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading]); // Rerun if loading state changes too

    // --- Define Suggestions (Page-Specific Logic) ---
    const suggestions = useMemo((): Suggestion[] => {
        const isOnRepoXmlPage = currentPath === '/repo-xml';

        // --- Suggestions for Repo XML Page ---
        if (isOnRepoXmlPage) {
            // Function to navigate to page sections
            const scrollTo = (id: string) => {
                const element = document.getElementById(id);
                // Use smooth scroll, center element if possible
                element?.scrollIntoView({ behavior: "smooth", block: "center" });
                setIsOpen(false); // Close chat after clicking suggestion
            };

            return [
                { id: "scroll-fetcher", text: "К Экстрактору Кода 🤖", action: () => scrollTo('extractor'), icon: <FaDownload className="mr-1.5" /> },
                { id: "scroll-kwork", text: "Написать Запрос Боту ✍️", action: () => scrollTo('kwork-input-section'), icon: <FaCode className="mr-1.5" /> }, // Assuming you add id="kwork-input-section" to the div containing the label/textarea
                { id: "scroll-assistant", text: "К Ответу AI / PR 🚀", action: () => scrollTo('executor'), icon: <FaBrain className="mr-1.5" /> },
                { id: "back-to-intro", text: "Что тут вообще? 🤔", action: () => scrollTo('intro'), icon: <FaEye className="mr-1.5" /> },
                 { id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> }, // Keep hire me
            ];
        }

        // --- Base Suggestions (Other Pages) ---
        else {
            const folderPath = currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`;
            const baseSuggestions: Suggestion[] = [];

            if (!fixActionClicked) {
                baseSuggestions.push({ id: FIX_PAGE_ID, text: "Исправить эту страницу 🤩", link: `/repo-xml?path=${folderPath}`, isFixAction: true, icon: <FaHighlighter className="mr-1.5" /> });
            }
            baseSuggestions.push({ id: "add-new", text: "Создать Новое с Нуля ✨", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" /> });
            baseSuggestions.push({ id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> });

            return baseSuggestions;
        }
    }, [currentPath, fixActionClicked]); // Only depends on path and click state now


    // --- Update Active Message Logic (Fixes delayed update) ---
    useEffect(() => {
        // Initial loading state
        if (isAppLoading && !appContextUser) {
            setActiveMessage("Подключаюсь...");
            return;
        }

        // Determine user identifier
        let userIdentifier = "";
        if (githubProfile?.name) userIdentifier = githubProfile.name;
        else if (appContextUser?.first_name) userIdentifier = appContextUser.first_name;
        else if (appContextUser?.username) userIdentifier = appContextUser.username;

        const baseGreeting = userIdentifier ? `Привет, ${userIdentifier}!` : "Привет!";

        let message = "";
        const isOnRepoXmlPage = currentPath === '/repo-xml';

        // --- Message Logic ---
        if (githubLoading) {
            // Loading profile specifically
             message = `Привет${userIdentifier ? ', ' + userIdentifier : ''}! Ищу твой профиль на GitHub... 🧐`;
        } else if (githubProfile) {
             // Profile loaded *successfully* (even if just now)
             const loadedGreeting = userIdentifier ? `Ага, ${userIdentifier}!` : "О!"; // More surprised if name known
             message = `${loadedGreeting} Нашел твой GitHub! ✨ Выглядишь круто! Чем займемся?`;
             if (isOnRepoXmlPage) message = `${loadedGreeting} Нашел твой GitHub! ✨ Готов зажечь на странице Экстрактора/PR?`;

        } else if (prevGithubLoading && !githubProfile) {
             // Finished loading, but profile *not* found
              message = `${baseGreeting} Не нашел твой GitHub (или юзернейм не совпал)... Не беда! 😉 Что будем кодить?`;
             if (isOnRepoXmlPage) message = `${baseGreeting} GitHub не найден, но мы все равно можем работать с кодом здесь! 👇`;

        } else {
             // Default state (App loaded, GitHub not loading and not found yet/ever)
             message = `${baseGreeting} Что будем кодить сегодня?`;
             if (isOnRepoXmlPage) message = `${baseGreeting} Готов поработать с кодом на этой супер-странице? 😎`;
             else message = `${baseGreeting} Может, улучшим страницу "${currentPath}"? 😉`;
        }

        setActiveMessage(message);

    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath]); // Add prevGithubLoading

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
            suggestion.action(); // This will now trigger the scrollTo actions on /repo-xml
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

                        <SpeechBubble message={activeMessage} variants={childVariants} />

                        <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4">
                            <CharacterDisplay
                                githubProfile={githubProfile}
                                characterImageUrl={CHARACTER_IMAGE_URL}
                                characterAltText={CHARACTER_ALT_TEXT}
                                variants={childVariants}
                            />
                            <SuggestionList
                                suggestions={suggestions} // Use the correct suggestions list
                                onSuggestionClick={handleSuggestionClick}
                                listVariants={childVariants}
                                itemVariants={childVariants}
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