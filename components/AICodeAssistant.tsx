// /components/AICodeAssistant.tsx
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest
} from "@/contexts/RepoXmlPageContext";
import { createGitHubPullRequest, fetchRepoContents } from "@/app/actions_github/actions"; // Keep createGitHubPullRequest
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry } from "@/hooks/useCodeParsingAndValidation";
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { SwapModal } from './assistant_components/SwapModal';
import { CodeRestorer } from './assistant_components/CodeRestorer';
// UI & Utils
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircleInfo, FaCodeBranch, FaCodeBranch, FaGithub } from "react-icons/fa6"; // Added FaCodeBranch, FaCodeBranch, FaGithub
import clsx from "clsx";
import { saveAs } from "file-saver";

// Tooltip Component
export const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const positionClasses = {
        top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
        bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1',
        left: 'right-full top-1/2 transform -translate-y-3/4 mr-1', // Adjusted for better alignment
        right: 'left-full top-1/2 transform -translate-y-1/2 ml-1', // Adjusted for better alignment
    };
    return (
        <div className="relative inline-block group">
            <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>{children}</div>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className={clsx(
                            "absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded-lg shadow-lg w-max max-w-xs whitespace-pre-line",
                            positionClasses[position]
                        )}
                    >
                        {text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
Tooltip.displayName = 'Tooltip';

// Interfaces
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {}
interface OriginalFile { path: string; content: string; }

// Helper: Robust Function Selection Logic
const selectFunctionDefinition = (text: string, startIndex: number): [number, number] => {
    const declarationLineStart = text.lastIndexOf('\n', startIndex - 1) + 1;
    let braceStart = -1; let searchPos = declarationLineStart;
    let inSingleLineComment = false; let inMultiLineComment = false; let inString: '"' | "'" | null = null; let parenDepth = 0;
    // Find the opening brace {
    while(searchPos < text.length) {
        const char = text[searchPos]; const prevChar = searchPos > 0 ? text[searchPos - 1] : '';
        if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; }
        else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; }
        else if (inString) { if (char === inString && prevChar !== '\\') inString = null; }
        else if (char === '/' && prevChar === '/') { inSingleLineComment = true; }
        else if (char === '*' && prevChar === '/') { inMultiLineComment = true; }
        else if (char === '"' || char === "'") { inString = char; }
        else if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === '{' && parenDepth === 0) {
            // Check if this brace likely belongs to the function/method declaration
            const precedingText = text.substring(declarationLineStart, searchPos).trim();
            // Common patterns: ends with ')', '=>', or identifier/keyword
            if (precedingText.endsWith(')') || precedingText.endsWith('=>') || precedingText.match(/[a-zA-Z0-9_$]\s*$/)) { braceStart = searchPos; break; }
            // Handle simple method definitions like `methodName() {`
            if (precedingText.match(/[a-zA-Z0-9_$]+\s*\([^)]*\)$/)) { braceStart = searchPos; break; }
        }
        // Heuristic: If we hit the start of another potential top-level declaration, stop searching for opening brace
        if (char === '\n' && text.substring(searchPos + 1).match(/^\s*(?:async\s+|function\s+|const\s+|let\s+|var\s+|class\s+|get\s+|set\s+|[a-zA-Z0-9_$]+\s*\(|\/\/|\/\*)/)) { if (braceStart === -1) break; } // Stop if no opening brace found yet
        searchPos++;
    }
    if (braceStart === -1) return [-1, -1]; // Opening brace not found

    // Find the matching closing brace }
    let depth = 1; let pos = braceStart + 1;
    inSingleLineComment = false; inMultiLineComment = false; inString = null;
    while (pos < text.length && depth > 0) {
        const char = text[pos]; const prevChar = pos > 0 ? text[pos - 1] : '';
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
    if (depth !== 0) return [-1,-1]; // Matching closing brace not found

    const closingBracePos = pos - 1;
    // Extend selection to the end of the line containing the closing brace
    let closingLineEnd = text.indexOf('\n', closingBracePos);
    if (closingLineEnd === -1) closingLineEnd = text.length; // If it's the last line
    return [declarationLineStart, closingLineEnd];
};

