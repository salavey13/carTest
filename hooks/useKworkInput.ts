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

export const useKworkInput = ({
    selectedFetcherFiles,
    allFetchedFiles,
    imageReplaceTaskActive,
    files, // Этот `files` приходит из useRepoFetcher и содержит *текущий* список файлов
}: UseKworkInputProps): UseKworkInputReturn => {
    logger.debug("[useKworkInput] Hook initialized");
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useAppToast();

    const {
        kworkInputRef,          // Keep ref for focus/scroll if needed
        kworkInputValue,        // <<< USE new state value
        setKworkInputValue,     // <<< USE new state setter
        setRequestCopied,
        setSelectedFetcherFiles,
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        scrollToSection,
    } = useRepoXmlPageContext();

    /** Adds the content of the currently selected files into the Kwork input textarea. */
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
        logger.info(`[Kwork Input] Adding ${selectedFetcherFiles.size} selected files to input...`);

        const currentKworkValue = kworkInputValue; // <<< READ from state
        // Regex to find either code context or file structure context blocks
        const contextRegex = /(Контекст кода для анализа|Структура файлов проекта):\s*```([\s\S]*?)(\n?```)/im;
        const fileSeparator = "\n\n// ---- FILE SEPARATOR ----\n\n";
        let newContextContent = "";

        newContextContent = Array.from(selectedFetcherFiles).map(path => {
            const file = allFetchedFiles.find(f => f.path === path);
            const pathComment = `// /${path}`;
            const fileContent = file?.content ?? `// Error: Content for ${path} not found in allFetchedFiles`;
            // Check if the existing content already starts with the correct path comment
            const contentAlreadyHasComment = fileContent.trimStart().startsWith(pathComment);
            logger.debug(`[Kwork Input] Adding file content: ${path} (Found: ${!!file}, HasComment: ${contentAlreadyHasComment})`);
            return contentAlreadyHasComment ? fileContent : `${pathComment}\n${fileContent}`;
        }).join(fileSeparator);

        // Use a generic prefix for the code block
        const fullContextBlock = `Контекст кода для анализа:\n\`\`\`plaintext\n${newContextContent}\n\`\`\``;
        let finalKworkValue = "";

        // Replace existing context block (either code or structure) or add new
        if (contextRegex.test(currentKworkValue)) {
             logger.debug("[Kwork Input] Replacing existing context block.");
             finalKworkValue = currentKworkValue.replace(contextRegex, fullContextBlock);
        } else {
             logger.debug("[Kwork Input] No existing context block found, adding new.");
             const separator = currentKworkValue.trim() ? "\n\n" : "";
             finalKworkValue = currentKworkValue + separator + fullContextBlock;
        }

        setKworkInputValue(finalKworkValue); // <<< UPDATE state
        toastSuccess(`${selectedFetcherFiles.size} файлов добавлено в запрос.`);
        scrollToSection('kworkInput');

    }, [
        selectedFetcherFiles, allFetchedFiles, imageReplaceTaskActive, toastSuccess, toastWarning,
        kworkInputValue, setKworkInputValue, // <<< USE state and setter
        scrollToSection, logger
    ]);

    /** Copies text (defaults to Kwork input) to the clipboard. */
    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInputValue; // <<< READ from state
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
            if (shouldScroll) scrollToSection('executor'); // Assuming 'executor' is the ID of the next section (e.g., AI Assistant)
            return true;
        } catch (e) {
            logger.error("[Kwork Input] Clipboard write error:", e);
            toastError("Ошибка копирования в буфер обмена");
            return false;
        }
    }, [kworkInputValue, toastSuccess, toastWarning, toastError, setRequestCopied, scrollToSection, logger]); // <<< ADD state dependency

    /** Clears Kwork input, file selection, and related AI/parsing states. */
    const handleClearAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[Kwork Input] Clear All skipped: Image replace task active.");
            toastWarning("Очистка недоступна во время задачи замены картинки.");
            return;
        }
        logger.info("[Kwork Input] Clearing input, selection, and related states.");
        setSelectedFetcherFiles(new Set());
        setKworkInputValue(""); // <<< UPDATE state
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        setRequestCopied(false);
        toastSuccess("Форма очищена ✨");
        if (kworkInputRef.current) kworkInputRef.current.focus(); // Ref still useful for focus
    }, [
        imageReplaceTaskActive, setSelectedFetcherFiles, setKworkInputValue, // <<< USE state setter
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied,
        toastSuccess, toastWarning, logger, kworkInputRef
    ]);

    /**
     * Adds the file structure (paths only) of *all* currently listed files
     * (from useRepoFetcher's `files` prop) to the Kwork input.
     */
     const handleAddFullTree = useCallback(() => {
         if (imageReplaceTaskActive) {
             logger.warn("[Kwork Input] Add Tree skipped: Image replace task active.");
             toastWarning("Добавление дерева файлов недоступно во время задачи замены картинки.");
             return;
         }
         // Используем `files`, который содержит текущий список файлов из useRepoFetcher
         if (files.length === 0) {
             toastWarning("Нет загруженных файлов для добавления дерева.");
             logger.warn("[Kwork Input] Add Tree skipped: No files loaded.");
             return;
         }

         logger.info(`[Kwork Input] Adding full file tree (PATHS ONLY) (${files.length} files) to input...`);

         // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Мапим только пути ---
         const treeStructure = files
             .map(f => `- /${f.path}`) // Просто берем путь и добавляем префикс
             .sort() // Сортируем для красивого вида
             .join("\n");
         // --- КОНЕЦ ИЗМЕНЕНИЯ ---

         const prefix = "Структура файлов проекта:\n```\n"; // Используем ``` без языка
         const suffix = "\n```";
         const currentKworkValue = kworkInputValue; // Читаем текущее значение из контекста
         // Regex to find either code context or file structure context blocks
         const contextRegex = /(Контекст кода для анализа|Структура файлов проекта):\s*```([\s\S]*?)(\n?```)/im;
         // Remove any existing context block before adding the new structure
         const textWithoutContext = currentKworkValue.replace(contextRegex, '').trim();
         const separator = textWithoutContext ? '\n\n' : '';

         // Construct the new content with the text (if any) and the file structure
         const newContent = `${textWithoutContext}${separator}${prefix}${treeStructure}${suffix}`;

         setKworkInputValue(newContent); // Обновляем значение через контекст
         toastSuccess(`Структура (${files.length} файлов) добавлена в запрос.`);
         scrollToSection('kworkInput'); // Прокручиваем к полю ввода
     }, [files, imageReplaceTaskActive, kworkInputValue, setKworkInputValue, toastSuccess, toastWarning, scrollToSection, logger]); // Зависимости

     logger.debug("[useKworkInput] Hook setup complete.");
    return {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree, // Возвращаем обновленную функцию
    };
};