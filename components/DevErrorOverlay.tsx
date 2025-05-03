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

// --- i18n Translations (Keep as is) ---
const translations = {
  ru: { /* ... translations ... */ },
};
const t = translations.ru;

// --- Fallback Component (Keep as is) ---
const ErrorOverlayFallback: React.FC<{ message: string, renderErrorMessage?: string }> = ({ message, renderErrorMessage }) => (
    /* ... fallback component JSX ... */
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

// --- Icon Helpers (Keep as is) ---
const getLevelIcon = (level: LogLevel | ToastRecord['type']): React.ReactElement => { /* ... */ };
const getLevelColor = (level: LogLevel | ToastRecord['type']): string => { /* ... */ };

// --- Main Overlay Component ---
const DevErrorOverlay: React.FC = () => {
  logger.log("[DevErrorOverlay] START Render");
  const [internalRenderError, setInternalRenderError] = useState<Error | null>(null);

  // --- Use the hook - it now handles the undefined case internally ---
  const {
      errorInfo,
      setErrorInfo,
      showOverlay,
      toastHistory,
      logHistory
  } = useErrorOverlay();
  // No need for complex availability checks here anymore, hook guarantees a return value

  // Log received error info only once when it appears
  useEffect(() => {
    if (errorInfo && showOverlay) {
      logger.info("[DevErrorOverlay] Received errorInfo from context:", {
          type: errorInfo.type,
          message: errorInfo.message?.substring(0, 100) + "...", // Log truncated message
          source: errorInfo.source,
      });
    }
  }, [errorInfo, showOverlay]);

  // --- Render Fallback if internal rendering error occurs ---
  if (internalRenderError) {
     logger.fatal("[DevErrorOverlay] FATAL: Component failed during its own render!", { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     console.error("[DevErrorOverlay] FATAL: Component failed to render!", { originalErrorInfo: errorInfo, overlayRenderError: internalRenderError });
     return <ErrorOverlayFallback message={errorInfo?.message || t.unknownError} renderErrorMessage={internalRenderError.message} />;
  }

  // --- Main Component Logic (Try-Catch for Render) ---
  try {
      // --- Condition to Render ---
      if (!errorInfo || !showOverlay) {
        return null; // Don't render if no error or hidden
      }
      logger.log("[DevErrorOverlay] Conditions met, rendering overlay UI...");

      // --- Event Handlers (setErrorInfo is now guaranteed to be a function) ---
      const handleClose = () => {
          logger.log("[DevErrorOverlay] Close button clicked.");
          try {
              setErrorInfo(null); // Call the function from the hook
              logger.info("[DevErrorOverlay] ErrorInfo cleared via context.");
          } catch (e) {
              logger.error("[DevErrorOverlay] Error calling setErrorInfo(null) during handleClose:", e);
              console.error("[DevErrorOverlay] Error in setErrorInfo during handleClose:", e);
          }
      };

      // --- Helper to safely get stack trace ---
      const getShortStackTraceSafe = (error?: Error | string | any): string => {
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
              logger.error("[DevErrorOverlay] Error getting/formatting stack trace:", e);
              console.error("[DevErrorOverlay] Error getting/formatting stack trace:", e);
              return `${t.stackTraceError}: ${e?.message ?? 'Unknown'}`;
          }
      };

      // --- Helper to prepare data (with internal try-catch) ---
      const prepareIssueAndCopyDataSafe = () => {
          try {
             const safeErrorInfo = errorInfo as ErrorInfo; // Safe due to outer check
             const errorType = safeErrorInfo.type?.toUpperCase() || 'UNKNOWN';
             const message = safeErrorInfo.message || t.unknownError;
             const shortStack = getShortStackTraceSafe(safeErrorInfo.error);
             const source = safeErrorInfo.source ? `${safeErrorInfo.source}:${safeErrorInfo.lineno ?? '?'}` : 'N/A';
             const repoOrg = process.env.NEXT_PUBLIC_GITHUB_ORG || 'salavey13';
             const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO || 'carTest';
             const issueTitleOptions = [ `Сбой в Матрице: ${message.substring(0, 40)}...`, `Баг в Коде: ${errorType} ${message.substring(0, 35)}...`, /* ... other options ... */ ];
             const issueTitle = encodeURIComponent(issueTitleOptions[Math.floor(Math.random() * issueTitleOptions.length)]);
             // Use logHistory and toastHistory directly (guaranteed to be arrays by the hook)
             const formattedLogHistory = logHistory.length > 0 ? logHistory.slice().reverse().map(/* ... */).join('\n') : t.noRecentLogs;
             const formattedToastHistory = toastHistory.length > 0 ? toastHistory.slice().reverse().map(/* ... */).join('\n') : t.noRecentToasts;
             const issueBodyContent = `**Тип Ошибки:** ${errorType}\n**Сообщение:** ${message}\n**Источник:** ${source}\n\n**Стек (начало):**\n\`\`\`\n${shortStack}\n\`\`\`\n\n**Последние События (Логи):**\n${formattedLogHistory}\n\n**Недавние Уведомления (Тосты):**\n${formattedToastHistory}\n\n**Контекст/Шаги:**\n[Опиши, что ты делал(а), когда это случилось]\n`;
             const issueBody = encodeURIComponent(issueBodyContent);
             const gitHubIssueUrl = `https://github.com/${repoOrg}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;
             const copyPrompt = `Йоу! Поймал ошибку...`; // (Keep the rest of the prompt generation)
             return { gitHubIssueUrl, copyPrompt };
         } catch (e: any) {
             logger.error("[DevErrorOverlay] Error preparing issue/copy data:", e);
             sonnerToast.error(`${t.copyDataErrorToast}: ${e?.message ?? 'Unknown'}`);
             return { gitHubIssueUrl: `https://github.com/.../issues/new`, copyPrompt: `Error generating copy data: ${e?.message}` };
         }
      };
      const { gitHubIssueUrl, copyPrompt } = prepareIssueAndCopyDataSafe();

      // --- Handle Copy Action ---
      const handleCopyVibeRequest = () => { /* ... copy logic ... */ };

      // --- Safe Render Helper ---
      const RenderSection: React.FC<{ title: string; children: () => React.ReactNode }> = ({ title, children }) => { /* ... */ };

      // --- JSX Return (Keep as is) ---
      return (
        <div /* ... main container ... */ >
          <div /* ... content container ... */ >
            <RenderSection title="Header">
                 {/* ... header content ... */}
            </RenderSection>
            <div id="error-overlay-description" /* ... scrollable body ... */ >
                 <RenderSection title="Message">
                      {/* ... message display ... */}
                 </RenderSection>
                 <RenderSection title="Source">
                      {/* ... source display ... */}
                 </RenderSection>
                 <RenderSection title="StackTrace">
                     {/* ... stack trace display ... */}
                 </RenderSection>
                 <RenderSection title="RecentLogs">
                     {/* ... logs display ... */}
                 </RenderSection>
                 <RenderSection title="RecentToasts">
                     {/* ... toasts display ... */}
                 </RenderSection>
                 <RenderSection title="Advice">
                      {/* ... advice display ... */}
                 </RenderSection>
            </div>
            <RenderSection title="Footer">
                 {/* ... footer content ... */}
                 {() => ( <div className="flex flex-col sm:flex-row justify-end items-center pt-4 border-t border-cyan-700/50 mt-auto gap-3 flex-shrink-0"> <button onClick={handleClose} /* ... */ > {t.closeButton} </button> </div> )}
            </RenderSection>
          </div>
        </div>
      );
      // --- End JSX Return ---

  } catch (renderError: any) {
      logger.fatal("[DevErrorOverlay] CRITICAL: Failed during main UI render execution!", renderError);
      console.error("[DevErrorOverlay] CRITICAL: Failed during main render execution!", renderError);
      setInternalRenderError(renderError);
      return null;
  } finally {
       logger.log("[DevErrorOverlay] END Render");
  }
};

export default DevErrorOverlay;