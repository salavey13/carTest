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
    // === Basic Component State ===
    const [isMounted, setIsMounted] = useState(false);
    // Token remains local as it's directly used only by SettingsModal prop
    const [token, setToken] = useState<string>("");

    // === Context ===
    // Destructure all needed values from context
    const {
        // Fetch Status/Control (used for UI display)
        fetchStatus, filesFetched, // boolean flag indicating fetch attempt completed
        // Repo URL Management
        repoUrl: repoUrlFromContext, setRepoUrl: setRepoUrlInContext, repoUrlEntered,
        // Selection State (passed to hooks and sub-components)
        selectedFetcherFiles,
        // Kwork Input State/Ref (used for UI display & disabling logic)
        kworkInputHasContent, setKworkInputHasContent, kworkInputRef,
        // Loading/Blocking States (used for disabling UI elements)
        loadingPrs, // Destructure here
        assistantLoading, isParsing, aiActionLoading,
        // Branch/PR Management (passed to SettingsModal, used for display)
        targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs,
        setLoadingPrs, triggerGetOpenPRs, // Actions passed to SettingsModal
        // Modal/UI Control
        isSettingsModalOpen, triggerToggleSettingsModal, scrollToSection,
        // AI Interaction State (used for UI display)
        currentAiRequestId,
        // Task Specific
        imageReplaceTask,
        // Data (passed to hooks)
        allFetchedFiles, // Passed to useKworkInput
        // Refs/Actions (for effects)
        assistantRef, updateRepoUrlInAssistant,
        // Helpers from Context
        addToast, getKworkInputValue, updateKworkInput
    } = useRepoXmlPageContext();

    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext; // Use context setter directly

    // === URL Params & Derived State ===
    const searchParams = useSearchParams();
    const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
    const ideaFromUrl = useMemo(() => {
        const idea = searchParams.get("idea");
        // Decode idea, return only if it doesn't start with the image replace prefix
        return idea && !decodeURIComponent(idea).startsWith("ImageReplace|") ? decodeURIComponent(idea) : "";
    }, [searchParams]);
    // Determine if auto-fetch should be triggered based on URL params or active image task
    const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
    // Define important files list (consider moving to a constants file)
    const importantFiles = useMemo(() => [
        "contexts/AppContext.tsx", "contexts/RepoXmlPageContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx",
        "app/repo-xml/page.tsx", "components/RepoTxtFetcher.tsx", "components/AICodeAssistant.tsx", "components/AutomationBuddy.tsx",
        "components/repo/prompt.ts", "hooks/supabase.ts", "app/actions.ts", "app/actions_github/actions.ts",
        "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts",
    ], []);

    // === Custom Hooks ===
    // --- Fetcher Hook ---
    const {
        files: fetchedFiles, // Renamed from 'files' to avoid naming conflicts
        progress,
        error: fetchError, // Renamed from 'error'
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        handleFetchManual,
        isLoading: isFetchLoading, // Derived loading state from hook
        isFetchDisabled // Derived fetch button disabled state from hook
    } = useRepoFetcher({
        // Pass necessary state and props
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl, isSettingsModalOpen,
        repoUrlEntered, assistantLoading, isParsing, aiActionLoading,
        // Pass loadingPrs from context to the hook:
        loadingPrs, // Pass it here
    });

    // --- File Selection Hook ---
    const {
        toggleFileSelection,
        selectHighlightedFiles,
        handleAddImportantFiles,
        handleSelectAll,
        handleDeselectAll,
    } = useFileSelection({
        files: fetchedFiles, // Use the files state from useRepoFetcher
        primaryHighlightedPath, // Use highlight state from useRepoFetcher
        secondaryHighlightedPaths, // Use highlight state from useRepoFetcher
        importantFiles,
        imageReplaceTaskActive: !!imageReplaceTask,
    });

    // --- Kwork Input Hook ---
    const {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
    } = useKworkInput({
        selectedFetcherFiles, // Use selection state from context
        allFetchedFiles, // Use potentially broader file list from context
        imageReplaceTaskActive: !!imageReplaceTask,
        files: fetchedFiles, // Pass current files from fetcher hook for AddFullTree
    });


    // === Effects ===
    // Mount effect
    useEffect(() => { setIsMounted(true); }, []);

    // Effect to sync Assistant's repo URL when context URL changes
    useEffect(() => {
        if (isMounted && assistantRef?.current?.updateRepoUrl) {
             logger.log("[RepoTxtFetcher URL Effect] Syncing assistant URL:", repoUrl);
             updateRepoUrlInAssistant(repoUrl);
        } else if (isMounted) {
            // This might happen briefly on initial load, usually not an issue
            // logger.warn("[RepoTxtFetcher URL Effect] assistantRef not ready when URL changed.");
        }
    }, [isMounted, repoUrl, updateRepoUrlInAssistant, assistantRef]); // Simplified dependencies

    // Effect to scroll to highlighted file after successful fetch
    useEffect(() => {
        // Conditions to execute scroll: mounted, fetch succeeded, not image task, not auto-fetch
        if (!isMounted || fetchStatus !== 'success' || !!imageReplaceTask || autoFetch) {
             return;
        }

        // Helper function for scrolling and highlighting
        const scrollToFile = (path: string, block: ScrollLogicalPosition = "center") => {
             const el = document.getElementById(`file-${path}`);
             if (el) {
                 logger.log(`Scrolling to file: ${path}`);
                 el.scrollIntoView({ behavior: "smooth", block: block });
                 el.classList.add('highlight-scroll'); // Add highlight class
                 // Set timeout to remove the class after animation
                 const removeClassTimer = setTimeout(() => {
                     el.classList.remove('highlight-scroll');
                 }, 2500); // Match duration of highlight effect
                 // Return cleanup function for the timer
                 return () => clearTimeout(removeClassTimer);
             }
             return () => {}; // Return no-op cleanup if element not found
        };

        let cleanupScroll = () => {}; // To store the cleanup function from scrollToFile

        if (primaryHighlightedPath) {
             // Delay slightly to ensure DOM update after fetch and state change
             const timer = setTimeout(() => {
                 cleanupScroll = scrollToFile(primaryHighlightedPath);
             }, 300); // Adjust delay if needed
             // Return cleanup for the main timeout and the scroll effect timer
             return () => {
                 clearTimeout(timer);
                 cleanupScroll();
             };
        } else if (fetchedFiles.length > 0) {
            // If fetch succeeded but no specific file to highlight, scroll to the list container
             logger.log("Scrolling to file list container");
             scrollToSection('file-list-container');
             // No specific cleanup needed for scrollToSection itself
        }
    }, [isMounted, fetchStatus, primaryHighlightedPath, imageReplaceTask, autoFetch, fetchedFiles, scrollToSection, logger]); // Dependencies for scroll effect


    // === Imperative Handle ===
    // Expose functions for parent components or external calls via the ref
    useImperativeHandle(ref, () => ({
        // Use functions returned by the hooks or context
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) =>
            handleFetchManual(isManualRetry, branchNameToFetchOverride, taskForEarlyCheck || imageReplaceTask),
        selectHighlightedFiles,
        handleAddSelected: handleAddSelected,
        handleCopyToClipboard,
        clearAll: handleClearAll,
        getKworkInputValue: getKworkInputValue
    }), [
        // Include all functions/values used in the returned object as dependencies
        handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll,
        getKworkInputValue, imageReplaceTask
    ]);

    // === Render Logic ===
    if (!isMounted) {
        // Basic loading state until component is mounted client-side
        return (
            <div id="extractor-loading" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 min-h-[300px] flex items-center justify-center">
                <p className="text-gray-400 text-lg animate-pulse flex items-center gap-2">
                    <FaSpinner className="animate-spin"/> Инициализация Экстрактора...
                </p>
            </div>
        );
    }

    // --- Derived States for Rendering ---
    const currentImageTask = imageReplaceTask; // Use context value directly
    const showProgressBar = fetchStatus !== 'idle';
    // Combined loading state for disabling various actions (uses loadingPrs from context)
    const isActionDisabled = isFetchLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!currentImageTask;
    const isCopyDisabled = !kworkInputHasContent || isActionDisabled; // Can't copy if input empty or actions blocked
    const isClearDisabled = (!kworkInputHasContent && selectedFetcherFiles.size === 0 && !filesFetched) || isActionDisabled; // Can't clear if nothing to clear or actions blocked
    const isAddSelectedDisabled = selectedFetcherFiles.size === 0 || isActionDisabled; // Can't add if nothing selected or actions blocked
    const effectiveBranchDisplay = targetBranchName || manualBranchName || "default"; // Display branch name
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId; // Specific state for AI waiting message

    // Check if the specific file needed for the image task exists in the *currently fetched* files list from the hook
    const imageTaskTargetFileReady = currentImageTask && fetchStatus === 'success' && fetchedFiles.some(f => f.path === currentImageTask.targetPath);

    // --- Local Event Handlers (mostly for SettingsModal) ---
     const handleManualBranchChange = useCallback((branch: string) => {
          setManualBranchName(branch);
          // If user types a manual branch, clear any PR-selected target branch
          if (targetBranchName) {
            setTargetBranchName(null);
          }
     }, [setManualBranchName, targetBranchName, setTargetBranchName]); // Added targetBranchName dep

      const handleSelectPrBranch = useCallback((branch: string | null) => {
          setTargetBranchName(branch); // Set the PR branch from context
          if (branch) {
              setManualBranchName(""); // Clear manual input if PR branch is selected
          }
          // Optional: Trigger fetch immediately after selecting PR branch?
          // handleFetchManual(false, branch, currentImageTask);
      }, [setTargetBranchName, setManualBranchName/*, handleFetchManual, currentImageTask */]); // Include fetch deps if auto-fetching on select

      const handleLoadPrs = useCallback(() => {
          if (repoUrl) {
              triggerGetOpenPRs(repoUrl); // Use context action
          } else {
              addToast("Введите URL репозитория для загрузки PR.", "error"); // Use error toast
          }
      }, [repoUrl, triggerGetOpenPRs, addToast]);


    // --- Render ---
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
                 {/* Instructions (Show only for standard mode) */}
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
                  // Disable button if fetching, assistant working, or parsing (uses states from context)
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
              repoUrl={repoUrl} // Context state
              setRepoUrl={handleRepoUrlChange} // Context setter
              token={token} // Local state
              setToken={setToken} // Local state setter
              manualBranchName={manualBranchName} // Context state
              setManualBranchName={handleManualBranchChange} // Local handler
              currentTargetBranch={targetBranchName} // Context state
              openPrs={openPrs} // Context state
              loadingPrs={loadingPrs} // Context state passed as prop
              onSelectPrBranch={handleSelectPrBranch} // Local handler
              onLoadPrs={handleLoadPrs} // Local handler
              // Combined loading state for disabling inputs in modal (uses loadingPrs from context)
              loading={isFetchLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing}
          />

         {/* Fetch Button */}
         <div className="mb-4 flex justify-center">
              <motion.button
                  // Trigger fetch using the function from useRepoFetcher hook
                  onClick={() => { handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error', null, currentImageTask); }}
                  // Use the disabled state directly from useRepoFetcher hook
                  disabled={isFetchDisabled}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${isFetchDisabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`}
                  whileHover={{ scale: isFetchDisabled ? 1 : 1.03 }}
                  whileTap={{ scale: isFetchDisabled ? 1 : 0.97 }}
                  title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}${currentImageTask ? ' (для задачи замены картинки)' : ''}`}
              >
                   {/* Show appropriate icon based on state */}
                   {isFetchLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : currentImageTask ? <FaImages /> : <FaDownload />)}
                   {/* Show appropriate text based on state */}
                   {fetchStatus === 'retrying' ? "Повтор запроса..." : isFetchLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : currentImageTask ? "Загрузить файл" : "Извлечь файлы")}
                   {/* Show branch name */}
                   <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
              </motion.button>
          </div>

         {/* Progress Bar and Status Messages */}
         {showProgressBar && (
              <div className="mb-4 min-h-[40px]"> {/* Min height to prevent layout jump */}
                  <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                  {/* Status messages based on context/hook states */}
                  {isFetchLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                  {isParsing && !currentImageTask && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                  {/* Success message for standard fetch */}
                  {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length > 0 && (
                     <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                         <FaCircleCheck /> {`Успешно ${fetchedFiles.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`}
                     </div>
                   )}
                   {/* Success message when no files found */}
                   {fetchStatus === 'success' && !currentImageTask && fetchedFiles.length === 0 && (
                      <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1">
                          <FaCircleCheck /> {`Завершено успешно, но 0 файлов найдено в ветке '${effectiveBranchDisplay}'.`}
                      </div>
                   )}
                   {/* Success message for image task file found */}
                   {imageTaskTargetFileReady && (
                      <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                          <FaCircleCheck /> {`Файл ${currentImageTask?.targetPath.split('/').pop()} загружен и готов.`}
                      </div>
                    )}
                    {/* Error message */}
                    {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && fetchError && (
                       <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1">
                           <FaXmark /> {fetchError}
                       </div>
                    )}
                    {/* Waiting for AI message */}
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
             {/* Show only if NOT image task AND (fetch is loading OR files have been fetched) */}
             {!currentImageTask && (isFetchLoading || fetchedFiles.length > 0) && (
                 <div className={`flex flex-col gap-4 ${ (fetchedFiles.length > 0 || kworkInputHasContent) ? '' : 'md:col-span-2'}`}> {/* Span full if no kwork input yet */}
                     {/* Selected Files Preview */}
                     <SelectedFilesPreview
                         selectedFiles={selectedFetcherFiles} // Context state
                         allFiles={fetchedFiles} // Files from fetcher hook
                         getLanguage={repoUtils.getLanguage} // Utility function
                     />
                     {/* File List Component */}
                     <FileList
                         id="file-list-container"
                         files={fetchedFiles} // Files from fetcher hook
                         selectedFiles={selectedFetcherFiles} // Context state
                         primaryHighlightedPath={primaryHighlightedPath} // From fetcher hook
                         secondaryHighlightedPaths={secondaryHighlightedPaths} // From fetcher hook
                         importantFiles={importantFiles} // From component constants
                         isLoading={isFetchLoading} // Loading state from fetcher hook
                         isActionDisabled={isActionDisabled} // Combined action disable state
                         // Pass selection handlers from useFileSelection hook
                         toggleFileSelection={toggleFileSelection}
                         onAddImportant={handleAddImportantFiles}
                         onSelectHighlighted={selectHighlightedFiles}
                         onSelectAll={handleSelectAll}
                         onDeselectAll={handleDeselectAll}
                         // Pass kwork-related handlers from useKworkInput hook
                         onAddSelected={handleAddSelected}
                         onAddTree={handleAddFullTree}
                      />
                  </div>
             )}

             {/* --- Column 2: Kwork Input (Standard Mode) --- */}
             {/* Show only if NOT image task AND (files have been fetched OR input already has content) */}
             {!currentImageTask && (fetchedFiles.length > 0 || kworkInputHasContent) && (
                  <div id="kwork-input-section" className="flex flex-col gap-3">
                      <RequestInput
                          kworkInputRef={kworkInputRef} // Context ref
                          // Pass handlers from useKworkInput hook
                          onCopyToClipboard={() => handleCopyToClipboard(undefined, true)}
                          onClearAll={handleClearAll}
                          onAddSelected={handleAddSelected}
                          // Pass derived disabled states
                          isCopyDisabled={isCopyDisabled}
                          isClearDisabled={isClearDisabled}
                          isAddSelectedDisabled={isAddSelectedDisabled}
                          // Pass selection count for display
                          selectedFetcherFilesCount={selectedFetcherFiles.size}
                          // Update context state directly on input change
                          onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                      />
                  </div>
             )}

             {/* --- Status Display (Image Task Mode) --- */}
             {/* Show only if image task is active AND a fetch attempt has been completed (filesFetched flag) */}
             {currentImageTask && filesFetched && (
                  <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed ${imageTaskTargetFileReady ? 'border-blue-400' : (fetchStatus === 'error' || fetchStatus === 'failed_retries') ? 'border-red-500' : 'border-gray-600'} min-h-[200px]`}>
                      {/* Icon based on current state */}
                      {isFetchLoading ? <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" />
                       : assistantLoading ? <FaSpinner className="text-purple-400 text-3xl mb-3 animate-spin" /> // Separate spinner for assistant processing
                       : imageTaskTargetFileReady ? <FaCircleCheck className="text-green-400 text-3xl mb-3" />
                       : <FaXmark className="text-red-500 text-3xl mb-3" /> /* Show X if fetch failed or file not found post-fetch */ }
                      {/* Status Text */}
                      <p className={`text-sm font-semibold ${imageTaskTargetFileReady ? 'text-blue-300' : 'text-red-400'}`}>
                          {isFetchLoading ? "Загрузка файла..."
                           : assistantLoading ? "Обработка Ассистентом..."
                           : imageTaskTargetFileReady ? `Файл ${currentImageTask?.targetPath.split('/').pop()} готов.`
                           : fetchStatus === 'error' || fetchStatus === 'failed_retries' ? `Ошибка загрузки файла ${currentImageTask?.targetPath.split('/').pop()}.`
                           : `Файл ${currentImageTask?.targetPath.split('/').pop()} не найден!`}
                      </p>
                      {/* Sub-text */}
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
RepoTxtFetcher.displayName = 'RepoTxtFetcher'; // Add display name for DevTools
export default RepoTxtFetcher;