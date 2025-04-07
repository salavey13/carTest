// /components/AICodeAssistant.tsx
"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// Action Imports
import { createGitHubPullRequest, getOpenPullRequests, fetchRepoContents } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
// Hook Imports
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext"; // Correct context import
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry } from "@/hooks/useCodeParsingAndValidation";
// Child Component Imports
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { SwapModal } from './assistant_components/SwapModal';
import { CodeRestorer } from './assistant_components/CodeRestorer';
// Library Imports
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircleInfo } from "react-icons/fa6";
import clsx from "clsx";
import { saveAs } from "file-saver";

// --- Tooltip Component ---
export const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const positionClasses = { top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1', bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1', left: 'right-full top-1/2 transform -translate-y-3/4 mr-1', right: 'left-full top-1/2 transform -translate-y-1 ml-1', };
  return ( <div className="relative inline-block group"> <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>{children}</div> <AnimatePresence> {isVisible && ( <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }} className={clsx("absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded-lg shadow-lg w-max max-w-xs whitespace-pre-line", positionClasses[position])}> {text} </motion.div> )} </AnimatePresence> </div> );
};
Tooltip.displayName = 'Tooltip';

// --- Interfaces ---
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {
  aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>; // Prop from page.tsx
}
interface OriginalFile {
  path: string;
  content: string;
}

// --- Helper: Robust Function Selection Logic --- (Keep unchanged)
const selectFunctionDefinition = (text: string, startIndex: number): [number, number] => {
    const declarationLineStart = text.lastIndexOf('\n', startIndex - 1) + 1;
    let braceStart = -1;
    let searchPos = declarationLineStart;
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let inString: '"' | "'" | null = null;
    let parenDepth = 0;

    while(searchPos < text.length) {
        const char = text[searchPos];
        const prevChar = searchPos > 0 ? text[searchPos - 1] : '';
        // Skip comments and strings FIRST
        if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; }
        else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; }
        else if (inString) { if (char === inString && prevChar !== '\\') inString = null; }
        else if (char === '/' && prevChar === '/') { inSingleLineComment = true; }
        else if (char === '*' && prevChar === '/') { inMultiLineComment = true; }
        else if (char === '"' || char === "'") { inString = char; }
        else if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === '{' && parenDepth === 0) { // Found potential opening brace
            const precedingText = text.substring(declarationLineStart, searchPos).trim();
            if (precedingText.endsWith(')') || precedingText.endsWith('=>') || precedingText.match(/[a-zA-Z0-9_$]\s*$/)) {
                braceStart = searchPos;
                break; // Found likely start
            }
             // Consider class methods like `methodName() {` or `get prop() {`
             if (precedingText.match(/[a-zA-Z0-9_$]+\s*\([^)]*\)$/)) {
                 braceStart = searchPos;
                 break;
             }
        }
        // Optimization: Stop if we encounter the start of another logical block before finding '{'
        if (char === '\n' && text.substring(searchPos + 1).match(/^\s*(?:async\s+|function\s+|const\s+|let\s+|var\s+|class\s+|get\s+|set\s+|[a-zA-Z0-9_$]+\s*\(|\/\/|\/\*)/)) {
             if (braceStart === -1) break; // Only break if we haven't found our brace yet
        }
        searchPos++;
    }
    if (braceStart === -1) return [-1, -1];

    // Start Precise Depth Tracking from the found brace
    let depth = 1;
    let pos = braceStart + 1;
    inSingleLineComment = false;
    inMultiLineComment = false;
    inString = null;

    while (pos < text.length && depth > 0) {
        const char = text[pos];
        const prevChar = pos > 0 ? text[pos - 1] : '';
        if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; }
        else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; }
        else if (inString) { if (char === inString && prevChar !== '\\') inString = null; }
        else if (char === '/' && prevChar === '/') { inSingleLineComment = true; }
        else if (char === '*' && prevChar === '/') { inMultiLineComment = true; }
        else if (char === '"' || char === "'") { inString = char; }
        else if (char === '{') depth++;
        else if (char === '}') depth--;
        pos++;
    }

    if (depth !== 0) return [-1,-1];
    const closingBracePos = pos - 1;
    let closingLineEnd = text.indexOf('\n', closingBracePos);
    if (closingLineEnd === -1) closingLineEnd = text.length;
    return [declarationLineStart, closingLineEnd];
};


