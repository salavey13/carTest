"use client";

import React from 'react';
import { FaCheckSquare, FaRegSquare, FaPlus, FaCodeBranch, FaStar, FaHighlighter, FaKey, FaTree, FaFileLines } from 'react-icons/fa6'; // Include needed icons
import { FileNode, ImportCategory } from '../RepoTxtFetcher'; // Import FileNode and ImportCategory type
import { motion, AnimatePresence } from 'framer-motion';

// Interface defining the props expected by FileList
interface FileListProps {
    id: string; // Element ID for scrolling purposes
    files: FileNode[]; // Array of all fetched files
    selectedFiles: Set<string>; // Set of currently selected file paths
    primaryHighlightedPath: string | null; // Path of the main file (from URL param)
    secondaryHighlightedPaths: Record<ImportCategory, string[]>; // Categorized related files (imports)
    importantFiles: string[]; // List of predefined important file paths
    isLoading: boolean; // Indicates if the parent component is fetching/loading
    toggleFileSelection: (path: string) => void; // Function to toggle selection of a file
    onAddSelected: () => void; // Function to add selected files to the AI context
    onAddImportant: () => void; // Function to add important files to the AI context
    onAddTree: () => void; // Function to add the file tree to the AI context
    onSelectHighlighted: () => void; // Function to select all primary/secondary highlighted files
}

// Helper to get the display name (filename) from a full path
const getDisplayName = (path: string) => path.split("/").pop() || path;

// Helper to group files by their parent folder
const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { folder: string; files: FileNode[] }[] = [];
    const folderMap: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
        const folder = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf("/")) : "/"; // Use '/' for root
        if (!folderMap[folder]) folderMap[folder] = [];
        folderMap[folder].push(file);
    });
    // Sort folders alphabetically, ensuring root ("/") comes first
    const sortedFolders = Object.keys(folderMap).sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
    });
    // Populate the grouped array with sorted files within each folder
    sortedFolders.forEach(folder => {
        folderMap[folder].sort((a, b) => getDisplayName(a.path).localeCompare(getDisplayName(b.path))); // Sort files by name within folder
        grouped.push({ folder, files: folderMap[folder] });
    });
    return grouped;
};


