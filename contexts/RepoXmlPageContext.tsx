"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
// REMOVED: import { toast } from 'sonner'; - Using useAppToast now
import { useAppToast } from '@/hooks/useAppToast'; // <<< IMPORT NEW HOOK
export interface FileNode { path: string; content: string; }
export interface SimplePullRequest { id: number; number: number; title: string; html_url: string; user: { login: string | null; avatar_url: string | null } | null; head: { ref: string }; base: { ref: string }; updated_at: string; }
import { debugLogger as logger } from '@/lib/debugLogger';
import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions';

// --- Types ---
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
export type WorkflowStep = | 'idle' | 'ready_to_fetch' | 'fetching' | 'fetch_failed' | 'files_fetched' | 'files_fetched_highlights' | 'files_fetched_image_replace' | 'files_selected' | 'request_written' | 'request_copied' | 'generating_ai_response' | 'response_pasted' | 'parsing_response' | 'pr_ready';
export interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; }
export interface AICodeAssistantRef { handleParse: () => Promise<void>; selectAllParsedFiles: () => void; handleCreatePR: () => Promise<void>; setResponseValue: (value: string) => void; updateRepoUrl: (url: string) => void; handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => Promise<void>; }
export interface RepoTxtFetcherRef { handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => Promise<void>; selectHighlightedFiles: () => void; handleAddSelected: (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => Promise<void>; handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean; clearAll: () => void; getKworkInputValue: () => string; }
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// --- Context Interface ---
interface RepoXmlPageContextType {
    // State values
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

