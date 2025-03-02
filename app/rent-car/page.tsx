"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createInvoice, supabaseAnon, getUserSubscription } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions";
import { useTelegram } from "@/hooks/useTelegram";
import SemanticSearch from "@/components/SemanticSearch";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Crown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const YUAN_TO_STARS_RATE = 0.1;
const AUTO_INCREMENT_INTERVAL = 3000;
const REENGAGE_DELAY = 2000;

export default function RentCar() {
  const { user: tgUser, isInTelegramContext, dbUser, isLoading: tgLoading } = useTelegram();
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [rentDays, setRentDays] = useState(1);
  const [cars, setCars] = useState<any[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [isCarouselEngaged, setIsCarouselEngaged] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      const { data, error } = await supabaseAnon.from("cars").select("*");
      if (error) setError("Ошибка загрузки машин: " + error.message), toast.error("Ошибка загрузки машин");
      else if (!data || data.length === 0) setError("Машины не найдены"), toast.error("Нет машин");
      else setCars(data), toast.success("Машины загружены!");
      setLoading(false);
    };
    fetchCars();
  }, []);

  useEffect(() => {
    const checkSubscription = async () => {
      if (dbUser?.user_id) {
        const subscriptionId = await getUserSubscription(dbUser.user_id);
        setHasSubscription(!!subscriptionId);
        toast.success(subscriptionId ? "Премиум активен" : "Премиум не найден");
      }
    };
    checkSubscription();
  }, [dbUser]);

  useEffect(() => {
    if (!isCarouselEngaged && cars.length > 0) {
      timerRef.current = setInterval(() => setCarouselIndex((prev) => (prev === cars.length - 1 ? 0 : prev + 1)), AUTO_INCREMENT_INTERVAL);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [isCarouselEngaged, cars.length]);

  const handleCarouselEngage = () => {
    if (!isCarouselEngaged) {
      setIsCarouselEngaged(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => {
        if (isCarouselEngaged && cars.length > 0) {
          timerRef.current = setInterval(() => setCarouselIndex((prev) => (prev === cars.length - 1 ? 0 : prev + 1)), AUTO_INCREMENT_INTERVAL);
        }
      }, REENGAGE_DELAY);
    }
    setSelectedCar(cars[carouselIndex]);
    toast.success(`Выбрана машина: ${cars[carouselIndex].make} ${cars[carouselIndex].model}`);
  };

  const handleCarouselPrev = () => { setCarouselIndex((prev) => (prev === 0 ? cars.length - 1 : prev - 1)); handleCarouselEngage(); };
  const handleCarouselNext = () => { setCarouselIndex((prev) => (prev === cars.length - 1 ? 0 : prev + 1)); handleCarouselEngage(); };

  const handleRent = async () => {
    if (!selectedCar) return setError("Выберите машину"), toast.error("Выберите машину");
    setInvoiceLoading(true);
    setError(null);
    setSuccess(false);

    if (!isInTelegramContext || !tgUser) {
      setError("Демо-режим: Telegram не подключён");
      toast.error("Демо-режим: Telegram не подключён");
      setSuccess(true);
      setInvoiceLoading(false);
      return;
    }

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
      await createInvoice("car_rental", invoiceId, tgUser.id.toString(), finalPrice, metadata);
      const description = hasSubscription ? `Премиум-аренда на ${rentDays} дней\nЦена со скидкой: ${finalPrice} XTR (${totalPriceYuan} ¥)\nСкидка подписчика: 10%` : `Аренда на ${rentDays} дней\nЦена: ${finalPrice} XTR (${totalPriceYuan} ¥)`;
      const response = await sendTelegramInvoice(tgUser.id.toString(), `Аренда ${selectedCar.make} ${selectedCar.model}`, description, invoiceId, finalPrice, undefined, selectedCar.image_url);
      if (!response.success) throw new Error(response.error || "Ошибка счёта");
      setSuccess(true);
      toast.success(hasSubscription ? "🌟 Счёт создан! Чекай Telegram!" : "🎉 Счёт создан! Чекай Telegram!");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError("Ошибка счёта: " + errMsg);
      toast.error("Ошибка счёта: " + errMsg);
    } finally {
      setInvoiceLoading(false);
    }
  };

  if (loading || tgLoading) {
    return (
      <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-primary border-muted rounded-full shadow-[0_0_15px_rgba(255,107,107,0.8)]"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-36 bg-background bg-grid-pattern animate-[drift_30s_infinite]">
      <header className="fixed top-20 left-0 right-0 bg-card shadow-md p-6 z-1000 border-b border-muted">
        <h1 className="text-4xl font-bold text-gradient cyber-text glitch" data-text="АРЕНДА КИБЕР-МАШИН">
          АРЕНДА МАШИН
        </h1>
      </header>
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted"
        >
          <h2 className="text-3xl font-semibold text-primary mb-8 cyber-text glitch flex items-center justify-center gap-2" data-text="ВЫБЕРИ СВОЮ ТАЧКУ">
            ВЫБЕРИ СВОЮ ТАЧКУ {hasSubscription && <span className="bg-accent text-accent-foreground px-2 py-1 rounded font-mono text-sm"><Crown className="h-4 w-4 inline" /> Премиум</span>}
          </h2>
          <div className="mb-8 max-w-xl mx-auto">
            <SemanticSearch />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ x: -50 }}
              animate={{ x: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="bg-popover p-6 rounded-xl shadow-inner border border-muted"
            >
              <h3 className="text-2xl font-semibold text-secondary mb-6 cyber-text">КАРУСЕЛЬ МАШИН</h3>
              <div className="relative cursor-pointer" onClick={handleCarouselEngage}>
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
                          width={200}
                          height={150}
                          className="mx-auto rounded-lg border border-muted shadow-[0_0_10px_rgba(255,107,107,0.3)]"
                        />
                        <p className="mt-4 font-mono text-lg text-foreground">{cars[carouselIndex].make} {cars[carouselIndex].model}</p>
                        <p className="font-mono text-sm text-primary">{cars[carouselIndex].daily_price}¥/день</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCarouselPrev(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-primary/60 hover:text-primary hover:bg-muted/50 p-2 rounded-full transition-all"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCarouselNext(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/60 hover:text-primary hover:bg-muted/50 p-2 rounded-full transition-all"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-6">
                <label className="text-sm font-mono text-primary">КОЛИЧЕСТВО ДНЕЙ</label>
                <input
                  type="number"
                  min="1"
                  value={rentDays}
                  onChange={(e) => setRentDays(Math.max(1, Number(e.target.value)))}
                  className="w-full p-3 mt-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-glow font-mono"
                />
              </div>
            </motion.div>
            <motion.div
              initial={{ x: 50 }}
              animate={{ x: 0 }}
              transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
              className="bg-popover p-6 rounded-xl shadow-inner border border-muted"
            >
              <h3 className="text-2xl font-semibold text-secondary mb-6 cyber-text">ИНФО О МАШИНЕ</h3>
              <AnimatePresence mode="wait">
                {isCarouselEngaged && selectedCar ? (
                  <motion.div key={selectedCar.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <motion.div
                      className="relative h-48 md:h-64 w-full rounded-xl overflow-hidden border border-muted shadow-[0_0_15px_rgba(255,107,107,0.3)]"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Image src={selectedCar.image_url || "/placeholder.svg"} alt={`${selectedCar.make} ${selectedCar.model}`} fill className="object-cover" />
                    </motion.div>
                    <div className="text-center space-y-3">
                      <p className="font-mono text-xl md:text-2xl text-foreground">{selectedCar.make} {selectedCar.model}</p>
                      <p className="font-mono text-lg text-primary">{selectedCar.daily_price}¥/день</p>
                      <p className="font-mono text-xl md:text-2xl mt-4 text-muted-foreground">
                        ИТОГО: {selectedCar.daily_price * rentDays}¥ (
                        {hasSubscription ? (
                          <span className="text-accent">{Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE * 0.9)} XTR (10% скидка)</span>
                        ) : (
                          `${Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE)} XTR`
                        )})
                      </p>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={handleRent}
                        disabled={invoiceLoading}
                        className={`w-full p-4 rounded-xl font-semibold text-primary-foreground ${hasSubscription ? "bg-gradient-to-r from-accent to-primary" : "bg-primary"} ${invoiceLoading ? "animate-pulse cursor-not-allowed" : "hover:bg-secondary hover:shadow-[0_0_15px_rgba(255,107,107,0.7)]"} transition-all text-glow font-mono text-lg`}
                      >
                        {invoiceLoading ? "Обработка..." : hasSubscription ? "АРЕНДОВАТЬ СО СКИДКОЙ" : "АРЕНДОВАТЬ"}
                      </button>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-destructive text-sm font-mono flex items-center justify-center gap-1 animate-[neon_2s_infinite]"
                        >
                          <AlertTriangle className="h-4 w-4" /> {error}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="text-center font-mono text-muted-foreground">
                    КЛИКНИ НА КАРУСЕЛЬ ДЛЯ ВЫБОРА
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
          {success && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-primary text-center mt-6 font-mono text-lg p-4 rounded-lg shadow-[0_0_15px_rgba(0,255,157,0.3)]"
            >
              {hasSubscription ? "🌟 Счёт создан! Чекай Telegram!" : "🎉 Счёт создан! Чекай Telegram!"}
            </motion.p>
          )}
        </motion.div>
      </main>
    </div>
  );
}

