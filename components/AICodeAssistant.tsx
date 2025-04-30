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
import { selectFunctionDefinition, extractFunctionName } from "@/lib/codeUtils"; // Assuming this path is correct

// --- Logger Replacement for Toasts ---
const toastLogger = {
    log: (message: string, data?: any) => toast.info(message + (data ? ` | Data: ${JSON.stringify(data, null, 2).substring(0, 100)}...` : ''), { duration: 3000 }),
    warn: (message: string, data?: any) => toast.warning(message + (data ? ` | Data: ${JSON.stringify(data, null, 2).substring(0, 100)}...` : ''), { duration: 4000 }),
    error: (message: string, data?: any) => toast.error(message + (data ? ` | Err: ${JSON.stringify(data, null, 2).substring(0, 100)}...` : ''), { duration: 5000 }),
    effectCheck: (data: Record<string, any>) => {
        const targetExists = data.targetFileExists ? '✅' : '❌';
        const busy = data.assistantBusy ? 'Busy' : 'Idle';
        const processing = data.alreadyProcessing ? 'Yes' : 'No';
        const msg = `[Effect Check] Task:${data.task ? 'Yes' : 'No'} Status:${data.status} Target:${targetExists} Busy:${busy} Processing:${processing}`;
        toast.info(msg, { duration: 4000 });
    }
};

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
    // NEW state for specific failure reason
    const [imageReplaceError, setImageReplaceError] = useState<string | null>(null);

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
    // Ref to track task state reliably within async .then() blocks
    const imageReplaceTaskRef = useRef(imageReplaceTask);
    useEffect(() => { imageReplaceTaskRef.current = imageReplaceTask; }, [imageReplaceTask]);


    // --- Effects ---
    useEffect(() => { setIsMounted(true); }, []);
    useEffect(() => { setComponentParsedFiles(hookParsedFiles); setFilesParsed(hookParsedFiles.length > 0); }, [hookParsedFiles, setFilesParsed]);
    useEffect(() => {
        if (isMounted && repoUrlFromContext && !repoUrlStateLocal) { setRepoUrlStateLocal(repoUrlFromContext); }
    }, [isMounted, repoUrlFromContext, repoUrlStateLocal]);
    useEffect(() => {
        if (!isMounted) return; const hasContent = response.trim().length > 0; setAiResponseHasContent(hasContent);
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !isParsing) { toastLogger.log("[AICodeAssistant Effect] Resetting state (empty response)."); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); }
        else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) { toastLogger.log("[AICodeAssistant Effect] Resetting validation (response changed)."); setValidationStatus('idle'); setValidationIssues([]); }
    }, [ isMounted, response, currentAiRequestId, aiActionLoading, imageReplaceTask, componentParsedFiles.length, isParsing, assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setHookParsedFiles ]);
    useEffect(() => {
        if (!isMounted || !user) { setCustomLinks([]); return; }
        const loadLinks = async () => { try { const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!e && d?.metadata?.customLinks) { setCustomLinks(d.metadata.customLinks); } else { setCustomLinks([]); if (e && e.code !== 'PGRST116') { toastLogger.error("Error loading custom links (supabase):", e); } } } catch (e) { toastLogger.error("Error loading custom links (catch):", e); setCustomLinks([]); } }; loadLinks();
    }, [isMounted, user]);
    useEffect(() => {
        if (!isMounted || imageReplaceTask) return; const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrlForForm) {
            const fetchOrig = async () => { setIsFetchingOriginals(true); const branch = targetBranchName ?? undefined; const branchDisp = targetBranchName ?? 'default'; toast.info(`Загрузка оригиналов из ${branchDisp}...`); try { const res = await fetchRepoContents(repoUrlForForm, undefined, branch); if (res.success && Array.isArray(res.files)) { const originalFilesData = res.files.map(f => ({ path: f.path, content: f.content })); setOriginalRepoFiles(originalFilesData); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (res.error ?? '?')); setOriginalRepoFiles([]); } } catch (e) { toast.error("Крит. ошибка загрузки оригиналов."); toastLogger.error("Fetch originals error:", e); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOrig();
        }
    }, [isMounted, validationIssues, originalRepoFiles.length, isFetchingOriginals, repoUrlForForm, targetBranchName, imageReplaceTask]);

    // --- Helper Functions ---
    const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

     // --- Direct Image Replacement Handler (Updated PR Title/Search Logic) ---
    const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask, files: FileNode[]): Promise<void> => {
        toast.info("[ImgReplace] START");
        setIsProcessingPR(true);
        setAssistantLoading(true);
        setImageReplaceError(null); // Reset specific error on new attempt

        try {
            // Initial checks
            if (!task || !task.targetPath || !task.oldUrl || !task.newUrl) {
                const errorMsg = "[ImgReplace] Invalid task data!";
                toast.error(errorMsg);
                setImageReplaceError("Invalid task data provided."); // Set specific error
                setImageReplaceTask(null); // Clear the task
                return; // Exit cleanly
            }
            toast.info("[ImgReplace] Task data valid.");

            // Target file check
            const targetFile = files?.find(f => f.path === task.targetPath);
            const targetFound = !!targetFile;
            toast.info(`[ImgReplace] Target file '${task.targetPath.split('/').pop()}' found: ${targetFound ? '✅' : '❌'}`);

            if (!targetFile || typeof targetFile.content !== 'string') {
                 const errorMsg = `Target file '${task.targetPath}' not found or content invalid.`;
                 toast.error(`[ImgReplace] ${errorMsg}`);
                 setImageReplaceError(errorMsg); // Set specific error
                 setImageReplaceTask(null); // Clear task
                 return; // Exit cleanly
             }

            // Old URL Check
            let currentContent = targetFile.content;
            toast.info(`[ImgReplace] Checking old URL...`);
            const oldUrlFound = currentContent.includes(task.oldUrl);

            if (!oldUrlFound) {
                const errorMsg = `Old URL not found in ${task.targetPath}.`;
                toast.error(`[ImgReplace] OLD URL NOT FOUND! Aborting.`);
                toast.warn(`Старый URL "${task.oldUrl.substring(0, 30)}..." не найден.`);
                setImageReplaceError(errorMsg); // Set specific error
                setImageReplaceTask(null); // Clear the task
                return; // Exit cleanly (promise resolves)
            }
             toast.success(`[ImgReplace] Old URL found.`);

            // Content Change Check
            const modifiedContent = currentContent.replaceAll(task.oldUrl, task.newUrl);
            const contentChanged = modifiedContent !== currentContent;

            if (!contentChanged) {
                const infoMsg = `Content of ${task.targetPath} did not change (URLs might be identical).`;
                toast.warning("[ImgReplace] Content unchanged. Aborting.");
                toast.info(`Контент ${task.targetPath} не изменился.`);
                 setImageReplaceError(infoMsg); // Set info message as "error" contextually
                setImageReplaceTask(null); // Clear the task
                return; // Exit cleanly (promise resolves)
            }
             toast.info("[ImgReplace] Content changed.");


            // PR/Commit Logic
            toast.info(`[ImgReplace] Preparing commit/PR...`);
            const filesToCommit: { path: string; content: string }[] = [{ path: task.targetPath, content: modifiedContent }];

            // --- *** MODIFIED TITLE LOGIC START *** ---
            // Commit message still includes specific image for history clarity
            const newImageFilenameForCommit = task.newUrl.split('/').pop()?.split('?')[0] || 'image';
            const specificCommitMsg = `chore: Update image ${newImageFilenameForCommit} in ${task.targetPath}`;
            // PR Title is now generic to the PAGE being updated
            const genericPrTitle = `chore: Update images in ${task.targetPath}`;
            const safePrTitle = genericPrTitle.length > 72 ? genericPrTitle.substring(0, 69) + '...' : genericPrTitle;
            // --- *** MODIFIED TITLE LOGIC END *** ---

            // PR Description remains specific
            const prDesc = `Replaced image via SuperVibe Studio.\n\nFile: \`${task.targetPath}\`\nOld: \`${task.oldUrl}\`\nNew: \`${task.newUrl}\``;
            // Full commit message for git commit
            const fullCommitMsg = `${specificCommitMsg}\n\n${prDesc}`; // Use specific commit message here

            let existingPrBranch: string | null = null; let existingPrNum: number | null = null;
            // --- *** UPDATED PR SEARCH LOGIC *** ---
            const expectedPrTitlePrefix = `chore: Update images in`; // Use the new generic prefix
            const expectedPrFile = task.targetPath; // Still use the file path
            toast.info(`[ImgReplace] Searching for existing PRs (Prefix: '${expectedPrTitlePrefix}', File: ${expectedPrFile})...`);
             if (contextOpenPrs && contextOpenPrs.length > 0) {
                 // Search using the new prefix and the file path
                 const matchPr = contextOpenPrs.find(pr =>
                     pr.title?.startsWith(expectedPrTitlePrefix) &&
                     pr.title?.includes(expectedPrFile) && // Make sure it's for the correct file
                     pr.head?.ref);
            // --- *** END UPDATED PR SEARCH LOGIC *** ---

                 if (matchPr) {
                      if (matchPr.head.ref && typeof matchPr.number === 'number') {
                          existingPrBranch = matchPr.head.ref; existingPrNum = matchPr.number;
                          toast.info(`[ImgReplace] Found existing PR #${existingPrNum} ('${matchPr.title}') on branch '${existingPrBranch}'`);
                          toast.info(`Обновляю PR #${existingPrNum} для картинок на странице...`);
                      } else { toastLogger.error("[ImgReplace] Found PR, but ref/num missing:", matchPr); }
                 } else { toast.info(`[ImgReplace] No specific existing PR found matching prefix and file.`); }
             } else { toast.info("[ImgReplace] No open PRs in context."); }
             const branchToUpd = existingPrBranch || (existingPrNum === null ? targetBranchName : null);
             toast.info(`[ImgReplace] Action: ${existingPrBranch ? 'Update existing PR branch' : (branchToUpd ? `Update target branch ${branchToUpd}` : 'Create new PR/branch')}`);

             // Execute Action (Update or Create)
             if (branchToUpd && existingPrNum !== null) {
                 toast.info(`[ImgReplace] Calling triggerUpdateBranch...`);
                 // Use specific commit message, generic PR title isn't needed for update function directly
                 // The PR description (prDesc) will be added as a comment
                 const res = await triggerUpdateBranch( repoUrlForForm, filesToCommit, fullCommitMsg, branchToUpd, existingPrNum, prDesc );
                 if (!res.success) { throw new Error(res.error || "Failed to update branch"); } // Throws on failure
                 toast.success(`[ImgReplace] Branch ${branchToUpd} updated for PR #${existingPrNum}.`);
             } else {
                 toast.info(`[ImgReplace] Calling createGitHubPullRequest...`);
                 // Use the new GENERIC PR title when creating a NEW PR
                 const res = await createGitHubPullRequest(repoUrlForForm, filesToCommit, safePrTitle, prDesc, fullCommitMsg);
                 if (res.success && res.prUrl) {
                     toast.success(`PR для картинок создан: ${res.prUrl}`);
                     await triggerGetOpenPRs(repoUrlForForm);
                     toast.success(`[ImgReplace] New PR created: ${res.prUrl}`);
                 } else {
                     toastLogger.error("PR Img Create Failed:", res.error);
                     throw new Error(res.error || "Failed to create PR"); // Throws on failure
                 }
             }

            toast.success("[ImgReplace] Operation completed successfully.");
            setImageReplaceTask(null); // Clear task ONLY on full success

        } catch (err: any) {
            // This catch block handles actual errors THROWN from the try block (e.g., PR failures)
            const errorMessage = err?.message || "Неизвестная ошибка при замене";
            const errorType = err?.constructor?.name || "Error";
            toast.error(`Ошибка замены картинки: ${errorMessage.substring(0,100)}...`);
            toast.error(`[ImgReplace] CATCH (${errorType}): ${errorMessage.substring(0, 150)}...`);
            setImageReplaceError(`Operation failed: ${errorMessage}`); // Set specific error
            setImageReplaceTask(null); // Clear task on failure
            console.error("[AICodeAssistant] Full error object in catch:", err); // Keep console log for detailed debugging if possible
        } finally {
            toast.info("[ImgReplace] FINALLY");
            setIsProcessingPR(false);
            setAssistantLoading(false);
            // Do NOT clear task here - let success/error handlers do it
        }
    }, [ // Ensure all dependencies are listed, including the new state setter
        contextOpenPrs, targetBranchName, repoUrlForForm, setAssistantLoading,
        setImageReplaceTask, triggerGetOpenPRs, triggerUpdateBranch,
        setIsProcessingPR, setImageReplaceError
    ]);


     // --- Effect to handle image replacement AFTER fetch completes (Updated) ---
    useEffect(() => {
        // Toast Log for Effect Check
        if (imageReplaceTask) {
             toastLogger.effectCheck({
                 task: imageReplaceTask, status: fetchStatus,
                 filesCount: allFetchedFiles.length,
                 targetFileExists: allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath),
                 assistantBusy: assistantLoading, alreadyProcessing: processingImageReplace.current
             });
        }

        const canProcess = imageReplaceTask && fetchStatus === 'success' && allFetchedFiles.length > 0 && allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath) && !assistantLoading && !processingImageReplace.current;

        if (canProcess) {
            toast.info("[Effect] Conditions met. Starting image replace process...");
            processingImageReplace.current = true;
            setImageReplaceError(null); // Reset specific error before starting
            handleDirectImageReplace(imageReplaceTask, allFetchedFiles)
                .then(() => {
                    // This .then() runs if handleDirectImageReplace resolves (even if URL wasn't found)
                    // Check ref for LATEST task state AFTER await potentially cleared it
                     // Using state directly is also fine here as we are in the main component scope
                     if (imageReplaceTaskRef.current) { // Use ref to check state *at the time the promise was initiated*
                        // Task wasn't cleared inside handleDirectImageReplace (meaning URL/content issue happened)
                        // Check if a specific error was set
                        if(imageReplaceError) { // Check the state variable directly
                             toast.warning(`[Effect] Replace finished, but with issue: ${imageReplaceError}`);
                         } else {
                             // This case is less likely now with explicit error setting
                             toast.info("[Effect] Replace process resolved, but task still active? (Check logic)");
                         }
                     } else {
                         // Task was cleared, meaning full success including PR/Update
                         toast.success("[Effect] Replace process resolved successfully.");
                     }
                })
                .catch(err => {
                    // This .catch() only runs if handleDirectImageReplace *rejects* (e.g., PR creation failed)
                    const errorMsg = err?.message || "Unknown error";
                    toastLogger.error("[Effect] handleDirectImageReplace Promise REJECTED:", errorMsg);
                    setImageReplaceError(`Promise rejected: ${errorMsg}`); // Set error state
                })
                .finally(() => {
                    toast.info("[Effect] Process finished (finally block).");
                    processingImageReplace.current = false;
                });
        } else if (imageReplaceTask && fetchStatus === 'error') {
            toast.warning("[Effect] Image task active, but fetch status is error.");
             setImageReplaceError("Failed to fetch target file."); // Set error state
             // Optionally clear the task if fetch fails definitively?
             // setImageReplaceTask(null);
        }
         else if (imageReplaceTask && !canProcess && fetchStatus !== 'loading' && fetchStatus !== 'retrying') {
             // Log only if not already loading/retrying
             // toast.info("[Effect] Img task active, but conditions not met yet.", { duration: 3000 });
         }

    }, [ // Ensure all dependencies listed, including the new state setter
        imageReplaceTask, fetchStatus, allFetchedFiles, assistantLoading,
        handleDirectImageReplace, setImageReplaceError, // Added setImageReplaceError dependency
        imageReplaceError // Also depend on imageReplaceError to react to its changes if needed elsewhere in effect
    ]);


    // --- Handlers (Restored Full Implementations) ---
    const handleParse = useCallback(async () => {
        if (imageReplaceTask) { toast.warn("Разбор не нужен для картинки."); return; }
        if (!response.trim()) { toast.warn("Нет ответа AI для разбора."); return; }
        toastLogger.log("[AICodeAssistant] Starting parse...");
        setContextIsParsing(true); setAssistantLoading(true); setOriginalRepoFiles([]);
        try {
            const { files: newlyParsedFiles, description: parsedRawDesc } = await parseAndValidateResponse(response);
            setHookParsedFiles(newlyParsedFiles);
            const initialSelection = new Set(newlyParsedFiles.map(f => f.id));
            setSelectedFileIds(initialSelection);
            setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));
            if (newlyParsedFiles.length > 0) { setPrTitle(extractPRTitleHint(parsedRawDesc || response)); }
            else { setPrTitle(''); }
            toast.success(`Разбор завершен. Найдено ${newlyParsedFiles.length} файлов.`);
        } catch (error) {
            toastLogger.error("Parse error:", error); toast.error("Ошибка разбора ответа AI.");
            setFilesParsed(false); setHookParsedFiles([]); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
            setValidationStatus('error'); setValidationIssues([{type: 'parseError', message: 'Ошибка парсинга ответа.', fixable: false, restorable: false, id:'parse_error', fileId: 'general', filePath: 'N/A'}]);
        } finally {
            setContextIsParsing(false); setAssistantLoading(false);
        }
     }, [response, imageReplaceTask, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setContextIsParsing, setAssistantLoading, setValidationStatus, setValidationIssues, setHookParsedFiles]);

    const handleAutoFix = useCallback(() => {
        if (imageReplaceTask) return;
        autoFixIssues(componentParsedFiles, validationIssues);
     }, [autoFixIssues, componentParsedFiles, validationIssues, imageReplaceTask]);

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
        setHookParsedFiles(updatedFiles);
        const remaining = validationIssues.filter(i => i.type !== 'skippedCodeBlock');
        setValidationIssues(remaining);
        setValidationStatus(remaining.length > 0 ? (remaining.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success');
        if (successCount > 0) toast.success(`${successCount} блоков кода восстановлено.`);
        if (errorCount > 0) toast.error(`${errorCount} блоков не удалось восстановить.`);
     }, [validationIssues, setHookParsedFiles, setValidationIssues, setValidationStatus, imageReplaceTask]);

    const handleUpdateParsedFiles = useCallback((updatedFiles: ValidationFileEntry[]) => {
        if (imageReplaceTask) return;
        toastLogger.log("UpdateParsedFiles:", updatedFiles.length);
        setHookParsedFiles(updatedFiles);
        toast.info("Файлы обновлены после замены плейсхолдеров.");
        setValidationStatus('idle'); setValidationIssues([]);
     }, [setHookParsedFiles, setValidationStatus, setValidationIssues, imageReplaceTask]);

    const handleClearResponse = useCallback(() => {
        if (imageReplaceTask) return;
        setResponse("");
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = "";
        toast.info("Поле ответа AI очищено.");
     }, [aiResponseInputRefPassed, imageReplaceTask]);

    const handleCopyResponse = useCallback(() => {
        if (!response) return;
        navigator.clipboard.writeText(response).then(() => toast.success("Ответ AI скопирован!")).catch(() => toast.error("Ошибка копирования ответа."));
     }, [response]);

    const handleOpenModal = useCallback((mode: 'replace' | 'search') => {
        if (imageReplaceTask) return;
        setModalMode(mode); setShowModal(true);
     }, [imageReplaceTask]);

    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find || !aiResponseInputRefPassed.current || imageReplaceTask) return;
        try {
            const ta = aiResponseInputRefPassed.current; const curVal = ta.value;
            const escFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rgx = new RegExp(escFind, 'g'); const newVal = curVal.replace(rgx, replace);
            if (newVal !== curVal) {
                setResponse(newVal);
                requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = newVal; });
                setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
                setValidationStatus('idle'); setValidationIssues([]);
                toast.success(`Текст заменен! "${find}" -> "${replace}". Жми '➡️'.`);
            } else { toast.info(`Текст "${find}" не найден в ответе AI.`); }
        } catch (e: any) { toast.error(`Ошибка замены: ${e.message}`); }
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, imageReplaceTask]);

    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText || !aiResponseInputRefPassed.current || imageReplaceTask) return;
        const ta = aiResponseInputRefPassed.current; const txtCont = ta.value;
        if (isMultiline) {
            const clnSrch = searchText.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
            if (!clnSrch) { toast.error("Текст для мультилайн поиска/замены пуст."); return; }
            const fL = clnSrch.split('\n')[0]; const fN = extractFunctionName(fL ?? '');
            if (!fN) { toast.error("Не удалось извлечь имя функции для замены."); return; }
            const fRgx = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${fN}\\s*(?:\\(|[:=]|<)`, 'm');
            let match = fRgx.exec(txtCont);
            if (!match) { const mRgx = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${fN}\\s*\\(`, 'm'); match = mRgx.exec(txtCont); }
            if (!match || match.index === undefined) { toast.info(`Функция/Класс "${fN}" не найдена в ответе AI.`); return; }
            const mSI = match.index + (match[1]?.length || 0); const [sP, eP] = selectFunctionDefinition(txtCont, mSI);
            if (sP === -1 || eP === -1) { toast.error("Не удалось выделить тело функции/класса для замены."); return; }
            const nV = txtCont.substring(0, sP) + clnSrch + txtCont.substring(eP);
            setResponse(nV);
            requestAnimationFrame(() => { if (aiResponseInputRefPassed.current) { aiResponseInputRefPassed.current.value = nV; aiResponseInputRefPassed.current.focus(); aiResponseInputRefPassed.current.setSelectionRange(sP, sP + clnSrch.length); } });
            setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
            setValidationStatus('idle'); setValidationIssues([]);
            toast.success(`Функция "${fN}" заменена! ✨ Жми '➡️'.`);
        } else {
            const sTL = searchText.toLowerCase(); const tCL = txtCont.toLowerCase();
            const cP = ta.selectionStart || 0; let fI = tCL.indexOf(sTL, cP);
            if (fI === -1) { fI = tCL.indexOf(sTL, 0); if (fI === -1 || fI >= cP) { toast.info(`"${searchText}" не найден.`); ta.focus(); return; } toast.info("Поиск с начала."); }
            ta.focus(); ta.setSelectionRange(fI, fI + searchText.length);
            toast(`Найдено: "${searchText}"`, { style: { background: "rgba(30, 64, 175, 0.9)", color: "#fff", border: "1px solid rgba(37, 99, 235, 0.3)", backdropFilter: "blur(3px)" }, duration: 2000 });
        }
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, imageReplaceTask]);

    const handleSelectFunction = useCallback(() => {
        if (imageReplaceTask) return;
        const ta = aiResponseInputRefPassed.current; if (!ta) return; const txt = ta.value;
        const cP = ta.selectionStart || 0; const lSI = txt.lastIndexOf('\n', cP - 1) + 1;
        const [sP, eP] = selectFunctionDefinition(txt, lSI);
        if (sP !== -1 && eP !== -1) { ta.focus(); ta.setSelectionRange(sP, eP); toast.success("Функция/Блок выделена!"); }
        else { let sUI = txt.lastIndexOf('{', lSI); if (sUI > 0) { const [uSP, uEP] = selectFunctionDefinition(txt, sUI); if (uSP !== -1 && uEP !== -1) { ta.focus(); ta.setSelectionRange(uSP, uEP); toast.success("Найден блок выше!"); return; } } toast.info("Не удалось выделить функцию/блок."); ta.focus(); }
     }, [aiResponseInputRefPassed, imageReplaceTask]);

    const handleToggleFileSelection = useCallback((fileId: string) => {
        if (imageReplaceTask) return;
        setSelectedFileIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) newSet.delete(fileId); else newSet.add(fileId);
            const selPaths = new Set( Array.from(newSet).map(id => componentParsedFiles.find(f => f.id === id)?.path).filter((path): path is string => !!path) );
            setSelectedAssistantFiles(selPaths);
            return newSet;
        });
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask]);

    const handleSelectAllFiles = useCallback(() => {
        if (componentParsedFiles.length === 0 || imageReplaceTask) return;
        const allIds = new Set(componentParsedFiles.map(f => f.id));
        const allPaths = new Set(componentParsedFiles.map(f => f.path));
        setSelectedFileIds(allIds); setSelectedAssistantFiles(allPaths);
        toast.info(`${allIds.size} файлов выбрано.`);
     }, [componentParsedFiles, setSelectedAssistantFiles, imageReplaceTask]);

    const handleDeselectAllFiles = useCallback(() => {
        if (imageReplaceTask) return;
        setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        toast.info("Выделение снято со всех файлов.");
     }, [setSelectedAssistantFiles, imageReplaceTask]);

    const handleSaveFiles = useCallback(async () => {
        if (!user || imageReplaceTask) return;
        const fTS = componentParsedFiles.filter(f => selectedFileIds.has(f.id));
        if (fTS.length === 0) { toast.warn("Нет выбранных файлов для сохранения."); return; }
        setIsProcessingPR(true);
        try {
            const fD = fTS.map(f => ({ p: f.path, c: f.content, e: f.extension }));
            const { data: eD, error: fE } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            if (fE && fE.code !== 'PGRST116') throw fE;
            const eF = eD?.metadata?.generated_files || []; const nP = new Set(fD.map(f => f.p));
            const mF = [ ...eF.filter((f: any) => !nP.has(f.path)), ...fD.map(f => ({ path: f.p, code: f.c, extension: f.e })) ];
            const { error: uE } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(eD?.metadata || {}), generated_files: mF } }, { onConflict: 'user_id' });
            if (uE) throw uE;
            toast.success(`${fTS.length} файлов сохранено в вашем профиле.`);
        } catch (err) {
            toast.error("Ошибка сохранения файлов."); toastLogger.error("Save files error:", err);
        } finally { setIsProcessingPR(false); }
     }, [user, componentParsedFiles, selectedFileIds, imageReplaceTask]);

    const handleDownloadZip = useCallback(async () => {
        if (imageReplaceTask) return;
        const fTZ = componentParsedFiles.filter(f => selectedFileIds.has(f.id));
        if (fTZ.length === 0) { toast.warn("Нет выбранных файлов для скачивания."); return; }
        setIsProcessingPR(true);
        try {
            const JSZip = (await import("jszip")).default; const zip = new JSZip();
            fTZ.forEach((f) => zip.file(f.path.startsWith('/') ? f.path.substring(1) : f.path, f.content));
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ai_files_${Date.now()}.zip`);
            toast.success("Архив с выбранными файлами скачан.");
        } catch (error) {
            toast.error("Ошибка создания ZIP архива."); toastLogger.error("ZIP error:", error);
        } finally { setIsProcessingPR(false); }
     }, [componentParsedFiles, selectedFileIds, imageReplaceTask]);

    const handleSendToTelegram = useCallback(async (file: FileEntry) => {
        if (!user?.id || imageReplaceTask) return;
        setIsProcessingPR(true);
        try {
            const res = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file.txt");
            if (!res.success) throw new Error(res.error ?? "TG Send Error");
            toast.success(`Файл "${file.path}" отправлен вам в Telegram.`);
        } catch (err: any) {
            toast.error(`Ошибка отправки в TG: ${err.message}`); toastLogger.error("Send TG error:", err);
        } finally { setIsProcessingPR(false); }
     }, [user, imageReplaceTask]);

    const handleAddCustomLink = useCallback(async () => {
        if (!user || imageReplaceTask) return;
        const name = prompt("Название:"); if (!name) return;
        const url = prompt("URL (https://...):"); if (!url || !url.startsWith('http')) { toast.error("Некорректный URL."); return; }
        const newLink = { name: name.trim(), url: url.trim() };
        const updatedLinks = [...customLinks, newLink]; setCustomLinks(updatedLinks);
        try {
            const { data: eD } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
            await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(eD?.metadata || {}), customLinks: updatedLinks } }, { onConflict: 'user_id' });
            toast.success(`Ссылка "${name}" добавлена.`);
        } catch (e) {
            toast.error("Ошибка сохранения ссылки."); toastLogger.error("Save link error:", e); setCustomLinks(customLinks);
        }
     }, [customLinks, user, imageReplaceTask]);

    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => {
        if (imageReplaceTask) { toast.warn("Недоступно во время замены картинки."); return; }
        const selFilesCont = componentParsedFiles.filter(f => selectedAssistantFiles.has(f.path));
        if (!repoUrlForForm || selFilesCont.length === 0 || !prTitle.trim()) { toast.error("Нужен URL репозитория, Заголовок PR/Commit и хотя бы один выбранный Файл."); return; }
        let finalDesc = (rawDescription || response).substring(0, 60000) + ((rawDescription || response).length > 60000 ? "\n\n...(truncated)" : "");
        finalDesc += `\n\n**Файлы (${selFilesCont.length}):**\n` + selFilesCont.map(f => `- \`${f.path}\``).join('\n');
        const relIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment');
        if (relIssues.length > 0) { finalDesc += "\n\n**Проблемы Валидации:**\n" + relIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); }
        const commitSubj = prTitle.trim().substring(0, 70); const firstLineSrc = rawDescription || response;
        const commitBody = `Apply AI assistant changes to ${selFilesCont.length} files.\nRef: ${firstLineSrc.split('\n')[0]?.substring(0, 100) ?? ''}...`;
        const fullCommitMsg = `${commitSubj}\n\n${commitBody}`; const filesToCommit = selFilesCont.map(f => ({ path: f.path, content: f.content }));
        setIsProcessingPR(true); setAssistantLoading(true); toastLogger.log("[handleCreateOrUpdatePR] Initiating PR/Update process.");
        try {
            let prToUpdate: SimplePullRequest | null = null;
            if (contextOpenPrs && contextOpenPrs.length > 0) {
                 prToUpdate = contextOpenPrs.find(pr => pr.title.toLowerCase().includes("ai changes") || pr.title.toLowerCase().includes("supervibe") || pr.title.toLowerCase().includes("ai assistant") || pr.title.toLowerCase().includes(commitSubj.toLowerCase().substring(0, 20))) ?? null;
                 if (prToUpdate) { toastLogger.log(`Found existing PR #${prToUpdate.number}.`); toast.info(`Обновляю существующий PR #${prToUpdate.number}...`); } else { toastLogger.log("No suitable existing PR found."); }
             }
            const branchToUpdate = prToUpdate?.head.ref || targetBranchName;
            if (branchToUpdate) {
                 toastLogger.log(`Updating branch '${branchToUpdate}'. PR#: ${prToUpdate?.number}`); toast.info(`Обновление ветки '${branchToUpdate}'...`);
                 const updateResult = await triggerUpdateBranch( repoUrlForForm, filesToCommit, fullCommitMsg, branchToUpdate, prToUpdate?.number, finalDesc );
                 if (!updateResult.success) { toastLogger.error(`Failed to update branch '${branchToUpdate}': ${updateResult.error}`); }
             } else {
                 toastLogger.log(`Creating new PR.`); toast.info(`Создание нового PR...`);
                 const result = await createGitHubPullRequest(repoUrlForForm, filesToCommit, prTitle.trim(), finalDesc, fullCommitMsg);
                 if (result.success && result.prUrl) { toast.success(`PR создан: ${result.prUrl}`); await triggerGetOpenPRs(repoUrlForForm); toastLogger.log(`New PR created: ${result.prUrl}`); }
                 else { toast.error("Ошибка создания PR: " + (result.error || "?")); toastLogger.error("PR Creation Failed:", result.error); }
             }
        } catch (err) {
            toast.error(`Крит. ошибка ${targetBranchName ? 'обновления ветки' : 'создания PR'}.`); toastLogger.error("PR/Update error:", err);
        } finally { setIsProcessingPR(false); setAssistantLoading(false); toastLogger.log("[handleCreateOrUpdatePR] Finished."); }
     }, [ componentParsedFiles, selectedAssistantFiles, repoUrlForForm, prTitle, rawDescription, response, validationIssues, targetBranchName, contextOpenPrs, triggerUpdateBranch, setAssistantLoading, user, triggerGetOpenPRs, imageReplaceTask ]);

    const setResponseValue = useCallback((value: string) => {
        setResponse(value);
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value;
        setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        setValidationStatus('idle'); setValidationIssues([]);
        toastLogger.log("Response value set manually, resetting parsed state.");
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const updateRepoUrl = useCallback((url: string) => {
        setRepoUrlStateLocal(url);
        triggerGetOpenPRs(url);
     }, [triggerGetOpenPRs]);


    // --- Imperative Handle ---
    useImperativeHandle(ref, () => ({ handleParse, selectAllParsedFiles: handleSelectAllFiles, handleCreatePR: handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace, }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace]);

    // --- RENDER ---
    if (!isMounted) { return ( <div id="executor-loading" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4 min-h-[400px] items-center justify-center"> <FaSpinner className="text-cyan-400 text-4xl animate-spin mb-4"/> <p className="text-gray-400 text-lg">Загрузка Ассистента...</p> </div> ); }

    const isProcessingAny = assistantLoading || aiActionLoading || contextIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedAssistantFiles.size > 0 && !!prTitle.trim() && !!repoUrlForForm && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR"; const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />; const prButtonLoadingIcon = (isProcessingPR || assistantLoading) && !imageReplaceTask ? <FaSpinner className="animate-spin"/> : prButtonIcon; const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    // Updated UI visibility logic
    const showImageReplaceUI = !!imageReplaceTask || !!imageReplaceError; // Show UI if task active OR if there was a recent error
    const showStandardAssistantUI = !showImageReplaceUI; // Show standard UI only if image replace UI is not shown
    const imageTaskFailed = !!imageReplaceError && !assistantLoading && !isProcessingPR; // Define failure state more clearly


    const commonDisabled = isProcessingAny; const parseButtonDisabled = commonDisabled || isWaitingForAiResponse || !response.trim() || !!imageReplaceTask; const fixButtonDisabled = commonDisabled || isWaitingForAiResponse || !!imageReplaceTask; const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || assistantLoading;

    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            <header className="flex justify-between items-center gap-2 flex-wrap">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                         {/* Title reflects image replace mode or error */}
                         {showImageReplaceUI ? (imageTaskFailed ? "🖼️ Ошибка Замены Картинки" : "🖼️ Статус Замены Картинки") : "🤖 AI Code Assistant"}
                     </h1>
                     {showStandardAssistantUI && ( <button className="cursor-help p-1" title={assistantTooltipText}> <FaCircleInfo className="text-blue-400 hover:text-blue-300 transition" /> </button> )}
                 </div>
                 <button id="settings-modal-trigger-assistant" onClick={triggerToggleSettingsModal} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingPR || assistantLoading} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>

            {/* --- Standard Assistant UI (Conditional Render) --- */}
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

            {/* --- Image Replace UI (Updated) --- */}
            {showImageReplaceUI && (
                 <div className={`flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed min-h-[200px] ${
                     imageTaskFailed ? 'border-red-500' : 'border-blue-400' // Red border on failure
                 }`}>
                     {/* Icon based on state */}
                     {(assistantLoading || isProcessingPR) ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : imageTaskFailed ? <FaCircleXmark className="text-red-400 text-4xl mb-4" /> // Failure icon
                       : imageReplaceTask ? <FaImages className="text-blue-400 text-4xl mb-4" /> // Task active icon
                       : <FaCheck className="text-green-400 text-4xl mb-4" /> /* Success (task cleared, no error) */ }

                     {/* Text based on state */}
                     <p className={`text-lg font-semibold ${imageTaskFailed ? 'text-red-300' : 'text-blue-300'}`}>
                         {(assistantLoading || isProcessingPR) ? "Обработка Замены..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Загрузка Файла..."
                           : imageTaskFailed ? "Ошибка Замены Картинки" // Failure title
                           : imageReplaceTask ? "Задача Замены Активна"
                           : "Замена Завершена Успешно"}
                     </p>
                      {/* Detailed message */}
                     <p className="text-sm text-gray-400 mt-2">
                         {(assistantLoading || isProcessingPR) ? "Создание/обновление PR..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Ожидание..."
                           : imageTaskFailed ? (imageReplaceError || "Произошла ошибка.") // Show specific error message
                           : imageReplaceTask ? "Файл загружен, ожидание обработки..."
                           : "Процесс завершен."}
                     </p>
                     {/* Show task details only if task is still active */}
                     {imageReplaceTask && (
                         <div className="mt-3 text-xs text-gray-500 break-all text-left bg-gray-900/50 p-2 rounded max-w-full overflow-x-auto simple-scrollbar">
                             <p><span className="font-semibold text-gray-400">Файл:</span> {imageReplaceTask.targetPath}</p>
                             <p><span className="font-semibold text-gray-400">Старый URL:</span> {imageReplaceTask.oldUrl}</p>
                             <p><span className="font-semibold text-gray-400">Новый URL:</span> {imageReplaceTask.newUrl}</p>
                         </div>
                     )}
                      {/* Button to clear error state and allow retry? */}
                     {imageTaskFailed && (
                          <button
                              onClick={() => {
                                  setImageReplaceError(null);
                                  // Decide if task should be reset automatically or if user needs to restart flow
                                  // setImageReplaceTask(null); // Option: clear task too if user needs to restart fully
                                  toast.info("Состояние ошибки сброшено.");
                              }}
                              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition"
                          >
                              Сбросить Ошибку
                          </button>
                      )}
                 </div>
             )}


            {/* --- Modals (Conditional Render based on standard UI visibility) --- */}
            <AnimatePresence>
                {showStandardAssistantUI && showModal && (
                    <SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handleSwap} onSearch={handleSearch} initialMode={modalMode} />
                )}
                {showStandardAssistantUI && isImageModalOpen && (
                    <ImageToolsModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} parsedFiles={componentParsedFiles} onUpdateParsedFiles={handleUpdateParsedFiles}/>
                )}
             </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;