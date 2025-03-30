import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// Re-define interfaces here or import from a shared types file
interface FileEntry {
  id: string;
  path: string;
  content: string;
  extension: string;
}

interface ValidationIssue {
    id: string;
    fileId: string;
    filePath: string;
    type: 'icon' | 'useClient' | 'skippedContent'; // Simplified types
    message: string;
    details?: any;
    fixable: boolean;
}

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

// Icon replacement map (can be expanded)
const iconReplacements: Record<string, string> = {
    'FaSync': 'FaRotate', // Example: From react-icons/fa
    'FaTools': 'FaScrewdriverWrench', // Example: From react-icons/fa
    'FaCheckSquare': 'FaSquareCheck',
    'FaTelegramPlane': 'FaPaperPlane',
    'FaEllipsisV': 'FaEllipsisVertical',
    'FaInfoCircle': 'FaCircleInfo',
    'FaTrashAlt': 'FaPoo',
};
const badIconImportSource = 'react-icons/fa'; // Focus on replacing older 'fa' imports for now

const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

export function useCodeParsingAndValidation() {
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
    const [rawDescription, setRawDescription] = useState<string>(""); // Text parts between code blocks
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    // --- Parsing Logic ---
    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string } => {
        const files: FileEntry[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        // Regex remains the same as before
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$)|(?:^\s*))\n*^```(\w+)?\n([\s\S]*?)\n^```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                descriptionParts.push(text.substring(lastIndex, match.index).trim());
            }
            lastIndex = codeBlockRegex.lastIndex;

            let path = (match[4] || match[1] || `unnamed-${files.length + 1}`).trim();
            let content = match[3].trim();
            let extension = path.split('.').pop() || 'txt';

             if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0].trim();
                const pathCommentMatch = potentialPathLine.match(/^(?:\/\/|\/\*|--|#)\s*([\w\-\/\.]+?\.\w+)/);
                const plainPathMatch = potentialPathLine.match(/^[\w\-\/\.]+?\.\w+$/) && lines.length > 1;
                if (pathCommentMatch) {
                    path = pathCommentMatch[1].trim(); content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop() || 'txt';
                } else if (plainPathMatch) {
                     path = potentialPathLine; content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop() || 'txt';
                }
            }
            path = path.replace(/^[\/\\]+/, '');
            files.push({ id: generateId(), path, content, extension });
        }
        if (lastIndex < text.length) {
            descriptionParts.push(text.substring(lastIndex).trim());
        }
        const description = descriptionParts.filter(Boolean).join('\n\n');
        return { files, description };
    }, []);

    // --- Validation Logic ---
    const validateParsedFiles = useCallback(async (filesToValidate: FileEntry[]): Promise<ValidationIssue[]> => {
        setValidationStatus('validating');
        const issues: ValidationIssue[] = [];
        const clientHookPatterns = /(useState|useEffect|useRef|useContext|useReducer|useCallback|useMemo|useLayoutEffect|useImperativeHandle|useDebugValue)\s*\(/;
        const skippedContentPatterns = /(\.\.\.|\[\.\.\.\]|\/\/ \.\.\.(?:\s|$)|<!-- \.\.\. -->|\/\* \.\.\. \*\/)/;

        for (const file of filesToValidate) {
            // 1. Icon Check (Simplified: Check for imports from 'react-icons/fa' only)
            const iconImportRegex = /import\s+{([^}]*)}\s+from\s+['"](react-icons\/fa)['"]/g;
            let importMatch;
            while ((importMatch = iconImportRegex.exec(file.content)) !== null) {
                const importedIcons = importMatch[1].split(',').map(i => i.trim().split(' ')[0]).filter(Boolean); // Get just icon names
                importedIcons.forEach(iconName => {
                     const replacement = iconReplacements[iconName];
                    // Check if usage exists (basic check) - could be improved
                    const usageRegex = new RegExp(`<${iconName}[\\s>]`);
                    if (usageRegex.test(file.content)) {
                         issues.push({
                            id: generateId(), fileId: file.id, filePath: file.path, type: 'icon',
                            message: `Иконка ${iconName} из 'react-icons/fa' используется. ${replacement ? ` Рекомендуется ${replacement} из 'react-icons/fa6'.` : ''}`,
                            details: { badIcon: iconName, goodIcon: replacement },
                            fixable: !!replacement // Fixable only if we have a known replacement
                        });
                    }
                });
            }

            // 2. "use client" Check
            if (/\.(tsx|jsx)$/.test(file.path)) { // Check only TSX/JSX files
                const lines = file.content.split('\n');
                const firstRealLine = lines.find(line => line.trim() !== '');
                const hasUseClient = firstRealLine?.trim() === '"use client";' || firstRealLine?.trim() === "'use client';";

                if (!hasUseClient && clientHookPatterns.test(file.content)) {
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'useClient',
                        message: `Обнаружены хуки React (${clientHookPatterns.exec(file.content)?.[1]}), но отсутствует директива "use client".`,
                        details: null,
                        fixable: true // This is fixable by prepending
                    });
                }
            }

            // 3. Skipped Content Check
            if (skippedContentPatterns.test(file.content)) {
                 issues.push({
                    id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedContent',
                    message: `Обнаружен маркер пропуска кода ('${skippedContentPatterns.exec(file.content)?.[1]}'). Код может быть неполным.`,
                    details: null,
                    fixable: false // Not reliably fixable automatically
                });
            }
        }
        // Simulate async validation if needed
        // await new Promise(resolve => setTimeout(resolve, 100));
        setValidationIssues(issues);
        if (issues.length > 0) {
             const hasUnfixable = issues.some(issue => !issue.fixable);
             setValidationStatus(hasUnfixable ? 'error' : 'warning');
             // toast.warning(`Обнаружено ${issues.length} потенциальных проблем.`);
        } else {
            setValidationStatus('success');
            // toast.success("Проверка кода пройдена успешно!");
        }
        return issues; // Return issues found
    }, []);

    // --- Main Parsing and Validation Trigger ---
    const parseAndValidateResponse = useCallback(async (response: string) => {
        setIsParsing(true);
        setValidationStatus('idle');
        setValidationIssues([]);
        setParsedFiles([]);
        setRawDescription("");

        if (!response.trim()) {
            toast.info("Поле ответа пусто.");
            setIsParsing(false);
            return { files: [], description: "", issues: [] };
        }

        const { files, description } = parseFilesFromText(response);
        setParsedFiles(files);
        setRawDescription(description);

        let finalIssues: ValidationIssue[] = [];
        if (files.length > 0) {
            toast.success(`${files.length} файлов разобрано. Запуск проверки...`);
            finalIssues = await validateParsedFiles(files); // Await validation
        } else {
            toast.info("В ответе не найдено файлов кода для разбора.");
            setValidationStatus('idle');
        }

        setIsParsing(false);
        return { files, description, issues: finalIssues };

    }, [parseFilesFromText, validateParsedFiles]);

    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
        let changesMade = false;
        const fixableIssues = issuesToFix.filter(issue => issue.fixable);

        const updatedFiles = filesToFix.map(file => {
            let newContent = file.content;
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);

            if (fileIssues.length === 0) return file;

            fileIssues.forEach(issue => {
                if (issue.type === 'icon' && issue.details?.badIcon && issue.details?.goodIcon) {
                    const bad = issue.details.badIcon;
                    const good = issue.details.goodIcon;
                    const importRegex = new RegExp(`import\\s+{[^}]*${bad}[^}]*}\\s+from\\s+['"]${badIconImportSource}['"]`);
                    const usageRegex = new RegExp(`<${bad}(\\s|\\/>|>)`, 'g');

                    // Attempt to fix import (simple case, might need improvement)
                    newContent = newContent.replace(importRegex, (match) => {
                         // This is tricky, ideally parse imports properly. Simple replace for now.
                         // Maybe just warn user or add // TODO comment?
                         // For now, let's just comment out the bad import and add a TODO
                         // console.warn(`Icon fix: Cannot reliably replace import for ${bad} in ${file.path}`);
                         // return `// TODO: Replace import for ${bad} with ${good} from fa6\n// ${match}`;
                         // OR try a simple replace if confident
                          return match.replace(bad, good).replace(badIconImportSource, 'react-icons/fa6');
                    });
                     // Fix usage
                    newContent = newContent.replace(usageRegex, `<${good}$1`); // Replace opening tags
                    newContent = newContent.replaceAll(`</${bad}>`, `</${good}>`); // Replace closing tags (less common)
                    changesMade = true; // Assume change if we attempted
                } else if (issue.type === 'useClient') {
                    const lines = newContent.split('\n');
                    const firstRealLineIndex = lines.findIndex(line => line.trim() !== '');
                    if (firstRealLineIndex === -1 || (lines[firstRealLineIndex]?.trim() !== '"use client";' && lines[firstRealLineIndex]?.trim() !== "'use client';")) {
                        // Prepend "use client"
                        newContent = `"use client";\n${newContent}`;
                        changesMade = true;
                    }
                }
            });
            return { ...file, content: newContent };
        });

        if (changesMade) {
            setParsedFiles(updatedFiles); // Update state
            toast.success("Автоматические исправления применены!");
            // Re-validate silently or clear issues
            // validateParsedFiles(updatedFiles); // Option 1: Revalidate
            setValidationIssues(validationIssues.filter(i => !i.fixable)); // Option 2: Remove fixed issues
            setValidationStatus(validationIssues.some(i => !i.fixable) ? 'error' : 'success');
        } else {
            toast.info("Не найдено проблем для автоматического исправления.");
        }
        return updatedFiles; // Return the potentially modified files

    }, [validationIssues, /* validateParsedFiles */]); // Include validate if revalidating

    return {
        parsedFiles,
        rawDescription,
        validationStatus,
        validationIssues,
        isParsing,
        parseAndValidateResponse,
        autoFixIssues,
        setParsedFiles, // Allow parent to update files after manual fixes (e.g., swap)
        setValidationStatus, // Allow parent to reset status
        setValidationIssues, // Allow parent to clear issues
    };
}