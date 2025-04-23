"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Actions & Context
import { fetchRepoContents } from "@/app/actions_github/actions"; // Using the updated action
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest, ImageReplaceTask } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger";

// Sub-components (Updated versions assumed)
import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput"; // Uses prompt.ts
import ProgressBar from "./repo/ProgressBar";

// Define FileNode locally
export interface FileNode {
  path: string;
  content: string;
}

// Helper: Get Language
const getLanguage = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch(extension) { /* Cases from original */ case 'ts': case 'tsx': return 'typescript'; case 'js': case 'jsx': return 'javascript'; case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html'; case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql'; case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go'; case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash'; case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext'; }
};

// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Define ImportCategory type LOCALLY ---
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// --- Define categorizeResolvedPath function LOCALLY ---
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => {
    if (!resolvedPath) return 'other';
    const pathLower = resolvedPath.toLowerCase();
    if (pathLower.includes('/contexts/') || pathLower.startsWith('contexts/')) return 'context';
    if (pathLower.includes('/hooks/') || pathLower.startsWith('hooks/')) return 'hook';
    if (pathLower.includes('/lib/') || pathLower.startsWith('lib/')) return 'lib';
    if ((pathLower.includes('/components/') || pathLower.startsWith('components/')) && !pathLower.includes('/components/ui/')) return 'component';
    return 'other';
};

