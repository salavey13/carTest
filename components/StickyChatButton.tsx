"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaStar, FaArrowRight, FaWandMagicSparkles, FaHighlighter, FaGithub,
    FaDownload, FaCode, FaBrain, FaRocket, FaEye, FaCircleInfo, FaKeyboard, FaPaperPlane, FaLightbulb, FaImages, FaUpload, FaLink // Added relevant icons
} from "react-icons/fa6";

// Import Subcomponents
import { FloatingActionButton } from "@/components/stickyChat_components/FloatingActionButton";
import { SpeechBubble } from "@/components/stickyChat_components/SpeechBubble";
import { CharacterDisplay } from "@/components/stickyChat_components/CharacterDisplay";
import { SuggestionList } from "@/components/stickyChat_components/SuggestionList";
import { toast } from "sonner";

// Import Context & Actions
import { useAppContext } from "@/contexts/AppContext";
import { getGitHubUserProfile } from "@/app/actions_github/actions";
import { uploadImage } from "@/app/actions"; // Needed for image upload

// --- Constants & Types ---
const AUTO_OPEN_DELAY_MS = 13000;
const CHARACTER_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png";
const CHARACTER_ALT_TEXT = "Xuinity Assistant";
const HIRE_ME_TEXT = "Найми меня! ✨";
const REPLACE_IMAGE_ID = "replace-image-trigger"; // ID for image replacement trigger
const ADD_NEW_ID = "add-new";
const HIRE_ME_ID = "hire-me";

interface Suggestion {
    id: string;
    text: string;
    link?: string;
    icon?: React.ReactNode;
    isHireMe?: boolean;
    isFixAction?: boolean; // Kept for potential future use
    isImageReplaceAction?: boolean; // New flag
    disabled?: boolean;
    tooltip?: string;
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

// --- Helper Functions ---
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    // Basic check for common image extensions
    return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(parsedUrl.pathname);
  } catch (e) {
    return false; // Invalid URL
  }
};
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch (_) {
    return false;
  }
};

// --- NEW: Image Replace Tool Component ---
interface ImageReplaceToolProps {
    oldImageUrl: string;
    onReplaceConfirmed: (newImageUrl: string) => void;
    onCancel: () => void;
}

const ImageReplaceTool: React.FC<ImageReplaceToolProps> = ({ oldImageUrl, onReplaceConfirmed, onCancel }) => {
    const [newImageUrlInput, setNewImageUrlInput] = useState("");
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            setNewImageUrlInput(""); // Clear URL input if file is selected
            setUploadedUrl(null); // Clear previously uploaded URL
            handleUpload(file); // Trigger upload immediately
        }
    };

    const handleUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        setUploadedUrl(null);
        toast.info("Загрузка картинки...");
        try {
            // Use the actual uploadImage server action
            const result = await uploadImage("about", file); // Specify bucket name (e.g., "about")
            if (result.success && result.publicUrl) {
                setUploadedUrl(result.publicUrl);
                toast.success("Картинка загружена!");
            } else {
                throw new Error(result.error || "Не удалось загрузить картинку.");
            }
        } catch (error) {
            console.error("Upload failed:", error);
            toast.error(error instanceof Error ? error.message : "Ошибка загрузки.");
            setUploadedFile(null); // Clear file selection on error
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirm = () => {
        const finalNewUrl = uploadedUrl || newImageUrlInput;
        if (!finalNewUrl || !isValidUrl(finalNewUrl)) {
            toast.error("Введите корректный новый URL или загрузите файл.");
            return;
        }
        onReplaceConfirmed(finalNewUrl);
    };

    const canConfirm = !isUploading && (uploadedUrl || (isValidUrl(newImageUrlInput) && !uploadedFile));

    return (
        <motion.div variants={childVariants} className="w-full mt-2 p-3 bg-gray-700/80 backdrop-blur-sm border border-blue-500/50 rounded-lg shadow-lg flex flex-col gap-3">
            <p className="text-xs text-gray-300">Заменить эту картинку:</p>
            <input type="text" readOnly value={oldImageUrl} className="w-full p-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-400 truncate" />
            <p className="text-xs text-gray-300">Новой картинкой:</p>
            <div className="flex items-center gap-2">
                <label htmlFor="image-upload-input" className={`flex-shrink-0 p-2 rounded border transition-colors cursor-pointer ${uploadedFile ? 'bg-green-600 border-green-500' : 'bg-gray-600 border-gray-500 hover:bg-gray-500'}`}>
                    <FaUpload className={`text-sm ${uploadedFile ? 'text-white' : 'text-gray-300'}`} />
                </label>
                <input id="image-upload-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                <span className="text-xs text-gray-400">или</span>
                <input
                    type="url"
                    value={newImageUrlInput}
                    onChange={(e) => { setNewImageUrlInput(e.target.value); setUploadedFile(null); setUploadedUrl(null); }}
                    placeholder="Вставьте новый URL..."
                    className="flex-grow p-1.5 text-xs bg-gray-600 border border-gray-500 rounded focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none text-white disabled:opacity-50"
                    disabled={isUploading || !!uploadedFile}
                />
            </div>
             {isUploading && <p className="text-xs text-blue-300 animate-pulse text-center">Загрузка файла...</p>}
             {uploadedUrl && <p className="text-xs text-green-400 break-all">Загружен: {uploadedUrl}</p>}
            <div className="flex justify-end gap-2 mt-2">
                <button onClick={onCancel} className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-400 text-white rounded transition">Отмена</button>
                <button onClick={handleConfirm} disabled={!canConfirm} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Заменить
                </button>
            </div>
        </motion.div>
    );
};


