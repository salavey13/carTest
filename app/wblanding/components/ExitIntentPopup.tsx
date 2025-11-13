'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const ExitIntentPopup = () => {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) setShow(true);
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  if (!show) return null;

  const handleSubmit = () => {
    if (!email) {
      toast.error('Введите email');
      return;
    }
    toast.success('Чек-лист отправлен! Проверьте почту.');
    setShow(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl mx-4">
        <h3 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900">Уходите? Возьмите чек-лист!</h3>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">Получите бесплатный чек-лист из 10 пунктов для мгновенного снижения штрафов на маркетплейсах.</p>
        <Input placeholder="Ваш email" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4" />
        <div className="flex gap-3">
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmit}>
            Получить чек-лист
          </Button>
          <Button variant="outline" onClick={() => setShow(false)}>Нет, спасибо</Button>
        </div>
      </motion.div>
    </div>
  );
};