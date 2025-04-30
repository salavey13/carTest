"use client";

import { useCallback } from 'react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import JSZip from 'jszip'; // Ensure JSZip is installed

// Context & Types (adjust paths if necessary)
// Adjust these imports based on your actual context/type locations
import { useAppContext } from '@/contexts/AppContext';
import {
    useRepoXmlPageContext,
    AICodeAssistantRef, // If needed, but likely not directly in handlers
    SimplePullRequest,
    ImageReplaceTask,
    FileNode
} from '@/contexts/RepoXmlPageContext';
import {
    ValidationIssue,
    FileEntry as ValidationFileEntry,
    ValidationStatus
} from '@/hooks/useCodeParsingAndValidation';
import {
    createGitHubPullRequest,
    updateBranch,
    fetchRepoContents,
    getOpenPullRequests // Need this for image replace check
} from '@/app/actions_github/actions'; // Added getOpenPullRequests
import { sendTelegramDocument, notifyAdmin } from '@/app/actions';
import { supabaseAdmin } from '@/hooks/supabase'; // Keep if used for Supabase Admin client
import { selectFunctionDefinition, extractFunctionName } from '@/lib/codeUtils';
import { debugLogger as logger } from '@/lib/debugLogger';

// Type definition from useCodeParsingAndValidation hook
type UseCodeParsingAndValidationReturn = {
    parsedFiles: ValidationFileEntry[];
    rawDescription: string;
    validationStatus: ValidationStatus;
    validationIssues: ValidationIssue[];
    isParsing: boolean;
    parseAndValidateResponse: (response: string) => Promise<{ files: ValidationFileEntry[]; description: string; issues: ValidationIssue[]; }>;
    autoFixIssues: (filesToFix: ValidationFileEntry[], issuesToFix: ValidationIssue[]) => ValidationFileEntry[];
    setParsedFiles: React.Dispatch<React.SetStateAction<ValidationFileEntry[]>>;
    setValidationStatus: React.Dispatch<React.SetStateAction<ValidationStatus>>;
    setValidationIssues: React.Dispatch<React.SetStateAction<ValidationIssue[]>>;
    setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setRawDescription: React.Dispatch<React.SetStateAction<string>>;
};


// --- Hook Props Interface ---
interface UseAICodeAssistantHandlersProps {
    // State values from AICodeAssistant
    response: string;
    componentParsedFiles: ValidationFileEntry[];
    selectedFileIds: Set<string>;
    repoUrlStateLocal: string;
    prTitle: string;
    customLinks: { name: string; url: string }[];
    originalRepoFiles: { path: string; content: string }[];
    isFetchingOriginals: boolean;
    imageReplaceTask: ImageReplaceTask | null;
    // State setters from AICodeAssistant
    setResponse: React.Dispatch<React.SetStateAction<string>>;
    setSelectedFileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setPrTitle: React.Dispatch<React.SetStateAction<string>>;
    setCustomLinks: React.Dispatch<React.SetStateAction<{ name: string; url: string }[]>>;
    setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
    setModalMode: React.Dispatch<React.SetStateAction<'replace' | 'search'>>;
    setIsProcessingPR: React.Dispatch<React.SetStateAction<boolean>>;
    setOriginalRepoFiles: React.Dispatch<React.SetStateAction<{ path: string; content: string }[]>>;
    setIsFetchingOriginals: React.Dispatch<React.SetStateAction<boolean>>;
    setIsImageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setComponentParsedFiles: React.Dispatch<React.SetStateAction<ValidationFileEntry[]>>;
    setImageReplaceError: React.Dispatch<React.SetStateAction<string | null>>;
    // --- FIX: Add setImageReplaceTask type ---
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    setRepoUrlStateLocal: React.Dispatch<React.SetStateAction<string>>;
    // Props from useCodeParsingAndValidation hook
    codeParserHook: UseCodeParsingAndValidationReturn;
    // Context values/methods
    appContext: ReturnType<typeof useAppContext>;
    pageContext: ReturnType<typeof useRepoXmlPageContext>;
    // Refs
    aiResponseInputRefPassed: React.MutableRefObject<HTMLTextAreaElement | null>;
    kworkInputRefPassed: React.MutableRefObject<HTMLTextAreaElement | null>;
}

