"use client";

import React from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext';
import { FaCopy, FaTriangleExclamation, FaGithub, FaRegClock, FaCircleInfo, FaCircleCheck, FaCircleXmark } from 'react-icons/fa6'; // Corrected icon, added more for toasts
import { toast as sonnerToast } from 'sonner'; // Use direct import for overlay's own toasts
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ToastRecord } from '@/types/toast'; // Import toast record type
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale'; // Import Russian locale for date-fns

// --- i18n ---
// Simple structure for this component's translations
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
    recentToastsTitle: "Недавние Уведомления",
    noRecentToasts: "Нет недавних уведомлений.",
  },
  // Add 'en' or other languages later if needed
};
const t = translations.ru; // Using Russian for now

// --- Simple Fallback Component ---
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

// --- Helper to get Toast Icon ---
const getToastIcon = (type: string): React.ReactElement => {
    switch (type.toLowerCase()) {
        case 'success': return <FaCircleCheck className="text-green-400" />;
        case 'error': return <FaCircleXmark className="text-red-400" />;
        case 'warning': return <FaTriangleExclamation className="text-yellow-400" />;
        case 'info': return <FaCircleInfo className="text-blue-400" />;
        default: return <FaCircleInfo className="text-gray-400" />; // Default/loading etc.
    }
};


