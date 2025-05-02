"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ToastRecord } from '@/types/toast';
import type { LogHandler, LogLevel } from '@/lib/debugLogger'; // Импортируем типы из логгера

const MAX_TOAST_HISTORY = 50;
const MAX_LOG_HISTORY = 250; // Increased log limit

// Тип для записей лога
export interface LogRecord {
  id: number | string;
  level: LogLevel;
  message: string;
  timestamp: number;
}

// Тип для информации об ошибке
export interface ErrorInfo {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: Error | string | any; // Store the original error/reason object
  type: 'error' | 'rejection' | 'react'; // Type of error source
}

// Форма контекста
interface ErrorOverlayContextType {
  errorInfo: ErrorInfo | null;
  setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>>;
  showOverlay: boolean;
  toastHistory: ToastRecord[];
  addToastToHistory: (record: Omit<ToastRecord, 'id'>) => void;
  logHistory: LogRecord[];
  addLogToHistory: LogHandler; // Используем тип LogHandler
}

// Создаем контекст
const ErrorOverlayContext = createContext<ErrorOverlayContextType | undefined>(undefined);

// Создаем провайдер
export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logger.log("[ErrorOverlayProvider] Initializing..."); // Log initialization start
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]);
  const [logHistory, setLogHistory] = useState<LogRecord[]>([]);
  // Read overlay enable flag ONCE on mount, default to true if not set or invalid
  const showOverlay = useMemo(() => {
       const flag = process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY;
       const enabled = flag === 'true';
       // Use console.log directly here as logger might not be initialized yet
       console.log(`[ErrorOverlayProvider] Dev Error Overlay ${enabled ? 'ENABLED' : 'DISABLED'} (NEXT_PUBLIC_ENABLE_DEV_OVERLAY=${flag})`);
       return enabled;
  }, []);
  logger.debug("[ErrorOverlayProvider] State initialized."); // Log state init end

  // Функция добавления тоста
  const addToastToHistory = useCallback((record: Omit<ToastRecord, 'id'>) => {
    logger.debug(`[ErrorOverlayProvider] addToastToHistory called`, record);
    setToastHistory(prevHistory => {
        const newRecord: ToastRecord = { ...record, id: Date.now() + Math.random() };
        const nextHistory = [...prevHistory, newRecord];
        // Ensure limit is respected
        return nextHistory.length > MAX_TOAST_HISTORY ? nextHistory.slice(nextHistory.length - MAX_TOAST_HISTORY) : nextHistory;
    });
  }, []);

  // Функция добавления лога
  const addLogToHistory = useCallback<LogHandler>((level, message, timestamp) => {
    // Avoid logging the log addition itself unless absolutely needed for debugging loops
    // logger.debug(`[ErrorOverlayProvider] addLogToHistory called`, { level, message: message.substring(0,30) });
    setLogHistory(prevHistory => {
        const newRecord: LogRecord = { level, message, timestamp, id: timestamp + Math.random() + '-log' };
        const nextHistory = [...prevHistory, newRecord];
        // Ensure limit is respected
        return nextHistory.length > MAX_LOG_HISTORY ? nextHistory.slice(nextHistory.length - MAX_LOG_HISTORY) : nextHistory;
    });
   }, []);

  // Связываем debugLogger с addLogToHistory
  useEffect(() => {
      // Логируем через сам логгер, чтобы это тоже попало в историю
      logger.log('[ErrorOverlayProvider Effect] Setting logger handler.');
      logger.setLogHandler(addLogToHistory);
      logger.log('[ErrorOverlayProvider Effect] Logger handler initialized and set.');
      return () => {
        // Сбрасываем обработчик при размонтировании, чтобы избежать утечек
        logger.log('[ErrorOverlayProvider Effect] Clearing logger handler.');
        logger.setLogHandler(null);
         // Используем console.log, т.к. logger уже может быть без обработчика
         console.log('[ErrorOverlayProvider Effect Cleanup] Logger handler cleared.');
      };
  }, [addLogToHistory]); // Зависимость от стабильной функции

  // Глобальные слушатели ошибок
  useEffect(() => {
    // Only attach listeners if the overlay is enabled
    if (!showOverlay) {
        logger.info("[ErrorOverlayProvider Effect] Skipping global error listeners (overlay disabled).");
        return;
    }

    logger.debug("[ErrorOverlayProvider Effect] Attaching global error listeners...");

    const handleError = (event: ErrorEvent) => {
        logger.debug("[Global Error Listener] 'error' event received", event);
        if (event.message === 'Script error.' && !event.filename) {
            logger.warn("Global 'error' event ignored: Generic 'Script error.'", { msg: event.message });
            return;
        }
        if (event.error && event.error.stack && event.error.stack.includes('DevErrorOverlay')) {
             logger.warn("Global 'error' event ignored: Originates from DevErrorOverlay.", { msg: event.message });
             return;
        }
        // Avoid error loop if setErrorInfo itself causes an error (less likely but possible)
        if (event.error && event.error.stack && event.error.stack.includes('ErrorOverlayContext')) {
            logger.fatal("Global 'error' event ignored: Likely loop originating from ErrorOverlayContext itself.", { msg: event.message, error: event.error });
            return;
        }

        logger.error("Global 'error' event caught by ErrorOverlayContext:", { msg: event.message, file: event.filename, line: event.lineno, col: event.colno, errorObj: event.error });
        setErrorInfo({ message: event.message || 'Unknown error event', source: event.filename || 'N/A', lineno: event.lineno || undefined, colno: event.colno || undefined, error: event.error || event.message,
            type: 'error' });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
        logger.debug("[Global Error Listener] 'unhandledrejection' event received", event);
        if (event.reason instanceof Error && event.reason.stack && event.reason.stack.includes('DevErrorOverlay')) {
            logger.warn("Global 'unhandledrejection' event ignored: Originates from DevErrorOverlay.", { reason: event.reason });
            return;
        }
        // Avoid error loop if setErrorInfo itself causes a rejection
        if (event.reason instanceof Error && event.reason.stack && event.reason.stack.includes('ErrorOverlayContext')) {
             logger.fatal("Global 'unhandledrejection' event ignored: Likely loop originating from ErrorOverlayContext itself.", { reason: event.reason });
             return;
        }

        logger.error("Global 'unhandledrejection' event caught by ErrorOverlayContext:", { reason: event.reason });
        let message = 'Unhandled promise rejection';
        let errorObject: any = event.reason;
        try {
            if (event.reason instanceof Error) message = event.reason.message;
            else if (typeof event.reason === 'string') message = event.reason;
            else if (event.reason && typeof event.reason.message === 'string') message = event.reason.message;
            else { try { message = JSON.stringify(event.reason); } catch { message = 'Unhandled promise rejection with non-serializable reason'; } }
        } catch (e) { message = "Error processing rejection reason itself."; }
        setErrorInfo({ message: message || "Unknown rejection reason", error: errorObject,
            type: 'rejection' });
    };

    try {
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        logger.log("[ErrorOverlayProvider Effect] Global error listeners attached successfully.");
    } catch (attachError) {
        logger.fatal("[ErrorOverlayProvider Effect] FAILED TO ATTACH global error listeners:", attachError);
    }


    return () => {
      logger.debug("[ErrorOverlayProvider Effect Cleanup] Removing global error listeners...");
      try {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleRejection);
        logger.log("[ErrorOverlayProvider Effect Cleanup] Global error listeners removed successfully.");
      } catch (removeError) {
         logger.error("[ErrorOverlayProvider Effect Cleanup] Error removing global error listeners:", removeError);
      }
    };
  }, [showOverlay]); // Only depends on showOverlay to attach/detach

  // Мемоизируем значение контекста
  const contextValue = useMemo(() => {
    logger.debug("[ErrorOverlayProvider] Memoizing context value...");
    return {
        errorInfo, setErrorInfo, showOverlay,
        toastHistory, addToastToHistory,
        logHistory, addLogToHistory
    };
   }, [errorInfo, showOverlay, toastHistory, logHistory, addToastToHistory, addLogToHistory, setErrorInfo]); // Added setErrorInfo dependency

  logger.log("[ErrorOverlayProvider] Rendering Provider with value:", { showOverlay: contextValue.showOverlay, hasError: !!contextValue.errorInfo, logCount: contextValue.logHistory.length });
  return (
    <ErrorOverlayContext.Provider value={contextValue}>
      {children}
    </ErrorOverlayContext.Provider>
  );
};

