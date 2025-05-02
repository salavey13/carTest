import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRepoContents, getOpenPullRequests } from "@/app/actions_github/actions";
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

    const { addToast: addToastDirect,
        fetchStatus, setFetchStatus, handleSetFilesFetched, setSelectedFetcherFiles,
        setRequestCopied, setLoadingPrs, setOpenPrs, setContextTargetBranch,
        triggerToggleSettingsModal, updateKworkInput,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
    } = useRepoXmlPageContext();
    addToastDirect("[DEBUG_HOOK] useRepoFetcher START", 'info', 500);

    addToastDirect("[DEBUG_HOOK] useRepoFetcher Before useState", 'info', 500);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
    addToastDirect("[DEBUG_HOOK] useRepoFetcher After useState", 'info', 500);

    addToastDirect("[DEBUG_HOOK] useRepoFetcher Before useRef", 'info', 500);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isImageTaskFetchInitiated = useRef(false);
    const isAutoFetchingRef = useRef(false);
    const fetchStatusRef = useRef(fetchStatus);
    addToastDirect("[DEBUG_HOOK] useRepoFetcher After useRef", 'info', 500);

    addToastDirect("[DEBUG_HOOK] useRepoFetcher Before Effects", 'info', 500);
    useEffect(() => {
        addToastDirect("[DEBUG_EFFECT] useRepoFetcher Mounted", 'info', 500);
        return () => {
            addToastDirect("[DEBUG_EFFECT] useRepoFetcher Unmounting", 'info', 500);
            if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); }
        };
    }, [addToastDirect]);

    useEffect(() => {
        addToastDirect(`[DEBUG_EFFECT] useRepoFetcher fetchStatus changed to: ${fetchStatus}`, 'info', 500);
        fetchStatusRef.current = fetchStatus;
    }, [fetchStatus, addToastDirect]);

    addToastDirect("[DEBUG_HOOK] useRepoFetcher Before Callbacks", 'info', 500);
    const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
        addToastDirect(`[DEBUG_CB] startProgressSimulation called`, 'info', 500);
        stopProgressSimulation();
        setProgress(0);
        const ticks = estimatedDurationSeconds * 5;
        const increment = ticks > 0 ? 100 / ticks : 100;
        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                const currentContextStatus = fetchStatusRef.current;
                if (currentContextStatus !== 'loading' && currentContextStatus !== 'retrying') {
                    stopProgressSimulation();
                    return currentContextStatus === 'success' ? 100 : prev;
                }
                const nextProgress = prev + increment;
                if (nextProgress >= 95) {
                    stopProgressSimulation();
                    return 95;
                }
                return nextProgress;
            });
        }, 200);
    }, [stopProgressSimulation, addToastDirect]);

    const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null,
        taskForEarlyCheck?: ImageReplaceTask | null
    ) => {
        addToastDirect("[DEBUG_CB] handleFetchManual START", 'info', 500);
        const initialBranchGuess = branchNameToFetchOverride || targetBranchName || manualBranchName || 'default';
        const isAutoFetchWithIdea = autoFetch && !!ideaFromUrl && !isManualRetry;
        const currentTask = taskForEarlyCheck || imageReplaceTask;

        // Guards
         if (currentTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) { addToastDirect("[DEBUG_CB] handleFetchManual SKIP: Image fetch running", 'warning', 500); return; }
         if (!currentTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { addToastDirect("[DEBUG_CB] handleFetchManual SKIP: Standard fetch running", 'warning', 500); return; }
         if (!repoUrl.trim()) { addToastDirect("[DEBUG_CB] handleFetchManual ERROR: No repo URL", 'error', 500); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return; }
         if (loadingPrs || assistantLoading || isParsing || aiActionLoading) { addToastDirect("[DEBUG_CB] handleFetchManual SKIP: Blocked by other process", 'warning', 500); return; }

        // Reset State
        addToastDirect("[DEBUG_CB] handleFetchManual Resetting State", 'info', 500);
        setFetchStatus('loading');
        setError(null);
        setFiles([]);
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        setSelectedFetcherFiles(new Set());
         if (!currentTask) {
             addToastDirect("[DEBUG_CB] handleFetchManual: Standard task - resetting AI states", 'info', 500);
             setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
         } else {
              addToastDirect("[DEBUG_CB] handleFetchManual: Image Task mode - setting flag", 'info', 500);
              isImageTaskFetchInitiated.current = true; updateKworkInput("");
         }

        // Branch / PR Logic (Image Task Only)
        let branchForContentFetch = initialBranchGuess;
        let identifiedPrBranch = false;
        if (currentTask && !isManualRetry) {
             addToastDirect("[DEBUG_CB] handleFetchManual: Image Task PR Check START", 'info', 500);
             setLoadingPrs(true);
             try {
                 const prResult = await getOpenPullRequests(repoUrl);
                  addToastDirect(`[DEBUG_CB] handleFetchManual: PR Result Success: ${prResult.success}`, 'info', 500);
                  if (prResult.success && prResult.pullRequests) {
                    const expectedPrTitlePrefix = `chore: Update image`; const expectedPrFile = currentTask.targetPath;
                    const matchPr = prResult.pullRequests.find(pr => pr.title?.startsWith(expectedPrTitlePrefix) && pr.title?.includes(expectedPrFile) && pr.head?.ref);
                    if (matchPr?.head?.ref) {
                        branchForContentFetch = matchPr.head.ref; identifiedPrBranch = true;
                        addToastDirect(`[DEBUG_CB] Found PR branch: ${branchForContentFetch}`, 'info', 500);
                        setContextTargetBranch(branchForContentFetch); setOpenPrs(prResult.pullRequests as SimplePullRequest[]);
                        addToast(`Найден PR #${matchPr.number}. Загружаю из ветки ${branchForContentFetch}...`, "info");
                    } else { setOpenPrs(prResult.pullRequests as SimplePullRequest[]); }
                } else { addToast("Не удалось проверить PR. Загружаю...", "error", { description: prResult.error }); setOpenPrs([]); }
             } catch (prError: any) { addToast(`[DEBUG_CB] handleFetchManual: PR Check CATCH ERROR: ${prError.message}`, 'error', 500); addToast("Крит. ошибка проверки PR. Загружаю...", "error", { description: prError.message }); setOpenPrs([]); }
             finally { setLoadingPrs(false); addToastDirect("[DEBUG_CB] handleFetchManual: Image Task PR Check FINISH", 'info', 500);}
        }

        // Fetch Execution
        addToastDirect(`[DEBUG_CB] handleFetchManual Fetching from: ${branchForContentFetch}`, 'info', 500);
        addToast(`Запрос файлов из ветки (${branchForContentFetch})...`, 'loading', 15000, {id: 'fetch-toast'});
        addToastDirect(`[DEBUG_CB] Before startProgressSimulation`, 'info', 500);
        startProgressSimulation(identifiedPrBranch ? 8 : 13);

        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = [];
        let primaryHighlightPathInternal: string | null = null;
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
        let filesToAutoSelect = new Set<string>();

        try {
            addToastDirect("[DEBUG_CB] handleFetchManual Try block - Before fetch", 'info', 500);
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, branchForContentFetch);
            addToastDirect(`[DEBUG_CB] handleFetchManual Try block - After fetch. Success: ${fetchResult?.success}`, 'info', 500);

            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true;
                fetchedFilesData = fetchResult.files;
                const allPaths = fetchedFilesData.map(f => f.path);
                logger.log(`Fetcher Hook: Fetched ${fetchedFilesData.length} files from '${branchForContentFetch}'.`);
                addToastDirect(`[DEBUG_CB] Fetched ${fetchedFilesData.length} files.`, 'info', 500);

                if (currentTask) { // Image Task Path
                    addToastDirect(`[DEBUG_CB] Image Task Path processing`, 'info', 500);
                    primaryHighlightPathInternal = currentTask.targetPath;
                    if (!allPaths.includes(primaryHighlightPathInternal)) {
                        addToastDirect(`[DEBUG_CB] ERROR: Image Task target ${primaryHighlightPathInternal} NOT FOUND!`, 'error', 500);
                        logger.error(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} NOT FOUND in fetched files from branch ${branchForContentFetch}.`);
                        setError(`Файл (${primaryHighlightPathInternal}) не найден в ветке ${branchForContentFetch}.`);
                        addToast(`Файл (${primaryHighlightPathInternal}) не найден.`, 'error', undefined, {id: 'fetch-toast'});
                        fetchAttemptSucceeded = false;
                    } else {
                        logger.log(`Fetcher Hook: Image Task - Target ${primaryHighlightPathInternal} found.`);
                        addToastDirect(`[DEBUG_CB] Image Task target found. Auto-selecting.`, 'info', 500);
                        addToast(`Файл для замены (${primaryHighlightPathInternal.split('/').pop()}) загружен из ${branchForContentFetch}.`, 'success', undefined, {id: 'fetch-toast'});
                        filesToAutoSelect.add(primaryHighlightPathInternal);
                    }
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };

                } else { // Standard Task Path
                    addToastDirect(`[DEBUG_CB] Standard Task Path processing`, 'info', 500);
                    if (highlightedPathFromUrl) {
                        addToastDirect(`[DEBUG_CB] Standard Task - Processing highlights for ${highlightedPathFromUrl}`, 'info', 500);
                        primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                        addToastDirect(`[DEBUG_CB] Primary Path resolved: ${primaryHighlightPathInternal}`, 'info', 500);

                        if (primaryHighlightPathInternal) {
                            const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                            if (primaryFileNode) {
                                filesToAutoSelect.add(primaryHighlightPathInternal);
                                addToastDirect(`[DEBUG_CB] Before repoUtils.extractImports`, 'info', 500);
                                const imports = repoUtils.extractImports(primaryFileNode.content);
                                const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                addToastDirect(`[DEBUG_CB] Before repoUtils.resolveImportPath/categorize loop (${imports.length} imports)`, 'info', 500);

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
                                    component: Array.from(tempSecPathsSet.component),
                                    context: Array.from(tempSecPathsSet.context),
                                    hook: Array.from(tempSecPathsSet.hook),
                                    lib: Array.from(tempSecPathsSet.lib),
                                    other: Array.from(tempSecPathsSet.other)
                                };
                                addToastDirect(`[DEBUG_CB] Secondary paths calculated. Comp: ${secondaryHighlightPathsDataInternal.component.length}, Ctx: ${secondaryHighlightPathsDataInternal.context.length}, Hook: ${secondaryHighlightPathsDataInternal.hook.length}, Lib: ${secondaryHighlightPathsDataInternal.lib.length}`, 'info', 500);
                            } else {
                                addToastDirect(`[DEBUG_CB] WARN: Primary path ${primaryHighlightPathInternal} not found in fetched data`, 'warning', 500);
                                logger.warn(`Fetcher Hook: Primary path ${primaryHighlightPathInternal} resolved but node not found in fetched data.`);
                                primaryHighlightPathInternal = null;
                                addToast(`Ошибка: Данные для (${highlightedPathFromUrl}) не найдены.`, 'error', undefined, {id: 'fetch-toast'});
                            }
                        } else {
                           addToastDirect(`[DEBUG_CB] WARN: Page file for URL ${highlightedPathFromUrl} not found`, 'warning', 500);
                           logger.warn(`Fetcher Hook: Page file path for URL (${highlightedPathFromUrl}) not found among fetched files.`);
                           addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, 'warning', undefined, {id: 'fetch-toast'});
                        }

                        addToastDirect(`[DEBUG_CB] Checking important files. Count: ${importantFiles.length}`, 'info', 500);
                        let addedImportantCount = 0;
                        importantFiles.forEach(p => {
                            if (allPaths.includes(p) && !filesToAutoSelect.has(p)) {
                                filesToAutoSelect.add(p);
                                addedImportantCount++;
                            }
                        });
                        if (addedImportantCount > 0) {
                            addToastDirect(`[DEBUG_CB] Auto-selected ${addedImportantCount} important files`, 'info', 500);
                            logger.log(`Fetcher Hook: Auto-selected ${addedImportantCount} important files.`);
                        }

                        if (filesToAutoSelect.size > 0) {
                            const numSecondary = secondaryHighlightPathsDataInternal.component.length + secondaryHighlightPathsDataInternal.context.length + secondaryHighlightPathsDataInternal.hook.length + secondaryHighlightPathsDataInternal.lib.length;
                            const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary;
                            let msg = `✅ Авто-выбор: `;
                            const parts = [];
                            if (primaryHighlightPathInternal) parts.push(`1 стр.`);
                            if (numSecondary > 0) parts.push(`${numSecondary} связ.`);
                            if (numImportant > 0) parts.push(`${numImportant} важн.`);
                            msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`;
                            addToast(msg, 'success');
                        } else {
                           addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success', undefined, {id: 'fetch-toast'});
                        }
                    } else {
                        addToastDirect(`[DEBUG_CB] Standard Task - No URL params, basic fetch completed.`, 'info', 500);
                        addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success', undefined, {id: 'fetch-toast'});
                        primaryHighlightPathInternal = null;
                        secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };
                        filesToAutoSelect = new Set();
                    }
                }
            } else {
                addToastDirect(`[DEBUG_CB] fetchRepoContents failed. Error: ${fetchResult?.error}`, 'error', 500);
                fetchAttemptSucceeded = false;
                throw new Error(fetchResult?.error || `Не удалось получить файлы из ${branchForContentFetch}.`);
            }
        } catch (err: any) {
            addToastDirect(`[DEBUG_CB] handleFetchManual Catch block: ${err?.message}`, 'error', 500);
            const displayError = err?.message || "Неизвестная ошибка при загрузке.";
            logger.error(`Fetcher Hook: Fetch Error - ${displayError}`, err);
            setError(displayError);
            addToast(`Ошибка: ${displayError}`, 'error', undefined, {id: 'fetch-toast'});
            fetchAttemptSucceeded = false;
            fetchedFilesData = []; primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
        } finally {
            addToastDirect("[DEBUG_CB] handleFetchManual Finally block", 'info', 500);
            stopProgressSimulation();
            addToastDirect("[DEBUG_CB] handleFetchManual Finally - Before setFiles", 'info', 500);
            setFiles(fetchedFilesData);
            addToastDirect("[DEBUG_CB] handleFetchManual Finally - Before setPrimary/Secondary", 'info', 500);
            setPrimaryHighlightedPathState(primaryHighlightPathInternal);
            setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal);
             if (filesToAutoSelect.size > 0) {
                 addToastDirect("[DEBUG_CB] handleFetchManual Finally - Before setSelectedFetcherFiles", 'info', 500);
                 setSelectedFetcherFiles(filesToAutoSelect);
             }
            addToastDirect("[DEBUG_CB] handleFetchManual Finally - Before handleSetFilesFetched", 'info', 500);
            handleSetFilesFetched( fetchAttemptSucceeded, fetchedFilesData, primaryHighlightPathInternal, Object.values(secondaryHighlightPathsDataInternal).flat() );
            addToastDirect("[DEBUG_CB] handleFetchManual Finally - Before setProgress", 'info', 500);
            setProgress(fetchAttemptSucceeded ? 100 : 0);
            if (currentTask && !fetchAttemptSucceeded) { isImageTaskFetchInitiated.current = false; }
            if(isSettingsModalOpen && fetchAttemptSucceeded) { triggerToggleSettingsModal(); }
            addToastDirect(`[DEBUG_CB] handleFetchManual FINISHED`, 'info', 500);
        }
    }, [
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        loadingPrs, assistantLoading, isParsing, aiActionLoading,
        setFetchStatus, handleSetFilesFetched,
        setSelectedFetcherFiles, setRequestCopied,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setLoadingPrs,
        setOpenPrs, setContextTargetBranch, triggerToggleSettingsModal, updateKworkInput, addToastDirect,
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
        startProgressSimulation, stopProgressSimulation,
        logger
    ]);

    // --- Effect: Auto-Fetch ---
    useEffect(() => {
        addToastDirect("[DEBUG_EFFECT] Auto-Fetch Effect Check", 'info', 500);
        if (!repoUrlEntered) { addToastDirect("[DEBUG_EFFECT] Auto-Fetch SKIP: no URL", 'info', 500); return; }
        const currentTask = imageReplaceTask;
        const branch = targetBranchName || manualBranchName || null;
        const shouldConsiderAutoFetch = autoFetch && (!!currentTask || !!highlightedPathFromUrl || !!ideaFromUrl);
        if (!shouldConsiderAutoFetch) { addToastDirect("[DEBUG_EFFECT] Auto-Fetch SKIP: should not consider", 'info', 500); return; }
        const timerId = setTimeout(() => {
            addToastDirect("[DEBUG_EFFECT] Auto-Fetch Timer Fired", 'info', 500);
            const currentContextStatus = fetchStatusRef.current;
            const canTriggerFetchNow = (currentContextStatus === 'idle' || currentContextStatus === 'failed_retries' || currentContextStatus === 'error');
            if (canTriggerFetchNow && !isAutoFetchingRef.current) {
                addToastDirect("[DEBUG_EFFECT] Auto-Fetch Triggering handleFetchManual", 'info', 500);
                isAutoFetchingRef.current = true;
                handleFetchManual(false, branch, currentTask)
                    .catch(err => { addToastDirect(`[DEBUG_EFFECT] Auto-Fetch handleFetchManual ERROR`, 'error', 500); })
                    .finally(() => { addToastDirect("[DEBUG_EFFECT] Auto-Fetch FINALLY", 'info', 500); isAutoFetchingRef.current = false; });
            } else { addToastDirect("[DEBUG_EFFECT] Auto-Fetch conditions inside timer NOT met", 'info', 500); }
        }, 500);
        return () => clearTimeout(timerId);
    }, [
        repoUrlEntered, autoFetch, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, ideaFromUrl, handleFetchManual, logger, addToastDirect
    ]);

    addToastDirect("[DEBUG_HOOK] useRepoFetcher After Callbacks and Effects", 'info', 500);

    // --- Derived State ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (!!imageReplaceTask && isImageTaskFetchInitiated.current && isLoading);
    addToastDirect(`[DEBUG_HOOK] useRepoFetcher derived: isLoading=${isLoading}, isFetchDisabled=${isFetchDisabled}`, 'info', 500);

    // --- Return values ---
    addToastDirect("[DEBUG_HOOK] useRepoFetcher Hook End - Returning values", 'info', 500);
    return {
        files, progress, error, primaryHighlightedPath, secondaryHighlightedPaths,
        handleFetchManual, isLoading, isFetchDisabled,
    };
};