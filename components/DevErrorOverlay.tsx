"use client";

import React, { useEffect, useState } from 'react'; // Added React import
import { useErrorOverlay, ErrorInfo, LogRecord, ToastRecord, LogLevel } from '@/contexts/ErrorOverlayContext';
import {
    FaCopy, FaTriangleExclamation, FaGithub, FaRegClock, FaCircleInfo, FaCircleCheck,
    FaCircleXmark, FaBug, FaFileLines, FaTerminal, FaArrowUpRightFromSquare
} from 'react-icons/fa6';
import { toast as sonnerToast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { debugLogger as logger } from '@/lib/debugLogger'; // Import logger

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

// --- Fallback Component (Improved Error Display) ---
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
  // Log render start using logger
  logger.log("[DevErrorOverlay] START Render");
  const [internalRenderError, setInternalRenderError] = useState<Error | null>(null);

  // Safely access context
  let errorInfo: ErrorInfo | null = null;
  let setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>> = () => {};
  let showOverlay = false;
  let toastHistory: ToastRecord[] = [];
  let logHistory: LogRecord[] = [];
  let contextAvailable = false;

  try {
       const context = useErrorOverlay(); // Use the hook
       // Check if it's the fallback context (optional but good practice)
       if (context.setErrorInfo !== fallbackErrorContext.setErrorInfo) {
            errorInfo = context.errorInfo;
            setErrorInfo = context.setErrorInfo;
            showOverlay = context.showOverlay;
            toastHistory = context.toastHistory;
            logHistory = context.logHistory;
            contextAvailable = true;
            logger.log("[DevErrorOverlay] Context access successful.");
       } else {
           logger.warn("[DevErrorOverlay] Context seems to be the fallback value. Using defaults.");
           // Use defaults from fallbackErrorContext if needed, or handle appropriately
           showOverlay = fallbackErrorContext.showOverlay; // Use fallback default
       }
  } catch(contextError: any) {
       // This catch block handles errors during the useErrorOverlay() hook execution itself
       logger.fatal(t.fatalContextError, contextError);
       console.error(t.fatalContextError, contextError);
       // Render a specific error message if context hook fails critically
       return <div className="fixed inset-0 z-[100] bg-black text-red-500 p-4">{t.fatalContextError}</div>;
  }

  // Log received error info only once when it appears
  useEffect(() => {
    if (errorInfo && showOverlay && contextAvailable) {
      logger.info("[DevErrorOverlay] Received errorInfo from context:", {
          type: errorInfo.type,
          message: errorInfo.message,
          source: errorInfo.source,
      });
    } else if (!contextAvailable) {
        logger.error("[DevErrorOverlay] Context not available in useEffect.");
    }
  }, [errorInfo, showOverlay, contextAvailable]); // Dependencies updated

  // --- Render Fallback if internal rendering error occurs ---
  if (internalRenderError) {
     logger.fatal("[DevErrorOverlay] FATAL: Component failed during its own render!", { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     console.error("[DevErrorOverlay] FATAL: Component failed to render!", { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     // Pass the original error message (if available) and the render error message to the fallback
     return <ErrorOverlayFallback message={errorInfo?.message || t.unknownError} renderErrorMessage={internalRenderError.message} />;
  }

  // --- Main Component Logic ---
  // Wrap THE ENTIRE JSX RETURN in try-catch to catch errors during rendering the overlay UI
  try {
      // --- Condition to Render ---
      // Only render if context is available, overlay is shown, and there's error info
      if (!contextAvailable || !errorInfo || !showOverlay) {
        // logger.debug("[DevErrorOverlay] Conditions not met for rendering, returning null.");
        return null;
      }
      logger.log("[DevErrorOverlay] Conditions met, rendering overlay UI...");

      // --- Event Handlers ---
      const handleClose = () => {
          logger.log("[DevErrorOverlay] Close button clicked.");
          try {
              // Use functional update for safety, though direct call is likely fine here
              setErrorInfo(null);
              logger.info("[DevErrorOverlay] ErrorInfo cleared via context.");
          }
          catch (e) {
              logger.error("[DevErrorOverlay] Error calling setErrorInfo(null) during handleClose:", e);
              console.error("[DevErrorOverlay] Error in setErrorInfo during handleClose:", e);
              // Attempt to force reload if clearing state fails?
              // window.location.reload();
          }
      };

      // --- Helper to safely get stack trace ---
      const getShortStackTraceSafe = (error?: Error | string | any): string => {
          // Nested try-catch specifically for stack trace processing
          try {
              if (!error) return t.stackTraceEmpty;

              let stack = '';
              if (error instanceof Error && error.stack) {
                  stack = error.stack;
              } else if (typeof error === 'string') {
                  // Attempt to format strings that might contain escaped newlines
                  stack = error.split(/\\n|\n/).join('\n');
              } else {
                  // Fallback for other types or objects without stack
                  try { stack = JSON.stringify(error, null, 2); } catch { stack = String(error); }
              }

              // Specific check for generic script errors which often lack useful stacks
              if (stack.trim() === '' && errorInfo?.message === 'Script error.') {
                  return t.stackTraceUnavailable;
              }

              // Limit stack trace length for display
              const lines = stack.split('\n');
              const shortStack = lines.slice(0, 10).join('\n'); // Limit to 10 lines
              return shortStack || t.stackTraceEmpty;

          } catch (e: any) {
              logger.error("[DevErrorOverlay] Error getting/formatting stack trace:", e);
              console.error("[DevErrorOverlay] Error getting/formatting stack trace:", e);
              // Don't trigger full fallback here, just show error message for stack
              return `${t.stackTraceError}: ${e?.message ?? 'Unknown'}`;
          }
      };

      // --- Helper to prepare data (with internal try-catch) ---
      const prepareIssueAndCopyDataSafe = () => {
          // Nested try-catch for data preparation logic
          try {
             // Use errorInfo directly, already checked for null outside
             const safeErrorInfo = errorInfo as ErrorInfo; // Type assertion safe here
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || t.unknownError;
             const shortStack = getShortStackTraceSafe(safeErrorInfo.error); // Use safe version
             const source = safeErrorInfo.source ? `${safeErrorInfo.source}:${safeErrorInfo.lineno ?? '?'}` : 'N/A';

             // Get Repo info safely from env vars with fallbacks
             const repoOrg = process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13';
             const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest';

             // Prepare Issue Title (Randomized slightly)
             const issueTitleOptions = [
                 `Сбой в Матрице: ${message.substring(0, 40)}...`,
                 `Баг в Коде: ${errorType} ${message.substring(0, 35)}...`,
                 `Аномалия: ${message.substring(0, 45)}...`,
                 `Нужна Помощь: ${errorType} (${source || 'N/A'})`,
                 `Глитч! ${errorType}: ${source || 'N/A'}`,
             ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);

             // Format Log History
             const formattedLogHistory = logHistory.length > 0
                ? logHistory.slice().reverse().map(log =>
                    `- [${log.level.toUpperCase()}] ${new Date(log.timestamp).toLocaleTimeString('ru-RU',{hour12:false})} | ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`
                  ).join('\n')
                : t.noRecentLogs;

             // Format Toast History
             const formattedToastHistory = toastHistory.length > 0
                ? toastHistory.slice().reverse().map(th =>
                    `- [${th.type.toUpperCase()}] ${String(th.message).substring(0, 200)}${String(th.message).length > 200 ? '...' : ''}` // Ensure message is string
                  ).join('\n')
                : t.noRecentToasts;

             // Prepare Issue Body
             const issueBodyContent =
`**Тип Ошибки:** ${errorType}
**Сообщение:** ${message}
**Источник:** ${source}

**Стек (начало):**
\`\`\`
${shortStack}
\`\`\`

**Последние События (Логи):**
${formattedLogHistory}

**Недавние Уведомления (Тосты):**
${formattedToastHistory}

**Контекст/Шаги:**
[Опиши, что ты делал(а), когда это случилось]
`;
             const issueBody = encodeURIComponent(issueBodyContent);
             const gitHubIssueUrl = `https://github.com/${repoOrg}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;

             // Prepare Copy Prompt
             const copyPrompt =
`Йоу! Поймал ошибку в ${repoName}, помоги разгрести!

Ошибка (${errorType}) Источник: ${source}
${message}

Стек (начало):
\`\`\`
${shortStack}
\`\`\`

Последние События (Логи):
${formattedLogHistory}

Недавние уведомления (Тосты):
${formattedToastHistory}

Задача: Проанализируй ошибку, стек, логи и уведомления. Предложи исправления кода или объясни причину.`;

             return { gitHubIssueUrl, copyPrompt };

         } catch (e: any) {
             logger.error("[DevErrorOverlay] Error preparing issue/copy data:", e);
             console.error("[DevErrorOverlay] Error preparing issue/copy data:", e);
             // Show toast error but don't crash the overlay
             sonnerToast.error(`${t.copyDataErrorToast}: ${e?.message ?? 'Unknown'}`);
             // Return fallback data
             return {
                 gitHubIssueUrl: `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest'}/issues/new`,
                 copyPrompt: `Error generating copy data: ${e?.message}`
             };
         }
      };

      // Get prepared data safely
      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyDataSafe();

      // --- Handle Copy Action ---
      const handleCopyVibeRequest = () => {
         // logger.debug("[DevErrorOverlay] handleCopyVibeRequest called.");
         try {
             if (!navigator.clipboard) {
                 throw new Error("Clipboard API not available.");
             }
             navigator.clipboard.writeText(copyPrompt)
               .then(() => {
                   // logger.info("[DevErrorOverlay] Vibe request copied successfully.");
                   sonnerToast.success(t.copySuccessToast);
               })
               .catch(err => {
                   logger.error("[DevErrorOverlay] Failed to copy vibe request using clipboard API:", err);
                   sonnerToast.error(t.copyErrorToast);
               });
         } catch (e: any) {
             logger.error("[DevErrorOverlay] Error during copy action setup:", e);
             sonnerToast.error(`${t.copyGenericError}: ${e?.message ?? 'Unknown'}`);
         }
      };

      // --- Helper for Rendering Sections Safely ---
      // This prevents an error in one section from crashing the whole overlay render
      const RenderSection: React.FC<{ title: string; children: () => React.ReactNode }> = ({ title, children }) => {
          try {
              // logger.debug(`[DevErrorOverlay] Rendering section: ${title}`);
              return <>{children()}</>;
          } catch (e: any) {
              logger.error(`[DevErrorOverlay] Error rendering section "${title}":`, e);
              console.error(`[DevErrorOverlay] Error rendering section "${title}":`, e);
              // Set internal error state to trigger the main fallback
              setInternalRenderError(new Error(`Failed to render section "${title}": ${e.message}`));
              return <div className="text-red-500 p-2 bg-red-900/30 rounded">Ошибка рендера секции: {title}</div>; // Render inline error for this section
          }
      };

      // --- JSX Return ---
      return (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-hidden" // Prevent body scroll
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
                       {/* Optional: Add close button directly in header if preferred */}
                     </div>
                 )}
            </RenderSection>

            {/* Body (Scrollable Area) */}
            <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-4 mb-4">
                 {/* Error Message */}
                 <RenderSection title="Message">
                      {() => {
                          let messageText = t.unknownError;
                          try { messageText = String(errorInfo?.message || t.unknownError); } // Ensure string conversion
                          catch (e: any) { messageText = `[Error Displaying Message]`; }
                          return <p className="text-base md:text-lg text-red-300 font-semibold bg-red-900/30 p-2 rounded border border-red-700/50 break-words">{messageText}</p>;
                      }}
                 </RenderSection>

                 {/* Source Info */}
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

                 {/* Stack Trace */}
                 <RenderSection title="StackTrace">
                      {() => (<details className="bg-black/30 p-3 rounded border border-gray-700/50">
                            <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"> {t.stackTraceLabel} </summary>
                            <pre className="mt-2 text-xs text-gray-300/80 whitespace-pre-wrap break-words font-mono max-h-32 overflow-y-auto simple-scrollbar">
                                {getShortStackTraceSafe(errorInfo?.error)}
                            </pre>
                       </details>)}
                 </RenderSection>

                 {/* Logs Section */}
                 <RenderSection title="RecentLogs">
                     {() => (<details className="bg-black/40 p-3 rounded border border-gray-600/60" open={logHistory.length > 0}>
                          <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white transition-colors"> {t.recentLogsTitle} ({logHistory.length}) </summary>
                          {logHistory.length > 0 ? (
                             <ul className="mt-2 space-y-1.5 text-xs font-mono max-h-60 overflow-y-auto simple-scrollbar pr-1">
                                {logHistory.slice().reverse().map((log) => (
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

                 {/* Toasts Section */}
                 <RenderSection title="RecentToasts">
                     {() => (<details className="bg-black/30 p-3 rounded border border-gray-700/50" open={toastHistory.length > 0}>
                          <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"> {t.recentToastsTitle} ({toastHistory.length}) </summary>
                          {toastHistory.length > 0 ? (
                             <ul className="mt-2 space-y-1 text-xs font-mono max-h-40 overflow-y-auto simple-scrollbar pr-1">
                                {toastHistory.slice().reverse().map((toast) => (
                                    <li key={toast.id} className="flex items-start gap-2 text-gray-300/90">
                                        <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" title={toast.type.toUpperCase()}>{getLevelIcon(toast.type)}</span>
                                        <span className="flex-1 break-words">{String(toast.message)}</span> {/* Ensure message is string */}
                                    </li>
                                ))}
                             </ul>
                          ) : (<p className="mt-2 text-xs text-gray-500">{t.noRecentToasts}</p>)}
                        </details>)}
                 </RenderSection>

                 {/* Advice Section */}
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
            </div>

            {/* Footer (Non-scrolling Area) */}
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
      logger.fatal("[DevErrorOverlay] CRITICAL: Failed during main UI render execution!", renderError);
      console.error("[DevErrorOverlay] CRITICAL: Failed during main render execution!", renderError);
      // Set the internal error state. The component will re-render and hit the fallback condition.
      setInternalRenderError(renderError);
      // Return null temporarily; the state update will trigger the fallback render.
      return null;
  } finally {
       logger.log("[DevErrorOverlay] END Render"); // Log end of render execution
  }
};

export default DevErrorOverlay;