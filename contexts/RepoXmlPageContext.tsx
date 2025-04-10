// Full version
"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAnon } from "@/hooks/supabase"; // Use anon client for most ops if RLS is off
import type { AiRequestRecord, AiRequestInsert, AiRequestStatus } from '@/types/ai.types'; // Assuming types are defined
import type { RealtimeChannel } from '@supabase/supabase-js';
// Assuming you have a type for your public.users table
// import type { UserProfile } from '@/types/user.types'; // Example type import

// Define Ref Interfaces
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>; // Added filesToAddParam for fetch auto-add
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    clearAll: () => void;
    getKworkInputValue: () => string;
}

export interface AICodeAssistantRef {
    handleParse: () => Promise<void>;
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>;
    setResponseValue: (value: string) => void;
}

// Fetch status type
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';

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
    currentAiRequestId: string | null; // ID of the request being monitored

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
    setCurrentAiRequestId: (id: string | null) => void;

    // Action Triggers
    triggerFetch: (isManualRetry?: boolean) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>; // Added filesToAddParam
    triggerCopyKwork: () => void;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreatePR: () => Promise<void>;
    scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor') => void;

    // Messages
    getXuinityMessage: () => string;
}

// Context Creation
const RepoXmlPageContext = createContext<RepoXmlPageContextType | undefined>(undefined);

