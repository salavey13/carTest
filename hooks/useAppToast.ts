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

    // Memoize the showToast function for stability
    const showToast = useCallback((
        type: ToastType,
        message: string | React.ReactNode,
        options?: any
    ) => {
        const logWarn = logger.warn;
        const logError = logger.error;
        const logDebug = logger.debug;

        // Check context readiness *at the time of the call*
        const isContextReadyNow = !!errorOverlay && typeof errorOverlay.addToastToHistory === 'function';
        const addToastToHistoryFunc = isContextReadyNow ? errorOverlay.addToastToHistory : null;

        if (!isContextReadyNow) {
            logWarn("useAppToast: Context not ready at time of toast call, logging to history will be skipped.", { type, messageString: typeof message === 'string' ? message : '[ReactNode]' });
        } else {
            logDebug("useAppToast: Context ready, proceeding with toast and logging.");
        }

        try {
            // Determine message string for logging, avoid logging React nodes directly
            const messageString = typeof message === 'string' ? message : (type === 'custom' ? '[Custom Component]' : '[ReactNode]');

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
                        logWarn("useAppToast: 'custom' type requires a function as message. Falling back to 'message'.");
                        toastId = sonnerToast.message(messageString, options); // Fallback for custom
                    }
                    break;
                case 'message':
                default:
                    toastId = sonnerToast.message(message, options); break;
            }

            // Add to history ONLY if context/function is ready *and* message is loggable
             if (messageString !== '[ReactNode]' && messageString !== '[Custom Component]' && addToastToHistoryFunc) {
                try {
                    const record: Omit<ToastRecord, 'id'> = {
                        message: messageString, // Log the string representation
                        type: type === 'custom' ? 'info' : type, // Log custom as info for simplicity
                        timestamp: Date.now(),
                    };
                    addToastToHistoryFunc(record);
                } catch (loggingError) { // Catch potential errors during logging itself
                    logError("useAppToast: Failed to add toast to history", loggingError);
                }
            } else if (!addToastToHistoryFunc) {
                 logDebug("useAppToast: Skipped adding toast to history because context function was not available.");
            } else {
                 logDebug("useAppToast: Skipped adding ReactNode/CustomComponent toast content to history.");
            }

            return toastId;

        } catch (err) {
            logError("Error in useAppToast while showing/logging toast:", err, { type, messageString: typeof message === 'string' ? message : '[ReactNode]', options });
            try {
                // Attempt a fallback native toast
                sonnerToast.error("Internal issue: Could not display toast.", { duration: 2000 });
            } catch { /* Silently fail if even fallback fails */ }
            return undefined;
        }
    }, [errorOverlay]); // Depend only on errorOverlay reference


    // Memoize the returned object of functions using the stable showToast callback
    return useMemo(() => {
        // logger.debug("useAppToast: Re-memoizing returned functions object."); // Can be noisy
        return {
            success: (message: string | React.ReactNode, options?: any) => showToast('success', message, options),
            error: (message: string | React.ReactNode, options?: any) => showToast('error', message, options),
            info: (message: string | React.ReactNode, options?: any) => showToast('info', message, options),
            warning: (message: string | React.ReactNode, options?: any) => showToast('warning', message, options),
            loading: (message: string | React.ReactNode, options?: any) => showToast('loading', message, options),
            message: (message: string | React.ReactNode, options?: any) => showToast('message', message, options),
            custom: (component: (id: number | string) => React.ReactNode, options?: any) => showToast('custom', component, options),
            dismiss: (toastId?: string | number) => {
                try {
                    sonnerToast.dismiss(toastId);
                } catch (e) {
                    logger.error("Error dismissing toast:", e, { toastId });
                }
            },
        }
    }, [showToast]); // Depend only on the stable showToast callback

};