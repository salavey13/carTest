"use client";

import React from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext';
import { FaCopy, FaTriangleExclamation, FaGithub } from 'react-icons/fa6'; // Corrected icon
import { toast } from 'sonner';
import { debugLogger as logger } from '@/lib/debugLogger';

// --- Simple Fallback Component ---
const ErrorOverlayFallback: React.FC<{ message: string, renderErrorMessage?: string }> = ({ message, renderErrorMessage }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/90 p-4 text-white font-mono">
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-yellow-300">🚧 DevErrorOverlay CRASHED! 🚧</h2>
            <p className="text-lg mb-4">Не удалось отрендерить сам оверлей ошибки.</p>
            {renderErrorMessage && (
                 <p className="text-sm bg-yellow-900/50 p-2 rounded mb-2">Ошибка рендера: {renderErrorMessage}</p>
            )}
            <p className="text-sm bg-black/30 p-2 rounded">Оригинальная ошибка (в консоли): {message || 'Нет сообщения'}</p>
            <p className="mt-4 text-xs">Проверь консоль и компонент DevErrorOverlay.</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white text-black rounded font-semibold">Перезагрузить</button>
        </div>
    </div>
);


const DevErrorOverlay: React.FC = () => {
  // --- Safely access context ---
  let errorInfo: ErrorInfo | null = null;
  let setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>> = () => {};
  let showOverlay = false;
  try {
       const context = useErrorOverlay();
       errorInfo = context.errorInfo;
       setErrorInfo = context.setErrorInfo;
       showOverlay = context.showOverlay;
  } catch(contextError: any) {
       logger.fatal("FATAL: Failed to get ErrorOverlayContext!", contextError);
       // Cannot render fallback here as we are outside the main try-catch
       return <div className="fixed inset-0 z-[100] bg-black text-red-500 p-4">FATAL: ErrorOverlayContext failed. Check console.</div>;
  }


  React.useEffect(() => {
    if (errorInfo) {
      logger.error("DevErrorOverlay received errorInfo:", errorInfo);
    }
  }, [errorInfo]);

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
             if (!error) return 'Нет стека вызовов.';
             let stack = '';
             if (error instanceof Error && error.stack) {
                 stack = error.stack;
             } else if (typeof error === 'string') {
                 stack = error.split('\\n').join('\n');
             } else {
                 // Attempt to stringify other types safely
                  try { stack = JSON.stringify(error, null, 2); }
                  catch { stack = String(error); }
             }
             // Basic check for 'Script error.' and return something more informative if no stack
             if (stack.trim() === '' && errorInfo?.message === 'Script error.') {
                 return 'Стек недоступен (вероятно, ошибка CORS или в стороннем скрипте).';
             }
             return stack.split('\n').slice(0, 5).join('\n') || 'Стек вызовов пуст или недоступен.';
         } catch (e: any) {
              logger.error("Error getting/formatting stack trace in DevErrorOverlay:", e);
              return `Ошибка получения стека: ${e?.message ?? 'Неизвестно'}`;
         }
      };

      // --- Safely prepare GitHub issue link & copy text ---
      const prepareIssueAndCopyData = () => {
          try {
             const safeErrorInfo = errorInfo ?? { message: 'Unknown error', type: 'unknown' }; // Fallback
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || 'Нет сообщения';
             const shortStack = getShortStackTrace(safeErrorInfo.error); // Execute safely
             const source = safeErrorInfo.source ? ` (${safeErrorInfo.source}:${safeErrorInfo.lineno ?? '?'})` : '';
             const repoName = 'carTest'; // <<< CORRECT REPO NAME

             // Creative Russian Title
             const issueTitleOptions = [
                 `Сбой в Матрице: ${message.substring(0, 40)}...`,
                 `Баг в Коде: ${errorType} ${message.substring(0, 35)}...`,
                 `Аномалия: ${message.substring(0, 45)}...`,
                 `Нужна Помощь: ${errorType} (${source || 'N/A'})`,
                 `Глитч! ${errorType}: ${source || 'N/A'}`,
             ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);

             const issueBody = encodeURIComponent(`**Тип Ошибки:** ${errorType}\n**Сообщение:** ${message}\n**Источник:** ${source || 'N/A'}\n\n**Стек (начало):**\n\`\`\`\n${shortStack}\n\`\`\`\n\n**Контекст/Шаги:**\n[Опиши, что ты делал(а), когда это случилось]\n`);
             const gitHubIssueUrl = `https://github.com/salavey13/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;

             const copyPrompt = `Йоу! Поймал ошибку в CyberVibe Studio, помоги разгрести!

Ошибка (${errorType})${source}:
${message}

Стек (начало):
\`\`\`
${shortStack}
\`\`\`

Задача: Проанализируй ошибку и стек. Предложи исправления кода или объясни причину.`;
             return { gitHubIssueUrl, copyPrompt };
         } catch (e: any) {
             logger.error("Error preparing issue/copy data:", e);
             toast.error(`Не удалось подготовить данные: ${e?.message ?? 'Неизвестно'}`);
             return { gitHubIssueUrl: `https://github.com/salavey13/carTest/issues/new`, copyPrompt: `Error generating copy data: ${e?.message}` };
         }
      };

      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyData();

      const handleCopyVibeRequest = () => {
         try {
             navigator.clipboard.writeText(copyPrompt)
               .then(() => {
                 toast.success("Vibe Запрос для фикса скопирован!");
               })
               .catch(err => {
                 logger.error("Failed to copy vibe request:", err);
                 toast.error("Не удалось скопировать запрос.");
               });
         } catch (e: any) {
             logger.error("Error during copy action:", e);
             toast.error(`Ошибка копирования: ${e?.message ?? 'Неизвестно'}`);
         }
      };

      // --- Safely render parts ---
      // Each section wrapped in its own try-catch for maximum resilience
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" // Slightly more blur
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="error-overlay-title"
          aria-describedby="error-overlay-description"
        >
          {/* Cyberpunk style container */}
          <div className="bg-gradient-to-br from-gray-900 via-indigo-950 to-black border border-cyan-500/30 rounded-lg shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col text-gray-200 glitch-border-animate">

            {/* Header */}
             <RenderSection title="Header">
                 {() => (
                     <div className="flex items-center justify-between mb-4">
                       <h2 id="error-overlay-title" className="text-2xl font-bold text-cyan-300 flex items-center gap-2 glitch-text-shadow"> {/* Glitchy text */}
                          <FaTriangleExclamation className="text-yellow-400" /> {/* Changed icon */}
                          Сбой системы...
                       </h2>
                     </div>
                 )}
            </RenderSection>

            {/* Body */}
            <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-4 mb-4">
                 <RenderSection title="Message">
                      {() => (
                          <p className="text-lg text-gray-100 font-semibold">
                             {(errorInfo?.message || "Неизвестная ошибка").toString()} {/* Ensure message is string */}
                          </p>
                      )}
                 </RenderSection>
                 <RenderSection title="Source">
                      {() => errorInfo?.source ? (
                         <p className="text-sm text-purple-300 font-mono">
                           Источник: {errorInfo.source} (строка: {errorInfo.lineno ?? '?'}, столбец: {errorInfo.colno ?? '?'})
                         </p>
                      ) : null}
                 </RenderSection>
                 <RenderSection title="StackTrace">
                      {() => (
                          <details className="bg-black/30 p-3 rounded border border-gray-700/50">
                            <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-200">
                              Технические артефакты (Stack Trace - начало)
                            </summary>
                            <pre className="mt-2 text-xs text-gray-300/80 whitespace-pre-wrap break-words font-mono">
                              {getShortStackTrace(errorInfo?.error)}
                            </pre>
                          </details>
                      )}
                 </RenderSection>
                 <RenderSection title="Advice">
                      {() => (
                         <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded text-yellow-200 text-sm space-y-2">
                           <p className="font-semibold">🤖 Матрица сбоит... но это не конец!</p>
                           <p>Помоги нам отладить реальность:</p>
                           <ul className='list-disc list-inside space-y-1'>
                               <li>
                                  Скопируй <button onClick={handleCopyVibeRequest} className="text-cyan-400 underline hover:text-cyan-300 px-1">Vibe Запрос</button> и закинь в CyberVibe Studio (<a href="/repo-xml" className="text-cyan-400 underline hover:text-cyan-300">/repo-xml</a>).
                               </li>
                               <li>
                                   Или <a
                                       href={gitHubIssueUrl} // Use prepared URL
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="text-cyan-400 underline hover:text-cyan-300"
                                    >
                                       создай Issue на GitHub <FaGithub className="inline ml-1 h-3 w-3" />
                                    </a> (данные подготовлены).
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
                        {/* Removed Copy button here as it's integrated into advice */}
                       <button
                         onClick={handleClose}
                         className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-indigo-100 rounded-md text-sm font-semibold transition shadow hover:shadow-lg w-full sm:w-auto" // Changed color
                         aria-label="Закрыть оверлей ошибки"
                       >
                         Закрыть
                       </button>
                     </div>
                 )}
            </RenderSection>

          </div>
        </div>
      );

    } catch (renderError: any) {
        // --- Fallback Rendering on Overlay Error ---
        logger.fatal("FATAL: DevErrorOverlay component itself failed to render!", {
             originalErrorInfo: errorInfo, // Log the error it was TRYING to display
             overlayRenderError: renderError // Log the error that happened DURING render
        });
        // Render the basic fallback
        return <ErrorOverlayFallback
                    message={errorInfo?.message || 'Unknown original error'}
                    renderErrorMessage={renderError?.message}
                />;
    }
};

export default DevErrorOverlay;