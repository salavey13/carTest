"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
import { useAppToast } from '@/hooks/useAppToast';
export interface FileNode { path: string; content: string; }
export interface SimplePullRequest { id: number; number: number; title: string; html_url: string; user: { login: string | null; avatar_url: string | null } | null; head: { ref: string }; base: { ref: string }; updated_at: string; }
import { debugLogger as logger } from '@/lib/debugLogger';
import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions';
import type { RepoTxtFetcherRef } from '@/components/RepoTxtFetcher';
import type { AICodeAssistantRef } from '@/components/AICodeAssistant';


export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
export type WorkflowStep = | 'idle' | 'ready_to_fetch' | 'fetching' | 'fetch_failed' | 'files_fetched' | 'files_fetched_highlights' | 'files_fetched_image_replace' | 'files_selected' | 'request_written' | 'request_copied' | 'generating_ai_response' | 'response_pasted' | 'parsing_response' | 'pr_ready';
export interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; }

// --- Context Interface ---
interface RepoXmlPageContextType {
    // State Flags
    fetchStatus: FetchStatus;
    repoUrlEntered: boolean;
    filesFetched: boolean;
    kworkInputHasContent: boolean;
    requestCopied: boolean;
    aiResponseHasContent: boolean;
    filesParsed: boolean;
    assistantLoading: boolean;
    aiActionLoading: boolean;
    loadingPrs: boolean;
    isSettingsModalOpen: boolean;
    isParsing: boolean;
    // State Data
    selectedFetcherFiles: Set<string>;
    selectedAssistantFiles: Set<string>;
    targetBranchName: string | null;
    manualBranchName: string;
    openPrs: SimplePullRequest[];
    currentAiRequestId: string | null;
    imageReplaceTask: ImageReplaceTask | null;
    allFetchedFiles: FileNode[];
    currentStep: WorkflowStep;
    repoUrl: string;
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: Record<ImportCategory, string[]>;
    // NEW: Target PR Data
    targetPrData: { number: number; url: string } | null;

    // Setters (Stable Callbacks)
    setFetchStatus: React.Dispatch<React.SetStateAction<FetchStatus>>;
    setRepoUrlEntered: React.Dispatch<React.SetStateAction<boolean>>;
    handleSetFilesFetched: ( fetched: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: Record<ImportCategory, string[]> ) => void;
    setSelectedFetcherFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setKworkInputHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setRequestCopied: React.Dispatch<React.SetStateAction<boolean>>;
    setAiResponseHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setFilesParsed: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedAssistantFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setAssistantLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setAiActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setLoadingPrs: React.Dispatch<React.SetStateAction<boolean>>;
    setTargetBranchName: React.Dispatch<React.SetStateAction<string | null>>;
    setManualBranchName: React.Dispatch<React.SetStateAction<string>>;
    setOpenPrs: React.Dispatch<React.SetStateAction<SimplePullRequest[]>>;
    setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setContextIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentAiRequestId: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    setRepoUrl: React.Dispatch<React.SetStateAction<string>>;
    // NEW: Target PR Data Setter
    setTargetPrData: React.Dispatch<React.SetStateAction<{ number: number; url: string } | null>>;

    // Triggers (Stable Callbacks)
    triggerToggleSettingsModal: () => void;
    triggerFetch: (isRetry?: boolean, branch?: string | null) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (clearSelection?: boolean) => Promise<void>;
    triggerCopyKwork: () => boolean;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreateOrUpdatePR: () => Promise<void>;
    triggerUpdateBranch: ( repoUrl: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ) => Promise<{ success: boolean; error?: string }>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    updateRepoUrlInAssistant: (url: string) => void;
    getXuinityMessage: () => string;
    scrollToSection: (sectionId: string) => void;
    triggerAddImportantToKwork: () => void;
    triggerAddTreeToKwork: () => void;
    triggerSelectAllFetcherFiles: () => void;
    triggerDeselectAllFetcherFiles: () => void;
    triggerClearKworkInput: () => void;

    // Refs
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;

