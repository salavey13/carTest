"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback, useRef } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode, RepoXmlPageContextType
} from "@/contexts/RepoXmlPageContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
import { useAppToast } from '@/hooks/useAppToast'; // Use the hook
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry, ValidationStatus } from "@/hooks/useCodeParsingAndValidation";
import { useAICodeAssistantHandlers } from './assistant_components/handlers';
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
import { AnimatePresence, motion } from "framer-motion";
import {
    FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate,
    FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines, FaCode,
    FaCheck, FaCircleXmark, FaExclamation
} from "react-icons/fa6";
import clsx from "clsx";
import { debugLogger as logger } from "@/lib/debugLogger"; // Use the logger
import { fetchRepoContents } from "@/app/actions_github/actions";

// Interfaces (Keep if needed)
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

    // --- Get Context and Toast early ---
    const pageContext = useRepoXmlPageContext();
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useAppToast(); // Use hook for toasts
    logger.debug("[AICodeAssistant] Function START"); // Log component start

    // --- State ---
    logger.debug("[AICodeAssistant] Before useState");
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
    const [imageReplaceError, setImageReplaceError] = useState<string | null>(null);
    logger.debug("[AICodeAssistant] After useState");


    // --- Hooks ---
    logger.debug("[AICodeAssistant] Before Standard Hooks");
    const appContext = useAppContext();
    logger.debug("[AICodeAssistant] Before useCodeParsingAndValidation");
    const codeParserHook = useCodeParsingAndValidation();
    logger.debug("[AICodeAssistant] After useCodeParsingAndValidation");
    logger.debug("[AICodeAssistant] After Standard Hooks");

    // --- Destructure context ---
    logger.debug("[AICodeAssistant] Before Destructuring");
    const { user } = appContext;
    const {
        setHookParsedFiles, setValidationStatus, setValidationIssues,
        validationIssues, validationStatus, rawDescription,
        isParsing: hookIsParsing,
    } = codeParserHook;
    const {
        setAiResponseHasContent, setFilesParsed, filesParsed,
        selectedAssistantFiles, setSelectedAssistantFiles,
        setAssistantLoading, assistantLoading,
        aiActionLoading, currentAiRequestId,
        openPrs: contextOpenPrs, triggerGetOpenPRs,
        targetBranchName, triggerToggleSettingsModal,
        triggerUpdateBranch, updateRepoUrlInAssistant,
        loadingPrs, setIsParsing: setContextIsParsing,
        isParsing: contextIsParsing,
        imageReplaceTask, setImageReplaceTask,
        fetchStatus, allFetchedFiles, repoUrlEntered,
        repoUrl: repoUrlFromContext,
        setRequestCopied,
        addToast // Keep context addToast only if absolutely necessary (shouldn't be)
    } = pageContext;
    logger.debug("[AICodeAssistant] After Destructuring");

    // --- Handlers Hook ---
    logger.debug("[AICodeAssistant] Before useAICodeAssistantHandlers");
    const handlers = useAICodeAssistantHandlers({
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks, originalRepoFiles, isFetchingOriginals, imageReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR, setOriginalRepoFiles, setIsFetchingOriginals, setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError, setRepoUrlStateLocal,
        setImageReplaceTask,
        codeParserHook,
        appContext,
        pageContext,
        aiResponseInputRefPassed,
        kworkInputRefPassed,
    });
    logger.debug("[AICodeAssistant] After useAICodeAssistantHandlers");

    // --- Destructure handlers ---
    const {
        handleParse, handleAutoFix, handleCopyFixPrompt, handleRestorationComplete,
        handleUpdateParsedFiles, handleClearResponse, handleCopyResponse, handleOpenModal,
        handleSwap, handleSearch, handleSelectFunction, handleToggleFileSelection,
        handleSelectAllFiles, handleDeselectAllFiles, handleSaveFiles, handleDownloadZip,
        handleSendToTelegram, handleAddCustomLink, handleCreateOrUpdatePR,
        handleDirectImageReplace
    } = handlers;

    // --- Callback Hooks ---
    logger.debug("[AICodeAssistant] Before useCallback");
    const setResponseValue = useCallback((value: string) => {
        logger.debug(`[CB setResponseValue] Value length: ${value.length}`);
        setResponse(value);
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value;
        setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); codeParserHook.setRawDescription('');
        setRequestCopied(false); setAiResponseHasContent(value.trim().length > 0);
        logger.log("[CB setResponseValue] Response value set manually, resetting parsed state.");
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, codeParserHook, setRequestCopied, setAiResponseHasContent, setSelectedFileIds]); // Added missing dependency

    const updateRepoUrl = useCallback((url: string) => {
        logger.info(`[CB updateRepoUrl] Updating local URL: ${url}`);
        setRepoUrlStateLocal(url);
        // NOT triggering PR refresh automatically here
     }, []);

    const handleResetImageError = useCallback(() => {
         logger.info(`[CB handleResetImageError] Resetting image error state.`);
         setImageReplaceError(null);
         toastInfo("Состояние ошибки сброшено.");
     }, [setImageReplaceError, toastInfo]);
    logger.debug("[AICodeAssistant] After useCallback");


    // --- Refs ---
    logger.debug("[AICodeAssistant] Before useRef");
    const processingImageReplace = useRef(false);
    const imageReplaceTaskRef = useRef(imageReplaceTask);
    logger.debug("[AICodeAssistant] After useRef");

    // --- Derived State ---
    logger.debug("[AICodeAssistant] Defining derivedRepoUrlForHooks");
    const derivedRepoUrlForHooks = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Effects ---
    logger.debug("[AICodeAssistant] Before useEffects");
    useEffect(() => {
        logger.debug("[Effect Mount] AICodeAssistant Mounted");
        const initialRepoUrl = repoUrlStateLocal || repoUrlFromContext;
        if (initialRepoUrl && initialRepoUrl.includes("github.com")) {
            logger.info(`[Effect Mount] Triggering initial PRs for ${initialRepoUrl}`);
            triggerGetOpenPRs(initialRepoUrl);
        } else {
            logger.debug(`[Effect Mount] Skipping initial PRs (no valid URL yet)`);
        }
    }, [triggerGetOpenPRs, repoUrlStateLocal, repoUrlFromContext]); // Keep dependencies that define initialRepoUrl

    useEffect(() => {
        logger.debug(`[Effect FilesParsed] Update based on componentParsedFiles: ${componentParsedFiles.length > 0}`);
        setFilesParsed(componentParsedFiles.length > 0);
     }, [componentParsedFiles, setFilesParsed]);

    useEffect(() => {
        logger.debug(`[Effect URL Sync] Context URL: ${repoUrlFromContext}, Local URL: ${repoUrlStateLocal}`);
        if (repoUrlFromContext && !repoUrlStateLocal) {
             logger.info(`[Effect URL Sync] Syncing local URL from context: ${repoUrlFromContext}`);
             updateRepoUrl(repoUrlFromContext);
        }
    }, [repoUrlFromContext, repoUrlStateLocal, updateRepoUrl]); // Use the stable updateRepoUrl

    useEffect(() => {
        logger.debug("[Effect State Reset Check] START");
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        const currentlyParsing = contextIsParsing ?? hookIsParsing;
        logger.debug(`[Effect State Reset Check] Conditions: hasContent=${hasContent}, noReq=${!currentAiRequestId}, noAIAct=${!aiActionLoading}, noTask=${!imageReplaceTask}, noAssistLoad=${!assistantLoading}, noProcPR=${!isProcessingPR}, notParsing=${!currentlyParsing}`);
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !currentlyParsing) {
            logger.log("[Effect State Reset Check] Resetting state (empty response/idle).");
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); setRequestCopied(false);
        } else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !currentlyParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) {
            logger.log("[Effect State Reset Check] Resetting validation status (response changed, no files parsed).");
            setValidationStatus('idle'); setValidationIssues([]);
        }
        logger.debug("[Effect State Reset Check] END");
    }, [
        response, currentAiRequestId, aiActionLoading, imageReplaceTask,
        componentParsedFiles.length, contextIsParsing, hookIsParsing,
        assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed,
        setSelectedAssistantFiles, setValidationStatus, setValidationIssues,
        setHookParsedFiles, setOriginalRepoFiles, setComponentParsedFiles,
        setSelectedFileIds, setPrTitle, setRequestCopied
    ]);

    useEffect(() => {
        logger.debug("[Effect Custom Links] START");
        if (!user) { logger.debug("[Effect Custom Links] SKIP: no user"); setCustomLinks([]); return; }
        const loadLinks = async () => {
            logger.debug("[Effect Custom Links] loadLinks START");
            try {
                const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                 logger.debug(`[Effect Custom Links] Supabase response. Error: ${!!e}, Data: ${!!d}`);
                if (!e && d?.metadata?.customLinks) {
                    logger.info(`[Effect Custom Links] Loaded ${d.metadata.customLinks.length} links.`);
                    setCustomLinks(d.metadata.customLinks);
                } else {
                    setCustomLinks([]);
                    if (e && e.code !== 'PGRST116') { // PGRST116 = No rows found (expected if no user/metadata)
                        logger.error("[Effect Custom Links] Error loading custom links (supabase):", e);
                        toastError("Error loading custom links: " + e.message);
                    }
                }
            } catch (e: any) {
                logger.error("[Effect Custom Links] Error loading custom links (catch):", e);
                toastError("Error loading custom links: " + e.message);
                setCustomLinks([]);
            }
            logger.debug("[Effect Custom Links] loadLinks FINISH");
        };
        loadLinks();
        logger.debug("[Effect Custom Links] END");
    }, [user, toastError]);

    useEffect(() => {
        logger.debug("[Effect Fetch Originals] START");
        if (imageReplaceTask) { logger.debug("[Effect Fetch Originals] SKIP: image task active"); return; }
        const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        logger.debug(`[Effect Fetch Originals] Check: skipped=${skipped.length}, noOriginals=${originalRepoFiles.length === 0}, notFetching=${!isFetchingOriginals}, hasUrl=${!!derivedRepoUrlForHooks}`);
        if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && derivedRepoUrlForHooks) {
            const fetchOrig = async () => {
                logger.info("[Effect Fetch Originals] fetchOrig START");
                setIsFetchingOriginals(true);
                const branch = targetBranchName ?? undefined;
                const branchDisp = targetBranchName ?? 'default';
                toastInfo(`Загрузка оригиналов из ${branchDisp}...`);
                try {
                    const res = await fetchRepoContents(derivedRepoUrlForHooks, undefined, branch);
                    logger.debug(`[Effect Fetch Originals] fetchRepoContents response. Success: ${res.success}, Files: ${res.files?.length ?? 'N/A'}`);
                    if (res.success && Array.isArray(res.files)) {
                        const originalFilesData = res.files.map(f => ({ path: f.path, content: f.content }));
                        setOriginalRepoFiles(originalFilesData);
                        toastSuccess("Оригиналы загружены.");
                    } else {
                        logger.error("Error fetching originals:", res.error);
                        toastError("Ошибка загрузки оригиналов: " + (res.error ?? '?'));
                        setOriginalRepoFiles([]);
                    }
                } catch (e: any) {
                    toastError("Крит. ошибка загрузки оригиналов: " + e?.message);
                    logger.error("Fetch originals critical error:", e);
                    setOriginalRepoFiles([]);
                } finally {
                    setIsFetchingOriginals(false);
                    logger.info("[Effect Fetch Originals] fetchOrig FINISH");
                }
            };
            fetchOrig();
        }
        logger.debug("[Effect Fetch Originals] END");
    }, [validationIssues, originalRepoFiles.length, isFetchingOriginals, derivedRepoUrlForHooks, targetBranchName, imageReplaceTask, toastInfo, toastSuccess, toastError]);

    useEffect(() => {
        logger.debug("[Effect Image Replace] START");
        // Read state directly inside the effect
        const currentTask = imageReplaceTask;
        const currentFetchStatus = fetchStatus;
        const currentAllFiles = allFetchedFiles;
        const currentAssistantLoading = assistantLoading;
        const currentProcessingRefVal = processingImageReplace.current;

        const canProcess = currentTask && currentFetchStatus === 'success' && currentAllFiles.length > 0 && currentAllFiles.some(f => f.path === currentTask.targetPath) && !currentAssistantLoading && !currentProcessingRefVal;
        logger.debug(`[Effect Image Replace] Check: canProcess=${canProcess}, task=${!!currentTask}, fetchStatus=${currentFetchStatus}`, { task: currentTask, fetchStatus: currentFetchStatus, allFilesCount: currentAllFiles.length, assistantLoading: currentAssistantLoading, processingRef: currentProcessingRefVal });

        if (canProcess) {
            logger.info("[Effect Image Replace] Conditions MET. Starting image replace process...");
            processingImageReplace.current = true;
            setImageReplaceError(null);

            if (handlers?.handleDirectImageReplace) {
                logger.debug("[Effect Image Replace] Calling handlers.handleDirectImageReplace");
                handlers.handleDirectImageReplace(currentTask, currentAllFiles) // Pass current values
                    .then(() => { logger.info("[Effect Image Replace] .then() - Success"); })
                    .catch(err => { logger.error(`[Effect Image Replace] .catch(): ${err?.message}`, err); })
                    .finally(() => { logger.info("[Effect Image Replace] .finally()"); processingImageReplace.current = false; });
            } else {
                 logger.error("[Effect Image Replace] ERROR: handleDirectImageReplace handler missing!");
                 setImageReplaceError("Internal error: Image replace handler missing.");
                 processingImageReplace.current = false;
                 toastError("Внутренняя ошибка: Обработчик замены картинки отсутствует.");
            }
        } else if (currentTask && currentFetchStatus === 'error' && !currentProcessingRefVal) {
            logger.warn("[Effect Image Replace] Setting error state: Fetch failed.");
             setImageReplaceError("Failed to fetch target file.");
        }
        logger.debug("[Effect Image Replace] END");
     }, [
        imageReplaceTask, fetchStatus, allFetchedFiles, assistantLoading, // Listen to state changes
        handlers, setImageReplaceError, toastError // Stable dependencies
     ]);


    useEffect(() => {
        logger.debug(`[Effect Image Task Ref Update] New task present: ${!!imageReplaceTask}`);
        imageReplaceTaskRef.current = imageReplaceTask;
    }, [imageReplaceTask]);
    logger.debug("[AICodeAssistant] After useEffects");


    // --- Imperative Handle ---
    logger.debug("[AICodeAssistant] Before useImperativeHandle");
    useImperativeHandle(ref, () => ({
        handleParse: () => { logger.debug(`[Imperative] handleParse called.`); handlers.handleParse(); },
        selectAllParsedFiles: () => { logger.debug(`[Imperative] selectAllParsedFiles called.`); handlers.handleSelectAllFiles(); },
        handleCreatePR: () => { logger.debug(`[Imperative] handleCreatePR called.`); handlers.handleCreateOrUpdatePR(); },
        setResponseValue: (val: string) => { logger.debug(`[Imperative] setResponseValue called.`); setResponseValue(val); },
        updateRepoUrl: (url: string) => { logger.debug(`[Imperative] updateRepoUrl called.`); updateRepoUrl(url); },
        handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => { logger.debug(`[Imperative] handleDirectImageReplace called.`); return handlers.handleDirectImageReplace(task, files); },
    }), [handlers, setResponseValue, updateRepoUrl]);
    logger.debug("[AICodeAssistant] After useImperativeHandle");


    // --- Derived State for Rendering ---
    logger.debug("[AICodeAssistant] Calculate Derived State");
    const effectiveIsParsing = contextIsParsing ?? hookIsParsing;
    const isProcessingAny = assistantLoading || aiActionLoading || effectiveIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const finalRepoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedAssistantFiles.size > 0 && !!prTitle.trim() && !!finalRepoUrlForForm && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR";
    const prButtonIconNode = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIconNode = (isProcessingPR || assistantLoading) && !imageReplaceTask ? <FaSpinner className="animate-spin"/> : prButtonIconNode;
    const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const showImageReplaceUI = !!imageReplaceTask || !!imageReplaceError;
    const showStandardAssistantUI = !showImageReplaceUI;
    const imageTaskFailed = !!imageReplaceError && !assistantLoading && !isProcessingPR;
    const parseButtonDisabled = isProcessingAny || isWaitingForAiResponse || !response.trim() || !!imageReplaceTask;
    const fixButtonDisabled = isProcessingAny || isWaitingForAiResponse || !!imageReplaceTask;
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || assistantLoading || !!imageReplaceTask;
    logger.debug(`[Render State] isProcessingAny=${isProcessingAny}, effectiveIsParsing=${effectiveIsParsing}, filesParsed=${filesParsed}, selectedAssistantFiles=${selectedAssistantFiles.size}, canSubmitRegularPR=${canSubmitRegularPR}, showImageReplaceUI=${showImageReplaceUI}`);

    // --- Log before return ---
    logger.debug("[AICodeAssistant] Preparing to render JSX...");

    // --- FINAL RENDER ---
    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            <header className="flex justify-between items-center gap-2 flex-wrap">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                         {showImageReplaceUI ? (imageTaskFailed ? "🖼️ Ошибка Замены Картинки" : "🖼️ Статус Замены Картинки") : "🤖 AI Code Assistant"}
                     </h1>
                     {showStandardAssistantUI && ( <button className="cursor-help p-1" title={assistantTooltipText}> <FaCircleInfo className="text-blue-400 hover:text-blue-300 transition" /> </button> )}
                 </div>
                 <button id="settings-modal-trigger-assistant" onClick={() => { logger.debug("[Click] Settings Toggle Click (Assistant)"); triggerToggleSettingsModal(); }} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingPR || assistantLoading} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>

            {showStandardAssistantUI && (
                 <>
                     <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm min-h-[18px]"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : isProcessingAny ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              {/* Log before rendering textarea */}
                              {(() => { logger.debug("[Render] Rendering Response Textarea"); return null; })()}
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y simple-scrollbar" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : isProcessingAny ? "Ожидание..." : "Ответ AI здесь..."} disabled={isProcessingAny} spellCheck="false" />
                              {/* Log before rendering TextAreaUtilities */}
                              {(() => { logger.debug("[Render] Rendering TextAreaUtilities"); return null; })()}
                              <TextAreaUtilities response={response} isLoading={isProcessingAny} onParse={handlers.handleParse} onOpenModal={handlers.handleOpenModal} onCopy={handlers.handleCopyResponse} onClear={handlers.handleClearResponse} onSelectFunction={handlers.handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={isProcessingPR || assistantLoading} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               {/* Log before rendering CodeRestorer */}
                               {(() => { logger.debug("[Render] Rendering CodeRestorer"); return null; })()}
                               <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handlers.handleRestorationComplete} disabled={isProcessingAny || validationStatus === 'validating' || isFetchingOriginals} />
                               {/* Log before rendering ValidationStatusIndicator */}
                               {(() => { logger.debug("[Render] Rendering ValidationStatusIndicator"); return null; })()}
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handlers.handleAutoFix} onCopyPrompt={handlers.handleCopyFixPrompt} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                      {/* Log before rendering ParsedFilesList */}
                      {(() => { logger.debug("[Render] Rendering ParsedFilesList"); return null; })()}
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handlers.handleToggleFileSelection} onSelectAll={handlers.handleSelectAllFiles} onDeselectAll={handlers.handleDeselectAllFiles} onSaveFiles={handlers.handleSaveFiles} onDownloadZip={handlers.handleDownloadZip} onSendToTelegram={handlers.handleSendToTelegram} isUserLoggedIn={!!user} isLoading={isProcessingAny} />
                     {/* Log before rendering PullRequestForm */}
                     {(() => { logger.debug("[Render] Rendering PullRequestForm"); return null; })()}
                     <PullRequestForm id="pr-form-container" repoUrl={finalRepoUrlForForm}
                      prTitle={prTitle} selectedFileCount={selectedAssistantFiles.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={updateRepoUrl} onPrTitleChange={setPrTitle} onCreatePR={handlers.handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIconNode} isSubmitDisabled={submitButtonDisabled} />
                     {/* Log before rendering OpenPrList */}
                     {(() => { logger.debug("[Render] Rendering OpenPrList"); return null; })()}
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Log before rendering ToolsMenu */}
                        {(() => { logger.debug("[Render] Rendering ToolsMenu"); return null; })()}
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handlers.handleAddCustomLink} disabled={isProcessingAny}/>
                        {/* Log before rendering Image Button */}
                        {(() => { logger.debug("[Render] Rendering Image Button"); return null; })()}
                         <button onClick={() => { logger.debug("[Click] Image Button Click"); setIsImageModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={isProcessingAny} title="Загрузить/Связать Картинки (prompts_imgs.txt)" >
                             <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span>
                             {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && ( <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 shadow-md animate-pulse"></span> )}
                         </button>
                    </div>
                 </>
            )}

            {/* --- Image Replace UI --- */}
            {showImageReplaceUI && (
                 <div className={`flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed min-h-[200px] ${imageTaskFailed ? 'border-red-500' : 'border-blue-400'}`}>
                    {/* Log before rendering Image Replace UI */}
                    {(() => { logger.debug("[Render] Rendering Image Replace UI", { imageTaskFailed, assistantLoading, isProcessingPR, fetchStatus, imageReplaceTask, imageReplaceError }); return null; })()}
                     {/* Status Icon Logic */}
                     {(assistantLoading || isProcessingPR) ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : imageTaskFailed ? <FaCircleXmark className="text-red-400 text-4xl mb-4" />
                       : imageReplaceTask ? <FaImages className="text-blue-400 text-4xl mb-4" />
                       : <FaCheck className="text-green-400 text-4xl mb-4" /> }

                     <p className={`text-lg font-semibold ${imageTaskFailed ? 'text-red-300' : 'text-blue-300'}`}>
                         {(assistantLoading || isProcessingPR) ? "Обработка Замены..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Загрузка Файла..."
                           : imageTaskFailed ? "Ошибка Замены Картинки"
                           : imageReplaceTask ? "Задача Замены Активна"
                           : "Замена Завершена Успешно"}
                     </p>
                     <p className="text-sm text-gray-400 mt-2">
                          {(assistantLoading || isProcessingPR) ? "Создание/обновление PR..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Ожидание ответа от GitHub..."
                           : imageTaskFailed ? (imageReplaceError || "Произошла неизвестная ошибка.")
                           : imageReplaceTask ? "Файл загружен, ожидание обработки Ассистентом..."
                           : "Процесс завершен. Проверьте PR."}
                     </p>
                     {imageReplaceTask && (
                         <div className="mt-3 text-xs text-gray-500 break-all text-left bg-gray-900/50 p-2 rounded max-w-full overflow-x-auto simple-scrollbar">
                             <p><span className="font-semibold text-gray-400">Файл:</span> {imageReplaceTask.targetPath}</p>
                             <p><span className="font-semibold text-gray-400">Старый URL:</span> {imageReplaceTask.oldUrl}</p>
                             <p><span className="font-semibold text-gray-400">Новый URL:</span> {imageReplaceTask.newUrl}</p>
                         </div>
                     )}
                     {imageTaskFailed && (
                          <button
                              onClick={handleResetImageError}
                              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition"
                          > Сбросить Ошибку </button>
                      )}
                 </div>
             )}

            {/* --- Modals --- */}
            <AnimatePresence>
                 {/* Log before rendering Modals */}
                 {(() => { logger.debug("[Render] Rendering Modals (conditional)"); return null; })()}
                {showStandardAssistantUI && showModal && (
                    <SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handlers.handleSwap} onSearch={handlers.handleSearch} initialMode={modalMode} />
                )}
                {showStandardAssistantUI && isImageModalOpen && (
                    <ImageToolsModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} parsedFiles={componentParsedFiles} onUpdateParsedFiles={handlers.handleUpdateParsedFiles}/>
                )}
             </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;