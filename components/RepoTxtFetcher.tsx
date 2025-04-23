"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Actions & Context
import { fetchRepoContents } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest, ImageReplaceTask } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger"; // Keep client-side logger

// Sub-components
import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList"; // Assumed updated
import SelectedFilesPreview from "./repo/SelectedFilesPreview"; // Assumed updated
import RequestInput from "./repo/RequestInput"; // Assumed updated
import ProgressBar from "./repo/ProgressBar";

// Define FileNode locally
export interface FileNode { path: string; content: string; }
// Define ImportCategory type LOCALLY
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// Helper: Get Language
const getLanguage = (path: string): string => { /* Keep original logic */ const extension = path.split('.').pop()?.toLowerCase(); switch(extension) { case 'ts': case 'tsx': return 'typescript'; case 'js': case 'jsx': return 'javascript'; case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html'; case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql'; case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go'; case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash'; case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext'; } };
// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Helper: categorizeResolvedPath
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => { /* Keep original logic */ if (!resolvedPath) return 'other'; const pathLower = resolvedPath.toLowerCase(); if (pathLower.includes('/contexts/') || pathLower.startsWith('contexts/')) return 'context'; if (pathLower.includes('/hooks/') || pathLower.startsWith('hooks/')) return 'hook'; if (pathLower.includes('/lib/') || pathLower.startsWith('lib/')) return 'lib'; if ((pathLower.includes('/components/') || pathLower.startsWith('components/')) && !pathLower.includes('/components/ui/')) return 'component'; return 'other'; };

// --- Component ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
  // === State ===
  const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });
  // AutoAskAI state removed

  // === Context ===
   const { fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched, setSelectedFetcherFiles, kworkInputHasContent, setKworkInputHasContent, setRequestCopied, aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing, currentAiRequestId, targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs, setOpenPrs, setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal, kworkInputRef, triggerAskAi, triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection, setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles, imageReplaceTask, allFetchedFiles, setAllFetchedFiles } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
   const searchParams = useSearchParams();
   const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
   const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
   const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
   const DEFAULT_TASK_IDEA = "Проанализируй предоставленный контекст кода. Опиши его основные функции и предложи возможные улучшения или рефакторинг.";
   const importantFiles = useMemo(() => [ "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx", "hooks/supabase.ts", "app/actions.ts", "app/ai_actions/actions.ts", "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts" ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSelectedFilesRef = useRef<Set<string>>(new Set());
  useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);

  // === Utility Functions ===
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => { /* Keep original toast */ let style = { background: "rgba(50, 50, 50, 0.9)", color: "#E1FF01", border: "1px solid rgba(225, 255, 1, 0.2)", backdropFilter: "blur(3px)" }; if (type === 'success') style = { background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(3px)" }; else if (type === 'error') style = { background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(3px)" }; else if (type === 'warning') style = { background: "rgba(217, 119, 6, 0.9)", color: "#ffffff", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(3px)" }; toast(message, { style: style, duration: type === 'error' ? 5000 : (type === 'warning' ? 4000 : 3000 ) }); }, []);
   const getPageFilePath = useCallback((routePath: string, allActualFilePaths: string[]): string | null => { /* Keep original */ const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath; if (!cleanPath || cleanPath === 'app' || cleanPath === '/') { const r=['app/page.tsx','app/page.js','src/app/page.tsx','src/app/page.js']; for(const p of r) if(allActualFilePaths.includes(p)) return p; return null; } const pwa = cleanPath.startsWith('app/') ? cleanPath : cleanPath.startsWith('src/app/') ? cleanPath : `app/${cleanPath}`; if (allActualFilePaths.includes(pwa)) return pwa; const pdp = [`${pwa}/page.tsx`, `${pwa}/page.js`, `${pwa}/index.tsx`, `${pwa}/index.js`]; for(const p of pdp) if(allActualFilePaths.includes(p)) return p; const inS = pwa.split('/'); const nIS = inS.length; const pF = allActualFilePaths.filter(p=>(p.startsWith('app/')||p.startsWith('src/app/'))&&(p.endsWith('/page.tsx')||p.endsWith('/page.js')||p.endsWith('/index.tsx')||p.endsWith('/index.js'))); for(const aP of pF){ const sfx=['/page.tsx','/page.js','/index.tsx','/index.js'].find(s=>aP.endsWith(s)); if(!sfx) continue; const aPB=aP.substring(0,aP.length-sfx.length); const aS=aPB.split('/'); if(aS.length!==nIS) continue; let iDM=true; for(let i=0; i<nIS; i++){ const iS=inS[i]; const aSg=aS[i]; if(iS===aSg) continue; else if (aSg.startsWith('[')&&aSg.endsWith(']')) continue; else {iDM=false; break;} } if(iDM) return aP; } return null; }, []);
   const extractImports = useCallback((content: string): string[] => { /* Keep original */ const r1 = /import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const r2 = /require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const i = new Set<string>(); let m; while ((m = r1.exec(content)) !== null) if (m[1] && m[1] !== '.') i.add(m[1]); while ((m = r2.exec(content)) !== null) if (m[1] && m[1] !== '.') i.add(m[1]); return Array.from(i); }, []);
   const resolveImportPath = useCallback((importPath: string, currentFilePath: string, allFileNodes: FileNode[]): string | null => { /* Keep original */ const allP = allFileNodes.map(f => f.path); const supExt = ['.ts','.tsx','.js','.jsx','.css','.scss','.sql','.md']; const tryP = (bP: string): string | null => { const pTT: string[] = []; const hEE = /\.\w+$/.test(bP); if(hEE) pTT.push(bP); else { supExt.forEach(e => pTT.push(bP + e)); supExt.forEach(e => pTT.push(`${bP}/index${e}`)); } for(const p of pTT) if(allP.includes(p)) return p; return null; }; if(importPath.startsWith('@/')) { const pSB = ['src/','app/','']; const pS = importPath.substring(2); for(const b of pSB) { const r=tryP(b+pS); if(r) return r; } const cAR = ['components/','lib/','utils/','hooks/','contexts/','styles/']; for(const rt of cAR) if(pS.startsWith(rt)){ const r=tryP(pS); if(r) return r; } } else if(importPath.startsWith('.')) { const cD = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : ''; const pP = (cD ? cD + '/' + importPath : importPath).split('/'); const rP: string[] = []; for(const pt of pP) { if(pt === '.' || pt === '') continue; if(pt === '..') { if(rP.length > 0) rP.pop(); } else rP.push(pt); } const rRB = rP.join('/'); const r = tryP(rRB); if(r) return r; } else { const sB = ['lib/','utils/','components/','hooks/','contexts/','styles/','src/lib/','src/utils/','src/components/','src/hooks/','src/contexts/','src/styles/']; for(const b of sB) { const r = tryP(b + importPath); if(r) return r; } } return null; }, []);

  // --- Enhanced Progress Simulation ---
  const stopProgressSimulation = useCallback(() => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); progressIntervalRef.current = null; fetchTimeoutRef.current = null; }, []);
  const startProgressSimulation = useCallback((estimatedDurationSeconds = 20) => {
      stopProgressSimulation(); setProgress(0); setError(null);
      const intervalTime = 150; // Update frequency
      const steps = (estimatedDurationSeconds * 1000) / intervalTime;
      let currentStepSim = 0;

      progressIntervalRef.current = setInterval(() => {
          setProgress((prev) => {
              currentStepSim++;
              const progressRatio = currentStepSim / steps;

              // Ease-in-out curve: starts slow, accelerates, ends slow
              // Sigmoid-like function or polynomial ease
              let easeFactor = 0.5 * (1 - Math.cos(progressRatio * Math.PI)); // Simple ease-in-out

              // Introduce more subtle jitter
              const jitter = (Math.random() - 0.5) * 0.05; // Smaller random factor
              let targetProgress = Math.min(easeFactor + jitter, 1) * 100;

              // Adjust speed based on fetch status and progress point
              let currentProgress = prev;
              let increment = (targetProgress - prev) * (Math.random() * 0.4 + 0.6); // Vary the step size

              // Slow down significantly near the end, especially during loading/retrying
              if (prev > 85 && (fetchStatus === 'loading' || fetchStatus === 'retrying')) {
                  increment *= 0.2; // Much smaller steps
              } else if (prev > 70) {
                  increment *= 0.5; // Moderately smaller steps
              }

              currentProgress += increment;

              // Cap progress realistically based on status
              if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                  currentProgress = Math.min(currentProgress, 95); // Don't let it hit 100 prematurely
              } else {
                   currentProgress = Math.min(currentProgress, 99.9); // Allow reaching near 100 if not loading
              }

              // Ensure progress doesn't go backwards or below 0
              return Math.max(0, currentProgress);
          });
      }, intervalTime);

      fetchTimeoutRef.current = setTimeout(() => {
          if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current); progressIntervalRef.current = null;
              if (fetchStatus === 'loading' || fetchStatus === 'retrying') {
                  logger.warn("Progress simulation timed out while loading.");
                  setProgress(96); // Settle slightly higher if timed out
              }
          }
          fetchTimeoutRef.current = null;
      }, estimatedDurationSeconds * 1000 + 10000); // Longer timeout buffer
  }, [stopProgressSimulation, fetchStatus]);


  // === Core Logic Callbacks ===
  const handleRepoUrlChange = useCallback((url: string) => { setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName(""); }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);
  const updateKworkInput = useCallback((value: string) => { if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { logger.warn("DEBUG: localKworkInputRef is null in updateKworkInput"); } }, [setKworkInputHasContent]);
  const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);
  // Add Selected Files (No Auto Ask AI)
  const handleAddSelected = useCallback(async (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => { const filesToProcess = allFilesParam || files; const filesToAdd = filesToAddParam || selectedFiles; if (filesToProcess.length === 0 && filesToAdd.size > 0) { addToast("Ошибка: Файлы не загружены.", 'error'); return; } if (filesToAdd.size === 0) { addToast("Сначала выберите файлы.", 'warning'); return; } const prefix = "Контекст кода для анализа:\n"; const markdownTxt = filesToProcess.filter((f) => filesToAdd.has(f.path)).sort((a, b) => a.path.localeCompare(b.path)).map((f) => { const pC = `// /${f.path}`; const cAHC = f.content.trimStart().startsWith(pC); const cTA = cAHC ? f.content : `${pC}\n${f.content}`; return `\`\`\`${getLanguage(f.path)}\n${cTA}\n\`\`\``; }).join("\n\n"); const curVal = getKworkInputValue(); const ctxRgx = /Контекст кода для анализа:[\s\S]*/; const taskTxt = curVal.replace(ctxRgx, '').trim(); const newCtx = `${taskTxt ? taskTxt + '\n\n' : ''}${prefix}${markdownTxt}`; updateKworkInput(newCtx); addToast(`${filesToAdd.size} файлов добавлено`, 'success'); scrollToSection('kworkInput'); }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection]); // No AI deps
  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => { const c = textToCopy ?? getKworkInputValue(); if(!c.trim()){addToast("Нет текста для копирования", 'warning'); return false;} try{navigator.clipboard.writeText(c); addToast("Запрос скопирован!", 'success'); setRequestCopied(true); if(shouldScroll) scrollToSection('executor'); return true;}catch(e){logger.error("Copy fail:",e); addToast("Ошибка копирования", 'error'); return false;} }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);
  const handleClearAll = useCallback(() => { logger.log("Clearing Fetcher state."); setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); updateKworkInput(""); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setRequestCopied(false); addToast("Ввод и выбор очищены ✨", 'success'); if (localKworkInputRef.current) localKworkInputRef.current.focus(); }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied ]);

  // --- Fetch Handler (Improved Robustness) ---
  const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => { /* Keep full handleFetch logic from previous response */ const effectiveBranch = branchNameToFetch || targetBranchName || manualBranchName || 'default'; logger.log(`[Fetcher:handleFetch] Triggered. Retry: ${isManualRetry}, Branch: ${effectiveBranch}, Status: ${fetchStatus}`); if (!repoUrl.trim()) { logger.error("[Fetcher] Repo URL empty."); addToast("Введите URL репозитория", 'error'); setError("URL репозитория не может быть пустым."); triggerToggleSettingsModal(); return; } if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) { logger.warn("[Fetcher] Fetch already in progress."); addToast("Извлечение уже идет...", "info"); return; } if (assistantLoading || isParsing || aiActionLoading) { logger.warn(`[Fetcher] Blocked by conflicting state.`); addToast("Подождите завершения.", "warning"); return; } logger.log("[Fetcher] Proceeding with fetch."); setFetchStatus('loading'); setError(null); setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAllFetchedFiles([]); setSelectedFetcherFiles(new Set()); setFilesFetched(false, [], null, []); setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); if (!imageReplaceTask && !highlightedPathFromUrl && localKworkInputRef.current) { updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA); } else if (imageReplaceTask && localKworkInputRef.current) { updateKworkInput(""); } addToast(`Запрос репозитория (${effectiveBranch})...`, 'info'); startProgressSimulation(30); logger.log("[Fetcher] Progress simulation started."); let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null; let success = false; try { logger.info(`[Fetcher] Calling fetchRepoContents - Branch: ${effectiveBranch}`); result = await fetchRepoContents(repoUrl, token || undefined, effectiveBranch); logger.info(`[Fetcher] fetchRepoContents result: Success=${result?.success}, Files=${result?.files?.length ?? 'N/A'}, Error=${result?.error ?? 'None'}`); if (result?.success && Array.isArray(result.files)) { success = true; stopProgressSimulation(); setProgress(100); setFetchStatus('success'); const fetchedFiles = result.files; addToast(`Извлечено ${fetchedFiles.length} файлов из ${effectiveBranch}!`, 'success'); setFiles(fetchedFiles); setAllFetchedFiles(fetchedFiles); if (isSettingsModalOpen) triggerToggleSettingsModal(); const allActualFilePaths = fetchedFiles.map(f => f.path); let primaryPathForHighlight: string | null = null; const catSecPaths: Record<ImportCategory, Set<string>> = { component: new Set(), context: new Set(), hook: new Set(), lib: new Set(), other: new Set() }; let filesToAutoSelect = new Set<string>(); if (imageReplaceTask) { primaryPathForHighlight = imageReplaceTask.targetPath; if (!allActualFilePaths.includes(primaryPathForHighlight)) { const imgError = `Целевой файл (${primaryPathForHighlight}) не найден в ветке '${effectiveBranch}'.`; logger.error(`[Fetcher] ${imgError}`); setError(imgError); addToast(imgError, 'error'); setFilesFetched(true, fetchedFiles, null, []); setFetchStatus('error'); success = false; } else { filesToAutoSelect.add(primaryPathForHighlight); logger.log(`[Fetcher] Auto-selecting image target: ${primaryPathForHighlight}`); setSelectedFetcherFiles(filesToAutoSelect); } } else if (highlightedPathFromUrl) { primaryPathForHighlight = getPageFilePath(highlightedPathFromUrl, allActualFilePaths); if (primaryPathForHighlight) { const pageFile = fetchedFiles.find((f) => f.path === primaryPathForHighlight); if (pageFile) { filesToAutoSelect.add(primaryPathForHighlight); const rawImports = extractImports(pageFile.content); for (const imp of rawImports) { const rP = resolveImportPath(imp, pageFile.path, fetchedFiles); if (rP && rP !== primaryPathForHighlight) { const cat = categorizeResolvedPath(rP); catSecPaths[cat].add(rP); if (cat !== 'other') filesToAutoSelect.add(rP); } } logger.log(`[Fetcher] Highlighted ${primaryPathForHighlight}, auto-selected ${filesToAutoSelect.size} files.`); } else { primaryPathForHighlight = null; addToast(`Ошибка: Путь (${primaryPathForHighlight}) не найден.`, 'error'); } } else { addToast(`Файл для URL (${highlightedPathFromUrl}) не найден в '${effectiveBranch}'.`, 'warning'); } } if (!imageReplaceTask) { importantFiles.forEach(p => { if (allActualFilePaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); logger.log(`[Fetcher] Auto-selecting important: ${p}`); } }); } setPrimaryHighlightedPathState(primaryPathForHighlight); const finalSecPathsState = { component: Array.from(catSecPaths.component), context: Array.from(catSecPaths.context), hook: Array.from(catSecPaths.hook), lib: Array.from(catSecPaths.lib), other: Array.from(catSecPaths.other) }; setSecondaryHighlightedPathsState(finalSecPathsState); if (!imageReplaceTask) { setSelectedFilesState(filesToAutoSelect); setSelectedFetcherFiles(filesToAutoSelect); } setFilesFetched(true, fetchedFiles, primaryPathForHighlight, Object.values(finalSecPathsState).flat()); logger.log("[Fetcher] setFilesFetched called."); if (imageReplaceTask && primaryPathForHighlight) { addToast(`Авто-выбор для замены: ${primaryPathForHighlight}`, 'info'); } else if (highlightedPathFromUrl && ideaFromUrl && filesToAutoSelect.size > 0) { const numS = catSecPaths.component.size + catSecPaths.context.size + catSecPaths.hook.size + catSecPaths.lib.size; const numI = filesToAutoSelect.size - (primaryPathForHighlight ? 1 : 0) - numS; let msg = `✅ Авто-выбор: `; const pts = []; if(primaryPathForHighlight) pts.push(`1 страница`); if(numS > 0) pts.push(`${numS} связанных`); if(numI > 0) pts.push(`${numI} важных`); msg += pts.join(', ') + ` (${filesToAutoSelect.size} всего). Идея добавлена.`; addToast(msg, 'success'); const task = ideaFromUrl || DEFAULT_TASK_IDEA; updateKworkInput(task); await handleAddSelected(filesToAutoSelect, fetchedFiles); setTimeout(() => { addToast("💡 Добавь инструкции!", "info"); }, 500); } else if (!imageReplaceTask) { if (filesToAutoSelect.size > 0) { const numH = catSecPaths.component.size + catSecPaths.context.size + catSecPaths.hook.size + catSecPaths.lib.size; const numI = filesToAutoSelect.size - (primaryPathForHighlight ? 1 : 0) - numH; let msg = `Авто-выбрано: `; const pts = []; if(primaryPathForHighlight) pts.push(`1 основной`); if(numH > 0) pts.push(`${numH} связанных`); if(numI > 0) pts.push(`${numI} важных`); msg += pts.join(', ') + '.'; addToast(msg, 'info'); } if (primaryPathForHighlight) { setTimeout(() => { const elId = `file-${primaryPathForHighlight}`; const el = document.getElementById(elId); if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md','transition-all','duration-1000'); setTimeout(()=>el.classList.remove('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md','transition-all','duration-1000'),2500); } }, 400); } else if (fetchedFiles.length > 0) { const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); } } } else { logger.error(`[Fetcher] fetchRepoContents FAILED. Error: ${result?.error}`); throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}.`); } } catch (err: any) { logger.error(`[Fetcher] Error during handleFetch: ${err.message}`, err); const displayError = err?.message || "Неизвестная ошибка"; stopProgressSimulation(); setProgress(0); setError(displayError); setFetchStatus('error'); addToast(`Ошибка извлечения: ${displayError}`, 'error'); setFilesFetched(false, [], null, []); success = false; } if (!success && fetchStatus !== 'error') { setFetchStatus('error'); } logger.log(`[Fetcher:handleFetch] Finished. Success: ${success}, Status: ${fetchStatus}`); }, [ /* Keep ALL previous dependencies */ repoUrl, token, fetchStatus, imageReplaceTask, assistantLoading, isParsing, aiActionLoading, repoUrlEntered, setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setAllFetchedFiles, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetched, setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA, addToast, startProgressSimulation, stopProgressSimulation, getLanguage, getPageFilePath, extractImports, resolveImportPath, categorizeResolvedPath, handleAddSelected, getKworkInputValue, scrollToSection, setKworkInputHasContent, isSettingsModalOpen, triggerToggleSettingsModal, updateKworkInput, triggerAskAi, localKworkInputRef, manualBranchName, targetBranchName ]);

  // --- Other Callbacks ---
  const selectHighlightedFiles = useCallback(() => { /* Keep original logic */ const filesToSelect = new Set<string>(selectedFiles); let newlySelectedCount = 0; const allHLS = [ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib, ]; if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath) && !filesToSelect.has(primaryHighlightedPath)) { filesToSelect.add(primaryHighlightedPath); newlySelectedCount++; } allHLS.forEach(p => { if (files.some(f => f.path === p) && !filesToSelect.has(p)) { filesToSelect.add(p); newlySelectedCount++; } }); if (newlySelectedCount > 0) { setSelectedFilesState(filesToSelect); setSelectedFetcherFiles(filesToSelect); addToast(`${newlySelectedCount} связанных файлов добавлено`, 'info'); } else { addToast("Все связанные файлы уже выбраны", 'info'); } }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);
  const toggleFileSelection = useCallback((path: string) => { setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if(newSet.has(path)){ newSet.delete(path); }else{ newSet.add(path); } if (selectionUpdateTimeoutRef.current) clearTimeout(selectionUpdateTimeoutRef.current); selectionUpdateTimeoutRef.current = setTimeout(() => { setSelectedFetcherFiles(new Set(newSet)); selectionUpdateTimeoutRef.current = null; }, 150); return newSet; }); }, [setSelectedFetcherFiles]);
  const handleAddImportantFiles = useCallback(() => { /* Keep original */ let addedCount = 0; const filesToAdd = new Set(selectedFiles); importantFiles.forEach(p => { if (files.some(f => f.path === p) && !selectedFiles.has(p)) { filesToAdd.add(p); addedCount++; } }); if (addedCount === 0) { addToast("Важные файлы уже выбраны", 'info'); return; } setSelectedFilesState(filesToAdd); setSelectedFetcherFiles(filesToAdd); addToast(`Добавлено ${addedCount} важных файлов`, 'success'); }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);
  const handleAddFullTree = useCallback(() => { /* Keep original */ if (files.length === 0) { addToast("Нет файлов", 'warning'); return; } const treeOnly = files.map((f) => `- /${f.path}`).sort().join("\n"); const treeContent = `Структура файлов проекта:\n\`\`\`\n${treeOnly}\n\`\`\``; let added = false; const curVal = getKworkInputValue(); const trimVal = curVal.trim(); const hasTree = /Структура файлов проекта:\s*```/im.test(trimVal); if (!hasTree) { const newCtx = trimVal ? `${trimVal}\n\n${treeContent}` : treeContent; updateKworkInput(newCtx); added = true; } if (added) { addToast("Дерево файлов добавлено", 'success'); scrollToSection('kworkInput'); } else { addToast("Дерево уже добавлено", 'info'); } }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast]);
  const handleSelectPrBranch = useCallback((branch: string | null) => { setTargetBranchName(branch); if (branch) addToast(`Ветка PR: ${branch}`, 'success'); else addToast(`Выбор ветки PR снят.`, 'info'); }, [setTargetBranchName, addToast]);
  const handleManualBranchChange = useCallback((name: string) => { setManualBranchName(name); }, [setManualBranchName]);
  const handleLoadPrs = useCallback(() => { triggerGetOpenPRs(repoUrl); }, [triggerGetOpenPRs, repoUrl]);

  // --- Effects ---
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl); }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]);
  useEffect(() => { const branch = targetBranchName || manualBranchName || null; if (autoFetch && repoUrl && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error')) { handleFetch(false, branch); } }, [repoUrl, autoFetch, fetchStatus, targetBranchName, manualBranchName, imageReplaceTask, handleFetch]);
  useEffect(() => { /* Keep auto-select related files effect */ if (files.length === 0 || imageReplaceTask || fetchStatus !== 'success') { prevSelectedFilesRef.current = new Set(selectedFiles); return; } const newSelPaths = new Set<string>(); selectedFiles.forEach(p => { if (!prevSelectedFilesRef.current.has(p)) { newSelPaths.add(p); } }); if (primaryHighlightedPath && selectedFiles.has(primaryHighlightedPath) && !prevSelectedFilesRef.current.has(primaryHighlightedPath) && !newSelPaths.has(primaryHighlightedPath)) { newSelPaths.add(primaryHighlightedPath); } if (newSelPaths.size === 0) { prevSelectedFilesRef.current = new Set(selectedFiles); return; } const pgSuffixes = ['/page.tsx', '/page.js', '/index.tsx', '/index.js']; const filesToCheck = Array.from(newSelPaths).filter(p => pgSuffixes.some(s => p.endsWith(s)) || p === primaryHighlightedPath); if (filesToCheck.length > 0) { const relatedToSel = new Set<string>(); let foundCount = 0; filesToCheck.forEach(fp => { const fNode = files.find(f => f.path === fp); if (fNode) { const imps = extractImports(fNode.content); imps.forEach(imp => { const rP = resolveImportPath(imp, fNode.path, files); if (rP && rP !== fp) { const cat = categorizeResolvedPath(rP); if (cat !== 'other') { if (!selectedFiles.has(rP)) { relatedToSel.add(rP); foundCount++; } } } }); } }); if (relatedToSel.size > 0) { const finalSel = new Set([...selectedFiles, ...relatedToSel]); setSelectedFilesState(finalSel); setSelectedFetcherFiles(finalSel); addToast(`🔗 Авто-добавлено ${foundCount} связанных`, 'info'); prevSelectedFilesRef.current = finalSel; return; } } prevSelectedFilesRef.current = new Set(selectedFiles); }, [selectedFiles, files, fetchStatus, primaryHighlightedPath, extractImports, resolveImportPath, categorizeResolvedPath, setSelectedFetcherFiles, addToast, imageReplaceTask]);
  useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);

  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({ handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll: handleClearAll, getKworkInputValue }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);

  // --- Render Logic ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading;
  const showProgressBar = fetchStatus === 'loading' || fetchStatus === 'retrying' || fetchStatus === 'success' || fetchStatus === 'error' || fetchStatus === 'failed_retries';
  const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!imageReplaceTask;
  const isAskAiDisabled = !kworkInputHasContent || isActionDisabled || !!imageReplaceTask;
  const isCopyDisabled = !kworkInputHasContent || isActionDisabled || !!imageReplaceTask;
  const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled || !!imageReplaceTask;
  const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled || !!imageReplaceTask;
  const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
  const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Header */}
       <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
            <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2"> <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода </h2>
                 {!imageReplaceTask && ( <> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Настрой URL/токен/ветку (<FaCodeBranch className="inline text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Жми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы для контекста.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-2">4. Опиши задачу ИЛИ добавь файлы (<FaPlus className="inline text-sm"/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Жми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.</p> </> )}
                 {imageReplaceTask && ( <p className="text-blue-300/80 text-xs md:text-sm mb-2">Загрузка файла для замены картинки...</p> )}
            </div>
            <motion.button onClick={triggerToggleSettingsModal} disabled={isLoading || loadingPrs || assistantLoading || aiActionLoading} whileHover={{ scale: (isLoading || loadingPrs || assistantLoading || aiActionLoading) ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }} whileTap={{ scale: (isLoading || loadingPrs || assistantLoading || aiActionLoading) ? 1 : 0.95 }} title={isSettingsModalOpen ? "Скрыть" : "Настройки"} aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"} aria-expanded={isSettingsModalOpen} className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"> {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />} </motion.button>
        </div>

      {/* Settings Modal */}
       <SettingsModal isOpen={isSettingsModalOpen} repoUrl={repoUrl} setRepoUrl={handleRepoUrlChange} token={token} setToken={setToken} manualBranchName={manualBranchName} setManualBranchName={handleManualBranchChange} currentTargetBranch={targetBranchName} openPrs={openPrs} loadingPrs={loadingPrs} onSelectPrBranch={handleSelectPrBranch} onLoadPrs={handleLoadPrs} loading={isLoading || loadingPrs || assistantLoading || aiActionLoading} />

      {/* Fetch Button */}
       <div className="mb-4 flex justify-center">
            <motion.button onClick={() => { handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error'); }} disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${(isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`} whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }} whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }} title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`}> {isLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)} {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")} <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span> </motion.button>
        </div>

      {/* Progress Bar & Status Area */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={fetchStatus === 'success' ? 100 : (fetchStatus === 'error' || fetchStatus === 'failed_retries' ? 0 : progress)} />
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                 {isParsing && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа...</p>}
                 {fetchStatus === 'success' && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, 0 файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && imageReplaceTask && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Файл ${imageReplaceTask.targetPath.split('/').pop()} загружен.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}

      {/* Main Content Area (Grid) */}
       <div className={`grid grid-cols-1 ${ (files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>
         {/* Left Column: File List & Controls */}
         {(isLoading || files.length > 0) && (
             <div className="flex flex-col gap-4">
                <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} />
                {/* Auto Ask AI Checkbox Removed */}
                 <FileList
                    id="file-list-container" files={files} selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath} secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles} isLoading={isLoading} isActionDisabled={isActionDisabled}
                    toggleFileSelection={toggleFileSelection} onAddSelected={() => handleAddSelected()}
                    onAddImportant={handleAddImportantFiles} onAddTree={handleAddFullTree} onSelectHighlighted={selectHighlightedFiles}
                 />
             </div>
         )}
         {/* Right Column: Request Input & AI Trigger */}
         {(files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? (
             <div id="kwork-input-section" className="flex flex-col gap-3">
                 <RequestInput
                      kworkInputRef={localKworkInputRef}
                      onCopyToClipboard={() => handleCopyToClipboard(undefined, true)}
                      onClearAll={handleClearAll}
                      isCopyDisabled={isCopyDisabled} isClearDisabled={isClearDisabled}
                      onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                      onAskAi={triggerAskAi} isAskAiDisabled={isAskAiDisabled} aiActionLoading={aiActionLoading}
                      onAddSelected={() => handleAddSelected()} isAddSelectedDisabled={isAddSelectedDisabled}
                      selectedFetcherFilesCount={selectedFiles.size}
                 />
             </div>
         ) : null }
         {/* Placeholder for Image Replace Task */}
         {imageReplaceTask && fetchStatus === 'success' && files.length > 0 && (
            <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed border-blue-400 min-h-[200px]`}>
                 {(assistantLoading || aiActionLoading) ? ( <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" /> ) : ( <FaCircleCheck className="text-green-400 text-3xl mb-3" /> )}
                <p className="text-sm text-blue-300"> {(assistantLoading || aiActionLoading) ? "Обработка замены..." : `Файл ${imageReplaceTask.targetPath.split('/').pop()} готов.`} </p>
                <p className="text-xs text-gray-400 mt-1"> {(assistantLoading || aiActionLoading) ? "Создание/обновление PR..." : "Перехожу к созданию PR..."} </p>
            </div>
         )}
      </div> {/* End Grid */}
    </div> // End Component Root
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;