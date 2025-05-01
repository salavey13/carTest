"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback, useRef } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode
} from "@/contexts/RepoXmlPageContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
import { useAppToast } from '@/hooks/useAppToast';
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
import { debugLogger as logger } from "@/lib/debugLogger";
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

    // --- VIBE CHECK: Get toast function early ---
    // Moved context retrieval after isMounted check

    // --- Props ---
    const { kworkInputRefPassed, aiResponseInputRefPassed } = props;

    // --- State (isMounted FIRST!) ---
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        // Keep toast inside useEffect as it runs after initial render
        // but get addToast later
        const { addToast } = useRepoXmlPageContext.getState ? useRepoXmlPageContext.getState() : { addToast: () => {} }; // Temporary access if context is not yet ready? Better to get context AFTER mount check.
        addToast("[DEBUG] AICodeAssistant Mounted Effect", 'info', 1000);
        setIsMounted(true);
    }, []); // Empty dependency array

    // === EARLY RETURN CHECK - MOVED TO TOP ===
    if (!isMounted) {
        // const { addToast } = useRepoXmlPageContext(); // Cannot call hook here conditionally
        // addToast("[DEBUG] AICodeAssistant Render: Early return (!isMounted)", 'info', 1000); // Cannot toast here easily
        return (
             <div id="executor-loading" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4 min-h-[400px] items-center justify-center">
                <FaSpinner className="text-cyan-400 text-4xl animate-spin mb-4"/>
                <p className="text-gray-400 text-lg">Загрузка Ассистента...</p>
             </div>
         );
    }
    // === END EARLY RETURN CHECK ===

    // --- Now call hooks as we are mounted ---
    const pageContextForToast = useRepoXmlPageContext(); // Get context now
    const { addToast: addToastDirect } = pageContextForToast; // Get toast function
    addToastDirect("[DEBUG] AICodeAssistant Function Start (Post Mount)", 'info', 1000);

    // --- Other State ---
    addToastDirect("[DEBUG] Before AICodeAssistant useState (Post Mount)", 'info', 1000);
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
    addToastDirect("[DEBUG] After AICodeAssistant useState (Post Mount)", 'info', 1000);

    // --- Hooks ---
    addToastDirect("[DEBUG] Before AICodeAssistant Hooks (Post Mount)", 'info', 1000);
    const appContext = useAppContext();
    addToastDirect("[DEBUG] Before useCodeParsingAndValidation Hook (Post Mount)", 'info', 1000);
    const codeParserHook = useCodeParsingAndValidation();
    addToastDirect("[DEBUG] After useCodeParsingAndValidation Hook (Post Mount)", 'info', 1000);
    const pageContext = pageContextForToast; // Use the one already retrieved
    addToastDirect("[DEBUG] Before useAppToast Hook (Post Mount)", 'info', 1000);
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useAppToast();
    addToastDirect("[DEBUG] After Standard Hooks (Post Mount)", 'info', 1000);

    // --- Destructure necessary parts from contexts/hooks ---
    addToastDirect("[DEBUG] Before AICodeAssistant Destructuring (Post Mount)", 'info', 1000);
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
        addToast // Use context toast already destructured
    } = pageContext;
    addToastDirect("[DEBUG] After AICodeAssistant Destructuring (Post Mount)", 'info', 1000);

    // --- USE THE NEW HANDLERS HOOK ---
    addToastDirect("[DEBUG] Before useAICodeAssistantHandlers Hook (Post Mount)", 'info', 1000);
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
    addToastDirect("[DEBUG] After useAICodeAssistantHandlers Hook (Post Mount)", 'info', 1000);

    // --- Destructure the handlers ---
    const {
        handleParse, handleAutoFix, handleCopyFixPrompt, handleRestorationComplete,
        handleUpdateParsedFiles, handleClearResponse, handleCopyResponse, handleOpenModal,
        handleSwap, handleSearch, handleSelectFunction, handleToggleFileSelection,
        handleSelectAllFiles, handleDeselectAllFiles, handleSaveFiles, handleDownloadZip,
        handleSendToTelegram, handleAddCustomLink, handleCreateOrUpdatePR,
        handleDirectImageReplace
    } = handlers;

    // --- Callback Hooks ---
    addToastDirect("[DEBUG] Before AICodeAssistant useCallback (Post Mount)", 'info', 1000);
    const setResponseValue = useCallback((value: string) => {
        addToastDirect(`[DEBUG] setResponseValue called. Type: ${typeof setResponse}`, 'info', 500);
        setResponse(value);
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value;
        setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); codeParserHook.setRawDescription('');
        setRequestCopied(false); setAiResponseHasContent(value.trim().length > 0);
        logger.log("Response value set manually, resetting parsed state.");
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, codeParserHook, setRequestCopied, setAiResponseHasContent, addToastDirect]);

    const updateRepoUrl = useCallback((url: string) => {
        addToastDirect(`[DEBUG] updateRepoUrl called. Type: ${typeof setRepoUrlStateLocal}. URL: ${url}`, 'info', 500);
        setRepoUrlStateLocal(url);
        if (url && url.includes("github.com")) {
            addToastDirect(`[DEBUG] updateRepoUrl triggering PRs. Type: ${typeof triggerGetOpenPRs}`, 'info', 500);
            triggerGetOpenPRs(url);
        }
     }, [triggerGetOpenPRs, addToastDirect]);

    const handleResetImageError = useCallback(() => {
         addToastDirect(`[DEBUG] handleResetImageError called. Type: ${typeof setImageReplaceError}`, 'info', 500);
         setImageReplaceError(null);
         toastInfo("Состояние ошибки сброшено.");
     }, [setImageReplaceError, toastInfo, addToastDirect]);
    addToastDirect("[DEBUG] After AICodeAssistant useCallback (Post Mount)", 'info', 1000);


    // --- Refs ---
    addToastDirect("[DEBUG] Before AICodeAssistant useRef (Post Mount)", 'info', 1000);
    const processingImageReplace = useRef(false);
    const imageReplaceTaskRef = useRef(imageReplaceTask);
    addToastDirect("[DEBUG] After AICodeAssistant useRef (Post Mount)", 'info', 1000);

    // --- DERIVED STATE NEEDED BY HOOKS ---
    addToastDirect("[DEBUG] AICodeAssistant Defining derivedRepoUrlForHooks (Post Mount)", 'info', 1000);
    const derivedRepoUrlForHooks = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Other Effects (Now run only when mounted) ---
    addToastDirect("[DEBUG] Before AICodeAssistant useEffects (Post Mount)", 'info', 1000);

    useEffect(() => { addToastDirect(`[DEBUG] Files Parsed Effect: ${componentParsedFiles.length > 0}`, 'info', 500); setFilesParsed(componentParsedFiles.length > 0); }, [componentParsedFiles, setFilesParsed, addToastDirect]);

    useEffect(() => { addToastDirect(`[DEBUG] URL Sync Effect: ${repoUrlFromContext}`, 'info', 500); if (repoUrlFromContext && !repoUrlStateLocal) { setRepoUrlStateLocal(repoUrlFromContext); } }, [repoUrlFromContext, repoUrlStateLocal, addToastDirect]); // Removed isMounted check

    useEffect(() => {
        addToastDirect("[DEBUG] AICodeAssistant State Reset Effect Check", 'info', 1000);
        // Removed isMounted check
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        const currentlyParsing = contextIsParsing ?? hookIsParsing;
        addToastDirect(`[DEBUG] State Reset Check: hasContent=${hasContent}, noReq=${!currentAiRequestId}, noAIAct=${!aiActionLoading}, noTask=${!imageReplaceTask}, noAssistLoad=${!assistantLoading}, noProcPR=${!isProcessingPR}, notParsing=${!currentlyParsing}`, 'info', 1000);
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !currentlyParsing) {
            addToastDirect("[DEBUG] Resetting state (empty response).", 'info', 1000);
            logger.log("[AICodeAssistant Effect] Resetting state (empty response).");
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); setRequestCopied(false);
        } else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !currentlyParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) {
            addToastDirect("[DEBUG] Resetting validation (response changed).", 'info', 1000);
            logger.log("[AICodeAssistant Effect] Resetting validation (response changed).");
            setValidationStatus('idle'); setValidationIssues([]);
        }
    }, [
        response, currentAiRequestId, aiActionLoading, imageReplaceTask,
        componentParsedFiles.length, contextIsParsing, hookIsParsing,
        assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed,
        setSelectedAssistantFiles, setValidationStatus, setValidationIssues,
        setHookParsedFiles, setOriginalRepoFiles, setComponentParsedFiles,
        setSelectedFileIds, setPrTitle, setRequestCopied, logger, addToastDirect
    ]);

    useEffect(() => {
        addToastDirect("[DEBUG] Custom Links Effect Check", 'info', 1000);
        if (!user) { addToastDirect("[DEBUG] Custom Links SKIP: no user", 'info', 1000); setCustomLinks([]); return; } // Removed isMounted check
        const loadLinks = async () => {
            addToastDirect("[DEBUG] loadLinks START", 'info', 1000);
            try {
                addToastDirect(`[DEBUG] Before supabaseAdmin.from.select. Type: ${typeof supabaseAdmin?.from}`, 'info', 1000);
                const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                addToastDirect(`[DEBUG] After supabaseAdmin select. Error: ${!!e}, Data: ${!!d}`, 'info', 1000);
                if (!e && d?.metadata?.customLinks) {
                    setCustomLinks(d.metadata.customLinks);
                } else {
                    setCustomLinks([]);
                    if (e && e.code !== 'PGRST116') {
                        logger.error("Error loading custom links (supabase):", e);
                        addToastDirect(`[DEBUG] Error loading links: ${e.message}`, 'error', 3000);
                        toastError("Error loading custom links: " + e.message);
                    }
                }
            } catch (e: any) {
                logger.error("Error loading custom links (catch):", e);
                addToastDirect(`[DEBUG] CATCH Error loading links: ${e.message}`, 'error', 3000);
                toastError("Error loading custom links: " + e.message);
                setCustomLinks([]);
            }
            addToastDirect("[DEBUG] loadLinks FINISH", 'info', 1000);
        };
        loadLinks();
    }, [user, toastError, addToastDirect]);

    useEffect(() => {
        addToastDirect("[DEBUG] Fetch Originals Effect Check", 'info', 1000);
        if (imageReplaceTask) { addToastDirect("[DEBUG] Fetch Originals SKIP: image task active", 'info', 1000); return; } // Removed isMounted check
        const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        addToastDirect(`[DEBUG] Fetch Originals Check: skipped=${skipped.length}, noOriginals=${originalRepoFiles.length === 0}, notFetching=${!isFetchingOriginals}, hasUrl=${!!derivedRepoUrlForHooks}`, 'info', 1000);
        if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && derivedRepoUrlForHooks) {
            const fetchOrig = async () => {
                addToastDirect("[DEBUG] fetchOrig START", 'info', 1000);
                setIsFetchingOriginals(true);
                const branch = targetBranchName ?? undefined;
                const branchDisp = targetBranchName ?? 'default';
                toastInfo(`Загрузка оригиналов из ${branchDisp}...`);
                try {
                    addToastDirect(`[DEBUG] Before fetchRepoContents (Originals). Type: ${typeof fetchRepoContents}`, 'info', 1000);
                    const res = await fetchRepoContents(derivedRepoUrlForHooks, undefined, branch);
                    addToastDirect(`[DEBUG] After fetchRepoContents (Originals). Success: ${res.success}`, 'info', 1000);
                    if (res.success && Array.isArray(res.files)) {
                        const originalFilesData = res.files.map(f => ({ path: f.path, content: f.content }));
                        setOriginalRepoFiles(originalFilesData);
                        toastSuccess("Оригиналы загружены.");
                    } else {
                        toastError("Ошибка загрузки оригиналов: " + (res.error ?? '?'));
                        setOriginalRepoFiles([]);
                    }
                } catch (e: any) {
                    toastError("Крит. ошибка загрузки оригиналов: " + e?.message);
                    logger.error("Fetch originals error:", e);
                    addToastDirect(`[DEBUG] CATCH Error fetching originals: ${e.message}`, 'error', 3000);
                    setOriginalRepoFiles([]);
                } finally {
                    setIsFetchingOriginals(false);
                    addToastDirect("[DEBUG] fetchOrig FINISH", 'info', 1000);
                }
            };
            fetchOrig();
        }
    }, [validationIssues, originalRepoFiles.length, isFetchingOriginals, derivedRepoUrlForHooks, targetBranchName, imageReplaceTask, toastInfo, toastSuccess, toastError, addToastDirect]);

    useEffect(() => {
        addToastDirect("[DEBUG] Image Replace Effect Check", 'info', 1000);
        const canProcess = imageReplaceTask && fetchStatus === 'success' && allFetchedFiles.length > 0 && allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath) && !assistantLoading && !processingImageReplace.current;
        addToastDirect(`[DEBUG] Image Replace Check: canProcess=${canProcess}, task=${!!imageReplaceTask}, fetchStatus=${fetchStatus}, fetchFailed=${fetchStatus === 'error'}`, 'info', 1000);

        if (canProcess) {
            addToastDirect("[DEBUG] Image Replace Conditions MET. Starting...", 'info', 1000);
            logger.log("[Effect] Conditions met. Starting image replace process...");
            processingImageReplace.current = true;
            setImageReplaceError(null);

            addToastDirect(`[DEBUG] Checking handlers.handleDirectImageReplace. Type: ${typeof handlers?.handleDirectImageReplace}`, 'info', 1000);
            if (handlers?.handleDirectImageReplace) {
                addToastDirect("[DEBUG] Calling handlers.handleDirectImageReplace", 'info', 1000);
                handlers.handleDirectImageReplace(imageReplaceTask, allFetchedFiles)
                    .then(() => {
                         addToastDirect("[DEBUG] Image Replace .then()", 'info', 1000);
                         if (imageReplaceTaskRef.current) {
                            addToastDirect("[DEBUG] Image Replace .then() - Task still active?", 'warning', 1000);
                         } else {
                            addToastDirect("[DEBUG] Image Replace .then() - Task cleared OK", 'info', 1000);
                         }
                    })
                    .catch(err => {
                        const errorMsg = err?.message || "Unknown error during image replace";
                        addToastDirect(`[DEBUG] Image Replace .catch(): ${errorMsg}`, 'error', 3000);
                        logger.error("[Effect] handleDirectImageReplace Promise REJECTED:", errorMsg);
                        setImageReplaceError(`Promise rejected: ${errorMsg}`);
                    })
                    .finally(() => {
                        addToastDirect("[DEBUG] Image Replace .finally()", 'info', 1000);
                        logger.log("[Effect] Image replace process finished (finally block).");
                        processingImageReplace.current = false;
                    });
            } else {
                 addToastDirect("[DEBUG] Image Replace ERROR: Handler missing!", 'error', 5000);
                 logger.error("[Effect] handleDirectImageReplace handler is not available!");
                 setImageReplaceError("Internal error: Image replace handler missing.");
                 processingImageReplace.current = false;
                 toastError("Внутренняя ошибка: Обработчик замены картинки отсутствует.");
            }
        } else if (imageReplaceTask && fetchStatus === 'error' && !processingImageReplace.current) {
            addToastDirect("[DEBUG] Image Replace SET ERROR: Fetch failed.", 'error', 3000);
            logger.warn("[Effect] Image task active, but fetch status is error.");
             setImageReplaceError("Failed to fetch target file.");
        }
        addToastDirect("[DEBUG] Image Replace Effect FINISH", 'info', 1000);
     }, [
        imageReplaceTask, fetchStatus, allFetchedFiles, /* assistantLoading REMOVED */
        handlers, setImageReplaceError, imageReplaceError, logger, toastError, addToastDirect
     ]);

    useEffect(() => {
        addToastDirect(`[DEBUG] Image Task Ref Update Effect. New task: ${!!imageReplaceTask}`, 'info', 500);
        imageReplaceTaskRef.current = imageReplaceTask;
    }, [imageReplaceTask, addToastDirect]);
    addToastDirect("[DEBUG] After AICodeAssistant useEffects (Post Mount)", 'info', 1000);

    // --- Derived State for Rendering ---
    addToastDirect("[DEBUG] AICodeAssistant Calculate Derived State (Post Mount)", 'info', 1000);
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


    // --- FINAL RENDER ---
    addToastDirect("[DEBUG] AICodeAssistant Render: Returning JSX (Post Mount)", 'info', 1000);
    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            {/* ... остальной JSX без изменений ... */}
            <header className="flex justify-between items-center gap-2 flex-wrap">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                         {showImageReplaceUI ? (imageTaskFailed ? "🖼️ Ошибка Замены Картинки" : "🖼️ Статус Замены Картинки") : "🤖 AI Code Assistant"}
                     </h1>
                     {showStandardAssistantUI && ( <button className="cursor-help p-1" title={assistantTooltipText}> <FaCircleInfo className="text-blue-400 hover:text-blue-300 transition" /> </button> )}
                 </div>
                 <button id="settings-modal-trigger-assistant" onClick={() => { addToastDirect("[DEBUG] Settings Toggle Click (Assistant)", 'info', 1000); triggerToggleSettingsModal(); }} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingPR || assistantLoading} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>

            {showStandardAssistantUI && (
                 <>
                     <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm min-h-[18px]"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : isProcessingAny ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              {React.useMemo(() => { addToastDirect("[DEBUG] Rendering response textarea", 'info', 1000); return null; }, [addToastDirect])}
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y simple-scrollbar" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : isProcessingAny ? "Ожидание..." : "Ответ AI здесь..."} disabled={isProcessingAny} spellCheck="false" />
                              {React.useMemo(() => { addToastDirect("[DEBUG] Rendering TextAreaUtilities", 'info', 1000); return null; }, [addToastDirect])}
                              <TextAreaUtilities response={response} isLoading={isProcessingAny} onParse={handlers.handleParse} onOpenModal={handlers.handleOpenModal} onCopy={handlers.handleCopyResponse} onClear={handlers.handleClearResponse} onSelectFunction={handlers.handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={isProcessingPR || assistantLoading} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               {React.useMemo(() => { addToastDirect("[DEBUG] Rendering CodeRestorer", 'info', 1000); return null; }, [addToastDirect])}
                               <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handlers.handleRestorationComplete} disabled={isProcessingAny || validationStatus === 'validating' || isFetchingOriginals} />
                               {React.useMemo(() => { addToastDirect("[DEBUG] Rendering ValidationStatusIndicator", 'info', 1000); return null; }, [addToastDirect])}
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handlers.handleAutoFix} onCopyPrompt={handlers.handleCopyFixPrompt} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                      {React.useMemo(() => { addToastDirect("[DEBUG] Rendering ParsedFilesList", 'info', 1000); return null; }, [addToastDirect])}
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handlers.handleToggleFileSelection} onSelectAll={handlers.handleSelectAllFiles} onDeselectAll={handlers.handleDeselectAllFiles} onSaveFiles={handlers.handleSaveFiles} onDownloadZip={handlers.handleDownloadZip} onSendToTelegram={handlers.handleSendToTelegram} isUserLoggedIn={!!user} isLoading={isProcessingAny} />
                     {React.useMemo(() => { addToastDirect("[DEBUG] Rendering PullRequestForm", 'info', 1000); return null; }, [addToastDirect])}
                     <PullRequestForm id="pr-form-container" repoUrl={finalRepoUrlForForm}
                      prTitle={prTitle} selectedFileCount={selectedAssistantFiles.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={updateRepoUrl} onPrTitleChange={setPrTitle} onCreatePR={handlers.handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIconNode} isSubmitDisabled={submitButtonDisabled} />
                     {React.useMemo(() => { addToastDirect("[DEBUG] Rendering OpenPrList", 'info', 1000); return null; }, [addToastDirect])}
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {React.useMemo(() => { addToastDirect("[DEBUG] Rendering ToolsMenu", 'info', 1000); return null; }, [addToastDirect])}
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handlers.handleAddCustomLink} disabled={isProcessingAny}/>
                        {React.useMemo(() => { addToastDirect("[DEBUG] Rendering Image Button", 'info', 1000); return null; }, [addToastDirect])}
                         <button onClick={() => { addToastDirect("[DEBUG] Image Button Click", 'info', 1000); setIsImageModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={isProcessingAny} title="Загрузить/Связать Картинки (prompts_imgs.txt)" >
                             <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span>
                             {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && ( <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span> )}
                         </button>
                    </div>
                 </>
            )}

            {/* --- Image Replace UI --- */}
            {showImageReplaceUI && (
                <div className={`flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed min-h-[200px] ${imageTaskFailed ? 'border-red-500' : 'border-blue-400'}`}>
                     {React.useMemo(() => { addToastDirect("[DEBUG] Rendering Image Replace UI", 'info', 1000); return null; }, [addToastDirect])}
                     {/* Status Icon Logic */}
                     {(assistantLoading || isProcessingPR) ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? ( <FaSpinner className="text-blue-400 text-4xl mb-4 animate-spin" /> )
                       : imageTaskFailed ? <FaCircleXmark className="text-red-400 text-4xl mb-4" />
                       : imageReplaceTask ? <FaImages className="text-blue-400 text-4xl mb-4" />
                       : <FaCheck className="text-green-400 text-4xl mb-4" /> }

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
                           : imageTaskFailed ? (imageReplaceError || "Произошла неизвестная ошибка.")
                           : imageReplaceTask ? "Файл загружен, ожидание обработки Ассистентом..."
                           : "Процесс завершен. Проверьте PR."}
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
                              onClick={handleResetImageError}
                              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition"
                          > Сбросить Ошибку </button>
                      )}
                 </div>
             )}

            {/* --- Modals --- */}
            {React.useMemo(() => { addToastDirect("[DEBUG] Rendering Modals Section", 'info', 1000); return null; }, [addToastDirect])}
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