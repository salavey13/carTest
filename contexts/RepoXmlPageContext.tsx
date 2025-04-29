"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  useRef, MutableRefObject, ReactNode
} from 'react';
import { toast } from 'sonner';
import { FileNode } from '@/components/RepoTxtFetcher';
export interface SimplePullRequest { id: number; number: number; title: string; html_url: string; user: { login: string | null; avatar_url: string | null } | null; head: { ref: string }; base: { ref: string }; updated_at: string; }
import { debugLogger as logger } from '@/lib/debugLogger';
import { getGitHubUserProfile, createGitHubPullRequest, updateBranch, getOpenPullRequests } from '@/app/actions_github/actions';

// --- Types ---
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
export type WorkflowStep = | 'idle' | 'ready_to_fetch' | 'fetching' | 'fetch_failed' | 'files_fetched' | 'files_fetched_highlights' | 'files_fetched_image_replace' | 'files_selected' | 'request_written' | 'request_copied' | 'generating_ai_response' | 'response_pasted' | 'parsing_response' | 'response_parsed' | 'pr_ready';
export interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; }
export interface AICodeAssistantRef { handleParse: () => Promise<void>; selectAllParsedFiles: () => void; handleCreatePR: () => Promise<void>; setResponseValue: (value: string) => void; updateRepoUrl: (url: string) => void; handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => Promise<void>; }
// Updated RepoTxtFetcherRef type for handleFetch
export interface RepoTxtFetcherRef { handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => Promise<void>; selectHighlightedFiles: () => void; handleAddSelected: (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => Promise<void>; handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean; clearAll: () => void; getKworkInputValue: () => string; }
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
    setTargetBranchName: React.Dispatch<React.SetStateAction<string | null>>;
    setManualBranchName: React.Dispatch<React.SetStateAction<string>>;
    setOpenPrs: React.Dispatch<React.SetStateAction<SimplePullRequest[]>>;
    triggerToggleSettingsModal: () => void;
    setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentAiRequestId: React.Dispatch<React.SetStateAction<string | null>>;
    setImageReplaceTask: React.Dispatch<React.SetStateAction<ImageReplaceTask | null>>;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>; // Ref itself provided
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>; // Ref itself provided
    fetcherRef: MutableRefObject<RepoTxtFetcherRef | null>; // Ref itself provided
    assistantRef: MutableRefObject<AICodeAssistantRef | null>; // Ref itself provided
    // prSectionRef: MutableRefObject<HTMLElement | null>; // Keep or remove based on actual usage
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
    updateRepoUrlInAssistant: (url: string) => void; // This might become redundant if Assistant reads URL from context
    getXuinityMessage: () => string;
    scrollToSection: (sectionId: string) => void;
    // Add repoUrl state and setter to context
    repoUrl: string;
    setRepoUrl: React.Dispatch<React.SetStateAction<string>>;
}

// --- Minimal Initial Context Value ---
// Needs adjustment to include repoUrl and setRepoUrl
const initialMinimalContextValue: RepoXmlPageContextType = {
    fetchStatus: 'idle', repoUrlEntered: false, filesFetched: false, selectedFetcherFiles: new Set(), kworkInputHasContent: false, requestCopied: false, aiResponseHasContent: false, filesParsed: false, selectedAssistantFiles: new Set(), assistantLoading: false, aiActionLoading: false, loadingPrs: false, targetBranchName: null, manualBranchName: '', openPrs: [], isSettingsModalOpen: false, isParsing: false, currentAiRequestId: null, imageReplaceTask: null, allFetchedFiles: [], currentStep: 'idle',
    repoUrl: "https://github.com/salavey13/cartest", // Provide default URL here
    setRepoUrl: () => {}, // Placeholder setter
    setFetchStatus: () => {}, setRepoUrlEntered: () => {}, setFilesFetched: () => {}, setSelectedFetcherFiles: () => {}, setKworkInputHasContent: () => {}, setRequestCopied: () => {}, setAiResponseHasContent: () => {}, setFilesParsed: () => {}, setSelectedAssistantFiles: () => {}, setAssistantLoading: () => {}, setAiActionLoading: () => {}, setTargetBranchName: () => {}, setManualBranchName: () => {}, setOpenPrs: () => {}, triggerToggleSettingsModal: () => {}, setIsParsing: () => {}, setCurrentAiRequestId: () => {}, setImageReplaceTask: () => {},
    kworkInputRef: { current: null }, aiResponseInputRef: { current: null }, fetcherRef: { current: null }, assistantRef: { current: null },
    triggerFetch: async () => {}, triggerSelectHighlighted: () => {}, triggerAddSelectedToKwork: async () => {}, triggerCopyKwork: () => false, triggerAskAi: async () => ({ success: false, error: "Context not ready" }), triggerParseResponse: async () => {}, triggerSelectAllParsed: () => {}, triggerCreateOrUpdatePR: async () => {}, triggerUpdateBranch: async () => ({ success: false, error: "Context not ready" }), triggerGetOpenPRs: async () => {}, updateRepoUrlInAssistant: () => {}, getXuinityMessage: () => "Initializing...", scrollToSection: () => {},
};

