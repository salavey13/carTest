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

interface RepoTxtFetcherProps {
    highlightedPathProp: string | null;
    ideaProp: string | null;
}

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
        handleSetFilesFetched, 
        assistantRef, updateRepoUrlInAssistant,
    } = useRepoXmlPageContext();
    const { error: toastError, info: toastInfo } = useAppToast();
    
    const [token, setToken] = useState<string>("");
    const [prevEffectiveBranch, setPrevEffectiveBranch] = useState<string | null>(null); 
    
    const repoUrl = repoUrlFromContext;
    const handleRepoUrlChange = setRepoUrlInContext;

    const highlightedPathFromUrl = highlightedPathProp ?? "";
    const ideaFromUrl = ideaProp ?? "";

    const autoFetch = useMemo(() =>
        !!imageReplaceTask ||
        (!!highlightedPathFromUrl || !!ideaFromUrl)
    , [imageReplaceTask, highlightedPathFromUrl, ideaFromUrl]);

    const importantFiles = useMemo(() => [
        "package.json", "app/layout.tsx", "tailwind.config.ts", "app/globals.css", "app/style-guide/page.tsx",       
        "contexts/AppContext.tsx", "hooks/useAppToast.ts", "hooks/supabase.ts", 
        "app/actions.ts", "lib/debugLogger.ts", "components/VibeContentRenderer.tsx",
        "components/Header.tsx", "types/database.types.ts",
    ].filter(Boolean), []); 
    const effectiveBranchDisplay = useMemo(() => targetBranchName || manualBranchName || "default", [targetBranchName, manualBranchName]);

    const {
        files: fetchedFilesFromHook, 
        progress,
        error: fetchError,
        primaryHighlightedPath,
        secondaryHighlightedPaths,
        handleFetchManual: originalHandleFetchManual, 
        isLoading: isFetchLoading,
        isFetchDisabled
    } = useRepoFetcher({
        repoUrl, token, targetBranchName, manualBranchName, imageReplaceTask,
        highlightedPathFromUrl, importantFiles, autoFetch, ideaFromUrl,
        isSettingsModalOpen, repoUrlEntered, assistantLoading, isParsing, aiActionLoading, loadingPrs,
    });

    const handleFetchManual = useCallback(async (isRetry?: boolean, branchNameToFetchOverride?: string | null) => {
        const result = await originalHandleFetchManual(isRetry, branchNameToFetchOverride);
        if (result.success && result.files) {
            handleSetFilesFetched(true, result.files, result.primaryHighlight, result.secondaryHighlights);
        } else if (!result.success) {
            handleSetFilesFetched(false, [], null, { component: [], context: [], hook: [], lib: [], other: [] });
        }
        return result;
    }, [originalHandleFetchManual, handleSetFilesFetched]);

    const {
        toggleFileSelection, selectHighlightedFiles, handleAddImportantFiles,
        handleSelectAll, handleDeselectAll,
    } = useFileSelection({
        files: fetchedFilesFromHook, primaryHighlightedPath, secondaryHighlightedPaths,
        importantFiles, imageReplaceTaskActive: !!imageReplaceTask,
    });

    const {
        handleAddSelected, handleCopyToClipboard, handleClearAll, handleAddFullTree,
    } = useKworkInput({
        selectedFetcherFiles, allFetchedFiles: fetchedFilesFromHook, 
        imageReplaceTaskActive: !!imageReplaceTask, files: fetchedFilesFromHook,
    });

    useEffect(() => {
        if (assistantRef?.current?.updateRepoUrl) {
             updateRepoUrlInAssistant(repoUrl);
        }
    }, [repoUrl, updateRepoUrlInAssistant, assistantRef]);

    useEffect(() => {
        if (fetchStatus !== 'success' || !!imageReplaceTask || autoFetch) return;
        let cleanupScroll = () => {}; 
        const scrollToFile = (path: string, block: ScrollLogicalPosition = "center") => {
             const el = document.getElementById(`file-${path}`);
             if (el) {
                 el.scrollIntoView({ behavior: "smooth", block: block });
                 el.classList.add('highlight-scroll');
                 const timer = setTimeout(() => el.classList.remove('highlight-scroll'), 2500);
                 return () => clearTimeout(timer); 
             }
             return () => {}; 
        };
        if (primaryHighlightedPath) {
             const timer = setTimeout(() => { cleanupScroll = scrollToFile(primaryHighlightedPath); }, 300);
             return () => { clearTimeout(timer); cleanupScroll(); };
        } else if (fetchedFilesFromHook.length > 0) {
             return scrollToSection('file-list-container') as (() => void) | undefined;
        }
        return () => {};
    }, [fetchStatus, primaryHighlightedPath, imageReplaceTask, autoFetch, fetchedFilesFromHook.length, scrollToSection, fetchedFilesFromHook]);

    useEffect(() => {
        if (prevEffectiveBranch && prevEffectiveBranch !== effectiveBranchDisplay) {
            if (fetchStatus === 'success' || (fetchStatus !== 'idle' && fetchStatus !== 'loading' && fetchStatus !== 'retrying')) {
                setFetchStatus('idle');
            }
        }
        setPrevEffectiveBranch(effectiveBranchDisplay);
    }, [effectiveBranchDisplay, fetchStatus, setFetchStatus, prevEffectiveBranch]);

    useImperativeHandle(ref, () => ({
        handleFetch: (isRetry, branch, task) => handleFetchManual(isRetry, branch),
        selectHighlightedFiles: () => selectHighlightedFiles(),
        handleAddSelected: () => { handleAddSelected(); return Promise.resolve(); },
        handleCopyToClipboard: (text, scroll) => handleCopyToClipboard(text, scroll),
        clearAll: () => handleClearAll(),
        getKworkInputValue: () => kworkInputValue,
        handleAddImportantFiles: () => handleAddImportantFiles(),
        handleAddFullTree: () => handleAddFullTree(),
        selectAllFiles: () => handleSelectAll(),
        deselectAllFiles: () => handleDeselectAll(),
    }), [
        handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll,
        kworkInputValue, imageReplaceTask, handleAddImportantFiles, handleAddFullTree, handleSelectAll, handleDeselectAll
    ]);

     const handleManualBranchChange = useCallback((branch: string) => {
          setManualBranchName(branch);
          if (targetBranchName) setTargetBranchName(null);
     }, [setManualBranchName, targetBranchName, setTargetBranchName]);

      const handleSelectPrBranch = useCallback((branch: string | null) => {
          setTargetBranchName(branch);
          if (branch) setManualBranchName("");
      }, [setTargetBranchName, setManualBranchName]);

      const handleLoadPrs = useCallback(() => {
          if (repoUrl) triggerGetOpenPRs(repoUrl);
          else toastError("Введите URL репозитория для загрузки PR.");
      }, [repoUrl, triggerGetOpenPRs, toastError]);

    const currentImageTask = imageReplaceTask;
    const showProgressBar = fetchStatus !== 'idle';
    const isActionDisabled = isFetchLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!currentImageTask;
    const kworkValueForCheck = kworkInputValue ?? ''; 
    const isCopyDisabled = !kworkValueForCheck.trim() || isActionDisabled;
    const isClearDisabled = (!kworkValueForCheck.trim() && selectedFetcherFiles.size === 0 && !filesFetched) || isActionDisabled;
    const isAddSelectedDisabled = selectedFetcherFiles.size === 0 || isActionDisabled;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const imageTaskTargetFileReady = currentImageTask && fetchStatus === 'success' && fetchedFilesFromHook.some(f => f.path === currentImageTask.targetPath);

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
                    onClick={triggerToggleSettingsModal}
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
                    onClick={() => handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
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
                    {isFetchLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                    {isParsing && !currentImageTask && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                    {fetchStatus === 'success' && !currentImageTask && fetchedFilesFromHook.length > 0 && (
                        <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                            <FaCircleCheck /> {`Успешно ${fetchedFilesFromHook.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`}
                        </div>
                    )}
                    {fetchStatus === 'success' && !currentImageTask && fetchedFilesFromHook.length === 0 && (
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

            <div className={`grid grid-cols-1 ${ (fetchedFilesFromHook.length > 0 && !currentImageTask) ? 'md:grid-cols-2' : ''} gap-4 md:gap-6`}>
                {!currentImageTask && (isFetchLoading || fetchedFilesFromHook.length > 0) && (
                    <div className={`flex flex-col gap-4 ${ (fetchedFilesFromHook.length > 0 || (kworkValueForCheck ?? '').trim().length > 0) ? '' : 'md:col-span-2'}`}> 
                        <SelectedFilesPreview
                            selectedFiles={selectedFetcherFiles}
                            allFiles={fetchedFilesFromHook} 
                            getLanguage={repoUtils.getLanguage}
                        />
                        <FileList
                            id="file-list-container"
                            files={fetchedFilesFromHook}
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

                {!currentImageTask && (fetchedFilesFromHook.length > 0 || (kworkValueForCheck ?? '').trim().length > 0) && (
                     <div id="kwork-input-section" className="flex flex-col gap-3">
                         <RequestInput
                             kworkInputRef={kworkInputRef} 
                             kworkInputValue={kworkInputValue ?? ''} 
                             onValueChange={setKworkInputValue} 
                             onCopyToClipboard={() => handleCopyToClipboard(undefined, true)}
                             onClearAll={handleClearAll}
                             onAddSelected={handleAddSelected}
                             isCopyDisabled={isCopyDisabled} 
                             isClearDisabled={isClearDisabled} 
                             isAddSelectedDisabled={isAddSelectedDisabled} 
                             selectedFetcherFilesCount={selectedFetcherFiles.size}
                             filesFetched={filesFetched} 
                             isActionDisabled={isActionDisabled} 
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