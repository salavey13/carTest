"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
  MutableRefObject,
} from "react";
import {
  useRepoXmlPageContext,
  RepoTxtFetcherRef,
  FileNode,
  ImportCategory,
  FetchStatus,
  ImageReplaceTask // Added for parsing ideaProp
} from "@/contexts/RepoXmlPageContext";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoFetcher } from "@/hooks/useRepoFetcher";
import { useFileSelection } from "@/hooks/useFileSelection";
import { useKworkInput } from "@/hooks/useKworkInput";
import { useAppToast } from "@/hooks/useAppToast";
import { debugLogger as logger } from "@/lib/debugLogger";
import * as repoUtils from "@/lib/repoUtils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progressbar"; // Assuming you have this
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaDownload, FaPaperPlane, FaMagic, FaExclamationTriangle, FaCheckCircle, FaInfoCircle,
  FaTrash, FaCopy, FaList, FaSitemap, FaSearch, FaCogs, FaCodeBranch,
  FaLink, FaPlus, FaTree, FaTimesCircle, FaFolderOpen, FaFileCode, FaFileImage, FaQuestionCircle, FaFilter
} from "react-icons/fa";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

import { SettingsModal } from "./fetcher_components/SettingsModal";
import { FileList } from "./fetcher_components/FileList";
import { RequestInput } from "./fetcher_components/RequestInput";
import { SelectedFilesPreview } from "./fetcher_components/SelectedFilesPreview";
import { ImportantFilesList } from "./fetcher_components/ImportantFilesList";


interface RepoTxtFetcherProps {
  highlightedPathProp: string | null;
  ideaProp: string | null;
}

