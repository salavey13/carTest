"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, MutableRefObject } from 'react';
import { FileNode } from '@/components/RepoTxtFetcher'; // Assuming FileNode is exported

export type WorkflowStep =
  | 'idle'
  | 'need_fetch'
  | 'files_fetched'
  | 'files_selected' // Implies files are fetched
  | 'request_written' // Implies files might be selected
  | 'request_copied'
  | 'response_pasted'
  | 'response_parsed'
  | 'parsed_files_selected'
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

  // Refs for scrolling/actions (populated by components)
  fetcherRef: MutableRefObject<any | null>; // Ref to RepoTxtFetcher instance/methods
  assistantRef: MutableRefObject<any | null>; // Ref to AICodeAssistant instance/methods
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

  // Action Triggers (called by StickyChatButton)
  triggerFetch: () => Promise<void>;
  triggerSelectHighlighted: () => void;
  triggerAddSelectedToKwork: () => void;
  triggerCopyKwork: () => void;
  triggerParseResponse: () => void;
  triggerSelectAllParsed: () => void;
  triggerCreatePR: () => Promise<void>;
  scrollToSection: (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant') => void;

  // Xuinity Messages (optional, can derive in StickyChatButton)
  getXuinityMessage: () => string;
}

const RepoXmlPageContext = createContext<RepoXmlPageContextType | undefined>(undefined);

export const useRepoXmlPageContext = () => {
  const context = useContext(RepoXmlPageContext);
  if (!context) {
    throw new Error('useRepoXmlPageContext must be used within a RepoXmlPageProvider');
  }
  return context;
};

interface RepoXmlPageProviderProps {
  children: ReactNode;
  fetcherRef: MutableRefObject<any | null>;
  assistantRef: MutableRefObject<any | null>;
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
  const [repoUrlEntered, setRepoUrlEnteredState] = useState(true);
  const [filesFetched, setFilesFetchedState] = useState(false);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<string[]>([]);
  const [selectedFetcherFiles, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
  const [kworkInputHasContent, setKworkInputHasContentState] = useState(false);
  const [requestCopied, setRequestCopiedState] = useState(false);
  const [aiResponseHasContent, setAiResponseHasContentState] = useState(false);
  const [filesParsed, setFilesParsedState] = useState(false);
  const [selectedAssistantFiles, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());

  // Derive current workflow step
  const getCurrentStep = useCallback((): WorkflowStep => {
    if (!repoUrlEntered) return 'need_fetch'; // Or 'idle' if preferred
    if (!filesFetched) return 'need_fetch';
    if (requestCopied) {
        if (!aiResponseHasContent) return 'request_copied'; // Waiting for AI response paste
        if (!filesParsed) return 'response_pasted';
        if (selectedAssistantFiles.size === 0) return 'response_parsed';
        return 'pr_ready';
    }
    if (kworkInputHasContent) {
        if (selectedFetcherFiles.size > 0) return 'request_written'; // Has files and text
        return 'request_written'; // Has text only
    }
    if (selectedFetcherFiles.size > 0) return 'files_selected';
    return 'files_fetched'; // Files fetched, but nothing else done
  }, [
    repoUrlEntered, filesFetched, selectedFetcherFiles, kworkInputHasContent,
    requestCopied, aiResponseHasContent, filesParsed, selectedAssistantFiles
  ]);

  const currentStep = getCurrentStep();

  // --- Updaters ---
  const setFilesFetched = (fetched: boolean, primaryPath: string | null = null, secondaryPaths: string[] = []) => {
    setFilesFetchedState(fetched);
    setPrimaryHighlightedPathState(primaryPath);
    setSecondaryHighlightedPathsState(secondaryPaths);
    if (!fetched) { // Reset subsequent states if fetch fails or is redone
        setSelectedFetcherFilesState(new Set());
        setKworkInputHasContentState(false);
        setRequestCopiedState(false);
        // Keep AI response? Maybe not.
        setAiResponseHasContentState(false);
        setFilesParsedState(false);
        setSelectedAssistantFilesState(new Set());
    }
  };

  // --- Action Triggers ---
  const triggerFetch = async () => {
    await fetcherRef.current?.handleFetch?.();
  };

  const triggerSelectHighlighted = () => {
    fetcherRef.current?.selectHighlightedFiles?.();
  };

  const triggerAddSelectedToKwork = () => {
    fetcherRef.current?.handleAddSelected?.();
  }

  const triggerCopyKwork = () => {
    fetcherRef.current?.handleCopyToClipboard?.();
  };

  const triggerParseResponse = () => {
    assistantRef.current?.handleParse?.();
  };

   const triggerSelectAllParsed = () => {
    assistantRef.current?.selectAllParsedFiles?.();
   }

  const triggerCreatePR = async () => {
    await assistantRef.current?.handleCreatePR?.();
  };

  const scrollToSection = (id: 'kworkInput' | 'aiResponseInput' | 'prSection' | 'fetcher' | 'assistant') => {
     let element: HTMLElement | null = null;
     switch(id) {
        case 'kworkInput': element = kworkInputRef.current; break;
        case 'aiResponseInput': element = aiResponseInputRef.current; break;
        case 'prSection': element = prSectionRef.current; break;
        case 'fetcher': element = document.getElementById('extractor'); break; // Use IDs from page
        case 'assistant': element = document.getElementById('executor'); break; // Use IDs from page
     }
     element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // --- Xuinity Message Logic ---
   const getXuinityMessage = useCallback((): string => {
    switch (currentStep) {
      case 'idle': return "Готов помочь с кодом!";
      case 'need_fetch': return repoUrlEntered ? "Нажмите 'Извлечь файлы'!" : "Введите URL репозитория.";
      case 'files_fetched': return primaryHighlightedPath ? "Файлы загружены. Выбрать подсвеченные?" : "Файлы загружены. Выберите нужные.";
      case 'files_selected': return "Файлы выбраны. Добавить их в запрос?";
      case 'request_written': return "Запрос готов? Нажмите 'Скопировать'.";
      case 'request_copied': return "Скопировано! Вставьте ответ от AI ниже.";
      case 'response_pasted': return "Ответ вставлен. Нажмите '->' для разбора файлов.";
      case 'response_parsed': return "Файлы разобраны. Выберите нужные для PR.";
      case 'parsed_files_selected': return "Файлы для PR выбраны. Нажмите 'Создать PR'.";
      case 'pr_ready': return "Все готово! Нажмите 'Создать PR'.";
      default: return "Что делаем дальше?";
    }
  }, [currentStep, repoUrlEntered, primaryHighlightedPath]);


  const value: RepoXmlPageContextType = {
    currentStep,
    repoUrlEntered,
    filesFetched,
    primaryHighlightedPath: primaryHighlightedPath,
    secondaryHighlightedPaths: secondaryHighlightedPaths,
    selectedFetcherFiles,
    kworkInputHasContent,
    requestCopied,
    aiResponseHasContent,
    filesParsed,
    selectedAssistantFiles,
    fetcherRef,
    assistantRef,
    kworkInputRef,
    aiResponseInputRef,
    prSectionRef,
    setRepoUrlEntered: setRepoUrlEnteredState,
    setFilesFetched,
    setSelectedFetcherFiles: setSelectedFetcherFilesState,
    setKworkInputHasContent: setKworkInputHasContentState,
    setRequestCopied: setRequestCopiedState,
    setAiResponseHasContent: setAiResponseHasContentState,
    setFilesParsed: setFilesParsedState,
    setSelectedAssistantFiles: setSelectedAssistantFilesState,
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