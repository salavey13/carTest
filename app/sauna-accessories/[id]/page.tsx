"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { createAccessoryInvoice } from "@/app/tapki/actions"; // Reuse general function
import { fetchCarById } from "@/hooks/supabase";
import { Loading } from "@/components/Loading";
import { ImageGallery } from "@/components/ImageGallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import Confetti from "react-dom-confetti";
import Link from "next/link";

interface Accessory {
  id: string;
  make: string;
  model: string;
  description: string;
  image_url: string;
  quantity: number;
  daily_price: number; // Reuse as price
}

const ACCESSORY_DATA: Record<string, { title: string; description: string; gallery: string[]; reviews: { text: string; author: string }[]; recommendations: { name: string; price: number; link: string }[] }> = {
  "venik-classic-abc123": {
    title: "Банный Веник",
    description: "Классический веник для сауны — добавь аромата и релакса!",
    gallery: ["https://example.com/venik.jpg", "https://example.com/venik-side.jpg"],
    reviews: [
      { text: "Отличный веник! Аромат супер. ⭐⭐⭐⭐⭐", author: "Любитель пара" },
      { text: "Идеально для массажа в сауне! 😊", author: "Профи" },
    ],
    recommendations: [
      { name: "Тапки Света", price: 100, link: "/sauna-accessories/tapki-light-6b2f5a10" },
      { name: "Аромамасла", price: 80, link: "/sauna-accessories/aroma-oils-set-def456" },
    ],
  },
  "aroma-oils-set-def456": {
    title: "Аромамасла Сет",
    description: "Набор эфирных масел — для полного расслабления в сауне.",
    gallery: ["https://example.com/oils.jpg", "https://example.com/oils-set.jpg"],
    reviews: [
      { text: "Запахи божественные! Рекомендую. ⭐⭐⭐⭐⭐", author: "Ароматерапевт" },
      { text: "Добавляет атмосферы сауне! 😊", author: "Посетитель" },
    ],
    recommendations: [
      { name: "Банный Веник", price: 50, link: "/sauna-accessories/venik-classic-abc123" },
      { name: "Шапка для сауны", price: 120, link: "/sauna-accessories/sauna-hat-ghi789" },
    ],
  },
  "sauna-hat-ghi789": {
    title: "Шапка для Сауны",
    description: "Защитная шапка — комфорт и стиль в жаре сауны.",
    gallery: ["https://example.com/hat.jpg", "https://example.com/hat-wear.jpg"],
    reviews: [
      { text: "Удобная и качественная! ⭐⭐⭐⭐⭐", author: "Постоянный клиент" },
      { text: "Не дает голове перегреться! 😊", author: "Новичок" },
    ],
    recommendations: [
      { name: "Аромамасла", price: 80, link: "/sauna-accessories/aroma-oils-set-def456" },
      { name: "Тапки Света", price: 100, link: "/sauna-accessories/tapki-light-6b2f5a10" },
    ],
  },
  // Add tapki for cross-link
  "tapki-light-6b2f5a10": {
    title: "Тапки Света",
    description: "Легкие тапочки для сауны — шагай с комфортом!",
    gallery: [TAPKI_IMAGE, "https://example.com/tapki-side.jpg"],
    reviews: [
      { text: "Эти тапочки — как облако для ног! ⭐⭐⭐⭐⭐", author: "Счастливый парильщик" },
      { text: "Легкие и удобные! 😊", author: "Фанат сауны" },
    ],
    recommendations: [
      { name: "Банный Веник", price: 50, link: "/sauna-accessories/venik-classic-abc123" },
      { name: "Аромамасла", price: 80, link: "/sauna-accessories/aroma-oils-set-def456" },
    ],
  },
};

