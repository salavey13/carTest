"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ErrorInfo {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: Error | string;
  type: 'error' | 'rejection';
}

const showOverlay = process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY === 'true';

export default function DevErrorOverlay() {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    if (!showOverlay) {
      return;
    }

    const handleError = (event: ErrorEvent) => {
      // --- FILTER ---
      // Ignore generic "Script error." as it provides no useful details
      // and often comes from cross-origin scripts like analytics or SDKs.
      if (event.message === 'Script error.') {
          console.warn("Ignoring generic 'Script error.' potentially from external script.");
          return;
      }
      // --- END FILTER ---

      console.error("Caught global error by DevErrorOverlay:", event);
      setErrorInfo({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'error',
      });
      // event.preventDefault(); // Usually don't prevent default for better console logging
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Caught unhandled rejection by DevErrorOverlay:", event);
      let message = 'Unhandled Promise Rejection';
      let errorObj: Error | string | undefined;

      if (event.reason instanceof Error) {
        message = event.reason.message;
        errorObj = event.reason;
      } else if (typeof event.reason === 'string') {
        // --- FILTER ---
        // Also ignore "Script error." if it somehow ends up as a rejection reason string
        if (event.reason === 'Script error.') {
             console.warn("Ignoring generic 'Script error.' potentially from external script (rejection).");
             return;
        }
        // --- END FILTER ---
        message = event.reason;
        errorObj = event.reason;
      } else {
        try { message = JSON.stringify(event.reason); } catch { message = 'Non-serializable rejection reason'; }
        errorObj = message;
      }

      setErrorInfo({
        message: message,
        error: errorObj,
        type: 'rejection',
      });
      // event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Don't render if no error or not enabled
  if (!errorInfo || !showOverlay) {
    return null;
  }

  // Render the overlay (JSX remains the same)
  return (
    <div
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        aria-live="assertive"
        role="alertdialog"
        aria-modal="true"
    >
       <div className="bg-red-900/90 border-2 border-red-500 rounded-lg shadow-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto text-white font-mono">
         {/* ... (rest of the overlay JSX is unchanged) ... */}
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-2xl font-bold text-red-300">
             {errorInfo.type === 'error' ? 'Runtime Error' : 'Unhandled Rejection'}
           </h2>
           <button
             onClick={() => setErrorInfo(null)}
             className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
             aria-label="Close error overlay"
           >
             Close
           </button>
         </div>

         <div className="bg-black/50 p-4 rounded mb-4">
           <p className="text-red-300 text-lg break-words">{errorInfo.message}</p>
           {errorInfo.type === 'error' && errorInfo.source && (
             <p className="text-xs text-red-400 mt-1">
               Source: {errorInfo.source}:{errorInfo.lineno}:{errorInfo.colno}
             </p>
           )}
         </div>

         {errorInfo.error && (
           <div>
             <h3 className="text-lg text-red-400 mb-2">Stack Trace:</h3>
             <pre className="bg-black/60 p-4 rounded text-xs text-red-300 overflow-x-auto whitespace-pre-wrap break-all">
               {errorInfo.error instanceof Error ? errorInfo.error.stack : String(errorInfo.error)}
             </pre>
           </div>
         )}

         {/* Add a note about potential minification and Next.js overlay */}
         <p className="text-xs text-yellow-400 mt-4 pt-2 border-t border-yellow-400/30">
             Note: Errors in Preview/Prod builds will be minified. Errors within the React tree might trigger the default Next.js overlay instead.
         </p>
       </div>
    </div>
  );
}