"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react"; // Ensure useRef is imported
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner, FaListCheck, FaSquareXmark
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Actions & Context
import { fetchRepoContents } from "@/app/actions_github/actions"; // Uses standard console
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest, ImageReplaceTask } from "@/contexts/RepoXmlPageContext";
// Logger import removed

// Sub-components
import SettingsModal from "./repo/SettingsModal";
import FileList from "./repo/FileList";
import SelectedFilesPreview from "./repo/SelectedFilesPreview";
import RequestInput from "./repo/RequestInput";
import ProgressBar from "./repo/ProgressBar";

// Define FileNode locally
export interface FileNode { path: string; content: string; }
// Define ImportCategory type LOCALLY
export type ImportCategory = 'component' | 'context' | 'hook' | 'lib' | 'other';

// Helper: Get Language
const getLanguage = (path: string): string => { const e=path.split('.').pop()?.toLowerCase(); switch(e){ case 'ts': case 'tsx': return 'typescript'; case 'js': case 'jsx': return 'javascript'; case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html'; case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql'; case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go'; case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash'; case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext'; } };
// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Helper: categorizeResolvedPath
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => { if(!resolvedPath) return 'other'; const pL=resolvedPath.toLowerCase(); if(pL.includes('/contexts/')||pL.startsWith('contexts/')) return 'context'; if(pL.includes('/hooks/')||pL.startsWith('hooks/')) return 'hook'; if(pL.includes('/lib/')||pL.startsWith('lib/')) return 'lib'; if((pL.includes('/components/')||pL.startsWith('components/'))&&!pL.includes('/components/ui/')) return 'component'; return 'other'; };

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

  // === Context ===
   const { fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched, setSelectedFetcherFiles, kworkInputHasContent, setKworkInputHasContent, setRequestCopied, aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing, currentAiRequestId, targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs, setOpenPrs, setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal, kworkInputRef, triggerAskAi, triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection, setFilesParsed, setAiResponseHasContent, setSelectedAssistantFiles, imageReplaceTask, allFetchedFiles, setAllFetchedFiles } = useRepoXmlPageContext();

  // === URL Params & Derived State ===
   const searchParams = useSearchParams();
   const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
   const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
   const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
   const DEFAULT_TASK_IDEA = "Проанализируй код. Опиши функции, предложи улучшения.";
   const importantFiles = useMemo(() => [ "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx", "hooks/supabase.ts", "app/actions.ts", "app/ai_actions/actions.ts", "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts" ], []);

  // === Refs ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Removed - handled by interval end logic
  const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSelectedFilesRef = useRef<Set<string>>(new Set());
  const isImageTaskFetchInitiated = useRef(false);
  const isAutoFetchingRef = useRef(false); // <<<--- ADDED THIS REF GUARD
  const fetchStatusRef = useRef(fetchStatus); // Ref to read status in interval

  useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);

  // === Utils ===
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => { let s={background:"rgba(50,50,50,0.9)",color:"#E1FF01",border:"1px solid rgba(225,255,1,0.2)",backdropFilter:"blur(3px)"}; if(type==='success')s={background:"rgba(22,163,74,0.9)",color:"#fff",border:"1px solid rgba(34,197,94,0.3)",backdropFilter:"blur(3px)"}; else if(type==='error')s={background:"rgba(220,38,38,0.9)",color:"#fff",border:"1px solid rgba(239,68,68,0.3)",backdropFilter:"blur(3px)"}; else if(type==='warning')s={background:"rgba(217,119,6,0.9)",color:"#fff",border:"1px solid rgba(245,158,11,0.3)",backdropFilter:"blur(3px)"}; toast(message,{style:s,duration:type==='error'?5000:(type==='warning'?4000:3000)}); }, []);
  const getPageFilePath = useCallback((rP:string, aP:string[]):string|null=>{const cP=rP.startsWith('/')?rP.substring(1):rP; if(!cP||cP==='app'||cP==='/'){ const rPs=['app/page.tsx','app/page.js','src/app/page.tsx','src/app/page.js']; for(const rp of rPs) if(aP.includes(rp)) return rp; return null; } const pwa=cP.startsWith('app/')?cP:cP.startsWith('src/app/')?cP:`app/${cP}`; if(aP.includes(pwa)) return pwa; const pDP=[`${pwa}/page.tsx`,`${pwa}/page.js`,`${pwa}/index.tsx`,`${pwa}/index.js`]; for(const p of pDP) if(aP.includes(p)) return p; const iS=pwa.split('/'); const nIS=iS.length; const pF=aP.filter(p=>(p.startsWith('app/')||p.startsWith('src/app/'))&&(p.endsWith('/page.tsx')||p.endsWith('/page.js')||p.endsWith('/index.tsx')||p.endsWith('/index.js'))); for(const acP of pF){ const sfx=['/page.tsx','/page.js','/index.tsx','/index.js'].find(s=>acP.endsWith(s)); if(!sfx) continue; const aPB=acP.substring(0,acP.length-sfx.length); const aS=aPB.split('/'); if(aS.length!==nIS) continue; let iDM=true; for(let i=0;i<nIS;i++){ const iSeg=iS[i]; const aSeg=aS[i]; if(iSeg===aSeg) continue; else if(aSeg.startsWith('[')&&aSeg.endsWith(']')) continue; else { iDM=false; break; }} if(iDM) return acP; } return null; }, []);
  const extractImports = useCallback((c:string):string[]=>{const r1=/import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const r2=/require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const i=new Set<string>(); let m; while((m=r1.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); while((m=r2.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); return Array.from(i);}, []);
  const resolveImportPath = useCallback((iP:string, cFP:string, aFN:FileNode[]):string|null=>{const aP=aFN.map(f=>f.path); const sE=['.ts','.tsx','.js','.jsx','.css','.scss','.sql','.md']; const tryP=(bP:string):string|null=>{const pTT:string[]=[]; const hEE=/\.\w+$/.test(bP); if(hEE)pTT.push(bP); else{sE.forEach(e=>pTT.push(bP+e)); sE.forEach(e=>pTT.push(`${bP}/index${e}`));} for(const p of pTT)if(aP.includes(p))return p; return null;}; if(iP.startsWith('@/')){const pSB=['src/','app/','']; const pS=iP.substring(2); for(const b of pSB){const r=tryP(b+pS); if(r)return r;} const cAR=['components/','lib/','utils/','hooks/','contexts/','styles/']; for(const rt of cAR)if(pS.startsWith(rt)){const r=tryP(pS); if(r)return r;}}else if(iP.startsWith('.')){const cD=cFP.includes('/')?cFP.substring(0,cFP.lastIndexOf('/')):''; const pP=(cD?cD+'/'+iP:iP).split('/'); const rP:string[]=[]; for(const pt of pP){if(pt==='.'||pt==='')continue; if(pt==='..'){if(rP.length>0)rP.pop();}else rP.push(pt);} const rRB=rP.join('/'); const r=tryP(rRB); if(r)return r;}else{const sB=['lib/','utils/','components/','hooks/','contexts/','styles/','src/lib/','src/utils/','src/components/','src/hooks/','src/contexts/','src/styles/']; for(const b of sB){const r=tryP(b+iP); if(r)return r;}} return null;}, []);

  // --- Enhanced Progress Simulation ---
  const stopProgressSimulation = useCallback(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
  }, []);

  // --- MODIFIED Progress Simulation ---
  const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => { // Default to 13s
      stopProgressSimulation();
      setProgress(0);
      setError(null); // Reset error on new simulation start

      const startTime = Date.now();
      const totalDurationMs = estimatedDurationSeconds * 1000;
      const intervalTime = 100; // Update interval (e.g., 10 times per second)

      console.log(`[ProgressSim] Starting simulation for ${estimatedDurationSeconds}s.`);

      progressIntervalRef.current = setInterval(() => {
          const elapsedTime = Date.now() - startTime;
          const calculatedProgress = Math.min((elapsedTime / totalDurationMs) * 100, 100);

          setProgress(calculatedProgress);

          // Stop the interval if fetch completes early OR simulation time is up
          const currentFetchStatus = fetchStatusRef.current; // Use a ref to read latest status without causing dependency issues
          if (currentFetchStatus === 'success' || currentFetchStatus === 'error' || currentFetchStatus === 'failed_retries') {
              console.log(`[ProgressSim] Fetch status (${currentFetchStatus}) changed, stopping simulation.`);
              stopProgressSimulation();
              setProgress(currentFetchStatus === 'success' ? 100 : 0); // Final progress based on status
          } else if (elapsedTime >= totalDurationMs) {
              console.log(`[ProgressSim] Simulation duration reached.`);
              stopProgressSimulation();
               // If still loading after duration, maybe cap it slightly below 100%
              if (currentFetchStatus === 'loading' || currentFetchStatus === 'retrying') {
                  setProgress(98); // Indicate it's *almost* done but timed out
                  console.warn("[ProgressSim] Simulation timed out while still loading.");
              } else {
                 // Should have been caught by status change, but as fallback:
                 setProgress(100);
              }
          }
      }, intervalTime);

  }, [stopProgressSimulation]); // Keep only stopProgressSimulation as dep

  // --- Update fetchStatusRef whenever fetchStatus changes ---
  useEffect(() => {
      fetchStatusRef.current = fetchStatus;
  }, [fetchStatus]);
  // --- End Helper Ref Effect ---

  // === Core Logic Callbacks ===
  const handleRepoUrlChange = useCallback((url: string) => { setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName(""); }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);
  const updateKworkInput = useCallback((value: string) => { if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { console.warn("localKworkInputRef null"); } }, [setKworkInputHasContent]);
  const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);
  const handleAddSelected = useCallback(async (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => { const fTP=allFilesParam||files; const fTA=filesToAddParam||selectedFiles; if(fTP.length===0&&fTA.size>0){addToast("Файлы не загружены.",'error');return;} if(fTA.size===0){addToast("Выберите файлы.",'warning');return;} const pfx="Контекст кода для анализа:\n"; const mdTxt=fTP.filter(f=>fTA.has(f.path)).sort((a,b)=>a.path.localeCompare(b.path)).map(f=>{const pC=`// /${f.path}`; const cAHC=f.content.trimStart().startsWith(pC); const cTA=cAHC?f.content:`${pC}\n${f.content}`; return `\`\`\`${getLanguage(f.path)}\n${cTA}\n\`\`\``}).join("\n\n"); const cKV=getKworkInputValue(); const ctxRgx=/Контекст кода для анализа:[\s\S]*/; const tT=cKV.replace(ctxRgx,'').trim(); const nC=`${tT?tT+'\n\n':''}${pfx}${mdTxt}`; updateKworkInput(nC); addToast(`${fTA.size} файлов добавлено`, 'success'); scrollToSection('kworkInput'); }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection]);
  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => { const c=textToCopy??getKworkInputValue(); if(!c.trim()){addToast("Нет текста",'warning');return false;} try{navigator.clipboard.writeText(c); addToast("Скопировано!",'success');setRequestCopied(true); if(shouldScroll)scrollToSection('executor');return true;}catch(e){console.error("Copy fail:",e);addToast("Ошибка копирования",'error');return false;} }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);
  const handleClearAll = useCallback(() => { console.log("Clearing Fetcher state."); setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); updateKworkInput(""); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setRequestCopied(false); addToast("Очищено ✨", 'success'); if (localKworkInputRef.current) localKworkInputRef.current.focus(); }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied ]);

  // --- Fetch Handler (Final - Incorporating Simulation and Guard) ---
  const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
      const effectiveBranch = branchNameToFetch || targetBranchName || manualBranchName || 'default';
      console.log(`Fetcher: Start fetch. Retry: ${isManualRetry}, Branch: ${effectiveBranch}, Status: ${fetchStatus}, Task: ${!!imageReplaceTask}, TaskFetchInit: ${isImageTaskFetchInitiated.current}`);

      // Prevent re-fetch for image task if already initiated (check remains)
      if (imageReplaceTask && isImageTaskFetchInitiated.current && (fetchStatus === 'loading' || fetchStatus === 'retrying')) {
          console.warn("Fetcher: Image task fetch already running. Aborting duplicate."); return;
      }
      // Standard checks (URL, existing loading, other busy states)
      if (!repoUrl.trim()) { console.error("Fetcher: URL empty."); addToast("Введите URL", 'error'); setError("URL пуст."); triggerToggleSettingsModal(); return; }
      if ((fetchStatus === 'loading' || fetchStatus === 'retrying') && !isManualRetry) { console.warn("Fetcher: Already fetching."); addToast("Уже идет...", "info"); return; }
      if (assistantLoading || isParsing || aiActionLoading) { console.warn(`Fetcher: Blocked by state.`); addToast("Подождите.", "warning"); return; }

      console.log("Fetcher: Proceeding.");
      setFetchStatus('loading'); // Set status FIRST
      // Reset states
      setError(null); setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAllFetchedFiles([]); setSelectedFetcherFiles(new Set()); setFilesFetched(false, [], null, []); setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
      if (imageReplaceTask) { isImageTaskFetchInitiated.current = true; updateKworkInput(""); }
      else if (!highlightedPathFromUrl && localKworkInputRef.current) { updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA); }

      addToast(`Запрос (${effectiveBranch})...`, 'info');
      startProgressSimulation(13); // <<<--- START SIMULATION
      console.log("Fetcher: Sim started.");

      let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
      let success = false;
      let finalStatus: FetchStatus = 'error'; // Default to error

      try {
          console.log(`Fetcher: Calling action for branch: ${effectiveBranch}`);
          result = await fetchRepoContents(repoUrl, token || undefined, effectiveBranch);
          console.log(`Fetcher: Result: Success=${result?.success}, Files=${result?.files?.length ?? 'N/A'}, Error=${result?.error ?? 'None'}`);

          if (result?.success && Array.isArray(result.files)) {
               success = true; const fetchedFiles = result.files;
               finalStatus = 'success'; // Tentative success

               // Post-Fetch Logic (Highlights, Image Check etc.)
               const allPaths=fetchedFiles.map(f=>f.path); let primaryHPath:string|null=null; const catSecPaths:Record<ImportCategory,Set<string>>={component:new Set(),context:new Set(),hook:new Set(),lib:new Set(),other:new Set()}; let filesToSel=new Set<string>();
               if(imageReplaceTask){
                   primaryHPath=imageReplaceTask.targetPath;
                   if(!allPaths.includes(primaryHPath)){
                       const imgErr=`File (${primaryHPath}) not found in '${effectiveBranch}'.`;
                       console.error(`Fetcher: ${imgErr}`); setError(imgErr); addToast(imgErr,'error');
                       setFilesFetched(true,fetchedFiles,null,[]); // Signal fetch happened, but it's an error state
                       finalStatus='error'; success=false;
                   } else { filesToSel.add(primaryHPath); console.log(`Fetcher: Auto-select image target: ${primaryHPath}`); }
               }
               else if(highlightedPathFromUrl){primaryHPath=getPageFilePath(highlightedPathFromUrl,allPaths); if(primaryHPath){const pF=fetchedFiles.find(f=>f.path===primaryHPath); if(pF){filesToSel.add(primaryHPath); const imps=extractImports(pF.content); for(const imp of imps){const rP=resolveImportPath(imp,pF.path,fetchedFiles); if(rP&&rP!==primaryHPath){const cat=categorizeResolvedPath(rP); catSecPaths[cat].add(rP); if(cat!=='other')filesToSel.add(rP);}}}else{primaryHPath=null; addToast(`Error: Path (${primaryHPath}) not found.`,'error');}} else {addToast(`Page file for URL (${highlightedPathFromUrl}) not found.`,'warning');}}
               if(!imageReplaceTask){importantFiles.forEach(p=>{if(allPaths.includes(p)&&!filesToSel.has(p)){filesToSel.add(p); console.log(`Fetcher: Auto-select important: ${p}`);}}); }

               // --- Proceed only if fetch is still considered successful ---
               if(success){
                   setPrimaryHighlightedPathState(primaryHPath); const finalSecPaths={component:Array.from(catSecPaths.component),context:Array.from(catSecPaths.context),hook:Array.from(catSecPaths.hook),lib:Array.from(catSecPaths.lib),other:Array.from(catSecPaths.other)}; setSecondaryHighlightedPathsState(finalSecPaths);
                   if(!imageReplaceTask){
                       setSelectedFilesState(filesToSel); // Update local visual selection
                       setSelectedFetcherFiles(filesToSel); // Update context selection
                   }
                   setFilesFetched(true,fetchedFiles,primaryHPath,Object.values(finalSecPaths).flat()); // Call context setter (triggers image replacement if needed)
                   console.log("[Fetcher] setFilesFetched called successfully.");

                   // UI Updates (only if success and not handled by image task yet)
                   if (!imageReplaceTask) { addToast(`Fetched ${fetchedFiles.length} files!`, 'success'); }
                   setFiles(fetchedFiles); setAllFetchedFiles(fetchedFiles); if(isSettingsModalOpen) triggerToggleSettingsModal();

                   // Toasts and auto-actions for DIFFERENT flows
                   if(imageReplaceTask && primaryHPath){ addToast(`Auto-selected for replace: ${primaryHPath}`,'info'); }
                   else if(highlightedPathFromUrl && ideaFromUrl && filesToSel.size > 0 && !imageReplaceTask){ /* ... URL param toast and actions ... */ const nS=catSecPaths.component.size+catSecPaths.context.size+catSecPaths.hook.size+catSecPaths.lib.size; const nI=filesToSel.size-(primaryHPath?1:0)-nS; let msg=`✅ Auto-select: `; const pts=[]; if(primaryHPath)pts.push(`1 стр`); if(nS>0)pts.push(`${nS} связ`); if(nI>0)pts.push(`${nI} важн`); msg+=pts.join(', ')+` (${filesToSel.size} total). Idea added.`; addToast(msg,'success'); updateKworkInput(ideaFromUrl||DEFAULT_TASK_IDEA); await handleAddSelected(filesToSel,fetchedFiles); setTimeout(()=>{addToast("💡 Add instructions!", "info");}, 500); }
                   else if(!imageReplaceTask){ /* ... Standard toast & scroll ... */ if(filesToSel.size>0){const nH=catSecPaths.component.size+catSecPaths.context.size+catSecPaths.hook.size+catSecPaths.lib.size; const nI=filesToSel.size-(primaryHPath?1:0)-nH; let msg=`Auto-selected: `; const pts=[]; if(primaryHPath)pts.push(`1 осн`); if(nH>0)pts.push(`${nH} связ`); if(nI>0)pts.push(`${nI} важн`); msg+=pts.join(', ')+'.'; addToast(msg,'info');} if(primaryHPath){setTimeout(()=>{const eId=`file-${primaryHPath}`; const el=document.getElementById(eId); if(el){el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md'); setTimeout(()=>el.classList.remove('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md'),2500);}},400);}else if(fetchedFiles.length>0){const el=document.getElementById('file-list-container'); el?.scrollIntoView({behavior:"smooth",block:"nearest"});}}}
                // End success block
          } else {
              console.error(`Fetcher: Action FAILED. Error: ${result?.error}`);
              throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}.`);
          }
      } catch (err: any) {
          console.error(`Fetcher: Error in handleFetch catch: ${err.message}`);
          const displayError = err?.message || "Неизвестная ошибка";
          setError(displayError); addToast(`Ошибка извлечения: ${displayError}`, 'error');
          setFilesFetched(false, [], null, []); // Signal failure
          success = false; finalStatus = 'error'; // Ensure flags are set
      } finally {
           // --- CRUCIAL: Stop simulation and set final status/progress ---
           stopProgressSimulation(); // <<<--- STOP SIMULATION
           setProgress(success ? 100 : 0);
           setFetchStatus(finalStatus); // <<<--- SET FINAL STATUS
           if (imageReplaceTask) { isImageTaskFetchInitiated.current = false; } // Reset image task flag
           console.log(`Fetcher: Finished. Success: ${success}, Final Status Set: ${fetchStatusRef.current}`); // Log the status just set
      }
  }, [ /* Added start/stop simulation, removed local fetchStatus read */
        repoUrl, token, imageReplaceTask, assistantLoading, isParsing, aiActionLoading, repoUrlEntered,
        setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setAllFetchedFiles,
        setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetched,
        setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA, addToast,
        startProgressSimulation, stopProgressSimulation, // Added dependencies
        getLanguage, getPageFilePath, extractImports, resolveImportPath, categorizeResolvedPath, handleAddSelected,
        getKworkInputValue, scrollToSection, setKworkInputHasContent, isSettingsModalOpen, triggerToggleSettingsModal,
        updateKworkInput, triggerAskAi, localKworkInputRef, manualBranchName, targetBranchName ]);


  // --- Other Callbacks ---
  const selectHighlightedFiles = useCallback(() => { const fTS=new Set<string>(selectedFiles); let nSC=0; const aHLS=[ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib ]; if(primaryHighlightedPath&&files.some(f=>f.path===primaryHighlightedPath)&&!fTS.has(primaryHighlightedPath)){fTS.add(primaryHighlightedPath); nSC++;} aHLS.forEach(p=>{if(files.some(f=>f.path===p)&&!fTS.has(p)){fTS.add(p); nSC++;}}); if(nSC>0){setSelectedFilesState(fTS); setSelectedFetcherFiles(fTS); addToast(`${nSC} связанных добавлено`, 'info');} else {addToast("Все связанные уже выбраны", 'info');} }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);
  const toggleFileSelection = useCallback((path: string) => { setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if(newSet.has(path)){ newSet.delete(path); }else{ newSet.add(path); } if (selectionUpdateTimeoutRef.current) clearTimeout(selectionUpdateTimeoutRef.current); selectionUpdateTimeoutRef.current = setTimeout(() => { setSelectedFetcherFiles(new Set(newSet)); selectionUpdateTimeoutRef.current = null; }, 150); return newSet; }); }, [setSelectedFetcherFiles]);
  const handleAddImportantFiles = useCallback(() => { let aC=0; const fTA=new Set(selectedFiles); importantFiles.forEach(p=>{if(files.some(f=>f.path===p)&&!selectedFiles.has(p)){fTA.add(p); aC++;}}); if(aC===0){addToast("Важные уже выбраны", 'info'); return;} setSelectedFilesState(fTA); setSelectedFetcherFiles(fTA); addToast(`Добавлено ${aC} важных`, 'success'); }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);
  const handleAddFullTree = useCallback(() => { if(files.length===0){addToast("Нет файлов",'warning'); return;} const tO=files.map((f)=>`- /${f.path}`).sort().join("\n"); const tC=`Структура:\n\`\`\`\n${tO}\n\`\`\``; let added=false; const cV=getKworkInputValue(); const tV=cV.trim(); const hT=/Структура:\s*```/im.test(tV); if(!hT){const nC=tV?`${tV}\n\n${tC}`:tC; updateKworkInput(nC); added=true;} if(added){addToast("Дерево добавлено",'success'); scrollToSection('kworkInput');} else {addToast("Дерево уже добавлено", 'info');} }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast]);
  const handleSelectPrBranch = useCallback((branch: string | null) => { setTargetBranchName(branch); if(branch) addToast(`Ветка PR: ${branch}`, 'success'); else addToast(`Выбор ветки PR снят.`, 'info'); }, [setTargetBranchName, addToast]);
  const handleManualBranchChange = useCallback((name: string) => { setManualBranchName(name); }, [setManualBranchName]);
  const handleLoadPrs = useCallback(() => { triggerGetOpenPRs(repoUrl); }, [triggerGetOpenPRs, repoUrl]);
  const handleSelectAll = useCallback(() => { if(files.length===0)return; const allP=new Set(files.map(f=>f.path)); setSelectedFilesState(allP); setSelectedFetcherFiles(allP); addToast(`Выбрано ${allP.size} файлов`,'info'); }, [files, setSelectedFetcherFiles]);
  const handleDeselectAll = useCallback(() => { setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); addToast("Выбор снят",'info'); }, [setSelectedFetcherFiles]);

  // --- Effects ---
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl); }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]);

  // --- MODIFIED AutoFetch Effect (Using Guard) ---
  useEffect(() => {
    const branch = targetBranchName || manualBranchName || null;
    const canTriggerFetch = autoFetch && repoUrl &&
                           (fetchStatus === 'idle' || fetchStatus === 'failed_retries' || fetchStatus === 'error');

    const isImageFetchReady = !imageReplaceTask || !isImageTaskFetchInitiated.current;

    // Only trigger if conditions met AND not already auto-fetching
    if (canTriggerFetch && isImageFetchReady && !isAutoFetchingRef.current) {
        console.log(`[AutoFetch Effect] Triggering fetch. Guard Active. ImageTask: ${!!imageReplaceTask}, Initiated: ${isImageTaskFetchInitiated.current}`);
        isAutoFetchingRef.current = true; // Set the guard

        handleFetch(false, branch)
            .catch(err => {
                // Ensure guard is reset even if handleFetch itself throws an unexpected error
                console.error("[AutoFetch Effect] handleFetch threw an error:", err);
            })
            .finally(() => {
                // Reset the guard slightly after completion to allow state to settle
                setTimeout(() => {
                    console.log("[AutoFetch Effect] Resetting fetch guard.");
                    isAutoFetchingRef.current = false;
                }, 300); // Small delay (e.g., 300ms)
            });

    } else if (autoFetch && imageReplaceTask && isImageTaskFetchInitiated.current) {
        console.log("[AutoFetch Effect] Skipping: Image task fetch already initiated.");
    } else if (canTriggerFetch && isAutoFetchingRef.current) {
        console.log("[AutoFetch Effect] Skipping: Guard is already active.");
    }

  // Keep dependencies the same, the guard logic controls the execution
  }, [repoUrl, autoFetch, fetchStatus, targetBranchName, manualBranchName, imageReplaceTask, handleFetch]);
  // --- End MODIFIED AutoFetch Effect ---

  useEffect(() => { if(files.length===0||imageReplaceTask||fetchStatus!=='success'){prevSelectedFilesRef.current=new Set(selectedFiles); return;} const newSelPaths=new Set<string>(); selectedFiles.forEach(p=>{if(!prevSelectedFilesRef.current.has(p)){newSelPaths.add(p);}}); if(primaryHighlightedPath&&selectedFiles.has(primaryHighlightedPath)&&!prevSelectedFilesRef.current.has(primaryHighlightedPath)&&!newSelPaths.has(primaryHighlightedPath)){newSelPaths.add(primaryHighlightedPath);} if(newSelPaths.size===0){prevSelectedFilesRef.current=new Set(selectedFiles); return;} const pgSuffixes=['/page.tsx','/page.js','/index.tsx','/index.js']; const filesToCheck=Array.from(newSelPaths).filter(p=>pgSuffixes.some(s=>p.endsWith(s))||p===primaryHighlightedPath); if(filesToCheck.length>0){const relatedToSel=new Set<string>(); let foundCount=0; filesToCheck.forEach(fp=>{const fNode=files.find(f=>f.path===fp); if(fNode){const imps=extractImports(fNode.content); imps.forEach(imp=>{const rP=resolveImportPath(imp,fNode.path,files); if(rP&&rP!==fp){const cat=categorizeResolvedPath(rP); if(cat!=='other'){if(!selectedFiles.has(rP)){relatedToSel.add(rP); foundCount++;}}}});}}); if(relatedToSel.size>0){const finalSel=new Set([...selectedFiles,...relatedToSel]); setSelectedFilesState(finalSel); setSelectedFetcherFiles(finalSel); addToast(`🔗 Авто-добавлено ${foundCount} связанных`,'info'); prevSelectedFilesRef.current=finalSel; return;}} prevSelectedFilesRef.current=new Set(selectedFiles); }, [selectedFiles, files, fetchStatus, primaryHighlightedPath, extractImports, resolveImportPath, categorizeResolvedPath, setSelectedFetcherFiles, addToast, imageReplaceTask]);

  // --- Cleanup Simulation on Unmount ---
  useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);

  // === Imperative Handle ===
  useImperativeHandle(ref, () => ({ handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll: handleClearAll, getKworkInputValue }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);

  // --- Render Logic ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const showProgressBar = fetchStatus !== 'idle'; // Show if not idle
  const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading;
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
            <div> <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2"> <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода </h2> {!imageReplaceTask && ( <> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Настрой URL/токен/ветку (<FaCodeBranch className="inline text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Жми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы для контекста.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">4. Опиши задачу ИЛИ добавь файлы (<FaPlus className="inline text-sm"/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Жми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.</p> </> )} {imageReplaceTask && ( <p className="text-blue-300/80 text-xs md:text-sm mb-2">Загрузка файла для замены картинки...</p> )} </div>
            <motion.button onClick={triggerToggleSettingsModal} disabled={isFetchDisabled} whileHover={{ scale: isFetchDisabled ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }} whileTap={{ scale: isFetchDisabled ? 1 : 0.95 }} title={isSettingsModalOpen ? "Скрыть" : "Настройки"} aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"} aria-expanded={isSettingsModalOpen} className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"> {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />} </motion.button>
        </div>
      {/* Settings Modal */}
       <SettingsModal isOpen={isSettingsModalOpen} repoUrl={repoUrl} setRepoUrl={handleRepoUrlChange} token={token} setToken={setToken} manualBranchName={manualBranchName} setManualBranchName={handleManualBranchChange} currentTargetBranch={targetBranchName} openPrs={openPrs} loadingPrs={loadingPrs} onSelectPrBranch={handleSelectPrBranch} onLoadPrs={handleLoadPrs} loading={isLoading || loadingPrs || assistantLoading || aiActionLoading} />
      {/* Fetch Button */}
       <div className="mb-4 flex justify-center">
            <motion.button onClick={() => { handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error'); }} disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${(isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`} whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }} whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }} title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`}> {isLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)} {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")} <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span> </motion.button>
        </div>
      {/* Progress Bar & Status Area */}
       {showProgressBar && ( /* Use flag */
            <div className="mb-4 min-h-[40px]">
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                 {isParsing && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа...</p>}
                 {fetchStatus === 'success' && files.length > 0 && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, 0 файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && imageReplaceTask && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Файл ${imageReplaceTask.targetPath.split('/').pop()} загружен.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}
      {/* Main Content Area */}
       <div className={`grid grid-cols-1 ${ (files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>
         {(isLoading || files.length > 0) && ( <div className="flex flex-col gap-4"> <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} /> <FileList id="file-list-container" files={files} selectedFiles={selectedFiles} primaryHighlightedPath={primaryHighlightedPath} secondaryHighlightedPaths={secondaryHighlightedPaths} importantFiles={importantFiles} isLoading={isLoading} isActionDisabled={isActionDisabled} toggleFileSelection={toggleFileSelection} onAddSelected={() => handleAddSelected()} onAddImportant={handleAddImportantFiles} onAddTree={handleAddFullTree} onSelectHighlighted={selectHighlightedFiles} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} /> </div> )}
         {(files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? ( <div id="kwork-input-section" className="flex flex-col gap-3"> <RequestInput kworkInputRef={localKworkInputRef} onCopyToClipboard={() => handleCopyToClipboard(undefined, true)} onClearAll={handleClearAll} isCopyDisabled={isCopyDisabled} isClearDisabled={isClearDisabled} onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)} onAskAi={triggerAskAi} isAskAiDisabled={isAskAiDisabled} aiActionLoading={aiActionLoading} onAddSelected={() => handleAddSelected()} isAddSelectedDisabled={isAddSelectedDisabled} selectedFetcherFilesCount={selectedFiles.size} /> </div> ) : null }
         {imageReplaceTask && fetchStatus === 'success' && files.length > 0 && ( <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed border-blue-400 min-h-[200px]`}> {(assistantLoading || aiActionLoading) ? ( <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" /> ) : ( <FaCircleCheck className="text-green-400 text-3xl mb-3" /> )} <p className="text-sm text-blue-300"> {(assistantLoading || aiActionLoading) ? "Обработка замены..." : `Файл ${imageReplaceTask.targetPath.split('/').pop()} готов.`} </p> <p className="text-xs text-gray-400 mt-1"> {(assistantLoading || aiActionLoading) ? "Создание/обновление PR..." : "Перехожу к созданию PR..."} </p> </div> )}
      </div>
    </div>
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;