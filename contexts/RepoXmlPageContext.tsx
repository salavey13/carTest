// /contexts/RepoXmlPageContext.tsx
"use client";

    import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject } from 'react';
    import { generateAiCode } from '@/app/ai_actions/actions';
    import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions'; // Added updateBranch
    import { toast } from "sonner";

    // Define Ref Interfaces
    export interface RepoTxtFetcherRef {
        handleFetch: (isManualRetry?: boolean, branchName?: string | null) => Promise<void>;
        selectHighlightedFiles: () => void;
        handleAddSelected: (autoAskAi?: boolean) => Promise<void>;
        handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
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
      assistantLoading: boolean; // General Assistant loading (parse, PR create/update)
      aiActionLoading: boolean; // Specific AI generation loading
      loadingPrs: boolean;
      openPrs: SimplePullRequest[];
      targetBranchName: string | null; // Final target branch (Manual > PR > Null/Default)
      manualBranchName: string; // User manual input
      isSettingsModalOpen: boolean; // Modal state

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
      setTargetBranchName: (branch: string | null) => void;
      setManualBranchName: (branch: string) => void;
      setOpenPrs: (prs: SimplePullRequest[]) => void;
      setLoadingPrs: (loading: boolean) => void;
      setIsSettingsModalOpen: (isOpen: boolean) => void; // Modal setter

      // Action Triggers
      triggerFetch: (isManualRetry?: boolean) => Promise<void>;
      triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
      triggerSelectHighlighted: () => void;
      triggerAddSelectedToKwork: (autoAskAi?: boolean) => Promise<void>;
      triggerCopyKwork: () => void;
      triggerAskAi: () => Promise<void>;
      triggerParseResponse: () => Promise<void>;
      triggerSelectAllParsed: () => void;
      triggerCreatePR: () => Promise<void>; // Points to assistant's handleCreateOrUpdatePR
      triggerUpdateBranch: (repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string) => Promise<ReturnType<typeof updateBranch>>; // Specific update action trigger
      triggerToggleSettingsModal: () => void; // Modal toggle trigger
      scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger') => void;

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
            return {
                 currentStep: 'idle', fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false,
                 primaryHighlightedPath: null, secondaryHighlightedPaths: [], selectedFetcherFiles: new Set(),
                 kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false,
                 filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false,
                 loadingPrs: false, openPrs: [], targetBranchName: null, manualBranchName: "",
                 isSettingsModalOpen: false,
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
      const [targetBranchName, setTargetBranchNameState] = useState<string | null>(null);
      const [manualBranchName, setManualBranchNameState] = useState<string>("");
      const [isSettingsModalOpen, setIsSettingsModalOpenState] = useState(false);


      // Derive current workflow step based on context state
      const getCurrentStep = useCallback((): WorkflowStep => {
        if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
        if (fetchStatus === 'failed_retries') return 'fetch_failed';
        if (aiActionLoading) return 'generating_ai_response';
        if (assistantLoading) {
            if (!filesParsed) return 'parsing_response'; // Assume parsing if files not parsed
            return 'pr_ready'; // Assume PR create/update if parsed
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
          }
      }, []);
      const setFilesParsedCallback = useCallback((parsed: boolean) => {
          setFilesParsedState(parsed);
          if (!parsed) {
              setSelectedAssistantFilesState(new Set());
          }
          setAssistantLoadingState(false); // Turn off general loading after parsing attempt
      }, []);
      const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
      const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);
      const setAiActionLoadingCallback = useCallback((loading: boolean) => setAiActionLoadingState(loading), []);
      const setTargetBranchNameCallback = useCallback((branch: string | null) => {
          setTargetBranchNameState(branch);
          // If a PR branch is deselected (branch is null), and manual is empty, ensure target is null
          if (branch === null && !manualBranchName.trim()) {
             setTargetBranchNameState(null);
          }
          // If a PR branch is selected, ensure manual input doesn't conflict visually (clear it)
          // This is handled by the handleSelectPrBranch callback in Fetcher/Modal now
       }, [manualBranchName]); // Dependency needed to check manual input when deselecting PR branch

      const setManualBranchNameCallback = useCallback((branch: string) => {
          setManualBranchNameState(branch);
          // Update targetBranch based on manual input (overrides PR selection)
          // If manual input is cleared, targetBranchName becomes null (unless a PR was selected - this logic needs care)
          const trimmedBranch = branch.trim();
          // Simple override: If manual has value, use it. Otherwise, let PR selection dictate.
          // The state `targetBranchName` should reflect the *effective* target.
          // If user clears manual input, what should happen? Revert to PR selection or default?
          // Let's say clearing manual means "use PR selection or default".
          if (trimmedBranch) {
             setTargetBranchNameState(trimmedBranch); // Manual input takes precedence
          } else {
             // Manual input is empty. What was selected before?
             // This requires knowing the source of the current targetBranchName, which is tricky.
             // Simpler approach: The component calling this setter should handle the logic.
             // Here, just set manualBranchName. The targetBranchName logic is better handled
             // in the component or via `setTargetBranchNameCallback`.
             // Let's refine: If manual becomes empty, revert targetBranchName based on PR list state?
             // Find if any PR branch is currently "selected" visually in the modal.
             // This state isn't directly here.
             // Fallback: If manual is cleared, set targetBranchName to null (meaning default/PR)
             setTargetBranchNameState(null); // Revert to PR selection / default
          }
      }, []); // No dependency on targetBranchName here, avoid loop

      const setOpenPrsCallback = useCallback((prs: SimplePullRequest[]) => setOpenPrsState(prs), []);
      const setLoadingPrsCallback = useCallback((loading: boolean) => setLoadingPrsState(loading), []);
      const setIsSettingsModalOpenCallback = useCallback((isOpen: boolean) => setIsSettingsModalOpenState(isOpen), []);


      // --- Action Triggers ---
      const triggerFetch = useCallback(async (isManualRetry = false) => {
        if (fetcherRef.current) {
            // Determine final branch: Manual > Selected PR > Default (null)
            const branchToFetch = manualBranchName.trim() || targetBranchName; // Prioritize manual input
            console.log("Context triggerFetch: Using branch ->", branchToFetch ?? "Default");
            await fetcherRef.current.handleFetch(isManualRetry, branchToFetch);
        } else { console.warn("triggerFetch: fetcherRef not ready."); }
      }, [fetcherRef, targetBranchName, manualBranchName]); // Depend on both branch states

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
                    setOpenPrsState(result.pullRequests as SimplePullRequest[]);
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
       }, []);

      const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted: fetcherRef not ready."); }, [fetcherRef]);
      const triggerAddSelectedToKwork = useCallback(async (autoAskAi = false) => { if (fetcherRef.current) await fetcherRef.current.handleAddSelected(autoAskAi); else console.warn("triggerAddSelectedToKwork: fetcherRef not ready."); }, [fetcherRef]);
      const triggerCopyKwork = useCallback(() => { if (fetcherRef.current) { const copied = fetcherRef.current.handleCopyToClipboard(); if (copied) { setRequestCopiedState(true); setAiResponseHasContentState(false); if (assistantRef.current) assistantRef.current.setResponseValue(""); } } else console.warn("triggerCopyKwork: fetcherRef not ready."); }, [fetcherRef, assistantRef]);
      const triggerAskAi = useCallback(async () => {
           if (!fetcherRef.current || !assistantRef.current) { toast.error("Компоненты не готовы."); return; }
           const kworkValue = fetcherRef.current.getKworkInputValue(); if (!kworkValue.trim()) { toast.error("Нет запроса для AI."); return; }
           setAiActionLoadingState(true); setAiResponseHasContentState(false); assistantRef.current.setResponseValue(""); toast.info("Отправка запроса AI..."); scrollToSection('executor');
           try {
               const result = await generateAiCode(kworkValue);
               if (result.success && result.text) {
                   toast.success("Ответ AI получен!"); assistantRef.current.setResponseValue(result.text); setAiResponseHasContentState(true);
                   setTimeout(() => triggerParseResponse(), 100); // Auto-parse
               } else { toast.error(`Ошибка AI: ${result.error || 'Unknown'}`); setAiResponseHasContentState(false); }
           } catch (error) { toast.error("Крит. ошибка вызова AI."); console.error("triggerAskAi error:", error); setAiResponseHasContentState(false); }
           finally { setAiActionLoadingState(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
       }, [fetcherRef, assistantRef]); // Removed triggerParseResponse from deps
      const triggerParseResponse = useCallback(async () => { if (assistantRef.current) { setAssistantLoadingState(true); await assistantRef.current.handleParse(); } else console.warn("triggerParseResponse: assistantRef not ready."); }, [assistantRef]);
      const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed: assistantRef not ready."); }, [assistantRef]);
      const triggerCreatePR = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleCreatePR(); else console.warn("triggerCreatePR: assistantRef not ready."); }, [assistantRef]);
      const triggerUpdateBranch = useCallback(async ( repoUrl: string, files: { path: string; content: string }[], commitMessage: string, branchName: string ): Promise<ReturnType<typeof updateBranch>> => {
           setAssistantLoadingState(true);
           try {
                console.log(`Context triggerUpdateBranch: Calling action for branch '${branchName}'`);
                const result = await updateBranch(repoUrl, files, commitMessage, branchName);
                // Success/Error toasts are handled within the callback now
                // if (result.success) toast.success(`Ветка '${branchName}' успешно обновлена!`);
                // else toast.error(`Ошибка обновления ветки '${branchName}': ${result.error}`);
                return result;
           } catch (error) {
                toast.error(`Критическая ошибка при обновлении ветки '${branchName}'.`); console.error("triggerUpdateBranch error:", error);
                return { success: false, error: "Client-side error during update trigger." };
           } finally { setAssistantLoadingState(false); }
       }, []);
      const triggerToggleSettingsModal = useCallback(() => setIsSettingsModalOpenState(prev => !prev), []);

      const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant' | 'executor' | 'settingsModalTrigger') => {
         let element: HTMLElement | null = null;
         const targetId = (id === 'assistant' || id === 'executor') ? 'executor'
                         : (id === 'fetcher' ? 'extractor'
                         : (id === 'settingsModalTrigger' ? 'settings-modal-trigger-assistant'
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
             if (targetId === 'kworkInput' || targetId === 'aiResponseInput' || targetId === 'prSection' || targetId === 'settings-modal-trigger-assistant') {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
             } else {
                 const rect = element.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
             }
         } else console.warn(`scrollToSection: Element for id "${targetId}" (mapped from "${id}") not found.`);
      }, [kworkInputRef, aiResponseInputRef, prSectionRef]);


      // --- Xuinity Message Logic ---
       const getXuinityMessage = useCallback((): string => {
        const effectiveBranch = manualBranchName.trim() || targetBranchName;
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
          case 'parsing_response': return "Разбираю ответ AI... 🧠";
          case 'response_parsed': return "Разобрал! Проверь, выбери файлы.";
          case 'pr_ready': return assistantLoading ? (effectiveBranch ? "Обновляю ветку..." : "Создаю PR...") : (effectiveBranch ? `Готов обновить ветку '${effectiveBranch}'?` : "Готов создать Pull Request?");
          default: return "Что делаем дальше?";
        }
      }, [currentStep, repoUrlEntered, fetchStatus, assistantLoading, targetBranchName, manualBranchName]);


      // --- Callback for Repo URL update ---
      const updateRepoUrlInAssistant = useCallback((url: string) => {
          // This callback is primarily for the Assistant to inform the context/fetcher
          // if its internal URL state changes. We might reset PRs/branch here too.
          console.log("Context: Repo URL updated via Assistant to:", url);
          // Maybe reset fetched PRs and branch selection if URL changes?
          // setOpenPrsState([]);
          // setTargetBranchNameState(null);
          // setManualBranchNameState("");
      }, []);


      // --- Context Value ---
      const value: RepoXmlPageContextType = {
        currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
        secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
        aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading, aiActionLoading,
        loadingPrs, openPrs, targetBranchName, manualBranchName, isSettingsModalOpen,
        fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
        setFetchStatus: setFetchStatusCallback, setRepoUrlEntered: setRepoUrlEnteredCallback,
        setFilesFetched: setFilesFetchedCallback, setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
        setKworkInputHasContent: setKworkInputHasContentCallback, setRequestCopied: setRequestCopiedCallback,
        setAiResponseHasContent: setAiResponseHasContentCallback, setFilesParsed: setFilesParsedCallback,
        setSelectedAssistantFiles: setSelectedAssistantFilesCallback, setAssistantLoading: setAssistantLoadingCallback,
        setAiActionLoading: setAiActionLoadingCallback, setTargetBranchName: setTargetBranchNameCallback,
        setManualBranchName: setManualBranchNameCallback, setOpenPrs: setOpenPrsCallback,
        setLoadingPrs: setLoadingPrsCallback, setIsSettingsModalOpen: setIsSettingsModalOpenCallback,
        triggerFetch, triggerGetOpenPRs, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreatePR,
        triggerUpdateBranch, triggerToggleSettingsModal, scrollToSection,
        getXuinityMessage, updateRepoUrlInAssistant,
      };

      return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
    };