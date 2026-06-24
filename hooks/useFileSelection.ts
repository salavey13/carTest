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
    docXagentFiles: string[];
    docXRentalFiles: string[];
    docXSaleFiles: string[];
    docXSubrentFiles: string[];
    docXCommercialFiles: string[];
    docXCoreFiles: string[];
    docXAppFiles: string[];
    docXMigrationsFiles: string[];
    docXDocsFiles: string[];
    imageReplaceTaskActive: boolean;
}

interface UseFileSelectionReturn {
    toggleFileSelection: (path: string) => void;
    selectHighlightedFiles: () => void;
    handleAddImportantFiles: () => void;
    handleAddDocXagentFiles: () => void;
    handleAddDocXRentalFiles: () => void;
    handleAddDocXSaleFiles: () => void;
    handleAddDocXSubrentFiles: () => void;
    handleAddDocXCommercialFiles: () => void;
    handleAddDocXCoreFiles: () => void;
    handleAddDocXAppFiles: () => void;
    handleAddDocXMigrationsFiles: () => void;
    handleAddDocXDocsFiles: () => void;
    handleSelectAll: () => void;
    handleDeselectAll: () => void;
}

export const useFileSelection = ({
    files,
    primaryHighlightedPath,
    secondaryHighlightedPaths,
    importantFiles,
    docXagentFiles,
    docXRentalFiles,
    docXSaleFiles,
    docXSubrentFiles,
    docXCommercialFiles,
    docXCoreFiles,
    docXAppFiles,
    docXMigrationsFiles,
    docXDocsFiles,
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
        
        if (dbUser?.user_id) { 
            logger.debug(`[File Selection] Attempting to log 'usedSelectHighlighted' for user ${dbUser.user_id}.`);
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedSelectHighlighted'); 
            newAchievements?.forEach(ach => {
                addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                logger.info(`[File Selection] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`); 
            });
        } else {
            logger.warn("[File Selection] Cannot log 'usedSelectHighlighted': dbUser.user_id is missing.");
        }

    }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser, addToast ]); 

    const handleAddImportantFiles = useCallback(async () => { 
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

        if (dbUser?.user_id) { 
            logger.debug(`[File Selection] Attempting to log 'usedAddImportantFiles' for user ${dbUser.user_id}.`);
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedAddImportantFiles'); 
            newAchievements?.forEach(ach => {
                addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                logger.info(`[File Selection] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`); 
            });
        } else {
            logger.warn("[File Selection] Cannot log 'usedAddImportantFiles': dbUser.user_id is missing.");
        }

    }, [importantFiles, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser, addToast]);

    const handleAddDocXagentFiles = useCallback(async () => {
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Add DocXagent skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        const availableDocXagent = docXagentFiles.filter(p => files.some(f => f.path === p));
        if (availableDocXagent.length === 0) {
            toastWarning("Файлы DocXagent не найдены в текущем списке файлов репозитория.");
             logger.warn("[File Selection] No docXagent files found in current file list.");
            return;
        }

        logger.info(`[File Selection] Adding ${availableDocXagent.length} docXagent files to selection.`);
        setSelectedFetcherFiles(prev => {
            const newSet = new Set(prev);
            availableDocXagent.forEach(p => {
                if (!newSet.has(p)) logger.debug(`[File Selection] Adding docXagent: ${p}`);
                newSet.add(p);
            });
            return newSet;
        });
        toastSuccess(`Добавлено ${availableDocXagent.length} файлов DocXagent к выделению.`);

        if (dbUser?.user_id) {
            logger.debug(`[File Selection] Attempting to log 'usedAddDocXagentFiles' for user ${dbUser.user_id}.`);
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedAddDocXagentFiles');
            newAchievements?.forEach(ach => {
                addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                logger.info(`[File Selection] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
            });
        } else {
            logger.warn("[File Selection] Cannot log 'usedAddDocXagentFiles': dbUser.user_id is missing.");
        }

    }, [docXagentFiles, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser, addToast]);

    // Generic handler for adding DocX preset files
    const createDocXPresetHandler = useCallback((presetFiles: string[], presetName: string, achievementKey: string) => {
        return useCallback(async () => {
            if (imageReplaceTaskActive) {
                logger.warn(`[File Selection] Add ${presetName} skipped: Image replace task active.`);
                toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
                return;
            }
            const availableFiles = presetFiles.filter(p => files.some(f => f.path === p));
            if (availableFiles.length === 0) {
                toastWarning(`${presetName} файлы не найдены в текущем списке файлов репозитория.`);
                logger.warn(`[File Selection] No ${presetName} files found in current file list.`);
                return;
            }

            logger.info(`[File Selection] Adding ${availableFiles.length} ${presetName} files to selection.`);
            setSelectedFetcherFiles(prev => {
                const newSet = new Set(prev);
                availableFiles.forEach(p => {
                    if (!newSet.has(p)) logger.debug(`[File Selection] Adding ${presetName}: ${p}`);
                    newSet.add(p);
                });
                return newSet;
            });
            toastSuccess(`Добавлено ${availableFiles.length} файлов ${presetName} к выделению.`);

            if (dbUser?.user_id) {
                logger.debug(`[File Selection] Attempting to log '${achievementKey}' for user ${dbUser.user_id}.`);
                const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, achievementKey);
                newAchievements?.forEach(ach => {
                    addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                    logger.info(`[File Selection] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
                });
            } else {
                logger.warn(`[File Selection] Cannot log '${achievementKey}': dbUser.user_id is missing.`);
            }
        }, [presetFiles, files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser, addToast]);
    }, [files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser, addToast]);

    const handleAddDocXRentalFiles = createDocXPresetHandler(docXRentalFiles, "Rental Docs", "usedAddDocXRentalFiles");
    const handleAddDocXSaleFiles = createDocXPresetHandler(docXSaleFiles, "Sale Docs", "usedAddDocXSaleFiles");
    const handleAddDocXSubrentFiles = createDocXPresetHandler(docXSubrentFiles, "Subrent Docs", "usedAddDocXSubrentFiles");
    const handleAddDocXCommercialFiles = createDocXPresetHandler(docXCommercialFiles, "Commercial Docs", "usedAddDocXCommercialFiles");
    const handleAddDocXCoreFiles = createDocXPresetHandler(docXCoreFiles, "DocX Core", "usedAddDocXCoreFiles");
    const handleAddDocXAppFiles = createDocXPresetHandler(docXAppFiles, "DocX App", "usedAddDocXAppFiles");
    const handleAddDocXMigrationsFiles = createDocXPresetHandler(docXMigrationsFiles, "DocX Migrations", "usedAddDocXMigrationsFiles");
    const handleAddDocXDocsFiles = createDocXPresetHandler(docXDocsFiles, "DocX Docs", "usedAddDocXDocsFiles");

    const handleSelectAll = useCallback(async () => { 
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

        if (dbUser?.user_id) { 
            logger.debug(`[File Selection] Attempting to log 'usedSelectAllFetcherFiles' for user ${dbUser.user_id}.`);
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedSelectAllFetcherFiles'); 
            newAchievements?.forEach(ach => {
                addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                logger.info(`[File Selection] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`); 
            });
        } else {
            logger.warn("[File Selection] Cannot log 'usedSelectAllFetcherFiles': dbUser.user_id is missing.");
        }
    }, [files, setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser, addToast]); 

    const handleDeselectAll = useCallback(async () => { 
        if (imageReplaceTaskActive) {
             logger.warn("[File Selection] Deselect All skipped: Image replace task active.");
             toastWarning("Выбор файлов недоступен во время задачи замены картинки.");
             return;
        }
        logger.info("[File Selection] Deselecting all files.");
        setSelectedFetcherFiles(new Set()); 
        toastSuccess("Выделение снято со всех файлов.");

        if (dbUser?.user_id) { 
            logger.debug(`[File Selection] Attempting to log 'usedDeselectAllFetcherFiles' for user ${dbUser.user_id}.`);
            const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedDeselectAllFetcherFiles'); 
            newAchievements?.forEach(ach => {
                addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
                logger.info(`[File Selection] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`); 
            });
        } else {
            logger.warn("[File Selection] Cannot log 'usedDeselectAllFetcherFiles': dbUser.user_id is missing.");
        }
    }, [setSelectedFetcherFiles, toastSuccess, toastWarning, imageReplaceTaskActive, logger, dbUser, addToast]); 

     logger.debug("[useFileSelection] Hook setup complete.");
    return {
        toggleFileSelection,
        selectHighlightedFiles,
        handleAddImportantFiles,
        handleAddDocXagentFiles,
        handleAddDocXRentalFiles,
        handleAddDocXSaleFiles,
        handleAddDocXSubrentFiles,
        handleAddDocXCommercialFiles,
        handleAddDocXCoreFiles,
        handleAddDocXAppFiles,
        handleAddDocXMigrationsFiles,
        handleAddDocXDocsFiles,
        handleSelectAll,
        handleDeselectAll,
    };
};