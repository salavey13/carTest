// /hooks/useCodeParsingAndValidation.ts
"use client"; // Add use client here automatically

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// --- Interfaces ---
export interface FileEntry { id: string; path: string; content: string; extension: string; }
export interface ValidationIssue {
    id: string; fileId: string; filePath: string;
    type: 'icon' | 'useClient' | 'import' | 'skippedCodeBlock' | 'skippedComment' | 'parseError'; // Added parseError
    message: string;
    details?: any;
    fixable: boolean;
    restorable?: boolean; // For skippedCodeBlock
}
export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

// --- Constants ---
const iconReplacements: Record<string, string> = {
    'FaSync': 'FaRotate', 'FaTools': 'FaScrewdriverWrench', 'FaCheckSquare': 'FaSquareCheck',
    'FaTelegramPlane': 'FaPaperPlane', 'FaEllipsisV': 'FaEllipsisVertical', 'FaInfoCircle': 'FaCircleInfo',
    'FaTrashAlt': 'FaPoo', 'FaCheckCircle': 'FaCircleCheck', 'FaTimesCircle': 'FaCircleTimes',
};
const badIconImportSource = 'react-icons/fa';

const importChecks = [
    { name: 'motion', usageRegex: /<motion\./, importRegex: /import .* from ['"]framer-motion['"]/, importStatement: `import { motion } from "framer-motion";` },
    { name: 'clsx', usageRegex: /clsx\(/, importRegex: /import clsx from ['"]clsx['"]/, importStatement: `import clsx from "clsx";` },
    // Add more common imports if needed
];

// Regex for skipped code blocks (accepts 2 or 3 dots)
const skippedCodeBlockMarkerRegex = /(\/\*\s*\.{2,3}\s*\*\/)|({\s*\/\*\s*\.{2,3}\s*\*\/\s*})|(\[\s*\/\*\s*\.{2,3}\s*\*\/\s*\])/;
// Regex specifically for the false positive "keep" comment
const skippedCommentKeepRegex = /\/\/\s*\.{3}\s*\(keep\s/;
// Regex for actual skipped comments (only 3 dots, not followed by "(keep ")
const skippedCommentRealRegex = /\/\/\s*\.{3}(?!\s*\()/;

// Regex for code block boundaries allowing leading spaces
const codeBlockStartRegex = /^\s*```(\w*)\s*$/;
const codeBlockEndRegex = /^\s*```\s*$/;
// Regex for path comments allowing leading spaces
const pathCommentRegex = /^\s*(?:\/\/|\/\*|--|#)\s*([\w\-\/\.\[\]]+?\.\w+)/;

const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

// --- Custom Hook ---
export function useCodeParsingAndValidation() {
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
    const [rawDescription, setRawDescription] = useState<string>("");
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    // --- Parsing Logic ---
    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string, parseErrors: ValidationIssue[] } => {
        const files: FileEntry[] = [];
        const parseErrors: ValidationIssue[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];

        // Enhanced regex to capture file path potentially declared before OR after the block
        // Group 1: Path before block, Group 2: Language, Group 3: Content, Group 4: Path after block
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$)\n*)?^\s*```(\w+)?\n([\s\S]*?)\n^\s*```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            const currentMatchIndex = match.index;

            // Capture description text between blocks or before the first block
            if (currentMatchIndex > lastIndex) {
                descriptionParts.push(text.substring(lastIndex, currentMatchIndex).trim());
            }
            lastIndex = codeBlockRegex.lastIndex; // Update lastIndex to end of current match

            let path = (match[1] || match[4] || `unnamed-${files.length + 1}`).trim(); // Path before OR after
            let content = match[3].trim(); // Content group
            let lang = match[2] || ''; // Language group
            let extension = path.split('.').pop()?.toLowerCase() || lang || 'txt'; // Guess extension

            // If path is still unnamed, try to extract from the first line of content
            if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0]?.trimStart(); // Trim start only
                if (potentialPathLine) {
                    const pathMatch = potentialPathLine.match(pathCommentRegex);
                    if (pathMatch && pathMatch[1]) {
                        path = pathMatch[1].trim();
                        content = lines.slice(1).join('\n').trim(); // Re-trim content after removing path line
                        extension = path.split('.').pop()?.toLowerCase() || lang || 'txt';
                    }
                }
            }

            // Clean up leading slashes from path only if it's not just "/"
            if (path !== '/') {
                 path = path.replace(/^[\/\\]+/, '');
            }


            // Check for nested ``` - basic check, might not catch all edge cases
            if (content.includes('```')) {
                 const fileId = generateId();
                 parseErrors.push({
                    id: generateId(), fileId: fileId, // Assign ID even for error files
                    filePath: path || `parse-error-${fileId}`, type: 'parseError',
                    message: `Обнаружен вложенный блок кода (\`\`\`). Разбор может быть некорректным.`,
                    details: { lineNumber: -1 }, fixable: false, restorable: false
                 });
                 // Optionally try to split or just skip? For now, add error and include the file as is.
            }

            // Add the file (even if there was a parse error warning)
            files.push({ id: generateId(), path, content, extension });
        }

        // Capture any remaining text after the last code block as description
        if (lastIndex < text.length) {
            descriptionParts.push(text.substring(lastIndex).trim());
        }

        const description = descriptionParts.filter(Boolean).join('\n\n');
        return { files, description, parseErrors };
    }, []);


    // --- Validation Logic ---
    const validateParsedFiles = useCallback(async (filesToValidate: FileEntry[]): Promise<ValidationIssue[]> => {
        setValidationStatus('validating');
        const issues: ValidationIssue[] = [];
        const clientHookPatterns = /(useState|useEffect|useRef|useContext|useReducer|useCallback|useMemo|useLayoutEffect|useImperativeHandle|useDebugValue)\s*\(/;

        for (const file of filesToValidate) {
            // Skip validation for fundamentally broken files (e.g., unnamed ones we couldn't fix)
            if (file.path.startsWith('unnamed-') || file.path.startsWith('parse-error-')) {
                continue; // Maybe add a different kind of issue if needed
            }

            const lines = file.content.split('\n');

            // 1. Icon Check (react-icons/fa only)
            const iconImportRegex = /import\s+{([^}]*)}\s+from\s+['"](react-icons\/fa)['"]/g;
            let importMatch;
            while ((importMatch = iconImportRegex.exec(file.content)) !== null) {
                const importedIcons = importMatch[1].split(',').map(i => i.trim().split(/\s+as\s+/)[0]).filter(Boolean);
                importedIcons.forEach(iconName => {
                    const replacement = iconReplacements[iconName];
                    // Regex to find usage as a component tag, avoiding matches within strings or comments (basic check)
                    const usageRegex = new RegExp(`<${iconName}(?![-_a-zA-Z0-9])(\\s|\\/?>)`);
                    const linesWithIcon = file.content.split('\n');
                    let firstUsageLine = -1;
                    for (let i = 0; i < linesWithIcon.length; i++) {
                        // Simple check to avoid matching commented out lines
                        if (!linesWithIcon[i].trim().startsWith('//') && !linesWithIcon[i].trim().startsWith('/*') && usageRegex.test(linesWithIcon[i])) {
                            firstUsageLine = i + 1;
                            break;
                        }
                    }

                    if (firstUsageLine !== -1) { // Check if usage was found
                         issues.push({
                            id: generateId(), fileId: file.id, filePath: file.path, type: 'icon',
                            message: `Старая иконка ${iconName} из 'react-icons/fa'. ${replacement ? `Заменить на ${replacement} из /fa6?` : 'Аналог?'}`,
                            details: { badIcon: iconName, goodIcon: replacement, lineNumber: firstUsageLine },
                            fixable: !!replacement // Fixable only if we have a direct replacement suggestion
                         });
                     }
                });
            }

            // 2. "use client" Check (Only for .tsx/.jsx)
            if (/\.(tsx|jsx)$/.test(file.path)) {
                const firstRealLineIndex = lines.findIndex(line => line.trim() !== '');
                const firstRealLine = firstRealLineIndex !== -1 ? lines[firstRealLineIndex].trim() : null;
                const hasUseClient = firstRealLine === '"use client";' || firstRealLine === "'use client';";

                // Check for hooks OR event handlers (like onClick={...})
                const usesClientFeatures = clientHookPatterns.test(file.content) || /on[A-Z][a-zA-Z]*\s*=\s*{/.test(file.content);

                if (!hasUseClient && usesClientFeatures) {
                     // Try to find the line number of the first client feature usage for better detail
                     let firstUsageLine = -1;
                     const hookMatch = clientHookPatterns.exec(file.content);
                     const eventMatch = /on[A-Z][a-zA-Z]*\s*=\s*{/.exec(file.content);

                     if (hookMatch || eventMatch) {
                         const searchIndex = Math.min(hookMatch?.index ?? Infinity, eventMatch?.index ?? Infinity);
                         if (searchIndex !== Infinity) {
                             const textBefore = file.content.substring(0, searchIndex);
                             firstUsageLine = (textBefore.match(/\n/g) || []).length + 1;
                         }
                     }
                     const hookName = hookMatch?.[1] ?? (eventMatch ? 'обработчик событий' : 'клиентская фича');

                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'useClient',
                        message: `Найден ${hookName} без "use client".`,
                        details: { lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined },
                        fixable: true // Mark as fixable
                    });
                }
            }

            // 3. Skipped Code Block Check (/* ... */)
            for (let i = 0; i < lines.length; i++) {
                // Trim the line before testing the regex
                if (skippedCodeBlockMarkerRegex.test(lines[i].trimStart())) {
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedCodeBlock',
                        message: `Пропущен блок кода (строка ${i + 1}). Можно попытаться восстановить.`,
                        details: { markerLineContent: lines[i], lineNumber: i + 1 }, // Store original line with indent
                        fixable: false,
                        restorable: true // Mark as restorable
                    });
                }
            }

            // 4. Skipped Comment Check (// ...) - Distinguish real skips from "keep" comments
            for (let i = 0; i < lines.length; i++) {
                const trimmedLine = lines[i].trimStart();
                if (skippedCommentRealRegex.test(trimmedLine)) {
                     // It's a real skipped comment if it matches the "real" regex
                     // AND does NOT match the "keep" regex
                     if (!skippedCommentKeepRegex.test(trimmedLine)) {
                         issues.push({
                             id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedComment',
                             message: `Пропущен комментарий '// ...' (строка ${i + 1}).`,
                             details: { lineNumber: i + 1 },
                             fixable: false,
                             restorable: false
                         });
                     } else {
                         // Optional: Log the "keep" comment if needed for debugging
                         // console.log(`Ignoring "keep" comment in ${file.path} line ${i + 1}`);
                     }
                }
            }


            // 5. Import Checks (Only for .tsx/.jsx)
            if (/\.(tsx|jsx)$/.test(file.path)) {
                importChecks.forEach(check => {
                    if (check.usageRegex.test(file.content) && !check.importRegex.test(file.content)) {
                         // Find first usage line number
                         let firstUsageLine = -1;
                         const usageMatch = check.usageRegex.exec(file.content);
                         if (usageMatch) {
                              const textBefore = file.content.substring(0, usageMatch.index);
                              firstUsageLine = (textBefore.match(/\n/g) || []).length + 1;
                         }
                        issues.push({
                            id: generateId(), fileId: file.id, filePath: file.path, type: 'import',
                            message: `Используется '${check.name}', но импорт отсутствует.`,
                            details: { name: check.name, importStatement: check.importStatement, lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined },
                            fixable: true // Mark as fixable
                        });
                    }
                });
            }
        }

        setValidationIssues(issues); // Update state with found issues
        if (issues.length > 0) {
            const hasHardErrors = issues.some(issue => !issue.fixable && !issue.restorable);
            const hasRestorable = issues.some(issue => issue.restorable);
            const hasOnlyFixable = issues.every(issue => issue.fixable || issue.restorable);

            if(hasHardErrors) {
                 setValidationStatus('error');
            } else if (hasOnlyFixable || hasRestorable) { // If only fixable or restorable issues exist
                 setValidationStatus('warning');
            } else {
                 setValidationStatus('error'); // Should not happen if logic is right, but fallback
            }
        } else {
            setValidationStatus('success'); // No issues found
        }
        return issues;
    }, []); // Dependencies are stable


    // --- Main Parsing and Validation Trigger ---
    const parseAndValidateResponse = useCallback(async (response: string) => {
        setIsParsing(true); setValidationStatus('idle'); setValidationIssues([]); setParsedFiles([]); setRawDescription("");
        if (!response.trim()) { toast.info("Поле ответа пусто."); setIsParsing(false); return { files: [], description: "", issues: [] }; }

        try {
             // Parse first
            const { files, description, parseErrors } = parseFilesFromText(response);
            setParsedFiles(files); setRawDescription(description);

            let validationIssuesResult: ValidationIssue[] = [];
            if (files.length > 0) {
                toast.info(`${files.length} файлов найдено. Запуск проверки...`, { duration: 1500 });
                 // Validate the successfully parsed files
                validationIssuesResult = await validateParsedFiles(files);
            } else {
                toast.info("В ответе не найдено файлов кода для разбора.");
                setValidationStatus('idle');
            }

             // Combine parsing errors with validation issues
            const allIssues = [...parseErrors, ...validationIssuesResult];
            setValidationIssues(allIssues); // Update state with combined issues

             // Update overall status based on combined issues
            if (allIssues.length > 0) {
                const hasHardErrors = allIssues.some(issue => !issue.fixable && !issue.restorable);
                 const hasOnlyFixableOrRestorable = allIssues.every(issue => issue.fixable || issue.restorable);
                 setValidationStatus(hasHardErrors ? 'error' : (hasOnlyFixableOrRestorable ? 'warning' : 'error'));
            } else if (files.length > 0) { // Only set success if files were parsed AND no issues
                setValidationStatus('success');
            } else {
                 setValidationStatus('idle'); // No files, no issues
            }

            setIsParsing(false);
            return { files, description, issues: allIssues };

         } catch (error) {
             console.error("Critical error during parsing/validation:", error);
             toast.error("Критическая ошибка при разборе ответа.");
             setIsParsing(false);
             setValidationStatus('error');
             // Create a generic error issue
             const genericError: ValidationIssue = {
                id: generateId(), fileId: 'general', filePath: 'N/A', type: 'parseError',
                message: `Критическая ошибка разбора: ${error instanceof Error ? error.message : String(error)}`,
                details: null, fixable: false, restorable: false
             };
             setValidationIssues([genericError]);
             return { files: [], description: rawDescription, issues: [genericError] };
         }
    }, [parseFilesFromText, validateParsedFiles, rawDescription]); // Added rawDescription dependency


    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
        let changesMadeCount = 0; const fixedMessages: string[] = [];
        // Filter only issues that are marked as 'fixable' by the validation logic
        const fixableIssues = issuesToFix.filter(issue => issue.fixable);

        if (fixableIssues.length === 0) {
             toast.info("Не найдено проблем для автоматического исправления.");
             return filesToFix; // Return original files if nothing to fix
        }

        const updatedFiles = filesToFix.map(file => {
            let currentContent = file.content; let fileChanged = false;
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);
            if (fileIssues.length === 0) return file; // No fixable issues for this file

            // Apply fixes for this file
            fileIssues.forEach(issue => {
                try { // Add try-catch around each fix attempt
                    if (issue.type === 'icon' && issue.details?.badIcon && issue.details?.goodIcon) {
                        // .. (keep existing icon fix logic)
                        const bad = issue.details.badIcon; const good = issue.details.goodIcon; const usageOpenRegex = new RegExp(`<${bad}(?![-_a-zA-Z0-9])(\\s|\\/?>)`, 'g'); const lines = currentContent.split('\n'); let changed = false;
                        const newLines = lines.map(line => { if (!line.trim().startsWith('//') && !line.trim().startsWith('/*') && usageOpenRegex.test(line)) { changed = true; let newLine = line.replace(usageOpenRegex, `<${good}$1`); newLine = newLine.replaceAll(`</${bad}>`, `</${good}>`); return newLine; } return line; });
                        if (changed) { currentContent = newLines.join('\n'); fileChanged = true; fixedMessages.push(`✅ Иконка: ${bad} -> ${good} в ${file.path}`);
                            // Add a comment near the import to check fa6
                            const importRegexFa = new RegExp(`(import\\s+{[^}]*}\\s+from\\s+['"]react-icons/fa['"])`);
                            if (importRegexFa.test(currentContent)) {
                                currentContent = currentContent.replace(importRegexFa, `$1;\n// TODO: Consider changing import to 'react-icons/fa6' for ${good}`);
                            }
                         }

                    } else if (issue.type === 'useClient') {
                        // Find the first non-empty, non-comment line
                        const lines = currentContent.split('\n');
                        let firstCodeLineIndex = -1;
                        for (let i = 0; i < lines.length; i++) {
                            const trimmedLine = lines[i].trim();
                            if (trimmedLine !== '' && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) {
                                firstCodeLineIndex = i;
                                break;
                            }
                        }

                        // Check if "use client" is already the very first non-comment/empty line
                        const alreadyHasUseClient = firstCodeLineIndex !== -1 &&
                           (lines[firstCodeLineIndex] === '"use client";' || lines[firstCodeLineIndex] === "'use client';");

                        if (!alreadyHasUseClient) {
                            // Insert "use client" at the determined index (or 0 if no code found)
                            const insertIndex = firstCodeLineIndex !== -1 ? firstCodeLineIndex : 0;
                            // Add newline after if inserting at the top or before existing code
                            const newLineChar = insertIndex === 0 || (firstCodeLineIndex !== -1 && lines[insertIndex].trim() !== '') ? '\n' : '';
                            lines.splice(insertIndex, 0, '"use client";' + newLineChar);
                            currentContent = lines.join('\n');
                            fixedMessages.push(`✅ Добавлено "use client"; в ${file.path}`);
                            fileChanged = true;
                        }

                    } else if (issue.type === 'import' && issue.details?.importStatement && issue.details?.importRegex) {
                        const importRegex: RegExp = issue.details.importRegex; // Cast if needed
                        // Add import only if it doesn't already exist
                        if (!importRegex.test(currentContent)) {
                            const lines = currentContent.split('\n');
                            let insertIndex = 0;
                            let useClientIndex = -1;

                             // Find where to insert: after "use client" or after last import
                             for (let i = 0; i < lines.length; i++) {
                                const tl = lines[i].trim();
                                if (tl === '"use client";' || tl === "'use client';") {
                                    useClientIndex = i;
                                    insertIndex = i + 1; // Default after "use client"
                                } else if (tl.startsWith('import ')) {
                                    insertIndex = i + 1; // Place after the last import found so far
                                } else if (tl !== '' && !tl.startsWith('//') && !tl.startsWith('/*')) {
                                     // If we hit code before finding imports/use client, insert at the top (index 0) unless use client was found
                                     if (insertIndex === 0 && useClientIndex === -1) insertIndex = 0;
                                     break; // Stop searching once code starts
                                }
                            }
                             // Add extra newline if inserting after "use client" or imports
                             const prefixNewLine = (useClientIndex !== -1 || insertIndex > 0) && lines[insertIndex]?.trim() !== '' ? '\n' : '';
                            lines.splice(insertIndex, 0, prefixNewLine + issue.details.importStatement);
                            currentContent = lines.join('\n');
                            fixedMessages.push(`✅ Добавлен импорт для '${issue.details.name}' в ${file.path}`);
                            fileChanged = true;
                        }
                    }
                 } catch (fixError) {
                      console.error(`Error auto-fixing issue ${issue.id} (${issue.type}) in file ${file.path}:`, fixError);
                      toast.error(`Ошибка исправления ${issue.type} в ${file.path}`);
                      // Optionally mark the issue as unfixable now? Or just log it.
                 }
            });

            if (fileChanged) changesMadeCount++;
            return { ...file, content: currentContent };
        });

        if (changesMadeCount > 0) {
            setParsedFiles(updatedFiles); // Update the state with fixed files
            fixedMessages.forEach(msg => toast.success(msg, { duration: 4000 }));

            // Re-validate AFTER fixing to update the status correctly
            // This is important to remove fixed issues and potentially change status from warning/error to success
            console.log("Re-validating files after auto-fix...");
            validateParsedFiles(updatedFiles); // Re-run validation on the modified files

        } else {
            // toast.info("Авто-исправление не внесло изменений."); // Already handled if fixableIssues was empty
            // If no changes were made but status was 'warning', and no non-fixable/non-restorable issues remain, set to success.
             const nonFixableOrRestorable = validationIssues.some(i => !i.fixable && !i.restorable);
             if (validationStatus === 'warning' && !nonFixableOrRestorable) {
                setValidationStatus('success');
             }
        }
        return updatedFiles; // Return the potentially modified files
    }, [validationIssues, validationStatus, validateParsedFiles]); // Added validateParsedFiles dependency


    return {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues,
        // Expose setters if needed by other components, though usually internal state is managed here
        setParsedFiles, setValidationStatus, setValidationIssues, setIsParsing, setRawDescription,
    };
}