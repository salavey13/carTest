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
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]);
  const [logHistory, setLogHistory] = useState<LogRecord[]>([]);
  // Read overlay enable flag ONCE on mount, default to true if not set or invalid
  const showOverlay = useMemo(() => {
       const flag = process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY;
       const enabled = flag === 'true';
       // Use console.log directly here as logger might not be initialized
       console.log(`[ErrorOverlayProvider] Dev Error Overlay ${enabled ? 'ENABLED' : 'DISABLED'} (NEXT_PUBLIC_ENABLE_DEV_OVERLAY=${flag})`);
       return enabled;
  }, []);


  // Функция добавления тоста
  const addToastToHistory = useCallback((record: Omit<ToastRecord, 'id'>) => {
    setToastHistory(prevHistory => {
        const newRecord: ToastRecord = { ...record, id: Date.now() + Math.random() };
        const nextHistory = [...prevHistory, newRecord];
        // Ensure limit is respected
        return nextHistory.length > MAX_TOAST_HISTORY ? nextHistory.slice(nextHistory.length - MAX_TOAST_HISTORY) : nextHistory;
    });
  }, []);

  // Функция добавления лога
  const addLogToHistory = useCallback<LogHandler>((level, message, timestamp) => {
    setLogHistory(prevHistory => {
        const newRecord: LogRecord = { level, message, timestamp, id: timestamp + Math.random() + '-log' };
        // console.debug(`[addLogToHistory] Adding: ${level} - ${message.substring(0, 30)}...`, newRecord.id); // Debug log add
        const nextHistory = [...prevHistory, newRecord];
        // Ensure limit is respected
        return nextHistory.length > MAX_LOG_HISTORY ? nextHistory.slice(nextHistory.length - MAX_LOG_HISTORY) : nextHistory;
    });
   }, []);

  // Связываем debugLogger с addLogToHistory
  useEffect(() => {
      // Логируем через сам логгер, чтобы это тоже попало в историю
      logger.setLogHandler(addLogToHistory);
      logger.log('[ErrorOverlayProvider] Logger handler initialized.');
      return () => {
        // Сбрасываем обработчик при размонтировании, чтобы избежать утечек
        logger.setLogHandler(null);
         // Используем console.log, т.к. logger уже может быть без обработчика
         console.log('[ErrorOverlayProvider] Logger handler cleared.');
      };
  }, [addLogToHistory]); // Зависимость от стабильной функции

  // Глобальные слушатели ошибок
  useEffect(() => {
    // Only attach listeners if the overlay is enabled
    if (!showOverlay) {
        logger.info("[ErrorOverlayProvider] Skipping global error listeners (overlay disabled).");
        return;
    }

    const handleError = (event: ErrorEvent) => {
        // Avoid generic script errors which provide no details
        if (event.message === 'Script error.' && !event.filename) {
            logger.warn("Global 'error' event ignored: Generic 'Script error.'", { msg: event.message });
            return;
        }
        // Avoid logging errors originating from the DevErrorOverlay component itself
        if (event.error && event.error.stack && event.error.stack.includes('DevErrorOverlay')) {
             logger.warn("Global 'error' event ignored: Originates from DevErrorOverlay.", { msg: event.message });
             return;
        }

        logger.error("Global 'error' event caught by ErrorOverlayContext:", { msg: event.message, file: event.filename, line: event.lineno, col: event.colno, errorObj: event.error });
        setErrorInfo({ message: event.message || 'Unknown error event', source: event.filename || 'N/A', lineno: event.lineno || undefined, colno: event.colno || undefined, error: event.error || event.message, // Store the error object
            type: 'error' });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
        // Avoid logging rejections originating from the DevErrorOverlay component itself
        if (event.reason instanceof Error && event.reason.stack && event.reason.stack.includes('DevErrorOverlay')) {
            logger.warn("Global 'unhandledrejection' event ignored: Originates from DevErrorOverlay.", { reason: event.reason });
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
        setErrorInfo({ message: message || "Unknown rejection reason", error: errorObject, // Store the reason object
            type: 'rejection' });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    logger.log("[ErrorOverlayProvider] Global error listeners attached."); // Log attach

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      logger.log("[ErrorOverlayProvider] Global error listeners removed."); // Log remove
    };
  }, [showOverlay]); // Only depends on showOverlay to attach/detach

  // Мемоизируем значение контекста
  const contextValue = useMemo(() => ({
    errorInfo, setErrorInfo, showOverlay,
    toastHistory, addToastToHistory,
    logHistory, addLogToHistory // Передаем новые поля
  }), [errorInfo, showOverlay, toastHistory, logHistory, addToastToHistory, addLogToHistory, setErrorInfo]); // Added setErrorInfo

  return (
    <ErrorOverlayContext.Provider value={contextValue}>
      {children}
    </ErrorOverlayContext.Provider>
  );
};

// Хук для использования контекста
export const useErrorOverlay = (): ErrorOverlayContextType => {
  const context = useContext(ErrorOverlayContext);
  if (context === undefined) {
    // Log critical error
    const error = new Error('useErrorOverlay must be used within an ErrorOverlayProvider');
    logger.fatal("FATAL:", error); // Use logger for fatal error
    // Provide a default fallback object to prevent immediate crashes in consumers,
    // although functionality will be broken.
    return {
        errorInfo: null,
        setErrorInfo: () => { console.error("setErrorInfo called on fallback context!"); }, // Log error on fallback call
        showOverlay: false,
        toastHistory: [],
        addToastToHistory: () => { console.error("addToastToHistory called on fallback context!"); }, // Log error on fallback call
        logHistory: [],
        addLogToHistory: () => { console.error("addLogToHistory called on fallback context!"); } // Log error on fallback call
    };
    // OR re-throw the error if preferred: throw error;
  }
  return context;
};

// Re-export Types
export type { ErrorInfo, LogRecord, ToastRecord, LogLevel }; // Экспортируем LogLevel