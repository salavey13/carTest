"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ErrorInfo as ReactErrorInfo } from 'react';
import type { ToastRecord } from '@/types/toast';
import { debugLogger, LogHandler } from '@/lib/debugLogger';

// --- Types ---

export type ErrorSourceType = 'react' | 'network' | 'javascript' | 'custom' | 'promise';

export interface ErrorInfo {
    type: ErrorSourceType;
    message: string;
    timestamp?: number;
    componentStack?: string | null;
    stack?: string; // Native error stack
    source?: string; // e.g., component name, function name, URL
    extra?: Record<string, any>; // For additional context
}

interface ErrorOverlayContextType {
    history: ToastRecord[];
    errorInfo: ErrorInfo | null;
    isClientReady: boolean;
    addToastToHistory: (toast: Omit<ToastRecord, 'id'>) => void;
    addErrorInfo: (errorDetails: ErrorInfo) => void;
    clearHistory: () => void;
    setHandler: (handler: LogHandler | null) => void; // For logger integration
}

// --- Context ---

const defaultState: ErrorOverlayContextType = {
    history: [],
    errorInfo: null,
    isClientReady: false,
    addToastToHistory: () => { console.warn("ErrorOverlayContext: addToastToHistory called before provider ready."); },
    addErrorInfo: () => { console.warn("ErrorOverlayContext: addErrorInfo called before provider ready."); },
    clearHistory: () => { console.warn("ErrorOverlayContext: clearHistory called before provider ready."); },
    setHandler: () => { console.warn("ErrorOverlayContext: setHandler called before provider ready."); },
};

const ErrorOverlayContext = createContext<ErrorOverlayContextType>(defaultState);

// --- Provider ---

export const ErrorOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [history, setHistory] = useState<ToastRecord[]>([]);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
    const [isClientReady, setIsClientReady] = useState(false);
    const logHandlerRef = useRef<LogHandler | null>(null); // Ref for the handler

    useEffect(() => {
        setIsClientReady(true);
        debugLogger.info("[ErrorOverlayProvider Effect] Client is ready, Provider mounted.");
    }, []);

    const addToastToHistory = useCallback((toast: Omit<ToastRecord, 'id'>) => {
        // Assume logger is safe to use after mount
        debugLogger.debug("[ErrorOverlayContext CB] addToastToHistory", { type: toast.type, msg: toast.message.substring(0, 30) });
        setHistory(prev => {
            const newHistory = [...prev, { ...toast, id: Date.now() + Math.random() }];
            // Optional: Limit history size
            // if (newHistory.length > 100) {
            //     return newHistory.slice(newHistory.length - 100);
            // }
            return newHistory;
        });
    }, []); // No dependencies needed if only using setHistory

    const addErrorInfo = useCallback((errorDetails: ErrorInfo) => {
         const newErrorInfo = {
             ...errorDetails,
             timestamp: errorDetails.timestamp || Date.now(),
         };
         debugLogger.error("[ErrorOverlayContext CB] addErrorInfo", newErrorInfo);
         setErrorInfo(newErrorInfo);
     }, []); // No dependencies needed if only using setErrorInfo

    const clearHistory = useCallback(() => {
        debugLogger.info("[ErrorOverlayContext CB] clearHistory called.");
        setHistory([]);
        setErrorInfo(null); // Also clear the main error display
    }, []); // No dependencies needed

    // --- Logger Integration ---
    // Function to set the handler in the logger
    const setHandler = useCallback((handler: LogHandler | null) => {
        debugLogger.info(`[ErrorOverlayContext CB] setHandler called. Handler ${handler ? 'provided' : 'cleared'}.`);
        logHandlerRef.current = handler;
        // Pass the handler to the logger instance
        debugLogger.setLogHandler(handler);
    }, []); // No dependencies needed

    // Effect to set the initial handler for the logger when the component mounts
    useEffect(() => {
        const handler: LogHandler = (level, message, timestamp) => {
            // Add logs to history (similar to toasts)
            // Map logger levels to toast types (optional, can simplify)
            let toastType: ToastRecord['type'] = 'info';
            switch (level) {
                case 'error': case 'fatal': toastType = 'error'; break;
                case 'warn': toastType = 'warning'; break;
                case 'debug': toastType = 'info'; break; // Or handle differently
                case 'log': toastType = 'message'; break;
                default: toastType = 'info';
            }
            // Avoid logging the log message itself if it came *from* the logger to prevent loops?
            // Careful here, maybe filter based on message content or add flag?
            // For now, let's log everything passed *to* the handler.
             try {
                // Check ref just in case, although unlikely to be null here
                if (logHandlerRef.current) {
                    addToastToHistory({ message, type: toastType, timestamp });
                }
            } catch (e) {
                 // Fallback console log if addToastToHistory fails inside handler
                 console.error("!!! Error inside LogHandler adding toast:", e, { level, message, timestamp });
            }
        };

        debugLogger.info("[ErrorOverlayProvider Effect] Setting logger handler.");
        setHandler(handler); // Use the stable setter

        // Cleanup: Remove handler when provider unmounts
        return () => {
            debugLogger.info("[ErrorOverlayProvider Cleanup] Clearing logger handler.");
            setHandler(null); // Use the stable setter
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount, setHandler is stable


    // *** FIX: Memoize the context value ***
    const contextValue = useMemo(() => {
        debugLogger.debug("[ErrorOverlayProvider] Memoizing context value.");
        return {
            history,
            errorInfo,
            isClientReady,
            addToastToHistory,
            addErrorInfo,
            clearHistory,
            setHandler, // Include the stable setter
        };
    }, [
        history,
        errorInfo,
        isClientReady,
        addToastToHistory, // Stable callback
        addErrorInfo,      // Stable callback
        clearHistory,      // Stable callback
        setHandler         // Stable callback
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
        // This error should ideally not happen if the provider wraps the app
        debugLogger.fatal("useErrorOverlay must be used within an ErrorOverlayProvider");
        throw new Error('useErrorOverlay must be used within an ErrorOverlayProvider');
    }
    // Add a check to see if it's still the default value, indicating provider might not be ready
    if (context.addToastToHistory === defaultState.addToastToHistory && typeof window !== 'undefined') {
         debugLogger.warn("useErrorOverlay: Context seems to hold default value. Provider might not be fully initialized yet.");
    }
    return context;
};