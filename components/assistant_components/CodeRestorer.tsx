"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ValidationIssue, FileEntry } from '@/hooks/useCodeParsingAndValidation'; // Adjust path
import { FaCodeMerge, FaWandMagicSparkles } from 'react-icons/fa6';
import { Tooltip } from '../AICodeAssistant'; // Adjust path if necessary

// --- Restore Modal Component ---
interface RestoreSkippedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRestore: (fullCode: string) => void;
    issues: ValidationIssue[];
    isLoading: boolean;
}

const RestoreSkippedModal: React.FC<RestoreSkippedModalProps> = ({ isOpen, onClose, onRestore, issues, isLoading }) => {
    const [fullCodeText, setFullCodeText] = useState('');
    const handleRestoreClick = () => { if (!fullCodeText.trim()) return toast.warn("Вставьте полный код."); onRestore(fullCodeText); };
    if (!isOpen) return null;
    const affectedFiles = Array.from(new Set(issues.map(i => i.filePath))).sort();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-2xl border border-indigo-500/30 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Восстановление кода</h3>
                <p className="text-sm text-gray-300 mb-2">Обнаружены маркеры пропуска в:</p>
                <div className="text-xs text-gray-400 mb-4 max-h-24 overflow-y-auto simple-scrollbar border border-gray-700 rounded p-2 bg-gray-900">
                    {affectedFiles.map((filePath, index) => (<div key={index}><code>{filePath}</code></div>))}
                </div>
                <p className="text-sm text-gray-300 mb-2">Вставьте <strong className='text-yellow-400'>полный оригинальный код</strong> ниже.</p>
                <textarea value={fullCodeText} onChange={(e) => setFullCodeText(e.target.value)} className="w-full flex-grow p-3 bg-gray-900 rounded border border-gray-600 focus:border-indigo-500 focus:outline-none text-xs font-mono resize-none mb-4 simple-scrollbar" placeholder="Вставьте сюда ПОЛНЫЙ ОРИГИНАЛЬНЫЙ КОД..." spellCheck="false" disabled={isLoading} />
                <div className="flex justify-end gap-3 mt-auto pt-4 border-t border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-500 transition text-white" disabled={isLoading}>Отмена</button>
                    <button onClick={handleRestoreClick} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 transition shadow-[0_0_10px_rgba(129,140,248,0.4)] disabled:opacity-50" disabled={isLoading || !fullCodeText.trim()}>
                        {isLoading ? "Восстановление..." : <><FaWandMagicSparkles size={14}/> Восстановить</>}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
RestoreSkippedModal.displayName = 'RestoreSkippedModal';


// --- Main CodeRestorer Component ---
interface CodeRestorerProps {
    filesToRestore: FileEntry[];
    skippedIssues: ValidationIssue[]; // Should only contain 'skippedCodeBlock' type
    onRestorationComplete: (updatedFiles: FileEntry[], successCount: number, errorCount: number) => void;
    disabled?: boolean;
}

const skippedCodeBlockMarkerRegex = /(\/\*\s*\.\.\.\s*\*\/)|({\s*\/\*\s*\.\.\.\s*\*\/\s*})|(\[\s*\/\*\s*\.\.\.\s*\*\/\s*\])/; // Find the marker

export const CodeRestorer: React.FC<CodeRestorerProps> = ({
    filesToRestore,
    skippedIssues,
    onRestorationComplete,
    disabled = false
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // --- Restoration Logic (Handles /*...*/, { /*...*/ }, [ /*...*/ ]) ---
    const performRestoration = useCallback((fullCodeText: string) => {
        setIsRestoring(true);
        let successCount = 0;
        let errorCount = 0;
        const filesContentMap = new Map(filesToRestore.map(f => [f.id, f.content]));
        let searchStartIndex = 0;

        // Only process issues of type 'skippedCodeBlock' passed to this component
        skippedIssues.forEach(issue => {
            const { fileId, details } = issue;
            if (issue.type !== 'skippedCodeBlock' || !details?.markerLineContent || !fileId) return;

            const currentFileContent = filesContentMap.get(fileId);
            if (!currentFileContent) { errorCount++; return; }

            const currentLines = currentFileContent.split('\n');
            // Find the specific line with the marker in the current content
            const markerLineIndex = currentLines.findIndex(line => line === details.markerLineContent);

            if (markerLineIndex === -1) { console.warn(`Restore: Marker line not found in current: ${issue.filePath}`); errorCount++; return; }

            // --- Find Matching Line in Full Text ---
            const fullLines = fullCodeText.split('\n');
            let fullMarkerLineIndex = -1;
            for (let i = searchStartIndex; i < fullLines.length; i++) { if (fullLines[i] === details.markerLineContent) { fullMarkerLineIndex = i; searchStartIndex = i + 1; break; } }
            if (fullMarkerLineIndex === -1) { console.warn(`Restore: Marker line not found in full: ${issue.filePath}`); errorCount++; return; }

            // --- Find Braces in Full Text (relative to marker line) ---
            let braceStartIndex = -1, braceStartLineIndex = -1, openBraceFound = false;
            for (let i = fullMarkerLineIndex; i < fullLines.length; i++) { const bracePos = fullLines[i].indexOf('{'); if (bracePos !== -1) { let charIndex=0; for(let j=0; j<i; j++) charIndex+=fullLines[j].length+1; braceStartIndex=charIndex+bracePos; braceStartLineIndex=i; openBraceFound=true; break; } if (i > fullMarkerLineIndex && fullLines[i].trim() !== '' && !fullLines[i].trim().startsWith('//') && !fullLines[i].trim().startsWith('/*')) break; }
            if (!openBraceFound) { console.warn(`Restore: No opening brace: ${issue.filePath}`); errorCount++; return; }

            let balance = 1, braceEndIndex = -1;
            for (let i = braceStartIndex + 1; i < fullCodeText.length; i++) { if (fullCodeText[i] === '{') balance++; else if (fullCodeText[i] === '}') balance--; if (balance === 0) { braceEndIndex = i; break; } }
            if (braceEndIndex === -1) { console.warn(`Restore: No closing brace: ${issue.filePath}`); errorCount++; return; }

            // --- Verification ---
            const markerMatch = details.markerLineContent.match(skippedCodeBlockMarkerRegex);
            if (!markerMatch) { console.warn(`Restore: Could not re-match marker: ${issue.filePath}`); errorCount++; return; } // Should not happen
            const markerText = markerMatch[0];
            const lineStartMarker = details.markerLineContent.substring(0, details.markerLineContent.indexOf(markerText));
            const lineEndMarker = details.markerLineContent.substring(details.markerLineContent.indexOf(markerText) + markerText.length);

            const fullStartLine = fullLines[braceStartLineIndex];
            let closingBraceLine = '', closingBraceLineIndex = -1;
            for (let i = braceStartLineIndex; i < fullLines.length; i++) { let charIndex=0; for(let j=0; j<i; j++) charIndex+=fullLines[j].length+1; if (charIndex + fullLines[i].length >= braceEndIndex) { closingBraceLine = fullLines[i]; closingBraceLineIndex = i; break; } }

            const startMatches = fullStartLine.trimStart().startsWith(lineStartMarker.trimStart());
            const endMatches = closingBraceLine.trimEnd().endsWith(lineEndMarker.trimEnd());
            const markerIndent = details.markerLineContent.match(/^\s*/)?.[0] ?? '';
            const closingIndent = closingBraceLine.match(/^\s*/)?.[0] ?? '';
            const indentMatches = markerIndent === closingIndent;

            if (!startMatches || !endMatches || !indentMatches) { console.warn(`Restore: Verification failed: ${issue.filePath}`); errorCount++; return; }

            // --- Extract and Indent Content ---
            const restoredContentRaw = fullCodeText.substring(braceStartIndex + 1, braceEndIndex);
            const restoredLines = restoredContentRaw.trim().split('\n');
            const indentBasis = (fullLines[braceStartLineIndex + 1] ?? '').match(/^\s*/)?.[0] ?? (markerIndent + '  ');
            const properlyIndentedContent = restoredLines.map(line => (line.trim() ? indentBasis + line.trimEnd() : '')).join('\n'); // Preserve blank lines but indent others

            // --- Perform Replacement ---
            const prefix = lineStartMarker; // Part before marker
            const suffix = lineEndMarker; // Part after marker
            const finalRestoredBlock = prefix + '{\n' + properlyIndentedContent + '\n' + markerIndent + '}' + suffix; // Reconstruct line(s)

            currentLines.splice(markerLineIndex, 1, finalRestoredBlock); // Replace original marker line
            filesContentMap.set(fileId, currentLines.join('\n'));
            successCount++;
        });

        const updatedFiles = filesToRestore.map(f => filesContentMap.has(f.id) ? { ...f, content: filesContentMap.get(f.id)! } : f);
        onRestorationComplete(updatedFiles, successCount, errorCount);
        setIsRestoring(false);
        if (successCount > 0) setIsModalOpen(false);

    }, [filesToRestore, skippedIssues, onRestorationComplete]);


    if (skippedIssues.length === 0) {
        return null;
    }

    return (
        <>
            <Tooltip text="Восстановить код, отмеченный маркерами пропуска" position="left">
                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={disabled}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FaCodeMerge size={12} /> Восстановить...
                </button>
            </Tooltip>

            <AnimatePresence>
                {isModalOpen && (
                    <RestoreSkippedModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onRestore={performRestoration}
                        issues={skippedIssues}
                        isLoading={isRestoring}
                    />
                )}
            </AnimatePresence>
        </>
    );
};
CodeRestorer.displayName = 'CodeRestorer';