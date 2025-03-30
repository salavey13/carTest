import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// --- Interfaces (Define or import from a shared types/interfaces file) ---
export interface FileEntry {
  id: string; // Unique identifier for React keys and state management
  path: string;
  content: string;
  extension: string;
}

export interface ValidationIssue {
    id: string;
    fileId: string; // Link to FileEntry id
    filePath: string;
    type: 'icon' | 'useClient' | 'skippedContent'; // Type of issue detected
    message: string; // User-friendly message
    details?: any; // Additional data (e.g., { badIcon: 'FaSync', goodIcon: 'FaRotate' })
    fixable: boolean; // Can this issue potentially be auto-fixed?
}

export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

// --- Constants ---

// Map of potentially problematic icons (from 'react-icons/fa') to their preferred 'fa6' replacements
// Expand this map as needed based on common icons used or build errors encountered.
const iconReplacements: Record<string, string> = {
    'FaSync': 'FaRotate',
    'FaTools': 'FaScrewdriverWrench',
    'FaCheckSquare': 'FaSquareCheck',
    'FaTelegramPlane': 'FaPaperPlane',
    'FaEllipsisV': 'FaEllipsisVertical',
    'FaInfoCircle': 'FaCircleInfo', // Assuming FaCircleInfo from fa6 is preferred
    'FaTrashAlt': 'FaTrashCan',     // Assuming FaTrashCan from fa6 is preferred
    // Add more mappings here...
};
const badIconImportSource = 'react-icons/fa'; // The specific older import path to check

// Helper to generate simple unique IDs
const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

