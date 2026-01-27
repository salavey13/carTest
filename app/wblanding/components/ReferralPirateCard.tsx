"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getMyReferralCode } from '../actions_view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Gift, Anchor, TrendingUp, Zap, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export const ReferralPirateCard = () => {
  const { dbUser } = useAppContext();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [friendsCount, setFriendsCount] = useState(5);

  useEffect(() => {
    if (dbUser?.user_id) {
      setLoading(true);
      getMyReferralCode(dbUser.user_id).then(res => {
        if (res.success && res.code) setCode(res.code);
        setLoading(false);
      });
    }
  }, [dbUser]);

  const handleCopy = () => {
    if (!code) return;
    const link = `https://t.me/oneBikePlsBot/sklad?startapp=ref_${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Ссылка скопирована! Отправляй в чат селлеров.");
  };

  // 3-Level calculation for display
  const lvl1 = friendsCount * 2000;
  const lvl2 = Math.floor(friendsCount * 0.3) * 300; // Assuming 30% conversion
  const lvl3 = Math.floor(friendsCount * 0.1) * 100; // Assuming 10% conversion
  const potentialEarnings = lvl1 + lvl2 + lvl3;

  if (!dbUser) {
     return (
        <Card className="bg-zinc-900/60 border border-dashed border-zinc-700 backdrop-blur-sm p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
                <Lock className="w-12 h-12 text-zinc-600" />
                <h3 className="text-white font-bold text-xl font-orbitron">Доступ к Синдикату закрыт</h3>
                <p className="text-gray-400 text-sm max-w-xs">
                    Войдите через Telegram, чтобы получить свой код и начать зарабатывать на рефералах.
                </p>
            </div>
        </Card>
     );
  }

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
    >
        <Card className="bg-black border border-indigo-500/50 shadow-[0_0_50px_rgba(79,70,229,0.15)] relative overflow-hidden group">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px] transition-all group-hover:bg-indigo-600/30"></div>
            
            <CardHeader className="relative z-10 border-b border-white/5 pb-6">
                <CardTitle className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-white font-orbitron text-2xl">
                        <Anchor className="w-6 h-6 text-neon-lime" />
                        <span>ПАРТНЕРСКИЙ ПУЛЬТ</span>
                    </div>
                    <div className="bg-indigo-500/10 border border-indigo-500/50 px-4 py-1.5 rounded-full text-xs font-mono text-indigo-300 flex items-center gap-2 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                        <div className="w-2 h-2 bg-neon-lime rounded-full animate-pulse"></div>
                        AGENT_ACTIVE
                    </div>
                </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-8 pt-8 relative z-10">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                        <p className="text-gray-300 font-bold text-sm uppercase tracking-wide text-neon-lime">Твоя добыча (3 уровня)</p>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Юридически чистая система вознаграждений. 
                            <br/>Max 3 уровня — соответствует ФЗ-117.
                        </p>
                    </div>
                    <div className="space-y-2 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                        <p className="text-gray-300 font-bold text-sm uppercase tracking-wide text-brand-cyan">Бонус друга</p>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Каждый приглашенный получает скидку <span className="text-white font-bold">1 000 ₽</span> на старт.
                            <br/>Им выгодно использовать именно твой код.
                        </p>
                    </div>
                </div>

                <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                    
                    <div className="text-center md:text-left z-10">
                        <p className="text-[10px] text-zinc-500 mb-2 font-mono uppercase tracking-widest">ТВОЙ ЛИЧНЫЙ КОД</p>
                        {loading ? (
                            <div className="h-10 w-40 bg-zinc-800 animate-pulse rounded mx-auto md:mx-0"></div>
                        ) : (
                            <code className="text-3xl md:text-4xl font-black text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] font-orbitron">
                                {code || 'ERROR'}
                            </code>
                        )}
                    </div>
                    <Button onClick={handleCopy} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-14 px-8 rounded-xl shadow-xl shadow-indigo-900/20 transition-all hover:scale-105 hover:shadow-indigo-500/30 z-10">
                        <Copy className="w-5 h-5 mr-2" /> КОПИРОВАТЬ ССЫЛКУ
                    </Button>
                </div>

                <div className="space-y-4 pt-4">
                     <div className="flex justify-between items-end">
                        <span className="text-xs font-mono text-gray-500 uppercase">Калькулятор профита (3 уровня)</span>
                        <div className="text-right">
                            <span className="text-2xl font-black text-neon-lime font-mono">{potentialEarnings.toLocaleString()} ₽</span>
                            <span className="text-xs text-gray-500 block">потенциальный доход</span>
                        </div>
                     </div>
                     
                     <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        value={friendsCount} 
                        onChange={(e) => setFriendsCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-neon-lime"
                    />
                    <div className="flex justify-between text-xs text-gray-500 font-mono">
                        <span>1 друг</span>
                        <span className="text-white">{friendsCount} друзей</span>
                        <span>20 друзей</span>
                    </div>

                    {/* 3-Level Breakdown Visualization */}
                    {friendsCount >= 1 && (
                        <div className="mt-6 p-4 bg-zinc-950/50 rounded-lg border border-zinc-800 space-y-2">
                            <div className="flex justify-between items-center text-xs font-mono mb-2 border-b border-zinc-800 pb-2">
                                <span className="text-zinc-500">Детализация дохода (3 уровня)</span>
                                <span className="text-neon-lime font-bold">{potentialEarnings.toLocaleString()} ₽</span>
                            </div>
                            <div className="space-y-1 text-[11px] font-mono">
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                        L1 Прямые (20%):
                                    </span>
                                    <span className="text-white">{friendsCount} × 2000₽ = {lvl1.toLocaleString()}₽</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                                        L2 Косвенные (3%):
                                    </span>
                                    <span className="text-zinc-300">~{Math.floor(friendsCount * 0.3)} × 300₽ = {lvl2.toLocaleString()}₽</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
                                        L3 Сеть (1%):
                                    </span>
                                    <span className="text-zinc-500">~{Math.floor(friendsCount * 0.1)} × 100₽ = {lvl3.toLocaleString()}₽</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-2 text-center">
                                * Соответствует ФЗ-117 о прямых продажах. Вознаграждение за реальный продукт.
                            </p>
                        </div>
                    )}

                    {friendsCount >= 5 && (
                        <div className="p-3 bg-green-900/20 border border-green-500/20 rounded-lg text-center animate-pulse">
                            <p className="text-green-400 text-xs font-bold flex items-center justify-center gap-2">
                                <Zap className="w-3 h-3" /> ТЫ ПОЛНОСТЬЮ ОКУПИЛ СВОЮ ЛИЦЕНЗИЮ!
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    </motion.div>
  );
};