"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ErrorInfo as ReactErrorInfo } from 'react';
import type { ToastRecord } from '@/types/toast';
// *** REMOVED LogHandler import from debugLogger ***
import { debugLogger } from '@/lib/debugLogger';

// --- Types ---

export type ErrorSourceType = 'react' | 'network' | 'javascript' | 'custom' | 'promise';

export interface ErrorInfo {
    type: ErrorSourceType;
    message: string;
    timestamp?: number;
    componentStack?: string | null;
    stack?: string; // Native error stack
    source?: string; // e.g., component name, function name, URL
    error?: Error | any; // Keep original error if available
    extra?: Record<string, any>; // For additional context
}

interface ErrorOverlayContextType {
    toastHistory: ToastRecord[]; // Renamed from 'history' for clarity
    errorInfo: ErrorInfo | null;
    isClientReady: boolean;
    addToastToHistory: (toast: Omit<ToastRecord, 'id'>) => void;
    addErrorInfo: (errorDetails: ErrorInfo) => void; // Simplified adding errors
    clearHistory: () => void;
    showOverlay: boolean; // Flag to control overlay visibility
}

// --- Context ---

const defaultState: ErrorOverlayContextType = {
    toastHistory: [], // Renamed
    errorInfo: null,
    isClientReady: false,
    addToastToHistory: () => { console.warn("ErrorOverlayContext: addToastToHistory called before provider ready."); },
    addErrorInfo: () => { console.warn("ErrorOverlayContext: addErrorInfo called before provider ready."); },
    clearHistory: () => { console.warn("ErrorOverlayContext: clearHistory called before provider ready."); },
    showOverlay: false,
};

const ErrorOverlayContext = createContext<ErrorOverlayContextType>(defaultState);

// --- Provider ---

export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toastHistory, setToastHistory] = useState<ToastRecord[]>([]); // Renamed state
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
    const [isClientReady, setIsClientReady] = useState(false);
    const [showOverlay, setShowOverlay] = useState<boolean>(false); // State to control overlay

    useEffect(() => {
        setIsClientReady(true);
        debugLogger.info("[ErrorOverlayProvider Effect] Client is ready, Provider mounted.");
    }, []);

    // Update showOverlay flag when errorInfo changes
    useEffect(() => {
        const shouldShow = errorInfo !== null;
        if (showOverlay !== shouldShow) {
            debugLogger.log(`[ErrorOverlayProvider Effect] Setting showOverlay to: ${shouldShow}`);
            setShowOverlay(shouldShow);
        }
    }, [errorInfo, showOverlay]); // Added showOverlay to deps

    const addToastToHistory = useCallback((toast: Omit<ToastRecord, 'id'>) => {
        // Add only actual toasts shown via useAppToast
        debugLogger.debug("[ErrorOverlayContext CB] addToastToHistory", { type: toast.type, msg: toast.message?.substring(0, 30) });
        setToastHistory(prev => {
            const newHistory = [...prev, { ...toast, id: Date.now() + Math.random() }];
            // Optional: Limit history size (e.g., keep last 20 toasts)
            if (newHistory.length > 20) {
                return newHistory.slice(newHistory.length - 20);
            }
            return newHistory;
        });
    }, []); // No dependencies needed if only using setHistory

    // Simplified error adding
    const addErrorInfo = useCallback((errorDetails: ErrorInfo) => {
         const newErrorInfo = {
             ...errorDetails,
             timestamp: errorDetails.timestamp || Date.now(),
         };
         debugLogger.error("[ErrorOverlayContext CB] addErrorInfo (will trigger overlay)", newErrorInfo);
         setErrorInfo(newErrorInfo); // This will update errorInfo and trigger showOverlay=true effect
     }, []);


    const clearHistory = useCallback(() => {
        debugLogger.info("[ErrorOverlayContext CB] clearHistory called.");
        setToastHistory([]);
        setErrorInfo(null); // This will update errorInfo and trigger showOverlay=false effect
    }, []);

    // --- REMOVED Logger Integration useEffect ---
    // The provider no longer needs to interact with the logger handler directly

    const contextValue = useMemo(() => {
        debugLogger.debug("[ErrorOverlayProvider] Memoizing context value.");
        return {
            toastHistory, // Renamed
            errorInfo,
            isClientReady,
            addToastToHistory, // Stable callback
            addErrorInfo,      // Stable callback
            clearHistory,      // Stable callback
            showOverlay,       // Include show flag
        };
    }, [
        toastHistory, // Renamed
        errorInfo,
        isClientReady,
        addToastToHistory,
        addErrorInfo, // Added
        clearHistory,
        showOverlay, // Added showOverlay
    ]);

    return (
        <ErrorOverlayContext.Provider value={contextValue}>
            {children}
        </ErrorOverlayContext.Provider>
    );
};

// --- Hook ---

export const useErrorOverlay = (): ErrorOverlayContextType => {
    const context = useContext(ErrorOverlayContext);
    if (context === undefined) {
        debugLogger.fatal("useErrorOverlay must be used within an ErrorOverlayProvider");
        throw new Error('useErrorOverlay must be used within an ErrorOverlayProvider');
    }
    // Check if it's still the default value (can happen during initial SSR or if provider is missing)
    if (context.addToastToHistory === defaultState.addToastToHistory && typeof window !== 'undefined') {
         debugLogger.warn("useErrorOverlay: Context seems to hold default value. Provider might not be fully initialized yet.");
    }
    return context;
};

// Export necessary types
// *** REMOVED LogRecord export as it's handled by debugLogger now ***
export type { ErrorInfo, ToastRecord, ErrorSourceType, ErrorOverlayContextType };