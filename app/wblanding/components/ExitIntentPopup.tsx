'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';

/**
 * ExitIntentPopup
 * - stable hooks order
 * - mounted guard to avoid hydration mismatches
 * - one-shot behavior (hasShownRef)
 * - clear listeners and safe window guards
 */

export const ExitIntentPopup: React.FC = () => {
  const { dbUser } = useAppContext();
  const telegramChatId =
    dbUser?.user_id ?? dbUser?.telegram_id ?? dbUser?.tg_id ?? dbUser?.chat_id ?? null;

  // state & refs (all declared unconditionally at top)
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // ensure one-shot behavior across all triggers during this page session
  const hasShownRef = useRef(false);

  // debug - optional, remove later
  const debugRef = useRef<{ triggeredBy?: 'timer' | 'scroll' | 'mouseleave' | null }>({ triggeredBy: null });

  // mounted guard to avoid hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // common open function that guarantees one-shot
  const openOnce = (by: 'timer' | 'scroll' | 'mouseleave') => {
    if (hasShownRef.current) return;
    hasShownRef.current = true;
    debugRef.current.triggeredBy = by;
    // small microtask delay to avoid race with other state changes
    setTimeout(() => setShow(true), 0);
  };

  // DESKTOP exit-intent: mouseleave to top
  useEffect(() => {
    if (!mounted) return;

    const onMouseLeave = (e: MouseEvent) => {
      try {
        if (window.innerWidth > 768 && e.clientY <= 0) {
          openOnce('mouseleave');
        }
      } catch (err) {
        // ignore
      }
    };

    document.addEventListener('mouseleave', onMouseLeave);
    return () => document.removeEventListener('mouseleave', onMouseLeave);
  }, [mounted]);

  // MOBILE: one-shot 100% -> return-to-top
  useEffect(() => {
    if (!mounted) return;
    if (typeof window === 'undefined') return;
    if (window.innerWidth > 768) return;

    let reachedBottom = false;

    const onScroll = () => {
      if (hasShownRef.current) return;

      try {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight;
        const winH = window.innerHeight;

        const atBottom = scrollTop + winH >= docHeight - 20;
        const atTop = scrollTop <= 30;

        if (!reachedBottom && atBottom) {
          reachedBottom = true;
          return;
        }

        if (reachedBottom && atTop) {
          openOnce('scroll');
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // run once to initialize state if user is already at top/bottom
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, [mounted]);

  // fallback timer (one-shot)
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      if (!hasShownRef.current) openOnce('timer');
    }, 20000); // 20s

    return () => clearTimeout(timer);
  }, [mounted]);

  // send checklist to server route
  const handleSendToTelegram = async () => {
    if (!telegramChatId) {
      toast.error('Подключите Telegram (войдите в систему), чтобы получить чек-лист прямо в чат.');
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
      if (!res.ok || !json?.success) {
        console.error('send-checklist failed', json);
        toast.error(json?.error ? `Ошибка: ${json.error}` : 'Не удалось отправить. Проверь логи.');
        setIsSending(false);
        return;
      }

      toast.success('Чек-лист отправлен в Telegram! Проверь чат.');
      setShow(false);
    } catch (err) {
      console.error('send-checklist network error', err);
      toast.error('Ошибка сети при отправке. Попробуй ещё раз.');
    } finally {
      setIsSending(false);
    }
  };

  // Nothing until client mounted
  if (!mounted) return null;

  // not visible
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

        {/* debug info (remove in prod) */}
        {/* <pre className="text-xs text-gray-400 mt-2">triggeredBy: {String(debugRef.current.triggeredBy)}</pre> */}
      </motion.div>
    </div>
  );
};