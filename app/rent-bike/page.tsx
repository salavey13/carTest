"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from 'next/link';
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { getVehiclesWithStatus, getVehicleCalendar, createBooking } from "@/app/rentals/actions";
import { Loading } from "@/components/Loading";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ru } from 'date-fns/locale';
import type { Database } from "@/types/database.types";

type VehicleWithStatus = Awaited<ReturnType<typeof getVehiclesWithStatus>>['data'] extends (infer U)[] ? U : never;
type VehicleWithBookingInfo = VehicleWithStatus & {
    active_booking_start?: string | null;
    active_booking_end?: string | null;
};


const SURVEY_TO_BIKE_TYPE_MAP: Record<string, string> = {
  "Агрессивный нейкед (стритфайтер)": "Naked", "Суперспорт (обтекатели, поза эмбриона)": "Supersport",
  "Спорт-турист (мощность и комфорт)": "Sport-tourer", "Нео-ретро (стиль и харизма)": "Neo-retro"
};

const SPEC_LABELS_AND_ICONS: Record<string, { label: string; icon: string }> = {
    engine_cc: { label: "Двигатель", icon: "::FaGears::" },
    horsepower: { label: "Мощность", icon: "::FaHorseHead::" },
    weight_kg: { label: "Вес", icon: "::FaWeightHanging::" },
    top_speed_kmh: { label: "Макс. скорость", icon: "::FaGaugeHigh::" },
    type: { label: "Класс", icon: "::FaShieldHalved::" },
    seat_height_mm: { label: "Высота по седлу", icon: "::FaRulerVertical::" },
};

const SpecItem = ({ specKey, value }: { specKey: string; value: string | number }) => {
    const specInfo = SPEC_LABELS_AND_ICONS[specKey] || { label: specKey, icon: '::FaCirclequestion::' };
    return (
        <div className="bg-muted/10 p-3 rounded-lg border border-border">
            <VibeContentRenderer content={specInfo.icon} className="h-6 w-6 mx-auto text-brand-cyan mb-1" />
            <p className="text-xs text-muted-foreground font-mono uppercase">{specInfo.label}</p>
            <p className="text-sm font-semibold font-orbitron">{value}</p>
        </div>
    );
};

