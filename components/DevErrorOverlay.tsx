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

// Read the environment variable *once* outside the component logic if possible,
// or directly inside useEffect/render check.
const showOverlay = process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY === 'true';

export default function DevErrorOverlay() {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    // Only run this logic if the overlay is explicitly enabled via env var
    if (!showOverlay) {
      return;
    }

    const handleError = (event: ErrorEvent) => {
      console.error("Caught global error:", event);
      setErrorInfo({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'error',
      });
      // event.preventDefault(); // Optional
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Caught unhandled rejection:", event);
      let message = 'Unhandled Promise Rejection';
      let errorObj: Error | string | undefined;

      if (event.reason instanceof Error) {
        message = event.reason.message;
        errorObj = event.reason;
      } else if (typeof event.reason === 'string') {
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
      // event.preventDefault(); // Optional
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []); // Still run effect once, but handlers depend on `showOverlay` check inside

  // Don't render anything if no error or overlay is not enabled
  if (!errorInfo || !showOverlay) {
    return null;
  }

  // Render the overlay (same JSX as before)
  return (
    <div
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        aria-live="assertive"
        role="alertdialog"
        aria-modal="true"
    >
       <div className="bg-red-900/90 border-2 border-red-500 rounded-lg shadow-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto text-white font-mono">
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
           {/* IMPORTANT: Errors in Preview/Prod builds WILL BE MINIFIED */}
           <p className="text-red-300 text-lg break-words">{errorInfo.message}</p>
           {errorInfo.type === 'error' && errorInfo.source && (
             <p className="text-xs text-red-400 mt-1">
               {/* Source will also be minified/bundled */}
               Source: {errorInfo.source}:{errorInfo.lineno}:{errorInfo.colno}
             </p>
           )}
         </div>

         {errorInfo.error && (
           <div>
             <h3 className="text-lg text-red-400 mb-2">Stack Trace:</h3>
             <pre className="bg-black/60 p-4 rounded text-xs text-red-300 overflow-x-auto whitespace-pre-wrap break-all">
               {/* Stack trace will also be minified */}
               {errorInfo.error instanceof Error ? errorInfo.error.stack : String(errorInfo.error)}
             </pre>
           </div>
         )}
       </div>
    </div>
  );
}