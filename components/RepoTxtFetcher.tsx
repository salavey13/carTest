// /components/RepoTxtFetcher.tsx
"use client";


import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy, FaBroom } from "react-icons/fa6"; // FaBroom already imported
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
        case 'py': return 'python';
        case 'css': return 'css';
        case 'html': return 'html';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'sql': return 'sql'; // SQL already supported
        case 'php': return 'php';
        case 'rb': return 'ruby';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'cs': return 'csharp';
        case 'sh': return 'bash';
        case 'yml':
        case 'yaml': return 'yaml';
        default: return 'plaintext'; // Provide a default
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
  const importantFiles = useMemo(() => [ "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx", "hooks/supabase.ts", "app/actions.ts","app/actions/dummy_actions.ts", "app/webhook-handlers/disable-dummy-mode.ts", "package.json", "tailwind.config.ts" ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // === Utility Functions ===
   const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        console.log(`Toast [${type}]: ${message}`);
        let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" };
        if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" };
        else if (type === 'warning') style = { background: "rgba(217, 119, 6, 0.9)", color: "#ffffff", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(3px)" };
        toast(message, { style: style, duration: type === 'error' ? 5000 : 3000 });
   }, []);

   const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string => {
        const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
        if (!cleanPath || cleanPath === 'app' || cleanPath === '/') {
            const rootPath = 'app/page.tsx';
            if (allActualFilePaths.includes(rootPath)) return rootPath;
             if (allActualFilePaths.includes('app/index.tsx')) return 'app/index.tsx';
             console.warn(`getPageFilePath: Root path ${rootPath} not found.`);
             return rootPath;
        }
        const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : `app/${cleanPath}`;
        const inputSegments = pathWithApp.split('/');
        const numInputSegments = inputSegments.length;
        const potentialDirectPath = `${pathWithApp}/page.tsx`;
        const potentialDirectIndexPath = `${pathWithApp}/index.tsx`;
        if (allActualFilePaths.includes(potentialDirectPath)) return potentialDirectPath;
        if (allActualFilePaths.includes(potentialDirectIndexPath)) return potentialDirectIndexPath;
        const pageFiles = allActualFilePaths.filter(p => p.startsWith('app/') && (p.endsWith('/page.tsx') || p.endsWith('/index.tsx')));
        for (const actualPath of pageFiles) {
            const actualPathEnd = actualPath.endsWith('/page.tsx') ? '/page.tsx' : '/index.tsx';
            const actualPathBase = actualPath.substring(0, actualPath.length - actualPathEnd.length);
            const actualSegments = actualPathBase.split('/');
            if (actualSegments.length !== numInputSegments) continue;
            let isDynamicMatch = true;
            for (let i = 0; i < numInputSegments; i++) {
                const inputSeg = inputSegments[i]; const actualSeg = actualSegments[i];
                if (inputSeg === actualSeg) continue;
                else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue;
                else { isDynamicMatch = false; break; }
            }
            if (isDynamicMatch) {
                console.log(`getPageFilePath: Dynamic match found for route "${routePath}" -> file "${actualPath}"`);
                return actualPath;
            }
        }
        console.warn(`getPageFilePath: No direct or dynamic page file match found for route "${routePath}". Falling back to direct guess: "${potentialDirectPath}"`);
        return potentialDirectPath;
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
        const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.sql', '.py', '.json', '.html', '.md']; // Include more common ones

        if (importPath.startsWith('@/')) {
            const possibleBases = ['app/', 'src/'];
            const pathSegment = importPath.substring(2);
            for (const base of possibleBases) {
                const aliasResolvedBase = base + pathSegment;
                const possiblePaths = [ aliasResolvedBase, `${aliasResolvedBase}/index` ]
                    .flatMap(p => ['', ...supportedExtensions].map(ext => p + ext)); // Check base and index with/without extensions
                for (const p of possiblePaths) if (allPaths.includes(p)) return p;
            }
        }
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
                ? [relativeResolvedBase]
                : [ relativeResolvedBase, `${relativeResolvedBase}/index` ]
                    .flatMap(p => ['', ...supportedExtensions].map(ext => p + ext));
            for (const p of possiblePaths) if (allPaths.includes(p)) return p;
        }
        else {
             const searchBases = ['app/lib/', 'app/utils/', 'app/components/', 'app/hooks/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'lib/', 'utils/', 'components/', 'hooks/'];
             for (const base of searchBases) {
                 const bareResolvedBase = base + importPath;
                 const possiblePaths = [ bareResolvedBase, `${bareResolvedBase}/index` ]
                    .flatMap(p => ['', ...supportedExtensions].map(ext => p + ext));
                 for (const p of possiblePaths) if (allPaths.includes(p)) return p;
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

   const startProgressSimulation = useCallback((estimatedDurationSeconds = 15) => {
        stopProgressSimulation(); setProgress(0); setError(null);
        const intervalTime = 150;
        const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime;
        const incrementBase = 100 / totalSteps;
        progressIntervalRef.current = setInterval(() => { setProgress((prev) => {
            const randomFactor = Math.random() * 0.7 + 0.6;
            let nextProgress = prev + (incrementBase * randomFactor);
            if (nextProgress >= 90 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) {
                 nextProgress = Math.min(prev + incrementBase * 0.1, 99);
            } else if (nextProgress >= 100) {
                 nextProgress = 99.9;
            }
            return nextProgress;
          });
        }, intervalTime);
        fetchTimeoutRef.current = setTimeout(() => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current); progressIntervalRef.current = null;
                if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                    console.warn("Forcing progress to 99% due to timeout while still loading.");
                    setProgress(99);
                }
            }
            fetchTimeoutRef.current = null;
        }, estimatedDurationSeconds * 1000 + 5000);
   }, [stopProgressSimulation, fetchStatus]);

  // --- Core Logic Callbacks ---
    const handleAddSelected = useCallback((filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles;
        if (filesToAdd.size === 0) {
            addToast("Сначала выберите файлы для добавления", 'error'); return;
        }
        const prefix = "Контекст кода для анализа (отвечай полным кодом):\n";
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path))
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((file) => `\`\`\`${getLanguage(file.path)}\n// /${file.path}\n${file.content}\n\`\`\``)
          .join("\n\n");

        setKworkInput((prev) => {
            const newContent = `${prefix}${markdownTxt}`;
            const contextRegex = /^Контекст кода для анализа.*?:\n/im;
             if (contextRegex.test(prev.trim())) {
                 return `${prev.trim()}\n\n---\n[Дополнительный Контекст]\n${markdownTxt}`;
            }
            return prev.trim() ? `${newContent}\n\n${prev.trim()}` : newContent;
        });

        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('extractor');
    }, [files, selectedFiles, scrollToSection, addToast, setKworkInput]); // Added setKworkInput dependency

    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? kworkInput;
        if (!content.trim()) {
            addToast("Нет текста для копирования", 'error'); return false;
        }
        try {
            navigator.clipboard.writeText(content);
            addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            setRequestCopied(true);
            if (shouldScroll) {
                 scrollToSection('executor');
            }
            return true;
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            addToast("Ошибка копирования", 'error');
            return false;
        }
    }, [kworkInput, scrollToSection, addToast, setRequestCopied]);

    // *** IMPLEMENTED: handleClearAll ***
    const handleClearAll = useCallback(() => {
        console.log("[handleClearAll] Clearing state.");
        setSelectedFilesState(new Set());
        setSelectedFetcherFiles(new Set()); // Update context
        setKworkInput("");
        setPrimaryHighlightedPath(null);
        setSecondaryHighlightedPaths([]);
        // Optionally reset downstream states if desired
        // setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
        addToast("Поле ввода и выбор файлов очищены ✨", 'success');
        if (kworkInputRef.current) { kworkInputRef.current.focus(); }
    }, [setSelectedFetcherFiles, setKworkInput, addToast, kworkInputRef]); // Added dependencies

  // --- Fetch Logic with Retries ---
   const handleFetch = useCallback(async (isManualRetry = false) => {
    console.log(`[handleFetch] Called. isManualRetry: ${isManualRetry}, Current Status: ${fetchStatus}`);
    if (!repoUrl.trim()) {
        addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); setIsSettingsOpen(true); return;
    }
    if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) {
        addToast("Извлечение уже идет...", "info"); return;
    }
    if (isManualRetry && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
        console.warn(`Manual retry requested but status is ${fetchStatus}. Allowing anyway.`);
    }

    setExtractLoading(true); setError(null); setFiles([]);
    setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set());
    //setKworkInput(""); // Clear input on new fetch
    setFilesFetched(false, null, []); setRequestCopied(false);
    setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
    setPrimaryHighlightedPath(null); setSecondaryHighlightedPaths([]);

    addToast("Запрос репозитория...", 'info');
    startProgressSimulation(20);

    const maxRetries = 2; const retryDelayMs = 2000;
    let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;

    while (currentTry <= maxRetries) {
        currentTry++;
        const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
        setFetchStatus(currentStatus);
        console.log(`[handleFetch] Attempt ${currentTry}/${maxRetries + 1}, Status: ${currentStatus}`);

        if (currentStatus === 'retrying') {
            addToast(`Попытка ${currentTry} из ${maxRetries+1}...`, 'info');
            await delay(retryDelayMs);
            startProgressSimulation(15 + (currentTry * 5));
        }

        try {
          result = await fetchRepoContents(repoUrl, token || undefined);
          console.log(`[handleFetch] Attempt ${currentTry} raw result:`, result);

          if (result?.success && Array.isArray(result.files)) {
            console.log(`[handleFetch] Success on attempt ${currentTry}. Files: ${result.files.length}`);
            stopProgressSimulation(); setProgress(100); setFetchStatus('success');
            addToast(`Извлечено ${result.files.length} файлов!`, 'success');
            setFiles(result.files); setIsSettingsOpen(false); setExtractLoading(false);

            const fetchedFiles = result.files; const allActualFilePaths = fetchedFiles.map(f => f.path);
            let primaryPath: string | null = null; let secondaryPaths: string[] = [];
            let filesToSelect = new Set<string>();

            if (highlightedPathFromUrl) {
                primaryPath = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
                if (pageFile) {
                    console.log(`Primary file found: ${primaryPath}`);
                    filesToSelect.add(primaryPath);
                    const imports = extractImports(pageFile.content);
                    secondaryPaths = imports.map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles)).filter((path): path is string => !!path && path !== primaryPath);
                    secondaryPaths.forEach(path => filesToSelect.add(path));
                } else {
                    addToast(`Файл страницы для URL (${highlightedPathFromUrl} -> ${primaryPath}) не найден`, 'warning'); primaryPath = null;
                }
            }
            importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) filesToSelect.add(path); });

            setPrimaryHighlightedPath(primaryPath); setSecondaryHighlightedPaths(secondaryPaths);
            setFilesFetched(true, primaryPath, secondaryPaths);

            if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
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
                setKworkInput(combinedContent);
                await delay(350);
                const copied = handleCopyToClipboard(combinedContent, false);
                if (copied) {
                    addToast("КОНТЕКСТ В БУФЕРЕ! Открываю AI...", 'success');
                    scrollToSection('executor');
                    setTimeout(() => openLink('https://aistudio.google.com'), 800);
                } else {
                   addToast("Ошибка авто-копирования в буфер. Переход отменен.", 'error');
                   scrollToSection('extractor');
                }
            } else {
                if (filesToSelect.size > 0) {
                    setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect);
                    addToast(`Авто-выбрано ${filesToSelect.size} важных/связанных файлов`, 'info');
                }
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
            return; // Success Exit

          } else {
              const errorMessage = result?.error || "Не удалось получить файлы (ответ API пуст или некорректен)";
              console.error(`[handleFetch] Attempt ${currentTry} failed: ${errorMessage}`);
              throw new Error(errorMessage);
          }
        } catch (err: any) {
          console.error(`[handleFetch] Error during attempt ${currentTry}:`, err);
          const displayError = err?.message || "Неизвестная ошибка при извлечении";
          setError(`Попытка ${currentTry}: ${displayError}`);

          if (currentTry > maxRetries) {
            console.error(`[handleFetch] Final attempt failed. Max retries (${maxRetries}) reached.`);
            stopProgressSimulation(); setFetchStatus('failed_retries'); setProgress(0);
            addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error');
            setFilesFetched(false, null, []); setExtractLoading(false);
            return; // Final Failure Exit
          }
        }
    } // End while loop

    console.warn("[handleFetch] Reached end of function unexpectedly after loop.");
    stopProgressSimulation();
    if (fetchStatus !== 'success') { setFetchStatus(error ? 'failed_retries' : 'error'); setProgress(0); setFilesFetched(false, null, []); }
    setExtractLoading(false);

   }, [ // Dependencies
        repoUrl, token, fetchStatus, highlightedPathFromUrl, ideaFromUrl, importantFiles,
        addToast, startProgressSimulation, stopProgressSimulation, getLanguage,
        getPageFilePath, extractImports, resolveImportPath, openLink, handleCopyToClipboard,
        setFetchStatus, setRepoUrlEntered, setFilesFetched, setSelectedFetcherFiles,
        setKworkInput, setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        scrollToSection, DEFAULT_TASK_IDEA,
   ]);


  // --- Other Callbacks ---
   const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0;
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) {
             filesToSelect.add(primaryHighlightedPath); newlySelectedCount++;
        }
        secondaryHighlightedPaths.forEach(path => {
            if (files.some(f => f.path === path) && !filesToSelect.has(path)) {
                filesToSelect.add(path); newlySelectedCount++;
            }
        });
        if (newlySelectedCount > 0) {
            setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect);
            addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info');
        } else { addToast("Нет дополнительных связанных файлов для выбора", 'info'); }
   }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);

   const toggleFileSelection = useCallback((path: string) => {
    setSelectedFilesState(prevSet => {
        const newSet = new Set(prevSet);
        if (newSet.has(path)) newSet.delete(path); else newSet.add(path);
        setSelectedFetcherFiles(newSet);
        return newSet;
    });
  }, [setSelectedFetcherFiles]);

  const handleAddImportantFiles = useCallback(() => {
    let addedCount = 0; const filesToAdd = new Set(selectedFiles);
    importantFiles.forEach(path => {
        if (files.some(f => f.path === path) && !selectedFiles.has(path)) {
             filesToAdd.add(path); addedCount++;
        }
    });
    if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены", 'info'); return; }
    setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd);
    addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
   }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);

   const handleAddFullTree = useCallback(() => {
    if (files.length === 0) {
        addToast("Нет файлов для отображения дерева", 'error'); return;
    }
    const treeOnly = files.map((file) => `- ${file.path}`).sort().join("\n");
    const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``;
    let added = false;
    setKworkInput((prev) => {
        const trimmedPrev = prev.trim();
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
    if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
        handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus]); // handleFetch is stable
  useEffect(() => { return () => { stopProgressSimulation(); }; }, [stopProgressSimulation]);


  // === Imperative Handle ===
   useImperativeHandle(ref, () => ({
        handleFetch,
        selectHighlightedFiles,
        handleAddSelected,
        handleCopyToClipboard,
        clearAll: handleClearAll, // Expose clearAll
    }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll]); // Include handleClearAll


  // --- Render ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const isFetchDisabled = isLoading || !repoUrl.trim();
  const showProgressBar = isLoading || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
  // *** Calculate disable states for RequestInput ***
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
              onClick={() => handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
              disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
              // *** UPDATED: rounded-full ***
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${
                 fetchStatus === 'failed_retries' || fetchStatus === 'error'
                   ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-red-500/30 hover:shadow-red-500/40'
                   : 'from-purple-600 to-cyan-500 shadow-purple-500/30 hover:shadow-cyan-500/40'
              } transition-all ${isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? "opacity-60 cursor-not-allowed brightness-75" : "hover:brightness-110 active:scale-[0.98]"}`}
              whileHover={{ scale: isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? 1 : 1.03 }}
              whileTap={{ scale: isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? 1 : 0.97 }}
          >
              {isLoading ? <FaArrowsRotate className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)}
              {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")}
          </motion.button>
      </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar
                     status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus}
                     progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)}
                />
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
         {/* Left Column: File List & Controls */}
         {(files.length > 0 || isLoading) && fetchStatus !== 'error' && fetchStatus !== 'failed_retries' && (
             <div className="flex flex-col gap-4">
                {/* Selected Files Preview - Rendered conditionally within its component */}
                <SelectedFilesPreview
                    selectedFiles={selectedFiles}
                    allFiles={files}
                    getLanguage={getLanguage}
                />
                {/* File List */}
                <FileList
                  id="file-list-container" // Pass ID here
                  files={files}
                  selectedFiles={selectedFiles}
                  primaryHighlightedPath={primaryHighlightedPath}
                  secondaryHighlightedPaths={secondaryHighlightedPaths}
                  importantFiles={importantFiles}
                  isLoading={isLoading} // Pass loading state
                  toggleFileSelection={toggleFileSelection}
                  onAddSelected={() => handleAddSelected()} // Pass handlers directly
                  onAddImportant={() => handleAddImportantFiles()}
                  onAddTree={() => handleAddFullTree()}
                  onSelectHighlighted={() => selectHighlightedFiles()} // Pass handler
                />
             </div>
         )}
         {/* Right Column: Request Input */}
         {(fetchStatus !== 'idle' && fetchStatus !== 'failed_retries' && fetchStatus !== 'error') || kworkInput.trim().length > 0 || (files.length > 0 && fetchStatus === 'success') ? (
             <div id="kwork-input-section">
                 <RequestInput
                    kworkInput={kworkInput}
                    setKworkInput={setKworkInput}
                    kworkInputRef={kworkInputRef}
                    onCopyToClipboard={() => handleCopyToClipboard()} // Pass handler
                    onClearAll={() => handleClearAll()} // Pass handler
                    isCopyDisabled={isCopyDisabled} // Pass calculated state
                    isClearDisabled={isClearDisabled} // Pass calculated state
                 />
             </div>
         ) : null }
      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;
