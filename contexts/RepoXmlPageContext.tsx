"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
import { useAppToast } from '@/hooks/useAppToast';
export interface FileNode { path: string; content: string; }
export interface SimplePullRequest { id: number; number: number; title: string; html_url: string; user: { login: string | null; avatar_url: string | null } | null; head: { ref: string }; base: { ref: string }; updated_at: string; }
import { debugLogger as logger } from '@/lib/debugLogger';
import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions';
import type { RepoTxtFetcherRef } from '@/components/RepoTxtFetcher';
import type { AICodeAssistantRef } from '@/components/AICodeAssistant';


export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
export type WorkflowStep = | 'idle' | 'ready_to_fetch' | 'fetching' | 'fetch_failed' | 'files_fetched' | 'files_fetched_highlights' | 'files_fetched_image_replace' | 'files_selected' | 'request_written' | 'request_copied' | 'generating_ai_response' | 'response_pasted' | 'parsing_response' | 'pr_ready';
export interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; }

// --- Context Interface ---
interface RepoXmlPageContextType {
    fetchStatus: FetchStatus;
    repoUrlEntered: boolean;
    filesFetched: boolean;
    selectedFetcherFiles: Set<string>;
    kworkInputHasContent: boolean;
    requestCopied: boolean;
    aiResponseHasContent: boolean;
    filesParsed: boolean;
    selectedAssistantFiles: Set<string>;
    assistantLoading: boolean;
    aiActionLoading: boolean;
    loadingPrs: boolean;
    targetBranchName: string | null;
    manualBranchName: string;
    openPrs: SimplePullRequest[];
    isSettingsModalOpen: boolean;
    isParsing: boolean;
    currentAiRequestId: string | null;
    imageReplaceTask: ImageReplaceTask | null;
    allFetchedFiles: FileNode[];
    currentStep: WorkflowStep;
    repoUrl: string;
    setFetchStatus: React.Dispatch<React.SetStateAction<FetchStatus>>;
    setRepoUrlEntered: React.Dispatch<React.SetStateAction<boolean>>;
    handleSetFilesFetched: ( fetched: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => void;
    setSelectedFetcherFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setKworkInputHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setRequestCopied: React.Dispatch<React.SetStateAction<boolean>>;
    setAiResponseHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setFilesParsed: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedAssistantFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setAssistantLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setAiActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setLoadingPrs: React.Dispatch<React.SetStateAction<boolean>>;
    setTargetBranchName: React.Dispatch<React.SetStateAction<string | null>>;
    setManualBranchName: React.Dispatch<React.SetStateAction<string>>;
    setOpenPrs: React.Dispatch<React.SetStateAction<SimplePullRequest[]>>;
    setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setContextIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentAiRequestId: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    setRepoUrl: React.Dispatch<React.SetStateAction<string>>;
    triggerToggleSettingsModal: () => void;
    triggerFetch: (isRetry?: boolean, branch?: string | null) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (clearSelection?: boolean) => Promise<void>;
    triggerCopyKwork: () => boolean;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreateOrUpdatePR: () => Promise<void>;
    triggerUpdateBranch: ( repoUrl: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ) => Promise<{ success: boolean; error?: string }>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    updateRepoUrlInAssistant: (url: string) => void;
    getXuinityMessage: () => string;
    scrollToSection: (sectionId: string) => void;
    triggerAddImportantToKwork: () => void;
    triggerAddTreeToKwork: () => void;
    triggerSelectAllFetcherFiles: () => void;
    triggerDeselectAllFetcherFiles: () => void;
    triggerClearKworkInput: () => void;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;
    addToast: (message: string | React.ReactNode, type?: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message', duration?: number, options?: any) => void;
    getKworkInputValue: () => string;
    updateKworkInput: (value: string) => void;
}

// --- Default Context Value ---
// Create a stable object reference for the default value.
// This is crucial for the check in the consumer hook.
const defaultContextValue: RepoXmlPageContextType = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', repoUrl: "https://github.com/salavey13/cartest",
    // Provide default functions that log warnings (or are no-ops)
    setFetchStatus: () => { logger.warn("setFetchStatus called on default context value"); },
    setRepoUrlEntered: () => { logger.warn("setRepoUrlEntered called on default context value"); },
    handleSetFilesFetched: () => { logger.warn("handleSetFilesFetched called on default context value"); },
    setSelectedFetcherFiles: () => { logger.warn("setSelectedFetcherFiles called on default context value"); },
    setKworkInputHasContent: () => { logger.warn("setKworkInputHasContent called on default context value"); },
    setRequestCopied: () => { logger.warn("setRequestCopied called on default context value"); },
    setAiResponseHasContent: () => { logger.warn("setAiResponseHasContent called on default context value"); },
    setFilesParsed: () => { logger.warn("setFilesParsed called on default context value"); },
    setSelectedAssistantFiles: () => { logger.warn("setSelectedAssistantFiles called on default context value"); },
    setAssistantLoading: () => { logger.warn("setAssistantLoading called on default context value"); },
    setAiActionLoading: () => { logger.warn("setAiActionLoading called on default context value"); },
    setLoadingPrs: () => { logger.warn("setLoadingPrs called on default context value"); },
    setTargetBranchName: () => { logger.warn("setTargetBranchName called on default context value"); },
    setManualBranchName: () => { logger.warn("setManualBranchName called on default context value"); },
    setOpenPrs: () => { logger.warn("setOpenPrs called on default context value"); },
    setIsParsing: () => { logger.warn("setIsParsing called on default context value"); },
    setContextIsParsing: () => { logger.warn("setContextIsParsing called on default context value"); },
    setCurrentAiRequestId: () => { logger.warn("setCurrentAiRequestId called on default context value"); },
    setImageReplaceTask: () => { logger.warn("setImageReplaceTask called on default context value"); },
    setRepoUrl: () => { logger.warn("setRepoUrl called on default context value"); },
    triggerToggleSettingsModal: () => { logger.warn("triggerToggleSettingsModal called on default context value"); },
    triggerFetch: async () => { logger.warn("triggerFetch called on default context value"); },
    triggerSelectHighlighted: () => { logger.warn("triggerSelectHighlighted called on default context value"); },
    triggerAddSelectedToKwork: async () => { logger.warn("triggerAddSelectedToKwork called on default context value"); },
    triggerCopyKwork: () => { logger.warn("triggerCopyKwork called on default context value"); return false; },
    triggerAskAi: async () => { logger.warn("triggerAskAi called on default context value"); return { success: false, error: "Context not ready" }; },
    triggerParseResponse: async () => { logger.warn("triggerParseResponse called on default context value"); },
    triggerSelectAllParsed: () => { logger.warn("triggerSelectAllParsed called on default context value"); },
    triggerCreateOrUpdatePR: async () => { logger.warn("triggerCreateOrUpdatePR called on default context value"); },
    triggerUpdateBranch: async () => { logger.warn("triggerUpdateBranch called on default context value"); return { success: false, error: "Context not ready" }; },
    triggerGetOpenPRs: async () => { logger.warn("triggerGetOpenPRs called on default context value"); },
    updateRepoUrlInAssistant: () => { logger.warn("updateRepoUrlInAssistant called on default context value"); },
    getXuinityMessage: () => "Initializing...",
    scrollToSection: () => { logger.warn("scrollToSection called on default context value"); },
    triggerAddImportantToKwork: () => { logger.warn("triggerAddImportantToKwork called on default context value"); },
    triggerAddTreeToKwork: () => { logger.warn("triggerAddTreeToKwork called on default context value"); },
    triggerSelectAllFetcherFiles: () => { logger.warn("triggerSelectAllFetcherFiles called on default context value"); },
    triggerDeselectAllFetcherFiles: () => { logger.warn("triggerDeselectAllFetcherFiles called on default context value"); },
    triggerClearKworkInput: () => { logger.warn("triggerClearKworkInput called on default context value"); },
    // Refs are initialized to null, which is server-safe
    kworkInputRef: { current: null }, aiResponseInputRef: { current: null }, fetcherRef: { current: null }, assistantRef: { current: null },
    // Provide a no-op toast function for the default value
    addToast: () => { logger.warn("addToast called on default context value"); },
    getKworkInputValue: () => { logger.warn("getKworkInputValue called on default context value"); return ""; },
    updateKworkInput: () => { logger.warn("updateKworkInput called on default context value"); },
};


// --- Context Creation ---
// Initialize with the server-safe default value
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(defaultContextValue);

// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
    // .. all useState hooks remain the same ...
    const [fetchStatusState, setFetchStatusState] = useState<FetchStatus>('idle');
    const [repoUrlEnteredState, setRepoUrlEnteredState] = useState<boolean>(false);
    const [filesFetchedState, setFilesFetchedState] = useState<boolean>(false);
    const [primaryHighlightPathState, setPrimaryHighlightPathState] = useState<string | null>(null);
    const [secondaryHighlightPathsState, setSecondaryHighlightPathsState] = useState<string[]>([]);
    const [selectedFetcherFilesState, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
    const [kworkInputHasContentState, setKworkInputHasContentState] = useState<boolean>(false);
    const [requestCopiedState, setRequestCopiedState] = useState<boolean>(false);
    const [aiResponseHasContentState, setAiResponseHasContentState] = useState<boolean>(false);
    const [filesParsedState, setFilesParsedState] = useState<boolean>(false);
    const [selectedAssistantFilesState, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());
    const [assistantLoadingState, setAssistantLoadingState] = useState<boolean>(false);
    const [aiActionLoadingState, setAiActionLoadingState] = useState<boolean>(false);
    const [loadingPrsState, setLoadingPrsState] = useState<boolean>(false);
    const [targetBranchNameState, setTargetBranchNameState] = useState<string | null>(null);
    const [manualBranchNameState, setManualBranchNameState] = useState<string>('');
    const [openPrsState, setOpenPrsState] = useState<SimplePullRequest[]>([]);
    const [isSettingsModalOpenState, setIsSettingsModalOpenState] = useState<boolean>(false);
    const [isParsingState, setIsParsingState] = useState<boolean>(false);
    const [currentAiRequestIdState, setCurrentAiRequestIdState] = useState<string | null>(null);
    const [imageReplaceTaskState, setImageReplaceTaskState] = useState<ImageReplaceTask | null>(null);
    const [allFetchedFilesState, setAllFetchedFilesState] = useState<FileNode[]>([]);
    const [repoUrlState, setRepoUrlState] = useState<string>(defaultContextValue.repoUrl);

    // Refs
    const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
    const assistantRef = useRef<AICodeAssistantRef | null>(null);
    const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
    const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);

