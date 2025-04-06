"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy, FaBroom } from "react-icons/fa6"; // Added FaCopy, FaBroom
import { motion } from "framer-motion";

import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";

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

// Define the interface for the exposed ref methods
export interface RepoTxtFetcherRef {
    handleFetch: () => Promise<void>;
    selectHighlightedFiles: () => void;
    handleAddSelected: () => void;
    handleCopyToClipboard: () => boolean; // Return boolean indicating success
    clearAll: () => void;
}

interface RepoTxtFetcherProps {
    // kworkInputRef is now managed by the context, so no need to pass it as prop
    // kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

// Helper outside component: Determine language for syntax highlighting
const getLanguage = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase(); // Handle case insensitivity
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
        case 'yaml': return 'yaml';
        case 'yml': return 'yaml';
        case 'sh': return 'bash';
        case 'java': return 'java';
        case 'go': return 'go';
        case 'php': return 'php';
        case 'rb': return 'ruby';
        // Add more languages as needed
        default: return 'text'; // Fallback to plain text
    }
};

const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, RepoTxtFetcherProps>(({ /* no props needed now */ }, ref) => {
  // === State ===
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest"); // Default example
  const [token, setToken] = useState<string>(""); // Store GitHub token if needed
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
  const { user } = useAppContext(); // Assuming you need user info for something later
  const {
    // State readers (already managed internally or derived)
    // repoUrlEntered, filesFetched, selectedFetcherFiles, kworkInputHasContent, requestCopied,
    // Updater functions from context
    setRepoUrlEntered,
    setFilesFetched,
    setSelectedFetcherFiles,
    setKworkInputHasContent,
    setRequestCopied,
    scrollToSection,
    kworkInputRef, // Get the ref from context
    fetcherRef,    // Get the ref from context
  } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
  const searchParams = useSearchParams();
  const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
  const ideaFromUrl = useMemo(() => {
      const ideaParam = searchParams.get("idea");
      return ideaParam ? decodeURIComponent(ideaParam) : "";
  }, [searchParams]);
  const autoFetch = useMemo(() => !!highlightedPathFromUrl, [highlightedPathFromUrl]); // Auto fetch if path is in URL

  const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";

  // --- Files specified as important ---
   const importantFiles = useMemo(() => [
    "package.json",
    "README.md",
    // Add other typical important files if needed
    // Example structure for Next.js app router:
    "app/layout.tsx",
    "app/page.tsx",
    "middleware.ts", // if exists
    // "app/actions.ts", // Example from original code
    // "hooks/useTelegram.ts", // Example
    // "contexts/AppContext.tsx", // Example
    // "types/supabase.ts", // Example
  ], []);


  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // === Utility Functions ===
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" }; // Default info
    if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" }; // Green-ish
    else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" }; // Red-ish

    toast(message, {
        style: style,
        duration: type === 'error' ? 5000 : 3000, // Longer duration for errors
     });
  }, []);


  const getPageFilePath = useCallback((routePath: string): string => {
    // Basic mapping for Next.js App Router conventions
    const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
    if (!cleanPath || cleanPath === '/') return 'app/page.tsx'; // Root page

    // Handle dynamic routes like [slug] or [...catchAll] -> /page.tsx
    const segments = cleanPath.split('/');
    const pagePathSegments = segments.map(segment => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
            // Maybe handle specific dynamic segments differently if needed
        }
        return segment;
    });

    // Common pattern is `app/your-route/page.tsx`
    return `app/${pagePathSegments.join('/')}/page.tsx`;
  }, []);


  const extractImports = useCallback((content: string): string[] => {
    const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g;
    const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; // Basic require support

    const imports = new Set<string>();
    let match;

    while ((match = importRegex.exec(content)) !== null) {
        if (match[1] && match[1] !== '.') {
            imports.add(match[1]);
        }
    }
    while ((match = requireRegex.exec(content)) !== null) {
         if (match[1] && match[1] !== '.') {
            imports.add(match[1]);
        }
    }

    return Array.from(imports);
  }, []);


  const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
        const allPaths = allFiles.map(f => f.path); // Cache paths for faster lookup

        // --- 1. Handle Aliases (e.g., @/components/button -> app/components/button) ---
        if (importPath.startsWith('@/')) {
            const aliasResolvedBase = 'app/' + importPath.substring(2); // Assuming @/ maps to app/
            const possiblePaths = [
                aliasResolvedBase,
                `${aliasResolvedBase}.ts`,
                `${aliasResolvedBase}.tsx`,
                `${aliasResolvedBase}.js`,
                `${aliasResolvedBase}.jsx`,
                `${aliasResolvedBase}/index.ts`,
                `${aliasResolvedBase}/index.tsx`,
                `${aliasResolvedBase}/index.js`,
                `${aliasResolvedBase}/index.jsx`,
            ];
            for (const p of possiblePaths) {
                if (allPaths.includes(p)) return p;
            }
        }
        // --- 2. Handle Relative Paths (e.g., ./utils, ../hooks/useThing) ---
        else if (importPath.startsWith('.')) {
            const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
            // Basic path normalization (doesn't handle edge cases perfectly but covers common scenarios)
            const pathParts = (currentDir + '/' + importPath).split('/');
            const resolvedParts: string[] = [];
            for (const part of pathParts) {
                if (part === '.' || part === '') continue;
                if (part === '..') {
                    resolvedParts.pop(); // Go up one level
                } else {
                    resolvedParts.push(part);
                }
            }
            const relativeResolvedBase = resolvedParts.join('/');

            // Check if import already has extension or is directory import
            const hasExplicitExtension = /\.\w+$/.test(importPath);
             const possiblePaths = hasExplicitExtension
                ? [relativeResolvedBase] // Only check the explicit path
                : [
                    relativeResolvedBase, // Check if it matches a file directly (e.g. import './styles.css')
                    `${relativeResolvedBase}.ts`,
                    `${relativeResolvedBase}.tsx`,
                    `${relativeResolvedBase}.js`,
                    `${relativeResolvedBase}.jsx`,
                    `${relativeResolvedBase}/index.ts`,
                    `${relativeResolvedBase}/index.tsx`,
                    `${relativeResolvedBase}/index.js`,
                    `${relativeResolvedBase}/index.jsx`,
                  ];

            for (const p of possiblePaths) {
                if (allPaths.includes(p)) return p;
            }
        }
        // --- 3. Handle Bare Imports (node_modules or other conventions - very basic) ---
        // This part is tricky without full module resolution logic.
        // We can make educated guesses for common project structures.
        else {
             // Example: Maybe check under `lib/`, `utils/`, `components/` relative to `app/` or root
            const searchBases = ['app/lib/', 'app/utils/', 'app/components/', 'app/hooks/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/'];
             for (const base of searchBases) {
                 const bareResolvedBase = base + importPath;
                 const possiblePaths = [
                    bareResolvedBase,
                    `${bareResolvedBase}.ts`,
                    `${bareResolvedBase}.tsx`,
                    `${bareResolvedBase}.js`,
                    `${bareResolvedBase}.jsx`,
                    `${bareResolvedBase}/index.ts`,
                    `${bareResolvedBase}/index.tsx`,
                    `${bareResolvedBase}/index.js`,
                    `${bareResolvedBase}/index.jsx`,
                 ];
                  for (const p of possiblePaths) {
                    if (allPaths.includes(p)) return p;
                  }
             }
            // Could also add a check for top-level folders like `lib/`, `utils/` if not in `app/` or `src/`
             const topLevelBases = ['lib/', 'utils/', 'components/', 'hooks/'];
             for (const base of topLevelBases) {
                  const bareResolvedBase = base + importPath;
                  // ... (repeat possiblePaths check as above)
             }
        }

        // console.warn(`Could not resolve import "${importPath}" from "${currentFilePath}"`);
        return null; // Could not resolve
  }, []); // No dependencies needed for this logic


  // --- Progress Simulation ---
  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    progressIntervalRef.current = null;
    fetchTimeoutRef.current = null;
  }, []);


  const startProgressSimulation = useCallback((estimatedDurationSeconds = 5) => { // Shorter default
    stopProgressSimulation();
    setProgress(0);
    setFetchStatus('loading');
    setError(null); // Clear previous errors on new fetch
    const intervalTime = 100; // ms
    const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime;
    const incrementBase = 100 / totalSteps;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const randomFactor = Math.random() * 0.6 + 0.7; // 0.7 to 1.3
        let nextProgress = prev + (incrementBase * randomFactor);

        // Slow down near the end if timeout hasn't finished
        if (nextProgress >= 95 && fetchTimeoutRef.current) {
             nextProgress = Math.min(prev + incrementBase * 0.1, 98); // Creep slowly to 98
        }

        if (nextProgress >= 100) {
             stopProgressSimulation();
             return 100;
        }
        return nextProgress;
      });
    }, intervalTime);

     // Ensure completion within the estimated time (+ small buffer)
     fetchTimeoutRef.current = setTimeout(() => {
        if (progressIntervalRef.current) { // Only if interval is still running
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
            setProgress(100); // Force to 100%
            setFetchStatus('success'); // Assume success if timeout completes (actual result handled later)
        }
        fetchTimeoutRef.current = null;
     }, estimatedDurationSeconds * 1000 + 200); // Add small buffer

  }, [stopProgressSimulation]);


  // --- Core Logic Callbacks (Define before use!) ---

   const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles;
        if (filesToAdd.size === 0) {
          addToast("Сначала выберите файлы для добавления", 'error');
          return;
        }
        // More descriptive prefix
        const prefix = "Контекст кода для анализа (отвечай полным кодом, не пропуская части):\n";
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path))
          .sort((a, b) => a.path.localeCompare(b.path)) // Sort alphabetically for consistency
          .map((file) => `\`\`\`${getLanguage(file.path)}:${file.path}\n${file.content}\n\`\`\``) // Combine lang and path
          .join("\n\n");

        setKworkInput((prev) => {
            const newContent = `${prefix}${markdownTxt}`;
            // If prev exists and already contains a context block, append smartly
            if (prev.trim().includes("Контекст кода для анализа")) {
                 // Replace existing context or append? For now, let's append separated.
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
    }, [files, selectedFiles, scrollToSection, addToast, setKworkInput]); // Include setKworkInput if used directly

   const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInput; // Use provided text or fallback to state
        if (!content.trim()) {
            addToast("Нет текста для копирования", 'error');
            return false;
        }
        try {
            navigator.clipboard.writeText(content);
            // Only show the specific "Paste into AI" toast for the main copy action CORRECTIO: DON'T AGREE
            //if (!textToCopy) {
                 addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            //}
            setRequestCopied(true); // Update context state
            if (shouldScroll) {
                 scrollToSection('aiResponseInput');
            }
            return true;
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            addToast("Ошибка копирования", 'error');
            return false;
        }
    }, [kworkInput, setRequestCopied, scrollToSection, addToast]); // Dependencies


  const handleClearAll = useCallback(() => {
        setSelectedFilesState(new Set());
        setSelectedFetcherFiles(new Set()); // Update context
        setKworkInput("");
        // Also clear primary/secondary highlights if needed
        // setPrimaryHighlightedPath(null);
        // setSecondaryHighlightedPaths([]);
        addToast("Очищено ✨", 'success');
        // Optionally scroll or focus
        //  scrollToSection('fetcher'); // Scroll back to top of this component
        if (kworkInputRef.current) {
            kworkInputRef.current.focus(); // Focus the input field
        }
    }, [setSelectedFetcherFiles, addToast, kworkInputRef, setKworkInput]); // Include setKworkInput

  // --- Fetch Logic ---
  const handleFetch = useCallback(async () => {
    if (!repoUrl.trim()) {
        addToast("Введите URL репозитория", 'error');
        setError("URL репозитория не может быть пустым.");
        setIsSettingsOpen(true);
        return;
    }
    setExtractLoading(true);
    setError(null);
    setFiles([]);
    const newSelectedFiles = new Set<string>(); // Use local var during fetch
    setSelectedFilesState(newSelectedFiles);
    setSelectedFetcherFiles(newSelectedFiles); // Reset context selection
    setKworkInput(""); // Reset input on new fetch
    setFilesFetched(false); // Reset context flag
    setFetchStatus('loading'); // Set status immediately
    setPrimaryHighlightedPath(null); // Reset highlights
    setSecondaryHighlightedPaths([]);
    addToast("Запрос репозитория...", 'info');
    startProgressSimulation();

    let filesToSelect = new Set<string>(); // Files to auto-select

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);

      stopProgressSimulation(); // Stop simulation as soon as data arrives or fails

      if (!result || !result.success || !Array.isArray(result.files)) {
        throw new Error(result?.error || "Не удалось получить файлы или неверный формат ответа");
      }

      const fetchedFiles = result.files;
      setFiles(fetchedFiles); // Set state *after* success check

      // --- Path Highlighting & Auto-Selection ---
      let primaryPath: string | null = null;
      let secondaryPaths: string[] = [];

      if (highlightedPathFromUrl) {
          primaryPath = getPageFilePath(highlightedPathFromUrl);
          setPrimaryHighlightedPath(primaryPath); // Set state for UI

          const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
          if (pageFile) {
              console.log(`Auto-selecting primary: ${primaryPath}`);
              filesToSelect.add(primaryPath);

              const imports = extractImports(pageFile.content);
              secondaryPaths = imports
                  .map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles))
                  .filter((path): path is string => !!path && path !== primaryPath); // Ensure path exists and isn't the primary file itself

              setSecondaryHighlightedPaths(secondaryPaths); // Set state for UI
              console.log(`Auto-selecting secondary (${secondaryPaths.length}):`, secondaryPaths);
              secondaryPaths.forEach(path => filesToSelect.add(path));
          } else {
              addToast(`Файл страницы для URL (${primaryPath}) не найден`, 'error');
              primaryPath = null; // Reset if not found
              setPrimaryHighlightedPath(null); // Reset state
          }
      }

      // Auto-select 'important' files (if they exist and aren't already selected)
      importantFiles.forEach(path => {
          if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) {
              console.log(`Auto-selecting important: ${path}`);
              filesToSelect.add(path);
          }
      });

      // --- Update State & Context Post-Fetch ---
      setFetchStatus('success');
      setProgress(100);
      setFilesFetched(true, primaryPath, secondaryPaths); // Update context
      setIsSettingsOpen(false); // Close settings on success
      if (fetchedFiles.length > 0) {
         addToast(`Извлечено ${fetchedFiles.length} файлов!`, 'success');
      } else {
          addToast("Репозиторий извлечен, но файлы не найдены.", 'info');
      }


      // --- AUTOMATION SEQUENCE ---
      if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
          console.log("Automation: Selecting files and generating request...");
          setSelectedFilesState(filesToSelect); // Update component state
          setSelectedFetcherFiles(filesToSelect); // Update context state
          addToast(`Авто-выбрано ${filesToSelect.size} файлов`, 'info');

          // Prepare content for kworkInput & clipboard
          const task = ideaFromUrl || DEFAULT_TASK_IDEA;
          const prefix = "Контекст кода для анализа (отвечай полным кодом, не пропуская части):\n";
          const markdownTxt = fetchedFiles
              .filter((file) => filesToSelect.has(file.path))
              .sort((a, b) => a.path.localeCompare(b.path))
              .map((file) => `\`\`\`${getLanguage(file.path)}:${file.path}\n${file.content}\n\`\`\``)
              .join("\n\n");
          const combinedContent = `${task}\n\n${prefix}${markdownTxt}`;

          setKworkInput(combinedContent); // Update the text area state

          // Wait a tick for state update, then copy and redirect
          setTimeout(() => {
              const copied = handleCopyToClipboard(combinedContent, false); // Copy silently without scroll

              if (copied) {
                  addToast("КОНТЕКСТ В БУФЕРЕ! Перенаправление...", 'success');
                   // Scroll after copy, before redirect timeout
                  scrollToSection('aiResponseInput');
                  setTimeout(() => {
                       // Consider opening in new tab? window.open('https://aistudio.google.com', '_blank');
                       window.location.href = 'https://aistudio.google.com'; // Or your target AI tool
                  }, 1200); // Slightly longer delay for toast visibility
              } else {
                   addToast("Ошибка авто-копирования. Переход отменен.", 'error');
                   scrollToSection('kworkInput'); // Scroll to input if copy failed
              }
          }, 100); // Short delay to ensure state update before copy

      } else {
           // If not automating, but files were determined for selection (important/related)
           if (filesToSelect.size > 0) {
                setSelectedFilesState(filesToSelect);
                setSelectedFetcherFiles(filesToSelect);
                addToast(`Авто-выбрано ${filesToSelect.size} важных/связанных файлов`, 'info');
                // Don't automatically add to kworkInput unless automating
           }
          // Scroll to primary file if it exists (even without automation)
          if (primaryPath) {
             setTimeout(() => { // Delay scroll slightly for elements to render
                const elementId = `file-${primaryPath}`; // Ensure FileList uses this ID format
                const fileElement = document.getElementById(elementId);
                if (fileElement) {
                     fileElement.scrollIntoView({ behavior: "smooth", block: "center" });
                     // Optional: Add a visual cue like a temporary highlight
                     fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000');
                     setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'), 1500);
                } else {
                    console.warn(`Element with ID ${elementId} not found for scrolling.`);
                }
             }, 400);
          } else if (fetchedFiles.length > 0) {
              // Scroll to the top of the file list if no primary highlight
              // Ensure FileList container has an ID, e.g., 'file-list-container'
              // scrollToSection('fileListContainerId'); // Or scroll to 'extractor' top
              const fileListElement = document.getElementById('file-list-container'); // Assuming FileList has this ID
              fileListElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
      }

    } catch (err: any) {
      stopProgressSimulation(); // Ensure progress stops
      const errorMessage = `Ошибка извлечения: ${err?.message || "Неизвестная ошибка"}`;
      setError(errorMessage);
      addToast(errorMessage, 'error');
      console.error("Fetch error details:", err);
      setFilesFetched(false); // Update context
      setFiles([]); // Clear files on error
      setProgress(0);
      setFetchStatus('error');
    } finally {
      setExtractLoading(false);
      // Optional final cleanup, though stopProgressSimulation should handle it
      // setTimeout(stopProgressSimulation, 500);
    }
  }, [
      // Dependencies: state, props, context values, stable callbacks
      repoUrl, token, highlightedPathFromUrl, ideaFromUrl, importantFiles,
      addToast, startProgressSimulation, stopProgressSimulation,
      getPageFilePath, extractImports, resolveImportPath,
      setFilesFetched, setSelectedFetcherFiles, setKworkInput, // Context setters
      handleCopyToClipboard, // Callbacks defined above
      scrollToSection, // Context actions
      // Removed files, selectedFiles - managed internally or via functional updates/local vars
  ]);


  // --- Other Callbacks ---

  const selectHighlightedFiles = useCallback(() => {
    const filesToSelect = new Set<string>(selectedFiles); // Start with current selection
    let newlySelectedCount = 0;

    if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) {
        filesToSelect.add(primaryHighlightedPath);
        newlySelectedCount++;
    }
    secondaryHighlightedPaths.forEach(path => {
        if (files.some(f => f.path === path) && !filesToSelect.has(path)) {
            filesToSelect.add(path);
            newlySelectedCount++;
        }
    });
    // Option: Also add important files here? Or keep that separate? Let's keep it separate for clarity.
    // importantFiles.forEach(path => { ... });

    if (newlySelectedCount > 0) {
        setSelectedFilesState(filesToSelect);
        setSelectedFetcherFiles(filesToSelect); // Update context
        addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info');
        // Don't automatically add to kworkInput, let user click "Add Selected"
        // handleAddSelected(filesToSelect);
    } else {
         addToast("Нет дополнительных связанных файлов для выбора", 'info');
    }
  }, [
      primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, // State/Props read
      setSelectedFetcherFiles, addToast // Context/Callbacks
      // Removed importantFiles, handleAddSelected - not used directly here now
  ]);


  const toggleFileSelection = useCallback((path: string) => {
    setSelectedFilesState(prevSet => {
        const newSet = new Set(prevSet);
        if (newSet.has(path)) {
            newSet.delete(path);
        } else {
            newSet.add(path);
        }
        setSelectedFetcherFiles(newSet); // Update context immediately
        return newSet;
    });
  }, [setSelectedFetcherFiles]); // Only depends on the stable setter from context


  const handleAddImportantFiles = useCallback(() => {
    let addedCount = 0;
    const filesToAdd = new Set(selectedFiles); // Clone current selection

    importantFiles.forEach(path => {
      if (files.some(f => f.path === path) && !selectedFiles.has(path)) { // Check against original selection
        filesToAdd.add(path);
        addedCount++;
      }
    });

    if (addedCount === 0) {
         addToast("Важные файлы уже выбраны или не найдены", 'info');
         return;
    }

    setSelectedFilesState(filesToAdd); // Update state
    setSelectedFetcherFiles(filesToAdd); // Update context
    addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
    // Don't auto-add to kworkInput, let user click "Add Selected"
    // handleAddSelected(filesToAdd);

  }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]); // Removed handleAddSelected


  const handleAddFullTree = useCallback(() => {
    if (files.length === 0) {
        addToast("Нет файлов для отображения дерева", 'error');
        return;
    }
    // Simple list format
    const treeOnly = files
        .map((file) => `- ${file.path}`)
        .sort() // Sort paths for readability
        .join("\n");
    const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;

    setKworkInput((prev) => {
        const trimmedPrev = prev.trim();
        // Avoid adding duplicate trees
        if (trimmedPrev.includes("Структура файлов проекта:")) {
            addToast("Дерево файлов уже добавлено", 'info');
            return prev;
        }
        return trimmedPrev ? `${trimmedPrev}\n\n${treeContent}` : treeContent;
    });

    if (!kworkInput.trim().includes("Структура файлов проекта:")) { // Only toast if actually added
         addToast("Дерево файлов добавлено в запрос", 'success');
    }
    scrollToSection('kworkInput');
  }, [files, kworkInput, setKworkInput, scrollToSection, addToast]);


  // --- Effects ---
  useEffect(() => {
    // Update context based on repoUrl state
    setRepoUrlEntered(repoUrl.trim().length > 0);
  }, [repoUrl, setRepoUrlEntered]);

  useEffect(() => {
    // Update context based on kworkInput state
    setKworkInputHasContent(kworkInput.trim().length > 0);
    // If user edits input after copying, maybe reset copied flag?
    // if (requestCopied && kworkInput !== copiedContentRef.current) { // Need to store copied content if doing this
    //    setRequestCopied(false);
    // }
  }, [kworkInput, setKworkInputHasContent]); // Removed requestCopied/setRequestCopied for simplicity

  // Auto-fetch effect
  useEffect(() => {
    // Fetch only if autoFetch is true, URL is present, and not already loading/fetched
    if (autoFetch && repoUrl && fetchStatus === 'idle') {
      console.log("Triggering auto-fetch for path:", highlightedPathFromUrl);
      handleFetch();
    }
    // Intentionally not depending on handleFetch to avoid re-triggering on its changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus]);

   // Cleanup progress simulation on unmount
  useEffect(() => {
    return () => {
        stopProgressSimulation();
    };
  }, [stopProgressSimulation]);

  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({
    handleFetch,
    selectHighlightedFiles,
    handleAddSelected: () => handleAddSelected(), // Expose manual trigger
    handleCopyToClipboard: () => handleCopyToClipboard(), // Expose manual trigger
    clearAll: handleClearAll,
  }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll]); // Include all exposed methods

  // --- Assign Ref from Context ---
  // This component instance's methods are exposed via the 'ref' passed to forwardRef.
  // The parent component (where RepoXmlPageProvider is used) passes fetcherRef={...}
  // We need to assign our imperative handle ref to the ref provided by the context/parent.
  useEffect(() => {
      if (fetcherRef) {
          fetcherRef.current = {
             handleFetch,
             selectHighlightedFiles,
             handleAddSelected: () => handleAddSelected(),
             handleCopyToClipboard: () => handleCopyToClipboard(),
             clearAll: handleClearAll,
          };
      }
      // Cleanup function to nullify the ref when the component unmounts
      return () => {
           if (fetcherRef) {
              fetcherRef.current = null;
           }
      };
       // Re-run if the functions themselves change (though they are memoized)
  }, [fetcherRef, handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll]);


  // --- Render ---
  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-900 text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700 relative overflow-hidden">

      {/* Header & Settings Toggle */}
       <div className="flex justify-between items-start mb-4 gap-4">
            <div className="flex-grow">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2">
                   <FaDownload className="inline-block mr-2 text-purple-400" /> Кибер-Экстрактор Кода
                </h2>
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
            onClose={() => setIsSettingsOpen(false)} // Add close handler
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
       {(fetchStatus !== 'idle' || error) && ( // Show if not idle or if there's a persistent error
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
                  onAddSelected={() => handleAddSelected()}
                  onAddImportant={handleAddImportantFiles}
                  onAddTree={handleAddFullTree}
                  onSelectHighlighted={selectHighlightedFiles} // Pass highlight selection handler
                />
            )}
         </div>

         {/* Right Column: Request Input */}
         {/* Show input area once fetch is attempted or files are loaded */}
         {(fetchStatus !== 'idle' || files.length > 0) && (
             <RequestInput
                kworkInput={kworkInput}
                setKworkInput={setKworkInput}
                kworkInputRef={kworkInputRef} // Pass ref from context
                onCopyToClipboard={() => handleCopyToClipboard()}
                onClearAll={handleClearAll}
                isCopyDisabled={!kworkInput.trim()} // Disable copy if empty
                isClearDisabled={!kworkInput.trim() && selectedFiles.size === 0} // Disable clear if nothing to clear
             />
         )}

      </div> {/* End Grid */}

    </div> // End Component Root
  );
});

RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;
