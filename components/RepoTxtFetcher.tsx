"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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

// --- Sub-components (Assumed paths) ---
import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";


// --- Component Definition ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {

    // === Basic Component State ===
    // isMounted СТАНОВИТСЯ ПЕРВЫМ!
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []); // Пустой массив зависимостей, сработает один раз после монтирования

    // === Early Return Check - ПЕРЕМЕЩЕН В НАЧАЛО ===
    // Если компонент еще не смонтирован, показываем заглушку и НЕ ВЫЗЫВАЕМ остальные хуки
    if (!isMounted) {
        return (
            <div id="extractor-loading" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 min-h-[300px] flex items-center justify-center">
                <p className="text-gray-400 text-lg animate-pulse flex items-center gap-2">
                    <FaSpinner className="animate-spin"/> Инициализация Экстрактора...
                </p>
            </div>
        );
    }
    // === КОНЕЦ ПРОВЕРКИ isMounted ===

    // Теперь, когда мы уверены, что isMounted = true, можно вызывать остальные хуки:

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
    // logger.log("[DEBUG] RepoTxtFetcher Function Start (Post Mount)");
    // === VIBE CHECK END ===

    // === Остальные Basic Component State ===
    const [token, setToken] = useState<string>("");
    // logger.log("[DEBUG] After RepoTxtFetcher useState");

    // === Context (already destructured above) ===
    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext;

    // === URL Params & Derived State ===
    // logger.log("[DEBUG] Before RepoTxtFetcher URL Params/Memo");
    const searchParams = useSearchParams(); // <- Hook
    const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]); // <- Hook
    const ideaFromUrl = useMemo(() => { // <- Hook
        const idea = searchParams.get("idea");
        return idea && !decodeURIComponent(idea).startsWith("ImageReplace|") ? decodeURIComponent(idea) : "";
    }, [searchParams]);
    const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]); // <- Hook
    const importantFiles = useMemo(() => [ // <- Hook
        "contexts/AppContext.tsx", "contexts/RepoXmlPageContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx",
        "app/repo-xml/page.tsx", "components/RepoTxtFetcher.tsx", "components/AICodeAssistant.tsx", "components/AutomationBuddy.tsx",
        "components/repo/prompt.ts", "hooks/supabase.ts", "app/actions.ts", "app/actions_github/actions.ts",
        "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts",
    ], []);
    // logger.log("[DEBUG] After RepoTxtFetcher URL Params/Memo");

    // === Custom Hooks ===
    // logger.log("[DEBUG] Before useRepoFetcher Hook");
    const {
        files: fetchedFiles,
        progress,
        error: fetchError,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        handleFetchManual,
        isLoading: isFetchLoading,
        isFetchDisabled
    } = useRepoFetcher({ // <- Hook
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        repoUrlEntered, assistantLoading, isParsing, aiActionLoading,
        loadingPrs,
    });
    // logger.log("[DEBUG] After useRepoFetcher Hook");

    // logger.log("[DEBUG] Before useFileSelection Hook");
    const {
        toggleFileSelection,
        selectHighlightedFiles,
        handleAddImportantFiles,
        handleSelectAll,
        handleDeselectAll,
    } = useFileSelection({ // <- Hook
        files: fetchedFiles,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        importantFiles,
        imageReplaceTaskActive: !!imageReplaceTask,
    });
    // logger.log("[DEBUG] After useFileSelection Hook");

    // logger.log("[DEBUG] Before useKworkInput Hook");
    const {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
    } = useKworkInput({ // <- Hook
        selectedFetcherFiles,
        allFetchedFiles,
        imageReplaceTaskActive: !!imageReplaceTask,
        files: fetchedFiles,
    });
    // logger.log("[DEBUG] After useKworkInput Hook");

    // === Остальные Effects ===
    useEffect(() => { // <- Hook
        // logger.log("[DEBUG] RepoTxtFetcher URL Sync Effect Running");
        if (assistantRef?.current?.updateRepoUrl) {
             // logger.log(`[DEBUG] Attempting assistantRef.updateRepoUrl. Type: ${typeof assistantRef.current.updateRepoUrl}`);
             updateRepoUrlInAssistant(repoUrl);
        } else {
             logger.warn("[DEBUG] RepoTxtFetcher URL Sync Effect - assistantRef not ready");
        }
    }, [repoUrl, updateRepoUrlInAssistant, assistantRef]); // isMounted больше не нужен здесь

    useEffect(() => { // <- Hook
        // logger.log("[DEBUG] RepoTxtFetcher Scroll Effect Check");
        // isMounted больше не нужен здесь, т.к. эффект сработает только после монтирования
        if (fetchStatus !== 'success' || !!imageReplaceTask || autoFetch) {
             // logger.log("[DEBUG] RepoTxtFetcher Scroll Effect - SKIPPED");
             return;
        }
        const scrollToFile = (path: string, block: ScrollLogicalPosition = "center") => {
            // logger.log(`[DEBUG] scrollToFile called for ${path}. Typeof getElementById: ${typeof document?.getElementById}`);
             const el = document.getElementById(`file-${path}`);
             if (el) {
                 logger.log(`Scrolling to file: ${path}`);
                 el.scrollIntoView({ behavior: "smooth", block: block });
                 el.classList.add('highlight-scroll');
                 const removeClassTimer = setTimeout(() => {
                     el.classList.remove('highlight-scroll');
                 }, 2500);
                 return () => clearTimeout(removeClassTimer);
             } else { logger.warn(`[DEBUG] scrollToFile: Element not found for ${path}`); }
             return () => {};
        };
        let cleanupScroll = () => {};
        if (primaryHighlightedPath) {
             // logger.log(`[DEBUG] Scroll Effect: Found primary highlight ${primaryHighlightedPath}`);
             const timer = setTimeout(() => {
                 cleanupScroll = scrollToFile(primaryHighlightedPath);
             }, 300);
             return () => { clearTimeout(timer); cleanupScroll(); };
        } else if (fetchedFiles.length > 0) {
             // logger.log("[DEBUG] Scroll Effect: No primary, scrolling to container");
             logger.log("Scrolling to file list container");
             scrollToSection('file-list-container');
        }
    }, [fetchStatus, primaryHighlightedPath, imageReplaceTask, autoFetch, fetchedFiles, scrollToSection]);

    // === Imperative Handle ===
    // logger.log("[DEBUG] Before RepoTxtFetcher useImperativeHandle");
    useImperativeHandle(ref, () => ({ // <- Hook
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => {
            // logger.log(`[DEBUG] Imperative handleFetch called. Type: ${typeof handleFetchManual}`);
            return handleFetchManual(isManualRetry, branchNameToFetchOverride, taskForEarlyCheck || imageReplaceTask);
        },
        selectHighlightedFiles: () => {
             // logger.log(`[DEBUG] Imperative selectHighlightedFiles called. Type: ${typeof selectHighlightedFiles}`);
             selectHighlightedFiles();
        },
        handleAddSelected: (filesToAdd: Set<string>, allFiles: FileNode[]) => {
            // logger.log(`[DEBUG] Imperative handleAddSelected called. Type: ${typeof handleAddSelected}`);
            handleAddSelected();
            return Promise.resolve();
        },
        handleCopyToClipboard: (text?: string, scroll?: boolean) => {
             // logger.log(`[DEBUG] Imperative handleCopyToClipboard called. Type: ${typeof handleCopyToClipboard}`);
             return handleCopyToClipboard(text, scroll);
        },
        clearAll: () => {
             // logger.log(`[DEBUG] Imperative clearAll called. Type: ${typeof handleClearAll}`);
             handleClearAll();
        },
        getKworkInputValue: () => {
             // logger.log(`[DEBUG] Imperative getKworkInputValue called. Type: ${typeof getKworkInputValue}`);
             return getKworkInputValue();
        },
        handleAddImportantFiles: () => {
             // logger.log(`[DEBUG] Imperative handleAddImportantFiles called. Type: ${typeof handleAddImportantFiles}`);
             handleAddImportantFiles();
        },
        handleAddFullTree: () => {
             // logger.log(`[DEBUG] Imperative handleAddFullTree called. Type: ${typeof handleAddFullTree}`);
             handleAddFullTree();
        },
        selectAllFiles: () => {
             // logger.log(`[DEBUG] Imperative selectAllFiles called. Type: ${typeof handleSelectAll}`);
             handleSelectAll();
        },
        deselectAllFiles: () => {
            // logger.log(`[DEBUG] Imperative deselectAllFiles called. Type: ${typeof handleDeselectAll}`);
            handleDeselectAll();
        },

    }), [
        handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll,
        getKworkInputValue, imageReplaceTask, handleAddImportantFiles, handleAddFullTree, handleSelectAll, handleDeselectAll
    ]);
    // logger.log("[DEBUG] After RepoTxtFetcher useImperativeHandle");

    // --- Local Event Handlers (defined using useCallback) ---
     const handleManualBranchChange = useCallback((branch: string) => { // <- Hook
          // logger.log(`[DEBUG] handleManualBranchChange called. Branch: ${branch}. Type setManualBranchName: ${typeof setManualBranchName}`);
          setManualBranchName(branch);
          if (targetBranchName) {
            // logger.log(`[DEBUG] Clearing targetBranchName. Type setTargetBranchName: ${typeof setTargetBranchName}`);
            setTargetBranchName(null);
          }
     }, [setManualBranchName, targetBranchName, setTargetBranchName]);

      const handleSelectPrBranch = useCallback((branch: string | null) => { // <- Hook
          // logger.log(`[DEBUG] handleSelectPrBranch called. Branch: ${branch}. Type setTargetBranchName: ${typeof setTargetBranchName}`);
          setTargetBranchName(branch);
          if (branch) {
              // logger.log(`[DEBUG] Clearing manualBranchName. Type setManualBranchName: ${typeof setManualBranchName}`);
              setManualBranchName("");
          }
      }, [setTargetBranchName, setManualBranchName]);

      const handleLoadPrs = useCallback(() => { // <- Hook
          // logger.log(`[DEBUG] handleLoadPrs called. Type triggerGetOpenPRs: ${typeof triggerGetOpenPRs}`);
          if (repoUrl) {
              triggerGetOpenPRs(repoUrl);
          } else {
              addToast("Введите URL репозитория для загрузки PR.", "error");
          }
      }, [repoUrl, triggerGetOpenPRs, addToast]);

    // --- Derived States for Rendering ---
    // logger.log("[DEBUG] RepoTxtFetcher Calculate Derived State");
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
    // logger.log("[DEBUG] RepoTxtFetcher Render: Returning JSX");
    return (
      <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
         {/* ... остальной JSX без изменений ... */}
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
                  onClick={() => { logger.log("[DEBUG] Settings Toggle Clicked"); triggerToggleSettingsModal(); }}
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
              setManualBranchName={handleManualBranchChange}
              currentTargetBranch={targetBranchName}
              openPrs={openPrs}
              loadingPrs={loadingPrs}
              onSelectPrBranch={handleSelectPrBranch}
              onLoadPrs={handleLoadPrs}
              loading={isFetchLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing}
          />


         {/* Fetch Button */}
         <div className="mb-4 flex justify-center">
              <motion.button
                  onClick={() => { logger.log("[DEBUG] Fetch Button Clicked"); handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error', null, currentImageTask); }}
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
                         onAddSelected={handleAddSelected}
                         onAddTree={handleAddFullTree}
                      />
                  </div>
             )}

             {/* --- Column 2: Kwork Input (Standard Mode) --- */}
             {!currentImageTask && (fetchedFiles.length > 0 || kworkInputHasContent) && (
                  <div id="kwork-input-section" className="flex flex-col gap-3">
                      <RequestInput
                          kworkInputRef={kworkInputRef}
                          onCopyToClipboard={() => { logger.log("[DEBUG] RequestInput Copy Click"); handleCopyToClipboard(undefined, true); }}
                          onClearAll={() => { logger.log("[DEBUG] RequestInput Clear Click"); handleClearAll(); }}
                          onAddSelected={() => { logger.log("[DEBUG] RequestInput AddSelected Click"); handleAddSelected(); }}
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