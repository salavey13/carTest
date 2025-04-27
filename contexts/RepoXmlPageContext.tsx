// MODIFICATIONS:
// - Added `allFetchedFiles` state to hold all files fetched from the repo.
// - Modified `setFilesFetched` to be `setFilesFetchedCombined` which now accepts and sets `allFetchedFiles`.
// - In `setFilesFetchedCombined`:
//     - Added logic to check for `imageReplaceTask` *after* files are fetched.
//     - If task is active and target file exists in `allFiles`, trigger `assistantRef.current.handleDirectImageReplace` using `setTimeout` for safety.
//     - If task is active but target file is *not* found, log error, show toast, clear task, set fetch status to error.
//     - Included `assistantRef` in the dependency array.
// - Added a new `WorkflowStep`: `files_fetched_image_replace`.
// - Updated `currentStep` calculation logic to include the new step and prioritize image task flow.
// - Updated `getXuinityMessage` to provide appropriate messages for the image replacement flow.
// - Passed `allFetchedFiles` down in the context value.
// - Updated initial context value to include `allFetchedFiles`.
// - Updated dependencies for `useMemo` on `contextValue`.
// - Added logging for the image replace trigger logic.
"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
import { toast } from 'sonner';
import { FileNode } from '@/components/RepoTxtFetcher'; // Assuming FileNode is exported
// Use a simpler type for PRs if full type causes issues, but try to keep necessary fields
// import { PullRequest } from '@octokit/webhooks-types'; // Original broader type
// Define a simpler PR type based on what's actually used/returned by actions
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
  | 'generating_ai_response'
  | 'response_pasted'         // User pasted response in assistant
  | 'parsing_response'
  | 'response_parsed'         // Assistant parsed files successfully
  | 'pr_ready';               // Files ready, PR details filled

// Image Replace Task definition
export interface ImageReplaceTask {
    targetPath: string;
    oldUrl: string;
    newUrl: string;
}

// --- AICodeAssistant Ref Type ---
export interface AICodeAssistantRef {
    handleParse: () => Promise<void>;
    selectAllParsedFiles: () => void;
    handleCreatePR: () => Promise<void>;
    setResponseValue: (value: string) => void;
    updateRepoUrl: (url: string) => void;
    handleDirectImageReplace: (task: ImageReplaceTask) => Promise<void>; // Added method
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
    allFetchedFiles: FileNode[]; // <<< ADDED: Hold all fetched files for reference >>>

    // Derived State
    currentStep: WorkflowStep;

    // Setters / Triggers
    setFetchStatus: React.Dispatch<React.SetStateAction<FetchStatus>>;
    setRepoUrlEntered: React.Dispatch<React.SetStateAction<boolean>>;
    // <<< MODIFIED: Combined setter >>>
    setFilesFetched: (
        fetched: boolean, // Indicates if fetch completed (might still be error if target not found)
        allFiles: FileNode[],
        primaryHighlight: string | null,
        secondaryHighlights: string[]
    ) => void;
    setSelectedFetcherFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setKworkInputHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setRequestCopied: React.Dispatch<React.SetStateAction<boolean>>;
    setAiResponseHasContent: React.Dispatch<React.SetStateAction<boolean>>;
    setFilesParsed: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedAssistantFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    setAssistantLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setAiActionLoading: React.Dispatch<React.SetStateAction<boolean>>; // Setter for AI action loading
    // setLoadingPrs managed internally by triggerGetOpenPRs
    setTargetBranchName: React.Dispatch<React.SetStateAction<string | null>>;
    setManualBranchName: React.Dispatch<React.SetStateAction<string>>;
    setOpenPrs: React.Dispatch<React.SetStateAction<SimplePullRequest[]>>;
    triggerToggleSettingsModal: () => void;
    setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentAiRequestId: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    setAllFetchedFiles: React.Dispatch<React.SetStateAction<FileNode[]>>; // Keep direct setter? Maybe not needed if combined setter works. Let's remove for now.

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
    scrollToSection: (sectionId: 'fetcher' | 'kworkInput' | 'aiResponseInput' | 'executor' | 'prSection' | 'file-list-container' | 'response-input' | 'pr-form-container' | string) => void; // Added more specific IDs
}


