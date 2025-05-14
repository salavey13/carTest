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
    ideaProp: string | null; // Will be used to initialize kworkInputValue via context if provided
}

// --- Component Definition ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, RepoTxtFetcherProps>(({
    highlightedPathProp,
    ideaProp 
}, ref) => {
    logger.log("[RepoTxtFetcher] START Render");

    const { 
        fetchStatus, setFetchStatus, 
        filesFetched,
        repoUrl: repoUrlFromContext, setRepoUrl: setRepoUrlInContext, repoUrlEntered,
        selectedFetcherFiles,
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
        allFetchedFiles,
        assistantRef, updateRepoUrlInAssistant,
        urlPathToHighlight: urlPathToHighlightFromContext, // Read context value for path highlight
    } = useRepoXmlPageContext();
    const { error: toastError, info: toastInfo } = useAppToast();
    logger.debug("[RepoTxtFetcher] Function Start");

    const [token, setToken] = useState<string>("");
    const [prevEffectiveBranch, setPrevEffectiveBranch] = useState<string | null>(null);
    logger.debug("[RepoTxtFetcher] After useState");

    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext;

    // Use prop if passed, otherwise use context value (which is set from URL params)
    const highlightedPathForHook = highlightedPathProp ?? urlPathToHighlightFromContext ?? "";
    // Use prop if passed to initialize, otherwise use context kworkInputValue
    // Note: ideaProp is for initial setup; kworkInputValue is the live state
    const ideaForHook = ideaProp ?? kworkInputValue ?? ""; 
    logger.debug(`[RepoTxtFetcher] Effective props for hook: highlightedPathForHook='${highlightedPathForHook}', ideaForHook='${ideaForHook ? ideaForHook.substring(0,30)+'...' : null}'`);


    const autoFetch = useMemo(() =>
        !!imageReplaceTask ||
        (!!highlightedPathForHook || !!ideaForHook) // Use effective values
    , [imageReplaceTask, highlightedPathForHook, ideaForHook]);

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

    const effectiveBranchDisplay = useMemo(() => targetBranchName || manualBranchName || "default", [targetBranchName, manualBranchName]);

    logger.debug("[RepoTxtFetcher] Before useRepoFetcher Hook");
    const {
        files: fetchedFiles,
        progress,
        error: fetchError,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        handleFetchManual,
        isLoading: isFetchLoading, // This is now loadingLocal from the hook
        isFetchDisabled
    } = useRepoFetcher({
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl: highlightedPathForHook, // Pass effective value
        importantFiles, 
        autoFetch,
        ideaFromUrl: ideaForHook, // Pass effective value
        isSettingsModalOpen,
        repoUrlEntered, assistantLoading, isParsing, aiActionLoading,
        loadingPrs,
    });
    logger.debug(`[RepoTxtFetcher] After useRepoFetcher Hook. isFetchLoading (from hook, should be local): ${isFetchLoading}`);

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
        allFetchedFiles,
        imageReplaceTaskActive: !!imageReplaceTask,
        files: fetchedFiles, 
    });
    logger.debug("[RepoTxtFetcher] After useKworkInput Hook");

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

    logger.debug("[RepoTxtFetcher] Before useImperativeHandle");
    useImperativeHandle(ref, () => ({
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => {
            logger.debug(`[Imperative] handleFetch called.`);
            return handleFetchManual(isManualRetry, branchNameToFetchOverride); // Removed taskForEarlyCheck
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
    
    // Use isFetchLoading from useRepoFetcher (which is loadingLocal) for immediate UI updates
    // Combine with context statuses for overall action disabling
    const overallLoading = isFetchLoading || fetchStatus === 'loading' || fetchStatus === 'retrying' || loadingPrs || aiActionLoading || assistantLoading || isParsing;
    const isActionDisabledActual = overallLoading || !!currentImageTask;
    logger.debug(`[RepoTxtFetcher Derived State] isFetchLoading(local): ${isFetchLoading}, fetchStatus(ctx): ${fetchStatus}, overallLoading: ${overallLoading}, isActionDisabledActual: ${isActionDisabledActual}`);

    const showProgressBar = fetchStatus !== 'idle' || isFetchLoading; // Show if hook is loading OR context status indicates activity
    const kworkValueForCheck = kworkInputValue ?? ''; 
    const isCopyDisabled = !kworkValueForCheck.trim() || isActionDisabledActual;
    const isClearDisabled = (!kworkValueForCheck.trim() && selectedFetcherFiles.size === 0 && !filesFetched) || isActionDisabledActual;
    const isAddSelectedDisabledLocal = selectedFetcherFiles.size === 0 || isActionDisabledActual;
    
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const imageTaskTargetFileReady = currentImageTask && fetchStatus === 'success' && fetchedFiles.some(f => f.path === currentImageTask.targetPath);
    logger.debug(`[Render State] isActionDisabledActual=${isActionDisabledActual}, isFetchLoading(local)=${isFetchLoading}, showProgressBar=${showProgressBar}`);

    logger.debug("[RepoTxtFetcher] Preparing to render JSX...");

    try {
        return (
          <div id="extractor" className="w-full p-4 md:p-6 bg-card text-foreground font-mono rounded-xl shadow-[0_0_20px_hsl(var(--brand-green)/0.2)] border border-border relative overflow-hidden"> 
             <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
                  <div>
                     <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2 flex items-center gap-2"> 
                        {currentImageTask ? <FaImages className="text-brand-blue" /> : <FaDownload className="text-neon-lime" />}
                        <span className={currentImageTask ? "text-brand-blue" : "text-brand-purple"}>
                           {currentImageTask ? "Задача: Замена Картинки" : "Кибер-Экстрактор Кода"}
                        </span>
                     </h2>
                      {!currentImageTask && (
                         <div className="text-brand-yellow/80 text-xs md:text-sm space-y-1 mb-2 prose prose-invert prose-p:my-1 prose-strong:text-brand-purple prose-span:font-normal prose-a:text-brand-blue max-w-none"> 
                            <VibeContentRenderer content={"1. Настрой <FaCodeBranch title='Настройки' class='inline text-cyan-400'/>."} />
                            <VibeContentRenderer content={"2. Жми <strong class='text-purple-400 mx-1'>\"Извлечь файлы\"</strong>."} />
                            <VibeContentRenderer content={"3. Выбери файлы или <strong class='text-teal-400 mx-1'>связанные</strong> / <strong class='text-orange-400 mx-1'>важные</strong>."} />
                            <VibeContentRenderer content={"4. Опиши задачу ИЛИ добавь файлы <FaPlus title='Добавить выбранные в запрос' class='inline text-sm'/> / все <FaTree title='Добавить все файлы в запрос' class='inline text-sm'/>."} />
                            <VibeContentRenderer content={"5. Скопируй <FaCopy title='Скопировать запрос' class='inline text-sm mx-px'/> или передай дальше."} />
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
                      disabled={isFetchLoading || assistantLoading || isParsing} // Use local isFetchLoading
                      whileHover={{ scale: (isFetchLoading || assistantLoading || isParsing) ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                      whileTap={{ scale: (isFetchLoading || assistantLoading || isParsing) ? 1 : 0.95 }}
                      title={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                      aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                      aria-expanded={isSettingsModalOpen}
                      className="p-2 bg-muted/50 rounded-full hover:bg-muted/70 transition-colors flex-shrink-0 disabled:opacity-50" 
                  >
                      {isSettingsModalOpen ? <FaAngleUp className="text-brand-cyan text-xl" /> : <FaCodeBranch className="text-brand-cyan text-xl" />} 
                  </motion.button>
              </div>

             <SettingsModal
                  isOpen={isSettingsModalOpen}
                  repoUrl={repoUrl}
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
                  loading={overallLoading} // Pass combined loading state
              />

             <div className="mb-4 flex justify-center">
                  <motion.button
                      onClick={() => {
                          logger.info("[Click] Fetch Button Clicked");
                          handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error');
                       }}
                      disabled={isFetchDisabled} // isFetchDisabled from useRepoFetcher is now based on local loading + context states
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-primary-foreground bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-destructive to-orange-500 hover:from-destructive/90 hover:to-orange-600' : 'from-neon-lime to-brand-cyan'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${isFetchDisabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`} 
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
                      {isFetchLoading && <p className="text-brand-cyan text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>} 
                      {isParsing && !currentImageTask && <p className="text-brand-yellow text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>} 
                      {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length > 0 && (
                         <div className="text-center text-xs font-mono mt-1 text-brand-green flex items-center justify-center gap-1"> 
                             <FaCircleCheck /> {`Успешно ${fetchedFiles.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`}
                         </div>
                       )}
                       {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length === 0 && (
                          <div className="text-center text-xs font-mono mt-1 text-brand-yellow flex items-center justify-center gap-1"> 
                              <FaCircleCheck /> {`Завершено успешно, но 0 файлов найдено в ветке '${effectiveBranchDisplay}'.`}
                          </div>
                       )}
                       {imageTaskTargetFileReady && (
                          <div className="text-center text-xs font-mono mt-1 text-brand-green flex items-center justify-center gap-1"> 
                              <FaCircleCheck /> {`Файл ${currentImageTask?.targetPath.split('/').pop()} загружен и готов.`}
                          </div>
                        )}
                        {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && fetchError && (
                           <div className="text-center text-xs font-mono mt-1 text-destructive flex items-center justify-center gap-1"> 
                               <FaXmark /> {fetchError}
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
                 {!currentImageTask && (isFetchLoading || fetchedFiles.length > 0) && ( // Use local isFetchLoading
                     <div className={`flex flex-col gap-4 ${ (fetchedFiles.length > 0 || (kworkValueForCheck ?? '').trim().length > 0) ? '' : 'md:col-span-2'}`}> 
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
                             isLoading={isFetchLoading} // Use local isFetchLoading
                             isActionDisabled={isActionDisabledActual} // Use combined action disabled
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

                 {!currentImageTask && (fetchedFiles.length > 0 || (kworkValueForCheck ?? '').trim().length > 0) && (
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
                              isAddSelectedDisabled={isAddSelectedDisabledLocal} // Use local derived state
                              selectedFetcherFilesCount={selectedFetcherFiles.size}
                              filesFetched={filesFetched} 
                              isActionDisabled={isActionDisabledActual} // Use combined action disabled
                          />
                      </div>
                 )}

                 {currentImageTask && filesFetched && (
                      <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-card/30 rounded-lg border border-dashed ${imageTaskTargetFileReady ? 'border-brand-blue' : (fetchStatus === 'error' || fetchStatus === 'failed_retries') ? 'border-destructive' : 'border-muted'} min-h-[200px]`}> 
                          {isFetchLoading ? <FaSpinner className="text-brand-blue text-3xl mb-3 animate-spin" /> // Use local isFetchLoading
                           : assistantLoading ? <FaSpinner className="text-brand-purple text-3xl mb-3 animate-spin" />
                           : imageTaskTargetFileReady ? <FaCircleCheck className="text-brand-green text-3xl mb-3" />
                           : <FaXmark className="text-destructive text-3xl mb-3" /> }
                          <p className={`text-sm font-semibold ${imageTaskTargetFileReady ? 'text-brand-blue' : 'text-destructive'}`}> 
                              {isFetchLoading ? "Загрузка файла..." // Use local isFetchLoading
                               : assistantLoading ? "Обработка Ассистентом..."
                               : imageTaskTargetFileReady ? `Файл ${currentImageTask?.targetPath.split('/').pop()} готов.`
                               : fetchStatus === 'error' || fetchStatus === 'failed_retries' ? `Ошибка загрузки файла ${currentImageTask?.targetPath.split('/').pop()}.`
                               : `Файл ${currentImageTask?.targetPath.split('/').pop()} не найден!`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1"> 
                               {isFetchLoading ? "Ожидание загрузки репозитория..." // Use local isFetchLoading
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