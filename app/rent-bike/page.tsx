"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { fetchCars, createInvoice, getUserSubscription } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions";

// Define interfaces locally for clarity
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
    engine_cc?: number;
    horsepower?: number;
    weight_kg?: number;
    top_speed_kmh?: number;
    type?: string;
    electronics?: string[];
    [key: string]: any;
  };
}

const YUAN_TO_STARS_RATE = 0.1;

export default function RentBikePage() {
  const router = useRouter();
  const { user: tgUser, isInTelegramContext, dbUser } = useAppContext();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedBike, setSelectedBike] = useState<Vehicle | null>(null);
  const [rentDays, setRentDays] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [availableBikeTypes, setAvailableBikeTypes] = useState(["All"]);
  
  const [hasSubscription, setHasSubscription] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await fetchCars();
        if (response.success && response.data) {
          const bikes = response.data.filter(v => v.type === 'bike');
          setVehicles(bikes);
          
          const types = new Set(bikes.map(b => b.specs?.type).filter(Boolean));
          setAvailableBikeTypes(["All", ...Array.from(types) as string[]]);

          if (bikes.length > 0) {
            setSelectedBike(bikes[0]);
          } else {
            toast.info("В гараже пока нет байков.");
          }
        } else {
            toast.error(response.error || "Ошибка загрузки гаража!");
        }
      } catch (err) {
        console.error("Error loading bikes:", err);
        toast.error("Критическая ошибка загрузки гаража!");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  useEffect(() => {
    const checkSubscription = async () => {
      if (dbUser?.user_id) {
        const subResult = await getUserSubscription(dbUser.user_id);
        if (subResult.success) {
            setHasSubscription(!!subResult.data);
        }
      }
    };
    checkSubscription();
  }, [dbUser]);
  
  const filteredBikes = useMemo(() => {
    if (activeFilter === "All") return vehicles;
    return vehicles.filter(bike => bike.specs?.type === activeFilter);
  }, [activeFilter, vehicles]);

  const handleRent = async () => {
    if (!selectedBike || !tgUser || !isInTelegramContext) {
      setError("Необходима авторизация в Telegram для аренды.");
      toast.error("Сначала подключись к Telegram!");
      return;
    }
    setInvoiceLoading(true);
    setError(null);
    try {
      const totalPriceYuan = selectedBike.daily_price * rentDays;
      const totalPriceStars = Math.round(totalPriceYuan * YUAN_TO_STARS_RATE);
      const finalPrice = hasSubscription ? Math.round(totalPriceStars * 0.9) : totalPriceStars;
      
      const metadata = {
        type: "car_rental", // Keep this for now to use existing webhook
        car_id: selectedBike.id,
        car_make: selectedBike.make,
        car_model: selectedBike.model,
        days: rentDays,
        price_yuan: totalPriceYuan,
        price_stars: finalPrice,
        is_subscriber: hasSubscription,
        image_url: selectedBike.image_url,
      };
      const invoiceId = `bike_rental_${selectedBike.id}_${tgUser.id}_${Date.now()}`;
      await createInvoice("car_rental", invoiceId, tgUser.id.toString(), finalPrice, metadata.car_id, metadata);

      const description = hasSubscription
        ? `Премиум-аренда: ${rentDays} дн.\nЦена со скидкой: ${finalPrice} XTR (${totalPriceYuan} ¥)\nСкидка: 10%`
        : `Аренда: ${rentDays} дн.\nЦена: ${finalPrice} XTR (${totalPriceYuan} ¥)`;

      const response = await sendTelegramInvoice(
        tgUser.id.toString(),
        `Аренда ${selectedBike.make} ${selectedBike.model}`,
        description,
        invoiceId,
        finalPrice,
        undefined,
        selectedBike.image_url
      );

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center dark:invert">
        <Image 
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
          alt="Loading Garage..."
          width={200}
          height={200}
          unoptimized
        />
        <p className='font-mono text-brand-cyan dark:text-black mt-4 animate-pulse'>ЗАГРУЗКА ГАРАЖА...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pt-24 overflow-hidden relative">
      <div className="fixed inset-0 z-[-1] opacity-30">
        <Image
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
          alt="Moto Garage Background"
          fill
          className="object-cover animate-pan-zoom"
        />
        <div className="absolute inset-0 bg-black/60"></div>
      </div>
      <motion.header 
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl md:text-7xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-brand-pink to-brand-yellow animate-glitch" data-text="MOTO-GARAGE">
          MOTO-GARAGE
        </h1>
        <p className="text-muted-foreground font-mono mt-2">Выбери своего зверя</p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {/* Bike Selection Grid */}
        <motion.div 
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="lg:col-span-1 space-y-6"
        >
          <div className="flex flex-wrap gap-2 p-2 bg-dark-card/50 border border-border rounded-lg backdrop-blur-sm">
            {availableBikeTypes.map(type => (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className={cn(
                  "px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 font-mono",
                  activeFilter === type ? "bg-brand-cyan text-black shadow-[0_0_10px_theme(colors.brand.cyan)]" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="space-y-3 h-[60vh] overflow-y-auto simple-scrollbar pr-2">
            <AnimatePresence>
              {filteredBikes.map(bike => (
                <motion.div
                  key={bike.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={() => setSelectedBike(bike)}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 bg-dark-card/70 hover:bg-dark-card backdrop-blur-sm",
                    selectedBike?.id === bike.id ? "border-brand-cyan shadow-lg shadow-brand-cyan/20" : "border-border hover:border-brand-cyan/50"
                  )}
                >
                  <Image src={bike.image_url} alt={bike.model} width={80} height={80} className="rounded-md object-cover aspect-square" />
                  <div>
                    <h3 className="font-bold font-orbitron">{bike.make} {bike.model}</h3>
                    <p className="text-sm text-brand-pink font-mono">{bike.daily_price}¥ / день</p>
                    <p className="text-xs text-muted-foreground font-mono">Гараж: {bike.owner_id}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Selected Bike Display */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedBike && (
              <motion.div
                key={selectedBike.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="sticky top-24"
              >
                <div className="bg-dark-card/80 border border-border rounded-xl shadow-2xl backdrop-blur-sm p-6">
                  <motion.div layoutId={`bike-image-${selectedBike.id}`} className="relative h-64 md:h-80 w-full mb-6 rounded-lg overflow-hidden">
                    <Image src={selectedBike.image_url} alt={selectedBike.model} fill className="object-cover" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                    <h2 className="absolute bottom-4 left-4 text-4xl font-orbitron font-bold drop-shadow-lg">{selectedBike.make} <span className="text-brand-cyan">{selectedBike.model}</span></h2>
                  </motion.div>
                  
                  <p className="font-sans text-muted-foreground mb-6">{selectedBike.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                    <SpecItem icon="::FaGears::" label="Двигатель" value={`${selectedBike.specs?.engine_cc || 'N/A'} cc`} />
                    <SpecItem icon="::FaHorseHead::" label="Мощность" value={`${selectedBike.specs?.horsepower || 'N/A'} л.с.`} />
                    <SpecItem icon="::FaWeightHanging::" label="Вес" value={`${selectedBike.specs?.weight_kg || 'N/A'} кг`} />
                    <SpecItem icon="::FaGaugeHigh::" label="Макс. скорость" value={`${selectedBike.specs?.top_speed_kmh || 'N/A'} км/ч`} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
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
                    <div className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center">
                      <p className="text-sm font-mono text-muted-foreground">ИТОГО К ОПЛАТЕ</p>
                      <p className="text-2xl font-orbitron text-brand-yellow font-bold">
                        {Math.round((selectedBike.daily_price * rentDays * YUAN_TO_STARS_RATE) * (hasSubscription ? 0.9 : 1))} XTR
                      </p>
                      {hasSubscription && <p className="text-xs text-brand-green">(Скидка 10% применена)</p>}
                    </div>
                  </div>

                  <button
                    onClick={handleRent}
                    disabled={invoiceLoading}
                    className="w-full mt-6 p-4 rounded-xl font-orbitron text-lg font-bold text-black bg-gradient-to-r from-brand-cyan to-brand-green hover:brightness-125 transition-all duration-300 disabled:animate-pulse disabled:cursor-not-allowed disabled:brightness-75 shadow-lg hover:shadow-brand-cyan/50"
                  >
                    {invoiceLoading ? 'СОЗДАНИЕ СЧЕТА...' : 'АРЕНДОВАТЬ'}
                  </button>
                  {error && <p className="text-destructive text-center mt-2 font-mono text-sm">{error}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const SpecItem = ({ icon, label, value }: { icon: string; label: string; value: string | number }) => (
  <div className="bg-muted/10 p-3 rounded-lg border border-border">
    <VibeContentRenderer content={icon} className="h-6 w-6 mx-auto text-brand-cyan mb-1" />
    <p className="text-xs text-muted-foreground font-mono">{label}</p>
    <p className="text-sm font-semibold font-orbitron">{value}</p>
  </div>
);