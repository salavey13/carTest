"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject } from 'react';

// Define Ref Interfaces (Crucial for type safety)
export interface RepoTxtFetcherRef {
    handleFetch: () => Promise<void>;
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

export type WorkflowStep =
  | 'idle'
  | 'need_fetch'
  | 'files_fetched'
  | 'files_selected' // Implies files are fetched
  | 'request_written' // Implies files might be selected
  | 'request_copied'
  | 'response_pasted'
  | 'response_parsed'
  | 'parsed_files_selected' // Kept for clarity, might lead to pr_ready
  | 'pr_ready'; // Implies parsed files selected

interface RepoXmlPageContextType {
  // State Flags
  currentStep: WorkflowStep;
  repoUrlEntered: boolean;
  filesFetched: boolean;
  primaryHighlightedPath: string | null;
  secondaryHighlightedPaths: string[];
  selectedFetcherFiles: Set<string>; // Files selected in RepoTxtFetcher
  kworkInputHasContent: boolean;
  requestCopied: boolean;
  aiResponseHasContent: boolean;
  filesParsed: boolean;
  selectedAssistantFiles: Set<string>; // Files selected in AICodeAssistant
  assistantLoading: boolean; // Centralized loading state for Assistant actions

  // Refs for scrolling/actions (populated by components)
  fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>; // Use specific type
  assistantRef: MutableRefObject<AICodeAssistantRef | null>; // Use specific type
  kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  prSectionRef: MutableRefObject<HTMLElement | null>;

  // Updater Functions (called by components)
  setRepoUrlEntered: (entered: boolean) => void;
  setFilesFetched: (fetched: boolean, primaryPath?: string | null, secondaryPaths?: string[]) => void;
  setSelectedFetcherFiles: (files: Set<string>) => void;
  setKworkInputHasContent: (hasContent: boolean) => void;
  setRequestCopied: (copied: boolean) => void;
  setAiResponseHasContent: (hasContent: boolean) => void;
  setFilesParsed: (parsed: boolean) => void;
  setSelectedAssistantFiles: (files: Set<string>) => void;
  setAssistantLoading: (loading: boolean) => void; // Setter for loading state

  // Action Triggers (called by StickyChatButton or other UI)
  triggerFetch: () => Promise<void>;
  triggerSelectHighlighted: () => void;
  triggerAddSelectedToKwork: () => void;
  triggerCopyKwork: () => void;
  triggerParseResponse: () => Promise<void>; // Mark as async
  triggerSelectAllParsed: () => void;
  triggerCreatePR: () => Promise<void>; // Mark as async
  scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant') => void;

