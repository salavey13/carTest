"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy, FaBroom } from "react-icons/fa6";
import { motion } from "framer-motion";

import { fetchRepoContents } from "@/app/actions_github/actions"; // Assuming fetch definition returns { success: boolean, files: FileNode[], error?: string }
import { useAppContext } from "@/contexts/AppContext"; // Use for openLink
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus } from "@/contexts/RepoXmlPageContext"; // Use context

import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList"; // Updated FileList component
import SelectedFilesPreview from "./repo/SelectedFilesPreview"; // Original preview component
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";

// Define FileNode
export interface FileNode {
  path: string;
  content: string;
}

// Helper: Get Language (for SelectedFilesPreview and adding code blocks)
const getLanguage = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch(extension) {
        case 'ts': return 'typescript';
        case 'tsx': return 'typescript';
        case 'js': return 'javascript';
        case 'jsx': return 'javascript';
        case 'py': return 'python';
        case 'css': return 'css';
        case 'html': return 'html';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'sql': return 'sql';
        case 'php': return 'php';
        case 'rb': return 'ruby';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'cs': return 'csharp';
        case 'sh': return 'bash';
        case 'yml':
        case 'yaml': return 'yaml';
        default: return 'plaintext';
    }
};

// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define categories for highlighting imports
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// Helper to categorize a resolved file path based on your criteria
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => {
    if (!resolvedPath) return 'other'; // Handle null/undefined paths
    const pathLower = resolvedPath.toLowerCase();

    // Check for contexts
    if (pathLower.includes('/contexts/') || pathLower.startsWith('contexts/')) return 'context';
    // Check for hooks
    if (pathLower.includes('/hooks/') || pathLower.startsWith('hooks/')) return 'hook';
    // Check for lib
    if (pathLower.includes('/lib/') || pathLower.startsWith('lib/')) return 'lib';
    // Check for components, EXCLUDING components/ui
    if ((pathLower.includes('/components/') || pathLower.startsWith('components/')) && !pathLower.includes('/components/ui/')) return 'component';

    // Everything else we don't specifically care about for *this* highlighting
    return 'other';
};

