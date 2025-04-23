"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner // Added FaSpinner
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Actions & Context
import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from '@/lib/debugLogger'; // Use debugLogger

// Sub-components
import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";

// Define FileNode locally or import if shared
export interface FileNode {
  path: string;
  content: string;
}

// Helper: Get Language
const getLanguage = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch(extension) {
        case 'ts': case 'tsx': return 'typescript';
        case 'js': case 'jsx': return 'javascript';
        case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html';
        case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql';
        case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go';
        case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash';
        case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext';
    }
};

// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Define ImportCategory type LOCALLY ---
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// --- Define categorizeResolvedPath function LOCALLY ---
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => {
    if (!resolvedPath) return 'other'; // Handle null/undefined paths
    const pathLower = resolvedPath.toLowerCase();
    if (pathLower.includes('/contexts/') || pathLower.startsWith('contexts/')) return 'context';
    if (pathLower.includes('/hooks/') || pathLower.startsWith('hooks/')) return 'hook';
    if (pathLower.includes('/lib/') || pathLower.startsWith('lib/')) return 'lib';
    // Ensure it's not a UI component if that's a specific exclusion needed
    if ((pathLower.includes('/components/') || pathLower.startsWith('components/')) && !pathLower.includes('/components/ui/')) return 'component';
    return 'other';
};


