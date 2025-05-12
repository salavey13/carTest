import { useState, useCallback, useRef, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { FileNode, ImageReplaceTask, FetchStatus, ImportCategory, SimplePullRequest, TargetPrData, RepoXmlPageContextType } from '@/contexts/RepoXmlPageContext'; // Import RepoXmlPageContextType
import { useRepoXmlPageContext } from '@/contexts/RepoXmlPageContext'; // Import context hook
import { fetchRepoContents as fetchRepoContentsAction, checkExistingPrBranch } from '@/app/actions_github/actions'; 

interface RepoContentResult {
    files: FileNode[];
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: Record<ImportCategory, string[]>;
    error?: string;
}

const RETRY_DELAY_MS = 3000;

export const useRepoFetcher = (
    initialRepoUrl: string,
    onSetFilesFetched: ( // This seems to be a direct prop, not from context in this hook's signature
        fetched: boolean,
        allFiles: FileNode[],
        primaryHighlight: string | null,
        secondaryHighlights: Record<ImportCategory, string[]>
    ) => void,
    addToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void, // Direct prop
    initialTargetBranchName: string | null, // Direct prop
    initialManualBranchName: string, // Direct prop
    // Removed setTargetBranchNameContext, setTargetPrDataContext as they should be called from context directly or other effects
    fetchStatusFromContext: FetchStatus // Pass context's fetchStatus
) => {
    logger.debug("[useRepoFetcher] Hook START");
    const { 
        maxRetries, 
        retryCount, 
        setRetryCount, 
        setFetchStatus, // Use context's setter
        setTargetBranchName, // Use context's setter directly if needed from here
        setTargetPrData, // Use context's setter directly if needed from here
        imageReplaceTask, // Read from context
        pendingFlowDetails, // Read from context
        primaryHighlightedPath: contextPrimaryPath, // Read from context
        secondaryHighlightedPaths: contextSecondaryPaths, // Read from context
        highlightedPathFromUrl, // Assuming this is available or passed differently if needed for logic here
        importantFiles, // Assuming available or passed
        repoUrl: contextRepoUrl, // Read from context if initialRepoUrl is just for initial setup
        isSettingsModalOpen, // Read from context
        triggerToggleSettingsModal, // Read from context
        setKworkInputValue, // Read from context
        setSelectedFetcherFiles, // Read from context
        setRequestCopied, // Read from context
        setAiResponseHasContent, // Read from context
        setFilesParsed, // Read from context
        setSelectedAssistantFiles, // Read from context
        loadingPrs, 
        assistantLoading, 
        isParsing, 
        aiActionLoading,
    } = useRepoXmlPageContext(); 

    const [repoUrl, setRepoUrlState] = useState(initialRepoUrl); // Local state for URL, can be synced with contextRepoUrl
    const [files, setFilesState] = useState<FileNode[]>([]); // Local files state
    const [loading, setLoadingState] = useState<boolean>(false); // Local loading state
    const [error, setErrorState] = useState<string | null>(null); // Local error state
    const [progress, setProgressState] = useState<number>(0); // Local progress state
    const [isFetchDisabledLocal, setIsFetchDisabledLocal] = useState<boolean>(false); // Local disabled state

    const isFetchingRef = useRef(false); 
    const isAutoFetchingRef = useRef(false); // If auto-fetch logic is still in this hook
    const activeImageTaskRef = useRef(imageReplaceTask); // Keep ref for task passed to server action
    const currentBranchNameForFetch = initialManualBranchName.trim() || initialTargetBranchName || 'default';

    useEffect(() => {
        setRepoUrlState(initialRepoUrl); // Sync if prop changes, or use contextRepoUrl
    }, [initialRepoUrl]);

    useEffect(() => {
        activeImageTaskRef.current = imageReplaceTask; // Keep task ref updated
    }, [imageReplaceTask]);


    const fetchRepoContentsCallback = useCallback(async (
        isRetry: boolean = false,
        branchToUse?: string | null,
        // imageTaskForFetch?: ImageReplaceTask | null, // Use activeImageTaskRef.current
        pathForInitialSelectionProp?: string | null
    ): Promise<RepoContentResult> => {
        const currentContextFetchStatus = fetchStatusFromContext; 
        logger.info(`[useRepoFetcher fetchRepoContentsCallback] Called. Repo: ${repoUrl}, Branch: ${branchToUse ?? currentBranchNameForFetch}, ImageTask: ${!!activeImageTaskRef.current}, PathForInitial: ${pathForInitialSelectionProp}, ContextFetchStatus: ${currentContextFetchStatus}`);

        if (isFetchingRef.current && !isRetry) {
            logger.warn("[useRepoFetcher fetchRepoContentsCallback] Fetch already in progress. Skipping.");
            addToast("Загрузка уже идет...", "info");
            return { files: [], primaryHighlightedPath: null, secondaryHighlightedPaths: { component: [], context: [], hook: [], lib: [], other: [] }, error: "Fetch in progress" };
        }
        isFetchingRef.current = true;
        setLoadingState(true);
        setErrorState(null);
        setProgressState(0);
        setFetchStatus(isRetry ? 'retrying' : 'loading'); 

        const branchForServerAction = branchToUse || currentBranchNameForFetch;
        logger.debug(`[useRepoFetcher fetchRepoContentsCallback] Effective branch for server action: ${branchForServerAction}`);

        let result: RepoContentResult = { files: [], primaryHighlightedPath: null, secondaryHighlightedPaths: { component: [], context: [], hook: [], lib: [], other: [] } };
        let currentFetchOpStatus: FetchStatus = 'loading'; 

        try {
            const actionResult = await fetchRepoContentsAction(
                repoUrl, // Use local state repoUrl or contextRepoUrl
                branchForServerAction,
                (p: number) => setProgressState(p),
                activeImageTaskRef.current // Pass task from ref
            );

            if (actionResult.success && actionResult.data) {
                logger.info(`[useRepoFetcher fetchRepoContentsCallback] Fetch successful. Files: ${actionResult.data.length}`);
                setFilesState(actionResult.data); // Set local files state
                const primaryHighlightToUse = pathForInitialSelectionProp ?? actionResult.primaryHighlightedPath ?? null;
                
                result = {
                    files: actionResult.data,
                    primaryHighlightedPath: primaryHighlightToUse,
                    secondaryHighlightedPaths: actionResult.secondaryHighlightedPaths ?? { component: [], context: [], hook: [], lib: [], other: [] },
                };
                // Call the onSetFilesFetched prop, which is handleSetFilesFetchedStable from context provider
                onSetFilesFetched(true, result.files, result.primaryHighlightedPath, result.secondaryHighlightedPaths);
                // setFetchStatus('success'); // Context setter will handle this via onSetFilesFetched
                currentFetchOpStatus = 'success'; // Local tracker
                setRetryCount(0); 
                setErrorState(null); 
            } else {
                throw new Error(actionResult.error || "Unknown error fetching repository contents from action.");
            }
        } catch (e: any) {
            logger.error("[useRepoFetcher fetchRepoContentsCallback] Fetch error:", e);
            const errorMessage = e.message || "Неизвестная ошибка при загрузке файлов.";
            setErrorState(errorMessage);
            result.error = errorMessage;
            setFilesState([]);
            onSetFilesFetched(false, [], null, { component: [], context: [], hook: [], lib: [], other: [] });

            if (isRetry && retryCount >= maxRetries -1) { 
                logger.warn(`[useRepoFetcher fetchRepoContentsCallback] Max retries (${maxRetries}) reached for ${repoUrl}.`);
                // setFetchStatus('failed_retries'); // Context setter will handle this via onSetFilesFetched
                currentFetchOpStatus = 'failed_retries';
                addToast(`Достигнуто макс. попыток загрузки для ${repoUrl.split('/').pop()}.`, "error");
            } else {
                // setFetchStatus('error');  // Context setter will handle this via onSetFilesFetched
                currentFetchOpStatus = 'error';
            }
        } finally {
            setLoadingState(false);
            isFetchingRef.current = false;
            setProgressState(100); 
            // activeImageTaskRef.current = null; // Don't nullify here if it's driven by context
            logger.info(`[useRepoFetcher fetchRepoContentsCallback] Finished. Operation Status: ${currentFetchOpStatus}. Context FetchStatus at call: ${currentContextFetchStatus}`);
            // The actual fetchStatus in context will be updated by the onSetFilesFetched callback.
        }
        return result;
    }, [
        repoUrl, onSetFilesFetched, addToast, currentBranchNameForFetch, 
        fetchStatusFromContext, maxRetries, retryCount, setRetryCount, setFetchStatus, // Include context setters used directly
        // activeImageTaskRef.current is used, but ref itself is stable.
    ]);


    useEffect(() => {
        // Auto-retry logic
        if (fetchStatusFromContext === 'error' && retryCount < maxRetries && !isFetchingRef.current) { 
            const timeoutId = setTimeout(() => {
                logger.info(`[useRepoFetcher AutoRetry] Retrying fetch (${retryCount + 1}/${maxRetries})...`);
                setRetryCount(prev => prev + 1); 
                fetchRepoContentsCallback(true, currentBranchNameForFetch) 
                    .catch(e => logger.error("[useRepoFetcher AutoRetry] Error in scheduled retry:", e));
            }, RETRY_DELAY_MS);
            return () => clearTimeout(timeoutId);
        }
    }, [fetchStatusFromContext, retryCount, maxRetries, fetchRepoContentsCallback, currentBranchNameForFetch, setRetryCount]);

    const derivedIsLoading = loading || fetchStatusFromContext === 'loading' || fetchStatusFromContext === 'retrying';
    const derivedIsFetchDisabled = derivedIsLoading || loadingPrs || !contextRepoUrl || assistantLoading || isParsing || aiActionLoading;


    return {
        repoUrl: repoUrl, // local state or contextRepoUrl
        setRepoUrl: setRepoUrlState, // local setter
        files: files, // local state
        setFiles: setFilesState, // local setter
        loading: derivedIsLoading, 
        error: error, // local state
        setError: setErrorState, // local setter
        progress: progress, // local state
        isFetchDisabled: derivedIsFetchDisabled, 
        // setIsFetchDisabled: setIsFetchDisabledLocal, // local setter for local disabled state
        retryCount: retryCount, // from context
        maxRetries: maxRetries, // from context
        triggerFetch: fetchRepoContentsCallback, 
        isFetchingRef, 
        isAutoFetchingRef,
        // primaryHighlightedPath and secondaryHighlightedPaths are now primarily managed in context,
        // this hook's role is to fetch files and report them.
        primaryHighlightedPath: contextPrimaryPath, // return context value
        secondaryHighlightedPaths: contextSecondaryPaths, // return context value
    };
};