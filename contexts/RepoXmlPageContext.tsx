"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
import { toast } from 'sonner';
import { FileNode } from '@/components/RepoTxtFetcher'; // Assuming FileNode is exported
export interface SimplePullRequest {
    id: number;
    number: number;
    title: string;
    html_url: string;
    user: { login: string | null; avatar_url: string | null } | null; // Allow user to be null
    head: { ref: string };
    base: { ref: string };
    updated_at: string; // Ensure this is present if used
}
import { debugLogger as logger } from '@/lib/debugLogger';
import { getGitHubUserProfile, createGitHubPullRequest, updateBranch, getOpenPullRequests } from '@/app/actions_github/actions'; // Import necessary actions

// --- Types ---
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
export type WorkflowStep =
  | 'idle'
  | 'ready_to_fetch'
  | 'fetching'
  | 'fetch_failed'
  | 'files_fetched'           // Files fetched, no specific highlights yet
  | 'files_fetched_highlights' // Files fetched, primary/secondary identified
  | 'files_fetched_image_replace' // Files fetched, target file exists for image replace task
  | 'files_selected'          // User selected files in fetcher
  | 'request_written'         // User has written text in kwork input
  | 'request_copied'          // User copied the request
  | 'generating_ai_response'  // Covers AI gen AND assistant processing (PRs, image replace)
  | 'response_pasted'         // User pasted response in assistant
  | 'parsing_response'
  | 'response_parsed'         // Assistant parsed files successfully (standard flow)
  | 'pr_ready';               // Files ready, PR details filled (standard flow)

// Image Replace Task definition
export interface ImageReplaceTask {
    targetPath: string;
    oldUrl: string;
    newUrl: string;
}

// --- AICodeAssistant Ref Type ---
// <<< MODIFIED: handleDirectImageReplace now accepts files array >>>
export interface AICodeAssistantRef {
    handleParse: () => Promise<void>;
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>;
    setResponseValue: (value: string) => void;
    updateRepoUrl: (url: string) => void;
    handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => Promise<void>; // Added files parameter
}

// --- RepoTxtFetcher Ref Type ---
export interface RepoTxtFetcherRef {
    handleFetch: (isManualRetry?: boolean, branchNameToFetch?: string | null) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => Promise<void>;
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    clearAll: () => void;
    getKworkInputValue: () => string;
}

// --- Context Value Type ---
interface RepoXmlPageContextType {
    // State
    fetchStatus: FetchStatus;
    repoUrlEntered: boolean;
    filesFetched: boolean; // Indicates if a fetch attempt completed (success or error)
    selectedFetcherFiles: Set<string>;
    kworkInputHasContent: boolean;
    requestCopied: boolean;
    aiResponseHasContent: boolean;
    filesParsed: boolean;
    selectedAssistantFiles: Set<string>;
    assistantLoading: boolean; // Loading state specific to AI Assistant actions (parse, PR create/update, image replace)
    aiActionLoading: boolean; // Loading state specific to the AI generation call
    loadingPrs: boolean; // Loading state for fetching open PRs
    targetBranchName: string | null; // Branch selected via PR list or default
    manualBranchName: string; // Branch entered manually in settings
    openPrs: SimplePullRequest[];
    isSettingsModalOpen: boolean;
    isParsing: boolean; // Code parsing in progress
    currentAiRequestId: string | null; // ID of the current AI generation request
    imageReplaceTask: ImageReplaceTask | null; // Task for direct image replacement
    allFetchedFiles: FileNode[]; // Holds all fetched files for reference

    // Derived State
    currentStep: WorkflowStep;

    // Setters / Triggers
    setFetchStatus: React.Dispatch<React.SetStateAction<FetchStatus>>;
    setRepoUrlEntered: React.Dispatch<React.SetStateAction<boolean>>;
    setFilesFetched: (
        fetched: boolean, // Indicates if fetch completed (might still be error if target not found)
        allFiles: FileNode[],
        primaryHighlight: string | null,
        secondaryHighlights: string[]
    ) => void; // This is the combined setter function
    setSelectedFetcherFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setKworkInputHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setRequestCopied: React.Dispatch<React.SetStateAction<boolean>>;
    setAiResponseHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setFilesParsed: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedAssistantFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setAssistantLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setAiActionLoading: React.Dispatch<React.SetStateAction<boolean>>; // Setter for AI action loading
    setTargetBranchName: React.Dispatch<React.SetStateAction<string | null>>;
    setManualBranchName: React.Dispatch<React.SetStateAction<string>>;
    setOpenPrs: React.Dispatch<React.SetStateAction<SimplePullRequest[]>>;
    triggerToggleSettingsModal: () => void;
    setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentAiRequestId: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;

