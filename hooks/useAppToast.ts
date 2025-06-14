"use client";
import { toast as sonnerToast } from 'sonner';
import { useErrorOverlay } from '@/contexts/ErrorOverlayContext';
import type { ToastRecord } from '@/types/toast';
import { debugLogger as logger } from '@/lib/debugLogger';
import { useCallback, useMemo } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message' | 'custom';

export const useAppToast = () => {
    const errorOverlay = useErrorOverlay();

    const showToast = useCallback((
        type: ToastType,
        message: string | React.ReactNode,
        options?: any
    ) => {
        const isContextReadyNow = !!errorOverlay && typeof errorOverlay.addToastToHistory === 'function';
        const addToastToHistoryFunc = isContextReadyNow ? errorOverlay.addToastToHistory : null;

        if (!isContextReadyNow) {
            logger.warn("useAppToast: Context not ready at time of toast call, logging to history will be skipped.", { type, messageString: typeof message === 'string' ? message : '[ReactNode]' });
        }

        try {
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
                        toastId = sonnerToast.message(messageString, options); 
                    }
                    break;
                case 'message':
                default:
                    toastId = sonnerToast.message(message, options); break;
            }

             if (messageString !== '[ReactNode]' && messageString !== '[Custom Component]' && addToastToHistoryFunc) {
                try {
                    const record: Omit<ToastRecord, 'id'> = {
                        message: messageString, 
                        type: type === 'custom' ? 'info' : type, 
                        timestamp: Date.now(),
                    };
                    addToastToHistoryFunc(record);
                } catch (loggingError) { 
                    logger.error("useAppToast: Failed to add toast to history", loggingError);
                }
            }
            return toastId;
        } catch (err) {
            logger.error("Error in useAppToast while showing/logging toast:", err, { type, messageString: typeof message === 'string' ? message : '[ReactNode]', options });
            try {
                sonnerToast.error("Internal issue: Could not display toast.", { duration: 2000 });
            } catch {  }
            return undefined;
        }
    }, [errorOverlay]); // Dependency on errorOverlay ensures stability if context reference itself doesn't change.

    return useMemo(() => {
        // logger.debug("useAppToast: Re-memoizing returned functions object."); // This log can be very noisy
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
    }, [showToast]); 
};