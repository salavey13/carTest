"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
  // MutableRefObject, // Not explicitly used, can be removed if not needed by other types
} from "react";
import {
  useRepoXmlPageContext,
  RepoTxtFetcherRef,
  FileNode,
  // ImportCategory, // Not explicitly used, can be removed if not needed by other types
  FetchStatus,
  ImageReplaceTask,
} from "@/contexts/RepoXmlPageContext";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoFetcher } from "@/hooks/useRepoFetcher";
import { useFileSelection } from "@/hooks/useFileSelection";
import { useKworkInput } from "@/hooks/useKworkInput";
import { useAppToast } from "@/hooks/useAppToast";
import { debugLogger as logger } from "@/lib/debugLogger";
import * as repoUtils from "@/lib/repoUtils";
import { cn } from "@/lib/utils"; // Added for cn utility

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { ProgressBar } from "@/components/ui/progressbar"; // Old path
import ProgressBar from "@/components/repo/ProgressBar"; // Corrected path and assuming default export
// import { ScrollArea } from "@/components/ui/scroll-area"; // Not used in this component
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider, // Often needed with Tooltip
} from "@/components/ui/tooltip";

// Removed direct icon imports, will use VibeContentRenderer
// import { FaDownload, FaPaperPlane, FaMagic, FaExclamationTriangle, FaCheckCircle, FaInfoCircle,
//   FaTrash, FaCopy, FaList, FaSitemap, FaSearch, FaCogs, FaCodeBranch,
//   FaLink, FaPlus, FaTree, FaTimesCircle, FaFolderOpen, FaFileCode, FaFileImage, FaQuestionCircle, FaFilter
// } from "react-icons/fa";
// import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

import { VibeContentRenderer } from "@/components/VibeContentRenderer"; // Import VibeContentRenderer

