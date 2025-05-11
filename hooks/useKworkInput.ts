import { useCallback } from "react";
import { useRepoXmlPageContext, FileNode } from "@/contexts/RepoXmlPageContext";
import { useAppContext } from "@/contexts/AppContext";
import { logCyberFitnessAction, checkAndUnlockFeatureAchievement, Achievement } from "@/hooks/cyberFitnessSupabase";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";
// import * as repoUtils from "@/lib/repoUtils"; // Keep this for getLanguage if needed elsewhere

interface UseKworkInputProps {
    selectedFetcherFiles: Set<string>;
    allFetchedFiles: FileNode[];
    imageReplaceTaskActive: boolean;
    files: FileNode[];
}

interface UseKworkInputReturn {
    handleAddSelected: () => void;
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    handleClearAll: () => void;
    handleAddFullTree: () => void;
}

const getFileLanguage = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
        case 'ts': return 'typescript';
        case 'tsx': return 'tsx';
        case 'js': return 'javascript';
        case 'jsx': return 'jsx';
        case 'json': return 'json';
        case 'py': return 'python';
        case 'md': return 'markdown';
        case 'css': return 'css';
        case 'html': return 'html';
        case 'scss': return 'scss';
        case 'less': return 'less';
        case 'java': return 'java';
        case 'kt': return 'kotlin';
        case 'go': return 'go';
        case 'rb': return 'ruby';
        case 'php': return 'php';
        case 'sql': return 'sql';
        case 'yaml':
        case 'yml': return 'yaml';
        case 'sh': return 'bash';
        case 'ps1': return 'powershell';
        case 'xml': return 'xml';
        case 'swift': return 'swift';
        case 'c':
        case 'h': return 'c'; 
        case 'cpp':
        case 'hpp': return 'cpp';
        case 'cs': return 'csharp';
        case 'txt': return 'plaintext';
        default: return 'plaintext';
    }
};

