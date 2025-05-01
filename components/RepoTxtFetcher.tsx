"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaCodeBranch, FaPlus, FaSpinner, FaTree, FaImages
} from "react-icons/fa6"; // Keep only used icons
import { motion } from "framer-motion";

// --- Core & Context ---
import {
    useRepoXmlPageContext,
    RepoTxtFetcherRef, // Exported type for the ref
    // Types are now assumed to be exported from context:
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

// --- Sub-components (Assumed paths) ---
import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";


// --- Component Definition ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
    // === VIBE CHECK ===
    const { addToast, // Get toast function early
        // Retrieve other context values needed
        fetchStatus, filesFetched,
        repoUrl: repoUrlFromContext, setRepoUrl: setRepoUrlInContext, repoUrlEntered,
        selectedFetcherFiles,
        kworkInputHasContent, setKworkInputHasContent, kworkInputRef,
        loadingPrs,
        assistantLoading, isParsing, aiActionLoading,
        targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs,
        setLoadingPrs, triggerGetOpenPRs,
        isSettingsModalOpen, triggerToggleSettingsModal, scrollToSection,
        currentAiRequestId,
        imageReplaceTask,
        allFetchedFiles,
        assistantRef, updateRepoUrlInAssistant,
        getKworkInputValue, updateKworkInput
    } = useRepoXmlPageContext();
    addToast("[DEBUG] RepoTxtFetcher Function Start", 'info', 1000);
    // === VIBE CHECK END ===

    // === Basic Component State ===
    addToast("[DEBUG] Before RepoTxtFetcher useState", 'info', 1000);
    const [isMounted, setIsMounted] = useState(false);
    const [token, setToken] = useState<string>("");
    addToast("[DEBUG] After RepoTxtFetcher useState", 'info', 1000);

    // === Context (already destructured above) ===
    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext;

    // === URL Params & Derived State ===
    addToast("[DEBUG] Before RepoTxtFetcher URL Params/Memo", 'info', 1000);
    const searchParams = useSearchParams();
    const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
    const ideaFromUrl = useMemo(() => {
        const idea = searchParams.get("idea");
        return idea && !decodeURIComponent(idea).startsWith("ImageReplace|") ? decodeURIComponent(idea) : "";
    }, [searchParams]);
    const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
    const importantFiles = useMemo(() => [
        "contexts/AppContext.tsx", "contexts/RepoXmlPageContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx",
        "app/repo-xml/page.tsx", "components/RepoTxtFetcher.tsx", "components/AICodeAssistant.tsx", "components/AutomationBuddy.tsx",
        "components/repo/prompt.ts", "hooks/supabase.ts", "app/actions.ts", "app/actions_github/actions.ts",
        "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts",
    ], []);
    addToast("[DEBUG] After RepoTxtFetcher URL Params/Memo", 'info', 1000);

    // === Custom Hooks ===
    addToast("[DEBUG] Before useRepoFetcher Hook", 'info', 1000);
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
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        repoUrlEntered, assistantLoading, isParsing, aiActionLoading,
        loadingPrs, // Pass loadingPrs here
    });
    addToast("[DEBUG] After useRepoFetcher Hook", 'info', 1000);

    addToast("[DEBUG] Before useFileSelection Hook", 'info', 1000);
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
    addToast("[DEBUG] After useFileSelection Hook", 'info', 1000);

    addToast("[DEBUG] Before useKworkInput Hook", 'info', 1000);
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
    addToast("[DEBUG] After useKworkInput Hook", 'info', 1000);

    // === Effects ===
    useEffect(() => {
        addToast("[DEBUG] RepoTxtFetcher Mount Effect", 'info', 1000);
        setIsMounted(true);
    }, [addToast]); // Add addToast

    useEffect(() => {
        addToast("[DEBUG] RepoTxtFetcher URL Sync Effect Running", 'info', 1000);
        if (isMounted && assistantRef?.current?.updateRepoUrl) {
             addToast(`[DEBUG] Attempting assistantRef.updateRepoUrl. Type: ${typeof assistantRef.current.updateRepoUrl}`, 'info', 1000);
             updateRepoUrlInAssistant(repoUrl);
        } else if (isMounted) {
             addToast("[DEBUG] RepoTxtFetcher URL Sync Effect - assistantRef not ready", 'warning', 1000);
        }
    }, [isMounted, repoUrl, updateRepoUrlInAssistant, assistantRef, addToast]); // Add addToast

    useEffect(() => {
        addToast("[DEBUG] RepoTxtFetcher Scroll Effect Check", 'info', 1000);
        if (!isMounted || fetchStatus !== 'success' || !!imageReplaceTask || autoFetch) {
             addToast("[DEBUG] RepoTxtFetcher Scroll Effect - SKIPPED", 'info', 1000);
             return;
        }
        const scrollToFile = (path: string, block: ScrollLogicalPosition = "center") => {
            addToast(`[DEBUG] scrollToFile called for ${path}. Typeof getElementById: ${typeof document?.getElementById}`, 'info', 1000);
             const el = document.getElementById(`file-${path}`);
             if (el) {
                 logger.log(`Scrolling to file: ${path}`);
                 el.scrollIntoView({ behavior: "smooth", block: block });
                 el.classList.add('highlight-scroll');
                 const removeClassTimer = setTimeout(() => {
                     el.classList.remove('highlight-scroll');
                 }, 2500);
                 return () => clearTimeout(removeClassTimer);
             } else { addToast(`[DEBUG] scrollToFile: Element not found for ${path}`, 'warning', 1000); }
             return () => {};
        };
        let cleanupScroll = () => {};
        if (primaryHighlightedPath) {
             addToast(`[DEBUG] Scroll Effect: Found primary highlight ${primaryHighlightedPath}`, 'info', 1000);
             const timer = setTimeout(() => {
                 cleanupScroll = scrollToFile(primaryHighlightedPath);
             }, 300);
             return () => { clearTimeout(timer); cleanupScroll(); };
        } else if (fetchedFiles.length > 0) {
             addToast("[DEBUG] Scroll Effect: No primary, scrolling to container", 'info', 1000);
             logger.log("Scrolling to file list container");
             scrollToSection('file-list-container');
        }
    }, [isMounted, fetchStatus, primaryHighlightedPath, imageReplaceTask, autoFetch, fetchedFiles, scrollToSection, logger, addToast]); // Add addToast

    // === Imperative Handle ===
    addToast("[DEBUG] Before RepoTxtFetcher useImperativeHandle", 'info', 1000);
    useImperativeHandle(ref, () => ({
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => {
            addToast(`[DEBUG] Imperative handleFetch called. Type: ${typeof handleFetchManual}`, 'info', 1000);
            return handleFetchManual(isManualRetry, branchNameToFetchOverride, taskForEarlyCheck || imageReplaceTask);
        },
        selectHighlightedFiles: () => {
             addToast(`[DEBUG] Imperative selectHighlightedFiles called. Type: ${typeof selectHighlightedFiles}`, 'info', 1000);
             selectHighlightedFiles();
        },
        handleAddSelected: (filesToAdd: Set<string>, allFiles: FileNode[]) => { // Modify if Kwork hook exposes differently
            addToast(`[DEBUG] Imperative handleAddSelected called. Type: ${typeof handleAddSelected}`, 'info', 1000);
            // The handleAddSelected from useKworkInput doesn't take args, it uses context
            handleAddSelected(); // Call the hook's handler
            return Promise.resolve(); // Return promise to match old signature if needed
        },
        handleCopyToClipboard: (text?: string, scroll?: boolean) => {
             addToast(`[DEBUG] Imperative handleCopyToClipboard called. Type: ${typeof handleCopyToClipboard}`, 'info', 1000);
             return handleCopyToClipboard(text, scroll);
        },
        clearAll: () => {
             addToast(`[DEBUG] Imperative clearAll called. Type: ${typeof handleClearAll}`, 'info', 1000);
             handleClearAll();
        },
        getKworkInputValue: () => {
             addToast(`[DEBUG] Imperative getKworkInputValue called. Type: ${typeof getKworkInputValue}`, 'info', 1000);
             return getKworkInputValue();
        },
        // Add new handlers if needed by consumers
        handleAddImportantFiles: () => {
             addToast(`[DEBUG] Imperative handleAddImportantFiles called. Type: ${typeof handleAddImportantFiles}`, 'info', 1000);
             handleAddImportantFiles();
        },
        handleAddFullTree: () => {
             addToast(`[DEBUG] Imperative handleAddFullTree called. Type: ${typeof handleAddFullTree}`, 'info', 1000);
             handleAddFullTree();
        },
        selectAllFiles: () => {
             addToast(`[DEBUG] Imperative selectAllFiles called. Type: ${typeof handleSelectAll}`, 'info', 1000);
             handleSelectAll();
        },
        deselectAllFiles: () => {
            addToast(`[DEBUG] Imperative deselectAllFiles called. Type: ${typeof handleDeselectAll}`, 'info', 1000);
            handleDeselectAll();
        },

    }), [
        handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll,
        getKworkInputValue, imageReplaceTask, handleAddImportantFiles, handleAddFullTree, handleSelectAll, handleDeselectAll, addToast // Add addToast
    ]);
    addToast("[DEBUG] After RepoTxtFetcher useImperativeHandle", 'info', 1000);

    // --- Local Event Handlers (defined using useCallback) ---
     const handleManualBranchChange = useCallback((branch: string) => {
          addToast(`[DEBUG] handleManualBranchChange called. Branch: ${branch}. Type setManualBranchName: ${typeof setManualBranchName}`, 'info', 1000);
          setManualBranchName(branch);
          if (targetBranchName) {
            addToast(`[DEBUG] Clearing targetBranchName. Type setTargetBranchName: ${typeof setTargetBranchName}`, 'info', 1000);
            setTargetBranchName(null);
          }
     }, [setManualBranchName, targetBranchName, setTargetBranchName, addToast]); // Add addToast

      const handleSelectPrBranch = useCallback((branch: string | null) => {
          addToast(`[DEBUG] handleSelectPrBranch called. Branch: ${branch}. Type setTargetBranchName: ${typeof setTargetBranchName}`, 'info', 1000);
          setTargetBranchName(branch);
          if (branch) {
              addToast(`[DEBUG] Clearing manualBranchName. Type setManualBranchName: ${typeof setManualBranchName}`, 'info', 1000);
              setManualBranchName("");
          }
      }, [setTargetBranchName, setManualBranchName, addToast]); // Add addToast

      const handleLoadPrs = useCallback(() => {
          addToast(`[DEBUG] handleLoadPrs called. Type triggerGetOpenPRs: ${typeof triggerGetOpenPRs}`, 'info', 1000);
          if (repoUrl) {
              triggerGetOpenPRs(repoUrl);
          } else {
              addToast("Введите URL репозитория для загрузки PR.", "error");
          }
      }, [repoUrl, triggerGetOpenPRs, addToast]); // Add addToast

    // === Early Return Check - MOVED HERE, AFTER ALL HOOKS ===
    if (!isMounted) {
        addToast("[DEBUG] RepoTxtFetcher Render: Early return (!isMounted)", 'info', 1000);
        // Return loading state only after all hooks above have been called
        return (
            <div id="extractor-loading" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 min-h-[300px] flex items-center justify-center">
                <p className="text-gray-400 text-lg animate-pulse flex items-center gap-2">
                    <FaSpinner className="animate-spin"/> Инициализация Экстрактора...
                </p>
            </div>
        );
    }

    // --- Derived States for Rendering (Calculated after isMounted check) ---
    addToast("[DEBUG] RepoTxtFetcher Calculate Derived State", 'info', 1000);
    const currentImageTask = imageReplaceTask;
    const showProgressBar = fetchStatus !== 'idle';
    const isActionDisabled = isFetchLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!currentImageTask;
    const isCopyDisabled = !kworkInputHasContent || isActionDisabled;
    const isClearDisabled = (!kworkInputHasContent && selectedFetcherFiles.size === 0 && !filesFetched) || isActionDisabled;
    const isAddSelectedDisabled = selectedFetcherFiles.size === 0 || isActionDisabled;
    const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const imageTaskTargetFileReady = currentImageTask && fetchStatus === 'success' && fetchedFiles.some(f => f.path === currentImageTask.targetPath);


    // --- FINAL RENDER of the actual component ---
    addToast("[DEBUG] RepoTxtFetcher Render: Returning JSX", 'info', 1000);
    return (
      <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
         {/* Header and Settings Toggle Button */}
         <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
              {/* Title and Instructions */}
              <div>
                 <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                    {currentImageTask ? <FaImages className="text-blue-400" /> : <FaDownload className="text-purple-400" />}
                    {currentImageTask ? "Задача: Замена Картинки" : "Кибер-Экстрактор Кода"}
                 </h2>
                 {/* Instructions */}
                  {!currentImageTask && (
                     <>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Настрой (<FaCodeBranch title="Настройки" className="inline text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}/>).</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Жми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы или <span className="font-bold text-teal-400 mx-1">связанные</span> / <span className="font-bold text-orange-400 mx-1">важные</span>.</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">4. Опиши задачу ИЛИ добавь файлы (<FaPlus title="Добавить выбранные в запрос" className="inline text-sm"/>) / все (<FaTree title="Добавить все файлы в запрос" className="inline text-sm"/>).</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Скопируй (<FaCopy title="Скопировать запрос" className="inline text-sm mx-px"/>) или передай дальше.</p>
                     </>
                  )}
                  {/* Image Task Info */}
                  {currentImageTask && (
                      <p className="text-blue-300/80 text-xs md:text-sm mb-2">
                          Авто-загрузка файла для замены: <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">{currentImageTask.targetPath}</code>...
                      </p>
                  )}
              </div>
              {/* Settings Toggle Button */}
              <motion.button
                  onClick={() => { addToast("[DEBUG] Settings Toggle Clicked", 'info', 1000); triggerToggleSettingsModal(); }}
                  disabled={isFetchLoading || assistantLoading || isParsing}
                  whileHover={{ scale: (isFetchLoading || assistantLoading || isParsing) ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                  whileTap={{ scale: (isFetchLoading || assistantLoading || isParsing) ? 1 : 0.95 }}
                  title={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                  aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                  aria-expanded={isSettingsModalOpen}
                  className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"
              >
                  {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />}
              </motion.button>
          </div>

         {/* Settings Modal */}
         {React.useMemo(() => { addToast("[DEBUG] Rendering SettingsModal", 'info', 1000); return null; }, [addToast])}
         <SettingsModal
              isOpen={isSettingsModalOpen}
              repoUrl={repoUrl}
              setRepoUrl={handleRepoUrlChange}
              token={token}
              setToken={setToken}
              manualBranchName={manualBranchName}
              setManualBranchName={handleManualBranchChange} // Use the useCallback version
              currentTargetBranch={targetBranchName} // Pass the effective target branch
              openPrs={openPrs}
              loadingPrs={loadingPrs}
              onSelectPrBranch={handleSelectPrBranch} // Use the useCallback version
              onLoadPrs={handleLoadPrs} // Use the useCallback version
              loading={isFetchLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing}
          />


         {/* Fetch Button */}
         <div className="mb-4 flex justify-center">
              <motion.button
                  onClick={() => { addToast("[DEBUG] Fetch Button Clicked", 'info', 1000); handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error', null, currentImageTask); }}
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

         {/* Progress Bar and Status Messages */}
         {showProgressBar && (
              <div className="mb-4 min-h-[40px]">
                  {React.useMemo(() => { addToast("[DEBUG] Rendering ProgressBar", 'info', 1000); return null; }, [addToast])}
                  <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                  {isFetchLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
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
                    {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && fetchError && (
                       <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1">
                           <FaXmark /> {fetchError}
                       </div>
                    )}
                    {isWaitingForAiResponse && !currentImageTask && (
                        <p className="text-blue-400 text-xs font-mono mt-1 text-center animate-pulse">
                             ⏳ Ожидание ответа от AI... (ID Запроса: {currentAiRequestId?.substring(0, 6)}...)
                        </p>
                     )}
              </div>
          )}

         {/* Main Content Area: File List / Kwork Input / Image Task Status */}
         <div className={`grid grid-cols-1 ${ (fetchedFiles.length > 0 && !currentImageTask) ? 'md:grid-cols-2' : ''} gap-4 md:gap-6`}>
             {/* --- Column 1: File List & Preview (Standard Mode) --- */}
             {!currentImageTask && (isFetchLoading || fetchedFiles.length > 0) && (
                 <div className={`flex flex-col gap-4 ${ (fetchedFiles.length > 0 || kworkInputHasContent) ? '' : 'md:col-span-2'}`}>
                     {React.useMemo(() => { addToast("[DEBUG] Rendering SelectedFilesPreview", 'info', 1000); return null; }, [addToast])}
                     <SelectedFilesPreview
                         selectedFiles={selectedFetcherFiles}
                         allFiles={fetchedFiles} // Use local fetchedFiles for preview
                         getLanguage={repoUtils.getLanguage}
                     />
                     {React.useMemo(() => { addToast("[DEBUG] Rendering FileList", 'info', 1000); return null; }, [addToast])}
                     <FileList
                         id="file-list-container"
                         files={fetchedFiles} // Use local fetchedFiles
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
                         onAddSelected={handleAddSelected} // Use kwork hook handler
                         onAddTree={handleAddFullTree} // Use kwork hook handler
                      />
                  </div>
             )}

             {/* --- Column 2: Kwork Input (Standard Mode) --- */}
             {!currentImageTask && (fetchedFiles.length > 0 || kworkInputHasContent) && (
                  <div id="kwork-input-section" className="flex flex-col gap-3">
                      {React.useMemo(() => { addToast("[DEBUG] Rendering RequestInput", 'info', 1000); return null; }, [addToast])}
                      <RequestInput
                          kworkInputRef={kworkInputRef}
                          onCopyToClipboard={() => { addToast("[DEBUG] RequestInput Copy Click", 'info', 1000); handleCopyToClipboard(undefined, true); }}
                          onClearAll={() => { addToast("[DEBUG] RequestInput Clear Click", 'info', 1000); handleClearAll(); }}
                          onAddSelected={() => { addToast("[DEBUG] RequestInput AddSelected Click", 'info', 1000); handleAddSelected(); }}
                          isCopyDisabled={isCopyDisabled}
                          isClearDisabled={isClearDisabled}
                          isAddSelectedDisabled={isAddSelectedDisabled}
                          selectedFetcherFilesCount={selectedFetcherFiles.size}
                          onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                      />
                  </div>
             )}

             {/* --- Status Display (Image Task Mode) --- */}
             {currentImageTask && filesFetched && (
                  <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed ${imageTaskTargetFileReady ? 'border-blue-400' : (fetchStatus === 'error' || fetchStatus === 'failed_retries') ? 'border-red-500' : 'border-gray-600'} min-h-[200px]`}>
                       {React.useMemo(() => { addToast("[DEBUG] Rendering Image Task Status Display", 'info', 1000); return null; }, [addToast])}
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
        </div> {/* End Grid */}
      </div> // End Extractor Root
    );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;