// --- Fallback Context Object (for useErrorOverlay hook) ---
const fallbackErrorContext: ErrorOverlayContextType = {
    errorInfo: null,
    setErrorInfo: (info) => {
        console.error("[Fallback Context] setErrorInfo called! Error was likely thrown before context provider initialization.", info);
        // Optionally try to display a VERY basic alert
        // try { alert(`Critical Context Error: ${info instanceof Error ? info.message : JSON.stringify(info)}`); } catch {}
    },
    showOverlay: false, // Default to false, overlay likely won't work anyway
    toastHistory: [],
    addToastToHistory: (record) => {
        console.warn("[Fallback Context] addToastToHistory called! Toast suppressed.", record);
    },
    logHistory: [],
    addLogToHistory: (level, message, timestamp) => {
        // Log directly to console as the handler mechanism failed
        console.warn(`[Fallback Context Log][${level.toUpperCase()}] ${new Date(timestamp).toISOString()}: ${message}`);
    }
};


// Хук для использования контекста
export const useErrorOverlay = (): ErrorOverlayContextType => {
  const context = useContext(ErrorOverlayContext);
  if (context === undefined) {
    // Log critical error using console.error as logger might depend on this context
    console.error("FATAL: useErrorOverlay must be used within an ErrorOverlayProvider. Returning fallback context.");
    // Provide a default fallback object to prevent immediate crashes in consumers,
    // although functionality will be broken.
    return fallbackErrorContext;
  }
  return context;
};

// Re-export Types
export type { ErrorInfo, LogRecord, ToastRecord, LogLevel }; // Экспортируем LogLevel