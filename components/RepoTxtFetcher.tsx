"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from "react";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaCodeBranch, FaPlus, FaSpinner, FaTree, FaImages
} from "react-icons/fa6";
import { motion } from "framer-motion";

// --- Core & Context ---
import {
    useRepoXmlPageContext,
    RepoTxtFetcherRef,
    FileNode,
    ImportCategory,
    ImageReplaceTask,
    SimplePullRequest,
    FetchStatus
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
    logger.debug(`[TRIM_DEBUG RepoTxtFetcher Top] Raw Props: ideaProp="${ideaProp}", highlightedPathProp="${highlightedPathProp}"`);

    const { 
        addToast: addToastContext, fetchStatus, setFetchStatus, filesFetched,
        repoUrl: repoUrlFromContext, setRepoUrl: setRepoUrlInContext, repoUrlEntered,
        githubToken, setGithubToken, // Using githubToken and setGithubToken from context
        selectedFetcherFiles, kworkInputHasContent, kworkInputValue, setKworkInputValue, kworkInputRef,
        loadingPrs, assistantLoading, isParsing, aiActionLoading, targetBranchName, 
        setTargetBranchName, manualBranchName, setManualBranchName, openPrs, setLoadingPrs, 
        triggerGetOpenPRs, isSettingsModalOpen, triggerToggleSettingsModal, scrollToSection,
        currentAiRequestId, imageReplaceTask, allFetchedFiles, assistantRef, 
        updateRepoUrlInAssistant, handleSetFilesFetched, setTargetPrData, setSelectedFetcherFiles, 
        setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, 
        setContextIsParsing, pendingFlowDetails, primaryHighlightedPath, 
        secondaryHighlightedPaths, 
        retryCount 
    } = useRepoXmlPageContext();
    const { error: toastError, info: toastInfo } = useAppToast();
    logger.debug("[RepoTxtFetcher] After context destructuring");
    logger.debug(`[TRIM_DEBUG RepoTxtFetcher Context Values] kworkInputValue from context: "${String(kworkInputValue).substring(0,50)}", type: ${typeof kworkInputValue}`);

    // const [token, setToken] = useState<string>(""); // Removed local token state
    const [prevEffectiveBranch, setPrevEffectiveBranch] = useState<string | null>(null); 
    logger.debug("[RepoTxtFetcher] After useState");

    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext;

    const highlightedPathFromUrl = highlightedPathProp ?? "";
    const ideaFromUrl = (typeof ideaProp === 'string' && ideaProp !== 'null') ? ideaProp : ""; 
    logger.debug(`[RepoTxtFetcher] Processed props for internal use: highlightedPathFromUrl='${highlightedPathFromUrl}', ideaFromUrl='${ideaFromUrl ? ideaFromUrl.substring(0,30)+'...' : ""}'`);

    const autoFetch = useMemo(() =>
        !!imageReplaceTask ||
        (!!highlightedPathFromUrl || !!ideaFromUrl)
    , [imageReplaceTask, highlightedPathFromUrl, ideaFromUrl]);

    const importantFiles = useMemo(() => [
        "package.json", "app/layout.tsx",          
        "tailwind.config.ts", "app/globals.css", "app/style-guide/page.tsx",       
        "contexts/AppContext.tsx", "hooks/useAppToast.ts", "hooks/supabase.ts", 
        "app/actions.ts", "lib/debugLogger.ts", "components/VibeContentRenderer.tsx",
        "components/Header.tsx", "types/database.types", 
    ].filter(Boolean), []); 

    const effectiveBranchDisplay = useMemo(() => targetBranchName || manualBranchName || "default", [targetBranchName, manualBranchName]);
    logger.debug("[RepoTxtFetcher] After Derived State/Memo");

    logger.debug("[RepoTxtFetcher] Before useRepoFetcher Hook");
    const repoFetcher = useRepoFetcher(
        repoUrl, 
        handleSetFilesFetched, 
        addToastContext, 
        targetBranchName, 
        manualBranchName, 
        fetchStatus 
    );
    const { 
        files: fetchedFiles, progress, error: fetchErrorHook, 
        handleFetchManual, 
        loading: isFetchLoading, 
        isFetchDisabled,
        maxRetries: hookMaxRetries 
    } = repoFetcher;
    const primaryHighlightedPathFromHook = primaryHighlightedPath; 
    const secondaryHighlightedPathsFromHook = secondaryHighlightedPaths; 
    
    logger.debug(`[RepoTxtFetcher] After useRepoFetcher Hook. isFetchLoading: ${isFetchLoading}, isFetchDisabled: ${isFetchDisabled}`);

    logger.debug("[RepoTxtFetcher] Before useFileSelection Hook");
    const {
        toggleFileSelection, selectHighlightedFiles, handleAddImportantFiles,
        handleSelectAll, handleDeselectAll,
    } = useFileSelection({
        files: fetchedFiles, primaryHighlightedPath: primaryHighlightedPathFromHook, 
        secondaryHighlightedPaths: secondaryHighlightedPathsFromHook, importantFiles, 
        imageReplaceTaskActive: !!imageReplaceTask,
    });
    logger.debug("[RepoTxtFetcher] After useFileSelection Hook");

    logger.debug("[RepoTxtFetcher] Before useKworkInput Hook");
    const kworkInputHandler = useKworkInput({ 
        selectedFetcherFiles, allFetchedFiles, imageReplaceTaskActive: !!imageReplaceTask,
        files: fetchedFiles, 
    });
    const { 
        handleAddSelected, handleCopyToClipboard, handleClearAll, handleAddFullTree, 
    } = kworkInputHandler;
    logger.debug("[RepoTxtFetcher] After useKworkInput Hook");

    // === Effects ===
    useEffect(() => {
        logger.debug(`[TRIM_DEBUG RepoTxtFetcher useEffect idea/path] START. ideaProp: "${ideaProp}", type: ${typeof ideaProp}. highlightedPathProp: "${highlightedPathProp}"`);
        
        const ideaToProcess = (typeof ideaProp === 'string' && ideaProp !== 'null') ? ideaProp : null;
        logger.debug(`[TRIM_DEBUG RepoTxtFetcher useEffect idea/path] ideaToProcess: "${ideaToProcess ? ideaToProcess.substring(0,50) : ideaToProcess}", type: ${typeof ideaToProcess}`);

        if (ideaToProcess && !ideaToProcess.startsWith('ImageReplace|')) {
            logger.info(`[RepoTxtFetcher useEffect idea/path] NORMAL idea detected. Setting KWork via context with: "${ideaToProcess.substring(0,30)}..."`);
            setKworkInputValue(ideaToProcess); 

            if (highlightedPathProp) {
                logger.info(`[RepoTxtFetcher useEffect idea/path] NORMAL idea WITH path: "${highlightedPathProp}". Triggering fetch for initial selection.`);
                handleFetchManual(false, null); 
            }
        } else if (ideaToProcess && ideaToProcess.startsWith('ImageReplace|')) {
             logger.info(`[RepoTxtFetcher useEffect idea/path] ImageReplace idea detected. Primary handling in ActualPageContent or context. ideaProp: "${ideaToProcess.substring(0,50)}"`);
        } else if (ideaProp === 'null' && !imageReplaceTask) { 
             logger.info(`[RepoTxtFetcher useEffect idea/path] ideaProp is string "null". Clearing KWork via context.`);
             setKworkInputValue(""); 
        } else if (ideaProp === null && !imageReplaceTask) { 
            logger.info(`[RepoTxtFetcher useEffect idea/path] ideaProp is actual null. Clearing KWork via context.`);
            setKworkInputValue(""); 
        } else if (!ideaToProcess && highlightedPathProp && !imageReplaceTask) { 
            logger.info(`[RepoTxtFetcher useEffect idea/path] Path prop ONLY: "${highlightedPathProp}". Triggering fetch for initial selection.`);
            handleFetchManual(false, null);
        }
        logger.debug(`[TRIM_DEBUG RepoTxtFetcher useEffect idea/path] END.`);
    }, [ideaProp, highlightedPathProp, imageReplaceTask, setKworkInputValue, handleFetchManual, logger]);

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

        if (primaryHighlightedPathFromHook) { 
             logger.debug(`[Effect Scroll] Found primary highlight ${primaryHighlightedPathFromHook}, scheduling scroll.`);
             const timer = setTimeout(() => {
                 cleanupScroll = scrollToFile(primaryHighlightedPathFromHook);
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
    }, [fetchStatus, primaryHighlightedPathFromHook, imageReplaceTask, autoFetch, fetchedFiles.length, scrollToSection, toastInfo, logger]); 

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

    logger.debug("[RepoTxtFetcher] Before useImperativeHandle");
    useImperativeHandle(ref, () => ({
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null, pathForInitialSelect?: string | null) => {
            logger.debug(`[Imperative] handleFetch called. pathForInitialSelect: ${pathForInitialSelect}`);
            return handleFetchManual(isManualRetry, branchNameToFetchOverride);
        },
        selectHighlightedFiles: () => {
             logger.debug(`[Imperative] selectHighlightedFiles called.`);
             selectHighlightedFiles();
        },
        handleAddSelected: (filesToAdd: Set<string>, allFiles: FileNode[]) => {
            logger.debug(`[Imperative] handleAddSelected called.`);
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
             const val = kworkInputValue ?? ''; 
             logger.debug(`[Imperative TRIM_DEBUG] getKworkInputValue called, returning context value (ensured string): "${val.substring(0,50)}"`);
             return val; 
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
        setKworkInputValue: (value: string) => { 
            logger.debug(`[Imperative] setKworkInputValue called with: "${value.substring(0,30)}..."`);
            setKworkInputValue(value); 
        }
    }), [
        handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll,
        kworkInputValue, 
        setKworkInputValue, 
        imageReplaceTask, handleAddImportantFiles, handleAddFullTree, handleSelectAll, handleDeselectAll, logger 
    ]);
    logger.debug("[RepoTxtFetcher] After useImperativeHandle");

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

    logger.debug("[RepoTxtFetcher] Calculate Derived State");
    const currentImageTask = imageReplaceTask;
    const showProgressBar = fetchStatus !== 'idle';
    const calculatedIsActionDisabled = isFetchLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!currentImageTask;
    
    logger.debug(`[TRIM_DEBUG RepoTxtFetcher Render] Before kworkValueForCheck: kworkInputValue type: ${typeof kworkInputValue}, value: "${String(kworkInputValue).substring(0,50)}"`);
    const kworkValueForCheck = kworkInputValue ?? ''; 
    logger.debug(`[TRIM_DEBUG RepoTxtFetcher Render] Before hasContent: kworkValueForCheck type: ${typeof kworkValueForCheck}, value: "${kworkValueForCheck.substring(0,50)}"`);
    const hasContent = kworkValueForCheck.trim().length > 0;
    
    const isCopyDisabled = !hasContent || calculatedIsActionDisabled;
    const isClearDisabled = (!hasContent && selectedFetcherFiles.size === 0 && !filesFetched) || calculatedIsActionDisabled;
    const isAddSelectedDisabledFromLocal = selectedFetcherFiles.size === 0 || calculatedIsActionDisabled; 

    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const imageTaskTargetFileReady = currentImageTask && fetchStatus === 'success' && fetchedFiles.some(f => f.path === currentImageTask.targetPath);
    logger.debug(`[Render State] calculatedIsActionDisabled=${calculatedIsActionDisabled}, isFetchLoadingFromHook=${isFetchLoading}, showProgressBar=${showProgressBar}, hasContent=${hasContent}`);

    logger.debug("[RepoTxtFetcher] Preparing to render JSX...");
    try {
        return (
          <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
             <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
                  <div>
                     <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                        {currentImageTask ? <FaImages className="text-blue-400" /> : <FaDownload className="text-purple-400" />}
                        {currentImageTask ? "Задача: Замена Картинки" : "Кибер-Экстрактор Кода"}
                     </h2>
                      {!currentImageTask && (
                         <div className="text-yellow-300/80 text-xs md:text-sm space-y-1 mb-2">
                            <VibeContentRenderer content={"1. Настрой <FaCodeBranch title='Настройки' class='inline text-cyan-400'/>."} />
                            <VibeContentRenderer content={"2. Жми <span class='font-bold text-purple-400 mx-1'>\"Извлечь файлы\"</span>."} />
                            <VibeContentRenderer content={"3. Выбери файлы или <span class='font-bold text-teal-400 mx-1'>связанные</span> / <span class='font-bold text-orange-400 mx-1'>важные</span>."} />
                            <VibeContentRenderer content={"4. Опиши задачу ИЛИ добавь файлы <FaPlus title='Добавить выбранные в запрос' class='inline text-sm'/> / все <FaTree title='Добавить все файлы в запрос' class='inline text-sm'/>."} />
                            <VibeContentRenderer content={"5. Скопируй <FaCopy title='Скопировать запрос' class='inline text-sm mx-px'/> или передай дальше."} />
                        </div>
                      )}
                      {currentImageTask && (
                          <p className="text-blue-300/80 text-xs md:text-sm mb-2">
                              Авто-загрузка файла для замены: <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">{currentImageTask.targetPath}</code>...
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
                      className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"
                  >
                      {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaCodeBranch className="text-cyan-400 text-xl" />}
                  </motion.button>
              </div>

             <SettingsModal
                  isOpen={isSettingsModalOpen}
                  repoUrl={repoUrl}
                  setRepoUrl={handleRepoUrlChange}
                  token={githubToken} // Use githubToken from context
                  setToken={setGithubToken} // Use setGithubToken from context
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
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${isFetchDisabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`}
                      whileHover={{ scale: isFetchDisabled ? 1 : 1.03 }}
                      whileTap={{ scale: isFetchDisabled ? 1 : 0.97 }}
                      title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}${currentImageTask ? ' (для задачи замены картинки)' : ''}`}
                  >
                       {isFetchLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : currentImageTask ? <FaImages /> : <FaDownload />)}
                       {fetchStatus === 'retrying' ? "Повтор запроса..." : isFetchLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : currentImageTask ? "Загрузить файл" : "Извлечь файлы")}
                       <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
                  </motion.button>
              </div>

             {showProgressBar && (
                  <div className="mb-4 min-h-[40px]">
                      <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                      {isFetchLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? `(Попытка ${retryCount + 1}/${hookMaxRetries})` : ''}</p>}
                      {isParsing && !currentImageTask && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                      {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length > 0 && (
                         <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                             <FaCircleCheck /> {`Успешно ${fetchedFiles.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`}
                         </div>
                       )}
                       {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length === 0 && (
                          <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1">
                              <FaCircleCheck /> {`Завершено успешно, но 0 файлов найдено в ветке '${effectiveBranchDisplay}'.`}
                          </div>
                       )}
                       {imageTaskTargetFileReady && (
                          <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                              <FaCircleCheck /> {`Файл ${currentImageTask?.targetPath.split('/').pop()} загружен и готов.`}
                          </div>
                        )}
                        {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && fetchErrorHook && ( 
                           <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1">
                               <FaXmark /> {fetchErrorHook}
                               {fetchStatus === 'error' && retryCount < hookMaxRetries && ` (Попытка ${retryCount + 1}/${hookMaxRetries})`}
                               {fetchStatus === 'failed_retries' && ` (Достигнуто макс. попыток: ${hookMaxRetries})`}
                           </div>
                        )}
                        {isWaitingForAiResponse && !currentImageTask && (
                            <p className="text-blue-400 text-xs font-mono mt-1 text-center animate-pulse">
                                 ⏳ Ожидание ответа от AI... (ID Запроса: {currentAiRequestId?.substring(0, 6)}...)
                            </p>
                         )}
                  </div>
              )}

             <div className={`grid grid-cols-1 ${ (fetchedFiles.length > 0 && !currentImageTask) ? 'md:grid-cols-2' : ''} gap-4 md:gap-6`}>
                 {!currentImageTask && (isFetchLoading || fetchedFiles.length > 0) && (
                     <div className={`flex flex-col gap-4 ${ (fetchedFiles.length > 0 || (kworkInputValue ?? '').trim().length > 0) ? '' : 'md:col-span-2'}`}> 
                         <SelectedFilesPreview
                             selectedFiles={selectedFetcherFiles} 
                             allFiles={fetchedFiles} 
                             getLanguage={repoUtils.extractFileExtension} 
                         />
                         <FileList
                             id="file-list-container"
                             files={fetchedFiles}
                             selectedFiles={selectedFetcherFiles} 
                             primaryHighlightedPath={primaryHighlightedPathFromHook} 
                             secondaryHighlightedPaths={secondaryHighlightedPathsFromHook} 
                             importantFiles={importantFiles} 
                             isLoading={isFetchLoading}
                             isActionDisabled={calculatedIsActionDisabled}
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

                 {!currentImageTask && (fetchedFiles.length > 0 || (kworkInputValue ?? '').trim().length > 0) && (
                      <div id="kwork-input-section" className="flex flex-col gap-3">
                          {logger.debug(`[TRIM_DEBUG RepoTxtFetcher Render] Before RequestInput: kworkInputValue type: ${typeof kworkInputValue}, value: "${String(kworkInputValue).substring(0,50)}" `)}
                          <RequestInput
                              kworkInputRef={kworkInputRef} 
                              kworkInputValue={kworkInputValue ?? ''} 
                              onValueChange={setKworkInputValue} 
                              onCopyToClipboard={() => { logger.debug("[Input Action] Copy Click"); handleCopyToClipboard(undefined, true); }}
                              onClearAll={() => { logger.debug("[Input Action] Clear Click"); handleClearAll(); }}
                              onAddSelected={() => { logger.debug("[Input Action] AddSelected Click"); handleAddSelected(); }}
                              isAddSelectedDisabled={isAddSelectedDisabledFromLocal} 
                              selectedFetcherFilesCount={selectedFetcherFiles.size}
                              isActionDisabled={calculatedIsActionDisabled} 
                              filesFetched={filesFetched} 
                          />
                      </div>
                 )}

                 {currentImageTask && filesFetched && (
                      <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed ${imageTaskTargetFileReady ? 'border-blue-400' : (fetchStatus === 'error' || fetchStatus === 'failed_retries') ? 'border-red-500' : 'border-gray-600'} min-h-[200px]`}>
                          {isFetchLoading ? <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" />
                           : assistantLoading ? <FaSpinner className="text-purple-400 text-3xl mb-3 animate-spin" />
                           : imageTaskTargetFileReady ? <FaCircleCheck className="text-green-400 text-3xl mb-3" />
                           : <FaXmark className="text-red-500 text-3xl mb-3" /> }
                          <p className={`text-sm font-semibold ${imageTaskTargetFileReady ? 'text-blue-300' : 'text-red-400'}`}>
                              {isFetchLoading ? "Загрузка файла..."
                               : assistantLoading ? "Обработка Ассистентом..."
                               : imageTaskTargetFileReady ? `Файл ${currentImageTask?.targetPath.split('/').pop()} готов.`
                               : fetchStatus === 'error' || fetchStatus === 'failed_retries' ? `Ошибка загрузки файла ${currentImageTask?.targetPath.split('/').pop()}.`
                               : `Файл ${currentImageTask?.targetPath.split('/').pop()} не найден!`}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                               {isFetchLoading ? "Ожидание загрузки репозитория..."
                               : assistantLoading ? "Создание/обновление Pull Request..."
                               : imageTaskTargetFileReady ? "Файл передан Ассистенту для обработки."
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
    } finally {
        logger.log("[RepoTxtFetcher] END Render");
    }
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;