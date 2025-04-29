"use client";

import type React from 'react';
import { createContext, useState, useContext, useMemo } from 'react';

// Define the shape of the error info (matching DevErrorOverlay)
interface ErrorInfo {
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