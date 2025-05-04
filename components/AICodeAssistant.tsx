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
// REMOVED CodeRestorer import
// import { CodeRestorer } from './assistant_components/CodeRestorer';
// UI & Utils
import { AnimatePresence, motion } from "framer-motion";
import {
    FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate,
    FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines, FaCode,
    FaCheck, FaCircleXmark, FaExclamation
} from "react-icons/fa6";
import clsx from "clsx";
import { debugLogger as logger } from "@/lib/debugLogger"; // Use the logger
// .. Removed fetchRepoContents if not used elsewhere

// Interfaces (Keep if needed)
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {
     kworkInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
     aiResponseInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
}
// REMOVED OriginalFile interface
// interface OriginalFile { path: string; content: string; }

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
    const [isProcessingPR, setIsProcessingPR] = useState(false); // State for internal PR button press
    // REMOVED originalRepoFiles and isFetchingOriginals state
    // const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
    // const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);
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
        setAssistantLoading, assistantLoading, // Context loading state for image swap etc.
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
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks,
        // REMOVED originalRepoFiles, isFetchingOriginals from props
        imageReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR,
        // REMOVED setOriginalRepoFiles, setIsFetchingOriginals from props
        setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError, setRepoUrlStateLocal,
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
        handleParse, handleAutoFix,
        // REMOVED handleCopyFixPrompt, handleRestorationComplete from handlers
        handleUpdateParsedFiles, handleClearResponse, handleCopyResponse, handleOpenModal,
        handleSwap, handleSearch, handleSelectFunction, handleToggleFileSelection,
        handleSelectAllFiles, handleDeselectAllFiles, handleSaveFiles, handleDownloadZip,
        handleSendToTelegram, handleAddCustomLink, handleCreateOrUpdatePR,
        handleDirectImageReplace // Still need this for the imperative handle
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
        // REMOVED setOriginalRepoFiles([]) call
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
         setImageReplaceTask(null); // Also clear the task
         toastInfo("Состояние ошибки сброшено.");
     }, [setImageReplaceError, setImageReplaceTask, toastInfo]);
    logger.debug("[AICodeAssistant] After useCallback");


    // --- Refs ---
    logger.debug("[AICodeAssistant] Before useRef");
    // const processingImageReplace = useRef(false); // Handled by assistantLoading now
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
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]);
            // REMOVED setOriginalRepoFiles([]);
            setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); setRequestCopied(false);
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
        setHookParsedFiles, /* REMOVED setOriginalRepoFiles, */ setComponentParsedFiles,
        setSelectedFileIds, setPrTitle, setRequestCopied
    ]);

    // --- Restored Custom Links useEffect ---
    useEffect(() => {
        logger.debug("[Effect Custom Links] START - Loading custom links.");
        const loadLinks = async () => {
            // Check if user object exists and has an id property
            if (!user?.id) {
                logger.debug("[Effect Custom Links] SKIP: no user or user.id is missing.");
                setCustomLinks([]); // Reset links if user logs out or is invalid
                return;
            }

            try {
                logger.debug(`[Effect Custom Links] Fetching metadata for user: ${user.id}`);

                // Fetch metadata for the specific user
                const { data: userData, error: fetchError } = await supabaseAdmin
                    .from("users") // Make sure 'users' is your correct table name
                    .select("metadata") // Select only the metadata column
                    .eq("user_id", user.id) // Ensure 'user_id' is the correct column name matching your user object's id
                    .single(); // Expecting only one record for the user

                // Handle potential fetch errors
                if (fetchError) {
                    logger.error("[Effect Custom Links] Error fetching user metadata:", fetchError);
                    // Display error to the user (optional, but recommended)
                    toastError(`Ошибка загрузки ваших ссылок: ${fetchError.message}`);
                    setCustomLinks([]); // Reset on error
                    return; // Exit early on error
                }

                // Check if data exists and has the customLinks property within metadata
                if (userData?.metadata?.customLinks && Array.isArray(userData.metadata.customLinks)) {
                    logger.debug("[Effect Custom Links] Found custom links in metadata:", userData.metadata.customLinks);
                    setCustomLinks(userData.metadata.customLinks); // Set the links from metadata
                } else {
                    logger.debug("[Effect Custom Links] No custom links found in metadata or metadata is null/malformed.");
                    setCustomLinks([]); // Reset if no links are found or data is malformed
                }

            } catch (e: any) { // Catch any unexpected errors during the async operation
                logger.error("[Effect Custom Links] Exception during fetch:", e);
                // Display a generic error to the user
                toastError(`Критическая ошибка при загрузке ссылок: ${e.message ?? 'Неизвестно'}`);
                setCustomLinks([]); // Reset on critical error
            }
        };

        loadLinks(); // Execute the async function
        logger.debug("[Effect Custom Links] END - loadLinks called.");

    // Dependencies: Re-run this effect if the user object changes,
    // or if the functions used inside (setCustomLinks, toastError, logger) change instance.
    }, [user, setCustomLinks, toastError, logger]); // Added missing dependencies for stability & linting
    // --- End Restored Custom Links useEffect ---



    // --- Image Replace Logic (Simpler check) ---
    useEffect(() => {
        logger.debug("[Effect Image Replace] START Check");
        const currentTask = imageReplaceTask;
        const currentFetchStatus = fetchStatus; // Read directly from context
        const canProcess = currentTask && currentFetchStatus === 'success';
        logger.debug(`[Effect Image Replace] Check: canProcess=${canProcess}, task=${!!currentTask}, fetchStatus=${currentFetchStatus}, assistantLoading=${assistantLoading}`);

        if (canProcess && !assistantLoading) {
             logger.info(`[Effect Image Replace] Task Ready: ${currentTask.targetPath}. Calling handler.`);
             // No need to check allFetchedFiles here, assumed handleSetFilesFetched did that
              handleDirectImageReplace(currentTask, allFetchedFiles)
                 .then(({ success, error }) => {
                     if (success) {
                          logger.info("[Effect Image Replace] handleDirectImageReplace reported SUCCESS.");
                          //setImageReplaceTask(null); // Clear the task on successful completion
                     } else {
                          logger.error("[Effect Image Replace] handleDirectImageReplace reported FAILURE:", error);
                         setImageReplaceError(error || "Ошибка при замене изображения и создании PR.");
                         setImageReplaceTask(null); // Clear task on failure
                     }
                 })
                 .catch(err => {
                      logger.error("[Effect Image Replace] handleDirectImageReplace CRITICAL FAILURE:", err);
                      setImageReplaceError(`Критическая ошибка замены: ${err?.message ?? 'Неизвестно'}`);
                      setImageReplaceTask(null); // Clear task on critical failure
                 });
        } else if (currentTask && fetchStatus === 'error' && !assistantLoading) {
             logger.error(`[Effect Image Replace] Fetch error occurred for task: ${currentTask.targetPath}`);
             setImageReplaceError(`Ошибка загрузки файла ${currentTask.targetPath}. Попробуйте снова.`);
             setImageReplaceTask(null); // Clear the task if fetch failed
        } else {
            logger.debug("[Effect Image Replace] Conditions not met or already processing.");
        }
        logger.debug("[Effect Image Replace] END Check");
     }, [
        imageReplaceTask, fetchStatus, allFetchedFiles, assistantLoading, // Listen to state changes
        handleDirectImageReplace, setImageReplaceError, setImageReplaceTask, // Stable dependencies/callbacks
        logger // Logger
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
        // Keep direct image replace for context interaction
        handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => {
            logger.debug(`[Imperative] handleDirectImageReplace called from context.`);
            return handlers.handleDirectImageReplace(task, files);
        },
    }), [handlers, setResponseValue, updateRepoUrl]);
    logger.debug("[AICodeAssistant] After useImperativeHandle");


    // --- Derived State for Rendering ---
    logger.debug("[AICodeAssistant] Calculate Derived State");
    const effectiveIsParsing = contextIsParsing ?? hookIsParsing;
    // Combined loading state: assistantLoading (for image replace/PR), internal PR processing, AI generating, parsing, PR list loading
    const isProcessingAny = assistantLoading || isProcessingPR || aiActionLoading || effectiveIsParsing || loadingPrs;
    const finalRepoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedAssistantFiles.size > 0 && !!prTitle.trim() && !!finalRepoUrlForForm && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR";
    const prButtonIconNode = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIconNode = (isProcessingPR || assistantLoading) && !imageReplaceTask ? <FaSpinner className="animate-spin"/> : prButtonIconNode;
    const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const showImageReplaceUI = !!imageReplaceTask || !!imageReplaceError;
    const showStandardAssistantUI = !showImageReplaceUI;
    // Image task is considered "failed" if there's an error *and* it's not currently trying to process (assistantLoading)
    const imageTaskFailed = !!imageReplaceError && !assistantLoading;
    const parseButtonDisabled = isProcessingAny || isWaitingForAiResponse || !response.trim() || !!imageReplaceTask;
    // .. fixButtonDisabled remains, but CodeRestorer is removed
    const fixButtonDisabled = isProcessingAny || isWaitingForAiResponse || !!imageReplaceTask;
    // Submit PR button disabled if processing, no files selected, or if image task is active
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingAny || !!imageReplaceTask;
    logger.debug(`[Render State] isProcessingAny=${isProcessingAny}, effectiveIsParsing=${effectiveIsParsing}, filesParsed=${filesParsed}, selectedAssistantFiles=${selectedAssistantFiles.size}, canSubmitRegularPR=${canSubmitRegularPR}, showImageReplaceUI=${showImageReplaceUI}, assistantLoading=${assistantLoading}`);

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
                 <button id="settings-modal-trigger-assistant" onClick={() => { logger.debug("[Click] Settings Toggle Click (Assistant)"); triggerToggleSettingsModal(); }} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingAny} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>

            {showStandardAssistantUI && (
                 <>
                     <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm min-h-[18px]"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : isProcessingAny ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              {/* .. Textarea unchanged .. */}
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y simple-scrollbar" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : isProcessingAny ? "Ожидание..." : "Ответ AI здесь..."} disabled={isProcessingAny} spellCheck="false" />
                              {/* .. TextAreaUtilities unchanged .. */}
                              <TextAreaUtilities response={response} isLoading={isProcessingAny} onParse={handlers.handleParse} onOpenModal={handlers.handleOpenModal} onCopy={handlers.handleCopyResponse} onClear={handlers.handleClearResponse} onSelectFunction={handlers.handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={assistantLoading || isProcessingPR} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               {/* REMOVED CodeRestorer */}
                               {/* <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handlers.handleRestorationComplete} disabled={isProcessingAny || validationStatus === 'validating' || isFetchingOriginals} /> */}
                               {/* ValidationStatusIndicator (no CodeRestorer dep) */}
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handlers.handleAutoFix} onCopyPrompt={() => {}} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                     {/* .. ParsedFilesList unchanged .. */}
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handlers.handleToggleFileSelection} onSelectAll={handlers.handleSelectAllFiles} onDeselectAll={handlers.handleDeselectAllFiles} onSaveFiles={handlers.handleSaveFiles} onDownloadZip={handlers.handleDownloadZip} onSendToTelegram={handlers.handleSendToTelegram} isUserLoggedIn={!!user} isLoading={isProcessingAny} />
                     {/* .. PullRequestForm unchanged .. */}
                     <PullRequestForm id="pr-form-container" repoUrl={finalRepoUrlForForm}
                      prTitle={prTitle} selectedFileCount={selectedAssistantFiles.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={updateRepoUrl} onPrTitleChange={setPrTitle} onCreatePR={handlers.handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIconNode} isSubmitDisabled={submitButtonDisabled} />
                     {/* .. OpenPrList unchanged .. */}
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* .. ToolsMenu unchanged .. */}
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handlers.handleAddCustomLink} disabled={isProcessingAny}/>
                        {/* .. Image Button unchanged .. */}
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
                    {(() => { logger.debug("[Render] Rendering Image Replace UI", { imageReplaceTask: !!imageReplaceTask, assistantLoading, fetchStatus, imageTaskFailed, imageReplaceError }); return null; })()}
                     {/* Status Icon Logic */}
                     {assistantLoading ? <FaSpinner className="text-purple-400 text-4xl mb-4 animate-spin" />
                       : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" />
                       : imageTaskFailed ? <FaCircleXmark className="text-red-400 text-4xl mb-4" />
                       : imageReplaceTask ? <FaImages className="text-blue-400 text-4xl mb-4" />
                       : <FaCheck className="text-green-400 text-4xl mb-4" /> // Default/Success case if task is cleared
                     }

                     <p className={`text-lg font-semibold ${imageTaskFailed ? 'text-red-300' : 'text-blue-300'}`}>
                         {/* ... Text based on state ... */}
                         {assistantLoading ? "Обработка Замены..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Загрузка Файла..."
                           : imageTaskFailed ? "Ошибка Замены Картинки"
                           : imageReplaceTask ? "Задача Замены Активна"
                           : "Процесс Замены Завершен"} {/* Adjusted success message */}
                     </p>
                     <p className="text-sm text-gray-400 mt-2">
                          {/* ... Text based on state ... */}
                          {assistantLoading ? "Меняю URL в файле и создаю/обновляю PR..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Ожидание ответа от GitHub..."
                           : imageTaskFailed ? (imageReplaceError || "Произошла неизвестная ошибка.")
                           : imageReplaceTask ? "Файл загружен, ожидание обработки Ассистентом..."
                           : "Задача выполнена или сброшена."} {/* Adjusted success message */}
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

            {/* --- Modals (Unchanged) --- */}
            <AnimatePresence>
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