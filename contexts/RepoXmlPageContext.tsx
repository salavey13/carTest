"use client";

    import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject } from 'react';
    import { generateAiCode } from '@/app/ai_actions/actions'; // Import the new AI action
    import { toast } from "sonner"; // Import toast for feedback

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
      // --- NEW STEP ---
      | 'generating_ai_response' // Waiting for AI API call
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
      aiActionLoading: boolean; // NEW: Loading specifically for the AI API call

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

      // Action Triggers
      triggerFetch: (isManualRetry?: boolean) => Promise<void>;
      triggerSelectHighlighted: () => void;
      triggerAddSelectedToKwork: (autoAskAi?: boolean) => Promise<void>; // Accept flag
      triggerCopyKwork: () => void; // Still relevant
      triggerAskAi: () => Promise<void>; // NEW: Explicit trigger for AI call
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
         // Provide default functions that warn if called unexpectedly
         const warn = (name: string) => () => { console.warn(`Context not available: ${name} called.`); return Promise.resolve(); };
         const warnSync = (name: string) => () => { console.warn(`Context not available: ${name} called.`); };
         return {
            currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false,
            primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
            kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
            filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, // Added default
            fetcherRef: { current: null }, assistantRef: { current: null }, kworkInputRef: { current: null },
            aiResponseInputRef: { current: null }, prSectionRef: { current: null },
            setFetchStatus: warnSync('setFetchStatus'), setRepoUrlEntered: warnSync('setRepoUrlEntered'),
            setFilesFetched: warnSync('setFilesFetched'), setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
            setKworkInputHasContent: warnSync('setKworkInputHasContent'), setRequestCopied: warnSync('setRequestCopied'),
            setAiResponseHasContent: warnSync('setAiResponseHasContent'), setFilesParsed: warnSync('setFilesParsed'),
            setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'), setAssistantLoading: warnSync('setAssistantLoading'),
            setAiActionLoading: warnSync('setAiActionLoading'), // Added default setter
            triggerFetch: warn('triggerFetch'), triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
            triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
            triggerAskAi: warn('triggerAskAi'), // Added default trigger
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
      children,
      fetcherRef,
      assistantRef,
      kworkInputRef,
      aiResponseInputRef,
      prSectionRef,
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
      const [aiActionLoading, setAiActionLoadingState] = useState(false); // NEW state

      // Derive current workflow step based on context state
      const getCurrentStep = useCallback((): WorkflowStep => {
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading) return 'generating_ai_response'; // NEW: Check AI loading first
        if (assistantLoading) {
            // This might need refinement - if parsing is loading, it's 'parsing_response'
            // If PR creation is loading, it's maybe still 'pr_ready' but with a loading indicator
            if (!filesParsed) return 'parsing_response';
            return 'pr_ready'; // Assume PR creation or post-parse selection if assistant loading after parse
        }

        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';

        // Files are fetched (fetchStatus === 'success')
        if (aiResponseHasContent) {
             if (!filesParsed) return 'response_pasted'; // Response is present (from API or paste), ready to parse
             if (selectedAssistantFiles.size === 0) return 'response_parsed'; // Parsed, ready to select files
             return 'pr_ready'; // Files selected, ready for PR
        }
         // If AI response isn't present yet:
        if (requestCopied) return 'request_copied'; // Manual path: copied, waiting for paste
        if (kworkInputHasContent) return 'request_written'; // Request written, can ask AI or copy
        if (selectedFetcherFiles.size > 0) return 'files_selected'; // Files selected, can add to kwork or ask AI
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights'; // Files fetched with highlights
        return 'files_fetched'; // Base fetched state

      }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading, // Added aiActionLoading
        primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
      ]);

      const currentStep = getCurrentStep();

      // --- Updaters (Memoized) ---
      const setFetchStatusCallback = useCallback((status: FetchStatus) => setFetchStatusState(status), []);
      const setFilesFetchedCallback = useCallback((fetched: boolean, primaryPath: string | null = null, secondaryPaths: string[] = []) => {
        setFilesFetchedState(fetched);
        setPrimaryHighlightedPathState(primaryPath);
        setSecondaryHighlightedPathsState(secondaryPaths);
        if (!fetched) {
            // Reset downstream states on fetch failure/reset
            setSelectedFetcherFilesState(new Set());
            setKworkInputHasContentState(false);
            setRequestCopiedState(false);
            setAiResponseHasContentState(false);
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            setAssistantLoadingState(false);
            setAiActionLoadingState(false); // Reset AI loading too
            // Clear the actual AI response input if fetch fails/resets
             if (assistantRef.current) assistantRef.current.setResponseValue("");
        } else {
            setFetchStatusState('success');
        }
      }, [assistantRef]); // Added assistantRef dependency
      const setSelectedFetcherFilesCallback = useCallback((files: Set<string>) => setSelectedFetcherFilesState(files), []);
      const setKworkInputHasContentCallback = useCallback((hasContent: boolean) => setKworkInputHasContentState(hasContent), []);
      const setRequestCopiedCallback = useCallback((copied: boolean) => setRequestCopiedState(copied), []);
      const setAiResponseHasContentCallback = useCallback((hasContent: boolean) => {
          setAiResponseHasContentState(hasContent);
          if (!hasContent) {
              setFilesParsedState(false);
              setSelectedAssistantFilesState(new Set());
          }
      }, []);
      const setFilesParsedCallback = useCallback((parsed: boolean) => {
          setFilesParsedState(parsed);
          if (!parsed) {
              setSelectedAssistantFilesState(new Set());
          }
          // Ensure assistant loading is off *after* parsing attempt completes
          setAssistantLoadingState(false);
      }, []);
      const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
      const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);
      const setAiActionLoadingCallback = useCallback((loading: boolean) => setAiActionLoadingState(loading), []); // NEW setter


      // --- Action Triggers (Memoized) ---
      const triggerFetch = useCallback(async (isManualRetry = false) => {
        if (fetcherRef.current) {
            await fetcherRef.current.handleFetch(isManualRetry);
        } else { console.warn("triggerFetch called but fetcherRef is not yet available."); }
      }, [fetcherRef]);

      const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted called but fetcherRef is not yet available."); }, [fetcherRef]);

      // Modified trigger to handle auto-asking AI
      const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false) => {
        if (fetcherRef.current) {
           await fetcherRef.current.handleAddSelected(autoAskAi); // Pass flag
        } else { console.warn("triggerAddSelectedToKwork called but fetcherRef is not yet available."); }
      }, [fetcherRef]); // Removed triggerAskAi dependency as it's now handled internally

      const triggerCopyKwork = useCallback(() => {
          if (fetcherRef.current) {
              const copied = fetcherRef.current.handleCopyToClipboard();
              // If copy succeeds, set the state (relevant for manual flow)
              if (copied) {
                  setRequestCopiedState(true);
                  // Reset AI response if user explicitly copies (they might want a fresh external response)
                  setAiResponseHasContentState(false);
                   if (assistantRef.current) assistantRef.current.setResponseValue("");
              }
          } else { console.warn("triggerCopyKwork called but fetcherRef is not yet available."); }
      }, [fetcherRef, assistantRef]); // Added assistantRef

      // NEW: Trigger AI generation using the current Kwork input
      const triggerAskAi = useCallback(async () => {
          if (!fetcherRef.current || !assistantRef.current) {
              toast.error("Компоненты еще не готовы.");
              console.warn("triggerAskAi called but refs are not available.");
              return;
          }
          const kworkValue = fetcherRef.current.getKworkInputValue();
          if (!kworkValue.trim()) {
              toast.error("Нет запроса для отправки AI.");
              return;
          }

          setAiActionLoadingState(true);
          setAiResponseHasContentState(false); // Clear previous response
          assistantRef.current.setResponseValue(""); // Clear assistant textarea
          toast.info("Отправка запроса AI...");
          scrollToSection('executor'); // Scroll to assistant while waiting

          try {
              const result = await generateAiCode(kworkValue); // Call the server action

              if (result.success && result.text) {
                  toast.success("Ответ от AI получен!");
                  // Programmatically set the response in AICodeAssistant
                  assistantRef.current.setResponseValue(result.text);
                  // Update context state immediately
                  setAiResponseHasContentState(true);
                   // Automatically trigger parsing
                   // Small delay to allow state update and potential re-render
                   setTimeout(() => {
                       triggerParseResponse();
                   }, 100);

              } else {
                  toast.error(`Ошибка AI: ${result.error || 'Неизвестная ошибка'}`);
                  setAiResponseHasContentState(false); // Ensure state reflects failure
              }
          } catch (error) {
              toast.error("Критическая ошибка при вызове AI.");
              console.error("triggerAskAi critical error:", error);
              setAiResponseHasContentState(false);
          } finally {
              setAiActionLoadingState(false);
          }
      }, [fetcherRef, assistantRef]); // Dependencies: refs

       const triggerParseResponse = useCallback(async () => {
           if (assistantRef.current) {
                // Ensure assistant loading is true *before* calling parse
                setAssistantLoadingState(true);
                await assistantRef.current.handleParse();
                // setAssistantLoadingState(false); // Loading state should be turned off by setFilesParsed callback
           } else {
                console.warn("triggerParseResponse called but assistantRef is not yet available.");
           }
        }, [assistantRef]);

      const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed called but assistantRef is not yet available."); }, [assistantRef]);
      const triggerCreatePR = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleCreatePR(); else console.warn("triggerCreatePR called but assistantRef is not yet available."); }, [assistantRef]);

      const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor') => {
         let element: HTMLElement | null = null;
         const targetId = (id === 'assistant' || id === 'executor') ? 'executor' : (id === 'fetcher' ? 'extractor' : id); // Map aliases

         switch(targetId) {
            case 'kworkInput': element = kworkInputRef.current; break;
            case 'aiResponseInput': element = aiResponseInputRef.current; break;
            case 'prSection': element = prSectionRef.current; break;
            case 'extractor': element = document.getElementById('extractor'); break;
            case 'executor': element = document.getElementById('executor'); break;
         }
         if (element) {
             // Try scrolling the specific element first if it's an input/section
             if (targetId === 'kworkInput' || targetId === 'aiResponseInput' || targetId === 'prSection') {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
             } else {
                 // For top-level sections, scroll the window
                 const rect = element.getBoundingClientRect();
                 window.scrollTo({
                     top: window.scrollY + rect.top - 80, // Adjust offset (e.g., for sticky header)
                     behavior: 'smooth'
                 });
             }
         }
         else { console.warn(`scrollToSection: Element for id "${targetId}" (mapped from "${id}") not found.`); }
      }, [kworkInputRef, aiResponseInputRef, prSectionRef]);

      // --- Xuinity Message Logic (Memoized) ---
       const getXuinityMessage = useCallback((): string => {
        switch (currentStep) {
          case 'idle': return "Контекст инициализируется...";
          case 'need_repo_url': return "Укажи URL репозитория в Экстракторе.";
          case 'ready_to_fetch': return repoUrlEntered ? "Нажми 'Извлечь файлы' или кнопку Fetch ниже!" : "Сначала укажи URL репозитория.";
          case 'fetching': return `Извлекаю файлы... ${fetchStatus === 'retrying' ? '(Попытка снова...)' : ''} ⏳`;
          case 'fetch_failed': return "Не удалось извлечь файлы после нескольких попыток. 😢 Попробовать еще раз?";
          case 'files_fetched': return "Файлы извлечены! Выбери нужные или опиши задачу.";
          case 'files_fetched_highlights': return "Файлы извлечены. Есть связанные - выбрать их или иди к списку.";
          case 'files_selected': return "Файлы выбраны! Добавь их в запрос ИЛИ нажми '🤖 Спросить AI'!";
          case 'request_written': return "Запрос готов! Нажми '🤖 Спросить AI' ИЛИ скопируй вручную.";
          case 'generating_ai_response': return "Общаюсь с Gemini... 🤖💭"; // NEW Message
          case 'request_copied': return "Скопировано! Жду ответ от AI. Вставляй в Ассистента."; // Manual path
          case 'response_pasted': return "Ответ получен! Нажми '➡️', чтобы я его разобрал."; // From API or Paste
          case 'parsing_response': return "Разбираю ответ AI... 🧠";
          case 'response_parsed': return "Разобрал! Проверь результат, выбери файлы для PR.";
          case 'pr_ready': return assistantLoading ? "Создаю PR...⏳" : "Файлы выбраны! Готов создать Pull Request?";
          default:
               const _exhaustiveCheck: never = currentStep;
               console.warn("Unhandled step in getXuinityMessage:", currentStep);
               return "Что делаем дальше?";
        }
      }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading]); // Dependencies


      const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
        secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading, // Added aiActionLoading
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
        setFetchStatus: setFetchStatusCallback,
        setRepoUrlEntered: setRepoUrlEnteredState,
        setFilesFetched: setFilesFetchedCallback,
        setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback,
        setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback,
        setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback,
        setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback, // Added setter
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, // Added trigger
        triggerParseResponse, triggerSelectAllParsed, triggerCreatePR, scrollToSection,
        getXuinityMessage,
      };

      return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
    };