"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
import { useAppToast } from '@/hooks/useAppToast';
export interface FileNode { path: string; content: string; }
export interface SimplePullRequest { id: number; number: number; title: string; html_url: string; user: { login: string | null; avatar_url: string | null } | null; head: { ref: string }; base: { ref: string }; updated_at: string; }
import { debugLogger as logger } from '@/lib/debugLogger';
import { getOpenPullRequests, updateBranch, checkExistingPrBranch, createGitHubPullRequest } from '@/app/actions_github/actions'; 
import type { RepoTxtFetcherRef } from '@/components/RepoTxtFetcher';
import type { AICodeAssistantRef } from '@/components/AICodeAssistant';
import * as repoUtils from "@/lib/repoUtils";
import { useAppContext } from './AppContext'; 
import { 
    checkAndUnlockFeatureAchievement, 
    updateUserCyberFitnessProfile, 
    logCyberFitnessAction, 
    Achievement,
    PERKS_BY_LEVEL,
    ALL_ACHIEVEMENTS,
    CYBERFIT_METADATA_KEY // IMPORTED
} from '@/hooks/cyberFitnessSupabase'; 

export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
export type WorkflowStep = | 'idle' | 'ready_to_fetch' | 'fetching' | 'fetch_failed' | 'files_fetched' | 'files_fetched_highlights' | 'files_fetched_image_replace' | 'files_selected' | 'request_written' | 'request_copied' | 'generating_ai_response' | 'response_pasted' | 'parsing_response' | 'pr_ready';
export interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; } 
export interface IconReplaceTask { targetPath: string; oldIconName: string; newIconName: string; componentProps?: string; } 

export interface PendingFlowDetails {
    type: 'ImageSwap' | 'ErrorFix' | 'IconSwap'; 
    targetPath: string;
    details: any; 
}
interface TargetPrData { number: number; url: string; }

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
    iconReplaceTask: IconReplaceTask | null;   
    allFetchedFiles: FileNode[];
    currentStep: WorkflowStep;
    repoUrl: string;
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: Record<ImportCategory, string[]>;
    targetPrData: TargetPrData | null;
    pendingFlowDetails: PendingFlowDetails | null;
    kworkInputValue: string; 
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
    setIconReplaceTask: React.Dispatch<React.SetStateAction<IconReplaceTask | null>>; 
    setRepoUrl: React.Dispatch<React.SetStateAction<string>>;
    setTargetPrData: React.Dispatch<React.SetStateAction<TargetPrData | null>>;
    setIsPreChecking: React.Dispatch<React.SetStateAction<boolean>>;
    setPendingFlowDetails: React.Dispatch<React.SetStateAction<PendingFlowDetails | null>>;
    setShowComponents: React.Dispatch<React.SetStateAction<boolean>>;
    setKworkInputValue: (value: string | undefined | ((prevState: string) => string | undefined)) => void;
    triggerToggleSettingsModal: () => void;
    triggerPreCheckAndFetch: (repoUrlToCheck: string, potentialBranchName: string, flowType: PendingFlowDetails['type'], flowDetails: any, targetPath: string) => Promise<void>;
    triggerFetch: (isRetry?: boolean, branch?: string | null) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (clearSelection?: boolean) => Promise<void>;
    triggerCopyKwork: () => Promise<void>; // Changed return type from Promise<boolean> to Promise<void>
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreateOrUpdatePR: () => Promise<void>; 
    triggerUpdateBranch: ( repoUrl: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ) => Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }>;
    triggerCreateNewPR: ( repoUrl: string, filesToCommit: FileNode[], prTitle: string, prDescription: string, commitMessage: string, newBranchName: string ) => Promise<{ success: boolean; error?: string; prUrl?: string; prNumber?: number; branch?: string; newAchievements?: Achievement[] }>;
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
}

const defaultContextValue: Partial<RepoXmlPageContextType> = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, iconReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', repoUrl: "https://github.com/salavey13/carTest", primaryHighlightedPath: null, secondaryHighlightedPaths: { component: [], context: [], hook: [], lib: [], other: [] }, targetPrData: null, isPreChecking: false, pendingFlowDetails: null, showComponents: true,
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
    setIconReplaceTask: () => { logger.warn("setIconReplaceTask called on default context value"); },
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
    triggerCopyKwork: async () => { logger.warn("triggerCopyKwork called on default context value"); }, // Default void promise
    triggerAskAi: async () => { logger.warn("triggerAskAi called on default context value"); return { success: false, error: "Context not ready" }; },
    triggerParseResponse: async () => { logger.warn("triggerParseResponse called on default context value"); },
    triggerSelectAllParsed: () => { logger.warn("triggerSelectAllParsed called on default context value"); },
    triggerCreateOrUpdatePR: async () => { logger.warn("triggerCreateOrUpdatePR called on default context value"); },
    triggerUpdateBranch: async () => { logger.warn("triggerUpdateBranch called on default context value"); return { success: false, error: "Context not ready" }; },
    triggerCreateNewPR: async () => { logger.warn("triggerCreateNewPR called on default context value"); return { success: false, error: "Context not ready"}; },
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

const RepoXmlPageContext = createContext<RepoXmlPageContextType>(defaultContextValue as RepoXmlPageContextType);