    // Refs passed down (mutable, be careful)
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>;
    assistantRef: MutableRefObject<AICodeAssistantRef | null>;

    // Functions / Actions
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
    getXuinityMessage: () => string; // Gets dynamic message for buddy
    scrollToSection: (sectionId: 'fetcher' | 'kworkInput' | 'aiResponseInput' | 'executor' | 'prSection' | 'file-list-container' | 'response-input' | 'pr-form-container' | string) => void;
}


// --- Minimal Initial Context Value (for Build Time) ---
const initialMinimalContextValue: Omit<RepoXmlPageContextType, 'getXuinityMessage'> & { getXuinityMessage: () => string } = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle', setFetchStatus: () => {}, setRepoUrlEntered: () => {}, setFilesFetched: () => {}, setSelectedFetcherFiles: () => {}, setKworkInputHasContent: () => {}, setRequestCopied: () => {}, setAiResponseHasContent: () => {}, setFilesParsed: () => {}, setSelectedAssistantFiles: () => {}, setAssistantLoading: () => {}, setAiActionLoading: () => {}, setTargetBranchName: () => {}, setManualBranchName: () => {}, setOpenPrs: () => {}, triggerToggleSettingsModal: () => {}, setIsParsing: () => {}, setCurrentAiRequestId: () => {}, setImageReplaceTask: () => {}, kworkInputRef: { current: null }, aiResponseInputRef: { current: null }, fetcherRef: { current: null }, assistantRef: { current: null }, triggerFetch: async () => {}, triggerSelectHighlighted: () => {}, triggerAddSelectedToKwork: async () => {}, triggerCopyKwork: () => false, triggerAskAi: async () => ({ success: false, error: "Context not ready" }), triggerParseResponse: async () => {}, triggerSelectAllParsed: () => {}, triggerCreateOrUpdatePR: async () => {}, triggerUpdateBranch: async () => ({ success: false, error: "Context not ready" }), triggerGetOpenPRs: async () => {}, updateRepoUrlInAssistant: () => {}, getXuinityMessage: () => "Initializing...", scrollToSection: () => {},
};


// --- Context Creation ---
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(initialMinimalContextValue);


// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>; assistantRef: MutableRefObject<AICodeAssistantRef | null>; kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>; aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>; prSectionRef: MutableRefObject<HTMLElement | null>; }> = ({ children, fetcherRef: passedFetcherRef, assistantRef: passedAssistantRef, kworkInputRef: passedKworkRef, aiResponseInputRef: passedAiResponseRef }) => {
    const [isMounted, setIsMounted] = useState(false); // Track client mount
    const [fetchStatusState, setFetchStatusState] = useState<FetchStatus>('idle');
    const [repoUrlEnteredState, setRepoUrlEnteredState] = useState<boolean>(false);
    const [filesFetchedState, setFilesFetchedState] = useState<boolean>(false); // True if fetch completed (success or error)
    const [primaryHighlightPathState, setPrimaryHighlightPathState] = useState<string | null>(null);
    const [secondaryHighlightPathsState, setSecondaryHighlightPathsState] = useState<string[]>([]);
    const [selectedFetcherFilesState, setSelectedFetcherFilesState] = useState<Set<string>>(new Set());
    const [kworkInputHasContentState, setKworkInputHasContentState] = useState<boolean>(false);
    const [requestCopiedState, setRequestCopiedState] = useState<boolean>(false);
    const [aiResponseHasContentState, setAiResponseHasContentState] = useState<boolean>(false);
    const [filesParsedState, setFilesParsedState] = useState<boolean>(false);
    const [selectedAssistantFilesState, setSelectedAssistantFilesState] = useState<Set<string>>(new Set());
    const [assistantLoadingState, setAssistantLoadingState] = useState<boolean>(false);
    const [aiActionLoadingState, setAiActionLoadingState] = useState<boolean>(false); // Specific AI call loading
    const [loadingPrsState, setLoadingPrsState] = useState<boolean>(false);
    const [targetBranchNameState, setTargetBranchNameState] = useState<string | null>(null);
    const [manualBranchNameState, setManualBranchNameState] = useState<string>('');
    const [openPrsState, setOpenPrsState] = useState<SimplePullRequest[]>([]);
    const [isSettingsModalOpenState, setIsSettingsModalOpenState] = useState<boolean>(false);
    const [isParsingState, setIsParsingState] = useState<boolean>(false);
    const [currentAiRequestIdState, setCurrentAiRequestIdState] = useState<string | null>(null);
    const [imageReplaceTaskState, setImageReplaceTaskState] = useState<ImageReplaceTask | null>(null);
    const [allFetchedFilesState, setAllFetchedFilesState] = useState<FileNode[]>([]);

    const fetcherRef = passedFetcherRef;
    const assistantRef = passedAssistantRef;
    const kworkInputRef = passedKworkRef;
    const aiResponseInputRef = passedAiResponseRef;

    useEffect(() => {
        setIsMounted(true);
        logger.log("RepoXmlPageContext Mounted");
    }, []);

    // === Combined State Setter with Logging & Image Task Trigger ===
    // This function is now the primary way the Fetcher component updates the context after a fetch attempt.
    const setFilesFetchedCombined = useCallback((
        fetchAttemptSucceeded: boolean, // True if fetch API call itself succeeded (got files or empty array)
        allFiles: FileNode[], // The files returned by the API (can be empty)
        primaryHighlight: string | null,
        secondaryHighlights: string[]
    ) => {
        logger.log("[Context] setFilesFetchedCombined called:", { fetchAttemptSucceeded, primaryHighlight, secondaryCount: secondaryHighlights.length, allFilesCount: allFiles.length, taskActive: !!imageReplaceTaskState });

        setFilesFetchedState(true); // Mark that a fetch attempt *completed* (could still be error if target missing etc.)
        setAllFetchedFilesState(allFiles); // Store the fetched files regardless of success/failure
        setPrimaryHighlightPathState(primaryHighlight);
        setSecondaryHighlightPathsState(secondaryHighlights);

        let finalFetchStatus: FetchStatus = fetchAttemptSucceeded ? 'success' : 'error'; // Initial status based on API call

        // --- Image Task Trigger Logic ---
        if (imageReplaceTaskState) {
             if (fetchAttemptSucceeded) {
                const targetFileExists = allFiles.some(f => f.path === imageReplaceTaskState.targetPath);
                logger.log(`[Context] Image Task Check: Fetch Succeeded, Target Exists=${targetFileExists}, Ref Ready=${!!assistantRef.current}`);

                if (targetFileExists) {
                     finalFetchStatus = 'success'; // Confirmed success for image task fetch
                     if (assistantRef.current) {
                         logger.log("[Context] Image Replace Task: Target file found, triggering direct replace via setTimeout.", imageReplaceTaskState);
                         // Use setTimeout to ensure state updates propagate before calling assistant
                         setTimeout(() => {
                             if (assistantRef.current && imageReplaceTaskState) { // Re-check task state inside timeout
                                 logger.log("[Context] Calling assistantRef.current.handleDirectImageReplace now, passing fetched files.");
                                 // <<< PASS `allFiles` (the freshly fetched ones) directly >>>
                                 assistantRef.current.handleDirectImageReplace(imageReplaceTaskState, allFiles)
                                     .catch(err => logger.error("[Context] Error calling handleDirectImageReplace:", err));
                             } else {
                                 logger.warn("[Context] Assistant ref or task became null before handleDirectImageReplace call inside setTimeout.");
                             }
                         }, 50); // Small delay
                     } else {
                         logger.warn("[Context] Image Replace Task: Assistant ref not ready immediately after fetch completed. Task might not trigger.");
                     }
                } else {
                     logger.error(`[Context] Image Replace Task Error: Target file ${imageReplaceTaskState.targetPath} not found in fetched files! Aborting task.`);
                     toast.error(`Ошибка: Файл ${imageReplaceTaskState.targetPath} для замены не найден в репозитории/ветке.`);
                     setImageReplaceTaskState(null); // Clear the invalid task
                     finalFetchStatus = 'error'; // Set fetch status to error because target is missing
                }
            } else {
                // Fetch attempt itself failed
                logger.error("[Context] Image Replace Task Error: Fetch attempt failed.");
                finalFetchStatus = 'error'; // Already set
                // Optionally clear task if fetch failed? Depends on desired retry behavior.
                // setImageReplaceTaskState(null);
            }
        }
        // --- End Image Task Logic ---

        // Set the final fetch status based on the checks above
        setFetchStatusState(finalFetchStatus);
        logger.log(`[Context] setFilesFetchedCombined finished. Final Status: ${finalFetchStatus}`);

    }, [imageReplaceTaskState, assistantRef]); // Dependencies: imageReplaceTaskState, assistantRef


    // --- Workflow Step Calculation ---
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
    useEffect(() => {
        if (!isMounted) { setCurrentStep('idle'); return; }
        let calculatedStep: WorkflowStep = 'idle';
        if (imageReplaceTaskState) {
            // Image Task Workflow
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') { calculatedStep = 'fetching'; }
            else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) {
                // File fetched, now check if assistant is processing the replacement/PR
                if (assistantLoadingState) {
                     // Using assistantLoadingState which should be set by handleDirectImageReplace
                    calculatedStep = 'generating_ai_response'; // Re-use this state to indicate processing
                } else {
                    calculatedStep = 'files_fetched_image_replace'; // Ready for assistant or just finished
                }
            } else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) {
                // Fetch failed OR succeeded but target file not found OR task cleared due to error
                calculatedStep = 'fetch_failed';
            } else {
                calculatedStep = 'ready_to_fetch'; // Waiting to start fetch
            }
        } else {
            // Standard Workflow
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
            else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
            else if (isParsingState) calculatedStep = 'parsing_response';
            else if (aiActionLoadingState) calculatedStep = 'generating_ai_response'; // Only AI gen
            else if (assistantLoadingState) calculatedStep = 'generating_ai_response'; // Assistant processing PR/update
            else if (!filesFetchedState) calculatedStep = 'ready_to_fetch';
            else if (!kworkInputHasContentState) {
                if (primaryHighlightPathState || secondaryHighlightPathsState.length > 0) calculatedStep = 'files_fetched_highlights';
                else if (selectedFetcherFilesState.size > 0) calculatedStep = 'files_selected';
                else calculatedStep = 'files_fetched';
            }
            else if (kworkInputHasContentState && !aiResponseHasContentState && !requestCopiedState) calculatedStep = 'request_written';
            else if (requestCopiedState && !aiResponseHasContentState) calculatedStep = 'request_copied';
            else if (aiResponseHasContentState && !filesParsedState) calculatedStep = 'response_pasted';
            else if (filesParsedState) {
                 // Standard flow: Parsed and ready for PR, but not currently processing PR
                 calculatedStep = 'pr_ready';
            }
            else calculatedStep = 'idle'; // Fallback
        }
        setCurrentStep(prevStep => { if (prevStep !== calculatedStep) { logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`); return calculatedStep; } return prevStep; });
    // Added assistantLoadingState to dependencies for more accurate step updates
    }, [ isMounted, fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState, selectedFetcherFilesState, aiActionLoadingState, isParsingState, imageReplaceTaskState, allFetchedFilesState, assistantLoadingState ]);


    // --- Triggers (wrapped in useCallback for stability) ---
    const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => { if (fetcherRef.current?.handleFetch) { await fetcherRef.current.handleFetch(isRetry, branch); } else { logger.error("triggerFetch: fetcherRef is not set."); toast.error("Ошибка: Не удалось запустить извлечение."); } }, [fetcherRef]);
    const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current?.selectHighlightedFiles) { fetcherRef.current.selectHighlightedFiles(); } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); } }, [fetcherRef]);
    const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => { if (fetcherRef.current?.handleAddSelected) { await fetcherRef.current.handleAddSelected(); if (clearSelection) { setSelectedFetcherFilesState(new Set()); } } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); } }, [fetcherRef]);
    const triggerCopyKwork = useCallback((): boolean => { if (fetcherRef.current?.handleCopyToClipboard) { return fetcherRef.current.handleCopyToClipboard(); } else { logger.error("triggerCopyKwork: fetcherRef is not set."); return false; } }, [fetcherRef]);
    // Placeholder for actual AI call - replace with your implementation
    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
         logger.warn("AI Ask Triggered (Currently Placeholder)");
         if (!kworkInputRef.current?.value.trim()) {
             toast.error("Запрос к AI пуст!");
             return { success: false, error: "Empty prompt" };
         }
         const tempId = `req_${Date.now().toString(36)}`;
         setAiActionLoadingState(true);
         setCurrentAiRequestIdState(tempId);
         // Simulate AI delay
         await new Promise(res => setTimeout(res, 2500));
         const simulatedResponse = `// /simulated/response/from/ai/${tempId}.js\nconsole.log("AI generated this based on:", kworkInputRef.current?.value.substring(0,50) ?? '');\n\nfunction helloWorld() {\n console.log('Hello from AI!');\n}\n\n// End of simulation`;
         if (aiResponseInputRef.current) {
             aiResponseInputRef.current.value = simulatedResponse;
             // Dispatch input event to trigger state update in assistant if needed
             const event = new Event('input', { bubbles: true });
             aiResponseInputRef.current.dispatchEvent(event);
         }
         setAiActionLoadingState(false);
         setCurrentAiRequestIdState(null);
         setAiResponseHasContentState(true); // Mark response available
         setRequestCopiedState(false); // Reset copied state
         toast.success("Ответ AI получен (симуляция). Жми '➡️'");
         return { success: true, requestId: tempId };
    }, [kworkInputRef, aiResponseInputRef]); // Add refs as dependencies

    const triggerParseResponse = useCallback(async () => { if (assistantRef.current?.handleParse) { await assistantRef.current.handleParse(); } else { logger.error("triggerParseResponse: assistantRef is not set."); } }, [assistantRef]);
    const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current?.selectAllParsedFiles) { assistantRef.current.selectAllParsedFiles(); } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); } }, [assistantRef]);
    const triggerCreateOrUpdatePR = useCallback(async () => { if (assistantRef.current?.handleCreatePR) { await assistantRef.current.handleCreatePR(); } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); } }, [assistantRef]);

    const triggerGetOpenPRs = useCallback(async (url: string) => {
        if (!url || !url.includes('github.com')) { logger.log("triggerGetOpenPRs: Invalid or empty GitHub URL, clearing PRs."); setOpenPrsState([]); return; }
        logger.log("triggerGetOpenPRs: Fetching for", url);
        setLoadingPrsState(true);
        setOpenPrsState([]); // Clear previous PRs immediately
        let resultError = 'Неизвестная ошибка';
        try {
            const result = await getOpenPullRequests(url);
            if (result.success && result.pullRequests) {
                setOpenPrsState(result.pullRequests as SimplePullRequest[]);
                logger.log(`Fetched ${result.pullRequests.length} open PRs.`);
            } else {
                resultError = result.error || 'Не удалось загрузить PR';
                toast.error("Ошибка загрузки PR", { description: resultError, duration: 5000, style: { background: "rgba(220,38,38,0.9)", color: "#fff", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(3px)"} });
                // Keep PRs empty on error
            }
        } catch (error: any) {
            logger.error("triggerGetOpenPRs Action Call Error:", error);
            resultError = error.message || 'Ошибка сети или сервера';
            toast.error("Крит. ошибка загрузки PR", { description: resultError, duration: 5000, style: { background: "rgba(220,38,38,0.9)", color: "#fff", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(3px)"} });
            // Keep PRs empty on error
        } finally {
            setLoadingPrsState(false);
        }
    }, []); // No changing dependencies needed here

    const triggerUpdateBranch = useCallback(async ( repoUrl: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => {
        logger.log(`[Context] triggerUpdateBranch called for branch: ${branch}, PR#: ${prNumber ?? 'N/A'}`);
        try {
            setAssistantLoadingState(true); // Set loading specific to this action
            const result = await updateBranch(repoUrl, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription);
            if (result.success) {
                toast.success(`Ветка ${branch} обновлена!`);
                logger.log(`[Context] Branch ${branch} updated successfully. Refreshing PRs.`);
                await triggerGetOpenPRs(repoUrl); // Refresh PRs after successful update
                return { success: true };
            } else {
                toast.error(`Ошибка обновления ветки: ${result.error}`);
                logger.error(`[Context] Failed to update branch ${branch}: ${result.error}`);
                return { success: false, error: result.error };
            }
        } catch (error: any) {
            logger.error("[Context] triggerUpdateBranch critical Error:", error);
            toast.error(`Критическая ошибка обновления ветки: ${error.message}`);
            return { success: false, error: error.message };
        } finally {
            setAssistantLoadingState(false); // Clear loading specific to this action
            logger.log(`[Context] triggerUpdateBranch finished for branch: ${branch}`);
        }
    }, [triggerGetOpenPRs]); // Dependency on triggerGetOpenPRs is correct

    const updateRepoUrlInAssistant = useCallback((url: string) => { if (assistantRef.current?.updateRepoUrl) { assistantRef.current.updateRepoUrl(url); } else { logger.warn("updateRepoUrlInAssistant: assistantRef not ready yet."); } }, [assistantRef]);
    const triggerToggleSettingsModal = useCallback(() => { setIsSettingsModalOpenState(prev => !prev); }, []);
    const scrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            // Optional: Highlight effect
            setTimeout(() => {
                element.classList.add('highlight-scroll');
                setTimeout(() => element.classList.remove('highlight-scroll'), 1500);
            }, 300); // Delay highlight slightly after scroll starts
            logger.log(`Scrolled to section: ${sectionId}`);
        } else {
             logger.warn(`Scroll target not found: ${sectionId}`);
             // Fallback scroll logic if direct ID fails (useful for nested components)
             const parentExecutor = document.getElementById('executor');
             const parentExtractor = document.getElementById('extractor');
             if (sectionId.includes('kworkInput') || sectionId.includes('aiResponseInput') || sectionId.includes('prSection') || sectionId.includes('response-input') || sectionId.includes('pr-form-container')) {
                 parentExecutor?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                 logger.log(`Fallback scroll to executor for: ${sectionId}`);
             } else if (sectionId.includes('file-list-container') || sectionId.includes('extractor')) {
                 parentExtractor?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                 logger.log(`Fallback scroll to extractor for: ${sectionId}`);
             }
        }
    }, []);

    // --- getXuinityMessage (for AutomationBuddy) ---
    const getXuinityMessage = useCallback((): string => {
         if (!isMounted) return "Инициализация...";

         // Prioritize Image Task Messages
         if (imageReplaceTaskState) {
             switch(currentStep) {
                 case 'ready_to_fetch': return "Готовлюсь загрузить файл для замены картинки...";
                 case 'fetching': return "Загружаю целевой файл для замены...";
                 case 'fetch_failed': return "Ой! Не смог загрузить файл для замены. Проверь путь или попробуй снова.";
                 case 'files_fetched_image_replace': return assistantLoadingState ? "Меняю картинку и готовлю PR/обновление..." : "Файл загружен! Передаю задачу Ассистенту для замены и PR.";
                 case 'generating_ai_response': // Re-used step for assistant processing
                     return assistantLoadingState ? "Меняю картинку и готовлю PR/обновление..." : "Обработка..."; // More specific message
                 default: return "Работаю над заменой картинки...";
             }
         }

         // Standard Workflow Messages
         switch (currentStep) {
             case 'idle': return "Готов к работе! Введи URL репо.";
             case 'ready_to_fetch': return repoUrlEnteredState ? `URL вижу! Жми "Извлечь файлы" для ветки '${manualBranchNameState || targetBranchNameState || 'default'}'.` : "Жду URL репозитория в настройках...";
             case 'fetching': return `Тяну файлы из ветки '${manualBranchNameState || targetBranchNameState || 'default'}'. Минутку...`;
             case 'fetch_failed': return "Упс! Не смог загрузить файлы. Попробуй еще раз или проверь URL/токен/ветку.";
             case 'files_fetched': return "Файлы загружены! Что будем делать? Можешь выбрать файлы или сразу спросить AI.";
             case 'files_fetched_highlights': return `Файлы есть! Вижу связи (${primaryHighlightPathState ? 'основной' : ''}${primaryHighlightPathState && secondaryHighlightPathsState.length > 0 ? ' + ' : ''}${secondaryHighlightPathsState.length > 0 ? secondaryHighlightPathsState.length + ' втор.' : ''}). Выбирай или добавляй в запрос.`;
             case 'files_selected': return `${selectedFetcherFilesState.size} файлов выбрано. Добавляй в запрос или сразу спрашивай AI.`;
             case 'request_written': return "Отличный запрос! Теперь жми 'Спросить AI' или скопируй текст.";
             case 'request_copied': return "Запрос скопирован! Жду твоего ответа от AI в поле ниже.";
             case 'generating_ai_response': // Handles both AI generation and PR processing
                 return aiActionLoadingState ? `Думаю... AI генерирует ответ (ID: ${currentAiRequestIdState?.substring(0, 6)}...).` : assistantLoadingState ? "⚙️ Обработка PR/Ветки..." : "⏳ Обработка...";
             case 'response_pasted': return "Вижу ответ AI! Жми 'Разобрать Ответ' (➡️), чтобы я проверил код.";
             case 'parsing_response': return "Анализирую код из ответа AI...";
             case 'response_parsed': case 'pr_ready':
                 const actionText = targetBranchNameState ? 'Обновить Ветку' : 'Создать PR';
                 const fileCountText = selectedAssistantFilesState.size > 0 ? `(${selectedAssistantFilesState.size} файлов)` : '(выбери файлы!)';
                 // If assistantLoading, the 'generating_ai_response' step message takes precedence
                 return assistantLoadingState ? "⚙️ Обработка PR/Ветки..." : `Код готов! Жми '${actionText}' ${fileCountText}.`;
             default: return "Давай что-нибудь замутим!";
         }
     // Added assistantLoadingState, aiActionLoadingState to dependencies
     }, [ isMounted, currentStep, repoUrlEnteredState, manualBranchNameState, targetBranchNameState, primaryHighlightPathState, secondaryHighlightPathsState.length, selectedFetcherFilesState.size, selectedAssistantFilesState.size, currentAiRequestIdState, imageReplaceTaskState, assistantLoadingState, aiActionLoadingState ]);


    // --- Memoized Context Value ---
    const contextValue = useMemo(() => {
        if (!isMounted) {
            // logger.log("RepoXmlPageContext: Providing MINIMAL context value (SSR/Build)"); // Reduced log noise
            return initialMinimalContextValue;
        }
        return {
            // State
            fetchStatus: fetchStatusState, repoUrlEntered: repoUrlEnteredState, filesFetched: filesFetchedState,
            selectedFetcherFiles: selectedFetcherFilesState, kworkInputHasContent: kworkInputHasContentState,
            requestCopied: requestCopiedState, aiResponseHasContent: aiResponseHasContentState, filesParsed: filesParsedState,
            selectedAssistantFiles: selectedAssistantFilesState, assistantLoading: assistantLoadingState,
            aiActionLoading: aiActionLoadingState, loadingPrs: loadingPrsState, targetBranchName: targetBranchNameState,
            manualBranchName: manualBranchNameState, openPrs: openPrsState, isSettingsModalOpen: isSettingsModalOpenState,
            isParsing: isParsingState, currentAiRequestId: currentAiRequestIdState, imageReplaceTask: imageReplaceTaskState,
            allFetchedFiles: allFetchedFilesState,
            // Derived State
            currentStep,
            // Setters / Triggers
            setFetchStatus: setFetchStatusState, setRepoUrlEntered: setRepoUrlEnteredState, setFilesFetched: setFilesFetchedCombined,
            setSelectedFetcherFiles: setSelectedFetcherFilesState, setKworkInputHasContent: setKworkInputHasContentState,
            setRequestCopied: setRequestCopiedState, setAiResponseHasContent: setAiResponseHasContentState,
            setFilesParsed: setFilesParsedState, setSelectedAssistantFiles: setSelectedAssistantFilesState,
            setAssistantLoading: setAssistantLoadingState, setAiActionLoading: setAiActionLoadingState,
            setTargetBranchName: setTargetBranchNameState, setManualBranchName: setManualBranchNameState,
            setOpenPrs: setOpenPrsState, triggerToggleSettingsModal, setIsParsing: setIsParsingState,
            setCurrentAiRequestId: setCurrentAiRequestIdState, setImageReplaceTask: setImageReplaceTaskState,
            // Refs
            kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
            // Functions / Actions
            triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi,
            triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch,
            triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection,
        };
    // --- Ensure all state values AND stable callbacks/refs are dependencies ---
    }, [
        isMounted, fetchStatusState, repoUrlEnteredState, filesFetchedState, selectedFetcherFilesState, kworkInputHasContentState,
        requestCopiedState, aiResponseHasContentState, filesParsedState, selectedAssistantFilesState, assistantLoadingState,
        aiActionLoadingState, loadingPrsState, targetBranchNameState, manualBranchNameState, openPrsState, isSettingsModalOpenState,
        isParsingState, currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, currentStep,
        // Stable Callbacks & Refs
        setFilesFetchedCombined, kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef, triggerToggleSettingsModal,
        triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi,
        triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch,
        triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection
    ]);


    return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );
};

// --- Consumer Hook ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (context === initialMinimalContextValue && typeof window !== 'undefined') {
        // This warning might appear briefly during hydration, usually benign.
        // console.warn("useRepoXmlPageContext: Consuming initial minimal context value. Wait for mount?");
    }
    return context;
};