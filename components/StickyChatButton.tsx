"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard, FaPaperPlane, FaLightbulb // Added FaLightbulb
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";
import { toast } from "sonner"; // For feedback

// Import Context & Actions
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Найми меня! ✨";
const FIX_PAGE_ID = "fix-current-page";
const ADD_NEW_ID = "add-new"; // Added ID for create new
const HIRE_ME_ID = "hire-me"; // Added ID for hire me

interface Suggestion {
    id: string;
    text: string;
    link?: string;
    icon?: React.ReactNode;
    isHireMe?: boolean;
    isFixAction?: boolean;
    disabled?: boolean;
    tooltip?: string; // Added tooltip field
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
    const [fixActionClicked, setFixActionClicked] = useState(false); // Tracks if "Fix Page" was clicked this session
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [activeMessage, setActiveMessage] = useState<string>("Загрузка...");
    const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
    const [githubLoading, setGithubLoading] = useState<boolean>(false);
    const [prevGithubLoading, setPrevGithubLoading] = useState<boolean>(false);
    const [customIdea, setCustomIdea] = useState<string>(""); // State for custom idea input

    // --- Hooks ---
    const currentPath = usePathname();
    const router = useRouter();
    const { user: appContextUser, isLoading: isAppLoading } = useAppContext();

    // --- Fetch GitHub Profile ---
    useEffect(() => {
        setPrevGithubLoading(githubLoading); if (isOpen && !isAppLoading && appContextUser?.username && !githubProfile && !githubLoading) { const fetchProfile = async () => { setGithubLoading(true); console.log(`(StickyChat) Fetching GitHub profile for: ${appContextUser.username}`); const result = await getGitHubUserProfile(appContextUser.username!); if (result.success && result.profile) { console.log("(StickyChat) GitHub profile found:", result.profile); setGithubProfile(result.profile); } else { console.warn("(StickyChat) GitHub profile fetch failed:", result.error); setGithubProfile(null); } setGithubLoading(false); }; fetchProfile(); } if (!appContextUser) { setGithubProfile(null); setGithubLoading(false); }
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading]);


    // --- Define Suggestions & Link Logic (incorporates customIdea) ---
    const suggestions = useMemo((): Suggestion[] => {
        const baseSuggestions: Suggestion[] = [];
        const isToolPage = currentPath === '/repo-xml';
        const cleanPath = currentPath.split('?')[0];

        // --- Helper to get the correct link for fixing the current page ---
        const getFixPageLink = (): string => {
            let taskIdea = "";

            // <<<<<<<<<<<< NEW: Prioritize customIdea >>>>>>>>>>>>
            if (customIdea.trim()) {
                taskIdea = customIdea.trim();
                console.log("Using custom task idea:", taskIdea);
            } else {
                // Fallback to default logic if customIdea is empty
                if (cleanPath.startsWith('/vpr-test/')) {
                    taskIdea = "верни кнопку включения подсказок, пожалуйста";
                    console.log("Special task for /vpr-test/*:", taskIdea);
                } else {
                    taskIdea = `Проанализируй код страницы ${cleanPath || '/'} и предложи улучшения или найди баги.`;
                    console.log("Default task for", cleanPath, ":", taskIdea);
                }
            }
            // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

            const folderPathParam = cleanPath === "/" ? "app" : `app${cleanPath}`;
            const encodedTaskIdea = encodeURIComponent(taskIdea);
            const encodedPathParam = encodeURIComponent(folderPathParam);

            return `/repo-xml?path=${encodedPathParam}&idea=${encodedTaskIdea}`;
        };

        // Add "Fix this Page" / "Send Idea" suggestion
        if (!fixActionClicked && cleanPath !== '/' && !isToolPage) {
             const isCustomIdeaEntered = customIdea.trim().length > 0;
             baseSuggestions.push({
                 id: FIX_PAGE_ID,
                 text: isCustomIdeaEntered ? "🤖 Отправить Идею + Контекст" : "Прокачать эту Страницу? 🤩",
                 link: getFixPageLink(),
                 isFixAction: true,
                 icon: isCustomIdeaEntered ? <FaPaperPlane className="mr-1.5" /> : <FaHighlighter className="mr-1.5" />,
                 tooltip: isCustomIdeaEntered
                           ? "Отправит твою идею и код этой страницы в СуперВайб Студию"
                           : "Перейти в СуперВайб Студию с кодом этой страницы для улучшения"
             });
        }

        // Add other suggestions
        if (!isToolPage) {
            baseSuggestions.push({
                id: ADD_NEW_ID,
                text: "Создать Новое с Нуля ✨",
                link: "/repo-xml",
                icon: <FaWandMagicSparkles className="mr-1.5" />,
                tooltip: "Перейти в СуперВайб Студию без контекста"
            });
        }
        baseSuggestions.push({
            id: HIRE_ME_ID,
            text: HIRE_ME_TEXT,
            link: "/selfdev",
            isHireMe: true,
            icon: <FaStar className="mr-1.5" />,
            tooltip: "Узнать о SelfDev пути и заказать консультацию"
        });

        return baseSuggestions;

    }, [currentPath, fixActionClicked, router, customIdea]); // Added customIdea dependency


