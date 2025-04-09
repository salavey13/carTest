// /components/assistant_components/CodeRestorer.tsx
"use client";

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ValidationIssue, FileEntry } from '@/hooks/useCodeParsingAndValidation'; // Adjust path
import { FaCodeMerge, FaWandMagicSparkles, FaRotate, FaPoo, FaTimes } from 'react-icons/fa6'; // Added FaTimes
import { Tooltip } from '../AICodeAssistant'; // Adjust path if necessary

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
                         <FaTimes />
                     </button>
                 </div>
                <p className="text-sm text-gray-300 mb-3">Обнаружены маркеры <code className='text-xs bg-gray-700 px-1 rounded'>/* .. */</code> или <code className='text-xs bg-gray-700 px-1 rounded'>/* ... */</code>. Попытка автоматического восстановления из оригинальных файлов проекта:</p>
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

// UPDATED Regex to match 2 or 3 dots
const skippedCodeBlockMarkerRegex = /(\/\*\s*\.{2,3}\s*\*\/)|({\s*\/\*\s*\.{2,3}\s*\*\/\s*})|(\[\s*\/\*\s*\.{2,3}\s*\*\/\s*\])/; // Find the marker

export const CodeRestorer: React.FC<CodeRestorerProps> = ({
    parsedFiles, originalFiles, skippedIssues, onRestorationComplete, disabled = false
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState<Record<string, 'pending' | 'success' | 'not_found' | 'failed_verification'>>({});
    const [allowManualRestore, setAllowManualRestore] = useState(false);

    // --- Restoration Logic ---
    const performRestorationLogic = useCallback((fullCodeSource: Map<string, string> | string, isManualAttempt: boolean = false) => {
        setIsRestoring(true); // Set loading at the beginning
        let successCount = 0; let errorCount = 0; let notFoundCount = 0;
        const filesContentMap = new Map(parsedFiles.map(f => [f.id, f.content]));
        let searchStartIndex = 0; // Keep track for non-manual search
        const initialStatus = skippedIssues.reduce((acc, issue) => { acc[issue.id] = 'pending'; return acc; }, {});
        setRestoreStatus(initialStatus); // Reset status on new attempt

        // --- Helper Functions ---
        const getFullCodeLines = (filePath: string): string[] | null => {
             if (typeof fullCodeSource === 'string') return fullCodeSource.split('\n');
             const content = fullCodeSource.get(filePath);
             return content ? content.split('\n') : null;
        };
        const getFullCodeTextForSearch = (filePath: string): string | null => {
             if (typeof fullCodeSource === 'string') return fullCodeSource;
             return fullCodeSource.get(filePath) ?? null;
        }
        // --- End Helpers ---

        // --- Process each issue ---
        skippedIssues.forEach(issue => {
            const { fileId, filePath, details } = issue;
            // Basic checks
            if (issue.type !== 'skippedCodeBlock' || !details?.markerLineContent || !fileId) {
                console.warn(`Restore: Invalid issue data for ${filePath || 'unknown file'}`);
                setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++;
                return;
            }

            const currentFileContent = filesContentMap.get(fileId);
            const fullLines = getFullCodeLines(filePath);
            const fullCodeText = getFullCodeTextForSearch(filePath); // Get full text for character indexing

            if (!currentFileContent || !fullLines || !fullCodeText) {
                console.warn(`Restore: Source not found for ${filePath}`);
                setRestoreStatus(prev => ({ ...prev, [issue.id]: 'not_found' })); notFoundCount++;
                return;
            }

            const currentLines = currentFileContent.split('\n');
            const markerLineIndex = currentLines.findIndex(line => line === details.markerLineContent);
            if (markerLineIndex === -1) {
                 console.warn(`Restore: Marker line not found in current content: ${filePath} (Line: "${details.markerLineContent}")`);
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'not_found' })); notFoundCount++;
                 return;
            }

            // Find matching marker line in the full original/manual text
            let fullMarkerLineIndex = -1;
            const searchStart = isManualAttempt ? 0 : searchStartIndex; // Where to start searching in original
            for (let i = searchStart; i < fullLines.length; i++) {
                if (fullLines[i] === details.markerLineContent) {
                    fullMarkerLineIndex = i;
                    if (!isManualAttempt) searchStartIndex = i + 1; // Advance search start for next issue in same file (auto mode)
                    break;
                }
            }
             if (fullMarkerLineIndex === -1) {
                 console.warn(`Restore: Marker line not found in original/manual source: ${filePath} (Line: "${details.markerLineContent}")`);
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'not_found' })); notFoundCount++;
                 return;
             }

            // Find the opening brace '{' following the marker line in the original
            let braceStartIndex = -1, // Character index in fullCodeText
                braceStartLineIndex = -1, // Line index in fullLines
                openBraceFound = false;
            for (let i = fullMarkerLineIndex; i < fullLines.length; i++) {
                 const bracePos = fullLines[i].indexOf('{');
                 if (bracePos !== -1) {
                     // Calculate character index
                     let charIndex = 0;
                     for(let j=0; j<i; j++) charIndex += fullLines[j].length + 1; // +1 for newline
                     braceStartIndex = charIndex + bracePos;
                     braceStartLineIndex = i;
                     openBraceFound = true;
                     break;
                 }
                 // Stop searching if we hit non-empty, non-comment line before finding '{'
                 if (i > fullMarkerLineIndex && fullLines[i].trim() !== '' && !fullLines[i].trim().startsWith('//') && !fullLines[i].trim().startsWith('/*')) {
                     break;
                 }
            }
            if (!openBraceFound) {
                 console.warn(`Restore: Could not find opening brace '{' after marker in original: ${filePath}`);
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++;
                 return;
            }

            // Find the matching closing brace '}' starting from AFTER the opening brace
            let balance = 1, braceEndIndex = -1; // Character index
            for (let i = braceStartIndex + 1; i < fullCodeText.length; i++) {
                 // Basic check, ignoring braces within comments/strings for simplicity (might fail complex cases)
                 if (fullCodeText[i] === '{') balance++;
                 else if (fullCodeText[i] === '}') balance--;

                 if (balance === 0) {
                     braceEndIndex = i;
                     break;
                 }
            }
            if (braceEndIndex === -1) {
                 console.warn(`Restore: Could not find matching closing brace '}' in original: ${filePath}`);
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++;
                 return;
            }

            // --- Verification Step ---
            const markerMatch = details.markerLineContent.match(skippedCodeBlockMarkerRegex); // Use updated regex
            if (!markerMatch) {
                 console.error(`Restore: Regex failed to match marker line itself? "${details.markerLineContent}"`);
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++;
                 return;
            }
            const markerText = markerMatch[0]; // The /* .. */ part
            const lineStartMarker = details.markerLineContent.substring(0, details.markerLineContent.indexOf(markerText));
            const lineEndMarker = details.markerLineContent.substring(details.markerLineContent.indexOf(markerText) + markerText.length);

            // Find the line containing the closing brace in the original
            let closingBraceLine = '', closingBraceLineIndex = -1;
            let currentLength = 0;
            for(let i = 0; i < fullLines.length; i++) {
                const lineEndPos = currentLength + fullLines[i].length;
                if(braceEndIndex >= currentLength && braceEndIndex <= lineEndPos) {
                    closingBraceLine = fullLines[i];
                    closingBraceLineIndex = i;
                    break;
                }
                currentLength += fullLines[i].length + 1; // +1 for newline
            }

            if (closingBraceLineIndex === -1) {
                 console.warn(`Restore: Could not find the line containing the closing brace in original: ${filePath}`);
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++;
                 return;
            }

            // Compare prefix/suffix, ignoring potential leading/trailing whitespace difference
            const startMatches = (fullLines[braceStartLineIndex] ?? '').trimStart().startsWith(lineStartMarker.trimStart());
            const endMatches = closingBraceLine.trimEnd().endsWith(lineEndMarker.trimEnd());
            // Compare indentation of marker line and closing brace line
            const markerIndent = details.markerLineContent.match(/^\s*/)?.[0] ?? '';
            const closingIndent = closingBraceLine.match(/^\s*/)?.[0] ?? '';
            const indentMatches = markerIndent === closingIndent;

            if (!startMatches || !endMatches || !indentMatches) {
                 console.warn(`Restore: Verification failed (prefix/suffix/indent mismatch) for ${filePath}\n Start: "${(fullLines[braceStartLineIndex] ?? '').trimStart()}" vs "${lineStartMarker.trimStart()}" (${startMatches})\n End: "${closingBraceLine.trimEnd()}" vs "${lineEndMarker.trimEnd()}" (${endMatches})\n Indent: "${closingIndent}" vs "${markerIndent}" (${indentMatches})`);
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++;
                 return;
            }
            // --- End Verification ---


            // Extract content between braces, trim it, split into lines
            const restoredContentRaw = fullCodeText.substring(braceStartIndex + 1, braceEndIndex);
            const restoredLines = restoredContentRaw.trim().split('\n');

            // Determine indentation for restored lines (use line after opening brace or marker indent + 2 spaces)
            const indentBasis = (fullLines[braceStartLineIndex + 1] ?? '').match(/^\s*/)?.[0] ?? (markerIndent + '  ');

            // Re-indent each non-empty line
            const properlyIndentedContent = restoredLines
                 .map(line => (line.trim() ? indentBasis + line.trimEnd() : '')) // Indent non-empty lines, keep empty lines empty
                 .join('\n');

            // Construct the final block to replace the marker line
            const lineToReplace = currentLines[markerLineIndex]; // Keep for reference, though not strictly needed now
            const prefix = lineStartMarker;
            const suffix = lineEndMarker;
            // Ensure the braces are on lines with correct indentation
            const finalRestoredBlock = prefix + '{\n' + // Opening brace with marker line's prefix
                                       properlyIndentedContent + '\n' + // Indented content
                                       markerIndent + '}' + // Closing brace with marker line's indent
                                       suffix; // Suffix from marker line

            // Replace the marker line with the restored block
            currentLines.splice(markerLineIndex, 1, finalRestoredBlock);
            filesContentMap.set(fileId, currentLines.join('\n')); // Update the content in our map

            setRestoreStatus(prev => ({ ...prev, [issue.id]: 'success' })); // Mark as success
            successCount++;
        });
        // --- End processing issues ---


        // Prepare final results
        const updatedFiles = parsedFiles.map(f => filesContentMap.has(f.id) ? { ...f, content: filesContentMap.get(f.id)! } : f);
        onRestorationComplete(updatedFiles, successCount, errorCount + notFoundCount); // Call parent callback
        setIsRestoring(false); // Stop loading indicator

        // Decide whether to keep modal open based on results
        const totalFailures = errorCount + notFoundCount;
        if (isManualAttempt && successCount > 0 && totalFailures === 0) {
            setIsModalOpen(false); // Close if manual attempt succeeded fully
            toast.success("Код успешно восстановлен вручную!");
        } else if (!isManualAttempt && totalFailures > 0) {
             setAllowManualRestore(true); // Allow manual if auto failed some/all
             if (successCount > 0) toast.warning(`Авто-восстановление: ${successCount} успех, ${totalFailures} ошибок. Попробуйте вручную.`);
             else toast.error(`Авто-восстановление не удалось (${totalFailures} ошибок). Попробуйте вручную.`);
        } else if (!isManualAttempt && successCount > 0 && totalFailures === 0) {
             setIsModalOpen(false); // Close if auto succeeded for all
             toast.success("Код успешно восстановлен автоматически!");
        } else if (isManualAttempt && totalFailures > 0) {
             // Keep modal open if manual attempt failed
             toast.error(`Ручное восстановление не удалось (${totalFailures} ошибок). Проверьте вставленный код.`);
        }
        // If auto attempt had 0 success and 0 failures (e.g., issues invalid?), keep open? Or close? Let's keep open.

    }, [parsedFiles, skippedIssues, onRestorationComplete]); // Removed originalFiles dependency here, passed via Map

    // Trigger for Auto-Attempt
    const handleAutoAttempt = useCallback(async () => {
        if (originalFiles.length === 0) {
            return toast.error("Оригинальные файлы не загружены для авто-восстановления.");
        }
        setIsRestoring(true); // Set loading
        setAllowManualRestore(false); // Reset manual option
        // Create map ONCE before calling logic
        const originalFilesMap = new Map(originalFiles.map(f => [f.path, f.content]));
        performRestorationLogic(originalFilesMap, false);
    }, [originalFiles, performRestorationLogic]); // Pass originalFiles map

    // Trigger for Manual Attempt
    const handleManualAttempt = useCallback(async (manualCode: string) => {
         setIsRestoring(true); // Set loading
         performRestorationLogic(manualCode, true);
    }, [performRestorationLogic]); // Pass manual code string


    // Don't render button if no issues
    if (skippedIssues.length === 0) return null;

    return (
        <>
            <Tooltip text="Восстановить код, отмеченный маркерами пропуска /* .. */" position="left">
                <button
                    onClick={() => { setIsModalOpen(true); setAllowManualRestore(false); setRestoreStatus({}); }}
                    disabled={disabled}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FaCodeMerge size={12} /> Восстановить ({skippedIssues.length})...
                </button>
            </Tooltip>

            <AnimatePresence>
                {isModalOpen && (
                    <RestoreSkippedModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onAttemptRestore={handleAutoAttempt} // Trigger auto-attempt first
                        issues={skippedIssues}
                        isLoading={isRestoring}
                        restoreStatus={restoreStatus}
                        allowManualRestore={allowManualRestore}
                        onManualRestore={handleManualAttempt} // Pass manual handler
                    />
                )}
            </AnimatePresence>
        </>
    );
};
CodeRestorer.displayName = 'CodeRestorer';