export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
    try {
        logger.log("[RepoXmlPageProvider] Initializing...");

        const [fetchStatusState, setFetchStatusState] = useState<FetchStatus>('idle');
        const [repoUrlEnteredState, setRepoUrlEnteredState] = useState<boolean>(false);
        const [filesFetchedState, setFilesFetchedState] = useState<boolean>(false);
        const [primaryHighlightPathState, setPrimaryHighlightPathState] = useState<string | null>(null);
        const [secondaryHighlightPathsStateInternal, setSecondaryHighlightPathsStateInternal] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
        const [selectedFetcherFilesState, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
        const [kworkInputHasContentState, setKworkInputHasContentState] = useState<boolean>(false);
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
        const [iconReplaceTaskState, setIconReplaceTaskState] = useState<IconReplaceTask | null>(null); 
        const [allFetchedFilesState, setAllFetchedFilesState] = useState<FileNode[]>([]);
        const [repoUrlState, setRepoUrlState] = useState<string>(defaultContextValue.repoUrl ?? '');
        const [targetPrDataState, setTargetPrDataState] = useState<TargetPrData | null>(null);
        const [isPreCheckingState, setIsPreCheckingState] = useState<boolean>(false);
        const [pendingFlowDetailsState, setPendingFlowDetailsState] = useState<PendingFlowDetails | null>(null);
        const [showComponentsState, setShowComponentsState] = useState<boolean>(true);
        
        const { dbUser } = useAppContext(); 

        const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
        const assistantRef = useRef<AICodeAssistantRef | null>(null);
        const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
        const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
        const imageReplaceTaskStateRef = useRef(imageReplaceTaskState); 
        const iconReplaceTaskStateRef = useRef(iconReplaceTaskState); 
        const pendingFlowDetailsRef = useRef(pendingFlowDetailsState); 
        const repoUrlStateRef = useRef(repoUrlState); 
        
        let appToastHook: ReturnType<typeof useAppToast>;
        try {
            appToastHook = useAppToast();
        } catch (e: any) {
            logger.fatal("[RepoXmlPageProvider] CRITICAL ERROR initializing useAppToast:", e);
            appToastHook = { success: (m) => logger.error("Toast (success) suppressed, hook failed:", m), error: (m) => logger.error("Toast (error) suppressed, hook failed:", m), info: (m) => logger.warn("Toast (info) suppressed, hook failed:", m), warning: (m) => logger.warn("Toast (warning) suppressed, hook failed:", m), loading: (m) => logger.warn("Toast (loading) suppressed, hook failed:", m), message: (m) => logger.warn("Toast (message) suppressed, hook failed:", m), custom: (m) => logger.warn("Toast (custom) suppressed, hook failed:", m), dismiss: () => logger.warn("Toast (dismiss) suppressed, hook failed"), };
        }
        const addToastStable = useCallback((message: string | React.ReactNode, type: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' = 'info', duration: number = 3000, options: any = {}) => { if (!appToastHook?.message) { logger.error("addToastStable: appToast invalid", { message, type }); return; } const toastOptions = duration ? { ...options, duration } : options; switch (type) { case 'success': appToastHook.success(message, toastOptions); break; case 'error': appToastHook.error(message, toastOptions); break; case 'info': appToastHook.info(message, toastOptions); break; case 'warning': appToastHook.warning(message, toastOptions); break; case 'loading': appToastHook.loading(message, toastOptions); break; case 'message': default: appToastHook.message(message, toastOptions); break; } }, [appToastHook]);
        const setFetchStatusStateStable = useCallback((status: FetchStatus | ((prevState: FetchStatus) => FetchStatus)) => setFetchStatusState(status), []);
        const setRepoUrlEnteredStateStable = useCallback((entered: boolean | ((prevState: boolean) => boolean)) => setRepoUrlEnteredState(entered), []);
        const setSelectedFetcherFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => setSelectedFetcherFilesState(files), []);
        const setKworkInputHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => setKworkInputHasContentState(hasContent), []);
        const setKworkInputValueStateStable = useCallback((value: string | undefined | ((prevState: string) => string | undefined)) => {
            setKworkInputValueState(prev => {
                const determinedValue = typeof value === 'function' ? value(prev) : value;
                const finalValue = typeof determinedValue === 'string' ? determinedValue : '';
                setKworkInputHasContentStateStable(finalValue.trim().length > 0);
                return finalValue;
            });
         }, [setKworkInputHasContentStateStable]);
        const setRequestCopiedStateStable = useCallback((copied: boolean | ((prevState: boolean) => boolean)) => setRequestCopiedState(copied), []);
        const setAiResponseHasContentStateStable = useCallback((hasContent: boolean | ((prevState: boolean) => boolean)) => setAiResponseHasContentState(hasContent), []);
        const setFilesParsedStateStable = useCallback((parsed: boolean | ((prevState: boolean) => boolean)) => setFilesParsedState(parsed), []);
        const setSelectedAssistantFilesStateStable = useCallback((files: Set<string> | ((prevState: Set<string>) => Set<string>)) => setSelectedAssistantFilesState(files), []);
        const setAssistantLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => setAssistantLoadingState(loading), []);
        const setAiActionLoadingStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => setAiActionLoadingState(loading), []);
        const setLoadingPrsStateStable = useCallback((loading: boolean | ((prevState: boolean) => boolean)) => setLoadingPrsState(loading), []);
        const setTargetBranchNameStateStable = useCallback((name: string | null | ((prevState: string | null) => string | null)) => setTargetBranchNameState(name), []);
        const setManualBranchNameStateStable = useCallback((name: string | ((prevState: string) => string)) => setManualBranchNameState(name), []);
        const setOpenPrsStateStable = useCallback((prs: SimplePullRequest[] | ((prevState: SimplePullRequest[]) => SimplePullRequest[])) => setOpenPrsState(prs), []);
        const setIsParsingStateStable = useCallback((parsing: boolean | ((prevState: boolean) => boolean)) => setIsParsingState(parsing), []);
        const setCurrentAiRequestIdStateStable = useCallback((id: string | null | ((prevState: string | null) => string | null)) => setCurrentAiRequestIdState(id), []);
        const setImageReplaceTaskStateStable = useCallback((task: ImageReplaceTask | null | ((prevState: ImageReplaceTask | null) => ImageReplaceTask | null)) => setImageReplaceTaskState(task), []);
        const setIconReplaceTaskStateStable = useCallback((task: IconReplaceTask | null | ((prevState: IconReplaceTask | null) => IconReplaceTask | null)) => setIconReplaceTaskState(task), []); 
        const setAllFetchedFilesStateStable = useCallback((files: FileNode[] | ((prevState: FileNode[]) => FileNode[])) => setAllFetchedFilesState(files), []);
        const setRepoUrlStateStable = useCallback((url: string | ((prevState: string) => string)) => setRepoUrlState(url), []);
        const setTargetPrDataStable = useCallback((data: TargetPrData | null | ((prevState: TargetPrData | null) => TargetPrData | null)) => setTargetPrDataState(data), []);
        const setIsPreCheckingStateStable = useCallback((checking: boolean | ((prevState: boolean) => boolean)) => setIsPreCheckingState(checking), []);
        const setPendingFlowDetailsStateStable = useCallback((details: PendingFlowDetails | null | ((prevState: PendingFlowDetails | null) => PendingFlowDetails | null)) => setPendingFlowDetailsState(details), []);
        const setShowComponentsStateStable = useCallback((show: boolean | ((prevState: boolean) => boolean)) => setShowComponentsState(show), []);

        useEffect(() => { imageReplaceTaskStateRef.current = imageReplaceTaskState; }, [imageReplaceTaskState]);
        useEffect(() => { iconReplaceTaskStateRef.current = iconReplaceTaskState; }, [iconReplaceTaskState]); 
        useEffect(() => { pendingFlowDetailsRef.current = pendingFlowDetailsState; }, [pendingFlowDetailsState]);
        useEffect(() => { repoUrlStateRef.current = repoUrlState; }, [repoUrlState]);
        useEffect(() => { setRepoUrlEnteredStateStable(repoUrlState.trim().length > 0 && repoUrlState.includes("github.com")); }, [repoUrlState, setRepoUrlEnteredStateStable]);

        const scrollToSectionStable = useCallback((sectionId: string) => {
           const element = document.getElementById(sectionId);
           if (element) {
               try {
                   const offsetTop = window.scrollY + element.getBoundingClientRect().top - 80; 
                   window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                   setTimeout(() => {
                       element.classList.add('highlight-scroll');
                       setTimeout(() => element.classList.remove('highlight-scroll'), 1500);
                   }, 300);
               } catch (scrollError) { logger.error(`Error scrolling to ${sectionId}:`, scrollError); }
           } else { logger.warn(`Scroll target not found: ${sectionId}`); }
        }, []); 

        const handleSetFilesFetchedStable = useCallback(async (
            fetched: boolean, // This is the result of the primary file fetch operation
            allFiles: FileNode[],
            primaryHighlight: string | null,
            secondaryHighlights: Record<ImportCategory, string[]>
        ) => {
            const currentImgTask = imageReplaceTaskStateRef.current;
            const currentIconTask = iconReplaceTaskStateRef.current;
            const currentPendingFlow = pendingFlowDetailsRef.current;
        
            const flowLogPrefix = currentImgTask ? '[Flow 1 - Image Swap]'
                : currentIconTask ? '[Flow X - Icon Swap]'
                : (currentPendingFlow?.type === 'ErrorFix' ? '[Flow 3 - Error Fix]'
                : '[Flow 2 - Generic Idea]');
        
            logger.debug(`${flowLogPrefix} Context: handleSetFilesFetchedStable. fetched=${fetched}, allFiles=${allFiles?.length}, primary=${primaryHighlight}`);
            
            // Set initial UI states based on the fetch operation
            setFilesFetchedState(fetched);
            if (fetched) { setAllFetchedFilesStateStable(allFiles ?? []); }
            else { setAllFetchedFilesStateStable([]); }
            setPrimaryHighlightPathState(primaryHighlight);
            setSecondaryHighlightPathsStateInternal(secondaryHighlights ?? { component: [], context: [], hook: [], lib: [], other: [] });
        
            let finalFetchStatusDeterminedByFetch: FetchStatus = fetched ? 'success' : 'error';
            let questResult: Awaited<ReturnType<typeof updateUserCyberFitnessProfile>> | null = null;
        
            try {
                const activeVisualTask = currentImgTask || currentIconTask;
                const isVisualSwapFlow = !!activeVisualTask;
        
                if (isVisualSwapFlow && activeVisualTask) {
                    const taskToProcess = activeVisualTask;
                    const taskType = currentImgTask ? 'ImageSwap' : 'IconSwap';
        
                    if (fetched) { // If initial files were fetched successfully for the visual task
                        const targetFileExists = (allFiles ?? []).some(f => f.path === taskToProcess.targetPath);
                        if (!targetFileExists) {
                            finalFetchStatusDeterminedByFetch = 'error'; // Still an error for this specific flow
                            addToastStable(`Ошибка Задачи ${taskType === 'ImageSwap' ? 'Изображения' : 'Иконки'}: Целевой файл ${taskToProcess.targetPath} не найден!`, 'error', 5000);
                            setAssistantLoadingStateStable(false); // Ensure loading state is reset
                        } else {
                            // File needed for visual task exists, proceed with assistant
                            if (assistantRef.current?.handleDirectImageReplace) {
                                setAssistantLoadingStateStable(true);
                                const replaceResult = await assistantRef.current.handleDirectImageReplace(taskToProcess, allFiles ?? []);
                                if (!replaceResult.success) {
                                    addToastStable(`Ошибка замены/PR (${taskType}): ${replaceResult.error || 'Неизвестно'}`, 'error');
                                } else if (dbUser?.user_id) {
                                    questResult = await updateUserCyberFitnessProfile(dbUser.user_id, { completedQuests: ['first_fetch_completed'] });
                                }
                            } else {
                                addToastStable(`КРИТИЧЕСКАЯ ПРОБЛЕМА: Не удалось вызвать замену (${taskType}).`, 'error', 7000);
                            }
                            // Reset task states after attempt, regardless of success
                            if (taskType === 'ImageSwap') setImageReplaceTaskStateStable(null);
                            if (taskType === 'IconSwap') setIconReplaceTaskStateStable(null);
                            setAssistantLoadingStateStable(false);
                            logger.info(`${flowLogPrefix} Context: ${taskType} task processing finished and cleared.`);
                        }
                    } else { // Initial file fetch failed for the visual task flow
                        // finalFetchStatusDeterminedByFetch is already 'error'
                        addToastStable(`Ошибка Задачи ${taskType === 'ImageSwap' ? 'Изображения' : 'Иконки'}: Не удалось загрузить файлы.`, 'error', 5000);
                        setAssistantLoadingStateStable(false);
                    }
                    if (currentPendingFlow?.type === 'ImageSwap' && currentImgTask) { setPendingFlowDetailsStateStable(null); } 
                    if (currentPendingFlow?.type === 'IconSwap' && currentIconTask) { setPendingFlowDetailsStateStable(null); }
        
                } else if (currentPendingFlow?.type === 'ErrorFix' && fetched) {
                    const targetFileExists = allFiles.some(f => f.path === currentPendingFlow.targetPath);
                    if (targetFileExists) {
                        const { Message, Stack, Logs, Source } = currentPendingFlow.details;
                        const prompt = `Fix error in ${currentPendingFlow.targetPath}:\n\nMessage: ${Message}\nSource: ${Source || 'N/A'}\n\nStack:\n\`\`\`\n${Stack || 'N/A'}\n\`\`\`\n\nLogs:\n${Logs || 'N/A'}\n\nProvide ONLY the corrected code block or full file content.`;
                        setKworkInputValueStateStable(prompt);
                        if (fetcherRef?.current?.handleAddSelected) {
                            setTimeout(async () => {
                                try {
                                    fetcherRef.current?.handleAddSelected?.(new Set([currentPendingFlow.targetPath]), allFiles);
                                    if (dbUser?.user_id) {
                                        questResult = await updateUserCyberFitnessProfile(dbUser.user_id, { completedQuests: ['first_fetch_completed'] });
                                    }
                                    scrollToSectionStable('executor');
                                } catch (addErr) { logger.error(`${flowLogPrefix} Context: Error calling handleAddSelected for ErrorFix:`, addErr); }
                            }, 100);
                        } else { scrollToSectionStable('executor'); }
                    } else {
                        addToastStable(`Ошибка Исправления: Целевой файл ${currentPendingFlow.targetPath} не найден!`, 'error', 5000);
                        finalFetchStatusDeterminedByFetch = 'error'; // This specific flow step failed
                    }
                    setPendingFlowDetailsStateStable(null);
        
                } else { // Generic fetch or unhandled flow
                    if (fetched && currentPendingFlow) setPendingFlowDetailsStateStable(null);
                    if (fetched && !currentImgTask && !currentIconTask && !currentPendingFlow && dbUser?.user_id) {
                        questResult = await updateUserCyberFitnessProfile(dbUser.user_id, { completedQuests: ['first_fetch_completed'] });
                    }
                }
        
                // Process questResult toast logic safely, after main async operations
                if (questResult) {
                    // Access CYBERFIT_METADATA_KEY safely here as it's imported
                    const updatedProfileLevel = questResult.data?.metadata?.[CYBERFIT_METADATA_KEY]?.level; 
                    const firstFetchAchDef = ALL_ACHIEVEMENTS.find(a => a.id === 'first_fetch_completed');
                    const kvAwardedForQuest = firstFetchAchDef?.kiloVibesAward || 0;
        
                    if (questResult.success && updatedProfileLevel === 1 && kvAwardedForQuest > 0) {
                        addToastStable(`🚀 Квест '${firstFetchAchDef?.name || 'Первая Загрузка'}' выполнен! Level 1 достигнут! +${kvAwardedForQuest} KiloVibes!`, "success", 4000);
                    } else if (questResult.success && kvAwardedForQuest > 0) {
                        addToastStable(`🚀 Квест '${firstFetchAchDef?.name || 'Первая Загрузка'}' выполнен! +${kvAwardedForQuest} KiloVibes!`, "success", 4000);
                    } else if (questResult.success) {
                        addToastStable(`🚀 Квест '${firstFetchAchDef?.name || 'Первая Загрузка'}' выполнен!`, "success", 4000);
                    } else if (!questResult.success) {
                        addToastStable(`Предупреждение: Ошибка обновления CyberFitness профиля после извлечения файлов: ${questResult.error}`, "warning", 5000);
                        logger.error(`${flowLogPrefix} CyberFitness update failed after successful fetch: ${questResult.error}`);
                    }
                    questResult.newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                }
        
            } catch (error: any) { // Catch errors from the async block
                logger.error(`${flowLogPrefix} Context: CRITICAL ERROR in handleSetFilesFetchedStable's async logic:`, error);
                addToastStable(`Критическая ошибка при обработке файлов: ${error.message || "Проверьте консоль."}`, "error", 7000);
                finalFetchStatusDeterminedByFetch = 'error'; // Ensure status reflects the critical error
            } finally {
                // This will always run, ensuring the UI reflects the *initial file fetch* status
                setFetchStatusStateStable(finalFetchStatusDeterminedByFetch);
                logger.info(`${flowLogPrefix} Context: handleSetFilesFetchedStable finished. Final UI fetchStatus set to: ${finalFetchStatusDeterminedByFetch}`);
            }
        }, [ 
             dbUser?.user_id, addToastStable, assistantRef, fetcherRef, setFetchStatusStateStable, setAllFetchedFilesStateStable,
             setImageReplaceTaskStateStable, setIconReplaceTaskStateStable, 
             setAssistantLoadingStateStable, setPendingFlowDetailsStateStable,
             setKworkInputValueStateStable, scrollToSectionStable, logger, setSecondaryHighlightPathsStateInternal
         ]);

        const triggerToggleSettingsModal = useCallback(async () => {
            if (dbUser?.user_id) { 
                const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'settings_opened');
                newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
            }
            setIsSettingsModalOpenState(prev => !prev);
        }, [dbUser?.user_id, addToastStable]);

        const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => { 
            const activeTask = imageReplaceTaskStateRef.current || iconReplaceTaskStateRef.current;
            if (fetcherRef.current?.handleFetch) { 
                try { 
                    await fetcherRef.current.handleFetch(isRetry, branch, activeTask); 
                } catch (e: any) { 
                    addToastStable(`Крит. ошибка запуска извлечения: ${e?.message ?? 'Неизвестно'}`, "error", 5000); 
                    setFetchStatusStateStable('error'); 
                } 
            } else { 
                addToastStable("Ошибка: Не удалось запустить извлечение (ref).", "error"); 
            } 
        }, [addToastStable, setFetchStatusStateStable, fetcherRef]);
        
        const triggerPreCheckAndFetch = useCallback(async ( repoUrlToCheck: string, potentialBranchNameProvided: string, flowType: PendingFlowDetails['type'], flowDetails: any, targetPath: string ) => {
            const flowLogPrefix = `[Flow - ${flowType}]`;
            logger.log(`${flowLogPrefix} Context: triggerPreCheckAndFetch. URL: ${repoUrlToCheck}, PotentialBranch: ${potentialBranchNameProvided}, Target: ${targetPath}, Details:`, flowDetails);
            setIsPreCheckingStateStable(true); 
            
            if (flowType === 'ImageSwap') {
                if (!flowDetails?.oldUrl || !flowDetails?.newUrl) {
                    logger.error(`${flowLogPrefix} Context: Missing oldUrl or newUrl for ImageSwap. Aborting.`);
                    addToastStable("Ошибка: Недостаточно данных для замены изображения (oldUrl/newUrl).", 'error', 5000);
                    setIsPreCheckingStateStable(false); setFetchStatusStateStable('error'); return;
                }
                setImageReplaceTaskStateStable({ targetPath, oldUrl: flowDetails.oldUrl, newUrl: flowDetails.newUrl });
                setIconReplaceTaskStateStable(null); 
                setPendingFlowDetailsStateStable(null);
                logger.log(`${flowLogPrefix} Context: imageReplaceTaskState set. Cleared icon/pending details.`);
            } else if (flowType === 'IconSwap') {
                if (!flowDetails?.oldIconName || !flowDetails?.newIconName) {
                    logger.error(`${flowLogPrefix} Context: Missing oldIconName or newIconName for IconSwap. Aborting.`);
                    addToastStable("Ошибка: Недостаточно данных для замены иконки (oldIconName/newIconName).", 'error', 5000);
                    setIsPreCheckingStateStable(false); setFetchStatusStateStable('error'); return;
                }
                setIconReplaceTaskStateStable({ targetPath, oldIconName: flowDetails.oldIconName, newIconName: flowDetails.newIconName, componentProps: flowDetails.componentProps });
                setImageReplaceTaskStateStable(null); 
                setPendingFlowDetailsStateStable(null);
                logger.log(`${flowLogPrefix} Context: iconReplaceTaskState set. Cleared image/pending details.`);
            } else if (flowType === 'ErrorFix') {
                setPendingFlowDetailsStateStable({ type: flowType, details: flowDetails, targetPath });
                setImageReplaceTaskStateStable(null); 
                setIconReplaceTaskStateStable(null);
                logger.log(`${flowLogPrefix} Context: pendingFlowDetailsState set for ErrorFix. Cleared visual tasks.`);
            } else { 
                setPendingFlowDetailsStateStable(null); setImageReplaceTaskStateStable(null); setIconReplaceTaskStateStable(null);
                logger.log(`${flowLogPrefix} Context: Unknown or generic flow type. Clearing all specific task details.`);
            }
            
            setTargetPrDataStable(null); 
            setTargetBranchNameStateStable(null); 
            setManualBranchNameStateStable(''); 

            if (dbUser?.user_id) { 
                const questResult = await updateUserCyberFitnessProfile(dbUser.user_id, { completedQuests: ['initial_boot_sequence'] }); 
                if (questResult.success) {
                    const initialBootAchDef = ALL_ACHIEVEMENTS.find(a => a.id === 'initial_boot_sequence');
                    const kvAwarded = initialBootAchDef?.kiloVibesAward || 0;
                    if (kvAwarded > 0) addToastStable(`🛰️ Квест '${initialBootAchDef?.name || 'Пойман Сигнал'}': +${kvAwarded} KiloVibes!`, "success", 3000);
                    else addToastStable(`🛰️ Квест '${initialBootAchDef?.name || 'Пойман Сигнал'}' выполнен!`, "success", 3000);
                }
                questResult.newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
            }

            let branchToFetch: string | null = null;
            let branchNameToSeek = potentialBranchNameProvided;

            if (flowType === 'ImageSwap' || flowType === 'IconSwap') { 
                logger.log(`${flowLogPrefix} Context: Visual Swap flow. Always fetching from default branch (null).`);
                branchToFetch = null; 
            } 
            else if (branchNameToSeek) { 
                try { 
                    const checkResult = await checkExistingPrBranch(repoUrlToCheck, branchNameToSeek);
                    if (checkResult.success && checkResult.data?.exists && checkResult.data?.branchName) {
                        const prSourceBranch = checkResult.data.branchName; 
                        setTargetBranchNameStateStable(prSourceBranch); 
                        setTargetPrDataStable({ number: checkResult.data.prNumber!, url: checkResult.data.prUrl! }); 
                        branchToFetch = prSourceBranch;
                         logger.log(`${flowLogPrefix} Context: Found existing PR/branch: ${prSourceBranch}. PR #${checkResult.data.prNumber}. Will fetch from this branch.`);
                    } else if (checkResult.success) {
                        logger.log(`${flowLogPrefix} Context: No existing PR/branch found for "${branchNameToSeek}". Will use default branch for initial fetch.`);
                        branchToFetch = null; 
                    } else {
                         addToastStable(`Не удалось проверить PR для ${branchNameToSeek}. Используется ветка по умолчанию.`, 'warning');
                         logger.warn(`${flowLogPrefix} Context: checkExistingPrBranch failed for "${branchNameToSeek}". Error: ${checkResult.error}`);
                         branchToFetch = null; 
                    }
                } catch (err: any) {
                    addToastStable(`Критическая ошибка проверки PR: ${err.message}`, 'error');
                    logger.error(`${flowLogPrefix} Context: Exception in checkExistingPrBranch for "${branchNameToSeek}":`, err);
                    branchToFetch = null; 
                }
            } else { 
                 logger.log(`${flowLogPrefix} Context: No specific branch name to seek. Will fetch from default branch.`);
                 branchToFetch = null;
            }
            
            setIsPreCheckingStateStable(false);
            logger.log(`${flowLogPrefix} Context: Proceeding to triggerFetch with branch: ${branchToFetch}`);
            await triggerFetch(false, branchToFetch); 
        }, [ 
            dbUser?.user_id, addToastStable, setTargetBranchNameStateStable, setTargetPrDataStable, 
            setIsPreCheckingStateStable, setPendingFlowDetailsStateStable, setImageReplaceTaskStateStable, setIconReplaceTaskStateStable,
            setManualBranchNameStateStable, setFetchStatusStateStable, triggerFetch, logger 
        ]);
        
        const triggerSelectHighlighted = useCallback(async () => {
            logger.log(`[DEBUG][CONTEXT] triggerSelectHighlighted called. Ref ready: ${!!fetcherRef.current?.selectHighlightedFiles}`);
            if (fetcherRef.current?.selectHighlightedFiles) {
                try {
                    fetcherRef.current.selectHighlightedFiles();
                    if (dbUser?.user_id) { 
                        const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedSelectHighlighted');
                        newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                    }
                } catch (e: any) { logger.error("Error calling fetcherRef.selectHighlightedFiles:", e); addToastStable(`Ошибка выбора связанных файлов: ${e?.message ?? 'Неизвестно'}`, "error"); }
            } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); }
        }, [addToastStable, fetcherRef, dbUser?.user_id, logger]); 

        const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => { const currentSelected = selectedFetcherFilesRef.current; const currentAllFiles = allFetchedFilesRef.current; if (fetcherRef.current?.handleAddSelected) { if (currentSelected.size === 0) { addToastStable("Сначала выберите файлы в Экстракторе!", "warning"); return; } try { await fetcherRef.current.handleAddSelected(currentSelected, currentAllFiles); if (clearSelection) { setSelectedFetcherFilesStateStable(new Set()); } } catch (e: any) { addToastStable(`Ошибка добавления файлов: ${e?.message ?? 'Неизвестно'}`, "error"); } } else { addToastStable("Ошибка: Компонент Экстрактора недоступен.", "error"); } }, [addToastStable, setSelectedFetcherFilesStateStable, fetcherRef]);
        const selectedFetcherFilesRef = useRef(selectedFetcherFilesState); useEffect(() => { selectedFetcherFilesRef.current = selectedFetcherFilesState; }, [selectedFetcherFilesState]);
        const allFetchedFilesRef = useRef(allFetchedFilesState); useEffect(() => { allFetchedFilesRef.current = allFetchedFilesState; }, [allFetchedFilesState]);
        
        const triggerCopyKwork = useCallback(async (): Promise<void> => {
            // This function is called when the "Copy System Prompt" button is clicked.
            // Its only responsibility now is to log the CyberFitness achievement.
            // The actual copying of the system prompt happens in RequestInput.tsx.
            // The copying of the main kwork input happens via useKworkInput.handleCopyToClipboard.
            if (dbUser?.user_id) {
                logger.debug("[RepoXmlPageContext triggerCopyKwork] Attempting to log 'system_prompt_copied' achievement.");
                const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'system_prompt_copied');
                newAchievements?.forEach(ach => {
                    addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                    logger.info(`[RepoXmlPageContext triggerCopyKwork] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
                });
            } else {
                logger.warn("[RepoXmlPageContext triggerCopyKwork] Cannot log 'system_prompt_copied': dbUser.user_id is missing.");
            }
        }, [dbUser, addToastStable, logger]); // Updated dependencies

        const triggerAskAi = useCallback(async () => { addToastStable("Скопируйте запрос и вставьте в AI.", "info"); return { success: false, error: "Ask AI button disabled" }; }, [addToastStable]);
        
        const triggerParseResponse = useCallback(async () => { 
            if (assistantRef.current?.handleParse) { 
                try { 
                    await assistantRef.current.handleParse(); 
                    if (dbUser?.user_id) { 
                         const questResult = await updateUserCyberFitnessProfile(dbUser.user_id, { completedQuests: ['first_parse_completed'] }); 
                         if (questResult.success) {
                             const parseAchDef = ALL_ACHIEVEMENTS.find(a => a.id === 'first_parse_completed');
                             const kvAwarded = parseAchDef?.kiloVibesAward || 0;
                             const updatedProfileLevel = questResult.data?.metadata?.[CYBERFIT_METADATA_KEY]?.level;
                             if (updatedProfileLevel === 2 && kvAwarded > 0) { 
                                 addToastStable(`🚀 Квест '${parseAchDef?.name || 'Первый Парсинг'}' выполнен! Level 2 достигнут! +${kvAwarded} KiloVibes!`, "success", 4000);
                             } else if (kvAwarded > 0) {
                                 addToastStable(`🚀 Квест '${parseAchDef?.name || 'Первый Парсинг'}' выполнен! +${kvAwarded} KiloVibes!`, "success", 4000);
                             } else {
                                addToastStable(`🚀 Квест '${parseAchDef?.name || 'Первый Парсинг'}' выполнен!`, "success", 4000);
                             }
                         }
                         questResult.newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                    }
                } catch (e: any) { 
                    addToastStable(`Крит. ошибка разбора ответа: ${e?.message ?? 'Неизвестно'}`, "error", 5000); 
                } 
            } else { 
                addToastStable("Ошибка разбора: Компонент Ассистента недоступен.", "error");
            } 
        }, [addToastStable, assistantRef, dbUser?.user_id]);
        
        const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current?.selectAllParsedFiles) { try { assistantRef.current.selectAllParsedFiles(); } catch (e: any) { addToastStable(`Ошибка выбора всех файлов: ${e?.message ?? 'Неизвестно'}`, "error"); } } else { addToastStable("Ошибка выбора: Компонент Ассистента недоступен.", "error");} }, [addToastStable, assistantRef]);
        
        const triggerCreateOrUpdatePR = useCallback(async () => { 
            if (assistantRef.current?.handleCreatePR) { 
                try { 
                    await assistantRef.current.handleCreatePR(); 
                } catch (e: any) { 
                    addToastStable(`Крит. ошибка создания/обновления PR: ${e?.message ?? 'Неизвестно'}`, "error", 5000); 
                } 
            } else { 
                addToastStable("Ошибка PR: Компонент Ассистента недоступен.", "error");
            } 
        }, [addToastStable, assistantRef]);
        
        const triggerGetOpenPRsStable = useCallback(async (url: string) => { const effectiveUrl = url || repoUrlStateRef.current; if (!effectiveUrl || !effectiveUrl.includes('github.com')) { setOpenPrsStateStable([]); setLoadingPrsStateStable(false); return; } setLoadingPrsStateStable(true); try { const result = await getOpenPullRequests(effectiveUrl); if (result.success && result.pullRequests) { setOpenPrsStateStable(result.pullRequests as SimplePullRequest[]); } else { addToastStable("Ошибка загрузки PR: " + (result.error ?? 'Неизвестно'), "error"); setOpenPrsStateStable([]); } } catch (e: any) { addToastStable(`Крит. ошибка загрузки PR: ${e?.message ?? 'Неизвестно'}`, "error", 5000); setOpenPrsStateStable([]); } finally { setLoadingPrsStateStable(false); } }, [addToastStable, setLoadingPrsStateStable, setOpenPrsStateStable]);
        
        const triggerUpdateBranchStable = useCallback(async ( repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => { 
            setAssistantLoadingStateStable(true); 
            let combinedAchievements: Achievement[] = [];
            try { 
                const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription); 
                if (result.success) { 
                    triggerGetOpenPRsStable(repoUrlParam).catch(err => logger.error("Failed to refresh PRs after branch update:", err));
                    if (dbUser?.user_id) {
                        const { newAchievements: actionAch } = await logCyberFitnessAction(dbUser.user_id, 'branchUpdated', 1);
                        if(actionAch) combinedAchievements.push(...actionAch);
                        
                        if (prNumber) {
                            logger.info(`[CyberFitness] Logged 'branchUpdated' for update to PR #${prNumber}'s branch '${branch}'. User: ${dbUser.user_id}`);
                        } else {
                            logger.info(`[CyberFitness] Logged 'branchUpdated' for update to branch '${branch}' (no specific PR number provided to this function). User: ${dbUser.user_id}`);
                        }
                    }
                    return { success: true, newAchievements: combinedAchievements }; 
                } else { 
                    addToastStable(`Ошибка обновления ветки: ${result.error}`, 'error', 5000); 
                    return { success: false, error: result.error, newAchievements: combinedAchievements }; 
                } 
            } catch (e: any) { 
                addToastStable(`Крит. ошибка обновления ветки: ${e.message}`, "error", 5000); 
                return { success: false, error: e.message, newAchievements: combinedAchievements }; 
            } finally { 
                setAssistantLoadingStateStable(false); 
            } 
        }, [addToastStable, triggerGetOpenPRsStable, setAssistantLoadingStateStable, dbUser?.user_id, logger]);

        const triggerCreateNewPRStable = useCallback(async (
            repoUrlParam: string, 
            filesToCommit: FileNode[], 
            prTitleParam: string, 
            prDescriptionParam: string, 
            commitMessageParam: string, 
            newBranchNameParam: string
        ): Promise<{ success: boolean; error?: string; prUrl?: string; prNumber?: number; branch?: string; newAchievements?: Achievement[] }> => {
            setAssistantLoadingStateStable(true);
            let combinedAchievements: Achievement[] = [];
            try {
                logger.info(`[Context triggerCreateNewPRStable] Called for repo: ${repoUrlParam}, branch: ${newBranchNameParam}`);
                const result = await createGitHubPullRequest(
                    repoUrlParam,
                    filesToCommit,
                    prTitleParam,
                    prDescriptionParam,
                    commitMessageParam,
                    newBranchNameParam
                );
    
                if (result.success && result.prNumber) { 
                    triggerGetOpenPRsStable(repoUrlParam).catch(err => logger.error("Failed to refresh PRs after new PR creation:", err));
                    if (dbUser?.user_id) { 
                        const { newAchievements: actionAch } = await logCyberFitnessAction(dbUser.user_id, 'prCreated', 1);
                        if(actionAch) combinedAchievements.push(...actionAch);
                        logger.info(`[CyberFitness] Logged 'prCreated' for PR #${result.prNumber}. User: ${dbUser.user_id}`);
                        
                        const questResult = await updateUserCyberFitnessProfile(dbUser.user_id, { completedQuests: ['first_pr_created'] }); 
                        if(questResult.success) {
                            const prAchDef = ALL_ACHIEVEMENTS.find(a => a.id === 'first_pr_created');
                            const kvAwarded = prAchDef?.kiloVibesAward || 0;
                             const updatedProfileLevel = questResult.data?.metadata?.[CYBERFIT_METADATA_KEY]?.level;
                            if (updatedProfileLevel === 3 && kvAwarded > 0) { 
                                addToastStable(`🚀 Квест '${prAchDef?.name || 'Первый PR'}' выполнен! Level 3 достигнут! +${kvAwarded} KiloVibes!`, "success", 4000);
                            } else if (kvAwarded > 0) {
                                 addToastStable(`🚀 Квест '${prAchDef?.name || 'Первый PR'}' выполнен! +${kvAwarded} KiloVibes!`, "success", 4000);
                            } else {
                                addToastStable(`🚀 Квест '${prAchDef?.name || 'Первый PR'}' выполнен!`, "success", 4000);
                            }
                        }
                        if(questResult.newAchievements) combinedAchievements.push(...questResult.newAchievements);
                    }
                    return { ...result, newAchievements: combinedAchievements };
                } else {
                    addToastStable(`Ошибка создания PR: ${result.error}`, 'error', 5000);
                    return { ...result, newAchievements: combinedAchievements };
                }
            } catch (e: any) {
                addToastStable(`Крит. ошибка создания PR: ${e.message}`, "error", 5000);
                return { success: false, error: e.message, newAchievements: combinedAchievements };
            } finally {
                setAssistantLoadingStateStable(false);
            }
        }, [addToastStable, triggerGetOpenPRsStable, setAssistantLoadingStateStable, dbUser?.user_id, logger]);

        const updateRepoUrlInAssistantStable = useCallback((url: string) => { if (assistantRef.current?.updateRepoUrl) { try { assistantRef.current.updateRepoUrl(url); } catch (e: any) { logger.error(`Error calling assistantRef.updateRepoUrl: ${e?.message ?? 'Неизвестно'}`); } } }, [assistantRef]);
        
        const triggerAddImportantToKworkStable = useCallback(async () => {
            if (fetcherRef.current?.handleAddImportantFiles) {
                fetcherRef.current.handleAddImportantFiles();
                 if (dbUser?.user_id) { 
                    const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedSelectHighlighted'); 
                    newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                 }
            }
        }, [fetcherRef, dbUser?.user_id, addToastStable]);
        
        const triggerAddTreeToKworkStable = useCallback(async () => {
             if (fetcherRef.current?.handleAddFullTree) {
                 fetcherRef.current.handleAddFullTree();
                 if (dbUser?.user_id) { 
                    const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedAddFullTree');
                    newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                 }
             }
        }, [fetcherRef, dbUser?.user_id, addToastStable]);

        const triggerSelectAllFetcherFilesStable = useCallback(() => { fetcherRef.current?.selectAllFiles?.(); }, [fetcherRef]);
        const triggerDeselectAllFetcherFilesStable = useCallback(() => { fetcherRef.current?.deselectAllFiles?.(); }, [fetcherRef]);
        
        const triggerClearKworkInputStable = useCallback(async () => {
            if (fetcherRef.current?.clearAll) {
                fetcherRef.current.clearAll();
                if (dbUser?.user_id) { 
                    const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'kwork_cleared');
                    newAchievements?.forEach(ach => addToastStable(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                }
            }
        }, [fetcherRef, dbUser?.user_id, addToastStable]);

        const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
        useEffect(() => {
            let calculatedStep: WorkflowStep = 'idle';
            if (isPreCheckingState) { calculatedStep = 'fetching'; } 
            else if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') { calculatedStep = 'fetching'; }
            else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') { calculatedStep = 'fetch_failed'; }
            else if (filesFetchedState) {
                if (imageReplaceTaskState || iconReplaceTaskState) { 
                    const activeVisualTask = imageReplaceTaskState || iconReplaceTaskState;
                    const targetFileExists = activeVisualTask && allFetchedFilesState.some(f => f.path === activeVisualTask.targetPath);
                    if (targetFileExists) {
                        calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace'; 
                    } else {
                        calculatedStep = 'fetch_failed'; 
                    }
                } else { 
                    if (isParsingState) calculatedStep = 'parsing_response';
                    else if (assistantLoadingState || aiActionLoadingState) calculatedStep = 'generating_ai_response';
                    else if (aiResponseHasContentState) { calculatedStep = filesParsedState ? 'pr_ready' : 'response_pasted'; }
                    else if (kworkInputHasContentState) { calculatedStep = requestCopiedState ? 'request_copied' : 'request_written'; }
                    else if (selectedFetcherFilesState.size > 0) { calculatedStep = 'files_selected'; }
                    else if (primaryHighlightPathState || Object.values(secondaryHighlightPathsStateInternal).some(arr => arr.length > 0)) { calculatedStep = 'files_fetched_highlights'; }
                    else { calculatedStep = 'files_fetched'; }
                }
            }
            else { calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle'; }
            
            setCurrentStep(prevStep => { if (prevStep !== calculatedStep) { logger.log(`[WorkflowStep Change] From ${prevStep} to ${calculatedStep}`); return calculatedStep; } return prevStep; });
        }, [ 
            fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, 
            filesParsedState, requestCopiedState, primaryHighlightPathState, 
            secondaryHighlightPathsStateInternal, 
            selectedFetcherFilesState, aiActionLoadingState, isParsingState, 
            imageReplaceTaskState, iconReplaceTaskState, 
            allFetchedFilesState, assistantLoadingState, repoUrlEnteredState, isPreCheckingState, logger 
        ]);

         const getXuinityMessageStable = useCallback((): string => {
             const localCurrentStep = currentStep; 
             const localManualBranchName = manualBranchNameState; 
             const localTargetBranchName = targetBranchNameState; 
             const localImageReplaceTask = imageReplaceTaskState;
             const localIconReplaceTask = iconReplaceTaskState; 
             const localFetchStatus = fetchStatusState; 
             const localAllFilesLength = allFetchedFilesState.length; 
             const localSelectedFetchSize = selectedFetcherFilesState.size; 
             const localSelectedAssistSize = selectedAssistantFilesState.size; 
             const localIsPreChecking = isPreCheckingState; 
             const localPendingFlowDetails = pendingFlowDetailsState; 
             const localFilesFetched = filesFetchedState; 
             const localAssistantLoading = assistantLoadingState; 
             
             const effectiveBranch = localManualBranchName.trim() || localTargetBranchName || 'default';
             const activeVisualTask = localImageReplaceTask || localIconReplaceTask;
             const visualTaskType = localImageReplaceTask ? 'картинки' : (localIconReplaceTask ? 'иконки' : '');

             if (localIsPreChecking && localPendingFlowDetails) return `Проверяю наличие PR/ветки для '${localPendingFlowDetails.targetPath.split('/').pop() ?? 'файла'}'...`;
              if (localIsPreChecking && activeVisualTask) return `Проверяю наличие PR/ветки для замены ${visualTaskType} '${activeVisualTask.targetPath.split('/').pop() ?? 'файла'}'...`;
             
             if (activeVisualTask) {
                 if (localFetchStatus === 'loading' || localFetchStatus === 'retrying') return `Гружу файл ${activeVisualTask.targetPath.split('/').pop()} из ветки ${effectiveBranch} для замены ${visualTaskType}...`;
                 if (localFetchStatus === 'error' || localFetchStatus === 'failed_retries') return `Твою ж! Ошибка загрузки файла для ${visualTaskType}. URL/ветка верные? Жми 'Попробовать Снова'.`;
                 const targetFileExists = allFetchedFilesState?.some(f => f.path === activeVisualTask.targetPath);
                 if (localFetchStatus === 'success' && !targetFileExists && localFilesFetched) return `Файл для замены ${visualTaskType} НЕ НАЙДЕН в репе! Проверь путь/ветку!`;
                 if (localFetchStatus === 'success' && targetFileExists) { if (localAssistantLoading) return `Меняю ${visualTaskType} и делаю авто-PR... Магия!`; return `Файл на месте! Ассистент сейчас сам всё заменит и запушит PR. Level 1 пройден! (${visualTaskType})`; }
                 return `Готовлю авто-замену ${visualTaskType} (Level 1)...`;
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
                 default: return "Вайб неопределен... Что будем делать?";
             }
          }, [ 
              currentStep, manualBranchNameState, targetBranchNameState, 
              imageReplaceTaskState, iconReplaceTaskState, 
              fetchStatusState, allFetchedFilesState, filesFetchedState, assistantLoadingState, 
              selectedFetcherFilesState.size, selectedAssistantFilesState.size, 
              isPreCheckingState, pendingFlowDetailsState 
            ]);

        const contextValue = useMemo((): RepoXmlPageContextType => ({
            fetchStatus: fetchStatusState, repoUrlEntered: repoUrlEnteredState, filesFetched: filesFetchedState, kworkInputHasContent: kworkInputHasContentState, requestCopied: requestCopiedState, aiResponseHasContent: aiResponseHasContentState, filesParsed: filesParsedState, assistantLoading: assistantLoadingState, aiActionLoading: aiActionLoadingState, loadingPrs: loadingPrsState, isSettingsModalOpen: isSettingsModalOpenState, isParsing: isParsingState, isPreChecking: isPreCheckingState, showComponents: showComponentsState, selectedFetcherFiles: selectedFetcherFilesState, selectedAssistantFiles: selectedAssistantFilesState, targetBranchName: targetBranchNameState, manualBranchName: manualBranchNameState, openPrs: openPrsState, currentAiRequestId: currentAiRequestIdState, imageReplaceTask: imageReplaceTaskState, iconReplaceTask: iconReplaceTaskState, allFetchedFiles: allFetchedFilesState, currentStep, repoUrl: repoUrlState, primaryHighlightedPath: primaryHighlightPathState, 
            secondaryHighlightedPaths: secondaryHighlightPathsStateInternal, 
            targetPrData: targetPrDataState, pendingFlowDetails: pendingFlowDetailsState, kworkInputValue: kworkInputValueState,
            setFetchStatus: setFetchStatusStateStable, setRepoUrlEntered: setRepoUrlEnteredStateStable, handleSetFilesFetched: handleSetFilesFetchedStable, setSelectedFetcherFiles: setSelectedFetcherFilesStateStable, setKworkInputHasContent: setKworkInputHasContentStateStable, setRequestCopied: setRequestCopiedStateStable, setAiResponseHasContent: setAiResponseHasContentStateStable, setFilesParsed: setFilesParsedStateStable, setSelectedAssistantFiles: setSelectedAssistantFilesStateStable, setAssistantLoading: setAssistantLoadingStateStable, setAiActionLoading: setAiActionLoadingStateStable, setLoadingPrs: setLoadingPrsStateStable, setTargetBranchName: setTargetBranchNameStateStable, setManualBranchName: setManualBranchNameStateStable, setOpenPrs: setOpenPrsStateStable, setIsParsing: setIsParsingStateStable, setContextIsParsing: setIsParsingStateStable, setCurrentAiRequestId: setCurrentAiRequestIdStateStable, setImageReplaceTask: setImageReplaceTaskStateStable, setIconReplaceTask: setIconReplaceTaskStateStable, setRepoUrl: setRepoUrlStateStable, setTargetPrData: setTargetPrDataStable, setIsPreChecking: setIsPreCheckingStateStable, setPendingFlowDetails: setPendingFlowDetailsStateStable, setShowComponents: setShowComponentsStateStable, setKworkInputValue: setKworkInputValueStateStable,
            triggerToggleSettingsModal, triggerPreCheckAndFetch, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, 
            triggerCreateOrUpdatePR, 
            triggerUpdateBranch: triggerUpdateBranchStable, 
            triggerCreateNewPR: triggerCreateNewPRStable, 
            triggerGetOpenPRs: triggerGetOpenPRsStable, updateRepoUrlInAssistant: updateRepoUrlInAssistantStable, getXuinityMessage: getXuinityMessageStable, scrollToSection: scrollToSectionStable, triggerAddImportantToKwork: triggerAddImportantToKworkStable, triggerAddTreeToKwork: triggerAddTreeToKworkStable, triggerSelectAllFetcherFiles: triggerSelectAllFetcherFilesStable, triggerDeselectAllFetcherFiles: triggerDeselectAllFetcherFilesStable, triggerClearKworkInput: triggerClearKworkInputStable,
            kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
            addToast: addToastStable,
        }), [
            fetchStatusState, repoUrlEnteredState, filesFetchedState, kworkInputHasContentState, requestCopiedState, aiResponseHasContentState, filesParsedState, assistantLoadingState, aiActionLoadingState, loadingPrsState, isSettingsModalOpenState, isParsingState, isPreCheckingState, showComponentsState, selectedFetcherFilesState, selectedAssistantFilesState, targetBranchNameState, manualBranchNameState, openPrsState, currentAiRequestIdState, imageReplaceTaskState, iconReplaceTaskState, allFetchedFilesState, currentStep, repoUrlState, primaryHighlightPathState, 
            secondaryHighlightPathsStateInternal, 
            targetPrDataState, pendingFlowDetailsState, kworkInputValueState,
            setFetchStatusStateStable, setRepoUrlEnteredStateStable, handleSetFilesFetchedStable, setSelectedFetcherFilesStateStable, setKworkInputHasContentStateStable, setRequestCopiedStateStable, setAiResponseHasContentStateStable, setFilesParsedStateStable, setSelectedAssistantFilesStateStable, setAssistantLoadingStateStable, setAiActionLoadingStateStable, setLoadingPrsStateStable, setTargetBranchNameStateStable, setManualBranchNameStateStable, setOpenPrsStateStable, setIsParsingStateStable, setCurrentAiRequestIdStateStable, setImageReplaceTaskStateStable, setIconReplaceTaskStateStable, setRepoUrlStateStable, setTargetPrDataStable, setIsPreCheckingStateStable, setPendingFlowDetailsStateStable, setShowComponentsStateStable, setKworkInputValueStateStable,
            triggerToggleSettingsModal, triggerPreCheckAndFetch, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, 
            triggerCreateOrUpdatePR, 
            triggerUpdateBranchStable, 
            triggerCreateNewPRStable, 
            triggerGetOpenPRsStable, updateRepoUrlInAssistantStable, getXuinityMessageStable, scrollToSectionStable, triggerAddImportantToKworkStable, triggerAddTreeToKworkStable, triggerSelectAllFetcherFilesStable, triggerDeselectAllFetcherFilesStable, triggerClearKworkInputStable,
            addToastStable, dbUser, // Added dbUser to dependencies of contextValue if triggerCopyKwork needs it
        ]);

        return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );

    } catch (providerError: any) {
        logger.fatal("[RepoXmlPageProvider] CRITICAL INITIALIZATION ERROR:", providerError);
        return <div className="fixed inset-0 flex items-center justify-center bg-red-900 text-white p-4 z-[9999]">Критическая ошибка инициализации провайдера страницы: {providerError.message}</div>;
    }
};

export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (context === undefined) { logger.fatal("useRepoXmlPageContext used outside RepoXmlPageProvider!"); throw new Error("useRepoXmlPageContext must be used within a RepoXmlPageProvider"); }
    if (typeof context.triggerCreateNewPR !== 'function') {
        logger.error("CRITICAL: triggerCreateNewPR is missing from context. Providing a NO-OP fallback.");
        return {
            ...context,
            triggerCreateNewPR: async () => { 
                logger.error("Fallback triggerCreateNewPR called. THIS IS A BUG IN CONTEXT SETUP.");
                return { success: false, error: "Context function triggerCreateNewPR not properly initialized." };
            }
        } as RepoXmlPageContextType;
    }
    return context as RepoXmlPageContextType;
};

export type { FileNode, SimplePullRequest, RepoTxtFetcherRef, AICodeAssistantRef, ImportCategory, FetchStatus, WorkflowStep, ImageReplaceTask, IconReplaceTask, RepoXmlPageContextType, PendingFlowDetails, TargetPrData };