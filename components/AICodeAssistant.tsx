"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// .. (keep other imports)
import { useRepoXmlPageContext, AICodeAssistantRef } from "@/contexts/RepoXmlPageContext";
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry } from "@/hooks/useCodeParsingAndValidation";
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { SwapModal } from './assistant_components/SwapModal';
import { CodeRestorer } from './assistant_components/CodeRestorer';
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircleInfo } from "react-icons/fa6";
import clsx from "clsx";
import { saveAs } from "file-saver";
import { createGitHubPullRequest, getOpenPullRequests, fetchRepoContents } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";


// --- Tooltip Component ---
// .. (keep existing implementation)
export const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => { const [isVisible, setIsVisible] = useState(false); const positionClasses = { top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1', bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1', left: 'right-full top-1/2 transform -translate-y-3/4 mr-1', right: 'left-full top-1/2 transform -translate-y-1 ml-1', }; return ( <div className="relative inline-block group"> <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>{children}</div> <AnimatePresence> {isVisible && ( <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }} className={clsx("absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded-lg shadow-lg w-max max-w-xs whitespace-pre-line", positionClasses[position])}> {text} </motion.div> )} </AnimatePresence> </div> ); }; Tooltip.displayName = 'Tooltip';


// --- Interfaces ---
// .. (keep existing interfaces)
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {}
interface OriginalFile { path: string; content: string; }

// --- Helper: Robust Function Selection Logic ---
// .. (keep existing implementation)
const selectFunctionDefinition = (text: string, startIndex: number): [number, number] => { const declarationLineStart = text.lastIndexOf('\n', startIndex - 1) + 1; let braceStart = -1; let searchPos = declarationLineStart; let inSingleLineComment = false; let inMultiLineComment = false; let inString: '"' | "'" | null = null; let parenDepth = 0; while(searchPos < text.length) { const char = text[searchPos]; const prevChar = searchPos > 0 ? text[searchPos - 1] : ''; if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; } else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; } else if (inString) { if (char === inString && prevChar !== '\\') inString = null; } else if (char === '/' && prevChar === '/') { inSingleLineComment = true; } else if (char === '*' && prevChar === '/') { inMultiLineComment = true; } else if (char === '"' || char === "'") { inString = char; } else if (char === '(') parenDepth++; else if (char === ')') parenDepth--; else if (char === '{' && parenDepth === 0) { const precedingText = text.substring(declarationLineStart, searchPos).trim(); if (precedingText.endsWith(')') || precedingText.endsWith('=>') || precedingText.match(/[a-zA-Z0-9_$]\s*$/)) { braceStart = searchPos; break; } if (precedingText.match(/[a-zA-Z0-9_$]+\s*\([^)]*\)$/)) { braceStart = searchPos; break; } } if (char === '\n' && text.substring(searchPos + 1).match(/^\s*(?:async\s+|function\s+|const\s+|let\s+|var\s+|class\s+|get\s+|set\s+|[a-zA-Z0-9_$]+\s*\(|\/\/|\/\*)/)) { if (braceStart === -1) break; } searchPos++; } if (braceStart === -1) return [-1, -1]; let depth = 1; let pos = braceStart + 1; inSingleLineComment = false; inMultiLineComment = false; inString = null; while (pos < text.length && depth > 0) { const char = text[pos]; const prevChar = pos > 0 ? text[pos - 1] : ''; if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; } else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; } else if (inString) { if (char === inString && prevChar !== '\\') inString = null; } else if (char === '/' && prevChar === '/') { inSingleLineComment = true; } else if (char === '*' && prevChar === '/') { inMultiLineComment = true; } else if (char === '"' || char === "'") { inString = char; } else if (char === '{') depth++; else if (char === '}') depth--; pos++; } if (depth !== 0) return [-1,-1]; const closingBracePos = pos - 1; let closingLineEnd = text.indexOf('\n', closingBracePos); if (closingLineEnd === -1) closingLineEnd = text.length; return [declarationLineStart, closingLineEnd]; };


