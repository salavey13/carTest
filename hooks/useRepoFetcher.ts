"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRepoContents, getOpenPullRequests } from "@/app/actions_github/actions";
import {
    useRepoXmlPageContext, FetchStatus, SimplePullRequest, ImageReplaceTask, FileNode,
    ImportCategory, PendingFlowDetails // <<< Import PendingFlowDetails
} from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import * as repoUtils from "@/lib/repoUtils";
import { useAppToast } from "@/hooks/useAppToast";

interface UseRepoFetcherProps {
    repoUrl: string;
    token: string;
    targetBranchName: string | null;
    manualBranchName: string;
    imageReplaceTask: ImageReplaceTask | null; // Keep for direct image task trigger if needed outside flows
    highlightedPathFromUrl: string;
    importantFiles: string[];
    autoFetch: boolean;
    ideaFromUrl: string;
    isSettingsModalOpen: boolean;
    repoUrlEntered: boolean;
    assistantLoading: boolean;
    isParsing: boolean;
    aiActionLoading: boolean;
    loadingPrs: boolean;
}

interface UseRepoFetcherReturn {
    files: FileNode[];
    progress: number;
    error: string | null;
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: Record<ImportCategory, string[]>;
    handleFetchManual: ( // <<< MODIFIED SIGNATURE
        isManualRetry?: boolean,
        branchNameToFetchOverride?: string | null,
        flowDetailsForFetch?: PendingFlowDetails | null, // Pass flow details
        taskForBackwardCompat?: ImageReplaceTask | null // Keep for potential direct calls
    ) => Promise<void>;
    isLoading: boolean;
    isFetchDisabled: boolean;
}

