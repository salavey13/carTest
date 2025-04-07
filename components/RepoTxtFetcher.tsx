"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy, FaBroom } from "react-icons/fa6";
import { motion } from "framer-motion";

import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
// Import context and ref types
import { useRepoXmlPageContext, RepoTxtFetcherRef } from "@/contexts/RepoXmlPageContext";

import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";

// Define FileNode here or import from a shared types file if used elsewhere
export interface FileNode {
  path: string;
  content: string;
}

interface RepoTxtFetcherProps {
    // No props needed for refs passed via context/parent ref prop
}

// Helper outside component: Determine language for syntax highlighting
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
        
        default: return 'text';
    }
};

// Use props argument for convention, even if empty now
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, RepoTxtFetcherProps>((props, ref) => {
  // === State ===
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set());
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [kworkInput, setKworkInput] = useState<string>("");
  const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // === Context ===
  const { user } = useAppContext();
  const {
    // Updater functions from context
    setRepoUrlEntered,
    setFilesFetched,
    setSelectedFetcherFiles,
    setKworkInputHasContent,
    setRequestCopied,
    scrollToSection,
    kworkInputRef, // Get the kworkInput DOM ref from context
  } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
  const searchParams = useSearchParams();
  const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
  const ideaFromUrl = useMemo(() => { return searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : ""; }, [searchParams]);
  const autoFetch = useMemo(() => !!highlightedPathFromUrl, [highlightedPathFromUrl]);
  const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода страницы. Опиши его основные функции и предложи возможные улучшения без жаргона простым языком.";
  const importantFiles = useMemo(() => [ "hooks/supabase.ts", "app/webhook-handlers/disable-dummy-mode.ts", "app/layout.tsx", "contexts/AppContext.tsx", "app/actions/dummy_actions.ts", "components/StickyChatButton.tsx” ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // === Utility Functions ===
   const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" }; // Default info
        if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" }; // Green-ish
        else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" }; // Red-ish
        toast(message, { style: style, duration: type === 'error' ? 5000 : 3000 });
   }, []);
   const getPageFilePath = useCallback((routePath: string): string => {
        const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
        if (!cleanPath || cleanPath === '/') return 'app/page.tsx';
        const segments = cleanPath.split('/');
        // Simple join, assuming standard app router structure
        const pagePathSegments = segments.map(segment => segment);
        return `app/${pagePathSegments.join('/')}/page.tsx`;
   }, []);
   const extractImports = useCallback((content: string): string[] => {
        const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g;
        const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g;
        const imports = new Set<string>(); let match;
        while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]);
        while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]);
        return Array.from(imports);
   }, []);
   const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
        const allPaths = allFiles.map(f => f.path);
        // 1. Alias (@/)
        if (importPath.startsWith('@/')) {
            const aliasResolvedBase = 'app/' + importPath.substring(2);
            const possiblePaths = [ aliasResolvedBase, `${aliasResolvedBase}.ts`, `${aliasResolvedBase}.tsx`, `${aliasResolvedBase}.js`, `${aliasResolvedBase}.jsx`, `${aliasResolvedBase}/index.ts`, `${aliasResolvedBase}/index.tsx`, `${aliasResolvedBase}/index.js`, `${aliasResolvedBase}/index.jsx`, ];
            for (const p of possiblePaths) if (allPaths.includes(p)) return p;
        }
        // 2. Relative (.)
        else if (importPath.startsWith('.')) {
            const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
            const pathParts = (currentDir + '/' + importPath).split('/');
            const resolvedParts: string[] = [];
            for (const part of pathParts) { if (part === '.' || part === '') continue; if (part === '..') resolvedParts.pop(); else resolvedParts.push(part); }
            const relativeResolvedBase = resolvedParts.join('/');
            const hasExplicitExtension = /\.\w+$/.test(importPath);
             const possiblePaths = hasExplicitExtension ? [relativeResolvedBase] : [ relativeResolvedBase, `${relativeResolvedBase}.ts`, `${relativeResolvedBase}.tsx`, `${relativeResolvedBase}.js`, `${relativeResolvedBase}.jsx`, `${relativeResolvedBase}/index.ts`, `${relativeResolvedBase}/index.tsx`, `${relativeResolvedBase}/index.js`, `${relativeResolvedBase}/index.jsx`, ];
            for (const p of possiblePaths) if (allPaths.includes(p)) return p;
        }
        // 3. Bare (node_modules approximation) - very basic
        else {
             const searchBases = ['app/lib/', 'app/utils/', 'app/components/', 'app/hooks/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'lib/', 'utils/', 'components/', 'hooks/'];
             for (const base of searchBases) {
                 const bareResolvedBase = base + importPath;
                 const possiblePaths = [ bareResolvedBase, `${bareResolvedBase}.ts`, `${bareResolvedBase}.tsx`, `${bareResolvedBase}.js`, `${bareResolvedBase}.jsx`, `${bareResolvedBase}/index.ts`, `${bareResolvedBase}/index.tsx`, `${bareResolvedBase}/index.js`, `${bareResolvedBase}/index.jsx`, ];
                  for (const p of possiblePaths) if (allPaths.includes(p)) return p;
             }
        }
        // console.warn(`Could not resolve import "${importPath}" from "${currentFilePath}"`);
        return null;
  }, []);

  // --- Progress Simulation ---
   const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        progressIntervalRef.current = null; fetchTimeoutRef.current = null;
   }, []);
   const startProgressSimulation = useCallback((estimatedDurationSeconds = 5) => {
        stopProgressSimulation(); setProgress(0); setFetchStatus('loading'); setError(null);
        const intervalTime = 100; const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime;
        const incrementBase = 100 / totalSteps;
        progressIntervalRef.current = setInterval(() => { setProgress((prev) => { const randomFactor = Math.random() * 0.6 + 0.7; let nextProgress = prev + (incrementBase * randomFactor); if (nextProgress >= 95 && fetchTimeoutRef.current) { nextProgress = Math.min(prev + incrementBase * 0.1, 98); } if (nextProgress >= 100) { stopProgressSimulation(); return 100; } return nextProgress; }); }, intervalTime);
        fetchTimeoutRef.current = setTimeout(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; setProgress(100); /* Assume success visually, actual result handled by fetch */ if(fetchStatus === 'loading') setFetchStatus('success'); } fetchTimeoutRef.current = null; }, estimatedDurationSeconds * 1000 + 200);
   }, [stopProgressSimulation, fetchStatus]); // Added fetchStatus dependency

  // --- Core Logic Callbacks ---
    const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles;
        if (filesToAdd.size === 0) return addToast("Сначала выберите файлы для добавления", 'error');
        const prefix = "Контекст кода для анализа (отвечай полным кодом, не пропуская части):\n";
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path))
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((file) => `\`\`\`${getLanguage(file.path)}:${file.path}\n${file.content}\n\`\`\``)
          .join("\n\n");
        setKworkInput((prev) => {
            const newContent = `${prefix}${markdownTxt}`;
            if (prev.trim().includes("Контекст кода для анализа")) return `${prev.trim()}\n\n---\n\n${newContent}`;
            if (prev.trim()) return `${newContent}\n\n${prev.trim()}`;
            return newContent;
        });
        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('kworkInput'); // Use context scroll function
    }, [files, selectedFiles, scrollToSection, addToast, setKworkInput, getLanguage]); // Added getLanguage dependency

   const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInput;
        if (!content.trim()) { addToast("Нет текста для копирования", 'error'); return false; }
        try {
            navigator.clipboard.writeText(content);
            addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            setRequestCopied(true); // Update context state
            if (shouldScroll) {
                 scrollToSection('aiResponseInput'); // Use context scroll function
            }
            return true;
        } catch (err) { console.error("Clipboard copy failed:", err); addToast("Ошибка копирования", 'error'); return false; }
    }, [kworkInput, setRequestCopied, scrollToSection, addToast]);

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
    }, [setSelectedFetcherFiles, addToast, kworkInputRef, setKworkInput]); // Dependencies updated

  // --- Fetch Logic ---
   const handleFetch = useCallback(async () => {
    if (!repoUrl.trim()) {
        addToast("Введите URL репозитория", 'error');
        setError("URL репозитория не может быть пустым.");
        setIsSettingsOpen(true); return;
    }
    setExtractLoading(true); setError(null); setFiles([]);
    const newSelectedFiles = new Set<string>();
    setSelectedFilesState(newSelectedFiles); setSelectedFetcherFiles(newSelectedFiles);
    setKworkInput(""); setFilesFetched(false, null, []); // Update context immediately
    setFetchStatus('loading'); setPrimaryHighlightedPath(null); setSecondaryHighlightedPaths([]);
    addToast("Запрос репозитория...", 'info'); startProgressSimulation();
    let filesToSelect = new Set<string>();

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);
      stopProgressSimulation(); // Stop simulation as soon as data arrives or fails

      if (!result || !result.success || !Array.isArray(result.files)) {
        throw new Error(result?.error || "Не удалось получить файлы или неверный формат ответа");
      }

      const fetchedFiles = result.files; setFiles(fetchedFiles);
      setFetchStatus('success'); // Set success status FIRST

      // --- Path Highlighting & Auto-Selection ---
      let primaryPath: string | null = null; let secondaryPaths: string[] = [];
      if (highlightedPathFromUrl) {
          primaryPath = getPageFilePath(highlightedPathFromUrl);
          const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
          if (pageFile) {
              console.log(`Auto-selecting primary: ${primaryPath}`);
              filesToSelect.add(primaryPath);
              const imports = extractImports(pageFile.content);
              secondaryPaths = imports
                  .map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles))
                  .filter((path): path is string => !!path && path !== primaryPath);
              console.log(`Auto-selecting secondary (${secondaryPaths.length}):`, secondaryPaths);
              secondaryPaths.forEach(path => filesToSelect.add(path));
          } else {
              addToast(`Файл страницы для URL (${primaryPath}) не найден`, 'error');
              primaryPath = null; // Reset if not found
          }
      }
      // Update state for highlights AFTER determining them
      setPrimaryHighlightedPath(primaryPath);
      setSecondaryHighlightedPaths(secondaryPaths);

      importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) { console.log(`Auto-selecting important: ${path}`); filesToSelect.add(path); } });

      // --- Update Context Post-Fetch ---
      setFilesFetched(true, primaryPath, secondaryPaths); // Update context with results AFTER setting status
      setIsSettingsOpen(false);
      if (fetchedFiles.length > 0) { addToast(`Извлечено ${fetchedFiles.length} файлов!`, 'success'); }
      else { addToast("Репозиторий извлечен, но файлы не найдены.", 'info'); }

      // --- AUTOMATION SEQUENCE ---
      if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
            console.log("Automation: Selecting files and generating request...");
            setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Авто-выбрано ${filesToSelect.size} файлов`, 'info');
            const task = ideaFromUrl || DEFAULT_TASK_IDEA;
            const prefix = "Контекст кода для анализа (отвечай полным кодом, не пропуская части):\n";
            const markdownTxt = fetchedFiles
                .filter((file) => filesToSelect.has(file.path))
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((file) => `\`\`\`${getLanguage(file.path)}:${file.path}\n${file.content}\n\`\`\``)
                .join("\n\n");
            const combinedContent = `${task}\n\n${prefix}${markdownTxt}`;
            setKworkInput(combinedContent);
            // Wait a tick for state update, then copy and redirect
            setTimeout(() => {
                const copied = handleCopyToClipboard(combinedContent, false); // Use callback
                if (copied) {
                    addToast("КОНТЕКСТ В БУФЕРЕ! Перенаправление...", 'success');
                    scrollToSection('aiResponseInput');
                    setTimeout(() => { window.location.href = 'https://aistudio.google.com'; }, 1200);
                } else {
                   addToast("Ошибка авто-копирования. Переход отменен.", 'error');
                   scrollToSection('kworkInput');
                }
            }, 100);
      } else {
           // If not automating, but files were determined for selection
           if (filesToSelect.size > 0) {
                setSelectedFilesState(filesToSelect);
                setSelectedFetcherFiles(filesToSelect);
                addToast(`Авто-выбрано ${filesToSelect.size} важных/связанных файлов`, 'info');
           }
          // Scroll to primary file if it exists
          if (primaryPath) {
             setTimeout(() => {
                const elementId = `file-${primaryPath}`;
                const fileElement = document.getElementById(elementId);
                if (fileElement) {
                     fileElement.scrollIntoView({ behavior: "smooth", block: "center" });
                     fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000');
                     setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'), 1500);
                } else { console.warn(`Element with ID ${elementId} not found for scrolling.`); }
             }, 400);
          } else if (fetchedFiles.length > 0) {
              // Scroll to the top of the file list if no primary highlight
              const fileListElement = document.getElementById('file-list-container');
              fileListElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
      }

    } catch (err: any) {
      stopProgressSimulation(); // Ensure progress stops
      const errorMessage = `Ошибка извлечения: ${err?.message || "Неизвестная ошибка"}`;
      setError(errorMessage); addToast(errorMessage, 'error'); console.error("Fetch error details:", err);
      setFilesFetched(false, null, []); // Update context
      setFiles([]); setProgress(0); setFetchStatus('error'); // Set error status LAST
    } finally {
      setExtractLoading(false);
      // Ensure progress bar visually completes on success/error if needed
      if (fetchStatus !== 'loading') { setProgress(100); }
    }
   }, [ // Ensure ALL dependencies are listed
        repoUrl, token, highlightedPathFromUrl, ideaFromUrl, importantFiles,
        addToast, startProgressSimulation, stopProgressSimulation,
        getPageFilePath, extractImports, resolveImportPath, getLanguage, // Utils
        setRepoUrlEntered, setFilesFetched, setSelectedFetcherFiles, setKworkInput, setRequestCopied, // Context setters
        handleCopyToClipboard, // Callbacks used inside fetch
        scrollToSection, // Context actions
        DEFAULT_TASK_IDEA, // Constants
        // No state readers like 'files' or 'selectedFiles' needed here as they are set within this callback
   ]);


  // --- Other Callbacks ---
   const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0;
        // Use state directly here as this callback reads the current highlight state
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; }
        secondaryHighlightedPaths.forEach(path => { if (files.some(f => f.path === path) && !filesToSelect.has(path)) { filesToSelect.add(path); newlySelectedCount++; } });
        if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info'); }
        else { addToast("Нет дополнительных связанных файлов для выбора", 'info'); }
   }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]); // Dependencies look correct

  const toggleFileSelection = useCallback((path: string) => {
    setSelectedFilesState(prevSet => {
        const newSet = new Set(prevSet);
        if (newSet.has(path)) newSet.delete(path); else newSet.add(path);
        setSelectedFetcherFiles(newSet); // Update context immediately
        return newSet;
    });
  }, [setSelectedFetcherFiles]);

  const handleAddImportantFiles = useCallback(() => {
    let addedCount = 0; const filesToAdd = new Set(selectedFiles);
    importantFiles.forEach(path => { if (files.some(f => f.path === path) && !selectedFiles.has(path)) { filesToAdd.add(path); addedCount++; } });
    if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены", 'info'); return; }
    setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
   }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);

  const handleAddFullTree = useCallback(() => {
    if (files.length === 0) return addToast("Нет файлов для отображения дерева", 'error');
    const treeOnly = files.map((file) => `- ${file.path}`).sort().join("\n");
    const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;
    let added = false;
    setKworkInput((prev) => {
        const trimmedPrev = prev.trim();
        if (trimmedPrev.includes("Структура файлов проекта:")) { return prev; } // Avoid duplicates
        added = true; // Mark as added
        return trimmedPrev ? `${trimmedPrev}\n\n${treeContent}` : treeContent;
    });
    if (added) { // Only toast if actually added
         addToast("Дерево файлов добавлено в запрос", 'success');
         scrollToSection('kworkInput');
    } else {
         addToast("Дерево файлов уже добавлено", 'info');
    }
  }, [files, setKworkInput, scrollToSection, addToast]); // kworkInput read removed, check done internally

  // --- Effects ---
  useEffect(() => {
    // Update context based on repoUrl state
    setRepoUrlEntered(repoUrl.trim().length > 0);
  }, [repoUrl, setRepoUrlEntered]);

  useEffect(() => {
    // Update context based on kworkInput state
    setKworkInputHasContent(kworkInput.trim().length > 0);
  }, [kworkInput, setKworkInputHasContent]);

  // Auto-fetch effect
  useEffect(() => {
    // Fetch only if autoFetch is true, URL is present, and not already loading/fetched/error
    if (autoFetch && repoUrl && fetchStatus === 'idle') {
      console.log("Triggering auto-fetch for path:", highlightedPathFromUrl);
      handleFetch(); // Call the memoized fetch handler
    }
    // Intentionally not depending on handleFetch here, it's stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus]); // Dependencies are correct

   // Cleanup progress simulation on unmount
  useEffect(() => {
    return () => { stopProgressSimulation(); };
   }, [stopProgressSimulation]);


  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({
    handleFetch,
    selectHighlightedFiles,
    handleAddSelected: () => handleAddSelected(), // Expose manual trigger
    handleCopyToClipboard: (textToCopy?: string, shouldScroll = true) => handleCopyToClipboard(textToCopy, shouldScroll),
    clearAll: handleClearAll,
  }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll]); // Ensure all methods exposed are listed

  // --- Render ---
  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">

      {/* Header & Settings Toggle */}
       <div className="flex justify-between items-start mb-4 gap-4">
            <div className="flex-grow">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                   <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода
                </h2>
                 {/* Instructions */}
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 1. Введите URL репозитория (и <span className="text-cyan-400 cursor-pointer hover:underline" onClick={() => setIsSettingsOpen(true)}>токен</span> для приватных).</p>
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
            loading={extractLoading}
            onClose={() => setIsSettingsOpen(false)}
        />

        {/* Fetch Button */}
        <div className="mb-4 flex justify-center">
            <motion.button
                onClick={handleFetch}
                disabled={extractLoading || !repoUrl.trim()}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-base text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-md shadow-purple-500/30 ${(extractLoading || !repoUrl.trim()) ? "opacity-60 cursor-not-allowed brightness-75" : "hover:shadow-lg hover:shadow-cyan-500/40 hover:brightness-110 active:scale-[0.98]"}`}
                whileHover={{ scale: (extractLoading || !repoUrl.trim()) ? 1 : 1.03 }}
                whileTap={{ scale: (extractLoading || !repoUrl.trim()) ? 1 : 0.97 }}
            >
                {fetchStatus === 'loading' ? <FaArrowsRotate className="animate-spin" /> : <FaDownload />}
                {fetchStatus === 'loading' ? "Загрузка..." : "Извлечь файлы"}
            </motion.button>
        </div>

      {/* Progress Bar & Status Area */}
       {(fetchStatus !== 'idle' || error) && (
            <div className="mb-4 min-h-[40px]"> {/* Reserve space */}
                {fetchStatus === 'loading' && <ProgressBar status={fetchStatus} progress={progress} />}
                {fetchStatus === 'loading' && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение: {Math.round(progress)}%</p>}
                {/* Use combined logic for success/error messages */}
                {fetchStatus === 'success' && (
                    <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                        <FaCircleCheck />
                        {files.length > 0 ? `Успешно извлечено ${files.length} файлов.` : "Успешно, но файлы не найдены."}
                    </div>
                )}
                 {fetchStatus === 'error' && error && ( // Show error only when status is error and error message exists
                    <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1">
                        <FaXmark /> {error}
                    </div>
                 )}
            </div>
        )}

      {/* === Main Content Area (Files & Input) === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

         {/* Left Column: File List & Controls */}
         <div className="flex flex-col gap-4">
            {/* Selected Files Preview (Optional) */}
            {selectedFiles.size > 0 && !extractLoading && (
                <SelectedFilesPreview
                    selectedFiles={selectedFiles}
                    allFiles={files}
                    getLanguage={getLanguage}
                />
            )}

            {/* File List */}
            {(files.length > 0 || fetchStatus === 'loading') && !error && ( // Show placeholder or list
                <FileList
                  id="file-list-container" // Added ID for potential scrolling
                  files={files}
                  selectedFiles={selectedFiles}
                  primaryHighlightedPath={primaryHighlightedPath}
                  secondaryHighlightedPaths={secondaryHighlightedPaths}
                  importantFiles={importantFiles}
                  isLoading={fetchStatus === 'loading'} // Pass loading state
                  toggleFileSelection={toggleFileSelection}
                  onAddSelected={() => handleAddSelected()} // Use component handler
                  onAddImportant={handleAddImportantFiles} // Use component handler
                  onAddTree={handleAddFullTree} // Use component handler
                  onSelectHighlighted={selectHighlightedFiles} // Use component handler
                />
            )}
         </div>

         {/* Right Column: Request Input */}
         {/* Show input area once fetch is attempted or files are loaded */}
         <div id="kwork-input-section"> {/* Added ID for scrolling target */}
             {(fetchStatus !== 'idle' || files.length > 0) && (
                 <RequestInput
                    kworkInput={kworkInput}
                    setKworkInput={setKworkInput}
                    kworkInputRef={kworkInputRef} // Pass DOM ref from context
                    onCopyToClipboard={() => handleCopyToClipboard()} // Use component's handler
                    onClearAll={handleClearAll} // Use component's handler
                    isCopyDisabled={!kworkInput.trim()} // Disable copy if empty
                    isClearDisabled={!kworkInput.trim() && selectedFiles.size === 0} // Disable clear if nothing to clear
                 />
             )}
         </div>

      </div> {/* End Grid */}

    </div> // End Component Root
  );
});

RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;