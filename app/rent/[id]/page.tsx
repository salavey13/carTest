"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { fetchCarById, createInvoice, getUserSubscription } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions";
import { Loading } from "@/components/Loading";
import { ImageGallery } from "@/components/ImageGallery"; // IMPORT NEW COMPONENT

interface Vehicle {
  id: string;
  make: string;
  model: string;
  daily_price: number;
  image_url: string;
  type: 'car' | 'bike';
  description: string;
  owner_id: string;
  specs?: { 
    gallery?: string[];
    [key: string]: any; 
  };
}

const RUB_TO_STARS_RATE = 1;

const SpecItem = ({ icon, label, value }: { icon: string; label: string; value: string | number }) => (
    <div className="bg-muted/10 p-3 rounded-lg border border-border text-center">
      <VibeContentRenderer content={icon} className="h-6 w-6 mx-auto text-brand-cyan mb-1" />
      <p className="text-xs text-muted-foreground font-mono">{label}</p>
      <p className="text-sm font-semibold font-orbitron">{value}</p>
    </div>
);

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user: tgUser, isInTelegramContext, dbUser } = useAppContext();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rentDays, setRentDays] = useState(1);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false); // GALLERY STATE

  useEffect(() => {
    const loadData = async () => {
      if (!params.id) {
        toast.error("ID транспорта не указан.");
        router.push("/rent-bike");
        return;
      }
      setLoading(true);
      try {
        const { success, data, error: fetchError } = await fetchCarById(params.id);
        if (success && data) {
          setVehicle(data as Vehicle);
        } else {
          toast.error(fetchError || "Не удалось загрузить данные о транспорте.");
          router.push("/rent-bike");
        }
      } catch (err) {
        toast.error("Критическая ошибка при загрузке транспорта.");
        router.push("/rent-bike");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [params.id, router]);

  useEffect(() => {
    const checkSubscription = async () => {
      if (dbUser?.user_id) {
        const subResult = await getUserSubscription(dbUser.user_id);
        if(subResult.success) {
            setHasSubscription(!!subResult.data);
        }
      }
    };
    checkSubscription();
  }, [dbUser]);

  const handleRent = async () => {
    if (!vehicle || !tgUser || !isInTelegramContext) {
      setError("Необходима авторизация в Telegram для аренды.");
      toast.error("Сначала подключись к Telegram!");
      return;
    }
    setInvoiceLoading(true);
    setError(null);
    try {
      const totalPriceRub = vehicle.daily_price * rentDays;
      const totalPriceStars = Math.round(totalPriceRub * RUB_TO_STARS_RATE);
      const finalPrice = hasSubscription ? Math.round(totalPriceStars * 0.9) : totalPriceStars;
      
      const metadata = {
        type: "car_rental",
        car_id: vehicle.id,
        car_make: vehicle.make,
        car_model: vehicle.model,
        days: rentDays,
        price_rub: totalPriceRub,
        price_stars: finalPrice,
        is_subscriber: hasSubscription,
        image_url: vehicle.image_url,
      };
      const invoiceId = `${vehicle.type}_rental_${vehicle.id}_${tgUser.id}_${Date.now()}`;
      await createInvoice("car_rental", invoiceId, tgUser.id.toString(), finalPrice, metadata.car_id, metadata);

      const description = hasSubscription
        ? `Премиум-аренда: ${rentDays} дн.\nЦена со скидкой: ${finalPrice} XTR (${totalPriceRub} ₽)`
        : `Аренда: ${rentDays} дн.\nЦена: ${finalPrice} XTR (${totalPriceRub} ₽)`;

      const response = await sendTelegramInvoice(tgUser.id.toString(), `Аренда ${vehicle.make} ${vehicle.model}`, description, invoiceId, finalPrice, undefined, vehicle.image_url);

      if (!response.success) throw new Error(response.error || "Ошибка отправки счета");
      toast.success("Счет отправлен в Telegram!");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(`Ошибка: ${errMsg}`);
      toast.error(`Не удалось создать счет: ${errMsg}`);
    } finally {
      setInvoiceLoading(false);
    }
  };
  
  const galleryImages = useMemo(() => {
    if (!vehicle) return [];
    return [vehicle.image_url, ...(vehicle.specs?.gallery || [])].filter(Boolean);
  }, [vehicle]);

  if (loading) {
    return <Loading variant={vehicle?.type === 'bike' ? 'bike' : 'generic'} text="ЗАГРУЗКА ДАННЫХ..." />;
  }

  if (!vehicle) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-destructive font-mono">Транспорт не найден.</p></div>
  }

  return (
    <>
    <ImageGallery images={galleryImages} open={isGalleryOpen} onOpenChange={setIsGalleryOpen} />
    <div className="min-h-screen bg-black text-white pt-24 pb-12 relative overflow-hidden">
        <div className="fixed inset-0 z-[-1] opacity-30">
            <Image
            src={vehicle.image_url || "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"}
            alt="Detail Background"
            fill
            className="object-cover animate-pan-zoom"
            />
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        </div>

        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="container mx-auto max-w-4xl"
        >
            <div 
                className="relative h-72 md:h-96 w-full rounded-xl overflow-hidden border-2 border-brand-cyan/30 shadow-2xl shadow-brand-cyan/20 group cursor-pointer"
                onClick={() => setIsGalleryOpen(true)}
            >
                <Image src={vehicle.image_url} alt={vehicle.model} fill className="object-cover group-hover:scale-105 transition-transform duration-300" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 group-hover:bg-black/50 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <VibeContentRenderer content="::FaImages::" className="text-5xl text-white drop-shadow-lg"/>
                </div>
                <div className="absolute bottom-6 left-6">
                    <h1 className="text-4xl md:text-6xl font-orbitron font-bold drop-shadow-lg">{vehicle.make}</h1>
                    <h2 className="text-3xl md:text-5xl font-orbitron text-brand-cyan drop-shadow-lg">{vehicle.model}</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mt-8">
                <div className="md:col-span-3 bg-dark-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
                    <h3 className="text-2xl font-orbitron text-brand-pink mb-4">ОПИСАНИЕ</h3>
                    <p className="font-sans text-muted-foreground leading-relaxed">{vehicle.description}</p>
                </div>

                <div className="md:col-span-2 space-y-6">
                    <div className="bg-dark-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
                        <h3 className="text-2xl font-orbitron text-brand-pink mb-4">ХАРАКТЕРИСТИКИ</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {vehicle.type === 'bike' ? (
                                <>
                                    <SpecItem icon="::FaGears::" label="Двигатель" value={`${vehicle.specs?.engine_cc || 'N/A'} cc`} />
                                    <SpecItem icon="::FaHorseHead::" label="Мощность" value={`${vehicle.specs?.horsepower || 'N/A'} л.с.`} />
                                    <SpecItem icon="::FaWeightHanging::" label="Вес" value={`${vehicle.specs?.weight_kg || 'N/A'} кг`} />
                                    <SpecItem icon="::FaGaugeHigh::" label="Макс. скорость" value={`${vehicle.specs?.top_speed_kmh || 'N/A'} км/ч`} />
                                </>
                            ) : (
                                <>
                                    <SpecItem icon="::FaBolt::" label="Двигатель" value={`${vehicle.specs?.version || 'N/A'}`} />
                                    <SpecItem icon="::FaHorseHead::" label="Мощность" value={`${vehicle.specs?.horsepower || 'N/A'} л.с.`} />
                                    <SpecItem icon="::FaTachometerAlt::" label="Разгон" value={`${vehicle.specs?.acceleration || 'N/A'}`} />
                                    <SpecItem icon="::FaRoad::" label="Макс. скорость" value={`${vehicle.specs?.topSpeed || 'N/A'}`} />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-dark-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                            <label className="text-sm font-mono text-muted-foreground">СРОК АРЕНДЫ (ДНЕЙ)</label>
                            <input
                                type="number"
                                min="1"
                                value={rentDays}
                                onChange={e => setRentDays(Math.max(1, Number(e.target.value)))}
                                className="w-full p-3 mt-1 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-glow font-mono text-center text-lg"
                            />
                            </div>
                            <div className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center h-full flex flex-col justify-center">
                                <p className="text-sm font-mono text-muted-foreground">ИТОГО</p>
                                <p className="text-2xl font-orbitron text-brand-yellow font-bold">
                                    {Math.round((vehicle.daily_price * rentDays * RUB_TO_STARS_RATE) * (hasSubscription ? 0.9 : 1))} XTR
                                </p>
                            </div>
                        </div>
                        {hasSubscription && <p className="text-xs text-brand-green text-center mt-2">(Ваша скидка 10% применена)</p>}
                         <button
                            onClick={handleRent}
                            disabled={invoiceLoading}
                            className="w-full mt-4 p-4 rounded-xl font-orbitron text-lg font-bold text-black bg-gradient-to-r from-brand-cyan to-brand-green hover:brightness-125 transition-all duration-300 disabled:animate-pulse disabled:cursor-not-allowed disabled:brightness-75 shadow-lg hover:shadow-brand-cyan/50"
                        >
                            {invoiceLoading ? 'СОЗДАНИЕ СЧЕТА...' : 'АРЕНДОВАТЬ'}
                        </button>
                        {error && <p className="text-destructive text-center mt-2 font-mono text-sm">{error}</p>}
                    </div>
                </div>
            </div>
        </motion.div>
    </div>
    </>
  );
}