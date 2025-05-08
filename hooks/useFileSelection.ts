"use client";
import { useCallback } from "react";
import { useRepoXmlPageContext, FileNode, ImportCategory } from "@/contexts/RepoXmlPageContext"; // Assuming types are here
import { debugLogger as logger } from "@/lib/debugLogger"; // Use logger
import { useAppToast } from "@/hooks/useAppToast"; // Use toast hook

interface UseFileSelectionProps {
    files: FileNode[]; // Current list of fetched files (from useRepoFetcher hook)
    primaryHighlightedPath: string | null; // Highlight state (from useRepoFetcher hook)
    secondaryHighlightedPaths: Record<ImportCategory, string[]>; // Highlight state (from useRepoFetcher hook)
    importantFiles: string[]; // Static list (from component props/constants)
    imageReplaceTaskActive: boolean; // Is an image task currently active?
}

interface UseFileSelectionReturn {
    toggleFileSelection: (path: string) => void;
    selectHighlightedFiles: () => void;
    handleAddImportantFiles: () => void;
    handleSelectAll: () => void;
    handleDeselectAll: () => void;
}

export const useFileSelection = ({
    files, // Use the current list of files available in the UI
    primaryHighlightedPath,
    secondaryHighlightedPaths,
    importantFiles,
    imageReplaceTaskActive,
}: UseFileSelectionProps): UseFileSelectionReturn => {
    logger.debug("[useFileSelection] Hook initialized");
    const { success: toastSuccess, warning: toastWarning } = useAppToast(); // Get toast functions

    const {
        setSelectedFetcherFiles, // Context setter for the selection state
        // addToast is no longer needed directly here
    } = useRepoXmlPageContext();

    /** Toggle selection state for a single file path. */
    const toggleFileSelection = useCallback((path: string) => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Toggle skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        logger.log("[File Selection] Toggle selection for:", path);
        setSelectedFetcherFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
                 logger.debug(`[File Selection] Deselected: ${path}`);
            } else {
                newSet.add(path);
                 logger.debug(`[File Selection] Selected: ${path}`);
            }
            return newSet;
        });
    }, [setSelectedFetcherFiles, imageReplaceTaskActive, toastWarning, logger]);

    /** Selects the primary highlighted file and all secondary highlighted files. */
    const selectHighlightedFiles = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Select Highlighted skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        const filesToSelect = new Set<string>();
        // Ensure primary file exists in the current fetched list before adding
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath)) {
             filesToSelect.add(primaryHighlightedPath);
             logger.debug(`[File Selection] Adding primary highlight: ${primaryHighlightedPath}`);
        }
        // Ensure secondary files exist in the current fetched list before adding
        Object.values(secondaryHighlightedPaths).flat().forEach(p => {
             if (files.some(f => f.path === p)) {
                 filesToSelect.add(p);
                 logger.debug(`[File Selection] Adding secondary highlight: ${p}`);
             }
        });

        if (filesToSelect.size === 0) {
            toastWarning("Нет выделенных или связанных файлов для выбора.");
             logger.warn("[File Selection] No highlighted files available to select.");
            return;
        }

        logger.info(`[File Selection] Selecting ${filesToSelect.size} highlighted files.`);
        setSelectedFetcherFiles(filesToSelect); // Update context state
        toastSuccess(`Выбрано ${filesToSelect.size} связанных файлов.`);
    }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger ]);

    /** Adds predefined important files to the current selection if they exist. */
    const handleAddImportantFiles = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Add Important skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        // Filter importantFiles to only include those present in the current 'files' list
        const availableImportant = importantFiles.filter(p => files.some(f => f.path === p));
        if (availableImportant.length === 0) {
            toastWarning("Важные файлы не найдены в текущем списке файлов репозитория.");
             logger.warn("[File Selection] No important files found in current file list.");
            return;
        }

        logger.info(`[File Selection] Adding ${availableImportant.length} important files to selection.`);
        setSelectedFetcherFiles(prev => {
            const newSet = new Set(prev);
            availableImportant.forEach(p => {
                if (!newSet.has(p)) logger.debug(`[File Selection] Adding important: ${p}`);
                newSet.add(p);
            });
            return newSet;
        }); // Update context state
        toastSuccess(`Добавлено ${availableImportant.length} важных файлов к выделению.`);
    }, [importantFiles, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger]);

    /** Selects all files currently available in the 'files' list. */
    const handleSelectAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Select All skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        if (files.length === 0) {
             toastWarning("Нет файлов для выбора.");
              logger.warn("[File Selection] No files available to select all.");
             return;
        }
        const allPaths = new Set(files.map(f => f.path));
        logger.info(`[File Selection] Selecting all ${allPaths.size} files.`);
        setSelectedFetcherFiles(allPaths); // Update context state
        toastSuccess(`Выбраны все ${allPaths.size} файлов.`);
    }, [files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger]);

    /** Clears the current file selection. */
    const handleDeselectAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Deselect All skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        logger.info("[File Selection] Deselecting all files.");
        setSelectedFetcherFiles(new Set()); // Update context state
        toastSuccess("Выделение снято со всех файлов.");
    }, [setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger]);

     logger.debug("[useFileSelection] Hook setup complete.");
    return {
        toggleFileSelection,
        selectHighlightedFiles,
        handleAddImportantFiles,
        handleSelectAll,
        handleDeselectAll,
    };
};