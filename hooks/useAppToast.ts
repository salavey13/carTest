"use client";
import { toast as sonnerToast } from 'sonner';
import { useErrorOverlay } from '@/contexts/ErrorOverlayContext';
import type { ToastRecord } from '@/types/toast';
import { debugLogger as logger } from '@/lib/debugLogger';
import { useCallback, useMemo } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' | 'custom';

/**
 * Custom hook for displaying toasts using 'sonner' and logging them to the ErrorOverlayContext history.
 */
export const useAppToast = () => {
    const errorOverlay = useErrorOverlay();

    const isReady = !!errorOverlay && typeof errorOverlay.addToastToHistory === 'function';

    if (!isReady && typeof window !== 'undefined') {
        logger.warn("useAppToast: ErrorOverlayContext not fully ready yet. Toasts will show but might not be logged correctly.", {
             hasErrorOverlay: !!errorOverlay,
             hasAddToastFunc: typeof errorOverlay?.addToastToHistory === 'function'
        });
    }

    const showToast = useCallback((
        type: ToastType,
        message: string | React.ReactNode,
        options?: any
    ) => {
        if (!isReady) {
            // Use console.warn as logger might not be ready if context isn't
             console.warn(`[Toast Suppressed/Context Not Ready] ${type}:`, message);
             // Attempt direct display anyway
             try {
                 if (typeof (sonnerToast as any)[type] === 'function') {
                    (sonnerToast as any)[type](message, options);
                 } else if (type === 'custom' && typeof message === 'function') {
                     sonnerToast.custom(message as (id: number | string) => React.ReactNode, options);
                 } else {
                    sonnerToast.message(String(message), options); // Fallback to message
                 }
             } catch (e) {
                 console.error("Error showing direct toast when context not ready:", e);
             }
            return undefined;
        }

        const addToastToHistory = errorOverlay?.addToastToHistory;

        try {
            const messageString = typeof message === 'string' ? message : '[ReactNode]';

            let toastId: string | number | undefined;
            switch(type) {
                case 'success': toastId = sonnerToast.success(message, options); break;
                case 'error': toastId = sonnerToast.error(message, options); break;
                case 'info': toastId = sonnerToast.info(message, options); break;
                case 'warning': toastId = sonnerToast.warning(message, options); break;
                case 'loading': toastId = sonnerToast.loading(message, options); break;
                case 'custom':
                    if (typeof message === 'function') {
                       toastId = sonnerToast.custom(message as (id: number | string) => React.ReactNode, options);
                    } else {
                        logger.warn("useAppToast: 'custom' type requires a function as message.");
                        toastId = sonnerToast.message(messageString, options);
                    }
                    break;
                case 'message':
                default:
                    toastId = sonnerToast.message(message, options); break;
            }

            // Add to history ONLY if context/function is ready
             if (messageString && addToastToHistory) {
                try {
                    const record: Omit<ToastRecord, 'id'> = {
                        message: messageString,
                        type: type === 'custom' ? 'info' : type,
                        timestamp: Date.now(),
                    };
                    addToastToHistory(record);
                } catch (logError) {
                    logger.error("useAppToast: Failed to add toast to history", logError);
                }
            } else if (type !== 'custom' && !addToastToHistory) {
                 // Use console.warn if logger might be unavailable
                 console.warn("useAppToast: Could not add toast to history because addToastToHistory is not available", { type });
            }

            return toastId;

        } catch (err) {
            logger.error("Error in useAppToast while showing/logging toast:", err, { type, message, options });
            try {
                sonnerToast.error("Internal issue: Could not display toast.", { duration: 2000 });
            } catch { /* Silently fail */ }
            return undefined;
        }
    }, [isReady, errorOverlay]); // Added dependencies for useCallback


    // Fallback using console directly
    const notReadyWarn = useCallback((method: string, msg?: any) => {
        console.warn(`useAppToast: Attempted to call ${method} while context potentially not ready. Message:`, msg);
        console.warn(`[Toast Method Suppressed/Context Not Ready] ${method}`);
        try {
            if (method === 'dismiss') {
                sonnerToast.dismiss(msg);
            } else if (typeof (sonnerToast as any)[method] === 'function') {
                 (sonnerToast as any)[method](msg);
            } else {
                sonnerToast.message(String(msg || 'Suppressed toast call'));
            }
        } catch(e) {
             console.error("Error during fallback sonner call:", e);
        }
    }, []);

    // Memoize the returned object
    return useMemo(() => {
        // Return dummy functions if not ready
        if (!isReady) {
             return {
                 success: (msg: any, opts?: any) => notReadyWarn('success', msg),
                 error: (msg: any, opts?: any) => notReadyWarn('error', msg),
                 info: (msg: any, opts?: any) => notReadyWarn('info', msg),
                 warning: (msg: any, opts?: any) => notReadyWarn('warning', msg),
                 loading: (msg: any, opts?: any) => notReadyWarn('loading', msg),
                 message: (msg: any, opts?: any) => notReadyWarn('message', msg),
                 custom: (fn: any, opts?: any) => notReadyWarn('custom', '[Function]'),
                 dismiss: (id?: any) => notReadyWarn('dismiss', id),
             };
        }
        // Return real functions bound to showToast if ready
        return {
            success: (message: string | React.ReactNode, options?: any) => showToast('success', message, options),
            error: (message: string | React.ReactNode, options?: any) => showToast('error', message, options),
            info: (message: string | React.ReactNode, options?: any) => showToast('info', message, options),
            warning: (message: string | React.ReactNode, options?: any) => showToast('warning', message, options),
            loading: (message: string | React.ReactNode, options?: any) => showToast('loading', message, options),
            message: (message: string | React.ReactNode, options?: any) => showToast('message', message, options),
            custom: (component: (id: number | string) => React.ReactNode, options?: any) => showToast('custom', component, options),
            dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
        }
    // Ensure dependencies are correct
    }, [isReady, errorOverlay, showToast, notReadyWarn]);

};