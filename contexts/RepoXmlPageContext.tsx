// /contexts/RepoXmlPageContext.tsx
"use client";

    import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject } from 'react';
    import { generateAiCode } from '@/app/ai_actions/actions'; // Import the new AI action
    import { getOpenPullRequests } from '@/app/actions_github/actions'; // Import PR fetching action
    import { toast } from "sonner"; // Import toast for feedback

    // Define Ref Interfaces
    export interface RepoTxtFetcherRef {
        handleFetch: (isManualRetry?: boolean, branchName?: string | null) => Promise<void>; // Pass branch name
        selectHighlightedFiles: () => void;
        handleAddSelected: (autoAskAi?: boolean) => Promise<void>;
        handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
        clearAll: () => void;
        getKworkInputValue: () => string;
    }

    export interface AICodeAssistantRef {
        handleParse: () => Promise<void>;
        selectAllParsedFiles: () => void;
        handleCreatePR: () => Promise<void>;
        setResponseValue: (value: string) => void;
        // Added to update state from context
        updateRepoUrl: (url: string) => void;
    }

    // Added fetch status type
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
      | 'generating_ai_response'
      | 'request_copied'
      | 'response_pasted'
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
      requestCopied: boolean;
      aiResponseHasContent: boolean;
      filesParsed: boolean;
      selectedAssistantFiles: Set<string>;
      assistantLoading: boolean;
      aiActionLoading: boolean;
      loadingPrs: boolean; // NEW: Loading state for PRs
      openPrs: SimplePullRequest[]; // NEW: State for fetched PRs
      targetBranchName: string | null; // NEW: Branch selected from PR or manual input
      manualBranchName: string; // NEW: Manually entered branch name

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
      setTargetBranchName: (branch: string | null) => void; // NEW Setter
      setManualBranchName: (branch: string) => void; // NEW Setter
      setOpenPrs: (prs: SimplePullRequest[]) => void; // NEW Setter
      setLoadingPrs: (loading: boolean) => void; // NEW Setter

      // Action Triggers
      triggerFetch: (isManualRetry?: boolean) => Promise<void>; // Updated: will read targetBranchName from state
      triggerGetOpenPRs: (repoUrl: string) => Promise<void>; // NEW: Trigger to fetch PRs
      triggerSelectHighlighted: () => void;
      triggerAddSelectedToKwork: (autoAskAi?: boolean) => Promise<void>;
      triggerCopyKwork: () => void;
      triggerAskAi: () => Promise<void>;
      triggerParseResponse: () => Promise<void>;
      triggerSelectAllParsed: () => void;
      triggerCreatePR: () => Promise<void>;
      scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'prSelector') => void; // Added prSelector

      // Messages
      getXuinityMessage: () => string;

      // NEW: Callback when Repo URL changes in assistant
      updateRepoUrlInAssistant: (url: string) => void;
    }

    const RepoXmlPageContext = createContext<RepoXmlPageContextType | undefined>(undefined);

    export const useRepoXmlPageContext = () => {
      const context = useContext(RepoXmlPageContext);
      if (context === undefined) {
        console.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.');
         const warn = (name: string) => () => { console.warn(`Context not available: ${name} called.`); return Promise.resolve(); };
         const warnSync = (name: string) => () => { console.warn(`Context not available: ${name} called.`); };
         return {
            currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false,
            primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
            kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
            filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false,
            loadingPrs: false, openPrs: [], targetBranchName: null, manualBranchName: "", // Added defaults
            fetcherRef: { current: null }, assistantRef: { current: null }, kworkInputRef: { current: null },
            aiResponseInputRef: { current: null }, prSectionRef: { current: null },
            setFetchStatus: warnSync('setFetchStatus'), setRepoUrlEntered: warnSync('setRepoUrlEntered'),
            setFilesFetched: warnSync('setFilesFetched'), setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
            setKworkInputHasContent: warnSync('setKworkInputHasContent'), setRequestCopied: warnSync('setRequestCopied'),
            setAiResponseHasContent: warnSync('setAiResponseHasContent'), setFilesParsed: warnSync('setFilesParsed'),
            setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'), setAssistantLoading: warnSync('setAssistantLoading'),
            setAiActionLoading: warnSync('setAiActionLoading'),
            setTargetBranchName: warnSync('setTargetBranchName'), setManualBranchName: warnSync('setManualBranchName'), // Added default setters
            setOpenPrs: warnSync('setOpenPrs'), setLoadingPrs: warnSync('setLoadingPrs'), // Added default setters
            triggerFetch: warn('triggerFetch'), triggerGetOpenPRs: warn('triggerGetOpenPRs'), // Added default trigger
            triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
            triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
            triggerAskAi: warn('triggerAskAi'), triggerParseResponse: warn('triggerParseResponse'),
            triggerSelectAllParsed: warnSync('triggerSelectAllParsed'), triggerCreatePR: warn('triggerCreatePR'),
            scrollToSection: warnSync('scrollToSection'),
            getXuinityMessage: () => "Context unavailable",
            updateRepoUrlInAssistant: warnSync('updateRepoUrlInAssistant'), // Added default
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
      const [aiActionLoading, setAiActionLoadingState] = useState(false);
      const [loadingPrs, setLoadingPrsState] = useState(false); // NEW state
      const [openPrs, setOpenPrsState] = useState<SimplePullRequest[]>([]); // NEW state
      const [targetBranchName, setTargetBranchNameState] = useState<string | null>(null); // NEW state (null means default)
      const [manualBranchName, setManualBranchNameState] = useState<string>(""); // NEW state

      // Derive current workflow step based on context state
      const getCurrentStep = useCallback((): WorkflowStep => {
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading) return 'generating_ai_response';
        if (assistantLoading) {
            if (!filesParsed) return 'parsing_response';
            return 'pr_ready';
        }

        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';

        // Files are fetched
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
        primaryHighlightedPath, secondaryHighlightedPaths.length, selectedFetcherFiles.size,
        kworkInputHasContent, requestCopied, aiResponseHasContent, filesParsed,
        selectedAssistantFiles.size
      ]);

      const currentStep = getCurrentStep();

      // --- Updaters (Memoized) ---
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
            setAiActionLoadingState(false);
             if (assistantRef.current) assistantRef.current.setResponseValue("");
        } else {
            setFetchStatusState('success');
        }
      }, [assistantRef]);
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
          if (!parsed) setSelectedAssistantFilesState(new Set());
          setAssistantLoadingState(false);
      }, []);
      const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
      const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);
      const setAiActionLoadingCallback = useCallback((loading: boolean) => setAiActionLoadingState(loading), []);
      const setTargetBranchNameCallback = useCallback((branch: string | null) => setTargetBranchNameState(branch), []);
      const setManualBranchNameCallback = useCallback((branch: string) => {
          setManualBranchNameState(branch);
          // If manual branch is set, it overrides the PR-selected branch
          if (branch.trim()) {
              setTargetBranchNameState(branch.trim());
          } else {
              // If manual branch is cleared, fall back to null (meaning default or PR-selected if one was chosen)
              // Let the component logic handle setting target based on PR selection if manual is empty
              setTargetBranchNameState(null); // Revisit this logic in RepoTxtFetcher
          }
      }, []);
      const setOpenPrsCallback = useCallback((prs: SimplePullRequest[]) => setOpenPrsState(prs), []);
      const setLoadingPrsCallback = useCallback((loading: boolean) => setLoadingPrsState(loading), []);


      // --- Action Triggers (Memoized) ---
      const triggerFetch = useCallback(async (isManualRetry = false) => {
        if (fetcherRef.current) {
            // Determine the final branch name to fetch (Manual > Selected PR > Default)
            // The targetBranchName state reflects Manual or Selected PR. If null, fetcherRef handles default.
            const branchToFetch = targetBranchName; // Use the state value directly
            console.log("Context triggerFetch: Using branch ->", branchToFetch ?? "Default");
            await fetcherRef.current.handleFetch(isManualRetry, branchToFetch);
        } else { console.warn("triggerFetch called but fetcherRef is not yet available."); }
      }, [fetcherRef, targetBranchName]); // Depend on targetBranchName state

      const triggerGetOpenPRs = useCallback(async (repoUrl: string) => {
            if (!repoUrl || !repoUrl.includes('github.com')) {
                toast.error("Укажите валидный URL репозитория GitHub");
                return;
            }
            setLoadingPrsState(true);
            setOpenPrsState([]); // Clear previous PRs
            try {
                const result = await getOpenPullRequests(repoUrl);
                if (result.success && result.pullRequests) {
                    setOpenPrsState(result.pullRequests as SimplePullRequest[]); // Assuming type cast is safe
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
       }, []); // No external dependencies needed


      const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted called but fetcherRef is not yet available."); }, [fetcherRef]);

      const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false) => {
        if (fetcherRef.current) {
           await fetcherRef.current.handleAddSelected(autoAskAi);
        } else { console.warn("triggerAddSelectedToKwork called but fetcherRef is not yet available."); }
      }, [fetcherRef]);

      const triggerCopyKwork = useCallback(() => {
          if (fetcherRef.current) {
              const copied = fetcherRef.current.handleCopyToClipboard();
              if (copied) {
                  setRequestCopiedState(true);
                  setAiResponseHasContentState(false);
                   if (assistantRef.current) assistantRef.current.setResponseValue("");
              }
          } else { console.warn("triggerCopyKwork called but fetcherRef is not yet available."); }
      }, [fetcherRef, assistantRef]);

      const triggerAskAi = useCallback(async () => {
          if (!fetcherRef.current || !assistantRef.current) {
              toast.error("Компоненты еще не готовы."); return;
          }
          const kworkValue = fetcherRef.current.getKworkInputValue();
          if (!kworkValue.trim()) {
              toast.error("Нет запроса для отправки AI."); return;
          }

          setAiActionLoadingState(true);
          setAiResponseHasContentState(false);
          assistantRef.current.setResponseValue("");
          toast.info("Отправка запроса AI...");
          scrollToSection('executor');

          try {
              const result = await generateAiCode(kworkValue);

              if (result.success && result.text) {
                  toast.success("Ответ от AI получен!");
                  assistantRef.current.setResponseValue(result.text);
                  setAiResponseHasContentState(true);
                   setTimeout(() => {
                       triggerParseResponse(); // Auto-parse after receiving response
                   }, 100);

              } else {
                  toast.error(`Ошибка AI: ${result.error || 'Неизвестная ошибка'}`);
                  setAiResponseHasContentState(false);
              }
          } catch (error) {
              toast.error("Критическая ошибка при вызове AI.");
              console.error("triggerAskAi critical error:", error);
              setAiResponseHasContentState(false);
          } finally {
              setAiActionLoadingState(false);
          }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [fetcherRef, assistantRef]); // Removed triggerParseResponse from deps

       const triggerParseResponse = useCallback(async () => {
           if (assistantRef.current) {
                setAssistantLoadingState(true);
                await assistantRef.current.handleParse();
           } else { console.warn("triggerParseResponse called but assistantRef is not yet available."); }
        }, [assistantRef]);

      const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed called but assistantRef is not yet available."); }, [assistantRef]);
      const triggerCreatePR = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleCreatePR(); else console.warn("triggerCreatePR called but assistantRef is not yet available."); }, [assistantRef]);

      const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'prSelector') => {
         let element: HTMLElement | null = null;
         const targetId = (id === 'assistant' || id === 'executor') ? 'executor' : (id === 'fetcher' ? 'extractor' : id); // Map aliases

         switch(targetId) {
            case 'kworkInput': element = kworkInputRef.current; break;
            case 'aiResponseInput': element = aiResponseInputRef.current; break;
            case 'prSection': element = prSectionRef.current; break;
            case 'extractor': element = document.getElementById('extractor'); break;
            case 'executor': element = document.getElementById('executor'); break;
            case 'prSelector': element = document.getElementById('pr-selector-section'); break; // Target the new PR selector section ID
         }
         if (element) {
             if (targetId === 'kworkInput' || targetId === 'aiResponseInput' || targetId === 'prSection') {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
             } else {
                 const rect = element.getBoundingClientRect();
                 window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
             }
         }
         else { console.warn(`scrollToSection: Element for id "${targetId}" (mapped from "${id}") not found.`); }
      }, [kworkInputRef, aiResponseInputRef, prSectionRef]);

      // --- Xuinity Message Logic (Memoized) ---
       const getXuinityMessage = useCallback((): string => {
        const branchInfo = targetBranchName ? ` (ветка: ${targetBranchName})` : '';
        switch (currentStep) {
          case 'idle': return "Контекст инициализируется...";
          case 'need_repo_url': return "Укажи URL репозитория в Экстракторе.";
          case 'ready_to_fetch': return repoUrlEntered ? `Готов извлечь файлы${branchInfo}. Загрузить PR или Fetch!` : "Сначала укажи URL репозитория.";
          case 'fetching': return `Извлекаю файлы${branchInfo}... ${fetchStatus === 'retrying' ? '(Попытка снова...)' : ''} ⏳`;
          case 'fetch_failed': return `Не удалось извлечь файлы${branchInfo} после нескольких попыток. 😢 Попробовать еще раз?`;
          case 'files_fetched': return `Файлы извлечены${branchInfo}! Выбери нужные или опиши задачу.`;
          case 'files_fetched_highlights': return `Файлы извлечены${branchInfo}. Есть связанные - выбрать их или иди к списку.`;
          case 'files_selected': return `Файлы выбраны${branchInfo}! Добавь их в запрос ИЛИ нажми '🤖 Спросить AI'!`;
          case 'request_written': return "Запрос готов! Нажми '🤖 Спросить AI' ИЛИ скопируй вручную.";
          case 'generating_ai_response': return "Общаюсь с Gemini... 🤖💭";
          case 'request_copied': return "Скопировано! Жду ответ от AI. Вставляй в Ассистента.";
          case 'response_pasted': return "Ответ получен! Нажми '➡️', чтобы я его разобрал.";
          case 'parsing_response': return "Разбираю ответ AI... 🧠";
          case 'response_parsed': return "Разобрал! Проверь результат, выбери файлы для PR.";
          case 'pr_ready': return assistantLoading ? "Создаю PR...⏳" : "Файлы выбраны! Готов создать Pull Request?";
          default: return "Что делаем дальше?";
        }
      }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, targetBranchName]);

      // Callback for AICodeAssistant to update repoUrl if changed there
      const updateRepoUrlInAssistant = useCallback((url: string) => {
          // Optionally, sync back to fetcher or just update context state if needed
          // For now, just log it or potentially reset PR list if URL changes
          console.log("Repo URL updated in Assistant:", url);
          // Maybe reset fetched PRs if URL changes drastically?
          // setOpenPrsState([]);
          // setTargetBranchNameState(null);
          // setManualBranchNameState("");
      }, []);


      const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
        secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        loadingPrs, openPrs, targetBranchName, manualBranchName, // Added new state
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
        setTargetBranchName: setTargetBranchNameCallback, // Added setter
        setManualBranchName: setManualBranchNameCallback, // Added setter
        setOpenPrs: setOpenPrsCallback, // Added setter
        setLoadingPrs: setLoadingPrsCallback, // Added setter
        triggerFetch, triggerGetOpenPRs, // Added trigger
        triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
        triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreatePR, scrollToSection,
        getXuinityMessage,
        updateRepoUrlInAssistant, // Added callback
      };

      return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
    };