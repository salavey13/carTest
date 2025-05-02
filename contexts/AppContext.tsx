"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react"; // Добавили useState
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { toast } from "sonner"; // Используем напрямую для тостов авторизации, т.к. useAppToast зависит от этого контекста

// Define the shape of the context data
// Combine Telegram data with our new state
interface AppContextData extends ReturnType<typeof useTelegram> {
  debugToastsEnabled: boolean;
  setDebugToastsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

// Create the context with an initial undefined value
// Use Partial to allow undefined during initialization before Provider runs
const AppContext = createContext<Partial<AppContextData>>({}); // Используем Partial

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get data from the useTelegram hook
  const telegramData = useTelegram();

  // --- Состояние для включения/выключения отладочных тостов ---
  const [debugToastsEnabled, setDebugToastsEnabled] = useState<boolean>(true); // <-- Флаг теперь здесь, true по умолчанию для отладки
  // ----------------------------------------------------------

  // Combine telegram data and the new state/setter into the context value
  const contextValue = useMemo(() => ({
    ...telegramData,
    debugToastsEnabled,
    setDebugToastsEnabled,
  }), [telegramData, debugToastsEnabled]); // Добавляем debugToastsEnabled в зависимости

  // Log context changes for debugging (only when contextValue actually changes)
  useEffect(() => {
    // Логируем только когда contextValue действительно изменился (проверка по ссылке)
    debugLogger.log("AppContext updated:", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserStatus: contextValue.dbUser?.status,
      error: contextValue.error?.message,
      isInTelegram: contextValue.isInTelegramContext,
      debugToastsEnabled: contextValue.debugToastsEnabled, // Логируем новый флаг
    });
  }, [contextValue]); // Зависимость от contextValue (который мемоизирован)


  // Centralize the "User Authorized" toast notification
  // Этот useEffect использует `toast` напрямую из 'sonner',
  // потому что `useAppToast` сам зависит от `AppContext` и мы не можем его здесь использовать.
  useEffect(() => {
    let currentToastId: string | number | undefined;
    let loadingTimer: NodeJS.Timeout | null = null;

    // Показываем тост загрузки, только если она занимает заметное время
    if (contextValue.isLoading) {
       // Добавляем задержку, чтобы не показывать тост при быстрой загрузке
       loadingTimer = setTimeout(() => {
          // Показываем тост только если все еще грузится
          if (contextValue.isLoading && document.visibilityState === 'visible') { // Проверка видимости
             debugLogger.debug("[AppContext] Showing auth loading toast...");
             currentToastId = toast.loading("Авторизация...", { id: "auth-loading-toast" });
          }
       }, 300); // 300ms задержка
    } else {
        // Если загрузка завершилась до таймера, отменяем его
        if (loadingTimer) clearTimeout(loadingTimer);
        // Убираем тост загрузки, если он был показан
        debugLogger.debug("[AppContext] Dismissing auth loading toast (if any)...");
        toast.dismiss("auth-loading-toast");

        // Показываем тост успеха ТОЛЬКО ОДИН РАЗ при успешной авторизации
        if (contextValue.isAuthenticated && !contextValue.error) {
            // Используем ID, чтобы тост не дублировался при быстрых обновлениях
            // Проверяем видимость документа, чтобы не показывать тост в фоне
             if (document.visibilityState === 'visible') {
                 debugLogger.debug("[AppContext] Showing auth success toast...");
                 currentToastId = toast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2000 });
             }
        }
        // Опционально: показываем тост ошибки при неудаче
        else if (contextValue.error) {
            if (document.visibilityState === 'visible') {
                 debugLogger.error("[AppContext] Showing auth error toast:", contextValue.error);
                 currentToastId = toast.error("Ошибка авторизации", { id: "auth-error-toast", description: contextValue.error.message });
            }
        }
    }

    // Функция очистки для отмены таймера
    return () => {
        if (loadingTimer) {
            clearTimeout(loadingTimer);
        }
        // Опционально: скрывать тост при размонтировании? (Маловероятно для AppProvider)
        // if (currentToastId) {
        //     toast.dismiss(currentToastId);
        // }
    };
    // Зависимости: реагируем на изменение статуса аутентификации, загрузки и ошибки
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.error]);

  // Provide the memoized value to the context consumers
  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

// Custom hook for consuming the context
// Update the return type to match the full AppContextData
export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  // Ensure the hook is used within a provider and context is fully formed
  // Проверяем не только на undefined, но и наличие нашего нового поля
  if (!context || !context.hasOwnProperty('debugToastsEnabled')) {
    // Эта ошибка критична и означает неправильное использование контекста
     const error = new Error("useAppContext must be used within an AppProvider and after its initialization");
     debugLogger.fatal("useAppContext Error:", error); // Логируем критическую ошибку
     throw error;
  }
  // Cast to full type once checks pass
  return context as AppContextData;
};