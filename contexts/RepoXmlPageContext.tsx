"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject } from 'react';

// Define Ref Interfaces
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean) => Promise<void>; // Added optional flag
    selectHighlightedFiles: () => void;
    handleAddSelected: () => void;
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    clearAll: () => void;
}

export interface AICodeAssistantRef {
    handleParse: () => Promise<void>; // Mark as async
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>; // Mark as async
}

// Added fetch status type
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';

export type WorkflowStep =
  | 'idle' // Should ideally not happen if context is used correctly
  | 'need_repo_url' // Explicit state if URL is missing
  | 'ready_to_fetch' // URL entered, ready for initial fetch or retry
  | 'fetching' // Covers loading, retrying
  | 'fetch_failed' // Explicit state after retries exhausted
  | 'files_fetched' // Success, no highlights or files selected yet
  | 'files_fetched_highlights' // Success, highlights available to select
  | 'files_selected' // Files selected in fetcher, ready to add to kwork
  | 'request_written' // Kwork has content, ready to copy
  | 'request_copied' // Kwork copied, waiting for AI response paste
  | 'response_pasted' // AI Response pasted, ready to parse
  | 'parsing_response' // Assistant is parsing
  | 'response_parsed' // Parsing done, validation shown, ready to select files or fix
  | 'pr_ready'; // Parsed files selected, ready to create PR

interface RepoXmlPageContextType {
  // State Flags
  currentStep: WorkflowStep;
  fetchStatus: FetchStatus; // Added fetch status
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
  assistantLoading: boolean; // Loading for Assistant actions (Parse, PR Create)

  // Refs
  fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
  assistantRef: MutableRefObject<AICodeAssistantRef | null>;
  kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  prSectionRef: MutableRefObject<HTMLElement | null>;

  // Updaters
  setFetchStatus: (status: FetchStatus) => void; // Added setter
  setRepoUrlEntered: (entered: boolean) => void;
  setFilesFetched: (fetched: boolean, primaryPath?: string | null, secondaryPaths?: string[]) => void;
  setSelectedFetcherFiles: (files: Set<string>) => void;
  setKworkInputHasContent: (hasContent: boolean) => void;
  setRequestCopied: (copied: boolean) => void;
  setAiResponseHasContent: (hasContent: boolean) => void;
  setFilesParsed: (parsed: boolean) => void;
  setSelectedAssistantFiles: (files: Set<string>) => void;
  setAssistantLoading: (loading: boolean) => void;

  // Action Triggers
  triggerFetch: (isManualRetry?: boolean) => Promise<void>; // Pass retry flag
  triggerSelectHighlighted: () => void;
  triggerAddSelectedToKwork: () => void;
  triggerCopyKwork: () => void;
  triggerParseResponse: () => Promise<void>;
  triggerSelectAllParsed: () => void;
  triggerCreatePR: () => Promise<void>;
  scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant') => void;

  // Messages
  getXuinityMessage: () => string; // Renamed for clarity, used by Buddy
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
        filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false,
        fetcherRef: { current: null }, assistantRef: { current: null }, kworkInputRef: { current: null },
        aiResponseInputRef: { current: null }, prSectionRef: { current: null },
        setFetchStatus: warnSync('setFetchStatus'), setRepoUrlEntered: warnSync('setRepoUrlEntered'),
        setFilesFetched: warnSync('setFilesFetched'), setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
        setKworkInputHasContent: warnSync('setKworkInputHasContent'), setRequestCopied: warnSync('setRequestCopied'),
        setAiResponseHasContent: warnSync('setAiResponseHasContent'), setFilesParsed: warnSync('setFilesParsed'),
        setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'), setAssistantLoading: warnSync('setAssistantLoading'),
        triggerFetch: warn('triggerFetch'), triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
        triggerAddSelectedToKwork: warnSync('triggerAddSelectedToKwork'), triggerCopyKwork: warnSync('triggerCopyKwork'),
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