    const appToast = useAppToast();

    // No isMounted state needed anymore for context value calculation
    useEffect(() => { logger.log("RepoXmlPageContext Mounted (Client)"); }, []); // Log only on client mount
    useEffect(() => { setRepoUrlEnteredState(repoUrlState.trim().length > 0 && repoUrlState.includes("github.com")); }, [repoUrlState]);

    // --- Callback Helpers --- (no changes required in these stable callbacks)
    const addToastStable = useCallback((
        message: string | React.ReactNode,
        type: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' = 'info',
        duration: number = 3000,
        options: any = {}
    ) => {
        const toastOptions = duration ? { ...options, duration } : options;
        switch (type) {
            case 'success': appToast.success(message, toastOptions); break;
            case 'error': appToast.error(message, toastOptions); break;
            case 'info': appToast.info(message, toastOptions); break;
            case 'warning': appToast.warning(message, toastOptions); break;
            case 'loading': appToast.loading(message, toastOptions); break;
            case 'message': default: appToast.message(message, toastOptions); break;
        }
    }, [appToast]);

    const handleSetFilesFetchedStable = useCallback(( fetched: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => {
       logger.log("[Context] handleSetFilesFetchedStable called:", { fetched, primaryHighlight, secondaryCount: secondaryHighlights.length, allFilesCount: allFiles.length, taskActive: !!imageReplaceTaskState });
       const currentTask = imageReplaceTaskState;
       setFilesFetchedState(fetched);
       if (fetched) {
           setAllFetchedFilesState(allFiles ?? []);
       }
       setPrimaryHighlightPathState(primaryHighlight);
       setSecondaryHighlightPathsState(secondaryHighlights ?? []);

       let finalFetchStatus: FetchStatus = fetched ? 'success' : 'error';
       if (currentTask) {
           if (fetched) {
               const targetFileExists = (allFiles ?? []).some(f => f.path === currentTask.targetPath);
               if (!targetFileExists) {
                   logger.error(`[Context] Image Task Error: Target file ${currentTask.targetPath} not found!`);
                   addToastStable(`Ошибка: Файл ${currentTask.targetPath} для замены не найден.`, "error", 5000);
                   finalFetchStatus = 'error';
                   setImageReplaceTaskState(null);
                   setFilesFetchedState(false);
               } else {
                   logger.log(`[Context] Image Task: Target file ${currentTask.targetPath} found.`);
                   if (assistantRef.current?.handleDirectImageReplace) {
                       logger.log("[Context] Automatically triggering handleDirectImageReplace");
                       assistantRef.current.handleDirectImageReplace(currentTask, allFiles ?? [])
                         .catch(err => logger.error("[Context] Auto image replace failed:", err));
                   } else {
                        logger.warn("[Context] Cannot auto-trigger image replace: assistantRef or handler not ready.");
                   }
               }
           } else {
                logger.error("[Context] Image Task Error: Fetch attempt failed.");
           }
       }
       setFetchStatusState(finalFetchStatus);
       logger.log(`[Context] handleSetFilesFetchedStable finished. Final Status: ${finalFetchStatus}, Files Fetched Flag: ${fetched}`);
    }, [ imageReplaceTaskState, addToastStable ]);


    const getKworkInputValueStable = useCallback((): string => kworkInputRef.current?.value || "", []);
    const updateKworkInputStable = useCallback((value: string) => {
        if (kworkInputRef.current) {
            kworkInputRef.current.value = value;
            setKworkInputHasContentState(value.trim().length > 0);
        }
    }, []);

    // --- Triggers --- (no changes required in these stable callbacks)
    const triggerToggleSettingsModal = useCallback(() => { setIsSettingsModalOpenState(prev => !prev); }, []);
    const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => {
        if (fetcherRef.current?.handleFetch) {
            try { await fetcherRef.current.handleFetch(isRetry, branch, imageReplaceTaskState); }
            catch (error: any) {
                logger.error("Error calling fetcherRef.handleFetch:", error);
                addToastStable(`Критическая ошибка при запуске извлечения: ${error?.message ?? 'Неизвестно'}`, "error", 5000);
                setFetchStatusState('error');
            }
        } else { logger.error("triggerFetch: fetcherRef is not set."); addToastStable("Ошибка: Не удалось запустить извлечение (ref).", "error"); }
    }, [imageReplaceTaskState, addToastStable]);
    const triggerSelectHighlighted = useCallback(() => {
        if (fetcherRef.current?.selectHighlightedFiles) {
             try { fetcherRef.current.selectHighlightedFiles(); }
             catch (error: any) { logger.error("Error calling fetcherRef.selectHighlightedFiles:", error); addToastStable(`Ошибка выбора связанных файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); }
     }, [addToastStable]);
    const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => {
        if (fetcherRef.current?.handleAddSelected) {
             if (selectedFetcherFilesState.size === 0) { addToastStable("Сначала выберите файлы в Экстракторе!", "warning"); return; }
             try {
                  await fetcherRef.current.handleAddSelected(selectedFetcherFilesState, allFetchedFilesState);
                  if (clearSelection) { setSelectedFetcherFilesState(new Set()); }
             } catch (error: any) { logger.error("[Context] Error during handleAddSelected:", error); addToastStable(`Ошибка добавления файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); addToastStable("Ошибка: Компонент Экстрактора недоступен.", "error"); }
    }, [selectedFetcherFilesState, allFetchedFilesState, addToastStable]);
    const triggerCopyKwork = useCallback((): boolean => {
        if (fetcherRef.current?.handleCopyToClipboard) {
             try { return fetcherRef.current.handleCopyToClipboard(undefined, true); }
             catch (error: any) { logger.error("Error calling fetcherRef.handleCopyToClipboard:", error); addToastStable(`Ошибка копирования запроса: ${error?.message ?? 'Неизвестно'}`, "error"); return false; }
        } else { logger.error("triggerCopyKwork: fetcherRef is not set."); addToastStable("Ошибка копирования: Компонент Экстрактора недоступен.", "error"); return false; }
     }, [addToastStable]);
    const triggerAskAi = useCallback(async () => { logger.warn("AI Ask Triggered (No Longer Active - Use Copy/Paste Flow)"); addToastStable("Скопируйте запрос и вставьте в AI.", "info"); return { success: false, error: "Ask AI button disabled" }; }, [addToastStable]);
    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current?.handleParse) {
             try { await assistantRef.current.handleParse(); }
             catch (error: any) { logger.error("Error calling assistantRef.handleParse:", error); addToastStable(`Критическая ошибка разбора ответа: ${error?.message ?? 'Неизвестно'}`, "error", 5000); }
        } else { logger.error("triggerParseResponse: assistantRef is not set."); addToastStable("Ошибка разбора: Компонент Ассистента недоступен.", "error");}
     }, [addToastStable]);
    const triggerSelectAllParsed = useCallback(() => {
        if (assistantRef.current?.selectAllParsedFiles) {
             try { assistantRef.current.selectAllParsedFiles(); }
             catch (error: any) { logger.error("Error calling assistantRef.selectAllParsedFiles:", error); addToastStable(`Ошибка выбора всех файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); addToastStable("Ошибка выбора: Компонент Ассистента недоступен.", "error");}
    }, [addToastStable]);
    const triggerCreateOrUpdatePR = useCallback(async () => {
        if (assistantRef.current?.handleCreatePR) {
             try { await assistantRef.current.handleCreatePR(); }
             catch (error: any) { logger.error("Error calling assistantRef.handleCreatePR:", error); addToastStable(`Критическая ошибка создания/обновления PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000); }
        } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); addToastStable("Ошибка PR: Компонент Ассистента недоступен.", "error");}
    }, [addToastStable]);
    const triggerGetOpenPRs = useCallback(async (url: string) => {
         const effectiveUrl = url || repoUrlState;
         if (!effectiveUrl || !effectiveUrl.includes('github.com')) { setOpenPrsState([]); setLoadingPrsState(false); logger.warn("triggerGetOpenPRs: Invalid URL", effectiveUrl); return; }
         logger.log("triggerGetOpenPRs: Fetching for", effectiveUrl); setLoadingPrsState(true);
         try {
             const result = await getOpenPullRequests(effectiveUrl);
             if (result.success && result.pullRequests) {
                  setOpenPrsState(result.pullRequests as SimplePullRequest[]);
             } else {
                 addToastStable("Ошибка загрузки PR: " + (result.error ?? 'Неизвестно'), "error");
                 setOpenPrsState([]);
             }
         } catch (error: any) {
             logger.error("triggerGetOpenPRs Action Error:", error);
             addToastStable(`Крит. ошибка загрузки PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000);
             setOpenPrsState([]);
         } finally {
             setLoadingPrsState(false);
         }
     }, [repoUrlState, addToastStable]);
     const triggerUpdateBranch = useCallback(async (repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => {
         logger.log(`[Context] triggerUpdateBranch: ${branch}, PR#: ${prNumber ?? 'N/A'}`);
         setAssistantLoadingState(true);
         try {
             const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription);
             if (result.success) {
                  triggerGetOpenPRs(repoUrlParam).catch(err => logger.error("Failed to refresh PRs after branch update:", err));
                  return { success: true };
             } else {
                 return { success: false, error: result.error };
             }
         } catch (error: any) {
             logger.error("[Context] triggerUpdateBranch critical Error:", error);
             addToastStable(`Крит. ошибка обновления: ${error.message}`, "error", 5000);
             return { success: false, error: error.message };
         } finally {
             setAssistantLoadingState(false);
         }
     }, [addToastStable, triggerGetOpenPRs]);
    const updateRepoUrlInAssistant = useCallback((url: string) => {
        if (assistantRef.current?.updateRepoUrl) {
            try { assistantRef.current.updateRepoUrl(url); }
            catch (error: any) { logger.error(`Error calling assistantRef.updateRepoUrl: ${error?.message ?? 'Неизвестно'}`); }
        }
     }, []);
    const scrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            try {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(() => {
                    element.classList.add('highlight-scroll');
                    setTimeout(() => element.classList.remove('highlight-scroll'), 1500);
                }, 300);
            } catch (scrollError) {
                logger.error(`Error scrolling to ${sectionId}:`, scrollError);
            }
        } else { logger.warn(`Scroll target not found: ${sectionId}`); }
    }, []);
    const triggerAddImportantToKwork = useCallback(() => { fetcherRef.current?.handleAddImportantFiles?.(); }, []);
    const triggerAddTreeToKwork = useCallback(() => { fetcherRef.current?.handleAddFullTree?.(); }, []);
    const triggerSelectAllFetcherFiles = useCallback(() => { fetcherRef.current?.selectAllFiles?.(); }, []);
    const triggerDeselectAllFetcherFiles = useCallback(() => { fetcherRef.current?.deselectAllFiles?.(); }, []);
    const triggerClearKworkInput = useCallback(() => { fetcherRef.current?.clearAll?.(); }, []);

    // --- Workflow Step Calculation --- (no changes required)
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
    useEffect(() => {
        let calculatedStep: WorkflowStep = 'idle';
        const effectiveTargetBranch = manualBranchNameState.trim() || targetBranchNameState || 'default';

        if (imageReplaceTaskState) {
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace';
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && imageReplaceTaskState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) calculatedStep = 'fetch_failed';
             else calculatedStep = 'ready_to_fetch';
         } else { // Standard flow
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
             else if (isParsingState) calculatedStep = 'parsing_response';
             else if (assistantLoadingState) calculatedStep = 'generating_ai_response';
             else if (filesFetchedState) {
                 if (aiResponseHasContentState) {
                     calculatedStep = filesParsedState ? 'pr_ready' : 'response_pasted';
                 } else if (kworkInputHasContentState) {
                     calculatedStep = requestCopiedState ? 'request_copied' : 'request_written';
                 } else if (selectedFetcherFilesState.size > 0) {
                     calculatedStep = 'files_selected';
                 } else if (primaryHighlightPathState || secondaryHighlightPathsState.length > 0) {
                     calculatedStep = 'files_fetched_highlights';
                 } else {
                     calculatedStep = 'files_fetched';
                 }
             }
             else {
                 calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
             }
         }
        setCurrentStep(prevStep => {
             if (prevStep !== calculatedStep) {
                 logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`);
                 return calculatedStep;
             }
             return prevStep;
        });
    }, [ // Complete list of dependencies
        fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState.length,
        selectedFetcherFilesState.size,
        aiActionLoadingState,
        isParsingState, imageReplaceTaskState, allFetchedFilesState,
        assistantLoadingState, repoUrlEnteredState, manualBranchNameState, targetBranchNameState,
        addToastStable // keep if debug toast enabled
    ]);

    // --- Buddy Message Logic --- (Restored full logic)
    const getXuinityMessage = useCallback((): string => {
        // This logic should now be safe to run on both server and client
        // as it depends on state that has safe defaults.
        const effectiveBranch = manualBranchNameState.trim() || targetBranchNameState || 'default';
        if (imageReplaceTaskState) {
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') return "Гружу файл для замены картинки...";
            if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') return "Твою ж! Ошибка загрузки файла. URL/ветка верные? Жми 'Попробовать Снова'.";
            const targetFileExists = allFetchedFilesState?.some(f => f.path === imageReplaceTaskState.targetPath);
            if (fetchStatusState === 'success' && !targetFileExists && filesFetchedState) return "Файл для замены НЕ НАЙДЕН в репе! Проверь путь/ветку!";
            if (fetchStatusState === 'success' && targetFileExists) {
                if (assistantLoadingState) return "Меняю картинку и делаю авто-PR... Магия!";
                return "Файл на месте! Ассистент сейчас сам всё заменит и запушит PR. Левел 1 пройден!";
            }
            return "Готовлю авто-замену картинки (Level 1)...";
        }
        switch (currentStep) {
            case 'idle': return "Готов качать Vibe! Введи URL репы GitHub или покажи мне на странице, что чинить/делать.";
            case 'ready_to_fetch': return `Репа есть. Жми 'Извлечь Файлы' из '${effectiveBranch}', чтобы я дал контекст AI.`;
            case 'fetching': return `Качаю код из '${effectiveBranch}'...`;
            case 'fetch_failed': return "Файл? Не, не слышал. Ошибка загрузки. Проверь URL/токен/ветку и жми 'Попробовать Снова'.";
            case 'files_fetched': return `Код скачан (${allFetchedFilesState.length} файлов). Теперь твоя очередь рулить AI! Выбери файлы-контекст или просто напиши идею в поле запроса.`;
            case 'files_fetched_highlights': return `О! Я вижу связанные файлы (стр./компоненты/хуки)! Выбери их (+1 Vibe Perk!) и/или добавь (+) в запрос, чтобы AI лучше понял, что делать.`;
            case 'files_selected': return `Выбрал ${selectedFetcherFilesState.size} файлов. Отлично! Добавь их (+) в запрос как контекст для AI.`;
            case 'request_written': return `Запрос для AI готов! Скопируй его и закинь своему GPT/Gemini. Жду результат!`;
            case 'request_copied': return "Скопировал? Красава! Теперь жду ответ от твоего AI. Вставь его в поле ниже.";
            case 'response_pasted': return "Есть ответ! Отлично. Жми '➡️', я разберу код и проверю на ошибки.";
            case 'parsing_response': return "Парсю код, ищу косяки... (+1 Parser Perk!)";
            case 'pr_ready':
                const actionText = targetBranchNameState ? 'обновления ветки' : 'создания PR';
                if (selectedAssistantFilesState.size === 0) return "Код разобран и проверен! Теперь выбери файлы, которые пойдут в коммит.";
                return `Код разобран! Выбрано ${selectedAssistantFilesState.size} файлов для ${actionText}. Проверь код в ассистенте (ошибки/варнинги?). Жми кнопку PR/Update!`;
            default: return "Вайб неопределен... Что будем делать?";
        }
     }, [ // Complete list of dependencies
         currentStep, repoUrlEnteredState, manualBranchNameState, targetBranchNameState,
         fetchStatusState, filesFetchedState, selectedFetcherFilesState.size,
         kworkInputHasContentState, aiResponseHasContentState, filesParsedState,
         selectedAssistantFilesState.size,
         requestCopiedState, assistantLoadingState, aiActionLoadingState,
         currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState,
         isParsingState
     ]);


    // --- Memoized Context Value ---
    // This calculation no longer needs the isMounted check.
    const contextValue = useMemo((): RepoXmlPageContextType => {
        // logger.log("Context value recalculating...");
        return {
            // State values
            fetchStatus: fetchStatusState, repoUrlEntered: repoUrlEnteredState, filesFetched: filesFetchedState, selectedFetcherFiles: selectedFetcherFilesState, kworkInputHasContent: kworkInputHasContentState, requestCopied: requestCopiedState, aiResponseHasContent: aiResponseHasContentState, filesParsed: filesParsedState, selectedAssistantFiles: selectedAssistantFilesState, assistantLoading: assistantLoadingState, aiActionLoading: aiActionLoadingState, loadingPrs: loadingPrsState, targetBranchName: targetBranchNameState, manualBranchName: manualBranchNameState, openPrs: openPrsState, isSettingsModalOpen: isSettingsModalOpenState, isParsing: isParsingState, currentAiRequestId: currentAiRequestIdState, imageReplaceTask: imageReplaceTaskState, allFetchedFiles: allFetchedFilesState, currentStep, repoUrl: repoUrlState,
            // State setters (Directly pass stable setters from useState)
            setFetchStatus: setFetchStatusState, setRepoUrlEntered: setRepoUrlEnteredState, setSelectedFetcherFiles: setSelectedFetcherFilesState, setKworkInputHasContent: setKworkInputHasContentState, setRequestCopied: setRequestCopiedState, setAiResponseHasContent: setAiResponseHasContentState, setFilesParsed: setFilesParsedState, setSelectedAssistantFiles: setSelectedAssistantFilesState, setAssistantLoading: setAssistantLoadingState, setAiActionLoading: setAiActionLoadingState, setLoadingPrs: setLoadingPrsState, setTargetBranchName: setTargetBranchNameState, setManualBranchName: setManualBranchNameState, setOpenPrs: setOpenPrsState, setIsParsing: setIsParsingState, setContextIsParsing: setIsParsingState, // Use setIsParsingState for both
            setCurrentAiRequestId: setCurrentAiRequestIdState, setImageReplaceTask: setImageReplaceTaskState, setRepoUrl: setRepoUrlState,
            // State Handlers (Pass stable callbacks)
            handleSetFilesFetched: handleSetFilesFetchedStable,
            // Refs
            kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
            // Triggers / Actions / Helpers (Pass stable callbacks)
            triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection, addToast: addToastStable, getKworkInputValue: getKworkInputValueStable, updateKworkInput: updateKworkInputStable,
            // New Triggers
            triggerAddImportantToKwork, triggerAddTreeToKwork, triggerSelectAllFetcherFiles, triggerDeselectAllFetcherFiles, triggerClearKworkInput,
        };
    }, [ // Complete list of dependencies (Restored full list including setters)
        fetchStatusState, repoUrlEnteredState, filesFetchedState, selectedFetcherFilesState, kworkInputHasContentState, requestCopiedState, aiResponseHasContentState, filesParsedState, selectedAssistantFilesState, assistantLoadingState, aiActionLoadingState, loadingPrsState, targetBranchNameState, manualBranchNameState, openPrsState, isSettingsModalOpenState, isParsingState, currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, currentStep, repoUrlState,
        handleSetFilesFetchedStable, triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection, addToastStable, getKworkInputValueStable, updateKworkInputStable,
        triggerAddImportantToKwork, triggerAddTreeToKwork, triggerSelectAllFetcherFiles, triggerDeselectAllFetcherFiles, triggerClearKworkInput,
        // Include stable setters
        setFetchStatusState, setRepoUrlEnteredState, setSelectedFetcherFilesState, setKworkInputHasContentState, setRequestCopiedState, setAiResponseHasContentState, setFilesParsedState, setSelectedAssistantFilesState, setAssistantLoadingState, setAiActionLoadingState, setLoadingPrsState, setTargetBranchNameState, setManualBranchNameState, setOpenPrsState, setIsParsingState, setCurrentAiRequestIdState, setImageReplaceTaskState, setRepoUrlState,
        // Include stable refs
        kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef
    ]);

    return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );
};

// --- Consumer Hook ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    // Check if the context value is the *exact same object* as the default value.
    // This indicates the provider hasn't rendered its calculated value yet.
    if (context === defaultContextValue) {
        logger.error("useRepoXmlPageContext: Attempted to use context before the Provider has rendered its value.");
        throw new Error('useRepoXmlPageContext must be used within a RepoXmlPageContextProvider that has initialized.');
    }
    return context;
};