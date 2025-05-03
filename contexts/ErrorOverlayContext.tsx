"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ToastRecord } from '@/types/toast';
import type { LogHandler, LogLevel } from '@/lib/debugLogger';

const MAX_TOAST_HISTORY = 50;
const MAX_LOG_HISTORY = 250;

// --- Define Interfaces FIRST ---
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

// --- Create the Actual Context ---
// Initialize with undefined, the Provider will supply the actual value.
const ErrorOverlayContext = createContext<ErrorOverlayContextType | undefined>(undefined);

// --- Define the Provider Component ---
export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // (Provider implementation remains the same as the previous correct version)
  console.log("[ErrorOverlayProvider] Initializing Provider...");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]);
  const [logHistory, setLogHistory] = useState<LogRecord[]>([]);
  const showOverlay = true; // Keep overlay enabled by default

  useEffect(() => {
      console.log(`[ErrorOverlayProvider] Dev Overlay System ACTIVE.`);
      logger.info("[ErrorOverlayProvider] Mounted and ready."); // Use logger once handler is set
  }, []);

  console.debug("[ErrorOverlayProvider] Initial State set.");

  const addToastToHistory = useCallback((record: Omit<ToastRecord, 'id'>) => {
    setToastHistory(prevHistory => {
        const newRecord: ToastRecord = { ...record, id: Date.now() + Math.random() };
        const nextHistory = [...prevHistory, newRecord];
        return nextHistory.length > MAX_TOAST_HISTORY ? nextHistory.slice(nextHistory.length - MAX_TOAST_HISTORY) : nextHistory;
    });
  }, []);

  const addLogToHistory = useCallback<LogHandler>((level, message, timestamp) => {
    setLogHistory(prevHistory => {
        if (prevHistory.length > 0 && prevHistory[prevHistory.length - 1].message === message && prevHistory[prevHistory.length - 1].level === level) {
            return prevHistory;
        }
        const newRecord: LogRecord = { level, message, timestamp, id: timestamp + Math.random() + '-log' };
        const nextHistory = [...prevHistory, newRecord];
        return nextHistory.length > MAX_LOG_HISTORY ? nextHistory.slice(nextHistory.length - MAX_LOG_HISTORY) : nextHistory;
    });
   }, []);

  useEffect(() => {
      console.log('[ErrorOverlayProvider Effect] Setting logger handler.');
      logger.setLogHandler(addLogToHistory);
      logger.info('[ErrorOverlayProvider Effect] Logger handler initialized and set.');
      return () => {
        logger.info('[ErrorOverlayProvider Effect Cleanup] Clearing logger handler.');
        logger.setLogHandler(null);
        console.log('[ErrorOverlayProvider Effect Cleanup] Logger handler cleared.');
      };
  }, [addLogToHistory]);

  useEffect(() => {
    console.debug("[ErrorOverlayProvider Effect] Attaching global event listeners...");
    const handleError = (event: ErrorEvent) => {
        console.error("[Global Error Listener Raw] 'error' event caught:", event);
        if (event.message === 'Script error.' && !event.filename) { console.warn("[Global Error Listener] Ignored: Generic 'Script error.'"); return; }
        const stack = event.error?.stack || (event.error ? String(event.error) : '');
        if (stack.includes('DevErrorOverlay') || stack.includes('ErrorBoundaryForOverlay')) { console.warn("[Global Error Listener] Ignored: Originates from DevErrorOverlay/ErrorBoundary.", {msg: event.message}); return; }
        if (stack.includes('ErrorOverlayContext') || stack.includes('addLogToHistory') || stack.includes('debugLogger')) { console.error("[Global Error Listener] FATAL: Ignored: Likely loop originating from ErrorOverlayContext/Logger itself.", { msg: event.message, error: event.error }); return; }
        setErrorInfo(prevErrorInfo => {
            if (prevErrorInfo) { console.warn("[Global Error Listener 'error'] Ignored (handler check): An error is already displayed."); return prevErrorInfo; }
            const errorDetails: ErrorInfo = { message: event.message || 'Unknown window error event', source: event.filename || 'N/A', lineno: event.lineno || undefined, colno: event.colno || undefined, error: event.error || event.message, type: 'error' };
            logger.error("Global 'error' event caught. Setting context:", errorDetails);
            return errorDetails;
        });
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
        console.error("[Global Error Listener Raw] 'unhandledrejection' event caught:", event);
        const reason = event.reason;
        const stack = (reason instanceof Error) ? reason.stack : (reason ? String(reason) : '');
        if (stack && (stack.includes('DevErrorOverlay') || stack.includes('ErrorBoundaryForOverlay'))) { console.warn("[Global Error Listener] Ignored: Rejection originates from DevErrorOverlay/ErrorBoundary.", { reason }); return; }
        if (stack && (stack.includes('ErrorOverlayContext') || stack.includes('addLogToHistory') || stack.includes('debugLogger'))) { console.error("[Global Error Listener] FATAL: Ignored: Rejection likely loop originating from ErrorOverlayContext/Logger itself.", { reason }); return; }
        setErrorInfo(prevErrorInfo => {
            if (prevErrorInfo) { console.warn("[Global Error Listener 'rejection'] Ignored (handler check): An error is already displayed."); return prevErrorInfo; }
            let message = 'Unhandled promise rejection'; let errorObject: any = reason;
            try { if (reason instanceof Error) message = reason.message; else if (typeof reason === 'string') message = reason; else if (reason && typeof reason.message === 'string') message = reason.message; else { try { message = JSON.stringify(reason); } catch { message = 'Unhandled promise rejection with non-serializable reason'; } } } catch (e) { message = "Error processing rejection reason itself."; }
            const rejectionDetails: ErrorInfo = { message: message || "Unknown rejection reason", error: errorObject, type: 'rejection' };
            logger.error("Global 'unhandledrejection' event caught. Setting context:", rejectionDetails);
            return rejectionDetails;
        });
    };
    try { window.addEventListener('error', handleError); window.addEventListener('unhandledrejection', handleRejection); console.log("[ErrorOverlayProvider Effect] Global event listeners attached successfully."); } catch (attachError) { console.error("[ErrorOverlayProvider Effect] FAILED TO ATTACH global event listeners:", attachError); logger.fatal("Failed to attach global error listeners", attachError); }
    return () => { console.debug("[ErrorOverlayProvider Effect Cleanup] Removing global event listeners..."); try { window.removeEventListener('error', handleError); window.removeEventListener('unhandledrejection', handleRejection); console.log("[ErrorOverlayProvider Effect Cleanup] Global event listeners removed successfully."); } catch (removeError) { console.error("[ErrorOverlayProvider Effect Cleanup] Error removing global event listeners:", removeError); logger.error("Failed to remove global error listeners during cleanup", removeError); } };
  }, []); // Empty dependency array

  const finalContextValue = useMemo(() => ({
        errorInfo, setErrorInfo, showOverlay,
        toastHistory, addToastToHistory,
        logHistory, addLogToHistory
   }), [errorInfo, showOverlay, toastHistory, logHistory, addToastToHistory, addLogToHistory]);

  return (
    <ErrorOverlayContext.Provider value={finalContextValue}>
      {children}
    </ErrorOverlayContext.Provider>
  );
};

