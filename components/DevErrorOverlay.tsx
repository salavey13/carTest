"use client";

import React from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext';
import { FaCopy, FaTriangleExclamation } from 'react-icons/fa6';
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
  const { errorInfo, setErrorInfo, showOverlay } = useErrorOverlay();

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

      const handleClose = () => {
         try {
             setErrorInfo(null);
         } catch (e) {
             logger.error("Error closing DevErrorOverlay:", e);
         }
      };

      // --- Safely get stack trace ---
      const getShortStackTrace = (error?: Error | string): string => {
         try {
             if (!error) return 'Нет стека вызовов.';
             let stack = '';
             if (error instanceof Error && error.stack) {
                 stack = error.stack;
             } else if (typeof error === 'string') {
                 stack = error.split('\\n').join('\n');
             } else {
                 stack = String(error);
             }
             return stack.split('\n').slice(0, 5).join('\n') || 'Стек вызовов пуст или недоступен.';
         } catch (e: any) {
              logger.error("Error getting stack trace in DevErrorOverlay:", e);
              return `Ошибка получения стека: ${e?.message ?? 'Неизвестно'}`;
         }
      };

      // --- Safely prepare copy text ---
      const handleCopyVibeRequest = () => {
         try {
             const errorType = errorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = errorInfo.message || 'Нет сообщения';
             const shortStack = getShortStackTrace(errorInfo.error); // Execute safely
             const source = errorInfo.source ? ` (${errorInfo.source}:${errorInfo.lineno ?? '?'})` : '';

             const prompt = `Йоу! Поймал ошибку в CyberVibe Studio, помоги разгрести!

Ошибка (${errorType})${source}:
${message}

Стек (начало):
\`\`\`
${shortStack}
\`\`\`

Задача: Проанализируй ошибку и стек. Предложи исправления кода или объясни причину.

Ссылка на студию для контекста: /repo-xml
`;

             navigator.clipboard.writeText(prompt)
               .then(() => {
                 toast.success("Vibe Запрос для фикса скопирован!");
               })
               .catch(err => {
                 logger.error("Failed to copy vibe request:", err);
                 toast.error("Не удалось скопировать запрос.");
               });
         } catch (e: any) {
             logger.error("Error preparing vibe request:", e);
             toast.error(`Не удалось подготовить запрос: ${e?.message ?? 'Неизвестно'}`);
         }
      };

      // --- Safely render parts ---
      const renderTitle = () => (
         <h2 id="error-overlay-title" className="text-2xl font-bold text-red-300 flex items-center gap-2">
            <FaExclamationTriangle className="text-red-400" />
            Ошибочка вышла!
         </h2>
      );

      const renderMessage = () => (
         <p className="text-lg text-red-200 font-semibold">
            {errorInfo.message || "Неизвестная ошибка"}
         </p>
      );

      const renderSource = () => (
         errorInfo.source ? (
            <p className="text-sm text-red-300 font-mono">
              Источник: {errorInfo.source} (строка: {errorInfo.lineno ?? '?'}, столбец: {errorInfo.colno ?? '?'})
            </p>
         ) : null
      );

       const renderStackTrace = () => (
           <details className="bg-red-950/50 p-3 rounded border border-red-700/50">
             <summary className="cursor-pointer text-sm font-medium text-red-300 hover:text-red-200">
               Технические детали (Stack Trace - начало)
             </summary>
             <pre className="mt-2 text-xs text-red-200/80 whitespace-pre-wrap break-words font-mono">
               {getShortStackTrace(errorInfo.error)}
             </pre>
           </details>
       );

      const renderAdvice = () => (
         <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded text-yellow-200 text-sm">
           <p className="font-semibold mb-1">🧘 Не паникуй, лови вайб!</p>
           <p>Ошибки - это часть пути к просветлению кода. Скопируй инфу и кидай боту (или мне) в <a href="/repo-xml" className="underline hover:text-yellow-100">CyberVibe Studio</a> – разберемся!</p>
         </div>
      );

      return (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="error-overlay-title"
          aria-describedby="error-overlay-description"
        >
          <div className="bg-gradient-to-br from-red-900 via-red-950 to-black border border-red-600/50 rounded-lg shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col text-red-100">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
               {/* Safely render title */}
               {(() => { try { return renderTitle(); } catch (e: any) { logger.error("Error rendering overlay title:", e); return <h2 className="text-red-500">Error Rendering Title</h2>; } })()}
            </div>

            {/* Body */}
            <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-4 mb-4">
                 {/* Safely render message */}
                 {(() => { try { return renderMessage(); } catch (e: any) { logger.error("Error rendering overlay message:", e); return <p className="text-red-500">Error Rendering Message: {e?.message}</p>; } })()}
                 {/* Safely render source */}
                 {(() => { try { return renderSource(); } catch (e: any) { logger.error("Error rendering overlay source:", e); return <p className="text-red-500">Error Rendering Source</p>; } })()}
                 {/* Safely render stack trace */}
                 {(() => { try { return renderStackTrace(); } catch (e: any) { logger.error("Error rendering overlay stack trace:", e); return <p className="text-red-500">Error Rendering Stack Trace</p>; } })()}
                 {/* Safely render advice */}
                 {(() => { try { return renderAdvice(); } catch (e: any) { logger.error("Error rendering overlay advice:", e); return <p className="text-red-500">Error Rendering Advice</p>; } })()}
            </div>

            {/* Footer with Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-red-700/50 mt-auto gap-3">
               <button
                  onClick={handleCopyVibeRequest}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-yellow-950 rounded-md text-sm font-semibold transition shadow hover:shadow-lg w-full sm:w-auto"
                  aria-label="Скопировать запрос на исправление ошибки"
               >
                   <FaCopy />
                   Скопировать Vibe Запрос
               </button>
               <button
                 onClick={handleClose}
                 className="px-4 py-2 bg-red-700 hover:bg-red-600 text-red-100 rounded-md text-sm font-semibold transition shadow hover:shadow-lg w-full sm:w-auto"
                 aria-label="Закрыть оверлей ошибки"
               >
                 Закрыть
               </button>
            </div>

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