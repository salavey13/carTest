"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    // Specific Icons for Repo XML page suggestions
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard //, // Added Info & Keyboard
   // FaRegGrinBeamSweat // Added for fun
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
const HIRE_ME_TEXT = "Найми меня! ✨";
const FIX_PAGE_ID = "fix-current-page";

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
    const [prevGithubLoading, setPrevGithubLoading] = useState<boolean>(false); // Track previous loading state

    // --- Hooks ---
    const currentPath = usePathname();
    const router = useRouter();
    const { user: appContextUser, isLoading: isAppLoading } = useAppContext();

    // --- Fetch GitHub Profile ---
    useEffect(() => {
        // Track previous loading state BEFORE fetching
        setPrevGithubLoading(githubLoading);

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
                    setGithubProfile(null); // Explicitly set to null on failure/not found
                }
                setGithubLoading(false);
            };
            fetchProfile();
        }
        // Reset profile state if user context changes (e.g., logout/login simulation)
        if (!appContextUser) {
            setGithubProfile(null);
            setGithubLoading(false);
        }
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading]); // Re-run if any of these change


    // --- Define Suggestions (Page-Specific Logic) ---
    const suggestions = useMemo((): Suggestion[] => {
        const isOnRepoXmlPage = currentPath === '/repo-xml';

        // --- Suggestions for Repo XML Page ---
        if (isOnRepoXmlPage) {
            const scrollTo = (id: string) => {
                const element = document.getElementById(id);
                console.log(`Scrolling to: ${id}`, element); // Debug Log
                element?.scrollIntoView({ behavior: "smooth", block: "center" });
                setIsOpen(false);
            };

            return [
                // Guide the user through the page sections
                { id: "scroll-intro", text: "Че за CYBER STUDIO? 🤔", action: () => scrollTo('intro'), icon: <FaCircleInfo className="mr-1.5" /> },
                { id: "scroll-fetcher", text: "Дай Ссылку на GitHub! 🤖", action: () => scrollTo('extractor'), icon: <FaDownload className="mr-1.5" /> },
                { id: "scroll-kwork", text: "Напиши Запрос Боту! ✍️", action: () => scrollTo('kwork-input-section'), icon: <FaKeyboard className="mr-1.5" /> },
                { id: "scroll-assistant", text: "Вставь Ответ / Создай PR! 🚀", action: () => scrollTo('executor'), icon: <FaRocket className="mr-1.5" /> },
                { id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> },
            ];
        }

        // --- Base Suggestions (Other Pages) ---
        else {
            const folderPath = currentPath === "/" ? "app" : `app${currentPath.split('?')[0]}`;
            const baseSuggestions: Suggestion[] = [];

            if (!fixActionClicked) {
                baseSuggestions.push({ id: FIX_PAGE_ID, text: "Починить эту Страницу? 🤩", link: `/repo-xml?path=${folderPath}`, isFixAction: true, icon: <FaHighlighter className="mr-1.5" /> });
            }
            baseSuggestions.push({ id: "add-new", text: "Создать Новое с Нуля ✨", link: "/repo-xml", icon: <FaWandMagicSparkles className="mr-1.5" /> });
            baseSuggestions.push({ id: "hire-me", text: HIRE_ME_TEXT, link: "/selfdev", isHireMe: true, icon: <FaStar className="mr-1.5" /> });

            return baseSuggestions;
        }
    }, [currentPath, fixActionClicked]);


    // --- Update Active Message Logic (Reacts to GitHub state changes) ---
    useEffect(() => {
        // Show loading if app context or GitHub profile is loading
        if (isAppLoading || githubLoading) {
             let loadingMsg = "Подключаюсь...";
             if (githubLoading) loadingMsg = `Ищу твой профиль на GitHub... 🧐`;
             setActiveMessage(loadingMsg);
             return; // Exit early if loading
        }

        // Determine user identifier
        let userIdentifier = appContextUser?.first_name || appContextUser?.username || null;
        if (githubProfile?.name) { // Prefer GitHub name if available
            userIdentifier = githubProfile.name;
        }

        const baseGreeting = userIdentifier ? `Здарова, ${userIdentifier}!` : "Эй, Кодер!"; // More casual

        let message = "";
        const isOnRepoXmlPage = currentPath === '/repo-xml';
        const justLoadedProfile = prevGithubLoading && !githubLoading && githubProfile; // Profile was loading, now finished AND found

        // --- Message Logic ---
        if (justLoadedProfile) {
            // Special "WOW" message when profile loads after initial check
            const wowGreeting = userIdentifier ? `ВОУ, ${userIdentifier}!` : "ОПА!";
            message = `${wowGreeting} Нашел твой GitHub! ✨ Крутой аватар! Готов зажечь?`;
            if (isOnRepoXmlPage) message = `${wowGreeting} Нашел твой GitHub! ✨ Теперь ты точно готов к магии на этой странице! 😎👇`;

        } else if (githubProfile) {
            // Profile was already loaded or loaded instantly
            message = `${baseGreeting} Рад видеть твой GitHub! Чем сегодня займемся?`;
            if (isOnRepoXmlPage) message = `${baseGreeting} Вижу твой GitHub! Эта страница - твоя песочница. С чего начнем? 👇`;

        } else {
            // No profile loading, none found, or username missing
             message = `${baseGreeting} GitHub-профиль не найден (или ты инкогнито 😉)... Это не важно! Главное - код! Что будем делать?`;
            if (isOnRepoXmlPage) message = `${baseGreeting} GitHub не нужен для магии здесь! Просто укажи репо и погнали! 🔥👇`;
             else if (currentPath !== '/') message = `${baseGreeting} Зацени эту страницу (${currentPath})... Хочешь её прокачать? 😉`;
             else message = `${baseGreeting} Готов создать что-то крутое или починить баг? 😎`;
        }

        setActiveMessage(message);

    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath]);


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
            suggestion.action(); // Triggers scrollTo for repo-xml page
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
                                suggestions={suggestions} // Correct list based on page
                                onSuggestionClick={handleSuggestionClick}
                                listVariants={childVariants}
                                itemVariants={childVariants}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                <FloatingActionButton onClick={handleFabClick} variants={fabVariants} />
            )}
        </AnimatePresence>
    );
};

export default StickyChatButton;