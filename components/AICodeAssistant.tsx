"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject } from "react";
import { createGitHubPullRequest, getOpenPullRequests } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";
import { saveAs } from "file-saver";
// Import ALL necessary icons, including new ones
import {
    FaArrowRight, FaEllipsisV, FaTelegramPlane, FaList, FaTools, FaPlus,
    FaInfoCircle, FaRobot, FaImage, FaBook, FaDatabase, FaRocket, FaCode,
    FaLink, FaCheckSquare, FaSync, FaTrashAlt, FaCopy, FaRightLeft
} from "react-icons/fa6"; // Using fa6
import { toast } from "sonner";
import clsx from 'clsx';
import { motion, AnimatePresence } from "framer-motion";

// Tooltip Component
const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-50 p-2 bg-gray-700 text-white text-[13px] rounded shadow-lg w-max max-w-xs bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-pre-line">
          {text}
        </div>
      )}
    </div>
  );
};
Tooltip.displayName = 'Tooltip';

// File Entry Interface
interface FileEntry {
  path: string;
  content: string;
  extension: string;
}

// Component Props Interface
interface AICodeAssistantProps {
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

// Swap Modal Component
interface SwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwap: (find: string, replace: string) => void;
}

const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose, onSwap }) => {
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');

    const handleSwapClick = () => {
        if (!findText) {
            toast.warn("Введите текст для поиска.");
            return;
        }
        onSwap(findText, replaceText);
        // Keep modal open after swap for potential further replacements
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" // Increased z-index
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-cyan-500/30"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Замена текста</h3>
                <div className="space-y-4 mb-6">
                    <div>
                        <label htmlFor="find-input" className="block text-sm font-medium mb-1 text-gray-300">Найти:</label>
                        <input
                            id="find-input"
                            type="text"
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                            className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm text-white"
                            placeholder="Текст, который нужно заменить"
                        />
                    </div>
                    <div>
                        <label htmlFor="replace-input" className="block text-sm font-medium mb-1 text-gray-300">Заменить на:</label>
                        <input
                            id="replace-input"
                            type="text"
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                            className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm text-white"
                            placeholder="Новый текст (оставьте пустым для удаления)"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-500 transition text-white"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSwapClick}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition shadow-[0_0_10px_rgba(0,255,157,0.4)]"
                    >
                        Заменить все
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
SwapModal.displayName = 'SwapModal';

// Main Component
const AICodeAssistant = forwardRef<any, AICodeAssistantProps>(({ aiResponseInputRef }, ref) => {
  // --- Hooks ---
  const { user } = useAppContext();
  const repoContext = useRepoXmlPageContext();

  // --- Context Values (Conditional) ---
  const setAiResponseHasContent = repoContext?.setAiResponseHasContent ?? (() => {});
  const setFilesParsed = repoContext?.setFilesParsed ?? (() => {});
  const setSelectedAssistantFiles = repoContext?.setSelectedAssistantFiles ?? (() => {});
  const scrollToSection = repoContext?.scrollToSection ?? (() => {});
  const setAssistantLoading = repoContext?.setAssistantLoading ?? (() => {});

  // --- State ---
  const [response, setResponse] = useState<string>("");
  const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [selectedParsedFiles, setSelectedParsedFilesState] = useState<Set<string>>(new Set());
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prDescription, setPrDescription] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Local loading for specific actions like PR create
  const [loadingPRs, setLoadingPRs] = useState(false); // Loading for fetching PR list
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showSavedFileMenu, setShowSavedFileMenu] = useState(false);
  const [showPRDetails, setShowPRDetails] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
  const [showSwapModal, setShowSwapModal] = useState(false); // State for Swap Modal visibility

  // --- Constants ---
   const predefinedLinks = [
        { name: "Grok", url: "https://grok.com", icon: <FaRobot className="text-yellow-300 font-bold drop-shadow-md" /> },
        { name: "QwenLM", url: "https://qwenlm.ai", icon: <FaImage className="text-blue-500" /> },
        { name: "NotebookLM", url: "https://notebooklm.google.com", icon: <FaBook className="text-yellow-500" /> },
        { name: "Supabase", url: "https://supabase.com", icon: <FaDatabase className="text-teal-500" /> },
        { name: "Vercel", url: "https://vercel.com", icon: <FaRocket className="text-black" /> },
        { name: "Coze.com", url: "https://coze.com", icon: <FaCode className="text-purple-500" /> },
    ];

  // --- Effects ---
  useEffect(() => {
    // Update context about whether the AI response textarea has content
    setAiResponseHasContent(response.trim().length > 0);
    // If user starts typing/pasting after parsing, reset parsing status in context
    if (response.trim().length > 0) {
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
    }
  }, [response, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles]);

  useEffect(() => {
    // Load saved files and custom links from user metadata in Supabase
    const loadData = async () => {
      if (user) {
        try {
            const { data: userData, error } = await supabaseAdmin
            .from("users")
            .select("metadata")
            .eq("user_id", user.id)
            .single();

            if (error && error.code !== 'PGRST116') { // Ignore 'not found'
                console.warn("Supabase fetch error (non-critical):", error.message);
                return;
            }

            // Load saved generated files
            if (userData?.metadata?.generated_files) {
                setSavedFiles(
                    userData.metadata.generated_files.map((f: any) => ({
                    path: f.path,
                    content: f.code ?? f.content, // Handle potential naming variations
                    extension: f.extension ?? f.path.split('.').pop() ?? 'txt',
                    }))
                );
            } else {
                setSavedFiles([]);
            }
            // Load custom links
            if (userData?.metadata?.customLinks) {
                setCustomLinks(userData.metadata.customLinks);
            } else {
                 setCustomLinks([]);
            }
        } catch(e) {
             console.error("Error loading user data:", e);
        }
      } else {
          // Clear data if user logs out
          setSavedFiles([]);
          setCustomLinks([]);
      }
    };
    loadData();
  }, [user]); // Rerun when user changes

  // --- Helper Functions ---
  const parseFilesFromText = (text: string): FileEntry[] => {
        const entries: FileEntry[] = [];
        // Enhanced Regex to capture file paths before or after code blocks, and language hints
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$)|(?:^\s*))\n*^```(\w+)?\n([\s\S]*?)\n^```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Prefer file path from comment AFTER the block, then BEFORE
            let path = (match[4] || match[1] || `unnamed-${entries.length + 1}`).trim();
            const language = match[2] || ''; // Language specifier (e.g., 'typescript')
            let content = match[3].trim();
            let extension = path.split('.').pop() || 'txt';

            // If path wasn't found in comments, check if first line of code block looks like a path
            if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0].trim();
                // Check for comment-like path: // path/to/file.ts
                const pathCommentMatch = potentialPathLine.match(/^(?:\/\/|\/\*|--|#)\s*([\w\-\/\.]+?\.\w+)/);
                // Check for plain path: path/to/file.ts (if more lines exist)
                const plainPathMatch = potentialPathLine.match(/^[\w\-\/\.]+?\.\w+$/) && lines.length > 1;

                if (pathCommentMatch) {
                    path = pathCommentMatch[1].trim();
                    content = lines.slice(1).join('\n').trim(); // Use rest of lines as content
                    extension = path.split('.').pop() || 'txt';
                } else if (plainPathMatch) {
                    path = potentialPathLine;
                    content = lines.slice(1).join('\n').trim(); // Use rest of lines as content
                    extension = path.split('.').pop() || 'txt';
                }
            }
            // Clean up potential leading slashes
            path = path.replace(/^[\/\\]+/, '');
            entries.push({ path, content, extension });
        }

        // Fallback if no fenced code blocks found (maybe treat whole text as one file?)
        if (entries.length === 0 && text.trim().length > 0 && !text.includes('```')) {
             console.warn("No fenced code blocks found. Consider response format.");
        }
        return entries;
    };

  const extractPRDetails = (rawText: string): { title: string; description: string; commitMessage: string } => {
    // Default values
    let title = "AI Assistant Update";
    let description = "Automated changes based on AI response.";
    let commitMsg = "feat: Apply AI generated changes";

    const lines = rawText.split('\n');
    let descriptionLines: string[] = [];
    let commitLines: string[] = [];
    let readingDescription = false;
    let readingCommit = false;

    // First pass: look for specific markers (Title:, Description:, Commit Message:)
    lines.forEach(line => {
        const lowerLine = line.toLowerCase().trim();
        if (lowerLine.startsWith("title:")) {
            title = line.substring(line.indexOf(':') + 1).trim().substring(0, 100); // Limit title length
            readingDescription = false; readingCommit = false;
        } else if (lowerLine.startsWith("description:")) {
            const descStart = line.substring(line.indexOf(':') + 1).trim();
            description = descStart; // Start description
            readingDescription = true; readingCommit = false;
            if (description) descriptionLines.push(description); // Add first line
        } else if (lowerLine.startsWith("commit message:")) {
            const commitStart = line.substring(line.indexOf(':') + 1).trim();
            commitMsg = commitStart; // Start commit message
             readingDescription = false; readingCommit = true;
             if (commitMsg) commitLines.push(commitMsg);
        } else if (readingDescription) {
            descriptionLines.push(line); // Continue reading multi-line description
        } else if (readingCommit) {
             commitLines.push(line); // Continue reading multi-line commit message
        }
    });

    description = descriptionLines.join('\n').trim();
    commitMsg = commitLines.join('\n').trim();

    // Fallbacks if markers weren't found or content was empty
    // Extract lines that are NOT code blocks, file paths, or the markers themselves
    const textOnlyLines = lines.filter(line =>
        !line.trim().startsWith('```') &&
        !line.match(/^\s*(?:\/\/|\/\*|--|#)\s*File:/) &&
        !line.toLowerCase().trim().startsWith("title:") &&
        !line.toLowerCase().trim().startsWith("description:") &&
        !line.toLowerCase().trim().startsWith("commit message:")
    ).map(l => l.trim()).filter(Boolean); // Get non-empty text lines

    // Use first text line as fallback title
    if (!title || title === "AI Assistant Update") {
        title = textOnlyLines[0]?.substring(0, 70) || "AI Assistant Update";
    }
    // Use first few text lines as fallback description
    if (!description || description === "Automated changes based on AI response.") {
        description = textOnlyLines.slice(0, 5).join('\n').trim() || "Automated changes based on AI response.";
    }
    // Use first line as commit subject, next few as body fallback
     if (!commitMsg || commitMsg === "feat: Apply AI generated changes") {
         const commitSubject = textOnlyLines[0]?.substring(0, 50) || "Apply AI changes";
         const commitBody = textOnlyLines.slice(1, 6).join('\n').trim();
        commitMsg = commitSubject + (commitBody ? `\n\n${commitBody}` : "");
    }

    return { title, description, commitMessage: commitMsg };
  };

  // --- Action Handlers ---
  const handleParse = () => {
    if (!repoContext) return; // Should not happen on repo-xml page, but safeguard
    setAssistantLoading(true);
    setParsedFiles([]);
    setSelectedParsedFilesState(new Set());
    setFilesParsed(false);
    setSelectedAssistantFiles(new Set());

    const files = parseFilesFromText(response);
    setParsedFiles(files); // Update local state for rendering list

    if (files.length > 0) {
        const { title, description, commitMessage: extractedCommitMsg } = extractPRDetails(response);
        setPrTitle(title);
        setPrDescription(description);
        setCommitMessage(extractedCommitMsg);
        setFilesParsed(true); // Set context: parsing SUCCEEDED
        toast.success(`${files.length} файлов разобрано!`);
        selectAllParsedFiles(); // Auto-select parsed files
        setShowPRDetails(true); // Show PR details form
    } else {
        toast.info("В ответе не найдено файлов кода для разбора.");
        setFilesParsed(false); // Set context: parsing FAILED (no files)
        // Clear PR details if no files were found
        setPrTitle('');
        setPrDescription('');
        setCommitMessage('');
    }
    // Simulate slight delay or let context effect handle loading state
    setTimeout(() => setAssistantLoading(false), 200);
  };

  const handleSaveFiles = async () => {
        if (!user) return toast.error("Войдите, чтобы сохранять файлы.");
        if (parsedFiles.length === 0) return toast.info("Нет разобранных файлов для сохранения.");

        setLoading(true); // Use local loading state for this specific action
        try {
            const fileData = parsedFiles.map((file) => ({
                 path: file.path,
                 code: file.content,
                 extension: file.extension
            }));

            // Fetch existing user metadata
            const { data: existingData, error: fetchError } = await supabaseAdmin
                .from("users")
                .select("metadata")
                .eq("user_id", user.id)
                .single();

             if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'Row not found'
                throw fetchError;
             }

            // Merge new files with existing ones, overwriting duplicates by path
             const existingFiles = existingData?.metadata?.generated_files || [];
             const newPaths = new Set(fileData.map(f => f.path));
             const mergedFiles = [
                ...existingFiles.filter((f: any) => !newPaths.has(f.path)), // Keep old files not in the new set
                ...fileData // Add/overwrite with the newly parsed files
             ];

            // Upsert the updated metadata
            const { error: upsertError } = await supabaseAdmin
                .from("users")
                .upsert({
                    user_id: user.id,
                    metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles }
                }, { onConflict: 'user_id' }); // Specify the conflict column

             if (upsertError) throw upsertError;

            // Update local state to reflect saved files
            setSavedFiles(mergedFiles.map((f: any) => ({
                path: f.path,
                content: f.code ?? f.content,
                extension: f.extension ?? f.path.split('.').pop() ?? 'txt'
            })));
            toast.success(`${fileData.length} файлов успешно сохранены/обновлены!`);
        } catch (err) {
            toast.error("Ошибка при сохранении файлов: " + (err as Error).message);
            console.error("Save files error:", err);
        } finally {
            setLoading(false);
        }
  };

   const handleDownload = async () => {
        if (parsedFiles.length === 0) return toast.info("Нет разобранных файлов для скачивания.");
        try {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            parsedFiles.forEach((file) => zip.file(file.path, file.content)); // Add each file to zip
            const blob = await zip.generateAsync({ type: "blob" }); // Generate zip file blob
            saveAs(blob, "ai_generated_files.zip"); // Trigger download using file-saver
            toast.success("Архив с файлами скачан.")
        } catch (error) {
            toast.error("Ошибка при создании ZIP архива.");
            console.error("Zip error:", error);
        }
    };

   const downloadFile = async (file: FileEntry) => {
        if (!user?.id) return toast.error("Не удалось определить ID пользователя Telegram");
        setLoading(true);
        try {
            const result = await sendTelegramDocument(
                String(user.id), // Ensure user ID is a string
                file.content,
                file.path.split("/").pop() || "file" // Use filename or 'file' as fallback
            );
            if (result.success) {
                 toast.success(`Файл "${file.path}" отправлен в ваш чат Telegram!`);
            } else {
                 throw new Error(result.error ?? "Неизвестная ошибка Telegram API");
            }
        } catch (err) {
            toast.error(`Ошибка при отправке "${file.path}" в Telegram: ` + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

   const handleClearAllSavedFiles = async () => {
        if (!user) return toast.error("Войдите, чтобы очистить файлы.");
        if (savedFiles.length === 0) return toast.info("Нет сохраненных файлов для очистки.");

        const confirmed = window.confirm(`Вы уверены, что хотите удалить ВСЕ ${savedFiles.length} сохраненных файлов? Это действие необратимо.`);
        if (!confirmed) return;

        setLoading(true);
        try {
            // Fetch current metadata first
            const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            // Proceed only if metadata exists
            if (existingData?.metadata) {
                 // Update metadata by setting generated_files to an empty array
                 await supabaseAdmin.from("users").upsert({
                      user_id: user.id,
                      metadata: { ...existingData.metadata, generated_files: [] }
                 }, { onConflict: 'user_id'});
                 setSavedFiles([]); // Clear local state
                 toast.success("Все сохраненные файлы очищены!");
            } else {
                toast.info("Нет данных для очистки (метаданные не найдены).");
            }
        } catch (err) {
            toast.error("Ошибка при очистке файлов: " + (err as Error).message);
            console.error("Clear saved files error:", err);
        } finally {
            setLoading(false);
            setShowSavedFileMenu(false); // Close the menu
        }
    };

  const toggleParsedFileSelection = (path: string) => {
    setSelectedParsedFilesState((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(path)) {
            newSelected.delete(path);
        } else {
            newSelected.add(path);
        }
        setSelectedAssistantFiles(newSelected); // Update context as well
        return newSelected;
    });
  };

  const selectAllParsedFiles = () => {
      const allParsedPaths = new Set(parsedFiles.map(file => file.path));
      setSelectedParsedFilesState(allParsedPaths);
      setSelectedAssistantFiles(allParsedPaths); // Update context
      if (allParsedPaths.size > 0) {
         toast.info(`${allParsedPaths.size} файлов выбрано для PR.`);
      }
  };

  const handleGetOpenPRs = async () => {
        if (!repoUrl) return toast.error("Пожалуйста, укажите URL репозитория");
        setLoadingPRs(true);
        try {
            const result = await getOpenPullRequests(repoUrl);
            if (result.success && result.pullRequests) {
                 setOpenPRs(result.pullRequests);
                 if (result.pullRequests.length === 0) {
                     toast.info("Нет открытых PR в этом репозитории.");
                 } else {
                     toast.success(`Загружено ${result.pullRequests.length} открытых PR.`);
                 }
            } else {
                 toast.error("Ошибка при получении PR: " + result.error);
            }
        } catch (err) {
            toast.error("Критическая ошибка при получении PR: " + (err as Error).message);
            console.error("Get PRs error:", err);
        } finally {
            setLoadingPRs(false);
        }
    };

   const handleAddCustomLink = async () => {
        const name = prompt("Введите название ссылки:");
        const url = prompt("Введите URL ссылки (включая https://):");

        // Basic validation
        if (!name || !url) return;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
             return toast.warn("URL должен начинаться с http:// или https://");
        }

        const newLink = { name, url };
        const updatedLinks = [...customLinks, newLink];
        setCustomLinks(updatedLinks); // Optimistic UI update

        if (user) {
            try {
                 // Fetch existing metadata
                 const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                 // Upsert with updated customLinks array
                 await supabaseAdmin.from("users").upsert({
                     user_id: user.id,
                     metadata: { ...(existingData?.metadata || {}), customLinks: updatedLinks }
                 }, { onConflict: 'user_id' });
                 toast.success(`Ссылка "${name}" добавлена.`);
            } catch(err) {
                 toast.error("Ошибка сохранения ссылки: " + (err as Error).message);
                 setCustomLinks(customLinks); // Revert UI on error
                 console.error("Add custom link error:", err);
            }
        }
    };

  const handleCreatePR = async () => {
        // Validation checks
        if (!repoUrl || !selectedParsedFiles.size || !prTitle || !commitMessage) {
            let missing = [];
            if (!repoUrl) missing.push("URL репозитория");
            if (!selectedParsedFiles.size) missing.push("выбранные файлы");
            if (!prTitle) missing.push("заголовок PR");
            if (!commitMessage) missing.push("сообщение коммита");
            toast.error(`Пожалуйста, укажите: ${missing.join(', ')}`);
            setShowPRDetails(true); // Ensure details are visible if missing
            return;
        }

        if (!repoContext) return; // Safeguard
        setAssistantLoading(true); // Use context loading
        setLoading(true); // Local loading for button state

        try {
            // Map selected paths back to full FileEntry objects
            const filesToCommit = Array.from(selectedParsedFiles)
                .map((path) => {
                    // Find the file data (prioritize newly parsed over saved if names clash)
                    const parsedFile = parsedFiles.find((f) => f.path === path);
                    const savedFile = !parsedFile ? savedFiles.find((f) => f.path === path) : null;
                    const file = parsedFile || savedFile;
                    return file ? { path: file.path, content: file.content } : null;
                })
                .filter(Boolean) as { path: string; content: string }[]; // Ensure non-null entries

            if (filesToCommit.length === 0) {
                toast.error("Нет валидных файлов для коммита.");
                throw new Error("No valid files selected for commit.");
            }

            const username = user?.username || user?.id || "неизвестный";
            // Create a more informative default description if user hasn't provided much
            const finalDescription = (prDescription && prDescription.length > 30)
                 ? prDescription
                 : `${prDescription || 'Автоматическое обновление'}\n\nАвтоматически создано: ${username}\nЗатронутые файлы:\n- ${filesToCommit.map(f => f.path).join('\n- ')}`;

            // Call the server action to create the PR
            const result = await createGitHubPullRequest(
                repoUrl,
                filesToCommit,
                prTitle,
                finalDescription,
                commitMessage // Pass commit message
            );

            if (result.success && result.prUrl) {
                toast.success(`PR успешно создан: ${result.prUrl}`);
                await notifyAdmin(`Новый PR "${prTitle}" создан ${username} в ${repoUrl}: ${result.prUrl}`);
                handleGetOpenPRs(); // Refresh the list of open PRs
                // Optionally reset form fields after successful PR creation?
                // setResponse(''); // Clearing response might be too disruptive
                // setParsedFiles([]);
                // setSelectedParsedFilesState(new Set());
                // setPrTitle(''); setPrDescription(''); setCommitMessage('');
            } else {
                // Handle specific errors if possible (e.g., branch exists, invalid token)
                toast.error("Ошибка при создании PR: " + result.error);
                console.error("PR Creation Failed:", result.error);
            }
        } catch (err) {
            toast.error("Критическая ошибка при создании PR: " + (err as Error).message);
            console.error("Create PR error:", err);
        } finally {
            setAssistantLoading(false); // Use context loading
            setLoading(false); // Reset local loading
        }
    };

  // --- NEW Text Area Utility Handlers ---
  const handleClearResponse = () => {
      setResponse(""); // Clear textarea
      setParsedFiles([]); // Clear parsed files list
      setSelectedParsedFilesState(new Set()); // Clear selection
      if (repoContext) {
          setFilesParsed(false); // Update context: no longer parsed
          setSelectedAssistantFiles(new Set()); // Update context selection
          setAiResponseHasContent(false); // Update context content status
      }
      toast.info("Поле ответа очищено.");
  };

  const handleCopyResponse = () => {
      if (!response) {
          toast.info("Нечего копировать.");
          return;
      }
      navigator.clipboard.writeText(response)
          .then(() => toast.success("Текст ответа скопирован!"))
          .catch(err => {
              console.error("Clipboard copy failed:", err);
              toast.error("Не удалось скопировать текст.");
          });
  };

  const handleSwap = (find: string, replace: string) => {
      if (!find) return; // Avoid replacing nothing
      try {
          // Use RegExp for global, case-insensitive replacement? Or stick to exact match?
          // Using String.prototype.replaceAll for exact match, global replacement.
          const newResponse = response.replaceAll(find, replace);
          if (newResponse === response) {
              toast.info(`Текст "${find}" не найден в ответе.`);
          } else {
              setResponse(newResponse); // Update state with modified text
              toast.success(`Все вхождения "${find}" заменены.`);
              // Consider if re-parsing should happen automatically or be triggered manually
              // handleParse(); // <-- This might be too aggressive, let user re-parse if needed.
              setShowSwapModal(false); // Close modal after successful swap
          }
      } catch (error) {
          console.error("Swap error:", error);
          toast.error("Ошибка при замене текста. Проверьте консоль.");
      }
  };

  // Expose methods via ref (for potential parent/context interaction)
  useImperativeHandle(ref, () => ({
    handleParse,
    selectAllParsedFiles,
    handleCreatePR,
    // Add other handlers here if they need to be called externally
  }));

  // --- RENDER ---
  return (
    <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">
        {/* Header Section */}
        <header className="flex items-center gap-2 mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
            AI Code Assistant
            </h1>
            <Tooltip text={`Вставьте ответ AI → Нажмите '➡️' → Выберите файлы → Настройте PR → Создать PR`}>
             <FaInfoCircle className="text-blue-400 cursor-help hover:text-blue-300 transition" />
            </Tooltip>
        </header>

        {/* AI Response Input Section with Utilities */}
         <div className="mb-6">
            <label htmlFor="response-input" className="block text-sm font-medium mb-1">2. Ввод ответа AI</label>
             <p className="text-yellow-400 mb-2 text-sm">
                2️⃣ Вставьте сюда ПОЛНЫЙ ОТВЕТ от вашего AI. Затем нажмите '➡️'.
            </p>
            {/* `group` class allows utility buttons to appear on hover/focus-within */}
            <div className="relative group">
                <textarea
                    id="response-input"
                    ref={aiResponseInputRef} // Assign ref for potential external focus/scroll
                    className="w-full p-3 pr-12 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[150px] resize-y" // Allow vertical resize
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Вставьте ПОЛНЫЙ ОТВЕТ от AI здесь..."
                    disabled={repoContext?.assistantLoading || loading} // Disable during relevant loading states
                />
                {/* Utility Icons Container */}
                <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 z-10">
                     {/* Parse Button */}
                     <Tooltip text="Разобрать ответ AI">
                         <motion.button
                            className="p-1.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_12px_rgba(0,255,157,0.5)]"
                            onClick={handleParse}
                            disabled={repoContext?.assistantLoading || loading || !response}
                            whileHover={{ scale: (repoContext?.assistantLoading || loading || !response) ? 1 : 1.1 }}
                            whileTap={{ scale: (repoContext?.assistantLoading || loading || !response) ? 1 : 0.95 }}
                         >
                            <FaArrowRight size={14}/>
                         </motion.button>
                     </Tooltip>
                     {/* Swap Text Button */}
                      <Tooltip text="Заменить текст">
                         <motion.button
                            className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            onClick={() => setShowSwapModal(true)} // Open the modal
                            disabled={!response}
                            whileHover={{ scale: !response ? 1 : 1.1 }}
                            whileTap={{ scale: !response ? 1 : 0.95 }}
                         >
                            <FaRightLeft size={14}/>
                         </motion.button>
                     </Tooltip>
                     {/* Copy All Button */}
                     <Tooltip text="Скопировать все">
                          <motion.button
                            className="p-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            onClick={handleCopyResponse}
                            disabled={!response}
                            whileHover={{ scale: !response ? 1 : 1.1 }}
                            whileTap={{ scale: !response ? 1 : 0.95 }}
                          >
                            <FaCopy size={14}/>
                          </motion.button>
                     </Tooltip>
                     {/* Clear Field Button */}
                     <Tooltip text="Очистить поле">
                         <motion.button
                            className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            onClick={handleClearResponse}
                            disabled={!response}
                            whileHover={{ scale: !response ? 1 : 1.1 }}
                            whileTap={{ scale: !response ? 1 : 0.95 }}
                         >
                            <FaTrashAlt size={14}/>
                          </motion.button>
                     </Tooltip>
                </div>
            </div>
        </div>

         {/* Parsed Files Section */}
        {parsedFiles.length > 0 && (
            <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold text-cyan-400">Разобранные файлы ({parsedFiles.length})</h2>
                    {/* Options Menu Button */}
                    <div className="relative">
                        <button className="p-1 text-gray-400 hover:text-white" onClick={() => setShowFileMenu(!showFileMenu)} title="Опции для разобранных файлов">
                            <FaEllipsisV />
                        </button>
                        {/* Options Dropdown */}
                        {showFileMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute right-0 mt-2 w-48 bg-gray-700 rounded shadow-lg z-20 border border-gray-600 overflow-hidden"
                             >
                                <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white" onClick={() => { handleSaveFiles(); setShowFileMenu(false); }}>
                                    Сохранить/Обновить
                                </button>
                                <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white" onClick={() => { handleDownload(); setShowFileMenu(false); }}>
                                    Скачать ZIP
                                </button>
                                <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white" onClick={() => { selectAllParsedFiles(); setShowFileMenu(false); }}>
                                    <FaCheckSquare className="inline mr-1" /> Выбрать все для PR
                                </button>
                                <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white" onClick={() => { setSelectedParsedFilesState(new Set()); setSelectedAssistantFiles(new Set()); setShowFileMenu(false); }}>
                                    Снять выделение
                                </button>
                            </motion.div>
                        )}
                    </div>
                </div>
                {/* Scrollable File List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 simple-scrollbar">
                    {parsedFiles.map((file) => (
                    <div key={file.path} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-1 py-0.5 rounded transition-colors duration-150" onClick={() => toggleParsedFileSelection(file.path)}>
                        <input
                            type="checkbox"
                            checked={selectedParsedFiles.has(file.path)}
                            // Prevent event propagation to avoid double toggle
                            onChange={(e) => { e.stopPropagation(); toggleParsedFileSelection(file.path); }}
                            className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0"
                        />
                        <span className={`truncate text-sm ${selectedParsedFiles.has(file.path) ? 'text-white font-medium' : 'text-gray-400'}`} title={file.path}>
                            {file.path}
                        </span>
                        {/* Send to Telegram Button */}
                        <Tooltip text={`Отправить ${file.path.split('/').pop()} в Telegram`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                                disabled={loading || !user} // Use local loading state for this button
                                className="ml-auto text-purple-500 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition p-0.5"
                                >
                                <FaTelegramPlane size={14}/>
                            </button>
                        </Tooltip>
                    </div>
                    ))}
                </div>
            </div>
        )}

        {/* Saved Files Section */}
        {savedFiles.length > 0 && (
            <details className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
                <summary className="flex justify-between items-center cursor-pointer list-none -m-4 p-4 hover:bg-gray-700/30 rounded-t-xl transition"> {/* Improve summary clickable area */}
                    <h2 className="text-lg font-semibold text-cyan-400">Сохраненные файлы ({savedFiles.length})</h2>
                     {/* Options Menu Button */}
                     <div className="relative">
                        <button
                            className="p-1 text-gray-400 hover:text-white"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowSavedFileMenu(!showSavedFileMenu); }} // Prevent summary toggle & default behavior
                            title="Опции сохраненных файлов"
                         >
                            <FaEllipsisV />
                        </button>
                        {/* Options Dropdown */}
                        {showSavedFileMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute right-0 mt-2 w-56 bg-gray-700 rounded shadow-lg z-20 border border-gray-600 overflow-hidden"
                            >
                                <button className="block w-full text-left px-4 py-2 hover:bg-red-800/50 text-sm text-red-400 transition" onClick={handleClearAllSavedFiles}>
                                    Очистить все сохраненные
                                </button>
                                {/* Add more actions here if needed */}
                            </motion.div>
                        )}
                    </div>
                </summary>
                 {/* Scrollable Saved File List */}
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-2 simple-scrollbar">
                    {savedFiles.map((file) => (
                    <div key={`saved-${file.path}`} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-1 py-0.5 rounded transition-colors duration-150" onClick={() => toggleParsedFileSelection(file.path)} title={`Выбрать/отменить ${file.path} для PR`}>
                        <input
                            type="checkbox"
                            checked={selectedParsedFiles.has(file.path)}
                            onChange={(e) => { e.stopPropagation(); toggleParsedFileSelection(file.path); }}
                            className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0"
                        />
                        <span className={`truncate text-sm ${selectedParsedFiles.has(file.path) ? 'text-white font-medium' : 'text-gray-400'}`} title={file.path}>
                             {file.path} {/* Indicate if it's from saved? Maybe subtle icon? */}
                        </span>
                         {/* Send to Telegram Button */}
                         <Tooltip text={`Отправить ${file.path.split('/').pop()} в Telegram`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                                disabled={loading || !user} // Use local loading state
                                className="ml-auto text-purple-500 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition p-0.5"
                                >
                                <FaTelegramPlane size={14}/>
                            </button>
                        </Tooltip>
                    </div>
                    ))}
                </div>
            </details>
        )}

        {/* Pull Request Section */}
        <section id="pr-section" className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
                {/* Indicate selected files for PR */}
                <h2 className="text-lg font-semibold text-cyan-400">Pull Request ({selectedParsedFiles.size} файлов)</h2>
                <div className="flex gap-2 items-center">
                    {/* Create PR Button */}
                    <motion.button
                        className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-green-500 to-emerald-500 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        onClick={handleCreatePR}
                        // Disable if loading, no files selected, or essential details missing
                        disabled={repoContext?.assistantLoading || loading || selectedParsedFiles.size === 0 || !commitMessage || !prTitle || !repoUrl}
                        whileHover={{ scale: (repoContext?.assistantLoading || loading || selectedParsedFiles.size === 0) ? 1 : 1.05 }}
                        whileTap={{ scale: (repoContext?.assistantLoading || loading || selectedParsedFiles.size === 0) ? 1 : 0.95 }}
                    >
                         {(repoContext?.assistantLoading || loading) ? <FaSync className="animate-spin inline mr-1" /> : null}
                        Создать PR
                    </motion.button>
                    {/* Toggle PR Details Button */}
                    <Tooltip text="Показать/скрыть детали PR">
                        <button className="text-blue-400 hover:text-blue-300 transition text-sm p-1" onClick={() => setShowPRDetails(!showPRDetails)}>
                            {showPRDetails ? "Скрыть детали" : "Показать детали"}
                        </button>
                    </Tooltip>
                    {/* Refresh Open PRs Button */}
                     <Tooltip text="Обновить список открытых PR">
                         <button className="p-2 text-gray-400 hover:text-white transition disabled:opacity-50" onClick={handleGetOpenPRs} disabled={loadingPRs || !repoUrl}>
                             {loadingPRs ? <FaSync className="animate-spin"/> : <FaList />}
                        </button>
                     </Tooltip>
                </div>
            </div>

            {/* Collapsible PR Details Form */}
            <AnimatePresence>
                {showPRDetails && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2 space-y-3 overflow-hidden bg-gray-800/50 p-4 rounded-lg border border-gray-700" // Add background and padding
                    >
                        <p className="text-gray-400 text-xs mb-2">Эти поля автоматически заполнены из ответа бота. Проверьте и измените при необходимости.</p>
                        {/* Repo URL Input */}
                        <div>
                            <label className="block text-sm font-medium mb-1">URL репозитория</label>
                            <input
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                placeholder="https://github.com/username/repository"
                                disabled={repoContext?.assistantLoading || loading}
                            />
                        </div>
                        {/* PR Title Input */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Заголовок PR</label>
                            <input
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white"
                                value={prTitle}
                                onChange={(e) => setPrTitle(e.target.value)}
                                placeholder="Краткий заголовок для Pull Request"
                                disabled={repoContext?.assistantLoading || loading}
                            />
                        </div>
                        {/* PR Description Textarea */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Описание PR</label>
                            <textarea
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm min-h-[60px] resize-y text-white"
                                value={prDescription}
                                onChange={(e) => setPrDescription(e.target.value)}
                                placeholder="Подробное описание изменений (поддерживает Markdown)"
                                disabled={repoContext?.assistantLoading || loading}
                            />
                        </div>
                        {/* Commit Message Textarea */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Сообщение коммита</label>
                            <textarea
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm min-h-[80px] resize-y text-white"
                                value={commitMessage}
                                onChange={(e) => setCommitMessage(e.target.value)}
                                placeholder="Сообщение для коммита (первая строка - заголовок < 50 симв., далее - тело)"
                                disabled={repoContext?.assistantLoading || loading}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>

         {/* Open PRs List Section */}
        {openPRs.length > 0 && (
            <section className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
                <h2 className="text-lg font-semibold text-cyan-400 mb-2">Открытые Pull Requests ({openPRs.length})</h2>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-2 simple-scrollbar">
                    {openPRs.map((pr) => (
                    <li key={pr.id || pr.number} className="flex items-center gap-2 bg-gray-900 p-2 rounded text-sm border border-gray-700 shadow-sm">
                        {/* Link to the PR on GitHub */}
                        <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate flex-grow" title={pr.title}>
                         #{pr.number}: {pr.title}
                        </a>
                        {/* Display PR author */}
                         <span className="text-xs text-gray-500 ml-auto flex-shrink-0">by {pr.user?.login}</span>
                    </li>
                    ))}
                </ul>
            </section>
        )}

         {/* Tools Menu Section */}
        <div className="mb-6">
            <div className="relative inline-block">
                {/* Tools Menu Toggle Button */}
                <button
                    className={clsx(
                        "flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)]",
                        showToolsMenu && "bg-gray-700 ring-1 ring-cyan-500" // Highlight when open
                    )}
                    onClick={() => setShowToolsMenu(!showToolsMenu)}
                >
                    <FaTools className="text-gray-400" />
                    <span className="text-sm text-white">Инструменты</span>
                </button>
                {/* Tools Menu Dropdown (positioned above button) */}
                {showToolsMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 bottom-full mb-2 w-56 bg-gray-700 rounded-lg shadow-lg z-20 border border-gray-600 overflow-hidden"
                     >
                     {/* Predefined Links */}
                     {predefinedLinks.map((link) => (
                        <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-600 text-sm transition text-white"
                        >
                        {link.icon}
                        <span className="flex-grow">{link.name}</span>
                        </a>
                    ))}
                    {/* Custom User Links */}
                    {customLinks.map((link) => (
                        <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-600 text-sm transition text-white"
                        >
                        <FaLink className="text-gray-400" />
                        <span className="flex-grow">{link.name}</span>
                        </a>
                    ))}
                    {/* Add Custom Link Button */}
                    <button className="flex items-center gap-2.5 w-full text-left px-4 py-2 hover:bg-gray-600 text-sm text-cyan-400 transition" onClick={handleAddCustomLink}>
                        <FaPlus /> Добавить свою ссылку
                    </button>
                    </motion.div>
                )}
            </div>
        </div>

         {/* Swap Modal - Rendered conditionally */}
         <AnimatePresence>
             {showSwapModal && (
                <SwapModal
                    isOpen={showSwapModal}
                    onClose={() => setShowSwapModal(false)}
                    onSwap={handleSwap}
                />
             )}
         </AnimatePresence>
    </div> // End of main component div
  );
});

AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;