    // Utilities
    addToast: (message: string | React.ReactNode, type?: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message', duration?: number, options?: any) => void;
    getKworkInputValue: () => string;
    updateKworkInput: (value: string) => void;
}

// --- Default Context Value ---
const defaultContextValue: Partial<RepoXmlPageContextType> = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', repoUrl: "https://github.com/salavey13/carTest", primaryHighlightedPath: null, secondaryHighlightedPaths: { component: [], context: [], hook: [], lib: [], other: [] }, targetPrData: null,
    setFetchStatus: () => { logger.warn("setFetchStatus called on default context value"); },
    setRepoUrlEntered: () => { logger.warn("setRepoUrlEntered called on default context value"); },
    handleSetFilesFetched: () => { logger.warn("handleSetFilesFetched called on default context value"); },
    setSelectedFetcherFiles: () => { logger.warn("setSelectedFetcherFiles called on default context value"); },
    setKworkInputHasContent: () => { logger.warn("setKworkInputHasContent called on default context value"); },
    setRequestCopied: () => { logger.warn("setRequestCopied called on default context value"); },
    setAiResponseHasContent: () => { logger.warn("setAiResponseHasContent called on default context value"); },
    setFilesParsed: () => { logger.warn("setFilesParsed called on default context value"); },
    setSelectedAssistantFiles: () => { logger.warn("setSelectedAssistantFiles called on default context value"); },
    setAssistantLoading: () => { logger.warn("setAssistantLoading called on default context value"); },
    setAiActionLoading: () => { logger.warn("setAiActionLoading called on default context value"); },
    setLoadingPrs: () => { logger.warn("setLoadingPrs called on default context value"); },
    setTargetBranchName: () => { logger.warn("setTargetBranchName called on default context value"); },
    setManualBranchName: () => { logger.warn("setManualBranchName called on default context value"); },
    setOpenPrs: () => { logger.warn("setOpenPrs called on default context value"); },
    setIsParsing: () => { logger.warn("setIsParsing called on default context value"); },
    setContextIsParsing: () => { logger.warn("setContextIsParsing called on default context value"); },
    setCurrentAiRequestId: () => { logger.warn("setCurrentAiRequestId called on default context value"); },
    setImageReplaceTask: () => { logger.warn("setImageReplaceTask called on default context value"); },
    setRepoUrl: () => { logger.warn("setRepoUrl called on default context value"); },
    setTargetPrData: () => { logger.warn("setTargetPrData called on default context value"); },
    triggerToggleSettingsModal: () => { logger.warn("triggerToggleSettingsModal called on default context value"); },
    triggerFetch: async () => { logger.warn("triggerFetch called on default context value"); },
    triggerSelectHighlighted: () => { logger.warn("triggerSelectHighlighted called on default context value"); },
    triggerAddSelectedToKwork: async () => { logger.warn("triggerAddSelectedToKwork called on default context value"); },
    triggerCopyKwork: () => { logger.warn("triggerCopyKwork called on default context value"); return false; },
    triggerAskAi: async () => { logger.warn("triggerAskAi called on default context value"); return { success: false, error: "Context not ready" }; },
    triggerParseResponse: async () => { logger.warn("triggerParseResponse called on default context value"); },
    triggerSelectAllParsed: () => { logger.warn("triggerSelectAllParsed called on default context value"); },
    triggerCreateOrUpdatePR: async () => { logger.warn("triggerCreateOrUpdatePR called on default context value"); },
    triggerUpdateBranch: async () => { logger.warn("triggerUpdateBranch called on default context value"); return { success: false, error: "Context not ready" }; },
    triggerGetOpenPRs: async () => { logger.warn("triggerGetOpenPRs called on default context value"); },
    updateRepoUrlInAssistant: () => { logger.warn("updateRepoUrlInAssistant called on default context value"); },
    getXuinityMessage: () => "Initializing...",
    scrollToSection: () => { logger.warn("scrollToSection called on default context value"); },
    triggerAddImportantToKwork: () => { logger.warn("triggerAddImportantToKwork called on default context value"); },
    triggerAddTreeToKwork: () => { logger.warn("triggerAddTreeToKwork called on default context value"); },
    triggerSelectAllFetcherFiles: () => { logger.warn("triggerSelectAllFetcherFiles called on default context value"); },
    triggerDeselectAllFetcherFiles: () => { logger.warn("triggerDeselectAllFetcherFiles called on default context value"); },
    triggerClearKworkInput: () => { logger.warn("triggerClearKworkInput called on default context value"); },
    kworkInputRef: { current: null }, aiResponseInputRef: { current: null }, fetcherRef: { current: null }, assistantRef: { current: null },
    addToast: () => { logger.warn("addToast called on default context value"); },
    getKworkInputValue: () => { logger.warn("getKworkInputValue called on default context value"); return ""; },
    updateKworkInput: () => { logger.warn("updateKworkInput called on default context value"); },
};

// --- Context Creation ---
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(defaultContextValue as RepoXmlPageContextType);

// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
    // Wrap provider initialization in try-catch
    try {
        logger.log("[RepoXmlPageProvider] Initializing...");

        // --- State Initialization ---
        logger.debug("[RepoXmlPageProvider] Initializing State...");
        const [fetchStatusState, setFetchStatusState] = useState<FetchStatus>('idle');
        const [repoUrlEnteredState, setRepoUrlEnteredState] = useState<boolean>(false);
        const [filesFetchedState, setFilesFetchedState] = useState<boolean>(false);
        const [primaryHighlightPathState, setPrimaryHighlightPathState] = useState<string | null>(null);
        const [secondaryHighlightPathsState, setSecondaryHighlightPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
        const [selectedFetcherFilesState, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
        const [kworkInputHasContentState, setKworkInputHasContentState] = useState<boolean>(false);
        const [requestCopiedState, setRequestCopiedState] = useState<boolean>(false);
        const [aiResponseHasContentState, setAiResponseHasContentState] = useState<boolean>(false);
        const [filesParsedState, setFilesParsedState] = useState<boolean>(false);
        const [selectedAssistantFilesState, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());
        const [assistantLoadingState, setAssistantLoadingState] = useState<boolean>(false);
        const [aiActionLoadingState, setAiActionLoadingState] = useState<boolean>(false);
        const [loadingPrsState, setLoadingPrsState] = useState<boolean>(false);
        const [targetBranchNameState, setTargetBranchNameState] = useState<string | null>(null);
        const [manualBranchNameState, setManualBranchNameState] = useState<string>('');
        const [openPrsState, setOpenPrsState] = useState<SimplePullRequest[]>([]);
        const [isSettingsModalOpenState, setIsSettingsModalOpenState] = useState<boolean>(false);
        const [isParsingState, setIsParsingState] = useState<boolean>(false);
        const [currentAiRequestIdState, setCurrentAiRequestIdState] = useState<string | null>(null);
        const [imageReplaceTaskState, setImageReplaceTaskState] = useState<ImageReplaceTask | null>(null);
        const [allFetchedFilesState, setAllFetchedFilesState] = useState<FileNode[]>([]);
        const [repoUrlState, setRepoUrlState] = useState<string>(defaultContextValue.repoUrl ?? '');
        // NEW State for PR data
        const [targetPrDataState, setTargetPrDataState] = useState<{ number: number; url: string } | null>(null);
        logger.debug("[RepoXmlPageProvider] State initialized.");

        // --- Refs ---
        const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
        const assistantRef = useRef<AICodeAssistantRef | null>(null);
        const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
        const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
        logger.debug("[RepoXmlPageProvider] Refs initialized.");

        // --- Hooks ---
        let appToast: ReturnType<typeof useAppToast>;
        try {
          appToast = useAppToast();
          logger.debug("[RepoXmlPageProvider] useAppToast initialized.");
        } catch (e) {
          logger.fatal("[RepoXmlPageProvider] CRITICAL ERROR initializing useAppToast:", e);
          appToast = { // Dummy fallback
            success: (m) => logger.error("Toast (success) suppressed, hook failed:", m), error: (m) => logger.error("Toast (error) suppressed, hook failed:", m), info: (m) => logger.warn("Toast (info) suppressed, hook failed:", m), warning: (m) => logger.warn("Toast (warning) suppressed, hook failed:", m), loading: (m) => logger.warn("Toast (loading) suppressed, hook failed:", m), message: (m) => logger.warn("Toast (message) suppressed, hook failed:", m), custom: (m) => logger.warn("Toast (custom) suppressed, hook failed:", m), dismiss: () => logger.warn("Toast (dismiss) suppressed, hook failed"),
          };
        }

        // --- addToast Stable Callback ---
        const addToastStable = useCallback((
            message: string | React.ReactNode,
            type: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' = 'info',
            duration: number = 3000,
            options: any = {}
        ) => {
            if (!appToast || typeof appToast.message !== 'function') {
                 logger.error("addToastStable cannot execute: appToast is invalid.", { message, type });
                 return;
            }
            const toastOptions = duration ? { ...options, duration } : options;
            switch (type) {
                case 'success': appToast.success(message, toastOptions); break;
                case 'error': appToast.error(message, toastOptions); break;
                case 'info': appToast.info(message, toastOptions); break;
                case 'warning': appToast.warning(message, toastOptions); break;
                case 'loading': appToast.loading(message, toastOptions); break;
                case 'message': default: appToast.message(message, toastOptions); break;
            }
        }, [appToast]);

        useEffect(() => {
            logger.log("[RepoXmlPageProvider] Mounted (Provider level)");
        }, []);

        useEffect(() => {
            logger.debug(`[RepoXmlPageProvider Effect] repoUrlState changed: ${repoUrlState}. Updating repoUrlEnteredState.`);
            setRepoUrlEnteredState(repoUrlState.trim().length > 0 && repoUrlState.includes("github.com"));
        }, [repoUrlState]);

        // --- Stable Setters ---
        const setFetchStatusStateStable = useCallback((status: FetchStatus | ((prevState: FetchStatus) => FetchStatus)) => { logger.debug(`[Context Setter] setFetchStatus: ${typeof status === 'function' ? 'function' : status}`); setFetchStatusState(status); }, []);
        const setRepoUrlEnteredStateStable = useCallback((entered: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setRepoUrlEntered: ${typeof entered === 'function' ? 'function' : entered}`); setRepoUrlEnteredState(entered); }, []);
        const setSelectedFetcherFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => { logger.debug(`[Context Setter] setSelectedFetcherFiles size: ${typeof files === 'function' ? 'function' : files.size}`); setSelectedFetcherFilesState(files); }, []);
        const setKworkInputHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setKworkInputHasContent: ${typeof hasContent === 'function' ? 'function' : hasContent}`); setKworkInputHasContentState(hasContent); }, []);
        const setRequestCopiedStateStable = useCallback((copied: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setRequestCopied: ${typeof copied === 'function' ? 'function' : copied}`); setRequestCopiedState(copied); }, []);
        const setAiResponseHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setAiResponseHasContent: ${typeof hasContent === 'function' ? 'function' : hasContent}`); setAiResponseHasContentState(hasContent); }, []);
        const setFilesParsedStateStable = useCallback((parsed: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setFilesParsed: ${typeof parsed === 'function' ? 'function' : parsed}`); setFilesParsedState(parsed); }, []);
        const setSelectedAssistantFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => { logger.debug(`[Context Setter] setSelectedAssistantFiles size: ${typeof files === 'function' ? 'function' : files.size}`); setSelectedAssistantFilesState(files); }, []);
        const setAssistantLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setAssistantLoading: ${typeof loading === 'function' ? 'function' : loading}`); setAssistantLoadingState(loading); }, []);
        const setAiActionLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setAiActionLoading: ${typeof loading === 'function' ? 'function' : loading}`); setAiActionLoadingState(loading); }, []);
        const setLoadingPrsStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setLoadingPrs: ${typeof loading === 'function' ? 'function' : loading}`); setLoadingPrsState(loading); }, []);
        const setTargetBranchNameStateStable = useCallback((name: string | null | ((prevState: string | null) => string | null)) => { logger.debug(`[Context Setter] setTargetBranchName: ${typeof name === 'function' ? 'function' : name}`); setTargetBranchNameState(name); }, []);
        const setManualBranchNameStateStable = useCallback((name: string | ((prevState: string) => string)) => { logger.debug(`[Context Setter] setManualBranchName: ${typeof name === 'function' ? 'function' : name}`); setManualBranchNameState(name); }, []);
        const setOpenPrsStateStable = useCallback((prs: SimplePullRequest[] | ((prevState: SimplePullRequest[]) => SimplePullRequest[])) => { logger.debug(`[Context Setter] setOpenPrs count: ${typeof prs === 'function' ? 'function' : prs.length}`); setOpenPrsState(prs); }, []);
        const setIsParsingStateStable = useCallback((parsing: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setIsParsing: ${typeof parsing === 'function' ? 'function' : parsing}`); setIsParsingState(parsing); }, []);
        const setCurrentAiRequestIdStateStable = useCallback((id: string | null | ((prevState: string | null) => string | null)) => { logger.debug(`[Context Setter] setCurrentAiRequestId: ${typeof id === 'function' ? 'function' : id?.substring(0,6)}`); setCurrentAiRequestIdState(id); }, []);
        const setImageReplaceTaskStateStable = useCallback((task: ImageReplaceTask | null | ((prevState: ImageReplaceTask | null) => ImageReplaceTask | null)) => { logger.debug(`[Context Setter] setImageReplaceTask: ${typeof task === 'function' ? 'function' : !!task}`); setImageReplaceTaskState(task); }, []);
        const setAllFetchedFilesStateStable = useCallback((files: FileNode[] | ((prevState: FileNode[]) => FileNode[])) => { logger.debug(`[Context Setter] setAllFetchedFiles count: ${typeof files === 'function' ? 'function' : files.length}`); setAllFetchedFilesState(files); }, []);
        const setRepoUrlStateStable = useCallback((url: string | ((prevState: string) => string)) => { logger.debug(`[Context Setter] setRepoUrl`); setRepoUrlState(url); }, []);
        // NEW Setter for PR Data
        const setTargetPrDataStable = useCallback((data: { number: number; url: string } | null | ((prevState: { number: number; url: string } | null) => { number: number; url: string } | null)) => { logger.debug(`[Context Setter] setTargetPrData: ${typeof data === 'function' ? 'function' : data ? `PR #${data.number}`: 'null'}`); setTargetPrDataState(data); }, []);

        // --- Handlers and Triggers ---
        const handleSetFilesFetchedStable = useCallback(( fetched: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: Record<ImportCategory, string[]> ) => {
           logger.debug(`[Context] handleSetFilesFetchedStable called. fetched=${fetched}, allFiles=${allFiles?.length}, primary=${primaryHighlight}`);
           const currentTask = imageReplaceTaskState;
           setFilesFetchedState(fetched);
           if (fetched) {
               logger.log(`[Context] Setting allFetchedFilesState: ${allFiles?.length} files`);
               setAllFetchedFilesStateStable(allFiles ?? []);
           } else {
               logger.log(`[Context] Clearing allFetchedFilesState because fetched=${fetched}`);
               setAllFetchedFilesStateStable([]);
           }
           setPrimaryHighlightPathState(primaryHighlight);
           setSecondaryHighlightPathsState(secondaryHighlights ?? { component: [], context: [], hook: [], lib: [], other: [] });

           let finalFetchStatus: FetchStatus = fetched ? 'success' : 'error';
           if (currentTask) {
               logger.debug("[Context] handleSetFilesFetchedStable - Processing Image Task");
               if (fetched) {
                   const targetFileExists = (allFiles ?? []).some(f => f.path === currentTask.targetPath);
                   if (!targetFileExists) {
                       logger.error(`[Context] Image Task Failure: Target file ${currentTask.targetPath} not found!`);
                       finalFetchStatus = 'error';
                       addToastStable(`Ошибка Задачи Изображения: Целевой файл ${currentTask.targetPath} не найден!`, 'error', 5000);
                       setImageReplaceTaskStateStable(null);
                       setFilesFetchedState(false);
                       setAllFetchedFilesStateStable([]);
                   } else {
                       logger.info(`[Context] Image Task: Target file ${currentTask.targetPath} found. Triggering replacement.`);
                       finalFetchStatus = 'success';
                       if (assistantRef.current && typeof assistantRef.current.handleDirectImageReplace === 'function') {
                           logger.log(`[Context] Calling assistantRef.handleDirectImageReplace for task:`, currentTask);
                           assistantRef.current.handleDirectImageReplace(currentTask, allFiles ?? [])
                                .then(() => logger.log("[Context] handleDirectImageReplace promise resolved."))
                               .catch(replaceError => {
                                   logger.error("[Context] Issue calling handleDirectImageReplace:", replaceError);
                                   addToastStable(`Проблема при вызове замены изображения: ${replaceError?.message ?? 'Неизвестно'}`, 'error', 6000);
                               });
                       } else {
                            logger.fatal("[Context] CRITICAL PROBLEM: Cannot call handleDirectImageReplace.", { hasRef: !!assistantRef.current, hasMethod: typeof assistantRef.current?.handleDirectImageReplace });
                            addToastStable(`КРИТИЧЕСКАЯ ПРОБЛЕМА: Не удалось вызвать замену изображения.`, 'error', 7000);
                            finalFetchStatus = 'error';
                            setImageReplaceTaskStateStable(null);
                       }
                   }
               } else {
                    logger.error("[Context] Image Task Failure: Failed to fetch any files.");
                    finalFetchStatus = 'error';
                    addToastStable(`Ошибка Задачи Изображения: Не удалось загрузить файлы.`, 'error', 5000);
                    setFilesFetchedState(false);
                    setAllFetchedFilesStateStable([]);
               }
           }
           setFetchStatusStateStable(finalFetchStatus);
           logger.log(`[Context] handleSetFilesFetchedStable finished. Final Status: ${finalFetchStatus}, Files Fetched Flag: ${fetched}`);
        }, [ imageReplaceTaskState, addToastStable, assistantRef, setFetchStatusStateStable, setAllFetchedFilesStateStable, setImageReplaceTaskStateStable ]);

        const getKworkInputValueStable = useCallback((): string => kworkInputRef.current?.value || "", []);
        const updateKworkInputStable = useCallback((value: string) => { logger.log(`[Context] updateKworkInputStable called`); if (kworkInputRef.current) { kworkInputRef.current.value = value; setKworkInputHasContentStateStable(value.trim().length > 0); } }, [setKworkInputHasContentStateStable]);
        const triggerToggleSettingsModal = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerToggleSettingsModal`); setIsSettingsModalOpenState(prev => !prev); }, []);
        const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => { logger.log(`[DEBUG][CONTEXT] triggerFetch called. Ref ready: ${!!fetcherRef.current?.handleFetch}`); if (fetcherRef.current?.handleFetch) { try { await fetcherRef.current.handleFetch(isRetry, branch, imageReplaceTaskState); } catch (error: any) { logger.error("Error calling fetcherRef.handleFetch:", error); addToastStable(`Критическая ошибка при запуске извлечения: ${error?.message ?? 'Неизвестно'}`, "error", 5000); setFetchStatusStateStable('error'); } } else { logger.error("triggerFetch: fetcherRef is not set."); addToastStable("Ошибка: Не удалось запустить извлечение (ref).", "error"); } }, [imageReplaceTaskState, addToastStable, setFetchStatusStateStable, fetcherRef]);
        const triggerSelectHighlighted = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerSelectHighlighted called. Ref ready: ${!!fetcherRef.current?.selectHighlightedFiles}`); if (fetcherRef.current?.selectHighlightedFiles) { try { fetcherRef.current.selectHighlightedFiles(); } catch (error: any) { logger.error("Error calling fetcherRef.selectHighlightedFiles:", error); addToastStable(`Ошибка выбора связанных файлов: ${error?.message ?? 'Неизвестно'}`, "error"); } } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); } }, [addToastStable, fetcherRef]);
        const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => { logger.log(`[DEBUG][CONTEXT] triggerAddSelectedToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddSelected}. Selected: ${selectedFetcherFilesState.size}`); if (fetcherRef.current?.handleAddSelected) { if (selectedFetcherFilesState.size === 0) { addToastStable("Сначала выберите файлы в Экстракторе!", "warning"); return; } try { await fetcherRef.current.handleAddSelected(selectedFetcherFilesState, allFetchedFilesState); if (clearSelection) { setSelectedFetcherFilesStateStable(new Set()); } } catch (error: any) { logger.error("[Context] Error during handleAddSelected:", error); addToastStable(`Ошибка добавления файлов: ${error?.message ?? 'Неизвестно'}`, "error"); } } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); addToastStable("Ошибка: Компонент Экстрактора недоступен.", "error"); } }, [selectedFetcherFilesState, allFetchedFilesState, addToastStable, setSelectedFetcherFilesStateStable, fetcherRef]);
        const triggerCopyKwork = useCallback((): boolean => { logger.log(`[DEBUG][CONTEXT] triggerCopyKwork called. Ref ready: ${!!fetcherRef.current?.handleCopyToClipboard}`); if (fetcherRef.current?.handleCopyToClipboard) { try { return fetcherRef.current.handleCopyToClipboard(undefined, true); } catch (error: any) { logger.error("Error calling fetcherRef.handleCopyToClipboard:", error); addToastStable(`Ошибка копирования запроса: ${error?.message ?? 'Неизвестно'}`, "error"); return false; } } else { logger.error("triggerCopyKwork: fetcherRef is not set."); addToastStable("Ошибка копирования: Компонент Экстрактора недоступен.", "error"); return false; } }, [addToastStable, fetcherRef]);
        const triggerAskAi = useCallback(async () => { logger.warn("AI Ask Triggered (No Longer Active - Use Copy/Paste Flow)"); addToastStable("Скопируйте запрос и вставьте в AI.", "info"); return { success: false, error: "Ask AI button disabled" }; }, [addToastStable]);
        const triggerParseResponse = useCallback(async () => { logger.log(`[DEBUG][CONTEXT] triggerParseResponse called. Ref ready: ${!!assistantRef.current?.handleParse}`); if (assistantRef.current?.handleParse) { try { await assistantRef.current.handleParse(); } catch (error: any) { logger.error("Error calling assistantRef.handleParse:", error); addToastStable(`Критическая ошибка разбора ответа: ${error?.message ?? 'Неизвестно'}`, "error", 5000); } } else { logger.error("triggerParseResponse: assistantRef is not set."); addToastStable("Ошибка разбора: Компонент Ассистента недоступен.", "error");} }, [addToastStable, assistantRef]);
        const triggerSelectAllParsed = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerSelectAllParsed called. Ref ready: ${!!assistantRef.current?.selectAllParsedFiles}`); if (assistantRef.current?.selectAllParsedFiles) { try { assistantRef.current.selectAllParsedFiles(); } catch (error: any) { logger.error("Error calling assistantRef.selectAllParsedFiles:", error); addToastStable(`Ошибка выбора всех файлов: ${error?.message ?? 'Неизвестно'}`, "error"); } } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); addToastStable("Ошибка выбора: Компонент Ассистента недоступен.", "error");} }, [addToastStable, assistantRef]);
        const triggerCreateOrUpdatePR = useCallback(async () => { logger.log(`[DEBUG][CONTEXT] triggerCreateOrUpdatePR called. Ref ready: ${!!assistantRef.current?.handleCreatePR}`); if (assistantRef.current?.handleCreatePR) { try { await assistantRef.current.handleCreatePR(); } catch (error: any) { logger.error("Error calling assistantRef.handleCreatePR:", error); addToastStable(`Критическая ошибка создания/обновления PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000); } } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); addToastStable("Ошибка PR: Компонент Ассистента недоступен.", "error");} }, [addToastStable, assistantRef]);
        const triggerGetOpenPRsStable = useCallback(async (url: string) => { const effectiveUrl = url || repoUrlState; logger.log(`[DEBUG][CONTEXT] triggerGetOpenPRs called for ${effectiveUrl}`); if (!effectiveUrl || !effectiveUrl.includes('github.com')) { setOpenPrsStateStable([]); setLoadingPrsStateStable(false); logger.warn("triggerGetOpenPRs: Invalid URL", effectiveUrl); return; } logger.log("triggerGetOpenPRs: Fetching for", effectiveUrl); setLoadingPrsStateStable(true); try { const result = await getOpenPullRequests(effectiveUrl); if (result.success && result.pullRequests) { setOpenPrsStateStable(result.pullRequests as SimplePullRequest[]); } else { addToastStable("Ошибка загрузки PR: " + (result.error ?? 'Неизвестно'), "error"); setOpenPrsStateStable([]); } } catch (error: any) { logger.error("triggerGetOpenPRs Action Error:", error); addToastStable(`Крит. ошибка загрузки PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000); setOpenPrsStateStable([]); } finally { setLoadingPrsStateStable(false); } }, [repoUrlState, addToastStable, setLoadingPrsStateStable, setOpenPrsStateStable]);
        const triggerUpdateBranchStable = useCallback(async ( repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => { logger.log(`[Context] triggerUpdateBranch: ${branch}, PR#: ${prNumber ?? 'N/A'}`); setAssistantLoadingStateStable(true); try { const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription); if (result.success) { logger.log(`[DEBUG][CONTEXT] triggerUpdateBranch SUCCESS. Triggering PR refresh.`); triggerGetOpenPRsStable(repoUrlParam).catch(err => logger.error("Failed to refresh PRs after branch update:", err)); return { success: true }; } else { addToastStable(`Ошибка обновления ветки: ${result.error}`, 'error', 5000); return { success: false, error: result.error }; } } catch (error: any) { logger.error("[Context] triggerUpdateBranch critical Error:", error); addToastStable(`Крит. ошибка обновления ветки: ${error.message}`, "error", 5000); return { success: false, error: error.message }; } finally { logger.log(`[DEBUG][CONTEXT] triggerUpdateBranch FINALLY`); setAssistantLoadingStateStable(false); } }, [addToastStable, triggerGetOpenPRsStable, setAssistantLoadingStateStable]);
        const updateRepoUrlInAssistantStable = useCallback((url: string) => { logger.log(`[DEBUG][CONTEXT] updateRepoUrlInAssistant called. Ref ready: ${!!assistantRef.current?.updateRepoUrl}`); if (assistantRef.current?.updateRepoUrl) { try { assistantRef.current.updateRepoUrl(url); } catch (error: any) { logger.error(`Error calling assistantRef.updateRepoUrl: ${error?.message ?? 'Неизвестно'}`); } } }, [assistantRef]);
        const scrollToSectionStable = useCallback((sectionId: string) => { logger.log(`[DEBUG][CONTEXT] scrollToSection called for ${sectionId}`); const element = document.getElementById(sectionId); if (element) { try { element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); setTimeout(() => { element.classList.add('highlight-scroll'); setTimeout(() => element.classList.remove('highlight-scroll'), 1500); }, 300); } catch (scrollError) { logger.error(`Error scrolling to ${sectionId}:`, scrollError); } } else { logger.warn(`Scroll target not found: ${sectionId}`); } }, []);
        const triggerAddImportantToKworkStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerAddImportantToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddImportantFiles}`); fetcherRef.current?.handleAddImportantFiles?.(); }, [fetcherRef]);
        const triggerAddTreeToKworkStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerAddTreeToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddFullTree}`); fetcherRef.current?.handleAddFullTree?.(); }, [fetcherRef]);
        const triggerSelectAllFetcherFilesStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerSelectAllFetcherFiles called. Ref ready: ${!!fetcherRef.current?.selectAllFiles}`); fetcherRef.current?.selectAllFiles?.(); }, [fetcherRef]);
        const triggerDeselectAllFetcherFilesStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerDeselectAllFetcherFiles called. Ref ready: ${!!fetcherRef.current?.deselectAllFiles}`); fetcherRef.current?.deselectAllFiles?.(); }, [fetcherRef]);
        const triggerClearKworkInputStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerClearKworkInput called. Ref ready: ${!!fetcherRef.current?.clearAll}`); fetcherRef.current?.clearAll?.(); }, [fetcherRef]);


        // --- Workflow Step Calculation ---
        const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
        useEffect(() => {
            let calculatedStep: WorkflowStep = 'idle';
             if (imageReplaceTaskState) {
                 if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
                 else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace';
                 else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && imageReplaceTaskState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) calculatedStep = 'fetch_failed';
                 else calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
             } else {
                 if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
                 else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
                 else if (isParsingState) calculatedStep = 'parsing_response';
                 else if (assistantLoadingState) calculatedStep = 'generating_ai_response';
                 else if (aiActionLoadingState) calculatedStep = 'generating_ai_response';
                 else if (filesFetchedState) {
                     if (aiResponseHasContentState) {
                         calculatedStep = filesParsedState ? 'pr_ready' : 'response_pasted';
                     } else if (kworkInputHasContentState) {
                         calculatedStep = requestCopiedState ? 'request_copied' : 'request_written';
                     } else if (selectedFetcherFilesState.size > 0) {
                         calculatedStep = 'files_selected';
                     } else if (primaryHighlightPathState || Object.values(secondaryHighlightPathsState).some(arr => arr.length > 0)) {
                         calculatedStep = 'files_fetched_highlights';
                     } else {
                         calculatedStep = 'files_fetched';
                     }
                 }
                 else {
                     calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
                 }
             }
            setCurrentStep(prevStep => {
                 if (prevStep !== calculatedStep) {
                     logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`);
                     return calculatedStep;
                 }
                 return prevStep;
            });
        }, [
            fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState,
            selectedFetcherFilesState, aiActionLoadingState, isParsingState, imageReplaceTaskState, allFetchedFilesState, assistantLoadingState, repoUrlEnteredState,
        ]);

        // --- Buddy Message Logic ---
        const getXuinityMessageStable = useCallback((): string => {
             const effectiveBranch = manualBranchNameState.trim() || targetBranchNameState || 'default';
             const currentTask = imageReplaceTaskState;
             const step = currentStep;
             const allFilesLength = allFetchedFilesState.length;
             const selectedFetchSize = selectedFetcherFilesState.size;
             const selectedAssistSize = selectedAssistantFilesState.size;
             logger.debug(`[getXuinityMessageStable] Calculating message for step: ${step}, task: ${!!currentTask}`);

            if (currentTask) {
                if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') return "Гружу файл для замены картинки...";
                if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') return "Твою ж! Ошибка загрузки файла. URL/ветка верные? Жми 'Попробовать Снова'.";
                const targetFileExists = allFetchedFilesState?.some(f => f.path === currentTask.targetPath);
                if (fetchStatusState === 'success' && !targetFileExists && filesFetchedState) return "Файл для замены НЕ НАЙДЕН в репе! Проверь путь/ветку!";
                if (fetchStatusState === 'success' && targetFileExists) {
                    if (assistantLoadingState) return "Меняю картинку и делаю авто-PR... Магия!";
                    return "Файл на месте! Ассистент сейчас сам всё заменит и запушит PR. Левел 1 пройден!";
                }
                return "Готовлю авто-замену картинки (Level 1)...";
            }
            switch (step) {
                case 'idle': return "Готов качать Vibe! Введи URL репы GitHub или покажи мне на странице, что чинить/делать.";
                case 'ready_to_fetch': return `Репа есть. Жми 'Извлечь Файлы' из '${effectiveBranch}', чтобы я дал контекст AI.`;
                case 'fetching': return `Качаю код из '${effectiveBranch}'...`;
                case 'fetch_failed': return "Файл? Не, не слышал. Ошибка загрузки. Проверь URL/токен/ветку и жми 'Попробовать Снова'.";
                case 'files_fetched': return `Код скачан (${allFilesLength} файлов). Теперь твоя очередь рулить AI! Выбери файлы-контекст или просто напиши идею в поле запроса.`;
                case 'files_fetched_highlights': return `О! Я вижу связанные файлы (стр./компоненты/хуки)! Выбери их (+1 Vibe Perk!) и/или добавь (+) в запрос, чтобы AI лучше понял, что делать.`;
                case 'files_selected': return `Выбрал ${selectedFetchSize} файлов. Отлично! Добавь их (+) в запрос как контекст для AI.`;
                case 'request_written': return `Запрос для AI готов! Скопируй его и закинь своему GPT/Gemini. Жду результат!`;
                case 'request_copied': return "Скопировал? Красава! Теперь жду ответ от твоего AI. Вставь его в поле ниже.";
                case 'response_pasted': return "Есть ответ! Отлично. Жми '➡️', я разберу код и проверю на ошибки.";
                case 'parsing_response': return "Парсю код, ищу косяки... (+1 Parser Perk!)";
                case 'pr_ready':
                    const actionText = targetBranchNameState ? 'обновления ветки' : 'создания PR';
                    if (selectedAssistSize === 0) return "Код разобран и проверен! Теперь выбери файлы, которые пойдут в коммит.";
                    return `Код разобран! Выбрано ${selectedAssistSize} файлов для ${actionText}. Проверь код в ассистенте (ошибки/варнинги?). Жми кнопку PR/Update!`;
                default:
                    logger.warn(`[getXuinityMessageStable] Reached default case for step: ${step}`);
                    return "Вайб неопределен... Что будем делать?";
            }
         }, [
             currentStep, manualBranchNameState, targetBranchNameState,
             imageReplaceTaskState, fetchStatusState, allFetchedFilesState, filesFetchedState, assistantLoadingState,
             selectedFetcherFilesState, selectedAssistantFilesState,
         ]);


        // --- Memoized Context Value ---
        const contextValue = useMemo((): RepoXmlPageContextType => {
            logger.debug("[RepoXmlPageProvider] Memoizing context value START");
            const value = {
                fetchStatus: fetchStatusState,
                repoUrlEntered: repoUrlEnteredState,
                filesFetched: filesFetchedState,
                kworkInputHasContent: kworkInputHasContentState,
                requestCopied: requestCopiedState,
                aiResponseHasContent: aiResponseHasContentState,
                filesParsed: filesParsedState,
                assistantLoading: assistantLoadingState,
                aiActionLoading: aiActionLoadingState,
                loadingPrs: loadingPrsState,
                isSettingsModalOpen: isSettingsModalOpenState,
                isParsing: isParsingState,
                selectedFetcherFiles: selectedFetcherFilesState,
                selectedAssistantFiles: selectedAssistantFilesState,
                targetBranchName: targetBranchNameState,
                manualBranchName: manualBranchNameState,
                openPrs: openPrsState,
                currentAiRequestId: currentAiRequestIdState,
                imageReplaceTask: imageReplaceTaskState,
                allFetchedFiles: allFetchedFilesState,
                currentStep,
                repoUrl: repoUrlState,
                primaryHighlightedPath: primaryHighlightPathState,
                secondaryHighlightedPaths: secondaryHighlightPathsState,
                 // NEW PR Data
                targetPrData: targetPrDataState,

                setFetchStatus: setFetchStatusStateStable,
                setRepoUrlEntered: setRepoUrlEnteredStateStable,
                handleSetFilesFetched: handleSetFilesFetchedStable,
                setSelectedFetcherFiles: setSelectedFetcherFilesStateStable,
                setKworkInputHasContent: setKworkInputHasContentStateStable,
                setRequestCopied: setRequestCopiedStateStable,
                setAiResponseHasContent: setAiResponseHasContentStateStable,
                setFilesParsed: setFilesParsedStateStable,
                setSelectedAssistantFiles: setSelectedAssistantFilesStateStable,
                setAssistantLoading: setAssistantLoadingStateStable,
                setAiActionLoading: setAiActionLoadingStateStable,
                setLoadingPrs: setLoadingPrsStateStable,
                setTargetBranchName: setTargetBranchNameStateStable,
                setManualBranchName: setManualBranchNameStateStable,
                setOpenPrs: setOpenPrsStateStable,
                setIsParsing: setIsParsingStateStable,
                setContextIsParsing: setIsParsingStateStable,
                setCurrentAiRequestId: setCurrentAiRequestIdStateStable,
                setImageReplaceTask: setImageReplaceTaskStateStable,
                setRepoUrl: setRepoUrlStateStable,
                // NEW PR Data Setter
                setTargetPrData: setTargetPrDataStable,

                triggerToggleSettingsModal,
                triggerFetch,
                triggerSelectHighlighted,
                triggerAddSelectedToKwork,
                triggerCopyKwork,
                triggerAskAi,
                triggerParseResponse,
                triggerSelectAllParsed,
                triggerCreateOrUpdatePR,
                triggerUpdateBranch: triggerUpdateBranchStable,
                triggerGetOpenPRs: triggerGetOpenPRsStable,
                updateRepoUrlInAssistant: updateRepoUrlInAssistantStable,
                getXuinityMessage: getXuinityMessageStable,
                scrollToSection: scrollToSectionStable,
                triggerAddImportantToKwork: triggerAddImportantToKworkStable,
                triggerAddTreeToKwork: triggerAddTreeToKworkStable,
                triggerSelectAllFetcherFiles: triggerSelectAllFetcherFilesStable,
                triggerDeselectAllFetcherFiles: triggerDeselectAllFetcherFilesStable,
                triggerClearKworkInput: triggerClearKworkInputStable,
                kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
                addToast: addToastStable,
                getKworkInputValue: getKworkInputValueStable,
                updateKworkInput: updateKworkInputStable,
            };
            logger.debug("[RepoXmlPageProvider] Memoizing context value END");
            return value;
        }, [
            fetchStatusState, repoUrlEnteredState, filesFetchedState, kworkInputHasContentState, requestCopiedState, aiResponseHasContentState, filesParsedState, assistantLoadingState, aiActionLoadingState, loadingPrsState, isSettingsModalOpenState, isParsingState, selectedFetcherFilesState, selectedAssistantFilesState, targetBranchNameState, manualBranchNameState, openPrsState, currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, currentStep, repoUrlState, primaryHighlightPathState, secondaryHighlightPathsState, targetPrDataState, // Added targetPrDataState
            setFetchStatusStateStable, setRepoUrlEnteredStateStable, handleSetFilesFetchedStable, setSelectedFetcherFilesStateStable, setKworkInputHasContentStateStable, setRequestCopiedStateStable, setAiResponseHasContentStateStable, setFilesParsedStateStable, setSelectedAssistantFilesStateStable, setAssistantLoadingStateStable, setAiActionLoadingStateStable, setLoadingPrsStateStable, setTargetBranchNameStateStable, setManualBranchNameStateStable, setOpenPrsStateStable, setIsParsingStateStable, setCurrentAiRequestIdStateStable, setImageReplaceTaskStateStable, setRepoUrlStateStable, setTargetPrDataStable, // Added setTargetPrDataStable
            triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranchStable, triggerGetOpenPRsStable, updateRepoUrlInAssistantStable, getXuinityMessageStable, scrollToSectionStable, triggerAddImportantToKworkStable, triggerAddTreeToKworkStable, triggerSelectAllFetcherFilesStable, triggerDeselectAllFetcherFilesStable, triggerClearKworkInputStable, addToastStable, getKworkInputValueStable, updateKworkInputStable,
        ]);

        logger.log("[RepoXmlPageProvider] Rendering Provider wrapper", { step: contextValue.currentStep });
        return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );

    } catch (providerError: any) {
        logger.fatal("[RepoXmlPageProvider] CRITICAL INITIALIZATION ERROR:", providerError);
        // Render a simple error message instead of children if provider itself fails
        return <div className="text-red-500 p-4">Критическая ошибка инициализации провайдера страницы: {providerError.message}</div>;
    }
};

// --- Consumer Hook (Unchanged) ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (context === undefined) {
         logger.fatal("useRepoXmlPageContext used outside RepoXmlPageProvider!");
         throw new Error("useRepoXmlPageContext must be used within a RepoXmlPageProvider");
    }
    if (context.addToast === defaultContextValue.addToast && typeof context.addToast === 'function') { // Check against default FUNCTION reference
        logger.warn("useRepoXmlPageContext: Context might be the default value (check provider setup).");
    }
    return context as RepoXmlPageContextType;
};

// Export necessary types (Unchanged)
export type { FileNode, SimplePullRequest, RepoTxtFetcherRef, AICodeAssistantRef, ImportCategory, FetchStatus, WorkflowStep, ImageReplaceTask, RepoXmlPageContextType };