// --- Custom Hook ---
export function useCodeParsingAndValidation() {
    // --- State ---
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]); // Files extracted from the AI response
    const [rawDescription, setRawDescription] = useState<string>(""); // Non-code text extracted from the response
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle'); // Current validation status
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]); // Array of detected issues
    const [isParsing, setIsParsing] = useState(false); // Loading indicator for parsing/validation process

    // --- Parsing Logic ---
    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string } => {
        const files: FileEntry[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        // Regex to capture code blocks and optional file paths in comments before/after
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$)|(?:^\s*))\n*^```(\w+)?\n([\s\S]*?)\n^```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Capture text between code blocks as part of the description
            if (match.index > lastIndex) {
                descriptionParts.push(text.substring(lastIndex, match.index).trim());
            }
            lastIndex = codeBlockRegex.lastIndex; // Update index for next iteration

            // Extract file path (prefer comment after block, then before, then generate 'unnamed')
            let path = (match[4] || match[1] || `unnamed-${files.length + 1}`).trim();
            let content = match[3].trim(); // Code content
            let extension = path.split('.').pop()?.toLowerCase() || 'txt'; // File extension

            // Attempt to find path in the first line if initially unnamed
            if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0]?.trim();
                if (potentialPathLine) {
                    const pathCommentMatch = potentialPathLine.match(/^(?:\/\/|\/\*|--|#)\s*([\w\-\/\.]+?\.\w+)/); // Check for commented path
                    const plainPathMatch = potentialPathLine.match(/^[\w\-\/\.]+?\.\w+$/) && lines.length > 1; // Check for plain path
                    if (pathCommentMatch) {
                        path = pathCommentMatch[1].trim(); content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop()?.toLowerCase() || 'txt';
                    } else if (plainPathMatch) {
                         path = potentialPathLine; content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop()?.toLowerCase() || 'txt';
                    }
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
        // Regex to detect common skipped content markers
        const skippedContentPatterns = /(\.\.\.|\[\.\.\.\]|\/\/ \.\.\.(?:\s|$)|<!-- \.\.\. -->|\/\* \.\.\. \*\/)/;

        for (const file of filesToValidate) {
            // 1. Icon Check: Look for imports specifically from 'react-icons/fa'
            const iconImportRegex = /import\s+{([^}]*)}\s+from\s+['"](react-icons\/fa)['"]/g;
            let importMatch;
            while ((importMatch = iconImportRegex.exec(file.content)) !== null) {
                const importedIcons = importMatch[1].split(',')
                                          .map(i => i.trim().split(/\s+as\s+/)[0]) // Handle 'as' aliases, get original name
                                          .filter(Boolean);
                importedIcons.forEach(iconName => {
                     const replacement = iconReplacements[iconName]; // Check if we have a known replacement
                    // Basic check for actual usage of the imported icon as a JSX tag
                    const usageRegex = new RegExp(`<${iconName}(\\s|\\/?>)`); // Check for <IconName or <IconName/> or <IconName >
                    if (usageRegex.test(file.content)) {
                         issues.push({
                            id: generateId(), fileId: file.id, filePath: file.path, type: 'icon',
                            message: `Иконка ${iconName} из 'react-icons/fa' используется.${replacement ? ` Рекомендуется ${replacement} из 'react-icons/fa6'.` : ' Возможно, есть аналог в fa6.'}`,
                            details: { badIcon: iconName, goodIcon: replacement }, // Store details for fixing
                            fixable: !!replacement // Only fixable if a direct replacement is known
                        });
                    }
                });
            }

            // 2. "use client" Check: For files ending in .tsx or .jsx
            if (/\.(tsx|jsx)$/.test(file.path)) {
                const lines = file.content.split('\n');
                // Find the first non-empty, non-comment line
                const firstRealLine = lines.find(line => line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('/*'));
                const hasUseClient = firstRealLine?.trim() === '"use client";' || firstRealLine?.trim() === "'use client';";
                // If client hooks are used but "use client" is missing
                if (!hasUseClient && clientHookPatterns.test(file.content)) {
                    const hookMatch = clientHookPatterns.exec(file.content)?.[1] ?? 'hook';
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'useClient',
                        message: `Обнаружен клиентский хук (${hookMatch}), но отсутствует директива "use client" в начале файла.`,
                        details: null,
                        fixable: true // This can be reliably fixed
                    });
                }
            }

            // 3. Skipped Content Check: Look for '...' patterns
            if (skippedContentPatterns.test(file.content)) {
                 const skippedMatch = skippedContentPatterns.exec(file.content)?.[1] ?? '...';
                 issues.push({
                    id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedContent',
                    message: `Обнаружен маркер пропуска кода ('${skippedMatch}'). Код может быть неполным.`,
                    details: null,
                    fixable: false // Cannot auto-fix skipped content reliably
                });
            }
        }

        // Update state with found issues
        setValidationIssues(issues);

        // Determine final validation status based on issues found
        if (issues.length > 0) {
             const hasUnfixable = issues.some(issue => !issue.fixable);
             setValidationStatus(hasUnfixable ? 'error' : 'warning'); // Error if unfixable, warning if only fixable issues
        } else {
            setValidationStatus('success'); // Success if no issues
        }
        return issues; // Return the list of issues
    }, []); // Empty dependency array

    // --- Main Parsing and Validation Trigger ---
    const parseAndValidateResponse = useCallback(async (response: string) => {
        setIsParsing(true);
        setValidationStatus('idle'); // Reset before starting
        setValidationIssues([]);
        setParsedFiles([]);
        setRawDescription("");

        if (!response.trim()) {
            toast.info("Поле ответа пусто.");
            setIsParsing(false);
            return { files: [], description: "", issues: [] };
        }

        // Parse the text
        const { files, description } = parseFilesFromText(response);
        setParsedFiles(files);
        setRawDescription(description);

        let finalIssues: ValidationIssue[] = [];
        if (files.length > 0) {
            toast.info(`${files.length} файлов найдено. Запуск проверки...`, { duration: 1500 });
            // Validate the parsed files
            finalIssues = await validateParsedFiles(files); // Wait for validation to complete
             // Show summary toast based on validation result
             if (validationStatus === 'success') {
                 toast.success("Проверка кода завершена успешно!");
             } else if (validationStatus === 'warning' || validationStatus === 'error') {
                 toast.warning(`Проверка завершена. Найдено проблем: ${finalIssues.length}.`);
             }
        } else {
            toast.info("В ответе не найдено файлов кода для разбора.");
            setValidationStatus('idle'); // No files, so validation is idle
        }

        setIsParsing(false); // Mark parsing/validation as complete
        return { files, description, issues: finalIssues }; // Return results

    }, [parseFilesFromText, validateParsedFiles, validationStatus]); // Include validationStatus dependency? Maybe not needed here directly.

    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
        let changesMadeCount = 0;
        const fixedMessages: string[] = []; // Collect messages for toasts
        // Filter only the issues that are marked as fixable
        const fixableIssues = issuesToFix.filter(issue => issue.fixable);

        // Map over the files to apply fixes
        const updatedFiles = filesToFix.map(file => {
            let currentContent = file.content;
            let fileChanged = false;
            // Find fixable issues relevant to the current file
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);

            if (fileIssues.length === 0) return file; // No fixes needed for this file

            fileIssues.forEach(issue => {
                let originalContent = currentContent; // Store content before modification

                // Fix: Replace deprecated icon usage
                if (issue.type === 'icon' && issue.details?.badIcon && issue.details?.goodIcon) {
                    const bad = issue.details.badIcon;
                    const good = issue.details.goodIcon;
                    // Replace usage: <BadIcon ... /> -> <GoodIcon ... />
                    const usageOpenRegex = new RegExp(`<${bad}(\\s|\\/?>)`, 'g');
                    currentContent = currentContent.replace(usageOpenRegex, `<${good}$1`);
                    // Replace closing tags if they exist (less common for icons)
                    currentContent = currentContent.replaceAll(`</${bad}>`, `</${good}>`);

                    // Add a TODO comment near the original import for manual review
                    const importRegex = new RegExp(`(import\\s+{[^}]*?)${bad}([^}]*?}\\s+from\\s+['"]${badIconImportSource}['"])`);
                    if (importRegex.test(currentContent)) {
                         currentContent = currentContent.replace(importRegex, `$1${bad}$2\n// TODO: Verify import for ${good}, consider 'react-icons/fa6'`);
                    }

                    if (originalContent !== currentContent) {
                        fixedMessages.push(`✅ Иконка: ${bad} -> ${good} в ${file.path}`);
                        fileChanged = true;
                    }

                // Fix: Add "use client" directive
                } else if (issue.type === 'useClient') {
                    const lines = currentContent.split('\n');
                    const firstRealLineIndex = lines.findIndex(line => line.trim() !== '');
                    const needsUseClient = firstRealLineIndex === -1 || (lines[firstRealLineIndex]?.trim() !== '"use client";' && lines[firstRealLineIndex]?.trim() !== "'use client';");

                    if (needsUseClient) {
                        currentContent = `"use client";\n${currentContent}`; // Prepend directive
                        fixedMessages.push(`✅ Добавлено "use client"; в ${file.path}`);
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
            // Show individual success toasts for each fix
            fixedMessages.forEach(msg => toast.success(msg, { duration: 5000 }));

            // Update validation state: remove the fixed issues
            const remainingIssues = validationIssues.filter(i => !i.fixable);
            setValidationIssues(remainingIssues);
            // Set status based on remaining issues
            setValidationStatus(remainingIssues.length > 0 ? 'error' : 'success');
        } else {
            toast.info("Не найдено проблем для автоматического исправления.");
            // If status was 'warning' (only fixable issues existed), but none were fixed (e.g., already correct), set to success.
            if (validationStatus === 'warning') {
                setValidationStatus('success');
            }
        }
        return updatedFiles; // Return the potentially modified files

    }, [validationIssues, validationStatus]); // Dependencies

    // --- Hook Return Value ---
    return {
        parsedFiles,          // Current list of parsed file objects
        rawDescription,       // Extracted non-code text
        validationStatus,     // Current validation status ('idle', 'validating', 'success', 'warning', 'error')
        validationIssues,     // Array of detected validation issues
        isParsing,            // Boolean indicating if parsing/validation is in progress
        parseAndValidateResponse, // Function to trigger parsing and validation
        autoFixIssues,        // Function to attempt auto-fixing
        setParsedFiles,       // Setter to allow external updates (e.g., after swap)
        setValidationStatus,  // Setter to allow external reset
        setValidationIssues,  // Setter to allow external clearing
    };
}