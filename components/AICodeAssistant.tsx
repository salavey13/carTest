"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask
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
import { FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate, FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines } from "react-icons/fa6"; // Added icons
import clsx from "clsx";
import { saveAs } from "file-saver";
import { logger } from "@/lib/logger"; // Use standard logger
import { Tooltip } from "@/components/ui/Tooltip";
import { selectFunctionDefinition, extractFunctionName } from "@/lib/codeUtils";

// Interfaces
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {
     // Pass refs explicitly if needed, context handles them but direct pass can be clearer
     kworkInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
     aiResponseInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
}
interface OriginalFile { path: string; content: string; }

// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    // --- Props ---
    const { kworkInputRefPassed, aiResponseInputRefPassed } = props;

    // --- Hooks ---
    const { user } = useAppContext();
    const {
        parsedFiles: hookParsedFiles, rawDescription, validationStatus, validationIssues,
        isParsing: hookIsParsing, parseAndValidateResponse, autoFixIssues,
        setParsedFiles: setHookParsedFiles, setValidationStatus, setValidationIssues,
    } = useCodeParsingAndValidation();

    // --- Context Access ---
    const {
        // Use passed refs primarily for direct manipulation if needed, context refs for context logic
        // aiResponseInputRef, // Context ref
        setAiResponseHasContent, setFilesParsed, filesParsed,
        setSelectedAssistantFiles, setAssistantLoading, assistantLoading, aiActionLoading,
        currentAiRequestId, openPrs: contextOpenPrs, triggerGetOpenPRs, targetBranchName,
        triggerToggleSettingsModal, triggerUpdateBranch, // Use context trigger for branch updates
        updateRepoUrlInAssistant, loadingPrs, setIsParsing: setContextIsParsing,
        isParsing: contextIsParsing, allFetchedFiles, imageReplaceTask, setImageReplaceTask,
    } = useRepoXmlPageContext();

    // --- State ---
    const [isMounted, setIsMounted] = useState(false);
    const [response, setResponse] = useState<string>(""); // Local state for AI response textarea content
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set()); // IDs of files selected in *this* component's list
    const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
    const [prTitle, setPrTitle] = useState<string>("");
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
    const [isProcessingPR, setIsProcessingPR] = useState(false); // Specific loading for PR/Update actions initiated here
    const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
    const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Combined isParsing state
    const isParsing = contextIsParsing ?? hookIsParsing;

    // Local state for parsed files, synced with the hook's state
    const [componentParsedFiles, setComponentParsedFiles] = useState<ValidationFileEntry[]>([]);
    useEffect(() => {
        // logger.log("[AICodeAssistant] Syncing parsed files from hook:", hookParsedFiles);
        setComponentParsedFiles(hookParsedFiles);
        setFilesParsed(hookParsedFiles.length > 0); // Update context based on hook's files
    }, [hookParsedFiles, setFilesParsed]);

    // Helper
    const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

    // --- Effects ---
    useEffect(() => { setIsMounted(true); }, []);

    // Effect to manage component state based on response, loading, and image task
    useEffect(() => {
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent); // Update context

        // Clear assistant state if response is empty, no AI action, and no image task
        if (isMounted && !hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask) {
            // logger.log("[AICodeAssistant Effect] Clearing state: No response/AI action/image task.");
            setFilesParsed(false); // Context
            setSelectedAssistantFiles(new Set()); // Context
            setValidationStatus('idle');
            setValidationIssues([]);
            setOriginalRepoFiles([]);
            setComponentParsedFiles([]); // Local
            setHookParsedFiles([]); // Hook
            setSelectedFileIds(new Set()); // Local selection
        }
        // Reset validation if response exists but no files parsed (e.g., after manual edit)
        else if (isMounted && hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading && !imageReplaceTask) {
             // logger.log("[AICodeAssistant Effect] Resetting validation status: Response has content, but no files parsed.");
             setValidationStatus('idle');
             setValidationIssues([]);
        }
    }, [ response, currentAiRequestId, aiActionLoading, imageReplaceTask, componentParsedFiles.length, isParsing, assistantLoading, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setHookParsedFiles, isMounted ]);

    // Load custom links
    useEffect(() => {
        const loadLinks = async () => { if (!user) { setCustomLinks([]); return; } try { const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!e && d?.metadata?.customLinks) setCustomLinks(d.metadata.customLinks); else setCustomLinks([]); } catch (e) { logger.error("Error loading custom links:", e); setCustomLinks([]); } }; loadLinks();
    }, [user]);

    // Fetch original files if needed for restoration
    useEffect(() => {
        const skippedCodeBlockIssues = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        if (skippedCodeBlockIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) { const fetchOriginals = async () => { setIsFetchingOriginals(true); const branch = targetBranchName ?? undefined; const branchDisplay = targetBranchName ?? 'default'; toast.info(`Загрузка оригиналов из ветки ${branchDisplay}...`); try { const result = await fetchRepoContents(repoUrl, undefined, branch); if (result.success && Array.isArray(result.files)) { setOriginalRepoFiles(result.files); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (result.error ?? '?')); setOriginalRepoFiles([]); } } catch (e) { toast.error("Крит. ошибка при загрузке оригиналов."); logger.error("Fetch originals critical error:", e); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOriginals(); }
    }, [validationIssues, originalRepoFiles.length, isFetchingOriginals, repoUrl, targetBranchName]);

    // --- Handlers ---
    const handleParse = useCallback(async () => {
        if (imageReplaceTask) { toast.warn("Разбор ответа не требуется для замены картинки."); return; }
        if (!response.trim()) { toast.warn("Нет ответа AI для разбора."); return; }
        logger.log("[AICodeAssistant] Starting parse...");
        setContextIsParsing(true); // Use context setter
        setAssistantLoading(true); // Indicate general activity
        setOriginalRepoFiles([]); // Clear previous originals
        try {
            const { files: newlyParsedFiles, description: parsedRawDescription } = await parseAndValidateResponse(response);
            setHookParsedFiles(newlyParsedFiles); // Update the hook's state first
            const initialSelection = new Set(newlyParsedFiles.map(f => f.id));
            setSelectedFileIds(initialSelection); // Update local selection
            setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path))); // Update context selection
            if (newlyParsedFiles.length > 0) { setPrTitle(extractPRTitleHint(parsedRawDescription || response)); } else { setPrTitle(''); }
            toast.success(`Разбор завершен. ${newlyParsedFiles.length} файлов найдено.`);
        } catch (error) {
            logger.error("Error during parseAndValidateResponse:", error);
            toast.error("Ошибка разбора ответа AI.");
            setFilesParsed(false); // Context
            setHookParsedFiles([]); // Hook
            setSelectedFileIds(new Set()); // Local
            setSelectedAssistantFiles(new Set()); // Context
            setValidationStatus('error');
            setValidationIssues([{type: 'parseError', message: 'Ошибка парсинга ответа.', fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A'}]);
        } finally {
            setContextIsParsing(false); // Use context setter
            setAssistantLoading(false); // Stop general activity
        }
    }, [response, imageReplaceTask, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setAssistantLoading, setValidationStatus, setValidationIssues, setHookParsedFiles]);

    const handleAutoFix = useCallback(() => { autoFixIssues(componentParsedFiles, validationIssues); }, [autoFixIssues, componentParsedFiles, validationIssues]);
    const handleCopyFixPrompt = useCallback(() => { const skipped = validationIssues.filter(i => i.type === 'skippedComment'); if (skipped.length === 0) { toast.info("Нет маркеров '// ..''.' для исправления."); return; } const fileList = skipped.map(i => `- ${i.filePath} (~ строка ${i.details?.lineNumber})`).join('\n'); const prompt = `Восстанови пропуски ('// ..''.') в новых файлах, используя старые как референс:\n${fileList}\n\nВерни полные новые версии файлов.`; navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt для исправления пропусков скопирован!")).catch(() => toast.error("Ошибка копирования промпта.")); }, [validationIssues]);
    const handleRestorationComplete = useCallback((updatedFiles: ValidationFileEntry[], successCount: number, errorCount: number) => { setHookParsedFiles(updatedFiles); const remainingIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); setValidationIssues(remainingIssues); setValidationStatus(remainingIssues.length > 0 ? (remainingIssues.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success'); if (successCount > 0) toast.success(`${successCount} блоков восстановлено.`); if (errorCount > 0) toast.error(`${errorCount} блоков не удалось восстановить.`); }, [validationIssues, setHookParsedFiles, setValidationIssues, setValidationStatus]);
    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => { logger.log("AICodeAssistant: handleUpdateParsedFiles called with", updatedFiles.length, "files"); setHookParsedFiles(updatedFiles); toast.info("Файлы обновлены после замены плейсхолдеров картинок."); setValidationStatus('idle'); setValidationIssues([]); }, [setHookParsedFiles, setValidationStatus, setValidationIssues]);
    const handleClearResponse = useCallback(() => { setResponse(""); if (aiResponseInputRefPassed.current) { aiResponseInputRefPassed.current.value = ""; } toast.info("Поле ответа очищено."); }, [aiResponseInputRefPassed]);
    const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(() => toast.success("Скопировано!")).catch(() => {toast.error("Ошибка копирования")}); }, [response]);
    const handleOpenModal = useCallback((mode: 'replace' | 'search') => { setModalMode(mode); setShowModal(true); }, []);
    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find || !aiResponseInputRefPassed.current) return; try { const textArea = aiResponseInputRefPassed.current; const currentValue = textArea.value; const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(escapedFind, 'g'); const newValue = currentValue.replace(regex, replace); if (newValue !== currentValue) { setResponse(newValue); requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = newValue; }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`"${find}" -> "${replace}". Жми '➡️'.`); } else { toast.info(`"${find}" не найден.`); } } catch (e: any) { toast.error(`Ошибка замены: ${e.message}`); }
    }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText || !aiResponseInputRefPassed.current) return; const textArea = aiResponseInputRefPassed.current; const textContent = textArea.value;
        if (isMultiline) { const cleanedSearchText = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n'); if (!cleanedSearchText) { toast.error("Текст для мультилайн поиска пуст."); return; } const firstLine = cleanedSearchText.split('\n')[0]; const funcName = extractFunctionName(firstLine ?? ''); if (!funcName) { toast.error("Не удалось извлечь имя функции из первой строки для поиска."); return; } const funcRegex = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${funcName}\\s*(?:\\(|[:=]|<)`, 'm'); let match = funcRegex.exec(textContent); if (!match) { const methodRegex = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${funcName}\\s*\\(`, 'm'); match = methodRegex.exec(textContent); } if (!match || match.index === undefined) { toast.info(`Функция "${funcName}" не найдена.`); return; } const matchStartIndex = match.index + (match[1]?.length || 0); const [startPos, endPos] = selectFunctionDefinition(textContent, matchStartIndex); if (startPos === -1 || endPos === -1) { toast.error("Не удалось выделить тело найденной функции."); return; } const newValue = textContent.substring(0, startPos) + cleanedSearchText + textContent.substring(endPos); setResponse(newValue); requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) { aiResponseInputRefPassed.current.value = newValue; aiResponseInputRefPassed.current.focus(); aiResponseInputRefPassed.current.setSelectionRange(startPos, startPos + cleanedSearchText.length); } }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`Функция "${funcName}" заменена! ✨ Жми '➡️'.`);
        } else { const searchTextLower = searchText.toLowerCase(); const textContentLower = textContent.toLowerCase(); const currentPosition = textArea.selectionStart || 0; let foundIndex = textContentLower.indexOf(searchTextLower, currentPosition); if (foundIndex === -1) { foundIndex = textContentLower.indexOf(searchTextLower, 0); if (foundIndex === -1 || foundIndex >= currentPosition) { toast.info(`"${searchText}" не найден.`); textArea.focus(); return; } toast.info("Поиск с начала документа."); } textArea.focus(); textArea.setSelectionRange(foundIndex, foundIndex + searchText.length); toast(`Найдено: "${searchText}"`, { style: { background: "rgba(30, 64, 175, 0.9)", color: "#fff", border: "1px solid rgba(37, 99, 235, 0.3)", backdropFilter: "blur(3px)" }, duration: 2000 }); }
    }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const handleSelectFunction = useCallback(() => {
        const textArea = aiResponseInputRefPassed.current; if (!textArea) return; const textContent = textArea.value; const cursorPos = textArea.selectionStart || 0; const lineStartIndex = textContent.lastIndexOf('\n', cursorPos - 1) + 1; const [startPos, endPos] = selectFunctionDefinition(textContent, lineStartIndex); if (startPos !== -1 && endPos !== -1) { textArea.focus(); textArea.setSelectionRange(startPos, endPos); toast.success("Функция выделена!"); } else { let searchUpIndex = textContent.lastIndexOf('{', lineStartIndex); if (searchUpIndex > 0) { const [upStartPos, upEndPos] = selectFunctionDefinition(textContent, searchUpIndex); if (upStartPos !== -1 && upEndPos !== -1) { textArea.focus(); textArea.setSelectionRange(upStartPos, upEndPos); toast.success("Функция найдена выше!"); return; } } toast.info("Не удалось выделить функцию."); textArea.focus(); }
    }, [aiResponseInputRefPassed]);

    const handleToggleFileSelection = useCallback((fileId: string) => {
        setSelectedFileIds(prev => { const newSet = new Set(prev); if (newSet.has(fileId)) newSet.delete(fileId); else newSet.add(fileId); const selectedPaths = new Set( Array.from(newSet).map(id => componentParsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[] ); setSelectedAssistantFiles(selectedPaths); // Update context selection
             return newSet;
        });
    }, [componentParsedFiles, setSelectedAssistantFiles]);

    const handleSelectAllFiles = useCallback(() => {
        if (componentParsedFiles.length === 0) return;
        const allIds = new Set(componentParsedFiles.map(f => f.id));
        const allPaths = new Set(componentParsedFiles.map(f => f.path));
        setSelectedFileIds(allIds);
        setSelectedAssistantFiles(allPaths); // Update context selection
        toast.info(`${allIds.size} файлов выбрано.`);
    }, [componentParsedFiles, setSelectedAssistantFiles]);

    const handleDeselectAllFiles = useCallback(() => {
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set()); // Update context selection
        toast.info("Выделение снято.");
    }, [setSelectedAssistantFiles]);

    const handleSaveFiles = useCallback(async () => { if (!user) return; const filesToSave = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (filesToSave.length === 0) return; setIsProcessingPR(true); try { const fileData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension })); const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; const existingFiles = existingData?.metadata?.generated_files || []; const newPaths = new Set(fileData.map(f => f.p)); const mergedFiles = [ ...existingFiles.filter((f: any) => !newPaths.has(f.path)), ...fileData.map(f => ({ path: f.p, code: f.c, extension: f.e })) ]; const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles } }, { onConflict: 'user_id' }); if (upsertError) throw upsertError; toast.success(`${filesToSave.length} файлов сохранено в вашем профиле!`); } catch (err) { toast.error("Ошибка сохранения файлов."); logger.error("Save files error:", err); } finally { setIsProcessingPR(false); } }, [user, componentParsedFiles, selectedFileIds]);
    const handleDownloadZip = useCallback(async () => { const filesToZip = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (filesToZip.length === 0) return; setIsProcessingPR(true); try { const JSZip = (await import("jszip")).default; const zip = new JSZip(); filesToZip.forEach((f) => zip.file(f.path.startsWith('/') ? f.path.substring(1) : f.path, f.content)); const blob = await zip.generateAsync({ type: "blob" }); saveAs(blob, `ai_files_${Date.now()}.zip`); toast.success("Архив скачан."); } catch (error) { toast.error("Ошибка создания ZIP."); logger.error("ZIP download error:", error); } finally { setIsProcessingPR(false); } }, [componentParsedFiles, selectedFileIds]);
    const handleSendToTelegram = useCallback(async (file: FileEntry) => { if (!user?.id) return; setIsProcessingPR(true); try { const result = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt"); if (!result.success) throw new Error(result.error ?? "TG Send Error"); toast.success(`"${file.path}" отправлен в ваш Telegram.`); } catch (err: any) { toast.error(`Ошибка отправки TG: ${err.message}`); logger.error("Send to TG error:", err); } finally { setIsProcessingPR(false); } }, [user]);
    const handleAddCustomLink = useCallback(async () => { const name = prompt("Название ссылки:"); if (!name) return; const url = prompt("URL (начиная с https://):"); if (!url || !url.startsWith('http')) { toast.error("Некорректный URL."); return; } const newLink = { name: name, url: url }; const updatedLinks = [...customLinks, newLink]; setCustomLinks(updatedLinks); if (user) { try { const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), customLinks: updatedLinks } }, { onConflict: 'user_id' }); toast.success(`Ссылка "${name}" добавлена.`); } catch (e) { toast.error("Ошибка сохранения ссылки."); logger.error("Save custom link error:", e); setCustomLinks(customLinks); } } }, [customLinks, user]);


    // --- Combined PR/Update Handler (For Regular AI Flow) ---
    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => {
         if (imageReplaceTask) {
             toast.warn("Действие недоступно во время замены картинки.");
             logger.warn("[handleCreateOrUpdatePR] Aborted: Image Replace task active.");
             return;
         }
        const selectedFilesContent = componentParsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFilesContent.length === 0 || !prTitle) {
            toast.error("Укажите URL репо, Заголовок PR/Commit и выберите файлы (после разбора ➡️).");
            return;
        }

        let finalDescription = (rawDescription || response).substring(0, 60000) + ((rawDescription || response).length > 60000 ? "\n\n...(описание усечено)" : "");
        finalDescription += `\n\n**Файлы (${selectedFilesContent.length}):**\n` + selectedFilesContent.map(f => `- \`${f.path}\``).join('\n');
        const relevantIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment');
        if (relevantIssues.length > 0) { finalDescription += "\n\n**Обнаруженные Проблемы:**\n" + relevantIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); }

        const commitSubject = prTitle.substring(0, 70);
        // Use rawDescription if available, fallback to response's first line
        const firstLineSource = rawDescription || response;
        const commitBody = `Apply AI changes to ${selectedFilesContent.length} files.\nRef: ${firstLineSource.split('\n')[0]?.substring(0, 100) ?? ''}...`;
        const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
        const filesToCommit = selectedFilesContent.map(f => ({ path: f.path, content: f.content }));

        setIsProcessingPR(true); // Start local processing indicator
        setAssistantLoading(true); // Start context loading indicator

        try {
            let prToUpdate: SimplePullRequest | null = null;
            if (contextOpenPrs && contextOpenPrs.length > 0) {
                 prToUpdate = contextOpenPrs.find(pr =>
                     pr.title.toLowerCase().includes("ai changes") ||
                     pr.title.toLowerCase().includes("supervibe studio") ||
                     pr.title.toLowerCase().includes("ai assistant update")
                 ) ?? null;
                if (prToUpdate) {
                    logger.log(`Found existing PR #${prToUpdate.number} to update (Title: ${prToUpdate.title}).`);
                    toast.info(`Найден существующий PR #${prToUpdate.number}. Обновляю его...`);
                }
            }
            // Use targetBranchName from context (which reflects manual input or selected PR branch)
            const branchToUpdate = prToUpdate?.head.ref || targetBranchName;

            if (branchToUpdate) {
                toast.info(`Обновление ветки '${branchToUpdate}'...`);
                // Use context trigger for branch update, passing PR details if available
                const updateResult = await triggerUpdateBranch(
                    repoUrl, filesToCommit, fullCommitMessage, branchToUpdate,
                    prToUpdate?.number, finalDescription // Pass PR number and body
                );
                 if (updateResult.success) {
                     // Refresh handled by triggerUpdateBranch internally now
                     // await triggerGetOpenPRs(repoUrl);
                 } // Errors handled within triggerUpdateBranch
            } else {
                toast.info(`Создание нового PR...`);
                // Use the direct action for creating a NEW PR
                const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, finalDescription, fullCommitMessage);
                if (result.success && result.prUrl) {
                    toast.success(`PR создан: ${result.prUrl}`);
                    await notifyAdmin(`🤖 PR с AI изменениями создан ${user?.username || user?.id}: ${result.prUrl}`);
                    await triggerGetOpenPRs(repoUrl); // Refresh PR list
                } else {
                    toast.error("Ошибка создания PR: " + (result.error || "Неизвестная ошибка"));
                    logger.error("PR Creation Failed (Regular):", result.error);
                }
            }
        } catch (err) {
            toast.error(`Критическая ошибка при ${targetBranchName ? 'обновлении ветки' : 'создании PR'}.`);
            logger.error("PR/Update critical error:", err);
        } finally {
            setIsProcessingPR(false); // Stop local processing indicator
            setAssistantLoading(false); // Stop context loading indicator
        }
    }, [ componentParsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, response, validationIssues, targetBranchName, contextOpenPrs, triggerUpdateBranch, setAssistantLoading, user, triggerGetOpenPRs, notifyAdmin, imageReplaceTask ]);


    // --- Direct Image Replacement Handler (Checks for existing PR & passes comment) ---
    const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask): Promise<void> => {
        logger.log("AICodeAssistant: handleDirectImageReplace called with task:", task);
        // Loading state is already set by setFilesFetchedCallback in context
        setIsProcessingPR(true); // Indicate local PR activity

        try {
            // Use allFetchedFiles from context, which should be populated by setFilesFetched
            const targetFile = allFetchedFiles.find(f => f.path === task.targetPath);
            if (!targetFile) {
                throw new Error(`Целевой файл "${task.targetPath}" не найден среди загруженных.`);
            }

            let currentContent = targetFile.content;
            // Use case-insensitive replace for URLs if needed, but usually exact match is safer
            if (!currentContent.includes(task.oldUrl)) {
                toast.warn(`Старый URL картинки (${task.oldUrl.substring(0,30)}...) не найден в файле ${task.targetPath}. Изменений не будет.`);
                // Clear task and reset loading as the operation is effectively finished/aborted
                setImageReplaceTask(null); // Use context setter
                setAssistantLoading(false); // Use context setter
                setIsProcessingPR(false); // Reset local state
                return;
            }
            // Use replaceAll for safety, although URLs are usually unique
            const modifiedContent = currentContent.replaceAll(task.oldUrl, task.newUrl);
            if (modifiedContent === currentContent) {
                toast.info(`Контент файла ${task.targetPath} не изменился после замены (возможно, URL уже обновлен).`);
                 // Clear task and reset loading
                 setImageReplaceTask(null); // Use context setter
                 setAssistantLoading(false); // Use context setter
                 setIsProcessingPR(false); // Reset local state
                 return;
            }

            logger.log(`Performing replacement in ${task.targetPath}.`);
            toast.info(`Заменяю ${task.oldUrl.substring(0,30)}... на ${task.newUrl.substring(0,30)}... в ${task.targetPath}`);

            const filesToCommit: { path: string; content: string }[] = [{ path: task.targetPath, content: modifiedContent }];
            const commitTitle = `chore: Update image in ${task.targetPath}`;
            const prDescription = `Replaced image via SuperVibe Studio.\n\nOld: \`${task.oldUrl}\`\nNew: \`${task.newUrl}\``;
            const fullCommitMessage = `${commitTitle}\n\n${prDescription}`;
            const prTitleForNewPr = commitTitle; // Use commit title for new PR title

            let existingPrBranch: string | null = null;
            let existingPrNumber: number | null = null;
            const expectedPrTitle = `chore: Update image in ${task.targetPath}`; // Use commit title to find existing PR

             if (contextOpenPrs && contextOpenPrs.length > 0) {
                 const matchingPr = contextOpenPrs.find(pr => pr.title === expectedPrTitle);
                 if (matchingPr) {
                     existingPrBranch = matchingPr.head.ref;
                     existingPrNumber = matchingPr.number;
                     logger.log(`Found existing image PR #${existingPrNumber} (Branch: ${existingPrBranch}) for file ${task.targetPath}. Will update.`);
                     toast.info(`Обновляю существующий PR #${existingPrNumber} для этой картинки...`);
                 }
             }

            // Use targetBranchName from context, which could be manually set or derived from another PR
            const branchToUpdate = existingPrBranch || targetBranchName;

            if (branchToUpdate) {
                logger.log(`Updating branch '${branchToUpdate}' for image replace.`);
                // Use context trigger for branch update
                const result = await triggerUpdateBranch(
                    repoUrl, filesToCommit, fullCommitMessage, branchToUpdate,
                    existingPrNumber, prDescription // Pass PR number and body
                );
                 if (result.success) {
                    // Refresh handled internally by triggerUpdateBranch now
                    // await triggerGetOpenPRs(repoUrl);
                 } // Errors handled within triggerUpdateBranch
            } else {
                logger.log(`Creating new PR for image replace.`);
                // Use direct action for creating a NEW PR
                 const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitleForNewPr, prDescription, fullCommitMessage);
                 if (result.success && result.prUrl) {
                     toast.success(`PR для замены картинки создан: ${result.prUrl}`);
                     await notifyAdmin(`🖼️ PR для замены картинки в ${task.targetPath} создан ${user?.username || user?.id}: ${result.prUrl}`);
                     await triggerGetOpenPRs(repoUrl); // Refresh PR list
                 }
                 else {
                     toast.error("Ошибка создания PR: " + (result.error || "Неизвестная ошибка"));
                     logger.error("PR Creation Failed (Image Replace):", result.error);
                 }
            }
        } catch (err: any) {
            toast.error(`Ошибка при замене картинки: ${err.message}`);
            logger.error("handleDirectImageReplace error:", err);
        } finally {
            // Crucial: Clear the task and reset loading states regardless of outcome
            logger.log("handleDirectImageReplace: Finalizing, clearing task and loading states.");
            setImageReplaceTask(null); // Use context setter
            setAssistantLoading(false); // Use context setter
            setIsProcessingPR(false); // Reset local processing state
        }

    }, [ allFetchedFiles, contextOpenPrs, targetBranchName, repoUrl, notifyAdmin, user, setAssistantLoading, setImageReplaceTask, triggerGetOpenPRs, triggerUpdateBranch ]);


    // --- Response Setting and URL Update Callbacks ---
    const setResponseValue = useCallback((value: string) => {
        // logger.log("AICodeAssistant: setResponseValue called.");
        setResponse(value);
        if (aiResponseInputRefPassed.current) {
            aiResponseInputRefPassed.current.value = value;
        }
        // Clear downstream state when response changes MANUALLY or is SET externally
        setHookParsedFiles([]);
        setFilesParsed(false);
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        setValidationStatus('idle');
        setValidationIssues([]);
    }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const updateRepoUrl = useCallback((url: string) => {
        setRepoUrlState(url);
        // Optionally trigger fetching PRs or clearing state if URL changes significantly
        triggerGetOpenPRs(url); // Fetch PRs for the new repo
    }, [triggerGetOpenPRs]);

    // --- Imperative Handle (Expose Methods) ---
    useImperativeHandle(ref, () => ({
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles,
        handleCreatePR: handleCreateOrUpdatePR, // Expose the combined handler
        setResponseValue,
        updateRepoUrl,
        handleDirectImageReplace, // Expose the image replacement handler
    }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace]);

    // --- RENDER ---
    // Combine all potential loading/processing states
    const isProcessingAny = assistantLoading || aiActionLoading || contextIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    // Regular PR conditions: Not processing, files parsed, files selected, title exists, repo URL exists, NOT an image task
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedFileIds.size > 0 && !!prTitle && !!repoUrl && !imageReplaceTask;
    // Determine button text/icon based on target branch
    const prButtonText = targetBranchName ? `Обновить Ветку (${targetBranchName.substring(0, 15)}...)` : "Создать PR";
    const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    // Show loading if EITHER local PR processing OR general assistant loading is true
    const prButtonLoadingIcon = isProcessingPR || assistantLoading ? <FaArrowsRotate className="animate-spin"/> : prButtonIcon;
    const assistantTooltipText = `Вставьте ответ AI ИЛИ используйте кнопку 'Спросить AI'. Затем '➡️' → Проверьте/Исправьте → Выберите файлы → ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;

    // Determine which UI section to show
    const showStandardAssistantUI = isMounted && !imageReplaceTask;
    const showImageReplaceUI = isMounted && !!imageReplaceTask;

    // Disable controls logic
    const commonDisabled = isProcessingAny; // Base disable condition
    const parseButtonDisabled = commonDisabled || isWaitingForAiResponse || !response.trim();
    const fixButtonDisabled = commonDisabled || isWaitingForAiResponse;
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || assistantLoading; // Disable if not ready OR already processing locally OR globally


    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            {/* Header */}
             <header className="flex justify-between items-center gap-2 flex-wrap"> {/* Allow wrapping */}
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                         {showImageReplaceUI ? "Статус Замены Картинки" : "AI Code Assistant"}
                     </h1>
                     {/* Only show standard info icon if NOT replacing image */}
                     {showStandardAssistantUI && (
                         <Tooltip text={assistantTooltipText} position="bottom">
                             <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
                         </Tooltip>
                     )}
                 </div>
                 {/* Settings button - Keep enabled unless actively processing a PR/Update */}
                 <Tooltip text="Настройки URL/Token/Ветки/PR" position="left">
                      <button
                          id="settings-modal-trigger-assistant"
                          onClick={triggerToggleSettingsModal}
                          className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50"
                          disabled={isProcessingPR || assistantLoading} // Disable only during active PR/update
                      >
                          <FaCodeBranch className="text-xl" />
                      </button>
                 </Tooltip>
             </header>

            {/* Loading Skeleton */}
            {!isMounted && (
                <div className="flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed border-gray-600 min-h-[200px]">
                    <FaSpinner className="text-gray-400 text-3xl mb-4 animate-spin" />
                    <p className="text-sm text-gray-400">Инициализация ассистента...</p>
                </div>
            )}

            {/* STANDARD AI ASSISTANT UI */}
            {isMounted && showStandardAssistantUI && (
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
                                  ref={aiResponseInputRefPassed} // Use passed ref
                                  className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                                  defaultValue={response}
                                  onChange={(e) => setResponse(e.target.value)}
                                  placeholder={isWaitingForAiResponse ? "AI думает..." : "Ответ от AI появится здесь..."}
                                  disabled={commonDisabled} // Use combined disable state
                                  spellCheck="false"
                              />
                              {/* Utilities depend on the *local* response state */}
                              <TextAreaUtilities
                                  response={response}
                                  isLoading={commonDisabled}
                                  onParse={handleParse}
                                  onOpenModal={handleOpenModal}
                                  onCopy={handleCopyResponse}
                                  onClear={handleClearResponse}
                                  onSelectFunction={handleSelectFunction}
                                  isParseDisabled={parseButtonDisabled}
                                  isProcessingPR={isProcessingPR || assistantLoading} // Disable if processing locally or globally
                              />
                          </div>
                          {/* Validation Status and Actions */}
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               <CodeRestorer
                                  parsedFiles={componentParsedFiles}
                                  originalFiles={originalRepoFiles}
                                  skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')}
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
                         selectedFileIds={selectedFileIds} // Use local selection
                         validationIssues={validationIssues}
                         onToggleSelection={handleToggleFileSelection}
                         onSelectAll={handleSelectAllFiles}
                         onDeselectAll={handleDeselectAllFiles}
                         onSaveFiles={handleSaveFiles}
                         onDownloadZip={handleDownloadZip}
                         onSendToTelegram={handleSendToTelegram}
                         isUserLoggedIn={!!user}
                         isLoading={commonDisabled} // Use combined disable state
                     />

                     {/* PR Form */}
                     <PullRequestForm
                          repoUrl={repoUrl} // Use local state for display
                          prTitle={prTitle} // Use local state
                          selectedFileCount={selectedFileIds.size} // Use local selection size
                          isLoading={isProcessingPR || assistantLoading} // Show loading if either is true
                          isLoadingPrList={loadingPrs}
                          onRepoUrlChange={(url) => { setRepoUrlState(url); updateRepoUrlInAssistant(url); }}
                          onPrTitleChange={setPrTitle}
                          onCreatePR={handleCreateOrUpdatePR} // Use combined handler
                          buttonText={prButtonText}
                          buttonIcon={prButtonLoadingIcon} // Show loading icon if processing
                          isSubmitDisabled={submitButtonDisabled} // Use combined disable logic
                     />

                     {/* Open PR List */}
                     <OpenPrList openPRs={contextOpenPrs} />

                    {/* Toolbar Area */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap"> {/* Allow wrapping */}
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />
                         <Tooltip text="Загрузить/Связать Картинки" position="top">
                             <button
                                onClick={() => setIsImageModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative"
                                disabled={commonDisabled} // Disable if generally processing
                             >
                                <FaImage className="text-gray-400" />
                                <span className="text-sm text-white">Картинки</span>
                                {/* Show notification dot if prompts file exists and modal is not open */}
                                {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && (
                                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span>
                                 )}
                             </button>
                         </Tooltip>
                         {/* Add other tools if needed */}
                    </div>
                 </>
            )}

            {/* IMAGE REPLACE UI */}
            {isMounted && showImageReplaceUI && (
                 <div className="flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed border-blue-400 min-h-[200px]">
                     {/* Show spinner if assistant is creating/updating PR OR if AI action loading (less likely here) */}
                     {assistantLoading || isProcessingPR || aiActionLoading ? (
                        <FaArrowsRotate className="text-blue-400 text-4xl mb-4 animate-spin" />
                     ) : (
                         <FaImages className="text-blue-400 text-4xl mb-4" /> // Or maybe FaCheck if needed based on a final success state?
                     )}
                     <p className="text-lg font-semibold text-blue-300">
                         {assistantLoading || isProcessingPR || aiActionLoading ? "Заменяю картинку и обновляю ветку/PR..." : "Задача Замены Картинки"}
                     </p>
                     <p className="text-sm text-gray-400 mt-2">
                          {assistantLoading || isProcessingPR || aiActionLoading ? "Идет процесс..." : "Процесс завершен или ожидает запуска."}
                     </p>
                     {/* Display task details */}
                     {imageReplaceTask && (
                         <div className="mt-3 text-xs text-gray-500 break-all text-left bg-gray-900/50 p-2 rounded max-w-full overflow-x-auto">
                             <p><span className="font-semibold text-gray-400">Файл:</span> {imageReplaceTask.targetPath}</p>
                             <p><span className="font-semibold text-gray-400">Старый URL:</span> {imageReplaceTask.oldUrl}</p>
                             <p><span className="font-semibold text-gray-400">Новый URL:</span> {imageReplaceTask.newUrl}</p>
                         </div>
                     )}
                 </div>
            )}


             {/* Modals */}
             <AnimatePresence>
                 {/* Only show SwapModal in standard flow */}
                 {showStandardAssistantUI && showModal && (
                    <SwapModal
                        isOpen={showModal}
                        onClose={() => setShowModal(false)}
                        onSwap={handleSwap}
                        onSearch={handleSearch}
                        initialMode={modalMode} />
                 )}
                  {/* Only show ImageToolsModal in standard flow */}
                 {showStandardAssistantUI && isImageModalOpen && (
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