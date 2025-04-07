// /components/RepoTxtFetcher.tsx
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
import ProgressBar from "./repo/ProgressBar";

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
        case 'ts': return 'typescript';
        case 'tsx': return 'typescript';
        case 'js': return 'javascript';
        case 'jsx': return 'javascript';
        case 'css': return 'css';
        case 'html': return 'html';
        case 'json': return 'json';
        case 'py': return 'python';
        case 'sql': return 'sql';
        
        default: return ''; // Return empty string if no specific language known
    }
};

// Utility: Delay Function
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
  const importantFiles = useMemo(() => [ "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx", "hooks/supabase.ts", "app/actions.ts","app/actions/dummy_actions.ts", "app/webhook-handlers/disable-dummy-mode.ts" ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // === Utility Functions ===
   const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" };
        if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" };
        toast(message, { style: style, duration: type === 'error' ? 5000 : 3000 });
   }, []);

   // Converts a URL path like '/some/route' or 'app/some/route' into 'app/some/route/page.tsx'
   const getPageFilePath = useCallback((routePath: string): string => {
        const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
        // Handle root and bare 'app' path explicitly
        if (!cleanPath || cleanPath === 'app' || cleanPath === '/') return 'app/page.tsx';
        // Remove 'app/' prefix if it exists, as we'll add it back
        const pathWithoutApp = cleanPath.startsWith('app/') ? cleanPath.substring(4) : cleanPath;
        // Assume structure `app/{pathWithoutApp}/page.tsx`
        return `app/${pathWithoutApp}/page.tsx`;
   }, []);

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
            const aliasResolvedBase = 'app/' + importPath.substring(2); // Assuming @/ maps to app/
            const possiblePaths = [
                aliasResolvedBase,
                `${aliasResolvedBase}.ts`, `${aliasResolvedBase}.tsx`,
                `${aliasResolvedBase}.js`, `${aliasResolvedBase}.jsx`,
                `${aliasResolvedBase}/index.ts`, `${aliasResolvedBase}/index.tsx`,
                `${aliasResolvedBase}/index.js`, `${aliasResolvedBase}/index.jsx`,
            ];
            for (const p of possiblePaths) if (allPaths.includes(p)) return p;
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
                    relativeResolvedBase,
                    `${relativeResolvedBase}.ts`, `${relativeResolvedBase}.tsx`,
                    `${relativeResolvedBase}.js`, `${relativeResolvedBase}.jsx`,
                    `${relativeResolvedBase}/index.ts`, `${relativeResolvedBase}/index.tsx`,
                    `${relativeResolvedBase}/index.js`, `${relativeResolvedBase}/index.jsx`,
                  ];
            for (const p of possiblePaths) if (allPaths.includes(p)) return p;
        }
        // --- 3. Handle Bare Imports (node_modules or other conventions - very basic approximation) ---
        else {
             const searchBases = ['app/lib/', 'app/utils/', 'app/components/', 'app/hooks/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'lib/', 'utils/', 'components/', 'hooks/'];
             for (const base of searchBases) {
                 const bareResolvedBase = base + importPath;
                 const possiblePaths = [
                    bareResolvedBase,
                    `${bareResolvedBase}.ts`, `${bareResolvedBase}.tsx`,
                    `${bareResolvedBase}.js`, `${bareResolvedBase}.jsx`,
                    `${bareResolvedBase}/index.ts`, `${bareResolvedBase}/index.tsx`,
                    `${bareResolvedBase}/index.js`, `${bareResolvedBase}/index.jsx`,
                 ];
                  for (const p of possiblePaths) if (allPaths.includes(p)) return p;
             }
        }
        // console.warn(`Could not resolve import "${importPath}" from "${currentFilePath}"`);
        return null; // Could not resolve
  }, []);

  // --- Progress Simulation ---
   const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        progressIntervalRef.current = null; fetchTimeoutRef.current = null;
   }, []);

   const startProgressSimulation = useCallback((estimatedDurationSeconds = 5) => {
        stopProgressSimulation(); setProgress(0); setError(null);
        const intervalTime = 100; const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime;
        const incrementBase = 100 / totalSteps;

        progressIntervalRef.current = setInterval(() => { setProgress((prev) => {
            const randomFactor = Math.random() * 0.6 + 0.7;
            let nextProgress = prev + (incrementBase * randomFactor);
            if (nextProgress >= 69 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) {
                 nextProgress = Math.min(prev + incrementBase * 0.1, 100);
            }
            if (nextProgress >= 100) { stopProgressSimulation(); return 100; }
            return nextProgress;
          });
        }, intervalTime);

        fetchTimeoutRef.current = setTimeout(() => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current); progressIntervalRef.current = null;
                // Only force 100% visually if still loading/retrying, otherwise let success/error state handle it
                if (fetchStatus === 'loading' || fetchStatus === 'retrying') setProgress(100);
            }
            fetchTimeoutRef.current = null;
        }, estimatedDurationSeconds * 1000 + 200);
   }, [stopProgressSimulation, fetchStatus]); // Depends on fetchStatus

  // --- Core Logic Callbacks ---

    // ***** PARSING FIX: Changed Markdown Formatting *****
    const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
        // Use component's state 'selectedFiles' if no specific set is passed
        const filesToAdd = filesToAddParam || selectedFiles;
        console.log("[handleAddSelected] Called. Files to add:", filesToAdd); // Debugging
        if (filesToAdd.size === 0) {
            addToast("Сначала выберите файлы для добавления", 'error');
            return;
        }
        const prefix = "Контекст кода для анализа (отвечай полным кодом, не пропуская части):\n";
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path))
          .sort((a, b) => a.path.localeCompare(b.path))
          // Format: ```lang\n// /path\ncontent```
          .map((file) => `\`\`\`${getLanguage(file.path)}\n// /${file.path}\n${file.content}\n\`\`\``)
          .join("\n\n");

        setKworkInput((prev) => {
            const newContent = `${prefix}${markdownTxt}`;
            // If prev exists and already contains a context block, append smartly
            if (prev.trim().includes("Контекст кода для анализа")) {
                 return `${prev.trim()}\n\n---\n\n${newContent}`;
            }
            // If prev has content but no context block, prepend context
            if (prev.trim()) {
                return `${newContent}\n\n${prev.trim()}`;
            }
            // Otherwise, just set the new content
            return newContent;
        });

        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('kworkInput');
    }, [files, selectedFiles, scrollToSection, addToast, setKworkInput, getLanguage]); // Keep selectedFiles dependency

    // Handles copying text (usually the kworkInput) to clipboard
    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        // Use component's state 'kworkInput' if no specific text is passed
        const content = textToCopy ?? kworkInput;
         console.log("[handleCopyToClipboard] Called. Content to copy (first 50):", content.substring(0, 50)); // Debugging
        if (!content.trim()) {
            addToast("Нет текста для копирования", 'error');
            return false;
        }
        try {
            navigator.clipboard.writeText(content);
            addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            setRequestCopied(true); // Update context state
            if (shouldScroll) {
                 scrollToSection('aiResponseInput'); // Use context scroll function
            }
            return true;
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            addToast("Ошибка копирования", 'error');
            return false;
        }
    }, [kworkInput, setRequestCopied, scrollToSection, addToast]); // Keep kworkInput dependency

    // Clears selections, input, and highlights
    const handleClearAll = useCallback(() => {
        setSelectedFilesState(new Set());
        setSelectedFetcherFiles(new Set()); // Update context
        setKworkInput("");
        setPrimaryHighlightedPath(null); // Also clear highlights
        setSecondaryHighlightedPaths([]);
        addToast("Очищено ✨", 'success');
        if (kworkInputRef.current) { // Use ref from context
            kworkInputRef.current.focus();
        }
    }, [setSelectedFetcherFiles, addToast, kworkInputRef, setKworkInput]);

  // --- Fetch Logic with Retries ---
   const handleFetch = useCallback(async (isManualRetry = false) => {
    if (!repoUrl.trim()) {
        addToast("Введите URL репозитория", 'error');
        setError("URL репозитория не может быть пустым.");
        setIsSettingsOpen(true);
        return;
    }
    if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) {
        addToast("Извлечение уже идет...", "info");
        return;
    }

    setExtractLoading(true); setError(null); setFiles([]);
    setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); setKworkInput("");
    // Reset downstream context states for a clean slate
    setFilesFetched(false, null, []); setRequestCopied(false);
    setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());

    setPrimaryHighlightedPath(null); setSecondaryHighlightedPaths([]);
    addToast("Запрос репозитория...", 'info');
    startProgressSimulation();

    const maxRetries = 3; const retryDelayMs = 1500;
    let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
    let filesToSelect = new Set<string>();

    while (currentTry <= maxRetries) {
        currentTry++;
        const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
        setFetchStatus(currentStatus); // Update context status

        if (currentStatus === 'retrying') {
            addToast(`Попытка ${currentTry} из ${maxRetries+1}...`, 'info');
            await delay(retryDelayMs);
        }

        try {
          result = await fetchRepoContents(repoUrl, token || undefined);
          console.log(`[handleFetch] Attempt ${currentTry} result:`, result); // <<< DEBUG LOG ADDED

          // --- FIX: Check if result exists before accessing properties ---
          if (result && result.success && Array.isArray(result.files)) {
            // --- SUCCESS ---
            stopProgressSimulation(); setProgress(100); setFetchStatus('success');
            addToast(`Извлечено ${result.files.length} файлов!`, 'success');
            setFiles(result.files); setIsSettingsOpen(false); setExtractLoading(false);

            // --- File Highlighting/Selection ---
            const fetchedFiles = result.files;
            let primaryPath: string | null = null; let secondaryPaths: string[] = [];
            filesToSelect = new Set<string>();
            if (highlightedPathFromUrl) {
                primaryPath = getPageFilePath(highlightedPathFromUrl);
                console.log(`URL path: ${highlightedPathFromUrl}, Mapped file path: ${primaryPath}`); // Debug Log
                const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
                if (pageFile) {
                    console.log(`Primary file found: ${primaryPath}`); // Debug Log
                    filesToSelect.add(primaryPath);
                    const imports = extractImports(pageFile.content);
                    secondaryPaths = imports.map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles)).filter((path): path is string => !!path && path !== primaryPath);
                    console.log(`Found ${secondaryPaths.length} related files:`, secondaryPaths); // Debug Log
                    secondaryPaths.forEach(path => filesToSelect.add(path));
                } else {
                    addToast(`Файл страницы для URL (${primaryPath}) не найден`, 'error');
                    console.warn(`Primary file not found: ${primaryPath}`); // Debug Log
                    primaryPath = null;
                }
            } else {
                 console.log("No path provided in URL for highlighting."); // Debug Log
            }
            setPrimaryHighlightedPath(primaryPath); setSecondaryHighlightedPaths(secondaryPaths);
            importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) { console.log(`Adding important file: ${path}`); filesToSelect.add(path); } });
            setFilesFetched(true, primaryPath, secondaryPaths); // Update context AFTER success

            // --- AUTOMATION SEQUENCE ---
            // ***** PARSING FIX: Changed Markdown Formatting *****
            if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
                console.log(`Automation triggered: idea='${ideaFromUrl}', files=`, Array.from(filesToSelect)); // Debug Log
                addToast(`Авто-выбор ${filesToSelect.size} файлов и генерация запроса...`, 'info');
                setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect);
                const task = ideaFromUrl || DEFAULT_TASK_IDEA; // Use idea from URL!
                const prefix = "Контекст кода для анализа (отвечай полным кодом, не пропуская части):\n";
                // Format: ```lang\n// File: path\ncontent```
                const markdownTxt = fetchedFiles
                    .filter(f => filesToSelect.has(f.path))
                    .sort((a,b) => a.path.localeCompare(b.path))
                    .map(f => `\`\`\`${getLanguage(f.path)}\n// File: ${f.path}\n${f.content}\n\`\`\``)
                    .join("\n\n");
                const combinedContent = `${task}\n\n${prefix}${markdownTxt}`;
                console.log("Generated combined content for automation (first 200 chars):", combinedContent.substring(0, 200)); // Debug Log
                setKworkInput(combinedContent);

                await delay(350); // Delay for state update and UI render before copy

                const copied = handleCopyToClipboard(combinedContent, false); // Uses component's handleCopyToClipboard
                if (copied) {
                    addToast("КОНТЕКСТ В БУФЕРЕ! Открываю AI...", 'success');
                    scrollToSection('aiResponseInput');
                    setTimeout(() => openLink('https://aistudio.google.com'), 800);
                } else {
                   addToast("Ошибка авто-копирования в буфер. Переход отменен.", 'error');
                   scrollToSection('kworkInput');
                }
            } else { // Non-automation success path
                 console.log("Automation sequence skipped or conditions not met."); // Debug Log
                if (filesToSelect.size > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Авто-выбрано ${filesToSelect.size} важных/связанных файлов`, 'info'); }
                if (primaryPath) {
                    setTimeout(() => {
                        const elementId = `file-${primaryPath}`; const fileElement = document.getElementById(elementId);
                        if (fileElement) { fileElement.scrollIntoView({ behavior: "smooth", block: "center" }); fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'); setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'), 1500); }
                        else { console.warn(`Element with ID ${elementId} not found for scrolling.`); }
                    }, 400);
                } else if (fetchedFiles.length > 0) { const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
            }
            return; // Exit loop on success

          } else {
              // Handle cases where result is null/undefined or !result.success
              // Use optional chaining for error access, provide a default message.
              const errorMessage = result?.error || "Не удалось получить файлы (ответ API не содержит ожидаемую структуру)";
              throw new Error(errorMessage);
          }
        } catch (err: any) {
          console.error(`Fetch attempt ${currentTry} failed:`, err);
          // Use err.message which might come from the explicit throw above or a network error
          const displayError = err?.message || "Неизвестная ошибка при извлечении";
          setError(`Попытка ${currentTry}: ${displayError}`);
          if (currentTry > maxRetries) {
            stopProgressSimulation(); setFetchStatus('failed_retries');
            addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток.`, 'error');
            setFilesFetched(false, null, []); setExtractLoading(false);
            return; // Exit loop after final failure
          }
          // No need to throw again, loop will continue or exit based on maxRetries
        }
    } // End while loop

    // Fallback cleanup (should only be reached if loop somehow exits unexpectedly)
    console.warn("[handleFetch] Reached fallback cleanup - this should not normally happen.");
    stopProgressSimulation();
    // Set status based on whether an error was recorded or not
    setFetchStatus(error ? 'failed_retries' : 'error');
    setFilesFetched(false, null, []);
    setExtractLoading(false);

   }, [ // Dependencies (Ensure all are listed, including the callbacks used)
        repoUrl, token, highlightedPathFromUrl, ideaFromUrl, importantFiles, fetchStatus,
        addToast, startProgressSimulation, stopProgressSimulation, getLanguage,
        getPageFilePath, extractImports, resolveImportPath, openLink,
        setFetchStatus, setRepoUrlEntered, setFilesFetched, setSelectedFetcherFiles,
        setKworkInput, setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        handleCopyToClipboard, // Needed for automation sequence
        scrollToSection, DEFAULT_TASK_IDEA, files // files is needed for automation sequence
        // Note: handleAddSelected is NOT directly called by handleFetch, so not needed here.
        //       handleCopyToClipboard *is* called, so it's included.
   ]);


  // --- Other Callbacks ---
   // Selects files marked as primary/secondary highlights
   const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0;
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; }
        secondaryHighlightedPaths.forEach(path => { if (files.some(f => f.path === path) && !filesToSelect.has(path)) { filesToSelect.add(path); newlySelectedCount++; } });
        if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info'); }
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
    importantFiles.forEach(path => { if (files.some(f => f.path === path) && !selectedFiles.has(path)) { filesToAdd.add(path); addedCount++; } });
    if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены", 'info'); return; }
    setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
   }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);

   // Adds a simple file tree structure to the kworkInput
   const handleAddFullTree = useCallback(() => {
    if (files.length === 0) {
        addToast("Нет файлов для отображения дерева", 'error');
        return;
    }
    const treeOnly = files.map((file) => `- ${file.path}`).sort().join("\n");
    const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;
    let added = false;
    setKworkInput((prev) => {
        const trimmedPrev = prev.trim();
        if (trimmedPrev.includes("Структура файлов проекта:")) { return prev; }
        added = true;
        return trimmedPrev ? `${trimmedPrev}\n\n${treeContent}` : treeContent;
    });
    if (added) { addToast("Дерево файлов добавлено в запрос", 'success'); scrollToSection('kworkInput'); }
    else { addToast("Дерево файлов уже добавлено", 'info'); }
  }, [files, setKworkInput, scrollToSection, addToast]);

  // --- Effects ---
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); }, [repoUrl, setRepoUrlEntered]);
  useEffect(() => { setKworkInputHasContent(kworkInput.trim().length > 0); }, [kworkInput, setKworkInputHasContent]);
  useEffect(() => { if (autoFetch && repoUrl && fetchStatus === 'idle') { console.log("Triggering auto-fetch..."); handleFetch(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus]); // handleFetch dependency is implicitly covered by its own useCallback
  useEffect(() => { return () => { stopProgressSimulation(); }; }, [stopProgressSimulation]);


  // === Imperative Handle ===
  // Reverted to using wrapper functions as per your finding that it was needed
  // for direct button clicks (passed as props) to work correctly.
  useImperativeHandle(ref, () => ({
    handleFetch: (isManualRetry = false) => handleFetch(isManualRetry), // Wrapper for consistency / future args
    selectHighlightedFiles, // Direct is fine if no args needed and it's stable
    handleAddSelected: () => handleAddSelected(), // Wrapper needed for direct prop calls?
    handleCopyToClipboard: (textToCopy?: string, shouldScroll = true) => handleCopyToClipboard(textToCopy, shouldScroll), // Wrapper needed for direct prop calls?
    clearAll: handleClearAll, // Direct is likely fine
  }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll]); // Dependencies are the memoized functions


  // --- Render ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const isFetchDisabled = isLoading || !repoUrl.trim();

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Header & Settings Toggle */}
      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="flex-grow">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
               <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода
            </h2>
             {/* Instructions */}
             <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 1. Введите URL репозитория (и <span className="text-cyan-400 cursor-pointer hover:underline" onClick={() => setIsSettingsOpen(true)}>токен</span>).</p>
             <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 2. Нажмите <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p>
             <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 3. Выберите файлы для контекста AI.</p>
             <p className="text-yellow-300/80 text-xs md:text-sm mb-2"> 4. Опишите задачу и добавьте код кнопками.</p>
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
          loading={isLoading} // Use combined loading state
          onClose={() => setIsSettingsOpen(false)}
      />

      {/* Fetch Button */}
      <div className="mb-4 flex justify-center">
          <motion.button
              onClick={() => handleFetch()} // Default manual fetch (isManualRetry=false)
              disabled={isFetchDisabled}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-base text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-md shadow-purple-500/30 ${isFetchDisabled ? "opacity-60 cursor-not-allowed brightness-75" : "hover:shadow-lg hover:shadow-cyan-500/40 hover:brightness-110 active:scale-[0.98]"}`}
              whileHover={{ scale: isFetchDisabled ? 1 : 1.03 }}
              whileTap={{ scale: isFetchDisabled ? 1 : 0.97 }}
          >
              {isLoading ? <FaArrowsRotate className="animate-spin" /> : <FaDownload />}
              {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : "Извлечь файлы"}
          </motion.button>
      </div>

      {/* Progress Bar & Status Area */}
       {(fetchStatus !== 'idle' || error) && (
            <div className="mb-4 min-h-[40px]">
                {isLoading && <ProgressBar status={fetchStatus} progress={progress} />}
                {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение: {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Попытка снова)' : ''}</p>}
                {fetchStatus === 'success' && (
                    <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {files.length > 0 ? `Успешно извлечено ${files.length} файлов.` : "Успешно, но файлы не найдены."} </div>
                )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && (
                    <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div>
                 )}
            </div>
        )}

      {/* Main Content Area (Files & Input) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
         {/* Left Column: File List & Controls */}
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
            {(files.length > 0 || isLoading) && fetchStatus !== 'error' && fetchStatus !== 'failed_retries' && (
                <FileList
                  id="file-list-container"
                  files={files}
                  selectedFiles={selectedFiles}
                  primaryHighlightedPath={primaryHighlightedPath}
                  secondaryHighlightedPaths={secondaryHighlightedPaths}
                  importantFiles={importantFiles}
                  isLoading={isLoading}
                  toggleFileSelection={toggleFileSelection}
                  onAddSelected={handleAddSelected} // Pass the memoized handler (intended to be called by wrapper in useImperativeHandle if needed)
                  onAddImportant={handleAddImportantFiles}
                  onAddTree={handleAddFullTree}
                  onSelectHighlighted={selectHighlightedFiles}
                />
            )}
         </div>
         {/* Right Column: Request Input */}
         <div id="kwork-input-section">
             {/* Show input area once fetch is attempted and not failed */}
             {(fetchStatus !== 'idle' && fetchStatus !== 'failed_retries') && (
                 <RequestInput
                    kworkInput={kworkInput}
                    setKworkInput={setKworkInput}
                    kworkInputRef={kworkInputRef} // Pass DOM ref from context
                    onCopyToClipboard={handleCopyToClipboard} // Pass the memoized handler (intended to be called by wrapper in useImperativeHandle if needed)
                    onClearAll={handleClearAll} // Pass the memoized handler
                    isCopyDisabled={!kworkInput.trim()}
                    isClearDisabled={!kworkInput.trim() && selectedFiles.size === 0}
                 />
             )}
         </div>
      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;
