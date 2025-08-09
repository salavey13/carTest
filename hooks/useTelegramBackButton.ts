"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppContext } from '@/contexts/AppContext';
import { debugLogger as logger } from '@/lib/debugLogger';

export function useTelegramBackButton() {
  const { tg, isInTelegramContext } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInTelegramContext || !tg?.BackButton) {
      // Если мы не в Telegram или объект кнопки недоступен, ничего не делаем
      return;
    }

    const backButton = tg.BackButton;

    const handleBackClick = () => {
      logger.info('[Telegram BackButton] Back button clicked. Navigating back.');
      router.back();
    };

    // Показываем кнопку на всех страницах, кроме главной ('/')
    if (pathname !== '/') {
      if (!backButton.isVisible) {
        logger.debug(`[Telegram BackButton] Path is "${pathname}". Showing button.`);
        backButton.show();
      }
      // Устанавливаем или обновляем обработчик
      backButton.onClick(handleBackClick);
    } else {
      // Скрываем кнопку на главной странице
      if (backButton.isVisible) {
        logger.debug(`[Telegram BackButton] Path is "/". Hiding button.`);
        backButton.hide();
      }
    }

    // Очистка при размонтировании компонента или изменении пути
    return () => {
      if (isInTelegramContext && tg?.BackButton) {
        logger.debug(`[Telegram BackButton] Cleanup: removing onClick handler for path "${pathname}".`);
        // Важно убирать обработчик, чтобы избежать утечек памяти или вызова старых функций
        tg.BackButton.offClick(handleBackClick);
      }
    };
  }, [pathname, router, tg, isInTelegramContext]); // Перезапускаем эффект при смене пути
}