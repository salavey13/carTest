"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ErrorInfo as ReactErrorInfo } from 'react';
import type { ToastRecord } from '@/types/toast';
// *** REMOVED LogHandler import from debugLogger ***
import { debugLogger as logger } from '@/lib/debugLogger'; // Use logger directly

// --- Types ---

export type ErrorSourceType = 'react' | 'network' | 'javascript' | 'custom' | 'promise';

export interface ErrorInfo {
    type: ErrorSourceType;
    message: string;
    timestamp?: number;
    componentStack?: string | null; // React component stack
    stack?: string; // Native JS error stack
    source?: string; // e.g., component name, function name, URL
    error?: Error | any; // Keep original error if available
    extra?: Record<string, any>; // For additional context
}

interface ErrorOverlayContextType {
    toastHistory: ToastRecord[]; // Renamed from 'history' for clarity
    errorInfo: ErrorInfo | null;
    isClientReady: boolean;
    addToastToHistory: (toast: Omit<ToastRecord, 'id'>) => void;
    addErrorInfo: (errorDetails: ErrorInfo) => void; // Renamed from setErrorInfo for clarity
    clearHistory: () => void;
    showOverlay: boolean; // Flag to control overlay visibility
}

// --- Context ---

const defaultState: ErrorOverlayContextType = {
    toastHistory: [], // Renamed
    errorInfo: null,
    isClientReady: false,
    addToastToHistory: () => { logger.warn("ErrorOverlayContext: addToastToHistory called before provider ready."); },
    addErrorInfo: () => { logger.warn("ErrorOverlayContext: addErrorInfo called before provider ready."); },
    clearHistory: () => { logger.warn("ErrorOverlayContext: clearHistory called before provider ready."); },
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
        logger.info("[ErrorOverlayProvider Effect] Client is ready, Provider mounted.");
    }, []);

    // Update showOverlay flag when errorInfo changes
    useEffect(() => {
        const shouldShow = errorInfo !== null;
        if (showOverlay !== shouldShow) {
            logger.log(`[ErrorOverlayProvider Effect] Setting showOverlay to: ${shouldShow}`);
            setShowOverlay(shouldShow);
        }
    }, [errorInfo, showOverlay]); // Added showOverlay to deps

    const addToastToHistory = useCallback((toast: Omit<ToastRecord, 'id'>) => {
        // Add only actual toasts shown via useAppToast
        logger.debug("[ErrorOverlayContext CB] addToastToHistory", { type: toast.type, msg: String(toast.message)?.substring(0, 30) });
        setToastHistory(prev => {
            const newHistory = [...prev, { ...toast, id: Date.now() + Math.random() }];
            // Limit history size
            const MAX_TOASTS = 20;
            if (newHistory.length > MAX_TOASTS) {
                return newHistory.slice(newHistory.length - MAX_TOASTS);
            }
            return newHistory;
        });
    }, []); // No dependencies needed if only using setHistory

    // Renamed for clarity: This sets the error and implicitly shows the overlay
    const addErrorInfo = useCallback((errorDetails: ErrorInfo) => {
         const newErrorInfo = {
             ...errorDetails,
             timestamp: errorDetails.timestamp || Date.now(),
         };
         // Log the error being set *before* updating state
         logger.error("[ErrorOverlayContext CB] addErrorInfo (setting error, will trigger overlay)", newErrorInfo);
         setErrorInfo(newErrorInfo); // This will update errorInfo and trigger showOverlay=true effect via useEffect
     }, []);


    const clearHistory = useCallback(() => {
        logger.info("[ErrorOverlayContext CB] clearHistory called.");
        setToastHistory([]);
        setErrorInfo(null); // This will update errorInfo and trigger showOverlay=false effect via useEffect
    }, []);

    // --- REMOVED Logger Integration useEffect ---

    const contextValue = useMemo(() => {
        // logger.debug("[ErrorOverlayProvider] Memoizing context value."); // Can be noisy
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
        const errorMsg = "useErrorOverlay must be used within an ErrorOverlayProvider";
        // Use console.error as logger might rely on the context itself indirectly
        console.error(`[${errorMsg}]`);
        throw new Error(errorMsg);
    }
    // Check if it's still the default value (can happen during initial SSR or if provider is missing/failed)
    // Use a function known to be defined in the real context but not the default
    if (context.addErrorInfo === defaultState.addErrorInfo && typeof window !== 'undefined') {
         // Use console.warn as logger might not be fully ready
         console.warn("[useErrorOverlay Hook] Context seems to hold default value. Provider might not be fully initialized yet or is missing higher up the tree.");
    }
    return context;
};

// Export necessary types
export type { ErrorInfo, ToastRecord, ErrorSourceType, ErrorOverlayContextType };