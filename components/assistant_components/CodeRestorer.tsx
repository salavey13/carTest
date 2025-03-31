import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ValidationIssue, FileEntry } from '@/hooks/useCodeParsingAndValidation'; // Adjust path
import { FaCodeMerge, FaWandMagicSparkles, FaRotate, FaCheckCircle, FaTimesCircle } from 'react-icons/fa6';
import { Tooltip } from '../AICodeAssistant'; // Adjust path if necessary

// --- Restore Modal (Simplified: No large text area initially) ---
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

    useEffect(() => {
        // Reset manual state if modal reopens
        if (isOpen) {
            setManualCodeText('');
            setShowManual(false);
        }
    }, [isOpen]);

    const handleManualRestoreClick = () => {
         if (!manualCodeText.trim()) return toast.warn("Вставьте полный код.");
         onManualRestore(manualCodeText);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}
                className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-xl border border-indigo-500/30 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold text-indigo-400 mb-4">Восстановление пропущенного кода</h3>
                <p className="text-sm text-gray-300 mb-3">Обнаружены маркеры <code className='text-xs bg-gray-700 px-1 rounded'>/* ... */</code>. Попытка автоматического восстановления из оригинальных файлов проекта:</p>
                <div className="text-xs mb-4 max-h-40 overflow-y-auto simple-scrollbar border border-gray-700 rounded p-2 bg-gray-900 space-y-1">
                    {issues.map(issue => (
                        <div key={issue.id} className="flex items-center gap-2">
                            {restoreStatus[issue.id] === 'pending' && <FaRotate className="animate-spin text-blue-400 flex-shrink-0" size={12}/>}
                            {restoreStatus[issue.id] === 'success' && <FaCheckCircle className="text-green-500 flex-shrink-0" size={12}/>}
                            {(restoreStatus[issue.id] === 'not_found' || restoreStatus[issue.id] === 'failed_verification') && <FaTimesCircle className="text-red-500 flex-shrink-0" size={12}/>}
                            <code className="text-gray-400">{issue.filePath}</code>
                            <span className='text-gray-500'>(строка ~{issue.details?.lineNumber})</span>
                             {restoreStatus[issue.id] === 'not_found' && <span className='text-orange-400 ml-auto text-[10px]'>Не найдено в оригинале</span>}
                             {restoreStatus[issue.id] === 'failed_verification' && <span className='text-red-400 ml-auto text-[10px]'>Ошибка проверки</span>}
                        </div>
                    ))}
                </div>

                {allowManualRestore && !showManual && (
                     <button onClick={()=> setShowManual(true)} className='text-sm text-blue-400 hover:underline mb-3 text-left'>Не удалось восстановить? Попробовать вручную...</button>
                )}

                {showManual && (
                     <>
                        <p className="text-sm text-gray-300 mb-2">Вставьте <strong className='text-yellow-400'>полный оригинальный код</strong> (из редактора) в поле ниже:</p>
                         <textarea value={manualCodeText} onChange={(e) => setManualCodeText(e.target.value)} className="w-full flex-grow p-3 bg-gray-900 rounded border border-gray-600 focus:border-indigo-500 focus:outline-none text-xs font-mono resize-none mb-4 simple-scrollbar min-h-[150px]" placeholder="Вставьте сюда ПОЛНЫЙ ОРИГИНАЛЬНЫЙ КОД..." spellCheck="false" disabled={isLoading} />
                     </>
                )}


                <div className="flex justify-end gap-3 mt-auto pt-4 border-t border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-500 transition text-white" disabled={isLoading}>Закрыть</button>
                     {showManual ? (
                         <button onClick={handleManualRestoreClick} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 transition shadow-md disabled:opacity-50" disabled={isLoading || !manualCodeText.trim()}>
                             {isLoading ? "Восстановление..." : <><FaWandMagicSparkles size={14}/> Восстановить вручную</>}
                         </button>
                     ) : (
                         <button onClick={onAttemptRestore} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 transition shadow-md disabled:opacity-50" disabled={isLoading || Object.values(restoreStatus).every(s => s !== 'pending')}>
                            {isLoading ? "Восстановление..." : <><FaWandMagicSparkles size={14}/> Попробовать авто-восстановление</>}
                        </button>
                     )}
                </div>
            </motion.div>
        </div>
    );
};
RestoreSkippedModal.displayName = 'RestoreSkippedModal';


