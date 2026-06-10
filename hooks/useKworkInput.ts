import { useCallback } from "react";
import { useRepoXmlPageContext, FileNode } from "@/contexts/RepoXmlPageContext";
import { useAppContext } from "@/contexts/AppContext";
import { 
    logCyberFitnessAction, 
    checkAndUnlockFeatureAchievement, 
    Achievement,
    TOKEN_ESTIMATION_FACTOR 
} from "@/hooks/cyberFitnessSupabase";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";

interface UseKworkInputProps {
    selectedFetcherFiles: Set<string>;
    allFetchedFiles: FileNode[];
    imageReplaceTaskActive: boolean;
    files: FileNode[]; 
}

interface UseKworkInputReturn {
    handleAddSelected: () => void;
    handleCopyToClipboard: (textToCopy?: string, shouldScroll?: boolean) => boolean;
    handleClearAll: () => void;
    handleAddFullTree: () => void;
    handleInstallAsOneFile: () => Promise<void>;
}

const getFileLanguage = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
        case 'ts': return 'typescript';
        case 'tsx': return 'tsx';
        case 'js': return 'javascript';
        case 'jsx': return 'jsx';
        case 'json': return 'json';
        case 'py': return 'python';
        case 'md': return 'markdown';
        case 'css': return 'css';
        case 'html': return 'html';
        case 'scss': return 'scss';
        case 'less': return 'less';
        case 'java': return 'java';
        case 'kt': return 'kotlin';
        case 'go': return 'go';
        case 'rb': return 'ruby';
        case 'php': return 'php';
        case 'sql': return 'sql';
        case 'yaml':
        case 'yml': return 'yaml';
        case 'sh': return 'bash';
        case 'ps1': return 'powershell';
        case 'xml': return 'xml';
        case 'swift': return 'swift';
        case 'c':
        case 'h': return 'c'; 
        case 'cpp':
        case 'hpp': return 'cpp';
        case 'cs': return 'csharp';
        case 'txt': return 'plaintext';
        default: return 'plaintext';
    }
};

