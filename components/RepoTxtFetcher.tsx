"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback, useRef } from "react"; 
import { motion } from "framer-motion";

// --- Core & Context ---
import {
    useRepoXmlPageContext,
    RepoTxtFetcherRef,
    FileNode,
    ImportCategory, 
    ImageReplaceTask,
    IconReplaceTask, 
    SimplePullRequest, 
    FetchStatus,
    PendingFlowDetails 
} from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger";

// --- Hooks & Utils ---
import * as repoUtils from "@/lib/repoUtils";
import { useRepoFetcher } from "@/hooks/useRepoFetcher";
import { useFileSelection } from "@/hooks/useFileSelection";
import { useKworkInput } from "@/hooks/useKworkInput";
import { useAppToast } from "@/hooks/useAppToast";

// --- Sub-components ---
import SettingsModal from "./repo/SettingsModal"; 
import FileList from "./repo/FileList"; 
import SelectedFilesPreview from "./repo/SelectedFilesPreview"; 
import RequestInput from "./repo/RequestInput"; 
import ProgressBar from "./repo/ProgressBar"; 
import VibeContentRenderer from '@/components/VibeContentRenderer';

// --- Component Props ---
interface RepoTxtFetcherProps {
    highlightedPathProp: string | null;
    ideaProp: string | null;
}

