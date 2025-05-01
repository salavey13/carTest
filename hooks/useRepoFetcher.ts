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
      setLoadingPrs, setOpenPrs, setTargetBranchName: setContextTargetBranch,
      triggerToggleSettingsModal,
      updateKworkInput,
      addToast, // Use context's toast wrapper
      setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
      // allFetchedFiles // Not needed directly here
    } = useRepoXmlPageContext();

    // --- VIBE CHECK ---
    addToast("[DEBUG] useRepoFetcher Hook Start", 'info', 1000);
    // --- VIBE CHECK END ---

    // Internal state for this fetcher instance
    addToast("[DEBUG] Before useRepoFetcher useState", 'info', 1000);
    const [files, setFiles] = useState<FileNode[]>([]); // Files fetched by *this* instance
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
    addToast("[DEBUG] After useRepoFetcher useState", 'info', 1000);

    // Refs
    addToast("[DEBUG] Before useRepoFetcher useRef", 'info', 1000);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isImageTaskFetchInitiated = useRef(false);
    const isAutoFetchingRef = useRef(false);
    const fetchStatusRef = useRef(fetchStatus); // Track fetch status for interval cleanup
    const [isMounted, setIsMounted] = useState(false);
    addToast("[DEBUG] After useRepoFetcher useRef/useState", 'info', 1000);

    useEffect(() => { setIsMounted(true); addToast("[DEBUG] useRepoFetcher Mounted", 'info', 1000); }, [addToast]);
    useEffect(() => { fetchStatusRef.current = fetchStatus; }, [fetchStatus]);

    // --- Progress Simulation ---
    const stopProgressSimulation = useCallback(() => {
        // addToast("[DEBUG] stopProgressSimulation called", 'info', 500); // Likely too noisy
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []); // Stable

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
                    addToast("[DEBUG] Progress Interval: Reached >= 95%, stopping.", 'info', 500);
                    stopProgressSimulation();
                    return 95;
                }
                return nextProgress;
            });
        }, 200);
    }, [stopProgressSimulation, addToast]); // Add addToast

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
        if (loadingPrs || assistantLoading || isParsing || aiActionLoading) {
            addToast("[DEBUG] handleFetchManual SKIP: Blocked by other process", 'warning', 1000);
            logger.warn(`Fetcher Hook: Blocked by processing state (PRs: ${loadingPrs}, Assistant: ${assistantLoading}, Parsing: ${isParsing}, AI Action: ${aiActionLoading}).`); addToast("Подождите завершения.", "warning"); return;
        }

        // --- Reset State ---
        addToast("[DEBUG] handleFetchManual Resetting State", 'info', 1000);
        // --- VIBE FIX: Delay the status update ---
        setTimeout(() => {
            addToast("[DEBUG] handleFetchManual Setting fetchStatus to 'loading' (delayed)", 'info', 1000);
            setFetchStatus('loading');
        }, 0);
        // --- END VIBE FIX ---
        setError(null);
        setFiles([]);
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        setSelectedFetcherFiles(new Set());
        // Only reset these if NOT an image task
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
             updateKworkInput(""); // Clear kwork for image task
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
                 addToast(`[DEBUG] After getOpenPullRequests. Success: ${prResult.success}`, 'info', 1000);
                 if (prResult.success && prResult.pullRequests) {
                    logger.log(`[Fetcher Hook] Found ${prResult.pullRequests.length} open PRs.`);
                    const expectedPrTitlePrefix = `chore: Update image`; const expectedPrFile = currentTask.targetPath;
                    const matchPr = prResult.pullRequests.find(pr => pr.title?.startsWith(expectedPrTitlePrefix) && pr.title?.includes(expectedPrFile) && pr.head?.ref);
                    if (matchPr?.head?.ref) { // Check ref exists
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
            addToast(`[DEBUG] After fetchRepoContents. Success: ${fetchResult?.success}`, 'info', 1000);

            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true; // Mark success early
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
                        fetchAttemptSucceeded = false; // OVERRIDE success if target missing
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
                        addToast(`[DEBUG] Before repoUtils.getPageFilePath. Type: ${typeof repoUtils.getPageFilePath}`, 'info', 1000);
                        primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                        addToast(`[DEBUG] Primary Path resolved: ${primaryHighlightPathInternal}`, 'info', 1000);
                        if (primaryHighlightPathInternal) {
                            const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                            if (primaryFileNode) {
                                filesToAutoSelect.add(primaryHighlightPathInternal);
                                addToast(`[DEBUG] Before repoUtils.extractImports. Type: ${typeof repoUtils.extractImports}`, 'info', 1000);
                                const imports = repoUtils.extractImports(primaryFileNode.content);
                                const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                addToast(`[DEBUG] Before repoUtils.resolveImportPath/categorize loop (${imports.length} imports). Types: ${typeof repoUtils.resolveImportPath}, ${typeof repoUtils.categorizeResolvedPath}`, 'info', 1000);
                                imports.forEach(imp => {
                                    const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData);
                                    if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) {
                                        const category = repoUtils.categorizeResolvedPath(resolvedPath); tempSecPathsSet[category].add(resolvedPath);
                                        if (category === 'component' || category === 'context' || category === 'hook' || category === 'lib') { filesToAutoSelect.add(resolvedPath); }
                                    }
                                });
                                secondaryHighlightPathsDataInternal = { component: Array.from(tempSecPathsSet.component), context: Array.from(tempSecPathsSet.context), hook: Array.from(tempSecPathsSet.hook), lib: Array.from(tempSecPathsSet.lib), other: Array.from(tempSecPathsSet.other) };
                                addToast(`[DEBUG] Secondary paths calculated. Comp: ${secondaryHighlightPathsDataInternal.component.length}, Ctx: ${secondaryHighlightPathsDataInternal.context.length}, Hook: ${secondaryHighlightPathsDataInternal.hook.length}, Lib: ${secondaryHighlightPathsDataInternal.lib.length}`, 'info', 1000);
                            } else {
                                addToast(`[DEBUG] WARN: Primary path ${primaryHighlightPathInternal} not found in fetched data`, 'warning', 2000);
                                logger.warn(`Fetcher Hook: Primary path ${primaryHighlightPathInternal} resolved but node not found in fetched data.`); primaryHighlightPathInternal = null; addToast(`Ошибка: Данные для (${primaryHighlightPathInternal}) не найдены.`, 'error', undefined, {id: 'fetch-toast'});
                            }
                        } else {
                           addToast(`[DEBUG] WARN: Page file for URL ${highlightedPathFromUrl} not found`, 'warning', 2000);
                           logger.warn(`Fetcher Hook: Page file path for URL (${highlightedPathFromUrl}) not found among fetched files.`); addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, 'warning', undefined, {id: 'fetch-toast'});
                        }
                        addToast(`[DEBUG] Checking important files. Count: ${importantFiles.length}`, 'info', 1000);
                        let addedImportantCount = 0; importantFiles.forEach(p => { if (allPaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); addedImportantCount++; } });
                        if (addedImportantCount > 0) { addToast(`[DEBUG] Auto-selected ${addedImportantCount} important files`, 'info', 1000); logger.log(`Fetcher Hook: Auto-selected ${addedImportantCount} important files.`);}
                        if (filesToAutoSelect.size > 0) {
                            const numSecondary = secondaryHighlightPathsDataInternal.component.length + secondaryHighlightPathsDataInternal.context.length + secondaryHighlightPathsDataInternal.hook.length + secondaryHighlightPathsDataInternal.lib.length;
                            const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary; let msg = `✅ Авто-выбор: `; const parts = [];
                            if (primaryHighlightPathInternal) parts.push(`1 стр.`); if (numSecondary > 0) parts.push(`${numSecondary} связ.`); if (numImportant > 0) parts.push(`${numImportant} важн.`); msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`; addToast(msg, 'success');
                        } else {
                           addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success', undefined, {id: 'fetch-toast'});
                        }
                    } else {
                        addToast(`[DEBUG] Standard Task - No URL params, basic fetch completed.`, 'info', 1000);
                        addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success', undefined, {id: 'fetch-toast'});
                        primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
                    }
                }
            } else {
                addToast(`[DEBUG] fetchRepoContents failed. Error: ${fetchResult?.error}`, 'error', 3000);
                fetchAttemptSucceeded = false;
                throw new Error(fetchResult?.error || `Не удалось получить файлы из ${branchForContentFetch}.`);
            }
        } catch (err: any) {
            addToast(`[DEBUG] fetchRepoContents CATCH block: ${err?.message}`, 'error', 3000);
            const displayError = err?.message || "Неизвестная ошибка при загрузке.";
            logger.error(`Fetcher Hook: Fetch Error - ${displayError}`, err);
            setError(displayError);
            addToast(`Ошибка: ${displayError}`, 'error', undefined, {id: 'fetch-toast'});
            fetchAttemptSucceeded = false; // Ensure marked as failed
            fetchedFilesData = []; primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
        } finally {
            addToast(`[DEBUG] handleFetchManual FINALLY block. Attempt Succeeded: ${fetchAttemptSucceeded}`, 'info', 1000);
            addToast(`[DEBUG] Before stopProgressSimulation. Type: ${typeof stopProgressSimulation}`, 'info', 1000);
            stopProgressSimulation();
            setFiles(fetchedFilesData);
            setPrimaryHighlightedPathState(primaryHighlightPathInternal);
            setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal);
             if (filesToAutoSelect.size > 0) {
                 addToast(`[DEBUG] Updating context selection: ${filesToAutoSelect.size} files`, 'info', 1000);
                 setSelectedFetcherFiles(filesToAutoSelect);
             }
            addToast(`[DEBUG] Before handleSetFilesFetched. Type: ${typeof handleSetFilesFetched}`, 'info', 1000);
            handleSetFilesFetched( // Call context handler to update global state and potentially trigger image processing
                fetchAttemptSucceeded,
                fetchedFilesData,
                primaryHighlightPathInternal,
                Object.values(secondaryHighlightPathsDataInternal).flat()
            );
            addToast(`[DEBUG] After handleSetFilesFetched`, 'info', 1000);
            setProgress(fetchAttemptSucceeded ? 100 : 0);
            if (currentTask && !fetchAttemptSucceeded) {
                addToast("[DEBUG] handleFetchManual: Resetting image task flag due to fetch failure", 'warning', 1000);
                isImageTaskFetchInitiated.current = false;
            }
            if(isSettingsModalOpen) { triggerToggleSettingsModal(); }
            addToast(`[DEBUG] handleFetchManual FINISHED`, 'info', 1000);
        }
    }, [
        // Full list of dependencies - MAKE SURE THEY ARE ALL LISTED
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        loadingPrs, assistantLoading, isParsing, aiActionLoading,
        setFetchStatus, handleSetFilesFetched,
        setSelectedFetcherFiles, setRequestCopied,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setLoadingPrs,
        setOpenPrs, setContextTargetBranch, triggerToggleSettingsModal, updateKworkInput, addToast,
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
        startProgressSimulation, stopProgressSimulation,
        logger // Assuming logger is stable
    ]);

    // --- Effect: Auto-Fetch ---
    useEffect(() => {
        addToast("[DEBUG] useRepoFetcher Auto-Fetch Effect Check", 'info', 1000);
        if (!isMounted || !repoUrlEntered) { addToast("[DEBUG] Auto-Fetch SKIP: Not mounted or no URL", 'info', 1000); return; }
        const currentTask = imageReplaceTask;
        const branch = targetBranchName || manualBranchName || null;
        const canTriggerFetch = autoFetch && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error');
        const isImageFetchReady = currentTask && !isImageTaskFetchInitiated.current;
        const isStandardFetchReady = !currentTask && autoFetch;
        addToast(`[DEBUG] Auto-Fetch Check: canTrigger=${canTriggerFetch}, isAutoFetchingRef=${isAutoFetchingRef.current}, isImageReady=${isImageFetchReady}, isStandardReady=${isStandardFetchReady}`, 'info', 1000);

        const timerId = setTimeout(() => {
            if (canTriggerFetch && !isAutoFetchingRef.current && (isImageFetchReady || isStandardFetchReady)) {
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
            } else { addToast("[DEBUG] Auto-Fetch conditions NOT met or already running", 'info', 1000); }
        }, 100); // 100ms delay

        return () => clearTimeout(timerId);
    }, [
        isMounted, repoUrlEntered, autoFetch, targetBranchName, manualBranchName,
        imageReplaceTask, fetchStatus, // React to context status
        handleFetchManual, // Stable callback
        logger, addToast // Stable helpers
    ]);

    // --- Cleanup Effect ---
    useEffect(() => {
         return () => {
             addToast("[DEBUG] useRepoFetcher Unmount Cleanup - Stopping Progress", 'info', 1000);
             stopProgressSimulation();
         };
    }, [stopProgressSimulation, addToast]); // Add addToast

    // --- Derived State ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (!!imageReplaceTask && isImageTaskFetchInitiated.current && isLoading);
    addToast(`[DEBUG] useRepoFetcher derived: isLoading=${isLoading}, isFetchDisabled=${isFetchDisabled}`, 'info', 1000);

    // --- Return values ---
    addToast("[DEBUG] useRepoFetcher Hook End - Returning values", 'info', 1000);
    return {
        files, // Return local files state for FileList display
        progress,
        error, // Return local error state
        primaryHighlightedPath, // Return local highlight state
        secondaryHighlightedPaths, // Return local highlight state
        handleFetchManual, // Expose manual fetch trigger
        isLoading: fetchStatus === 'loading' || fetchStatus === 'retrying', // Derive isLoading from context status
        isFetchDisabled, // Expose derived disabled state
    };
};