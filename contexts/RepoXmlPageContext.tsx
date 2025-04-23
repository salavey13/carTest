"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAnon } from "@/hooks/supabase"; // Use anon client
import { notifyAdmin } from "@/app/actions"; // Import notifyAdmin from main actions
import { getOpenPullRequests, updateBranch, createGitHubPullRequest } from '@/app/actions_github/actions'; // Import createGitHubPullRequest
import type { AiRequestRecord, AiRequestInsert, AiRequestStatus } from '@/types/ai.types'; // Import types
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { FileNode } from '@/components/RepoTxtFetcher'; // Import FileNode
import { debugLogger as logger } from '@/lib/debugLogger'; // Use debugLogger

// Define Ref Interfaces
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean, branchName?: string | null) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (autoAskAi?: boolean, filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => Promise<void>;
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    clearAll: () => void;
    getKworkInputValue: () => string;
}

// NEW: Image Replace Task Interface
export interface ImageReplaceTask {
    targetPath: string;
    oldUrl: string;
    newUrl: string;
}

export interface AICodeAssistantRef {
    handleParse: () => Promise<void>;
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>; // Combined update/create logic
    setResponseValue: (value: string) => void;
    updateRepoUrl: (url: string) => void;
    handleDirectImageReplace: (task: ImageReplaceTask) => Promise<void>; // NEW METHOD
}

// Fetch status type
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';

// Pull Request Type (Simplified)
export interface SimplePullRequest {
    id: number;
    number: number;
    title: string;
    html_url: string;
    user?: { login?: string };
    head: { ref: string }; // Branch name
    updated_at: string;
}

// Workflow steps
export type WorkflowStep =
  | 'idle'
  | 'need_repo_url'
  | 'ready_to_fetch'
  | 'fetching'
  | 'fetch_failed'
  | 'files_fetched' // General files fetched state
  | 'files_fetched_image_replace' // Specific state when files fetched for image replace task
  | 'files_fetched_highlights'
  | 'files_selected'
  | 'request_written'
  | 'generating_ai_response' // Waiting for AI response via Realtime
  | 'request_copied' // Manual copy path
  | 'response_pasted' // Response received (Realtime or manual paste)
  | 'parsing_response'
  | 'response_parsed'
  | 'pr_ready'; // Can mean ready for PR creation OR update

// Context Type Definition
interface RepoXmlPageContextType {
    // State Flags
    currentStep: WorkflowStep;
    fetchStatus: FetchStatus;
    repoUrlEntered: boolean;
    filesFetched: boolean;
    allFetchedFiles: FileNode[]; // Hold all raw fetched files
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: string[];
    selectedFetcherFiles: Set<string>;
    kworkInputHasContent: boolean;
    requestCopied: boolean;
    aiResponseHasContent: boolean;
    filesParsed: boolean;
    selectedAssistantFiles: Set<string>;
    assistantLoading: boolean;
    aiActionLoading: boolean;
    loadingPrs: boolean;
    openPrs: SimplePullRequest[];
    targetBranchName: string | null;
    manualBranchName: string;
    isSettingsModalOpen: boolean;
    currentAiRequestId: string | null;
    isParsing: boolean;
    imageReplaceTask: ImageReplaceTask | null; // NEW STATE

    // Refs
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    prSectionRef: MutableRefObject<HTMLElement | null>;

    // Updaters
    setFetchStatus: (status: FetchStatus) => void;
    setRepoUrlEntered: (entered: boolean) => void;
    setFilesFetched: (fetched: boolean, allFilesData?: FileNode[], primaryPath?: string | null, secondaryPaths?: string[]) => void;
    setAllFetchedFiles: (files: FileNode[]) => void;
    setSelectedFetcherFiles: (files: Set<string>) => void;
    setKworkInputHasContent: (hasContent: boolean) => void;
    setRequestCopied: (copied: boolean) => void;
    setAiResponseHasContent: (hasContent: boolean) => void;
    setFilesParsed: (parsed: boolean) => void;
    setSelectedAssistantFiles: (files: Set<string>) => void;
    setAssistantLoading: (loading: boolean) => void;
    setAiActionLoading: (loading: boolean) => void;
    setTargetBranchName: (branch: string | null) => void;
    setManualBranchName: (branch: string) => void;
    setOpenPrs: (prs: SimplePullRequest[]) => void;
    setLoadingPrs: (loading: boolean) => void;
    setIsSettingsModalOpen: (isOpen: boolean) => void;
    setCurrentAiRequestId: (id: string | null) => void;
    setIsParsing: (parsing: boolean) => void;
    setImageReplaceTask: (task: ImageReplaceTask | null) => void; // NEW SETTER

    // Action Triggers
    triggerFetch: (isManualRetry?: boolean, branchNameToFetch?: string | null) => Promise<void>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
    triggerCopyKwork: () => void;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreateOrUpdatePR: () => Promise<void>; // Combined logic
    triggerUpdateBranch: (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string, prNumber?: number, prBody?: string) => Promise<ReturnType<typeof updateBranch>>; // Added optional PR params
    triggerToggleSettingsModal: () => void;
    scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger' | 'settings-modal-trigger-assistant') => void;

