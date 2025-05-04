"use client"

import { useState, useCallback, useMemo } from 'react';
import { useAppToast } from '@/hooks/useAppToast'; // Use toast hook
import { debugLogger as logger } from '@/lib/debugLogger'; // Use logger
import { detectFilePaths, getFileExtension } from '@/lib/codeUtils';

// --- Types ---
export type ValidationStatus = 'idle' | 'validating' | 'success' | 'warning' | 'error';

export type IssueType =
  | 'parseError'
  | 'missingPath'
  | 'missingCodeBlock'
  | 'duplicatePath'
  | 'invalidExtension'
  | 'useClientMissing'
  | 'importReactMissing'
  | 'badIconName' // Legacy fa icon found
  | 'skippedComment' // Found '// ..'
  | 'skippedCodeBlock' // Found '/* ... */'
  | 'sneakyEmptyBlock' // Found '{ /* ... */ }' - NEW
  | 'incorrectFa6IconName' // Known incorrect Fa6 name
  | 'unknownFa6IconName'; // Unknown Fa6 name

export interface ValidationIssue {
    id: string;
    fileId: string; // Link to the specific file entry
    filePath: string; // Store path for easier grouping/display
    type: IssueType;
    message: string;
    severity: 'error' | 'warning' | 'info';
    fixable: boolean; // Can be fixed automatically by the hook
    restorable: boolean; // Can be potentially restored by CodeRestorer
    details?: Record<string, any>; // e.g., { lineNumber: 5, badName: 'FaCog' } or { lineNumber: 10, markerLineContent: '/* ... */' }
}

export interface FileEntry {
    id: string; // Unique ID for React key prop, e.g., path + index
    path: string;
    content: string;
    extension: string | null;
}

// --- Constants ---
// Regex for simple 3-dot marker inside comments or braces
const SKIPPED_CODE_MARKER_REGEX = /(\/\*\s*\.{3}\s*\*\/)|({\s*\/\*\s*\.{3}\s*\*\/\s*})|(\[\s*\/\*\s*\.{3}\s*\*\/\s*\])/;
const SKIPPED_COMMENT_MARKER_REGEX = /\/\/\s*\.{2}\s*/; // Just two dots for simple comments
// --- NEW: Regex for sneaky empty blocks ---
const SNEAKY_EMPTY_BLOCK_REGEX = /{[\s\n]*\/\*\s*\.{3}\s*\*\/\s*[\s\n]*}/g;

// Map for known Fa6 corrections
const fa6IconCorrectionMap: Record<string, string> = {
    FaExclamationTriangle: 'FaTriangleExclamation',
    FaBalanceScale: 'FaScaleBalanced',
    FaTools: 'FaToolbox',
    FaUserCog: 'FaUserGear',
    FaProjectDiagram: 'FaDiagramProject',
    FaCog: 'FaGear',
    FaUserCircle: 'FaCircleUser',
    FaTimesCircle: 'FaCircleXmark',
    FaMapSigns: 'FaMapLocation',
    FaRunning: 'FaPersonRunning',
    FaSadTear: 'FaFaceSadTear',
    FaSearchDollar: 'FaMagnifyingGlassDollar',
};
const knownIncorrectFa6Names = Object.keys(fa6IconCorrectionMap);

// Full list of valid Fa6 icons (using the one from VibeContentRenderer for consistency)
// Assume validFa6Icons Set is populated similarly to VibeContentRenderer's iconNameMap keys (PascalCase)
// Example (should be the full list):
const validFa6Icons = new Set<string>([ "Fa42Group", "Fa500Px", /* ... include all Fa6 names ... */ "FaToolbox", "FaRegWindowRestore"]);