export const useKworkInput = ({
    selectedFetcherFiles,
    allFetchedFiles,
    imageReplaceTaskActive,
    files, 
}: UseKworkInputProps): UseKworkInputReturn => {
    logger.debug("[useKworkInput] Hook initialized");
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useAppToast();
    const { dbUser } = useAppContext(); 

    const {
        kworkInputRef,       
        kworkInputValue,     
        setKworkInputValue,  
        setRequestCopied,
        setSelectedFetcherFiles,
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        scrollToSection,
        addToast, 
    } = useRepoXmlPageContext();

    const handleAddSelected = useCallback(async () => {
        if (imageReplaceTaskActive) {
            logger.warn("[Kwork Input] Add Selected skipped: Image replace task active.");
            toastWarning("Добавление файлов недоступно во время задачи замены картинки.");
            return;
        }
        if (selectedFetcherFiles.size === 0) {
            toastWarning("Нет выбранных файлов для добавления в запрос.");
            logger.warn("[Kwork Input] Add Selected skipped: No files selected.");
            return;
        }
        logger.info(`[Kwork Input] Adding ${selectedFetcherFiles.size} selected files to input...`);
        
        let filesAddedCount = 0;
        let totalCharsAdded = 0;
        const filesContentForLogging: string[] = [];

        const fileBlocksContent = Array.from(selectedFetcherFiles).map(path => {
            const fileNode = allFetchedFiles.find(f => f.path === path);
            let contentToDisplay: string;

            if (!fileNode) {
                contentToDisplay = `// Error: File /${path} not found in allFetchedFiles.`;
                logger.warn(`[Kwork Input] File /${path} not found in allFetchedFiles during AddSelected.`);
            } else if (typeof fileNode.content === 'string') {
                contentToDisplay = fileNode.content;
                filesAddedCount++;
                totalCharsAdded += fileNode.content.length;
                filesContentForLogging.push(fileNode.content); 
            } else if (fileNode.content === null) {
                contentToDisplay = `// Info: Content for /${path} is null (e.g., empty file).`;
                logger.info(`[Kwork Input] Content for file /${path} is null during AddSelected.`);
            } else {
                contentToDisplay = `// Warning: Content for /${path} is of unexpected type (${typeof fileNode.content}). Displaying as empty.`;
                logger.warn(`[Kwork Input] Content for /${path} is of unexpected type: ${typeof fileNode.content} during AddSelected. Defaulting to empty string.`);
                contentToDisplay = ""; 
            }

            const language = getFileLanguage(path);
            const pathComment = `// /${path}`;
            if (contentToDisplay.startsWith("// Error:") || contentToDisplay.startsWith("// Info:") || contentToDisplay.startsWith("// Warning:") || contentToDisplay.trim()) {
                return `${pathComment}\n\`\`\`${language}\n${contentToDisplay.trim()}\n\`\`\``;
            }
            return null;
        }).filter(block => block !== null).join("\n\n// ---- FILE SEPARATOR ----\n\n");

        if (!fileBlocksContent.trim() && filesAddedCount === 0) {
            toastWarning("Выбранные файлы пусты или не содержат полезного контента для добавления.");
            logger.warn("[Kwork Input] Add Selected: No actual content from selected files to add.");
            return;
        }
        
        const codeContextMarker = "Контекст кода для анализа:";
        const structureMarker = "Структура файлов проекта:";
        const newCodeContextSection = `${codeContextMarker}\n\n${fileBlocksContent}`;

        const currentKworkValue = kworkInputValue || "";
        let finalKworkValue = "";

        const idxCode = currentKworkValue.indexOf(codeContextMarker);
        const idxStructure = currentKworkValue.indexOf(structureMarker);

        if (idxCode !== -1) {
            let endOfOldCodeSection = currentKworkValue.length;
            if (idxStructure !== -1 && idxStructure > idxCode) {
                endOfOldCodeSection = idxStructure;
            }
            const textBefore = currentKworkValue.substring(0, idxCode);
            const textAfter = currentKworkValue.substring(endOfOldCodeSection);
            finalKworkValue = (textBefore.trimEnd() + 
                               (textBefore.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd() + 
                               (textAfter.trimStart() ? "\n\n" : "") + 
                               textAfter.trimStart());
        } else if (idxStructure !== -1) {
            const textBeforeStructure = currentKworkValue.substring(0, idxStructure);
            const structureAndAfter = currentKworkValue.substring(idxStructure);
            finalKworkValue = (textBeforeStructure.trimEnd() + 
                               (textBeforeStructure.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd() + 
                               "\n\n" + 
                               structureAndAfter.trimStart());
        } else {
            finalKworkValue = (currentKworkValue.trimEnd() + 
                               (currentKworkValue.trimEnd() ? "\n\n" : "") + 
                               newCodeContextSection.trimEnd());
        }
        
        finalKworkValue = finalKworkValue.replace(/\n{3,}/g, '\n\n').trim();

        setKworkInputValue(finalKworkValue);
        toastSuccess(`${filesAddedCount} файлов добавлено в запрос.`);
        
        if (dbUser?.user_id && filesAddedCount > 0) { 
            logger.debug(`[useKworkInput AddSelected] Logging CyberFitness actions for user ${dbUser.user_id}. Files: ${filesAddedCount}, Chars: ${totalCharsAdded}`);
            const achievementsToDisplay: Achievement[] = [];

            const filesExtractedResult = await logCyberFitnessAction(dbUser.user_id, 'filesExtracted', filesAddedCount); 
            if (filesExtractedResult.success) {
                logger.log(`[useKworkInput AddSelected] CyberFitness: ${filesAddedCount} filesExtracted logged.`);
                if(filesExtractedResult.newAchievements) achievementsToDisplay.push(...filesExtractedResult.newAchievements);
            } else {
                logger.warn(`[useKworkInput AddSelected] CyberFitness: filesExtracted logging failed: ${filesExtractedResult.error}`);
            }

            const estimatedTokens = Math.round(totalCharsAdded / TOKEN_ESTIMATION_FACTOR);
            if (estimatedTokens > 0) {
                const tokensProcessedResult = await logCyberFitnessAction(dbUser.user_id, 'tokensProcessed', estimatedTokens); 
                if (tokensProcessedResult.success) {
                    logger.log(`[useKworkInput AddSelected] CyberFitness: ${estimatedTokens} tokensProcessed logged.`);
                     if(tokensProcessedResult.newAchievements) achievementsToDisplay.push(...tokensProcessedResult.newAchievements);
                } else {
                    logger.warn(`[useKworkInput AddSelected] CyberFitness: tokensProcessed logging failed: ${tokensProcessedResult.error}`);
                }
            }
            
            const uniqueAchievements = Array.from(new Set(achievementsToDisplay.map(a => a.id)))
                                           .map(id => achievementsToDisplay.find(a => a.id === id)!);
            uniqueAchievements.forEach(ach => {
                addToast(`🏆 Достижение: ${ach.name}!`, "success", 5000, { description: ach.description });
                logger.info(`[useKworkInput AddSelected] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`); 
            });

        } else if (filesAddedCount > 0) {
             logger.warn("[useKworkInput AddSelected] Cannot log 'filesExtracted': dbUser.user_id is missing.");
        }
        scrollToSection('kworkInput');

    }, [
        selectedFetcherFiles, allFetchedFiles, imageReplaceTaskActive, toastSuccess, toastWarning,
        kworkInputValue, setKworkInputValue, 
        scrollToSection, dbUser, addToast, logger 
    ]);

    const handleCopyToClipboard = useCallback(async (textToCopy?: string, shouldScroll = true): Promise<boolean> => { 
        const contentToUse = textToCopy ?? (kworkInputValue || ""); 
        if (!contentToUse.trim()) {
            toastWarning("Нет текста для копирования");
            logger.warn("[Kwork Input] Copy skipped: Input is empty.");
            return false;
        }
        try {
            navigator.clipboard.writeText(contentToUse);
            toastSuccess("Текст запроса скопирован!");
            setRequestCopied(true);
            logger.info("[Kwork Input] Copied request to clipboard.");
            
            if (dbUser?.user_id) { 
                logger.debug(`[useKworkInput CopyToClipboard] Attempting to log 'kworkRequestSent' for user ${dbUser.user_id}.`);
                const logResult = await logCyberFitnessAction(dbUser.user_id, 'kworkRequestSent', 1); 
                if (logResult.success) {
                    logger.log(`[useKworkInput CopyToClipboard] CyberFitness: kworkRequestSent logged.`);
                    logResult.newAchievements?.forEach(ach => {
                        addToast(`🏆 Достижение: ${ach.name}!`, "success", 5000, { description: ach.description });
                         logger.info(`[useKworkInput CopyToClipboard] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`); 
                    });
                } else {
                     logger.warn(`[useKworkInput CopyToClipboard] CyberFitness: kworkRequestSent logging failed: ${logResult.error}`);
                }
            } else {
                 logger.warn("[useKworkInput CopyToClipboard] Cannot log 'kworkRequestSent': dbUser.user_id is missing.");
            }

            if (shouldScroll) scrollToSection('executor'); 
            return true;
        } catch (e) {
            logger.error("[Kwork Input] Clipboard write error:", e);
            toastError("Ошибка копирования в буфер обмена");
            return false;
        }
    }, [kworkInputValue, toastSuccess, toastWarning, toastError, setRequestCopied, scrollToSection, dbUser, addToast, logger]); 

    const handleClearAll = useCallback(() => {
        if (imageReplaceTaskActive) {
             logger.warn("[Kwork Input] Clear All skipped: Image replace task active.");
            toastWarning("Очистка недоступна во время задачи замены картинки.");
            return;
        }
        logger.info("[Kwork Input] Clearing input, selection, and related states.");
        setSelectedFetcherFiles(new Set());
        setKworkInputValue(""); 
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        setRequestCopied(false);
        toastSuccess("Форма очищена ✨");
        if (kworkInputRef.current) kworkInputRef.current.focus(); 
    }, [
        imageReplaceTaskActive, setSelectedFetcherFiles, setKworkInputValue, 
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied,
        toastSuccess, toastWarning, kworkInputRef, logger 
    ]);

     const handleAddFullTree = useCallback(async () => {
         if (imageReplaceTaskActive) {
             logger.warn("[Kwork Input] Add Tree skipped: Image replace task active.");
             toastWarning("Добавление дерева файлов недоступно во время задачи замены картинки.");
             return;
         }
         if (files.length === 0) {
             toastWarning("Нет загруженных файлов для добавления дерева.");
             logger.warn("[Kwork Input] Add Tree skipped: No files loaded.");
             return;
         }

         logger.info(`[Kwork Input] Adding full file tree structure and content for ${files.length} files to input...`);
         
         const treeStructure = `Структура дерева файлов для ${files.length} файлов:\n${files.map(f => `- /${f.path}`).join('\n')}`; 

         const structureMarker = "Структура файлов проекта:";
         const newGeneratedTreeBlock = `${structureMarker}\n\`\`\`\n${treeStructure.trim()}\n\`\`\``;
         
         let filesAddedCount = 0;
         let totalCharsAdded = 0;

         const fileBlocksContent = files.map(file => {
             let contentToDisplay: string;
             if (typeof file.content === 'string' && file.content.trim()) {
                 contentToDisplay = file.content;
                 filesAddedCount++;
                 totalCharsAdded += file.content.length;
             } else {
                 contentToDisplay = `// Файл /${file.path} пуст или содержит только комментарии.`;
             }
             const language = getFileLanguage(file.path);
             const pathComment = `// /${file.path}`;
             return `${pathComment}\n\`\`\`${language}\n${contentToDisplay.trim()}\n\`\`\``;
         }).join("\n\n// ---- FILE SEPARATOR ----\n\n");

        const codeContextMarker = "Контекст кода для анализа:";
        const newGeneratedFileContentsBlock = `${codeContextMarker}\n\n${fileBlocksContent}`;
        
        let tempText = kworkInputValue || "";

        const oldStructureRegex = new RegExp(
            structureMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 
            "\\s*```[\\s\\S]*?```", 
            "im"
        );
        const oldCodeDataContextRegex = new RegExp(
            codeContextMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 
            "([\\s\\S]*?)" + 
            "(?=" + 
                "(^" + 
                    structureMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 
                    "\\s*```" + 
                ")" +
                "|$" + 
            ")",
            "im"
        );
        
        logger.debug("[Kwork Input AddFullTree] Removing old structure block if present.");
        tempText = tempText.replace(oldStructureRegex, "").trim();
        logger.debug("[Kwork Input AddFullTree] Removing old code data block if present.");
        tempText = tempText.replace(oldCodeDataContextRegex, "").trim();

        const finalAssembly = [];
        if (tempText) { 
            finalAssembly.push(tempText);
            logger.debug("[Kwork Input AddFullTree] Preserving preamble text:", tempText.substring(0, 100) + "...");
        }
        finalAssembly.push(newGeneratedTreeBlock);
        logger.debug("[Kwork Input AddFullTree] Adding new structure block.");
        finalAssembly.push(newGeneratedFileContentsBlock);
        logger.debug("[Kwork Input AddFullTree] Adding new file contents block.");
        
        const finalKworkValue = finalAssembly.join("\n\n").replace(/\n{3,}/g, '\n\n').trim();

        setKworkInputValue(finalKworkValue);
        toastSuccess(`Структура проекта и ${filesAddedCount} файлов (${files.length} всего) добавлены в запрос.`);
        
        if (dbUser?.user_id) { 
            logger.debug(`[useKworkInput AddFullTree] Logging CyberFitness actions for user ${dbUser.user_id}. Files: ${filesAddedCount}, Chars: ${totalCharsAdded}`); 
            const achievementsToDisplay: Achievement[] = [];

            if (filesAddedCount > 0) { 
                const filesExtractedResult = await logCyberFitnessAction(dbUser.user_id, 'filesExtracted', filesAddedCount); 
                if (filesExtractedResult.success && filesExtractedResult.newAchievements) {
                    achievementsToDisplay.push(...filesExtractedResult.newAchievements);
                } else if (!filesExtractedResult.success) {
                    logger.warn(`[useKworkInput AddFullTree] CyberFitness: filesExtracted logging failed: ${filesExtractedResult.error}`);
                }
            }
            
            const estimatedTokens = Math.round(totalCharsAdded / TOKEN_ESTIMATION_FACTOR);
            if (estimatedTokens > 0) {
                const tokensProcessedResult = await logCyberFitnessAction(dbUser.user_id, 'tokensProcessed', estimatedTokens); 
                if (tokensProcessedResult.success && tokensProcessedResult.newAchievements) {
                    achievementsToDisplay.push(...tokensProcessedResult.newAchievements);
                } else if (!tokensProcessedResult.success) {
                    logger.warn(`[useKworkInput AddFullTree] CyberFitness: tokensProcessed logging failed: ${tokensProcessedResult.error}`);
                }
            }
            
            const { newAchievements: featureAch } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'usedAddFullTree'); 
            if(featureAch) achievementsToDisplay.push(...featureAch);

            const uniqueAchievements = Array.from(new Set(achievementsToDisplay.map(a => a.id)))
                                           .map(id => achievementsToDisplay.find(a => a.id === id)!);
            uniqueAchievements.forEach(ach => {
                addToast(`🏆 Достижение: ${ach.name}!`, "success", 5000, { description: ach.description });
                logger.info(`[useKworkInput AddFullTree] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`); 
            });
        } else {
             logger.warn("[useKworkInput AddFullTree] Cannot log CyberFitness actions: dbUser.user_id is missing.");
        }
        scrollToSection('kworkInput'); 
     }, [files, imageReplaceTaskActive, kworkInputValue, setKworkInputValue, toastSuccess, toastWarning, scrollToSection, dbUser, addToast, logger]);

    const handleInstallAsOneFile = useCallback(async () => {
        if (imageReplaceTaskActive) {
            logger.warn("[Kwork Input] Install skipped: Image replace task active.");
            toastWarning("Создание инсталлера недоступно во время задачи замены картинки.");
            return;
        }
        if (selectedFetcherFiles.size === 0) {
            toastWarning("Нет выбранных файлов для создания инсталлера.");
            logger.warn("[Kwork Input] Install skipped: No files selected.");
            return;
        }

        logger.info(`[Kwork Input] Creating 1-file installer for ${selectedFetcherFiles.size} selected files...`);

        // Simple install script without emojis to avoid syntax issues
        const installScriptTemplate = `#!/usr/bin/env node
// install.mjs - Self-extracting installer script
// Usage: node <this-script> [target_dir]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceFile = resolve(__filename);
const targetDir = process.argv[2] || './skills/';

if (!existsSync(sourceFile)) {
  console.error('ERROR: Source file not found:', sourceFile);
  process.exit(1);
}

const text = readFileSync(sourceFile, 'utf-8');

function extractCodeBlock(text, startIndex) {
  const fenceRe = /^\\\`\\\`\\\`([a-zA-Z]*)\\s*$/gm;
  fenceRe.lastIndex = startIndex;

  const openMatch = fenceRe.exec(text);
  if (!openMatch) return null;

  const contentStart = openMatch.index + openMatch[0].length + 1;
  fenceRe.lastIndex = contentStart;

  const closePattern = /^\\\`\\\`\\\`\\s*$/gm;
  closePattern.lastIndex = contentStart;
  const closeMatch = closePattern.exec(text);

  if (!closeMatch) return null;

  return text.slice(contentStart, closeMatch.index).replace(/\\n$/, '');
}

const markerRe = /^\\/\\/\\s+(\\/\\S+\\.\\S+)\\s*$/gm;
const files = [];
let m;

const lines = text.split('\\n');
let scriptEndIdx = -1;
let codeBlockCount = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '\\\`\\\`\\\`') {
    codeBlockCount++;
    if (codeBlockCount === 1) {
      scriptEndIdx = i;
      break;
    }
  }
}

const searchStart = scriptEndIdx >= 0 ? text.indexOf(lines[scriptEndIdx]) + lines[scriptEndIdx].length : 0;
markerRe.lastIndex = searchStart;

while ((m = markerRe.exec(text)) !== null) {
  files.push({ path: m[1], searchFrom: m.index + m[0].length });
}

const seen = new Set();
const unique = [];
for (const f of files) {
  if (!seen.has(f.path)) {
    seen.add(f.path);
    unique.push(f);
  }
}

console.log(\`Extracting \${unique.length} files from \${sourceFile}\\n\`);

let extracted = 0;
let skipped = 0;

for (const file of unique) {
  const content = extractCodeBlock(text, file.searchFrom);

  if (!content || !content.trim()) {
    console.log(\`  WARNING: No code block found: \${file.path} - skipped\`);
    skipped++;
    continue;
  }

  const outPath = join(targetDir, file.path);
  const dir = dirname(outPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outPath, content, 'utf-8');
  console.log(\`  OK: \${file.path} (\${(content.length / 1024).toFixed(1)} KB)\`);
  extracted++;
}

console.log(\`\\nDone: \${extracted} files extracted, \${skipped} skipped\`);
console.log(\`Target: \${resolve(targetDir)}\`);
`;

        // Build the installer content
        let installerContent = `# Skill Installer

Self-extracting skill installer containing ${selectedFetcherFiles.size} file(s).

---

## Installation Instructions

**ATTENTION AGENT**: When you read this file, follow these steps exactly:

1. **STOP READING THIS FILE NOW** - Do not read further!
2. **Extract the next code block** and save it as a temporary file
3. **Run the extracted script** on this file to extract all files
4. The script will extract all skill files to the proper directories

## Files Included

${Array.from(selectedFetcherFiles).map(f => `- \`${f}\``).join('\n')}

---

\`\`\`javascript
${installScriptTemplate}
\`\`\`

---

## Skill Files

**DO NOT READ FURTHER** - Extract and run the install script first!

---

`;

        // Add file markers and code blocks
        const fileEntries = Array.from(selectedFetcherFiles).map(path => {
            const fileNode = allFetchedFiles.find(f => f.path === path);
            if (!fileNode || typeof fileNode.content !== 'string') {
                return `// /${path}\n\`\`\`${getFileLanguage(path)}\n// Error: File content not available\n\`\`\`\n`;
            }
            return `// /${path}\n\`\`\`${getFileLanguage(path)}\n${fileNode.content}\n\`\`\`\n`;
        }).join('\n');

        installerContent += fileEntries;

        try {
            navigator.clipboard.writeText(installerContent);
            toastSuccess(`Инсталлер из ${selectedFetcherFiles.size} файлов скопирован в буфер обмена!`);
            logger.info("[Kwork Input] Installer copied to clipboard.");
            setRequestCopied(true);
        } catch (e) {
            logger.error("[Kwork Input] Installer clipboard write error:", e);
            toastError("Ошибка копирования инсталлера в буфер обмена");
        }
    }, [selectedFetcherFiles, allFetchedFiles, imageReplaceTaskActive, toastSuccess, toastError, setRequestCopied, logger]);

     logger.debug("[useKworkInput] Hook setup complete.");
    return {
        handleAddSelected,
        handleCopyToClipboard,
        handleClearAll,
        handleAddFullTree,
        handleInstallAsOneFile,
    };
};