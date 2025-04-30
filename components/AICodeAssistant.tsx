"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback, useRef } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode
} from "@/contexts/RepoXmlPageContext";
// Removed direct action imports if handled solely by context triggers passed to hook
// import { createGitHubPullRequest, updateBranch, fetchRepoContents } from "@/app/actions_github/actions";
// import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
// import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
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
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
    FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate,
    FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines, FaCode,
    FaCheck, FaCircleXmark, FaExclamation
} from "react-icons/fa6";
import clsx from "clsx";
// import { saveAs } from "file-saver"; // Moved to handlers.ts
// import { selectFunctionDefinition, extractFunctionName } from "@/lib/codeUtils"; // Moved to handlers.ts
import { debugLogger as logger } from "@/lib/debugLogger"; // Keep logger if used directly here


// --- Logger Replacement for Toasts (Keep if used directly, otherwise remove) ---
const toastLogger = { /* ... keep if needed ... */ };

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
    const appContext = useAppContext(); // Get full AppContext
    const codeParserHook = useCodeParsingAndValidation(); // Get full Code Parser hook result
    const pageContext = useRepoXmlPageContext(); // Get full Page Context

    // --- Destructure necessary parts from contexts/hooks for passing & direct use ---
    const { user } = appContext;
    const {
        setHookParsedFiles, setValidationStatus, setValidationIssues,
        validationIssues, validationStatus, rawDescription, // Needed directly for UI logic
    } = codeParserHook;
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
        setRequestCopied // Needed for handlers hook
    } = pageContext;

    // --- <<< USE THE NEW HANDLERS HOOK >>> ---
    const handlers = useAICodeAssistantHandlers({
        // Pass all required state and setters
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks, originalRepoFiles, isFetchingOriginals, imageReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR, setOriginalRepoFiles, setIsFetchingOriginals, setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError, setRepoUrlStateLocal, // Pass local URL setter too
        // Pass hook results/setters
        codeParserHook,
        // Pass contexts
        appContext,
        pageContext,
        // Pass refs
        aiResponseInputRefPassed,
        kworkInputRefPassed, // Pass if needed by any handler logic indirectly
    });

    // --- Destructure the handlers for use ---
    const {
        handleParse, handleAutoFix, handleCopyFixPrompt, handleRestorationComplete,
        handleUpdateParsedFiles, handleClearResponse, handleCopyResponse, handleOpenModal,
        handleSwap, handleSearch, handleSelectFunction, handleToggleFileSelection,
        handleSelectAllFiles, handleDeselectAllFiles, handleSaveFiles, handleDownloadZip,
        handleSendToTelegram, handleAddCustomLink, handleCreateOrUpdatePR,
        // Note: setResponseValue and updateRepoUrl are slightly different as they modify state directly
    } = handlers;

    // Handler for setting response value (directly updates state here)
    const setResponseValue = useCallback((value: string) => {
        setResponse(value);
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value;
        // Reset other states as before
        setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); codeParserHook.setRawDescription(''); // Use hook's setter
        setRequestCopied(false); setAiResponseHasContent(value.trim().length > 0);
        logger.log("Response value set manually, resetting parsed state.");
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, codeParserHook.setRawDescription, setRequestCopied, setAiResponseHasContent]); // Added dependency

    // Handler for updating local repo URL state (and triggering PR fetch)
    const updateRepoUrl = useCallback((url: string) => {
        setRepoUrlStateLocal(url);
        if (url && url.includes("github.com")) {
            triggerGetOpenPRs(url);
        }
     }, [triggerGetOpenPRs]);


    // --- Derived State (Keep this logic here) ---
    const isParsing = contextIsParsing ?? codeParserHook.isParsing;
    const repoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Refs (Keep refs managed here if not passed down) ---
    const processingImageReplace = useRef(false);
    const imageReplaceTaskRef = useRef(imageReplaceTask);
    useEffect(() => { imageReplaceTaskRef.current = imageReplaceTask; }, [imageReplaceTask]);


    // --- Effects (Keep effects managed by this component) ---
    useEffect(() => { setIsMounted(true); }, []);
    // This effect needs componentParsedFiles which is state managed here
    useEffect(() => { setFilesParsed(componentParsedFiles.length > 0); }, [componentParsedFiles, setFilesParsed]);
    useEffect(() => {
        if (isMounted && repoUrlFromContext && !repoUrlStateLocal) { setRepoUrlStateLocal(repoUrlFromContext); }
    }, [isMounted, repoUrlFromContext, repoUrlStateLocal]);
     // This effect manages state resets based on various conditions
    useEffect(() => {
        if (!isMounted) return; const hasContent = response.trim().length > 0; setAiResponseHasContent(hasContent);
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !isParsing) { logger.log("[AICodeAssistant Effect] Resetting state (empty response)."); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); setRequestCopied(false); }
        else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) { logger.log("[AICodeAssistant Effect] Resetting validation (response changed)."); setValidationStatus('idle'); setValidationIssues([]); }
    }, [ isMounted, response, currentAiRequestId, aiActionLoading, imageReplaceTask, componentParsedFiles.length, isParsing, assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setHookParsedFiles, setOriginalRepoFiles, setComponentParsedFiles, setSelectedFileIds, setPrTitle, setRequestCopied, logger ]); // Ensure all setters used are dependencies

    // Fetch custom links effect
    useEffect(() => {
        if (!isMounted || !user) { setCustomLinks([]); return; }
        const loadLinks = async () => { try { const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!e && d?.metadata?.customLinks) { setCustomLinks(d.metadata.customLinks); } else { setCustomLinks([]); if (e && e.code !== 'PGRST116') { toastLogger.error("Error loading custom links (supabase):", e); } } } catch (e) { toastLogger.error("Error loading custom links (catch):", e); setCustomLinks([]); } }; loadLinks();
    }, [isMounted, user]);

     // Fetch original files effect
    useEffect(() => {
        if (!isMounted || imageReplaceTask) return; const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrlForForm) {
            const fetchOrig = async () => { setIsFetchingOriginals(true); const branch = targetBranchName ?? undefined; const branchDisp = targetBranchName ?? 'default'; toast.info(`Загрузка оригиналов из ${branchDisp}...`); try { const res = await fetchRepoContents(repoUrlForForm, undefined, branch); if (res.success && Array.isArray(res.files)) { const originalFilesData = res.files.map(f => ({ path: f.path, content: f.content })); setOriginalRepoFiles(originalFilesData); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (res.error ?? '?')); setOriginalRepoFiles([]); } } catch (e) { toast.error("Крит. ошибка загрузки оригиналов."); toastLogger.error("Fetch originals error:", e); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOrig();
        }
    }, [isMounted, validationIssues, originalRepoFiles.length, isFetchingOriginals, repoUrlForForm, targetBranchName, imageReplaceTask]);

    // Direct image replace effect remains here as it uses local state/refs
     useEffect(() => {
        if (imageReplaceTask) {
             toastLogger.effectCheck({ /* ... */ });
        }
        const canProcess = imageReplaceTask && fetchStatus === 'success' && allFetchedFiles.length > 0 && allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath) && !assistantLoading && !processingImageReplace.current;

        if (canProcess) {
            logger.log("[Effect] Conditions met. Starting image replace process...");
            processingImageReplace.current = true;
            setImageReplaceError(null);
            // Call the handler obtained from the hook
            handlers.handleDirectImageReplace(imageReplaceTask, allFetchedFiles)
                .then(() => {
                     if (imageReplaceTaskRef.current) {
                        if(imageReplaceError) { logger.warn(`[Effect] Replace finished, but with issue: ${imageReplaceError}`); }
                        else { logger.info("[Effect] Replace process resolved, but task still active? (Check logic)"); }
                     } else { logger.log("[Effect] Replace process resolved successfully."); }
                })
                .catch(err => {
                    const errorMsg = err?.message || "Unknown error";
                    toastLogger.error("[Effect] handleDirectImageReplace Promise REJECTED:", errorMsg);
                    setImageReplaceError(`Promise rejected: ${errorMsg}`);
                })
                .finally(() => {
                    logger.log("[Effect] Process finished (finally block).");
                    processingImageReplace.current = false;
                });
        } else if (imageReplaceTask && fetchStatus === 'error') {
            logger.warn("[Effect] Image task active, but fetch status is error.");
             setImageReplaceError("Failed to fetch target file.");
        }
     }, [ imageReplaceTask, fetchStatus, allFetchedFiles, assistantLoading, handlers.handleDirectImageReplace, setImageReplaceError, imageReplaceError, logger ]); // Use handler from hook


    // --- Imperative Handle (Expose handlers from the hook) ---
    useImperativeHandle(ref, () => ({
        handleParse: handlers.handleParse, // Expose handler from hook
        selectAllParsedFiles: handlers.handleSelectAllFiles, // Map to correct handler name
        handleCreatePR: handlers.handleCreateOrUpdatePR, // Map to correct handler name
        setResponseValue, // Use the local useCallback wrapper
        updateRepoUrl, // Use the local useCallback wrapper
        handleDirectImageReplace: handlers.handleDirectImageReplace, // Expose handler from hook
    }), [handlers, setResponseValue, updateRepoUrl]); // Depend on the handlers object and local wrappers


    // --- RENDER (Use handlers obtained from the hook) ---
    if (!isMounted) { return ( <div id="executor-loading" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4 min-h-[400px] items-center justify-center"> <FaSpinner className="text-cyan-400 text-4xl animate-spin mb-4"/> <p className="text-gray-400 text-lg">Загрузка Ассистента...</p> </div> ); }

    const isProcessingAny = assistantLoading || aiActionLoading || isParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedAssistantFiles.size > 0 && !!prTitle.trim() && !!repoUrlForForm && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR";
    const prButtonIconNode = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIconNode = (isProcessingPR || assistantLoading) && !imageReplaceTask ? <FaSpinner className="animate-spin"/> : prButtonIconNode;
    const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const showImageReplaceUI = !!imageReplaceTask || !!imageReplaceError;
    const showStandardAssistantUI = !showImageReplaceUI;
    const imageTaskFailed = !!imageReplaceError && !assistantLoading && !isProcessingPR;
    const commonDisabled = isProcessingAny;
    const parseButtonDisabled = commonDisabled || isWaitingForAiResponse || !response.trim() || !!imageReplaceTask;
    const fixButtonDisabled = commonDisabled || isWaitingForAiResponse || !!imageReplaceTask;
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || assistantLoading;

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
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm min-h-[18px]"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : commonDisabled ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y simple-scrollbar" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : commonDisabled ? "Ожидание..." : "Ответ AI здесь..."} disabled={commonDisabled} spellCheck="false" />
                              {/* Pass handlers from the hook */}
                              <TextAreaUtilities response={response} isLoading={commonDisabled} onParse={handleParse} onOpenModal={handleOpenModal} onCopy={handleCopyResponse} onClear={handleClearResponse} onSelectFunction={handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={isProcessingPR || assistantLoading} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               {/* Pass handlers from the hook */}
                               <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handleRestorationComplete} disabled={commonDisabled || validationStatus === 'validating' || isFetchingOriginals} />
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handleAutoFix} onCopyPrompt={handleCopyFixPrompt} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                      {/* Pass handlers from the hook */}
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handleToggleFileSelection} onSelectAll={handleSelectAllFiles} onDeselectAll={handleDeselectAllFiles} onSaveFiles={handleSaveFiles} onDownloadZip={handleDownloadZip} onSendToTelegram={handleSendToTelegram} isUserLoggedIn={!!user} isLoading={commonDisabled} />
                     {/* Pass handlers from the hook */}
                     <PullRequestForm id="pr-form-container" repoUrl={repoUrlForForm}
                      prTitle={prTitle} selectedFileCount={selectedAssistantFiles.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={updateRepoUrl} onPrTitleChange={setPrTitle} onCreatePR={handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIconNode} isSubmitDisabled={submitButtonDisabled} />
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Pass handlers from the hook */}
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} disabled={commonDisabled}/>
                         <button onClick={() => setIsImageModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={commonDisabled} title="Загрузить/Связать Картинки (prompts_imgs.txt)" >
                             <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span>
                             {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && ( <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span> )}
                         </button>
                    </div>
                 </>
            )}

            {/* --- Image Replace UI (No changes here) --- */}
            {showImageReplaceUI && (
                <div className={`flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed min-h-[200px] ${imageTaskFailed ? 'border-red-500' : 'border-blue-400'}`}>
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
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Ожидание..."
                           : imageTaskFailed ? (imageReplaceError || "Произошла ошибка.")
                           : imageReplaceTask ? "Файл загружен, ожидание обработки..."
                           : "Процесс завершен."}
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
                              onClick={() => { setImageReplaceError(null); toast.info("Состояние ошибки сброшено."); }}
                              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition"
                          > Сбросить Ошибку </button>
                      )}
                 </div>
             )}

            {/* --- Modals (Use handlers from the hook) --- */}
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