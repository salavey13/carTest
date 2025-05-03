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

    // Log warning only once if context isn't ready on first render client-side
    useMemo(() => {
        if (!isReady && typeof window !== 'undefined') {
            logger.warn("useAppToast Initializing: ErrorOverlayContext not fully ready yet. Toasts will show but might not be logged correctly initially.", {
                 hasErrorOverlay: !!errorOverlay,
                 hasAddToastFunc: typeof errorOverlay?.addToastToHistory === 'function'
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    const showToast = useCallback((
        type: ToastType,
        message: string | React.ReactNode,
        options?: any
    ) => {
        const logWarn = logger.warn; // Assume logger is available
        const logError = logger.error;

        // Check readiness *inside* the function that uses it
        const currentIsReady = !!errorOverlay && typeof errorOverlay.addToastToHistory === 'function';
        const addToastToHistory = currentIsReady ? errorOverlay.addToastToHistory : null;

        if (!currentIsReady) {
            logWarn("useAppToast: Context not ready at time of toast call, logging to history will be skipped.", { type, messageString: typeof message === 'string' ? message : '[ReactNode]' });
        }

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
                        logWarn("useAppToast: 'custom' type requires a function as message. Falling back to 'message'.");
                        toastId = sonnerToast.message(messageString, options); // Fallback for custom
                    }
                    break;
                case 'message':
                default:
                    toastId = sonnerToast.message(message, options); break;
            }

            // Add to history ONLY if context/function is ready *at the time of call*
             if (messageString !== '[ReactNode]' && addToastToHistory) { // Also ensure message isn't just a node for logging
                try {
                    const record: Omit<ToastRecord, 'id'> = {
                        message: messageString,
                        type: type === 'custom' ? 'info' : type, // Log custom as info
                        timestamp: Date.now(),
                    };
                    addToastToHistory(record);
                } catch (loggingError) { // Catch potential errors during logging itself
                    logError("useAppToast: Failed to add toast to history", loggingError);
                }
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
    }, [errorOverlay]); // Depend only on errorOverlay to re-check readiness inside


    // Memoize the returned object of functions
    // CRITICAL FIX: Remove the conditional logic inside useMemo
    return useMemo(() => {
        logger.debug("useAppToast: Re-memoizing returned functions object.");
        // ALWAYS return the same object structure, relying on showToast to handle readiness internally.
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
    // showToast is stable due to useCallback with stable dependencies
    }, [showToast]);

};