export const useKworkInput = ({
    selectedFetcherFiles,
    allFetchedFiles,
    imageReplaceTaskActive,
    files, 
}: UseKworkInputProps): UseKworkInputReturn => {
    logger.debug("[useKworkInput] Hook initialized");
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useAppToast();
    const { dbUser } = useAppContext(); 

    const {
        kworkInputRef,       
        kworkInputValue,     
        setKworkInputValue,  
        setRequestCopied,
        setSelectedFetcherFiles,
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        scrollToSection,
        addToast, 
    } = useRepoXmlPageContext();

    const handleAddSelected = useCallback(async () => {
        if (imageReplaceTaskActive) {
            logger.warn("[Kwork Input] Add Selected skipped: Image replace task active.");
            toastWarning("Добавление файлов недоступно во время задачи замены картинки.");
            return;
        }
        if (selectedFetcherFiles.size === 0) {
            toastWarning("Нет выбранных файлов для добавления в запрос.");
            logger.warn("[Kwork Input] Add Selected skipped: No files selected.");
            return;
        }
        logger.info(`[Kwork Input] Adding ${selectedFetcherFiles.size} selected files to input as individual code blocks...`);
        
        let filesAddedCount = 0;
        const fileBlocksContent = Array.from(selectedFetcherFiles).map(path => {
            const fileNode = allFetchedFiles.find(f => f.path === path);
            let contentToDisplay: string;

            if (!fileNode) {
                contentToDisplay = `// Error: File /${path} not found in allFetchedFiles.`;
                logger.warn(`[Kwork Input] File /${path} not found in allFetchedFiles during AddSelected.`);
            } else if (typeof fileNode.content === 'string') {
                contentToDisplay = fileNode.content;
                filesAddedCount++;
            } else if (fileNode.content === null) {
                contentToDisplay = `// Info: Content for /${path} is null (e.g., empty file).`;
                logger.info(`[Kwork Input] Content for file /${path} is null during AddSelected.`);
            } else {
                contentToDisplay = `// Warning: Content for /${path} is of unexpected type (${typeof fileNode.content}). Displaying as empty.`;
                logger.warn(`[Kwork Input] Content for /${path} is of unexpected type: ${typeof fileNode.content} during AddSelected. Defaulting to empty string.`);
                contentToDisplay = ""; 
            }

            const language = getFileLanguage(path);
            const pathComment = `// /${path}`;
            if (contentToDisplay.startsWith("// Error:") || contentToDisplay.startsWith("// Info:") || contentToDisplay.startsWith("// Warning:") || contentToDisplay.trim()) {
                return `${pathComment}\n\`\`\`${language}\n${contentToDisplay.trim()}\n\`\`\``;
            }
            return null;
        }).filter(block => block !== null).join("\n\n// ---- FILE SEPARATOR ----\n\n");

        if (!fileBlocksContent.trim() && filesAddedCount === 0) {
            toastWarning("Выбранные файлы пусты или не содержат полезного контента для добавления.");
            logger.warn("[Kwork Input] Add Selected: No actual content from selected files to add.");
            return;
        }
        
        const codeContextMarker = "Контекст кода для анализа:";
        const structureMarker = "Структура файлов проекта:";
        const newCodeContextSection = `${codeContextMarker}\n\n${fileBlocksContent}`;

        const currentKworkValue = kworkInputValue || "";
        let finalKworkValue = "";

        const idxCode = currentKworkValue.indexOf(codeContextMarker);
        const idxStructure = currentKworkValue.indexOf(structureMarker);

        if (idxCode !== -1) {
            let endOfOldCodeSection = currentKworkValue.length;
            if (idxStructure !== -1 && idxStructure > idxCode) {
                endOfOldCodeSection = idxStructure;
            }
            const textBefore = currentKworkValue.substring(0, idxCode);
            const textAfter = currentKworkValue.substring(endOfOldCodeSection);
            finalKworkValue = (textBefore.trimEnd() + 
                               (textBefore.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd() + 
                               (textAfter.trimStart() ? "\n\n" : "") + 
                               textAfter.trimStart());
        } else if (idxStructure !== -1) {
            const textBeforeStructure = currentKworkValue.substring(0, idxStructure);
            const structureAndAfter = currentKworkValue.substring(idxStructure);
            finalKworkValue = (textBeforeStructure.trimEnd() + 
                               (textBeforeStructure.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd() + 
                               "\n\n" + 
                               structureAndAfter.trimStart());
        } else {
            finalKworkValue = (currentKworkValue.trimEnd() + 
                               (currentKworkValue.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd());
        }
        
        finalKworkValue = finalKworkValue.replace(/\n{3,}/g, '\n\n').trim();

        setKworkInputValue(finalKworkValue);
        toastSuccess(`${filesAddedCount} файлов добавлено в запрос.`);
        
        if (dbUser?.id && filesAddedCount > 0) {
            const logResult = await logCyberFitnessAction(dbUser.id.toString(), 'filesExtracted', filesAddedCount);
            if (logResult.success) {
                logger.log(`[useKworkInput] CyberFitness: ${filesAddedCount} filesExtracted logged.`);
                logResult.newAchievements?.forEach(ach => {
                    addToast(`🏆 Достижение: ${ach.name}!`, "success", 5000, { description: ach.description });
                });
            } else {
                logger.warn(`[useKworkInput] CyberFitness: filesExtracted logging failed: ${logResult.error}`);
            }
        }
        scrollToSection('kworkInput');

    }, [
        selectedFetcherFiles, allFetchedFiles, imageReplaceTaskActive, toastSuccess, toastWarning,
        kworkInputValue, setKworkInputValue, 
        scrollToSection, logger, dbUser?.id, addToast
    ]);

    const handleCopyToClipboard = useCallback(async (textToCopy?: string, shouldScroll = true): Promise<boolean> => {
        const contentToUse = textToCopy ?? (kworkInputValue || ""); 
        if (!contentToUse.trim()) {
            toastWarning("Нет текста для копирования");
            logger.warn("[Kwork Input] Copy skipped: Input is empty.");
            return false;
        }
        try {
            navigator.clipboard.writeText(contentToUse);
            toastSuccess("Текст запроса скопирован!");
            setRequestCopied(true);
            logger.info("[Kwork Input] Copied request to clipboard.");
            
            if (dbUser?.id) {
                const logResult = await logCyberFitnessAction(dbUser.id.toString(), 'kworkRequestSent', 1);
                if (logResult.success) {
                    logger.log(`[useKworkInput] CyberFitness: kworkRequestSent logged.`);
                    logResult.newAchievements?.forEach(ach => {
                        addToast(`🏆 Достижение: ${ach.name}!`, "success", 5000, { description: ach.description });
                    });
                } else {
                     logger.warn(`[useKworkInput] CyberFitness: kworkRequestSent logging failed: ${logResult.error}`);
                }
            }

            if (shouldScroll) scrollToSection('executor'); 
            return true;
        } catch (e) {
            logger.error("[Kwork Input] Clipboard write error:", e);
            toastError("Ошибка копирования в буфер обмена");
            return false;
        }
    }, [kworkInputValue, toastSuccess, toastWarning, toastError, setRequestCopied, scrollToSection, logger, dbUser?.id, addToast]); 

    const handleClearAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[Kwork Input] Clear All skipped: Image replace task active.");
            toastWarning("Очистка недоступна во время задачи замены картинки.");
            return;
        }
        logger.info("[Kwork Input] Clearing input, selection, and related states.");
        setSelectedFetcherFiles(new Set());
        setKworkInputValue(""); 
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        setRequestCopied(false);
        toastSuccess("Форма очищена ✨");
        if (kworkInputRef.current) kworkInputRef.current.focus(); 
    }, [
        imageReplaceTaskActive, setSelectedFetcherFiles, setKworkInputValue, 
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied,
        toastSuccess, toastWarning, logger, kworkInputRef
    ]);

     const handleAddFullTree = useCallback(async () => {
         if (imageReplaceTaskActive) {
             logger.warn("[Kwork Input] Add Tree skipped: Image replace task active.");
             toastWarning("Добавление дерева файлов недоступно во время задачи замены картинки.");
             return;
         }
         if (files.length === 0) {
             toastWarning("Нет загруженных файлов для добавления дерева.");
             logger.warn("[Kwork Input] Add Tree skipped: No files loaded.");
             return;
         }

         logger.info(`[Kwork Input] Adding full file tree structure and content for ${files.length} files to input...`);
         
         const treeStructure = "Структура дерева файлов временно недоступна (generateTreeStructure отсутствует)."; 

         const structureMarker = "Структура файлов проекта:";
         const newStructureSection = `${structureMarker}\n\`\`\`\n${treeStructure.trim()}\n\`\`\``;
         
         let filesAddedCount = 0;
         const fileBlocksContent = files.map(file => {
             let contentToDisplay: string;
             if (typeof file.content === 'string' && file.content.trim()) {
                 contentToDisplay = file.content;
                 filesAddedCount++;
             } else {
                 contentToDisplay = `// Файл /${file.path} пуст или содержит только комментарии.`;
             }
             const language = getFileLanguage(file.path);
             const pathComment = `// /${file.path}`;
             return `${pathComment}\n\`\`\`${language}\n${contentToDisplay.trim()}\n\`\`\``;
         }).join("\n\n// ---- FILE SEPARATOR ----\n\n");

        const codeContextMarker = "Контекст кода для анализа:";
        const newCodeContextSection = `${codeContextMarker}\n\n${fileBlocksContent}`;
        
        const currentKworkValue = kworkInputValue || "";
        let finalKworkValue = "";

        const idxCurrentStructure = currentKworkValue.indexOf(structureMarker);
        const idxCurrentCode = currentKworkValue.indexOf(codeContextMarker);

        let textBefore = "";
        let textAfter = currentKworkValue; 

        if (idxCurrentStructure !== -1) {
            const oldStructureBlockRegex = new RegExp(structureMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*```([\\s\\S]*?)```", "im");
            const match = oldStructureBlockRegex.exec(currentKworkValue);
            if (match && match.index === idxCurrentStructure) {
                textBefore = currentKworkValue.substring(0, idxCurrentStructure);
                textAfter = currentKworkValue.substring(idxCurrentStructure + match[0].length);
            } else { 
                textBefore = currentKworkValue;
                textAfter = "";
            }
        } else { 
           textAfter = currentKworkValue;
        }
        
        finalKworkValue = textBefore.trimEnd() + (textBefore.trimEnd() ? "\n\n" : "") + newStructureSection.trimEnd();
        
        const currentContentUpToStructure = finalKworkValue; 
        const remainingTextAfterStructure = textAfter.trimStart(); 

        if (idxCurrentCode !== -1 && idxCurrentCode > (idxCurrentStructure + (idxCurrentStructure !== -1 ? newStructureSection.length : 0) ) ) {
            logger.warn("[Kwork Input] Add Tree: Old code context was after structure. Appending new code context after new structure.");
            finalKworkValue = currentContentUpToStructure.trimEnd() + (remainingTextAfterStructure ? "\n\n" + remainingTextAfterStructure : "") + "\n\n" + newCodeContextSection.trimEnd();
        } else if (idxCurrentCode !== -1 && idxCurrentCode < idxCurrentStructure) {
            const oldCodeBlockRegex = new RegExp(codeContextMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "([\\s\\S]*?)(?=" + structureMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "|$)","im");
            const codeMatch = oldCodeBlockRegex.exec(currentKworkValue); 
            if (codeMatch && codeMatch.index === idxCurrentCode) {
                 const textBeforeCode = currentKworkValue.substring(0, idxCurrentCode);
                 finalKworkValue = textBeforeCode.trimEnd() + (textBeforeCode.trimEnd() ? "\n\n" : "") + newCodeContextSection.trimEnd() + "\n\n" + newStructureSection.trimEnd() + (remainingTextAfterStructure ? "\n\n" + remainingTextAfterStructure : "");
                 logger.debug("[Kwork Input] Add Tree: Replaced code context (before structure) and then added/replaced structure.");
            } else {
                 logger.warn("[Kwork Input] Add Tree: Code marker found but not a proper block before structure. Appending new code context after new structure.");
                 finalKworkValue = currentContentUpToStructure.trimEnd() + (remainingTextAfterStructure ? "\n\n" + remainingTextAfterStructure : "") + "\n\n" + newCodeContextSection.trimEnd();
            }
        } else if (idxCurrentCode !== -1) { 
             const oldCodeBlockRegex = new RegExp(codeContextMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "([\\s\\S]*?)$","im"); 
             const codeMatch = oldCodeBlockRegex.exec(currentKworkValue);
             if(codeMatch && codeMatch.index === idxCurrentCode) {
                const textBeforeCode = currentKworkValue.substring(0, idxCurrentCode);
                finalKworkValue = textBeforeCode.trimEnd() + (textBeforeCode.trimEnd() ? "\n\n" : "") + newStructureSection.trimEnd() + "\n\n" + newCodeContextSection.trimEnd();
                logger.debug("[Kwork Input] Add Tree: Replaced code context (no structure or structure was first), then added structure.");
             } else {
                finalKworkValue = currentContentUpToStructure.trimEnd() + (remainingTextAfterStructure ? "\n\n" + remainingTextAfterStructure : "") + "\n\n" + newCodeContextSection.trimEnd();
                logger.warn("[Kwork Input] Add Tree: Code marker found but not proper block. Appending new code context after new structure.");
             }
        }
         else { 
            finalKworkValue = currentContentUpToStructure.trimEnd() + (remainingTextAfterStructure ? "\n\n" + remainingTextAfterStructure : "") + "\n\n" + newCodeContextSection.trimEnd();
            logger.debug("[Kwork Input] Add Tree: No code context found. Appending new structure then new code context.");
        }

        finalKworkValue = finalKworkValue.replace(/\n{3,}/g, '\n\n').trim();
        setKworkInputValue(finalKworkValue);
        toastSuccess(`Структура проекта и ${filesAddedCount} файлов (${files.length} всего) добавлены в запрос.`);
        
        if (dbUser?.id) {
            const achievementsToDisplay: Achievement[] = [];
            if (filesAddedCount > 0) {
                const { newAchievements: logAch } = await logCyberFitnessAction(dbUser.id.toString(), 'filesExtracted', filesAddedCount);
                if(logAch) achievementsToDisplay.push(...logAch);
            }
            const { newAchievements: featureAch } = await checkAndUnlockFeatureAchievement(dbUser.id.toString(), 'usedAddFullTree');
            if(featureAch) achievementsToDisplay.push(...featureAch);

            achievementsToDisplay.forEach(ach => addToast(`🏆 Достижение: ${ach.name}!`, "success", 5000, { description: ach.description }));
        }
        scrollToSection('kworkInput'); 
     }, [files, imageReplaceTaskActive, kworkInputValue, setKworkInputValue, toastSuccess, toastWarning, scrollToSection, logger, dbUser?.id, addToast]); 

     logger.debug("[useKworkInput] Hook setup complete.");
    return {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree, 
    };
};