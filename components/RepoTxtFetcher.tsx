"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaCircleChevronDown, FaCircleCheck, FaCircleChevronUp } from "react-icons/fa6"; // Added icons
import { motion } from "framer-motion";

import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";

import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar"; // Import ProgressBar

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
  const [progress, setProgress] = useState<number>(0); // Progress state remains here
  const [error, setError] = useState<string | null>(null);
  const [kworkInput, setKworkInput] = useState<string>("");
  const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false); // State for modal
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle'); // For progress bar

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
  const highlightedPathFromUrl = searchParams.get("path") || "";
  const autoFetch = !!highlightedPathFromUrl;

  // Define important files (could be moved to config/constants)
  const importantFiles = [
    "app/actions.ts",
    "hooks/useTelegram.ts",
    "contexts/AppContext.tsx",
    "types/supabase.ts",
  ];

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Utility Functions ---
  const addToast = (message: string) => {
    toast(message, { style: { background: "rgba(34, 34, 34, 0.8)", color: "#E1FF01" } });
  };

  const getPageFilePath = (routePath: string): string => {
    const cleanPath = routePath;
    return `${cleanPath}/page.tsx`;
  };

  const extractImports = (content: string): string[] => {
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    const matches = content.matchAll(importRegex);
    return Array.from(matches, (m) => m[1]);
  };

  const resolveImportPath = (importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
    if (importPath.startsWith('@/')) {
      const relativePath = importPath.replace('@/', '');
      const possibleExtensions = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
      for (const ext of possibleExtensions) {
        const potentialPath = `${relativePath}${ext}`;
        if (allFiles.some(file => file.path === potentialPath)) return potentialPath;
      }
    } else if (importPath.startsWith('.')) {
      const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
      // Basic relative path resolution (needs URL polyfill/better logic for edge cases)
      try {
         // Simulate browser URL resolution behavior
         const baseUrl = `file://${currentDir}/`;
         // Ensure importPath has a filename part for URL constructor
         const resolvedUrl = new URL(importPath.endsWith('/') ? importPath + 'index' : importPath, baseUrl);
         let resolved = resolvedUrl.pathname.substring(1); // Remove leading '/'

         const possibleExtensions = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];
         for (const ext of possibleExtensions) {
            // Adjust path if it resolved to a directory looking for index
            let potentialPath = resolved;
             if (importPath.endsWith('/') && (ext === '/index.tsx' || ext === '/index.ts')) {
                 potentialPath += ext; // Already has implicit directory
             } else if (!importPath.endsWith('/') && !importPath.split('/').pop()?.includes('.')){
                 // If import looks like './components' add extension
                  potentialPath += ext;
             } else if (ext && !potentialPath.endsWith(ext)) {
                 potentialPath += ext; // Add extension if needed
             }
             // Remove double slashes that might occur
             potentialPath = potentialPath.replace(/\/\//g, '/');

            if (allFiles.some(file => file.path === potentialPath)) {
               return potentialPath;
            }
         }
      } catch(e) {
         console.error("Error resolving relative path:", importPath, currentFilePath, e);
      }
    }
    return null;
  };

  // --- Mocked Progress Logic ---
  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
     if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
    }
  }, []);

  const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
    stopProgressSimulation(); // Clear any existing timers
    setProgress(0);
    setFetchStatus('loading');
    const increment = 100 / (estimatedDurationSeconds * 10); // Update 10 times per second

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + increment;
        if (nextProgress >= 69) { // Cap at 69%
            if (fetchTimeoutRef.current) { // If the actual fetch is still running past estimate
                 return 69;
            } else {
                 // This case shouldn't normally be hit if cleanup is correct,
                 // but ensures interval stops if progress exceeds cap *after* fetch finished/errored
                 stopProgressSimulation();
                 return 69; // Stay at 69 if fetch finished early but interval fired late
            }
        }
        return nextProgress;
      });
    }, 100); // Update every 100ms

    // Set a timeout to mark the fetch as potentially "hanging" if not completed
     fetchTimeoutRef.current = setTimeout(() => {
         // If the interval is still running (meaning fetch hasn't completed/errored)
         if (progressIntervalRef.current) {
             setProgress(69); // Force to 69%
             // Keep the interval running at 69 until success/error actually occurs
         }
         fetchTimeoutRef.current = null; // Timeout fulfilled its purpose
     }, estimatedDurationSeconds * 1000);

  }, [stopProgressSimulation]);


  // --- Fetch Logic ---
  const handleFetch = useCallback(async () => {
    setExtractLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFilesState(new Set());
    setFilesFetched(false);
    setSelectedFetcherFiles(new Set());
    addToast("Извлечение файлов...");
    startProgressSimulation(); // Start mocked progress

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);
      stopProgressSimulation(); // Stop simulation on actual result

      if (!result || !result.success || !Array.isArray(result.files)) {
        throw new Error(result?.error || "Не удалось загрузить содержимое репозитория или неверный формат данных");
      }

      const fetchedFiles = result.files;
      setFiles(fetchedFiles);
      setProgress(100); // Set progress to 100% on success
      setFetchStatus('success');

      let primaryPath: string | null = null;
      let secondaryPaths: string[] = [];

      if (highlightedPathFromUrl) {
          primaryPath = getPageFilePath(highlightedPathFromUrl);
          setPrimaryHighlightedPath(primaryPath);
          const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
          if (pageFile) {
              const imports = extractImports(pageFile.content);
              secondaryPaths = imports
                  .map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles))
                  .filter((path): path is string => path !== null);
              setSecondaryHighlightedPaths(secondaryPaths);
          } else {
              console.warn(`Page file "${primaryPath}" not found in repository`);
              primaryPath = null;
          }
      }

      setFilesFetched(true, primaryPath, secondaryPaths);
      addToast("Файлы извлечены! Готов к следующему шагу.");
      setIsSettingsOpen(false); // Close settings on successful fetch

      // Auto-scroll logic (moved slightly later)
      if (primaryPath) {
          setTimeout(() => {
              const fileToScrollTo = fetchedFiles.find(f => f.path === primaryPath);
              if (fileToScrollTo) {
                  const elementId = `file-${fileToScrollTo.path}`;
                  const fileElement = document.getElementById(elementId);
                  if (fileElement) {
                      fileElement.scrollIntoView({ behavior: "smooth", block: "center" });
                  } else {
                      console.warn(`Element ID "${elementId}" not found for scrolling.`);
                  }
              }
          }, 300); // Short delay
      }

    } catch (err: any) {
      stopProgressSimulation(); // Stop simulation on error
      const errorMessage = `Ошибка: ${err.message || "Неизвестная ошибка"}`;
      setError(errorMessage);
      addToast(errorMessage);
      console.error("Fetch error:", err);
      setFilesFetched(false);
      setProgress(0); // Reset progress on error
      setFetchStatus('error');
    } finally {
      setExtractLoading(false);
       // Ensure cleanup happens even if component unmounts during fetch
       setTimeout(stopProgressSimulation, 500); // Add slight delay for final state update render
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl, token, highlightedPathFromUrl, setFilesFetched, setSelectedFetcherFiles, addToast, startProgressSimulation, stopProgressSimulation]); // Dependencies for handleFetch


  // --- Effects ---
  useEffect(() => {
    setRepoUrlEntered(repoUrl.trim().length > 0);
  }, [repoUrl, setRepoUrlEntered]);

  useEffect(() => {
    setKworkInputHasContent(kworkInput.trim().length > 0);
    if (kworkInput.trim().length > 0) {
      setRequestCopied(false);
    }
  }, [kworkInput, setKworkInputHasContent, setRequestCopied]);

  useEffect(() => {
    if (autoFetch) {
      console.log("Auto-fetching for path:", highlightedPathFromUrl);
      handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl]); // Only run when URL param changes

   // Cleanup interval on unmount
  useEffect(() => {
    return () => {
        stopProgressSimulation();
    };
  }, [stopProgressSimulation]);

  // --- File Selection & Kwork Input Logic ---
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
        if (files.some(f => f.path === path)) {
            filesToSelect.add(path);
        }
    });

    setSelectedFilesState(filesToSelect);
    setSelectedFetcherFiles(filesToSelect);
    addToast("Подсвеченные и важные файлы выбраны!");
    handleAddSelected(filesToSelect); // Auto-add to Kwork
  }, [primaryHighlightedPath, secondaryHighlightedPaths, importantFiles, files, setSelectedFetcherFiles, addToast]); // Removed handleAddSelected from deps

  const toggleFileSelection = (path: string) => {
    const newSet = new Set(selectedFiles);
    if (newSet.has(path)) newSet.delete(path);
    else newSet.add(path);
    setSelectedFilesState(newSet);
    setSelectedFetcherFiles(newSet);
  };

  const handleAddSelected = useCallback((filesToAdd?: Set<string>) => {
    const setToAdd = filesToAdd || selectedFiles;
    if (setToAdd.size === 0) {
      addToast("Выберите хотя бы один файл!");
      return;
    }
    const markdownTxt = files
      .filter((file) => setToAdd.has(file.path))
      .map((file) => `\`${file.path}\`:\n\`\`\`${getLanguage(file.path)}\n${file.content}\n\`\`\``)
      .join("\n\n");

    setKworkInput((prev) => `${prev ? prev + '\n\n' : ''}Контекст:\n${markdownTxt}`);
    addToast(`${setToAdd.size} файлов добавлено. Опишите задачу и нажмите 'Скопировать'.`);
    scrollToSection('kworkInput');
  }, [files, selectedFiles, scrollToSection, addToast]); // Dependencies for handleAddSelected

  const handleAddImportantFiles = useCallback(() => {
    const filesToAdd = new Set(selectedFiles);
    let addedCount = 0;
    importantFiles.forEach(path => {
      if (files.some(f => f.path === path) && !filesToAdd.has(path)) {
        filesToAdd.add(path);
        addedCount++;
      }
    });

    if (addedCount === 0 && filesToAdd.size > 0) {
         addToast("Важные файлы уже выбраны или добавлены.");
         return;
    }
     if (addedCount === 0 && filesToAdd.size === 0) {
         addToast("Важные файлы не найдены в репозитории.");
         return;
    }

    setSelectedFilesState(filesToAdd);
    setSelectedFetcherFiles(filesToAdd);
    handleAddSelected(filesToAdd); // Add them to kwork
    addToast(`${addedCount} важных файлов добавлено в выборку и запрос!`);
  }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, handleAddSelected, addToast]);

  const handleAddFullTree = useCallback(() => {
    const treeOnly = files.map((file) => `- ${file.path}`).join("\n");
    setKworkInput((prev) => `${prev}\n\nСтруктура проекта:\n\`\`\`\n${treeOnly}\n\`\`\``);
    addToast("Дерево файлов добавлено в запрос!");
    scrollToSection('kworkInput');
  }, [files, scrollToSection, addToast]);

  const handleCopyToClipboard = useCallback(() => {
    if (!kworkInput.trim()) {
      addToast("Нечего копировать!");
      return;
    }
    navigator.clipboard.writeText(kworkInput);
    addToast("Скопировано! Вставьте в AI, затем результат вставьте ниже.");
    setRequestCopied(true);
    scrollToSection('aiResponseInput');
  }, [kworkInput, setRequestCopied, scrollToSection, addToast]);


  // --- Imperative Handle (Expose methods to parent) ---
  useImperativeHandle(ref, () => ({
    handleFetch,
    selectHighlightedFiles,
    handleAddSelected: () => handleAddSelected(), // Ensure it uses current selectedFiles state
    handleCopyToClipboard,
  }));

  // --- Render ---
  return (
    <div className="w-full p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">

      {/* Header & Intro Text */}
       <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-2">
                Кибер-Экстрактор Кода
                </h2>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 1️⃣ Введите URL репозитория (и токен для приватных). </p>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 2️⃣ Нажмите <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>. </p>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 3️⃣ Выберите нужные файлы для контекста. </p>
                 <p className="text-yellow-400 mb-4 text-xs md:text-sm"> 4️⃣ Опишите задачу в поле ниже и добавьте код кнопками <span className="font-bold text-indigo-400 mx-1">"Добавить..."</span>. </p>
            </div>
            <motion.button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Настройки репозитория"
            >
                <FaCircleChevronDown className="text-cyan-400 text-xl" />
            </motion.button>
       </div>


      {/* Settings Modal/Section */}
      <SettingsModal
        isOpen={isSettingsOpen}
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        token={token}
        setToken={setToken}
        onFetch={handleFetch}
        loading={extractLoading}
      />

      {/* Progress Bar & Status */}
       {(fetchStatus === 'loading' || fetchStatus === 'success' || fetchStatus === 'error') && files.length === 0 && ( // Show only during initial load or if error before files appear
            <div className="mb-6">
                 <ProgressBar status={fetchStatus} progress={progress} />
                 {fetchStatus === 'loading' && <p className="text-white text-xs font-mono mt-1 text-center">Извлечение: {Math.round(progress)}%</p>}
                 {fetchStatus === 'success' && files.length === 0 && <p className="text-green-400 text-xs font-mono mt-1 text-center flex items-center justify-center gap-1"><FaCircleCheck /> Успешно, но файлы не найдены?</p>}
                 {fetchStatus === 'error' && <p className="text-red-400 text-xs font-mono mt-1 text-center flex items-center justify-center gap-1"><FaCircleChevronUp /> {error || "Произошла ошибка"}</p>}
            </div>
        )}
         {/* Show general error if it occurs *after* files might have been partially listed (less likely but possible) */}
        {error && fetchStatus !== 'error' && <p className="text-red-400 mb-6 text-xs font-mono">{error}</p>}


      {/* Selected Files Preview (Moved Up) */}
       {selectedFiles.size > 0 && (
            <SelectedFilesPreview
                selectedFiles={selectedFiles}
                allFiles={files}
                getLanguage={getLanguage} // Pass helper
            />
        )}

      {/* File List */}
      {files.length > 0 && !extractLoading && (
        <FileList
          files={files}
          selectedFiles={selectedFiles}
          primaryHighlightedPath={primaryHighlightedPath}
          secondaryHighlightedPaths={secondaryHighlightedPaths}
          importantFiles={importantFiles}
          toggleFileSelection={toggleFileSelection}
          onAddSelected={handleAddSelected}
          onAddImportant={handleAddImportantFiles}
          onAddTree={handleAddFullTree}
        />
      )}

      {/* Kwork Input Area */}
      <RequestInput
        kworkInput={kworkInput}
        setKworkInput={setKworkInput}
        kworkInputRef={kworkInputRef}
        onCopyToClipboard={handleCopyToClipboard}
      />

    </div>
  );
});

RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;