export default function RentBikePage() {
  const { dbUser } = useAppContext();
  const [vehicles, setVehicles] = useState<VehicleWithBookingInfo[]>([]);
  const [selectedBike, setSelectedBike] = useState<VehicleWithBookingInfo | null>(null);
  const [date, setDate] = useState<DateRange | undefined>();
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [availableBikeTypes, setAvailableBikeTypes] = useState(["All"]);
  const [isBooking, setIsBooking] = useState(false);

  const recommendedType = useMemo(() => {
    const surveyResults = dbUser?.metadata?.survey_results as Record<string, string> | undefined;
    const surveyStyle = surveyResults?.bike_style;
    return surveyStyle ? SURVEY_TO_BIKE_TYPE_MAP[surveyStyle] || null : null;
  }, [dbUser]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await getVehiclesWithStatus();
        if (response.success && response.data) {
          const bikes = response.data.filter(v => v.type === 'bike') as VehicleWithBookingInfo[];
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
        toast.error("Критическая ошибка загрузки гаража!");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [recommendedType]);
  
  useEffect(() => {
    const fetchCalendar = async () => {
        if (!selectedBike) return;
        setIsCalendarLoading(true);
        const result = await getVehicleCalendar(selectedBike.id);
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
  }, [selectedBike]);

  const filteredBikes = useMemo(() => {
    let bikesToShow = vehicles;
    if (activeFilter !== "All") {
      bikesToShow = vehicles.filter(bike => (bike.specs as any)?.type === activeFilter);
    }
    if (recommendedType) {
      bikesToShow.sort((a,b) => {
        const aIsRec = (a.specs as any)?.type === recommendedType;
        const bIsRec = (b.specs as any)?.type === recommendedType;
        if(a.availability !== b.availability) return a.availability === 'available' ? -1 : 1;
        if (aIsRec && !bIsRec) return -1;
        if (!aIsRec && bIsRec) return 1;
        return 0;
      });
    }
    return bikesToShow;
  }, [activeFilter, vehicles, recommendedType]);

  const handleBooking = async () => {
      if (!selectedBike || !date?.from || !date?.to || !dbUser?.user_id) {
          toast.error("Выберите байк и даты для бронирования.");
          return;
      }
      setIsBooking(true);
      const totalDays = Math.round((date.to.getTime() - date.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const totalPrice = totalDays * (selectedBike?.daily_price || 0);

      const result = await createBooking(dbUser.user_id, selectedBike.id, date.from, date.to, totalPrice);
      if (result.success) {
          toast.success("Запрос на бронирование отправлен! Ожидайте счет на оплату залога в Telegram.");
          setDate(undefined);
          const calendarResult = await getVehicleCalendar(selectedBike.id);
          if (calendarResult.success && calendarResult.data) {
             const bookedDates: Date[] = [];
             calendarResult.data.forEach(booking => {
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
          toast.error(`Ошибка бронирования: ${result.error}`);
      }
      setIsBooking(false);
  };

  if (loading) return <Loading variant="bike" />;

  const totalDays = date?.from && date?.to ? Math.round((date.to.getTime() - date.from.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0;
  const totalPrice = totalDays * (selectedBike?.daily_price || 0);

  const bookingButtonText = selectedBike ? (
    isBooking ? 'БРОНИРОВАНИЕ...' :
    selectedBike.availability === 'taken' && selectedBike.active_booking_end ? `ЗАНЯТ ДО ${format(new Date(selectedBike.active_booking_end), 'd LLL', { locale: ru })}` :
    selectedBike.availability !== 'available' ? 'НЕДОСТУПЕН' :
    'ЗАБРОНИРОВАТЬ'
  ) : 'ЗАБРОНИРОВАТЬ';

  return (
    <div className="min-h-screen text-white p-4 pt-24 overflow-hidden relative">

      <div className="fixed inset-0 z-[-1] opacity-30">
        <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg" alt="Moto Garage" fill className="object-cover animate-pan-zoom" />
        <div className="absolute inset-0 bg-black/60"></div>
      </div>
      <motion.header initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-brand-yellow" data-text="MOTO-GARAGE">MOTO-GARAGE</h1>
        <p className="text-muted-foreground font-mono mt-2">{recommendedType ? `Рекомендуем для тебя: ${recommendedType}` : "Выбери своего зверя"}</p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1 space-y-6">
          <div className="flex flex-wrap gap-2 p-2 bg-dark-card/50 border border-border rounded-lg backdrop-blur-sm">
            {availableBikeTypes.map(type => (
              <button key={type} onClick={() => setActiveFilter(type)}
                className={cn( "px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 font-mono relative",
                  activeFilter === type ? "bg-brand-cyan text-black shadow-[0_0_10px_theme(colors.brand.cyan)]" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}>
                {type}
                {type === recommendedType && <VibeContentRenderer content="::FaStar::" className="absolute -top-1 -right-1 text-yellow-400 w-3 h-3"/>}
              </button>
            ))}
          </div>
          <div className="space-y-3 h-[60vh] overflow-y-auto simple-scrollbar pr-2">
            <AnimatePresence>
              {filteredBikes.map(bike => (
                <motion.div key={bike.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onClick={() => setSelectedBike(bike)}
                  className={cn("p-3 rounded-lg border-2 cursor-pointer transition-all bg-dark-card/70 hover:bg-dark-card backdrop-blur-sm relative",
                    selectedBike?.id === bike.id ? "border-brand-cyan shadow-lg shadow-brand-cyan/20" : "border-border hover:border-brand-cyan/50",
                    bike.availability !== 'available' && 'opacity-50'
                  )}>
                    <div className="flex items-center gap-4">
                        <Image src={bike.image_url!} alt={bike.model!} width={80} height={80} className="rounded-md object-cover aspect-square" />
                        <div>
                            <h3 className="font-bold font-orbitron">{bike.make} {bike.model}</h3>
                            <p className="text-sm text-brand-pink font-mono">{bike.daily_price}₽ / день</p>
                            {bike.availability === 'taken' && bike.active_booking_start && bike.active_booking_end && (
                                <p className="text-xs font-mono text-orange-400">
                                    Занят: {format(new Date(bike.active_booking_start), 'dd.MM')} - {format(new Date(bike.active_booking_end), 'dd.MM')}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground font-mono mt-1">{bike.crew_name || `Владелец: ${bike.owner_id?.substring(0,6)}...`}</p>
                        </div>
                    </div>
                    {bike.crew_logo_url && <Image src={bike.crew_logo_url} alt={bike.crew_name || 'Crew Logo'} width={24} height={24} className="absolute top-2 right-2 rounded-full border border-brand-lime shadow-lime-glow"/>}
                    <div className={cn("absolute bottom-2 right-2 text-xs font-mono flex items-center gap-1 p-1 rounded",
                        bike.availability === 'available' ? 'bg-green-500/20 text-green-400' : 
                        bike.availability === 'taken' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-500/20 text-gray-400')}>
                        {bike.availability === 'available' ? <VibeContentRenderer content="::FaCircleCheck::"/> : bike.availability === 'taken' ? <VibeContentRenderer content="::FaClock::"/> : <VibeContentRenderer content="::FaBan::"/>}

                        <span>{bike.availability === 'available' ? 'Свободен' : bike.availability === 'taken' ? 'Занят' : 'Недоступен'}</span>
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
              <motion.div key={selectedBike.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="sticky top-24">
                <div className="bg-dark-card/80 border border-border rounded-xl shadow-2xl backdrop-blur-sm p-6">
                  <motion.div layoutId={`bike-image-${selectedBike.id}`} className="relative h-64 md:h-80 w-full mb-6 rounded-lg overflow-hidden">
                    <Image src={selectedBike.image_url!} alt={selectedBike.model!} fill className="object-cover" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                    <h2 className="absolute bottom-4 left-4 text-4xl font-orbitron font-bold drop-shadow-lg">{selectedBike.make} <span className="text-brand-cyan">{selectedBike.model}</span></h2>
                     {selectedBike.crew_logo_url && <Image src={selectedBike.crew_logo_url} alt={selectedBike.crew_name || 'Crew Logo'} width={48} height={48} className="absolute top-4 right-4 rounded-full border-2 border-brand-lime shadow-lime-glow"/>}
                  </motion.div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-center">
                    {selectedBike.specs && Object.entries(selectedBike.specs).filter(([key]) => key !== 'gallery').map(([key, value]) => (
                        <SpecItem key={key} specKey={key} value={String(value)} />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                      <Label className="text-sm font-mono text-muted-foreground">ДАТЫ БРОНИРОВАНИЯ</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 input-cyber", !date && "text-muted-foreground")}>
                            <VibeContentRenderer content="::FaCalendarDays::" className="mr-2 h-4 w-4" />
                            {date?.from ? (date.to ? `${format(date.from, "d LLL, y", { locale: ru })} - ${format(date.to, "d LLL, y", { locale: ru })}`: format(date.from, "d LLL, y", { locale: ru })) : <span>Выберите даты</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          {isCalendarLoading ? <div className="p-4"><Loading text="Загрузка..."/></div> :
                            <Calendar mode="range" selected={date} onSelect={setDate} initialFocus disabled={[{ before: new Date() }, ...disabledDates]} locale={ru} />
                          }
                        </PopoverContent>
                      </Popover>
                    </div>
                     <Link href={`/rent/${selectedBike.id}`} className="w-full"><Button variant="outline" className="w-full h-10">Подробнее</Button></Link>
                  </div>
                   <div className="bg-input/50 border border-dashed border-border rounded-lg p-3 text-center mt-4">
                      <p className="text-sm font-mono text-muted-foreground">ИТОГО К ОПЛАТЕ</p>
                      <p className="text-2xl font-orbitron text-brand-yellow font-bold">{totalPrice} ₽</p>

                      {totalDays > 0 && <p className="text-xs text-muted-foreground">({totalDays} {totalDays === 1 ? 'день' : (totalDays > 1 && totalDays < 5) ? 'дня' : 'дней'})</p>}
                    </div>
                  <Button onClick={handleBooking} disabled={isBooking || selectedBike.availability !== 'available' || !date?.from || !date?.to} className="w-full mt-4 p-4 rounded-xl font-orbitron text-lg font-bold">
                    {bookingButtonText}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}