const FileList: React.FC<FileListProps> = ({
    id,
    files,
    selectedFiles,
    primaryHighlightedPath,
    secondaryHighlightedPaths,
    importantFiles,
    isLoading,
    toggleFileSelection,
    onAddSelected,
    onAddImportant,
    onAddTree,
    onSelectHighlighted,
}) => {

    // Memoize the grouped files structure to avoid recalculating on every render
    const groupedFiles = React.useMemo(() => groupFilesByFolder(files), [files]);

    // Combine all secondary paths (component, context, hook, lib) into a single Set for efficient lookups
    const allSecondaryPathsSet = React.useMemo(() => {
        const combined = new Set<string>();
        (Object.keys(secondaryHighlightedPaths) as ImportCategory[])
            .filter(cat => cat !== 'other') // Exclude 'other' category
            .forEach(category => {
                secondaryHighlightedPaths[category].forEach(path => combined.add(path));
            });
        return combined;
    }, [secondaryHighlightedPaths]);

    // Determine if there are any highlightable files (primary or desired secondary)
    const hasHighlightableFiles = !!primaryHighlightedPath || allSecondaryPathsSet.size > 0;

    // Calculate how many highlightable files are *not yet* selected, used for the "Select Highlighted" button badge
    const unselectedHighlightCount = React.useMemo(() => {
        let count = 0;
        if (primaryHighlightedPath && !selectedFiles.has(primaryHighlightedPath)) count++;
        allSecondaryPathsSet.forEach(path => {
            if (!selectedFiles.has(path)) count++;
        });
        return count;
    }, [primaryHighlightedPath, allSecondaryPathsSet, selectedFiles]);


    // Helper function to get Tailwind CSS classes for secondary highlight text color based on category
    const getHighlightStyle = (path: string): string => {
        if (secondaryHighlightedPaths.component.includes(path)) return "text-sky-400"; // Component
        if (secondaryHighlightedPaths.context.includes(path)) return "text-purple-400"; // Context
        if (secondaryHighlightedPaths.hook.includes(path)) return "text-yellow-400"; // Hook
        if (secondaryHighlightedPaths.lib.includes(path)) return "text-emerald-400"; // Lib
        return ""; // Default (no specific highlight style)
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
        // Main container for the FileList component
        <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-700/80 shadow-inner flex flex-col max-h-[75vh] min-h-[300px]"> {/* Ensure it can grow/shrink */}
            {/* Header Section */}
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2 flex-shrink-0">
                 <h3 className="text-base font-semibold text-cyan-300">Файлы репозитория ({files.length})</h3>
                 {/* Button to select all highlighted files (shown only if there are unselected highlights) */}
                 {hasHighlightableFiles && unselectedHighlightCount > 0 && (
                    <motion.button
                        onClick={onSelectHighlighted}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-cyan-600/30 text-cyan-300 hover:bg-cyan-500/40 hover:text-cyan-200 transition-colors border border-cyan-500/50"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={`Выбрать ${unselectedHighlightCount} связанных файлов`}
                    >
                        <FaHighlighter /> Выбрать связанные ({unselectedHighlightCount})
                    </motion.button>
                 )}
            </div>

             {/* Action Buttons Row */}
             <div className="flex flex-wrap gap-2 mb-3 text-xs flex-shrink-0">
                 {/* Button styles similar to the original FileList provided */}
                 <motion.button onClick={onAddSelected} disabled={selectedFiles.size === 0 || isLoading} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-500 transition-all shadow-[0_0_8px_rgba(99,102,241,0.3)] ${(selectedFiles.size === 0 || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(99,102,241,0.5)]'}`} whileHover={{ scale: (selectedFiles.size === 0 || isLoading) ? 1 : 1.03 }} whileTap={{ scale: (selectedFiles.size === 0 || isLoading) ? 1 : 0.97 }}> <FaFileLines /> Добавить ({selectedFiles.size}) </motion.button>
                 <motion.button onClick={onAddImportant} disabled={isLoading} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-[0_0_8px_rgba(0,255,157,0.3)] ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(0,255,157,0.5)]'}`} whileHover={{ scale: isLoading ? 1 : 1.03 }} whileTap={{ scale: isLoading ? 1 : 0.97 }}> <FaKey /> Важные </motion.button>
                 <motion.button onClick={onAddTree} disabled={files.length === 0 || isLoading} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-red-600 to-orange-500 transition-all shadow-[0_0_8px_rgba(255,107,107,0.3)] ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(255,107,107,0.5)]'}`} whileHover={{ scale: isLoading ? 1 : 1.03 }} whileTap={{ scale: isLoading ? 1 : 0.97 }}> <FaTree /> Дерево </motion.button>
             </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center items-center flex-grow">
                    <p className="text-gray-400 animate-pulse">Загрузка списка файлов...</p>
                </div>
            )}

            {/* Empty State (No files found after loading) */}
            {!isLoading && files.length === 0 && (
                <div className="flex justify-center items-center flex-grow">
                    <p className="text-gray-400">Файлы не найдены.</p>
                </div>
            )}

             {/* Files List Area (Scrollable) */}
             {!isLoading && files.length > 0 && (
                 <div id={id} className="overflow-y-auto flex-grow space-y-3 custom-scrollbar pr-2 -mr-2"> {/* Added flex-grow for scroll */}
                    <AnimatePresence>
                         {groupedFiles.map(({ folder, files: folderFiles }) => (
                            <motion.div
                                key={folder}
                                className="bg-gray-900/70 p-3 rounded-lg border border-gray-700/50 shadow-inner"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {/* Sticky Folder Header */}
                                <h4 className="text-sm font-semibold text-purple-400 mb-2 sticky top-0 bg-gray-900/80 backdrop-blur-sm py-1 z-10 -mx-3 px-3 border-b border-gray-700/30">
                                    {folder === '/' ? 'Корень проекта' : folder}
                                </h4>
                                <ul className="space-y-1 pt-1"> {/* Padding top to avoid overlap */}
                                    {folderFiles.map((file) => {
                                        const isSelected = selectedFiles.has(file.path);
                                        const isImportant = importantFiles.includes(file.path);
                                        // Determine highlighting status
                                        const isPrimary = file.path === primaryHighlightedPath;
                                        const isSecondary = allSecondaryPathsSet.has(file.path);
                                        const secondaryStyle = isSecondary ? getHighlightStyle(file.path) : "";
                                        const categoryBadge = isSecondary ? getCategoryBadge(file.path) : null;
                                        const categoryBadgeBg = isSecondary ? getCategoryBadgeBg(file.path) : null;

                                        // Define dynamic classes for the list item container
                                        let fileItemClasses = `flex items-center justify-between p-1.5 rounded cursor-pointer transition-all duration-150 text-xs group `;
                                        if (isSelected) {
                                            // Style for selected files
                                            fileItemClasses += ` bg-gradient-to-r from-purple-800/50 via-transparent to-transparent border-l-2 border-purple-400 `;
                                        } else {
                                            // Hover effect for non-selected files
                                            fileItemClasses += ` hover:bg-gray-700/60 `;
                                        }
                                        if (isPrimary) {
                                            // Distinct style for the primary highlighted file (ring)
                                            fileItemClasses += ` ring-2 ring-offset-1 ring-offset-gray-900 ring-cyan-400 `;
                                        } else if (isSecondary && !isSelected) {
                                            // Subtle border for secondary highlighted files if they are not selected
                                            fileItemClasses += ` border border-dashed border-gray-600/70 hover:border-gray-500/80 `;
                                        }

                                        return (
                                            <li
                                                key={file.path}
                                                id={`file-${file.path}`} // Assign ID for potential direct scrolling
                                                className={fileItemClasses}
                                                onClick={() => toggleFileSelection(file.path)}
                                                title={file.path} // Show full path on hover
                                            >
                                                {/* Left side: Checkbox and File Name */}
                                                <div className="flex items-center gap-2 overflow-hidden flex-grow min-w-0"> {/* Ensure text truncates */}
                                                     {/* Custom Checkbox simulation */}
                                                     {isSelected ? (
                                                        <FaCheckSquare className="text-purple-400 flex-shrink-0 w-3.5 h-3.5"/>
                                                     ) : (
                                                        <FaRegSquare className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 w-3.5 h-3.5"/>
                                                     )}
                                                     {/* File Name with highlighting */}
                                                     <span className={`truncate ${isSelected ? 'text-gray-100' : 'text-gray-300 group-hover:text-gray-100'} ${secondaryStyle} ${isPrimary ? 'font-bold text-cyan-300' : ''}`}>
                                                         {getDisplayName(file.path)}
                                                     </span>
                                                </div>
                                                {/* Right side: Badges */}
                                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                                    {/* Primary Badge */}
                                                    {isPrimary && <span className="text-[9px] font-bold bg-cyan-500/80 text-gray-900 px-1.5 py-0.5 rounded-sm">MAIN</span>}
                                                    {/* Secondary Category Badges */}
                                                    {isSecondary && categoryBadge && categoryBadgeBg && (
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-sm ${categoryBadgeBg}`}>{categoryBadge}</span>
                                                    )}
                                                    {/* Important Badge (show only if not already highlighted) */}
                                                    {isImportant && !isPrimary && !isSecondary && (
                                                        <span className="text-[9px] bg-yellow-700/80 text-yellow-200 px-1.5 py-0.5 rounded-sm" title="Important File">Imp</span>
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
};

export default FileList;