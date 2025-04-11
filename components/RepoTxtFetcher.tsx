// /components/RepoTxtFetcher.tsx
"use client";

    import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
    import { useSearchParams } from "next/navigation";
    import { toast } from "sonner";
    import {
        FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
        FaBroom, FaRobot, // Keep base icons
    } from "react-icons/fa6";
    import { motion } from "framer-motion";

    // Actions & Context
    import { fetchRepoContents } from "@/app/actions_github/actions";
    import { useAppContext } from "@/contexts/AppContext";
    // CORRECTED Import: Removed categorizeResolvedPath and ImportCategory
    import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest } from "@/contexts/RepoXmlPageContext";

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
      const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest"); // Local state for input field in modal
      const [token, setToken] = useState<string>(""); // Local state for token input in modal
      const [files, setFiles] = useState<FileNode[]>([]); // Fetched files
      const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set()); // Paths of selected files in Fetcher list
      const [extractLoading, setExtractLoading] = useState<boolean>(false); // Local loading for Fetch button UI only
      const [progress, setProgress] = useState<number>(0); // Fetch progress simulation
      const [error, setError] = useState<string | null>(null); // Fetch error message
      const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null); // Path from URL param
      const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] }); // Resolved imports
      const [autoAskAiEnabled, setAutoAskAiEnabled] = useState<boolean>(false); // Toggle for auto-asking AI

      // === Context ===
      const { user, openLink } = useAppContext();
      const {
        // Status & Flags
        fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched,
        selectedFetcherFiles, setSelectedFetcherFiles, kworkInputHasContent, setKworkInputHasContent,
        setRequestCopied, aiActionLoading, currentStep, loadingPrs,
        // Branch & PR state
        targetBranchName, setTargetBranchName,
        manualBranchName, setManualBranchName,
        openPrs, setOpenPrs, setLoadingPrs,
        // Modal state & trigger
        isSettingsModalOpen, triggerToggleSettingsModal,
        // Refs & Callbacks
        kworkInputRef, triggerAskAi, triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection, triggerFetch
      } = useRepoXmlPageContext();

      // === URL Params & Derived State ===
      const searchParams = useSearchParams();
      const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
      const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
      const autoFetch = useMemo(() => !!highlightedPathFromUrl, [highlightedPathFromUrl]);
      const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";
      const importantFiles = useMemo(() => [
          "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx",
          "hooks/supabase.ts", "app/actions.ts", "app/actions/dummy_actions.ts",
           "app/ai_actions/actions.ts", "app/webhook-handlers/disable-dummy-mode.ts",
           "package.json", "tailwind.config.ts"
      ], []);

      // === Refs ===
      const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
      const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
      const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
      // Link context ref to local ref
      useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);

      // === Utility Functions ===
      const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
            console.log(`Toast [${type}]: ${message}`);
            let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" };
            if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" };
            else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" };
            else if (type === 'warning') style = { background: "rgba(217, 119, 6, 0.9)", color: "#ffffff", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(3px)" };
            toast(message, { style: style, duration: type === 'error' ? 5000 : 3000 });
       }, []);

       // Find page file path corresponding to a URL route path
       const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string => {
            const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
            // Handle root path explicitly
            if (!cleanPath || cleanPath === 'app' || cleanPath === '/') {
                const rootPaths = ['app/page.tsx', 'app/page.js', 'app/index.tsx', 'app/index.js', 'src/app/page.tsx', 'src/app/page.js'];
                for (const rp of rootPaths) { if (allActualFilePaths.includes(rp)) return rp; }
                console.warn(`getPageFilePath: Root path mapping not found for "${routePath}". Defaulting to app/page.tsx`);
                return 'app/page.tsx'; // Fallback
            }
            // Prepend 'app/' if not present
            const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`;
            const inputSegments = pathWithApp.split('/');
            const numInputSegments = inputSegments.length;
            // Check direct matches first (e.g., /about -> app/about/page.tsx)
            const potentialDirectPaths = [`${pathWithApp}/page.tsx`, `${pathWithApp}/page.js`, `${pathWithApp}/index.tsx`, `${pathWithApp}/index.js`];
            for (const pdp of potentialDirectPaths) { if (allActualFilePaths.includes(pdp)) return pdp; }
            // Check dynamic routes (e.g., /posts/[slug] -> app/posts/[slug]/page.tsx)
            const pageFiles = allActualFilePaths.filter(p => (p.startsWith('app/') || p.startsWith('src/app/')) && (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js')));
            for (const actualPath of pageFiles) {
                const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => actualPath.endsWith(s));
                if (!suffix) continue;
                const actualPathBase = actualPath.substring(0, actualPath.length - suffix.length);
                const actualSegments = actualPathBase.split('/');
                if (actualSegments.length !== numInputSegments) continue; // Segment count must match
                let isDynamicMatch = true;
                for (let i = 0; i < numInputSegments; i++) {
                    const inputSeg = inputSegments[i]; const actualSeg = actualSegments[i];
                    if (inputSeg === actualSeg) continue; // Direct match segment
                    else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue; // Dynamic segment match
                    else { isDynamicMatch = false; break; } // Mismatch
                }
                if (isDynamicMatch) { console.log(`getPageFilePath: Dynamic match found: "${routePath}" -> "${actualPath}"`); return actualPath; }
            }
            // Fallback if no match found
            console.warn(`getPageFilePath: No direct or dynamic match for route "${routePath}". Falling back to guess: "${potentialDirectPaths[0]}"`);
            return potentialDirectPaths[0];
       }, []);

       // Extract import paths from file content
       const extractImports = useCallback((content: string): string[] => {
            // Regex for various import syntaxes (including require)
            const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g;
            const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g;
            const imports = new Set<string>();
            let match;
            while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); // Exclude '.' self-imports
            while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]);
            return Array.from(imports);
       }, []);

       // Resolve import path to actual file path within the fetched files
       const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
            const allPaths = allFiles.map(f => f.path);
            const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.md'];

            // Helper to check possible file paths (with/without extension, index files)
            const tryPaths = (basePath: string): string | null => {
                const pathsToTry: string[] = [];
                const hasExplicitExtension = /\.\w+$/.test(basePath);
                if (hasExplicitExtension) pathsToTry.push(basePath); // Check exact path first if extension provided
                else { // Check with common extensions and index files
                    supportedExtensions.forEach(ext => pathsToTry.push(basePath + ext));
                    supportedExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`));
                }
                for (const p of pathsToTry) { if (allPaths.includes(p)) return p; }
                return null; // No match found
            };

            // Handle alias paths (e.g., @/components/...)
            if (importPath.startsWith('@/')) {
                const possibleSrcBases = ['src/', 'app/', '']; // Common project structures
                const pathSegment = importPath.substring(2);
                for (const base of possibleSrcBases) {
                    const resolved = tryPaths(base + pathSegment); if (resolved) return resolved;
                }
                // Check common alias roots directly if not found in src/app bases
                const commonAliasRoots = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/'];
                for(const root of commonAliasRoots) {
                    if (pathSegment.startsWith(root)) { const resolved = tryPaths(pathSegment); if (resolved) return resolved; }
                }
            }
            // Handle relative paths (e.g., ./utils, ../../hooks)
            else if (importPath.startsWith('.')) {
                const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : '';
                // Resolve './' and '../' segments
                const pathParts = (currentDir ? currentDir + '/' + importPath : importPath).split('/');
                const resolvedParts: string[] = [];
                for (const part of pathParts) {
                    if (part === '.' || part === '') continue; // Skip '.' or empty segments
                    if (part === '..') { if (resolvedParts.length > 0) resolvedParts.pop(); } // Go up one directory
                    else resolvedParts.push(part);
                }
                const relativeResolvedBase = resolvedParts.join('/');
                const resolved = tryPaths(relativeResolvedBase); if (resolved) return resolved;
            }
            // Handle direct paths (less common, maybe node_modules-like but local)
            else {
                // Check some common top-level dirs
                const searchBases = ['lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/'];
                for (const base of searchBases) {
                    const resolved = tryPaths(base + importPath); if (resolved) return resolved;
                }
            }
            // If no resolution found
            return null;
      }, []);

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
        const incrementBase = 100 / totalSteps;

        progressIntervalRef.current = setInterval(() => {
            setProgress((prev) => {
                const randomFactor = Math.random() * 0.7 + 0.6; // Simulate variability
                let nextProgress = prev + (incrementBase * randomFactor);
                // Slow down near the end if still loading
                if (nextProgress >= 95 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) {
                    nextProgress = Math.min(prev + incrementBase * 0.1, 99); // Crawl towards 99
                } else if (nextProgress >= 100) {
                    nextProgress = 99.9; // Cap just below 100 until success/failure
                }
                return nextProgress;
            });
        }, intervalTime);

        // Timeout to stop simulation if fetch takes too long
        fetchTimeoutRef.current = setTimeout(() => {
            if (progressIntervalRef.current) { // Check if still running
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
                if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                    console.warn("Progress simulation timed out while fetch was still in progress.");
                    setProgress(99); // Leave it near the end
                }
            }
            fetchTimeoutRef.current = null;
        }, estimatedDurationSeconds * 1000 + 5000); // Add buffer time
    }, [stopProgressSimulation, fetchStatus]);


    // === Core Logic Callbacks ===

    // Update local repoUrl state and notify context/assistant
    const handleRepoUrlChange = useCallback((url: string) => {
        setRepoUrlState(url); // Update local state for the input field
        setRepoUrlEntered(url.trim().length > 0); // Update context flag
        updateRepoUrlInAssistant(url); // Notify Assistant component via context callback
        // Reset PR list and branch selection if URL changes
        setOpenPrs([]);
        setTargetBranchName(null); // Clear selected PR branch
        setManualBranchName(""); // Clear manual branch input
    }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);

    // Update Kwork Input textarea value and context flag
    const updateKworkInput = useCallback((value: string) => {
        if (localKworkInputRef.current) {
            localKworkInputRef.current.value = value;
            const event = new Event('input', { bubbles: true }); // Dispatch event for listeners
            localKworkInputRef.current.dispatchEvent(event);
            setKworkInputHasContent(value.trim().length > 0); // Update context flag
        } else { console.warn("updateKworkInput: localKworkInputRef is null"); }
    }, [setKworkInputHasContent]);

    // Get current value from Kwork Input textarea
    const getKworkInputValue = useCallback((): string => {
        return localKworkInputRef.current?.value || "";
    }, []);


    // Add selected file contents to the Kwork Input
    const handleAddSelected = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles; // Use passed files or local state
        if (filesToAdd.size === 0) { addToast("Сначала выберите файлы для добавления", 'error'); return; }

        const prefix = "Контекст кода для анализа (отвечай полным кодом):\n";
        // Format selected files as markdown code blocks
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path))
          .sort((a, b) => a.path.localeCompare(b.path)) // Sort alphabetically
          .map((file) => `\`\`\`${getLanguage(file.path)}\n// /${file.path}\n${file.content}\n\`\`\``)
          .join("\n\n");

        const currentKworkValue = getKworkInputValue();
        // Extract existing task description (text before the code context prefix)
        const taskText = currentKworkValue.split(prefix)[0]?.trim() || "";
        // Reconstruct the input: task (if any) + prefix + new code context
        const newContent = `${taskText ? taskText + '\n\n' : ''}${prefix}${markdownTxt}`;

        updateKworkInput(newContent); // Update the textarea
        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('kworkInput'); // Scroll to the input section

        // Optionally trigger AI automatically
        if (autoAskAi && autoAskAiEnabled) {
            addToast("Автоматически отправляю запрос AI...", "info");
            await triggerAskAi(); // Use context trigger
        }

    }, [selectedFiles, files, addToast, getKworkInputValue, updateKworkInput, scrollToSection, autoAskAiEnabled, triggerAskAi]); // Dependencies


    // Copy Kwork Input content to clipboard
    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? getKworkInputValue(); // Get content from input ref
        if (!content.trim()) { addToast("Нет текста для копирования", 'error'); return false; }
        try {
            navigator.clipboard.writeText(content);
            addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            setRequestCopied(true); // Update context flag (for manual flow tracking)
            if (shouldScroll) {
                 scrollToSection('executor'); // Scroll to the AI assistant section
            }
            return true;
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            addToast("Ошибка копирования", 'error');
            return false;
        }
    }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]); // Dependencies


    // Clear selections and inputs
    const handleClearAll = useCallback(() => {
        console.log("[handleClearAll] Clearing Fetcher state.");
        setSelectedFilesState(new Set()); // Clear local file selection
        setSelectedFetcherFiles(new Set()); // Clear context file selection
        updateKworkInput(""); // Clear Kwork input textarea
        setPrimaryHighlightedPath(null); // Clear highlighting
        setSecondaryHighlightedPaths({ component: [], context: [], hook: [], lib: [], other: [] });
        // Reset downstream AI states via context setters
        //setAiResponseHasContent(false);
        //setFilesParsed(false);
        //setSelectedAssistantFiles(new Set());
        addToast("Поле ввода и выбор файлов очищены ✨", 'success');
        localKworkInputRef.current?.focus(); // Focus the kwork input
    }, [ setSelectedFetcherFiles, updateKworkInput, addToast]);//, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles ]); // Dependencies


    // --- Fetch Handler (Method exposed via ref, called by context's triggerFetch) ---
    const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
        const effectiveBranch = branchNameToFetch ?? 'default'; // For logging/toasts
        console.log(`[Fetcher:handleFetch] Called. isManualRetry: ${isManualRetry}, Branch: ${effectiveBranch}`);

        // Validation
        if (!repoUrl.trim()) {
            addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым.");
            // Don't toggle settings automatically, let user click
            // triggerToggleSettingsModal(); // Open settings modal if URL is missing
            return;
        }
        // Prevent concurrent fetches unless it's a manual retry
        if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) {
            addToast("Извлечение уже идет...", "info"); return;
        }

        // Reset state before fetching
        setExtractLoading(true); // Set local button loading state
        setError(null); setFiles([]); // Clear previous files and error
        setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); // Clear selections
        setFilesFetched(false, null, []); // Update context: reset fetched status and highlighting
        setRequestCopied(false); // Reset copied flag
        //setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); // Reset AI state
        setPrimaryHighlightedPath(null);
        setSecondaryHighlightedPaths({ component: [], context: [], hook: [], lib: [], other: [] });

        addToast(`Запрос репозитория (${effectiveBranch})...`, 'info');
        startProgressSimulation(20); // Start progress simulation

        const maxRetries = 2; const retryDelayMs = 2000; let currentTry = 0;
        let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;

        // Retry loop
        while (currentTry <= maxRetries) {
            currentTry++;
            const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
            setFetchStatus(currentStatus); // Update context status

            if (currentStatus === 'retrying') {
                addToast(`Попытка ${currentTry} из ${maxRetries+1}...`, 'info');
                await delay(retryDelayMs);
                startProgressSimulation(15 + (currentTry * 5)); // Increase estimated time for retries
            }

            try {
              // --- ACTION CALL ---
              result = await fetchRepoContents(repoUrl, token || undefined, branchNameToFetch);
              console.log(`[Fetcher:handleFetch] Attempt ${currentTry} raw result:`, result);

              // --- SUCCESS ---
              if (result?.success && Array.isArray(result.files)) {
                stopProgressSimulation(); setProgress(100); setFetchStatus('success'); // Update context status
                addToast(`Извлечено ${result.files.length} файлов из ${effectiveBranch}!`, 'success');
                setFiles(result.files); // Set fetched files locally
                 // Close settings modal on successful fetch using context trigger
                 if (isSettingsModalOpen) { // Close only if it was open
                     triggerToggleSettingsModal();
                 }
                setExtractLoading(false); // Turn off local button loading

                // --- Highlighting & Auto-Selection Logic ---
                const fetchedFiles = result.files;
                const allActualFilePaths = fetchedFiles.map(f => f.path);
                let primaryPath: string | null = null;
                const categorizedSecondaryPaths: Record<ImportCategory, Set<string>> = { component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set() };
                let filesToSelect = new Set<string>(); // Files to auto-select

                if (highlightedPathFromUrl) { // If path provided in URL
                    primaryPath = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                    const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
                    if (pageFile) { // If primary file found
                        console.log(`Primary file found: ${primaryPath}`); filesToSelect.add(primaryPath);
                        const rawImports = extractImports(pageFile.content); console.log(`Raw imports from ${primaryPath}:`, rawImports);
                        for (const imp of rawImports) { // Resolve its imports
                            const resolvedPath = resolveImportPath(imp, pageFile.path, fetchedFiles);
                            if (resolvedPath && resolvedPath !== primaryPath) { // If resolved and not self-import
                                const category = categorizeResolvedPath(resolvedPath);
                                categorizedSecondaryPaths[category].add(resolvedPath);
                                // Auto-select non-'other' category imports
                                if (category !== 'other') filesToSelect.add(resolvedPath);
                                console.log(`  Resolved import: '${imp}' -> '${resolvedPath}' (Category: ${category})`);
                            } else if (!resolvedPath) { console.log(`  Could not resolve import: '${imp}'`); }
                        }
                    } else { // Primary file from URL not found
                        addToast(`Файл страницы для URL (${highlightedPathFromUrl} -> ${primaryPath || 'not found'}) не найден в ветке '${effectiveBranch}'.`, 'warning');
                        primaryPath = null; // Reset primary path
                    }
                }
                // Always add important files if found and not already selected
                importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) filesToSelect.add(path); });

                // --- Update State After Highlighting/Selection ---
                setPrimaryHighlightedPath(primaryPath);
                const finalSecondaryPathsState = { component: Array.from(categorizedSecondaryPaths.component), context: Array.from(categorizedSecondaryPaths.context), hook: Array.from(categorizedSecondaryPaths.hook), lib: Array.from(categorizedSecondaryPaths.lib), other: Array.from(categorizedSecondaryPaths.other) };
                setSecondaryHighlightedPaths(finalSecondaryPathsState);
                setFilesFetched(true, primaryPath, Object.values(finalSecondaryPathsState).flat()); // Update context: files ARE fetched

                // --- Auto-Generate Request / Auto-Ask AI ---
                 if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
                     addToast(`Авто-выбор ${filesToSelect.size} файлов и генерация запроса...`, 'info');
                     setSelectedFilesState(filesToSelect); // Select locally
                     setSelectedFetcherFiles(filesToSelect); // Select in context
                     const task = ideaFromUrl || DEFAULT_TASK_IDEA;
                     updateKworkInput(task); // Set the task description
                     // Call handleAddSelected with autoAskAi=true and the specific files
                     await handleAddSelected(true, filesToSelect);
                 } else { // If not auto-asking AI, still auto-select if files were determined
                      if (filesToSelect.size > 0 && (!highlightedPathFromUrl || !ideaFromUrl)) {
                          setSelectedFilesState(filesToSelect); // Select locally
                          setSelectedFetcherFiles(filesToSelect); // Select in context
                          // Create informative toast message about auto-selection
                          const numHighlighted = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size;
                          const numImportantOnly = filesToSelect.size - (primaryPath ? 1 : 0) - numHighlighted;
                          let selectMsg = `Авто-выбрано: `; const parts = [];
                          if(primaryPath) parts.push(`1 основной`);
                          if(numHighlighted > 0) parts.push(`${numHighlighted} связанных`);
                          if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`);
                          selectMsg += parts.join(', ') + '.'; addToast(selectMsg, 'info');
                      }
                     // --- Scroll to Highlighted File ---
                     if (primaryPath) {
                         setTimeout(() => { // Delay slightly for DOM update
                             const elementId = `file-${primaryPath}`; const fileElement = document.getElementById(elementId);
                             if (fileElement) {
                                 fileElement.scrollIntoView({ behavior: "smooth", block: "center" });
                                 // Add temporary visual highlight
                                 fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800');
                                 setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800'), 2500);
                             } else { console.warn(`Element with ID ${elementId} not found for scrolling.`); }
                         }, 400);
                     } else if (fetchedFiles.length > 0) { // If no primary, scroll to top of file list
                         const el = document.getElementById('file-list-container');
                         el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                     }
                 }
                 return; // <<< SUCCESS EXIT POINT >>>

              } else {
                // --- FAILURE (This Attempt) ---
                throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}`);
              }
            } catch (err: any) {
              // --- CATCH Error for This Attempt ---
              console.error(`[Fetcher:handleFetch] Error during attempt ${currentTry}:`, err);
              const displayError = err?.message || "Неизвестная ошибка при извлечении";
              setError(`Попытка ${currentTry}: ${displayError}`); // Set local error state for display

              if (currentTry > maxRetries) { // Final attempt failed
                console.error(`[Fetcher:handleFetch] Final attempt failed. Max retries (${maxRetries}) reached.`);
                stopProgressSimulation(); setFetchStatus('failed_retries'); // Set context status
                setProgress(0); // Reset progress bar
                addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error');
                setFilesFetched(false, null, []); // Update context: fetch failed
                setExtractLoading(false); // Turn off local button loading
                return; // Exit after final failure
              }
              // If not final attempt, loop continues...
            }
        } // End while loop

        // Should not be reached normally, but as a fallback:
        console.warn("[Fetcher:handleFetch] Reached end of function unexpectedly after loop.");
        stopProgressSimulation();
        if (fetchStatus !== 'success') { // If loop finished without success
            setFetchStatus(error ? 'failed_retries' : 'error'); // Set final status based on local error state
            setProgress(0); setFilesFetched(false, null, []);
        }
        setExtractLoading(false); // Ensure loading is off

   }, [ // Dependencies
        repoUrl, token, fetchStatus, // Local state needed for logic
        setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setExtractLoading, // Local setters
        setPrimaryHighlightedPath, setSecondaryHighlightedPaths, // Local setters for highlighting
        setSelectedFetcherFiles, setFilesFetched, setRequestCopied,// setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, // Context setters
        highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA, // URL params and constants
        addToast, startProgressSimulation, stopProgressSimulation, getLanguage, getPageFilePath, extractImports, resolveImportPath, // Utilities
        handleCopyToClipboard, handleAddSelected, getKworkInputValue, // Callbacks depending on state
        openLink, scrollToSection, setKworkInputHasContent, // Other context items / callbacks
        isSettingsModalOpen, // Need modal state to close it on success
        triggerToggleSettingsModal // Context modal trigger
   ]);


    // --- Other Callbacks ---
    // Select files highlighted based on primary path imports
    const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles); // Start with currently selected
        let newlySelectedCount = 0;
        // Combine all potentially highlightable secondary paths (excluding 'other')
        const allHighlightableSecondary = [
            ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context,
            ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib,
        ];
        // Add primary path if it exists, is found, and not already selected
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) {
            filesToSelect.add(primaryHighlightedPath); newlySelectedCount++;
        }
        // Add highlightable secondary paths if found and not already selected
        allHighlightableSecondary.forEach(path => {
            if (files.some(f => f.path === path) && !filesToSelect.has(path)) {
                filesToSelect.add(path); newlySelectedCount++;
            }
        });
        if (newlySelectedCount > 0) {
            setSelectedFilesState(filesToSelect); // Update local selection
            setSelectedFetcherFiles(filesToSelect); // Update context selection
            addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info');
        } else {
            addToast("Все связанные файлы уже выбраны или не найдены", 'info');
        }
    }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]); // Dependencies

    // Toggle selection of a single file
    const toggleFileSelection = useCallback((path: string) => {
        setSelectedFilesState(prevSet => {
            const newSet = new Set(prevSet);
            if (newSet.has(path)) newSet.delete(path); else newSet.add(path);
            setSelectedFetcherFiles(newSet); // Update context selection
            return newSet; // Update local selection
        });
    }, [setSelectedFetcherFiles]);

    // Add predefined important files to selection
    const handleAddImportantFiles = useCallback(() => {
        let addedCount = 0;
        const filesToAdd = new Set(selectedFiles); // Start with current selection
        importantFiles.forEach(path => {
            // Add if file exists in fetched files and is not already selected
            if (files.some(f => f.path === path) && !selectedFiles.has(path)) {
                filesToAdd.add(path); addedCount++;
            }
        });
        if (addedCount === 0) {
            addToast("Важные файлы уже выбраны или не найдены в репозитории", 'info'); return;
        }
        setSelectedFilesState(filesToAdd); // Update local selection
        setSelectedFetcherFiles(filesToAdd); // Update context selection
        addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
    }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]); // Dependencies

    // Add file tree structure to Kwork Input
    const handleAddFullTree = useCallback(() => {
        if (files.length === 0) { addToast("Нет файлов для отображения дерева", 'error'); return; }
        // Create sorted list of file paths
        const treeOnly = files.map((file) => `- /${file.path}`).sort().join("\n");
        const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;
        let added = false;
        // Update Kwork Input, avoiding duplicates
        
        const currentKworkValue = getKworkInputValue();
// Extract existing content
const trimmedValue = currentKworkValue.trim();
// Check for existing tree structure to avoid duplicates
const hasTreeStructure = /Структура файлов проекта:\s*```/im.test(trimmedValue);

if (!hasTreeStructure) {
    // Construct new content: existing content (if any) + new tree content
    const newContent = trimmedValue ? `${trimmedValue}\n\n${treeContent}` : treeContent;
    updateKworkInput(newContent); // Update the textarea
    added = true;
    
}
        

        if (added) {
            addToast("Дерево файлов добавлено в запрос", 'success');
            scrollToSection('kworkInput'); // Scroll to input
        } else {
            addToast("Дерево файлов уже добавлено", 'info');
        }
    }, [files, updateKworkInput, scrollToSection, addToast]); // Dependencies

    // --- PR Selection Handler (Passed to SettingsModal) ---
    const handleSelectPrBranch = useCallback((branch: string | null) => {
        setTargetBranchName(branch); // Update context's target branch
        setManualBranchName(""); // Clear manual input when a PR is selected/deselected
        if (branch) addToast(`Выбрана ветка PR: ${branch}`, 'success');
        else addToast(`Выбор ветки PR снят (используется default или ручная).`, 'info');
        // Modal closure is handled by user interaction within the modal
    }, [setTargetBranchName, setManualBranchName, addToast]);

    // --- Manual Branch Input Handler (Passed to SettingsModal) ---
    const handleManualBranchChange = useCallback((name: string) => {
        setManualBranchName(name); // Update context's manual branch state
        // The context setter `setManualBranchNameCallback` handles updating the effective `targetBranchName`
    }, [setManualBranchName]);

    // --- PR Load Handler (Passed to SettingsModal) ---
    const handleLoadPrs = useCallback(() => {
        // Trigger the PR fetching via context, passing the current repo URL from local state
        triggerGetOpenPRs(repoUrl);
    }, [triggerGetOpenPRs, repoUrl]);


    // --- Effects ---
    // Sync repoUrlEntered flag with local repoUrl input state
    useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); }, [repoUrl, setRepoUrlEntered]);

    // Auto-fetch if URL parameter 'path' is present and fetch is not already in progress/success
    useEffect(() => {
        // Determine the branch to use for auto-fetch (Manual > PR > Default)
        const branchForAutoFetch = manualBranchName.trim() || targetBranchName;
        if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
            console.log(`Auto-fetching due to URL param 'path'. Branch: ${branchForAutoFetch ?? 'Default'}`);
            // Call the fetch handler method directly (exposed via ref)
            handleFetch(false, branchForAutoFetch);
        }
        // This effect should run when relevant dependencies change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus, targetBranchName, manualBranchName, handleFetch]); // Added handleFetch, manualBranchName to dependencies

    // Cleanup simulation timers on component unmount
    useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);


    // === Imperative Handle (Expose methods to parent/context) ===
    useImperativeHandle(ref, () => ({
        handleFetch, // Expose the fetch handler method
        selectHighlightedFiles,
        handleAddSelected,
        handleCopyToClipboard,
        clearAll: handleClearAll,
        getKworkInputValue,
    }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]); // Dependencies


    // --- Render Logic ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    // Disable Fetch button if fetching files, loading PRs, or no URL entered
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered;
    const showProgressBar = isLoading || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
    // Disable AI/Copy/Clear buttons during any loading process
    const isActionDisabled = isLoading || loadingPrs || aiActionLoading;
    const isAskAiDisabled = !kworkInputHasContent || isActionDisabled;
    const isCopyDisabled = !kworkInputHasContent || isActionDisabled;
    const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled;
    // Determine effective branch for display
    const effectiveBranchDisplay = manualBranchName.trim() || targetBranchName || "default";

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Header & Settings Toggle Button */}
       <div className="flex justify-between items-start mb-4 gap-4">
            <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                    <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода
                </h2>
                 {/* Instructions */}
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1">
                    1. Укажи URL/токен/ветку в <span className="text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}>настройках</span> (<FaCircleChevronDown className="inline text-cyan-400"/>).
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1">
                    2. Нажми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1">
                    3. Выбери файлы для контекста AI.
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-2">
                    4. Опиши задачу ИЛИ оставь поле пустым.
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-2">
                    5. Добавь код <span className="font-bold text-cyan-400 mx-1">И/ИЛИ</span> нажми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span>.
                 </p>
            </div>
            {/* Settings Toggle Button */}
            <motion.button
                onClick={triggerToggleSettingsModal} // Use context trigger
                className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0"
                whileHover={{ scale: 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                whileTap={{ scale: 0.95 }}
                title={isSettingsModalOpen ? "Скрыть настройки" : "Настройки URL/Token/Ветки/PR"}
                aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                aria-expanded={isSettingsModalOpen}
            >
                {isSettingsModalOpen ? <FaCircleChevronUp className="text-cyan-400 text-xl" /> : <FaCircleChevronDown className="text-cyan-400 text-xl" />}
            </motion.button>
        </div>

      {/* Settings Modal Component - Controlled by Context */}
      <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={triggerToggleSettingsModal} // Use context trigger to close
            repoUrl={repoUrl} // Pass local state for input control
            setRepoUrl={handleRepoUrlChange} // Pass handler to update local/context
            token={token} // Pass local state
            setToken={setToken} // Pass setter for local state
            manualBranchName={manualBranchName} // Pass context state
            setManualBranchName={handleManualBranchChange} // Pass handler to update context
            currentTargetBranch={targetBranchName} // Pass context state for display
            // PR Props from context/handlers
            openPrs={openPrs}
            loadingPrs={loadingPrs}
            onSelectPrBranch={handleSelectPrBranch} // Pass selection handler
            onLoadPrs={handleLoadPrs} // Pass load handler
            loading={isLoading} // Pass general fetch loading state
       />

      {/* Fetch Button */}
       <div className="mb-4 flex justify-center">
            <motion.button
                // Use context trigger which reads branch state internally
                onClick={() => triggerFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
                disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${
                    fetchStatus === 'failed_retries' || fetchStatus === 'error'
                    ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' // Error state style
                    : 'from-purple-600 to-cyan-500' // Normal state style
                 } transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${
                     isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')
                     ? "opacity-60 cursor-not-allowed" // Disabled style
                     : "hover:brightness-110 active:scale-[0.98]" // Enabled style
                 }`}
                whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }}
                whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }}
                title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`} // Tooltip shows effective branch
            >
                 {/* Icon based on state */}
                 {isLoading ? <FaArrowsRotate className="animate-spin" />
                  : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate />
                  : <FaDownload />)}
                 {/* Text based on state */}
                 {fetchStatus === 'retrying' ? "Повтор..."
                  : isLoading ? "Загрузка..."
                  : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова"
                  : "Извлечь файлы")}
                 {/* Branch indicator */}
                 <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
            </motion.button>
        </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} />
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повторная попытка)' : ''}</p>}
                 {fetchStatus === 'success' && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно извлечено ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, но не найдено подходящих файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}

      {/* Main Content Area (Files & Input) */}
       <div className={`grid grid-cols-1 ${files.length > 0 || kworkInputHasContent ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>

         {/* Left Column: File List & Controls */}
         {(isLoading || (files.length > 0 && fetchStatus !== 'error' && fetchStatus !== 'failed_retries')) && (
             <div className="flex flex-col gap-4">
                <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} />
                 {/* Auto Ask AI Toggle */}
                 {files.length > 0 && (
                     <div className="flex items-center justify-start gap-2 p-2 bg-gray-700/30 rounded-md">
                        <input
                            type="checkbox" id="autoAskAiCheckbox" checked={autoAskAiEnabled}
                            onChange={(e) => setAutoAskAiEnabled(e.target.checked)}
                            className="form-checkbox h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500/50 focus:ring-offset-gray-800 cursor-pointer" />
                        <label htmlFor="autoAskAiCheckbox" className="text-xs text-gray-300 cursor-pointer select-none">
                           Авто-запрос AI после добавления файлов <span className="text-blue-400">(Add Selected & Ask)</span>
                        </label>
                    </div>
                 )}
                 {/* File List Component */}
                 <FileList
                    id="file-list-container"
                    files={files}
                    selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath}
                    secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles}
                    isLoading={isLoading} // Pass general fetch loading
                    toggleFileSelection={toggleFileSelection}
                    onAddSelected={() => handleAddSelected(autoAskAiEnabled)} // Pass auto-ask flag
                    onAddImportant={handleAddImportantFiles}
                    onAddTree={handleAddFullTree}
                    onSelectHighlighted={selectHighlightedFiles}
                 />
             </div>
         )}

         {/* Right Column: Request Input & AI Trigger */}
         {(fetchStatus === 'success' || kworkInputHasContent || files.length > 0 ) ? ( // Show if files fetched OR input has content
             <div id="kwork-input-section" className="flex flex-col gap-3">
                 {/* Request Input Component */}
                 <RequestInput
                    kworkInputRef={localKworkInputRef} // Pass local ref
                    onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)} // Update context flag on change
                    isCopyDisabled={isCopyDisabled} // Pass disabled state
                    isClearDisabled={isClearDisabled} // Pass disabled state
                    onCopyToClipboard={handleCopyToClipboard} // Pass callback
                    onClearAll={handleClearAll} // Pass callback
                 />
                 {/* Ask AI Button */}
                 <motion.button
                    onClick={triggerAskAi} // Use context trigger
                    disabled={isAskAiDisabled} // Use calculated disabled state
                    className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg font-semibold text-sm text-white ${
                        isAskAiDisabled
                        ? 'bg-gray-600 opacity-60 cursor-not-allowed' // Disabled style
                        : 'bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-indigo-500/40' // Enabled style
                    } transition-all`}
                    whileHover={{ scale: isAskAiDisabled ? 1 : 1.03 }}
                    whileTap={{ scale: isAskAiDisabled ? 1 : 0.97 }}
                 >
                    {aiActionLoading ? <FaArrowsRotate className="animate-spin" /> : <FaRobot />}
                    {aiActionLoading ? "Спрашиваю..." : "🤖 Спросить AI"}
                 </motion.button>
             </div>
         ) : null }

      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;
