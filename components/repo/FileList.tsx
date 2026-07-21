"use client";

import React from 'react';
// Added FaListCheck and FaSquareXmark for new buttons
import { FaSquareCheck, FaRegSquare, FaPlus, FaCodeBranch, FaStar, FaHighlighter, FaKey, FaTree, FaFileLines, FaListCheck, FaSquareXmark, FaRobot } from 'react-icons/fa6';
import { FileNode, ImportCategory } from '@/contexts/RepoXmlPageContext';
import { motion, AnimatePresence } from 'framer-motion';

// Interface defining the props expected by FileList
interface FileListProps {
    id: string;
    files: FileNode[];
    selectedFiles: Set<string>;
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
    docXAuditFiles: string[];
    isLoading: boolean;
    isActionDisabled: boolean;
    toggleFileSelection: (path: string) => void;
    onAddSelected: () => void;
    onAddImportant: () => void;
    onAddDocXagent: () => void;
    onAddDocXRental: () => void;
    onAddDocXSale: () => void;
    onAddDocXSubrent: () => void;
    onAddDocXCommercial: () => void;
    onAddDocXCore: () => void;
    onAddDocXApp: () => void;
    onAddDocXMigrations: () => void;
    onAddDocXDocs: () => void;
    onAddDocXAudit: () => void;
    onAddTree: () => void;
    onSelectHighlighted: () => void;
    // --- NEW PROPS for bulk actions ---
    onSelectAll: () => void;
    onDeselectAll: () => void;
    // --- End NEW PROPS ---
}

// Helper to get the display name (filename) from a full path
const getDisplayName = (path: string) => path.split("/").pop() || path;

// Helper to group files by their parent folder
const groupFilesByFolder = (files: FileNode[]) => { const g: { folder: string; files: FileNode[] }[] = []; const fm: { [key: string]: FileNode[] } = {}; files.forEach((f) => { const fo = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf("/")) : "/"; if (!fm[fo]) fm[fo] = []; fm[fo].push(f); }); const sF = Object.keys(fm).sort((a, b) => { if (a === '/') return -1; if (b === '/') return 1; return a.localeCompare(b); }); sF.forEach(fo => { fm[fo].sort((a, b) => getDisplayName(a.path).localeCompare(getDisplayName(b.path))); g.push({ folder: fo, files: fm[fo] }); }); return g; };


