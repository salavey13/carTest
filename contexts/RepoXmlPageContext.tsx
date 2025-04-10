// Merged and restored version based on previous implementation
"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject, useEffect, useRef } from 'react';
import { toast } from "sonner"; // Import toast for feedback
import { useAppContext } from "@/contexts/AppContext"; // For user ID and Supabase client
import { supabaseAnon } from "@/hooks/supabase"; // Import Supabase client
import type { AiRequestRecord, AiRequestInsert, AiRequestStatus } from '@/types/ai.types'; // Import new types
import type { RealtimeChannel } from '@supabase/supabase-js'; // Import Realtime type

// Define Ref Interfaces
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (autoAskAi?: boolean) => Promise<void>; // Modified to accept flag & return promise
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    clearAll: () => void;
    getKworkInputValue: () => string; // Add method to get input value
}

export interface AICodeAssistantRef {
    handleParse: () => Promise<void>;
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>;
    setResponseValue: (value: string) => void; // Add method to set response value
}

// Added fetch status type
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';

export type WorkflowStep =
  | 'idle'
  | 'need_repo_url'
  | 'ready_to_fetch'
  | 'fetching'
  | 'fetch_failed'
  | 'files_fetched'
  | 'files_fetched_highlights'
  | 'files_selected' // Files selected, ready to add to kwork OR ask AI
  | 'request_written' // Kwork has content manually added, ready to copy OR ask AI
  | 'generating_ai_response' // Waiting for AI API call (via Realtime)
  | 'request_copied' // Kwork copied (manual path), waiting for AI response paste
  | 'response_pasted' // AI Response pasted (manual path) OR received from API, ready to parse
  | 'parsing_response'
  | 'response_parsed'
  | 'pr_ready';

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
  requestCopied: boolean; // Still relevant for manual path
  aiResponseHasContent: boolean;
  filesParsed: boolean;
  selectedAssistantFiles: Set<string>;
  assistantLoading: boolean; // Loading for Assistant (Parse, PR Create)
  aiActionLoading: boolean; // REPURPOSED: Represents submitting request OR waiting for Realtime response
  currentAiRequestId: string | null; // NEW: Track the ID of the pending request

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
  setRequestCopied: (copied: boolean) => void; // Still relevant
  setAiResponseHasContent: (hasContent: boolean) => void;
  setFilesParsed: (parsed: boolean) => void;
  setSelectedAssistantFiles: (files: Set<string>) => void;
  setAssistantLoading: (loading: boolean) => void;
  setAiActionLoading: (loading: boolean) => void; // NEW Setter
  setCurrentAiRequestId: (id: string | null) => void; // NEW Setter

  // Action Triggers
  triggerFetch: (isManualRetry?: boolean) => Promise<void>;
  triggerSelectHighlighted: () => void;
  triggerAddSelectedToKwork: (autoAskAi?: boolean) => Promise<void>; // Accept flag
  triggerCopyKwork: () => void; // Still relevant
  triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>; // MODIFIED: Returns request ID on success
  triggerParseResponse: () => Promise<void>;
  triggerSelectAllParsed: () => void;
  triggerCreatePR: () => Promise<void>;
  scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor') => void; // Added executor alias

  // Messages
  getXuinityMessage: () => string;
}

const RepoXmlPageContext = createContext<RepoXmlPageContextType | undefined>(undefined);

export const useRepoXmlPageContext = () => {
    const context = useContext(RepoXmlPageContext);
    if (context === undefined) {
      console.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.');
       const warn = (name: string) => () => { console.warn(`Context not available: ${name} called.`); return Promise.resolve({ success: false, error: 'Context unavailable' }); }; // Modify promise return
       const warnSync = (name: string) => () => { console.warn(`Context not available: ${name} called.`); };
       return {
          currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false,
          primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
          kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
          filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false,
          currentAiRequestId: null, // Add default
          fetcherRef: { current: null }, assistantRef: { current: null }, kworkInputRef: { current: null },
          aiResponseInputRef: { current: null }, prSectionRef: { current: null },
          setFetchStatus: warnSync('setFetchStatus'), setRepoUrlEntered: warnSync('setRepoUrlEntered'),
          setFilesFetched: warnSync('setFilesFetched'), setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
          setKworkInputHasContent: warnSync('setKworkInputHasContent'), setRequestCopied: warnSync('setRequestCopied'),
          setAiResponseHasContent: warnSync('setAiResponseHasContent'), setFilesParsed: warnSync('setFilesParsed'),
          setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'), setAssistantLoading: warnSync('setAssistantLoading'),
          setAiActionLoading: warnSync('setAiActionLoading'),
          setCurrentAiRequestId: warnSync('setCurrentAiRequestId'), // Add default setter
          triggerFetch: warn('triggerFetch'), triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
          triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
          triggerAskAi: warn('triggerAskAi'), // Update return type if needed
          triggerParseResponse: warn('triggerParseResponse'), triggerSelectAllParsed: warnSync('triggerSelectAllParsed'),
          triggerCreatePR: warn('triggerCreatePR'), scrollToSection: warnSync('scrollToSection'),
          getXuinityMessage: () => "Context unavailable",
       } as RepoXmlPageContextType;
    }
    return context;
};


