// hooks/useTelegram.ts
import { useEffect, useState } from 'react';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initTelegram = () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();
        tg.MainButton.setText('Complete Test →');
        setUser(tg.initDataUnsafe.user);
        setIsLoading(false);
      }
    };

    window.addEventListener('telegram-ready', initTelegram);
    return () => window.removeEventListener('telegram-ready', initTelegram);
  }, []);

  return { user, isLoading };
}

