"use client";
    
import { useCallback } from 'react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import JSZip from 'jszip'; // Ensure JSZip is installed

// Context & Types (adjust paths if necessary)
import { useAppContext } from '@/contexts/AppContext';
import {
    useRepoXmlPageContext,
    SimplePullRequest,
    ImageReplaceTask,
    IconReplaceTask, // Import IconReplaceTask
    FileNode
} from '@/contexts/RepoXmlPageContext';
import {
    ValidationIssue,
    FileEntry as ValidationFileEntry,
    ValidationStatus
} from '@/hooks/useCodeParsingAndValidation';
// Removed createGitHubPullRequest import, using context trigger
import {
    updateBranch, 
    getOpenPullRequests 
} from '@/app/actions_github/actions'; 
import { sendTelegramDocument, notifyAdmin } from '@/app/actions';
import { supabaseAdmin } from '@/hooks/supabase'; 
import { selectFunctionDefinition, extractFunctionName } from '@/lib/codeUtils';
import { debugLogger as logger } from "@/lib/debugLogger";
import { 
    logCyberFitnessAction, 
    checkAndUnlockFeatureAchievement, 
    Achievement 
} from "@/hooks/cyberFitnessSupabase"; 

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
    response: string;
    componentParsedFiles: ValidationFileEntry[];
    selectedFileIds: Set<string>;
    repoUrlStateLocal: string;
    prTitle: string;
    customLinks: { name: string; url: string }[];
    imageReplaceTask: ImageReplaceTask | null;
    iconReplaceTask?: IconReplaceTask | null; 
    setResponse: React.Dispatch<React.SetStateAction<string>>;
    setSelectedFileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setPrTitle: React.Dispatch<React.SetStateAction<string>>;
    setCustomLinks: React.Dispatch<React.SetStateAction<{ name: string; url: string }[]>>;
    setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
    setModalMode: React.Dispatch<React.SetStateAction<'replace' | 'search'>>;
    setIsProcessingPR: React.Dispatch<React.SetStateAction<boolean>>;
    setIsImageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setComponentParsedFiles: React.Dispatch<React.SetStateAction<ValidationFileEntry[]>>;
    setImageReplaceError: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    setIconReplaceTask?: React.Dispatch<React.SetStateAction<IconReplaceTask | null>>; 
    setRepoUrlStateLocal: React.Dispatch<React.SetStateAction<string>>;
    codeParserHook: UseCodeParsingAndValidationReturn;
    appContext: ReturnType<typeof useAppContext>;
    pageContext: ReturnType<typeof useRepoXmlPageContext>;
    aiResponseInputRefPassed: React.MutableRefObject<HTMLTextAreaElement | null>;
    kworkInputRefPassed: React.MutableRefObject<HTMLTextAreaElement | null>;
    setJustParsedFlagForScrollFix: React.Dispatch<React.SetStateAction<boolean>>;
}