// --- Helper: Extract Function Name --- (Keep unchanged)
const extractFunctionName = (line: string): string | null => {
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?\s*([a-zA-Z0-9_$]+)\s*(?:[:=(]|\s*=>)/);
     if (funcMatch && funcMatch[1]) return funcMatch[1];
    const methodMatch = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/);
    if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) return methodMatch[1];
    return null;
};


// --- Main Component ---
const AICodeAssistant = forwardRef<any, AICodeAssistantProps>(({ aiResponseInputRef }, ref) => {
  // --- Hooks ---
  const { user } = useAppContext();
  const repoContext = useRepoXmlPageContext();
  const {
    parsedFiles, rawDescription, validationStatus, validationIssues, isParsing, // isParsing is from the hook
    parseAndValidateResponse, autoFixIssues,
    setParsedFiles, setValidationStatus, setValidationIssues
  } = useCodeParsingAndValidation();

  // --- Context Access ---
  // Use setters and loading state from context
  const {
    setAiResponseHasContent = () => {}, // Default stubs if context is somehow missing
    setFilesParsed = () => {},
    setSelectedAssistantFiles = () => {},
    setAssistantLoading = () => {},
    assistantLoading = false, // Get loading state from context
  } = repoContext ?? {}; // Use nullish coalescing for safety

  // --- State ---
  const [response, setResponse] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest"); // Default or load from context/props if needed later
  const [prTitle, setPrTitle] = useState<string>("");
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false); // Keep local for specific PR list fetch
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
  // isCreatingPr is replaced by assistantLoading from context for PR creation/parsing
  const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
  const [isFetchingOriginals, setIsFetchingOriginals] = useState(false); // Keep local for specific fetch

  // --- Helper ---
   const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

  // --- Effects ---
   useEffect(() => {
     // Ensure context is available before using setters
     if (!repoContext) return;
     const hasContent = response.trim().length > 0;
     // Use context setter
     setAiResponseHasContent(hasContent);
     if (!hasContent) {
         // Reset related context states
         setFilesParsed(false);
         setSelectedAssistantFiles(new Set());
         // Reset local states tied to response content
         setParsedFiles([]); // Reset hook state
         setSelectedFileIds(new Set());
         setValidationStatus('idle');
         setValidationIssues([]);
         setOriginalRepoFiles([]);
     } else {
         // If response has content but no files are parsed yet (e.g., after paste), ensure validation is idle
         if (parsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing) {
            setValidationStatus('idle');
            setValidationIssues([]);
         }
     }
    // Add context setters to dependency array if their identity can change (though unlikely here)
   }, [response, parsedFiles.length, isParsing, repoContext, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setParsedFiles, setValidationStatus, setValidationIssues, validationStatus]); // Added repoContext and setters

   useEffect(() => { const loadLinks = async () => { if (!user) { setCustomLinks([]); return; } try { const { data: userData, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!error && userData?.metadata?.customLinks) setCustomLinks(userData.metadata.customLinks); else setCustomLinks([]); } catch (e) { console.error("Error loading links:", e); setCustomLinks([]); } }; loadLinks(); }, [user]);

   const skippedIssues = validationIssues.filter(i => i.type === 'skippedCodeBlock');
   useEffect(() => { if (skippedIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) { const fetchOriginals = async () => { setIsFetchingOriginals(true); toast.info("Загрузка оригиналов..."); try { const result = await fetchRepoContents(repoUrl); if (result.success && Array.isArray(result.files)) { setOriginalRepoFiles(result.files); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (result.error ?? 'Unknown error')); setOriginalRepoFiles([]); } } catch (error) { toast.error("Крит. ошибка загрузки оригиналов."); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOriginals(); } }, [skippedIssues.length, originalRepoFiles.length, isFetchingOriginals, repoUrl]);


  // --- Handlers ---

  // Parse & Validate Handler
  const handleParse = useCallback(async () => {
    if (!repoContext) return;
    setAssistantLoading(true); // Use context setter for loading state
    setOriginalRepoFiles([]); // Reset originals before parsing new response
    // parseAndValidateResponse now manages its own 'isParsing' state via the hook
    const { files: newlyParsedFiles } = await parseAndValidateResponse(response);
    // Update local state based on parsing result
    setSelectedFileIds(new Set(newlyParsedFiles.map(f => f.id)));
    if (newlyParsedFiles.length > 0) {
        setPrTitle(extractPRTitleHint(rawDescription || response));
    } else {
        setPrTitle('');
    }
    // Update context state after parsing is complete
    setFilesParsed(newlyParsedFiles.length > 0);
    setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));
    setAssistantLoading(false); // Use context setter to turn off loading
  }, [response, rawDescription, parseAndValidateResponse, repoContext, setAssistantLoading, setFilesParsed, setSelectedAssistantFiles]); // Added context deps

   // Auto-Fix Handler (Keep unchanged)
   const handleAutoFix = useCallback(() => { autoFixIssues(parsedFiles, validationIssues); }, [autoFixIssues, parsedFiles, validationIssues]);

   // Copy Fix Prompt Handler (Keep unchanged)
   const handleCopyFixPrompt = useCallback(() => { const skipped = validationIssues.filter(i => i.type === 'skippedComment'); if (skipped.length===0) return toast.info("Нет маркеров '// ...'."); const fl = skipped.map(i=>`- ${i.filePath} (~${i.details?.lineNumber})`).join('\n'); const p=`please merge new versions with my current files by restoring skipped parts in new files using old files as reference from context below:\n${fl}\n\nand give full new versions without skipping parts`; navigator.clipboard.writeText(p).then(()=>toast.success("Prompt скопирован!")).catch(()=>toast.error("Ошибка копирования.")); }, [validationIssues]);

   // Restore Skipped Code Handler (Keep unchanged)
   const handleRestorationComplete = useCallback((updatedFiles: FileEntry[], successCount: number, errorCount: number) => { setParsedFiles(updatedFiles); const remainingIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); setValidationIssues(remainingIssues); setValidationStatus(remainingIssues.length > 0 ? (remainingIssues.some(i=>!i.fixable && !i.restorable)? 'error':'warning') : 'success'); }, [validationIssues, setParsedFiles, setValidationIssues, setValidationStatus]);

  // --- Text Area Utility Handlers ---
  const handleClearResponse = useCallback(() => { setResponse(""); toast.info("Поле ответа очищено."); }, []);
  const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(()=>toast.success("Скопировано!")).catch(()=>{toast.error("Ошибка копирования")});}, [response]);

  // Modal Open Handler (Keep unchanged)
  const handleOpenModal = useCallback((mode: 'replace' | 'search') => { setModalMode(mode); setShowModal(true); }, []);

  // Text Replace Handler
  const handleSwap = useCallback((find: string, replace: string) => {
    if (!find || !repoContext) return;
    const textarea = aiResponseInputRef.current;
    if (!textarea) return;
    try {
        const currentValue = textarea.value;
        const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedFind, 'g');
        const newValue = currentValue.replace(regex, replace);
        if (newValue !== currentValue) {
            setResponse(newValue); // Update local state, triggers useEffect for context update
            textarea.value = newValue; // Manually update textarea if needed
            const event = new Event('input', { bubbles: true });
            textarea.dispatchEvent(event); // Ensure change is detected if needed

            // Reset dependent local states
            setParsedFiles([]);
            setSelectedFileIds(new Set());
            setValidationStatus('idle');
            setValidationIssues([]);

            // Reset dependent context states explicitly
            setFilesParsed(false);
            setSelectedAssistantFiles(new Set());

            toast.success(`"${find}" заменен на "${replace}". Нажмите '➡️' для перепроверки.`);
        } else {
            toast.info(`"${find}" не найден.`);
        }
    } catch (e) { toast.error("Ошибка замены."); console.error(e); }
  }, [aiResponseInputRef, repoContext, setResponse, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]); // Added context deps

   // Text Search / Magic Swap Handler
   const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText || !repoContext) { toast.warn("Введите текст для поиска."); return; }
        const textarea = aiResponseInputRef.current;
        if (!textarea) return;
        const cursorPos = textarea.selectionStart;
        const text = textarea.value;

        if (isMultiline) { // --- Magic Swap Logic ---
            const cleanedSearchText = searchText.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
            if (!cleanedSearchText) { toast.error("Вставленный текст пуст после очистки."); return; }
            const firstLine = cleanedSearchText.split('\n')[0];
            const functionName = extractFunctionName(firstLine);
            if (!functionName) { toast.error("Не удалось извлечь имя функции из вставленного текста."); return; }

            const textToSearch = text.slice(cursorPos) + text.slice(0, cursorPos);
            const functionRegex = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|const\\s+|let\\s+|var\\s+)${functionName}\\s*(?:\\(|[:=])`, 'm');
            let match = functionRegex.exec(textToSearch);
            let matchIndex = -1;
            if (match) { matchIndex = (match.index + match[1].length + cursorPos) % text.length; }
            if (matchIndex === -1) { toast.info(`Функция "${functionName}" не найдена в текущем коде.`); return; }

            const [startPos, endPos] = selectFunctionDefinition(text, matchIndex);
            if (startPos === -1 || endPos === -1) { toast.error("Не удалось корректно выделить функцию для замены (проверьте скобки или комментарии)."); return; }

            const newValue = text.substring(0, startPos) + cleanedSearchText + text.substring(endPos);
            setResponse(newValue); // Update local state, triggers useEffect for context update
            textarea.value = newValue;
            const event = new Event('input', { bubbles: true });
            textarea.dispatchEvent(event);
            textarea.focus();
            textarea.setSelectionRange(startPos, startPos + cleanedSearchText.length);

            // Reset dependent local states
            setParsedFiles([]);
            setSelectedFileIds(new Set());
            setValidationStatus('idle');
            setValidationIssues([]);

            // Reset dependent context states explicitly
            setFilesParsed(false);
            setSelectedAssistantFiles(new Set());

            toast.success(`Функция "${functionName}" заменена! ✨ Нажмите '➡️'.`);

        } else { // --- Single-line Search Logic ---
            const searchLower = searchText.toLowerCase();
            const textLower = text.toLowerCase();
            let searchFrom = cursorPos;
            let index = textLower.indexOf(searchLower, searchFrom);
            if (index === -1) {
                 index = textLower.indexOf(searchLower, 0);
                 if (index !== -1 && index >= cursorPos) index = -1;
                 else if (index !== -1) toast.info("Поиск достиг начала документа.");
            }
            if (index !== -1) {
                textarea.focus();
                textarea.setSelectionRange(index, index + searchText.length);
                toast.success(`Найдено: "${searchText}"`);
            } else {
                toast.info(`"${searchText}" не найден.`);
                textarea.focus();
            }
        }
   }, [aiResponseInputRef, repoContext, setResponse, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]); // Added context deps


    // Function Selection Handler (Keep unchanged, operates on textarea ref)
    const handleSelectFunction = useCallback(() => {
        const textarea = aiResponseInputRef.current;
        if (!textarea) return;
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        let lineStartIndex = text.lastIndexOf('\n', cursorPos - 1) + 1;

        const [startPos, endPos] = selectFunctionDefinition(text, lineStartIndex);

        if (startPos !== -1 && endPos !== -1) {
            textarea.focus();
            textarea.setSelectionRange(startPos, endPos);
            toast.success("Функция выделена!");
        } else {
             let searchBackIndex = text.lastIndexOf('{', lineStartIndex);
             if(searchBackIndex > 0) {
                 const [startPosBack, endPosBack] = selectFunctionDefinition(text, searchBackIndex);
                  if (startPosBack !== -1 && endPosBack !== -1) {
                      textarea.focus();
                      textarea.setSelectionRange(startPosBack, endPosBack);
                      toast.success("Функция выделена (найдена выше)!");
                      return;
                  }
             }
            toast.info("Не удалось выделить функцию. Убедитесь, что курсор в строке с объявлением или внутри функции.");
            textarea.focus();
        }
    }, [aiResponseInputRef]);


  // File List Handlers
  const handleToggleFileSelection = useCallback((fileId: string) => {
     if (!repoContext) return;
     setSelectedFileIds(prev => {
        const newSelectedIds = new Set(prev);
        if (newSelectedIds.has(fileId)) {
            newSelectedIds.delete(fileId);
        } else {
            newSelectedIds.add(fileId);
        }
        // Update context state based on new selection
        const selectedPaths = new Set(
            Array.from(newSelectedIds)
                 .map(id => parsedFiles.find(f => f.id === id)?.path)
                 .filter((path): path is string => !!path) // Type guard
        );
        setSelectedAssistantFiles(selectedPaths);
        return newSelectedIds; // Return updated local state
     });
  }, [parsedFiles, repoContext, setSelectedAssistantFiles]); // Added context deps

  const handleSelectAllFiles = useCallback(() => {
    if (!repoContext) return;
    const allIds = new Set(parsedFiles.map(f => f.id));
    const allPaths = new Set(parsedFiles.map(f => f.path));
    setSelectedFileIds(allIds); // Update local state
    setSelectedAssistantFiles(allPaths); // Update context state
    if (allIds.size > 0) toast.info(`${allIds.size} файлов выбрано.`);
  }, [parsedFiles, repoContext, setSelectedAssistantFiles]); // Added context deps

  const handleDeselectAllFiles = useCallback(() => {
    if (!repoContext) return;
    setSelectedFileIds(new Set()); // Update local state
    setSelectedAssistantFiles(new Set()); // Update context state
    toast.info("Выделение снято.");
  }, [repoContext, setSelectedAssistantFiles]); // Added context deps

  // Save/Download/Telegram Handlers
   const handleSaveFiles = useCallback(async () => {
        if (!user || !repoContext) return;
        const filesToSave = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToSave.length === 0) return toast.warn("Нет выбранных файлов для сохранения.");
        setAssistantLoading(true); // Use context loading
        try {
            // Supabase logic remains the same
            const fileData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension }));
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // Allow not found error
            const existingFiles = existingData?.metadata?.generated_files || [];
            const newPaths = new Set(fileData.map(f => f.p));
            const mergedFiles = [
                ...existingFiles.filter((f: any) => !newPaths.has(f.path)),
                ...fileData.map(f => ({ path: f.p, code: f.c, extension: f.e }))
            ];
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({
                user_id: user.id,
                metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles }
            }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`${filesToSave.length} файлов сохранено в профиле!`);
        } catch (err) {
            toast.error("Ошибка сохранения файлов.");
            console.error("Save files error:", err);
        } finally {
            setAssistantLoading(false); // Stop context loading
        }
   }, [user, parsedFiles, selectedFileIds, repoContext, setAssistantLoading]); // Added context deps

   const handleDownloadZip = useCallback(async () => {
        if (!repoContext) return;
        const filesToZip = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToZip.length === 0) return toast.warn("Нет выбранных файлов для скачивания.");
        setAssistantLoading(true); // Use context loading
        try {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            filesToZip.forEach((file) => zip.file(file.path, file.content));
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ai_files_${Date.now()}.zip`);
            toast.success("Архив успешно скачан.");
        } catch (error) {
            toast.error("Ошибка создания ZIP архива.");
            console.error("Download ZIP error:", error);
        } finally {
            setAssistantLoading(false); // Stop context loading
        }
   }, [parsedFiles, selectedFileIds, repoContext, setAssistantLoading]); // Added context deps

   const handleSendToTelegram = useCallback(async (file: FileEntry) => {
        if (!user?.id || !repoContext) return;
        setAssistantLoading(true); // Use context loading
        try {
            const result = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt");
            if (!result.success) throw new Error(result.error ?? "Unknown Telegram send error");
            toast.success(`Файл "${file.path}" отправлен в Telegram.`);
        } catch (err) {
            toast.error(`Ошибка отправки файла в Telegram.`);
            console.error("Telegram send error:", err);
        } finally {
            setAssistantLoading(false); // Stop context loading
        }
   }, [user, repoContext, setAssistantLoading]); // Added context deps

  // PR Handlers
  const handleGetOpenPRs = useCallback(async () => {
      if (!repoUrl) return toast.warn("Введите URL репозитория.");
      setLoadingPRs(true); // Use local loading for this specific action
      try {
          const result = await getOpenPullRequests(repoUrl);
          if (result.success && result.pullRequests) {
              setOpenPRs(result.pullRequests);
              toast.success(`${result.pullRequests.length} открытых PR загружено.`);
          } else {
              toast.error("Ошибка загрузки PR: " + result.error);
          }
      } catch (err) {
          toast.error("Критическая ошибка при загрузке PR.");
          console.error("Get PRs error:", err);
      } finally {
          setLoadingPRs(false); // Stop local loading
      }
  }, [repoUrl]);

  const handleCreatePR = useCallback(async () => {
        if (!repoContext) return;
        const selectedFiles = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFiles.length === 0 || !prTitle) {
            return toast.error("Укажите URL репозитория, Заголовок PR и выберите хотя бы один файл.");
        }
        // Validation checks passed, start loading
        setAssistantLoading(true); // Use context loading for the main action

        try {
            // PR description and commit message logic remains the same
            let finalDescription = rawDescription.substring(0, 13000) + (rawDescription.length > 13000 ? "\n\n...(описание усечено)" : "");
            finalDescription += `\n\n**Файлы в этом PR (${selectedFiles.length}):**\n` + selectedFiles.map(f => `- \`${f.path}\``).join('\n');
            const unselectedUnnamed = parsedFiles.filter(f => f.path.startsWith('unnamed-') && !selectedFileIds.has(f.id));
            if (unselectedUnnamed.length > 0) finalDescription += `\n\n**Примечание:** ${unselectedUnnamed.length} блоков кода без имени файла не были включены.`;
            const remainingIssues = validationIssues;
             if (remainingIssues.length > 0) { finalDescription += "\n\n**Обнаруженные Проблемы (не исправлено / не восстановлено):**\n"; remainingIssues.forEach(issue => { finalDescription += `- **${issue.filePath}**: ${issue.message}\n`; }); }
            const commitSubject = prTitle.substring(0, 50);
            let commitBody = `Apply AI changes to ${selectedFiles.length} files.\n\n${rawDescription.split('\n').slice(0,10).join('\n').substring(0, 1000)}...`;
            const finalCommitMessage = `${commitSubject}\n\n${commitBody}`;

            // Map files for the action
            const filesToCommit = selectedFiles.map(f => ({ path: f.path, content: f.content }));

            // Call the action
            const result = await createGitHubPullRequest(
                repoUrl,
                filesToCommit,
                prTitle,
                finalDescription,
                finalCommitMessage
            );

            // Handle result
            if (result.success && result.prUrl) {
                toast.success(`Pull Request успешно создан: ${result.prUrl}`);
                await notifyAdmin(`Новый PR "${prTitle}" создан ${user?.username || user?.id}: ${result.prUrl}`);
                handleGetOpenPRs(); // Refresh open PR list (uses its own loading state)
            } else {
                toast.error("Ошибка создания Pull Request: " + result.error);
                console.error("PR Creation Failed:", result.error);
            }
        } catch (err) {
            toast.error("Критическая ошибка при создании Pull Request.");
            console.error("Create PR error:", err);
        } finally {
            // Stop loading regardless of outcome
            setAssistantLoading(false); // Stop context loading
        }
    }, [repoContext, parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, user, setAssistantLoading, handleGetOpenPRs]); // Added context deps

   // Tools Menu Handler (Keep unchanged)
   const handleAddCustomLink = useCallback(async () => { const n=prompt("Назв:"); const u=prompt("URL (https://..):"); if (!n||!u||!u.startsWith('http')) return; const nl={name: n, url: u}; const ul=[...customLinks,nl]; setCustomLinks(ul); if(user){try{const{data:ed}=await supabaseAdmin.from("users").select("metadata").eq("user_id",user.id).single(); await supabaseAdmin.from("users").upsert({user_id:user.id,metadata:{...(ed?.metadata||{}),customLinks:ul}},{onConflict:'user_id'}); toast.success(`Ссылка "${n}" добавлена.`);}catch(e){toast.error("Ошибка сохр.");setCustomLinks(customLinks);}} }, [customLinks, user]);

   // --- Expose methods via ref ---
    useImperativeHandle(ref, () => ({
        // These methods will be called by the context's trigger functions
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles, // Expose the correct select all handler
        handleCreatePR,
     }), [handleParse, handleSelectAllFiles, handleCreatePR]); // Add handlers to dependency array


  // --- RENDER ---
  // Add a check for context existence
  if (!repoContext) {
      return <div className="p-4 bg-red-900 text-white rounded-lg">Ошибка: Контекст страницы не найден.</div>;
  }

  return (
    // Use assistantLoading from context to disable inputs/buttons during main operations
    <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center gap-2">
             <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">AI Code Assistant</h1>
             <Tooltip text={`Вставьте ответ AI → '➡️' → Проверьте/Исправьте → Выберите файлы → Создать PR`} position="left">
                 <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
             </Tooltip>
        </header>

        {/* AI Response Input Area */}
         <div>
             <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 2️⃣ Вставьте сюда ПОЛНЫЙ ОТВЕТ от вашего AI. Затем нажмите '➡️'. </p>
            <div className="relative group">
                <textarea
                    id="response-input"
                    ref={aiResponseInputRef} // Use the ref passed via props
                    className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Вставьте ПОЛНЫЙ ОТВЕТ от AI здесь..."
                    // Disable textarea during parsing (hook state), context loading (PR creation etc.), or fetching originals
                    disabled={isParsing || assistantLoading || isFetchingOriginals}
                    spellCheck="false"
                />
                 <TextAreaUtilities
                     response={response}
                     // Disable utilities during loading states
                     isLoading={isParsing || assistantLoading || isFetchingOriginals}
                     onParse={handleParse}
                     onOpenModal={handleOpenModal}
                     onCopy={handleCopyResponse}
                     onClear={handleClearResponse}
                     onSelectFunction={handleSelectFunction}
                 />
            </div>
             {/* Validation Status and Actions */}
             <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                 <CodeRestorer
                    parsedFiles={parsedFiles}
                    originalFiles={originalRepoFiles}
                    skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')}
                    onRestorationComplete={handleRestorationComplete}
                    // Disable during major loading states
                    disabled={isParsing || assistantLoading || validationStatus === 'validating' || isFetchingOriginals}
                 />
                 <ValidationStatusIndicator
                     status={validationStatus}
                     issues={validationIssues}
                     onAutoFix={handleAutoFix}
                     onCopyPrompt={handleCopyFixPrompt}
                 />
             </div>
        </div>

         {/* Parsed Files List */}
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
             // Disable list interactions during major loading
             isLoading={isParsing || assistantLoading || isFetchingOriginals}
         />

         {/* PR Form */}
         <PullRequestForm
             repoUrl={repoUrl}
             prTitle={prTitle}
             selectedFileCount={selectedFileIds.size}
             // Use context loading for main PR action, local for PR list fetching
             isLoading={assistantLoading}
             isLoadingPrList={loadingPRs}
             onRepoUrlChange={setRepoUrl}
             onPrTitleChange={setPrTitle}
             onCreatePR={handleCreatePR}
             onGetOpenPRs={handleGetOpenPRs}
         />

         {/* Open PR List */}
         <OpenPrList openPRs={openPRs} />

         {/* Tools Menu */}
         <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />

         {/* Modals */}
         <AnimatePresence>
             {showModal && (
                 <SwapModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSwap={handleSwap}
                    onSearch={handleSearch}
                    initialMode={modalMode}
                 />
             )}
         </AnimatePresence>
    </div>
  );
});

AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;
