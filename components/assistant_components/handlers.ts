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
    fetchRepoContents
} from '@/app/actions_github/actions';
import { sendTelegramDocument, notifyAdmin } from '@/app/actions';
import { supabaseAdmin } from '@/hooks/supabase';
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
    // setRepoUrlStateLocal: React.Dispatch<React.SetStateAction<string>>; // Handled via updateRepoUrl
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
    // Props from useCodeParsingAndValidation hook
    codeParserHook: UseCodeParsingAndValidationReturn;
    // Context values/methods
    appContext: ReturnType<typeof useAppContext>; // Pass the whole context object
    pageContext: ReturnType<typeof useRepoXmlPageContext>; // Pass the whole context object
    // Refs (passed from parent)
    aiResponseInputRefPassed: React.MutableRefObject<HTMLTextAreaElement | null>;
    // kworkInputRefPassed: React.MutableRefObject<HTMLTextAreaElement | null>; // Not directly needed here now
}

// --- Custom Hook ---
export const useAICodeAssistantHandlers = (props: UseAICodeAssistantHandlersProps) => {
    const {
        // Destructure all props
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks, originalRepoFiles, isFetchingOriginals, imageReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR, setOriginalRepoFiles, setIsFetchingOriginals, setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError,
        codeParserHook, appContext, pageContext,
        aiResponseInputRefPassed
    } = props;

    // Destructure needed parts from hooks and contexts
    const { user } = appContext;
    const {
        setHookParsedFiles, setValidationStatus, setValidationIssues, parseAndValidateResponse, autoFixIssues, validationIssues, validationStatus, rawDescription, setRawDescription
    } = codeParserHook;
    const {
        contextOpenPrs, targetBranchName, repoUrlFromContext, setAssistantLoading, triggerGetOpenPRs, triggerUpdateBranch, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setRequestCopied, selectedAssistantFiles, setAiResponseHasContent
    } = pageContext;

    const repoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Helper ---
    const extractPRTitleHint = useCallback((text: string): string => {
        if (typeof text !== 'string') { logger.warn("extractPRTitleHint received non-string:", text); return "AI Assistant Update"; }
        const lines = text.split('\n');
        const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update";
        return firstLine.trim().substring(0, 70);
    }, []); // Removed logger dependency if not needed


    // --- Handler Implementations ---

    const handleParse = useCallback(async () => {
        if (imageReplaceTask) { toast.warn("Разбор не нужен для картинки."); return; }
        if (!response.trim()) { toast.warn("Нет ответа AI для разбора."); return; }
        logger.log("[Handler] Starting parse...");
        setContextIsParsing(true); setAssistantLoading(true); setOriginalRepoFiles([]);
        try {
            // Use the method passed via props
            const { files: newlyParsedFiles, description: parsedRawDesc } = await parseAndValidateResponse(response);
            setHookParsedFiles(newlyParsedFiles); // Use the setter from the hook props
            setComponentParsedFiles(newlyParsedFiles); // Also update local state if needed by other handlers here
            const initialSelection = new Set(newlyParsedFiles.map(f => f.id));
            setSelectedFileIds(initialSelection);
            setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));

            const textForTitle = parsedRawDesc || response || "";
            setPrTitle(extractPRTitleHint(textForTitle));
            setFilesParsed(newlyParsedFiles.length > 0); // Update context state

            toast.success(`Разбор завершен. Найдено ${newlyParsedFiles.length} файлов.`);
        } catch (error) {
            toastLogger.error("Parse error:", error); toast.error("Ошибка разбора ответа AI.");
            setFilesParsed(false); setHookParsedFiles([]); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
            setValidationStatus('error'); setValidationIssues([{type: 'parseError', message: 'Ошибка парсинга ответа.', fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A', severity: 'error'}]);
        } finally {
            setContextIsParsing(false); setAssistantLoading(false);
        }
     }, [
        response, imageReplaceTask, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setAssistantLoading, setValidationStatus, setValidationIssues, setHookParsedFiles, logger, extractPRTitleHint, setPrTitle, setOriginalRepoFiles, setSelectedFileIds, setComponentParsedFiles // Added setComponentParsedFiles
     ]);

    const handleAutoFix = useCallback(() => {
        if (imageReplaceTask) return;
        const updated = autoFixIssues(componentParsedFiles, validationIssues); // Use method from hook props
        setComponentParsedFiles(updated); // Update local state if necessary
        // Re-validation happens inside autoFixIssues hook logic now
     }, [autoFixIssues, componentParsedFiles, validationIssues, imageReplaceTask, setComponentParsedFiles]); // Added setComponentParsedFiles

    const handleCopyFixPrompt = useCallback(() => {
        if (imageReplaceTask) return;
        const skipped = validationIssues.filter(i => i.type === 'skippedComment');
        if (skipped.length === 0) { toast.info("Нет маркеров '// ..''.'."); return; }
        const fList = skipped.map(i => `- ${i.filePath} (~${i.details?.lineNumber})`).join('\n');
        const prompt = `Восстанови пропуски ('// ..''.') в новых файлах, референс - старые:\n${fList}\n\nВерни полные новые версии.`;
        navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt для исправления скопирован!")).catch(() => toast.error("Ошибка копирования промпта."));
     }, [validationIssues, imageReplaceTask]);

    const handleRestorationComplete = useCallback((updatedFiles: ValidationFileEntry[], successCount: number, errorCount: number) => {
        if (imageReplaceTask) return;
        setHookParsedFiles(updatedFiles); // Update hook state
        setComponentParsedFiles(updatedFiles); // Update local state
        const remaining = validationIssues.filter(i => i.type !== 'skippedCodeBlock');
        setValidationIssues(remaining);
        setValidationStatus(remaining.length > 0 ? (remaining.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success');
        if (successCount > 0) toast.success(`${successCount} блоков кода восстановлено.`);
        if (errorCount > 0) toast.error(`${errorCount} блоков не удалось восстановить.`);
     }, [validationIssues, setHookParsedFiles, setValidationIssues, setValidationStatus, imageReplaceTask, setComponentParsedFiles]); // Added setComponentParsedFiles

    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => {
        if (imageReplaceTask) return;
        logger.log("UpdateParsedFiles:", updatedFiles.length);
        setHookParsedFiles(updatedFiles); // Update hook state
        setComponentParsedFiles(updatedFiles); // Update local state
        toast.info("Файлы обновлены после замены плейсхолдеров.");
        setValidationStatus('idle'); setValidationIssues([]);
     }, [setHookParsedFiles, setValidationStatus, setValidationIssues, imageReplaceTask, logger, setComponentParsedFiles]); // Added setComponentParsedFiles

    const handleClearResponse = useCallback(() => {
        if (imageReplaceTask) return;
        setResponse(""); // Update state via prop setter
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = "";
        // Reset relevant states
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setHookParsedFiles([]);
        setComponentParsedFiles([]); // Reset local state
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        setValidationStatus('idle');
        setValidationIssues([]);
        setOriginalRepoFiles([]);
        setPrTitle('');
        setRequestCopied(false);
        toast.info("Поле ответа AI и связанные состояния очищены.");
     }, [
        imageReplaceTask, setResponse, aiResponseInputRefPassed, setAiResponseHasContent, setFilesParsed, setHookParsedFiles, setComponentParsedFiles, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setOriginalRepoFiles, setPrTitle, setRequestCopied
     ]);

    const handleCopyResponse = useCallback(() => {
        if (!response) return;
        navigator.clipboard.writeText(response).then(() => {
             toast.success("Ответ AI скопирован!");
             setRequestCopied(true);
         }).catch(() => toast.error("Ошибка копирования ответа."));
     }, [response, setRequestCopied]);

    const handleOpenModal = useCallback((mode: 'replace' | 'search') => {
        if (imageReplaceTask) return;
        setModalMode(mode); setShowModal(true);
     }, [imageReplaceTask, setModalMode, setShowModal]);


    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find || !aiResponseInputRefPassed.current || imageReplaceTask) return;
        try {
            const ta = aiResponseInputRefPassed.current; const curVal = ta.value;
            const escFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rgx = new RegExp(escFind, 'g'); const newVal = curVal.replace(rgx, replace);
            if (newVal !== curVal) {
                setResponse(newVal);
                requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = newVal; });
                // Reset parsing state
                setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
                setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); setRawDescription('');
                toast.success(`Текст заменен! "${find}" -> "${replace}". Жми '➡️'.`);
            } else { toast.info(`Текст "${find}" не найден в ответе AI.`); }
        } catch (e: any) { toast.error(`Ошибка замены: ${e.message}`); }
     }, [
         aiResponseInputRefPassed, imageReplaceTask, setResponse, setHookParsedFiles, setFilesParsed, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, setRawDescription // Added setRawDescription
     ]);


    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText || !aiResponseInputRefPassed.current || imageReplaceTask) return;
        const ta = aiResponseInputRefPassed.current;
        const txtCont = ta.value;

        if (isMultiline) {
            const clnSrch = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
            if (!clnSrch) { toast.error("Текст для мультилайн поиска/замены пуст."); return; }
            const fL = clnSrch.split('\n')[0] ?? "";
            const fN = extractFunctionName(fL);
            if (!fN) { toast.error("Не удалось извлечь имя функции для замены."); return; }
            const fRgx = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${fN}\\s*(?:\\(|[:=]|<)`, 'm');
            let match = fRgx.exec(txtCont);
            if (!match) { const mRgx = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${fN}\\s*\\(`, 'm'); match = mRgx.exec(txtCont); }
            if (!match || match.index === undefined) { toast.info(`Функция/Класс "${fN}" не найдена в ответе AI.`); return; }
            const mSI = match.index + (match[1]?.length || 0); const [sP, eP] = selectFunctionDefinition(txtCont, mSI);
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
            setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
            setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); setRawDescription('');
            toast.success(`Функция "${fN}" заменена! ✨ Жми '➡️'.`);
        } else {
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
            toast(`Найдено: "${searchText}"`, { style: { background: "rgba(30, 64, 175, 0.9)", color: "#fff", border: "1px solid rgba(37, 99, 235, 0.3)", backdropFilter: "blur(3px)" }, duration: 2000 });
        }
     }, [
         aiResponseInputRefPassed, imageReplaceTask, setResponse, setHookParsedFiles, setFilesParsed, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, setRawDescription // Added setRawDescription
     ]);


    const handleSelectFunction = useCallback(() => {
        if (imageReplaceTask) return;
        const ta = aiResponseInputRefPassed.current; if (!ta) return; const txt = ta.value;
        const cP = ta.selectionStart || 0; const lSI = txt.lastIndexOf('\n', cP - 1) + 1;
        const [sP, eP] = selectFunctionDefinition(txt, lSI);
        if (sP !== -1 && eP !== -1) {
            ta.focus({ preventScroll: true });
            ta.setSelectionRange(sP, eP);
            toast.success("Функция/Блок выделена!");
        } else {
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
     }, [aiResponseInputRefPassed, imageReplaceTask]);

     const handleToggleFileSelection = useCallback((fileId: string) => {
        if (imageReplaceTask) return;
        logger.log("Toggle file selection:", fileId);
        setSelectedFileIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            const selectedPaths = new Set(
                Array.from(newSet)
                     .map(id => componentParsedFiles.find(f => f.id === id)?.path)
                     .filter((path): path is string => !!path)
            );
            setSelectedAssistantFiles(selectedPaths);
            return newSet;
        });
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask, logger, setSelectedFileIds]); // Added setSelectedFileIds

    const handleSelectAllFiles = useCallback(() => {
        if (componentParsedFiles.length === 0 || imageReplaceTask) return;
        const allIds = new Set(componentParsedFiles.map(f => f.id));
        const allPaths = new Set(componentParsedFiles.map(f => f.path));
        setSelectedFileIds(allIds);
        setSelectedAssistantFiles(allPaths);
        toast.info(`${allIds.size} файлов выбрано.`);
        logger.log("Selected all parsed files:", allIds.size);
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask, logger, setSelectedFileIds]); // Added setSelectedFileIds

    const handleDeselectAllFiles = useCallback(() => {
        if (imageReplaceTask) return;
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        toast.info("Выделение снято со всех файлов.");
        logger.log("Deselected all parsed files.");
     }, [setSelectedAssistantFiles, imageReplaceTask, logger, setSelectedFileIds]); // Added setSelectedFileIds


    const handleSaveFiles = useCallback(async () => {
        if (!user || imageReplaceTask) { toast.warn(imageReplaceTask ? "..." : "Auth required."); return; }
        const filesToSave = componentParsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToSave.length === 0) { toast.warn("Нет выбранных файлов для сохранения."); return; }
        logger.log(`Saving ${filesToSave.length} files...`);
        setIsProcessingPR(true);
        try {
            const filesData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension }));
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            const existingGeneratedFiles = existingData?.metadata?.generated_files || [];
            const newPathsSet = new Set(filesData.map(f => f.p));
            const mergedFiles = [ ...existingGeneratedFiles.filter((f: any) => !newPathsSet.has(f.path)), ...filesData.map(f => ({ path: f.p, code: f.c, extension: f.e })) ];
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles } }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`${filesToSave.length} файлов сохранено/обновлено в вашем профиле.`);
            logger.log("Successfully saved/updated files.");
        } catch (err) { toastLogger.error("Save files error:", err); toast.error("Ошибка сохранения."); }
        finally { setIsProcessingPR(false); }
     }, [user, componentParsedFiles, selectedFileIds, imageReplaceTask, logger, setIsProcessingPR]);


    const handleDownloadZip = useCallback(async () => {
        if (imageReplaceTask) { toast.warn("..."); return; }
        const filesToZip = componentParsedFiles.filter(f => selectedFileIds.has(f.id));
        if (filesToZip.length === 0) { toast.warn("Нет выбранных файлов."); return; }
        logger.log(`Downloading ${filesToZip.length} files as ZIP...`);
        setIsProcessingPR(true);
        try {
            const zip = new JSZip();
            filesToZip.forEach((file) => { const zipPath = file.path.startsWith('/') ? file.path.substring(1) : file.path; zip.file(zipPath, file.content); });
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ai_files_${Date.now()}.zip`);
            toast.success("Архив скачан.");
            logger.log("Successfully downloaded ZIP.");
        } catch (error) { toastLogger.error("ZIP error:", error); toast.error("Ошибка ZIP."); }
        finally { setIsProcessingPR(false); }
     }, [componentParsedFiles, selectedFileIds, imageReplaceTask, logger, setIsProcessingPR]);


    const handleSendToTelegram = useCallback(async (file: ValidationFileEntry) => {
        if (!user?.id || imageReplaceTask) { toast.warn(imageReplaceTask ? "..." : "Auth required."); return; }
        logger.log(`Sending file ${file.path} to TG user ${user.id}`);
        setIsProcessingPR(true);
        try {
            const fileName = file.path.split("/").pop() || "file.txt";
            const result = await sendTelegramDocument(String(user.id), file.content, fileName);
            if (!result.success) throw new Error(result.error ?? "TG Send Error");
            toast.success(`Файл "${fileName}" отправлен в Telegram.`);
            logger.log(`Sent file ${file.path} to TG.`);
        } catch (err: any) { toastLogger.error("Send TG error:", err); toast.error(`Ошибка TG: ${err.message}`); }
        finally { setIsProcessingPR(false); }
     }, [user, imageReplaceTask, logger, setIsProcessingPR]);


    const handleAddCustomLink = useCallback(async () => {
        if (!user || imageReplaceTask) { toast.warn(imageReplaceTask ? "..." : "Auth required."); return; }
        const name = prompt("Название ссылки:"); if (!name || !name.trim()) return;
        const url = prompt("URL (https://...):"); if (!url || !url.trim() || !url.trim().startsWith('http')) { toast.error("Некорректный URL."); return; }
        const newLink = { name: name.trim(), url: url.trim() };
        logger.log("Adding new custom link:", newLink);
        const updatedLinks = [...customLinks, newLink];
        setCustomLinks(updatedLinks);
        try {
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(existingData?.metadata || {}), customLinks: updatedLinks } }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`Ссылка "${name}" добавлена.`);
            logger.log("Saved custom link.");
        } catch (e) { toastLogger.error("Save link error:", e); toast.error("Ошибка сохранения ссылки."); setCustomLinks(customLinks); }
     }, [customLinks, user, imageReplaceTask, logger, setCustomLinks]);


    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => {
        if (imageReplaceTask) { toast.warn("Недоступно во время замены картинки."); return; }
        const selectedFilesContent = componentParsedFiles.filter(f => selectedAssistantFiles.has(f.path));
        if (!repoUrlForForm || selectedFilesContent.length === 0 || !prTitle.trim()) {
            toast.error("Нужен URL репозитория, Заголовок PR/Commit и хотя бы один выбранный Файл.");
            return;
        }
        let finalDescription = (rawDescription || response || "").substring(0, 60000) + ((rawDescription || response || "").length > 60000 ? "\n\n...(truncated)" : "");
        finalDescription += `\n\n**Файлы (${selectedFilesContent.length}):**\n` + selectedFilesContent.map(f => `- \`${f.path}\``).join('\n');
        const relevantIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment');
        if (relevantIssues.length > 0) { finalDescription += "\n\n**Проблемы Валидации:**\n" + relevantIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); }
        const commitSubject = prTitle.trim().substring(0, 70);
        const firstLineSource = rawDescription || response || "";
        const commitBody = `Apply AI assistant changes to ${selectedFilesContent.length} files.\nRef: ${firstLineSource.split('\n')[0]?.substring(0, 100) ?? ''}...`;
        const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
        const filesToCommit = selectedFilesContent.map(f => ({ path: f.path, content: f.content }));

        setIsProcessingPR(true); setAssistantLoading(true);
        logger.log("[handleCreateOrUpdatePR] Initiating PR/Update process.");

        try {
            let prToUpdate: SimplePullRequest | null = null;
            if (contextOpenPrs && contextOpenPrs.length > 0) {
                 const lowerCaseTitle = prTitle.trim().toLowerCase();
                 const lowerCaseSubject = commitSubject.toLowerCase();
                 prToUpdate = contextOpenPrs.find(pr => pr.title.toLowerCase().includes("ai changes") || pr.title.toLowerCase().includes("supervibe") || pr.title.toLowerCase().includes("ai assistant") || (lowerCaseSubject.length > 5 && pr.title.toLowerCase().includes(lowerCaseSubject.substring(0, 20))) || (lowerCaseTitle.length > 5 && pr.title.toLowerCase().includes(lowerCaseTitle))) ?? null;
                 if (prToUpdate) { logger.log(`Found existing PR #${prToUpdate.number} ('${prToUpdate.title}').`); toast.info(`Обновляю существующий PR #${prToUpdate.number}...`); }
                 else { logger.log("No suitable existing PR found."); }
             }

            const branchToTarget = prToUpdate?.head.ref || targetBranchName;

            if (branchToTarget) {
                 logger.log(`Updating branch '${branchToTarget}'. PR#: ${prToUpdate?.number ?? 'N/A'}`);
                 toast.info(`Обновление ветки '${branchToTarget}'...`);
                 const updateResult = await triggerUpdateBranch( repoUrlForForm, filesToCommit, fullCommitMessage, branchToTarget, prToUpdate?.number, finalDescription );
                 if (!updateResult.success) { logger.error(`Failed to update branch '${branchToTarget}': ${updateResult.error}`); }
                 else { logger.log(`Successfully updated branch '${branchToTarget}'.`); }
             } else {
                 logger.log(`Creating new PR with title '${prTitle.trim()}'.`);
                 toast.info(`Создание нового PR...`);
                 const result = await createGitHubPullRequest( repoUrlForForm, filesToCommit, prTitle.trim(), finalDescription, fullCommitMessage );
                 if (result.success && result.prUrl) { toast.success(`PR создан: ${result.prUrl}`); await triggerGetOpenPRs(repoUrlForForm); logger.log(`New PR created: ${result.prUrl}`); }
                 else { toastLogger.error("PR Creation Failed:", result.error); toast.error("Ошибка создания PR: " + (result.error || "?")); }
             }
        } catch (err) { toastLogger.error("PR/Update critical error:", err); toast.error(`Крит. ошибка ${targetBranchName ? 'обновления ветки' : 'создания PR'}.`); }
        finally { setIsProcessingPR(false); setAssistantLoading(false); logger.log("[handleCreateOrUpdatePR] Finished."); }
     }, [ componentParsedFiles, selectedAssistantFiles, repoUrlForForm, prTitle, rawDescription, response, validationIssues, targetBranchName, contextOpenPrs, triggerUpdateBranch, setAssistantLoading, user, triggerGetOpenPRs, imageReplaceTask, logger ]);


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
    };
};