"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAnon } from "@/hooks/supabase"; // Use anon client
import { notifyAdmin } from "@/app/actions"; // Import notifyAdmin from main actions
import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions';
import type { AiRequestRecord, AiRequestInsert, AiRequestStatus } from '@/types/ai.types'; // Import types
import type { RealtimeChannel } from '@supabase/supabase-js';

// Define Ref Interfaces
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean, branchName?: string | null) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    clearAll: () => void;
    getKworkInputValue: () => string;
}

export interface AICodeAssistantRef {
    handleParse: () => Promise<void>;
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>;
    setResponseValue: (value: string) => void;
    updateRepoUrl: (url: string) => void;
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
  | 'files_fetched'
  | 'files_fetched_highlights'
  | 'files_selected'
  | 'request_written'
  | 'generating_ai_response' // Waiting for AI response via Realtime
  | 'request_copied' // Manual copy path
  | 'response_pasted' // Response received (Realtime or manual paste)
  | 'parsing_response'
  | 'response_parsed'
  | 'pr_ready';

// Context Type Definition
interface RepoXmlPageContextType {
    // State Flags
    currentStep: WorkflowStep;
    fetchStatus: FetchStatus;
    repoUrlEntered: boolean;
    filesFetched: boolean;
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

    // Refs
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    prSectionRef: MutableRefObject<HTMLElement | null>;

    // Updaters
    setFetchStatus: (status: FetchStatus) => void;
    setRepoUrlEntered: (entered: boolean) => void;
    setFilesFetched: (fetched: boolean, primaryPath?: string | null, secondaryPaths?: string[]) => void;
    setSelectedFetcherFiles: (files: Set<string>) => void;
    setKworkInputHasContent: (hasContent: boolean) => void;
    setRequestCopied: (copied: boolean) => void;
    setAiResponseHasContent: (hasContent: boolean) => void;
    setFilesParsed: (parsed: boolean) => void;
    setSelectedAssistantFiles: (files: Set<string>) => void;
    setAssistantLoading: (loading: boolean) => void;
    setAiActionLoading: (loading: boolean) => void;
    setTargetBranchName: (branch: string | null) => void; // Handles PR selection logic
    setManualBranchName: (branch: string) => void; // Handles manual input logic
    setOpenPrs: (prs: SimplePullRequest[]) => void;
    setLoadingPrs: (loading: boolean) => void;
    setIsSettingsModalOpen: (isOpen: boolean) => void;
    setCurrentAiRequestId: (id: string | null) => void;
    setIsParsing: (parsing: boolean) => void;

