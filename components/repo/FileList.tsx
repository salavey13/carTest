"use client";

import React from 'react';
import { FaSquareCheck, FaRegSquare, FaPlus, FaCodeBranch, FaStar, FaHighlighter, FaKey, FaTree, FaFileLines } from 'react-icons/fa6';
import { FileNode, ImportCategory } from '../RepoTxtFetcher'; // Import necessary types
import { motion, AnimatePresence } from 'framer-motion';

// Interface defining the props expected by FileList
interface FileListProps {
    id: string;
    files: FileNode[];
    selectedFiles: Set<string>;
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: Record<ImportCategory, string[]>;
    importantFiles: string[];
    isLoading: boolean;
    isActionDisabled: boolean; // General disabled state from parent
    toggleFileSelection: (path: string) => void;
    onAddSelected: () => void; // Removed autoAsk param
    onAddImportant: () => void;
    onAddTree: () => void;
    onSelectHighlighted: () => void;
}

// Helper to get the display name (filename) from a full path
const getDisplayName = (path: string) => path.split("/").pop() || path;

// Helper to group files by their parent folder
const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { folder: string; files: FileNode[] }[] = [];
    const folderMap: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
        const folder = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf("/")) : "/";
        if (!folderMap[folder]) folderMap[folder] = [];
        folderMap[folder].push(file);
    });
    const sortedFolders = Object.keys(folderMap).sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
    });
    sortedFolders.forEach(folder => {
        folderMap[folder].sort((a, b) => getDisplayName(a.path).localeCompare(getDisplayName(b.path)));
        grouped.push({ folder, files: folderMap[folder] });
    });
    return grouped;
};


