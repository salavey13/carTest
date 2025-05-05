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
  console.log("[DevErrorOverlay] START Render (via console)"); // Safe logging

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
              try { currentLogs = logger.getInternalLogRecords(); console.debug("[DevErrorOverlay Effect] Fetched logs:", currentLogs.length); }
              catch (e) { console.error("[DevErrorOverlay Effect] Error calling logger.getInternalLogRecords():", e); }
          } else { console.warn("[DevErrorOverlay Effect] Logger/getInternalLogRecords not available."); }
          setLogHistory(currentLogs);
      }
  }, [showOverlay]);

  useEffect(() => {
      if (contextAvailable) { console.log("[DevErrorOverlay Effect] Context access successful."); }
      else { console.warn("[DevErrorOverlay Effect] Context access returned fallback or missing function."); }
  }, [contextAvailable]);

  useEffect(() => {
    if (errorInfo && showOverlay && contextAvailable) {
        const logPayload = { type: errorInfo.type, message: String(errorInfo.message)?.substring(0, 100) + "...", source: errorInfo.source, };
      console.info("[DevErrorOverlay Effect] Received errorInfo from context:", logPayload);
    }
  }, [errorInfo, showOverlay, contextAvailable]);

  if (internalRenderError) {
     console.error("[DevErrorOverlay] FATAL: Component failed during its own render!", { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     return <ErrorOverlayFallback message={errorInfo?.message || t.unknownError} renderErrorMessage={internalRenderError.message} />;
  }

  try {
      if (!errorInfo || !showOverlay) { console.debug("[DevErrorOverlay] No errorInfo or overlay disabled, returning null."); return null; }
      console.debug("[DevErrorOverlay] Conditions met, rendering overlay UI...");

      const handleClose = () => {
          console.log("[DevErrorOverlay] Close button clicked.");
          if (!contextAvailable) { console.error("[DevErrorOverlay] Cannot close: context failed. Reloading fallback."); window.location.reload(); return; }
          try { addErrorInfo(null); console.info("[DevErrorOverlay] ErrorInfo cleared via context."); }
          catch (e) { console.error("[DevErrorOverlay] Error calling addErrorInfo(null):", e); }
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
          } catch (e: any) { console.error("[DevErrorOverlay] Error getting/formatting stack trace:", e); return `${t.stackTraceError}: ${e?.message ?? 'Unknown'}`; }
      };

       // Prepare data for GitHub issue, truncating history
       const prepareIssueAndCopyDataSafe = (logLimit = 15, toastLimit = 10, maxLogChars = 1500, maxToastChars = 500) => {
          try {
             const safeErrorInfo = errorInfo as ErrorInfo;
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || t.unknownError;
             const shortStack = getTruncatedStackTrace(safeErrorInfo.error, 10); // Get first 10 lines for body
             const componentStackInfo = safeErrorInfo.componentStack ? `\n\n**Component Stack:**\n\`\`\`\n${safeErrorInfo.componentStack.substring(0, 500)}\n\`\`\`` : '';
             const source = safeErrorInfo.source ? `${safeErrorInfo.source}${typeof safeErrorInfo.lineno === 'number' ? ':' + safeErrorInfo.lineno : ''}` : 'N/A';
             const repoOrg = process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13';
             const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest';
             const issueTitleOptions = [ `Сбой: ${message.substring(0, 40)}...`, `Баг: ${errorType} ${message.substring(0, 35)}...`, `Аномалия: ${message.substring(0, 45)}...`, `Помощь: ${errorType} (${source || 'N/A'})`, `Глитч! ${errorType}: ${source || 'N/A'}`, ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);

             // --- Truncate Logs and Toasts ---
             const formatHistory = (history: any[], limit: number, maxChars: number, type: 'log' | 'toast') => {
                if (!history || history.length === 0) return type === 'log' ? t.noRecentLogs : t.noRecentToasts;
                let charCount = 0;
                const limitedHistory = history.slice().reverse().slice(0, limit); // Get most recent items up to limit
                const formattedLines: string[] = [];
                for (const item of limitedHistory) {
                    const prefix = type === 'log' ? `[${item.level.toUpperCase()}] ${new Date(item.timestamp).toLocaleTimeString('ru-RU',{hour12:false})} |` : `[${item.type.toUpperCase()}]`;
                    const line = `${prefix} ${String(item.message).substring(0, 200)}${String(item.message).length > 200 ? '...' : ''}`;
                    if (charCount + line.length > maxChars) break; // Stop if adding line exceeds char limit
                    formattedLines.push(`- ${line}`);
                    charCount += line.length + 1; // +1 for newline
                }
                return formattedLines.join('\n');
             };

             const formattedLogHistory = formatHistory(logHistory, logLimit, maxLogChars, 'log');
             const formattedToastHistory = formatHistory(toastHistory, toastLimit, maxToastChars, 'toast');
             // --- End Truncation ---

             const issueBodyContent = `**Тип Ошибки:** ${errorType}\n**Сообщение:** ${message}\n**Источник:** ${source}\n\n**Стек (начало):**\n\`\`\`\n${shortStack}\n\`\`\`${componentStackInfo}\n\n**Последние События (Логи):**\n${formattedLogHistory}\n\n**Недавние Уведомления (Тосты):**\n${formattedToastHistory}\n\n**Контекст/Шаги:**\n[Опиши, что ты делал(а), когда это случилось]\n`;
             // Check URL length before returning
             const baseGithubUrl = `https://github.com/${repoOrg}/${repoName}/issues/new`;
             const titleParam = `title=${issueTitle}`;
             const bodyParam = `body=${encodeURIComponent(issueBodyContent)}`;
             const fullUrl = `${baseGithubUrl}?${titleParam}&${bodyParam}`;

             let finalGitHubIssueUrl = fullUrl;
             // GitHub URL limit is roughly 8kb, but practically much less for GET requests. Let's aim for ~4kb max body.
             if (fullUrl.length > 6000) { // Adjusted limit - more conservative
                 logger.warn("[DevErrorOverlay] GitHub issue URL potentially too long, truncating body further.");
                 const truncatedBodyContent = `**Тип Ошибки:** ${errorType}\n**Сообщение:** ${message}\n**Источник:** ${source}\n\n**Стек (начало):**\n\`\`\`\n${shortStack}\n\`\`\`${componentStackInfo}\n\n**ЛОГИ И ТОСТЫ СОКРАЩЕНЫ ИЗ-ЗА ДЛИНЫ URL**\n\n**Контекст/Шаги:**\n[Опиши, что ты делал(а), когда это случилось]\n`;
                 finalGitHubIssueUrl = `${baseGithubUrl}?${titleParam}&body=${encodeURIComponent(truncatedBodyContent)}`;
             }

             // Copy prompt uses full history, as clipboard has higher limits
             const copyPrompt = `Йоу! Поймал ошибку в ${repoName}, помоги разгрести!\n\nОшибка (${errorType}) Источник: ${source}\n${message}\n\nСтек (начало):\n\`\`\`\n${shortStack}\n\`\`\`${componentStackInfo}\n\nПоследние События (Логи):\n${formatHistory(logHistory, 50, 8000, 'log')}\n\nНедавние уведомления (Тосты):\n${formatHistory(toastHistory, 20, 2000, 'toast')}\n\nЗадача: Проанализируй ошибку, стек, логи и уведомления. Предложи исправления кода или объясни причину.`;
             return { gitHubIssueUrl: finalGitHubIssueUrl, copyPrompt };
         } catch (e: any) {
             console.error("[DevErrorOverlay] Error preparing issue/copy data:", e);
             sonnerToast.error(`${t.copyDataErrorToast}: ${e?.message ?? 'Unknown'}`);
             return { gitHubIssueUrl: `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest'}/issues/new`, copyPrompt: `Error generating copy data: ${e?.message}` };
         }
      };
      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyDataSafe();

      const handleCopyVibeRequest = () => {
         console.debug("[DevErrorOverlay] handleCopyVibeRequest called.");
         try {
             if (!navigator.clipboard) { throw new Error("Clipboard API not available."); }
             navigator.clipboard.writeText(copyPrompt)
               .then(() => { sonnerToast.success(t.copySuccessToast); })
               .catch(err => { console.error("[DevErrorOverlay] Failed to copy vibe request:", err); sonnerToast.error(t.copyErrorToast); });
         } catch (e: any) {
             console.error("[DevErrorOverlay] Error during copy action setup:", e);
             sonnerToast.error(`${t.copyGenericError}: ${e?.message ?? 'Unknown'}`);
         }
      };

      // --- Safe Render Helper ---
      const RenderSection: React.FC<{ title: string; children: () => React.ReactNode }> = ({ title, children }) => {
          try { return <>{children()}</>; }
          catch (e: any) { console.error(`[DevErrorOverlay] Error rendering section "${title}":`, e); setInternalRenderError(new Error(`Failed to render section "${title}": ${e.message}`)); return <div className="text-red-500 p-2 bg-red-900/30 rounded">Ошибка рендера секции: {title}</div>; }
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
                      {() => (<div className="my-4 p-3 bg-blue-900/30 border border-blue-600/50 rounded text-blue-200 text-xs md:text-sm space-y-2">
                           <p className="font-semibold">{t.adviceTitle}</p>
                           <p>{t.adviceLine1}</p>
                           <ul className='list-none space-y-2'>
                               <li>
                                    <button onClick={handleCopyVibeRequest} className="w-full sm:w-auto text-left px-3 py-1.5 bg-cyan-700/50 hover:bg-cyan-600/70 border border-cyan-500/50 rounded text-cyan-100 hover:text-white font-semibold inline-flex items-center gap-2 transition text-xs">
                                        <FaCopy className="h-3 w-3 flex-shrink-0"/>
                                        <span>{t.adviceCopyAction} {t.adviceCopyLink} {t.adviceCopyDestination}</span>
                                        <FaArrowUpRightFromSquare className="h-2.5 w-2.5 flex-shrink-0"/>
                                    </button>
                               </li>
                               <li>
                                    <a href={gitHubIssueUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto text-left px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/70 border border-gray-500/50 rounded text-gray-100 hover:text-white font-semibold inline-flex items-center gap-2 transition text-xs">
                                         <FaGithub className="inline h-3.5 w-3.5 flex-shrink-0" />
                                         <span>{t.adviceGithubAction} {t.adviceGithubLink} {t.adviceGithubPrepared}</span>
                                         <FaArrowUpRightFromSquare className="h-2.5 w-2.5 flex-shrink-0"/>
                                    </a>
                               </li>
                           </ul>
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
                             <ul className="mt-2 space-y-1.5 text-xs font-mono max-h-72 overflow-y-auto simple-scrollbar pr-1">
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

            {/* Footer */}
            <RenderSection title="Footer">
                 {() => (
                     <div className="flex flex-col sm:flex-row justify-end items-center pt-4 border-t border-cyan-700/50 mt-auto gap-3 flex-shrink-0">
                       <button onClick={handleClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-indigo-100 rounded-md text-sm font-semibold transition shadow hover:shadow-lg w-full sm:w-auto" aria-label={t.closeButton}> {t.closeButton} </button>
                     </div>
                 )}
            </RenderSection>

          </div> {/* End Main Content Container */}
        </div> // End Modal Root
      );
      // --- End JSX Return ---

  } catch (renderError: any) {
      // Catch errors specifically during the rendering of the overlay's UI
      const fatalMsg = "[DevErrorOverlay] CRITICAL: Failed during main UI render execution!";
      console.error(fatalMsg, renderError);
      setInternalRenderError(renderError);
      return null; // Fallback will be rendered on next cycle
  } finally {
       // --- USE CONSOLE for render end ---
       console.log("[DevErrorOverlay] END Render (via console)");
       // ----------------------------------
  }
};

export default DevErrorOverlay;