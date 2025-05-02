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
    targetBranchName: string | null;
    manualBranchName: string;
    imageReplaceTask: ImageReplaceTask | null;
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
    targetBranchName,
    manualBranchName,
    imageReplaceTask,
    highlightedPathFromUrl,
    importantFiles,
    autoFetch,
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
        setRequestCopied, setLoadingPrs, setOpenPrs, setTargetBranchName: setContextTargetBranch, // Renamed setter
        triggerToggleSettingsModal, updateKworkInput,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
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
    const isAutoFetchingRef = useRef(false);
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
        const initialBranchGuess = branchNameToFetchOverride || targetBranchName || manualBranchName || 'default';
        const isAutoFetchWithIdea = autoFetch && !!ideaFromUrl && !isManualRetry;
        const currentTask = taskForEarlyCheck || imageReplaceTask;
        logger.debug(`[Fetch Manual CB] Args: isRetry=${isManualRetry}, branchOverride=${branchNameToFetchOverride}, task=${!!currentTask}, initialBranch=${initialBranchGuess}`);

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

        // Branch / PR Logic (Image Task Only)
        let branchForContentFetch = initialBranchGuess;
        let identifiedPrBranch = false;
        if (currentTask && !isManualRetry) {
             logger.info("[Fetch Manual CB] Image Task - Checking for existing PR...");
             setLoadingPrs(true);
             try {
                 const prResult = await getOpenPullRequests(repoUrl);
                  logger.debug(`[Fetch Manual CB] PR check result: Success=${prResult.success}, Count=${prResult.pullRequests?.length ?? 'N/A'}`);
                  if (prResult.success && prResult.pullRequests) {
                    const expectedPrTitlePrefix = `chore: Update image`; const expectedPrFile = currentTask.targetPath;
                    const matchPr = prResult.pullRequests.find(pr => pr.title?.startsWith(expectedPrTitlePrefix) && pr.title?.includes(expectedPrFile) && pr.head?.ref);
                    if (matchPr?.head?.ref) {
                        branchForContentFetch = matchPr.head.ref; identifiedPrBranch = true;
                        logger.info(`[Fetch Manual CB] Found matching PR #${matchPr.number}, fetching from branch: ${branchForContentFetch}`);
                        setContextTargetBranch(branchForContentFetch); setOpenPrs(prResult.pullRequests as SimplePullRequest[]);
                        toastInfo(`Найден PR #${matchPr.number}. Загружаю из ветки ${branchForContentFetch}...`);
                    } else { logger.debug("[Fetch Manual CB] No matching PR found for image task."); setOpenPrs(prResult.pullRequests as SimplePullRequest[]); }
                } else { toastError("Ошибка загрузки PR: " + (prResult.error ?? 'Неизвестно')); setOpenPrs([]); }
             } catch (prError: any) {
                 logger.error("[Fetch Manual CB] Critical error checking PRs:", prError);
                 toastError("Крит. ошибка проверки PR. Загружаю...", { description: prError.message }); setOpenPrs([]); }
             finally { setLoadingPrs(false); logger.info("[Fetch Manual CB] Image Task PR Check FINISHED"); }
        }

        // Fetch Execution
        logger.info(`[Fetch Manual CB] Starting content fetch from branch: ${branchForContentFetch}`);
        const fetchToastId = toastLoading(`Запрос файлов из ветки (${branchForContentFetch})...`, { duration: 15000 });
        startProgressSimulation(identifiedPrBranch ? 8 : 13);

        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = [];
        let primaryHighlightPathInternal: string | null = null;
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
        let filesToAutoSelect = new Set<string>();

        try {
            logger.debug("[Fetch Manual CB] Calling fetchRepoContents...");
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, branchForContentFetch);
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
                        const errorMsg = `Файл (${primaryHighlightPathInternal}) не найден в ветке ${branchForContentFetch}.`;
                        logger.error(`[Fetch Manual CB] ERROR: Image Task target NOT FOUND! Path: ${primaryHighlightPathInternal}`);
                        setError(errorMsg);
                        toastError(errorMsg, { id: fetchToastId });
                        fetchAttemptSucceeded = false;
                    } else {
                        logger.info(`[Fetch Manual CB] Image Task target found: ${primaryHighlightPathInternal}. Auto-selecting.`);
                        toastSuccess(`Файл для замены (${primaryHighlightPathInternal.split('/').pop()}) загружен из ${branchForContentFetch}.`, { id: fetchToastId });
                        filesToAutoSelect.add(primaryHighlightPathInternal);
                    }
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };

                } else { // Standard Task Path
                     logger.info(`[Fetch Manual CB] Processing Standard Task Path.`);
                    if (highlightedPathFromUrl) {
                        logger.debug(`[Fetch Manual CB] Standard Task - Processing highlights for URL param: ${highlightedPathFromUrl}`);
                        primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                        logger.debug(`[Fetch Manual CB] Primary Path resolved: ${primaryHighlightPathInternal}`);

                        if (primaryHighlightPathInternal) {
                            const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                            if (primaryFileNode) {
                                filesToAutoSelect.add(primaryHighlightPathInternal);
                                logger.debug(`[Fetch Manual CB] Extracting imports from ${primaryHighlightPathInternal}`);
                                const imports = repoUtils.extractImports(primaryFileNode.content);
                                const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                logger.debug(`[Fetch Manual CB] Resolving/categorizing ${imports.length} imports`);

                                imports.forEach(imp => {
                                    const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData);
                                    if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) {
                                        const category = repoUtils.categorizeResolvedPath(resolvedPath);
                                        tempSecPathsSet[category].add(resolvedPath);
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
                                primaryHighlightPathInternal = null;
                                toastError(`Ошибка: Данные для (${highlightedPathFromUrl}) не найдены.`, { id: fetchToastId });
                            }
                        } else {
                           logger.warn(`[Fetch Manual CB] WARN: Page file path for URL ${highlightedPathFromUrl} not found.`);
                           toastWarning(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, { id: fetchToastId });
                        }

                         logger.debug(`[Fetch Manual CB] Checking important files. Count: ${importantFiles.length}`);
                        let addedImportantCount = 0;
                        importantFiles.forEach(p => {
                            if (allPaths.includes(p) && !filesToAutoSelect.has(p)) {
                                filesToAutoSelect.add(p);
                                addedImportantCount++;
                            }
                        });
                        if (addedImportantCount > 0) logger.info(`[Fetch Manual CB] Auto-selected ${addedImportantCount} important files.`);

                        if (filesToAutoSelect.size > 0) {
                            const numSecondary = secondaryHighlightPathsDataInternal.component.length + secondaryHighlightPathsDataInternal.context.length + secondaryHighlightPathsDataInternal.hook.length + secondaryHighlightPathsDataInternal.lib.length;
                            const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary;
                            let msg = `✅ Авто-выбор: `;
                            const parts = [];
                            if (primaryHighlightPathInternal) parts.push(`1 стр.`);
                            if (numSecondary > 0) parts.push(`${numSecondary} связ.`);
                            if (numImportant > 0) parts.push(`${numImportant} важн.`);
                            msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`;
                            toastSuccess(msg, { id: fetchToastId });
                        } else if (primaryHighlightPathInternal === null && highlightedPathFromUrl) {
                            // Only show fetch success if no specific file was targeted but failed
                             toastSuccess(`Извлечено ${fetchedFilesData.length} файлов! (Целевой URL файл не найден)`, { id: fetchToastId });
                        } else if (fetchAttemptSucceeded) {
                             toastSuccess(`Извлечено ${fetchedFilesData.length} файлов!`, { id: fetchToastId });
                        }
                    } else {
                         logger.info(`[Fetch Manual CB] Standard Task - No URL params, basic fetch completed.`);
                         toastSuccess(`Извлечено ${fetchedFilesData.length} файлов!`, { id: fetchToastId });
                        primaryHighlightPathInternal = null;
                        secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };
                        filesToAutoSelect = new Set();
                    }
                }
            } else {
                 logger.error(`[Fetch Manual CB] fetchRepoContents failed. Error: ${fetchResult?.error}`);
                fetchAttemptSucceeded = false;
                throw new Error(fetchResult?.error || `Не удалось получить файлы из ${branchForContentFetch}.`);
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
            setFiles(fetchedFilesData);
            setPrimaryHighlightedPathState(primaryHighlightPathInternal);
            setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal);
             if (filesToAutoSelect.size > 0) {
                 logger.debug(`[Fetch Manual CB] Finally - Setting selected files: ${filesToAutoSelect.size} items`);
                 setSelectedFetcherFiles(filesToAutoSelect);
             }
             logger.debug(`[Fetch Manual CB] Finally - Calling handleSetFilesFetched. Success=${fetchAttemptSucceeded}`);
            handleSetFilesFetched( fetchAttemptSucceeded, fetchedFilesData, primaryHighlightPathInternal, Object.values(secondaryHighlightPathsDataInternal).flat() );
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
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        loadingPrs, assistantLoading, isParsing, aiActionLoading,
        setFetchStatus, handleSetFilesFetched,
        setSelectedFetcherFiles, setRequestCopied,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setLoadingPrs,
        setOpenPrs, setContextTargetBranch, triggerToggleSettingsModal, updateKworkInput,
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
        startProgressSimulation, stopProgressSimulation,
        toastSuccess, toastError, toastInfo, toastWarning, toastLoading, // Include toast functions
        logger // Include logger
    ]);

    // --- Effect: Auto-Fetch ---
    useEffect(() => {
        logger.debug("[Effect Auto-Fetch] Check START");
        if (!repoUrlEntered) { logger.debug("[Effect Auto-Fetch] SKIP: no URL entered"); return; }
        const currentTask = imageReplaceTask;
        const branch = targetBranchName || manualBranchName || null;
        const shouldConsiderAutoFetch = autoFetch && (!!currentTask || !!highlightedPathFromUrl || !!ideaFromUrl);
        if (!shouldConsiderAutoFetch) { logger.debug("[Effect Auto-Fetch] SKIP: Conditions not met", { autoFetch, currentTask, highlightedPathFromUrl, ideaFromUrl }); return; }

        logger.info("[Effect Auto-Fetch] Conditions met, setting timer...");
        const timerId = setTimeout(() => {
            logger.info("[Effect Auto-Fetch] Timer Fired");
            const currentContextStatus = fetchStatusRef.current;
            const canTriggerFetchNow = (currentContextStatus === 'idle' || currentContextStatus === 'failed_retries' || currentContextStatus === 'error');
             logger.debug(`[Effect Auto-Fetch Timer] Checking conditions: canTrigger=${canTriggerFetchNow}, isAutoFetchingRef=${isAutoFetchingRef.current}, status=${currentContextStatus}`);
            if (canTriggerFetchNow && !isAutoFetchingRef.current) {
                logger.info("[Effect Auto-Fetch Timer] Triggering handleFetchManual");
                isAutoFetchingRef.current = true;
                handleFetchManual(false, branch, currentTask)
                    .catch(err => { logger.error(`[Effect Auto-Fetch Timer] handleFetchManual CATCH:`, err); })
                    .finally(() => { logger.info("[Effect Auto-Fetch Timer] handleFetchManual FINALLY"); isAutoFetchingRef.current = false; });
            } else { logger.debug("[Effect Auto-Fetch Timer] Conditions NOT met inside timer."); }
        }, 500); // Keep delay

        return () => { logger.debug("[Effect Auto-Fetch Cleanup] Clearing timer."); clearTimeout(timerId); };
    }, [
        repoUrlEntered, autoFetch, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, ideaFromUrl, handleFetchManual, logger // Added logger
    ]);

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