const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, RepoTxtFetcherProps>(
  (props, ref) => {
    logger.debug("[RepoTxtFetcher] Function Start");
    const { highlightedPathProp, ideaProp } = props;

    const {
      fetchStatus,
      setFetchStatus,
      repoUrl,
      setRepoUrl,
      selectedFetcherFiles,
      setSelectedFetcherFiles,
      kworkInputRef,
      kworkInputValue,
      setKworkInputValue,
      setKworkInputHasContent,
      setRequestCopied,
      handleSetFilesFetched,
      openPrs,
      setOpenPrs,
      targetBranchName,
      setTargetBranchName,
      manualBranchName,
      setManualBranchName,
      isSettingsModalOpen,
      triggerToggleSettingsModal,
      assistantLoading,
      isParsing,
      aiActionLoading,
      loadingPrs,
      setLoadingPrs,
      triggerGetOpenPRs,
      imageReplaceTask: contextImageReplaceTask, // Get from context
      setImageReplaceTask, // To set image task from ideaProp
      triggerPreCheckAndFetch, // To initiate flows from ideaProp
      repoUrlEntered,
      filesFetched,
      allFetchedFiles,
      setAiResponseHasContent,
      setFilesParsed,
      setSelectedAssistantFiles,
      scrollToSection,
    } = useRepoXmlPageContext();
    
    const { user, dbUser } = useAppContext();
    const { success: toastSuccess, error: toastError, info: toastInfo } = useAppToast();

    const [localToken, setLocalToken] = useState<string>("");
    const [showImportantFiles, setShowImportantFiles] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterActive, setFilterActive] = useState(false);
    
    logger.debug("[RepoTxtFetcher] After useState");
    logger.debug("[RepoTxtFetcher] Received props:", { highlightedPathProp, ideaProp });

    const importantFilesConfig = useMemo(() => repoUtils.getImportantFilesConfig(repoUrl), [repoUrl]);

    const {
        files: fetchedFiles,
        progress,
        error: fetcherError,
        primaryHighlightedPath: hookPrimaryHighlightedPath,
        secondaryHighlightedPaths: hookSecondaryHighlightedPaths,
        handleFetchManual,
        isLoading: isFetchLoading,
        isFetchDisabled: isActionDisabled,
    } = useRepoFetcher({
        repoUrl, token: localToken, targetBranchName, manualBranchName,
        imageReplaceTask: contextImageReplaceTask, // Pass context image task to fetcher
        highlightedPathFromUrl: highlightedPathProp || "",
        importantFiles: importantFilesConfig.map(f => f.path),
        autoFetch: !!(highlightedPathProp && !ideaProp), // Auto-fetch if path provided and no specific idea
        ideaFromUrl: ideaProp || "",
        isSettingsModalOpen, repoUrlEntered, assistantLoading, isParsing, aiActionLoading, loadingPrs,
    });
    logger.debug("[RepoTxtFetcher] After useRepoFetcher Hook");

    const {
        toggleFileSelection,
        selectHighlightedFiles,
        handleAddImportantFiles,
        handleSelectAll,
        handleDeselectAll,
    } = useFileSelection({
        files: fetchedFiles,
        primaryHighlightedPath: hookPrimaryHighlightedPath,
        secondaryHighlightedPaths: hookSecondaryHighlightedPaths,
        importantFiles: importantFilesConfig.map(f => f.path),
        imageReplaceTaskActive: !!contextImageReplaceTask, // Use context task
    });
     logger.debug("[RepoTxtFetcher] After useFileSelection Hook");

    const {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
    } = useKworkInput({
        selectedFetcherFiles,
        allFetchedFiles: fetchedFiles,
        imageReplaceTaskActive: !!contextImageReplaceTask, // Use context task
        files: fetchedFiles,
    });
    logger.debug("[RepoTxtFetcher] After useKworkInput Hook");
    
    const pathFromUrl = highlightedPathProp;
    const ideaFromUrl = ideaProp;

    // EFFECT TO HANDLE ideaProp on mount/change (ImageReplace or ErrorFix)
    useEffect(() => {
        logger.debug(`[RepoTxtFetcher Effect ideaProp] ideaProp changed or component mounted. ideaProp: '${ideaFromUrl}', pathFromUrl: '${pathFromUrl}'`);
        if (ideaFromUrl && pathFromUrl && repoUrl.includes("github.com")) { // Ensure repoUrl is also valid
            if (ideaFromUrl.startsWith("ImageReplace|")) {
                logger.info("[RepoTxtFetcher Effect ideaProp] Detected ImageReplace flow from ideaProp.");
                const parts = ideaFromUrl.split("|");
                const oldUrlPart = parts.find(p => p.startsWith("OldURL="));
                const newUrlPart = parts.find(p => p.startsWith("NewURL="));

                if (oldUrlPart && newUrlPart) {
                    const oldUrl = decodeURIComponent(oldUrlPart.substring("OldURL=".length));
                    const newUrl = decodeURIComponent(newUrlPart.substring("NewURL=".length));
                    
                    logger.log("[RepoTxtFetcher Effect ideaProp] Parsed ImageReplace details:", { targetPath: pathFromUrl, oldUrl, newUrl });
                    
                    // Use triggerPreCheckAndFetch for ImageSwap
                    const branchNameToUse = manualBranchName || targetBranchName || ''; 
                    triggerPreCheckAndFetch(
                        repoUrl,
                        branchNameToUse,
                        'ImageSwap',
                        { oldUrl, newUrl }, // Pass details for ImageSwap
                        pathFromUrl
                    ).then(() => {
                        logger.log("[RepoTxtFetcher Effect ideaProp] triggerPreCheckAndFetch for ImageSwap completed via ideaProp.");
                    }).catch(err => {
                        logger.error("[RepoTxtFetcher Effect ideaProp] Error calling triggerPreCheckAndFetch for ImageSwap via ideaProp:", err);
                         // Fallback if triggerPreCheckAndFetch fails before setting image task
                         setImageReplaceTask({ targetPath: pathFromUrl, oldUrl, newUrl });
                    });
                } else {
                    logger.warn("[RepoTxtFetcher Effect ideaProp] Could not parse OldURL/NewUrl from ImageReplace ideaProp.");
                }
            } else if (ideaFromUrl.startsWith("ErrorFix|")) {
                logger.info("[RepoTxtFetcher Effect ideaProp] Detected ErrorFix flow from ideaProp.");
                 try {
                    const detailsString = ideaFromUrl.substring("ErrorFix|".length);
                    const parsedDetails = JSON.parse(decodeURIComponent(detailsString)); // Assuming details are JSON stringified
                     logger.log("[RepoTxtFetcher Effect ideaProp] Parsed ErrorFix details:", parsedDetails);

                    const branchNameToUse = manualBranchName || targetBranchName || '';
                     triggerPreCheckAndFetch(
                         repoUrl,
                         branchNameToUse,
                         'ErrorFix',
                         parsedDetails,
                         pathFromUrl
                     ).then(() => {
                         logger.log("[RepoTxtFetcher Effect ideaProp] triggerPreCheckAndFetch for ErrorFix completed via ideaProp.");
                     }).catch(err => {
                         logger.error("[RepoTxtFetcher Effect ideaProp] Error calling triggerPreCheckAndFetch for ErrorFix via ideaProp:", err);
                     });
                 } catch (e) {
                     logger.error("[RepoTxtFetcher Effect ideaProp] Failed to parse ErrorFix details from ideaProp:", e);
                 }
            } else {
                 logger.log(`[RepoTxtFetcher Effect ideaProp] ideaProp ("${ideaFromUrl}") is present but not for ImageReplace or ErrorFix. Generic idea flow will be handled by RepoXmlPage if applicable or manual input.`);
            }
        } else {
             logger.debug(`[RepoTxtFetcher Effect ideaProp] Skipping flow trigger: ideaFromUrl='${ideaFromUrl}', pathFromUrl='${pathFromUrl}', repoUrl='${repoUrl}'`);
        }
    }, [ideaFromUrl, pathFromUrl, repoUrl, manualBranchName, targetBranchName, triggerPreCheckAndFetch, setImageReplaceTask]);


    useImperativeHandle(ref, () => ({
        handleFetch: async (isRetry = false, branchNameToFetchOverride?: string | null, imageTaskForThisFetch?: ImageReplaceTask) => {
            // If an imageTaskForThisFetch is provided, ensure it's set in context *before* fetching
            if (imageTaskForThisFetch) {
                logger.log("[RepoTxtFetcher ImperativeHandle handleFetch] Explicit imageTaskForThisFetch provided, setting it in context.", imageTaskForThisFetch);
                setImageReplaceTask(imageTaskForThisFetch);
            }
            // handleFetchManual in useRepoFetcher will use the imageReplaceTask from context (via its props)
            await handleFetchManual(isRetry, branchNameToFetchOverride);
        },
        selectHighlightedFiles,
        handleAddSelected: (selectedPathsOverride?: Set<string>, allFilesOverride?: FileNode[]) => {
            // This local handleAddSelected might not be needed if useKworkInput's version is sufficient
            // For now, assuming useKworkInput's handleAddSelected is the primary one.
            // If specific logic is needed here, it can be implemented.
            // This is mostly a pass-through to the hook's more complex version.
            logger.debug("[RepoTxtFetcher ImperativeHandle] handleAddSelected called. Delegating to useKworkInput.");
            return handleAddSelected(); // Call from useKworkInput
        },
        handleCopyToClipboard,
        clearAll: handleClearAll,
        handleAddImportantFiles,
        handleAddFullTree,
        selectAllFiles: handleSelectAll,
        deselectAllFiles: handleDeselectAll,
    }));
     logger.debug("[RepoTxtFetcher] After useImperativeHandle");

    const filteredFiles = useMemo(() => {
        if (!searchTerm.trim()) return fetchedFiles;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return fetchedFiles.filter(file => 
            file.path.toLowerCase().includes(lowerSearchTerm) || 
            (filterActive && file.content?.toLowerCase().includes(lowerSearchTerm))
        );
    }, [fetchedFiles, searchTerm, filterActive]);
    
    logger.debug("[RepoTxtFetcher] Calculate Derived State");
    const showProgressBar = fetchStatus === "loading" || fetchStatus === "retrying" || (fetchStatus === "success" && progress < 100) || (fetchStatus === "error" && progress > 0);
    logger.debug("[Render State]", { isActionDisabled, isFetchLoading, showProgressBar });
    
    logger.debug("[RepoTxtFetcher] Preparing to render JSX...");
    return (
        <div className="flex flex-col gap-4 md:gap-6">
            {isSettingsModalOpen && (
                <SettingsModal
                    repoUrl={repoUrl}
                    setRepoUrl={setRepoUrl}
                    token={localToken}
                    setToken={setLocalToken}
                    manualBranchName={manualBranchName}
                    setManualBranchName={setManualBranchName}
                    targetBranchName={targetBranchName}
                    setTargetBranchName={setTargetBranchName}
                    openPrs={openPrs}
                    isLoadingPrs={loadingPrs}
                    onRefreshPRs={() => triggerGetOpenPRs(repoUrl)}
                />
            )}
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <div className="flex-grow">
                    <label htmlFor="repoUrlInputFetcher" className="block text-xs font-medium text-muted-foreground mb-1">
                        GitHub Репозиторий (URL)
                    </label>
                    <Input
                        id="repoUrlInputFetcher"
                        type="url"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo"
                        className="bg-input border-border focus:border-brand-cyan"
                        disabled={isActionDisabled && fetchStatus !== 'idle'}
                    />
                </div>
                <Button
                    onClick={() => handleFetchManual(false, manualBranchName || targetBranchName || null)}
                    disabled={isActionDisabled || !repoUrlEntered}
                    className="w-full sm:w-auto bg-gradient-to-r from-brand-purple via-brand-pink to-brand-yellow text-background font-semibold hover:opacity-90 transition-opacity shadow-md hover:shadow-lg px-6 py-2.5 text-sm"
                    title={isActionDisabled ? "Действие заблокировано" : "Извлечь файлы из указанной ветки"}
                >
                    {isFetchLoading ? <FaSpinner className="animate-spin mr-2" /> : <FaDownload className="mr-2" />}
                    Извлечь файлы
                </Button>
            </div>

            {showProgressBar && <ProgressBar value={progress} error={fetchStatus === "error"} />}
            {fetcherError && <p className="text-destructive text-xs text-center py-1">{fetcherError}</p>}
            
            {contextImageReplaceTask && (
                <div className="p-3 my-2 border-2 border-dashed border-yellow-500 bg-yellow-900/20 rounded-lg text-yellow-200 text-sm shadow-lg">
                    <p className="font-semibold flex items-center gap-2"><FaFileImage className="text-yellow-400"/> Режим Авто-Замены Изображения:</p>
                    <ul className="list-disc list-inside pl-2 mt-1 text-xs">
                        <li>Целевой файл: <code className="bg-yellow-700/50 px-1 rounded">{contextImageReplaceTask.targetPath}</code></li>
                        <li>Система автоматически загрузит этот файл, затем передаст задачу Ассистенту для замены URL и создания PR.</li>
                    </ul>
                </div>
            )}


            {fetchedFiles.length > 0 && !contextImageReplaceTask && (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 flex-wrap">
                        <div className="flex gap-2 flex-wrap">
                             <Button onClick={selectHighlightedFiles} variant="outline" size="sm" disabled={isActionDisabled || (!hookPrimaryHighlightedPath && Object.values(hookSecondaryHighlightedPaths).every(arr => arr.length === 0))}> <FaLink className="mr-1.5"/> Связанные </Button>
                             <Button onClick={handleAddImportantFiles} variant="outline" size="sm" disabled={isActionDisabled || importantFilesConfig.length === 0}> <FaStar className="mr-1.5"/> Важные</Button>
                             <Button onClick={handleAddFullTree} variant="outline" size="sm" disabled={isActionDisabled}><FaTree className="mr-1.5"/> Всё Дерево</Button>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                             <Button onClick={() => handleAddSelected()} variant="default" size="sm" className="bg-brand-green hover:bg-brand-green/90 text-black" disabled={isActionDisabled || selectedFetcherFiles.size === 0}> <FaPlus className="mr-1.5"/> Доб. в Запрос </Button>
                        </div>
                    </div>
                    
                    <SelectedFilesPreview selectedFiles={selectedFetcherFiles} files={fetchedFiles} onRemove={toggleFileSelection} />

                    <div className="relative">
                        <Input
                            type="text"
                            placeholder={`Поиск по ${fetchedFiles.length} файлам... (Ctrl+F)`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-16 bg-input border-border focus:border-brand-cyan"
                        />
                        <FaMagnifyingGlass className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        {searchTerm && (
                             <Button variant="ghost" size="icon" className="absolute right-9 top-1/2 transform -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}> <FaXmark /> </Button>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant={filterActive ? "secondary" : "ghost"} size="icon" className="absolute right-0 top-1/2 transform -translate-y-1/2 h-9 w-9 mr-px" onClick={() => setFilterActive(p => !p)}>
                                    <FaFilter className={cn(filterActive && "text-brand-cyan")}/>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Искать также по содержимому файлов</p></TooltipContent>
                        </Tooltip>
                    </div>

                    <FileList
                        files={filteredFiles}
                        selectedFiles={selectedFetcherFiles}
                        onFileSelect={toggleFileSelection}
                        primaryHighlightedPath={hookPrimaryHighlightedPath}
                        secondaryHighlightedPathsFlat={Object.values(hookSecondaryHighlightedPaths).flat()}
                        importantFilesPaths={importantFilesConfig.map(f => f.path)}
                        searchTerm={searchTerm}
                        onSelectAll={handleSelectAll}
                        onDeselectAll={handleDeselectAll}
                    />
                </>
            )}
            
            {fetchedFiles.length === 0 && fetchStatus === 'success' && !contextImageReplaceTask && (
                <div className="text-center py-8 text-muted-foreground">
                    <FaFolderOpen className="mx-auto text-4xl mb-2"/>
                    <p>Файлы не загружены. Попробуйте другой URL или ветку.</p>
                </div>
            )}

            {!contextImageReplaceTask && (
                 <RequestInput
                    kworkInputRef={kworkInputRef}
                    kworkInputValue={kworkInputValue}
                    setKworkInputValue={setKworkInputValue}
                    isLoading={isActionDisabled}
                    onCopy={handleCopyToClipboard}
                    onClear={handleClearAll}
                 />
            )}

        </div>
    );
  }
);
RepoTxtFetcher.displayName = "RepoTxtFetcher";
export default RepoTxtFetcher;