    // --- Update Active Message Logic ---
    useEffect(() => {
        if (isAppLoading || githubLoading) { let loadingMsg = "Подключаюсь..."; if (githubLoading) loadingMsg = `Ищу твой профиль на GitHub... 🧐`; setActiveMessage(loadingMsg); return; }
        let userIdentifier = githubProfile?.name || appContextUser?.first_name || appContextUser?.username || null; const baseGreeting = userIdentifier ? `Здарова, ${userIdentifier}!` : "Эй, Кодер!"; const justLoadedProfile = prevGithubLoading && !githubLoading && githubProfile; const cleanPath = currentPath.split('?')[0]; const isToolPage = cleanPath === '/repo-xml'; let message = "";
        if (isToolPage) { if (githubProfile) message = `${baseGreeting} Ты в СуперВайб Студии! ✨ Используй Бадди справа для помощи.`; else message = `${baseGreeting} Ты в СуперВайб Студии! Используй Бадди справа для помощи.`; }
        else { const pageName = cleanPath === '/' ? 'главную' : `страницу (${cleanPath})`; if (justLoadedProfile) message = `ВОУ, ${userIdentifier}! ✨ Нашел твой GitHub! Хочешь ${pageName} прокачать? 😉 Или дай свою идею!`; else if (githubProfile) message = `${baseGreeting} Рад видеть твой GitHub! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем править? Или есть своя идея?`; else message = `${baseGreeting} GitHub не найден... Не важно! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем улучшать? 😉 Или дай свою идею!`; }
        setActiveMessage(message);
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath]);


    // --- Auto-open Timer ---
    useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); } }, []);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);

    // Reset fixActionClicked on path change
    useEffect(() => { setFixActionClicked(false); setCustomIdea(""); }, [currentPath]); // Also clear custom idea


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        console.log("(StickyChat) Suggestion Clicked:", suggestion.id);

        if (suggestion.id === FIX_PAGE_ID && customIdea.trim()) {
             toast.info("Отправляю твою идею и контекст страницы...");
        } else if (suggestion.id === FIX_PAGE_ID) {
             toast.info("Перехожу к улучшению страницы...");
        }

        if (suggestion.link) {
            if (suggestion.isFixAction) setFixActionClicked(true);
            router.push(suggestion.link);
        }
        setIsOpen(false); // Close after any suggestion click
    };

    const handleOverlayClick = () => setIsOpen(false);
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => { setIsOpen(!isOpen); if (!isOpen) setHasAutoOpened(true); };


    // --- Render Logic ---
    const cleanPath = currentPath.split('?')[0];
    const showCustomInput = isOpen && !fixActionClicked && cleanPath !== '/' && currentPath !== '/repo-xml';

    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div key="dialog-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-4 bg-black bg-opacity-40 backdrop-blur-sm" onClick={handleOverlayClick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-modal="true" role="dialog" aria-labelledby="chat-suggestions-title">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="relative p-4 w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center sm:items-start bg-transparent" onClick={handleDialogClick}>
                        <h2 id="chat-suggestions-title" className="sr-only">Xuinity Suggestions</h2>
                        <SpeechBubble message={activeMessage} variants={childVariants} bubblePosition="left" />
                        <div className="flex flex-col sm:flex-row items-center sm:items-end w-full gap-4 mt-2"> {/* Adjusted gap */}
                            <CharacterDisplay githubProfile={githubProfile} characterImageUrl={CHARACTER_IMAGE_URL} characterAltText={CHARACTER_ALT_TEXT} variants={childVariants} />
                            <div className="flex flex-col items-center sm:items-start gap-2 w-full"> {/* Container for suggestions and input */}
                                <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-start" />

                                {/* NEW: Custom Idea Input Area */}
                                {showCustomInput && (
                                     <motion.div variants={childVariants} className="w-full mt-1"> {/* Reduced margin-top */}
                                         <label htmlFor="custom-idea-input" className="block text-xs font-medium mb-1 text-gray-300 flex items-center">
                                            <FaLightbulb className="text-yellow-400 mr-1"/> Или введи свою идею для этой страницы:
                                          </label>
                                         <textarea
                                             id="custom-idea-input"
                                             rows={2}
                                             value={customIdea}
                                             onChange={(e) => setCustomIdea(e.target.value)}
                                             className="w-full p-2 text-sm bg-gray-700/80 backdrop-blur-sm border border-gray-600/50 rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none text-white placeholder-gray-400 simple-scrollbar resize-none"
                                             placeholder="Например: 'Добавь кнопку X', 'Исправь расчет Y'..."
                                         />
                                     </motion.div>
                                )}
                             </div>
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