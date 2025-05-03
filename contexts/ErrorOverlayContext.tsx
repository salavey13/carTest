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
  showOverlay: boolean;
  toastHistory: ToastRecord[];
  addToastToHistory: (record: Omit<ToastRecord, 'id'>) => void;
  logHistory: LogRecord[];
  addLogToHistory: LogHandler;
}

const ErrorOverlayContext = createContext<ErrorOverlayContextType | undefined>(undefined);

export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log("[ErrorOverlayProvider] Initializing...");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]);
  const [logHistory, setLogHistory] = useState<LogRecord[]>([]);
  const showOverlay = true;

  useEffect(() => {
      console.log(`[ErrorOverlayProvider] Dev Overlay System ACTIVE.`);
  }, []);

  console.debug("[ErrorOverlayProvider] State initialized.");

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
      console.log('[ErrorOverlayProvider Effect] Setting logger handler.');
      logger.setLogHandler(addLogToHistory);
      logger.log('[ErrorOverlayProvider Effect] Logger handler initialized and set.');
      return () => {
        logger.log('[ErrorOverlayProvider Effect] Clearing logger handler.');
        logger.setLogHandler(null);
        console.log('[ErrorOverlayProvider Effect Cleanup] Logger handler cleared.');
      };
  }, [addLogToHistory]);

  // Глобальные слушатели ошибок
  useEffect(() => {
    console.debug("[ErrorOverlayProvider Effect] Attaching global event listeners...");

    const handleError = (event: ErrorEvent) => {
        console.error("[Global Error Listener Raw] 'error' event caught:", event);
        if (event.message === 'Script error.' && !event.filename) { console.warn("[Global Error Listener] Ignored: Generic 'Script error.'"); return; }
        const stack = event.error?.stack || '';
        if (stack.includes('DevErrorOverlay')) { console.warn("[Global Error Listener] Ignored: Originates from DevErrorOverlay."); return; }
        if (stack.includes('ErrorOverlayContext')) { console.error("[Global Error Listener] FATAL: Ignored: Likely loop originating from ErrorOverlayContext itself.", { msg: event.message, error: event.error }); return; }

        // --- BREAK LOOP CHECK MOVED INSIDE TRY-CATCH ---

        const errorDetails: ErrorInfo = { message: event.message || 'Unknown error event', source: event.filename || 'N/A', lineno: event.lineno || undefined, colno: event.colno || undefined, error: event.error || event.message, type: 'error' };
        logger.error("Global 'error' event caught. Preparing to set context:", errorDetails);

        try {
            // --- BREAK LOOP: Check if an error is already set ---
            // Check *before* calling setErrorInfo inside the try block
            if (errorInfo) { // Use the state variable directly available in the closure
                console.warn("[Global Error Listener] Ignored: An error is already being displayed. New error:", event);
                return; // Don't call setErrorInfo again
            }
            // -----------------------------------------------------
             setErrorInfo(errorDetails);
             console.info("[Global Error Listener] Context state set successfully for 'error' event.");
        } catch (contextSetError: any) {
             console.error("[ErrorOverlayContext] CRITICAL: Failed to set errorInfo state in global error handler!", { originalError: errorDetails, contextSetError });
        }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
        console.error("[Global Error Listener Raw] 'unhandledrejection' event caught:", event);
        const reason = event.reason;
        const stack = (reason instanceof Error) ? reason.stack : '';
        if (stack && stack.includes('DevErrorOverlay')) { console.warn("[Global Error Listener] Ignored: Rejection originates from DevErrorOverlay.", { reason }); return; }
        if (stack && stack.includes('ErrorOverlayContext')) { console.error("[Global Error Listener] FATAL: Ignored: Rejection likely loop originating from ErrorOverlayContext itself.", { reason }); return; }

        // --- BREAK LOOP CHECK MOVED INSIDE TRY-CATCH ---

        let message = 'Unhandled promise rejection';
        let errorObject: any = reason;
        try {
            if (reason instanceof Error) message = reason.message;
            else if (typeof reason === 'string') message = reason;
            else if (reason && typeof reason.message === 'string') message = reason.message;
            else { try { message = JSON.stringify(reason); } catch { message = 'Unhandled promise rejection with non-serializable reason'; } }
        } catch (e) { message = "Error processing rejection reason itself."; }

        const rejectionDetails: ErrorInfo = { message: message || "Unknown rejection reason", error: errorObject, type: 'rejection' };
        logger.error("Global 'unhandledrejection' event caught. Preparing to set context:", rejectionDetails);

        try {
            // --- BREAK LOOP: Check if an error is already set ---
            if (errorInfo) { // Use the state variable directly available in the closure
                console.warn("[Global Error Listener] Ignored: An error is already being displayed. New rejection:", event);
                return; // Don't call setErrorInfo again
            }
            // -----------------------------------------------------
             setErrorInfo(rejectionDetails);
             console.info("[Global Error Listener] Context state set successfully for 'unhandledrejection' event.");
        } catch (contextSetError: any) {
             console.error("[ErrorOverlayContext] CRITICAL: Failed to set errorInfo state in global rejection handler!", { originalRejection: rejectionDetails, contextSetError });
        }
    };

    try {
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        console.log("[ErrorOverlayProvider Effect] Global event listeners attached successfully.");
    } catch (attachError) {
        console.error("[ErrorOverlayProvider Effect] FAILED TO ATTACH global event listeners:", attachError);
    }

    return () => {
      console.debug("[ErrorOverlayProvider Effect Cleanup] Removing global event listeners...");
      try {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleRejection);
        console.log("[ErrorOverlayProvider Effect Cleanup] Global event listeners removed successfully.");
      } catch (removeError) {
         console.error("[ErrorOverlayProvider Effect Cleanup] Error removing global event listeners:", removeError);
      }
    };
   // --- DEPENDENCY CHANGE: errorInfo state IS NOW a dependency ---
   // The handlers need the current value of errorInfo to break the loop.
  }, [errorInfo]); // Dependency Added

  // --- Wrap contextValue memoization in try-catch ---
  let finalContextValue: ErrorOverlayContextType;
  try {
      finalContextValue = useMemo(() => {
        console.debug("[ErrorOverlayProvider] Memoizing context value...");
        return {
            errorInfo, setErrorInfo, showOverlay,
            toastHistory, addToastToHistory,
            logHistory, addLogToHistory
        };
       }, [errorInfo, showOverlay, toastHistory, logHistory, addToastToHistory, addLogToHistory, setErrorInfo]);
       console.debug("[ErrorOverlayProvider] Memoization successful.");
  } catch (memoError: any) {
       console.error("[ErrorOverlayProvider] CRITICAL ERROR during context value memoization:", memoError);
       // If memo fails, we cannot safely provide context. Return minimal structure or throw.
       // Returning fallback might hide the issue source, throwing might be better but stops render.
       // Let's log and provide fallback to see if *anything* renders.
       finalContextValue = fallbackErrorContext;
  }
  // -----------------------------------------------------

  console.log("[ErrorOverlayProvider] Rendering Provider wrapper", { showOverlay: finalContextValue.showOverlay, hasErrorInfo: !!finalContextValue.errorInfo, logCount: finalContextValue.logHistory.length });
  return (
    <ErrorOverlayContext.Provider value={finalContextValue}>
      {children}
    </ErrorOverlayContext.Provider>
  );
};

// Fallback context remains the same
const fallbackErrorContext: ErrorOverlayContextType = {
    errorInfo: null,
    setErrorInfo: (info) => { console.error("[Fallback Context] setErrorInfo called! Error likely occurred before context provider initialization.", info); },
    showOverlay: true,
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