'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';

export const ExitIntentPopup = () => {
  const { dbUser } = useAppContext();
  const telegramChatId = dbUser?.user_id;
  const [show, setShow] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const hasShownRef = useRef(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasShownRef.current) {
         setShow(true);
         hasShownRef.current = true;
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  const handleSend = async () => {
    if (!telegramChatId) { toast.error('Сначала войди через Telegram!'); return; }
    setIsSending(true);
    try {
      await fetch('/api/send-checklist', { 
         method: 'POST', 
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ chatId: telegramChatId }) 
      });
      toast.success('Чек-лист уже у тебя в личке 🏴‍☠️');
      setShow(false);
    } catch(e) { toast.error('Ошибка отправки.'); } 
    finally { setIsSending(false); }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <motion.div 
             initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
             className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl shadow-2xl max-w-md w-full relative"
           >
              <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X/></button>
              
              <div className="flex items-start gap-4">
                 <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                    <AlertTriangle className="w-8 h-8 text-red-500"/>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">СТОЙ. НЕ ПЛАТИ ШТРАФ.</h3>
                    <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                       Маркетплейсы надеются, что ты ошибешься. 
                       Забери <strong>"Чек-лист Анти-Штраф"</strong> (10 шагов) себе в Telegram перед уходом. Бесплатно.
                    </p>
                 </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                 <Button onClick={handleSend} disabled={isSending} className="w-full bg-white text-black font-bold hover:bg-gray-200 py-6 text-lg rounded-xl">
                    {isSending ? 'Отправляю...' : '👉 Отправить в Telegram'}
                 </Button>
                 <button onClick={() => setShow(false)} className="text-center text-xs text-zinc-600 hover:text-zinc-400 underline decoration-zinc-700">
                    Нет, я люблю терять деньги
                 </button>
              </div>
           </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};