// /components/repo/FileList.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { FaTree, FaKey, FaFileLines } from 'react-icons/fa6';
import { FileNode } from '../RepoTxtFetcher'; // Import FileNode interface

interface FileListProps {
    files: FileNode[];
    selectedFiles: Set<string>;
    primaryHighlightedPath: string | null;
    secondaryHighlightedPaths: string[];
    importantFiles: string[];
    isLoading: boolean; // Added to potentially disable actions during load
    toggleFileSelection: (path: string) => void;
    onAddSelected: () => void;
    onAddImportant: () => void;
    onAddTree: () => void;
    onSelectHighlighted: () => void; // Added prop for consistency
    id?: string; // Added id prop
}

// Helper Functions (can be moved to a utils file if shared)
const getDisplayName = (path: string) => path.split("/").pop() || path;

const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { folder: string; files: FileNode[] }[] = [];
    const folderMap: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
        const folder = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf("/")) : "/"; // Use '/' for root
        if (!folderMap[folder]) folderMap[folder] = [];
        folderMap[folder].push(file);
    });
    // Sort folders, root first
    const sortedFolders = Object.keys(folderMap).sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
    });
    sortedFolders.forEach(folder => {
        // Sort files within folder
        folderMap[folder].sort((a, b) => a.path.localeCompare(b.path));
        grouped.push({ folder, files: folderMap[folder] });
    });
    return grouped;
};


const FileList: React.FC<FileListProps> = ({
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
    onSelectHighlighted, // Added destructuring
    id, // Added id destructuring
}) => {
    const grouped = groupFilesByFolder(files);
    const hasHighlights = !!primaryHighlightedPath || secondaryHighlightedPaths.length > 0;

    return (
        <div id={id} className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <h3 className="text-xl font-bold text-cyan-400 mb-3">Консоль файлов ({files.length})</h3>
            <div className="max-h-60 overflow-y-auto pr-2 space-y-3 custom-scrollbar"> {/* Added custom-scrollbar class if you have global styles */}
                {grouped.map(({ folder, files: folderFiles }) => (
                    <div key={folder} className="bg-gray-900 p-3 rounded-lg border border-gray-700 shadow-inner">
                        {/* Sticky header with slight transparency */}
                        <h4 className="text-sm font-semibold text-purple-400 mb-2 sticky top-0 bg-gray-900/80 backdrop-blur-sm py-1 z-10 -mx-3 px-3">
                            {folder === '/' ? 'Корень проекта' : folder}
                        </h4>
                        <ul className="space-y-1.5 pt-1"> {/* Added padding top to prevent overlap with sticky header */}
                            {folderFiles.map((file) => (
                                <li id={`file-${file.path}`} key={file.path} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 px-1 py-0.5 rounded transition-colors duration-150" onClick={() => toggleFileSelection(file.path)}>
                                    <input
                                        type="checkbox"
                                        checked={selectedFiles.has(file.path)}
                                        onChange={(e) => { e.stopPropagation(); toggleFileSelection(file.path); }}
                                        className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0 form-checkbox rounded"
                                        aria-labelledby={`label-${file.path}`}
                                        disabled={isLoading} // Disable checkbox during loading
                                    />
                                    <span
                                        id={`label-${file.path}`}
                                        className={`text-xs flex-grow truncate ${
                                            file.path === primaryHighlightedPath
                                                ? "text-yellow-300 font-bold ring-1 ring-yellow-400/80 rounded px-1 py-0.5 bg-yellow-900/30"
                                                : secondaryHighlightedPaths.includes(file.path)
                                                ? "text-green-400 font-semibold ring-1 ring-green-500/80 rounded px-1 py-0.5 bg-green-900/30"
                                                : importantFiles.includes(file.path)
                                                ? "text-cyan-300 font-medium"
                                                : "text-gray-400"
                                            } ${selectedFiles.has(file.path) ? 'text-white' : ''} `}
                                        title={file.path}
                                    >
                                        {getDisplayName(file.path)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                 <motion.button
                    onClick={onAddSelected}
                    disabled={selectedFiles.size === 0 || isLoading}
                    // *** UPDATED: rounded-full ***
                    className={`flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-500 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)] ${(selectedFiles.size === 0 || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_18px_rgba(99,102,241,0.5)]'}`}
                    whileHover={{ scale: (selectedFiles.size === 0 || isLoading) ? 1 : 1.05 }}
                    whileTap={{ scale: (selectedFiles.size === 0 || isLoading) ? 1 : 0.95 }}
                    >
                    <FaFileLines /> Добавить выбранные ({selectedFiles.size})
                </motion.button>
                {/* Optionally add button to select highlighted files if needed */}
                {/* {hasHighlights && (
                     <motion.button
                        onClick={onSelectHighlighted}
                        disabled={isLoading}
                        className={`flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-yellow-600 to-orange-500 transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)] ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_18px_rgba(245,158,11,0.5)]'}`}
                        whileHover={{ scale: isLoading ? 1 : 1.05 }} whileTap={{ scale: isLoading ? 1 : 0.95 }}
                     >
                        <FaStar /> Выбрать связанные
                    </motion.button>
                )} */}
                <motion.button
                    onClick={onAddImportant}
                    disabled={isLoading} // Disable during loading
                    // *** UPDATED: rounded-full ***
                    className={`flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]'}`}
                    whileHover={{ scale: isLoading ? 1 : 1.05 }} whileTap={{ scale: isLoading ? 1 : 0.95 }}
                    >
                    <FaKey /> Добавить важные
                </motion.button>
                <motion.button
                    onClick={onAddTree}
                    disabled={isLoading} // Disable during loading
                    // *** UPDATED: rounded-full ***
                    className={`flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-orange-500 transition-all shadow-[0_0_12px_rgba(255,107,107,0.3)] ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_18px_rgba(255,107,107,0.5)]'}`}
                    whileHover={{ scale: isLoading ? 1 : 1.05 }} whileTap={{ scale: isLoading ? 1 : 0.95 }}
                    >
                    <FaTree /> Добавить дерево
                </motion.button>
            </div>
        </div>
    );
};

export default FileList;