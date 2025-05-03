"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ToastRecord } from '@/types/toast';
import type { LogHandler, LogLevel } from '@/lib/debugLogger';

const MAX_TOAST_HISTORY = 50;
const MAX_LOG_HISTORY = 250; // Increased log history

// Interface for Log Records
export interface LogRecord {
  id: number | string; // Unique ID for React key
  level: LogLevel;
  message: string;
  timestamp: number;
}

// Interface for Error Information
export interface ErrorInfo {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: Error | string | any; // Store original error/reason
  type: 'error' | 'rejection' | 'react'; // Type of error source
}

// Context Type Definition
interface ErrorOverlayContextType {
  errorInfo: ErrorInfo | null;
  setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>>;
  showOverlay: boolean; // Keep for potential future use, default true
  toastHistory: ToastRecord[];
  addToastToHistory: (record: Omit<ToastRecord, 'id'>) => void;
  logHistory: LogRecord[];
  addLogToHistory: LogHandler;
}

// Create Context
const ErrorOverlayContext = createContext<ErrorOverlayContextType | undefined>(undefined);

// Fallback Context Value (for safety)
const fallbackErrorContext: ErrorOverlayContextType = {
    errorInfo: null,
    setErrorInfo: (info) => { console.error("[Fallback Context] setErrorInfo called! Error likely occurred before context provider initialization.", info); },
    showOverlay: true,
    toastHistory: [],
    addToastToHistory: (record) => { console.warn("[Fallback Context] addToastToHistory called! Toast suppressed.", record); },
    logHistory: [],
    addLogToHistory: (level, message, timestamp) => { console.warn(`[Fallback Context Log][${level.toUpperCase()}] ${new Date(timestamp).toISOString()}: ${message}`); }
};