interface RepoXmlPageProviderProps {
    children: ReactNode;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    prSectionRef: MutableRefObject<HTMLElement | null>;
}

export const RepoXmlPageProvider: React.FC<RepoXmlPageProviderProps> = ({
      children, fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef
}) => {
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
    const [currentAiRequestId, setCurrentAiRequestIdState] = useState<string | null>(null); // NEW state

    const { user } = useAppContext(); // Get user context
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null); // Ref to manage the channel


    // --- Derive current workflow step (update for new states) ---
    const getCurrentStep = useCallback((): WorkflowStep => {
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        // Check AI Action Loading - could be submitting OR waiting for response
        if (aiActionLoading) {
            if (currentAiRequestId) return 'generating_ai_response'; // Waiting for existing request
            // If no ID, could be in the process of submitting
            // Check if kwork input exists to differentiate
             if (kworkInputHasContent && !currentAiRequestId) return 'request_written'; // About to submit
        }
        if (assistantLoading) {
            if (!filesParsed) return 'parsing_response';
            return 'pr_ready'; // Assume PR creation or post-parse selection
        }

        // If not loading:
        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';

        if (aiResponseHasContent) {
             if (!filesParsed) return 'response_pasted'; // Ready to parse
             if (selectedAssistantFiles.size === 0) return 'response_parsed'; // Ready to select files for PR
             return 'pr_ready'; // Ready for PR
        }
        // If AI response isn't present yet:
        if (requestCopied) return 'request_copied'; // Manual path
        if (kworkInputHasContent) return 'request_written'; // Ready to submit AI request
        if (selectedFetcherFiles.size > 0) return 'files_selected'; // Files selected, can add to kwork or submit
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights';
        return 'files_fetched';

    }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading,
        currentAiRequestId, // Add dependency
        primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
    ]);

    const currentStep = getCurrentStep();

    // --- Updaters (Keep existing, add new one) ---
    const setFetchStatusCallback = useCallback((status: FetchStatus) => setFetchStatusState(status), []);
    const setRepoUrlEnteredCallback = useCallback((entered: boolean) => setRepoUrlEnteredState(entered), []);
    const setFilesFetchedCallback = useCallback((fetched: boolean, primaryPath: string | null = null, secondaryPaths: string[] = []) => {
      setFilesFetchedState(fetched);
      setPrimaryHighlightedPathState(primaryPath);
      setSecondaryHighlightedPathsState(secondaryPaths);
      if (!fetched) {
          // Reset downstream states including AI request ID
          setSelectedFetcherFilesState(new Set());
          setKworkInputHasContentState(false);
          setRequestCopiedState(false);
          setAiResponseHasContentState(false);
          setFilesParsedState(false);
          setSelectedAssistantFilesState(new Set());
          setAssistantLoadingState(false);
          setAiActionLoadingState(false);
          setCurrentAiRequestIdState(null); // Reset AI request ID
           if (assistantRef.current) assistantRef.current.setResponseValue("");
           // Clean up existing realtime subscription if fetch fails/resets
           if (realtimeChannelRef.current) {
                supabaseAnon.removeChannel(realtimeChannelRef.current);
                realtimeChannelRef.current = null;
                console.log("Realtime channel removed due to fetch reset.");
           }
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
        setAssistantLoadingState(false); // Turn off after parsing attempt
    }, []);
    const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
    const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);
    const setAiActionLoadingCallback = useCallback((loading: boolean) => setAiActionLoadingState(loading), []);
    const setCurrentAiRequestIdCallback = useCallback((id: string | null) => setCurrentAiRequestIdState(id), []); // NEW setter


    // --- Action Triggers (Update triggerAskAi, keep others) ---
    const triggerFetch = useCallback(async (isManualRetry = false) => { if (fetcherRef.current) await fetcherRef.current.handleFetch(isManualRetry); else console.warn("triggerFetch called but fetcherRef is not yet available."); }, [fetcherRef]);
    const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted called but fetcherRef is not yet available."); }, [fetcherRef]);
    const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false) => { if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi); else console.warn("triggerAddSelectedToKwork called but fetcherRef is not yet available."); }, [fetcherRef]);
    const triggerCopyKwork = useCallback(() => { if (fetcherRef.current) { const copied = fetcherRef.current.handleCopyToClipboard(); if (copied) { setRequestCopiedState(true); setAiResponseHasContentState(false); if (assistantRef.current) assistantRef.current.setResponseValue(""); } } else console.warn("triggerCopyKwork called but fetcherRef is not yet available."); }, [fetcherRef, assistantRef]);

    // MODIFIED: Trigger AI Request Submission
    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        if (!fetcherRef.current || !user?.id) { // Check for user ID
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

        setAiActionLoadingState(true); // Indicate submission process start
        setAiResponseHasContentState(false); // Clear previous response display
        setCurrentAiRequestIdState(null); // Clear previous request ID
        if (assistantRef.current) assistantRef.current.setResponseValue(""); // Clear assistant textarea

        toast.info("Отправка запроса AI в очередь...");
        scrollToSection('executor'); // Scroll to assistant

        try {
            const requestData: AiRequestInsert = {
                prompt: kworkValue,
                user_id: user.id, // Associate request with the user
                status: 'pending', // Explicitly set status
                // model_name: 'your-preferred-model', // Optional: Set model if needed
            };

            const { data, error } = await supabaseAnon // Use anon client with RLS enabled
                .from('ai_requests')
                .insert(requestData)
                .select('id') // Select the ID of the newly created row
                .single();

            if (error) {
                console.error("Error inserting AI request:", error);
                toast.error(`Ошибка отправки запроса: ${error.message}`);
                setAiActionLoadingState(false);
                return { success: false, error: error.message };
            }

            if (!data?.id) {
                console.error("AI request insert did not return an ID.");
                toast.error("Ошибка отправки: не удалось получить ID запроса.");
                setAiActionLoadingState(false);
                return { success: false, error: "Request ID not returned after insert." };
            }

            const newRequestId = data.id;
            console.log("AI Request submitted successfully. Request ID:", newRequestId);
            toast.success("Запрос отправлен! Ожидание ответа AI...");
            setCurrentAiRequestIdState(newRequestId); // Store the new request ID to listen for updates
            // Keep aiActionLoading true, as we are now *waiting* for the result via Realtime

            return { success: true, requestId: newRequestId };

        } catch (error) {
            toast.error("Критическая ошибка при отправке запроса AI.");
            console.error("triggerAskAi critical error:", error);
            setAiActionLoadingState(false);
            return { success: false, error: error instanceof Error ? error.message : "Unknown submission error." };
        }
        // Note: setAiActionLoadingState(false) will be called by the Realtime listener upon completion/failure
    }, [fetcherRef, user, assistantRef, scrollToSection]); // Added user dependency

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


    // --- NEW: Realtime Subscription Effect ---
    useEffect(() => {
        // Only subscribe if we have a pending request ID and user is logged in
        if (!currentAiRequestId || !user?.id) {
            // If there's no request ID, ensure any existing channel is removed
            if (realtimeChannelRef.current) {
                console.log(`[Realtime Effect] Removing channel because currentAiRequestId is null.`);
                supabaseAnon.removeChannel(realtimeChannelRef.current);
                realtimeChannelRef.current = null;
            }
            return;
        }

        // If channel already exists for this ID, don't re-subscribe
        if (realtimeChannelRef.current?.topic === `realtime:public:ai_requests:id=eq.${currentAiRequestId}`) {
            console.log(`[Realtime Effect] Already subscribed to ${currentAiRequestId}`);
            return;
        }

         // Remove previous channel if it exists and is for a different ID
        if (realtimeChannelRef.current) {
            console.log(`[Realtime Effect] Removing previous channel: ${realtimeChannelRef.current.topic}`);
            supabaseAnon.removeChannel(realtimeChannelRef.current);
            realtimeChannelRef.current = null;
        }


        console.log(`[Realtime Effect] Setting up subscription for AI request ID: ${currentAiRequestId}`);

        const channel = supabaseAnon.channel(`ai-request-${currentAiRequestId}`)
            .on<AiRequestRecord>( // Strongly type the payload
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_requests',
                    filter: `id=eq.${currentAiRequestId}` // Filter for the specific request ID
                },
                (payload) => {
                    console.log('[Realtime] AI Request Updated:', payload.new);
                    const updatedRecord = payload.new;

                    if (updatedRecord.status === 'completed') {
                        toast.success("🤖✨ Ответ от AI получен!");
                        if (assistantRef.current) {
                            assistantRef.current.setResponseValue(updatedRecord.response || "");
                            // Optionally trigger parsing automatically after a short delay
                            setTimeout(() => {
                                triggerParseResponse().catch(err => console.error("Error auto-triggering parse:", err));
                            }, 200);
                        }
                        setAiResponseHasContentState(true);
                        setAiActionLoadingState(false); // Turn off loading indicator
                        setCurrentAiRequestIdState(null); // Clear the request ID, ready for the next one
                        if (realtimeChannelRef.current) {
                            supabaseAnon.removeChannel(realtimeChannelRef.current); // Unsubscribe after completion
                            realtimeChannelRef.current = null;
                            console.log(`[Realtime] Unsubscribed from ${currentAiRequestId} (completed).`);
                        }
                    } else if (updatedRecord.status === 'failed') {
                        toast.error(`❌ Ошибка обработки AI: ${updatedRecord.error_message || 'Неизвестная ошибка'}`);
                        setAiActionLoadingState(false); // Turn off loading indicator
                        setCurrentAiRequestIdState(null); // Clear the request ID
                        if (realtimeChannelRef.current) {
                             supabaseAnon.removeChannel(realtimeChannelRef.current); // Unsubscribe after failure
                             realtimeChannelRef.current = null;
                             console.log(`[Realtime] Unsubscribed from ${currentAiRequestId} (failed).`);
                        }
                    } else if (updatedRecord.status === 'processing') {
                        // Optional: Update UI if needed, e.g., show "AI is processing..."
                        toast.info("⏳ AI обрабатывает ваш запрос...", { duration: 2000 });
                    }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log(`[Realtime] Successfully subscribed to channel for request ${currentAiRequestId}`);
                 } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('[Realtime] Subscription Error:', status, err);
                    toast.error("Ошибка Realtime подписки. Обновите страницу, если ответ не придет.");
                    setAiActionLoadingState(false); // Stop loading on error
                    setCurrentAiRequestIdState(null);
                    realtimeChannelRef.current = null; // Clear ref on error
                 } else if (status === 'CLOSED') {
                     console.log(`[Realtime] Channel closed for request ${currentAiRequestId}`);
                      // Potentially handle unexpected close if needed
                 }
             });

        realtimeChannelRef.current = channel; // Store the channel instance

        // --- Cleanup Function ---
        return () => {
            if (realtimeChannelRef.current) {
                console.log(`[Realtime Effect Cleanup] Removing channel for request ${currentAiRequestId}: ${realtimeChannelRef.current.topic}`);
                supabaseAnon.removeChannel(realtimeChannelRef.current)
                    .catch(error => console.error("Error removing channel on cleanup:", error));
                realtimeChannelRef.current = null;
            }
        };
        // Ensure useEffect runs when currentAiRequestId or user changes
    }, [currentAiRequestId, user, assistantRef, triggerParseResponse]); // Add dependencies


    // --- Xuinity Message Logic (Update messages) ---
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
          case 'generating_ai_response': return "Запрос в очереди. Ожидание ответа AI... 🤖💭"; // Updated message
          case 'request_copied': return "Скопировано! Жду ответ от AI. Вставляй в Ассистента."; // Manual path (still valid)
          case 'response_pasted': return "Ответ получен! Нажми '➡️', чтобы я его разобрал."; // From Realtime or Paste
          case 'parsing_response': return "Разбираю ответ AI... 🧠";
          case 'response_parsed': return "Разобрал! Проверь результат, выбери файлы для PR.";
          case 'pr_ready': return assistantLoading ? "Создаю PR...⏳" : "Файлы выбраны! Готов создать Pull Request?";
          default:
               // const _exhaustiveCheck: never = currentStep; // This might error if type isn't exhaustive
               console.warn("Unhandled step in getXuinityMessage:", currentStep);
               return "Что делаем дальше?";
        }
      }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, aiActionLoading, currentAiRequestId]); // Add new dependencies


      // --- Provide Context Value ---
      const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
        secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        currentAiRequestId, // Provide new state
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
        setCurrentAiRequestId: setCurrentAiRequestIdCallback, // Provide new setter
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, // Provide modified trigger
        triggerParseResponse, triggerSelectAllParsed, triggerCreatePR, scrollToSection,
        getXuinityMessage,
      };

      return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};