import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRepoContents, getOpenPullRequests } from "@/app/actions_github/actions"; // Adjust if actions are elsewhere
import { useRepoXmlPageContext, FetchStatus, SimplePullRequest, ImageReplaceTask, FileNode, ImportCategory } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import * as repoUtils from "@/lib/repoUtils";

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
    // States from context needed for guards/logic
    assistantLoading: boolean;
    isParsing: boolean;
    aiActionLoading: boolean;
    loadingPrs: boolean;
}

interface UseRepoFetcherReturn {
    files: FileNode[]; // Files currently displayed by this fetcher instance
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

    // Context access within the hook
    const {
      fetchStatus, setFetchStatus,
      handleSetFilesFetched, // Use the handler function from Context
      setSelectedFetcherFiles,
      setRequestCopied,
      setLoadingPrs, setOpenPrs, setContextTargetBranch,
      triggerToggleSettingsModal,
      updateKworkInput,
      addToast, // Use context's toast wrapper
      setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
    } = useRepoXmlPageContext();

    // --- Internal state (NO isMounted) ---
    const [files, setFiles] = useState<FileNode[]>([]);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });

    // --- Refs ---
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isImageTaskFetchInitiated = useRef(false);
    const isAutoFetchingRef = useRef(false);
    const fetchStatusRef = useRef(fetchStatus); // Track fetch status for interval cleanup

    // --- Effects ---
    useEffect(() => {
        // Add debug toast for when the hook *actually* mounts on the client
        addToast("[DEBUG] useRepoFetcher Mounted (Effect)", 'info', 1000);
        // Cleanup function
        return () => {
            addToast("[DEBUG] useRepoFetcher Unmounting - Stopping Progress", 'info', 1000);
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [addToast]); // Dependency on addToast (stable)

    useEffect(() => {
        fetchStatusRef.current = fetchStatus;
    }, [fetchStatus]);

    // --- Progress Simulation ---
    const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
        addToast(`[DEBUG] startProgressSimulation called. Type: ${typeof setInterval}`, 'info', 1000);
        stopProgressSimulation();
        setProgress(0);
        const ticks = estimatedDurationSeconds * 5;
        const increment = ticks > 0 ? 100 / ticks : 100;
        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                const currentContextStatus = fetchStatusRef.current;
                if (currentContextStatus !== 'loading' && currentContextStatus !== 'retrying') {
                    addToast("[DEBUG] Progress Interval: Stopping due to context status change", 'info', 500);
                    stopProgressSimulation();
                    return currentContextStatus === 'success' ? 100 : prev;
                }
                const nextProgress = prev + increment;
                if (nextProgress >= 95) {
                    addToast("[DEBUG] Progress Interval: Reached >= 95%, stopping simulation.", 'info', 500);
                    stopProgressSimulation();
                    return 95;
                }
                return nextProgress;
            });
        }, 200);
    }, [stopProgressSimulation, addToast]);

    // --- Core Fetch Logic ---
    const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null,
        taskForEarlyCheck?: ImageReplaceTask | null
    ) => {
        const initialBranchGuess = branchNameToFetchOverride || targetBranchName || manualBranchName || 'default';
        const isAutoFetchWithIdea = autoFetch && !!ideaFromUrl && !isManualRetry;
        const currentTask = taskForEarlyCheck || imageReplaceTask;

        addToast(`[DEBUG] handleFetchManual START. Branch: ${initialBranchGuess}. Task: ${!!currentTask}`, 'info', 1000);

        // --- Guards ---
        if (currentTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) {
             addToast("[DEBUG] handleFetchManual SKIP: Image fetch already running", 'warning', 1000);
             logger.warn("Fetcher Hook: Image task fetch already running."); return;
        }
        if (!currentTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) {
            addToast("[DEBUG] handleFetchManual SKIP: Standard fetch already running", 'warning', 1000);
            logger.warn("Fetcher Hook: Standard fetch already running."); addToast("Уже идет загрузка...", "info"); return;
        }
        if (!repoUrl.trim()) {
            addToast("[DEBUG] handleFetchManual ERROR: Repo URL empty", 'error', 3000);
            logger.error("Fetcher Hook: Repo URL empty."); addToast("Введите URL репозитория", 'error'); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return;
        }
        // This guard might still be relevant, check if other processes should block fetch
        if (loadingPrs || assistantLoading || isParsing || aiActionLoading) {
            addToast("[DEBUG] handleFetchManual SKIP: Blocked by other process", 'warning', 1000);
            logger.warn(`Fetcher Hook: Blocked by processing state (PRs: ${loadingPrs}, Assistant: ${assistantLoading}, Parsing: ${isParsing}, AI Action: ${aiActionLoading}).`); addToast("Подождите завершения.", "warning"); return;
        }

        // --- Reset State ---
        addToast("[DEBUG] handleFetchManual Resetting State", 'info', 1000);
        setFetchStatus('loading'); // Can set immediately now
        setError(null);
        setFiles([]);
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        setSelectedFetcherFiles(new Set());
        if (!currentTask) {
             addToast("[DEBUG] handleFetchManual: Standard task - resetting AI states", 'info', 1000);
             setRequestCopied(false);
             setAiResponseHasContent(false);
             setFilesParsed(false);
             setSelectedAssistantFiles(new Set());
             if (!isAutoFetchWithIdea) { logger.log("Fetcher Hook: Manual fetch or auto without idea. Kwork input untouched by Fetcher initially."); }
        } else {
             addToast("[DEBUG] handleFetchManual: Image Task mode - setting flag", 'info', 1000);
             isImageTaskFetchInitiated.current = true;
             updateKworkInput("");
        }

        // --- Branch / PR Logic (Image Task Only) ---
        let branchForContentFetch = initialBranchGuess;
        let identifiedPrBranch = false;
        if (currentTask && !isManualRetry) {
             addToast("[DEBUG] handleFetchManual: Image Task PR Check START", 'info', 1000);
             setLoadingPrs(true);
             try {
                 addToast(`[DEBUG] Before getOpenPullRequests. Type: ${typeof getOpenPullRequests}`, 'info', 1000);
                 const prResult = await getOpenPullRequests(repoUrl);
                 // ... (rest of PR logic remains the same) ...
                 addToast(`[DEBUG] After getOpenPullRequests. Success: ${prResult.success}`, 'info', 1000);
                 if (prResult.success && prResult.pullRequests) {
                    logger.log(`[Fetcher Hook] Found ${prResult.pullRequests.length} open PRs.`);
                    const expectedPrTitlePrefix = `chore: Update image`; const expectedPrFile = currentTask.targetPath;
                    const matchPr = prResult.pullRequests.find(pr => pr.title?.startsWith(expectedPrTitlePrefix) && pr.title?.includes(expectedPrFile) && pr.head?.ref);
                    if (matchPr?.head?.ref) {
                        branchForContentFetch = matchPr.head.ref; identifiedPrBranch = true;
                        addToast(`[DEBUG] Found PR branch: ${branchForContentFetch}`, 'info', 1000);
                        setContextTargetBranch(branchForContentFetch); setOpenPrs(prResult.pullRequests as SimplePullRequest[]);
                        logger.log(`[Fetcher Hook] Found relevant PR #${matchPr.number} on branch '${branchForContentFetch}'. Fetching from this branch.`);
                        addToast(`Найден PR #${matchPr.number}. Загружаю из ветки ${branchForContentFetch}...`, "info");
                    } else {
                        logger.log(`[Fetcher Hook] No specific PR found for image task. Using default/manual branch: ${branchForContentFetch}`);
                        setOpenPrs(prResult.pullRequests as SimplePullRequest[]);
                    }
                } else {
                    logger.error(`[Fetcher Hook] Failed to get open PRs: ${prResult.error}. Proceeding with: ${branchForContentFetch}`);
                    addToast("Не удалось проверить PR. Загружаю...", "error", { description: prResult.error }); setOpenPrs([]);
                }
             } catch (prError: any) {
                 addToast(`[DEBUG] CRITICAL Error getOpenPullRequests`, 'error', 3000);
                 logger.error(`[Fetcher Hook] CRITICAL Error during getOpenPullRequests: ${prError.message}. Proceeding with: ${branchForContentFetch}`);
                 addToast("Крит. ошибка проверки PR. Загружаю...", "error", { description: prError.message }); setOpenPrs([]);
             } finally { setLoadingPrs(false); addToast("[DEBUG] handleFetchManual: Image Task PR Check FINISH", 'info', 1000);}
        }

        // --- Fetch Execution ---
        addToast(`[DEBUG] handleFetchManual Fetching from: ${branchForContentFetch}`, 'info', 1000);
        addToast(`Запрос файлов из ветки (${branchForContentFetch})...`, 'loading', 15000, {id: 'fetch-toast'});
        addToast(`[DEBUG] Before startProgressSimulation. Type: ${typeof startProgressSimulation}`, 'info', 1000);
        startProgressSimulation(identifiedPrBranch ? 8 : 13);

        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = [];
        let primaryHighlightPathInternal: string | null = null;
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
        let filesToAutoSelect = new Set<string>();

        try {
            addToast(`[DEBUG] Before fetchRepoContents. Type: ${typeof fetchRepoContents}`, 'info', 1000);
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, branchForContentFetch);
            // ... (rest of fetch result processing logic remains the same) ...
            addToast(`[DEBUG] After fetchRepoContents. Success: ${fetchResult?.success}`, 'info', 1000);
            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true;
                fetchedFilesData = fetchResult.files;
                const allPaths = fetchedFilesData.map(f => f.path);
                logger.log(`Fetcher Hook: Fetched ${fetchedFilesData.length} files from '${branchForContentFetch}'.`);
                addToast(`[DEBUG] Fetched ${fetchedFilesData.length} files.`, 'info', 1000);

                if (currentTask) { // Image Task Path
                    addToast(`[DEBUG] Image Task Path processing`, 'info', 1000);
                    primaryHighlightPathInternal = currentTask.targetPath;
                    if (!allPaths.includes(primaryHighlightPathInternal)) {
                        addToast(`[DEBUG] ERROR: Image Task target ${primaryHighlightPathInternal} NOT FOUND!`, 'error', 5000);
                        logger.error(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} NOT FOUND in fetched files from branch ${branchForContentFetch}.`);
                        setError(`Файл (${primaryHighlightPathInternal}) не найден в ветке ${branchForContentFetch}.`);
                        addToast(`Файл (${primaryHighlightPathInternal}) не найден.`, 'error', undefined, {id: 'fetch-toast'});
                        fetchAttemptSucceeded = false;
                    } else {
                        logger.log(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} found.`);
                        addToast(`[DEBUG] Image Task target found. Auto-selecting.`, 'info', 1000);
                        addToast(`Файл для замены (${primaryHighlightPathInternal.split('/').pop()}) загружен из ${branchForContentFetch}.`, 'success', undefined, {id: 'fetch-toast'});
                        filesToAutoSelect.add(primaryHighlightPathInternal);
                    }
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };
                } else { // Standard Task Path
                    addToast(`[DEBUG] Standard Task Path processing`, 'info', 1000);
                    if (highlightedPathFromUrl) {
                        addToast(`[DEBUG] Standard Task - Processing highlights for ${highlightedPathFromUrl}`, 'info', 1000);
                        primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                        if (primaryHighlightPathInternal) {
                            const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                            if (primaryFileNode) {
                                filesToAutoSelect.add(primaryHighlightPathInternal);
                                const imports = repoUtils.extractImports(primaryFileNode.content);
                                const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                imports.forEach(imp => {
                                    const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData);
                                    if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) {
                                        const category = repoUtils.categorizeResolvedPath(resolvedPath); tempSecPathsSet[category].add(resolvedPath);
                                        if (category === 'component' || category === 'context' || category === 'hook' || category === 'lib') { filesToAutoSelect.add(resolvedPath); }
                                    }
                                });
                                secondaryHighlightPathsDataInternal = { component: Array.from(tempSecPathsSet.component), context: Array.from(tempSecPathsSet.context), hook: Array.from(tempSecPathsSet.hook), lib: Array.from(tempSecPathsSet.lib), other: Array.from(tempSecPathsSet.other) };
                            } else {
                                primaryHighlightPathInternal = null; addToast(`Ошибка: Данные для (${highlightedPathFromUrl}) не найдены.`, 'error', undefined, {id: 'fetch-toast'});
                            }
                        } else {
                           addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, 'warning', undefined, {id: 'fetch-toast'});
                        }
                        let addedImportantCount = 0; importantFiles.forEach(p => { if (allPaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); addedImportantCount++; } });
                        if (addedImportantCount > 0) logger.log(`Fetcher Hook: Auto-selected ${addedImportantCount} important files.`);
                        if (filesToAutoSelect.size > 0) {
                            const numSecondary = secondaryHighlightPathsDataInternal.component.length + secondaryHighlightPathsDataInternal.context.length + secondaryHighlightPathsDataInternal.hook.length + secondaryHighlightPathsDataInternal.lib.length;
                            const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary; let msg = `✅ Авто-выбор: `; const parts = [];
                            if (primaryHighlightPathInternal) parts.push(`1 стр.`); if (numSecondary > 0) parts.push(`${numSecondary} связ.`); if (numImportant > 0) parts.push(`${numImportant} важн.`); msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`; addToast(msg, 'success');
                        } else {
                           addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success', undefined, {id: 'fetch-toast'});
                        }
                    } else {
                        addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success', undefined, {id: 'fetch-toast'});
                        primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
                    }
                }
            } else {
                fetchAttemptSucceeded = false;
                throw new Error(fetchResult?.error || `Не удалось получить файлы из ${branchForContentFetch}.`);
            }
        } catch (err: any) {
            const displayError = err?.message || "Неизвестная ошибка при загрузке.";
            logger.error(`Fetcher Hook: Fetch Error - ${displayError}`, err);
            setError(displayError);
            addToast(`Ошибка: ${displayError}`, 'error', undefined, {id: 'fetch-toast'});
            fetchAttemptSucceeded = false;
            fetchedFilesData = []; primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
        } finally {
            addToast(`[DEBUG] handleFetchManual FINALLY block. Attempt Succeeded: ${fetchAttemptSucceeded}`, 'info', 1000);
            stopProgressSimulation();
            setFiles(fetchedFilesData);
            setPrimaryHighlightedPathState(primaryHighlightPathInternal);
            setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal);
             if (filesToAutoSelect.size > 0) {
                 setSelectedFetcherFiles(filesToAutoSelect);
             }
            handleSetFilesFetched( // Call context handler
                fetchAttemptSucceeded,
                fetchedFilesData,
                primaryHighlightPathInternal,
                Object.values(secondaryHighlightPathsDataInternal).flat()
            );
            setProgress(fetchAttemptSucceeded ? 100 : 0);
            if (currentTask && !fetchAttemptSucceeded) {
                isImageTaskFetchInitiated.current = false;
            }
            if(isSettingsModalOpen && fetchAttemptSucceeded) {
                triggerToggleSettingsModal();
            }
            addToast(`[DEBUG] handleFetchManual FINISHED`, 'info', 1000);
        }
    }, [
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        loadingPrs, assistantLoading, isParsing, aiActionLoading,
        setFetchStatus, handleSetFilesFetched,
        setSelectedFetcherFiles, setRequestCopied,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setLoadingPrs,
        setOpenPrs, setContextTargetBranch, triggerToggleSettingsModal, updateKworkInput, addToast,
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
        startProgressSimulation, stopProgressSimulation,
        logger
    ]);

    // --- Effect: Auto-Fetch (Revised - NO isMounted check) ---
    useEffect(() => {
        addToast("[DEBUG] useRepoFetcher Auto-Fetch Effect Check", 'info', 1000);
        // Check repoUrlEntered directly from props/context
        if (!repoUrlEntered) {
            addToast("[DEBUG] Auto-Fetch SKIP: no URL entered", 'info', 1000);
            return;
        }

        const currentTask = imageReplaceTask;
        const branch = targetBranchName || manualBranchName || null;

        const shouldConsiderAutoFetch = autoFetch && (!!currentTask || !!highlightedPathFromUrl || !!ideaFromUrl);
        addToast(`[DEBUG] Auto-Fetch Should Consider: ${shouldConsiderAutoFetch}`, 'info', 1000);

        if (!shouldConsiderAutoFetch) {
             return;
        }

        const timerId = setTimeout(() => {
            const currentContextStatus = fetchStatusRef.current; // Use ref
            const canTriggerFetchNow = (currentContextStatus === 'idle' || currentContextStatus === 'failed_retries' || currentContextStatus === 'error');
            addToast(`[DEBUG] Auto-Fetch Timer Fired. Can Trigger Now: ${canTriggerFetchNow}, Already Running Ref: ${isAutoFetchingRef.current}`, 'info', 1000);

            if (canTriggerFetchNow && !isAutoFetchingRef.current) {
                const mode = currentTask ? "Image Task" : "Standard";
                addToast(`[DEBUG] Auto-Fetch Triggering handleFetchManual (${mode}). Guard ON.`, 'info', 1000);
                isAutoFetchingRef.current = true;
                handleFetchManual(false, branch, currentTask)
                    .catch(err => {
                         addToast(`[DEBUG] Auto-Fetch handleFetchManual ERROR`, 'error', 3000);
                         logger.error(`[AutoFetch Effect Hook] handleFetchManual (${mode}) threw an unexpected error:`, err); })
                    .finally(() => {
                        addToast("[DEBUG] Auto-Fetch FINALLY: Resetting guard.", 'info', 1000);
                        isAutoFetchingRef.current = false;
                        const finalStatus = fetchStatusRef.current;
                        addToast(`[DEBUG] Auto-Fetch finished with status: ${finalStatus}`, 'info', 1000);
                        if (currentTask && (finalStatus === 'error' || finalStatus === 'failed_retries')) {
                             addToast(`[DEBUG] Auto-Fetch resetting image task flag due to error`, 'warning', 1000);
                             isImageTaskFetchInitiated.current = false;
                        }
                    });
            } else {
                addToast("[DEBUG] Auto-Fetch conditions inside timer NOT met or already running", 'info', 1000);
            }
        }, 500); // Keep increased delay

        return () => clearTimeout(timerId);
    }, [
        // No isMounted dependency
        repoUrlEntered, // Use direct prop/context value
        autoFetch,
        targetBranchName,
        manualBranchName,
        imageReplaceTask,
        highlightedPathFromUrl,
        ideaFromUrl,
        handleFetchManual, // Stable callback
        logger, addToast // Stable helpers
    ]);

    // --- Derived State ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (!!imageReplaceTask && isImageTaskFetchInitiated.current && isLoading);
    addToast(`[DEBUG] useRepoFetcher derived: isLoading=${isLoading}, isFetchDisabled=${isFetchDisabled}`, 'info', 1000);

    // --- Return values ---
    addToast("[DEBUG] useRepoFetcher Hook End - Returning values", 'info', 1000);
    return {
        files,
        progress,
        error,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        handleFetchManual,
        isLoading,
        isFetchDisabled,
    };
};