export default function AccessoryPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { dbUser } = useAppContext();
  const [accessory, setAccessory] = useState<Accessory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [customMessage, setCustomMessage] = useState('');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const itemData = ACCESSORY_DATA[id] || { title: 'Аксессуар', description: 'Описание', gallery: [], reviews: [], recommendations: [] };

  useEffect(() => {
    const loadAccessory = async () => {
      setLoading(true);
      try {
        const { success, data, error: fetchError } = await fetchCarById(id);
        if (success && data) {
          setAccessory(data as Accessory);
        } else {
          setError(fetchError || "Аксессуар не найден.");
          toast.error(fetchError || "Не удалось загрузить.");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Ошибка";
        setError(`Ошибка: ${errorMessage}`);
        toast.error(`Ошибка: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };
    loadAccessory();
  }, [id]);

  useEffect(() => {
    const sendAutoInvoice = async () => {
      if (dbUser?.user_id && !invoiceSent && accessory) {
        try {
          const totalAmount = accessory.daily_price * selectedQuantity;
          const result = await createAccessoryInvoice(dbUser.user_id, id, totalAmount, accessory.image_url, customMessage, itemData.title, itemData.description);
          if (result.success) {
            setInvoiceSent(true);
            setConfetti(true);
            setTimeout(() => setConfetti(false), 3000);
            toast.success("Донат отправлен! Спасибо.");
          } else {
            toast.error(result.error || "Ошибка инвойса.");
          }
        } catch (err) {
          toast.error("Ошибка отправки.");
        }
      }
    };
    sendAutoInvoice();
  }, [dbUser, accessory, invoiceSent, selectedQuantity, customMessage, id, itemData]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = parseInt(e.target.value, 10);
    if (qty >= 1 && qty <= (accessory?.quantity || 0)) setSelectedQuantity(qty);
  };

  const totalPrice = (accessory?.daily_price || 0) * selectedQuantity;
  const stockPercentage = ((accessory?.quantity || 0) / 20) * 100; // Arbitrary max for progress

  const galleryImages = useMemo(() => itemData.gallery, [itemData.gallery]);

  if (loading) return <Loading variant={'bike'} text="Загружаем аксессуар..." />;

  if (error || !accessory) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center dark">
        <VibeContentRenderer content="::FaCircleXmark::" className="text-5xl text-destructive mb-4"/>
        <p className="text-destructive font-mono text-lg">{error || "Не найдено."}</p>
        <Button onClick={() => router.push('/sauna-accessories')} className="mt-6">Назад</Button>
      </div>
    );
  }

  return (
    <>
    <ImageGallery images={galleryImages} open={isGalleryOpen} onOpenChange={setIsGalleryOpen} />
    <Confetti active={confetti} config={{ angle: 90, spread: 360, startVelocity: 45, elementCount: 100, dragFriction: 0.1 }} />
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 relative overflow-hidden dark">
      <div className="fixed inset-0 z-[-1] opacity-30">
        <Image src={accessory.image_url} alt="Background" fill className="object-cover animate-pan-zoom" />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      </div>

      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="container mx-auto max-w-4xl">
        <div 
          className="relative h-72 md:h-96 w-full rounded-xl overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/20 group cursor-pointer"
          onClick={() => setIsGalleryOpen(true)}
        >
          <Image src={accessory.image_url} alt={itemData.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 group-hover:bg-black/50 transition-colors" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <VibeContentRenderer content="::FaImages::" className="text-5xl text-white drop-shadow-lg"/>
          </div>
          <div className="absolute bottom-6 left-6">
            <h1 className="text-4xl md:text-6xl font-orbitron font-bold drop-shadow-lg">{accessory.make.toUpperCase()}</h1>
            <h2 className="text-3xl md:text-5xl font-orbitron text-primary drop-shadow-lg">{itemData.title}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="bg-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
            <h3 className="text-2xl font-orbitron text-secondary mb-4">ОПИСАНИЕ</h3>
            <p className="font-sans text-muted-foreground leading-relaxed">
              {itemData.description} В наличии: {accessory.quantity} шт.
            </p>
            <ul className="mt-4 list-disc pl-5 text-muted-foreground">
              <li>Качество: Премиум для сауны.</li>
              <li>Бонус: +10 к комфорту!</li>
              <li>Юмор: "С этим аксессуаром сауна — сплошной релакс! 😄"</li>
            </ul>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4">
              <label className="text-sm font-mono text-muted-foreground block mb-1">Остаток</label>
              <Progress value={stockPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{accessory.quantity} шт.</p>
            </motion.div>
            <div className="mt-6">
              <h4 className="text-xl font-orbitron text-secondary mb-2">ОТЗЫВЫ</h4>
              {itemData.reviews.map((review, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.2 }} className="bg-muted/20 p-3 rounded-md mb-2">
                  <p className="text-sm">{review.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">- {review.author}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-6">
              <h4 className="text-xl font-orbitron text-secondary mb-2">РЕКОМЕНДАЦИИ</h4>
              <div className="grid grid-cols-1 gap-2">
                {itemData.recommendations.map((rec, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="bg-muted/20 p-3 rounded-md flex justify-between items-center">
                    <span>{rec.name} - {rec.price} XTR</span>
                    <Link href={rec.link} className="text-brand-blue hover:underline text-sm">Купить</Link>
                  </motion.div>
                ))}
              </div>
            </div>
            <Link href="/sauna-rent" className="text-brand-blue hover:underline mt-4 block text-sm">Забронировать сауну →</Link>
          </div>

          <div className="bg-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
            <h3 className="text-2xl font-orbitron text-secondary mb-4">ДОНАТ ЗА GOOD SERVICE</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-mono text-muted-foreground block mb-1">Количество (макс {accessory.quantity})</label>
                <Input type="number" value={selectedQuantity} onChange={handleQuantityChange} min={1} max={accessory.quantity} className="input-cyber" />
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center">
                <p className="text-sm font-mono text-muted-foreground">ИТОГО</p>
                <p className="text-2xl font-orbitron text-accent-text font-bold">{totalPrice} XTR</p>
                <p className="text-xs text-muted-foreground">({selectedQuantity} шт.)</p>
              </motion.div>
              {accessory.quantity < 3 && <p className="text-xs text-destructive text-center">Мало в наличии!</p>}
              <div>
                <label className="text-sm font-mono text-muted-foreground block mb-1">Сообщение (опционально)</label>
                <Textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Спасибо за сервис!" className="input-cyber min-h-[80px]" />
              </div>
              <Button
                onClick={async () => {
                  if (!dbUser?.user_id) return toast.error("Авторизуйся!");
                  if (selectedQuantity > accessory.quantity) return toast.error("Не хватает!");
                  const totalAmount = accessory.daily_price * selectedQuantity;
                  const result = await createAccessoryInvoice(dbUser.user_id, id, totalAmount, accessory.image_url, customMessage, itemData.title, itemData.description);
                  if (result.success) {
                    toast.success("Донат отправлен!");
                    setConfetti(true);
                    setTimeout(() => setConfetti(false), 3000);
                  } else toast.error(result.error);
                }}
                className="w-full p-4 rounded-xl font-orbitron text-lg font-bold text-accent-foreground bg-gradient-to-r from-primary to-accent hover:brightness-125 transition-all duration-300 shadow-lg hover:shadow-primary/50"
              >
                ДОНАТИТЬ ({selectedQuantity} шт.)
              </Button>
              <p className="text-xs text-brand-green text-center">XTR — надежно!</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
}