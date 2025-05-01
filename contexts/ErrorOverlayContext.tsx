"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger'; // Import logger
import type { ToastRecord } from '@/types/toast'; // Import the new type

const MAX_TOAST_HISTORY = 50; // <<<<<<<<<<<<<<<<<<<<< INCREASED TO 50

// Define the shape of the error info (matching DevErrorOverlay)
export interface ErrorInfo {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: Error | string | any; // Include the raw error/reason (changed to any for safety)
  type: 'error' | 'rejection' | 'react'; // Add 'react' type
}

// Define the context shape
interface ErrorOverlayContextType {
  errorInfo: ErrorInfo | null;
  setErrorInfo: React.Dispatch<React.SetStateAction<ErrorInfo | null>>;
  showOverlay: boolean; // Pass the flag down
  toastHistory: ToastRecord[]; // Add toast history
  addToastToHistory: (record: Omit<ToastRecord, 'id'>) => void; // Function to add toasts
}

// Create the context
const ErrorOverlayContext = createContext<ErrorOverlayContextType | undefined>(undefined);

// Create the provider component
export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]);
  // Determine if overlay should be shown based on env var
  const showOverlay = process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY === 'true';

  // --- Function to add toast to history (keeping size limit) ---
  const addToastToHistory = useCallback((record: Omit<ToastRecord, 'id'>) => {
    // Use functional update to avoid stale state issues
    setToastHistory(prevHistory => {
        const newRecord: ToastRecord = {
            ...record,
            id: Date.now() + Math.random(), // Simple unique enough ID for React key
        };
        // Add new record and slice to maintain max length
        const updatedHistory = [...prevHistory, newRecord].slice(-MAX_TOAST_HISTORY);
        // logger.debug('Toast history updated:', updatedHistory); // Optional: Log history updates
        return updatedHistory;
    });
  }, []); // Empty dependency array as it doesn't depend on external state

  // --- Global Error Listeners ---
  useEffect(() => {
    // Listeners are always added, but setErrorInfo is only called if showOverlay is true

    const handleError = (event: ErrorEvent) => {
      // Ignore generic "Script error." which provides no useful info
      if (event.message === 'Script error.' && !event.filename) {
        logger.warn("Global 'error' event ignored: Generic 'Script error.' Likely CORS or browser extension issue.", {
             message: event.message,
             filename: event.filename,
        });
        return; // <-- Exit early, do not show overlay or set error info
      }

      logger.error("Global 'error' event caught:", {
             message: event.message,
             filename: event.filename,
             lineno: event.lineno,
             colno: event.colno,
             error: event.error // Log the nested error object if available
      });

      // Only set error info (triggering overlay) if enabled
      if (showOverlay) {
          setErrorInfo(prev => {
            // Avoid rapidly replacing identical errors
            if (prev?.message === event.message && prev?.type === 'error' && prev?.source === event.filename) return prev;
            return {
              message: event.message || 'Unknown error event',
              source: event.filename || 'N/A',
              lineno: event.lineno || undefined,
              colno: event.colno || undefined,
              error: event.error || event.message, // Pass the error object or message as fallback
              type: 'error',
            };
          });
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logger.error("Global 'unhandledrejection' event caught:", { reason: event.reason });
      let message = 'Unhandled promise rejection';
      let errorObject: any = event.reason; // Store the original reason

      // Safely try to extract a message
      try {
          if (event.reason instanceof Error) {
            message = event.reason.message;
          } else if (typeof event.reason === 'string') {
            message = event.reason;
          } else if (event.reason && typeof event.reason.message === 'string') {
            message = event.reason.message;
          } else {
             try { message = JSON.stringify(event.reason); }
             catch { message = 'Unhandled promise rejection with non-serializable reason'; }
          }
      } catch (e) {
           logger.error("Error processing rejection reason:", e);
           message = "Error processing rejection reason itself.";
      }

      // Only set error info (triggering overlay) if enabled
      if (showOverlay) {
           setErrorInfo(prev => {
                // Avoid rapidly replacing identical rejection messages
                if (prev?.message === message && prev?.type === 'rejection') return prev;
                return {
                     message: message || "Unknown rejection reason",
                     error: errorObject, // Pass the original reason
                     type: 'rejection',
                 };
           });
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [showOverlay]); // Re-run if showOverlay changes (though unlikely for this env var)

  // Memoize context value to prevent unnecessary renders
  const contextValue = useMemo(() => ({
    errorInfo,
    setErrorInfo,
    showOverlay,
    toastHistory, // Pass history
    addToastToHistory // Pass adder function
  }), [errorInfo, showOverlay, toastHistory, addToastToHistory]); // Include dependencies

  return (
    <ErrorOverlayContext.Provider value={contextValue}>
      {children}
    </ErrorOverlayContext.Provider>
  );
};

// Custom hook to use the context
export const useErrorOverlay = (): ErrorOverlayContextType => {
  const context = useContext(ErrorOverlayContext);
  if (context === undefined) {
    throw new Error('useErrorOverlay must be used within an ErrorOverlayProvider');
  }
  return context;
};

// Re-export ErrorInfo type if needed elsewhere
export type { ErrorInfo };

// Re-export ToastRecord if needed, although it's better imported from its source
export type { ToastRecord };