  // Derive current workflow step based on context state
  const getCurrentStep = useCallback((): WorkflowStep => {
    if (fetchStatus === 'loading' || fetchStatus === 'retrying') return 'fetching';
    if (fetchStatus === 'failed_retries') return 'fetch_failed';
    if (assistantLoading) {
        if (!aiResponseHasContent) return 'fetching'; // Or a specific 'initial_assistant_load' if needed
        if (!filesParsed) return 'parsing_response';
        return 'pr_ready'; // Assume PR creation or post-parse selection if assistant loading after parse
    }

    if (!repoUrlEntered) return 'need_repo_url';
    if (!filesFetched) return 'ready_to_fetch';

    // Files are fetched (fetchStatus === 'success')
    if (requestCopied) {
        if (!aiResponseHasContent) return 'request_copied';
        if (!filesParsed) return 'response_pasted';
        if (selectedAssistantFiles.size === 0) return 'response_parsed';
        return 'pr_ready';
    }
    if (kworkInputHasContent) return 'request_written';
    if (selectedFetcherFiles.size > 0) return 'files_selected';
    if (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) return 'files_fetched_highlights';
    return 'files_fetched';

  }, [
    fetchStatus, repoUrlEntered, filesFetched, assistantLoading,
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
        setSelectedFetcherFilesState(new Set());
        setKworkInputHasContentState(false);
        setRequestCopiedState(false);
        setAiResponseHasContentState(false);
        setFilesParsedState(false);
        setSelectedAssistantFilesState(new Set());
        setAssistantLoadingState(false);
    } else {
        // If fetch succeeded, ensure fetchStatus reflects success explicitly
        // This might override a quick 'retrying' -> 'success' visual glitch
        setFetchStatusState('success');
    }
  }, []);
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
  }, []);
  const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => setSelectedAssistantFilesState(files), []);
  const setAssistantLoadingCallback = useCallback((loading: boolean) => setAssistantLoadingState(loading), []);


  // --- Action Triggers (Memoized) ---
  const triggerFetch = useCallback(async (isManualRetry = false) => {
    if (fetcherRef.current) {
        await fetcherRef.current.handleFetch(isManualRetry);
    } else { console.warn("triggerFetch called but fetcherRef is not yet available."); }
  }, [fetcherRef]);
  const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current) fetcherRef.current.selectHighlightedFiles(); else console.warn("triggerSelectHighlighted called but fetcherRef is not yet available."); }, [fetcherRef]);
  const triggerAddSelectedToKwork = useCallback(() => { if (fetcherRef.current) fetcherRef.current.handleAddSelected(); else console.warn("triggerAddSelectedToKwork called but fetcherRef is not yet available."); }, [fetcherRef]);
  const triggerCopyKwork = useCallback(() => { if (fetcherRef.current) fetcherRef.current.handleCopyToClipboard(); else console.warn("triggerCopyKwork called but fetcherRef is not yet available."); }, [fetcherRef]);
  const triggerParseResponse = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleParse(); else console.warn("triggerParseResponse called but assistantRef is not yet available."); }, [assistantRef]);
  const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current) assistantRef.current.selectAllParsedFiles(); else console.warn("triggerSelectAllParsed called but assistantRef is not yet available."); }, [assistantRef]);
  const triggerCreatePR = useCallback(async () => { if (assistantRef.current) await assistantRef.current.handleCreatePR(); else console.warn("triggerCreatePR called but assistantRef is not yet available."); }, [assistantRef]);
  const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant') => {
     let element: HTMLElement | null = null;
     switch(id) {
        case 'kworkInput': element = kworkInputRef.current; break;
        case 'aiResponseInput': element = aiResponseInputRef.current; break;
        case 'prSection': element = prSectionRef.current; break;
        case 'fetcher': element = document.getElementById('extractor'); break;
        case 'assistant': element = document.getElementById('executor'); break;
     }
     if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
     else { console.warn(`scrollToSection: Element for id "${id}" not found.`); }
  }, [kworkInputRef, aiResponseInputRef, prSectionRef]);

  // --- Xuinity Message Logic (Memoized) ---
   const getXuinityMessage = useCallback((): string => {
    switch (currentStep) {
      case 'idle': return "Контекст инициализируется...";
      case 'need_repo_url': return "Укажи URL репозитория в Экстракторе.";
      case 'ready_to_fetch': return repoUrlEntered ? "Нажми 'Извлечь файлы' или кнопку Fetch ниже!" : "Сначала укажи URL репозитория."; // Should be caught by need_repo_url
      case 'fetching': return `Извлекаю файлы... ${fetchStatus === 'retrying' ? '(Попытка снова...)' : ''} ⏳`;
      case 'fetch_failed': return "Не удалось извлечь файлы после нескольких попыток. 😢 Попробовать еще раз?";
      case 'files_fetched': return "Файлы извлечены! Выбери нужные или опиши задачу.";
      case 'files_fetched_highlights': return "Файлы извлечены. Есть связанные - выбрать их или иди к списку.";
      case 'files_selected': return "Файлы выбраны! Добавь их в запрос для AI.";
      case 'request_written': return "Запрос готов! Копируй и отправляй AI.";
      case 'request_copied': return "Скопировано! Жду ответ от AI. Вставляй в Ассистента.";
      case 'response_pasted': return "Ответ вставлен! Нажми '➡️', чтобы я его разобрал.";
      case 'parsing_response': return "Разбираю ответ AI... 🧠";
      case 'response_parsed': return "Разобрал! Проверь результат, выбери файлы для PR.";
      case 'pr_ready': return "Файлы выбраны! Готов создать Pull Request?";
      default:
           // Exhaustive check guard
           const _exhaustiveCheck: never = currentStep;
           console.warn("Unhandled step in getXuinityMessage:", currentStep);
           return "Что делаем дальше?";
    }
  }, [currentStep, repoUrlEntered, fetchStatus]); // Dependencies look correct


  const value: RepoXmlPageContextType = {
    currentStep, fetchStatus, repoUrlEntered, filesFetched, primaryHighlightedPath,
    secondaryHighlightedPaths, selectedFetcherFiles, kworkInputHasContent, requestCopied,
    aiResponseHasContent, filesParsed, selectedAssistantFiles, assistantLoading,
    fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef, prSectionRef,
    // Pass memoized updaters/setters
    setFetchStatus: setFetchStatusCallback,
    setRepoUrlEntered: setRepoUrlEnteredState, // Direct setter ok
    setFilesFetched: setFilesFetchedCallback,
    setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
    setKworkInputHasContent: setKworkInputHasContentCallback,
    setRequestCopied: setRequestCopiedCallback,
    setAiResponseHasContent: setAiResponseHasContentCallback,
    setFilesParsed: setFilesParsedCallback,
    setSelectedAssistantFiles: setSelectedAssistantFilesCallback,
    setAssistantLoading: setAssistantLoadingCallback,
    // Pass memoized triggers
    triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
    triggerParseResponse, triggerSelectAllParsed, triggerCreatePR, scrollToSection,
    getXuinityMessage,
  };

  return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};