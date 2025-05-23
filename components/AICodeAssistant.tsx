"use client";

import React, { useMemo, useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback, useRef } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest, ImageReplaceTask, FileNode, RepoXmlPageContextType, PendingFlowDetails
} from "@/contexts/RepoXmlPageContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
import { useAppToast } from '@/hooks/useAppToast';
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry, ValidationStatus } from "@/hooks/useCodeParsingAndValidation";
import { useAICodeAssistantHandlers } from './assistant_components/handlers';
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { ImageToolsModal } from './assistant_components/ImageToolsModal';
import { SwapModal } from './assistant_components/SwapModal';
import { checkAndUnlockFeatureAchievement } from "@/hooks/cyberFitnessSupabase"; 
// UI & Utils
import { AnimatePresence, motion } from "framer-motion";
import {
    FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate,
    FaImage, FaImages, FaSpinner, FaPlus, FaKeyboard, FaFileLines, FaCode,
    FaCheck, FaCircleXmark, FaExclamation
} from "react-icons/fa6";
import clsx from "clsx";
import { debugLogger as logger } from "@/lib/debugLogger";
import { cn } from "@/lib/utils";

// Interfaces
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {
     kworkInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
     aiResponseInputRefPassed: MutableRefObject<HTMLTextAreaElement | null>;
}

// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    logger.debug("[AICodeAssistant] START Render");
    // --- Props ---
    const { kworkInputRefPassed, aiResponseInputRefPassed } = props;

    // --- Get Context and Toast early ---
    const pageContext = useRepoXmlPageContext();
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning, addToast } = useAppToast();
    
    // --- State ---
    const [response, setResponse] = useState<string>("");
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [repoUrlStateLocal, setRepoUrlStateLocal] = useState<string>("");
    const [prTitle, setPrTitle] = useState<string>("");
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
    const [isProcessingPR, setIsProcessingPR] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [componentParsedFiles, setComponentParsedFiles] = useState<ValidationFileEntry[]>([]);
    const [imageReplaceError, setImageReplaceError] = useState<string | null>(null);
    const [justParsed, setJustParsed] = useState(false); 

    // --- Hooks ---
    const appContext = useAppContext();
    const codeParserHook = useCodeParsingAndValidation();
   
    // --- Destructure context ---
    const { user, dbUser } = appContext; 
    const {
        setHookParsedFiles, setValidationStatus, setValidationIssues,
        validationIssues, validationStatus, rawDescription,
        isParsing: hookIsParsing,
    } = codeParserHook;
    const {
        setAiResponseHasContent, setFilesParsed, filesParsed,
        selectedAssistantFiles, setSelectedAssistantFiles,
        setAssistantLoading, assistantLoading,
        aiActionLoading, currentAiRequestId,
        openPrs: contextOpenPrs, triggerGetOpenPRs,
        targetBranchName, triggerToggleSettingsModal,
        triggerUpdateBranch, updateRepoUrlInAssistant,
        loadingPrs, setIsParsing: setContextIsParsing,
        isParsing: contextIsParsing,
        imageReplaceTask, setImageReplaceTask,
        fetchStatus, allFetchedFiles, repoUrlEntered,
        repoUrl: repoUrlFromContext,
        setRequestCopied,
        pendingFlowDetails 
    } = pageContext;
    
    // --- Handlers Hook ---
    const handlers = useAICodeAssistantHandlers({
        response, componentParsedFiles, selectedFileIds, repoUrlStateLocal, prTitle, customLinks,
        imageReplaceTask,
        setResponse, setSelectedFileIds, setPrTitle, setCustomLinks, setShowModal, setModalMode, setIsProcessingPR,
        setIsImageModalOpen, setComponentParsedFiles, setImageReplaceError, setRepoUrlStateLocal,
        setImageReplaceTask,
        codeParserHook,
        appContext,
        pageContext,
        aiResponseInputRefPassed,
        kworkInputRefPassed,
        setJustParsedFlagForScrollFix: setJustParsed, 
    });
    
    // --- Destructure handlers ---
    const {
        handleParse, handleAutoFix, handleUpdateParsedFiles, handleClearResponse, handleCopyResponse,
        handleOpenModal, handleSwap, handleSearch, handleSelectFunction, handleToggleFileSelection,
        handleSelectAllFiles, handleDeselectAllFiles, handleSaveFiles, handleDownloadZip,
        handleSendToTelegram, handleAddCustomLink, handleCreateOrUpdatePR,
        handleDirectImageReplace
    } = handlers;

    // --- Callback Hooks ---
    const setResponseValue = useCallback((value: string) => {
        setResponse(value);
        if (aiResponseInputRefPassed.current) aiResponseInputRefPassed.current.value = value;
        setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set());
        setValidationStatus('idle'); setValidationIssues([]); setPrTitle(''); codeParserHook.setRawDescription('');
        setRequestCopied(false); setAiResponseHasContent(value.trim().length > 0);
        logger.log("[CB setResponseValue] Response value set manually, resetting parsed state.");
     }, [aiResponseInputRefPassed, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setPrTitle, codeParserHook, setRequestCopied, setAiResponseHasContent, setSelectedFileIds]);

    const updateRepoUrl = useCallback((url: string) => {
        logger.info(`[CB updateRepoUrl] Updating local URL: ${url}`);
        setRepoUrlStateLocal(url);
     }, []);

    const handleResetImageError = useCallback(() => {
         logger.info(`[CB handleResetImageError] Resetting image error state.`);
         setImageReplaceError(null);
         setImageReplaceTask(null); 
         toastInfo("Состояние ошибки сброшено.");
     }, [setImageReplaceError, setImageReplaceTask, toastInfo]);
    
    // --- Refs ---
    const imageReplaceTaskRef = useRef(imageReplaceTask);
    
    // --- Derived State ---
    const derivedRepoUrlForHooks = repoUrlStateLocal || repoUrlFromContext || "";

    // --- Effects ---
    useEffect(() => { 
        if (justParsed) {
            aiResponseInputRefPassed.current?.focus();
            setJustParsed(false); 
            logger.log("[Effect justParsed] Focused AI response textarea to stabilize scroll.");
        }
    }, [justParsed, aiResponseInputRefPassed]); 

    useEffect(() => { 
        logger.debug("[Effect Mount] AICodeAssistant Mounted");
        const initialRepoUrl = repoUrlStateLocal || repoUrlFromContext;
        const isSpecialFlowActive = !!imageReplaceTask || !!pendingFlowDetails;
        if (isSpecialFlowActive) {
            logger.info(`[Effect Mount] Skipping initial PR fetch because a special flow is active.`);
            return;
        }
        if (initialRepoUrl && initialRepoUrl.includes("github.com")) {
            logger.info(`[Effect Mount] Triggering initial PRs for ${initialRepoUrl}`);
            triggerGetOpenPRs(initialRepoUrl);
        } else { logger.debug(`[Effect Mount] Skipping initial PRs (no valid URL yet)`); }
    }, [triggerGetOpenPRs, repoUrlStateLocal, repoUrlFromContext, imageReplaceTask, pendingFlowDetails]); 

    useEffect(() => { 
        setFilesParsed(componentParsedFiles.length > 0);
     }, [componentParsedFiles, setFilesParsed]);

    useEffect(() => { 
        if (repoUrlFromContext && repoUrlStateLocal !== repoUrlFromContext) {
             logger.info(`[Effect URL Sync] Syncing local URL from context: ${repoUrlFromContext}`);
             updateRepoUrl(repoUrlFromContext);
        }
    }, [repoUrlFromContext, repoUrlStateLocal, updateRepoUrl]);

    useEffect(() => { 
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        const currentlyParsing = contextIsParsing ?? hookIsParsing;
        if (!hasContent && !currentAiRequestId && !aiActionLoading && !imageReplaceTask && !assistantLoading && !isProcessingPR && !currentlyParsing) {
            logger.log("[Effect State Reset Check] Resetting state (empty response/idle).");
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]);
            setComponentParsedFiles([]); setHookParsedFiles([]); setSelectedFileIds(new Set()); setPrTitle(""); setRequestCopied(false);
        } else if (hasContent && componentParsedFiles.length === 0 && validationStatus !== 'idle' && !currentlyParsing && !assistantLoading && !imageReplaceTask && !isProcessingPR && !aiActionLoading) {
            logger.log("[Effect State Reset Check] Resetting validation status (response changed, no files parsed).");
            setValidationStatus('idle'); setValidationIssues([]);
        }
    }, [ response, currentAiRequestId, aiActionLoading, imageReplaceTask, componentParsedFiles.length, contextIsParsing, hookIsParsing, assistantLoading, isProcessingPR, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues, setHookParsedFiles, setComponentParsedFiles, setSelectedFileIds, setPrTitle, setRequestCopied ]);

    useEffect(() => { 
        const loadLinks = async () => {
            const userId = user?.id || dbUser?.user_id; // Prefer TG user id, fallback to DB user_id
            if (!userId) { 
                logger.debug("[Effect Custom Links] No user ID, skipping link load.");
                setCustomLinks([]); 
                return; 
            }
            try {
                logger.debug(`[Effect Custom Links] Attempting to fetch user metadata for userId: ${userId}`);
                const { data: userData, error: fetchError } = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
                if (fetchError) { logger.error("[Effect Custom Links] Error fetching user metadata:", fetchError); toastError(`Ошибка загрузки ваших ссылок: ${fetchError.message}`); setCustomLinks([]); return; }
                if (userData?.metadata?.customLinks && Array.isArray(userData.metadata.customLinks)) { setCustomLinks(userData.metadata.customLinks); logger.debug(`[Effect Custom Links] Loaded ${userData.metadata.customLinks.length} custom links for user ${userId}.`); }
                else { setCustomLinks([]); logger.debug(`[Effect Custom Links] No custom links found or invalid format for user ${userId}.`); }
            } catch (e: any) { logger.error("[Effect Custom Links] Exception during fetch:", e); toastError(`Критическая ошибка при загрузке ссылок: ${e.message ?? 'Неизвестно'}`); setCustomLinks([]); }
        };
        loadLinks();
    }, [user, dbUser, toastError]); // Depend on both user objects

    useEffect(() => { 
        imageReplaceTaskRef.current = imageReplaceTask;
    }, [imageReplaceTask]);
    
    // --- Imperative Handle ---
    useImperativeHandle(ref, () => ({
        handleParse: () => { handlers.handleParse(); },
        selectAllParsedFiles: () => { handlers.handleSelectAllFiles(); },
        handleCreatePR: () => { handlers.handleCreateOrUpdatePR(); },
        setResponseValue: (val: string) => { setResponseValue(val); },
        updateRepoUrl: (url: string) => { updateRepoUrl(url); },
        handleDirectImageReplace: (task: ImageReplaceTask, files: FileNode[]) => {
            return handlers.handleDirectImageReplace(task, files);
        },
    }), [handlers, setResponseValue, updateRepoUrl]);
    
    // --- Derived State for Rendering ---
    const effectiveIsParsing = contextIsParsing ?? hookIsParsing;
    const isProcessingAny = assistantLoading || isProcessingPR || aiActionLoading || effectiveIsParsing || loadingPrs;
    const finalRepoUrlForForm = repoUrlStateLocal || repoUrlFromContext || "";
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedAssistantFiles.size > 0 && !!prTitle.trim() && !!finalRepoUrlForForm && !imageReplaceTask;
    const prButtonText = targetBranchName ? `Обновить Ветку` : "Создать PR";
    const prButtonIconNode = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIconNode = (isProcessingPR || assistantLoading) && !imageReplaceTask ? <FaSpinner className="animate-spin"/> : prButtonIconNode;
    const assistantTooltipText = `Вставь ответ AI -> '➡️' -> Проверь/Исправь -> Выбери файлы -> ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const showImageReplaceUI = !!imageReplaceTask || !!imageReplaceError;
    const showStandardAssistantUI = !showImageReplaceUI;
    const imageTaskFailed = !!imageReplaceError && !assistantLoading;
    const parseButtonDisabled = isProcessingAny || isWaitingForAiResponse || !response.trim() || !!imageReplaceTask;
    const fixButtonDisabled = isProcessingAny || isWaitingForAiResponse || !!imageReplaceTask;
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingAny || !!imageReplaceTask;
    
    logger.debug("[AICodeAssistant] Render setup complete. isProcessingAny:", isProcessingAny);

    // --- FINAL RENDER ---
    return (
        <div id="executor" className="p-4 bg-card text-foreground font-mono rounded-xl shadow-[0_0_15px_hsl(var(--brand-green)/0.3)] relative overflow-hidden flex flex-col gap-4 border border-border">
            <header className="flex justify-between items-center gap-2 flex-wrap">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-brand-yellow text-shadow-[0_0_10px_hsl(var(--brand-yellow))]">
                         {showImageReplaceUI ? (imageTaskFailed ? "🖼️ Ошибка Замены Картинки" : "🖼️ Статус Замены Картинки") : "🤖 AI Code Assistant"}
                     </h1>
                     {showStandardAssistantUI && ( <button className="cursor-help p-1" title={assistantTooltipText}> <FaCircleInfo className="text-brand-blue hover:text-brand-blue/80 transition" /> </button> )}
                 </div>
                 <button id="settings-modal-trigger-assistant" onClick={() => { triggerToggleSettingsModal(); }} className="p-2 text-muted-foreground hover:text-brand-cyan transition rounded-full hover:bg-muted/50 disabled:opacity-50" disabled={isProcessingAny} title="Настройки URL / Token / Ветки / PRs" > <FaCodeBranch className="text-xl" /> </button>
             </header>

            {showStandardAssistantUI && (
                 <>
                     <div>
                          <p className="text-brand-yellow mb-2 text-xs md:text-sm min-h-[18px]">
                              {isWaitingForAiResponse ? `⏳ Жду AI... (ID: ${currentAiRequestId?.substring(0,6)}...)` : isProcessingAny ? "⏳ Обработка..." : "2️⃣ Вставь ответ AI или жди. Затем '➡️'."}
                          </p>
                          <div className="relative group">
                              <textarea
                                 id="response-input"
                                 ref={aiResponseInputRefPassed}
                                 className={cn(
                                    "w-full p-3 pr-16 bg-input rounded-lg border border-border focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan focus:outline-none transition shadow-inner text-sm resize-y simple-scrollbar",
                                    "min-h-[360px]"
                                 )}
                                 defaultValue={response}
                                 onChange={(e) => setResponseValue(e.target.value)}
                                 placeholder={isWaitingForAiResponse ? "AI думает..." : isProcessingAny ? "Ожидание..." : "Ответ AI здесь..."}
                                 disabled={isProcessingAny}
                                 spellCheck="false"
                              />
                              <TextAreaUtilities
                                 response={response}
                                 isLoading={isProcessingAny}
                                 onParse={handlers.handleParse}
                                 onOpenModal={handlers.handleOpenModal}
                                 onCopy={handlers.handleCopyResponse}
                                 onClear={handlers.handleClearResponse}
                                 onSelectFunction={handlers.handleSelectFunction}
                                 isParseDisabled={parseButtonDisabled}
                                 isProcessingPR={assistantLoading || isProcessingPR}
                              />
                          </div>
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               <ValidationStatusIndicator
                                  status={validationStatus}
                                  issues={validationIssues}
                                  onAutoFix={handlers.handleAutoFix}
                                  isFixDisabled={fixButtonDisabled}
                               />
                          </div>
                      </div>

                     <ParsedFilesList
                        parsedFiles={componentParsedFiles}
                        selectedFileIds={selectedFileIds}
                        validationIssues={validationIssues}
                        onToggleSelection={handlers.handleToggleFileSelection}
                        onSelectAll={handlers.handleSelectAllFiles}
                        onDeselectAll={handlers.handleDeselectAllFiles}
                        onSaveFiles={handlers.handleSaveFiles}
                        onDownloadZip={handlers.handleDownloadZip}
                        onSendToTelegram={handlers.handleSendToTelegram}
                        isUserLoggedIn={!!user || !!dbUser}
                        isLoading={isProcessingAny}
                     />

                     <PullRequestForm
                        id="pr-form-container"
                        repoUrl={finalRepoUrlForForm}
                        prTitle={prTitle}
                        selectedFileCount={selectedAssistantFiles.size}
                        isLoading={isProcessingPR || assistantLoading}
                        isLoadingPrList={loadingPrs}
                        onRepoUrlChange={updateRepoUrl}
                        onPrTitleChange={setPrTitle}
                        onCreatePR={handlers.handleCreateOrUpdatePR}
                        buttonText={prButtonText}
                        buttonIcon={prButtonLoadingIconNode}
                        isSubmitDisabled={submitButtonDisabled}
                     />

                     <OpenPrList openPRs={contextOpenPrs} />

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <ToolsMenu
                           customLinks={customLinks}
                           onAddCustomLink={handlers.handleAddCustomLink}
                           disabled={isProcessingAny}
                        />
                         <button
                            onClick={async () => {
                                setIsImageModalOpen(true);
                                if (dbUser?.user_id) {
                                    logger.debug(`[AICodeAssistant] User ${dbUser.user_id} opened image modal. Attempting to log feature 'image_modal_opened'.`);
                                    const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'image_modal_opened');
                                    newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                                } else {
                                    logger.warn("[AICodeAssistant] Cannot log 'image_modal_opened': dbUser.user_id is missing.");
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-card rounded-full hover:bg-muted transition shadow-[0_0_12px_hsl(var(--brand-green)/0.3)] hover:ring-1 hover:ring-brand-cyan disabled:opacity-50 relative"
                            disabled={isProcessingAny}
                            title="Загрузить/Связать Картинки (prompts_imgs.txt)"
                         >
                             <FaImage className="text-muted-foreground" />
                             <span className="text-sm text-foreground">Картинки</span>
                             {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-blue rounded-full border-2 border-card shadow-md animate-pulse"></span>
                             )}
                         </button>
                    </div>
                 </>
            )}

            {showImageReplaceUI && (
                 <div className={clsx(
                     "flex flex-col items-center justify-center text-center p-6 bg-card/50 rounded-lg border border-dashed min-h-[200px]",
                     imageTaskFailed ? 'border-destructive' : 'border-brand-blue'
                 )}>
                     {assistantLoading ? <FaSpinner className="text-brand-purple text-4xl mb-4 animate-spin" />
                       : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? <FaSpinner className="text-brand-blue text-4xl mb-4 animate-spin" />
                       : imageTaskFailed ? <FaCircleXmark className="text-destructive text-4xl mb-4" />
                       : imageReplaceTask ? <FaImages className="text-brand-blue text-4xl mb-4" />
                       : <FaCheck className="text-brand-green text-4xl mb-4" />
                     }
                     <p className={clsx(
                         "text-lg font-semibold",
                         imageTaskFailed ? 'text-destructive' : 'text-brand-blue'
                     )}>
                         {assistantLoading ? "Обработка Замены..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Загрузка Файла..."
                           : imageTaskFailed ? "Ошибка Замены Картинки"
                           : imageReplaceTask ? "Задача Замены Активна"
                           : "Процесс Замены Завершен"}
                     </p>
                     <p className="text-sm text-muted-foreground mt-2">
                          {assistantLoading ? "Меняю URL в файле и создаю/обновляю PR..."
                           : (fetchStatus === 'loading' || fetchStatus === 'retrying') ? "Ожидание ответа от GitHub..."
                           : imageTaskFailed ? (imageReplaceError || "Произошла неизвестная ошибка.")
                           : imageReplaceTask ? "Файл загружен, ожидание обработки Ассистентом..."
                           : "Задача выполнена или сброшена."}
                     </p>
                     {imageReplaceTask && (
                         <div className="mt-3 text-xs text-muted-foreground break-all text-left bg-input/50 p-2 rounded max-w-full overflow-x-auto simple-scrollbar">
                             <p><span className="font-semibold text-foreground">Файл:</span> {imageReplaceTask.targetPath}</p>
                             <p><span className="font-semibold text-foreground">Старый URL:</span> {imageReplaceTask.oldUrl}</p>
                             <p><span className="font-semibold text-foreground">Новый URL:</span> {imageReplaceTask.newUrl}</p>
                         </div>
                     )}
                     {imageTaskFailed && (
                          <button
                              onClick={handleResetImageError}
                              className="mt-4 px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs rounded-md transition"
                          > Сбросить Ошибку </button>
                      )}
                 </div>
             )}

            <AnimatePresence>
                {showStandardAssistantUI && showModal && (
                    <SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handlers.handleSwap} onSearch={handlers.handleSearch} initialMode={modalMode} />
                )}
                {showStandardAssistantUI && isImageModalOpen && (
                    <ImageToolsModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} parsedFiles={componentParsedFiles} onUpdateParsedFiles={handlers.handleUpdateParsedFiles}/>
                )}
             </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;