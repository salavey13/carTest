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
    const isReady = !!errorOverlay && !!appContext && appContext.hasOwnProperty('debugToastsEnabled');

    // Generic function to show toast and add to history
    const showToast = (
        type: ToastType,
        message: string | React.ReactNode, // Sonner accepts ReactNode
        options?: any // Sonner options object
    ) => {
        if (!isReady) {
            logger.warn("useAppToast: Contexts not ready, toast suppressed.", { type, message });
            // Fallback to console if contexts aren't ready?
            console.warn(`[Toast Suppressed/Context Not Ready] ${type}:`, message);
            return undefined;
        }

        const { addToastToHistory } = errorOverlay;
        const { debugToastsEnabled } = appContext;

        try {
            // Convert ReactNode message to string for history (simplification)
            const messageString = typeof message === 'string' ? message : '[ReactNode]'; // Or implement more complex serialization if needed

            // --- ПРОВЕРКА ФЛАГА ---
            if (messageString.startsWith('[DEBUG]') && !debugToastsEnabled) {
                // logger.debug(`Muted Toast: ${messageString}`); // Логируем в консоль, если нужно
                return undefined; // Не показываем тост
            }
            // --- КОНЕЦ ПРОВЕРКИ ---


            // Call the appropriate sonner function
            // Use a more robust way to call sonner methods
            let toastId: string | number | undefined;
            switch(type) {
                case 'success': toastId = sonnerToast.success(message, options); break;
                case 'error': toastId = sonnerToast.error(message, options); break;
                case 'info': toastId = sonnerToast.info(message, options); break;
                case 'warning': toastId = sonnerToast.warning(message, options); break;
                case 'loading': toastId = sonnerToast.loading(message, options); break;
                case 'custom':
                    // Assuming 'message' is the function for custom toasts in this context
                    if (typeof message === 'function') {
                       toastId = sonnerToast.custom(message as (id: number | string) => React.ReactNode, options);
                    } else {
                        logger.warn("useAppToast: 'custom' type requires a function as message.");
                        // Fallback to default message toast
                        toastId = sonnerToast.message(messageString, options);
                    }
                    break;
                case 'message': // Default case
                default:
                    toastId = sonnerToast.message(message, options); break; // Use 'message' for default
            }

            // Add to history only if message is a string (or successfully converted)
             if (messageString && addToastToHistory) { // Ensure addToastToHistory is available
                const record: Omit<ToastRecord, 'id'> = {
                    message: messageString,
                    type: type === 'custom' ? 'info' : type, // Log custom as info for simplicity
                    timestamp: Date.now(),
                };
                addToastToHistory(record);
            } else if (type !== 'custom') {
                 logger.warn("useAppToast: Could not add non-string toast message to history or addToastToHistory not available", { type, hasFunc: !!addToastToHistory });
            }
             // For custom toasts, logging might need specific handling if context is needed

            return toastId; // Return the ID like sonner does

        } catch (err) {
            logger.error("Error in useAppToast while showing/logging toast:", err);
            // Optionally, try a fallback toast notification about the failure
            try {
                sonnerToast.error("Internal error: Could not display toast.", { duration: 2000 });
            } catch { /* Silently fail */ }
            return undefined; // Indicate failure
        }
    };

    // Return the API mirroring sonner
    // If not ready, return dummy functions that log warnings
    if (!isReady) {
        const notReadyWarn = (method: string) => logger.warn(`useAppToast: Attempted to call ${method} before context was ready.`);
        return {
            success: (msg: any) => notReadyWarn('success'),
            error: (msg: any) => notReadyWarn('error'),
            info: (msg: any) => notReadyWarn('info'),
            warning: (msg: any) => notReadyWarn('warning'),
            loading: (msg: any) => notReadyWarn('loading'),
            message: (msg: any) => notReadyWarn('message'),
            custom: (fn: any) => notReadyWarn('custom'),
            dismiss: (id?: any) => notReadyWarn('dismiss'),
        };
    }

    return {
        success: (message: string | React.ReactNode, options?: any) => showToast('success', message, options),
        error: (message: string | React.ReactNode, options?: any) => showToast('error', message, options),
        info: (message: string | React.ReactNode, options?: any) => showToast('info', message, options),
        warning: (message: string | React.ReactNode, options?: any) => showToast('warning', message, options),
        loading: (message: string | React.ReactNode, options?: any) => showToast('loading', message, options),
        message: (message: string | React.ReactNode, options?: any) => showToast('message', message, options),
        custom: (component: (id: number | string) => React.ReactNode, options?: any) => showToast('custom', component, options),
        // Add dismiss, promise etc. if needed, ensuring they also log appropriately
        dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
        // 'promise' is more complex to log generically, might need specific handling
        // promise: sonnerToast.promise,
    };
};