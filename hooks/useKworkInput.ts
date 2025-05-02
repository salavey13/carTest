"use client";
import { useCallback } from "react";
import { useRepoXmlPageContext, FileNode } from "@/contexts/RepoXmlPageContext"; // Assuming types are here
import { debugLogger as logger } from "@/lib/debugLogger";

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
    handleAddFullTree: () => void; // Add *all* currently listed files to input
    // getKworkInputValue is exposed via context hook directly
}

export const useKworkInput = ({
    selectedFetcherFiles, // Use selection from context
    allFetchedFiles, // Use all files from context (for looking up content of selected)
    imageReplaceTaskActive,
    files, // Use *current* files list from fetcher hook (for AddFullTree)
}: UseKworkInputProps): UseKworkInputReturn => {

    const {
        kworkInputRef, // Context ref to the textarea
        setKworkInputHasContent, // Context state setter
        setRequestCopied, // Context state setter
        setSelectedFetcherFiles, // Context selection setter (needed for clearAll)
        // States to reset on clearAll:
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        // Actions/helpers from context:
        scrollToSection,
        addToast,
        updateKworkInput, // Function to set the input value
        getKworkInputValue, // Function to get the input value
        // Highlight states are managed by useRepoFetcher, no need to clear here
    } = useRepoXmlPageContext();

    /** Adds the content of the currently selected files into the Kwork input textarea. */
    const handleAddSelected = useCallback(() => {
        if (imageReplaceTaskActive) {
            addToast("Добавление файлов недоступно во время задачи замены картинки.", "warning");
            return;
        }
        if (selectedFetcherFiles.size === 0) {
            addToast("Нет выбранных файлов для добавления в запрос.", "warning");
            return;
        }
        logger.log(`Adding ${selectedFetcherFiles.size} selected files to kwork input...`);

        const currentKworkValue = getKworkInputValue();
        // Regex to find an existing context block (non-greedy match for content)
        // Looking for ``` optionally followed by language, then content, then ```
        const contextRegex = /(Контекст кода для анализа:\s*```(?:\w+\n)?)([\s\S]*?)(\n?```)/;
        const fileSeparator = "\n\n// ---- FILE SEPARATOR ----\n\n";
        let newContextContent = "";

        // Generate the content block for selected files
        // Use allFetchedFiles from context to find content.
        newContextContent = Array.from(selectedFetcherFiles).map(path => {
            const file = allFetchedFiles.find(f => f.path === path);
            const pathComment = `// /${path}`;
            const fileContent = file?.content ?? `// Error: Content for ${path} not found in allFetchedFiles`;
            // Avoid adding duplicate path comment if already present
            return fileContent.trimStart().startsWith(pathComment) ? fileContent : `${pathComment}\n${fileContent}`;
        }).join(fileSeparator);

        // Construct the new block with plaintext hint
        const fullContextBlock = `Контекст кода для анализа:\n\`\`\`plaintext\n${newContextContent}\n\`\`\``;
        let finalKworkValue = "";

        // Replace existing block or append/prepend new one
        if (contextRegex.test(currentKworkValue)) {
             logger.log("Existing context block found, replacing.");
             // Replace the existing block entirely using the regex
             finalKworkValue = currentKworkValue.replace(contextRegex, fullContextBlock);
        } else {
             logger.log("No existing context block found, adding new.");
             // Add a separator if there's existing text
             const separator = currentKworkValue.trim() ? "\n\n" : "";
             finalKworkValue = currentKworkValue + separator + fullContextBlock;
        }

        updateKworkInput(finalKworkValue); // Update the input using the context function
        addToast(`${selectedFetcherFiles.size} файлов добавлено в запрос.`, 'success');
        scrollToSection('kworkInput'); // Scroll to the input area

    }, [
        selectedFetcherFiles, allFetchedFiles, imageReplaceTaskActive, addToast,
        getKworkInputValue, updateKworkInput, scrollToSection, logger
    ]);

    /** Copies text (defaults to Kwork input) to the clipboard. */
    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? getKworkInputValue(); // Get current input value via context function
        if (!content.trim()) {
            addToast("Нет текста для копирования", 'warning');
            return false;
        }
        try {
            navigator.clipboard.writeText(content);
            addToast("Текст запроса скопирован!", 'success');
            setRequestCopied(true); // Update context state
            if (shouldScroll) scrollToSection('executor'); // Scroll to next section
            return true;
        } catch (e) {
            logger.error("Clipboard write error:", e);
            addToast("Ошибка копирования в буфер обмена", 'error');
            return false;
        }
    }, [getKworkInputValue, addToast, setRequestCopied, scrollToSection, logger]);

    /** Clears Kwork input, file selection, and related AI/parsing states. */
    const handleClearAll = useCallback(() => {
        if (imageReplaceTaskActive) {
            addToast("Очистка недоступна во время задачи замены картинки.", "warning");
            return;
        }
        logger.log("KworkInput Hook: Clearing input, selection, and related states.");
        setSelectedFetcherFiles(new Set()); // Clear context selection
        updateKworkInput(""); // Clear context input value using function
        // Reset related context states
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        setRequestCopied(false);
        // Note: Highlight state is managed by useRepoFetcher and reset on fetch
        addToast("Форма очищена ✨", 'success');
        if (kworkInputRef.current) kworkInputRef.current.focus(); // Focus input if ref exists
    }, [
        imageReplaceTaskActive, setSelectedFetcherFiles, updateKworkInput,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied,
        addToast, logger, kworkInputRef // Include kworkInputRef for focus
    ]);

    /** Adds the content of *all* currently listed files (from useRepoFetcher) to the Kwork input. */
     const handleAddFullTree = useCallback(() => {
         if (imageReplaceTaskActive) {
             addToast("Добавление файлов недоступно во время задачи замены картинки.", "warning");
             return;
         }
         if (files.length === 0) { // Use 'files' from props (current fetcher state)
             addToast("Нет загруженных файлов для добавления всего дерева.", "warning");
             return;
         }

         logger.log(`Adding full file tree (${files.length} files) to kwork input...`);
         const fileSeparator = "\n\n// ---- FILE SEPARATOR ----\n\n";

         // Generate content for *all* files currently listed
         const allCode = files.map(f => {
             const pathComment = `// /${f.path}`;
             const contentAlreadyHasComment = f.content.trimStart().startsWith(pathComment);
             return contentAlreadyHasComment ? f.content : `${pathComment}\n${f.content}`;
         }).join(fileSeparator);

         const prefix = "Контекст кода для анализа (ВСЕ ФАЙЛЫ):\n```plaintext\n";
         const suffix = "\n```";
         const currentKworkValue = getKworkInputValue();
         // Use the same regex as handleAddSelected to replace existing context if present
         const contextRegex = /(Контекст кода для анализа:\s*```(?:\w+\n)?)([\s\S]*?)(\n?```)/;
         const textWithoutContext = currentKworkValue.replace(contextRegex, '').trim();
         const separator = textWithoutContext ? '\n\n' : '';

         // Construct the final content, replacing any previous context block
         const newContent = `${textWithoutContext}${separator}${prefix}${allCode}${suffix}`;

         updateKworkInput(newContent); // Update input via context function
         addToast(`Полное дерево (${files.length} файлов) добавлено в запрос.`);
         scrollToSection('kworkInput');
     }, [files, imageReplaceTaskActive, getKworkInputValue, updateKworkInput, addToast, scrollToSection, logger]);


    return {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
    };
};