    // State Setters
    setFetchStatus: React.Dispatch<React.SetStateAction<FetchStatus>>;
    setRepoUrlEntered: React.Dispatch<React.SetStateAction<boolean>>;
    setFilesFetched: ( fetched: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => void;
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
    setCurrentAiRequestId: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    setRepoUrl: React.Dispatch<React.SetStateAction<string>>;

    // Triggers / Actions
    triggerToggleSettingsModal: () => void;
    triggerFetch: (isRetry?: boolean, branch?: string | null) => Promise<void>;
    triggerSelectHighlighted: () => void;
    triggerAddSelectedToKwork: (clearSelection?: boolean) => Promise<void>;
    triggerCopyKwork: () => boolean;
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>; // Kept for potential future use, but inactive
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreateOrUpdatePR: () => Promise<void>;
    triggerUpdateBranch: ( repoUrl: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ) => Promise<{ success: boolean; error?: string }>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    updateRepoUrlInAssistant: (url: string) => void;
    getXuinityMessage: () => string; // Renamed for clarity
    scrollToSection: (sectionId: string) => void;

    // Refs
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;

    // Helpers
    // <<< Type signature adjusted for useAppToast flexibility >>>
    addToast: (message: string | React.ReactNode, type?: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message', duration?: number, options?: any) => void;
    getKworkInputValue: () => string;
    updateKworkInput: (value: string) => void;
}

// --- Minimal Initial Context Value ---
const initialMinimalContextValue: RepoXmlPageContextType = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', repoUrl: "https://github.com/salavey13/cartest",
    setFetchStatus: () => { logger.warn("setFetchStatus called before provider init"); },
    setRepoUrlEntered: () => { logger.warn("setRepoUrlEntered called before provider init"); },
    setFilesFetched: () => { logger.warn("setFilesFetched called before provider init"); },
    setSelectedFetcherFiles: () => { logger.warn("setSelectedFetcherFiles called before provider init"); },
    setKworkInputHasContent: () => { logger.warn("setKworkInputHasContent called before provider init"); },
    setRequestCopied: () => { logger.warn("setRequestCopied called before provider init"); },
    setAiResponseHasContent: () => { logger.warn("setAiResponseHasContent called before provider init"); },
    setFilesParsed: () => { logger.warn("setFilesParsed called before provider init"); },
    setSelectedAssistantFiles: () => { logger.warn("setSelectedAssistantFiles called before provider init"); },
    setAssistantLoading: () => { logger.warn("setAssistantLoading called before provider init"); },
    setAiActionLoading: () => { logger.warn("setAiActionLoading called before provider init"); },
    setLoadingPrs: () => { logger.warn("setLoadingPrs called before provider init"); },
    setTargetBranchName: () => { logger.warn("setTargetBranchName called before provider init"); },
    setManualBranchName: () => { logger.warn("setManualBranchName called before provider init"); },
    setOpenPrs: () => { logger.warn("setOpenPrs called before provider init"); },
    setIsParsing: () => { logger.warn("setIsParsing called before provider init"); },
    setCurrentAiRequestId: () => { logger.warn("setCurrentAiRequestId called before provider init"); },
    setImageReplaceTask: () => { logger.warn("setImageReplaceTask called before provider init"); },
    setRepoUrl: () => { logger.warn("setRepoUrl called before provider init"); },
    triggerToggleSettingsModal: () => { logger.warn("triggerToggleSettingsModal called before provider init"); },
    triggerFetch: async () => { logger.warn("triggerFetch called before provider init"); },
    triggerSelectHighlighted: () => { logger.warn("triggerSelectHighlighted called before provider init"); },
    triggerAddSelectedToKwork: async () => { logger.warn("triggerAddSelectedToKwork called before provider init"); },
    triggerCopyKwork: () => { logger.warn("triggerCopyKwork called before provider init"); return false; },
    triggerAskAi: async () => { logger.warn("triggerAskAi called before provider init"); return { success: false, error: "Context not ready" }; },
    triggerParseResponse: async () => { logger.warn("triggerParseResponse called before provider init"); },
    triggerSelectAllParsed: () => { logger.warn("triggerSelectAllParsed called before provider init"); },
    triggerCreateOrUpdatePR: async () => { logger.warn("triggerCreateOrUpdatePR called before provider init"); },
    triggerUpdateBranch: async () => { logger.warn("triggerUpdateBranch called before provider init"); return { success: false, error: "Context not ready" }; },
    triggerGetOpenPRs: async () => { logger.warn("triggerGetOpenPRs called before provider init"); },
    updateRepoUrlInAssistant: () => { logger.warn("updateRepoUrlInAssistant called before provider init"); },
    getXuinityMessage: () => "Initializing...",
    scrollToSection: () => { logger.warn("scrollToSection called before provider init"); },
    kworkInputRef: { current: null }, aiResponseInputRef: { current: null }, fetcherRef: { current: null }, assistantRef: { current: null },
    addToast: () => { logger.warn("addToast called before provider init"); },
    getKworkInputValue: () => { logger.warn("getKworkInputValue called before provider init"); return ""; },
    updateKworkInput: () => { logger.warn("updateKworkInput called before provider init"); },
};

// --- Context Creation ---
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(initialMinimalContextValue);

// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
    const [isMounted, setIsMounted] = useState(false);
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
    const [aiActionLoadingState, setAiActionLoadingState] = useState<boolean>(false); // Keep for potential future external AI calls
    const [loadingPrsState, setLoadingPrsState] = useState<boolean>(false);
    const [targetBranchNameState, setTargetBranchNameState] = useState<string | null>(null);
    const [manualBranchNameState, setManualBranchNameState] = useState<string>('');
    const [openPrsState, setOpenPrsState] = useState<SimplePullRequest[]>([]);
    const [isSettingsModalOpenState, setIsSettingsModalOpenState] = useState<boolean>(false);
    const [isParsingState, setIsParsingState] = useState<boolean>(false);
    const [currentAiRequestIdState, setCurrentAiRequestIdState] = useState<string | null>(null); // Keep for potential future external AI calls
    const [imageReplaceTaskState, setImageReplaceTaskState] = useState<ImageReplaceTask | null>(null);
    const [allFetchedFilesState, setAllFetchedFilesState] = useState<FileNode[]>([]);
    const [repoUrlState, setRepoUrlState] = useState<string>(initialMinimalContextValue.repoUrl);

    const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
    const assistantRef = useRef<AICodeAssistantRef | null>(null);
    const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
    const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);

    // --- <<< Use AppToast Hook >>> ---
    const appToast = useAppToast();

    useEffect(() => { setIsMounted(true); logger.log("RepoXmlPageContext Mounted"); }, []);
    useEffect(() => { setRepoUrlEnteredState(repoUrlState.trim().length > 0 && repoUrlState.includes("github.com")); }, [repoUrlState]);

    // --- Callback Helpers ---
    // <<< Uses useAppToast internally now >>>
    const addToastStable = useCallback((
        message: string | React.ReactNode,
        type: 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' = 'info',
        duration: number = 3000,
        options: any = {} // Pass any extra options
    ) => {
        // Combine duration into options if provided
        const toastOptions = duration ? { ...options, duration } : options;

        // Call the appropriate method from the useAppToast hook
        switch (type) {
            case 'success': appToast.success(message, toastOptions); break;
            case 'error': appToast.error(message, toastOptions); break;
            case 'info': appToast.info(message, toastOptions); break;
            case 'warning': appToast.warning(message, toastOptions); break;
            case 'loading': appToast.loading(message, toastOptions); break;
            case 'message':
            default:
                appToast.message(message, toastOptions); break; // Use 'message' for default
        }
    }, [appToast]); // Dependency on the stable hook result

