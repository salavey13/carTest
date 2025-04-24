"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react"; // Убедимся, что useRef импортирован
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    FaAngleDown, FaAngleUp,
    FaDownload, FaArrowsRotate, FaCircleCheck, FaXmark, FaCopy,
    FaBroom, FaRobot, FaCodeBranch, FaPlus, FaFileLines, FaSpinner, FaListCheck, FaSquareXmark
} from "react-icons/fa6";
import { motion } from "framer-motion";

// Действия и Контекст
import { fetchRepoContents } from "@/app/actions_github/actions"; // Использует стандартный console
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext, RepoTxtFetcherRef, FetchStatus, SimplePullRequest, ImageReplaceTask } from "@/contexts/RepoXmlPageContext";

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

// --- Вспомогательные функции ---

// Получение языка программирования по пути файла
const getLanguage = (path: string): string => { const e=path.split('.').pop()?.toLowerCase(); switch(e){ case 'ts': case 'tsx': return 'typescript'; case 'js': case 'jsx': return 'javascript'; case 'py': return 'python'; case 'css': return 'css'; case 'html': return 'html'; case 'json': return 'json'; case 'md': return 'markdown'; case 'sql': return 'sql'; case 'php': return 'php'; case 'rb': return 'ruby'; case 'go': return 'go'; case 'java': return 'java'; case 'cs': return 'csharp'; case 'sh': return 'bash'; case 'yml': case 'yaml': return 'yaml'; default: return 'plaintext'; } };
// Функция задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Категоризация разрешенного пути импорта
const categorizeResolvedPath = (resolvedPath: string): ImportCategory => { if(!resolvedPath) return 'other'; const pL=resolvedPath.toLowerCase(); if(pL.includes('/contexts/')||pL.startsWith('contexts/')) return 'context'; if(pL.includes('/hooks/')||pL.startsWith('hooks/')) return 'hook'; if(pL.includes('/lib/')||pL.startsWith('lib/')) return 'lib'; if((pL.includes('/components/')||pL.startsWith('components/'))&&!pL.includes('/components/ui/')) return 'component'; return 'other'; };

