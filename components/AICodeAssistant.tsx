"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject } from "react"; // Added React and forwardRef
import { createGitHubPullRequest, getOpenPullRequests } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext"; // Import context hook
import { saveAs } from "file-saver";
import { FaArrowRight, FaEllipsisV, FaTelegramPlane, FaList, FaTools, FaPlus, FaInfoCircle, FaRobot, FaImage, FaBook, FaDatabase, FaRocket, FaCode, FaLink, FaCheckSquare, FaSync } from "react-icons/fa";
import { toast } from "sonner";
import clsx from 'clsx'; // For conditional classes
import { motion } from "framer-motion";

// Tooltip component remains the same
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


interface FileEntry {
  path: string;
  content: string;
  extension: string;
}

interface AICodeAssistantProps {
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>; // Receive ref
}

const AICodeAssistant = forwardRef<any, AICodeAssistantProps>(({ aiResponseInputRef }, ref) => {
  const { user } = useAppContext();
  const {
      setAiResponseHasContent,
      setFilesParsed,
      setSelectedAssistantFiles,
      scrollToSection,
  } = useRepoXmlPageContext(); // Use context

  const [response, setResponse] = useState<string>("");
  const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]); // Renamed from 'files' to avoid confusion
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [selectedParsedFiles, setSelectedParsedFilesState] = useState<Set<string>>(new Set()); // Renamed from 'selectedFiles'
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest"); // Keep local or move to context if needed globally
  const [prTitle, setPrTitle] = useState<string>("");
  const [prDescription, setPrDescription] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showSavedFileMenu, setShowSavedFileMenu] = useState(false);
  const [showPRDetails, setShowPRDetails] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);

   // Predefined links remain the same
    const predefinedLinks = [
        { name: "Grok", url: "https://grok.com", icon: <FaRobot className="text-yellow-300 font-bold drop-shadow-md" /> },
        { name: "QwenLM", url: "https://qwenlm.ai", icon: <FaImage className="text-blue-500" /> },
        { name: "NotebookLM", url: "https://notebooklm.google.com", icon: <FaBook className="text-yellow-500" /> },
        { name: "Supabase", url: "https://supabase.com", icon: <FaDatabase className="text-teal-500" /> },
        { name: "Vercel", url: "https://vercel.com", icon: <FaRocket className="text-black" /> },
        { name: "Coze.com", url: "https://coze.com", icon: <FaCode className="text-purple-500" /> },
    ];

  // Update context when AI response input changes
  useEffect(() => {
    setAiResponseHasContent(response.trim().length > 0);
    // Reset parsed/selected status if user edits after parsing/selecting
    if (response.trim().length > 0) {
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
    }
  }, [response, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles]);

  // Load saved files and links
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
            const { data: userData, error } = await supabaseAdmin
            .from("users")
            .select("metadata")
            .eq("user_id", user.id)
            .single();

            if (error) {
                console.warn("Supabase fetch error (non-critical):", error.message);
                // Handle case where user row might not exist yet or other errors
                return;
            }

            if (userData?.metadata?.generated_files) {
                setSavedFiles(
                    userData.metadata.generated_files.map((f: any) => ({
                    path: f.path,
                    content: f.code ?? f.content, // Handle potential naming difference
                    extension: f.extension ?? f.path.split('.').pop() ?? 'txt',
                    }))
                );
            } else {
                setSavedFiles([]);
            }
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
  }, [user]);

  // Parse files logic remains similar, update context on success/failure
  const parseFilesFromText = (text: string): FileEntry[] => {
        const entries: FileEntry[] = [];
        // Regex to find code blocks, potentially with language specifier and preceding/succeeding file path comments
        // Allowing flexible comment styles: //, /* */, --, #
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$)|(?:^\s*))\n*^```(\w+)?\n([\s\S]*?)\n^```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$))?/gm;

        let match;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Prefer file path from comment AFTER the block, then BEFORE
            let path = (match[4] || match[1] || `unnamed-${entries.length + 1}`).trim();
            const language = match[2] || ''; // Language specifier like 'typescript'
            let content = match[3].trim();
            let extension = path.split('.').pop() || 'txt';

             // If path wasn't in comments, try finding it as the first line inside the block (common pattern)
            if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0].trim();
                 // Basic check for a file-like path in the first line
                const pathCommentMatch = potentialPathLine.match(/^(?:\/\/|\/\*|--|#)\s*([\w\-\/\.]+?\.\w+)/);
                 if (pathCommentMatch) {
                    path = pathCommentMatch[1].trim();
                    content = lines.slice(1).join('\n').trim();
                    extension = path.split('.').pop() || 'txt';
                 } else if (potentialPathLine.match(/^[\w\-\/\.]+?\.\w+$/) && lines.length > 1) {
                     // Or if first line looks exactly like a path and there's more content
                      path = potentialPathLine;
                      content = lines.slice(1).join('\n').trim();
                      extension = path.split('.').pop() || 'txt';
                 }
            }

            // Clean up path (remove leading slashes if any)
            path = path.replace(/^[\/\\]+/, '');

            entries.push({ path, content, extension });
        }

         // Fallback: If no ``` blocks found, treat the whole response as one file? (Less ideal)
        if (entries.length === 0 && text.trim().length > 0 && !text.includes('```')) {
             console.warn("No fenced code blocks found. Treating entire response as one file.");
             // Try to guess path/extension from description or title if available? Risky.
             // entries.push({ path: 'response.txt', content: text, extension: 'txt' });
        }

        return entries;
    };

  const extractPRDetails = (rawText: string) => {
    let title = "AI Assistant Update"; // Shorter default
    let description = "Automated changes based on AI response.";
    let commitMsg = "feat: Apply AI generated changes"; // Conventional commit style default

    const lines = rawText.split('\n');
    let descriptionLines: string[] = [];
    let commitLines: string[] = [];
    let readingDescription = false;
    let readingCommit = false;

    // First pass for specific markers
    lines.forEach(line => {
        const lowerLine = line.toLowerCase().trim();
        if (lowerLine.startsWith("title:")) {
            title = line.substring(line.indexOf(':') + 1).trim().substring(0, 100);
            readingDescription = false; readingCommit = false;
        } else if (lowerLine.startsWith("description:")) {
            description = line.substring(line.indexOf(':') + 1).trim();
            readingDescription = true; readingCommit = false;
            if (description) descriptionLines.push(description); // Add first line if not empty
        } else if (lowerLine.startsWith("commit message:")) {
             commitMsg = line.substring(line.indexOf(':') + 1).trim();
             readingDescription = false; readingCommit = true;
             if (commitMsg) commitLines.push(commitMsg);
        } else if (readingDescription) {
            descriptionLines.push(line); // Continue reading description lines
        } else if (readingCommit) {
             commitLines.push(line); // Continue reading commit lines
        }
    });

    description = descriptionLines.join('\n').trim();
    commitMsg = commitLines.join('\n').trim();


    // Fallbacks if markers weren't found or content was empty
    const textOnlyLines = rawText.split('\n').filter(line => !line.trim().startsWith('```') && !line.match(/^\s*(?:\/\/|\/\*|--|#)\s*File:/) && !line.trim().startsWith("title:") && !line.trim().startsWith("description:") && !line.trim().startsWith("commit message:")).map(l => l.trim()).filter(Boolean);

    if (!title || title === "AI Assistant Update") {
        title = textOnlyLines[0]?.substring(0, 70) || "AI Assistant Update";
    }
    if (!description || description === "Automated changes based on AI response.") {
        description = textOnlyLines.slice(0, 5).join('\n').trim() || "Automated changes based on AI response."; // Use first few lines as desc
    }
     if (!commitMsg || commitMsg === "feat: Apply AI generated changes") {
         const commitSubject = textOnlyLines[0]?.substring(0, 50) || "Apply AI changes";
         const commitBody = textOnlyLines.slice(1, 6).join('\n').trim();
        commitMsg = commitSubject + (commitBody ? `\n\n${commitBody}` : "");
    }

    return { title, description, commitMessage: commitMsg };
  };

  const handleParse = () => {
    setParsedFiles([]); // Clear previous
    setSelectedParsedFilesState(new Set()); // Clear selection
    setFilesParsed(false); // Update context
    setSelectedAssistantFiles(new Set()); // Update context

    const files = parseFilesFromText(response);
    setParsedFiles(files);

    if (files.length > 0) {
        const { title, description, commitMessage: extractedCommitMsg } = extractPRDetails(response);
        setPrTitle(title);
        setPrDescription(description);
        setCommitMessage(extractedCommitMsg);
        setFilesParsed(true); // Update context: parsing succeeded
        toast.success(`${files.length} файлов разобрано! Проверьте и выберите нужные.`);
        // Auto-select all parsed files? Could be an option/setting.
         selectAllParsedFiles(); // Let's auto-select them by default
         setShowPRDetails(true); // Show PR details automatically after parsing
    } else {
        toast.info("В ответе не найдено файлов для разбора.");
        setFilesParsed(false); // Update context: parsing failed (no files)
        // Clear PR details if no files found
        setPrTitle('');
        setPrDescription('');
        setCommitMessage('');
    }
  };

  // Handle saving files (logic remains mostly the same)
  const handleSaveFiles = async () => {
        if (!user || parsedFiles.length === 0) {
             toast.info(user ? "Нет файлов для сохранения." : "Войдите для сохранения файлов.");
             return;
        }
        setLoading(true);
        try {
            const fileData = parsedFiles.map((file) => ({ path: file.path, code: file.content, extension: file.extension }));
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();

             if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'not found' error, handle upsert
                throw fetchError;
             }

            // Merge carefully: Overwrite existing paths with new versions, keep others
             const existingFiles = existingData?.metadata?.generated_files || [];
             const newPaths = new Set(fileData.map(f => f.path));
             const mergedFiles = [
                ...existingFiles.filter((f: any) => !newPaths.has(f.path)), // Keep old files not in the new set
                ...fileData // Add/overwrite with the new files
             ];

            const { error: upsertError } = await supabaseAdmin.from("users").upsert({
                 user_id: user.id,
                 metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles }
             }, { onConflict: 'user_id' }); // Specify conflict resolution

             if (upsertError) throw upsertError;

            setSavedFiles(mergedFiles.map((f: any) => ({ path: f.path, content: f.code ?? f.content, extension: f.extension ?? f.path.split('.').pop() ?? 'txt' })));
            toast.success("Файлы успешно сохранены/обновлены!");
        } catch (err) {
            toast.error("Ошибка при сохранении файлов: " + (err as Error).message);
            console.error("Save files error:", err);
        } finally {
            setLoading(false);
        }
  };


  // Download ZIP remains the same
   const handleDownload = async () => {
        if (parsedFiles.length === 0) return toast.info("Нет разобранных файлов для скачивания.");
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        parsedFiles.forEach((file) => zip.file(file.path, file.content));
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, "ai_generated_files.zip");
        toast.success("Архив с файлами скачан.")
    };

  // Download single file to Telegram remains the same
   const downloadFile = async (file: FileEntry) => {
        if (!user?.id) return toast.error("Не удалось определить ID пользователя Telegram");
        setLoading(true);
        try {
        const result = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file"); // Ensure user.id is string
        if (result.success) toast.success(`Файл "${file.path}" отправлен в ваш чат Telegram!`);
        else throw new Error(result.error);
        } catch (err) {
        toast.error(`Ошибка при отправке "${file.path}" в Telegram: ` + (err as Error).message);
        } finally {
        setLoading(false);
        }
    };

  // Clear saved files remains the same
   const handleClearAllSavedFiles = async () => {
        if (!user) return toast.error("Войдите, чтобы очистить файлы.");
        if (savedFiles.length === 0) return toast.info("Нет сохраненных файлов для очистки.");

        const confirmed = window.confirm(`Вы уверены, что хотите удалить все ${savedFiles.length} сохраненных файлов? Это действие необратимо.`);
        if (!confirmed) return;

        setLoading(true);
        try {
        const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
        // Ensure metadata exists before trying to delete from it
        if (existingData?.metadata) {
             await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...existingData.metadata, generated_files: [] } });
             setSavedFiles([]);
             toast.success("Все сохраненные файлы очищены!");
        } else {
            toast.info("Нет данных для очистки.");
        }
        } catch (err) {
        toast.error("Ошибка при очистке файлов: " + (err as Error).message);
        } finally {
        setLoading(false);
        setShowSavedFileMenu(false); // Close menu
        }
    };

  // Update context when parsed file selection changes
  const toggleParsedFileSelection = (path: string) => {
    const newSelected = new Set(selectedParsedFiles);
    if (newSelected.has(path)) newSelected.delete(path);
    else newSelected.add(path);
    setSelectedParsedFilesState(newSelected); // Update local UI state
    setSelectedAssistantFiles(newSelected); // Update context state
  };

  // Select all parsed files (callable via ref/context)
  const selectAllParsedFiles = () => {
      const allParsedPaths = new Set(parsedFiles.map(file => file.path));
      setSelectedParsedFilesState(allParsedPaths);
      setSelectedAssistantFiles(allParsedPaths);
      if (allParsedPaths.size > 0) {
         toast.info(`${allParsedPaths.size} файлов выбрано для PR.`);
      }
  };


  // Create PR logic remains similar, ensure using selectedParsedFiles
  const handleCreatePR = async () => {
        if (!repoUrl || !selectedParsedFiles.size || !prTitle || !commitMessage) {
        let missing = [];
        if (!repoUrl) missing.push("URL репозитория");
        if (!selectedParsedFiles.size) missing.push("выбранные файлы");
        if (!prTitle) missing.push("заголовок PR");
        if (!commitMessage) missing.push("сообщение коммита");
        toast.error(`Пожалуйста, укажите: ${missing.join(', ')}`);
        setShowPRDetails(true); // Show details if something is missing
        return;
        }
        setLoading(true);
        try {
            // Map selected paths back to full FileEntry objects (parsed or saved)
            const filesToCommit = Array.from(selectedParsedFiles)
                .map((path) => {
                    const parsedFile = parsedFiles.find((f) => f.path === path);
                    const savedFile = savedFiles.find((f) => f.path === path);
                    // Prioritize newly parsed file content if both exist
                    const file = parsedFile || savedFile;
                    return file ? { path: file.path, content: file.content } : null;
                })
                .filter(Boolean) as { path: string; content: string }[];

            if (filesToCommit.length === 0) {
                toast.error("Нет валидных файлов для коммита.");
                throw new Error("No valid files selected for commit.");
            }

            const username = user?.username || user?.id || "неизвестный";
            // Enhance description if it's short/default
            const finalDescription = (prDescription && prDescription.length > 30)
                 ? prDescription
                 : `${prDescription}\n\nАвтоматически создано: ${username}\nЗатронутые файлы:\n- ${filesToCommit.map(f => f.path).join('\n- ')}`;

            const result = await createGitHubPullRequest(
                repoUrl,
                filesToCommit,
                prTitle,
                finalDescription, // Use enriched description
                commitMessage // Pass commit message separately if action supports it, otherwise it might be part of title/desc logic internally
                );

            if (result.success && result.prUrl) {
                toast.success(`PR успешно создан: ${result.prUrl}`);
                await notifyAdmin(`Новый PR создан ${username}: ${result.prUrl}`);
                handleGetOpenPRs(); // Refresh PR list
                // Optional: Clear state after successful PR?
                // setResponse('');
                // setParsedFiles([]);
                // setSelectedParsedFilesState(new Set());
                // setPrTitle(''); setPrDescription(''); setCommitMessage('');
            } else {
                toast.error("Ошибка при создании PR: " + result.error);
            }
        } catch (err) {
            toast.error("Критическая ошибка при создании PR: " + (err as Error).message);
            console.error("Create PR error:", err);
        } finally {
        setLoading(false);
        }
    };


  // Get Open PRs remains the same
  const handleGetOpenPRs = async () => {
        if (!repoUrl) return toast.error("Пожалуйста, укажите URL репозитория");
        setLoadingPRs(true); // Use separate loading state for this
        try {
        const result = await getOpenPullRequests(repoUrl);
        if (result.success && result.pullRequests) {
             setOpenPRs(result.pullRequests);
             if (result.pullRequests.length === 0) {
                 toast.info("Нет открытых PR в этом репозитории.");
             }
        }
        else toast.error("Ошибка при получении PR: " + result.error);
        } catch (err) {
        toast.error("Ошибка при получении PR: " + (err as Error).message);
        } finally {
        setLoadingPRs(false);
        }
    };


  // Add Custom Link remains the same
   const handleAddCustomLink = async () => {
        const name = prompt("Введите название ссылки:");
        const url = prompt("Введите URL ссылки (включая https://):");
        if (name && url && url.startsWith('http')) {
            const newLink = { name, url };
            const updatedLinks = [...customLinks, newLink];
            setCustomLinks(updatedLinks);
            if (user) {
                try {
                     const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                     await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), customLinks: updatedLinks } });
                     toast.success(`Ссылка "${name}" добавлена.`);
                } catch(err) {
                     toast.error("Ошибка сохранения ссылки: " + (err as Error).message);
                     // Revert UI change on error
                     setCustomLinks(customLinks);
                }

            }
        } else if (name && url) {
             toast.warn("URL должен начинаться с http:// или https://");
        }
    };


  // Expose necessary methods via ref
  useImperativeHandle(ref, () => ({
    handleParse,
    selectAllParsedFiles,
    handleCreatePR,
  }));

  // --- RENDER ---
  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">
        <header className="flex items-center gap-2 mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
            AI Code Assistant
            </h1>
            <Tooltip text={`Вставьте ответ AI → Нажмите → → Выберите файлы → Настройте PR → Создать PR`}>
            <FaInfoCircle className="text-blue-400 cursor-help hover:text-blue-300 transition" />
            </Tooltip>
        </header>

        {/* AI Response Input */}
         <div className="mb-6">
            <p className="text-yellow-400 mb-2 text-sm">
                Вставьте сюда ответ от вашего AI (Grok, ChatGPT, Claude и т.д.), содержащий код и описание.
            </p>
            <div className="relative">
            <textarea
                id="response-input"
                ref={aiResponseInputRef} // Assign ref
                className="w-full p-3 pr-12 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[100px] resize-y"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Вставьте ответ вашего AI здесь..."
                disabled={loading}
            />
            <motion.button
                className="absolute right-2 bottom-2 p-2 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"
                onClick={handleParse}
                disabled={loading || !response}
                whileHover={{ scale: loading || !response ? 1 : 1.1 }}
                whileTap={{ scale: loading || !response ? 1 : 0.95 }}
                title="Разобрать файлы из ответа"
            >
                <FaArrowRight className="text-white" />
            </motion.button>
            </div>
        </div>


         {/* Parsed Files Section */}
        {parsedFiles.length > 0 && (
            <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-cyan-400">Разобранные файлы ({parsedFiles.length})</h2>
                <div className="relative">
                <button className="p-1 text-gray-400 hover:text-white" onClick={() => setShowFileMenu(!showFileMenu)} title="Опции для разобранных файлов">
                    <FaEllipsisV />
                </button>
                {showFileMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded shadow-lg z-20 border border-gray-600">
                    <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition" onClick={() => { handleSaveFiles(); setShowFileMenu(false); }}>
                        Сохранить/Обновить файлы
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition" onClick={() => { handleDownload(); setShowFileMenu(false); }}>
                        Скачать ZIP
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition" onClick={() => { selectAllParsedFiles(); setShowFileMenu(false); }}>
                        <FaCheckSquare className="inline mr-1" /> Выбрать все для PR
                    </button>
                     <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition" onClick={() => { setSelectedParsedFilesState(new Set()); setSelectedAssistantFiles(new Set()); setShowFileMenu(false); }}>
                        Снять выделение
                    </button>
                    </div>
                )}
                </div>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2"> {/* Scrollable list */}
                {parsedFiles.map((file) => (
                <div key={file.path} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-1 rounded" onClick={() => toggleParsedFileSelection(file.path)}>
                    <input
                        type="checkbox"
                        checked={selectedParsedFiles.has(file.path)}
                        onChange={(e) => { e.stopPropagation(); toggleParsedFileSelection(file.path); }}
                        className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0"
                    />
                    <span className={`truncate text-sm ${selectedParsedFiles.has(file.path) ? 'text-white' : 'text-gray-400'}`} title={file.path}>
                        {file.path}
                    </span>
                    <Tooltip text={`Отправить ${file.path.split('/').pop()} в Telegram`}>
                        <button
                            onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                            disabled={loading || !user}
                            className="ml-auto text-purple-500 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition p-0.5"
                            >
                            <FaTelegramPlane />
                        </button>
                    </Tooltip>
                </div>
                ))}
            </div>
            </div>
        )}


        {/* Saved Files Section (Optional display, logic separate) */}
        {savedFiles.length > 0 && (
            <details className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
                <summary className="flex justify-between items-center cursor-pointer">
                    <h2 className="text-lg font-semibold text-cyan-400">Сохраненные файлы ({savedFiles.length})</h2>
                     <div className="relative">
                        <button
                            className="p-1 text-gray-400 hover:text-white"
                            onClick={(e) => { e.preventDefault(); setShowSavedFileMenu(!showSavedFileMenu); }} // Prevent summary toggle
                            title="Опции сохраненных файлов"
                         >
                            <FaEllipsisV />
                        </button>
                        {showSavedFileMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded shadow-lg z-20 border border-gray-600">
                                <button className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-sm text-red-400 transition" onClick={handleClearAllSavedFiles}>
                                    Очистить все сохраненные файлы
                                </button>
                                {/* Add more actions if needed, e.g., select all saved for PR */}
                            </div>
                        )}
                    </div>
                </summary>
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-2">
                    {savedFiles.map((file) => (
                    <div key={file.path} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-1 rounded" onClick={() => toggleParsedFileSelection(file.path)} title={`Выбрать/отменить ${file.path} для PR`}>
                        <input
                            type="checkbox"
                            checked={selectedParsedFiles.has(file.path)}
                            onChange={(e) => { e.stopPropagation(); toggleParsedFileSelection(file.path); }}
                            className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0"
                            // Disabled if this file was *also* just parsed? Maybe not needed.
                        />
                        <span className={`truncate text-sm ${selectedParsedFiles.has(file.path) ? 'text-white' : 'text-gray-400'}`} title={file.path}>
                             {file.path}
                        </span>
                         <Tooltip text={`Отправить ${file.path.split('/').pop()} в Telegram`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                                disabled={loading || !user}
                                className="ml-auto text-purple-500 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition p-0.5"
                                >
                                <FaTelegramPlane />
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
                <h2 className="text-lg font-semibold text-cyan-400">Pull Request ({selectedParsedFiles.size} файлов)</h2>
                <div className="flex gap-2 items-center">
                    <motion.button
                        className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-green-500 to-emerald-500 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        onClick={handleCreatePR}
                        disabled={loading || selectedParsedFiles.size === 0 || !commitMessage || !prTitle || !repoUrl}
                        whileHover={{ scale: (loading || selectedParsedFiles.size === 0) ? 1 : 1.05 }}
                        whileTap={{ scale: (loading || selectedParsedFiles.size === 0) ? 1 : 0.95 }}
                    >
                         {loading ? <FaSync className="animate-spin inline mr-1" /> : null}
                        Создать PR
                    </motion.button>
                    <Tooltip text="Показать/скрыть детали PR">
                        <button className="text-blue-400 hover:text-blue-300 transition text-sm p-1" onClick={() => setShowPRDetails(!showPRDetails)}>
                            {showPRDetails ? "Скрыть" : "Детали"}
                        </button>
                    </Tooltip>
                     <Tooltip text="Обновить список открытых PR">
                         <button className="p-2 text-gray-400 hover:text-white transition disabled:opacity-50" onClick={handleGetOpenPRs} disabled={loadingPRs || !repoUrl}>
                             {loadingPRs ? <FaSync className="animate-spin"/> : <FaList />}
                        </button>
                     </Tooltip>
                </div>
            </div>

            {showPRDetails && (
                <motion.div
                     initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 space-y-3 overflow-hidden" // Added overflow-hidden
                 >
                    <p className="text-gray-400 text-xs">Эти поля автоматически заполнены из ответа бота. Проверьте и измените при необходимости.</p>
                    <div>
                         <label className="block text-sm font-medium mb-1">URL репозитория</label>
                        <input
                            className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.2)] text-sm"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="https://github.com/username/repository"
                             disabled={loading}
                        />
                    </div>
                     <div>
                         <label className="block text-sm font-medium mb-1">Заголовок PR</label>
                        <input
                            className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.2)] text-sm"
                            value={prTitle}
                            onChange={(e) => setPrTitle(e.target.value)}
                            placeholder="Краткий заголовок для Pull Request"
                             disabled={loading}
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">Описание PR</label>
                        <textarea
                            className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.2)] text-sm min-h-[60px] resize-y"
                            value={prDescription}
                            onChange={(e) => setPrDescription(e.target.value)}
                            placeholder="Подробное описание изменений (поддерживает Markdown)"
                            disabled={loading}
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">Сообщение коммита</label>
                        <textarea
                            className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.2)] text-sm min-h-[80px] resize-y"
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Сообщение для коммита"
                             disabled={loading}
                        />
                     </div>
                </motion.div>
            )}
        </section>


         {/* Open PRs List */}
        {openPRs.length > 0 && (
            <section className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">Открытые Pull Requests ({openPRs.length})</h2>
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {openPRs.map((pr) => (
                <li key={pr.id || pr.number} className="flex items-center gap-2 bg-gray-900 p-2 rounded text-sm border border-gray-700">
                    <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate" title={pr.title}>
                     #{pr.number}: {pr.title}
                    </a>
                     <span className="text-xs text-gray-500 ml-auto flex-shrink-0">by {pr.user?.login}</span>
                </li>
                ))}
            </ul>
            </section>
        )}


         {/* Tools Menu */}
        <div className="mb-6">
            <div className="relative inline-block"> {/* Changed from block to inline-block */}
            <button
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)]",
                    showToolsMenu && "bg-gray-700" // Highlight when open
                )}
                onClick={() => setShowToolsMenu(!showToolsMenu)}
            >
                <FaTools className="text-gray-400" />
                <span className="text-sm">Инструменты</span>
            </button>
            {showToolsMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-56 bg-gray-700 rounded-lg shadow-lg z-20 border border-gray-600 overflow-hidden"> {/* Position above */}
                 {predefinedLinks.map((link) => (
                    <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-600 text-sm transition"
                    >
                    {link.icon}
                    <span className="text-white">{link.name}</span>
                    </a>
                ))}
                {customLinks.map((link) => (
                    <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-600 text-sm transition"
                    >
                    <FaLink className="text-gray-400" />
                     <span className="text-white">{link.name}</span>
                    </a>
                ))}
                <button className="flex items-center gap-2.5 w-full text-left px-4 py-2 hover:bg-gray-600 text-sm text-cyan-400 transition" onClick={handleAddCustomLink}>
                    <FaPlus /> Добавить свою ссылку
                </button>
                </div>
            )}
            </div>
        </div>
    </div>
  );
});

AICodeAssistant.displayName = 'AICodeAssistant'; // Add display name

export default AICodeAssistant;