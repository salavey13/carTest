"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchCarById, fetchCars, createInvoice } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions";
import { useTelegram } from "@/hooks/useTelegram";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Crown, AlertTriangle } from "lucide-react";
import {  getUserSubscription } from "@/hooks/supabase"
interface Car {
  id: string;
  make: string;
  model: string;
  daily_price: number;
  image_url: string;
  specs?: Record<string, string | number | boolean>;
}

const YUAN_TO_STARS_RATE = 0.1;

export default function RentCarPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user: tgUser, isInTelegramContext, dbUser } = useTelegram();
  const [car, setCar] = useState<Car | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [rentDays, setRentDays] = useState(1);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [carData, allCars] = await Promise.all([fetchCarById(params.id), fetchCars()]);
        if (!carData) {
          toast.error("Машина не найдена, пиздец!");
          router.push("/not-found");
          return;
        }
        setCar(carData);
        setSelectedCar(carData);
        setCars(allCars || []);
        setCarouselIndex(allCars.findIndex((c) => c.id === carData.id) || 0);
        toast.success(`Машина ${carData.make} ${carData.model} загружена, командир!`);
      } catch (err) {
        console.error("Ошибка загрузки:", err);
        toast.error("Кибер-гараж сломался, сорян!");
        router.push("/not-found");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [params.id, router]);

  useEffect(() => {
    const checkSubscription = async () => {
      if (dbUser?.user_id) {
        const subscriptionId = await getUserSubscription(dbUser.user_id);
        setHasSubscription(!!subscriptionId);
        toast.success(subscriptionId ? "Ты в элите, братан!" : "Премиума нет, покажи бабки!");
      }
    };
    checkSubscription();
  }, [dbUser]);

  const handleCarouselPrev = () => {
    setCarouselIndex((prev) => (prev === 0 ? cars.length - 1 : prev - 1));
    setSelectedCar(cars[carouselIndex === 0 ? cars.length - 1 : carouselIndex - 1]);
    toast.info(`Переключил на ${cars[carouselIndex === 0 ? cars.length - 1 : carouselIndex - 1].make} ${cars[carouselIndex === 0 ? cars.length - 1 : carouselIndex - 1].model}`);
  };

  const handleCarouselNext = () => {
    setCarouselIndex((prev) => (prev === cars.length - 1 ? 0 : prev + 1));
    setSelectedCar(cars[carouselIndex === cars.length - 1 ? 0 : carouselIndex + 1]);
    toast.info(`Переключил на ${cars[carouselIndex === cars.length - 1 ? 0 : carouselIndex + 1].make} ${cars[carouselIndex === cars.length - 1 ? 0 : carouselIndex + 1].model}`);
  };

  const handleRent = async () => {
    if (!selectedCar || !tgUser || !isInTelegramContext) {
      setError("Залогинься в Telegram, чувак!");
      toast.error("Залогинься в Telegram, без этого никак!");
      return;
    }

    setInvoiceLoading(true);
    setError(null);

    try {
      const totalPriceYuan = selectedCar.daily_price * rentDays;
      const totalPriceStars = Math.round(totalPriceYuan * YUAN_TO_STARS_RATE);
      const finalPrice = hasSubscription ? Math.round(totalPriceStars * 0.9) : totalPriceStars;
      const metadata = {
        type: "car_rental",
        car_id: selectedCar.id,
        car_make: selectedCar.make,
        car_model: selectedCar.model,
        days: rentDays,
        price_yuan: totalPriceYuan,
        price_stars: finalPrice,
        is_subscriber: hasSubscription,
        original_price: totalPriceStars,
        discount_applied: hasSubscription ? "10%" : "0%",
        image_url: selectedCar.image_url,
      };
      const invoiceId = `car_rental_${selectedCar.id}_${tgUser.id}_${Date.now()}`;
      toast.success("Генерю счёт, держись!");
      await createInvoice("car_rental", invoiceId, tgUser.id.toString(), finalPrice, metadata);
      const description = hasSubscription
        ? `Премиум-аренда на ${rentDays} дней\nЦена со скидкой: ${finalPrice} XTR (${totalPriceYuan} ¥)\nСкидка элиты: 10%`
        : `Аренда на ${rentDays} дней\nЦена: ${finalPrice} XTR (${totalPriceYuan} ¥)`;
      const response = await sendTelegramInvoice(tgUser.id.toString(), `Аренда ${selectedCar.make} ${selectedCar.model}`, description, invoiceId, finalPrice, undefined, selectedCar.image_url);
      if (!response.success) throw new Error(response.error || "Счёт не взлетел!");
      toast.success(hasSubscription ? "🌟 Счёт в Telegram, элитный гонщик!" : "🎉 Счёт в Telegram, жги!");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Хз что сломалось!";
      setError("Ошибка: " + errMsg);
      toast.error("Счёт не выгорел: " + errMsg);
    } finally {
      setInvoiceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-[#00ff9d] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-[#00ff9d] border-[#00ff9d]/20 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.5)]"
        />
        <span className="ml-4 text-2xl font-mono animate-pulse">Гружу железо...</span>
      </div>
    );
  }

  const specs = selectedCar?.specs || {
    version: "v12",
    electric: false,
    color: "Кибер-синий",
    theme: "Киберпанк",
    horsepower: 900,
    torque: "750 Нм",
    acceleration: "2.9с 0-100 км/ч",
    topSpeed: "340 км/ч",
  };

  // Categorize specs into "Power" and "Style"
  const powerSpecs = ["version", "electric", "horsepower", "torque", "acceleration", "topSpeed"];
  const styleSpecs = ["color", "theme"];
  const powerEntries: [string, string | number | boolean][] = [];
  const styleEntries: [string, string | number | boolean][] = [];
  const customEntries: [string, string | number | boolean][] = [];

  Object.entries(specs).forEach(([key, value]) => {
    if (powerSpecs.includes(key)) {
      powerEntries.push([key, value]);
    } else if (styleSpecs.includes(key)) {
      styleEntries.push([key, value]);
    } else {
      customEntries.push([key, value]);
    }
  });

  return (
    <div className="min-h-screen pt-24 bg-gradient-to-b from-gray-900 to-black text-[#00ff9d] animate-[drift_30s_infinite]">
      <header className="fixed top-0 left-0 right-0 bg-gray-900 shadow-[0_0_15px_rgba(255,107,107,0.5)] p-6 z-10 border-b border-[#ff007a]/50">
        <h1 className="text-4xl font-mono text-[#00ff9d] glitch text-center animate-[neon_2s_infinite]" data-text="АРЕНДА КИБЕР-ТАЧКИ">
          АРЕНДА КИБЕР-ТАЧКИ
        </h1>
      </header>
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-8 bg-gray-900 rounded-2xl shadow-[0_0_25px_rgba(255,107,107,0.7)] border border-[#ff007a]/70"
        >
          <h2 className="text-3xl font-mono text-[#00ff9d] mb-8 cyber-text glitch flex items-center justify-center gap-2 animate-[neon_2s_infinite]" data-text="ВЫБЕРИ ЖЕЛЕЗО">
            ВЫБЕРИ ЖЕЛЕЗО {hasSubscription && <span className="bg-[#ff007a]/80 text-white px-2 py-1 rounded font-mono text-sm"><Crown className="h-4 w-4 inline" /> Элита</span>}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Carousel */}
            <motion.div
              initial={{ x: -50 }}
              animate={{ x: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="bg-gray-800 p-6 rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.5)] border border-[#00ff9d]/50"
            >
              <h3 className="text-2xl font-mono text-[#00ff9d] mb-6 glitch animate-[neon_2s_infinite]" data-text="КАРУСЕЛЬ ЖЕЛЕЗА">
                КАРУСЕЛЬ ЖЕЛЕЗА
              </h3>
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={carouselIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center justify-center"
                  >
                    {cars[carouselIndex] && (
                      <div className="text-center">
                        <Image
                          src={cars[carouselIndex].image_url || "/placeholder.svg"}
                          alt={`${cars[carouselIndex].make} ${cars[carouselIndex].model}`}
                          width={250}
                          height={180}
                          className="mx-auto rounded-lg border border-[#00ff9d]/50 shadow-[0_0_20px_rgba(0,255,157,0.7)] hover:scale-105 transition-transform"
                        />
                        <p className="mt-4 font-mono text-xl text-[#00ff9d]">{cars[carouselIndex].make} {cars[carouselIndex].model}</p>
                        <p className="font-mono text-base text-[#ff007a]">{cars[carouselIndex].daily_price}¥/день</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                <button
                  onClick={handleCarouselPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[#00ff9d]/70 hover:text-[#00ff9d] hover:bg-gray-700/50 p-3 rounded-full transition-all shadow-[0_0_10px_rgba(0,255,157,0.5)]"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={handleCarouselNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#00ff9d]/70 hover:text-[#00ff9d] hover:bg-gray-700/50 p-3 rounded-full transition-all shadow-[0_0_10px_rgba(0,255,157,0.5)]"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-6">
                <label className="text-sm font-mono text-[#00ff9d] text-glow">СКОЛЬКО ДНЕЙ ЖЕЧЬ?</label>
                <input
                  type="number"
                  min="1"
                  value={rentDays}
                  onChange={(e) => setRentDays(Math.max(1, Number(e.target.value)))}
                  className="w-full p-3 mt-2 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
                />
              </div>
            </motion.div>

            {/* Car Info */}
            <motion.div
              initial={{ x: 50 }}
              animate={{ x: 0 }}
              transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
              className="bg-gray-800 p-6 rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.5)] border border-[#00ff9d]/50"
            >
              <h3 className="text-2xl font-mono text-[#00ff9d] mb-6 glitch animate-[neon_2s_infinite]" data-text="ДАННЫЕ ТАЧКИ">
                ДАННЫЕ ТАЧКИ
              </h3>
              <AnimatePresence mode="wait">
                {selectedCar ? (
                  <motion.div key={selectedCar.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <motion.div
                      className="relative h-48 md:h-64 w-full rounded-xl overflow-hidden border border-[#00ff9d]/50 shadow-[0_0_20px_rgba(0,255,157,0.7)]"
                      whileHover={{ scale: 1.03 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Image src={selectedCar.image_url || "/placeholder.svg"} alt={`${selectedCar.make} ${selectedCar.model}`} fill className="object-cover" />
                    </motion.div>
                    <div className="text-center space-y-4">
                      <p className="font-mono text-2xl text-[#00ff9d]">{selectedCar.make} {selectedCar.model}</p>
                      <p className="font-mono text-lg text-[#ff007a]">{selectedCar.daily_price}¥/день</p>
                      <p className="font-mono text-xl text-[#00ff9d]/70">
                        ИТОГО: {selectedCar.daily_price * rentDays}¥ (
                        {hasSubscription ? (
                          <span className="text-[#ff007a]">{Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE * 0.9)} XTR (10% ништяк)</span>
                        ) : (
                          `${Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE)} XTR`
                        )})
                      </p>
                    </div>
                    <button
                      onClick={handleRent}
                      disabled={invoiceLoading || !isInTelegramContext}
                      className={`w-full p-4 rounded-xl font-mono text-lg text-white ${hasSubscription ? "bg-gradient-to-r from-[#ff007a] to-[#00ff9d]" : "bg-[#ff007a]/80"} ${invoiceLoading ? "animate-pulse cursor-not-allowed" : "hover:bg-[#ff007a] hover:shadow-[0_0_25px_rgba(255,0,122,1)]"} transition-all`}
                    >
                      {invoiceLoading ? "ГЕНЕРЮ..." : hasSubscription ? "ГОНЯТЬ С НИШТЯКОМ" : "ГОНЯТЬ"}
                    </button>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[#ff007a] text-sm font-mono flex items-center justify-center gap-1 animate-[neon_2s_infinite]"
                      >
                        <AlertTriangle className="h-4 w-4" /> {error}
                      </motion.p>
                    )}
                  </motion.div>
                ) : (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="text-center font-mono text-[#00ff9d]/70">
                    КЛИКНИ НА ЖЕЛЕЗО, ЧТОБЫ УВИДЕТЬ!
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Dynamic Specs Section */}
          {selectedCar && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-12 bg-gray-800 p-6 rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.5)] border border-[#00ff9d]/50"
            >
              <h3 className="text-2xl font-mono text-[#00ff9d] mb-6 glitch animate-[neon_2s_infinite]" data-text="ТЕРМИНАЛ ХАРАКТЕРИСТИК">
                ТЕРМИНАЛ ХАРАКТЕРИСТИК
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Power Specs */}
                <div className="space-y-4">
                  <h4 className="text-lg font-mono text-[#ff007a] animate-[neon_2s_infinite]">МОЩА</h4>
                  {powerEntries.map(([key, value]) => (
                    <p key={key} className="text-[#00ff9d]/70 font-mono">
                      <span className="text-[#00ff9d]">
                        {key === "version" ? "Версия" :
                         key === "electric" ? "Электро" :
                         key === "horsepower" ? "Лошадки" :
                         key === "torque" ? "Крутяк" :
                         key === "acceleration" ? "Разгон" :
                         key === "topSpeed" ? "Макс" : key}:
                      </span>{" "}
                      {key === "electric" ? (value ? "Да, братан!" : "Бенз, классика!") : value}
                    </p>
                  ))}
                </div>

                {/* Style Specs */}
                <div className="space-y-4">
                  <h4 className="text-lg font-mono text-[#ff007a] animate-[neon_2s_infinite]">СТИЛЬ</h4>
                  {styleEntries.map(([key, value]) => (
                    <p key={key} className="text-[#00ff9d]/70 font-mono">
                      <span className="text-[#00ff9d]">
                        {key === "color" ? "Цвет" :
                         key === "theme" ? "Тема" : key}:
                      </span>{" "}
                      {value}
                    </p>
                  ))}
                  {customEntries.length > 0 && (
                    <>
                      <h4 className="text-lg font-mono text-[#ff007a] animate-[neon_2s_infinite] mt-4">КАСТОМ</h4>
                      {customEntries.map(([key, value]) => (
                        <p key={key} className="text-[#00ff9d]/70 font-mono">
                          <span className="text-[#00ff9d]">{key}:</span> {value}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </motion.div>
      </main>
    </div>
  );
}