// --- Main Component (Orchestrator) ---
const StickyChatButton: React.FC = () => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    const [activeMessage, setActiveMessage] = useState<string>("Загрузка...");
    const [githubProfile, setGithubProfile] = useState<GitHubProfile | null>(null);
    const [githubLoading, setGithubLoading] = useState<boolean>(false);
    const [prevGithubLoading, setPrevGithubLoading] = useState<boolean>(false);
    const [customIdea, setCustomIdea] = useState<string>("");
    const [potentialOldImageUrl, setPotentialOldImageUrl] = useState<string | null>(null); // State for detected image URL
    const [showReplaceTool, setShowReplaceTool] = useState<boolean>(false); // State to show the replacement tool

    // --- Hooks ---
    const currentPath = usePathname();
    const router = useRouter();
    const { user: appContextUser, isLoading: isAppLoading } = useAppContext();

    // --- Fetch GitHub Profile ---
    useEffect(() => {
        setPrevGithubLoading(githubLoading); if (isOpen && !isAppLoading && appContextUser?.username && !githubProfile && !githubLoading) { const fetchProfile = async () => { setGithubLoading(true); console.log(`(StickyChat) Fetching GitHub profile for: ${appContextUser.username}`); const result = await getGitHubUserProfile(appContextUser.username!); if (result.success && result.profile) { console.log("(StickyChat) GitHub profile found:", result.profile); setGithubProfile(result.profile); } else { console.warn("(StickyChat) GitHub profile fetch failed:", result.error); setGithubProfile(null); } setGithubLoading(false); }; fetchProfile(); } if (!appContextUser) { setGithubProfile(null); setGithubLoading(false); }
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading]);


    // --- Suggestion Logic (Modified) ---
    const suggestions = useMemo((): Suggestion[] => {
        const baseSuggestions: Suggestion[] = [];
        const isToolPage = currentPath === '/repo-xml';
        const cleanPath = currentPath.split('?')[0];

        // Only show "Create New" if not on the tool page
        if (!isToolPage) {
            baseSuggestions.push({
                id: ADD_NEW_ID,
                text: "Создать Новое с Нуля ✨",
                link: "/repo-xml",
                icon: <FaWandMagicSparkles className="mr-1.5" />,
                tooltip: "Перейти в СуперВайб Студию без контекста"
            });
        }

        // Add "Hire Me" suggestion
        baseSuggestions.push({
            id: HIRE_ME_ID,
            text: HIRE_ME_TEXT,
            link: "/selfdev",
            isHireMe: true,
            icon: <FaStar className="mr-1.5" />,
            tooltip: "Узнать о SelfDev пути и заказать консультацию"
        });

        // Add Image Replace Trigger IF an image URL is detected in customIdea
        if (potentialOldImageUrl && !isToolPage && !showReplaceTool) {
            baseSuggestions.unshift({ // Add to the beginning
                id: REPLACE_IMAGE_ID,
                text: "Заменить Картинку? 🖼️",
                action: () => setShowReplaceTool(true), // Action to show the tool
                icon: <FaImages className="mr-1.5 text-blue-400" />,
                tooltip: `Начать процесс замены картинки: ${potentialOldImageUrl.substring(0, 30)}...`
            });
        }

        return baseSuggestions;

    }, [currentPath, potentialOldImageUrl, showReplaceTool]); // Depend on potentialOldImageUrl and showReplaceTool

    // --- Update Active Message Logic ---
    useEffect(() => {
        if (isAppLoading || githubLoading) { let loadingMsg = "Подключаюсь..."; if (githubLoading) loadingMsg = `Ищу твой профиль на GitHub... 🧐`; setActiveMessage(loadingMsg); return; }
        let userIdentifier = githubProfile?.name || appContextUser?.first_name || appContextUser?.username || null; const baseGreeting = userIdentifier ? `Здарова, ${userIdentifier}!` : "Эй, Кодер!"; const justLoadedProfile = prevGithubLoading && !githubLoading && githubProfile; const cleanPath = currentPath.split('?')[0]; const isToolPage = cleanPath === '/repo-xml'; let message = "";
        if (isToolPage) { if (githubProfile) message = `${baseGreeting} Ты в СуперВайб Студии! ✨ Используй Бадди справа для помощи.`; else message = `${baseGreeting} Ты в СуперВайб Студии! Используй Бадди справа для помощи.`; }
        else { const pageName = cleanPath === '/' ? 'главную' : `страницу (${cleanPath})`;
            if (potentialOldImageUrl && !showReplaceTool) {
                message = `${baseGreeting} Заметил URL картинки в поле ввода. Хочешь заменить её?`;
            } else if (showReplaceTool) {
                message = `Окей, ${userIdentifier || 'дружок'}, давай заменим картинку! 👇`;
            } else if (justLoadedProfile) {
                message = `ВОУ, ${userIdentifier}! ✨ Нашел твой GitHub! Хочешь ${pageName} прокачать? 😉 Или введи идею/URL картинки!`;
            } else if (githubProfile) {
                message = `${baseGreeting} Рад видеть твой GitHub! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем править? Или введи идею/URL картинки.`;
            } else {
                message = `${baseGreeting} GitHub не найден... Не важно! ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} будем улучшать? 😉 Или введи идею/URL картинки!`;
            }
        }
        setActiveMessage(message);
    }, [isOpen, isAppLoading, appContextUser, githubProfile, githubLoading, prevGithubLoading, currentPath, potentialOldImageUrl, showReplaceTool]);


    // --- Auto-open Timer ---
    useEffect(() => { if (!hasAutoOpened && !isOpen) { const timer = setTimeout(() => { setIsOpen(true); setHasAutoOpened(true); }, AUTO_OPEN_DELAY_MS); return () => clearTimeout(timer); } }, [hasAutoOpened, isOpen]);

    // --- Handle Escape Key ---
    const handleEscKey = useCallback((event: KeyboardEvent) => { if (event.key === 'Escape' && isOpen) { setIsOpen(false); setShowReplaceTool(false); /* Close tool on Esc */ } }, [isOpen]);
    useEffect(() => { if (isOpen) { document.addEventListener('keydown', handleEscKey); } else { document.removeEventListener('keydown', handleEscKey); } return () => { document.removeEventListener('keydown', handleEscKey); }; }, [isOpen, handleEscKey]);

    // Reset state on path change
    useEffect(() => {
        setCustomIdea("");
        setPotentialOldImageUrl(null);
        setShowReplaceTool(false);
        setIsOpen(false); // Optionally close the button on path change
        setHasAutoOpened(false); // Reset auto-open timer trigger
    }, [currentPath]);

    // Detect Image URL in Custom Input
    useEffect(() => {
        if (isImageUrl(customIdea)) {
            setPotentialOldImageUrl(customIdea);
        } else {
            setPotentialOldImageUrl(null);
             // If user types something else after detecting URL, hide the tool
            if (showReplaceTool) {
                setShowReplaceTool(false);
            }
        }
    }, [customIdea, showReplaceTool]);


    // --- Event Handlers ---
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.disabled) return;
        console.log("(StickyChat) Suggestion Clicked:", suggestion.id, suggestion.action);

        if (suggestion.action) {
            suggestion.action(); // Execute action if provided (like opening the replace tool)
        } else if (suggestion.link) {
            // --- Handle Redirection ---
            let finalLink = suggestion.link;
            // If custom idea exists AND this isn't the image replace trigger, treat it as a standard idea
            if (customIdea.trim() && suggestion.id !== REPLACE_IMAGE_ID && suggestion.link === '/repo-xml') {
                 const cleanPath = currentPath.split('?')[0];
                 let targetPath = cleanPath === "/" ? "app/page.tsx" : `app${cleanPath}`;
                 if (!targetPath.match(/\.[^/.]+$/)) {
                     targetPath = targetPath.endsWith('/') ? targetPath + 'page.tsx' : targetPath + '/page.tsx';
                 }
                 const encodedTargetPath = encodeURIComponent(targetPath);
                 const encodedIdea = encodeURIComponent(customIdea.trim());
                 finalLink = `/repo-xml?path=${encodedTargetPath}&idea=${encodedIdea}`;
                 toast.info("🚀 Отправляю твою идею и контекст страницы в СуперВайб Студию!");
            } else {
                 toast.info("🚀 Перехожу...");
            }
            router.push(finalLink);
        }

        // Close the popup unless it's the action to open the replace tool
        if (suggestion.id !== REPLACE_IMAGE_ID) {
             setIsOpen(false);
        }
    };

    const handleReplaceConfirmed = (newImageUrl: string) => {
        if (!potentialOldImageUrl) {
            toast.error("Ошибка: Старый URL картинки не найден.");
            return;
        }
        // Format the special idea string
        const structuredIdea = `ImageReplace|OldURL=${encodeURIComponent(potentialOldImageUrl)}|NewURL=${encodeURIComponent(newImageUrl)}`;

        // Get target path (similar logic as before)
        const cleanPath = currentPath.split('?')[0];
        let targetPath = cleanPath === "/" ? "app/page.tsx" : `app${cleanPath}`;
        if (!targetPath.match(/\.[^/.]+$/)) {
            targetPath = targetPath.endsWith('/') ? targetPath + 'page.tsx' : targetPath + '/page.tsx';
        }
        const encodedTargetPath = encodeURIComponent(targetPath);
        const encodedIdea = encodeURIComponent(structuredIdea);

        const redirectUrl = `/repo-xml?path=${encodedTargetPath}&idea=${encodedIdea}`;
        toast.info("🚀 Перехожу в Студию для замены картинки...");
        router.push(redirectUrl);
        setIsOpen(false); // Close the main dialog
        setShowReplaceTool(false); // Close the tool
    };

    const handleCancelReplace = () => {
        setShowReplaceTool(false);
        setPotentialOldImageUrl(null); // Clear detection maybe?
        setCustomIdea(""); // Clear the input that triggered it
    };

    const handleOverlayClick = () => { setIsOpen(false); setShowReplaceTool(false); };
    const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();
    const handleFabClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setHasAutoOpened(true);
            setShowReplaceTool(false); // Ensure tool is closed when FAB is clicked to open
            setCustomIdea(""); // Clear idea when reopening
            setPotentialOldImageUrl(null);
        } else {
            setShowReplaceTool(false); // Close tool if main dialog is closed
        }
    };

    // --- Render Logic ---
    const showInputArea = isOpen && !showReplaceTool && currentPath !== '/repo-xml';

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

                                {/* Conditionally render Replace Tool OR Input/Suggestions */}
                                {showReplaceTool && potentialOldImageUrl ? (
                                    <ImageReplaceTool
                                        oldImageUrl={potentialOldImageUrl}
                                        onReplaceConfirmed={handleReplaceConfirmed}
                                        onCancel={handleCancelReplace}
                                    />
                                ) : (
                                    <>
                                        {/* Custom Idea/URL Input Area */}
                                        {showInputArea && (
                                            <motion.div variants={childVariants} className="w-full">
                                                <label htmlFor="custom-idea-input" className="block text-xs font-medium mb-1 text-gray-300 flex items-center">
                                                    <FaLightbulb className="text-yellow-400 mr-1.5 text-sm" /> Введи идею / URL картинки:
                                                </label>
                                                <textarea
                                                    id="custom-idea-input"
                                                    rows={2}
                                                    value={customIdea}
                                                    onChange={(e) => setCustomIdea(e.target.value)}
                                                    className="w-full p-2 text-sm bg-gray-700/80 backdrop-blur-sm border border-gray-600/50 rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none text-white placeholder-gray-400 simple-scrollbar resize-none"
                                                    placeholder="Напр: 'Добавь кнопку Х' или https://..."
                                                />
                                            </motion.div>
                                        )}
                                        {/* Suggestion List */}
                                        <SuggestionList suggestions={suggestions} onSuggestionClick={handleSuggestionClick} listVariants={childVariants} itemVariants={childVariants} className="items-center sm:items-start" />
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                 !isAppLoading && // Only show FAB if app isn't loading
                 <div className="fixed bottom-4 left-4 z-40">
                     <FloatingActionButton onClick={handleFabClick} variants={fabVariants} />
                 </div>
            )}
        </AnimatePresence>
    );
};

export default StickyChatButton;