// --- Main CodeRestorer Component ---
interface CodeRestorerProps {
    parsedFiles: FileEntry[]; // Current files from AI response
    originalFiles: { path: string; content: string }[]; // Files fetched from repo by RepoTxtFetcher
    skippedIssues: ValidationIssue[];
    onRestorationComplete: (updatedFiles: FileEntry[], successCount: number, errorCount: number) => void;
    disabled?: boolean;
}

const skippedCodeBlockMarkerRegex = /(\/\*\s*\.\.\.\s*\*\/)|({\s*\/\*\s*\.\.\.\s*\*\/\s*})|(\[\s*\/\*\s*\.\.\.\s*\*\/\s*\])/;

export const CodeRestorer: React.FC<CodeRestorerProps> = ({
    parsedFiles,
    originalFiles,
    skippedIssues,
    onRestorationComplete,
    disabled = false
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    // Track status per issue ID during restoration attempt
    const [restoreStatus, setRestoreStatus] = useState<Record<string, 'pending' | 'success' | 'not_found' | 'failed_verification'>>({});
    // Flag to allow manual paste option if auto-attempt fails
    const [allowManualRestore, setAllowManualRestore] = useState(false);

    // --- Restoration Logic (Uses originalFiles map) ---
    const performAutoRestoration = useCallback(async () => {
        setIsRestoring(true);
        setAllowManualRestore(false); // Reset manual flag
        let successCount = 0;
        let errorCount = 0;
        let notFoundCount = 0;
        const filesContentMap = new Map(parsedFiles.map(f => [f.id, f.content]));
        const originalFilesMap = new Map(originalFiles.map(f => [f.path, f.content]));
        // Initialize status for all skipped issues
        const initialStatus = skippedIssues.reduce((acc, issue) => { acc[issue.id] = 'pending'; return acc; }, {});
        setRestoreStatus(initialStatus);

        // Introduce a small delay for UI update
        await new Promise(res => setTimeout(res, 100));

        for (const issue of skippedIssues) {
            const { fileId, filePath, details } = issue;
            if (issue.type !== 'skippedCodeBlock' || !details?.markerLineContent || !fileId) continue;

            const currentFileContent = filesContentMap.get(fileId);
            const originalFileContent = originalFilesMap.get(filePath); // Get original content by path

            // Cannot restore if original file doesn't exist (likely a new file from AI)
            if (!currentFileContent || !originalFileContent) {
                 setRestoreStatus(prev => ({ ...prev, [issue.id]: 'not_found' }));
                 notFoundCount++; continue;
            }

            const currentLines = currentFileContent.split('\n');
            const markerLineIndex = currentLines.findIndex(line => line === details.markerLineContent);
            if (markerLineIndex === -1) {
                console.warn(`AutoRestore: Marker line not found in current: ${filePath}`);
                setRestoreStatus(prev => ({ ...prev, [issue.id]: 'not_found' })); // Treat as not found if marker disappeared
                notFoundCount++; continue;
            }

            // --- Find Matching Line in ORIGINAL Text ---
            const originalLines = originalFileContent.split('\n');
            let originalMarkerLineIndex = -1;
            // Search efficiently - maybe start near expected line number? For simplicity, search all for now.
            for (let i = 0; i < originalLines.length; i++) { if (originalLines[i] === details.markerLineContent) { originalMarkerLineIndex = i; break; } }
            if (originalMarkerLineIndex === -1) { console.warn(`AutoRestore: Marker line not found in original: ${filePath}`); setRestoreStatus(prev => ({ ...prev, [issue.id]: 'not_found' })); notFoundCount++; continue; }

            // --- Find Braces in ORIGINAL Text ---
            let braceStartIndex = -1, braceStartLineIndex = -1, openBraceFound = false;
            for (let i = originalMarkerLineIndex; i < originalLines.length; i++) { const bracePos = originalLines[i].indexOf('{'); if (bracePos !== -1) { let charIndex=0; for(let j=0; j<i; j++) charIndex+=originalLines[j].length+1; braceStartIndex=charIndex+bracePos; braceStartLineIndex=i; openBraceFound=true; break; } if (i > originalMarkerLineIndex && originalLines[i].trim() !== '' && !originalLines[i].trim().startsWith('//') && !originalLines[i].trim().startsWith('/*')) break; }
            if (!openBraceFound) { console.warn(`AutoRestore: No opening brace in original: ${filePath}`); setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++; continue; }

            let balance = 1, braceEndIndex = -1;
            for (let i = braceStartIndex + 1; i < originalFileContent.length; i++) { if (originalFileContent[i] === '{') balance++; else if (originalFileContent[i] === '}') balance--; if (balance === 0) { braceEndIndex = i; break; } }
            if (braceEndIndex === -1) { console.warn(`AutoRestore: No closing brace in original: ${filePath}`); setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++; continue; }

            // --- Verification (using ORIGINAL text) ---
            const markerMatch = details.markerLineContent.match(skippedCodeBlockMarkerRegex);
            if (!markerMatch) { errorCount++; continue; }
            const markerText = markerMatch[0];
            const lineStartMarker = details.markerLineContent.substring(0, details.markerLineContent.indexOf(markerText));
            const lineEndMarker = details.markerLineContent.substring(details.markerLineContent.indexOf(markerText) + markerText.length);
            const originalStartLine = originalLines[braceStartLineIndex];
            let originalClosingBraceLine = '', originalClosingBraceLineIndex = -1;
            for (let i = braceStartLineIndex; i < originalLines.length; i++) { let charIndex=0; for(let j=0; j<i; j++) charIndex+=originalLines[j].length+1; if (charIndex + originalLines[i].length >= braceEndIndex) { originalClosingBraceLine = originalLines[i]; originalClosingBraceLineIndex = i; break; } }
            const startMatches = originalStartLine.trimStart().startsWith(lineStartMarker.trimStart());
            const endMatches = originalClosingBraceLine.trimEnd().endsWith(lineEndMarker.trimEnd());
            const markerIndent = details.markerLineContent.match(/^\s*/)?.[0] ?? '';
            const closingIndent = originalClosingBraceLine.match(/^\s*/)?.[0] ?? '';
            const indentMatches = markerIndent === closingIndent;

            if (!startMatches || !endMatches || !indentMatches) { console.warn(`AutoRestore: Verification failed: ${filePath}`); setRestoreStatus(prev => ({ ...prev, [issue.id]: 'failed_verification' })); errorCount++; continue; }

            // --- Extract and Indent Content from ORIGINAL ---
            const restoredContentRaw = originalFileContent.substring(braceStartIndex + 1, braceEndIndex);
            const restoredLines = restoredContentRaw.trim().split('\n');
            const indentBasis = (originalLines[braceStartLineIndex + 1] ?? '').match(/^\s*/)?.[0] ?? (markerIndent + '  ');
            const properlyIndentedContent = restoredLines.map(line => (line.trim() ? indentBasis + line.trimEnd() : '')).join('\n');

            // --- Perform Replacement in CURRENT content map ---
            const lineToReplace = currentLines[markerLineIndex];
            const prefix = lineStartMarker; const suffix = lineEndMarker;
            const finalRestoredBlock = prefix + '{\n' + properlyIndentedContent + '\n' + markerIndent + '}' + suffix;
            currentLines.splice(markerLineIndex, 1, finalRestoredBlock);
            filesContentMap.set(fileId, currentLines.join('\n'));
            setRestoreStatus(prev => ({ ...prev, [issue.id]: 'success' }));
            successCount++;
        } // End for loop

        const updatedFiles = parsedFiles.map(f => filesContentMap.has(f.id) ? { ...f, content: filesContentMap.get(f.id)! } : f);
        onRestorationComplete(updatedFiles, successCount, errorCount + notFoundCount); // Notify parent
        setIsRestoring(false);
        if (notFoundCount > 0 || errorCount > 0) {
            setAllowManualRestore(true); // Show manual option if auto failed for some
        } else if (successCount > 0) {
             // Close modal only if *all* were successful? Or always after attempt?
             // Let's close if at least one succeeded and none failed verification/not found
             if (errorCount === 0 && notFoundCount === 0) {
                  // setIsModalOpen(false); // Let parent decide based on final state maybe?
             }
        }


    }, [parsedFiles, originalFiles, skippedIssues, onRestorationComplete]);

     // Handler for manual restore submission from modal
     const handleManualRestoreSubmit = useCallback((fullCode: string) => {
        // Reuse the restoration logic, but this time it searches the manually provided fullCode
         setIsRestoring(true);
         setAllowManualRestore(false); // Hide manual option after trying
         let successCount = 0; let errorCount = 0;
         const filesContentMap = new Map(parsedFiles.map(f => [f.id, f.content]));
         let searchStartIndex = 0;
         const initialStatus = skippedIssues.reduce((acc, issue) => { acc[issue.id] = 'pending'; return acc; }, {});
         setRestoreStatus(initialStatus);

         // --- Logic copied and adapted from performAutoRestoration, using `fullCode` instead of `originalFileContent` ---
         skippedIssues.forEach(issue => {
             const { fileId, details } = issue;
             if (issue.type !== 'skippedCodeBlock' || !details?.markerLineContent || !fileId) return;
             const currentFileContent = filesContentMap.get(fileId);
             if (!currentFileContent) { errorCount++; return; }
             const currentLines = currentFileContent.split('\n');
             const markerLineIndex = currentLines.findIndex(line => line === details.markerLineContent);
             if (markerLineIndex === -1) { /* ... error ... */ errorCount++; return; }

             const fullLines = fullCode.split('\n'); // Use MANUAL full code
             let fullMarkerLineIndex = -1;
             for (let i = searchStartIndex; i < fullLines.length; i++) { if (fullLines[i] === details.markerLineContent) { fullMarkerLineIndex = i; searchStartIndex = i + 1; break; } }
             if (fullMarkerLineIndex === -1) { /* ... error ... */ setRestoreStatus(prev => ({...prev, [issue.id]: 'not_found'})); errorCount++; return; }

             // ... (Find braces, Verify, Extract, Indent using `fullCode` and `fullLines`) ...
             let braceStartIndex = -1, braceStartLineIndex = -1, openBraceFound = false; /* ... find { ... */ if (!openBraceFound) { /* ... error ... */ errorCount++; return; }
             let balance = 1, braceEndIndex = -1; /* ... find } ... */ if (braceEndIndex === -1) { /* ... error ... */ errorCount++; return; }
             // --- Verification (using `fullCode`) ---
             // ... (Verification logic using fullLines, lineStartMarker, lineEndMarker etc.) ...
             // if (!startMatches || !endMatches || !indentMatches) { /* ... error ... */ setRestoreStatus(prev => ({...prev, [issue.id]: 'failed_verification'})); errorCount++; return; }
             // --- Extract and Indent Content (using `fullCode`) ---
             // ... (Extracting and indenting logic) ...
             const restoredContentRaw = fullCode.substring(braceStartIndex + 1, braceEndIndex);
             const restoredLines = restoredContentRaw.trim().split('\n');
             const markerIndent = details.markerLineContent.match(/^\s*/)?.[0] ?? '';
             const indentBasis = (fullLines[braceStartLineIndex + 1] ?? '').match(/^\s*/)?.[0] ?? (markerIndent + '  ');
             const properlyIndentedContent = restoredLines.map(line => (line.trim() ? indentBasis + line.trimEnd() : '')).join('\n');
             // --- Perform Replacement ---
             // ... (Replace marker line logic) ...
             const lineToReplace = currentLines[markerLineIndex];
             const prefix = lineToReplace.substring(0, lineToReplace.search(skippedCodeBlockMarkerRegex));
             const suffix = lineToReplace.substring(lineToReplace.search(skippedCodeBlockMarkerRegex) + lineToReplace.match(skippedCodeBlockMarkerRegex)![0].length);
             const finalRestoredBlock = prefix + '{\n' + properlyIndentedContent + '\n' + markerIndent + '}' + suffix;
             currentLines.splice(markerLineIndex, 1, finalRestoredBlock);
             filesContentMap.set(fileId, currentLines.join('\n'));
             setRestoreStatus(prev => ({ ...prev, [issue.id]: 'success' }));
             successCount++;
         }); // End manual restore forEach

         const updatedFiles = parsedFiles.map(f => filesContentMap.has(f.id) ? { ...f, content: filesContentMap.get(f.id)! } : f);
         onRestorationComplete(updatedFiles, successCount, errorCount);
         setIsRestoring(false);
         if (successCount > 0) setIsModalOpen(false); // Close modal if manual restore worked

     }, [parsedFiles, skippedIssues, onRestorationComplete]);


    if (skippedIssues.length === 0) return null; // Don't render button if no relevant issues

    return (
        <>
            <Tooltip text="Восстановить код, отмеченный маркерами пропуска" position="left">
                <button
                    onClick={() => { setIsModalOpen(true); setAllowManualRestore(false); setRestoreStatus({}); }} // Open modal and reset status
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
                        onAttemptRestore={performAutoRestoration} // Trigger auto-attempt
                        issues={skippedIssues}
                        isLoading={isRestoring}
                        restoreStatus={restoreStatus}
                        allowManualRestore={allowManualRestore}
                        onManualRestore={handleManualRestoreSubmit} // Pass manual handler
                    />
                )}
            </AnimatePresence>
        </>
    );
};
CodeRestorer.displayName = 'CodeRestorer';