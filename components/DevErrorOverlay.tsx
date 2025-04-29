"use client";

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useErrorOverlay, type ErrorInfo } from '@/contexts/ErrorOverlayContext'; // Import hook and type

export default function DevErrorOverlay() {
  // Get state and setter from context
  const { errorInfo, setErrorInfo, showOverlay } = useErrorOverlay();

  // Effect for catching GLOBAL errors (outside React tree)
  useEffect(() => {
    // Only run if overlay is enabled
    if (!showOverlay) {
      return;
    }

    const handleError = (event: ErrorEvent) => {
      if (event.message === 'Script error.') {
        console.warn("Ignoring generic 'Script error.' potentially from external script.");
        return;
      }
      console.error("Caught global error by window.onerror:", event);
      // Use context setter
      setErrorInfo({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'error',
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Caught unhandled rejection by window.onunhandledrejection:", event);
      let message = 'Unhandled Promise Rejection';
      let errorObj: Error | string | undefined;

      if (event.reason instanceof Error) {
        message = event.reason.message;
        errorObj = event.reason;
      } else if (typeof event.reason === 'string') {
         if (event.reason === 'Script error.') {
            console.warn("Ignoring generic 'Script error.' (rejection).");
            return;
         }
        message = event.reason;
        errorObj = event.reason;
      } else {
        try { message = JSON.stringify(event.reason); } catch { message = 'Non-serializable rejection reason'; }
        errorObj = message;
      }
      // Use context setter
      setErrorInfo({
        message: message,
        error: errorObj,
        type: 'rejection',
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
    // Depend on showOverlay so listeners are added/removed if the flag changes
    // Also depend on setErrorInfo to ensure stability if context changes unexpectedly
  }, [showOverlay, setErrorInfo]);

  // Render based on context state and flag
  if (!errorInfo || !showOverlay) {
    return null;
  }

  // --- Overlay Rendering Logic (Same as before) ---
  return (
    <div
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        aria-live="assertive"
        role="alertdialog"
        aria-modal="true"
    >
       <div className="bg-red-900/90 border-2 border-red-500 rounded-lg shadow-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto text-white font-mono">
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-2xl font-bold text-red-300 capitalize">
             {/* Display type: 'react', 'error', or 'rejection' */}
             {errorInfo.type} Error
           </h2>
           <button
             onClick={() => setErrorInfo(null)} // Use context setter to clear
             className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
             aria-label="Close error overlay"
           >
             Close
           </button>
         </div>

         <div className="bg-black/50 p-4 rounded mb-4">
           <p className="text-red-300 text-lg break-words">{errorInfo.message}</p>
           {/* Show source only for global errors, less useful for React errors */}
           {errorInfo.type === 'error' && errorInfo.source && (
             <p className="text-xs text-red-400 mt-1">
               Source: {errorInfo.source}:{errorInfo.lineno}:{errorInfo.colno}
             </p>
           )}
         </div>

         {errorInfo.error && (
           <div>
             <h3 className="text-lg text-red-400 mb-2">Stack Trace / Details:</h3>
             <pre className="bg-black/60 p-4 rounded text-xs text-red-300 overflow-x-auto whitespace-pre-wrap break-all">
               {/* Try to get stack, fallback to string */}
               {errorInfo.error instanceof Error ? errorInfo.error.stack : String(errorInfo.error)}
             </pre>
           </div>
         )}

         <p className="text-xs text-yellow-400 mt-4 pt-2 border-t border-yellow-400/30">
             Note: Errors in Preview/Prod builds will be minified. Closing the overlay may require a page refresh to reset the UI state.
         </p>
       </div>
    </div>
  );
}