"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { createBooking, getUserSubscription, getVehicleCalendar } from "@/app/rentals/actions";
import { fetchCarById } from "@/hooks/supabase";
import { Loading } from "@/components/Loading";
import { ImageGallery } from "@/components/ImageGallery";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

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

const SPEC_LABELS_AND_ICONS: Record<string, { label: string; icon: string }> = {
    engine_cc: { label: "Двигатель", icon: "::FaGears::" },
    horsepower: { label: "Мощность", icon: "::FaHorseHead::" },
    weight_kg: { label: "Вес", icon: "::FaWeightHanging::" },
    top_speed_kmh: { label: "Макс. скорость", icon: "::FaGaugeHigh::" },
    type: { label: "Класс", icon: "::FaShieldHalved::" },
    seat_height_mm: { label: "Высота по седлу", icon: "::FaRulerVertical::" },
};

const SpecItem = ({ specKey, value }: { specKey: string; value: string | number }) => {
    const specInfo = SPEC_LABELS_AND_ICONS[specKey] || { label: specKey, icon: '::FaCircleInfo::' };
    return (
        <div className="bg-muted/10 p-3 rounded-lg border border-border text-center">
          <VibeContentRenderer content={specInfo.icon} className="h-6 w-6 mx-auto text-brand-cyan mb-1" />
          <p className="text-xs text-muted-foreground font-mono">{specInfo.label}</p>
          <p className="text-sm font-semibold font-orbitron">{value}</p>
        </div>
    );
};

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { dbUser } = useAppContext();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<DateRange | undefined>();
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!params.id) {
        setError("ID транспорта не указан.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // This function now correctly returns an error instead of throwing one.
        const { success, data, error: fetchError } = await fetchCarById(params.id);
        if (success && data) {
          setVehicle(data as Vehicle);
        } else {
          // The page will now set an error state instead of redirecting immediately.
          setError(fetchError || "Не удалось загрузить данные о транспорте.");
          toast.error(fetchError || "Не удалось загрузить данные о транспорте.");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Критическая ошибка";
        setError(`Критическая ошибка при загрузке: ${errorMessage}`);
        toast.error(`Критическая ошибка при загрузке: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [params.id]);

  useEffect(() => {
    const fetchCalendar = async () => {
        if (!params.id) return;
        setIsCalendarLoading(true);
        const result = await getVehicleCalendar(params.id);
        if (result.success && result.data) {
            const bookedDates: Date[] = [];
            result.data.forEach(booking => {
                let currentDate = new Date(booking.start_date!);
                const endDate = new Date(booking.end_date!);
                while (currentDate <= endDate) {
                    bookedDates.push(new Date(currentDate));
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            });
            setDisabledDates(bookedDates);
        }
        setIsCalendarLoading(false);
    };
    fetchCalendar();
  }, [params.id]);

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

  const totalDays = date?.from && date?.to ? Math.round((date.to.getTime() - date.from.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0;
  const totalPrice = totalDays * (vehicle?.daily_price || 0);
  const finalPrice = hasSubscription ? Math.round(totalPrice * 0.9) : totalPrice;

  const handleRent = async () => {
    if (!vehicle || !dbUser?.user_id || !date?.from || !date.to) {
      toast.error("Выберите даты для аренды.");
      return;
    }
    setInvoiceLoading(true);
    try {
      const result = await createBooking(dbUser.user_id, vehicle.id, date.from, date.to, finalPrice);
      if (result.success) {
          toast.success("Запрос на бронирование отправлен! Ожидайте счет на оплату залога в Telegram.");
          setDate(undefined);
          // Re-fetch calendar after successful booking
          const newCalendar = await getVehicleCalendar(params.id);
          if (newCalendar.success && newCalendar.data) {
            const bookedDates: Date[] = [];
            newCalendar.data.forEach(booking => {
                let currentDate = new Date(booking.start_date!);
                const endDate = new Date(booking.end_date!);
                while (currentDate <= endDate) {
                    bookedDates.push(new Date(currentDate));
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            });
            setDisabledDates(bookedDates);
          }
      } else {
          throw new Error(result.error || "Ошибка при создании бронирования.");
      }
    } catch (err) {
      toast.error(`Не удалось создать счет: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`);
    } finally {
      setInvoiceLoading(false);
    }
  };
  
  const galleryImages = useMemo(() => {
    if (!vehicle) return [];
    return [vehicle.image_url, ...(vehicle.specs?.gallery || [])].filter(Boolean);
  }, [vehicle]);

  if (loading) {
    return <Loading variant={'bike'} text="ЗАГРУЗКА ДАННЫХ..." />;
  }

  // This block now correctly handles the error state without redirecting.
  if (error || !vehicle) {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
            <VibeContentRenderer content="::FaCircleXmark::" className="text-5xl text-destructive mb-4"/>
            <p className="text-destructive font-mono text-lg">{error || "Транспорт не найден."}</p>
            <Button onClick={() => router.push('/rent-bike')} className="mt-6">Назад в гараж</Button>
        </div>
    );
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
                           {vehicle.specs && Object.entries(vehicle.specs).filter(([key]) => key !== 'gallery').map(([key, value]) => (
                                <SpecItem key={key} specKey={key} value={String(value)} />
                            ))}
                        </div>
                    </div>

                    <div className="bg-dark-card/70 backdrop-blur-md p-6 rounded-lg border border-border">
                        <div>
                            <Label className="text-sm font-mono text-muted-foreground">СРОК АРЕНДЫ</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 input-cyber", !date && "text-muted-foreground")}>
                                    <VibeContentRenderer content="::FaCalendarDays::" className="mr-2 h-4 w-4" />
                                    {date?.from ? (date.to ? `${format(date.from, "d LLL, y")} - ${format(date.to, "d LLL, y")}`: format(date.from, "d LLL, y")) : <span>Выберите даты</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                {isCalendarLoading ? <div className="p-4"><Loading text="Загрузка..."/></div> :
                                    <Calendar mode="range" selected={date} onSelect={setDate} initialFocus disabled={[{ before: new Date() }, ...disabledDates]} />
                                }
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center mt-4">
                            <p className="text-sm font-mono text-muted-foreground">ИТОГО К ОПЛАТЕ</p>
                            <p className="text-2xl font-orbitron text-brand-yellow font-bold">{finalPrice} ₽</p>
                            {totalDays > 0 && <p className="text-xs text-muted-foreground">({totalDays} {totalDays === 1 ? 'день' : (totalDays > 1 && totalDays < 5) ? 'дня' : 'дней'})</p>}
                        </div>
                        {hasSubscription && <p className="text-xs text-brand-green text-center mt-2">(Ваша скидка 10% применена)</p>}
                         <button
                            onClick={handleRent}
                            disabled={invoiceLoading || !date?.from || !date?.to}
                            className="w-full mt-4 p-4 rounded-xl font-orbitron text-lg font-bold text-black bg-gradient-to-r from-brand-cyan to-brand-green hover:brightness-125 transition-all duration-300 disabled:animate-pulse disabled:cursor-not-allowed disabled:brightness-75 shadow-lg hover:shadow-brand-cyan/50"
                        >
                            {invoiceLoading ? 'СОЗДАНИЕ СЧЕТА...' : 'ЗАБРОНИРОВАТЬ'}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    </div>
    </>
  );
}