// MODIFICATIONS:
// - Simplified logic in `handleFetchManual` for image task: Fetch files, check if target exists, call context's `setFilesFetched`. The context now handles triggering the assistant.
// - Removed explicit setting of `selectedFilesState` / `setSelectedFetcherFiles` within `handleFetchManual` for the image task path, as the context trigger is sufficient. Local state is only for UI feedback if needed.
// - Ensured `setPrimaryHighlightedPathState` is still set for UI feedback (like highlighting the row).
// - Confirmed `setFilesFetched` (the context function) is called correctly in the `finally` block, passing the necessary info.
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner, FaListCheck, FaSquareXmark,
    FaHighlighter, FaKey, FaTree // Added missing icons from FileList usage
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Действия и Контекст
import { fetchRepoContents } from "@/app/actions_github/actions";
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

// --- Вспомогательные функции (определены ВНЕ компонента) ---
const getLanguage = (path: string): string => { const e=path.split('.').pop()?.toLowerCase(); switch(e){ case 'ts': case 'tsx': return 'typescript'; case 'js': case 'jsx': return 'javascript'; case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html'; case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql'; case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go'; case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash'; case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext'; } };
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => { if(!resolvedPath) return 'other'; const pL=resolvedPath.toLowerCase(); if(pL.includes('/contexts/')||pL.startsWith('contexts/')) return 'context'; if(pL.includes('/hooks/')||pL.startsWith('hooks/')) return 'hook'; if(pL.includes('/lib/')||pL.startsWith('lib/')) return 'lib'; if((pL.includes('/components/')||pL.startsWith('components/'))&&!pL.includes('/components/ui/')) return 'component'; return 'other'; };
const extractImports = (c:string):string[]=>{ const r1=/import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const r2=/require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const i=new Set<string>(); let m; while((m=r1.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); while((m=r2.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); return Array.from(i);};
const resolveImportPath = (iP:string, cFP:string, aFN:FileNode[]):string|null=>{ const aP=aFN.map(f=>f.path); const sE=['.ts','.tsx','.js','.jsx','.css','.scss','.sql','.md']; const tryP=(bP:string):string|null=>{const pTT:string[]=[]; const hEE=/\.\w+$/.test(bP); if(hEE)pTT.push(bP); else{sE.forEach(e=>pTT.push(bP+e)); sE.forEach(e=>pTT.push(`${bP}/index${e}`));} for(const p of pTT)if(aP.includes(p))return p; return null;}; if(iP.startsWith('@/')){const pSB=['src/','app/','']; const pS=iP.substring(2); for(const b of pSB){const r=tryP(b+pS); if(r)return r;} const cAR=['components/','lib/','utils/','hooks/','contexts/','styles/']; for(const rt of cAR)if(pS.startsWith(rt)){const r=tryP(pS); if(r)return r;}}else if(iP.startsWith('.')){const cD=cFP.includes('/')?cFP.substring(0,cFP.lastIndexOf('/')):''; const pP=(cD?cD+'/'+iP:iP).split('/'); const rP:string[]=[]; for(const pt of pP){if(pt==='.'||pt==='')continue; if(pt==='..'){if(rP.length>0)rP.pop();}else rP.push(pt);} const rRB=rP.join('/'); const r=tryP(rRB); if(r)return r;}else{const sB=['lib/','utils/','components/','hooks/','contexts/','styles/','src/lib/','src/utils/','src/components/','src/hooks/','src/contexts/','src/styles/']; for(const b of sB){const r=tryP(b+iP); if(r)return r;}} return null;};
const getPageFilePath = (rP:string, aP:string[]):string|null=>{ const cP=rP.startsWith('/')?rP.substring(1):rP; if(!cP||cP==='app'||cP==='/'){ const rPs=['app/page.tsx','app/page.js','src/app/page.tsx','src/app/page.js']; for(const rp of rPs) if(aP.includes(rp)) return rp; return null; } const pwa=cP.startsWith('app/')?cP:cP.startsWith('src/app/')?cP:`app/${cP}`; if(aP.includes(pwa)) return pwa; const pDP=[`${pwa}/page.tsx`,`${pwa}/page.js`,`${pwa}/index.tsx`,`${pwa}/index.js`]; for(const p of pDP) if(aP.includes(p)) return p; const iS=pwa.split('/'); const nIS=iS.length; const pF=aP.filter(p=>(p.startsWith('app/')||p.startsWith('src/app/'))&&(p.endsWith('/page.tsx')||p.endsWith('/page.js')||p.endsWith('/index.tsx')||p.endsWith('/index.js'))); for(const acP of pF){ const sfx=['/page.tsx','/page.js','/index.tsx','/index.js'].find(s=>acP.endsWith(s)); if(!sfx) continue; const aPB=acP.substring(0,acP.length-sfx.length); const aS=aPB.split('/'); if(aS.length!==nIS) continue; let iDM=true; for(let i=0;i<nIS;i++){ const iSeg=iS[i]; const aSeg=aS[i]; if(iSeg===aSeg) continue; else if(aSeg.startsWith('[')&&aSeg.endsWith(']')) continue; else { iDM=false; break; }} if(iDM) return acP; } return null; };

// --- Компонент ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
  // === Состояние компонента ===
  const [isMounted, setIsMounted] = useState(false); // <<< ВАЖНОЕ состояние
  const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set()); // Local state mainly for UI feedback
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null); // For UI highlight
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] }); // For UI highlight

  // === Контекст ===
   const {
      fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched, // Using combined setFilesFetched from context
      setSelectedFetcherFiles, // Context's selection state (might not be needed for image task)
      kworkInputHasContent, setKworkInputHasContent, setRequestCopied,
      aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing, currentAiRequestId,
      targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs, setOpenPrs,
      setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal, kworkInputRef, triggerAskAi,
      triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection,
      setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles, imageReplaceTask,
      // allFetchedFiles is now managed and read via context
   } = useRepoXmlPageContext();

  // === Параметры URL и производное состояние ===
   const searchParams = useSearchParams();
   const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
   const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
   const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
   const DEFAULT_TASK_IDEA = "Set the vibe! Проанализируй код, предложи улучшения и креативные идеи."; // Updated Default
   const importantFiles = useMemo(() => [ // Updated List
        "contexts/AppContext.tsx",
        "contexts/RepoXmlPageContext.tsx", // Added context itself
        "hooks/useTelegram.ts",
        "app/layout.tsx",
        "app/repo-xml/page.tsx", // Added the page itself
        "components/RepoTxtFetcher.tsx", // Added fetcher
        "components/AICodeAssistant.tsx", // Added assistant
        "components/AutomationBuddy.tsx", // Added buddy
        "components/repo/prompt.ts", // Added prompt
        "hooks/supabase.ts",
        "app/actions.ts",
        "app/actions_github/actions.ts", // Combined Github actions
        "app/webhook-handlers/proxy.ts",
        "package.json",
        "tailwind.config.ts",
    ], []);

  // === Рефы ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSelectedFilesRef = useRef<Set<string>>(new Set());
  const isImageTaskFetchInitiated = useRef(false); // Tracks if fetch for image task has started
  const isAutoFetchingRef = useRef(false); // Guard for auto-fetch effect
  const fetchStatusRef = useRef(fetchStatus); // Ref to track current fetch status for interval logic

  // === Эффекты ===
  useEffect(() => { setIsMounted(true); }, []); // Устанавливаем isMounted после первого рендера на клиенте
  useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]); // Связываем рефы
  useEffect(() => { fetchStatusRef.current = fetchStatus; }, [fetchStatus]); // Обновляем fetchStatusRef
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl); }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]); // Обновляем URL в ассистенте
  useEffect(() => { return () => stopProgressSimulation(); }, []); // Очистка интервала симуляции при размонтировании

  // === Утилиты и Колбэки (Определены ДО их использования в зависимостях!) ===

  // 1. Базовые утилиты (низкоуровневые, без внешних зависимостей-колбэков)
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    let s={background:"rgba(50,50,50,0.9)",color:"#E1FF01",border:"1px solid rgba(225,255,1,0.2)",backdropFilter:"blur(3px)"};
    if(type==='success')s={background:"rgba(22,163,74,0.9)",color:"#fff",border:"1px solid rgba(34,197,94,0.3)",backdropFilter:"blur(3px)"};
    else if(type==='error')s={background:"rgba(220,38,38,0.9)",color:"#fff",border:"1px solid rgba(239,68,68,0.3)",backdropFilter:"blur(3px)"};
    else if(type==='warning')s={background:"rgba(217,119,6,0.9)",color:"#fff",border:"1px solid rgba(245,158,11,0.3)",backdropFilter:"blur(3px)"};
    toast(message,{style:s,duration:type==='error'?5000:(type==='warning'?4000:3000)});
  }, []); // Зависит только от toast, стабильно

  const updateKworkInput = useCallback((value: string) => {
      if (localKworkInputRef.current) {
          localKworkInputRef.current.value = value;
          const event = new Event('input', { bubbles: true });
          localKworkInputRef.current.dispatchEvent(event);
          setKworkInputHasContent(value.trim().length > 0);
      } else { logger.warn("localKworkInputRef is null"); } // Use logger
  }, [setKworkInputHasContent, logger]); // Зависит от setKworkInputHasContent из контекста и logger

  const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []); // Без зависимостей

  // 2. Симуляция прогресса (зависит от stopProgressSimulation, который без зависимостей)
  const stopProgressSimulation = useCallback(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
  }, []); // Без зависимостей

  const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
      stopProgressSimulation(); setProgress(0); setError(null); const startTime = Date.now(); const totalDurationMs = estimatedDurationSeconds * 1000; const intervalTime = 100;
      logger.log(`[ProgressSim] Запуск симуляции на ${estimatedDurationSeconds} сек.`); // Use logger
      progressIntervalRef.current = setInterval(() => {
          const elapsedTime = Date.now() - startTime;
          const calculatedProgress = Math.min((elapsedTime / totalDurationMs) * 100, 100);
          setProgress(calculatedProgress);
          const currentFetchStatus = fetchStatusRef.current; // Use ref value
          if (currentFetchStatus === 'success' || currentFetchStatus === 'error' || currentFetchStatus === 'failed_retries') {
              logger.log(`[ProgressSim] Статус (${currentFetchStatus}) изменился, остановка симуляции.`); // Use logger
              stopProgressSimulation();
              setProgress(currentFetchStatus === 'success' ? 100 : 0);
          } else if (elapsedTime >= totalDurationMs) {
              logger.log(`[ProgressSim] Время симуляции (${estimatedDurationSeconds} сек) истекло.`); // Use logger
              stopProgressSimulation();
              if (currentFetchStatus === 'loading' || currentFetchStatus === 'retrying') {
                  setProgress(98); logger.warn("[ProgressSim] Симуляция завершилась по таймауту во время загрузки."); // Use logger
              } else { setProgress(100); }
          }
      }, intervalTime);
  }, [stopProgressSimulation, logger]); // Зависит от stopProgressSimulation, logger

  // 3. Обработчики UI и взаимодействий (зависят от базовых утилит)
  const handleRepoUrlChange = useCallback((url: string) => { setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName(""); }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);

  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => { const c=textToCopy??getKworkInputValue(); if(!c.trim()){addToast("Нет текста",'warning');return false;} try{navigator.clipboard.writeText(c); addToast("Скопировано!",'success');setRequestCopied(true); if(shouldScroll)scrollToSection('executor');return true;}catch(e){logger.error("Ошибка копирования:",e);addToast("Ошибка копирования",'error');return false;} }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied, logger]); // Added logger

  const handleClearAll = useCallback(() => {
       if (imageReplaceTask) { // Prevent clearing during image task
           addToast("Очистка недоступна во время замены картинки.", "warning");
           return;
       }
       logger.log("Fetcher: Очистка состояния."); // Use logger
       setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); updateKworkInput(""); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setRequestCopied(false); addToast("Очищено ✨", 'success'); if (localKworkInputRef.current) localKworkInputRef.current.focus(); }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied, logger, imageReplaceTask ]); // Added logger and imageReplaceTask

  const selectHighlightedFiles = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      const fTS=new Set<string>(selectedFiles); let nSC=0; const aHLS=[ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib ]; if(primaryHighlightedPath&&files.some(f=>f.path===primaryHighlightedPath)&&!fTS.has(primaryHighlightedPath)){fTS.add(primaryHighlightedPath); nSC++;} aHLS.forEach(p=>{if(files.some(f=>f.path===p)&&!fTS.has(p)){fTS.add(p); nSC++;}}); if(nSC>0){setSelectedFilesState(fTS); setSelectedFetcherFiles(fTS); addToast(`${nSC} связанных добавлено`, 'info');} else {addToast("Все связанные уже выбраны", 'info');}
  }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast, imageReplaceTask ]); // Added imageReplaceTask

  const toggleFileSelection = useCallback((path: string) => {
      if (imageReplaceTask) return; // Prevent selection changes during image task
      setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if(newSet.has(path)){ newSet.delete(path); }else{ newSet.add(path); } if (selectionUpdateTimeoutRef.current) clearTimeout(selectionUpdateTimeoutRef.current); selectionUpdateTimeoutRef.current = setTimeout(() => { setSelectedFetcherFiles(new Set(newSet)); selectionUpdateTimeoutRef.current = null; }, 150); return newSet; });
  }, [setSelectedFetcherFiles, imageReplaceTask]); // Added imageReplaceTask

  const handleAddImportantFiles = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      let aC=0; const fTA=new Set(selectedFiles); importantFiles.forEach(p=>{if(files.some(f=>f.path===p)&&!selectedFiles.has(p)){fTA.add(p); aC++;}}); if(aC===0){addToast("Важные уже выбраны", 'info'); return;} setSelectedFilesState(fTA); setSelectedFetcherFiles(fTA); addToast(`Добавлено ${aC} важных`, 'success');
  }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast, imageReplaceTask]); // Added imageReplaceTask

  const handleAddFullTree = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      if(files.length===0){addToast("Нет файлов",'warning'); return;} const tO=files.map((f)=>`- /${f.path}`).sort().join("\n"); const tC=`Структура:\n\`\`\`\n${tO}\n\`\`\``; let added=false; const cV=getKworkInputValue(); const tV=cV.trim(); const hT=/Структура:\s*```/im.test(tV); if(!hT){const nC=tV?`${tV}\n\n${tC}`:tC; updateKworkInput(nC); added=true;} if(added){addToast("Дерево добавлено",'success'); scrollToSection('kworkInput');} else {addToast("Дерево уже добавлено", 'info');}
  }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast, imageReplaceTask]); // Added imageReplaceTask

  const handleSelectPrBranch = useCallback((branch: string | null) => { setTargetBranchName(branch); if(branch) addToast(`Ветка PR: ${branch}`, 'success'); else addToast(`Выбор ветки PR снят.`, 'info'); }, [setTargetBranchName, addToast]);

  const handleManualBranchChange = useCallback((name: string) => { setManualBranchName(name); }, [setManualBranchName]);

  const handleLoadPrs = useCallback(() => { triggerGetOpenPRs(repoUrl); }, [triggerGetOpenPRs, repoUrl]);

  const handleSelectAll = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      if(files.length===0)return; const allP=new Set(files.map(f=>f.path)); setSelectedFilesState(allP); setSelectedFetcherFiles(allP); addToast(`Выбрано ${allP.size} файлов`,'info');
  }, [files, setSelectedFetcherFiles, addToast, imageReplaceTask]); // Added imageReplaceTask

  const handleDeselectAll = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); addToast("Выбор снят",'info');
  }, [setSelectedFetcherFiles, addToast, imageReplaceTask]); // Added imageReplaceTask

  // 4. Основная функция добавления выбранных (зависит от getKworkInputValue, updateKworkInput, scrollToSection, addToast)
  const handleAddSelected = useCallback(async (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => {
      if (imageReplaceTask) return; // Skip if image task active
      const fTP=allFilesParam||files; const fTA=filesToAddParam||selectedFiles; if(fTP.length===0&&fTA.size>0){addToast("Файлы не загружены.",'error');return;} if(fTA.size===0){addToast("Выберите файлы.",'warning');return;} const pfx="Контекст кода для анализа:\n"; const mdTxt=fTP.filter(f=>fTA.has(f.path)).sort((a,b)=>a.path.localeCompare(b.path)).map(f=>{const pC=`// /${f.path}`; const cAHC=f.content.trimStart().startsWith(pC); const cTA=cAHC?f.content:`${pC}\n${f.content}`; return `\`\`\`${getLanguage(f.path)}\n${cTA}\n\`\`\``}).join("\n\n"); const cKV=getKworkInputValue(); const ctxRgx=/Контекст кода для анализа:[\s\S]*/; const tT=cKV.replace(ctxRgx,'').trim(); const nC=`${tT?tT+'\n\n':''}${pfx}${mdTxt}`; updateKworkInput(nC); addToast(`${fTA.size} файлов добавлено`, 'success'); scrollToSection('kworkInput');
  }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection, imageReplaceTask]); // Added imageReplaceTask

  // 5. Основная функция извлечения (handleFetchManual) - Зависит от многих колбэков и состояний
  const handleFetchManual = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
      const effectiveBranch = branchNameToFetch || targetBranchName || manualBranchName || 'default';
      logger.log(`Fetcher(Manual): Старт извлечения. Повтор: ${isManualRetry}, Ветка: ${effectiveBranch}, ImageTask: ${!!imageReplaceTask}`);

       // --- Image Task Initiation Guard ---
       if (imageReplaceTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) {
           logger.warn("Fetcher(Manual): Загрузка для задачи картинки уже идет. Отмена дубликата.");
           return;
       }
       // --- Standard Fetch Initiation Guard ---
       if (!imageReplaceTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) {
           logger.warn("Fetcher(Manual): Уже идет загрузка (стандартный режим).");
           addToast("Уже идет...", "info");
           return;
       }
       // --- General Guards ---
       if (!repoUrl.trim()) { logger.error("Fetcher(Manual): URL пуст."); addToast("Введите URL", 'error'); setError("URL пуст."); triggerToggleSettingsModal(); return; }
       if (assistantLoading || isParsing || aiActionLoading) { logger.warn(`Fetcher(Manual): Заблокировано состоянием (${assistantLoading}, ${isParsing}, ${aiActionLoading}).`); addToast("Подождите.", "warning"); return; }

       // --- Start Fetch Process ---
       logger.log("Fetcher(Manual): Запускаем процесс.");
       setFetchStatus('loading');
       setError(null); setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
       setSelectedFetcherFiles(new Set()); // Clear context selection too
       setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());

       // --- Specific Handling for Image Task ---
       if (imageReplaceTask) {
           logger.log("Fetcher(Manual): Режим Замены Картинки - очистка Kwork, установка флага.");
           isImageTaskFetchInitiated.current = true; // Set flag HERE
           updateKworkInput(""); // Clear kwork for image task
       } else if (!highlightedPathFromUrl && localKworkInputRef.current) { // Standard flow prefill
           updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA);
       }

       addToast(`Запрос (${effectiveBranch})...`, 'info');
       startProgressSimulation(13);
       logger.log("Fetcher(Manual): Симуляция запущена.");

       let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
       let success = false; // Overall success of the fetch *and* finding the target file if needed
       let fetchSucceeded = false; // Tracks if the API call itself was successful
       let finalStatus: FetchStatus = 'error'; // Default to error
       let fetchedFiles: FileNode[] = []; // Keep track of fetched files even on error
       let primaryHPath: string | null = null; // Keep track of primary path
       let finalSecPaths: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []}; // Keep track of secondary paths

       try {
           result = await fetchRepoContents(repoUrl, token || undefined, effectiveBranch);

           if (result?.success && Array.isArray(result.files)) {
               fetchSucceeded = true; // API call was good
               fetchedFiles = result.files; // Store fetched files immediately
               const allPaths = fetchedFiles.map(f => f.path);
               logger.log(`Fetcher(Manual): Успешно извлечено ${fetchedFiles.length} файлов из '${effectiveBranch}'.`);
               finalStatus = 'success'; // Assume success unless target missing etc.
               success = true; // Assume overall success initially

               // === Image Replace Task Path ===
               if(imageReplaceTask){
                   logger.log(`Fetcher(Manual): Image Task - Проверка целевого файла ${imageReplaceTask.targetPath}`);
                   primaryHPath = imageReplaceTask.targetPath; // This IS the primary path for the image task
                   setPrimaryHighlightedPathState(primaryHPath); // Set for UI highlight

                   if(!allPaths.includes(primaryHPath)){
                       const imgErr=`Файл (${primaryHPath}) не найден в '${effectiveBranch}'. Замена невозможна.`;
                       logger.error(`Fetcher(Manual): Image Task - ${imgErr}`);
                       setError(imgErr); addToast(imgErr,'error');
                       finalStatus = 'error'; // Set fetch status to error
                       success = false; // Mark overall operation as failed
                       // No selection needed
                       setSelectedFilesState(new Set());
                       setSelectedFetcherFiles(new Set());
                   } else {
                       logger.log(`Fetcher(Manual): Image Task - Целевой файл ${primaryHPath} найден.`);
                       // Explicitly DO NOT set selectedFetcherFiles here. Context trigger relies on file existing in allFetchedFiles.
                       // We only set local state for UI feedback if needed (e.g., visual highlight).
                       setSelectedFilesState(new Set([primaryHPath])); // Local selection for UI highlight only
                       addToast(`Файл для замены (${primaryHPath.split('/').pop()}) загружен.`, 'success');
                       if(isSettingsModalOpen) triggerToggleSettingsModal();
                       // No secondary paths needed
                       finalSecPaths = { component: [], context: [], hook: [], lib: [], other: [] };
                   }
               }
               // === Standard Fetch Path (with URL params) ===
               else if (highlightedPathFromUrl){
                   logger.log(`Fetcher(Manual): Standard Task - Поиск основного файла для URL ${highlightedPathFromUrl}`);
                   primaryHPath = getPageFilePath(highlightedPathFromUrl, allPaths);
                   const tempSecPaths: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                   const filesToSel = new Set<string>();

                   if(primaryHPath){
                       const pF = fetchedFiles.find(f=>f.path===primaryHPath);
                       if(pF){
                           logger.log(`Fetcher(Manual): Standard Task - Основной файл ${primaryHPath} найден.`);
                           filesToSel.add(primaryHPath);
                           const imps=extractImports(pF.content);
                           logger.log(`Fetcher(Manual): Standard Task - Найдено ${imps.length} импортов в ${primaryHPath}.`);
                           for(const imp of imps){
                               const rP=resolveImportPath(imp, pF.path, fetchedFiles);
                               if(rP && rP !== primaryHPath){
                                   const cat=categorizeResolvedPath(rP);
                                   tempSecPaths[cat].add(rP);
                                   if(cat !== 'other') filesToSel.add(rP); // Auto-select non-other imports
                               }
                           }
                       } else {
                            primaryHPath = null; // Reset if find fails (shouldn't happen if getPageFilePath worked)
                            const findErr = `Ошибка: Путь страницы для URL (${highlightedPathFromUrl}) не найден среди файлов.`;
                            logger.error(`Fetcher(Manual): Standard Task - ${findErr}`);
                            addToast(findErr, 'error');
                       }
                   } else {
                       const warnMsg = `Файл страницы для URL (${highlightedPathFromUrl}) не найден.`;
                       logger.warn(`Fetcher(Manual): Standard Task - ${warnMsg}`);
                       addToast(warnMsg, 'warning');
                   }

                   // Add important files (only for standard flow)
                   logger.log(`Fetcher(Manual): Standard Task - Добавление ${importantFiles.length} важных файлов.`);
                   importantFiles.forEach(p => { if(allPaths.includes(p) && !filesToSel.has(p)) { filesToSel.add(p); } });

                   // Finalize selections and paths for standard flow
                   setPrimaryHighlightedPathState(primaryHPath);
                   finalSecPaths = {component:Array.from(tempSecPaths.component), context:Array.from(tempSecPaths.context), hook:Array.from(tempSecPaths.hook), lib:Array.from(tempSecPaths.lib), other:Array.from(tempSecPaths.other)};
                   setSecondaryHighlightedPathsState(finalSecPaths);
                   setSelectedFilesState(filesToSel); // Set local selection for UI
                   setSelectedFetcherFiles(filesToSel); // Set context selection

                   // Post-fetch actions for standard flow with URL params
                   if(ideaFromUrl && filesToSel.size > 0){
                       const nS = tempSecPaths.component.size + tempSecPaths.context.size + tempSecPaths.hook.size + tempSecPaths.lib.size;
                       const nI = filesToSel.size - (primaryHPath ? 1 : 0) - nS;
                       let msg=`✅ Авто-выбор: `; const pts=[];
                       if(primaryHPath)pts.push(`1 стр`); if(nS>0)pts.push(`${nS} связ`); if(nI>0)pts.push(`${nI} важн`);
                       msg+=pts.join(', ') + ` (${filesToSel.size} всего). Идея добавлена.`;
                       addToast(msg,'success');
                       updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA); // Use prefilled idea
                       await handleAddSelected(filesToSel, fetchedFiles); // Add selection to kwork
                       setTimeout(()=>{addToast("💡 Добавь инструкции!", "info");}, 500);
                   } else if (filesToSel.size > 0) { // Auto-selection without URL idea
                       const nH=tempSecPaths.component.size+tempSecPaths.context.size+tempSecPaths.hook.size+tempSecPaths.lib.size;
                       const nI=filesToSel.size-(primaryHPath?1:0)-nH;
                       let msg=`Авто-выбраны: `; const pts=[];
                       if(primaryHPath)pts.push(`1 осн`); if(nH>0)pts.push(`${nH} связ`); if(nI>0)pts.push(`${nI} важн`);
                       msg+=pts.join(', ')+'.'; addToast(msg,'info');
                   }

                   // Scroll to primary highlighted file or list
                   if (primaryHPath) {
                        setTimeout(()=>{
                            const eId=`file-${primaryHPath}`; const el=document.getElementById(eId);
                            if(el){el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md'); setTimeout(()=>el.classList.remove('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md'),2500);}
                        },400);
                    } else if (fetchedFiles.length > 0) {
                        const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                    if(isSettingsModalOpen) triggerToggleSettingsModal();
               }
               // === Fallback: Standard Fetch without URL params ===
               else {
                   logger.log("Fetcher(Manual): Standard Task - Нет URL параметров, просто загрузка всех файлов.");
                   setFiles(fetchedFiles); // Set local files for display
                   // No automatic selection or kwork update
                   addToast(`Извлечено ${fetchedFiles.length} файлов!`, 'success');
                   if(isSettingsModalOpen) triggerToggleSettingsModal();
                   if (fetchedFiles.length > 0) { // Scroll to file list container
                        const el = document.getElementById('file-list-container'); el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                   }
               }
           } else { // Handle failure from fetchRepoContents directly
               fetchSucceeded = false;
               success = false;
               throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}.`);
           }
       } catch (err: any) { // Catch errors from fetchRepoContents or logic above
           const displayError = err?.message || "Неизвестная ошибка";
           logger.error(`Fetcher(Manual): Ошибка в процессе извлечения - ${displayError}`, err);
           setError(displayError);
           addToast(`Ошибка извлечения: ${displayError}`, 'error');
           success = false; // Ensure overall success is false
           finalStatus = 'error';
           // Ensure state is reset visually, context update happens in finally
           setFiles([]);
           setSelectedFilesState(new Set());
           setPrimaryHighlightedPathState(null);
           setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
       }
       finally {
           stopProgressSimulation();
           setProgress(success ? 100 : 0); // Progress reflects overall success (including finding target file if image task)
           setFetchStatus(finalStatus); // Update context status reflects fetch outcome / target find outcome
           // CRITICAL: Update context with fetched files, highlights, and fetch completion status
           // The 'fetched' flag passed here indicates the fetch attempt completed.
           // The success/failure of the *image replace* task is determined later in the context setter based on whether the target file exists in `fetchedFiles`.
           setFilesFetched(fetchSucceeded, fetchedFiles, primaryHPath, Object.values(finalSecPaths).flat());
           setFiles(fetchedFiles); // Update local files state for UI rendering LAST

           if (imageReplaceTask) {
               // Reset initiation flag ONLY if the fetch itself failed, or if the overall flow failed (success is false)
               if (finalStatus !== 'success' || !success) {
                    logger.log("Fetcher(Manual): Image Task - Сброс флага инициации из-за ошибки или неудачи.");
                    isImageTaskFetchInitiated.current = false;
               }
           }
           logger.log(`Fetcher(Manual): Завершено. Успех API: ${fetchSucceeded}, Успех Общий: ${success}, Финальный статус: ${finalStatus}`);
       }
   }, [ // Dependencies updated
       repoUrl, token, imageReplaceTask, targetBranchName, manualBranchName, assistantLoading, isParsing,
       aiActionLoading, setFetchStatus, setError, setFiles, setSelectedFilesState, setPrimaryHighlightedPathState,
       setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetched, // Using combined context setter
       setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, addToast,
       startProgressSimulation, stopProgressSimulation, triggerToggleSettingsModal, updateKworkInput,
       highlightedPathFromUrl, ideaFromUrl, DEFAULT_TASK_IDEA, importantFiles, isSettingsModalOpen, handleAddSelected,
       logger // Added logger
   ]);

  // --- Эффекты (Используют колбэки, определенные выше) ---
  // Эффект для авто-запуска
  useEffect(() => {
    if (!isMounted) return;

    const branch = targetBranchName || manualBranchName || null;
    // Determine if fetch CAN be triggered based on status and URL
    const canTriggerFetch = autoFetch && repoUrlEntered &&
                           (fetchStatusRef.current === 'idle' || fetchStatusRef.current === 'failed_retries' || fetchStatusRef.current === 'error');

    // Specific readiness check for image task fetch (only once)
    const isImageFetchReady = imageReplaceTask && !isImageTaskFetchInitiated.current;
    // Readiness check for standard auto-fetch
    const isStandardFetchReady = !imageReplaceTask && autoFetch;

    // Trigger condition: Can fetch, not already auto-fetching, AND (image task is ready OR standard fetch is ready)
    if (canTriggerFetch && !isAutoFetchingRef.current && (isImageFetchReady || isStandardFetchReady)) {
        const mode = imageReplaceTask ? "Image Task" : "Standard";
        logger.log(`[AutoFetch Effect] Запуск извлечения (${mode}). Страж активен.`);
        isAutoFetchingRef.current = true; // Set guard BEFORE async call
        handleFetchManual(false, branch)
            .catch(err => { logger.error(`[AutoFetch Effect] handleFetchManual (${mode}) выбросил ошибку:`, err); })
            .finally(() => {
                // Reset guard AFTER a small delay to prevent rapid re-triggering if state updates are fast
                setTimeout(() => {
                    logger.log("[AutoFetch Effect] Сброс стража извлечения.");
                    isAutoFetchingRef.current = false;
                 }, 300); // 300ms delay before allowing another auto-fetch
             });
    } else if (canTriggerFetch && isAutoFetchingRef.current) { logger.log("[AutoFetch Effect] Пропуск: Страж уже активен."); }
    else if (imageReplaceTask && isImageTaskFetchInitiated.current) { logger.log("[AutoFetch Effect] Пропуск: Загрузка для задачи картинки уже инициирована."); }

  }, [ isMounted, repoUrlEntered, autoFetch, targetBranchName, manualBranchName, imageReplaceTask, handleFetchManual, logger ]); // Added logger dependency


  // Эффект для авто-добавления зависимостей (Disabled for image task)
  useEffect(() => {
      if(!isMounted || files.length===0 || imageReplaceTask || fetchStatusRef.current !== 'success'){ // Added imageReplaceTask check
          prevSelectedFilesRef.current = new Set(selectedFiles);
          return;
      }
      // --- Rest of the effect logic remains the same ---
      const newSelPaths=new Set<string>(); selectedFiles.forEach(p => { if(!prevSelectedFilesRef.current.has(p)) { newSelPaths.add(p); } });
      if(primaryHighlightedPath && selectedFiles.has(primaryHighlightedPath) && !prevSelectedFilesRef.current.has(primaryHighlightedPath) && !newSelPaths.has(primaryHighlightedPath)){ newSelPaths.add(primaryHighlightedPath); }
      if(newSelPaths.size === 0){ prevSelectedFilesRef.current = new Set(selectedFiles); return; }
      const pgSuffixes=['/page.tsx','/page.js','/index.tsx','/index.js']; const filesToCheck=Array.from(newSelPaths).filter(p => pgSuffixes.some(s=>p.endsWith(s)) || p===primaryHighlightedPath);
      if(filesToCheck.length > 0){ const relatedToSel = new Set<string>(); let foundCount = 0; filesToCheck.forEach(fp => { const fNode = files.find(f => f.path === fp); if(fNode){ const imps = extractImports(fNode.content); imps.forEach(imp => { const rP = resolveImportPath(imp, fNode.path, files); if(rP && rP !== fp){ const cat = categorizeResolvedPath(rP); if(cat !== 'other'){ if(!selectedFiles.has(rP)){ relatedToSel.add(rP); foundCount++; } } } }); } });
          if(relatedToSel.size > 0){ const finalSel = new Set([...selectedFiles, ...relatedToSel]); setSelectedFilesState(finalSel); setSelectedFetcherFiles(finalSel); addToast(`🔗 Авто-добавлено ${foundCount} связанных`, 'info'); prevSelectedFilesRef.current = finalSel; return; }
      }
      prevSelectedFilesRef.current = new Set(selectedFiles);
  }, [selectedFiles, files, fetchStatus, primaryHighlightedPath, imageReplaceTask, setSelectedFetcherFiles, addToast, isMounted]); // Добавил isMounted and imageReplaceTask

  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({
      handleFetch: handleFetchManual, // Экспортируем ручную версию
      selectHighlightedFiles,
      handleAddSelected,
      handleCopyToClipboard,
      clearAll: handleClearAll,
      getKworkInputValue
  }), [handleFetchManual, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]); // Зависимости корректны

  // === Логика рендеринга ===
  if (!isMounted) {
      return (
          <div id="extractor-loading" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden min-h-[300px] flex items-center justify-center">
              <p className="text-gray-400 text-lg animate-pulse flex items-center gap-2"><FaSpinner className="animate-spin"/> Инициализация Экстрактора...</p>
          </div>
      );
  }

  // Вычисляемые переменные для JSX (AFTER isMounted check)
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const showProgressBar = fetchStatus !== 'idle';
  // Fetch button disabled if loading anything OR no URL entered
  const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading;
  // General action disable (copy, clear, add selected, list interactions) - disabled if loading OR image task active
  const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!imageReplaceTask;
  const isAskAiDisabled = isActionDisabled || !kworkInputHasContent; // Disable AI if actions disabled or no kwork input
  const isCopyDisabled = !kworkInputHasContent || isActionDisabled;
  const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled;
  const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled;
  const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
  const isWaitingForAi = aiActionLoading && !!currentAiRequestId;
  // Check if the target file for image replacement exists and fetch was successful
  const imageTaskTargetFileReady = imageReplaceTask && fetchStatus === 'success' && files.some(f => f.path === imageReplaceTask.targetPath);


  // JSX Возврат
  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Заголовок и инструкции */}
       <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
            <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                     <FaDownload className="text-purple-400" />
                     {imageReplaceTask ? "Задача: Замена Картинки" : "Кибер-Экстрактор Кода"}
                 </h2>
                 {/* Standard Instructions */}
                 {!imageReplaceTask && (
                     <>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Настрой URL/токен/ветку (<FaCodeBranch title="Открыть настройки" className="inline text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}/>).</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Жми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы для контекста.</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-1">4. Опиши задачу ИЛИ добавь файлы (<FaPlus className="inline text-sm"/>).</p>
                         <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Жми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.</p>
                     </>
                 )}
                 {/* Image Task Instructions */}
                 {imageReplaceTask && (
                     <p className="text-blue-300/80 text-xs md:text-sm mb-2">Автоматическая загрузка файла <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">{imageReplaceTask.targetPath}</code> для замены картинки...</p>
                 )}
             </div>
             {/* Settings Toggle Button - Disable if fetch is active, allow otherwise */}
            <motion.button
                 onClick={triggerToggleSettingsModal}
                 disabled={isLoading} // Only disable during actual fetch/retry
                 whileHover={{ scale: isLoading ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                 whileTap={{ scale: isLoading ? 1 : 0.95 }}
                 title={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                 aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                 aria-expanded={isSettingsModalOpen}
                 className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"
             >
                {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />}
            </motion.button>
        </div>
      {/* Модальное окно настроек */}
       <SettingsModal isOpen={isSettingsModalOpen} repoUrl={repoUrl} setRepoUrl={handleRepoUrlChange} token={token} setToken={setToken} manualBranchName={manualBranchName} setManualBranchName={handleManualBranchChange} currentTargetBranch={targetBranchName} openPrs={openPrs} loadingPrs={loadingPrs} onSelectPrBranch={handleSelectPrBranch} onLoadPrs={handleLoadPrs} loading={isLoading || loadingPrs || assistantLoading || aiActionLoading} />

      {/* Кнопка "Извлечь файлы" */}
       <div className="mb-4 flex justify-center">
            <motion.button
                onClick={() => { handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error'); }}
                // Disable fetch button based on broader loading state OR if image task already initiated fetch
                disabled={isFetchDisabled || (imageReplaceTask && isImageTaskFetchInitiated.current && isLoading)}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${(isFetchDisabled || (imageReplaceTask && isImageTaskFetchInitiated.current && isLoading)) ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`}
                whileHover={{ scale: (isFetchDisabled || (imageReplaceTask && isImageTaskFetchInitiated.current && isLoading)) ? 1 : 1.03 }}
                whileTap={{ scale: (isFetchDisabled || (imageReplaceTask && isImageTaskFetchInitiated.current && isLoading)) ? 1 : 0.97 }}
                title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}${imageReplaceTask ? ' (для замены картинки)' : ''}`}
            >
                {isLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)}
                {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")}
                <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
            </motion.button>
        </div>

      {/* Прогресс-бар и область статуса */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                 {isParsing && !imageReplaceTask && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа...</p>}
                 {fetchStatus === 'success' && files.length > 0 && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, 0 файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {/* Image Task Success Message */}
                 {imageTaskTargetFileReady && (
                    <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                        <FaCircleCheck /> {`Файл ${imageReplaceTask?.targetPath.split('/').pop()} загружен для замены.`}
                    </div>
                 )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}

      {/* Основная область контента */}
       {/* Grid layout depends on whether files are shown AND if kwork input should be shown (not during image task) */}
       <div className={`grid grid-cols-1 ${ (files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>
         {/* File List Area - Show if loading OR files exist */}
         {(isLoading || files.length > 0) && (
             <div className="flex flex-col gap-4">
                 <SelectedFilesPreview
                    selectedFiles={selectedFiles}
                    allFiles={files}
                    getLanguage={getLanguage}
                    isActionDisabled={isActionDisabled} // Pass disabled state
                 />
                 <FileList
                    id="file-list-container"
                    files={files}
                    selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath} // Used for UI highlight
                    secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles}
                    isLoading={isLoading}
                    isActionDisabled={isActionDisabled} // Pass disabled state
                    toggleFileSelection={toggleFileSelection}
                    onAddSelected={() => handleAddSelected()}
                    onAddImportant={handleAddImportantFiles}
                    onAddTree={handleAddFullTree}
                    onSelectHighlighted={selectHighlightedFiles}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                 />
             </div>
         )}

         {/* Request Input Area - Show ONLY if NOT image task AND (files exist OR kwork has content) */}
         {!imageReplaceTask && (files.length > 0 || kworkInputHasContent) ? (
             <div id="kwork-input-section" className="flex flex-col gap-3">
                 <RequestInput
                     kworkInputRef={localKworkInputRef}
                     onCopyToClipboard={() => handleCopyToClipboard(undefined, true)}
                     onClearAll={handleClearAll}
                     isCopyDisabled={isCopyDisabled}
                     isClearDisabled={isClearDisabled}
                     onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                     onAskAi={triggerAskAi}
                     isAskAiDisabled={isAskAiDisabled} // Use calculated disabled state
                     aiActionLoading={aiActionLoading}
                     onAddSelected={() => handleAddSelected()}
                     isAddSelectedDisabled={isAddSelectedDisabled}
                     selectedFetcherFilesCount={selectedFiles.size}
                 />
             </div>
         ) : null }

         {/* Image Task Status Placeholder - Show if image task AND target file ready */}
         {imageReplaceTask && imageTaskTargetFileReady && (
             <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed border-blue-400 min-h-[200px]`}>
                 {(assistantLoading || aiActionLoading) ? (
                     <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" />
                 ) : (
                     <FaCircleCheck className="text-green-400 text-3xl mb-3" />
                 )}
                 <p className="text-sm text-blue-300">
                     {(assistantLoading || aiActionLoading) ? "Обработка замены..." : `Файл ${imageReplaceTask?.targetPath.split('/').pop()} готов.`}
                 </p>
                 <p className="text-xs text-gray-400 mt-1">
                     {(assistantLoading || aiActionLoading) ? "Создание/обновление PR..." : "Передано Ассистенту для создания PR..."}
                 </p>
             </div>
         )}
      </div>
    </div>
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;