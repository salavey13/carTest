// MODIFICATIONS:
// - Changed signature of `handleDirectImageReplace`: now accepts `(task: ImageReplaceTask, files: FileNode[])`.
// - Inside `handleDirectImageReplace`, use the passed `files` parameter instead of reading `allFetchedFiles` from context.
// - Removed `allFetchedFiles` from the `useCallback` dependency array for `handleDirectImageReplace`.
// - Updated the `useImperativeHandle` exposure of `handleDirectImageReplace`.
"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode // <<< Import FileNode
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
import {
    FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate,
    FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines, FaCode, // Added FaCode
    FaCheck, FaCircleXmark // Added for Restore Modal if needed by subcomponents
} from "react-icons/fa6";
import clsx from "clsx";
import { saveAs } from "file-saver";
import { logger } from "@/lib/logger"; // Use standard logger
import { Tooltip } from "@/components/ui/tooltip";
import { selectFunctionDefinition, extractFunctionName } from "@/lib/codeUtils";

// Interfaces
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {
     kworkInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
     aiResponseInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
}
interface OriginalFile { path: string; content: string; }

// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    // --- Props ---
    const { kworkInputRefPassed, aiResponseInputRefPassed } = props;

    // --- State ---
    const [isMounted, setIsMounted] = useState(false); // <<< MOUNTED STATE
    const [response, setResponse] = useState<string>("");
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
    const [prTitle, setPrTitle] = useState<string>("");
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
    const [isProcessingPR, setIsProcessingPR] = useState(false); // Covers PR creation/update AND image replace processing
    const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
    const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [componentParsedFiles, setComponentParsedFiles] = useState<ValidationFileEntry[]>([]);

    // --- Hooks ---
    const { user } = useAppContext();
    const { parsedFiles: hookParsedFiles, rawDescription, validationStatus, validationIssues, isParsing: hookIsParsing, parseAndValidateResponse, autoFixIssues, setParsedFiles: setHookParsedFiles, setValidationStatus, setValidationIssues, } = useCodeParsingAndValidation();

    // --- Context Access ---
    const { setAiResponseHasContent, setFilesParsed, filesParsed, setSelectedAssistantFiles, setAssistantLoading, assistantLoading, aiActionLoading, currentAiRequestId, openPrs: contextOpenPrs, triggerGetOpenPRs, targetBranchName, triggerToggleSettingsModal, triggerUpdateBranch, updateRepoUrlInAssistant, loadingPrs, setIsParsing: setContextIsParsing, isParsing: contextIsParsing,
        // allFetchedFiles, // No longer need to read this directly for image replace
        imageReplaceTask, setImageReplaceTask,
    } = useRepoXmlPageContext();

    // --- Derived State ---
    const isParsing = contextIsParsing ?? hookIsParsing;

    // --- Effects ---
    useEffect(() => { setIsMounted(true); }, []); // Set mounted state on client
    useEffect(() => { setComponentParsedFiles(hookParsedFiles); setFilesParsed(hookParsedFiles.length > 0); }, [hookParsedFiles, setFilesParsed]);
    useEffect(() => { if (!isMounted) return; const hasContent = response.trim().length > 0; setAiResponseHasContent(hasContent); if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR) { logger.log("[AICodeAssistant Effect] Resetting state due to empty response and no activity."); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); } else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR) { logger.log("[AICodeAssistant Effect] Resetting validation status due to response change w/o parsed files."); setValidationStatus('idle'); setValidationIssues([]); } }, [ isMounted, response, currentAiRequestId, aiActionLoading, imageReplaceTask, componentParsedFiles.length, isParsing, assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setHookParsedFiles ]);
    useEffect(() => { if (!isMounted || !user) { setCustomLinks([]); return; } const loadLinks = async () => { try { const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!e && d?.metadata?.customLinks) setCustomLinks(d.metadata.customLinks); else setCustomLinks([]); } catch (e) { logger.error("Error loading custom links:", e); setCustomLinks([]); } }; loadLinks(); }, [isMounted, user]);
    useEffect(() => { if (!isMounted || imageReplaceTask) return; const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock'); if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) { const fetchOrig = async () => { setIsFetchingOriginals(true); const branch = targetBranchName ?? undefined; const branchDisp = targetBranchName ?? 'default'; toast.info(`Загрузка оригиналов из ${branchDisp}...`); try { const res = await fetchRepoContents(repoUrl, undefined, branch); if (res.success && Array.isArray(res.files)) { setOriginalRepoFiles(res.files); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки: " + (res.error ?? '?')); setOriginalRepoFiles([]); } } catch (e) { toast.error("Крит. ошибка загрузки."); logger.error("Fetch originals error:", e); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOrig(); } }, [isMounted, validationIssues, originalRepoFiles.length, isFetchingOriginals, repoUrl, targetBranchName, imageReplaceTask]);

    // --- Helper Functions ---
    const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

    // --- Handlers (wrapped in useCallback, ensure dependencies are correct) ---
    const handleParse = useCallback(async () => { if (imageReplaceTask) { toast.warn("Разбор не нужен для картинки."); return; } if (!response.trim()) { toast.warn("Нет ответа AI."); return; } logger.log("[AICodeAssistant] Starting parse..."); setContextIsParsing(true); setAssistantLoading(true); setOriginalRepoFiles([]); try { const { files: newlyParsedFiles, description: parsedRawDesc } = await parseAndValidateResponse(response); setHookParsedFiles(newlyParsedFiles); const initialSelection = new Set(newlyParsedFiles.map(f => f.id)); setSelectedFileIds(initialSelection); setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path))); if (newlyParsedFiles.length > 0) { setPrTitle(extractPRTitleHint(parsedRawDesc || response)); } else { setPrTitle(''); } toast.success(`Разбор завершен. ${newlyParsedFiles.length} файлов.`); } catch (error) { logger.error("Parse error:", error); toast.error("Ошибка разбора ответа."); setFilesParsed(false); setHookParsedFiles([]); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('error'); setValidationIssues([{type: 'parseError', message: 'Ошибка парсинга.', fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A'}]); } finally { setContextIsParsing(false); setAssistantLoading(false); } }, [response, imageReplaceTask, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setAssistantLoading, setValidationStatus, setValidationIssues, setHookParsedFiles]);
    const handleAutoFix = useCallback(() => { autoFixIssues(componentParsedFiles, validationIssues); }, [autoFixIssues, componentParsedFiles, validationIssues]);
    const handleCopyFixPrompt = useCallback(() => { const skipped = validationIssues.filter(i => i.type === 'skippedComment'); if (skipped.length === 0) { toast.info("Нет маркеров '// ..''.'."); return; } const fList = skipped.map(i => `- ${i.filePath} (~${i.details?.lineNumber})`).join('\n'); const prompt = `Восстанови пропуски ('// ..''.') в новых файлах, референс - старые:\n${fList}\n\nВерни полные новые версии.`; navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt для исправления скопирован!")).catch(() => toast.error("Ошибка копирования.")); }, [validationIssues]);
    const handleRestorationComplete = useCallback((updatedFiles: ValidationFileEntry[], successCount: number, errorCount: number) => { setHookParsedFiles(updatedFiles); const remaining = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); setValidationIssues(remaining); setValidationStatus(remaining.length > 0 ? (remaining.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success'); if (successCount > 0) toast.success(`${successCount} блоков восстановлено.`); if (errorCount > 0) toast.error(`${errorCount} не удалось.`); }, [validationIssues, setHookParsedFiles, setValidationIssues, setValidationStatus]);
    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => { logger.log("UpdateParsedFiles:", updatedFiles.length); setHookParsedFiles(updatedFiles); toast.info("Файлы обновлены после замены плейсхолдеров."); setValidationStatus('idle'); setValidationIssues([]); }, [setHookParsedFiles, setValidationStatus, setValidationIssues]);
    const handleClearResponse = useCallback(() => { setResponse(""); if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = ""; toast.info("Поле ответа очищено."); }, [aiResponseInputRefPassed]);
    const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(() => toast.success("Скопировано!")).catch(() => toast.error("Ошибка копирования")); }, [response]);
    const handleOpenModal = useCallback((mode: 'replace' | 'search') => { setModalMode(mode); setShowModal(true); }, []);
    const handleSwap = useCallback((find: string, replace: string) => { if (!find || !aiResponseInputRefPassed.current) return; try { const ta = aiResponseInputRefPassed.current; const curVal = ta.value; const escFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const rgx = new RegExp(escFind, 'g'); const newVal = curVal.replace(rgx, replace); if (newVal !== curVal) { setResponse(newVal); requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = newVal; }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`"${find}" -> "${replace}". Жми '➡️'.`); } else { toast.info(`"${find}" не найден.`); } } catch (e: any) { toast.error(`Ошибка замены: ${e.message}`); } }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);
    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => { if (!searchText || !aiResponseInputRefPassed.current) return; const ta = aiResponseInputRefPassed.current; const txtCont = ta.value; if (isMultiline) { const clnSrch = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n'); if (!clnSrch) { toast.error("Текст для мультилайн поиска пуст."); return; } const fL = clnSrch.split('\n')[0]; const fN = extractFunctionName(fL ?? ''); if (!fN) { toast.error("Не удалось извлечь имя функции."); return; } const fRgx = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${fN}\\s*(?:\\(|[:=]|<)`, 'm'); let match = fRgx.exec(txtCont); if (!match) { const mRgx = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${fN}\\s*\\(`, 'm'); match = mRgx.exec(txtCont); } if (!match || match.index === undefined) { toast.info(`Функция "${fN}" не найдена.`); return; } const mSI = match.index + (match[1]?.length || 0); const [sP, eP] = selectFunctionDefinition(txtCont, mSI); if (sP === -1 || eP === -1) { toast.error("Не удалось выделить тело функции."); return; } const nV = txtCont.substring(0, sP) + clnSrch + txtCont.substring(eP); setResponse(nV); requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) { aiResponseInputRefPassed.current.value = nV; aiResponseInputRefPassed.current.focus(); aiResponseInputRefPassed.current.setSelectionRange(sP, sP + clnSrch.length); } }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`Функция "${fN}" заменена! ✨ Жми '➡️'.`); } else { const sTL = searchText.toLowerCase(); const tCL = txtCont.toLowerCase(); const cP = ta.selectionStart || 0; let fI = tCL.indexOf(sTL, cP); if (fI === -1) { fI = tCL.indexOf(sTL, 0); if (fI === -1 || fI >= cP) { toast.info(`"${searchText}" не найден.`); ta.focus(); return; } toast.info("Поиск с начала."); } ta.focus(); ta.setSelectionRange(fI, fI + searchText.length); toast(`Найдено: "${searchText}"`, { style: { background: "rgba(30, 64, 175, 0.9)", color: "#fff", border: "1px solid rgba(37, 99, 235, 0.3)", backdropFilter: "blur(3px)" }, duration: 2000 }); } }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);
    const handleSelectFunction = useCallback(() => { const ta=aiResponseInputRefPassed.current; if(!ta)return; const txt=ta.value; const cP=ta.selectionStart||0; const lSI=txt.lastIndexOf('\n',cP-1)+1; const [sP,eP]=selectFunctionDefinition(txt,lSI); if(sP!==-1&&eP!==-1){ta.focus(); ta.setSelectionRange(sP,eP); toast.success("Функция выделена!");} else { let sUI=txt.lastIndexOf('{',lSI); if(sUI>0){ const [uSP,uEP]=selectFunctionDefinition(txt,sUI); if(uSP!==-1&&uEP!==-1){ ta.focus(); ta.setSelectionRange(uSP,uEP); toast.success("Найдена выше!"); return; } } toast.info("Не удалось выделить."); ta.focus(); } }, [aiResponseInputRefPassed]);
    const handleToggleFileSelection = useCallback((fileId: string) => { setSelectedFileIds(prev => { const newSet = new Set(prev); if (newSet.has(fileId)) newSet.delete(fileId); else newSet.add(fileId); const selPaths = new Set( Array.from(newSet).map(id => componentParsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[] ); setSelectedAssistantFiles(selPaths); return newSet; }); }, [componentParsedFiles, setSelectedAssistantFiles]);
    const handleSelectAllFiles = useCallback(() => { if (componentParsedFiles.length === 0) return; const allIds = new Set(componentParsedFiles.map(f => f.id)); const allPaths = new Set(componentParsedFiles.map(f => f.path)); setSelectedFileIds(allIds); setSelectedAssistantFiles(allPaths); toast.info(`${allIds.size} файлов выбрано.`); }, [componentParsedFiles, setSelectedAssistantFiles]);
    const handleDeselectAllFiles = useCallback(() => { setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); toast.info("Выделение снято."); }, [setSelectedAssistantFiles]);
    const handleSaveFiles = useCallback(async () => { if (!user) return; const fTS = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (fTS.length === 0) return; setIsProcessingPR(true); try { const fD = fTS.map(f => ({ p: f.path, c: f.content, e: f.extension })); const { data: eD, error: fE } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (fE && fE.code !== 'PGRST116') throw fE; const eF = eD?.metadata?.generated_files || []; const nP = new Set(fD.map(f => f.p)); const mF = [ ...eF.filter((f: any) => !nP.has(f.path)), ...fD.map(f => ({ path: f.p, code: f.c, extension: f.e })) ]; const { error: uE } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(eD?.metadata || {}), generated_files: mF } }, { onConflict: 'user_id' }); if (uE) throw uE; toast.success(`${fTS.length} файлов сохранено.`); } catch (err) { toast.error("Ошибка сохранения."); logger.error("Save files error:", err); } finally { setIsProcessingPR(false); } }, [user, componentParsedFiles, selectedFileIds]);
    const handleDownloadZip = useCallback(async () => { const fTZ = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (fTZ.length === 0) return; setIsProcessingPR(true); try { const JSZip = (await import("jszip")).default; const zip = new JSZip(); fTZ.forEach((f) => zip.file(f.path.startsWith('/') ? f.path.substring(1) : f.path, f.content)); const blob = await zip.generateAsync({ type: "blob" }); saveAs(blob, `ai_files_${Date.now()}.zip`); toast.success("Архив скачан."); } catch (error) { toast.error("Ошибка ZIP."); logger.error("ZIP error:", error); } finally { setIsProcessingPR(false); } }, [componentParsedFiles, selectedFileIds]);
    const handleSendToTelegram = useCallback(async (file: FileEntry) => { if (!user?.id) return; setIsProcessingPR(true); try { const res = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt"); if (!res.success) throw new Error(res.error ?? "TG Send Error"); toast.success(`"${file.path}" отправлен.`); } catch (err: any) { toast.error(`Ошибка TG: ${err.message}`); logger.error("Send TG error:", err); } finally { setIsProcessingPR(false); } }, [user]);
    const handleAddCustomLink = useCallback(async () => { const name = prompt("Название:"); if (!name) return; const url = prompt("URL (https://...):"); if (!url || !url.startsWith('http')) { toast.error("URL?"); return; } const newLink = { name: name, url: url }; const updatedLinks = [...customLinks, newLink]; setCustomLinks(updatedLinks); if (user) { try { const { data: eD } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(eD?.metadata || {}), customLinks: updatedLinks } }, { onConflict: 'user_id' }); toast.success(`Ссылка "${name}" добавлена.`); } catch (e) { toast.error("Ошибка сохранения."); logger.error("Save link error:", e); setCustomLinks(customLinks); } } }, [customLinks, user]);

    // --- Combined PR/Update Handler (For Regular AI Flow) ---
    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => { if (imageReplaceTask) { toast.warn("Недоступно во время замены картинки."); return; } const selFilesCont = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (!repoUrl || selFilesCont.length === 0 || !prTitle) { toast.error("Нужен URL, Заголовок PR/Commit и Выбранные Файлы."); return; } let finalDesc = (rawDescription || response).substring(0, 60000) + ((rawDescription || response).length > 60000 ? "\n\n...(truncated)" : ""); finalDesc += `\n\n**Файлы (${selFilesCont.length}):**\n` + selFilesCont.map(f => `- \`${f.path}\``).join('\n'); const relIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment'); if (relIssues.length > 0) { finalDesc += "\n\n**Проблемы:**\n" + relIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); } const commitSubj = prTitle.substring(0, 70); const firstLineSrc = rawDescription || response; const commitBody = `Apply AI changes ${selFilesCont.length} files.\nRef: ${firstLineSrc.split('\n')[0]?.substring(0, 100) ?? ''}...`; const fullCommitMsg = `${commitSubj}\n\n${commitBody}`; const filesToCommit = selFilesCont.map(f => ({ path: f.path, content: f.content })); setIsProcessingPR(true); setAssistantLoading(true); logger.log("[handleCreateOrUpdatePR] Initiating PR/Update process."); try { let prToUpdate: SimplePullRequest | null = null; if (contextOpenPrs && contextOpenPrs.length > 0) { prToUpdate = contextOpenPrs.find(pr => pr.title.toLowerCase().includes("ai changes") || pr.title.toLowerCase().includes("supervibe") || pr.title.toLowerCase().includes("ai assistant")) ?? null; if (prToUpdate) { logger.log(`Found existing PR #${prToUpdate.number}`); toast.info(`Обновляю PR #${prToUpdate.number}...`); } } const branchToUpdate = prToUpdate?.head.ref || targetBranchName; if (branchToUpdate) { logger.log(`Updating branch '${branchToUpdate}'.`); toast.info(`Обновление ветки '${branchToUpdate}'...`); const updateResult = await triggerUpdateBranch( repoUrl, filesToCommit, fullCommitMsg, branchToUpdate, prToUpdate?.number, finalDesc ); if (updateResult.success) { logger.log(`Branch '${branchToUpdate}' updated successfully.`); } else { logger.error(`Failed to update branch '${branchToUpdate}': ${updateResult.error}`); } } else { logger.log(`Creating new PR.`); toast.info(`Создание нового PR...`); const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, finalDesc, fullCommitMsg); if (result.success && result.prUrl) { toast.success(`PR создан: ${result.prUrl}`); await notifyAdmin(`🤖 PR с AI создан ${user?.username || user?.id}: ${result.prUrl}`); await triggerGetOpenPRs(repoUrl); logger.log(`New PR created: ${result.prUrl}`); } else { toast.error("Ошибка создания PR: " + (result.error || "?")); logger.error("PR Creation Failed:", result.error); } } } catch (err) { toast.error(`Крит. ошибка ${targetBranchName ? 'обновления' : 'создания PR'}.`); logger.error("PR/Update error:", err); } finally { setIsProcessingPR(false); setAssistantLoading(false); logger.log("[handleCreateOrUpdatePR] Finished PR/Update process."); } }, [ componentParsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, response, validationIssues, targetBranchName, contextOpenPrs, triggerUpdateBranch, setAssistantLoading, user, triggerGetOpenPRs, notifyAdmin, imageReplaceTask ]);

    // --- Direct Image Replacement Handler ---
    // <<< MODIFIED: Accepts `files` array as parameter >>>
    const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask, files: FileNode[]): Promise<void> => {
        logger.log("[AICodeAssistant] handleDirectImageReplace called with task:", task, `and ${files?.length ?? 0} files passed.`);
        setIsProcessingPR(true); // Use this flag to indicate work is happening
        setAssistantLoading(true); // Also use general loading for UI feedback

        try {
            // --- Use the passed `files` array ---
            logger.log(`[AICodeAssistant] Inside handleDirectImageReplace. Checking for ${task.targetPath} in PASSED files (${files?.length ?? 0}). Paths: ${files?.map(f => f.path).join(', ') ?? 'N/A'}`);
            const targetFile = files?.find(f => f.path === task.targetPath);

            if (!targetFile) {
                 logger.error(`[AICodeAssistant] Target file "${task.targetPath}" not found in PASSED files.`);
                 throw new Error(`Целевой файл "${task.targetPath}" не найден среди ПЕРЕДАННЫХ файлов (${files?.length ?? 0} шт).`);
            }

            logger.log(`[AICodeAssistant] Target file ${task.targetPath} found in passed files. Content length: ${targetFile.content.length}`);
            let currentContent = targetFile.content;

            if (!currentContent.includes(task.oldUrl)) {
                 logger.warn(`[AICodeAssistant] Old URL (${task.oldUrl.substring(0,50)}...) not found in ${task.targetPath}.`);
                 toast.warn(`Старый URL (${task.oldUrl.substring(0, 30)}...) не найден в ${task.targetPath}. Замена отменена.`);
                 setImageReplaceTask(null); // Clear the task as it cannot proceed
                 throw new Error("Old URL not found in target file."); // Prevent further execution
            }

            const modifiedContent = currentContent.replaceAll(task.oldUrl, task.newUrl);

            if (modifiedContent === currentContent) {
                logger.info(`[AICodeAssistant] Content of ${task.targetPath} did not change after replacement attempt.`);
                toast.info(`Контент ${task.targetPath} не изменился (возможно, URL уже был заменен?). Замена отменена.`);
                setImageReplaceTask(null); // Clear the task
                throw new Error("Content did not change after replacement."); // Prevent PR creation
            }

            logger.log(`[AICodeAssistant] Replacing in ${task.targetPath}. Content length changed: ${currentContent.length !== modifiedContent.length}`);
            toast.info(`Заменяю ${task.oldUrl.substring(0, 30)}... на ${task.newUrl.substring(0, 30)}... в ${task.targetPath}`);

            const filesToCommit: { path: string; content: string }[] = [{ path: task.targetPath, content: modifiedContent }];
            const commitTitle = `chore: Update image in ${task.targetPath}`;
            const prDesc = `Replaced image via Studio.\n\nOld: \`${task.oldUrl}\`\nNew: \`${task.newUrl}\``;
            const fullCommitMsg = `${commitTitle}\n\n${prDesc}`;
            const prTitleNew = commitTitle;

            let existingPrBranch: string | null = null;
            let existingPrNum: number | null = null;
            const expectedPrTitle = `chore: Update image in ${task.targetPath}`; // Use specific title for matching

            if (contextOpenPrs && contextOpenPrs.length > 0) {
                const matchPr = contextOpenPrs.find(pr => pr.title === expectedPrTitle); // Strict title match
                if (matchPr) {
                    existingPrBranch = matchPr.head.ref;
                    existingPrNum = matchPr.number;
                    logger.log(`[AICodeAssistant] Found existing image PR #${existingPrNum} (Branch: ${existingPrBranch}).`);
                    toast.info(`Обновляю PR #${existingPrNum} для картинки...`);
                }
            }

            const branchToUpd = existingPrBranch || targetBranchName; // Prefer existing PR branch, then selected target, then null

            if (branchToUpd) {
                logger.log(`[AICodeAssistant] Updating branch '${branchToUpd}' for img replace.`);
                const res = await triggerUpdateBranch( repoUrl, filesToCommit, fullCommitMsg, branchToUpd, existingPrNum, prDesc );
                if (!res.success) {
                     logger.error(`[AICodeAssistant] Failed to update branch ${branchToUpd} for image replace: ${res.error}`);
                     throw new Error(res.error || "Failed to update branch for image"); // Propagate error
                } else {
                    logger.log(`[AICodeAssistant] Branch ${branchToUpd} updated successfully for image replace.`);
                }
            } else {
                logger.log(`[AICodeAssistant] Creating new PR for img replace.`);
                const res = await createGitHubPullRequest(repoUrl, filesToCommit, prTitleNew, prDesc, fullCommitMsg);
                if (res.success && res.prUrl) {
                    toast.success(`PR для картинки создан: ${res.prUrl}`);
                    await notifyAdmin(`🖼️ PR картинки ${task.targetPath} (${task.newUrl.split('/').pop()}) создан ${user?.username || user?.id}: ${res.prUrl}`);
                    await triggerGetOpenPRs(repoUrl); // Refresh PR list
                    logger.log(`[AICodeAssistant] New image PR created: ${res.prUrl}`);
                } else {
                    toast.error("Ошибка создания PR для картинки: " + (res.error || "?"));
                    logger.error("[AICodeAssistant] PR Img Create Failed:", res.error);
                    throw new Error(res.error || "Failed to create PR for image"); // Propagate error
                }
            }

            logger.log("[AICodeAssistant] handleDirectImageReplace: Successfully completed PR/Update.");
            setImageReplaceTask(null); // Clear task only on full success

        } catch (err: any) {
            toast.error(`Ошибка замены картинки: ${err.message}`);
            logger.error("[AICodeAssistant] handleDirectImageReplace error caught:", err);
            setImageReplaceTask(null); // Clear the task on any error during the process
        } finally {
            logger.log("[AICodeAssistant] handleDirectImageReplace: Finalizing.");
            setIsProcessingPR(false);
            setAssistantLoading(false);
        }
    // <<< MODIFIED: Removed allFetchedFiles from dependencies >>>
    }, [
        contextOpenPrs,
        targetBranchName,
        repoUrl,
        notifyAdmin,
        user,
        setAssistantLoading,
        setImageReplaceTask, // Context setter
        triggerGetOpenPRs,    // Context trigger
        triggerUpdateBranch,  // Context trigger
    ]);


    // --- Response Setting and URL Update Callbacks ---
    const setResponseValue = useCallback((value: string) => { setResponse(value); if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value; setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); logger.log("AICodeAssistant: Response value set manually, resetting parsed state."); }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);
    const updateRepoUrl = useCallback((url: string) => { setRepoUrlState(url); triggerGetOpenPRs(url); }, [triggerGetOpenPRs]);

    // --- Imperative Handle (Expose Methods) ---
    // <<< MODIFIED: Exposure of handleDirectImageReplace remains the same, but its implementation changed >>>
    useImperativeHandle(ref, () => ({
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles,
        handleCreatePR: handleCreateOrUpdatePR,
        setResponseValue,
        updateRepoUrl,
        handleDirectImageReplace, // Expose the image replace handler
    }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace]);

    // --- RENDER ---
    if (!isMounted) { return ( <div id="executor-loading" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4 min-h-[400px] items-center justify-center"> <FaSpinner className="text-cyan-400 text-4xl animate-spin mb-4"/> <p className="text-gray-400 text-lg">Загрузка Ассистента...</p> </div> ); }
    const isProcessingAny = assistantLoading || aiActionLoading || contextIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedFileIds.size > 0 && !!prTitle && !!repoUrl && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR";
    const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIcon = isProcessingPR || assistantLoading ? <FaSpinner className="animate-spin"/> : prButtonIcon;
    const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const showStandardAssistantUI = !imageReplaceTask;
    const showImageReplaceUI = !!imageReplaceTask;
    const commonDisabled = isProcessingAny;
    const parseButtonDisabled = commonDisabled || isWaitingForAiResponse || !response.trim();
    const fixButtonDisabled = commonDisabled || isWaitingForAiResponse;
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || assistantLoading;

    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
             <header className="flex justify-between items-center gap-2 flex-wrap">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse"> {showImageReplaceUI ? "Статус Замены Картинки" : "AI Code Assistant"} </h1>
                     {showStandardAssistantUI && ( <Tooltip text={assistantTooltipText} > <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" /> </Tooltip> )}
                 </div>
                 <Tooltip text="Настройки URL/Token/Ветки/PR" >
                      <button id="settings-modal-trigger-assistant" onClick={triggerToggleSettingsModal} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingPR || assistantLoading} > <FaCodeBranch className="text-xl" /> </button>
                 </Tooltip>
             </header>

            {showStandardAssistantUI && (
                 <>
                     <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : commonDisabled ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y overflow-hidden" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : commonDisabled ? "Ожидание..." : "Ответ AI здесь..."} disabled={commonDisabled} spellCheck="false" />
                              <TextAreaUtilities response={response} isLoading={commonDisabled} onParse={handleParse} onOpenModal={handleOpenModal} onCopy={handleCopyResponse} onClear={handleClearResponse} onSelectFunction={handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={isProcessingPR || assistantLoading} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handleRestorationComplete} disabled={commonDisabled || validationStatus === 'validating' || isFetchingOriginals} />
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handleAutoFix} onCopyPrompt={handleCopyFixPrompt} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handleToggleFileSelection} onSelectAll={handleSelectAllFiles} onDeselectAll={handleDeselectAllFiles} onSaveFiles={handleSaveFiles} onDownloadZip={handleDownloadZip} onSendToTelegram={handleSendToTelegram} isUserLoggedIn={!!user} isLoading={commonDisabled} />
                     <PullRequestForm id="pr-form-container" repoUrl={repoUrl} prTitle={prTitle} selectedFileCount={selectedFileIds.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={(url) => { setRepoUrlState(url); updateRepoUrlInAssistant(url); }} onPrTitleChange={setPrTitle} onCreatePR={handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIcon} isSubmitDisabled={submitButtonDisabled} />
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} disabled={commonDisabled}/>
                         <Tooltip text="Загрузить/Связать Картинки" >
                             <button onClick={() => setIsImageModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={commonDisabled} >
                                <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span>
                                {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && ( <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span> )}
                             </button>
                         </Tooltip>
                    </div>
                 </>
            )}

            {showImageReplaceUI && (
                 <div className="flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed border-blue-400 min-h-[200px]">
                     {isProcessingPR || assistantLoading ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> ) : ( imageReplaceTask ? <FaImages className="text-blue-400 text-4xl mb-4" /> : <FaCheck className="text-green-400 text-4xl mb-4" /> )}
                     <p className="text-lg font-semibold text-blue-300"> {isProcessingPR || assistantLoading ? "Заменяю картинку и обновляю ветку/PR..." : imageReplaceTask ? "Задача Замены Картинки Активна" : "Замена Завершена"} </p>
                     <p className="text-sm text-gray-400 mt-2"> {isProcessingPR || assistantLoading ? "Идет процесс..." : imageReplaceTask ? "Файл загружен, ожидание обработки Ассистентом..." : "Процесс завершен."} </p>
                     {imageReplaceTask && ( <div className="mt-3 text-xs text-gray-500 break-all text-left bg-gray-900/50 p-2 rounded max-w-full overflow-x-auto"> <p><span className="font-semibold text-gray-400">Файл:</span> {imageReplaceTask.targetPath}</p> <p><span className="font-semibold text-gray-400">Старый URL:</span> {imageReplaceTask.oldUrl}</p> <p><span className="font-semibold text-gray-400">Новый URL:</span> {imageReplaceTask.newUrl}</p> </div> )}
                 </div>
            )}

             <AnimatePresence>
                {showStandardAssistantUI && showModal && (<SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handleSwap} onSearch={handleSearch} initialMode={modalMode} /> )}
                {showStandardAssistantUI && isImageModalOpen && (<ImageToolsModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} parsedFiles={componentParsedFiles} onUpdateParsedFiles={handleUpdateParsedFiles}/> )}
            </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;