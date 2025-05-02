"use client";
import { useCallback } from "react";
import { useRepoXmlPageContext, FileNode, ImportCategory } from "@/contexts/RepoXmlPageContext"; // Assuming types are here
import { debugLogger as logger } from "@/lib/debugLogger";

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

    const {
        setSelectedFetcherFiles, // Context setter for the selection state
        addToast // Context helper for notifications
    } = useRepoXmlPageContext();

    /** Toggle selection state for a single file path. */
    const toggleFileSelection = useCallback((path: string) => {
        if (imageReplaceTaskActive) {
             addToast("Выбор файлов недоступен во время задачи замены картинки.", "warning");
             return;
        }
        logger.log("Toggle selection:", path);
        setSelectedFetcherFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    }, [setSelectedFetcherFiles, imageReplaceTaskActive, addToast, logger]);

    /** Selects the primary highlighted file and all secondary highlighted files. */
    const selectHighlightedFiles = useCallback(() => {
        if (imageReplaceTaskActive) {
             addToast("Выбор файлов недоступен во время задачи замены картинки.", "warning");
             return;
        }
        const filesToSelect = new Set<string>();
        // Ensure primary file exists in the current fetched list before adding
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath)) {
             filesToSelect.add(primaryHighlightedPath);
        }
        // Ensure secondary files exist in the current fetched list before adding
        Object.values(secondaryHighlightedPaths).flat().forEach(p => {
             if (files.some(f => f.path === p)) {
                 filesToSelect.add(p);
             }
        });

        if (filesToSelect.size === 0) {
            addToast("Нет выделенных или связанных файлов для выбора.", 'warning');
            return;
        }

        logger.log("Selecting highlighted files:", filesToSelect);
        setSelectedFetcherFiles(filesToSelect); // Update context state
        addToast(`Выбрано ${filesToSelect.size} связанных файлов.`, 'success');
    }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, setSelectedFetcherFiles, addToast, imageReplaceTaskActive, logger ]);

    /** Adds predefined important files to the current selection if they exist. */
    const handleAddImportantFiles = useCallback(() => {
        if (imageReplaceTaskActive) {
             addToast("Выбор файлов недоступен во время задачи замены картинки.", "warning");
             return;
        }
        // Filter importantFiles to only include those present in the current 'files' list
        const availableImportant = importantFiles.filter(p => files.some(f => f.path === p));
        if (availableImportant.length === 0) {
            addToast("Важные файлы не найдены в текущем списке файлов репозитория.", "warning");
            return;
        }

        logger.log("Adding important files:", availableImportant);
        setSelectedFetcherFiles(prev => {
            const newSet = new Set(prev);
            availableImportant.forEach(p => newSet.add(p));
            return newSet;
        }); // Update context state
        addToast(`Добавлено ${availableImportant.length} важных файлов к выделению.`, 'success');
    }, [importantFiles, files, setSelectedFetcherFiles, addToast, imageReplaceTaskActive, logger]);

    /** Selects all files currently available in the 'files' list. */
    const handleSelectAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             addToast("Выбор файлов недоступен во время задачи замены картинки.", "warning");
             return;
        }
        if (files.length === 0) {
             addToast("Нет файлов для выбора.", "warning");
             return;
        }
        const allPaths = new Set(files.map(f => f.path));
        logger.log("Selecting all files:", allPaths.size);
        setSelectedFetcherFiles(allPaths); // Update context state
        addToast(`Выбраны все ${allPaths.size} файлов.`, 'success');
    }, [files, setSelectedFetcherFiles, addToast, imageReplaceTaskActive, logger]);

    /** Clears the current file selection. */
    const handleDeselectAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             addToast("Выбор файлов недоступен во время задачи замены картинки.", "warning");
             return;
        }
        logger.log("Deselecting all files.");
        setSelectedFetcherFiles(new Set()); // Update context state
        addToast("Выделение снято со всех файлов.", 'success');
    }, [setSelectedFetcherFiles, addToast, imageReplaceTaskActive, logger]);


    return {
        toggleFileSelection,
        selectHighlightedFiles,
        handleAddImportantFiles,
        handleSelectAll,
        handleDeselectAll,
    };
};