  // Xuinity Messages (optional, can derive in StickyChatButton)
  getXuinityMessage: () => string;
}

const RepoXmlPageContext = createContext<RepoXmlPageContextType | undefined>(undefined);

export const useRepoXmlPageContext = () => {
  const context = useContext(RepoXmlPageContext);
  if (context === undefined) {
    // Return a default/stub object ONLY if absolutely necessary and handle it gracefully where used
    // It's better to ensure the provider wraps the component tree.
    console.error('useRepoXmlPageContext must be used within a RepoXmlPageProvider. Returning stub.');
     // Provide default functions that warn if called unexpectedly
     const warn = (name: string) => () => { console.warn(`Context not available: ${name} called.`); return Promise.resolve(); };
     const warnSync = (name: string) => () => { console.warn(`Context not available: ${name} called.`); };
     const warnBool = (name: string) => () => { console.warn(`Context not available: ${name} called.`); return false };
     return {
        currentStep: 'idle',
        repoUrlEntered: false,
        filesFetched: false,
        primaryHighlightedPath: null,
        secondaryHighlightedPaths: [],
        selectedFetcherFiles: new Set(),
        kworkInputHasContent: false,
        requestCopied: false,
        aiResponseHasContent: false,
        filesParsed: false,
        selectedAssistantFiles: new Set(),
        assistantLoading: false,
        fetcherRef: { current: null },
        assistantRef: { current: null },
        kworkInputRef: { current: null },
        aiResponseInputRef: { current: null },
        prSectionRef: { current: null },
        setRepoUrlEntered: warnSync('setRepoUrlEntered'),
        setFilesFetched: warnSync('setFilesFetched'),
        setSelectedFetcherFiles: warnSync('setSelectedFetcherFiles'),
        setKworkInputHasContent: warnSync('setKworkInputHasContent'),
        setRequestCopied: warnSync('setRequestCopied'),
        setAiResponseHasContent: warnSync('setAiResponseHasContent'),
        setFilesParsed: warnSync('setFilesParsed'),
        setSelectedAssistantFiles: warnSync('setSelectedAssistantFiles'),
        setAssistantLoading: warnSync('setAssistantLoading'),
        triggerFetch: warn('triggerFetch'),
        triggerSelectHighlighted: warnSync('triggerSelectHighlighted'),
        triggerAddSelectedToKwork: warnSync('triggerAddSelectedToKwork'),
        triggerCopyKwork: warnSync('triggerCopyKwork'),
        triggerParseResponse: warn('triggerParseResponse'),
        triggerSelectAllParsed: warnSync('triggerSelectAllParsed'),
        triggerCreatePR: warn('triggerCreatePR'),
        scrollToSection: warnSync('scrollToSection'),
        getXuinityMessage: () => "Context unavailable",
     } as RepoXmlPageContextType; // Cast needed for stub
  }
  return context;
};

interface RepoXmlPageProviderProps {
  children: ReactNode;
  fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>; // Use specific type
  assistantRef: MutableRefObject<AICodeAssistantRef | null>; // Use specific type
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
  const [repoUrlEntered, setRepoUrlEnteredState] = useState(false); // Default to false
  const [filesFetched, setFilesFetchedState] = useState(false);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<string[]>([]);
  const [selectedFetcherFiles, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
  const [kworkInputHasContent, setKworkInputHasContentState] = useState(false);
  const [requestCopied, setRequestCopiedState] = useState(false);
  const [aiResponseHasContent, setAiResponseHasContentState] = useState(false);
  const [filesParsed, setFilesParsedState] = useState(false);
  const [selectedAssistantFiles, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());
  const [assistantLoading, setAssistantLoadingState] = useState(false); // Add loading state

  // Derive current workflow step
  const getCurrentStep = useCallback((): WorkflowStep => {
    if (!repoUrlEntered) return 'need_fetch';
    if (!filesFetched) return 'need_fetch';
    if (requestCopied) {
        if (!aiResponseHasContent) return 'request_copied';
        if (!filesParsed) return 'response_pasted';
        if (selectedAssistantFiles.size === 0) return 'response_parsed';
        // We have parsed files selected
        return 'pr_ready'; // Simplified 'parsed_files_selected' into 'pr_ready' state
    }
    if (kworkInputHasContent) {
        // Request is written, maybe files are selected maybe not, but ready to copy
        return 'request_written';
    }
    if (selectedFetcherFiles.size > 0) {
        // Files selected in fetcher, but not added to kwork yet
        return 'files_selected';
    }
    // Default if only files fetched but nothing selected/written
    return 'files_fetched';
  }, [
    repoUrlEntered, filesFetched, selectedFetcherFiles.size, kworkInputHasContent, // Use size for Set dependency
    requestCopied, aiResponseHasContent, filesParsed, selectedAssistantFiles.size // Use size for Set dependency
  ]);

  const currentStep = getCurrentStep();

  // --- Updaters (Memoized) ---
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
    }
  }, []); // No external deps needed for setters

  const setSelectedFetcherFilesCallback = useCallback((files: Set<string>) => {
    setSelectedFetcherFilesState(files);
  }, []);

  const setKworkInputHasContentCallback = useCallback((hasContent: boolean) => {
      setKworkInputHasContentState(hasContent);
      // Optionally reset copied flag if input is cleared AFTER copy
      // if (!hasContent && requestCopied) { setRequestCopiedState(false); }
  }, []); // requestCopied dependency removed unless used in logic

  const setRequestCopiedCallback = useCallback((copied: boolean) => {
      setRequestCopiedState(copied);
  }, []);

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
  }, []);

  const setSelectedAssistantFilesCallback = useCallback((files: Set<string>) => {
      setSelectedAssistantFilesState(files);
  }, []);

  const setAssistantLoadingCallback = useCallback((loading: boolean) => {
      setAssistantLoadingState(loading);
  }, []);

  // --- Action Triggers (Memoized) ---
  const triggerFetch = useCallback(async () => {
    if (fetcherRef.current) {
        await fetcherRef.current.handleFetch();
    } else { console.warn("triggerFetch called but fetcherRef is not yet available."); }
  }, [fetcherRef]);

  const triggerSelectHighlighted = useCallback(() => {
    if (fetcherRef.current) {
        fetcherRef.current.selectHighlightedFiles();
    } else { console.warn("triggerSelectHighlighted called but fetcherRef is not yet available."); }
  }, [fetcherRef]);

  const triggerAddSelectedToKwork = useCallback(() => {
    if (fetcherRef.current) {
        fetcherRef.current.handleAddSelected();
    } else { console.warn("triggerAddSelectedToKwork called but fetcherRef is not yet available."); }
  }, [fetcherRef]);

  const triggerCopyKwork = useCallback(() => {
    if (fetcherRef.current) {
        // Returns boolean, but we don't need it here
        fetcherRef.current.handleCopyToClipboard(); // Copies kworkInput, scrolls to AI input
    } else { console.warn("triggerCopyKwork called but fetcherRef is not yet available."); }
  }, [fetcherRef]);

  const triggerParseResponse = useCallback(async () => {
    if (assistantRef.current) {
        await assistantRef.current.handleParse();
    } else { console.warn("triggerParseResponse called but assistantRef is not yet available."); }
  }, [assistantRef]);

   const triggerSelectAllParsed = useCallback(() => {
    if (assistantRef.current) {
        assistantRef.current.selectAllParsedFiles();
    } else { console.warn("triggerSelectAllParsed called but assistantRef is not yet available."); }
   }, [assistantRef]);

  const triggerCreatePR = useCallback(async () => {
    if (assistantRef.current) {
        await assistantRef.current.handleCreatePR();
    } else { console.warn("triggerCreatePR called but assistantRef is not yet available."); }
  }, [assistantRef]);

  const scrollToSection = useCallback((id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant') => {
     let element: HTMLElement | null = null;
     switch(id) {
        case 'kworkInput': element = kworkInputRef.current; break;
        case 'aiResponseInput': element = aiResponseInputRef.current; break;
        case 'prSection': element = prSectionRef.current; break;
        case 'fetcher': element = document.getElementById('extractor'); break;
        case 'assistant': element = document.getElementById('executor'); break;
     }
     if (element) {
         element.scrollIntoView({ behavior: 'smooth', block: 'center' });
     } else {
         console.warn(`scrollToSection: Element for id "${id}" not found.`);
     }
  }, [kworkInputRef, aiResponseInputRef, prSectionRef]);

  // --- Xuinity Message Logic (Memoized) ---
   const getXuinityMessage = useCallback((): string => {
    switch (currentStep) {
      case 'idle': return "Готов помочь с кодом!";
      case 'need_fetch': return repoUrlEntered ? "Время извлечь файлы! Нажми кнопку." : "Сначала укажи URL репозитория.";
      case 'files_fetched': return (primaryHighlightedPath || secondaryHighlightedPaths.length > 0) ? "Файлы извлечены. Есть связанные файлы - выбрать их?" : "Файлы извлечены. Выбери нужные для задачи.";
      case 'files_selected': return "Отлично! Теперь добавь выбранные файлы в запрос.";
      case 'request_written': return "Запрос и контекст готовы. Скопируй и отправь AI!";
      case 'request_copied': return "Скопировано! Жду ответ от AI. Вставляй ниже.";
      case 'response_pasted': return "Ответ получен! Нажми '➡️' чтобы я его разобрал.";
      case 'response_parsed': return "Разобрал ответ. Проверь файлы, выбери нужные для PR.";
      // case 'parsed_files_selected': return "Файлы для PR выбраны. Все готово к созданию PR!"; // Merged into pr_ready
      case 'pr_ready': return "Файлы для PR выбраны. Все готово к созданию PR!";
      default:
           console.warn("Unhandled step in getXuinityMessage:", currentStep);
           return "Что делаем дальше?";
    }
  }, [currentStep, repoUrlEntered, primaryHighlightedPath, secondaryHighlightedPaths]);


  const value: RepoXmlPageContextType = {
    currentStep,
    repoUrlEntered,
    filesFetched,
    primaryHighlightedPath,
    secondaryHighlightedPaths,
    selectedFetcherFiles,
    kworkInputHasContent,
    requestCopied,
    aiResponseHasContent,
    filesParsed,
    selectedAssistantFiles,
    assistantLoading,
    fetcherRef,
    assistantRef,
    kworkInputRef,
    aiResponseInputRef,
    prSectionRef,
    // Pass memoized updaters
    setRepoUrlEntered: setRepoUrlEnteredState, // Direct setter is fine if simple
    setFilesFetched: setFilesFetchedCallback,
    setSelectedFetcherFiles: setSelectedFetcherFilesCallback,
    setKworkInputHasContent: setKworkInputHasContentCallback,
    setRequestCopied: setRequestCopiedCallback,
    setAiResponseHasContent: setAiResponseHasContentCallback,
    setFilesParsed: setFilesParsedCallback,
    setSelectedAssistantFiles: setSelectedAssistantFilesCallback,
    setAssistantLoading: setAssistantLoadingCallback,
    // Pass memoized triggers
    triggerFetch,
    triggerSelectHighlighted,
    triggerAddSelectedToKwork,
    triggerCopyKwork,
    triggerParseResponse,
    triggerSelectAllParsed,
    triggerCreatePR,
    scrollToSection,
    getXuinityMessage,
  };

  return <RepoXmlPageContext.Provider value={value}>{children}</RepoXmlPageContext.Provider>;
};