const importChecks = [
    { name: 'motion', usageRegex: /<motion\./, importRegex: /import .* from ['"]framer-motion['"]/, importStatement: `import { motion } from "framer-motion";` },
    { name: 'clsx', usageRegex: /clsx\(/, importRegex: /import clsx from ['"]clsx['"]/, importStatement: `import clsx from "clsx";` },
    { name: 'React', usageRegex: /React\.(useState|useEffect|useRef|useContext|useCallback|useMemo|Fragment|createElement)/, importRegex: /import\s+(\*\s+as\s+React|React(?:,\s*\{[^}]*\})?)\s+from\s+['"]react['"]/, importStatement: `import React from "react";` }
];
const clientHookPatterns = /(useState|useEffect|useRef|useContext|useReducer|useCallback|useMemo|useLayoutEffect|useImperativeHandle|useDebugValue)\s*\(/;

const pathCommentRegex = /^\s*(?:\/\/|\/\*|--|#)\s*([\w\-\/\.\[\]]+?\.\w+)/;

const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

// --- Custom Hook ---
export function useCodeParsingAndValidation() {
    logger.debug("[useCodeParsingAndValidation] Hook initialized");
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useAppToast(); // Use toast hook
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
    const [rawDescription, setRawDescription] = useState<string>(""); // Store text outside code blocks
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string, parseErrors: ValidationIssue[] } => {
        logger.debug("[Parse Logic] Starting parseFilesFromText");
        const files: FileEntry[] = [];
        const parseErrors: ValidationIssue[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$)\n*)?^\s*```(\w+)?\n([\s\S]*?)\n^\s*```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$))?/gm;
        let match;
        let fileCounter = 0;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            fileCounter++;
            const currentMatchIndex = match.index;
            if (currentMatchIndex > lastIndex) {
                descriptionParts.push(text.substring(lastIndex, currentMatchIndex).trim());
            }
            lastIndex = codeBlockRegex.lastIndex;

            let path = (match[1] || match[4] || `unnamed-${fileCounter}`).trim();
            let content = match[3].trim();
            let lang = match[2] || '';
            let extension = path.split('.').pop()?.toLowerCase() || lang || 'txt';

            if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0]?.trimStart();
                if (potentialPathLine) {
                    const pathMatch = potentialPathLine.match(pathCommentRegex);
                    if (pathMatch && pathMatch[1]) {
                        path = pathMatch[1].trim();
                        content = lines.slice(1).join('\n').trim();
                        extension = path.split('.').pop()?.toLowerCase() || lang || 'txt';
                         logger.debug(`[Parse Logic] Extracted path "${path}" from comment.`);
                    }
                }
            }
            if (path !== '/') path = path.replace(/^[\/\\]+/, '');

            if (content.includes('```')) {
                 const fileId = generateId();
                 logger.warn(`[Parse Logic] Nested code block detected in potential file: ${path}. Adding parse error.`);
                 parseErrors.push({ id: generateId(), fileId: fileId, filePath: path || `parse-error-${fileId}`, type: 'parseError', message: `Обнаружен вложенный блок кода (\`\`\`). Разбор может быть некорректным.`, details: { lineNumber: -1 }, fixable: false, restorable: false, severity: 'error' });
            }
            files.push({ id: generateId(), path, content, extension });
             logger.debug(`[Parse Logic] Parsed file ${fileCounter}: Path=${path}, Ext=${extension}, Content Length=${content.length}`);
        }
        if (lastIndex < text.length) { descriptionParts.push(text.substring(lastIndex).trim()); }
        const description = descriptionParts.filter(Boolean).join('\n\n');
         logger.debug(`[Parse Logic] Finished parsing. Files: ${files.length}, Errors: ${parseErrors.length}, Desc Length: ${description.length}`);
        return { files, description, parseErrors };
    }, [logger]); // Added logger dependency


    // --- Validation Logic ---
    const validateParsedFiles = useCallback(async (filesToValidate: FileEntry[]): Promise<ValidationIssue[]> => {
        logger.debug("[Validation Logic] Starting validateParsedFiles");
        setValidationStatus('validating');
        const issues: ValidationIssue[] = [];

        for (const file of filesToValidate) {
            if (file.path.startsWith('unnamed-') || file.path.startsWith('parse-error-')) {
                logger.debug(`[Validation Logic] Skipping validation for placeholder file: ${file.path}`);
                continue;
            }
            logger.debug(`[Validation Logic] Validating file: ${file.path}`);
            const lines = file.content.split('\n');
            const fileId = file.id;
            const filePath = file.path;

            // .. 1. Legacy Icon Check - Removed as we focus on Fa6 now

             // .. 2. Fa6 Icon Checks
              logger.debug(`[Validation Logic - ${filePath}] Checking for Fa6 icons...`);
             const fa6ImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-icons\/fa6['"];?/g;
             let fa6Match;
             while ((fa6Match = fa6ImportRegex.exec(file.content)) !== null) {
                 const importList = fa6Match[1];
                 const importLineNumber = file.content.substring(0, fa6Match.index).split('\n').length;
                 const importedFa6IconsRaw = importList.split(',').map(i => i.trim()).filter(Boolean);
                  logger.debug(`[Validation Logic - ${filePath}] Found Fa6 import line ${importLineNumber}: ${importedFa6IconsRaw.join(', ')}`);

                 importedFa6IconsRaw.forEach(rawImport => {
                     const iconName = rawImport.split(/\s+as\s+/)[0].trim();
                     if (!iconName) return;

                     if (knownIncorrectFa6Names.includes(iconName)) {
                         const correctName = fa6IconCorrectionMap[iconName];
                         logger.warn(`[Validation Logic - ${filePath}] Found incorrect Fa6 icon name: ${iconName} -> ${correctName}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'incorrectFa6IconName', message: `Некорректное имя иконки: '${iconName}'. Исправить на '${correctName}'?`, details: { lineNumber: importLineNumber, incorrectName: iconName, correctName: correctName, importStatement: fa6Match[0] }, fixable: true, severity: 'warning' });
                     }
                     else if (!validFa6Icons.has(iconName)) {
                         logger.error(`[Validation Logic - ${filePath}] Found unknown/invalid Fa6 icon name: ${iconName}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'unknownFa6IconName', message: `Неизвестная/несуществующая иконка Fa6: '${iconName}'. Проверьте имя или замените.`, details: { lineNumber: importLineNumber, unknownName: iconName, importStatement: fa6Match[0] }, fixable: false, severity: 'error' });
                     }
                 });
             }


            // .. 3. "use client" Check
             logger.debug(`[Validation Logic - ${filePath}] Checking for "use client"...`);
            if (/\.(tsx|jsx)$/.test(filePath)) {
                 const firstRealLineIndex = lines.findIndex(line => line.trim() !== '');
                 const firstRealLine = firstRealLineIndex !== -1 ? lines[firstRealLineIndex].trim() : null;
                 const hasUseClient = firstRealLine === '"use client";' || firstRealLine === "'use client';";
                 const usesClientFeatures = clientHookPatterns.test(file.content) || /on[A-Z][a-zA-Z]*\s*=\s*{/.test(file.content);
                 logger.debug(`[Validation Logic - ${filePath}] useClient check: hasDirective=${hasUseClient}, usesFeatures=${usesClientFeatures}`);

                 if (!hasUseClient && usesClientFeatures) {
                      let firstUsageLine = -1;
                      const hookMatch = clientHookPatterns.exec(file.content);
                      const eventMatch = /on[A-Z][a-zA-Z]*\s*=\s*{/.exec(file.content);
                      if (hookMatch || eventMatch) {
                          const searchIndex = Math.min(hookMatch?.index ?? Infinity, eventMatch?.index ?? Infinity);
                          if (searchIndex !== Infinity) { firstUsageLine = (file.content.substring(0, searchIndex).match(/\n/g) || []).length + 1; }
                      }
                      const featureName = hookMatch?.[1] ?? (eventMatch ? 'event handler' : 'client feature');
                      logger.warn(`[Validation Logic - ${filePath}] Missing "use client" detected. First usage: ${featureName} around line ${firstUsageLine}`);
                     issues.push({ id: generateId(), fileId, filePath, type: 'useClientMissing', message: `Found ${featureName} without "use client".`, details: { lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning' });
                 }
             }

            // .. 4. Skipped Code Block Check
             logger.debug(`[Validation Logic - ${filePath}] Checking for skipped code blocks...`);
            for (let i = 0; i < lines.length; i++) {
                if (SKIPPED_CODE_MARKER_REGEX.test(lines[i].trimStart())) {
                    logger.warn(`[Validation Logic - ${filePath}] Found skipped code block at line ${i + 1}`);
                    issues.push({ id: generateId(), fileId, filePath, type: 'skippedCodeBlock', message: `Skipped code block (line ${i + 1}). Can attempt restore.`, details: { markerLineContent: lines[i], lineNumber: i + 1 }, fixable: false, restorable: true, severity: 'warning' });
                }
            }

            // .. 5. Skipped Comment Check
             logger.debug(`[Validation Logic - ${filePath}] Checking for skipped comments...`);
            for (let i = 0; i < lines.length; i++) {
                const trimmedLine = lines[i].trimStart();
                if (SKIPPED_COMMENT_MARKER_REGEX.test(trimmedLine)) {
                     logger.warn(`[Validation Logic - ${filePath}] Found skipped comment at line ${i + 1}`);
                     issues.push({ id: generateId(), fileId, filePath, type: 'skippedComment', message: `Skipped comment '// ..'.' (line ${i + 1}). Needs manual review.`, details: { lineNumber: i + 1 }, fixable: false, restorable: false, severity: 'warning' });
                 }
            }

            // .. 6. Import Checks
             logger.debug(`[Validation Logic - ${filePath}] Checking for missing imports...`);
            if (/\.(tsx|jsx)$/.test(filePath)) {
                importChecks.forEach(check => {
                    if (check.usageRegex.test(file.content) && !check.importRegex.test(file.content)) {
                         let firstUsageLine = -1;
                         const usageMatch = check.usageRegex.exec(file.content);
                         if (usageMatch) { firstUsageLine = (file.content.substring(0, usageMatch.index).match(/\n/g) || []).length + 1; }
                         logger.warn(`[Validation Logic - ${filePath}] Missing import detected: ${check.name} used around line ${firstUsageLine}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'importReactMissing', message: `Using '${check.name}' but import is missing.`, details: { name: check.name, importStatement: check.importStatement, lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning' });
                    }
                });
            }

            // .. 7. Sneaky Empty Block Check - NEW
            logger.debug(`[Validation Logic - ${filePath}] Checking for sneaky empty blocks...`);
            let sneakyMatch;
            while((sneakyMatch = SNEAKY_EMPTY_BLOCK_REGEX.exec(file.content)) !== null) {
                 const sneakyLineNum = file.content.substring(0, sneakyMatch.index).split('\n').length;
                 logger.error(`[Validation Logic - ${filePath}] Found sneaky empty block at line ${sneakyLineNum}: ${sneakyMatch[0]}`);
                 issues.push({ id: generateId(), fileId, filePath, type: 'sneakyEmptyBlock', message: 'Найден пустой блок с маркером пропуска "{ /* ... */ }". Это скорее всего ошибка AI, удалите блок или замените кодом.', details: {lineNumber: sneakyLineNum }, fixable: false, restorable: false, severity: 'error' });
            }
            // .. End NEW Check


             logger.debug(`[Validation Logic] Finished validating file: ${filePath}. Issues found: ${issues.filter(i => i.filePath === filePath).length}`);
        } // End loop through files

        // .. Duplicate Path Check
        const pathCounts = new Map<string, number>();
        filesToValidate.forEach(file => {
             if (file.path && !file.path.startsWith('unnamed-')) {
                  pathCounts.set(file.path, (pathCounts.get(file.path) || 0) + 1);
             }
        });
        pathCounts.forEach((count, path) => {
             if (count > 1) {
                 const duplicateFileIds = filesToValidate.filter(f => f.path === path).map(f => f.id);
                 duplicateFileIds.forEach(fid => {
                      issues.push({ id: generateId(), fileId: fid, filePath: path, type: 'duplicatePath', message: `Дублирующийся путь файла: "${path}".`, severity: 'error', fixable: false, restorable: false });
                 });
             }
        });


        setValidationIssues(issues);
        if (issues.length > 0) {
            const hasErrors = issues.some(issue => issue.severity === 'error');
            const hasWarnings = issues.some(issue => issue.severity === 'warning');
            const finalStatus = hasErrors ? 'error' : (hasWarnings ? 'warning' : 'success'); // Status reflects highest severity
             logger.info(`[Validation Logic] Validation finished. Total issues: ${issues.length}. Status set to: ${finalStatus}`);
            setValidationStatus(finalStatus);
        } else {
             logger.info("[Validation Logic] Validation finished. No issues found. Status: success");
            setValidationStatus('success');
        }
        return issues;
    }, [logger]); // Added logger dependency


     const parseAndValidateResponse = useCallback(async (response: string) => {
        logger.info("[Parse/Validate Trigger] Starting parseAndValidateResponse...");
        setIsParsing(true); setValidationStatus('idle'); setValidationIssues([]); setParsedFiles([]); setRawDescription("");
        if (!response.trim()) {
            toastInfo("Поле ответа пусто.");
            setIsParsing(false);
            logger.warn("[Parse/Validate Trigger] Aborted: Empty response field.");
            return { files: [], description: "", issues: [] };
         }

        try {
            const { files, description, parseErrors } = parseFilesFromText(response);
            setParsedFiles(files); setRawDescription(description);
            let validationIssuesResult: ValidationIssue[] = [];
            if (files.length > 0) {
                toastInfo(`${files.length} файлов найдено. Запуск проверки...`, { duration: 1500 });
                validationIssuesResult = await validateParsedFiles(files);
            } else {
                toastInfo("В ответе не найдено файлов кода для разбора.");
                setValidationStatus('idle');
                 logger.info("[Parse/Validate Trigger] No code files found in the response.");
            }

            const allIssues = [...parseErrors, ...validationIssuesResult];
            setValidationIssues(allIssues);
             logger.info(`[Parse/Validate Trigger] Combined issues: ${allIssues.length} (Parse: ${parseErrors.length}, Validation: ${validationIssuesResult.length})`);

            if (allIssues.length > 0) {
                const hasErrors = allIssues.some(issue => issue.severity === 'error');
                const hasWarnings = allIssues.some(issue => issue.severity === 'warning');
                const finalStatus = hasErrors ? 'error' : (hasWarnings ? 'warning' : 'success');
                setValidationStatus(finalStatus);
                 logger.info(`[Parse/Validate Trigger] Issues found. Final validation status: ${finalStatus}`);
            } else if (files.length > 0) {
                setValidationStatus('success');
                 logger.info("[Parse/Validate Trigger] No issues found. Final validation status: success");
            } else {
                setValidationStatus('idle');
                 logger.info("[Parse/Validate Trigger] No files and no issues. Final validation status: idle");
            }
            setIsParsing(false);
             logger.info("[Parse/Validate Trigger] Finished parseAndValidateResponse.");
            return { files, description, issues: allIssues };
         } catch (error) {
             logger.error("[Parse/Validate Trigger] Critical error during parsing/validation:", error);
             toastError("Критическая ошибка при разборе ответа.");
             setIsParsing(false); setValidationStatus('error');
             const genericError: ValidationIssue = { id: generateId(), fileId: 'general', filePath: 'N/A', type: 'parseError', message: `Критическая ошибка разбора: ${error instanceof Error ? error.message : String(error)}`, details: null, fixable: false, restorable: false, severity: 'error' };
             setValidationIssues([genericError]);
             return { files: [], description: rawDescription, issues: [genericError] };
         }
    }, [parseFilesFromText, validateParsedFiles, rawDescription, toastInfo, toastError, logger]); // Added logger


    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
         logger.info("[AutoFix Logic] Starting autoFixIssues...");
        let changesMadeCount = 0; const fixedMessages: string[] = [];
        const fixableIssues = issuesToFix.filter(issue => issue.fixable);

        if (fixableIssues.length === 0) {
             toastInfo("Не найдено проблем для автоматического исправления.");
              logger.info("[AutoFix Logic] No fixable issues found.");
             return filesToFix;
        }
         logger.debug(`[AutoFix Logic] Found ${fixableIssues.length} potentially fixable issues.`);

        const updatedFilesMap = new Map(filesToFix.map(f => [f.id, f.content]));

        filesToFix.forEach(file => {
            let currentContent = updatedFilesMap.get(file.id) ?? file.content;
            let fileChanged = false;
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);
             logger.debug(`[AutoFix Logic - ${file.path}] Processing ${fileIssues.length} fixable issues.`);
            if (fileIssues.length === 0) return;

            fileIssues.forEach(issue => {
                try {
                     logger.debug(`[AutoFix Logic - ${file.path}] Attempting to fix issue type: ${issue.type}`);
                    let contentBeforeFix = currentContent;
                    // .. 1. NEW: Fix incorrect Fa6 icon names
                    if (issue.type === 'incorrectFa6IconName' && issue.details?.incorrectName && issue.details?.correctName && issue.details?.importStatement) {
                         const incorrectName = issue.details.incorrectName; const correctName = issue.details.correctName; const importLine = issue.details.importStatement; const lines = currentContent.split('\n'); const importLineIndex = lines.findIndex(line => line.includes(importLine));
                         if (importLineIndex !== -1) {
                             const nameRegex = new RegExp(`\\b${incorrectName}\\b`, 'g'); const originalLine = lines[importLineIndex]; const modifiedLine = originalLine.replace(nameRegex, correctName);
                             if (modifiedLine !== originalLine) { lines[importLineIndex] = modifiedLine; currentContent = lines.join('\n'); fixedMessages.push(`✅ Fa6 Иконка: ${incorrectName} -> ${correctName} в ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Fixed Fa6 icon: ${incorrectName} -> ${correctName}`); }
                             else { logger.warn(`[AutoFix Logic - ${file.path}] Fa6 icon regex did not match: ${incorrectName} in "${originalLine}"`); }
                         } else { logger.warn(`[AutoFix Logic - ${file.path}] Could not find Fa6 import line: "${importLine}"`); }
                    // .. 2. Fix legacy icons (removed as not present in ValidationIssue types anymore)
                    // } else if (issue.type === 'iconLegacy' && issue.details?.badIcon && issue.details?.goodIcon) {
                        // ... logic removed ...
                    // .. 3. Fix "use client"
                    } else if (issue.type === 'useClientMissing') {
                        const lines = currentContent.split('\n'); let firstCodeLineIndex = -1;
                        for (let i = 0; i < lines.length; i++) { const trimmedLine = lines[i].trim(); if (trimmedLine !== '' && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) { firstCodeLineIndex = i; break; } }
                        const alreadyHasUseClient = firstCodeLineIndex !== -1 && (lines[firstCodeLineIndex] === '"use client";' || lines[firstCodeLineIndex] === "'use client';");
                        if (!alreadyHasUseClient) { const insertIndex = firstCodeLineIndex !== -1 ? firstCodeLineIndex : 0; const newLineChar = insertIndex === 0 || (firstCodeLineIndex !== -1 && lines[insertIndex].trim() !== '') ? '\n' : ''; lines.splice(insertIndex, 0, '"use client";' + newLineChar); currentContent = lines.join('\n'); fixedMessages.push(`✅ Added "use client"; to ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Added "use client"`); }
                    // .. 4. Fix missing imports
                    } else if (issue.type === 'importReactMissing' && issue.details?.importStatement && issue.details?.importRegex) {
                        const importRegex: RegExp = issue.details.importRegex;
                        if (!importRegex.test(currentContent)) {
                            const lines = currentContent.split('\n'); let insertIndex = 0; let useClientIndex = -1;
                             for (let i = 0; i < lines.length; i++) { const tl = lines[i].trim(); if (tl === '"use client";' || tl === "'use client';") { useClientIndex = i; insertIndex = i + 1; } else if (tl.startsWith('import ')) { insertIndex = i + 1; } else if (tl !== '' && !tl.startsWith('//') && !tl.startsWith('/*')) { if (insertIndex === 0 && useClientIndex === -1) insertIndex = 0; break; } }
                             const prefixNewLine = (useClientIndex !== -1 || insertIndex > 0) && lines[insertIndex]?.trim() !== '' ? '\n' : '';
                             lines.splice(insertIndex, 0, prefixNewLine + issue.details.importStatement); currentContent = lines.join('\n'); fixedMessages.push(`✅ Added import for '${issue.details.name}' to ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Added import for ${issue.details.name}`);
                        }
                    }

                     if (contentBeforeFix !== currentContent) { fileChanged = true; }

                 } catch (fixError) {
                      logger.error(`[AutoFix Logic - ${file.path}] Error auto-fixing issue ${issue.id} (${issue.type}):`, fixError);
                      toastError(`Ошибка исправления ${issue.type} в ${file.path}`);
                 }
            }); // End forEach issue in file

            if (fileChanged) {
                 logger.debug(`[AutoFix Logic - ${file.path}] Content updated.`);
                 updatedFilesMap.set(file.id, currentContent);
                 changesMadeCount++;
            } else {
                 logger.debug(`[AutoFix Logic - ${file.path}] No changes made for fixable issues.`);
            }
        }); // End map through filesToFix

        // --- Final Update and Re-validation ---
        if (changesMadeCount > 0) {
             logger.info(`[AutoFix Logic] ${changesMadeCount} file(s) updated. Re-validating...`);
            const updatedFilesArray = filesToFix.map(f => ({ ...f, content: updatedFilesMap.get(f.id) ?? f.content }));
            setParsedFiles(updatedFilesArray);
            fixedMessages.forEach(msg => toastSuccess(msg, { duration: 4000 }));
            validateParsedFiles(updatedFilesArray); // Re-validate AFTER fixing
            return updatedFilesArray;
        } else {
            if (fixableIssues.length > 0) {
                 toastWarning("Авто-исправление было запущено, но не внесло изменений. Возможно, проблемы уже исправлены или логика фиксации нуждается в проверке.");
                  logger.warn("[AutoFix Logic] Autofix ran but made no changes despite fixable issues.");
            } else {
                 logger.info("[AutoFix Logic] No changes made (no fixable issues to address).");
            }
            // Re-evaluate status based on remaining issues after attempted fix
            const remainingIssues = issuesToFix.filter(issue => !fixableIssues.some(fi => fi.id === issue.id && fi.fixable === true) || !updatedFilesMap.has(issue.fileId));
            const nonFixableOrRestorable = remainingIssues.some(i => !i.fixable && !i.restorable);
            if (validationStatus === 'warning' && !nonFixableOrRestorable) {
                logger.info("[AutoFix Logic] All remaining issues are restorable/informational, setting status to success.");
                setValidationStatus('success');
            } else if (remainingIssues.length === 0) {
                 logger.info("[AutoFix Logic] No issues remaining after attempt, setting status to success.");
                 setValidationStatus('success');
            }
            return filesToFix;
        }
    }, [validationIssues, validationStatus, validateParsedFiles, setParsedFiles, toastInfo, toastSuccess, toastError, toastWarning, logger]); // Added logger


     logger.debug("[useCodeParsingAndValidation] Hook setup complete.");
    return {
        parsedFiles,
        rawDescription,
        validationStatus,
        validationIssues,
        isParsing,
        parseAndValidateResponse,
        autoFixIssues,
        // Expose setters if AICodeAssistant needs to manipulate them directly (less ideal)
        setHookParsedFiles: setParsedFiles, // Renamed for clarity
        setValidationStatus,
        setValidationIssues,
        setIsParsing, // Allow parent to control parsing state if needed externally
        setRawDescription
    };
}