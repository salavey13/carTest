"use client";

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle, useCallback, useRef, MutableRefObject } from 'react';
import { useRepoXmlPageContext, FileNode, ImageReplaceTask, FetchStatus, ImportCategory } from '@/contexts/RepoXmlPageContext';
import { useRepoFetcher } from '@/hooks/useRepoFetcher';
import { useFileSelection } from '@/hooks/useFileSelection';
import { useKworkInput } from '@/hooks/useKworkInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { FaDownload, FaEraser, FaPlus, FaCopy, FaFileUpload, FaRobot, FaTree, FaListCheck, FaCheckCircle, FaExclamationCircle, FaSpinner, FaFileLines } from 'react-icons/fa6';
import { FaEye, FaEyeSlash, FaExclamationTriangle, FaMagic } from 'react-icons/fa6';
import { SettingsModal } from '@/components/repo/SettingsModal';
import { FileList } from '@/components/repo/FileList';
import { SelectedFilesPreview } from '@/components/repo/SelectedFilesPreview';
import { RequestInput } from '@/components/repo/RequestInput';
import { debugLogger as logger } from '@/lib/debugLogger';
import { useAppToast } from '@/hooks/useAppToast';
import * as repoUtils from "@/lib/repoUtils";

// --- Component Interface & Ref ---
export interface RepoTxtFetcherRef {
    handleFetch: (isRetry?: boolean, branch?: string | null, imageTask?: ImageReplaceTask | null, pathForInitialSelection?: string | null) => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: (files: Set<string>, allFiles: FileNode[]) => Promise<void>;
    handleCopyToClipboard: (textToCopy?: string, fromKwork?: boolean) => boolean;
    clearAll: () => void;
    handleAddImportantFiles: () => void;
    handleAddFullTree: () => void;
    selectAllFiles: () => void;
    deselectAllFiles: () => void;
    setKworkInputValue: (value: string) => void; // Expose setter
}
interface RepoTxtFetcherProps {
    highlightedPathProp?: string | null;
    ideaProp?: string | null;
}

