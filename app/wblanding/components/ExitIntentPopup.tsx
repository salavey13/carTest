'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';

export const ExitIntentPopup = () => {
  const { dbUser } = useAppContext();
  const telegramChatId = dbUser?.user_id;

  const [show, setShow] = useState(false);

  // флаг, что попап уже был открыт — НЕ допускаем повторов
  const hasShownRef = useRef(false);

  const openPopup = () => {
    if (hasShownRef.current) return;
    hasShownRef.current = true;
    setShow(true);
  };

  // Desktop exit intent
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (window.innerWidth > 768 && e.clientY <= 0) openPopup();
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  // Mobile scroll-up near top
  useEffect(() => {
    let lastY = window.scrollY;

    const handleScroll = () => {
      const current = window.scrollY;
      const scrollingUp = current < lastY;
      const nearTop = current < 60;

      if (window.innerWidth <= 768 && scrollingUp && nearTop) openPopup();
      lastY = current;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Timer fallback — ОДИН РАЗ, если попап ещё не показывался
  useEffect(() => {
    const timer = setTimeout(() => {
      openPopup();
    }, 20000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const [isSending, setIsSending] = useState(false);

  const handleSendToTelegram = async () => {
    if (!telegramChatId) {
      toast.error('Войдите через Telegram, чтобы получить чек-лист.');
      return;
    }
    try {
      setIsSending(true);
      const res = await fetch('/api/send-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: telegramChatId }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast.error('Не удалось отправить сообщение.');
        setIsSending(false);
        return;
      }

      toast.success('Чек-лист отправлен!');
      setIsSending(false);
      setShow(false);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка сети.');
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl mx-4"
      >
        <h3 className="text-xl sm:text-2xl font-bold mb-3 text-gray-900">
          Уходите? Хочешь чек-лист в Telegram?
        </h3>

        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          Отправлю 10-пунктный чек-лист прямо в Telegram. Быстро, без е-мейлов.
        </p>

        <div className="flex gap-3 mb-4">
          <Button
            onClick={handleSendToTelegram}
            disabled={isSending}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {isSending ? 'Отправка...' : 'Отправить в Telegram'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setShow(false)}
            className="flex-1"
          >
            Нет, спасибо
          </Button>
        </div>

        {!telegramChatId && (
          <div className="text-sm text-gray-500">
            Чтобы получить чек-лист —{' '}
            <Link href="/wb" className="text-blue-600 underline">
              войдите через Telegram
            </Link>.
          </div>
        )}

        <div className="text-xs text-gray-400 mt-4">
          Вы получите короткий чек-лист по снижению штрафов на маркетплейсах.
        </div>
      </motion.div>
    </div>
  );
};