"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
import { createGitHubPullRequest, getOpenPullRequests } from "@/app/actions_github/actions"; // Assuming types are correctly handled or defined locally if needed
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";
import { useCodeParsingAndValidation, ValidationIssue } from "@/hooks/useCodeParsingAndValidation"; // Import the custom hook

// Import Child Components
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { SwapModal } from './assistant_components/SwapModal';

import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { FaInfoCircle } from "react-icons/fa"; // Keep specific fa imports needed here

// Tooltip Component
const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded shadow-lg w-max max-w-xs bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-pre-line"> {/* Increased z-index */}
          {text}
        </div>
      )}
    </div>
  );
};
Tooltip.displayName = 'Tooltip';

// Re-define FileEntry if not imported from shared types
interface FileEntry {
  id: string;
  path: string;
  content: string;
  extension: string;
}

interface AICodeAssistantProps {
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

const AICodeAssistant = forwardRef<any, AICodeAssistantProps>(({ aiResponseInputRef }, ref) => {
  // --- Hooks ---
  const { user } = useAppContext();
  const repoContext = useRepoXmlPageContext();
  const {
    parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
    parseAndValidateResponse, autoFixIssues, setParsedFiles, setValidationStatus, setValidationIssues
  } = useCodeParsingAndValidation(); // Use the custom hook

  // --- Context Access ---
  const setAssistantLoading = repoContext?.setAssistantLoading ?? (() => {});
  const setFilesParsed = repoContext?.setFilesParsed ?? (() => {});
  const setSelectedAssistantFiles = repoContext?.setSelectedAssistantFiles ?? (() => {});
  const setAiResponseHasContent = repoContext?.setAiResponseHasContent ?? (() => {});

  // --- State ---
  const [response, setResponse] = useState<string>(""); // The raw AI response text
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set()); // IDs of selected parsed files
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest"); // Repo URL for PR
  const [prTitle, setPrTitle] = useState<string>(""); // Title for PR (extracted/edited)
  // Note: Commit message and PR description are now generated dynamically in handleCreatePR
  const [openPRs, setOpenPRs] = useState<any[]>([]); // List of open PRs fetched from GitHub
  const [loadingPRs, setLoadingPRs] = useState(false); // Loading state for fetching PR list
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]); // User's custom links
  const [showSwapModal, setShowSwapModal] = useState(false); // Swap modal visibility
  // We might need a separate loading state for the PR creation action itself
  const [isCreatingPr, setIsCreatingPr] = useState(false);

  const extractPRDetails = (rawText: string): { title: string; description: string; commitMessage: string } => {
    let title = "AI Assistant Update";
    let description = "Automated changes based on AI response.";
    let commitMsg = "feat: Apply AI generated changes";
    const lines = rawText.split('\n');
    let descriptionLines: string[] = [];
    let commitLines: string[] = [];
    let readingDescription = false;
    let readingCommit = false;

    lines.forEach(line => {
        const lowerLine = line.toLowerCase().trim();
        if (lowerLine.startsWith("title:")) {
            title = line.substring(line.indexOf(':') + 1).trim().substring(0, 100);
            readingDescription = false; readingCommit = false;
        } else if (lowerLine.startsWith("description:")) {
            const descStart = line.substring(line.indexOf(':') + 1).trim();
            description = descStart;
            readingDescription = true; readingCommit = false;
            if (description) descriptionLines.push(description);
        } else if (lowerLine.startsWith("commit message:")) {
            const commitStart = line.substring(line.indexOf(':') + 1).trim();
            commitMsg = commitStart;
             readingDescription = false; readingCommit = true;
             if (commitMsg) commitLines.push(commitMsg);
        } else if (readingDescription) {
            descriptionLines.push(line);
        } else if (readingCommit) {
             commitLines.push(line);
        }
    });
    description = descriptionLines.join('\n').trim();
    commitMsg = commitLines.join('\n').trim();

    const textOnlyLines = lines.filter(line =>
        !line.trim().startsWith('```') &&
        !line.match(/^\s*(?:\/\/|\/\*|--|#)\s*File:/) &&
        !line.toLowerCase().trim().startsWith("title:") &&
        !line.toLowerCase().trim().startsWith("description:") &&
        !line.toLowerCase().trim().startsWith("commit message:")
    ).map(l => l.trim()).filter(Boolean);

    if (!title || title === "AI Assistant Update") {
        title = textOnlyLines[0]?.substring(0, 70) || "AI Assistant Update";
    }
    if (!description || description === "Automated changes based on AI response.") {
        description = textOnlyLines.slice(0, 5).join('\n').trim() || "Automated changes based on AI response.";
    }
     if (!commitMsg || commitMsg === "feat: Apply AI generated changes") {
         const commitSubject = textOnlyLines[0]?.substring(0, 50) || "Apply AI changes";
         const commitBody = textOnlyLines.slice(1, 6).join('\n').trim();
        commitMsg = commitSubject + (commitBody ? `\n\n${commitBody}` : "");
    }
    return { title, description, commitMessage: commitMsg };
  };

  // --- Effects ---
  // Update context when response text changes
  useEffect(() => {
    const hasContent = response.trim().length > 0;
    setAiResponseHasContent(hasContent);
    if (!hasContent) {
        // Clear downstream states if response is cleared
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        setValidationStatus('idle');
        setValidationIssues([]);
        // Keep parsedFiles/rawDescription from hook? Or clear them too?
        // Let's clear them via the hook state setters if response is empty
    }
  }, [response, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

  // Load custom links (simplified from original)
  useEffect(() => {
    const loadLinks = async () => {
        if (user) {
            try {
                const { data: userData, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                if (!error && userData?.metadata?.customLinks) {
                    setCustomLinks(userData.metadata.customLinks);
                }
            } catch (e) { console.error("Error loading links:", e); }
        } else {
            setCustomLinks([]);
        }
    };
    loadLinks();
  }, [user]);

  // --- Handlers ---

  // Trigger parsing and validation using the hook
  const handleParse = useCallback(async () => {
    setAssistantLoading(true); // Set loading in context
    const { files: newlyParsedFiles, issues } = await parseAndValidateResponse(response);
    setAssistantLoading(false); // Unset loading in context

    // Update parent component states based on parsing results
    setFilesParsed(newlyParsedFiles.length > 0);
    setSelectedFileIds(new Set(newlyParsedFiles.map(f => f.id))); // Auto-select all initially
    setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path))); // Update context with paths

    // Extract title hint after parsing
     if (newlyParsedFiles.length > 0) {
        const { title } = extractPRDetails(rawDescription || response);
        setPrTitle(title);
    } else {
        setPrTitle('');
    }

  }, [response, parseAndValidateResponse, setAssistantLoading, setFilesParsed, setSelectedAssistantFiles, rawDescription]);

   // Trigger auto-fixing using the hook
   const handleAutoFix = useCallback(() => {
        autoFixIssues(parsedFiles, validationIssues);
        // The hook updates parsedFiles, validationIssues, and validationStatus internally
   }, [autoFixIssues, parsedFiles, validationIssues]);

   // Generate and copy prompt for AI to fix skipped content
   const handleCopyFixPrompt = useCallback(() => {
        const skippedFiles = validationIssues
            .filter(issue => issue.type === 'skippedContent')
            .map(issue => `- ${issue.filePath}`)
            .filter((value, index, self) => self.indexOf(value) === index) // Unique file paths
            .join('\n');

        if (!skippedFiles) return toast.info("Не обнаружено проблем с пропуском контента.");

        const prompt = `Пожалуйста, предоставь ПОЛНУЮ версию следующих файлов, так как в предыдущем ответе был пропущен код (обнаружены маркеры '...'):\n${skippedFiles}\n\nУбедись, что каждый файл представлен в виде отдельного блока кода с указанием пути перед ним, например:\n// path/to/your/file.tsx\n\`\`\`tsx\n// full code here\n\`\`\``;

        navigator.clipboard.writeText(prompt)
            .then(() => toast.success("Инструкция для AI скопирована!"))
            .catch(err => toast.error("Не удалось скопировать инструкцию."));
   }, [validationIssues]);

  // Handlers for TextAreaUtilities
  const handleClearResponse = useCallback(() => {
      setResponse("");
      // Effect hook will clear other states
      toast.info("Поле ответа очищено.");
  }, []);

  const handleCopyResponse = useCallback(() => {
      if (!response) return toast.info("Нечего копировать.");
      navigator.clipboard.writeText(response)
          .then(() => toast.success("Текст ответа скопирован!"))
          .catch(err => toast.error("Не удалось скопировать текст."));
  }, [response]);

  // Handler for SwapModal
  const handleSwap = useCallback((find: string, replace: string) => {
      if (!find) return;
      try {
          const newResponse = response.replaceAll(find, replace);
          if (newResponse === response) {
              toast.info(`Текст "${find}" не найден.`);
          } else {
              setResponse(newResponse); // Update response text
              setParsedFiles([]); // Clear parsed files as content changed
              setFilesParsed(false);
              setSelectedFileIds(new Set());
              setSelectedAssistantFiles(new Set());
              setValidationStatus('idle'); // Reset validation
              setValidationIssues([]);
              toast.success(`Текст заменен. Нажмите '➡️' для повторного разбора.`);
              setShowSwapModal(false);
          }
      } catch (error) {
          console.error("Swap error:", error);
          toast.error("Ошибка при замене текста.");
      }
  }, [response, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

  // Handler for ParsedFilesList selection
  const handleToggleFileSelection = useCallback((fileId: string) => {
      setSelectedFileIds(prev => {
          const newSelected = new Set(prev);
          if (newSelected.has(fileId)) newSelected.delete(fileId);
          else newSelected.add(fileId);

          // Update context with selected PATHS for PR logic
          const selectedPaths = new Set(
              Array.from(newSelected).map(id => parsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[]
          );
          setSelectedAssistantFiles(selectedPaths);
          return newSelected;
      });
  }, [parsedFiles, setSelectedAssistantFiles]);

   const handleSelectAllFiles = useCallback(() => {
        const allIds = new Set(parsedFiles.map(f => f.id));
        const allPaths = new Set(parsedFiles.map(f => f.path));
        setSelectedFileIds(allIds);
        setSelectedAssistantFiles(allPaths);
        if (allIds.size > 0) toast.info(`${allIds.size} файлов выбрано для PR.`);
    }, [parsedFiles, setSelectedAssistantFiles]);

    const handleDeselectAllFiles = useCallback(() => {
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
    }, [setSelectedAssistantFiles]);


  // Handlers for saving/downloading (passed to ParsedFilesList)
    const handleSaveFiles = useCallback(async () => {
         if (!user) return toast.error("Войдите, чтобы сохранять файлы.");
         const filesToSave = parsedFiles.filter(f => selectedFileIds.has(f.id));
         if (filesToSave.length === 0) return toast.info("Нет выбранных файлов для сохранения.");
         setIsCreatingPr(true); // Use general loading state?
         try {
             const fileData = filesToSave.map(f => ({ path: f.path, code: f.content, extension: f.extension }));
             // ... (Supabase upsert logic - simplified) ...
             const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
             if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
             const existingFiles = existingData?.metadata?.generated_files || [];
             const newPaths = new Set(fileData.map(f => f.path));
             const mergedFiles = [...existingFiles.filter((f: any) => !newPaths.has(f.path)), ...fileData];
             const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles } }, { onConflict: 'user_id' });
             if (upsertError) throw upsertError;
             toast.success(`${filesToSave.length} файлов сохранено!`);
         } catch (err) { toast.error("Ошибка сохранения файлов: " + (err as Error).message); }
         finally { setIsCreatingPr(false); }
    }, [user, parsedFiles, selectedFileIds]);

    const handleDownloadZip = useCallback(async () => {
         const filesToZip = parsedFiles.filter(f => selectedFileIds.has(f.id));
         if (filesToZip.length === 0) return toast.info("Нет выбранных файлов для скачивания.");
         try {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            filesToZip.forEach((file) => zip.file(file.path, file.content));
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, "ai_generated_files.zip");
            toast.success("Архив скачан.")
         } catch (error) { toast.error("Ошибка создания ZIP."); }
    }, [parsedFiles, selectedFileIds]);

    const handleSendToTelegram = useCallback(async (file: FileEntry) => {
        if (!user?.id) return toast.error("Нет ID пользователя Telegram");
        setIsCreatingPr(true);
        try {
            const result = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file");
            if (!result.success) throw new Error(result.error ?? "Ошибка Telegram API");
            toast.success(`Файл "${file.path}" отправлен в Telegram!`);
        } catch (err) { toast.error(`Ошибка отправки: ` + (err as Error).message); }
        finally { setIsCreatingPr(false); }
    }, [user]);


  // Handlers for PR Form / List
  const handleGetOpenPRs = useCallback(async () => {
        if (!repoUrl) return toast.error("Укажите URL репозитория");
        setLoadingPRs(true);
        try {
            const result = await getOpenPullRequests(repoUrl);
            if (result.success && result.pullRequests) {
                 setOpenPRs(result.pullRequests);
                 toast.success(`Загружено ${result.pullRequests.length} открытых PR.`);
            } else toast.error("Ошибка загрузки PR: " + result.error);
        } catch (err) { toast.error("Критическая ошибка загрузки PR."); }
        finally { setLoadingPRs(false); }
    }, [repoUrl]);

   const handleCreatePR = useCallback(async () => {
        const selectedFiles = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFiles.length === 0 || !prTitle) {
            return toast.error("Укажите URL, Заголовок PR и выберите хотя бы один файл.");
        }
        if (!repoContext) return;

        // 1. Generate PR Description
        let finalDescription = rawDescription.substring(0, 3000); // Limit description length reasonably
        if (rawDescription.length > 3000) finalDescription += "\n\n... (описание от AI усечено)";
        finalDescription += `\n\n**Файлы в этом PR (${selectedFiles.length}):**\n`;
        finalDescription += selectedFiles.map(f => `- \`${f.path}\``).join('\n');

        const unselectedUnnamed = parsedFiles.filter(f => f.path.startsWith('unnamed-') && !selectedFileIds.has(f.id));
        if (unselectedUnnamed.length > 0) {
            finalDescription += `\n\n**Примечание:** ${unselectedUnnamed.length} блоков кода без имени файла не были включены.`;
        }
         // Add validation issue summary if any remain
         const remainingIssues = validationIssues; // Get current issues
         if (remainingIssues.length > 0) {
            finalDescription += "\n\n**Обнаруженные Проблемы:**\n";
            remainingIssues.forEach(issue => {
                finalDescription += `- **${issue.filePath}**: ${issue.message}\n`;
            });
         }


        // 2. Generate Commit Message
        const commitSubject = prTitle.substring(0, 50);
        let commitBody = `Apply AI changes to ${selectedFiles.length} files.\n\nBased on:\n${rawDescription.split('\n')[0].substring(0, 100)}...`; // First line of raw desc
        const finalCommitMessage = `${commitSubject}\n\n${commitBody}`;

        // --- Action Call ---
        setAssistantLoading(true);
        setIsCreatingPr(true);
        try {
            const filesToCommit = selectedFiles.map(f => ({ path: f.path, content: f.content }));
            const result = await createGitHubPullRequest( repoUrl, filesToCommit, prTitle, finalDescription, finalCommitMessage );
            if (result.success && result.prUrl) {
                toast.success(`PR успешно создан: ${result.prUrl}`);
                await notifyAdmin(`Новый PR "${prTitle}" создан ${user?.username || user?.id}: ${result.prUrl}`);
                handleGetOpenPRs(); // Refresh PR list
            } else {
                toast.error("Ошибка создания PR: " + result.error);
                console.error("PR Creation Failed:", result.error);
            }
        } catch (err) {
            toast.error("Критическая ошибка создания PR.");
            console.error("Create PR error:", err);
        } finally {
            setAssistantLoading(false);
            setIsCreatingPr(false);
        }
    }, [repoContext, parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, user, setAssistantLoading, handleGetOpenPRs]);


   // Handler for Tools Menu
   const handleAddCustomLink = useCallback(async () => {
        // (Keep logic from previous version)
         const name = prompt("Название:");
         const url = prompt("URL (https://...):");
         if (!name || !url || !url.startsWith('http')) return toast.warn("Неверные данные.");
         const newLink = { name, url };
         const updatedLinks = [...customLinks, newLink];
         setCustomLinks(updatedLinks);
         if(user) { /* ... upsert to supabase ... */ }
   }, [customLinks, user]);

   // --- Expose necessary methods via ref ---
    useImperativeHandle(ref, () => ({
        // Methods needed by context/parent
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles, // Rename for clarity maybe?
        handleCreatePR,
        // Add other methods if required externally
    }));


  // --- RENDER ---
  return (
    <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4"> {/* Use flex column */}
        {/* Header */}
        <header className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                AI Code Assistant
            </h1>
             <Tooltip text={`Вставьте ответ AI → '➡️' → Проверьте/Исправьте → Выберите файлы → Создать PR`} position="bottom">
                <FaInfoCircle className="text-blue-400 cursor-help hover:text-blue-300 transition" />
            </Tooltip>
        </header>

        {/* AI Response Input Section */}
         <div>
            <label htmlFor="response-input" className="block text-sm font-medium mb-1">2. Ввод ответа AI</label>
             <p className="text-yellow-400 mb-2 text-xs md:text-sm">
                2️⃣ Вставьте сюда ПОЛНЫЙ ОТВЕТ от вашего AI. Затем нажмите '➡️'.
            </p>
            <div className="relative group">
                <textarea
                    id="response-input"
                    ref={aiResponseInputRef}
                    className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Вставьте ПОЛНЫЙ ОТВЕТ от AI здесь..."
                    disabled={isParsing || isCreatingPr} // Disable during parsing or PR creation
                />
                 {/* Utilities Rendered by Component */}
                 <TextAreaUtilities
                    response={response}
                    isLoading={isParsing || isCreatingPr}
                    onParse={handleParse}
                    onSwap={() => setShowSwapModal(true)}
                    onCopy={handleCopyResponse}
                    onClear={handleClearResponse}
                 />
            </div>
              {/* Validation Status Rendered by Component */}
             <ValidationStatusIndicator
                 status={validationStatus}
                 issues={validationIssues}
                 onAutoFix={handleAutoFix}
                 onCopyPrompt={handleCopyFixPrompt}
             />
        </div>

         {/* Parsed Files List Rendered by Component */}
         <ParsedFilesList
             parsedFiles={parsedFiles}
             selectedFileIds={selectedFileIds}
             validationIssues={validationIssues}
             onToggleSelection={handleToggleFileSelection}
             onSelectAll={handleSelectAllFiles}
             onDeselectAll={handleDeselectAllFiles}
             onSaveFiles={handleSaveFiles}
             onDownloadZip={handleDownloadZip}
             onSendToTelegram={handleSendToTelegram}
             isUserLoggedIn={!!user}
             isLoading={isParsing || isCreatingPr} // Pass general loading
         />

         {/* Saved Files Section (Keep original structure for now) */}
         {/* {savedFiles.length > 0 && ( <details ... > ... </details> )} */}

         {/* PR Form Rendered by Component */}
         <PullRequestForm
            repoUrl={repoUrl}
            prTitle={prTitle}
            commitMessage={commitMessage} // Pass base commit message if needed for display? No, remove.
            selectedFileCount={parsedFiles.filter(f => selectedFileIds.has(f.id)).length}
            isLoading={isCreatingPr} // Pass specific loading state
            isLoadingPrList={loadingPRs}
            onRepoUrlChange={setRepoUrl}
            onPrTitleChange={setPrTitle}
            onCreatePR={handleCreatePR}
            onGetOpenPRs={handleGetOpenPRs}
         />

         {/* Open PR List Rendered by Component */}
         <OpenPrList openPRs={openPRs} />

         {/* Tools Menu Rendered by Component */}
         <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />

         {/* Swap Modal */}
         <AnimatePresence>
             {showSwapModal && (
                <SwapModal isOpen={showSwapModal} onClose={() => setShowSwapModal(false)} onSwap={handleSwap} />
             )}
         </AnimatePresence>
    </div>
  );
});

AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;