// --- Компонент ---
const RepoTxtFetcher = forwardRef<RepoTxtFetcherRef, {}>((props, ref) => {
  // === Состояние компонента ===
  const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest"); // URL репозитория
  const [token, setToken] = useState<string>(""); // GitHub токен (если нужен кастомный)
  const [files, setFiles] = useState<FileNode[]>([]); // Список извлеченных файлов
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set()); // Множество путей выбранных файлов
  const [progress, setProgress] = useState<number>(0); // Прогресс загрузки (0-100)
  const [error, setError] = useState<string | null>(null); // Сообщение об ошибке
  const [primaryHighlightedPath, setPrimaryHighlightedPathState] = useState<string | null>(null); // Путь к файлу, подсвеченному из URL
  const [secondaryHighlightedPaths, setSecondaryHighlightedPathsState] = useState<Record<ImportCategory, string[]>>({ component: [], context: [], hook: [], lib: [], other: [] }); // Пути к связанным файлам по категориям

  // === Контекст ===
   const {
      fetchStatus, setFetchStatus, repoUrlEntered, setRepoUrlEntered, filesFetched, setFilesFetched,
      setSelectedFetcherFiles, kworkInputHasContent, setKworkInputHasContent, setRequestCopied,
      aiActionLoading, currentStep, loadingPrs, assistantLoading, isParsing, currentAiRequestId,
      targetBranchName, setTargetBranchName, manualBranchName, setManualBranchName, openPrs, setOpenPrs,
      setLoadingPrs, isSettingsModalOpen, triggerToggleSettingsModal, kworkInputRef, triggerAskAi,
      triggerGetOpenPRs, updateRepoUrlInAssistant, scrollToSection, setFilesParsed, setAiResponseHasContent,
      setSelectedAssistantFiles, imageReplaceTask, allFetchedFiles, setAllFetchedFiles
   } = useRepoXmlPageContext();

  // === Параметры URL и производное состояние ===
   const searchParams = useSearchParams(); // Хук для доступа к параметрам URL
   // Путь, подсвечиваемый из URL (?path=...)
   const highlightedPathFromUrl = useMemo(() => searchParams.get("path") || "", [searchParams]);
   // Идея, передаваемая из URL (?idea=...)
   const ideaFromUrl = useMemo(() => searchParams.get("idea") ? decodeURIComponent(searchParams.get("idea")!) : "", [searchParams]);
   // Флаг для автоматического запуска извлечения при наличии параметров URL или задачи замены картинки
   const autoFetch = useMemo(() => !!highlightedPathFromUrl || !!imageReplaceTask, [highlightedPathFromUrl, imageReplaceTask]);
   // Идея по умолчанию для поля запроса
   const DEFAULT_TASK_IDEA = "Проанализируй код. Опиши функции, предложи улучшения.";
   // Список важных файлов для автоматического выбора
   const importantFiles = useMemo(() => [ "contexts/AppContext.tsx", "hooks/useTelegram.ts", "app/layout.tsx", "hooks/supabase.ts", "app/actions.ts", "app/ai_actions/actions.ts", "app/webhook-handlers/proxy.ts", "package.json", "tailwind.config.ts" ], []);

  // === Рефы (Ссылки на DOM-элементы и значения) ===
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref для интервала симуляции прогресса
  const localKworkInputRef = useRef<HTMLTextAreaElement | null>(null); // Ref для поля ввода запроса
  const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref для таймаута обновления выбора файлов (оптимизация)
  const prevSelectedFilesRef = useRef<Set<string>>(new Set()); // Ref для хранения предыдущего набора выбранных файлов (для авто-добавления зависимостей)
  const isImageTaskFetchInitiated = useRef(false); // Флаг: инициирована ли загрузка для задачи замены картинки
  const isAutoFetchingRef = useRef(false); // <<<--- ДОБАВЛЕН Ref-страж для предотвращения многократного авто-запуска
  const fetchStatusRef = useRef(fetchStatus); // Ref для чтения актуального fetchStatus внутри setInterval симуляции прогресса

  // Связываем локальный ref поля ввода с ref из контекста
  useEffect(() => { if (kworkInputRef) kworkInputRef.current = localKworkInputRef.current; }, [kworkInputRef]);

  // === Утилиты ===
  // Показ уведомлений (toast)
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => { let s={background:"rgba(50,50,50,0.9)",color:"#E1FF01",border:"1px solid rgba(225,255,1,0.2)",backdropFilter:"blur(3px)"}; if(type==='success')s={background:"rgba(22,163,74,0.9)",color:"#fff",border:"1px solid rgba(34,197,94,0.3)",backdropFilter:"blur(3px)"}; else if(type==='error')s={background:"rgba(220,38,38,0.9)",color:"#fff",border:"1px solid rgba(239,68,68,0.3)",backdropFilter:"blur(3px)"}; else if(type==='warning')s={background:"rgba(217,119,6,0.9)",color:"#fff",border:"1px solid rgba(245,158,11,0.3)",backdropFilter:"blur(3px)"}; toast(message,{style:s,duration:type==='error'?5000:(type==='warning'?4000:3000)}); }, []);
  // Получение пути к файлу страницы Next.js по относительному пути из URL
  const getPageFilePath = useCallback((rP:string, aP:string[]):string|null=>{const cP=rP.startsWith('/')?rP.substring(1):rP; if(!cP||cP==='app'||cP==='/'){ const rPs=['app/page.tsx','app/page.js','src/app/page.tsx','src/app/page.js']; for(const rp of rPs) if(aP.includes(rp)) return rp; return null; } const pwa=cP.startsWith('app/')?cP:cP.startsWith('src/app/')?cP:`app/${cP}`; if(aP.includes(pwa)) return pwa; const pDP=[`${pwa}/page.tsx`,`${pwa}/page.js`,`${pwa}/index.tsx`,`${pwa}/index.js`]; for(const p of pDP) if(aP.includes(p)) return p; const iS=pwa.split('/'); const nIS=iS.length; const pF=aP.filter(p=>(p.startsWith('app/')||p.startsWith('src/app/'))&&(p.endsWith('/page.tsx')||p.endsWith('/page.js')||p.endsWith('/index.tsx')||p.endsWith('/index.js'))); for(const acP of pF){ const sfx=['/page.tsx','/page.js','/index.tsx','/index.js'].find(s=>acP.endsWith(s)); if(!sfx) continue; const aPB=acP.substring(0,acP.length-sfx.length); const aS=aPB.split('/'); if(aS.length!==nIS) continue; let iDM=true; for(let i=0;i<nIS;i++){ const iSeg=iS[i]; const aSeg=aS[i]; if(iSeg===aSeg) continue; else if(aSeg.startsWith('[')&&aSeg.endsWith(']')) continue; else { iDM=false; break; }} if(iDM) return acP; } return null; }, []);
  // Извлечение путей импортов из содержимого файла
  const extractImports = useCallback((c:string):string[]=>{const r1=/import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']/g; const r2=/require\s*\(\s*["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["']\s*\)/g; const i=new Set<string>(); let m; while((m=r1.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); while((m=r2.exec(c))!==null)if(m[1]&&m[1]!=='.')i.add(m[1]); return Array.from(i);}, []);
  // Разрешение абсолютного пути импорта относительно текущего файла
  const resolveImportPath = useCallback((iP:string, cFP:string, aFN:FileNode[]):string|null=>{const aP=aFN.map(f=>f.path); const sE=['.ts','.tsx','.js','.jsx','.css','.scss','.sql','.md']; const tryP=(bP:string):string|null=>{const pTT:string[]=[]; const hEE=/\.\w+$/.test(bP); if(hEE)pTT.push(bP); else{sE.forEach(e=>pTT.push(bP+e)); sE.forEach(e=>pTT.push(`${bP}/index${e}`));} for(const p of pTT)if(aP.includes(p))return p; return null;}; if(iP.startsWith('@/')){const pSB=['src/','app/','']; const pS=iP.substring(2); for(const b of pSB){const r=tryP(b+pS); if(r)return r;} const cAR=['components/','lib/','utils/','hooks/','contexts/','styles/']; for(const rt of cAR)if(pS.startsWith(rt)){const r=tryP(pS); if(r)return r;}}else if(iP.startsWith('.')){const cD=cFP.includes('/')?cFP.substring(0,cFP.lastIndexOf('/')):''; const pP=(cD?cD+'/'+iP:iP).split('/'); const rP:string[]=[]; for(const pt of pP){if(pt==='.'||pt==='')continue; if(pt==='..'){if(rP.length>0)rP.pop();}else rP.push(pt);} const rRB=rP.join('/'); const r=tryP(rRB); if(r)return r;}else{const sB=['lib/','utils/','components/','hooks/','contexts/','styles/','src/lib/','src/utils/','src/components/','src/hooks/','src/contexts/','src/styles/']; for(const b of sB){const r=tryP(b+iP); if(r)return r;}} return null;}, []);

  // --- Симуляция прогресс-бара ---
  // Остановка симуляции
  const stopProgressSimulation = useCallback(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
  }, []);

  // Запуск симуляции прогресс-бара (линейно за 13 секунд)
  const startProgressSimulation = useCallback((estimatedDurationSeconds = 13) => {
      stopProgressSimulation(); // Остановить предыдущую симуляцию, если была
      setProgress(0); // Сбросить прогресс
      setError(null); // Сбросить ошибку при новом запуске

      const startTime = Date.now();
      const totalDurationMs = estimatedDurationSeconds * 1000;
      const intervalTime = 100; // Интервал обновления (10 раз в секунду)

      console.log(`[ProgressSim] Запуск симуляции на ${estimatedDurationSeconds} сек.`);

      progressIntervalRef.current = setInterval(() => {
          const elapsedTime = Date.now() - startTime;
          const calculatedProgress = Math.min((elapsedTime / totalDurationMs) * 100, 100);

          setProgress(calculatedProgress); // Обновляем состояние прогресса

          // Проверяем статус через ref, чтобы не добавлять fetchStatus в зависимости интервала
          const currentFetchStatus = fetchStatusRef.current;
          // Останавливаем интервал, если загрузка завершилась (успех/ошибка) ИЛИ время вышло
          if (currentFetchStatus === 'success' || currentFetchStatus === 'error' || currentFetchStatus === 'failed_retries') {
              console.log(`[ProgressSim] Статус (${currentFetchStatus}) изменился, остановка симуляции.`);
              stopProgressSimulation();
              setProgress(currentFetchStatus === 'success' ? 100 : 0); // Установить финальный прогресс
          } else if (elapsedTime >= totalDurationMs) {
              console.log(`[ProgressSim] Время симуляции (${estimatedDurationSeconds} сек) истекло.`);
              stopProgressSimulation();
               // Если загрузка все еще идет по истечении времени, ставим почти 100%
              if (currentFetchStatus === 'loading' || currentFetchStatus === 'retrying') {
                  setProgress(98); // Показываем, что почти готово, но время вышло
                  console.warn("[ProgressSim] Симуляция завершилась по таймауту во время загрузки.");
              } else {
                 // Этого не должно произойти, если статус обновляется корректно, но на всякий случай
                 setProgress(100);
              }
          }
      }, intervalTime);

  }, [stopProgressSimulation]); // Зависимость только от stopProgressSimulation

  // Обновляем fetchStatusRef при изменении fetchStatus из контекста
  useEffect(() => {
      fetchStatusRef.current = fetchStatus;
  }, [fetchStatus]);
  // --- Конец логики симуляции прогресс-бара ---

  // === Основные колбэки ===
  // Обработка изменения URL репозитория
  const handleRepoUrlChange = useCallback((url: string) => { setRepoUrlState(url); setRepoUrlEntered(url.trim().length > 0); updateRepoUrlInAssistant(url); setOpenPrs([]); setTargetBranchName(null); setManualBranchName(""); }, [setRepoUrlEntered, updateRepoUrlInAssistant, setOpenPrs, setTargetBranchName, setManualBranchName]);
  // Обновление значения поля ввода запроса
  const updateKworkInput = useCallback((value: string) => { if (localKworkInputRef.current) { localKworkInputRef.current.value = value; const event = new Event('input', { bubbles: true }); localKworkInputRef.current.dispatchEvent(event); setKworkInputHasContent(value.trim().length > 0); } else { console.warn("localKworkInputRef is null"); } }, [setKworkInputHasContent]);
  // Получение текущего значения поля ввода запроса
  const getKworkInputValue = useCallback((): string => localKworkInputRef.current?.value || "", []);
  // Добавление выбранных файлов в поле запроса
  const handleAddSelected = useCallback(async (filesToAddParam?: Set<string>, allFilesParam?: FileNode[]) => { const fTP=allFilesParam||files; const fTA=filesToAddParam||selectedFiles; if(fTP.length===0&&fTA.size>0){addToast("Файлы не загружены.",'error');return;} if(fTA.size===0){addToast("Выберите файлы.",'warning');return;} const pfx="Контекст кода для анализа:\n"; const mdTxt=fTP.filter(f=>fTA.has(f.path)).sort((a,b)=>a.path.localeCompare(b.path)).map(f=>{const pC=`// /${f.path}`; const cAHC=f.content.trimStart().startsWith(pC); const cTA=cAHC?f.content:`${pC}\n${f.content}`; return `\`\`\`${getLanguage(f.path)}\n${cTA}\n\`\`\``}).join("\n\n"); const cKV=getKworkInputValue(); const ctxRgx=/Контекст кода для анализа:[\s\S]*/; const tT=cKV.replace(ctxRgx,'').trim(); const nC=`${tT?tT+'\n\n':''}${pfx}${mdTxt}`; updateKworkInput(nC); addToast(`${fTA.size} файлов добавлено`, 'success'); scrollToSection('kworkInput'); }, [files, selectedFiles, addToast, getKworkInputValue, updateKworkInput, scrollToSection]);
  // Копирование текста в буфер обмена
  const handleCopyToClipboard = useCallback((textToCopy?: string, shouldScroll = true): boolean => { const c=textToCopy??getKworkInputValue(); if(!c.trim()){addToast("Нет текста",'warning');return false;} try{navigator.clipboard.writeText(c); addToast("Скопировано!",'success');setRequestCopied(true); if(shouldScroll)scrollToSection('executor');return true;}catch(e){console.error("Ошибка копирования:",e);addToast("Ошибка копирования",'error');return false;} }, [getKworkInputValue, scrollToSection, addToast, setRequestCopied]);
  // Очистка состояния компонента
  const handleClearAll = useCallback(() => { console.log("Очистка состояния Fetcher."); setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); updateKworkInput(""); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set()); setRequestCopied(false); addToast("Очищено ✨", 'success'); if (localKworkInputRef.current) localKworkInputRef.current.focus(); }, [ setSelectedFetcherFiles, updateKworkInput, addToast, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setRequestCopied ]);

  // --- Основная функция извлечения файлов ---
  const handleFetch = useCallback(async (isManualRetry = false, branchNameToFetch?: string | null) => {
      const effectiveBranch = branchNameToFetch || targetBranchName || manualBranchName || 'default';
      console.log(`Fetcher: Старт извлечения. Повтор: ${isManualRetry}, Ветка: ${effectiveBranch}, Статус: ${fetchStatusRef.current}, Задача: ${!!imageReplaceTask}, ИнициацияЗадачи: ${isImageTaskFetchInitiated.current}`);

      // Предотвращение повторного запуска для задачи замены картинки
      if (imageReplaceTask && isImageTaskFetchInitiated.current && (fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying')) {
          console.warn("Fetcher: Загрузка для задачи картинки уже идет. Отмена дубликата."); return;
      }
      // Проверки перед запуском
      if (!repoUrl.trim()) { console.error("Fetcher: URL пуст."); addToast("Введите URL", 'error'); setError("URL пуст."); triggerToggleSettingsModal(); return; }
      if ((fetchStatusRef.current === 'loading' || fetchStatusRef.current === 'retrying') && !isManualRetry) { console.warn("Fetcher: Уже идет загрузка."); addToast("Уже идет...", "info"); return; }
      if (assistantLoading || isParsing || aiActionLoading) { console.warn(`Fetcher: Заблокировано состоянием (assistantLoading: ${assistantLoading}, isParsing: ${isParsing}, aiActionLoading: ${aiActionLoading}).`); addToast("Подождите.", "warning"); return; }

      console.log("Fetcher: Запускаем процесс.");
      setFetchStatus('loading'); // Устанавливаем статус СНАЧАЛА
      // Сброс предыдущих результатов и ошибок
      setError(null); setFiles([]); setSelectedFilesState(new Set()); setPrimaryHighlightedPathState(null); setSecondaryHighlightedPathsState({ component: [], context: [], hook: [], lib: [], other: [] }); setAllFetchedFiles([]); setSelectedFetcherFiles(new Set()); setFilesFetched(false, [], null, []); setRequestCopied(false); setAiResponseHasContent(false); setFilesParsed(false); setSelectedAssistantFiles(new Set());
      // Специальная логика для задачи картинки и инициализации поля запроса
      if (imageReplaceTask) { isImageTaskFetchInitiated.current = true; updateKworkInput(""); }
      else if (!highlightedPathFromUrl && localKworkInputRef.current) { updateKworkInput(ideaFromUrl || DEFAULT_TASK_IDEA); }

      addToast(`Запрос (${effectiveBranch})...`, 'info');
      startProgressSimulation(13); // <<<--- ЗАПУСК СИМУЛЯЦИИ ПРОГРЕССА
      console.log("Fetcher: Симуляция запущена.");

      let result: Awaited<ReturnType<typeof fetchRepoContents>> | null = null;
      let success = false;
      let finalStatus: FetchStatus = 'error'; // По умолчанию - ошибка

      try {
          console.log(`Fetcher: Вызов server action для ветки: ${effectiveBranch}`);
          result = await fetchRepoContents(repoUrl, token || undefined, effectiveBranch);
          console.log(`Fetcher: Результат: Успех=${result?.success}, Файлов=${result?.files?.length ?? 'N/A'}, Ошибка=${result?.error ?? 'Нет'}`);

          if (result?.success && Array.isArray(result.files)) {
               success = true; const fetchedFiles = result.files;
               finalStatus = 'success'; // Предварительный успех

               // Логика после успешного извлечения (обработка файлов, подсветка, проверка задачи картинки)
               const allPaths=fetchedFiles.map(f=>f.path); let primaryHPath:string|null=null; const catSecPaths:Record<ImportCategory,Set<string>>={component:new Set(),context:new Set(),hook:new Set(),lib:new Set(),other:new Set()}; let filesToSel=new Set<string>();
               if(imageReplaceTask){ // Проверка для задачи замены картинки
                   primaryHPath=imageReplaceTask.targetPath;
                   if(!allPaths.includes(primaryHPath)){ // Если нужный файл не найден
                       const imgErr=`Файл (${primaryHPath}) не найден в '${effectiveBranch}'.`;
                       console.error(`Fetcher: ${imgErr}`); setError(imgErr); addToast(imgErr,'error');
                       setFilesFetched(true,fetchedFiles,null,[]); // Сообщаем контексту, что файлы загружены (но с ошибкой)
                       finalStatus='error'; success=false; // Переопределяем статус на ошибку
                   } else { filesToSel.add(primaryHPath); console.log(`Fetcher: Авто-выбор цели для замены картинки: ${primaryHPath}`); }
               }
               else if(highlightedPathFromUrl){ // Обработка подсветки из URL
                   primaryHPath=getPageFilePath(highlightedPathFromUrl,allPaths);
                   if(primaryHPath){
                       const pF=fetchedFiles.find(f=>f.path===primaryHPath);
                       if(pF){
                           filesToSel.add(primaryHPath);
                           const imps=extractImports(pF.content);
                           for(const imp of imps){
                               const rP=resolveImportPath(imp,pF.path,fetchedFiles);
                               if(rP&&rP!==primaryHPath){
                                   const cat=categorizeResolvedPath(rP);
                                   catSecPaths[cat].add(rP);
                                   if(cat!=='other')filesToSel.add(rP); // Добавляем в авто-выбор только не 'other' категории
                               }
                           }
                       } else { primaryHPath=null; addToast(`Ошибка: Путь (${primaryHPath}) не найден.`, 'error'); }
                   } else { addToast(`Файл страницы для URL (${highlightedPathFromUrl}) не найден.`, 'warning'); }
               }
               // Авто-выбор важных файлов (только если не задача замены картинки)
               if(!imageReplaceTask){ importantFiles.forEach(p=>{if(allPaths.includes(p)&&!filesToSel.has(p)){filesToSel.add(p); console.log(`Fetcher: Авто-выбор важного файла: ${p}`);}}); }

               // --- Продолжаем только если все еще успешно (особенно после проверки задачи картинки) ---
               if(success){
                   setPrimaryHighlightedPathState(primaryHPath);
                   const finalSecPaths={component:Array.from(catSecPaths.component),context:Array.from(catSecPaths.context),hook:Array.from(catSecPaths.hook),lib:Array.from(catSecPaths.lib),other:Array.from(catSecPaths.other)};
                   setSecondaryHighlightedPathsState(finalSecPaths);

                   // Обновляем локальное состояние выбора и состояние в контексте, ЕСЛИ это не задача картинки
                   if(!imageReplaceTask){
                       setSelectedFilesState(filesToSel);
                       setSelectedFetcherFiles(filesToSel);
                   }
                   // Обновляем состояние в контексте (это ТРИГГЕР для замены картинки, если она есть)
                   setFilesFetched(true,fetchedFiles,primaryHPath,Object.values(finalSecPaths).flat());
                   console.log("[Fetcher] Вызван setFilesFetched.");

                   // Обновления UI (тосты, скролл) - только если успех и НЕ задача картинки (у нее своя логика в контексте)
                   if (!imageReplaceTask) { addToast(`Извлечено ${fetchedFiles.length} файлов!`, 'success'); }
                   setFiles(fetchedFiles); // Обновляем локальный стейт для отображения списка
                   setAllFetchedFiles(fetchedFiles); // Обновляем стейт в контексте со всеми файлами
                   if(isSettingsModalOpen) triggerToggleSettingsModal(); // Закрыть модалку настроек, если была открыта

                   // Тосты и авто-действия для РАЗНЫХ сценариев (не для картинки)
                   if(imageReplaceTask && primaryHPath){ addToast(`Авто-выбран для замены: ${primaryHPath}`,'info'); }
                   else if(highlightedPathFromUrl && ideaFromUrl && filesToSel.size > 0 && !imageReplaceTask){ /* Авто-добавление при переходе по URL с идеей */ const nS=catSecPaths.component.size+catSecPaths.context.size+catSecPaths.hook.size+catSecPaths.lib.size; const nI=filesToSel.size-(primaryHPath?1:0)-nS; let msg=`✅ Авто-выбор: `; const pts=[]; if(primaryHPath)pts.push(`1 стр`); if(nS>0)pts.push(`${nS} связ`); if(nI>0)pts.push(`${nI} важн`); msg+=pts.join(', ')+` (${filesToSel.size} всего). Идея добавлена.`; addToast(msg,'success'); updateKworkInput(ideaFromUrl||DEFAULT_TASK_IDEA); await handleAddSelected(filesToSel,fetchedFiles); setTimeout(()=>{addToast("💡 Добавь инструкции!", "info");}, 500); }
                   else if(!imageReplaceTask){ /* Стандартный успех: тост об авто-выборе и скролл */ if(filesToSel.size>0){const nH=catSecPaths.component.size+catSecPaths.context.size+catSecPaths.hook.size+catSecPaths.lib.size; const nI=filesToSel.size-(primaryHPath?1:0)-nH; let msg=`Авто-выбраны: `; const pts=[]; if(primaryHPath)pts.push(`1 осн`); if(nH>0)pts.push(`${nH} связ`); if(nI>0)pts.push(`${nI} важн`); msg+=pts.join(', ')+'.'; addToast(msg,'info');} if(primaryHPath){setTimeout(()=>{const eId=`file-${primaryHPath}`; const el=document.getElementById(eId); if(el){el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md'); setTimeout(()=>el.classList.remove('ring-2','ring-offset-1','ring-offset-gray-900','ring-cyan-400','rounded-md'),2500);}},400);}else if(fetchedFiles.length>0){const el=document.getElementById('file-list-container'); el?.scrollIntoView({behavior:"smooth",block:"nearest"});} }
               } // Конец блока if(success)
          } else { // Если result.success === false
              console.error(`Fetcher: Server action НЕ УДАЛСЯ. Ошибка: ${result?.error}`);
              throw new Error(result?.error || `Не удалось получить файлы из ${effectiveBranch}.`);
          }
      } catch (err: any) { // Обработка ошибок (из action или других)
          console.error(`Fetcher: Ошибка в блоке catch handleFetch: ${err.message}`);
          const displayError = err?.message || "Неизвестная ошибка";
          setError(displayError); addToast(`Ошибка извлечения: ${displayError}`, 'error');
          setFilesFetched(false, [], null, []); // Сигнал контексту о неудаче
          success = false; finalStatus = 'error'; // Убеждаемся, что флаги установлены
      } finally {
           // --- КРИТИЧЕСКИ ВАЖНО: Остановить симуляцию и установить финальный статус/прогресс ---
           stopProgressSimulation(); // <<<--- ОСТАНОВКА СИМУЛЯЦИИ
           setProgress(success ? 100 : 0);
           setFetchStatus(finalStatus); // <<<--- УСТАНОВКА ФИНАЛЬНОГО СТАТУСА
           if (imageReplaceTask) { isImageTaskFetchInitiated.current = false; } // Сброс флага задачи картинки
           console.log(`Fetcher: Завершено. Успех: ${success}, Финальный статус установлен: ${fetchStatusRef.current}`);
      }
  }, [ // Зависимости useCallback для handleFetch
        // Состояния и сеттеры
        repoUrl, token, imageReplaceTask, assistantLoading, isParsing, aiActionLoading, repoUrlEntered,
        setFetchStatus, setFiles, setSelectedFilesState, setProgress, setError, setAllFetchedFiles,
        setPrimaryHighlightedPathState, setSecondaryHighlightedPathsState, setSelectedFetcherFiles, setFilesFetched,
        setRequestCopied, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles,
        // Производные состояния и константы
        highlightedPathFromUrl, ideaFromUrl, importantFiles, DEFAULT_TASK_IDEA, manualBranchName, targetBranchName,
        // Функции и рефы
        addToast, startProgressSimulation, stopProgressSimulation, getLanguage, getPageFilePath, extractImports, resolveImportPath, categorizeResolvedPath, handleAddSelected,
        getKworkInputValue, scrollToSection, setKworkInputHasContent, isSettingsModalOpen, triggerToggleSettingsModal,
        updateKworkInput, triggerAskAi, localKworkInputRef
    ]);

  // --- Другие колбэки (обработчики UI) ---
  // Выбрать подсвеченные файлы (основной + вторичные)
  const selectHighlightedFiles = useCallback(() => { const fTS=new Set<string>(selectedFiles); let nSC=0; const aHLS=[ ...secondaryHighlightedPaths.component, ...secondaryHighlightedPaths.context, ...secondaryHighlightedPaths.hook, ...secondaryHighlightedPaths.lib ]; if(primaryHighlightedPath&&files.some(f=>f.path===primaryHighlightedPath)&&!fTS.has(primaryHighlightedPath)){fTS.add(primaryHighlightedPath); nSC++;} aHLS.forEach(p=>{if(files.some(f=>f.path===p)&&!fTS.has(p)){fTS.add(p); nSC++;}}); if(nSC>0){setSelectedFilesState(fTS); setSelectedFetcherFiles(fTS); addToast(`${nSC} связанных добавлено`, 'info');} else {addToast("Все связанные уже выбраны", 'info');} }, [ primaryHighlightedPath, secondaryHighlightedPaths, files, selectedFiles, setSelectedFetcherFiles, addToast ]);
  // Переключить выбор файла
  const toggleFileSelection = useCallback((path: string) => { setSelectedFilesState(prevSet => { const newSet = new Set(prevSet); if(newSet.has(path)){ newSet.delete(path); }else{ newSet.add(path); } if (selectionUpdateTimeoutRef.current) clearTimeout(selectionUpdateTimeoutRef.current); selectionUpdateTimeoutRef.current = setTimeout(() => { setSelectedFetcherFiles(new Set(newSet)); selectionUpdateTimeoutRef.current = null; }, 150); return newSet; }); }, [setSelectedFetcherFiles]);
  // Добавить важные файлы к выбору
  const handleAddImportantFiles = useCallback(() => { let aC=0; const fTA=new Set(selectedFiles); importantFiles.forEach(p=>{if(files.some(f=>f.path===p)&&!selectedFiles.has(p)){fTA.add(p); aC++;}}); if(aC===0){addToast("Важные уже выбраны", 'info'); return;} setSelectedFilesState(fTA); setSelectedFetcherFiles(fTA); addToast(`Добавлено ${aC} важных`, 'success'); }, [selectedFiles, importantFiles, files, setSelectedFetcherFiles, addToast]);
  // Добавить дерево файлов в поле запроса
  const handleAddFullTree = useCallback(() => { if(files.length===0){addToast("Нет файлов",'warning'); return;} const tO=files.map((f)=>`- /${f.path}`).sort().join("\n"); const tC=`Структура:\n\`\`\`\n${tO}\n\`\`\``; let added=false; const cV=getKworkInputValue(); const tV=cV.trim(); const hT=/Структура:\s*```/im.test(tV); if(!hT){const nC=tV?`${tV}\n\n${tC}`:tC; updateKworkInput(nC); added=true;} if(added){addToast("Дерево добавлено",'success'); scrollToSection('kworkInput');} else {addToast("Дерево уже добавлено", 'info');} }, [files, getKworkInputValue, updateKworkInput, scrollToSection, addToast]);
  // Выбрать ветку из списка PR
  const handleSelectPrBranch = useCallback((branch: string | null) => { setTargetBranchName(branch); if(branch) addToast(`Ветка PR: ${branch}`, 'success'); else addToast(`Выбор ветки PR снят.`, 'info'); }, [setTargetBranchName, addToast]);
  // Обработка ручного ввода имени ветки
  const handleManualBranchChange = useCallback((name: string) => { setManualBranchName(name); }, [setManualBranchName]);
  // Загрузить список открытых PR
  const handleLoadPrs = useCallback(() => { triggerGetOpenPRs(repoUrl); }, [triggerGetOpenPRs, repoUrl]);
  // Выбрать все файлы
  const handleSelectAll = useCallback(() => { if(files.length===0)return; const allP=new Set(files.map(f=>f.path)); setSelectedFilesState(allP); setSelectedFetcherFiles(allP); addToast(`Выбрано ${allP.size} файлов`,'info'); }, [files, setSelectedFetcherFiles]);
  // Снять выбор со всех файлов
  const handleDeselectAll = useCallback(() => { setSelectedFilesState(new Set()); setSelectedFetcherFiles(new Set()); addToast("Выбор снят",'info'); }, [setSelectedFetcherFiles]);

  // --- Эффекты ---
  // Обновление флага repoUrlEntered и URL в ассистенте при изменении repoUrl
  useEffect(() => { setRepoUrlEntered(repoUrl.trim().length > 0); updateRepoUrlInAssistant(repoUrl); }, [repoUrl, setRepoUrlEntered, updateRepoUrlInAssistant]);

  // Эффект для автоматического запуска извлечения при наличии URL параметров или задачи картинки
  useEffect(() => {
    const branch = targetBranchName || manualBranchName || null;
    const canTriggerFetch = autoFetch && repoUrl &&
                           (fetchStatusRef.current === 'idle' || fetchStatusRef.current === 'failed_retries' || fetchStatusRef.current === 'error');

    const isImageFetchReady = !imageReplaceTask || !isImageTaskFetchInitiated.current;

    // Запускаем только если условия выполнены И ref-страж не активен
    if (canTriggerFetch && isImageFetchReady && !isAutoFetchingRef.current) {
        console.log(`[AutoFetch Effect] Запуск извлечения. Страж активен. ЗадачаКартинки: ${!!imageReplaceTask}, Инициация: ${isImageTaskFetchInitiated.current}`);
        isAutoFetchingRef.current = true; // Устанавливаем страж

        handleFetch(false, branch) // Вызов основной функции извлечения
            .catch(err => {
                // Сброс стража даже если handleFetch выбросил ошибку
                console.error("[AutoFetch Effect] handleFetch выбросил ошибку:", err);
            })
            .finally(() => {
                // Сбрасываем страж с небольшой задержкой после завершения
                setTimeout(() => {
                    console.log("[AutoFetch Effect] Сброс стража извлечения.");
                    isAutoFetchingRef.current = false;
                }, 300); // Задержка 300мс
            });

    } else if (autoFetch && imageReplaceTask && isImageTaskFetchInitiated.current) {
        console.log("[AutoFetch Effect] Пропуск: Загрузка для задачи картинки уже инициирована.");
    } else if (canTriggerFetch && isAutoFetchingRef.current) {
        console.log("[AutoFetch Effect] Пропуск: Страж уже активен.");
    }

  // Зависимости эффекта - используем handleFetch, который сам зависит от всего необходимого
  }, [repoUrl, autoFetch, fetchStatus, targetBranchName, manualBranchName, imageReplaceTask, handleFetch]);
  // --- Конец эффекта AutoFetch ---

  // Эффект для авто-добавления зависимостей при выборе файлов (кроме задачи картинки)
  useEffect(() => {
      if(files.length===0 || imageReplaceTask || fetchStatusRef.current !== 'success'){
          prevSelectedFilesRef.current = new Set(selectedFiles); // Обновляем предыдущие даже если выходим
          return;
      }
      // Находим только что добавленные файлы
      const newSelPaths=new Set<string>();
      selectedFiles.forEach(p => { if(!prevSelectedFilesRef.current.has(p)) { newSelPaths.add(p); } });
      // Если основной подсвеченный файл был только что выбран, добавляем его тоже
      if(primaryHighlightedPath && selectedFiles.has(primaryHighlightedPath) && !prevSelectedFilesRef.current.has(primaryHighlightedPath) && !newSelPaths.has(primaryHighlightedPath)){
          newSelPaths.add(primaryHighlightedPath);
      }
      if(newSelPaths.size === 0){ // Если ничего нового не выбрано
          prevSelectedFilesRef.current = new Set(selectedFiles); // Обновляем и выходим
          return;
      }

      // Ищем импорты только для файлов страниц или основного подсвеченного файла
      const pgSuffixes=['/page.tsx','/page.js','/index.tsx','/index.js'];
      const filesToCheck=Array.from(newSelPaths).filter(p => pgSuffixes.some(s=>p.endsWith(s)) || p===primaryHighlightedPath);

      if(filesToCheck.length > 0){
          const relatedToSel = new Set<string>();
          let foundCount = 0;
          filesToCheck.forEach(fp => {
              const fNode = files.find(f => f.path === fp);
              if(fNode){
                  const imps = extractImports(fNode.content);
                  imps.forEach(imp => {
                      const rP = resolveImportPath(imp, fNode.path, files);
                      if(rP && rP !== fp){ // Нашли разрешенный путь, и это не сам файл
                          const cat = categorizeResolvedPath(rP);
                          if(cat !== 'other'){ // Добавляем только если категория не 'other'
                              if(!selectedFiles.has(rP)){ // И если еще не выбран
                                  relatedToSel.add(rP);
                                  foundCount++;
                              }
                          }
                      }
                  });
              }
          });

          if(relatedToSel.size > 0){ // Если нашли новые связанные файлы
              const finalSel = new Set([...selectedFiles, ...relatedToSel]); // Объединяем с текущим выбором
              setSelectedFilesState(finalSel); // Обновляем локальное состояние
              setSelectedFetcherFiles(finalSel); // Обновляем состояние в контексте
              addToast(`🔗 Авто-добавлено ${foundCount} связанных`, 'info');
              prevSelectedFilesRef.current = finalSel; // Обновляем предыдущие для следующего раза
              return; // Выходим, чтобы не обновить prevSelectedFilesRef еще раз ниже
          }
      }
      // Если не нашли новых связанных или не было файлов для проверки, просто обновляем prevSelectedFilesRef
      prevSelectedFilesRef.current = new Set(selectedFiles);

  }, [selectedFiles, files, fetchStatus, primaryHighlightedPath, extractImports, resolveImportPath, categorizeResolvedPath, setSelectedFetcherFiles, addToast, imageReplaceTask]); // fetchStatus добавлен для re-run после загрузки

  // Очистка интервала симуляции при размонтировании компонента
  useEffect(() => { return () => stopProgressSimulation(); }, [stopProgressSimulation]);

  // === Imperative Handle (для вызова методов извне через ref) ===
  useImperativeHandle(ref, () => ({ handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, clearAll: handleClearAll, getKworkInputValue }), [handleFetch, selectHighlightedFiles, handleAddSelected, handleCopyToClipboard, handleClearAll, getKworkInputValue]);

  // --- Логика рендеринга ---
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'retrying';
  const showProgressBar = fetchStatus !== 'idle'; // Показываем прогресс-бар, если статус не 'idle'
  // Состояния, при которых кнопка "Извлечь" должна быть неактивна
  const isFetchDisabled = isLoading || loadingPrs || !repoUrlEntered || assistantLoading || isParsing || aiActionLoading;
  // Состояния, при которых кнопки действий (кроме "Извлечь") должны быть неактивны
  const isActionDisabled = isLoading || loadingPrs || aiActionLoading || assistantLoading || isParsing || !!imageReplaceTask;
  // Неактивность кнопки "Спросить AI" - *ВРЕМЕННО ОТКЛЮЧЕНО*
  const isAskAiDisabled = true; // <<<--- TEMPORARILY DISABLED (было: !kworkInputHasContent || isActionDisabled || !!imageReplaceTask || isWaitingForAi)
  // Неактивность кнопки "Копировать"
  const isCopyDisabled = !kworkInputHasContent || isActionDisabled || !!imageReplaceTask;
  // Неактивность кнопки "Очистить все"
  const isClearDisabled = (!kworkInputHasContent && selectedFiles.size === 0) || isActionDisabled || !!imageReplaceTask;
  // Неактивность кнопки "Добавить выбранные"
  const isAddSelectedDisabled = selectedFiles.size === 0 || isActionDisabled || !!imageReplaceTask;
  // Отображаемое имя текущей ветки
  const effectiveBranchDisplay = targetBranchName || manualBranchName || "default";
  // Флаг ожидания ответа от AI (для UI)
  const isWaitingForAi = aiActionLoading && !!currentAiRequestId;

  return (
    <div id="extractor" className="w-full p-4 md:p-6 bg-gray-800/50 backdrop-blur-sm text-gray-200 font-mono rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] border border-gray-700/50 relative overflow-hidden">
      {/* Заголовок и инструкции */}
       <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
            <div> <h2 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-400 mb-2 flex items-center gap-2"> <FaDownload className="text-purple-400" /> Кибер-Экстрактор Кода </h2> {!imageReplaceTask && ( <> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">1. Настрой URL/токен/ветку (<FaCodeBranch className="inline text-cyan-400 cursor-pointer hover:underline" onClick={triggerToggleSettingsModal}/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">2. Жми <span className="font-bold text-purple-400 mx-1">"Извлечь файлы"</span>.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">3. Выбери файлы для контекста.</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-1">4. Опиши задачу ИЛИ добавь файлы (<FaPlus className="inline text-sm"/>).</p> <p className="text-yellow-300/80 text-xs md:text-sm mb-2">5. Жми <span className="font-bold text-blue-400 mx-1">"Спросить AI"</span> или скопируй <FaCopy className="inline text-sm mx-px"/>.</p> </> )} {imageReplaceTask && ( <p className="text-blue-300/80 text-xs md:text-sm mb-2">Загрузка файла для замены картинки...</p> )} </div>
            <motion.button onClick={triggerToggleSettingsModal} disabled={isFetchDisabled} whileHover={{ scale: isFetchDisabled ? 1 : 1.1, rotate: isSettingsModalOpen ? 10 : -10 }} whileTap={{ scale: isFetchDisabled ? 1 : 0.95 }} title={isSettingsModalOpen ? "Скрыть" : "Настройки"} aria-label={isSettingsModalOpen ? "Скрыть настройки" : "Показать настройки"} aria-expanded={isSettingsModalOpen} className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors flex-shrink-0 disabled:opacity-50"> {isSettingsModalOpen ? <FaAngleUp className="text-cyan-400 text-xl" /> : <FaAngleDown className="text-cyan-400 text-xl" />} </motion.button>
        </div>
      {/* Модальное окно настроек */}
       <SettingsModal isOpen={isSettingsModalOpen} repoUrl={repoUrl} setRepoUrl={handleRepoUrlChange} token={token} setToken={setToken} manualBranchName={manualBranchName} setManualBranchName={handleManualBranchChange} currentTargetBranch={targetBranchName} openPrs={openPrs} loadingPrs={loadingPrs} onSelectPrBranch={handleSelectPrBranch} onLoadPrs={handleLoadPrs} loading={isLoading || loadingPrs || assistantLoading || aiActionLoading} />
      {/* Кнопка "Извлечь файлы" */}
       <div className="mb-4 flex justify-center">
            <motion.button onClick={() => { handleFetch(fetchStatus === 'failed_retries' || fetchStatus === 'error'); }} disabled={isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-base text-white bg-gradient-to-r ${fetchStatus === 'failed_retries' || fetchStatus === 'error' ? 'from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' : 'from-purple-600 to-cyan-500'} transition-all shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/40 ${(isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.98]"}`} whileHover={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 1.03 }} whileTap={{ scale: (isFetchDisabled && !(fetchStatus === 'failed_retries' || fetchStatus === 'error')) ? 1 : 0.97 }} title={`Извлечь файлы из ветки: ${effectiveBranchDisplay}`}> {isLoading ? <FaSpinner className="animate-spin" /> : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? <FaArrowsRotate /> : <FaDownload />)} {fetchStatus === 'retrying' ? "Повтор..." : isLoading ? "Загрузка..." : (fetchStatus === 'failed_retries' || fetchStatus === 'error' ? "Попробовать снова" : "Извлечь файлы")} <span className="text-xs opacity-80 hidden sm:inline">({effectiveBranchDisplay})</span> </motion.button>
        </div>
      {/* Прогресс-бар и область статуса */}
       {showProgressBar && (
            <div className="mb-4 min-h-[40px]">
                {/* Передаем статус и текущий прогресс в компонент ProgressBar */}
                <ProgressBar status={fetchStatus === 'failed_retries' ? 'error' : fetchStatus} progress={progress} />
                 {/* Отображение текстового статуса под прогресс-баром */}
                 {isLoading && <p className="text-cyan-300 text-xs font-mono mt-1 text-center animate-pulse">Извлечение ({effectiveBranchDisplay}): {Math.round(progress)}% {fetchStatus === 'retrying' ? '(Повтор)' : ''}</p>}
                 {isParsing && <p className="text-yellow-400 text-xs font-mono mt-1 text-center animate-pulse">Разбор ответа...</p>}
                 {fetchStatus === 'success' && files.length > 0 && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно ${files.length} файлов из '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && files.length === 0 && !imageReplaceTask && ( <div className="text-center text-xs font-mono mt-1 text-yellow-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Успешно, 0 файлов в '${effectiveBranchDisplay}'.`} </div> )}
                 {fetchStatus === 'success' && imageReplaceTask && files.length > 0 && ( <div className="text-center text-xs font-mono mt-1 text-green-400 flex items-center justify-center gap-1"> <FaCircleCheck /> {`Файл ${imageReplaceTask.targetPath.split('/').pop()} загружен.`} </div> )}
                 {(fetchStatus === 'error' || fetchStatus === 'failed_retries') && error && ( <div className="text-center text-xs font-mono mt-1 text-red-400 flex items-center justify-center gap-1"> <FaXmark /> {error} </div> )}
            </div>
        )}
      {/* Основная область контента (Список файлов и Поле запроса) */}
       <div className={`grid grid-cols-1 ${ (files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 md:gap-6`}>
         {/* Левая колонка: Превью и Список файлов (показывается при загрузке или если есть файлы) */}
         {(isLoading || files.length > 0) && (
             <div className="flex flex-col gap-4">
                  {/* Компонент превью выбранных файлов */}
                 <SelectedFilesPreview selectedFiles={selectedFiles} allFiles={files} getLanguage={getLanguage} />
                 {/* Компонент списка файлов */}
                 <FileList
                    id="file-list-container" files={files} selectedFiles={selectedFiles}
                    primaryHighlightedPath={primaryHighlightedPath} secondaryHighlightedPaths={secondaryHighlightedPaths}
                    importantFiles={importantFiles} isLoading={isLoading} isActionDisabled={isActionDisabled}
                    toggleFileSelection={toggleFileSelection} onAddSelected={() => handleAddSelected()}
                    onAddImportant={handleAddImportantFiles} onAddTree={handleAddFullTree}
                    onSelectHighlighted={selectHighlightedFiles} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll}
                 />
             </div>
         )}
         {/* Правая колонка: Поле запроса (показывается если есть файлы ИЛИ текст в поле, И НЕ задача картинки) */}
         {(files.length > 0 || (kworkInputHasContent && !imageReplaceTask)) ? (
             <div id="kwork-input-section" className="flex flex-col gap-3">
                 {/* Компонент поля ввода запроса */}
                 <RequestInput
                     kworkInputRef={localKworkInputRef}
                     onCopyToClipboard={() => handleCopyToClipboard(undefined, true)}
                     onClearAll={handleClearAll}
                     isCopyDisabled={isCopyDisabled}
                     isClearDisabled={isClearDisabled}
                     onInputChange={(value) => setKworkInputHasContent(value.trim().length > 0)}
                     onAskAi={triggerAskAi}
                     isAskAiDisabled={isAskAiDisabled} // Передаем флаг неактивности
                     aiActionLoading={aiActionLoading}
                     onAddSelected={() => handleAddSelected()}
                     isAddSelectedDisabled={isAddSelectedDisabled}
                     selectedFetcherFilesCount={selectedFiles.size}
                 />
             </div>
         ) : null }
         {/* Заглушка во время обработки задачи замены картинки (показывается если есть задача, fetch успешен, файлы есть) */}
         {imageReplaceTask && fetchStatus === 'success' && files.length > 0 && (
             <div className={`md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-gray-700/30 rounded-lg border border-dashed border-blue-400 min-h-[200px]`}>
                 {(assistantLoading || aiActionLoading) ? ( <FaSpinner className="text-blue-400 text-3xl mb-3 animate-spin" /> ) : ( <FaCircleCheck className="text-green-400 text-3xl mb-3" /> )}
                 <p className="text-sm text-blue-300"> {(assistantLoading || aiActionLoading) ? "Обработка замены..." : `Файл ${imageReplaceTask.targetPath.split('/').pop()} готов.`} </p>
                 <p className="text-xs text-gray-400 mt-1"> {(assistantLoading || aiActionLoading) ? "Создание/обновление PR..." : "Перехожу к созданию PR..."} </p>
             </div>
         )}
      </div>
    </div>
  );
});
RepoTxtFetcher.displayName = 'RepoTxtFetcher';
export default RepoTxtFetcher;