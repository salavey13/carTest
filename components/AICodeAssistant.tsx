"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback, useRef } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode, RepoXmlPageContextType
} from "@/contexts/RepoXmlPageContext"; // Import RepoXmlPageContextType
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

// --- Helper Component ---
const ToastInjector: React.FC<{ id: string; context: RepoXmlPageContextType | null }> = ({ id, context }) => {
    if (!context || !context.addToast) {
        if (!context) logger.warn(`ToastInjector ${id}: Context is null`);
        else if (!context.addToast) logger.warn(`ToastInjector ${id}: context.addToast is not available`);
        return null;
    }
    try {
        context.addToast(`[DEBUG_INJECT] ToastInjector Rendered: ${id}`, 'info', 500);
    } catch (e) {
        logger.error(`ToastInjector ${id} failed to toast:`, e);
    }
    return null;
};


// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {

    // --- Props ---
    const { kworkInputRefPassed, aiResponseInputRefPassed } = props;

    // --- Get Context and Toast early ---
    const pageContext = useRepoXmlPageContext();
    const { addToast: addToastDirect } = pageContext;
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Function START", 'info', 500);

    // --- State ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useState", 'info', 500);
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
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After useState", 'info', 500);


    // --- Hooks ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before Hooks", 'info', 500);
    const appContext = useAppContext();
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useCodeParsingAndValidation", 'info', 500);
    const codeParserHook = useCodeParsingAndValidation();
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After useCodeParsingAndValidation", 'info', 500);
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useAppToast", 'info', 500);
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useAppToast();
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After Standard Hooks", 'info', 500);

    // --- Destructure context ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before Destructuring", 'info', 500);
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
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After Destructuring", 'info', 500);

    // --- Handlers Hook ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useAICodeAssistantHandlers", 'info', 500);
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
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After useAICodeAssistantHandlers", 'info', 500);

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
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useCallback", 'info', 500);
    const setResponseValue = useCallback((value: string) => {
        addToastDirect(`[DEBUG_CB] setResponseValue called.`, 'info', 500);
        setResponse(value);
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value;
        setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); codeParserHook.setRawDescription('');
        setRequestCopied(false); setAiResponseHasContent(value.trim().length > 0);
        logger.log("Response value set manually, resetting parsed state.");
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, codeParserHook, setRequestCopied, setAiResponseHasContent, addToastDirect]);

    const updateRepoUrl = useCallback((url: string) => {
        addToastDirect(`[DEBUG_CB] updateRepoUrl called. URL: ${url}`, 'info', 500);
        setRepoUrlStateLocal(url);
        if (url && url.includes("github.com")) {
            addToastDirect(`[DEBUG_CB] updateRepoUrl triggering PRs.`, 'info', 500);
            triggerGetOpenPRs(url);
        }
     }, [triggerGetOpenPRs, addToastDirect]);

    const handleResetImageError = useCallback(() => {
         addToastDirect(`[DEBUG_CB] handleResetImageError called.`, 'info', 500);
         setImageReplaceError(null);
         toastInfo("Состояние ошибки сброшено.");
     }, [setImageReplaceError, toastInfo, addToastDirect]);
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After useCallback", 'info', 500);


    // --- Refs ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useRef", 'info', 500);
    const processingImageReplace = useRef(false);
    const imageReplaceTaskRef = useRef(imageReplaceTask);
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After useRef", 'info', 500);

    // --- Derived State ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Defining derivedRepoUrlForHooks", 'info', 500);
    const derivedRepoUrlForHooks = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Effects ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useEffects", 'info', 500);
    useEffect(() => {
        addToastDirect("[DEBUG_EFFECT] AICodeAssistant Mounted", 'info', 500);
    }, [addToastDirect]);

    useEffect(() => { addToastDirect(`[DEBUG_EFFECT] Files Parsed: ${componentParsedFiles.length > 0}`, 'info', 500); setFilesParsed(componentParsedFiles.length > 0); }, [componentParsedFiles, setFilesParsed, addToastDirect]);

    useEffect(() => { addToastDirect(`[DEBUG_EFFECT] URL Sync: ${repoUrlFromContext}`, 'info', 500); if (repoUrlFromContext && !repoUrlStateLocal) { setRepoUrlStateLocal(repoUrlFromContext); } }, [repoUrlFromContext, repoUrlStateLocal, addToastDirect]);

    useEffect(() => {
        addToastDirect("[DEBUG_EFFECT] State Reset Check START", 'info', 500);
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        const currentlyParsing = contextIsParsing ?? hookIsParsing;
        addToastDirect(`[DEBUG_EFFECT] State Reset Check: hasContent=${hasContent}, noReq=${!currentAiRequestId}, noAIAct=${!aiActionLoading}, noTask=${!imageReplaceTask}, noAssistLoad=${!assistantLoading}, noProcPR=${!isProcessingPR}, notParsing=${!currentlyParsing}`, 'info', 500);
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !currentlyParsing) {
            addToastDirect("[DEBUG_EFFECT] Resetting state (empty response).", 'info', 500);
            logger.log("[AICodeAssistant Effect] Resetting state (empty response).");
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); setRequestCopied(false);
        } else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !currentlyParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) {
            addToastDirect("[DEBUG_EFFECT] Resetting validation (response changed).", 'info', 500);
            logger.log("[AICodeAssistant Effect] Resetting validation (response changed).");
            setValidationStatus('idle'); setValidationIssues([]);
        }
        addToastDirect("[DEBUG_EFFECT] State Reset Check END", 'info', 500);
    }, [
        response, currentAiRequestId, aiActionLoading, imageReplaceTask,
        componentParsedFiles.length, contextIsParsing, hookIsParsing,
        assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed,
        setSelectedAssistantFiles, setValidationStatus, setValidationIssues,
        setHookParsedFiles, setOriginalRepoFiles, setComponentParsedFiles,
        setSelectedFileIds, setPrTitle, setRequestCopied, logger, addToastDirect
    ]);

    useEffect(() => {
        addToastDirect("[DEBUG_EFFECT] Custom Links Effect Check START", 'info', 500);
        if (!user) { addToastDirect("[DEBUG_EFFECT] Custom Links SKIP: no user", 'info', 500); setCustomLinks([]); return; }
        const loadLinks = async () => {
            addToastDirect("[DEBUG_EFFECT] loadLinks START", 'info', 500);
            try {
                const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
                 addToastDirect(`[DEBUG_EFFECT] loadLinks Supabase done. Error: ${!!e}`, 'info', 500);
                if (!e && d?.metadata?.customLinks) {
                    setCustomLinks(d.metadata.customLinks);
                } else {
                    setCustomLinks([]);
                    if (e && e.code !== 'PGRST116') {
                        logger.error("Error loading custom links (supabase):", e);
                        toastError("Error loading custom links: " + e.message);
                    }
                }
            } catch (e: any) {
                logger.error("Error loading custom links (catch):", e);
                toastError("Error loading custom links: " + e.message);
                setCustomLinks([]);
            }
            addToastDirect("[DEBUG_EFFECT] loadLinks FINISH", 'info', 500);
        };
        loadLinks();
        addToastDirect("[DEBUG_EFFECT] Custom Links Effect Check END", 'info', 500);
    }, [user, toastError, addToastDirect]); // Removed addToastDirect dependency

    useEffect(() => {
        addToastDirect("[DEBUG_EFFECT] Fetch Originals Effect Check START", 'info', 500);
        if (imageReplaceTask) { addToastDirect("[DEBUG_EFFECT] Fetch Originals SKIP: image task active", 'info', 500); return; }
        const skipped = validationIssues.filter(i => i.type === 'skippedCodeBlock');
        addToastDirect(`[DEBUG_EFFECT] Fetch Originals Check: skipped=${skipped.length}, noOriginals=${originalRepoFiles.length === 0}, notFetching=${!isFetchingOriginals}, hasUrl=${!!derivedRepoUrlForHooks}`, 'info', 500);
        if (skipped.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && derivedRepoUrlForHooks) {
            const fetchOrig = async () => {
                addToastDirect("[DEBUG_EFFECT] fetchOrig START", 'info', 500);
                setIsFetchingOriginals(true);
                const branch = targetBranchName ?? undefined;
                const branchDisp = targetBranchName ?? 'default';
                toastInfo(`Загрузка оригиналов из ${branchDisp}...`);
                try {
                    const res = await fetchRepoContents(derivedRepoUrlForHooks, undefined, branch);
                    addToastDirect(`[DEBUG_EFFECT] fetchOrig Supabase done. Success: ${res.success}`, 'info', 500);
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
                    setOriginalRepoFiles([]);
                } finally {
                    setIsFetchingOriginals(false);
                    addToastDirect("[DEBUG_EFFECT] fetchOrig FINISH", 'info', 500);
                }
            };
            fetchOrig();
        }
        addToastDirect("[DEBUG_EFFECT] Fetch Originals Effect Check END", 'info', 500);
    }, [validationIssues, originalRepoFiles.length, isFetchingOriginals, derivedRepoUrlForHooks, targetBranchName, imageReplaceTask, toastInfo, toastSuccess, toastError, addToastDirect]); // Added addToastDirect dependency

    useEffect(() => {
        addToastDirect("[DEBUG_EFFECT] Image Replace Effect Check START", 'info', 500);
        const canProcess = imageReplaceTask && fetchStatus === 'success' && allFetchedFiles.length > 0 && allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath) && !assistantLoading && !processingImageReplace.current;
        addToastDirect(`[DEBUG_EFFECT] Image Replace Check: canProcess=${canProcess}, task=${!!imageReplaceTask}, fetchStatus=${fetchStatus}, fetchFailed=${fetchStatus === 'error'}`, 'info', 500);

        if (canProcess) {
            addToastDirect("[DEBUG_EFFECT] Image Replace Conditions MET. Starting...", 'info', 500);
            logger.log("[Effect] Conditions met. Starting image replace process...");
            processingImageReplace.current = true;
            setImageReplaceError(null);

            if (handlers?.handleDirectImageReplace) {
                addToastDirect("[DEBUG_EFFECT] Calling handlers.handleDirectImageReplace", 'info', 500);
                handlers.handleDirectImageReplace(imageReplaceTask, allFetchedFiles)
                    .then(() => { addToastDirect("[DEBUG_EFFECT] Image Replace .then()", 'info', 500); })
                    .catch(err => { addToastDirect(`[DEBUG_EFFECT] Image Replace .catch(): ${err?.message}`, 'error', 500); })
                    .finally(() => { addToastDirect("[DEBUG_EFFECT] Image Replace .finally()", 'info', 500); processingImageReplace.current = false; });
            } else {
                 addToastDirect("[DEBUG_EFFECT] Image Replace ERROR: Handler missing!", 'error', 500);
                 setImageReplaceError("Internal error: Image replace handler missing.");
                 processingImageReplace.current = false;
                 toastError("Внутренняя ошибка: Обработчик замены картинки отсутствует.");
            }
        } else if (imageReplaceTask && fetchStatus === 'error' && !processingImageReplace.current) {
            addToastDirect("[DEBUG_EFFECT] Image Replace SET ERROR: Fetch failed.", 'error', 500);
             setImageReplaceError("Failed to fetch target file.");
        }
        addToastDirect("[DEBUG_EFFECT] Image Replace Effect Check END", 'info', 500);
     }, [
        imageReplaceTask, fetchStatus, allFetchedFiles, assistantLoading,
        handlers, setImageReplaceError, imageReplaceError, logger, toastError, addToastDirect
     ]);

    useEffect(() => {
        addToastDirect(`[DEBUG_EFFECT] Image Task Ref Update. New task: ${!!imageReplaceTask}`, 'info', 500);
        imageReplaceTaskRef.current = imageReplaceTask;
    }, [imageReplaceTask, addToastDirect]);
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After useEffects", 'info', 500);


    // --- Imperative Handle ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Before useImperativeHandle", 'info', 500);
    useImperativeHandle(ref, () => ({
        handleParse: () => { addToastDirect(`[DEBUG_IMPERATIVE] handleParse called.`, 'info', 500); handlers.handleParse(); },
        selectAllParsedFiles: () => { addToastDirect(`[DEBUG_IMPERATIVE] selectAllParsedFiles called.`, 'info', 500); handlers.handleSelectAllFiles(); },
        handleCreatePR: () => { addToastDirect(`[DEBUG_IMPERATIVE] handleCreatePR called.`, 'info', 500); handlers.handleCreateOrUpdatePR(); },
        setResponseValue: (val: string) => { addToastDirect(`[DEBUG_IMPERATIVE] setResponseValue called.`, 'info', 500); setResponseValue(val); },
        updateRepoUrl: (url: string) => { addToastDirect(`[DEBUG_IMPERATIVE] updateRepoUrl called.`, 'info', 500); updateRepoUrl(url); },
        handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => { addToastDirect(`[DEBUG_IMPERATIVE] handleDirectImageReplace called.`, 'info', 500); return handlers.handleDirectImageReplace(task, files); },
    }), [handlers, setResponseValue, updateRepoUrl, addToastDirect]);
    addToastDirect("[DEBUG_RENDER] AICodeAssistant After useImperativeHandle", 'info', 500);


    // --- Derived State for Rendering ---
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Calculate Derived State", 'info', 500);
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
    addToastDirect("[DEBUG_RENDER] AICodeAssistant Render: Returning JSX", 'info', 500);
    return (
        <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            <ToastInjector id="AICodeAssistant-Start" context={pageContext} />
            <header className="flex justify-between items-center gap-2 flex-wrap">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                         {showImageReplaceUI ? (imageTaskFailed ? "🖼️ Ошибка Замены Картинки" : "🖼️ Статус Замены Картинки") : "🤖 AI Code Assistant"}
                     </h1>
                     {showStandardAssistantUI && ( <button className="cursor-help p-1" title={assistantTooltipText}> <FaCircleInfo className="text-blue-400 hover:text-blue-300 transition" /> </button> )}
                 </div>
                 <button id="settings-modal-trigger-assistant" onClick={() => { addToastDirect("[DEBUG_CLICK] Settings Toggle Click (Assistant)", 'info', 500); triggerToggleSettingsModal(); }} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingPR || assistantLoading} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>
             <ToastInjector id="AICodeAssistant-AfterHeader" context={pageContext} />

            {showStandardAssistantUI && (
                 <>
                     <ToastInjector id="AICodeAssistant-StandardUI-Start" context={pageContext} />
                     <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm min-h-[18px]"> {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : isProcessingAny ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."} </p>
                          <div className="relative group">
                              <ToastInjector id="AICodeAssistant-BeforeTextarea" context={pageContext} />
                              <textarea id="response-input" ref={aiResponseInputRefPassed} className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y simple-scrollbar" defaultValue={response} onChange={(e) => setResponseValue(e.target.value)} placeholder={isWaitingForAiResponse ? "AI думает..." : isProcessingAny ? "Ожидание..." : "Ответ AI здесь..."} disabled={isProcessingAny} spellCheck="false" />
                              <ToastInjector id="AICodeAssistant-BeforeTextareaUtils" context={pageContext} />
                              <TextAreaUtilities response={response} isLoading={isProcessingAny} onParse={handlers.handleParse} onOpenModal={handlers.handleOpenModal} onCopy={handlers.handleCopyResponse} onClear={handlers.handleClearResponse} onSelectFunction={handlers.handleSelectFunction} isParseDisabled={parseButtonDisabled} isProcessingPR={isProcessingPR || assistantLoading} />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               <ToastInjector id="AICodeAssistant-BeforeCodeRestorer" context={pageContext} />
                               <CodeRestorer parsedFiles={componentParsedFiles} originalFiles={originalRepoFiles} skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')} onRestorationComplete={handlers.handleRestorationComplete} disabled={isProcessingAny || validationStatus === 'validating' || isFetchingOriginals} />
                               <ToastInjector id="AICodeAssistant-BeforeValidationIndicator" context={pageContext} />
                               <ValidationStatusIndicator status={validationStatus} issues={validationIssues} onAutoFix={handlers.handleAutoFix} onCopyPrompt={handlers.handleCopyFixPrompt} isFixDisabled={fixButtonDisabled} />
                          </div>
                      </div>
                      <ToastInjector id="AICodeAssistant-BeforeParsedList" context={pageContext} />
                     <ParsedFilesList parsedFiles={componentParsedFiles} selectedFileIds={selectedFileIds} validationIssues={validationIssues} onToggleSelection={handlers.handleToggleFileSelection} onSelectAll={handlers.handleSelectAllFiles} onDeselectAll={handlers.handleDeselectAllFiles} onSaveFiles={handlers.handleSaveFiles} onDownloadZip={handlers.handleDownloadZip} onSendToTelegram={handlers.handleSendToTelegram} isUserLoggedIn={!!user} isLoading={isProcessingAny} />
                     <ToastInjector id="AICodeAssistant-BeforePRForm" context={pageContext} />
                     <PullRequestForm id="pr-form-container" repoUrl={finalRepoUrlForForm}
                      prTitle={prTitle} selectedFileCount={selectedAssistantFiles.size} isLoading={isProcessingPR || assistantLoading} isLoadingPrList={loadingPrs} onRepoUrlChange={updateRepoUrl} onPrTitleChange={setPrTitle} onCreatePR={handlers.handleCreateOrUpdatePR} buttonText={prButtonText} buttonIcon={prButtonLoadingIconNode} isSubmitDisabled={submitButtonDisabled} />
                     <ToastInjector id="AICodeAssistant-BeforeOpenPrList" context={pageContext} />
                     <OpenPrList openPRs={contextOpenPrs} />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <ToastInjector id="AICodeAssistant-BeforeToolsMenu" context={pageContext} />
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handlers.handleAddCustomLink} disabled={isProcessingAny}/>
                        <ToastInjector id="AICodeAssistant-BeforeImageButton" context={pageContext} />
                         <button onClick={() => { addToastDirect("[DEBUG_CLICK] Image Button Click", 'info', 500); setIsImageModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={isProcessingAny} title="Загрузить/Связать Картинки (prompts_imgs.txt)" >
                             <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span>
                             {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && ( <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 shadow-md animate-pulse"></span> )}
                         </button>
                    </div>
                    <ToastInjector id="AICodeAssistant-StandardUI-End" context={pageContext} />
                 </>
            )}

            {/* --- Image Replace UI --- */}
            {showImageReplaceUI && (
                 <div className={`flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed min-h-[200px] ${imageTaskFailed ? 'border-red-500' : 'border-blue-400'}`}>
                    <ToastInjector id="AICodeAssistant-ImageUI-Start" context={pageContext} />
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
                     <ToastInjector id="AICodeAssistant-ImageUI-End" context={pageContext} />
                 </div>
             )}

            {/* --- Modals --- */}
            <AnimatePresence>
                 <ToastInjector id="AICodeAssistant-BeforeModals" context={pageContext} />
                {showStandardAssistantUI && showModal && (
                    <SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handlers.handleSwap} onSearch={handlers.handleSearch} initialMode={modalMode} />
                )}
                {showStandardAssistantUI && isImageModalOpen && (
                    <ImageToolsModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} parsedFiles={componentParsedFiles} onUpdateParsedFiles={handlers.handleUpdateParsedFiles}/>
                )}
             </AnimatePresence>
             <ToastInjector id="AICodeAssistant-End" context={pageContext} />
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;