// --- Helper: Extract Function Name ---
// .. (keep existing implementation)
const extractFunctionName = (line: string): string | null => { const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?\s*([a-zA-Z0-9_$]+)\s*(?:[:=(]|\s*=>)/); if (funcMatch && funcMatch[1]) return funcMatch[1]; const methodMatch = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/); if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) return methodMatch[1]; return null; };


// --- Main Component ---
const AICodeAssistant = forwardRef<AICodeAssistantRef, AICodeAssistantProps>((props, ref) => {
    // --- Hooks ---
    const { user } = useAppContext();
    // Use hook with updated logic
    const {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues,
        setParsedFiles, setValidationStatus, setValidationIssues
    } = useCodeParsingAndValidation();

    // --- Context Access ---
    const {
        aiResponseInputRef, // Get ref from context
        setAiResponseHasContent,
        setFilesParsed,
        setSelectedAssistantFiles,
        setAssistantLoading,
        assistantLoading,
        aiActionLoading
    } = useRepoXmlPageContext();

    // --- State ---
    const [response, setResponse] = useState<string>(""); // Local state for textarea value
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
    const [prTitle, setPrTitle] = useState<string>("");
    const [openPRs, setOpenPRs] = useState<any[]>([]);
    const [loadingPRs, setLoadingPRs] = useState(false);
    const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'replace' | 'search'>('replace');
    const [isCreatingPr, setIsCreatingPr] = useState(false);
    const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
    const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);

    // --- Helper ---
    const extractPRTitleHint = (text: string): string => { /* .. (keep) */ const lines = text.split('\n'); const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update"; return firstLine.trim().substring(0, 70); };

    // --- Effects ---
    useEffect(() => {
        // .. (keep existing effect logic, ensures context flag syncs with local state)
        const hasContent = response.trim().length > 0; setAiResponseHasContent(hasContent); if (!hasContent) { setFilesParsed(false); setSelectedAssistantFiles(new Set()); setValidationStatus('idle'); setValidationIssues([]); setOriginalRepoFiles([]); } else { if (parsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing && !assistantLoading) { setValidationStatus('idle'); setValidationIssues([]); } }
    }, [response, parsedFiles.length, isParsing, assistantLoading, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

    useEffect(() => {
        // .. (keep custom link loading effect)
        const loadLinks = async () => { if (!user) { setCustomLinks([]); return; } try { const { data: userData, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single(); if (!error && userData?.metadata?.customLinks) setCustomLinks(userData.metadata.customLinks); else setCustomLinks([]); } catch (e) { console.error("Error loading links:", e); setCustomLinks([]); } }; loadLinks();
    }, [user]);

    const skippedCodeBlockIssues = validationIssues.filter(i => i.type === 'skippedCodeBlock');
    useEffect(() => {
        // .. (keep original file fetching effect)
        if (skippedCodeBlockIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) { const fetchOriginals = async () => { setIsFetchingOriginals(true); toast.info("Загрузка оригиналов..."); try { const result = await fetchRepoContents(repoUrl); if (result.success && Array.isArray(result.files)) { setOriginalRepoFiles(result.files); toast.success("Оригиналы загружены."); } else { toast.error("Ошибка загрузки оригиналов: " + (result.error ?? 'Unknown error')); setOriginalRepoFiles([]); } } catch (error) { toast.error("Крит. ошибка загрузки оригиналов."); setOriginalRepoFiles([]); } finally { setIsFetchingOriginals(false); } }; fetchOriginals(); }
    }, [skippedCodeBlockIssues.length, originalRepoFiles.length, isFetchingOriginals, repoUrl]); // Use 'skippedCodeBlockIssues' instead of 'skippedIssues'


    // --- Handlers ---

    const handleParse = useCallback(async () => {
        // .. (keep existing implementation)
        setOriginalRepoFiles([]); const { files: newlyParsedFiles, rawDescription: parsedRawDescription } = await parseAndValidateResponse(response); setFilesParsed(newlyParsedFiles.length > 0); const initialSelection = new Set(newlyParsedFiles.map(f => f.id)); setSelectedFileIds(initialSelection); setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path))); if (newlyParsedFiles.length > 0) { setPrTitle(extractPRTitleHint(parsedRawDescription || response)); } else { setPrTitle(''); }
    }, [response, parseAndValidateResponse, setFilesParsed, setSelectedAssistantFiles]);

    const handleAutoFix = useCallback(() => {
        // Pass current parsedFiles state to autoFix
        const updatedFiles = autoFixIssues(parsedFiles, validationIssues);
        // autoFixIssues now updates state internally via re-validation
        // setParsedFiles(updatedFiles); // No longer needed here
    }, [autoFixIssues, parsedFiles, validationIssues]);

    const handleCopyFixPrompt = useCallback(() => {
        // Find *actual* skipped comment issues now
        const skipped = validationIssues.filter(i => i.type === 'skippedComment');
        if (skipped.length === 0) return toast.info("Нет маркеров '// ...' для исправления.");
        const fl = skipped.map(i => `- ${i.filePath} (~${i.details?.lineNumber})`).join('\n');
        const p = `Пожалуйста, объедини новые версии файлов с моими текущими, восстановив пропущенные части (отмеченные как '// ...') в новых файлах, используя старые файлы из контекста ниже как референс:\n${fl}\n\nПредоставь полные новые версии без пропуска частей.`;
        navigator.clipboard.writeText(p).then(() => toast.success("Prompt скопирован!")).catch(() => toast.error("Ошибка копирования."));
    }, [validationIssues]);

    const handleRestorationComplete = useCallback((updatedFiles: FileEntry[], successCount: number, errorCount: number) => {
        // .. (keep existing implementation)
        setParsedFiles(updatedFiles); const remainingIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock'); setValidationIssues(remainingIssues); setValidationStatus(remainingIssues.length > 0 ? (remainingIssues.some(i=>!i.fixable && !i.restorable)? 'error':'warning') : 'success');
    }, [validationIssues, setParsedFiles, setValidationIssues, setValidationStatus]);

    // --- Text Area Utility Handlers ---
    const handleClearResponse = useCallback(() => { /* .. (keep) */ setResponse(""); toast.info("Поле ответа очищено."); }, []);
    const handleCopyResponse = useCallback(() => { /* .. (keep) */ if (!response) return; navigator.clipboard.writeText(response).then(()=>toast.success("Скопировано!")).catch(()=>{toast.error("Ошибка копирования")});}, [response]);
    const handleOpenModal = useCallback((mode: 'replace' | 'search') => { /* .. (keep) */ setModalMode(mode); setShowModal(true); }, []);

    // --- Swap/Search Handlers (Revised for clarity and reliability) ---
    const handleSwap = useCallback((find: string, replace: string) => {
        if (!find) return;
        const textarea = aiResponseInputRef.current;
        if (!textarea) return;
        try {
            const currentValue = textarea.value; // Get current value directly
            const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
            const regex = new RegExp(escapedFind, 'g');
            const newValue = currentValue.replace(regex, replace);

            if (newValue !== currentValue) {
                setResponse(newValue); // Update local state FIRST

                // Force update textarea value for immediate feedback
                // Need a slight delay for React state update to potentially propagate
                requestAnimationFrame(() => {
                     if (aiResponseInputRef.current) {
                        aiResponseInputRef.current.value = newValue;
                     }
                });

                // Reset downstream states because content changed significantly
                setParsedFiles([]);
                setFilesParsed(false);
                setSelectedFileIds(new Set());
                setSelectedAssistantFiles(new Set());
                setValidationStatus('idle');
                setValidationIssues([]);
                toast.success(`"${find}" заменен на "${replace}". Нажмите '➡️' для перепроверки.`);
            } else {
                toast.info(`"${find}" не найден.`);
            }
        } catch (e: any) {
             toast.error(`Ошибка замены: ${e.message}`);
             console.error("Swap Error:", e);
        }
    }, [aiResponseInputRef, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]); // Removed setResponse from dependencies, it's the target


    const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
        if (!searchText) { toast.warn("Введите текст для поиска."); return; }
        const textarea = aiResponseInputRef.current;
        if (!textarea) return;
        const text = textarea.value; // Get current value

        if (isMultiline) { // --- Magic Swap Logic ---
            const cleanedSearchText = searchText.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
            if (!cleanedSearchText) { toast.error("Вставленный текст пуст после очистки."); return; }
            const firstLine = cleanedSearchText.split('\n')[0];
            const functionName = extractFunctionName(firstLine);
            if (!functionName) { toast.error("Не удалось извлечь имя функции из вставленного текста."); return; }

            // Find the function declaration more reliably
            // Regex looks for function keywords or const/let assignments followed by the name and parens/arrow
            const functionRegex = new RegExp(`(^|\\n|\\s)(?:export\\s+|async\\s+)*?(?:function\\s+|class\\s+|const\\s+|let\\s+|var\\s+)${functionName}\\s*(?:\\(|[:=]|<)`, 'm');
            let match = functionRegex.exec(text);
            if (!match) {
                 // Try finding class methods like ` functionName(` or `async functionName(`
                const methodRegex = new RegExp(`(^|\\n|\\s)(?:async\\s+|get\\s+|set\\s+)*?${functionName}\\s*\\(`, 'm');
                match = methodRegex.exec(text);
            }

            if (!match) { toast.info(`Функция "${functionName}" не найдена в текущем коде.`); return; }
            const matchIndex = match.index + match[1].length; // Start index of the function keyword/name

            const [startPos, endPos] = selectFunctionDefinition(text, matchIndex);
            if (startPos === -1 || endPos === -1) { toast.error("Не удалось корректно выделить функцию для замены (проверьте скобки или комментарии)."); return; }

            const newValue = text.substring(0, startPos) + cleanedSearchText + text.substring(endPos);
            setResponse(newValue); // Update state

            // Force update textarea value & selection
            requestAnimationFrame(() => {
                 if (aiResponseInputRef.current) {
                    aiResponseInputRef.current.value = newValue;
                    aiResponseInputRef.current.focus();
                    aiResponseInputRef.current.setSelectionRange(startPos, startPos + cleanedSearchText.length);
                 }
            });

            // Reset downstream states
            setParsedFiles([]);
            setFilesParsed(false);
            setSelectedFileIds(new Set());
            setSelectedAssistantFiles(new Set());
            setValidationStatus('idle');
            setValidationIssues([]);
            toast.success(`Функция "${functionName}" заменена! ✨ Нажмите '➡️'.`);

        } else { // --- Single-line Search Logic ---
            const searchLower = searchText.toLowerCase();
            const textLower = text.toLowerCase();
            const cursorPos = textarea.selectionStart || 0; // Ensure cursor pos is a number
            let searchFrom = cursorPos;
            let index = textLower.indexOf(searchLower, searchFrom);

            if (index === -1) { // Wrap around search
                 index = textLower.indexOf(searchLower, 0);
                 if (index === -1 || index >= cursorPos) { // Not found or found only after/at cursor pos (no wrap needed)
                      toast.info(`"${searchText}" не найден.`);
                      textarea.focus();
                      return;
                 }
                 // Found before cursor, indicating wrap happened
                 toast.info("Поиск достиг начала документа.");
            }

            // Found the text
            textarea.focus();
            textarea.setSelectionRange(index, index + searchText.length);
            // Use a slightly more informative toast for search
            toast(`Найдено: "${searchText}"`, { // Removed success icon for search
                style: { background: "rgba(30, 64, 175, 0.9)", color:"#ffffff", border:"1px solid rgba(37, 99, 235, 0.3)", backdropFilter:"blur(3px)" },
                duration: 2000
            });
        }
    }, [aiResponseInputRef, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]); // Removed setResponse dependency


    const handleSelectFunction = useCallback(() => { /* .. (keep) */ const textarea = aiResponseInputRef.current; if (!textarea) return; const text = textarea.value; const cursorPos = textarea.selectionStart; let lineStartIndex = text.lastIndexOf('\n', cursorPos - 1) + 1; const [startPos, endPos] = selectFunctionDefinition(text, lineStartIndex); if (startPos !== -1 && endPos !== -1) { textarea.focus(); textarea.setSelectionRange(startPos, endPos); toast.success("Функция выделена!"); } else { let searchBackIndex = text.lastIndexOf('{', lineStartIndex); if(searchBackIndex > 0) { const [startPosBack, endPosBack] = selectFunctionDefinition(text, searchBackIndex); if (startPosBack !== -1 && endPosBack !== -1) { textarea.focus(); textarea.setSelectionRange(startPosBack, endPosBack); toast.success("Функция выделена (найдена выше)!"); return; } } toast.info("Не удалось выделить функцию. Убедитесь, что курсор в строке с объявлением или внутри функции."); textarea.focus(); } }, [aiResponseInputRef]);

    // --- File List & PR Handlers ---
    const handleToggleFileSelection = useCallback((fileId: string) => { /* .. (keep) */ setSelectedFileIds(prev => { const ns = new Set(prev); if (ns.has(fileId)) ns.delete(fileId); else ns.add(fileId); const sp = new Set( Array.from(ns).map(id => parsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[] ); setSelectedAssistantFiles(sp); return ns; }); }, [parsedFiles, setSelectedAssistantFiles]);
    const handleSelectAllFiles = useCallback(() => { /* .. (keep) */ const allIds = new Set(parsedFiles.map(f => f.id)); const allPaths = new Set(parsedFiles.map(f => f.path)); setSelectedFileIds(allIds); setSelectedAssistantFiles(allPaths); if (allIds.size > 0) toast.info(`${allIds.size} файлов выбрано.`); }, [parsedFiles, setSelectedAssistantFiles]);
    const handleDeselectAllFiles = useCallback(() => { /* .. (keep) */ setSelectedFileIds(new Set()); setSelectedAssistantFiles(new Set()); toast.info("Выделение снято."); }, [setSelectedAssistantFiles]);
    const handleSaveFiles = useCallback(async () => { /* .. (keep) */ if (!user) return; const fts = parsedFiles.filter(f => selectedFileIds.has(f.id)); if (fts.length === 0) return; setIsCreatingPr(true); try { const fd=fts.map(f=>({p:f.path,c:f.content,e:f.extension})); const {data:ed,error:fe}=await supabaseAdmin.from("users").select("metadata").eq("user_id",user.id).single(); if(fe&&fe.code!=='PGRST116') throw fe; const ef=ed?.metadata?.generated_files||[]; const np=new Set(fd.map(f=>f.p)); const mf=[...ef.filter((f:any)=>!np.has(f.path)),...fd.map(f=>({path:f.p, code:f.c, extension:f.e}))]; const{error:ue}=await supabaseAdmin.from("users").upsert({user_id:user.id,metadata:{...(ed?.metadata||{}),generated_files:mf}},{onConflict:'user_id'}); if(ue) throw ue; toast.success(`${fts.length} файлов сохранено!`); } catch(err){ toast.error("Ошибка сохранения."); console.error(err); } finally { setIsCreatingPr(false); }}, [user, parsedFiles, selectedFileIds]);
    const handleDownloadZip = useCallback(async () => { /* .. (keep) */ const ftz = parsedFiles.filter(f => selectedFileIds.has(f.id)); if (ftz.length === 0) return; setIsCreatingPr(true); try { const JSZip = (await import("jszip")).default; const zip = new JSZip(); ftz.forEach((f) => zip.file(f.path, f.content)); const blob = await zip.generateAsync({type:"blob"}); saveAs(blob, `ai_files_${Date.now()}.zip`); toast.success("Архив скачан."); } catch (error) { toast.error("Ошибка ZIP."); console.error(error); } finally { setIsCreatingPr(false); }}, [parsedFiles, selectedFileIds]);
    const handleSendToTelegram = useCallback(async (file: FileEntry) => { /* .. (keep) */ if (!user?.id) return; setIsCreatingPr(true); try { const r=await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop()||"file"); if (!r.success) throw new Error(r.error??"TG Error"); toast.success(`"${file.path}" отправлен.`); } catch (err) { toast.error(`Ошибка отправки.`); console.error(err); } finally { setIsCreatingPr(false); }}, [user]);
    const handleGetOpenPRs = useCallback(async () => { /* .. (keep) */ if (!repoUrl) return; setLoadingPRs(true); try { const r=await getOpenPullRequests(repoUrl); if (r.success && r.pullRequests){ setOpenPRs(r.pullRequests); toast.success(`${r.pullRequests.length} PR загружено.`);} else toast.error("Ошибка PR: "+r.error); } catch (err){ toast.error("Крит. ошибка PR."); } finally { setLoadingPRs(false); }}, [repoUrl]);
    const handleCreatePR = useCallback(async () => { /* .. (keep) */ const selectedFilesLocal = parsedFiles.filter(f => selectedFileIds.has(f.id)); if (!repoUrl || selectedFilesLocal.length === 0 || !prTitle) { return toast.error("Укажите URL, Заголовок PR и выберите файлы."); } let finalDescription = rawDescription.substring(0, 13000) + (rawDescription.length > 13000 ? "\n\n...(описание усечено)" : ""); finalDescription += `\n\n**Файлы в этом PR (${selectedFilesLocal.length}):**\n` + selectedFilesLocal.map(f => `- \`${f.path}\``).join('\n'); const unselectedUnnamed = parsedFiles.filter(f => f.path.startsWith('unnamed-') && !selectedFileIds.has(f.id)); if (unselectedUnnamed.length > 0) finalDescription += `\n\n**Примечание:** ${unselectedUnnamed.length} блоков кода без имени файла не были включены.`; const remainingIssues = validationIssues; if (remainingIssues.length > 0) { finalDescription += "\n\n**Обнаруженные Проблемы (не исправлено / не восстановлено):**\n"; remainingIssues.forEach(issue => { finalDescription += `- **${issue.filePath}**: ${issue.message}\n`; }); } const commitSubject = prTitle.substring(0, 50); let commitBody = `Apply AI changes to ${selectedFilesLocal.length} files.\n\n${rawDescription.split('\n').slice(0,10).join('\n').substring(0, 1000)}...`; const finalCommitMessage = `${commitSubject}\n\n${commitBody}`; setAssistantLoading(true); setIsCreatingPr(true); try { const filesToCommit = selectedFilesLocal.map(f => ({ path: f.path, content: f.content })); const result = await createGitHubPullRequest( repoUrl, filesToCommit, prTitle, finalDescription, finalCommitMessage ); if (result.success && result.prUrl) { toast.success(`PR создан: ${result.prUrl}`); await notifyAdmin(`Новый PR "${prTitle}" создан ${user?.username || user?.id}: ${result.prUrl}`); handleGetOpenPRs(); } else { toast.error("Ошибка создания PR: " + result.error); console.error("PR Creation Failed:", result.error); } } catch (err) { toast.error("Критическая ошибка создания PR."); console.error("Create PR error:", err); } finally { setAssistantLoading(false); setIsCreatingPr(false); } }, [parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, user, setAssistantLoading, handleGetOpenPRs]);
    const handleAddCustomLink = useCallback(async () => { /* .. (keep) */ const n=prompt("Назв:"); const u=prompt("URL (https://..):"); if (!n||!u||!u.startsWith('http')) return; const nl={name: n, url: u}; const ul=[...customLinks,nl]; setCustomLinks(ul); if(user){try{const{data:ed}=await supabaseAdmin.from("users").select("metadata").eq("user_id",user.id).single(); await supabaseAdmin.from("users").upsert({user_id:user.id,metadata:{...(ed?.metadata||{}),customLinks:ul}},{onConflict:'user_id'}); toast.success(`Ссылка "${n}" добавлена.`);}catch(e){toast.error("Ошибка сохр.");setCustomLinks(customLinks);}} }, [customLinks, user]);

    const setResponseValue = useCallback((value: string) => {
        // .. (keep existing implementation)
        setResponse(value); if (aiResponseInputRef.current) { aiResponseInputRef.current.value = value; const event = new Event('input', { bubbles: true }); aiResponseInputRef.current.dispatchEvent(event); }
    }, [aiResponseInputRef]);


    useImperativeHandle(ref, () => ({
        // .. (keep existing exposed methods)
        handleParse, selectAllParsedFiles: handleSelectAllFiles, handleCreatePR, setResponseValue,
     }), [handleParse, handleSelectAllFiles, handleCreatePR, setResponseValue]);


    // --- RENDER ---
    const isProcessing = assistantLoading || aiActionLoading || isParsing || isCreatingPr;

    return (
        <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
            {/* Header */}
             <header className="flex items-center gap-2">
                 <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">AI Code Assistant</h1>
                 <Tooltip text={`Вставьте ответ AI ИЛИ используйте кнопку 'Спросить AI' в Экстракторе. Затем '➡️' → Проверьте/Исправьте → Выберите файлы → Создать PR`} position="left">
                     <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
                 </Tooltip>
             </header>

            {/* AI Response Input Area */}
             <div>
                 <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 2️⃣ Ответ от AI появится здесь (или вставьте вручную). Затем нажмите '➡️'. </p>
                 <div className="relative group">
                     <textarea
                         id="response-input"
                         ref={aiResponseInputRef}
                         className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
                         value={response} // Controlled by local state
                         onChange={(e) => setResponse(e.target.value)}
                         placeholder="Ответ от AI появится здесь..."
                         disabled={isProcessing}
                         spellCheck="false"
                     />
                     <TextAreaUtilities
                         response={response}
                         isLoading={isProcessing}
                         onParse={handleParse}
                         onOpenModal={handleOpenModal}
                         onCopy={handleCopyResponse}
                         onClear={handleClearResponse}
                         onSelectFunction={handleSelectFunction}
                     />
                 </div>
                 {/* Validation Status and Actions */}
                 <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
                      {/* CodeRestorer: Use filtered issues */}
                      <CodeRestorer
                         parsedFiles={parsedFiles}
                         originalFiles={originalRepoFiles}
                         skippedIssues={skippedCodeBlockIssues} // Pass only relevant issues
                         onRestorationComplete={handleRestorationComplete}
                         disabled={isProcessing || validationStatus === 'validating' || isFetchingOriginals}
                      />
                      <ValidationStatusIndicator
                          status={validationStatus}
                          issues={validationIssues} // Pass all issues for logic inside
                          onAutoFix={handleAutoFix}
                          onCopyPrompt={handleCopyFixPrompt}
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
                 isLoading={isProcessing}
             />

             {/* PR Form */}
             <PullRequestForm
                 repoUrl={repoUrl}
                 prTitle={prTitle}
                 selectedFileCount={selectedFileIds.size}
                 isLoading={isCreatingPr || assistantLoading}
                 isLoadingPrList={loadingPRs}
                 onRepoUrlChange={setRepoUrl}
                 onPrTitleChange={setPrTitle}
                 onCreatePR={handleCreatePR}
                 onGetOpenPRs={handleGetOpenPRs}
             />

             {/* Open PR List */}
             <OpenPrList openPRs={openPRs} />

             {/* Tools Menu */}
             <ToolsMenu customLinks={customLinks} onAddCustomLink={handleAddCustomLink} />

             {/* Modals */}
             <AnimatePresence>
                 {showModal && (
                     <SwapModal
                         isOpen={showModal}
                         onClose={() => setShowModal(false)}
                         onSwap={handleSwap}
                         onSearch={handleSearch}
                         initialMode={modalMode}
                     />
                 )}
             </AnimatePresence>
        </div>
      );
});

AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;