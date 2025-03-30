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
}
export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

// --- Constants ---
const iconReplacements: Record<string, string> = {
    'FaSync': 'FaRotate',
    'FaTools': 'FaScrewdriverWrench',
    'FaCheckSquare': 'FaSquareCheck',
    'FaTelegramPlane': 'FaPaperPlane',
    'FaEllipsisV': 'FaEllipsisVertical',
    'FaInfoCircle': 'FaCircleInfo',
    'FaTrashAlt': 'FaTrashCan',
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
        const files: FileEntry[] = []; let lastIndex = 0; const descriptionParts: string[] = [];
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$)|(?:^\s*))\n*^```(\w+)?\n([\s\S]*?)\n^```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
             if (match.index > lastIndex) descriptionParts.push(text.substring(lastIndex, match.index).trim());
             lastIndex = codeBlockRegex.lastIndex;
             let path = (match[4] || match[1] || `unnamed-${files.length + 1}`).trim();
             let content = match[3].trim();
             let extension = path.split('.').pop()?.toLowerCase() || 'txt';
             if (path.startsWith('unnamed-')) {
                 const lines = content.split('\n'); const potentialPathLine = lines[0]?.trim();
                 if(potentialPathLine){
                    const pathCommentMatch = potentialPathLine.match(/^(?:\/\/|\/\*|--|#)\s*([\w\-\/\.]+?\.\w+)/);
                    const plainPathMatch = potentialPathLine.match(/^[\w\-\/\.]+?\.\w+$/) && lines.length > 1;
                    if (pathCommentMatch) { path = pathCommentMatch[1].trim(); content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop()?.toLowerCase() || 'txt';}
                    else if (plainPathMatch) { path = potentialPathLine; content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop()?.toLowerCase() || 'txt';}
                 }
             }
             path = path.replace(/^[\/\\]+/, '');
             files.push({ id: generateId(), path, content, extension });
        }
        if (lastIndex < text.length) descriptionParts.push(text.substring(lastIndex).trim());
        const description = descriptionParts.filter(Boolean).join('\n\n');
        return { files, description };
    }, []);

    // --- Validation Logic ---
    const validateParsedFiles = useCallback(async (filesToValidate: FileEntry[]): Promise<ValidationIssue[]> => {
        setValidationStatus('validating');
        const issues: ValidationIssue[] = [];
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
                    const usageRegex = new RegExp(`<${iconName}(\\s|\\/?>)`);
                    // Simple check: if line includes "for science" comment, don't flag it.
                    const linesWithIcon = file.content.split('\n').filter(line => usageRegex.test(line));
                    const shouldWarn = linesWithIcon.some(line => !line.includes('// for science')); // Warn if *any* usage isn't commented

                    if (usageRegex.test(file.content) && shouldWarn) {
                         issues.push({
                            id: generateId(), fileId: file.id, filePath: file.path, type: 'icon',
                            message: `Иконка ${iconName} из 'react-icons/fa'. ${replacement ? `Заменить на ${replacement} (fa6)?` : 'Аналог?'}`,
                            details: { badIcon: iconName, goodIcon: replacement }, fixable: !!replacement
                        });
                    }
                });
            }

            // 2. "use client" Check
            if (/\.(tsx|jsx)$/.test(file.path)) {
                const firstRealLine = lines.find(line => line.trim() !== '');
                const hasUseClient = firstRealLine?.trim() === '"use client";' || firstRealLine?.trim() === "'use client';";
                if (!hasUseClient && clientHookPatterns.test(file.content)) {
                    const hookMatch = clientHookPatterns.exec(file.content)?.[1] ?? 'hook';
                    issues.push({ id: generateId(), fileId: file.id, filePath: file.path, type: 'useClient', message: `Клиентский хук (${hookMatch}) без "use client".`, details: null, fixable: true });
                }
            }

            // 3. Skipped Code Block Check (/* ... */, { /* ... */ }, [ /* ... */ ])
            for (let i = 0; i < lines.length; i++) {
                if (skippedCodeBlockMarkerRegex.test(lines[i])) {
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedCodeBlock',
                        message: `Обнаружен маркер пропуска блока кода (строка ${i + 1}). Можно восстановить.`,
                        details: { markerLineContent: lines[i], lineNumber: i + 1 }, // Store the whole line content
                        fixable: false // Requires manual intervention
                    });
                }
            }

            // 4. Skipped Comment Check (// ...) - Unfixable for now
            for (let i = 0; i < lines.length; i++) {
                if (skippedCommentMarkerRegex.test(lines[i])) {
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedComment',
                        message: `Обнаружен маркер пропуска комментария '// ...' (строка ${i + 1}). Восстановление не поддерживается.`,
                        details: { lineNumber: i + 1 },
                        fixable: false
                    });
                }
            }

            // 5. Import Checks
             if (/\.(tsx|jsx)$/.test(file.path)) {
                importChecks.forEach(check => {
                    if (check.usageRegex.test(file.content) && !check.importRegex.test(file.content)) {
                         issues.push({
                             id: generateId(), fileId: file.id, filePath: file.path, type: 'import',
                             message: `Используется '${check.name}', но импорт отсутствует.`,
                             details: { name: check.name, importStatement: check.importStatement }, fixable: true
                         });
                    }
                });
             }
        }

        setValidationIssues(issues);
        if (issues.length > 0) {
             const hasUnfixable = issues.some(issue => !issue.fixable);
             setValidationStatus(hasUnfixable ? 'error' : 'warning');
        } else { setValidationStatus('success'); }
        return issues;
    }, []);

    // --- Main Parsing and Validation Trigger ---
    const parseAndValidateResponse = useCallback(async (response: string) => {
        setIsParsing(true); setValidationStatus('idle'); setValidationIssues([]); setParsedFiles([]); setRawDescription("");
        if (!response.trim()) { toast.info("Поле ответа пусто."); setIsParsing(false); return { files: [], description: "", issues: [] }; }

        const { files, description } = parseFilesFromText(response);
        setParsedFiles(files); setRawDescription(description);
        let finalIssues: ValidationIssue[] = [];
        if (files.length > 0) {
            toast.info(`${files.length} файлов найдено. Запуск проверки...`, { duration: 1500 });
            finalIssues = await validateParsedFiles(files);
             // Check validationStatus set by validateParsedFiles
             const currentStatus = validationStatus === 'validating' ?
                (finalIssues.length > 0 ? (finalIssues.some(i => !i.fixable) ? 'error' : 'warning') : 'success')
                : validationStatus; // Use the status set by the validation function

             if (currentStatus === 'success') toast.success("Проверка кода завершена успешно!");
             else if (currentStatus === 'warning' || currentStatus === 'error') toast.warning(`Проверка завершена. Найдено проблем: ${finalIssues.length}.`);

        } else { toast.info("В ответе не найдено файлов кода для разбора."); setValidationStatus('idle'); }
        setIsParsing(false);
        return { files, description, issues: finalIssues };
    }, [parseFilesFromText, validateParsedFiles, validationStatus]); // Removed validationStatus dependency, it's set internally

    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
        let changesMadeCount = 0; const fixedMessages: string[] = [];
        const fixableIssues = issuesToFix.filter(issue => issue.fixable); // Only address fixable issues here

        const updatedFiles = filesToFix.map(file => {
            let currentContent = file.content; let fileChanged = false;
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);
            if (fileIssues.length === 0) return file;

            fileIssues.forEach(issue => {
                let originalContent = currentContent;
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
                             currentContent = currentContent.replace(importRegex, `$1${bad}$2\n// TODO: Verify import for ${good}, consider 'react-icons/fa6'`);
                        }
                        fixedMessages.push(`✅ Иконка: ${bad} -> ${good} в ${file.path}`);
                        fileChanged = true;
                    }

                } else if (issue.type === 'useClient') {
                    const lines = currentContent.split('\n');
                    const firstRealLineIndex = lines.findIndex(l=>l.trim()!=='');
                    const needsUseClient = firstRealLineIndex === -1 || (lines[firstRealLineIndex]?.trim() !== '"use client";' && lines[firstRealLineIndex]?.trim() !== "'use client';");
                    if (needsUseClient) {
                        let insertIndex = 0; for(let i=0; i<lines.length; i++){const tl=lines[i].trim(); if(tl!==''&&!tl.startsWith('//')&&!tl.startsWith('/*')){insertIndex=i;break;}}
                        lines.splice(insertIndex, 0, '"use client";', ''); currentContent = lines.join('\n');
                        fixedMessages.push(`✅ Добавлено "use client"; в ${file.path}`); fileChanged = true;
                    }
                } else if (issue.type === 'import' && issue.details?.importStatement) {
                     const importRegex = issue.details.importRegex; // Use the specific regex for this import
                     if (!importRegex.test(currentContent)) { // Check if import is actually missing now
                        const lines = currentContent.split('\n'); let insertIndex = 0; let foundUseClient = false;
                        for (let i = 0; i < lines.length; i++) { const tl = lines[i].trim(); if (tl === '"use client";' || tl === "'use client';") { insertIndex = i + 1; foundUseClient = true; continue; } if (tl.startsWith('import ')) insertIndex = i + 1; else if (tl !== '' && !tl.startsWith('//') && !tl.startsWith('/*') && insertIndex === 0 && !foundUseClient) { insertIndex = i; break; } else if (tl !== '' && insertIndex <= i) break; }
                        lines.splice(insertIndex, 0, issue.details.importStatement); currentContent = lines.join('\n');
                        fixedMessages.push(`✅ Добавлен импорт для '${issue.details.name}' в ${file.path}`); fileChanged = true;
                     }
                }
            });
            if (fileChanged) changesMadeCount++;
            return { ...file, content: currentContent };
        });

        if (changesMadeCount > 0) {
            setParsedFiles(updatedFiles); fixedMessages.forEach(msg => toast.success(msg, { duration: 5000 }));
            const remainingIssues = validationIssues.filter(i => !fixableIssues.some(fixed => fixed.id === i.id));
            setValidationIssues(remainingIssues);
            setValidationStatus(remainingIssues.length > 0 ? (remainingIssues.some(i=>!i.fixable)? 'error':'warning') : 'success');
        } else {
            toast.info("Не найдено проблем для автоматического исправления.");
            if(validationStatus === 'warning' && !validationIssues.some(i => !i.fixable)) setValidationStatus('success');
        }
        return updatedFiles;
    }, [validationIssues, validationStatus]);

    // --- Restore Skipped Code Logic (Moved to CodeRestorer Component) ---
    // const restoreSkippedCode = useCallback(...) => { ... } // REMOVED FROM HOOK

    // --- Hook Return Value ---
    return {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues, // Removed restoreSkippedCode
        setParsedFiles, setValidationStatus, setValidationIssues,
    };
}