// Corrected paths for fetcher components, assuming default exports
import SettingsModal from "@/components/repo/SettingsModal";
import FileList from "@/components/repo/FileList"; // This was FileList from './fetcher_components/FileList'
import RequestInput from "@/components/repo/RequestInput"; // This was RequestInput from './fetcher_components/RequestInput'
import SelectedFilesPreview from "@/components/repo/SelectedFilesPreview"; // This was SelectedFilesPreview from './fetcher_components/SelectedFilesPreview'
import ImportantFilesList from "@/components/repo/ImportantFilesList"; // This was ImportantFilesList from './fetcher_components/ImportantFilesList'

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
      // setFetchStatus, // Not directly used in this component's logic
      repoUrl,
      setRepoUrl,
      selectedFetcherFiles,
      // setSelectedFetcherFiles, // Not directly used
      kworkInputRef,
      kworkInputValue,
      setKworkInputValue,
      // setKworkInputHasContent, // Not directly used
      // setRequestCopied, // Not directly used
      // handleSetFilesFetched, // Not directly used
      openPrs,
      // setOpenPrs, // Not directly used
      targetBranchName,
      setTargetBranchName,
      manualBranchName,
      setManualBranchName,
      isSettingsModalOpen,
      // triggerToggleSettingsModal, // Not directly used
      assistantLoading,
      isParsing,
      aiActionLoading,
      loadingPrs,
      // setLoadingPrs, // Not directly used
      triggerGetOpenPRs,
      imageReplaceTask: contextImageReplaceTask,
      setImageReplaceTask,
      triggerPreCheckAndFetch,
      repoUrlEntered,
      // filesFetched, // Not directly used
      // allFetchedFiles, // Not directly used
      // setAiResponseHasContent, // Not directly used
      // setFilesParsed, // Not directly used
      // setSelectedAssistantFiles, // Not directly used
      // scrollToSection, // Not directly used
    } = useRepoXmlPageContext();
    
    const { 
      // user, // Not directly used
      // dbUser // Not directly used 
    } = useAppContext();
    const { 
      // success: toastSuccess, // Not directly used
      // error: toastError, // Not directly used
      // info: toastInfo // Not directly used
    } = useAppToast();

    const [localToken, setLocalToken] = useState<string>("");
    // const [showImportantFiles, setShowImportantFiles] = useState(false); // Not used
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
        imageReplaceTask: contextImageReplaceTask, 
        highlightedPathFromUrl: highlightedPathProp || "",
        importantFiles: importantFilesConfig.map(f => f.path),
        autoFetch: !!(highlightedPathProp && !ideaProp),
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
        imageReplaceTaskActive: !!contextImageReplaceTask, 
    });
     logger.debug("[RepoTxtFetcher] After useFileSelection Hook");

    const {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
    } = useKworkInput({
        selectedFetcherFiles,
        allFetchedFiles: fetchedFiles, // Pass fetchedFiles from useRepoFetcher
        imageReplaceTaskActive: !!contextImageReplaceTask,
        files: fetchedFiles, // Pass fetchedFiles from useRepoFetcher
    });
    logger.debug("[RepoTxtFetcher] After useKworkInput Hook");
    
    const pathFromUrl = highlightedPathProp;
    const ideaFromUrl = ideaProp;

    useEffect(() => {
        logger.debug(`[RepoTxtFetcher Effect ideaProp] ideaProp changed or component mounted. ideaProp: '${ideaFromUrl}', pathFromUrl: '${pathFromUrl}'`);
        if (ideaFromUrl && pathFromUrl && repoUrl.includes("github.com")) {
            if (ideaFromUrl.startsWith("ImageReplace|")) {
                logger.info("[RepoTxtFetcher Effect ideaProp] Detected ImageReplace flow from ideaProp.");
                const parts = ideaFromUrl.split("|");
                const oldUrlPart = parts.find(p => p.startsWith("OldURL="));
                const newUrlPart = parts.find(p => p.startsWith("NewURL="));

                if (oldUrlPart && newUrlPart) {
                    const oldUrl = decodeURIComponent(oldUrlPart.substring("OldURL=".length));
                    const newUrl = decodeURIComponent(newUrlPart.substring("NewURL=".length));
                    
                    logger.log("[RepoTxtFetcher Effect ideaProp] Parsed ImageReplace details:", { targetPath: pathFromUrl, oldUrl, newUrl });
                    
                    const branchNameToUse = manualBranchName || targetBranchName || ''; 
                    triggerPreCheckAndFetch(
                        repoUrl,
                        branchNameToUse,
                        'ImageSwap',
                        { oldUrl, newUrl }, 
                        pathFromUrl
                    ).then(() => {
                        logger.log("[RepoTxtFetcher Effect ideaProp] triggerPreCheckAndFetch for ImageSwap completed via ideaProp.");
                    }).catch(err => {
                        logger.error("[RepoTxtFetcher Effect ideaProp] Error calling triggerPreCheckAndFetch for ImageSwap via ideaProp:", err);
                         setImageReplaceTask({ targetPath: pathFromUrl, oldUrl, newUrl });
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
            if (imageTaskForThisFetch) {
                logger.log("[RepoTxtFetcher ImperativeHandle handleFetch] Explicit imageTaskForThisFetch provided, setting it in context.", imageTaskForThisFetch);
                setImageReplaceTask(imageTaskForThisFetch);
            }
            await handleFetchManual(isRetry, branchNameToFetchOverride);
        },
        selectHighlightedFiles,
        handleAddSelected: () => { // Removed unused args
            logger.debug("[RepoTxtFetcher ImperativeHandle] handleAddSelected called. Delegating to useKworkInput.");
            return handleAddSelected();
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
                    // isOpen prop is typically handled internally or via context state, not passed directly if SettingsModal controls its own visibility or uses context
                    // Assuming SettingsModal uses isSettingsModalOpen from context directly, or has an isOpen prop
                    // For this example, if it's controlled by context's isSettingsModalOpen, we don't need to pass isOpen.
                    // If it requires isOpen, then: isOpen={isSettingsModalOpen}

                    // Props for SettingsModal as per its definition in context:
                    // repoUrl, setRepoUrl, token (localToken), setToken (setLocalToken), manualBranchName, setManualBranchName,
                    // currentTargetBranch (targetBranchName from context), openPrs, loadingPrs, onSelectPrBranch (setTargetBranchName or a new handler),
                    // onLoadPrs (triggerGetOpenPRs)

                    repoUrl={repoUrl}
                    setRepoUrl={setRepoUrl}
                    token={localToken} // localToken for the modal's internal state
                    setToken={setLocalToken} // setLocalToken for the modal
                    manualBranchName={manualBranchName}
                    setManualBranchName={setManualBranchName}
                    currentTargetBranch={targetBranchName} // Pass the context's targetBranchName
                    openPrs={openPrs}
                    loadingPrs={loadingPrs}
                    onSelectPrBranch={(branch) => setTargetBranchName(branch)} // Example handler
                    onLoadPrs={() => triggerGetOpenPRs(repoUrl)}
                    loading={isFetchLoading || assistantLoading || isParsing || aiActionLoading} // General loading state
                    // onClose is not needed if SettingsModal uses triggerToggleSettingsModal from context
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
                    {isFetchLoading 
                        ? <VibeContentRenderer content='::FaSpinner className="animate-spin mr-2"::' /> 
                        : <VibeContentRenderer content='::FaDownload className="mr-2"::' />}
                    Извлечь файлы
                </Button>
            </div>

            {showProgressBar && <ProgressBar status={fetchStatus} progress={progress} />}
            {fetcherError && <p className="text-destructive text-xs text-center py-1">{fetcherError}</p>}
            
            {contextImageReplaceTask && (
                <div className="p-3 my-2 border-2 border-dashed border-yellow-500 bg-yellow-900/20 rounded-lg text-yellow-200 text-sm shadow-lg">
                    <p className="font-semibold flex items-center gap-2">
                        <VibeContentRenderer content='::FaFileImage className="text-yellow-400"::' /> Режим Авто-Замены Изображения:
                    </p>
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
                             <Button onClick={selectHighlightedFiles} variant="outline" size="sm" disabled={isActionDisabled || (!hookPrimaryHighlightedPath && Object.values(hookSecondaryHighlightedPaths).every(arr => arr.length === 0))}> <VibeContentRenderer content='::FaLink className="mr-1.5"::' /> Связанные </Button>
                             <Button onClick={handleAddImportantFiles} variant="outline" size="sm" disabled={isActionDisabled || importantFilesConfig.length === 0}> <VibeContentRenderer content='::FaStar className="mr-1.5"::' /> Важные</Button>
                             <Button onClick={handleAddFullTree} variant="outline" size="sm" disabled={isActionDisabled}><VibeContentRenderer content='::FaTree className="mr-1.5"::' /> Всё Дерево</Button>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                             <Button onClick={() => handleAddSelected()} variant="default" size="sm" className="bg-brand-green hover:bg-brand-green/90 text-black" disabled={isActionDisabled || selectedFetcherFiles.size === 0}> <VibeContentRenderer content='::FaPlus className="mr-1.5"::' /> Доб. в Запрос </Button>
                        </div>
                    </div>
                    
                    <SelectedFilesPreview 
                        selectedFiles={selectedFetcherFiles} 
                        allFiles={fetchedFiles} // Changed from files to allFiles to match prop name in component
                        getLanguage={repoUtils.getLanguageForFile} // Assuming this utility exists and is appropriate
                    />

                    <div className="relative">
                        <Input
                            type="text"
                            placeholder={`Поиск по ${fetchedFiles.length} файлам... (Ctrl+F)`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-16 bg-input border-border focus:border-brand-cyan"
                        />
                        <VibeContentRenderer content='::FaMagnifyingGlass className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"::' />
                        {searchTerm && (
                             <Button variant="ghost" size="icon" className="absolute right-9 top-1/2 transform -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}> <VibeContentRenderer content="::FaXmark::" /> </Button>
                        )}
                        <TooltipProvider> {/* TooltipProvider for nested Tooltips */}
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant={filterActive ? "secondary" : "ghost"} size="icon" className="absolute right-0 top-1/2 transform -translate-y-1/2 h-9 w-9 mr-px" onClick={() => setFilterActive(p => !p)}>
                                      <VibeContentRenderer content={`::FaFilter className="${cn(filterActive && "text-brand-cyan")}"::`} />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Искать также по содержимому файлов</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                    </div>
                    
                    {/* Assuming FileList props match the new FileList.tsx structure (which they seem to do based on context) */}
                    <FileList
                        id="repo-txt-fetcher-file-list" // Added an ID for better accessibility/testing if needed
                        files={filteredFiles}
                        selectedFiles={selectedFetcherFiles}
                        primaryHighlightedPath={hookPrimaryHighlightedPath}
                        secondaryHighlightedPaths={hookSecondaryHighlightedPaths} // Pass the record directly
                        importantFiles={importantFilesConfig.map(f => f.path)}
                        isLoading={isFetchLoading}
                        isActionDisabled={isActionDisabled}
                        toggleFileSelection={toggleFileSelection}
                        onAddSelected={handleAddSelected}
                        onAddImportant={handleAddImportantFiles}
                        onAddTree={handleAddFullTree}
                        onSelectHighlighted={selectHighlightedFiles}
                        onSelectAll={handleSelectAll}
                        onDeselectAll={handleDeselectAll}
                    />
                </>
            )}
            
            {fetchedFiles.length === 0 && fetchStatus === 'success' && !contextImageReplaceTask && (
                <div className="text-center py-8 text-muted-foreground">
                    <VibeContentRenderer content='::FaFolderOpen className="mx-auto text-4xl mb-2"::' />
                    <p>Файлы не загружены. Попробуйте другой URL или ветку.</p>
                </div>
            )}

            {!contextImageReplaceTask && (
                 <RequestInput
                    kworkInputRef={kworkInputRef}
                    kworkInputValue={kworkInputValue}
                    onValueChange={setKworkInputValue} // Changed to match RequestInput prop name
                    onCopyToClipboard={handleCopyToClipboard} // Propagated from useKworkInput
                    onClearAll={handleClearAll} // Propagated from useKworkInput
                    onAddSelected={handleAddSelected} // Propagated from useKworkInput
                    isAddSelectedDisabled={selectedFetcherFiles.size === 0}
                    selectedFetcherFilesCount={selectedFetcherFiles.size}
                    isActionDisabled={isActionDisabled}
                    filesFetched={fetchedFiles.length > 0 && (fetchStatus === 'success' || fetchStatus === 'error')} // Example condition
                 />
            )}

        </div>
    );
  }
);
RepoTxtFetcher.displayName = "RepoTxtFetcher";
export default RepoTxtFetcher;