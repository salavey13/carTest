"use client";

    import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject, useEffect } from 'react';
    import { generateAiCode } from '@/app/ai_actions/actions';
    import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions'; // Added updateBranch
    import { toast } from "sonner";

    // Define Ref Interfaces
    export interface RepoTxtFetcherRef {
        handleFetch: (isManualRetry?: boolean, branchName?: string | null) => Promise<void>;
        selectHighlightedFiles: () => void;
        handleAddSelected: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>; // Added filesToAddParam
        handleCopyToClipboard: () => boolean; // Removed params, uses ref internally
        clearAll: () => void;
        getKworkInputValue: () => string;
    }

    export interface AICodeAssistantRef {
        handleParse: () => Promise<void>;
        selectAllParsedFiles: () => void;
        handleCreatePR: () => Promise<void>; // Renamed in component to handleCreateOrUpdatePR
        setResponseValue: (value: string) => void;
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
      | 'parsing_response' // <-- Added Parsing Step
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
      assistantLoading: boolean; // General Assistant loading (parse, PR create/update)
      aiActionLoading: boolean; // Specific AI generation loading
      loadingPrs: boolean;
      openPrs: SimplePullRequest[];
      targetBranchName: string | null; // Final target branch (Manual > PR > Null/Default)
      manualBranchName: string; // User manual input
      isSettingsModalOpen: boolean; // Modal state
      currentAiRequestId: string | null; // Added for tracking AI request
      isParsing: boolean; // <-- Added Parsing State

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
      setCurrentAiRequestId: (id: string | null) => void; // Added setter for AI request ID
      setIsParsing: (parsing: boolean) => void; // <-- Added Setter for Parsing State

      // Action Triggers
      triggerFetch: (isManualRetry?: boolean) => Promise<void>;
      triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
      triggerSelectHighlighted: () => void;
      triggerAddSelectedToKwork: (autoAskAi?: boolean, filesToAddParam?: Set<string>) => Promise<void>;
      triggerCopyKwork: () => void;
      triggerAskAi: () => Promise<void>;
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

    const RepoXmlPageContext = createContext<RepoXmlPageContextType | undefined>(undefined);

    export const useRepoXmlPageContext = () => {
        const context = useContext(RepoXmlPageContext);
        if (context === undefined) {
            console.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.');
            const warn = (name: string): any => () => { console.warn(`Context stub: ${name} called.`); return Promise.resolve({ success: false, error: 'Context unavailable' }); };
            const warnSync = (name: string): any => () => { console.warn(`Context stub: ${name} called.`); };
            // Add default values for new states/setters in the stub
            return {
                 currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false,
                 primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
                 kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
                 filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false,
                 loadingPrs: false, openPrs: [], targetBranchName: null, manualBranchName: "",
                 isSettingsModalOpen: false, currentAiRequestId: null, isParsing: false, // Added default
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
                 setCurrentAiRequestId: warnSync('setCurrentAiRequestId'), // Added stub setter
                 setIsParsing: warnSync('setIsParsing'), // Added stub setter
                 triggerFetch: warn('triggerFetch'), triggerGetOpenPRs: warn('triggerGetOpenPRs'),
                 triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
                 triggerAddSelectedToKwork: warn('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
                 triggerAskAi: warn('triggerAskAi'), triggerParseResponse: warn('triggerParseResponse'),
                 triggerSelectAllParsed: warnSync('triggerSelectAllParsed'), triggerCreatePR: warn('triggerCreatePR'),
                 triggerUpdateBranch: warn('triggerUpdateBranch'),
                 triggerToggleSettingsModal: warnSync('triggerToggleSettingsModal'),
                 scrollToSection: warnSync('scrollToSection'),
                 getXuinityMessage: () => "Context unavailable",
                 updateRepoUrlInAssistant: warnSync('updateRepoUrlInAssistant'),
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
      const [loadingPrs, setLoadingPrsState] = useState(false);
      const [openPrs, setOpenPrsState] = useState<SimplePullRequest[]>([]);
      const [currentAiRequestId, setCurrentAiRequestIdState] = useState<string | null>(null); // Added state
      const [isParsing, setIsParsingState] = useState(false); // <-- Added Parsing State

      // Branch state management
      const [manualBranchName, setManualBranchNameState] = useState<string>(""); // Manual input value
      const [selectedPrBranch, setSelectedPrBranchState] = useState<string | null>(null); // Branch selected from PR list
      // Derived state: The actual target branch to use for actions
      const [targetBranchName, setTargetBranchNameState] = useState<string | null>(null);

       // Effect to update targetBranchName when manual or PR selection changes
        useEffect(() => {
            const trimmedManual = manualBranchName.trim();
            if (trimmedManual) {
                setTargetBranchNameState(trimmedManual); // Manual input takes priority
            } else {
                setTargetBranchNameState(selectedPrBranch); // Otherwise use PR selection (or null for default)
            }
        }, [manualBranchName, selectedPrBranch]);


      const [isSettingsModalOpen, setIsSettingsModalOpenState] = useState(false);


      // Derive current workflow step based on context state
      const getCurrentStep = useCallback((): WorkflowStep => {
        // Handle loading states first
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (aiActionLoading && !aiResponseHasContent) return 'generating_ai_response'; // Specific AI gen loading
        if (isParsing) return 'parsing_response'; // <-- Explicit Parsing state
        if (assistantLoading && filesParsed) return 'pr_ready'; // Assume PR/Update loading if files are parsed

        // Handle non-loading states
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (!repoUrlEntered) return 'need_repo_url';
        if (!filesFetched) return 'ready_to_fetch';

        // Files are fetched, now check assistant side
        if (aiResponseHasContent) {
             if (!filesParsed) return 'response_pasted';
             // If parsed, check if ready for PR/Update (needs selected files)
             if (selectedAssistantFiles.size > 0) return 'pr_ready';
             // If parsed but no files selected yet
             return 'response_parsed';
        }
        // If no AI response yet
        if (requestCopied) return 'request_copied';
        if (kworkInputHasContent) return 'request_written';
        if (selectedFetcherFiles.size > 0) return 'files_selected';
        if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights';
        return 'files_fetched'; // Base state after successful fetch

      }, [
        fetchStatus, repoUrlEntered, filesFetched, aiActionLoading, assistantLoading, isParsing, // <-- Added isParsing dependency
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
            setSelectedFetcherFilesState(new Set());
            setKworkInputHasContentState(false);
            setRequestCopiedState(false);
            setAiResponseHasContentState(false);
            setFilesParsedState(false);
            setSelectedAssistantFilesState(new Set());
            setAssistantLoadingState(false);
            setAiActionLoadingState(false);
            setIsParsingState(false); // Reset parsing state
             if (assistantRef.current) assistantRef.current.setResponseValue("");
        } else {
            setFetchStatusState('success'); // Ensure status is success if files are fetched
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
              setCurrentAiRequestIdState(null); // Clear request ID if response cleared
          }
      }, []);
      const setFilesParsedCallback = useCallback((parsed: boolean) => {
          setFilesParsedState(parsed);
          if (!parsed) {
              setSelectedAssistantFilesState(new Set());
          }
          setIsParsingState(false); // Parsing finished
          setAssistantLoadingState(false); // Turn off general loading after parsing attempt
      }, []);
      const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
      const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);
      const setAiActionLoadingCallback = useCallback((loading: boolean) => setAiActionLoadingState(loading), []);

       // Setter for PR branch selection
       const setTargetBranchNameFromPr = useCallback((branch: string | null) => {
            setSelectedPrBranchState(branch);
            // Manual branch is NOT cleared here; the useEffect handles priority
       }, []);

       // Setter for manual branch input
       const setManualBranchNameInput = useCallback((branch: string) => {
            setManualBranchNameState(branch);
            // Manual branch setting directly updates targetBranchName via useEffect
       }, []);

      const setOpenPrsCallback = useCallback((prs: SimplePullRequest[]) => setOpenPrsState(prs), []);
      const setLoadingPrsCallback = useCallback((loading: boolean) => setLoadingPrsState(loading), []);
      const setIsSettingsModalOpenCallback = useCallback((isOpen: boolean) => setIsSettingsModalOpenState(isOpen), []);
      const setCurrentAiRequestIdCallback = useCallback((id: string | null) => setCurrentAiRequestIdState(id), []); // Added setter
      const setIsParsingCallback = useCallback((parsing: boolean) => setIsParsingState(parsing), []); // <-- Added Setter Implementation


      // --- Action Triggers ---
      const triggerFetch = useCallback(async (isManualRetry = false) => {
        if (fetcherRef.current) {
            // The handleFetch method in the ref now receives the effective targetBranchName from this context state
            console.log("Context triggerFetch: Using branch ->", targetBranchName ?? "Default");
            await fetcherRef.current.handleFetch(isManualRetry, targetBranchName);
        } else { console.warn("triggerFetch: fetcherRef not ready."); }
      }, [fetcherRef, targetBranchName]); // Depend on effective targetBranchName

      const triggerGetOpenPRs = useCallback(async (repoUrl: string) => {
            if (!repoUrl || !repoUrl.includes('github.com')) {
                toast.error("Укажите валидный URL репозитория GitHub в настройках.");
                return;
            }
            setLoadingPrsState(true);
            setOpenPrsState([]); // Clear previous PRs
            // Clear branch selections when loading new PRs for a potentially different repo
            setTargetBranchNameFromPr(null);
            setManualBranchNameInput("");
            try {
                const result = await getOpenPullRequests(repoUrl);
                if (result.success && result.pullRequests) {
                    setOpenPrsState(result.pullRequests);
                    toast.success(`Загружено ${result.pullRequests.length} открытых PR.`);
                } else {
                    toast.error(`Ошибка загрузки PR: ${result.error || 'Неизвестная ошибка'}`);
                    // Do not clear PRs on error, maybe show previous list? Or keep empty.
                    // setOpenPrsState([]);
                }
            } catch (error) {
                 toast.error("Критическая ошибка при загрузке PR.");
                 console.error("triggerGetOpenPRs error:", error);
                 setOpenPrsState([]); // Clear PRs on critical error
            } finally {
                 setLoadingPrsState(false);
            }
       // eslint-disable-next-line react-hooks/exhaustive-deps
       }, []); // No dependencies needed as it uses passed repoUrl

       const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger' | 'settings-modal-trigger-assistant') => {
        let element: HTMLElement | null = null;
        const targetId = (id === 'assistant' || id === 'executor') ? 'executor'
                        : (id === 'fetcher' ? 'extractor'
                        : (id === 'settingsModalTrigger' ? 'settings-modal-trigger-assistant' // Map to specific button ID
                        : id));
        switch(targetId) {
           case 'kworkInput': element = kworkInputRef.current; break;
           case 'aiResponseInput': element = aiResponseInputRef.current; break;
           case 'prSection': element = prSectionRef.current; break;
           case 'extractor': element = document.getElementById('extractor'); break;
           case 'executor': element = document.getElementById('executor'); break;
           case 'settings-modal-trigger-assistant': element = document.getElementById('settings-modal-trigger-assistant'); break;
        }
        if (element) {
            // Scroll elements within assistant/fetcher into center view for better focus
            if (targetId === 'kworkInput' || targetId === 'aiResponseInput' || targetId === 'prSection' || targetId === 'settings-modal-trigger-assistant') {
                 element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else { // Scroll main sections with top offset
                const rect = element.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
            }
        } else console.warn(`scrollToSection: Element for id "${targetId}" (mapped from "${id}") not found.`);
     }, [kworkInputRef, aiResponseInputRef, prSectionRef]);


      const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted: fetcherRef not ready."); }, [fetcherRef]);
      const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => { if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi, filesToAddParam); else console.warn("triggerAddSelectedToKwork: fetcherRef not ready."); }, [fetcherRef]);
      const triggerCopyKwork = useCallback(() => { if (fetcherRef.current) { const copied = fetcherRef.current.handleCopyToClipboard(); if (copied) { setRequestCopiedState(true); setAiResponseHasContentState(false); if (assistantRef.current) assistantRef.current.setResponseValue(""); } } else console.warn("triggerCopyKwork: fetcherRef not ready."); }, [fetcherRef, assistantRef]);
      const triggerAskAi = useCallback(async () => {
           if (!fetcherRef.current || !assistantRef.current) { toast.error("Компоненты не готовы."); return; }
           const kworkValue = fetcherRef.current.getKworkInputValue(); if (!kworkValue.trim()) { toast.error("Нет запроса для AI."); return; }
           setAiActionLoadingState(true); // Set AI loading true
           setCurrentAiRequestIdCallback(null); // Clear previous ID
           setAiResponseHasContentState(false); // Clear previous response visually
           assistantRef.current.setResponseValue(""); // Clear textarea value
           toast.info("Отправка запроса AI...");
           scrollToSection('executor');
           try {
               // Call the AI action (assuming it returns a request ID now)
               const result = await generateAiCode(kworkValue); // Adapt if it returns an ID
               if (result.success && result.requestId) { // Check for requestId
                   toast.success("Запрос AI отправлен! ID: " + result.requestId.substring(0,8));
                   setCurrentAiRequestIdCallback(result.requestId); // Store the new request ID
                   // Do NOT set response content here; wait for Realtime/polling
               } else {
                   toast.error(`Ошибка отправки запроса AI: ${result.error || 'Unknown error'}`);
                   setAiActionLoadingState(false); // Turn off loading on immediate failure
                   setCurrentAiRequestIdCallback(null);
               }
           } catch (error) {
               toast.error("Крит. ошибка вызова AI.");
               console.error("triggerAskAi error:", error);
               setAiActionLoadingState(false); // Turn off loading on critical error
               setCurrentAiRequestIdCallback(null);
           }
           // Keep aiActionLoading true while waiting for response via Realtime/polling
           // It should be set to false when the response arrives or timeout occurs.
       }, [fetcherRef, assistantRef, scrollToSection]); // Dependencies

      // You would need a separate mechanism (useEffect with Supabase Realtime listener or polling)
      // to listen for the AI response associated with `currentAiRequestId`.
      // When the response arrives:
      // 1. Call assistantRef.current.setResponseValue(responseText)
      // 2. setAiResponseHasContentCallback(true)
      // 3. setAiActionLoadingState(false)
      // 4. setCurrentAiRequestIdCallback(null)
      // 5. Potentially triggerParseResponse()

      const triggerParseResponse = useCallback(async () => {
          if (assistantRef.current) {
             setIsParsingState(true); // <-- Start parsing state
             setAssistantLoadingState(true); // General loading can also be true
             await assistantRef.current.handleParse();
             // Setters for parsing/loading state are called inside the handleParse completion within the assistant
          } else { console.warn("triggerParseResponse: assistantRef not ready."); }
      }, [assistantRef]); // Dependency on assistantRef
      const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed: assistantRef not ready."); }, [assistantRef]);
      const triggerCreatePR = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleCreatePR(); else console.warn("triggerCreatePR: assistantRef not ready."); }, [assistantRef]);
      const triggerUpdateBranch = useCallback(async ( repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string ): Promise<ReturnType<typeof updateBranch>> => {
           setAssistantLoadingState(true);
           try {
                console.log(`Context triggerUpdateBranch: Calling action for branch '${branchName}'`);
                const result = await updateBranch(repoUrl, files, commitMessage, branchName);
                // Success/Error toasts are handled within the AICodeAssistant callback now
                return result;
           } catch (error) {
                toast.error(`Критическая ошибка при обновлении ветки '${branchName}'.`); console.error("triggerUpdateBranch error:", error);
                return { success: false, error: "Client-side error during update trigger." };
           } finally { setAssistantLoadingState(false); }
       }, []);
      const triggerToggleSettingsModal = useCallback(() => setIsSettingsModalOpenState(prev => !prev), []);




      // --- Xuinity Message Logic ---
       const getXuinityMessage = useCallback((): string => {
        const effectiveBranch = targetBranchName; // Use the derived target branch state
        const branchInfo = effectiveBranch ? ` (ветка: ${effectiveBranch})` : '';
        switch (currentStep) {
          case 'idle': return "Контекст инициализируется...";
          case 'need_repo_url': return "Укажи URL репозитория в настройках.";
          case 'ready_to_fetch': return repoUrlEntered ? `Готов извлечь файлы${branchInfo}. Нажми Fetch!` : "Сначала укажи URL.";
          case 'fetching': return `Извлекаю файлы${branchInfo}... ${fetchStatus === 'retrying' ? '(Повтор...)' : ''} ⏳`;
          case 'fetch_failed': return `Не удалось извлечь файлы${branchInfo}. 😢 Попробовать еще раз?`;
          case 'files_fetched': return `Файлы извлечены${branchInfo}! Выбери нужные или опиши задачу.`;
          case 'files_fetched_highlights': return `Файлы извлечены${branchInfo}. Есть связанные.`;
          case 'files_selected': return `Файлы выбраны${branchInfo}! Добавь в запрос ИЛИ нажми '🤖 Спросить AI'!`;
          case 'request_written': return "Запрос готов! Нажми '🤖 Спросить AI' ИЛИ скопируй.";
          case 'generating_ai_response': return "Общаюсь с Gemini... 🤖💭";
          case 'request_copied': return "Скопировано! Жду ответ от AI.";
          case 'response_pasted': return "Ответ получен! Нажми '➡️' для разбора.";
          case 'parsing_response': return "Разбираю ответ AI... 🧠"; // <-- Updated message for parsing
          case 'response_parsed': return "Разобрал! Проверь, выбери файлы.";
          case 'pr_ready': return assistantLoading ? (effectiveBranch ? "Обновляю ветку..." : "Создаю PR...") : (effectiveBranch ? `Готов обновить ветку '${effectiveBranch}'?` : "Готов создать Pull Request?");
          default: return "Что делаем дальше?";
        }
      }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, targetBranchName, isParsing]); // <-- Added isParsing dependency


      // --- Callback for Repo URL update ---
      const updateRepoUrlInAssistant = useCallback((url: string) => {
         if(assistantRef.current) {
            assistantRef.current.updateRepoUrl(url);
         }
      }, [assistantRef]);


      // --- Context Value ---
      const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
        secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        loadingPrs, openPrs, targetBranchName, manualBranchName, isSettingsModalOpen, currentAiRequestId, isParsing, // Added state
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
        setFetchStatus: setFetchStatusCallback, setRepoUrlEntered: setRepoUrlEnteredCallback,
        setFilesFetched: setFilesFetchedCallback, setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback, setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback, setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback, setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback,
        // Pass specific setters for branch state
        setTargetBranchName: setTargetBranchNameFromPr,
        setManualBranchName: setManualBranchNameInput,
        setOpenPrs: setOpenPrsCallback, // Correct setter passed
        setLoadingPrs: setLoadingPrsCallback, setIsSettingsModalOpen: setIsSettingsModalOpenCallback,
        setCurrentAiRequestId: setCurrentAiRequestIdCallback, // Added setter
        setIsParsing: setIsParsingCallback, // <-- Added Setter
        triggerFetch, triggerGetOpenPRs, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        triggerUpdateBranch, triggerToggleSettingsModal, scrollToSection,
        getXuinityMessage, updateRepoUrlInAssistant,
      };

      return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
    };