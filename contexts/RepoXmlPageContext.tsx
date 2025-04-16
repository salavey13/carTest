"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAnon } from "@/hooks/supabase"; // Use anon client
import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions';
import type { AiRequestRecord, AiRequestInsert, AiRequestStatus } from '@/types/ai.types'; // Import types
import type { RealtimeChannel } from '@supabase/supabase-js';

// Define Ref Interfaces
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean, branchName?: string | null) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean; // Added optional params
    clearAll: () => void;
    getKworkInputValue: () => string;
}

export interface AICodeAssistantRef {
    handleParse: () => Promise<void>;
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>; // Points to handleCreateOrUpdatePR
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
    assistantLoading: boolean; // Assistant-specific loading (parse, PR)
    aiActionLoading: boolean; // AI request submission/waiting loading
    loadingPrs: boolean;
    openPrs: SimplePullRequest[];
    targetBranchName: string | null; // Final target branch (Manual > PR > Null/Default)
    manualBranchName: string; // User manual input
    isSettingsModalOpen: boolean; // Modal state
    currentAiRequestId: string | null; // ID of the request being monitored
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
    setIsSettingsModalOpen: (isOpen: boolean) => void; // Modal setter
    setCurrentAiRequestId: (id: string | null) => void; // Setter for AI request ID
    setIsParsing: (parsing: boolean) => void;

    // Action Triggers
    triggerFetch: (isManualRetry?: boolean) => Promise<void>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
    triggerCopyKwork: () => void;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>; // Now returns request info
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreatePR: () => Promise<void>; // Points to assistant's handleCreateOrUpdatePR
    triggerUpdateBranch: (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string) => Promise<ReturnType<typeof updateBranch>>; // Specific update action trigger
    triggerToggleSettingsModal: () => void; // Modal toggle trigger
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

    // Effect to update targetBranchName
    useEffect(() => {
        const trimmedManual = manualBranchName.trim();
        setTargetBranchNameState(trimmedManual || selectedPrBranch);
    }, [manualBranchName, selectedPrBranch]);

     // Effect: Load Initial AI Request State from user metadata
    useEffect(() => {
        let isMounted = true;
        if (!user?.id) { setCurrentAiRequestIdState(null); setAiActionLoadingState(false); return; }
        const fetchInitialAiState = async () => {
            console.log("[Init Effect] Fetching initial user data for AI state...");
            try {
                const { data: userData, error: userError } = await supabaseAnon.from('users').select('metadata').eq('user_id', user.id).single();
                if (userError && userError.code !== 'PGRST116') { console.error("[Init Effect] Error fetching user metadata:", userError); return; }

                const lastRequestId = userData?.metadata?.last_ai_request_id;
                if (lastRequestId && typeof lastRequestId === 'string') {
                    console.log(`[Init Effect] Found last AI request ID: ${lastRequestId}`);
                    const { data: reqData, error: reqError } = await supabaseAnon.from('ai_requests').select('status, response, error_message').eq('id', lastRequestId).single();
                    if (reqError) { console.error(`[Init Effect] Error fetching status for ${lastRequestId}:`, reqError); return; }
                    if (!isMounted) return;

                    console.log(`[Init Effect] Status for ${lastRequestId}: ${reqData.status}`);
                    if (reqData.status === 'pending' || reqData.status === 'processing') {
                        console.log(`[Init Effect] Last request ${lastRequestId} still ${reqData.status}. Setting state.`);
                        setCurrentAiRequestIdState(lastRequestId);
                        setAiActionLoadingState(true); // Start loading as we're waiting
                        setAiResponseHasContentState(false);
                         if (assistantRef.current) assistantRef.current.setResponseValue("");
                    } else if (reqData.status === 'completed' && !aiResponseHasContent) {
                         console.log(`[Init Effect] Last request ${lastRequestId} completed. Populating.`);
                         if (assistantRef.current) assistantRef.current.setResponseValue(reqData.response || "");
                         setAiResponseHasContentState(true); // Mark as having content
                         setCurrentAiRequestIdState(null); // Clear the monitored ID
                         setAiActionLoadingState(false); // Not waiting anymore
                    } else {
                         console.log(`[Init Effect] Last request ${lastRequestId} has status ${reqData.status}. Resetting.`);
                         setCurrentAiRequestIdState(null);
                         setAiActionLoadingState(false);
                    }
                } else { console.log("[Init Effect] No last AI request ID found."); setCurrentAiRequestIdState(null); setAiActionLoadingState(false); }
            } catch (error) { console.error("[Init Effect] Unexpected error:", error); if (!isMounted) return; setCurrentAiRequestIdState(null); setAiActionLoadingState(false); }
        };
        fetchInitialAiState();
        return () => { isMounted = false; };
    }, [user?.id, assistantRef, aiResponseHasContent]); // Depend on assistantRef and aiResponseHasContent