// --- Custom Hook ---
export const useAICodeAssistantHandlers = (props: UseAICodeAssistantHandlersProps) => {
    const {
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks, imageReplaceTask, iconReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR, setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError, setRepoUrlStateLocal,
        setImageReplaceTask, setIconReplaceTask,
        codeParserHook, appContext, pageContext,
        aiResponseInputRefPassed, kworkInputRefPassed,
        setJustParsedFlagForScrollFix,
    } = props;

    const { user, dbUser } = appContext; 
    const {
        setParsedFiles: setHookParsedFiles, 
        setValidationStatus, setValidationIssues, parseAndValidateResponse, autoFixIssues, validationIssues, validationStatus, rawDescription, setRawDescription
    } = codeParserHook;
    const {
        contextOpenPrs, targetBranchName, repoUrlFromContext, setAssistantLoading, triggerGetOpenPRs, 
        triggerUpdateBranch, 
        triggerCreateNewPR,  
        setFilesParsed, setSelectedAssistantFiles, setContextIsParsing: setPageContextIsParsing, setRequestCopied, 
        selectedAssistantFiles, setAiResponseHasContent, allFetchedFiles, addToast 
    } = pageContext;

    const repoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";

    const extractPRTitleHint = useCallback((text: string): string => {
        if (typeof text !== 'string') { logger.warn("[extractPRTitleHint] received non-string:", text); return "AI Assistant Update"; }
        const lines = text.split('\n');
        const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update";
        return firstLine.trim().substring(0, 70); 
    }, []);

    const handleParse = useCallback(async () => {
        if (imageReplaceTask || iconReplaceTask) { toast.warn("Разбор не нужен для задачи замены."); return; }
        if (!response.trim()) { toast.warn("Нет ответа AI для разбора."); return; }
        logger.log("[Handler Parse] Starting parse...");
        setPageContextIsParsing(true); setAssistantLoading(true); 
        try {
            const { files: newlyParsedFiles, description: parsedRawDesc, issues: parseValidationIssues } = await parseAndValidateResponse(response);
            setHookParsedFiles(newlyParsedFiles); 
            setComponentParsedFiles(newlyParsedFiles); 
            const validParsedFiles = newlyParsedFiles.filter(f => f.content.trim() !== ''); 
            const initialSelection = new Set(validParsedFiles.map(f => f.id));
            setSelectedFileIds(initialSelection);
            setSelectedAssistantFiles(new Set(validParsedFiles.map(f => f.path)));

            const textForTitle = parsedRawDesc || response || "";
            setPrTitle(extractPRTitleHint(textForTitle));
            setFilesParsed(newlyParsedFiles.length > 0); 
            setValidationStatus(parseValidationIssues.length > 0 ? (parseValidationIssues.some(i => i.severity === 'error') ? 'error' : 'warning') : 'success');
            setValidationIssues(parseValidationIssues);
            setRawDescription(parsedRawDesc); 
            setJustParsedFlagForScrollFix(true); 

            toast.success(`Разбор завершен. Найдено ${newlyParsedFiles.length} блоков кода. Проблем: ${parseValidationIssues.length}. Выбрано: ${initialSelection.size}`);
        } catch (error: any) {
            logger.error("[Handler Parse] Parse error:", error);
            toast.error(`Ошибка разбора: ${error?.message ?? 'Неизвестная ошибка'}`);
            setFilesParsed(false); setHookParsedFiles([]); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
            setValidationStatus('error'); setValidationIssues([{type: 'parseError', message: `Ошибка парсинга ответа: ${error?.message ?? '?'}`, fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A', severity: 'error'}]);
        } finally {
            setPageContextIsParsing(false); setAssistantLoading(false);
            logger.log("[Handler Parse] Finished.");
        }
     }, [
        response, imageReplaceTask, iconReplaceTask, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setPageContextIsParsing, setAssistantLoading, setValidationStatus, setValidationIssues, setHookParsedFiles, extractPRTitleHint, setPrTitle, setSelectedFileIds, setComponentParsedFiles, setRawDescription, setJustParsedFlagForScrollFix
     ]);

    const handleAutoFix = useCallback(() => {
        if (imageReplaceTask || iconReplaceTask) return;
        logger.debug("[Handler AutoFix] Attempting auto-fix.");
        try {
            const updated = autoFixIssues(componentParsedFiles, validationIssues);
            setComponentParsedFiles(updated); 
            setHookParsedFiles(updated); 
            toast.success("Авто-исправления применены!");
        } catch (error: any) {
            logger.error("[Handler AutoFix] Error during autoFixIssues:", error);
            toast.error(`Ошибка авто-исправления: ${error?.message ?? 'Неизвестная ошибка'}`);
        }
     }, [autoFixIssues, componentParsedFiles, validationIssues, imageReplaceTask, iconReplaceTask, setComponentParsedFiles, setHookParsedFiles]);

    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => {
        if (imageReplaceTask || iconReplaceTask) return;
        logger.log("[Handler UpdateParsedFiles]:", updatedFiles.length);
        setHookParsedFiles(updatedFiles);
        setComponentParsedFiles(updatedFiles);
        setValidationStatus('idle');
        setValidationIssues([]);
        toast.info("Файлы обновлены после замены плейсхолдеров. Рекомендуется повторный парсинг ('➡️').");
     }, [setHookParsedFiles, setValidationStatus, setValidationIssues, imageReplaceTask, iconReplaceTask, setComponentParsedFiles]);

    const handleClearResponse = useCallback(() => {
        if (imageReplaceTask || iconReplaceTask) return;
        logger.log("[Handler ClearResponse] Clearing AI response and related states.");
        setResponse("");
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = "";
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setHookParsedFiles([]);
        setComponentParsedFiles([]);
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        setValidationStatus('idle');
        setValidationIssues([]);
        setPrTitle('');
        setRequestCopied(false);
        setRawDescription(''); 
        toast.info("Поле ответа AI и связанные состояния очищены.");
     }, [
        imageReplaceTask, iconReplaceTask, setResponse, aiResponseInputRefPassed, setAiResponseHasContent, setFilesParsed, setHookParsedFiles, setComponentParsedFiles, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, setRequestCopied, setRawDescription 
     ]);

    const handleCopyResponse = useCallback(() => {
        if (!response) return;
        logger.log("[Handler CopyResponse] Copying AI response.");
        navigator.clipboard.writeText(response).then(() => {
             toast.success("Ответ AI скопирован!");
             setRequestCopied(true);
         }).catch((err) => { logger.error("[Handler CopyResponse] Copy error:", err); toast.error("Ошибка копирования ответа."); });
     }, [response, setRequestCopied]);

    const handleOpenModal = useCallback((mode: 'replace' | 'search') => {
        if (imageReplaceTask || iconReplaceTask) return;
        logger.log(`[Handler OpenModal] Opening modal in mode: ${mode}`);
        setModalMode(mode); setShowModal(true);
     }, [imageReplaceTask, iconReplaceTask, setModalMode, setShowModal]);

    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find || !aiResponseInputRefPassed.current || imageReplaceTask || iconReplaceTask) return;
        logger.log(`[Handler Swap] Swapping "${find}" with "${replace}"`);
        try {
            const ta = aiResponseInputRefPassed.current;
            const curVal = ta.value;
            const escFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rgx = new RegExp(escFind, 'gi'); 
            const newVal = curVal.replace(rgx, replace);
            if (newVal !== curVal) {
                setResponse(newVal);
                requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = newVal; });
                setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
                setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); setRawDescription('');
                toast.success(`Текст заменен! "${find}" -> "${replace}". Жми '➡️'.`);
            } else { toast.info(`Текст "${find}" не найден в ответе AI.`); }
        } catch (e: any) {
             logger.error("[Handler Swap] Swap error:", e);
             toast.error(`Ошибка замены: ${e.message}`);
        }
     }, [
         aiResponseInputRefPassed, imageReplaceTask, iconReplaceTask, setResponse, setHookParsedFiles, setFilesParsed, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, setRawDescription
     ]);

    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText || !aiResponseInputRefPassed.current || imageReplaceTask || iconReplaceTask) return;
        logger.log(`[Handler Search] Searching for "${searchText}", multiline: ${isMultiline}`);
        const ta = aiResponseInputRefPassed.current;
        const txtCont = ta.value;

        try {
            if (isMultiline) {
                const clnSrch = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
                if (!clnSrch) { toast.error("Текст для мультилайн поиска/замены пуст."); return; }
                const fL = clnSrch.split('\n')[0] ?? "";
                const fN = extractFunctionName(fL);
                if (!fN) { toast.error("Не удалось извлечь имя функции для замены."); return; }
                const fRgx = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\*?\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${fN}\\s*(?:\\(|[:=]|<|extends|implements)`, 'm');
                let match = fRgx.exec(txtCont);
                if (!match) { const mRgx = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${fN}\\s*\\(`, 'm'); match = mRgx.exec(txtCont); } 
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
            }
        } catch (e: any) {
             logger.error("[Handler Search] Search/Replace error:", e);
             toast.error(`Ошибка поиска/замены: ${e.message}`);
        }
     }, [
         aiResponseInputRefPassed, imageReplaceTask, iconReplaceTask, setResponse, setHookParsedFiles, setFilesParsed, setSelectedFileIds, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, setRawDescription
     ]);

    const handleSelectFunction = useCallback(() => {
        if (imageReplaceTask || iconReplaceTask) return;
        logger.log("[Handler SelectFunction] Attempting to select function/block.");
        const ta = aiResponseInputRefPassed.current; if (!ta) return; const txt = ta.value;
        const cP = ta.selectionStart || 0; const lSI = txt.lastIndexOf('\n', cP - 1) + 1; 
        try {
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
        } catch (e: any) {
             logger.error("[Handler SelectFunction] Select function error:", e);
             toast.error(`Ошибка выделения: ${e.message}`);
             ta.focus({ preventScroll: true });
        }
     }, [aiResponseInputRefPassed, imageReplaceTask, iconReplaceTask]); 

     const handleToggleFileSelection = useCallback((fileId: string) => {
        if (imageReplaceTask || iconReplaceTask) return;
        logger.log("[Handler ToggleFileSelection] Toggling for fileId:", fileId);
        setSelectedFileIds(prev => {
            const newSet = new Set(prev);
            const targetFile = componentParsedFiles.find(f => f.id === fileId);
            if (!targetFile) return prev; 

            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                if (targetFile.content.trim()) {
                    newSet.add(fileId);
                } else {
                    toast.warn(`Файл ${targetFile.path} пуст или содержит только плейсхолдер.`);
                }
            }
            const selectedPaths = new Set(
                Array.from(newSet)
                     .map(id => componentParsedFiles.find(f => f.id === id)?.path)
                     .filter((path): path is string => !!path)
            );
            setSelectedAssistantFiles(selectedPaths);
            return newSet;
        });
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask, iconReplaceTask, setSelectedFileIds]); 

    const handleSelectAllFiles = useCallback(() => {
        if (componentParsedFiles.length === 0 || imageReplaceTask || iconReplaceTask) return;
        logger.log("[Handler SelectAllFiles] Selecting all non-empty parsed files.");
        const validFiles = componentParsedFiles.filter(f => f.content.trim() !== '');
        const allValidIds = new Set(validFiles.map(f => f.id));
        const allValidPaths = new Set(validFiles.map(f => f.path));
        setSelectedFileIds(allValidIds);
        setSelectedAssistantFiles(allValidPaths);
        toast.info(`${allValidIds.size} непустых файлов выбрано.`);
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask, iconReplaceTask, setSelectedFileIds]); 

    const handleDeselectAllFiles = useCallback(() => {
        if (imageReplaceTask || iconReplaceTask) return;
        logger.log("[Handler DeselectAllFiles] Deselecting all parsed files.");
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        toast.info("Выделение снято со всех файлов.");
     }, [setSelectedAssistantFiles, imageReplaceTask, iconReplaceTask, setSelectedFileIds]);

    const handleSaveFiles = useCallback(async () => {
        if (!dbUser?.user_id || imageReplaceTask || iconReplaceTask) { toast.warn(imageReplaceTask || iconReplaceTask ? "Сохранение недоступно для картинок/иконок." : "Требуется авторизация.", { id: "save-auth-warn" }); return; }
        const filesToSave = componentParsedFiles.filter(f => selectedFileIds.has(f.id) && f.content.trim()); 
        if (filesToSave.length === 0) { toast.warn("Нет выбранных непустых файлов для сохранения."); return; }
        logger.log(`[Handler SaveFiles] Saving ${filesToSave.length} non-empty files for user_id ${dbUser.user_id}...`);
        setIsProcessingPR(true); const toastId = toast.loading(`Сохранение ${filesToSave.length} файлов...`);
        try {
            const filesData = filesToSave.map(f => ({ p: f.path, c: f.content, e: f.extension || '?' }));
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", dbUser.user_id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; 
            const existingGeneratedFiles = existingData?.metadata?.generated_files || [];
            const newPathsSet = new Set(filesData.map(f => f.p));
            const filteredExisting = existingGeneratedFiles.filter((f: any) => f?.path && !newPathsSet.has(f.path));
            const newFilesFormatted = filesData.map(f => ({ path: f.p, code: f.c, extension: f.e }));
            const mergedFiles = [ ...filteredExisting, ...newFilesFormatted ];
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: dbUser.user_id, metadata: { ...(existingData?.metadata || {}), generated_files: mergedFiles } }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`${filesToSave.length} файлов сохранено/обновлено в вашем профиле.`, { id: toastId });
        } catch (err: any) { logger.error("[Handler SaveFiles] Save error:", err); toast.error(`Ошибка сохранения файлов: ${err?.message ?? 'Неизвестная ошибка'}`, { id: toastId }); }
        finally { setIsProcessingPR(false); }
     }, [dbUser?.user_id, componentParsedFiles, selectedFileIds, imageReplaceTask, iconReplaceTask, setIsProcessingPR]); 

    const handleDownloadZip = useCallback(async () => {
        if (imageReplaceTask || iconReplaceTask) { toast.warn("Скачивание недоступно для картинок/иконок."); return; }
        const filesToZip = componentParsedFiles.filter(f => selectedFileIds.has(f.id) && f.content.trim()); 
        if (filesToZip.length === 0) { toast.warn("Нет выбранных непустых файлов для скачивания."); return; }
        logger.log(`[Handler DownloadZip] Downloading ${filesToZip.length} non-empty files as ZIP...`);
        setIsProcessingPR(true); const toastId = toast.loading(`Создание ZIP (${filesToZip.length} файлов)...`);
        try {
            const zip = new JSZip();
            filesToZip.forEach((file) => {
                const zipPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
                zip.file(zipPath, file.content); 
            });
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ai_files_${Date.now()}.zip`); 
            toast.success("Архив скачан.", { id: toastId });
        } catch (error: any) { logger.error("[Handler DownloadZip] ZIP error:", error); toast.error(`Ошибка создания ZIP архива: ${error?.message ?? 'Неизвестная ошибка'}`, { id: toastId }); }
        finally { setIsProcessingPR(false); }
     }, [componentParsedFiles, selectedFileIds, imageReplaceTask, iconReplaceTask, setIsProcessingPR]);

    const handleSendToTelegram = useCallback(async (file: ValidationFileEntry) => {
        if (!user?.id || imageReplaceTask || iconReplaceTask) { 
            toast.warn(imageReplaceTask || iconReplaceTask ? "Отправка недоступна для картинок/иконок." : "Требуется авторизация.", { id: "tg-send-auth-warn" }); return; 
        }
        if (!file || !file.path || !file.content?.trim()) { toast.warn("Невозможно отправить пустой файл."); return; }
        logger.log(`[Handler SendToTelegram] Sending file ${file.path} to TG user ${user.id}`); 
        setIsProcessingPR(true); const toastId = toast.loading(`Отправка ${file.path.split('/').pop()} в Telegram...`);
        try {
            const fileName = file.path.split("/").pop() || `file_${Date.now()}.txt`; 
            const result = await sendTelegramDocument(String(user.id), file.content, fileName); 
            if (!result.success) throw new Error(result.error ?? "Telegram Send Error");
            toast.success(`Файл "${fileName}" отправлен в ваш Telegram.`, { id: toastId });
        } catch (err: any) { logger.error("[Handler SendToTelegram] Send error:", err); toast.error(`Ошибка отправки в TG: ${err.message}`, { id: toastId }); }
        finally { setIsProcessingPR(false); }
     }, [user, imageReplaceTask, iconReplaceTask, setIsProcessingPR]); 

    const handleAddCustomLink = useCallback(async () => {
        if (!dbUser?.user_id || imageReplaceTask || iconReplaceTask) { toast.warn(imageReplaceTask || iconReplaceTask ? "Недоступно для картинок/иконок." : "Требуется авторизация.", { id: "addlink-auth-warn" }); return; }
        let name, url;
        try {
             name = prompt("Название ссылки:"); if (!name || !name.trim()) return;
             url = prompt("URL (https://...):"); if (!url || !url.trim() || !url.trim().startsWith('http')) { toast.error("Некорректный URL."); return; }
        } catch (promptError) {
             logger.warn("[Handler AddCustomLink] Prompt error:", promptError);
             return; 
        }
        const newLink = { name: name.trim(), url: url.trim() };
        logger.log("[Handler AddCustomLink] Adding new link:", newLink);
        const updatedLinks = [...customLinks, newLink];
        setCustomLinks(updatedLinks); 
        const toastId = toast.loading("Сохранение ссылки...");
        try {
            const { data: existingData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", dbUser.user_id).single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            const currentMetadata = existingData?.metadata || {};
            const { error: upsertError } = await supabaseAdmin.from("users").upsert({ user_id: dbUser.user_id, metadata: { ...currentMetadata, customLinks: updatedLinks } }, { onConflict: 'user_id' });
            if (upsertError) throw upsertError;
            toast.success(`Ссылка "${name}" добавлена.`, { id: toastId });
        } catch (e: any) { logger.error("[Handler AddCustomLink] Save error:", e); toast.error(`Ошибка сохранения ссылки: ${e?.message ?? 'Неизвестная ошибка'}`, { id: toastId }); setCustomLinks(customLinks); }
     }, [customLinks, dbUser?.user_id, imageReplaceTask, iconReplaceTask, setCustomLinks]); 

    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => {
        if (imageReplaceTask || iconReplaceTask) { toast.warn("Недоступно во время замены картинки/иконки."); return; }
        const selectedFilesContent = componentParsedFiles.filter(f => selectedAssistantFiles.has(f.path) && f.content.trim()); 
        if (!repoUrlForForm || !repoUrlForForm.includes("github.com")) { toast.error("Некорректный URL репозитория GitHub."); return; }
        if (selectedFilesContent.length === 0) { toast.error("Выберите хотя бы один непустой файл для PR/Update."); return; }
        if (!prTitle.trim()) { toast.error("Введите Заголовок PR/Commit."); return; }

        const errors = validationIssues.filter(i => i.severity === 'error' && !i.fixable);
        if (errors.length > 0) {
             toast.error(`Найдены критические ошибки (${errors.length}), которые нужно исправить перед созданием PR!`, {
                description: errors.map(e => `- ${e.filePath}: ${e.message}`).join('\n'),
                duration: 6000,
             });
             logger.warn("[Handler CreateOrUpdatePR] Blocked due to validation errors:", errors);
             return;
        }

        let finalDescription = (rawDescription || "").substring(0, 60000) + ((rawDescription || "").length > 60000 ? "\n\n...(truncated)" : "");
        if (response && !rawDescription) { 
             finalDescription = response.substring(0, 1000) + (response.length > 1000 ? "..." : "");
             logger.warn("[Handler CreateOrUpdatePR] Using truncated AI response as PR description (rawDescription was empty).");
        }
        finalDescription += `\n\n**Файлы (${selectedFilesContent.length}):**\n` + selectedFilesContent.map(f => `- \`${f.path}\``).join('\n');
        const relevantIssues = validationIssues.filter(i => i.severity !== 'info');
        if (relevantIssues.length > 0) { finalDescription += "\n\n**Проблемы Валидации:**\n" + relevantIssues.map(i => `- [${i.severity?.toUpperCase()}] **${i.filePath}**: ${i.message}`).join('\n'); }

        const commitSubject = prTitle.trim().substring(0, 70);
        const firstLineSource = rawDescription || response || ""; 
        const commitBody = `Apply AI assistant changes to ${selectedFilesContent.length} files.\nRef: ${firstLineSource.split('\n')[0]?.substring(0, 100) ?? 'N/A'}...`;
        const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
        const filesToCommit = selectedFilesContent.map(f => ({ path: f.path, content: f.content }));

        setIsProcessingPR(true); setAssistantLoading(true);
        logger.log("[Handler CreateOrUpdatePR] Initiating PR/Update process.");
        const actionType = targetBranchName ? 'обновления ветки' : 'создания PR';
        const toastId = toast.loading(`Запуск ${actionType}...`);
        
        let prResultAchievements: Achievement[] = [];

        try {
            let prToUpdate: SimplePullRequest | null = null;
            if (Array.isArray(contextOpenPrs) && contextOpenPrs.length > 0) {
                 const lowerCaseTitle = prTitle.trim().toLowerCase();
                 const lowerCaseSubject = commitSubject.toLowerCase();
                 prToUpdate = contextOpenPrs.find(pr =>
                     pr?.title?.toLowerCase()?.includes("ai changes") ||
                     pr?.title?.toLowerCase()?.includes("supervibe") ||
                     pr?.title?.toLowerCase()?.includes("ai assistant") ||
                     (lowerCaseSubject.length > 5 && pr?.title?.toLowerCase()?.includes(lowerCaseSubject.substring(0, 20))) ||
                     (lowerCaseTitle.length > 5 && pr?.title?.toLowerCase()?.includes(lowerCaseTitle))
                 ) ?? null;

                 if (prToUpdate) { logger.log(`[Handler CreateOrUpdatePR] Found existing PR #${prToUpdate.number} ('${prToUpdate.title}').`); toast.info(`Обновляю существующий PR #${prToUpdate.number}...`, { id: toastId }); }
                 else { logger.log("[Handler CreateOrUpdatePR] No suitable existing PR found."); }
            }
            const branchToTarget = prToUpdate?.head?.ref || targetBranchName; 

            if (branchToTarget) { 
                 logger.log(`[Handler CreateOrUpdatePR] Updating branch '${branchToTarget}'. PR#: ${prToUpdate?.number ?? 'N/A'}`);
                 const updateResult = await triggerUpdateBranch( repoUrlForForm, filesToCommit, fullCommitMessage, branchToTarget, prToUpdate?.number, finalDescription );
                 if (updateResult.success) {
                    const successMessage = prToUpdate
                        ? `PR #${prToUpdate.number} (ветка '${branchToTarget}') успешно обновлен!`
                        : `Ветка '${branchToTarget}' успешно обновлена!`;
                    toast.success(successMessage, { id: toastId, duration: 5000 });
                    logger.log(`[Handler CreateOrUpdatePR] Successfully updated branch '${branchToTarget}' via Context. Message: ${successMessage}`);
                    await triggerGetOpenPRs(repoUrlForForm); 
                    if(updateResult.newAchievements) prResultAchievements.push(...updateResult.newAchievements);
                 } else { 
                    logger.error(`[Handler CreateOrUpdatePR] Update Branch Failed via Context: ${updateResult.error}`); 
                    toast.error(`Ошибка обновления ветки: ${updateResult.error || "?"}`, { id: toastId });
                 }
             } else { 
                 logger.log(`[Handler CreateOrUpdatePR] Creating new PR with title '${prTitle.trim()}'.`);
                 toast.info("Создание нового PR...", { id: toastId }); 
                 const newBranchName = `feat/ai-${Date.now()}`; 
                 
                 const result = await triggerCreateNewPR( 
                     repoUrlForForm,
                     filesToCommit,
                     prTitle.trim(), 
                     finalDescription,
                     fullCommitMessage,
                     newBranchName
                 );

                 if (result.success && result.prNumber) { 
                      toast.success(`PR #${result.prNumber} (${result.prUrl}) создан!`, { id: toastId, duration: 5000 }); 
                      await triggerGetOpenPRs(repoUrlForForm); 
                      logger.log(`[Handler CreateOrUpdatePR] New PR created: ${result.prUrl}`);
                       if(result.newAchievements) prResultAchievements.push(...result.newAchievements);
                 } else { 
                     logger.error("[Handler CreateOrUpdatePR] PR Creation Failed via triggerCreateNewPR:", result.error); 
                     toast.error("Ошибка создания PR: " + (result.error || "?"), { id: toastId }); 
                }
             }
            prResultAchievements.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));

        } catch (err: any) {
             logger.error("[Handler CreateOrUpdatePR] Critical error:", err);
             toast.error(`Крит. ошибка ${actionType}: ${err?.message ?? 'Неизвестная ошибка'}`, { id: toastId });
        }
        finally { setIsProcessingPR(false); setAssistantLoading(false); logger.log("[Handler CreateOrUpdatePR] Finished."); }
     }, [
         componentParsedFiles, selectedAssistantFiles, repoUrlForForm, prTitle, rawDescription, response, 
         validationIssues, targetBranchName, contextOpenPrs, 
         triggerUpdateBranch, 
         triggerCreateNewPR, 
         setAssistantLoading, triggerGetOpenPRs, imageReplaceTask, iconReplaceTask, setIsProcessingPR, addToast
     ]);

    const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask | IconReplaceTask, currentAllFiles: FileNode[]): Promise<{ success: boolean; error?: string }> => {
        const isActualImageTask = 'oldUrl' in task; 
        const taskTypeForLog = isActualImageTask ? "ImageReplace" : "IconReplace";

        if (!task?.targetPath || (isActualImageTask && (!task.oldUrl || !task.newUrl)) || (!isActualImageTask && (!task.oldIconName || !task.newIconName))) {
            logger.warn(`[Handler Direct${taskTypeForLog}] Invalid task provided:`, task);
            setImageReplaceError(`Некорректные данные для задачи замены ${isActualImageTask ? 'изображения' : 'иконки'}.`);
            if (isActualImageTask) setImageReplaceTask(null); 
            else if (setIconReplaceTask) setIconReplaceTask(null);
            return { success: false, error: "Invalid task data" };
        }
        if (!repoUrlForForm || !repoUrlForForm.includes("github.com")) {
            logger.error(`[Handler Direct${taskTypeForLog}] Invalid repo URL:`, repoUrlForForm);
            setImageReplaceError("Некорректный URL репозитория GitHub.");
            if (isActualImageTask) setImageReplaceTask(null); 
            else if (setIconReplaceTask) setIconReplaceTask(null);
            return { success: false, error: "Invalid repo URL" };
        }

        const allFilesForReplace = currentAllFiles ?? [];
        logger.info(`[Handler Direct${taskTypeForLog}] Starting process`, { task, repo: repoUrlForForm, filesAvailable: allFilesForReplace.length });
        setAssistantLoading(true); setIsProcessingPR(true); setImageReplaceError(null);
        const toastId = toast.loading(`Замена ${isActualImageTask ? 'картинки' : 'иконки'} в ${task.targetPath.split('/').pop()}...`);
        let success = false; 
        let errorMsg: string | undefined = undefined;
        let replaceAchievements: Achievement[] = [];
    
        try {
            logger.debug(`[Handler Direct${taskTypeForLog}] Inside try block.`);
            const targetFile = allFilesForReplace.find(f => f.path === task.targetPath);
            if (!targetFile) { 
                logger.error(`[Handler Direct${taskTypeForLog}] Target file ${task.targetPath} not found in ${allFilesForReplace.length} provided files.`);
                throw new Error(`Целевой файл ${task.targetPath} не найден среди загруженных.`); 
            }
            if (typeof targetFile.content !== 'string') { 
                logger.error(`[Handler Direct${taskTypeForLog}] Content of ${task.targetPath} is not a string.`);
                throw new Error(`Содержимое файла ${task.targetPath} не является строкой.`); 
            }
    
            logger.debug(`[Handler Direct${taskTypeForLog}] Target file found and content is string`, { path: targetFile.path, contentSnippet: targetFile.content.substring(0, 100) });
            
            let updatedContent = targetFile.content;
            let replacementOccurred = false;

            if (isActualImageTask) {
                const { oldUrl, newUrl } = task as ImageReplaceTask;
                const oldUrlEscaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                let regex = new RegExp(oldUrlEscaped, 'g');
                if (regex.test(updatedContent)) {
                    updatedContent = updatedContent.replace(regex, newUrl);
                    replacementOccurred = true;
                    logger.info(`[Handler DirectImageReplace] Replaced by exact URL: ${oldUrl} -> ${newUrl}`);
                }

                if (!replacementOccurred) {
                    try {
                        const oldUrlObject = new URL(oldUrl);
                        const oldPathSegment = oldUrlObject.pathname;
                         const oldPathSegmentEscaped = oldPathSegment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        regex = new RegExp(`(["'])${oldPathSegmentEscaped}(["'])|url\\(\\s*${oldPathSegmentEscaped}\\s*\\)`, 'g');
                         if (regex.test(updatedContent)) {
                            updatedContent = updatedContent.replace(regex, (match, q1, q2) => {
                                if (q1 && q2) return `${q1}${newUrl}${q2}`; 
                                return `url(${newUrl})`; 
                            });
                            replacementOccurred = true;
                            logger.info(`[Handler DirectImageReplace] Replaced by path segment: ${oldPathSegment} -> ${newUrl}`);
                        }
                    } catch (e) { 
                        logger.warn(`[Handler DirectImageReplace] Old URL "${oldUrl}" is not a valid full URL, skipping path segment match strategy.`);
                    }
                }

                if (!replacementOccurred) {
                    const oldFilename = oldUrl.substring(oldUrl.lastIndexOf('/') + 1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    if (oldFilename) {
                        const filenameRegexStr = `((?:src|href)=["']|url\\(\\s*["']?)([^"')]*/${oldFilename}[^"')]*)((["']|\\s*\\)))`;
                        regex = new RegExp(filenameRegexStr, 'g');
                         if (regex.test(updatedContent)) {
                            updatedContent = updatedContent.replace(regex, `$1${newUrl}$3`);
                            replacementOccurred = true;
                            logger.info(`[Handler DirectImageReplace] Replaced by filename: ${oldFilename} (full match URLs replaced with) -> ${newUrl}`);
                        }
                    }
                }

                if (!replacementOccurred) {
                    logger.warn(`[Handler DirectImageReplace] Old URL "${oldUrl}" not found in file ${task.targetPath} using any strategy.`);
                    throw new Error(`Старый URL "${oldUrl.substring(0,50)}..." не найден в файле.`);
                }

            } else { // IconReplaceTask
                const { oldIconName, newIconName, componentProps } = task as IconReplaceTask;

                if (oldIconName.toLowerCase() === newIconName.toLowerCase() && !componentProps) {
                    logger.info(`[Handler DirectIconReplace] Old and new icon names are the same ('${oldIconName}' -> '${newIconName}') and no props. Skipping replacement.`);
                    replacementOccurred = true; // Effectively, no change needed.
                } else {
                    const oldIconRegexBase = oldIconName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
                    
                    // Add 'i' flag for case-insensitive matching
                    const componentRegex = new RegExp(`<${oldIconRegexBase}(\\s+[^>]*)?\\s*\\/?>`, 'gi');
                    const vibeSyntaxRegex = new RegExp(`::${oldIconRegexBase}(\\s+[^:]*)?::`, 'gi');

                    let tempContent = updatedContent;

                    if (componentRegex.test(tempContent)) {
                        // When replacing, use the newIconName as provided (preserving its case)
                        tempContent = tempContent.replace(componentRegex, (_match, p1) => {
                            // p1 contains existing attributes if any. Preserve them if new props are not defined.
                            // If new props ARE defined, they should overwrite/be additive.
                            // For simplicity, if componentProps exists, it's used entirely.
                            // A more sophisticated merge could be done if needed.
                            const existingAttrs = p1 ? p1.trim() : '';
                            let finalAttrs = componentProps ? componentProps.trim() : existingAttrs;
                            if (componentProps && existingAttrs && !componentProps.includes(existingAttrs) && !existingAttrs.includes(componentProps)) {
                                // Rudimentary merge: just append. A real merge would parse attributes.
                                // finalAttrs = `${existingAttrs} ${componentProps.trim()}`;
                                // For now, let new props override if specified
                                finalAttrs = componentProps.trim();
                            }
                            return `<${newIconName}${finalAttrs ? ' ' + finalAttrs : ''} />`;
                        });
                        replacementOccurred = true;
                        logger.info(`[Handler DirectIconReplace] Replaced component syntax: ${oldIconName} -> ${newIconName}`);
                    }
                    if (vibeSyntaxRegex.test(tempContent)) { 
                        tempContent = tempContent.replace(vibeSyntaxRegex, (_match, p1) => {
                            const existingAttrs = p1 ? p1.trim() : '';
                            let finalAttrs = componentProps ? componentProps.trim() : existingAttrs;
                             if (componentProps && existingAttrs && !componentProps.includes(existingAttrs) && !existingAttrs.includes(componentProps)) {
                                finalAttrs = componentProps.trim(); // Override logic similar to above
                            }
                            return `::${newIconName}${finalAttrs ? ' ' + finalAttrs : ''}::`;
                        });
                        replacementOccurred = true; 
                        logger.info(`[Handler DirectIconReplace] Replaced Vibe syntax: ${oldIconName} -> ${newIconName}`);
                    }
                    updatedContent = tempContent;

                    if (!replacementOccurred) {
                        logger.warn(`[Handler DirectIconReplace] Old icon "${oldIconName}" (case-insensitive) not found in file ${task.targetPath}`);
                        throw new Error(`Старая иконка "${oldIconName}" не найдена в файле.`);
                    }
                }
            }
            
            logger.info(`[Handler Direct${taskTypeForLog}] Content for ${task.targetPath} prepared.`);
            const filesToCommit = [{ path: task.targetPath, content: updatedContent }];
            
            const prTitleForAction = `chore: Update ${isActualImageTask ? 'image' : 'icon'} in ${task.targetPath.split('/').pop()}`; 
            const commitSubject = prTitleForAction;
            const oldIdentifier = isActualImageTask ? (task as ImageReplaceTask).oldUrl : (task as IconReplaceTask).oldIconName;
            const newIdentifier = isActualImageTask ? (task as ImageReplaceTask).newUrl : (task as IconReplaceTask).newIconName;
            const commitBody = `Replaced ${isActualImageTask ? 'image' : 'icon'}: ${oldIdentifier}\nWith new ${isActualImageTask ? 'image' : 'icon'}: ${newIdentifier}\n\nFile: ${task.targetPath}\n\nAttempt: ${Date.now()}`;
            const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
            const prDescription = `Automatic ${isActualImageTask ? 'image' : 'icon'} replacement request via CyberVibe Studio.\n\n**Details:**\n- File: \`${task.targetPath}\`\n- Old ${isActualImageTask ? 'URL' : 'Icon'}: ${oldIdentifier}\n- New ${isActualImageTask ? 'URL' : 'Icon'}: ${newIdentifier}`;
            const newBranchName = `fix/${isActualImageTask ? 'img' : 'icon'}-${task.targetPath.replace(/[\/\.]/g, "-")}-${Date.now()}`;
            logger.info(`[Handler Direct${taskTypeForLog}] Always creating new branch: ${newBranchName}`);

            // Skip PR creation if content hasn't actually changed
            if (targetFile.content === updatedContent) {
                logger.info(`[Handler Direct${taskTypeForLog}] Content for ${task.targetPath} did not change. Skipping PR creation.`);
                toast.info(`Содержимое файла ${task.targetPath.split('/').pop()} не изменилось. PR не требуется.`, { id: toastId, duration: 5000 });
                success = true;
            } else {
                const createPrResult = await triggerCreateNewPR(
                    repoUrlForForm,
                    filesToCommit,
                    prTitleForAction,
                    prDescription,
                    fullCommitMessage,
                    newBranchName
                );

                if (!createPrResult.success || !createPrResult.prNumber) {
                    logger.error(`[Handler Direct${taskTypeForLog}] PR creation failed. Result:`, createPrResult);
                    throw new Error(createPrResult.error || `Ошибка создания PR для замены ${isActualImageTask ? 'картинки' : 'иконки'}`);
                }

                if(createPrResult.newAchievements) replaceAchievements.push(...createPrResult.newAchievements);
                
                const successMessage = `Новый PR #${createPrResult.prNumber} для замены ${isActualImageTask ? 'картинки' : 'иконки'} в ветке '${newBranchName}' создан!`;
                toast.success(successMessage, { id: toastId, duration: 8000 });
                logger.info(`[Handler Direct${taskTypeForLog}] New PR for replace successful: ${createPrResult.prUrl}`);
                
                await triggerGetOpenPRs(repoUrlForForm); 
                success = true; 
            }
            
        } catch (err: any) {
            errorMsg = err?.message || `Неизвестная ошибка при замене ${isActualImageTask ? 'картинки' : 'иконки'}.`;
            logger.error(`[Handler Direct${taskTypeForLog}] Error during process:`, err); 
            toast.error(`Ошибка: ${errorMsg}`, { id: toastId, duration: 6000 });
            setImageReplaceError(errorMsg); 
            success = false;
        } finally {
            setAssistantLoading(false); 
            setIsProcessingPR(false);
            if (isActualImageTask) setImageReplaceTask(null); 
            else if (setIconReplaceTask) setIconReplaceTask(null);
            logger.info(`[Handler Direct${taskTypeForLog}] Finally block. Success: ${success}. Task cleared.`);
            if (success && replaceAchievements.length > 0) {
                 replaceAchievements.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
            }
        }
        return { success, error: errorMsg }; 
    }, [
        repoUrlForForm, setAssistantLoading, setIsProcessingPR, setImageReplaceError,
        triggerCreateNewPR, 
        triggerGetOpenPRs,
        setImageReplaceTask, setIconReplaceTask, addToast // Ensure setIconReplaceTask is listed if it's used
    ]);
    
    return {
        handleParse, handleAutoFix, handleUpdateParsedFiles, handleClearResponse, handleCopyResponse,
        handleOpenModal, handleSwap, handleSearch, handleSelectFunction, handleToggleFileSelection,
        handleSelectAllFiles, handleDeselectAllFiles, handleSaveFiles, handleDownloadZip,
        handleSendToTelegram, handleAddCustomLink, handleCreateOrUpdatePR,
        handleDirectImageReplace 
    };
};