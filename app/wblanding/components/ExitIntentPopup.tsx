'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';

export const ExitIntentPopup = () => {
  const { dbUser } = useAppContext();
  // Поддерживаем несколько возможных полей для chatId
  const telegramChatId =
    dbUser?.user_id ?? dbUser?.telegram_id ?? dbUser?.tg_id ?? dbUser?.chat_id ?? null;

  const [show, setShow] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // DESKTOP exit-intent
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (window.innerWidth > 768 && e.clientY <= 0) setShow(true);
    };
    document.addEventListener('mouseleave', handler);
    return () => document.removeEventListener('mouseleave', handler);
  }, []);

  // MOBILE: one-shot 100% -> return-to-top logic (fixed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth > 768) return;

    let reachedBottom = false;
    let shownOnce = false;

    const onScroll = () => {
      if (shownOnce) return;

      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winH = window.innerHeight;

      const atBottom = scrollTop + winH >= docHeight - 20;
      const atTop = scrollTop <= 30;

      if (atBottom) {
        reachedBottom = true;
        return;
      }

      if (reachedBottom && atTop) {
        shownOnce = true;
        setShow(true);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // fallback timer (one-time per render)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!show) setShow(true);
    }, 20000);
    return () => clearTimeout(t);
  }, [show]);

  const handleSendToTelegram = async () => {
    if (!telegramChatId) {
      toast.error('Подключите Telegram (войдите в систему), чтобы получить чек-лист прямо в чат.');
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
        console.error('send-checklist failed', json);
        toast.error(json?.error ? `Ошибка: ${json.error}` : 'Не удалось отправить. Проверь логи.');
        setIsSending(false);
        return;
      }

      toast.success('Чек-лист отправлен в Telegram! Проверь чат.');
      setIsSending(false);
      setShow(false);
    } catch (err) {
      console.error('send-checklist network error', err);
      toast.error('Ошибка сети при отправке. Попробуй ещё раз.');
      setIsSending(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl mx-4"
      >
        <h3 className="text-xl sm:text-2xl font-bold mb-3 text-gray-900">Уходите? Хочешь чек-лист в Telegram?</h3>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          Могу отправить краткий чек-лист (10 пунктов) прямо в ваш Telegram — быстрее и без е-мэйлов.
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
            Чтобы получить чек-лист в чат — <Link href="/wb" className="text-blue-600 underline">войдите через Telegram</Link>.
          </div>
        )}

        <div className="text-xs text-gray-400 mt-4">
          Нажимая «Отправить», вы получите короткий практический чек-лист с шагами по снижению штрафов на маркетплейсах.
        </div>
      </motion.div>
    </div>
  );
};