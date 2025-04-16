"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// Context & Actions
import {
    useRepoXmlPageContext, AICodeAssistantRef, SimplePullRequest
} from "@/contexts/RepoXmlPageContext";
import { createGitHubPullRequest, updateBranch, fetchRepoContents } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase"; // Use Admin for DB writes if needed from client (secure rules!)
import { useAppContext } from "@/contexts/AppContext";
// Hooks & Components
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry } from "@/hooks/useCodeParsingAndValidation";
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { ImageToolsModal } from './assistant_components/ImageToolsModal';
import { SwapModal } from './assistant_components/SwapModal';
import { CodeRestorer } from './assistant_components/CodeRestorer';
// UI & Utils
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircleInfo, FaCodeBranch, FaGithub, FaWandMagicSparkles, FaArrowsRotate, FaImage } from "react-icons/fa6";
import clsx from "clsx";
import { saveAs } from "file-saver";

// Tooltip Component
export const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => { const [isVisible, setIsVisible] = useState(false); const positionClasses = { top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1', bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1', left: 'right-full top-1/2 transform -translate-y-3/4 mr-1', right: 'left-full top-1/2 transform -translate-y-1/2 ml-1', }; return ( <div className="relative inline-block group"> <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>{children}</div> <AnimatePresence> {isVisible && ( <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }} className={clsx("absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded-lg shadow-lg w-max max-w-xs whitespace-pre-line", positionClasses[position])}> {text} </motion.div> )} </AnimatePresence> </div> ); }; Tooltip.displayName = 'Tooltip';

// Interfaces
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {}
interface OriginalFile { path: string; content: string; }

// Helper: Robust Function Selection Logic
const selectFunctionDefinition = (text: string, startIndex: number): [number, number] => { const declarationLineStart = text.lastIndexOf('\n', startIndex - 1) + 1; let braceStart = -1; let searchPos = declarationLineStart; let inSingleLineComment = false; let inMultiLineComment = false; let inString: '"' | "'" | null = null; let parenDepth = 0; while(searchPos < text.length) { const char = text[searchPos]; const prevChar = searchPos > 0 ? text[searchPos - 1] : ''; if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; } else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; } else if (inString) { if (char === inString && prevChar !== '\\') inString = null; } else if (char === '/' && prevChar === '/') { inSingleLineComment = true; } else if (char === '*' && prevChar === '/') { inMultiLineComment = true; } else if (char === '"' || char === "'") { inString = char; } else if (char === '(') parenDepth++; else if (char === ')') parenDepth--; else if (char === '{' && parenDepth === 0) { const precedingText = text.substring(declarationLineStart, searchPos).trim(); if (precedingText.endsWith(')') || precedingText.endsWith('=>') || precedingText.match(/[a-zA-Z0-9_$]\s*$/)) { braceStart = searchPos; break; } if (precedingText.match(/[a-zA-Z0-9_$]+\s*\([^)]*\)$/)) { braceStart = searchPos; break; } } if (char === '\n' && text.substring(searchPos + 1).match(/^\s*(?:async\s+|function\s+|const\s+|let\s+|var\s+|class\s+|get\s+|set\s+|[a-zA-Z0-9_$]+\s*\(|\/\/|\/\*)/)) { if (braceStart === -1) break; } searchPos++; } if (braceStart === -1) return [-1, -1]; let depth = 1; let pos = braceStart + 1; inSingleLineComment = false; inMultiLineComment = false; inString = null; while (pos < text.length && depth > 0) { const char = text[pos]; const prevChar = pos > 0 ? text[pos - 1] : ''; if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; } else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; } else if (inString) { if (char === inString && prevChar !== '\\') inString = null; } else if (char === '/' && prevChar === '/') { inSingleLineComment = true; } else if (char === '*' && prevChar === '/') { inMultiLineComment = true; } else if (char === '"' || char === "'") { inString = char; } else if (char === '{') depth++; else if (char === '}') depth--; pos++; } if (depth !== 0) return [-1,-1]; const closingBracePos = pos - 1; let closingLineEnd = text.indexOf('\n', closingBracePos); if (closingLineEnd === -1) closingLineEnd = text.length; return [declarationLineStart, closingLineEnd]; };
// Helper: Extract Function Name
const extractFunctionName = (line: string): string | null => { const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?\s*([a-zA-Z0-9_$]+)\s*(?:[:=(]|\s*=>)/); if (funcMatch && funcMatch[1]) return funcMatch[1]; const methodMatch = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/); if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) return methodMatch[1]; return null; };

// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    // --- Hooks ---
    const { user } = useAppContext();
    const {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues,
        setParsedFiles, setValidationStatus, setValidationIssues, setIsParsing // Added setIsParsing
    } = useCodeParsingAndValidation();

    // --- Context Access ---
    const {
        aiResponseInputRef,
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        setAssistantLoading,
        assistantLoading,
        aiActionLoading, // Waiting for AI response via Realtime
        currentAiRequestId, // ID of monitored request
        openPrs: contextOpenPrs,
        targetBranchName,
        triggerToggleSettingsModal,
        triggerUpdateBranch,
        updateRepoUrlInAssistant,
        loadingPrs,
    } = useRepoXmlPageContext();

    // --- State ---
    const [response, setResponse] = useState<string>("");
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [repoUrl, setRepoUrlState] = useState<string>("https://github.com/salavey13/cartest");
    const [prTitle, setPrTitle] = useState<string>("");
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
    const [isProcessingPR, setIsProcessingPR] = useState(false);
    const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
    const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Helper
    const extractPRTitleHint = (text: string): string => { const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

    // Effects
    useEffect(() => {
        const hasContent = response.trim().length > 0;
        setAiResponseHasContent(hasContent);
        if (!hasContent && !currentAiRequestId && !aiActionLoading) {
            setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle');
            setValidationIssues([]); setOriginalRepoFiles([]);
        } else if (hasContent && parsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading) {
            setValidationStatus('idle'); setValidationIssues([]);
        }
    }, [ response, currentAiRequestId, aiActionLoading, parsedFiles.length, isParsing, assistantLoading, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues ]);
    useEffect(() => { const loadLinks = async () => { if (!user) { setCustomLinks([]); return; } try { const { data: d, error: e } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!e && d?.metadata?.customLinks) setCustomLinks(d.metadata.customLinks); else setCustomLinks([]); } catch (e) { console.error(e); setCustomLinks([]); } }; loadLinks(); }, [user]);
    const skippedCodeBlockIssues = validationIssues.filter(i => i.type === 'skippedCodeBlock');
    useEffect(() => { if (skippedCodeBlockIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) { const fetchOriginals = async () => { setIsFetchingOriginals(true); const branch = targetBranchName ?? undefined; const branchDisplay = targetBranchName ?? 'default'; toast.info(`Загрузка оригиналов из ветки ${branchDisplay}...`); try { const result = await fetchRepoContents(repoUrl, undefined, branch); if (result.success && Array.isArray(result.files)) { setOriginalRepoFiles(result.files); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (result.error ?? '?')); setOriginalRepoFiles([]); } } catch (e) { toast.error("Крит. ошибка."); console.error(e); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOriginals(); } }, [skippedCodeBlockIssues.length, originalRepoFiles.length, isFetchingOriginals, repoUrl, targetBranchName]);

    // --- Handlers ---
    const handleParse = useCallback(async () => {
        setIsParsing(true); // Set parsing state
        setOriginalRepoFiles([]);
        try {
             const { files: newlyParsedFiles, rawDescription: parsedRawDescription } = await parseAndValidateResponse(response);
             setFilesParsed(newlyParsedFiles.length > 0);
             const initialSelection = new Set(newlyParsedFiles.map(f => f.id));
             setSelectedFileIds(initialSelection);
             setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));
             if (newlyParsedFiles.length > 0) setPrTitle(extractPRTitleHint(parsedRawDescription || response));
             else setPrTitle('');
        } catch (error) {
             console.error("Error during parseAndValidateResponse:", error);
             toast.error("Ошибка разбора ответа AI.");
             setFilesParsed(false);
             setSelectedFileIds(new Set());
             setSelectedAssistantFiles(new Set());
             setValidationStatus('error'); // Indicate error
             setValidationIssues([{type: 'general', message: 'Ошибка парсинга ответа.', fixable: false, restorable: false, id:'parse_error'}]);
        } finally {
             setIsParsing(false); // Reset parsing state
        }
    }, [response, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles, setIsParsing, setValidationStatus, setValidationIssues]); // Added setIsParsing
    const handleAutoFix = useCallback(() => { autoFixIssues(parsedFiles, validationIssues); }, [autoFixIssues, parsedFiles, validationIssues]);
    const handleCopyFixPrompt = useCallback(() => { const s=validationIssues.filter(i=>i.type==='skippedComment'); if(s.length===0) return toast.info("Нет '// .. .'"); const fL=s.map(i=>`- ${i.filePath} (~${i.details?.lineNumber})`).join('\n'); const p=`Восстанови пропуски ('// ..''.') в новых файлах, используя старые как референс:\n${fL}\n\nВерни полные новые версии.`; navigator.clipboard.writeText(p).then(()=>toast.success("Промпт скопирован!")).catch(()=>toast.error("Ошибка.")); }, [validationIssues]);
    const handleRestorationComplete = useCallback((updatedFiles: FileEntry[], sC: number, eC: number) => { setParsedFiles(updatedFiles); const rI = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); setValidationIssues(rI); setValidationStatus(rI.length > 0 ? (rI.some(i=>!i.fixable&&!i.restorable)?'error':'warning') : 'success'); if(sC>0) toast.success(`${sC} блоков восстановлено.`); if(eC>0) toast.error(`${eC} блоков не удалось восстановить.`); }, [validationIssues, setParsedFiles, setValidationIssues, setValidationStatus]);
    const handleClearResponse = useCallback(() => { setResponse(""); toast.info("Поле ответа очищено."); }, []);
    const handleCopyResponse = useCallback(() => { if (!response) return; navigator.clipboard.writeText(response).then(()=>toast.success("Скопировано!")).catch(()=>{toast.error("Ошибка копирования")});}, [response]);
    const handleOpenModal = useCallback((mode: 'replace' | 'search') => { setModalMode(mode); setShowModal(true); }, []);
    const handleSwap = useCallback((find: string, replace: string) => { if (!find || !aiResponseInputRef.current) return; try { const ta=aiResponseInputRef.current; const cV=ta.value; const ef=find.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); const rg=new RegExp(ef,'g'); const nV=cV.replace(rg,replace); if(nV!==cV){ setResponse(nV); requestAnimationFrame(()=>{if(aiResponseInputRef.current)aiResponseInputRef.current.value=nV;}); setParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`"${find}"->"${replace}". Жми '➡️'.`); } else { toast.info(`"${find}" не найден.`); } } catch(e:any){ toast.error(`Ошибка: ${e.message}`); } }, [aiResponseInputRef, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);
    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => { if (!searchText || !aiResponseInputRef.current) return; const ta=aiResponseInputRef.current; const t=ta.value; if(isMultiline){ const cst=searchText.split('\n').map(l=>l.trim()).filter(l=>l.length>0).join('\n'); if(!cst){toast.error("Текст пуст."); return;} const fL=cst.split('\n')[0]; const fN=extractFunctionName(fL); if(!fN){toast.error("Не найдено имя функции."); return;} const fR=new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${fN}\\s*(?:\\(|[:=]|<)`, 'm'); let m=fR.exec(t); if(!m){const mR=new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${fN}\\s*\\(`, 'm'); m=mR.exec(t);} if(!m){toast.info(`Функция "${fN}" не найдена.`); return;} const mI=m.index+m[1].length; const[sP,eP]=selectFunctionDefinition(t,mI); if(sP===-1||eP===-1){toast.error("Не удалось выделить функцию."); return;} const nV=t.substring(0,sP)+cst+t.substring(eP); setResponse(nV); requestAnimationFrame(()=>{if(aiResponseInputRef.current){aiResponseInputRef.current.value=nV; aiResponseInputRef.current.focus(); aiResponseInputRef.current.setSelectionRange(sP,sP+cst.length);}}); setParsedFiles([]); setFilesParsed(false); setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); toast.success(`Функция "${fN}" заменена! ✨ Жми '➡️'.`); } else { const sL=searchText.toLowerCase(); const tL=t.toLowerCase(); const cP=ta.selectionStart||0; let sF=cP; let i=tL.indexOf(sL,sF); if(i===-1){i=tL.indexOf(sL,0); if(i===-1||i>=cP){toast.info(`"${searchText}" не найден.`); ta.focus(); return;} toast.info("Поиск с начала.");} ta.focus(); ta.setSelectionRange(i,i+searchText.length); toast(`Найдено: "${searchText}"`,{style:{background:"rgba(30, 64, 175, 0.9)",color:"#fff",border:"1px solid rgba(37, 99, 235, 0.3)", backdropFilter:"blur(3px)"},duration:2000}); } }, [aiResponseInputRef, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);
    const handleSelectFunction = useCallback(() => { const ta=aiResponseInputRef.current; if(!ta)return; const t=ta.value; const cP=ta.selectionStart; let lSI=t.lastIndexOf('\n',cP-1)+1; const[sP,eP]=selectFunctionDefinition(t,lSI); if(sP!==-1&&eP!==-1){ta.focus();ta.setSelectionRange(sP,eP);toast.success("Функция выделена!");} else { let sBI=t.lastIndexOf('{',lSI); if(sBI>0){const[sPB,ePB]=selectFunctionDefinition(t,sBI); if(sPB!==-1&&ePB!==-1){ta.focus();ta.setSelectionRange(sPB,ePB);toast.success("Функция найдена выше!");return;}} toast.info("Не удалось выделить функцию."); ta.focus();}}, [aiResponseInputRef]);
    const handleToggleFileSelection = useCallback((fileId: string) => { setSelectedFileIds(prev => { const ns = new Set(prev); if (ns.has(fileId)) ns.delete(fileId); else ns.add(fileId); const sp = new Set( Array.from(ns).map(id => parsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[] ); setSelectedAssistantFiles(sp); return ns; }); }, [parsedFiles, setSelectedAssistantFiles]);
    const handleSelectAllFiles = useCallback(() => { const aI=new Set(parsedFiles.map(f=>f.id)); const aP=new Set(parsedFiles.map(f=>f.path)); setSelectedFileIds(aI); setSelectedAssistantFiles(aP); if(aI.size>0) toast.info(`${aI.size} файлов выбрано.`); }, [parsedFiles, setSelectedAssistantFiles]);
    const handleDeselectAllFiles = useCallback(() => { setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); toast.info("Выделение снято."); }, [setSelectedAssistantFiles]);
    const handleSaveFiles = useCallback(async () => { if (!user) return; const fts=parsedFiles.filter(f=>selectedFileIds.has(f.id)); if(fts.length===0)return; setIsProcessingPR(true); try{const fd=fts.map(f=>({p:f.path, c:f.content, e:f.extension})); const{data:ed,error:fe}=await supabaseAdmin.from("users").select("metadata").eq("user_id",user.id).single(); if(fe&&fe.code!=='PGRST116') throw fe; const ef=ed?.metadata?.generated_files||[]; const np=new Set(fd.map(f=>f.p)); const mf=[...ef.filter((f:any)=>!np.has(f.path)),...fd.map(f=>({path:f.p,code:f.c,extension:f.e}))]; const{error:ue}=await supabaseAdmin.from("users").upsert({user_id:user.id,metadata:{...(ed?.metadata||{}),generated_files:mf}},{onConflict:'user_id'}); if(ue) throw ue; toast.success(`${fts.length} файлов сохранено!`);}catch(err){toast.error("Ошибка сохранения."); console.error(err);}finally{setIsProcessingPR(false);}}, [user, parsedFiles, selectedFileIds]);
    const handleDownloadZip = useCallback(async () => { const ftz = parsedFiles.filter(f => selectedFileIds.has(f.id)); if (ftz.length === 0) return; setIsProcessingPR(true); try { const JSZip = (await import("jszip")).default; const zip = new JSZip(); ftz.forEach((f) => zip.file(f.path, f.content)); const blob = await zip.generateAsync({type:"blob"}); saveAs(blob, `ai_files_${Date.now()}.zip`); toast.success("Архив скачан."); } catch (error) { toast.error("Ошибка ZIP."); console.error(error); } finally { setIsProcessingPR(false); }}, [parsedFiles, selectedFileIds]);
    const handleSendToTelegram = useCallback(async (file: FileEntry) => { if (!user?.id) return; setIsProcessingPR(true); try { const r=await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop()||"file.txt"); if (!r.success) throw new Error(r.error??"TG Error"); toast.success(`"${file.path}" отправлен.`); } catch (err:any) { toast.error(`Ошибка отправки: ${err.message}`); console.error(err); } finally { setIsProcessingPR(false); }}, [user]);
    const handleAddCustomLink = useCallback(async () => { const n=prompt("Назв:"); if(!n) return; const u=prompt("URL (https://..):"); if(!u||!u.startsWith('http')){toast.error("Некорр. URL."); return;} const nl={name:n,url:u}; const ul=[...customLinks,nl]; setCustomLinks(ul); if(user){try{const{data:ed}=await supabaseAdmin.from("users").select("metadata").eq("user_id",user.id).single(); await supabaseAdmin.from("users").upsert({user_id:user.id,metadata:{...(ed?.metadata||{}),customLinks:ul}},{onConflict:'user_id'}); toast.success(`Ссылка "${n}" добавлена.`);}catch(e){toast.error("Ошибка сохр."); console.error(e); setCustomLinks(customLinks);}} }, [customLinks, user]);
    const handleCreateOrUpdatePR = useCallback(async () => { const sfl = parsedFiles.filter(f => selectedFileIds.has(f.id)); if (!repoUrl || sfl.length === 0 || !prTitle) { return toast.error("Укажите URL, Заголовок и выберите файлы."); } let fD = rawDescription.substring(0, 60000) + (rawDescription.length > 60000 ? "\n\n...(описание усечено)" : ""); fD += `\n\n**Файлы (${sfl.length}):**\n` + sfl.map(f => `- \`${f.path}\``).join('\n'); const rI = validationIssues.filter(i => i.type !== 'skippedCodeBlock' && i.type !== 'skippedComment'); if (rI.length > 0) { fD += "\n\n**Обнаруженные Проблемы:**\n" + rI.map(i => `- **${i.filePath}**: ${i.message}`).join('\n'); } const cS = prTitle.substring(0, 70); let cB = `Apply AI changes to ${sfl.length} files.\nRef: ${rawDescription.split('\n')[0]?.substring(0,100) ?? ''}...`; const fCM = `${cS}\n\n${cB}`; const ftC = sfl.map(f => ({ path: f.path, content: f.content })); setIsProcessingPR(true); setAssistantLoading(true); try { if (targetBranchName) { toast.info(`Обновление ветки '${targetBranchName}'...`); const r=await triggerUpdateBranch(repoUrl,ftC,fCM,targetBranchName); if(r.success){ toast.success(`Ветка '${targetBranchName}' обновлена! Commit: ${r.commitSha?.substring(0,7)}`); } else { toast.error(`Ошибка ветки '${targetBranchName}': ${r.error}`); } } else { toast.info(`Создание нового PR...`); const r=await createGitHubPullRequest(repoUrl,ftC,prTitle,fD,fCM); if(r.success&&r.prUrl){ toast.success(`PR создан: ${r.prUrl}`); await notifyAdmin(`Новый PR "${prTitle}" создан ${user?.username || user?.id}: ${r.prUrl}`); } else { toast.error("Ошибка PR: "+r.error); console.error("PR Failed:", r.error); } } } catch (err) { toast.error(`Крит. ошибка при ${targetBranchName?'обновлении':'создании PR'}.`); console.error(err); } finally { setIsProcessingPR(false); setAssistantLoading(false); } }, [ parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, targetBranchName, triggerUpdateBranch, setAssistantLoading, user ]);
    const setResponseValue = useCallback((value: string) => { setResponse(value); if (aiResponseInputRef.current) { aiResponseInputRef.current.value = value; const event = new Event('input', { bubbles: true }); aiResponseInputRef.current.dispatchEvent(event); } }, [aiResponseInputRef]);
    const updateRepoUrl = useCallback((url: string) => { setRepoUrlState(url); }, []);

    // Imperative Handle
    useImperativeHandle(ref, () => ({ handleParse, selectAllParsedFiles: handleSelectAllFiles, handleCreatePR: handleCreateOrUpdatePR, setResponseValue, updateRepoUrl, }), [handleParse, handleSelectAllFiles, handleCreateOrUpdatePR, setResponseValue, updateRepoUrl]);

    // --- RENDER ---
    const isProcessingAny = assistantLoading || aiActionLoading || isParsing || isProcessingPR || isFetchingOriginals || loadingPrs;
    const canSubmitPR = !isProcessingAny && selectedFileIds.size > 0 && !!prTitle && !!repoUrl;
    const prButtonText = targetBranchName ? `Обновить Ветку (${targetBranchName.substring(0, 15)}...)` : "Создать PR";
    const prButtonIcon = targetBranchName ? <FaCodeBranch /> : <FaGithub />;
    const prButtonLoadingIcon = isProcessingPR ? <FaArrowsRotate className="animate-spin"/> : prButtonIcon;
    const assistantTooltipText = `Вставьте ответ AI ИЛИ используйте кнопку 'Спросить AI'. Затем '➡️' → Проверьте/Исправьте → Выберите файлы → ${prButtonText}`;
    const isWaitingForAiResponse = aiActionLoading && !!currentAiRequestId;

    return (
        <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            {/* Header */}
             <header className="flex justify-between items-center gap-2">
                 <div className="flex items-center gap-2">
                     <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">AI Code Assistant</h1>
                     <Tooltip text={assistantTooltipText} position="bottom">
                         <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
                     </Tooltip>
                 </div>
                 <Tooltip text="Настройки URL/Token/Ветки/PR" position="left">
                      <button id="settings-modal-trigger-assistant" onClick={triggerToggleSettingsModal} className="p-2 text-gray-400 hover:text-cyan-400 transition rounded-full hover:bg-gray-700/50 disabled:opacity-50" disabled={isProcessingAny} > <FaCodeBranch className="text-xl" /> </button>
                 </Tooltip>
             </header>

            {/* AI Response Input Area */}
             <div>
                 <p className="text-yellow-400 mb-2 text-xs md:text-sm">
                    {isWaitingForAiResponse
                        ? "⏳ Ожидание ответа от AI... (через Realtime)"
                        : "2️⃣ Ответ от AI появится здесь (или вставьте). Затем '➡️'."}
                 </p>
                 <div className="relative group">
                     <textarea
                         id="response-input"
                         ref={aiResponseInputRef}
                         className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                         value={response}
                         onChange={(e) => setResponse(e.target.value)}
                         placeholder={isWaitingForAiResponse ? "AI думает..." : "Ответ от AI появится здесь..."}
                         disabled={isProcessingAny}
                         spellCheck="false"
                     />
                     <TextAreaUtilities
                         response={response}
                         isLoading={isProcessingAny}
                         onParse={handleParse}
                         onOpenModal={handleOpenModal}
                         onCopy={handleCopyResponse}
                         onClear={handleClearResponse}
                         onSelectFunction={handleSelectFunction}
                         isParseDisabled={isWaitingForAiResponse || isProcessingAny || !response.trim()}
                     />
                 </div>
                 {/* Validation Status and Actions */}
                  <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                      <CodeRestorer
                         parsedFiles={parsedFiles}
                         originalFiles={originalRepoFiles}
                         skippedIssues={skippedCodeBlockIssues}
                         onRestorationComplete={handleRestorationComplete}
                         disabled={isProcessingAny || validationStatus === 'validating' || isFetchingOriginals}
                      />
                      <ValidationStatusIndicator
                          status={validationStatus}
                          issues={validationIssues}
                          onAutoFix={handleAutoFix}
                          onCopyPrompt={handleCopyFixPrompt}
                          isFixDisabled={isWaitingForAiResponse || isProcessingAny}
                      />
                 </div>
             </div>

             {/* Parsed Files List */}
             <ParsedFilesList
                 parsedFiles={parsedFiles}
                 selectedFileIds={selectedFileIds}
                 validationIssues={validationIssues}
                 onToggleSelection={handleToggleFileSelection}
                 onSelectAll={handleSelectAllFiles}
                 onDeselectAll={handleDeselectAllFiles}
                 onSaveFiles={handleSaveFiles}
                 onDownloadZip={handleDownloadZip}
                 onSendToTelegram={handleSendToTelegram}
                 isUserLoggedIn={!!user}
                 isLoading={isProcessingAny}
             />

             {/* PR Form */}
             <PullRequestForm
                  repoUrl={repoUrl}
                  prTitle={prTitle}
                  selectedFileCount={selectedFileIds.size}
                 isLoading={isProcessingPR}
                 isLoadingPrList={loadingPrs} // Pass PR loading state
                 onRepoUrlChange={(url) => { setRepoUrlState(url); updateRepoUrlInAssistant(url); }}
                 onPrTitleChange={setPrTitle}
                 onCreatePR={handleCreateOrUpdatePR}
                 buttonText={prButtonText}
                 buttonIcon={prButtonLoadingIcon}
                 isSubmitDisabled={!canSubmitPR || isProcessingPR}
             />

             {/* Open PR List */}
             <OpenPrList openPRs={contextOpenPrs} />

            {/* Toolbar Area */}
            <div className="flex items-center gap-3 mb-2">
                <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />
                 <Tooltip text="Загрузить картинки в Storage" position="left">
                     <button onClick={() => setIsImageModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:ring-1 hover:ring-cyan-500 disabled:opacity-50" disabled={isProcessingAny} > <FaImage className="text-gray-400" /> <span className="text-sm text-white">Картинки</span> </button>
                 </Tooltip>
            </div>

             {/* Modals */}
             <AnimatePresence>
                 {showModal && ( <SwapModal isOpen={showModal} onClose={() => setShowModal(false)} onSwap={handleSwap} onSearch={handleSearch} initialMode={modalMode} /> )}
                 {isImageModalOpen && ( <ImageToolsModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} /> )}
             </AnimatePresence>
        </div>
      );
});
AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;