    // Derive current workflow step
    const getCurrentStep = useCallback((): WorkflowStep => {
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading && currentAiRequestId) return 'generating_ai_response'; // Explicitly waiting for Realtime
        if (isParsing) return 'parsing_response';
        if (assistantLoading && filesParsed) return 'pr_ready'; // PR/Update loading

        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';
        if (aiResponseHasContent) {
             if (!filesParsed) return 'response_pasted';
             if (selectedAssistantFiles.size > 0) return 'pr_ready';
             return 'response_parsed';
        }
        if (requestCopied) return 'request_copied'; // Manual copy path
        if (kworkInputHasContent) return 'request_written'; // Ready to submit or copy
        if (selectedFetcherFiles.size > 0) return 'files_selected';
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights';
        return 'files_fetched';
    }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading, isParsing,
        currentAiRequestId, // <-- Added dependency
        primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
    ]);
    const currentStep = getCurrentStep();

    // --- Updaters ---
    const setFetchStatusCallback = useCallback((status: FetchStatus) => setFetchStatusState(status), []);
    const setRepoUrlEnteredCallback = useCallback((entered: boolean) => setRepoUrlEnteredState(entered), []);
    const setFilesFetchedCallback = useCallback((fetched: boolean, primaryPath: string | null = null, secondaryPaths: string[] = []) => {
        setFilesFetchedState(fetched);
        setPrimaryHighlightedPathState(primaryPath);
        setSecondaryHighlightedPathsState(secondaryPaths);
        if (!fetched) {
            setSelectedFetcherFilesState(new Set()); setKworkInputHasContentState(false);
            setRequestCopiedState(false); setAiResponseHasContentState(false);
            setFilesParsedState(false); setSelectedAssistantFilesState(new Set());
            setAssistantLoadingState(false); setIsParsingState(false);
             if (assistantRef.current) assistantRef.current.setResponseValue("");
        } else { setFetchStatusState('success'); }
    }, [assistantRef]);
    const setSelectedFetcherFilesCallback = useCallback((files: Set<string>) => setSelectedFetcherFilesState(files), []);
    const setKworkInputHasContentCallback = useCallback((hasContent: boolean) => setKworkInputHasContentState(hasContent), []);
    const setRequestCopiedCallback = useCallback((copied: boolean) => setRequestCopiedState(copied), []);
    const setAiResponseHasContentCallback = useCallback((hasContent: boolean) => {
        setAiResponseHasContentState(hasContent);
        if (!hasContent && !aiActionLoading) { // Don't clear parsed state if we are just waiting for AI
             setFilesParsedState(false); setSelectedAssistantFilesState(new Set());
             setCurrentAiRequestIdState(null); // Clear request ID if response cleared manually
        }
    }, [aiActionLoading]);
    const setFilesParsedCallback = useCallback((parsed: boolean) => {
        setFilesParsedState(parsed); if (!parsed) setSelectedAssistantFilesState(new Set());
        setIsParsingState(false); setAssistantLoadingState(false);
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

    // --- Action Triggers ---
    const triggerFetch = useCallback(async (isManualRetry = false) => { if (fetcherRef.current) await fetcherRef.current.handleFetch(isManualRetry, targetBranchName); else console.warn("triggerFetch: fetcherRef not ready."); }, [fetcherRef, targetBranchName]);
    const triggerGetOpenPRs = useCallback(async (repoUrl: string) => { if (!repoUrl || !repoUrl.includes('github.com')) { toast.error("Укажите валидный URL GitHub репо в настройках."); return; } setLoadingPrsState(true); setOpenPrsState([]); setTargetBranchNameFromPr(null); setManualBranchNameInput(""); try { const result = await getOpenPullRequests(repoUrl); if (result.success && result.pullRequests) { setOpenPrsState(result.pullRequests); toast.success(`Загружено ${result.pullRequests.length} PR.`); } else { toast.error(`Ошибка PR: ${result.error || '?'}`); } } catch (error) { toast.error("Крит. ошибка PR."); console.error(error); } finally { setLoadingPrsState(false); } }, [setTargetBranchNameFromPr, setManualBranchNameInput]);
    const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger' | 'settings-modal-trigger-assistant') => { let element: HTMLElement | null = null; const targetId = (id === 'assistant' || id === 'executor') ? 'executor' : (id === 'fetcher' ? 'extractor' : (id === 'settingsModalTrigger' ? 'settings-modal-trigger-assistant' : id)); switch(targetId) { case 'kworkInput': element = kworkInputRef.current; break; case 'aiResponseInput': element = aiResponseInputRef.current; break; case 'prSection': element = prSectionRef.current; break; case 'extractor': element = document.getElementById('extractor'); break; case 'executor': element = document.getElementById('executor'); break; case 'settings-modal-trigger-assistant': element = document.getElementById('settings-modal-trigger-assistant'); break; } if (element) { if (['kworkInput', 'aiResponseInput', 'prSection', 'settings-modal-trigger-assistant'].includes(targetId)) element.scrollIntoView({ behavior: 'smooth', block: 'center' }); else { const rect = element.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' }); } } else console.warn(`scrollToSection: Element "${targetId}" not found.`); }, [kworkInputRef, aiResponseInputRef, prSectionRef]);
    const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted: fetcherRef not ready."); }, [fetcherRef]);
    const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => { if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi, filesToAddParam); else console.warn("triggerAddSelectedToKwork: fetcherRef not ready."); }, [fetcherRef]);
    const triggerCopyKwork = useCallback(() => { if (fetcherRef.current) { const copied = fetcherRef.current.handleCopyToClipboard(undefined, true); if (copied) { setRequestCopiedState(true); setAiResponseHasContentState(false); if (assistantRef.current) assistantRef.current.setResponseValue(""); } } else console.warn("triggerCopyKwork: fetcherRef not ready."); }, [fetcherRef, assistantRef]);

    // --- Modified triggerAskAi ---
    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        if (!fetcherRef.current || !user?.id) { const m = !user?.id ? "Не аутентифицирован." : "Компоненты не готовы."; toast.error(m); return { success: false, error: m }; }
        const kworkValue = fetcherRef.current.getKworkInputValue(); if (!kworkValue.trim()) { toast.error("Нет запроса для AI."); return { success: false, error: "Prompt empty." }; }

        setAiActionLoadingState(true); // Start loading (waiting for DB insert + Realtime)
        setAiResponseHasContentState(false); // Clear previous response
        setCurrentAiRequestIdState(null); // Clear previous ID
        if (assistantRef.current) assistantRef.current.setResponseValue(""); // Clear textarea

        toast.info("Отправка запроса AI в очередь...");
        scrollToSection('executor');

        try {
            const requestData: AiRequestInsert = { prompt: kworkValue, user_id: user.id, status: 'pending' };
            const { data, error } = await supabaseAnon.from('ai_requests').insert(requestData).select('id').single();

            if (error) { throw new Error(`DB Insert Error: ${error.message}`); }
            if (!data?.id) { throw new Error("No Request ID returned after insert."); }

            const newRequestId = data.id;
            console.log("AI Request submitted. ID:", newRequestId);
            toast.success("Запрос отправлен! Ожидание ответа AI...");
            setCurrentAiRequestIdState(newRequestId); // Set the ID to monitor
            // aiActionLoading remains true until Realtime confirms completion/failure
            return { success: true, requestId: newRequestId };

        } catch (error: any) {
            toast.error("Критическая ошибка при отправке запроса."); console.error("triggerAskAi error:", error);
            setAiActionLoadingState(false); // Stop loading on error
            setCurrentAiRequestIdState(null); // Clear ID on error
            return { success: false, error: error.message ?? "Unknown submit error." };
        }
    }, [fetcherRef, user?.id, assistantRef, scrollToSection]); // Dependencies

    // --- Parse Trigger ---
    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current) {
            setIsParsingState(true); setAssistantLoadingState(true);
            try { await assistantRef.current.handleParse(); }
            catch (err) { console.error("Error during parsing:", err); }
            finally { setIsParsingState(false); setAssistantLoadingState(false); } // Ensure states are reset
        } else console.warn("triggerParseResponse: assistantRef not ready.");
    }, [assistantRef]);
    const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed: assistantRef not ready."); }, [assistantRef]);
    const triggerCreatePR = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleCreatePR(); else console.warn("triggerCreatePR: assistantRef not ready."); }, [assistantRef]);
    const triggerUpdateBranch = useCallback(async (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string): Promise<ReturnType<typeof updateBranch>> => { setAssistantLoadingState(true); try { console.log(`Context triggerUpdateBranch: Calling action for branch '${branchName}'`); const result = await updateBranch(repoUrl, files, commitMessage, branchName); return result; } catch (error) { toast.error(`Крит. ошибка обновления ветки.`); console.error("triggerUpdateBranch error:", error); return { success: false, error: "Client error." }; } finally { setAssistantLoadingState(false); } }, []);
    const triggerToggleSettingsModal = useCallback(() => setIsSettingsModalOpenState(prev => !prev), []);

    // --- Realtime Subscription ---
    useEffect(() => {
        if (!currentAiRequestId || !supabaseAnon) {
             if (realtimeChannelRef.current) { console.log(`[RT Cleanup] No request ID or Supabase. Removing channel: ${realtimeChannelRef.current.topic}`); supabaseAnon?.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
             return;
        }

        const channelId = `ai-request-${currentAiRequestId}`;
        if (realtimeChannelRef.current?.topic === channelId) return; // Already subscribed to this request

        // Unsubscribe from previous channel if it exists
        if (realtimeChannelRef.current) { console.log(`[RT Switch] Removing old channel: ${realtimeChannelRef.current.topic}`); supabaseAnon.removeChannel(realtimeChannelRef.current); }

        console.log(`[RT Setup] Subscribing to ${channelId}`);
        const channel = supabaseAnon.channel(channelId)
            .on<AiRequestRecord>( 'postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_requests', filter: `id=eq.${currentAiRequestId}` },
                (payload) => {
                    console.log('[RT Received] AI Request Updated:', payload.new);
                    const updatedRecord = payload.new;
                    // Double-check ID match against current state
                    if (updatedRecord.id !== currentAiRequestIdState) { console.log(`[RT Mismatch] Update for ${updatedRecord.id}, but monitoring ${currentAiRequestIdState}. Ignoring.`); return; }

                    if (updatedRecord.status === 'completed') {
                        toast.success("🤖✨ Ответ от AI получен!");
                        if (assistantRef.current) assistantRef.current.setResponseValue(updatedRecord.response || "");
                        setAiResponseHasContentState(true);
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null); // Stop monitoring
                         // Auto-parse after a short delay
                         setTimeout(() => { triggerParseResponse().catch(err => console.error("Error auto-parsing:", err)); }, 300);
                    } else if (updatedRecord.status === 'failed') {
                        toast.error(`❌ Ошибка AI: ${updatedRecord.error_message || 'Неизвестно'}`);
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null); // Stop monitoring
                    } else if (updatedRecord.status === 'processing') {
                        toast.info("⏳ AI обрабатывает...", { duration: 1500 });
                    }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') console.log(`[RT Status] Subscribed to ${channelId}`);
                 else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) { console.error(`[RT Status] Error for ${channelId}: ${status}`, err); toast.error("Realtime ошибка."); setAiActionLoadingState(false); setCurrentAiRequestIdState(null); }
                 else if (status === 'CLOSED') console.log(`[RT Status] Channel closed for ${channelId}`);
             });
        realtimeChannelRef.current = channel;

        return () => { console.log(`[RT Cleanup] Removing channel: ${channel.topic}`); supabaseAnon.removeChannel(channel).catch(e => console.error("Error removing channel:", e)); if (realtimeChannelRef.current === channel) realtimeChannelRef.current = null; };
    }, [currentAiRequestId, assistantRef, triggerParseResponse]); // Rerun when ID changes


    // --- Xuinity Message Logic ---
    const getXuinityMessage = useCallback((): string => {
       const effectiveBranch = targetBranchName; const branchInfo = effectiveBranch ? ` (ветка: ${effectiveBranch})` : '';
       switch (currentStep) {
          case 'idle': return "Контекст инициализируется...";
          case 'need_repo_url': return "Укажи URL репозитория в настройках.";
          case 'ready_to_fetch': return repoUrlEntered ? `Готов извлечь файлы${branchInfo}. Жми Fetch!` : "Сначала укажи URL.";
          case 'fetching': return `Извлекаю файлы${branchInfo}... ${fetchStatus === 'retrying' ? '(Повтор...)' : ''} ⏳`;
          case 'fetch_failed': return `Не удалось извлечь файлы${branchInfo}. 😢 Попробовать еще раз?`;
          case 'files_fetched': return `Файлы извлечены${branchInfo}! Выбери нужные или опиши задачу.`;
          case 'files_fetched_highlights': return `Файлы извлечены${branchInfo}. Есть связанные.`;
          case 'files_selected': return `Файлы выбраны${branchInfo}! Добавь в запрос ИЛИ жми '🤖 Спросить AI'!`;
          case 'request_written': return aiActionLoading ? "Отправка запроса AI..." : "Запрос готов! Жми '🤖 Спросить AI' ИЛИ скопируй.";
          case 'generating_ai_response': return "Запрос в очереди. Ожидание ответа AI... 🤖💭";
          case 'request_copied': return "Скопировано! Жду ответ от AI. Вставляй в Ассистента.";
          case 'response_pasted': return "Ответ получен! Нажми '➡️' для разбора.";
          case 'parsing_response': return "Разбираю ответ AI... 🧠";
          case 'response_parsed': return "Разобрал! Проверь, выбери файлы для PR/ветки.";
          case 'pr_ready': return assistantLoading ? (effectiveBranch ? "Обновляю ветку..." : "Создаю PR...") : (effectiveBranch ? `Готов обновить ветку '${effectiveBranch}'?` : "Готов создать Pull Request?");
          default: return "Что делаем дальше?";
        }
    }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, aiActionLoading, targetBranchName, isParsing, currentAiRequestId]);


    // --- Callback for Repo URL update ---
    const updateRepoUrlInAssistant = useCallback((url: string) => { if(assistantRef.current) assistantRef.current.updateRepoUrl(url); }, [assistantRef]);

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
        setTargetBranchName: setTargetBranchNameFromPr,
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