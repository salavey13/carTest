"use client";
import { toast as sonnerToast } from 'sonner';
import { useErrorOverlay } from '@/contexts/ErrorOverlayContext';
import type { ToastRecord } from '@/types/toast';
import { debugLogger as logger } from '@/lib/debugLogger';
import { useCallback, useMemo } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' | 'custom';

/**
 * Custom hook for displaying toasts using 'sonner' and logging them to the ErrorOverlayContext history.
 * Made more resilient to context initialization order.
 */
export const useAppToast = () => {
    // Get context hook result. It might be the default value initially.
    const errorOverlay = useErrorOverlay();

    // Memoize the core toast showing logic. This depends ONLY on the `errorOverlay` reference
    // (which is stable after the context provider mounts) and the logger.
    const showToast = useCallback((
        type: ToastType,
        message: string | React.ReactNode,
        options?: any
    ) => {
        // Grab specific functions from context *inside* the callback
        // This ensures we use the latest functions if the context value updates,
        // while keeping the callback itself stable.
        // Check if context and its methods are ready *at the time of the call*
        const isContextReadyNow = !!errorOverlay && typeof errorOverlay.addToastToHistory === 'function';
        const addToastToHistoryFunc = isContextReadyNow ? errorOverlay.addToastToHistory : null;

        // Log context readiness status during the call
        if (!isContextReadyNow) {
            logger.warn("useAppToast: Context not ready at time of toast call, logging to history will be skipped.", { type, messageString: typeof message === 'string' ? message : '[ReactNode]' });
        } else {
            logger.debug("useAppToast: Context ready, proceeding with toast and logging.");
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
                        logger.warn("useAppToast: 'custom' type requires a function as message. Falling back to 'message'.");
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
                    logger.debug("useAppToast: Added toast to history:", record);
                } catch (loggingError) { // Catch potential errors during logging itself
                    logger.error("useAppToast: Failed to add toast to history", loggingError);
                }
            } else if (!addToastToHistoryFunc) {
                 logger.debug("useAppToast: Skipped adding toast to history because context function was not available.");
            } else {
                 logger.debug("useAppToast: Skipped adding ReactNode/CustomComponent toast content to history.");
            }

            return toastId;

        } catch (err) {
            logger.error("Error in useAppToast while showing/logging toast:", err, { type, messageString: typeof message === 'string' ? message : '[ReactNode]', options });
            try {
                // Attempt a fallback native toast
                sonnerToast.error("Internal issue: Could not display toast.", { duration: 2000 });
            } catch { /* Silently fail if even fallback fails */ }
            return undefined;
        }
    }, [errorOverlay]); // Depend only on the stable context reference


    // Memoize the returned object of functions using the stable showToast callback
    return useMemo(() => {
        logger.debug("useAppToast: Re-memoizing returned functions object."); // Keep for debugging memoization
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