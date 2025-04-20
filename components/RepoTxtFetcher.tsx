"use client";

    import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo} from "react";
    import { useSearchParams } from "next/navigation";
    import { toast } from "sonner";
    import {
        FaAngleDown, FaAngleUp,
        FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
        FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines
    } from "react-icons/fa6";
    import { motion } from "framer-motion";

    // Actions & Context
    import { fetchRepoContents } from "@/app/actions_github/actions";
    import { useAppContext } from "@/contexts/AppContext";
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
      const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
      const [token, setToken] = useState<string>("");
      const [files, setFiles] = useState<FileNode[]>([]);
      const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set());
      const [extractLoading, setExtractLoading] = useState<boolean>(false);
      const [progress, setProgress] = useState<number>(0);
      const [error, setError] = useState<string | null>(null);
      const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
      const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
      const [autoAskAiEnabled, setAutoAskAiEnabled] = useState<boolean>(false);

      // === Context ===
      const { user, openLink } = useAppContext();
      const {
        fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched,
        selectedFetcherFiles, setSelectedFetcherFiles, kworkInputHasContent, setKworkInputHasContent,
        setRequestCopied, aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing,
        currentAiRequestId, targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName,
        openPrs, setOpenPrs, setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal,
        kworkInputRef, triggerAskAi, triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection, triggerFetch, setFilesParsed, setAiResponseHasContent,  setSelectedAssistantFiles
      } = useRepoXmlPageContext();

      // === URL Params & Derived State ===
      const searchParams = useSearchParams();
      const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
      const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
      const autoFetch = useMemo(() => !!highlightedPathFromUrl, [highlightedPathFromUrl]);
      const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";
      const importantFiles = useMemo(() => [
          "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx",
          "hooks/supabase.ts", "app/actions.ts",
           "app/ai_actions/actions.ts", "app/webhook-handlers/proxy.ts",
           "package.json", "tailwind.config.ts"
      ], []);

      // === Refs ===
      const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
      const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
      const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
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

       const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string => {
            const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
            if (!cleanPath || cleanPath === 'app' || cleanPath === '/') { const rootPaths = ['app/page.tsx', 'app/page.js', 'app/index.tsx', 'app/index.js', 'src/app/page.tsx', 'src/app/page.js']; for (const rp of rootPaths) { if (allActualFilePaths.includes(rp)) return rp; } console.warn(`getPageFilePath: Root path mapping not found for "${routePath}". Defaulting to app/page.tsx`); return 'app/page.tsx'; }
            const pathWithApp = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`;
            const inputSegments = pathWithApp.split('/'); const numInputSegments = inputSegments.length;
            const potentialDirectPaths = [`${pathWithApp}/page.tsx`, `${pathWithApp}/page.js`, `${pathWithApp}/index.tsx`, `${pathWithApp}/index.js`]; for (const pdp of potentialDirectPaths) { if (allActualFilePaths.includes(pdp)) return pdp; }
            const pageFiles = allActualFilePaths.filter(p => (p.startsWith('app/') || p.startsWith('src/app/')) && (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js')));
            for (const actualPath of pageFiles) { const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => actualPath.endsWith(s)); if (!suffix) continue; const actualPathBase = actualPath.substring(0, actualPath.length - suffix.length); const actualSegments = actualPathBase.split('/'); if (actualSegments.length !== numInputSegments) continue; let isDynamicMatch = true; for (let i = 0; i < numInputSegments; i++) { const inputSeg = inputSegments[i]; const actualSeg = actualSegments[i]; if (inputSeg === actualSeg) continue; else if (actualSeg.startsWith('[') && actualSeg.endsWith(']')) continue; else { isDynamicMatch = false; break; } } if (isDynamicMatch) { console.log(`getPageFilePath: Dynamic match found: "${routePath}" -> "${actualPath}"`); return actualPath; } }
            console.warn(`getPageFilePath: No direct or dynamic match for route "${routePath}". Falling back to guess: "${potentialDirectPaths[0]}"`); return potentialDirectPaths[0];
       }, []);

       const extractImports = useCallback((content: string): string[] => {
            const importRegex = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const requireRegex = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const imports = new Set<string>(); let match; while ((match = importRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); while ((match = requireRegex.exec(content)) !== null) if (match[1] && match[1] !== '.') imports.add(match[1]); return Array.from(imports);
       }, []);

       const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
            const allPaths = allFiles.map(f => f.path); const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.md'];
            const tryPaths = (basePath: string): string | null => { const pathsToTry: string[] = []; const hasExplicitExtension = /\.\w+$/.test(basePath); if (hasExplicitExtension) pathsToTry.push(basePath); else { supportedExtensions.forEach(ext => pathsToTry.push(basePath + ext)); supportedExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`)); } for (const p of pathsToTry) { if (allPaths.includes(p)) return p; } return null; };
            if (importPath.startsWith('@/')) { const possibleSrcBases = ['src/', 'app/', '']; const pathSegment = importPath.substring(2); for (const base of possibleSrcBases) { const resolved = tryPaths(base + pathSegment); if (resolved) return resolved; } const commonAliasRoots = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/']; for(const root of commonAliasRoots) { if (pathSegment.startsWith(root)) { const resolved = tryPaths(pathSegment); if (resolved) return resolved; } } }
            else if (importPath.startsWith('.')) { const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : ''; const pathParts = (currentDir ? currentDir + '/' + importPath : importPath).split('/'); const resolvedParts: string[] = []; for (const part of pathParts) { if (part === '.' || part === '') continue; if (part === '..') { if (resolvedParts.length > 0) resolvedParts.pop(); } else resolvedParts.push(part); } const relativeResolvedBase = resolvedParts.join('/'); const resolved = tryPaths(relativeResolvedBase); if (resolved) return resolved; }
            else { const searchBases = ['lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/', 'src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/']; for (const base of searchBases) { const resolved = tryPaths(base + importPath); if (resolved) return resolved; } }
            return null;
      }, []);

    // --- Progress Simulation ---
    const stopProgressSimulation = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        progressIntervalRef.current = null; fetchTimeoutRef.current = null;
    }, []);

    const startProgressSimulation = useCallback((estimatedDurationSeconds = 7) => {
        stopProgressSimulation(); setProgress(0); setError(null); const intervalTime = 150; const totalSteps = (estimatedDurationSeconds * 1000) / intervalTime; const incrementBase = 100 / totalSteps;
        progressIntervalRef.current = setInterval(() => { setProgress((prev) => { const randomFactor = Math.random() * 0.7 + 0.6; let nextProgress = prev + (incrementBase * randomFactor); if (nextProgress >= 95 && (fetchStatus === 'loading' || fetchStatus === 'retrying') && fetchTimeoutRef.current) { nextProgress = Math.min(prev + incrementBase * 0.1, 69); } else if (nextProgress >= 100) { nextProgress = 69.420; } return nextProgress; }); }, intervalTime);
        fetchTimeoutRef.current = setTimeout(() => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; if (fetchStatus === 'loading' || fetchStatus === 'retrying') { console.warn("Progress simulation timed out while fetch was still in progress."); setProgress(99); } } fetchTimeoutRef.current = null; }, estimatedDurationSeconds * 1000 + 5000);
    }, [stopProgressSimulation, fetchStatus]);


    // === Core Logic Callbacks ===

    const handleRepoUrlChange = useCallback((url: string) => {
        setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName("");
    }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);

    const updateKworkInput = useCallback((value: string) => {
        if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { console.warn("updateKworkInput: localKworkInputRef is null"); }
    }, [setKworkInputHasContent]);

    const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);


    // Add selected file contents to the Kwork Input
    // .. FIX: Prevent adding duplicate path comment
    const handleAddSelected = useCallback(async (autoAskAi = false, filesToAddParam?: Set<string>) => {
        const filesToAdd = filesToAddParam || selectedFiles; if (filesToAdd.size === 0) { addToast("Сначала выберите файлы для добавления", 'error'); return; }
        const prefix = "Контекст кода для анализа:\n";
        const markdownTxt = files
            .filter((file) => filesToAdd.has(file.path))
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((file) => {
                const pathComment = `// /${file.path}`;
                // .. Check if the raw file content already starts with this comment line (ignoring leading whitespace)
                const contentAlreadyHasComment = file.content.trimStart().startsWith(pathComment);
                // .. Add the comment ONLY if it's not already the first line of the content
                const contentToAdd = contentAlreadyHasComment ? file.content : `${pathComment}\n${file.content}`;
                return `\`\`\`${getLanguage(file.path)}\n${contentToAdd}\n\`\`\``;
            })
            .join("\n\n");
        const currentKworkValue = getKworkInputValue();
        const taskText = currentKworkValue.split(prefix)[0]?.trim() || ""; // .. Extract text before the code context prefix
        const newContent = `${taskText ? taskText + '\n\n' : ''}${prefix}${markdownTxt}`; // .. Rebuild: Task + Prefix + New Markdown Code
        updateKworkInput(newContent);
        addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
        scrollToSection('kworkInput');
        if (autoAskAi && autoAskAiEnabled) {
            addToast("Автоматически отправляю запрос AI в очередь...", "info");
            await triggerAskAi().catch(err => console.error("Error auto-triggering AI Ask:", err));
        }
    }, [selectedFiles, files, addToast, getKworkInputValue, updateKworkInput, scrollToSection, autoAskAiEnabled, triggerAskAi, getLanguage]); // Added getLanguage dependency


    const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const content = textToCopy ?? getKworkInputValue(); if (!content.trim()) { addToast("Нет текста для копирования", 'error'); return false; }
        try { navigator.clipboard.writeText(content); addToast("Запрос скопирован! ✅ Вставляй в AI", 'success'); setRequestCopied(true); if (shouldScroll) scrollToSection('executor'); return true; }
        catch (err) { console.error("Clipboard copy failed:", err); addToast("Ошибка копирования", 'error'); return false; }
    }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);


    const handleClearAll = useCallback(() => {
        console.log("[handleClearAll] Clearing Fetcher state."); setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); updateKworkInput(""); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); addToast("Поле ввода и выбор файлов очищены ✨", 'success'); if (localKworkInputRef.current) localKworkInputRef.current.focus();
    }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles ]);


    // --- Fetch Handler ---
    const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
        const effectiveBranch = branchNameToFetch ?? 'default'; console.log(`[Fetcher:handleFetch] Called. isManualRetry: ${isManualRetry}, Branch: ${effectiveBranch}`);
        if (!repoUrl.trim()) { addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); triggerToggleSettingsModal(); return; }
        if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) { addToast("Извлечение уже идет...", "info"); return; }
        setExtractLoading(true); setError(null); setFiles([]); setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); setFilesFetched(false, null, []); setRequestCopied(false); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); addToast(`Запрос репозитория (${effectiveBranch})...`, 'info'); startProgressSimulation(20);
        const maxRetries = 2; const retryDelayMs = 2000; let currentTry = 0; let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
        while (currentTry <= maxRetries) { currentTry++; const currentStatus: FetchStatus = currentTry > 1 ? 'retrying' : 'loading'; setFetchStatus(currentStatus); if (currentStatus === 'retrying') { addToast(`Попытка ${currentTry} из ${maxRetries+1}...`, 'info'); await delay(retryDelayMs); startProgressSimulation(15 + (currentTry * 5)); }
            try { result = await fetchRepoContents(repoUrl, token || undefined, branchNameToFetch); console.log(`[Fetcher:handleFetch] Attempt ${currentTry} raw result:`, result);
              if (result?.success && Array.isArray(result.files)) { stopProgressSimulation(); setProgress(100); setFetchStatus('success'); addToast(`Извлечено ${result.files.length} файлов из ${effectiveBranch}!`, 'success'); setFiles(result.files); if (isSettingsModalOpen) triggerToggleSettingsModal(); setExtractLoading(false);
                const fetchedFiles = result.files; const allActualFilePaths = fetchedFiles.map(f => f.path); let primaryPath: string | null = null; const categorizedSecondaryPaths: Record<ImportCategory, Set<string>> = { component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set() }; let filesToSelect = new Set<string>();
                if (highlightedPathFromUrl) { primaryPath = getPageFilePath(highlightedPathFromUrl, allActualFilePaths); const pageFile = fetchedFiles.find((file) => file.path === primaryPath); if (pageFile) { console.log(`Primary file found: ${primaryPath}`); filesToSelect.add(primaryPath); const rawImports = extractImports(pageFile.content); console.log(`Raw imports from ${primaryPath}:`, rawImports); for (const imp of rawImports) { const resolvedPath = resolveImportPath(imp, pageFile.path, fetchedFiles); if (resolvedPath && resolvedPath !== primaryPath) { const category = categorizeResolvedPath(resolvedPath); categorizedSecondaryPaths[category].add(resolvedPath); if (category !== 'other') filesToSelect.add(resolvedPath); console.log(`  Resolved import: '${imp}' -> '${resolvedPath}' (Category: ${category})`); } else if (!resolvedPath) { console.log(`  Could not resolve import: '${imp}'`); } } } else { addToast(`Файл страницы для URL (${highlightedPathFromUrl} -> ${primaryPath || 'not found'}) не найден в ветке '${effectiveBranch}'.`, 'warning'); primaryPath = null; } }
                importantFiles.forEach(path => { if (fetchedFiles.some(f => f.path === path) && !filesToSelect.has(path)) filesToSelect.add(path); });
                setPrimaryHighlightedPathState(primaryPath); const finalSecondaryPathsState = { component: Array.from(categorizedSecondaryPaths.component), context: Array.from(categorizedSecondaryPaths.context), hook: Array.from(categorizedSecondaryPaths.hook), lib: Array.from(categorizedSecondaryPaths.lib), other: Array.from(categorizedSecondaryPaths.other) }; setSecondaryHighlightedPathsState(finalSecondaryPathsState); setFilesFetched(true, primaryPath, Object.values(finalSecondaryPathsState).flat());
                if (highlightedPathFromUrl && ideaFromUrl && filesToSelect.size > 0) { addToast(`Авто-выбор ${filesToSelect.size} файлов и генерация запроса...`, 'info'); setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); const task = ideaFromUrl || DEFAULT_TASK_IDEA; updateKworkInput(task); await handleAddSelected(true, filesToSelect); }
                else { if (filesToSelect.size > 0 && (!highlightedPathFromUrl || !ideaFromUrl)) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); const numHighlighted = categorizedSecondaryPaths.component.size + categorizedSecondaryPaths.context.size + categorizedSecondaryPaths.hook.size + categorizedSecondaryPaths.lib.size; const numImportantOnly = filesToSelect.size - (primaryPath ? 1 : 0) - numHighlighted; let selectMsg = `Авто-выбрано: `; const parts = []; if(primaryPath) parts.push(`1 основной`); if(numHighlighted > 0) parts.push(`${numHighlighted} связанных`); if(numImportantOnly > 0) parts.push(`${numImportantOnly} важных`); selectMsg += parts.join(', ') + '.'; addToast(selectMsg, 'info'); }
                  if (primaryPath) { setTimeout(() => { const elementId = `file-${primaryPath}`; const fileElement = document.getElementById(elementId); if (fileElement) { fileElement.scrollIntoView({ behavior: "smooth", block: "center" }); fileElement.classList.add('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800'); setTimeout(() => fileElement.classList.remove('ring-2', 'ring-offset-2', 'ring-cyan-400', 'rounded-md', 'transition-all', 'duration-1000', 'ring-offset-gray-800'), 2500); } else { console.warn(`Element with ID ${elementId} not found for scrolling.`); } }, 400); }
                  else if (fetchedFiles.length > 0) { const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); } }
                return; // <<< SUCCESS EXIT POINT >>>
              } else { throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}`); }
            } catch (err: any) { console.error(`[Fetcher:handleFetch] Error during attempt ${currentTry}:`, err); const displayError = err?.message || "Неизвестная ошибка при извлечении"; setError(`Попытка ${currentTry}: ${displayError}`); if (currentTry > maxRetries) { console.error(`[Fetcher:handleFetch] Final attempt failed. Max retries (${maxRetries}) reached.`); stopProgressSimulation(); setFetchStatus('failed_retries'); setProgress(0); addToast(`Не удалось извлечь файлы после ${maxRetries + 1} попыток. ${displayError}`, 'error'); setFilesFetched(false, null, []); setExtractLoading(false); return; } }
        } // End while loop
        console.warn("[Fetcher:handleFetch] Reached end of function unexpectedly after loop."); stopProgressSimulation(); if (fetchStatus !== 'success') { setFetchStatus(error ? 'failed_retries' : 'error'); setProgress(0); setFilesFetched(false, null, []); } setExtractLoading(false);
   }, [ repoUrl, token, fetchStatus, setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setExtractLoading, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetched, setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA, addToast, startProgressSimulation, stopProgressSimulation, getLanguage, getPageFilePath, extractImports, resolveImportPath, handleAddSelected, getKworkInputValue, scrollToSection, setKworkInputHasContent, isSettingsModalOpen, triggerToggleSettingsModal, updateKworkInput, triggerAskAi, autoAskAiEnabled ]);


    // --- Other Callbacks ---
    const selectHighlightedFiles = useCallback(() => { const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0; const allHighlightableSecondary = [ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib, ]; if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; } allHighlightableSecondary.forEach(path => { if (files.some(f => f.path === path) && !filesToSelect.has(path)) { filesToSelect.add(path); newlySelectedCount++; } }); if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`Добавлено ${newlySelectedCount} связанных файлов к выборке`, 'info'); } else { addToast("Все связанные файлы уже выбраны или не найдены", 'info'); } }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);
    const toggleFileSelection = useCallback((path: string) => { setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if (newSet.has(path)) newSet.delete(path); else newSet.add(path); setSelectedFetcherFiles(newSet); return newSet; }); }, [setSelectedFetcherFiles]);
    const handleAddImportantFiles = useCallback(() => { let addedCount = 0; const filesToAdd = new Set(selectedFiles); importantFiles.forEach(path => { if (files.some(f => f.path === path) && !selectedFiles.has(path)) { filesToAdd.add(path); addedCount++; } }); if (addedCount === 0) { addToast("Важные файлы уже выбраны или не найдены в репозитории", 'info'); return; } setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); addToast(`Добавлено ${addedCount} важных файлов к выборке`, 'success'); }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);
    const handleAddFullTree = useCallback(() => { if (files.length === 0) { addToast("Нет файлов для отображения дерева", 'error'); return; } const treeOnly = files.map((file) => `- /${file.path}`).sort().join("\n"); const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``; let added = false; const currentKworkValue = getKworkInputValue(); const trimmedValue = currentKworkValue.trim(); const hasTreeStructure = /Структура файлов проекта:\s*```/im.test(trimmedValue); if (!hasTreeStructure) { const newContent = trimmedValue ? `${trimmedValue}\n\n${treeContent}` : treeContent; updateKworkInput(newContent); added = true; } if (added) { addToast("Дерево файлов добавлено в запрос", 'success'); scrollToSection('kworkInput'); } else { addToast("Дерево файлов уже добавлено", 'info'); } }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast]);
    const handleSelectPrBranch = useCallback((branch: string | null) => { setTargetBranchName(branch); if (branch) addToast(`Выбрана ветка PR: ${branch}`, 'success'); else addToast(`Выбор ветки PR снят (используется default или ручная).`, 'info'); }, [setTargetBranchName, addToast]);
    const handleManualBranchChange = useCallback((name: string) => { setManualBranchName(name); }, [setManualBranchName]);
    const handleLoadPrs = useCallback(() => { triggerGetOpenPRs(repoUrl); }, [triggerGetOpenPRs, repoUrl]);

    // --- Effects ---
    useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl); }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]);

    // Auto-fetch effect (FIXED dependency array)
    useEffect(() => {
        const branchForAutoFetch = targetBranchName; // Use branch from context if set
        if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) {
            console.log(`Auto-fetching due to URL param 'path'. Branch: ${branchForAutoFetch ?? 'Default'}`);
            // .. Trigger fetch using the context function to ensure consistency
            triggerFetch(false, branchForAutoFetch);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedPathFromUrl, repoUrl, autoFetch, fetchStatus, targetBranchName, triggerFetch]); // Added triggerFetch dependency


    // Cleanup simulation timers
    useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);

    // === Imperative Handle ===
    useImperativeHandle(ref, () => ({ handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll: handleClearAll, getKworkInputValue }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);

    // --- Render Logic ---
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying' || isParsing;
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered;
    const showProgressBar = isLoading || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
    const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing;
    const isAskAiDisabled = !kworkInputHasContent || isActionDisabled;
    const isCopyDisabled = !kworkInputHasContent || isActionDisabled;
    const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled;
    const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled;
    const effectiveBranchDisplay = targetBranchName || manualBranchName || "default"; // Show manual branch if target PR branch isn't selected
    const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

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
                    1. Укажи URL/токен/ветку в <span className="text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}>настройках</span> (<FaCodeBranch className="inline text-cyan-400"/>).
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1">
                    2. Нажми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-1">
                    3. Выбери файлы для контекста AI.
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-2">
                    4. Опиши задачу ИЛИ добавь файлы кнопкой (+).
                 </p>
                 <p className="text-yellow-300/80 text-xs md:text-sm mb-2">
                    5. Нажми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> <span className="text-gray-400 text-xs">(Админ получит уведомление)</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.
                 </p>
            </div>
            {/* Settings Toggle Button */}
            <motion.button
                onClick={triggerToggleSettingsModal} // Use context trigger
                className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0" // Use rounded-full
                whileHover={{ scale: 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                whileTap={{ scale: 0.95 }}
                title={isSettingsModalOpen ? "Скрыть настройки" : "Настройки URL/Token/Ветки/PR"}
                aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки URL/Token"}
                aria-expanded={isSettingsModalOpen}
            >
                 {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />}
            </motion.button>
        </div>

      {/* Settings Modal Component - Controlled by Context */}
       <SettingsModal
            isOpen={isSettingsModalOpen}
            repoUrl={repoUrl}
            setRepoUrl={handleRepoUrlChange}
            token={token}
            setToken={setToken}
            manualBranchName={manualBranchName}
            setManualBranchName={handleManualBranchChange}
            currentTargetBranch={targetBranchName}
            openPrs={openPrs}
            loadingPrs={loadingPrs}
            onSelectPrBranch={handleSelectPrBranch}
            onLoadPrs={handleLoadPrs}
            loading={isLoading || loadingPrs}
       />

      {/* Fetch Button */}
       <div className="mb-4 flex justify-center">
            <motion.button
                onClick={() => triggerFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error', targetBranchName || manualBranchName || null)} // Pass effective branch to triggerFetch
                disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${
                    fetchStatus === 'failed_retries' || fetchStatus === 'error'
                    ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600'
                    : 'from-purple-600 to-cyan-500'
                 } transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${
                     isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')
                     ? "opacity-60 cursor-not-allowed"
                     : "hover:brightness-110 active:scale-[0.98]"
                 }`}
                whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }}
                whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }}
                title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`}
            >
                 {isLoading ? <FaArrowsRotate className="animate-spin" />
                  : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate />
                  : <FaDownload />)}
                 {fetchStatus === 'retrying' ? "Повтор..."
                  : isLoading ? "Загрузка..."
                  : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова"
                  : "Извлечь файлы")}
                 <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
            </motion.button>
        </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} />
                 {isLoading && !isParsing && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повторная попытка)' : ''}</p>}
                 {isParsing && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                 {fetchStatus === 'success' && files.length > 0 && !isParsing && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно извлечено ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && !isParsing && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, но не найдено подходящих файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && !isParsing && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
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
                            className="form-checkbox h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500/50 focus:ring-offset-gray-800 cursor-pointer"
                            disabled={isActionDisabled}
                        />
                        <label htmlFor="autoAskAiCheckbox" className={`text-xs cursor-pointer select-none ${isActionDisabled ? 'text-gray-500' : 'text-gray-300'}`}>
                           Авто-запрос AI после добавления файлов <span className="text-blue-400">(Add Selected & Ask)</span>
                        </label>
                    </div>
                 )}
                 <FileList
                    id="file-list-container"
                    files={files}
                    selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath}
                    secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles}
                    isLoading={isLoading}
                    toggleFileSelection={toggleFileSelection}
                    onAddSelected={() => handleAddSelected(autoAskAiEnabled)}
                    onAddImportant={handleAddImportantFiles}
                    onAddTree={handleAddFullTree}
                    onSelectHighlighted={selectHighlightedFiles}
                 />
             </div>
         )}

         {/* Right Column: Request Input & AI Trigger */}
         {(fetchStatus === 'success' || kworkInputHasContent || files.length > 0 || (highlightedPathFromUrl && ideaFromUrl) ) ? ( // Show if files fetched OR input has content OR URL params were provided
             <div id="kwork-input-section" className="flex flex-col gap-3">
                 <RequestInput
                      kworkInputRef={localKworkInputRef}
                      onCopyToClipboard={() => handleCopyToClipboard(undefined, true)}
                      onClearAll={handleClearAll}
                      isCopyDisabled={isCopyDisabled}
                      isClearDisabled={isClearDisabled}
                      onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                      onAskAi={triggerAskAi}
                      isAskAiDisabled={isAskAiDisabled}
                      aiActionLoading={aiActionLoading}
                      onAddSelected={() => handleAddSelected(autoAskAiEnabled)}
                      isAddSelectedDisabled={isAddSelectedDisabled}
                      selectedFetcherFilesCount={selectedFiles.size}
                 />
             </div>
         ) : null }

      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;