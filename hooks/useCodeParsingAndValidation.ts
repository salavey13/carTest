import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// --- Interfaces ---
export interface FileEntry { id: string; path: string; content: string; extension: string; }
export interface ValidationIssue {
    id: string; fileId: string; filePath: string;
    // Type 'skippedCodeBlock' covers /*...*/ and {...} markers
    // Type 'skippedComment' covers // ... markers
    type: 'icon' | 'useClient' | 'import' | 'skippedCodeBlock' | 'skippedComment';
    message: string;
    details?: any; // For skippedCodeBlock: { markerLineContent: string, lineNumber: number }
                   // For skippedComment: { lineNumber: number }
    fixable: boolean;
    restorable?: boolean; // Added for skippedCodeBlock
}
export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

// --- Constants ---
const iconReplacements: Record<string, string> = {
    'FaSync': 'FaRotate',
    'FaTools': 'FaScrewdriverWrench',
    'FaCheckSquare': 'FaSquareCheck',
    'FaTelegramPlane': 'FaPaperPlane',
    'FaEllipsisV': 'FaEllipsisVertical',
    'FaInfoCircle': 'FaCircleInfo', // Map to fa6 version
    'FaTrashAlt': 'FaTrashCan',     // Map to fa6 solid version
    'FaCheckCircle': 'FaCircleCheck',
    'FaTimesCircle': 'FaCircleTimes',
};
const badIconImportSource = 'react-icons/fa';