// --- Component ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => { // No external props needed currently
  // === State ===
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest"); // Default Example URL
  const [token, setToken] = useState<string>(""); // Store GitHub token if needed
  const [files, setFiles] = useState<FileNode[]>([]); // All fetched files
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set()); // User-selected files
  const [extractLoading, setExtractLoading] = useState<boolean>(false); // Local loading for button state
  const [progress, setProgress] = useState<number>(0); // Progress bar state
  const [error, setError] = useState<string | null>(null); // Local error display for fetch issues
  const [kworkInput, setKworkInput] = useState<string>(""); // Textarea content for the AI request
  const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null); // Path determined from URL param
  // Store categorized paths for secondary highlighting
  const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<Record<ImportCategory, string[]>>({
      component: [],
      context: [],
      hook: [],
      lib: [],
      other: [], // Keep track of others if needed later, but won't be used for highlighting
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false); // Toggle for settings modal

  // === Context ===
  const { user, openLink } = useAppContext(); // Example context usage
  const {
    fetchStatus, setFetchStatus, setRepoUrlEntered, setFilesFetched,
    setSelectedFetcherFiles, setKworkInputHasContent, setRequestCopied,
    scrollToSection, kworkInputRef,
    setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles // Resetters from context
  } = useRepoXmlPageContext(); // Context specific to this page/feature

  // === URL Params & Derived State ===
  const searchParams = useSearchParams();
  const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]); // Get 'path' query param
  const ideaFromUrl = useMemo(() => { // Get 'idea' query param (URL decoded)
      return searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "";
  }, [searchParams]);
  const autoFetch = useMemo(() => !!highlightedPathFromUrl, [highlightedPathFromUrl]); // Trigger fetch if path param exists
  const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг."; // Default AI task
  // Files to always consider for auto-selection (separate from dynamic import highlighting)
  const importantFiles = useMemo(() => [
      "contexts/AppContext.tsx",
      "hooks/useTelegram.ts",
      "app/layout.tsx",
      "hooks/supabase.ts",
      "app/actions.ts",
      "app/actions/dummy_actions.ts",
      "app/webhook-handlers/disable-dummy-mode.ts",
      "package.json",
      "tailwind.config.ts"
  ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for progress simulation
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for fetch simulation

  // === Utility Functions ===
   const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        console.log(`Toast [${type}]: ${message}`);
        // Basic styling, replace with your actual sonner toast styling setup
        let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" };
        if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'warning') style = { background: "rgba(217, 119, 6, 0.9)", color: "#ffffff", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(3px)" };
        toast(message, { style: style, duration: type === 'error' ? 5000 : 3000 });
   }, []);

   // Tries to find the actual file path corresponding to a Next.js route path
   const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string => {
        const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
        // Handle root path
        if (!cleanPath || cleanPath === 'app' || cleanPath === '/') {
            const rootPaths = ['app/page.tsx', 'app/page.js', 'app/index.tsx', 'app/index.js', 'src/app/page.tsx', 'src/app/page.js'];
            for (const rp of rootPaths) {
                if (allActualFilePaths.includes(rp)) return rp;
            }
            console.warn(`getPageFilePath: Root path mapping not found for "${routePath}". Defaulting to app/page.tsx`);
            return 'app/page.tsx'; // Default guess
        }

        const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`; // Prefer app/ but check src/app/
        const inputSegments = pathWithApp.split('/');
        const numInputSegments = inputSegments.length;

        // Try direct match first (e.g., /dashboard -> app/dashboard/page.tsx)
        const potentialDirectPaths = [`${pathWithApp}/page.tsx`, `${pathWithApp}/page.js`, `${pathWithApp}/index.tsx`, `${pathWithApp}/index.js`];
        for (const pdp of potentialDirectPaths) {
            if (allActualFilePaths.includes(pdp)) return pdp;
        }

        // Try dynamic matching (e.g., /users/[id] matches app/users/[id]/page.tsx)
        const pageFiles = allActualFilePaths.filter(p => (p.startsWith('app/') || p.startsWith('src/app/')) && (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js')));
        for (const actualPath of pageFiles) {
            const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => actualPath.endsWith(s));
            if (!suffix) continue;
            const actualPathBase = actualPath.substring(0, actualPath.length - suffix.length);
            const actualSegments = actualPathBase.split('/');

            if (actualSegments.length !== numInputSegments) continue; // Must have same number of segments

            let isDynamicMatch = true;
            for (let i = 0; i < numInputSegments; i++) {
                const inputSeg = inputSegments[i];
                const actualSeg = actualSegments[i];
                if (inputSeg === actualSeg) continue; // Segments match literally
                else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue; // Actual segment is dynamic
                else { isDynamicMatch = false; break; } // Mismatch
            }

            if (isDynamicMatch) {
                console.log(`getPageFilePath: Dynamic match found for route "${routePath}" -> file "${actualPath}"`);
                return actualPath;
            }
        }

        console.warn(`getPageFilePath: No direct or dynamic page file match found for route "${routePath}". Falling back to direct guess: "${potentialDirectPaths[0]}"`);
        return potentialDirectPaths[0]; // Fallback to the most likely direct path guess
   }, []);

    // Extracts import/require paths from code content
   const extractImports = useCallback((content: string): string[] => {
        const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g;
        const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g;
        const imports = new Set<string>(); let match;
        while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]);
        while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]);
        return Array.from(imports);
   }, []);

    // Resolves an import path (like '@/lib/utils', './styles.css') to a full file path within the fetched files
   const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
        const allPaths = allFiles.map(f => f.path);
        // Define supported extensions for resolving extensionless imports
        const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.md']; // Add more if needed

        const tryPaths = (basePath: string): string | null => {
            const pathsToTry: string[] = [];
            const hasExplicitExtension = /\.\w+$/.test(basePath);

            if (hasExplicitExtension) {
                pathsToTry.push(basePath); // Check the path as is
            } else {
                // Try with extensions
                supportedExtensions.forEach(ext => pathsToTry.push(basePath + ext));
                // Try index file with extensions
                supportedExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`));
            }

            for (const p of pathsToTry) {
                if (allPaths.includes(p)) {
                    // console.log(`Resolved '${importPath}' to '${p}'`); // Debugging
                    return p;
                }
            }
            return null;
        };

        // 1. Handle Aliases (e.g., @/...)
        if (importPath.startsWith('@/')) {
            const possibleSrcBases = ['src/', 'app/', '']; // Common base folders for aliases
            const pathSegment = importPath.substring(2);
            for (const base of possibleSrcBases) {
                const resolved = tryPaths(base + pathSegment);
                if (resolved) return resolved;
            }
             // Try resolving relative to common alias roots directly if base path wasn't enough
            const commonAliasRoots = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/'];
            for(const root of commonAliasRoots) {
                if (pathSegment.startsWith(root)) {
                    const resolved = tryPaths(pathSegment); // Try path segment directly if it looks like components/xxx
                     if (resolved) return resolved;
                }
            }

        // 2. Handle Relative Paths (e.g., ./, ../)
        } else if (importPath.startsWith('.')) {
            const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : '';
            // Basic path normalization (handles './', '../')
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

        // 3. Handle Bare Imports (less likely to be local files, but check common folders)
        } else {
             const searchBases = ['lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/'];
             for (const base of searchBases) {
                 const resolved = tryPaths(base + importPath);
                 if (resolved) return resolved;
             }
        }

        // console.log(`Could not resolve import '${importPath}' from '${currentFilePath}'`); // Debugging
        return null; // Could not resolve
  }, []); // Add dependencies if needed, though these helpers might be stable

  // --- Progress Simulation ---
   const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        progressIntervalRef.current = null; fetchTimeoutRef.current = null;
   }, []);

   const startProgressSimulation = useCallback((estimatedDurationSeconds = 15) => {
        stopProgressSimulation(); setProgress(0); setError(null);
        const intervalTime = 150; // ms
        const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime;
        const incrementBase = 100 / totalSteps; // Target average increment

        progressIntervalRef.current = setInterval(() => {
          setProgress((prev) => {
            const randomFactor = Math.random() * 0.7 + 0.6; // Simulate variability (0.6 to 1.3)
            let nextProgress = prev + (incrementBase * randomFactor);

            // Prevent jumping to 100% too early if fetch is still ongoing
            if (nextProgress >= 95 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) {
                 nextProgress = Math.min(prev + incrementBase * 0.1, 99); // Slow down near the end
            } else if (nextProgress >= 100) {
                 nextProgress = 99.9; // Cap just below 100 until confirmed success/failure
            }
            return nextProgress;
          });
        }, intervalTime);

        // Safety timeout to ensure progress stops even if fetch hangs indefinitely
        fetchTimeoutRef.current = setTimeout(() => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
                if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                    console.warn("Progress simulation timed out while fetch was still in progress.");
                    setProgress(99); // Set to near complete if timed out while loading
                }
            }
            fetchTimeoutRef.current = null;
        }, estimatedDurationSeconds * 1000 + 5000); // Add a buffer
   }, [stopProgressSimulation, fetchStatus]); // Depends on fetchStatus to adjust behaviour near end

  // --- Core Logic Callbacks ---
    // Adds selected files' content to the Kwork input textarea
    const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles;
        if (filesToAdd.size === 0) {
            addToast("Сначала выберите файлы для добавления", 'error'); return;
        }
        const prefix = "Контекст кода для анализа (отвечай полным кодом):\n";
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path)) // Get content for selected files
          .sort((a, b) => a.path.localeCompare(b.path)) // Sort for consistency
          .map((file) => `\`\`\`${getLanguage(file.path)}\n// /${file.path}\n${file.content}\n\`\`\``) // Format as markdown code block
          .join("\n\n");

        setKworkInput((prev) => {
            const newContent = `${prefix}${markdownTxt}`;
            const contextRegex = /^Контекст кода для анализа.*?:\n/im; // Check if prefix already exists

             // Append if context already exists, otherwise prepend or replace
             if (contextRegex.test(prev.trim())) {
                 // Append as additional context, maybe with a separator
                 return `${prev.trim()}\n\n---\n[Дополнительный Контекст]\n${markdownTxt}`;
            }
            // If input has content but not the prefix, add context before it
            return prev.trim() ? `${newContent}\n\n${prev.trim()}` : newContent;
        });

        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('extractor'); // Scroll to the input section
    }, [files, selectedFiles, scrollToSection, addToast, setKworkInput, getLanguage]); // Added dependencies

    // Copies text (usually the Kwork input) to the clipboard
    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInput;
        if (!content.trim()) {
            addToast("Нет текста для копирования", 'error'); return false;
        }
        try {
            navigator.clipboard.writeText(content);
            addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            setRequestCopied(true); // Update context state
            if (shouldScroll) {
                 scrollToSection('executor'); // Scroll to the next section (AI response area)
            }
            return true;
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            addToast("Ошибка копирования", 'error');
            return false;
        }
    }, [kworkInput, scrollToSection, addToast, setRequestCopied]); // Added dependencies

    // Clears selected files and the Kwork input field
    const handleClearAll = useCallback(() => {
        console.log("[handleClearAll] Clearing state.");
        setSelectedFilesState(new Set()); // Clear local selection
        setSelectedFetcherFiles(new Set()); // Update context selection
        setKworkInput(""); // Clear text input
        setPrimaryHighlightedPath(null); // Clear primary highlight
        // Reset secondary highlights
        setSecondaryHighlightedPaths({ component: [], context: [], hook: [], lib: [], other: [] });
        // Optionally reset downstream states (like AI response) if desired
        // setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
        addToast("Поле ввода и выбор файлов очищены ✨", 'success');
        if (kworkInputRef.current) { kworkInputRef.current.focus(); } // Focus input after clearing
    }, [setSelectedFetcherFiles, setKworkInput, addToast, kworkInputRef]); // Added dependencies

  // --- Fetch Logic with Retries ---
   const handleFetch = useCallback(async (isManualRetry = false) => {
    console.log(`[handleFetch] Called. isManualRetry: ${isManualRetry}, Current Status: ${fetchStatus}`);
    // Basic validation
    if (!repoUrl.trim()) {
        addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); setIsSettingsOpen(true); return;
    }
    // Prevent multiple fetches running simultaneously unless it's a manual retry
    if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) {
        addToast("Извлечение уже идет...", "info"); return;
    }
    // Allow manual retry even if status isn't 'failed' or 'error' (user override)
    if (isManualRetry && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
        console.warn(`Manual retry requested but status is ${fetchStatus}. Allowing anyway.`);
    }

    // Reset state for new fetch
    setExtractLoading(true); setError(null); setFiles([]);
    setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set());
    // setKworkInput(""); // Optionally clear input on new fetch - currently keeps it
    setFilesFetched(false, null, []); setRequestCopied(false);
    setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
    setPrimaryHighlightedPath(null);
    // Reset secondary highlights on new fetch
    setSecondaryHighlightedPaths({ component: [], context: [], hook: [], lib: [], other: [] });

    addToast("Запрос репозитория...", 'info');
    startProgressSimulation(20); // Start progress simulation (e.g., 20 seconds estimated)

    const maxRetries = 2; const retryDelayMs = 2000;
    let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;

    // Retry Loop
    while (currentTry <= maxRetries) {
        currentTry++;
        const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
        setFetchStatus(currentStatus); // Update global fetch status
        console.log(`[handleFetch] Attempt ${currentTry}/${maxRetries + 1}, Status: ${currentStatus}`);

        if (currentStatus === 'retrying') {
            addToast(`Попытка ${currentTry} из ${maxRetries+1}...`, 'info');
            await delay(retryDelayMs); // Wait before retrying
            startProgressSimulation(15 + (currentTry * 5)); // Restart simulation with longer estimate
        }

        try {
          // *** THE ACTUAL FETCH CALL ***
          result = await fetchRepoContents(repoUrl, token || undefined);
          console.log(`[handleFetch] Attempt ${currentTry} raw result:`, result); // Log raw API response

          // --- SUCCESS HANDLING ---
          if (result?.success && Array.isArray(result.files)) {
            console.log(`[handleFetch] Success on attempt ${currentTry}. Files: ${result.files.length}`);
            stopProgressSimulation(); setProgress(100); setFetchStatus('success');
            addToast(`Извлечено ${result.files.length} файлов!`, 'success');
            setFiles(result.files); setIsSettingsOpen(false); setExtractLoading(false);

            const fetchedFiles = result.files;
            const allActualFilePaths = fetchedFiles.map(f => f.path);
            let primaryPath: string | null = null;
            // Initialize categorized secondary paths using Sets for efficient addition
            const categorizedSecondaryPaths: Record<ImportCategory, Set<string>> = {
                component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set()
            };
            let filesToSelect = new Set<string>(); // Files to automatically select based on logic

            // --- Highlighting Logic based on URL param ---
            if (highlightedPathFromUrl) {
                primaryPath = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                const pageFile = fetchedFiles.find((file) => file.path === primaryPath);

                if (pageFile) {
                    console.log(`Primary file found: ${primaryPath}`);
                    filesToSelect.add(primaryPath); // Auto-select the primary file
                    const rawImports = extractImports(pageFile.content);
                    console.log(`Raw imports from ${primaryPath}:`, rawImports);

                    // Resolve and categorize imports
                    for (const imp of rawImports) {
                        const resolvedPath = resolveImportPath(imp, pageFile.path, fetchedFiles);
                        if (resolvedPath && resolvedPath !== primaryPath) { // Ensure resolved and not self-import
                            const category = categorizeResolvedPath(resolvedPath);
                            // Add to the categorized Set
                            categorizedSecondaryPaths[category].add(resolvedPath);
                            // Auto-select the highlighted imports if auto-selecting primary
                            if (category !== 'other') { // Only auto-select the desired categories
                                filesToSelect.add(resolvedPath);
                            }
                            console.log(`  Resolved import: '${imp}' -> '${resolvedPath}' (Category: ${category})`);
                        } else if (!resolvedPath) {
                             console.log(`  Could not resolve import: '${imp}'`);
                        }
                    }
                } else {
                    addToast(`Файл страницы для URL (${highlightedPathFromUrl} -> ${primaryPath || 'not found'}) не найден`, 'warning');
                    primaryPath = null; // Reset primary path if not found
                }
            }
            // --- End Highlighting Logic ---

            // Also add 'importantFiles' to the auto-select list
            importantFiles.forEach(path => {
                if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) {
                    filesToSelect.add(path);
                }
            });

            // --- Update State ---
            setPrimaryHighlightedPath(primaryPath);
            // Convert Sets to arrays for state update
            const finalSecondaryPathsState = {
                component: Array.from(categorizedSecondaryPaths.component),
                context: Array.from(categorizedSecondaryPaths.context),
                hook: Array.from(categorizedSecondaryPaths.hook),
                lib: Array.from(categorizedSecondaryPaths.lib),
                other: Array.from(categorizedSecondaryPaths.other),
            };
            setSecondaryHighlightedPaths(finalSecondaryPathsState);

            // Update context with fetch status and the flat list of *all* resolved secondary paths
            const allSecondaryPathsArray = Object.values(finalSecondaryPathsState).flat();
            setFilesFetched(true, primaryPath, allSecondaryPathsArray);

            // --- Auto-select and Generate Request Logic (if URL params provided) ---
            if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
                 addToast(`Авто-выбор ${filesToSelect.size} файлов и генерация запроса...`, 'info');
                 setSelectedFilesState(filesToSelect); // Set local selection
                 setSelectedFetcherFiles(filesToSelect); // Update context selection
                 const task = ideaFromUrl || DEFAULT_TASK_IDEA;
                 const prefix = "Контекст кода для анализа (отвечай полным кодом):\n";
                 const markdownTxt = fetchedFiles
                    .filter(f => filesToSelect.has(f.path))
                    .sort((a,b) => a.path.localeCompare(b.path))
                    .map(f => `\`\`\`${getLanguage(f.path)}\n// /${f.path}\n${f.content}\n\`\`\``)
                    .join("\n\n");
                const combinedContent = `${task}\n\n${prefix}${markdownTxt}`;
                setKworkInput(combinedContent); // Set the generated text
                await delay(350); // Small delay for UI update
                const copied = handleCopyToClipboard(combinedContent, false); // Copy to clipboard, don't scroll yet
                if (copied) {
                    addToast("КОНТЕКСТ В БУФЕРЕ! Открываю AI...", 'success');
                    scrollToSection('executor'); // Scroll to AI section
                    setTimeout(() => openLink('https://aistudio.google.com'), 800); // Open AI link after a delay
                } else {
                   addToast("Ошибка авто-копирования в буфер. Переход отменен.", 'error');
                   scrollToSection('extractor'); // Scroll back to input section on error
                }
            } else {
                 // --- Auto-select files even if not generating full request ---
                 if (filesToSelect.size > 0 && (!highlightedPathFromUrl || !ideaFromUrl)) { // Select if files were identified but no URL idea provided
                    setSelectedFilesState(filesToSelect);
                    setSelectedFetcherFiles(filesToSelect); // Update context selection
                    // Create a more informative toast message about what was selected
                    const numHighlighted = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size;
                    const numImportantOnly = filesToSelect.size - (primaryPath ? 1 : 0) - numHighlighted;
                    let selectMsg = `Авто-выбрано: `;
                    const parts = [];
                    if(primaryPath) parts.push(`1 основной`);
                    if(numHighlighted > 0) parts.push(`${numHighlighted} связанных`);
                    if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`);
                    selectMsg += parts.join(', ') + '.';
                    addToast(selectMsg, 'info');
                 }
                // --- Scroll to highlighted file in the list ---
                if (primaryPath) {
                    setTimeout(() => {
                        const elementId = `file-${primaryPath}`;
                        const fileElement = document.getElementById(elementId);
                        if (fileElement) {
                             // Smooth scroll and temporary highlight effect
                             fileElement.scrollIntoView({ behavior: "smooth", block: "center" });
                             fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000');
                             setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'), 2500); // Remove highlight after some time
                        } else { console.warn(`Element with ID ${elementId} not found for scrolling.`); }
                    }, 400); // Delay scrolling slightly for UI to render
                } else if (fetchedFiles.length > 0) {
                     // Scroll to the top of the file list if no primary highlight but files exist
                    const el = document.getElementById('file-list-container');
                    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }
            return; // <<< SUCCESS EXIT POINT >>>

          // --- FAILURE HANDLING for this attempt ---
          } else {
              const errorMessage = result?.error || "Не удалось получить файлы (ответ API пуст или некорректен)";
              console.error(`[handleFetch] Attempt ${currentTry} failed: ${errorMessage}`);
              throw new Error(errorMessage); // Throw to be caught by the catch block below
          }
        } catch (err: any) {
          console.error(`[handleFetch] Error during attempt ${currentTry}:`, err);
          const displayError = err?.message || "Неизвестная ошибка при извлечении";
          setError(`Попытка ${currentTry}: ${displayError}`); // Show error message for this attempt

          // --- FINAL FAILURE HANDLING (Max retries reached) ---
          if (currentTry > maxRetries) {
            console.error(`[handleFetch] Final attempt failed. Max retries (${maxRetries}) reached.`);
            stopProgressSimulation(); setFetchStatus('failed_retries'); setProgress(0);
            addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error');
            setFilesFetched(false, null, []); // Update context about failure
            setExtractLoading(false); // Stop loading indicator
            return; // <<< FINAL FAILURE EXIT POINT >>>
          }
          // Continue to the next iteration of the while loop (retry)
        }
    } // End while loop

    // This part should theoretically not be reached if success/final failure returns properly
    console.warn("[handleFetch] Reached end of function unexpectedly after loop.");
    stopProgressSimulation();
    if (fetchStatus !== 'success') { // If loop finished without success
        setFetchStatus(error ? 'failed_retries' : 'error'); // Set final status based on whether an error was recorded
        setProgress(0);
        setFilesFetched(false, null, []);
    }
    setExtractLoading(false);

   }, [ // Dependencies for handleFetch
        // State
        repoUrl, token, fetchStatus, files, selectedFiles, kworkInput,
        // State Setters used inside
        setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setExtractLoading,
        setPrimaryHighlightedPath, setSecondaryHighlightedPaths, setIsSettingsOpen, setKworkInput,
        // Context Setters used inside
        setSelectedFetcherFiles, setFilesFetched, setRequestCopied, setAiResponseHasContent,
        setFilesParsed, setSelectedAssistantFiles, setRepoUrlEntered,
        // Props / Params / Derived State
        highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA,
        // Callbacks used inside
        addToast, startProgressSimulation, stopProgressSimulation, getLanguage,
        getPageFilePath, extractImports, resolveImportPath, handleCopyToClipboard,
        // Context values/functions used inside
        openLink, scrollToSection,
        // Refs (stable, but good practice to list if accessed)
        // kworkInputRef (used in handleClearAll, not directly here but related)
   ]);


  // --- Other Callbacks ---
    // Manually selects files identified as primary or secondary highlighted
   const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles);
        let newlySelectedCount = 0;

        // Combine all desired secondary paths (component, context, hook, lib)
        const allHighlightableSecondary = [
            ...secondaryHighlightedPaths.component,
            ...secondaryHighlightedPaths.context,
            ...secondaryHighlightedPaths.hook,
            ...secondaryHighlightedPaths.lib,
        ];

        // Add primary if it exists and isn't selected
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) {
             filesToSelect.add(primaryHighlightedPath); newlySelectedCount++;
        }
        // Add secondary if they exist and aren't selected
        allHighlightableSecondary.forEach(path => {
            if (files.some(f => f.path === path) && !filesToSelect.has(path)) {
                filesToSelect.add(path); newlySelectedCount++;
            }
        });

        if (newlySelectedCount > 0) {
            setSelectedFilesState(filesToSelect); // Update local state
            setSelectedFetcherFiles(filesToSelect); // Update context state
            addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info');
        } else { addToast("Все связанные файлы уже выбраны или не найдены", 'info'); }
   }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);

    // Toggles the selection state of a single file
   const toggleFileSelection = useCallback((path: string) => {
    setSelectedFilesState(prevSet => {
        const newSet = new Set(prevSet);
        if (newSet.has(path)) newSet.delete(path); else newSet.add(path);
        setSelectedFetcherFiles(newSet); // Keep context in sync
        return newSet;
    });
  }, [setSelectedFetcherFiles]);

    // Adds files marked as 'important' to the current selection
   const handleAddImportantFiles = useCallback(() => {
    let addedCount = 0;
    const filesToAdd = new Set(selectedFiles); // Start with current selection
    importantFiles.forEach(path => {
        // Check if the important file exists in fetched files and is not already selected
        if (files.some(f => f.path === path) && !selectedFiles.has(path)) {
             filesToAdd.add(path); addedCount++;
        }
    });
    if (addedCount === 0) {
        addToast("Важные файлы уже выбраны или не найдены в репозитории", 'info'); return;
    }
    setSelectedFilesState(filesToAdd); // Update local state
    setSelectedFetcherFiles(filesToAdd); // Update context state
    addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
   }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);

    // Adds a simple file tree structure to the Kwork input
   const handleAddFullTree = useCallback(() => {
    if (files.length === 0) {
        addToast("Нет файлов для отображения дерева", 'error'); return;
    }
    // Create a sorted list of file paths
    const treeOnly = files.map((file) => `- /${file.path}`).sort().join("\n"); // Add '/' prefix for clarity
    const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;
    let added = false;
    setKworkInput((prev) => {
        const trimmedPrev = prev.trim();
        // Avoid adding the tree multiple times
        if (/Структура файлов проекта:\s*```/im.test(trimmedPrev)) {
            return prev; // Already contains tree structure
        }
        added = true;
        // Append tree structure, separated by newlines
        return trimmedPrev ? `${trimmedPrev}\n\n${treeContent}` : treeContent;
    });
    if (added) {
        addToast("Дерево файлов добавлено в запрос", 'success');
        scrollToSection('extractor'); // Scroll to the input section
    } else {
        addToast("Дерево файлов уже добавлено", 'info');
    }
  }, [files, setKworkInput, scrollToSection, addToast]);

  // --- Effects ---
  // Update context based on repoUrl input
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); }, [repoUrl, setRepoUrlEntered]);
  // Update context based on kworkInput content
  useEffect(() => { setKworkInputHasContent(kworkInput.trim().length > 0); }, [kworkInput, setKworkInputHasContent]);
  // Trigger auto-fetch if URL param is present and fetch hasn't run or failed
  useEffect(() => {
    if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
        console.log("Auto-fetching due to URL parameter 'path'...");
        handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus]); // handleFetch is stable due to useCallback with dependencies

  // Cleanup progress simulation interval on component unmount
  useEffect(() => {
      return () => {
          stopProgressSimulation();
      };
  }, [stopProgressSimulation]);


  // === Imperative Handle ===
  // Expose specific functions to parent components via ref
   useImperativeHandle(ref, () => ({
        handleFetch,
        selectHighlightedFiles,
        handleAddSelected,
        handleCopyToClipboard,
        clearAll: handleClearAll, // Expose clearAll function
    }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll]); // Include all exposed functions


  // --- Render Logic ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const isFetchDisabled = isLoading || !repoUrl.trim(); // Disable fetch if loading or no URL
  const showProgressBar = isLoading || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries'; // Show progress bar in relevant states
  // Calculate disable states for RequestInput buttons
  const isCopyDisabled = !kworkInput.trim() || isLoading;
  const isClearDisabled = (!kworkInput.trim() && selectedFiles.size === 0) || isLoading;

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Header & Settings Toggle */}
      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="flex-grow">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
               <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода
            </h2>
             {/* Instructions */}
             <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 1. Укажи URL репозитория (и <span className="text-cyan-400 cursor-pointer hover:underline" onClick={() => setIsSettingsOpen(true)}>токен</span>, если приватный).</p>
             <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 2. Нажми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p>
             <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 3. Выбери файлы для контекста AI.</p>
             <p className="text-yellow-300/80 text-xs md:text-sm mb-2"> 4. Опиши задачу и добавь код кнопками.</p>
        </div>
        {/* Settings Toggle Button */}
        <motion.button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0"
            whileHover={{ scale: 1.1, rotate: isSettingsOpen ? 10 : -10 }} whileTap={{ scale: 0.95 }}
            title={isSettingsOpen ? "Скрыть настройки" : "Показать настройки URL/Token"}
            aria-label={isSettingsOpen ? "Скрыть настройки" : "Показать настройки URL/Token"}
            aria-expanded={isSettingsOpen}
        >
            {isSettingsOpen ? <FaCircleChevronUp className="text-cyan-400 text-xl" /> : <FaCircleChevronDown className="text-cyan-400 text-xl" />}
        </motion.button>
      </div>

      {/* Settings Modal Component */}
      <SettingsModal
          isOpen={isSettingsOpen}
          repoUrl={repoUrl}
          setRepoUrl={setRepoUrl}
          token={token}
          setToken={setToken}
          loading={isLoading} // Pass loading state to potentially disable input
          onClose={() => setIsSettingsOpen(false)}
      />

      {/* Fetch Button */}
      <div className="mb-4 flex justify-center">
          <motion.button
              onClick={() => handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error')} // Allow click on error/fail for retry
              disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')} // Disable if loading or no URL, unless failed
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${
                 fetchStatus === 'failed_retries' || fetchStatus === 'error'
                   ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-red-500/30 hover:shadow-red-500/40' // Error/Fail state style
                   : 'from-purple-600 to-cyan-500 shadow-purple-500/30 hover:shadow-cyan-500/40' // Default/Success state style
              } transition-all ${isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? "opacity-60 cursor-not-allowed brightness-75" : "hover:brightness-110 active:scale-[0.98]"}`}
              whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }}
              whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }}
          >
              {/* Button Icon and Text based on status */}
              {isLoading ? <FaArrowsRotate className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)}
              {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")}
          </motion.button>
      </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]"> {/* Min height to prevent layout shift */}
                <ProgressBar
                     status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} // Map failed_retries to error style
                     progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} // Show 100 on success, 0 on error, else current progress
                />
                {/* Status Messages */}
                {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение: {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повторная попытка)' : ''}</p>}
                {fetchStatus === 'success' && files.length > 0 && (
                    <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно извлечено ${files.length} файлов.`} </div>
                )}
                 {fetchStatus === 'success' && files.length === 0 && (
                    <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> Успешно, но не найдено подходящих файлов. </div>
                )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && (
                    <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div>
                 )}
            </div>
        )}

      {/* Main Content Area (Files & Input) */}
      {/* Grid layout: 1 column on small screens, 2 columns on medium+ if files or input are present */}
      <div className={`grid grid-cols-1 ${files.length > 0 || kworkInput ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>

         {/* Left Column: File List & Controls */}
         {/* Render file list area if loading, or if fetch wasn't an error/failure */}
         {(isLoading || (files.length > 0 && fetchStatus !== 'error' && fetchStatus !== 'failed_retries')) && (
             <div className="flex flex-col gap-4">
                {/* Selected Files Preview (Shows code snippets) */}
                <SelectedFilesPreview
                    selectedFiles={selectedFiles}
                    allFiles={files}
                    getLanguage={getLanguage} // Pass language helper
                />
                {/* File List Component (Shows selectable file names with highlights) */}
                <FileList
                  id="file-list-container" // ID for scrolling
                  files={files}
                  selectedFiles={selectedFiles}
                  primaryHighlightedPath={primaryHighlightedPath} // Pass primary highlight path
                  secondaryHighlightedPaths={secondaryHighlightedPaths} // Pass categorized secondary paths
                  importantFiles={importantFiles} // Pass list of important files for badge
                  isLoading={isLoading} // Pass loading state
                  toggleFileSelection={toggleFileSelection} // Pass selection handler
                  onAddSelected={() => handleAddSelected()} // Pass add selected handler
                  onAddImportant={() => handleAddImportantFiles()} // Pass add important handler
                  onAddTree={() => handleAddFullTree()} // Pass add tree handler
                  onSelectHighlighted={selectHighlightedFiles} // Pass handler to select highlighted files
                />
             </div>
         )}

         {/* Right Column: Request Input */}
         {/* Render input area if fetch succeeded, or if there's existing input, or if files are loaded (even if fetch failed but files were previously loaded) */}
         {(fetchStatus === 'success' || kworkInput.trim().length > 0 || files.length > 0 ) ? (
             <div id="kwork-input-section">
                 <RequestInput
                    kworkInput={kworkInput} // Pass input content state
                    setKworkInput={setKworkInput} // Pass state setter
                    kworkInputRef={kworkInputRef} // Pass ref from context
                    onCopyToClipboard={() => handleCopyToClipboard()} // Pass copy handler
                    onClearAll={() => handleClearAll()} // Pass clear handler
                    isCopyDisabled={isCopyDisabled} // Pass calculated disabled state
                    isClearDisabled={isClearDisabled} // Pass calculated disabled state
                 />
             </div>
         ) : null } {/* Don't render input area initially or on hard error with no files */}

      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher'; // Set display name for DevTools
export default RepoTxtFetcher;