// --- Main Component ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, RepoTxtFetcherProps>((props, ref) => {
    const { highlightedPathProp, ideaProp } = props;
    logger.debug("[RepoTxtFetcher] Function Start");

    // --- CONTEXT & TOAST ---
    const {
        repoUrl, setRepoUrl,
        fetchStatus, setFetchStatus, handleSetFilesFetched,
        kworkInputRef,
        kworkInputValue, setKworkInputValue: setKworkInputValueContext,
        setKworkInputHasContent,
        isSettingsModalOpen, triggerToggleSettingsModal,
        selectedFetcherFiles, setSelectedFetcherFiles,
        allFetchedFiles, targetBranchName, manualBranchName,
        setTargetBranchName, setManualBranchName,
        setTargetPrData,
        setImageReplaceTask, imageReplaceTask,
        pendingFlowDetails,
        setPrimaryHighlightedPath,
        setRequestCopied, // To reset if kwork is cleared
        setAiResponseHasContent, // To reset if kwork is cleared
        setFilesParsed, // To reset if kwork is cleared
        setSelectedAssistantFiles, // To reset if kwork is cleared
        setContextIsParsing, // To reset if kwork is cleared
        addToast
    } = useRepoXmlPageContext();
    const { success: toastSuccess, error: toastError, info: toastInfo } = useAppToast();
    logger.debug("[RepoTxtFetcher] After useState");

    // --- HOOKS ---
    const {
        files, setFiles, fetchRepoContents,
        loading: fetchLoading, error: fetchError, progress,
        isFetchDisabled, setIsFetchDisabled,
        retryCount, maxRetries,
        triggerFetch: hookTriggerFetch,
        isFetchingRef, isAutoFetchingRef
    } = useRepoFetcher(repoUrl, setFetchStatus, handleSetFilesFetched, addToast, targetBranchName, manualBranchName, setTargetBranchName, setTargetPrData);

    const {
        handleFileSelect, handleSelectAll, handleDeselectAll,
        getImportantFiles,
        selectedFiles: localSelectedFiles, // Renamed to avoid conflict
        setSelectedFiles: setLocalSelectedFiles,
        visibleFiles, setVisibleFiles,
        showOnlySelected, setShowOnlySelected,
        searchTerm, setSearchTerm,
        sortOrder, setSortOrder,
    } = useFileSelection(files, setSelectedFetcherFiles);

    const {
        kworkInputValue: localKworkInput,
        setKworkInputValue: setLocalKworkInput,
        handleKworkInputChange, handleAddToKwork,
        handleClearKwork, handleCopyKworkToClipboard,
        isButtonDisabled: isKworkButtonDisabled,
        showTreeInKwork, setShowTreeInKwork,
    } = useKworkInput(kworkInputRef, setKworkInputValueContext, setKworkInputHasContent);

    logger.debug(`[RepoTxtFetcher] Received props: highlightedPathProp='${highlightedPathProp}', ideaProp='${ideaProp ? ideaProp.substring(0,50) + "..." : null}'`);

    // --- State for RepoTxtFetcher specific logic ---
    const [autoFetch, setAutoFetch] = useState<boolean>(true);
    const internalIdeaPropRef = useRef(ideaProp);
    const internalHighlightedPathPropRef = useRef(highlightedPathProp);

    // --- DERIVED STATE / MEMO ---
    const currentBranchName = useMemo(() => manualBranchName.trim() || targetBranchName || 'default', [manualBranchName, targetBranchName]);
    const showProgressBar = useMemo(() => fetchStatus === 'loading' || fetchStatus === 'retrying', [fetchStatus]);
    logger.debug("[RepoTxtFetcher] After Derived State/Memo");

    // --- IMPERATIVE HANDLE ---
    useImperativeHandle(ref, () => ({
        handleFetch: async (isRetry = false, branch?: string | null, imageTask?: ImageReplaceTask | null, pathForInitialSelection?: string | null) => {
            await hookTriggerFetch(isRetry, branch, imageTask, pathForInitialSelection);
        },
        selectHighlightedFiles: () => {
            if (allFetchedFiles.length > 0) {
                const pathsToSelect = new Set<string>();
                const primaryPath = internalHighlightedPathPropRef.current; // Use ref
                if (primaryPath && files.some(f => f.path === primaryPath)) {
                    pathsToSelect.add(primaryPath);
                }
                // Add logic for secondary highlights if needed here.
                // This currently only selects the primary.
                handleFileSelect(Array.from(pathsToSelect)); // Assuming handleFileSelect can take an array
                toastInfo(`${pathsToSelect.size} связанных файлов выбрано.`);
            }
        },
        handleAddSelected: async (filesToSelect: Set<string>, allCurrentFiles: FileNode[]) => {
            if(filesToSelect.size > 0){
                await handleAddToKwork(filesToSelect, allCurrentFiles, showTreeInKwork);
            } else {
                toastInfo("Нет файлов для добавления в KWork.");
            }
        },
        handleCopyToClipboard: (textToCopy?: string, fromKwork: boolean = false) => {
            return handleCopyKworkToClipboard(textToCopy, fromKwork);
        },
        clearAll: () => {
            handleClearKwork();
            setSelectedFetcherFiles(new Set());
            setLocalSelectedFiles(new Set());
            // Also clear assistant side state if needed
            if (kworkInputRef.current) kworkInputRef.current.value = "";
            setKworkInputValueContext(""); // Clear context value
            setKworkInputHasContent(false);
            setRequestCopied(false);
            setAiResponseHasContent(false); // Clear AI response content flag
            setFilesParsed(false); // Reset parsed files flag
            setSelectedAssistantFiles(new Set()); // Clear selected files in assistant
            setContextIsParsing(false); // Reset parsing state in assistant
            if (pageContext.assistantRef.current) {
                 pageContext.assistantRef.current.setResponseValue(""); // Clear AI response in assistant
            }
            toastInfo("Поля очищены, выделение снято.");
        },
        handleAddImportantFiles: async () => {
            const importantFiles = getImportantFiles(files);
            if (importantFiles.length > 0) {
                await handleAddToKwork(new Set(importantFiles.map(f => f.path)), files, showTreeInKwork);
            } else {
                toastInfo("Важные файлы не найдены для добавления.");
            }
        },
        handleAddFullTree: async () => {
            const allFilePaths = new Set(files.map(f => f.path));
            await handleAddToKwork(allFilePaths, files, true); // Force tree for this action
        },
        selectAllFiles: () => handleSelectAll(files),
        deselectAllFiles: handleDeselectAll,
        setKworkInputValue: (value: string) => { // Expose method
            setLocalKworkInput(value); // Update local state used by RequestInput
            if (kworkInputRef.current) kworkInputRef.current.value = value; // Directly set textarea
            setKworkInputValueContext(value); // Update context
        }
    }));
    logger.debug("[RepoTxtFetcher] After useImperativeHandle");

    // --- EFFECTS ---
    // Effect to handle initial ideaProp and highlightedPathProp
    useEffect(() => {
        internalIdeaPropRef.current = ideaProp;
        internalHighlightedPathPropRef.current = highlightedPathProp;

        if (ideaProp && !ideaProp.startsWith('ImageReplace|')) {
            logger.info(`[RepoTxtFetcher useEffect ideaProp] NORMAL idea detected: "${ideaProp.substring(0,30)}...". Setting KWork.`);
            setLocalKworkInput(ideaProp); // Use the local setter
            if (kworkInputRef.current) kworkInputRef.current.value = ideaProp; // Also update textarea directly
            setKworkInputValueContext(ideaProp); // Update context value

            if (highlightedPathProp) {
                logger.info(`[RepoTxtFetcher useEffect ideaProp] NORMAL idea WITH path: "${highlightedPathProp}". Triggering fetch for initial selection.`);
                // Fetch files and then select the highlightedPathProp
                // The selection logic is now inside handleFetch/handleSetFilesFetched
                hookTriggerFetch(false, null, null, highlightedPathProp);
            }
        } else if (ideaProp && ideaProp.startsWith('ImageReplace|')) {
             logger.info(`[RepoTxtFetcher useEffect ideaProp] ImageReplace idea detected by RepoTxtFetcher: "${ideaProp.substring(0,30)}...". Primary handling in ActualPageContent.`);
             // The primary logic for ImageReplace is now in ActualPageContent's useEffect
             // This ensures RepoURL and ImageTask are set in context *before* fetch is called.
             // RepoTxtFetcher will receive the imageReplaceTask via its handleFetch call from context.
        }
    }, [ideaProp, highlightedPathProp, setLocalKworkInput, kworkInputRef, setKworkInputValueContext, hookTriggerFetch]);


    // Effect for auto-fetching based on repoUrl, autoFetch flag and imageReplaceTask
    useEffect(() => {
        logger.debug("[Effect Auto-Fetch] Check START");
        if (isFetchingRef.current || isAutoFetchingRef.current) {
            logger.debug("[Effect Auto-Fetch] SKIP: Already fetching or auto-fetch in progress.");
            return;
        }

        const timerId = setTimeout(() => {
            logger.debug("[Effect Auto-Fetch Timer] Timer Fired");
            if (isFetchingRef.current || !autoFetch) {
                logger.debug("[Effect Auto-Fetch Timer] Conditions NOT met or already fetching.");
                return;
            }
            if (repoUrl && repoUrl.includes("github.com") && !imageReplaceTask && !pendingFlowDetails) {
                isAutoFetchingRef.current = true;
                logger.info(`[Effect Auto-Fetch Timer] Conditions met, calling hookTriggerFetch. Current Branch: ${currentBranchName}`);
                hookTriggerFetch(false, currentBranchName)
                    .catch(e => logger.error("Error in auto-fetch timer trigger:", e))
                    .finally(() => {
                        // Reset isAutoFetchingRef after a delay to prevent immediate re-trigger if component re-renders quickly
                        setTimeout(() => {
                            logger.debug("[Effect Auto-Fetch Timer] Resetting isAutoFetchingRef flag.");
                            isAutoFetchingRef.current = false;
                        }, 500);
                    });
            } else {
                 logger.debug(`[Effect Auto-Fetch Timer] Skipping auto-fetch: No valid repo URL, or image/pending flow active. Repo: ${repoUrl}, ImageTask: ${!!imageReplaceTask}, PendingFlow: ${!!pendingFlowDetails}`);
            }
        }, 1000); // 1-second delay

        return () => {
            logger.debug("[Effect Auto-Fetch] Cleanup: Clearing timer.");
            clearTimeout(timerId);
        };
    }, [repoUrl, autoFetch, imageReplaceTask, pendingFlowDetails, hookTriggerFetch, currentBranchName]);


    // Effect to scroll to the file list or errors when files are fetched or fetch fails
    useEffect(() => {
        logger.debug("[Effect Scroll] RepoTxtFetcher Check");
        if (fetchStatus === 'success' && files.length > 0 && !imageReplaceTask && !autoFetch) {
             logger.info("[Effect Scroll] Scrolling to file list.");
             const fileListElement = document.getElementById('file-list-container');
             if (fileListElement) fileListElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (fetchStatus === 'error' || fetchStatus === 'failed_retries') {
             logger.info("[Effect Scroll] Scrolling to error message / fetch button.");
             const fetchButtonElement = document.getElementById('fetch-button-main');
             if (fetchButtonElement) fetchButtonElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
             logger.debug("[Effect Scroll] SKIPPED (wrong status/mode/auto)", { fetchStatus, imageReplaceTask, autoFetch });
        }
    }, [fetchStatus, files, imageReplaceTask, autoFetch]);


    // --- RENDER STATE CALCULATION ---
    logger.debug("[RepoTxtFetcher] Calculate Derived State");
    const isActionDisabled = useMemo(() => fetchStatus === 'loading' || fetchStatus === 'retrying' || isFetchDisabled, [fetchStatus, isFetchDisabled]);
    const isFetchButtonDisabled = useMemo(() => !repoUrl.includes("github.com") || fetchLoading || isFetchDisabled, [repoUrl, fetchLoading, isFetchDisabled]);
    logger.debug("[Render State]", { isActionDisabled, isFetchLoading: fetchLoading, showProgressBar });

    // --- MAIN JSX ---
    logger.debug("[RepoTxtFetcher] Preparing to render JSX...");
    return (
        <div className="space-y-4 p-1">
            <header className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                    <FaDownload className="text-2xl text-blue-400" />
                    <h2 className="text-2xl font-bold text-blue-400">Код Экстрактор</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={triggerToggleSettingsModal} variant="ghost" size="icon" className="text-gray-400 hover:text-cyan-400" title="Открыть настройки">
                        <repoUtils.FaToolbox className="h-5 w-5" />
                    </Button>
                     <Button
                        id="fetch-button-main"
                        onClick={() => hookTriggerFetch(false, currentBranchName, imageReplaceTask)}
                        disabled={isFetchButtonDisabled}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50"
                        title={repoUrl.includes("github.com") ? `Извлечь файлы из ${currentBranchName}`: "Введите корректный GitHub URL"}
                    >
                        {fetchLoading ? <FaSpinner className="animate-spin mr-2" /> : <FaDownload className="mr-2" />}
                        {fetchLoading ? 'Загрузка...' : `Извлечь (${currentBranchName})`}
                    </Button>
                </div>
            </header>

            {isSettingsModalOpen && (
                 <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={triggerToggleSettingsModal}
                    repoUrl={repoUrl}
                    setRepoUrl={setRepoUrl}
                    autoFetch={autoFetch}
                    setAutoFetch={setAutoFetch}
                    manualBranchName={manualBranchName}
                    setManualBranchName={setManualBranchName}
                    targetBranchName={targetBranchName}
                    setTargetBranchName={setTargetBranchName}
                    openPRs={pageContext.openPrs}
                    isLoadingPRs={pageContext.loadingPrs}
                    onRefreshPRs={() => pageContext.triggerGetOpenPRs(repoUrl)}
                 />
            )}

            {fetchError && (fetchStatus === 'error' || fetchStatus === 'failed_retries') && (
                <div className="p-3 bg-red-700/20 border border-red-500 rounded-md text-red-300 text-sm space-y-1">
                    <p className="font-semibold flex items-center"><FaExclamationTriangle className="mr-2"/>Ошибка загрузки:</p>
                    <p className="text-xs break-all">{typeof fetchError === 'string' ? fetchError : fetchError.message}</p>
                    {retryCount < maxRetries && fetchStatus === 'error' && (
                        <p className="text-xs">Попытка {retryCount + 1} из {maxRetries}.</p>
                    )}
                    {fetchStatus === 'failed_retries' && (
                         <p className="text-xs">Достигнуто макс. число попыток. Проверьте URL/токен и попробуйте вручную.</p>
                    )}
                </div>
            )}

            {showProgressBar && <Progress value={progress} className="w-full h-2 bg-gray-700 [&>div]:bg-blue-500" />}

            <SelectedFilesPreview
                selectedFilePaths={localSelectedFiles}
                onRemoveFile={(filePath) => {
                    setLocalSelectedFiles(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(filePath);
                        return newSet;
                    });
                    setSelectedFetcherFiles(prev => {
                         const newSet = new Set(prev);
                         newSet.delete(filePath);
                         return newSet;
                    });
                }}
                onClearAll={() => {
                     setLocalSelectedFiles(new Set());
                     setSelectedFetcherFiles(new Set());
                }}
            />

            <FileList
                files={files}
                visibleFiles={visibleFiles}
                setVisibleFiles={setVisibleFiles}
                selectedFilePaths={localSelectedFiles}
                onFileSelect={handleFileSelect}
                onSelectAll={() => handleSelectAll(files)}
                onDeselectAll={handleDeselectAll}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                showOnlySelected={showOnlySelected}
                onShowOnlySelectedChange={setShowOnlySelected}
                getImportantFiles={() => getImportantFiles(files)}
                isLoading={fetchLoading}
                primaryHighlightedPath={pageContext.primaryHighlightedPath}
                secondaryHighlightedPaths={pageContext.secondaryHighlightedPaths}
            />

            <RequestInput
                kworkInputRef={kworkInputRef}
                inputValue={localKworkInput}
                onInputChange={handleKworkInputChange}
                onAddToKwork={async () => {
                    if(localSelectedFiles.size > 0){
                        await handleAddToKwork(localSelectedFiles, files, showTreeInKwork);
                    } else {
                        toastInfo("Сначала выберите файлы в списке выше.");
                    }
                }}
                onClearKwork={handleClearKwork}
                onCopyKwork={handleCopyKworkToClipboard}
                isButtonDisabled={isKworkButtonDisabled || localSelectedFiles.size === 0}
                showTreeInKwork={showTreeInKwork}
                onShowTreeInKworkChange={setShowTreeInKwork}
                kworkInputValueForDisplay={kworkInputValue} // Pass context value for display
            />

            {files.length > 0 && fetchStatus === 'success' && (
                <div className="text-xs text-gray-500 pt-2">
                    Загружено {files.length} файлов. Средний размер: {repoUtils.getHumanReadableSize(files.reduce((acc, f) => acc + (f.content?.length || 0), 0) / (files.length || 1))}.
                </div>
            )}
             {logger.log("[RepoTxtFetcher] END Render")}
        </div>
    );
});

RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;