// /hooks/useCodeParsingAndValidation.ts
"use client"

import { useState, useCallback, useMemo } from 'react';
import { useAppToast } from '@/hooks/useAppToast'; 
import { debugLogger as logger } from '@/lib/debugLogger'; 
import { getFileExtension } from '@/lib/codeUtils'; // getFileExtension is in codeUtils
import * as Fa6Icons from "react-icons/fa6"; 

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
  | 'skippedComment' 
  | 'skippedCodeBlock' 
  | 'sneakyEmptyBlock' 
  | 'incorrectFa6IconName' 
  | 'unknownFa6IconName';

export interface ValidationIssue {
    id: string;
    fileId: string; 
    filePath: string; 
    type: IssueType;
    message: string;
    severity: 'error' | 'warning' | 'info';
    fixable: boolean; 
    restorable: boolean; 
    details?: Record<string, any>; 
}

export interface FileEntry {
    id: string; 
    path: string;
    content: string;
    extension: string | null;
}

// --- Constants ---
const FILE_PATH_REGEX = /^(?:[\w-]+\/)*[\w-]+\.\w+/; 
const USE_CLIENT_REGEX = /^\s*['"]use client['"]\s*;?\s*$/;
const IMPORT_REACT_REGEX = /import\s+(?:React(?:,\s*{[^}]*})?|{[^}]*\s+React\s*,\s*[^}]*})\s+from\s+['"]react['"]/;
const FA6_ICON_REGEX = /<Fa[A-Z][a-zA-Z0-9]+(?:\s+[^>]*?)?\s*\/?>/g; 
const SNEAKY_EMPTY_BLOCK_REGEX = /{[\s\n]*\/\*\s*\.{3}\s*\*\/\s*[\s\n]*}/g;
const SKIPPED_CODE_MARKER_REGEX = /(\/\*\s*\.{3}\s*\*\/)|({\s*\/\*\s*\.{3}\s*\*\/\s*})|(\[\s*\/\*\s*\.{3}\s*\*\/\s*\])/;
const SKIPPED_COMMENT_MARKER_REGEX = /^\s*\/\/\s*\.{3}\s*$/;

const fa6IconCorrectionMap: Record<string, string> = {
    FaExclamationTriangle: 'FaTriangleExclamation',
    FaBalanceScale: 'FaScaleBalanced',
    FaTools: 'FaToolbox',
    FaUserCog: 'FaUserGear',
    FaSlidersH: 'FaSliders', 
    FaCheckSquare: 'FaSquareCheck', 
    FaProjectDiagram: 'FaDiagramProject',
    FaCog: 'FaGear',
    FaUserCircle: 'FaCircleUser',
    FaTimesCircle: 'FaCircleXmark',
    FaInfoCircle: 'FaCircleInfo',
    FaMapSigns: 'FaMapLocation',
    FaRunning: 'FaPersonRunning',
    FaSadTear: 'FaFaceSadTear',
    FaSearchDollar: 'FaMagnifyingGlassDollar',
    FaSignOutAlt: 'FaRightFromBracket',
    FaBroadcastTower: 'FaMagnifyingGlassDollar',
};
const knownIncorrectFa6Names = Object.keys(fa6IconCorrectionMap);

const importChecks = [
    { name: 'motion', usageRegex: /<motion\./, importRegex: /import .* from ['"]framer-motion['"]/, importStatement: `import { motion } from "framer-motion";` },
    { name: 'clsx', usageRegex: /clsx\(/, importRegex: /import clsx from ['"]clsx['"]/, importStatement: `import clsx from "clsx";` },
    { name: 'React', usageRegex: /React\.(useState|useEffect|useRef|useContext|useCallback|useMemo|Fragment|createElement)/, importRegex: /import\s+(\*\s+as\s+React|React(?:,\s*\{[^}]*\})?)\s+from\s+['"]react['"]/, importStatement: `import React from "react";` }
];
const clientHookPatterns = /(useState|useEffect|useRef|useContext|useReducer|useCallback|useMemo|useLayoutEffect|useImperativeHandle|useDebugValue)\s*\(/;

// Regex to capture file paths, potentially starting with '.', in comments or as 'File: path'
// Allows for paths like .github/workflows/file.yml or normal paths.
// FIX: Added '[]' to character sets to correctly parse paths like /app/rent/[id]/page.tsx
const pathCommentRegex = /^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([./\w\-\[\]]+(?:[/\\][.\w\-\[\]]+)*\.\w+)/;

const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

export function useCodeParsingAndValidation() {
    logger.debug("[useCodeParsingAndValidation] Hook initialized");
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useAppToast(); 
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
    const [rawDescription, setRawDescription] = useState<string>(""); 
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string, parseErrors: ValidationIssue[] } => {
        logger.debug("[Parse Logic] Starting parseFilesFromText");
        const files: FileEntry[] = [];
        const parseErrors: ValidationIssue[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        // Regex to capture file path possibly before or after code block.
        // FIX: Added '[]' to character sets to correctly parse paths like /app/rent/[id]/page.tsx
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([./\w\-\[\]]+(?:[/\\][.\w\-\[\]]+)*\.\w+)\s*(?:\*\/)?\s*$)\n*)?^\s*```(\w+)?\n([\s\S]*?)\n^\s*```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([./\w\-\[\]]+(?:[/\\][.\w\-\[\]]+)*\.\w+)\s*(?:\*\/)?\s*$))?/gm;

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
            let extension = getFileExtension(path) || lang || 'txt'; 

            if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0]?.trimStart();
                if (potentialPathLine) {
                    const pathMatch = potentialPathLine.match(pathCommentRegex);
                    if (pathMatch && pathMatch[1]) {
                        path = pathMatch[1].trim();
                        content = lines.slice(1).join('\n').trim();
                        extension = getFileExtension(path) || lang || 'txt';
                         logger.debug(`[Parse Logic] Extracted path "${path}" from comment.`);
                    }
                }
            }
            
            // Normalize path: remove leading slashes for consistency, unless it's the root path itself.
            if (path !== '/' && (path.startsWith('/') || path.startsWith('\\'))) {
                path = path.substring(1);
            }

            if (/^\s*```/m.test(content)) {
                 const fileId = generateId();
                 logger.warn(`[Parse Logic] Nested code block marker (\`\`\`) found at the start of a line within the content of potential file: ${path}. Adding parse error.`);
                 parseErrors.push({ id: generateId(), fileId: fileId, filePath: path || `parse-error-${fileId}`, type: 'parseError', message: `Обнаружен маркер начала/конца блока кода (\`\`\`) внутри другого блока кода. Разбор может быть некорректным.`, details: { lineNumber: -1 }, fixable: false, restorable: false, severity: 'error' });
            }
            files.push({ id: generateId(), path, content, extension });
             logger.debug(`[Parse Logic] Parsed file ${fileCounter}: Path=${path}, Ext=${extension}, Content Length=${content.length}`);
        }
        if (lastIndex < text.length) { descriptionParts.push(text.substring(lastIndex).trim()); }
        const description = descriptionParts.filter(Boolean).join('\n\n');
         logger.debug(`[Parse Logic] Finished parsing. Files: ${files.length}, Errors: ${parseErrors.length}, Desc Length: ${description.length}`);
        return { files, description, parseErrors };
    }, []); 

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

              logger.debug(`[Validation Logic - ${filePath}] Checking for Fa6 icons...`);
             const fa6ImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-icons\/fa6['"];?/g;
             let fa6Match;
             while ((fa6Match = fa6ImportRegex.exec(file.content)) !== null) {
                 const importList = fa6Match[1];
                 const importLineNumber = file.content.substring(0, fa6Match.index).split('\n').length;
                 const importedFa6IconsRaw = importList.split(',').map(i => i.trim()).filter(Boolean);
                  logger.debug(`[Validation Logic - ${filePath}] Found Fa6 import line ${importLineNumber}: ${importedFa6IconsRaw.join(', ')}`);

                 importedFa6IconsRaw.forEach(rawImport => {
                     const cleanedImportName = rawImport.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim(); 
                     if (!cleanedImportName) return; 

                     const iconName = cleanedImportName.split(/\s+as\s+/)[0].trim(); 
                     if (!iconName) return;

                     if (knownIncorrectFa6Names.includes(iconName)) {
                         const correctName = fa6IconCorrectionMap[iconName];
                         logger.warn(`[Validation Logic - ${filePath}] Found incorrect Fa6 icon name: ${iconName} -> ${correctName}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'incorrectFa6IconName', message: `Некорректное имя иконки: '${iconName}'. Исправить на '${correctName}'?`, details: { lineNumber: importLineNumber, incorrectName: iconName, correctName: correctName, importStatement: fa6Match[0] }, fixable: true, severity: 'warning', restorable: false });
                     }
                     else if (!(iconName in Fa6Icons)) {
                         logger.warn(`[Validation Logic - ${filePath}] Found unknown/invalid Fa6 icon name: ${iconName}`); 
                         issues.push({ id: generateId(), fileId, filePath, type: 'unknownFa6IconName', message: `Неизвестная/несуществующая иконка Fa6: '${iconName}'. Проверьте имя или импортируйте из правильного пакета (например, 'react-icons/fa' вместо 'react-icons/fa6', или наоборот).`, details: { lineNumber: importLineNumber, unknownName: iconName, importStatement: fa6Match[0] }, fixable: false, severity: 'warning', restorable: false });
                     }
                 });
             }

            logger.debug(`[Validation Logic - ${filePath}] Checking for "use client"...`);
            if (/\.(tsx|jsx)$/.test(filePath)) {
                const isAppLayoutFile = /^app\/.*layout\.(tsx|jsx)$/.test(filePath);
                if (isAppLayoutFile) {
                    logger.info(`[Validation Logic - ${filePath}] Skipping "use client" check for App Router layout file.`);
                } else {
                    const firstRealLineIndex = lines.findIndex(line => line.trim() !== '');
                    const firstRealLine = firstRealLineIndex !== -1 ? lines[firstRealLineIndex].trim() : null;
                    const hasUseClient = firstRealLine === '"use client";' || firstRealLine === "'use client';" || firstRealLine === '"use client"' || firstRealLine === "'use client'";
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
                        issues.push({ id: generateId(), fileId, filePath, type: 'useClientMissing', message: `Found ${featureName} without "use client".`, details: { lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning', restorable: false });
                    }
                }
            }

             logger.debug(`[Validation Logic - ${filePath}] Checking for skipped code blocks...`);
            for (let i = 0; i < lines.length; i++) {
                if (SKIPPED_CODE_MARKER_REGEX.test(lines[i].trimStart())) {
                    logger.warn(`[Validation Logic - ${filePath}] Found skipped code block at line ${i + 1}`);
                    issues.push({ id: generateId(), fileId, filePath, type: 'skippedCodeBlock', message: `Пропущен блок кода (строка ${i + 1}). Попросите AI восстановить.`, details: { markerLineContent: lines[i], lineNumber: i + 1 }, fixable: false, restorable: false, severity: 'warning' }); 
                }
            }

             logger.debug(`[Validation Logic - ${filePath}] Checking for skipped comments (// ...)...`);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]; 
                if (SKIPPED_COMMENT_MARKER_REGEX.test(line)) {
                     logger.warn(`[Validation Logic - ${filePath}] Found skipped comment marker at line ${i + 1}`);
                     issues.push({ id: generateId(), fileId, filePath, type: 'skippedComment', message: `Пропущен комментарий '// ...' (строка ${i + 1}). Попросите AI восстановить.`, details: { lineNumber: i + 1 }, fixable: false, restorable: false, severity: 'warning' }); 
                 }
            }

             logger.debug(`[Validation Logic - ${filePath}] Checking for missing imports...`);
            if (/\.(tsx|jsx)$/.test(filePath)) {
                importChecks.forEach(check => {
                    if (check.usageRegex.test(file.content) && !check.importRegex.test(file.content)) {
                         let firstUsageLine = -1;
                         const usageMatch = check.usageRegex.exec(file.content);
                         if (usageMatch) { firstUsageLine = (file.content.substring(0, usageMatch.index).match(/\n/g) || []).length + 1; }
                         logger.warn(`[Validation Logic - ${filePath}] Missing import detected: ${check.name} used around line ${firstUsageLine}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'importReactMissing', message: `Using '${check.name}' but import is missing.`, details: { name: check.name, importStatement: check.importStatement, lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning', restorable: false });
                    }
                });
            }

            logger.debug(`[Validation Logic - ${filePath}] Checking for sneaky empty blocks...`);
            let sneakyMatch;
            while((sneakyMatch = SNEAKY_EMPTY_BLOCK_REGEX.exec(file.content)) !== null) {
                 const sneakyLineNum = file.content.substring(0, sneakyMatch.index).split('\n').length;
                 logger.error(`[Validation Logic - ${filePath}] Found sneaky empty block at line ${sneakyLineNum}: ${sneakyMatch[0]}`);
                 issues.push({ id: generateId(), fileId, filePath, type: 'sneakyEmptyBlock', message: 'Найден пустой блок с маркером пропуска "{ /* ... */ }". Это почти наверняка ошибка AI, удалите блок или замените кодом.', details: {lineNumber: sneakyLineNum }, fixable: false, restorable: false, severity: 'error' });
            }

             logger.debug(`[Validation Logic] Finished validating file: ${filePath}. Issues found: ${issues.filter(i => i.filePath === filePath).length}`);
        } 

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
            const finalStatus = hasErrors ? 'error' : (hasWarnings ? 'warning' : 'success'); 
             logger.info(`[Validation Logic] Validation finished. Total issues: ${issues.length}. Status set to: ${finalStatus}`);
            setValidationStatus(finalStatus);
        } else {
             logger.info("[Validation Logic] Validation finished. No issues found. Status: success");
            setValidationStatus('success');
        }
        return issues;
    }, []); 

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
             const genericError: ValidationIssue = { id: generateId(), fileId: 'general', filePath: 'N/A', type: 'parseError', message: `Критическая ошибка разбора: ${error instanceof Error ? error.message : String(error)}`, details: {}, fixable: false, restorable: false, severity: 'error' };
             setValidationIssues([genericError]);
             return { files: [], description: rawDescription, issues: [genericError] };
         }
    }, [parseFilesFromText, validateParsedFiles, rawDescription, toastInfo, toastError]); 

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
                    if (issue.type === 'incorrectFa6IconName' && issue.details?.incorrectName && issue.details?.correctName && issue.details?.importStatement) {
                         const incorrectName = issue.details.incorrectName; const correctName = issue.details.correctName; const importLine = issue.details.importStatement; const lines = currentContent.split('\n'); const importLineIndex = lines.findIndex(line => line.includes(importLine));
                         if (importLineIndex !== -1) {
                             const nameRegex = new RegExp(`\\b${incorrectName}\\b`, 'g'); const originalLine = lines[importLineIndex]; const modifiedLine = originalLine.replace(nameRegex, correctName);
                             if (modifiedLine !== originalLine) { lines[importLineIndex] = modifiedLine; currentContent = lines.join('\n'); fixedMessages.push(`✅ Fa6 Иконка: ${incorrectName} -> ${correctName} в ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Fixed Fa6 icon: ${incorrectName} -> ${correctName}`); }
                             else { logger.warn(`[AutoFix Logic - ${file.path}] Fa6 icon regex did not match: ${incorrectName} in "${originalLine}"`); }
                         } else { logger.warn(`[AutoFix Logic - ${file.path}] Could not find Fa6 import line: "${importLine}"`); }
                    } else if (issue.type === 'useClientMissing') {
                        const lines = currentContent.split('\n'); let firstCodeLineIndex = -1;
                        for (let i = 0; i < lines.length; i++) { const trimmedLine = lines[i].trim(); if (trimmedLine !== '' && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) { firstCodeLineIndex = i; break; } }
                        const alreadyHasUseClient = firstCodeLineIndex !== -1 && (lines[firstCodeLineIndex] === '"use client";' || lines[firstCodeLineIndex] === "'use client';");
                        if (!alreadyHasUseClient) { const insertIndex = firstCodeLineIndex !== -1 ? firstCodeLineIndex : 0; const newLineChar = insertIndex === 0 || (firstCodeLineIndex !== -1 && lines[insertIndex].trim() !== '') ? '\n' : ''; lines.splice(insertIndex, 0, '"use client";' + newLineChar); currentContent = lines.join('\n'); fixedMessages.push(`✅ Added "use client"; to ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Added "use client"`); }
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
            }); 

            if (fileChanged) {
                 logger.debug(`[AutoFix Logic - ${file.path}] Content updated.`);
                 updatedFilesMap.set(file.id, currentContent);
                 changesMadeCount++;
            } else {
                 logger.debug(`[AutoFix Logic - ${file.path}] No changes made for fixable issues.`);
            }
        }); 

        if (changesMadeCount > 0) {
             logger.info(`[AutoFix Logic] ${changesMadeCount} file(s) updated. Re-validating...`);
            const updatedFilesArray = filesToFix.map(f => ({ ...f, content: updatedFilesMap.get(f.id) ?? f.content }));
            setParsedFiles(updatedFilesArray);
            fixedMessages.forEach(msg => toastSuccess(msg, { duration: 4000 }));
            validateParsedFiles(updatedFilesArray); 
            return updatedFilesArray;
        } else {
            if (fixableIssues.length > 0) {
                 toastWarning("Авто-исправление было запущено, но не внесло изменений. Возможно, проблемы уже исправлены или логика фиксации нуждается в проверке.");
                  logger.warn("[AutoFix Logic] Autofix ran but made no changes despite fixable issues.");
            } else {
                 logger.info("[AutoFix Logic] No changes made (no fixable issues to address).");
            }
            const remainingIssues = issuesToFix.filter(issue => !fixableIssues.some(fi => fi.id === issue.id && fi.fixable === true) || !updatedFilesMap.has(issue.fileId));
            const hasRemainingErrors = remainingIssues.some(i => i.severity === 'error');
            const hasRemainingWarnings = remainingIssues.some(i => i.severity === 'warning');
            const finalStatus = hasRemainingErrors ? 'error' : (hasRemainingWarnings ? 'warning' : 'success');
             logger.info(`[AutoFix Logic] No changes applied. Re-evaluated status based on remaining ${remainingIssues.length} issues: ${finalStatus}`);
            setValidationStatus(finalStatus); 
            return filesToFix;
        }
    }, [validateParsedFiles, setParsedFiles, toastInfo, toastSuccess, toastError, toastWarning]); 

     logger.debug("[useCodeParsingAndValidation] Hook setup complete.");
    return {
        parsedFiles,
        rawDescription,
        validationStatus,
        validationIssues,
        isParsing,
        parseAndValidateResponse,
        autoFixIssues,
        setHookParsedFiles: setParsedFiles, 
        setValidationStatus,
        setValidationIssues,
        setIsParsing, 
        setRawDescription
    };
}
