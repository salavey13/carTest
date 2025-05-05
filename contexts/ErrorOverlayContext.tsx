"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ErrorInfo as ReactErrorInfo } from 'react';
import type { ToastRecord } from '@/types/toast';
import { debugLogger as logger } from '@/lib/debugLogger';

// --- Types ---

export type ErrorSourceType = 'react' | 'network' | 'javascript' | 'custom' | 'promise';

export interface ErrorInfo {
    type: ErrorSourceType;
    message: string;
    timestamp?: number;
    componentStack?: string | null;
    stack?: string;
    source?: string;
    error?: Error | any;
    extra?: Record<string, any>;
}

interface ErrorOverlayContextType {
    toastHistory: ToastRecord[];
    errorInfo: ErrorInfo | null;
    isClientReady: boolean;
    addToastToHistory: (toast: Omit<ToastRecord, 'id'>) => void;
    addErrorInfo: (errorDetails: ErrorInfo | null) => void; // Accept null for clearing
    clearHistory: () => void;
    showOverlay: boolean;
}

// --- Context ---

const defaultState: ErrorOverlayContextType = {
    toastHistory: [],
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
    const [toastHistoryState, setToastHistoryState] = useState<ToastRecord[]>([]);
    const [errorInfoState, setErrorInfoState] = useState<ErrorInfo | null>(null);
    const [isClientReadyState, setIsClientReadyState] = useState(false);
    const [showOverlayState, setShowOverlayState] = useState<boolean>(false);

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
    }, [errorInfoState, showOverlayState]);

    // Stable callback using useCallback
    const addToastToHistoryStable = useCallback((toast: Omit<ToastRecord, 'id'>) => {
        logger.debug("[ErrorOverlayContext CB] addToastToHistory", { type: toast.type, msg: String(toast.message)?.substring(0, 30) });
        setToastHistoryState(prev => {
            const newHistory = [...prev, { ...toast, id: Date.now() + Math.random() }];
            const MAX_TOASTS = 20;
            if (newHistory.length > MAX_TOASTS) {
                return newHistory.slice(newHistory.length - MAX_TOASTS);
            }
            return newHistory;
        });
    }, []);

    // Stable callback using useCallback - Modified to handle null for clearing
    const addErrorInfoStable = useCallback((errorDetails: ErrorInfo | null) => {
         if (errorDetails === null) {
             // Clear the error
             logger.info("[ErrorOverlayContext CB] addErrorInfo(null) called, clearing error.");
             setErrorInfoState(null); // This will trigger showOverlay=false effect
         } else {
             // Set a new error
             const newErrorInfo = {
                 ...errorDetails,
                 timestamp: errorDetails.timestamp || Date.now(), // Ensure timestamp exists
             };
             logger.error("[ErrorOverlayContext CB] addErrorInfo (setting error, will trigger overlay)", newErrorInfo);
             setErrorInfoState(newErrorInfo); // This will trigger showOverlay=true effect
         }
     }, []); // No dependencies needed if only using setErrorInfoState

    // Stable callback using useCallback
    const clearHistoryStable = useCallback(() => {
        logger.info("[ErrorOverlayContext CB] clearHistory called.");
        setToastHistoryState([]);
        setErrorInfoState(null); // This will trigger showOverlay=false effect
    }, []);


    // Memoize the context value, depends on state values and stable callbacks
    const contextValue = useMemo((): ErrorOverlayContextType => {
        logger.debug("[ErrorOverlayProvider] Memoizing context value.");
        return {
            toastHistory: toastHistoryState,
            errorInfo: errorInfoState,
            isClientReady: isClientReadyState,
            addToastToHistory: addToastToHistoryStable,
            addErrorInfo: addErrorInfoStable,
            clearHistory: clearHistoryStable,
            showOverlay: showOverlayState,
        };
    }, [
        toastHistoryState,
        errorInfoState,
        isClientReadyState,
        showOverlayState,
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
        console.error(`[${errorMsg}]`);
        throw new Error(errorMsg);
    }
    if (context.addErrorInfo === defaultState.addErrorInfo && typeof window !== 'undefined') {
         console.warn("[useErrorOverlay Hook] Context seems to hold default value. Provider might not be fully initialized yet or is missing higher up the tree.");
    }
    return context;
};

// Export necessary types
export type { ErrorInfo, ToastRecord, ErrorSourceType, ErrorOverlayContextType };