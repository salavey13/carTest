"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getOrGenerateReferralCode } from '../actions_view'; // Use safe action
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Gift, Anchor } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export const ReferralPirateCard = () => {
  const { dbUser } = useAppContext();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dbUser?.user_id) {
      setLoading(true);
      getOrGenerateReferralCode(dbUser.user_id).then(res => {
        if (res.success && res.code) setCode(res.code);
        setLoading(false);
      });
    }
  }, [dbUser]);

  const handleCopy = () => {
    if (!code) return;
    const link = `https://t.me/oneBikePlsBot/app?startapp=ref_${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Реферальная ссылка скопирована!");
  };

  if (!dbUser) {
     return (
        <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Gift className="w-12 h-12 text-indigo-400 mb-4" />
                <h3 className="text-white font-bold mb-2">Бонусная программа</h3>
                <p className="text-gray-400 text-sm mb-4">Войдите, чтобы получить свой Пиратский Код и раздавать скидки друзьям.</p>
            </CardContent>
        </Card>
     );
  }

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
    >
        <Card className="bg-black border border-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.15)] relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white font-orbitron">
                    <Anchor className="w-5 h-5 text-indigo-400" />
                    КОДЕКС ПИРАТА (Referral)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <p className="text-gray-400 text-sm">
                        Приведи друга-селлера. Он получит <span className="text-neon-lime font-bold">10% скидку</span> на настройку.
                        Ты получишь <span className="text-brand-cyan font-bold">Бесплатный месяц PRO</span> за каждого активного.
                    </p>
                </div>

                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-zinc-500 mb-1 font-mono uppercase">Твой код</p>
                        {loading ? (
                            <div className="h-6 w-24 bg-zinc-800 animate-pulse rounded"></div>
                        ) : (
                            <code className="text-xl font-bold text-indigo-400 tracking-widest">{code || 'ERROR'}</code>
                        )}
                    </div>
                    <Button onClick={handleCopy} size="icon" variant="ghost" className="hover:bg-indigo-500/20 hover:text-indigo-300">
                        <Copy className="w-5 h-5" />
                    </Button>
                </div>

                <Button onClick={handleCopy} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4">
                    <Share2 className="w-4 h-4 mr-2" /> ПОДЕЛИТЬСЯ ССЫЛКОЙ
                </Button>
            </CardContent>
        </Card>
    </motion.div>
  );
};