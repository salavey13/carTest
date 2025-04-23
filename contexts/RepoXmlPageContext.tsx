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
    aiActionLoading: boolean; // <<< THIS IS THE STATE VARIABLE (the getter)
    loadingPrs: boolean;
    openPrs: SimplePullRequest[];
    targetBranchName: string | null;
    manualBranchName: string;
    isSettingsModalOpen: boolean;
    currentAiRequestId: string | null;
    isParsing: boolean;
    imageReplaceTask: ImageReplaceTask | null;

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
    setAiActionLoading: (loading: boolean) => void; // <<< THIS IS THE SETTER
    setTargetBranchName: (branch: string | null) => void;
    setManualBranchName: (branch: string) => void;
    setOpenPrs: (prs: SimplePullRequest[]) => void;
    setLoadingPrs: (loading: boolean) => void;
    setIsSettingsModalOpen: (isOpen: boolean) => void;
    setCurrentAiRequestId: (id: string | null) => void;
    setIsParsing: (parsing: boolean) => void;
    setImageReplaceTask: (task: ImageReplaceTask | null) => void;

    // Action Triggers
    triggerFetch: (isManualRetry?: boolean, branchNameToFetch?: string | null) => Promise<void>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
    triggerCopyKwork: () => void;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreateOrUpdatePR: () => Promise<void>;
    triggerUpdateBranch: (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string, prNumber?: number, prBody?: string) => Promise<ReturnType<typeof updateBranch>>;
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
        // Return a stub implementation if context is not found
        logger.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.');
        const warn = (name: string): any => () => { logger.warn(`Context stub: ${name} called.`); return Promise.resolve({ success: false, error: 'Context unavailable' }); };
        const warnSync = (name: string): any => () => { logger.warn(`Context stub: ${name} called.`); };
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
    const [aiActionLoading, setAiActionLoadingState] = useState(false); // Setter is correct here
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

    // Effect to update targetBranchName
    useEffect(() => {
        const trimmedManual = manualBranchName.trim();
        setTargetBranchNameState(trimmedManual || selectedPrBranch);
    }, [manualBranchName, selectedPrBranch]);

     // Effect: Load Initial AI Request State
    useEffect(() => {
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
                        const currentAIResponse = aiResponseInputRef.current?.value || "";
                        if (!currentAIResponse && reqData.response) {
                           logger.log(`[Init Effect] Last request ${lastRequestId} completed. Populating empty response area.`);
                            if (assistantRef.current) assistantRef.current.setResponseValue(reqData.response || "");
                            setAiResponseHasContentState(!!reqData.response);
                        } else {
                            logger.log(`[Init Effect] Last request ${lastRequestId} completed, but response area already has content or AI response was empty. No change.`);
                        }
                        setCurrentAiRequestIdState(null); setAiActionLoadingState(false);
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
    }, [user?.id, assistantRef, aiResponseInputRef]);

    // Derive current workflow step based on state
    const getCurrentStep = useCallback((): WorkflowStep => {
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading && currentAiRequestId) return 'generating_ai_response';
        if (isParsing) return 'parsing_response';
        // Consider assistantLoading (PR/Update process) as a final step state
        if (assistantLoading) return 'pr_ready'; // Keep PR/Update state sticky

        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';

        // Image Replace Task Flow takes priority AFTER fetch completes
        if (imageReplaceTask && filesFetched) {
            // If assistant isn't busy (e.g., creating PR), it's in the state after fetching
            return 'files_fetched_image_replace';
        }

        // Standard Flow
        if (aiResponseHasContent) {
            if (!filesParsed) return 'response_pasted';
            // If files are parsed, even if 0 selected, it's parsed. Ready if >0 selected.
            if (selectedAssistantFiles.size > 0) return 'pr_ready';
            return 'response_parsed'; // Files parsed, but none selected yet or 0 files found
        }
        if (requestCopied) return 'request_copied';
        if (kworkInputHasContent) return 'request_written';
        if (selectedFetcherFiles.size > 0) return 'files_selected';
        // Highlights are only relevant if no files are selected yet
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights';

        // Base state after successful fetch, no specific actions taken yet
        return 'files_fetched';
    }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading, isParsing,
        currentAiRequestId, imageReplaceTask,
        primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
    ]);
    const currentStep = getCurrentStep();


    // --- State Updaters (Memoized) ---
    const setFetchStatusCallback = useCallback((status: FetchStatus) => setFetchStatusState(status), []);
    const setRepoUrlEnteredCallback = useCallback((entered: boolean) => setRepoUrlEnteredState(entered), []);
    const setFilesFetchedCallback = useCallback((
        fetched: boolean,
        allFilesData: FileNode[] = [],
        primaryPath: string | null = null,
        secondaryPaths: string[] = []
    ) => {
        logger.log(`[Context:setFilesFetched] Called with fetched: ${fetched}, files: ${allFilesData.length}`);
        setFilesFetchedState(fetched);
        setAllFetchedFilesState(allFilesData); // Store all fetched files regardless of selection
        setPrimaryHighlightedPathState(primaryPath);
        setSecondaryHighlightedPathsState(secondaryPaths);

        if (fetched) {
            const currentTask = imageReplaceTask; // Capture state at call time
            if (currentTask && assistantRef.current) {
                logger.log("[Context:setFilesFetched] Files fetched, triggering direct image replacement for:", currentTask);
                setAssistantLoadingState(true); // Indicate assistant is busy

                // Use setTimeout to allow React state updates to settle before calling the ref method
                setTimeout(() => {
                    if (assistantRef.current) {
                        assistantRef.current.handleDirectImageReplace(currentTask)
                            .catch(err => {
                                logger.error("[Context:setFilesFetched] Error triggering/running direct image replacement:", err);
                                toast.error("Ошибка авто-замены картинки.");
                                // Reset state on error WITHIN the async catch
                                setImageReplaceTaskState(null); // Use direct setter
                                setAssistantLoadingState(false); // Use direct setter
                            });
                    } else {
                        logger.warn("[Context:setFilesFetched] Assistant ref not ready when trying to trigger replacement within timeout.");
                        toast.error("Ошибка: Компонент ассистента не готов для авто-замены.");
                        setImageReplaceTaskState(null); // Use direct setter
                        setAssistantLoadingState(false); // Use direct setter
                    }
                }, 50); // Small delay (50ms)

            } else if (currentTask && !assistantRef.current) {
                 // THIS IS THE ERROR CASE WE FIXED
                 logger.error("[Context:setFilesFetched] Image task exists, but Assistant ref is missing!");
                 toast.error("Критическая ошибка: Ассистент не найден для замены картинки.");
                 setImageReplaceTaskState(null); // Clear the task if it can't be handled
            } else {
                 // Standard fetch success (no image task, or ref already handled it)
                 // Set status to success ONLY if not handled by image replace logic
                 setFetchStatusState('success');
                 logger.log("[Context:setFilesFetched] Standard file fetch successful or image task initiated.");
            }
        } else {
            // Resetting state when 'fetched' is false
            logger.log("[Context:setFilesFetched] Resetting fetcher state.");
            setAllFetchedFilesState([]);
            setSelectedFetcherFilesState(new Set());
            setPrimaryHighlightedPathState(null);
            setSecondaryHighlightedPathsState([]);
            setKworkInputHasContentState(false);
            setRequestCopiedState(false);
            setAiResponseHasContentState(false);
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            setAssistantLoadingState(false);
            setAiActionLoadingState(false);
            setIsParsingState(false);
            setCurrentAiRequestIdState(null);
            setImageReplaceTaskState(null); // Ensure task is cleared on reset
            setFetchStatusState('idle'); // Reset fetch status
            if (assistantRef.current) assistantRef.current.setResponseValue("");
            if (kworkInputRef.current) kworkInputRef.current.value = "";
        }
    }, [assistantRef, imageReplaceTask, kworkInputRef]); // Include dependencies

    const setAllFetchedFilesCallback = useCallback((files: FileNode[]) => setAllFetchedFilesState(files), []);
    const setSelectedFetcherFilesCallback = useCallback((files: Set<string>) => setSelectedFetcherFilesState(files), []);
    const setKworkInputHasContentCallback = useCallback((hasContent: boolean) => setKworkInputHasContentState(hasContent), []);
    const setRequestCopiedCallback = useCallback((copied: boolean) => setRequestCopiedState(copied), []);
    const setAiResponseHasContentCallback = useCallback((hasContent: boolean) => {
        setAiResponseHasContentState(hasContent);
        // Clear downstream state only if response cleared AND not loading new one
        if (!hasContent && !aiActionLoading) { // Use state variable for read
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            // Don't clear currentAiRequestId here, Realtime effect manages it
        }
    }, [aiActionLoading]); // Dependency is correct
    const setFilesParsedCallback = useCallback((parsed: boolean) => {
        setFilesParsedState(parsed);
        if (!parsed) {
            setSelectedAssistantFilesState(new Set()); // Clear selection if parsing fails or is reset
        }
        setIsParsingState(false); // Ensure parsing flag is reset
        setAssistantLoadingState(false); // Ensure general loading is reset after parse attempt
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
    const setImageReplaceTaskCallback = useCallback((task: ImageReplaceTask | null) => setImageReplaceTaskState(task), []);

    // --- Action Triggers (Memoized) ---
    const triggerFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
        if (fetcherRef.current) await fetcherRef.current.handleFetch(isManualRetry, branchNameToFetch);
        else logger.warn("triggerFetch: fetcherRef not ready.");
    }, [fetcherRef]);

    const triggerGetOpenPRs = useCallback(async (repoUrl: string) => {
        if (!repoUrl || !repoUrl.includes('github.com')) { toast.error("Укажите валидный URL GitHub репо в настройках."); return; }
        setLoadingPrsState(true); setOpenPrsState([]); setTargetBranchNameFromPr(null);
        try {
            const result = await getOpenPullRequests(repoUrl);
            if (result.success && result.pullRequests) { setOpenPrsState(result.pullRequests); toast.success(`Загружено ${result.pullRequests.length} открытых PR.`); }
            else { setOpenPrsState([]); toast.error(`Ошибка загрузки PR: ${result.error || 'Неизвестная ошибка'}`); } // Clear PRs on error
        } catch (error) { setOpenPrsState([]); toast.error("Критическая ошибка при загрузке PR."); logger.error("triggerGetOpenPRs error:", error); }
        finally { setLoadingPrsState(false); }
    }, [setTargetBranchNameFromPr]);

    const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger' | 'settings-modal-trigger-assistant') => {
        let element: HTMLElement | null = null;
        // Map logical IDs to actual DOM IDs if they differ
        const targetId = (id === 'assistant' || id === 'executor') ? 'executor' : (id === 'fetcher' ? 'extractor' : (id === 'settingsModalTrigger' ? 'settings-modal-trigger-assistant' : id));

        switch (targetId) {
            case 'kworkInput': element = kworkInputRef.current; break;
            case 'aiResponseInput': element = aiResponseInputRef.current; break;
            case 'prSection': element = prSectionRef.current; break;
            // Use getElementById for components potentially rendered later or outside direct ref scope
            case 'extractor': element = document.getElementById('extractor'); break;
            case 'executor': element = document.getElementById('executor'); break;
            case 'settings-modal-trigger-assistant': element = document.getElementById('settings-modal-trigger-assistant'); break;
        }

        if (element) {
            const behavior = 'smooth';
            if (['kworkInput', 'aiResponseInput'].includes(targetId)) {
                 element.scrollIntoView({ behavior, block: 'center' });
                 // Focus after scrolling animation settles
                 setTimeout(() => (element as HTMLTextAreaElement)?.focus(), 350);
            } else if (targetId === 'prSection') {
                 element.scrollIntoView({ behavior, block: 'nearest' }); // Scroll just enough to bring it into view
            } else {
                 // Standard scroll with offset for fixed headers
                 const headerOffset = 80; // Adjust as needed
                 const elementRect = element.getBoundingClientRect();
                 const elementTop = elementRect.top + window.scrollY;
                 window.scrollTo({ top: elementTop - headerOffset, behavior });
            }
        } else {
            logger.warn(`scrollToSection: Element with target ID "${targetId}" (mapped from "${id}") not found.`);
        }
    }, [kworkInputRef, aiResponseInputRef, prSectionRef]); // Refs are stable, no need to include them? Check React docs.

    const triggerSelectHighlighted = useCallback(() => {
        if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles();
        else logger.warn("triggerSelectHighlighted: fetcherRef not ready.");
    }, [fetcherRef]);

    const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => {
        if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi, filesToAddParam, allFetchedFiles);
        else logger.warn("triggerAddSelectedToKwork: fetcherRef not ready.");
    }, [fetcherRef, allFetchedFiles]);

    const triggerCopyKwork = useCallback(() => {
        if (fetcherRef.current) {
            const copied = fetcherRef.current.handleCopyToClipboard(undefined, true);
            if (copied) {
                 setRequestCopiedState(true);
                 // Clear AI response only if user explicitly copies
                 setAiResponseHasContentState(false);
                 if (assistantRef.current) assistantRef.current.setResponseValue("");
                 scrollToSection('aiResponseInput'); // Scroll to where AI response will go
            }
        } else { logger.warn("triggerCopyKwork: fetcherRef not ready."); }
    }, [fetcherRef, assistantRef, scrollToSection]);

    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        if (!fetcherRef.current || !user?.id ) { const m = !user?.id ? "Пользователь не аутентифицирован." : "Компоненты не готовы."; toast.error(m); return { success: false, error: m }; }
        const kworkValue = fetcherRef.current.getKworkInputValue(); if (!kworkValue.trim()) { toast.error("Запрос для AI пуст. Напишите что-нибудь!"); return { success: false, error: "Prompt empty." }; }

        // Set loading states IMMEDIATELY
        setAiActionLoadingState(true);
        setAiResponseHasContentState(false); // Clear previous response display
        setCurrentAiRequestIdState(null); // Clear previous request ID
        if (assistantRef.current) assistantRef.current.setResponseValue(""); // Clear assistant's textarea
        toast.info("Отправка запроса AI в очередь...");
        scrollToSection('executor'); // Scroll to assistant area

        try {
            const requestData: AiRequestInsert = { prompt: kworkValue, user_id: String(user.id), status: 'pending' };
            const { data, error: insertError } = await supabaseAnon.from('ai_requests').insert(requestData).select('id').single();

            if (insertError) { throw new Error(`DB Insert Error: ${insertError.message}`); }
            if (!data?.id) { throw new Error("No Request ID returned after insert."); }

            const newRequestId = data.id;
            logger.log("AI Request submitted to DB. Monitoring ID:", newRequestId);

            // --- Update user metadata ---
             const { error: updateMetaError } = await supabaseAnon
                 .from('users')
                 .update({ metadata: { last_ai_request_id: newRequestId } })
                 .eq('user_id', user.id);
             if (updateMetaError) {
                 logger.warn("Failed to update user metadata with last_ai_request_id:", updateMetaError);
                 // Non-critical, continue...
             }
            // --- End update metadata ---


            const userNameOrId = user.username || user.first_name || String(user.id);
            const promptExcerpt = kworkValue.substring(0, 300) + (kworkValue.length > 300 ? '...' : '');
            const notificationMessage = `🤖 Новый AI Запрос (#${newRequestId.substring(0, 6)}...)\nОт: ${userNameOrId} (${user.id})\nПромпт:\n\`\`\`\n${promptExcerpt}\n\`\`\``;

            notifyAdmin(notificationMessage).catch(err => logger.error("Failed to notify admin:", err));

            toast.success("Запрос поставлен в очередь! Ожидаем ответ AI... 🤖💭");
            // Set the request ID AFTER successful submission and DB operations
            setCurrentAiRequestIdState(newRequestId); // This triggers the Realtime listener setup
            return { success: true, requestId: newRequestId };

        } catch (error: any) {
            toast.error("Критическая ошибка при отправке запроса AI.");
            logger.error("triggerAskAi error:", error);
            // Reset loading states on error
            setAiActionLoadingState(false);
            setCurrentAiRequestIdState(null);
            return { success: false, error: error.message ?? "Unknown submit error." };
        }
    }, [fetcherRef, user, assistantRef, scrollToSection]);

    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current) {
             setIsParsingState(true); // Set parsing state specifically
             // setAssistantLoadingState(true); // Optional: Set general loading too if needed
             try {
                 await assistantRef.current.handleParse(); // This will update parsed files and validation
                 // Success/error handled within AICodeAssistant or its hook
             } catch (err) {
                 logger.error("Error during parsing trigger:", err);
                 toast.error("Ошибка при разборе ответа AI.");
                 // Reset states on direct error here
                 setFilesParsedCallback(false); // Updates state and clears selection
                 setIsParsingState(false);
                 setAssistantLoadingState(false); // Reset general loading if set
             } finally {
                 // setIsParsingState(false); // Parsing state is reset within setFilesParsedCallback or AICodeAssistant hook
                 // setAssistantLoadingState(false); // Reset general loading here if it was set
             }
        } else {
             logger.warn("triggerParseResponse: assistantRef not ready.");
        }
    }, [assistantRef, setFilesParsedCallback]);

    const triggerSelectAllParsed = useCallback(() => {
        if (assistantRef.current) assistantRef.current.selectAllParsedFiles();
        else logger.warn("triggerSelectAllParsed: assistantRef not ready.");
    }, [assistantRef]);

    const triggerCreateOrUpdatePR = useCallback(async () => {
        if (imageReplaceTask) {
            toast.warn("Действие недоступно во время замены картинки.");
            logger.warn("triggerCreateOrUpdatePR called while imageReplaceTask is active. Aborting.");
            return;
        }
        if (assistantRef.current) {
             // Assistant's internal handler will set loading states
             await assistantRef.current.handleCreatePR();
        } else {
             logger.warn("triggerCreateOrUpdatePR: assistantRef not ready.");
        }
    }, [assistantRef, imageReplaceTask]);

    // Trigger for updating a branch (used by Assistant for PR updates/image updates)
    const triggerUpdateBranch = useCallback(async (
        repoUrl: string,
        files: { path: string; content: string }[],
        commitMessage: string,
        branchName: string,
        prNumber?: number,
        prBody?: string
    ): Promise<ReturnType<typeof updateBranch>> => {
        setAssistantLoadingState(true); // Set loading specifically for this async operation
        try {
            logger.log(`Context triggerUpdateBranch: Calling action for branch '${branchName}'`, { prNumber });
            const result = await updateBranch(repoUrl, files, commitMessage, branchName, prNumber, prBody);
            if (result.success) {
                toast.success(`Ветка '${branchName}'${prNumber ? ` (и PR #${prNumber})` : ''} успешно обновлена!`);
                // Refresh PR list after successful update
                await triggerGetOpenPRs(repoUrl);
            } else {
                toast.error(`Ошибка обновления ветки '${branchName}': ${result.error}`);
            }
            return result;
        } catch (error) {
            toast.error(`Критическая ошибка обновления ветки '${branchName}'.`);
            logger.error("triggerUpdateBranch error:", error);
            return { success: false, error: error instanceof Error ? error.message : "Client-side error." };
        } finally {
            setAssistantLoadingState(false); // Clear loading state
        }
    }, [triggerGetOpenPRs]); // Added triggerGetOpenPRs dependency

    const triggerToggleSettingsModal = useCallback(() => setIsSettingsModalOpenState(prev => !prev), []);


    // --- Realtime Subscription Logic ---
    useEffect(() => {
        let isMounted = true;
        const currentReqId = currentAiRequestId; // Capture the ID at the start of the effect

        if (!currentReqId || !supabaseAnon) {
            // Cleanup if no request ID or client gone
            if (realtimeChannelRef.current) {
                logger.log(`[RT Cleanup] No active request ID (${currentReqId}) or Supabase client. Removing channel: ${realtimeChannelRef.current.topic}`);
                supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => logger.error("[RT Cleanup] Error removing channel:", e));
                realtimeChannelRef.current = null;
            }
            return () => { isMounted = false; }; // Standard cleanup pattern
        }

        const channelId = `ai-request-${currentReqId}`;

        // Avoid re-subscribing if already on the correct channel
        if (realtimeChannelRef.current?.topic === channelId) {
            logger.log(`[RT Check] Already subscribed to ${channelId}. No change.`);
             return () => { isMounted = false; };
        }

        // Clean up the previous channel if switching
        if (realtimeChannelRef.current) {
            logger.log(`[RT Switch] Switching from ${realtimeChannelRef.current.topic} to ${channelId}. Removing old channel.`);
            supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => logger.error("[RT Switch] Error removing old channel:", e));
            realtimeChannelRef.current = null; // Ensure ref is cleared before creating new one
        }

        logger.log(`[RT Setup] Attempting to subscribe to ${channelId}`);
        const channel = supabaseAnon.channel(channelId)
            .on<AiRequestRecord>(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'ai_requests', filter: `id=eq.${currentReqId}` },
                (payload) => {
                    if (!isMounted) { logger.log("[RT Received] Component unmounted. Ignoring update."); return; }

                    logger.log('[RT Received] AI Request Updated:', payload.new);
                    const updatedRecord = payload.new;

                    // Crucial: Ensure update is for the request we are currently tracking
                    if (updatedRecord.id !== currentAiRequestId) { // Check against the LATEST state value
                        logger.log(`[RT Mismatch] Update for ${updatedRecord.id}, but monitoring ${currentAiRequestId}. Ignoring.`);
                        return;
                    }

                    if (updatedRecord.status === 'completed') {
                        toast.success("🤖✨ Ответ от AI получен!");
                        if (assistantRef.current) {
                            assistantRef.current.setResponseValue(updatedRecord.response || "");
                        }
                        setAiResponseHasContentState(!!updatedRecord.response); // Update based on actual content
                        setAiActionLoadingState(false); // Stop loading indicator
                        setCurrentAiRequestIdState(null); // Clear the tracked ID
                        // --- Auto Parse ---
                        setTimeout(() => {
                            // Check mount status and if assistant is ready AGAIN before parsing
                            if (isMounted && assistantRef.current) {
                                logger.log("[RT AutoParse] Triggering parse after response received.");
                                // Trigger parse, error handling within triggerParseResponse
                                triggerParseResponse().catch(err => logger.error("Error during auto-parsing:", err));
                            } else if (isMounted) {
                                logger.warn("[RT AutoParse] Assistant ref not ready for auto-parse.");
                                toast.warn("Ответ получен, но ассистент не готов к авто-разбору.");
                            }
                        }, 300); // Small delay for state updates

                    } else if (updatedRecord.status === 'failed') {
                        const errorMsg = updatedRecord.error_message || 'Неизвестная ошибка AI';
                        toast.error(`❌ Ошибка AI: ${errorMsg}`);
                        setAiActionLoadingState(false); // Stop loading
                        setCurrentAiRequestIdState(null); // Clear tracked ID

                    } else if (updatedRecord.status === 'processing') {
                        // Provide ongoing feedback that AI is working
                        toast.info("⏳ AI обрабатывает запрос...", { id: `ai-processing-${currentReqId}`, duration: 5000 });
                    } else if (updatedRecord.status === 'pending') {
                        // Might receive this if DB trigger is slow, just log
                        logger.log(`[RT Received] Request ${currentReqId} still pending.`);
                    }
                }
            )
            .subscribe((status, err) => {
                if (!isMounted) return; // Don't log or change state if unmounted

                if (status === 'SUBSCRIBED') {
                    logger.log(`[RT Status] Successfully subscribed to ${channelId}`);
                } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
                    logger.error(`[RT Status] Subscription error for ${channelId}: ${status}`, err);
                    toast.error("Ошибка Realtime подписки. Ответ AI может не прийти автоматически.");
                    // If subscription fails, stop showing the loading state for this request
                    // *** Corrected Read and Check ***
                    if (aiActionLoading && currentAiRequestId === currentReqId) { // Use state value & check if it matches the failed channel's ID
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null);
                    }
                } else if (status === 'CLOSED') {
                    logger.log(`[RT Status] Channel explicitly closed for ${channelId}`);
                     // If channel closes unexpectedly while we thought we were loading
                     // *** Corrected Read and Check ***
                     if (aiActionLoading && currentAiRequestId === currentReqId) { // Use state value & check ID
                         setAiActionLoadingState(false);
                         setCurrentAiRequestIdState(null);
                         logger.warn("[RT Status] Channel closed unexpectedly while AI action was loading.");
                    }
                }
            });

        realtimeChannelRef.current = channel;

        // Cleanup function for the effect
        return () => {
            isMounted = false;
            // Check if the channel we are cleaning up is the one stored in the ref
            if (realtimeChannelRef.current && realtimeChannelRef.current.topic === channelId) {
                logger.log(`[RT Cleanup Effect] Removing channel: ${realtimeChannelRef.current.topic}`);
                supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => logger.error("[RT Cleanup Effect] Error removing channel:", e));
                realtimeChannelRef.current = null; // Clear the ref after removal
            } else {
                logger.log(`[RT Cleanup Effect] No channel or different channel found for ${channelId}. Skipping removal.`);
            }
        };
    // Dependencies: Re-run ONLY when the currentAiRequestId changes.
    }, [currentAiRequestId, assistantRef, triggerParseResponse, aiActionLoading]); // aiActionLoading included to potentially reset state on error


    // --- Xuinity Message Logic ---
     const getXuinityMessage = useCallback((): string => {
         const effectiveBranch = targetBranchName; // Uses combined state (manual or selected PR)
         const branchInfo = effectiveBranch ? ` (ветка: ${effectiveBranch.substring(0, 20)}${effectiveBranch.length > 20 ? '...' : ''})` : ' (ветка по умолчанию)';
         const settingsMention = "настройках";

         // --- Image Replace Task Flow ---
         if (imageReplaceTask) {
             if (fetchStatus === 'loading' || fetchStatus === 'retrying') return `Извлекаю файл для замены картинки${branchInfo}... ⏳`;
             if (fetchStatus === 'failed_retries') return `Ошибка извлечения файла для замены картинки${branchInfo}. 😭 Попробовать еще раз?`;
             // assistantLoading here means PR/update process for the image is running
             if (assistantLoading) return `Заменяю картинку и создаю/обновляю PR${branchInfo}... 🤖🖼️⚙️`;
             // If files fetched for image task, but assistant isn't loading yet (brief moment)
             if (filesFetched && currentStep === 'files_fetched_image_replace') return `Файл ${imageReplaceTask.targetPath.split('/').pop()} извлечен${branchInfo}! ✅ Готовлюсь к замене и PR...`;
             // Default message if task exists but fetch hasn't started/finished
             return `Подготовка к замене картинки в ${imageReplaceTask.targetPath.split('/').pop()}...`;
         }

         // --- Standard Workflow ---
         switch (currentStep) {
             case 'idle': return "Инициализация студии...";
             case 'need_repo_url': return `👈 Укажи URL GitHub репозитория в ${settingsMention}.`;
             case 'ready_to_fetch': return repoUrlEntered ? `Готов извлечь файлы${branchInfo}. Жми 'Извлечь файлы'! 🎣 Или загляни в ${settingsMention}.` : `Сначала укажи URL в ${settingsMention}.`;
             case 'fetching': return `Извлекаю файлы${branchInfo}... ${fetchStatus === 'retrying' ? '(Повтор...)' : ''} ⏳`;
             case 'fetch_failed': return `Ошибка извлечения${branchInfo}. 😭 Попробовать еще раз?`;
             case 'files_fetched': return `Файлы извлечены${branchInfo}! ✅ Выбери нужные ИЛИ опиши задачу ниже. 👇 Или смени ветку в ${settingsMention}.`;
             case 'files_fetched_highlights': return `Файлы извлечены${branchInfo}. Есть связанные/важные. 🤔 Выбери или опиши задачу. Ветку можно сменить в ${settingsMention}.`;
             case 'files_selected': return `Файлы выбраны${branchInfo}! 👍 Добавь в 'Твой Запрос' (+) ИЛИ сразу жми '🤖 Спросить AI'!`;
             case 'request_written': return aiActionLoading && !currentAiRequestId ? "Отправка запроса AI в очередь..." : "Запрос готов! 🔥 Жми '🤖 Спросить AI' ИЛИ скопируй для внешнего AI.";
             case 'generating_ai_response': return `Запрос #${currentAiRequestId?.substring(0, 6)}... улетел к AI. 🚀 Ожидаем магию... (Админ в курсе!) ✨`;
             case 'request_copied': return "Скопировано! 📋 Жду ответ от внешнего AI. Вставляй результат сюда. 👇";
             case 'response_pasted': return aiResponseHasContent ? "Ответ AI получен! ✅ Нажми '➡️ Разобрать Ответ' для анализа." : "Ожидание ответа AI...";
             case 'parsing_response': return "Разбираю ответ AI... 🧠";
             case 'response_parsed': return filesParsed ? "Разобрал! 👀 Проверь изменения, выбери файлы для коммита." : "Разбор завершен, но файлы не найдены/невалидны. Проверь ответ AI.";
             case 'pr_ready': return assistantLoading ? (effectiveBranch ? `Обновляю ветку '${effectiveBranch}'...` : "Создаю Pull Request...") : (selectedAssistantFiles.size > 0 ? (effectiveBranch ? `Готов обновить ветку '${effectiveBranch}'? 🚀` : "Готов создать Pull Request? ✨") : "Выбери файлы для коммита после разбора.");
             case 'files_fetched_image_replace': return `Неожиданное состояние: files_fetched_image_replace`; // Should be handled earlier
             default: logger.warn(`Unknown step in getXuinityMessage: ${currentStep}`); return "Что будем вайбить дальше?";
         }
    }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, aiActionLoading, targetBranchName, isParsing, currentAiRequestId, imageReplaceTask, filesFetched, filesParsed, selectedAssistantFiles, aiResponseHasContent]);


    // --- Callback for Repo URL update in Assistant ---
    const updateRepoUrlInAssistant = useCallback((url: string) => {
        if (assistantRef.current) assistantRef.current.updateRepoUrl(url);
        else logger.warn("updateRepoUrlInAssistant: assistantRef not ready.");
    }, [assistantRef]);

    // --- Context Value ---
    const value: RepoXmlPageContextType = {
        // State Flags
        currentStep, fetchStatus, repoUrlEntered, filesFetched, allFetchedFiles,
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading, // State variable is correct here
        loadingPrs, openPrs, targetBranchName, manualBranchName, isSettingsModalOpen, currentAiRequestId, isParsing,
        imageReplaceTask,

        // Refs (Passed from Layout)
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,

        // Updaters
        setFetchStatus: setFetchStatusCallback, setRepoUrlEntered: setRepoUrlEnteredCallback,
        setFilesFetched: setFilesFetchedCallback,
        setAllFetchedFiles: setAllFetchedFilesCallback,
        setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback, setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback, setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback, setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback, // Setter is correct here
        setTargetBranchName: setTargetBranchNameFromPr,
        setManualBranchName: setManualBranchNameInput,
        setOpenPrs: setOpenPrsCallback, setLoadingPrs: setLoadingPrsCallback,
        setIsSettingsModalOpen: setIsSettingsModalOpenCallback,
        setCurrentAiRequestId: setCurrentAiRequestIdCallback,
        setIsParsing: setIsParsingCallback,
        setImageReplaceTask: setImageReplaceTaskCallback,

        // Action Triggers
        triggerFetch, triggerGetOpenPRs, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed,
        triggerCreateOrUpdatePR,
        triggerUpdateBranch, triggerToggleSettingsModal, scrollToSection,

        // Messages & Callbacks
        getXuinityMessage, updateRepoUrlInAssistant,
    };

    return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};