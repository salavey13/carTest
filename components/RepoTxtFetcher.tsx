// /components/RepoTxtFetcher.tsx
"use client";

"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy, FaBroom } from "react-icons/fa6";
import { motion } from "framer-motion";

import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext"; // Use for openLink
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus } from "@/contexts/RepoXmlPageContext"; // Use context

import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
// *** Import the specific ProgressBar component ***
import ProgressBar from "./repo/ProgressBar"; // Adjusted path if it's nested

// Define FileNode
export interface FileNode {
  path: string;
  content: string;
}

interface RepoTxtFetcherProps {}

// Helper: Get Language
const getLanguage = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch(extension) {
        case 'ts': return 'typescript'; // Use full names for clarity maybe? Or keep short ones
        case 'tsx': return 'typescript';
        case 'css': return 'css';
        case 'sql': return 'sql';
        default: return 'plaintext'; // Provide a default
    }
};

// Utility: Delay Function (also exists server-side, but keep for client-side delays if needed)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Component ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, RepoTxtFetcherProps>((props, ref) => {
  // === State ===
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set());
  const [extractLoading, setExtractLoading] = useState<boolean>(false); // Local loading for button state
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null); // Local error display
  const [kworkInput, setKworkInput] = useState<string>("");
  const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // === Context ===
  const { user, openLink } = useAppContext();
  const {
    fetchStatus, setFetchStatus, setRepoUrlEntered, setFilesFetched,
    setSelectedFetcherFiles, setKworkInputHasContent, setRequestCopied,
    scrollToSection, kworkInputRef,
    setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles // Resetters
  } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
  const searchParams = useSearchParams();
  const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
  const ideaFromUrl = useMemo(() => { return searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : ""; }, [searchParams]);
  const autoFetch = useMemo(() => !!highlightedPathFromUrl, [highlightedPathFromUrl]);
  const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";
  // Consider making importantFiles configurable or context-dependent if needed
  const importantFiles = useMemo(() => [ "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx", "hooks/supabase.ts", "app/actions.ts","app/actions/dummy_actions.ts", "app/webhook-handlers/disable-dummy-mode.ts", "package.json", "tailwind.config.ts" ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // === Utility Functions ===
   const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        // Simple toast implementation, replace with your actual toast library call if needed
        console.log(`Toast [${type}]: ${message}`);
        // Example using sonner
        let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" };
        if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" };
        toast(message, { style: style, duration: type === 'error' ? 5000 : 3000 });
   }, []);

   // *** UPDATED getPageFilePath ***
   // Converts a URL path (e.g., '/vpr-test/35' or 'app/vpr-test/35') into a potential
   // Next.js page file path (e.g., 'app/vpr-test/[subjectId]/page.tsx'),
   // considering dynamic segments by comparing against actual available file paths.
   const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string => {
        const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;

        // Handle root case explicitly
        if (!cleanPath || cleanPath === 'app' || cleanPath === '/') {
            const rootPath = 'app/page.tsx';
            if (allActualFilePaths.includes(rootPath)) return rootPath;
            // If app/page.tsx doesn't exist but maybe app/index.tsx does? Less common.
             if (allActualFilePaths.includes('app/index.tsx')) return 'app/index.tsx';
             console.warn(`getPageFilePath: Root path ${rootPath} not found.`);
             return rootPath; // Return expected root path even if not found
        }

        // Ensure path starts with 'app/' for consistent comparison logic
        const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : `app/${cleanPath}`;
        const inputSegments = pathWithApp.split('/'); // e.g., ['app', 'vpr-test', '35']
        const numInputSegments = inputSegments.length;

        const potentialDirectPath = `${pathWithApp}/page.tsx`;
        const potentialDirectIndexPath = `${pathWithApp}/index.tsx`; // Less common but possible

        // --- 1. Check for Exact Direct Match ---
        if (allActualFilePaths.includes(potentialDirectPath)) {
            return potentialDirectPath;
        }
         if (allActualFilePaths.includes(potentialDirectIndexPath)) {
            return potentialDirectIndexPath;
        }

        // --- 2. Check for Dynamic Segment Match ---
        const pageFiles = allActualFilePaths.filter(p => p.startsWith('app/') && (p.endsWith('/page.tsx') || p.endsWith('/index.tsx')));

        for (const actualPath of pageFiles) {
            // Extract segments from the actual file path, excluding the final 'page.tsx' or 'index.tsx'
            const actualPathEnd = actualPath.endsWith('/page.tsx') ? '/page.tsx' : '/index.tsx';
            const actualPathBase = actualPath.substring(0, actualPath.length - actualPathEnd.length);
            const actualSegments = actualPathBase.split('/'); // e.g., ['app', 'vpr-test', '[subjectId]']

            // Basic check: must have the same number of segments
            if (actualSegments.length !== numInputSegments) {
                continue;
            }

            let isDynamicMatch = true;
            for (let i = 0; i < numInputSegments; i++) {
                const inputSeg = inputSegments[i];
                const actualSeg = actualSegments[i];

                if (inputSeg === actualSeg) {
                    continue; // Segments match exactly
                } else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) {
                    continue; // Actual segment is dynamic, matches the input segment positionally
                } else {
                    isDynamicMatch = false; // Mismatch found
                    break;
                }
            }

            if (isDynamicMatch) {
                console.log(`getPageFilePath: Dynamic match found for route "${routePath}" -> file "${actualPath}"`);
                return actualPath; // Return the actual file path with dynamic placeholders
            }
        }

        // --- 3. Fallback ---
        // If no exact or dynamic match found, return the *most likely* direct path convention.
        // The caller (`handleFetch`) should verify if this file actually exists later.
        console.warn(`getPageFilePath: No direct or dynamic page file match found for route "${routePath}". Falling back to direct guess: "${potentialDirectPath}"`);
        return potentialDirectPath;

   }, []); // Dependency: No internal state/props used, relies only on arguments

   // Extracts potential import paths from file content
   const extractImports = useCallback((content: string): string[] => {
        const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g;
        const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g;
        const imports = new Set<string>(); let match;
        while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]);
        while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]);
        return Array.from(imports);
   }, []);

   // Tries to resolve an import path relative to the current file, considering aliases and extensions
   const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
        const allPaths = allFiles.map(f => f.path); // Cache paths for faster lookup

        // --- 1. Handle Aliases (e.g., @/components/button -> app/components/button) ---
        if (importPath.startsWith('@/')) {
            // More robust alias handling - check common locations
            const possibleBases = ['app/', 'src/']; // Add other potential source roots if needed
            const pathSegment = importPath.substring(2);
            for (const base of possibleBases) {
                const aliasResolvedBase = base + pathSegment;
                 const possiblePaths = [
                    aliasResolvedBase, `${aliasResolvedBase}.ts`, `${aliasResolvedBase}.tsx`,
                    `${aliasResolvedBase}.js`, `${aliasResolvedBase}.jsx`, `${aliasResolvedBase}.css`, `${aliasResolvedBase}.sql`, // Add supported extensions
                    `${aliasResolvedBase}/index.ts`, `${aliasResolvedBase}/index.tsx`,
                    `${aliasResolvedBase}/index.js`, `${aliasResolvedBase}/index.jsx`,
                ];
                for (const p of possiblePaths) if (allPaths.includes(p)) return p;
            }
        }
        // --- 2. Handle Relative Paths (e.g., ./utils, ../hooks/useThing) ---
        else if (importPath.startsWith('.')) {
            const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
            const pathParts = (currentDir + '/' + importPath).split('/');
            const resolvedParts: string[] = [];
            for (const part of pathParts) {
                if (part === '.' || part === '') continue;
                if (part === '..') resolvedParts.pop(); else resolvedParts.push(part);
            }
            const relativeResolvedBase = resolvedParts.join('/');
            const hasExplicitExtension = /\.\w+$/.test(importPath);
             const possiblePaths = hasExplicitExtension
                ? [relativeResolvedBase] // Only check the explicit path
                : [
                    relativeResolvedBase, `${relativeResolvedBase}.ts`, `${relativeResolvedBase}.tsx`,
                    `${relativeResolvedBase}.js`, `${relativeResolvedBase}.jsx`, `${relativeResolvedBase}.css`, `${relativeResolvedBase}.sql`, // Add supported extensions
                    `${relativeResolvedBase}/index.ts`, `${relativeResolvedBase}/index.tsx`,
                    `${relativeResolvedBase}/index.js`, `${relativeResolvedBase}/index.jsx`,
                  ];
            for (const p of possiblePaths) if (allPaths.includes(p)) return p;
        }
        // --- 3. Handle Bare Imports (node_modules or other conventions - very basic approximation) ---
        else {
             // Skip node_modules resolution for now, focus on project files
             // console.warn(`Skipping resolution for potential node_module: "${importPath}"`);
             // If you need to resolve specific libraries within the project (e.g., 'lib/auth'), add logic here
             const searchBases = ['app/lib/', 'app/utils/', 'app/components/', 'app/hooks/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'lib/', 'utils/', 'components/', 'hooks/'];
             for (const base of searchBases) {
                 const bareResolvedBase = base + importPath;
                 const possiblePaths = [
                    bareResolvedBase, `${bareResolvedBase}.ts`, `${bareResolvedBase}.tsx`,
                    `${bareResolvedBase}.js`, `${bareResolvedBase}.jsx`, `${bareResolvedBase}.css`, `${bareResolvedBase}.sql`, // Add supported extensions
                    `${bareResolvedBase}/index.ts`, `${bareResolvedBase}/index.tsx`,
                    `${bareResolvedBase}/index.js`, `${bareResolvedBase}/index.jsx`,
                 ];
                  for (const p of possiblePaths) if (allPaths.includes(p)) return p;
             }
        }
        // console.warn(`Could not resolve import "${importPath}" from "${currentFilePath}"`);
        return null; // Could not resolve
  }, []); // Dependencies: allFiles (implicitly via the map)

  // --- Progress Simulation ---
   const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        progressIntervalRef.current = null; fetchTimeoutRef.current = null;
        // console.log("Progress simulation stopped."); // Debug Log
   }, []);

   // ** UPDATED Progress Simulation **
   // Now uses a longer default duration to better reflect batching.
   // It's still a simulation, not tied to actual batch completion.
   const startProgressSimulation = useCallback((estimatedDurationSeconds = 15) => { // Increased default duration
        stopProgressSimulation(); setProgress(0); setError(null);
        console.log(`Starting progress simulation (estimated ${estimatedDurationSeconds}s)`); // Debug Log

        const intervalTime = 150; // Slightly longer interval for smoother feel over longer duration
        const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime;
        const incrementBase = 100 / totalSteps;

        progressIntervalRef.current = setInterval(() => { setProgress((prev) => {
            // Simulate slightly variable progress speed
            const randomFactor = Math.random() * 0.7 + 0.6; // Skew towards slightly faster than base average
            let nextProgress = prev + (incrementBase * randomFactor);

            // Slow down significantly after reaching ~90% if still loading/retrying,
            // simulating the "final steps" or waiting for completion signal.
             if (nextProgress >= 90 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) {
                 nextProgress = Math.min(prev + incrementBase * 0.1, 99); // Crawl towards 99
             } else if (nextProgress >= 100) {
                 // Don't automatically stop here if we expect a final success/error state to set 100%
                 nextProgress = 99.9; // Hold just below 100 until final state confirmed
             }
             // console.log(`Progress tick: ${prev.toFixed(1)} -> ${nextProgress.toFixed(1)}`); // Debug Log
             return nextProgress;
          });
        }, intervalTime);

        // Timeout to prevent infinite loading bar if something unexpected happens
        // Increased timeout duration as well
        fetchTimeoutRef.current = setTimeout(() => {
            console.log("Progress simulation timeout reached."); // Debug Log
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current); progressIntervalRef.current = null;
                // Only force progress update if still in loading states
                if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                    console.warn("Forcing progress to 99% due to timeout while still loading."); // Debug Log
                    setProgress(99); // Don't force 100%, let success/error handle it
                }
            }
            fetchTimeoutRef.current = null;
        }, estimatedDurationSeconds * 1000 + 5000); // Add extra 5 seconds buffer
   }, [stopProgressSimulation, fetchStatus]); // Depends on fetchStatus

  // --- Core Logic Callbacks ---

    // ***** PARSING FIX: Consistent Markdown Formatting *****
    const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles;
        console.log("[handleAddSelected] Files to add:", filesToAdd);
        if (filesToAdd.size === 0) {
            addToast("Сначала выберите файлы для добавления", 'error'); return;
        }
        // --- Use standard Markdown code fences ---
        const prefix = "Контекст кода для анализа (отвечай полным кодом):\n";
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path))
          .sort((a, b) => a.path.localeCompare(b.path))
          // Format: ```lang\n// /path\ncontent\n```
          .map((file) => `\`\`\`${getLanguage(file.path)}\n// /${file.path}\n${file.content}\n\`\`\``)
          .join("\n\n");

        setKworkInput((prev) => {
            const newContent = `${prefix}${markdownTxt}`;
            // Improved appending logic: check for existing prefix block more reliably
            const contextRegex = /^Контекст кода для анализа.*?:\n/im; // Case-insensitive, multiline
             if (contextRegex.test(prev.trim())) {
                 // Find the end of the last code block related to context if possible,
                 // or just append after a separator.
                 return `${prev.trim()}\n\n---\n[Дополнительный Контекст]\n${markdownTxt}`;
            }
            if (prev.trim()) {
                // Prepend context if kwork has text but no context block yet
                return `${newContent}\n\n${prev.trim()}`;
            }
            // Otherwise, just set the new content
            return newContent;
        });

        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('extractor');
    }, [files, selectedFiles, scrollToSection, addToast, getLanguage]); // Removed setKworkInput, will use setter from context/state

    // Handles copying text to clipboard
    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInput;
        console.log("[handleCopyToClipboard] Content length:", content.length);
        if (!content.trim()) {
            addToast("Нет текста для копирования", 'error'); return false;
        }
        try {
            navigator.clipboard.writeText(content);
            addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            setRequestCopied(true); // Update context state
            if (shouldScroll) {
                 scrollToSection('executor');
            }
            return true;
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            addToast("Ошибка копирования", 'error');
            return false;
        }
    }, [kworkInput, scrollToSection, addToast, setRequestCopied]); // Simplified dependencies: relies on kworkInput state

    // Clears selections, input, and highlights
    const handleClearAll = useCallback(() => {
        console.log("[handleClearAll] Clearing state."); // Debug Log
        setSelectedFilesState(new Set());
        setSelectedFetcherFiles(new Set()); // Update context
        setKworkInput("");
        setPrimaryHighlightedPath(null);
        setSecondaryHighlightedPaths([]);
        // Also reset AI response/parsed state if clearing everything? Optional.
        // setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
        addToast("Очищено ✨", 'success');
        if (kworkInputRef.current) { kworkInputRef.current.focus(); }
    }, [setSelectedFetcherFiles, addToast, kworkInputRef, setKworkInput /* Removed potentially stale setters */]);

  // --- Fetch Logic with Retries ---
   const handleFetch = useCallback(async (isManualRetry = false) => {
    console.log(`[handleFetch] Called. isManualRetry: ${isManualRetry}, Current Status: ${fetchStatus}`);
    if (!repoUrl.trim()) {
        addToast("Введите URL репозитория", 'error');
        setError("URL репозитория не может быть пустым.");
        setIsSettingsOpen(true);
        return;
    }
    // Prevent multiple fetches unless it's a manual retry after failure
    if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) {
        addToast("Извлечение уже идет...", "info");
        return;
    }
    // If retrying manually, ensure status allows it (e.g., failed_retries, error)
    if (isManualRetry && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
        console.warn(`Manual retry requested but status is ${fetchStatus}. Allowing anyway.`);
    }


    setExtractLoading(true); setError(null); setFiles([]);
    setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); // Clear selections
    setKworkInput("");
    // Reset downstream context states for a clean slate
    setFilesFetched(false, null, []); setRequestCopied(false);
    setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
    setPrimaryHighlightedPath(null); setSecondaryHighlightedPaths([]);

    addToast("Запрос репозитория...", 'info');
    startProgressSimulation(20); // Start with a longer estimate

    const maxRetries = 2;
    const retryDelayMs = 2000;
    let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
    let filesToSelect = new Set<string>();

    while (currentTry <= maxRetries) {
        currentTry++;
        const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
        setFetchStatus(currentStatus); // Update context status
        console.log(`[handleFetch] Attempt ${currentTry}/${maxRetries + 1}, Status: ${currentStatus}`);

        if (currentStatus === 'retrying') {
            addToast(`Попытка ${currentTry} из ${maxRetries+1}...`, 'info');
            await delay(retryDelayMs);
            startProgressSimulation(15 + (currentTry * 5)); // Increase duration on retries
        }

        try {
          result = await fetchRepoContents(repoUrl, token || undefined);
          console.log(`[handleFetch] Attempt ${currentTry} raw result:`, result);

          if (result?.success && Array.isArray(result.files)) {
            // --- SUCCESS ---
            console.log(`[handleFetch] Success on attempt ${currentTry}. Files: ${result.files.length}`);
            stopProgressSimulation(); setProgress(100); setFetchStatus('success');
            addToast(`Извлечено ${result.files.length} файлов!`, 'success');
            setFiles(result.files); setIsSettingsOpen(false); setExtractLoading(false);

            // --- File Highlighting/Selection ---
            const fetchedFiles = result.files;
            const allActualFilePaths = fetchedFiles.map(f => f.path); // <<< Get all paths for getPageFilePath
            let primaryPath: string | null = null; let secondaryPaths: string[] = [];
            filesToSelect = new Set<string>();

            if (highlightedPathFromUrl) {
                // *** Use updated getPageFilePath with all actual paths ***
                primaryPath = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                console.log(`URL path: "${highlightedPathFromUrl}", Mapped file path attempt: "${primaryPath}"`);

                // Check if the potentially dynamic path actually exists in the fetched files
                const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
                if (pageFile) {
                    console.log(`Primary file found: ${primaryPath}`);
                    filesToSelect.add(primaryPath);
                    const imports = extractImports(pageFile.content);
                    secondaryPaths = imports.map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles)).filter((path): path is string => !!path && path !== primaryPath);
                    console.log(`Found ${secondaryPaths.length} related files:`, secondaryPaths);
                    secondaryPaths.forEach(path => filesToSelect.add(path));
                } else {
                    addToast(`Файл страницы для URL (${highlightedPathFromUrl} -> ${primaryPath}) не найден в репозитории`, 'warning');
                    console.warn(`Primary file not found: ${primaryPath}`);
                    primaryPath = null; // Reset primaryPath if not found
                }
            } else {
                 console.log("No path provided in URL for highlighting.");
            }
            // Add important files regardless of URL path, avoid duplicates
            importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) { console.log(`Adding important file: ${path}`); filesToSelect.add(path); } });

            setPrimaryHighlightedPath(primaryPath); setSecondaryHighlightedPaths(secondaryPaths);
            setFilesFetched(true, primaryPath, secondaryPaths); // Update context AFTER success


            // --- AUTOMATION SEQUENCE ---
            if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
                 console.log(`Automation triggered: idea='${ideaFromUrl}', files=`, Array.from(filesToSelect));
                 addToast(`Авто-выбор ${filesToSelect.size} файлов и генерация запроса...`, 'info');
                 setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect);
                 const task = ideaFromUrl || DEFAULT_TASK_IDEA;
                 const prefix = "Контекст кода для анализа (отвечай полным кодом):\n";
                 const markdownTxt = fetchedFiles
                    .filter(f => filesToSelect.has(f.path))
                    .sort((a,b) => a.path.localeCompare(b.path))
                    .map(f => `\`\`\`${getLanguage(f.path)}\n// /${f.path}\n${f.content}\n\`\`\``)
                    .join("\n\n");
                const combinedContent = `${task}\n\n${prefix}${markdownTxt}`;
                console.log("Generated combined content for automation (first 200 chars):", combinedContent.substring(0, 200));
                setKworkInput(combinedContent);

                await delay(350); // Delay for state update and UI render

                const copied = handleCopyToClipboard(combinedContent, false); // Use component's own handler
                if (copied) {
                    addToast("КОНТЕКСТ В БУФЕРЕ! Открываю AI...", 'success');
                    scrollToSection('executor'); // Scroll first
                    setTimeout(() => openLink('https://aistudio.google.com'), 800); // Open link after short delay
                } else {
                   addToast("Ошибка авто-копирования в буфер. Переход отменен.", 'error');
                   scrollToSection('extractor'); // Scroll back to input
                }
            } else { // Non-automation success path
                 console.log("Automation sequence skipped or conditions not met.");
                if (filesToSelect.size > 0) {
                    setSelectedFilesState(filesToSelect);
                    setSelectedFetcherFiles(filesToSelect); // Update context too
                    addToast(`Авто-выбрано ${filesToSelect.size} важных/связанных файлов`, 'info');
                }
                // Scroll to highlighted file or list start
                if (primaryPath) {
                    setTimeout(() => {
                        const elementId = `file-${primaryPath}`; const fileElement = document.getElementById(elementId);
                        if (fileElement) { fileElement.scrollIntoView({ behavior: "smooth", block: "center" }); fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'); setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'), 1500); }
                        else { console.warn(`Element with ID ${elementId} not found for scrolling.`); }
                    }, 400);
                } else if (fetchedFiles.length > 0) {
                    const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }
            return; // Exit loop on success

          } else {
              const errorMessage = result?.error || "Не удалось получить файлы (ответ API не содержит ожидаемую структуру)";
              console.error(`[handleFetch] Attempt ${currentTry} failed: ${errorMessage}`);
              throw new Error(errorMessage); // Trigger retry or failure logic
          }
        } catch (err: any) {
          console.error(`[handleFetch] Error during attempt ${currentTry}:`, err);
          const displayError = err?.message || "Неизвестная ошибка при извлечении";
          setError(`Попытка ${currentTry}: ${displayError}`);

          if (currentTry > maxRetries) {
            console.error(`[handleFetch] Final attempt failed. Max retries (${maxRetries}) reached.`);
            stopProgressSimulation();
            setFetchStatus('failed_retries'); // Use specific status
            setProgress(0); // Reset progress on final failure
            addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error');
            setFilesFetched(false, null, []); // Update context on final failure
            setExtractLoading(false);
            return; // Exit loop after final failure
          }
          // Loop continues after delay if not last attempt
        }
    } // End while loop

    // Fallback cleanup (should ideally not be reached)
    console.warn("[handleFetch] Reached end of function unexpectedly after loop.");
    stopProgressSimulation();
    if (fetchStatus !== 'success') {
        setFetchStatus(error ? 'failed_retries' : 'error');
        setProgress(0);
        setFilesFetched(false, null, []);
    }
    setExtractLoading(false);

   }, [ // Dependencies
        repoUrl, token, fetchStatus, highlightedPathFromUrl, ideaFromUrl, importantFiles,
        addToast, startProgressSimulation, stopProgressSimulation, getLanguage,
        getPageFilePath, // Now includes dynamic logic, depends only on args
        extractImports, resolveImportPath, openLink, handleCopyToClipboard,
        setFetchStatus, setRepoUrlEntered, setFilesFetched, setSelectedFetcherFiles,
        setKworkInput, setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        scrollToSection, DEFAULT_TASK_IDEA, // `files` state is read *inside* callback after fetch, so not needed in outer deps
        // No need for handleAddSelected here as it's called separately
   ]);


  // --- Other Callbacks ---
   // Selects files marked as primary/secondary highlights
   const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0;
        console.log("[selectHighlightedFiles] Initial selection:", selectedFiles);
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) {
             filesToSelect.add(primaryHighlightedPath); newlySelectedCount++;
             console.log(`Added primary: ${primaryHighlightedPath}`);
        }
        secondaryHighlightedPaths.forEach(path => {
            if (files.some(f => f.path === path) && !filesToSelect.has(path)) {
                filesToSelect.add(path); newlySelectedCount++;
                 console.log(`Added secondary: ${path}`);
            }
        });
        if (newlySelectedCount > 0) {
            setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); // Update context
            addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info');
        }
        else { addToast("Нет дополнительных связанных файлов для выбора", 'info'); }
   }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);

   // Toggles selection state for a single file
   const toggleFileSelection = useCallback((path: string) => {
    setSelectedFilesState(prevSet => {
        const newSet = new Set(prevSet);
        if (newSet.has(path)) newSet.delete(path); else newSet.add(path);
        setSelectedFetcherFiles(newSet); // Update context immediately
        return newSet;
    });
  }, [setSelectedFetcherFiles]);

  // Adds important files (package.json, etc.) to the current selection
  const handleAddImportantFiles = useCallback(() => {
    let addedCount = 0; const filesToAdd = new Set(selectedFiles);
    console.log("[handleAddImportantFiles] Initial selection:", selectedFiles);
    importantFiles.forEach(path => {
        if (files.some(f => f.path === path) && !selectedFiles.has(path)) {
             filesToAdd.add(path); addedCount++;
             console.log(`Added important: ${path}`);
        }
    });
    if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены", 'info'); return; }
    setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); // Update context
    addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
   }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);

   // Adds a simple file tree structure to the kworkInput
   const handleAddFullTree = useCallback(() => {
    if (files.length === 0) {
        addToast("Нет файлов для отображения дерева", 'error'); return;
    }
    console.log("[handleAddFullTree] Adding file tree."); // Debug Log
    const treeOnly = files.map((file) => `- ${file.path}`).sort().join("\n");
    const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;
    let added = false;
    setKworkInput((prev) => {
        const trimmedPrev = prev.trim();
        // More robust check for existing tree
        if (/Структура файлов проекта:\s*```/im.test(trimmedPrev)) { return prev; }
        added = true;
        return trimmedPrev ? `${trimmedPrev}\n\n${treeContent}` : treeContent;
    });
    if (added) { addToast("Дерево файлов добавлено в запрос", 'success'); scrollToSection('extractor'); }
    else { addToast("Дерево файлов уже добавлено", 'info'); }
  }, [files, setKworkInput, scrollToSection, addToast]);

  // --- Effects ---
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); }, [repoUrl, setRepoUrlEntered]);
  useEffect(() => { setKworkInputHasContent(kworkInput.trim().length > 0); }, [kworkInput, setKworkInputHasContent]);
  useEffect(() => {
    // Trigger auto-fetch only if conditions are met and status is idle (or failed and allows retry)
    if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
        console.log("Triggering auto-fetch due to URL params and status:", fetchStatus);
        handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus]); // handleFetch is stable due to useCallback
  useEffect(() => { return () => { stopProgressSimulation(); }; }, [stopProgressSimulation]);


  // === Imperative Handle ===
   useImperativeHandle(ref, () => ({
        // Pass the memoized callbacks directly
        handleFetch,
        selectHighlightedFiles,
        handleAddSelected, // Ensure this uses the component's state/props correctly
        handleCopyToClipboard,
        clearAll: handleClearAll,
    }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll]); // Include all exposed functions


  // --- Render ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const isFetchDisabled = isLoading || !repoUrl.trim(); // Disable if loading or no URL
  const showProgressBar = isLoading || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries'; // Show progress/status when relevant


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

      {/* Settings Modal */}
      <SettingsModal
          isOpen={isSettingsOpen}
          repoUrl={repoUrl}
          setRepoUrl={setRepoUrl}
          token={token}
          setToken={setToken}
          loading={isLoading}
          onClose={() => setIsSettingsOpen(false)}
      />

      {/* Fetch Button */}
      <div className="mb-4 flex justify-center">
          <motion.button
              onClick={() => handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error')} // Pass true for retry if failed
              disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')} // Allow click if failed
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-base text-white bg-gradient-to-r ${
                 fetchStatus === 'failed_retries' || fetchStatus === 'error'
                   ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-red-500/30 hover:shadow-red-500/40' // Retry state style
                   : 'from-purple-600 to-cyan-500 shadow-purple-500/30 hover:shadow-cyan-500/40' // Normal/Loading state style
              } transition-all ${isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? "opacity-60 cursor-not-allowed brightness-75" : "hover:brightness-110 active:scale-[0.98]"}`}
              whileHover={{ scale: isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? 1 : 1.03 }}
              whileTap={{ scale: isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? 1 : 0.97 }}
          >
              {isLoading ? <FaArrowsRotate className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)}
              {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")}
          </motion.button>
      </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && ( // Conditionally render the whole status area
            <div className="mb-4 min-h-[40px]">
                {/* Always render ProgressBar if shown, control appearance via props */}
                <ProgressBar
                     status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} // Map failed_retries to error style
                     progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} // Show 100 on success, 0 on error, else simulated progress
                />
                {/* Status Text */}
                {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение: {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повторная попытка)' : ''}</p>}
                {fetchStatus === 'success' && files.length > 0 && (
                    <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно извлечено ${files.length} файлов.`} </div>
                )}
                 {fetchStatus === 'success' && files.length === 0 && (
                    <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> Успешно, но не найдено файлов с нужными расширениями или в разрешенных папках. </div>
                )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && (
                    <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div>
                 )}
            </div>
        )}

      {/* Main Content Area (Files & Input) */}
      <div className={`grid grid-cols-1 ${files.length > 0 || kworkInput ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>
         {/* Left Column: File List & Controls - Only show if files exist or loading */}
         {(files.length > 0 || isLoading) && fetchStatus !== 'error' && fetchStatus !== 'failed_retries' && (
             <div className="flex flex-col gap-4">
                {/* Selected Files Preview */}
                {selectedFiles.size > 0 && !isLoading && (
                    <SelectedFilesPreview
                        selectedFiles={selectedFiles}
                        allFiles={files}
                        getLanguage={getLanguage}
                    />
                )}
                {/* File List */}
                <FileList
                  id="file-list-container"
                  files={files}
                  selectedFiles={selectedFiles}
                  primaryHighlightedPath={primaryHighlightedPath}
                  secondaryHighlightedPaths={secondaryHighlightedPaths}
                  importantFiles={importantFiles}
                  isLoading={isLoading}
                  toggleFileSelection={toggleFileSelection}
                  // Pass imperative handle functions directly if they are stable
                  onAddSelected={() => handleAddSelected()}
                  onAddImportant={handleAddImportantFiles}
                  onAddTree={handleAddFullTree}
                  onSelectHighlighted={selectHighlightedFiles}
                />
             </div>
         )}
         {/* Right Column: Request Input - Show if not idle/failed OR if kwork has content */}
         {(fetchStatus !== 'idle' && fetchStatus !== 'failed_retries' && fetchStatus !== 'error' || kworkInput.trim().length > 0) && (
             <div id="kwork-input-section">
                 <RequestInput
                    kworkInput={kworkInput}
                    setKworkInput={setKworkInput} // Pass setter
                    kworkInputRef={kworkInputRef} // Pass DOM ref from context
                    onCopyToClipboard={() => handleCopyToClipboard()} // Pass the memoized handler
                    onClearAll={() => handleClearAll()} // Pass the memoized handler
                    isCopyDisabled={!kworkInput.trim() || isLoading} // Disable copy if no content or loading
                    isClearDisabled={(!kworkInput.trim() && selectedFiles.size === 0) || isLoading} // Disable clear if nothing to clear or loading
                 />
             </div>
         )}
      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;