// --- Component ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
  // === State ===
  const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
  // Removed autoAskAiEnabled state

  // === Context ===
   const {
     fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched,
     setSelectedFetcherFiles, // Keep context setter
     kworkInputHasContent, setKworkInputHasContent,
     setRequestCopied, aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing,
     currentAiRequestId, targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName,
     openPrs, setOpenPrs, setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal,
     kworkInputRef, triggerAskAi, triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection,
     setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles,
     imageReplaceTask,
     allFetchedFiles: contextAllFetchedFiles,
     setAllFetchedFiles,
   } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
   const searchParams = useSearchParams();
   const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
   const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
   const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
   const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";
   const importantFiles = useMemo(() => [ /* Keep your important files */ "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx", "hooks/supabase.ts", "app/actions.ts", "app/ai_actions/actions.ts", "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts" ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For debouncing selection
  const prevSelectedFilesRef = useRef<Set<string>>(new Set()); // For auto-select effect
  useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);

  // === Utility Functions ===
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => { /* Keep original toast logic */ let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" }; if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" }; else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" }; else if (type === 'warning') style = { background: "rgba(217, 119, 6, 0.9)", color: "#ffffff", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(3px)" }; toast(message, { style: style, duration: type === 'error' ? 5000 : (type === 'warning' ? 4000 : 3000 ) }); }, []);
   const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string | null => { /* Keep original getPageFilePath logic */ const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath; if (!cleanPath || cleanPath === 'app' || cleanPath === '/') { const rootPaths = ['app/page.tsx', 'app/page.js', 'app/index.tsx', 'app/index.js', 'src/app/page.tsx', 'src/app/page.js']; for (const rp of rootPaths) { if (allActualFilePaths.includes(rp)) return rp; } return null; } const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`; if (allActualFilePaths.includes(pathWithApp)) { return pathWithApp; } const potentialDirectPaths = [`${pathWithApp}/page.tsx`, `${pathWithApp}/page.js`, `${pathWithApp}/index.tsx`, `${pathWithApp}/index.js`]; for (const pdp of potentialDirectPaths) { if (allActualFilePaths.includes(pdp)) { return pdp; } } const inputSegments = pathWithApp.split('/'); const numInputSegments = inputSegments.length; const pageFiles = allActualFilePaths.filter(p => (p.startsWith('app/') || p.startsWith('src/app/')) && (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js'))); for (const actualPath of pageFiles) { const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => actualPath.endsWith(s)); if (!suffix) continue; const actualPathBase = actualPath.substring(0, actualPath.length - suffix.length); const actualSegments = actualPathBase.split('/'); if (actualSegments.length !== numInputSegments) continue; let isDynamicMatch = true; for (let i = 0; i < numInputSegments; i++) { const inputSeg = inputSegments[i]; const actualSeg = actualSegments[i]; if (inputSeg === actualSeg) continue; else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue; else { isDynamicMatch = false; break; } } if (isDynamicMatch) { return actualPath; } } return null; }, []);
   const extractImports = useCallback((content: string): string[] => { /* Keep original extractImports logic */ const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const imports = new Set<string>(); let match; while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); return Array.from(imports); }, []);
   const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFileNodes: FileNode[]): string | null => { /* Keep original resolveImportPath logic */ const allPaths = allFileNodes.map(f => f.path); const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.sql', '.md']; const tryPaths = (basePath: string): string | null => { const pathsToTry: string[] = []; const hasExplicitExtension = /\.\w+$/.test(basePath); if (hasExplicitExtension) pathsToTry.push(basePath); else { supportedExtensions.forEach(ext => pathsToTry.push(basePath + ext)); supportedExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`)); } for (const p of pathsToTry) { if (allPaths.includes(p)) return p; } return null; }; if (importPath.startsWith('@/')) { const possibleSrcBases = ['src/', 'app/', '']; const pathSegment = importPath.substring(2); for (const base of possibleSrcBases) { const resolved = tryPaths(base + pathSegment); if (resolved) return resolved; } const commonAliasRoots = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/']; for(const root of commonAliasRoots) { if (pathSegment.startsWith(root)) { const resolved = tryPaths(pathSegment); if (resolved) return resolved; } } } else if (importPath.startsWith('.')) { const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : ''; const pathParts = (currentDir ? currentDir + '/' + importPath : importPath).split('/'); const resolvedParts: string[] = []; for (const part of pathParts) { if (part === '.' || part === '') continue; if (part === '..') { if (resolvedParts.length > 0) resolvedParts.pop(); } else resolvedParts.push(part); } const relativeResolvedBase = resolvedParts.join('/'); const resolved = tryPaths(relativeResolvedBase); if (resolved) return resolved; } else { const searchBases = ['lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/']; for (const base of searchBases) { const resolved = tryPaths(base + importPath); if (resolved) return resolved; } } return null; }, []);

  // --- Progress Simulation ---
  const stopProgressSimulation = useCallback(() => { /* Keep original stopProgressSimulation logic */ if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); progressIntervalRef.current = null; fetchTimeoutRef.current = null; }, []);
  const startProgressSimulation = useCallback((estimatedDurationSeconds = 15) => { /* Keep adjusted startProgressSimulation logic */ stopProgressSimulation(); setProgress(0); setError(null); const intervalTime = 200; const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime; const incrementBase = 100 / totalSteps; progressIntervalRef.current = setInterval(() => { setProgress((prev) => { const randomFactor = Math.random() * 0.6 + 0.5; let nextProgress = prev + (incrementBase * randomFactor); if ((fetchStatus === 'loading' || fetchStatus === 'retrying')) { nextProgress = Math.min(nextProgress, 90); } else if (nextProgress >= 100) { nextProgress = 99.9; } return nextProgress; }); }, intervalTime); fetchTimeoutRef.current = setTimeout(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; if (fetchStatus === 'loading' || fetchStatus === 'retrying') { logger.warn("Progress simulation timeout reached while loading."); setProgress(95); } } fetchTimeoutRef.current = null; }, estimatedDurationSeconds * 1000 + 15000); }, [stopProgressSimulation, fetchStatus]);

  // === Core Logic Callbacks ===
  const handleRepoUrlChange = useCallback((url: string) => { setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName(""); }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);
  const updateKworkInput = useCallback((value: string) => { if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { logger.warn("DEBUG: localKworkInputRef is null in updateKworkInput"); } }, [setKworkInputHasContent]);
  const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);

  // Add Selected Files (No Auto Ask AI)
  const handleAddSelected = useCallback(async (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => {
        const filesToProcess = allFilesParam || files; const filesToAdd = filesToAddParam || selectedFiles;
        if (filesToProcess.length === 0 && filesToAdd.size > 0) { addToast("Ошибка: Файлы для добавления еще не загружены. Повторите попытку.", 'error'); return; }
        if (filesToAdd.size === 0) { addToast("Сначала выберите файлы для добавления", 'warning'); return; }
        const prefix = "Контекст кода для анализа:\n";
        const markdownTxt = filesToProcess.filter((file) => filesToAdd.has(file.path)).sort((a, b) => a.path.localeCompare(b.path)).map((file) => { const pathComment = `// /${file.path}`; const contentAlreadyHasComment = file.content.trimStart().startsWith(pathComment); const contentToAdd = contentAlreadyHasComment ? file.content : `${pathComment}\n${file.content}`; return `\`\`\`${getLanguage(file.path)}\n${contentToAdd}\n\`\`\``; }).join("\n\n");
        const currentKworkValue = getKworkInputValue(); const contextRegex = /Контекст кода для анализа:[\s\S]*/; const taskText = currentKworkValue.replace(contextRegex, '').trim(); const newContent = `${taskText ? taskText + '\n\n' : ''}${prefix}${markdownTxt}`;
        updateKworkInput(newContent); addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success'); scrollToSection('kworkInput');
  }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection]); // No AI deps

  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => { /* Keep original logic */ const content = textToCopy ?? getKworkInputValue(); if (!content.trim()) { addToast("Нет текста для копирования", 'warning'); return false; } try { navigator.clipboard.writeText(content); addToast("Запрос скопирован! ✅ Вставляй в AI", 'success'); setRequestCopied(true); if (shouldScroll) scrollToSection('executor'); return true; } catch (err) { logger.error("Clipboard copy failed:", err); addToast("Ошибка копирования", 'error'); return false; } }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);
  const handleClearAll = useCallback(() => { /* Keep original logic */ logger.log("DEBUG: Clearing Fetcher state."); setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); updateKworkInput(""); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setRequestCopied(false); addToast("Поле ввода и выбор файлов очищены ✨", 'success'); if (localKworkInputRef.current) localKworkInputRef.current.focus(); }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied ]);

  // --- Fetch Handler (Improved Robustness) ---
  const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
      const effectiveBranch = branchNameToFetch || targetBranchName || manualBranchName || 'default';
      logger.log(`[Fetcher:handleFetch] Triggered. Retry: ${isManualRetry}, Branch: ${effectiveBranch}, Status: ${fetchStatus}`);
      if (!repoUrl.trim()) { /* Keep URL check */ logger.error("[Fetcher] Repo URL empty."); addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); triggerToggleSettingsModal(); return; }
      if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) { /* Keep check */ logger.warn("[Fetcher] Fetch already in progress."); addToast("Извлечение уже идет...", "info"); return; }
      if (assistantLoading || isParsing || aiActionLoading) { /* Keep check */ logger.warn(`[Fetcher] Blocked by conflicting state.`); addToast("Подождите завершения предыдущей операции.", "warning"); return; }
      logger.log("[Fetcher] Proceeding with fetch. Setting loading states...");
      setFetchStatus('loading'); setError(null); setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAllFetchedFiles([]); setSelectedFetcherFiles(new Set()); setFilesFetched(false, [], null, []); setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
      if (!imageReplaceTask && !highlightedPathFromUrl && localKworkInputRef.current) { updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA); } else if (imageReplaceTask && localKworkInputRef.current) { updateKworkInput(""); }
      addToast(`Запрос репозитория (${effectiveBranch})...`, 'info'); startProgressSimulation(30); logger.log("[Fetcher] Progress simulation started.");
      let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null; let success = false;
      try {
          logger.info(`[Fetcher] Calling fetchRepoContents - Branch: ${effectiveBranch}`);
          result = await fetchRepoContents(repoUrl, token || undefined, effectiveBranch);
          logger.info(`[Fetcher] fetchRepoContents result: Success=${result?.success}, Files=${result?.files?.length ?? 'N/A'}, Error=${result?.error ?? 'None'}`);
          if (result?.success && Array.isArray(result.files)) {
               success = true; stopProgressSimulation(); setProgress(100); setFetchStatus('success'); const fetchedFiles = result.files; addToast(`Извлечено ${fetchedFiles.length} файлов из ${effectiveBranch}!`, 'success'); setFiles(fetchedFiles); setAllFetchedFiles(fetchedFiles); if (isSettingsModalOpen) triggerToggleSettingsModal();
               // --- Post-Fetch Logic ---
               const allActualFilePaths = fetchedFiles.map(f => f.path); let primaryPathForHighlight: string | null = null; const categorizedSecondaryPaths: Record<ImportCategory, Set<string>> = { component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set() }; let filesToAutoSelect = new Set<string>();
               if (imageReplaceTask) {
                   primaryPathForHighlight = imageReplaceTask.targetPath;
                   if (!allActualFilePaths.includes(primaryPathForHighlight)) { const imgError = `Целевой файл (${primaryPathForHighlight}) не найден в ветке '${effectiveBranch}'.`; logger.error(`[Fetcher] ${imgError}`); setError(imgError); addToast(imgError, 'error'); setFilesFetched(true, fetchedFiles, null, []); setFetchStatus('error'); success = false; }
                   else { filesToAutoSelect.add(primaryPathForHighlight); logger.log(`[Fetcher] Auto-selecting image target: ${primaryPathForHighlight}`); setSelectedFetcherFiles(filesToAutoSelect); }
               } else if (highlightedPathFromUrl) {
                   primaryPathForHighlight = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                   if (primaryPathForHighlight) { const pageFile = fetchedFiles.find((file) => file.path === primaryPathForHighlight); if (pageFile) { filesToAutoSelect.add(primaryPathForHighlight); const rawImports = extractImports(pageFile.content); for (const imp of rawImports) { const resolvedPath = resolveImportPath(imp, pageFile.path, fetchedFiles); if (resolvedPath && resolvedPath !== primaryPathForHighlight) { const category = categorizeResolvedPath(resolvedPath); categorizedSecondaryPaths[category].add(resolvedPath); if (category !== 'other') filesToAutoSelect.add(resolvedPath); } } logger.log(`[Fetcher] Highlighted page ${primaryPathForHighlight}, auto-selected ${filesToAutoSelect.size} related files.`); } else { primaryPathForHighlight = null; addToast(`Ошибка: Найденный путь (${primaryPathForHighlight}) не соответствует файлу в репо.`, 'error'); } }
                   else { addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден в ветке '${effectiveBranch}'.`, 'warning'); }
               }
               if (!imageReplaceTask) { importantFiles.forEach(path => { if (allActualFilePaths.includes(path) && !filesToAutoSelect.has(path)) { filesToAutoSelect.add(path); logger.log(`[Fetcher] Auto-selecting important file: ${path}`); } }); }
               setPrimaryHighlightedPathState(primaryPathForHighlight); const finalSecondaryPathsState = { component: Array.from(categorizedSecondaryPaths.component), context: Array.from(categorizedSecondaryPaths.context), hook: Array.from(categorizedSecondaryPaths.hook), lib: Array.from(categorizedSecondaryPaths.lib), other: Array.from(categorizedSecondaryPaths.other) }; setSecondaryHighlightedPathsState(finalSecondaryPathsState);
               if (!imageReplaceTask) { setSelectedFilesState(filesToAutoSelect); setSelectedFetcherFiles(filesToAutoSelect); }
               setFilesFetched(true, fetchedFiles, primaryPathForHighlight, Object.values(finalSecondaryPathsState).flat()); logger.log("[Fetcher] setFilesFetched called.");
               // --- UI Updates ---
               if (imageReplaceTask && primaryPathForHighlight) { addToast(`Авто-выбор файла для замены картинки: ${primaryPathForHighlight}`, 'info'); }
               else if (highlightedPathFromUrl && ideaFromUrl && filesToAutoSelect.size > 0) {
                   const numSecondary = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size; const numImportantOnly = filesToAutoSelect.size - (primaryPathForHighlight ? 1 : 0) - numSecondary; let selectMsg = `✅ Авто-выбор: `; const parts = []; if(primaryPathForHighlight) parts.push(`1 страница`); if(numSecondary > 0) parts.push(`${numSecondary} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`); selectMsg += parts.join(', ') + ` (${filesToAutoSelect.size} всего). Идея из URL добавлена.`; addToast(selectMsg, 'success');
                   const task = ideaFromUrl || DEFAULT_TASK_IDEA; updateKworkInput(task);
                   // Pass selection and files, NO autoAsk
                   await handleAddSelected(filesToAutoSelect, fetchedFiles);
                   setTimeout(() => { addToast("💡 Не забудь добавить инструкции (<FaFileLines />) в начало запроса!", "info"); }, 500);
               } else if (!imageReplaceTask) {
                    if (filesToAutoSelect.size > 0) { const numHighlighted = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size; const numImportantOnly = filesToAutoSelect.size - (primaryPathForHighlight ? 1 : 0) - numHighlighted; let selectMsg = `Авто-выбрано: `; const parts = []; if(primaryPathForHighlight) parts.push(`1 основной`); if(numHighlighted > 0) parts.push(`${numHighlighted} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`); selectMsg += parts.join(', ') + '.'; addToast(selectMsg, 'info'); }
                    if (primaryPathForHighlight) { setTimeout(() => { const elementId = `file-${primaryPathForHighlight}`; const fileElement = document.getElementById(elementId); if (fileElement) { fileElement.scrollIntoView({ behavior: "smooth", block: "center" }); fileElement.classList.add('ring-2', 'ring-offset-1', 'ring-offset-gray-900', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'); setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-1', 'ring-offset-gray-900', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'), 2500); } }, 400); }
                    else if (fetchedFiles.length > 0) { const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
               }
          } else {
              logger.error(`[Fetcher] fetchRepoContents FAILED. Error: ${result?.error}`); throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}. Проверьте URL, токен и имя ветки.`);
          }
      } catch (err: any) {
          logger.error(`[Fetcher] Error during handleFetch: ${err.message}`, err); const displayError = err?.message || "Неизвестная ошибка при извлечении"; stopProgressSimulation(); setProgress(0); setError(displayError); setFetchStatus('error'); addToast(`Ошибка извлечения: ${displayError}`, 'error'); setFilesFetched(false, [], null, []); success = false;
      }
      if (!success && fetchStatus !== 'error') { setFetchStatus('error'); } logger.log(`[Fetcher:handleFetch] Finished. Success: ${success}, Status: ${fetchStatus}`);
 }, [ /* Keep ALL previous dependencies */ repoUrl, token, fetchStatus, imageReplaceTask, assistantLoading, isParsing, aiActionLoading, repoUrlEntered, setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setAllFetchedFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetched, setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA, addToast, startProgressSimulation, stopProgressSimulation, getLanguage, getPageFilePath, extractImports, resolveImportPath, categorizeResolvedPath, handleAddSelected, getKworkInputValue, scrollToSection, setKworkInputHasContent, isSettingsModalOpen, triggerToggleSettingsModal, updateKworkInput, triggerAskAi, localKworkInputRef, manualBranchName, targetBranchName ]);

  // --- Other Callbacks ---
  const selectHighlightedFiles = useCallback(() => { /* Keep original logic */ const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0; const allHighlightableSecondary = [ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib, ]; if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; } allHighlightableSecondary.forEach(path => { if (files.some(f => f.path === path) && !filesToSelect.has(path)) { filesToSelect.add(path); newlySelectedCount++; } }); if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info'); } else { addToast("Все связанные файлы уже выбраны или не найдены", 'info'); } }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);
  // OPTIMIZED: Toggle File Selection with Debounce for Context Update
  const toggleFileSelection = useCallback((path: string) => { setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if (newSet.has(path)) { newSet.delete(path); } else { newSet.add(path); } if (selectionUpdateTimeoutRef.current) { clearTimeout(selectionUpdateTimeoutRef.current); } selectionUpdateTimeoutRef.current = setTimeout(() => { setSelectedFetcherFiles(new Set(newSet)); selectionUpdateTimeoutRef.current = null; }, 150); return newSet; }); }, [setSelectedFetcherFiles]);
  const handleAddImportantFiles = useCallback(() => { /* Keep original logic */ let addedCount = 0; const filesToAdd = new Set(selectedFiles); importantFiles.forEach(path => { if (files.some(f => f.path === path) && !selectedFiles.has(path)) { filesToAdd.add(path); addedCount++; } }); if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены в репозитории", 'info'); return; } setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success'); }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);
  const handleAddFullTree = useCallback(() => { /* Keep original logic */ if (files.length === 0) { addToast("Нет файлов для отображения дерева", 'warning'); return; } const treeOnly = files.map((file) => `- /${file.path}`).sort().join("\n"); const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``; let added = false; const currentKworkValue = getKworkInputValue(); const trimmedValue = currentKworkValue.trim(); const hasTreeStructure = /Структура файлов проекта:\s*```/im.test(trimmedValue); if (!hasTreeStructure) { const newContent = trimmedValue ? `${trimmedValue}\n\n${treeContent}` : treeContent; updateKworkInput(newContent); added = true; } if (added) { addToast("Дерево файлов добавлено в запрос", 'success'); scrollToSection('kworkInput'); } else { addToast("Дерево файлов уже добавлено", 'info'); } }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast]);
  const handleSelectPrBranch = useCallback((branch: string | null) => { setTargetBranchName(branch); if (branch) addToast(`Выбрана ветка PR: ${branch}`, 'success'); else addToast(`Выбор ветки PR снят (используется default или ручная).`, 'info'); }, [setTargetBranchName, addToast]);
  const handleManualBranchChange = useCallback((name: string) => { setManualBranchName(name); }, [setManualBranchName]);
  const handleLoadPrs = useCallback(() => { triggerGetOpenPRs(repoUrl); }, [triggerGetOpenPRs, repoUrl]);

  // --- Effects ---
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl); }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]);
  useEffect(() => { const branchForAutoFetch = targetBranchName || manualBranchName || null; if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) { handleFetch(false, branchForAutoFetch); } }, [repoUrl, autoFetch, fetchStatus, targetBranchName, manualBranchName, imageReplaceTask, handleFetch]); // handleFetch dependency is important
  useEffect(() => { /* Keep auto-select related files effect */ if (files.length === 0 || imageReplaceTask || fetchStatus !== 'success') { prevSelectedFilesRef.current = new Set(selectedFiles); return; } const newlySelectedPaths = new Set<string>(); selectedFiles.forEach(path => { if (!prevSelectedFilesRef.current.has(path)) { newlySelectedPaths.add(path); } }); if (primaryHighlightedPath && selectedFiles.has(primaryHighlightedPath) && !prevSelectedFilesRef.current.has(primaryHighlightedPath) && !newlySelectedPaths.has(primaryHighlightedPath)) { newlySelectedPaths.add(primaryHighlightedPath); } if (newlySelectedPaths.size === 0) { prevSelectedFilesRef.current = new Set(selectedFiles); return; } const pageFileSuffixes = ['/page.tsx', '/page.js', '/index.tsx', '/index.js']; const filesToCheckForImports = Array.from(newlySelectedPaths).filter(path => pageFileSuffixes.some(suffix => path.endsWith(suffix)) || path === primaryHighlightedPath); if (filesToCheckForImports.length > 0) { const relatedFilesToSelect = new Set<string>(); let foundRelatedCount = 0; filesToCheckForImports.forEach(filePathToCheck => { const fileContentNode = files.find(f => f.path === filePathToCheck); if (fileContentNode) { const imports = extractImports(fileContentNode.content); imports.forEach(imp => { const resolvedPath = resolveImportPath(imp, fileContentNode.path, files); if (resolvedPath && resolvedPath !== filePathToCheck) { const category = categorizeResolvedPath(resolvedPath); if (category !== 'other') { if (!selectedFiles.has(resolvedPath)) { relatedFilesToSelect.add(resolvedPath); foundRelatedCount++; } } } }); } }); if (relatedFilesToSelect.size > 0) { const finalSelection = new Set([...selectedFiles, ...relatedFilesToSelect]); setSelectedFilesState(finalSelection); setSelectedFetcherFiles(finalSelection); addToast(`🔗 Автоматически добавлено ${foundRelatedCount} связанных файлов`, 'info'); prevSelectedFilesRef.current = finalSelection; return; } } prevSelectedFilesRef.current = new Set(selectedFiles); }, [selectedFiles, files, fetchStatus, primaryHighlightedPath, extractImports, resolveImportPath, categorizeResolvedPath, setSelectedFetcherFiles, addToast, imageReplaceTask]);
  useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);

  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({ handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll: handleClearAll, getKworkInputValue }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);

  // --- Render Logic ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading;
  const showProgressBar = isLoading || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
  const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!imageReplaceTask;
  const isAskAiDisabled = !kworkInputHasContent || isActionDisabled || !!imageReplaceTask;
  const isCopyDisabled = !kworkInputHasContent || isActionDisabled || !!imageReplaceTask;
  const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled || !!imageReplaceTask;
  const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled || !!imageReplaceTask;
  const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
  const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Header */}
       <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
            <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                    <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода
                </h2>
                 {!imageReplaceTask && ( <> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Укажи URL/токен/ветку в <span className="text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}>настройках</span> (<FaCodeBranch className="inline text-cyan-400"/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Нажми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы для контекста AI.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-2">4. Опиши задачу ИЛИ добавь файлы кнопкой (<FaPlus className="inline text-sm"/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Нажми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> <span className="text-gray-400 text-xs">(Админ получит уведомление)</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.</p> </> )}
                 {imageReplaceTask && ( <p className="text-blue-300/80 text-xs md:text-sm mb-2">Загрузка файла для замены картинки...</p> )}
            </div>
            {/* Settings Button */}
            <motion.button onClick={triggerToggleSettingsModal} disabled={isLoading || loadingPrs || assistantLoading || aiActionLoading} whileHover={{ scale: (isLoading || loadingPrs || assistantLoading || aiActionLoading) ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }} whileTap={{ scale: (isLoading || loadingPrs || assistantLoading || aiActionLoading) ? 1 : 0.95 }} title={isSettingsModalOpen ? "Скрыть настройки" : "Настройки URL/Token/Ветки/PR"} aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки URL/Token"} aria-expanded={isSettingsModalOpen} className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"> {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />} </motion.button>
        </div>

      {/* Settings Modal */}
       <SettingsModal isOpen={isSettingsModalOpen} repoUrl={repoUrl} setRepoUrl={handleRepoUrlChange} token={token} setToken={setToken} manualBranchName={manualBranchName} setManualBranchName={handleManualBranchChange} currentTargetBranch={targetBranchName} openPrs={openPrs} loadingPrs={loadingPrs} onSelectPrBranch={handleSelectPrBranch} onLoadPrs={handleLoadPrs} loading={isLoading || loadingPrs || assistantLoading || aiActionLoading} />

      {/* Fetch Button */}
       <div className="mb-4 flex justify-center">
            <motion.button onClick={() => { handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error'); }} disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${(isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`} whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }} whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }} title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`}> {isLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)} {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")} <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span> </motion.button>
        </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} />
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повторная попытка)' : ''}</p>}
                 {isParsing && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                 {fetchStatus === 'success' && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно извлечено ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, но не найдено подходящих файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && imageReplaceTask && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Файл ${imageReplaceTask.targetPath.split('/').pop()} для замены картинки загружен.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}

      {/* Main Content Area (Grid) */}
       <div className={`grid grid-cols-1 ${ (files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>

         {/* Left Column: File List & Controls */}
         {(isLoading || files.length > 0) && (
             <div className="flex flex-col gap-4">
                <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} />
                {/* Removed Auto Ask AI Checkbox */}
                 <FileList
                    id="file-list-container"
                    files={files}
                    selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath}
                    secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles}
                    isLoading={isLoading}
                    isActionDisabled={isActionDisabled} // Pass combined disabled state
                    toggleFileSelection={toggleFileSelection} // Pass optimized toggle
                    onAddSelected={() => handleAddSelected()} // No autoAsk param
                    onAddImportant={handleAddImportantFiles}
                    onAddTree={handleAddFullTree}
                    onSelectHighlighted={selectHighlightedFiles}
                 />
             </div>
         )}

         {/* Right Column: Request Input & AI Trigger */}
         {(files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? (
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
                      onAddSelected={() => handleAddSelected()} // No autoAsk param
                      isAddSelectedDisabled={isAddSelectedDisabled}
                      selectedFetcherFilesCount={selectedFiles.size}
                 />
             </div>
         ) : null }

         {/* Placeholder/Message during image replacement flow */}
         {imageReplaceTask && fetchStatus === 'success' && files.length > 0 && (
            <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed border-blue-400 min-h-[200px]`}>
                 {(assistantLoading || aiActionLoading) ? ( <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" /> ) : ( <FaCircleCheck className="text-green-400 text-3xl mb-3" /> )}
                <p className="text-sm text-blue-300"> {(assistantLoading || aiActionLoading) ? "Обработка замены картинки..." : `Файл ${imageReplaceTask.targetPath.split('/').pop()} готов к замене.`} </p>
                <p className="text-xs text-gray-400 mt-1"> {(assistantLoading || aiActionLoading) ? "Создание/обновление PR..." : "Перехожу к созданию PR в Ассистенте..."} </p>
            </div>
         )}

      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;