"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
// Updated icons: ChevronDown/Up for settings, Download/Spin for fetch, Check/Times for status, Trash
import { FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark } from "react-icons/fa6";
import { motion } from "framer-motion";

import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";

import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";

export interface FileNode {
  path: string;
  content: string;
}

interface RepoTxtFetcherProps {
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

// Helper outside component: Determine language for syntax highlighting
const getLanguage = (path: string): string => {
    const extension = path.split('.').pop();
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
        case 'md': return 'markdown';
        default: return 'text';
    }
};

const RepoTxtFetcher = forwardRef<any, RepoTxtFetcherProps>(({ kworkInputRef }, ref) => {
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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false); // Settings modal state
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const { user } = useAppContext();
  const {
    setRepoUrlEntered,
    setFilesFetched,
    setSelectedFetcherFiles,
    setKworkInputHasContent,
    setRequestCopied,
    scrollToSection,
  } = useRepoXmlPageContext();

  const searchParams = useSearchParams();
  // Use useCallback for derived state from searchParams if needed, or just read directly
  const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
  const ideaFromUrl = useMemo(() => {
      const ideaParam = searchParams.get("idea");
      return ideaParam ? decodeURIComponent(ideaParam) : "";
  }, [searchParams]);
  const autoFetch = !!highlightedPathFromUrl;

  // Default task if not provided by URL - should match StickyChatButton's default
  const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";


  const importantFiles = useMemo(() => [ // useMemo if these could theoretically change, otherwise const is fine
    "app/actions.ts",
    "hooks/useTelegram.ts",
    "contexts/AppContext.tsx",
    "types/supabase.ts",
  ], []);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Utility Functions ---
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    let style = { background: "rgba(34, 34, 34, 0.8)", color: "#E1FF01" }; // Default info
    if (type === 'success') style = { background: "rgba(22, 163, 74, 0.85)", color: "#ffffff" }; // Green-ish
    else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.85)", color: "#ffffff" }; // Red-ish

    toast(message, { style });
  }, []);


  const getPageFilePath = useCallback((routePath: string): string => {
    const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath; // Remove leading slash if present
    // Logic might need adjustment based on actual repo structure vs route structure
    // This assumes a direct mapping + /page.tsx
    if (!cleanPath) return 'app/page.tsx'; // Handle root path
    return `app/${cleanPath}/page.tsx`;
  }, []);

  const extractImports = useCallback((content: string): string[] => {
    // Improved regex to handle various import styles (including type imports)
    const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']@?([./\w-]+)["']/g;
    const matches = content.matchAll(importRegex);
    return Array.from(matches, (m) => m[1]).filter(imp => imp !== '.'); // Filter out self-imports like '.'
  }, []);

  const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
    // Prioritize TS/TSX, then JS/JSX, then index files
    const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

    // Handle Aliases like @/
    if (importPath.startsWith('@/')) {
      const relativePath = importPath.replace('@/', 'app/'); // Adjust base path for alias if needed
      for (const ext of possibleExtensions) {
        const potentialPath = `${relativePath}${ext}`;
        if (allFiles.some(file => file.path === potentialPath)) return potentialPath;
      }
       // Check for folder alias match (e.g., @/components resolves to app/components/index.ts)
       const indexPaths = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
       for(const indexPath of indexPaths) {
           const potentialPath = `${relativePath}${indexPath}`;
            if (allFiles.some(file => file.path === potentialPath)) return potentialPath;
       }
    }
    // Handle Relative Paths like ./ or ../
    else if (importPath.startsWith('.')) {
      const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
      try {
        // Basic path normalization (doesn't handle complex ../../ resolution perfectly but works for simple cases)
        const parts = (currentDir + '/' + importPath).split('/');
        const resolvedParts = [];
        for (const part of parts) {
            if (part === '.' || part === '') continue;
            if (part === '..') {
                resolvedParts.pop();
            } else {
                resolvedParts.push(part);
            }
        }
        let resolvedBase = resolvedParts.join('/');

        // Check direct file match first (if import includes extension)
         if (importPath.split('/').pop()?.includes('.')) {
              if (allFiles.some(file => file.path === resolvedBase)) {
                   return resolvedBase;
              }
         }

        // Check with extensions
        for (const ext of possibleExtensions) {
          const potentialPath = `${resolvedBase}${ext}`;
          if (allFiles.some(file => file.path === potentialPath)) {
             return potentialPath;
          }
        }
         // Check for folder match (resolves to index file)
        const indexPaths = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
        for(const indexPath of indexPaths) {
           const potentialPath = `${resolvedBase}${indexPath}`;
            if (allFiles.some(file => file.path === potentialPath)) return potentialPath;
       }

      } catch(e) {
         console.error("Error resolving relative path:", importPath, currentFilePath, e);
      }
    }
     // Basic node_modules or absolute path check (very simplified)
    else {
        // Try finding in common locations like 'components/', 'lib/', 'utils/' relative to 'app/'
        const possibleBases = ['app/components/', 'app/lib/', 'app/utils/', 'app/hooks/'];
         for (const base of possibleBases) {
             for (const ext of possibleExtensions) {
                const potentialPath = `${base}${importPath}${ext}`;
                if (allFiles.some(file => file.path === potentialPath)) return potentialPath;
             }
             const indexPaths = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
             for(const indexPath of indexPaths) {
                const potentialPath = `${base}${importPath}${indexPath}`;
                 if (allFiles.some(file => file.path === potentialPath)) return potentialPath;
            }
         }
    }

    // console.warn(`Could not resolve import "${importPath}" from "${currentFilePath}"`);
    return null;
  }, []);

  // --- Mocked Progress Logic ---
  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    progressIntervalRef.current = null;
    fetchTimeoutRef.current = null;
  }, []);

  const startProgressSimulation = useCallback((estimatedDurationSeconds = 7) => { // Reduced default time
    stopProgressSimulation();
    setProgress(0);
    setFetchStatus('loading');
    const increment = 100 / (estimatedDurationSeconds * 10); // 10 steps per second

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        // Simulate faster progress initially, then slow down
        const randomFactor = Math.random() * 0.5 + 0.75; // Between 0.75 and 1.25
        let nextProgress = prev + (increment * randomFactor);

        // Cap progress slightly before the end if timeout is still active
        if (nextProgress >= 95 && fetchTimeoutRef.current) {
            return Math.min(prev + increment * 0.1, 95); // Slow down significantly at the end
        }
         if (nextProgress >= 100) {
             stopProgressSimulation();
             return 100;
         }

        return nextProgress;
      });
    }, 100); // Update every 100ms

     // Set a timeout to ensure it reaches near completion even if interval is slow
     fetchTimeoutRef.current = setTimeout(() => {
         setProgress(prev => Math.max(prev, 95)); // Jump to 95% if not already there
         fetchTimeoutRef.current = null; // Clear timeout ref
          // Stop interval if it's somehow still running but timeout finished
          if(progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
          }
     }, estimatedDurationSeconds * 1000);

  }, [stopProgressSimulation]);


  // --- Fetch Logic ---
  const handleFetch = useCallback(async () => {
    if (!repoUrl.trim()) {
        addToast("Пожалуйста, введите URL репозитория.", 'error');
        setError("URL репозитория не может быть пустым.");
        setIsSettingsOpen(true); // Open settings if URL is missing
        return;
    }
    setExtractLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFilesState(new Set()); // Reset selection
    setKworkInput(""); // Reset input on new fetch
    setFilesFetched(false);
    setSelectedFetcherFiles(new Set());
    addToast("Извлечение файлов...", 'info');
    startProgressSimulation();

    let filesToSelect = new Set<string>(); // Keep track of files selected during fetch

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);

      if (!result || !result.success || !Array.isArray(result.files)) {
        stopProgressSimulation(); // Stop progress on early failure
        throw new Error(result?.error || "Не удалось загрузить содержимое репозитория или неверный формат данных");
      }

      const fetchedFiles = result.files;
      setFiles(fetchedFiles); // Set files state

      // --- Path Highlighting & Auto-Selection Logic ---
      let primaryPath: string | null = null;
      let secondaryPaths: string[] = [];

      if (highlightedPathFromUrl) {
          primaryPath = getPageFilePath(highlightedPathFromUrl);
          setPrimaryHighlightedPath(primaryPath); // For UI highlighting

          const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
          if (pageFile) {
              console.log(`Found primary page file: ${primaryPath}`);
              if (primaryPath) filesToSelect.add(primaryPath); // Auto-select primary file

              const imports = extractImports(pageFile.content);
              console.log(`Extracted imports from ${primaryPath}:`, imports);

              secondaryPaths = imports
                  .map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles))
                  .filter((path): path is string => path !== null);

              setSecondaryHighlightedPaths(secondaryPaths); // For UI highlighting
              console.log(`Resolved secondary paths for ${primaryPath}:`, secondaryPaths);
              secondaryPaths.forEach(path => filesToSelect.add(path)); // Auto-select secondary files

          } else {
              console.warn(`Page file "${primaryPath}" not found in repository for route: ${highlightedPathFromUrl}`);
              addToast(`Файл страницы для "${highlightedPathFromUrl}" (${primaryPath}) не найден.`, 'error');
              primaryPath = null; // Reset primaryPath if not found
          }
      }

      // Auto-select important files (only if they exist and aren't already selected)
      importantFiles.forEach(path => {
          if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) {
              filesToSelect.add(path);
          }
      });

      // --- Finalize Fetch State ---
       stopProgressSimulation(); // Stop progress simulation definitively
       setProgress(100);
       setFetchStatus('success');
       setFilesFetched(true, primaryPath, secondaryPaths); // Update context
       setIsSettingsOpen(false); // Close settings on successful fetch
       addToast(`Файлы извлечены (${fetchedFiles.length} шт.)!`, 'success');


      // --- AUTOMATION SEQUENCE (only if path and idea were provided) ---
      if (highlightedPathFromUrl && ideaFromUrl && primaryPath) {
          console.log("Starting automation for path:", highlightedPathFromUrl, "with idea:", ideaFromUrl);

          if (filesToSelect.size > 0) {
              // Update selection state immediately for UI consistency
              setSelectedFilesState(filesToSelect);
              setSelectedFetcherFiles(filesToSelect);
              addToast(`Авто-выбрано ${filesToSelect.size} файлов.`, 'info');

              // Prepare content for clipboard
              const task = ideaFromUrl || DEFAULT_TASK_IDEA; // Use idea from URL or fallback
              const prefix = "Контекст (please respond with full code without skipping any parts):\n";
              const markdownTxt = fetchedFiles
                  .filter((file) => filesToSelect.has(file.path))
                  .map((file) => `\`${file.path}\`:\n\`\`\`${getLanguage(file.path)}\n${file.content}\n\`\`\``)
                  .join("\n\n");
              const combinedContent = `${task}\n\n${prefix}${markdownTxt}`;

              // Update kworkInput state
              setKworkInput(combinedContent);

              // Copy the combined content directly to clipboard (returns true/false)
              const copied = handleCopyToClipboard(combinedContent, false); // Pass false to prevent auto-scroll inside copy

              if (copied) {
                  addToast("ВСТАВЛЯЙ И ВОЗВРАЩАЙСЯ", 'success');
                   // Scroll after copy, before redirect timeout
                  scrollToSection('aiResponseInput');
                  // Redirect after a short delay
                  setTimeout(() => {
                       window.location.href = 'https://aistudio.google.com';
                  }, 700); // Increased delay slightly
              } else {
                   addToast("Ошибка авто-копирования, переадресация отменена.", 'error');
                   scrollToSection('kworkInput'); // Scroll to input if copy failed
              }

          } else {
               addToast("Не удалось найти файлы для авто-выбора/добавления.", 'error');
               // Scroll to the primary file anyway if it exists
               if (primaryPath) {
                 setTimeout(() => { /* ... scrolling logic ... */ }, 300);
               }
          }
       // End of Automation Sequence block
      } else {
           // If not automating, set the selected files if any were determined (e.g., important files)
           if (filesToSelect.size > 0) {
                setSelectedFilesState(filesToSelect);
                setSelectedFetcherFiles(filesToSelect);
                addToast(`Авто-выбраны важные/связанные файлы (${filesToSelect.size}).`, 'info');
           }
          // Scroll to file list or primary file if highlighting occurred but no automation
          if (primaryPath) {
             setTimeout(() => {
                const fileToScrollTo = fetchedFiles.find(f => f.path === primaryPath);
                if (fileToScrollTo) {
                    const elementId = `file-${fileToScrollTo.path}`;
                    const fileElement = document.getElementById(elementId);
                    fileElement?.scrollIntoView({ behavior: "smooth", block: "center" });
                }
             }, 300);
          } else if (fetchedFiles.length > 0) {
              // TODO: Define scroll target ID for file list if needed
              // scrollToSection('fileListContainerId'); // Example
          }
      }

    } catch (err: any) {
      stopProgressSimulation(); // Ensure progress stops on any error
      const errorMessage = `Ошибка: ${err.message || "Неизвестная ошибка"}`;
      setError(errorMessage);
      addToast(errorMessage, 'error');
      console.error("Fetch error:", err);
      setFilesFetched(false);
      setProgress(0);
      setFetchStatus('error');
    } finally {
      setExtractLoading(false);
      // Optional: ensure progress simulation cleanup just in case
      // setTimeout(stopProgressSimulation, 500); // Might be redundant now
    }
  }, [
      repoUrl, token, highlightedPathFromUrl, ideaFromUrl, // Added ideaFromUrl
      importantFiles, // Added
      addToast, startProgressSimulation, stopProgressSimulation,
      getPageFilePath, extractImports, resolveImportPath,
      setFilesFetched, setSelectedFetcherFiles, setKworkInput,
      handleCopyToClipboard, // Added
      scrollToSection, // Added
      // Removed files, selectedFiles - they are read inside or passed directly now
  ]); // Dependencies reviewed


  // --- Effects ---
  useEffect(() => {
    setRepoUrlEntered(repoUrl.trim().length > 0);
  }, [repoUrl, setRepoUrlEntered]);

  useEffect(() => {
    setKworkInputHasContent(kworkInput.trim().length > 0);
    // Reset requestCopied flag when input changes AFTER an initial copy
    // This logic might need refinement depending on exact desired behavior
    // if (requestCopied && kworkInput.trim().length > 0) {
    //   setRequestCopied(false);
    // }
  }, [kworkInput, setKworkInputHasContent /*, setRequestCopied, requestCopied */]);

  // Auto-fetch effect (runs only once when path/repoUrl are ready)
  useEffect(() => {
    if (autoFetch && repoUrl && fetchStatus === 'idle') { // Only fetch if idle
      console.log("Auto-fetching for path:", highlightedPathFromUrl);
      handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus]); // Added fetchStatus dependency

   // Cleanup interval on unmount
  useEffect(() => {
    return () => {
        stopProgressSimulation();
    };
  }, [stopProgressSimulation]);

  // --- File Selection & Kwork Input Logic ---

  // Note: selectHighlightedFiles is now mostly handled within handleFetch for auto-mode
  // This function remains for potential manual triggering if needed via imperative handle
  const selectHighlightedFiles = useCallback(() => {
    const filesToSelect = new Set<string>();
    if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath)) {
        filesToSelect.add(primaryHighlightedPath);
    }
    secondaryHighlightedPaths.forEach(path => {
        if (files.some(f => f.path === path)) {
            filesToSelect.add(path);
        }
    });
    importantFiles.forEach(path => {
        if (files.some(f => f.path === path) && !filesToSelect.has(path)) { // Avoid duplicates
            filesToSelect.add(path);
        }
    });

    if (filesToSelect.size > 0) {
        setSelectedFilesState(filesToSelect);
        setSelectedFetcherFiles(filesToSelect);
        addToast(`Выбрано ${filesToSelect.size} связанных/важных файлов!`, 'info');
        // Optionally add them to kworkInput immediately? Depends on desired flow.
        // handleAddSelected(filesToSelect);
    } else {
         addToast("Нет связанных/важных файлов для подсветки/выбора.", 'info');
    }
  }, [primaryHighlightedPath, secondaryHighlightedPaths, importantFiles, files, setSelectedFetcherFiles, addToast, handleAddSelected]); // Added handleAddSelected if immediate add is desired


  const toggleFileSelection = useCallback((path: string) => {
    setSelectedFilesState(prevSet => {
        const newSet = new Set(prevSet);
        if (newSet.has(path)) {
            newSet.delete(path);
        } else {
            newSet.add(path);
        }
        setSelectedFetcherFiles(newSet); // Update context as well
        return newSet;
    });
  }, [setSelectedFetcherFiles]); // Removed selectedFiles dependency, using functional update

  // Manual addition of selected files
  const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
    const filesToAdd = filesToAddParam || selectedFiles;
    if (filesToAdd.size === 0) {
      addToast("Выберите хотя бы один файл!", 'error');
      return;
    }
    const prefix = "Контекст (please respond with full code without skipping any parts):\n"; // Updated prefix
    const markdownTxt = files
      .filter((file) => filesToAdd.has(file.path))
      .map((file) => `\`${file.path}\`:\n\`\`\`${getLanguage(file.path)}\n${file.content}\n\`\`\``)
      .join("\n\n");

    setKworkInput((prev) => {
        const newContent = `${prefix}${markdownTxt}`;
        // Append intelligently: add separator only if prev has content
        return prev.trim() ? `${prev.trim()}\n\n${newContent}` : newContent;
    });

    addToast(`${filesToAdd.size} файлов добавлено в запрос.`, 'success');
    scrollToSection('kworkInput'); // Scroll to input after adding manually
}, [files, selectedFiles, scrollToSection, addToast]); // Keep selectedFiles dependency for fallback


  const handleAddImportantFiles = useCallback(() => {
    let addedCount = 0;
    const currentSelected = selectedFiles; // Read state once
    const filesToAdd = new Set(currentSelected); // Clone current selection

    importantFiles.forEach(path => {
      if (files.some(f => f.path === path) && !currentSelected.has(path)) { // Check against original selection
        filesToAdd.add(path);
        addedCount++;
      }
    });

    if (addedCount === 0) {
         addToast("Важные файлы уже выбраны или не найдены в репозитории.", 'info');
         return;
    }

    setSelectedFilesState(filesToAdd); // Update state with new set
    setSelectedFetcherFiles(filesToAdd); // Update context
    addToast(`${addedCount} важных файлов добавлено в выборку!`, 'success');
    handleAddSelected(filesToAdd); // Add them to kwork input automatically

  }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, handleAddSelected, addToast]);

  const handleAddFullTree = useCallback(() => {
    if (files.length === 0) {
        addToast("Нет файлов для отображения дерева.", 'error');
        return;
    }
    const treeOnly = files.map((file) => `- ${file.path}`).join("\n");
    const treeContent = `Структура проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;
    setKworkInput((prev) => prev.trim() ? `${prev.trim()}\n\n${treeContent}` : treeContent);
    addToast("Дерево файлов добавлено в запрос!", 'success');
    scrollToSection('kworkInput');
  }, [files, scrollToSection, addToast]);

  // Refactored copy to clipboard
   const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInput;
        if (!content.trim()) {
            addToast("Нечего копировать!", 'error');
            return false;
        }
        try {
            navigator.clipboard.writeText(content);
            // Use specific toast only for manual copy
            if (!textToCopy) {
                 addToast("Скопировано! Вставьте в AI, затем результат вставьте ниже.", 'success');
            }
            setRequestCopied(true);
            if (shouldScroll) {
                 scrollToSection('aiResponseInput'); // Scroll only if requested
            }
            return true;
        } catch (err) {
            console.error("Failed to copy:", err);
            addToast("Ошибка копирования в буфер обмена.", 'error');
            return false;
        }
    }, [kworkInput, setRequestCopied, scrollToSection, addToast]); // Keep kworkInput dependency for fallback


  // --- Clear All Logic ---
  const handleClearAll = useCallback(() => {
        setSelectedFilesState(new Set());
        setSelectedFetcherFiles(new Set());
        setKworkInput("");
        addToast("Очищено!", 'success');
        // Optional: Scroll back to the top of the input or file list
        if (kworkInputRef.current) {
            kworkInputRef.current.focus();
            // or scrollToSection('extractor'); // Scroll back to fetch area
        }
    }, [setSelectedFetcherFiles, addToast, kworkInputRef]); // Dependencies


  // --- Imperative Handle ---
  useImperativeHandle(ref, () => ({
    handleFetch,
    selectHighlightedFiles, // Expose manual selection if needed
    handleAddSelected: () => handleAddSelected(),
    handleCopyToClipboard: () => handleCopyToClipboard(), // Expose manual copy
    clearAll: handleClearAll, // Expose clear all
  }));

  // --- Render ---
  return (
    <div id="extractor" className="w-full p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden"> {/* Added ID for scrolling */}

      {/* Header & Intro Text (unchanged) */}
       <div id="intro" className="flex justify-between items-start mb-1"> {/* Added ID for scrolling */}
            <div className="flex-grow mr-4"> {/* Allow text to take space */}
                <h2 className="text-2xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-2">
                Кибер-Экстрактор Кода
                </h2>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 1️⃣ Введите URL репозитория (и токен для приватных <FaCircleChevronDown className="inline text-cyan-400 cursor-pointer" onClick={() => setIsSettingsOpen(true)}/>). </p>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 2️⃣ Нажмите <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span> ниже <FaDownload className="inline text-purple-400"/>. </p>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 3️⃣ Выберите нужные файлы для контекста. </p>
                 <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 4️⃣ Опишите задачу в поле ниже и добавьте код кнопками <span className="font-bold text-indigo-400 mx-1">"Добавить..."</span>. </p>
            </div>
            <motion.button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors flex-shrink-0"
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                title={isSettingsOpen ? "Скрыть настройки" : "Показать настройки URL/Token"}
                aria-expanded={isSettingsOpen}
            >
                {isSettingsOpen ? <FaCircleChevronUp className="text-cyan-400 text-xl" /> : <FaCircleChevronDown className="text-cyan-400 text-xl" />}
            </motion.button>
       </div>

        <SettingsModal
            isOpen={isSettingsOpen}
            repoUrl={repoUrl}
            setRepoUrl={setRepoUrl}
            token={token}
            setToken={setToken}
            loading={extractLoading}
        />

        <div className="mb-4 flex justify-center">
            <motion.button
                onClick={handleFetch}
                disabled={extractLoading || !repoUrl.trim()}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-base text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.4)] ${(extractLoading || !repoUrl.trim()) ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_18px_rgba(0,255,157,0.6)] hover:from-purple-700 hover:to-cyan-600"}`}
                whileHover={{ scale: (extractLoading || !repoUrl.trim()) ? 1 : 1.05 }}
                whileTap={{ scale: (extractLoading || !repoUrl.trim()) ? 1 : 0.95 }}
            >
                {extractLoading ? <FaArrowsRotate className="animate-spin" /> : <FaDownload />}
                {extractLoading ? "Извлечение..." : "Извлечь файлы"}
            </motion.button>
        </div>

      {/* Progress Bar & Status (unchanged) */}
       {(fetchStatus === 'loading' || (fetchStatus === 'success' && files.length === 0) || fetchStatus === 'error') && (
            <div className="mb-6">
                 <ProgressBar status={fetchStatus} progress={progress} />
                 {fetchStatus === 'loading' && <p className="text-white text-xs font-mono mt-1 text-center">Извлечение: {Math.round(progress)}%</p>}
                 {fetchStatus === 'success' && files.length === 0 && <p className="text-green-400 text-xs font-mono mt-1 text-center flex items-center justify-center gap-1"><FaCircleCheck /> Успешно, но файлы не найдены?</p>}
                 {fetchStatus === 'error' && <p className="text-red-400 text-xs font-mono mt-1 text-center flex items-center justify-center gap-1"><FaXmark /> {error || "Произошла ошибка"}</p>}
            </div>
        )}
        {error && fetchStatus !== 'error' && files.length > 0 && <p className="text-red-400 mb-6 text-xs font-mono">{error}</p>}

      {/* Selected Files Preview (pass getLanguage prop) */}
       {selectedFiles.size > 0 && (
            <SelectedFilesPreview
                selectedFiles={selectedFiles}
                allFiles={files}
                getLanguage={getLanguage} // Pass the helper function
            />
        )}

      {/* File List (pass callbacks) */}
      {files.length > 0 && !extractLoading && (
        <FileList
          files={files}
          selectedFiles={selectedFiles}
          primaryHighlightedPath={primaryHighlightedPath}
          secondaryHighlightedPaths={secondaryHighlightedPaths}
          importantFiles={importantFiles}
          toggleFileSelection={toggleFileSelection}
          onAddSelected={() => handleAddSelected()} // Wrap in arrow function
          onAddImportant={handleAddImportantFiles}
          onAddTree={handleAddFullTree}
        />
      )}

      {/* Kwork Input Area (pass new props) */}
      <RequestInput
        kworkInput={kworkInput}
        setKworkInput={setKworkInput}
        kworkInputRef={kworkInputRef}
        onCopyToClipboard={() => handleCopyToClipboard()} // Wrap in arrow function for manual call
        onClearAll={handleClearAll} // Pass the clear handler
        isClearDisabled={!kworkInput.trim() && selectedFiles.size === 0} // Calculate disabled state
      />

    </div>
  );
});

RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;
