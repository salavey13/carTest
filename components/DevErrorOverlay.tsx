"use client";

import React, { useEffect, useState } from 'react';
// Import context types but get logs directly from logger
import { useErrorOverlay, ErrorInfo, ToastRecord, ErrorSourceType } from '@/contexts/ErrorOverlayContext';
import {
    FaCopy, FaTriangleExclamation, FaGithub, FaRegClock, FaCircleInfo, FaCircleCheck,
    FaCircleXmark, FaBug, FaFileLines, FaTerminal, FaArrowUpRightFromSquare
} from 'react-icons/fa6';
import { toast as sonnerToast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
// Import logger and LogLevel type directly
import { debugLogger as logger, LogLevel, LogRecord } from '@/lib/debugLogger';

// --- i18n Translations (Unchanged) ---
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

// --- Fallback Component (Unchanged) ---
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

// --- Icon Helpers (Unchanged) ---
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
  // --- USE CONSOLE for render start/end to avoid loops ---
  console.log("[DevErrorOverlay] START Render (via console)");
  // ---------------------------------------------------------

  const [internalRenderError, setInternalRenderError] = useState<Error | null>(null);

  // Get context values
  const {
      errorInfo,
      setErrorInfo, // Use the direct setter
      showOverlay,
      toastHistory, // Still use context for *toasts*
      // logHistory is no longer needed from context
  } = useErrorOverlay();
  const contextAvailable = !!setErrorInfo; // Check if setter function exists

  // --- Get Logs directly from the logger instance ---
  // Safeguard access to logger
  let logHistory: ReadonlyArray<LogRecord> = [];
  if (typeof logger !== 'undefined') {
      try {
          logHistory = logger.getInternalLogRecords();
      } catch (e) {
           console.error("[DevErrorOverlay] Error calling logger.getInternalLogRecords():", e);
           // Keep logHistory as empty array
      }
  } else {
       console.warn("[DevErrorOverlay] Logger not defined when trying to get history.");
  }


  // Log context access result safely
  useEffect(() => {
      if (contextAvailable) {
           if (typeof logger !== 'undefined') logger.log("[DevErrorOverlay Effect] Context access successful (Real Context obtained)."); else console.log("[DevErrorOverlay Effect] Context access successful (Real Context obtained).");
      } else {
           if (typeof logger !== 'undefined') logger.warn("[DevErrorOverlay Effect] Context access returned fallback. Overlay functionality may be limited."); else console.warn("[DevErrorOverlay Effect] Context access returned fallback. Overlay functionality may be limited.");
      }
  }, [contextAvailable]);


  // Log received error info using useEffect (runs after render)
  useEffect(() => {
    if (errorInfo && showOverlay && contextAvailable) {
        const logPayload = {
              type: errorInfo.type,
              message: errorInfo.message?.substring(0, 100) + "...",
              source: errorInfo.source,
          };
      if (typeof logger !== 'undefined') {
          logger.info("[DevErrorOverlay Effect] Received errorInfo from context:", logPayload);
      } else {
          console.info("[DevErrorOverlay Effect] Received errorInfo from context (logger unavailable):", logPayload);
      }
    }
  }, [errorInfo, showOverlay, contextAvailable]);

  // --- Render Fallback if internal rendering error occurs ---
  if (internalRenderError) {
     // Use logger safely
     const fatalMsg = "[DevErrorOverlay] FATAL: Component failed during its own render!";
     if (typeof logger !== 'undefined') {
         logger.fatal(fatalMsg, { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     } else {
         console.error(fatalMsg, { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     }
     console.error("[DevErrorOverlay] FATAL: Component failed to render!", { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     return <ErrorOverlayFallback message={errorInfo?.message || t.unknownError} renderErrorMessage={internalRenderError.message} />;
  }

  // --- Main Component Logic (Wrapped in try-catch for render safety) ---
  try {
      // --- Condition to Render ---
      // Render only if we have error info AND the overlay should be shown.
      if (!errorInfo || !showOverlay) {
        // console.debug("[DevErrorOverlay] No errorInfo or overlay disabled, returning null."); // Console is safe here
        return null;
      }
      // Log render intent (using console to be safe)
      console.debug("[DevErrorOverlay] Conditions met, rendering overlay UI...");

      // --- Event Handlers ---
      const handleClose = () => {
          const logPrefix = "[DevErrorOverlay]";
          // Log safely
          if (typeof logger !== 'undefined') logger.log(`${logPrefix} Close button clicked.`); else console.log(`${logPrefix} Close button clicked.`);
          if (!contextAvailable) {
             if (typeof logger !== 'undefined') logger.error(`${logPrefix} Cannot close: setErrorInfo not available (context failed).`); else console.error(`${logPrefix} Cannot close: setErrorInfo not available (context failed).`);
             window.location.reload(); // Fallback: try reloading if context is broken
             return;
          }
          try {
              setErrorInfo(null); // Call the function from the hook
              if (typeof logger !== 'undefined') logger.info(`${logPrefix} ErrorInfo cleared via context.`); else console.info(`${logPrefix} ErrorInfo cleared via context.`);
          } catch (e) {
              if (typeof logger !== 'undefined') logger.error(`${logPrefix} Error calling setErrorInfo(null) during handleClose:`, e); else console.error(`${logPrefix} Error calling setErrorInfo(null) during handleClose:`, e);
              console.error(`${logPrefix} Error in setErrorInfo during handleClose:`, e); // Also log raw error
          }
      };

      // --- Helper to safely get stack trace ---
      const getShortStackTraceSafe = (error?: Error | string | any): string => {
          const logPrefix = "[DevErrorOverlay]";
          try {
              if (!error) return t.stackTraceEmpty;
              let stack = '';
              if (error instanceof Error && error.stack) { stack = error.stack; }
              else if (typeof error === 'string') { stack = error.split(/\\n|\n/).join('\n'); }
              else { try { stack = JSON.stringify(error, null, 2); } catch { stack = String(error); } }
              if (stack.trim() === '' && errorInfo?.message === 'Script error.') { return t.stackTraceUnavailable; }
              const lines = stack.split('\n'); const shortStack = lines.slice(0, 10).join('\n');
              return shortStack || t.stackTraceEmpty;
          } catch (e: any) {
              if (typeof logger !== 'undefined') logger.error(`${logPrefix} Error getting/formatting stack trace:`, e); else console.error(`${logPrefix} Error getting/formatting stack trace:`, e);
              console.error(`${logPrefix} Error getting/formatting stack trace:`, e); // Raw error
              return `${t.stackTraceError}: ${e?.message ?? 'Unknown'}`;
          }
      };

       // --- Helper to prepare data (with internal try-catch) ---
      const prepareIssueAndCopyDataSafe = () => {
          const logPrefix = "[DevErrorOverlay]";
          try {
             const safeErrorInfo = errorInfo as ErrorInfo; // Safe here due to outer check
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || t.unknownError;
             const shortStack = getShortStackTraceSafe(safeErrorInfo.error);
             const source = safeErrorInfo.source ? `${safeErrorInfo.source}${typeof safeErrorInfo.lineno === 'number' ? ':' + safeErrorInfo.lineno : ''}` : 'N/A'; // Simplified source
             const repoOrg = process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13';
             const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest';
             const issueTitleOptions = [ `Сбой в Матрице: ${message.substring(0, 40)}...`, `Баг в Коде: ${errorType} ${message.substring(0, 35)}...`, `Аномалия: ${message.substring(0, 45)}...`, `Нужна Помощь: ${errorType} (${source || 'N/A'})`, `Глитч! ${errorType}: ${source || 'N/A'}`, ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);
             // --- Use logs from logger ---
             const logsFromLogger = typeof logger !== 'undefined' ? logger.getInternalLogRecords() : []; // Get logs safely
             const formattedLogHistory = logsFromLogger.length > 0 ? logsFromLogger.slice().reverse().map(log => `- [${log.level.toUpperCase()}] ${new Date(log.timestamp).toLocaleTimeString('ru-RU',{hour12:false})} | ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`).join('\n') : t.noRecentLogs;
             // --- Use toasts from context ---
             const formattedToastHistory = toastHistory.length > 0 ? toastHistory.slice().reverse().map(th => `- [${th.type.toUpperCase()}] ${String(th.message).substring(0, 200)}${String(th.message).length > 200 ? '...' : ''}`).join('\n') : t.noRecentToasts;
             const issueBodyContent = `**Тип Ошибки:** ${errorType}\n**Сообщение:** ${message}\n**Источник:** ${source}\n\n**Стек (начало):**\n\`\`\`\n${shortStack}\n\`\`\`\n\n**Последние События (Логи):**\n${formattedLogHistory}\n\n**Недавние Уведомления (Тосты):**\n${formattedToastHistory}\n\n**Контекст/Шаги:**\n[Опиши, что ты делал(а), когда это случилось]\n`;
             const issueBody = encodeURIComponent(issueBodyContent);
             const gitHubIssueUrl = `https://github.com/${repoOrg}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;
             const copyPrompt = `Йоу! Поймал ошибку в ${repoName}, помоги разгрести!\n\nОшибка (${errorType}) Источник: ${source}\n${message}\n\nСтек (начало):\n\`\`\`\n${shortStack}\n\`\`\`\n\nПоследние События (Логи):\n${formattedLogHistory}\n\nНедавние уведомления (Тосты):\n${formattedToastHistory}\n\nЗадача: Проанализируй ошибку, стек, логи и уведомления. Предложи исправления кода или объясни причину.`;
             return { gitHubIssueUrl, copyPrompt };
         } catch (e: any) {
             if (typeof logger !== 'undefined') logger.error(`${logPrefix} Error preparing issue/copy data:`, e); else console.error(`${logPrefix} Error preparing issue/copy data:`, e);
             sonnerToast.error(`${t.copyDataErrorToast}: ${e?.message ?? 'Unknown'}`);
             return { gitHubIssueUrl: `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest'}/issues/new`, copyPrompt: `Error generating copy data: ${e?.message}` };
         }
      };
      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyDataSafe();

      // --- Handle Copy Action ---
      const handleCopyVibeRequest = () => {
         const logPrefix = "[DevErrorOverlay]";
         if (typeof logger !== 'undefined') logger.debug(`${logPrefix} handleCopyVibeRequest called.`); else console.debug(`${logPrefix} handleCopyVibeRequest called.`);
         try {
             if (!navigator.clipboard) { throw new Error("Clipboard API not available."); }
             navigator.clipboard.writeText(copyPrompt)
               .then(() => { sonnerToast.success(t.copySuccessToast); })
               .catch(err => { if (typeof logger !== 'undefined') logger.error(`${logPrefix} Failed to copy vibe request using clipboard API:`, err); else console.error(`${logPrefix} Failed to copy vibe request using clipboard API:`, err); sonnerToast.error(t.copyErrorToast); });
         } catch (e: any) {
             if (typeof logger !== 'undefined') logger.error(`${logPrefix} Error during copy action setup:`, e); else console.error(`${logPrefix} Error during copy action setup:`, e);
             sonnerToast.error(`${t.copyGenericError}: ${e?.message ?? 'Unknown'}`);
         }
      };

      // --- Safe Render Helper (Unchanged) ---
      const RenderSection: React.FC<{ title: string; children: () => React.ReactNode }> = ({ title, children }) => {
          try {
              // console.debug(`[DevErrorOverlay] Rendering section: ${title}`); // Console for render phase
              return <>{children()}</>;
          } catch (e: any) {
              const logPrefix = "[DevErrorOverlay]";
              if (typeof logger !== 'undefined') logger.error(`${logPrefix} Error rendering section "${title}":`, e); else console.error(`${logPrefix} Error rendering section "${title}":`, e);
              console.error(`${logPrefix} Error rendering section "${title}":`, e); // Raw error
              setInternalRenderError(new Error(`Failed to render section "${title}": ${e.message}`));
              return <div className="text-red-500 p-2 bg-red-900/30 rounded">Ошибка рендера секции: {title}</div>;
          }
      };

      // --- JSX Return ---
      return (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-hidden"
          role="alertdialog" aria-modal="true" aria-labelledby="error-overlay-title" aria-describedby="error-overlay-description"
        >
          {/* Main Content Container */}
          <div className="bg-gradient-to-br from-gray-900 via-indigo-950 to-black border border-cyan-500/30 rounded-lg shadow-2xl p-4 md:p-6 max-w-4xl w-full max-h-[95vh] flex flex-col text-gray-200 glitch-border-animate">

            {/* Header (Unchanged) */}
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
            <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-4 mb-4">
                 {/* Error Message (Unchanged) */}
                 <RenderSection title="Message">
                      {() => {
                          let messageText = t.unknownError;
                          try { messageText = String(errorInfo?.message || t.unknownError); }
                          catch (e: any) { messageText = `[Error Displaying Message]`; }
                          return <p className="text-base md:text-lg text-red-300 font-semibold bg-red-900/30 p-2 rounded border border-red-700/50 break-words">{messageText}</p>;
                      }}
                 </RenderSection>

                 {/* Source Info (Unchanged) */}
                 <RenderSection title="Source">
                      {() => {
                          try {
                              const source = errorInfo?.source;
                              const line = errorInfo?.lineno;
                              const col = errorInfo?.colno;
                              return source && source !== 'N/A' ? (
                                <p className="text-xs md:text-sm text-purple-300 font-mono break-all">
                                    {t.sourceLabel}: {source}
                                    {typeof line === 'number' ? ` (${t.lineLabel}: ${line}` : ''}
                                    {typeof col === 'number' ? `, ${t.columnLabel}: ${col}` : ''}
                                    {typeof line === 'number' ? ')' : ''}
                                </p>
                              ) : null;
                          } catch (e: any) { return <p className="text-xs text-red-400">[Error Displaying Source]</p>; }
                      }}
                 </RenderSection>

                 {/* Stack Trace (Unchanged) */}
                 <RenderSection title="StackTrace">
                      {() => (<details className="bg-black/30 p-3 rounded border border-gray-700/50">
                            <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"> {t.stackTraceLabel} </summary>
                            <pre className="mt-2 text-xs text-gray-300/80 whitespace-pre-wrap break-words font-mono max-h-32 overflow-y-auto simple-scrollbar">
                                {getShortStackTraceSafe(errorInfo?.error)}
                            </pre>
                       </details>)}
                 </RenderSection>

                 {/* Logs Section (Uses logHistory from logger) */}
                 <RenderSection title="RecentLogs">
                     {() => (<details className="bg-black/40 p-3 rounded border border-gray-600/60" open={logHistory.length > 0}>
                          <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white transition-colors"> {t.recentLogsTitle} ({logHistory.length}) </summary>
                          {logHistory.length > 0 ? (
                             <ul className="mt-2 space-y-1.5 text-xs font-mono max-h-60 overflow-y-auto simple-scrollbar pr-1">
                                {logHistory.slice().reverse().map((log) => ( // Use logHistory from logger
                                    <li key={log.id} className="flex items-start gap-2">
                                        <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" title={log.level.toUpperCase()}>{getLevelIcon(log.level)}</span>
                                        <span className={`flex-1 ${getLevelColor(log.level)}`}>
                                            <span className="block break-words whitespace-pre-wrap">{log.message}</span>
                                            <span className="block text-gray-500 text-[0.65rem] leading-tight opacity-80">
                                                <FaRegClock className="inline mr-1 h-2.5 w-2.5" />
                                                {formatDistanceToNow(log.timestamp, { addSuffix: true, locale: ru })} ({new Date(log.timestamp).toLocaleTimeString('ru-RU',{hour12:false})})
                                            </span>
                                        </span>
                                    </li>
                                ))}
                             </ul>
                          ) : (<p className="mt-2 text-xs text-gray-500">{t.noRecentLogs}</p>)}
                        </details>)}
                 </RenderSection>

                 {/* Toasts Section (Uses context) */}
                 <RenderSection title="RecentToasts">
                     {() => (<details className="bg-black/30 p-3 rounded border border-gray-700/50" open={toastHistory.length > 0}>
                          <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"> {t.recentToastsTitle} ({toastHistory.length}) </summary>
                          {toastHistory.length > 0 ? (
                             <ul className="mt-2 space-y-1 text-xs font-mono max-h-40 overflow-y-auto simple-scrollbar pr-1">
                                {toastHistory.slice().reverse().map((toast) => ( // Use toastHistory from context
                                    <li key={toast.id} className="flex items-start gap-2 text-gray-300/90">
                                        <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" title={toast.type.toUpperCase()}>{getLevelIcon(toast.type)}</span>
                                        <span className="flex-1 break-words">{String(toast.message)}</span>
                                    </li>
                                ))}
                             </ul>
                          ) : (<p className="mt-2 text-xs text-gray-500">{t.noRecentToasts}</p>)}
                        </details>)}
                 </RenderSection>

                 {/* Advice Section (Unchanged logic) */}
                 <RenderSection title="Advice">
                      {() => (<div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded text-yellow-200 text-xs md:text-sm space-y-2">
                           <p className="font-semibold">{t.adviceTitle}</p>
                           <p>{t.adviceLine1}</p>
                           <ul className='list-disc list-inside space-y-1'>
                               <li>
                                    {t.adviceCopyAction}
                                    <button onClick={handleCopyVibeRequest} className="text-cyan-400 underline hover:text-cyan-300 px-1 font-semibold inline-flex items-center gap-1 transition">
                                        <FaCopy className="h-3 w-3"/> {t.adviceCopyLink}
                                    </button>
                                    {t.adviceCopyDestination}
                                    (<a href="/repo-xml" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300 inline-flex items-center gap-1">
                                        /repo-xml <FaArrowUpRightFromSquare className="h-2.5 w-2.5"/>
                                     </a>).
                               </li>
                               <li>
                                    {t.adviceGithubAction}
                                    <a href={gitHubIssueUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition">
                                         {t.adviceGithubLink} <FaGithub className="inline ml-1 h-3 w-3" />
                                    </a>
                                    {t.adviceGithubPrepared}
                               </li>
                           </ul>
                         </div>)}
                 </RenderSection>
            </div> {/* End Scrollable Body */}

            {/* Footer (Unchanged) */}
            <RenderSection title="Footer">
                 {() => (
                     <div className="flex flex-col sm:flex-row justify-end items-center pt-4 border-t border-cyan-700/50 mt-auto gap-3 flex-shrink-0">
                       {/* Close Button */}
                       <button
                         onClick={handleClose}
                         className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-indigo-100 rounded-md text-sm font-semibold transition shadow hover:shadow-lg w-full sm:w-auto"
                         aria-label={t.closeButton}
                       >
                         {t.closeButton}
                       </button>
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
      if (typeof logger !== 'undefined') logger.fatal(fatalMsg, renderError); else console.error(fatalMsg, renderError);
      console.error("[DevErrorOverlay] CRITICAL: Failed during main render execution!", renderError); // Raw error
      setInternalRenderError(renderError);
      return null; // Fallback will be rendered on next cycle
  } finally {
       // --- USE CONSOLE for render end ---
       console.log("[DevErrorOverlay] END Render (via console)");
       // ----------------------------------
  }
};

export default DevErrorOverlay;