// --- Custom Hook ---
export const useAICodeAssistantHandlers = (props: UseAICodeAssistantHandlersProps) => {
    const {
        // Destructure all props
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks, originalRepoFiles, isFetchingOriginals, imageReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR, setOriginalRepoFiles, setIsFetchingOriginals, setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError, setRepoUrlStateLocal,
        // --- FIX: Destructure setImageReplaceTask ---
        setImageReplaceTask,
        codeParserHook, appContext, pageContext,
        aiResponseInputRefPassed, kworkInputRefPassed
    } = props;

    // Destructure needed parts from hooks and contexts
    const { user } = appContext;
    const {
        setHookParsedFiles, setValidationStatus, setValidationIssues, parseAndValidateResponse, autoFixIssues, validationIssues, validationStatus, rawDescription, setRawDescription
    } = codeParserHook;
    const {
        contextOpenPrs, targetBranchName, repoUrlFromContext, setAssistantLoading, triggerGetOpenPRs, triggerUpdateBranch, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setRequestCopied, selectedAssistantFiles, setAiResponseHasContent, allFetchedFiles // Need allFetchedFiles for image replace
    } = pageContext;

    const repoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Helper ---
    const extractPRTitleHint = useCallback((text: string): string => {
        if (typeof text !== 'string') { logger.warn("extractPRTitleHint received non-string:", text); return "AI Assistant Update"; }
        const lines = text.split('\n');
        const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update";
        return firstLine.trim().substring(0, 70); // Limit title length
    }, [logger]);


    // --- Handler Implementations ---

    const handleParse = useCallback(async () => {
        if (imageReplaceTask) { toast.warn("Разбор не нужен для картинки."); return; }
        if (!response.trim()) { toast.warn("Нет ответа AI для разбора."); return; }
        logger.log("[Handler] Starting parse...");
        setContextIsParsing(true); setAssistantLoading(true); setOriginalRepoFiles([]);
        try {
            const { files: newlyParsedFiles, description: parsedRawDesc, issues: parseValidationIssues } = await parseAndValidateResponse(response);
            setHookParsedFiles(newlyParsedFiles);
            setComponentParsedFiles(newlyParsedFiles);
            // Select only files that were successfully parsed (not just placeholders/errors)
            const validParsedFiles = newlyParsedFiles.filter(f => f.content.trim() !== ''); // Basic check
            const initialSelection = new Set(validParsedFiles.map(f => f.id));
            setSelectedFileIds(initialSelection);
            setSelectedAssistantFiles(new Set(validParsedFiles.map(f => f.path)));

            const textForTitle = parsedRawDesc || response || "";
            setPrTitle(extractPRTitleHint(textForTitle));
            setFilesParsed(newlyParsedFiles.length > 0); // Keep this true if any block was found
            setValidationStatus(parseValidationIssues.length > 0 ? (parseValidationIssues.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success');
            setValidationIssues(parseValidationIssues);
            setRawDescription(parsedRawDesc); // Ensure raw description is set

            toast.success(`Разбор завершен. Найдено ${newlyParsedFiles.length} блоков кода. Проблем: ${parseValidationIssues.length}. Выбрано: ${initialSelection.size}`);
        } catch (error: any) {
            logger.error("Parse error in handleParse:", error);
            toast.error(`Ошибка разбора: ${error?.message ?? 'Неизвестная ошибка'}`);
            setFilesParsed(false); setHookParsedFiles([]); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
            setValidationStatus('error'); setValidationIssues([{type: 'parseError', message: `Ошибка парсинга ответа: ${error?.message ?? '?'}`, fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A', severity: 'error'}]);
        } finally {
            setContextIsParsing(false); setAssistantLoading(false);
        }
     }, [
        response, imageReplaceTask, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setAssistantLoading, setValidationStatus, setValidationIssues, setHookParsedFiles, logger, extractPRTitleHint, setPrTitle, setOriginalRepoFiles, setSelectedFileIds, setComponentParsedFiles, setRawDescription // Added missing dependencies
     ]);

    const handleAutoFix = useCallback(() => {
        if (imageReplaceTask) return;
        try {
            const updated = autoFixIssues(componentParsedFiles, validationIssues);
            setComponentParsedFiles(updated);
            toast.success("Авто-исправления применены!");
        } catch (error: any) {
            logger.error("Error during autoFixIssues:", error);
            toast.error(`Ошибка авто-исправления: ${error?.message ?? 'Неизвестная ошибка'}`);
        }
     }, [autoFixIssues, componentParsedFiles, validationIssues, imageReplaceTask, setComponentParsedFiles, logger]);

    const handleCopyFixPrompt = useCallback(() => {
        if (imageReplaceTask) return;
        const skipped = validationIssues.filter(i => i.type === 'skippedComment');
        if (skipped.length === 0) { toast.info("Нет маркеров '// ..''.'."); return; }
        const fList = skipped.map(i => `- ${i.filePath} (~${i.details?.lineNumber ?? '?'})`).join('\n');
        const prompt = `Восстанови пропуски ('// ..''.') в новых файлах, референс - старые:\n${fList}\n\nВерни полные новые версии.`;
        navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt для исправления скопирован!")).catch((err) => { logger.error("Copy fix prompt error:", err); toast.error("Ошибка копирования промпта."); });
     }, [validationIssues, imageReplaceTask, logger]);

    const handleRestorationComplete = useCallback((updatedFiles: ValidationFileEntry[], successCount: number, errorCount: number) => {
        if (imageReplaceTask) return;
        setHookParsedFiles(updatedFiles);
        setComponentParsedFiles(updatedFiles);
        // Recalculate validation status based on remaining issues
        const remaining = validationIssues.filter(i => i.type !== 'skippedCodeBlock');
        setValidationIssues(remaining);
        setValidationStatus(remaining.length > 0 ? (remaining.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success');
        if (successCount > 0) toast.success(`${successCount} блоков кода восстановлено.`);
        if (errorCount > 0) toast.error(`${errorCount} блоков не удалось восстановить.`);
     }, [validationIssues, setHookParsedFiles, setValidationIssues, setValidationStatus, imageReplaceTask, setComponentParsedFiles]);

    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => {
        if (imageReplaceTask) return;
        logger.log("UpdateParsedFiles:", updatedFiles.length);
        setHookParsedFiles(updatedFiles);
        setComponentParsedFiles(updatedFiles);
        // Reset validation status as content has changed significantly
        setValidationStatus('idle');
        setValidationIssues([]);
        toast.info("Файлы обновлены после замены плейсхолдеров. Рекомендуется повторный парсинг ('➡️').");
     }, [setHookParsedFiles, setValidationStatus, setValidationIssues, imageReplaceTask, logger, setComponentParsedFiles]);

    const handleClearResponse = useCallback(() => {
        if (imageReplaceTask) return;
        setResponse("");
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = "";
        // Reset all related states
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setHookParsedFiles([]);
        setComponentParsedFiles([]);
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        setValidationStatus('idle');
        setValidationIssues([]);
        setOriginalRepoFiles([]);
        setPrTitle('');
        setRequestCopied(false);
        setRawDescription(''); // Clear raw description too
        toast.info("Поле ответа AI и связанные состояния очищены.");
     }, [
        imageReplaceTask, setResponse, aiResponseInputRefPassed, setAiResponseHasContent, setFilesParsed, setHookParsedFiles, setComponentParsedFiles, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setOriginalRepoFiles, setPrTitle, setRequestCopied, setRawDescription // Added setRawDescription
     ]);

    const handleCopyResponse = useCallback(() => {
        if (!response) return;
        navigator.clipboard.writeText(response).then(() => {
             toast.success("Ответ AI скопирован!");
             setRequestCopied(true);
         }).catch((err) => { logger.error("Copy response error:", err); toast.error("Ошибка копирования ответа."); });
     }, [response, setRequestCopied, logger]);

    const handleOpenModal = useCallback((mode: 'replace' | 'search') => {
        if (imageReplaceTask) return;
        setModalMode(mode); setShowModal(true);
     }, [imageReplaceTask, setModalMode, setShowModal]);


    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find || !aiResponseInputRefPassed.current || imageReplaceTask) return;
        try {
            const ta = aiResponseInputRefPassed.current;
            const curVal = ta.value;
            // Use a safe regex creation
            const escFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rgx = new RegExp(escFind, 'g');
            const newVal = curVal.replace(rgx, replace);
            if (newVal !== curVal) {
                // Update state and ref value
                setResponse(newVal);
                requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = newVal; });
                // Reset parsing/validation states as content changed
                setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
                setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); setRawDescription('');
                toast.success(`Текст заменен! "${find}" -> "${replace}". Жми '➡️'.`);
            } else { toast.info(`Текст "${find}" не найден в ответе AI.`); }
        } catch (e: any) {
             logger.error("Swap error:", e);
             toast.error(`Ошибка замены: ${e.message}`);
        }
     }, [
         aiResponseInputRefPassed, imageReplaceTask, setResponse, setHookParsedFiles, setFilesParsed, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, setRawDescription, logger
     ]);


    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText || !aiResponseInputRefPassed.current || imageReplaceTask) return;
        const ta = aiResponseInputRefPassed.current;
        const txtCont = ta.value;

        try {
            if (isMultiline) {
                const clnSrch = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
                if (!clnSrch) { toast.error("Текст для мультилайн поиска/замены пуст."); return; }
                const fL = clnSrch.split('\n')[0] ?? "";
                const fN = extractFunctionName(fL);
                if (!fN) { toast.error("Не удалось извлечь имя функции для замены."); return; }
                // Improved regex for function/class finding
                const fRgx = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\*?\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${fN}\\s*(?:\\(|[:=]|<|extends|implements)`, 'm');
                let match = fRgx.exec(txtCont);
                if (!match) { const mRgx = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${fN}\\s*\\(`, 'm'); match = mRgx.exec(txtCont); } // Method regex
                if (!match || match.index === undefined) { toast.info(`Функция/Класс "${fN}" не найдена в ответе AI.`); return; }
                const mSI = match.index + (match[1]?.length || 0);
                const [sP, eP] = selectFunctionDefinition(txtCont, mSI);
                if (sP === -1 || eP === -1) { toast.error("Не удалось выделить тело функции/класса для замены."); return; }
                const nV = txtCont.substring(0, sP) + clnSrch + txtCont.substring(eP);
                setResponse(nV);
                requestAnimationFrame(() => {
                    if (aiResponseInputRefPassed.current) {
                        aiResponseInputRefPassed.current.value = nV;
                        aiResponseInputRefPassed.current.focus({ preventScroll: true });
                        aiResponseInputRefPassed.current.setSelectionRange(sP, sP + clnSrch.length);
                    }
                });
                // Reset states after modification
                setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
                setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); setRawDescription('');
                toast.success(`Функция "${fN}" заменена! ✨ Жми '➡️'.`);
            } else { // Simple text search
                const sTL = searchText.toLowerCase();
                const tCL = txtCont.toLowerCase();
                const cP = ta.selectionStart || 0;
                let fI = tCL.indexOf(sTL, cP);
                if (fI === -1) {
                    fI = tCL.indexOf(sTL, 0);
                    if (fI === -1) {
                        toast.info(`"${searchText}" не найден.`);
                         ta.focus({ preventScroll: true });
                        return;
                    }
                    toast.info("Поиск с начала.");
                }
                ta.focus({ preventScroll: true });
                ta.setSelectionRange(fI, fI + searchText.length);
                // Use a more subtle feedback for simple search
                // toast(`Найдено: "${searchText}"`, { style: { background: "rgba(30, 64, 175, 0.9)", color: "#fff", border: "1px solid rgba(37, 99, 235, 0.3)", backdropFilter: "blur(3px)" }, duration: 2000 });
            }
        } catch (e: any) {
             logger.error("Search/Replace error:", e);
             toast.error(`Ошибка поиска/замены: ${e.message}`);
        }
     }, [
         aiResponseInputRefPassed, imageReplaceTask, setResponse, setHookParsedFiles, setFilesParsed, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, setRawDescription, logger, extractFunctionName, selectFunctionDefinition // Add dependencies
     ]);


    const handleSelectFunction = useCallback(() => {
        if (imageReplaceTask) return;
        const ta = aiResponseInputRefPassed.current; if (!ta) return; const txt = ta.value;
        const cP = ta.selectionStart || 0; const lSI = txt.lastIndexOf('\n', cP - 1) + 1; // Start of current line
        try {
            const [sP, eP] = selectFunctionDefinition(txt, lSI);
            if (sP !== -1 && eP !== -1) {
                ta.focus({ preventScroll: true });
                ta.setSelectionRange(sP, eP);
                toast.success("Функция/Блок выделена!");
            } else {
                // Try finding the block start `{` before the cursor line if direct function not found
                let sUI = txt.lastIndexOf('{', lSI);
                if (sUI > 0) {
                    const [uSP, uEP] = selectFunctionDefinition(txt, sUI);
                    if (uSP !== -1 && uEP !== -1) {
                        ta.focus({ preventScroll: true });
                        ta.setSelectionRange(uSP, uEP);
                        toast.success("Найден блок выше!"); return;
                    }
                }
                toast.info("Не удалось выделить функцию/блок.");
                ta.focus({ preventScroll: true });
            }
        } catch (e: any) {
             logger.error("Select function error:", e);
             toast.error(`Ошибка выделения: ${e.message}`);
             ta.focus({ preventScroll: true });
        }
     }, [aiResponseInputRefPassed, imageReplaceTask, logger, selectFunctionDefinition]); // Add dependencies

     const handleToggleFileSelection = useCallback((fileId: string) => {
        if (imageReplaceTask) return;
        logger.log("Toggle file selection:", fileId);
        setSelectedFileIds(prev => {
            const newSet = new Set(prev);
            const targetFile = componentParsedFiles.find(f => f.id === fileId);
            if (!targetFile) return prev; // Should not happen

            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                // Only allow selecting files with actual content (not just placeholders)
                if (targetFile.content.trim()) {
                    newSet.add(fileId);
                } else {
                    toast.warn(`Файл ${targetFile.path} пуст или содержит только плейсхолдер.`);
                }
            }
            // Update selected paths based on the new set of IDs
            const selectedPaths = new Set(
                Array.from(newSet)
                     .map(id => componentParsedFiles.find(f => f.id === id)?.path)
                     .filter((path): path is string => !!path)
            );
            setSelectedAssistantFiles(selectedPaths);
            return newSet;
        });
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask, logger, setSelectedFileIds]); // Added componentParsedFiles

    const handleSelectAllFiles = useCallback(() => {
        if (componentParsedFiles.length === 0 || imageReplaceTask) return;
        // Select only files with content
        const validFiles = componentParsedFiles.filter(f => f.content.trim() !== '');
        const allValidIds = new Set(validFiles.map(f => f.id));
        const allValidPaths = new Set(validFiles.map(f => f.path));
        setSelectedFileIds(allValidIds);
        setSelectedAssistantFiles(allValidPaths);
        toast.info(`${allValidIds.size} непустых файлов выбрано.`);
        logger.log("Selected all non-empty parsed files:", allValidIds.size);
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask, logger, setSelectedFileIds]); // Added componentParsedFiles

    const handleDeselectAllFiles = useCallback(() => {
        if (imageReplaceTask) return;
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        toast.info("Выделение снято со всех файлов.");
        logger.log("Deselected all parsed files.");
     }, [setSelectedAssistantFiles, imageReplaceTask, logger, setSelectedFileIds]);


    const handleSaveFiles = useCallback(async () => {
        if (!user || imageReplaceTask) { toast.warn(imageReplaceTask ? "Сохранение недоступно для картинок." : "Требуется авторизация.", { id: "save-auth-warn" }); return; }
        const filesToSave = componentParsedFiles.filter(f => selectedFileIds.has(f.id) && f.content.trim()); // Only save non-empty selected files
        if (filesToSave.length === 0) { toast.warn("Нет выбранных непустых файлов для сохранения."); return; }
        logger.log(`Saving ${filesToSave.length} non-empty files...`);
        setIsProcessingPR(true); const toastId = toast.loading(`Сохранение ${filesToSave.length} файлов...`);
        try {
            // Prepare data, ensuring path and content exist
            const filesData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension || '?' }));
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // Handle specific Supabase error code for "no rows found" if needed
            const existingGeneratedFiles = existingData?.metadata?.generated_files || [];
            // Filter existing files correctly, check path property exists
            const newPathsSet = new Set(filesData.map(f => f.p));
            const filteredExisting = existingGeneratedFiles.filter((f: any) => f?.path && !newPathsSet.has(f.path));
            // Prepare new files data ensuring format consistency
            const newFilesFormatted = filesData.map(f => ({ path: f.p, code: f.c, extension: f.e }));
            const mergedFiles = [ ...filteredExisting, ...newFilesFormatted ];
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles } }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`${filesToSave.length} файлов сохранено/обновлено в вашем профиле.`, { id: toastId });
            logger.log("Successfully saved/updated files.");
        } catch (err: any) { logger.error("Save files error:", err); toast.error(`Ошибка сохранения файлов: ${err?.message ?? 'Неизвестная ошибка'}`, { id: toastId }); }
        finally { setIsProcessingPR(false); }
     }, [user, componentParsedFiles, selectedFileIds, imageReplaceTask, logger, setIsProcessingPR]);


    const handleDownloadZip = useCallback(async () => {
        if (imageReplaceTask) { toast.warn("Скачивание недоступно для картинок."); return; }
        const filesToZip = componentParsedFiles.filter(f => selectedFileIds.has(f.id) && f.content.trim()); // Only zip non-empty selected files
        if (filesToZip.length === 0) { toast.warn("Нет выбранных непустых файлов для скачивания."); return; }
        logger.log(`Downloading ${filesToZip.length} non-empty files as ZIP...`);
        setIsProcessingPR(true); const toastId = toast.loading(`Создание ZIP (${filesToZip.length} файлов)...`);
        try {
            const zip = new JSZip();
            filesToZip.forEach((file) => {
                // Sanitize path for ZIP structure
                const zipPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
                zip.file(zipPath, file.content); // Add file content
            });
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ai_files_${Date.now()}.zip`); // Trigger download
            toast.success("Архив скачан.", { id: toastId });
            logger.log("Successfully downloaded ZIP.");
        } catch (error: any) { logger.error("ZIP error:", error); toast.error(`Ошибка создания ZIP архива: ${error?.message ?? 'Неизвестная ошибка'}`, { id: toastId }); }
        finally { setIsProcessingPR(false); }
     }, [componentParsedFiles, selectedFileIds, imageReplaceTask, logger, setIsProcessingPR]);


    const handleSendToTelegram = useCallback(async (file: ValidationFileEntry) => {
        if (!user?.id || imageReplaceTask) { toast.warn(imageReplaceTask ? "Отправка недоступна для картинок." : "Требуется авторизация.", { id: "tg-send-auth-warn" }); return; }
        if (!file || !file.path || !file.content?.trim()) { toast.warn("Невозможно отправить пустой файл."); return; }
        logger.log(`Sending file ${file.path} to TG user ${user.id}`);
        setIsProcessingPR(true); const toastId = toast.loading(`Отправка ${file.path.split('/').pop()} в Telegram...`);
        try {
            const fileName = file.path.split("/").pop() || `file_${Date.now()}.txt`; // Generate a default name if needed
            const result = await sendTelegramDocument(String(user.id), file.content, fileName);
            if (!result.success) throw new Error(result.error ?? "Telegram Send Error");
            toast.success(`Файл "${fileName}" отправлен в ваш Telegram.`, { id: toastId });
            logger.log(`Sent file ${file.path} to TG.`);
        } catch (err: any) { logger.error("Send TG error:", err); toast.error(`Ошибка отправки в TG: ${err.message}`, { id: toastId }); }
        finally { setIsProcessingPR(false); }
     }, [user, imageReplaceTask, logger, setIsProcessingPR]);


    const handleAddCustomLink = useCallback(async () => {
        if (!user || imageReplaceTask) { toast.warn(imageReplaceTask ? "Недоступно для картинок." : "Требуется авторизация.", { id: "addlink-auth-warn" }); return; }
        let name, url;
        try {
             name = prompt("Название ссылки:"); if (!name || !name.trim()) return;
             url = prompt("URL (https://...):"); if (!url || !url.trim() || !url.trim().startsWith('http')) { toast.error("Некорректный URL."); return; }
        } catch (promptError) {
             logger.warn("Prompt error for custom link:", promptError);
             return; // User cancelled or browser blocked prompt
        }
        const newLink = { name: name.trim(), url: url.trim() };
        logger.log("Adding new custom link:", newLink);
        const updatedLinks = [...customLinks, newLink];
        setCustomLinks(updatedLinks); // Optimistic update
        const toastId = toast.loading("Сохранение ссылки...");
        try {
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            // Ensure metadata exists before trying to spread it
            const currentMetadata = existingData?.metadata || {};
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...currentMetadata, customLinks: updatedLinks } }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`Ссылка "${name}" добавлена.`, { id: toastId });
            logger.log("Saved custom link.");
        } catch (e: any) { logger.error("Save link error:", e); toast.error(`Ошибка сохранения ссылки: ${e?.message ?? 'Неизвестная ошибка'}`, { id: toastId }); setCustomLinks(customLinks); /* Revert optimistic update */ }
     }, [customLinks, user, imageReplaceTask, logger, setCustomLinks]);


    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => {
        if (imageReplaceTask) { toast.warn("Недоступно во время замены картинки."); return; }
        const selectedFilesContent = componentParsedFiles.filter(f => selectedAssistantFiles.has(f.path) && f.content.trim()); // Only include non-empty selected files
        if (!repoUrlForForm || !repoUrlForForm.includes("github.com")) { toast.error("Некорректный URL репозитория GitHub."); return; }
        if (selectedFilesContent.length === 0) { toast.error("Выберите хотя бы один непустой файл для PR/Update."); return; }
        if (!prTitle.trim()) { toast.error("Введите Заголовок PR/Commit."); return; }

        // More robust validation check - ensure severity is checked
        const errors = validationIssues.filter(i => i.severity === 'error' && (!i.fixable || !i.restorable)); // Check for unfixable/unrestorable errors
        if (errors.length > 0) {
             toast.error(`Найдены критические ошибки (${errors.length}), которые нужно исправить перед созданием PR!`, {
                description: errors.map(e => `- ${e.filePath}: ${e.message}`).join('\n'),
                duration: 6000,
             });
             logger.warn("PR creation blocked due to validation errors:", errors);
             return;
        }

        // Prepare PR/commit data
        let finalDescription = (rawDescription || "").substring(0, 60000) + ((rawDescription || "").length > 60000 ? "\n\n...(truncated)" : "");
        if (response && !rawDescription) { // Fallback if rawDescription is empty but response exists
             finalDescription = response.substring(0, 1000) + (response.length > 1000 ? "..." : "");
             logger.warn("Using truncated AI response as PR description (rawDescription was empty).");
        }
        finalDescription += `\n\n**Файлы (${selectedFilesContent.length}):**\n` + selectedFilesContent.map(f => `- \`${f.path}\``).join('\n');
        const relevantIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment' && i.severity !== 'info'); // Include warnings
        if (relevantIssues.length > 0) { finalDescription += "\n\n**Проблемы Валидации:**\n" + relevantIssues.map(i => `- [${i.severity?.toUpperCase()}] **${i.filePath}**: ${i.message}`).join('\n'); }

        const commitSubject = prTitle.trim().substring(0, 70);
        const firstLineSource = rawDescription || response || ""; // Use response as fallback for commit body hint
        const commitBody = `Apply AI assistant changes to ${selectedFilesContent.length} files.\nRef: ${firstLineSource.split('\n')[0]?.substring(0, 100) ?? 'N/A'}...`;
        const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
        const filesToCommit = selectedFilesContent.map(f => ({ path: f.path, content: f.content }));

        setIsProcessingPR(true); setAssistantLoading(true);
        logger.log("[handleCreateOrUpdatePR] Initiating PR/Update process.");
        const actionType = targetBranchName ? 'обновления ветки' : 'создания PR';
        const toastId = toast.loading(`Запуск ${actionType}...`);

        try {
            let prToUpdate: SimplePullRequest | null = null;
            // Ensure contextOpenPrs is an array before finding
            if (Array.isArray(contextOpenPrs) && contextOpenPrs.length > 0) {
                 const lowerCaseTitle = prTitle.trim().toLowerCase();
                 const lowerCaseSubject = commitSubject.toLowerCase();
                 // Find potential PR to update based on title conventions
                 prToUpdate = contextOpenPrs.find(pr =>
                     pr?.title?.toLowerCase()?.includes("ai changes") ||
                     pr?.title?.toLowerCase()?.includes("supervibe") ||
                     pr?.title?.toLowerCase()?.includes("ai assistant") ||
                     (lowerCaseSubject.length > 5 && pr?.title?.toLowerCase()?.includes(lowerCaseSubject.substring(0, 20))) ||
                     (lowerCaseTitle.length > 5 && pr?.title?.toLowerCase()?.includes(lowerCaseTitle))
                 ) ?? null;

                 if (prToUpdate) { logger.log(`Found existing PR #${prToUpdate.number} ('${prToUpdate.title}').`); toast.info(`Обновляю существующий PR #${prToUpdate.number}...`, { id: toastId }); }
                 else { logger.log("No suitable existing PR found."); toast.info("Создание нового PR...", { id: toastId });}
             } else {
                toast.info("Создание нового PR...", { id: toastId });
             }

            const branchToTarget = prToUpdate?.head?.ref || targetBranchName; // Use optional chaining

            if (branchToTarget) {
                 logger.log(`Updating branch '${branchToTarget}'. PR#: ${prToUpdate?.number ?? 'N/A'}`);
                 // Use the triggerUpdateBranch from context which handles loading state and toasts
                 const updateResult = await triggerUpdateBranch( repoUrlForForm, filesToCommit, fullCommitMessage, branchToTarget, prToUpdate?.number, finalDescription );
                 if (!updateResult.success) { /* Error handled within trigger */ logger.error(`Update Branch Failed via Context: ${updateResult.error}`); }
                 else { logger.log(`Successfully updated branch '${branchToTarget}' via Context.`); }
             } else {
                 logger.log(`Creating new PR with title '${prTitle.trim()}'.`);
                 // Use createGitHubPullRequest action directly (or wrap in context if needed)
                 const result = await createGitHubPullRequest( repoUrlForForm, filesToCommit, prTitle.trim(), finalDescription, fullCommitMessage );
                 if (result.success && result.prUrl) {
                      toast.success(`PR создан: ${result.prUrl}`, { id: toastId, duration: 5000 });
                      await triggerGetOpenPRs(repoUrlForForm); // Refresh PR list
                      logger.log(`New PR created: ${result.prUrl}`);
                 }
                 else { logger.error("PR Creation Failed:", result.error); toast.error("Ошибка создания PR: " + (result.error || "?"), { id: toastId }); }
             }
        } catch (err: any) {
             logger.error("PR/Update critical error:", err);
             toast.error(`Крит. ошибка ${actionType}: ${err?.message ?? 'Неизвестная ошибка'}`, { id: toastId });
        }
        finally { setIsProcessingPR(false); setAssistantLoading(false); logger.log("[handleCreateOrUpdatePR] Finished."); }
     }, [
         componentParsedFiles, selectedAssistantFiles, repoUrlForForm, prTitle, rawDescription, response, validationIssues, targetBranchName, contextOpenPrs, triggerUpdateBranch, setAssistantLoading, user, triggerGetOpenPRs, imageReplaceTask, logger, setIsProcessingPR, createGitHubPullRequest, // Added dependencies
         // Ensure all state/props used are listed
     ]);

    // --- Direct Image Replace Handler ---
    const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask, currentAllFiles: FileNode[]): Promise<void> => {
      if (!task?.targetPath || !task.oldUrl || !task.newUrl) {
          logger.warn("[handleDirectImageReplace] Invalid task provided:", task);
          setImageReplaceError("Некорректные данные для задачи замены.");
          return;
      }
      if (!repoUrlForForm || !repoUrlForForm.includes("github.com")) {
           logger.error("[handleDirectImageReplace] Invalid repo URL:", repoUrlForForm);
           setImageReplaceError("Некорректный URL репозитория GitHub.");
           return;
      }
      // Use the passed 'currentAllFiles' instead of context one, as context might not be updated yet
      const allFilesForReplace = currentAllFiles ?? [];
      logger.log("[handleDirectImageReplace] Starting direct image replace process for task:", task);
      setAssistantLoading(true); setIsProcessingPR(true); setImageReplaceError(null);
      const toastId = toast.loading(`Замена картинки в ${task.targetPath.split('/').pop()}...`);

      try {
          const targetFile = allFilesForReplace.find(f => f.path === task.targetPath);
          if (!targetFile) { throw new Error(`Целевой файл ${task.targetPath} не найден среди загруженных.`); }
          if (typeof targetFile.content !== 'string') { throw new Error(`Содержимое файла ${task.targetPath} не является строкой.`); }

          // Escape old URL for regex
          const escapedOldUrl = task.oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const oldUrlRegex = new RegExp(escapedOldUrl, 'g');

          if (!oldUrlRegex.test(targetFile.content)) {
              logger.warn(`[handleDirectImageReplace] Old URL "${task.oldUrl}" not found in file ${task.targetPath}. Proceeding anyway (might indicate prior replacement or error).`);
              // Decide if this should be an error or just a warning
              // toast.warn(`Старый URL не найден в файле ${task.targetPath}. Возможно, уже заменено?`, { id: toastId });
          }

          const updatedContent = targetFile.content.replace(oldUrlRegex, task.newUrl);
          if (updatedContent === targetFile.content) {
              logger.warn(`[handleDirectImageReplace] Content unchanged after replace for ${task.targetPath}. Old URL might not exist or is same as new.`);
              // No need to proceed if content is identical
              toast.info(`Содержимое файла ${task.targetPath} не изменилось.`, { id: toastId });
              setImageReplaceTask(null); // Clear task as it's effectively done or irrelevant
              setAssistantLoading(false); setIsProcessingPR(false);
              return;
          }

          const filesToCommit = [{ path: task.targetPath, content: updatedContent }];
          const commitSubject = `chore: Update image ${task.targetPath.split('/').pop()}`;
          const commitBody = `Replaced image: ${task.oldUrl}\nWith new image: ${task.newUrl}\n\nFile: ${task.targetPath}`;
          const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
          const prTitleText = `${commitSubject} via CyberVibe`;
          const prDescription = `Automatic image replacement request via CyberVibe Studio.\n\n**Details:**\n- File: \`${task.targetPath}\`\n- Old URL: ${task.oldUrl}\n- New URL: ${task.newUrl}`;

          logger.log("[handleDirectImageReplace] Checking for existing PRs for this image task...");
          const openPrsResult = await getOpenPullRequests(repoUrlForForm);
          let prToUpdate: SimplePullRequest | null = null;
          if (openPrsResult.success && Array.isArray(openPrsResult.pullRequests)) {
              const expectedPrTitlePrefix = `chore: Update image`;
              // More robust finding of PR, checking head ref exists
              prToUpdate = openPrsResult.pullRequests.find(pr =>
                  pr?.title?.startsWith(expectedPrTitlePrefix) &&
                  pr?.title?.includes(task.targetPath) && // Ensure it mentions the specific file
                  pr?.head?.ref // Make sure branch ref exists
              ) ?? null;
          } else if (!openPrsResult.success) {
              logger.warn("[handleDirectImageReplace] Failed to get open PRs:", openPrsResult.error);
              // Continue, but won't be able to update existing PR
          }

          if (prToUpdate?.head?.ref) {
               logger.log(`[handleDirectImageReplace] Found existing PR #${prToUpdate.number}. Updating branch '${prToUpdate.head.ref}'.`);
               toast.info(`Обновление ветки '${prToUpdate.head.ref}' для PR #${prToUpdate.number}...`, { id: toastId });
               // Use the triggerUpdateBranch from context
               const updateResult = await triggerUpdateBranch(repoUrlForForm, filesToCommit, fullCommitMessage, prToUpdate.head.ref, prToUpdate.number, prDescription);
               if (!updateResult.success) throw new Error(updateResult.error || 'Ошибка обновления ветки');
               // Success toast is handled by triggerUpdateBranch
           } else {
               logger.log("[handleDirectImageReplace] No existing relevant PR found. Creating new PR.");
               toast.info("Создание нового PR для замены картинки...", { id: toastId });
               // Use createGitHubPullRequest action directly
               const createResult = await createGitHubPullRequest(repoUrlForForm, filesToCommit, prTitleText, prDescription, fullCommitMessage);
               if (!createResult.success || !createResult.prUrl) throw new Error(createResult.error || 'Ошибка создания PR');
               toast.success(`PR для замены картинки создан: ${createResult.prUrl}`, { id: toastId, duration: 5000 });
               await triggerGetOpenPRs(repoUrlForForm); // Refresh PR list
           }

          logger.log("[handleDirectImageReplace] Image replacement and PR/Update process finished successfully.");
          setImageReplaceTask(null); // Clear the task only on FULL success

      } catch (err: any) {
          logger.error("[handleDirectImageReplace] Error during process:", err);
          const errorMsg = err?.message || "Неизвестная ошибка при замене картинки.";
          toast.error(`Ошибка: ${errorMsg}`, { id: toastId, duration: 6000 });
          setImageReplaceError(errorMsg); // Set error state for UI feedback
          // Do NOT clear the task on error, let the user see the error state
      } finally {
          // Ensure loading states are reset regardless of success/error
          setAssistantLoading(false); setIsProcessingPR(false);
          logger.log("[handleDirectImageReplace] Finally block reached.");
      }
    }, [
        repoUrlForForm, setAssistantLoading, setIsProcessingPR, setImageReplaceError,
        triggerUpdateBranch, createGitHubPullRequest, triggerGetOpenPRs,
        setImageReplaceTask, // Now included
        logger, getOpenPullRequests // Added getOpenPullRequests dependency
    ]);



    // --- Return the handlers ---
    return {
        handleParse,
        handleAutoFix,
        handleCopyFixPrompt,
        handleRestorationComplete,
        handleUpdateParsedFiles,
        handleClearResponse,
        handleCopyResponse,
        handleOpenModal,
        handleSwap,
        handleSearch,
        handleSelectFunction,
        handleToggleFileSelection,
        handleSelectAllFiles,
        handleDeselectAllFiles,
        handleSaveFiles,
        handleDownloadZip,
        handleSendToTelegram,
        handleAddCustomLink,
        handleCreateOrUpdatePR,
        handleDirectImageReplace // Expose the handler
    };
};