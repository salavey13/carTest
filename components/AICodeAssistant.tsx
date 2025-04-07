"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
// Action Imports
import { createGitHubPullRequest, getOpenPullRequests, fetchRepoContents } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
// Hook Imports
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
// Import context and Ref Type
import { useRepoXmlPageContext, AICodeAssistantRef } from "@/contexts/RepoXmlPageContext";
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
  // No longer receiving aiResponseInputRef via props
}
interface OriginalFile { path: string; content: string; }

// --- Helper: Robust Function Selection Logic ---
const selectFunctionDefinition = (text: string, startIndex: number): [number, number] => {
    const declarationLineStart = text.lastIndexOf('\n', startIndex - 1) + 1;
    let braceStart = -1; let searchPos = declarationLineStart; let inSingleLineComment = false; let inMultiLineComment = false; let inString: '"' | "'" | null = null; let parenDepth = 0;
    while(searchPos < text.length) {
        const char = text[searchPos]; const prevChar = searchPos > 0 ? text[searchPos - 1] : '';
        if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; }
        else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; }
        else if (inString) { if (char === inString && prevChar !== '\\') inString = null; }
        else if (char === '/' && prevChar === '/') { inSingleLineComment = true; }
        else if (char === '*' && prevChar === '/') { inMultiLineComment = true; }
        else if (char === '"' || char === "'") { inString = char; }
        else if (char === '(') parenDepth++; else if (char === ')') parenDepth--;
        else if (char === '{' && parenDepth === 0) { const precedingText = text.substring(declarationLineStart, searchPos).trim(); if (precedingText.endsWith(')') || precedingText.endsWith('=>') || precedingText.match(/[a-zA-Z0-9_$]\s*$/) || precedingText.match(/[a-zA-Z0-9_$]+\s*\([^)]*\)$/)) { braceStart = searchPos; break; } }
        if (char === '\n' && text.substring(searchPos + 1).match(/^\s*(?:async\s+|function\s+|const\s+|let\s+|var\s+|class\s+|get\s+|set\s+|[a-zA-Z0-9_$]+\s*\(|\/\/|\/\*)/)) { if (braceStart === -1) break; }
        searchPos++;
    }
    if (braceStart === -1) return [-1, -1];
    let depth = 1; let pos = braceStart + 1; inSingleLineComment = false; inMultiLineComment = false; inString = null;
    while (pos < text.length && depth > 0) {
        const char = text[pos]; const prevChar = pos > 0 ? text[pos - 1] : '';
        if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; }
        else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; }
        else if (inString) { if (char === inString && prevChar !== '\\') inString = null; }
        else if (char === '/' && prevChar === '/') { inSingleLineComment = true; }
        else if (char === '*' && prevChar === '/') { inMultiLineComment = true; }
        else if (char === '"' || char === "'") { inString = char; }
        else if (char === '{') depth++; else if (char === '}') depth--;
        pos++;
    }
    if (depth !== 0) return [-1,-1];
    const closingBracePos = pos - 1; let closingLineEnd = text.indexOf('\n', closingBracePos); if (closingLineEnd === -1) closingLineEnd = text.length;
    return [declarationLineStart, closingLineEnd];
};

// --- Helper: Extract Function Name ---
const extractFunctionName = (line: string): string | null => {
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?\s*([a-zA-Z0-9_$]+)\s*(?:[:=(]|\s*=>)/);
     if (funcMatch && funcMatch[1]) return funcMatch[1];
    const methodMatch = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/);
    if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) return methodMatch[1];
    return null;
};


// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
  // --- Hooks ---
  const { user } = useAppContext();
  const repoContext = useRepoXmlPageContext();
  const {
    parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
    parseAndValidateResponse, autoFixIssues,
    setParsedFiles, setValidationStatus, setValidationIssues
  } = useCodeParsingAndValidation();

  // --- Context Access ---
  const {
    setAiResponseHasContent = () => console.warn("setAiResponseHasContent not available from context"),
    setFilesParsed = () => console.warn("setFilesParsed not available from context"),
    setSelectedAssistantFiles = () => console.warn("setSelectedAssistantFiles not available from context"),
    setAssistantLoading = () => console.warn("setAssistantLoading not available from context"),
    assistantLoading = false,
    aiResponseInputRef // Get the ref for the textarea FROM CONTEXT
  } = repoContext;

  // --- State ---
  const [response, setResponse] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
  const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
  const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);

  // --- Helper ---
   const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

  // --- Effects ---
   useEffect(() => {
     const hasContent = response.trim().length > 0;
     setAiResponseHasContent(hasContent);
     if (!hasContent) {
         setFilesParsed(false);
         setSelectedAssistantFiles(new Set());
         setParsedFiles([]);
         setSelectedFileIds(new Set());
         setValidationStatus('idle');
         setValidationIssues([]);
         setOriginalRepoFiles([]);
     } else {
         if (parsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing) {
            setValidationStatus('idle'); setValidationIssues([]);
         }
     }
   }, [response, parsedFiles.length, isParsing, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setParsedFiles, setValidationStatus, setValidationIssues, validationStatus]);

   useEffect(() => {
       const loadLinks = async () => { if (!user) { setCustomLinks([]); return; } try { const { data: userData, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!error && userData?.metadata?.customLinks) setCustomLinks(userData.metadata.customLinks); else setCustomLinks([]); } catch (e) { console.error("Error loading links:", e); setCustomLinks([]); } };
       loadLinks();
    }, [user]);

   const skippedIssues = validationIssues.filter(i => i.type === 'skippedCodeBlock');
   useEffect(() => {
       if (skippedIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) {
           const fetchOriginals = async () => { setIsFetchingOriginals(true); toast.info("Загрузка оригиналов для восстановления..."); try { const result = await fetchRepoContents(repoUrl); if (result.success && Array.isArray(result.files)) { setOriginalRepoFiles(result.files); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (result.error ?? 'Unknown error')); setOriginalRepoFiles([]); } } catch (error) { toast.error("Крит. ошибка загрузки оригиналов."); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } };
           fetchOriginals();
        }
    }, [skippedIssues.length, originalRepoFiles.length, isFetchingOriginals, repoUrl]);


  // --- Handlers ---

  // Parse & Validate Handler
  const handleParse = useCallback(async () => {
    setAssistantLoading(true);
    setOriginalRepoFiles([]); // Reset originals before parsing new response
    const { files: newlyParsedFiles, description } = await parseAndValidateResponse(response);
    setSelectedFileIds(new Set(newlyParsedFiles.map(f => f.id)));
    if (newlyParsedFiles.length > 0) {
        setPrTitle(extractPRTitleHint(description || response)); // Use extracted description or fallback
    } else {
        setPrTitle('');
    }
    setFilesParsed(newlyParsedFiles.length > 0);
    setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));
    setAssistantLoading(false);
  }, [response, parseAndValidateResponse, setAssistantLoading, setFilesParsed, setSelectedAssistantFiles, extractPRTitleHint, setPrTitle]); // Added setPrTitle

   // Auto-Fix Handler
   const handleAutoFix = useCallback(() => { autoFixIssues(parsedFiles, validationIssues); }, [autoFixIssues, parsedFiles, validationIssues]);

   // Copy Fix Prompt Handler
   const handleCopyFixPrompt = useCallback(() => {
       const skipped = validationIssues.filter(i => i.type === 'skippedComment' || i.type === 'skippedCodeBlock'); // Include code blocks too
       if (skipped.length===0) return toast.info("Нет маркеров пропуска для восстановления.");
       const fl = skipped.map(i=>`- ${i.filePath} (~${i.details?.lineNumber}) - ${i.type}`).join('\n');
       const p=`Please fully restore the skipped parts (marked as skippedComment or skippedCodeBlock) in the following files using the original code context provided earlier. Provide the complete, updated file content without any omissions:\n${fl}\n\nRemember to output the full code for each file requested.`;
       navigator.clipboard.writeText(p).then(()=>toast.success("Prompt для восстановления скопирован!")).catch(()=>toast.error("Ошибка копирования."));
    }, [validationIssues]);

   // Restore Skipped Code Handler
   const handleRestorationComplete = useCallback((updatedFiles: FileEntry[], successCount: number, errorCount: number) => {
       setParsedFiles(updatedFiles);
       const remainingIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); // Remove only restored issues
       setValidationIssues(remainingIssues);
       // Recalculate status based on remaining issues
       setValidationStatus(remainingIssues.length === 0 ? 'success' : remainingIssues.some(i=>!i.fixable && !i.restorable)? 'error':'warning');
       if (successCount > 0) toast.success(`${successCount} блоков кода восстановлено!`);
       if (errorCount > 0) toast.error(`${errorCount} блоков не удалось восстановить.`);
    }, [validationIssues, setParsedFiles, setValidationIssues, setValidationStatus]);

  // --- Text Area Utility Handlers ---
  const handleClearResponse = useCallback(() => { setResponse(""); toast.info("Поле ответа очищено."); }, []);
  const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(()=>toast.success("Скопировано!")).catch(()=>{toast.error("Ошибка копирования")});}, [response]);
  const handleOpenModal = useCallback((mode: 'replace' | 'search') => { setModalMode(mode); setShowModal(true); }, []);

  // Text Replace Handler
  const handleSwap = useCallback((find: string, replace: string) => {
    if (!find) return;
    const textarea = aiResponseInputRef?.current;
    if (!textarea) return toast.error("Ошибка: Textarea ref не найден.");
    try {
        const currentValue = textarea.value;
        const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
        const regex = new RegExp(escapedFind, 'g');
        const newValue = currentValue.replace(regex, replace);
        if (newValue !== currentValue) {
            setResponse(newValue); // Update local state, triggers useEffect for context/validation reset
            textarea.value = newValue; // Sync textarea
            const event = new Event('input', { bubbles: true }); textarea.dispatchEvent(event); // Trigger change detection if needed
            toast.success(`"${find}" заменен на "${replace}". Нажмите '➡️' для перепроверки.`);
        } else {
            toast.info(`"${find}" не найден.`);
        }
    } catch (e) { toast.error("Ошибка замены."); console.error(e); }
  }, [aiResponseInputRef, setResponse]); // Context resets handled by useEffect on `response` change

   // Text Search / Magic Swap Handler
   const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText) { toast.warn("Введите текст для поиска."); return; }
        const textarea = aiResponseInputRef?.current;
        if (!textarea) return toast.error("Ошибка: Textarea ref не найден.");
        const cursorPos = textarea.selectionStart; const text = textarea.value;

        if (isMultiline) { // --- Magic Swap Logic ---
            const cleanedSearchText = searchText.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
            if (!cleanedSearchText) { toast.error("Вставленный текст пуст после очистки."); return; }
            const firstLine = cleanedSearchText.split('\n')[0];
            const functionName = extractFunctionName(firstLine);
            if (!functionName) { toast.error("Не удалось извлечь имя функции из вставленного текста."); return; }
            // Search forward then wrap around
            const textToSearch = text.slice(cursorPos) + text.slice(0, cursorPos);
            // Regex to find function/method declaration start (improved)
            const functionRegex = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|const\\s+|let\\s+|var\\s+|get\\s+|set\\s+|\\*?\\s*)${functionName}\\s*(?:\\(|[:=])`, 'm');
            let match = functionRegex.exec(textToSearch);
            let matchIndex = -1;
            if (match) {
                 matchIndex = (match.index + match[1].length + cursorPos) % text.length; // Adjust index based on wrapped search
             }
            if (matchIndex === -1) { toast.info(`Функция "${functionName}" не найдена в текущем коде.`); return; }
            const [startPos, endPos] = selectFunctionDefinition(text, matchIndex);
            if (startPos === -1 || endPos === -1) { toast.error("Не удалось корректно выделить функцию для замены (проверьте скобки или комментарии)."); return; }
            const newValue = text.substring(0, startPos) + cleanedSearchText + text.substring(endPos);
            setResponse(newValue); // Update local state, triggers resets via useEffect
            textarea.value = newValue; // Sync textarea
            const event = new Event('input', { bubbles: true }); textarea.dispatchEvent(event); // Trigger change detection
            textarea.focus();
            textarea.setSelectionRange(startPos, startPos + cleanedSearchText.length); // Select replaced text
            toast.success(`Функция "${functionName}" заменена! ✨ Нажмите '➡️'.`);
        } else { // --- Single-line Search Logic ---
            const searchLower = searchText.toLowerCase();
            const textLower = text.toLowerCase();
            let searchFrom = cursorPos; // Start searching from cursor position
            let index = textLower.indexOf(searchLower, searchFrom);
            // If not found starting from cursor, wrap around and search from beginning
            if (index === -1) {
                 index = textLower.indexOf(searchLower, 0);
                 // If found before original cursor after wrapping, means we passed it or it's the only one
                 if (index !== -1 && index >= cursorPos) index = -1; // Treat as not found in "forward" direction
                 else if (index !== -1) toast.info("Поиск достиг начала документа.");
            }
            if (index !== -1) {
                textarea.focus();
                textarea.setSelectionRange(index, index + searchText.length);
                toast.success(`Найдено: "${searchText}"`);
            } else {
                toast.info(`"${searchText}" не найден.`);
                textarea.focus(); // Keep focus even if not found
            }
        }
   }, [aiResponseInputRef, setResponse]); // Context resets handled by useEffect

    // Function Selection Handler
    const handleSelectFunction = useCallback(() => {
        const textarea = aiResponseInputRef?.current;
        if (!textarea) return toast.error("Ошибка: Textarea ref не найден.");
        const text = textarea.value; const cursorPos = textarea.selectionStart;
        let lineStartIndex = text.lastIndexOf('\n', cursorPos - 1) + 1;
        const [startPos, endPos] = selectFunctionDefinition(text, lineStartIndex);
        if (startPos !== -1 && endPos !== -1) {
            textarea.focus(); textarea.setSelectionRange(startPos, endPos); toast.success("Функция выделена!");
        } else {
             // Try searching backwards from cursor for declaration if inside function body
             let searchBackIndex = text.lastIndexOf('{', lineStartIndex); // Find nearest opening brace before cursor line
             if(searchBackIndex > 0) {
                 // Need a more robust way to find the declaration line from here
                 // Simple approach: find matching brace and look back (very fragile)
                 // Better: Look for function/const/let keywords before the brace
                 let declSearchIndex = text.lastIndexOf('\n', searchBackIndex) + 1;
                 const potentialDeclLine = text.substring(declSearchIndex, searchBackIndex);
                 if (potentialDeclLine.match(/(?:async\s+|function\s+|const\s+|let\s+|var\s+|get\s+|set\s+)/)) {
                     const [startPosBack, endPosBack] = selectFunctionDefinition(text, declSearchIndex);
                     if (startPosBack !== -1 && endPosBack !== -1) {
                          textarea.focus(); textarea.setSelectionRange(startPosBack, endPosBack); toast.success("Функция выделена (найдена выше)!");
                          return;
                      }
                 }
             }
            toast.info("Не удалось выделить функцию. Убедитесь, что курсор в строке с объявлением или внутри функции.");
            textarea.focus();
        }
    }, [aiResponseInputRef]);


  // File List Handlers
  const handleToggleFileSelection = useCallback((fileId: string) => {
     setSelectedFileIds(prev => {
        const newSelectedIds = new Set(prev);
        if (newSelectedIds.has(fileId)) newSelectedIds.delete(fileId); else newSelectedIds.add(fileId);
        const selectedPaths = new Set( Array.from(newSelectedIds).map(id => parsedFiles.find(f => f.id === id)?.path).filter((path): path is string => !!path) );
        setSelectedAssistantFiles(selectedPaths); // Update context
        return newSelectedIds;
     });
  }, [parsedFiles, setSelectedAssistantFiles]);

  const handleSelectAllFiles = useCallback(() => {
    const allIds = new Set(parsedFiles.map(f => f.id));
    const allPaths = new Set(parsedFiles.map(f => f.path));
    setSelectedFileIds(allIds);
    setSelectedAssistantFiles(allPaths); // Update context
    if (allIds.size > 0) toast.info(`${allIds.size} файлов выбрано.`);
  }, [parsedFiles, setSelectedAssistantFiles]);

  const handleDeselectAllFiles = useCallback(() => {
    setSelectedFileIds(new Set());
    setSelectedAssistantFiles(new Set()); // Update context
    toast.info("Выделение снято.");
  }, [setSelectedAssistantFiles]);

  // Save/Download/Telegram Handlers
   const handleSaveFiles = useCallback(async () => {
        if (!user) return toast.error("Нужно войти для сохранения.");
        const filesToSave = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToSave.length === 0) return toast.warn("Нет выбранных файлов для сохранения.");
        setAssistantLoading(true);
        try {
            const fileData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension }));
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            const existingFiles = existingData?.metadata?.generated_files || [];
            const newPaths = new Set(fileData.map(f => f.p));
            const mergedFiles = [ ...existingFiles.filter((f: any) => !newPaths.has(f.path)), ...fileData.map(f => ({ path: f.p, code: f.c, extension: f.e })) ];
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles } }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`${filesToSave.length} файлов сохранено в профиле!`);
        } catch (err) { toast.error("Ошибка сохранения файлов."); console.error("Save files error:", err); }
        finally { setAssistantLoading(false); }
   }, [user, parsedFiles, selectedFileIds, setAssistantLoading]);

   const handleDownloadZip = useCallback(async () => {
        const filesToZip = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToZip.length === 0) return toast.warn("Нет выбранных файлов для скачивания.");
        setAssistantLoading(true);
        try {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            filesToZip.forEach((file) => zip.file(file.path, file.content));
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ai_files_${Date.now()}.zip`);
            toast.success("Архив успешно скачан.");
        } catch (error) { toast.error("Ошибка создания ZIP архива."); console.error("Download ZIP error:", error); }
        finally { setAssistantLoading(false); }
   }, [parsedFiles, selectedFileIds, setAssistantLoading]);

   const handleSendToTelegram = useCallback(async (file: FileEntry) => {
        if (!user?.id) return toast.error("Нужно войти для отправки в Telegram.");
        setAssistantLoading(true);
        try {
            const result = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt");
            if (!result.success) throw new Error(result.error ?? "Unknown Telegram send error");
            toast.success(`Файл "${file.path}" отправлен в Telegram.`);
        } catch (err: any) { toast.error(`Ошибка отправки файла в Telegram: ${err?.message}`); console.error("Telegram send error:", err); }
        finally { setAssistantLoading(false); }
   }, [user, setAssistantLoading]);

  // PR Handlers
  const handleGetOpenPRs = useCallback(async () => {
      if (!repoUrl) return toast.warn("Введите URL репозитория.");
      setLoadingPRs(true);
      try {
          const result = await getOpenPullRequests(repoUrl);
          if (result.success && result.pullRequests) {
              setOpenPRs(result.pullRequests);
              if (result.pullRequests.length > 0) toast.success(`${result.pullRequests.length} открытых PR загружено.`);
              else toast.info("Открытых PR не найдено.");
          } else {
              toast.error("Ошибка загрузки PR: " + result.error);
          }
      } catch (err) { toast.error("Критическая ошибка при загрузке PR."); console.error("Get PRs error:", err); }
      finally { setLoadingPRs(false); }
  }, [repoUrl]);

  const handleCreatePR = useCallback(async () => {
        const selectedFiles = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFiles.length === 0 || !prTitle) {
            return toast.error("Укажите URL репозитория, Заголовок PR и выберите хотя бы один файл.");
        }
        if (validationStatus === 'error' || validationStatus === 'warning') {
            const confirmContinue = confirm(`В коде есть ${validationIssues.length} проблем (${validationStatus}). Вы уверены, что хотите создать PR?`);
            if (!confirmContinue) return;
        }
        setAssistantLoading(true);
        try {
            // Use the rawDescription from the validation hook
            let finalDescription = rawDescription.substring(0, 13000) + (rawDescription.length > 13000 ? "\n\n...(описание усечено)" : "");
            finalDescription += `\n\n**Файлы в этом PR (${selectedFiles.length}):**\n` + selectedFiles.map(f => `- \`${f.path}\``).join('\n');
            const unselectedUnnamed = parsedFiles.filter(f => f.path.startsWith('unnamed-') && !selectedFileIds.has(f.id));
            if (unselectedUnnamed.length > 0) finalDescription += `\n\n**Примечание:** ${unselectedUnnamed.length} блоков кода без имени файла не были включены.`;
            const remainingIssues = validationIssues.filter(issue => selectedFileIds.has(issue.fileId)); // Only issues in selected files
             if (remainingIssues.length > 0) { finalDescription += "\n\n**Обнаруженные Проблемы (в файлах PR):**\n"; remainingIssues.forEach(issue => { finalDescription += `- **${issue.filePath}**: ${issue.message}\n`; }); }
            const commitSubject = prTitle.substring(0, 50);
            let commitBody = `Apply AI changes to ${selectedFiles.length} files.\n\n${rawDescription.split('\n').slice(0,10).join('\n').substring(0, 1000)}...`;
            const finalCommitMessage = `${commitSubject}\n\n${commitBody}`;
            const filesToCommit = selectedFiles.map(f => ({ path: f.path, content: f.content }));

            const result = await createGitHubPullRequest( repoUrl, filesToCommit, prTitle, finalDescription, finalCommitMessage );

            if (result.success && result.prUrl) {
                toast.success(<span>Pull Request успешно создан: <a href={result.prUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">{result.prUrl}</a></span>, { duration: 10000 });
                await notifyAdmin(`Новый PR "${prTitle}" создан ${user?.username || user?.id}: ${result.prUrl}`);
                handleGetOpenPRs(); // Refresh open PR list
            } else {
                toast.error("Ошибка создания Pull Request: " + result.error, { duration: 8000 });
                console.error("PR Creation Failed:", result.error);
            }
        } catch (err: any) {
            toast.error(`Критическая ошибка при создании Pull Request: ${err?.message}`, { duration: 8000 });
            console.error("Create PR error:", err);
        } finally {
            setAssistantLoading(false);
        }
    }, [parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationStatus, validationIssues, user, setAssistantLoading, handleGetOpenPRs]); // Added validationStatus

   // Tools Menu Handler
   const handleAddCustomLink = useCallback(async () => {
       const n=prompt("Название ссылки:"); if (!n) return;
       const u=prompt("URL (начинается с https://):"); if (!u || !u.startsWith('http')) return toast.error("Неверный URL.");
       const nl={name: n, url: u}; const ul=[...customLinks,nl]; setCustomLinks(ul);
       if(user){ try{ const{data:ed}=await supabaseAdmin.from("users").select("metadata").eq("user_id",user.id).single(); await supabaseAdmin.from("users").upsert({user_id:user.id,metadata:{...(ed?.metadata||{}),customLinks:ul}},{onConflict:'user_id'}); toast.success(`Ссылка "${n}" добавлена.`);} catch(e){toast.error("Ошибка сохранения ссылки."); setCustomLinks(customLinks);}} // Revert on error
    }, [customLinks, user]);

   // --- Expose methods via ref ---
    useImperativeHandle(ref, () => ({
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles,
        handleCreatePR,
     }), [handleParse, handleSelectAllFiles, handleCreatePR]);


  // --- RENDER ---
   if (!aiResponseInputRef) {
     return <div className="p-4 bg-yellow-900 text-white rounded-lg">Загрузка контекста Ассистента...</div>;
   }

  return (
    // Use assistantLoading from context to disable inputs/buttons during main operations
    <div className="p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4 border border-gray-700/50">
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
                    ref={aiResponseInputRef} // Assign the ref from context
                    className="w-full p-3 pr-16 bg-gray-900/70 rounded-lg border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] text-sm min-h-[180px] resize-y"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Вставьте ПОЛНЫЙ ОТВЕТ от AI здесь..."
                    disabled={isParsing || assistantLoading || isFetchingOriginals}
                    spellCheck="false"
                />
                 <TextAreaUtilities
                     response={response}
                     isLoading={isParsing || assistantLoading || isFetchingOriginals}
                     onParse={handleParse}
                     onOpenModal={handleOpenModal}
                     onCopy={handleCopyResponse}
                     onClear={handleClearResponse}
                     onSelectFunction={handleSelectFunction}
                 />
            </div>
             {/* Validation Status and Actions */}
             <div className="flex flex-wrap justify-end items-start mt-1 gap-2 min-h-[30px]">
                 <CodeRestorer
                    parsedFiles={parsedFiles}
                    originalFiles={originalRepoFiles}
                    skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')}
                    onRestorationComplete={handleRestorationComplete}
                    disabled={isParsing || assistantLoading || validationStatus === 'validating' || isFetchingOriginals || originalRepoFiles.length === 0} // Also disable if originals not loaded
                 />
                 <ValidationStatusIndicator
                     status={validationStatus}
                     issues={validationIssues}
                     onAutoFix={handleAutoFix}
                     onCopyPrompt={handleCopyFixPrompt}
                     // Disable fix actions during loading
                     disabled={isParsing || assistantLoading || isFetchingOriginals}
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
             // Disable list interactions during major loading or if no files
             isLoading={isParsing || assistantLoading || isFetchingOriginals}
             isDisabled={parsedFiles.length === 0}
         />

         {/* PR Form */}
         <PullRequestForm
             repoUrl={repoUrl}
             prTitle={prTitle}
             selectedFileCount={selectedFileIds.size}
             isLoading={assistantLoading} // Use context loading for main PR action
             isLoadingPrList={loadingPRs} // Use local loading for PR list fetching
             onRepoUrlChange={setRepoUrl}
             onPrTitleChange={setPrTitle}
             onCreatePR={handleCreatePR}
             onGetOpenPRs={handleGetOpenPRs}
             // Disable PR creation if no files selected, no title, during loading, or validation errors exist
             isCreateDisabled={selectedFileIds.size === 0 || !prTitle.trim() || assistantLoading || validationStatus === 'error'}
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