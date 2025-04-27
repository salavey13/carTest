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
  const [isMounted, setIsMounted] = useState(false);
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
      fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched: setFilesFetchedCombined, // Use context setter
      setSelectedFetcherFiles, // Context's selection state
      kworkInputHasContent, setKworkInputHasContent, setRequestCopied,
      aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing, currentAiRequestId,
      targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs, setOpenPrs,
      setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal, kworkInputRef, triggerAskAi,
      triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection,
      setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles, imageReplaceTask,
      allFetchedFiles // Context now holds the definitive list
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
  // FIX: Added isMounted guard here to potentially help with initial state propagation timing
  useEffect(() => {
      if (isMounted) { // Check if mounted before updating context
          setRepoUrlEntered(repoUrl.trim().length > 0);
          updateRepoUrlInAssistant(repoUrl);
          // Keep original logic for resetting state on URL change, but ensure it only runs client-side
          setOpenPrs([]);
          setTargetBranchName(null);
          setManualBranchName("");
      }
  }, [isMounted, repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]); // Обновляем URL в ассистенте
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
  }, [stopProgressSimulation, logger, fetchStatusRef]); // Added fetchStatusRef dependency

  // 3. Обработчики UI и взаимодействий (зависят от базовых утилит)
  const handleRepoUrlChange = useCallback((url: string) => {
        setRepoUrlState(url);
        // Context update is now handled by the useEffect watching repoUrl and isMounted
    }, []); // Removed context setters, they are handled by useEffect

  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => {
        const c=textToCopy??getKworkInputValue();
        if(!c.trim()){addToast("Нет текста для копирования",'warning');return false;}
        try{
            navigator.clipboard.writeText(c);
            addToast("Скопировано в буфер!",'success');
            setRequestCopied(true);
            if(shouldScroll)scrollToSection('executor');
            return true;
        }catch(e){
            logger.error("Ошибка копирования:",e);
            addToast("Ошибка копирования",'error');
            return false;
        }
   }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied, logger]); // Added logger

  const handleClearAll = useCallback(() => {
       if (imageReplaceTask) { // Prevent clearing during image task
           addToast("Очистка недоступна во время замены картинки.", "warning");
           return;
       }
       logger.log("Fetcher: Очистка состояния."); // Use logger
       setSelectedFilesState(new Set()); // Clear local selection
       setSelectedFetcherFiles(new Set()); // Clear context selection
       updateKworkInput(""); // Clear kwork input
       setPrimaryHighlightedPathState(null); // Clear highlights
       setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
       // Clear downstream context states as well
       setAiResponseHasContent(false);
       setFilesParsed(false);
       setSelectedAssistantFiles(new Set());
       setRequestCopied(false);
       addToast("Очищено ✨", 'success');
       if (localKworkInputRef.current) localKworkInputRef.current.focus(); // Focus kwork input
    }, [ imageReplaceTask, setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied, logger ]); // Added dependencies

  const selectHighlightedFiles = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      const fTS=new Set<string>(selectedFiles); let nSC=0;
      const aHLS=[
          ...secondaryHighlightedPaths.component,
          ...secondaryHighlightedPaths.context,
          ...secondaryHighlightedPaths.hook,
          ...secondaryHighlightedPaths.lib
      ];
      // Add primary if it exists, is in files, and not already selected
      if(primaryHighlightedPath && files.some(f=>f.path===primaryHighlightedPath) && !fTS.has(primaryHighlightedPath)){
          fTS.add(primaryHighlightedPath); nSC++;
      }
      // Add secondary highlights
      aHLS.forEach(p=>{
          if(files.some(f=>f.path===p) && !fTS.has(p)){
              fTS.add(p); nSC++;
          }
      });
      if(nSC > 0){
          setSelectedFilesState(fTS); // Update local state
          setSelectedFetcherFiles(fTS); // Update context state
          addToast(`${nSC} связанных файлов добавлено в выборку`, 'info');
      } else {
          addToast("Все связанные файлы уже выбраны", 'info');
      }
  }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast, imageReplaceTask ]); // Added imageReplaceTask

  const toggleFileSelection = useCallback((path: string) => {
      if (imageReplaceTask) return; // Prevent selection changes during image task
      setSelectedFilesState(prevSet => {
            const newSet = new Set(prevSet);
            if(newSet.has(path)){ newSet.delete(path); }
            else{ newSet.add(path); }
            // Debounce context update slightly for better performance with rapid clicks
            if (selectionUpdateTimeoutRef.current) clearTimeout(selectionUpdateTimeoutRef.current);
            selectionUpdateTimeoutRef.current = setTimeout(() => {
                setSelectedFetcherFiles(new Set(newSet)); // Update context after debounce
                selectionUpdateTimeoutRef.current = null;
            }, 150);
            return newSet; // Update local state immediately for UI responsiveness
        });
  }, [setSelectedFetcherFiles, imageReplaceTask]); // Added imageReplaceTask

  const handleAddImportantFiles = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      let addedCount=0; const filesToAdd=new Set(selectedFiles);
      importantFiles.forEach(p=>{
          // Check if file exists in fetched files and is not already selected
          if(files.some(f=>f.path===p) && !selectedFiles.has(p)){
              filesToAdd.add(p); addedCount++;
          }
      });
      if(addedCount === 0){
          addToast("Все важные файлы уже выбраны", 'info'); return;
      }
      setSelectedFilesState(filesToAdd); // Update local state
      setSelectedFetcherFiles(filesToAdd); // Update context state
      addToast(`Добавлено ${addedCount} важных файлов`, 'success');
  }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast, imageReplaceTask]); // Added imageReplaceTask

  const handleAddFullTree = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      if(files.length===0){addToast("Нет файлов для добавления дерева",'warning'); return;}
      // Format file tree nicely
      const treeOutput=files.map((f)=>`- /${f.path}`).sort().join("\n");
      const treeCodeBlock=`Структура Файлов Проекта:\n\`\`\`\n${treeOutput}\n\`\`\``;
      let added=false; const currentKworkValue=getKworkInputValue(); const trimmedKworkValue=currentKworkValue.trim();
      // Check if tree structure is already present (simple check)
      const hasTree=/Структура Файлов Проекта:\s*```/im.test(trimmedKworkValue);
      if(!hasTree){
          const newValue=trimmedKworkValue ? `${trimmedKworkValue}\n\n${treeCodeBlock}` : treeCodeBlock;
          updateKworkInput(newValue);
          added=true;
      }
      if(added){
          addToast("Дерево файлов добавлено в запрос",'success');
          scrollToSection('kworkInput'); // Scroll to kwork input
      } else {
          addToast("Дерево файлов уже добавлено в запрос", 'info');
      }
  }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast, imageReplaceTask]); // Added imageReplaceTask

  const handleSelectPrBranch = useCallback((branch: string | null) => {
        setTargetBranchName(branch);
        if(branch) addToast(`Выбрана ветка PR: ${branch}`, 'success');
        else addToast(`Выбор ветки PR снят. Будет использована ветка по умолчанию или ручная.`, 'info');
    }, [setTargetBranchName, addToast]);

  const handleManualBranchChange = useCallback((name: string) => {
        setManualBranchName(name);
        if(name.trim()) {
             setTargetBranchName(null); // Clear PR branch selection if manual branch is entered
        }
    }, [setManualBranchName, setTargetBranchName]);

  const handleLoadPrs = useCallback(() => {
        triggerGetOpenPRs(repoUrl);
    }, [triggerGetOpenPRs, repoUrl]);

  const handleSelectAll = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      if(files.length===0) return;
      const allPaths=new Set(files.map(f=>f.path));
      setSelectedFilesState(allPaths); // Update local state
      setSelectedFetcherFiles(allPaths); // Update context state
      addToast(`Выбрано ${allPaths.size} файлов`,'info');
  }, [files, setSelectedFetcherFiles, addToast, imageReplaceTask]); // Added imageReplaceTask

  const handleDeselectAll = useCallback(() => {
      if (imageReplaceTask) return; // Skip if image task active
      setSelectedFilesState(new Set()); // Update local state
      setSelectedFetcherFiles(new Set()); // Update context state
      addToast("Выбор снят со всех файлов",'info');
  }, [setSelectedFetcherFiles, addToast, imageReplaceTask]); // Added imageReplaceTask

  // 4. Основная функция добавления выбранных (зависит от getKworkInputValue, updateKworkInput, scrollToSection, addToast)
  const handleAddSelected = useCallback(async (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => {
      if (imageReplaceTask) return; // Skip if image task active
      const filesToProcess = allFilesParam || files; // Use passed files or local state
      const filesToAdd = filesToAddParam || selectedFiles; // Use passed selection or local state

      if(filesToProcess.length===0 && filesToAdd.size > 0){
          addToast("Файлы еще не загружены.",'error'); return;
      }
      if(filesToAdd.size === 0){
          addToast("Сначала выберите файлы для добавления.",'warning'); return;
      }

      const prefix="Контекст кода для анализа:\n";
      // Create markdown code blocks for selected files
      const markdownText = filesToProcess
        .filter(f => filesToAdd.has(f.path))
        .sort((a,b) => a.path.localeCompare(b.path)) // Sort alphabetically
        .map(f => {
            const pathComment = `// /${f.path}`;
            // Avoid adding duplicate path comment if already present
            const contentAlreadyHasComment = f.content.trimStart().startsWith(pathComment);
            const contentToAdd = contentAlreadyHasComment ? f.content : `${pathComment}\n${f.content}`;
            return `\`\`\`${getLanguage(f.path)}\n${contentToAdd}\n\`\`\``;
        })
        .join("\n\n");

      const currentKworkValue = getKworkInputValue();
      // Remove existing code context block if present, keep the rest of the text
      const contextRegex = /Контекст кода для анализа:[\s\S]*/;
      const textWithoutContext = currentKworkValue.replace(contextRegex, '').trim();

      // Combine existing text (if any) with the new code context
      const newContent = `${textWithoutContext ? textWithoutContext+'\n\n' : ''}${prefix}${markdownText}`;

      updateKworkInput(newContent); // Update the textarea
      addToast(`${filesToAdd.size} файлов добавлено в запрос`, 'success');
      scrollToSection('kworkInput'); // Scroll to the input field
  }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection, imageReplaceTask]); // Added imageReplaceTask

  // 5. Основная функция извлечения (handleFetchManual) - Modified for Image Task
  const handleFetchManual = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
      const effectiveBranch = branchNameToFetch || targetBranchName || manualBranchName || 'default';
      logger.log(`Fetcher(Manual): Старт извлечения. Повтор: ${isManualRetry}, Ветка: ${effectiveBranch}, ImageTask: ${!!imageReplaceTask}`);

      // --- Initiation Guards ---
      if (imageReplaceTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) { logger.warn("Fetcher(Manual): Загрузка для задачи картинки уже идет. Отмена дубликата."); return; }
      if (!imageReplaceTask && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { logger.warn("Fetcher(Manual): Уже идет загрузка (стандартный режим)."); addToast("Уже идет загрузка...", "info"); return; }
      if (!repoUrl.trim()) { logger.error("Fetcher(Manual): URL пуст."); addToast("Введите URL репозитория", 'error'); setError("URL репозитория не указан."); triggerToggleSettingsModal(); return; }
      // FIX: Replace isWaitingForAi with aiActionLoading
      if (assistantLoading || isParsing || aiActionLoading) {
          logger.warn(`Fetcher(Manual): Заблокировано состоянием (${assistantLoading}, ${isParsing}, ${aiActionLoading}).`);
          addToast("Подождите завершения предыдущей операции.", "warning"); return;
      }

      // --- Start Fetch Process ---
      logger.log("Fetcher(Manual): Запускаем процесс.");
      setFetchStatus('loading'); // Set local status for immediate UI feedback
      setError(null); setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
      setSelectedFetcherFiles(new Set()); // Clear context selection too

      // Clear downstream state ONLY if NOT an image task
      if (!imageReplaceTask) {
            setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
            // Prefill kwork only for standard flow, if not highlighted from URL
            if (!highlightedPathFromUrl && localKworkInputRef.current) {
                updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA);
            }
       } else {
           logger.log("Fetcher(Manual): Режим Замены Картинки - очистка Kwork, установка флага.");
           isImageTaskFetchInitiated.current = true; // Set flag HERE
           updateKworkInput(""); // Clear kwork for image task
       }

       addToast(`Запрос файлов из ветки (${effectiveBranch})...`, 'info');
       startProgressSimulation(13); // Start progress simulation
       logger.log("Fetcher(Manual): Симуляция прогресса запущена.");

       let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
       let fetchAttemptSucceeded = false; // Tracks if the API call itself was successful
       let fetchedFilesData: FileNode[] = []; // Store fetched files data
       let primaryHighlightPath: string | null = null; // Store primary path
       let secondaryHighlightPaths: Record<ImportCategory, string[]> = {component: [], context: [], hook: [], lib: [], other: []}; // Store secondary paths

       try {
           result = await fetchRepoContents(repoUrl, token || undefined, effectiveBranch);

           if (result?.success && Array.isArray(result.files)) {
               fetchAttemptSucceeded = true; // Mark API call as successful
               fetchedFilesData = result.files; // Store fetched files immediately
               const allPaths = fetchedFilesData.map(f => f.path);
               logger.log(`Fetcher(Manual): Успешно извлечено ${fetchedFilesData.length} файлов из '${effectiveBranch}'.`);

               // === Image Replace Task Path ===
               if(imageReplaceTask){
                   logger.log(`Fetcher(Manual): Image Task - Проверка целевого файла ${imageReplaceTask.targetPath}`);
                   primaryHighlightPath = imageReplaceTask.targetPath;
                   setPrimaryHighlightedPathState(primaryHighlightPath); // UI highlight

                   // Check existence is handled within setFilesFetchedCombined in context
                   if (allPaths.includes(primaryHighlightPath)) {
                       logger.log(`Fetcher(Manual): Image Task - Целевой файл ${primaryHighlightPath} найден.`);
                       setSelectedFilesState(new Set([primaryHighlightPath])); // Local UI selection only
                       addToast(`Файл для замены (${primaryHighlightPath.split('/').pop()}) загружен.`, 'success');
                   } else {
                        // Error state will be set by context based on this flag
                        logger.error(`Fetcher(Manual): Image Task - Целевой файл ${primaryHighlightPath} НЕ найден.`);
                        setError(`Файл (${primaryHighlightPath}) не найден в '${effectiveBranch}'.`);
                        addToast(`Файл (${primaryHighlightPath}) не найден в '${effectiveBranch}'.`, 'error');
                        setSelectedFilesState(new Set()); // Clear local UI selection
                   }
                   if(isSettingsModalOpen) triggerToggleSettingsModal(); // Close settings modal if open
                   secondaryHighlightPaths = { component: [], context: [], hook: [], lib: [], other: [] }; // No secondary for image task
               }
               // === Standard Fetch Path (with URL params) ===
               else if (highlightedPathFromUrl){
                   logger.log(`Fetcher(Manual): Standard Task - Поиск основного файла для URL ${highlightedPathFromUrl}`);
                   primaryHighlightPath = getPageFilePath(highlightedPathFromUrl, allPaths);
                   const tempSecPathsSet: Record<ImportCategory, Set<string>> = {component:new Set(), context:new Set(), hook:new Set(), lib:new Set(), other:new Set()};
                   const filesToAutoSelect = new Set<string>();

                   if(primaryHighlightPath){
                       const primaryFileNode = fetchedFilesData.find(f=>f.path===primaryHighlightPath);
                       if(primaryFileNode){
                           logger.log(`Fetcher(Manual): Standard Task - Основной файл ${primaryHighlightPath} найден.`);
                           filesToAutoSelect.add(primaryHighlightPath);
                           const imports = extractImports(primaryFileNode.content);
                           logger.log(`Fetcher(Manual): Standard Task - Найдено ${imports.length} импортов в ${primaryHighlightPath}.`);
                           for(const imp of imports){
                               const resolvedPath = resolveImportPath(imp, primaryFileNode.path, fetchedFilesData);
                               if(resolvedPath && resolvedPath !== primaryHighlightPath){
                                   const category = categorizeResolvedPath(resolvedPath);
                                   tempSecPathsSet[category].add(resolvedPath);
                                   if(category !== 'other') filesToAutoSelect.add(resolvedPath); // Auto-select non-other imports
                               }
                           }
                       } else {
                            primaryHighlightPath = null; // Reset if find fails
                            const findErr = `Ошибка: Путь страницы для URL (${highlightedPathFromUrl}) не найден среди файлов.`;
                            logger.error(`Fetcher(Manual): Standard Task - ${findErr}`);
                            addToast(findErr, 'error');
                       }
                   } else {
                       const warnMsg = `Файл страницы для URL (${highlightedPathFromUrl}) не найден. Выберите файлы вручную.`;
                       logger.warn(`Fetcher(Manual): Standard Task - ${warnMsg}`);
                       addToast(warnMsg, 'warning');
                   }

                   // Add important files (only for standard flow)
                   logger.log(`Fetcher(Manual): Standard Task - Добавление ${importantFiles.length} важных файлов.`);
                   importantFiles.forEach(p => { if(allPaths.includes(p) && !filesToAutoSelect.has(p)) { filesToAutoSelect.add(p); } });

                   // Finalize paths and selections for standard flow
                   setPrimaryHighlightedPathState(primaryHighlightPath);
                   secondaryHighlightPaths = {
                       component:Array.from(tempSecPathsSet.component),
                       context:Array.from(tempSecPathsSet.context),
                       hook:Array.from(tempSecPathsSet.hook),
                       lib:Array.from(tempSecPathsSet.lib),
                       other:Array.from(tempSecPathsSet.other)
                   };
                   setSecondaryHighlightedPathsState(secondaryHighlightPaths);
                   setSelectedFilesState(filesToAutoSelect); // Set local selection for UI
                   setSelectedFetcherFiles(filesToAutoSelect); // Set context selection for standard flow

                   // Post-fetch actions for standard flow with URL params
                   if(ideaFromUrl && filesToAutoSelect.size > 0){
                       const numSecondary = tempSecPathsSet.component.size + tempSecPathsSet.context.size + tempSecPathsSet.hook.size + tempSecPathsSet.lib.size;
                       const numImportant = filesToAutoSelect.size - (primaryHighlightPath ? 1 : 0) - numSecondary;
                       let msg=`✅ Авто-выбор: `; const parts=[];
                       if(primaryHighlightPath)parts.push(`1 стр.`); if(numSecondary>0)parts.push(`${numSecondary} связ.`); if(numImportant>0)parts.push(`${numImportant} важн.`);
                       msg+=parts.join(', ') + ` (${filesToAutoSelect.size} всего). Идея добавлена.`;
                       addToast(msg,'success');
                       updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA); // Use prefilled idea
                       await handleAddSelected(filesToAutoSelect, fetchedFilesData); // Add selection to kwork
                       setTimeout(()=>{addToast("💡 Добавь инструкции или уточни запрос!", "info");}, 500);
                   } else if (filesToAutoSelect.size > 0) { // Auto-selection without URL idea
                       const numSecondary=tempSecPathsSet.component.size+tempSecPathsSet.context.size+tempSecPathsSet.hook.size+tempSecPathsSet.lib.size;
                       const numImportant=filesToAutoSelect.size-(primaryHighlightPath?1:0)-numSecondary;
                       let msg=`Авто-выбраны: `; const parts=[];
                       if(primaryHighlightPath)parts.push(`1 осн.`); if(numSecondary>0)parts.push(`${numSecondary} связ.`); if(numImportant>0)parts.push(`${numImportant} важн.`);
                       msg+=parts.join(', ')+'.'; addToast(msg,'info');
                       updateKworkInput(DEFAULT_TASK_IDEA); // Set default idea
                   } else {
                        // No files auto-selected, set default idea
                        updateKworkInput(DEFAULT_TASK_IDEA);
                   }

                   // --- SCROLL FIX: Only scroll here if ideaFromUrl was NOT present ---
                   if (!ideaFromUrl) {
                       if (primaryHighlightPath) {
                            setTimeout(()=>{
                                const elementId=`file-${primaryHighlightPath}`; const element=document.getElementById(elementId);
                                if(element){element.scrollIntoView({behavior:"smooth",block:"center"}); element.classList.add('highlight-scroll'); setTimeout(()=>element.classList.remove('highlight-scroll'),2500);}
                                else { logger.warn(`Scroll target ${elementId} not found for primary highlight.`); }
                            },400);
                        } else if (fetchedFilesData.length > 0) {
                            scrollToSection('file-list-container'); // Scroll to file list if no primary highlight
                        }
                   }
                   // --- END SCROLL FIX ---

                   if(isSettingsModalOpen) triggerToggleSettingsModal(); // Close settings modal
               }
               // === Fallback: Standard Fetch without URL params ===
               else {
                   logger.log("Fetcher(Manual): Standard Task - Нет URL параметров, просто загрузка всех файлов.");
                   // setFiles is called in finally
                   addToast(`Извлечено ${fetchedFilesData.length} файлов! Выберите нужные.`, 'success');
                   updateKworkInput(DEFAULT_TASK_IDEA); // Set default task idea
                   if(isSettingsModalOpen) triggerToggleSettingsModal();
                   if (fetchedFilesData.length > 0) { // Scroll to file list container
                        scrollToSection('file-list-container');
                   }
                   // No automatic selection or highlight paths for this case
                   primaryHighlightPath = null;
                   secondaryHighlightPaths = { component: [], context: [], hook: [], lib: [], other: [] };
               }
           } else { // Handle failure from fetchRepoContents directly
               fetchAttemptSucceeded = false;
               throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}. Проверьте URL, токен и имя ветки.`);
           }
       } catch (err: any) { // Catch errors from fetchRepoContents or logic above
           const displayError = err?.message || "Неизвестная ошибка при извлечении файлов.";
           logger.error(`Fetcher(Manual): Ошибка в процессе извлечения - ${displayError}`, err);
           setError(displayError);
           addToast(`Ошибка извлечения: ${displayError}`, 'error');
           fetchAttemptSucceeded = false; // Ensure API success flag is false
           // Reset local state immediately for UI clarity
           setFiles([]);
           setSelectedFilesState(new Set());
           setPrimaryHighlightedPathState(null);
           setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] });
           // Context state (including fetchStatus) will be updated in finally
       }
       finally {
           stopProgressSimulation(); // Stop progress simulation regardless of outcome

           // Call the combined context setter function, passing API success status and fetched data
           setFilesFetchedCombined(
               fetchAttemptSucceeded,
               fetchedFilesData,
               primaryHighlightPath,
               Object.values(secondaryHighlightPaths).flat() // Flatten secondary paths for context
            );

           // Update local state AFTER context update
           setFiles(fetchedFilesData); // Update local files state for UI rendering
           // Determine overall success based on API success AND target file found (if image task)
           const overallSuccess = fetchAttemptSucceeded && (!imageReplaceTask || fetchedFilesData.some(f => f.path === imageReplaceTask.targetPath));
           setProgress(overallSuccess ? 100 : 0); // Set progress bar based on overall success
           setFetchStatus(overallSuccess ? 'success' : 'error'); // Update local fetch status for UI feedback

           if (imageReplaceTask) {
               // Reset initiation flag ONLY if the operation failed overall
               if (!overallSuccess) {
                    logger.log("Fetcher(Manual): Image Task - Сброс флага инициации из-за ошибки или неудачи.");
                    isImageTaskFetchInitiated.current = false;
               }
           }
           logger.log(`Fetcher(Manual): Завершено. Успех API: ${fetchAttemptSucceeded}, Успех Общий: ${overallSuccess}, Финальный статус в Fetcher: ${overallSuccess ? 'success' : 'error'}`);
       }
   }, [ // Dependencies updated
       repoUrl, token, imageReplaceTask, targetBranchName, manualBranchName, assistantLoading, isParsing,
       aiActionLoading, setFetchStatus, setError, setFiles, setSelectedFilesState, setPrimaryHighlightedPathState,
       setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetchedCombined, // Using combined context setter
       setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, addToast,
       startProgressSimulation, stopProgressSimulation, triggerToggleSettingsModal, updateKworkInput,
       highlightedPathFromUrl, ideaFromUrl, // Added ideaFromUrl dependency for scroll fix
       DEFAULT_TASK_IDEA, importantFiles, isSettingsModalOpen, handleAddSelected,
       logger, scrollToSection // Added logger & scrollToSection
   ]);


  // --- Эффекты (Используют колбэки, определенные выше) ---
  // Эффект для авто-запуска
  useEffect(() => {
    if (!isMounted) return;

    const branch = targetBranchName || manualBranchName || null;
    // Determine if fetch CAN be triggered based on status and URL
    const canTriggerFetch = autoFetch && repoUrlEntered &&
                           (fetchStatusRef.current === 'idle' || fetchStatusRef.current === 'failed_retries' || fetchStatusRef.current === 'error');

    // Specific readiness check for image task fetch (only once per task)
    const isImageFetchReady = imageReplaceTask && !isImageTaskFetchInitiated.current;
    // Readiness check for standard auto-fetch (not needed if image task is active)
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
      // Check which files were newly selected compared to the previous render
      const newlySelectedPaths=new Set<string>();
      selectedFiles.forEach(p => { if(!prevSelectedFilesRef.current.has(p)) { newlySelectedPaths.add(p); } });

      // Include the primary highlighted path if it was newly selected
      if(primaryHighlightedPath && selectedFiles.has(primaryHighlightedPath) && !prevSelectedFilesRef.current.has(primaryHighlightedPath) && !newlySelectedPaths.has(primaryHighlightedPath)){
          newlySelectedPaths.add(primaryHighlightedPath);
      }

      if(newlySelectedPaths.size === 0){
          prevSelectedFilesRef.current = new Set(selectedFiles);
          return; // No newly selected files to process
      }

      // Find imports only for newly selected files that look like components/pages
      const pageSuffixes=['/page.tsx','/page.js','/index.tsx','/index.js', '.tsx', '.jsx']; // Broader check
      const filesToCheck=Array.from(newlySelectedPaths).filter(p => pageSuffixes.some(s=>p.endsWith(s)) || p.includes('/components/') || p===primaryHighlightedPath);

      if(filesToCheck.length > 0){
          const relatedPathsToSelect = new Set<string>();
          let foundCount = 0;
          filesToCheck.forEach(filePath => {
              const fileNode = files.find(f => f.path === filePath);
              if(fileNode){
                  const imports = extractImports(fileNode.content);
                  imports.forEach(imp => {
                      const resolvedPath = resolveImportPath(imp, fileNode.path, files);
                      // Select if resolved, not the file itself, and not already selected
                      if(resolvedPath && resolvedPath !== filePath && !selectedFiles.has(resolvedPath)){
                          const category = categorizeResolvedPath(resolvedPath);
                          if(category !== 'other'){ // Auto-select non-other imports
                              relatedPathsToSelect.add(resolvedPath);
                              foundCount++;
                          }
                      }
                  });
              }
          });

          if(relatedPathsToSelect.size > 0){
              const finalSelection = new Set([...selectedFiles, ...relatedPathsToSelect]);
              setSelectedFilesState(finalSelection); // Update local state
              setSelectedFetcherFiles(finalSelection); // Update context state
              addToast(`🔗 Авто-добавлено ${foundCount} связанных файлов`, 'info');
              prevSelectedFilesRef.current = finalSelection; // Update ref for next render
              return; // Exit after updating
          }
      }
      // Update ref if no related files were added
      prevSelectedFilesRef.current = new Set(selectedFiles);
  }, [selectedFiles, files, fetchStatus, primaryHighlightedPath, imageReplaceTask, setSelectedFetcherFiles, addToast, isMounted]); // Dependencies updated


  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({
      handleFetch: handleFetchManual,
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

  // Вычисляемые переменные для JSX
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const showProgressBar = fetchStatus !== 'idle';
  // Disable fetch button if already fetching/retrying OR assistant/AI is busy OR image task fetch initiated AND loading
  const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading || (imageReplaceTask && isImageTaskFetchInitiated.current && isLoading);
  // Disable most actions if fetcher/assistant/AI is busy OR if it's an image task
  const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!imageReplaceTask;
  const isAskAiDisabled = isActionDisabled || !kworkInputHasContent; // Disable AI if actions disabled or no kwork input (already covered by isActionDisabled for image task)
  const isCopyDisabled = !kworkInputHasContent || isActionDisabled;
  const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0 && !filesFetched) || isActionDisabled;
  const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled;
  const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
  // FIX: Replace isWaitingForAi with aiActionLoading & currentAiRequestId check
  const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;
  // Check if the target file for image replacement exists AND fetch attempt completed successfully
  const imageTaskTargetFileReady = imageReplaceTask && fetchStatus === 'success' && allFetchedFiles.some(f => f.path === imageReplaceTask.targetPath);


  // JSX Возврат
  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Заголовок и инструкции */}
       <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
            <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2">
                     {imageReplaceTask ? <FaImages className="text-blue-400" /> : <FaDownload className="text-purple-400" />}
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
             {/* Settings Toggle Button */}
            <motion.button
                 onClick={triggerToggleSettingsModal}
                 // Disable if fetcher is loading/retrying OR assistant is processing
                 disabled={isLoading || assistantLoading || isParsing}
                 whileHover={{ scale: (isLoading || assistantLoading || isParsing) ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }}
                 whileTap={{ scale: (isLoading || assistantLoading || isParsing) ? 1 : 0.95 }}
                 title={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                 aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"}
                 aria-expanded={isSettingsModalOpen}
                 className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"
             >
                {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />}
            </motion.button>
        </div>
      {/* Модальное окно настроек */}
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
            // Disable settings interaction if anything is loading/processing
            // FIX: Replace isWaitingForAi check with aiActionLoading
            loading={isLoading || loadingPrs || assistantLoading || aiActionLoading || isParsing}
        />

      {/* Кнопка "Извлечь файлы" / "Загрузить Файл" */}
       <div className="mb-4 flex justify-center">
            <motion.button
                onClick={() => { handleFetchManual(fetchStatus === 'failed_retries' || fetchStatus === 'error'); }}
                disabled={isFetchDisabled}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${isFetchDisabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`}
                whileHover={{ scale: isFetchDisabled ? 1 : 1.03 }}
                whileTap={{ scale: isFetchDisabled ? 1 : 0.97 }}
                title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}${imageReplaceTask ? ' (для замены картинки)' : ''}`}
            >
                {isLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : imageReplaceTask ? <FaImages /> : <FaDownload />)}
                {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : imageReplaceTask ? "Загрузить Файл" : "Извлечь файлы")}
                <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span>
            </motion.button>
        </div>

      {/* Прогресс-бар и область статуса */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                 {/* Status Messages */}
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                 {isParsing && !imageReplaceTask && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа AI...</p>}
                 {fetchStatus === 'success' && !imageReplaceTask && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно ${files.length} файлов из '${effectiveBranchDisplay}'. Выберите нужные.`} </div> )}
                 {fetchStatus === 'success' && !imageReplaceTask && files.length === 0 && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, 0 файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {/* Image Task Success Message (Target Found) */}
                 {imageTaskTargetFileReady && (
                    <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1">
                        <FaCircleCheck /> {`Файл ${imageReplaceTask?.targetPath.split('/').pop()} загружен для замены.`}
                    </div>
                 )}
                 {/* Fetch Error Message */}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
                 {/* FIX: Display waiting for AI message using aiActionLoading & currentAiRequestId */}
                 {isWaitingForAiResponse && !imageReplaceTask && (
                    <p className="text-blue-400 text-xs font-mono mt-1 text-center animate-pulse">
                        ⏳ Жду ответ AI... (ID: {currentAiRequestId?.substring(0, 6)}...)
                    </p>
                 )}
            </div>
        )}

      {/* Основная область контента */}
       <div className={`grid grid-cols-1 ${ (files.length > 0 && !imageReplaceTask) ? 'md:grid-cols-2' : ''} gap-4 md:gap-6`}>
         {/* File List Area - Show if NOT image task AND (loading OR files exist) */}
         {!imageReplaceTask && (isLoading || files.length > 0) && (
             <div className={`flex flex-col gap-4 ${ (files.length > 0 || kworkInputHasContent) ? '' : 'md:col-span-2'}`}> {/* Span full width if kwork not shown */}
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
                    primaryHighlightedPath={primaryHighlightedPath}
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

          {/* Image Task Status Placeholder - Show if image task AND fetch attempt completed */}
          {imageReplaceTask && filesFetched && (
             <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed ${imageTaskTargetFileReady ? 'border-blue-400' : 'border-red-500'} min-h-[200px]`}>
                 {/* Icon based on state */}
                 {isLoading ? <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" /> :
                  assistantLoading ? <FaSpinner className="text-purple-400 text-3xl mb-3 animate-spin" /> : // Different color for assistant processing
                  imageTaskTargetFileReady ? <FaCircleCheck className="text-green-400 text-3xl mb-3" /> :
                  <FaXmark className="text-red-500 text-3xl mb-3" />}

                 {/* Message based on state */}
                 <p className={`text-sm font-semibold ${imageTaskTargetFileReady ? 'text-blue-300' : 'text-red-400'}`}>
                     {isLoading ? "Загрузка файла..." :
                      assistantLoading ? "Обработка замены..." :
                      imageTaskTargetFileReady ? `Файл ${imageReplaceTask?.targetPath.split('/').pop()} готов.` :
                      `Файл ${imageReplaceTask?.targetPath.split('/').pop()} не найден!`}
                 </p>
                 <p className="text-xs text-gray-400 mt-1">
                     {isLoading ? "Ожидание загрузки..." :
                      assistantLoading ? "Создание/обновление PR..." :
                      imageTaskTargetFileReady ? "Передано Ассистенту для обработки..." :
                      "Проверьте путь или ветку."}
                 </p>
             </div>
         )}
      </div>
    </div>
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;