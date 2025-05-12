import { useState, useCallback, useRef, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { FileNode, ImageReplaceTask, FetchStatus, ImportCategory, SimplePullRequest, TargetPrData } from '@/contexts/RepoXmlPageContext';
import { useRepoXmlPageContext } from '@/contexts/RepoXmlPageContext';
import { fetchRepoContents as fetchRepoContentsAction } from '@/app/actions_github/actions'; 

interface RepoContentResult {
    files: FileNode[];
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: Record<ImportCategory, string[]>;
    error?: string;
}

const RETRY_DELAY_MS = 3000;

export const useRepoFetcher = (
    // initialRepoUrl prop is still used for initializing the local repoUrl state.
    initialRepoUrl: string, 
    // This is handleSetFilesFetchedStable from context, used to report fetched data AND update context's fetchStatus.
    onSetFilesFetched: (
        fetched: boolean,
        allFiles: FileNode[],
        primaryHighlight: string | null,
        secondaryHighlights: Record<ImportCategory, string[]>
    ) => void,
    addToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void,
    // These are used to determine the branch for the fetch operation if no override is given.
    contextTargetBranchName: string | null, 
    contextManualBranchName: string,
    // This is the current fetchStatus from the context, used to decide on retries etc.
    fetchStatusFromContext: FetchStatus 
) => {
    logger.debug("[useRepoFetcher] Hook START");
    const { 
        maxRetries, 
        retryCount, 
        setRetryCount, 
        setFetchStatus, // Context's main fetch status setter
        // other context values if needed directly by this hook's internal logic
        repoUrl: contextRepoUrl, // Read context's repoUrl for comparison or fallback
        imageReplaceTask, // Read from context if fetch logic depends on it
        highlightedPathFromUrl, // Used for determining primary highlight post-fetch
    } = useRepoXmlPageContext(); 

    // Local state for URL and branch, synchronized with context/props
    const [repoUrl, setRepoUrlLocal] = useState(initialRepoUrl);
    // Branch name determined by contextTargetBranchName or contextManualBranchName
    const [currentBranchName, setCurrentBranchNameLocal] = useState(contextManualBranchName.trim() || contextTargetBranchName || 'default');
    
    const [files, setFilesLocal] = useState<FileNode[]>([]);
    const [loadingLocal, setLoadingLocal] = useState<boolean>(false); // Local loading state for the fetch operation itself
    const [errorLocal, setErrorLocal] = useState<string | null>(null);
    const [progressLocal, setProgressLocal] = useState<number>(0);
    
    const isFetchingRef = useRef(false);
    const activeImageTaskRef = useRef(imageReplaceTask);

    // Sync local repoUrl with initialRepoUrl (could also sync with contextRepoUrl if preferred)
    useEffect(() => {
        if (initialRepoUrl !== repoUrl) {
            logger.debug(`[useRepoFetcher] Syncing local repoUrl from prop: ${initialRepoUrl}`);
            setRepoUrlLocal(initialRepoUrl);
        }
    }, [initialRepoUrl, repoUrl]);

    // Sync local currentBranchName with context-derived branch names
    useEffect(() => {
        const newBranchName = contextManualBranchName.trim() || contextTargetBranchName || 'default';
        if (newBranchName !== currentBranchName) {
            logger.debug(`[useRepoFetcher] Syncing local currentBranchName: ${newBranchName}`);
            setCurrentBranchNameLocal(newBranchName);
        }
    }, [contextManualBranchName, contextTargetBranchName, currentBranchName]);
    
    useEffect(() => {
        activeImageTaskRef.current = imageReplaceTask;
    }, [imageReplaceTask]);


    const handleFetchManual = useCallback(async (
        isRetry: boolean = false,
        branchNameToFetchOverride?: string | null
    ): Promise<void> => { // Changed return to void as it primarily updates context
        
        logger.info(`[useRepoFetcher handleFetchManual] Called. Local Repo: ${repoUrl}, Branch Override: ${branchNameToFetchOverride ?? 'N/A'}, Current Hook Branch: ${currentBranchName}, isRetry: ${isRetry}`);

        if (isFetchingRef.current && !isRetry) {
            logger.warn("[useRepoFetcher handleFetchManual] Fetch already in progress. Skipping.");
            addToast("Загрузка уже идет...", "info");
            return;
        }
        
        if (!repoUrl || !repoUrl.includes("github.com")) {
            logger.error(`[useRepoFetcher handleFetchManual] Invalid or empty repoUrl: ${repoUrl}. Cannot fetch.`);
            addToast("Ошибка: URL репозитория не указан или некорректен.", "error");
            // Ensure context status reflects this failure if it's an attempt to fetch
            setFetchStatus('error'); // Set context status to error
            setErrorLocal("URL репозитория не указан или некорректен.");
            return;
        }

        isFetchingRef.current = true;
        setLoadingLocal(true);
        setErrorLocal(null);
        setProgressLocal(0);
        setFetchStatus(isRetry ? 'retrying' : 'loading'); // Update context's fetchStatus

        const branchForFetch = branchNameToFetchOverride ?? currentBranchName;
        logger.debug(`[useRepoFetcher handleFetchManual] Effective branch for server action: ${branchForFetch}`);

        try {
            const actionResult = await fetchRepoContentsAction(
                repoUrl,
                branchForFetch,
                (p: number) => setProgressLocal(p),
                activeImageTaskRef.current
            );

            if (actionResult.success && actionResult.data) {
                logger.info(`[useRepoFetcher handleFetchManual] Fetch successful. Files: ${actionResult.data.length}`);
                setFilesLocal(actionResult.data);
                // Determine primary highlight based on URL param or action result
                const primaryHighlightToUse = highlightedPathFromUrl || actionResult.primaryHighlightedPath || null;
                
                onSetFilesFetched( // This callback updates context, including fetchStatus to 'success' or 'error'
                    true, 
                    actionResult.data, 
                    primaryHighlightToUse, 
                    actionResult.secondaryHighlightedPaths ?? { component: [], context: [], hook: [], lib: [], other: [] }
                );
                setRetryCount(0);
                setErrorLocal(null);
            } else {
                throw new Error(actionResult.error || "Unknown error fetching repository contents from action.");
            }
        } catch (e: any) {
            logger.error("[useRepoFetcher handleFetchManual] Fetch error:", e);
            const errorMessage = e.message || "Неизвестная ошибка при загрузке файлов.";
            setErrorLocal(errorMessage);
            setFilesLocal([]);
            // Call onSetFilesFetched with error state, which will set context's fetchStatus
            onSetFilesFetched(false, [], null, { component: [], context: [], hook: [], lib: [], other: [] });

            if (isRetry && retryCount >= maxRetries - 1) {
                logger.warn(`[useRepoFetcher handleFetchManual] Max retries (${maxRetries}) reached for ${repoUrl}.`);
                // onSetFilesFetched should have set fetchStatus to error, let context re-render with failed_retries if it's a distinct visual state
                addToast(`Достигнуто макс. попыток загрузки для ${repoUrl.split('/').pop()}.`, "error");
                 setFetchStatus('failed_retries'); // Explicitly set to failed_retries
            } else {
                // Error status is set by onSetFilesFetched(false, ...)
            }
        } finally {
            setLoadingLocal(false);
            isFetchingRef.current = false;
            setProgressLocal(100);
            logger.info(`[useRepoFetcher handleFetchManual] Finished. Context FetchStatus via prop: ${fetchStatusFromContext}`);
        }
    }, [
        repoUrl, currentBranchName, addToast, onSetFilesFetched, setFetchStatus, 
        retryCount, maxRetries, setRetryCount, highlightedPathFromUrl, logger
    ]);


    useEffect(() => {
        if (fetchStatusFromContext === 'error' && retryCount < maxRetries && !isFetchingRef.current) { 
            const timeoutId = setTimeout(() => {
                logger.info(`[useRepoFetcher AutoRetry Effect] Retrying fetch (${retryCount + 1}/${maxRetries}). Current Branch: ${currentBranchName}`);
                setRetryCount(prev => prev + 1); 
                handleFetchManual(true, currentBranchName) 
                    .catch(e => logger.error("[useRepoFetcher AutoRetry Effect] Error in scheduled retry:", e));
            }, RETRY_DELAY_MS);
            return () => clearTimeout(timeoutId);
        }
    }, [fetchStatusFromContext, retryCount, maxRetries, handleFetchManual, currentBranchName, setRetryCount, logger]);
    
    // isLoading for RepoTxtFetcher should primarily depend on the context's fetchStatus
    const derivedIsLoading = fetchStatusFromContext === 'loading' || fetchStatusFromContext === 'retrying';
    // isFetchDisabled logic can also use context states
    const derivedIsFetchDisabled = derivedIsLoading || loadingPrs || !contextRepoUrl || assistantLoading || isParsing || aiActionLoading;

    logger.debug(`[useRepoFetcher Render] derivedIsLoading=${derivedIsLoading}, derivedIsFetchDisabled=${derivedIsFetchDisabled}, localLoading=${loadingLocal}, contextFetchStatus=${fetchStatusFromContext}`);

    return {
        // Return local states that this hook manages for its internal operations
        repoUrl: repoUrl, // The URL this hook is currently configured to use
        setRepoUrl: setRepoUrlLocal, // Setter for this hook's URL state
        files: files, // Files fetched by this instance of the hook
        // No local setFiles needed to be returned if parent doesn't directly manipulate it
        
        // loading: loadingLocal, // This hook's direct loading state
        loading: derivedIsLoading, // Prefer derived from context for UI consistency
        error: errorLocal, // This hook's direct error state
        // setError: setErrorLocal, // Setter for this hook's error state
        
        progress: progressLocal, // This hook's progress
        
        isFetchDisabled: derivedIsFetchDisabled, // UI disabled state based on context
        // No setIsFetchDisabled needed from here, it's derived
        
        retryCount: retryCount, // From context
        maxRetries: maxRetries, // From context
        
        handleFetchManual, // The main action this hook provides
        
        // These might not be needed by RepoTxtFetcher if they are purely internal to this hook
        // isFetchingRef, 
        // isAutoFetchingRef 

        // These are now read from context directly in RepoTxtFetcher, so not returned here
        // primaryHighlightedPath: contextPrimaryPath, 
        // secondaryHighlightedPaths: contextSecondaryPaths,
    };
};