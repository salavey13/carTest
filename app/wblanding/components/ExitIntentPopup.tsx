'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, FileText } from 'lucide-react';
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
    if (!telegramChatId) { toast.error('Please login to Telegram first.'); return; }
    setIsSending(true);
    try {
      await fetch('/api/send-checklist', { 
         method: 'POST', 
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ chatId: telegramChatId }) 
      });
      toast.success('Checklist sent to your DMs 🏴‍☠️');
      setShow(false);
    } catch(e) { toast.error('Error sending.'); } 
    finally { setIsSending(false); }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <motion.div 
             initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
             className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl shadow-2xl max-w-md w-full relative"
           >
              <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X/></button>
              <div className="flex items-start gap-4">
                 <div className="bg-indigo-500/20 p-3 rounded-xl">
                    <FileText className="w-8 h-8 text-indigo-400"/>
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-white">Wait. Don't pay the fine.</h3>
                    <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                       The marketplaces are betting you'll mess up. Get the <strong>10-Step "Anti-Fine" Checklist</strong> sent to your Telegram before you go.
                    </p>
                 </div>
              </div>
              <div className="mt-6 flex gap-3">
                 <Button variant="ghost" onClick={() => setShow(false)} className="flex-1 text-zinc-400 hover:text-white hover:bg-white/10">I like losing money</Button>
                 <Button onClick={handleSend} disabled={isSending} className="flex-1 bg-white text-black font-bold hover:bg-gray-200">
                    {isSending ? 'Sending...' : 'Send Cheat Sheet'}
                 </Button>
              </div>
           </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};