    // Action Triggers
    triggerFetch: (isManualRetry?: boolean) => Promise<void>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
    triggerCopyKwork: () => void;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreatePR: () => Promise<void>;
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
            currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false,
            primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
            kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
            filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false,
            loadingPrs: false, openPrs: [], targetBranchName: null, manualBranchName: "",
            isSettingsModalOpen: false, currentAiRequestId: null, isParsing: false,
            fetcherRef: { current: null }, assistantRef: { current: null }, kworkInputRef: { current: null },
            aiResponseInputRef: { current: null }, prSectionRef: { current: null },
            setFetchStatus: warnSync('setFetchStatus'), setRepoUrlEntered: warnSync('setRepoUrlEntered'),
            setFilesFetched: warnSync('setFilesFetched'), setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
            setKworkInputHasContent: warnSync('setKworkInputHasContent'), setRequestCopied: warnSync('setRequestCopied'),
            setAiResponseHasContent: warnSync('setAiResponseHasContent'), setFilesParsed: warnSync('setFilesParsed'),
            setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'), setAssistantLoading: warnSync('setAssistantLoading'),
            setAiActionLoading: warnSync('setAiActionLoading'),
            setTargetBranchName: warnSync('setTargetBranchName'), setManualBranchName: warnSync('setManualBranchName'),
            setOpenPrs: warnSync('setOpenPrs'), setLoadingPrs: warnSync('setLoadingPrs'),
            setIsSettingsModalOpen: warnSync('setIsSettingsModalOpen'),
            setCurrentAiRequestId: warnSync('setCurrentAiRequestId'),
            setIsParsing: warnSync('setIsParsing'),
            triggerFetch: warn('triggerFetch'), triggerGetOpenPRs: warn('triggerGetOpenPRs'),
            triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
            triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
            triggerAskAi: warn('triggerAskAi'),
            triggerParseResponse: warn('triggerParseResponse'), triggerSelectAllParsed: warnSync('triggerSelectAllParsed'),
            triggerCreatePR: warn('triggerCreatePR'),
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
    const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
    const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<string[]>([]);
    const [selectedFetcherFiles, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
    const [kworkInputHasContent, setKworkInputHasContentState] = useState(false);
    const [requestCopied, setRequestCopiedState] = useState(false);
    const [aiResponseHasContent, setAiResponseHasContentState] = useState(false);
    const [filesParsed, setFilesParsedState] = useState(false);
    const [selectedAssistantFiles, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());
    const [assistantLoading, setAssistantLoadingState] = useState(false); // Loading for parse/PR/update
    const [aiActionLoading, setAiActionLoadingState] = useState(false); // Loading for submitting/waiting AI response
    const [loadingPrs, setLoadingPrsState] = useState(false);
    const [openPrs, setOpenPrsState] = useState<SimplePullRequest[]>([]);
    const [currentAiRequestId, setCurrentAiRequestIdState] = useState<string | null>(null);
    const [isParsing, setIsParsingState] = useState(false);
    const [manualBranchName, setManualBranchNameState] = useState<string>("");
    const [selectedPrBranch, setSelectedPrBranchState] = useState<string | null>(null);
    const [targetBranchName, setTargetBranchNameState] = useState<string | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpenState] = useState(false);

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
                // Check if user metadata exists and has last_ai_request_id
                const { data: userData, error: userError } = await supabaseAnon
                    .from('users')
                    .select('metadata')
                    .eq('user_id', user.id)
                    .single();

                if (userError && userError.code !== 'PGRST116') { // Ignore 'not found' error
                    console.error("[Init Effect] Error fetching user metadata:", userError);
                    return;
                }