    // Messages & Callbacks
    getXuinityMessage: () => string;
    updateRepoUrlInAssistant: (url: string) => void;
}

// Context Creation
const RepoXmlPageContext = createContext<RepoXmlPageContextType | undefined>(undefined);

// Hook for using context
export const useRepoXmlPageContext = () => {
    const context = useContext(RepoXmlPageContext);
    if (context === undefined) {
        logger.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.'); // Use logger
        const warn = (name: string): any => () => { logger.warn(`Context stub: ${name} called.`); return Promise.resolve({ success: false, error: 'Context unavailable' }); }; // Use logger
        const warnSync = (name: string): any => () => { logger.warn(`Context stub: ${name} called.`); }; // Use logger
        // Provide a complete stub matching the interface
        return {
            currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, allFetchedFiles: [],
            primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
            kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
            filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false,
            loadingPrs: false, openPrs: [], targetBranchName: null, manualBranchName: "",
            isSettingsModalOpen: false, currentAiRequestId: null, isParsing: false, imageReplaceTask: null,
            fetcherRef: { current: null }, assistantRef: { current: null }, kworkInputRef: { current: null },
            aiResponseInputRef: { current: null }, prSectionRef: { current: null },
            setFetchStatus: warnSync('setFetchStatus'), setRepoUrlEntered: warnSync('setRepoUrlEntered'),
            setFilesFetched: warnSync('setFilesFetched'), setAllFetchedFiles: warnSync('setAllFetchedFiles'),
            setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
            setKworkInputHasContent: warnSync('setKworkInputHasContent'), setRequestCopied: warnSync('setRequestCopied'),
            setAiResponseHasContent: warnSync('setAiResponseHasContent'), setFilesParsed: warnSync('setFilesParsed'),
            setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'), setAssistantLoading: warnSync('setAssistantLoading'),
            setAiActionLoading: warnSync('setAiActionLoading'),
            setTargetBranchName: warnSync('setTargetBranchName'), setManualBranchName: warnSync('setManualBranchName'),
            setOpenPrs: warnSync('setOpenPrs'), setLoadingPrs: warnSync('setLoadingPrs'),
            setIsSettingsModalOpen: warnSync('setIsSettingsModalOpen'),
            setCurrentAiRequestId: warnSync('setCurrentAiRequestId'),
            setIsParsing: warnSync('setIsParsing'),
            setImageReplaceTask: warnSync('setImageReplaceTask'),
            triggerFetch: warn('triggerFetch'), triggerGetOpenPRs: warn('triggerGetOpenPRs'),
            triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
            triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
            triggerAskAi: warn('triggerAskAi'),
            triggerParseResponse: warn('triggerParseResponse'), triggerSelectAllParsed: warnSync('triggerSelectAllParsed'),
            triggerCreateOrUpdatePR: warn('triggerCreateOrUpdatePR'),
            triggerUpdateBranch: warn('triggerUpdateBranch'),
            triggerToggleSettingsModal: warnSync('triggerToggleSettingsModal'),
            scrollToSection: warnSync('scrollToSection'),
            getXuinityMessage: () => "Context unavailable",
            updateRepoUrlInAssistant: warnSync('updateRepoUrlInAssistant'),
        } as RepoXmlPageContextType;
    }
    return context;
};

// Provider Props Interface
interface RepoXmlPageProviderProps {
    children: ReactNode;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    prSectionRef: MutableRefObject<HTMLElement | null>;
}

