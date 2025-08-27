"use client";

import { useState, useEffect, useMemo } from "react";
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
import { ImageGallery } from "@/components/ImageGallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Confetti from "react-dom-confetti";
import Link from "next/link";

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
const TAPKI_PRICE = 100; // XTR per pair
const FAKE_GALLERY = [TAPKI_IMAGE, "https://example.com/tapki-side.jpg", "https://example.com/tapki-closeup.jpg"]; // Demo gallery
const FUN_REVIEWS = [
  { text: "Эти тапочки — как облако для ног! Сауна теперь рай. ⭐⭐⭐⭐⭐", author: "Счастливый парильщик" },
  { text: "Легкие и удобные, не скользят. Идеально для релакса! 😊", author: "Фанат сауны" },
  { text: "Купил пару — теперь вся семья в них. Комфорт на уровне!", author: "Семейный эксперт" },
];

export default function TapkiPage() {
  const router = useRouter();
  const { dbUser } = useAppContext();
  const [tapki, setTapki] = useState<Tapki | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    const loadTapki = async () => {
      setLoading(true);
      try {
        const { success, data, error: fetchError } = await fetchCarById(TAPKI_ID);
        if (success && data) {
          setTapki(data as Tapki);
        } else {
          setError(fetchError || "Тапки не найдены. Может, они где-то в сауне спрятались?");
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
          const totalAmount = TAPKI_PRICE * selectedQuantity;
          const result = await createTapkiInvoice(dbUser.user_id, TAPKI_ID, totalAmount, TAPKI_IMAGE);
          if (result.success) {
            setInvoiceSent(true);
            setConfetti(true);
            setTimeout(() => setConfetti(false), 3000);
            toast.success("Инвойс на тапочки отправлен! Комфорт ждет.");
          } else {
            toast.error(result.error || "Не удалось отправить инвойс.");
          }
        } catch (err) {
          toast.error("Ошибка отправки инвойса.");
        }
      }
    };
    sendAutoInvoice();
  }, [dbUser, tapki, invoiceSent, selectedQuantity]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = parseInt(e.target.value, 10);
    if (qty >= 1 && qty <= (tapki?.quantity || 0)) setSelectedQuantity(qty);
  };

  const totalPrice = TAPKI_PRICE * selectedQuantity;

  const galleryImages = useMemo(() => FAKE_GALLERY, []);

  if (loading) return <Loading variant={'bike'} text="Загружаем комфортные тапочки..." />;

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
    <>
    <ImageGallery images={galleryImages} open={isGalleryOpen} onOpenChange={setIsGalleryOpen} />
    <Confetti active={confetti} config={{ angle: 90, spread: 360, startVelocity: 45, elementCount: 100, dragFriction: 0.1 }} />
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 relative overflow-hidden dark">
      <div className="fixed inset-0 z-[-1] opacity-30">
        <Image src={TAPKI_IMAGE} alt="Tapki Background" fill className="object-cover animate-pan-zoom" />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      </div>

      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="container mx-auto max-w-4xl">
        <div 
          className="relative h-72 md:h-96 w-full rounded-xl overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/20 group cursor-pointer"
          onClick={() => setIsGalleryOpen(true)}
        >
          <Image src={TAPKI_IMAGE} alt="Tapki Light" fill className="object-cover group-hover:scale-105 transition-transform duration-300" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 group-hover:bg-black/50 transition-colors" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <VibeContentRenderer content="::FaImages::" className="text-5xl text-white drop-shadow-lg"/>
          </div>
          <div className="absolute bottom-6 left-6">
            <h1 className="text-4xl md:text-6xl font-orbitron font-bold drop-shadow-lg">ТАПКИ СВЕТА</h1>
            <h2 className="text-3xl md:text-5xl font-orbitron text-primary drop-shadow-lg">Комфорт в сауне на новом уровне!</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="bg-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
            <h3 className="text-2xl font-orbitron text-secondary mb-4">ОПИСАНИЕ (С ЛЕГКИМ ЮМОРОМ)</h3>
            <p className="font-sans text-muted-foreground leading-relaxed">
              Эти тапочки — твой билет в мир комфорта сауны! Легкие, как перышко, с антискользящей подошвой — шагай уверенно, как по облаку. Идеально для релакса после тяжелого дня. В наличии: {tapki.quantity} шт. (Если мало — владелец уже знает, пора пополнить!)
            </p>
            <ul className="mt-4 list-disc pl-5 text-muted-foreground">
              <li>Материал: Мягкая резина — комфортно и прочно.</li>
              <li>Цвет: Светлый — стильно и практично в сауне.</li>
              <li>Бонус: +10 к расслаблению и хорошему настроению!</li>
              <li>Юмор: "Почему тапочки светлые? Чтобы сауна сияла от твоей улыбки! 😄"</li>
            </ul>
            <div className="mt-6">
              <h4 className="text-xl font-orbitron text-secondary mb-2">ОТЗЫВЫ КЛИЕНТОВ</h4>
              {FUN_REVIEWS.map((review, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.2 }} className="bg-muted/20 p-3 rounded-md mb-2">
                  <p className="text-sm">{review.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">- {review.author}</p>
                </motion.div>
              ))}
            </div>
            <Link href="/sauna-rent" className="text-brand-blue hover:underline mt-4 block text-sm">Перейти в сауну и забронировать визит →</Link>
          </div>

          <div className="bg-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
            <h3 className="text-2xl font-orbitron text-secondary mb-4">КУПИТЬ ТАПОЧКИ</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-mono text-muted-foreground block mb-1">Количество (макс {tapki.quantity})</label>
                <Input type="number" value={selectedQuantity} onChange={handleQuantityChange} min={1} max={tapki.quantity} className="input-cyber" />
              </div>
              <div className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center">
                <p className="text-sm font-mono text-muted-foreground">ИТОГО</p>
                <p className="text-2xl font-orbitron text-accent-text font-bold">{totalPrice} XTR</p>
                <p className="text-xs text-muted-foreground">({selectedQuantity} пар{selectedQuantity > 1 ? 'ы' : 'а'})</p>
              </div>
              {tapki.quantity < 3 && <p className="text-xs text-destructive text-center">Мало в наличии! Владелец уведомлен.</p>}
              <Button
                onClick={async () => {
                  if (!dbUser?.user_id) return toast.error("Авторизуйся сначала!");
                  if (selectedQuantity > tapki.quantity) return toast.error("Не хватает в наличии!");
                  const totalAmount = TAPKI_PRICE * selectedQuantity;
                  const result = await createTapkiInvoice(dbUser.user_id, TAPKI_ID, totalAmount, TAPKI_IMAGE);
                  if (result.success) {
                    toast.success("Инвойс отправлен! Тапочки на подходе.");
                    setConfetti(true);
                    setTimeout(() => setConfetti(false), 3000);
                  } else toast.error(result.error);
                }}
                className="w-full p-4 rounded-xl font-orbitron text-lg font-bold text-accent-foreground bg-gradient-to-r from-primary to-accent hover:brightness-125 transition-all duration-300 shadow-lg hover:shadow-primary/50"
              >
                КУПИТЬ ({selectedQuantity} шт.)
              </Button>
              <p className="text-xs text-brand-green text-center">Оплата в XTR — быстро и надежно!</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
}