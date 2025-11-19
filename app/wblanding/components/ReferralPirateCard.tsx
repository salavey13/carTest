"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getOrGenerateReferralCode } from '../actions_view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Gift, Anchor, TrendingUp, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export const ReferralPirateCard = () => {
  const { dbUser } = useAppContext();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculatorValue, setCalculatorValue] = useState(5); // Default 5 friends

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
    // Ссылка сразу ведет на startapp с рефкой
    const link = `https://t.me/oneBikePlsBot/app?startapp=ref_${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Ссылка скопирована! Кидай в чаты селлеров.");
  };

  // Math for motivation
  const commissionPerSetup = 2000; // 20% от 10k
  const potentialEarnings = calculatorValue * commissionPerSetup;

  if (!dbUser) {
     return (
        <Card className="bg-zinc-900/60 border border-dashed border-zinc-700 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-indigo-500/20 p-4 rounded-full mb-4 animate-pulse">
                    <Gift className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-white font-bold text-xl mb-2 font-orbitron">Доступ к Синдикату</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                    Войдите через Telegram, чтобы получить личный код и начать зарабатывать на ошибках других селлеров (шутка, на их спасении).
                </p>
                <Button variant="outline" className="border-indigo-500 text-indigo-400 hover:bg-indigo-500 hover:text-white">
                    ВОЙТИ И ПОЛУЧИТЬ КОД
                </Button>
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
        <Card className="bg-black border border-indigo-500/50 shadow-[0_0_40px_rgba(79,70,229,0.1)] relative overflow-hidden group">
            {/* Decorative background elements */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl transition-all group-hover:bg-indigo-600/20"></div>
            
            <CardHeader className="relative z-10 border-b border-white/5 pb-4">
                <CardTitle className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-white font-orbitron text-xl">
                        <Anchor className="w-6 h-6 text-neon-lime" />
                        <span>ПАРТНЕРСКИЙ ПУЛЬТ</span>
                    </div>
                    <div className="bg-indigo-900/30 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-mono text-indigo-300 flex items-center gap-2">
                        <div className="w-2 h-2 bg-neon-lime rounded-full animate-pulse"></div>
                        STATUS: AGENT
                    </div>
                </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-8 pt-6 relative z-10">
                
                {/* Value Prop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-gray-300 font-bold">Твоя выгода (20%):</p>
                        <p className="text-sm text-gray-400">
                            Ты получаешь <span className="text-neon-lime font-bold">2 000 ₽</span> живыми деньгами (или на баланс) за каждого, кто закажет настройку склада по твоему коду.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-gray-300 font-bold">Выгода друга (10%):</p>
                        <p className="text-sm text-gray-400">
                            Они получают скидку <span className="text-brand-cyan font-bold">1 000 ₽</span> и нормальный софт вместо Excel-ада.
                        </p>
                    </div>
                </div>

                {/* The Code */}
                <div className="bg-zinc-900/80 p-6 rounded-xl border border-zinc-700 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner">
                    <div className="text-center md:text-left">
                        <p className="text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-widest">ЛИЧНЫЙ ПРОМОКОД</p>
                        {loading ? (
                            <div className="h-8 w-32 bg-zinc-800 animate-pulse rounded mx-auto md:mx-0"></div>
                        ) : (
                            <code className="text-2xl md:text-3xl font-black text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                {code || 'LOADING...'}
                            </code>
                        )}
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button onClick={handleCopy} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 px-6 rounded-lg shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95">
                            <Copy className="w-4 h-4 mr-2" /> КОПИРОВАТЬ
                        </Button>
                    </div>
                </div>

                {/* Motivation Calculator */}
                <div className="bg-gradient-to-r from-zinc-900 to-black p-4 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-xs font-mono uppercase flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-neon-lime"/> Калькулятор Дохода
                        </span>
                        <span className="text-neon-lime font-bold font-mono text-lg">
                            {potentialEarnings.toLocaleString()} ₽
                        </span>
                    </div>
                    
                    <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        value={calculatorValue} 
                        onChange={(e) => setCalculatorValue(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-neon-lime"
                    />
                    
                    <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                        <span>1 друг</span>
                        <span className="text-white font-bold">{calculatorValue} приглашенных</span>
                        <span>50 друзей</span>
                    </div>
                    
                    <div className="mt-4 p-3 bg-indigo-900/20 border border-indigo-500/20 rounded text-xs text-indigo-300 text-center">
                        {calculatorValue >= 5 ? (
                            <span className="flex items-center justify-center gap-2 animate-pulse">
                                <Zap className="w-3 h-3"/> ТЫ ОКУПИЛ НАСТРОЙКУ И УШЕЛ В ПЛЮС!
                            </span>
                        ) : (
                            <span>Ещё {5 - calculatorValue} друзей до полной окупаемости своей настройки.</span>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-center">
                    <Button onClick={handleCopy} variant="ghost" className="text-zinc-500 hover:text-white text-xs">
                        <Share2 className="w-3 h-3 mr-1" /> Как это работает технически?
                    </Button>
                </div>
            </CardContent>
        </Card>
    </motion.div>
  );
};