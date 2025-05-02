"use client";
import { toast as sonnerToast } from 'sonner';
import { useErrorOverlay } from '@/contexts/ErrorOverlayContext';
// --- REMOVED useAppContext import ---
import type { ToastRecord } from '@/types/toast';
import { debugLogger as logger } from '@/lib/debugLogger';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' | 'custom';

/**
 * Custom hook for displaying toasts using 'sonner' and logging them to the ErrorOverlayContext history.
 * FOCUS: Logging toasts, NOT conditional display based on debug flags.
 */
export const useAppToast = () => {
    const errorOverlay = useErrorOverlay();

    // --- SIMPLIFIED isReady check ---
    // Only need ErrorOverlayContext now
    const isReady = !!errorOverlay && typeof errorOverlay.addToastToHistory === 'function';

    if (!isReady && typeof window !== 'undefined') {
        logger.warn("useAppToast: ErrorOverlayContext not fully ready yet. Toasts will show but might not be logged correctly.", {
             hasErrorOverlay: !!errorOverlay,
             hasAddToastFunc: typeof errorOverlay?.addToastToHistory === 'function'
        });
    }

    // Generic function to show toast and add to history
    const showToast = (
        type: ToastType,
        message: string | React.ReactNode,
        options?: any
    ) => {
        // Re-check readiness inside the function call for extra safety
        // If not ready, log a warning but still attempt to show the toast via sonner directly
        if (!isReady) {
            logger.warn("useAppToast: Context not ready, attempting direct toast display.", { type, message });
        }

        const addToastToHistory = errorOverlay?.addToastToHistory; // Safely access function

        try {
            const messageString = typeof message === 'string' ? message : '[ReactNode]';

            // --- REMOVED DEBUG FLAG CHECK ---

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
                 logger.warn("useAppToast: Could not add toast to history because addToastToHistory is not available", { type });
            }

            return toastId;

        } catch (err) {
            logger.error("Error in useAppToast while showing/logging toast:", err, { type, message, options });
            try {
                sonnerToast.error("Internal error: Could not display toast.", { duration: 2000 });
            } catch { /* Silently fail */ }
            return undefined;
        }
    };

    // Return the API mirroring sonner
    const notReadyWarn = useCallback((method: string, msg?: any) => {
        logger.warn(`useAppToast: Attempted to call ${method} while context potentially not ready. Message:`, msg);
        // Still attempt direct sonner call as a fallback
        try {
            if (method === 'dismiss') {
                sonnerToast.dismiss(msg);
            } else if (typeof (sonnerToast as any)[method] === 'function') {
                 (sonnerToast as any)[method](msg);
            } else {
                sonnerToast.message(msg); // Default fallback
            }
        } catch(e) {
             logger.error("Error during fallback sonner call:", e);
        }
    }, []);

    // Return memoized functions
    return useMemo(() => ({
        success: (message: string | React.ReactNode, options?: any) => showToast('success', message, options),
        error: (message: string | React.ReactNode, options?: any) => showToast('error', message, options),
        info: (message: string | React.ReactNode, options?: any) => showToast('info', message, options),
        warning: (message: string | React.ReactNode, options?: any) => showToast('warning', message, options),
        loading: (message: string | React.ReactNode, options?: any) => showToast('loading', message, options),
        message: (message: string | React.ReactNode, options?: any) => showToast('message', message, options),
        custom: (component: (id: number | string) => React.ReactNode, options?: any) => showToast('custom', component, options),
        dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    }), [isReady, errorOverlay, showToast]); // Dependencies ensure re-memoization if context becomes ready

};