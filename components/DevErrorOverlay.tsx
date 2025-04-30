"use client";

import React from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext';
import { FaCopy, FaBug, FaExclamationTriangle } from 'react-icons/fa6'; // Using FaExclamationTriangle as standard warning/error icon
import { toast } from 'sonner';
import { debugLogger as logger } from '@/lib/debugLogger'; // Import logger

const DevErrorOverlay: React.FC = () => {
  const { errorInfo, setErrorInfo, showOverlay } = useErrorOverlay();

  // --- NEW: Effect to log error when it appears ---
  React.useEffect(() => {
    if (errorInfo) {
      logger.error("DevErrorOverlay displayed:", errorInfo);
    }
  }, [errorInfo]);

  if (!errorInfo || !showOverlay) {
    return null;
  }

  const handleClose = () => {
    setErrorInfo(null);
  };

  const getShortStackTrace = (error?: Error | string): string => {
    if (!error) return 'Нет стека вызовов.';
    let stack = '';
    if (error instanceof Error && error.stack) {
        stack = error.stack;
    } else if (typeof error === 'string') {
        stack = error; // If error is just a string (e.g., from rejection)
    }
    // Take first 5 lines or fewer if stack is shorter
    return stack.split('\n').slice(0, 5).join('\n') || 'Стек вызовов пуст или недоступен.';
  };

  const handleCopyVibeRequest = () => {
    const errorType = errorInfo.type?.toUpperCase() || 'UNKNOWN';
    const message = errorInfo.message || 'Нет сообщения';
    const shortStack = getShortStackTrace(errorInfo.error);
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
  };


  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="error-overlay-title"
      aria-describedby="error-overlay-description"
    >
      <div className="bg-gradient-to-br from-red-900 via-red-950 to-black border border-red-600/50 rounded-lg shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col text-red-100">

        <div className="flex items-center justify-between mb-4">
          <h2 id="error-overlay-title" className="text-2xl font-bold text-red-300 flex items-center gap-2">
             <FaExclamationTriangle className="text-red-400" />
             Ошибочка вышла!
          </h2>
          {/* Close button moved to bottom */}
        </div>

        <div id="error-overlay-description" className="flex-grow overflow-y-auto simple-scrollbar pr-2 space-y-4 mb-4">
          <p className="text-lg text-red-200 font-semibold">
            {errorInfo.message || "Неизвестная ошибка"}
          </p>

          {errorInfo.source && (
            <p className="text-sm text-red-300 font-mono">
              Источник: {errorInfo.source} (строка: {errorInfo.lineno ?? '?'}, столбец: {errorInfo.colno ?? '?'})
            </p>
          )}

          <details className="bg-red-950/50 p-3 rounded border border-red-700/50">
            <summary className="cursor-pointer text-sm font-medium text-red-300 hover:text-red-200">
              Технические детали (Stack Trace - начало)
            </summary>
            <pre className="mt-2 text-xs text-red-200/80 whitespace-pre-wrap break-words font-mono">
              {getShortStackTrace(errorInfo.error)}
            </pre>
          </details>

          <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded text-yellow-200 text-sm">
            <p className="font-semibold mb-1">🧘 Не паникуй, лови вайб!</p>
            <p>Ошибки - это часть пути к просветлению кода. Скопируй инфу и кидай боту (или мне) в <a href="/repo-xml" className="underline hover:text-yellow-100">CyberVibe Studio</a> – разберемся!</p>
          </div>
        </div>

        {/* Buttons at the bottom */}
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
};

export default DevErrorOverlay;