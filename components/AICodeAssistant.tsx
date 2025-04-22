"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask // Import ImageReplaceTask
} from "@/contexts/RepoXmlPageContext";
import { createGitHubPullRequest, updateBranch, fetchRepoContents } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry, ValidationStatus } from "@/hooks/useCodeParsingAndValidation";
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { ImageToolsModal } from './assistant_components/ImageToolsModal';
import { SwapModal } from './assistant_components/SwapModal';
import { CodeRestorer } from './assistant_components/CodeRestorer';
// UI & Utils
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate, FaImage } from "react-icons/fa6";
import clsx from "clsx";
import { saveAs } from "file-saver";
import { logger } from "@/lib/logger"; // Import logger

// Tooltip Component (Assuming it's defined or imported correctly)
export const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => { const [isVisible, setIsVisible] = useState(false); const positionClasses = { top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1', bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1', left: 'right-full top-1/2 transform -translate-y-3/4 mr-1', right: 'left-full top-1/2 transform -translate-y-1/2 ml-1', }; return ( <div className="relative inline-block group"> <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>{children}</div> <AnimatePresence> {isVisible && ( <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }} className={clsx("absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded-lg shadow-lg w-max max-w-xs whitespace-pre-line", positionClasses[position])}> {text} </motion.div> )} </AnimatePresence> </div> ); }; Tooltip.displayName = 'Tooltip';

// Interfaces
interface FileEntry extends ValidationFileEntry {} // Keep local alias if needed
interface AICodeAssistantProps {}
interface OriginalFile { path: string; content: string; }

// Helper: Robust Function Selection Logic
const selectFunctionDefinition = (text: string, startIndex: number): [number, number] => { const declarationLineStart = text.lastIndexOf('\n', startIndex - 1) + 1; let braceStart = -1; let searchPos = declarationLineStart; let inSingleLineComment = false; let inMultiLineComment = false; let inString: '"' | "'" | null = null; let parenDepth = 0; while(searchPos < text.length) { const char = text[searchPos]; const prevChar = searchPos > 0 ? text[searchPos - 1] : ''; if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; } else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; } else if (inString) { if (char === inString && prevChar !== '\\') inString = null; } else if (char === '/' && prevChar === '/') { inSingleLineComment = true; } else if (char === '*' && prevChar === '/') { inMultiLineComment = true; } else if (char === '"' || char === "'") { inString = char; } else if (char === '(') parenDepth++; else if (char === ')') parenDepth--; else if (char === '{' && parenDepth === 0) { const precedingText = text.substring(declarationLineStart, searchPos).trim(); if (precedingText.endsWith(')') || precedingText.endsWith('=>') || precedingText.match(/[a-zA-Z0-9_$]\s*$/)) { braceStart = searchPos; break; } if (precedingText.match(/[a-zA-Z0-9_$]+\s*\([^)]*\)$/)) { braceStart = searchPos; break; } } if (char === '\n' && text.substring(searchPos + 1).match(/^\s*(?:async\s+|function\s+|const\s+|let\s+|var\s+|class\s+|get\s+|set\s+|[a-zA-Z0-9_$]+\s*\(|\/\/|\/\*)/)) { if (braceStart === -1) break; } searchPos++; } if (braceStart === -1) return [-1, -1]; let depth = 1; let pos = braceStart + 1; inSingleLineComment = false; inMultiLineComment = false; inString = null; while (pos < text.length && depth > 0) { const char = text[pos]; const prevChar = pos > 0 ? text[pos - 1] : ''; if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; } else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; } else if (inString) { if (char === inString && prevChar !== '\\') inString = null; } else if (char === '/' && prevChar === '/') { inSingleLineComment = true; } else if (char === '*' && prevChar === '/') { inMultiLineComment = true; } else if (char === '"' || char === "'") { inString = char; } else if (char === '{') depth++; else if (char === '}') depth--; pos++; } if (depth !== 0) return [-1,-1]; const closingBracePos = pos - 1; let closingLineEnd = text.indexOf('\n', closingBracePos); if (closingLineEnd === -1) closingLineEnd = text.length; return [declarationLineStart, closingLineEnd]; };
// Helper: Extract Function Name
const extractFunctionName = (line: string): string | null => { const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?\s*([a-zA-Z0-9_$]+)\s*(?:[:=(]|\s*=>)/); if (funcMatch && funcMatch[1]) return funcMatch[1]; const methodMatch = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/); if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) return methodMatch[1]; return null; };

// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    // --- Hooks ---
    const { user } = useAppContext();
    const {
        parsedFiles: hookParsedFiles, // Use alias for hook state
        rawDescription,
        validationStatus,
        validationIssues,
        isParsing: hookIsParsing, // Alias hook state
        parseAndValidateResponse,
        autoFixIssues,
        setParsedFiles: setHookParsedFiles, // Alias hook setter
        setValidationStatus,
        setValidationIssues,
    } = useCodeParsingAndValidation();

    // --- Context Access ---
    const {
        aiResponseInputRef,
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        setAssistantLoading,
        assistantLoading,
        aiActionLoading,
        currentAiRequestId,
        openPrs: contextOpenPrs,
        targetBranchName,
        triggerToggleSettingsModal,
        triggerUpdateBranch,
        triggerCreatePR, 
        updateRepoUrlInAssistant,
        loadingPrs,
        setIsParsing: setContextIsParsing, // Use context setter alias
        isParsing: contextIsParsing, // Use context state alias
        allFetchedFiles, // Get raw fetched files from context
        imageReplaceTask, // Get image replace task from context
    } = useRepoXmlPageContext();

    // --- State ---
    const [response, setResponse] = useState<string>("");
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
    const [prTitle, setPrTitle] = useState<string>("");
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
    const [isProcessingPR, setIsProcessingPR] = useState(false); // Renamed from isCreatingPR
    const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
    const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Combined isParsing state
    const isParsing = contextIsParsing ?? hookIsParsing;

    // Local state for parsed files, synced with the hook's state
    const [componentParsedFiles, setComponentParsedFiles] = useState<ValidationFileEntry[]>([]);
    useEffect(() => {
        setComponentParsedFiles(hookParsedFiles);
        setFilesParsed(hookParsedFiles.length > 0);
    }, [hookParsedFiles, setFilesParsed]);


    // Helper
    const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

    // --- Effects ---
    useEffect(() => {
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        if (!hasContent && !currentAiRequestId && !aiActionLoading) {
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]);
        } else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading) {
            setValidationStatus('idle'); setValidationIssues([]);
        }
    }, [ response, currentAiRequestId, aiActionLoading, componentParsedFiles.length, isParsing, assistantLoading, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setHookParsedFiles ]);

    useEffect(() => {
        const loadLinks = async () => { if (!user) { setCustomLinks([]); return; } try { const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!e && d?.metadata?.customLinks) setCustomLinks(d.metadata.customLinks); else setCustomLinks([]); } catch (e) { console.error("Error loading custom links:", e); setCustomLinks([]); } }; loadLinks();
    }, [user]);

    const skippedCodeBlockIssues = useMemo(() => validationIssues.filter(i => i.type === 'skippedCodeBlock'), [validationIssues]);
    useEffect(() => {
        if (skippedCodeBlockIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) { const fetchOriginals = async () => { setIsFetchingOriginals(true); const branch = targetBranchName ?? undefined; const branchDisplay = targetBranchName ?? 'default'; toast.info(`Загрузка оригиналов из ветки ${branchDisplay}...`); try { const result = await fetchRepoContents(repoUrl, undefined, branch); if (result.success && Array.isArray(result.files)) { setOriginalRepoFiles(result.files); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (result.error ?? '?')); setOriginalRepoFiles([]); } } catch (e) { toast.error("Крит. ошибка при загрузке оригиналов."); logger.error("Fetch originals critical error:", e); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOriginals(); }
    }, [skippedCodeBlockIssues.length, originalRepoFiles.length, isFetchingOriginals, repoUrl, targetBranchName]);

    // --- Handlers ---
    const handleParse = useCallback(async () => {
        setContextIsParsing(true); setOriginalRepoFiles([]);
        try {
            const { files: newlyParsedFiles, description: parsedRawDescription } = await parseAndValidateResponse(response);
            setHookParsedFiles(newlyParsedFiles); const initialSelection = new Set(newlyParsedFiles.map(f => f.id)); setSelectedFileIds(initialSelection); setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));
            if (newlyParsedFiles.length > 0) { setPrTitle(extractPRTitleHint(parsedRawDescription || response)); } else { setPrTitle(''); }
        } catch (error) { logger.error("Error during parseAndValidateResponse:", error); toast.error("Ошибка разбора ответа AI."); setFilesParsed(false); setHookParsedFiles([]); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('error'); setValidationIssues([{type: 'parseError', message: 'Ошибка парсинга ответа.', fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A'}]); }
        finally { setContextIsParsing(false); }
    }, [response, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setValidationStatus, setValidationIssues, setHookParsedFiles]);

    const handleAutoFix = useCallback(() => { autoFixIssues(componentParsedFiles, validationIssues); }, [autoFixIssues, componentParsedFiles, validationIssues]);

    const handleCopyFixPrompt = useCallback(() => { const skipped = validationIssues.filter(i => i.type === 'skippedComment'); if (skipped.length === 0) { toast.info("Нет маркеров '// ..''.' для исправления."); return; } const fileList = skipped.map(i => `- ${i.filePath} (~ строка ${i.details?.lineNumber})`).join('\n'); const prompt = `Восстанови пропуски ('// ..''.') в новых файлах, используя старые как референс:\n${fileList}\n\nВерни полные новые версии файлов.`; navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt для исправления пропусков скопирован!")).catch(() => toast.error("Ошибка копирования промпта.")); }, [validationIssues]);

    const handleRestorationComplete = useCallback((updatedFiles: ValidationFileEntry[], successCount: number, errorCount: number) => { setHookParsedFiles(updatedFiles); const remainingIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); setValidationIssues(remainingIssues); setValidationStatus(remainingIssues.length > 0 ? (remainingIssues.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success'); if (successCount > 0) toast.success(`${successCount} блоков восстановлено.`); if (errorCount > 0) toast.error(`${errorCount} блоков не удалось восстановить.`); }, [validationIssues, setHookParsedFiles, setValidationIssues, setValidationStatus]);

    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => { logger.log("AICodeAssistant: handleUpdateParsedFiles called with", updatedFiles.length, "files"); setHookParsedFiles(updatedFiles); toast.info("Файлы обновлены после замены плейсхолдеров картинок."); setValidationStatus('idle'); setValidationIssues([]); }, [setHookParsedFiles, setValidationStatus, setValidationIssues]);

    const handleClearResponse = useCallback(() => { setResponse(""); if (aiResponseInputRef.current) { aiResponseInputRef.current.value = ""; } toast.info("Поле ответа очищено."); }, [aiResponseInputRef]);

    const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(() => toast.success("Скопировано!")).catch(() => {toast.error("Ошибка копирования")}); }, [response]);

    const handleOpenModal = useCallback((mode: 'replace' | 'search') => { setModalMode(mode); setShowModal(true); }, []);

    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find || !aiResponseInputRef.current) return; try { const textArea = aiResponseInputRef.current; const currentValue = textArea.value; const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(escapedFind, 'g'); const newValue = currentValue.replace(regex, replace); if (newValue !== currentValue) { setResponse(newValue); requestAnimationFrame(() => { if (aiResponseInputRef.current) aiResponseInputRef.current.value = newValue; }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`"${find}" -> "${replace}". Жми '➡️'.`); } else { toast.info(`"${find}" не найден.`); } } catch (e: any) { toast.error(`Ошибка замены: ${e.message}`); }
    }, [aiResponseInputRef, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText || !aiResponseInputRef.current) return; const textArea = aiResponseInputRef.current; const textContent = textArea.value;
        if (isMultiline) { const cleanedSearchText = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n'); if (!cleanedSearchText) { toast.error("Текст для мультилайн поиска пуст."); return; } const firstLine = cleanedSearchText.split('\n')[0]; const funcName = extractFunctionName(firstLine ?? ''); if (!funcName) { toast.error("Не удалось извлечь имя функции из первой строки для поиска."); return; } const funcRegex = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${funcName}\\s*(?:\\(|[:=]|<)`, 'm'); let match = funcRegex.exec(textContent); if (!match) { const methodRegex = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${funcName}\\s*\\(`, 'm'); match = methodRegex.exec(textContent); } if (!match || match.index === undefined) { toast.info(`Функция "${funcName}" не найдена.`); return; } const matchStartIndex = match.index + (match[1]?.length || 0); const [startPos, endPos] = selectFunctionDefinition(textContent, matchStartIndex); if (startPos === -1 || endPos === -1) { toast.error("Не удалось выделить тело найденной функции."); return; } const newValue = textContent.substring(0, startPos) + cleanedSearchText + textContent.substring(endPos); setResponse(newValue); requestAnimationFrame(() => { if (aiResponseInputRef.current) { aiResponseInputRef.current.value = newValue; aiResponseInputRef.current.focus(); aiResponseInputRef.current.setSelectionRange(startPos, startPos + cleanedSearchText.length); } }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`Функция "${funcName}" заменена! ✨ Жми '➡️'.`);
        } else { const searchTextLower = searchText.toLowerCase(); const textContentLower = textContent.toLowerCase(); const currentPosition = textArea.selectionStart || 0; let foundIndex = textContentLower.indexOf(searchTextLower, currentPosition); if (foundIndex === -1) { foundIndex = textContentLower.indexOf(searchTextLower, 0); if (foundIndex === -1 || foundIndex >= currentPosition) { toast.info(`"${searchText}" не найден.`); textArea.focus(); return; } toast.info("Поиск с начала документа."); } textArea.focus(); textArea.setSelectionRange(foundIndex, foundIndex + searchText.length); toast(`Найдено: "${searchText}"`, { style: { background: "rgba(30, 64, 175, 0.9)", color: "#fff", border: "1px solid rgba(37, 99, 235, 0.3)", backdropFilter: "blur(3px)" }, duration: 2000 }); }
    }, [aiResponseInputRef, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const handleSelectFunction = useCallback(() => { const textArea = aiResponseInputRef.current; if (!textArea) return; const textContent = textArea.value; const cursorPos = textArea.selectionStart || 0; const lineStartIndex = textContent.lastIndexOf('\n', cursorPos - 1) + 1; const [startPos, endPos] = selectFunctionDefinition(textContent, lineStartIndex); if (startPos !== -1 && endPos !== -1) { textArea.focus(); textArea.setSelectionRange(startPos, endPos); toast.success("Функция выделена!"); } else { let searchUpIndex = textContent.lastIndexOf('{', lineStartIndex); if (searchUpIndex > 0) { const [upStartPos, upEndPos] = selectFunctionDefinition(textContent, searchUpIndex); if (upStartPos !== -1 && upEndPos !== -1) { textArea.focus(); textArea.setSelectionRange(upStartPos, upEndPos); toast.success("Функция найдена выше!"); return; } } toast.info("Не удалось выделить функцию."); textArea.focus(); } }, [aiResponseInputRef]);

    const handleToggleFileSelection = useCallback((fileId: string) => {
        setSelectedFileIds(prev => { const newSet = new Set(prev); if (newSet.has(fileId)) newSet.delete(fileId); else newSet.add(fileId); const selectedPaths = new Set( Array.from(newSet).map(id => componentParsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[] ); setSelectedAssistantFiles(selectedPaths); return newSet; });
    }, [componentParsedFiles, setSelectedAssistantFiles]);

    const handleSelectAllFiles = useCallback(() => { const allIds = new Set(componentParsedFiles.map(f => f.id)); const allPaths = new Set(componentParsedFiles.map(f => f.path)); setSelectedFileIds(allIds); setSelectedAssistantFiles(allPaths); if (allIds.size > 0) toast.info(`${allIds.size} файлов выбрано.`); }, [componentParsedFiles, setSelectedAssistantFiles]);

    const handleDeselectAllFiles = useCallback(() => { setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); toast.info("Выделение снято."); }, [setSelectedAssistantFiles]);

    const handleSaveFiles = useCallback(async () => { if (!user) return; const filesToSave = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (filesToSave.length === 0) return; setIsProcessingPR(true); try { const fileData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension })); const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; const existingFiles = existingData?.metadata?.generated_files || []; const newPaths = new Set(fileData.map(f => f.p)); const mergedFiles = [ ...existingFiles.filter((f: any) => !newPaths.has(f.path)), ...fileData.map(f => ({ path: f.p, code: f.c, extension: f.e })) ]; const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles } }, { onConflict: 'user_id' }); if (upsertError) throw upsertError; toast.success(`${filesToSave.length} файлов сохранено в вашем профиле!`); } catch (err) { toast.error("Ошибка сохранения файлов."); logger.error("Save files error:", err); } finally { setIsProcessingPR(false); } }, [user, componentParsedFiles, selectedFileIds]);

    const handleDownloadZip = useCallback(async () => { const filesToZip = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (filesToZip.length === 0) return; setIsProcessingPR(true); try { const JSZip = (await import("jszip")).default; const zip = new JSZip(); filesToZip.forEach((f) => zip.file(f.path.startsWith('/') ? f.path.substring(1) : f.path, f.content)); const blob = await zip.generateAsync({ type: "blob" }); saveAs(blob, `ai_files_${Date.now()}.zip`); toast.success("Архив скачан."); } catch (error) { toast.error("Ошибка создания ZIP."); logger.error("ZIP download error:", error); } finally { setIsProcessingPR(false); } }, [componentParsedFiles, selectedFileIds]);

    const handleSendToTelegram = useCallback(async (file: FileEntry) => { if (!user?.id) return; setIsProcessingPR(true); try { const result = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt"); if (!result.success) throw new Error(result.error ?? "TG Send Error"); toast.success(`"${file.path}" отправлен в ваш Telegram.`); } catch (err: any) { toast.error(`Ошибка отправки TG: ${err.message}`); logger.error("Send to TG error:", err); } finally { setIsProcessingPR(false); } }, [user]);

    const handleAddCustomLink = useCallback(async () => { const name = prompt("Название ссылки:"); if (!name) return; const url = prompt("URL (начиная с https://):"); if (!url || !url.startsWith('http')) { toast.error("Некорректный URL."); return; } const newLink = { name: name, url: url }; const updatedLinks = [...customLinks, newLink]; setCustomLinks(updatedLinks); if (user) { try { const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), customLinks: updatedLinks } }, { onConflict: 'user_id' }); toast.success(`Ссылка "${name}" добавлена.`); } catch (e) { toast.error("Ошибка сохранения ссылки."); logger.error("Save custom link error:", e); setCustomLinks(customLinks); } } }, [customLinks, user]);

    // --- MODIFIED: Combined PR/Update Handler ---
    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => {
        // Only use PARSED files for regular PR/Update
        const selectedFilesContent = componentParsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFilesContent.length === 0 || !prTitle) {
            toast.error("Укажите URL репо, Заголовок PR/Commit и выберите файлы (после разбора ➡️).");
            return;
        }

        let finalDescription = rawDescription.substring(0, 60000) + (rawDescription.length > 60000 ? "\n\n...(описание усечено)" : "");
        finalDescription += `\n\n**Файлы (${selectedFilesContent.length}):**\n` + selectedFilesContent.map(f => `- \`${f.path}\``).join('\n');
        const relevantIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment');
        if (relevantIssues.length > 0) { finalDescription += "\n\n**Обнаруженные Проблемы:**\n" + relevantIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); }
        const commitSubject = prTitle.substring(0, 70);
        const commitBody = `Apply AI changes to ${selectedFilesContent.length} files.\nRef: ${rawDescription.split('\n')[0]?.substring(0, 100) ?? ''}...`;
        const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
        const filesToCommit = selectedFilesContent.map(f => ({ path: f.path, content: f.content }));

        setIsProcessingPR(true); setAssistantLoading(true);

        try {
            if (targetBranchName) {
                // Update Existing Branch
                toast.info(`Обновление ветки '${targetBranchName}'...`);
                const result = await triggerUpdateBranch(repoUrl, filesToCommit, fullCommitMessage, targetBranchName);
                // Toasts handled by context triggerUpdateBranch
            } else {
                // Create New Pull Request (Use context trigger which calls the action)
                toast.info(`Создание нового PR...`);
                await triggerCreatePR(); // Calls the combined handler via context
            }
        } catch (err) {
            toast.error(`Критическая ошибка при ${targetBranchName ? 'обновлении ветки' : 'создании PR'}.`); logger.error("PR/Update critical error:", err);
        } finally { setIsProcessingPR(false); setAssistantLoading(false); }
    }, [ componentParsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, targetBranchName, triggerUpdateBranch, setAssistantLoading, user, triggerCreatePR ]); 


    // --- NEW: Direct Image Replacement Handler ---
    const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask): Promise<void> => {
        console.log("AICodeAssistant: handleDirectImageReplace called with task:", task);
        setIsProcessingPR(true); setAssistantLoading(true); // Indicate processing

        try {
            // 1. Find the target file content from allFetchedFiles (via context)
            const targetFile = allFetchedFiles.find(f => f.path === task.targetPath);
            if (!targetFile) { throw new Error(`Целевой файл "${task.targetPath}" не найден среди загруженных.`); }

            // 2. Perform replacement
            let currentContent = targetFile.content;
            if (!currentContent.includes(task.oldUrl)) { toast.warn(`Старый URL картинки не найден в файле ${task.targetPath}. Изменений не будет.`); setIsProcessingPR(false); setAssistantLoading(false); return; }
            const modifiedContent = currentContent.replaceAll(task.oldUrl, task.newUrl);
            if (modifiedContent === currentContent) { toast.info(`Контент файла ${task.targetPath} не изменился после замены.`); setIsProcessingPR(false); setAssistantLoading(false); return; }

            console.log(`Performing replacement in ${task.targetPath}. Old URL length: ${task.oldUrl.length}, New URL length: ${task.newUrl.length}`);

            // 3. Prepare data for GitHub action
            const filesToCommit: { path: string; content: string }[] = [{ path: task.targetPath, content: modifiedContent }];
            const commitTitle = `chore: Update image in ${task.targetPath}`;
            const commitBody = `Replaced image via SuperVibe Studio.\n\nOld: ${task.oldUrl}\nNew: ${task.newUrl}`;
            const fullCommitMessage = `${commitTitle}\n\n${commitBody}`;
            const prTitle = commitTitle;
            const prDescription = commitBody;

            // 4. Call GitHub action (Update branch or Create PR)
            if (targetBranchName) {
                toast.info(`Обновление ветки '${targetBranchName}' (замена картинки)...`);
                const result = await triggerUpdateBranch(repoUrl, filesToCommit, fullCommitMessage, targetBranchName); // Use context trigger
                if (result.success) toast.success(`Ветка '${targetBranchName}' обновлена (картинка)!`);
                else toast.error(`Ошибка обновления ветки '${targetBranchName}': ${result.error}`);
            } else {
                toast.info(`Создание нового PR (замена картинки)...`);
                 // Call the original action directly as triggerCreatePR is for parsed files
                 const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, prDescription, fullCommitMessage);
                 if (result.success && result.prUrl) { toast.success(`PR для замены картинки создан: ${result.prUrl}`); await notifyAdmin(`🖼️ PR для замены картинки в ${task.targetPath} создан ${user?.username || user?.id}: ${result.prUrl}`); }
                 else { toast.error("Ошибка создания PR: " + (result.error || "Неизвестная ошибка")); logger.error("PR Creation Failed (Image Replace):", result.error); }
            }
        } catch (err: any) {
            toast.error(`Ошибка при замене картинки: ${err.message}`); logger.error("handleDirectImageReplace error:", err);
        } finally { setIsProcessingPR(false); setAssistantLoading(false); }

    }, [ allFetchedFiles, targetBranchName, triggerUpdateBranch, repoUrl, notifyAdmin, user, setAssistantLoading ]); // Added dependencies


    // --- Response Setting and URL Update Callbacks ---
    const setResponseValue = useCallback((value: string) => {
        setResponse(value); if (aiResponseInputRef.current) { aiResponseInputRef.current.value = value; } setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]);
    }, [aiResponseInputRef, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const updateRepoUrl = useCallback((url: string) => { setRepoUrlState(url); }, []);

    // --- Imperative Handle (Expose Methods) ---
    useImperativeHandle(ref, () => ({
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles,
        handleCreatePR: handleCreateOrUpdatePR, // Point to the combined handler
        setResponseValue,
        updateRepoUrl,
        handleDirectImageReplace, // Expose the new method
    }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace]); // Add new method dependency

    // --- RENDER ---
    const isProcessingAny = assistantLoading || aiActionLoading || contextIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const canSubmitPR = !isProcessingAny && filesParsed && selectedFileIds.size > 0 && !!prTitle && !!repoUrl; // Ensure files are PARSED for normal PR
    const prButtonText = targetBranchName ? `Обновить Ветку (${targetBranchName.substring(0, 15)}...)` : "Создать PR";
    const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIcon = isProcessingPR ? <FaArrowsRotate className="animate-spin"/> : prButtonIcon;
    const assistantTooltipText = `Вставьте ответ AI ИЛИ используйте кнопку 'Спросить AI'. Затем '➡️' → Проверьте/Исправьте → Выберите файлы → ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const commonDisabled = isProcessingAny;
    const parseButtonDisabled = commonDisabled || isWaitingForAiResponse || !response.trim();
    const fixButtonDisabled = commonDisabled || isWaitingForAiResponse;
    const submitButtonDisabled = !canSubmitPR || isProcessingPR || imageReplaceTask != null; // Disable PR button during image replace flow

    // Hide regular assistant elements if image replacement task is active and files are fetched
    const showAssistantUI = !imageReplaceTask || fetchStatus !== 'success';

    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            {/* Header */}
             <header className="flex justify-between items-center gap-2">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">AI Code Assistant</h1>
                     {showAssistantUI && ( // Only show tooltip if UI is visible
                         <Tooltip text={assistantTooltipText} position="left">
                             <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
                         </Tooltip>
                     )}
                 </div>
                 <Tooltip text="Настройки URL/Token/Ветки/PR" position="left">
                      <button id="settings-modal-trigger-assistant" onClick={triggerToggleSettingsModal} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={commonDisabled} > <FaCodeBranch className="text-xl" /> </button>
                 </Tooltip>
             </header>

            {/* Conditionally render standard UI vs Image Replace message */}
            {showAssistantUI ? (
                 <>
                     {/* AI Response Input Area */}
                      <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm">
                             {isWaitingForAiResponse
                                 ? `⏳ Ожидание ответа от AI... (ID: ${currentAiRequestId?.substring(0,6)}...)`
                                 : "2️⃣ Ответ от AI появится здесь (или вставьте). Затем '➡️'."}
                          </p>
                          <div className="relative group">
                              <textarea
                                  id="response-input"
                                  ref={aiResponseInputRef}
                                  className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                                  defaultValue={response}
                                  onChange={(e) => setResponse(e.target.value)}
                                  placeholder={isWaitingForAiResponse ? "AI думает..." : "Ответ от AI появится здесь..."}
                                  disabled={commonDisabled}
                                  spellCheck="false"
                              />
                              <TextAreaUtilities
                                  response={response}
                                  isLoading={commonDisabled}
                                  onParse={handleParse}
                                  onOpenModal={handleOpenModal}
                                  onCopy={handleCopyResponse}
                                  onClear={handleClearResponse}
                                  onSelectFunction={handleSelectFunction}
                                  isParseDisabled={parseButtonDisabled}
                                  isProcessingPR={isProcessingPR}
                              />
                          </div>
                          {/* Validation Status and Actions */}
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               <CodeRestorer
                                  parsedFiles={componentParsedFiles} // Pass local state
                                  originalFiles={originalRepoFiles}
                                  skippedIssues={skippedCodeBlockIssues}
                                  onRestorationComplete={handleRestorationComplete}
                                  disabled={commonDisabled || validationStatus === 'validating' || isFetchingOriginals}
                               />
                               <ValidationStatusIndicator
                                   status={validationStatus}
                                   issues={validationIssues}
                                   onAutoFix={handleAutoFix}
                                   onCopyPrompt={handleCopyFixPrompt}
                                   isFixDisabled={fixButtonDisabled}
                               />
                          </div>
                      </div>

                     {/* Parsed Files List */}
                     <ParsedFilesList
                         parsedFiles={componentParsedFiles} // Use local state
                         selectedFileIds={selectedFileIds}
                         validationIssues={validationIssues}
                         onToggleSelection={handleToggleFileSelection}
                         onSelectAll={handleSelectAllFiles}
                         onDeselectAll={handleDeselectAllFiles}
                         onSaveFiles={handleSaveFiles}
                         onDownloadZip={handleDownloadZip}
                         onSendToTelegram={handleSendToTelegram}
                         isUserLoggedIn={!!user}
                         isLoading={commonDisabled}
                     />

                     {/* PR Form */}
                     <PullRequestForm
                          repoUrl={repoUrl}
                          prTitle={prTitle}
                          selectedFileCount={selectedFileIds.size}
                          isLoading={isProcessingPR}
                          isLoadingPrList={loadingPrs}
                          onRepoUrlChange={(url) => { setRepoUrlState(url); updateRepoUrlInAssistant(url); }}
                          onPrTitleChange={setPrTitle}
                          onCreatePR={handleCreateOrUpdatePR} // Use combined handler
                          buttonText={prButtonText}
                          buttonIcon={prButtonLoadingIcon}
                          isSubmitDisabled={submitButtonDisabled}
                     />

                     {/* Open PR List */}
                     <OpenPrList openPRs={contextOpenPrs} />

                    {/* Toolbar Area */}
                    <div className="flex items-center gap-3 mb-2">
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />
                         <Tooltip text="Загрузить/Связать Картинки" position="left">
                             <button onClick={() => setIsImageModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={commonDisabled} >
                                <FaImage className="text-gray-400" />
                                <span className="text-sm text-white">Картинки</span>
                                {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && (
                                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span>
                                 )}
                             </button>
                         </Tooltip>
                    </div>
                 </>
            ) : (
                 // Message shown during image replacement processing
                 <div className="flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed border-blue-400 min-h-[200px]">
                     <FaArrowsRotate className="text-blue-400 text-4xl mb-4 animate-spin" />
                     <p className="text-lg font-semibold text-blue-300">Заменяю картинку в файле...</p>
                     <p className="text-sm text-gray-400 mt-2">Создаю коммит и Pull Request. Это может занять несколько секунд.</p>
                     {imageReplaceTask && <p className="text-xs text-gray-500 mt-3">Файл: {imageReplaceTask.targetPath}</p>}
                 </div>
            )}


             {/* Modals */}
             <AnimatePresence>
                 {showModal && ( <SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handleSwap} onSearch={handleSearch} initialMode={modalMode} /> )}
                 {isImageModalOpen && (
                    <ImageToolsModal
                        isOpen={isImageModalOpen}
                        onClose={() => setIsImageModalOpen(false)}
                        parsedFiles={componentParsedFiles} // Use local state
                        onUpdateParsedFiles={handleUpdateParsedFiles}
                    />
                 )}
             </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;
