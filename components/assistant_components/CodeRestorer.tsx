"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ValidationIssue, FileEntry } from '@/hooks/useCodeParsingAndValidation'; // Adjust path
import { FaCodeMerge, FaWandMagicSparkles, FaRotate, FaPoo, FaXmark, FaCheck } from 'react-icons/fa6'; // Added FaCheck, FaXmark
import VibeContentRenderer from '@/components/VibeContentRenderer'; // Import Vibe renderer

// NOTE: This component is NO LONGER USED in AICodeAssistant.tsx based on the new requirements.
// It's kept here for reference or future potential use if the restoration logic is ever reintroduced.
// If it's definitively removed, this file can be deleted.

// --- Restore Modal Component ---
interface RestoreSkippedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAttemptRestore: () => Promise<void>; // Trigger the restore attempt
    issues: ValidationIssue[];
    isLoading: boolean;
    restoreStatus: Record<string, 'pending' | 'success' | 'not_found' | 'failed_verification'>; // Track status per issue ID
    allowManualRestore: boolean; // Flag to show manual paste option
    onManualRestore: (fullCode: string) => void; // Callback for manual paste
}

const RestoreSkippedModal: React.FC<RestoreSkippedModalProps> = ({
    isOpen, onClose, onAttemptRestore, issues, isLoading, restoreStatus, allowManualRestore, onManualRestore
}) => {
    const [manualCodeText, setManualCodeText] = useState('');
    const [showManual, setShowManual] = useState(false);

    useEffect(() => { if (isOpen) { setManualCodeText(''); setShowManual(false); } }, [isOpen]);
    const handleManualRestoreClick = () => { if (!manualCodeText.trim()) return toast.warn("Вставьте полный код."); onManualRestore(manualCodeText); }
    if (!isOpen) return null;
    const affectedFiles = Array.from(new Set(issues.map(i => i.filePath))).sort();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-2xl border border-indigo-500/30 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold text-indigo-400">Восстановление пропущенного кода</h3>
                     <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition">
                         <FaXmark />
                     </button>
                 </div>
                <p className="text-sm text-gray-300 mb-3">Обнаружены маркеры <code className='text-xs bg-gray-700 px-1 rounded'>/* ... */</code>. Попытка автоматического восстановления из оригинальных файлов проекта:</p>
                <div className="text-xs mb-4 max-h-40 overflow-y-auto simple-scrollbar border border-gray-700 rounded p-2 bg-gray-900 space-y-1">
                    {issues.map(issue => ( <div key={issue.id} className="flex items-center gap-2"> {restoreStatus[issue.id] === 'pending' && <FaRotate className="animate-spin text-blue-400 flex-shrink-0" size={12}/>} {restoreStatus[issue.id] === 'success' && <FaCheck className="text-green-500 flex-shrink-0" size={12}/>} {(restoreStatus[issue.id] === 'not_found' || restoreStatus[issue.id] === 'failed_verification') && <FaPoo className="text-red-500 flex-shrink-0" size={12}/>} <code className="text-gray-400">{issue.filePath}</code> <span className='text-gray-500'>(строка ~{issue.details?.lineNumber})</span> {restoreStatus[issue.id] === 'not_found' && <span className='text-orange-400 ml-auto text-[10px]'>Не найдено в оригинале</span>} {restoreStatus[issue.id] === 'failed_verification' && <span className='text-red-400 ml-auto text-[10px]'>Ошибка проверки</span>} </div> ))}
                </div>
                {allowManualRestore && !showManual && ( <button onClick={()=> setShowManual(true)} className='text-sm text-blue-400 hover:underline mb-3 text-left'>Не удалось восстановить? Попробовать вручную...</button> )}
                {showManual && ( <> <p className="text-sm text-gray-300 mb-2">Вставьте <strong className='text-yellow-400'>полный оригинальный код</strong> (из редактора) в поле ниже:</p> <textarea value={manualCodeText} onChange={(e) => setManualCodeText(e.target.value)} className="w-full flex-grow p-3 bg-gray-900 rounded border border-gray-600 focus:border-indigo-500 focus:outline-none text-xs font-mono resize-none mb-4 simple-scrollbar min-h-[150px]" placeholder="Вставьте сюда ПОЛНЫЙ ОРИГИНАЛЬНЫЙ КОД..." spellCheck="false" disabled={isLoading} /> </> )}
                <div className="flex justify-end gap-3 mt-auto pt-4 border-t border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-500 transition text-white" disabled={isLoading}>Закрыть</button>
                    {showManual ? ( <button onClick={handleManualRestoreClick} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 transition shadow-md disabled:opacity-50" disabled={isLoading || !manualCodeText.trim()}> {isLoading ? "Восстановление..." : <><FaWandMagicSparkles size={14}/> Восстановить вручную</>} </button>)
                     : ( <button onClick={onAttemptRestore} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 transition shadow-md disabled:opacity-50" disabled={isLoading || Object.values(restoreStatus).every(s => s !== 'pending')}> {isLoading ? "Восстановление..." : <><FaWandMagicSparkles size={14}/> Попробовать авто</>} </button> )}
                </div>
            </motion.div>
        </div>
    );
};
RestoreSkippedModal.displayName = 'RestoreSkippedModal';

// --- Main CodeRestorer Component ---
interface CodeRestorerProps {
    parsedFiles: FileEntry[];
    originalFiles: { path: string; content: string }[];
    skippedIssues: ValidationIssue[]; // Should only contain 'skippedCodeBlock' type
    onRestorationComplete: (updatedFiles: FileEntry[], successCount: number, errorCount: number) => void;
    disabled?: boolean;
}

// UPDATED Regex to match only 3 dots
const skippedCodeBlockMarkerRegex = /(\/\*\s*\.{3}\s*\*\/)|({\s*\/\*\s*\.{3}\s*\*\/\s*})|(\[\s*\/\*\s*\.{3}\s*\*\/\s*\])/;

export const CodeRestorer: React.FC<CodeRestorerProps> = ({
    parsedFiles, originalFiles, skippedIssues, onRestorationComplete, disabled = false
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState<Record<string, 'pending' | 'success' | 'not_found' | 'failed_verification'>>({});
    const [allowManualRestore, setAllowManualRestore] = useState(false);

    // --- REMOVED Restoration Logic Callbacks ---
    // const performRestorationLogic = useCallback(...)
    // const handleAutoAttempt = useCallback(...)
    // const handleManualAttempt = useCallback(...)

    // Don't render button if no issues
    if (skippedIssues.length === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1">
            {/* Vibe message */}
            <div className="text-indigo-300 text-xs italic flex items-center gap-1">
                 <VibeContentRenderer content="<FaCodeMerge/> Код пропущен! Попроси AI восстановить." />
            </div>
            {/* REMOVED Restore button and Modal */}
             {/* <button ... onClick={() => setIsModalOpen(true)} ... > */}
             {/*    Восстановить ({skippedIssues.length})... */}
             {/* </button> */}
             {/* <AnimatePresence> ... Modal ... </AnimatePresence> */}
        </div>
    );
};
CodeRestorer.displayName = 'CodeRestorer';