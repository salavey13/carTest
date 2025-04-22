// ... (imports and other code remain the same) ...

// --- Main Component ---
"use client";

const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    // ... (hooks, context, state remain the same) ...

    // --- Combined PR/Update Handler (For Regular AI Flow) ---
    const handleCreateOrUpdatePR = useCallback(async (): Promise<void> => {
         if (imageReplaceTask) { toast.warn("Действие недоступно во время замены картинки."); return; }
        const selectedFilesContent = componentParsedFiles.filter(f => selectedFileIds.has(f.id));
        if (!repoUrl || selectedFilesContent.length === 0 || !prTitle) { toast.error("Укажите URL репо, Заголовок PR/Commit и выберите файлы (после разбора ➡️)."); return; }

        // Construct description (this IS the comment body)
        let finalDescription = rawDescription.substring(0, 60000) + (rawDescription.length > 60000 ? "\n\n...(описание усечено)" : "");
        finalDescription += `\n\n**Файлы (${selectedFilesContent.length}):**\n` + selectedFilesContent.map(f => `- \`${f.path}\``).join('\n');
        const relevantIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment');
        if (relevantIssues.length > 0) { finalDescription += "\n\n**Обнаруженные Проблемы:**\n" + relevantIssues.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); }

        const commitSubject = prTitle.substring(0, 70);
        const commitBody = `Apply AI changes to ${selectedFilesContent.length} files.\nRef: ${rawDescription.split('\n')[0]?.substring(0, 100) ?? ''}...`;
        const fullCommitMessage = `${commitSubject}\n\n${commitBody}`;
        const filesToCommit = selectedFilesContent.map(f => ({ path: f.path, content: f.content }));

        setIsProcessingPR(true); setAssistantLoading(true);

        try {
            let prToUpdate: SimplePullRequest | null = null;
            // Check for existing relevant PRs
            if (contextOpenPrs && contextOpenPrs.length > 0) {
                // More lenient matching: Find any PR whose title suggests AI changes
                 prToUpdate = contextOpenPrs.find(pr =>
                     pr.title.toLowerCase().includes("ai changes") ||
                     pr.title.toLowerCase().includes("supervibe studio") ||
                     pr.title.toLowerCase().includes("ai assistant update")
                 ) ?? null;
                if (prToUpdate) {
                    console.log(`Found existing PR #${prToUpdate.number} to update (Title: ${prToUpdate.title}).`);
                    toast.info(`Найден существующий PR #${prToUpdate.number}. Обновляю его...`);
                }
            }

            const branchToUpdate = prToUpdate?.head.ref || targetBranchName;

            if (branchToUpdate) {
                toast.info(`Обновление ветки '${branchToUpdate}'...`);
                // <<< --- Pass prToUpdate?.number and finalDescription to trigger --- >>>
                await triggerUpdateBranch(
                    repoUrl,
                    filesToCommit,
                    fullCommitMessage,
                    branchToUpdate,
                    prToUpdate?.number, // Pass PR number
                    finalDescription    // Pass description as comment body
                );
                await triggerGetOpenPRs(repoUrl); // Refresh PR list
            } else {
                // Create New Pull Request (No change needed here, description goes into PR body)
                toast.info(`Создание нового PR...`);
                const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, finalDescription, fullCommitMessage);
                if (result.success && result.prUrl) {
                    toast.success(`PR создан: ${result.prUrl}`);
                    await notifyAdmin(`🤖 PR с AI изменениями создан ${user?.username || user?.id}: ${result.prUrl}`);
                    await triggerGetOpenPRs(repoUrl); // Refresh PR list
                } else {
                    toast.error("Ошибка создания PR: " + (result.error || "Неизвестная ошибка")); logger.error("PR Creation Failed (Regular):", result.error);
                }
            }
        } catch (err) {
            toast.error(`Критическая ошибка при ${targetBranchName ? 'обновлении ветки' : 'создании PR'}.`); logger.error("PR/Update critical error:", err);
        } finally { setIsProcessingPR(false); setAssistantLoading(false); }
    }, [ componentParsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, targetBranchName, contextOpenPrs, triggerUpdateBranch, setAssistantLoading, user, triggerGetOpenPRs, notifyAdmin, imageReplaceTask ]);


    // --- MODIFIED: Direct Image Replacement Handler (Checks for existing PR & passes comment) ---
    const handleDirectImageReplace = useCallback(async (task: ImageReplaceTask): Promise<void> => {
        console.log("AICodeAssistant: handleDirectImageReplace called with task:", task);
        setIsProcessingPR(true); setAssistantLoading(true);

        try {
            const targetFile = allFetchedFiles.find(f => f.path === task.targetPath);
            if (!targetFile) { throw new Error(`Целевой файл "${task.targetPath}" не найден среди загруженных.`); }

            let currentContent = targetFile.content;
            if (!currentContent.includes(task.oldUrl)) { toast.warn(`Старый URL картинки не найден в файле ${task.targetPath}. Изменений не будет.`); setIsProcessingPR(false); setAssistantLoading(false); setImageReplaceTask(null); return; }
            const modifiedContent = currentContent.replaceAll(task.oldUrl, task.newUrl);
            if (modifiedContent === currentContent) { toast.info(`Контент файла ${task.targetPath} не изменился после замены.`); setIsProcessingPR(false); setAssistantLoading(false); setImageReplaceTask(null); return; }

            console.log(`Performing replacement in ${task.targetPath}.`);

            const filesToCommit: { path: string; content: string }[] = [{ path: task.targetPath, content: modifiedContent }];
            const commitTitle = `chore: Update image in ${task.targetPath}`;
            // <<< --- This prDescription IS the comment body --- >>>
            const prDescription = `Replaced image via SuperVibe Studio.\n\nOld: ${task.oldUrl}\nNew: ${task.newUrl}`;
            const fullCommitMessage = `${commitTitle}\n\n${prDescription}`; // Use description in commit body too
            const prTitle = commitTitle;

            let existingPrBranch: string | null = null;
            let existingPrNumber: number | null = null; // <<< Store PR number too
            const expectedPrTitle = `chore: Update image in ${task.targetPath}`;
             if (contextOpenPrs && contextOpenPrs.length > 0) {
                 const matchingPr = contextOpenPrs.find(pr => pr.title === expectedPrTitle);
                 if (matchingPr) {
                     existingPrBranch = matchingPr.head.ref;
                     existingPrNumber = matchingPr.number; // <<< Get the number
                     console.log(`Found existing image PR #${existingPrNumber} (Branch: ${existingPrBranch}) for file ${task.targetPath}. Will update.`);
                     toast.info(`Обновляю существующий PR #${existingPrNumber} для этой картинки...`);
                 }
             }

            const branchToUpdate = existingPrBranch || targetBranchName;

            if (branchToUpdate) {
                toast.info(`Обновление ветки '${branchToUpdate}' (замена картинки)...`);
                // <<< --- Pass existingPrNumber and prDescription --- >>>
                const result = await updateBranch(
                    repoUrl,
                    filesToCommit,
                    fullCommitMessage,
                    branchToUpdate,
                    existingPrNumber, // Pass PR number if found
                    prDescription     // Pass description as comment body
                );
                if (result.success) { toast.success(`Ветка '${branchToUpdate}' обновлена (картинка)!`); await triggerGetOpenPRs(repoUrl); }
                else { toast.error(`Ошибка обновления ветки '${branchToUpdate}': ${result.error}`); }
            } else {
                // Create New Pull Request (No comment needed here)
                toast.info(`Создание нового PR (замена картинки)...`);
                 const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, prDescription, fullCommitMessage);
                 if (result.success && result.prUrl) {
                     toast.success(`PR для замены картинки создан: ${result.prUrl}`);
                     await notifyAdmin(`🖼️ PR для замены картинки в ${task.targetPath} создан ${user?.username || user?.id}: ${result.prUrl}`);
                     await triggerGetOpenPRs(repoUrl);
                 }
                 else { toast.error("Ошибка создания PR: " + (result.error || "Неизвестная ошибка")); logger.error("PR Creation Failed (Image Replace):", result.error); }
            }
        } catch (err: any) {
            toast.error(`Ошибка при замене картинки: ${err.message}`); logger.error("handleDirectImageReplace error:", err);
        } finally {
            setIsProcessingPR(false);
            setAssistantLoading(false);
            setImageReplaceTask(null); // Clear the task upon completion/failure
        }

    }, [ allFetchedFiles, contextOpenPrs, targetBranchName, repoUrl, notifyAdmin, user, setAssistantLoading, setImageReplaceTask, triggerGetOpenPRs ]);

    // ... (rest of the component remains the same) ...

    const setResponseValue = useCallback((value: string) => {
        setResponse(value); if (aiResponseInputRef.current) { aiResponseInputRef.current.value = value; } setHookParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]);
    }, [aiResponseInputRef, setHookParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    const updateRepoUrl = useCallback((url: string) => { setRepoUrlState(url); }, []);

    useImperativeHandle(ref, () => ({
        handleParse,
        selectAllParsedFiles: handleSelectAllFiles,
        handleCreatePR: handleCreateOrUpdatePR, // Point to the combined handler
        setResponseValue,
        updateRepoUrl,
        handleDirectImageReplace, // Expose the new method
    }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, handleDirectImageReplace]);

    // --- RENDER ---
    const isProcessingAny = assistantLoading || aiActionLoading || contextIsParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const canSubmitRegularPR = !isProcessingAny && filesParsed && selectedFileIds.size > 0 && !!prTitle && !!repoUrl;
    const prButtonText = targetBranchName ? `Обновить Ветку (${targetBranchName.substring(0, 15)}...)` : "Создать PR";
    const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIcon = isProcessingPR ? <FaArrowsRotate className="animate-spin"/> : prButtonIcon;
    const assistantTooltipText = `Вставьте ответ AI ИЛИ используйте кнопку 'Спросить AI'. Затем '➡️' → Проверьте/Исправьте → Выберите файлы → ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const commonDisabled = isProcessingAny || !!imageReplaceTask; // Disable most things during image replace too
    const parseButtonDisabled = commonDisabled || isWaitingForAiResponse || !response.trim();
    const fixButtonDisabled = commonDisabled || isWaitingForAiResponse;
    const submitButtonDisabled = !canSubmitRegularPR || isProcessingPR || !!imageReplaceTask;
    const showStandardAssistantUI = !imageReplaceTask;


    return (
         <div id="executor" className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            {/* Header */}
             <header className="flex justify-between items-center gap-2">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">AI Code Assistant</h1>
                     {showStandardAssistantUI && (
                         <Tooltip text={assistantTooltipText} position="left">
                             <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
                         </Tooltip>
                     )}
                 </div>
                 <Tooltip text="Настройки URL/Token/Ветки/PR" position="left">
                      <button id="settings-modal-trigger-assistant" onClick={triggerToggleSettingsModal} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={commonDisabled} > <FaCodeBranch className="text-xl" /> </button>
                 </Tooltip>
             </header>

            {/* Conditionally render standard UI vs Image Replace message */}
            {showStandardAssistantUI ? (
                 <>
                    {/* ... (Standard UI elements: textarea, lists, form, toolbar) ... */}
                      {/* AI Response Input Area */}
                      <div>
                          <p className="text-yellow-400 mb-2 text-xs md:text-sm">
                             {isWaitingForAiResponse
                                 ? `⏳ Ожидание ответа от AI... (ID: ${currentAiRequestId?.substring(0,6)}...)`
                                 : "2️⃣ Ответ от AI появится здесь (или вставьте). Затем '➡️'."}
                          </p>
                          <div className="relative group">
                              <textarea
                                  id="response-input"
                                  ref={aiResponseInputRef}
                                  className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                                  defaultValue={response}
                                  onChange={(e) => setResponse(e.target.value)}
                                  placeholder={isWaitingForAiResponse ? "AI думает..." : "Ответ от AI появится здесь..."}
                                  disabled={commonDisabled}
                                  spellCheck="false"
                              />
                              <TextAreaUtilities
                                  response={response}
                                  isLoading={commonDisabled}
                                  onParse={handleParse}
                                  onOpenModal={handleOpenModal}
                                  onCopy={handleCopyResponse}
                                  onClear={handleClearResponse}
                                  onSelectFunction={handleSelectFunction}
                                  isParseDisabled={parseButtonDisabled}
                                  isProcessingPR={isProcessingPR}
                              />
                          </div>
                          {/* Validation Status and Actions */}
                           <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                               <CodeRestorer
                                  parsedFiles={componentParsedFiles} // Pass local state
                                  originalFiles={originalRepoFiles}
                                  skippedIssues={skippedCodeBlockIssues}
                                  onRestorationComplete={handleRestorationComplete}
                                  disabled={commonDisabled || validationStatus === 'validating' || isFetchingOriginals}
                               />
                               <ValidationStatusIndicator
                                   status={validationStatus}
                                   issues={validationIssues}
                                   onAutoFix={handleAutoFix}
                                   onCopyPrompt={handleCopyFixPrompt}
                                   isFixDisabled={fixButtonDisabled}
                               />
                          </div>
                      </div>

                     {/* Parsed Files List */}
                     <ParsedFilesList
                         parsedFiles={componentParsedFiles} // Use local state
                         selectedFileIds={selectedFileIds}
                         validationIssues={validationIssues}
                         onToggleSelection={handleToggleFileSelection}
                         onSelectAll={handleSelectAllFiles}
                         onDeselectAll={handleDeselectAllFiles}
                         onSaveFiles={handleSaveFiles}
                         onDownloadZip={handleDownloadZip}
                         onSendToTelegram={handleSendToTelegram}
                         isUserLoggedIn={!!user}
                         isLoading={commonDisabled}
                     />

                     {/* PR Form */}
                     <PullRequestForm
                          repoUrl={repoUrl}
                          prTitle={prTitle}
                          selectedFileCount={selectedFileIds.size}
                          isLoading={isProcessingPR} // Use specific PR processing state
                          isLoadingPrList={loadingPrs}
                          onRepoUrlChange={(url) => { setRepoUrlState(url); updateRepoUrlInAssistant(url); }}
                          onPrTitleChange={setPrTitle}
                          onCreatePR={handleCreateOrUpdatePR} // Use combined handler
                          buttonText={prButtonText}
                          buttonIcon={prButtonLoadingIcon}
                          isSubmitDisabled={submitButtonDisabled} // Use updated disabled logic
                     />

                     {/* Open PR List */}
                     <OpenPrList openPRs={contextOpenPrs} />

                    {/* Toolbar Area */}
                    <div className="flex items-center gap-3 mb-2">
                        <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />
                         <Tooltip text="Загрузить/Связать Картинки" position="left">
                             <button onClick={() => setIsImageModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50 relative" disabled={commonDisabled} >
                                <FaImage className="text-gray-400" />
                                <span className="text-sm text-white">Картинки</span>
                                {componentParsedFiles.some(f => f.path === '/prompts_imgs.txt') && !isImageModalOpen && (
                                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 animate-pulse"></span>
                                 )}
                             </button>
                         </Tooltip>
                    </div>

                 </>
            ) : (
                 // Message shown during image replacement processing
                 <div className="flex flex-col items-center justify-center text-center p-6 bg-gray-800/50 rounded-lg border border-dashed border-blue-400 min-h-[200px]">
                     {assistantLoading ? (
                        <FaArrowsRotate className="text-blue-400 text-4xl mb-4 animate-spin" />
                     ) : (
                         <FaImages className="text-blue-400 text-4xl mb-4" />
                     )}
                     <p className="text-lg font-semibold text-blue-300">
                         {assistantLoading ? "Заменяю картинку..." : "Задача замены картинки"}
                     </p>
                     <p className="text-sm text-gray-400 mt-2">
                          {assistantLoading ? "Ищу существующий PR или создаю новый/обновляю ветку..." : "Процесс завершен или ожидает запуска."}
                     </p>
                     {imageReplaceTask && <p className="text-xs text-gray-500 mt-3 break-all">Файл: {imageReplaceTask.targetPath}<br/>Старый URL: {imageReplaceTask.oldUrl.substring(0,50)}...<br/>Новый URL: {imageReplaceTask.newUrl.substring(0,50)}...</p>}
                 </div>
            )}


             {/* Modals */}
             <AnimatePresence>
                 {showModal && ( <SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handleSwap} onSearch={handleSearch} initialMode={modalMode} /> )}
                 {isImageModalOpen && (
                    <ImageToolsModal
                        isOpen={isImageModalOpen}
                        onClose={() => setIsImageModalOpen(false)}
                        parsedFiles={componentParsedFiles} // Use local state
                        onUpdateParsedFiles={handleUpdateParsedFiles}
                    />
                 )}
             </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;