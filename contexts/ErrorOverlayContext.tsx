"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger'; // Import logger

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
}

// Create the context
const ErrorOverlayContext = createContext<ErrorOverlayContextType | undefined>(undefined);

// Create the provider component
export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  // Determine if overlay should be shown based on env var
  const showOverlay = process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY === 'true';

  // --- NEW: Global Error Listeners ---
  useEffect(() => {
    if (!showOverlay) return; // Only add listeners if overlay is enabled

    const handleError = (event: ErrorEvent) => {
      // Try to prevent logging generic "Script error." if possible, though often unavoidable
      if (event.message === 'Script error.' && !event.filename) {
        logger.warn("Global 'error' event caught: Generic 'Script error.' with no filename. Often related to cross-origin scripts or browser extensions.");
        // Optionally decide NOT to show the overlay for generic script errors
        // if (!process.env.NEXT_PUBLIC_SHOW_GENERIC_SCRIPT_ERRORS) return;
      } else {
         logger.error("Global 'error' event caught:", {
             message: event.message,
             filename: event.filename,
             lineno: event.lineno,
             colno: event.colno,
             error: event.error // Log the nested error object if available
         });
      }

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
            // Handle cases where the reason is an object with a message property
            message = event.reason.message;
          } else {
            // Try to stringify, but catch errors
             try { message = JSON.stringify(event.reason); }
             catch { message = 'Unhandled promise rejection with non-serializable reason'; }
          }
      } catch (e) {
           logger.error("Error processing rejection reason:", e);
           message = "Error processing rejection reason itself.";
      }


       setErrorInfo(prev => {
            // Avoid rapidly replacing identical rejection messages
            if (prev?.message === message && prev?.type === 'rejection') return prev;
            return {
                 message: message || "Unknown rejection reason",
                 error: errorObject, // Pass the original reason
                 type: 'rejection',
                 // Source info is typically not available for rejections
             };
       });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [showOverlay]); // Re-run if showOverlay changes (though unlikely)

  // Memoize context value to prevent unnecessary renders
  const contextValue = useMemo(() => ({
    errorInfo,
    setErrorInfo,
    showOverlay
  }), [errorInfo, showOverlay]); // Include showOverlay dependency

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