// Helper: Extract Function Name
const extractFunctionName = (line: string): string | null => {
    // Match function declarations, const/let assignments to functions/arrows
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?\s*([a-zA-Z0-9_$]+)\s*(?:[:=(]|\s*=>)/);
    if (funcMatch && funcMatch[1]) return funcMatch[1];
    // Match class methods (excluding keywords like if, for, while, etc.)
    const methodMatch = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/);
    if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) return methodMatch[1];
    return null;
};

// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    // --- Hooks ---
    const { user } = useAppContext();
    const {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues,
        setParsedFiles, setValidationStatus, setValidationIssues
    } = useCodeParsingAndValidation();

    // --- Context Access ---
    const {
        aiResponseInputRef,
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        setAssistantLoading, // General assistant loading state setter
        assistantLoading, // General assistant loading state
        aiActionLoading, // Specific AI generation loading state
        openPrs: contextOpenPrs, // Use for display in OpenPrList
        targetBranchName, // Read the final target branch for CodeRestorer & PR logic
        triggerToggleSettingsModal, // Trigger to open/close the modal in Fetcher
        triggerUpdateBranch, // Trigger for the updateBranch action
        updateRepoUrlInAssistant, // Callback to notify context/Fetcher of URL change
        loadingPrs, // Get PR loading state for disabling buttons
    } = useRepoXmlPageContext();

    // --- State ---
    const [response, setResponse] = useState<string>(""); // Local state for the AI response textarea
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set()); // IDs of files selected for PR/Update
    const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest"); // Local state for PR form URL input
    const [prTitle, setPrTitle] = useState<string>(""); // Local state for PR title input
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]); // User-defined links
    const [showModal, setShowModal] = useState(false); // State for Find/Replace modal
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace'); // Mode for Find/Replace modal
    const [isProcessingPR, setIsProcessingPR] = useState(false); // Combined loading state for Create/Update PR actions
    const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]); // State for original file content used by CodeRestorer
    const [isFetchingOriginals, setIsFetchingOriginals] = useState(false); // Loading state specifically for fetching originals

    // --- Helper ---
    const extractPRTitleHint = (text: string): string => {
        const lines = text.split('\n');
        // Find the first non-empty line, use it as a hint, limit length
        const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update";
        return firstLine.trim().substring(0, 70);
    };

    // --- Effects ---
    // Sync AI response textarea content with context flag
    useEffect(() => {
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        // Reset downstream states if response is cleared
        if (!hasContent) {
            setFilesParsed(false);
            setSelectedAssistantFiles(new Set());
            setValidationStatus('idle');
            setValidationIssues([]);
            setOriginalRepoFiles([]); // Clear originals if response is cleared
        } else {
            // If response has content but no files are parsed yet (and not currently parsing/loading), reset validation status
            if (parsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading) {
                setValidationStatus('idle');
                setValidationIssues([]);
            }
        }
    }, [response, parsedFiles.length, isParsing, assistantLoading, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    // Load custom links from Supabase on user change
    useEffect(() => {
        const loadLinks = async () => {
            if (!user) { setCustomLinks([]); return; }
            try {
                const { data: userData, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                if (!error && userData?.metadata?.customLinks) {
                    setCustomLinks(userData.metadata.customLinks);
                } else {
                    setCustomLinks([]);
                }
            } catch (e) { console.error("Error loading links:", e); setCustomLinks([]); }
        };
        loadLinks();
    }, [user]);

    // Fetch original file contents if needed for CodeRestorer
    const skippedCodeBlockIssues = validationIssues.filter(i => i.type === 'skippedCodeBlock');
    useEffect(() => {
        // Fetch only if there are skipped blocks, originals aren't loaded, not already fetching, and repoUrl is set
        if (skippedCodeBlockIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) {
            const fetchOriginals = async () => {
                setIsFetchingOriginals(true);
                // Use the currently targeted branch from context
                const branch = targetBranchName ?? 'default';
                toast.info(`Загрузка оригиналов из ветки ${branch}...`);
                try {
                    // Pass targetBranchName to fetchRepoContents
                    const result = await fetchRepoContents(repoUrl, undefined, targetBranchName);
                    if (result.success && Array.isArray(result.files)) {
                        setOriginalRepoFiles(result.files);
                        toast.success("Оригиналы загружены.");
                    } else {
                        toast.error("Ошибка загрузки оригиналов: " + (result.error ?? 'Unknown error'));
                        setOriginalRepoFiles([]);
                    }
                } catch (error) {
                    toast.error("Крит. ошибка загрузки оригиналов.");
                    console.error("Fetch originals error:", error);
                    setOriginalRepoFiles([]);
                } finally {
                    setIsFetchingOriginals(false);
                }
            };
            fetchOriginals();
        }
    // Depend on targetBranchName: refetch if target branch changes and restoration is needed
    }, [skippedCodeBlockIssues.length, originalRepoFiles.length, isFetchingOriginals, repoUrl, targetBranchName]);


    // --- Handlers ---

    // Parse AI response content
    const handleParse = useCallback(async () => {
        setOriginalRepoFiles([]); // Clear old originals before parsing new response
        const { files: newlyParsedFiles, rawDescription: parsedRawDescription } = await parseAndValidateResponse(response);
        setFilesParsed(newlyParsedFiles.length > 0);
        // Auto-select all newly parsed files
        const initialSelection = new Set(newlyParsedFiles.map(f => f.id));
        setSelectedFileIds(initialSelection);
        setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));
        // Generate PR title hint
        if (newlyParsedFiles.length > 0) {
            setPrTitle(extractPRTitleHint(parsedRawDescription || response));
        } else {
            setPrTitle('');
        }
    }, [response, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles]); // Removed setOriginalRepoFiles dependency

    // Auto-fix validation issues
    const handleAutoFix = useCallback(() => {
        // The hook now handles state updates internally upon returning updated files
        autoFixIssues(parsedFiles, validationIssues);
    }, [autoFixIssues, parsedFiles, validationIssues]);

    // Copy prompt for fixing skipped comments ('// ...')
    const handleCopyFixPrompt = useCallback(() => {
        const skipped = validationIssues.filter(i => i.type === 'skippedComment');
        if (skipped.length === 0) {
            toast.info("Нет маркеров '// ...' для исправления.");
            return;
        }
        const fileList = skipped.map(i => `- ${i.filePath} (~ строка ${i.details?.lineNumber})`).join('\n');
        const prompt = `Пожалуйста, объедини новые версии файлов с моими текущими, восстановив пропущенные части (отмеченные как '// ...') в новых файлах, используя старые файлы из контекста ниже как референс:\n${fileList}\n\nПредоставь полные новые версии без пропуска частей.`;
        navigator.clipboard.writeText(prompt)
            .then(() => toast.success("Prompt для исправления пропусков скопирован!"))
            .catch(() => toast.error("Ошибка копирования промпта."));
    }, [validationIssues]);

    // Callback after CodeRestorer finishes
    const handleRestorationComplete = useCallback((updatedFiles: FileEntry[], successCount: number, errorCount: number) => {
        setParsedFiles(updatedFiles);
        // Remove 'skippedCodeBlock' issues that were potentially restored
        const remainingIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock');
        setValidationIssues(remainingIssues);
        // Update validation status based on remaining issues
        setValidationStatus(remainingIssues.length > 0
            ? (remainingIssues.some(i=>!i.fixable && !i.restorable)? 'error':'warning') // Error if unfixable remain, else warning
            : 'success'); // Success if no issues remain
    }, [validationIssues, setParsedFiles, setValidationIssues, setValidationStatus]);

    // --- Text Area Utility Handlers ---
    const handleClearResponse = useCallback(() => { setResponse(""); toast.info("Поле ответа очищено."); }, []);
    const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(()=>toast.success("Скопировано!")).catch(()=>{toast.error("Ошибка копирования")});}, [response]);
    const handleOpenModal = useCallback((mode: 'replace' | 'search') => { setModalMode(mode); setShowModal(true); }, []);

    // --- Swap/Search Handlers ---
    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find) return;
        const textarea = aiResponseInputRef.current;
        if (!textarea) return;
        try {
            const currentValue = textarea.value;
            const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
            const regex = new RegExp(escapedFind, 'g');
            const newValue = currentValue.replace(regex, replace);

            if (newValue !== currentValue) {
                setResponse(newValue); // Update local state
                // Force textarea update (sometimes needed)
                requestAnimationFrame(() => { if (aiResponseInputRef.current) aiResponseInputRef.current.value = newValue; });
                // Reset downstream state as content changed
                setParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set());
                setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]);
                toast.success(`"${find}" заменен на "${replace}". Нажмите '➡️' для перепроверки.`);
            } else {
                toast.info(`"${find}" не найден.`);
            }
        } catch (e: any) { toast.error(`Ошибка замены: ${e.message}`); console.error("Swap Error:", e); }
    }, [aiResponseInputRef, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]); // Dependencies

    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText) { toast.warn("Введите текст для поиска."); return; }
        const textarea = aiResponseInputRef.current;
        if (!textarea) return;
        const text = textarea.value;

        if (isMultiline) { // Magic Swap Logic
            const cleanedSearchText = searchText.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
            if (!cleanedSearchText) { toast.error("Вставленный текст пуст после очистки."); return; }
            const firstLine = cleanedSearchText.split('\n')[0];
            const functionName = extractFunctionName(firstLine);
            if (!functionName) { toast.error("Не удалось извлечь имя функции из вставленного текста."); return; }

            // Find function declaration/definition
            const functionRegex = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${functionName}\\s*(?:\\(|[:=]|<)`, 'm');
            let match = functionRegex.exec(text);
            if (!match) { // Try finding class methods
                const methodRegex = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${functionName}\\s*\\(`, 'm');
                match = methodRegex.exec(text);
            }
            if (!match) { toast.info(`Функция "${functionName}" не найдена в текущем коде.`); return; }

            const matchIndex = match.index + match[1].length; // Start index of function name/keyword
            const [startPos, endPos] = selectFunctionDefinition(text, matchIndex);
            if (startPos === -1 || endPos === -1) { toast.error("Не удалось корректно выделить функцию для замены (проверьте скобки/комментарии)."); return; }

            // Perform replacement
            const newValue = text.substring(0, startPos) + cleanedSearchText + text.substring(endPos);
            setResponse(newValue); // Update state

            // Update textarea and selection
            requestAnimationFrame(() => {
                 if (aiResponseInputRef.current) {
                    aiResponseInputRef.current.value = newValue;
                    aiResponseInputRef.current.focus();
                    aiResponseInputRef.current.setSelectionRange(startPos, startPos + cleanedSearchText.length);
                 }
            });

            // Reset downstream state
            setParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set());
            setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]);
            toast.success(`Функция "${functionName}" заменена! ✨ Нажмите '➡️'.`);

        } else { // Single-line Search Logic
            const searchLower = searchText.toLowerCase();
            const textLower = text.toLowerCase();
            const cursorPos = textarea.selectionStart || 0;
            let searchFrom = cursorPos; // Start search from cursor position
            let index = textLower.indexOf(searchLower, searchFrom);

            if (index === -1) { // If not found after cursor, wrap around
                 index = textLower.indexOf(searchLower, 0); // Search from beginning
                 if (index === -1 || index >= cursorPos) { // Not found anywhere, or only found after original cursor pos (no wrap needed)
                      toast.info(`"${searchText}" не найден.`);
                      textarea.focus();
                      return;
                 }
                 toast.info("Поиск достиг начала документа."); // Indicate wrap-around
            }

            // Found the text
            textarea.focus();
            textarea.setSelectionRange(index, index + searchText.length);
            toast(`Найдено: "${searchText}"`, {
                style: { background: "rgba(30, 64, 175, 0.9)", color:"#ffffff", border:"1px solid rgba(37, 99, 235, 0.3)", backdropFilter:"blur(3px)" },
                duration: 2000
            });
        }
    }, [aiResponseInputRef, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]); // Dependencies

    // Select current function based on cursor position
    const handleSelectFunction = useCallback(() => {
        const textarea = aiResponseInputRef.current;
        if (!textarea) return;
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        let lineStartIndex = text.lastIndexOf('\n', cursorPos - 1) + 1; // Start of the current line

        const [startPos, endPos] = selectFunctionDefinition(text, lineStartIndex);
        if (startPos !== -1 && endPos !== -1) {
            textarea.focus();
            textarea.setSelectionRange(startPos, endPos);
            toast.success("Функция выделена!");
        } else {
             // Try searching backwards slightly in case cursor is just after closing brace
             let searchBackIndex = text.lastIndexOf('{', lineStartIndex); // Find nearest opening brace before current line
             if (searchBackIndex > 0) {
                  const [startPosBack, endPosBack] = selectFunctionDefinition(text, searchBackIndex);
                  if (startPosBack !== -1 && endPosBack !== -1) {
                     textarea.focus();
                     textarea.setSelectionRange(startPosBack, endPosBack);
                     toast.success("Функция выделена (найдена выше)!");
                     return; // Found it searching back
                  }
             }
             toast.info("Не удалось выделить функцию. Убедитесь, что курсор в строке с объявлением или внутри функции.");
             textarea.focus();
        }
    }, [aiResponseInputRef]);

    // --- File List & Utility Handlers ---
    const handleToggleFileSelection = useCallback((fileId: string) => {
        setSelectedFileIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) newSet.delete(fileId);
            else newSet.add(fileId);
            // Update context set of selected paths
            const selectedPaths = new Set(
                Array.from(newSet).map(id => parsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[]
            );
            setSelectedAssistantFiles(selectedPaths);
            return newSet;
        });
    }, [parsedFiles, setSelectedAssistantFiles]);

    const handleSelectAllFiles = useCallback(() => {
        const allIds = new Set(parsedFiles.map(f => f.id));
        const allPaths = new Set(parsedFiles.map(f => f.path));
        setSelectedFileIds(allIds);
        setSelectedAssistantFiles(allPaths);
        if (allIds.size > 0) toast.info(`${allIds.size} файлов выбрано.`);
    }, [parsedFiles, setSelectedAssistantFiles]);

    const handleDeselectAllFiles = useCallback(() => {
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        toast.info("Выделение снято.");
    }, [setSelectedAssistantFiles]);

    const handleSaveFiles = useCallback(async () => {
        if (!user) return;
        const filesToSave = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToSave.length === 0) return;
        setIsProcessingPR(true); // Use general PR processing flag for UI feedback
        try {
            const fileData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension }));
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // Ignore "not found" error, handle others
            const existingFiles = existingData?.metadata?.generated_files || [];
            const newPaths = new Set(fileData.map(f => f.p));
            // Merge: Keep old files not in the new set, add/overwrite new files
            const mergedFiles = [
                ...existingFiles.filter((f: any) => !newPaths.has(f.path)),
                ...fileData.map(f => ({ path: f.p, code: f.c, extension: f.e }))
            ];
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({
                user_id: user.id,
                metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles }
            }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`${filesToSave.length} файлов сохранено в вашем профиле!`);
        } catch (err) {
            toast.error("Ошибка сохранения файлов.");
            console.error("Save files error:", err);
        } finally {
            setIsProcessingPR(false);
        }
    }, [user, parsedFiles, selectedFileIds]);

    const handleDownloadZip = useCallback(async () => {
        const filesToZip = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToZip.length === 0) return;
        setIsProcessingPR(true);
        try {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            filesToZip.forEach((file) => zip.file(file.path, file.content));
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ai_files_${Date.now()}.zip`);
            toast.success("Архив с выбранными файлами скачан.");
        } catch (error) {
            toast.error("Ошибка при создании ZIP архива.");
            console.error("Download zip error:", error);
        } finally {
            setIsProcessingPR(false);
        }
    }, [parsedFiles, selectedFileIds]);

    const handleSendToTelegram = useCallback(async (file: FileEntry) => {
        if (!user?.id) return;
        setIsProcessingPR(true);
        try {
            const result = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt");
            if (!result.success) throw new Error(result.error ?? "Telegram send error");
            toast.success(`Файл "${file.path}" отправлен в Telegram.`);
        } catch (err: any) {
            toast.error(`Ошибка отправки файла: ${err.message}`);
            console.error("Send to telegram error:", err);
        } finally {
            setIsProcessingPR(false);
        }
    }, [user]);

    // --- Add Custom Link Handler ---
    const handleAddCustomLink = useCallback(async () => {
        const name = prompt("Название ссылки:");
        if (!name) return;
        const url = prompt("URL (начиная с https://):");
        if (!url || !url.startsWith('http')) {
            toast.error("Некорректный URL."); return;
        }
        const newLink = { name: name, url: url };
        const updatedLinks = [...customLinks, newLink];
        setCustomLinks(updatedLinks); // Optimistic UI update

        if (user) {
            try {
                const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                await supabaseAdmin.from("users").upsert({
                    user_id: user.id,
                    metadata: { ...(existingData?.metadata || {}), customLinks: updatedLinks }
                }, { onConflict: 'user_id' });
                toast.success(`Ссылка "${name}" добавлена.`);
            } catch (e) {
                toast.error("Ошибка сохранения ссылки.");
                console.error("Save custom link error:", e);
                setCustomLinks(customLinks); // Revert UI on error
            }
        }
    }, [customLinks, user]);


    // --- MODIFIED: Create or Update PR/Branch Handler ---
    const handleCreateOrUpdatePR = useCallback(async () => {
        const selectedFilesLocal = parsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFilesLocal.length === 0 || !prTitle) {
            return toast.error("Укажите URL, Заголовок PR и выберите файлы.");
        }

        // Construct description and commit message (shared logic)
        let finalDescription = rawDescription.substring(0, 60000) + (rawDescription.length > 60000 ? "\n\n...(описание усечено)" : "");
        finalDescription += `\n\n**Файлы (${selectedFilesLocal.length}):**\n` + selectedFilesLocal.map(f => `- \`${f.path}\``).join('\n');
        const remainingIssues = validationIssues.filter(issue => issue.type !== 'skippedCodeBlock' && issue.type !== 'skippedComment');
        if (remainingIssues.length > 0) {
             finalDescription += "\n\n**Обнаруженные Проблемы:**\n" + remainingIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n');
        }
        const commitSubject = prTitle.substring(0, 70);
        let commitBody = `Apply AI changes to ${selectedFilesLocal.length} files.\nRef: ${rawDescription.split('\n')[0]?.substring(0,100) ?? ''}...`;
        const finalCommitMessage = `${commitSubject}\n\n${commitBody}`;
        const filesToCommit = selectedFilesLocal.map(f => ({ path: f.path, content: f.content }));

        setIsProcessingPR(true); // Start processing indicator
        setAssistantLoading(true); // Also set general loading

        try {
            // Check if a target branch is selected (either from PR or manually)
            if (targetBranchName) {
                // --- UPDATE EXISTING BRANCH ---
                toast.info(`Обновление ветки '${targetBranchName}'...`);
                // Call the update trigger from context
                const result = await triggerUpdateBranch(
                    repoUrl,
                    filesToCommit,
                    finalCommitMessage,
                    targetBranchName // Pass the target branch name
                );
                // Context trigger now handles success/error toasts
                if (result.success) {
                    // Maybe add a comment to the associated PR? Needs PR number lookup.
                    // For now, just notify admin.
                    await notifyAdmin(`Ветка '${targetBranchName}' обновлена ${user?.username || user?.id}. Commit: ${commitSubject}`);
                }
                // Error is already handled and toasted by the triggerUpdateBranch callback

            } else {
                // --- CREATE NEW PR ---
                toast.info(`Создание нового PR...`);
                // Use the original createGitHubPullRequest action
                // It will create a new branch automatically.
                const result = await createGitHubPullRequest(
                    repoUrl,
                    filesToCommit,
                    prTitle,
                    finalDescription,
                    finalCommitMessage
                    // Let the action generate the new branch name
                );
                if (result.success && result.prUrl) {
                    toast.success(`PR создан: ${result.prUrl}`);
                    await notifyAdmin(`Новый PR "${prTitle}" (${result.branch}) создан ${user?.username || user?.id}: ${result.prUrl}`);
                    // Optionally trigger PR list refresh in Fetcher? Context doesn't own repoUrl directly.
                } else {
                    // Error occurred during PR creation
                    toast.error("Ошибка создания PR: " + result.error);
                    console.error("PR Creation Failed:", result.error);
                    // Admin notification is handled within the action on failure
                }
            }
        } catch (err) {
            // Catch unexpected errors during the try block
            toast.error(`Критическая ошибка при ${targetBranchName ? 'обновлении ветки' : 'создании PR'}.`);
            console.error("Create/Update PR critical error:", err);
        } finally {
             // Ensure loading states are turned off regardless of success/failure
             setIsProcessingPR(false);
             setAssistantLoading(false);
        }
    }, [
        // Dependencies
        parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, user,
        targetBranchName, // Key dependency to decide between create/update
        triggerUpdateBranch, // Context trigger for updating
        setAssistantLoading // Context setter for loading state
        // createGitHubPullRequest is called directly if targetBranchName is null, no need to list as dep
    ]);

    // --- Imperative Handle & State Setters ---
    // Set AI response textarea value programmatically
    const setResponseValue = useCallback((value: string) => {
        setResponse(value);
        if (aiResponseInputRef.current) {
            aiResponseInputRef.current.value = value;
            // Dispatch event to ensure any listeners react
            const event = new Event('input', { bubbles: true });
            aiResponseInputRef.current.dispatchEvent(event);
        }
    }, [aiResponseInputRef]);

    // Update local repoUrl state when changed via context/Fetcher
    const updateRepoUrl = useCallback((url: string) => {
        setRepoUrl(url);
    }, []);

    // Expose methods to parent/context
    useImperativeHandle(ref, () => ({
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles,
        handleCreatePR: handleCreateOrUpdatePR, // Expose the combined handler
        setResponseValue,
        updateRepoUrl, // Expose method to update local URL state
     }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl]);


    // --- RENDER ---
    // Combined processing state for disabling UI elements
    const isProcessing = assistantLoading || aiActionLoading || isParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    // Determine if the main submit button should be enabled
    const canSubmitPR = !isProcessing && selectedFileIds.size > 0 && !!prTitle && !!repoUrl;
    // Dynamically set button text and icon based on whether updating or creating
    const prButtonText = targetBranchName ? `Обновить Ветку (${targetBranchName.substring(0, 15)}...)` : "Создать PR";
    const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />;

    return (
        <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            {/* Header with Settings Button */}
             <header className="flex justify-between items-center gap-2">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">AI Code Assistant</h1>
                     <Tooltip text={`Вставьте ответ AI ИЛИ используйте кнопку 'Спросить AI'. Затем '➡️' → Проверьте/Исправьте → Выберите файлы → ${targetBranchName ? 'Обновить Ветку' : 'Создать PR'}`} position="bottom">
                         <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
                     </Tooltip>
                 </div>
                 {/* Settings Toggle Button */}
                 <Tooltip text="Настройки URL/Token/Ветки/PR" position="left">
                      <button
                         id="settings-modal-trigger-assistant" // ID for scrolling target
                         onClick={triggerToggleSettingsModal} // Use context trigger
                         className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50"
                         disabled={isProcessing} // Disable if any processing is happening
                      >
                          <FaCodeBranch className="text-xl" />
                      </button>
                 </Tooltip>
             </header>

            {/* AI Response Input Area */}
             <div>
                 <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 2️⃣ Ответ от AI появится здесь (или вставьте вручную). Затем нажмите '➡️'. </p>
                 <div className="relative group">
                     <textarea
                         id="response-input"
                         ref={aiResponseInputRef}
                         className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                         value={response}
                         onChange={(e) => setResponse(e.target.value)}
                         placeholder="Ответ от AI появится здесь..."
                         disabled={isProcessing}
                         spellCheck="false"
                     />
                     <TextAreaUtilities
                         response={response}
                         isLoading={isProcessing}
                         onParse={handleParse}
                         onOpenModal={handleOpenModal}
                         onCopy={handleCopyResponse}
                         onClear={handleClearResponse}
                         onSelectFunction={handleSelectFunction}
                     />
                 </div>
                 {/* Validation Status and Code Restorer */}
                 <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                      <CodeRestorer
                         parsedFiles={parsedFiles}
                         originalFiles={originalRepoFiles}
                         skippedIssues={skippedCodeBlockIssues}
                         onRestorationComplete={handleRestorationComplete}
                         disabled={isProcessing || validationStatus === 'validating'}
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
                 isLoading={isProcessing}
             />

             {/* PR Form - Updated with dynamic button props */}
             <PullRequestForm
                 repoUrl={repoUrl}
                 prTitle={prTitle}
                 selectedFileCount={selectedFileIds.size}
                 isLoading={isProcessingPR} // Pass the specific PR processing state
                 onRepoUrlChange={(url) => {
                     setRepoUrl(url); // Update local state
                     updateRepoUrlInAssistant(url); // Notify context/Fetcher
                 }}
                 onPrTitleChange={setPrTitle}
                 onCreatePR={handleCreateOrUpdatePR} // Use the combined handler
                 // Pass new props for button text/icon/disabled state
                 buttonText={prButtonText}
                 buttonIcon={prButtonIcon}
                 isSubmitDisabled={!canSubmitPR} // Pass calculated disabled state
             />

             {/* Open PR List (Display Only - uses context data) */}
             <OpenPrList openPRs={contextOpenPrs} />

             {/* Tools Menu */}
             <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />

             {/* Modals (Find/Replace) */}
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