// Hook for using context
export const useRepoXmlPageContext = () => {
    const context = useContext(RepoXmlPageContext);
    if (context === undefined) {
       console.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.');
       const warn = (name: string) => () => { console.warn(`Context not available: ${name} called.`); return Promise.resolve({ success: false, error: 'Context unavailable' }); };
       const warnSync = (name: string) => () => { console.warn(`Context not available: ${name} called.`); };
       return {
          currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false,
          primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
          kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
          filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false,
          currentAiRequestId: null,
          fetcherRef: { current: null }, assistantRef: { current: null }, kworkInputRef: { current: null },
          aiResponseInputRef: { current: null }, prSectionRef: { current: null },
          setFetchStatus: warnSync('setFetchStatus'), setRepoUrlEntered: warnSync('setRepoUrlEntered'),
          setFilesFetched: warnSync('setFilesFetched'), setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
          setKworkInputHasContent: warnSync('setKworkInputHasContent'), setRequestCopied: warnSync('setRequestCopied'),
          setAiResponseHasContent: warnSync('setAiResponseHasContent'), setFilesParsed: warnSync('setFilesParsed'),
          setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'), setAssistantLoading: warnSync('setAssistantLoading'),
          setAiActionLoading: warnSync('setAiActionLoading'),
          setCurrentAiRequestId: warnSync('setCurrentAiRequestId'),
          triggerFetch: warn('triggerFetch'), triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
          triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
          triggerAskAi: warn('triggerAskAi'),
          triggerParseResponse: warn('triggerParseResponse'), triggerSelectAllParsed: warnSync('triggerSelectAllParsed'),
          triggerCreatePR: warn('triggerCreatePR'), scrollToSection: warnSync('scrollToSection'),
          getXuinityMessage: () => "Context unavailable",
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
    const [assistantLoading, setAssistantLoadingState] = useState(false);
    const [aiActionLoading, setAiActionLoadingState] = useState(false);
    const [currentAiRequestId, setCurrentAiRequestIdState] = useState<string | null>(null);

    const { user } = useAppContext(); // Get user context (contains user_id/chat_id as string)
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

    // Effect: Load Initial AI Request State from user metadata
    useEffect(() => {
        let isMounted = true;
        if (!user?.id) {
            setCurrentAiRequestIdState(null);
            setAiActionLoadingState(false);
            return;
        };

        const fetchInitialAiState = async () => {
            console.log("Fetching initial user data for AI state...");
            try {
                const { data: userData, error: userError } = await supabaseAnon
                    .from('users') // public.users
                    .select('metadata')
                    .eq('user_id', user.id) // text user_id
                    .single();

                if (userError) {
                    console.error("Error fetching user metadata:", userError);
                    return;
                }

                const lastRequestId = userData?.metadata?.last_ai_request_id;

                if (lastRequestId && typeof lastRequestId === 'string') {
                    console.log(`Found last AI request ID in metadata: ${lastRequestId}`);
                    const { data: requestData, error: requestError } = await supabaseAnon
                        .from('ai_requests')
                        .select('status, response, error_message')
                        .eq('id', lastRequestId)
                        .single();

                    if (requestError) {
                        console.error(`Error fetching status for last AI request ${lastRequestId}:`, requestError);
                        return;
                    }

                    if (!isMounted) return;

                    if (requestData.status === 'pending' || requestData.status === 'processing') {
                        console.log(`Last request ${lastRequestId} is still ${requestData.status}. Monitoring.`);
                        setCurrentAiRequestIdState(lastRequestId);
                        setAiActionLoadingState(true);
                        setAiResponseHasContentState(false);
                         if (assistantRef.current) assistantRef.current.setResponseValue("");
                    } else if (requestData.status === 'completed' && !aiResponseHasContent) {
                         console.log(`Last request ${lastRequestId} was completed. Populating response.`);
                         if (assistantRef.current) assistantRef.current.setResponseValue(requestData.response || "");
                         setAiResponseHasContentState(true);
                         setCurrentAiRequestIdState(null);
                         setAiActionLoadingState(false);
                    } else if (requestData.status === 'failed') {
                         console.log(`Last request ${lastRequestId} failed.`);
                         setCurrentAiRequestIdState(null);
                         setAiActionLoadingState(false);
                    } else {
                         setCurrentAiRequestIdState(null);
                         setAiActionLoadingState(false);
                    }

                } else {
                    console.log("No last AI request ID found in user metadata.");
                    setCurrentAiRequestIdState(null);
                    setAiActionLoadingState(false);
                }

            } catch (error) {
                console.error("Unexpected error fetching initial AI state:", error);
                 if (!isMounted) return;
                setCurrentAiRequestIdState(null);
                setAiActionLoadingState(false);
            }
        };

        fetchInitialAiState();

        return () => { isMounted = false; };
    }, [user?.id]); // Rerun when user ID changes

    // Derive current workflow step
    const getCurrentStep = useCallback((): WorkflowStep => {
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading) {
            if (currentAiRequestId) return 'generating_ai_response';
             if (kworkInputHasContent && !currentAiRequestId) return 'request_written'; // Ready to submit
        }
        if (assistantLoading) {
            if (!filesParsed) return 'parsing_response';
            return 'pr_ready';
        }
        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';
        if (aiResponseHasContent) {
             if (!filesParsed) return 'response_pasted';
             if (selectedAssistantFiles.size === 0) return 'response_parsed';
             return 'pr_ready';
        }
        if (requestCopied) return 'request_copied';
        if (kworkInputHasContent) return 'request_written';
        if (selectedFetcherFiles.size > 0) return 'files_selected';
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights';
        return 'files_fetched';
    }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading,
        currentAiRequestId, primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
    ]);

    const currentStep = getCurrentStep();

    // --- Updaters (Memoized Callbacks) ---
    const setFetchStatusCallback = useCallback((status: FetchStatus) => setFetchStatusState(status), []);
    const setRepoUrlEnteredCallback = useCallback((entered: boolean) => setRepoUrlEnteredState(entered), []);
    const setFilesFetchedCallback = useCallback((fetched: boolean, primaryPath: string | null = null, secondaryPaths: string[] = []) => {
        setFilesFetchedState(fetched);
        setPrimaryHighlightedPathState(primaryPath);
        setSecondaryHighlightedPathsState(secondaryPaths);
        if (!fetched) {
            setSelectedFetcherFilesState(new Set());
            setKworkInputHasContentState(false);
            setRequestCopiedState(false);
            setAiResponseHasContentState(false);
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            setAssistantLoadingState(false);
             if (assistantRef.current) assistantRef.current.setResponseValue("");
            // Let Realtime cleanup handle channel removal if needed upon state change
        } else {
            setFetchStatusState('success');
        }
      }, [assistantRef]);
    const setSelectedFetcherFilesCallback = useCallback((files: Set<string>) => setSelectedFetcherFilesState(files), []);
    const setKworkInputHasContentCallback = useCallback((hasContent: boolean) => setKworkInputHasContentState(hasContent), []);
    const setRequestCopiedCallback = useCallback((copied: boolean) => setRequestCopiedState(copied), []);
    const setAiResponseHasContentCallback = useCallback((hasContent: boolean) => {
        setAiResponseHasContentState(hasContent);
        if (!hasContent) { setFilesParsedState(false); setSelectedAssistantFilesState(new Set()); }
    }, []);
    const setFilesParsedCallback = useCallback((parsed: boolean) => {
        setFilesParsedState(parsed);
        if (!parsed) { setSelectedAssistantFilesState(new Set()); }
        setAssistantLoadingState(false);
    }, []);
    const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
    const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);
    const setAiActionLoadingCallback = useCallback((loading: boolean) => setAiActionLoadingState(loading), []);
    const setCurrentAiRequestIdCallback = useCallback((id: string | null) => setCurrentAiRequestIdState(id), []);


    // --- Action Triggers (Memoized Callbacks) ---
    const triggerFetch = useCallback(async (isManualRetry = false) => { if (fetcherRef.current) await fetcherRef.current.handleFetch(isManualRetry); else console.warn("triggerFetch called but fetcherRef is not yet available."); }, [fetcherRef]);
    const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted called but fetcherRef is not yet available."); }, [fetcherRef]);
    const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => { if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi, filesToAddParam); else console.warn("triggerAddSelectedToKwork called but fetcherRef is not yet available."); }, [fetcherRef]);
    const triggerCopyKwork = useCallback(() => { if (fetcherRef.current) { const copied = fetcherRef.current.handleCopyToClipboard(); if (copied) { setRequestCopiedState(true); setAiResponseHasContentState(false); if (assistantRef.current) assistantRef.current.setResponseValue(""); } } else console.warn("triggerCopyKwork called but fetcherRef is not yet available."); }, [fetcherRef, assistantRef]);

    // Trigger AI Request Submission
    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        if (!fetcherRef.current || !user?.id) {
            const errorMsg = !user?.id ? "Пользователь не аутентифицирован." : "Компоненты еще не готовы.";
            toast.error(errorMsg);
            console.warn(`triggerAskAi failed: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
        const kworkValue = fetcherRef.current.getKworkInputValue();
        if (!kworkValue.trim()) {
            toast.error("Нет запроса для отправки AI.");
            return { success: false, error: "Prompt is empty." };
        }

        setAiActionLoadingState(true);
        setAiResponseHasContentState(false);
        setCurrentAiRequestIdState(null);
        if (assistantRef.current) assistantRef.current.setResponseValue("");

        toast.info("Отправка запроса AI в очередь...");
        scrollToSection('executor');

        try {
            const requestData: AiRequestInsert = {
                prompt: kworkValue,
                user_id: user.id, // text user_id
                status: 'pending',
            };

            const { data, error } = await supabaseAnon
                .from('ai_requests')
                .insert(requestData)
                .select('id')
                .single();

            if (error) {
                console.error("Error inserting AI request:", error);
                toast.error(`Ошибка отправки запроса: ${error.message}`);
                setAiActionLoadingState(false);
                return { success: false, error: error.message };
            }
            if (!data?.id) { throw new Error("Request ID not returned after insert."); }

            const newRequestId = data.id;
            console.log("AI Request submitted. Request ID:", newRequestId);
            toast.success("Запрос отправлен! Ожидание ответа AI...");
            setCurrentAiRequestIdState(newRequestId);

            return { success: true, requestId: newRequestId };

        } catch (error: any) {
            toast.error("Критическая ошибка при отправке запроса AI.");
            console.error("triggerAskAi critical error:", error);
            setAiActionLoadingState(false);
            return { success: false, error: error.message ?? "Unknown submission error." };
        }
    }, [fetcherRef, user?.id, assistantRef, scrollToSection]);

    const triggerParseResponse = useCallback(async () => { if (assistantRef.current) { setAssistantLoadingState(true); await assistantRef.current.handleParse(); } else { console.warn("triggerParseResponse called but assistantRef is not yet available."); } }, [assistantRef]);
    const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed called but assistantRef is not yet available."); }, [assistantRef]);
    const triggerCreatePR = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleCreatePR(); else console.warn("triggerCreatePR called but assistantRef is not yet available."); }, [assistantRef]);
    const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor') => {
       let element: HTMLElement | null = null;
       const targetId = (id === 'assistant' || id === 'executor') ? 'executor' : (id === 'fetcher' ? 'extractor' : id);
       switch(targetId) { case 'kworkInput': element = kworkInputRef.current; break; case 'aiResponseInput': element = aiResponseInputRef.current; break; case 'prSection': element = prSectionRef.current; break; case 'extractor': element = document.getElementById('extractor'); break; case 'executor': element = document.getElementById('executor'); break; }
       if (element) { if (targetId === 'kworkInput' || targetId === 'aiResponseInput' || targetId === 'prSection') { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else { const rect = element.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' }); } }
       else { console.warn(`scrollToSection: Element for id "${targetId}" (mapped from "${id}") not found.`); }
    }, [kworkInputRef, aiResponseInputRef, prSectionRef]);


    // Effect: Realtime Subscription for AI Request Updates
    useEffect(() => {
        if (!currentAiRequestId) {
            if (realtimeChannelRef.current) {
                console.log(`[Realtime Effect] Removing channel because currentAiRequestId is null.`);
                supabaseAnon.removeChannel(realtimeChannelRef.current);
                realtimeChannelRef.current = null;
            }
            return;
        }

        if (realtimeChannelRef.current?.topic === `realtime:public:ai_requests:id=eq.${currentAiRequestId}`) {
            return; // Already subscribed
        }

        if (realtimeChannelRef.current) {
             console.log(`[Realtime Effect] Removing previous channel: ${realtimeChannelRef.current.topic}`);
             supabaseAnon.removeChannel(realtimeChannelRef.current);
             realtimeChannelRef.current = null;
        }

        console.log(`[Realtime Effect] Setting up subscription for AI request ID: ${currentAiRequestId}`);
        const requestIdToMonitor = currentAiRequestId; // Capture the ID for the callback/cleanup

        const channel = supabaseAnon.channel(`ai-request-${requestIdToMonitor}`)
            .on<AiRequestRecord>(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'ai_requests', filter: `id=eq.${requestIdToMonitor}` },
                (payload) => {
                    console.log('[Realtime] AI Request Updated:', payload.new);
                    const updatedRecord = payload.new;

                    // Double-check if the update is for the request we are currently monitoring state-wise
                    if (updatedRecord.id !== currentAiRequestIdState) {
                         console.log(`[Realtime] Received update for ${updatedRecord.id}, but state is now monitoring ${currentAiRequestIdState}. Ignoring.`);
                         return;
                    }

                    if (updatedRecord.status === 'completed') {
                        toast.success("🤖✨ Ответ от AI получен!");
                        if (assistantRef.current) {
                            assistantRef.current.setResponseValue(updatedRecord.response || "");
                            setTimeout(() => {
                                triggerParseResponse().catch(err => console.error("Error auto-triggering parse:", err));
                            }, 200);
                        }
                        setAiResponseHasContentState(true);
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null);
                        // Explicitly remove this channel now
                        supabaseAnon.removeChannel(channel).catch(e => console.error("Error removing channel on complete:", e));
                        realtimeChannelRef.current = null; // Clear ref
                        console.log(`[Realtime] Unsubscribed from ${updatedRecord.id} (completed).`);

                    } else if (updatedRecord.status === 'failed') {
                        toast.error(`❌ Ошибка обработки AI: ${updatedRecord.error_message || 'Неизвестная ошибка'}`);
                        setAiActionLoadingState(false);
                        setCurrentAiRequestIdState(null);
                        supabaseAnon.removeChannel(channel).catch(e => console.error("Error removing channel on fail:", e));
                        realtimeChannelRef.current = null;
                        console.log(`[Realtime] Unsubscribed from ${updatedRecord.id} (failed).`);

                    } else if (updatedRecord.status === 'processing') {
                        toast.info("⏳ AI обрабатывает ваш запрос...", { duration: 2000 });
                    }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log(`[Realtime] Successfully subscribed for request ${requestIdToMonitor}`);
                 } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error(`[Realtime] Subscription Error for ${requestIdToMonitor}:`, status, err);
                    toast.error("Ошибка Realtime подписки.");
                    setAiActionLoadingState(false);
                    // Only clear the ID if it matches the one causing the error
                    if (currentAiRequestIdState === requestIdToMonitor) {
                        setCurrentAiRequestIdState(null);
                    }
                    realtimeChannelRef.current = null; // Clear ref on error
                 } else if (status === 'CLOSED') {
                     console.log(`[Realtime] Channel closed for request ${requestIdToMonitor}`);
                 }
             });

        realtimeChannelRef.current = channel;

        // Cleanup Function
        return () => {
            // Ensure we remove the correct channel instance on cleanup
            console.log(`[Realtime Effect Cleanup] Attempting to remove channel for request ${requestIdToMonitor}`);
            supabaseAnon.removeChannel(channel) // Use the captured channel instance
                .catch(error => console.error("Error removing channel on cleanup:", error));
            // Clear ref only if it's the one we are cleaning up
            if (realtimeChannelRef.current === channel) {
                realtimeChannelRef.current = null;
            }
        };
    // Depend on currentAiRequestId to trigger subscribe/unsubscribe
    // assistantRef and triggerParseResponse are stable or wrapped in useCallback
    }, [currentAiRequestId, assistantRef, triggerParseResponse]);


    // --- Xuinity Message Logic ---
    const getXuinityMessage = useCallback((): string => {
       switch (currentStep) {
          case 'idle': return "Контекст инициализируется...";
          case 'need_repo_url': return "Укажи URL репозитория в Экстракторе.";
          case 'ready_to_fetch': return repoUrlEntered ? "Нажми 'Извлечь файлы'!" : "Сначала укажи URL репозитория.";
          case 'fetching': return `Извлекаю файлы... ${fetchStatus === 'retrying' ? '(Попытка снова...)' : ''} ⏳`;
          case 'fetch_failed': return "Не удалось извлечь файлы. 😢 Попробовать еще раз?";
          case 'files_fetched': return "Файлы извлечены! Выбери нужные или опиши задачу.";
          case 'files_fetched_highlights': return "Файлы извлечены. Есть связанные - выбрать их или иди к списку.";
          case 'files_selected': return "Файлы выбраны! Добавь их в запрос ИЛИ нажми '🤖 Спросить AI'!";
          case 'request_written': return aiActionLoading && !currentAiRequestId ? "Отправляю запрос в очередь..." : "Запрос готов! Нажми '🤖 Спросить AI'!";
          case 'generating_ai_response': return "Запрос в очереди. Ожидание ответа AI... 🤖💭";
          case 'request_copied': return "Скопировано! Жду ответ от AI. Вставляй в Ассистента.";
          case 'response_pasted': return "Ответ получен! Нажми '➡️', чтобы я его разобрал.";
          case 'parsing_response': return "Разбираю ответ AI... 🧠";
          case 'response_parsed': return "Разобрал! Проверь результат, выбери файлы для PR.";
          case 'pr_ready': return assistantLoading ? "Создаю PR...⏳" : "Файлы выбраны! Готов создать Pull Request?";
          default:
               console.warn("Unhandled step in getXuinityMessage:", currentStep);
               return "Что делаем дальше?";
        }
    }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, aiActionLoading, currentAiRequestId]);


      // --- Provide Context Value ---
      const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
        secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        currentAiRequestId,
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
        setFetchStatus: setFetchStatusCallback,
        setRepoUrlEntered: setRepoUrlEnteredCallback,
        setFilesFetched: setFilesFetchedCallback,
        setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback,
        setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback,
        setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback,
        setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback,
        setCurrentAiRequestId: setCurrentAiRequestIdCallback,
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi,
        triggerParseResponse, triggerSelectAllParsed, triggerCreatePR, scrollToSection,
        getXuinityMessage,
      };

      return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};