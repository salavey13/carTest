"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner"; // Ensure toast is imported
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Actions & Context
import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest, ImageReplaceTask } from "@/contexts/RepoXmlPageContext"; // Added ImageReplaceTask
import { debugLogger as logger } from "@/lib/debugLogger"; // Use debugLogger

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

// Helper: Get Language (Matches original logic)
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

// --- Define categorizeResolvedPath function LOCALLY (Matches original logic) ---
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => {
    if (!resolvedPath) return 'other';
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
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
  const [autoAskAiEnabled, setAutoAskAiEnabled] = useState<boolean>(false);

  // === Context ===
   const { user, openLink } = useAppContext();
   const {
     fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched,
     setSelectedFetcherFiles,
     kworkInputHasContent, setKworkInputHasContent,
     setRequestCopied, aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing,
     currentAiRequestId, targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName,
     openPrs, setOpenPrs, setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal,
     kworkInputRef, triggerAskAi, triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection,
     setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles,
     imageReplaceTask, // Get the image replace task state
     allFetchedFiles: contextAllFetchedFiles, // Use context allFetchedFiles state
     setAllFetchedFiles, // Use context setter
   } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
   const searchParams = useSearchParams();
   const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
   const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
   const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
   const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";
   // Use the original important files list
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
        // Keep console log if desired for standard toasts, or remove
        // console.log(`Toast [${type}]: ${message}`);
        let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" };
        if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'warning') style = { background: "rgba(217, 119, 6, 0.9)", color: "#ffffff", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(3px)" };
        toast(message, { style: style, duration: type === 'error' ? 5000 : (type === 'warning' ? 4000 : 3000 ) });
   }, []);

   // Full getPageFilePath implementation (matches original logic)
   const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string | null => {
        const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
        // Handle root path explicitly
        if (!cleanPath || cleanPath === 'app' || cleanPath === '/') {
            const rootPaths = ['app/page.tsx', 'app/page.js', 'app/index.tsx', 'app/index.js', 'src/app/page.tsx', 'src/app/page.js'];
            for (const rp of rootPaths) {
                if (allActualFilePaths.includes(rp)) return rp;
            }
            return null;
        }

        // Construct potential base path, assuming 'app' directory
        const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`;

        // Check for direct file match (e.g., /app/about.tsx)
        if (allActualFilePaths.includes(pathWithApp)) {
            return pathWithApp;
        }

        // Check for standard Next.js page/index files within the directory
        const potentialDirectPaths = [
            `${pathWithApp}/page.tsx`, `${pathWithApp}/page.js`,
            `${pathWithApp}/index.tsx`, `${pathWithApp}/index.js`
        ];
        for (const pdp of potentialDirectPaths) {
            if (allActualFilePaths.includes(pdp)) {
                return pdp;
            }
        }

        // Check for dynamic routes (e.g., /app/blog/[slug]/page.tsx matching /blog/my-post)
        const inputSegments = pathWithApp.split('/');
        const numInputSegments = inputSegments.length;
        // Filter potential page files for dynamic matching
        const pageFiles = allActualFilePaths.filter(p =>
            (p.startsWith('app/') || p.startsWith('src/app/')) &&
            (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js'))
        );

        for (const actualPath of pageFiles) {
            const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => actualPath.endsWith(s));
            if (!suffix) continue; // Should not happen based on filter, but safety check

            const actualPathBase = actualPath.substring(0, actualPath.length - suffix.length);
            const actualSegments = actualPathBase.split('/');

            if (actualSegments.length !== numInputSegments) continue; // Must have same number of segments

            let isDynamicMatch = true;
            for (let i = 0; i < numInputSegments; i++) {
                const inputSeg = inputSegments[i];
                const actualSeg = actualSegments[i];
                if (inputSeg === actualSeg) continue; // Segments match literally
                // Check if the actual path segment is a dynamic segment like [id] or [...slug]
                else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue;
                else {
                    isDynamicMatch = false; // Segments don't match and it's not dynamic
                    break;
                }
            }
            if (isDynamicMatch) {
                return actualPath;
            }
        }
        return null; // No match found
   }, []);

   // Full extractImports implementation
   const extractImports = useCallback((content: string): string[] => {
        const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g;
        const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g;
        const imports = new Set<string>();
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            if (match[1] && match[1] !== '.') imports.add(match[1]);
        }
        while ((match = requireRegex.exec(content)) !== null) {
            if (match[1] && match[1] !== '.') imports.add(match[1]);
        }
        return Array.from(imports);
   }, []);

   // Full resolveImportPath implementation (using original supportedExtensions)
   const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFileNodes: FileNode[]): string | null => {
        const allPaths = allFileNodes.map(f => f.path);
        const supportedExtensions = ['.ts', '.tsx", '.css', '.sql', '.md'];

        const tryPaths = (basePath: string): string | null => {
            const pathsToTry: string[] = [];
            const hasExplicitExtension = /\.\w+$/.test(basePath);

            if (hasExplicitExtension) {
                pathsToTry.push(basePath);
            } else {
                supportedExtensions.forEach(ext => pathsToTry.push(basePath + ext));
                supportedExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`));
            }

            for (const p of pathsToTry) {
                if (allPaths.includes(p)) return p;
            }
            return null;
        };

        // Handle Alias Paths (e.g., @/components/...)
        if (importPath.startsWith('@/')) {
            const possibleSrcBases = ['src/', 'app/', ''];
            const pathSegment = importPath.substring(2);
            for (const base of possibleSrcBases) {
                const resolved = tryPaths(base + pathSegment);
                if (resolved) return resolved;
            }
             const commonAliasRoots = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/'];
             for(const root of commonAliasRoots) {
                 if (pathSegment.startsWith(root)) {
                     const resolved = tryPaths(pathSegment);
                     if (resolved) return resolved;
                 }
             }
        }
        // Handle Relative Paths (e.g., ./Button, ../hooks/useStuff)
        else if (importPath.startsWith('.')) {
            const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : '';
            const pathParts = (currentDir ? currentDir + '/' + importPath : importPath).split('/');
            const resolvedParts: string[] = [];
            for (const part of pathParts) {
                if (part === '.' || part === '') continue;
                if (part === '..') {
                    if (resolvedParts.length > 0) resolvedParts.pop();
                } else {
                    resolvedParts.push(part);
                }
            }
            const relativeResolvedBase = resolvedParts.join('/');
            const resolved = tryPaths(relativeResolvedBase);
            if (resolved) return resolved;
        }
        // Handle Bare Imports (potential local modules)
        else {
            const searchBases = [
                'lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/',
                'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/'
            ];
            for (const base of searchBases) {
                const resolved = tryPaths(base + importPath);
                if (resolved) return resolved;
            }
        }
        return null;
   }, []);

  // --- Progress Simulation ---
  const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        progressIntervalRef.current = null; fetchTimeoutRef.current = null;
  }, []);

  const startProgressSimulation = useCallback((estimatedDurationSeconds = 7) => {
        stopProgressSimulation(); setProgress(0); setError(null); const intervalTime = 150; const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime; const incrementBase = 100 / totalSteps;
        progressIntervalRef.current = setInterval(() => { setProgress((prev) => { const randomFactor = Math.random() * 0.7 + 0.6; let nextProgress = prev + (incrementBase * randomFactor); if (nextProgress >= 95 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) { nextProgress = Math.min(prev + incrementBase * 0.1, 99); } else if (nextProgress >= 100) { nextProgress = 99.9; } return nextProgress; }); }, intervalTime);
        fetchTimeoutRef.current = setTimeout(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; if (fetchStatus === 'loading' || fetchStatus === 'retrying') { logger.warn("Progress simulation timeout reached while loading."); setProgress(99); } } fetchTimeoutRef.current = null; }, estimatedDurationSeconds * 1000 + 5000); // Increased timeout buffer
  }, [stopProgressSimulation, fetchStatus]);

  // === Core Logic Callbacks ===
  const handleRepoUrlChange = useCallback((url: string) => {
        setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName("");
  }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);

  const updateKworkInput = useCallback((value: string) => {
        if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { logger.warn("DEBUG: localKworkInputRef is null in updateKworkInput"); }
  }, [setKworkInputHasContent]);

  const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);

  const handleAddSelected = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => {
        const filesToProcess = allFilesParam || files; // Use passed files if available, otherwise local state
        const filesToAdd = filesToAddParam || selectedFiles; // Use passed selection if available
        if (filesToProcess.length === 0 && filesToAdd.size > 0) { addToast("Ошибка: Файлы для добавления еще не загружены. Повторите попытку.", 'error'); return; }
        if (filesToAdd.size === 0) { addToast("Сначала выберите файлы для добавления", 'warning'); return; }
        const prefix = "Контекст кода для анализа:\n";
        const markdownTxt = filesToProcess
            .filter((file) => filesToAdd.has(file.path))
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((file) => {
                const pathComment = `// /${file.path}`;
                const contentAlreadyHasComment = file.content.trimStart().startsWith(pathComment);
                const contentToAdd = contentAlreadyHasComment ? file.content : `${pathComment}\n${file.content}`;
                return `\`\`\`${getLanguage(file.path)}\n${contentToAdd}\n\`\`\``;
            }).join("\n\n");
        const currentKworkValue = getKworkInputValue();
        // Improved Regex: Handles potential prefix text before the context block
        const contextRegex = /Контекст кода для анализа:[\s\S]*/;
        const taskText = currentKworkValue.replace(contextRegex, '').trim(); // Remove old context, keep prefix
        const newContent = `${taskText ? taskText + '\n\n' : ''}${prefix}${markdownTxt}`;
        updateKworkInput(newContent);
        if (!allFilesParam) { addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success'); } // Only toast if not part of auto-add
        scrollToSection('kworkInput');
        if (autoAskAi && autoAskAiEnabled) { addToast("Автоматически отправляю запрос AI...", "info"); await triggerAskAi().catch(err => logger.error(`Error auto-triggering AI: ${err?.message || err}`)); }
  }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection, autoAskAiEnabled, triggerAskAi]);

  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? getKworkInputValue(); if (!content.trim()) { addToast("Нет текста для копирования", 'warning'); return false; }
        try { navigator.clipboard.writeText(content); addToast("Запрос скопирован! ✅ Вставляй в AI", 'success'); setRequestCopied(true); if (shouldScroll) scrollToSection('executor'); return true; }
        catch (err) { logger.error("Clipboard copy failed:", err); addToast("Ошибка копирования", 'error'); return false; }
  }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);

  const handleClearAll = useCallback(() => {
        logger.log("DEBUG: Clearing Fetcher state.");
        setSelectedFilesState(new Set());
        setSelectedFetcherFiles(new Set());
        updateKworkInput(""); // Clears input and updates context state
        setPrimaryHighlightedPathState(null);
        setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
        // Redundant checks, updateKworkInput handles context state
        // if (kworkInputRef.current) kworkInputRef.current.value = "";
        // setKworkInputHasContent(false);
        // Clear downstream assistant state
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        setRequestCopied(false); // Reset copied flag
        addToast("Поле ввода и выбор файлов очищены ✨", 'success');
        if (localKworkInputRef.current) localKworkInputRef.current.focus();
  }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied, kworkInputRef ]);

  // --- Fetch Handler (with TOAST LOGGING) ---
  const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
      const effectiveBranch = branchNameToFetch ?? 'default';
      logger.log(`DEBUG: handleFetch triggered. Retry: ${isManualRetry}, Branch: ${effectiveBranch}, Status: ${fetchStatus}, RepoEntered: ${repoUrlEntered}, ImgTask: ${!!imageReplaceTask}, AssistantLoading: ${assistantLoading}, IsParsing: ${isParsing}`);

      if (!repoUrl.trim()) {
          logger.error("DEBUG EXIT: Repo URL empty.");
          addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); triggerToggleSettingsModal(); return;
      }
      // Allow retry even if loading/retrying
      if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) {
          logger.warn("DEBUG EXIT: Fetch already in progress.", { duration: 2000 });
          addToast("Извлечение уже идет...", "info"); return;
      }
       if (assistantLoading || isParsing) {
           logger.warn(`DEBUG EXIT: Conflicting state (AssistantLoading: ${assistantLoading}, IsParsing: ${isParsing}).`);
           addToast("Подождите завершения предыдущей операции.", "warning");
           return;
       }

      logger.log("DEBUG: Proceeding with fetch. Setting loading states...");
      setFetchStatus('loading'); // Set status to loading
      setError(null);
      setFiles([]); // Clear local files state
      setSelectedFilesState(new Set()); // Clear local selection
      setPrimaryHighlightedPathState(null); // Clear highlights
      setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
      // Reset context states related to fetcher/assistant output
      setSelectedFetcherFiles(new Set());
      setFilesFetched(false, [], null, []); // Signal fetch started, clear context data
      setRequestCopied(false);
      setAiResponseHasContent(false);
      setFilesParsed(false);
      setSelectedAssistantFiles(new Set());
      // Set initial prompt only if NOT an image task and URL params aren't dictating it
      if (!imageReplaceTask && !highlightedPathFromUrl && localKworkInputRef.current) {
          updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA);
      } else if (imageReplaceTask && localKworkInputRef.current) {
          updateKworkInput(""); // Clear input for image task
      }

      addToast(`Запрос репозитория (${effectiveBranch})...`, 'info');
      startProgressSimulation(20); // Start progress simulation
      logger.log("DEBUG: Progress simulation started.");

      const maxRetries = 2; const retryDelayMs = 2000; let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;

      while (currentTry <= maxRetries) {
          currentTry++;
          const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
          setFetchStatus(currentStatus); // Update status for retry attempts

          if (currentStatus === 'retrying') {
              logger.info(`DEBUG: Retrying fetch (attempt ${currentTry})...`);
              addToast(`Попытка ${currentTry} из ${maxRetries + 1}...`, 'info');
              await delay(retryDelayMs);
              startProgressSimulation(15 + (currentTry * 5)); // Restart simulation potentially longer
          }

          try {
              logger.info(`DEBUG: Calling fetchRepoContents - Attempt ${currentTry}, Branch: ${branchNameToFetch || 'default'}`);
              result = await fetchRepoContents(repoUrl, token || undefined, branchNameToFetch);
              logger.info(`DEBUG: fetchRepoContents result - Attempt ${currentTry}: Success=${result?.success}, Files=${result?.files?.length ?? 'N/A'}, Error=${result?.error ?? 'None'}`);

              if (result?.success && Array.isArray(result.files)) {
                  const fetchedFiles = result.files;
                  logger.success(`DEBUG SUCCESS - Attempt ${currentTry}. Files: ${fetchedFiles.length}`);
                  stopProgressSimulation();
                  setProgress(100);
                  addToast(`Извлечено ${fetchedFiles.length} файлов из ${effectiveBranch}!`, 'success');
                  setFiles(fetchedFiles); // Update local state with fetched files
                  setAllFetchedFiles(fetchedFiles); // Update context state with fetched files

                  if (isSettingsModalOpen) triggerToggleSettingsModal(); // Close modal on success

                  // --- Handle Post-Fetch Logic ---
                  const allActualFilePaths = fetchedFiles.map(f => f.path);
                  let primaryPathForHighlight: string | null = null;
                  const categorizedSecondaryPaths: Record<ImportCategory, Set<string>> = { component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set() };
                  let filesToAutoSelect = new Set<string>();

                  // Determine primary highlighted path (for standard flow OR image task)
                  if (imageReplaceTask) {
                      primaryPathForHighlight = imageReplaceTask.targetPath;
                      if (!allActualFilePaths.includes(primaryPathForHighlight)) {
                          logger.error(`DEBUG ERROR: Image Replace target file not found: ${primaryPathForHighlight}`);
                          addToast(`Ошибка: Целевой файл для замены картинки (${primaryPathForHighlight}) не найден в ветке '${effectiveBranch}'.`, 'error');
                          setError(`Файл ${primaryPathForHighlight} не найден.`);
                           // Signal files fetched but with error for this specific task
                          setFilesFetched(true, fetchedFiles, null, []);
                          setFetchStatus('error'); // Set final status to error
                          return; // Exit fetch function
                      }
                       filesToAutoSelect.add(primaryPathForHighlight);
                       logger.log(`DEBUG: Auto-selecting image target: ${primaryPathForHighlight}`);
                  } else if (highlightedPathFromUrl) {
                      // Standard flow with URL path param
                      primaryPathForHighlight = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                      if (primaryPathForHighlight) {
                          const pageFile = fetchedFiles.find((file) => file.path === primaryPathForHighlight);
                          if (pageFile) {
                              filesToAutoSelect.add(primaryPathForHighlight);
                              const rawImports = extractImports(pageFile.content);
                              for (const imp of rawImports) {
                                  const resolvedPath = resolveImportPath(imp, pageFile.path, fetchedFiles);
                                  if (resolvedPath && resolvedPath !== primaryPathForHighlight) {
                                       const category = categorizeResolvedPath(resolvedPath);
                                       categorizedSecondaryPaths[category].add(resolvedPath);
                                       // Auto-select non-'other' imports
                                       if (category !== 'other') filesToAutoSelect.add(resolvedPath);
                                  }
                              }
                              logger.log(`DEBUG: Highlighted page ${primaryPathForHighlight}, auto-selected ${filesToAutoSelect.size} related files.`);
                          } else {
                              primaryPathForHighlight = null; // Reset if file content missing
                              addToast(`Ошибка: Найденный путь (${primaryPathForHighlight}) не соответствует файлу в репо.`, 'error');
                          }
                      } else {
                          addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден в ветке '${effectiveBranch}'.`, 'warning');
                      }
                  }

                  // Auto-select important files if not already selected
                  importantFiles.forEach(path => {
                      if (allActualFilePaths.includes(path) && !filesToAutoSelect.has(path)) {
                         if (!imageReplaceTask) { // Only add important files if not image task
                             filesToAutoSelect.add(path);
                             logger.log(`DEBUG: Auto-selecting important file: ${path}`);
                         }
                      }
                  });

                  // --- Update State Post-Processing ---
                  setPrimaryHighlightedPathState(primaryPathForHighlight);
                  const finalSecondaryPathsState = { component: Array.from(categorizedSecondaryPaths.component), context: Array.from(categorizedSecondaryPaths.context), hook: Array.from(categorizedSecondaryPaths.hook), lib: Array.from(categorizedSecondaryPaths.lib), other: Array.from(categorizedSecondaryPaths.other) };
                  setSecondaryHighlightedPathsState(finalSecondaryPathsState);

                  // Update local and context selections
                  setSelectedFilesState(filesToAutoSelect);
                  setSelectedFetcherFiles(filesToAutoSelect);

                  // --- Signal Fetch Completion to Context ---
                  // This now triggers image replacement logic in the context if needed
                  setFilesFetched(true, fetchedFiles, primaryPathForHighlight, Object.values(finalSecondaryPathsState).flat());
                  logger.log("DEBUG: setFilesFetched called.", { primaryPathForHighlight, numSecondary: Object.values(finalSecondaryPathsState).flat().length, numSelected: filesToAutoSelect.size });

                  // --- Toast and UI Updates (Post Context Update) ---
                  if (imageReplaceTask && primaryPathForHighlight) {
                       addToast(`Авто-выбор файла для замены картинки: ${primaryPathForHighlight}`, 'info');
                       // No kwork input update needed for image task
                  } else if (highlightedPathFromUrl && ideaFromUrl && filesToAutoSelect.size > 0) {
                      // Standard flow with URL params and auto-selection
                      const numSecondary = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size;
                      const numImportantOnly = filesToAutoSelect.size - (primaryPathForHighlight ? 1 : 0) - numSecondary;
                      let selectMsg = `✅ Авто-выбор: `; const parts = [];
                      if(primaryPathForHighlight) parts.push(`1 страница`); if(numSecondary > 0) parts.push(`${numSecondary} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`);
                      selectMsg += parts.join(', ') + ` (${filesToAutoSelect.size} всего). Идея из URL добавлена.`;
                      addToast(selectMsg, 'success');

                      // Update kwork input and potentially auto-trigger AI
                      const task = ideaFromUrl || DEFAULT_TASK_IDEA;
                      updateKworkInput(task); // Update kwork input with idea
                      // Add selected files context AFTER setting the idea
                      await handleAddSelected(true, filesToAutoSelect, fetchedFiles); // Auto-ask AI if enabled

                      setTimeout(() => { addToast("💡 Не забудь добавить инструкции (<FaFileLines />) в начало запроса, если нужно!", "info"); }, 500);
                  } else if (!imageReplaceTask) {
                       // Standard flow, no URL params, but maybe auto-selection happened
                       if (filesToAutoSelect.size > 0) {
                           const numHighlighted = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size;
                           const numImportantOnly = filesToAutoSelect.size - (primaryPathForHighlight ? 1 : 0) - numHighlighted;
                           let selectMsg = `Авто-выбрано: `; const parts = [];
                           if(primaryPathForHighlight) parts.push(`1 основной`); if(numHighlighted > 0) parts.push(`${numHighlighted} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`);
                           selectMsg += parts.join(', ') + '.';
                           addToast(selectMsg, 'info');
                       }
                      // Scroll to highlighted file or list
                      if (primaryPathForHighlight) { setTimeout(() => { const elementId = `file-${primaryPathForHighlight}`; const fileElement = document.getElementById(elementId); if (fileElement) { fileElement.scrollIntoView({ behavior: "smooth", block: "center" }); fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800'); setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800'), 2500); } else { /* console.warn optional */ } }, 400); }
                      else if (fetchedFiles.length > 0) { const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
                  }

                  return; // <<< SUCCESS EXIT POINT >>>

              } else {
                  // Handle fetch failure from API
                  logger.error(`DEBUG ERROR: fetchRepoContents FAILED - Attempt ${currentTry}. Error: ${result?.error}`);
                  throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}`);
              }
          } catch (err: any) {
              // Handle exceptions during fetch or processing
              logger.error(`DEBUG CATCH: Error during fetch attempt ${currentTry}: ${err.message}`);
              const displayError = err?.message || "Неизвестная ошибка при извлечении";
              setError(`Попытка ${currentTry}: ${displayError}`);

              if (currentTry > maxRetries) {
                  // Max retries reached
                  logger.error(`DEBUG FINAL ERROR: Max retries (${maxRetries}) reached.`);
                  stopProgressSimulation();
                  setFetchStatus('failed_retries');
                  setProgress(0);
                  addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error');
                  setFilesFetched(false, [], null, []); // Signal failure to context
                  return; // Exit loop
              }
              // Loop continues after delay if not max retries
              setFetchStatus('retrying'); // Ensure status is retrying before next loop
          }
      } // End while loop

      // Should ideally not be reached if success/failure handled correctly within loop
      logger.warn("DEBUG: Reached end of function unexpectedly after loop.");
      stopProgressSimulation();
      if (fetchStatus !== 'success' && fetchStatus !== 'error') { // Check if status wasn't already set to a final state
           setFetchStatus(error ? 'failed_retries' : 'error'); // Default to error/failed
           setProgress(0);
           setFilesFetched(false, [], null, []); // Signal failure
      }
 }, [ // Dependencies list
     repoUrl, token, fetchStatus, imageReplaceTask, assistantLoading, isParsing, repoUrlEntered,
     setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setAllFetchedFiles,
     setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState,
     setSelectedFetcherFiles, setFilesFetched, setRequestCopied,
     setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
     highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA,
     addToast, startProgressSimulation, stopProgressSimulation,
     getLanguage, getPageFilePath, extractImports, resolveImportPath,
     handleAddSelected, getKworkInputValue, scrollToSection,
     setKworkInputHasContent, isSettingsModalOpen, triggerToggleSettingsModal,
     updateKworkInput, triggerAskAi, autoAskAiEnabled, localKworkInputRef,
     manualBranchName, targetBranchName // Include branch names
 ]);

  // --- Other Callbacks ---
  const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0; const allHighlightableSecondary = [ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib, ]; if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; } allHighlightableSecondary.forEach(path => { if (files.some(f => f.path === path) && !filesToSelect.has(path)) { filesToSelect.add(path); newlySelectedCount++; } }); if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info'); } else { addToast("Все связанные файлы уже выбраны или не найдены", 'info'); }
  }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);

  const toggleFileSelection = useCallback((path: string) => {
        setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if (newSet.has(path)) { newSet.delete(path); } else { newSet.add(path); } setSelectedFetcherFiles(newSet); // Update context immediately
             return newSet; });
  }, [setSelectedFetcherFiles]);

  const handleAddImportantFiles = useCallback(() => {
        let addedCount = 0; const filesToAdd = new Set(selectedFiles); importantFiles.forEach(path => { if (files.some(f => f.path === path) && !selectedFiles.has(path)) { filesToAdd.add(path); addedCount++; } }); if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены в репозитории", 'info'); return; } setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
  }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);

  const handleAddFullTree = useCallback(() => {
         if (files.length === 0) { addToast("Нет файлов для отображения дерева", 'warning'); return; } const treeOnly = files.map((file) => `- /${file.path}`).sort().join("\n"); const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``; let added = false; const currentKworkValue = getKworkInputValue(); const trimmedValue = currentKworkValue.trim(); const hasTreeStructure = /Структура файлов проекта:\s*```/im.test(trimmedValue); if (!hasTreeStructure) { const newContent = trimmedValue ? `${trimmedValue}\n\n${treeContent}` : treeContent; updateKworkInput(newContent); added = true; } if (added) { addToast("Дерево файлов добавлено в запрос", 'success'); scrollToSection('kworkInput'); } else { addToast("Дерево файлов уже добавлено", 'info'); }
  }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast]);

  const handleSelectPrBranch = useCallback((branch: string | null) => {
        setTargetBranchName(branch); // Context setter handles combined logic
        if (branch) addToast(`Выбрана ветка PR: ${branch}`, 'success');
        else addToast(`Выбор ветки PR снят (используется default или ручная).`, 'info');
  }, [setTargetBranchName, addToast]);

  const handleManualBranchChange = useCallback((name: string) => {
        setManualBranchName(name); // Context setter handles combined logic
  }, [setManualBranchName]);

  const handleLoadPrs = useCallback(() => {
        triggerGetOpenPRs(repoUrl);
  }, [triggerGetOpenPRs, repoUrl]);

  // --- Effects ---
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl); }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]);
  // Auto-fetch effect
  useEffect(() => { const branchForAutoFetch = targetBranchName || manualBranchName || null; if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) { handleFetch(false, branchForAutoFetch); } }, [repoUrl, autoFetch, fetchStatus, targetBranchName, manualBranchName, imageReplaceTask, handleFetch]);
   // Auto-select related files effect (Run only AFTER successful fetch and file processing)
   useEffect(() => {
       if (files.length === 0 || imageReplaceTask || fetchStatus !== 'success') return; // Only run on success, not image task

       const newlySelectedPaths = new Set<string>();
       selectedFiles.forEach(path => {
           if (!prevSelectedFilesRef.current.has(path)) {
               newlySelectedPaths.add(path);
           }
       });
       // Also consider if primary highlighted path was just set
        if (primaryHighlightedPath && !prevSelectedFilesRef.current.has(primaryHighlightedPath) && !newlySelectedPaths.has(primaryHighlightedPath)) {
            newlySelectedPaths.add(primaryHighlightedPath);
        }

       if (newlySelectedPaths.size === 0) {
           prevSelectedFilesRef.current = new Set(selectedFiles);
           return; // No newly selected files to process
       }

       const pageFileSuffixes = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'];
       // Check newly selected OR the primary highlighted file if it was just added
       const filesToCheckForImports = Array.from(newlySelectedPaths)
           .filter(path => pageFileSuffixes.some(suffix => path.endsWith(suffix)) || path === primaryHighlightedPath);

        if (filesToCheckForImports.length > 0) {
            const relatedFilesToSelect = new Set<string>();
            let foundRelatedCount = 0;
            filesToCheckForImports.forEach(filePathToCheck => {
                const fileContentNode = files.find(f => f.path === filePathToCheck);
                if (fileContentNode) {
                    const imports = extractImports(fileContentNode.content);
                    imports.forEach(imp => {
                        const resolvedPath = resolveImportPath(imp, fileContentNode.path, files);
                        if (resolvedPath && resolvedPath !== filePathToCheck) {
                            const category = categorizeResolvedPath(resolvedPath);
                            if (category !== 'other') { // Only auto-add non-'other' categorized imports
                                if (!selectedFiles.has(resolvedPath)) { // Check against current selection state
                                    relatedFilesToSelect.add(resolvedPath);
                                    foundRelatedCount++;
                                }
                            }
                        }
                    });
                }
            });

            if (relatedFilesToSelect.size > 0) {
                const finalSelection = new Set([...selectedFiles, ...relatedFilesToSelect]);
                setSelectedFilesState(finalSelection);
                setSelectedFetcherFiles(finalSelection); // Update context
                addToast(`🔗 Автоматически добавлено ${foundRelatedCount} связанных файлов`, 'info');
                prevSelectedFilesRef.current = finalSelection; // Update ref for next run
                return; // Exit early as state was updated
            }
       }

       // Update ref if no related files were added this cycle
       prevSelectedFilesRef.current = new Set(selectedFiles);

   }, [selectedFiles, files, fetchStatus, primaryHighlightedPath, extractImports, resolveImportPath, categorizeResolvedPath, setSelectedFetcherFiles, addToast, imageReplaceTask]); // Dependencies
  useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]); // Cleanup simulation

  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({ handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll: handleClearAll, getKworkInputValue }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);

  // --- Render Logic ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing;
  const showProgressBar = fetchStatus === 'loading' || fetchStatus === 'retrying' || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
  // Disable actions if fetching, loading PRs, AI working, assistant working, parsing, OR if it's an image task (most actions irrelevant)
  const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!imageReplaceTask;
  const isAskAiDisabled = !kworkInputHasContent || isActionDisabled || !!imageReplaceTask; // Disable Ask AI for image task
  const isCopyDisabled = !kworkInputHasContent || isActionDisabled || !!imageReplaceTask; // Disable copy for image task
  const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled || !!imageReplaceTask; // Disable clear for image task
  const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled || !!imageReplaceTask; // Disable add selected for image task
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
                 {!imageReplaceTask && ( // Show standard instructions only if NOT image task
                    <>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Укажи URL/токен/ветку в <span className="text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}>настройках</span> (<FaCodeBranch className="inline text-cyan-400"/>).</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Нажми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы для контекста AI.</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-2">4. Опиши задачу ИЛИ добавь файлы кнопкой (+).</p>
                     <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Нажми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> <span className="text-gray-400 text-xs">(Админ получит уведомление)</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.</p>
                    </>
                 )}
                 {imageReplaceTask && ( // Show specific message for image task
                     <p className="text-blue-300/80 text-xs md:text-sm mb-2">Загрузка файла для замены картинки...</p>
                 )}
            </div>
            {/* Settings Button - Disable if fetcher itself is loading */}
            <motion.button
                onClick={triggerToggleSettingsModal}
                disabled={isLoading || loadingPrs || assistantLoading} // Keep enabled unless critical fetch/PR loading
                 whileHover={{ scale: isLoading ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                 whileTap={{ scale: isLoading ? 1 : 0.95 }}
                 title={isSettingsModalOpen ? "Скрыть настройки" : "Настройки URL/Token/Ветки/PR"}
                 aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки URL/Token"}
                 aria-expanded={isSettingsModalOpen}
                 className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"
            >
                 {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />}
            </motion.button>
        </div>

      {/* Settings Modal */}
       <SettingsModal
            isOpen={isSettingsModalOpen}
            repoUrl={repoUrl}
            setRepoUrl={handleRepoUrlChange}
            token={token}
            setToken={setToken}
            manualBranchName={manualBranchName}
            setManualBranchName={handleManualBranchChange}
            currentTargetBranch={targetBranchName} // Pass combined target branch
            openPrs={openPrs}
            loadingPrs={loadingPrs}
            onSelectPrBranch={handleSelectPrBranch}
            onLoadPrs={handleLoadPrs}
            loading={isLoading || loadingPrs || assistantLoading} // Disable modal inputs if generally busy
       />

      {/* Fetch Button */}
       <div className="mb-4 flex justify-center">
            <motion.button
                onClick={() => {
                    // Allow clicking retry even if status is error/failed_retries
                    handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error', targetBranchName || manualBranchName || null);
                }}
                // Disable based on combined logic, BUT allow click if status is error/failed for retry
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
                 {/* Specific success message for image task */}
                 {fetchStatus === 'success' && imageReplaceTask && files.length > 0 && !isParsing && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Файл ${imageReplaceTask.targetPath.split('/').pop()} для замены картинки загружен.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && !isParsing && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}

      {/* Main Content Area (Grid) */}
       {/* Adjust grid columns based on whether files are loaded OR if there's content in kwork (unless it's image task) */}
       <div className={`grid grid-cols-1 ${ (files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>

         {/* Left Column: File List & Controls - Show if loading OR files are present */}
         {(isLoading || files.length > 0) && (
             <div className="flex flex-col gap-4">
                <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} />
                 {!imageReplaceTask && ( // Don't show auto-ask for image task
                     <div className="flex items-center justify-start gap-2 p-2 bg-gray-700/30 rounded-md">
                        <input
                            type="checkbox" id="autoAskAiCheckbox" checked={autoAskAiEnabled}
                            onChange={(e) => setAutoAskAiEnabled(e.target.checked)}
                            className="form-checkbox h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500/50 focus:ring-offset-gray-800 cursor-pointer"
                            disabled={isActionDisabled} // Disable based on combined state
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
                    isLoading={isLoading}
                    toggleFileSelection={toggleFileSelection}
                    isActionDisabled={isActionDisabled} // Pass combined disabled state
                    onAddSelected={() => handleAddSelected(autoAskAiEnabled)}
                    onAddImportant={handleAddImportantFiles}
                    onAddTree={handleAddFullTree}
                    onSelectHighlighted={selectHighlightedFiles}
                 />
             </div>
         )}

         {/* Right Column: Request Input & AI Trigger - Show only if files are loaded OR Kwork has content (and not image task) */}
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
                      aiActionLoading={aiActionLoading} // Pass AI loading state
                      onAddSelected={() => handleAddSelected(autoAskAiEnabled)}
                      isAddSelectedDisabled={isAddSelectedDisabled}
                      selectedFetcherFilesCount={selectedFiles.size}
                 />
             </div>
         ) : null }

         {/* Placeholder/Message during image replacement flow AFTER fetch success */}
         {imageReplaceTask && fetchStatus === 'success' && files.length > 0 && (
            // This takes the place of the Kwork input column if files were loaded for image task
            <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed border-blue-400 min-h-[200px]`}>
                 {(assistantLoading || aiActionLoading) ? ( <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" /> ) : ( <FaCircleCheck className="text-green-400 text-3xl mb-3" /> )}
                <p className="text-sm text-blue-300">
                    {(assistantLoading || aiActionLoading) ? "Обработка замены картинки..." : `Файл ${imageReplaceTask.targetPath.split('/').pop()} готов к замене.`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                     {(assistantLoading || aiActionLoading) ? "Создание/обновление PR..." : "Перехожу к созданию PR в Ассистенте..."}
                </p>
            </div>
         )}

      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;