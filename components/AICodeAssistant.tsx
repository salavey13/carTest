"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
import clsx from 'clsx';
import { createGitHubPullRequest, getOpenPullRequests } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry } from "@/hooks/useCodeParsingAndValidation"; // Import the custom hook and types

// Import Child Components (ensure paths are correct)
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { SwapModal } from './assistant_components/SwapModal';

import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { FaInfoCircle } from "react-icons/fa"; // Keep specific fa imports needed here

// Re-define FileEntry if not imported from shared types (must match hook's version)
// Or better, export/import from a shared location (e.g., types/index.ts)
interface FileEntry extends ValidationFileEntry {}

// Tooltip Component Definition (Needed for child components if not imported there)
export const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const positionClasses = { /* ... position classes from previous example ... */
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-1',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-1',
  };
  return (
    <div className="relative inline-block group">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      <AnimatePresence>
          {isVisible && (
            <motion.div /* ... tooltip motion div ... */
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}
                className={clsx("absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded shadow-lg w-max max-w-xs whitespace-pre-line", positionClasses[position])}
            > {text} </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};
Tooltip.displayName = 'Tooltip';


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
  } = useCodeParsingAndValidation();

  // --- Context Access ---
  const {
      setAiResponseHasContent = () => {},
      setFilesParsed = () => {},
      setSelectedAssistantFiles = () => {},
      setAssistantLoading = () => {},
      assistantLoading = false // Get context loading state
  } = repoContext ?? {};

  // --- State ---
  const [response, setResponse] = useState<string>(""); // Raw AI response
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set()); // Use IDs for selection state
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>(""); // User-editable PR Title
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false); // Loading state for fetching PRs
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [isCreatingPr, setIsCreatingPr] = useState(false); // Specific loading for PR creation button

  // --- Helper to Extract Title --- (Simplified)
   const extractPRTitleHint = (text: string): string => {
        const lines = text.split('\n');
        const firstLine = lines[0]?.trim() || "AI Assistant Update";
        return firstLine.substring(0, 70); // Limit title hint length
   };

  // --- Effects ---
  // Update context based on response content
  useEffect(() => {
    const hasContent = response.trim().length > 0;
    setAiResponseHasContent(hasContent);
    if (!hasContent) {
        setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]);
    } else {
        // If content exists but isn't parsed/validated, reset status
        if (parsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing) {
             setValidationStatus('idle');
             setValidationIssues([]);
        }
    }
  }, [response, parsedFiles.length, isParsing, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

  // Load custom links on user change
  useEffect(() => {
    const loadLinks = async () => { /* ... */ };
    loadLinks();
  }, [user]);

  // --- Handlers ---

  // Parse & Validate Handler
  const handleParse = useCallback(async () => {
    setAssistantLoading(true);
    const { files: newlyParsedFiles } = await parseAndValidateResponse(response);
    setAssistantLoading(false);

    setFilesParsed(newlyParsedFiles.length > 0);
    const initialSelection = new Set(newlyParsedFiles.map(f => f.id));
    setSelectedFileIds(initialSelection); // Select all by ID initially
    setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path))); // Update context with paths

     if (newlyParsedFiles.length > 0) {
        setPrTitle(extractPRTitleHint(rawDescription || response)); // Set title hint
    } else { setPrTitle(''); }

  }, [response, parseAndValidateResponse, rawDescription, setAssistantLoading, setFilesParsed, setSelectedAssistantFiles]);

   // Auto-Fix Handler
   const handleAutoFix = useCallback(() => {
        const updatedFiles = autoFixIssues(parsedFiles, validationIssues);
        // Hook updates internal state and shows toasts. Re-validate or update status is done in hook.
        // Update the main response text if files changed content significantly? Optional, maybe too complex.
   }, [autoFixIssues, parsedFiles, validationIssues]);

   // Copy Fix Prompt Handler
   const handleCopyFixPrompt = useCallback(() => {
        const skippedFiles = validationIssues
            .filter(issue => issue.type === 'skippedContent')
            .map(issue => `- ${issue.filePath}`)
            .filter((value, index, self) => self.indexOf(value) === index)
            .join('\n');
        if (!skippedFiles) return toast.info("Не обнаружено проблем с пропуском контента.");
        const prompt = `Пожалуйста, предоставь ПОЛНУЮ версию следующих файлов...\n${skippedFiles}\n\n... (full prompt text)`;
        navigator.clipboard.writeText(prompt)
            .then(() => toast.success("Инструкция для AI скопирована!"))
            .catch(err => toast.error("Не удалось скопировать инструкцию."));
   }, [validationIssues]);

  // Text Area Utility Handlers
  const handleClearResponse = useCallback(() => { setResponse(""); toast.info("Поле ответа очищено."); }, []);
  const handleCopyResponse = useCallback(() => { /* ... */ }, [response]);
  const handleSwap = useCallback((find: string, replace: string) => {
      if (!find) return;
      try {
          const newResponse = response.replaceAll(find, replace);
          if (newResponse !== response) {
              setResponse(newResponse);
              setParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
              setValidationStatus('idle'); setValidationIssues([]);
              toast.success(`Текст заменен. Нажмите '➡️' для повторного разбора.`);
              setShowSwapModal(false);
          } else { toast.info(`Текст "${find}" не найден.`); }
      } catch (error) { toast.error("Ошибка при замене текста."); }
  }, [response, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

  // File List Handlers
  const handleToggleFileSelection = useCallback((fileId: string) => {
       setSelectedFileIds(prev => {
          const newSelected = new Set(prev);
          if (newSelected.has(fileId)) newSelected.delete(fileId);
          else newSelected.add(fileId);
          const selectedPaths = new Set( Array.from(newSelected).map(id => parsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[] );
          setSelectedAssistantFiles(selectedPaths); // Update context with PATHS
          return newSelected;
      });
  }, [parsedFiles, setSelectedAssistantFiles]);
  const handleSelectAllFiles = useCallback(() => { /* ... set IDs and Paths ... */ }, [parsedFiles, setSelectedAssistantFiles]);
  const handleDeselectAllFiles = useCallback(() => { setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); }, [setSelectedAssistantFiles]);

  // Save/Download/Telegram Handlers
   const handleSaveFiles = useCallback(async () => { /* ... */ }, [user, parsedFiles, selectedFileIds]);
   const handleDownloadZip = useCallback(async () => { /* ... */ }, [parsedFiles, selectedFileIds]);
   const handleSendToTelegram = useCallback(async (file: FileEntry) => { /* ... */ }, [user]);

  // PR Handlers
  const handleGetOpenPRs = useCallback(async () => { /* ... */ }, [repoUrl]);
  const handleCreatePR = useCallback(async () => {
        const selectedFiles = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFiles.length === 0 || !prTitle) {
             return toast.error("Укажите URL, Заголовок PR и выберите файлы.");
        }
        if (!repoContext) return;

        // --- Generate Description & Commit ---
        let finalDescription = rawDescription.substring(0, 4000) + (rawDescription.length > 4000 ? "\n\n...(описание усечено)" : "");
        finalDescription += `\n\n**Файлы в этом PR (${selectedFiles.length}):**\n` + selectedFiles.map(f => `- \`${f.path}\``).join('\n');
        const unselectedUnnamed = parsedFiles.filter(f => f.path.startsWith('unnamed-') && !selectedFileIds.has(f.id));
        if (unselectedUnnamed.length > 0) finalDescription += `\n\n**Примечание:** ${unselectedUnnamed.length} блоков кода без имени файла не включены.`;
        if (validationIssues.length > 0) {
            finalDescription += "\n\n**Обнаруженные Проблемы:**\n";
            validationIssues.forEach(issue => { finalDescription += `- **${issue.filePath}**: ${issue.message}\n`; });
        }
        const commitSubject = prTitle.substring(0, 50);
        let commitBody = `Apply AI changes to ${selectedFiles.length} files.\n\nBased on: ${rawDescription.split('\n')[0].substring(0, 100)}...`;
        const finalCommitMessage = `${commitSubject}\n\n${commitBody}`;
        // --- End Generation ---

        setAssistantLoading(true); setIsCreatingPr(true);
        try {
            const filesToCommit = selectedFiles.map(f => ({ path: f.path, content: f.content }));
            const result = await createGitHubPullRequest( repoUrl, filesToCommit, prTitle, finalDescription, finalCommitMessage );
            if (result.success && result.prUrl) {
                toast.success(`PR успешно создан: ${result.prUrl}`);
                await notifyAdmin(`Новый PR "${prTitle}" создан ${user?.username || user?.id}: ${result.prUrl}`);
                handleGetOpenPRs();
            } else {
                toast.error("Ошибка создания PR: " + result.error);
                console.error("PR Creation Failed:", result.error);
            }
        } catch (err) {
            toast.error("Критическая ошибка создания PR.");
            console.error("Create PR error:", err);
        } finally {
            setAssistantLoading(false); setIsCreatingPr(false);
        }
    }, [repoContext, parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, user, setAssistantLoading, handleGetOpenPRs]);


   // Tools Menu Handler
   const handleAddCustomLink = useCallback(async () => { /* ... */ }, [customLinks, user]);

   // --- Expose methods via ref ---
    useImperativeHandle(ref, () => ({ handleParse, selectAllParsedFiles: handleSelectAllFiles, handleCreatePR, }));

  // --- RENDER ---
  return (
    <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                AI Code Assistant
            </h1>
             <Tooltip text={`Вставьте ответ AI → '➡️' → Проверьте/Исправьте → Выберите файлы → Создать PR`} position="bottom">
                <FaInfoCircle className="text-blue-400 cursor-help hover:text-blue-300 transition" />
            </Tooltip>
        </header>

        {/* AI Response Input Area */}
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
                    disabled={isParsing || isCreatingPr}
                />
                 {/* Render Utilities */}
                 <TextAreaUtilities
                    response={response}
                    isLoading={isParsing || isCreatingPr}
                    onParse={handleParse}
                    onSwap={() => setShowSwapModal(true)}
                    onCopy={handleCopyResponse}
                    onClear={handleClearResponse}
                 />
            </div>
             {/* Render Validation Status */}
             <ValidationStatusIndicator
                 status={validationStatus}
                 issues={validationIssues}
                 onAutoFix={handleAutoFix}
                 onCopyPrompt={handleCopyFixPrompt}
             />
        </div>

         {/* Render Parsed Files List */}
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
             isLoading={isParsing || isCreatingPr}
         />

         {/* Render PR Form */}
         <PullRequestForm
            repoUrl={repoUrl}
            prTitle={prTitle}
            selectedFileCount={selectedFileIds.size}
            isLoading={isCreatingPr}
            isLoadingPrList={loadingPRs}
            onRepoUrlChange={setRepoUrl}
            onPrTitleChange={setPrTitle}
            onCreatePR={handleCreatePR}
            onGetOpenPRs={handleGetOpenPRs}
         />

         {/* Render Open PR List */}
         <OpenPrList openPRs={openPRs} />

         {/* Render Tools Menu */}
         <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />

         {/* Render Swap Modal */}
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