// --- Minimal Initial Context Value (for Build Time) ---
const initialMinimalContextValue: Omit<RepoXmlPageContextType, 'getXuinityMessage'> & { getXuinityMessage: () => string } = {
    // State with safe defaults
    fetchStatus: 'idle',
    repoUrlEntered: false,
    filesFetched: false,
    selectedFetcherFiles: new Set(),
    kworkInputHasContent: false,
    requestCopied: false,
    aiResponseHasContent: false,
    filesParsed: false,
    selectedAssistantFiles: new Set(),
    assistantLoading: false,
    aiActionLoading: false,
    loadingPrs: false,
    targetBranchName: null,
    manualBranchName: '',
    openPrs: [],
    isSettingsModalOpen: false,
    isParsing: false,
    currentAiRequestId: null,
    imageReplaceTask: null,
    allFetchedFiles: [], // Initial empty array
    // Derived State
    currentStep: 'idle', // Provide default step for minimal context
    // Setters / Triggers (provide stubs)
    setFetchStatus: () => {},
    setRepoUrlEntered: () => {},
    setFilesFetched: () => {}, // Stub for combined setter
    setSelectedFetcherFiles: () => {},
    setKworkInputHasContent: () => {},
    setRequestCopied: () => {},
    setAiResponseHasContent: () => {},
    setFilesParsed: () => {},
    setSelectedAssistantFiles: () => {},
    setAssistantLoading: () => {},
    setAiActionLoading: () => {},
    setTargetBranchName: () => {},
    setManualBranchName: () => {},
    setOpenPrs: () => {},
    triggerToggleSettingsModal: () => {},
    setIsParsing: () => {},
    setCurrentAiRequestId: () => {},
    setImageReplaceTask: () => {},
    // setAllFetchedFiles: () => {}, // Removed direct setter
    // Refs (initialize as null refs)
    kworkInputRef: { current: null },
    aiResponseInputRef: { current: null },
    fetcherRef: { current: null },
    assistantRef: { current: null },
    // Functions / Actions (provide stubs)
    triggerFetch: async () => {},
    triggerSelectHighlighted: () => {},
    triggerAddSelectedToKwork: async () => {},
    triggerCopyKwork: () => false,
    triggerAskAi: async () => ({ success: false, error: "Context not ready" }),
    triggerParseResponse: async () => {},
    triggerSelectAllParsed: () => {},
    triggerCreateOrUpdatePR: async () => {},
    triggerUpdateBranch: async () => ({ success: false, error: "Context not ready" }),
    triggerGetOpenPRs: async () => {},
    updateRepoUrlInAssistant: () => {},
    getXuinityMessage: () => "Initializing...", // Safe initial message
    scrollToSection: () => {},
};


// --- Context Creation ---
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(initialMinimalContextValue);