const DevErrorOverlay: React.FC = () => {
  // --- Safely access context ---
  let errorInfo: ErrorInfo | null = null;
  let setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>> = () => {};
  let showOverlay = false;
  let toastHistory: ToastRecord[] = []; // Default empty array
  try {
       const context = useErrorOverlay();
       errorInfo = context.errorInfo;
       setErrorInfo = context.setErrorInfo;
       showOverlay = context.showOverlay;
       toastHistory = context.toastHistory; // Get toast history
  } catch(contextError: any) {
       logger.fatal(t.fatalContextError, contextError);
       // Cannot render fallback here as we are outside the main try-catch
       return <div className="fixed inset-0 z-[100] bg-black text-red-500 p-4">{t.fatalContextError}</div>;
  }


  React.useEffect(() => {
    if (errorInfo) {
      logger.error("DevErrorOverlay received errorInfo:", errorInfo);
      // logger.debug("Toast history at time of error:", toastHistory); // Optional: Log history when error appears
    }
  }, [errorInfo]); // Removed toastHistory dependency, only log when error changes

  // --- Main Component Logic Wrapped in try-catch ---
  try {
      if (!errorInfo || !showOverlay) {
        return null;
      }

      // --- Safe event handlers ---
      const handleClose = () => {
         try {
             setErrorInfo(null);
         } catch (e) {
             logger.error("Error in setErrorInfo during handleClose:", e);
         }
      };

      const getShortStackTrace = (error?: Error | string | any): string => {
         try {
             if (!error) return t.stackTraceEmpty;
             let stack = '';
             if (error instanceof Error && error.stack) {
                 stack = error.stack;
             } else if (typeof error === 'string') {
                 // Handle potential literal '\n' if error was stringified somewhere
                 stack = error.split('\\n').join('\n');
             } else {
                  try { stack = JSON.stringify(error, null, 2); }
                  catch { stack = String(error); }
             }
             // Basic check for 'Script error.' - should be redundant now due to context filtering
             if (stack.trim() === '' && errorInfo?.message === 'Script error.') {
                 return t.stackTraceUnavailable;
             }
             return stack.split('\n').slice(0, 5).join('\n') || t.stackTraceEmpty;
         } catch (e: any) {
              logger.error("Error getting/formatting stack trace in DevErrorOverlay:", e);
              return `${t.stackTraceError}: ${e?.message ?? 'Unknown'}`;
         }
      };

      // --- Safely prepare GitHub issue link & copy text ---
      const prepareIssueAndCopyData = () => {
          try {
             const safeErrorInfo = errorInfo ?? { message: t.unknownError, type: 'unknown' };
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || t.unknownError;
             const shortStack = getShortStackTrace(safeErrorInfo.error);
             const source = safeErrorInfo.source ? ` (${safeErrorInfo.source}:${safeErrorInfo.lineno ?? '?'})` : '';
             const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO || 'oneSitePls'; // Use env var or default

             const issueTitleOptions = [
                 `Сбой в Матрице: ${message.substring(0, 40)}...`,
                 `Баг в Коде: ${errorType} ${message.substring(0, 35)}...`,
                 `Аномалия: ${message.substring(0, 45)}...`,
                 `Нужна Помощь: ${errorType} (${source || 'N/A'})`,
                 `Глитч! ${errorType}: ${source || 'N/A'}`,
             ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);

             // --- Add Toast History to GitHub Body and Copy Prompt ---
             const formattedToastHistory = toastHistory.length > 0
                ? toastHistory.slice().reverse().map(th => `- [${th.type.toUpperCase()}] ${formatDistanceToNow(th.timestamp, { addSuffix: true, locale: ru })}: ${th.message.substring(0, 100)}${th.message.length > 100 ? '...' : ''}`).join('\n')
                : t.noRecentToasts;

             const issueBody = encodeURIComponent(`**Тип Ошибки:** ${errorType}\n**Сообщение:** ${message}\n**Источник:** ${source || 'N/A'}\n\n**Стек (начало):**\n\`\`\`\n${shortStack}\n\`\`\`\n\n**Недавние Уведомления:**\n${formattedToastHistory}\n\n**Контекст/Шаги:**\n[Опиши, что ты делал(а), когда это случилось]\n`);
             const gitHubIssueUrl = `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;


             const copyPrompt = `Йоу! Поймал ошибку в oneSitePls, помоги разгрести!

Ошибка (${errorType})${source}:
${message}

Стек (начало):
\`\`\`
${shortStack}
\`\`\`

Недавние уведомления:
${formattedToastHistory}

Задача: Проанализируй ошибку, стек и недавние уведомления. Предложи исправления кода или объясни причину.`;
             return { gitHubIssueUrl, copyPrompt };
         } catch (e: any) {
             logger.error("Error preparing issue/copy data:", e);
             // Use sonnerToast directly here!
             sonnerToast.error(`${t.copyDataErrorToast}: ${e?.message ?? 'Unknown'}`);
             return { gitHubIssueUrl: `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13'}/${process.env.NEXT_PUBLIC_GITHUB_REPO || 'oneSitePls'}/issues/new`, copyPrompt: `Error generating copy data: ${e?.message}` };
         }
      };

      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyData();

      const handleCopyVibeRequest = () => {
         try {
             navigator.clipboard.writeText(copyPrompt)
               .then(() => {
                 // Use sonnerToast directly here!
                 sonnerToast.success(t.copySuccessToast);
               })
               .catch(err => {
                 logger.error("Failed to copy vibe request:", err);
                 // Use sonnerToast directly here!
                 sonnerToast.error(t.copyErrorToast);
               });
         } catch (e: any) {
             logger.error("Error during copy action:", e);
             // Use sonnerToast directly here!
             sonnerToast.error(`${t.copyGenericError}: ${e?.message ?? 'Unknown'}`);
         }
      };

      // --- Safely render parts ---
      const RenderSection: React.FC<{ title: string; children: () => React.ReactNode }> = ({ title, children }) => {
          try {
              return <>{children()}</>;
          } catch (e: any) {
              logger.error(`Error rendering overlay section "${title}":`, e);
              return <div className="text-red-500 border border-dashed border-red-600 p-2 my-2 rounded">Error rendering {title}: {e?.message ?? 'Unknown'}</div>;
          }
      };

      return (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="error-overlay-title"
          aria-describedby="error-overlay-description"
        >
          <div className="bg-gradient-to-br from-gray-900 via-indigo-950 to-black border border-cyan-500/30 rounded-lg shadow-2xl p-6 max-w-3xl w-full max-h-[90vh] flex flex-col text-gray-200 glitch-border-animate">

            {/* Header */}
             <RenderSection title="Header">
                 {() => (
                     <div className="flex items-center justify-between mb-4">
                       <h2 id="error-overlay-title" className="text-2xl font-bold text-cyan-300 flex items-center gap-2 glitch-text-shadow">
                          <FaTriangleExclamation className="text-yellow-400" />
                          {t.systemFailureTitle}
                       </h2>
                     </div>
                 )}
            </RenderSection>

            {/* Body */}
            <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-4 mb-4">
                 <RenderSection title="Message">
                      {() => (
                          <p className="text-lg text-gray-100 font-semibold">
                             {(errorInfo?.message || t.unknownError).toString()}
                          </p>
                      )}
                 </RenderSection>
                 <RenderSection title="Source">
                      {() => errorInfo?.source && errorInfo.source !== 'N/A' ? ( // Check source is not N/A
                         <p className="text-sm text-purple-300 font-mono">
                           {t.sourceLabel}: {errorInfo.source} ({t.lineLabel}: {errorInfo.lineno ?? '?'}, {t.columnLabel}: {errorInfo.colno ?? '?'})
                         </p>
                      ) : null}
                 </RenderSection>
                 <RenderSection title="StackTrace">
                      {() => (
                          <details className="bg-black/30 p-3 rounded border border-gray-700/50">
                            <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200">
                              {t.stackTraceLabel}
                            </summary>
                            <pre className="mt-2 text-xs text-gray-300/80 whitespace-pre-wrap break-words font-mono">
                              {getShortStackTrace(errorInfo?.error)}
                            </pre>
                          </details>
                      )}
                 </RenderSection>

                 {/* --- NEW: Recent Toasts Section --- */}
                 <RenderSection title="RecentToasts">
                     {() => (
                         <details className="bg-black/30 p-3 rounded border border-gray-700/50" open={toastHistory.length > 0}>
                             <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200">
                                 {t.recentToastsTitle} ({toastHistory.length})
                             </summary>
                             {toastHistory.length > 0 ? (
                                 <ul className="mt-2 space-y-1 text-xs font-mono">
                                     {toastHistory.slice().reverse().map((toast) => ( // Show newest first
                                         <li key={toast.id} className="flex items-start gap-2 text-gray-300/90">
                                             <span className="mt-0.5">{getToastIcon(toast.type)}</span>
                                             <span className="flex-1">
                                                 <span className="block break-words">{toast.message}</span>
                                                 <span className="block text-gray-500 text-[0.65rem] leading-tight">
                                                     <FaRegClock className="inline mr-1 h-2.5 w-2.5" />
                                                     {formatDistanceToNow(toast.timestamp, { addSuffix: true, locale: ru })}
                                                 </span>
                                             </span>
                                         </li>
                                     ))}
                                 </ul>
                             ) : (
                                 <p className="mt-2 text-xs text-gray-500">{t.noRecentToasts}</p>
                             )}
                         </details>
                     )}
                 </RenderSection>
                 {/* --- End of Recent Toasts Section --- */}

                 <RenderSection title="Advice">
                      {() => (
                         <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded text-yellow-200 text-sm space-y-2">
                           <p className="font-semibold">{t.adviceTitle}</p>
                           <p>{t.adviceLine1}</p>
                           <ul className='list-disc list-inside space-y-1'>
                               <li>
                                  {t.adviceCopyAction} <button onClick={handleCopyVibeRequest} className="text-cyan-400 underline hover:text-cyan-300 px-1">{t.adviceCopyLink}</button> {t.adviceCopyDestination} (<a href="/repo-xml" className="text-cyan-400 underline hover:text-cyan-300">/repo-xml</a>).
                               </li>
                               <li>
                                   {t.adviceGithubAction} <a
                                       href={gitHubIssueUrl}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="text-cyan-400 underline hover:text-cyan-300"
                                    >
                                       {t.adviceGithubLink} <FaGithub className="inline ml-1 h-3 w-3" />
                                    </a> {t.adviceGithubPrepared}
                               </li>
                           </ul>
                         </div>
                      )}
                 </RenderSection>
            </div>

            {/* Footer with Buttons */}
            <RenderSection title="Footer">
                 {() => (
                     <div className="flex flex-col sm:flex-row justify-end items-center pt-4 border-t border-cyan-700/50 mt-auto gap-3">
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

          </div>
        </div>
      );

    } catch (renderError: any) {
        logger.fatal("FATAL: DevErrorOverlay component itself failed to render!", {
             originalErrorInfo: errorInfo,
             overlayRenderError: renderError
        });
        return <ErrorOverlayFallback
                    message={errorInfo?.message || t.unknownError}
                    renderErrorMessage={renderError?.message}
                />;
    }
};

export default DevErrorOverlay;