const importChecks = [
    { name: 'motion', usageRegex: /<motion\./, importRegex: /import .* from ['"]framer-motion['"]/, importStatement: `import { motion } from "framer-motion";` },
    { name: 'clsx', usageRegex: /clsx\(/, importRegex: /import clsx from ['"]clsx['"]/, importStatement: `import clsx from "clsx";` },
];

// Regex to find /* ... */ or { /* ... */ } or [ /* ... */ ] - capturing the marker itself
const skippedCodeBlockMarkerRegex = /(\/\*\s*\.\.\.\s*\*\/)|({\s*\/\*\s*\.\.\.\s*\*\/\s*})|(\[\s*\/\*\s*\.\.\.\s*\*\/\s*\])/;
// Regex for single-line comment marker // ...
const skippedCommentMarkerRegex = /\/\/\s*\.\.\./;

const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

// --- Custom Hook ---
export function useCodeParsingAndValidation() {
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
    const [rawDescription, setRawDescription] = useState<string>("");
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    // --- Parsing Logic ---
    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string } => {
        const files: FileEntry[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$)|(?:^\s*))\n*^```(\w+)?\n([\s\S]*?)\n^```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
             if (match.index > lastIndex) {
                 descriptionParts.push(text.substring(lastIndex, match.index).trim());
             }
             lastIndex = codeBlockRegex.lastIndex; // Update last index

             let path = (match[4] || match[1] || `unnamed-${files.length + 1}`).trim();
             let content = match[3].trim(); // Code content
             let extension = path.split('.').pop()?.toLowerCase() || 'txt'; // File extension

             // Attempt to find path in the first line if initially unnamed
             if (path.startsWith('unnamed-')) {
                 const lines = content.split('\n');
                 const potentialPathLine = lines[0]?.trim();
                 if(potentialPathLine){
                    const pathCommentMatch = potentialPathLine.match(/^(?:\/\/|\/\*|--|#)\s*([\w\-\/\.]+?\.\w+)/); // Check for commented path
                    const plainPathMatch = potentialPathLine.match(/^[\w\-\/\.]+?\.\w+$/) && lines.length > 1; // Check for plain path
                    if (pathCommentMatch) { path = pathCommentMatch[1].trim(); content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop()?.toLowerCase() || 'txt';}
                    else if (plainPathMatch) { path = potentialPathLine; content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop()?.toLowerCase() || 'txt';}
                 }
             }
             // Clean up leading slashes from path
             path = path.replace(/^[\/\\]+/, '');
             files.push({ id: generateId(), path, content, extension });
        }
        // Capture any remaining text after the last code block
        if (lastIndex < text.length) {
            descriptionParts.push(text.substring(lastIndex).trim());
        }
        // Join description parts, filtering out empty strings
        const description = descriptionParts.filter(Boolean).join('\n\n');
        return { files, description };
    }, []); // Empty dependency array as logic is self-contained

    // --- Validation Logic ---
    const validateParsedFiles = useCallback(async (filesToValidate: FileEntry[]): Promise<ValidationIssue[]> => {
        setValidationStatus('validating');
        const issues: ValidationIssue[] = [];
        // Regex to detect common React client-side hooks
        const clientHookPatterns = /(useState|useEffect|useRef|useContext|useReducer|useCallback|useMemo|useLayoutEffect|useImperativeHandle|useDebugValue)\s*\(/;

        for (const file of filesToValidate) {
            const lines = file.content.split('\n');

            // 1. Icon Check
            const iconImportRegex = /import\s+{([^}]*)}\s+from\s+['"](react-icons\/fa)['"]/g;
            let importMatch;
            while ((importMatch = iconImportRegex.exec(file.content)) !== null) {
                const importedIcons = importMatch[1].split(',').map(i => i.trim().split(/\s+as\s+/)[0]).filter(Boolean);
                importedIcons.forEach(iconName => {
                     const replacement = iconReplacements[iconName];
                    // Basic check for actual usage of the imported icon as a JSX tag
                    const usageRegex = new RegExp(`<${iconName}(\\s|\\/?>)`); // Check for <IconName or <IconName/> or <IconName >
                    // Simple check: if line includes "for science" comment, don't flag it.
                    const linesWithIcon = file.content.split('\n').filter(line => usageRegex.test(line));
                    const shouldWarn = linesWithIcon.some(line => !line.includes('// for science')); // Warn if *any* usage isn't commented

                    if (usageRegex.test(file.content) && shouldWarn) {
                         issues.push({
                            id: generateId(), fileId: file.id, filePath: file.path, type: 'icon',
                            message: `Иконка ${iconName} из 'react-icons/fa'. ${replacement ? `Заменить на ${replacement}?` : 'Аналог?'}`,
                            details: { badIcon: iconName, goodIcon: replacement },
                            fixable: !!replacement // Only fixable if a direct replacement is known
                        });
                    }
                });
            }

            // 2. "use client" Check
            if (/\.(tsx|jsx)$/.test(file.path)) { // Check only TSX/JSX files
                // Find the first non-empty, non-comment line
                const firstRealLine = lines.find(line => line.trim() !== '');
                const hasUseClient = firstRealLine?.trim() === '"use client";' || firstRealLine?.trim() === "'use client';";
                // If client hooks are used but "use client" is missing
                if (!hasUseClient && clientHookPatterns.test(file.content)) {
                    const hookMatch = clientHookPatterns.exec(file.content)?.[1] ?? 'hook';
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'useClient',
                        message: `Клиентский хук (${hookMatch}) без "use client".`,
                        details: null,
                        fixable: true // This can be reliably fixed
                    });
                }
            }

            // 3. Skipped Code Block Check (/* ... */, { /* ... */ }, [ /* ... */ ])
            for (let i = 0; i < lines.length; i++) {
                if (skippedCodeBlockMarkerRegex.test(lines[i])) { // Match marker within a line
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedCodeBlock',
                        message: `Пропущен блок кода (строка ${i + 1}). Можно попытаться восстановить.`,
                        details: { markerLineContent: lines[i], lineNumber: i + 1 }, // Store the whole line content
                        fixable: false, // Requires manual intervention
                        restorable: true // Mark as potentially restorable
                    });
                }
            }

            // 4. Skipped Comment Check (// ...) - Unfixable for now
            for (let i = 0; i < lines.length; i++) {
                 if (skippedCommentMarkerRegex.test(lines[i])) {
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedComment',
                        message: `Пропущен комментарий '// ...' (строка ${i + 1}).`,
                        details: { lineNumber: i + 1 },
                        fixable: false,
                        restorable: false // Cannot restore this type
                    });
                 }
            }

            // 5. Import Checks
             if (/\.(tsx|jsx)$/.test(file.path)) { // Check only TSX/JSX files
                importChecks.forEach(check => {
                    // Check if the item is used BUT not imported
                    if (check.usageRegex.test(file.content) && !check.importRegex.test(file.content)) {
                         issues.push({
                             id: generateId(), fileId: file.id, filePath: file.path, type: 'import',
                             message: `Используется '${check.name}', но импорт отсутствует.`,
                             details: { name: check.name, importStatement: check.importStatement },
                             fixable: true // Can be fixed by adding import
                         });
                    }
                });
             }
        }

        // Update state with found issues
        setValidationIssues(issues);

        // Determine final validation status based on issues found
        if (issues.length > 0) {
             // Error if unfixable AND unrestorable issues exist, Warning otherwise
             const hasHardErrors = issues.some(issue => !issue.fixable && !issue.restorable);
             setValidationStatus(hasHardErrors ? 'error' : 'warning');
        } else {
            setValidationStatus('success'); // Success if no issues
        }
        return issues; // Return the list of issues
    }, []); // Empty dependency array

    // --- Main Parsing and Validation Trigger ---
    const parseAndValidateResponse = useCallback(async (response: string) => {
        setIsParsing(true); setValidationStatus('idle'); setValidationIssues([]); setParsedFiles([]); setRawDescription("");
        if (!response.trim()) { toast.info("Поле ответа пусто."); setIsParsing(false); return { files: [], description: "", issues: [] }; }

        const { files, description } = parseFilesFromText(response);
        setParsedFiles(files); setRawDescription(description);

        let finalIssues: ValidationIssue[] = [];
        if (files.length > 0) {
            toast.info(`${files.length} файлов найдено. Запуск проверки...`, { duration: 1500 });
            finalIssues = await validateParsedFiles(files); // Wait for validation

            // Use the status set by validateParsedFiles
            const currentStatus = validationStatus === 'validating' ? // Check if still validating (shouldn't be if await finished)
                (finalIssues.length > 0 ? (finalIssues.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success')
                : (finalIssues.length > 0 ? (finalIssues.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success'); // Recalculate based on final issues

             if (currentStatus === 'success') toast.success("Проверка кода завершена успешно!");
             else if (currentStatus === 'warning' || currentStatus === 'error') toast.warning(`Проверка завершена. Найдено проблем: ${finalIssues.length}.`);

        } else {
            toast.info("В ответе не найдено файлов кода для разбора.");
            setValidationStatus('idle'); // No files, so validation is idle
        }
        setIsParsing(false);
        return { files, description, issues: finalIssues };
    }, [parseFilesFromText, validateParsedFiles, validationStatus]); // Dependency on validationStatus might cause loops if not careful, removed for now

    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
        let changesMadeCount = 0; const fixedMessages: string[] = [];
        // Filter only issues fixable by *this* function (icon, useClient, import)
        const fixableIssues = issuesToFix.filter(issue => issue.fixable && issue.type !== 'skippedCodeBlock');

        const updatedFiles = filesToFix.map(file => {
            let currentContent = file.content; let fileChanged = false;
            // Find fixable issues relevant to the current file
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);
            if (fileIssues.length === 0) return file; // No fixes needed for this file

            fileIssues.forEach(issue => {
                let originalContent = currentContent; // Store content before modification
                // Fix: Replace deprecated icon usage
                if (issue.type === 'icon' && issue.details?.badIcon && issue.details?.goodIcon) {
                    const bad = issue.details.badIcon; const good = issue.details.goodIcon;
                    const usageOpenRegex = new RegExp(`<${bad}(\\s|\\/?>)`, 'g');
                    // Only replace if line does NOT contain "for science" comment
                    const lines = currentContent.split('\n');
                    let changed = false;
                    const newLines = lines.map(line => {
                        if (usageOpenRegex.test(line) && !line.includes('// for science')) {
                             changed = true;
                             let newLine = line.replace(usageOpenRegex, `<${good}$1`);
                             // Replace closing tags if they exist (less common for icons)
                             newLine = newLine.replaceAll(`</${bad}>`, `</${good}>`);
                             return newLine;
                        }
                        return line;
                    });
                    if (changed) {
                        currentContent = newLines.join('\n');
                        // Add TODO only if import exists (less intrusive)
                        const importRegex = new RegExp(`(import\\s+{[^}]*?)${bad}([^}]*?}\\s+from\\s+['"]${badIconImportSource}['"])`);
                        if (importRegex.test(currentContent)) {
                             // Comment out or add TODO - modifying import directly is risky
                             currentContent = currentContent.replace(importRegex, `$1${bad}$2\n// TODO: Verify import for ${good}, consider 'react-icons/fa6'`);
                        }
                        fixedMessages.push(`✅ Иконка: ${bad} -> ${good} в ${file.path}`);
                        fileChanged = true;
                    }

                // Fix: Add "use client" directive
                } else if (issue.type === 'useClient') {
                    const lines = currentContent.split('\n');
                    const firstRealLineIndex = lines.findIndex(l=>l.trim()!=='');
                    const needsUseClient = firstRealLineIndex === -1 || (lines[firstRealLineIndex]?.trim() !== '"use client";' && lines[firstRealLineIndex]?.trim() !== "'use client';");
                    if (needsUseClient) {
                        // Find the best place to insert (after comments, before first import/code)
                        let insertIndex = 0;
                        for(let i=0; i<lines.length; i++){
                            const tl=lines[i].trim();
                            if(tl!==''&&!tl.startsWith('//')&&!tl.startsWith('/*')){
                                insertIndex=i;
                                break;
                            }
                            // If we reach end without finding code, insert at top
                            if (i === lines.length - 1) insertIndex = 0;
                        }
                        lines.splice(insertIndex, 0, '"use client";', ''); // Add directive and a blank line
                        currentContent = lines.join('\n');
                        fixedMessages.push(`✅ Добавлено "use client"; в ${file.path}`);
                        fileChanged = true;
                    }
                // Fix: Add missing import
                } else if (issue.type === 'import' && issue.details?.importStatement) {
                     const importRegex = issue.details.importRegex; // Use the specific regex for this import
                     if (!importRegex.test(currentContent)) { // Check if import is actually missing now
                        const lines = currentContent.split('\n'); let insertIndex = 0; let foundUseClient = false;
                        // Find appropriate insertion point
                        for (let i = 0; i < lines.length; i++) {
                            const tl = lines[i].trim();
                            if (tl === '"use client";' || tl === "'use client';") { insertIndex = i + 1; foundUseClient = true; continue; } // After use client
                            if (tl.startsWith('import ')) { insertIndex = i + 1; continue; } // After last import
                            if (tl !== '' && !tl.startsWith('//') && !tl.startsWith('/*') ) { // Before first code/comment block (if no imports/use client)
                                if(insertIndex === 0 && !foundUseClient) insertIndex = i;
                                break; // Stop searching after first code/comment
                            }
                        }
                        lines.splice(insertIndex, 0, issue.details.importStatement); // Insert the import
                        currentContent = lines.join('\n');
                        fixedMessages.push(`✅ Добавлен импорт для '${issue.details.name}' в ${file.path}`);
                        fileChanged = true;
                     }
                }
            });
            if (fileChanged) changesMadeCount++;
            return { ...file, content: currentContent }; // Return updated file object
        });

        // Update state and show feedback only if changes were made
        if (changesMadeCount > 0) {
            setParsedFiles(updatedFiles); // Update the main file state
            fixedMessages.forEach(msg => toast.success(msg, { duration: 5000 })); // Show individual toasts

            // Update validation state: remove ONLY the fixed issues
            const remainingIssues = validationIssues.filter(i => !fixableIssues.some(fixed => fixed.id === i.id));
            setValidationIssues(remainingIssues);
            // Set status based on remaining issues
            setValidationStatus(remainingIssues.length > 0 ? (remainingIssues.some(i=>!i.fixable && !i.restorable)? 'error':'warning') : 'success');
        } else {
            toast.info("Не найдено проблем для автоматического исправления (иконки, use client, импорты).");
            // If status was warning only due to fixable issues, set to success now
            if(validationStatus === 'warning' && !validationIssues.some(i => !i.fixable)) {
                setValidationStatus('success');
            }
        }
        return updatedFiles; // Return the potentially modified files
    }, [validationIssues, validationStatus]); // Added validationStatus dependency

    // --- Hook Return Value ---
    return {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues, // Removed restoreSkippedCode
        setParsedFiles, setValidationStatus, setValidationIssues,
    };
}