import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
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

    // Context access within the hook
    const {
      fetchStatus, setFetchStatus,
      // FIX: Destructure the function provided by the context correctly
      setFilesFetched, // <<< Destructure 'setFilesFetched' directly
      setSelectedFetcherFiles,
      setRequestCopied,
      setLoadingPrs, setOpenPrs, setTargetBranchName: setContextTargetBranch,
      triggerToggleSettingsModal,
      updateKworkInput,
      addToast,
      setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles
    } = useRepoXmlPageContext();

    // Internal state
    const [files, setFiles] = useState<FileNode[]>([]);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });

    // Refs
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isImageTaskFetchInitiated = useRef(false);
    const isAutoFetchingRef = useRef(false);
    const fetchStatusRef = useRef(fetchStatus);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);
    useEffect(() => { fetchStatusRef.current = fetchStatus; }, [fetchStatus]);

    // --- Progress Simulation ---
    const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
        stopProgressSimulation();
        setProgress(0);
        const ticks = estimatedDurationSeconds * 5;
        const increment = ticks > 0 ? 100 / ticks : 100;
        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                const nextProgress = prev + increment;
                if (nextProgress >= 95 || fetchStatusRef.current !== 'loading') {
                    stopProgressSimulation();
                    return Math.min(nextProgress, 95);
                }
                return nextProgress;
            });
        }, 200);
    }, [stopProgressSimulation]);

    // --- Core Fetch Logic ---
    const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null,
        taskForEarlyCheck?: ImageReplaceTask | null
    ) => {
        const initialBranchGuess = branchNameToFetchOverride || targetBranchName || manualBranchName || 'default';
        const isAutoFetchWithIdea = autoFetch && !!ideaFromUrl && !isManualRetry;
        const currentTask = taskForEarlyCheck || imageReplaceTask;

        logger.log(`Fetcher Hook: Start fetch. Retry: ${isManualRetry}, Initial Branch: ${initialBranchGuess}, Task Active: ${!!currentTask}, AutoFetchIdea: ${isAutoFetchWithIdea}`);

        // --- Guards ---
        if (currentTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) { logger.warn("Fetcher Hook: Image task fetch already running."); return; }
        if (!currentTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { logger.warn("Fetcher Hook: Standard fetch already running."); addToast("Уже идет загрузка...", "info"); return; }
        if (!repoUrl.trim()) { logger.error("Fetcher Hook: Repo URL empty."); addToast("Введите URL репозитория", 'error'); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return; }
        if (loadingPrs || assistantLoading || isParsing || aiActionLoading) { logger.warn(`Fetcher Hook: Blocked by processing state (PRs: ${loadingPrs}, Assistant: ${assistantLoading}, Parsing: ${isParsing}, AI Action: ${aiActionLoading}).`); addToast("Подождите завершения.", "warning"); return; }

        // --- Reset State ---
        logger.log("Fetcher Hook: Starting process - resetting states.");
        setFetchStatus('loading');
        setError(null);
        setFiles([]);
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        setSelectedFetcherFiles(new Set());
        if (!currentTask) {
             setRequestCopied(false);
             setAiResponseHasContent(false);
             setFilesParsed(false);
             setSelectedAssistantFiles(new Set());
             if (!isAutoFetchWithIdea) { logger.log("Fetcher Hook: Manual fetch or auto without idea. Kwork input untouched by Fetcher initially."); }
        } else {
             logger.log("Fetcher Hook: Image Task mode - setting flag, clearing kwork.");
             isImageTaskFetchInitiated.current = true;
             updateKworkInput("");
        }

        // --- Branch / PR Logic (Image Task Only) ---
        let branchForContentFetch = initialBranchGuess;
        let identifiedPrBranch = false;
        if (currentTask && !isManualRetry) {
            logger.log(`[Fetcher Hook] Image task (${currentTask.targetPath}). Checking PRs...`);
            setLoadingPrs(true);
            try {
                const prResult = await getOpenPullRequests(repoUrl);
                if (prResult.success && prResult.pullRequests) {
                    logger.log(`[Fetcher Hook] Found ${prResult.pullRequests.length} open PRs.`);
                    const expectedPrTitlePrefix = `chore: Update image`; const expectedPrFile = currentTask.targetPath;
                    const matchPr = prResult.pullRequests.find(pr => pr.title?.startsWith(expectedPrTitlePrefix) && pr.title?.includes(expectedPrFile) && pr.head?.ref);
                    if (matchPr && matchPr.head?.ref) {
                        branchForContentFetch = matchPr.head.ref; identifiedPrBranch = true;
                        setContextTargetBranch(branchForContentFetch); setOpenPrs(prResult.pullRequests as SimplePullRequest[]);
                        logger.log(`[Fetcher Hook] Found relevant PR #${matchPr.number} on branch '${branchForContentFetch}'. Fetching from this branch.`);
                        toast.info(`Найден PR #${matchPr.number}. Загружаю из ветки ${branchForContentFetch}...`);
                    } else {
                        logger.log(`[Fetcher Hook] No specific PR found for image task. Using default/manual branch: ${branchForContentFetch}`);
                        setOpenPrs(prResult.pullRequests as SimplePullRequest[]);
                    }
                } else {
                    logger.error(`[Fetcher Hook] Failed to get open PRs: ${prResult.error}. Proceeding with: ${branchForContentFetch}`);
                    toast.error("Не удалось проверить PR. Загружаю...", { description: prResult.error }); setOpenPrs([]);
                }
            } catch (prError: any) {
                logger.error(`[Fetcher Hook] CRITICAL Error during getOpenPullRequests: ${prError.message}. Proceeding with: ${branchForContentFetch}`);
                toast.error("Крит. ошибка проверки PR. Загружаю...", { description: prError.message }); setOpenPrs([]);
            } finally { setLoadingPrs(false); }
        }

        // --- Fetch Execution ---
        const effectiveBranchDisplay = branchForContentFetch;
        addToast(`Запрос файлов из ветки (${effectiveBranchDisplay})...`, 'info');
        startProgressSimulation(identifiedPrBranch ? 8 : 13);
        logger.log("Fetcher Hook: Progress simulation started.");

        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = [];
        let primaryHighlightPathInternal: string | null = null;
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
        let filesToAutoSelect = new Set<string>();

        try {
            logger.log(`Fetcher Hook: Calling fetchRepoContents: URL=${repoUrl}, Branch="${branchForContentFetch}", Token Provided: ${!!token}`);
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, branchForContentFetch);
            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true; fetchedFilesData = fetchResult.files;
                const allPaths = fetchedFilesData.map(f => f.path);
                logger.log(`Fetcher Hook: Fetched ${fetchedFilesData.length} files from '${branchForContentFetch}'.`);
                if (currentTask) {
                    primaryHighlightPathInternal = currentTask.targetPath;
                    if (!allPaths.includes(primaryHighlightPathInternal)) {
                        logger.error(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} NOT FOUND in fetched files from branch ${branchForContentFetch}.`);
                        setError(`Файл (${primaryHighlightPathInternal}) не найден в ветке ${branchForContentFetch}.`); addToast(`Файл (${primaryHighlightPathInternal}) не найден.`, 'error'); fetchAttemptSucceeded = false;
                    } else {
                        logger.log(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} found.`);
                        addToast(`Файл для замены (${primaryHighlightPathInternal.split('/').pop()}) загружен из ${branchForContentFetch}.`, 'success'); filesToAutoSelect.add(primaryHighlightPathInternal);
                    }
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };
                } else {
                    if (highlightedPathFromUrl) {
                        logger.log(`Fetcher Hook: Standard Task - Processing highlights for URL param: ${highlightedPathFromUrl}`);
                        primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                        if (primaryHighlightPathInternal) {
                            const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                            if (primaryFileNode) {
                                logger.log(`Fetcher Hook: Primary file located: ${primaryHighlightPathInternal}`); filesToAutoSelect.add(primaryHighlightPathInternal);
                                const imports = repoUtils.extractImports(primaryFileNode.content); logger.log(`Fetcher Hook: Found ${imports.length} imports in primary file.`);
                                const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                imports.forEach(imp => {
                                    const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData);
                                    if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) {
                                        const category = repoUtils.categorizeResolvedPath(resolvedPath); tempSecPathsSet[category].add(resolvedPath);
                                        if (category === 'component' || category === 'context' || category === 'hook' || category === 'lib') { filesToAutoSelect.add(resolvedPath); }
                                    }
                                });
                                secondaryHighlightPathsDataInternal = { component: Array.from(tempSecPathsSet.component), context: Array.from(tempSecPathsSet.context), hook: Array.from(tempSecPathsSet.hook), lib: Array.from(tempSecPathsSet.lib), other: Array.from(tempSecPathsSet.other) };
                            } else { logger.warn(`Fetcher Hook: Primary path ${primaryHighlightPathInternal} resolved but node not found in fetched data.`); primaryHighlightPathInternal = null; addToast(`Ошибка: Данные для (${primaryHighlightPathInternal}) не найдены.`, 'error'); }
                        } else { logger.warn(`Fetcher Hook: Page file path for URL (${highlightedPathFromUrl}) not found among fetched files.`); addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, 'warning'); }
                        logger.log(`Fetcher Hook: Checking ${importantFiles.length} important files.`); let addedImportantCount = 0;
                        importantFiles.forEach(p => { if (allPaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); addedImportantCount++; } });
                        if (addedImportantCount > 0) logger.log(`Fetcher Hook: Auto-selected ${addedImportantCount} important files.`);
                        if (filesToAutoSelect.size > 0) {
                            const numSecondary = secondaryHighlightPathsDataInternal.component.length + secondaryHighlightPathsDataInternal.context.length + secondaryHighlightPathsDataInternal.hook.length + secondaryHighlightPathsDataInternal.lib.length;
                            const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary; let msg = `✅ Авто-выбор: `; const parts = [];
                            if (primaryHighlightPathInternal) parts.push(`1 стр.`); if (numSecondary > 0) parts.push(`${numSecondary} связ.`); if (numImportant > 0) parts.push(`${numImportant} важн.`); msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`; addToast(msg, 'success');
                        }
                    } else {
                        logger.log("Fetcher Hook: Standard Task - No URL params, basic fetch completed."); addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success');
                        primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
                    }
                }
            } else { fetchAttemptSucceeded = false; throw new Error(fetchResult?.error || `Не удалось получить файлы из ${branchForContentFetch}.`); }
        } catch (err: any) {
            const displayError = err?.message || "Неизвестная ошибка при загрузке."; logger.error(`Fetcher Hook: Fetch Error - ${displayError}`, err);
            setError(displayError); addToast(`Ошибка: ${displayError}`, 'error'); fetchAttemptSucceeded = false;
            fetchedFilesData = []; primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
        } finally {
            stopProgressSimulation();
            const overallSuccess = fetchAttemptSucceeded;
            setFiles(fetchedFilesData);
            setPrimaryHighlightedPathState(primaryHighlightPathInternal);
            setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal);
             if (filesToAutoSelect.size > 0) {
                 logger.log(`Fetcher Hook: Updating context selection with ${filesToAutoSelect.size} auto-selected files.`);
                 setSelectedFetcherFiles(filesToAutoSelect);
             }
            // FIX: Call the correctly destructured function
            setFilesFetched( // <<< Use 'setFilesFetched' here
                overallSuccess,
                fetchedFilesData,
                primaryHighlightPathInternal,
                Object.values(secondaryHighlightPathsDataInternal).flat()
            );
            setProgress(overallSuccess ? 100 : 0);
            setFetchStatus(overallSuccess ? 'success' : 'error');
            if (currentTask && !overallSuccess) { logger.log("Fetcher Hook: Resetting image task initiated flag due to fetch failure."); isImageTaskFetchInitiated.current = false; }
            if(isSettingsModalOpen) { triggerToggleSettingsModal(); } // Close modal regardless of success/fail?
            logger.log(`Fetcher Hook: Finished. Success: ${overallSuccess}, Branch Fetched: ${branchForContentFetch}`);
        }
    }, [
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        loadingPrs, assistantLoading, isParsing, aiActionLoading,
        setFetchStatus, setFilesFetched, // <<< Use 'setFilesFetched' in dependencies
        setSelectedFetcherFiles, setRequestCopied,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setLoadingPrs,
        setOpenPrs, setContextTargetBranch, triggerToggleSettingsModal, updateKworkInput, addToast,
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
        startProgressSimulation, stopProgressSimulation,
        logger
    ]);

    // --- Effect: Auto-Fetch ---
    useEffect(() => {
        if (!isMounted || !repoUrlEntered) return;
        const currentTask = imageReplaceTask;
        const branch = targetBranchName || manualBranchName || null;
        const canTriggerFetch = autoFetch && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error');
        const isImageFetchReady = currentTask && !isImageTaskFetchInitiated.current;
        const isStandardFetchReady = !currentTask && autoFetch;
        if (canTriggerFetch && !isAutoFetchingRef.current && (isImageFetchReady || isStandardFetchReady)) {
            const mode = currentTask ? "Image Task" : "Standard";
            logger.log(`[AutoFetch Effect Hook] Triggering fetch (${mode}). Guard ON. Task: ${currentTask?.targetPath ?? 'N/A'}`);
            isAutoFetchingRef.current = true;
            handleFetchManual(false, branch, currentTask)
                .catch(err => { logger.error(`[AutoFetch Effect Hook] handleFetchManual (${mode}) threw an unexpected error:`, err); })
                .finally(() => {
                    logger.log("[AutoFetch Effect Hook] Resetting fetch guard."); isAutoFetchingRef.current = false;
                    const finalStatus = fetchStatusRef.current; logger.log(`[AutoFetch Effect Hook] Fetch attempt finished with status: ${finalStatus}`);
                    if (currentTask && (finalStatus === 'error' || finalStatus === 'failed_retries')) { logger.log(`[AutoFetch Effect Hook] Resetting image task initiated flag due to final status: ${finalStatus}.`); isImageTaskFetchInitiated.current = false; }
                });
        }
    }, [
        isMounted, repoUrlEntered, autoFetch, targetBranchName, manualBranchName,
        imageReplaceTask, fetchStatus,
        handleFetchManual,
        logger
    ]);

    // --- Cleanup Effect ---
    useEffect(() => { return () => { stopProgressSimulation(); }; }, [stopProgressSimulation]);

    // --- Derived State ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (!!imageReplaceTask && isImageTaskFetchInitiated.current && isLoading);

    // --- Return values ---
    return {
        files, progress, error, primaryHighlightedPath, secondaryHighlightedPaths,
        handleFetchManual, isLoading, isFetchDisabled,
    };
};