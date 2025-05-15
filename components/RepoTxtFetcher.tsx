"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from "react";
// Removed direct Fa icon imports, will use VibeContentRenderer
import { motion } from "framer-motion";

// --- Core & Context ---
import {
    useRepoXmlPageContext,
    RepoTxtFetcherRef,
    FileNode,
    // ImportCategory, // Not explicitly used in this restored version's logic
    ImageReplaceTask,
    // SimplePullRequest, // Not explicitly used in this restored version's logic
    // FetchStatus // String literals used
} from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger";

// --- Hooks & Utils ---
import * as repoUtils from "@/lib/repoUtils"; // Kept for getLanguage, assuming it's fine
import { useRepoFetcher } from "@/hooks/useRepoFetcher";
import { useFileSelection } from "@/hooks/useFileSelection";
import { useKworkInput } from "@/hooks/useKworkInput";
import { useAppToast } from "@/hooks/useAppToast";

// --- Sub-components ---
import SettingsModal from "@/components/repo/SettingsModal"; // Updated path
import FileList from "@/components/repo/FileList"; // Updated path
import SelectedFilesPreview from "@/components/repo/SelectedFilesPreview"; // Updated path
import RequestInput from "@/components/repo/RequestInput"; // Updated path
import ProgressBar from "@/components/repo/ProgressBar"; // Updated path
import VibeContentRenderer from '@/components/VibeContentRenderer'; // Added for icons

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
    logger.log("[RepoTxtFetcher] START Render (Restored Version)");

    // === Context ===
    const { 
        // addToast: addToastContext, // Not used directly
        fetchStatus, setFetchStatus,
        filesFetched,
        repoUrl: repoUrlFromContext, setRepoUrl: setRepoUrlInContext, repoUrlEntered,
        selectedFetcherFiles,
        // kworkInputHasContent, // Derived locally or from kworkInputValue
        kworkInputValue,
        setKworkInputValue,
        kworkInputRef,
        loadingPrs,
        assistantLoading, isParsing, aiActionLoading,
        targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs,
        // setLoadingPrs, // Not used directly, handled by triggerGetOpenPRs
        triggerGetOpenPRs,
        isSettingsModalOpen, triggerToggleSettingsModal, scrollToSection,
        currentAiRequestId,
        imageReplaceTask, // Renamed from imageReplaceTask: contextImageReplaceTask
        // allFetchedFiles, // This was from context, useRepoFetcher provides 'fetchedFiles' which is used as allFetchedFiles for useKworkInput
        assistantRef, updateRepoUrlInAssistant,
        // Added missing context items potentially used by restored logic
        setImageReplaceTask, // Needed if ideaProp logic sets it
        triggerPreCheckAndFetch, // Needed for ideaProp logic
    } = useRepoXmlPageContext();
    const { error: toastError, info: toastInfo } = useAppToast();
    logger.debug("[RepoTxtFetcher] After Context Destructuring");


    // === Basic Component State ===
    const [token, setToken] = useState<string>("");
    const [prevEffectiveBranch, setPrevEffectiveBranch] = useState<string | null>(null); // For branch change detection
    logger.debug("[RepoTxtFetcher] After useState");

    // === Context values re-assignment (as per original 777483e5 structure) ===
    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext;

    // === URL Params & Derived State ---
    const highlightedPathFromUrl = highlightedPathProp ?? "";
    const ideaFromUrl = ideaProp ?? "";
    logger.debug(`[RepoTxtFetcher] Received props: highlightedPathProp='${highlightedPathFromUrl}', ideaProp='${ideaFromUrl ? ideaFromUrl.substring(0,30)+'...' : 'null'}'`);

    const autoFetch = useMemo(() =>
        !!imageReplaceTask ||
        (!!highlightedPathFromUrl || !!ideaFromUrl)
    , [imageReplaceTask, highlightedPathFromUrl, ideaFromUrl]);

    // --- Используется жестко закодированный список важных файлов из версии 777483e5 ---
    const importantFiles = useMemo(() => [
        "package.json", "app/layout.tsx",
        "tailwind.config.ts",
        "app/globals.css",
        "app/repo-xml/page.tsx", 
        "components/RepoTxtFetcher.tsx", 
        "components/AICodeAssistant.tsx", 
        "contexts/RepoXmlPageContext.tsx", 
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
    // --- КОНЕЦ СПИСКА ВАЖНЫХ ФАЙЛОВ ---

    const effectiveBranchDisplay = useMemo(() => targetBranchName || manualBranchName || "default", [targetBranchName, manualBranchName]);

    logger.debug("[RepoTxtFetcher] After Derived State/Memo");

    // === Custom Hooks ===
    logger.debug("[RepoTxtFetcher] Before useRepoFetcher Hook");
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
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl,
        importantFiles, 
        autoFetch,
        ideaFromUrl,
        isSettingsModalOpen,
        repoUrlEntered, assistantLoading, isParsing, aiActionLoading,
        loadingPrs,
    });
    logger.debug("[RepoTxtFetcher] After useRepoFetcher Hook");

    logger.debug("[RepoTxtFetcher] Before useFileSelection Hook");
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
        imageReplaceTaskActive: !!imageReplaceTask,
    });
    logger.debug("[RepoTxtFetcher] After useFileSelection Hook");

    logger.debug("[RepoTxtFetcher] Before useKworkInput Hook");
    const {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
    } = useKworkInput({
        selectedFetcherFiles,
        allFetchedFiles: fetchedFiles, // Pass fetchedFiles here
        imageReplaceTaskActive: !!imageReplaceTask,
        files: fetchedFiles, 
    });
    logger.debug("[RepoTxtFetcher] After useKworkInput Hook");

    // === Effects ===
    useEffect(() => {
        logger.debug("[Effect URL Sync] RepoTxtFetcher: Syncing Assistant URL START");
        if (assistantRef?.current?.updateRepoUrl) {
             logger.debug(`[Effect URL Sync] Attempting assistantRef.updateRepoUrl with URL: ${repoUrl}. Type: ${typeof assistantRef.current.updateRepoUrl}`);
             updateRepoUrlInAssistant(repoUrl);
        } else {
             logger.warn("[Effect URL Sync] assistantRef or updateRepoUrl not ready yet");
        }
         logger.debug("[Effect URL Sync] RepoTxtFetcher: Syncing Assistant URL END");
    }, [repoUrl, updateRepoUrlInAssistant, assistantRef]);
    
    // Effect from 777483e5 for ideaProp (ImageReplace/ErrorFix)
    useEffect(() => {
        logger.debug(`[RepoTxtFetcher Effect ideaProp] ideaProp changed or component mounted. ideaProp: '${ideaFromUrl}', highlightedPathFromUrl: '${highlightedPathFromUrl}'`);
        if (ideaFromUrl && highlightedPathFromUrl && repoUrl.includes("github.com")) {
            if (ideaFromUrl.startsWith("ImageReplace|")) {
                logger.info("[RepoTxtFetcher Effect ideaProp] Detected ImageReplace flow from ideaProp.");
                const parts = ideaFromUrl.split("|");
                const oldUrlPart = parts.find(p => p.startsWith("OldURL="));
                const newUrlPart = parts.find(p => p.startsWith("NewURL="));

                if (oldUrlPart && newUrlPart) {
                    const oldUrl = decodeURIComponent(oldUrlPart.substring("OldURL=".length));
                    const newUrl = decodeURIComponent(newUrlPart.substring("NewURL=".length));
                    
                    logger.log("[RepoTxtFetcher Effect ideaProp] Parsed ImageReplace details:", { targetPath: highlightedPathFromUrl, oldUrl, newUrl });
                    
                    const branchNameToUse = manualBranchName || targetBranchName || ''; 
                    triggerPreCheckAndFetch( // Ensure triggerPreCheckAndFetch is from context
                        repoUrl,
                        branchNameToUse,
                        'ImageSwap',
                        { oldUrl, newUrl }, 
                        highlightedPathFromUrl
                    ).then(() => {
                        logger.log("[RepoTxtFetcher Effect ideaProp] triggerPreCheckAndFetch for ImageSwap completed via ideaProp.");
                    }).catch(err => {
                        logger.error("[RepoTxtFetcher Effect ideaProp] Error calling triggerPreCheckAndFetch for ImageSwap via ideaProp:", err);
                         setImageReplaceTask({ targetPath: highlightedPathFromUrl, oldUrl, newUrl }); // Ensure setImageReplaceTask is from context
                    });
                } else {
                    logger.warn("[RepoTxtFetcher Effect ideaProp] Could not parse OldURL/NewUrl from ImageReplace ideaProp.");
                }
            } else if (ideaFromUrl.startsWith("ErrorFix|")) {
                logger.info("[RepoTxtFetcher Effect ideaProp] Detected ErrorFix flow from ideaProp.");
                 try {
                    const detailsString = ideaFromUrl.substring("ErrorFix|".length);
                    const parsedDetails = JSON.parse(decodeURIComponent(detailsString)); 
                     logger.log("[RepoTxtFetcher Effect ideaProp] Parsed ErrorFix details:", parsedDetails);

                    const branchNameToUse = manualBranchName || targetBranchName || '';
                     triggerPreCheckAndFetch( // Ensure triggerPreCheckAndFetch is from context
                         repoUrl,
                         branchNameToUse,
                         'ErrorFix',
                         parsedDetails,
                         highlightedPathFromUrl
                     ).then(() => {
                         logger.log("[RepoTxtFetcher Effect ideaProp] triggerPreCheckAndFetch for ErrorFix completed via ideaProp.");
                     }).catch(err => {
                         logger.error("[RepoTxtFetcher Effect ideaProp] Error calling triggerPreCheckAndFetch for ErrorFix via ideaProp:", err);
                     });
                 } catch (e) {
                     logger.error("[RepoTxtFetcher Effect ideaProp] Failed to parse ErrorFix details from ideaProp:", e);
                 }
            } else {
                 logger.log(`[RepoTxtFetcher Effect ideaProp] ideaProp ("${ideaFromUrl}") is present but not for ImageReplace or ErrorFix.`);
            }
        } else {
             logger.debug(`[RepoTxtFetcher Effect ideaProp] Skipping flow trigger: ideaFromUrl='${ideaFromUrl}', highlightedPathFromUrl='${highlightedPathFromUrl}', repoUrl='${repoUrl}'`);
        }
    }, [ideaFromUrl, highlightedPathFromUrl, repoUrl, manualBranchName, targetBranchName, triggerPreCheckAndFetch, setImageReplaceTask, logger]);


    useEffect(() => {
        logger.debug("[Effect Scroll] RepoTxtFetcher Check");
        if (fetchStatus !== 'success' || !!imageReplaceTask || autoFetch) {
             logger.debug("[Effect Scroll] SKIPPED (wrong status/mode/auto)", { fetchStatus, imageReplaceTask, autoFetch });
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
    }, [fetchStatus, primaryHighlightedPath, imageReplaceTask, autoFetch, fetchedFiles.length, scrollToSection, toastInfo, logger]);

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

    // === Imperative Handle ===
    logger.debug("[RepoTxtFetcher] Before useImperativeHandle");
    useImperativeHandle(ref, () => ({
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => { // taskForEarlyCheck might be unused if context handles it
            logger.debug(`[Imperative] handleFetch called.`);
            return handleFetchManual(isManualRetry, branchNameToFetchOverride);
        },
        selectHighlightedFiles: () => {
             logger.debug(`[Imperative] selectHighlightedFiles called.`);
             selectHighlightedFiles();
        },
        handleAddSelected: (filesToAdd?: Set<string>, allFiles?: FileNode[]) => { // Make args optional if not always provided from parent
            logger.debug(`[Imperative] handleAddSelected called.`);
            handleAddSelected(); 
            return Promise.resolve(); // Keep if original returned promise
        },
        handleCopyToClipboard: (text?: string, scroll?: boolean) => {
             logger.debug(`[Imperative] handleCopyToClipboard called.`);
             return handleCopyToClipboard(text, scroll); 
        },
        clearAll: () => {
             logger.debug(`[Imperative] clearAll called.`);
             handleClearAll(); 
        },
        getKworkInputValue: () => { // Added from 777483e5
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
    logger.debug("[RepoTxtFetcher] After useImperativeHandle");

    // --- Local Event Handlers (from 777483e5) ---
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

    // --- Derived States for Rendering (from 777483e5) ---
    logger.debug("[RepoTxtFetcher] Calculate Derived State");
    const currentImageTask = imageReplaceTask;
    const showProgressBar = fetchStatus !== 'idle';
    const isActionDisabledReal = isFetchDisabled || isFetchLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!currentImageTask; // Renamed to avoid conflict
    const kworkValueForCheck = kworkInputValue ?? '';
    const isCopyDisabled = !kworkValueForCheck.trim() || isActionDisabledReal;
    const isClearDisabled = (!kworkValueForCheck.trim() && selectedFetcherFiles.size === 0 && !filesFetched) || isActionDisabledReal;
    const isAddSelectedDisabled = selectedFetcherFiles.size === 0 || isActionDisabledReal;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const imageTaskTargetFileReady = currentImageTask && fetchStatus === 'success' && fetchedFiles.some(f => f.path === currentImageTask.targetPath);
    logger.debug(`[Render State] isActionDisabledReal=${isActionDisabledReal}, isFetchLoading=${isFetchLoading}, showProgressBar=${showProgressBar}`);

    logger.debug("[RepoTxtFetcher] Preparing to render JSX...");

    try {
        return (
          <div id="extractor" className="w-full p-4 md:p-6 bg-card text-foreground font-mono rounded-xl shadow-[0_0_20px_hsl(var(--brand-green)/0.2)] border border-border relative overflow-hidden">
             <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
                  <div>
                     <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
                        {currentImageTask 
                            ? <VibeContentRenderer content='::FaImages className="text-brand-blue"::' /> 
                            : <VibeContentRenderer content='::FaDownload className="text-neon-lime"::' />}
                        <span className={currentImageTask ? "text-brand-blue" : "text-brand-purple"}>
                           {currentImageTask ? "Задача: Замена Картинки" : "Кибер-Экстрактор Кода"}
                        </span>
                     </h2>
                      {!currentImageTask && (
                         <div className="text-brand-yellow/80 text-xs md:text-sm space-y-1 mb-2 prose prose-invert prose-p:my-1 prose-strong:text-brand-purple prose-span:font-normal prose-a:text-brand-blue max-w-none">
                            <VibeContentRenderer content={"1. Настрой ::FaCodeBranch title='Настройки' class='inline text-cyan-400'::."} />
                            <VibeContentRenderer content={"2. Жми <strong class='text-purple-400 mx-1'>\"Извлечь файлы\"</strong>."} />
                            <VibeContentRenderer content={"3. Выбери файлы или <strong class='text-teal-400 mx-1'>связанные</strong> / <strong class='text-orange-400 mx-1'>важные</strong>."} />
                            <VibeContentRenderer content={"4. Опиши задачу ИЛИ добавь файлы ::FaPlus title='Добавить выбранные в запрос' class='inline text-sm':: / все ::FaTree title='Добавить все файлы в запрос' class='inline text-sm'::."} />
                            <VibeContentRenderer content={"5. Скопируй ::FaCopy title='Скопировать запрос' class='inline text-sm mx-px':: или передай дальше."} />
                         </div>
                      )}
                      {currentImageTask && (
                          <p className="text-brand-blue/80 text-xs md:text-sm mb-2">
                              Авто-загрузка файла для замены: <code className="text-xs bg-muted px-1 py-0.5 rounded">{currentImageTask.targetPath}</code>...
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
                  repoUrl={repoUrl}
                  setRepoUrl={handleRepoUrlChange}
                  token={token}
                  setToken={setToken}
                  manualBranchName={manualBranchName}
                  setManualBranchName={handleManualBranchChange} // Use local handler
                  currentTargetBranch={targetBranchName} // Pass targetBranchName from context
                  openPrs={openPrs}
                  loadingPrs={loadingPrs}
                  onSelectPrBranch={handleSelectPrBranch} // Use local handler
                  onLoadPrs={handleLoadPrs} // Use local handler
                  loading={isFetchLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing}
              />

             <div className="mb-4 flex justify-center">
                  <motion.button
                      onClick={() => {
                          logger.info("[Click] Fetch Button Clicked");
                          handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error');
                       }}
                      disabled={isFetchDisabled} // isFetchDisabled from useRepoFetcher
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-primary-foreground bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-destructive to-orange-500 hover:from-destructive/90 hover:to-orange-600' : 'from-neon-lime to-brand-cyan'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${isFetchDisabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`}
                      whileHover={{ scale: isFetchDisabled ? 1 : 1.03 }}
                      whileTap={{ scale: isFetchDisabled ? 1 : 0.97 }}
                      title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}${currentImageTask ? ' (для задачи замены картинки)' : ''}`}
                  >
                       {isFetchLoading 
                           ? <VibeContentRenderer content='::FaSpinner className="animate-spin"::' /> 
                           : (fetchStatus === 'failed_retries' || fetchStatus === 'error' 
                               ? <VibeContentRenderer content='::FaArrowsRotate::' /> 
                               : currentImageTask 
                                   ? <VibeContentRenderer content='::FaImages::' /> 
                                   : <VibeContentRenderer content='::FaDownload::' />)}
                       {fetchStatus === 'retrying' ? "Повтор запроса..." : isFetchLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : currentImageTask ? "Загрузить файл" : "Извлечь файлы")}
                       <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
                  </motion.button>
              </div>

             {showProgressBar && (
                  <div className="mb-4 min-h-[40px]">
                      <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                      {isFetchLoading && <p className="text-brand-cyan text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                      {isParsing && !currentImageTask && <p className="text-brand-yellow text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                      {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length > 0 && (
                         <div className="text-center text-xs font-mono mt-1 text-brand-green flex items-center justify-center gap-1">
                             <VibeContentRenderer content='::FaCircleCheck::' /> {`Успешно ${fetchedFiles.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`}
                         </div>
                       )}
                       {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length === 0 && (
                          <div className="text-center text-xs font-mono mt-1 text-brand-yellow flex items-center justify-center gap-1">
                              <VibeContentRenderer content='::FaCircleCheck::' /> {`Завершено успешно, но 0 файлов найдено в ветке '${effectiveBranchDisplay}'.`}
                          </div>
                       )}
                       {imageTaskTargetFileReady && (
                          <div className="text-center text-xs font-mono mt-1 text-brand-green flex items-center justify-center gap-1">
                              <VibeContentRenderer content='::FaCircleCheck::' /> {`Файл ${currentImageTask?.targetPath.split('/').pop()} загружен и готов.`}
                          </div>
                        )}
                        {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && fetchError && (
                           <div className="text-center text-xs font-mono mt-1 text-destructive flex items-center justify-center gap-1">
                               <VibeContentRenderer content='::FaXmark::' /> {fetchError}
                           </div>
                        )}
                        {isWaitingForAiResponse && !currentImageTask && (
                            <p className="text-brand-blue text-xs font-mono mt-1 text-center animate-pulse">
                                 ⏳ Ожидание ответа от AI... (ID Запроса: {currentAiRequestId?.substring(0, 6)}...)
                            </p>
                         )}
                  </div>
              )}

             <div className={`grid grid-cols-1 ${ (fetchedFiles.length > 0 && !currentImageTask) ? 'md:grid-cols-2' : ''} gap-4 md:gap-6`}>
                 {!currentImageTask && (isFetchLoading || fetchedFiles.length > 0) && (
                     <div className={`flex flex-col gap-4 ${ (fetchedFiles.length > 0 || kworkValueForCheck.trim().length > 0) ? '' : 'md:col-span-2'}`}>
                         <SelectedFilesPreview
                             selectedFiles={selectedFetcherFiles}
                             allFiles={fetchedFiles} 
                             getLanguage={repoUtils.getLanguageForFile} // use getLanguageForFile from repoUtils
                         />
                         <FileList
                             id="file-list-container"
                             files={fetchedFiles} // Assuming FileList takes filteredFiles, if not, pass filteredFiles
                             selectedFiles={selectedFetcherFiles}
                             primaryHighlightedPath={primaryHighlightedPath}
                             secondaryHighlightedPaths={secondaryHighlightedPaths} // Pass the record directly
                             importantFiles={importantFiles} 
                             isLoading={isFetchLoading}
                             isActionDisabled={isActionDisabledReal}
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

                 {!currentImageTask && (fetchedFiles.length > 0 || kworkValueForCheck.trim().length > 0) && (
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
                              isActionDisabled={isActionDisabledReal} 
                          />
                      </div>
                 )}

                 {currentImageTask && filesFetched && ( // This was `filesFetched` from context, which should be ok
                      <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-card/30 rounded-lg border border-dashed ${imageTaskTargetFileReady ? 'border-brand-blue' : (fetchStatus === 'error' || fetchStatus === 'failed_retries') ? 'border-destructive' : 'border-muted'} min-h-[200px]`}>
                          {isFetchLoading 
                            ? <VibeContentRenderer content='::FaSpinner className="text-brand-blue text-3xl mb-3 animate-spin"::' />
                           : assistantLoading 
                            ? <VibeContentRenderer content='::FaSpinner className="text-brand-purple text-3xl mb-3 animate-spin"::' />
                           : imageTaskTargetFileReady 
                            ? <VibeContentRenderer content='::FaCircleCheck className="text-brand-green text-3xl mb-3"::' />
                           : <VibeContentRenderer content='::FaXmark className="text-destructive text-3xl mb-3"::' /> }
                          <p className={`text-sm font-semibold ${imageTaskTargetFileReady ? 'text-brand-blue' : 'text-destructive'}`}>
                              {isFetchLoading ? "Загрузка файла..."
                               : assistantLoading ? "Обработка Ассистентом..."
                               : imageTaskTargetFileReady ? `Файл ${currentImageTask?.targetPath.split('/').pop()} готов.`
                               : fetchStatus === 'error' || fetchStatus === 'failed_retries' ? `Ошибка загрузки файла ${currentImageTask?.targetPath.split('/').pop()}.`
                               : `Файл ${currentImageTask?.targetPath.split('/').pop()} не найден!`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                               {isFetchLoading ? "Ожидание загрузки репозитория..."
                               : assistantLoading ? "Создание/обновление Pull Request..."
                               : imageTaskTargetFileReady ? "Файл передан Ассистенту для обработки."
                               : fetchStatus === 'error' || fetchStatus === 'failed__retries' ? "Проверьте URL, токен, имя ветки или права доступа."
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
    } finally {
        logger.log("[RepoTxtFetcher] END Render (Restored Version)");
    }
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;