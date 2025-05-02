"use client";
import { toast as sonnerToast } from 'sonner';
import { useErrorOverlay } from '@/contexts/ErrorOverlayContext';
import { useAppContext } from '@/contexts/AppContext'; // <-- Импортируем useAppContext
import type { ToastRecord } from '@/types/toast';
import { debugLogger as logger } from '@/lib/debugLogger'; // Optional: for debugging the hook itself

// Define possible toast types based on sonner's typical API
type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' | 'custom'; // 'message' is the default

/**
 * Custom hook for displaying toasts using 'sonner' and logging them to the ErrorOverlayContext history.
 * Use this hook throughout the application instead of importing 'toast' directly from 'sonner'.
 * Provides centralized control over toast display (e.g., disabling debug toasts).
 *
 * @returns An object with methods mirroring the 'sonner' API (success, error, info, etc.).
 */
export const useAppToast = () => {
    const errorOverlay = useErrorOverlay(); // Get the whole context
    const appContext = useAppContext(); // Get the whole context

    // Ensure contexts are loaded before trying to use them
    // This check is important, especially if this hook is used early in the render tree
    const isReady = !!errorOverlay && !!appContext && appContext.hasOwnProperty('debugToastsEnabled') && typeof errorOverlay.addToastToHistory === 'function';
    // Add specific check for addToastToHistory availability from errorOverlay

    if (!isReady && typeof window !== 'undefined') { // Log only once client-side if not ready
        logger.warn("useAppToast: Contexts not fully ready yet. Toasts might be suppressed or logged incorrectly.", {
             hasErrorOverlay: !!errorOverlay,
             hasAppContext: !!appContext,
             hasDebugFlag: appContext?.hasOwnProperty('debugToastsEnabled'),
             hasAddToastFunc: typeof errorOverlay?.addToastToHistory === 'function'
        });
    }


    // Generic function to show toast and add to history
    const showToast = (
        type: ToastType,
        message: string | React.ReactNode, // Sonner accepts ReactNode
        options?: any // Sonner options object
    ) => {
        // Re-check readiness inside the function call for extra safety
        if (!isReady) {
            logger.warn("useAppToast: Contexts not ready, toast suppressed.", { type, message });
            console.warn(`[Toast Suppressed/Context Not Ready] ${type}:`, message);
            return undefined;
        }

        const { addToastToHistory } = errorOverlay;
        const { debugToastsEnabled } = appContext;

        try {
            // Convert ReactNode message to string for history (simplification)
            const messageString = typeof message === 'string' ? message : '[ReactNode]';

            // --- ПРОВЕРКА ФЛАГА ---
            if (messageString.startsWith('[DEBUG]') && !debugToastsEnabled) {
                 // logger.debug(`Muted Debug Toast: ${messageString}`);
                 return undefined; // Не показываем тост
            }
            // --- КОНЕЦ ПРОВЕРКИ ---


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

            // Add to history only if message is a string and function exists
             if (messageString && addToastToHistory) {
                const record: Omit<ToastRecord, 'id'> = {
                    message: messageString,
                    type: type === 'custom' ? 'info' : type,
                    timestamp: Date.now(),
                };
                addToastToHistory(record);
            } else if (type !== 'custom') {
                 logger.warn("useAppToast: Could not add non-string toast message to history or addToastToHistory not available", { type, hasFunc: !!addToastToHistory });
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
    // If not ready, return dummy functions that log warnings
    const notReadyWarn = useCallback((method: string, msg?: any) => {
        logger.warn(`useAppToast: Attempted to call ${method} before context was ready. Message:`, msg);
        console.warn(`[Toast Method Suppressed/Context Not Ready] ${method}`);
    }, []); // Empty dependency array for stable callback

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

    // Return memoized functions if ready
    return useMemo(() => ({
        success: (message: string | React.ReactNode, options?: any) => showToast('success', message, options),
        error: (message: string | React.ReactNode, options?: any) => showToast('error', message, options),
        info: (message: string | React.ReactNode, options?: any) => showToast('info', message, options),
        warning: (message: string | React.ReactNode, options?: any) => showToast('warning', message, options),
        loading: (message: string | React.ReactNode, options?: any) => showToast('loading', message, options),
        message: (message: string | React.ReactNode, options?: any) => showToast('message', message, options),
        custom: (component: (id: number | string) => React.ReactNode, options?: any) => showToast('custom', component, options),
        dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    }), [isReady, errorOverlay, appContext, showToast]); // Depend on readiness and context instances

};