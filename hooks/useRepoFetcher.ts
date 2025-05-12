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
const MAX_RETRIES = 2; 

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
        retryCount, 
        setRetryCount, 
        setFetchStatus, 
        repoUrl: contextRepoUrl, 
        githubToken, 
        imageReplaceTask, 
        highlightedPathFromUrl, 
        loadingPrs, 
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
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null); 

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

    const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 10) => {
        stopProgressSimulation();
        setProgressLocal(0);
        const ticks = estimatedDurationSeconds * 5; 
        const increment = ticks > 0 ? 100 / ticks : 100;
        
        progressIntervalRef.current = setInterval(() => {
            setProgressLocal(prev => {
                const nextProgress = prev + increment;
                if (nextProgress >= 95) { 
                    stopProgressSimulation();
                    return 95;
                }
                return nextProgress;
            });
        }, 200); 
    }, [stopProgressSimulation]);

    const handleFetchManual = useCallback(async (
        isRetry: boolean = false,
        branchNameToFetchOverride?: string | null
    ): Promise<void> => { 
        const currentRepoUrlToFetch = repoUrl; 
        logger.info(`[useRepoFetcher handleFetchManual] Called. Repo URL: ${currentRepoUrlToFetch}, Branch Override: ${branchNameToFetchOverride ?? 'N/A'}, Current Hook Branch: ${currentBranchName}, isRetry: ${isRetry}, Token provided (first 5 chars): ${githubToken ? githubToken.substring(0, 5) + '...' : 'No token'}`);

        if (isFetchingRef.current && !isRetry) {
            logger.warn("[useRepoFetcher handleFetchManual] Fetch already in progress. Skipping.");
            addToast("Загрузка уже идет...", "info");
            return;
        }
        
        if (!currentRepoUrlToFetch || !currentRepoUrlToFetch.includes("github.com")) {
            logger.error(`[useRepoFetcher handleFetchManual] Invalid or empty repoUrl: ${currentRepoUrlToFetch}. Cannot fetch.`);
            addToast("Ошибка: URL репозитория не указан или некорректен.", "error");
            setFetchStatus('error'); 
            setErrorLocal("URL репозитория не указан или некорректен.");
            return;
        }

        isFetchingRef.current = true;
        setLoadingLocal(true); 
        setErrorLocal(null);
        setFetchStatus(isRetry ? 'retrying' : 'loading'); 
        startProgressSimulation(); 

        const branchForFetch = branchNameToFetchOverride ?? currentBranchName;
        logger.debug(`[useRepoFetcher handleFetchManual] Effective branch for server action: ${branchForFetch}`);

        try {
            const actionResult = await fetchRepoContentsAction(
                currentRepoUrlToFetch,
                branchForFetch,
                githubToken || undefined, // customToken (was previously the progress callback placeholder)
                activeImageTaskRef.current // imageTask
            );

            stopProgressSimulation(); 

            if (actionResult.success && actionResult.data) {
                logger.info(`[useRepoFetcher handleFetchManual] Fetch successful. Files: ${actionResult.data.length}`);
                setFilesLocal(actionResult.data);
                setProgressLocal(100); 
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
            stopProgressSimulation(); 
            logger.error("[useRepoFetcher handleFetchManual] Fetch error:", e);
            const errorMessage = e.message || "Неизвестная ошибка при загрузке файлов.";
            setErrorLocal(errorMessage);
            setFilesLocal([]);
            setProgressLocal(0); 

            onSetFilesFetched(false, [], null, { component: [], context: [], hook: [], lib: [], other: [] });

            if (isRetry && retryCount >= MAX_RETRIES - 1) {
                logger.warn(`[useRepoFetcher handleFetchManual] Max retries (${MAX_RETRIES}) reached for ${currentRepoUrlToFetch}.`);
                addToast(errorMessage + ` (Попытка ${retryCount + 1}/${MAX_RETRIES})`, "error"); 
                setFetchStatus('failed_retries'); 
            } else {
                 addToast(errorMessage + (isRetry ? ` (Попытка ${retryCount +1}/${MAX_RETRIES})` : ` (Попытка 1/${MAX_RETRIES})`), "error");
            }
        } finally {
            setLoadingLocal(false); 
            isFetchingRef.current = false;
            const currentContextStatus = fetchStatusFromContext; 
            if (currentContextStatus === 'success') setProgressLocal(100);
            else if (currentContextStatus === 'failed_retries' || (currentContextStatus === 'error' && retryCount >= MAX_RETRIES -1)) setProgressLocal(0);

            logger.info(`[useRepoFetcher handleFetchManual] Finished. Current localLoading: ${loadingLocal}, Context FetchStatus (at finally): ${currentContextStatus}`);
        }
    }, [
        repoUrl, currentBranchName, githubToken, addToast, onSetFilesFetched, setFetchStatus, 
        retryCount, setRetryCount, highlightedPathFromUrl, logger, startProgressSimulation, stopProgressSimulation 
    ]);

    useEffect(() => {
        if (fetchStatusFromContext === 'error' && retryCount < MAX_RETRIES && !isFetchingRef.current && !loadingLocal) { 
            const timeoutId = setTimeout(() => {
                logger.info(`[useRepoFetcher AutoRetry Effect] Retrying fetch (${retryCount + 1}/${MAX_RETRIES}). Current Branch: ${currentBranchName}`);
                setRetryCount(prev => prev + 1);
                handleFetchManual(true, currentBranchName) 
                    .catch(e => logger.error("[useRepoFetcher AutoRetry Effect] Error in scheduled retry:", e));
            }, RETRY_DELAY_MS);
            return () => clearTimeout(timeoutId);
        }
    }, [fetchStatusFromContext, retryCount, handleFetchManual, currentBranchName, loadingLocal, setRetryCount, logger]); 
    
    useEffect(() => {
        return () => {
            stopProgressSimulation();
        };
    }, [stopProgressSimulation]);
    
    const uiIsLoading = loadingLocal; 
    const derivedIsFetchDisabled = loadingLocal || loadingPrs || !contextRepoUrl || assistantLoading || isParsing || aiActionLoading;

    logger.debug(`[useRepoFetcher Render] uiIsLoading=${uiIsLoading}, derivedIsFetchDisabled=${derivedIsFetchDisabled}, localLoading=${loadingLocal}, contextFetchStatus=${fetchStatusFromContext}`);

    return {
        repoUrl: repoUrl, 
        setRepoUrl: setRepoUrlLocal, 
        files: files, 
        loading: uiIsLoading, 
        error: errorLocal, 
        progress: progressLocal, 
        isFetchDisabled: derivedIsFetchDisabled, 
        retryCount: retryCount, 
        maxRetries: MAX_RETRIES, 
        handleFetchManual, 
        primaryHighlightedPath: useRepoXmlPageContext().primaryHighlightedPath, 
        secondaryHighlightedPaths: useRepoXmlPageContext().secondaryHighlightedPaths,
    };
};