"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { createInvoice, getUserSubscription } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions";
import { getVehiclesWithStatus } from "@/app/rentals/actions";
import { Loading } from "@/components/Loading";
import { Label } from "@/components/ui/label";

type VehicleWithStatus = Awaited<ReturnType<typeof getVehiclesWithStatus>>['data'] extends (infer U)[] ? U : never;

const RUB_TO_STARS_RATE = 1;

const SURVEY_TO_BIKE_TYPE_MAP: Record<string, string> = {
  "Агрессивный нейкед (стритфайтер)": "Naked",
  "Суперспорт (обтекатели, поза эмбриона)": "Supersport",
  "Спорт-турист (мощность и комфорт)": "Sport-tourer",
  "Нео-ретро (стиль и харизма)": "Neo-retro"
};

export default function RentBikePage() {
  const router = useRouter();
  const { user: tgUser, isInTelegramContext, dbUser } = useAppContext();

  const [vehicles, setVehicles] = useState<VehicleWithStatus[]>([]);
  const [selectedBike, setSelectedBike] = useState<VehicleWithStatus | null>(null);
  const [rentDays, setRentDays] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [availableBikeTypes, setAvailableBikeTypes] = useState(["All"]);
  
  const [hasSubscription, setHasSubscription] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recommendedType = useMemo(() => {
    const surveyResults = dbUser?.metadata?.survey_results as Record<string, string> | undefined;
    const surveyStyle = surveyResults?.bike_style;
    if (surveyStyle) {
      return SURVEY_TO_BIKE_TYPE_MAP[surveyStyle] || null;
    }
    return null;
  }, [dbUser]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await getVehiclesWithStatus();
        if (response.success && response.data) {
          const bikes = response.data.filter(v => v.type === 'bike');
          setVehicles(bikes);
          
          const types = new Set(bikes.map(b => (b.specs as any)?.type).filter(Boolean));
          setAvailableBikeTypes(["All", ...Array.from(types) as string[]]);

          if (recommendedType && bikes.some(b => (b.specs as any)?.type === recommendedType)) {
            setActiveFilter(recommendedType);
            setSelectedBike(bikes.find(b => (b.specs as any)?.type === recommendedType && b.availability === 'available') || bikes.find(b => b.availability === 'available') || bikes[0]);
            toast.success(`Подобрали для тебя ${recommendedType} байки!`);
          } else if (bikes.length > 0) {
            setSelectedBike(bikes.find(b => b.availability === 'available') || bikes[0]);
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
  }, [recommendedType]);
  
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
    let bikesToShow = vehicles;
    if (activeFilter !== "All") {
      bikesToShow = vehicles.filter(bike => (bike.specs as any)?.type === activeFilter);
    }
    
    if (recommendedType) {
      bikesToShow.sort((a, b) => {
        const aIsRecommended = (a.specs as any)?.type === recommendedType;
        const bIsRecommended = (b.specs as any)?.type === recommendedType;
        if (aIsRecommended && !bIsRecommended) return -1;
        if (!aIsRecommended && bIsRecommended) return 1;
        return 0;
      });
    }
    return bikesToShow;
  }, [activeFilter, vehicles, recommendedType]);

  const handleRent = async () => {
    if (!selectedBike || !tgUser || !isInTelegramContext) {
      setError("Необходима авторизация в Telegram для аренды.");
      toast.error("Сначала подключись к Telegram!");
      return;
    }
    if (selectedBike.availability === 'taken') {
        toast.error("Этот байк уже занят!");
        return;
    }
    setInvoiceLoading(true);
    setError(null);
    try {
      const totalPriceRub = selectedBike.daily_price! * rentDays;
      const totalPriceStars = Math.round(totalPriceRub * RUB_TO_STARS_RATE);
      const finalPrice = hasSubscription ? Math.round(totalPriceStars * 0.9) : totalPriceStars;
      
      const metadata = {
        type: "bike_rental", 
        car_id: selectedBike.id,
        car_make: selectedBike.make,
        car_model: selectedBike.model,
        days: rentDays,
        price_rub: totalPriceRub,
        price_stars: finalPrice,
        is_subscriber: hasSubscription,
        image_url: selectedBike.image_url,
      };
      const invoiceId = `bike_rental_${selectedBike.id}_${tgUser.id}_${Date.now()}`;
      
      await createInvoice("car_rental", invoiceId, tgUser.id.toString(), finalPrice, metadata.car_id, metadata);

      const description = hasSubscription
        ? `Премиум-аренда: ${rentDays} дн.\nЦена со скидкой: ${finalPrice} XTR (${totalPriceRub} ₽)\nСкидка: 10%`
        : `Аренда: ${rentDays} дн.\nЦена: ${finalPrice} XTR (${totalPriceRub} ₽)`;

      const response = await sendTelegramInvoice(
        tgUser.id.toString(), `Аренда ${selectedBike.make} ${selectedBike.model}`,
        description, invoiceId, finalPrice, undefined, selectedBike.image_url!
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
    return <Loading variant="bike" />;
  }

  return (
    <div className="min-h-screen text-white p-4 pt-24 overflow-hidden relative">
      <div className="fixed inset-0 z-[-1] opacity-30">
        <Image
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
          alt="Moto Garage Background" fill className="object-cover animate-pan-zoom"
        />
        <div className="absolute inset-0 bg-black/60"></div>
      </div>
      <motion.header 
        initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl md:text-7xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-brand-pink to-brand-yellow animate-glitch" data-text="MOTO-GARAGE">
          MOTO-GARAGE
        </h1>
        <p className="text-muted-foreground font-mono mt-2">{recommendedType ? `Рекомендуем для тебя: ${recommendedType}` : "Выбери своего зверя"}</p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
          className="lg:col-span-1 space-y-6"
        >
          <div className="flex flex-wrap gap-2 p-2 bg-dark-card/50 border border-border rounded-lg backdrop-blur-sm">
            {availableBikeTypes.map(type => (
              <button key={type} onClick={() => setActiveFilter(type)}
                className={cn( "px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 font-mono relative",
                  activeFilter === type ? "bg-brand-cyan text-black shadow-[0_0_10px_theme(colors.brand.cyan)]" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {type}
                {type === recommendedType && <VibeContentRenderer content="::FaStar::" className="absolute -top-1 -right-1 text-yellow-400 w-3 h-3"/>}
              </button>
            ))}
          </div>
          <div className="space-y-3 h-[60vh] overflow-y-auto simple-scrollbar pr-2">
            <AnimatePresence>
              {filteredBikes.map(bike => (
                <motion.div
                  key={bike.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  onClick={() => setSelectedBike(bike)}
                  className={cn( "p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 bg-dark-card/70 hover:bg-dark-card backdrop-blur-sm relative",
                    selectedBike?.id === bike.id ? "border-brand-cyan shadow-lg shadow-brand-cyan/20" : "border-border hover:border-brand-cyan/50",
                    bike.availability === 'taken' && 'opacity-50'
                  )}
                >
                    <div className="flex items-center gap-4">
                        <Image src={bike.image_url!} alt={bike.model!} width={80} height={80} className="rounded-md object-cover aspect-square" />
                        <div>
                            <h3 className="font-bold font-orbitron">{bike.make} {bike.model}</h3>
                            <p className="text-sm text-brand-pink font-mono">{bike.daily_price}₽ / день</p>
                            <p className="text-xs text-muted-foreground font-mono">{bike.crew_name || `Владелец: ${bike.owner_id}`}</p>
                        </div>
                    </div>
                    {bike.crew_logo_url && <Image src={bike.crew_logo_url} alt={bike.crew_name || 'Crew Logo'} width={24} height={24} className="absolute top-2 right-2 rounded-full border border-brand-lime shadow-lime-glow"/>}
                    <div className={cn("absolute bottom-2 right-2 text-xs font-mono flex items-center gap-1 p-1 rounded",
                        bike.availability === 'available' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400')}>
                        {bike.availability === 'available' ? <VibeContentRenderer content="::FaCircleCheck::"/> : <VibeContentRenderer content="::FaClock::"/>}
                        <span>{bike.availability === 'available' ? 'Свободен' : 'Занят'}</span>
                    </div>
                     {(bike.specs as any)?.type === recommendedType && <VibeContentRenderer content="::FaStar::" className="absolute top-2 left-2 text-yellow-400 w-4 h-4 text-shadow-brand-yellow"/>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedBike && (
              <motion.div key={selectedBike.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} className="sticky top-24">
                <div className="bg-dark-card/80 border border-border rounded-xl shadow-2xl backdrop-blur-sm p-6">
                  <motion.div layoutId={`bike-image-${selectedBike.id}`} className="relative h-64 md:h-80 w-full mb-6 rounded-lg overflow-hidden">
                    <Image src={selectedBike.image_url!} alt={selectedBike.model!} fill className="object-cover" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                    <h2 className="absolute bottom-4 left-4 text-4xl font-orbitron font-bold drop-shadow-lg">{selectedBike.make} <span className="text-brand-cyan">{selectedBike.model}</span></h2>
                     {selectedBike.crew_logo_url && <Image src={selectedBike.crew_logo_url} alt={selectedBike.crew_name || 'Crew Logo'} width={48} height={48} className="absolute top-4 right-4 rounded-full border-2 border-brand-lime shadow-lime-glow"/>}
                  </motion.div>
                  
                  <p className="font-sans text-muted-foreground mb-6">{selectedBike.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                    <SpecItem icon="::FaGears::" label="Двигатель" value={`${(selectedBike.specs as any)?.engine_cc || 'N/A'} cc`} />
                    <SpecItem icon="::FaHorseHead::" label="Мощность" value={`${(selectedBike.specs as any)?.horsepower || 'N/A'} л.с.`} />
                    <SpecItem icon="::FaWeightHanging::" label="Вес" value={`${(selectedBike.specs as any)?.weight_kg || 'N/A'} кг`} />
                    <SpecItem icon="::FaGaugeHigh::" label="Макс. скорость" value={`${(selectedBike.specs as any)?.top_speed_kmh || 'N/A'} км/ч`} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                      <Label htmlFor="rent-days" className="text-sm font-mono text-muted-foreground">СРОК АРЕНДЫ (ДНЕЙ)</Label>
                      <input id="rent-days" type="number" min="1" value={rentDays} onChange={e => {const v=Number(e.target.value); setRentDays(isNaN(v)||v<1?1:v);}}
                        className="w-full p-3 mt-1 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-glow font-mono text-center text-lg"/>
                    </div>
                    <div className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center">
                      <p className="text-sm font-mono text-muted-foreground">ИТОГО К ОПЛАТЕ</p>
                      <p className="text-2xl font-orbitron text-brand-yellow font-bold">
                        {Math.round((selectedBike.daily_price! * rentDays * RUB_TO_STARS_RATE) * (hasSubscription ? 0.9 : 1))} XTR
                      </p>
                      {hasSubscription && <p className="text-xs text-brand-green">(Скидка 10% применена)</p>}
                    </div>
                  </div>

                  <Button onClick={handleRent} disabled={invoiceLoading || selectedBike.availability === 'taken'}
                    className="w-full mt-6 p-4 rounded-xl font-orbitron text-lg font-bold  transition-all duration-300 disabled:cursor-not-allowed disabled:brightness-75 shadow-lg">
                    {invoiceLoading ? 'СОЗДАНИЕ СЧЕТА...' : selectedBike.availability === 'taken' ? 'ЗАНЯТ' : 'АРЕНДОВАТЬ'}
                  </Button>
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