"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ErrorInfo as ReactErrorInfo } from 'react';
import type { ToastRecord } from '@/types/toast';
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
    // Stable callback signature
    addToastToHistory: (toast: Omit<ToastRecord, 'id'>) => void;
    // Stable callback signature
    addErrorInfo: (errorDetails: ErrorInfo) => void; // Renamed from setErrorInfo for clarity
    // Stable callback signature
    clearHistory: () => void;
    showOverlay: boolean; // Flag to control overlay visibility
}

// --- Context ---

const defaultState: ErrorOverlayContextType = {
    toastHistory: [], // Renamed
    errorInfo: null,
    isClientReady: false,
    // Default functions log warnings to indicate context is not ready
    addToastToHistory: () => { console.warn("ErrorOverlayContext: addToastToHistory called before provider ready."); },
    addErrorInfo: () => { console.warn("ErrorOverlayContext: addErrorInfo called before provider ready."); },
    clearHistory: () => { console.warn("ErrorOverlayContext: clearHistory called before provider ready."); },
    showOverlay: false,
};

const ErrorOverlayContext = createContext<ErrorOverlayContextType>(defaultState);

// --- Provider ---

export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toastHistoryState, setToastHistoryState] = useState<ToastRecord[]>([]); // Renamed state
    const [errorInfoState, setErrorInfoState] = useState<ErrorInfo | null>(null);
    const [isClientReadyState, setIsClientReadyState] = useState(false);
    const [showOverlayState, setShowOverlayState] = useState<boolean>(false); // State to control overlay

    useEffect(() => {
        setIsClientReadyState(true);
        logger.info("[ErrorOverlayProvider Effect] Client is ready, Provider mounted.");
    }, []);

    // Update showOverlay flag when errorInfo changes
    useEffect(() => {
        const shouldShow = errorInfoState !== null;
        if (showOverlayState !== shouldShow) {
            logger.log(`[ErrorOverlayProvider Effect] Setting showOverlay to: ${shouldShow}`);
            setShowOverlayState(shouldShow);
        }
    }, [errorInfoState, showOverlayState]); // Added showOverlayState to deps

    // Stable callback using useCallback
    const addToastToHistoryStable = useCallback((toast: Omit<ToastRecord, 'id'>) => {
        // Add only actual toasts shown via useAppToast
        logger.debug("[ErrorOverlayContext CB] addToastToHistory", { type: toast.type, msg: String(toast.message)?.substring(0, 30) });
        setToastHistoryState(prev => {
            const newHistory = [...prev, { ...toast, id: Date.now() + Math.random() }];
            // Limit history size
            const MAX_TOASTS = 20;
            if (newHistory.length > MAX_TOASTS) {
                return newHistory.slice(newHistory.length - MAX_TOASTS);
            }
            return newHistory;
        });
    }, []); // No dependencies needed if only using setToastHistoryState

    // Renamed for clarity: This sets the error and implicitly shows the overlay
    // Stable callback using useCallback
    const addErrorInfoStable = useCallback((errorDetails: ErrorInfo) => {
         const newErrorInfo = {
             ...errorDetails,
             timestamp: errorDetails.timestamp || Date.now(),
         };
         // Log the error being set *before* updating state
         logger.error("[ErrorOverlayContext CB] addErrorInfo (setting error, will trigger overlay)", newErrorInfo);
         setErrorInfoState(newErrorInfo); // This will update errorInfoState and trigger showOverlay=true effect via useEffect
     }, []); // No dependencies needed if only using setErrorInfoState

    // Stable callback using useCallback
    const clearHistoryStable = useCallback(() => {
        logger.info("[ErrorOverlayContext CB] clearHistory called.");
        setToastHistoryState([]);
        setErrorInfoState(null); // This will update errorInfoState and trigger showOverlay=false effect via useEffect
    }, []); // No dependencies needed if only using states setters


    // --- REMOVED Logger Integration useEffect ---

    // Memoize the context value, depends on state values and stable callbacks
    const contextValue = useMemo((): ErrorOverlayContextType => {
        logger.debug("[ErrorOverlayProvider] Memoizing context value."); // Keep for debugging memoization
        return {
            toastHistory: toastHistoryState, // Use state value
            errorInfo: errorInfoState,         // Use state value
            isClientReady: isClientReadyState, // Use state value
            addToastToHistory: addToastToHistoryStable, // Use stable callback
            addErrorInfo: addErrorInfoStable,           // Use stable callback
            clearHistory: clearHistoryStable,           // Use stable callback
            showOverlay: showOverlayState,              // Use state value
        };
    }, [
        toastHistoryState,
        errorInfoState,
        isClientReadyState,
        showOverlayState,
        // Stable callbacks don't need to be dependencies for useMemo here,
        // but including them doesn't hurt and makes it explicit what the value contains.
        addToastToHistoryStable,
        addErrorInfoStable,
        clearHistoryStable,
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