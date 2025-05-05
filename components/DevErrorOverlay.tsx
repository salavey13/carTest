"use client";

import React, { useEffect, useState } from 'react';
// Import context hook and types
import { useErrorOverlay, ErrorInfo, ToastRecord, ErrorSourceType } from '@/contexts/ErrorOverlayContext';
import {
    FaCopy, FaTriangleExclamation, FaGithub, FaRegClock, FaCircleInfo, FaCircleCheck,
    FaCircleXmark, FaBug, FaFileLines, FaTerminal, FaArrowUpRightFromSquare
} from 'react-icons/fa6';
import { toast as sonnerToast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
// Import logger and LogLevel/LogRecord types directly
import { debugLogger as logger, LogLevel, LogRecord } from '@/lib/debugLogger';

// --- i18n Translations (Full - Unchanged from previous) ---
const translations = {
  ru: {
    overlayCrashedTitle: "🚧 DevErrorOverlay СЛОМАЛСЯ! 🚧",
    overlayCrashedMessage: "Не удалось отрендерить сам оверлей ошибки.",
    overlayCrashedRenderError: "Ошибка рендера",
    overlayCrashedOriginalError: "Оригинальная ошибка (в консоли)",
    overlayCrashedNoMessage: "Нет сообщения",
    overlayCrashedAdvice: "Проверь консоль и компонент DevErrorOverlay.",
    reloadButton: "Перезагрузить",
    fatalContextError: "КРИТИЧЕСКАЯ ОШИБКА: Не удалось получить ErrorOverlayContext! Проверь консоль.",
    systemFailureTitle: "Сбой системы...",
    unknownError: "Неизвестная ошибка",
    sourceLabel: "Источник",
    lineLabel: "строка",
    columnLabel: "столбец",
    stackTraceLabel: "Технические артефакты (Stack Trace - начало)",
    stackTraceEmpty: "Стек вызовов пуст или недоступен.",
    stackTraceUnavailable: "Стек недоступен (вероятно, ошибка CORS или в стороннем скрипте).",
    stackTraceError: "Ошибка получения стека",
    adviceTitle: "🤖 Матрица сбоит... но это не конец!",
    adviceLine1: "Помоги нам отладить реальность:",
    adviceCopyAction: "Скопируй",
    adviceCopyLink: "Vibe Запрос",
    adviceCopyDestination: "и закинь в CyberVibe Studio",
    adviceGithubAction: "Или",
    adviceGithubLink: "создай Issue на GitHub",
    adviceGithubPrepared: "(данные подготовлены).",
    copySuccessToast: "Vibe Запрос для фикса скопирован!",
    copyErrorToast: "Не удалось скопировать запрос.",
    copyDataErrorToast: "Не удалось подготовить данные",
    copyGenericError: "Ошибка копирования",
    closeButton: "Закрыть",
    recentToastsTitle: "Недавние Уведомления (Тосты)",
    noRecentToasts: "Нет недавних уведомлений.",
    recentLogsTitle: "Последние События (Логи)",
    noRecentLogs: "Нет недавних событий.",
  },
};
const t = translations.ru;

// --- Fallback Component ---
const ErrorOverlayFallback: React.FC<{ message: string, renderErrorMessage?: string }> = ({ message, renderErrorMessage }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/95 p-4 text-white font-mono">
        <div className="text-center bg-black/30 p-6 rounded-lg border border-red-500 max-w-lg">
            <h2 className="text-2xl font-bold mb-2 text-yellow-300">{t.overlayCrashedTitle}</h2>
            <p className="text-lg mb-4">{t.overlayCrashedMessage}</p>
            {renderErrorMessage && (
                 <p className="text-sm bg-yellow-900/50 p-2 rounded mb-2 overflow-auto max-h-20">
                    <strong className="text-yellow-200">{t.overlayCrashedRenderError}:</strong> {renderErrorMessage}
                 </p>
            )}
            <p className="text-sm bg-black/30 p-2 rounded overflow-auto max-h-20">
                <strong className="text-gray-300">{t.overlayCrashedOriginalError}:</strong> {message || t.overlayCrashedNoMessage}
            </p>
            <p className="mt-4 text-xs text-gray-300">{t.overlayCrashedAdvice}</p>
            <button
                onClick={() => { console.log("Reloading page..."); window.location.reload(); }}
                className="mt-4 px-4 py-2 bg-white text-black rounded font-semibold hover:bg-gray-200 transition"
            >
                {t.reloadButton}
            </button>
        </div>
    </div>
);

// --- Icon Helpers ---
const getLevelIcon = (level: LogLevel | ToastRecord['type']): React.ReactElement => {
    switch (level?.toLowerCase()) {
        case 'success': return <FaCircleCheck className="text-green-400" />;
        case 'error': case 'fatal': return <FaCircleXmark className="text-red-400" />;
        case 'warn': case 'warning': return <FaTriangleExclamation className="text-yellow-400" />;
        case 'info': return <FaCircleInfo className="text-blue-400" />;
        case 'debug': return <FaBug className="text-purple-400" />;
        case 'log': return <FaTerminal className="text-gray-400" />;
        default: return <FaFileLines className="text-gray-500" />;
    }
};
const getLevelColor = (level: LogLevel | ToastRecord['type']): string => {
     switch (level?.toLowerCase()) {
        case 'success': return "text-green-300";
        case 'error': case 'fatal': return "text-red-300 font-semibold";
        case 'warn': case 'warning': return "text-yellow-300";
        case 'info': return "text-blue-300";
        case 'debug': return "text-purple-300";
        case 'log': return "text-gray-300";
        default: return "text-gray-400";
    }
}


// --- Main Overlay Component ---
const DevErrorOverlay: React.FC = () => {
  logger.debug("[DevErrorOverlay] START Render"); // Use debug

  const [internalRenderError, setInternalRenderError] = useState<Error | null>(null);
  const [logHistory, setLogHistory] = useState<ReadonlyArray<LogRecord>>([]);

  const {
      errorInfo,
      addErrorInfo,
      showOverlay,
      toastHistory,
  } = useErrorOverlay();
  const contextAvailable = !!addErrorInfo;

  useEffect(() => {
      if (showOverlay) {
          let currentLogs: ReadonlyArray<LogRecord> = [];
          if (typeof logger !== 'undefined' && typeof logger.getInternalLogRecords === 'function') {
              try { currentLogs = logger.getInternalLogRecords(); logger.debug("[DevErrorOverlay Effect] Fetched logs:", currentLogs.length); }
              catch (e) { logger.error("[DevErrorOverlay Effect] Error calling logger.getInternalLogRecords():", e); }
          } else { logger.warn("[DevErrorOverlay Effect] Logger/getInternalLogRecords not available."); }
          setLogHistory(currentLogs);
      }
  }, [showOverlay]);


  useEffect(() => {
      if (contextAvailable) { logger.debug("[DevErrorOverlay Effect] Context access successful."); } // Use debug
      else { logger.warn("[DevErrorOverlay Effect] Context access returned fallback or missing function."); }
  }, [contextAvailable]);


  useEffect(() => {
    if (errorInfo && showOverlay && contextAvailable) {
        const logPayload = { type: errorInfo.type, message: String(errorInfo.message)?.substring(0, 100) + "...", source: errorInfo.source, };
      logger.info("[DevErrorOverlay Effect] Received errorInfo from context:", logPayload);
    }
  }, [errorInfo, showOverlay, contextAvailable]);

  if (internalRenderError) {
     logger.fatal("[DevErrorOverlay] FATAL: Component failed during its own render!", { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     return <ErrorOverlayFallback message={errorInfo?.message || t.unknownError} renderErrorMessage={internalRenderError.message} />;
  }

  try {
      if (!errorInfo || !showOverlay) { logger.debug("[DevErrorOverlay] No errorInfo or overlay disabled, returning null."); return null; }
      logger.debug("[DevErrorOverlay] Conditions met, rendering overlay UI...");

      const handleClose = () => {
          logger.log("[DevErrorOverlay] Close button clicked.");
          if (!contextAvailable) { logger.error("[DevErrorOverlay] Cannot close: context failed. Reloading fallback."); window.location.reload(); return; }
          try { addErrorInfo(null); logger.info("[DevErrorOverlay] ErrorInfo cleared via context."); }
          catch (e) { logger.error("[DevErrorOverlay] Error calling addErrorInfo(null):", e); }
      };

      const getTruncatedStackTrace = (error?: Error | string | any, maxLines = 10): string => {
          try {
              if (!error) return t.stackTraceEmpty;
              let stack = '';
              if (error instanceof Error && error.stack) { stack = error.stack; }
              else if (typeof error === 'string') { stack = error.split(/\\n|\n/).join('\n'); }
              else if (typeof errorInfo?.stack === 'string') { stack = errorInfo.stack; }
              else { try { stack = JSON.stringify(error, null, 2); } catch { stack = String(error); } }
              if (stack.trim() === '' && errorInfo?.message === 'Script error.') { return t.stackTraceUnavailable; }
              const lines = stack.split('\n'); const shortStack = lines.slice(0, maxLines).join('\n');
              return shortStack || t.stackTraceEmpty;
          } catch (e: any) { logger.error("[DevErrorOverlay] Error getting/formatting stack trace:", e); return `${t.stackTraceError}: ${e?.message ?? 'Unknown'}`; }
      };

       // --- Helper to prepare data with TRUNCATION for GitHub URL ---
      const prepareIssueAndCopyDataSafe = (logLimit = 10, toastLimit = 5, maxLogChars = 1000, maxToastChars = 300, maxStackLines = 7) => {
          logger.debug("[DevErrorOverlay] prepareIssueAndCopyDataSafe START");
          try {
             const safeErrorInfo = errorInfo as ErrorInfo; // Assuming errorInfo is not null here
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || t.unknownError;
             // Get slightly shorter stack for body
             const shortStackForBody = getTruncatedStackTrace(safeErrorInfo.error, maxStackLines);
             const componentStackInfo = safeErrorInfo.componentStack ? `\n\n**Component Stack (truncated):**\n\`\`\`\n${safeErrorInfo.componentStack.substring(0, 300)}\n\`\`\`` : '';
             const source = safeErrorInfo.source ? `${safeErrorInfo.source}${typeof safeErrorInfo.lineno === 'number' ? ':' + safeErrorInfo.lineno : ''}` : 'N/A';
             const repoOrg = process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13';
             const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest';
             const issueTitleOptions = [ `Сбой: ${message.substring(0, 40)}...`, `Баг: ${errorType} ${message.substring(0, 35)}...`, `Аномалия: ${message.substring(0, 45)}...`, `Помощь: ${errorType} (${source || 'N/A'})`, `Глитч! ${errorType}: ${source || 'N/A'}`, ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);
             logger.debug(`[DevErrorOverlay] Issue Details: Type=${errorType}, Source=${source}, Title=${decodeURIComponent(issueTitle)}`);


             // --- Truncate Logs and Toasts for GitHub URL ---
             const formatHistoryForUrl = (history: any[], limit: number, maxChars: number, type: 'log' | 'toast') => {
                 logger.debug(`[DevErrorOverlay] Formatting history for URL: type=${type}, count=${history?.length ?? 0}, limit=${limit}, maxChars=${maxChars}`);
                 if (!history || history.length === 0) return type === 'log' ? t.noRecentLogs : t.noRecentToasts;
                 let charCount = 0;
                 const limitedHistory = history.slice().reverse().slice(0, limit);
                 const formattedLines: string[] = [];
                 for (const item of limitedHistory) {
                     // Add extra checks for item properties
                     const itemType = item?.type || (type === 'log' ? item?.level : 'unknown');
                     const itemTimestamp = item?.timestamp ? new Date(item.timestamp).toLocaleTimeString('ru-RU',{hour12:false}) : 'N/A';
                     const prefix = type === 'log' ? `[${(itemType || 'UNKNOWN').toUpperCase()}] ${itemTimestamp} |` : `[${(itemType || 'UNKNOWN').toUpperCase()}]`;
                     const itemMsg = String(item?.message || '[No Message]').substring(0, 100) + (String(item?.message || '').length > 100 ? '...' : '');
                     const line = `${prefix} ${itemMsg}`;
                     if (charCount + line.length > maxChars) { logger.debug(`[DevErrorOverlay] History URL limit reached for ${type}.`); break; }
                     formattedLines.push(`- ${line}`);
                     charCount += line.length + 1; // +1 for newline
                 }
                  if (history.length > limit || charCount >= maxChars) {
                      formattedLines.push("- ...(еще больше записей опущено)...");
                  }
                 logger.debug(`[DevErrorOverlay] Formatted ${type} history for URL: ${formattedLines.length} lines.`);
                 return formattedLines.join('\n');
              };


             const formattedLogHistoryForUrl = formatHistoryForUrl(logHistory, logLimit, maxLogChars, 'log');
             const formattedToastHistoryForUrl = formatHistoryForUrl(toastHistory, toastLimit, maxToastChars, 'toast');
             // --- End Truncation for URL ---

             const issueBodyContent = `**Тип Ошибки:** ${errorType}\n**Сообщение:** ${message}\n**Источник:** ${source}\n\n**Стек (начало):**\n\`\`\`\n${shortStackForBody}\n\`\`\`${componentStackInfo}\n\n**Последние События (Логи):**\n${formattedLogHistoryForUrl}\n\n**Недавние Уведомления (Тосты):**\n${formattedToastHistoryForUrl}\n\n**Контекст/Шаги:**\n[Опиши, что ты делал(а), когда это случилось]\n`;
             const issueBody = encodeURIComponent(issueBodyContent);
             const gitHubIssueUrl = `https://github.com/${repoOrg}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;

             // --- Prepare FULL history for Copy Prompt (less strict limits) ---
             const fullFormattedLogHistory = formatHistoryForUrl(logHistory, 50, 8000, 'log'); // More logs for copy
             const fullFormattedToastHistory = formatHistoryForUrl(toastHistory, 20, 2000, 'toast'); // More toasts for copy
             const fullStackTrace = getTruncatedStackTrace(safeErrorInfo.error, 30); // More stack lines for copy
             // --- End Full history prep ---

             const copyPrompt = `Йоу! Поймал ошибку в ${repoName}, помоги разгрести!\n\nОшибка (${errorType}) Источник: ${source}\n${message}\n\nСтек (начало):\n\`\`\`\n${fullStackTrace}\n\`\`\`${componentStackInfo}\n\nПоследние События (Логи):\n${fullFormattedLogHistory}\n\nНедавние уведомления (Тосты):\n${fullFormattedToastHistory}\n\nЗадача: Проанализируй ошибку, стек, логи и уведомления. Предложи исправления кода или объясни причину.`;
             logger.info("[DevErrorOverlay] Prepared GitHub URL and Copy Prompt.", { ghUrlLength: gitHubIssueUrl.length, promptLength: copyPrompt.length });
             return { gitHubIssueUrl, copyPrompt };
         } catch (e: any) {
             logger.error("[DevErrorOverlay] Error preparing issue/copy data:", e);
             sonnerToast.error(`${t.copyDataErrorToast}: ${e?.message ?? 'Unknown'}`);
             return { gitHubIssueUrl: `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest'}/issues/new`, copyPrompt: `Error generating copy data: ${e?.message}` };
         }
      };
      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyDataSafe();

      const handleCopyVibeRequest = () => {
         logger.debug("[Flow 3 - Error Fix] DevErrorOverlay: handleCopyVibeRequest called.", { promptLength: copyPrompt?.length });
         try {
             if (!navigator.clipboard) { throw new Error("Clipboard API not available."); }
             navigator.clipboard.writeText(copyPrompt)
               .then(() => {
                   logger.info("[Flow 3 - Error Fix] DevErrorOverlay: Vibe request copied.");
                   sonnerToast.success(t.copySuccessToast);
               })
               .catch(err => {
                   logger.error("[Flow 3 - Error Fix] DevErrorOverlay: Failed to copy vibe request:", err);
                   sonnerToast.error(t.copyErrorToast);
               });
         } catch (e: any) {
             logger.error("[Flow 3 - Error Fix] DevErrorOverlay: Error during copy action setup:", e);
             sonnerToast.error(`${t.copyGenericError}: ${e?.message ?? 'Unknown'}`);
         }
      };

      // --- Safe Render Helper ---
      const RenderSection: React.FC<{ title: string; children: () => React.ReactNode }> = ({ title, children }) => {
          try { return <>{children()}</>; }
          catch (e: any) { logger.error(`[DevErrorOverlay] Error rendering section "${title}":`, e); setInternalRenderError(new Error(`Failed to render section "${title}": ${e.message}`)); return <div className="text-red-500 p-2 bg-red-900/30 rounded">Ошибка рендера секции: {title}</div>; }
      };

      // --- JSX Return ---
      return (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-hidden"
          role="alertdialog" aria-modal="true" aria-labelledby="error-overlay-title" aria-describedby="error-overlay-description"
        >
          {/* Main Content Container */}
          <div className="bg-gradient-to-br from-gray-900 via-indigo-950 to-black border border-cyan-500/30 rounded-lg shadow-2xl p-4 md:p-6 max-w-4xl w-full max-h-[95vh] flex flex-col text-gray-200 glitch-border-animate">

            {/* Header */}
             <RenderSection title="Header">
                 {() => (
                     <div className="flex items-center justify-between mb-4 flex-shrink-0">
                       <h2 id="error-overlay-title" className="text-xl md:text-2xl font-bold text-cyan-300 flex items-center gap-2 glitch-text-shadow">
                          <FaTriangleExclamation className="text-yellow-400" /> {t.systemFailureTitle}
                       </h2>
                       {/* Moved Close button to header for better UX */}
                       <button
                         onClick={handleClose}
                         className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md text-xs font-semibold transition shadow hover:shadow-md"
                         aria-label={t.closeButton}
                       >
                         {t.closeButton}
                       </button>
                     </div>
                 )}
            </RenderSection>

            {/* Body (Scrollable Area) */}
            <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-3 mb-4">
                 {/* Error Message */}
                 <RenderSection title="Message">
                      {() => {
                          let messageText = t.unknownError;
                          try { messageText = String(errorInfo?.message || t.unknownError); }
                          catch (e: any) { messageText = `[Error Displaying Message]`; }
                          return <p className="text-base md:text-lg text-red-300 font-semibold bg-red-900/30 p-3 rounded border border-red-700/50 break-words">{messageText}</p>;
                      }}
                 </RenderSection>

                 {/* Source Info */}
                 <RenderSection title="Source">
                      {() => {
                          try {
                              const source = errorInfo?.source; const line = errorInfo?.lineno; const col = errorInfo?.colno;
                              return source && source !== 'N/A' ? (<p className="text-xs md:text-sm text-purple-300 font-mono break-all">{t.sourceLabel}: {source}{typeof line === 'number' ? ` (${t.lineLabel}: ${line}` : ''}{typeof col === 'number' ? `, ${t.columnLabel}: ${col}` : ''}{typeof line === 'number' ? ')' : ''}</p>) : null;
                          } catch (e: any) { return <p className="text-xs text-red-400">[Error Displaying Source]</p>; }
                      }}
                 </RenderSection>

                 {/* --- Moved Advice/Action Section Higher --- */}
                 <RenderSection title="Advice">
                      {() => (<div className="my-4 p-4 bg-gradient-to-r from-blue-900/30 via-indigo-900/40 to-purple-900/30 border border-blue-600/50 rounded text-blue-100 text-xs md:text-sm space-y-3 shadow-md">
                           <p className="font-semibold text-lg text-blue-200">{t.adviceTitle}</p>
                           <p>{t.adviceLine1}</p>
                           <div className='flex flex-col sm:flex-row gap-2 pt-1'>
                                <button onClick={handleCopyVibeRequest} className="flex-1 text-center px-3 py-1.5 bg-cyan-700/70 hover:bg-cyan-600/80 border border-cyan-500/50 rounded text-cyan-50 hover:text-white font-semibold inline-flex justify-center items-center gap-2 transition text-xs shadow hover:shadow-md">
                                    <FaCopy className="h-3 w-3 flex-shrink-0"/>
                                    <span>{t.adviceCopyLink} {t.adviceCopyDestination}</span>
                                    <FaArrowUpRightFromSquare className="h-2.5 w-2.5 flex-shrink-0"/>
                                </button>
                                <a href={gitHubIssueUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-3 py-1.5 bg-gray-700/60 hover:bg-gray-600/70 border border-gray-500/50 rounded text-gray-100 hover:text-white font-semibold inline-flex justify-center items-center gap-2 transition text-xs shadow hover:shadow-md">
                                    <FaGithub className="inline h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{t.adviceGithubLink} {t.adviceGithubPrepared}</span>
                                    <FaArrowUpRightFromSquare className="h-2.5 w-2.5 flex-shrink-0"/>
                                </a>
                           </div>
                         </div>)}
                 </RenderSection>
                 {/* --- End Moved Advice Section --- */}

                 <hr className="border-gray-700/50 my-3"/>

                 {/* Stack Trace (Default Collapsed) */}
                 <RenderSection title="StackTrace">
                      {() => (<details className="bg-black/30 p-3 rounded border border-gray-700/50" open={false}>
                            <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"> {t.stackTraceLabel} </summary>
                            <pre className="mt-2 text-xs text-gray-300/80 whitespace-pre-wrap break-words font-mono max-h-48 overflow-y-auto simple-scrollbar">{getTruncatedStackTrace(errorInfo?.error, 30)}</pre>
                            {errorInfo?.componentStack && (<> <hr className="border-gray-600 my-2" /> <p className="text-xs font-medium text-gray-400">Component Stack:</p> <pre className="mt-1 text-xs text-gray-300/80 whitespace-pre-wrap break-words font-mono max-h-32 overflow-y-auto simple-scrollbar">{errorInfo.componentStack}</pre> </>)}
                       </details>)}
                 </RenderSection>

                 {/* Logs Section (Default Collapsed) */}
                 <RenderSection title="RecentLogs">
                     {() => (<details className="bg-black/40 p-3 rounded border border-gray-600/60" open={false}>
                          <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white transition-colors"> {t.recentLogsTitle} ({logHistory.length}) </summary>
                          {logHistory.length > 0 ? (
                             <ul className="mt-2 space-y-1.5 text-xs font-mono max-h-80 overflow-y-auto simple-scrollbar pr-1">
                                {logHistory.slice().reverse().map((log) => (
                                    <li key={log.id} className="flex items-start gap-2">
                                        <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" title={log.level.toUpperCase()}>{getLevelIcon(log.level)}</span>
                                        <span className={`flex-1 ${getLevelColor(log.level)}`}>
                                            <span className="block break-words whitespace-pre-wrap">{log.message}</span>
                                            <span className="block text-gray-500 text-[0.65rem] leading-tight opacity-80"><FaRegClock className="inline mr-1 h-2.5 w-2.5" />{formatDistanceToNow(log.timestamp, { addSuffix: true, locale: ru })} ({new Date(log.timestamp).toLocaleTimeString('ru-RU',{hour12:false})})</span>
                                        </span>
                                    </li>
                                ))}
                             </ul>
                          ) : (<p className="mt-2 text-xs text-gray-500">{t.noRecentLogs}</p>)}
                        </details>)}
                 </RenderSection>

                 {/* Toasts Section (Default Collapsed) */}
                 <RenderSection title="RecentToasts">
                     {() => (<details className="bg-black/30 p-3 rounded border border-gray-700/50" open={false}>
                          <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"> {t.recentToastsTitle} ({toastHistory.length}) </summary>
                          {toastHistory.length > 0 ? (
                             <ul className="mt-2 space-y-1 text-xs font-mono max-h-48 overflow-y-auto simple-scrollbar pr-1">
                                {toastHistory.slice().reverse().map((toast) => (
                                    <li key={toast.id} className="flex items-start gap-2 text-gray-300/90">
                                        <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" title={toast.type.toUpperCase()}>{getLevelIcon(toast.type)}</span>
                                        <span className="flex-1 break-words">{String(toast.message)}</span>
                                    </li>
                                ))}
                             </ul>
                          ) : (<p className="mt-2 text-xs text-gray-500">{t.noRecentToasts}</p>)}
                        </details>)}
                 </RenderSection>

            </div> {/* End Scrollable Body */}

            {/* Footer - Close button moved to header */}
            {/* <RenderSection title="Footer"> ... </RenderSection> */}

          </div> {/* End Main Content Container */}
        </div> // End Modal Root
      );
      // --- End JSX Return ---

  } catch (renderError: any) {
      const fatalMsg = "[DevErrorOverlay] CRITICAL: Failed during main UI render execution!";
      logger.fatal(fatalMsg, renderError);
      setInternalRenderError(renderError);
      return null; // Fallback will be rendered on next cycle
  } finally {
       logger.debug("[DevErrorOverlay] END Render"); // Use debug
  }
};

export default DevErrorOverlay;