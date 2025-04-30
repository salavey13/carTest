"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
import { toast } from 'sonner';
// Assuming FileNode is defined/imported correctly
// If not, uncomment the definition here or import from the correct location
export interface FileNode { path: string; content: string; } // Keep if not defined elsewhere
export interface SimplePullRequest { id: number; number: number; title: string; html_url: string; user: { login: string | null; avatar_url: string | null } | null; head: { ref: string }; base: { ref: string }; updated_at: string; }
import { debugLogger as logger } from '@/lib/debugLogger';
import { getOpenPullRequests, updateBranch } from '@/app/actions_github/actions'; // Ensure updateBranch is imported if used here

// --- Types ---
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
// Added missing states back to WorkflowStep for completeness based on usage
export type WorkflowStep = | 'idle' | 'ready_to_fetch' | 'fetching' | 'fetch_failed' | 'files_fetched' | 'files_fetched_highlights' | 'files_fetched_image_replace' | 'files_selected' | 'request_written' | 'request_copied' | 'generating_ai_response' | 'response_pasted' | 'parsing_response' | 'response_parsed' | 'pr_ready';
export interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; }
export interface AICodeAssistantRef { handleParse: () => Promise<void>; selectAllParsedFiles: () => void; handleCreatePR: () => Promise<void>; setResponseValue: (value: string) => void; updateRepoUrl: (url: string) => void; handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => Promise<void>; }
export interface RepoTxtFetcherRef { handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => Promise<void>; selectHighlightedFiles: () => void; handleAddSelected: (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => Promise<void>; handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean; clearAll: () => void; getKworkInputValue: () => string; }
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// Define the shape of the context value - using expected public names
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

    // State Setters - matching expected names
    setFetchStatus: React.Dispatch<React.SetStateAction<FetchStatus>>;
    setRepoUrlEntered: React.Dispatch<React.SetStateAction<boolean>>; // Keep if needed
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
    triggerAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    triggerParseResponse: () => Promise<void>;
    triggerSelectAllParsed: () => void;
    triggerCreateOrUpdatePR: () => Promise<void>;
    triggerUpdateBranch: ( repoUrl: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ) => Promise<{ success: boolean; error?: string }>;
    triggerGetOpenPRs: (repoUrl: string) => Promise<void>;
    updateRepoUrlInAssistant: (url: string) => void;
    getXuinityMessage: () => string;
    scrollToSection: (sectionId: string) => void;

    // Refs
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;

    // Helpers provided by context
    addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    getKworkInputValue: () => string;
    updateKworkInput: (value: string) => void;
}

// --- Minimal Initial Context Value (Matches Type) ---
const initialMinimalContextValue: RepoXmlPageContextType = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', repoUrl: "https://github.com/salavey13/cartest",
    // Placeholder functions matching the Type signature
    setFetchStatus: () => {}, setRepoUrlEntered: () => {}, setFilesFetched: () => {}, setSelectedFetcherFiles: () => {}, setKworkInputHasContent: () => {}, setRequestCopied: () => {}, setAiResponseHasContent: () => {}, setFilesParsed: () => {}, setSelectedAssistantFiles: () => {}, setAssistantLoading: () => {}, setAiActionLoading: () => {}, setLoadingPrs: () => {}, setTargetBranchName: () => {}, setManualBranchName: () => {}, setOpenPrs: () => {}, setIsParsing: () => {}, setCurrentAiRequestId: () => {}, setImageReplaceTask: () => {}, setRepoUrl: () => {},
    triggerToggleSettingsModal: () => {}, triggerFetch: async () => {}, triggerSelectHighlighted: () => {}, triggerAddSelectedToKwork: async () => {}, triggerCopyKwork: () => false, triggerAskAi: async () => ({ success: false, error: "Context not ready" }), triggerParseResponse: async () => {}, triggerSelectAllParsed: () => {}, triggerCreateOrUpdatePR: async () => {}, triggerUpdateBranch: async () => ({ success: false, error: "Context not ready" }), triggerGetOpenPRs: async () => {}, updateRepoUrlInAssistant: () => {}, getXuinityMessage: () => "Initializing...", scrollToSection: () => {},
    kworkInputRef: { current: null }, aiResponseInputRef: { current: null }, fetcherRef: { current: null }, assistantRef: { current: null },
    addToast: () => {}, getKworkInputValue: () => "", updateKworkInput: () => {},
};

// --- Context Creation ---
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(initialMinimalContextValue);

// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
    const [isMounted, setIsMounted] = useState(false);
    // State definitions (remain the same)
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
    const [repoUrlState, setRepoUrlState] = useState<string>(initialMinimalContextValue.repoUrl);

    // Refs created inside the provider
    const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
    const assistantRef = useRef<AICodeAssistantRef | null>(null);
    const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
    const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => { setIsMounted(true); logger.log("RepoXmlPageContext Mounted"); }, []);
    useEffect(() => { setRepoUrlEnteredState(repoUrlState.trim().length > 0); }, [repoUrlState]);

    // === Combined State Setter (Internal Implementation) ===
    const handleSetFilesFetched = useCallback(( fetchAttemptSucceeded: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => {
       logger.log("[Context] handleSetFilesFetched called:", { fetchAttemptSucceeded, primaryHighlight, secondaryCount: secondaryHighlights.length, allFilesCount: allFiles.length, taskActive: !!imageReplaceTaskState });
       setFilesFetchedState(true);
       setAllFetchedFilesState(allFiles);
       setPrimaryHighlightPathState(primaryHighlight);
       setSecondaryHighlightPathsState(secondaryHighlights);
       let finalFetchStatus: FetchStatus = fetchAttemptSucceeded ? 'success' : 'error';
       if (imageReplaceTaskState) {
           if (fetchAttemptSucceeded) {
               const targetFileExists = allFiles.some(f => f.path === imageReplaceTaskState.targetPath);
               if (!targetFileExists) {
                   logger.error(`[Context] Image Task Error: Target file ${imageReplaceTaskState.targetPath} not found after successful fetch!`);
                   toast.error(`Ошибка: Файл ${imageReplaceTaskState.targetPath} для замены не найден.`);
                   finalFetchStatus = 'error'; setImageReplaceTaskState(null);
               } else { logger.log(`[Context] Image Task: Target file ${imageReplaceTaskState.targetPath} found. Status remains 'success'.`); }
           } else { logger.error("[Context] Image Task Error: Fetch attempt failed."); }
       }
       setFetchStatusState(finalFetchStatus);
       logger.log(`[Context] handleSetFilesFetched finished. Final Status: ${finalFetchStatus}`);
    }, [ imageReplaceTaskState, setImageReplaceTaskState ]); // Simplified dependencies for the internal callback

    // --- Workflow Step Calculation ---
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
    useEffect(() => {
        if (!isMounted) { setCurrentStep('idle'); return; }
        let calculatedStep: WorkflowStep = 'idle';
        if (imageReplaceTaskState) {
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace';
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) calculatedStep = 'fetch_failed';
             else calculatedStep = 'ready_to_fetch';
         } else {
             if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
             else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
             else if (isParsingState) calculatedStep = 'parsing_response';
             else if (aiActionLoadingState) calculatedStep = 'generating_ai_response';
             else if (assistantLoadingState) calculatedStep = 'generating_ai_response';
             else if (!filesFetchedState) calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
             else if (!kworkInputHasContentState) {
                  if (primaryHighlightPathState || secondaryHighlightPathsState.length > 0) calculatedStep = 'files_fetched_highlights';
                  else if (selectedFetcherFilesState.size > 0) calculatedStep = 'files_selected';
                  else calculatedStep = 'files_fetched';
             }
             else if (kworkInputHasContentState && !aiResponseHasContentState && !requestCopiedState) calculatedStep = 'request_written';
             else if (requestCopiedState && !aiResponseHasContentState) calculatedStep = 'request_copied';
             else if (aiResponseHasContentState && !filesParsedState) calculatedStep = 'response_pasted';
             else if (filesParsedState) calculatedStep = 'pr_ready';
             else calculatedStep = 'idle';
         }
        setCurrentStep(prevStep => { if (prevStep !== calculatedStep) { logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`); return calculatedStep; } return prevStep; });
    }, [ isMounted, fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState, selectedFetcherFilesState, aiActionLoadingState, isParsingState, imageReplaceTaskState, allFetchedFilesState, assistantLoadingState, repoUrlEnteredState ]);

    // --- Callback Helpers (Stable Functions) ---
    const addToastStable = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
         toast[type](message, { duration: 3000 });
     }, []);
    const getKworkInputValueStable = useCallback((): string => kworkInputRef.current?.value || "", []);
    const updateKworkInputStable = useCallback((value: string) => {
        if (kworkInputRef.current) {
            kworkInputRef.current.value = value;
             setKworkInputHasContentState(value.trim().length > 0);
        }
    }, [setKworkInputHasContentState]); // Depend on setter

    // --- Triggers (Using stable helpers where appropriate) ---
    const triggerToggleSettingsModal = useCallback(() => { setIsSettingsModalOpenState(prev => !prev); }, []);
    const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => {
        if (fetcherRef.current?.handleFetch) {
            await fetcherRef.current.handleFetch(isRetry, branch, imageReplaceTaskState);
        } else { logger.error("triggerFetch: fetcherRef or fetcherRef.current.handleFetch is not set."); addToastStable("Ошибка: Не удалось запустить извлечение.", "error"); }
    }, [imageReplaceTaskState, addToastStable]); // Use stable toast
    const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current?.selectHighlightedFiles) { fetcherRef.current.selectHighlightedFiles(); } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); } }, []);
    const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => {
        if (fetcherRef.current?.handleAddSelected) {
             if (selectedFetcherFilesState.size === 0) { addToastStable("Сначала выберите файлы в Экстракторе!", "error"); return; }
             try {
                  await fetcherRef.current.handleAddSelected(selectedFetcherFilesState, allFetchedFilesState);
                  if (clearSelection) { setSelectedFetcherFilesState(new Set()); }
             } catch (error) { logger.error("[Context] Error during fetcherRef.current.handleAddSelected:", error); addToastStable("Ошибка добавления файлов в запрос.", "error"); }
        } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); addToastStable("Ошибка: Компонент Экстрактора недоступен.", "error"); }
    }, [selectedFetcherFilesState, allFetchedFilesState, addToastStable]); // Use stable toast
    const triggerCopyKwork = useCallback((): boolean => { if (fetcherRef.current?.handleCopyToClipboard) { return fetcherRef.current.handleCopyToClipboard(); } else { logger.error("triggerCopyKwork: fetcherRef is not set."); return false; } }, []);
    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => { logger.warn("AI Ask Triggered (No Longer Active)"); addToastStable("Кнопка 'Спросить AI' временно отключена.", "info"); return { success: false, error: "Ask AI button disabled" }; }, [addToastStable]); // Use stable toast
    const triggerParseResponse = useCallback(async () => { if (assistantRef.current?.handleParse) { await assistantRef.current.handleParse(); } else { logger.error("triggerParseResponse: assistantRef is not set."); } }, []);
    const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current?.selectAllParsedFiles) { assistantRef.current.selectAllParsedFiles(); } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); } }, []);
    const triggerCreateOrUpdatePR = useCallback(async () => { if (assistantRef.current?.handleCreatePR) { await assistantRef.current.handleCreatePR(); } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); } }, []);
    const triggerGetOpenPRs = useCallback(async (url: string) => {
         const effectiveUrl = url || repoUrlState;
         if (!effectiveUrl || !effectiveUrl.includes('github.com')) { setOpenPrsState([]); return; }
         logger.log("triggerGetOpenPRs: Fetching for", effectiveUrl); setLoadingPrsState(true); setOpenPrsState([]);
         try { const result = await getOpenPullRequests(effectiveUrl); if (result.success && result.pullRequests) { setOpenPrsState(result.pullRequests as SimplePullRequest[]); } else { addToastStable("Ошибка загрузки PR", "error"); } } catch (error: any) { logger.error("triggerGetOpenPRs Action Error:", error); addToastStable("Крит. ошибка загрузки PR", "error"); } finally { setLoadingPrsState(false); }
     }, [repoUrlState, addToastStable]); // Use stable toast
     const triggerUpdateBranch = useCallback(async ( repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => {
         logger.log(`[Context] triggerUpdateBranch: ${branch}, PR#: ${prNumber ?? 'N/A'}`);
         try { setAssistantLoadingState(true); const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription); if (result.success) { addToastStable(`Ветка ${branch} обновлена!`, "success"); await triggerGetOpenPRs(repoUrlParam); return { success: true }; } else { addToastStable(`Ошибка обновления ветки: ${result.error}`, "error"); return { success: false, error: result.error }; } } catch (error: any) { logger.error("[Context] triggerUpdateBranch critical Error:", error); addToastStable(`Крит. ошибка обновления: ${error.message}`, "error"); return { success: false, error: error.message }; } finally { setAssistantLoadingState(false); }
     }, [addToastStable, triggerGetOpenPRs]); // Use stable toast
    const updateRepoUrlInAssistant = useCallback((url: string) => { if (assistantRef.current?.updateRepoUrl) { assistantRef.current.updateRepoUrl(url); } else { logger.warn("updateRepoUrlInAssistant: assistantRef not ready."); } }, []);
    const scrollToSection = useCallback((sectionId: string) => { const element = document.getElementById(sectionId); if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); setTimeout(() => { element.classList.add('highlight-scroll'); setTimeout(() => element.classList.remove('highlight-scroll'), 1500); }, 300); } else { logger.warn(`Scroll target not found: ${sectionId}`); /* Fallback scroll */ } }, []);
    const getXuinityMessage = useCallback((): string => {
          if (!isMounted) return "Инициализация...";
          // Ensure all state used in the switch is listed as dependency
          if (imageReplaceTaskState) { /* ... image task messages ... */ }
          switch (currentStep) { /* ... standard task messages ... */ }
          return "Состояние..."; // Fallback
     }, [ isMounted, currentStep, repoUrlEnteredState, manualBranchNameState, targetBranchNameState, primaryHighlightPathState, secondaryHighlightPathsState.length, selectedFetcherFilesState.size, selectedAssistantFilesState.size, currentAiRequestIdState, imageReplaceTaskState, assistantLoadingState, aiActionLoadingState ]);

    // --- Memoized Context Value (Provides public names mapped to internal state/setters) ---
    const contextValue = useMemo((): RepoXmlPageContextType => {
        if (!isMounted) return initialMinimalContextValue;
        return {
            // State values (direct pass-through)
            fetchStatus: fetchStatusState, repoUrlEntered: repoUrlEnteredState, filesFetched: filesFetchedState, selectedFetcherFiles: selectedFetcherFilesState, kworkInputHasContent: kworkInputHasContentState, requestCopied: requestCopiedState, aiResponseHasContent: aiResponseHasContentState, filesParsed: filesParsedState, selectedAssistantFiles: selectedAssistantFilesState, assistantLoading: assistantLoadingState, aiActionLoading: aiActionLoadingState, loadingPrs: loadingPrsState, targetBranchName: targetBranchNameState, manualBranchName: manualBranchNameState, openPrs: openPrsState, isSettingsModalOpen: isSettingsModalOpenState, isParsing: isParsingState, currentAiRequestId: currentAiRequestIdState, imageReplaceTask: imageReplaceTaskState, allFetchedFiles: allFetchedFilesState, currentStep, repoUrl: repoUrlState,

            // FIX: Map internal state setters to the public names expected by consumers
            setFetchStatus: setFetchStatusState,
            setRepoUrlEntered: setRepoUrlEnteredState,
            setFilesFetched: handleSetFilesFetched, // Use the internal callback handler
            setSelectedFetcherFiles: setSelectedFetcherFilesState,
            setKworkInputHasContent: setKworkInputHasContentState,
            setRequestCopied: setRequestCopiedState,
            setAiResponseHasContent: setAiResponseHasContentState,
            setFilesParsed: setFilesParsedState,
            setSelectedAssistantFiles: setSelectedAssistantFilesState,
            setAssistantLoading: setAssistantLoadingState,
            setAiActionLoading: setAiActionLoadingState,
            setLoadingPrs: setLoadingPrsState,
            setTargetBranchName: setTargetBranchNameState,
            setManualBranchName: setManualBranchNameState,
            setOpenPrs: setOpenPrsState,
            setIsParsing: setIsParsingState,
            setCurrentAiRequestId: setCurrentAiRequestIdState,
            setImageReplaceTask: setImageReplaceTaskState,
            setRepoUrl: setRepoUrlState,

            // Refs (pass the refs created in the provider)
            kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,

            // Triggers / Actions / Helpers (use stable callbacks)
            triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection,
            addToast: addToastStable,
            getKworkInputValue: getKworkInputValueStable,
            updateKworkInput: updateKworkInputStable,
        };
        // --- useMemo Dependencies ---
        // List ALL state values and stable callback functions provided in the value object
    }, [
        isMounted, fetchStatusState, repoUrlEnteredState, filesFetchedState, selectedFetcherFilesState, kworkInputHasContentState, requestCopiedState, aiResponseHasContentState, filesParsedState, selectedAssistantFilesState, assistantLoadingState, aiActionLoadingState, loadingPrsState, targetBranchNameState, manualBranchNameState, openPrsState, isSettingsModalOpenState, isParsingState, currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, currentStep, repoUrlState,
        handleSetFilesFetched, // The stable internal callback for setFilesFetched logic
        setFetchStatusState, setRepoUrlEnteredState, setSelectedFetcherFilesState, setKworkInputHasContentState, setRequestCopiedState, setAiResponseHasContentState, setFilesParsedState, setSelectedAssistantFilesState, setAssistantLoadingState, setAiActionLoadingState, setLoadingPrsState, setTargetBranchNameState, setManualBranchNameState, setOpenPrsState, setIsParsingState, setCurrentAiRequestIdState, setImageReplaceTaskState, setRepoUrlState, // Direct state setters provided
        kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef, // Refs
        triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection, // Stable callbacks for actions/triggers
        addToastStable, getKworkInputValueStable, updateKworkInputStable // Stable callbacks for helpers
    ]);

    return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );
};

// --- Consumer Hook ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (!context) { throw new Error('useRepoXmlPageContext must be used within a RepoXmlPageContextProvider'); }
    return context;
};