                const lastRequestId = userData?.metadata?.last_ai_request_id;
                if (lastRequestId && typeof lastRequestId === 'string') {
                    console.log(`[Init Effect] Found last AI request ID: ${lastRequestId}`);
                    // Check the status of the last known request
                    const { data: reqData, error: reqError } = await supabaseAnon
                        .from('ai_requests')
                        .select('status, response, error_message')
                        .eq('id', lastRequestId)
                        .single();

                    if (reqError) {
                        console.error(`[Init Effect] Error fetching status for ${lastRequestId}:`, reqError);
                        if (isMounted) setCurrentAiRequestIdState(null); // Reset if request fetch failed
                        return;
                    }
                    if (!isMounted) return; // Check mount status after async operation

                    console.log(`[Init Effect] Status for ${lastRequestId}: ${reqData.status}`);
                    if (reqData.status === 'pending' || reqData.status === 'processing') {
                        // If still processing, set the ID and loading state
                        console.log(`[Init Effect] Last request ${lastRequestId} still ${reqData.status}. Setting state.`);
                        setCurrentAiRequestIdState(lastRequestId);
                        setAiActionLoadingState(true);
                        setAiResponseHasContentState(false);
                        if (assistantRef.current) assistantRef.current.setResponseValue(""); // Clear response area
                    } else if (reqData.status === 'completed' && !aiResponseHasContent) {
                        // If completed and response area is empty, populate it
                        console.log(`[Init Effect] Last request ${lastRequestId} completed. Populating.`);
                        if (assistantRef.current) assistantRef.current.setResponseValue(reqData.response || "");
                        setAiResponseHasContentState(!!reqData.response); // Set based on actual response
                        setCurrentAiRequestIdState(null);
                        setAiActionLoadingState(false);
                    } else {
                        // If failed or completed but already handled, reset
                        console.log(`[Init Effect] Last request ${lastRequestId} has status ${reqData.status} or handled. Resetting.`);
                        setCurrentAiRequestIdState(null);
                        setAiActionLoadingState(false);
                    }
                } else {
                    // No last request ID found in metadata
                    console.log("[Init Effect] No last AI request ID found.");
                    setCurrentAiRequestIdState(null);
                    setAiActionLoadingState(false);
                }
            } catch (error) {
                console.error("[Init Effect] Unexpected error:", error);
                if (isMounted) { // Check mount status before setting state in catch block
                    setCurrentAiRequestIdState(null);
                    setAiActionLoadingState(false);
                }
            }
        };
        fetchInitialAiState();
        return () => { isMounted = false; }; // Cleanup function
    }, [user?.id, assistantRef, aiResponseHasContent]); // Added aiResponseHasContent dependency


    // Derive current workflow step based on state
    const getCurrentStep = useCallback((): WorkflowStep => {
        // Loading states take precedence
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading && currentAiRequestId) return 'generating_ai_response';
        if (isParsing) return 'parsing_response';
        if (assistantLoading && filesParsed) return 'pr_ready'; // Indicates PR/Update loading

        // Check progress states
        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';
        if (aiResponseHasContent) {
            if (!filesParsed) return 'response_pasted'; // Got response, needs parsing
            if (selectedAssistantFiles.size > 0) return 'pr_ready'; // Parsed, files selected for PR/Update
            return 'response_parsed'; // Parsed, but no files selected yet
        }
        if (requestCopied) return 'request_copied'; // Manual path: copied request, waiting for manual paste
        if (kworkInputHasContent) return 'request_written'; // Prompt written, ready to send or copy
        if (selectedFetcherFiles.size > 0) return 'files_selected'; // Files selected in fetcher, ready to add to prompt
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights'; // Files fetched with highlights
        return 'files_fetched'; // Files fetched, no selection/prompt yet
    }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading, isParsing,
        currentAiRequestId,
        primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
    ]);
    const currentStep = getCurrentStep();

    // --- State Updaters (Memoized) ---
    const setFetchStatusCallback = useCallback((status: FetchStatus) => setFetchStatusState(status), []);
    const setRepoUrlEnteredCallback = useCallback((entered: boolean) => setRepoUrlEnteredState(entered), []);
    const setFilesFetchedCallback = useCallback((fetched: boolean, primaryPath: string | null = null, secondaryPaths: string[] = []) => {
        setFilesFetchedState(fetched);
        setPrimaryHighlightedPathState(primaryPath);
        setSecondaryHighlightedPathsState(secondaryPaths);
        // Reset downstream state if fetch is cleared
        if (!fetched) {
            setSelectedFetcherFilesState(new Set());
            setKworkInputHasContentState(false);
            setRequestCopiedState(false);
            setAiResponseHasContentState(false);
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            setAssistantLoadingState(false);
            setIsParsingState(false);
            setCurrentAiRequestIdState(null); // Reset monitored request ID
            if (assistantRef.current) assistantRef.current.setResponseValue("");
        } else {
            setFetchStatusState('success'); // Mark as success if files were fetched
        }
    }, [assistantRef]); // assistantRef dependency for clearing value
    const setSelectedFetcherFilesCallback = useCallback((files: Set<string>) => setSelectedFetcherFilesState(files), []);
    const setKworkInputHasContentCallback = useCallback((hasContent: boolean) => setKworkInputHasContentState(hasContent), []);
    const setRequestCopiedCallback = useCallback((copied: boolean) => setRequestCopiedState(copied), []);
    const setAiResponseHasContentCallback = useCallback((hasContent: boolean) => {
        setAiResponseHasContentState(hasContent);
        // Reset downstream state if response is cleared manually AND we're not waiting for AI
        if (!hasContent && !aiActionLoading) {
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            setCurrentAiRequestIdState(null); // Clear monitored ID
        }
    }, [aiActionLoading]); // Dependency on aiActionLoading
    const setFilesParsedCallback = useCallback((parsed: boolean) => {
        setFilesParsedState(parsed);
        if (!parsed) setSelectedAssistantFilesState(new Set());
        setIsParsingState(false); // Ensure parsing flag is reset
        setAssistantLoadingState(false); // Ensure general assistant loading is reset
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

    // --- Action Triggers (Memoized) ---
    const triggerFetch = useCallback(async (isManualRetry = false) => {
        if (fetcherRef.current) await fetcherRef.current.handleFetch(isManualRetry, targetBranchName);
        else console.warn("triggerFetch: fetcherRef not ready.");
    }, [fetcherRef, targetBranchName]);

    const triggerGetOpenPRs = useCallback(async (repoUrl: string) => {
        if (!repoUrl || !repoUrl.includes('github.com')) {
            toast.error("Укажите валидный URL GitHub репо в настройках.");
            return;
        }
        setLoadingPrsState(true);
        setOpenPrsState([]); // Clear previous PRs
        setTargetBranchNameFromPr(null); // Reset selected PR branch
        setManualBranchNameInput(""); // Clear manual branch input
        try {
            const result = await getOpenPullRequests(repoUrl);
            if (result.success && result.pullRequests) {
                setOpenPrsState(result.pullRequests);
                toast.success(`Загружено ${result.pullRequests.length} открытых PR.`);
            } else {
                toast.error(`Ошибка загрузки PR: ${result.error || 'Неизвестная ошибка'}`);
            }
        } catch (error) {
            toast.error("Критическая ошибка при загрузке PR.");
            console.error("triggerGetOpenPRs error:", error);
        } finally {
            setLoadingPrsState(false);
        }
    }, [setTargetBranchNameFromPr, setManualBranchNameInput]); // Dependencies

    const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger' | 'settings-modal-trigger-assistant') => {
        let element: HTMLElement | null = null;
        // Map semantic names to actual DOM IDs if needed
        const targetId = (id === 'assistant' || id === 'executor') ? 'executor' : (id === 'fetcher' ? 'extractor' : (id === 'settingsModalTrigger' ? 'settings-modal-trigger-assistant' : id));

        switch (targetId) {
            case 'kworkInput': element = kworkInputRef.current; break;
            case 'aiResponseInput': element = aiResponseInputRef.current; break;
            case 'prSection': element = prSectionRef.current; break;
            // Use document.getElementById for sections outside direct refs
            case 'extractor': element = document.getElementById('extractor'); break;
            case 'executor': element = document.getElementById('executor'); break;
            case 'settings-modal-trigger-assistant': element = document.getElementById('settings-modal-trigger-assistant'); break;
        }

        if (element) {
            // Scroll input/textarea elements into center view for better focus
            if (['kworkInput', 'aiResponseInput', 'prSection', 'settings-modal-trigger-assistant'].includes(targetId)) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Scroll sections towards the top, considering potential fixed header offset
                const rect = element.getBoundingClientRect();
                const headerOffset = 80; // Adjust this value based on your header height
                window.scrollTo({ top: window.scrollY + rect.top - headerOffset, behavior: 'smooth' });
            }
        } else {
            console.warn(`scrollToSection: Element with target ID "${targetId}" (mapped from "${id}") not found.`);
        }
    }, [kworkInputRef, aiResponseInputRef, prSectionRef]); // Refs as dependencies

    const triggerSelectHighlighted = useCallback(() => {
        if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles();
        else console.warn("triggerSelectHighlighted: fetcherRef not ready.");
    }, [fetcherRef]);

    const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => {
        if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi, filesToAddParam);
        else console.warn("triggerAddSelectedToKwork: fetcherRef not ready.");
    }, [fetcherRef]);

    const triggerCopyKwork = useCallback(() => {
        if (fetcherRef.current) {
            // Copy, scroll to AI response input, update state
            const copied = fetcherRef.current.handleCopyToClipboard(undefined, true);
            if (copied) {
                setRequestCopiedState(true);
                setAiResponseHasContentState(false); // Clear any old response
                if (assistantRef.current) assistantRef.current.setResponseValue(""); // Clear textarea
                scrollToSection('aiResponseInput'); // Focus on where to paste
            }
        } else {
            console.warn("triggerCopyKwork: fetcherRef not ready.");
        }
    }, [fetcherRef, assistantRef, scrollToSection]); // Dependencies

    // --- triggerAskAi (Updated Flow) ---
    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        if (!fetcherRef.current || !user?.id || !user.dbUser) { // Check for dbUser for better notification
            const m = !user?.id ? "Пользователь не аутентифицирован." : "Компоненты не готовы.";
            toast.error(m);
            return { success: false, error: m };
        }
        const kworkValue = fetcherRef.current.getKworkInputValue();
        if (!kworkValue.trim()) {
            toast.error("Запрос для AI пуст. Напишите что-нибудь!");
            return { success: false, error: "Prompt empty." };
        }

        setAiActionLoadingState(true);       // Set loading state (waiting for DB + Realtime)
        setAiResponseHasContentState(false); // Clear previous response content
        setCurrentAiRequestIdState(null);    // Clear previous request ID being monitored
        if (assistantRef.current) assistantRef.current.setResponseValue(""); // Clear response textarea

        toast.info("Отправка запроса AI в очередь...");
        scrollToSection('executor'); // Scroll to the assistant section

        try {
            // 1. Save the request to the database
            const requestData: AiRequestInsert = {
                prompt: kworkValue,
                user_id: user.id,
                status: 'pending' // Initial status
            };
            const { data, error: insertError } = await supabaseAnon
                .from('ai_requests')
                .insert(requestData)
                .select('id') // Select only the ID of the newly inserted row
                .single(); // Expect only one row

            if (insertError) { throw new Error(`DB Insert Error: ${insertError.message}`); }
            if (!data?.id) { throw new Error("No Request ID returned after insert."); }

            const newRequestId = data.id;
            console.log("AI Request submitted to DB. Monitoring ID:", newRequestId);

            // 2. Notify Admin (You!) via Telegram - Fire and forget
            const userNameOrId = user.dbUser.username || user.dbUser.full_name || user.id;
            const promptExcerpt = kworkValue.substring(0, 300) + (kworkValue.length > 300 ? '...' : '');
            const notificationMessage = `🤖 Новый AI Запрос (#${newRequestId.substring(0, 6)}...)\nОт: ${userNameOrId} (${user.id})\nПромпт:\n\`\`\`\n${promptExcerpt}\n\`\`\``;
            notifyAdmin(notificationMessage).catch(err => console.error("Failed to notify admin:", err)); // Log error if notify fails

            // 3. Set state to monitor Realtime for this ID
            toast.success("Запрос поставлен в очередь! Ожидаем ответ AI... 🤖💭");
            setCurrentAiRequestIdState(newRequestId); // Start monitoring this ID
            // aiActionLoading remains true until Realtime callback updates it

            return { success: true, requestId: newRequestId }; // Indicate success and return the ID

        } catch (error: any) {
            toast.error("Критическая ошибка при отправке запроса AI.");
            console.error("triggerAskAi error:", error);
            setAiActionLoadingState(false); // Stop loading on error
            setCurrentAiRequestIdState(null); // Clear ID on error
            return { success: false, error: error.message ?? "Unknown submit error." };
        }
    }, [fetcherRef, user, assistantRef, scrollToSection]); // Dependencies


    // --- Parse Trigger ---
    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current) {
            setIsParsingState(true);
            setAssistantLoadingState(true); // Also set general assistant loading during parse
            try {
                await assistantRef.current.handleParse(); // Assumes handleParse updates filesParsed state internally or via context setter
            } catch (err) {
                console.error("Error during parsing:", err);
                toast.error("Ошибка при разборе ответа AI.");
                setFilesParsedCallback(false); // Ensure parsed state is false on error
            } finally {
                setIsParsingState(false);
                setAssistantLoadingState(false); // Reset general loading
            }
        } else {
            console.warn("triggerParseResponse: assistantRef not ready.");
        }
    }, [assistantRef, setFilesParsedCallback]); // Use callback setter

    const triggerSelectAllParsed = useCallback(() => {
        if (assistantRef.current) assistantRef.current.selectAllParsedFiles();
        else console.warn("triggerSelectAllParsed: assistantRef not ready.");
    }, [assistantRef]);

    const triggerCreatePR = useCallback(async () => {
        if (assistantRef.current) await assistantRef.current.handleCreatePR();
        else console.warn("triggerCreatePR: assistantRef not ready.");
    }, [assistantRef]);

    const triggerUpdateBranch = useCallback(async (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string): Promise<ReturnType<typeof updateBranch>> => {
        setAssistantLoadingState(true); // Use general assistant loading state
        try {
            console.log(`Context triggerUpdateBranch: Calling action for branch '${branchName}'`);
            const result = await updateBranch(repoUrl, files, commitMessage, branchName);
            if(result.success) {
                toast.success(`Ветка '${branchName}' успешно обновлена!`);
            } else {
                toast.error(`Ошибка обновления ветки '${branchName}': ${result.error}`);
            }
            return result;
        } catch (error) {
            toast.error(`Критическая ошибка обновления ветки '${branchName}'.`);
            console.error("triggerUpdateBranch error:", error);
            return { success: false, error: error instanceof Error ? error.message : "Client-side error." };
        } finally {
            setAssistantLoadingState(false);
        }
    }, []); // Empty dependency array if updateBranch is stable

    const triggerToggleSettingsModal = useCallback(() => setIsSettingsModalOpenState(prev => !prev), []);

    // --- Realtime Subscription Logic ---
    useEffect(() => {
        // If no ID to monitor or no client, clean up any existing channel
        if (!currentAiRequestId || !supabaseAnon) {
            if (realtimeChannelRef.current) {
                console.log(`[RT Cleanup] No request ID or Supabase client. Removing channel: ${realtimeChannelRef.current.topic}`);
                supabaseAnon?.removeChannel(realtimeChannelRef.current).catch(e => console.error("[RT Cleanup] Error removing channel:", e));
                realtimeChannelRef.current = null;
            }
            return;
        }

        const channelId = `ai-request-${currentAiRequestId}`;
        // Avoid re-subscribing if already on the correct channel
        if (realtimeChannelRef.current?.topic === channelId) return;

        // Unsubscribe from the previous channel if switching IDs
        if (realtimeChannelRef.current) {
            console.log(`[RT Switch] Removing old channel: ${realtimeChannelRef.current.topic}`);
            supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => console.error("[RT Switch] Error removing old channel:", e));
        }

        console.log(`[RT Setup] Attempting to subscribe to ${channelId}`);
        const channel = supabaseAnon.channel(channelId)
            .on<AiRequestRecord>( // Type the payload
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_requests',
                    filter: `id=eq.${currentAiRequestId}` // Filter specific request ID
                },
                (payload) => {
                    console.log('[RT Received] AI Request Updated:', payload.new);
                    const updatedRecord = payload.new;

                    // Ensure the update is for the ID we are currently monitoring
                    if (updatedRecord.id !== currentAiRequestIdState) { // Use state variable for check
                        console.log(`[RT Mismatch] Update for ${updatedRecord.id}, but monitoring ${currentAiRequestIdState}. Ignoring.`);
                        return;
                    }

                    if (updatedRecord.status === 'completed') {
                        toast.success("🤖✨ Ответ от AI получен!");
                        if (assistantRef.current) {
                            assistantRef.current.setResponseValue(updatedRecord.response || "");
                        }
                        setAiResponseHasContentState(true);
                        setAiActionLoadingState(false); // Stop loading
                        setCurrentAiRequestIdState(null); // Stop monitoring this ID

                        // Auto-parse after a short delay to allow state updates
                        setTimeout(() => {
                            triggerParseResponse().catch(err => console.error("Error during auto-parsing:", err));
                        }, 300);

                    } else if (updatedRecord.status === 'failed') {
                        const errorMsg = updatedRecord.error_message || 'Неизвестная ошибка AI';
                        toast.error(`❌ Ошибка AI: ${errorMsg}`);
                        setAiActionLoadingState(false); // Stop loading
                        setCurrentAiRequestIdState(null); // Stop monitoring this ID
                    } else if (updatedRecord.status === 'processing') {
                        // Optional: Update toast or UI element to show processing
                        toast.info("⏳ AI всё ещё думает...", { id: `ai-processing-${currentAiRequestId}`, duration: 5000 });
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[RT Status] Successfully subscribed to ${channelId}`);
                } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
                    console.error(`[RT Status] Subscription error for ${channelId}: ${status}`, err);
                    toast.error("Ошибка Realtime подписки.");
                    // Stop loading if subscription fails critically
                    if (currentAiRequestIdState === currentAiRequestId) { // Check if still relevant
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null);
                    }
                } else if (status === 'CLOSED') {
                    console.log(`[RT Status] Channel explicitly closed for ${channelId}`);
                     // If closed unexpectedly while we were loading, reset state
                    if (currentAiRequestIdState === currentAiRequestId) {
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null);
                    }
                }
            });

        realtimeChannelRef.current = channel;

        // Cleanup function: remove the channel when the component unmounts or the ID changes
        return () => {
            if (realtimeChannelRef.current && realtimeChannelRef.current.topic === channelId) {
                console.log(`[RT Cleanup] Removing channel: ${realtimeChannelRef.current.topic}`);
                supabaseAnon.removeChannel(realtimeChannelRef.current).catch(e => console.error("[RT Cleanup] Error removing channel:", e));
                realtimeChannelRef.current = null;
            }
        };
    }, [currentAiRequestId, assistantRef, triggerParseResponse, currentAiRequestIdState]); // Added currentAiRequestIdState to deps for internal checks


    // --- Xuinity Message Logic (Dynamic based on current state) ---
    const getXuinityMessage = useCallback((): string => {
        const effectiveBranch = targetBranchName; // Uses the derived state
        const branchInfo = effectiveBranch ? ` (ветка: ${effectiveBranch})` : '';
        switch (currentStep) {
            case 'idle': return "Инициализация студии...";
            case 'need_repo_url': return "👈 Укажи URL GitHub репозитория в настройках.";
            case 'ready_to_fetch': return repoUrlEntered ? `Готов извлечь файлы${branchInfo}. Жми 'Fetch Files'! 🎣` : "Сначала укажи URL.";
            case 'fetching': return `Извлекаю файлы${branchInfo}... ${fetchStatus === 'retrying' ? '(Повтор...)' : ''} ⏳`;
            case 'fetch_failed': return `Ошибка извлечения${branchInfo}. 😭 Попробовать еще раз?`;
            case 'files_fetched': return `Файлы извлечены${branchInfo}! ✅ Выбери нужные ИЛИ опиши задачу ниже. 👇`;
            case 'files_fetched_highlights': return `Файлы извлечены${branchInfo}. Есть связанные. 🤔 Выбери или опиши задачу.`;
            case 'files_selected': return `Файлы выбраны${branchInfo}! 👍 Добавь в 'Твой Запрос' ИЛИ сразу жми '🤖 Спросить AI'!`;
            case 'request_written': return aiActionLoading ? "Отправка запроса AI..." : "Запрос готов! 🔥 Жми '🤖 Спросить AI' ИЛИ скопируй для Grok.";
            case 'generating_ai_response': return "Запрос в очереди AI. ⏳ Ожидаем магию... (Админ получил уведомление!) ✨"; // Updated message
            case 'request_copied': return "Скопировано! 📋 Жду ответ от внешнего AI. Вставляй результат сюда. 👇";
            case 'response_pasted': return "Ответ AI получен! ✅ Нажми '➡️ Разобрать Ответ' для анализа.";
            case 'parsing_response': return "Разбираю ответ AI... 🧠";
            case 'response_parsed': return "Разобрал! 👀 Проверь изменения, выбери файлы для коммита.";
            case 'pr_ready': return assistantLoading ? (effectiveBranch ? `Обновляю ветку '${effectiveBranch}'...` : "Создаю Pull Request...") : (effectiveBranch ? `Готов обновить ветку '${effectiveBranch}'? 🚀` : "Готов создать Pull Request? ✨");
            default: return "Что будем вайбить дальше?";
        }
    }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, aiActionLoading, targetBranchName, isParsing, currentAiRequestId]);


    // --- Callback for Repo URL update in Assistant ---
    const updateRepoUrlInAssistant = useCallback((url: string) => {
        if (assistantRef.current) assistantRef.current.updateRepoUrl(url);
    }, [assistantRef]);

    // --- Context Value ---
    const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
        secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        loadingPrs, openPrs, targetBranchName, manualBranchName, isSettingsModalOpen, currentAiRequestId, isParsing,
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
        setFetchStatus: setFetchStatusCallback, setRepoUrlEntered: setRepoUrlEnteredCallback,
        setFilesFetched: setFilesFetchedCallback, setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback, setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback, setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback, setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback,
        setTargetBranchName: setTargetBranchNameFromPr, // Corrected setter name for clarity
        setManualBranchName: setManualBranchNameInput,
        setOpenPrs: setOpenPrsCallback, setLoadingPrs: setLoadingPrsCallback,
        setIsSettingsModalOpen: setIsSettingsModalOpenCallback,
        setCurrentAiRequestId: setCurrentAiRequestIdCallback,
        setIsParsing: setIsParsingCallback,
        triggerFetch, triggerGetOpenPRs, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        triggerUpdateBranch, triggerToggleSettingsModal, scrollToSection,
        getXuinityMessage, updateRepoUrlInAssistant,
    };

    return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};