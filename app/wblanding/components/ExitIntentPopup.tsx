'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';

export const GentleBottomBar = () => {
  const { dbUser } = useAppContext();
  const telegramChatId = dbUser?.user_id ?? dbUser?.telegram_id ?? dbUser?.tg_id ?? null;

  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const hasShownRef = useRef(false);
  const everReachedThreshold = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ждём, пока человек дочитает хотя бы 70–75% страницы и пробыл на ней >20 сек
  useEffect(() => {
    if (!mounted || hasShownRef.current) return;

    let timeout: ReturnType<typeof setTimeout>;

    const check = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const height = document.documentElement.scrollHeight;
      const percentage = scrolled / height;

      if (percentage >= 0.72) everReachedThreshold.current = true;
    };

    const tryShow = () => {
      if (
        !hasShownRef.current &&
        everReachedThreshold.current &&
        window.scrollY > 500 // чтобы не триггерить на лендингах, где сразу всё видно
      ) {
        hasShownRef.current = true;
        setShow(true);
      }
    };

    const handleScroll = () => {
      check();
      if (everReachedThreshold.current) tryShow();
    };

    // первый чек через 20 сек (человек точно уже вчитался)
    timeout = setTimeout(() => {
      check();
      tryShow();
      window.addEventListener('scroll', handleScroll, { passive: true });
    }, 20_000);

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mounted]);

  const handleSendChecklist = async () => {
    if (!telegramChatId) {
      toast.error('Подключи Telegram, чтобы получить чек-лист в личку');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/send-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: telegramChatId }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Ошибка');

      toast.success('Чек-лист уже в твоём Telegram ✨');
      setShow(false);
    } catch (err) {
      toast.error('Не получилось отправить, попробуй ещё разок');
    } finally {
      setIsSending(false);
    }
  };

  // Ничего не рендерим, пока не решим показывать
  if (!mounted || !show) return null;

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* backdrop только на мобильных + лёгкий, не мешает читать */}
          <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setShow(false)} />

          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 pb-4 px-4 md:px-6"
          >
            <div className="relative max-w-5xl mx-auto">
              {/* карточка */}
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 md:p-6 flex flex-col md:flex-row items-center gap-4 backdrop-blur-sm bg-opacity-95">
                {/* текст */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    Уходишь без чек-листа? 😏
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    10 пунктов, которые сократили нам штрафы на 73%. Прислать в Telegram за 3 секунды?
                  </p>
                </div>

                {/* кнопки */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Button
                    onClick={handleSendChecklist}
                    disabled={isSending}
                    size="sm"
                    className="flex-1 md:flex-initial bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium"
                  >
                    {isSending ? 'Отправляю...' : 'Да, в Telegram →'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShow(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* маленький хвостик, чтобы выглядело как чат */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-white" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};