export const useRepoFetcher = ({
    repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask, // imageReplaceTask from context
    highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
    repoUrlEntered, loadingPrs, assistantLoading, isParsing, aiActionLoading,
}: UseRepoFetcherProps): UseRepoFetcherReturn => {
    logger.debug("[useRepoFetcher] Hook START");
    const {
        fetchStatus, setFetchStatus, handleSetFilesFetched, setSelectedFetcherFiles,
        setRequestCopied, setLoadingPrs, setOpenPrs, setTargetBranchName: setContextTargetBranch,
        triggerToggleSettingsModal,
        setKworkInputValue, // Use new setter
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        targetPrData, pendingFlowDetails // Read pending flow details from context as fallback
    } = useRepoXmlPageContext();
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning, loading: toastLoading, message: toastMessage } = useAppToast();

    logger.debug("[useRepoFetcher] Before useState");
    const [files, setFiles] = useState<FileNode[]>([]);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
    logger.debug("[useRepoFetcher] After useState");

    logger.debug("[useRepoFetcher] Before useRef");
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchInitiatedRef = useRef(false); // General fetch initiation flag
    const isAutoFetchingRef = useRef(false);
    const fetchStatusRef = useRef(fetchStatus);
    logger.debug("[useRepoFetcher] After useRef");

    logger.debug("[useRepoFetcher] Before Effects");
    useEffect(() => {
        logger.debug("[Effect Mount] useRepoFetcher Mounted");
        return () => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); } };
    }, []);

    useEffect(() => { fetchStatusRef.current = fetchStatus; }, [fetchStatus]);

    logger.debug("[useRepoFetcher] Before Callbacks");
    const stopProgressSimulation = useCallback(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; } }, []);
    const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => { stopProgressSimulation(); setProgress(0); const ticks = estimatedDurationSeconds * 5; const increment = ticks > 0 ? 100 / ticks : 100; progressIntervalRef.current = setInterval(() => { setProgress(prev => { const currentContextStatus = fetchStatusRef.current; if (currentContextStatus !== 'loading' && currentContextStatus !== 'retrying') { stopProgressSimulation(); return currentContextStatus === 'success' ? 100 : prev; } const nextProgress = prev + increment; if (nextProgress >= 95) { stopProgressSimulation(); return 95; } return nextProgress; }); }, 200); }, [stopProgressSimulation, logger]);

    // --- MODIFIED handleFetchManual ---
    const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null,
        flowDetailsForFetch?: PendingFlowDetails | null, // Explicit flow details take precedence
        taskForBackwardCompat?: ImageReplaceTask | null // Old image task for direct trigger if needed
    ) => {
        logger.info("[Fetch Manual CB] START");

        // Determine the final branch to fetch
        const finalBranchToFetch = branchNameToFetchOverride !== undefined ? branchNameToFetchOverride : (targetBranchName ?? manualBranchName) || null;
        const effectiveBranchDisplay = finalBranchToFetch || 'default';
        logger.debug(`[Fetch Manual CB] Final branch: ${effectiveBranchDisplay}, Override: ${branchNameToFetchOverride}, Target: ${targetBranchName}, Manual: ${manualBranchName}`);

        // Determine the active flow/task for *this specific fetch*
        const currentFlow = flowDetailsForFetch ?? pendingFlowDetails; // Use passed-in flow first, then context
        // Use direct task only if NO specific flow was passed or found in context
        const currentImageTaskDirect = (!currentFlow && (taskForBackwardCompat || imageReplaceTask)) ? (taskForBackwardCompat || imageReplaceTask) : null;
        const isImageFlow = currentFlow?.type === 'ImageSwap' || !!currentImageTaskDirect; // Check flow OR direct task
        const isErrorFixFlow = currentFlow?.type === 'ErrorFix';
        const isDedicatedFlow = isImageFlow || isErrorFixFlow;

        // Use the correct target path based on flow or direct task
        const currentTargetPath = isImageFlow ? (currentFlow?.targetPath || currentImageTaskDirect?.targetPath) : (isErrorFixFlow ? currentFlow?.targetPath : null);

        logger.debug(`[Fetch Manual CB] Args: isRetry=${isManualRetry}, branch=${effectiveBranchDisplay}, isDedicatedFlow=${isDedicatedFlow}, flowType=${currentFlow?.type}, directImageTask=${!!currentImageTaskDirect}, targetPath=${currentTargetPath}`);

        // Guards
        if (isFetchInitiatedRef.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { logger.warn("[Fetch Manual CB] SKIP: Fetch already running."); return; }
        if (!repoUrl.trim()) { logger.error("[Fetch Manual CB] ERROR: No repo URL."); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return; }
        if (loadingPrs || assistantLoading || isParsing || aiActionLoading) { logger.warn("[Fetch Manual CB] SKIP: Blocked by other process.", { loadingPrs, assistantLoading, isParsing, aiActionLoading }); return; }

        // Reset State
        logger.info(`[Fetch Manual CB] Resetting Fetcher State (isDedicatedFlow: ${isDedicatedFlow})`);
        setFetchStatus('loading'); setError(null); setFiles([]); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setSelectedFetcherFiles(new Set());
        isFetchInitiatedRef.current = true;

        if (!isDedicatedFlow) { // Reset AI states only for standard/simple fetches
            logger.debug("[Fetch Manual CB] Standard/Simple fetch - resetting related AI states");
            setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
            setKworkInputValue(""); // Clear kwork for simple/standard fetches
        } else {
            logger.info(`[Fetch Manual CB] Dedicated Flow (${currentFlow?.type || 'DirectImageTask'}) - Keeping/Setting relevant states.`);
            // Clear Kwork specifically for ImageSwap/Direct Image Task
            if (isImageFlow) setKworkInputValue("");
            // ErrorFix kwork is populated by context handler later
        }

        // Fetch Execution
        logger.info(`[Fetch Manual CB] Starting content fetch from branch: ${effectiveBranchDisplay}`);
        const fetchToastId = toastLoading(`Запрос файлов из ветки (${effectiveBranchDisplay})...`, { duration: 15000 });
        startProgressSimulation(13);

        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = [];
        let primaryHighlightPathInternal: string | null = null;
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
        let filesToAutoSelect = new Set<string>();

        try {
            logger.debug(`[Fetch Manual CB] Calling fetchRepoContents with branch: ${finalBranchToFetch}`);
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, finalBranchToFetch);
            logger.info(`[Fetch Manual CB] fetchRepoContents Result: Success=${fetchResult?.success}, Files=${fetchResult?.files?.length ?? 'N/A'}`);

            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true; fetchedFilesData = fetchResult.files;
                const allPaths = fetchedFilesData.map(f => f.path);
                logger.log(`[Fetch Manual CB] Fetched ${fetchedFilesData.length} files successfully.`);

                // --- FLOW SPECIFIC LOGIC (AFTER fetch) ---
                if ((isImageFlow || isErrorFixFlow) && currentTargetPath) {
                    const flowName = isImageFlow ? "Image Flow" : "Error Fix";
                    logger.info(`[Fetch Manual CB] Processing ${flowName} Path. Target: ${currentTargetPath}`);
                    primaryHighlightPathInternal = currentTargetPath; // Highlight the target
                    if (!allPaths.includes(primaryHighlightPathInternal)) {
                        const errorMsg = `Файл (${primaryHighlightPathInternal}) не найден в ветке ${effectiveBranchDisplay}.`;
                        logger.error(`[Fetch Manual CB] ERROR: ${flowName} target NOT FOUND!`);
                        setError(errorMsg); toastError(errorMsg, { id: fetchToastId }); fetchAttemptSucceeded = false;
                    } else {
                        logger.info(`[Fetch Manual CB] ${flowName} target found.`);
                        const successMsg = isImageFlow ? `Файл для замены (${primaryHighlightPathInternal.split('/').pop()}) загружен.` : `Файл для исправления (${primaryHighlightPathInternal.split('/').pop()}) загружен.`;
                        toastSuccess(successMsg, { id: fetchToastId });
                        // Auto-select the target file locally only for ErrorFix (context handles adding to kwork)
                        if (isErrorFixFlow) filesToAutoSelect.add(primaryHighlightPathInternal);
                    }
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; // Reset secondary

                 } else { // --- Standard/Simple Fetch ---
                     logger.info(`[Fetch Manual CB] Processing Standard/Simple Fetch Path.`);
                     primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();

                     if (highlightedPathFromUrl) { // If path came from URL originally (passed as prop)
                         logger.debug(`[Fetch Manual CB] Standard - Processing highlights for URL param: ${highlightedPathFromUrl}`);
                         primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                         if (primaryHighlightPathInternal) {
                             const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                             if (primaryFileNode) {
                                 filesToAutoSelect.add(primaryHighlightPathInternal); // Auto-select primary
                                 const imports = repoUtils.extractImports(primaryFileNode.content);
                                 const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                 imports.forEach(imp => { const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData); if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) { const category = repoUtils.categorizeResolvedPath(resolvedPath); tempSecPathsSet[category].add(resolvedPath); if (category === 'component' || category === 'context' || category === 'hook' || category === 'lib') { filesToAutoSelect.add(resolvedPath); } } });
                                 secondaryHighlightPathsDataInternal = { component: Array.from(tempSecPathsSet.component), context: Array.from(tempSecPathsSet.context), hook: Array.from(tempSecPathsSet.hook), lib: Array.from(tempSecPathsSet.lib), other: Array.from(tempSecPathsSet.other) };
                             } else { logger.warn(`[Fetch Manual CB] WARN: Primary path node not found.`); primaryHighlightPathInternal = null; toastError(`Ошибка: Данные для файла (${highlightedPathFromUrl}) не найдены.`, { id: fetchToastId }); }
                         } else { logger.warn(`[Fetch Manual CB] WARN: Page file path for URL ${highlightedPathFromUrl} not found.`); toastWarning(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, { id: fetchToastId }); }
                     }

                     // Add important files
                     logger.debug(`[Fetch Manual CB] Checking important files. Count: ${importantFiles.length}`);
                     let addedImportantCount = 0; importantFiles.forEach(p => { if (allPaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); addedImportantCount++; } });
                     if (addedImportantCount > 0) logger.info(`[Fetch Manual CB] Auto-selected ${addedImportantCount} important files.`);

                    // Determine success message
                     if (filesToAutoSelect.size > 0) { const numSecondary = Object.values(secondaryHighlightPathsDataInternal).flat().filter(p => p !== primaryHighlightPathInternal && !importantFiles.includes(p)).length; const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary; let msg = `✅ Авто-выбор: `; const parts = []; if (primaryHighlightPathInternal) parts.push(`1 стр.`); if (numSecondary > 0) parts.push(`${numSecondary} связ.`); if (numImportant > 0) parts.push(`${numImportant} важн.`); msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`; toastSuccess(msg, { id: fetchToastId }); }
                     else if (primaryHighlightPathInternal === null && highlightedPathFromUrl) { toastSuccess(`Извлечено ${fetchedFilesData.length} файлов из ${effectiveBranchDisplay}! (Целевой URL файл не найден)`, { id: fetchToastId }); }
                     else if (fetchAttemptSucceeded) { toastSuccess(`Извлечено ${fetchedFilesData.length} файлов из ${effectiveBranchDisplay}!`, { id: fetchToastId }); }
                }

            } else {
                 logger.error(`[Fetch Manual CB] fetchRepoContents failed. Error: ${fetchResult?.error}`);
                 fetchAttemptSucceeded = false; throw new Error(fetchResult?.error || `Не удалось получить файлы из ${effectiveBranchDisplay}.`);
            }
        } catch (err: any) {
             logger.error(`[Fetch Manual CB] CATCH block:`, err); const displayError = err?.message || "Неизвестная ошибка при загрузке."; setError(displayError); toastError(`Ошибка: ${displayError}`, { id: fetchToastId });
             fetchAttemptSucceeded = false; fetchedFilesData = []; primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
        } finally {
             logger.info("[Fetch Manual CB] FINALLY block executing...");
             stopProgressSimulation();
             setFiles(fetchedFilesData);
             setPrimaryHighlightedPathState(primaryHighlightPathInternal);
             setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal);

             // Call context handler LAST - it triggers state changes based on fetch success/failure
             logger.debug(`[Fetch Manual CB] Finally - Calling handleSetFilesFetched. Success=${fetchAttemptSucceeded}`);
             handleSetFilesFetched( fetchAttemptSucceeded, fetchedFilesData, primaryHighlightPathInternal, secondaryHighlightPathsDataInternal );

             // Set selected files *locally* in this hook AFTER calling context handler
             if (fetchAttemptSucceeded && filesToAutoSelect.size > 0) {
                 logger.debug(`[Fetch Manual CB] Finally - Setting selected files in *CONTEXT*: ${filesToAutoSelect.size} items`);
                 setSelectedFetcherFiles(filesToAutoSelect); // Update context selection state
             }

             setProgress(fetchAttemptSucceeded ? 100 : 0);
             isFetchInitiatedRef.current = false; // Reset initiation flag AFTER completion/error
             if(isSettingsModalOpen && fetchAttemptSucceeded) { logger.info("[Fetch Manual CB] Finally - Fetch successful, closing settings modal."); triggerToggleSettingsModal(); }
             logger.info(`[Fetch Manual CB] FINISHED. Final Status via Ref: ${fetchStatusRef.current}`);
        }
    }, [ // Dependencies
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask, // Context state used directly or for comparison
        pendingFlowDetails, // Read context pending flow as fallback
        highlightedPathFromUrl, importantFiles, // Props passed to hook
        isSettingsModalOpen, // Context state
        loadingPrs, assistantLoading, isParsing, aiActionLoading, // Context state
        setFetchStatus, handleSetFilesFetched, setSelectedFetcherFiles, // Context setters
        setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, // Context setters
        setKworkInputValue, // Use new setter
        triggerToggleSettingsModal, // Context actions
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, // Local setters
        startProgressSimulation, stopProgressSimulation, // Local callbacks
        toastSuccess, toastError, toastInfo, toastWarning, toastLoading, // Toast functions
        logger // Logger
    ]);


    // --- Effect: Auto-Fetch ---
    useEffect(() => {
        logger.debug("[Effect Auto-Fetch] Check START");
        if (!repoUrlEntered) { logger.debug("[Effect Auto-Fetch] SKIP: no URL entered"); return; }
        if (isAutoFetchingRef.current || fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') { logger.debug("[Effect Auto-Fetch] SKIP: Already fetching or auto-fetch in progress."); return; }

        const shouldConsiderAutoFetch = autoFetch; // Use prop passed to hook

        if (!shouldConsiderAutoFetch) { logger.debug("[Effect Auto-Fetch] SKIP: Conditions not met based on autoFetch prop", { autoFetch }); return; }

        logger.info("[Effect Auto-Fetch] Conditions met, setting timer...");
        const timerId = setTimeout(() => {
            logger.info("[Effect Auto-Fetch] Timer Fired");
            const currentContextStatus = fetchStatusRef.current;
            const canTriggerFetchNow = (currentContextStatus === 'idle' || currentContextStatus === 'failed_retries' || currentContextStatus === 'error');
            logger.debug(`[Effect Auto-Fetch Timer] Checking conditions: canTrigger=${canTriggerFetchNow}, isAutoFetchingRef=${isAutoFetchingRef.current}, status=${currentContextStatus}`);

            if (canTriggerFetchNow && !isAutoFetchingRef.current) {
                logger.info("[Effect Auto-Fetch Timer] Triggering handleFetchManual for auto-fetch");
                isAutoFetchingRef.current = true;
                // Pass current pendingFlowDetails and imageReplaceTask from context
                handleFetchManual(false, null, pendingFlowDetails, imageReplaceTask)
                    .catch(err => { logger.error(`[Effect Auto-Fetch Timer] handleFetchManual CATCH:`, err); })
                    .finally(() => {
                        logger.info("[Effect Auto-Fetch Timer] handleFetchManual FINALLY");
                        setTimeout(() => { logger.debug("[Effect Auto-Fetch Timer] Resetting isAutoFetchingRef flag."); isAutoFetchingRef.current = false; }, 200); // Delay reset
                    });
            } else { logger.debug("[Effect Auto-Fetch Timer] Conditions NOT met inside timer or already fetching."); }
        }, 500); // Keep delay

        return () => { logger.debug("[Effect Auto-Fetch Cleanup] Clearing timer."); clearTimeout(timerId); };
    }, [ // Minimal stable dependencies
        repoUrlEntered, autoFetch, // Trigger conditions
        pendingFlowDetails, imageReplaceTask, // Values to pass to fetch
        handleFetchManual, logger // Stable callback and util
    ]);

    logger.debug("[useRepoFetcher] After Callbacks and Effects");

    // --- Derived State ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading;
    logger.debug(`[useRepoFetcher Derived State] isLoading=${isLoading}, isFetchDisabled=${isFetchDisabled}`);

    // --- Return values ---
    const returnValue = {
        files, progress, error, primaryHighlightedPath, secondaryHighlightedPaths,
        handleFetchManual, isLoading, isFetchDisabled,
    };
    logger.debug("[useRepoFetcher] Hook End - Returning values");
    return returnValue;
};