// --- Context Creation ---
const RepoXmlPageContext = createContext<RepoXmlPageContextType>(initialMinimalContextValue);

// --- Context Provider Component (Ref handling changed) ---
export const RepoXmlPageProvider: React.FC<{ children: ReactNode; }> = ({ children }) => {
    // REMOVED: Props for refs

    const [isMounted, setIsMounted] = useState(false);
    // State remains mostly the same
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
    // NEW: Add repoUrl state to context
    const [repoUrlState, setRepoUrlState] = useState<string>(initialMinimalContextValue.repoUrl); // Use default

    // CREATE refs INSIDE the provider
    const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
    const assistantRef = useRef<AICodeAssistantRef | null>(null);
    const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
    const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
    // const prSectionRef = useRef<HTMLElement | null>(null); // Keep if needed

    useEffect(() => { setIsMounted(true); logger.log("RepoXmlPageContext Mounted"); }, []);

    // Sync repoUrlEnteredState with repoUrlState
     useEffect(() => {
         setRepoUrlEnteredState(repoUrlState.trim().length > 0);
         // Optionally reset PRs/branch if URL changes? (Can be debated)
         // setOpenPrsState([]);
         // setTargetBranchNameState(null);
         // setManualBranchNameState('');
     }, [repoUrlState]);


    // === Combined State Setter (no change needed here) ===
    const setFilesFetchedCombined = useCallback(( fetchAttemptSucceeded: boolean, allFiles: FileNode[], primaryHighlight: string | null, secondaryHighlights: string[] ) => {
       // ... logic remains the same, uses imageReplaceTaskState ...
       logger.log("[Context] setFilesFetchedCombined called:", { fetchAttemptSucceeded, primaryHighlight, secondaryCount: secondaryHighlights.length, allFilesCount: allFiles.length, taskActive: !!imageReplaceTaskState });
       setFilesFetchedState(true); // Mark files as fetched (or attempted)
       setAllFetchedFilesState(allFiles); // Store the files
       setPrimaryHighlightPathState(primaryHighlight);
       setSecondaryHighlightPathsState(secondaryHighlights);

       let finalFetchStatus: FetchStatus = 'idle'; // Determine final status based on success and task

       if (imageReplaceTaskState) {
           if (fetchAttemptSucceeded) {
               const targetFileExists = allFiles.some(f => f.path === imageReplaceTaskState.targetPath);
               if (targetFileExists) {
                   logger.log(`[Context] Image Task: Target file ${imageReplaceTaskState.targetPath} found. Fetch status set to success. Assistant will handle replacement.`);
                   finalFetchStatus = 'success';
               } else {
                   logger.error(`[Context] Image Task Error: Target file ${imageReplaceTaskState.targetPath} not found!`);
                   toast.error(`Ошибка: Файл ${imageReplaceTaskState.targetPath} для замены не найден.`);
                   setImageReplaceTaskState(null); // Clear the task if target is missing
                   finalFetchStatus = 'error';
               }
           } else {
               logger.error("[Context] Image Task Error: Fetch attempt failed.");
               finalFetchStatus = 'error';
           }
       } else {
           finalFetchStatus = fetchAttemptSucceeded ? 'success' : 'error';
       }
       setFetchStatusState(finalFetchStatus);
       logger.log(`[Context] setFilesFetchedCombined finished. Final Status: ${finalFetchStatus}`);
    }, [imageReplaceTaskState]);

    // --- Workflow Step Calculation (depends on repoUrlEnteredState now) ---
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
    useEffect(() => {
        if (!isMounted) { setCurrentStep('idle'); return; }
        let calculatedStep: WorkflowStep = 'idle';
        if (imageReplaceTaskState) {
            // ... (image task logic remains the same)
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') { calculatedStep = 'fetching'; }
            else if (fetchStatusState === 'success' && filesFetchedState && allFetchedFilesState.some(f => f.path === imageReplaceTaskState.targetPath)) {
                 calculatedStep = assistantLoadingState ? 'generating_ai_response' : 'files_fetched_image_replace';
            }
            else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries' || (filesFetchedState && !allFetchedFilesState.some(f => f.path === imageReplaceTaskState?.targetPath))) {
                calculatedStep = 'fetch_failed';
            }
            else { calculatedStep = 'ready_to_fetch'; }
        } else {
            // Standard workflow logic
            if (fetchStatusState === 'loading' || fetchStatusState === 'retrying') calculatedStep = 'fetching';
            else if (fetchStatusState === 'error' || fetchStatusState === 'failed_retries') calculatedStep = 'fetch_failed';
            else if (isParsingState) calculatedStep = 'parsing_response';
            else if (aiActionLoadingState) calculatedStep = 'generating_ai_response';
            else if (assistantLoadingState) calculatedStep = 'generating_ai_response';
            else if (!filesFetchedState) {
                 // Use repoUrlEnteredState derived from context's repoUrlState
                 calculatedStep = repoUrlEnteredState ? 'ready_to_fetch' : 'idle';
             }
            else if (!kworkInputHasContentState) {
                 if (primaryHighlightPathState || secondaryHighlightPathsState.length > 0) calculatedStep = 'files_fetched_highlights';
                 else if (selectedFetcherFilesState.size > 0) calculatedStep = 'files_selected';
                 else calculatedStep = 'files_fetched';
            }
            else if (kworkInputHasContentState && !aiResponseHasContentState && !requestCopiedState) calculatedStep = 'request_written';
            else if (requestCopiedState && !aiResponseHasContentState) calculatedStep = 'request_copied';
            else if (aiResponseHasContentState && !filesParsedState) calculatedStep = 'response_pasted';
            else if (filesParsedState) { calculatedStep = 'pr_ready'; }
            else calculatedStep = 'idle';
        }
        setCurrentStep(prevStep => { if (prevStep !== calculatedStep) { logger.log(`Context Step Updated: ${prevStep} -> ${calculatedStep}`); return calculatedStep; } return prevStep; });
    }, [ isMounted, fetchStatusState, filesFetchedState, kworkInputHasContentState, aiResponseHasContentState, filesParsedState, requestCopiedState, primaryHighlightPathState, secondaryHighlightPathsState, selectedFetcherFilesState, aiActionLoadingState, isParsingState, imageReplaceTaskState, allFetchedFilesState, assistantLoadingState, repoUrlEnteredState /* Use derived state */ ]);


    // --- Triggers (mostly unchanged, but use context repoUrlState) ---
    const triggerFetch = useCallback(async (isRetry = false, branch?: string | null) => { if (fetcherRef.current?.handleFetch) { await fetcherRef.current.handleFetch(isRetry, branch); } else { logger.error("triggerFetch: fetcherRef is not set."); toast.error("Ошибка: Не удалось запустить извлечение."); } }, [fetcherRef]); // Depends on fetcherRef
    const triggerSelectHighlighted = useCallback(() => { if (fetcherRef.current?.selectHighlightedFiles) { fetcherRef.current.selectHighlightedFiles(); } else { logger.error("triggerSelectHighlighted: fetcherRef is not set."); } }, [fetcherRef]); // Depends on fetcherRef
    const triggerAddSelectedToKwork = useCallback(async (clearSelection = false) => {
        if (fetcherRef.current?.handleAddSelected) {
            // ... (logic remains same, using selectedFetcherFilesState and allFetchedFilesState)
             logger.log("[Context] triggerAddSelectedToKwork called. Passing current context selection and files:", { selectionSize: selectedFetcherFilesState.size, filesCount: allFetchedFilesState.length });
             if (selectedFetcherFilesState.size === 0) {
                  logger.error("[Context] triggerAddSelectedToKwork: Context selection is empty. Aborting.");
                  toast.error("Сначала выберите файлы в Экстракторе!", { description: "Бадди не видит выбранных файлов."});
                  return; // Abort if no files selected in context
             }
             try {
                  // Pass the current context state values to the ref function
                  await fetcherRef.current.handleAddSelected(selectedFetcherFilesState, allFetchedFilesState);
                  if (clearSelection) { logger.log("[Context] Clearing fetcher selection after add."); setSelectedFetcherFilesState(new Set()); }
             } catch (error) { logger.error("[Context] Error during fetcherRef.current.handleAddSelected:", error); toast.error("Ошибка добавления файлов в запрос."); }
        } else { logger.error("triggerAddSelectedToKwork: fetcherRef is not set."); toast.error("Ошибка: Компонент Экстрактора недоступен."); }
    }, [fetcherRef, selectedFetcherFilesState, allFetchedFilesState]); // Updated dependencies
    const triggerCopyKwork = useCallback((): boolean => { if (fetcherRef.current?.handleCopyToClipboard) { return fetcherRef.current.handleCopyToClipboard(); } else { logger.error("triggerCopyKwork: fetcherRef is not set."); return false; } }, [fetcherRef]); // Depends on fetcherRef
    const triggerAskAi = useCallback(async (): Promise<{ success: boolean; requestId?: string; error?: string }> => { logger.warn("AI Ask Triggered (No Longer Active)"); toast.info("Кнопка 'Спросить AI' временно отключена."); return { success: false, error: "Ask AI button disabled" }; }, []);
    const triggerParseResponse = useCallback(async () => { if (assistantRef.current?.handleParse) { await assistantRef.current.handleParse(); } else { logger.error("triggerParseResponse: assistantRef is not set."); } }, [assistantRef]); // Depends on assistantRef
    const triggerSelectAllParsed = useCallback(() => { if (assistantRef.current?.selectAllParsedFiles) { assistantRef.current.selectAllParsedFiles(); } else { logger.error("triggerSelectAllParsed: assistantRef is not set."); } }, [assistantRef]); // Depends on assistantRef
    const triggerCreateOrUpdatePR = useCallback(async () => { if (assistantRef.current?.handleCreatePR) { await assistantRef.current.handleCreatePR(); } else { logger.error("triggerCreateOrUpdatePR: assistantRef is not set."); } }, [assistantRef]); // Depends on assistantRef
    const triggerGetOpenPRs = useCallback(async (url: string) => {
         // Use url parameter, but maybe default to context repoUrlState if url is falsy?
         const effectiveUrl = url || repoUrlState;
         if (!effectiveUrl || !effectiveUrl.includes('github.com')) { logger.log("triggerGetOpenPRs: Invalid URL."); setOpenPrsState([]); return; }
         logger.log("triggerGetOpenPRs: Fetching for", effectiveUrl);
         setLoadingPrsState(true); setOpenPrsState([]);
         try { const result = await getOpenPullRequests(effectiveUrl); if (result.success && result.pullRequests) { setOpenPrsState(result.pullRequests as SimplePullRequest[]); logger.log(`Fetched ${result.pullRequests.length} PRs.`); } else { toast.error("Ошибка загрузки PR", { description: result.error || 'Не удалось загрузить PR', duration: 5000, style: { background: "rgba(220,38,38,0.9)", color: "#fff", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(3px)"} }); } } catch (error: any) { logger.error("triggerGetOpenPRs Action Error:", error); toast.error("Крит. ошибка загрузки PR", { description: error.message || 'Ошибка сети', duration: 5000, style: { background: "rgba(220,38,38,0.9)", color: "#fff", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(3px)"} }); } finally { setLoadingPrsState(false); }
     }, [repoUrlState]); // Depend on context repoUrlState
    const triggerUpdateBranch = useCallback(async ( repoUrlParam: string, filesToCommit: { path: string; content: string }[], commitMessage: string, branch: string, prNumber?: number | null, prDescription?: string ): Promise<{ success: boolean; error?: string }> => {
        // Use repoUrlParam directly as it's passed specifically for the action
        logger.log(`[Context] triggerUpdateBranch: ${branch}, PR#: ${prNumber ?? 'N/A'}`);
        try { setAssistantLoadingState(true); const result = await updateBranch(repoUrlParam, filesToCommit, commitMessage, branch, prNumber ?? undefined, prDescription); if (result.success) { toast.success(`Ветка ${branch} обновлена!`); logger.log(`[Context] Branch ${branch} updated.`); await triggerGetOpenPRs(repoUrlParam); return { success: true }; } else { toast.error(`Ошибка обновления ветки: ${result.error}`); logger.error(`[Context] Failed update ${branch}: ${result.error}`); return { success: false, error: result.error }; } } catch (error: any) { logger.error("[Context] triggerUpdateBranch critical Error:", error); toast.error(`Крит. ошибка обновления: ${error.message}`); return { success: false, error: error.message }; } finally { setAssistantLoadingState(false); logger.log(`[Context] triggerUpdateBranch finished: ${branch}`); }
    }, [triggerGetOpenPRs]); // Dependency on triggerGetOpenPRs is correct
    const updateRepoUrlInAssistant = useCallback((url: string) => { if (assistantRef.current?.updateRepoUrl) { assistantRef.current.updateRepoUrl(url); } else { logger.warn("updateRepoUrlInAssistant: assistantRef not ready."); } }, [assistantRef]); // Depends on assistantRef
    const triggerToggleSettingsModal = useCallback(() => { setIsSettingsModalOpenState(prev => !prev); }, []);
    const scrollToSection = useCallback((sectionId: string) => { /* ... (no changes needed) ... */ }, []);

    // --- getXuinityMessage (depends on repoUrlEnteredState now) ---
    const getXuinityMessage = useCallback((): string => {
         // ... (logic remains the same, uses repoUrlEnteredState)
          if (!isMounted) return "Инициализация..."; if (imageReplaceTaskState) { switch(currentStep) { case 'ready_to_fetch': return "Готовлюсь загрузить файл для замены картинки..."; case 'fetching': return "Загружаю целевой файл для замены..."; case 'fetch_failed': return "Ой! Не смог загрузить файл для замены. Проверь путь или попробуй снова."; case 'files_fetched_image_replace': return assistantLoadingState ? "Меняю картинку и готовлю PR/обновление..." : "Файл загружен! Передаю задачу Ассистенту."; case 'generating_ai_response': return assistantLoadingState ? "Меняю картинку и готовлю PR/обновление..." : "Обработка..."; default: return "Работаю над заменой картинки..."; } }
         switch (currentStep) { case 'idle': return "Готов к работе! Введи URL репо."; case 'ready_to_fetch': return repoUrlEnteredState ? `URL вижу! Жми "Извлечь файлы" для ветки '${manualBranchNameState || targetBranchNameState || 'default'}'.` : "Жду URL репозитория..."; case 'fetching': return `Тяну файлы из '${manualBranchNameState || targetBranchNameState || 'default'}'. Минутку...`; case 'fetch_failed': return "Упс! Не смог загрузить файлы. Попробуй еще раз."; case 'files_fetched': return "Файлы загружены! Выбери нужные или опиши задачу."; case 'files_fetched_highlights': return `Файлы есть! Вижу связи (${primaryHighlightPathState ? 'основной' : ''}${primaryHighlightPathState && secondaryHighlightPathsState.length > 0 ? ' + ' : ''}${secondaryHighlightPathsState.length > 0 ? secondaryHighlightPathsState.length + ' втор.' : ''}). Выбирай или добавляй (+) в запрос.`; case 'files_selected': return `${selectedFetcherFilesState.size} файлов выбрано. Добавляй (+) в запрос или описывай задачу.`; case 'request_written': return "Отличный запрос! Скопируй текст или передай дальше."; case 'request_copied': return "Запрос скопирован! Жду ответ AI в поле ниже."; case 'generating_ai_response': return aiActionLoadingState ? `Думаю... AI генерирует ответ (ID: ${currentAiRequestIdState?.substring(0, 6)}...).` : assistantLoadingState ? "⚙️ Обработка PR/Ветки..." : "⏳ Обработка..."; case 'response_pasted': return "Вижу ответ AI! Жми 'Разобрать Ответ' (➡️)."; case 'parsing_response': return "Анализирую код из ответа AI..."; case 'response_parsed': case 'pr_ready': const actionText = targetBranchNameState ? 'Обновить Ветку' : 'Создать PR'; const fileCountText = selectedAssistantFilesState.size > 0 ? `(${selectedAssistantFilesState.size} файлов)` : '(выбери файлы!)'; return assistantLoadingState ? "⚙️ Обработка PR/Ветки..." : `Код готов! Жми '${actionText}' ${fileCountText}.`; default: return "Давай что-нибудь замутим!"; }
     }, [ isMounted, currentStep, repoUrlEnteredState, manualBranchNameState, targetBranchNameState, primaryHighlightPathState, secondaryHighlightPathsState.length, selectedFetcherFilesState.size, selectedAssistantFilesState.size, currentAiRequestIdState, imageReplaceTaskState, assistantLoadingState, aiActionLoadingState ]);

    // --- Memoized Context Value ---
    const contextValue = useMemo(() => {
        if (!isMounted) { return initialMinimalContextValue; }
        return {
            // State values
            fetchStatus: fetchStatusState,
            repoUrlEntered: repoUrlEnteredState, // Derived state
            filesFetched: filesFetchedState,
            selectedFetcherFiles: selectedFetcherFilesState,
            kworkInputHasContent: kworkInputHasContentState,
            requestCopied: requestCopiedState,
            aiResponseHasContent: aiResponseHasContentState,
            filesParsed: filesParsedState,
            selectedAssistantFiles: selectedAssistantFilesState,
            assistantLoading: assistantLoadingState,
            aiActionLoading: aiActionLoadingState,
            loadingPrs: loadingPrsState,
            targetBranchName: targetBranchNameState,
            manualBranchName: manualBranchNameState,
            openPrs: openPrsState,
            isSettingsModalOpen: isSettingsModalOpenState,
            isParsing: isParsingState,
            currentAiRequestId: currentAiRequestIdState,
            imageReplaceTask: imageReplaceTaskState,
            allFetchedFiles: allFetchedFilesState,
            currentStep,
            repoUrl: repoUrlState, // Provide URL state
            // State setters
            setFetchStatus: setFetchStatusState,
            setRepoUrlEntered: setRepoUrlEnteredState, // Keep setter if needed elsewhere, though derived now
            setFilesFetched: setFilesFetchedCombined,
            setSelectedFetcherFiles: setSelectedFetcherFilesState,
            setKworkInputHasContent: setKworkInputHasContentState,
            setRequestCopied: setRequestCopiedState,
            setAiResponseHasContent: setAiResponseHasContentState,
            setFilesParsed: setFilesParsedState,
            setSelectedAssistantFiles: setSelectedAssistantFilesState,
            setAssistantLoading: setAssistantLoadingState,
            setAiActionLoading: setAiActionLoadingState,
            setTargetBranchName: setTargetBranchNameState,
            setManualBranchName: setManualBranchNameState,
            setOpenPrs: setOpenPrsState,
            setIsParsing: setIsParsingState,
            setCurrentAiRequestId: setCurrentAiRequestIdState,
            setImageReplaceTask: setImageReplaceTaskState,
            setRepoUrl: setRepoUrlState, // Provide URL setter
            // Refs (pass the refs created in the provider)
            kworkInputRef,
            aiResponseInputRef,
            fetcherRef,
            assistantRef,
            // Triggers
            triggerToggleSettingsModal,
            triggerFetch,
            triggerSelectHighlighted,
            triggerAddSelectedToKwork,
            triggerCopyKwork,
            triggerAskAi,
            triggerParseResponse,
            triggerSelectAllParsed,
            triggerCreateOrUpdatePR,
            triggerUpdateBranch,
            triggerGetOpenPRs,
            updateRepoUrlInAssistant, // Keep for now, might remove later
            getXuinityMessage,
            scrollToSection,
        };
    }, [ // Add ALL state values and stable functions/refs
        isMounted, fetchStatusState, repoUrlEnteredState, filesFetchedState, selectedFetcherFilesState, kworkInputHasContentState, requestCopiedState, aiResponseHasContentState, filesParsedState, selectedAssistantFilesState, assistantLoadingState, aiActionLoadingState, loadingPrsState, targetBranchNameState, manualBranchNameState, openPrsState, isSettingsModalOpenState, isParsingState, currentAiRequestIdState, imageReplaceTaskState, allFetchedFilesState, currentStep, repoUrlState, setFilesFetchedCombined, kworkInputRef, aiResponseInputRef, fetcherRef, assistantRef, triggerToggleSettingsModal, triggerFetch, triggerSelectHighlighted, triggerAddSelectedToKwork, triggerCopyKwork, triggerAskAi, triggerParseResponse, triggerSelectAllParsed, triggerCreateOrUpdatePR, triggerUpdateBranch, triggerGetOpenPRs, updateRepoUrlInAssistant, getXuinityMessage, scrollToSection
    ]);

    return ( <RepoXmlPageContext.Provider value={contextValue}> {children} </RepoXmlPageContext.Provider> );
};

// --- Consumer Hook ---
export const useRepoXmlPageContext = (): RepoXmlPageContextType => {
    const context = useContext(RepoXmlPageContext);
    if (context === initialMinimalContextValue && typeof window !== 'undefined') { /* console.warn("Using initial context."); */ }
    return context;
};