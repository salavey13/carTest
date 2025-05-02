"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ToastRecord } from '@/types/toast';
import type { LogHandler, LogLevel } from '@/lib/debugLogger';

const MAX_TOAST_HISTORY = 50;
const MAX_LOG_HISTORY = 250;

export interface LogRecord {
  id: number | string;
  level: LogLevel;
  message: string;
  timestamp: number;
}

export interface ErrorInfo {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: Error | string | any;
  type: 'error' | 'rejection' | 'react';
}

interface ErrorOverlayContextType {
  errorInfo: ErrorInfo | null;
  setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>>;
  showOverlay: boolean; // Keep this for potential future use, but always true now
  toastHistory: ToastRecord[];
  addToastToHistory: (record: Omit<ToastRecord, 'id'>) => void;
  logHistory: LogRecord[];
  addLogToHistory: LogHandler;
}

const ErrorOverlayContext = createContext<ErrorOverlayContextType | undefined>(undefined);

export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logger.log("[ErrorOverlayProvider] Initializing...");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]);
  const [logHistory, setLogHistory] = useState<LogRecord[]>([]);

  // --- REMOVED ENV VAR CHECK ---
  // Overlay and listeners are now always active for debugging purposes
  const showOverlay = true; // Always enabled
  useEffect(() => {
      // Use console.log as logger might not be fully ready
      console.log(`[ErrorOverlayProvider] Dev Overlay System ACTIVE.`);
  }, []);
  // ---------------------------

  logger.debug("[ErrorOverlayProvider] State initialized.");

  const addToastToHistory = useCallback((record: Omit<ToastRecord, 'id'>) => {
    logger.debug(`[ErrorOverlayProvider] addToastToHistory called`, record);
    setToastHistory(prevHistory => {
        const newRecord: ToastRecord = { ...record, id: Date.now() + Math.random() };
        const nextHistory = [...prevHistory, newRecord];
        return nextHistory.length > MAX_TOAST_HISTORY ? nextHistory.slice(nextHistory.length - MAX_TOAST_HISTORY) : nextHistory;
    });
  }, []);

  const addLogToHistory = useCallback<LogHandler>((level, message, timestamp) => {
    setLogHistory(prevHistory => {
        const newRecord: LogRecord = { level, message, timestamp, id: timestamp + Math.random() + '-log' };
        const nextHistory = [...prevHistory, newRecord];
        return nextHistory.length > MAX_LOG_HISTORY ? nextHistory.slice(nextHistory.length - MAX_LOG_HISTORY) : nextHistory;
    });
   }, []);

  useEffect(() => {
      logger.log('[ErrorOverlayProvider Effect] Setting logger handler.');
      logger.setLogHandler(addLogToHistory);
      logger.log('[ErrorOverlayProvider Effect] Logger handler initialized and set.');
      return () => {
        logger.log('[ErrorOverlayProvider Effect] Clearing logger handler.');
        logger.setLogHandler(null);
        console.log('[ErrorOverlayProvider Effect Cleanup] Logger handler cleared.');
      };
  }, [addLogToHistory]);

  // Глобальные слушатели ошибок (always active now)
  useEffect(() => {
    logger.debug("[ErrorOverlayProvider Effect] Attaching global event listeners...");

    const handleError = (event: ErrorEvent) => {
        logger.debug("[Global Event Listener] 'error' event received", event);
        if (event.message === 'Script error.' && !event.filename) {
            logger.warn("Global 'error' event ignored: Generic 'Script error.'", { msg: event.message });
            return;
        }
        if (event.error && event.error.stack && event.error.stack.includes('DevErrorOverlay')) {
             logger.warn("Global 'error' event ignored: Originates from DevErrorOverlay.", { msg: event.message });
             return;
        }
        if (event.error && event.error.stack && event.error.stack.includes('ErrorOverlayContext')) {
            logger.fatal("Global 'error' event ignored: Likely loop originating from ErrorOverlayContext itself.", { msg: event.message, error: event.error });
            return;
        }

        logger.error("Global 'error' event caught by ErrorOverlayContext:", { msg: event.message, file: event.filename, line: event.lineno, col: event.colno, errorObj: event.error });
        // Use functional update to be safe if multiple errors happen quickly
        setErrorInfo(prev => ({
             message: event.message || 'Unknown error event',
             source: event.filename || 'N/A',
             lineno: event.lineno || undefined,
             colno: event.colno || undefined,
             error: event.error || event.message,
             type: 'error'
         }));
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
        logger.debug("[Global Event Listener] 'unhandledrejection' event received", event);
        if (event.reason instanceof Error && event.reason.stack && event.reason.stack.includes('DevErrorOverlay')) {
            logger.warn("Global 'unhandledrejection' event ignored: Originates from DevErrorOverlay.", { reason: event.reason });
            return;
        }
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
        // Use functional update
        setErrorInfo(prev => ({
             message: message || "Unknown rejection reason",
             error: errorObject,
             type: 'rejection'
         }));
    };

    try {
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        logger.log("[ErrorOverlayProvider Effect] Global event listeners attached successfully.");
    } catch (attachError) {
        logger.fatal("[ErrorOverlayProvider Effect] FAILED TO ATTACH global event listeners:", attachError);
    }

    return () => {
      logger.debug("[ErrorOverlayProvider Effect Cleanup] Removing global event listeners...");
      try {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleRejection);
        logger.log("[ErrorOverlayProvider Effect Cleanup] Global event listeners removed successfully.");
      } catch (removeError) {
         logger.error("[ErrorOverlayProvider Effect Cleanup] Error removing global event listeners:", removeError);
      }
    };
  }, []); // No dependencies, always active

  const contextValue = useMemo(() => {
    logger.debug("[ErrorOverlayProvider] Memoizing context value...");
    return {
        errorInfo, setErrorInfo, showOverlay,
        toastHistory, addToastToHistory,
        logHistory, addLogToHistory
    };
   }, [errorInfo, showOverlay, toastHistory, logHistory, addToastToHistory, addLogToHistory, setErrorInfo]);

  logger.log("[ErrorOverlayProvider] Rendering Provider with value:", { showOverlay: contextValue.showOverlay, hasErrorInfo: !!contextValue.errorInfo, logCount: contextValue.logHistory.length });
  return (
    <ErrorOverlayContext.Provider value={contextValue}>
      {children}
    </ErrorOverlayContext.Provider>
  );
};

// Fallback context remains the same
const fallbackErrorContext: ErrorOverlayContextType = {
    errorInfo: null,
    setErrorInfo: (info) => { console.error("[Fallback Context] setErrorInfo called! Error likely occurred before context provider initialization.", info); },
    showOverlay: true, // Default to true, as we removed the env var check
    toastHistory: [],
    addToastToHistory: (record) => { console.warn("[Fallback Context] addToastToHistory called! Toast suppressed.", record); },
    logHistory: [],
    addLogToHistory: (level, message, timestamp) => { console.warn(`[Fallback Context Log][${level.toUpperCase()}] ${new Date(timestamp).toISOString()}: ${message}`); }
};

export const useErrorOverlay = (): ErrorOverlayContextType => {
  const context = useContext(ErrorOverlayContext);
  if (context === undefined) {
    console.error("FATAL: useErrorOverlay must be used within an ErrorOverlayProvider. Returning fallback context.");
    return fallbackErrorContext;
  }
  return context;
};

export type { ErrorInfo, LogRecord, ToastRecord, LogLevel };