// --- Context Provider Component ---
export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use direct console log for very early initialization steps
  console.log("[ErrorOverlayProvider] Initializing Provider...");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]);
  const [logHistory, setLogHistory] = useState<LogRecord[]>([]);
  const showOverlay = true; // Currently always enabled in dev mode

  // Log once on mount
  useEffect(() => {
      console.log(`[ErrorOverlayProvider] Dev Overlay System ACTIVE.`);
      logger.info("[ErrorOverlayProvider] Mounted and ready."); // Use logger once handler is set
  }, []);

  console.debug("[ErrorOverlayProvider] Initial State set.");

  // --- Stable Callbacks using useCallback ---
  const addToastToHistory = useCallback((record: Omit<ToastRecord, 'id'>) => {
    // logger.debug(`[ErrorOverlayContext] addToastToHistory:`, record.message?.substring(0, 50) + "...");
    setToastHistory(prevHistory => {
        const newRecord: ToastRecord = { ...record, id: Date.now() + Math.random() };
        const nextHistory = [...prevHistory, newRecord];
        // Limit history size
        return nextHistory.length > MAX_TOAST_HISTORY
          ? nextHistory.slice(nextHistory.length - MAX_TOAST_HISTORY)
          : nextHistory;
    });
  }, []); // No dependencies, uses setter function

  const addLogToHistory = useCallback<LogHandler>((level, message, timestamp) => {
    // Check for potential immediate loop - if the *exact* same message/level is last, skip
    // This is a basic safeguard, more robust handling is in the logger/Error Boundary
    setLogHistory(prevHistory => {
        if (prevHistory.length > 0 && prevHistory[prevHistory.length - 1].message === message && prevHistory[prevHistory.length - 1].level === level) {
            // console.warn("[addLogToHistory] Suppressing likely duplicate/looping log:", message);
            return prevHistory; // Return previous state to break potential immediate loop
        }
        const newRecord: LogRecord = { level, message, timestamp, id: timestamp + Math.random() + '-log' };
        const nextHistory = [...prevHistory, newRecord];
        // Limit history size
        return nextHistory.length > MAX_LOG_HISTORY
          ? nextHistory.slice(nextHistory.length - MAX_LOG_HISTORY)
          : nextHistory;
    });
   }, []); // No dependencies, uses setter function

  // Effect to set up the logger handler
  useEffect(() => {
      console.log('[ErrorOverlayProvider Effect] Setting logger handler.'); // Direct console log
      logger.setLogHandler(addLogToHistory);
      logger.info('[ErrorOverlayProvider Effect] Logger handler initialized and set.');
      return () => {
        logger.info('[ErrorOverlayProvider Effect Cleanup] Clearing logger handler.');
        logger.setLogHandler(null);
        console.log('[ErrorOverlayProvider Effect Cleanup] Logger handler cleared.'); // Direct console log
      };
  }, [addLogToHistory]); // Dependency on the stable callback

  // Effect for Global Error Listeners (Optimized Dependencies)
  useEffect(() => {
    console.debug("[ErrorOverlayProvider Effect] Attaching global event listeners...");

    // --- Global 'error' Handler ---
    const handleError = (event: ErrorEvent) => {
        // Direct console log for raw event capture
        console.error("[Global Error Listener Raw] 'error' event caught:", event);

        // Basic filtering
        if (event.message === 'Script error.' && !event.filename) { console.warn("[Global Error Listener] Ignored: Generic 'Script error.'"); return; }

        // Check if error originates from overlay/logger to prevent loops
        const stack = event.error?.stack || (event.error ? String(event.error) : '');
        if (stack.includes('DevErrorOverlay') || stack.includes('ErrorBoundaryForOverlay')) { console.warn("[Global Error Listener] Ignored: Originates from DevErrorOverlay/ErrorBoundary.", {msg: event.message}); return; }
        if (stack.includes('ErrorOverlayContext') || stack.includes('addLogToHistory') || stack.includes('debugLogger')) { console.error("[Global Error Listener] FATAL: Ignored: Likely loop originating from ErrorOverlayContext/Logger itself.", { msg: event.message, error: event.error }); return; }

        // Use functional update form of setErrorInfo for safety
        setErrorInfo(prevErrorInfo => {
            // --- LOOP PREVENTION: Check if an error is ALREADY set ---
            if (prevErrorInfo) {
                console.warn("[Global Error Listener 'error'] Ignored (handler check): An error is already displayed.", { currentMsg: prevErrorInfo.message.substring(0,50)+"...", newMsg: event.message.substring(0,50)+"..." });
                return prevErrorInfo; // Return current state, do not update
            }

            // Construct error details *only if* proceeding
            const errorDetails: ErrorInfo = {
                message: event.message || 'Unknown window error event',
                source: event.filename || 'N/A',
                lineno: event.lineno || undefined,
                colno: event.colno || undefined,
                error: event.error || event.message, // Store original error/message
                type: 'error'
            };
            // Log using the logger *before* returning the new state
            logger.error("Global 'error' event caught. Setting context:", errorDetails);
            console.info("[Global Error Listener 'error'] Context state update scheduled.");
            return errorDetails; // Return the new state
        });
    };

    // --- Global 'unhandledrejection' Handler ---
    const handleRejection = (event: PromiseRejectionEvent) => {
        console.error("[Global Error Listener Raw] 'unhandledrejection' event caught:", event);
        const reason = event.reason;

        // Check stack if available
        const stack = (reason instanceof Error) ? reason.stack : (reason ? String(reason) : '');
        if (stack && (stack.includes('DevErrorOverlay') || stack.includes('ErrorBoundaryForOverlay'))) { console.warn("[Global Error Listener] Ignored: Rejection originates from DevErrorOverlay/ErrorBoundary.", { reason }); return; }
        if (stack && (stack.includes('ErrorOverlayContext') || stack.includes('addLogToHistory') || stack.includes('debugLogger'))) { console.error("[Global Error Listener] FATAL: Ignored: Rejection likely loop originating from ErrorOverlayContext/Logger itself.", { reason }); return; }

        // Use functional update form
        setErrorInfo(prevErrorInfo => {
             // --- LOOP PREVENTION: Check if an error is ALREADY set ---
            if (prevErrorInfo) {
                console.warn("[Global Error Listener 'rejection'] Ignored (handler check): An error is already displayed.", { currentMsg: prevErrorInfo.message.substring(0,50)+"...", newReason: String(reason).substring(0,50)+"..."});
                return prevErrorInfo; // Do not update
            }

            // Construct details *only if* proceeding
            let message = 'Unhandled promise rejection';
            let errorObject: any = reason;
            try { // Safely try to extract a meaningful message
                if (reason instanceof Error) message = reason.message;
                else if (typeof reason === 'string') message = reason;
                else if (reason && typeof reason.message === 'string') message = reason.message;
                else { try { message = JSON.stringify(reason); } catch { message = 'Unhandled promise rejection with non-serializable reason'; } }
            } catch (e) { message = "Error processing rejection reason itself."; }

            const rejectionDetails: ErrorInfo = {
                message: message || "Unknown rejection reason",
                error: errorObject, // Store original reason
                type: 'rejection'
            };
            logger.error("Global 'unhandledrejection' event caught. Setting context:", rejectionDetails);
            console.info("[Global Error Listener 'rejection'] Context state update scheduled.");
            return rejectionDetails; // Return the new state
        });
    };

    // Attach listeners
    try {
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        console.log("[ErrorOverlayProvider Effect] Global event listeners attached successfully.");
    } catch (attachError) {
        console.error("[ErrorOverlayProvider Effect] FAILED TO ATTACH global event listeners:", attachError);
        logger.fatal("Failed to attach global error listeners", attachError); // Log failure
    }

    // Cleanup function
    return () => {
      console.debug("[ErrorOverlayProvider Effect Cleanup] Removing global event listeners...");
      try {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleRejection);
        console.log("[ErrorOverlayProvider Effect Cleanup] Global event listeners removed successfully.");
      } catch (removeError) {
         console.error("[ErrorOverlayProvider Effect Cleanup] Error removing global event listeners:", removeError);
         logger.error("Failed to remove global error listeners during cleanup", removeError);
      }
    };
  // --- OPTIMIZATION: Removed errorInfo dependency ---
  // The listeners are attached once on mount. The handlers use functional state updates
  // and closures to access the latest state if needed for loop prevention.
  }, []); // Empty dependency array

  // --- Memoize the context value ---
  let finalContextValue: ErrorOverlayContextType;
  try {
      finalContextValue = useMemo(() => {
        // logger.debug("[ErrorOverlayProvider] Memoizing context value...");
        return {
            errorInfo, setErrorInfo, showOverlay,
            toastHistory, addToastToHistory,
            logHistory, addLogToHistory
        };
       }, [errorInfo, showOverlay, toastHistory, logHistory, addToastToHistory, addLogToHistory]); // Keep stable callbacks
       // logger.debug("[ErrorOverlayProvider] Memoization successful.");
  } catch (memoError: any) {
       console.error("[ErrorOverlayProvider] CRITICAL ERROR during context value memoization:", memoError);
       logger.fatal("Context memoization failed", memoError);
       finalContextValue = fallbackErrorContext; // Provide fallback if memo fails
  }

  // logger.log("[ErrorOverlayProvider] Rendering Provider wrapper", { showOverlay: finalContextValue.showOverlay, hasErrorInfo: !!finalContextValue.errorInfo, logCount: finalContextValue.logHistory.length });

  return (
    <ErrorOverlayContext.Provider value={finalContextValue}>
      {children}
    </ErrorOverlayContext.Provider>
  );
};

// --- Custom Hook (Consumer) ---
export const useErrorOverlay = (): ErrorOverlayContextType => {
  const context = useContext(ErrorOverlayContext);
  if (context === undefined) {
    console.error("FATAL: useErrorOverlay must be used within an ErrorOverlayProvider. Returning fallback context.");
    // Throw in dev to make setup errors obvious
    if (process.env.NODE_ENV === 'development') {
      throw new Error("useErrorOverlay must be used within an ErrorOverlayProvider");
    }
    return fallbackErrorContext; // Fallback in prod
  }
  // Optional check if it's the fallback (e.g., if provider init failed)
  if (context.setErrorInfo === fallbackErrorContext.setErrorInfo) {
      // console.warn("useErrorOverlay: Context seems to be the fallback value. Check provider setup/initialization.");
  }
  return context;
};

// Export types for external use
export type { ErrorInfo, LogRecord, ToastRecord, LogLevel };