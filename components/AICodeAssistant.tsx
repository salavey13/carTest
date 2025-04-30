"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback, useRef } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode
} from "@/contexts/RepoXmlPageContext";
import { createGitHubPullRequest, updateBranch, fetchRepoContents } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions"; // Removed notifyAdmins if not used
import { supabaseAdmin } from "@/hooks/supabase"; // Assuming this path is correct
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
    FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines, FaCode,
    FaCheck, FaCircleXmark, FaExclamation
} from "react-icons/fa6";
import clsx from "clsx";
import { saveAs } from "file-saver";
import { logger } from "@/lib/logger"; // Use the standard logger
import { selectFunctionDefinition, extractFunctionName } from "@/lib/codeUtils"; // Assuming this path is correct

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
    const [isMounted, setIsMounted] = useState(false);
    const [response, setResponse] = useState<string>("");
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [repoUrlStateLocal, setRepoUrlStateLocal] = useState<string>("");
    const [prTitle, setPrTitle] = useState<string>("");
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
    const [isProcessingPR, setIsProcessingPR] = useState(false);
    const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
    const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [componentParsedFiles, setComponentParsedFiles] = useState<ValidationFileEntry[]>([]);

    // --- Hooks ---
    const { user } = useAppContext();
    const { parsedFiles: hookParsedFiles, rawDescription, validationStatus, validationIssues, isParsing: hookIsParsing, parseAndValidateResponse, autoFixIssues, setParsedFiles: setHookParsedFiles, setValidationStatus, setValidationIssues, } = useCodeParsingAndValidation();

    // --- Context Access ---
    const {
        setAiResponseHasContent, setFilesParsed, filesParsed,
        selectedAssistantFiles, setSelectedAssistantFiles,
        setAssistantLoading, assistantLoading,
        aiActionLoading, currentAiRequestId,
        openPrs: contextOpenPrs, triggerGetOpenPRs,
        targetBranchName, triggerToggleSettingsModal,
        triggerUpdateBranch, updateRepoUrlInAssistant,
        loadingPrs, setIsParsing: setContextIsParsing, isParsing: contextIsParsing,
        imageReplaceTask, setImageReplaceTask,
        fetchStatus, allFetchedFiles, repoUrlEntered,
        repoUrl: repoUrlFromContext,
    } = useRepoXmlPageContext();

    // --- Derived State ---
    const isParsing = contextIsParsing ?? hookIsParsing;
    const repoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Ref for Image Processing Guard ---
    const processingImageReplace = useRef(false);

    // --- Effects ---
    useEffect(() => { setIsMounted(true); }, []);
    useEffect(() => { setComponentParsedFiles(hookParsedFiles); setFilesParsed(hookParsedFiles.length > 0); }, [hookParsedFiles, setFilesParsed]);
    useEffect(() => {
        if (isMounted && repoUrlFromContext && !repoUrlStateLocal) { setRepoUrlStateLocal(repoUrlFromContext); }
    }, [isMounted, repoUrlFromContext, repoUrlStateLocal]);
    useEffect(() => {
        if (!isMounted) return; const hasContent = response.trim().length > 0; setAiResponseHasContent(hasContent);
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !isParsing) { logger.log("[AICodeAssistant Effect] Resetting state due to empty response and no activity."); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); }
        else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) { logger.log("[AICodeAssistant Effect] Resetting validation status due to response change w/o parsed files."); setValidationStatus('idle'); setValidationIssues([]); }
    }, [ isMounted, response, currentAiRequestId, aiActionLoading, imageReplaceTask, componentParsedFiles.length, isParsing, assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setHookParsedFiles ]);
    useEffect(() => {
        if (!isMounted || !user) { setCustomLinks([]); return; }
        const loadLinks = async () => { try { const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!e && d?.metadata?.customLinks) { setCustomLinks(d.metadata.customLinks); } else { setCustomLinks([]); if (e && e.code !== 'PGRST116') { logger.error("Error loading custom links (supabase):", e); } } } catch (e) { logger.error("Error loading custom links (catch):", e); setCustomLinks([]); } }; loadLinks();
    }, [isMounted, user]);
    useEffect(() => {
        if (!isMounted || imageReplaceTask) return; const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrlForForm) {
            const fetchOrig = async () => { setIsFetchingOriginals(true); const branch = targetBranchName ?? undefined; const branchDisp = targetBranchName ?? 'default'; toast.info(`Загрузка оригиналов из ${branchDisp}...`); try { const res = await fetchRepoContents(repoUrlForForm, undefined, branch); if (res.success && Array.isArray(res.files)) { const originalFilesData = res.files.map(f => ({ path: f.path, content: f.content })); setOriginalRepoFiles(originalFilesData); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (res.error ?? '?')); setOriginalRepoFiles([]); } } catch (e) { toast.error("Крит. ошибка загрузки оригиналов."); logger.error("Fetch originals error:", e); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOrig();
        }
    }, [isMounted, validationIssues, originalRepoFiles.length, isFetchingOriginals, repoUrlForForm, targetBranchName, imageReplaceTask]);

    // --- Helper Functions ---
    const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

     // --- Direct Image Replacement Handler (Swapped logger.warn to logger.error) ---
     const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask, files: FileNode[]): Promise<void> => {
         logger.log("[AICodeAssistant] handleDirectImageReplace called with task:", task, `and ${files?.length ?? 0} files passed.`);
         setIsProcessingPR(true);
         setAssistantLoading(true);

         try {
             if (!task || !task.targetPath || !task.oldUrl || !task.newUrl) {
                  // Use logger.error instead of logger.warn
                  logger.error("[AICodeAssistant] handleDirectImageReplace: Invalid task received.", task);
                  setImageReplaceTask(null); return;
             }

             const targetFile = files?.find(f => f.path === task.targetPath);
             if (!targetFile || typeof targetFile.content !== 'string') {
                 throw new Error(`Целевой файл "${task.targetPath}" не найден или его контент невалиден.`);
             }
             let currentContent = targetFile.content;
             if (!currentContent.includes(task.oldUrl)) {
                 // Use logger.error instead of logger.warn
                 logger.error(`Old URL not found in ${task.targetPath}. Content may be stale or URL incorrect. Aborting.`);
                 toast.warn(`Старый URL "${task.oldUrl.substring(0, 30)}..." не найден в ${task.targetPath}. Замена отменена.`);
                 setImageReplaceTask(null); return;
             }
             const modifiedContent = currentContent.replaceAll(task.oldUrl, task.newUrl);
             if (modifiedContent === currentContent) {
                 logger.info(`Content of ${task.targetPath} did not change after replaceAll. Aborting.`);
                 toast.info(`Контент ${task.targetPath} не изменился. Замена отменена.`);
                 setImageReplaceTask(null); return;
             }
             logger.log(`Replacing in ${task.targetPath}. Content changed.`);
             toast.info(`Заменяю ${task.oldUrl.substring(0, 30)}... в ${task.targetPath}`);

             const filesToCommit: { path: string; content: string }[] = [{ path: task.targetPath, content: modifiedContent }];
             const newImageFilename = task.newUrl.split('/').pop()?.split('?')[0] || 'image';
             const commitTitle = `chore: Update image ${newImageFilename} in ${task.targetPath}`;
             const safeCommitTitle = commitTitle.length > 72 ? commitTitle.substring(0, 69) + '...' : commitTitle;
             const prDesc = `Replaced image via SuperVibe Studio.\n\nFile: \`${task.targetPath}\`\nOld: \`${task.oldUrl}\`\nNew: \`${task.newUrl}\``;
             const fullCommitMsg = `${safeCommitTitle}\n\n${prDesc}`;
             const prTitleNew = safeCommitTitle;

             let existingPrBranch: string | null = null; let existingPrNum: number | null = null;
             const expectedPrTitlePrefix = `chore: Update image`; const expectedPrFile = task.targetPath;
             logger.log(`[AICodeAssistant] Searching for existing PRs. Context has ${contextOpenPrs?.length ?? 0} PRs.`);
             if (contextOpenPrs && contextOpenPrs.length > 0) {
                 const matchPr = contextOpenPrs.find(pr => pr.title?.startsWith(expectedPrTitlePrefix) && pr.title?.includes(expectedPrFile) && pr.head?.ref);
                 if (matchPr) {
                      if (matchPr.head.ref && typeof matchPr.number === 'number') {
                          existingPrBranch = matchPr.head.ref; existingPrNum = matchPr.number;
                          logger.log(`Found existing image PR #${existingPrNum} on branch '${existingPrBranch}'`);
                          toast.info(`Обновляю PR #${existingPrNum} для картинки...`);
                      } else {
                           // Use logger.error instead of logger.warn
                           logger.error("Found matching PR, but head.ref or number is missing:", matchPr);
                      }
                 } else { logger.log(`No specific existing PR found matching title prefix and file.`); }
             } else { logger.log("No open PRs in context or context PRs is empty."); }
             const branchToUpd = existingPrBranch || (existingPrNum === null ? targetBranchName : null);
             logger.log(`Decision: ${existingPrBranch ? 'Update existing PR branch' : (branchToUpd ? `Update target branch ${branchToUpd}` : 'Create new PR/branch')}`);

             if (branchToUpd && existingPrNum !== null) {
                 logger.log(`Updating branch '${branchToUpd}' for img replace. PR#: ${existingPrNum}`);
                 const res = await triggerUpdateBranch( repoUrlForForm, filesToCommit, fullCommitMsg, branchToUpd, existingPrNum, prDesc );
                 if (!res.success) { throw new Error(res.error || "Failed to update branch"); }
                 logger.log(`[AICodeAssistant] Branch ${branchToUpd} update successful.`);
             } else {
                 logger.log(`Creating new PR for img replace.`);
                 const res = await createGitHubPullRequest(repoUrlForForm, filesToCommit, prTitleNew, prDesc, fullCommitMsg);
                 if (res.success && res.prUrl) {
                     toast.success(`PR для картинки создан: ${res.prUrl}`);
                     await triggerGetOpenPRs(repoUrlForForm);
                     logger.log(`New image PR created: ${res.prUrl}`);
                 } else {
                     logger.error("PR Img Create Failed:", res.error);
                     throw new Error(res.error || "Failed to create PR");
                 }
             }
             logger.log("[AICodeAssistant] handleDirectImageReplace: Successfully completed operation.");
             setImageReplaceTask(null); // Clear task on success

         } catch (err: any) {
             toast.error(`Ошибка замены картинки: ${err.message}`);
             logger.error("[AICodeAssistant] handleDirectImageReplace error caught:", err);
             setImageReplaceTask(null);
         } finally {
             logger.log("[AICodeAssistant] handleDirectImageReplace: Finalizing.");
             setIsProcessingPR(false);
             setAssistantLoading(false);
         }
     }, [ contextOpenPrs, targetBranchName, repoUrlForForm, setAssistantLoading, setImageReplaceTask, triggerGetOpenPRs, triggerUpdateBranch, setIsProcessingPR ]);


    // --- Effect to handle image replacement AFTER fetch completes ---
    useEffect(() => {
        const canProcess = imageReplaceTask && fetchStatus === 'success' && allFetchedFiles.length > 0 && allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath) && !assistantLoading && !processingImageReplace.current;
        if (canProcess) {
            logger.log("[AICodeAssistant Effect] Conditions met for image replacement. Starting process."); processingImageReplace.current = true;
            handleDirectImageReplace(imageReplaceTask, allFetchedFiles)
                .catch(err => { logger.error("[AICodeAssistant Effect] Error during handleDirectImageReplace:", err); })
                .finally(() => { logger.log("[AICodeAssistant Effect] Image replacement process finished. Releasing guard."); processingImageReplace.current = false; });
        } else if (imageReplaceTask && fetchStatus === 'error') { logger.warn("[AICodeAssistant Effect] Image replace task active, but fetch status is error. Doing nothing."); }
    }, [ imageReplaceTask, fetchStatus, allFetchedFiles, assistantLoading, handleDirectImageReplace ]);


    // --- Handlers (wrapped in useCallback, other handlers unchanged) ---
    const handleParse = useCallback(async () => { if (imageReplaceTask) { toast.warn("Разбор не нужен для картинки."); return; } if (!response.trim()) { toast.warn("Нет ответа AI для разбора."); return; } logger.log("[AICodeAssistant] Starting parse..."); setContextIsParsing(true); setAssistantLoading(true); setOriginalRepoFiles([]); try { const { files: newlyParsedFiles, description: parsedRawDesc } = await parseAndValidateResponse(response); setHookParsedFiles(newlyParsedFiles); const initialSelection = new Set(newlyParsedFiles.map(f => f.id)); setSelectedFileIds(initialSelection); setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path))); if (newlyParsedFiles.length > 0) { setPrTitle(extractPRTitleHint(parsedRawDesc || response)); } else { setPrTitle(''); } toast.success(`Разбор завершен. Найдено ${newlyParsedFiles.length} файлов.`); } catch (error) { logger.error("Parse error:", error); toast.error("Ошибка разбора ответа AI."); setFilesParsed(false); setHookParsedFiles([]); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('error'); setValidationIssues([{type: 'parseError', message: 'Ошибка парсинга ответа.', fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A'}]); } finally { setContextIsParsing(false); setAssistantLoading(false); } }, [response, imageReplaceTask, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setAssistantLoading, setValidationStatus, setValidationIssues, setHookParsedFiles]);
    const handleAutoFix = useCallback(() => { if (imageReplaceTask) return; autoFixIssues(componentParsedFiles, validationIssues); }, [autoFixIssues, componentParsedFiles, validationIssues, imageReplaceTask]);
    const handleCopyFixPrompt = useCallback(() => { if (imageReplaceTask) return; const skipped = validationIssues.filter(i => i.type === 'skippedComment'); if (skipped.length === 0) { toast.info("Нет маркеров '// ..''.'."); return; } const fList = skipped.map(i => `- ${i.filePath} (~${i.details?.lineNumber})`).join('\n'); const prompt = `Восстанови пропуски ('// ..''.') в новых файлах, референс - старые:\n${fList}\n\nВерни полные новые версии.`; navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt для исправления скопирован!")).catch(() => toast.error("Ошибка копирования промпта.")); }, [validationIssues, imageReplaceTask]);
    const handleRestorationComplete = useCallback((updatedFiles: ValidationFileEntry[], successCount: number, errorCount: number) => { if (imageReplaceTask) return; setHookParsedFiles(updatedFiles); const remaining = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); setValidationIssues(remaining); setValidationStatus(remaining.length > 0 ? (remaining.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success'); if (successCount > 0) toast.success(`${successCount} блоков кода восстановлено.`); if (errorCount > 0) toast.error(`${errorCount} блоков не удалось восстановить.`); }, [validationIssues, setHookParsedFiles, setValidationIssues, setValidationStatus, imageReplaceTask]);
    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => { if (imageReplaceTask) return; logger.log("UpdateParsedFiles:", updatedFiles.length); setHookParsedFiles(updatedFiles); toast.info("Файлы обновлены после замены плейсхолдеров."); setValidationStatus('idle'); setValidationIssues([]); }, [setHookParsedFiles, setValidationStatus, setValidationIssues, imageReplaceTask]);
    const handleClearResponse = useCallback(() => { if (imageReplaceTask) return; setResponse(""); if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = ""; toast.info("Поле ответа AI очищено."); }, [aiResponseInputRefPassed, imageReplaceTask]);
    const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(() => toast.success("Ответ AI скопирован!")).catch(() => toast.error("Ошибка копирования ответа.")); }, [response]);
    const handleOpenModal = useCallback((mode: 'replace' | 'search') => { if (imageReplaceTask) return; setModalMode(mode); setShowModal(true); }, [imageReplaceTask]);
    const handleSwap = useCallback((find: string, replace: string) => { if (!find || !aiResponseInputRefPassed.current || imageReplaceTask) return; try { const ta = aiResponseInputRefPassed.current; const curVal = ta.value; const escFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const rgx = new RegExp(escFind, 'g'); const newVal = curVal.replace(rgx, replace); if (newVal !== curVal) { setResponse(newVal); requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = newVal; }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`Текст заменен! "${find}" -> "${replace}". Жми '➡️'.`); } else { toast.info(`Текст "${find}" не найден в ответе AI.`); } } catch (e: any) { toast.error(`Ошибка замены: ${e.message}`); } }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, imageReplaceTask]);
    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => { if (!searchText || !aiResponseInputRefPassed.current || imageReplaceTask) return; const ta = aiResponseInputRefPassed.current; const txtCont = ta.value; if (isMultiline) { const clnSrch = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n'); if (!clnSrch) { toast.error("Текст для мультилайн поиска/замены пуст."); return; } const fL = clnSrch.split('\n')[0]; const fN = extractFunctionName(fL ?? ''); if (!fN) { toast.error("Не удалось извлечь имя функции для замены."); return; } const fRgx = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${fN}\\s*(?:\\(|[:=]|<)`, 'm'); let match = fRgx.exec(txtCont); if (!match) { const mRgx = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${fN}\\s*\\(`, 'm'); match = mRgx.exec(txtCont); } if (!match || match.index === undefined) { toast.info(`Функция/Класс "${fN}" не найдена в ответе AI.`); return; } const mSI = match.index + (match[1]?.length || 0); const [sP, eP] = selectFunctionDefinition(txtCont, mSI); if (sP === -1 || eP === -1) { toast.error("Не удалось выделить тело функции/класса для замены."); return; } const nV = txtCont.substring(0, sP) + clnSrch + txtCont.substring(eP); setResponse(nV); requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) { aiResponseInputRefPassed.current.value = nV; aiResponseInputRefPassed.current.focus(); aiResponseInputRefPassed.current.setSelectionRange(sP, sP + clnSrch.length); } }); setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`Функция "${fN}" заменена! ✨ Жми '➡️'.`); } else { const sTL = searchText.toLowerCase(); const tCL = txtCont.toLowerCase(); const cP = ta.selectionStart || 0; let fI = tCL.indexOf(sTL, cP); if (fI === -1) { fI = tCL.indexOf(sTL, 0); if (fI === -1 || fI >= cP) { toast.info(`"${searchText}" не найден.`); ta.focus(); return; } toast.info("Поиск с начала."); } ta.focus(); ta.setSelectionRange(fI, fI + searchText.length); toast(`Найдено: "${searchText}"`, { style: { background: "rgba(30, 64, 175, 0.9)", color: "#fff", border: "1px solid rgba(37, 99, 235, 0.3)", backdropFilter: "blur(3px)" }, duration: 2000 }); } }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, imageReplaceTask]);
    const handleSelectFunction = useCallback(() => { if (imageReplaceTask) return; const ta=aiResponseInputRefPassed.current; if(!ta)return; const txt=ta.value; const cP=ta.selectionStart||0; const lSI=txt.lastIndexOf('\n',cP-1)+1; const [sP,eP]=selectFunctionDefinition(txt,lSI); if(sP!==-1&&eP!==-1){ta.focus(); ta.setSelectionRange(sP,eP); toast.success("Функция/Блок выделена!");} else { let sUI=txt.lastIndexOf('{',lSI); if(sUI>0){ const [uSP,uEP]=selectFunctionDefinition(txt,sUI); if(uSP!==-1&&uEP!==-1){ ta.focus(); ta.setSelectionRange(uSP,uEP); toast.success("Найден блок выше!"); return; } } toast.info("Не удалось выделить функцию/блок."); ta.focus(); } }, [aiResponseInputRefPassed, imageReplaceTask]);
    const handleToggleFileSelection = useCallback((fileId: string) => { if (imageReplaceTask) return; setSelectedFileIds(prev => { const newSet = new Set(prev); if (newSet.has(fileId)) newSet.delete(fileId); else newSet.add(fileId); const selPaths = new Set( Array.from(newSet).map(id => componentParsedFiles.find(f => f.id === id)?.path).filter((path): path is string => !!path) ); setSelectedAssistantFiles(selPaths); return newSet; }); }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask]);
    const handleSelectAllFiles = useCallback(() => { if (componentParsedFiles.length === 0 || imageReplaceTask) return; const allIds = new Set(componentParsedFiles.map(f => f.id)); const allPaths = new Set(componentParsedFiles.map(f => f.path)); setSelectedFileIds(allIds); setSelectedAssistantFiles(allPaths); toast.info(`${allIds.size} файлов выбрано.`); }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask]);
    const handleDeselectAllFiles = useCallback(() => { if (imageReplaceTask) return; setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); toast.info("Выделение снято со всех файлов."); }, [setSelectedAssistantFiles, imageReplaceTask]);
    const handleSaveFiles = useCallback(async () => { if (!user || imageReplaceTask) return; const fTS = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (fTS.length === 0) { toast.warn("Нет выбранных файлов для сохранения."); return; } setIsProcessingPR(true); try { const fD = fTS.map(f => ({ p: f.path, c: f.content, e: f.extension })); const { data: eD, error: fE } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (fE && fE.code !== 'PGRST116') throw fE; const eF = eD?.metadata?.generated_files || []; const nP = new Set(fD.map(f => f.p)); const mF = [ ...eF.filter((f: any) => !nP.has(f.path)), ...fD.map(f => ({ path: f.p, code: f.c, extension: f.e })) ]; const { error: uE } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(eD?.metadata || {}), generated_files: mF } }, { onConflict: 'user_id' }); if (uE) throw uE; toast.success(`${fTS.length} файлов сохранено в вашем профиле.`); } catch (err) { toast.error("Ошибка сохранения файлов."); logger.error("Save files error:", err); } finally { setIsProcessingPR(false); } }, [user, componentParsedFiles, selectedFileIds, imageReplaceTask]);
    const handleDownloadZip = useCallback(async () => { if (imageReplaceTask) return; const fTZ = componentParsedFiles.filter(f => selectedFileIds.has(f.id)); if (fTZ.length === 0) { toast.warn("Нет выбранных файлов для скачивания."); return; } setIsProcessingPR(true); try { const JSZip = (await import("jszip")).default; const zip = new JSZip(); fTZ.forEach((f) => zip.file(f.path.startsWith('/') ? f.path.substring(1) : f.path, f.content)); const blob = await zip.generateAsync({ type: "blob" }); saveAs(blob, `ai_files_${Date.now()}.zip`); toast.success("Архив с выбранными файлами скачан."); } catch (error) { toast.error("Ошибка создания ZIP архива."); logger.error("ZIP error:", error); } finally { setIsProcessingPR(false); } }, [componentParsedFiles, selectedFileIds, imageReplaceTask]);
    const handleSendToTelegram = useCallback(async (file: FileEntry) => { if (!user?.id || imageReplaceTask) return; setIsProcessingPR(true); try { const res = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt"); if (!res.success) throw new Error(res.error ?? "TG Send Error"); toast.success(`Файл "${file.path}" отправлен вам в Telegram.`); } catch (err: any) { toast.error(`Ошибка отправки в TG: ${err.message}`); logger.error("Send TG error:", err); } finally { setIsProcessingPR(false); } }, [user, imageReplaceTask]);
    const handleAddCustomLink = useCallback(async () => { if (!user || imageReplaceTask) return; const name = prompt("Название:"); if (!name) return; const url = prompt("URL (https://...):"); if (!url || !url.startsWith('http')) { toast.error("Некорректный URL."); return; } const newLink = { name: name.trim(), url: url.trim() }; const updatedLinks = [...customLinks, newLink]; setCustomLinks(updatedLinks); try { const { data: eD } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(eD?.metadata || {}), customLinks: updatedLinks } }, { onConflict: 'user_id' }); toast.success(`Ссылка "${name}" добавлена.`); } catch (e) { toast.error("Ошибка сохранения ссылки."); logger.error("Save link error:", e); setCustomLinks(customLinks); } }, [customLinks, user, imageReplaceTask]);
    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => { if (imageReplaceTask) { toast.warn("Недоступно во время замены картинки."); return; } const selFilesCont = componentParsedFiles.filter(f => selectedAssistantFiles.has(f.path)); if (!repoUrlForForm || selFilesCont.length === 0 || !prTitle.trim()) { toast.error("Нужен URL репозитория, Заголовок PR/Commit и хотя бы один выбранный Файл."); return; } let finalDesc = (rawDescription || response).substring(0, 60000) + ((rawDescription || response).length > 60000 ? "\n\n...(truncated)" : ""); finalDesc += `\n\n**Файлы (${selFilesCont.length}):**\n` + selFilesCont.map(f => `- \`${f.path}\``).join('\n'); const relIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment'); if (relIssues.length > 0) { finalDesc += "\n\n**Проблемы Валидации:**\n" + relIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); } const commitSubj = prTitle.trim().substring(0, 70); const firstLineSrc = rawDescription || response; const commitBody = `Apply AI assistant changes to ${selFilesCont.length} files.\nRef: ${firstLineSrc.split('\n')[0]?.substring(0, 100) ?? ''}...`; const fullCommitMsg = `${commitSubj}\n\n${commitBody}`; const filesToCommit = selFilesCont.map(f => ({ path: f.path, content: f.content })); setIsProcessingPR(true); setAssistantLoading(true); logger.log("[handleCreateOrUpdatePR] Initiating PR/Update process."); try { let prToUpdate: SimplePullRequest | null = null; if (contextOpenPrs && contextOpenPrs.length > 0) { prToUpdate = contextOpenPrs.find(pr => pr.title.toLowerCase().includes("ai changes") || pr.title.toLowerCase().includes("supervibe") || pr.title.toLowerCase().includes("ai assistant") || pr.title.toLowerCase().includes(commitSubj.toLowerCase().substring(0, 20))) ?? null; if (prToUpdate) { logger.log(`Found existing PR #${prToUpdate.number}.`); toast.info(`Обновляю существующий PR #${prToUpdate.number}...`); } else { logger.log("No suitable existing PR found."); } } const branchToUpdate = prToUpdate?.head.ref || targetBranchName; if (branchToUpdate) { logger.log(`Updating branch '${branchToUpdate}'. PR#: ${prToUpdate?.number}`); toast.info(`Обновление ветки '${branchToUpdate}'...`); const updateResult = await triggerUpdateBranch( repoUrlForForm, filesToCommit, fullCommitMsg, branchToUpdate, prToUpdate?.number, finalDesc ); if (!updateResult.success) { logger.error(`Failed to update branch '${branchToUpdate}': ${updateResult.error}`); } } else { logger.log(`Creating new PR.`); toast.info(`Создание нового PR...`); const result = await createGitHubPullRequest(repoUrlForForm, filesToCommit, prTitle.trim(), finalDesc, fullCommitMsg); if (result.success && result.prUrl) { toast.success(`PR создан: ${result.prUrl}`); await triggerGetOpenPRs(repoUrlForForm); logger.log(`New PR created: ${result.prUrl}`); } else { toast.error("Ошибка создания PR: " + (result.error || "?")); logger.error("PR Creation Failed:", result.error); } } } catch (err) { toast.error(`Крит. ошибка ${targetBranchName ? 'обновления ветки' : 'создания PR'}.`); logger.error("PR/Update error:", err); } finally { setIsProcessingPR(false); setAssistantLoading(false); logger.log("[handleCreateOrUpdatePR] Finished."); } }, [ componentParsedFiles, selectedAssistantFiles, repoUrlForForm, prTitle, rawDescription, response, validationIssues, targetBranchName, contextOpenPrs, triggerUpdateBranch, setAssistantLoading, user, triggerGetOpenPRs, imageReplaceTask ]);
    const setResponseValue = useCallback((value: string) => { setResponse(value); if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value; setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); logger.log("Response value set manually, resetting parsed state."); }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);
    const updateRepoUrl = useCallback((url: string) => { setRepoUrlStateLocal(url); triggerGetOpenPRs(url); }, [triggerGetOpenPRs]);

    // --- Imperative Handle ---
    useImperativeHandle(ref, () => ({ handleParse, selectAllParsedFiles: handleSelectAllFiles, handleCreatePR: handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace, }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace]);

    // --- RENDER ---
    if (!isMounted) { return ( <div id="executor-loading" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4 min-h-[400px] items-center justify-center"> <FaSpinner className="text-cyan-400 text-4xl animate-spin mb-4"/> <p className="text-gray-400 text-lg">Загрузка Ассистента...</p> </div> ); }

    const isProcessingAny = assistantLoading || aiActionLoading || contextIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedAssistantFiles.size > 0 && !!prTitle.trim() && !!repoUrlForForm && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR"; const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />; const prButtonLoadingIcon = (isProcessingPR || assistantLoading) && !imageReplaceTask ? <FaSpinner className="animate-spin"/> : prButtonIcon; const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId; const showStandardAssistantUI = !imageReplaceTask; const showImageReplaceUI = !!imageReplaceTask;
    const commonDisabled = isProcessingAny; const parseButtonDisabled = commonDisabled || isWaitingForAiResponse || !response.trim() || !!imageReplaceTask; const fixButtonDisabled = commonDisabled || isWaitingForAiResponse || !!imageReplaceTask; const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || assistantLoading;

    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            <header className="flex justify-between items-center gap-2 flex-wrap">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                         {showImageReplaceUI ? "🖼️ Статус Замены Картинки" : "🤖 AI Code Assistant"}
                     </h1>
                     {showStandardAssistantUI && ( <button className="cursor-help p-1" title={assistantTooltipText}> <FaCircleInfo className="text-blue-400 hover:text-blue-300 transition" /> </button> )}
                 </div>
                 <button id="settings-modal-trigger-assistant" onClick={triggerToggleSettingsModal} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingPR || assistantLoading} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>

            {showStandardAssistantUI && (
                 <>
                     <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm min-h-[18px]"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : commonDisabled ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y simple-scrollbar" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : commonDisabled ? "Ожидание..." : "Ответ AI здесь..."} disabled={commonDisabled} spellCheck="false" />
                              <TextAreaUtilities response={response} isLoading={commonDisabled} onParse={handleParse} onOpenModal={handleOpenModal} onCopy={handleCopyResponse} onClear={handleClearResponse} onSelectFunction={handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={isProcessingPR || assistantLoading} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handleRestorationComplete} disabled={commonDisabled || validationStatus === 'validating' || isFetchingOriginals} />
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handleAutoFix} onCopyPrompt={handleCopyFixPrompt} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handleToggleFileSelection} onSelectAll={handleSelectAllFiles} onDeselectAll={handleDeselectAllFiles} onSaveFiles={handleSaveFiles} onDownloadZip={handleDownloadZip} onSendToTelegram={handleSendToTelegram} isUserLoggedIn={!!user} isLoading={commonDisabled} />
                     <PullRequestForm id="pr-form-container" repoUrl={repoUrlForForm} // Use correct URL state
                      prTitle={prTitle} selectedFileCount={selectedAssistantFiles.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={(url) => { setRepoUrlStateLocal(url); /* Don't trigger context update directly */ }} onPrTitleChange={setPrTitle} onCreatePR={handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIcon} isSubmitDisabled={submitButtonDisabled} />
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} disabled={commonDisabled}/>
                         <button onClick={() => setIsImageModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={commonDisabled} title="Загрузить/Связать Картинки (prompts_imgs.txt)" >
                             <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span>
                             {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && ( <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span> )}
                         </button>
                    </div>
                 </>
            )}

            {showImageReplaceUI && ( <div className="flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed border-blue-400 min-h-[200px]"> {(assistantLoading || isProcessingPR) ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> ) : ( fetchStatus === 'loading' || fetchStatus === 'retrying') ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> ) : ( imageReplaceTask ? <FaImages className="text-blue-400 text-4xl mb-4" /> : <FaCheck className="text-green-400 text-4xl mb-4" /> )} <p className="text-lg font-semibold text-blue-300"> {(assistantLoading || isProcessingPR) ? "Заменяю картинку и обновляю ветку/PR..." : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Загрузка файла для замены..." : imageReplaceTask ? "Задача Замены Картинки Активна" : "Замена Завершена"} </p> <p className="text-sm text-gray-400 mt-2"> {(assistantLoading || isProcessingPR) ? "Идет процесс..." : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Ожидание..." : imageReplaceTask ? "Файл загружен, ожидание обработки..." : "Процесс завершен."} </p> {imageReplaceTask && ( <div className="mt-3 text-xs text-gray-500 break-all text-left bg-gray-900/50 p-2 rounded max-w-full overflow-x-auto simple-scrollbar"> <p><span className="font-semibold text-gray-400">Файл:</span> {imageReplaceTask.targetPath}</p> <p><span className="font-semibold text-gray-400">Старый URL:</span> {imageReplaceTask.oldUrl}</p> <p><span className="font-semibold text-gray-400">Новый URL:</span> {imageReplaceTask.newUrl}</p> </div> )} </div> )}

             <AnimatePresence> {showStandardAssistantUI && showModal && (<SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handleSwap} onSearch={handleSearch} initialMode={modalMode} /> )} {showStandardAssistantUI && isImageModalOpen && (<ImageToolsModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} parsedFiles={componentParsedFiles} onUpdateParsedFiles={handleUpdateParsedFiles}/> )} </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;