// /components/streamer/DonationForm.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/contexts/AppContext";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import MarketBox from "./MarketBox";
import { useAppToast } from "@/hooks/useAppToast";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div;
const MotionButton = motion.button;

type Tier = {
  id: string;
  label: string;
  amount: number;
  description: string;
  badge?: string;
  highlight?: string;
  metadata?: Record<string, any>;
};

const TIERS: Tier[] = [
  { id: "tip", label: "Мелкий подарок", amount: 50, description: "Быстрая поддержка", badge: "💖", highlight: "shadow-pink-glow", metadata: { kind: "tip" } },
  { id: "supporter", label: "Поддержка", amount: 150, description: "Имя в итогах", badge: "👏", highlight: "shadow-blue-glow", metadata: { kind: "support" } },
  { id: "vip", label: "VIP", amount: 300, description: "VIP-метка в чате", badge: "⭐", highlight: "shadow-purple-glow", metadata: { kind: "vip", vipDays: 7 } },
  { id: "sauna", label: "Сауна Пак", amount: 500, description: "Полотенце и шлёпки", badge: "🧖", highlight: "shadow-yellow-glow", metadata: { kind: "market", sku: "sauna_pack" } },
];

export default function DonationForm({ streamerId }: { streamerId: string }) {
  const { dbUser } = useAppContext();
  const payerUserId = dbUser?.user_id ?? null;
  const supabase = getSupabaseBrowserClient();
  const toast = useAppToast();

  const [amount, setAmount] = useState<number>(TIERS[0].amount);
  const [selectedTier, setSelectedTier] = useState<Tier>(TIERS[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [paid, setPaid] = useState(false);
  const chanRef = useRef<any>(null);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    setSelectedTier(TIERS.find((t) => t.amount === amount) ?? TIERS[0]);
  }, [amount]);

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (!payerUserId) { toast.error("Требуется авторизация."); return; }
    if (!streamerId) { toast.error("Не указан получатель."); return; }
    if (!amount || amount <= 0) { toast.error("Укажите сумму > 0"); return; }
    if (loading) return;
    setLoading(true);

    const metadata = { ...selectedTier.metadata, note, tierId: selectedTier.id, tierLabel: selectedTier.label };

    try {
      const res = await fetch("/api/streamer/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": payerUserId },
        body: JSON.stringify({ streamerId, amount, metadata }),
      }).then((r) => r.json());

      if (!res?.success) {
        toast.error(res?.error || "Ошибка создания инвойса");
      } else {
        setInvoice(res.invoice);
        toast.success("Инвойс создан. Поделитесь ссылкой или откройте оплату.");
        watchInvoicePaid(res.invoice.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  function watchInvoicePaid(invoiceId: string) {
    if (!invoiceId || !supabase) return;
    try {
      const chan = supabase.channel(`public:invoices:watch-${invoiceId}`);
      chan.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "invoices", filter: `id=eq.${invoiceId}` },
        (payload: any) => {
          const rec = payload?.new;
          if (!rec) return;
          if (String(rec.status) === "paid") {
            setPaid(true);
            setBurstKey((k) => k + 1); // trigger burst
            toast.success(`Платёж получен: +${rec.amount} XTR — ${selectedTier.label}`);
            try { if (typeof chan.unsubscribe === "function") chan.unsubscribe(); } catch {}
          }
        }
      );
      chan.subscribe();
      chanRef.current = chan;
    } catch (e) {
      console.warn("[DonationForm] realtime invoice watch failed", e);
    }
  }

  useEffect(() => {
    return () => { try { if (chanRef.current && typeof chanRef.current.unsubscribe === "function") chanRef.current.unsubscribe(); } catch {} };
  }, []);

  function copyInvoiceLink() {
    if (!invoice) return;
    const appLink = (globalThis as any).NEXT_PUBLIC_TELEGRAM_BOT_LINK || process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK;
    const link = appLink ? `${appLink}?start=pay_inv_${invoice.id}` : `invoice:${invoice.id}`;
    navigator.clipboard?.writeText(link).then(() => toast.success("Ссылка скопирована")).catch(() => toast.error("Не удалось скопировать"));
  }

  function openInTelegram() {
    const appLink = (globalThis as any).NEXT_PUBLIC_TELEGRAM_BOT_LINK || process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK;
    if (!appLink || !invoice) { toast.error("Глубокая ссылка Telegram недоступна."); return; }
    window.open(`${appLink}?start=pay_inv_${invoice.id}`, "_blank");
  }

  // small DOM burst confetti (no deps) — css animated circles
  const renderBurst = () => {
    // create a bunch of colored dots
    const colors = ["#FF6B6B", "#FFD93D", "#7C5CFF", "#00FF9D", "#FF8EDA"];
    return Array.from({ length: 20 }).map((_, i) => {
      const style: React.CSSProperties = {
        left: `${50 + (Math.random() - 0.5) * 40}%`,
        top: `${30 + (Math.random() - 0.5) * 20}%`,
        background: colors[i % colors.length],
        transform: `translate(-50%,-50%) scale(${0.6 + Math.random() * 0.9})`,
        animationDelay: `${(Math.random() * 0.2).toFixed(2)}s`,
      };
      return <span key={i} className="confetti-dot" style={style} />;
    });
  };

  return (
    <React.Fragment>
      <form onSubmit={handleDonate} className="space-y-3 p-3 rounded-md border border-border bg-gray-900/80 backdrop-blur-sm relative overflow-hidden" aria-live="polite"> {/* Darker bg */}
        {/* burst overlay */}
        <AnimatePresence>
          {paid && (
            <MotionDiv
              key={`burst-${burstKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-30"
              onAnimationComplete={() => {
                // auto-reset paid flag after celebratory moment
                setTimeout(() => setPaid(false), 1300);
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <MotionDiv initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 12 }} className="py-6 px-8 rounded-full bg-gradient-to-r from-primary/20 to-transparent backdrop-blur-md shadow-xl text-white">
                  <div className="text-center">
                    <div className="text-2xl font-bold">Спасибо! 🎉</div>
                    <div className="text-xs text-gray-300">Платёж получен</div> {/* Light gray */}
                  </div>
                </MotionDiv>
              </div>
              <div className="confetti-container" aria-hidden>{renderBurst()}</div>
            </MotionDiv>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">Поддержать стримера — выберите уровень</div> {/* Light gray */}
          <div className="text-xs text-gray-300">Текущий выбор: <span className="font-semibold ml-1">{selectedTier.label} • {amount}★</span></div> {/* Light gray */}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIERS.map((t) => (
            <MotionButton
              key={t.id}
              type="button"
              onClick={() => { setSelectedTier(t); setAmount(t.amount); }}
              whileTap={{ scale: 0.98 }}
              className={`p-2 rounded-md text-sm flex flex-col items-start justify-between border transition-shadow duration-200 ${selectedTier.id === t.id ? `border-primary bg-primary/8 ${t.highlight}` : "bg-gray-900 border-border"}`} {/* Dark bg */}
            >
              <div className="flex items-center gap-2 w-full">
                <div className="text-lg">{t.badge ?? "★"}</div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm truncate text-white">{t.label}</div> {/* White text */}
                  <div className="text-xs text-gray-300 truncate">{t.description}</div> {/* Light gray */}
                </div>
                <div className="font-semibold text-white">{t.amount}★</div> {/* White text */}
              </div>
            </MotionButton>
          ))}
        </div>

        <div className="flex gap-2">
          <Input aria-label="Сумма XTR" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="flex-1 input-cyber" />
          <MotionDiv whileTap={{ scale: 0.98 }}>
            <Button type="submit" className="whitespace-nowrap" disabled={loading || !!invoice}>
              {loading ? "Создаём..." : invoice ? "Инвойс готов" : "Поддержать"}
            </Button>
          </MotionDiv>
        </div>

        <div>
          <Input placeholder="Сообщение (опционально)" value={note} onChange={(e) => setNote(e.target.value)} className="input-cyber mt-2" aria-label="Сообщение донату" />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-gray-300">Средства — XTR. После оплаты звезды зачисляются автоматически.</div> {/* Light gray */}

          {invoice && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="flex gap-2 flex-wrap items-center">
                <Button size="sm" onClick={copyInvoiceLink}>Копировать ссылку</Button>
                <Button size="sm" variant="secondary" onClick={openInTelegram}>Открыть в Telegram</Button>
              </div>
              <div className="text-xs text-gray-300 whitespace-nowrap mt-1 sm:mt-0"> {/* Light gray */}
                {paid ? <span className="text-primary">✅ Оплачен</span> : <span>Ожидание оплаты</span>}
              </div>
            </div>
          )}
        </div>

      </form>

      <div className="mt-3">
        <MarketBox onPick={(it) => {
          if (it?.id) {
            if (it.id === "sauna_pack") {
              const saunaTier = TIERS.find((t) => t.id === "sauna");
              if (saunaTier) { setSelectedTier(saunaTier); setAmount(saunaTier.amount); toast.success(`Вы выбрали ${saunaTier.label}`); }
            } else { setAmount(it.price); toast.success(`Вы выбрали ${it.title}`); }
          }
        }} />
      </div>

      <style jsx>{`
        .confetti-container { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:40; }
        .confetti-dot {
          position:absolute;
          width:10px;
          height:10px;
          border-radius:50%;
          will-change: transform, opacity;
          animation: confetti-fly 900ms cubic-bezier(.18,.9,.3,1) forwards;
          box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        }
        @keyframes confetti-fly {
          0% { transform: translateY(0) scale(0.6); opacity: 1; }
          70% { transform: translateY(-220px) translateX(calc((50% - 50%) * 1px)) rotate(180deg) scale(1); opacity: 1; }
          100% { transform: translateY(-320px) rotate(360deg) scale(0.8); opacity: 0; }
        }
      `}</style>
    </React.Fragment>
  );
}