// --- Component ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
  // === State ===
  const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]); // Local state for all fetched files
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set()); // Local selection state
  // Note: extractLoading is less useful now context has fetchStatus
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
  const [autoAskAiEnabled, setAutoAskAiEnabled] = useState<boolean>(false);

  // === Context ===
  const { user, openLink } = useAppContext();
  const {
    fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched,
    // Note: We use local selectedFilesState, but update context setSelectedFetcherFiles
    setSelectedFetcherFiles,
    kworkInputHasContent, setKworkInputHasContent,
    setRequestCopied, aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing,
    currentAiRequestId, targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName,
    openPrs, setOpenPrs, setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal,
    kworkInputRef, triggerAskAi, triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection,
    setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles,
    imageReplaceTask, // Get the task from context
    allFetchedFiles, // Read all fetched files if needed from context (though 'files' state here holds them too)
  } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
  const searchParams = useSearchParams();
  const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
  const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
  const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]); // Auto-fetch if path OR image task present
  const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";
  const importantFiles = useMemo(() => [
      "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx",
      "hooks/supabase.ts", "app/actions.ts",
       "app/ai_actions/actions.ts", "app/webhook-handlers/proxy.ts",
       "package.json", "tailwind.config.ts"
  ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const prevSelectedFilesRef = useRef<Set<string>>(new Set());
  useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);

  // === Utility Functions ===
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        // ... (addToast implementation - no changes needed) ...
        logger.log(`Toast [${type}]: ${message}`);
        let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" };
        if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'warning') style = { background: "rgba(217, 119, 6, 0.9)", color: "#ffffff", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(3px)" };
        toast(message, { style: style, duration: type === 'error' ? 5000 : 3000 });
   }, []);

   const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string | null => {
        // ... (getPageFilePath implementation - no changes needed) ...
       const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
       if (!cleanPath || cleanPath === 'app' || cleanPath === '/') { const rootPaths = ['app/page.tsx', 'app/page.js', 'app/index.tsx', 'app/index.js', 'src/app/page.tsx', 'src/app/page.js']; for (const rp of rootPaths) { if (allActualFilePaths.includes(rp)) return rp; } logger.warn(`getPageFilePath: Root path mapping not found for "${routePath}". Defaulting to null`); return null; }
       const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`;
       if (allActualFilePaths.includes(pathWithApp)) { logger.log(`getPageFilePath: Direct match found: "${routePath}" -> "${pathWithApp}"`); return pathWithApp; }
       const potentialDirectPaths = [`${pathWithApp}/page.tsx`, `${pathWithApp}/page.js`, `${pathWithApp}/index.tsx`, `${pathWithApp}/index.js`];
       for (const pdp of potentialDirectPaths) { if (allActualFilePaths.includes(pdp)) { logger.log(`getPageFilePath: Standard page/index match found: "${routePath}" -> "${pdp}"`); return pdp; } }
       const inputSegments = pathWithApp.split('/'); const numInputSegments = inputSegments.length;
       const pageFiles = allActualFilePaths.filter(p => (p.startsWith('app/') || p.startsWith('src/app/')) && (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js')));
       for (const actualPath of pageFiles) { const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => actualPath.endsWith(s)); if (!suffix) continue; const actualPathBase = actualPath.substring(0, actualPath.length - suffix.length); const actualSegments = actualPathBase.split('/'); if (actualSegments.length !== numInputSegments) continue; let isDynamicMatch = true; for (let i = 0; i < numInputSegments; i++) { const inputSeg = inputSegments[i]; const actualSeg = actualSegments[i]; if (inputSeg === actualSeg) continue; else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue; else { isDynamicMatch = false; break; } } if (isDynamicMatch) { logger.log(`getPageFilePath: Dynamic match found: "${routePath}" -> "${actualPath}"`); return actualPath; } }
       logger.warn(`getPageFilePath: No direct, standard, or dynamic match for route "${routePath}". Returning null.`);
        return null;
   }, []);

   const extractImports = useCallback((content: string): string[] => {
        // ... (extractImports implementation - no changes needed) ...
       const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const imports = new Set<string>(); let match; while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); return Array.from(imports);
   }, []);

   const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
       // ... (resolveImportPath implementation - no changes needed) ...
        const allPaths = allFiles.map(f => f.path); const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.md'];
        const tryPaths = (basePath: string): string | null => { const pathsToTry: string[] = []; const hasExplicitExtension = /\.\w+$/.test(basePath); if (hasExplicitExtension) pathsToTry.push(basePath); else { supportedExtensions.forEach(ext => pathsToTry.push(basePath + ext)); supportedExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`)); } for (const p of pathsToTry) { if (allPaths.includes(p)) return p; } return null; };
        if (importPath.startsWith('@/')) { const possibleSrcBases = ['src/', 'app/', '']; const pathSegment = importPath.substring(2); for (const base of possibleSrcBases) { const resolved = tryPaths(base + pathSegment); if (resolved) return resolved; } const commonAliasRoots = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/']; for(const root of commonAliasRoots) { if (pathSegment.startsWith(root)) { const resolved = tryPaths(pathSegment); if (resolved) return resolved; } } }
        else if (importPath.startsWith('.')) { const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : ''; const pathParts = (currentDir ? currentDir + '/' + importPath : importPath).split('/'); const resolvedParts: string[] = []; for (const part of pathParts) { if (part === '.' || part === '') continue; if (part === '..') { if (resolvedParts.length > 0) resolvedParts.pop(); } else resolvedParts.push(part); } const relativeResolvedBase = resolvedParts.join('/'); const resolved = tryPaths(relativeResolvedBase); if (resolved) return resolved; }
        else { const searchBases = ['lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/']; for (const base of searchBases) { const resolved = tryPaths(base + importPath); if (resolved) return resolved; } }
        return null;
   }, []);

    // --- Progress Simulation ---
    const stopProgressSimulation = useCallback(() => {
        // ... (stopProgressSimulation implementation - no changes needed) ...
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        progressIntervalRef.current = null; fetchTimeoutRef.current = null;
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 7) => {
        // ... (startProgressSimulation implementation - no changes needed) ...
        stopProgressSimulation(); setProgress(0); setError(null); const intervalTime = 150; const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime; const incrementBase = 100 / totalSteps;
        progressIntervalRef.current = setInterval(() => { setProgress((prev) => { const randomFactor = Math.random() * 0.7 + 0.6; let nextProgress = prev + (incrementBase * randomFactor); if (nextProgress >= 95 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) { nextProgress = Math.min(prev + incrementBase * 0.1, 99); } else if (nextProgress >= 100) { nextProgress = 99.9; } return nextProgress; }); }, intervalTime);
        fetchTimeoutRef.current = setTimeout(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; if (fetchStatus === 'loading' || fetchStatus === 'retrying') { logger.warn("Progress simulation timed out while fetch was still in progress."); setProgress(99); } } fetchTimeoutRef.current = null; }, estimatedDurationSeconds * 1000 + 5000);
    }, [stopProgressSimulation, fetchStatus]); // Keep fetchStatus dependency


    // === Core Logic Callbacks ===

    const handleRepoUrlChange = useCallback((url: string) => {
        // ... (handleRepoUrlChange implementation - no changes needed) ...
        setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName("");
    }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);

    const updateKworkInput = useCallback((value: string) => {
        // ... (updateKworkInput implementation - no changes needed) ...
        if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { logger.warn("updateKworkInput: localKworkInputRef is null"); }
    }, [setKworkInputHasContent]);

    const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);

    const handleAddSelected = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => {
        // ... (handleAddSelected implementation - no changes needed) ...
        const filesToProcess = allFilesParam || files; // Use local state as fallback
        const filesToAdd = filesToAddParam || selectedFiles; // Use local state as fallback
        if (filesToProcess.length === 0 && filesToAdd.size > 0) { addToast("Ошибка: Файлы для добавления еще не загружены. Повторите попытку.", 'error'); logger.error("handleAddSelected: Attempted to add files but filesToProcess is empty. filesToAdd:", filesToAdd); return; }
        if (filesToAdd.size === 0) { addToast("Сначала выберите файлы для добавления", 'warning'); return; }
        const prefix = "Контекст кода для анализа:\n"; const markdownTxt = filesToProcess.filter((file) => filesToAdd.has(file.path)).sort((a, b) => a.path.localeCompare(b.path)).map((file) => { const pathComment = `// /${file.path}`; const contentAlreadyHasComment = file.content.trimStart().startsWith(pathComment); const contentToAdd = contentAlreadyHasComment ? file.content : `${pathComment}\n${file.content}`; return `\`\`\`${getLanguage(file.path)}\n${contentToAdd}\n\`\`\``; }).join("\n\n");
        const currentKworkValue = getKworkInputValue();
        // Extract existing task description (everything before the context prefix)
        const taskDescriptionMatch = currentKworkValue.match(/^([\s\S]*?)Контекст кода для анализа:/);
        const taskText = taskDescriptionMatch ? taskDescriptionMatch[1].trim() : currentKworkValue.trim(); // Fallback to whole text if prefix not found

        const newContent = `${taskText ? taskText + '\n\n' : ''}${prefix}${markdownTxt}`;
        updateKworkInput(newContent);
        if (!allFilesParam) { // Avoid toast if called during initial fetch
            addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        }
        scrollToSection('kworkInput');
        if (autoAskAi && autoAskAiEnabled) { addToast("Автоматически отправляю запрос AI в очередь...", "info"); await triggerAskAi().catch(err => logger.error("Error auto-triggering AI Ask:", err)); }
    }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection, autoAskAiEnabled, triggerAskAi]); // Keep 'files' & 'selectedFiles' state dependency


    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        // ... (handleCopyToClipboard implementation - no changes needed) ...
        const content = textToCopy ?? getKworkInputValue(); if (!content.trim()) { addToast("Нет текста для копирования", 'warning'); return false; }
        try { navigator.clipboard.writeText(content); addToast("Запрос скопирован! ✅ Вставляй в AI", 'success'); setRequestCopied(true); if (shouldScroll) scrollToSection('executor'); return true; }
        catch (err) { logger.error("Clipboard copy failed:", err); addToast("Ошибка копирования", 'error'); return false; }
    }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);


    const handleClearAll = useCallback(() => {
        // ... (handleClearAll implementation - clear image task too) ...
        logger.log("[handleClearAll] Clearing Fetcher state.");
        setSelectedFilesState(new Set()); // Local state
        setSelectedFetcherFiles(new Set()); // Context state
        updateKworkInput("");
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        // Reset downstream state as well
        if (kworkInputRef.current) kworkInputRef.current.value = "";
        setKworkInputHasContent(false);
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        setRequestCopied(false);
        addToast("Поле ввода и выбор файлов очищены ✨", 'success');
        if (localKworkInputRef.current) localKworkInputRef.current.focus();
    }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setKworkInputHasContent, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied, kworkInputRef ]);


    // --- Fetch Handler (MODIFIED for Image Replace Task) ---
    const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
        // ... (handleFetch implementation - logic for image task selection is kept) ...
        const effectiveBranch = branchNameToFetch ?? 'default';
        logger.log(`[Fetcher:handleFetch] Called. isManualRetry: ${isManualRetry}, Branch: ${effectiveBranch}, ImageTask: ${!!imageReplaceTask}`);

        if (!repoUrl.trim()) { addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); triggerToggleSettingsModal(); return; }
        if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) { addToast("Извлечение уже идет...", "info"); return; }

        // Reset local and relevant context state before fetch
        setFetchStatusState('loading'); // Use direct state setter
        setError(null);
        setFiles([]); // Clear local files
        setSelectedFilesState(new Set()); // Clear local selection
        setSelectedFetcherFiles(new Set()); // Clear context selection
        setFilesFetched(false, [], null, []); // Reset context fetched state immediately
        setRequestCopied(false);
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        addToast(`Запрос репозитория (${effectiveBranch})...`, 'info');
        startProgressSimulation(20);

        const maxRetries = 2; const retryDelayMs = 2000; let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;

        while (currentTry <= maxRetries) {
            currentTry++;
            const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
            setFetchStatus(currentStatus); // Update context status

            if (currentStatus === 'retrying') {
                addToast(`Попытка ${currentTry} из ${maxRetries + 1}...`, 'info');
                await delay(retryDelayMs);
                startProgressSimulation(15 + (currentTry * 5));
            }

            try {
                result = await fetchRepoContents(repoUrl, token || undefined, branchNameToFetch);
                logger.log(`[Fetcher:handleFetch] Attempt ${currentTry} raw result:`, { success: result?.success, fileCount: result?.files?.length, error: result?.error });

                if (result?.success && Array.isArray(result.files)) {
                    const fetchedFiles = result.files;
                    stopProgressSimulation();
                    setProgress(100);
                    // Don't set success status yet, let setFilesFetched handle it
                    addToast(`Извлечено ${fetchedFiles.length} файлов из ${effectiveBranch}!`, 'success');
                    setFiles(fetchedFiles); // Update local component state FIRST

                    if (isSettingsModalOpen) triggerToggleSettingsModal();

                    // <<< --- START IMAGE REPLACE SELECTION LOGIC --- >>>
                    if (imageReplaceTask) {
                        logger.log("[Fetcher:handleFetch] Image Replace task is active:", imageReplaceTask);
                        const targetFileExists = fetchedFiles.some(f => f.path === imageReplaceTask.targetPath);
                        if (targetFileExists) {
                            const singleFileSet = new Set([imageReplaceTask.targetPath]);
                            setSelectedFilesState(singleFileSet); // Set local selection
                            setSelectedFetcherFiles(singleFileSet); // Set context selection
                            setPrimaryHighlightedPathState(imageReplaceTask.targetPath); // Highlight it
                            setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); // Clear others
                            toast.info(`Авто-выбор файла для замены картинки: ${imageReplaceTask.targetPath}`);
                            // Update context: Files fetched AND pass all fetched files data
                            // This will trigger the image replace flow in the context callback
                            setFilesFetched(true, fetchedFiles, imageReplaceTask.targetPath, []);
                        } else {
                             toast.error(`Ошибка: Целевой файл для замены картинки (${imageReplaceTask.targetPath}) не найден в ветке '${effectiveBranch}'.`);
                             setError(`Файл ${imageReplaceTask.targetPath} не найден.`);
                             // Files fetched, but task target not found - still call setFilesFetched
                             setFilesFetched(true, fetchedFiles, null, []);
                             setFetchStatus('error'); // Explicitly set error status
                        }
                        return; // <<< EXIT handleFetch early for image replace task >>>
                    }
                    // <<< --- END IMAGE REPLACE SELECTION LOGIC --- >>>

                    // --- Proceed with normal highlighting/auto-selection if NOT an image replace task ---
                    const allActualFilePaths = fetchedFiles.map(f => f.path);
                    let primaryPath: string | null = null;
                    const categorizedSecondaryPaths: Record<ImportCategory, Set<string>> = { component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set() };
                    let filesToSelect = new Set<string>();

                    if (highlightedPathFromUrl) {
                        primaryPath = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                        if (primaryPath) {
                            const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
                            if (pageFile) {
                                logger.log(`Primary file found: ${primaryPath}`); filesToSelect.add(primaryPath);
                                const rawImports = extractImports(pageFile.content); logger.log(`Raw imports from ${primaryPath}:`, rawImports);
                                for (const imp of rawImports) {
                                    const resolvedPath = resolveImportPath(imp, pageFile.path, fetchedFiles);
                                    if (resolvedPath && resolvedPath !== primaryPath) {
                                         const category = categorizeResolvedPath(resolvedPath);
                                         categorizedSecondaryPaths[category].add(resolvedPath);
                                         // Auto-select non-other imports
                                         if (category !== 'other') filesToSelect.add(resolvedPath);
                                         logger.log(`  Resolved import: '${imp}' -> '${resolvedPath}' (Category: ${category})`);
                                    } else if (!resolvedPath) { logger.log(`  Could not resolve import: '${imp}'`); }
                                }
                            } else { logger.error(`Primary file path resolved to ${primaryPath}, but not found in fetchedFiles!`); addToast(`Ошибка: Найденный путь (${primaryPath}) не соответствует файлу в репо.`, 'error'); primaryPath = null; }
                        } else { addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден в ветке '${effectiveBranch}'.`, 'warning'); }
                    }
                    // Auto-select important files if not already selected
                    importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) filesToSelect.add(path); });

                    setPrimaryHighlightedPathState(primaryPath);
                    const finalSecondaryPathsState = { component: Array.from(categorizedSecondaryPaths.component), context: Array.from(categorizedSecondaryPaths.context), hook: Array.from(categorizedSecondaryPaths.hook), lib: Array.from(categorizedSecondaryPaths.lib), other: Array.from(categorizedSecondaryPaths.other) };
                    setSecondaryHighlightedPathsState(finalSecondaryPathsState);

                    // Update context with fetched=true and file details
                    // This will set fetchStatus to 'success' internally if not an image task
                    setFilesFetched(true, fetchedFiles, primaryPath, Object.values(finalSecondaryPathsState).flat());

                    // Set local and context selections
                    setSelectedFilesState(filesToSelect);
                    setSelectedFetcherFiles(filesToSelect);

                    // Handle auto-adding to kwork if URL params present
                    if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
                        const numSecondary = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size;
                        const numImportantOnly = filesToSelect.size - (primaryPath ? 1 : 0) - numSecondary;
                        let selectMsg = `✅ Авто-выбор: `; const parts = [];
                        if(primaryPath) parts.push(`1 страница`); if(numSecondary > 0) parts.push(`${numSecondary} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`);
                        selectMsg += parts.join(', ') + ` (${filesToSelect.size} всего). Идея из URL добавлена.`;
                        addToast(selectMsg, 'success');

                        const task = ideaFromUrl || DEFAULT_TASK_IDEA;
                        updateKworkInput(task);
                        await handleAddSelected(true, filesToSelect, fetchedFiles); // Pass fetchedFiles

                        setTimeout(() => { addToast("💡 Не забудь добавить инструкции (<FaFileLines />) в начало запроса, если нужно!", "info"); }, 500);
                    } else {
                         // Toast for auto-selection without URL idea
                         if (filesToSelect.size > 0 && (!highlightedPathFromUrl || !ideaFromUrl)) {
                             const numHighlighted = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size;
                             const numImportantOnly = filesToSelect.size - (primaryPath ? 1 : 0) - numHighlighted;
                             let selectMsg = `Авто-выбрано: `; const parts = [];
                             if(primaryPath) parts.push(`1 основной`); if(numHighlighted > 0) parts.push(`${numHighlighted} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`);
                             selectMsg += parts.join(', ') + '.';
                             addToast(selectMsg, 'info');
                         }
                         // Scroll to primary path if exists
                        if (primaryPath) { setTimeout(() => { const elementId = `file-${primaryPath}`; const fileElement = document.getElementById(elementId); if (fileElement) { fileElement.scrollIntoView({ behavior: "smooth", block: "center" }); fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800'); setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800'), 2500); } else { logger.warn(`Element with ID ${elementId} not found for scrolling.`); } }, 400); }
                        else if (fetchedFiles.length > 0) { const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
                    }
                    return; // <<< SUCCESS EXIT POINT (Standard Flow) >>>
                } else {
                    // Handle non-success result (e.g., error message)
                    throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}`);
                }
            } catch (err: any) {
                logger.error(`[Fetcher:handleFetch] Error during attempt ${currentTry}:`, err);
                const displayError = err?.message || "Неизвестная ошибка при извлечении";
                setError(`Попытка ${currentTry}: ${displayError}`); // Set local error for display

                if (currentTry > maxRetries) {
                    logger.error(`[Fetcher:handleFetch] Final attempt failed. Max retries (${maxRetries}) reached.`);
                    stopProgressSimulation();
                    setFetchStatus('failed_retries'); // Update context status
                    setProgress(0);
                    addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error');
                    setFilesFetched(false, [], null, []); // Ensure context knows fetch failed
                    return; // Exit after max retries failed
                }
                // If not max retries, loop will continue after delay
            }
        } // End while loop

        // Should not normally be reached if loop exits correctly
        logger.warn("[Fetcher:handleFetch] Reached end of function unexpectedly after loop.");
        stopProgressSimulation();
        if (fetchStatus !== 'success') {
             setFetchStatus(error ? 'failed_retries' : 'error'); // Final status update if loop finishes without success
             setProgress(0);
             setFilesFetched(false, [], null, []);
        }
   }, [ repoUrl, token, fetchStatus, imageReplaceTask, setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetched, setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA, addToast, startProgressSimulation, stopProgressSimulation, getLanguage, getPageFilePath, extractImports, resolveImportPath, handleAddSelected, getKworkInputValue, scrollToSection, setKworkInputHasContent, isSettingsModalOpen, triggerToggleSettingsModal, updateKworkInput, triggerAskAi, autoAskAiEnabled ]);


    // --- Other Callbacks ---
    const selectHighlightedFiles = useCallback(() => {
        // ... (selectHighlightedFiles implementation - no changes needed) ...
        const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0; const allHighlightableSecondary = [ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib, ]; if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; } allHighlightableSecondary.forEach(path => { if (files.some(f => f.path === path) && !filesToSelect.has(path)) { filesToSelect.add(path); newlySelectedCount++; } }); if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info'); } else { addToast("Все связанные файлы уже выбраны или не найдены", 'info'); }
    }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);

    const toggleFileSelection = useCallback((path: string) => {
        // ... (toggleFileSelection implementation - needs to update context too) ...
        setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if (newSet.has(path)) { newSet.delete(path); logger.log(`File deselected: ${path}`); } else { newSet.add(path); logger.log(`File selected: ${path}`); } setSelectedFetcherFiles(newSet); // <<< Update context state
             return newSet;
        });
    }, [setSelectedFetcherFiles]); // Add context setter dependency

    const handleAddImportantFiles = useCallback(() => {
        // ... (handleAddImportantFiles implementation - needs to update context too) ...
        let addedCount = 0; const filesToAdd = new Set(selectedFiles); importantFiles.forEach(path => { if (files.some(f => f.path === path) && !selectedFiles.has(path)) { filesToAdd.add(path); addedCount++; } }); if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены в репозитории", 'info'); return; } setSelectedFilesState(filesToAdd); // Update local state
         setSelectedFetcherFiles(filesToAdd); // <<< Update context state
         addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
    }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]); // Add context setter dependency

    const handleAddFullTree = useCallback(() => {
        // ... (handleAddFullTree implementation - no changes needed) ...
         if (files.length === 0) { addToast("Нет файлов для отображения дерева", 'warning'); return; } const treeOnly = files.map((file) => `- /${file.path}`).sort().join("\n"); const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``; let added = false; const currentKworkValue = getKworkInputValue(); const trimmedValue = currentKworkValue.trim(); const hasTreeStructure = /Структура файлов проекта:\s*```/im.test(trimmedValue); if (!hasTreeStructure) { const newContent = trimmedValue ? `${trimmedValue}\n\n${treeContent}` : treeContent; updateKworkInput(newContent); added = true; } if (added) { addToast("Дерево файлов добавлено в запрос", 'success'); scrollToSection('kworkInput'); } else { addToast("Дерево файлов уже добавлено", 'info'); }
    }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast]);

    const handleSelectPrBranch = useCallback((branch: string | null) => {
        // ... (handleSelectPrBranch implementation - no changes needed) ...
        setTargetBranchName(branch); // Use context setter
         if (branch) addToast(`Выбрана ветка PR: ${branch}`, 'success'); else addToast(`Выбор ветки PR снят (используется default или ручная).`, 'info');
    }, [setTargetBranchName, addToast]); // Use context setter dependency

    const handleManualBranchChange = useCallback((name: string) => {
        // ... (handleManualBranchChange implementation - no changes needed) ...
        setManualBranchName(name); // Use context setter
    }, [setManualBranchName]); // Use context setter dependency

    const handleLoadPrs = useCallback(() => {
        // ... (handleLoadPrs implementation - no changes needed) ...
        triggerGetOpenPRs(repoUrl);
    }, [triggerGetOpenPRs, repoUrl]);

    // --- Effects ---
    useEffect(() => {
        // ... (Update repoUrlEntered effect - no changes needed) ...
        setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl);
    }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]);

    // Auto-fetch effect
    useEffect(() => {
        // ... (Auto-fetch effect - no changes needed here, relies on handleFetch) ...
        const branchForAutoFetch = targetBranchName || manualBranchName || null;
        if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
            const reason = imageReplaceTask ? "image replace task" : "URL param 'path'";
            logger.log(`Auto-fetching due to ${reason}. Branch: ${branchForAutoFetch ?? 'Default'}`);
            handleFetch(false, branchForAutoFetch);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repoUrl, autoFetch, fetchStatus, targetBranchName, manualBranchName, imageReplaceTask]);

    // Auto-select related files effect
    useEffect(() => {
        // ... (Auto-select related effect - skip if image task active) ...
         if (files.length === 0 || imageReplaceTask) return; // <<< Skip if image task active
        const newlySelectedPaths = new Set<string>(); selectedFiles.forEach(path => { if (!prevSelectedFilesRef.current.has(path)) newlySelectedPaths.add(path); }); if (newlySelectedPaths.size === 0) { prevSelectedFilesRef.current = new Set(selectedFiles); return; }
        const pageFileSuffixes = ['/page.tsx', '/page.js', '/index.tsx', '/index.js']; const newPageFiles = Array.from(newlySelectedPaths).filter(path => pageFileSuffixes.some(suffix => path.endsWith(suffix)));
        if (newPageFiles.length > 0) { logger.log("Newly selected page files detected:", newPageFiles); const relatedFilesToSelect = new Set<string>(); let foundRelatedCount = 0;
            newPageFiles.forEach(pagePath => { const pageFile = files.find(f => f.path === pagePath); if (pageFile) { const imports = extractImports(pageFile.content); logger.log(` Imports for ${pagePath}:`, imports); imports.forEach(imp => { const resolvedPath = resolveImportPath(imp, pageFile.path, files); if (resolvedPath && resolvedPath !== pagePath) { const category = categorizeResolvedPath(resolvedPath); if (category !== 'other') { if (!selectedFiles.has(resolvedPath)) { relatedFilesToSelect.add(resolvedPath); foundRelatedCount++; logger.log(`  -> Auto-selecting ${category}: ${resolvedPath}`); } } } }); } });
            if (relatedFilesToSelect.size > 0) { const finalSelection = new Set([...selectedFiles, ...relatedFilesToSelect]); setSelectedFilesState(finalSelection); // Update local
                setSelectedFetcherFiles(finalSelection); // Update context
                addToast(`🔗 Автоматически добавлено ${foundRelatedCount} связанных файлов`, 'info'); prevSelectedFilesRef.current = finalSelection; return; }
        }
         prevSelectedFilesRef.current = new Set(selectedFiles);
    }, [selectedFiles, files, extractImports, resolveImportPath, categorizeResolvedPath, setSelectedFetcherFiles, addToast, imageReplaceTask]); // Added imageReplaceTask dependency

    // Cleanup simulation timers
    useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);

    // === Imperative Handle ===
    useImperativeHandle(ref, () => ({ handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll: handleClearAll, getKworkInputValue }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);

    // --- Render Logic ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying' || isParsing;
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading; // Also disable fetch if assistant is busy (e.g., creating PR)
    const showProgressBar = fetchStatus === 'loading' || fetchStatus === 'retrying' || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
    const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!imageReplaceTask; // Disable standard actions if image task active
    const isAskAiDisabled = !kworkInputHasContent || isActionDisabled;
    const isCopyDisabled = !kworkInputHasContent || isActionDisabled;
    const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled;
    const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled;
    const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
    const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Header & Settings Toggle Button */}
       <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
            <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                    <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода
                </h2>
                 {/* Instructions - Hide if image task active */}
                 {!imageReplaceTask && (
                    <>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Укажи URL/токен/ветку в <span className="text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}>настройках</span> (<FaCodeBranch className="inline text-cyan-400"/>).</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Нажми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы для контекста AI.</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-2">4. Опиши задачу ИЛИ добавь файлы кнопкой (+).</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Нажми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> <span className="text-gray-400 text-xs">(Админ получит уведомление)</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.</p>
                    </>
                 )}
                 {/* Show simplified instruction if image task active */}
                 {imageReplaceTask && (
                     <p className="text-blue-300/80 text-xs md:text-sm mb-2">Загрузка файла для замены картинки...</p>
                 )}
            </div>
            {/* Settings Toggle Button */}
            <motion.button
                onClick={triggerToggleSettingsModal}
                className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0"
                whileHover={{ scale: 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                whileTap={{ scale: 0.95 }}
                title={isSettingsModalOpen ? "Скрыть настройки" : "Настройки URL/Token/Ветки/PR"}
                aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки URL/Token"}
                aria-expanded={isSettingsModalOpen}
                disabled={isLoading || loadingPrs || assistantLoading} // Disable if busy
            >
                 {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />}
            </motion.button>
        </div>

      {/* Settings Modal Component */}
       <SettingsModal
            isOpen={isSettingsModalOpen}
            repoUrl={repoUrl}
            setRepoUrl={handleRepoUrlChange}
            token={token}
            setToken={setToken}
            manualBranchName={manualBranchName}
            setManualBranchName={handleManualBranchChange}
            currentTargetBranch={targetBranchName}
            openPrs={openPrs}
            loadingPrs={loadingPrs}
            onSelectPrBranch={handleSelectPrBranch}
            onLoadPrs={handleLoadPrs}
            loading={isLoading || loadingPrs || assistantLoading} // Use combined loading
       />

      {/* Fetch Button */}
       <div className="mb-4 flex justify-center">
            <motion.button
                onClick={() => handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error', targetBranchName || manualBranchName || null)}
                disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${
                    fetchStatus === 'failed_retries' || fetchStatus === 'error'
                    ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600'
                    : 'from-purple-600 to-cyan-500'
                 } transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${
                     (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error'))
                     ? "opacity-60 cursor-not-allowed"
                     : "hover:brightness-110 active:scale-[0.98]"
                 }`}
                whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }}
                whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }}
                title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`}
            >
                 {isLoading ? <FaSpinner className="animate-spin" />
                  : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate />
                  : <FaDownload />)}
                 {fetchStatus === 'retrying' ? "Повтор..."
                  : isLoading ? "Загрузка..."
                  : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова"
                  : "Извлечь файлы")}
                 <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
            </motion.button>
        </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} />
                 {isLoading && !isParsing && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повторная попытка)' : ''}</p>}
                 {isParsing && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                 {fetchStatus === 'success' && files.length > 0 && !isParsing && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно извлечено ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && !isParsing && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, но не найдено подходящих файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {/* Updated message for image task success */}
                 {fetchStatus === 'success' && imageReplaceTask && !isParsing && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Файл ${imageReplaceTask.targetPath} для замены картинки загружен.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && !isParsing && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}

      {/* Main Content Area (Grid) */}
       <div className={`grid grid-cols-1 ${files.length > 0 || (kworkInputHasContent && !imageReplaceTask) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>

         {/* Left Column: File List & Controls */}
         {/* Show file list if loading OR files exist (regardless of image task) */}
         {(isLoading || (files.length > 0 && fetchStatus !== 'error' && fetchStatus !== 'failed_retries')) && (
             <div className="flex flex-col gap-4">
                <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} />
                 {/* Hide Auto-Ask AI Checkbox during Image Replace Flow */}
                 {files.length > 0 && !imageReplaceTask && (
                     <div className="flex items-center justify-start gap-2 p-2 bg-gray-700/30 rounded-md">
                        <input
                            type="checkbox" id="autoAskAiCheckbox" checked={autoAskAiEnabled}
                            onChange={(e) => setAutoAskAiEnabled(e.target.checked)}
                            className="form-checkbox h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500/50 focus:ring-offset-gray-800 cursor-pointer"
                            disabled={isActionDisabled} // Use combined disabled state
                        />
                        <label htmlFor="autoAskAiCheckbox" className={`text-xs cursor-pointer select-none ${isActionDisabled ? 'text-gray-500' : 'text-gray-300'}`}>
                           Авто-запрос AI после добавления файлов <span className="text-blue-400">(Add Selected & Ask)</span>
                        </label>
                    </div>
                 )}
                 <FileList
                    id="file-list-container"
                    files={files}
                    selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath}
                    secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles}
                    isLoading={isLoading} // Pass loading state
                    toggleFileSelection={toggleFileSelection}
                    // Disable file list actions if image task active
                    isActionDisabled={isActionDisabled}
                    onAddSelected={() => handleAddSelected(autoAskAiEnabled)}
                    onAddImportant={handleAddImportantFiles}
                    onAddTree={handleAddFullTree}
                    onSelectHighlighted={selectHighlightedFiles}
                 />
             </div>
         )}

         {/* Right Column: Request Input & AI Trigger */}
         {/* <<< --- HIDE IF imageReplaceTask IS ACTIVE --- >>> */}
         {(fetchStatus === 'success' || kworkInputHasContent || (highlightedPathFromUrl && ideaFromUrl)) && !imageReplaceTask ? (
             <div id="kwork-input-section" className="flex flex-col gap-3">
                 <RequestInput
                      kworkInputRef={localKworkInputRef}
                      onCopyToClipboard={() => handleCopyToClipboard(undefined, true)}
                      onClearAll={handleClearAll}
                      isCopyDisabled={isCopyDisabled}
                      isClearDisabled={isClearDisabled}
                      onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                      onAskAi={triggerAskAi}
                      isAskAiDisabled={isAskAiDisabled}
                      aiActionLoading={aiActionLoading}
                      onAddSelected={() => handleAddSelected(autoAskAiEnabled)}
                      isAddSelectedDisabled={isAddSelectedDisabled}
                      selectedFetcherFilesCount={selectedFiles.size}
                 />
             </div>
         ) : null }

         {/* Placeholder/Message during image replacement flow */}
         {imageReplaceTask && fetchStatus === 'success' && (
            <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed border-blue-400 ${files.length === 0 ? 'md:col-span-1' : 'md:col-span-1'}`}> {/* Adjust span based on whether file list is shown */}
                 {assistantLoading ? (
                    <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" />
                 ) : (
                    <FaCircleCheck className="text-green-400 text-3xl mb-3" />
                 )}
                <p className="text-sm text-blue-300">
                    {assistantLoading ? "Обработка замены картинки..." : `Файл ${imageReplaceTask.targetPath} готов к замене.`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                     {assistantLoading ? "Создание/обновление PR..." : "Перехожу к созданию PR..."}
                </p>
            </div>
         )}

      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;