import type { ToastRecord } from '@/types/toast';

type ToastHistoryListener = (record: Omit<ToastRecord, 'id'>) => void;

class ToastHistoryManager {
  private listener: ToastHistoryListener | null = null;

  // UI-контекст (ErrorOverlayProvider) подпишется на события
  subscribe(listener: ToastHistoryListener) {
    this.listener = listener;
    // Возвращаем функцию для отписки
    return () => {
      this.listener = null;
    };
  }

  // Хук useAppToast будет вызывать этот метод
  addToast(record: Omit<ToastRecord, 'id'>) {
    if (this.listener) {
      try {
        this.listener(record);
      } catch (e) {
        console.error("[toastHistoryManager] Listener failed:", e);
      }
    }
  }
}

// Экспортируем единственный экземпляр
export const toastHistoryManager = new ToastHistoryManager();