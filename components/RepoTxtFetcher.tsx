"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner, FaListCheck, FaSquareXmark,
    FaHighlighter, FaKey, FaTree, FaImages // Added FaImages
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Действия и Контекст
// Added getOpenPullRequests import
import { fetchRepoContents, getOpenPullRequests } from "@/app/actions_github/actions";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest, ImageReplaceTask } from "@/contexts/RepoXmlPageContext";
import { debugLogger as logger } from "@/lib/debugLogger"; // Using debug logger

// Суб-компоненты
import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";

// Локальное определение FileNode
export interface FileNode { path: string; content: string; }
// Локальное определение типа ImportCategory
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// --- Вспомогательные функции (без изменений) ---
const getLanguage = (path: string): string => { const e=path.split('.').pop()?.toLowerCase(); switch(e){ case 'ts': case 'tsx': return 'typescript'; case 'js': case 'jsx': return 'javascript'; case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html'; case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql'; case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go'; case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash'; case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext'; } };
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => { if(!resolvedPath) return 'other'; const pL=resolvedPath.toLowerCase(); if(pL.includes('/contexts/')||pL.startsWith('contexts/')) return 'context'; if(pL.includes('/hooks/')||pL.startsWith('hooks/')) return 'hook'; if(pL.includes('/lib/')||pL.startsWith('lib/')) return 'lib'; if((pL.includes('/components/')||pL.startsWith('components/'))&&!pL.includes('/components/ui/')) return 'component'; return 'other'; };
const extractImports = (c:string):string[]=>{ const r1=/import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const r2=/require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const i=new Set<string>(); let m; while((m=r1.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); while((m=r2.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); return Array.from(i);};
const resolveImportPath = (iP:string, cFP:string, aFN:FileNode[]):string|null=>{ const aP=aFN.map(f=>f.path); const sE=['.ts','.tsx','.js','.jsx','.css','.scss','.sql','.md']; const tryP=(bP:string):string|null=>{const pTT:string[]=[]; const hEE=/\.\w+$/.test(bP); if(hEE)pTT.push(bP); else{sE.forEach(e=>pTT.push(bP+e)); sE.forEach(e=>pTT.push(`${bP}/index${e}`));} for(const p of pTT)if(aP.includes(p))return p; return null;}; if(iP.startsWith('@/')){const pSB=['src/','app/','']; const pS=iP.substring(2); for(const b of pSB){const r=tryP(b+pS); if(r)return r;} const cAR=['components/','lib/','utils/','hooks/','contexts/','styles/']; for(const rt of cAR)if(pS.startsWith(rt)){const r=tryP(pS); if(r)return r;}}else if(iP.startsWith('.')){const cD=cFP.includes('/')?cFP.substring(0,cFP.lastIndexOf('/')):''; const pP=(cD?cD+'/'+iP:iP).split('/'); const rP:string[]=[]; for(const pt of pP){if(pt==='.'||pt==='')continue; if(pt==='..'){if(rP.length>0)rP.pop();}else rP.push(pt);} const rRB=rP.join('/'); const r=tryP(rRB); if(r)return r;}else{const sB=['lib/','utils/','components/','hooks/','contexts/','styles/','src/lib/','src/utils/','src/components/','src/hooks/','src/contexts/','src/styles/']; for(const b of sB){const r=tryP(b+iP); if(r)return r;}} return null;};
const getPageFilePath = (rP:string, aP:string[]):string|null=>{ const cP=rP.startsWith('/')?rP.substring(1):rP; if(!cP||cP==='app'||cP==='/'){ const rPs=['app/page.tsx','app/page.js','src/app/page.tsx','src/app/page.js']; for(const rp of rPs) if(aP.includes(rp)) return rp; return null; } const pwa=cP.startsWith('app/')?cP:cP.startsWith('src/app/')?cP:`app/${cP}`; if(aP.includes(pwa)) return pwa; const pDP=[`${pwa}/page.tsx`,`${pwa}/page.js`,`${pwa}/index.tsx`,`${pwa}/index.js`]; for(const p of pDP) if(aP.includes(p)) return p; const iS=pwa.split('/'); const nIS=iS.length; const pF=aP.filter(p=>(p.startsWith('app/')||p.startsWith('src/app/'))&&(p.endsWith('/page.tsx')||p.endsWith('/page.js')||p.endsWith('/index.tsx')||p.endsWith('/index.js'))); for(const acP of pF){ const sfx=['/page.tsx','/page.js','/index.tsx','/index.js'].find(s=>acP.endsWith(s)); if(!sfx) continue; const aPB=acP.substring(0,acP.length-sfx.length); const aS=aPB.split('/'); if(aS.length!==nIS) continue; let iDM=true; for(let i=0;i<nIS;i++){ const iSeg=iS[i]; const aSeg=aS[i]; if(iSeg===aSeg) continue; else if(aSeg.startsWith('[')&&aSeg.endsWith(']')) continue; else { iDM=false; break; }} if(iDM) return acP; } return null; };

// --- Компонент ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
  // === Состояние компонента ===
  const [isMounted, setIsMounted] = useState(false);
  const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set()); // UI state
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] });

  // === Контекст ===
   const {
      fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched: setFilesFetchedCombined,
      selectedFetcherFiles, // CONTEXT selection state
      setSelectedFetcherFiles, // Context setter
      kworkInputHasContent, setKworkInputHasContent, setRequestCopied,
      aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing, currentAiRequestId, // <<< Ensure these are destructured
      targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs, setOpenPrs,
      setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal, kworkInputRef, triggerAskAi, // <<< Ensure triggerToggleSettingsModal is destructured
      triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection,
      setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles, imageReplaceTask, // Keep imageReplaceTask from context
      allFetchedFiles, // Keep allFetchedFiles from context
      assistantRef // Get assistant ref for the effect
   } = useRepoXmlPageContext();

  // === Параметры URL и производное состояние ===
   const searchParams = useSearchParams();
   const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
   const ideaFromUrl = useMemo(() => { // Only decode if not image task
        const idea = searchParams.get("idea");
        return idea && !decodeURIComponent(idea).startsWith("ImageReplace|") ? decodeURIComponent(idea) : "";
    }, [searchParams]);
   // Use imageReplaceTask from context directly
   const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
   const DEFAULT_TASK_IDEA = "Set the vibe! Проанализируй код, предложи улучшения и креативные идеи.";
   const importantFiles = useMemo(() => [
        "contexts/AppContext.tsx", "contexts/RepoXmlPageContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx",
        "app/repo-xml/page.tsx", "components/RepoTxtFetcher.tsx", "components/AICodeAssistant.tsx", "components/AutomationBuddy.tsx",
        "components/repo/prompt.ts", "hooks/supabase.ts", "app/actions.ts", "app/actions_github/actions.ts",
        "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts",
    ], []);

  // === Рефы ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const prevSelectedFilesRef = useRef<Set<string>>(new Set());
  const isImageTaskFetchInitiated = useRef(false);
  const isAutoFetchingRef = useRef(false);
  const fetchStatusRef = useRef(fetchStatus);

  // === Эффекты ===
  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);
  useEffect(() => { fetchStatusRef.current = fetchStatus; }, [fetchStatus]);
  useEffect(() => {
      // Update context state when local URL changes
      if (isMounted) {
           setRepoUrlEntered(repoUrl.trim().length > 0);
           // --- Safer call to updateRepoUrlInAssistant ---
           if (assistantRef.current?.updateRepoUrl) {
               updateRepoUrlInAssistant(repoUrl);
           } else {
               // Log if the ref isn't ready yet (might happen on initial mount)
               logger.warn("[RepoTxtFetcher URL Effect] assistantRef not ready when URL changed.");
               // Consider delaying or retrying if this is critical path, but for now, just log.
           }
           // --- End safer call ---
           setOpenPrs([]);
           setTargetBranchName(null);
           setManualBranchName("");
      }
     // Add assistantRef and updateRepoUrlInAssistant to dependency array
    }, [isMounted, repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName, assistantRef, logger]); // <-- Added assistantRef, logger
  useEffect(() => { return () => stopProgressSimulation(); }, []);
  useEffect(() => { setSelectedFilesState(selectedFetcherFiles); }, [selectedFetcherFiles]); // Sync local UI state from context

  // === Утилиты и Колбэки ===
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => { /* ... toast logic ... */ let s={background:"rgba(50,50,50,0.9)",color:"#E1FF01",border:"1px solid rgba(225,255,1,0.2)",backdropFilter:"blur(3px)"}; if(type==='success')s={background:"rgba(22,163,74,0.9)",color:"#fff",border:"1px solid rgba(34,197,94,0.3)",backdropFilter:"blur(3px)"}; else if(type==='error')s={background:"rgba(220,38,38,0.9)",color:"#fff",border:"1px solid rgba(239,68,68,0.3)",backdropFilter:"blur(3px)"}; else if(type==='warning')s={background:"rgba(217,119,6,0.9)",color:"#fff",border:"1px solid rgba(245,158,11,0.3)",backdropFilter:"blur(3px)"}; toast(message,{style:s,duration:type==='error'?5000:(type==='warning'?4000:3000)}); }, []);
  const updateKworkInput = useCallback((value: string) => { if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { logger.warn("localKworkInputRef is null"); } }, [setKworkInputHasContent, logger]);
  const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);
  const stopProgressSimulation = useCallback(() => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }, []);
  const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => { stopProgressSimulation(); setProgress(0); setError(null); const startTime = Date.now(); const totalDurationMs = estimatedDurationSeconds * 1000; const intervalTime = 100; logger.log(`[ProgressSim] Starting simulation (${estimatedDurationSeconds}s).`); progressIntervalRef.current = setInterval(() => { const elapsedTime = Date.now() - startTime; const calculatedProgress = Math.min((elapsedTime / totalDurationMs) * 100, 100); setProgress(calculatedProgress); const currentFetchStatus = fetchStatusRef.current; if (currentFetchStatus === 'success' || currentFetchStatus === 'error' || currentFetchStatus === 'failed_retries') { logger.log(`[ProgressSim] Status (${currentFetchStatus}) changed, stopping sim.`); stopProgressSimulation(); setProgress(currentFetchStatus === 'success' ? 100 : 0); } else if (elapsedTime >= totalDurationMs) { logger.log(`[ProgressSim] Simulation time ended (${estimatedDurationSeconds}s).`); stopProgressSimulation(); if (currentFetchStatus === 'loading' || currentFetchStatus === 'retrying') { setProgress(98); logger.warn("[ProgressSim] Sim ended on timeout during loading."); } else { setProgress(100); } } }, intervalTime); }, [stopProgressSimulation, logger, fetchStatusRef]);
  const handleRepoUrlChange = useCallback((url: string) => { setRepoUrlState(url); }, []); // Updates local state
  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => { const c=textToCopy??getKworkInputValue(); if(!c.trim()){addToast("Нет текста для копирования",'warning');return false;} try{ navigator.clipboard.writeText(c); addToast("Скопировано!",'success'); setRequestCopied(true); if(shouldScroll)scrollToSection('executor'); return true; }catch(e){ logger.error("Copy error:",e); addToast("Ошибка копирования",'error'); return false; } }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied, logger]);
  const handleClearAll = useCallback(() => { if (imageReplaceTask) { addToast("Очистка недоступна во время замены картинки.", "warning"); return; } logger.log("Fetcher: Clearing state."); setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); updateKworkInput(""); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setRequestCopied(false); addToast("Очищено ✨", 'success'); if (localKworkInputRef.current) localKworkInputRef.current.focus(); }, [ imageReplaceTask, setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied, logger ]);
  const selectHighlightedFiles = useCallback(() => { if (imageReplaceTask) return; const filesToAdd = new Set<string>(selectedFetcherFiles); let nSC = 0; const aHLS=[ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib ]; if(primaryHighlightedPath && files.some(f=>f.path===primaryHighlightedPath) && !filesToAdd.has(primaryHighlightedPath)){ filesToAdd.add(primaryHighlightedPath); nSC++; } aHLS.forEach(p=>{ if(files.some(f=>f.path===p) && !filesToAdd.has(p)){ filesToAdd.add(p); nSC++; } }); if(nSC > 0){ setSelectedFetcherFiles(filesToAdd); addToast(`${nSC} связанных файлов добавлено`, 'info'); } else { addToast("Все связанные файлы уже выбраны", 'info'); } }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFetcherFiles, setSelectedFetcherFiles, addToast, imageReplaceTask ]);
  const toggleFileSelection = useCallback((path: string) => { if (imageReplaceTask) return; setSelectedFetcherFiles(prevSet => { const newSet = new Set(prevSet); if(newSet.has(path)){ newSet.delete(path); } else{ newSet.add(path); } return newSet; }); }, [setSelectedFetcherFiles, imageReplaceTask]);
  const handleAddImportantFiles = useCallback(() => { if (imageReplaceTask) return; let addedCount=0; setSelectedFetcherFiles(prevContextSet => { const filesToAdd=new Set(prevContextSet); importantFiles.forEach(p=>{ if(files.some(f=>f.path===p) && !filesToAdd.has(p)){ filesToAdd.add(p); addedCount++; } }); if(addedCount === 0){ addToast("Все важные файлы уже выбраны", 'info'); return prevContextSet; } else { addToast(`Добавлено ${addedCount} важных файлов`, 'success'); return filesToAdd; } }); }, [importantFiles, files, setSelectedFetcherFiles, addToast, imageReplaceTask]);
  const handleSelectAll = useCallback(() => { if (imageReplaceTask) return; if(files.length===0) return; const allPaths=new Set(files.map(f=>f.path)); setSelectedFetcherFiles(allPaths); addToast(`Выбрано ${allPaths.size} файлов`,'info'); }, [files, setSelectedFetcherFiles, addToast, imageReplaceTask]);
  const handleDeselectAll = useCallback(() => { if (imageReplaceTask) return; setSelectedFetcherFiles(new Set()); addToast("Выбор снят со всех файлов",'info'); }, [setSelectedFetcherFiles, addToast, imageReplaceTask]);
  const handleAddSelected = useCallback(async (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => {
      if (imageReplaceTask) return;
      // Use context's allFetchedFiles if no specific param is passed
      const filesToProcess = allFilesParam || allFetchedFiles;
      const filesToAdd = filesToAddParam || selectedFetcherFiles;
      if(filesToProcess.length===0 && filesToAdd.size > 0){ addToast("Файлы еще не загружены.",'error'); return; }
      if(filesToAdd.size === 0){ logger.warn("handleAddSelected called with 0 files to add.", { filesToAddParamSize: filesToAddParam?.size, contextSelectedSize: selectedFetcherFiles?.size, filesToProcessCount: filesToProcess?.length }); addToast("Сначала выберите файлы для добавления.",'warning'); return; }
      logger.log(`handleAddSelected: Adding ${filesToAdd.size} files. Using source: ${filesToAddParam ? 'param' : 'context'}`);
      const prefix="Контекст кода для анализа:\n"; const markdownText = filesToProcess .filter(f => filesToAdd.has(f.path)) .sort((a,b) => a.path.localeCompare(b.path)) .map(f => { const pathComment = `// /${f.path}`; const contentAlreadyHasComment = f.content.trimStart().startsWith(pathComment); const contentToAdd = contentAlreadyHasComment ? f.content : `${pathComment}\n${f.content}`; return `\`\`\`${getLanguage(f.path)}\n${contentToAdd}\n\`\`\``; }) .join("\n\n");
      const currentKworkValue = getKworkInputValue(); const contextRegex = /Контекст кода для анализа:[\s\S]*/; const textWithoutContext = currentKworkValue.replace(contextRegex, '').trim(); const newContent = `${textWithoutContext ? textWithoutContext+'\n\n' : ''}${prefix}${markdownText}`;
      updateKworkInput(newContent); addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
      // Only scroll if NOT called automatically by ActualPageContent (which handles its own scroll)
      // Check if filesToAddParam was provided (meaning it was likely called by ActualPageContent)
      if (!filesToAddParam) {
        scrollToSection('kworkInput');
      }
  }, [allFetchedFiles, selectedFetcherFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection, imageReplaceTask, logger]);


  // --- MODIFIED handleFetchManual with EARLY PR CHECK for Image Task & Refined Dependencies ---
  const handleFetchManual = useCallback(async (
        isManualRetry = false,
        branchNameToFetchOverride?: string | null,
        taskForEarlyCheck?: ImageReplaceTask | null // Accept task for early check
    ) => {
      // Determine initial branch guess (will be potentially overridden for image task)
      const initialBranchGuess = branchNameToFetchOverride || targetBranchName || manualBranchName || 'default';
      const isAutoFetchWithIdea = autoFetch && !!ideaFromUrl && !isManualRetry;
      const currentTask = taskForEarlyCheck || imageReplaceTask; // Use passed task or context task

      logger.log(`Fetcher(Manual): Start fetch. Retry: ${isManualRetry}, Initial Branch: ${initialBranchGuess}, Task Active: ${!!currentTask}, AutoFetchIdea: ${isAutoFetchWithIdea}`);

      if (currentTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) { logger.warn("Fetcher(Manual): Image task fetch already running."); return; }
      if (!currentTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { logger.warn("Fetcher(Manual): Standard fetch already running."); addToast("Уже идет загрузка...", "info"); return; }
      if (!repoUrl.trim()) { logger.error("Fetcher(Manual): Repo URL empty."); addToast("Введите URL репозитория", 'error'); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return; }
      // Check context loading states directly
      if (assistantLoading || isParsing || aiActionLoading) { logger.warn(`Fetcher(Manual): Blocked by processing state (Assistant: ${assistantLoading}, Parsing: ${isParsing}, AI Action: ${aiActionLoading}).`); addToast("Подождите завершения.", "warning"); return; }


      logger.log("Fetcher(Manual): Starting process.");
      setFetchStatus('loading'); setError(null); setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setSelectedFetcherFiles(new Set()); // Clear context state

      if (!currentTask) {
          // Standard fetch setup
          setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
          if (!isAutoFetchWithIdea) {
             logger.log("Fetcher(Manual): Manual fetch or auto without idea. Kwork input untouched by Fetcher initially.");
          }
      } else {
           // Image task specific setup
           logger.log("Fetcher(Manual): Image Task mode - clearing kwork, setting flag.");
           isImageTaskFetchInitiated.current = true; updateKworkInput("");
      }

      let branchForContentFetch = initialBranchGuess;
      let identifiedPrBranch = false; // Flag
      let prCheckErrorOccurred = false;

      // --- Early PR Check for Image Task ---
      if (currentTask && !isManualRetry) { // Only check PRs on initial auto-fetch for the task
          logger.log(`[Fetcher Manual] Image task detected (${currentTask.targetPath}). Checking for existing PRs...`);
          setLoadingPrs(true); // Indicate PRs are being checked
          let prResult: Awaited<ReturnType<typeof getOpenPullRequests>> | null = null;
          try {
              prResult = await getOpenPullRequests(repoUrl);
              if (prResult.success && prResult.pullRequests) {
                  logger.log(`[Fetcher Manual] Found ${prResult.pullRequests.length} open PRs.`);
                  const expectedPrTitlePrefix = `chore: Update image`;
                  const expectedPrFile = currentTask.targetPath;
                  const matchPr = prResult.pullRequests.find(pr =>
                      pr.title?.startsWith(expectedPrTitlePrefix) &&
                      pr.title?.includes(expectedPrFile) &&
                      pr.head?.ref
                  );
                  if (matchPr) {
                      branchForContentFetch = matchPr.head.ref;
                      identifiedPrBranch = true;
                      setTargetBranchName(branchForContentFetch); // Update context's target branch IMMEDIATELY
                      setOpenPrs(prResult.pullRequests as SimplePullRequest[]); // Update context PRs
                      logger.log(`[Fetcher Manual] Found relevant PR #${matchPr.number} on branch '${branchForContentFetch}'. Will fetch content from this branch.`);
                      toast.info(`Найден PR #${matchPr.number}. Загружаю из ветки ${branchForContentFetch}...`);
                  } else {
                      logger.log(`[Fetcher Manual] No specific PR found for image task. Using default/manual branch: ${branchForContentFetch}`);
                      setOpenPrs(prResult.pullRequests as SimplePullRequest[]); // Still update context PRs
                  }
              } else {
                  prCheckErrorOccurred = true;
                  logger.error(`[Fetcher Manual] Failed to get open PRs: ${prResult.error}. Proceeding with default/manual branch: ${branchForContentFetch}`);
                  toast.error("Не удалось проверить PR. Загружаю из основной ветки.", { description: prResult.error });
                  setOpenPrs([]); // Clear PRs state on error
              }
          } catch (prError: any) {
                prCheckErrorOccurred = true;
                logger.error(`[Fetcher Manual] CRITICAL Error during getOpenPullRequests: ${prError.message}. Proceeding with default/manual branch: ${branchForContentFetch}`);
                toast.error("Крит. ошибка проверки PR. Загружаю из основной ветки.", { description: prError.message });
                setOpenPrs([]);
          } finally {
                setLoadingPrs(false);
          }
      }
      // --- End Early PR Check ---

      const effectiveBranchDisplay = branchForContentFetch; // Branch name used for the actual fetch
      addToast(`Запрос файлов из ветки (${effectiveBranchDisplay})...`, 'info');
      startProgressSimulation(identifiedPrBranch ? 8 : 13); // Shorter simulation if PR branch found
      logger.log("Fetcher(Manual): Progress simulation started.");

      let fetchResult: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
      let fetchAttemptSucceeded = false;
      let fetchedFilesData: FileNode[] = [];
      let primaryHighlightPath: string | null = null;
      let secondaryHighlightPathsData: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []};
      let filesToAutoSelect = new Set<string>();

      try {
           fetchResult = await fetchRepoContents(repoUrl, token || undefined, branchForContentFetch); // Use the determined branch
           if (fetchResult?.success && Array.isArray(fetchResult.files)) {
               fetchAttemptSucceeded = true;
               fetchedFilesData = fetchResult.files;
               const allPaths = fetchedFilesData.map(f => f.path);
               logger.log(`Fetcher(Manual): Fetched ${fetchedFilesData.length} files from '${branchForContentFetch}'.`);
               setFiles(fetchedFilesData); // Update local files state immediately

               if(currentTask){
                   // Image Task Post-Fetch Logic
                   primaryHighlightPath = currentTask.targetPath;
                   setPrimaryHighlightedPathState(primaryHighlightPath);
                   if (!allPaths.includes(primaryHighlightPath)) {
                       logger.error(`Fetcher(Manual): Image Task - Target ${primaryHighlightPath} NOT found in fetched files from branch ${branchForContentFetch}.`);
                       setError(`Файл (${primaryHighlightPath}) не найден в ветке ${branchForContentFetch}.`);
                       addToast(`Файл (${primaryHighlightPath}) не найден.`, 'error');
                       fetchAttemptSucceeded = false; // Mark as failure if target file is missing
                   } else {
                       logger.log(`Fetcher(Manual): Image Task - Target ${primaryHighlightPath} found in branch ${branchForContentFetch}.`);
                       addToast(`Файл для замены загружен из ${branchForContentFetch}.`, 'success');
                       // Auto-select the single file for the image task
                       filesToAutoSelect.add(primaryHighlightPath);
                       setSelectedFetcherFiles(filesToAutoSelect); // Update context selection immediately
                   }
                   if(isSettingsModalOpen) triggerToggleSettingsModal();
                   secondaryHighlightPathsData = { component: [], context: [], hook: [], lib: [], other: [] };
                   // filesToAutoSelect set above
               } else {
                   // Standard Task Post-Fetch Logic
                   if (highlightedPathFromUrl) {
                        logger.log(`Fetcher(Manual): Standard Task - Processing highlights for URL ${highlightedPathFromUrl}`);
                        primaryHighlightPath = getPageFilePath(highlightedPathFromUrl, allPaths); const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                        if(primaryHighlightPath){ const primaryFileNode = fetchedFilesData.find(f=>f.path===primaryHighlightPath); if(primaryFileNode){ logger.log(`Fetcher(Manual): Primary file ${primaryHighlightPath} found.`); filesToAutoSelect.add(primaryHighlightPath); const imports = extractImports(primaryFileNode.content); logger.log(`Fetcher(Manual): Found ${imports.length} imports.`); imports.forEach(imp => { const resolvedPath = resolveImportPath(imp, primaryFileNode.path, fetchedFilesData); if(resolvedPath && resolvedPath !== primaryHighlightPath){ const category = categorizeResolvedPath(resolvedPath); tempSecPathsSet[category].add(resolvedPath); if(category !== 'other') filesToAutoSelect.add(resolvedPath); } }); } else { primaryHighlightPath = null; addToast(`Ошибка: Путь страницы для URL (${highlightedPathFromUrl}) не найден.`, 'error');} }
                        else { addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, 'warning'); }
                        logger.log(`Fetcher(Manual): Adding ${importantFiles.length} important files.`); importantFiles.forEach(p => { if(allPaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); } });
                        setPrimaryHighlightedPathState(primaryHighlightPath); secondaryHighlightPathsData = { component:Array.from(tempSecPathsSet.component), context:Array.from(tempSecPathsSet.context), hook:Array.from(tempSecPathsSet.hook), lib:Array.from(tempSecPathsSet.lib), other:Array.from(tempSecPathsSet.other) }; setSecondaryHighlightedPathsState(secondaryHighlightPathsData);
                        if (filesToAutoSelect.size > 0) { const numSecondary = tempSecPathsSet.component.size + tempSecPathsSet.context.size + tempSecPathsSet.hook.size + tempSecPathsSet.lib.size; const numImportant = filesToAutoSelect.size - (primaryHighlightPath ? 1 : 0) - numSecondary; let msg=`✅ Авто-выбор: `; const parts=[]; if(primaryHighlightPath)parts.push(`1 стр.`); if(numSecondary>0)parts.push(`${numSecondary} связ.`); if(numImportant>0)parts.push(`${numImportant} важн.`); msg+=parts.join(', ') + ` (${filesToAutoSelect.size} всего).`; addToast(msg, 'success'); }
                   } else {
                        logger.log("Fetcher(Manual): Standard Task - No URL params, basic fetch."); addToast(`Извлечено ${fetchedFilesData.length} файлов!`, 'success'); primaryHighlightPath = null; secondaryHighlightPathsData = { component: [], context: [], hook: [], lib: [], other: [] }; filesToAutoSelect = new Set();
                   }
                   // --- Update Context Selection State (Standard Flow) ---
                   if (filesToAutoSelect.size > 0) { logger.log(`Fetcher(Manual): Updating context selection with ${filesToAutoSelect.size} files.`); setSelectedFetcherFiles(filesToAutoSelect); }
                   // --- Scroll Logic (only if not auto-fetch with idea) ---
                   if (!isAutoFetchWithIdea) { if (primaryHighlightPath) { setTimeout(()=>{ const el=document.getElementById(`file-${primaryHighlightPath}`); if(el){el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add('highlight-scroll'); setTimeout(()=>el.classList.remove('highlight-scroll'),2500);} },400); } else if (fetchedFilesData.length > 0) { scrollToSection('file-list-container'); } }
                   else { logger.log("Fetcher(Manual): Skipping scroll-to-file-list (auto-fetch with idea)."); }
                   if(isSettingsModalOpen) triggerToggleSettingsModal();
               }
           } else { fetchAttemptSucceeded = false; throw new Error(fetchResult?.error || `Не удалось получить файлы из ${branchForContentFetch}.`); }
       } catch (err: any) { const displayError = err?.message || "Неизвестная ошибка."; logger.error(`Fetcher(Manual): Fetch Error - ${displayError}`, err); setError(displayError); addToast(`Ошибка: ${displayError}`, 'error'); fetchAttemptSucceeded = false; setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setSelectedFetcherFiles(new Set()); }
       finally {
           stopProgressSimulation();
           const overallSuccess = fetchAttemptSucceeded; // Status depends only on fetch success now
           // Call the context setter which now handles the conditional assistant trigger internally
           setFilesFetchedCombined( overallSuccess, fetchedFilesData, primaryHighlightPath, Object.values(secondaryHighlightPathsData).flat() );
           // Context setter will determine the final fetchStatus based on task presence and success
           setProgress(overallSuccess ? 100 : 0);
           if (currentTask && !overallSuccess) {
               isImageTaskFetchInitiated.current = false; // Allow retry if fetch failed
           }
           logger.log(`Fetcher(Manual): Finished. Fetch Success: ${overallSuccess}, Branch Fetched: ${branchForContentFetch}`);
       }
   }, [ // --- UPDATED DEPENDENCIES ---
       repoUrl, token, imageReplaceTask, targetBranchName, manualBranchName,
       // Context state values read directly OR used in conditions:
       assistantLoading, isParsing, aiActionLoading, autoFetch, ideaFromUrl, isSettingsModalOpen,
       // Context setters/triggers called:
       setFetchStatus, setError, setFiles, setSelectedFilesState, setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetchedCombined,
       setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setLoadingPrs, setOpenPrs, setTargetBranchName,
       triggerToggleSettingsModal, // Add the trigger function
       // Local helpers/state/refs:
       importantFiles, addToast, startProgressSimulation, stopProgressSimulation, updateKworkInput, getKworkInputValue,
       logger, scrollToSection,
       // getOpenPullRequests and fetchRepoContents are stable imports, no need to list typically
   ]); // --- END UPDATED DEPENDENCIES ---


  // --- Effect: Auto-Fetch (Add isMounted check inside) ---
  useEffect(() => {
    // Ensure isMounted is true *before* proceeding inside the effect
    if (!isMounted) return;

    const currentTask = imageReplaceTask; // Use context task
    const branch = targetBranchName || manualBranchName || null;
    // Use the fetchStatus *state* from context directly for the check
    const canTriggerFetch = autoFetch && repoUrlEntered && (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error');
    const isImageFetchReady = currentTask && !isImageTaskFetchInitiated.current;
    const isStandardFetchReady = !currentTask && autoFetch;

    if (canTriggerFetch && !isAutoFetchingRef.current && (isImageFetchReady || isStandardFetchReady)) {
        const mode = currentTask ? "Image Task" : "Standard";
        logger.log(`[AutoFetch Effect] Triggering fetch (${mode}). Guard ON.`);
        isAutoFetchingRef.current = true;
        // Pass the currentTask to handleFetchManual for the early check
        handleFetchManual(false, branch, currentTask)
            .catch(err => { logger.error(`[AutoFetch Effect] handleFetchManual (${mode}) error:`, err); })
            .finally(() => {
                setTimeout(() => {
                    logger.log("[AutoFetch Effect] Resetting fetch guard.");
                    isAutoFetchingRef.current = false;
                    // Reset image task initiated flag ONLY if fetch FAILED, allowing retry
                    // Use direct fetchStatus state check here too
                    if (currentTask && fetchStatus !== 'success') {
                         isImageTaskFetchInitiated.current = false;
                         logger.log("[AutoFetch Effect] Resetting image task initiated flag due to non-success status.");
                    }
                }, 300);
            });
    } else if (canTriggerFetch && isAutoFetchingRef.current) {
        logger.log("[AutoFetch Effect] Skipping: Guard is active.");
    } else if (currentTask && isImageTaskFetchInitiated.current) {
        logger.log("[AutoFetch Effect] Skipping: Image task fetch already initiated.");
    }
  }, [
      isMounted, // Ensure effect re-runs if isMounted changes (though usually only once)
      repoUrlEntered,
      autoFetch,
      targetBranchName,
      manualBranchName,
      imageReplaceTask, // Depend on context task
      fetchStatus, // Depend on the actual fetchStatus state from context
      handleFetchManual, // Include handleFetchManual
      logger // Keep logger if used inside
   ]);

    // --- Effect: Track previous selection (for debugging/advanced logic if needed) ---
    useEffect(() => { if(!isMounted){ return; } prevSelectedFilesRef.current = selectedFetcherFiles; }, [selectedFetcherFiles, isMounted]);

    // === Imperative Handle (ensure handleFetch has correct signature) ===
    useImperativeHandle(ref, () => ({
        // Update signature to accept the optional task
        handleFetch: (isManualRetry?: boolean, branchNameToFetchOverride?: string | null, taskForEarlyCheck?: ImageReplaceTask | null) => handleFetchManual(isManualRetry, branchNameToFetchOverride, taskForEarlyCheck || imageReplaceTask), // Use context task as fallback
        selectHighlightedFiles,
        handleAddSelected: (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => handleAddSelected(filesToAddParam ?? selectedFetcherFiles, allFilesParam ?? allFetchedFiles), // Pass correct state
        handleCopyToClipboard,
        clearAll: handleClearAll,
        getKworkInputValue
    }), [handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue, selectedFetcherFiles, allFetchedFiles, imageReplaceTask]); // Add imageReplaceTask dependency


    // === Render Logic ===
    if (!isMounted) { return ( <div id="extractor-loading" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 min-h-[300px] flex items-center justify-center"> <p className="text-gray-400 text-lg animate-pulse flex items-center gap-2"><FaSpinner className="animate-spin"/> Инициализация...</p> </div> ); }

    // Use context's imageReplaceTask for rendering decisions
    const currentImageTask = imageReplaceTask;
    const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
    const showProgressBar = fetchStatus !== 'idle';
    const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (currentImageTask && isImageTaskFetchInitiated.current && isLoading);
    const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!currentImageTask; // Disable most actions if image task active
    const isCopyDisabled = !kworkInputHasContent || isActionDisabled;
    const isClearDisabled = (!kworkInputHasContent && selectedFetcherFiles.size === 0 && !filesFetched) || isActionDisabled;
    const isAddSelectedDisabled = selectedFetcherFiles.size === 0 || isActionDisabled;
    const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
    const imageTaskTargetFileReady = currentImageTask && fetchStatus === 'success' && allFetchedFiles.some(f => f.path === currentImageTask.targetPath);

    // Adjust manual branch handling (optional, depends on desired behavior)
     const handleManualBranchChange = (branch: string) => {
          setManualBranchName(branch);
          if (branch.trim() !== targetBranchName) {
              setTargetBranchName(null); // Clear PR-selected branch if manual is entered
          }
     };
      const handleSelectPrBranch = (branch: string | null) => {
          setTargetBranchName(branch);
          if (branch) {
              setManualBranchName(""); // Clear manual branch if PR branch is selected
          }
      };
      const handleLoadPrs = () => {
          if (repoUrl) { // Use local state repoUrl
              triggerGetOpenPRs(repoUrl);
          } else {
              toast.error("Введите URL репозитория для загрузки PR.");
          }
      };
      const handleAddFullTree = () => {
          if (imageReplaceTask) return;
          const allCode = files.map(f => {
              const pathComment = `// /${f.path}`;
              const contentAlreadyHasComment = f.content.trimStart().startsWith(pathComment);
              return contentAlreadyHasComment ? f.content : `${pathComment}\n${f.content}`;
          }).join("\n\n// ---- FILE SEPARATOR ----\n\n");
          const prefix = "Контекст кода для анализа (ВСЕ ФАЙЛЫ):\n```plaintext\n";
          const suffix = "\n```";
          const kworkText = kworkInputRef.current?.value || ""; // Use context ref
          const contextRegex = /Контекст кода для анализа[\s\S]*/;
          const textWithoutContext = kworkText.replace(contextRegex, '').trim();
          const newContent = `${textWithoutContext ? textWithoutContext + '\n\n' : ''}${prefix}${allCode}${suffix}`;
          updateKworkInput(newContent); // Uses local function
          toast.success(`Полное дерево (${files.length} файлов) добавлено в запрос.`);
          scrollToSection('kworkInput');
      };


    return (
      <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
         <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
              <div> <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2"> {currentImageTask ? <FaImages className="text-blue-400" /> : <FaDownload className="text-purple-400" />} {currentImageTask ? "Задача: Замена Картинки" : "Кибер-Экстрактор Кода"} </h2> {!currentImageTask && ( <> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Настрой (<FaCodeBranch title="Настройки" className="inline text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Жми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">4. Опиши задачу ИЛИ добавь файлы (<FaPlus className="inline text-sm"/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Скопируй (<FaCopy className="inline text-sm mx-px"/>) запрос или передай дальше.</p> </> )} {currentImageTask && ( <p className="text-blue-300/80 text-xs md:text-sm mb-2">Авто-загрузка <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">{currentImageTask.targetPath}</code>...</p> )} </div>
              <motion.button onClick={triggerToggleSettingsModal} disabled={isLoading || assistantLoading || isParsing} whileHover={{ scale: (isLoading || assistantLoading || isParsing) ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }} whileTap={{ scale: (isLoading || assistantLoading || isParsing) ? 1 : 0.95 }} title={isSettingsModalOpen ? "Скрыть" : "Настройки"} aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"} aria-expanded={isSettingsModalOpen} className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50" > {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />} </motion.button>
          </div>
         {/* Pass updated handlers to SettingsModal */}
         <SettingsModal isOpen={isSettingsModalOpen} repoUrl={repoUrl} setRepoUrl={handleRepoUrlChange} token={token} setToken={setToken} manualBranchName={manualBranchName} setManualBranchName={handleManualBranchChange} currentTargetBranch={targetBranchName} openPrs={openPrs} loadingPrs={loadingPrs} onSelectPrBranch={handleSelectPrBranch} onLoadPrs={handleLoadPrs} loading={isLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing} />

         <div className="mb-4 flex justify-center">
              {/* Pass currentImageTask to the manual fetch trigger */}
              <motion.button onClick={() => { handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error', null, currentImageTask); }} disabled={isFetchDisabled} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${isFetchDisabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`} whileHover={{ scale: isFetchDisabled ? 1 : 1.03 }} whileTap={{ scale: isFetchDisabled ? 1 : 0.97 }} title={`Извлечь из ${effectiveBranchDisplay}${currentImageTask ? ' (для картинки)' : ''}`} > {isLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : currentImageTask ? <FaImages /> : <FaDownload />)} {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : currentImageTask ? "Загрузить Файл" : "Извлечь файлы")} <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span> </motion.button>
          </div>
         {showProgressBar && ( <div className="mb-4 min-h-[40px]"> <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} /> {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>} {isParsing && !currentImageTask && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>} {fetchStatus === 'success' && !currentImageTask && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно ${files.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`} </div> )} {fetchStatus === 'success' && !currentImageTask && files.length === 0 && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, 0 файлов в '${effectiveBranchDisplay}'.`} </div> )} {imageTaskTargetFileReady && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Файл ${currentImageTask?.targetPath.split('/').pop()} загружен.`} </div> )} {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )} {isWaitingForAiResponse && !currentImageTask && ( <p className="text-blue-400 text-xs font-mono mt-1 text-center animate-pulse"> ⏳ Жду ответ AI... (ID: {currentAiRequestId?.substring(0, 6)}...) </p> )} </div> )}
         <div className={`grid grid-cols-1 ${ (files.length > 0 && !currentImageTask) ? 'md:grid-cols-2' : ''} gap-4 md:gap-6`}>
           {!currentImageTask && (isLoading || files.length > 0) && ( <div className={`flex flex-col gap-4 ${ (files.length > 0 || kworkInputHasContent) ? '' : 'md:col-span-2'}`}> <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} isActionDisabled={isActionDisabled} /> <FileList id="file-list-container" files={files} selectedFiles={selectedFiles} primaryHighlightedPath={primaryHighlightedPath} secondaryHighlightedPaths={secondaryHighlightedPaths} importantFiles={importantFiles} isLoading={isLoading} isActionDisabled={isActionDisabled} toggleFileSelection={toggleFileSelection} onAddSelected={() => handleAddSelected()} onAddImportant={handleAddImportantFiles} onAddTree={handleAddFullTree} onSelectHighlighted={selectHighlightedFiles} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} /> </div> )}
           {!currentImageTask && (files.length > 0 || kworkInputHasContent) ? ( <div id="kwork-input-section" className="flex flex-col gap-3"> <RequestInput kworkInputRef={localKworkInputRef} onCopyToClipboard={() => handleCopyToClipboard(undefined, true)} onClearAll={handleClearAll} onAddSelected={() => handleAddSelected()} isCopyDisabled={isCopyDisabled} isClearDisabled={isClearDisabled} isAddSelectedDisabled={isAddSelectedDisabled} selectedFetcherFilesCount={selectedFetcherFiles.size} onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)} /> </div> ) : null }
            {currentImageTask && filesFetched && ( <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed ${imageTaskTargetFileReady ? 'border-blue-400' : 'border-red-500'} min-h-[200px]`}> {isLoading ? <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" /> : assistantLoading ? <FaSpinner className="text-purple-400 text-3xl mb-3 animate-spin" /> : imageTaskTargetFileReady ? <FaCircleCheck className="text-green-400 text-3xl mb-3" /> : <FaXmark className="text-red-500 text-3xl mb-3" />} <p className={`text-sm font-semibold ${imageTaskTargetFileReady ? 'text-blue-300' : 'text-red-400'}`}> {isLoading ? "Загрузка..." : assistantLoading ? "Обработка..." : imageTaskTargetFileReady ? `Файл ${currentImageTask?.targetPath.split('/').pop()} готов.` : `Файл ${currentImageTask?.targetPath.split('/').pop()} не найден!`} </p> <p className="text-xs text-gray-400 mt-1"> {isLoading ? "Ожидание..." : assistantLoading ? "Создание/обновление PR..." : imageTaskTargetFileReady ? "Передано Ассистенту..." : "Проверьте путь/ветку."} </p> </div> )}
        </div>
      </div>
    );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;