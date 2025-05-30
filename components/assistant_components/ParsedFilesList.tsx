"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
// REMOVED Tooltip Imports
import { FileEntry, ValidationIssue } from '../../hooks/useCodeParsingAndValidation'; // Adjust path if necessary
import { FaEllipsisVertical, FaSquareCheck, FaRegSquare, FaPaperPlane, FaCircleExclamation, FaFileZipper, FaFloppyDisk } from 'react-icons/fa6'; // Corrected FaRegSquare, FaPaperPlane
import clsx from 'clsx';

interface ParsedFilesListProps {
    parsedFiles: FileEntry[];
    selectedFileIds: Set<string>; // Use IDs for selection state
    validationIssues: ValidationIssue[];
    onToggleSelection: (fileId: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onSaveFiles: () => void;
    onDownloadZip: () => void;
    onSendToTelegram: (file: FileEntry) => void;
    isUserLoggedIn: boolean;
    isLoading: boolean; // General loading state
}

export const ParsedFilesList: React.FC<ParsedFilesListProps> = ({
    parsedFiles,
    selectedFileIds,
    validationIssues,
    onToggleSelection,
    onSelectAll,
    onDeselectAll,
    onSaveFiles,
    onDownloadZip,
    onSendToTelegram,
    isUserLoggedIn,
    isLoading
}) => {
    const [showFileMenu, setShowFileMenu] = useState(false);

    if (parsedFiles.length === 0) {
        return null; // Don't render anything if no files
    }

    return (
        <div className="mb-4 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-cyan-400">Разобранные файлы ({parsedFiles.length})</h2>
                <div className="relative">
                    <button className="p-1 text-gray-400 hover:text-white" onClick={() => setShowFileMenu(!showFileMenu)} title="Опции для файлов">
                        <FaEllipsisVertical />
                    </button>
                    {showFileMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="absolute right-0 mt-2 w-48 bg-gray-700 rounded shadow-lg z-30 border border-gray-600 overflow-hidden" // Increased z-index
                            onMouseLeave={() => setShowFileMenu(false)} // Close on mouse leave
                        >
                            <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => { onSaveFiles(); setShowFileMenu(false); }} disabled={!isUserLoggedIn || isLoading || selectedFileIds.size === 0} title={!isUserLoggedIn ? "Нужна авторизация" : (selectedFileIds.size === 0 ? "Выберите файлы" : "Сохранить выбранное в профиль")}>
                                <FaFloppyDisk size={14}/> Сохранить/Обновить
                            </button>
                            <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white disabled:opacity-50" onClick={() => { onDownloadZip(); setShowFileMenu(false); }} disabled={isLoading || selectedFileIds.size === 0} title={selectedFileIds.size === 0 ? "Выберите файлы" : "Скачать выбранное архивом"}>
                                <FaFileZipper size={14}/> Скачать ZIP
                            </button>
                            <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white disabled:opacity-50" onClick={() => { onSelectAll(); setShowFileMenu(false); }} disabled={isLoading || parsedFiles.length === 0}>
                                <FaSquareCheck size={14}/> Выбрать все
                            </button>
                            <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-600 text-sm transition text-white disabled:opacity-50" onClick={() => { onDeselectAll(); setShowFileMenu(false); }} disabled={isLoading || selectedFileIds.size === 0}>
                                 Снять выделение
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 simple-scrollbar">
                {parsedFiles.map((file) => {
                    const issuesForFile = validationIssues.filter(i => i.fileId === file.id);
                    const hasError = issuesForFile.length > 0;
                    const tooltipText = hasError ? issuesForFile.map(i => i.message).join('\n') : file.path;
                    const isSelected = selectedFileIds.has(file.id);

                    return (
                        <div
                            key={file.id}
                            className={clsx(
                                "flex items-center gap-2 cursor-pointer hover:bg-gray-700/80 px-1 py-0.5 rounded transition-colors duration-150",
                                hasError && "ring-1 ring-red-500/50" // Highlight files with errors
                            )}
                            onClick={() => onToggleSelection(file.id)}
                            title={tooltipText} // Basic tooltip for errors on hover
                        >
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => { e.stopPropagation(); onToggleSelection(file.id); }}
                                className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0 bg-gray-600 border-gray-500 rounded focus:ring-cyan-500 focus:ring-offset-gray-800"
                            />
                            <span className={clsx(
                                "truncate text-sm flex-grow",
                                isSelected ? 'text-white font-medium' : 'text-gray-400',
                                hasError && 'text-red-300' // Dim text slightly for error files
                            )}>
                                {file.path}
                            </span>
                            {hasError && (
                                <FaCircleExclamation className="text-red-500 flex-shrink-0" size={12} title={tooltipText} /> // Add title here too
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onSendToTelegram(file); }}
                                disabled={isLoading || !isUserLoggedIn}
                                className="ml-auto text-purple-500 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition p-0.5"
                                title={`Отправить ${file.path.split('/').pop()} в Telegram`}
                            >
                                <FaPaperPlane size={14}/>
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
ParsedFilesList.displayName = 'ParsedFilesList';