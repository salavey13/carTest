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
    loadingPrs: boolean; // Prop needed for guards and disabled state calculation
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
    // Destructure loadingPrs from props
    loadingPrs,
    assistantLoading,
    isParsing,
    aiActionLoading,
}: UseRepoFetcherProps): UseRepoFetcherReturn => {

    // Context access within the hook (for setters mostly)
    const {
      fetchStatus, setFetchStatus, setFilesFetched: setFilesFetchedCombined,
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
    useEffect(() => { fetchStatusRef.current = fetchStatus; }, [fetchStatus]); // Keep ref sync'd

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
        const ticks = estimatedDurationSeconds * 5; // 5 ticks per second
        const increment = ticks > 0 ? 100 / ticks : 100; // Avoid division by zero
        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                const nextProgress = prev + increment;
                // Check fetch status via ref to avoid stale closure issues
                if (nextProgress >= 95 || fetchStatusRef.current !== 'loading') {
                    stopProgressSimulation(); // Stop if near 100 or status changes
                    return Math.min(nextProgress, 95); // Cap at 95
                }
                return nextProgress;
            });
        }, 200); // 200ms interval
    }, [stopProgressSimulation]);

    // --- Core Fetch Logic ---
    const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null,
        taskForEarlyCheck?: ImageReplaceTask | null // Allows passing task during initial auto-fetch check
    ) => {
        // Determine branch and task context
        const initialBranchGuess = branchNameToFetchOverride || targetBranchName || manualBranchName || 'default';
        const isAutoFetchWithIdea = autoFetch && !!ideaFromUrl && !isManualRetry;
        const currentTask = taskForEarlyCheck || imageReplaceTask; // Use passed task or context task

        logger.log(`Fetcher Hook: Start fetch. Retry: ${isManualRetry}, Initial Branch: ${initialBranchGuess}, Task Active: ${!!currentTask}, AutoFetchIdea: ${isAutoFetchWithIdea}`);

        // --- Guards ---
        if (currentTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) {
            logger.warn("Fetcher Hook: Image task fetch already running."); return;
        }
        if (!currentTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) {
            logger.warn("Fetcher Hook: Standard fetch already running."); addToast("Уже идет загрузка...", "info"); return;
        }
        if (!repoUrl.trim()) {
            logger.error("Fetcher Hook: Repo URL empty."); addToast("Введите URL репозитория", 'error'); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return;
        }
        // Use loadingPrs prop in guard
        if (loadingPrs || assistantLoading || isParsing || aiActionLoading) {
            logger.warn(`Fetcher Hook: Blocked by processing state (PRs: ${loadingPrs}, Assistant: ${assistantLoading}, Parsing: ${isParsing}, AI Action: ${aiActionLoading}).`); addToast("Подождите завершения.", "warning"); return;
        }

        // --- Reset State ---
        logger.log("Fetcher Hook: Starting process - resetting states.");
        setFetchStatus('loading');
        setError(null);
        setFiles([]); // Clear local files
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        setSelectedFetcherFiles(new Set()); // Reset context selection

        if (!currentTask) {
            // Reset states relevant only to standard (non-image) tasks if needed
             setRequestCopied(false);
             setAiResponseHasContent(false); // Reset AI response flag
             setFilesParsed(false); // Reset parsing flag
             setSelectedAssistantFiles(new Set()); // Reset AI selection
             // Note: Kwork input is generally *not* cleared on standard fetch unless specifically desired
             if (!isAutoFetchWithIdea) { logger.log("Fetcher Hook: Manual fetch or auto without idea. Kwork input untouched by Fetcher initially."); }
        } else {
             // Prepare for image task fetch
             logger.log("Fetcher Hook: Image Task mode - setting flag, clearing kwork.");
             isImageTaskFetchInitiated.current = true;
             updateKworkInput(""); // Clear kwork input specifically for image task flow
        }

        // --- Branch / PR Logic (Image Task Only) ---
        let branchForContentFetch = initialBranchGuess;
        let identifiedPrBranch = false;

        if (currentTask && !isManualRetry) { // Only check for PRs on the *initial* fetch of an image task
            logger.log(`[Fetcher Hook] Image task (${currentTask.targetPath}). Checking PRs...`);
            setLoadingPrs(true); // Use context setter
            try {
                const prResult = await getOpenPullRequests(repoUrl); // Assumes token is handled within action if needed
                if (prResult.success && prResult.pullRequests) {
                    logger.log(`[Fetcher Hook] Found ${prResult.pullRequests.length} open PRs.`);
                    const expectedPrTitlePrefix = `chore: Update image`;
                    const expectedPrFile = currentTask.targetPath;
                    // Find PR matching title prefix, containing target file path, and having a head ref
                    const matchPr = prResult.pullRequests.find(pr =>
                        pr.title?.startsWith(expectedPrTitlePrefix) &&
                        pr.title?.includes(expectedPrFile) &&
                        pr.head?.ref
                    );
                    if (matchPr && matchPr.head?.ref) {
                        branchForContentFetch = matchPr.head.ref;
                        identifiedPrBranch = true;
                        setContextTargetBranch(branchForContentFetch); // Update context state
                        setOpenPrs(prResult.pullRequests as SimplePullRequest[]); // Update context PR list
                        logger.log(`[Fetcher Hook] Found relevant PR #${matchPr.number} on branch '${branchForContentFetch}'. Fetching from this branch.`);
                        toast.info(`Найден PR #${matchPr.number}. Загружаю из ветки ${branchForContentFetch}...`);
                    } else {
                        logger.log(`[Fetcher Hook] No specific PR found for image task. Using default/manual branch: ${branchForContentFetch}`);
                        setOpenPrs(prResult.pullRequests as SimplePullRequest[]); // Still update PR list
                    }
                } else {
                    logger.error(`[Fetcher Hook] Failed to get open PRs: ${prResult.error}. Proceeding with: ${branchForContentFetch}`);
                    toast.error("Не удалось проверить PR. Загружаю...", { description: prResult.error });
                    setOpenPrs([]); // Clear PRs on error
                }
            } catch (prError: any) {
                logger.error(`[Fetcher Hook] CRITICAL Error during getOpenPullRequests: ${prError.message}. Proceeding with: ${branchForContentFetch}`);
                toast.error("Крит. ошибка проверки PR. Загружаю...", { description: prError.message });
                setOpenPrs([]); // Clear PRs on error
            } finally {
                setLoadingPrs(false); // Use context setter
            }
        }

        // --- Fetch Execution ---
        const effectiveBranchDisplay = branchForContentFetch; // Branch name used in the fetch call
        addToast(`Запрос файлов из ветки (${effectiveBranchDisplay})...`, 'info');
        startProgressSimulation(identifiedPrBranch ? 8 : 13); // Shorter duration if PR was found (likely cached)
        logger.log("Fetcher Hook: Progress simulation started.");

        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = []; // Store result temporarily
        let primaryHighlightPathInternal: string | null = null; // Store result temporarily
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []}; // Store result temporarily
        let filesToAutoSelect = new Set<string>(); // Store result temporarily

        try {
            logger.log(`Fetcher Hook: Calling fetchRepoContents: URL=${repoUrl}, Branch="${branchForContentFetch}", Token Provided: ${!!token}`);
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, branchForContentFetch);

            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true;
                fetchedFilesData = fetchResult.files;
                const allPaths = fetchedFilesData.map(f => f.path); // Get paths from *this* fetch result
                logger.log(`Fetcher Hook: Fetched ${fetchedFilesData.length} files from '${branchForContentFetch}'.`);
                // DO NOT update hook's 'files' state yet, do it in finally after all processing

                // --- Post-Fetch Processing (Highlights, Auto-Selection) ---
                if (currentTask) {
                    // --- Image Task Post-Fetch ---
                    primaryHighlightPathInternal = currentTask.targetPath;
                    if (!allPaths.includes(primaryHighlightPathInternal)) {
                        logger.error(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} NOT FOUND in fetched files from branch ${branchForContentFetch}.`);
                        setError(`Файл (${primaryHighlightPathInternal}) не найден в ветке ${branchForContentFetch}.`);
                        addToast(`Файл (${primaryHighlightPathInternal}) не найден.`, 'error');
                        fetchAttemptSucceeded = false; // Mark fetch as failed if essential file is missing
                    } else {
                        logger.log(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} found.`);
                        addToast(`Файл для замены (${primaryHighlightPathInternal.split('/').pop()}) загружен из ${branchForContentFetch}.`, 'success');
                        filesToAutoSelect.add(primaryHighlightPathInternal);
                    }
                    // No secondary highlights for image tasks
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };

                } else {
                    // --- Standard Task Post-Fetch ---
                    if (highlightedPathFromUrl) {
                         logger.log(`Fetcher Hook: Standard Task - Processing highlights for URL param: ${highlightedPathFromUrl}`);
                         // Use repoUtils to resolve the URL path to a file path
                         primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);

                         if (primaryHighlightPathInternal) {
                             const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                             if (primaryFileNode) {
                                 logger.log(`Fetcher Hook: Primary file located: ${primaryHighlightPathInternal}`);
                                 filesToAutoSelect.add(primaryHighlightPathInternal);
                                 // Extract imports using repoUtils
                                 const imports = repoUtils.extractImports(primaryFileNode.content);
                                 logger.log(`Fetcher Hook: Found ${imports.length} imports in primary file.`);
                                 const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                 imports.forEach(imp => {
                                     // Resolve imports using repoUtils
                                     const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData);
                                     if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) { // Check resolved path exists
                                         // Categorize using repoUtils
                                         const category = repoUtils.categorizeResolvedPath(resolvedPath);
                                         tempSecPathsSet[category].add(resolvedPath);
                                         // Auto-select specific categories (adjust as needed)
                                         if (category === 'component' || category === 'context' || category === 'hook' || category === 'lib') {
                                             filesToAutoSelect.add(resolvedPath);
                                         }
                                     }
                                 });
                                  // Convert sets to arrays for state
                                 secondaryHighlightPathsDataInternal = {
                                     component: Array.from(tempSecPathsSet.component), context: Array.from(tempSecPathsSet.context),
                                     hook: Array.from(tempSecPathsSet.hook), lib: Array.from(tempSecPathsSet.lib), other: Array.from(tempSecPathsSet.other)
                                 };

                             } else {
                                 logger.warn(`Fetcher Hook: Primary path ${primaryHighlightPathInternal} resolved but node not found in fetched data.`);
                                 primaryHighlightPathInternal = null; // Reset if data inconsistent
                                 addToast(`Ошибка: Данные для (${primaryHighlightPathInternal}) не найдены.`, 'error');
                             }
                         } else {
                              logger.warn(`Fetcher Hook: Page file path for URL (${highlightedPathFromUrl}) not found among fetched files.`);
                              addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, 'warning');
                         }

                         // Add important files (only if they exist in the fetched data)
                         logger.log(`Fetcher Hook: Checking ${importantFiles.length} important files.`);
                         let addedImportantCount = 0;
                         importantFiles.forEach(p => {
                             if (allPaths.includes(p) && !filesToAutoSelect.has(p)) {
                                 filesToAutoSelect.add(p);
                                 addedImportantCount++;
                             }
                         });
                         if (addedImportantCount > 0) logger.log(`Fetcher Hook: Auto-selected ${addedImportantCount} important files.`);

                         // Toast for auto-selection results
                         if (filesToAutoSelect.size > 0) {
                             const numSecondary = secondaryHighlightPathsDataInternal.component.length + secondaryHighlightPathsDataInternal.context.length + secondaryHighlightPathsDataInternal.hook.length + secondaryHighlightPathsDataInternal.lib.length;
                             const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary;
                             let msg = `✅ Авто-выбор: `;
                             const parts = [];
                             if (primaryHighlightPathInternal) parts.push(`1 стр.`);
                             if (numSecondary > 0) parts.push(`${numSecondary} связ.`);
                             // Only mention important if they were actually added AND not already covered by primary/secondary
                             if (numImportant > 0) parts.push(`${numImportant} важн.`);
                             msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`;
                             addToast(msg, 'success');
                         }

                    } else {
                         // Standard fetch without URL params -> No automatic highlights/selections
                         logger.log("Fetcher Hook: Standard Task - No URL params, basic fetch completed.");
                         addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success');
                         primaryHighlightPathInternal = null;
                         secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };
                         filesToAutoSelect = new Set();
                    }
                }

            } else {
                // Fetch failed or returned unexpected data
                fetchAttemptSucceeded = false;
                throw new Error(fetchResult?.error || `Не удалось получить файлы из ${branchForContentFetch}.`);
            }
        } catch (err: any) {
            const displayError = err?.message || "Неизвестная ошибка при загрузке.";
            logger.error(`Fetcher Hook: Fetch Error - ${displayError}`, err);
            setError(displayError);
            addToast(`Ошибка: ${displayError}`, 'error');
            fetchAttemptSucceeded = false;
            // Ensure states are cleared on error
            fetchedFilesData = [];
            primaryHighlightPathInternal = null;
            secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };
            filesToAutoSelect = new Set();
        } finally {
            stopProgressSimulation(); // Ensure progress stops regardless of outcome
            const overallSuccess = fetchAttemptSucceeded;

            // --- Update State AFTER processing ---
            setFiles(fetchedFilesData); // Update hook's internal file list
            setPrimaryHighlightedPathState(primaryHighlightPathInternal); // Update hook's primary highlight state
            setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal); // Update hook's secondary highlight state
             if (filesToAutoSelect.size > 0) {
                 logger.log(`Fetcher Hook: Updating context selection with ${filesToAutoSelect.size} auto-selected files.`);
                 setSelectedFetcherFiles(filesToAutoSelect); // Update context selection state
             }

            // Update combined context state about fetch outcome
            setFilesFetchedCombined(
                overallSuccess,
                fetchedFilesData, // Pass the data that was actually fetched (or empty array on failure)
                primaryHighlightPathInternal, // Pass the determined primary path (or null)
                Object.values(secondaryHighlightPathsDataInternal).flat() // Pass flat list of secondary paths
            );
            setProgress(overallSuccess ? 100 : 0); // Final progress update
            setFetchStatus(overallSuccess ? 'success' : 'error'); // Update context status

            // Reset image task flag ONLY if the fetch for it failed
            if (currentTask && !overallSuccess) {
                logger.log("Fetcher Hook: Resetting image task initiated flag due to fetch failure.");
                isImageTaskFetchInitiated.current = false;
            }
            // Close settings modal if it was open during fetch (always close after attempt)
            if(isSettingsModalOpen) {
                 triggerToggleSettingsModal();
            }
            logger.log(`Fetcher Hook: Finished. Success: ${overallSuccess}, Branch Fetched: ${branchForContentFetch}`);
        }
    // --- useCallback Dependency Array ---
    }, [
        // Hook props/args:
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        // Context states/setters/actions used directly:
        loadingPrs, // Include prop in dependency array as it's used in guards
        assistantLoading, isParsing, aiActionLoading, // Guards
        setFetchStatus, setFilesFetchedCombined, setSelectedFetcherFiles, setRequestCopied,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setLoadingPrs,
        setOpenPrs, setContextTargetBranch, triggerToggleSettingsModal, updateKworkInput, addToast,
        // Hook's own setters/helpers:
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
        startProgressSimulation, stopProgressSimulation,
        // Logger (if needed as dependency, though often global):
        logger
    ]);

    // --- Effect: Auto-Fetch ---
    useEffect(() => {
        if (!isMounted || !repoUrlEntered) return; // Ensure mounted and repo URL is set

        const currentTask = imageReplaceTask;
        // Use context branch names as source of truth for the *trigger condition*
        const branch = targetBranchName || manualBranchName || null;
        // Check context fetchStatus to see if fetch *should* be triggered
        const canTriggerFetch = autoFetch && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error');
        // Specific conditions for image vs standard auto-fetch
        const isImageFetchReady = currentTask && !isImageTaskFetchInitiated.current; // Only trigger if flag is not set
        const isStandardFetchReady = !currentTask && autoFetch; // Standard relies only on autoFetch prop

        if (canTriggerFetch && !isAutoFetchingRef.current && (isImageFetchReady || isStandardFetchReady)) {
            const mode = currentTask ? "Image Task" : "Standard";
            logger.log(`[AutoFetch Effect Hook] Triggering fetch (${mode}). Guard ON. Task: ${currentTask?.targetPath ?? 'N/A'}`);
            isAutoFetchingRef.current = true; // Set guard

            // Call the fetch function defined within the hook
            // Pass the current task so handleFetchManual knows the context immediately
            handleFetchManual(false, branch, currentTask)
                .catch(err => {
                    // Errors are handled internally by handleFetchManual, just log extra context if needed
                    logger.error(`[AutoFetch Effect Hook] handleFetchManual (${mode}) threw an unexpected error:`, err);
                })
                .finally(() => {
                    // Reset guard *immediately* after the fetch attempt completes (success or fail)
                    logger.log("[AutoFetch Effect Hook] Resetting fetch guard.");
                    isAutoFetchingRef.current = false;

                    // Re-check fetchStatus *after* handleFetchManual completes using the ref
                    const finalStatus = fetchStatusRef.current;
                    logger.log(`[AutoFetch Effect Hook] Fetch attempt finished with status: ${finalStatus}`);

                    // If it was an image task and it failed, reset the initiated flag so it can retry
                    if (currentTask && (finalStatus === 'error' || finalStatus === 'failed_retries')) {
                         logger.log(`[AutoFetch Effect Hook] Resetting image task initiated flag due to final status: ${finalStatus}.`);
                         isImageTaskFetchInitiated.current = false;
                    }
                    // Do NOT reset the flag on success, as the task flow should proceed.
                });
        } else {
             // Log why auto-fetch might be skipped (optional, can be noisy)
             /*
             if (canTriggerFetch && isAutoFetchingRef.current) {
                 logger.log("[AutoFetch Effect Hook] Skipping: Guard is active.");
             } else if (currentTask && isImageTaskFetchInitiated.current) {
                 logger.log("[AutoFetch Effect Hook] Skipping: Image task fetch already initiated/running.");
             } else if (!canTriggerFetch) {
                 logger.log(`[AutoFetch Effect Hook] Skipping: Conditions not met (AutoFetch: ${autoFetch}, Status: ${fetchStatus}, RepoEntered: ${repoUrlEntered})`);
             } else if (!(isImageFetchReady || isStandardFetchReady)) {
                 logger.log(`[AutoFetch Effect Hook] Skipping: Flags check (isImageFetchReady: ${isImageFetchReady}, isStandardFetchReady: ${isStandardFetchReady})`);
             }
             */
        }

    // --- useEffect Dependency Array ---
    }, [
        isMounted, repoUrlEntered, autoFetch, targetBranchName, manualBranchName, // Trigger conditions
        imageReplaceTask, fetchStatus, // Trigger conditions
        handleFetchManual, // The action to call
        logger // Logging
        // isImageTaskFetchInitiated.current and isAutoFetchingRef.current are refs, don't include them
    ]);

    // --- Cleanup Effect ---
    useEffect(() => {
        // Cleanup interval on unmount
        return () => {
            stopProgressSimulation();
        };
    }, [stopProgressSimulation]);

    // --- Derived State ---
    // Provide loading/disabled states for the component UI based on context/hook state
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    // Use loadingPrs prop here for accurate disabling
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (!!imageReplaceTask && isImageTaskFetchInitiated.current && isLoading);

    // --- Return values ---
    return {
        files, // The fetched file data managed by this hook
        progress,
        error, // Fetch error message
        // fetchStatus is read from context by the component
        primaryHighlightedPath, // Determined primary path
        secondaryHighlightedPaths, // Determined secondary paths
        handleFetchManual, // The function to trigger a fetch
        isLoading, // Derived loading boolean
        isFetchDisabled, // Derived disabled boolean for button
    };
};