// --- Custom Hook (Consumer) - REVISED ---
export const useErrorOverlay = (): ErrorOverlayContextType => {
  const context = useContext(ErrorOverlayContext);

  // If context is undefined (hook used outside provider),
  // return a *new object* with the fallback implementations.
  if (context === undefined) {
    console.error("FATAL: useErrorOverlay must be used outside of ErrorOverlayProvider! Returning inline fallback implementation.");
    // Throw in dev to make setup errors more obvious
    // if (process.env.NODE_ENV === 'development') {
    //   throw new Error("useErrorOverlay must be used within an ErrorOverlayProvider");
    // }
    // Return an object literal matching the ErrorOverlayContextType interface
    // with the default "do nothing but log" implementations.
    // This avoids the ReferenceError for fallbackErrorContext.
    return {
        errorInfo: null,
        setErrorInfo: (info) => { console.error("[Inline Fallback Context] setErrorInfo called!", info); },
        showOverlay: true, // Default to true
        toastHistory: [],
        addToastToHistory: (record) => { console.warn("[Inline Fallback Context] addToastToHistory called! Toast suppressed.", record); },
        logHistory: [],
        addLogToHistory: (level, message, timestamp) => { console.warn(`[Inline Fallback Log][${level.toUpperCase()}] ${new Date(timestamp).toISOString()}: ${message}`); }
    };
  }

  // If context exists, return it
  return context;
};

// Export types for external use
export type { ErrorInfo, LogRecord, ToastRecord, LogLevel };