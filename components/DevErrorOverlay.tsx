"use client";

import React from 'react';
import { useErrorOverlay, ErrorInfo, LogRecord, ToastRecord, LogLevel } from '@/contexts/ErrorOverlayContext';
import {
    FaCopy, FaTriangleExclamation, FaGithub, FaRegClock, FaCircleInfo, FaCircleCheck,
    FaCircleXmark, FaBug, FaFileLines, FaTerminal // Добавили иконки
} from 'react-icons/fa6';
import { toast as sonnerToast } from 'sonner';
import { debugLogger as logger } from '@/lib/debugLogger'; // Используем ТОЛЬКО для внутренних ошибок оверлея
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

// --- i18n ---
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
    recentToastsTitle: "Недавние Уведомления (Тосты)", // Уточнили
    noRecentToasts: "Нет недавних уведомлений.",
    recentLogsTitle: "Последние События (Логи)", // Новое
    noRecentLogs: "Нет недавних событий.", // Новое
  },
};
const t = translations.ru;

// --- Fallback Component ---
const ErrorOverlayFallback: React.FC<{ message: string, renderErrorMessage?: string }> = ({ message, renderErrorMessage }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/90 p-4 text-white font-mono">
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-yellow-300">{t.overlayCrashedTitle}</h2>
            <p className="text-lg mb-4">{t.overlayCrashedMessage}</p>
            {renderErrorMessage && (
                 <p className="text-sm bg-yellow-900/50 p-2 rounded mb-2">{t.overlayCrashedRenderError}: {renderErrorMessage}</p>
            )}
            <p className="text-sm bg-black/30 p-2 rounded">{t.overlayCrashedOriginalError}: {message || t.overlayCrashedNoMessage}</p>
            <p className="mt-4 text-xs">{t.overlayCrashedAdvice}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white text-black rounded font-semibold">{t.reloadButton}</button>
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
  // Safely access context
  let errorInfo: ErrorInfo | null = null;
  let setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>> = () => {};
  let showOverlay = false;
  let toastHistory: ToastRecord[] = [];
  let logHistory: LogRecord[] = []; // <-- Получаем историю логов
  try {
       const context = useErrorOverlay();
       errorInfo = context.errorInfo;
       setErrorInfo = context.setErrorInfo;
       showOverlay = context.showOverlay;
       toastHistory = context.toastHistory;
       logHistory = context.logHistory; // <-- Получаем историю логов
       // Логируем получение контекста самим логгером (это попадет в историю логов)
       logger.debug("[DevErrorOverlay] Context retrieved successfully.", { hasErrorInfo: !!errorInfo, toastCount: toastHistory.length, logCount: logHistory.length });
  } catch(contextError: any) {
       // Используем logger.fatal, который попытается записать и в консоль, и во внутренний лог
       logger.fatal(t.fatalContextError, contextError);
       // Возвращаем простой div, так как логгер уже записал ошибку
       return <div className="fixed inset-0 z-[100] bg-black text-red-500 p-4">{t.fatalContextError}</div>;
  }

  // Log received error info only once
  useEffect(() => {
    if (errorInfo) {
      logger.error("[DevErrorOverlay] Received errorInfo:", errorInfo);
    }
  }, [errorInfo]); // Зависит только от errorInfo

  // Main Component Logic Wrapped in try-catch
  try {
      if (!errorInfo || !showOverlay) {
        // logger.debug("[DevErrorOverlay] Render skipped (no error or overlay disabled)"); // Излишний лог
        return null;
      }
      // logger.debug("[DevErrorOverlay] Rendering error overlay"); // Излишний лог

      const handleClose = () => {
          try { setErrorInfo(null); } catch (e) { logger.error("[DevErrorOverlay] Error in setErrorInfo during handleClose:", e); }
      };

      const getShortStackTrace = (error?: Error | string | any): string => {
         try {
             if (!error) return t.stackTraceEmpty;
             let stack = '';
             if (error instanceof Error && error.stack) { stack = error.stack; }
             else if (typeof error === 'string') { stack = error.split('\\n').join('\n'); }
             else { try { stack = JSON.stringify(error, null, 2); } catch { stack = String(error); } }
             if (stack.trim() === '' && errorInfo?.message === 'Script error.') { return t.stackTraceUnavailable; }
             return stack.split('\n').slice(0, 8).join('\n') || t.stackTraceEmpty; // Slightly more lines
         } catch (e: any) { logger.error("[DevErrorOverlay] Error getting/formatting stack trace:", e); return `${t.stackTraceError}: ${e?.message ?? 'Unknown'}`; }
      };

      const prepareIssueAndCopyData = () => {
          try {
             const safeErrorInfo = errorInfo ?? { message: t.unknownError, type: 'unknown' };
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || t.unknownError;
             const shortStack = getShortStackTrace(safeErrorInfo.error);
             const source = safeErrorInfo.source ? ` (${safeErrorInfo.source}:${safeErrorInfo.lineno ?? '?'})` : '';
             const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest';

             const issueTitleOptions = [ `Сбой в Матрице: ${message.substring(0, 40)}...`, `Баг в Коде: ${errorType} ${message.substring(0, 35)}...`, `Аномалия: ${message.substring(0, 45)}...`, `Нужна Помощь: ${errorType} (${source || 'N/A'})`, `Глитч! ${errorType}: ${source || 'N/A'}`, ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);

             // Format Log History (Newest first, with level)
             const formattedLogHistory = logHistory.length > 0
                ? logHistory.slice().reverse().map(log => `- [${log.level.toUpperCase()}] ${new Date(log.timestamp).toLocaleTimeString('ru-RU',{hour12:false})} | ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`).join('\n') // Increased length
                : t.noRecentLogs;

            // Format Toast History (Newest first, with type)
             const formattedToastHistory = toastHistory.length > 0
                ? toastHistory.slice().reverse().map(th => `- [${th.type.toUpperCase()}] ${th.message.substring(0, 200)}${th.message.length > 200 ? '...' : ''}`).join('\n') // Increased length
                : t.noRecentToasts;

             const issueBody = encodeURIComponent(
`**Тип Ошибки:** ${errorType}
**Сообщение:** ${message}
**Источник:** ${source || 'N/A'}

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
`);
             const gitHubIssueUrl = `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;

             const copyPrompt =
`Йоу! Поймал ошибку в ${repoName}, помоги разгрести!

Ошибка (${errorType})${source}:
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
             sonnerToast.error(`${t.copyDataErrorToast}: ${e?.message ?? 'Unknown'}`);
             return { gitHubIssueUrl: `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest'}/issues/new`, copyPrompt: `Error generating copy data: ${e?.message}` };
         }
      };

      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyData();

      const handleCopyVibeRequest = () => {
         try {
             navigator.clipboard.writeText(copyPrompt)
               .then(() => { sonnerToast.success(t.copySuccessToast); })
               .catch(err => { logger.error("[DevErrorOverlay] Failed to copy vibe request:", err); sonnerToast.error(t.copyErrorToast); });
         } catch (e: any) { logger.error("[DevErrorOverlay] Error during copy action:", e); sonnerToast.error(`${t.copyGenericError}: ${e?.message ?? 'Unknown'}`); }
      };

      // Safely render parts
      const RenderSection: React.FC<{ title: string; children: () => React.ReactNode }> = ({ title, children }) => {
          try { return <>{children()}</>; }
          catch (e: any) { logger.error(`[DevErrorOverlay] Error rendering section "${title}":`, e); return <div className="text-red-500 border border-dashed border-red-600 p-2 my-2 rounded">Error rendering {title}: {e?.message ?? 'Unknown'}</div>; }
      };

      return (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          role="alertdialog" aria-modal="true" aria-labelledby="error-overlay-title" aria-describedby="error-overlay-description"
        >
          <div className="bg-gradient-to-br from-gray-900 via-indigo-950 to-black border border-cyan-500/30 rounded-lg shadow-2xl p-6 max-w-4xl w-full max-h-[95vh] flex flex-col text-gray-200 glitch-border-animate"> {/* Increased max-w and max-h */}

            {/* Header */}
             <RenderSection title="Header">
                 {() => (
                     <div className="flex items-center justify-between mb-4">
                       <h2 id="error-overlay-title" className="text-2xl font-bold text-cyan-300 flex items-center gap-2 glitch-text-shadow">
                          <FaTriangleExclamation className="text-yellow-400" /> {t.systemFailureTitle}
                       </h2>
                     </div>
                 )}
            </RenderSection>

            {/* Body */}
            <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-3 mb-4"> {/* Reduced gap slightly */}
                 <RenderSection title="Message">
                      {() => ( <p className="text-lg text-gray-100 font-semibold"> {(errorInfo?.message || t.unknownError).toString()} </p> )}
                 </RenderSection>
                 <RenderSection title="Source">
                      {() => errorInfo?.source && errorInfo.source !== 'N/A' ? (
                         <p className="text-sm text-purple-300 font-mono"> {t.sourceLabel}: {errorInfo.source} ({t.lineLabel}: {errorInfo.lineno ?? '?'}, {t.columnLabel}: {errorInfo.colno ?? '?'}) </p>
                      ) : null}
                 </RenderSection>
                 <RenderSection title="StackTrace">
                      {() => (
                          <details className="bg-black/30 p-3 rounded border border-gray-700/50">
                            <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200"> {t.stackTraceLabel} </summary>
                            <pre className="mt-2 text-xs text-gray-300/80 whitespace-pre-wrap break-words font-mono"> {getShortStackTrace(errorInfo?.error)} </pre>
                          </details>
                      )}
                 </RenderSection>

                 {/* --- Logs Section --- */}
                 <RenderSection title="RecentLogs">
                     {() => (
                         <details className="bg-black/40 p-3 rounded border border-gray-600/60" open={logHistory.length > 0}>
                             <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white"> {t.recentLogsTitle} ({logHistory.length}) </summary>
                             {logHistory.length > 0 ? (
                                 <ul className="mt-2 space-y-1.5 text-xs font-mono max-h-60 overflow-y-auto simple-scrollbar pr-1"> {/* Increased max-h */}
                                     {logHistory.slice().reverse().map((log) => ( // reverse() to show newest first
                                         <li key={log.id} className="flex items-start gap-2">
                                             <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" title={log.level.toUpperCase()}>{getLevelIcon(log.level)}</span>
                                             <span className={`flex-1 ${getLevelColor(log.level)}`}>
                                                 <span className="block break-words whitespace-pre-wrap">{log.message}</span> {/* Allow wrapping */}
                                                 <span className="block text-gray-500 text-[0.65rem] leading-tight opacity-80">
                                                    <FaRegClock className="inline mr-1 h-2.5 w-2.5" />
                                                    {formatDistanceToNow(log.timestamp, { addSuffix: true, locale: ru })} ({new Date(log.timestamp).toLocaleTimeString('ru-RU',{hour12:false})})
                                                 </span>
                                             </span>
                                         </li>
                                     ))}
                                 </ul>
                             ) : (
                                 <p className="mt-2 text-xs text-gray-500">{t.noRecentLogs}</p>
                             )}
                         </details>
                     )}
                 </RenderSection>

                 {/* --- Toasts Section --- */}
                 <RenderSection title="RecentToasts">
                     {() => (
                         <details className="bg-black/30 p-3 rounded border border-gray-700/50" open={toastHistory.length > 0}>
                             <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200"> {t.recentToastsTitle} ({toastHistory.length}) </summary>
                             {toastHistory.length > 0 ? (
                                 <ul className="mt-2 space-y-1 text-xs font-mono max-h-40 overflow-y-auto simple-scrollbar pr-1">
                                     {toastHistory.slice().reverse().map((toast) => (
                                         <li key={toast.id} className="flex items-start gap-2 text-gray-300/90">
                                             <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" title={toast.type.toUpperCase()}>{getLevelIcon(toast.type)}</span>
                                             <span className="flex-1 break-words">{toast.message}</span>
                                         </li>
                                     ))}
                                 </ul>
                             ) : (
                                 <p className="mt-2 text-xs text-gray-500">{t.noRecentToasts}</p>
                             )}
                         </details>
                     )}
                 </RenderSection>

                 <RenderSection title="Advice">
                      {() => (
                         <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded text-yellow-200 text-sm space-y-2">
                           <p className="font-semibold">{t.adviceTitle}</p>
                           <p>{t.adviceLine1}</p>
                           <ul className='list-disc list-inside space-y-1'>
                               <li> {t.adviceCopyAction} <button onClick={handleCopyVibeRequest} className="text-cyan-400 underline hover:text-cyan-300 px-1">{t.adviceCopyLink}</button> {t.adviceCopyDestination} (<a href="/repo-xml" className="text-cyan-400 underline hover:text-cyan-300">/repo-xml</a>). </li>
                               <li> {t.adviceGithubAction} <a href={gitHubIssueUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300"> {t.adviceGithubLink} <FaGithub className="inline ml-1 h-3 w-3" /> </a> {t.adviceGithubPrepared} </li>
                           </ul>
                         </div>
                      )}
                 </RenderSection>
            </div>

            {/* Footer with Buttons */}
            <RenderSection title="Footer">
                 {() => (
                     <div className="flex flex-col sm:flex-row justify-end items-center pt-4 border-t border-cyan-700/50 mt-auto gap-3">
                       <button onClick={handleClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-indigo-100 rounded-md text-sm font-semibold transition shadow hover:shadow-lg w-full sm:w-auto" aria-label={t.closeButton}> {t.closeButton} </button>
                     </div>
                 )}
            </RenderSection>

          </div>
        </div>
      );

    } catch (renderError: any) {
        // Используем logger здесь тоже, чтобы ошибка рендера оверлея попала в лог
        logger.fatal("[DevErrorOverlay] FATAL: Component failed to render!", { originalErrorInfo: errorInfo, overlayRenderError: renderError });
        // Fallback UI
        return <ErrorOverlayFallback message={errorInfo?.message || t.unknownError} renderErrorMessage={renderError?.message} />;
    }
};

export default DevErrorOverlay;