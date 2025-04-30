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
    // === ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS ===

    // === Basic Component State ===
    const [isMounted, setIsMounted] = useState(false);
    const [token, setToken] = useState<string>("");

    // === Context ===
    const {
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
        addToast, getKworkInputValue, updateKworkInput
    } = useRepoXmlPageContext();

    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext;

    // === URL Params & Derived State ===
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

    // === Custom Hooks ===
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

    // === Effects ===
    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (isMounted && assistantRef?.current?.updateRepoUrl) {
             logger.log("[RepoTxtFetcher URL Effect] Syncing assistant URL:", repoUrl);
             updateRepoUrlInAssistant(repoUrl);
        } else if (isMounted) {
             // logger.warn("[RepoTxtFetcher URL Effect] assistantRef not ready when URL changed.");
        }
    }, [isMounted, repoUrl, updateRepoUrlInAssistant, assistantRef]);

    useEffect(() => {
        if (!isMounted || fetchStatus !== 'success' || !!imageReplaceTask || autoFetch) {
             return;
        }
        const scrollToFile = (path: string, block: ScrollLogicalPosition = "center") => {
             const el = document.getElementById(`file-${path}`);
             if (el) {
                 logger.log(`Scrolling to file: ${path}`);
                 el.scrollIntoView({ behavior: "smooth", block: block });
                 el.classList.add('highlight-scroll');
                 const removeClassTimer = setTimeout(() => {
                     el.classList.remove('highlight-scroll');
                 }, 2500);
                 return () => clearTimeout(removeClassTimer);
             }
             return () => {};
        };
        let cleanupScroll = () => {};
        if (primaryHighlightedPath) {
             const timer = setTimeout(() => {
                 cleanupScroll = scrollToFile(primaryHighlightedPath);
             }, 300);
             return () => { clearTimeout(timer); cleanupScroll(); };
        } else if (fetchedFiles.length > 0) {
             logger.log("Scrolling to file list container");
             scrollToSection('file-list-container');
        }
    }, [isMounted, fetchStatus, primaryHighlightedPath, imageReplaceTask, autoFetch, fetchedFiles, scrollToSection, logger]);

    // === Imperative Handle ===
    useImperativeHandle(ref, () => ({
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) =>
            handleFetchManual(isManualRetry, branchNameToFetchOverride, taskForEarlyCheck || imageReplaceTask),
        selectHighlightedFiles,
        handleAddSelected: handleAddSelected,
        handleCopyToClipboard,
        clearAll: handleClearAll,
        getKworkInputValue: getKworkInputValue
    }), [
        handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll,
        getKworkInputValue, imageReplaceTask
    ]);

    // --- Local Event Handlers (defined using useCallback) ---
     const handleManualBranchChange = useCallback((branch: string) => {
          setManualBranchName(branch);
          if (targetBranchName) {
            setTargetBranchName(null);
          }
     }, [setManualBranchName, targetBranchName, setTargetBranchName]);

      const handleSelectPrBranch = useCallback((branch: string | null) => {
          setTargetBranchName(branch);
          if (branch) {
              setManualBranchName("");
          }
          // Optional: trigger fetch?
      }, [setTargetBranchName, setManualBranchName]);

      const handleLoadPrs = useCallback(() => {
          if (repoUrl) {
              triggerGetOpenPRs(repoUrl);
          } else {
              addToast("Введите URL репозитория для загрузки PR.", "error");
          }
      }, [repoUrl, triggerGetOpenPRs, addToast]);

    // === Early Return Check - MOVED HERE, AFTER ALL HOOKS ===
    if (!isMounted) {
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
                  onClick={triggerToggleSettingsModal}
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
         <SettingsModal
              isOpen={isSettingsModalOpen}
              repoUrl={repoUrl}
              setRepoUrl={handleRepoUrlChange}
              token={token}
              setToken={setToken}
              manualBranchName={manualBranchName}
              setManualBranchName={handleManualBranchChange} // Use the useCallback version
              currentTargetBranch={targetBranchName}
              openPrs={openPrs}
              loadingPrs={loadingPrs}
              onSelectPrBranch={handleSelectPrBranch} // Use the useCallback version
              onLoadPrs={handleLoadPrs} // Use the useCallback version
              loading={isFetchLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing}
          />

         {/* Fetch Button */}
         <div className="mb-4 flex justify-center">
              <motion.button
                  onClick={() => { handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error', null, currentImageTask); }}
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
                         onAddSelected={handleAddSelected} // Use kwork hook handler
                         onAddTree={handleAddFullTree} // Use kwork hook handler
                      />
                  </div>
             )}

             {/* --- Column 2: Kwork Input (Standard Mode) --- */}
             {!currentImageTask && (fetchedFiles.length > 0 || kworkInputHasContent) && (
                  <div id="kwork-input-section" className="flex flex-col gap-3">
                      <RequestInput
                          kworkInputRef={kworkInputRef}
                          onCopyToClipboard={() => handleCopyToClipboard(undefined, true)} // Use kwork hook handler
                          onClearAll={handleClearAll} // Use kwork hook handler
                          onAddSelected={handleAddSelected} // Use kwork hook handler
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