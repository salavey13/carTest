"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject, useCallback } from "react";
// Action Imports
import { createGitHubPullRequest, getOpenPullRequests, fetchRepoContents } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
// Hook Imports
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";
import { useCodeParsingAndValidation, ValidationIssue, FileEntry as ValidationFileEntry } from "@/hooks/useCodeParsingAndValidation";
// Child Component Imports
import { TextAreaUtilities } from './assistant_components/TextAreaUtilities';
import { ValidationStatusIndicator } from './assistant_components/ValidationStatus';
import { ParsedFilesList } from './assistant_components/ParsedFilesList';
import { PullRequestForm } from './assistant_components/PullRequestForm';
import { OpenPrList } from './assistant_components/OpenPrList';
import { ToolsMenu } from './assistant_components/ToolsMenu';
import { SwapModal } from './assistant_components/SwapModal';
import { CodeRestorer } from './assistant_components/CodeRestorer';
// Library Imports
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircleInfo } from "react-icons/fa6";
import clsx from "clsx";
import { saveAs } from "file-saver";

// --- Tooltip Component ---
export const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-1',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-1',
  };
  return (
    <div className="relative inline-block group">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>{children}</div>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={clsx("absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded-lg shadow-lg w-max max-w-xs whitespace-pre-line", positionClasses[position])}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
Tooltip.displayName = 'Tooltip';

// --- Interfaces ---
interface FileEntry extends ValidationFileEntry {}
interface AICodeAssistantProps {
  aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
}
interface OriginalFile {
  path: string;
  content: string;
}

// --- Main Component ---
const AICodeAssistant = forwardRef<any, AICodeAssistantProps>(({ aiResponseInputRef }, ref) => {
  // --- Hooks ---
  const { user } = useAppContext();
  const repoContext = useRepoXmlPageContext();
  const {
    parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
    parseAndValidateResponse, autoFixIssues,
    setParsedFiles, setValidationStatus, setValidationIssues
  } = useCodeParsingAndValidation();

  // --- Context Access ---
  const {
    setAiResponseHasContent = () => {}, setFilesParsed = () => {}, setSelectedAssistantFiles = () => {},
    setAssistantLoading = () => {}, assistantLoading = false
  } = repoContext ?? {};

  // --- State ---
  const [response, setResponse] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapModalMode, setSwapModalMode] = useState<'replace' | 'search'>('replace');
  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [originalRepoFiles, setOriginalRepoFiles] = useState<OriginalFile[]>([]);
  const [isFetchingOriginals, setIsFetchingOriginals] = useState(false);

  // --- Helper ---
  const extractPRTitleHint = (text: string): string => {
    const lines = text.split('\n');
    const firstLine = lines.find(l => l.trim() !== '') || "AI Assistant Update";
    return firstLine.trim().substring(0, 70);
  };

  // --- Effects ---
  useEffect(() => {
    const hasContent = response.trim().length > 0;
    setAiResponseHasContent(hasContent);
    if (!hasContent) {
      setFilesParsed(false);
      setSelectedAssistantFiles(new Set());
      setValidationStatus('idle');
      setValidationIssues([]);
      setOriginalRepoFiles([]);
    } else {
      if (parsedFiles.length === 0 && validationStatus !== 'idle' && !isParsing) {
        setValidationStatus('idle');
        setValidationIssues([]);
      }
    }
  }, [response, parsedFiles.length, isParsing, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

  useEffect(() => {
    const loadLinks = async () => {
      if (!user) {
        setCustomLinks([]);
        return;
      }
      try {
        const { data: userData, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
        if (!error && userData?.metadata?.customLinks) setCustomLinks(userData.metadata.customLinks);
        else setCustomLinks([]);
      } catch (e) {
        console.error("Error loading links:", e);
        setCustomLinks([]);
      }
    };
    loadLinks();
  }, [user]);

  const skippedIssues = validationIssues.filter(i => i.type === 'skippedCodeBlock');
  useEffect(() => {
    if (skippedIssues.length > 0 && originalRepoFiles.length === 0 && !isFetchingOriginals && repoUrl) {
      const fetchOriginals = async () => {
        setIsFetchingOriginals(true);
        toast.info("Загрузка оригиналов...");
        try {
          const result = await fetchRepoContents(repoUrl);
          if (result.success && Array.isArray(result.files)) {
            setOriginalRepoFiles(result.files);
            toast.success("Оригиналы загружены.");
          } else {
            toast.error("Ошибка загрузки оригиналов: " + result.error);
            setOriginalRepoFiles([]);
          }
        } catch (error) {
          toast.error("Крит. ошибка загрузки оригиналов.");
          setOriginalRepoFiles([]);
        } finally {
          setIsFetchingOriginals(false);
        }
      };
      fetchOriginals();
    }
  }, [skippedIssues.length, originalRepoFiles.length, isFetchingOriginals, repoUrl]);

  // --- Handlers ---

  // Parse & Validate Handler
  const handleParse = useCallback(async () => {
    setAssistantLoading(true);
    setOriginalRepoFiles([]);
    const { files: newlyParsedFiles } = await parseAndValidateResponse(response);
    setAssistantLoading(false);
    setFilesParsed(newlyParsedFiles.length > 0);
    const initialSelection = new Set(newlyParsedFiles.map(f => f.id));
    setSelectedFileIds(initialSelection);
    setSelectedAssistantFiles(new Set(newlyParsedFiles.map(f => f.path)));
    if (newlyParsedFiles.length > 0) setPrTitle(extractPRTitleHint(rawDescription || response));
    else setPrTitle('');
  }, [response, rawDescription, parseAndValidateResponse, setAssistantLoading, setFilesParsed, setSelectedAssistantFiles]);

  // Auto-Fix Handler
  const handleAutoFix = useCallback(() => {
    autoFixIssues(parsedFiles, validationIssues);
  }, [autoFixIssues, parsedFiles, validationIssues]);

  // Copy Fix Prompt Handler
  const handleCopyFixPrompt = useCallback(() => {
    const skipped = validationIssues.filter(i => i.type === 'skippedComment');
    if (skipped.length === 0) return toast.info("Нет маркеров '// ...'.");
    const fl = skipped.map(i => `- ${i.filePath} (~${i.details?.lineNumber})`).join('\n');
    const p = `Полный код для '// ...' в:\n${fl}\n\nВерни полные блоки.`;
    navigator.clipboard.writeText(p).then(() => toast.success("Prompt скопирован!")).catch(() => toast.error("Ошибка копирования."));
  }, [validationIssues]);

  // Restore Skipped Code Handler
  const handleRestorationComplete = useCallback((updatedFiles: FileEntry[], successCount: number, errorCount: number) => {
    setParsedFiles(updatedFiles);
    const remainingIssues = validationIssues.filter(i => i.type !== 'skippedCodeBlock');
    setValidationIssues(remainingIssues);
    setValidationStatus(remainingIssues.length > 0 ? (remainingIssues.some(i => !i.fixable && !i.restorable) ? 'error' : 'warning') : 'success');
  }, [validationIssues, setParsedFiles, setValidationIssues, setValidationStatus]);

  // Text Area Utility Handlers
  const handleClearResponse = useCallback(() => {
    setResponse("");
    toast.info("Поле ответа очищено.");
  }, []);

  const handleCopyResponse = useCallback(() => {
    if (!response) return;
    navigator.clipboard.writeText(response)
      .then(() => toast.success("Скопировано!"))
      .catch(() => toast.error("Ошибка копирования"));
  }, [response]);

  const handleOpenModal = useCallback((mode: 'replace' | 'search') => {
    setSwapModalMode(mode);
    setShowSwapModal(true);
  }, []);

  const handleSwap = useCallback((find: string, replace: string) => {
    if (!find) return;
    try {
      const newResponse = response.replaceAll(find, replace);
      if (newResponse !== response) {
        setResponse(newResponse);
        setParsedFiles([]);
        setFilesParsed(false);
        setSelectedFileIds(new Set());
        setSelectedAssistantFiles(new Set());
        setValidationStatus('idle');
        setValidationIssues([]);
        toast.success(`Текст заменен. Нажмите '➡️'.`);
      } else {
        toast.info(`"${find}" не найден.`);
      }
    } catch (e) {
      toast.error("Ошибка замены.");
    }
  }, [response, setParsedFiles, setFilesParsed, setSelectedAssistantFiles, setValidationStatus, setValidationIssues]);

  const handleSearch = useCallback((searchText: string, isMultiline: boolean) => {
    if (!searchText) {
        toast.warn("Пожалуйста, введите текст для поиска.");
        return;
    }
    const textarea = aiResponseInputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    if (isMultiline) {
        // Trim spaces and remove empty lines from search text
        const cleanedSearchText = searchText
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join('\n');
        const firstLine = cleanedSearchText.split('\n')[0];
        const functionName = extractFunctionName(firstLine);
        if (!functionName) {
            toast.error("Не удалось извлечь имя функции.");
            return;
        }

        // Search from cursor position, wrapping around
        const searchTextFromCursor = text.slice(cursorPos) + text.slice(0, cursorPos);
        const functionRegex = new RegExp(`\\bfunction\\s+${functionName}\\b|\\bconst\\s+${functionName}\\s+=`, 'g');
        const match = functionRegex.exec(searchTextFromCursor);
        if (!match) {
            toast.info(`Функция "${functionName}" не найдена.`);
            return;
        }

        // Adjust match index to original text
        const matchIndex = (match.index + cursorPos) % text.length;
        textarea.setSelectionRange(matchIndex, matchIndex);
        textarea.focus();

        // Select the entire function
        handleMagicSelect();

        // Swap the selected function
        const selectedStart = textarea.selectionStart;
        const selectedEnd = textarea.selectionEnd;
        if (selectedStart !== selectedEnd) {
            const newValue = text.substring(0, selectedStart) + cleanedSearchText + text.substring(selectedEnd);
            textarea.value = newValue;
            textarea.setSelectionRange(selectedStart, selectedStart + cleanedSearchText.length);
            toast.success(`Функция "${functionName}" успешно заменена! 🎉 Поздравляем, вы нашли пасхальное яйцо! 🥚`);
        } else {
            toast.error("Не удалось выделить функцию для замены.");
        }
    } else {
        // Single-line search from cursor position
        const searchLower = searchText.toLowerCase();
        const textFromCursor = text.slice(cursorPos).toLowerCase() + text.slice(0, cursorPos).toLowerCase();
        const index = textFromCursor.indexOf(searchLower);
        if (index !== -1) {
            const actualIndex = (index + cursorPos) % text.length;
            textarea.setSelectionRange(actualIndex, actualIndex + searchText.length);
            textarea.focus();
            toast.success(`Найдено "${searchText}".`);
        } else {
            toast.info("Текст не найден.");
        }
    }
}, [aiResponseInputRef]);

const handleMagicSelect = useCallback(() => {
    const textarea = aiResponseInputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    const lines = text.split('\n');
    let charCount = 0;
    let currentLineIndex = -1;

    // Find the current line based on cursor position
    for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1;
        if (charCount > cursorPos) {
            currentLineIndex = i;
            break;
        }
    }

    if (currentLineIndex === -1) {
        toast.info("Не удалось определить текущую строку.");
        return;
    }

    // Find the nearest previous line ending with '{'
    let functionStartLine = -1;
    for (let i = currentLineIndex; i >= 0; i--) {
        if (lines[i].trim().endsWith('{')) {
            functionStartLine = i;
            break;
        }
    }

    if (functionStartLine === -1) {
        toast.info("Не найдена строка, заканчивающаяся на '{'.");
        return;
    }

    // Calculate the start position (beginning of the function's first line)
    const functionStartPos = lines.slice(0, functionStartLine).reduce((acc, line) => acc + line.length + 1, 0);

    // Find the matching closing '}' by tracking depth
    let depth = 1;
    let closingLineIndex = functionStartLine;
    while (closingLineIndex < lines.length && depth > 0) {
        closingLineIndex++;
        const line = lines[closingLineIndex] || '';
        for (const char of line) {
            if (char === '{') depth++;
            if (char === '}') depth--;
            if (depth === 0) break;
        }
    }

    if (depth === 0) {
        const functionEndPos = lines.slice(0, closingLineIndex + 1).reduce((acc, line) => acc + line.length + 1, 0) - 1;
        textarea.setSelectionRange(functionStartPos, functionEndPos);
        textarea.focus();
    } else {
        toast.info("Соответствующая закрывающая скобка не найдена.");
    }
}, [aiResponseInputRef]);

const extractFunctionName = (line: string): string | null => {
    const tokens = line.split(/[\s:]+/);
    const skipWords = ['export', 'const', 'function'];
    for (let i = 0; i < tokens.length; i++) {
        if (!skipWords.includes(tokens[i]) && tokens[i] && /[a-zA-Z]/.test(tokens[i])) {
            return tokens[i].replace(/\W/g, '');
        }
    }
    return null;
};

  // File List Handlers
  const handleToggleFileSelection = useCallback((fileId: string) => {
    setSelectedFileIds(prev => {
      const ns = new Set(prev);
      if (ns.has(fileId)) ns.delete(fileId);
      else ns.add(fileId);
      const sp = new Set(Array.from(ns).map(id => parsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[]);
      setSelectedAssistantFiles(sp);
      return ns;
    });
  }, [parsedFiles, setSelectedAssistantFiles]);

  const handleSelectAllFiles = useCallback(() => {
    const allIds = new Set(parsedFiles.map(f => f.id));
    const allPaths = new Set(parsedFiles.map(f => f.path));
    setSelectedFileIds(allIds);
    setSelectedAssistantFiles(allPaths);
    if (allIds.size > 0) toast.info(`${allIds.size} файлов выбрано.`);
  }, [parsedFiles, setSelectedAssistantFiles]);

  const handleDeselectAllFiles = useCallback(() => {
    setSelectedFileIds(new Set());
    setSelectedAssistantFiles(new Set());
    toast.info("Выделение снято.");
  }, [setSelectedAssistantFiles]);

  // Save/Download/Telegram Handlers
  const handleSaveFiles = useCallback(async () => {
    if (!user) return;
    const fts = parsedFiles.filter(f => selectedFileIds.has(f.id));
    if (fts.length === 0) return;
    setIsCreatingPr(true);
    try {
      const fd = fts.map(f => ({ p: f.path, c: f.content, e: f.extension }));
      const { data: ed, error: fe } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
      if (fe && fe.code !== 'PGRST116') throw fe;
      const ef = ed?.metadata?.generated_files || [];
      const np = new Set(fd.map(f => f.p));
      const mf = [...ef.filter((f: any) => !np.has(f.path)), ...fd.map(f => ({ path: f.p, code: f.c, extension: f.e }))];
      const { error: ue } = await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(ed?.metadata || {}), generated_files: mf } }, { onConflict: 'user_id' });
      if (ue) throw ue;
      toast.success(`${fts.length} файлов сохранено!`);
    } catch (err) {
      toast.error("Ошибка сохранения.");
      console.error(err);
    } finally {
      setIsCreatingPr(false);
    }
  }, [user, parsedFiles, selectedFileIds]);

  const handleDownloadZip = useCallback(async () => {
    const ftz = parsedFiles.filter(f => selectedFileIds.has(f.id));
    if (ftz.length === 0) return;
    setIsCreatingPr(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      ftz.forEach((f) => zip.file(f.path, f.content));
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `ai_files_${Date.now()}.zip`);
      toast.success("Архив скачан.");
    } catch (error) {
      toast.error("Ошибка ZIP.");
      console.error(error);
    } finally {
      setIsCreatingPr(false);
    }
  }, [parsedFiles, selectedFileIds]);

  const handleSendToTelegram = useCallback(async (file: FileEntry) => {
    if (!user?.id) return;
    setIsCreatingPr(true);
    try {
      const r = await sendTelegramDocument(String(user.id), file.content, file.path.split("/").pop() || "file");
      if (!r.success) throw new Error(r.error ?? "TG Error");
      toast.success(`"${file.path}" отправлен.`);
    } catch (err) {
      toast.error(`Ошибка отправки.`);
      console.error(err);
    } finally {
      setIsCreatingPr(false);
    }
  }, [user]);

  // PR Handlers
  const handleGetOpenPRs = useCallback(async () => {
    if (!repoUrl) return;
    setLoadingPRs(true);
    try {
      const r = await getOpenPullRequests(repoUrl);
      if (r.success && r.pullRequests) {
        setOpenPRs(r.pullRequests);
        toast.success(`${r.pullRequests.length} PR загружено.`);
      } else toast.error("Ошибка PR: " + r.error);
    } catch (err) {
      toast.error("Крит. ошибка PR.");
    } finally {
      setLoadingPRs(false);
    }
  }, [repoUrl]);

  const handleCreatePR = useCallback(async () => {
    const selectedFiles = parsedFiles.filter(f => selectedFileIds.has(f.id));
    if (!repoUrl || selectedFiles.length === 0 || !prTitle) {
      return toast.error("Укажите URL, Заголовок PR и выберите файлы.");
    }
    if (!repoContext) return;

    let finalDescription = rawDescription.substring(0, 13000) + (rawDescription.length > 13000 ? "\n\n...(описание усечено)" : "");
    finalDescription += `\n\n**Файлы в этом PR (${selectedFiles.length}):**\n` + selectedFiles.map(f => `- \`${f.path}\``).join('\n');
    const unselectedUnnamed = parsedFiles.filter(f => f.path.startsWith('unnamed-') && !selectedFileIds.has(f.id));
    if (unselectedUnnamed.length > 0) finalDescription += `\n\n**Примечание:** ${unselectedUnnamed.length} блоков кода без имени файла не были включены.`;
    const remainingIssues = validationIssues;
    if (remainingIssues.length > 0) {
      finalDescription += "\n\n**Обнаруженные Проблемы (не исправлено / не восстановлено):**\n";
      remainingIssues.forEach(issue => {
        finalDescription += `- **${issue.filePath}**: ${issue.message}\n`;
      });
    }
    const commitSubject = prTitle.substring(0, 50);
    let commitBody = `Apply AI changes to ${selectedFiles.length} files.\n\n${rawDescription.split('\n').slice(0, 10).join('\n').substring(0, 1000)}...`;
    const finalCommitMessage = `${commitSubject}\n\n${commitBody}`;

    setAssistantLoading(true);
    setIsCreatingPr(true);
    try {
      const filesToCommit = selectedFiles.map(f => ({ path: f.path, content: f.content }));
      const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, finalDescription, finalCommitMessage);
      if (result.success && result.prUrl) {
        toast.success(`PR создан: ${result.prUrl}`);
        await notifyAdmin(`Новый PR "${prTitle}" создан ${user?.username || user?.id}: ${result.prUrl}`);
        handleGetOpenPRs();
      } else {
        toast.error("Ошибка создания PR: " + result.error);
        console.error("PR Creation Failed:", result.error);
      }
    } catch (err) {
      toast.error("Критическая ошибка создания PR.");
      console.error("Create PR error:", err);
    } finally {
      setAssistantLoading(false);
      setIsCreatingPr(false);
    }
  }, [repoContext, parsedFiles, selectedFileIds, repoUrl, prTitle, rawDescription, validationIssues, user, setAssistantLoading, handleGetOpenPRs]);

  // Tools Menu Handler
  const handleAddCustomLink = useCallback(async () => {
    const n = prompt("Назв:");
    const u = prompt("URL (https://..):");
    if (!n || !u || !u.startsWith('http')) return;
    const nl = { name: n, url: u };
    const ul = [...customLinks, nl];
    setCustomLinks(ul);
    if (user) {
      try {
        const { data: ed } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
        await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...(ed?.metadata || {}), customLinks: ul } }, { onConflict: 'user_id' });
        toast.success(`Ссылка "${n}" добавлена.`);
      } catch (e) {
        toast.error("Ошибка сохр.");
        setCustomLinks(customLinks);
      }
    }
  }, [customLinks, user]);

  // --- Expose methods via ref ---
  useImperativeHandle(ref, () => ({
    handleParse,
    selectAllParsedFiles: handleSelectAllFiles,
    handleCreatePR,
  }));

  // --- RENDER ---
  return (
    <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden flex flex-col gap-4">
      {/* Header */}
      <header className="flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">AI Code Assistant</h1>
        <Tooltip text={`Вставьте ответ AI → '➡️' → Проверьте/Исправьте → Выберите файлы → Создать PR`} position="left">
          <FaCircleInfo className="text-blue-400 cursor-help hover:text-blue-300 transition" />
        </Tooltip>
      </header>

      {/* AI Response Input Area */}
      <div>
        <p className="text-yellow-400 mb-2 text-xs md:text-sm">2️⃣ Вставьте сюда ПОЛНЫЙ ОТВЕТ от вашего AI. Затем нажмите '➡️'.</p>
        <div className="relative group">
          <textarea
            id="response-input"
            ref={aiResponseInputRef}
            className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Вставьте ПОЛНЫЙ ОТВЕТ от AI здесь..."
            disabled={isParsing || isCreatingPr || assistantLoading}
          />
          <TextAreaUtilities
            response={response}
            isLoading={isParsing || isCreatingPr || assistantLoading}
            onParse={handleParse}
            onOpenModal={handleOpenModal}
            onCopy={handleCopyResponse}
            onClear={handleClearResponse}
          />
        </div>
        {/* Validation Status and Actions */}
        <div className="flex justify-end items-start mt-1 gap-2 min-h-[30px]">
          <CodeRestorer
            parsedFiles={parsedFiles}
            originalFiles={originalRepoFiles}
            skippedIssues={validationIssues.filter(i => i.type === 'skippedCodeBlock')}
            onRestorationComplete={handleRestorationComplete}
            disabled={isParsing || isCreatingPr || assistantLoading || validationStatus === 'validating' || isFetchingOriginals}
          />
          <ValidationStatusIndicator
            status={validationStatus}
            issues={validationIssues}
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
        isLoading={isParsing || isCreatingPr || assistantLoading}
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
        {showSwapModal && (
          <SwapModal
            isOpen={showSwapModal}
            onClose={() => setShowSwapModal(false)}
            onSwap={handleSwap}
            onSearch={handleSearch}
            initialMode={swapModalMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;