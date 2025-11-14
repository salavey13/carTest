'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';

export const ExitIntentPopup = () => {
  const { dbUser } = useAppContext();
  const telegramChatId = dbUser?.user_id; // в проекте ты так уже передаёшь sendComplexMessage

  const [show, setShow] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Desktop exit intent
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (window.innerWidth > 768 && e.clientY <= 0) setShow(true);
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  // Mobile: scroll-up detection near page top
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const current = window.scrollY;
      const scrollingUp = current < lastScrollY;
      const nearTop = current < 60;

      if (window.innerWidth <= 768 && scrollingUp && nearTop) {
        setShow(true);
      }
      lastScrollY = current;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fallback: timer exit intent (one-time per render)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!show) setShow(true);
    }, 20000); // 20 seconds
    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;

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
        toast.error('Не удалось отправить. Проверь логи.');
        setIsSending(false);
        return;
      }
      toast.success('Чек-лист отправлен в Telegram! Проверь чат.');
      setIsSending(false);
      setShow(false);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка сети при отправке. Попробуй ещё раз.');
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