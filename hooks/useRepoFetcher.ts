// /hooks/useRepoFetcher.ts
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

// const MAX_RETRIES = 2; // Теперь берется из контекста
const RETRY_DELAY_MS = 3000;

export const useRepoFetcher = (
    initialRepoUrl: string,
    // setFetchStatus prop удален, т.к. будет использоваться из контекста
    onSetFilesFetched: (
        fetched: boolean,
        allFiles: FileNode[],
        primaryHighlight: string | null,
        secondaryHighlights: Record<ImportCategory, string[]>
    ) => void,
    addToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void,
    initialTargetBranchName: string | null,
    initialManualBranchName: string,
    setTargetBranchNameContext: (name: string | null) => void,
    setTargetPrDataContext: (data: TargetPrData | null) => void,
    fetchStatusFromContext: FetchStatus // Передаем напрямую для использования
) => {
    logger.debug("[useRepoFetcher] Hook START");
    const { 
        maxRetries, 
        retryCount, 
        setRetryCount, 
        setFetchStatus // Получаем setFetchStatus из контекста
    } = useRepoXmlPageContext(); 

    const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [isFetchDisabled, setIsFetchDisabled] = useState<boolean>(false); 
    // retryCount и maxRetries теперь из контекста
    const isFetchingRef = useRef(false); 
    const isAutoFetchingRef = useRef(false); 
    logger.debug("[useRepoFetcher] Before useState");

    const currentBranchName = initialManualBranchName.trim() || initialTargetBranchName || 'default';
    logger.debug("[useRepoFetcher] After useState");

    useEffect(() => {
        setRepoUrl(initialRepoUrl); 
    }, [initialRepoUrl]);
    logger.debug("[useRepoFetcher] Before useRef");

    const activeImageTaskRef = useRef<ImageReplaceTask | null>(null);
    logger.debug("[useRepoFetcher] After useRef");

    const fetchRepoContents = useCallback(async (
        isRetry: boolean = false,
        branch?: string | null,
        imageTask?: ImageReplaceTask | null,
        pathForInitialSelection?: string | null
    ): Promise<RepoContentResult> => {
        const currentContextFetchStatus = fetchStatusFromContext; 
        logger.info(`[useRepoFetcher fetchRepoContents] Called. Repo: ${repoUrl}, Branch: ${branch ?? currentBranchName}, ImageTask: ${!!imageTask}, PathForInitial: ${pathForInitialSelection}, ContextFetchStatus at call: ${currentContextFetchStatus}`);

        if (isFetchingRef.current && !isRetry) {
            logger.warn("[useRepoFetcher fetchRepoContents] Fetch already in progress. Skipping.");
            addToast("Загрузка уже идет...", "info");
            return { files: [], primaryHighlightedPath: null, secondaryHighlightedPaths: { component: [], context: [], hook: [], lib: [], other: [] }, error: "Fetch in progress" };
        }
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);
        setProgress(0);
        setFetchStatus(isRetry ? 'retrying' : 'loading'); // Используем setFetchStatus из контекста
        activeImageTaskRef.current = imageTask || null; 

        const branchForFetch = branch || currentBranchName;
        logger.debug(`[useRepoFetcher fetchRepoContents] Effective branch for fetch: ${branchForFetch}`);

        let result: RepoContentResult = { files: [], primaryHighlightedPath: null, secondaryHighlightedPaths: { component: [], context: [], hook: [], lib: [], other: [] } };
        let currentFetchOpStatus: FetchStatus = 'loading'; 

        try {
            const actionResult = await fetchRepoContentsAction(
                repoUrl,
                branchForFetch,
                (p: number) => setProgress(p),
                activeImageTaskRef.current 
            );

            if (actionResult.success && actionResult.data) {
                logger.info(`[useRepoFetcher fetchRepoContents] Fetch successful. Files: ${actionResult.data.length}`);
                setFiles(actionResult.data);
                const primaryHighlight = pathForInitialSelection ?? actionResult.primaryHighlightedPath ?? null;
                result = {
                    files: actionResult.data,
                    primaryHighlightedPath: primaryHighlight,
                    secondaryHighlightedPaths: actionResult.secondaryHighlightedPaths ?? { component: [], context: [], hook: [], lib: [], other: [] },
                };
                onSetFilesFetched(true, result.files, result.primaryHighlightedPath, result.secondaryHighlightedPaths);
                setFetchStatus('success'); // Используем setFetchStatus из контекста
                currentFetchOpStatus = 'success';
                setRetryCount(0); // Используем setRetryCount из контекста
                setError(null); 
            } else {
                throw new Error(actionResult.error || "Unknown error fetching repository contents from action.");
            }
        } catch (e: any) {
            logger.error("[useRepoFetcher fetchRepoContents] Fetch error:", e);
            const errorMessage = e.message || "Неизвестная ошибка при загрузке файлов.";
            setError(errorMessage);
            result.error = errorMessage;
            setFiles([]);
            onSetFilesFetched(false, [], null, { component: [], context: [], hook: [], lib: [], other: [] });

            if (isRetry && retryCount >= maxRetries -1) { // Используем maxRetries из контекста
                logger.warn(`[useRepoFetcher fetchRepoContents] Max retries (${maxRetries}) reached for ${repoUrl}.`);
                setFetchStatus('failed_retries'); // Используем setFetchStatus из контекста
                currentFetchOpStatus = 'failed_retries';
                addToast(`Достигнуто макс. попыток загрузки для ${repoUrl.split('/').pop()}.`, "error");
            } else {
                setFetchStatus('error');  // Используем setFetchStatus из контекста
                currentFetchOpStatus = 'error';
            }
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
            setProgress(100); 
            activeImageTaskRef.current = null; 
            logger.info(`[useRepoFetcher fetchRepoContents] Finished. Operation Status: ${currentFetchOpStatus}. Context FetchStatus at call time: ${currentContextFetchStatus}`);
        }
        return result;
    }, [
        repoUrl, onSetFilesFetched, setFetchStatus, addToast, currentBranchName, retryCount, 
        fetchStatusFromContext, maxRetries, setRetryCount // Добавляем зависимости из контекста
    ]);

    logger.debug("[useRepoFetcher] Before Callbacks");

    useEffect(() => {
        if (fetchStatusFromContext === 'error' && retryCount < maxRetries && !isFetchingRef.current) { 
            const timeoutId = setTimeout(() => {
                logger.info(`[useRepoFetcher AutoRetry] Retrying fetch (${retryCount + 1}/${maxRetries})...`);
                setRetryCount(prev => prev + 1); // Используем setRetryCount из контекста
                fetchRepoContents(true, currentBranchName, activeImageTaskRef.current) 
                    .catch(e => logger.error("[useRepoFetcher AutoRetry] Error in scheduled retry:", e));
            }, RETRY_DELAY_MS);
            return () => clearTimeout(timeoutId);
        }
    }, [fetchStatusFromContext, retryCount, maxRetries, fetchRepoContents, currentBranchName, setRetryCount]); // Добавляем зависимости из контекста
    logger.debug("[useRepoFetcher] After Callbacks and Effects");

    const derivedIsLoading = loading || fetchStatusFromContext === 'loading' || fetchStatusFromContext === 'retrying';
    logger.debug(`[useRepoFetcher Derived State] isLoading=${derivedIsLoading}, isFetchDisabled=${isFetchDisabled}`);

    logger.debug("[useRepoFetcher] Hook End - Returning values");
    return {
        repoUrl,
        setRepoUrl,
        files,
        setFiles, 
        loading: derivedIsLoading, 
        error,
        setError, 
        progress,
        isFetchDisabled, 
        setIsFetchDisabled, 
        retryCount, // Возвращаем из контекста
        maxRetries, // Возвращаем из контекста
        triggerFetch: fetchRepoContents, 
        isFetchingRef, 
        isAutoFetchingRef 
    };
};