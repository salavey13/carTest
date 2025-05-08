"use client";
import { useCallback } from "react";
import { useRepoXmlPageContext, FileNode } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";

interface UseKworkInputProps {
    selectedFetcherFiles: Set<string>; // Current selection from context
    allFetchedFiles: FileNode[]; // All files ever fetched (from context) - used for getting content of selected files
    imageReplaceTaskActive: boolean; // Is an image task currently active?
    files: FileNode[]; // Current files list from useRepoFetcher (needed for AddFullTree)
}

interface UseKworkInputReturn {
    handleAddSelected: () => void; // Add currently selected files to input
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean; // Copy input content
    handleClearAll: () => void; // Clear input, selection, and related states
    handleAddFullTree: () => void; // Add *all* currently listed file *paths* to input
}

// Helper function to determine language for Markdown code block
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
        default: return 'plaintext'; // Fallback for unknown extensions
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
    } = useRepoXmlPageContext();

    /** Adds the content of the currently selected files into the Kwork input textarea as individual code blocks. */
    const handleAddSelected = useCallback(() => {
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

        const fileBlocksContent = Array.from(selectedFetcherFiles).map(path => {
            const fileNode = allFetchedFiles.find(f => f.path === path);
            let contentToDisplay: string;

            if (!fileNode) {
                contentToDisplay = `// Error: File /${path} not found in allFetchedFiles.`;
                logger.warn(`[Kwork Input] File /${path} not found in allFetchedFiles during AddSelected.`);
            } else if (typeof fileNode.content === 'string') {
                contentToDisplay = fileNode.content;
            } else if (fileNode.content === null) {
                contentToDisplay = `// Info: Content for /${path} is null (e.g., empty file).`;
                logger.info(`[Kwork Input] Content for file /${path} is null during AddSelected.`);
            } else {
                // This case should ideally not happen based on FileNode type { content: string | null }
                contentToDisplay = `// Warning: Content for /${path} is of unexpected type (${typeof fileNode.content}). Displaying as empty.`;
                logger.warn(`[Kwork Input] Content for /${path} is of unexpected type: ${typeof fileNode.content} during AddSelected. Defaulting to empty string.`);
                contentToDisplay = ""; 
            }

            const language = getFileLanguage(path);
            const pathComment = `// /${path}`;
            logger.debug(`[Kwork Input] Formatting file for AddSelected: ${path} (Lang: ${language})`);
            return `${pathComment}\n\`\`\`${language}\n${contentToDisplay.trim()}\n\`\`\``;
        }).join("\n\n// ---- FILE SEPARATOR ----\n\n");

        const codeContextMarker = "Контекст кода для анализа:";
        const structureMarker = "Структура файлов проекта:";
        const newCodeContextSection = `${codeContextMarker}\n\n${fileBlocksContent}`;

        const currentKworkValue = kworkInputValue || "";
        let finalKworkValue = "";

        const idxCode = currentKworkValue.indexOf(codeContextMarker);
        const idxStructure = currentKworkValue.indexOf(structureMarker);

        if (idxCode !== -1) {
            // Code context exists, replace it.
            // Find where the old code context ends: either before structure marker or EOF.
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
            logger.debug("[Kwork Input] Replacing existing code context section.");
        } else if (idxStructure !== -1) {
            // No code context, but structure context exists. Insert code context before structure.
            const textBeforeStructure = currentKworkValue.substring(0, idxStructure);
            const structureAndAfter = currentKworkValue.substring(idxStructure);
            finalKworkValue = (textBeforeStructure.trimEnd() + 
                               (textBeforeStructure.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd() + 
                               "\n\n" + 
                               structureAndAfter.trimStart());
            logger.debug("[Kwork Input] Adding code context section before file structure section.");
        } else {
            // Neither exists, append new code context.
            finalKworkValue = (currentKworkValue.trimEnd() + 
                               (currentKworkValue.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd());
            logger.debug("[Kwork Input] Appending new code context section.");
        }
        
        finalKworkValue = finalKworkValue.replace(/\n{3,}/g, '\n\n').trim();

        setKworkInputValue(finalKworkValue);
        toastSuccess(`${selectedFetcherFiles.size} файлов добавлено в запрос как отдельные блоки кода.`);
        scrollToSection('kworkInput');

    }, [
        selectedFetcherFiles, allFetchedFiles, imageReplaceTaskActive, toastSuccess, toastWarning,
        kworkInputValue, setKworkInputValue, 
        scrollToSection, logger
    ]);

    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInputValue; 
        if (!content.trim()) {
            toastWarning("Нет текста для копирования");
            logger.warn("[Kwork Input] Copy skipped: Input is empty.");
            return false;
        }
        try {
            navigator.clipboard.writeText(content);
            toastSuccess("Текст запроса скопирован!");
            setRequestCopied(true);
            logger.info("[Kwork Input] Copied request to clipboard.");
            if (shouldScroll) scrollToSection('executor'); 
            return true;
        } catch (e) {
            logger.error("[Kwork Input] Clipboard write error:", e);
            toastError("Ошибка копирования в буфер обмена");
            return false;
        }
    }, [kworkInputValue, toastSuccess, toastWarning, toastError, setRequestCopied, scrollToSection, logger]); 

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

     const handleAddFullTree = useCallback(() => {
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

         logger.info(`[Kwork Input] Adding full file tree (PATHS ONLY) (${files.length} files) to input...`);
         const treeStructure = files
             .map(f => `- /${f.path}`) 
             .sort() 
             .join("\n");

        const codeContextMarker = "Контекст кода для анализа:";
        const structureMarker = "Структура файлов проекта:";
        const newStructureSection = `${structureMarker}\n\`\`\`\n${treeStructure.trim()}\n\`\`\``;

        const currentKworkValue = kworkInputValue || "";
        let finalKworkValue = "";
        
        const idxCode = currentKworkValue.indexOf(codeContextMarker);
        const idxStructure = currentKworkValue.indexOf(structureMarker);

        if (idxStructure !== -1) {
            // Structure context exists, replace it.
            // Regex to find the existing structure block precisely
            const oldStructureBlockRegex = new RegExp(
                structureMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + // Escape marker for regex
                "\\s*```([\\s\\S]*?)```" // Match ``` block content
            , "im"); // m for multiline, i for case-insensitive (though markers are fixed)
            
            const match = oldStructureBlockRegex.exec(currentKworkValue);

            // Ensure the match found is the one starting at idxStructure
            if (match && match.index === idxStructure) {
                const textBefore = currentKworkValue.substring(0, idxStructure);
                const textAfter = currentKworkValue.substring(idxStructure + match[0].length);
                finalKworkValue = (textBefore.trimEnd() +
                                   (textBefore.trimEnd() ? "\n\n" : "") +
                                   newStructureSection.trimEnd() +
                                   (textAfter.trimStart() ? "\n\n" : "") +
                                   textAfter.trimStart());
                logger.debug("[Kwork Input] Replacing existing file structure section using regex match.");
            } else {
                // Fallback: if regex fails or marker is present but not as a block.
                // This could happen if the ``` block is malformed or missing.
                // A safe fallback is to append, to avoid data loss or complex recovery.
                logger.warn(`[Kwork Input] Structure marker found at index ${idxStructure}, but regex match failed or was misplaced. Appending new structure section to current content.`);
                finalKworkValue = (currentKworkValue.trimEnd() +
                                   (currentKworkValue.trimEnd() ? "\n\n" : "") +
                                   newStructureSection.trimEnd());
            }
        } else if (idxCode !== -1) {
            // Code context exists, but no structure. Append structure after code.
            finalKworkValue = (currentKworkValue.trimEnd() + "\n\n" + newStructureSection.trimEnd());
            logger.debug("[Kwork Input] Appending file structure section after code context.");
        } else {
            // Neither code nor structure context exists. Append new structure.
            finalKworkValue = (currentKworkValue.trimEnd() +
                               (currentKworkValue.trimEnd() ? "\n\n" : "") +
                               newStructureSection.trimEnd());
            logger.debug("[Kwork Input] Appending new file structure section.");
        }

        finalKworkValue = finalKworkValue.replace(/\n{3,}/g, '\n\n').trim();
        setKworkInputValue(finalKworkValue);
        toastSuccess(`Структура (${files.length} файлов) добавлена в запрос.`);
        scrollToSection('kworkInput'); 
     }, [files, imageReplaceTaskActive, kworkInputValue, setKworkInputValue, toastSuccess, toastWarning, scrollToSection, logger]); 

     logger.debug("[useKworkInput] Hook setup complete.");
    return {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree, 
    };
};