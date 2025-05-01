import { toast as sonnerToast } from 'sonner';
import { useErrorOverlay } from '@/contexts/ErrorOverlayContext';
import { useAppContext } from '@/contexts/AppContext'; // <-- Импортируем useAppContext
import type { ToastRecord } from '@/types/toast';
import { debugLogger as logger } from '@/lib/debugLogger';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' | 'custom';

export const useAppToast = () => {
    const { addToastToHistory } = useErrorOverlay();
    const { debugToastsEnabled } = useAppContext(); // <-- Получаем флаг из AppContext

    const showToast = (
        type: ToastType,
        message: string | React.ReactNode,
        options?: any
    ) => {
        try {
            const messageString = typeof message === 'string' ? message : '[ReactNode]';

            // --- ПРОВЕРКА ФЛАГА ---
            if (messageString.startsWith('[DEBUG]') && !debugToastsEnabled) {
                // logger.debug(`Muted Toast: ${messageString}`); // Логируем в консоль, если нужно
                return undefined; // Не показываем тост
            }
            // --- КОНЕЦ ПРОВЕРКИ ---

            let toastId: string | number | undefined;
            switch(type) {
                // ... (кейсы остаются без изменений) ...
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

             if (messageString) {
                const record: Omit<ToastRecord, 'id'> = {
                    message: messageString,
                    type: type === 'custom' ? 'info' : type, // Log custom as info for simplicity
                    timestamp: Date.now(),
                };
                addToastToHistory(record);
            } else if (type !== 'custom') {
                 logger.warn("useAppToast: Could not add non-string toast message to history", { type });
            }

            return toastId;

        } catch (err) {
            logger.error("Error in useAppToast while showing/logging toast:", err);
            try {
                sonnerToast.error("Internal error: Could not display toast.", { duration: 2000 });
            } catch { /* Silently fail */ }
            return undefined;
        }
    };

    // Return the API mirroring sonner
    return {
        success: (message: string | React.ReactNode, options?: any) => showToast('success', message, options),
        error: (message: string | React.ReactNode, options?: any) => showToast('error', message, options),
        info: (message: string | React.ReactNode, options?: any) => showToast('info', message, options),
        warning: (message: string | React.ReactNode, options?: any) => showToast('warning', message, options),
        loading: (message: string | React.ReactNode, options?: any) => showToast('loading', message, options),
        message: (message: string | React.ReactNode, options?: any) => showToast('message', message, options),
        custom: (component: (id: number | string) => React.ReactNode, options?: any) => showToast('custom', component, options),
        dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    };
};