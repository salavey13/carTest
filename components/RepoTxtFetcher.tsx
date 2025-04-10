// /components/RepoTxtFetcher.tsx
"use client";

    import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
    import { useSearchParams } from "next/navigation";
    import { toast } from "sonner";
    import {
        FaCircleChevronDown, FaCircleChevronUp, FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
        FaBroom, FaRobot, FaList, FaCodeBranch, FaCheck // Added FaList, FaCheck
    } from "react-icons/fa6";
    import { motion, AnimatePresence } from "framer-motion";

    // Removed unused actions
    import { fetchRepoContents } from "@/app/actions_github/actions";
    import { useAppContext } from "@/contexts/AppContext";
    import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest } from "@/contexts/RepoXmlPageContext";

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

    // Helper: Get Language
    const getLanguage = (path: string): string => {
        const extension = path.split('.').pop()?.toLowerCase();
        switch(extension) {
            case 'ts': return 'typescript'; case 'tsx': return 'typescript';
            case 'js': return 'javascript'; case 'jsx': return 'javascript';
            case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html';
            case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql';
            case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go';
            case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash';
            case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext';
        }
    };

    // Utility: Delay Function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

    const categorizeResolvedPath = (resolvedPath: string): ImportCategory => {
        if (!resolvedPath) return 'other';
        const pathLower = resolvedPath.toLowerCase();
        if (pathLower.includes('/contexts/') || pathLower.startsWith('contexts/')) return 'context';
        if (pathLower.includes('/hooks/') || pathLower.startsWith('hooks/')) return 'hook';
        if (pathLower.includes('/lib/') || pathLower.startsWith('lib/')) return 'lib';
        if ((pathLower.includes('/components/') || pathLower.startsWith('components/')) && !pathLower.includes('/components/ui/')) return 'component';
        return 'other';
    };

    // --- Component ---
    const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
      // === State ===
      const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest"); // Local state for input field
      const [token, setToken] = useState<string>("");
      const [files, setFiles] = useState<FileNode[]>([]);
      const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set());
      const [extractLoading, setExtractLoading] = useState<boolean>(false); // Local loading for fetch button animation
      const [progress, setProgress] = useState<number>(0);
      const [error, setError] = useState<string | null>(null);
      const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null);
      const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<Record<ImportCategory, string[]>>({
          component: [], context: [], hook: [], lib: [], other: [],
      });
      const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
      const [isPrListOpen, setIsPrListOpen] = useState<boolean>(false); // State for PR list visibility
      const [autoAskAiEnabled, setAutoAskAiEnabled] = useState<boolean>(false);

      // === Context ===
      const { user, openLink } = useAppContext();
      const {
        fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched,
        selectedFetcherFiles, setSelectedFetcherFiles, kworkInputHasContent, setKworkInputHasContent,
        setRequestCopied, scrollToSection, kworkInputRef,
        setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        triggerAskAi, aiActionLoading, currentStep,
        // Branch & PR states/setters/triggers from context
        targetBranchName, setTargetBranchName,
        manualBranchName, setManualBranchName,
        openPrs, setOpenPrs,
        loadingPrs, setLoadingPrs,
        triggerGetOpenPRs,
        updateRepoUrlInAssistant, // Get the callback
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

       // Assign context ref to local ref if available
       useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);

      // Sync local repoUrl state with context setter and potentially Assistant
      const handleRepoUrlChange = useCallback((url: string) => {
          setRepoUrlState(url);
          setRepoUrlEntered(url.trim().length > 0);
          // Notify Assistant about the change
          updateRepoUrlInAssistant(url);
          // Reset PR list and branch selection if URL changes significantly
          setOpenPrs([]);
          setTargetBranchName(null);
          setManualBranchName(""); // Clear manual input as well
      }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);


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
            if (!cleanPath || cleanPath === 'app' || cleanPath === '/') { const rootPaths = ['app/page.tsx', 'app/page.js', 'app/index.tsx', 'app/index.js', 'src/app/page.tsx', 'src/app/page.js']; for (const rp of rootPaths) { if (allActualFilePaths.includes(rp)) return rp; } return 'app/page.tsx'; }
            const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`;
            const inputSegments = pathWithApp.split('/'); const numInputSegments = inputSegments.length;
            const potentialDirectPaths = [`${pathWithApp}/page.tsx`, `${pathWithApp}/page.js`, `${pathWithApp}/index.tsx`, `${pathWithApp}/index.js`];
            for (const pdp of potentialDirectPaths) { if (allActualFilePaths.includes(pdp)) return pdp; }
            const pageFiles = allActualFilePaths.filter(p => (p.startsWith('app/') || p.startsWith('src/app/')) && (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js')));
            for (const actualPath of pageFiles) {
                const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => actualPath.endsWith(s)); if (!suffix) continue;
                const actualPathBase = actualPath.substring(0, actualPath.length - suffix.length); const actualSegments = actualPathBase.split('/');
                if (actualSegments.length !== numInputSegments) continue;
                let isDynamicMatch = true;
                for (let i = 0; i < numInputSegments; i++) { const inputSeg = inputSegments[i]; const actualSeg = actualSegments[i]; if (inputSeg === actualSeg) continue; else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue; else { isDynamicMatch = false; break; } }
                if (isDynamicMatch) return actualPath;
            }
            return potentialDirectPaths[0];
       }, []);

       const extractImports = useCallback((content: string): string[] => {
            const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const imports = new Set<string>(); let match; while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); return Array.from(imports);
       }, []);

       const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
            const allPaths = allFiles.map(f => f.path); const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.md'];
            const tryPaths = (basePath: string): string | null => { const pathsToTry: string[] = []; const hasExplicitExtension = /\.\w+$/.test(basePath); if (hasExplicitExtension) { pathsToTry.push(basePath); } else { supportedExtensions.forEach(ext => pathsToTry.push(basePath + ext)); supportedExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`)); } for (const p of pathsToTry) { if (allPaths.includes(p)) { return p; } } return null; };
            if (importPath.startsWith('@/')) { const possibleSrcBases = ['src/', 'app/', '']; const pathSegment = importPath.substring(2); for (const base of possibleSrcBases) { const resolved = tryPaths(base + pathSegment); if (resolved) return resolved; } const commonAliasRoots = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/']; for(const root of commonAliasRoots) { if (pathSegment.startsWith(root)) { const resolved = tryPaths(pathSegment); if (resolved) return resolved; } } }
            else if (importPath.startsWith('.')) { const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : ''; const pathParts = (currentDir ? currentDir + '/' + importPath : importPath).split('/'); const resolvedParts: string[] = []; for (const part of pathParts) { if (part === '.' || part === '') continue; if (part === '..') { if (resolvedParts.length > 0) resolvedParts.pop(); } else { resolvedParts.push(part); } } const relativeResolvedBase = resolvedParts.join('/'); const resolved = tryPaths(relativeResolvedBase); if (resolved) return resolved; }
            else { const searchBases = ['lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/']; for (const base of searchBases) { const resolved = tryPaths(base + importPath); if (resolved) return resolved; } }
            return null;
      }, []);

    // --- Progress Simulation ---
    const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); progressIntervalRef.current = null; fetchTimeoutRef.current = null;
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 15) => {
        stopProgressSimulation(); setProgress(0); setError(null); const intervalTime = 150; const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime; const incrementBase = 100 / totalSteps;
        progressIntervalRef.current = setInterval(() => { setProgress((prev) => { const randomFactor = Math.random() * 0.7 + 0.6; let nextProgress = prev + (incrementBase * randomFactor); if (nextProgress >= 95 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) { nextProgress = Math.min(prev + incrementBase * 0.1, 99); } else if (nextProgress >= 100) { nextProgress = 99.9; } return nextProgress; }); }, intervalTime);
        fetchTimeoutRef.current = setTimeout(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; if (fetchStatus === 'loading' || fetchStatus === 'retrying') { console.warn("Progress simulation timed out while fetch was still in progress."); setProgress(99); } } fetchTimeoutRef.current = null; }, estimatedDurationSeconds * 1000 + 5000);
    }, [stopProgressSimulation, fetchStatus]);

    // === Core Logic Callbacks ===

    const updateKworkInput = useCallback((value: string) => {
        if (localKworkInputRef.current) {
            localKworkInputRef.current.value = value;
            const event = new Event('input', { bubbles: true });
            localKworkInputRef.current.dispatchEvent(event);
            setKworkInputHasContent(value.trim().length > 0);
        } else console.warn("updateKworkInput: localKworkInputRef is null");
    }, [setKworkInputHasContent]);

    const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);


    const handleAddSelected = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles;
        if (filesToAdd.size === 0) { addToast("Сначала выберите файлы для добавления", 'error'); return; }
        const prefix = "Контекст кода для анализа (отвечай полным кодом):\n";
        const markdownTxt = files
          .filter((file) => filesToAdd.has(file.path))
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((file) => `\`\`\`${getLanguage(file.path)}\n// /${file.path}\n${file.content}\n\`\`\``)
          .join("\n\n");

        const currentKworkValue = getKworkInputValue();
        let newContent = "";
        const taskText = currentKworkValue.split(prefix)[0]?.trim() || "";
        newContent = `${taskText ? taskText + '\n\n' : ''}${prefix}${markdownTxt}`;

        updateKworkInput(newContent);
        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('kworkInput');

        if (autoAskAi && autoAskAiEnabled) {
            addToast("Автоматически отправляю запрос AI...", "info");
            await triggerAskAi();
        }

    }, [selectedFiles, files, addToast, getKworkInputValue, updateKworkInput, scrollToSection, autoAskAiEnabled, triggerAskAi]);


    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? getKworkInputValue();
        if (!content.trim()) { addToast("Нет текста для копирования", 'error'); return false; }
        try {
            navigator.clipboard.writeText(content);
            addToast("Запрос скопирован! ✅ Вставляй в AI", 'success');
            setRequestCopied(true);
            if (shouldScroll) scrollToSection('executor');
            return true;
        } catch (err) { console.error("Clipboard copy failed:", err); addToast("Ошибка копирования", 'error'); return false; }
    }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);


    const handleClearAll = useCallback(() => {
        console.log("[handleClearAll] Clearing state.");
        setSelectedFilesState(new Set());
        setSelectedFetcherFiles(new Set());
        updateKworkInput("");
        setPrimaryHighlightedPath(null);
        setSecondaryHighlightedPaths({ component: [], context: [], hook: [], lib: [], other: [] });
        setAiResponseHasContent(false);
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());
        addToast("Поле ввода и выбор файлов очищены ✨", 'success');
        localKworkInputRef.current?.focus();
    }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles ]);


    const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
        console.log(`[Fetcher:handleFetch] Called. isManualRetry: ${isManualRetry}, Current Status: ${fetchStatus}, Branch: ${branchNameToFetch ?? 'Default'}`);
        if (!repoUrl.trim()) { addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); setIsSettingsOpen(true); return; }
        if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) { addToast("Извлечение уже идет...", "info"); return; }

        setExtractLoading(true); // Set local loading true
        setError(null); setFiles([]);
        setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set());
        setFilesFetched(false, null, []); setRequestCopied(false);
        setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
        setPrimaryHighlightedPath(null);
        setSecondaryHighlightedPaths({ component: [], context: [], hook: [], lib: [], other: [] });

        addToast(`Запрос репозитория (${branchNameToFetch ?? 'default'})...`, 'info');
        startProgressSimulation(20);

        const maxRetries = 2; const retryDelayMs = 2000;
        let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;

        while (currentTry <= maxRetries) {
            currentTry++;
            const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading';
            setFetchStatus(currentStatus); // Update context status
            console.log(`[Fetcher:handleFetch] Attempt ${currentTry}/${maxRetries + 1}, Status: ${currentStatus}`);
             if (currentStatus === 'retrying') { addToast(`Попытка ${currentTry} из ${maxRetries+1}...`, 'info'); await delay(retryDelayMs); startProgressSimulation(15 + (currentTry * 5)); }

            try {
              // Call the actual action with the determined branch name
              result = await fetchRepoContents(repoUrl, token || undefined, branchNameToFetch);
              console.log(`[Fetcher:handleFetch] Attempt ${currentTry} raw result:`, result);

              if (result?.success && Array.isArray(result.files)) {
                // --- SUCCESS HANDLING ---
                console.log(`[Fetcher:handleFetch] Success on attempt ${currentTry}. Files: ${result.files.length}`);
                stopProgressSimulation(); setProgress(100); setFetchStatus('success'); // Context status
                addToast(`Извлечено ${result.files.length} файлов из ${branchNameToFetch ?? 'default'}!`, 'success');
                setFiles(result.files); setIsSettingsOpen(false); setExtractLoading(false);

                const fetchedFiles = result.files;
                const allActualFilePaths = fetchedFiles.map(f => f.path);
                let primaryPath: string | null = null;
                const categorizedSecondaryPaths: Record<ImportCategory, Set<string>> = { component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set() };
                let filesToSelect = new Set<string>();

                // Highlighting logic (remains the same)
                if (highlightedPathFromUrl) {
                    primaryPath = getPageFilePath(highlightedPathFromUrl, allActualFilePaths);
                    const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
                    if (pageFile) {
                        filesToSelect.add(primaryPath);
                        const rawImports = extractImports(pageFile.content);
                        for (const imp of rawImports) {
                            const resolvedPath = resolveImportPath(imp, pageFile.path, fetchedFiles);
                            if (resolvedPath && resolvedPath !== primaryPath) {
                                const category = categorizeResolvedPath(resolvedPath); categorizedSecondaryPaths[category].add(resolvedPath);
                                if (category !== 'other') { filesToSelect.add(resolvedPath); }
                            }
                        }
                    } else { addToast(`Файл (${highlightedPathFromUrl} -> ${primaryPath || 'not found'}) не найден в ветке '${branchNameToFetch ?? 'default'}'.`, 'warning'); primaryPath = null; }
                }
                importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) filesToSelect.add(path); });

                // Update State
                setPrimaryHighlightedPath(primaryPath);
                const finalSecondaryPathsState = { component: Array.from(categorizedSecondaryPaths.component), context: Array.from(categorizedSecondaryPaths.context), hook: Array.from(categorizedSecondaryPaths.hook), lib: Array.from(categorizedSecondaryPaths.lib), other: Array.from(categorizedSecondaryPaths.other), };
                setSecondaryHighlightedPaths(finalSecondaryPathsState);
                const allSecondaryPathsArray = Object.values(finalSecondaryPathsState).flat();
                setFilesFetched(true, primaryPath, allSecondaryPathsArray); // Update context state

                // Auto-select and Generate Request/Ask AI Logic
                 if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) {
                     addToast(`Авто-выбор ${filesToSelect.size} файлов и генерация запроса...`, 'info');
                     setSelectedFilesState(filesToSelect);
                     setSelectedFetcherFiles(filesToSelect);
                     const task = ideaFromUrl || DEFAULT_TASK_IDEA;
                     await handleAddSelected(true, filesToSelect);
                 } else {
                      if (filesToSelect.size > 0 && (!highlightedPathFromUrl || !ideaFromUrl)) {
                          setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect);
                          const numHighlighted = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size;
                          const numImportantOnly = filesToSelect.size - (primaryPath ? 1 : 0) - numHighlighted; let selectMsg = `Авто-выбрано: `; const parts = []; if(primaryPath) parts.push(`1 основной`); if(numHighlighted > 0) parts.push(`${numHighlighted} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`); selectMsg += parts.join(', ') + '.'; addToast(selectMsg, 'info');
                      }
                     if (primaryPath) { setTimeout(() => { const elId = `file-${primaryPath}`; const el = document.getElementById(elId); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'); setTimeout(() => el.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000'), 2500); } else { console.warn(`Element ${elId} not found.`); } }, 400); }
                     else if (fetchedFiles.length > 0) { const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
                 }
                 return; // <<< SUCCESS EXIT POINT >>>

              } else {
                // --- FAILURE HANDLING for this attempt ---
                const errorMessage = result?.error || `Не удалось получить файлы из ${branchNameToFetch ?? 'default'}`;
                console.error(`[Fetcher:handleFetch] Attempt ${currentTry} failed: ${errorMessage}`);
                throw new Error(errorMessage);
              }
            } catch (err: any) {
              console.error(`[Fetcher:handleFetch] Error during attempt ${currentTry}:`, err); const displayError = err?.message || "Неизвестная ошибка при извлечении"; setError(`Попытка ${currentTry}: ${displayError}`);
              if (currentTry > maxRetries) { console.error(`[Fetcher:handleFetch] Final attempt failed. Max retries (${maxRetries}) reached.`); stopProgressSimulation(); setFetchStatus('failed_retries'); setProgress(0); addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error'); setFilesFetched(false, null, []); setExtractLoading(false); return; }
            }
        } // End while loop

        console.warn("[Fetcher:handleFetch] Reached end of function unexpectedly."); stopProgressSimulation(); if (fetchStatus !== 'success') { setFetchStatus(error ? 'failed_retries' : 'error'); setProgress(0); setFilesFetched(false, null, []); } setExtractLoading(false);

   }, [
        repoUrl, token, fetchStatus, files, // Removed selectedFiles, kworkInput
        setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setExtractLoading,
        setPrimaryHighlightedPath, setSecondaryHighlightedPaths, setIsSettingsOpen,
        setSelectedFetcherFiles, setFilesFetched, setRequestCopied, setAiResponseHasContent,
        setFilesParsed, setSelectedAssistantFiles, // Removed setRepoUrlEntered
        highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA,
        addToast, startProgressSimulation, stopProgressSimulation, getLanguage,
        getPageFilePath, extractImports, resolveImportPath, handleCopyToClipboard,
        openLink, scrollToSection,
        getKworkInputValue, handleAddSelected, // Removed autoAskAiEnabled, triggerAskAi
        setKworkInputHasContent // Added context setter
   ]);


    // --- Other Callbacks ---
    const selectHighlightedFiles = useCallback(() => {
        const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0; const allHighlightableSecondary = [ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib, ]; if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; } allHighlightableSecondary.forEach(path => { if (files.some(f => f.path === path) && !filesToSelect.has(path)) { filesToSelect.add(path); newlySelectedCount++; } }); if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info'); } else { addToast("Все связанные файлы уже выбраны или не найдены", 'info'); }
    }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);

    const toggleFileSelection = useCallback((path: string) => {
        setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if (newSet.has(path)) newSet.delete(path); else newSet.add(path); setSelectedFetcherFiles(newSet); return newSet; });
    }, [setSelectedFetcherFiles]);

    const handleAddImportantFiles = useCallback(() => {
        let addedCount = 0; const filesToAdd = new Set(selectedFiles); importantFiles.forEach(path => { if (files.some(f => f.path === path) && !selectedFiles.has(path)) { filesToAdd.add(path); addedCount++; } }); if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены в репозитории", 'info'); return; } setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success');
    }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);

    const handleAddFullTree = useCallback(() => {
        if (files.length === 0) { addToast("Нет файлов для отображения дерева", 'error'); return; } const treeOnly = files.map((file) => `- /${file.path}`).sort().join("\n"); const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``; let added = false; updateKworkInput((prev) => { const trimmedPrev = prev.trim(); if (/Структура файлов проекта:\s*```/im.test(trimmedPrev)) { return prev; } added = true; return trimmedPrev ? `${trimmedPrev}\n\n${treeContent}` : treeContent; }); if (added) { addToast("Дерево файлов добавлено в запрос", 'success'); scrollToSection('kworkInput'); } else { addToast("Дерево файлов уже добавлено", 'info'); }
    }, [files, updateKworkInput, scrollToSection, addToast]);

    // --- NEW: PR Selection Handler ---
    const handleSelectPrBranch = useCallback((branch: string | null) => {
        setTargetBranchName(branch); // Update context
        setManualBranchName(""); // Clear manual input when a PR is selected/deselected
        if (branch) {
            addToast(`Выбрана ветка PR: ${branch}`, 'success');
        } else {
             addToast(`Выбор ветки PR снят, используется ветка по умолчанию.`, 'info');
        }
        setIsPrListOpen(false); // Close the list after selection
        scrollToSection('fetcher'); // Scroll back to top of fetcher
    }, [setTargetBranchName, setManualBranchName, addToast, scrollToSection]);

    // --- NEW: Manual Branch Input Handler ---
    const handleManualBranchChange = useCallback((name: string) => {
        setManualBranchName(name); // Update context
        // Context setter already handles updating targetBranchName
        if (!name.trim()) {
            // If cleared, check if a PR branch was previously selected (revert to it or default)
            // This is handled by the logic in triggerFetch reading targetBranchName state.
            // For display purposes, the SettingsModal reads manualBranchName first.
        }
    }, [setManualBranchName]);

    // --- Effects ---
    // Sync repoUrlEntered with local state
    useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); }, [repoUrl, setRepoUrlEntered]);

    // Auto-fetch effect
    useEffect(() => {
        if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
            console.log("Auto-fetching due to URL parameter 'path'...");
            handleFetch(false, targetBranchName); // Pass current target branch
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus, targetBranchName]); // Added targetBranchName dependency

    // Cleanup simulation timers
    useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);


    // === Imperative Handle ===
    useImperativeHandle(ref, () => ({
        handleFetch, // Expose the fetcher's handleFetch directly
        selectHighlightedFiles,
        handleAddSelected,
        handleCopyToClipboard,
        clearAll: handleClearAll,
        getKworkInputValue,
    }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);


    // --- Render Logic ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const isFetchDisabled = isLoading || !repoUrlEntered; // Disable if loading or no URL
    const showProgressBar = isLoading || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
    const isAskAiDisabled = !kworkInputHasContent || aiActionLoading || isLoading || loadingPrs;
    const isCopyDisabled = !kworkInputHasContent || isLoading || aiActionLoading || loadingPrs;
    const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isLoading || aiActionLoading || loadingPrs;
    const isPrLoadDisabled = loadingPrs || !repoUrlEntered || isLoading || aiActionLoading;

    // Determine effective branch for display in fetch button
    const effectiveBranchDisplay = manualBranchName.trim() || targetBranchName || "default";

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Header & Settings Toggle */}
       <div className="flex justify-between items-start mb-4 gap-4">
            <div className="flex-grow">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2"> <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода </h2>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 1. Укажи URL репо, <span className="text-cyan-400 cursor-pointer hover:underline" onClick={() => setIsSettingsOpen(true)}>токен и ветку</span> (или выбери PR).</p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 2. Нажми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1"> 3. Выбери файлы для контекста AI.</p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-2"> 4. Опиши задачу ИЛИ оставь поле пустым.</p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-2"> 5. Добавь код <span className="font-bold text-cyan-400 mx-1">И/ИЛИ</span> нажми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span>.</p>
            </div>
            <motion.button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0" whileHover={{ scale: 1.1, rotate: isSettingsOpen ? 10 : -10 }} whileTap={{ scale: 0.95 }} title={isSettingsOpen ? "Скрыть настройки" : "Показать настройки URL/Token/Branch"} aria-label={isSettingsOpen ? "Скрыть настройки" : "Показать настройки URL/Token/Branch"} aria-expanded={isSettingsOpen}>
                {isSettingsOpen ? <FaCircleChevronUp className="text-cyan-400 text-xl" /> : <FaCircleChevronDown className="text-cyan-400 text-xl" />}
            </motion.button>
        </div>

      {/* Settings Modal Component - Pass new props */}
      <SettingsModal
            isOpen={isSettingsOpen}
            repoUrl={repoUrl}
            setRepoUrl={handleRepoUrlChange} // Use the new handler
            token={token}
            setToken={setToken}
            manualBranchName={manualBranchName}
            setManualBranchName={handleManualBranchChange} // Use the new handler
            currentTargetBranch={targetBranchName} // Pass the branch selected from PR
            loading={isLoading || loadingPrs} // Disable if fetching files OR loading PRs
            onClose={() => setIsSettingsOpen(false)}
       />

      {/* Fetch & PR Load Buttons */}
       <div className="mb-4 flex flex-wrap justify-center items-center gap-4">
            {/* Load PRs Button */}
            <motion.button
                onClick={() => triggerGetOpenPRs(repoUrl)}
                disabled={isPrLoadDisabled}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold text-sm text-white ${
                    isPrLoadDisabled
                    ? 'bg-gray-600 opacity-60 cursor-not-allowed brightness-75'
                    : 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-cyan-500/30 hover:shadow-cyan-500/40 transition-all hover:brightness-110 active:scale-[0.98]'
                }`}
                whileHover={{ scale: isPrLoadDisabled ? 1 : 1.03 }}
                whileTap={{ scale: isPrLoadDisabled ? 1 : 0.97 }}
            >
                {loadingPrs ? <FaArrowsRotate className="animate-spin" /> : <FaList />}
                {loadingPrs ? "Загрузка PR..." : "Загрузить PR"}
            </motion.button>

            {/* Fetch Button */}
            <motion.button
                onClick={() => triggerFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error')} // Use context trigger
                disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${ fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-red-500/30 hover:shadow-red-500/40' : 'from-purple-600 to-cyan-500 shadow-purple-500/30 hover:shadow-cyan-500/40' } transition-all ${isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error') ? "opacity-60 cursor-not-allowed brightness-75" : "hover:brightness-110 active:scale-[0.98]"}`}
                whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }}
                whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }}
                title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`}
            >
                 {isLoading ? <FaArrowsRotate className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)}
                 {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")}
                 <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
            </motion.button>
        </div>

        {/* NEW: PR Selector Section */}
        <AnimatePresence>
            {openPrs.length > 0 && (
                 <motion.div
                    id="pr-selector-section"
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: '0.75rem' }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mb-4 border border-purple-700/50 rounded-lg p-4 bg-gray-800/60 shadow-lg"
                 >
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-base font-semibold text-purple-300 flex items-center gap-2">
                            <FaCodeBranch /> Выберите PR для извлечения его ветки:
                        </h3>
                        <button
                           onClick={() => handleSelectPrBranch(null)} // Button to explicitly select default
                           className={`text-xs px-2 py-1 rounded ${!targetBranchName || manualBranchName ? 'bg-gray-600 hover:bg-gray-500' : 'bg-purple-600 ring-2 ring-purple-400'} transition text-white`}
                           title="Использовать ветку по умолчанию"
                         >
                           Default
                        </button>
                    </div>
                    <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 simple-scrollbar">
                       {openPrs.map((pr) => (
                            <li key={pr.id}>
                                <button
                                    onClick={() => handleSelectPrBranch(pr.head.ref)}
                                    disabled={isLoading || loadingPrs}
                                    className={`w-full flex items-center justify-between gap-2 p-2 rounded text-left text-sm transition ${
                                        targetBranchName === pr.head.ref && !manualBranchName.trim()
                                        ? 'bg-purple-700/80 ring-2 ring-purple-400 shadow-md'
                                        : 'bg-gray-700/50 hover:bg-gray-600/70 disabled:opacity-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 flex-grow min-w-0">
                                         {targetBranchName === pr.head.ref && !manualBranchName.trim() && <FaCheck className="text-green-400 flex-shrink-0" />}
                                         <span className="text-purple-300 font-medium flex-shrink-0">#{pr.number}:</span>
                                         <span className="text-gray-200 truncate flex-grow" title={pr.title}>{pr.title}</span>
                                    </div>
                                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0 truncate" title={`Branch: ${pr.head.ref}`}>
                                        ({pr.head.ref})
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                 </motion.div>
             )}
        </AnimatePresence>


      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} />
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повторная попытка)' : ''}</p>}
                 {fetchStatus === 'success' && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно извлечено ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> Успешно, но не найдено подходящих файлов в '${effectiveBranchDisplay}'. </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}

      {/* Main Content Area (Files & Input) */}
       <div className={`grid grid-cols-1 ${files.length > 0 || kworkInputHasContent ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>

         {/* Left Column: File List & Controls */}
         {(isLoading || (files.length > 0 && fetchStatus !== 'error' && fetchStatus !== 'failed_retries')) && (
             <div className="flex flex-col gap-4">
                <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} />
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
                 <FileList
                    id="file-list-container" files={files} selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath} secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles} isLoading={isLoading} toggleFileSelection={toggleFileSelection}
                    onAddSelected={() => handleAddSelected(autoAskAiEnabled)}
                    onAddImportant={() => handleAddImportantFiles()} onAddTree={() => handleAddFullTree()}
                    onSelectHighlighted={selectHighlightedFiles} />
             </div>
         )}

         {/* Right Column: Request Input */}
         {(fetchStatus === 'success' || kworkInputHasContent || files.length > 0 ) ? (
             <div id="kwork-input-section" className="flex flex-col gap-3">
                 <RequestInput
                    kworkInputRef={localKworkInputRef}
                    onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                    isCopyDisabled={isCopyDisabled}
                    isClearDisabled={isClearDisabled}
                    onCopyToClipboard={() => handleCopyToClipboard()}
                    onClearAll={() => handleClearAll()}
                 />
                 <motion.button
                    onClick={triggerAskAi} disabled={isAskAiDisabled}
                    className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg font-semibold text-sm text-white ${ isAskAiDisabled ? 'bg-gray-600 opacity-60 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 shadow-blue-500/30 hover:shadow-indigo-500/40 transition-all hover:brightness-110 active:scale-[0.98]' }`}
                    whileHover={{ scale: isAskAiDisabled ? 1 : 1.03 }} whileTap={{ scale: isAskAiDisabled ? 1 : 0.97 }} >
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