// Provider Component
export const RepoXmlPageProvider: React.FC<RepoXmlPageProviderProps> = ({
      children, fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef
}) => {
    // State Declarations
    const [fetchStatus, setFetchStatusState] = useState<FetchStatus>('idle');
    const [repoUrlEntered, setRepoUrlEnteredState] = useState(false);
    const [filesFetched, setFilesFetchedState] = useState(false);
    const [allFetchedFiles, setAllFetchedFilesState] = useState<FileNode[]>([]);
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<string[]>([]);
    const [selectedFetcherFiles, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
    const [kworkInputHasContent, setKworkInputHasContentState] = useState(false);
    const [requestCopied, setRequestCopiedState] = useState(false);
    const [aiResponseHasContent, setAiResponseHasContentState] = useState(false);
    const [filesParsed, setFilesParsedState] = useState(false);
    const [selectedAssistantFiles, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());
    const [assistantLoading, setAssistantLoadingState] = useState(false);
    const [aiActionLoading, setAiActionLoadingState] = useState(false);
    const [loadingPrs, setLoadingPrsState] = useState(false);
    const [openPrs, setOpenPrsState] = useState<SimplePullRequest[]>([]);
    const [manualBranchName, setManualBranchNameState] = useState<string>("");
    const [selectedPrBranch, setSelectedPrBranchState] = useState<string | null>(null);
    const [targetBranchName, setTargetBranchNameState] = useState<string | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpenState] = useState(false);
    const [currentAiRequestId, setCurrentAiRequestIdState] = useState<string | null>(null);
    const [isParsing, setIsParsingState] = useState(false);
    const [imageReplaceTask, setImageReplaceTaskState] = useState<ImageReplaceTask | null>(null);

    const { user } = useAppContext();
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

    // Effect to update targetBranchName based on manual input or PR selection
    useEffect(() => {
        const trimmedManual = manualBranchName.trim();
        setTargetBranchNameState(trimmedManual || selectedPrBranch);
    }, [manualBranchName, selectedPrBranch]);

     // Effect: Load Initial AI Request State
    useEffect(() => {
        // ... (Initial AI state loading logic - no changes needed here) ...
        let isMounted = true;
        if (!user?.id) {
            setCurrentAiRequestIdState(null);
            setAiActionLoadingState(false);
            return;
        }
        const fetchInitialAiState = async () => {
            logger.log("[Init Effect] Fetching initial user data for AI state...");
            try {
                const { data: userData, error: userError } = await supabaseAnon
                    .from('users')
                    .select('metadata')
                    .eq('user_id', user.id)
                    .single();

                if (userError && userError.code !== 'PGRST116') {
                    logger.error("[Init Effect] Error fetching user metadata:", userError); return;
                }

                const lastRequestId = userData?.metadata?.last_ai_request_id;
                if (lastRequestId && typeof lastRequestId === 'string') {
                    logger.log(`[Init Effect] Found last AI request ID: ${lastRequestId}`);
                    const { data: reqData, error: reqError } = await supabaseAnon
                        .from('ai_requests')
                        .select('status, response, error_message')
                        .eq('id', lastRequestId)
                        .single();

                    if (reqError) { logger.error(`[Init Effect] Error fetching status for ${lastRequestId}:`, reqError); if (isMounted) setCurrentAiRequestIdState(null); return; }
                    if (!isMounted) return;

                    logger.log(`[Init Effect] Status for ${lastRequestId}: ${reqData.status}`);
                    if (reqData.status === 'pending' || reqData.status === 'processing') {
                        logger.log(`[Init Effect] Last request ${lastRequestId} still ${reqData.status}. Setting state.`);
                        setCurrentAiRequestIdState(lastRequestId); setAiActionLoadingState(true); setAiResponseHasContentState(false);
                        if (assistantRef.current) assistantRef.current.setResponseValue("");
                    } else if (reqData.status === 'completed') {
                        // Check if the current AI response area is already populated
                        const currentAIResponse = aiResponseInputRef.current?.value || "";
                        if (!currentAIResponse && reqData.response) {
                           logger.log(`[Init Effect] Last request ${lastRequestId} completed. Populating empty response area.`);
                            if (assistantRef.current) assistantRef.current.setResponseValue(reqData.response || "");
                            setAiResponseHasContentState(!!reqData.response);
                        } else {
                            logger.log(`[Init Effect] Last request ${lastRequestId} completed, but response area already has content or AI response was empty. No change.`);
                        }
                        setCurrentAiRequestIdState(null); setAiActionLoadingState(false); // Always clear request ID and loading on completion
                    } else {
                        logger.log(`[Init Effect] Last request ${lastRequestId} has status ${reqData.status} or handled. Resetting.`);
                        setCurrentAiRequestIdState(null); setAiActionLoadingState(false);
                    }
                } else {
                    logger.log("[Init Effect] No last AI request ID found.");
                    setCurrentAiRequestIdState(null); setAiActionLoadingState(false);
                }
            } catch (error) {
                logger.error("[Init Effect] Unexpected error:", error); if (isMounted) { setCurrentAiRequestIdState(null); setAiActionLoadingState(false); }
            }
        };
        fetchInitialAiState();
        return () => { isMounted = false; };
    }, [user?.id, assistantRef, aiResponseInputRef]); // Added aiResponseInputRef


    // Derive current workflow step based on state (MODIFIED for Image Replace)
    const getCurrentStep = useCallback((): WorkflowStep => {
        // Loading states take precedence
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading && currentAiRequestId) return 'generating_ai_response';
        if (isParsing) return 'parsing_response';
        // Assistant loading covers PR creation for BOTH flows
        if (assistantLoading) return 'pr_ready'; // Step when PR/Update is actively processing

        // Check progress states
        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';

        // *** >>> CRITICAL CHECK: Prioritize Image Replace Task <<< ***
        // Check for image replace task *immediately* after confirming files are fetched
        // AND assistant is NOT loading (meaning the PR process hasn't started yet)
        if (imageReplaceTask && filesFetched && !assistantLoading) {
            return 'files_fetched_image_replace';
        }

        // --- Now check regular AI flow states ---
        if (aiResponseHasContent) {
            if (!filesParsed) return 'response_pasted';
            // If parsed & files selected, ready for PR (even if assistant isn't loading yet)
            if (selectedAssistantFiles.size > 0) return 'pr_ready';
            return 'response_parsed'; // Parsed, but no files selected yet
        }
        if (requestCopied) return 'request_copied'; // Manual path
        if (kworkInputHasContent) return 'request_written'; // Prompt written
        if (selectedFetcherFiles.size > 0) return 'files_selected'; // Files selected in fetcher
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights'; // Files fetched with highlights
        return 'files_fetched'; // Generic files fetched state (only if NOT image replace)
    }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading, isParsing,
        currentAiRequestId, imageReplaceTask, // Added imageReplaceTask
        primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
    ]);
    const currentStep = getCurrentStep();


    // --- State Updaters (Memoized) ---
    const setFetchStatusCallback = useCallback((status: FetchStatus) => setFetchStatusState(status), []);
    const setRepoUrlEnteredCallback = useCallback((entered: boolean) => setRepoUrlEnteredState(entered), []);

    // MODIFIED: setFilesFetchedCallback triggers image replacement if task exists
    const setFilesFetchedCallback = useCallback((
        fetched: boolean,
        allFilesData: FileNode[] = [],
        primaryPath: string | null = null,
        secondaryPaths: string[] = []
    ) => {
        logger.log(`[Context:setFilesFetched] Called with fetched: ${fetched}, files: ${allFilesData.length}`);
        setFilesFetchedState(fetched);
        setAllFetchedFilesState(allFilesData);
        setPrimaryHighlightedPathState(primaryPath);
        setSecondaryHighlightedPathsState(secondaryPaths);

        if (fetched) {
            // Use a local variable to capture the task state *at the time of fetch completion*
            const currentTask = imageReplaceTask;
            if (currentTask && assistantRef.current) {
                logger.log("[Context:setFilesFetched] Files fetched, triggering direct image replacement for:", currentTask);
                setAssistantLoadingState(true); // Set loading *before* calling

                // Use setTimeout to ensure state updates propagate before calling ref
                setTimeout(() => {
                    // Double-check ref is still valid
                    if (assistantRef.current) {
                        // Pass the captured task object
                        assistantRef.current.handleDirectImageReplace(currentTask)
                            .catch(err => {
                                logger.error("[Context:setFilesFetched] Error triggering/running direct image replacement:", err);
                                toast.error("Ошибка авто-замены картинки.");
                                // Use the setter callback directly here to avoid stale closures
                                setImageReplaceTaskState(null); // Clear task on error
                                setAssistantLoadingState(false); // Reset loading on error
                            });
                        // Note: handleDirectImageReplace is now responsible for clearing the task and loading state on success
                    } else {
                        logger.warn("[Context:setFilesFetched] Assistant ref not ready when trying to trigger replacement within timeout.");
                        toast.error("Ошибка: Компонент ассистента не готов для авто-замены.");
                        setImageReplaceTaskState(null); // Clear task if ref is missing
                        setAssistantLoadingState(false); // Reset loading
                    }
                }, 50); // Short delay
            } else if (currentTask && !assistantRef.current) {
                 logger.error("[Context:setFilesFetched] Image task exists, but Assistant ref is missing!");
                 toast.error("Критическая ошибка: Ассистент не найден для замены картинки.");
                 setImageReplaceTaskState(null); // Clear task
            } else {
                 // Normal fetch success (not image replace)
                 setFetchStatusState('success');
                 logger.log("[Context:setFilesFetched] Standard file fetch successful.");
            }
        } else {
            // Reset logic when un-fetching
            logger.log("[Context:setFilesFetched] Resetting fetcher state.");
            setAllFetchedFilesState([]); // Clear fetched files
            setSelectedFetcherFilesState(new Set());
            setKworkInputHasContentState(false);
            setRequestCopiedState(false);
            setAiResponseHasContentState(false);
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            setAssistantLoadingState(false);
            setIsParsingState(false);
            setCurrentAiRequestIdState(null);
            setImageReplaceTaskState(null); // Also clear task if fetch is reset
            setFetchStatusState('idle'); // Reset status
            if (assistantRef.current) assistantRef.current.setResponseValue("");
            if (kworkInputRef.current) kworkInputRef.current.value = "";
        }
    }, [assistantRef, imageReplaceTask, kworkInputRef]); // Include imageReplaceTask and kworkInputRef

    const setAllFetchedFilesCallback = useCallback((files: FileNode[]) => setAllFetchedFilesState(files), []);
    const setSelectedFetcherFilesCallback = useCallback((files: Set<string>) => setSelectedFetcherFilesState(files), []);
    const setKworkInputHasContentCallback = useCallback((hasContent: boolean) => setKworkInputHasContentState(hasContent), []);
    const setRequestCopiedCallback = useCallback((copied: boolean) => setRequestCopiedState(copied), []);
    const setAiResponseHasContentCallback = useCallback((hasContent: boolean) => {
        setAiResponseHasContentState(hasContent);
        if (!hasContent && !aiActionLoading) {
            setFilesParsedState(false); setSelectedAssistantFilesState(new Set()); setCurrentAiRequestIdState(null);
        }
    }, [aiActionLoading]);
    const setFilesParsedCallback = useCallback((parsed: boolean) => {
        setFilesParsedState(parsed); if (!parsed) setSelectedAssistantFilesState(new Set()); setIsParsingState(false); // Don't reset assistant loading here, PR might still be processing
    }, []);
    const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
    const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);
    const setAiActionLoadingCallback = useCallback((loading: boolean) => setAiActionLoadingState(loading), []);
    const setTargetBranchNameFromPr = useCallback((branch: string | null) => setSelectedPrBranchState(branch), []);
    const setManualBranchNameInput = useCallback((branch: string) => setManualBranchNameState(branch), []);
    const setOpenPrsCallback = useCallback((prs: SimplePullRequest[]) => setOpenPrsState(prs), []);
    const setLoadingPrsCallback = useCallback((loading: boolean) => setLoadingPrsState(loading), []);
    const setIsSettingsModalOpenCallback = useCallback((isOpen: boolean) => setIsSettingsModalOpenState(isOpen), []);
    const setCurrentAiRequestIdCallback = useCallback((id: string | null) => setCurrentAiRequestIdState(id), []);
    const setIsParsingCallback = useCallback((parsing: boolean) => setIsParsingState(parsing), []);
    const setImageReplaceTaskCallback = useCallback((task: ImageReplaceTask | null) => setImageReplaceTaskState(task), []); // NEW Setter

    // --- Action Triggers (Memoized) ---
    const triggerFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
        if (fetcherRef.current) await fetcherRef.current.handleFetch(isManualRetry, branchNameToFetch);
        else logger.warn("triggerFetch: fetcherRef not ready."); // Use logger
    }, [fetcherRef]);

    const triggerGetOpenPRs = useCallback(async (repoUrl: string) => {
        // ... (Get Open PRs logic - no changes needed here) ...
         if (!repoUrl || !repoUrl.includes('github.com')) { toast.error("Укажите валидный URL GitHub репо в настройках."); return; }
         setLoadingPrsState(true); setOpenPrsState([]); setTargetBranchNameFromPr(null); // Clear selected PR branch on new fetch
         // Don't clear manual branch here, let user manage it
         try {
             const result = await getOpenPullRequests(repoUrl);
             if (result.success && result.pullRequests) { setOpenPrsState(result.pullRequests); toast.success(`Загружено ${result.pullRequests.length} открытых PR.`); }
             else { toast.error(`Ошибка загрузки PR: ${result.error || 'Неизвестная ошибка'}`); }
         } catch (error) { toast.error("Критическая ошибка при загрузке PR."); logger.error("triggerGetOpenPRs error:", error); } // Use logger
         finally { setLoadingPrsState(false); }
    }, [setTargetBranchNameFromPr]); // Removed setManualBranchNameInput

    const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger' | 'settings-modal-trigger-assistant') => {
        // ... (Scroll logic - no changes needed here) ...
        let element: HTMLElement | null = null;
        const targetId = (id === 'assistant' || id === 'executor') ? 'executor' : (id === 'fetcher' ? 'extractor' : (id === 'settingsModalTrigger' ? 'settings-modal-trigger-assistant' : id));
        switch (targetId) {
            case 'kworkInput': element = kworkInputRef.current; break;
            case 'aiResponseInput': element = aiResponseInputRef.current; break;
            case 'prSection': element = prSectionRef.current; break;
            case 'extractor': element = document.getElementById('extractor'); break;
            case 'executor': element = document.getElementById('executor'); break;
            case 'settings-modal-trigger-assistant': element = document.getElementById('settings-modal-trigger-assistant'); break;
        }
        if (element) {
            const behavior = 'smooth';
            // Scroll input/textarea into view completely if possible
            if (['kworkInput', 'aiResponseInput'].includes(targetId)) {
                 element.scrollIntoView({ behavior, block: 'center' });
                 // Try focusing after scroll animation might finish
                 setTimeout(() => (element as HTMLTextAreaElement)?.focus(), 350);
            } else if (targetId === 'prSection') {
                 element.scrollIntoView({ behavior, block: 'nearest' });
            } else {
                 // Scroll sections with header offset
                 const headerOffset = 80; // Adjust as needed
                 const elementRect = element.getBoundingClientRect();
                 const elementTop = elementRect.top + window.scrollY;
                 window.scrollTo({ top: elementTop - headerOffset, behavior });
            }
        } else { logger.warn(`scrollToSection: Element with target ID "${targetId}" (mapped from "${id}") not found.`); } // Use logger
    }, [kworkInputRef, aiResponseInputRef, prSectionRef]);

    const triggerSelectHighlighted = useCallback(() => {
        if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles();
        else logger.warn("triggerSelectHighlighted: fetcherRef not ready."); // Use logger
    }, [fetcherRef]);

    const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => {
        if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi, filesToAddParam, allFetchedFiles);
        else logger.warn("triggerAddSelectedToKwork: fetcherRef not ready."); // Use logger
    }, [fetcherRef, allFetchedFiles]);

    const triggerCopyKwork = useCallback(() => {
        if (fetcherRef.current) {
            const copied = fetcherRef.current.handleCopyToClipboard(undefined, true);
            if (copied) {
                 setRequestCopiedState(true);
                 setAiResponseHasContentState(false); // Clear AI response area
                 if (assistantRef.current) assistantRef.current.setResponseValue(""); // Ensure assistant's state is also cleared
                 scrollToSection('aiResponseInput');
            }
        } else { logger.warn("triggerCopyKwork: fetcherRef not ready."); } // Use logger
    }, [fetcherRef, assistantRef, scrollToSection]);

    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        // ... (AI request logic - no changes needed here) ...
        if (!fetcherRef.current || !user?.id ) { const m = !user?.id ? "Пользователь не аутентифицирован." : "Компоненты не готовы."; toast.error(m); return { success: false, error: m }; }
        const kworkValue = fetcherRef.current.getKworkInputValue(); if (!kworkValue.trim()) { toast.error("Запрос для AI пуст. Напишите что-нибудь!"); return { success: false, error: "Prompt empty." }; }
        setAiActionLoadingState(true); setAiResponseHasContentState(false); setCurrentAiRequestIdState(null); if (assistantRef.current) assistantRef.current.setResponseValue(""); toast.info("Отправка запроса AI в очередь..."); scrollToSection('executor');
        try {
            const requestData: AiRequestInsert = { prompt: kworkValue, user_id: String(user.id), status: 'pending' };
            const { data, error: insertError } = await supabaseAnon.from('ai_requests').insert(requestData).select('id').single();
            if (insertError) { throw new Error(`DB Insert Error: ${insertError.message}`); } if (!data?.id) { throw new Error("No Request ID returned after insert."); }
            const newRequestId = data.id; logger.log("AI Request submitted to DB. Monitoring ID:", newRequestId); // Use logger
            const userNameOrId = user.username || user.first_name || String(user.id); const promptExcerpt = kworkValue.substring(0, 300) + (kworkValue.length > 300 ? '...' : ''); const notificationMessage = `🤖 Новый AI Запрос (#${newRequestId.substring(0, 6)}...)\nОт: ${userNameOrId} (${user.id})\nПромпт:\n\`\`\`\n${promptExcerpt}\n\`\`\``;
            notifyAdmin(notificationMessage).catch(err => logger.error("Failed to notify admin:", err)); // Use logger
            toast.success("Запрос поставлен в очередь! Ожидаем ответ AI... 🤖💭"); setCurrentAiRequestIdState(newRequestId);
            return { success: true, requestId: newRequestId };
        } catch (error: any) { toast.error("Критическая ошибка при отправке запроса AI."); logger.error("triggerAskAi error:", error); setAiActionLoadingState(false); setCurrentAiRequestIdState(null); return { success: false, error: error.message ?? "Unknown submit error." }; } // Use logger
    }, [fetcherRef, user, assistantRef, scrollToSection]);

    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current) {
             setIsParsingState(true);
             setAssistantLoadingState(true); // Indicate general assistant activity
             try {
                 await assistantRef.current.handleParse();
                 // Parsing successful, filesParsed state will be updated via its own callback
             } catch (err) {
                 logger.error("Error during parsing:", err); // Use logger
                 toast.error("Ошибка при разборе ответа AI.");
                 setFilesParsedCallback(false); // Explicitly set parsed to false on error
                 setIsParsingState(false); // Ensure parsing state is reset
                 setAssistantLoadingState(false); // Ensure loading state is reset
             }
             // No finally needed here as setFilesParsedCallback handles resetting flags
        } else {
             logger.warn("triggerParseResponse: assistantRef not ready."); // Use logger
        }
    }, [assistantRef, setFilesParsedCallback]); // Added setFilesParsedCallback dependency

    const triggerSelectAllParsed = useCallback(() => {
        if (assistantRef.current) assistantRef.current.selectAllParsedFiles();
        else logger.warn("triggerSelectAllParsed: assistantRef not ready."); // Use logger
    }, [assistantRef]);

    // MODIFIED: This now strictly points to the AICodeAssistant's combined handler
    const triggerCreateOrUpdatePR = useCallback(async () => {
        // This check prevents accidentally starting a standard PR if an image task is somehow stuck
        if (imageReplaceTask) {
            toast.warn("Действие недоступно во время замены картинки.");
            logger.warn("triggerCreateOrUpdatePR called while imageReplaceTask is active. Aborting."); // Use logger
            return;
        }
        if (assistantRef.current) {
             // No need to set loading here, handleCreatePR inside assistant should manage it
             await assistantRef.current.handleCreatePR(); // Points to the combined function in Assistant
        } else {
             logger.warn("triggerCreateOrUpdatePR: assistantRef not ready."); // Use logger
        }
    }, [assistantRef, imageReplaceTask]); // Added imageReplaceTask dependency

    // Updated triggerUpdateBranch to include optional PR params
    const triggerUpdateBranch = useCallback(async (
        repoUrl: string,
        files: { path: string; content: string }[],
        commitMessage: string,
        branchName: string,
        prNumber?: number, // Optional PR number
        prBody?: string // Optional PR body for update
    ): Promise<ReturnType<typeof updateBranch>> => {
        setAssistantLoadingState(true); // Set loading for the operation
        try {
            logger.log(`Context triggerUpdateBranch: Calling action for branch '${branchName}'`, { prNumber }); // Use logger
            const result = await updateBranch(repoUrl, files, commitMessage, branchName, prNumber, prBody); // Pass params to action
            if (result.success) {
                toast.success(`Ветка '${branchName}'${prNumber ? ` (и PR #${prNumber})` : ''} успешно обновлена!`);
            } else {
                toast.error(`Ошибка обновления ветки '${branchName}': ${result.error}`);
            }
            return result;
        } catch (error) {
            toast.error(`Критическая ошибка обновления ветки '${branchName}'.`);
            logger.error("triggerUpdateBranch error:", error); // Use logger
            return { success: false, error: error instanceof Error ? error.message : "Client-side error." };
        } finally {
            setAssistantLoadingState(false); // Clear loading after operation
        }
    }, []); // Dependencies remain minimal

    const triggerToggleSettingsModal = useCallback(() => setIsSettingsModalOpenState(prev => !prev), []);

    // --- Realtime Subscription Logic ---
    useEffect(() => {
        // ... (Realtime logic - no changes needed here for the fix, ensure logger usage) ...
        let isMounted = true;
        const currentReqId = currentAiRequestId; // Capture current value for effect closure

        if (!currentReqId || !supabaseAnon) {
            if (realtimeChannelRef.current) {
                logger.log(`[RT Cleanup] No request ID or Supabase client. Removing channel: ${realtimeChannelRef.current.topic}`);
                supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => logger.error("[RT Cleanup] Error removing channel:", e));
                realtimeChannelRef.current = null;
            }
            return () => { isMounted = false };
        }

        const channelId = `ai-request-${currentReqId}`;
        if (realtimeChannelRef.current?.topic === channelId) {
             // Already subscribed to the correct channel
             return () => { isMounted = false };
        }

        // If a different channel exists, remove it first
        if (realtimeChannelRef.current) {
            logger.log(`[RT Switch] Removing old channel: ${realtimeChannelRef.current.topic}`);
            supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => logger.error("[RT Switch] Error removing old channel:", e));
        }

        logger.log(`[RT Setup] Attempting to subscribe to ${channelId}`);
        const channel = supabaseAnon.channel(channelId)
            .on<AiRequestRecord>(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'ai_requests', filter: `id=eq.${currentReqId}` },
                (payload) => {
                    if (!isMounted) return;
                    logger.log('[RT Received] AI Request Updated:', payload.new);
                    const updatedRecord = payload.new;

                    // Ensure the update is for the currently monitored request ID
                    if (updatedRecord.id !== currentReqId) {
                        logger.log(`[RT Mismatch] Update for ${updatedRecord.id}, but monitoring ${currentReqId}. Ignoring.`);
                        return;
                    }

                    if (updatedRecord.status === 'completed') {
                        toast.success("🤖✨ Ответ от AI получен!");
                        if (assistantRef.current) {
                            assistantRef.current.setResponseValue(updatedRecord.response || "");
                        }
                        setAiResponseHasContentState(true);
                        setAiActionLoadingState(false); // Stop AI loading
                        setCurrentAiRequestIdState(null); // Clear monitored ID

                        // Auto-parse after a short delay
                        setTimeout(() => {
                            if (isMounted) {
                                logger.log("[RT AutoParse] Triggering parse after response received.");
                                triggerParseResponse().catch(err => logger.error("Error during auto-parsing:", err));
                            }
                        }, 300);

                    } else if (updatedRecord.status === 'failed') {
                        const errorMsg = updatedRecord.error_message || 'Неизвестная ошибка AI';
                        toast.error(`❌ Ошибка AI: ${errorMsg}`);
                        setAiActionLoadingState(false); // Stop AI loading
                        setCurrentAiRequestIdState(null); // Clear monitored ID

                    } else if (updatedRecord.status === 'processing') {
                        // Optionally update toast or UI to indicate processing
                        toast.info("⏳ AI обрабатывает запрос...", { id: `ai-processing-${currentReqId}`, duration: 5000 });
                    }
                }
            )
            .subscribe((status, err) => {
                if (!isMounted) return;
                if (status === 'SUBSCRIBED') {
                    logger.log(`[RT Status] Successfully subscribed to ${channelId}`);
                } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
                    logger.error(`[RT Status] Subscription error for ${channelId}: ${status}`, err);
                    toast.error("Ошибка Realtime подписки.");
                    // Reset loading/ID state if subscription fails while waiting
                    if (aiActionLoadingState && currentAiRequestId === currentReqId) {
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null);
                    }
                } else if (status === 'CLOSED') {
                    logger.log(`[RT Status] Channel explicitly closed for ${channelId}`);
                     // Reset loading/ID state if channel closes while waiting
                    if (aiActionLoadingState && currentAiRequestId === currentReqId) {
                         setAiActionLoadingState(false);
                         setCurrentAiRequestIdState(null);
                    }
                }
            });

        realtimeChannelRef.current = channel;

        // Cleanup function
        return () => {
            isMounted = false;
            if (realtimeChannelRef.current && realtimeChannelRef.current.topic === channelId) {
                logger.log(`[RT Cleanup] Removing channel: ${realtimeChannelRef.current.topic}`);
                supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => logger.error("[RT Cleanup] Error removing channel:", e));
                realtimeChannelRef.current = null;
            }
        };
    // Use aiActionLoadingState to trigger re-subscription if it changes externally while having an ID
    }, [currentAiRequestId, assistantRef, triggerParseResponse, aiActionLoadingState]);


    // --- Xuinity Message Logic (MODIFIED for Image Replace) ---
     const getXuinityMessage = useCallback((): string => {
        const effectiveBranch = targetBranchName;
        const branchInfo = effectiveBranch ? ` (ветка: ${effectiveBranch})` : ' (ветка по умолчанию)';
        const settingsMention = "настройках";

        // Prioritize image replace message if task is active
        if (imageReplaceTask) {
            if (fetchStatus === 'loading' || fetchStatus === 'retrying') return `Извлекаю файл для замены картинки${branchInfo}... ⏳`;
            if (fetchStatus === 'failed_retries') return `Ошибка извлечения файла для замены картинки${branchInfo}. 😭 Попробовать еще раз?`;
            if (assistantLoading) return `Заменяю картинку и создаю PR${branchInfo}... 🤖🖼️⚙️`;
            if (filesFetched) return `Файл извлечен${branchInfo}! ✅ Инициирую замену картинки и PR...`;
            return `Подготовка к замене картинки в файле ${imageReplaceTask.targetPath}...`; // Initial state
        }

        // Standard workflow messages
        switch (currentStep) {
            case 'idle': return "Инициализация студии...";
            case 'need_repo_url': return `👈 Укажи URL GitHub репозитория в ${settingsMention}.`;
            case 'ready_to_fetch': return repoUrlEntered ? `Готов извлечь файлы${branchInfo}. Жми 'Извлечь файлы'! 🎣 Или загляни в ${settingsMention}.` : `Сначала укажи URL в ${settingsMention}.`;
            case 'fetching': return `Извлекаю файлы${branchInfo}... ${fetchStatus === 'retrying' ? '(Повтор...)' : ''} ⏳`;
            case 'fetch_failed': return `Ошибка извлечения${branchInfo}. 😭 Попробовать еще раз?`;
            case 'files_fetched': return `Файлы извлечены${branchInfo}! ✅ Выбери нужные ИЛИ опиши задачу ниже. 👇 Или смени ветку в ${settingsMention}.`;
            case 'files_fetched_highlights': return `Файлы извлечены${branchInfo}. Есть связанные. 🤔 Выбери или опиши задачу. Ветку можно сменить в ${settingsMention}.`;
            case 'files_selected': return `Файлы выбраны${branchInfo}! 👍 Добавь в 'Твой Запрос' (+) ИЛИ сразу жми '🤖 Спросить AI'!`;
            case 'request_written': return aiActionLoading && !currentAiRequestId ? "Отправка запроса AI в очередь..." : "Запрос готов! 🔥 Жми '🤖 Спросить AI' ИЛИ скопируй для Grok.";
            case 'generating_ai_response': return `Запрос #${currentAiRequestId?.substring(0, 6)}... улетел к AI. 🚀 Ожидаем магию... (Админ в курсе!) ✨`;
            case 'request_copied': return "Скопировано! 📋 Жду ответ от внешнего AI. Вставляй результат сюда. 👇";
            case 'response_pasted': return "Ответ AI получен! ✅ Нажми '➡️ Разобрать Ответ' для анализа.";
            case 'parsing_response': return "Разбираю ответ AI... 🧠";
            case 'response_parsed': return "Разобрал! 👀 Проверь изменения, выбери файлы для коммита.";
            case 'pr_ready': return assistantLoading ? (effectiveBranch ? `Обновляю ветку '${effectiveBranch}'...` : "Создаю Pull Request...") : (effectiveBranch ? `Готов обновить ветку '${effectiveBranch}'? 🚀` : "Готов создать Pull Request? ✨");
            // files_fetched_image_replace is handled by the initial check now
            case 'files_fetched_image_replace': return `Неожиданное состояние: files_fetched_image_replace`; // Should not be reached
            default: logger.warn(`Unknown step in getXuinityMessage: ${currentStep}`); return "Что будем вайбить дальше?";
        }
    }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, aiActionLoading, targetBranchName, isParsing, currentAiRequestId, imageReplaceTask, filesFetched]);


    // --- Callback for Repo URL update in Assistant ---
    const updateRepoUrlInAssistant = useCallback((url: string) => {
        if (assistantRef.current) assistantRef.current.updateRepoUrl(url);
    }, [assistantRef]);

    // --- Context Value ---
    const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        loadingPrs, openPrs, targetBranchName, manualBranchName, isSettingsModalOpen, currentAiRequestId, isParsing,
        imageReplaceTask, // Include task state
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
        setFetchStatus: setFetchStatusCallback, setRepoUrlEntered: setRepoUrlEnteredCallback,
        setFilesFetched: setFilesFetchedCallback, // Use updated setter
        setAllFetchedFiles: setAllFetchedFilesCallback,
        setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback, setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback, setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback, setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback,
        setTargetBranchName: setTargetBranchNameFromPr,
        setManualBranchName: setManualBranchNameInput,
        setOpenPrs: setOpenPrsCallback, setLoadingPrs: setLoadingPrsCallback,
        setIsSettingsModalOpen: setIsSettingsModalOpenCallback,
        setCurrentAiRequestId: setCurrentAiRequestIdCallback,
        setIsParsing: setIsParsingCallback,
        setImageReplaceTask: setImageReplaceTaskCallback, // Include task setter
        triggerFetch, triggerGetOpenPRs, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed,
        triggerCreateOrUpdatePR, // Use combined trigger
        triggerUpdateBranch, triggerToggleSettingsModal, scrollToSection,
        getXuinityMessage, updateRepoUrlInAssistant,
    };

    return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};