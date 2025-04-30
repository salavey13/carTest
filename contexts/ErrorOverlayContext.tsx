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
  error?: Error | string; // Include the raw error/reason
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
      logger.error("Global 'error' event caught:", event);
      setErrorInfo(prev => {
        // Avoid setting if the same error is already shown (simple check)
        if (prev?.message === event.message && prev?.type === 'error') return prev;
        return {
          message: event.message,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error, // The actual error object
          type: 'error',
        };
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logger.error("Global 'unhandledrejection' event caught:", event);
      let message = 'Unhandled promise rejection';
      let errorObject: Error | string | undefined = undefined;

      if (event.reason instanceof Error) {
        message = event.reason.message;
        errorObject = event.reason;
      } else if (typeof event.reason === 'string') {
        message = event.reason;
        errorObject = event.reason;
      } else {
        // Try to stringify other types, but be cautious
        try {
             message = JSON.stringify(event.reason);
        } catch {
             message = 'Unhandled promise rejection with non-serializable reason';
        }
        errorObject = event.reason as any; // Store the original reason
      }

       setErrorInfo(prev => {
            // Avoid setting if the same error is already shown (simple check)
            if (prev?.message === message && prev?.type === 'rejection') return prev;
            return {
                 message: message,
                 error: errorObject, // Pass the reason/error
                 type: 'rejection',
                 // Source info might not be available directly here
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