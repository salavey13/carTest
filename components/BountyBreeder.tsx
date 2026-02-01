"use client";

import { useState, useTransition } from "react";
import { sendDonationInvoice } from "@/app/actions";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaBug, FaHeart, FaBolt, FaRocket } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from 'react-dom-confetti';

const confettiConfig = { angle: 90, spread: 360, startVelocity: 40, elementCount: 70, dragFriction: 0.12, duration: 3000, stagger: 3, width: "10px", height: "10px", colors: ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"] };

export default function BountyBreeder() {
  const { dbUser, isAuthenticated } = useAppContext();
  const [mode, setMode] = useState<'love' | 'mutate'>('love'); // The Mode Switch
  const [amount, setAmount] = useState("100");
  const [bountyTitle, setBountyTitle] = useState("");
  const [bountyDesc, setBountyDesc] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showConfetti, setShowConfetti] = useState(false);

  const handleCommit = () => {
    if (!isAuthenticated || !dbUser) { toast.error("Войдите в систему (Telegram)"); return; }
    const val = parseInt(amount);
    if (isNaN(val) || val < 10) { toast.error("Минимум 10 XTR"); return; }

    // Format the payload based on mode
    // If 'mutate', we prefix with BOUNTY: so the backend/admin knows it's a feature request
    const messagePayload = mode === 'love' 
      ? `DONATION: ${bountyDesc || "Just pure vibe"}` 
      : `BOUNTY: [${bountyTitle}] ${bountyDesc}`;

    startTransition(async () => {
      const result = await sendDonationInvoice(dbUser.user_id, val, messagePayload);
      if (result.success) {
        toast.success(mode === 'love' ? "Спасибо за поддержку! 💖" : "Баунти создано! Счет в Telegram. 🚀");
        setShowConfetti(true);
        // Reset form slightly delayed
        setTimeout(() => { setShowConfetti(false); setBountyTitle(""); setBountyDesc(""); }, 1000);
      } else {
        toast.error("Ошибка создания счета: " + result.error);
      }
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" />
      
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center gap-4 mb-4 bg-black/50 p-1 rounded-full w-fit mx-auto border border-zinc-800">
          <button onClick={() => setMode('love')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${mode === 'love' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50' : 'text-zinc-500 hover:text-white'}`}>
            <FaHeart /> LUV (Donation)
          </button>
          <button onClick={() => setMode('mutate')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${mode === 'mutate' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'text-zinc-500 hover:text-white'}`}>
            <FaBug /> FIX (Bounty)
          </button>
        </div>
        <CardTitle className="text-2xl font-orbitron text-white">
          {mode === 'love' ? "Поддержать Вайб" : "Заказать Мутацию"}
        </CardTitle>
        <p className="text-xs text-zinc-500 font-mono">
          {mode === 'love' ? "Твоя энергия питает Архитектора." : "Твои деньги определяют приоритет разработки."}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {mode === 'mutate' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-cyan-500">Цель (Что сломалось / Что добавить)</label>
                <Input 
                  placeholder="Например: Интеграция с МойСклад" 
                  className="bg-black border-zinc-700 text-white" 
                  value={bountyTitle} onChange={e => setBountyTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-cyan-500">Детали (Почему это важно)</label>
                <Textarea 
                  placeholder="Без этого мои менеджеры плачут..." 
                  className="bg-black border-zinc-700 text-white min-h-[80px]" 
                  value={bountyDesc} onChange={e => setBountyDesc(e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-1 pt-2">
          <label className="text-[10px] uppercase font-bold text-green-500 flex justify-between">
            <span>Энергия (XTR)</span>
            <span className="text-zinc-500">{parseInt(amount) * 2} RUB (approx)</span>
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[50, 100, 500, 1000].map(val => (
              <button key={val} onClick={() => setAmount(String(val))} className={`text-xs py-1 rounded border ${amount === String(val) ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                {val} ★
              </button>
            ))}
          </div>
          <Input 
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            className="bg-black border-zinc-700 text-green-400 font-mono text-lg text-right"
          />
        </div>

        <div className="relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><Confetti active={showConfetti} config={confettiConfig} /></div>
          <Button 
            onClick={handleCommit} disabled={isPending}
            className={`w-full py-6 font-bold text-black font-orbitron transition-all ${mode === 'love' ? 'bg-pink-500 hover:bg-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.4)]' : 'bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]'}`}
          >
            {isPending ? <FaBolt className="animate-pulse" /> : (mode === 'love' ? <><FaHeart className="mr-2"/> SUPPORT</> : <><FaRocket className="mr-2"/> DEPLOY BOUNTY</>)}
          </Button>
        </div>
        
        {mode === 'mutate' && (
          <p className="text-[10px] text-center text-zinc-600">
            * Баунти попадает на доску сразу после оплаты. Если Архитектор отклонит задачу, средства вернутся в карму (но не на карту, лол).
          </p>
        )}
      </CardContent>
    </Card>
  );
}