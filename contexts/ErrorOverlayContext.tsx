"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ToastRecord } from '@/types/toast';
import type { LogHandler, LogLevel } from '@/lib/debugLogger'; // Импортируем типы из логгера

const MAX_TOAST_HISTORY = 50;
const MAX_LOG_HISTORY = 200; // Увеличим лимит логов еще больше

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
  error?: Error | string | any;
  type: 'error' | 'rejection' | 'react';
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
  const showOverlay = process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY === 'true';

  // Функция добавления тоста
  const addToastToHistory = useCallback((record: Omit<ToastRecord, 'id'>) => {
    setToastHistory(prevHistory => {
        const newRecord: ToastRecord = { ...record, id: Date.now() + Math.random() };
        return [...prevHistory, newRecord].slice(-MAX_TOAST_HISTORY);
    });
  }, []);

  // Функция добавления лога
  const addLogToHistory = useCallback<LogHandler>((level, message, timestamp) => {
    setLogHistory(prevHistory => {
        const newRecord: LogRecord = { level, message, timestamp, id: timestamp + Math.random() + '-log' };
        return [...prevHistory, newRecord].slice(-MAX_LOG_HISTORY);
    });
   }, []);

  // Связываем debugLogger с addLogToHistory
  useEffect(() => {
      logger.setLogHandler(addLogToHistory);
      // Логируем через сам логгер, чтобы это тоже попало в историю
      logger.log('[ErrorOverlayProvider] Logger handler initialized.');
      return () => {
        // Сбрасываем обработчик при размонтировании, чтобы избежать утечек
        logger.setLogHandler(null);
         logger.log('[ErrorOverlayProvider] Logger handler cleared.');
      };
  }, [addLogToHistory]); // Зависимость от стабильной функции

  // Глобальные слушатели ошибок
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
        if (event.message === 'Script error.' && !event.filename) {
            logger.warn("Global 'error' event ignored: Generic 'Script error.'", { msg: event.message, file: event.filename });
            return;
        }
        logger.error("Global 'error' event caught:", { msg: event.message, file: event.filename, line: event.lineno, col: event.colno, errorObj: event.error });
        if (showOverlay) {
            setErrorInfo({ message: event.message || 'Unknown error event', source: event.filename || 'N/A', lineno: event.lineno || undefined, colno: event.colno || undefined, error: event.error || event.message, type: 'error' });
        }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
        logger.error("Global 'unhandledrejection' event caught:", { reason: event.reason });
        let message = 'Unhandled promise rejection';
        let errorObject: any = event.reason;
        try {
            if (event.reason instanceof Error) message = event.reason.message;
            else if (typeof event.reason === 'string') message = event.reason;
            else if (event.reason && typeof event.reason.message === 'string') message = event.reason.message;
            else { try { message = JSON.stringify(event.reason); } catch { message = 'Unhandled promise rejection with non-serializable reason'; } }
        } catch (e) { message = "Error processing rejection reason itself."; }
        if (showOverlay) { setErrorInfo({ message: message || "Unknown rejection reason", error: errorObject, type: 'rejection' }); }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [showOverlay]); // showOverlay - единственная реальная зависимость

  // Мемоизируем значение контекста
  const contextValue = useMemo(() => ({
    errorInfo, setErrorInfo, showOverlay,
    toastHistory, addToastToHistory,
    logHistory, addLogToHistory // Передаем новые поля
  }), [errorInfo, showOverlay, toastHistory, logHistory, addToastToHistory, addLogToHistory]);

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
    throw new Error('useErrorOverlay must be used within an ErrorOverlayProvider');
  }
  return context;
};

// Re-export Types
export type { ErrorInfo, LogRecord, ToastRecord, LogLevel }; // Экспортируем LogLevel