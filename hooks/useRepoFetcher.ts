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
const MAX_RETRIES = 2; // Restored maxRetries as a constant within the hook

export const useRepoFetcher = (
    initialRepoUrl: string, 
    onSetFilesFetched: (
        fetched: boolean,
        allFiles: FileNode[],
        primaryHighlight: string | null,
        secondaryHighlights: Record<ImportCategory, string[]>
    ) => void,
    addToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void,
    contextTargetBranchName: string | null, 
    contextManualBranchName: string,
    fetchStatusFromContext: FetchStatus 
) => {
    logger.debug("[useRepoFetcher] Hook START");
    const { 
        // maxRetries, // Removed from context destructuring, using local constant
        retryCount, 
        setRetryCount, 
        setFetchStatus, 
        repoUrl: contextRepoUrl, 
        imageReplaceTask, 
        highlightedPathFromUrl, 
        loadingPrs, // <<< ADDED loadingPrs from context
        assistantLoading, 
        isParsing, 
        aiActionLoading,
    } = useRepoXmlPageContext(); 

    const [repoUrl, setRepoUrlLocal] = useState(initialRepoUrl);
    const [currentBranchName, setCurrentBranchNameLocal] = useState(contextManualBranchName.trim() || contextTargetBranchName || 'default');
    
    const [files, setFilesLocal] = useState<FileNode[]>([]);
    const [loadingLocal, setLoadingLocal] = useState<boolean>(false); 
    const [errorLocal, setErrorLocal] = useState<string | null>(null);
    const [progressLocal, setProgressLocal] = useState<number>(0);
    
    const isFetchingRef = useRef(false);
    const activeImageTaskRef = useRef(imageReplaceTask);

    useEffect(() => {
        if (initialRepoUrl !== repoUrl) {
            logger.debug(`[useRepoFetcher] Syncing local repoUrl from prop: ${initialRepoUrl}`);
            setRepoUrlLocal(initialRepoUrl);
        }
    }, [initialRepoUrl, repoUrl]);

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
    ): Promise<void> => {
        logger.info(`[useRepoFetcher handleFetchManual] Called. Local Repo: ${repoUrl}, Branch Override: ${branchNameToFetchOverride ?? 'N/A'}, Current Hook Branch: ${currentBranchName}, isRetry: ${isRetry}`);

        if (isFetchingRef.current && !isRetry) {
            logger.warn("[useRepoFetcher handleFetchManual] Fetch already in progress. Skipping.");
            addToast("Загрузка уже идет...", "info");
            return;
        }
        
        if (!repoUrl || !repoUrl.includes("github.com")) {
            logger.error(`[useRepoFetcher handleFetchManual] Invalid or empty repoUrl: ${repoUrl}. Cannot fetch.`);
            addToast("Ошибка: URL репозитория не указан или некорректен.", "error");
            setFetchStatus('error'); 
            setErrorLocal("URL репозитория не указан или некорректен.");
            return;
        }

        isFetchingRef.current = true;
        setLoadingLocal(true);
        setErrorLocal(null);
        setProgressLocal(0);
        setFetchStatus(isRetry ? 'retrying' : 'loading'); 

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
                const primaryHighlightToUse = highlightedPathFromUrl || actionResult.primaryHighlightedPath || null;
                
                onSetFilesFetched( 
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
            onSetFilesFetched(false, [], null, { component: [], context: [], hook: [], lib: [], other: [] });

            if (isRetry && retryCount >= MAX_RETRIES - 1) {
                logger.warn(`[useRepoFetcher handleFetchManual] Max retries (${MAX_RETRIES}) reached for ${repoUrl}.`);
                addToast(`Достигнуто макс. попыток загрузки для ${repoUrl.split('/').pop()}.`, "error");
                 setFetchStatus('failed_retries'); 
            }
        } finally {
            setLoadingLocal(false);
            isFetchingRef.current = false;
            setProgressLocal(100);
            logger.info(`[useRepoFetcher handleFetchManual] Finished. Context FetchStatus via prop: ${fetchStatusFromContext}`);
        }
    }, [
        repoUrl, currentBranchName, addToast, onSetFilesFetched, setFetchStatus, 
        retryCount, setRetryCount, highlightedPathFromUrl, logger // MAX_RETRIES is now a local const
    ]);

    useEffect(() => {
        if (fetchStatusFromContext === 'error' && retryCount < MAX_RETRIES && !isFetchingRef.current) { 
            const timeoutId = setTimeout(() => {
                logger.info(`[useRepoFetcher AutoRetry Effect] Retrying fetch (${retryCount + 1}/${MAX_RETRIES}). Current Branch: ${currentBranchName}`);
                setRetryCount(prev => prev + 1); 
                handleFetchManual(true, currentBranchName) 
                    .catch(e => logger.error("[useRepoFetcher AutoRetry Effect] Error in scheduled retry:", e));
            }, RETRY_DELAY_MS);
            return () => clearTimeout(timeoutId);
        }
    }, [fetchStatusFromContext, retryCount, handleFetchManual, currentBranchName, setRetryCount, logger]); // MAX_RETRIES is now a local const
    
    const derivedIsLoading = fetchStatusFromContext === 'loading' || fetchStatusFromContext === 'retrying';
    const derivedIsFetchDisabled = derivedIsLoading || loadingPrs || !contextRepoUrl || assistantLoading || isParsing || aiActionLoading;

    logger.debug(`[useRepoFetcher Render] derivedIsLoading=${derivedIsLoading}, derivedIsFetchDisabled=${derivedIsFetchDisabled}, localLoading=${loadingLocal}, contextFetchStatus=${fetchStatusFromContext}`);

    return {
        repoUrl: repoUrl, 
        setRepoUrl: setRepoUrlLocal, 
        files: files, 
        loading: derivedIsLoading, 
        error: errorLocal, 
        progress: progressLocal, 
        isFetchDisabled: derivedIsFetchDisabled, 
        retryCount: retryCount, 
        maxRetries: MAX_RETRIES, // Return the constant value
        handleFetchManual, 
        primaryHighlightedPath: useRepoXmlPageContext().primaryHighlightedPath, 
        secondaryHighlightedPaths: useRepoXmlPageContext().secondaryHighlightedPaths,
    };
};