    const handleSetFilesFetched = useCallback(( fetchAttemptSucceeded: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => {
       logger.log("[Context] handleSetFilesFetched called:", { fetchAttemptSucceeded, primaryHighlight, secondaryCount: secondaryHighlights.length, allFilesCount: allFiles.length, taskActive: !!imageReplaceTaskState });
       const currentTask = imageReplaceTaskState; // Capture current task state
       setFilesFetchedState(true);
       setAllFetchedFilesState(allFiles ?? []); // Ensure it's an array
       setPrimaryHighlightPathState(primaryHighlight);
       setSecondaryHighlightPathsState(secondaryHighlights ?? []); // Ensure it's an array

       let finalFetchStatus: FetchStatus = fetchAttemptSucceeded ? 'success' : 'error';
       if (currentTask) {
           if (fetchAttemptSucceeded) {
               const targetFileExists = (allFiles ?? []).some(f => f.path === currentTask.targetPath);
               if (!targetFileExists) {
                   logger.error(`[Context] Image Task Error: Target file ${currentTask.targetPath} not found after successful fetch!`);
                   addToastStable(`Ошибка: Файл ${currentTask.targetPath} для замены не найден.`, "error", 5000);
                   finalFetchStatus = 'error';
                   setImageReplaceTaskState(null); // Clear the failed task
               } else {
                   logger.log(`[Context] Image Task: Target file ${currentTask.targetPath} found. Status remains 'success'.`);
                   // Automatically trigger replacement if assistant ref is ready
                   if (assistantRef.current?.handleDirectImageReplace) {
                       logger.log("[Context] Automatically triggering handleDirectImageReplace");
                       assistantRef.current.handleDirectImageReplace(currentTask, allFiles ?? [])
                         .catch(err => logger.error("[Context] Auto image replace failed:", err)); // Log error but let handler manage state/toast
                   } else {
                        logger.warn("[Context] Cannot auto-trigger image replace: assistantRef or handler not ready.");
                        // Add a toast? Maybe not, the assistant should handle it when it's ready.
                   }
               }
           } else {
                logger.error("[Context] Image Task Error: Fetch attempt failed.");
                // Keep the task, status is already 'error' or 'retrying' etc.
           }
       }
       setFetchStatusState(finalFetchStatus);
       logger.log(`[Context] handleSetFilesFetched finished. Final Status: ${finalFetchStatus}`);
    }, [ imageReplaceTaskState, assistantRef, addToastStable ]); // Added addToastStable dependency


    // --- Workflow Step Calculation ---
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
    useEffect(() => {
        if (!isMounted) { setCurrentStep('idle'); return; }
        let calculatedStep: WorkflowStep = 'idle';
        const effectiveTargetBranch = manualBranchNameState.trim() || targetBranchNameState;

        if (imageReplaceTaskState) {
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace'; // Ready for assistant or assistant is processing
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && imageReplaceTaskState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) calculatedStep = 'fetch_failed'; // Error state or target file missing after fetch success
             else calculatedStep = 'ready_to_fetch'; // Fetch hasn't succeeded or target file missing but no error state yet
         } else { // Standard flow
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
             else if (isParsingState) calculatedStep = 'parsing_response';
             else if (assistantLoadingState) calculatedStep = 'generating_ai_response'; // Covers PR creation/update loading
             // --- Post-Fetch States ---
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
                     calculatedStep = 'files_fetched'; // Just fetched, nothing selected/written/highlighted
                 }
             }
             // --- Pre-Fetch States ---
             else {
                 calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
             }
         }
        setCurrentStep(prevStep => { if (prevStep !== calculatedStep) { logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`); return calculatedStep; } return prevStep; });
    }, [
        isMounted, fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState.length, // Use length for dependency
        selectedFetcherFilesState.size, // Use size for dependency
        aiActionLoadingState, // Kept for consistency, though not used in current logic much
        isParsingState, imageReplaceTaskState, allFetchedFilesState, // Depends on the array content check inside
        assistantLoadingState, repoUrlEnteredState, manualBranchNameState, targetBranchNameState
    ]);

    const getKworkInputValueStable = useCallback((): string => kworkInputRef.current?.value || "", [kworkInputRef]);
    const updateKworkInputStable = useCallback((value: string) => {
        if (kworkInputRef.current) {
            kworkInputRef.current.value = value;
            setKworkInputHasContentState(value.trim().length > 0);
        }
    }, [kworkInputRef]); // Removed setKworkInputHasContentState from deps as it's stable

    // --- Triggers (with try-catch around ref method calls) ---
    const triggerToggleSettingsModal = useCallback(() => { setIsSettingsModalOpenState(prev => !prev); }, []);

    const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => {
        if (fetcherRef.current?.handleFetch) {
            try {
                 await fetcherRef.current.handleFetch(isRetry, branch, imageReplaceTaskState);
            } catch (error: any) {
                 logger.error("Error calling fetcherRef.handleFetch:", error);
                 addToastStable(`Критическая ошибка при запуске извлечения: ${error?.message ?? 'Неизвестно'}`, "error", 5000);
                 setFetchStatusState('error'); // Ensure status reflects critical error
            }
        } else { logger.error("triggerFetch: fetcherRef is not set."); addToastStable("Ошибка: Не удалось запустить извлечение (ref).", "error"); }
    }, [fetcherRef, imageReplaceTaskState, addToastStable]);

    const triggerSelectHighlighted = useCallback(() => {
        if (fetcherRef.current?.selectHighlightedFiles) {
            try { fetcherRef.current.selectHighlightedFiles(); }
            catch (error: any) { logger.error("Error calling fetcherRef.selectHighlightedFiles:", error); addToastStable(`Ошибка выбора связанных файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); }
    }, [fetcherRef, addToastStable]);

    const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => {
        if (fetcherRef.current?.handleAddSelected) {
             if (selectedFetcherFilesState.size === 0) { addToastStable("Сначала выберите файлы в Экстракторе!", "warning"); return; }
             try {
                  // Pass copies of state that might change during the async operation if needed
                  await fetcherRef.current.handleAddSelected(selectedFetcherFilesState, allFetchedFilesState);
                  if (clearSelection) { setSelectedFetcherFilesState(new Set()); }
             } catch (error: any) { logger.error("[Context] Error during handleAddSelected:", error); addToastStable(`Ошибка добавления файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); addToastStable("Ошибка: Компонент Экстрактора недоступен.", "error"); }
    }, [fetcherRef, selectedFetcherFilesState, allFetchedFilesState, addToastStable]);

    const triggerCopyKwork = useCallback((): boolean => {
        if (fetcherRef.current?.handleCopyToClipboard) {
             try { return fetcherRef.current.handleCopyToClipboard(undefined, true); } // Ensure scroll happens
             catch (error: any) { logger.error("Error calling fetcherRef.handleCopyToClipboard:", error); addToastStable(`Ошибка копирования запроса: ${error?.message ?? 'Неизвестно'}`, "error"); return false; }
        } else { logger.error("triggerCopyKwork: fetcherRef is not set."); addToastStable("Ошибка копирования: Компонент Экстрактора недоступен.", "error"); return false; }
    }, [fetcherRef, addToastStable]);

    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => { logger.warn("AI Ask Triggered (No Longer Active - Use Copy/Paste Flow)"); addToastStable("Скопируйте запрос и вставьте в AI.", "info"); return { success: false, error: "Ask AI button disabled" }; }, [addToastStable]);

    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current?.handleParse) {
             try { await assistantRef.current.handleParse(); }
             catch (error: any) { logger.error("Error calling assistantRef.handleParse:", error); addToastStable(`Критическая ошибка разбора ответа: ${error?.message ?? 'Неизвестно'}`, "error", 5000); }
        } else { logger.error("triggerParseResponse: assistantRef is not set."); addToastStable("Ошибка разбора: Компонент Ассистента недоступен.", "error");}
    }, [assistantRef, addToastStable]);

    const triggerSelectAllParsed = useCallback(() => {
        if (assistantRef.current?.selectAllParsedFiles) {
             try { assistantRef.current.selectAllParsedFiles(); }
             catch (error: any) { logger.error("Error calling assistantRef.selectAllParsedFiles:", error); addToastStable(`Ошибка выбора всех файлов: ${error?.message ?? 'Неизвестно'}`, "error"); }
        } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); addToastStable("Ошибка выбора: Компонент Ассистента недоступен.", "error");}
    }, [assistantRef, addToastStable]);

    const triggerCreateOrUpdatePR = useCallback(async () => {
        if (assistantRef.current?.handleCreatePR) {
             try { await assistantRef.current.handleCreatePR(); }
             catch (error: any) { logger.error("Error calling assistantRef.handleCreatePR:", error); addToastStable(`Критическая ошибка создания/обновления PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000); }
        } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); addToastStable("Ошибка PR: Компонент Ассистента недоступен.", "error");}
    }, [assistantRef, addToastStable]);

    const triggerGetOpenPRs = useCallback(async (url: string) => {
         const effectiveUrl = url || repoUrlState;
         if (!effectiveUrl || !effectiveUrl.includes('github.com')) { setOpenPrsState([]); setLoadingPrsState(false); logger.warn("triggerGetOpenPRs: Invalid URL", effectiveUrl); return; }
         logger.log("triggerGetOpenPRs: Fetching for", effectiveUrl); setLoadingPrsState(true); // setOpenPrsState([]); // Don't clear immediately, prevents flicker
         try {
             const result = await getOpenPullRequests(effectiveUrl);
             if (result.success && result.pullRequests) {
                  setOpenPrsState(result.pullRequests as SimplePullRequest[]);
             } else {
                 addToastStable("Ошибка загрузки PR: " + (result.error ?? 'Неизвестно'), "error");
                 setOpenPrsState([]); // Clear on error
             }
         } catch (error: any) {
             logger.error("triggerGetOpenPRs Action Error:", error);
             addToastStable(`Крит. ошибка загрузки PR: ${error?.message ?? 'Неизвестно'}`, "error", 5000);
             setOpenPrsState([]); // Clear on critical error
         } finally {
             setLoadingPrsState(false);
         }
     }, [repoUrlState, addToastStable]); // triggerGetOpenPRs doesn't change repoUrlState, so dependency is fine

     const triggerUpdateBranch = useCallback(async ( repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => {
         logger.log(`[Context] triggerUpdateBranch: ${branch}, PR#: ${prNumber ?? 'N/A'}`);
         setAssistantLoadingState(true); // Set loading before async call
         try {
             const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription);
             if (result.success) {
                  addToastStable(`Ветка ${branch} обновлена!`, "success");
                  // No need to await, let it refresh in background
                  triggerGetOpenPRs(repoUrlParam).catch(err => logger.error("Failed to refresh PRs after branch update:", err));
                  return { success: true };
             } else {
                 addToastStable(`Ошибка обновления ветки: ${result.error}`, "error", 5000);
                 return { success: false, error: result.error };
             }
         } catch (error: any) {
             logger.error("[Context] triggerUpdateBranch critical Error:", error);
             addToastStable(`Крит. ошибка обновления: ${error.message}`, "error", 5000);
             return { success: false, error: error.message };
         } finally {
             setAssistantLoadingState(false); // Ensure loading is reset
         }
     }, [addToastStable, triggerGetOpenPRs]); // triggerGetOpenPRs is stable via useCallback

    const updateRepoUrlInAssistant = useCallback((url: string) => {
        if (assistantRef.current?.updateRepoUrl) {
            try { assistantRef.current.updateRepoUrl(url); }
            catch (error: any) { logger.error(`Error calling assistantRef.updateRepoUrl: ${error?.message ?? 'Неизвестно'}`); }
        } else { /* logger.warn("updateRepoUrlInAssistant: assistantRef not ready."); */ } // Reduce noise
    }, [assistantRef]); // Depends on the ref itself

    const scrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            try {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                // Optional: Add highlight class with cleanup
                setTimeout(() => {
                    element.classList.add('highlight-scroll');
                    setTimeout(() => element.classList.remove('highlight-scroll'), 1500);
                }, 300); // Delay highlight slightly after scroll starts
            } catch (scrollError) {
                logger.error(`Error scrolling to ${sectionId}:`, scrollError);
                 // Fallback to immediate scroll if smooth fails?
                 // element.scrollIntoView();
            }
        } else { logger.warn(`Scroll target not found: ${sectionId}`); }
    }, [logger]);

    // --- Buddy Message Logic ---
    const getXuinityMessage = useCallback((): string => {
          if (!isMounted) return "Инициализация...";
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
     }, [ // Keep dependencies accurate
         isMounted, currentStep, repoUrlEnteredState, manualBranchNameState, targetBranchNameState,
         fetchStatusState, filesFetchedState, selectedFetcherFilesState.size, // Use size for dependency
         kworkInputHasContentState, aiResponseHasContentState, filesParsedState,
         selectedAssistantFilesState.size, // Use size for dependency
         requestCopiedState, assistantLoadingState, aiActionLoadingState, // Keep aiActionLoadingState dep
         currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, // Depends on the array content check inside
         isParsingState
     ]);


    // --- Memoized Context Value ---
    const contextValue = useMemo((): RepoXmlPageContextType => {
        // logger.log("Context value recalculating..."); // DEBUG: Log when context value changes
        if (!isMounted) return initialMinimalContextValue; // Return minimal value if not mounted
        return {
            // State values
            fetchStatus: fetchStatusState, repoUrlEntered: repoUrlEnteredState, filesFetched: filesFetchedState, selectedFetcherFiles: selectedFetcherFilesState, kworkInputHasContent: kworkInputHasContentState, requestCopied: requestCopiedState, aiResponseHasContent: aiResponseHasContentState, filesParsed: filesParsedState, selectedAssistantFiles: selectedAssistantFilesState, assistantLoading: assistantLoadingState, aiActionLoading: aiActionLoadingState, loadingPrs: loadingPrsState, targetBranchName: targetBranchNameState, manualBranchName: manualBranchNameState, openPrs: openPrsState, isSettingsModalOpen: isSettingsModalOpenState, isParsing: isParsingState, currentAiRequestId: currentAiRequestIdState, imageReplaceTask: imageReplaceTaskState, allFetchedFiles: allFetchedFilesState, currentStep, repoUrl: repoUrlState,
            // State setters (Directly pass setters)
            setFetchStatus: setFetchStatusState, setRepoUrlEntered: setRepoUrlEnteredState, setFilesFetched: handleSetFilesFetched, setSelectedFetcherFiles: setSelectedFetcherFilesState, setKworkInputHasContent: setKworkInputHasContentState, setRequestCopied: setRequestCopiedState, setAiResponseHasContent: setAiResponseHasContentState, setFilesParsed: setFilesParsedState, setSelectedAssistantFiles: setSelectedAssistantFilesState, setAssistantLoading: setAssistantLoadingState, setAiActionLoading: setAiActionLoadingState, setLoadingPrs: setLoadingPrsState, setTargetBranchName: setTargetBranchNameState, setManualBranchName: setManualBranchNameState, setOpenPrs: setOpenPrsState, setIsParsing: setIsParsingState, setCurrentAiRequestId: setCurrentAiRequestIdState, setImageReplaceTask: setImageReplaceTaskState, setRepoUrl: setRepoUrlState,
            // Refs
            kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
            // Triggers / Actions / Helpers (Pass stable callbacks)
            triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection, addToast: addToastStable, getKworkInputValue: getKworkInputValueStable, updateKworkInput: updateKworkInputStable,
        };
    }, [ // Include ALL state values and stable callbacks/setters used in the return object
        isMounted, fetchStatusState, repoUrlEnteredState, filesFetchedState, selectedFetcherFilesState, kworkInputHasContentState, requestCopiedState, aiResponseHasContentState, filesParsedState, selectedAssistantFilesState, assistantLoadingState, aiActionLoadingState, loadingPrsState, targetBranchNameState, manualBranchNameState, openPrsState, isSettingsModalOpenState, isParsingState, currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, currentStep, repoUrlState,
        handleSetFilesFetched, triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection, addToastStable, getKworkInputValueStable, updateKworkInputStable,
        // Explicitly list setters if they were not stable via useCallback (but useState setters are stable)
        // setFetchStatusState, setRepoUrlEnteredState, /* setFilesFetched (covered by handleSetFilesFetched) */ setSelectedFetcherFilesState, setKworkInputHasContentState, setRequestCopiedState, setAiResponseHasContentState, setFilesParsedState, setSelectedAssistantFilesState, setAssistantLoadingState, setAiActionLoadingState, setLoadingPrsState, setTargetBranchNameState, setManualBranchNameState, setOpenPrsState, setIsParsingState, setCurrentAiRequestIdState, setImageReplaceTaskState, setRepoUrlState,
        // Include refs in dependency list for completeness, although they are stable
        kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef
    ]);

    return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );
};

// --- Consumer Hook ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (context === undefined || Object.keys(context).length === 0) { // Check for undefined or empty object (like initial value before mount)
        // This error might be happening during initial render or HMR if provider hasn't initialized fully
        logger.error("useRepoXmlPageContext called outside of Provider or before Provider initialized!");
        throw new Error('useRepoXmlPageContext must be used within a RepoXmlPageContextProvider that has initialized.');
    }
    return context;
};