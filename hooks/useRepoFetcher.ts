import { useState, useCallback, useRef, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { FileNode, ImageReplaceTask, FetchStatus, ImportCategory, SimplePullRequest, TargetPrData } from '@/contexts/RepoXmlPageContext';
import { useRepoXmlPageContext } from '@/contexts/RepoXmlPageContext';
import { fetchRepoContents as fetchRepoContentsAction } from '@/app/actions_github/actions'; 
import * as repoUtils from "@/lib/repoUtils"; // Для вычисления highlights

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
                githubToken || undefined, 
                activeImageTaskRef.current
            );

            stopProgressSimulation(); 

            if (actionResult.success && Array.isArray(actionResult.files)) {
                const fetchedFilesData = actionResult.files;
                logger.info(`[useRepoFetcher handleFetchManual] Fetch successful. Files: ${fetchedFilesData.length}`);
                setFilesLocal(fetchedFilesData);
                setProgressLocal(100); 

                let primaryHighlight: string | null = null;
                let secondaryHighlights: Record<ImportCategory, string[]> = { component: [], context: [], hook: [], lib: [], other: [] };

                if (highlightedPathFromUrl && fetchedFilesData.length > 0) {
                    const allPaths = fetchedFilesData.map(f => f.path);
                    if (allPaths.includes(highlightedPathFromUrl)) {
                        primaryHighlight = highlightedPathFromUrl;
                        // Логика для secondaryHighlights (если нужна здесь) должна быть добавлена.
                        // Например, на основе импортов из primaryHighlight файла.
                        // Для простоты, сейчас оставляем secondaryHighlights пустыми, если они не приходят с сервера.
                        // Если actionResult возвращает их, можно использовать actionResult.secondaryHighlightedPaths
                    }
                } else if (actionResult.primaryHighlightedPath) { // Если сервер вернул основной хайлайт
                    primaryHighlight = actionResult.primaryHighlightedPath;
                }
                if (actionResult.secondaryHighlightedPaths) { // Если сервер вернул вторичные хайлайты
                    secondaryHighlights = actionResult.secondaryHighlightedPaths;
                }
                
                onSetFilesFetched( 
                    true, 
                    fetchedFilesData, 
                    primaryHighlight, 
                    secondaryHighlights
                );
                setRetryCount(0); 
                setErrorLocal(null);
            } else {
                const errorMsg = actionResult.error || "Unknown error: Fetched data is not in expected format.";
                logger.error(`[useRepoFetcher handleFetchManual] Fetch action failed or returned invalid data. Error: ${errorMsg}`);
                throw new Error(errorMsg);
            }
        } catch (e: any) {
            stopProgressSimulation(); 
            logger.error("[useRepoFetcher handleFetchManual] Catch block error:", e);
            const errorMessage = e.message || "Неизвестная ошибка при обработке ответа сервера.";
            setErrorLocal(errorMessage); 
            setFilesLocal([]);
            setProgressLocal(0); 

            onSetFilesFetched(false, [], null, { component: [], context: [], hook: [], lib: [], other: [] });

            if (isRetry && retryCount >= MAX_RETRIES - 1) {
                logger.warn(`[useRepoFetcher handleFetchManual] Max retries (${MAX_RETRIES}) reached for ${currentRepoUrlToFetch}.`);
                addToast(errorMessage + ` (Достигнуто макс. попыток: ${MAX_RETRIES})`, "error"); 
                setFetchStatus('failed_retries'); 
            } else {
                 addToast(errorMessage + (isRetry ? ` (Попытка ${retryCount +1}/${MAX_RETRIES})` : ` (Попытка 1/${MAX_RETRIES})`), "error");
            }
        } finally {
            setLoadingLocal(false); 
            isFetchingRef.current = false;
            // Используем актуальный fetchStatusFromContext для установки прогресса
            // Это значение будет обновлено после вызова onSetFilesFetched
            const finalContextStatus = fetchStatusFromContext; 
            if (finalContextStatus === 'success') setProgressLocal(100);
            else if (finalContextStatus === 'failed_retries' || (finalContextStatus === 'error' && retryCount >= MAX_RETRIES -1)) setProgressLocal(0);
            else if (finalContextStatus === 'loading' || finalContextStatus === 'retrying') { /*Оставить текущий симулированный прогресс*/ }
            else { setProgressLocal(0); /* Для других состояний, например idle после ошибки */ }


            logger.info(`[useRepoFetcher handleFetchManual] Finished. Current localLoading: ${loadingLocal}, Context FetchStatus (at finally): ${finalContextStatus}`);
        }
    }, [
        repoUrl, currentBranchName, githubToken, addToast, onSetFilesFetched, setFetchStatus, 
        retryCount, setRetryCount, highlightedPathFromUrl, logger, startProgressSimulation, stopProgressSimulation, fetchStatusFromContext
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
    
    const uiIsLoading = loadingLocal || fetchStatusFromContext === 'loading' || fetchStatusFromContext === 'retrying'; 
    const derivedIsFetchDisabled = uiIsLoading || loadingPrs || !contextRepoUrl || assistantLoading || isParsing || aiActionLoading;

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