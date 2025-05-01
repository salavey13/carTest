"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback, useRef } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode
} from "@/contexts/RepoXmlPageContext";
// Removed direct action imports if handled solely by context triggers passed to hook
// import { createGitHubPullRequest, updateBranch, fetchRepoContents } from "@/app/actions_github/actions";
// import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase"; // Keep if used for Supabase Admin client
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
import { useAppToast } from '@/hooks/useAppToast'; // <<< IMPORT useAppToast
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry, ValidationStatus } from "@/hooks/useCodeParsingAndValidation";
import { useAICodeAssistantHandlers } from './assistant_components/handlers'; // <<< IMPORT THE NEW HOOK
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
// REMOVED: import { toast } from "sonner"; // <<< REMOVED direct import
import { AnimatePresence, motion } from "framer-motion";
import {
    FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate,
    FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines, FaCode,
    FaCheck, FaCircleXmark, FaExclamation
} from "react-icons/fa6";
import clsx from "clsx";
// import { saveAs } from "file-saver"; // Moved to handlers.ts
// import { selectFunctionDefinition, extractFunctionName } from "@/lib/codeUtils"; // Moved to handlers.ts
import { debugLogger as logger } from "@/lib/debugLogger"; // Keep logger
import { fetchRepoContents } from "@/app/actions_github/actions"; // <<< Keep for fetchOrig

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

    // --- State (Keep state managed by this component) ---
    // ALL useState calls MUST be at the top level, before any returns or conditions
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
    const [imageReplaceError, setImageReplaceError] = useState<string | null>(null);

    // --- Hooks ---
    // ALL hook calls MUST be at the top level, before any returns or conditions
    const appContext = useAppContext(); // Get full AppContext
    const codeParserHook = useCodeParsingAndValidation(); // Get full Code Parser hook result
    const pageContext = useRepoXmlPageContext(); // Get full Page Context
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useAppToast(); // <<< USE THE HOOK

    // --- Destructure necessary parts from contexts/hooks for passing & direct use ---
    const { user } = appContext;
    const {
        setHookParsedFiles, setValidationStatus, setValidationIssues,
        validationIssues, validationStatus, rawDescription, // Needed directly for UI logic
        // Destructure the hook's isParsing state directly
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
        // Destructure the context's isParsing state directly
        isParsing: contextIsParsing,
        imageReplaceTask, setImageReplaceTask, // <<< Make sure setImageReplaceTask is destructured here
        fetchStatus, allFetchedFiles, repoUrlEntered,
        repoUrl: repoUrlFromContext,
        setRequestCopied, // Needed for handlers hook
        addToast // Use context toast for consistency if needed, or local useAppToast
    } = pageContext;

    // --- <<< USE THE NEW HANDLERS HOOK >>> ---
    // Must be called at the top level
    const handlers = useAICodeAssistantHandlers({
        // Pass all required state and setters
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks, originalRepoFiles, isFetchingOriginals, imageReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR, setOriginalRepoFiles, setIsFetchingOriginals, setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError, setRepoUrlStateLocal,
        // Pass hook results/setters
        codeParserHook,
        // Pass contexts
        appContext,
        pageContext,
        // Pass refs
        aiResponseInputRefPassed,
        kworkInputRefPassed,
        // Pass setImageReplaceTask
        setImageReplaceTask,
    });

    // --- Destructure the handlers for use ---
    // (handleRestorationComplete uses toast internally via handlers hook)
    const {
        handleParse, handleAutoFix, handleCopyFixPrompt, handleRestorationComplete,
        handleUpdateParsedFiles, handleClearResponse, handleCopyResponse, handleOpenModal,
        handleSwap, handleSearch, handleSelectFunction, handleToggleFileSelection,
        handleSelectAllFiles, handleDeselectAllFiles, handleSaveFiles, handleDownloadZip,
        handleSendToTelegram, handleAddCustomLink, handleCreateOrUpdatePR,
        handleDirectImageReplace // Make sure this is destructured if used directly
    } = handlers;

    // --- Callback Hooks ---
    // ALL useCallback calls MUST be at the top level, before any returns or conditions
    const setResponseValue = useCallback((value: string) => {
        setResponse(value);
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value;
        // Reset other states as before
        setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); codeParserHook.setRawDescription(''); // Use hook's setter
        setRequestCopied(false); setAiResponseHasContent(value.trim().length > 0);
        logger.log("Response value set manually, resetting parsed state.");
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, codeParserHook, setRequestCopied, setAiResponseHasContent]); // Added codeParserHook dependency

    const updateRepoUrl = useCallback((url: string) => {
        setRepoUrlStateLocal(url);
        if (url && url.includes("github.com")) {
            triggerGetOpenPRs(url);
        }
     }, [triggerGetOpenPRs]);

    const handleResetImageError = useCallback(() => {
         setImageReplaceError(null);
         // Consider if clearing the task is also needed here, or if user should retry fetch
         // setImageReplaceTask(null); // Optional: Uncomment if resetting error should also discard the task
         toastInfo("Состояние ошибки сброшено."); // <<< Use Hook
     }, [setImageReplaceError, toastInfo]); // Added setImageReplaceTask if uncommented

    // --- Refs ---
    // ALL useRef calls MUST be at the top level, before any returns or conditions
    const processingImageReplace = useRef(false);
    const imageReplaceTaskRef = useRef(imageReplaceTask);

    // --- Effects ---
    // ALL useEffect calls MUST be at the top level, before any returns or conditions
    useEffect(() => { setIsMounted(true); }, []);

    // This effect needs componentParsedFiles which is state managed here
    useEffect(() => { setFilesParsed(componentParsedFiles.length > 0); }, [componentParsedFiles, setFilesParsed]);

    useEffect(() => {
        if (isMounted && repoUrlFromContext && !repoUrlStateLocal) { setRepoUrlStateLocal(repoUrlFromContext); }
    }, [isMounted, repoUrlFromContext, repoUrlStateLocal]);

     // This effect manages state resets based on various conditions
    useEffect(() => {
        if (!isMounted) return;
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        // *** FIX: Use the combined check directly here ***
        const currentlyParsing = contextIsParsing ?? hookIsParsing;
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !currentlyParsing) {
            logger.log("[AICodeAssistant Effect] Resetting state (empty response).");
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); setRequestCopied(false);
        } else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !currentlyParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) {
            logger.log("[AICodeAssistant Effect] Resetting validation (response changed).");
            setValidationStatus('idle'); setValidationIssues([]);
        }
    }, [
        isMounted, response, currentAiRequestId, aiActionLoading, imageReplaceTask,
        componentParsedFiles.length,
        // *** FIX: Depend on the original state values instead of the combined local variable ***
        contextIsParsing, hookIsParsing,
        assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed,
        setSelectedAssistantFiles, setValidationStatus, setValidationIssues,
        setHookParsedFiles, setOriginalRepoFiles, setComponentParsedFiles,
        setSelectedFileIds, setPrTitle, setRequestCopied, logger
    ]); // Dependencies updated

    // Fetch custom links effect
    useEffect(() => {
        if (!isMounted || !user) { setCustomLinks([]); return; }
        const loadLinks = async () => {
            try {
                const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                if (!e && d?.metadata?.customLinks) {
                    setCustomLinks(d.metadata.customLinks);
                } else {
                    setCustomLinks([]);
                    if (e && e.code !== 'PGRST116') {
                        logger.error("Error loading custom links (supabase):", e);
                        toastError("Error loading custom links: " + e.message); // <<< Use Hook
                    }
                }
            } catch (e: any) {
                logger.error("Error loading custom links (catch):", e);
                toastError("Error loading custom links: " + e.message); // <<< Use Hook
                setCustomLinks([]);
            }
        };
        loadLinks();
    }, [isMounted, user, toastError]); // Removed supabaseAdmin from deps if it's stable, added toastError

     // Fetch original files effect
    useEffect(() => {
        if (!isMounted || imageReplaceTask) return;
        const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrlForForm) {
            const fetchOrig = async () => {
                setIsFetchingOriginals(true);
                const branch = targetBranchName ?? undefined;
                const branchDisp = targetBranchName ?? 'default';
                toastInfo(`Загрузка оригиналов из ${branchDisp}...`); // <<< Use Hook
                try {
                    const res = await fetchRepoContents(repoUrlForForm, undefined, branch);
                    if (res.success && Array.isArray(res.files)) {
                        const originalFilesData = res.files.map(f => ({ path: f.path, content: f.content }));
                        setOriginalRepoFiles(originalFilesData);
                        toastSuccess("Оригиналы загружены."); // <<< Use Hook
                    } else {
                        toastError("Ошибка загрузки оригиналов: " + (res.error ?? '?')); // <<< Use Hook
                        setOriginalRepoFiles([]);
                    }
                } catch (e: any) {
                    toastError("Крит. ошибка загрузки оригиналов: " + e?.message); // <<< Use Hook
                    logger.error("Fetch originals error:", e);
                    setOriginalRepoFiles([]);
                } finally {
                    setIsFetchingOriginals(false);
                }
            };
            fetchOrig();
        }
    }, [isMounted, validationIssues, originalRepoFiles.length, isFetchingOriginals, repoUrlForForm, targetBranchName, imageReplaceTask, toastInfo, toastSuccess, toastError]); // Added fetchRepoContents, toasts to deps if needed

    // Direct image replace effect - Uses handler hook which uses toasts internally
     useEffect(() => {
        // Check if conditions are met to START the process
        // assistantLoading check here prevents starting a new process if one is running
        const canProcess = imageReplaceTask && fetchStatus === 'success' && allFetchedFiles.length > 0 && allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath) && !assistantLoading && !processingImageReplace.current;

        if (canProcess) {
            logger.log("[Effect] Conditions met. Starting image replace process...");
            processingImageReplace.current = true; // Prevent re-entry within this effect run
            setImageReplaceError(null);

            // Ensure handlers and the specific handler exist before calling
            if (handlers?.handleDirectImageReplace) {
                // Handler now uses useAppToast internally
                handlers.handleDirectImageReplace(imageReplaceTask, allFetchedFiles)
                    .then(() => {
                         // Logic based on task completion is handled within the handler now
                         if (imageReplaceTaskRef.current) { // Check if task is still active after handler resolves
                            if(imageReplaceError) {
                                logger.warn(`[Effect] Replace finished, but with issue: ${imageReplaceError}`);
                            } else {
                                // Task might still be active if PR creation/update within handler failed but didn't throw/reject
                                // This state is less ideal, but the UI should reflect the error via imageReplaceError
                                logger.info("[Effect] Replace process resolved, but task might still be active (check logs/UI error state).");
                            }
                         } else {
                            logger.log("[Effect] Replace process resolved successfully (task was cleared by handler).");
                         }
                    })
                    .catch(err => {
                        // Error logging/toast is likely handled within the handler now
                        const errorMsg = err?.message || "Unknown error during image replace";
                        logger.error("[Effect] handleDirectImageReplace Promise REJECTED:", errorMsg);
                        // Optionally set local error state if handler doesn't cover it thoroughly
                        setImageReplaceError(`Promise rejected: ${errorMsg}`);
                    })
                    .finally(() => {
                        logger.log("[Effect] Image replace process finished (finally block).");
                        processingImageReplace.current = false; // Always reset flag after process completes/errors
                    });
            } else {
                 logger.error("[Effect] handleDirectImageReplace handler is not available!");
                 setImageReplaceError("Internal error: Image replace handler missing.");
                 processingImageReplace.current = false; // Ensure flag is reset
                 toastError("Внутренняя ошибка: Обработчик замены картинки отсутствует."); // Use Hook
            }
        // Handle case where fetch failed while task was active
        } else if (imageReplaceTask && fetchStatus === 'error' && !processingImageReplace.current) {
            logger.warn("[Effect] Image task active, but fetch status is error.");
             setImageReplaceError("Failed to fetch target file.");
        }
        // NOTE: No 'else' block resetting the error here, it should persist until explicitly cleared or a new task starts.

        // --- DEPENDENCY ARRAY UPDATED: assistantLoading REMOVED ---
     }, [
        imageReplaceTask, fetchStatus, allFetchedFiles, /* assistantLoading REMOVED */
        handlers, setImageReplaceError, imageReplaceError, logger, toastError
     ]); // Dependency array updated

     // Effect to update the ref when the imageReplaceTask state changes
     // MUST be at the top level
    useEffect(() => {
        imageReplaceTaskRef.current = imageReplaceTask;
    }, [imageReplaceTask]);

    // --- Imperative Handle ---
    // MUST be at the top level
    useImperativeHandle(ref, () => ({
        handleParse: handlers.handleParse, // Expose handler from hook
        selectAllParsedFiles: handlers.handleSelectAllFiles, // Map to correct handler name
        handleCreatePR: handlers.handleCreateOrUpdatePR, // Map to correct handler name
        setResponseValue, // Use the local useCallback wrapper
        updateRepoUrl, // Use the local useCallback wrapper
        handleDirectImageReplace: handlers.handleDirectImageReplace, // Expose handler from hook
    }), [handlers, setResponseValue, updateRepoUrl]); // Depend on the handlers object and local wrappers

    // --- <<< EARLY RETURN CHECK >>> ---
    // Now all hooks have been called, this check is safe
    if (!isMounted) {
        return (
             <div id="executor-loading" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4 min-h-[400px] items-center justify-center">
                <FaSpinner className="text-cyan-400 text-4xl animate-spin mb-4"/>
                <p className="text-gray-400 text-lg">Загрузка Ассистента...</p>
             </div>
         );
    }

    // --- Derived State for Rendering ---
    // This logic is safe here, after the early return and all hooks
    // *** FIX: Use the combined check directly here ***
    const effectiveIsParsing = contextIsParsing ?? hookIsParsing;
    const isProcessingAny = assistantLoading || aiActionLoading || effectiveIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;

    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedAssistantFiles.size > 0 && !!prTitle.trim() && !!repoUrlForForm && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR";
    const prButtonIconNode = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIconNode = (isProcessingPR || assistantLoading) && !imageReplaceTask ? <FaSpinner className="animate-spin"/> : prButtonIconNode;
    const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const showImageReplaceUI = !!imageReplaceTask || !!imageReplaceError; // Show if task active OR if there's an error from a previous task attempt
    const showStandardAssistantUI = !showImageReplaceUI;
    const imageTaskFailed = !!imageReplaceError && !assistantLoading && !isProcessingPR; // Only show 'failed' state clearly when not actively processing
    // *** FIX: Use isProcessingAny directly where commonDisabled was used ***
    const parseButtonDisabled = isProcessingAny || isWaitingForAiResponse || !response.trim() || !!imageReplaceTask;
    const fixButtonDisabled = isProcessingAny || isWaitingForAiResponse || !!imageReplaceTask;
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || assistantLoading || !!imageReplaceTask; // Disable regular PR submit during image task


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
                 <button id="settings-modal-trigger-assistant" onClick={triggerToggleSettingsModal} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingPR || assistantLoading} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>

            {showStandardAssistantUI && (
                 <>
                     <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm min-h-[18px]"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : isProcessingAny ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y simple-scrollbar" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : isProcessingAny ? "Ожидание..." : "Ответ AI здесь..."} disabled={isProcessingAny} spellCheck="false" />
                              {/* Pass handlers from the hook, use isProcessingAny */}
                              <TextAreaUtilities response={response} isLoading={isProcessingAny} onParse={handlers.handleParse} onOpenModal={handlers.handleOpenModal} onCopy={handlers.handleCopyResponse} onClear={handlers.handleClearResponse} onSelectFunction={handlers.handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={isProcessingPR || assistantLoading} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               {/* Pass handlers from the hook, use isProcessingAny */}
                               {/* handleRestorationComplete uses toast via handlers hook */}
                               <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handlers.handleRestorationComplete} disabled={isProcessingAny || validationStatus === 'validating' || isFetchingOriginals} />
                               {/* handleAutoFix / handleCopyFixPrompt use toast via handlers hook */}
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handlers.handleAutoFix} onCopyPrompt={handlers.handleCopyFixPrompt} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                      {/* Pass handlers from the hook, use isProcessingAny */}
                      {/* handleSaveFiles / handleDownloadZip / handleSendToTelegram use toast via handlers hook */}
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handlers.handleToggleFileSelection} onSelectAll={handlers.handleSelectAllFiles} onDeselectAll={handlers.handleDeselectAllFiles} onSaveFiles={handlers.handleSaveFiles} onDownloadZip={handlers.handleDownloadZip} onSendToTelegram={handlers.handleSendToTelegram} isUserLoggedIn={!!user} isLoading={isProcessingAny} />
                     {/* Pass handlers from the hook */}
                     {/* handleCreateOrUpdatePR uses toast via handlers hook */}
                     <PullRequestForm id="pr-form-container" repoUrl={repoUrlForForm}
                      prTitle={prTitle} selectedFileCount={selectedAssistantFiles.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={updateRepoUrl} onPrTitleChange={setPrTitle} onCreatePR={handlers.handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIconNode} isSubmitDisabled={submitButtonDisabled} />
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Pass handlers from the hook, use isProcessingAny */}
                        {/* handleAddCustomLink uses toast via handlers hook */}
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handlers.handleAddCustomLink} disabled={isProcessingAny}/>
                         <button onClick={() => setIsImageModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={isProcessingAny} title="Загрузить/Связать Картинки (prompts_imgs.txt)" >
                             <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span>
                             {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && ( <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span> )}
                         </button>
                    </div>
                 </>
            )}

            {/* --- Image Replace UI --- */}
            {showImageReplaceUI && (
                <div className={`flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed min-h-[200px] ${imageTaskFailed ? 'border-red-500' : 'border-blue-400'}`}>
                     {/* Status Icon Logic */}
                     {(assistantLoading || isProcessingPR) ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : imageTaskFailed ? <FaCircleXmark className="text-red-400 text-4xl mb-4" />
                       : imageReplaceTask ? <FaImages className="text-blue-400 text-4xl mb-4" /> // Task active, but not failed and not loading = waiting/idle
                       : <FaCheck className="text-green-400 text-4xl mb-4" /> } {/* Task cleared = success */}

                     {/* Status Title Logic */}
                     <p className={`text-lg font-semibold ${imageTaskFailed ? 'text-red-300' : 'text-blue-300'}`}>
                         {(assistantLoading || isProcessingPR) ? "Обработка Замены..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Загрузка Файла..."
                           : imageTaskFailed ? "Ошибка Замены Картинки"
                           : imageReplaceTask ? "Задача Замены Активна"
                           : "Замена Завершена Успешно"}
                     </p>

                     {/* Status Description Logic */}
                     <p className="text-sm text-gray-400 mt-2">
                         {(assistantLoading || isProcessingPR) ? "Создание/обновление PR..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Ожидание ответа от GitHub..."
                           : imageTaskFailed ? (imageReplaceError || "Произошла неизвестная ошибка.") // Show specific error
                           : imageReplaceTask ? "Файл загружен, ожидание обработки Ассистентом..." // Waiting for handler trigger
                           : "Процесс завершен. Проверьте PR."} {/* Success message */}
                     </p>

                     {/* Display Task Details if active */}
                     {imageReplaceTask && (
                         <div className="mt-3 text-xs text-gray-500 break-all text-left bg-gray-900/50 p-2 rounded max-w-full overflow-x-auto simple-scrollbar">
                             <p><span className="font-semibold text-gray-400">Файл:</span> {imageReplaceTask.targetPath}</p>
                             <p><span className="font-semibold text-gray-400">Старый URL:</span> {imageReplaceTask.oldUrl}</p>
                             <p><span className="font-semibold text-gray-400">Новый URL:</span> {imageReplaceTask.newUrl}</p>
                         </div>
                     )}

                     {/* Show Reset Button only on failure */}
                     {imageTaskFailed && (
                          <button
                              onClick={handleResetImageError} // Use the hook that's now defined correctly
                              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition"
                          > Сбросить Ошибку </button>
                      )}
                 </div>
             )}

            {/* --- Modals (Use handlers from the hook) --- */}
            <AnimatePresence>
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