// --- Context Provider Component ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>; assistantRef: MutableRefObject<AICodeAssistantRef | null>; kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>; aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>; prSectionRef: MutableRefObject<HTMLElement | null>; }> = ({ children, fetcherRef: passedFetcherRef, assistantRef: passedAssistantRef, kworkInputRef: passedKworkRef, aiResponseInputRef: passedAiResponseRef }) => {
    const [isMounted, setIsMounted] = useState(false); // Track client mount

    // === State Definitions ===
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
    const [allFetchedFilesState, setAllFetchedFilesState] = useState<FileNode[]>([]); // <<< ADDED State >>>

    // === Use passed refs ===
    const fetcherRef = passedFetcherRef;
    const assistantRef = passedAssistantRef;
    const kworkInputRef = passedKworkRef;
    const aiResponseInputRef = passedAiResponseRef;

    // === useEffect to signal mount ===
    useEffect(() => {
        setIsMounted(true);
        logger.log("RepoXmlPageContext Mounted");
    }, []);

    // === Combined State Setter with Logging & Image Task Trigger ===
    const setFilesFetchedCombined = useCallback((
        fetched: boolean, // True if fetch attempt completed (success or fail)
        allFiles: FileNode[],
        primaryHighlight: string | null,
        secondaryHighlights: string[]
    ) => {
        logger.log("[Context] setFilesFetchedCombined called:", { fetched, primaryHighlight, secondaryCount: secondaryHighlights.length, allFilesCount: allFiles.length, taskActive: !!imageReplaceTaskState });
        setFilesFetchedState(fetched); // Mark fetch as completed
        setAllFetchedFilesState(allFiles); // <<< SET allFiles STATE HERE >>>
        setPrimaryHighlightPathState(primaryHighlight);
        setSecondaryHighlightPathsState(secondaryHighlights);

        // --- Image Task Trigger Logic ---
        // Trigger only if fetch completed (fetched=true), task exists, and ref is available
        if (fetched && imageReplaceTaskState) {
            const targetFileExists = allFiles.some(f => f.path === imageReplaceTaskState.targetPath);
            logger.log(`[Context] Image Task Check: Task Active, Fetched=${fetched}, Target Exists=${targetFileExists}, Ref Ready=${!!assistantRef.current}`);

            if (targetFileExists) {
                 // Check ref readiness *before* setTimeout
                 if (assistantRef.current) {
                     logger.log("[Context] Image Replace Task: Target file found, preparing to trigger direct replace via setTimeout.", imageReplaceTaskState);
                     // Use setTimeout to allow state updates to propagate before calling ref method
                     setTimeout(() => {
                         // Double-check ref inside timeout in case component unmounted quickly
                         if (assistantRef.current) {
                             logger.log("[Context] Calling assistantRef.current.handleDirectImageReplace now.");
                             assistantRef.current.handleDirectImageReplace(imageReplaceTaskState)
                                 .catch(err => logger.error("[Context] Error calling handleDirectImageReplace:", err));
                         } else {
                             logger.warn("[Context] Assistant ref became null before handleDirectImageReplace call inside setTimeout.");
                         }
                     }, 50); // Small delay (e.g., 50ms) might be safer than 0
                 } else {
                     logger.warn("[Context] Image Replace Task: Assistant ref not ready immediately after fetch completed. Task might not trigger.");
                     // Optionally, could set a flag here to retry later, but likely indicates a larger issue.
                 }
            } else {
                 // Target file NOT found, even though fetch completed
                 logger.error(`[Context] Image Replace Task Error: Target file ${imageReplaceTaskState.targetPath} not found in fetched files! Aborting task.`);
                 toast.error(`Ошибка: Файл ${imageReplaceTaskState.targetPath} для замены не найден в репозитории/ветке.`);
                 setImageReplaceTaskState(null); // Clear the invalid task
                 setFetchStatusState('error'); // Mark the fetch operation as failed due to missing target
            }
        }
        // --- End Image Task Trigger Logic ---

    }, [imageReplaceTaskState, assistantRef]); // Added assistantRef as dependency


    // === Calculate currentStep using useState and useEffect ===
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');

    useEffect(() => {
        if (!isMounted) {
            setCurrentStep('idle');
            return;
        }

        let calculatedStep: WorkflowStep = 'idle';

        // --- Prioritize Image Task State ---
        if (imageReplaceTaskState) {
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') {
                 calculatedStep = 'fetching'; // Still fetching for image task
            } else if (filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) {
                 // Files fetched AND target exists -> Ready for assistant to process
                 calculatedStep = 'files_fetched_image_replace';
            } else if (filesFetchedState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) {
                 // Files fetched but target missing (Error state handled by fetcher/setter)
                 calculatedStep = 'fetch_failed'; // Represent as failure if target missing
            } else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') {
                calculatedStep = 'fetch_failed'; // Fetch itself failed
            } else {
                // Default state if image task active but fetch not started/completed
                calculatedStep = 'ready_to_fetch';
            }
        }
        // --- Standard Workflow (Only if no image task) ---
        else {
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
            else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
            else if (isParsingState) calculatedStep = 'parsing_response';
            else if (aiActionLoadingState) calculatedStep = 'generating_ai_response';
            else if (!filesFetchedState) calculatedStep = 'ready_to_fetch'; // No fetch completed yet
            // --- States AFTER files are fetched ---
            else if (!kworkInputHasContentState) {
                // Files are fetched, no kwork input yet
                if (primaryHighlightPathState || secondaryHighlightPathsState.length > 0) calculatedStep = 'files_fetched_highlights';
                else if (selectedFetcherFilesState.size > 0) calculatedStep = 'files_selected';
                else calculatedStep = 'files_fetched'; // Just fetched, no selections/highlights
            }
            else if (kworkInputHasContentState && !aiResponseHasContentState && !requestCopiedState) calculatedStep = 'request_written';
            else if (requestCopiedState && !aiResponseHasContentState) calculatedStep = 'request_copied';
            else if (aiResponseHasContentState && !filesParsedState) calculatedStep = 'response_pasted';
            else if (filesParsedState) calculatedStep = 'pr_ready'; // Parsed, ready for PR/Update
            else calculatedStep = 'idle'; // Fallback if conditions missed
        }

        // Only update state if the step actually changed
        setCurrentStep(prevStep => {
            if (prevStep !== calculatedStep) {
                logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`);
                return calculatedStep;
            }
            return prevStep;
        });

    }, [
        isMounted, fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState,
        filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState,
        selectedFetcherFilesState, aiActionLoadingState, isParsingState, imageReplaceTaskState,
        allFetchedFilesState // Added dependency on allFetchedFilesState for image task step check
    ]);


    // === Action Triggers ===
    const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => {
        if (fetcherRef.current?.handleFetch) {
            await fetcherRef.current.handleFetch(isRetry, branch);
        } else {
            logger.error("triggerFetch: fetcherRef is not set.");
            toast.error("Ошибка: Не удалось запустить извлечение.");
        }
    }, [fetcherRef]);

    const triggerSelectHighlighted = useCallback(() => {
        if (fetcherRef.current?.selectHighlightedFiles) {
            fetcherRef.current.selectHighlightedFiles();
        } else {
            logger.error("triggerSelectHighlighted: fetcherRef is not set.");
        }
    }, [fetcherRef]);

    const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => {
        if (fetcherRef.current?.handleAddSelected) {
            await fetcherRef.current.handleAddSelected();
            if (clearSelection) {
                setSelectedFetcherFilesState(new Set()); // Manage selection state here
            }
        } else {
            logger.error("triggerAddSelectedToKwork: fetcherRef is not set.");
        }
    }, [fetcherRef]);

    const triggerCopyKwork = useCallback((): boolean => {
        if (fetcherRef.current?.handleCopyToClipboard) {
            return fetcherRef.current.handleCopyToClipboard();
        } else {
            logger.error("triggerCopyKwork: fetcherRef is not set.");
            return false;
        }
    }, [fetcherRef]);

    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => {
        logger.warn("AI Ask Triggered (Currently Disabled)");
        setAiActionLoadingState(false);
        setCurrentAiRequestIdState(null);
        // TODO: Re-enable AI Call Logic when ready
        return { success: false, error: "AI временно отключен" };
    }, []);


    const triggerParseResponse = useCallback(async () => {
        if (assistantRef.current?.handleParse) {
            await assistantRef.current.handleParse();
        } else {
            logger.error("triggerParseResponse: assistantRef is not set.");
        }
    }, [assistantRef]);

    const triggerSelectAllParsed = useCallback(() => {
        if (assistantRef.current?.selectAllParsedFiles) {
            assistantRef.current.selectAllParsedFiles();
        } else {
            logger.error("triggerSelectAllParsed: assistantRef is not set.");
        }
    }, [assistantRef]);

    const triggerCreateOrUpdatePR = useCallback(async () => {
        if (assistantRef.current?.handleCreatePR) {
            await assistantRef.current.handleCreatePR();
        } else {
            logger.error("triggerCreateOrUpdatePR: assistantRef is not set.");
        }
    }, [assistantRef]);

    // Updated triggerGetOpenPRs with better error reporting
    const triggerGetOpenPRs = useCallback(async (url: string) => {
        if (!url || !url.includes('github.com')) {
            logger.log("triggerGetOpenPRs: Invalid or empty GitHub URL, clearing PRs.");
            setOpenPrsState([]);
            return;
        }
        logger.log("triggerGetOpenPRs: Fetching for", url);
        setLoadingPrsState(true);
        let resultError = 'Неизвестная ошибка'; // Default error message
        try {
            const result = await getOpenPullRequests(url);
            if (result.success && result.pullRequests) {
                // Explicitly cast to SimplePullRequest[] to satisfy state type
                setOpenPrsState(result.pullRequests as SimplePullRequest[]);
                logger.log(`Fetched ${result.pullRequests.length} open PRs.`);
            } else {
                resultError = result.error || 'Не удалось загрузить PR'; // Use error from result
                // Use toast description for more details
                toast.error("Ошибка загрузки PR", {
                     description: resultError,
                     duration: 5000, // Show error longer
                     style: { background: "rgba(220,38,38,0.9)", color: "#fff", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(3px)"}
                });
                setOpenPrsState([]);
            }
        } catch (error: any) { // Catch errors during the action call itself
            logger.error("triggerGetOpenPRs Action Call Error:", error);
            resultError = error.message || 'Ошибка сети или сервера';
            toast.error("Крит. ошибка загрузки PR", {
                description: resultError,
                duration: 5000,
                style: { background: "rgba(220,38,38,0.9)", color: "#fff", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(3px)"}
            });
            setOpenPrsState([]);
        } finally {
            setLoadingPrsState(false);
        }
    }, []); // Dependencies checked, should be stable

    const triggerUpdateBranch = useCallback(async (
        repoUrl: string,
        filesToCommit: { path: string; content: string }[],
        commitMessage: string,
        branch: string,
        prNumber?: number | null,
        prDescription?: string
    ): Promise<{ success: boolean; error?: string }> => {
        logger.log(`[Context] triggerUpdateBranch called for branch: ${branch}, PR#: ${prNumber ?? 'N/A'}`);
        try {
            setAssistantLoadingState(true); // Use assistantLoading for this process
            const result = await updateBranch(repoUrl, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription);
            if (result.success) {
                toast.success(`Ветка ${branch} обновлена!`);
                logger.log(`[Context] Branch ${branch} updated successfully. Refreshing PRs.`);
                await triggerGetOpenPRs(repoUrl); // Refresh PR list
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
            setAssistantLoadingState(false);
            logger.log(`[Context] triggerUpdateBranch finished for branch: ${branch}`);
        }
    }, [triggerGetOpenPRs]); // Include triggerGetOpenPRs


    const updateRepoUrlInAssistant = useCallback((url: string) => {
        // Check if ref exists before calling
        if (assistantRef.current?.updateRepoUrl) {
            assistantRef.current.updateRepoUrl(url);
        } else {
             logger.warn("updateRepoUrlInAssistant: assistantRef not ready yet.");
        }
    }, [assistantRef]); // Added assistantRef

    const triggerToggleSettingsModal = useCallback(() => {
        setIsSettingsModalOpenState(prev => !prev);
    }, []);

    const scrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            // Try scrolling into view first
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            // Add highlight class with a delay to ensure it's visible after scroll
            setTimeout(() => {
                element.classList.add('highlight-scroll');
                // Remove highlight after duration
                setTimeout(() => element.classList.remove('highlight-scroll'), 1500);
            }, 300); // Adjust delay as needed (e.g., 300ms)
             logger.log(`Scrolled to section: ${sectionId}`);
        } else {
            logger.warn(`Scroll target not found: ${sectionId}`);
            // Fallback scroll attempts (might remove if causing issues)
            const parentExecutor = document.getElementById('executor');
            const parentExtractor = document.getElementById('extractor');
            if (sectionId.includes('kworkInput') || sectionId.includes('aiResponseInput') || sectionId.includes('prSection') || sectionId.includes('response-input') || sectionId.includes('pr-form-container')) {
                 parentExecutor?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            } else if (sectionId.includes('file-list-container') || sectionId.includes('extractor')) {
                 parentExtractor?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        }
    }, []);


    // === Buddy Message Logic ===
    const getXuinityMessage = useCallback((): string => {
        if (!isMounted) return "Инициализация..."; // Message before mount

        // --- Image Task Messages ---
        if (imageReplaceTaskState) {
            switch(currentStep) {
                case 'ready_to_fetch': return "Готовлюсь загрузить файл для замены картинки...";
                case 'fetching': return "Загружаю целевой файл для замены...";
                case 'fetch_failed': return "Ой! Не смог загрузить файл для замены. Проверь путь или попробуй снова.";
                case 'files_fetched_image_replace': return assistantLoadingState ? "Меняю картинку и готовлю PR..." : "Файл загружен! Передаю задачу Ассистенту для замены и PR.";
                default: return "Работаю над заменой картинки..."; // Fallback for image task
            }
        }

        // --- Standard Workflow Messages ---
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
            case 'generating_ai_response': return `Думаю... AI генерирует ответ (ID: ${currentAiRequestIdState?.substring(0, 6)}...).`;
            case 'response_pasted': return "Вижу ответ AI! Жми 'Разобрать Ответ' (➡️), чтобы я проверил код.";
            case 'parsing_response': return "Анализирую код из ответа AI...";
            case 'response_parsed': // Fallthrough intended
            case 'pr_ready':
                const actionText = targetBranchNameState ? 'Обновить Ветку' : 'Создать PR';
                const fileCountText = selectedAssistantFilesState.size > 0 ? `(${selectedAssistantFilesState.size} файлов)` : '(выбери файлы!)';
                return assistantLoadingState ? "Обработка PR/ветки..." : `Код готов! Жми '${actionText}' ${fileCountText}.`;
            default: return "Давай что-нибудь замутим!";
        }
    }, [
        isMounted, currentStep, // Depend on the calculated step state
        repoUrlEnteredState, manualBranchNameState, targetBranchNameState,
        primaryHighlightPathState, secondaryHighlightPathsState, selectedFetcherFilesState,
        selectedAssistantFilesState, // Added for PR ready message
        currentAiRequestIdState, imageReplaceTaskState, assistantLoadingState // Updated dependencies
    ]);


    // === Build Context Value ===
    const contextValue = useMemo(() => {
        if (!isMounted) {
             logger.log("RepoXmlPageContext: Providing MINIMAL context value (SSR/Build)");
             return initialMinimalContextValue;
        }

        logger.log("RepoXmlPageContext: Providing FULL context value (Client)");
        return {
            fetchStatus: fetchStatusState, repoUrlEntered: repoUrlEnteredState, filesFetched: filesFetchedState,
            selectedFetcherFiles: selectedFetcherFilesState, kworkInputHasContent: kworkInputHasContentState, requestCopied: requestCopiedState,
            aiResponseHasContent: aiResponseHasContentState, filesParsed: filesParsedState, selectedAssistantFiles: selectedAssistantFilesState,
            assistantLoading: assistantLoadingState, aiActionLoading: aiActionLoadingState, loadingPrs: loadingPrsState,
            targetBranchName: targetBranchNameState, manualBranchName: manualBranchNameState, openPrs: openPrsState,
            isSettingsModalOpen: isSettingsModalOpenState, isParsing: isParsingState, currentAiRequestId: currentAiRequestIdState,
            imageReplaceTask: imageReplaceTaskState,
            allFetchedFiles: allFetchedFilesState, // Pass down the fetched files
            currentStep,
            setFetchStatus: setFetchStatusState, setRepoUrlEntered: setRepoUrlEnteredState, setFilesFetched: setFilesFetchedCombined, // Use combined setter
            setSelectedFetcherFiles: setSelectedFetcherFilesState, setKworkInputHasContent: setKworkInputHasContentState, setRequestCopied: setRequestCopiedState,
            setAiResponseHasContent: setAiResponseHasContentState, setFilesParsed: setFilesParsedState, setSelectedAssistantFiles: setSelectedAssistantFilesState,
            setAssistantLoading: setAssistantLoadingState, setAiActionLoading: setAiActionLoadingState,
            setTargetBranchName: setTargetBranchNameState, setManualBranchName: setManualBranchNameState, setOpenPrs: setOpenPrsState,
            triggerToggleSettingsModal, setIsParsing: setIsParsingState, setCurrentAiRequestId: setCurrentAiRequestIdState,
            setImageReplaceTask: setImageReplaceTaskState,
            // setAllFetchedFiles: setAllFetchedFilesState, // Direct setter removed
            kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
            triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork,
            triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
            triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ // Dependencies updated
        isMounted,
        fetchStatusState, repoUrlEnteredState, filesFetchedState, selectedFetcherFilesState, kworkInputHasContentState, requestCopiedState,
        aiResponseHasContentState, filesParsedState, selectedAssistantFilesState, assistantLoadingState, aiActionLoadingState, loadingPrsState,
        targetBranchNameState, manualBranchNameState, openPrsState, isSettingsModalOpenState, isParsingState, currentAiRequestIdState,
        imageReplaceTaskState, allFetchedFilesState, // Added allFetchedFilesState
        currentStep, // Include currentStep state
        setFilesFetchedCombined, // Include the combined setter callback
        // Stable refs
        kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef,
        // Stable callbacks (ensure they are correctly memoized)
        triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork,
        triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR,
        triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection
    ]);


    return (
        <RepoXmlPageContext.Provider value={contextValue}>
            {children}
        </RepoXmlPageContext.Provider>
    );
};

// --- Custom Hook for Consuming Context ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    // No need to check for undefined here anymore if initial value is always provided
    // However, during development, a check might still be useful
    if (context === initialMinimalContextValue) {
        // This might happen briefly on initial client render before full context is ready
        // console.warn("useRepoXmlPageContext: Consuming initial minimal context value. Wait for mount?");
    }
    return context;
};