const FileList: React.FC<FileListProps> = React.memo(({ // Memoize the component
    id, files, selectedFiles, primaryHighlightedPath, secondaryHighlightedPaths, importantFiles, docXagentFiles,
    docXRentalFiles, docXSaleFiles, docXSubrentFiles, docXCommercialFiles, docXCoreFiles, docXAppFiles,
    docXMigrationsFiles, docXDocsFiles, docXAuditFiles,
    isLoading, isActionDisabled, toggleFileSelection, onAddSelected, onAddImportant, onAddDocXagent,
    onAddDocXRental, onAddDocXSale, onAddDocXSubrent, onAddDocXCommercial, onAddDocXCore, onAddDocXApp,
    onAddDocXMigrations, onAddDocXDocs, onAddDocXAudit,
    onAddTree, onSelectHighlighted, onSelectAll, onDeselectAll, // Destructure new props
}) => {

    const groupedFiles = React.useMemo(() => groupFilesByFolder(files), [files]);
    const allSecondaryPathsSet = React.useMemo(() => { const c=new Set<string>(); (Object.keys(secondaryHighlightedPaths) as ImportCategory[]).filter(cat => cat !== 'other').forEach(cat => { secondaryHighlightedPaths[cat].forEach(p => c.add(p)); }); return c; }, [secondaryHighlightedPaths]);
    const hasHighlightableFiles = !!primaryHighlightedPath || allSecondaryPathsSet.size > 0;
    const unselectedHighlightCount = React.useMemo(() => { let c=0; if(primaryHighlightedPath && !selectedFiles.has(primaryHighlightedPath)) c++; allSecondaryPathsSet.forEach(p => {if(!selectedFiles.has(p)) c++;}); return c; }, [primaryHighlightedPath, allSecondaryPathsSet, selectedFiles]);
    const getHighlightStyle = (path: string): string => { if(secondaryHighlightedPaths.component.includes(path)) return "text-sky-400"; if(secondaryHighlightedPaths.context.includes(path)) return "text-purple-400"; if(secondaryHighlightedPaths.hook.includes(path)) return "text-yellow-400"; if(secondaryHighlightedPaths.lib.includes(path)) return "text-emerald-400"; return ""; };
    const getCategoryBadge = (path: string): string | null => { if(secondaryHighlightedPaths.component.includes(path)) return "Comp"; if(secondaryHighlightedPaths.context.includes(path)) return "Ctx"; if(secondaryHighlightedPaths.hook.includes(path)) return "Hook"; if(secondaryHighlightedPaths.lib.includes(path)) return "Lib"; return null; }
    const getCategoryBadgeBg = (path: string): string | null => { if(secondaryHighlightedPaths.component.includes(path)) return "bg-sky-600/80 text-sky-100"; if(secondaryHighlightedPaths.context.includes(path)) return "bg-purple-600/80 text-purple-100"; if(secondaryHighlightedPaths.hook.includes(path)) return "bg-yellow-600/80 text-yellow-100"; if(secondaryHighlightedPaths.lib.includes(path)) return "bg-emerald-600/80 text-emerald-100"; return null; }

    const allFilesCount = files.length;
    const selectedCount = selectedFiles.size;
    const canSelectAll = selectedCount < allFilesCount;
    const canDeselectAll = selectedCount > 0;

    return (
        <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700/80 shadow-inner flex flex-col max-h-[65vh] min-h-[300px]">
            <div className="flex flex-wrap justify-between items-center mb-2 gap-2 flex-shrink-0">
                 <h3 className="text-sm font-semibold text-cyan-300">Файлы ({selectedCount} / {allFilesCount})</h3>
                 {hasHighlightableFiles && unselectedHighlightCount > 0 && ( <motion.button onClick={onSelectHighlighted} disabled={isActionDisabled} className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-cyan-600/30 text-cyan-300 hover:bg-cyan-500/40 hover:text-cyan-200 transition-colors border border-cyan-500/50 disabled:opacity-50" whileHover={{ scale: isActionDisabled ? 1 : 1.05 }} whileTap={{ scale: isActionDisabled ? 1 : 0.95 }} title={`Выбрать ${unselectedHighlightCount} связанных`}> <FaHighlighter size={10}/> Связанные ({unselectedHighlightCount}) </motion.button> )}
            </div>
             <div className="flex flex-wrap gap-2 mb-3 text-xs flex-shrink-0">
                 {/* Core actions */}
                 <motion.button onClick={onAddSelected} disabled={selectedCount === 0 || isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-500 transition-all shadow-md shadow-purple-500/30 ${(selectedCount === 0 || isActionDisabled) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-indigo-500/40'}`} whileHover={{ scale: (selectedCount === 0 || isActionDisabled) ? 1 : 1.03 }} whileTap={{ scale: (selectedCount === 0 || isActionDisabled) ? 1 : 0.97 }}> <FaFileLines /> Добавить ({selectedCount}) </motion.button>
                 <motion.button onClick={onAddImportant} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-md shadow-cyan-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-teal-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }}> <FaKey /> Важные </motion.button>

                 {/* DocX Presets - grouped by workflow */}
                 <div className="flex flex-wrap gap-1 border-l border-gray-700 pl-2">
                     <span className="text-[10px] text-gray-500 flex items-center px-1">DocX:</span>
                     <motion.button onClick={onAddDocXRental} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-green-600 to-teal-500 transition-all shadow-md shadow-teal-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-green-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Rental contract generation flow"> Rental </motion.button>
                     <motion.button onClick={onAddDocXSale} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 transition-all shadow-md shadow-amber-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-orange-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Sale contract generation flow"> Sale </motion.button>
                     <motion.button onClick={onAddDocXSubrent} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-500 transition-all shadow-md shadow-pink-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-purple-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Subrent contract generation flow"> Subrent </motion.button>
                     <motion.button onClick={onAddDocXCommercial} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-500 transition-all shadow-md shadow-indigo-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-blue-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Commercial proposal generation flow"> Prop </motion.button>
                 </div>

                 <div className="flex flex-wrap gap-1 border-l border-gray-700 pl-2">
                     <motion.button onClick={onAddDocXCore} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-slate-600 to-gray-500 transition-all shadow-md shadow-gray-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-slate-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Core utilities (htmlToDocx, concat, notify)"> Core </motion.button>
                     <motion.button onClick={onAddDocXApp} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-cyan-600 to-sky-500 transition-all shadow-md shadow-sky-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-cyan-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="App integration (dashboard, API)"> App </motion.button>
                     <motion.button onClick={onAddDocXMigrations} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-red-600 to-rose-500 transition-all shadow-md shadow-rose-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-red-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Database migrations"> Migrations </motion.button>
                     <motion.button onClick={onAddDocXDocs} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-yellow-600 to-lime-500 transition-all shadow-md shadow-lime-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-yellow-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Documentation & seed data"> Docs </motion.button>
                     <motion.button onClick={onAddDocXAudit} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-rose-800 to-pink-700 transition-all shadow-md shadow-pink-700/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-rose-700/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="Identity-flow audit files (§13.4c parked items)"> Audit </motion.button>
                     <motion.button onClick={onAddDocXagent} disabled={isActionDisabled} className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all shadow-md shadow-fuchsia-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-fuchsia-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }} title="All DocX files combined"> <FaRobot /> All </motion.button>
                 </div>

                 {/* Tree & bulk actions */}
                 <motion.button onClick={onAddTree} disabled={allFilesCount === 0 || isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-red-600 to-orange-500 transition-all shadow-md shadow-orange-500/30 ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-red-500/40'}`} whileHover={{ scale: isActionDisabled ? 1 : 1.03 }} whileTap={{ scale: isActionDisabled ? 1 : 0.97 }}> <FaTree /> Дерево </motion.button>
                 {/* --- NEW Buttons --- */}
                 <motion.button onClick={onSelectAll} disabled={!canSelectAll || isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-500 transition-all shadow-md shadow-emerald-500/30 ${(!canSelectAll || isActionDisabled) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-green-500/40'}`} whileHover={{ scale: (!canSelectAll || isActionDisabled) ? 1 : 1.03 }} whileTap={{ scale: (!canSelectAll || isActionDisabled) ? 1 : 0.97 }} title="Выбрать все файлы"> <FaListCheck /> Все </motion.button>
                 <motion.button onClick={onDeselectAll} disabled={!canDeselectAll || isActionDisabled} className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-semibold text-white bg-gradient-to-r from-gray-600 to-slate-500 transition-all shadow-md shadow-slate-500/30 ${(!canDeselectAll || isActionDisabled) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-gray-500/40'}`} whileHover={{ scale: (!canDeselectAll || isActionDisabled) ? 1 : 1.03 }} whileTap={{ scale: (!canDeselectAll || isActionDisabled) ? 1 : 0.97 }} title="Снять выбор со всех"> <FaSquareXmark /> Ничего </motion.button>
                 {/* --- End NEW Buttons --- */}
             </div>
            {isLoading && ( <div className="flex justify-center items-center flex-grow"><p className="text-gray-400 animate-pulse text-sm">Загрузка...</p></div> )}
            {!isLoading && files.length === 0 && ( <div className="flex justify-center items-center flex-grow"><p className="text-gray-400 text-sm">Файлы не найдены.</p></div> )}
             {!isLoading && files.length > 0 && (
                 <div id={id} className="overflow-y-auto flex-grow space-y-2 custom-scrollbar pr-2 -mr-2">
                    <AnimatePresence>
                         {groupedFiles.map(({ folder, files: folderFiles }) => (
                            <motion.div key={folder} className="bg-gray-900/70 p-2 rounded-md border border-gray-700/40 shadow-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                <h4 className="text-xs font-medium text-purple-400 mb-1.5 sticky top-0 bg-gray-900/80 backdrop-blur-sm py-1 z-10 -mx-2 px-2 border-b border-gray-700/30 truncate" title={folder}> {folder === '/' ? 'Корень' : folder} </h4>
                                <ul className="space-y-0.5 pt-1">
                                    {folderFiles.map((file) => {
                                        const isSelected = selectedFiles.has(file.path); const isImportant = importantFiles.includes(file.path); const isDocXagent = docXagentFiles.includes(file.path); const isPrimary = file.path === primaryHighlightedPath; const isSecondary = allSecondaryPathsSet.has(file.path); const secondaryStyle = isSecondary ? getHighlightStyle(file.path) : ""; const categoryBadge = isSecondary ? getCategoryBadge(file.path) : null; const categoryBadgeBg = isSecondary ? getCategoryBadgeBg(file.path) : null;
                                        let fileItemClasses = `flex items-center justify-between p-1 rounded cursor-pointer transition-all duration-100 text-[11px] group `;
                                        if (isSelected) { fileItemClasses += ` bg-purple-800/40 border-l-2 border-purple-500 `; } else { fileItemClasses += ` hover:bg-gray-700/50 `; } if (isPrimary) { fileItemClasses += ` ring-1 ring-offset-1 ring-offset-gray-900 ring-cyan-400 font-semibold `; } else if (isSecondary && !isSelected) { fileItemClasses += ` border border-dashed border-gray-600/50 hover:border-gray-500/70 `; }
                                        return (
                                            <li key={file.path} id={`file-${file.path}`} className={fileItemClasses} onClick={() => toggleFileSelection(file.path)} title={file.path}>
                                                <div className="flex items-center gap-1.5 overflow-hidden flex-grow min-w-0 mr-1"> {isSelected ? <FaSquareCheck className="text-purple-400 flex-shrink-0 w-3 h-3"/> : <FaRegSquare className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 w-3 h-3"/>} <span className={`truncate ${isSelected ? 'text-gray-100' : 'text-gray-300 group-hover:text-gray-100'} ${secondaryStyle} ${isPrimary ? 'text-cyan-300' : ''}`}> {getDisplayName(file.path)} </span> </div>
                                                <div className="flex items-center gap-1 flex-shrink-0 ml-1"> {isPrimary && <span className="text-[9px] font-bold bg-cyan-500/80 text-gray-900 px-1 py-0 rounded-sm">MAIN</span>} {isSecondary && categoryBadge && categoryBadgeBg && (<span className={`text-[9px] px-1 py-0 rounded-sm ${categoryBadgeBg}`}>{categoryBadge}</span>)} {isImportant && !isPrimary && !isSecondary && (<span className="text-[9px] bg-yellow-700/80 text-yellow-200 px-1 py-0 rounded-sm" title="Important File">Imp</span>)} {isDocXagent && !isPrimary && !isSecondary && !isImportant && (<span className="text-[9px] bg-fuchsia-700/80 text-fuchsia-200 px-1 py-0 rounded-sm" title="DocXagent File">Doc</span>)} </div>
                                            </li> );
                                    })}
                                </ul>
                            </motion.div> ))}
                    </AnimatePresence>
                 </div> )}
        </div>
    );
});
FileList.displayName = 'FileList';

export default FileList;