const FileList: React.FC<FileListProps> = React.memo(({ // Memoize the component
    id,
    files,
    selectedFiles,
    primaryHighlightedPath,
    secondaryHighlightedPaths,
    importantFiles,
    isLoading,
    isActionDisabled, // Use the combined action disabled state
    toggleFileSelection,
    onAddSelected,
    onAddImportant,
    onAddTree,
    onSelectHighlighted,
}) => {

    // Memoize the grouped files structure
    const groupedFiles = React.useMemo(() => groupFilesByFolder(files), [files]);

    // Combine all secondary paths into a single Set for efficient lookups
    const allSecondaryPathsSet = React.useMemo(() => {
        const combined = new Set<string>();
        (Object.keys(secondaryHighlightedPaths) as ImportCategory[])
            .filter(cat => cat !== 'other')
            .forEach(category => {
                secondaryHighlightedPaths[category].forEach(path => combined.add(path));
            });
        return combined;
    }, [secondaryHighlightedPaths]);

    // Determine if there are any highlightable files
    const hasHighlightableFiles = !!primaryHighlightedPath || allSecondaryPathsSet.size > 0;

    // Calculate how many highlightable files are *not yet* selected
    const unselectedHighlightCount = React.useMemo(() => {
        let count = 0;
        if (primaryHighlightedPath && !selectedFiles.has(primaryHighlightedPath)) count++;
        allSecondaryPathsSet.forEach(path => {
            if (!selectedFiles.has(path)) count++;
        });
        return count;
    }, [primaryHighlightedPath, allSecondaryPathsSet, selectedFiles]);


    // Helper function to get Tailwind CSS classes for highlight text color
    const getHighlightStyle = (path: string): string => {
        if (secondaryHighlightedPaths.component.includes(path)) return "text-sky-400";
        if (secondaryHighlightedPaths.context.includes(path)) return "text-purple-400";
        if (secondaryHighlightedPaths.hook.includes(path)) return "text-yellow-400";
        if (secondaryHighlightedPaths.lib.includes(path)) return "text-emerald-400";
        return "";
    };

    // Helper function to get the category badge text
    const getCategoryBadge = (path: string): string | null => {
        if (secondaryHighlightedPaths.component.includes(path)) return "Comp";
        if (secondaryHighlightedPaths.context.includes(path)) return "Ctx";
        if (secondaryHighlightedPaths.hook.includes(path)) return "Hook";
        if (secondaryHighlightedPaths.lib.includes(path)) return "Lib";
        return null;
    }
    // Helper function to get the category badge background color
    const getCategoryBadgeBg = (path: string): string | null => {
         if (secondaryHighlightedPaths.component.includes(path)) return "bg-sky-600/80 text-sky-100";
         if (secondaryHighlightedPaths.context.includes(path)) return "bg-purple-600/80 text-purple-100";
         if (secondaryHighlightedPaths.hook.includes(path)) return "bg-yellow-600/80 text-yellow-100";
         if (secondaryHighlightedPaths.lib.includes(path)) return "bg-emerald-600/80 text-emerald-100";
        return null;
    }


    return (
        <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700/80 shadow-inner flex flex-col max-h-[65vh] min-h-[300px]"> {/* Adjusted padding, max-height */}
            {/* Header Section */}
            <div className="flex flex-wrap justify-between items-center mb-2 gap-2 flex-shrink-0">
                 <h3 className="text-sm font-semibold text-cyan-300">Файлы репозитория ({files.length})</h3> {/* Slightly smaller header */}
                 {hasHighlightableFiles && unselectedHighlightCount > 0 && (
                    <motion.button
                        onClick={onSelectHighlighted}
                        disabled={isActionDisabled} // Disable based on prop
                        className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-cyan-600/30 text-cyan-300 hover:bg-cyan-500/40 hover:text-cyan-200 transition-colors border border-cyan-500/50 disabled:opacity-50"
                        whileHover={{ scale: isActionDisabled ? 1 : 1.05 }}
                        whileTap={{ scale: isActionDisabled ? 1 : 0.95 }}
                        title={`Выбрать ${unselectedHighlightCount} связанных файлов`}
                    >
                        <FaHighlighter size={10}/> Выбрать связанные ({unselectedHighlightCount})
                    </motion.button>
                 )}
            </div>

             {/* Action Buttons Row */}
             <div className="flex flex-wrap gap-2 mb-3 text-xs flex-shrink-0">
                 {/* Updated styles, disable based on prop */}
                 <motion.button onClick={onAddSelected} disabled={selectedFiles.size === 0 || isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-500 transition-all shadow-[0_0_8px_rgba(99,102,241,0.3)] ${(selectedFiles.size === 0 || isActionDisabled) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(99,102,241,0.5)]'}`} whileHover={{ scale: (selectedFiles.size === 0 || isActionDisabled) ? 1 : 1.03 }} whileTap={{ scale: (selectedFiles.size === 0 || isActionDisabled) ? 1 : 0.97 }}> <FaFileLines /> Добавить ({selectedFiles.size}) </motion.button>
                 <motion.button onClick={onAddImportant} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-[0_0_8px_rgba(0,255,157,0.3)] ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(0,255,157,0.5)]'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }}> <FaKey /> Важные </motion.button>
                 <motion.button onClick={onAddTree} disabled={files.length === 0 || isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-red-600 to-orange-500 transition-all shadow-[0_0_8px_rgba(255,107,107,0.3)] ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(255,107,107,0.5)]'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }}> <FaTree /> Дерево </motion.button>
             </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center items-center flex-grow">
                    <p className="text-gray-400 animate-pulse text-sm">Загрузка списка файлов...</p>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && files.length === 0 && (
                <div className="flex justify-center items-center flex-grow">
                    <p className="text-gray-400 text-sm">Файлы не найдены.</p>
                </div>
            )}

             {/* Files List Area */}
             {!isLoading && files.length > 0 && (
                 <div id={id} className="overflow-y-auto flex-grow space-y-2 custom-scrollbar pr-2 -mr-2"> {/* Reduced space-y */}
                    <AnimatePresence>
                         {groupedFiles.map(({ folder, files: folderFiles }) => (
                            <motion.div
                                key={folder}
                                className="bg-gray-900/70 p-2 rounded-md border border-gray-700/40 shadow-sm" // Adjusted styles
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }} // Faster transition
                            >
                                <h4 className="text-xs font-medium text-purple-400 mb-1.5 sticky top-0 bg-gray-900/80 backdrop-blur-sm py-1 z-10 -mx-2 px-2 border-b border-gray-700/30 truncate" title={folder}> {/* Smaller header, truncate */}
                                    {folder === '/' ? 'Корень проекта' : folder}
                                </h4>
                                <ul className="space-y-0.5 pt-1"> {/* Tighter spacing */}
                                    {folderFiles.map((file) => {
                                        const isSelected = selectedFiles.has(file.path);
                                        const isImportant = importantFiles.includes(file.path);
                                        const isPrimary = file.path === primaryHighlightedPath;
                                        const isSecondary = allSecondaryPathsSet.has(file.path);
                                        const secondaryStyle = isSecondary ? getHighlightStyle(file.path) : "";
                                        const categoryBadge = isSecondary ? getCategoryBadge(file.path) : null;
                                        const categoryBadgeBg = isSecondary ? getCategoryBadgeBg(file.path) : null;

                                        let fileItemClasses = `flex items-center justify-between p-1 rounded cursor-pointer transition-all duration-100 text-[11px] group `; // Smaller font, padding

                                        if (isSelected) {
                                            fileItemClasses += ` bg-purple-800/40 border-l-2 border-purple-500 `; // Adjusted selected style
                                        } else {
                                            fileItemClasses += ` hover:bg-gray-700/50 `;
                                        }
                                        if (isPrimary) {
                                            fileItemClasses += ` ring-1 ring-offset-1 ring-offset-gray-900 ring-cyan-400 font-semibold `; // Adjusted primary style
                                        } else if (isSecondary && !isSelected) {
                                            fileItemClasses += ` border border-dashed border-gray-600/50 hover:border-gray-500/70 `;
                                        }

                                        return (
                                            <li
                                                key={file.path}
                                                id={`file-${file.path}`}
                                                className={fileItemClasses}
                                                onClick={() => toggleFileSelection(file.path)}
                                                title={file.path}
                                            >
                                                <div className="flex items-center gap-1.5 overflow-hidden flex-grow min-w-0 mr-1"> {/* Ensure truncation */}
                                                     {isSelected ? (
                                                        <FaSquareCheck className="text-purple-400 flex-shrink-0 w-3 h-3"/> // Smaller icons
                                                     ) : (
                                                        <FaRegSquare className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 w-3 h-3"/>
                                                     )}
                                                     <span className={`truncate ${isSelected ? 'text-gray-100' : 'text-gray-300 group-hover:text-gray-100'} ${secondaryStyle} ${isPrimary ? 'text-cyan-300' : ''}`}>
                                                         {getDisplayName(file.path)}
                                                     </span>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0 ml-1"> {/* Smaller gap */}
                                                    {isPrimary && <span className="text-[9px] font-bold bg-cyan-500/80 text-gray-900 px-1 py-0 rounded-sm">MAIN</span>}
                                                    {isSecondary && categoryBadge && categoryBadgeBg && (
                                                        <span className={`text-[9px] px-1 py-0 rounded-sm ${categoryBadgeBg}`}>{categoryBadge}</span>
                                                    )}
                                                    {isImportant && !isPrimary && !isSecondary && (
                                                        <span className="text-[9px] bg-yellow-700/80 text-yellow-200 px-1 py-0 rounded-sm" title="Important File">Imp</span>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </motion.div>
                         ))}
                    </AnimatePresence>
                 </div>
             )}
        </div>
    );
});
FileList.displayName = 'FileList'; // Add display name for React DevTools

export default FileList;