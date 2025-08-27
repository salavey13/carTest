"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { createTapkiInvoice } from "@/app/tapki/actions";
import { fetchCarById } from "@/hooks/supabase";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";

interface Tapki {
  id: string;
  make: string;
  model: string;
  description: string;
  image_url: string;
  quantity: number;
}

const TAPKI_ID = "tapki-light-6b2f5a10";
const TAPKI_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/2892de58-8981-4780-9004-a3a367e8b6a2.jpg";
const TAPKI_PRICE = 100; // XTR

export default function TapkiPage() {
  const router = useRouter();
  const { dbUser } = useAppContext();
  const [tapki, setTapki] = useState<Tapki | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceSent, setInvoiceSent] = useState(false);

  useEffect(() => {
    const loadTapki = async () => {
      setLoading(true);
      try {
        const { success, data, error: fetchError } = await fetchCarById(TAPKI_ID);
        if (success && data) {
          setTapki(data as Tapki);
        } else {
          setError(fetchError || "Тапки не найдены. Может, их смыло в экономический шторм?");
          toast.error(fetchError || "Не удалось загрузить тапочки.");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Критическая ошибка";
        setError(`Ошибка загрузки: ${errorMessage}`);
        toast.error(`Ошибка: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };
    loadTapki();
  }, []);

  useEffect(() => {
    const sendAutoInvoice = async () => {
      if (dbUser?.user_id && !invoiceSent && tapki) {
        try {
          const result = await createTapkiInvoice(dbUser.user_id, TAPKI_ID, TAPKI_PRICE, TAPKI_IMAGE);
          if (result.success) {
            setInvoiceSent(true);
            toast.success("Инвойс на тапочки отправлен! Спаси свои ноги в сауне.");
          } else {
            toast.error(result.error || "Не удалось отправить инвойс.");
          }
        } catch (err) {
          toast.error("Ошибка отправки инвойса.");
        }
      }
    };
    sendAutoInvoice();
  }, [dbUser, tapki, invoiceSent]);

  if (loading) return <Loading variant={'bike'} text="Загружаем спасательные тапочки..." />;

  if (error || !tapki) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center dark">
        <VibeContentRenderer content="::FaCircleXmark::" className="text-5xl text-destructive mb-4"/>
        <p className="text-destructive font-mono text-lg">{error || "Тапки не найдены."}</p>
        <Button onClick={() => router.push('/rent')} className="mt-6">Назад в магазин</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 relative overflow-hidden dark">
      <div className="fixed inset-0 z-[-1] opacity-30">
        <Image src={TAPKI_IMAGE} alt="Tapki Background" fill className="object-cover animate-pan-zoom" />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      </div>

      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="container mx-auto max-w-4xl">
        <div className="relative h-72 md:h-96 w-full rounded-xl overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/20">
          <Image src={TAPKI_IMAGE} alt="Tapki Light" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
          <div className="absolute bottom-6 left-6">
            <h1 className="text-4xl md:text-6xl font-orbitron font-bold drop-shadow-lg">ТАПКИ СВЕТА</h1>
            <h2 className="text-3xl md:text-5xl font-orbitron text-primary drop-shadow-lg">Спаси ноги от сауны-апокалипсиса!</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="bg-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
            <h3 className="text-2xl font-orbitron text-secondary mb-4">ОПИСАНИЕ (С ЮМОРОМ)</h3>
            <p className="font-sans text-muted-foreground leading-relaxed">
              Эти тапочки — не просто обувь, это твоя личная шлюпка в океане пота и пара сауны! Пока старая экономика тонет, ты будешь плавать в комфорте. Легкие, как перышко (но крепче, чем XTR-курс), с антискользящей подошвой — чтобы не поскользнуться на пути к финансовой независимости. Купи сейчас, пока не поздно: "Тапки Света" осветят твой путь в пост-апокалипсисе сауны. В наличии: {tapki.quantity} шт. (Если мало — владелец уже в панике!)
            </p>
            <ul className="mt-4 list-disc pl-5 text-muted-foreground">
              <li>Материал: Супер-лайт резина, выдержит даже экономический крах.</li>
              <li>Цвет: Белый свет — потому что в темноте сауны без них пропадешь!</li>
              <li>Бонус: Каждая пара приносит +10 к карме и спасает ноги от ожогов.</li>
              <li>Юмор: "Почему тапочки светлые? Чтобы в сауне не потерялись, как твои сбережения в банке!"</li>
            </ul>
          </div>

          <div className="bg-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
            <h3 className="text-2xl font-orbitron text-secondary mb-4">CRM-ДЕМО: КУПИ И СПАСИСЬ</h3>
            <div className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center mb-4">
              <p className="text-sm font-mono text-muted-foreground">ЦЕНА ЗА ПАРУ</p>
              <p className="text-2xl font-orbitron text-accent-text font-bold">{TAPKI_PRICE} XTR</p>
              <p className="text-xs text-muted-foreground">В наличии: {tapki.quantity} шт. {tapki.quantity < 3 ? "(Срочно пополнить! Владелец уведомлен.)" : ""}</p>
            </div>
            <Button
              onClick={async () => {
                if (!dbUser?.user_id) return toast.error("Авторизуйся сначала!");
                const result = await createTapkiInvoice(dbUser.user_id, TAPKI_ID, TAPKI_PRICE, TAPKI_IMAGE);
                if (result.success) toast.success("Инвойс отправлен! Тапки ждут.");
                else toast.error(result.error);
              }}
              className="w-full p-4 rounded-xl font-orbitron text-lg font-bold text-accent-foreground bg-gradient-to-r from-primary to-accent hover:brightness-125 transition-all duration-300 shadow-lg hover:shadow-primary/50"
            >
              КУПИТЬ ТАПОЧКИ (ИНВОЙС СРАЗУ)
            </Button>
            <p className="text-xs text-brand-green text-center mt-2">Платеж в XTR — стабильнее, чем старая фиатная система!</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}