"use client";
import { useCallback } from "react";
import { useRepoXmlPageContext, FileNode, ImportCategory } from "@/contexts/RepoXmlPageContext"; 
import { debugLogger as logger } from "@/lib/debugLogger"; 
import { useAppToast } from "@/hooks/useAppToast"; 
import { useAppContext } from "@/contexts/AppContext";
import { checkAndUnlockFeatureAchievement, Achievement } from "@/hooks/cyberFitnessSupabase";

interface UseFileSelectionProps {
    files: FileNode[]; 
    primaryHighlightedPath: string | null; 
    secondaryHighlightedPaths: Record<ImportCategory, string[]>; 
    importantFiles: string[]; 
    imageReplaceTaskActive: boolean; 
}

interface UseFileSelectionReturn {
    toggleFileSelection: (path: string) => void;
    selectHighlightedFiles: () => void;
    handleAddImportantFiles: () => void;
    handleSelectAll: () => void;
    handleDeselectAll: () => void;
}

export const useFileSelection = ({
    files, 
    primaryHighlightedPath,
    secondaryHighlightedPaths,
    importantFiles,
    imageReplaceTaskActive,
}: UseFileSelectionProps): UseFileSelectionReturn => {
    logger.debug("[useFileSelection] Hook initialized");
    const { success: toastSuccess, warning: toastWarning, addToast } = useAppToast(); 
    const { dbUser } = useAppContext();

    const {
        setSelectedFetcherFiles, 
    } = useRepoXmlPageContext();

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

    const selectHighlightedFiles = useCallback(async () => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Select Highlighted skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        const filesToSelect = new Set<string>();
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath)) {
             filesToSelect.add(primaryHighlightedPath);
             logger.debug(`[File Selection] Adding primary highlight: ${primaryHighlightedPath}`);
        }
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
        setSelectedFetcherFiles(filesToSelect); 
        toastSuccess(`Выбрано ${filesToSelect.size} связанных файлов.`);
        
        if (dbUser?.id) {
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.id.toString(), 'usedSelectHighlighted');
            newAchievements?.forEach(ach => {
                addToast(`🏆 Достижение: ${ach.name}!`, "success", 5000, { description: ach.description });
            });
        }

    }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser?.id, addToast ]);

    const handleAddImportantFiles = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Add Important skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
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
        }); 
        toastSuccess(`Добавлено ${availableImportant.length} важных файлов к выделению.`);
    }, [importantFiles, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger]);

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
        setSelectedFetcherFiles(allPaths); 
        toastSuccess(`Выбраны все ${allPaths.size} файлов.`);
    }, [files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger]);

    const handleDeselectAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Deselect All skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        logger.info("[File Selection] Deselecting all files.");
        setSelectedFetcherFiles(new Set()); 
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