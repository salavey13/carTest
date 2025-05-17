"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRepoContents } from "@/app/actions_github/actions"; // getOpenPullRequests removed as it's not used here
import {
    useRepoXmlPageContext, FetchStatus, FileNode,
    ImportCategory, ImageReplaceTask, IconReplaceTask, // Added IconReplaceTask for type checking
    PendingFlowDetails
} from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import * as repoUtils from "@/lib/repoUtils";
import { useAppToast } from "@/hooks/useAppToast";

interface UseRepoFetcherProps {
    repoUrl: string;
    token: string;
    targetBranchName: string | null;
    manualBranchName: string;
    imageReplaceTask: ImageReplaceTask | null; // This can be ImageReplaceTask or IconReplaceTask passed as ImageReplaceTask
    highlightedPathFromUrl: string;
    importantFiles: string[];
    // autoFetch: boolean; // Removed autoFetch
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
        branchNameToFetchOverride?: string | null
    ) => Promise<void>; 
    isLoading: boolean;
    isFetchDisabled: boolean;
}

export const useRepoFetcher = ({
    repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask, 
    highlightedPathFromUrl, importantFiles, /* autoFetch, */ ideaFromUrl, isSettingsModalOpen, // autoFetch removed
    repoUrlEntered, loadingPrs, assistantLoading, isParsing, aiActionLoading,
}: UseRepoFetcherProps): UseRepoFetcherReturn => {
    const {
        fetchStatus, setFetchStatus, handleSetFilesFetched, setSelectedFetcherFiles,
        setRequestCopied, 
        triggerToggleSettingsModal, setKworkInputValue,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        pendingFlowDetails, iconReplaceTask // Get iconReplaceTask from context if needed for differentiation
    } = useRepoXmlPageContext();
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning, loading: toastLoading } = useAppToast();

    const [files, setFiles] = useState<FileNode[]>([]);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });

    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchInitiatedRef = useRef(false);
    // isAutoFetchingRef removed as autoFetch is removed
    const fetchStatusRef = useRef(fetchStatus);
    const activeVisualTaskRef = useRef(imageReplaceTask || (iconReplaceTask as unknown as ImageReplaceTask | null)); // Store the active task
    const pendingFlowDetailsRef = useRef(pendingFlowDetails);

    useEffect(() => {
        return () => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); } };
    }, []);
    useEffect(() => { fetchStatusRef.current = fetchStatus; }, [fetchStatus]);
    useEffect(() => { 
        activeVisualTaskRef.current = imageReplaceTask || (iconReplaceTask as unknown as ImageReplaceTask | null);
     }, [imageReplaceTask, iconReplaceTask]);
    useEffect(() => { pendingFlowDetailsRef.current = pendingFlowDetails; }, [pendingFlowDetails]);

    const stopProgressSimulation = useCallback(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; } }, []);
    const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => { stopProgressSimulation(); setProgress(0); const ticks = estimatedDurationSeconds * 5; const increment = ticks > 0 ? 100 / ticks : 100; progressIntervalRef.current = setInterval(() => { setProgress(prev => { const currentContextStatus = fetchStatusRef.current; if (currentContextStatus !== 'loading' && currentContextStatus !== 'retrying') { stopProgressSimulation(); return currentContextStatus === 'success' ? 100 : prev; } const nextProgress = prev + increment; if (nextProgress >= 95) { stopProgressSimulation(); return 95; } return nextProgress; }); }, 200); }, [stopProgressSimulation]);

    const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null
    ) => {
        const finalBranchToFetch = branchNameToFetchOverride !== undefined ? branchNameToFetchOverride : (targetBranchName ?? manualBranchName) || null;
        const effectiveBranchDisplay = finalBranchToFetch || 'default';
        
        const currentFlowContext = pendingFlowDetailsRef.current; 
        const currentActiveVisualTask = activeVisualTaskRef.current;
        const isActualImageTask = currentActiveVisualTask && 'oldUrl' in currentActiveVisualTask; // Check if it's ImageReplaceTask
        
        const isVisualFlow = !!currentActiveVisualTask;
        const isErrorFixFlow = currentFlowContext?.type === 'ErrorFix';
        const isDedicatedFlow = isVisualFlow || isErrorFixFlow;

        let currentTargetPath: string | null = null;
        if (currentActiveVisualTask) {
            currentTargetPath = currentActiveVisualTask.targetPath;
        } else if (isErrorFixFlow && currentFlowContext) {
            currentTargetPath = currentFlowContext.targetPath;
        }
        
        logger.debug(`[useRepoFetcher handleFetchManual] Args: isRetry=${isManualRetry}, branch=${effectiveBranchDisplay}, isDedicatedFlow=${isDedicatedFlow}, visualFlowType=${isVisualFlow ? (isActualImageTask ? 'Image' : 'Icon') : 'None'}, errorFixFlow=${isErrorFixFlow}, targetPath=${currentTargetPath}`);

        if (isFetchInitiatedRef.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { return; }
        if (!repoUrl.trim()) { setError("URL репозитория не указан."); triggerToggleSettingsModal(); return; }
        if (loadingPrs || assistantLoading || isParsing || aiActionLoading) { return; }

        setFetchStatus('loading'); setError(null); setFiles([]); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setSelectedFetcherFiles(new Set());
        isFetchInitiatedRef.current = true;
        if (!isDedicatedFlow) { setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setKworkInputValue(""); }
        else if (isVisualFlow) { setKworkInputValue(""); }

        const fetchToastId = toastLoading(`Запрос файлов из ветки (${effectiveBranchDisplay})...`, { duration: 15000 });
        startProgressSimulation(13);
        let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        let fetchAttemptSucceeded = false;
        let fetchedFilesData: FileNode[] = [];
        let primaryHighlightPathInternal: string | null = null;
        let secondaryHighlightPathsDataInternal: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
        let filesToAutoSelect = new Set<string>();

        try {
            fetchResult = await fetchRepoContents(repoUrl, token || undefined, finalBranchToFetch);
            if (fetchResult?.success && Array.isArray(fetchResult.files)) {
                fetchAttemptSucceeded = true; fetchedFilesData = fetchResult.files;
                const allPaths = fetchedFilesData.map(f => f.path);

                if ((isVisualFlow || isErrorFixFlow) && currentTargetPath) {
                    const flowName = isVisualFlow ? (isActualImageTask ? "Image Flow" : "Icon Flow") : "Error Fix";
                    primaryHighlightPathInternal = currentTargetPath;
                    if (!allPaths.includes(primaryHighlightPathInternal)) { 
                        const errorMsg = `Файл (${primaryHighlightPathInternal}) для '${flowName}' не найден в ветке ${effectiveBranchDisplay}.`; 
                        setError(errorMsg); toastError(errorMsg, { id: fetchToastId }); fetchAttemptSucceeded = false; 
                    } else { 
                        const successMsg = `Файл для '${flowName}' (${primaryHighlightPathInternal.split('/').pop()}) загружен.`; 
                        toastSuccess(successMsg, { id: fetchToastId }); 
                        if (isErrorFixFlow) filesToAutoSelect.add(primaryHighlightPathInternal); 
                    }
                    secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] };
                 } else { 
                     primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
                     if (highlightedPathFromUrl) {
                        primaryHighlightPathInternal = repoUtils.getPageFilePath(highlightedPathFromUrl, allPaths);
                        if (primaryHighlightPathInternal) {
                             const primaryFileNode = fetchedFilesData.find(f => f.path === primaryHighlightPathInternal);
                             if (primaryFileNode) {
                                 filesToAutoSelect.add(primaryHighlightPathInternal);
                                 const imports = repoUtils.extractImports(primaryFileNode.content);
                                 const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                                 imports.forEach(imp => { const resolvedPath = repoUtils.resolveImportPath(imp, primaryFileNode.path, fetchedFilesData); if (resolvedPath && resolvedPath !== primaryHighlightPathInternal && allPaths.includes(resolvedPath)) { const category = repoUtils.categorizeResolvedPath(resolvedPath); tempSecPathsSet[category].add(resolvedPath); if (['component', 'context', 'hook', 'lib'].includes(category)) { filesToAutoSelect.add(resolvedPath); } } });
                                 secondaryHighlightPathsDataInternal = { component: Array.from(tempSecPathsSet.component), context: Array.from(tempSecPathsSet.context), hook: Array.from(tempSecPathsSet.hook), lib: Array.from(tempSecPathsSet.lib), other: Array.from(tempSecPathsSet.other) };
                             } else { primaryHighlightPathInternal = null; toastError(`Ошибка: Данные для файла (${highlightedPathFromUrl}) не найдены.`, { id: fetchToastId }); }
                         } else { toastWarning(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, { id: fetchToastId }); }
                     }
                     importantFiles.forEach(p => { if (allPaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); } });
                     if (filesToAutoSelect.size > 0) { const numSecondary = Object.values(secondaryHighlightPathsDataInternal).flat().filter(p => p !== primaryHighlightPathInternal && !importantFiles.includes(p)).length; const numImportant = filesToAutoSelect.size - (primaryHighlightPathInternal ? 1 : 0) - numSecondary; let msg = `✅ Авто-выбор: `; const parts = []; if (primaryHighlightPathInternal) parts.push(`1 стр.`); if (numSecondary > 0) parts.push(`${numSecondary} связ.`); if (numImportant > 0) parts.push(`${numImportant} важн.`); msg += parts.join(', ') + ` (${filesToAutoSelect.size} всего).`; toastSuccess(msg, { id: fetchToastId }); }
                     else if (primaryHighlightPathInternal === null && highlightedPathFromUrl) { toastSuccess(`Извлечено ${fetchedFilesData.length} файлов из ${effectiveBranchDisplay}! (Целевой URL файл не найден)`, { id: fetchToastId }); }
                     else if (fetchAttemptSucceeded) { toastSuccess(`Извлечено ${fetchedFilesData.length} файлов из ${effectiveBranchDisplay}!`, { id: fetchToastId }); }
                }
            } else { fetchAttemptSucceeded = false; throw new Error(fetchResult?.error || `Не удалось получить файлы из ${effectiveBranchDisplay}.`); }
        } catch (err: any) { const displayError = err?.message || "Неизвестная ошибка."; setError(displayError); toastError(`Ошибка: ${displayError}`, { id: fetchToastId }); fetchAttemptSucceeded = false; fetchedFilesData = []; primaryHighlightPathInternal = null; secondaryHighlightPathsDataInternal = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set(); }
        finally {
             stopProgressSimulation();
             setFiles(fetchedFilesData); 
             setPrimaryHighlightedPathState(primaryHighlightPathInternal); 
             setSecondaryHighlightedPathsState(secondaryHighlightPathsDataInternal); 
             handleSetFilesFetched(
                 fetchAttemptSucceeded,
                 fetchedFilesData,
                 primaryHighlightPathInternal,
                 secondaryHighlightPathsDataInternal
             );
             if (fetchAttemptSucceeded && filesToAutoSelect.size > 0) {
                 setSelectedFetcherFiles(filesToAutoSelect);
             }
             setProgress(fetchAttemptSucceeded ? 100 : 0);
             isFetchInitiatedRef.current = false;
             if(isSettingsModalOpen && fetchAttemptSucceeded) {
                 triggerToggleSettingsModal();
             }
        }
    }, [ 
        repoUrl, token, targetBranchName, manualBranchName, 
        highlightedPathFromUrl, importantFiles, 
        isSettingsModalOpen, loadingPrs, assistantLoading, isParsing, aiActionLoading,
        setFetchStatus, handleSetFilesFetched, setSelectedFetcherFiles,
        setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setKworkInputValue,
        triggerToggleSettingsModal,
        setError, setFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
        startProgressSimulation, stopProgressSimulation,
        toastSuccess, toastError, toastInfo, toastWarning, toastLoading,
        // No direct dependency on imageReplaceTask or iconReplaceTask from context here, 
        // as their current values are read via refs (activeVisualTaskRef, pendingFlowDetailsRef)
        // to avoid re-triggering this whole callback when they change during its execution.
    ]);

    // useEffect for autoFetch based on URL params is removed
    // The ideaProp useEffect in RepoTxtFetcher.tsx now handles the initial trigger

    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading;

    return {
        files, progress, error, primaryHighlightedPath, secondaryHighlightedPaths,
        handleFetchManual, isLoading, isFetchDisabled,
    };
};