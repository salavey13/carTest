// /components/RepoTxtFetcher.tsx
"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
// Updated icons: ChevronDown/Up for settings, Download/Spin for fetch, Check/Times for status
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
  const highlightedPathFromUrl = searchParams.get("path") || "";
  const autoFetch = !!highlightedPathFromUrl;

  const importantFiles = [
    "app/actions.ts",
    "hooks/useTelegram.ts",
    "contexts/AppContext.tsx",
    "types/supabase.ts",
  ];

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Utility Functions ---
  const addToast = useCallback((message: string) => {
    toast(message, { style: { background: "rgba(34, 34, 34, 0.8)", color: "#E1FF01" } });
  }, []);

  const getPageFilePath = useCallback((routePath: string): string => {
    const cleanPath = routePath;
    return `${cleanPath}/page.tsx`;
  }, []);

  const extractImports = useCallback((content: string): string[] => {
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    const matches = content.matchAll(importRegex);
    return Array.from(matches, (m) => m[1]);
  }, []);

  const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
    if (importPath.startsWith('@/')) {
      const relativePath = importPath.replace('@/', '');
      const possibleExtensions = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
      for (const ext of possibleExtensions) {
        const potentialPath = `${relativePath}${ext}`;
        if (allFiles.some(file => file.path === potentialPath)) return potentialPath;
      }
    } else if (importPath.startsWith('.')) {
      const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
      try {
         const baseUrl = `file://${currentDir}/`;
         const resolvedUrl = new URL(importPath.endsWith('/') ? importPath + 'index' : importPath, baseUrl);
         let resolved = resolvedUrl.pathname.substring(1);
         const possibleExtensions = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];
         for (const ext of possibleExtensions) {
            let potentialPath = resolved;
             if (importPath.endsWith('/') && (ext === '/index.tsx' || ext === '/index.ts')) {
                 potentialPath += ext;
             } else if (!importPath.endsWith('/') && !importPath.split('/').pop()?.includes('.')){
                  potentialPath += ext;
             } else if (ext && !potentialPath.endsWith(ext)) {
                 potentialPath += ext;
             }
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
  }, []);

  // --- Mocked Progress Logic ---
  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    progressIntervalRef.current = null;
    fetchTimeoutRef.current = null;
  }, []);

  const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
    stopProgressSimulation();
    setProgress(0);
    setFetchStatus('loading');
    const increment = 100 / (estimatedDurationSeconds * 10);

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + increment;
        if (nextProgress >= 69) {
            if (fetchTimeoutRef.current) return 69;
            else {
                 stopProgressSimulation();
                 return 69;
            }
        }
        return nextProgress;
      });
    }, 100);

     fetchTimeoutRef.current = setTimeout(() => {
         if (progressIntervalRef.current) setProgress(69);
         fetchTimeoutRef.current = null;
     }, estimatedDurationSeconds * 1000);

  }, [stopProgressSimulation]);


  // --- Fetch Logic ---
  const handleFetch = useCallback(async () => {
    if (!repoUrl.trim()) {
        addToast("Пожалуйста, введите URL репозитория.");
        setError("URL репозитория не может быть пустым.");
        setIsSettingsOpen(true); // Open settings if URL is missing
        return;
    }
    setExtractLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFilesState(new Set());
    setFilesFetched(false);
    setSelectedFetcherFiles(new Set());
    addToast("Извлечение файлов...");
    startProgressSimulation();

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);
      stopProgressSimulation();

      if (!result || !result.success || !Array.isArray(result.files)) {
        throw new Error(result?.error || "Не удалось загрузить содержимое репозитория или неверный формат данных");
      }

      const fetchedFiles = result.files;
      setFiles(fetchedFiles);
      setProgress(100);
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
          }, 300);
      }

    } catch (err: any) {
      stopProgressSimulation();
      const errorMessage = `Ошибка: ${err.message || "Неизвестная ошибка"}`;
      setError(errorMessage);
      addToast(errorMessage);
      console.error("Fetch error:", err);
      setFilesFetched(false);
      setProgress(0);
      setFetchStatus('error');
    } finally {
      setExtractLoading(false);
      setTimeout(stopProgressSimulation, 500);
    }
  }, [repoUrl, token, highlightedPathFromUrl, setFilesFetched, setSelectedFetcherFiles, addToast, startProgressSimulation, stopProgressSimulation, getPageFilePath, extractImports, resolveImportPath]);


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
    if (autoFetch && repoUrl) { // Ensure repoUrl is set before auto-fetching
      console.log("Auto-fetching for path:", highlightedPathFromUrl);
      handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl]); // Add repoUrl dependency for autoFetch

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
    handleAddSelected(filesToSelect);
  }, [primaryHighlightedPath, secondaryHighlightedPaths, importantFiles, files, setSelectedFetcherFiles, addToast]); // Removed handleAddSelected dep

  const toggleFileSelection = useCallback((path: string) => {
    const newSet = new Set(selectedFiles);
    if (newSet.has(path)) newSet.delete(path);
    else newSet.add(path);
    setSelectedFilesState(newSet);
    setSelectedFetcherFiles(newSet);
  }, [selectedFiles, setSelectedFetcherFiles]);

  const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
    const filesToAdd = filesToAddParam || selectedFiles; // Use parameter if provided, else state
    if (filesToAdd.size === 0) {
      addToast("Выберите хотя бы один файл!");
      return;
    }
    const markdownTxt = files
      .filter((file) => filesToAdd.has(file.path))
      .map((file) => `\`${file.path}\`:\n\`\`\`${getLanguage(file.path)}\n${file.content}\n\`\`\``)
      .join("\n\n");

    setKworkInput((prev) => `${prev ? prev + '\n\n' : ''}Контекст:\n${markdownTxt}`);
    addToast(`${filesToAdd.size} файлов добавлено. Опишите задачу и нажмите 'Скопировать'.`);
    scrollToSection('kworkInput');
}, [files, selectedFiles, scrollToSection, addToast]); // Keep selectedFiles here as fallback

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


  // --- Imperative Handle ---
  useImperativeHandle(ref, () => ({
    handleFetch,
    selectHighlightedFiles,
    handleAddSelected: () => handleAddSelected(),
    handleCopyToClipboard,
  }));

  // --- Render ---
  return (
    <div className="w-full p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">

      {/* Header & Intro Text */}
       <div className="flex justify-between items-start mb-1"> {/* Reduced bottom margin */}
            <div className="flex-grow mr-4"> {/* Allow text to take space */}
                <h2 className="text-2xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-2">
                Кибер-Экстрактор Кода
                </h2>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 1️⃣ Введите URL репозитория (и токен для приватных <FaCircleChevronDown className="inline text-cyan-400 cursor-pointer" onClick={() => setIsSettingsOpen(true)}/>). </p>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 2️⃣ Нажмите <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span> ниже <FaDownload className="inline text-purple-400"/>. </p>
                 <p className="text-yellow-400 mb-1 text-xs md:text-sm"> 3️⃣ Выберите нужные файлы для контекста. </p>
                 <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 4️⃣ Опишите задачу в поле ниже и добавьте код кнопками <span className="font-bold text-indigo-400 mx-1">"Добавить..."</span>. </p>
            </div>
             {/* Settings Toggle Button */}
            <motion.button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors flex-shrink-0" // Prevent shrinking
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title={isSettingsOpen ? "Скрыть настройки" : "Показать настройки URL/Token"}
                aria-expanded={isSettingsOpen}
            >
                {isSettingsOpen ? <FaCircleChevronUp className="text-cyan-400 text-xl" /> : <FaCircleChevronDown className="text-cyan-400 text-xl" />}
            </motion.button>
       </div>

        {/* Settings Modal/Section (Only URL and Token) */}
        <SettingsModal
            isOpen={isSettingsOpen}
            repoUrl={repoUrl}
            setRepoUrl={setRepoUrl}
            token={token}
            setToken={setToken}
            loading={extractLoading} // Still disable inputs while loading
        />

        {/* Fetch Button (Moved Out) */}
        <div className="mb-4 flex justify-center"> {/* Centered fetch button */}
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


      {/* Progress Bar & Status */}
       {(fetchStatus === 'loading' || (fetchStatus === 'success' && files.length === 0) || fetchStatus === 'error') && ( // Show during loading, or if success/error with no files yet
            <div className="mb-6">
                 <ProgressBar status={fetchStatus} progress={progress} />
                 {fetchStatus === 'loading' && <p className="text-white text-xs font-mono mt-1 text-center">Извлечение: {Math.round(progress)}%</p>}
                 {fetchStatus === 'success' && files.length === 0 && <p className="text-green-400 text-xs font-mono mt-1 text-center flex items-center justify-center gap-1"><FaCircleCheck /> Успешно, но файлы не найдены?</p>}
                 {fetchStatus === 'error' && <p className="text-red-400 text-xs font-mono mt-1 text-center flex items-center justify-center gap-1"><FaXmark /> {error || "Произошла ошибка"}</p>}
            </div>
        )}
         {/* Show general error if it occurs *after* files might have been partially listed */}
        {error && fetchStatus !== 'error' && files.length > 0 && <p className="text-red-400 mb-6 text-xs font-mono">{error}</p>}


      {/* Selected Files Preview */}
       {selectedFiles.size > 0 && (
            <SelectedFilesPreview
                selectedFiles={selectedFiles}
                allFiles={files}
                getLanguage={getLanguage}
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
          onAddSelected={() => handleAddSelected()}
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
