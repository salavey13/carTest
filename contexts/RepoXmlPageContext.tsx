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
import { checkExistingPrBranch } from '@/app/actions_github/actions';
import * as repoUtils from "@/lib/repoUtils";

export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
export type WorkflowStep = | 'idle' | 'ready_to_fetch' | 'fetching' | 'fetch_failed' | 'files_fetched' | 'files_fetched_highlights' | 'files_fetched_image_replace' | 'files_selected' | 'request_written' | 'request_copied' | 'generating_ai_response' | 'response_pasted' | 'parsing_response' | 'pr_ready';
export interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; }
export interface PendingFlowDetails {
    type: 'ImageSwap' | 'ErrorFix';
    targetPath: string;
    details: any; // Can be { oldUrl, newUrl } for ImageSwap or { Message, Stack, ... } for ErrorFix
}
interface TargetPrData { number: number; url: string; }

// --- Context Interface ---
interface RepoXmlPageContextType {
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
    isPreChecking: boolean;
    showComponents: boolean;
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
    targetPrData: TargetPrData | null;
    pendingFlowDetails: PendingFlowDetails | null;
    kworkInputValue: string; // Guaranteed to be string by provider logic
    // Stable Setters
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
    setTargetPrData: React.Dispatch<React.SetStateAction<TargetPrData | null>>;
    setIsPreChecking: React.Dispatch<React.SetStateAction<boolean>>;
    setPendingFlowDetails: React.Dispatch<React.SetStateAction<PendingFlowDetails | null>>;
    setShowComponents: React.Dispatch<React.SetStateAction<boolean>>;
    // Updated signature to accept undefined, but guarantees string state
    setKworkInputValue: (value: string | undefined | ((prevState: string) => string | undefined)) => void;
    // Stable Triggers
    triggerToggleSettingsModal: () => void;
    triggerPreCheckAndFetch: (repoUrlToCheck: string, potentialBranchName: string, flowType: 'ImageSwap' | 'ErrorFix', flowDetails: any, targetPath: string) => Promise<void>;
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
    // Other Utilities
    addToast: (message: string | React.ReactNode, type?: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message', duration?: number, options?: any) => void;
}

// --- Default Context Value ---
const defaultContextValue: Partial<RepoXmlPageContextType> = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', repoUrl: "https://github.com/salavey13/carTest", primaryHighlightedPath: null, secondaryHighlightedPaths: { component: [], context: [], hook: [], lib: [], other: [] }, targetPrData: null, isPreChecking: false, pendingFlowDetails: null, showComponents: true,
    kworkInputValue: '',
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
    setIsPreChecking: () => { logger.warn("setIsPreChecking called on default context value"); },
    setPendingFlowDetails: () => { logger.warn("setPendingFlowDetails called on default context value"); },
    setShowComponents: () => { logger.warn("setShowComponents called on default context value"); },
    setKworkInputValue: () => { logger.warn("setKworkInputValue called on default context value"); },
    triggerToggleSettingsModal: () => { logger.warn("triggerToggleSettingsModal called on default context value"); },
    triggerPreCheckAndFetch: async () => { logger.warn("triggerPreCheckAndFetch called on default context value"); },
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
};

// --- Context Creation ---
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(defaultContextValue as RepoXmlPageContextType);

// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
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
        // Initialize kworkInputValueState with an empty string to guarantee type
        const [kworkInputValueState, setKworkInputValueState] = useState<string>('');
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
        const [targetPrDataState, setTargetPrDataState] = useState<TargetPrData | null>(null);
        const [isPreCheckingState, setIsPreCheckingState] = useState<boolean>(false);
        const [pendingFlowDetailsState, setPendingFlowDetailsState] = useState<PendingFlowDetails | null>(null);
        const [showComponentsState, setShowComponentsState] = useState<boolean>(true);
        logger.debug("[RepoXmlPageProvider] State initialized.");

        // --- Refs ---
        const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
        const assistantRef = useRef<AICodeAssistantRef | null>(null);
        const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
        const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
        const imageReplaceTaskStateRef = useRef(imageReplaceTaskState); // Ref for task state
        const pendingFlowDetailsRef = useRef(pendingFlowDetailsState); // Ref for pending flow
        const repoUrlStateRef = useRef(repoUrlState); // Ref for repo URL
        logger.debug("[RepoXmlPageProvider] Refs initialized.");

        // --- Hooks ---
        let appToast: ReturnType<typeof useAppToast>;
        try {
            appToast = useAppToast();
            logger.debug("[RepoXmlPageProvider] useAppToast initialized.");
        } catch (e: any) {
            logger.fatal("[RepoXmlPageProvider] CRITICAL ERROR initializing useAppToast:", e);
            appToast = { success: (m) => logger.error("Toast (success) suppressed, hook failed:", m), error: (m) => logger.error("Toast (error) suppressed, hook failed:", m), info: (m) => logger.warn("Toast (info) suppressed, hook failed:", m), warning: (m) => logger.warn("Toast (warning) suppressed, hook failed:", m), loading: (m) => logger.warn("Toast (loading) suppressed, hook failed:", m), message: (m) => logger.warn("Toast (message) suppressed, hook failed:", m), custom: (m) => logger.warn("Toast (custom) suppressed, hook failed:", m), dismiss: () => logger.warn("Toast (dismiss) suppressed, hook failed"), };
        }

        // --- Stable Callbacks for State Setters ---
        const addToastStable = useCallback((message: string | React.ReactNode, type: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' = 'info', duration: number = 3000, options: any = {}) => { if (!appToast?.message) { logger.error("addToastStable: appToast invalid", { message, type }); return; } const toastOptions = duration ? { ...options, duration } : options; switch (type) { case 'success': appToast.success(message, toastOptions); break; case 'error': appToast.error(message, toastOptions); break; case 'info': appToast.info(message, toastOptions); break; case 'warning': appToast.warning(message, toastOptions); break; case 'loading': appToast.loading(message, toastOptions); break; case 'message': default: appToast.message(message, toastOptions); break; } }, [appToast]);
        const setFetchStatusStateStable = useCallback((status: FetchStatus | ((prevState: FetchStatus) => FetchStatus)) => { logger.debug(`[Context Setter] setFetchStatus: ${typeof status === 'function' ? 'func' : status}`); setFetchStatusState(status); }, []);
        const setRepoUrlEnteredStateStable = useCallback((entered: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setRepoUrlEntered: ${typeof entered === 'function' ? 'func' : entered}`); setRepoUrlEnteredState(entered); }, []);
        const setSelectedFetcherFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => { logger.debug(`[Context Setter] setSelectedFetcherFiles size: ${typeof files === 'function' ? 'func' : files.size}`); setSelectedFetcherFilesState(files); }, []);
        const setKworkInputHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setKworkInputHasContent: ${typeof hasContent === 'function' ? 'func' : hasContent}`); setKworkInputHasContentState(hasContent); }, []);
        // --- UPDATED setKworkInputValueStateStable with Logging ---
        const setKworkInputValueStateStable = useCallback((value: string | undefined | ((prevState: string) => string | undefined)) => {
            logger.debug(`[Context Setter] setKworkInputValue called.`);
            let newValueForLog: string | undefined; // Variable to hold the value for logging
            setKworkInputValueState(prev => {
                let determinedValue: string | undefined;
                if (typeof value === 'function') {
                    determinedValue = value(prev);
                } else {
                    determinedValue = value;
                }
                // Ensure the final state is always a string
                const finalValue = typeof determinedValue === 'string' ? determinedValue : '';
                newValueForLog = finalValue; // Capture value for logging
                return finalValue;
            });
            // Log the value *after* the state update is initiated
             logger.info(`[Context Setter Log] setKworkInputValue updated state to: '${newValueForLog?.substring(0, 70)}...'`);
            // Update the boolean flag based on the guaranteed string value
            setKworkInputHasContentStateStable((newValueForLog ?? '').trim().length > 0);
         }, [setKworkInputHasContentStateStable]); // Dependency only on the stable setter for the boolean flag
        // --- END UPDATED setKworkInputValueStateStable ---
        const setRequestCopiedStateStable = useCallback((copied: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setRequestCopied: ${typeof copied === 'function' ? 'func' : copied}`); setRequestCopiedState(copied); }, []);
        const setAiResponseHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setAiResponseHasContent: ${typeof hasContent === 'function' ? 'func' : hasContent}`); setAiResponseHasContentState(hasContent); }, []);
        const setFilesParsedStateStable = useCallback((parsed: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setFilesParsed: ${typeof parsed === 'function' ? 'func' : parsed}`); setFilesParsedState(parsed); }, []);
        const setSelectedAssistantFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => { logger.debug(`[Context Setter] setSelectedAssistantFiles size: ${typeof files === 'function' ? 'func' : files.size}`); setSelectedAssistantFilesState(files); }, []);
        const setAssistantLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setAssistantLoading: ${typeof loading === 'function' ? 'func' : loading}`); setAssistantLoadingState(loading); }, []);
        const setAiActionLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setAiActionLoading: ${typeof loading === 'function' ? 'func' : loading}`); setAiActionLoadingState(loading); }, []);
        const setLoadingPrsStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setLoadingPrs: ${typeof loading === 'function' ? 'func' : loading}`); setLoadingPrsState(loading); }, []);
        const setTargetBranchNameStateStable = useCallback((name: string | null | ((prevState: string | null) => string | null)) => { logger.debug(`[Context Setter] setTargetBranchName: ${typeof name === 'function' ? 'func' : name}`); setTargetBranchNameState(name); }, []);
        const setManualBranchNameStateStable = useCallback((name: string | ((prevState: string) => string)) => { logger.debug(`[Context Setter] setManualBranchName: ${typeof name === 'function' ? 'func' : name}`); setManualBranchNameState(name); }, []);
        const setOpenPrsStateStable = useCallback((prs: SimplePullRequest[] | ((prevState: SimplePullRequest[]) => SimplePullRequest[])) => { logger.debug(`[Context Setter] setOpenPrs count: ${typeof prs === 'function' ? 'func' : prs.length}`); setOpenPrsState(prs); }, []);
        const setIsParsingStateStable = useCallback((parsing: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setIsParsing: ${typeof parsing === 'function' ? 'func' : parsing}`); setIsParsingState(parsing); }, []);
        const setCurrentAiRequestIdStateStable = useCallback((id: string | null | ((prevState: string | null) => string | null)) => { logger.debug(`[Context Setter] setCurrentAiRequestId: ${typeof id === 'function' ? 'func' : id?.substring(0,6)}`); setCurrentAiRequestIdState(id); }, []);
        const setImageReplaceTaskStateStable = useCallback((task: ImageReplaceTask | null | ((prevState: ImageReplaceTask | null) => ImageReplaceTask | null)) => { logger.debug(`[Context Setter] setImageReplaceTask: ${typeof task === 'function' ? 'func' : !!task}`); setImageReplaceTaskState(task); }, []);
        const setAllFetchedFilesStateStable = useCallback((files: FileNode[] | ((prevState: FileNode[]) => FileNode[])) => { logger.debug(`[Context Setter] setAllFetchedFiles count: ${typeof files === 'function' ? 'func' : files.length}`); setAllFetchedFilesState(files); }, []);
        const setRepoUrlStateStable = useCallback((url: string | ((prevState: string) => string)) => { logger.debug(`[Context Setter] setRepoUrl`); setRepoUrlState(url); }, []);
        const setTargetPrDataStable = useCallback((data: TargetPrData | null | ((prevState: TargetPrData | null) => TargetPrData | null)) => { logger.debug(`[Context Setter] setTargetPrData: ${typeof data === 'function' ? 'func' : data ? `PR #${data.number}`: 'null'}`); setTargetPrDataState(data); }, []);
        const setIsPreCheckingStateStable = useCallback((checking: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setIsPreChecking: ${typeof checking === 'function' ? 'func' : checking}`); setIsPreCheckingState(checking); }, []);
        const setPendingFlowDetailsStateStable = useCallback((details: PendingFlowDetails | null | ((prevState: PendingFlowDetails | null) => PendingFlowDetails | null)) => { logger.debug(`[Context Setter] setPendingFlowDetails: ${typeof details === 'function' ? 'func' : details?.type}`); setPendingFlowDetailsState(details); }, []);
        const setShowComponentsStateStable = useCallback((show: boolean | ((prevState: boolean) => boolean)) => { logger.debug(`[Context Setter] setShowComponents: ${typeof show === 'function' ? 'func' : show}`); setShowComponentsState(show); }, []);

        // --- Effects for Refs (keep refs updated with latest state) ---
        useEffect(() => { imageReplaceTaskStateRef.current = imageReplaceTaskState; }, [imageReplaceTaskState]);
        useEffect(() => { pendingFlowDetailsRef.current = pendingFlowDetailsState; }, [pendingFlowDetailsState]);
        useEffect(() => { repoUrlStateRef.current = repoUrlState; }, [repoUrlState]);
        useEffect(() => { logger.log("[RepoXmlPageProvider] Mounted (Provider level)"); }, []);
        useEffect(() => { logger.debug(`[RepoXmlPageProvider Effect] repoUrlState changed: ${repoUrlState}. Updating repoUrlEnteredState.`); setRepoUrlEnteredStateStable(repoUrlState.trim().length > 0 && repoUrlState.includes("github.com")); }, [repoUrlState, setRepoUrlEnteredStateStable]);

        // --- Stable Callback for Scrolling ---
        const scrollToSectionStable = useCallback((sectionId: string) => {
           logger.log(`[DEBUG][CONTEXT] scrollToSection called for ${sectionId}`);
           const element = document.getElementById(sectionId);
           if (element) {
               try {
                   const offsetTop = window.scrollY + element.getBoundingClientRect().top - 80; // Adjust offset
                   window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                   // Highlight effect
                   setTimeout(() => {
                       element.classList.add('highlight-scroll');
                       setTimeout(() => element.classList.remove('highlight-scroll'), 1500);
                   }, 300);
               } catch (scrollError) { logger.error(`Error scrolling to ${sectionId}:`, scrollError); }
           } else { logger.warn(`Scroll target not found: ${sectionId}`); }
        }, []); // No dependencies, uses browser APIs

        // --- Stable Callback: handleSetFilesFetchedStable (FIXED) ---
        const handleSetFilesFetchedStable = useCallback((
            fetched: boolean,
            allFiles: FileNode[],
            primaryHighlight: string | null,
            secondaryHighlights: Record<ImportCategory, string[]>
        ) => {
            const currentTask = imageReplaceTaskStateRef.current; // Use ref for latest value
            const currentPendingFlow = pendingFlowDetailsRef.current; // Use ref for pending flow
            const flowLogPrefix = currentTask ? '[Flow 1 - Image Swap]' : (currentPendingFlow?.type === 'ErrorFix' ? '[Flow 3 - Error Fix]' : '[Flow 2 - Generic Idea]');

            logger.debug(`${flowLogPrefix} Context: handleSetFilesFetchedStable called. fetched=${fetched}, allFiles=${allFiles?.length}, primary=${primaryHighlight}`);

            // Update file-related state first
            setFilesFetchedState(fetched);
            if (fetched) { logger.log(`[Context] Setting allFetchedFilesState: ${allFiles?.length} files`); setAllFetchedFilesStateStable(allFiles ?? []); }
            else { logger.log(`[Context] Clearing allFetchedFilesState because fetched=${fetched}`); setAllFetchedFilesStateStable([]); }
            setPrimaryHighlightPathState(primaryHighlight);
            setSecondaryHighlightPathsState(secondaryHighlights ?? { component: [], context: [], hook: [], lib: [], other: [] });

            let finalFetchStatus: FetchStatus = 'idle'; // <<< Initialize final status

            // Process flows (Image Swap, Error Fix, Standard)
            if (currentTask) {
                // --- Image Task Handling ---
                logger.info(`${flowLogPrefix} Context: handleSetFilesFetchedStable - Processing Image Task`);
                if (fetched) {
                    const targetFileExists = (allFiles ?? []).some(f => f.path === currentTask.targetPath);
                    if (!targetFileExists) {
                       logger.error(`${flowLogPrefix} Context: Image Task Failure: Target file ${currentTask.targetPath} not found!`);
                       finalFetchStatus = 'error'; // <<< Set final status
                       addToastStable(`Ошибка Задачи Изображения: Целевой файл ${currentTask.targetPath} не найден!`, 'error', 5000);
                       setImageReplaceTaskStateStable(null);
                       setAssistantLoadingStateStable(false);
                    } else {
                       logger.info(`${flowLogPrefix} Context: Image Task: Target file ${currentTask.targetPath} found. Triggering replacement.`);
                       finalFetchStatus = 'success'; // <<< Set final status (initially)
                       if (assistantRef.current?.handleDirectImageReplace) {
                           logger.log(`${flowLogPrefix} Context: Calling assistantRef.handleDirectImageReplace for task:`, currentTask);
                           setAssistantLoadingStateStable(true);
                           assistantRef.current.handleDirectImageReplace(currentTask, allFiles ?? [])
                               .then(({ success: replaceSuccess, error: replaceError }) => {
                                   logger.log(`${flowLogPrefix} Context: handleDirectImageReplace promise resolved. Success: ${replaceSuccess}`);
                                   if (!replaceSuccess) {
                                       addToastStable(`Ошибка замены/PR: ${replaceError || 'Неизвестно'}`, 'error');
                                       // Don't change finalFetchStatus here, it was already 'success' from finding the file
                                       setImageReplaceTaskStateStable(null); // Clear task on failure too
                                   } else {
                                        logger.info(`${flowLogPrefix} Context: Image replacement process finished successfully.`);
                                       // Task cleared in handler on success
                                   }
                               })
                               .catch(replaceError => { logger.error(`${flowLogPrefix} Context: Issue calling handleDirectImageReplace:`, replaceError); addToastStable(`Проблема при вызове замены изображения: ${replaceError?.message ?? 'Неизвестно'}`, 'error', 6000); setImageReplaceTaskStateStable(null); })
                               .finally(() => { logger.log(`${flowLogPrefix} Context: handleDirectImageReplace finally block.`); setAssistantLoadingStateStable(false); });
                       } else {
                            logger.fatal(`${flowLogPrefix} Context: CRITICAL PROBLEM: Cannot call handleDirectImageReplace.`, { hasRef: !!assistantRef.current, hasMethod: typeof assistantRef.current?.handleDirectImageReplace });
                            addToastStable(`КРИТИЧЕСКАЯ ПРОБЛЕМА: Не удалось вызвать замену изображения.`, 'error', 7000);
                            finalFetchStatus = 'error'; // <<< Set final status
                            setImageReplaceTaskStateStable(null);
                            setAssistantLoadingStateStable(false);
                       }
                    }
                } else {
                    logger.error(`${flowLogPrefix} Context: Image Task Failure: Failed to fetch any files.`);
                    finalFetchStatus = 'error'; // <<< Set final status
                    addToastStable(`Ошибка Задачи Изображения: Не удалось загрузить файлы.`, 'error', 5000);
                    setImageReplaceTaskStateStable(null);
                    setAssistantLoadingStateStable(false);
                }
                if (currentPendingFlow) { logger.debug(`${flowLogPrefix} Context: Clearing pending flow after image task.`); setPendingFlowDetailsStateStable(null); }

            } else if (currentPendingFlow?.type === 'ErrorFix' && fetched) {
                // --- Error Fix Handling ---
                 const errorFixLogPrefix = '[Flow 3 - Error Fix]';
                 logger.info(`${errorFixLogPrefix} Context: handleSetFilesFetchedStable - Processing ErrorFix flow for: ${currentPendingFlow.targetPath}`);
                 const targetFileExists = allFiles.some(f => f.path === currentPendingFlow.targetPath);
                 if (targetFileExists) {
                     logger.debug(`${errorFixLogPrefix} Context: ErrorFix target file found. Populating kwork.`);
                     const { Message, Stack, Logs, Source } = currentPendingFlow.details;
                     const prompt = `Fix error in ${currentPendingFlow.targetPath}:\n\nMessage: ${Message}\nSource: ${Source || 'N/A'}\n\nStack:\n\`\`\`\n${Stack || 'N/A'}\n\`\`\`\n\nLogs:\n${Logs || 'N/A'}\n\nProvide ONLY the corrected code block or full file content.`;
                     logger.info(`${errorFixLogPrefix} Context: Setting kworkInputValue with ErrorFix prompt:`, prompt.substring(0, 100) + "...");
                     setKworkInputValueStateStable(prompt);
                     finalFetchStatus = 'success'; // <<< Set final status
                     // Auto-select file and scroll
                     if (fetcherRef?.current?.handleAddSelected) {
                         logger.debug(`${errorFixLogPrefix} Context: Triggering handleAddSelected for ErrorFix target file.`);
                         setTimeout(() => {
                             try {
                                 fetcherRef.current?.handleAddSelected?.(new Set([currentPendingFlow.targetPath]), allFiles);
                                 logger.info(`${errorFixLogPrefix} Context: ErrorFix target file added to kwork via imperative handle.`);
                                 scrollToSectionStable('executor');
                             } catch (addErr) { logger.error(`${errorFixLogPrefix} Context: Error calling handleAddSelected for ErrorFix:`, addErr); }
                         }, 100);
                     } else {
                         logger.warn(`${errorFixLogPrefix} Context: Fetcher ref or handleAddSelected missing for ErrorFix auto-add.`);
                         scrollToSectionStable('executor');
                     }
                     setPendingFlowDetailsStateStable(null); // Clear flow after processing
                 } else {
                     logger.error(`${errorFixLogPrefix} Context: ErrorFix target file NOT FOUND: ${currentPendingFlow.targetPath}`);
                     addToastStable(`Ошибка Исправления: Целевой файл ${currentPendingFlow.targetPath} не найден!`, 'error', 5000);
                     finalFetchStatus = 'error'; // <<< Set final status
                     setPendingFlowDetailsStateStable(null); // Clear flow on error
                 }
            } else {
                 // --- Standard Fetch Completion ---
                  const standardLogPrefix = '[Flow 2 - Generic Idea]';
                  logger.debug(`${standardLogPrefix} Context: handleSetFilesFetchedStable - Standard fetch completion.`);
                  if (fetched && currentPendingFlow) {
                     logger.warn(`${standardLogPrefix} Context: Clearing potentially stale pending flow details after standard fetch success.`);
                     setPendingFlowDetailsStateStable(null);
                  }
                  if (fetched && imageReplaceTaskStateRef.current) {
                     logger.warn(`${standardLogPrefix} Context: Clearing potentially stale image task after standard fetch success.`);
                     setImageReplaceTaskStateStable(null);
                  }
                  // <<< FIX: Explicitly set final status for standard flow >>>
                  finalFetchStatus = fetched ? 'success' : 'error';
            }

           // --- Ensure final status is always set ---
           setFetchStatusStateStable(finalFetchStatus);
           logger.log(`[Context] handleSetFilesFetchedStable finished. Final Status: ${finalFetchStatus}, Files Fetched Flag: ${fetched}`);
        }, [ // Dependencies MUST include all stable setters/triggers used inside
             addToastStable, assistantRef, fetcherRef, setFetchStatusStateStable, setAllFetchedFilesStateStable,
             setImageReplaceTaskStateStable, setAssistantLoadingStateStable, setPendingFlowDetailsStateStable,
             setKworkInputValueStateStable, scrollToSectionStable,
             // Refs are stable, their .current is read inside
             imageReplaceTaskStateRef, pendingFlowDetailsRef,
             // Utilities
             logger // Logger functions assumed stable
         ]);


        // --- Other Stable Trigger Callbacks ---
        const triggerToggleSettingsModal = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerToggleSettingsModal`); setIsSettingsModalOpenState(prev => !prev); }, []);
        const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => { logger.log(`[DEBUG][CONTEXT] triggerFetch called. Ref ready: ${!!fetcherRef.current?.handleFetch}`); if (fetcherRef.current?.handleFetch) { try { await fetcherRef.current.handleFetch(isRetry, branch, imageReplaceTaskStateRef.current); } catch (e: any) { logger.error("Error calling fetcherRef.handleFetch:", e); addToastStable(`Крит. ошибка запуска извлечения: ${e?.message ?? 'Неизвестно'}`, "error", 5000); setFetchStatusStateStable('error'); } } else { logger.error("triggerFetch: fetcherRef not set."); addToastStable("Ошибка: Не удалось запустить извлечение (ref).", "error"); } }, [addToastStable, setFetchStatusStateStable, fetcherRef]);
        const triggerPreCheckAndFetch = useCallback(async ( repoUrlToCheck: string, potentialBranchName: string, flowType: 'ImageSwap' | 'ErrorFix', flowDetails: any, targetPath: string ) => {
            const flowLogPrefix = flowType === 'ImageSwap' ? '[Flow 1 - Image Swap]' : '[Flow 3 - Error Fix]';
            logger.log(`${flowLogPrefix} Context: triggerPreCheckAndFetch called for branch: ${potentialBranchName}, flow: ${flowType}, target: ${targetPath}`);
            setIsPreCheckingStateStable(true); setPendingFlowDetailsStateStable({ type: flowType, details: flowDetails, targetPath }); setTargetPrDataStable(null); setTargetBranchNameStateStable(null); setManualBranchNameStateStable(''); setFetchStatusStateStable('loading');
            let branchToFetch: string | null = null; let branchSource: string = 'default';
            try { logger.info(`${flowLogPrefix} Context: Calling checkExistingPrBranch for ${potentialBranchName}`); const checkResult = await checkExistingPrBranch(repoUrlToCheck, potentialBranchName);
                if (checkResult.success && checkResult.data?.exists && checkResult.data?.branchName) {
                    const prSourceBranch = checkResult.data.branchName; logger.info(`${flowLogPrefix} Context: Pre-check found existing PR #${checkResult.data.prNumber} for branch ${potentialBranchName}. Source branch: ${prSourceBranch}. Setting as target.`);
                    setTargetBranchNameStateStable(prSourceBranch); setTargetPrDataStable({ number: checkResult.data.prNumber!, url: checkResult.data.prUrl! }); branchToFetch = prSourceBranch; branchSource = 'existing_pr';
                } else if (checkResult.success) { logger.info(`${flowLogPrefix} Context: Pre-check: No existing PR/branch found for ${potentialBranchName}. Will use default branch.`); branchToFetch = null; branchSource = 'default_no_pr'; }
                else { logger.warn(`${flowLogPrefix} Context: Pre-check failed for ${potentialBranchName}: ${checkResult.error}. Proceeding with default branch.`); addToastStable(`Не удалось проверить PR для ${potentialBranchName}. Используется ветка по умолчанию.`, 'warning'); branchToFetch = null; branchSource = 'default_check_failed'; }
            } catch (err: any) { logger.error(`${flowLogPrefix} Context: Critical error during pre-check:`, err); addToastStable(`Критическая ошибка проверки PR: ${err.message}`, 'error'); branchToFetch = null; branchSource = 'default_critical_error'; }
            finally { setIsPreCheckingStateStable(false); logger.log(`${flowLogPrefix} Context: Pre-check complete. Determined fetch branch: ${branchToFetch ?? 'repo default'} (Source: ${branchSource})`); await triggerFetch(false, branchToFetch); }
        }, [ addToastStable, setTargetBranchNameStateStable, setTargetPrDataStable, setIsPreCheckingStateStable, setPendingFlowDetailsStateStable, setManualBranchNameStateStable, setFetchStatusStateStable, triggerFetch ]);
        const triggerSelectHighlighted = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerSelectHighlighted called. Ref ready: ${!!fetcherRef.current?.selectHighlightedFiles}`); if (fetcherRef.current?.selectHighlightedFiles) { try { fetcherRef.current.selectHighlightedFiles(); } catch (e: any) { logger.error("Error calling fetcherRef.selectHighlightedFiles:", e); addToastStable(`Ошибка выбора связанных файлов: ${e?.message ?? 'Неизвестно'}`, "error"); } } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); } }, [addToastStable, fetcherRef]);
        const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => { logger.log(`[DEBUG][CONTEXT] triggerAddSelectedToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddSelected}. Selected: ${selectedFetcherFilesState.size}`); const currentSelected = selectedFetcherFilesRef.current; const currentAllFiles = allFetchedFilesRef.current; if (fetcherRef.current?.handleAddSelected) { if (currentSelected.size === 0) { addToastStable("Сначала выберите файлы в Экстракторе!", "warning"); return; } try { await fetcherRef.current.handleAddSelected(currentSelected, currentAllFiles); if (clearSelection) { setSelectedFetcherFilesStateStable(new Set()); } } catch (e: any) { logger.error("[Context] Error during handleAddSelected:", e); addToastStable(`Ошибка добавления файлов: ${e?.message ?? 'Неизвестно'}`, "error"); } } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); addToastStable("Ошибка: Компонент Экстрактора недоступен.", "error"); } }, [addToastStable, setSelectedFetcherFilesStateStable, fetcherRef]);
        const selectedFetcherFilesRef = useRef(selectedFetcherFilesState); useEffect(() => { selectedFetcherFilesRef.current = selectedFetcherFilesState; }, [selectedFetcherFilesState]);
        const allFetchedFilesRef = useRef(allFetchedFilesState); useEffect(() => { allFetchedFilesRef.current = allFetchedFilesState; }, [allFetchedFilesState]);
        const triggerCopyKwork = useCallback((): boolean => { logger.log(`[DEBUG][CONTEXT] triggerCopyKwork called. Ref ready: ${!!fetcherRef.current?.handleCopyToClipboard}`); if (fetcherRef.current?.handleCopyToClipboard) { try { return fetcherRef.current.handleCopyToClipboard(undefined, true); } catch (e: any) { logger.error("Error calling fetcherRef.handleCopyToClipboard:", e); addToastStable(`Ошибка копирования запроса: ${e?.message ?? 'Неизвестно'}`, "error"); return false; } } else { logger.error("triggerCopyKwork: fetcherRef is not set."); addToastStable("Ошибка копирования: Компонент Экстрактора недоступен.", "error"); return false; } }, [addToastStable, fetcherRef]);
        const triggerAskAi = useCallback(async () => { logger.warn("AI Ask Triggered (No Longer Active - Use Copy/Paste Flow)"); addToastStable("Скопируйте запрос и вставьте в AI.", "info"); return { success: false, error: "Ask AI button disabled" }; }, [addToastStable]);
        const triggerParseResponse = useCallback(async () => { logger.log(`[DEBUG][CONTEXT] triggerParseResponse called. Ref ready: ${!!assistantRef.current?.handleParse}`); if (assistantRef.current?.handleParse) { try { await assistantRef.current.handleParse(); } catch (e: any) { logger.error("Error calling assistantRef.handleParse:", e); addToastStable(`Крит. ошибка разбора ответа: ${e?.message ?? 'Неизвестно'}`, "error", 5000); } } else { logger.error("triggerParseResponse: assistantRef is not set."); addToastStable("Ошибка разбора: Компонент Ассистента недоступен.", "error");} }, [addToastStable, assistantRef]);
        const triggerSelectAllParsed = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerSelectAllParsed called. Ref ready: ${!!assistantRef.current?.selectAllParsedFiles}`); if (assistantRef.current?.selectAllParsedFiles) { try { assistantRef.current.selectAllParsedFiles(); } catch (e: any) { logger.error("Error calling assistantRef.selectAllParsedFiles:", e); addToastStable(`Ошибка выбора всех файлов: ${e?.message ?? 'Неизвестно'}`, "error"); } } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); addToastStable("Ошибка выбора: Компонент Ассистента недоступен.", "error");} }, [addToastStable, assistantRef]);
        const triggerCreateOrUpdatePR = useCallback(async () => { logger.log(`[DEBUG][CONTEXT] triggerCreateOrUpdatePR called. Ref ready: ${!!assistantRef.current?.handleCreatePR}`); if (assistantRef.current?.handleCreatePR) { try { await assistantRef.current.handleCreatePR(); } catch (e: any) { logger.error("Error calling assistantRef.handleCreatePR:", e); addToastStable(`Крит. ошибка создания/обновления PR: ${e?.message ?? 'Неизвестно'}`, "error", 5000); } } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); addToastStable("Ошибка PR: Компонент Ассистента недоступен.", "error");} }, [addToastStable, assistantRef]);
        const triggerGetOpenPRsStable = useCallback(async (url: string) => { const effectiveUrl = url || repoUrlStateRef.current; logger.log(`[DEBUG][CONTEXT] triggerGetOpenPRs called for ${effectiveUrl}`); if (!effectiveUrl || !effectiveUrl.includes('github.com')) { setOpenPrsStateStable([]); setLoadingPrsStateStable(false); logger.warn("triggerGetOpenPRs: Invalid URL", effectiveUrl); return; } logger.log("triggerGetOpenPRs: Fetching for", effectiveUrl); setLoadingPrsStateStable(true); try { const result = await getOpenPullRequests(effectiveUrl); if (result.success && result.pullRequests) { setOpenPrsStateStable(result.pullRequests as SimplePullRequest[]); } else { addToastStable("Ошибка загрузки PR: " + (result.error ?? 'Неизвестно'), "error"); setOpenPrsStateStable([]); } } catch (e: any) { logger.error("triggerGetOpenPRs Action Error:", e); addToastStable(`Крит. ошибка загрузки PR: ${e?.message ?? 'Неизвестно'}`, "error", 5000); setOpenPrsStateStable([]); } finally { setLoadingPrsStateStable(false); } }, [addToastStable, setLoadingPrsStateStable, setOpenPrsStateStable]);
        const triggerUpdateBranchStable = useCallback(async ( repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => { logger.log(`[Context] triggerUpdateBranch: ${branch}, PR#: ${prNumber ?? 'N/A'}`); setAssistantLoadingStateStable(true); try { const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription); if (result.success) { logger.log(`[DEBUG][CONTEXT] triggerUpdateBranch SUCCESS. Triggering PR refresh.`); triggerGetOpenPRsStable(repoUrlParam).catch(err => logger.error("Failed to refresh PRs after branch update:", err)); return { success: true }; } else { addToastStable(`Ошибка обновления ветки: ${result.error}`, 'error', 5000); return { success: false, error: result.error }; } } catch (e: any) { logger.error("[Context] triggerUpdateBranch critical Error:", e); addToastStable(`Крит. ошибка обновления ветки: ${e.message}`, "error", 5000); return { success: false, error: e.message }; } finally { logger.log(`[DEBUG][CONTEXT] triggerUpdateBranch FINALLY`); setAssistantLoadingStateStable(false); } }, [addToastStable, triggerGetOpenPRsStable, setAssistantLoadingStateStable]);
        const updateRepoUrlInAssistantStable = useCallback((url: string) => { logger.log(`[DEBUG][CONTEXT] updateRepoUrlInAssistant called. Ref ready: ${!!assistantRef.current?.updateRepoUrl}`); if (assistantRef.current?.updateRepoUrl) { try { assistantRef.current.updateRepoUrl(url); } catch (e: any) { logger.error(`Error calling assistantRef.updateRepoUrl: ${e?.message ?? 'Неизвестно'}`); } } }, [assistantRef]);
        const triggerAddImportantToKworkStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerAddImportantToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddImportantFiles}`); fetcherRef.current?.handleAddImportantFiles?.(); }, [fetcherRef]);
        const triggerAddTreeToKworkStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerAddTreeToKwork called. Ref ready: ${!!fetcherRef.current?.handleAddFullTree}`); fetcherRef.current?.handleAddFullTree?.(); }, [fetcherRef]);
        const triggerSelectAllFetcherFilesStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerSelectAllFetcherFiles called. Ref ready: ${!!fetcherRef.current?.selectAllFiles}`); fetcherRef.current?.selectAllFiles?.(); }, [fetcherRef]);
        const triggerDeselectAllFetcherFilesStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerDeselectAllFetcherFiles called. Ref ready: ${!!fetcherRef.current?.deselectAllFiles}`); fetcherRef.current?.deselectAllFiles?.(); }, [fetcherRef]);
        const triggerClearKworkInputStable = useCallback(() => { logger.log(`[DEBUG][CONTEXT] triggerClearKworkInput called. Ref ready: ${!!fetcherRef.current?.clearAll}`); fetcherRef.current?.clearAll?.(); }, [fetcherRef]);

        // --- Workflow Step Calculation ---
        const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
        useEffect(() => {
            let calculatedStep: WorkflowStep = 'idle';
            if (isPreCheckingState) { calculatedStep = 'fetching'; }
            else if (imageReplaceTaskState) {
                 if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
                 else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) { calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace'; }
                 else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && imageReplaceTaskState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) { calculatedStep = 'fetch_failed'; }
                 else calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
             } else {
                 if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
                 else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
                 else if (isParsingState) calculatedStep = 'parsing_response';
                 else if (assistantLoadingState) calculatedStep = 'generating_ai_response';
                 else if (aiActionLoadingState) calculatedStep = 'generating_ai_response';
                 else if (filesFetchedState) {
                     if (aiResponseHasContentState) { calculatedStep = filesParsedState ? 'pr_ready' : 'response_pasted'; }
                     else if (kworkInputHasContentState) { calculatedStep = requestCopiedState ? 'request_copied' : 'request_written'; }
                     else if (selectedFetcherFilesState.size > 0) { calculatedStep = 'files_selected'; }
                     else if (primaryHighlightPathState || Object.values(secondaryHighlightPathsState).some(arr => arr.length > 0)) { calculatedStep = 'files_fetched_highlights'; }
                     else { calculatedStep = 'files_fetched'; }
                 }
                 else { calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle'; }
             }
            setCurrentStep(prevStep => { if (prevStep !== calculatedStep) { logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`); return calculatedStep; } return prevStep; });
        }, [ fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState, selectedFetcherFilesState, aiActionLoadingState, isParsingState, imageReplaceTaskState, allFetchedFilesState, assistantLoadingState, repoUrlEnteredState, isPreCheckingState ]);

        // --- Buddy Message Logic (Stable Callback Wrapper) ---
         const getXuinityMessageStable = useCallback((): string => {
             const localCurrentStep = currentStep; const localManualBranchName = manualBranchNameState; const localTargetBranchName = targetBranchNameState; const localImageReplaceTask = imageReplaceTaskState; const localFetchStatus = fetchStatusState; const localAllFilesLength = allFetchedFilesState.length; const localSelectedFetchSize = selectedFetcherFilesState.size; const localSelectedAssistSize = selectedAssistantFilesState.size; const localIsPreChecking = isPreCheckingState; const localPendingFlowDetails = pendingFlowDetailsState; const localFilesFetched = filesFetchedState; const localAssistantLoading = assistantLoadingState; const localAllFetchedFiles = allFetchedFilesState;
             const effectiveBranch = localManualBranchName.trim() || localTargetBranchName || 'default';
             logger.debug(`[getXuinityMessageStable] Calculating message for step: ${localCurrentStep}, task: ${!!localImageReplaceTask}, isPreChecking: ${localIsPreChecking}`);
             if (localIsPreChecking) return `Проверяю наличие PR/ветки для '${localPendingFlowDetails?.targetPath.split('/').pop() ?? 'файла'}'...`;
             if (localImageReplaceTask) {
                 if (localFetchStatus === 'loading' || localFetchStatus === 'retrying') return `Гружу файл ${localImageReplaceTask.targetPath.split('/').pop()} из ветки ${effectiveBranch}...`;
                 if (localFetchStatus === 'error' || localFetchStatus === 'failed_retries') return "Твою ж! Ошибка загрузки файла. URL/ветка верные? Жми 'Попробовать Снова'.";
                 const targetFileExists = localAllFetchedFiles?.some(f => f.path === localImageReplaceTask.targetPath);
                 if (localFetchStatus === 'success' && !targetFileExists && localFilesFetched) return "Файл для замены НЕ НАЙДЕН в репе! Проверь путь/ветку!";
                 if (localFetchStatus === 'success' && targetFileExists) { if (localAssistantLoading) return "Меняю картинку и делаю авто-PR... Магия!"; return "Файл на месте! Ассистент сейчас сам всё заменит и запушит PR. Левел 1 пройден!"; }
                 return "Готовлю авто-замену картинки (Level 1)...";
             }
             switch (localCurrentStep) {
                 case 'idle': return "Готов качать Vibe! Введи URL репы GitHub или покажи мне на странице, что чинить/делать.";
                 case 'ready_to_fetch': return `Репа есть. Жми 'Извлечь Файлы' из '${effectiveBranch}', чтобы я дал контекст AI.`;
                 case 'fetching': return `Качаю код из '${effectiveBranch}'...`;
                 case 'fetch_failed': return "Файл? Не, не слышал. Ошибка загрузки. Проверь URL/токен/ветку и жми 'Попробовать Снова'.";
                 case 'files_fetched': return `Код скачан (${localAllFilesLength} файлов). Теперь твоя очередь рулить AI! Выбери файлы-контекст или просто напиши идею в поле запроса.`;
                 case 'files_fetched_highlights': return `О! Я вижу связанные файлы (стр./компоненты/хуки)! Выбери их (+1 Vibe Perk!) и/или добавь (+) в запрос, чтобы AI лучше понял, что делать.`;
                 case 'files_selected': return `Выбрал ${localSelectedFetchSize} файлов. Отлично! Добавь их (+) в запрос как контекст для AI.`;
                 case 'request_written': return `Запрос для AI готов! Скопируй его и закинь своему GPT/Gemini. Жду результат!`;
                 case 'request_copied': return "Скопировал? Красава! Теперь жду ответ от твоего AI. Вставь его в поле ниже.";
                 case 'response_pasted': return "Есть ответ! Отлично. Жми '➡️', я разберу код и проверю на ошибки.";
                 case 'parsing_response': return "Парсю код, ищу косяки... (+1 Parser Perk!)";
                 case 'pr_ready': const actionText = localTargetBranchName ? 'обновления ветки' : 'создания PR'; if (localSelectedAssistSize === 0) return "Код разобран и проверен! Теперь выбери файлы, которые пойдут в коммит."; return `Код разобран! Выбрано ${localSelectedAssistSize} файлов для ${actionText}. Проверь код в ассистенте (ошибки/варнинги?). Жми кнопку PR/Update!`;
                 default: logger.warn(`[getXuinityMessageStable] Reached default case for step: ${localCurrentStep}`); return "Вайб неопределен... Что будем делать?";
             }
          }, [ currentStep, manualBranchNameState, targetBranchNameState, imageReplaceTaskState, fetchStatusState, allFetchedFilesState, filesFetchedState, assistantLoadingState, selectedFetcherFilesState.size, selectedAssistantFilesState.size, isPreCheckingState, pendingFlowDetailsState, logger ]);

        // --- Memoized Context Value ---
        const contextValue = useMemo((): RepoXmlPageContextType => {
             try {
                logger.debug("[RepoXmlPageProvider] Memoizing context value START");
                const value = {
                    fetchStatus: fetchStatusState, repoUrlEntered: repoUrlEnteredState, filesFetched: filesFetchedState, kworkInputHasContent: kworkInputHasContentState, requestCopied: requestCopiedState, aiResponseHasContent: aiResponseHasContentState, filesParsed: filesParsedState, assistantLoading: assistantLoadingState, aiActionLoading: aiActionLoadingState, loadingPrs: loadingPrsState, isSettingsModalOpen: isSettingsModalOpenState, isParsing: isParsingState, isPreChecking: isPreCheckingState, showComponents: showComponentsState, selectedFetcherFiles: selectedFetcherFilesState, selectedAssistantFiles: selectedAssistantFilesState, targetBranchName: targetBranchNameState, manualBranchName: manualBranchNameState, openPrs: openPrsState, currentAiRequestId: currentAiRequestIdState, imageReplaceTask: imageReplaceTaskState, allFetchedFiles: allFetchedFilesState, currentStep, repoUrl: repoUrlState, primaryHighlightedPath: primaryHighlightPathState, secondaryHighlightedPaths: secondaryHighlightPathsState, targetPrData: targetPrDataState, pendingFlowDetails: pendingFlowDetailsState, kworkInputValue: kworkInputValueState,
                    setFetchStatus: setFetchStatusStateStable, setRepoUrlEntered: setRepoUrlEnteredStateStable, handleSetFilesFetched: handleSetFilesFetchedStable, setSelectedFetcherFiles: setSelectedFetcherFilesStateStable, setKworkInputHasContent: setKworkInputHasContentStateStable, setRequestCopied: setRequestCopiedStateStable, setAiResponseHasContent: setAiResponseHasContentStateStable, setFilesParsed: setFilesParsedStateStable, setSelectedAssistantFiles: setSelectedAssistantFilesStateStable, setAssistantLoading: setAssistantLoadingStateStable, setAiActionLoading: setAiActionLoadingStateStable, setLoadingPrs: setLoadingPrsStateStable, setTargetBranchName: setTargetBranchNameStateStable, setManualBranchName: setManualBranchNameStateStable, setOpenPrs: setOpenPrsStateStable, setIsParsing: setIsParsingStateStable, setContextIsParsing: setIsParsingStateStable, setCurrentAiRequestId: setCurrentAiRequestIdStateStable, setImageReplaceTask: setImageReplaceTaskStateStable, setRepoUrl: setRepoUrlStateStable, setTargetPrData: setTargetPrDataStable, setIsPreChecking: setIsPreCheckingStateStable, setPendingFlowDetails: setPendingFlowDetailsStateStable, setShowComponents: setShowComponentsStateStable, setKworkInputValue: setKworkInputValueStateStable, // Pass the stable, wrapped setter
                    triggerToggleSettingsModal, triggerPreCheckAndFetch, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch: triggerUpdateBranchStable, triggerGetOpenPRs: triggerGetOpenPRsStable, updateRepoUrlInAssistant: updateRepoUrlInAssistantStable, getXuinityMessage: getXuinityMessageStable, scrollToSection: scrollToSectionStable, triggerAddImportantToKwork: triggerAddImportantToKworkStable, triggerAddTreeToKwork: triggerAddTreeToKworkStable, triggerSelectAllFetcherFiles: triggerSelectAllFetcherFilesStable, triggerDeselectAllFetcherFiles: triggerDeselectAllFetcherFilesStable, triggerClearKworkInput: triggerClearKworkInputStable,
                    kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
                    addToast: addToastStable,
                };
                logger.debug("[RepoXmlPageProvider] Memoizing context value END");
                return value;
            } catch (memoError: any) { logger.fatal("[RepoXmlPageProvider] CRITICAL ERROR during context value memoization:", memoError); return defaultContextValue as RepoXmlPageContextType; }
        }, [
            fetchStatusState, repoUrlEnteredState, filesFetchedState, kworkInputHasContentState, requestCopiedState, aiResponseHasContentState, filesParsedState, assistantLoadingState, aiActionLoadingState, loadingPrsState, isSettingsModalOpenState, isParsingState, isPreCheckingState, showComponentsState, selectedFetcherFilesState, selectedAssistantFilesState, targetBranchNameState, manualBranchNameState, openPrsState, currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, currentStep, repoUrlState, primaryHighlightPathState, secondaryHighlightPathsState, targetPrDataState, pendingFlowDetailsState, kworkInputValueState,
            setFetchStatusStateStable, setRepoUrlEnteredStateStable, handleSetFilesFetchedStable, setSelectedFetcherFilesStateStable, setKworkInputHasContentStateStable, setRequestCopiedStateStable, setAiResponseHasContentStateStable, setFilesParsedStateStable, setSelectedAssistantFilesStateStable, setAssistantLoadingStateStable, setAiActionLoadingStateStable, setLoadingPrsStateStable, setTargetBranchNameStateStable, setManualBranchNameStateStable, setOpenPrsStateStable, setIsParsingStateStable, setCurrentAiRequestIdStateStable, setImageReplaceTaskStateStable, setRepoUrlStateStable, setTargetPrDataStable, setIsPreCheckingStateStable, setPendingFlowDetailsStateStable, setShowComponentsStateStable, setKworkInputValueStateStable, // Include the new stable setter
            triggerToggleSettingsModal, triggerPreCheckAndFetch, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranchStable, triggerGetOpenPRsStable, updateRepoUrlInAssistantStable, getXuinityMessageStable, scrollToSectionStable, triggerAddImportantToKworkStable, triggerAddTreeToKworkStable, triggerSelectAllFetcherFilesStable, triggerDeselectAllFetcherFilesStable, triggerClearKworkInputStable,
            addToastStable,
            kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef // Refs are stable
        ]);

        logger.log("[RepoXmlPageProvider] Rendering Provider wrapper", { step: contextValue.currentStep });
        return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );

    } catch (providerError: any) {
        // Use console.error here as logger might not be initialized if this part fails
        console.error("[RepoXmlPageProvider] CRITICAL INITIALIZATION ERROR:", providerError);
        // Render a fallback UI instead of crashing the app
        return <div className="fixed inset-0 flex items-center justify-center bg-red-900 text-white p-4 z-[9999]">Критическая ошибка инициализации провайдера страницы: {providerError.message}</div>;
    }
};

// --- Consumer Hook ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (context === undefined) { logger.fatal("useRepoXmlPageContext used outside RepoXmlPageProvider!"); throw new Error("useRepoXmlPageContext must be used within a RepoXmlPageProvider"); }
    // Updated check to reflect the new stable setter name
    if (context.setKworkInputValue === defaultContextValue.setKworkInputValue && typeof window !== 'undefined') {
        logger.warn("useRepoXmlPageContext: Context might be the default value (check provider setup).");
    }
    return context as RepoXmlPageContextType;
};

// Export necessary types
export type { FileNode, SimplePullRequest, RepoTxtFetcherRef, AICodeAssistantRef, ImportCategory, FetchStatus, WorkflowStep, ImageReplaceTask, RepoXmlPageContextType, PendingFlowDetails, TargetPrData };