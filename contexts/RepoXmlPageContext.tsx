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

// Define Ref Interfaces
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean, branchName?: string | null) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (autoAskAi?: boolean, filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => Promise<void>; // Updated signature
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
    handleCreatePR: () => Promise<void>; // This likely handles the update/create logic now
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
  | 'files_fetched_image_replace' // <<< --- NEW STEP --- >>> Specific state when files fetched for image replace task
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
    allFetchedFiles: FileNode[]; // NEW: Hold all raw fetched files
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: string[];
    selectedFetcherFiles: Set<string>;
    kworkInputHasContent: boolean;
    requestCopied: boolean;
    aiResponseHasContent: boolean;
    filesParsed: boolean;
    selectedAssistantFiles: Set<string>;
    assistantLoading: boolean; // General loading for Assistant actions (parse, PR create/update)
    aiActionLoading: boolean; // Loading specifically for AI request submission/waiting
    loadingPrs: boolean;
    openPrs: SimplePullRequest[];
    targetBranchName: string | null; // Effective target branch (manual or PR)
    manualBranchName: string; // Manually entered branch name
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
    setFilesFetched: (fetched: boolean, allFilesData?: FileNode[], primaryPath?: string | null, secondaryPaths?: string[]) => void; // Updated signature
    setAllFetchedFiles: (files: FileNode[]) => void; // NEW Setter
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
    triggerFetch: (isManualRetry?: boolean, branchNameToFetch?: string | null) => Promise<void>; // Updated signature
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
    triggerCopyKwork: () => void;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    // Renamed for clarity, points to the combined logic in assistant
    triggerCreateOrUpdatePR: () => Promise<void>;
    // Kept triggerUpdateBranch if needed directly, but usually called via triggerCreateOrUpdatePR
    triggerUpdateBranch: (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string) => Promise<ReturnType<typeof updateBranch>>;
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
        console.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.');
        const warn = (name: string): any => () => { console.warn(`Context stub: ${name} called.`); return Promise.resolve({ success: false, error: 'Context unavailable' }); };
        const warnSync = (name: string): any => () => { console.warn(`Context stub: ${name} called.`); };
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
            setImageReplaceTask: warnSync('setImageReplaceTask'), // Add new setter stub
            triggerFetch: warn('triggerFetch'), triggerGetOpenPRs: warn('triggerGetOpenPRs'),
            triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
            triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
            triggerAskAi: warn('triggerAskAi'),
            triggerParseResponse: warn('triggerParseResponse'), triggerSelectAllParsed: warnSync('triggerSelectAllParsed'),
            triggerCreateOrUpdatePR: warn('triggerCreateOrUpdatePR'), // Renamed stub
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
    const [allFetchedFiles, setAllFetchedFilesState] = useState<FileNode[]>([]); // NEW: Store all fetched files
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<string[]>([]);
    const [selectedFetcherFiles, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
    const [kworkInputHasContent, setKworkInputHasContentState] = useState(false);
    const [requestCopied, setRequestCopiedState] = useState(false);
    const [aiResponseHasContent, setAiResponseHasContentState] = useState(false);
    const [filesParsed, setFilesParsedState] = useState(false);
    const [selectedAssistantFiles, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());
    const [assistantLoading, setAssistantLoadingState] = useState(false); // General loading for Assistant actions (parse, PR create/update)
    const [aiActionLoading, setAiActionLoadingState] = useState(false); // Loading specifically for AI request submission/waiting
    const [loadingPrs, setLoadingPrsState] = useState(false);
    const [openPrs, setOpenPrsState] = useState<SimplePullRequest[]>([]);
    const [manualBranchName, setManualBranchNameState] = useState<string>("");
    const [selectedPrBranch, setSelectedPrBranchState] = useState<string | null>(null);
    const [targetBranchName, setTargetBranchNameState] = useState<string | null>(null); // Derived effective branch
    const [isSettingsModalOpen, setIsSettingsModalOpenState] = useState(false);
    const [currentAiRequestId, setCurrentAiRequestIdState] = useState<string | null>(null);
    const [isParsing, setIsParsingState] = useState(false);
    const [imageReplaceTask, setImageReplaceTaskState] = useState<ImageReplaceTask | null>(null); // NEW State

    const { user } = useAppContext(); // Get user context
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

    // Effect to update targetBranchName based on manual input or PR selection
    useEffect(() => {
        const trimmedManual = manualBranchName.trim();
        setTargetBranchNameState(trimmedManual || selectedPrBranch);
    }, [manualBranchName, selectedPrBranch]);

     // Effect: Load Initial AI Request State from user metadata on mount/user change
    useEffect(() => {
        let isMounted = true;
        if (!user?.id) {
            setCurrentAiRequestIdState(null);
            setAiActionLoadingState(false);
            return;
        }
        const fetchInitialAiState = async () => {
            console.log("[Init Effect] Fetching initial user data for AI state...");
            try {
                const { data: userData, error: userError } = await supabaseAnon
                    .from('users')
                    .select('metadata')
                    .eq('user_id', user.id)
                    .single();

                if (userError && userError.code !== 'PGRST116') {
                    console.error("[Init Effect] Error fetching user metadata:", userError); return;
                }

                const lastRequestId = userData?.metadata?.last_ai_request_id;
                if (lastRequestId && typeof lastRequestId === 'string') {
                    console.log(`[Init Effect] Found last AI request ID: ${lastRequestId}`);
                    const { data: reqData, error: reqError } = await supabaseAnon
                        .from('ai_requests')
                        .select('status, response, error_message')
                        .eq('id', lastRequestId)
                        .single();

                    if (reqError) { console.error(`[Init Effect] Error fetching status for ${lastRequestId}:`, reqError); if (isMounted) setCurrentAiRequestIdState(null); return; }
                    if (!isMounted) return;

                    console.log(`[Init Effect] Status for ${lastRequestId}: ${reqData.status}`);
                    if (reqData.status === 'pending' || reqData.status === 'processing') {
                        console.log(`[Init Effect] Last request ${lastRequestId} still ${reqData.status}. Setting state.`);
                        setCurrentAiRequestIdState(lastRequestId); setAiActionLoadingState(true); setAiResponseHasContentState(false);
                        if (assistantRef.current) assistantRef.current.setResponseValue("");
                    } else if (reqData.status === 'completed' && !aiResponseHasContentState) { // Use state getter
                        console.log(`[Init Effect] Last request ${lastRequestId} completed. Populating.`);
                        if (assistantRef.current) assistantRef.current.setResponseValue(reqData.response || "");
                        setAiResponseHasContentState(!!reqData.response); setCurrentAiRequestIdState(null); setAiActionLoadingState(false);
                    } else {
                        console.log(`[Init Effect] Last request ${lastRequestId} has status ${reqData.status} or handled. Resetting.`);
                        setCurrentAiRequestIdState(null); setAiActionLoadingState(false);
                    }
                } else {
                    console.log("[Init Effect] No last AI request ID found.");
                    setCurrentAiRequestIdState(null); setAiActionLoadingState(false);
                }
            } catch (error) {
                console.error("[Init Effect] Unexpected error:", error); if (isMounted) { setCurrentAiRequestIdState(null); setAiActionLoadingState(false); }
            }
        };
        fetchInitialAiState();
        return () => { isMounted = false; };
    }, [user?.id, assistantRef]); // Removed aiResponseHasContentState dependency


    // Derive current workflow step based on state (MODIFIED for Image Replace)
    const getCurrentStep = useCallback((): WorkflowStep => {
        // Loading states take precedence
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading && currentAiRequestId) return 'generating_ai_response';
        if (isParsing) return 'parsing_response';
        // Assistant is loading EITHER for parsing/regular PR OR for image replace PR
        if (assistantLoading) return 'pr_ready';

        // Check progress states
        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';

        // Specific state for image replace after fetch, before PR is triggered
        if (imageReplaceTask && filesFetched) return 'files_fetched_image_replace'; // <<< --- THIS STEP LOGIC --- >>>

        // Regular AI flow states
        if (aiResponseHasContent) {
            if (!filesParsed) return 'response_pasted'; // Got response, needs parsing
            if (selectedAssistantFiles.size > 0) return 'pr_ready'; // Parsed, files selected for PR/Update
            return 'response_parsed'; // Parsed, but no files selected yet
        }
        if (requestCopied) return 'request_copied'; // Manual path
        if (kworkInputHasContent) return 'request_written'; // Prompt written
        if (selectedFetcherFiles.size > 0) return 'files_selected'; // Files selected in fetcher
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights'; // Files fetched with highlights
        return 'files_fetched'; // Generic files fetched state
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

    // MODIFIED: setFilesFetchedCallback includes allFilesData and triggers replacement task
    const setFilesFetchedCallback = useCallback((
        fetched: boolean,
        allFilesData: FileNode[] = [], // Default to empty array
        primaryPath: string | null = null,
        secondaryPaths: string[] = []
    ) => {
        setFilesFetchedState(fetched);
        setAllFetchedFilesState(allFilesData); // Store all fetched files
        setPrimaryHighlightedPathState(primaryPath);
        setSecondaryHighlightedPathsState(secondaryPaths);

        if (fetched) {
            // Trigger Image Replace *immediately* after files are available
            // --- FIX: Use imageReplaceTask directly ---
            if (imageReplaceTask && assistantRef.current) {
                console.log("[Context:setFilesFetched] Files fetched, triggering direct image replacement for:", imageReplaceTask);
                setAssistantLoadingState(true); // Set loading *before* calling
                // Use setTimeout to allow state update and component re-render before calling ref method
                setTimeout(() => {
                    if (assistantRef.current) {
                        // --- FIX: Pass imageReplaceTask ---
                        assistantRef.current.handleDirectImageReplace(imageReplaceTask)
                            .then(() => {
                                console.log("[Context:setFilesFetched] Direct image replacement process finished/triggered.");
                                // Let handleDirectImageReplace handle clearing task and loading state
                            })
                            .catch(err => {
                                console.error("[Context:setFilesFetched] Error triggering/running direct image replacement:", err);
                                toast.error("Ошибка авто-замены картинки.");
                                setImageReplaceTaskState(null); // Clear task on error
                                setAssistantLoadingState(false); // Reset loading on error
                            });
                    } else {
                        console.warn("[Context:setFilesFetched] Assistant ref not ready when trying to trigger replacement.");
                        toast.error("Ошибка: Компонент ассистента не готов для авто-замены.");
                        setImageReplaceTaskState(null); // Clear task if ref is missing
                        setAssistantLoadingState(false); // Reset loading
                    }
                }, 50); // Short delay
            } else {
                 // Normal fetch success (not image replace)
                 setFetchStatusState('success');
            }
        } else {
            // Reset logic when un-fetching
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
        }
    }, [assistantRef, imageReplaceTask]); // --- FIX: Use imageReplaceTask dependency ---

    const setAllFetchedFilesCallback = useCallback((files: FileNode[]) => setAllFetchedFilesState(files), []); // NEW Setter
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
        setFilesParsedState(parsed); if (!parsed) setSelectedAssistantFilesState(new Set()); setIsParsingState(false); setAssistantLoadingState(false);
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
    const triggerFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => { // Updated signature
        if (fetcherRef.current) await fetcherRef.current.handleFetch(isManualRetry, branchNameToFetch); // Pass branch name
        else console.warn("triggerFetch: fetcherRef not ready.");
    }, [fetcherRef]); // Removed targetBranchName dependency, it's passed explicitly

    const triggerGetOpenPRs = useCallback(async (repoUrl: string) => {
        if (!repoUrl || !repoUrl.includes('github.com')) { toast.error("Укажите валидный URL GitHub репо в настройках."); return; }
        setLoadingPrsState(true); setOpenPrsState([]); setTargetBranchNameFromPr(null); setManualBranchNameInput("");
        try {
            const result = await getOpenPullRequests(repoUrl);
            if (result.success && result.pullRequests) { setOpenPrsState(result.pullRequests); toast.success(`Загружено ${result.pullRequests.length} открытых PR.`); }
            else { toast.error(`Ошибка загрузки PR: ${result.error || 'Неизвестная ошибка'}`); }
        } catch (error) { toast.error("Критическая ошибка при загрузке PR."); console.error("triggerGetOpenPRs error:", error); }
        finally { setLoadingPrsState(false); }
    }, [setTargetBranchNameFromPr, setManualBranchNameInput]);

    const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger' | 'settings-modal-trigger-assistant') => {
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
            if (['kworkInput', 'aiResponseInput', 'prSection', 'settings-modal-trigger-assistant'].includes(targetId)) { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            else { const rect = element.getBoundingClientRect(); const headerOffset = 80; window.scrollTo({ top: window.scrollY + rect.top - headerOffset, behavior: 'smooth' }); }
        } else { console.warn(`scrollToSection: Element with target ID "${targetId}" (mapped from "${id}") not found.`); }
    }, [kworkInputRef, aiResponseInputRef, prSectionRef]);

    const triggerSelectHighlighted = useCallback(() => {
        if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted: fetcherRef not ready.");
    }, [fetcherRef]);

    const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => {
        if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi, filesToAddParam, allFetchedFiles); // Pass allFetchedFiles
        else console.warn("triggerAddSelectedToKwork: fetcherRef not ready.");
    }, [fetcherRef, allFetchedFiles]); // Add allFetchedFiles dependency

    const triggerCopyKwork = useCallback(() => {
        if (fetcherRef.current) {
            const copied = fetcherRef.current.handleCopyToClipboard(undefined, true);
            if (copied) { setRequestCopiedState(true); setAiResponseHasContentState(false); if (assistantRef.current) assistantRef.current.setResponseValue(""); scrollToSection('aiResponseInput'); }
        } else { console.warn("triggerCopyKwork: fetcherRef not ready."); }
    }, [fetcherRef, assistantRef, scrollToSection]);

    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        if (!fetcherRef.current || !user?.id ) { const m = !user?.id ? "Пользователь не аутентифицирован." : "Компоненты не готовы."; toast.error(m); return { success: false, error: m }; }
        const kworkValue = fetcherRef.current.getKworkInputValue(); if (!kworkValue.trim()) { toast.error("Запрос для AI пуст. Напишите что-нибудь!"); return { success: false, error: "Prompt empty." }; }
        setAiActionLoadingState(true); setAiResponseHasContentState(false); setCurrentAiRequestIdState(null); if (assistantRef.current) assistantRef.current.setResponseValue(""); toast.info("Отправка запроса AI в очередь..."); scrollToSection('executor');
        try {
            const requestData: AiRequestInsert = { prompt: kworkValue, user_id: String(user.id), status: 'pending' };
            const { data, error: insertError } = await supabaseAnon.from('ai_requests').insert(requestData).select('id').single();
            if (insertError) { throw new Error(`DB Insert Error: ${insertError.message}`); } if (!data?.id) { throw new Error("No Request ID returned after insert."); }
            const newRequestId = data.id; console.log("AI Request submitted to DB. Monitoring ID:", newRequestId);
            const userNameOrId = user.username || user.first_name || String(user.id); const promptExcerpt = kworkValue.substring(0, 300) + (kworkValue.length > 300 ? '...' : ''); const notificationMessage = `🤖 Новый AI Запрос (#${newRequestId.substring(0, 6)}...)\nОт: ${userNameOrId} (${user.id})\nПромпт:\n\`\`\`\n${promptExcerpt}\n\`\`\``;
            notifyAdmin(notificationMessage).catch(err => console.error("Failed to notify admin:", err));
            toast.success("Запрос поставлен в очередь! Ожидаем ответ AI... 🤖💭"); setCurrentAiRequestIdState(newRequestId);
            return { success: true, requestId: newRequestId };
        } catch (error: any) { toast.error("Критическая ошибка при отправке запроса AI."); console.error("triggerAskAi error:", error); setAiActionLoadingState(false); setCurrentAiRequestIdState(null); return { success: false, error: error.message ?? "Unknown submit error." }; }
    }, [fetcherRef, user, assistantRef, scrollToSection]);

    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current) { setIsParsingState(true); setAssistantLoadingState(true); try { await assistantRef.current.handleParse(); } catch (err) { console.error("Error during parsing:", err); toast.error("Ошибка при разборе ответа AI."); setFilesParsedCallback(false); } finally { setIsParsingState(false); setAssistantLoadingState(false); } }
        else { console.warn("triggerParseResponse: assistantRef not ready."); }
    }, [assistantRef, setFilesParsedCallback]);

    const triggerSelectAllParsed = useCallback(() => {
        if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed: assistantRef not ready.");
    }, [assistantRef]);

    // MODIFIED: This now strictly points to the AICodeAssistant's combined handler
    const triggerCreateOrUpdatePR = useCallback(async () => {
        // --- FIX: Check imageReplaceTask directly ---
        if (imageReplaceTask) {
            toast.warn("Действие недоступно во время замены картинки.");
            console.warn("triggerCreateOrUpdatePR called while imageReplaceTask is active. Aborting.");
            return;
        }
        if (assistantRef.current) await assistantRef.current.handleCreatePR(); // Points to the combined function in Assistant
        else console.warn("triggerCreateOrUpdatePR: assistantRef not ready.");
        // --- FIX: Use imageReplaceTask dependency ---
    }, [assistantRef, imageReplaceTask]);

    // This remains for potential direct use but is generally wrapped by triggerCreateOrUpdatePR now
    const triggerUpdateBranch = useCallback(async (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string): Promise<ReturnType<typeof updateBranch>> => {
        setAssistantLoadingState(true); try { console.log(`Context triggerUpdateBranch: Calling action for branch '${branchName}'`); const result = await updateBranch(repoUrl, files, commitMessage, branchName); if(result.success) { toast.success(`Ветка '${branchName}' успешно обновлена!`); } else { toast.error(`Ошибка обновления ветки '${branchName}': ${result.error}`); } return result; } catch (error) { toast.error(`Критическая ошибка обновления ветки '${branchName}'.`); console.error("triggerUpdateBranch error:", error); return { success: false, error: error instanceof Error ? error.message : "Client-side error." }; } finally { setAssistantLoadingState(false); }
    }, []);

    const triggerToggleSettingsModal = useCallback(() => setIsSettingsModalOpenState(prev => !prev), []);

    // --- Realtime Subscription Logic (No changes needed here for this fix) ---
    useEffect(() => {
        let isMounted = true;
        // --- FIX: Use currentAiRequestId directly ---
        if (!currentAiRequestId || !supabaseAnon) { if (realtimeChannelRef.current) { console.log(`[RT Cleanup] No request ID or Supabase client. Removing channel: ${realtimeChannelRef.current.topic}`); supabaseAnon?.removeChannel(realtimeChannelRef.current).catch(e => console.error("[RT Cleanup] Error removing channel:", e)); realtimeChannelRef.current = null; } return () => { isMounted = false }; }
        const channelId = `ai-request-${currentAiRequestId}`; if (realtimeChannelRef.current?.topic === channelId) return () => { isMounted = false };
        if (realtimeChannelRef.current) { console.log(`[RT Switch] Removing old channel: ${realtimeChannelRef.current.topic}`); supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => console.error("[RT Switch] Error removing old channel:", e)); }
        console.log(`[RT Setup] Attempting to subscribe to ${channelId}`);
        const channel = supabaseAnon.channel(channelId).on<AiRequestRecord>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_requests', filter: `id=eq.${currentAiRequestId}` }, (payload) => { if (!isMounted) return; console.log('[RT Received] AI Request Updated:', payload.new); const updatedRecord = payload.new;
             // --- FIX: Use currentAiRequestId directly ---
             if (updatedRecord.id !== currentAiRequestId) { console.log(`[RT Mismatch] Update for ${updatedRecord.id}, but monitoring ${currentAiRequestId}. Ignoring.`); return; }
            if (updatedRecord.status === 'completed') { toast.success("🤖✨ Ответ от AI получен!"); if (assistantRef.current) { assistantRef.current.setResponseValue(updatedRecord.response || ""); } setAiResponseHasContentState(true); setAiActionLoadingState(false); setCurrentAiRequestIdState(null); setTimeout(() => { if (isMounted) { triggerParseResponse().catch(err => console.error("Error during auto-parsing:", err)); } }, 300); }
            else if (updatedRecord.status === 'failed') { const errorMsg = updatedRecord.error_message || 'Неизвестная ошибка AI'; toast.error(`❌ Ошибка AI: ${errorMsg}`); setAiActionLoadingState(false); setCurrentAiRequestIdState(null); }
            // --- FIX: Use currentAiRequestId directly ---
            else if (updatedRecord.status === 'processing') { toast.info("⏳ AI всё ещё думает...", { id: `ai-processing-${currentAiRequestId}`, duration: 5000 }); }
         }).subscribe((status, err) => { if (!isMounted) return; if (status === 'SUBSCRIBED') { console.log(`[RT Status] Successfully subscribed to ${channelId}`); } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) { console.error(`[RT Status] Subscription error for ${channelId}: ${status}`, err); toast.error("Ошибка Realtime подписки."); if (aiActionLoading) { setAiActionLoadingState(false); setCurrentAiRequestIdState(null); } } else if (status === 'CLOSED') { console.log(`[RT Status] Channel explicitly closed for ${channelId}`); if (aiActionLoading) { setAiActionLoadingState(false); setCurrentAiRequestIdState(null); } } });
        realtimeChannelRef.current = channel;
        return () => { isMounted = false; if (realtimeChannelRef.current && realtimeChannelRef.current.topic === channelId) { console.log(`[RT Cleanup] Removing channel: ${realtimeChannelRef.current.topic}`); supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => console.error("[RT Cleanup] Error removing channel:", e)); realtimeChannelRef.current = null; } };
        // --- FIX: Use currentAiRequestId dependency ---
    }, [currentAiRequestId, assistantRef, triggerParseResponse, aiActionLoading]);


    // --- Xuinity Message Logic (MODIFIED for Image Replace) ---
     const getXuinityMessage = useCallback((): string => {
        const effectiveBranch = targetBranchName; // Use derived state
        const branchInfo = effectiveBranch ? ` (ветка: ${effectiveBranch})` : ' (ветка по умолчанию)';
        const settingsMention = "настройках"; // Moved common mention

        switch (currentStep) {
            case 'idle': return "Инициализация студии...";
            case 'need_repo_url': return `👈 Укажи URL GitHub репозитория в ${settingsMention}.`;
            case 'ready_to_fetch': return repoUrlEntered ? `Готов извлечь файлы${branchInfo}. Жми 'Извлечь файлы'! 🎣 Или загляни в ${settingsMention}.` : `Сначала укажи URL в ${settingsMention}.`;
            case 'fetching': return `Извлекаю файлы${branchInfo}... ${fetchStatus === 'retrying' ? '(Повтор...)' : ''} ⏳`;
            case 'fetch_failed': return `Ошибка извлечения${branchInfo}. 😭 Попробовать еще раз?`;
            // *** NEW MESSAGE FOR IMAGE REPLACE STEP ***
            case 'files_fetched_image_replace': return `Файлы извлечены${branchInfo}! ✅ Запускаю замену картинки и создание PR... 🤖🖼️`;
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
            default: return "Что будем вайбить дальше?";
        }
        // --- FIX: Use imageReplaceTask dependency ---
    }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, aiActionLoading, targetBranchName, isParsing, currentAiRequestId, imageReplaceTask]);


    // --- Callback for Repo URL update in Assistant ---
    const updateRepoUrlInAssistant = useCallback((url: string) => {
        if (assistantRef.current) assistantRef.current.updateRepoUrl(url);
    }, [assistantRef]);

    // --- Context Value ---
    const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, allFetchedFiles, // Added allFetchedFiles
        primaryHighlightedPath, secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        loadingPrs, openPrs, targetBranchName, manualBranchName, isSettingsModalOpen, currentAiRequestId, isParsing,
        imageReplaceTask, // Added imageReplaceTask
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
        setFetchStatus: setFetchStatusCallback, setRepoUrlEntered: setRepoUrlEnteredCallback,
        setFilesFetched: setFilesFetchedCallback, // Updated setter
        setAllFetchedFiles: setAllFetchedFilesCallback, // Added setter
        setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback, setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback, setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback, setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback,
        setTargetBranchName: setTargetBranchNameFromPr, // Keep clarity
        setManualBranchName: setManualBranchNameInput,
        setOpenPrs: setOpenPrsCallback, setLoadingPrs: setLoadingPrsCallback,
        setIsSettingsModalOpen: setIsSettingsModalOpenCallback,
        setCurrentAiRequestId: setCurrentAiRequestIdCallback,
        setIsParsing: setIsParsingCallback,
        setImageReplaceTask: setImageReplaceTaskCallback, // Added setter
        triggerFetch, triggerGetOpenPRs, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed,
        triggerCreateOrUpdatePR, // Use renamed trigger
        triggerUpdateBranch, triggerToggleSettingsModal, scrollToSection,
        getXuinityMessage, updateRepoUrlInAssistant,
    };

    return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};