// --- Component Definition ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, RepoTxtFetcherProps>(({
    highlightedPathProp,
    ideaProp
}, ref) => {
    logger.log("[RepoTxtFetcher] START Render");

    const context = useRepoXmlPageContext();
    const { 
        addToast: addToastContext, 
        fetchStatus, setFetchStatus,
        filesFetched,
        repoUrl: repoUrlFromContext, setRepoUrl: setRepoUrlInContext, repoUrlEntered,
        selectedFetcherFiles,
        kworkInputHasContent, 
        kworkInputValue,
        setKworkInputValue,
        kworkInputRef,
        loadingPrs,
        assistantLoading, isParsing, aiActionLoading,
        targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs,
        triggerGetOpenPRs,
        isSettingsModalOpen, triggerToggleSettingsModal, scrollToSection,
        currentAiRequestId,
        imageReplaceTask, 
        iconReplaceTask,
        allFetchedFiles, 
        assistantRef, updateRepoUrlInAssistant,
        triggerPreCheckAndFetch, 
        setImageReplaceTask, 
        setIconReplaceTask,
        isPreChecking, 
        pendingFlowDetails, 
    } = context;
    const { error: toastError, info: toastInfo } = useAppToast();
    logger.debug("[RepoTxtFetcher] After Context Destructuring");

    const [token, setToken] = useState<string>("");
    const [prevEffectiveBranch, setPrevEffectiveBranch] = useState<string | null>(null);
    const initialIdeaProcessedRef = useRef(false);
    const lastProcessedIdeaSignatureRef = useRef<string | null>(null);

    logger.debug("[RepoTxtFetcher] After useState");

    const repoUrl = repoUrlFromContext; 
    const handleRepoUrlChange = setRepoUrlInContext;

    const highlightedPathFromUrl = highlightedPathProp ?? ""; 
    const ideaFromUrl = ideaProp ?? ""; 
    logger.debug(`[RepoTxtFetcher] Props: highlightedPath='${highlightedPathFromUrl}', idea='${ideaFromUrl ? ideaFromUrl.substring(0,30)+'...' : 'null'}'`);

    const importantFiles = useMemo(() => [
        "package.json", "app/layout.tsx",
        "tailwind.config.ts",
        "app/globals.css",
        "/app/repo-xml/page.tsx", 
        "/components/RepoTxtFetcher.tsx", 
        "/components/AICodeAssistant.tsx", 
        "/contexts/RepoXmlPageContext.tsx", 
        "app/style-guide/page.tsx",       
        "contexts/AppContext.tsx",
        "hooks/useAppToast.ts",
        "hooks/useRepoFetcher.ts",
        "hooks/useFileSelection.ts",
        "hooks/useKworkInput.ts",
        "hooks/supabase.ts", 
        "app/actions.ts",
        "lib/debugLogger.ts",
        "components/VibeContentRenderer.tsx",
        "components/Header.tsx",
        "types/database.types.ts", 
        "components/repo/prompt.ts",
    ].filter(Boolean), []);

    const effectiveBranchDisplay = useMemo(() => targetBranchName || manualBranchName || "default", [targetBranchName, manualBranchName]);

    const {
        files: fetchedFiles,
        progress,
        error: fetchError,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        handleFetchManual,
        isLoading: isFetchLoading,
        isFetchDisabled
    } = useRepoFetcher({
        repoUrl, token, targetBranchName, manualBranchName, 
        imageReplaceTask: imageReplaceTask || (iconReplaceTask as unknown as ImageReplaceTask | null),
        highlightedPathFromUrl,
        importantFiles, 
        ideaFromUrl, 
        isSettingsModalOpen,
        repoUrlEntered, assistantLoading, isParsing, aiActionLoading,
        loadingPrs,
    });

    const {
        toggleFileSelection,
        selectHighlightedFiles,
        handleAddImportantFiles,
        handleSelectAll,
        handleDeselectAll,
    } = useFileSelection({
        files: fetchedFiles,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        importantFiles, 
        imageReplaceTaskActive: !!imageReplaceTask || !!iconReplaceTask,
    });

    const {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
    } = useKworkInput({
        selectedFetcherFiles,
        allFetchedFiles,
        imageReplaceTaskActive: !!imageReplaceTask || !!iconReplaceTask,
        files: fetchedFiles, 
    });

    useEffect(() => {
        const logPrefix = "[RepoTxtFetcher Effect ideaProp]";
        const currentIdeaSignature = `${ideaFromUrl}|${highlightedPathFromUrl}`;

        logger.debug(`${logPrefix} Evaluating. ideaSignature: '${currentIdeaSignature}', lastProcessed: '${lastProcessedIdeaSignatureRef.current}', initialIdeaProcessed: ${initialIdeaProcessedRef.current}, isPreChecking: ${isPreChecking}, repoUrlValid: ${!!repoUrl && repoUrl.includes("github.com")}`);
        
        if (!ideaFromUrl && !highlightedPathFromUrl) { // No idea AND no path
            if (initialIdeaProcessedRef.current) {
                logger.debug(`${logPrefix} No idea/path from props, resetting initialIdeaProcessedRef & lastProcessedIdeaSignatureRef.`);
                initialIdeaProcessedRef.current = false;
                lastProcessedIdeaSignatureRef.current = null;
            }
            logger.debug(`${logPrefix} Skipping: No ideaFromUrl or highlightedPathFromUrl.`);
            return;
        }
        
        // If only idea is present, but no path, we might want to just set the kwork input if repo is already loaded.
        // However, the current flow relies on path for context fetching. For now, require path.
        if (!highlightedPathFromUrl && ideaFromUrl) {
            logger.debug(`${logPrefix} Skipping: ideaFromUrl present, but no highlightedPathFromUrl. Path is required for context fetching.`);
            // If we want to support idea-only to populate kwork on an already loaded repo, add logic here.
            // For now, if an idea comes through URL, it's assumed to be for a specific context (path).
            return;
        }
        
        // If no idea, but path is present (e.g., from error overlay click), skip idea processing.
        if (!ideaFromUrl && highlightedPathFromUrl) {
             logger.debug(`${logPrefix} Skipping idea processing: No ideaFromUrl, but highlightedPathFromUrl is present. Fetch will proceed based on path if repo URL is set.`);
             // The useRepoFetcher's own logic will handle fetching based on highlightedPathFromUrl if repoUrl is valid and no tasks active.
             return;
        }


        if (initialIdeaProcessedRef.current && lastProcessedIdeaSignatureRef.current === currentIdeaSignature) {
            logger.info(`${logPrefix} Skipping: Idea signature '${currentIdeaSignature}' has already been processed by this component instance.`);
            return;
        }
        
        if (!repoUrl || !repoUrl.includes("github.com")) {
            logger.debug(`${logPrefix} Skipping: Repo URL not valid or not GitHub. Will wait for settings modal / manual input.`);
            return;
        }
        
        if (isPreChecking) {
            logger.info(`${logPrefix} Skipping: isPreChecking is true. Waiting for pre-check to complete.`);
            return;
        }

        let flowTypeToAction: PendingFlowDetails['type'] | null = null;
        let detailsToProcess: any = null;
        let taskMatchesActiveContext = false;

        if (ideaFromUrl.startsWith("ImageReplace|")) {
            const parts = ideaFromUrl.split("|");
            const oldUrl = decodeURIComponent(parts.find(p => p.startsWith("OldURL="))?.substring("OldURL=".length) || "");
            const newUrl = decodeURIComponent(parts.find(p => p.startsWith("NewURL="))?.substring("NewURL=".length) || "");
            if (oldUrl && newUrl) {
                if ((imageReplaceTask && imageReplaceTask.targetPath === highlightedPathFromUrl && imageReplaceTask.oldUrl === oldUrl && imageReplaceTask.newUrl === newUrl) ||
                    (pendingFlowDetails?.type === 'ImageSwap' && pendingFlowDetails.targetPath === highlightedPathFromUrl && pendingFlowDetails.details?.oldUrl === oldUrl && pendingFlowDetails.details?.newUrl === newUrl)) {
                    taskMatchesActiveContext = true;
                } else {
                    flowTypeToAction = 'ImageSwap';
                    detailsToProcess = { oldUrl, newUrl };
                }
            } else { logger.warn(`${logPrefix} Could not parse OldURL/NewUrl from ImageReplace ideaProp.`); }
        } else if (ideaFromUrl.startsWith("IconSwap|")) {
            const parts = ideaFromUrl.split("|");
            const oldIconName = decodeURIComponent(parts.find(p => p.startsWith("OldIconName="))?.substring("OldIconName=".length) || "");
            const newIconName = decodeURIComponent(parts.find(p => p.startsWith("NewIconName="))?.substring("NewIconName=".length) || "");
            const componentProps = decodeURIComponent(parts.find(p => p.startsWith("ComponentProps="))?.substring("ComponentProps=".length) || "");
            if (oldIconName && newIconName) {
                 if ((iconReplaceTask && iconReplaceTask.targetPath === highlightedPathFromUrl && iconReplaceTask.oldIconName === oldIconName && iconReplaceTask.newIconName === newIconName) ||
                    (pendingFlowDetails?.type === 'IconSwap' && pendingFlowDetails.targetPath === highlightedPathFromUrl && pendingFlowDetails.details?.oldIconName === oldIconName && pendingFlowDetails.details?.newIconName === newIconName)) {
                    taskMatchesActiveContext = true;
                } else {
                    flowTypeToAction = 'IconSwap';
                    detailsToProcess = { oldIconName, newIconName, componentProps: componentProps || undefined };
                }
            } else { logger.warn(`${logPrefix} Could not parse OldIconName/NewIconName from IconSwap ideaProp.`); }
        } else if (ideaFromUrl.startsWith("ErrorFix|")) {
            try {
                const detailsString = ideaFromUrl.substring("ErrorFix|".length);
                const parsedDetailsFromUrl = JSON.parse(decodeURIComponent(detailsString));
                if (pendingFlowDetails?.type === 'ErrorFix' && pendingFlowDetails.targetPath === highlightedPathFromUrl && JSON.stringify(pendingFlowDetails.details) === JSON.stringify(parsedDetailsFromUrl)) {
                    taskMatchesActiveContext = true;
                } else {
                    flowTypeToAction = 'ErrorFix';
                    detailsToProcess = parsedDetailsFromUrl;
                }
            } catch (e) { logger.error(`${logPrefix} Failed to parse ErrorFix details from ideaProp:`, e); }
        } else if (ideaFromUrl && highlightedPathFromUrl) { // Generic Idea condition
            if (pendingFlowDetails?.type === 'GenericIdea' && 
                pendingFlowDetails.targetPath === highlightedPathFromUrl && 
                pendingFlowDetails.details?.idea === ideaFromUrl) {
                taskMatchesActiveContext = true;
            } else {
                flowTypeToAction = 'GenericIdea';
                detailsToProcess = { idea: ideaFromUrl }; 
            }
        }


        if (taskMatchesActiveContext) {
            logger.info(`${logPrefix} Task from ideaProp signature '${currentIdeaSignature}' matches an active context task/flow. Skipping re-trigger and marking as processed.`);
            initialIdeaProcessedRef.current = true; 
            lastProcessedIdeaSignatureRef.current = currentIdeaSignature;
            return;
        }

        if (flowTypeToAction && detailsToProcess && highlightedPathFromUrl) { // Ensure targetPath is available
            logger.info(`${logPrefix} Triggering PreCheckAndFetch for ${flowTypeToAction} with signature '${currentIdeaSignature}'.`);
            initialIdeaProcessedRef.current = true; 
            lastProcessedIdeaSignatureRef.current = currentIdeaSignature;
            const branchNameToUse = manualBranchName || targetBranchName || '';
            
            triggerPreCheckAndFetch(
                repoUrl,
                branchNameToUse,
                flowTypeToAction,
                detailsToProcess,
                highlightedPathFromUrl // This is the targetPath for the flow
            ).then(() => {
                logger.log(`${logPrefix} triggerPreCheckAndFetch for ${flowTypeToAction} completed successfully via ideaProp.`);
            }).catch(err => {
                logger.error(`${logPrefix} Error during triggerPreCheckAndFetch for ${flowTypeToAction} via ideaProp:`, err);
                initialIdeaProcessedRef.current = false; 
                lastProcessedIdeaSignatureRef.current = null;
            });
        } else if (ideaFromUrl) { 
             logger.warn(`${logPrefix} ideaProp ("${ideaFromUrl.substring(0,30)}...") provided, but conditions for a known flow (ImageSwap, IconSwap, ErrorFix, GenericIdea with path) were not met. Or targetPath (highlightedPathFromUrl) was missing. No auto-trigger. Marking as processed to avoid loop.`);
             initialIdeaProcessedRef.current = true;
             lastProcessedIdeaSignatureRef.current = currentIdeaSignature;
        }
    }, [
        ideaFromUrl, highlightedPathFromUrl, repoUrl, manualBranchName, targetBranchName, 
        triggerPreCheckAndFetch, 
        imageReplaceTask, iconReplaceTask, pendingFlowDetails,
        isPreChecking, 
    ]);

    useEffect(() => {
        const isAutomatedFlowActive = !!imageReplaceTask || !!iconReplaceTask || !!pendingFlowDetails;
        logger.debug("[Effect Scroll] RepoTxtFetcher Check", { fetchStatus, isAutomatedFlowActive, primaryHighlightedPath });
        if (fetchStatus !== 'success' || isAutomatedFlowActive) {
             logger.debug("[Effect Scroll] SKIPPED (wrong status or automated flow active)", { fetchStatus, isAutomatedFlowActive });
             return;
        }
        
        let cleanupScroll = () => {}; 
        const scrollToFile = (path: string, block: ScrollLogicalPosition = "center") => {
             const el = document.getElementById(`file-${path}`);
             if (el) {
                 logger.info(`[Effect Scroll] Scrolling to file: ${path}`);
                 el.scrollIntoView({ behavior: "smooth", block: block });
                 el.classList.add('highlight-scroll');
                 const removeClassTimer = setTimeout(() => {
                     if (document.getElementById(`file-${path}`)) { 
                        el.classList.remove('highlight-scroll');
                     } else {
                        logger.warn(`[Effect Scroll Timeout] Element file-${path} no longer exists for removing highlight.`);
                     }
                 }, 2500);
                 return () => clearTimeout(removeClassTimer); 
             } else {
                logger.warn(`[Effect Scroll] scrollToFile: Element not found for ${path}`);
                toastInfo(`Не удалось найти элемент файла для прокрутки: ${path}`);
                return () => {}; 
             }
        };

        if (primaryHighlightedPath) {
             logger.debug(`[Effect Scroll] Found primary highlight ${primaryHighlightedPath}, scheduling scroll.`);
             const timer = setTimeout(() => {
                 cleanupScroll = scrollToFile(primaryHighlightedPath);
             }, 300);
             return () => { clearTimeout(timer); cleanupScroll(); };
        } else if (fetchedFiles.length > 0) {
             logger.debug("[Effect Scroll] No primary highlight, scrolling to file list container.");
             const cleanupDirectScroll = scrollToSection('file-list-container'); 
             return cleanupDirectScroll as (() => void) | undefined;
        } else {
            logger.debug("[Effect Scroll] No primary highlight and no fetched files, doing nothing.");
            return () => {};
        }
    }, [fetchStatus, primaryHighlightedPath, imageReplaceTask, iconReplaceTask, pendingFlowDetails, fetchedFiles.length, scrollToSection, toastInfo, logger]);

     useEffect(() => {
        logger.debug("[Effect URL Sync] RepoTxtFetcher: Syncing Assistant URL START");
        if (assistantRef?.current?.updateRepoUrl) {
             logger.debug(`[Effect URL Sync] Attempting assistantRef.updateRepoUrl with URL: ${repoUrl}.`);
             updateRepoUrlInAssistant(repoUrl);
        } else {
             logger.warn("[Effect URL Sync] assistantRef or updateRepoUrl not ready yet");
        }
         logger.debug("[Effect URL Sync] RepoTxtFetcher: Syncing Assistant URL END");
    }, [repoUrl, updateRepoUrlInAssistant, assistantRef]);
    
    useEffect(() => {
        if (prevEffectiveBranch && prevEffectiveBranch !== effectiveBranchDisplay) {
            if (fetchStatus === 'success') {
                logger.info(`[RepoTxtFetcher Branch Change] Effective branch changed from '${prevEffectiveBranch}' to '${effectiveBranchDisplay}'. Resetting fetchStatus from 'success' to 'idle'.`);
                setFetchStatus('idle');
            } else if (fetchStatus !== 'idle' && fetchStatus !== 'loading' && fetchStatus !== 'retrying') {
                 logger.info(`[RepoTxtFetcher Branch Change] Effective branch changed from '${prevEffectiveBranch}' to '${effectiveBranchDisplay}'. Resetting fetchStatus from '${fetchStatus}' to 'idle'.`);
                 setFetchStatus('idle');
            }
        }
        setPrevEffectiveBranch(effectiveBranchDisplay);
    }, [effectiveBranchDisplay, fetchStatus, setFetchStatus, prevEffectiveBranch, logger]);

    useImperativeHandle(ref, () => ({
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => {
            logger.debug(`[Imperative] handleFetch called.`);
            return handleFetchManual(isManualRetry, branchNameToFetchOverride);
        },
        selectHighlightedFiles: () => {
             logger.debug(`[Imperative] selectHighlightedFiles called.`);
             selectHighlightedFiles();
        },
        handleAddSelected: (filesToAdd?: Set<string>, allFilesList?: FileNode[]) => { // Changed param name for clarity
            logger.debug(`[Imperative] handleAddSelected called.`);
            // The actual handleAddSelected from useKworkInput uses context selectedFetcherFiles.
            // This imperative version is mostly a pass-through trigger.
            // If specific files need to be added here, the logic in useKworkInput or context needs to support it.
            // For now, it will use the current selection from context.
            handleAddSelected(); 
            return Promise.resolve(); 
        },
        handleCopyToClipboard: (text?: string, scroll?: boolean) => {
             logger.debug(`[Imperative] handleCopyToClipboard called.`);
             return handleCopyToClipboard(text, scroll); 
        },
        clearAll: () => {
             logger.debug(`[Imperative] clearAll called.`);
             handleClearAll(); 
        },
        getKworkInputValue: () => { 
             logger.debug(`[Imperative] getKworkInputValue called.`);
             return kworkInputValue;
        },
        handleAddImportantFiles: () => {
             logger.debug(`[Imperative] handleAddImportantFiles called.`);
             handleAddImportantFiles(); 
        },
        handleAddFullTree: () => {
             logger.debug(`[Imperative] handleAddFullTree called.`);
             handleAddFullTree(); 
        },
        selectAllFiles: () => {
             logger.debug(`[Imperative] selectAllFiles called.`);
             handleSelectAll(); 
        },
        deselectAllFiles: () => {
            logger.debug(`[Imperative] deselectAllFiles called.`);
            handleDeselectAll(); 
        },
    }), [
        handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll,
        kworkInputValue, 
        handleAddImportantFiles, handleAddFullTree, handleSelectAll, handleDeselectAll, logger 
    ]);

     const handleManualBranchChange = useCallback((branch: string) => {
          logger.info(`[CB ManualBranchChange] Setting manual branch: ${branch}`);
          setManualBranchName(branch);
          if (targetBranchName) {
            logger.info(`[CB ManualBranchChange] Clearing targetBranchName`);
            setTargetBranchName(null);
          }
     }, [setManualBranchName, targetBranchName, setTargetBranchName, logger]);

      const handleSelectPrBranch = useCallback((branch: string | null) => {
          logger.info(`[CB SelectPrBranch] Setting target branch: ${branch}`);
          setTargetBranchName(branch);
          if (branch) {
              logger.info(`[CB SelectPrBranch] Clearing manualBranchName`);
              setManualBranchName("");
          }
      }, [setTargetBranchName, setManualBranchName, logger]);

      const handleLoadPrs = useCallback(() => {
          logger.info(`[CB LoadPrs] Triggering PR load for URL: ${repoUrl}`);
          if (repoUrl) {
              triggerGetOpenPRs(repoUrl);
          } else {
              toastError("Введите URL репозитория для загрузки PR.");
              logger.warn("[CB LoadPrs] Cannot load PRs, repo URL is empty.");
          }
      }, [repoUrl, triggerGetOpenPRs, toastError, logger]);

    const currentVisualTask = imageReplaceTask || iconReplaceTask; 
    const showProgressBar = fetchStatus !== 'idle';
    const isActionDisabled = isFetchDisabled || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!currentVisualTask;
    const kworkValueForCheck = kworkInputValue ?? '';
    const isCopyDisabled = !kworkValueForCheck.trim() || isActionDisabled;
    const isClearDisabled = (!kworkValueForCheck.trim() && selectedFetcherFiles.size === 0 && !filesFetched) || isActionDisabled;
    const isAddSelectedDisabled = selectedFetcherFiles.size === 0 || isActionDisabled;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const visualTaskTargetFileReady = currentVisualTask && fetchStatus === 'success' && fetchedFiles.some(f => f.path === currentVisualTask.targetPath);
    logger.debug(`[Render State] isActionDisabled=${isActionDisabled}, isFetchLoading=${isFetchLoading}, showProgressBar=${showProgressBar}`);

    logger.debug("[RepoTxtFetcher] Preparing to render JSX...");

    try {
        return (
          <div id="extractor" className="w-full p-4 md:p-6 bg-card text-foreground font-mono rounded-xl shadow-[0_0_20px_hsl(var(--brand-green)/0.2)] border border-border relative overflow-hidden">
             <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
                  <div>
                     <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
                        {currentVisualTask 
                            ? <VibeContentRenderer content={imageReplaceTask ? '::FaImages className="text-brand-blue"::' : '::FaIcons className="text-brand-purple"::'} /> 
                            : <VibeContentRenderer content='::FaDownload className="text-neon-lime"::' />}
                        <span className={currentVisualTask ? (imageReplaceTask ? "text-brand-blue" : "text-brand-purple") : "text-brand-purple"}>
                           {currentVisualTask ? (imageReplaceTask ? "Задача: Замена Картинки" : "Задача: Замена Иконки") : "Кибер-Экстрактор Кода"}
                        </span>
                     </h2>
                      {!currentVisualTask && (
                         <div className="text-brand-yellow/80 text-xs md:text-sm space-y-1 mb-2 prose prose-invert prose-p:my-1 prose-strong:text-brand-purple prose-span:font-normal prose-a:text-brand-blue max-w-none">
                            <VibeContentRenderer content={"1. Настрой <FaCodeBranch title='Настройки' class='inline text-cyan-400'/>."} />
                            <VibeContentRenderer content={"2. Жми <strong class='text-purple-400 mx-1'>\"Извлечь файлы\"</strong>."} />
                            <VibeContentRenderer content={"3. Выбери файлы или <strong class='text-teal-400 mx-1'>связанные</strong> / <strong class='text-orange-400 mx-1'>важные</strong>."} />
                            <VibeContentRenderer content={"4. Опиши задачу ИЛИ добавь файлы <FaPlus title='Добавить выбранные в запрос' class='inline text-sm'/> / все <FaTree title='Добавить все файлы в запрос' class='inline text-sm'/>."} />
                            <VibeContentRenderer content={"5. Скопируй <FaCopy title='Скопировать запрос' class='inline text-sm mx-px'/> или передай дальше."} />
                         </div>
                      )}
                      {currentVisualTask && (
                          <p className={`${imageReplaceTask ? "text-brand-blue/80" : "text-brand-purple/80"} text-xs md:text-sm mb-2`}>
                              Авто-загрузка файла для замены: <code className="text-xs bg-muted px-1 py-0.5 rounded">{currentVisualTask.targetPath}</code>...
                          </p>
                      )}
                  </div>
                  <motion.button
                      onClick={() => { logger.debug("[Click] Settings Toggle Button Click"); triggerToggleSettingsModal(); }}
                      disabled={isFetchLoading || assistantLoading || isParsing}
                      whileHover={{ scale: (isFetchLoading || assistantLoading || isParsing) ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                      whileTap={{ scale: (isFetchLoading || assistantLoading || isParsing) ? 1 : 0.95 }}
                      title={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                      aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                      aria-expanded={isSettingsModalOpen}
                      className="p-2 bg-muted/50 rounded-full hover:bg-muted/70 transition-colors flex-shrink-0 disabled:opacity-50"
                  >
                      {isSettingsModalOpen 
                        ? <VibeContentRenderer content='::FaAngleUp className="text-brand-cyan text-xl"::' /> 
                        : <VibeContentRenderer content='::FaCodeBranch className="text-brand-cyan text-xl"::' />}
                  </motion.button>
              </div>

             <SettingsModal
                  isOpen={isSettingsModalOpen}
                  repoUrl={repoUrlFromContext} 
                  setRepoUrl={handleRepoUrlChange}
                  token={token}
                  setToken={setToken}
                  manualBranchName={manualBranchName}
                  setManualBranchName={handleManualBranchChange} 
                  currentTargetBranch={targetBranchName} 
                  openPrs={openPrs}
                  loadingPrs={loadingPrs}
                  onSelectPrBranch={handleSelectPrBranch} 
                  onLoadPrs={handleLoadPrs} 
                  loading={isFetchLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing}
              />

             <div className="mb-4 flex justify-center">
                  <motion.button
                      onClick={() => {
                          logger.info("[Click] Fetch Button Clicked");
                          handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error');
                       }}
                      disabled={isFetchDisabled} 
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-primary-foreground bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-destructive to-orange-500 hover:from-destructive/90 hover:to-orange-600' : 'from-neon-lime to-brand-cyan'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${isFetchDisabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`}
                      whileHover={{ scale: isFetchDisabled ? 1 : 1.03 }}
                      whileTap={{ scale: isFetchDisabled ? 1 : 0.97 }}
                      title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}${currentVisualTask ? ` (для задачи замены ${imageReplaceTask ? 'картинки' : 'иконки'})` : ''}`}
                  >
                       {isFetchLoading 
                           ? <VibeContentRenderer content='::FaSpinner className="animate-spin"::' /> 
                           : (fetchStatus === 'failed_retries' || fetchStatus === 'error' 
                               ? <VibeContentRenderer content="::FaArrowsRotate::" /> 
                               : currentVisualTask 
                                   ? <VibeContentRenderer content={imageReplaceTask ? "::FaImages::" : "::FaIcons::"} /> 
                                   : <VibeContentRenderer content="::FaDownload::" />)}
                       {fetchStatus === 'retrying' ? "Повтор запроса..." : isFetchLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : currentVisualTask ? "Загрузить файл" : "Извлечь файлы")}
                       <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
                  </motion.button>
              </div>

             {showProgressBar && (
                  <div className="mb-4 min-h-[40px]">
                      <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                      {isFetchLoading && <p className="text-brand-cyan text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                      {isParsing && !currentVisualTask && <p className="text-brand-yellow text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                      {fetchStatus === 'success' && !currentVisualTask && fetchedFiles.length > 0 && (
                         <div className="text-center text-xs font-mono mt-1 text-brand-green flex items-center justify-center gap-1">
                             <VibeContentRenderer content="::FaCircleCheck::" /> {`Успешно ${fetchedFiles.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`}
                         </div>
                       )}
                       {fetchStatus === 'success' && !currentVisualTask && fetchedFiles.length === 0 && (
                          <div className="text-center text-xs font-mono mt-1 text-brand-yellow flex items-center justify-center gap-1">
                              <VibeContentRenderer content="::FaCircleCheck::" /> {`Завершено успешно, но 0 файлов найдено в ветке '${effectiveBranchDisplay}'.`}
                          </div>
                       )}
                       {visualTaskTargetFileReady && (
                          <div className={`text-center text-xs font-mono mt-1 ${imageReplaceTask ? "text-brand-green" : "text-brand-purple"} flex items-center justify-center gap-1`}>
                              <VibeContentRenderer content="::FaCircleCheck::" /> {`Файл ${currentVisualTask?.targetPath.split('/').pop()} загружен и готов.`}
                          </div>
                        )}
                        {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && fetchError && (
                           <div className="text-center text-xs font-mono mt-1 text-destructive flex items-center justify-center gap-1">
                               <VibeContentRenderer content="::FaXmark::" /> {fetchError}
                           </div>
                        )}
                        {isWaitingForAiResponse && !currentVisualTask && (
                            <p className="text-brand-blue text-xs font-mono mt-1 text-center animate-pulse">
                                 ⏳ Ожидание ответа от AI... (ID Запроса: {currentAiRequestId?.substring(0, 6)}...)
                            </p>
                         )}
                  </div>
              )}

             <div className={`grid grid-cols-1 ${ (fetchedFiles.length > 0 && !currentVisualTask) ? 'md:grid-cols-2' : ''} gap-4 md:gap-6`}>
                 {!currentVisualTask && (isFetchLoading || fetchedFiles.length > 0) && (
                     <div className={`flex flex-col gap-4 ${ (fetchedFiles.length > 0 || kworkValueForCheck.trim().length > 0) ? '' : 'md:col-span-2'}`}>
                         <SelectedFilesPreview
                             selectedFiles={selectedFetcherFiles}
                             allFiles={fetchedFiles} 
                             getLanguage={repoUtils.getLanguage} 
                         />
                         <FileList
                             id="file-list-container"
                             files={fetchedFiles} 
                             selectedFiles={selectedFetcherFiles}
                             primaryHighlightedPath={primaryHighlightedPath}
                             secondaryHighlightedPaths={secondaryHighlightedPaths}
                             importantFiles={importantFiles} 
                             isLoading={isFetchLoading}
                             isActionDisabled={isActionDisabled}
                             toggleFileSelection={toggleFileSelection}
                             onAddImportant={handleAddImportantFiles}
                             onSelectHighlighted={selectHighlightedFiles}
                             onSelectAll={handleSelectAll}
                             onDeselectAll={handleDeselectAll}
                             onAddSelected={handleAddSelected} 
                             onAddTree={handleAddFullTree}     
                          />
                      </div>
                 )}

                 {!currentVisualTask && (fetchedFiles.length > 0 || kworkValueForCheck.trim().length > 0) && (
                      <div id="kwork-input-section" className="flex flex-col gap-3">
                          <RequestInput
                              kworkInputRef={kworkInputRef} 
                              kworkInputValue={kworkInputValue ?? ''} 
                              onValueChange={setKworkInputValue} 
                              onCopyToClipboard={() => { logger.debug("[Input Action] Copy Click"); handleCopyToClipboard(undefined, true); }}
                              onClearAll={() => { logger.debug("[Input Action] Clear Click"); handleClearAll(); }}
                              onAddSelected={() => { logger.debug("[Input Action] AddSelected Click"); handleAddSelected(); }}
                              isCopyDisabled={isCopyDisabled} 
                              isClearDisabled={isClearDisabled} 
                              isAddSelectedDisabled={isAddSelectedDisabled} 
                              selectedFetcherFilesCount={selectedFetcherFiles.size}
                              filesFetched={filesFetched} 
                              isActionDisabled={isActionDisabled}
                          />
                      </div>
                 )}

                 {currentVisualTask && filesFetched && ( 
                      <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-card/30 rounded-lg border border-dashed ${visualTaskTargetFileReady ? (imageReplaceTask ? 'border-brand-blue' : 'border-brand-purple') : (fetchStatus === 'error' || fetchStatus === 'failed_retries') ? 'border-destructive' : 'border-muted'} min-h-[200px]`}>
                          {isFetchLoading 
                            ? <VibeContentRenderer content='::FaSpinner className="text-brand-blue text-3xl mb-3 animate-spin"::' />
                           : assistantLoading 
                            ? <VibeContentRenderer content='::FaSpinner className="text-brand-purple text-3xl mb-3 animate-spin"::' />
                           : visualTaskTargetFileReady 
                            ? <VibeContentRenderer content='::FaCircleCheck className="text-brand-green text-3xl mb-3"::' />
                           : <VibeContentRenderer content='::FaXmark className="text-destructive text-3xl mb-3"::' /> }
                          <p className={`text-sm font-semibold ${visualTaskTargetFileReady ? (imageReplaceTask ? 'text-brand-blue' : 'text-brand-purple') : 'text-destructive'}`}>
                              {isFetchLoading ? "Загрузка файла..."
                               : assistantLoading ? "Обработка Ассистентом..."
                               : visualTaskTargetFileReady ? `Файл ${currentVisualTask?.targetPath.split('/').pop()} готов.`
                               : fetchStatus === 'error' || fetchStatus === 'failed_retries' ? `Ошибка загрузки файла ${currentVisualTask?.targetPath.split('/').pop()}.`
                               : `Файл ${currentVisualTask?.targetPath.split('/').pop()} не найден!`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                               {isFetchLoading ? "Ожидание загрузки репозитория..."
                               : assistantLoading ? "Создание/обновление Pull Request..."
                               : visualTaskTargetFileReady ? "Файл передан Ассистенту для обработки."
                               : fetchStatus === 'error' || fetchStatus === 'failed_retries' ? "Проверьте URL, токен, имя ветки или права доступа."
                               : "Проверьте правильность пути к файлу и выбранную ветку."}
                          </p>
                      </div>
                 )}
            </div> 
          </div> 
        );
    } catch (renderError: any) {
        logger.fatal("[RepoTxtFetcher] CRITICAL RENDER ERROR:", renderError);
        return <div className="text-red-500 p-4">Критическая ошибка рендеринга Экстрактора: {renderError.message}</div>;
    }
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;