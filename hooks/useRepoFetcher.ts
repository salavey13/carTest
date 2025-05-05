"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRepoContents, getOpenPullRequests } from "@/app/actions_github/actions";
import { useRepoXmlPageContext, FetchStatus, SimplePullRequest, ImageReplaceTask, FileNode, ImportCategory } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger"; // Use logger
import * as repoUtils from "@/lib/repoUtils";
import { useAppToast } from "@/hooks/useAppToast"; // Use toast hook

interface UseRepoFetcherProps {
    repoUrl: string;
    token: string;
    targetBranchName: string | null; // Can be PR source branch
    manualBranchName: string;
    imageReplaceTask: ImageReplaceTask | null;
    highlightedPathFromUrl: string;
    importantFiles: string[];
    autoFetch: boolean; // Prop indicating if initial fetch is needed based on parent context
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
    handleFetchManual: (
        isManualRetry?: boolean,
        branchNameToFetchOverride?: string | null,
        taskForEarlyCheck?: ImageReplaceTask | null
    ) => Promise<void>;
    isLoading: boolean;
    isFetchDisabled: boolean;
}

export const useRepoFetcher = ({
    repoUrl,
    token,
    targetBranchName, // Actual branch to fetch (determined by context/pre-check)
    manualBranchName,
    imageReplaceTask,
    highlightedPathFromUrl,
    importantFiles,
    autoFetch, // Prop directly tells us if conditions from parent are met
    ideaFromUrl,
    isSettingsModalOpen,
    repoUrlEntered,
    loadingPrs,
    assistantLoading,
    isParsing,
    aiActionLoading,
}: UseRepoFetcherProps): UseRepoFetcherReturn => {
    logger.debug("[useRepoFetcher] Hook START");
    const {
        // Get context setters and some state directly
        fetchStatus, setFetchStatus, handleSetFilesFetched, setSelectedFetcherFiles,
        setRequestCopied, setLoadingPrs, setOpenPrs, setTargetBranchName: setContextTargetBranch,
        triggerToggleSettingsModal, updateKworkInput,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        targetPrData, // Read target PR data
        // Removed addToast from context destructuring
    } = useRepoXmlPageContext();
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning, loading: toastLoading, message: toastMessage } = useAppToast(); // Get toast functions

    logger.debug("[useRepoFetcher] Before useState");
    const [files, setFiles] = useState<FileNode[]>([]);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
    logger.debug("[useRepoFetcher] After useState");

    logger.debug("[useRepoFetcher] Before useRef");
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isImageTaskFetchInitiated = useRef(false);
    const isAutoFetchingRef = useRef(false); // Ref to track if auto-fetch is *currently* running
    const fetchStatusRef = useRef(fetchStatus); // Use ref to track status inside interval
    logger.debug("[useRepoFetcher] After useRef");

    logger.debug("[useRepoFetcher] Before Effects");
    useEffect(() => {
        logger.debug("[Effect Mount] useRepoFetcher Mounted");
        return () => {
            logger.debug("[Effect Cleanup] useRepoFetcher Unmounting, clearing progress interval.");
            if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); }
        };
    }, []); // Empty dependency array ensures this runs only on mount and unmount

    useEffect(() => {
        logger.debug(`[Effect Status Sync] Fetch status changed to: ${fetchStatus}`);
        fetchStatusRef.current = fetchStatus; // Keep ref updated
    }, [fetchStatus]);

    logger.debug("[useRepoFetcher] Before Callbacks");
    const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) {
             logger.debug("[Progress CB] Stopping progress simulation interval.");
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
        logger.info(`[Progress CB] Starting progress simulation (est: ${estimatedDurationSeconds}s)`);
        stopProgressSimulation();
        setProgress(0);
        const ticks = estimatedDurationSeconds * 5;
        const increment = ticks > 0 ? 100 / ticks : 100;
        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                const currentContextStatus = fetchStatusRef.current; // Read from ref
                 // logger.debug(`[Progress Tick] Prev: ${prev}, Status: ${currentContextStatus}`); // Can be noisy
                if (currentContextStatus !== 'loading' && currentContextStatus !== 'retrying') {
                    logger.debug("[Progress Tick] Stopping simulation (status changed).");
                    stopProgressSimulation();
                    return currentContextStatus === 'success' ? 100 : prev;
                }
                const nextProgress = prev + increment;
                if (nextProgress >= 95) {
                     logger.debug("[Progress Tick] Reached 95%, stopping simulation.");
                    stopProgressSimulation();
                    return 95;
                }
                return nextProgress;
            });
        }, 200);
    }, [stopProgressSimulation, logger]); // Added logger dependency

    const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null,
        taskForEarlyCheck?: ImageReplaceTask | null
    ) => {
        logger.info("[Fetch Manual CB] START");
        // Determine the final branch to fetch: Override > Context Target (PR Source) > Manual > null (default)
        const finalBranchToFetch = branchNameToFetchOverride !== undefined
            ? branchNameToFetchOverride // Explicit override takes precedence
            : (targetBranchName ?? manualBranchName) // Evaluate nullish coalescing first
              || null;                            // Then apply logical OR for the final fallback

        const effectiveBranchDisplay = finalBranchToFetch || 'default';
        logger.debug(`[Fetch Manual CB] Final branch to fetch: ${effectiveBranchDisplay}, Override: ${branchNameToFetchOverride}, Target: ${targetBranchName}, Manual: ${manualBranchName}`);

        const isAutoFetchWithIdea = autoFetch && !!ideaFromUrl && !isManualRetry; // Not used in guards anymore, but kept for logging context
        const currentTask = taskForEarlyCheck || imageReplaceTask;
        logger.debug(`[Fetch Manual CB] Args: isRetry=${isManualRetry}, branch=${effectiveBranchDisplay}, task=${!!currentTask}`);

        // Guards
        if (currentTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) { logger.warn("[Fetch Manual CB] SKIP: Image fetch already running."); return; }
        if (!currentTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { logger.warn("[Fetch Manual CB] SKIP: Standard fetch already running."); return; }
        if (!repoUrl.trim()) { logger.error("[Fetch Manual CB] ERROR: No repo URL provided."); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return; }
        if (loadingPrs || assistantLoading || isParsing || aiActionLoading) { logger.warn("[Fetch Manual CB] SKIP: Blocked by other process.", { loadingPrs, assistantLoading, isParsing, aiActionLoading }); return; }

        // Reset State
        logger.info("[Fetch Manual CB] Resetting Fetcher State");
        setFetchStatus('loading');
        setError(null);
        setFiles([]);
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        setSelectedFetcherFiles(new Set());
        if (!currentTask) {
            logger.debug("[Fetch Manual CB] Standard task - resetting related AI states");
            setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
        } else {
            logger.info("[Fetch Manual CB] Image Task mode - setting initiation flag");
            isImageTaskFetchInitiated.current = true; updateKworkInput(""); // Clear Kwork for image task
        }

        // Fetch Execution
        logger.info(`[Fetch Manual CB] Starting content fetch from branch: ${effectiveBranchDisplay}`);
        const fetchToastId = toastLoading(`Запрос файлов из ветки (${effectiveBranchDisplay})...`, { duration: 15000 });
        startProgressSimulation(13); // Use a standard duration

        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = [];
        let primaryHighlightPathInternal: string | null = null;
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
        let filesToAutoSelect = new Set<string>();

        try {
            logger.debug(`[Fetch Manual CB] Calling fetchRepoContents with branch: ${finalBranchToFetch}`);
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, finalBranchToFetch); // Use the final determined branch
            logger.info(`[Fetch Manual CB] fetchRepoContents Result: Success=${fetchResult?.success}, Files=${fetchResult?.files?.length ?? 'N/A'}`);

            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true;
                fetchedFilesData = fetchResult.files;
                const allPaths = fetchedFilesData.map(f => f.path);
                logger.log(`[Fetch Manual CB] Fetched ${fetchedFilesData.length} files successfully.`);

                if (currentTask) { // Image Task Path
                    logger.info(`[Fetch Manual CB] Processing Image Task Path. Target: ${currentTask.targetPath}`);
                    primaryHighlightPathInternal = currentTask.targetPath;
                    if (!allPaths.includes(primaryHighlightPathInternal)) {
                        const errorMsg = `Файл (${primaryHighlightPathInternal}) не найден в ветке ${effectiveBranchDisplay}.`;
                        logger.error(`[Fetch Manual CB] ERROR: Image Task target NOT FOUND! Path: ${primaryHighlightPathInternal}`);
                        setError(errorMsg);
                        toastError(errorMsg, { id: fetchToastId });
                        fetchAttemptSucceeded = false; // Mark as failed if target not found
                    } else {
                        logger.info(`[Fetch Manual CB] Image Task target found: ${primaryHighlightPathInternal}.`);
                        toastSuccess(`Файл для замены (${primaryHighlightPathInternal.split('/').pop()}) загружен из ${effectiveBranchDisplay}.`, { id: fetchToastId });
                        // DO NOT auto-select here, let the parent component/context handle selection via handleSetFilesFetched
                    }
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; // No secondary highlights for image task

                } else { // Standard Task Path
                     logger.info(`[Fetch Manual CB] Processing Standard Task Path.`);
                     primaryHighlightPathInternal = null; // Reset primary highlight for standard tasks
                     secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; // Reset secondary
                     filesToAutoSelect = new Set<string>(); // Reset auto-select

                     // If a path was passed via URL params (potentially with an idea)
                     if (highlightedPathFromUrl) {
                         logger.debug(`[Fetch Manual CB] Standard Task - Processing highlights for URL param: ${highlightedPathFromUrl}`);
                         primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                         logger.debug(`[Fetch Manual CB] Primary Path resolved: ${primaryHighlightPathInternal}`);

                         if (primaryHighlightPathInternal) {
                             const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                             if (primaryFileNode) {
                                 filesToAutoSelect.add(primaryHighlightPathInternal); // Auto-select primary
                                 logger.debug(`[Fetch Manual CB] Extracting imports from ${primaryHighlightPathInternal}`);
                                 const imports = repoUtils.extractImports(primaryFileNode.content);
                                 const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                 logger.debug(`[Fetch Manual CB] Resolving/categorizing ${imports.length} imports`);

                                 imports.forEach(imp => {
                                     const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData);
                                     if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) {
                                         const category = repoUtils.categorizeResolvedPath(resolvedPath);
                                         tempSecPathsSet[category].add(resolvedPath);
                                         // Auto-select components, context, hooks, libs by default
                                         if (category === 'component' || category === 'context' || category === 'hook' || category === 'lib') {
                                             filesToAutoSelect.add(resolvedPath);
                                         }
                                     }
                                 });
                                 secondaryHighlightPathsDataInternal = {
                                     component: Array.from(tempSecPathsSet.component), context: Array.from(tempSecPathsSet.context), hook: Array.from(tempSecPathsSet.hook), lib: Array.from(tempSecPathsSet.lib), other: Array.from(tempSecPathsSet.other)
                                 };
                                 logger.debug(`[Fetch Manual CB] Secondary paths calculated.`, secondaryHighlightPathsDataInternal);
                             } else {
                                 logger.warn(`[Fetch Manual CB] WARN: Primary path ${primaryHighlightPathInternal} node not found in fetched data.`);
                                 primaryHighlightPathInternal = null; // Reset if node not found
                                 toastError(`Ошибка: Данные для файла (${highlightedPathFromUrl}) не найдены.`, { id: fetchToastId });
                             }
                         } else {
                            logger.warn(`[Fetch Manual CB] WARN: Page file path for URL ${highlightedPathFromUrl} not found.`);
                            toastWarning(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, { id: fetchToastId });
                         }
                     } else {
                         logger.info(`[Fetch Manual CB] Standard Task - No URL path param provided.`);
                     }

                     // Add important files regardless of URL param presence
                     logger.debug(`[Fetch Manual CB] Checking important files. Count: ${importantFiles.length}`);
                     let addedImportantCount = 0;
                     importantFiles.forEach(p => {
                         if (allPaths.includes(p) && !filesToAutoSelect.has(p)) {
                             filesToAutoSelect.add(p);
                             addedImportantCount++;
                         }
                     });
                     if (addedImportantCount > 0) logger.info(`[Fetch Manual CB] Auto-selected ${addedImportantCount} important files.`);

                    // Determine success message based on what was found
                     if (filesToAutoSelect.size > 0) {
                         const numSecondary = Object.values(secondaryHighlightPathsDataInternal).flat().filter(p => p !== primaryHighlightPathInternal && !importantFiles.includes(p)).length;
                         const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary;
                         let msg = `✅ Авто-выбор: `;
                         const parts = [];
                         if (primaryHighlightPathInternal) parts.push(`1 стр.`);
                         if (numSecondary > 0) parts.push(`${numSecondary} связ.`);
                         if (numImportant > 0) parts.push(`${numImportant} важн.`);
                         msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`;
                         toastSuccess(msg, { id: fetchToastId });
                     } else if (primaryHighlightPathInternal === null && highlightedPathFromUrl) {
                         // Only show warning if target file was specified but not found
                         toastSuccess(`Извлечено ${fetchedFilesData.length} файлов из ${effectiveBranchDisplay}! (Целевой URL файл не найден)`, { id: fetchToastId });
                     } else if (fetchAttemptSucceeded) {
                         // Generic success if no specific file was looked for or found
                         toastSuccess(`Извлечено ${fetchedFilesData.length} файлов из ${effectiveBranchDisplay}!`, { id: fetchToastId });
                     }
                }
            } else {
                 logger.error(`[Fetch Manual CB] fetchRepoContents failed. Error: ${fetchResult?.error}`);
                fetchAttemptSucceeded = false;
                throw new Error(fetchResult?.error || `Не удалось получить файлы из ${effectiveBranchDisplay}.`);
            }
        } catch (err: any) {
             logger.error(`[Fetch Manual CB] CATCH block:`, err);
            const displayError = err?.message || "Неизвестная ошибка при загрузке.";
            setError(displayError);
            toastError(`Ошибка: ${displayError}`, { id: fetchToastId });
            fetchAttemptSucceeded = false;
            fetchedFilesData = []; primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
        } finally {
             logger.info("[Fetch Manual CB] FINALLY block executing...");
            stopProgressSimulation();
            setFiles(fetchedFilesData); // Update local files state
            setPrimaryHighlightedPathState(primaryHighlightPathInternal); // Update local highlight state
            setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal); // Update local highlight state

            // Call context handler to update global state and potentially trigger next steps
            // This includes setting the fetch status correctly based on success/failure
            logger.debug(`[Fetch Manual CB] Finally - Calling handleSetFilesFetched. Success=${fetchAttemptSucceeded}`);
            handleSetFilesFetched(
                 fetchAttemptSucceeded,
                 fetchedFilesData,
                 primaryHighlightPathInternal,
                 secondaryHighlightPathsDataInternal
             );

            // Set selected files *after* calling handleSetFilesFetched
             if (fetchAttemptSucceeded && filesToAutoSelect.size > 0 && !currentTask) {
                 logger.debug(`[Fetch Manual CB] Finally - Setting selected files in context: ${filesToAutoSelect.size} items`);
                 setSelectedFetcherFiles(filesToAutoSelect);
             }

            setProgress(fetchAttemptSucceeded ? 100 : 0);
            if (currentTask && !fetchAttemptSucceeded) {
                 logger.info("[Fetch Manual CB] Finally - Resetting image task initiation flag due to failure.");
                 isImageTaskFetchInitiated.current = false;
            }
            if(isSettingsModalOpen && fetchAttemptSucceeded) {
                logger.info("[Fetch Manual CB] Finally - Fetch successful, closing settings modal.");
                triggerToggleSettingsModal();
            }
             logger.info(`[Fetch Manual CB] FINISHED. Final Status via Ref: ${fetchStatusRef.current}`);
        }
    }, [
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask, // Context state
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, // Props passed to hook
        isSettingsModalOpen, // Context state
        loadingPrs, assistantLoading, isParsing, aiActionLoading, // Context state
        setFetchStatus, handleSetFilesFetched, setSelectedFetcherFiles, // Context setters
        setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, // Context setters
        updateKworkInput, triggerToggleSettingsModal, // Context actions
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, // Local setters
        startProgressSimulation, stopProgressSimulation, // Local callbacks
        toastSuccess, toastError, toastInfo, toastWarning, toastLoading, // Toast functions
        logger // Logger
    ]);


    // --- Effect: Auto-Fetch ---
    useEffect(() => {
        logger.debug("[Effect Auto-Fetch] Check START");
        // Guards moved up
        if (!repoUrlEntered) { logger.debug("[Effect Auto-Fetch] SKIP: no URL entered"); return; }
        if (isAutoFetchingRef.current || fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') {
            logger.debug("[Effect Auto-Fetch] SKIP: Already fetching or auto-fetch in progress.");
            return;
        }

        const currentTask = imageReplaceTask;
        // Calculate based on props passed to the hook
        const shouldConsiderAutoFetch = autoFetch; // Prop directly tells us if conditions from parent are met

        if (!shouldConsiderAutoFetch) {
            logger.debug("[Effect Auto-Fetch] SKIP: Conditions not met based on autoFetch prop", { autoFetch });
            return;
        }

        logger.info("[Effect Auto-Fetch] Conditions met, setting timer...");
        const timerId = setTimeout(() => {
            logger.info("[Effect Auto-Fetch] Timer Fired");
            const currentContextStatus = fetchStatusRef.current;
            // Check status again *inside* the timer callback
            const canTriggerFetchNow = (currentContextStatus === 'idle' || currentContextStatus === 'failed_retries' || currentContextStatus === 'error');
            logger.debug(`[Effect Auto-Fetch Timer] Checking conditions: canTrigger=${canTriggerFetchNow}, isAutoFetchingRef=${isAutoFetchingRef.current}, status=${currentContextStatus}`);

            if (canTriggerFetchNow && !isAutoFetchingRef.current) {
                logger.info("[Effect Auto-Fetch Timer] Triggering handleFetchManual for auto-fetch");
                isAutoFetchingRef.current = true;
                // *** Call handleFetchManual with null branch override ***
                // Let handleFetchManual determine the actual branch based on targetBranchName/manualBranchName from context
                handleFetchManual(false, null, currentTask)
                    .catch(err => { logger.error(`[Effect Auto-Fetch Timer] handleFetchManual CATCH:`, err); })
                    .finally(() => {
                        logger.info("[Effect Auto-Fetch Timer] handleFetchManual FINALLY");
                        // Delay resetting the ref slightly
                        setTimeout(() => {
                            logger.debug("[Effect Auto-Fetch Timer] Resetting isAutoFetchingRef flag.");
                            isAutoFetchingRef.current = false;
                        }, 200);
                    });
            } else {
                logger.debug("[Effect Auto-Fetch Timer] Conditions NOT met inside timer or already fetching.");
            }
        }, 500); // Keep delay

        return () => {
            logger.debug("[Effect Auto-Fetch Cleanup] Clearing timer.");
            clearTimeout(timerId);
        };
    }, [
        // Primary dependencies:
        repoUrlEntered,   // Need URL to be entered
        autoFetch,        // The prop indicating intent from parent
        imageReplaceTask, // Need current task status for handleFetchManual call
        // Stable dependencies:
        handleFetchManual,
        logger
    ]); // Dependencies are minimal and mostly stable

    logger.debug("[useRepoFetcher] After Callbacks and Effects");

    // --- Derived State ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    // Combine all blocking conditions
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (!!imageReplaceTask && isImageTaskFetchInitiated.current && isLoading);
    logger.debug(`[useRepoFetcher Derived State] isLoading=${isLoading}, isFetchDisabled=${isFetchDisabled}`);

    // --- Return values ---
    const returnValue = {
        files, progress, error, primaryHighlightedPath, secondaryHighlightedPaths,
        handleFetchManual, isLoading, isFetchDisabled,
    };
    logger.debug("[useRepoFetcher] Hook End - Returning values");
    return returnValue;
};