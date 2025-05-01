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
    fetchStatus: FetchStatus;
    repoUrlEntered: boolean;
    filesFetched: boolean;
    selectedFetcherFiles: Set<string>;
    kworkInputHasContent: boolean;
    requestCopied: boolean;
    aiResponseHasContent: boolean;
    filesParsed: boolean;
    selectedAssistantFiles: Set<string>;
    assistantLoading: boolean;
    aiActionLoading: boolean;
    loadingPrs: boolean;
    targetBranchName: string | null;
    manualBranchName: string;
    openPrs: SimplePullRequest[];
    isSettingsModalOpen: boolean;
    isParsing: boolean;
    currentAiRequestId: string | null;
    imageReplaceTask: ImageReplaceTask | null;
    allFetchedFiles: FileNode[];
    currentStep: WorkflowStep;
    repoUrl: string;
    setFetchStatus: React.Dispatch<React.SetStateAction<FetchStatus>>;
    setRepoUrlEntered: React.Dispatch<React.SetStateAction<boolean>>;
    handleSetFilesFetched: ( fetched: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => void;
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
    setContextIsParsing: React.Dispatch<React.SetStateAction<boolean>>; // Alias for setIsParsing
    setCurrentAiRequestId: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    setRepoUrl: React.Dispatch<React.SetStateAction<string>>;
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
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;
    addToast: (message: string | React.ReactNode, type?: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message', duration?: number, options?: any) => void;
    getKworkInputValue: () => string;
    updateKworkInput: (value: string) => void;
}

// --- Default Context Value ---
const defaultContextValue: RepoXmlPageContextType = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', repoUrl: "https://github.com/salavey13/carTest", // Default Repo Changed
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
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(defaultContextValue);

// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
    const [fetchStatusState, setFetchStatusState] = useState<FetchStatus>('idle');
    const [repoUrlEnteredState, setRepoUrlEnteredState] = useState<boolean>(false);
    const [filesFetchedState, setFilesFetchedState] = useState<boolean>(false);
    const [primaryHighlightPathState, setPrimaryHighlightPathState] = useState<string | null>(null);
    const [secondaryHighlightPathsState, setSecondaryHighlightPathsState] = useState<string[]>([]); // Combined for simplicity, logic to categorize is elsewhere
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
    const [repoUrlState, setRepoUrlState] = useState<string>(defaultContextValue.repoUrl); // Initialize with default

    const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
    const assistantRef = useRef<AICodeAssistantRef | null>(null);
    const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
    const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);

    const appToast = useAppToast();
    const addToastStable = useCallback((
        message: string | React.ReactNode,
        type: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' = 'info',
        duration: number = 3000,
        options: any = {}
    ) => {
        const toastOptions = duration ? { ...options, duration } : options;
        switch (type) {
            case 'success': appToast.success(message, toastOptions); break;
            case 'error': appToast.error(message, toastOptions); break;
            case 'info': appToast.info(message, toastOptions); break;
            case 'warning': appToast.warning(message, toastOptions); break;
            case 'loading': appToast.loading(message, toastOptions); break;
            case 'message': default: appToast.message(message, toastOptions); break;
        }
    }, [appToast]); // Dependency on appToast instance

    useEffect(() => { logger.log("RepoXmlPageContext Mounted (Client)"); }, []);
    useEffect(() => { setRepoUrlEnteredState(repoUrlState.trim().length > 0 && repoUrlState.includes("github.com")); }, [repoUrlState]);

    // --- Stable Setters with Toasts ---
    const setFetchStatusStateStable = useCallback((status: FetchStatus | ((prevState: FetchStatus) => FetchStatus)) => {
        setFetchStatusState(prevStatus => {
            const newStatus = typeof status === 'function' ? status(prevStatus) : status;
            addToastStable(`[DEBUG][CONTEXT] setFetchStatusState: ${prevStatus} -> ${newStatus}`, 'info', 500);
            return newStatus;
        });
    }, [addToastStable]);

    const setRepoUrlEnteredStateStable = useCallback((entered: boolean | ((prevState: boolean) => boolean)) => {
        setRepoUrlEnteredState(prev => {
            const newValue = typeof entered === 'function' ? entered(prev) : entered;
            addToastStable(`[DEBUG][CONTEXT] setRepoUrlEnteredState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setSelectedFetcherFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => {
        setSelectedFetcherFilesState(prev => {
            const newSet = typeof files === 'function' ? files(prev) : files;
            addToastStable(`[DEBUG][CONTEXT] setSelectedFetcherFilesState: Size ${prev.size} -> ${newSet.size}`, 'info', 500);
            return newSet;
        });
    }, [addToastStable]);

    const setKworkInputHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => {
        setKworkInputHasContentState(prev => {
            const newValue = typeof hasContent === 'function' ? hasContent(prev) : hasContent;
            addToastStable(`[DEBUG][CONTEXT] setKworkInputHasContentState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setRequestCopiedStateStable = useCallback((copied: boolean | ((prevState: boolean) => boolean)) => {
        setRequestCopiedState(prev => {
            const newValue = typeof copied === 'function' ? copied(prev) : copied;
            addToastStable(`[DEBUG][CONTEXT] setRequestCopiedState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setAiResponseHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => {
        setAiResponseHasContentState(prev => {
            const newValue = typeof hasContent === 'function' ? hasContent(prev) : hasContent;
            addToastStable(`[DEBUG][CONTEXT] setAiResponseHasContentState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setFilesParsedStateStable = useCallback((parsed: boolean | ((prevState: boolean) => boolean)) => {
        setFilesParsedState(prev => {
            const newValue = typeof parsed === 'function' ? parsed(prev) : parsed;
            addToastStable(`[DEBUG][CONTEXT] setFilesParsedState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setSelectedAssistantFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => {
        setSelectedAssistantFilesState(prev => {
            const newSet = typeof files === 'function' ? files(prev) : files;
            addToastStable(`[DEBUG][CONTEXT] setSelectedAssistantFilesState: Size ${prev.size} -> ${newSet.size}`, 'info', 500);
            return newSet;
        });
    }, [addToastStable]);

    const setAssistantLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => {
        setAssistantLoadingState(prev => {
            const newValue = typeof loading === 'function' ? loading(prev) : loading;
            addToastStable(`[DEBUG][CONTEXT] setAssistantLoadingState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setAiActionLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => {
        setAiActionLoadingState(prev => {
            const newValue = typeof loading === 'function' ? loading(prev) : loading;
            addToastStable(`[DEBUG][CONTEXT] setAiActionLoadingState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setLoadingPrsStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => {
        setLoadingPrsState(prev => {
            const newValue = typeof loading === 'function' ? loading(prev) : loading;
            addToastStable(`[DEBUG][CONTEXT] setLoadingPrsState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setTargetBranchNameStateStable = useCallback((name: string | null | ((prevState: string | null) => string | null)) => {
        setTargetBranchNameState(prev => {
            const newValue = typeof name === 'function' ? name(prev) : name;
            addToastStable(`[DEBUG][CONTEXT] setTargetBranchNameState: ${prev || 'null'} -> ${newValue || 'null'}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setManualBranchNameStateStable = useCallback((name: string | ((prevState: string) => string)) => {
        setManualBranchNameState(prev => {
            const newValue = typeof name === 'function' ? name(prev) : name;
            addToastStable(`[DEBUG][CONTEXT] setManualBranchNameState: ${prev || '""'} -> ${newValue || '""'}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setOpenPrsStateStable = useCallback((prs: SimplePullRequest[] | ((prevState: SimplePullRequest[]) => SimplePullRequest[])) => {
        setOpenPrsState(prev => {
            const newValue = typeof prs === 'function' ? prs(prev) : prs;
            addToastStable(`[DEBUG][CONTEXT] setOpenPrsState: Count ${prev.length} -> ${newValue.length}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setIsParsingStateStable = useCallback((parsing: boolean | ((prevState: boolean) => boolean)) => {
        setIsParsingState(prev => {
            const newValue = typeof parsing === 'function' ? parsing(prev) : parsing;
            addToastStable(`[DEBUG][CONTEXT] setIsParsingState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setCurrentAiRequestIdStateStable = useCallback((id: string | null | ((prevState: string | null) => string | null)) => {
        setCurrentAiRequestIdState(prev => {
            const newValue = typeof id === 'function' ? id(prev) : id;
            addToastStable(`[DEBUG][CONTEXT] setCurrentAiRequestIdState: ${prev || 'null'} -> ${newValue || 'null'}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setImageReplaceTaskStateStable = useCallback((task: ImageReplaceTask | null | ((prevState: ImageReplaceTask | null) => ImageReplaceTask | null)) => {
        setImageReplaceTaskState(prev => {
            const newValue = typeof task === 'function' ? task(prev) : task;
            addToastStable(`[DEBUG][CONTEXT] setImageReplaceTaskState: ${!!prev} -> ${!!newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setAllFetchedFilesStateStable = useCallback((files: FileNode[] | ((prevState: FileNode[]) => FileNode[])) => {
        setAllFetchedFilesState(prev => {
            const newValue = typeof files === 'function' ? files(prev) : files;
            addToastStable(`[DEBUG][CONTEXT] setAllFetchedFilesState: Count ${prev.length} -> ${newValue.length}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);

    const setRepoUrlStateStable = useCallback((url: string | ((prevState: string) => string)) => {
        setRepoUrlState(prev => {
            const newValue = typeof url === 'function' ? url(prev) : url;
            addToastStable(`[DEBUG][CONTEXT] setRepoUrlState: ${prev} -> ${newValue}`, 'info', 500);
            return newValue;
        });
    }, [addToastStable]);
    // --- End Stable Setters ---


    const handleSetFilesFetchedStable = useCallback(( fetched: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => {
       addToastStable(`[DEBUG][CONTEXT] handleSetFilesFetchedStable called. Fetched: ${fetched}`, 'info', 1000);
       const currentTask = imageReplaceTaskState;
       setFilesFetchedState(fetched); // Use direct setter here is fine as it's internal
       if (fetched) {
           addToastStable(`[DEBUG][CONTEXT] Setting allFetchedFilesState: ${allFiles?.length} files`, 'info', 500);
           setAllFetchedFilesStateStable(allFiles ?? []); // Use stable setter
       }
       // These local states don't seem to cause issues, direct set is okay (though could be wrapped too)
       setPrimaryHighlightPathState(primaryHighlight);
       setSecondaryHighlightPathsState(secondaryHighlights ?? []);

       let finalFetchStatus: FetchStatus = fetched ? 'success' : 'error';
       if (currentTask) {
           if (fetched) {
               const targetFileExists = (allFiles ?? []).some(f => f.path === currentTask.targetPath);
               if (!targetFileExists) {
                   finalFetchStatus = 'error';
                   addToastStable(`[DEBUG][CONTEXT] Image Task Error: Target not found! Final Status: ${finalFetchStatus}`, 'error', 3000);
                   setImageReplaceTaskStateStable(null); // Use stable setter
                   setFilesFetchedState(false); // Reset relevant states
               } else {
                   finalFetchStatus = 'success';
                   addToastStable(`[DEBUG][CONTEXT] Image Task Success. Final Status: ${finalFetchStatus}. Triggering replace...`, 'info', 1000);
                   // Trigger replace logic (ensure assistantRef check has toast)
                   if (assistantRef.current && typeof assistantRef.current.handleDirectImageReplace === 'function') {
                       addToastStable(`[DEBUG][CONTEXT] Calling handleDirectImageReplace. Type: ${typeof assistantRef.current.handleDirectImageReplace}`, 'info', 1000);
                       assistantRef.current.handleDirectImageReplace(currentTask, allFiles ?? []);
                   } else {
                       addToastStable(`[DEBUG][CONTEXT] ERROR: Cannot call handleDirectImageReplace. Ref: ${!!assistantRef.current}, Fn Type: ${typeof assistantRef.current?.handleDirectImageReplace}`, 'error', 5000);
                   }
               }
           } else { finalFetchStatus = 'error'; addToastStable(`[DEBUG][CONTEXT] Image Task Fetch Failed. Final Status: ${finalFetchStatus}`, 'error', 3000); }
       } else { addToastStable(`[DEBUG][CONTEXT] Standard Fetch Finished. Final Status: ${finalFetchStatus}`, 'info', 1000); }

       // Use the stable setter WITH TOAST
       setFetchStatusStateStable(finalFetchStatus);

       logger.log(`[Context] handleSetFilesFetchedStable finished. Final Status: ${finalFetchStatus}, Files Fetched Flag: ${fetched}`);
    }, [ imageReplaceTaskState, addToastStable, assistantRef, setFetchStatusStateStable, setAllFetchedFilesStateStable, setImageReplaceTaskStateStable ]); // Added stable setters to deps


    const getKworkInputValueStable = useCallback((): string => kworkInputRef.current?.value || "", []);
    const updateKworkInputStable = useCallback((value: string) => {
        addToastStable(`[DEBUG][CONTEXT] updateKworkInputStable: ${value.substring(0,20)}...`, 'info', 500);
        if (kworkInputRef.current) {
            kworkInputRef.current.value = value;
            setKworkInputHasContentStateStable(value.trim().length > 0); // Use stable setter
        }
    }, [addToastStable, setKworkInputHasContentStateStable]); // Added stable setter dep

    // --- Triggers (Implement using stable setters or direct calls) ---
    const triggerToggleSettingsModal = useCallback(() => {
         addToastStable(`[DEBUG][CONTEXT] triggerToggleSettingsModal`, 'info', 1000);
         setIsSettingsModalOpenState(prev => !prev); }, [addToastStable]); // Direct toggle is fine

    const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => {
        addToastStable(`[DEBUG][CONTEXT] triggerFetch called. Ref ready: ${!!fetcherRef.current?.handleFetch}`, 'info', 1000);
        if (fetcherRef.current?.handleFetch) {
            try { await fetcherRef.current.handleFetch(isRetry, branch, imageReplaceTaskState); }
            catch (error: any) {
                logger.error("Error calling fetcherRef.handleFetch:", error);
                addToastStable(`Критическая ошибка при запуске извлечения: ${error?.message ?? 'Неизвестно'}`, "error", 5000);
                setFetchStatusStateStable('error'); // Use stable setter
            }
        } else { logger.error("triggerFetch: fetcherRef is not set."); addToastStable("Ошибка: Не удалось запустить извлечение (ref).", "error"); }
    }, [imageReplaceTaskState, addToastStable, setFetchStatusStateStable]); // Added stable setter dep

    const triggerSelectHighlighted = useCallback(() => {
        addToastStable(`[DEBUG][CONTEXT] triggerSelectHighlighted called. Ref ready: ${!!fetcherRef.current?.selectHighlightedFiles}`, 'info', 1000);
        if (fetcherRef.current?.selectHighlightedFiles) {
             try { fetcherRef.current.selectHighlightedFiles(); }
             catch (error: any) { logger.error("Error calling fetcherRef.selectHighlightedFiles:", error); addToastStable(`Ошибка выбора связанных файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); }
     }, [addToastStable]);

    const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => {
        addToastStable(`[DEBUG][CONTEXT] triggerAddSelectedToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddSelected}. Selected: ${selectedFetcherFilesState.size}`, 'info', 1000);
        if (fetcherRef.current?.handleAddSelected) {
             if (selectedFetcherFilesState.size === 0) { addToastStable("Сначала выберите файлы в Экстракторе!", "warning"); return; }
             try {
                  // handleAddSelected in the ref now uses context internally
                  await fetcherRef.current.handleAddSelected(selectedFetcherFilesState, allFetchedFilesState); // Pass args needed by old sig if ref expects them
                  if (clearSelection) { setSelectedFetcherFilesStateStable(new Set()); } // Use stable setter
             } catch (error: any) { logger.error("[Context] Error during handleAddSelected:", error); addToastStable(`Ошибка добавления файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); addToastStable("Ошибка: Компонент Экстрактора недоступен.", "error"); }
    }, [selectedFetcherFilesState, allFetchedFilesState, addToastStable, setSelectedFetcherFilesStateStable]); // Added stable setter dep

    const triggerCopyKwork = useCallback((): boolean => {
        addToastStable(`[DEBUG][CONTEXT] triggerCopyKwork called. Ref ready: ${!!fetcherRef.current?.handleCopyToClipboard}`, 'info', 1000);
        if (fetcherRef.current?.handleCopyToClipboard) {
             try { return fetcherRef.current.handleCopyToClipboard(undefined, true); }
             catch (error: any) { logger.error("Error calling fetcherRef.handleCopyToClipboard:", error); addToastStable(`Ошибка копирования запроса: ${error?.message ?? 'Неизвестно'}`, "error"); return false; }
        } else { logger.error("triggerCopyKwork: fetcherRef is not set."); addToastStable("Ошибка копирования: Компонент Экстрактора недоступен.", "error"); return false; }
     }, [addToastStable]);

    const triggerAskAi = useCallback(async () => { addToastStable("[DEBUG][CONTEXT] triggerAskAi called (NO-OP)", 'warning', 1000); logger.warn("AI Ask Triggered (No Longer Active - Use Copy/Paste Flow)"); addToastStable("Скопируйте запрос и вставьте в AI.", "info"); return { success: false, error: "Ask AI button disabled" }; }, [addToastStable]);

    const triggerParseResponse = useCallback(async () => {
        addToastStable(`[DEBUG][CONTEXT] triggerParseResponse called. Ref ready: ${!!assistantRef.current?.handleParse}`, 'info', 1000);
        if (assistantRef.current?.handleParse) {
             try { await assistantRef.current.handleParse(); }
             catch (error: any) { logger.error("Error calling assistantRef.handleParse:", error); addToastStable(`Критическая ошибка разбора ответа: ${error?.message ?? 'Неизвестно'}`, "error", 5000); }
        } else { logger.error("triggerParseResponse: assistantRef is not set."); addToastStable("Ошибка разбора: Компонент Ассистента недоступен.", "error");}
     }, [addToastStable]);

    const triggerSelectAllParsed = useCallback(() => {
        addToastStable(`[DEBUG][CONTEXT] triggerSelectAllParsed called. Ref ready: ${!!assistantRef.current?.selectAllParsedFiles}`, 'info', 1000);
        if (assistantRef.current?.selectAllParsedFiles) {
             try { assistantRef.current.selectAllParsedFiles(); }
             catch (error: any) { logger.error("Error calling assistantRef.selectAllParsedFiles:", error); addToastStable(`Ошибка выбора всех файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); addToastStable("Ошибка выбора: Компонент Ассистента недоступен.", "error");}
    }, [addToastStable]);

    const triggerCreateOrUpdatePR = useCallback(async () => {
        addToastStable(`[DEBUG][CONTEXT] triggerCreateOrUpdatePR called. Ref ready: ${!!assistantRef.current?.handleCreatePR}`, 'info', 1000);
        if (assistantRef.current?.handleCreatePR) {
             try { await assistantRef.current.handleCreatePR(); }
             catch (error: any) { logger.error("Error calling assistantRef.handleCreatePR:", error); addToastStable(`Критическая ошибка создания/обновления PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000); }
        } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); addToastStable("Ошибка PR: Компонент Ассистента недоступен.", "error");}
    }, [addToastStable]);

    const triggerGetOpenPRs = useCallback(async (url: string) => {
         const effectiveUrl = url || repoUrlState;
         addToastStable(`[DEBUG][CONTEXT] triggerGetOpenPRs called for ${effectiveUrl}`, 'info', 1000);
         if (!effectiveUrl || !effectiveUrl.includes('github.com')) { setOpenPrsStateStable([]); setLoadingPrsStateStable(false); logger.warn("triggerGetOpenPRs: Invalid URL", effectiveUrl); return; }
         logger.log("triggerGetOpenPRs: Fetching for", effectiveUrl); setLoadingPrsStateStable(true);
         try {
             const result = await getOpenPullRequests(effectiveUrl);
             if (result.success && result.pullRequests) {
                  setOpenPrsStateStable(result.pullRequests as SimplePullRequest[]);
             } else {
                 addToastStable("Ошибка загрузки PR: " + (result.error ?? 'Неизвестно'), "error");
                 setOpenPrsStateStable([]);
             }
         } catch (error: any) {
             logger.error("triggerGetOpenPRs Action Error:", error);
             addToastStable(`Крит. ошибка загрузки PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000);
             setOpenPrsStateStable([]);
         } finally {
             setLoadingPrsStateStable(false);
         }
     }, [repoUrlState, addToastStable, setLoadingPrsStateStable, setOpenPrsStateStable]); // Added stable setters

     const triggerUpdateBranch = useCallback(async (repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => {
         addToastStable(`[DEBUG][CONTEXT] triggerUpdateBranch called. Branch: ${branch}. Type updateBranch: ${typeof updateBranch}`, 'info', 1000);
         logger.log(`[Context] triggerUpdateBranch: ${branch}, PR#: ${prNumber ?? 'N/A'}`);
         setAssistantLoadingStateStable(true); // Use stable setter
         try {
             const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription);
             if (result.success) {
                  addToastStable(`[DEBUG][CONTEXT] triggerUpdateBranch SUCCESS. Triggering PR refresh.`, 'info', 1000);
                  triggerGetOpenPRs(repoUrlParam).catch(err => logger.error("Failed to refresh PRs after branch update:", err));
                  return { success: true };
             } else {
                  addToastStable(`[DEBUG][CONTEXT] triggerUpdateBranch FAILED: ${result.error}`, 'error', 3000);
                 return { success: false, error: result.error };
             }
         } catch (error: any) {
             addToastStable(`[DEBUG][CONTEXT] triggerUpdateBranch CATCH ERROR: ${error.message}`, 'error', 5000);
             logger.error("[Context] triggerUpdateBranch critical Error:", error);
             addToastStable(`Крит. ошибка обновления: ${error.message}`, "error", 5000);
             return { success: false, error: error.message };
         } finally {
             addToastStable(`[DEBUG][CONTEXT] triggerUpdateBranch FINALLY`, 'info', 1000);
             setAssistantLoadingStateStable(false); // Use stable setter
         }
     }, [addToastStable, triggerGetOpenPRs, setAssistantLoadingStateStable]); // Added stable setter dep

    const updateRepoUrlInAssistant = useCallback((url: string) => {
        addToastStable(`[DEBUG][CONTEXT] updateRepoUrlInAssistant called. Ref ready: ${!!assistantRef.current?.updateRepoUrl}`, 'info', 1000);
        if (assistantRef.current?.updateRepoUrl) {
            try { assistantRef.current.updateRepoUrl(url); }
            catch (error: any) { logger.error(`Error calling assistantRef.updateRepoUrl: ${error?.message ?? 'Неизвестно'}`); }
        }
     }, [addToastStable]); // Added addToastStable

    const scrollToSection = useCallback((sectionId: string) => {
        addToastStable(`[DEBUG][CONTEXT] scrollToSection called for ${sectionId}`, 'info', 1000);
        const element = document.getElementById(sectionId);
        if (element) {
            try {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(() => {
                    element.classList.add('highlight-scroll');
                    setTimeout(() => element.classList.remove('highlight-scroll'), 1500);
                }, 300);
            } catch (scrollError) { logger.error(`Error scrolling to ${sectionId}:`, scrollError); }
        } else { logger.warn(`Scroll target not found: ${sectionId}`); }
    }, [addToastStable]); // Added addToastStable

    const triggerAddImportantToKwork = useCallback(() => { addToastStable(`[DEBUG][CONTEXT] triggerAddImportantToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddImportantFiles}`, 'info', 1000); fetcherRef.current?.handleAddImportantFiles?.(); }, [addToastStable]);
    const triggerAddTreeToKwork = useCallback(() => { addToastStable(`[DEBUG][CONTEXT] triggerAddTreeToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddFullTree}`, 'info', 1000); fetcherRef.current?.handleAddFullTree?.(); }, [addToastStable]);
    const triggerSelectAllFetcherFiles = useCallback(() => { addToastStable(`[DEBUG][CONTEXT] triggerSelectAllFetcherFiles called. Ref ready: ${!!fetcherRef.current?.selectAllFiles}`, 'info', 1000); fetcherRef.current?.selectAllFiles?.(); }, [addToastStable]);
    const triggerDeselectAllFetcherFiles = useCallback(() => { addToastStable(`[DEBUG][CONTEXT] triggerDeselectAllFetcherFiles called. Ref ready: ${!!fetcherRef.current?.deselectAllFiles}`, 'info', 1000); fetcherRef.current?.deselectAllFiles?.(); }, [addToastStable]);
    const triggerClearKworkInput = useCallback(() => { addToastStable(`[DEBUG][CONTEXT] triggerClearKworkInput called. Ref ready: ${!!fetcherRef.current?.clearAll}`, 'info', 1000); fetcherRef.current?.clearAll?.(); }, [addToastStable]);
    // --- End Triggers ---

    // --- Workflow Step Calculation ---
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
    useEffect(() => {
        let calculatedStep: WorkflowStep = 'idle';
        // --- calculation logic (no changes needed here, uses state values) ---
         if (imageReplaceTaskState) {
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace';
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && imageReplaceTaskState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) calculatedStep = 'fetch_failed';
             else calculatedStep = 'ready_to_fetch';
         } else { // Standard flow
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
             else if (isParsingState) calculatedStep = 'parsing_response';
             else if (assistantLoadingState) calculatedStep = 'generating_ai_response'; // Check assistantLoading before AI action loading for PR generation
             else if (aiActionLoadingState) calculatedStep = 'generating_ai_response'; // Generic AI response generation
             else if (filesFetchedState) {
                 if (aiResponseHasContentState) {
                     calculatedStep = filesParsedState ? 'pr_ready' : 'response_pasted';
                 } else if (kworkInputHasContentState) {
                     calculatedStep = requestCopiedState ? 'request_copied' : 'request_written';
                 } else if (selectedFetcherFilesState.size > 0) {
                     calculatedStep = 'files_selected';
                 } else if (primaryHighlightPathState || secondaryHighlightPathsState.length > 0) {
                     calculatedStep = 'files_fetched_highlights';
                 } else {
                     calculatedStep = 'files_fetched';
                 }
             }
             else {
                 calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
             }
         }
        // --- End calculation logic ---
        addToastStable(`[DEBUG][CONTEXT] Calculating Step: Result = ${calculatedStep}`, 'info', 500);
        setCurrentStep(prevStep => {
             if (prevStep !== calculatedStep) {
                 addToastStable(`[DEBUG][CONTEXT] setCurrentStep: ${prevStep} -> ${calculatedStep}`, 'info', 1000);
                 logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`);
                 return calculatedStep;
             }
             return prevStep;
        });
    }, [ // Keep ALL dependencies
        fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState.length,
        selectedFetcherFilesState.size, aiActionLoadingState, isParsingState, imageReplaceTaskState, allFetchedFilesState,
        assistantLoadingState, repoUrlEnteredState, manualBranchNameState, targetBranchNameState,
        addToastStable // keep if debug toast enabled
    ]);

    // --- Buddy Message Logic ---
    const getXuinityMessage = useCallback((): string => {
        // Logic depends only on state values, no changes needed here
         const effectiveBranch = manualBranchNameState.trim() || targetBranchNameState || 'default';
        if (imageReplaceTaskState) {
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') return "Гружу файл для замены картинки...";
            if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') return "Твою ж! Ошибка загрузки файла. URL/ветка верные? Жми 'Попробовать Снова'.";
            const targetFileExists = allFetchedFilesState?.some(f => f.path === imageReplaceTaskState.targetPath);
            if (fetchStatusState === 'success' && !targetFileExists && filesFetchedState) return "Файл для замены НЕ НАЙДЕН в репе! Проверь путь/ветку!";
            if (fetchStatusState === 'success' && targetFileExists) {
                if (assistantLoadingState) return "Меняю картинку и делаю авто-PR... Магия!";
                return "Файл на месте! Ассистент сейчас сам всё заменит и запушит PR. Левел 1 пройден!";
            }
            return "Готовлю авто-замену картинки (Level 1)...";
        }
        switch (currentStep) {
            case 'idle': return "Готов качать Vibe! Введи URL репы GitHub или покажи мне на странице, что чинить/делать.";
            case 'ready_to_fetch': return `Репа есть. Жми 'Извлечь Файлы' из '${effectiveBranch}', чтобы я дал контекст AI.`;
            case 'fetching': return `Качаю код из '${effectiveBranch}'...`;
            case 'fetch_failed': return "Файл? Не, не слышал. Ошибка загрузки. Проверь URL/токен/ветку и жми 'Попробовать Снова'.";
            case 'files_fetched': return `Код скачан (${allFetchedFilesState.length} файлов). Теперь твоя очередь рулить AI! Выбери файлы-контекст или просто напиши идею в поле запроса.`;
            case 'files_fetched_highlights': return `О! Я вижу связанные файлы (стр./компоненты/хуки)! Выбери их (+1 Vibe Perk!) и/или добавь (+) в запрос, чтобы AI лучше понял, что делать.`;
            case 'files_selected': return `Выбрал ${selectedFetcherFilesState.size} файлов. Отлично! Добавь их (+) в запрос как контекст для AI.`;
            case 'request_written': return `Запрос для AI готов! Скопируй его и закинь своему GPT/Gemini. Жду результат!`;
            case 'request_copied': return "Скопировал? Красава! Теперь жду ответ от твоего AI. Вставь его в поле ниже.";
            case 'response_pasted': return "Есть ответ! Отлично. Жми '➡️', я разберу код и проверю на ошибки.";
            case 'parsing_response': return "Парсю код, ищу косяки... (+1 Parser Perk!)";
            case 'pr_ready':
                const actionText = targetBranchNameState ? 'обновления ветки' : 'создания PR';
                if (selectedAssistantFilesState.size === 0) return "Код разобран и проверен! Теперь выбери файлы, которые пойдут в коммит.";
                return `Код разобран! Выбрано ${selectedAssistantFilesState.size} файлов для ${actionText}. Проверь код в ассистенте (ошибки/варнинги?). Жми кнопку PR/Update!`;
            default: return "Вайб неопределен... Что будем делать?";
        }
     }, [ // Keep ALL dependencies
         currentStep, repoUrlEnteredState, manualBranchNameState, targetBranchNameState,
         fetchStatusState, filesFetchedState, selectedFetcherFilesState.size,
         kworkInputHasContentState, aiResponseHasContentState, filesParsedState,
         selectedAssistantFilesState.size,
         requestCopiedState, assistantLoadingState, aiActionLoadingState,
         currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState,
         isParsingState
     ]);


    // --- Memoized Context Value ---
    const contextValue = useMemo((): RepoXmlPageContextType => ({
        // Pass state values and STABLE setters
        fetchStatus: fetchStatusState, setFetchStatus: setFetchStatusStateStable,
        repoUrlEntered: repoUrlEnteredState, setRepoUrlEntered: setRepoUrlEnteredStateStable,
        filesFetched: filesFetchedState, // handleSetFilesFetched handles this internally
        selectedFetcherFiles: selectedFetcherFilesState, setSelectedFetcherFiles: setSelectedFetcherFilesStateStable,
        kworkInputHasContent: kworkInputHasContentState, setKworkInputHasContent: setKworkInputHasContentStateStable,
        requestCopied: requestCopiedState, setRequestCopied: setRequestCopiedStateStable,
        aiResponseHasContent: aiResponseHasContentState, setAiResponseHasContent: setAiResponseHasContentStateStable,
        filesParsed: filesParsedState, setFilesParsed: setFilesParsedStateStable,
        selectedAssistantFiles: selectedAssistantFilesState, setSelectedAssistantFiles: setSelectedAssistantFilesStateStable,
        assistantLoading: assistantLoadingState, setAssistantLoading: setAssistantLoadingStateStable,
        aiActionLoading: aiActionLoadingState, setAiActionLoading: setAiActionLoadingStateStable,
        loadingPrs: loadingPrsState, setLoadingPrs: setLoadingPrsStateStable,
        targetBranchName: targetBranchNameState, setTargetBranchName: setTargetBranchNameStateStable,
        manualBranchName: manualBranchNameState, setManualBranchName: setManualBranchNameStateStable,
        openPrs: openPrsState, setOpenPrs: setOpenPrsStateStable,
        isSettingsModalOpen: isSettingsModalOpenState, // No direct setter needed? Toggle trigger used.
        isParsing: isParsingState, setIsParsing: setIsParsingStateStable,
        setContextIsParsing: setIsParsingStateStable, // Alias
        currentAiRequestId: currentAiRequestIdState, setCurrentAiRequestId: setCurrentAiRequestIdStateStable,
        imageReplaceTask: imageReplaceTaskState, setImageReplaceTask: setImageReplaceTaskStateStable,
        allFetchedFiles: allFetchedFilesState, // Set via handleSetFilesFetched
        currentStep,
        repoUrl: repoUrlState, setRepoUrl: setRepoUrlStateStable,

        // Pass complex handler and triggers
        handleSetFilesFetched: handleSetFilesFetchedStable,
        triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection, addToast: addToastStable, getKworkInputValue: getKworkInputValueStable, updateKworkInput: updateKworkInputStable,
        triggerAddImportantToKwork, triggerAddTreeToKwork, triggerSelectAllFetcherFiles, triggerDeselectAllFetcherFiles, triggerClearKworkInput,

        // Pass refs
        kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
    }), [
        // List ALL state values and STABLE setters/handlers included in the context object
        fetchStatusState, setFetchStatusStateStable, repoUrlEnteredState, setRepoUrlEnteredStateStable, filesFetchedState,
        selectedFetcherFilesState, setSelectedFetcherFilesStateStable, kworkInputHasContentState, setKworkInputHasContentStateStable,
        requestCopiedState, setRequestCopiedStateStable, aiResponseHasContentState, setAiResponseHasContentStateStable,
        filesParsedState, setFilesParsedStateStable, selectedAssistantFilesState, setSelectedAssistantFilesStateStable,
        assistantLoadingState, setAssistantLoadingStateStable, aiActionLoadingState, setAiActionLoadingStateStable,
        loadingPrsState, setLoadingPrsStateStable, targetBranchNameState, setTargetBranchNameStateStable,
        manualBranchNameState, setManualBranchNameStateStable, openPrsState, setOpenPrsStateStable,
        isSettingsModalOpenState, isParsingState, setIsParsingStateStable,
        currentAiRequestIdState, setCurrentAiRequestIdStateStable, imageReplaceTaskState, setImageReplaceTaskStateStable,
        allFetchedFilesState, currentStep, repoUrlState, setRepoUrlStateStable,
        handleSetFilesFetchedStable, triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted,
        triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed,
        triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage,
        scrollToSection, addToastStable, getKworkInputValueStable, updateKworkInputStable,
        triggerAddImportantToKwork, triggerAddTreeToKwork, triggerSelectAllFetcherFiles, triggerDeselectAllFetcherFiles, triggerClearKworkInput
        // Refs are stable
    ]);

    return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );
};

// --- Consumer Hook ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (context === defaultContextValue) {
        // This should ideally not happen if used correctly within the provider
        logger.error("useRepoXmlPageContext: Attempted to use context before the Provider has rendered its value or outside the provider.");
        // Fallback to default to prevent immediate crash, but log the error.
        return defaultContextValue;
        // throw new Error('useRepoXmlPageContext must be used within a RepoXmlPageContextProvider');
    }
    return context;
};