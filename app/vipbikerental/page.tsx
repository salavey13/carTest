"use client";

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useEffect, useMemo } from 'react';
import { getVehiclesWithStatus } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { cn } from '@/lib/utils';

type VehicleWithStatus = Awaited<ReturnType<typeof getVehiclesWithStatus>>['data'] extends (infer U)[] ? U : never;

const InfoItem = ({ icon, children }: { icon: string, children: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <VibeContentRenderer content={icon} className="text-xl text-brand-green mt-1 flex-shrink-0" />
        <p className="text-muted-foreground">{children}</p>
    </div>
);

const StepItem = ({ num, title, icon, children }: { num: string, title: string, icon: string, children: React.ReactNode }) => (
    <div className="bg-card/50 p-6 rounded-lg border border-border text-center relative h-full">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-pink text-black rounded-full w-8 h-8 flex items-center justify-center font-orbitron font-bold">{num}</div>
        <VibeContentRenderer content={icon} className="text-4xl text-brand-pink mx-auto my-4" />
        <h4 className="font-orbitron text-lg mb-2">{title}</h4>
        <p className="text-sm text-muted-foreground">{children}</p>
    </div>
);

// New component for featured bikes based on scraped data
const FeaturedBikeCard = ({ name, description, imageUrl }: { name: string, description: string, imageUrl: string }) => (
    <Card className="bg-card/80 backdrop-blur-sm overflow-hidden group">
        <CardHeader className="p-0">
            <div className="relative h-56 w-full">
                <Image src={imageUrl} alt={name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" />
            </div>
        </CardHeader>
        <CardContent className="p-4">
            <h3 className="text-lg font-bold font-orbitron">{name}</h3>
            <p className="text-sm text-muted-foreground font-mono my-3">{description}</p>
            <Link href="#fleet" className="w-full"><Button className="w-full font-semibold">Смотреть весь парк</Button></Link>
        </CardContent>
    </Card>
);


export default function HomePage() {
  const [vehicles, setVehicles] = useState<VehicleWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
        try {
            const response = await getVehiclesWithStatus();
            if (response.success && response.data) {
                const bikes = response.data.filter(v => v.type === 'bike');
                setVehicles(bikes);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, []);

  const bikeTypes = useMemo(() => {
      const types = new Set(vehicles.map(v => (v.specs as any)?.type).filter(Boolean));
      return ['Все', ...Array.from(types)];
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
      if (!activeFilter || activeFilter === 'Все') {
          return vehicles;
      }
      return vehicles.filter(v => (v.specs as any)?.type === activeFilter);
  }, [vehicles, activeFilter]);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden text-foreground">
        {/* Hero Section */}
        <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center text-center text-white p-4">
            <div className="absolute inset-0 z-0">
                <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/c968f2ac-0e6d-4c9f-b3f5-668b5a0349f7-72ba0076-a077-4c3d-9d41-3b7640c4f8d4.jpg" alt="Motorcycles lineup" layout="fill" objectFit="cover" className="brightness-50" priority />
            </div>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10"
            >
                <h1 className="text-4xl md:text-6xl font-orbitron font-bold text-shadow-neon">АРЕНДА МОТОЦИКЛОВ VIPBIKE</h1>
                <p className="max-w-2xl mx-auto mt-4 text-lg text-gray-300">Твой байк на любой вкус: от круизеров до спортбайков. Выбери свой вайб и покори город. Лидеры проката в Нижнем Новгороде! [1]</p>
                <div className="mt-8">
                    <Link href="#fleet">
                        <Button size="lg" className="font-orbitron text-lg bg-brand-lime hover:bg-brand-lime/90 text-black shadow-lg shadow-brand-lime/30 hover:shadow-brand-lime/50 transition-all duration-300 transform hover:scale-105">
                            <VibeContentRenderer content="::FaMotorcycle:: ВЫБРАТЬ БАЙК" />
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </section>

        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-24 space-y-20 sm:space-y-28">
            
            {/* Featured Bikes Section - NEW */}
            <section id="featured">
                <h2 className="text-4xl font-orbitron text-center mb-10">Жемчужины Нашего Парка</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FeaturedBikeCard 
                        name="VOGE AC525X" 
                        description="Абсолютно новый, потрясающе удобный и маневренный мотоцикл. Доступен уже сегодня! [1]"
                        imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/voge-525-acx-2023-a.jpg"
                    />
                    <FeaturedBikeCard 
                        name="Harley-Davidson Custom" 
                        description="Такого в Нижнем Новгороде еще не было! Байк в максимальном тюнинге для истинных ценителей. Только для опытных райдеров. [1]"
                        imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/harley-davidson-fat-boy.jpg"
                    />
                    <FeaturedBikeCard 
                        name="Ducati X-Diavel" 
                        description="Крутейший пауэр-круизер, который дарит невероятные эмоции. Один из флагманов нашего парка. [1]"
                        imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/diavel_v4_p_01_hero.jpg"
                    />
                </div>
            </section>

            {/* Fleet Section */}
            <section id="fleet">
                <h2 className="text-4xl font-orbitron text-center mb-10">Полный Каталог</h2>
                <div className="flex justify-center flex-wrap gap-2 mb-8">
                    {bikeTypes.map(type => (
                        <Button key={type} variant={activeFilter === type || (activeFilter === null && type === 'Все') ? 'default' : 'outline'} onClick={() => setActiveFilter(type)} className="font-mono">
                            {type}
                        </Button>
                    ))}
                </div>
                {loading ? <Loading variant="bike" /> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredVehicles.map(bike => (
                             <Card key={bike.id} className="bg-card/80 backdrop-blur-sm overflow-hidden group">
                                <CardHeader className="p-0">
                                    <div className="relative h-56 w-full">
                                        <Image src={bike.image_url || ''} alt={`${bike.make} ${bike.model}`} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" />
                                        <div className="absolute top-2 right-2 bg-black/70 text-brand-yellow font-bold font-orbitron px-3 py-1 rounded-full text-sm">{bike.daily_price} ₽/сутки</div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <h3 className="text-lg font-bold font-orbitron">{bike.make} {bike.model}</h3>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono my-3 text-muted-foreground">
                                        <div><VibeContentRenderer content="::FaGaugeHigh::" className="mx-auto mb-1 text-brand-cyan"/> {bike.specs?.top_speed_kmh || 'N/A'} км/ч</div>
                                        <div><VibeContentRenderer content="::FaGears::" className="mx-auto mb-1 text-brand-cyan"/> {bike.specs?.engine_cc || 'N/A'} см³</div>
                                        <div><VibeContentRenderer content="::FaHorseHead::" className="mx-auto mb-1 text-brand-cyan"/> {bike.specs?.horsepower || 'N/A'} л.с.</div>
                                    </div>
                                    <Link href={`/rent/${bike.id}`} className="w-full"><Button className="w-full font-semibold">Подробнее</Button></Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {/* Conditions Section */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-start">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaClipboardList::" className="text-brand-pink"/> Требования</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <InfoItem icon="::FaUserClock::">Возраст от 23 лет</InfoItem>
                        <InfoItem icon="::FaIdCard::">Паспорт и В/У категории "А" (есть скутеры без категории)</InfoItem>
                        <InfoItem icon="::FaAward::">Залог от 20 000 ₽</InfoItem>

                        <InfoItem icon="::FaCreditCard::">Оплата любым удобным способом</InfoItem>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaGift::" className="text-brand-green"/> Что вы получаете</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <InfoItem icon="::FaCircleCheck::">Полностью обслуженный и чистый мотоцикл</InfoItem>
                        <InfoItem icon="::FaFileSignature::">Открытый полис ОСАГО</InfoItem>
                        <InfoItem icon="::FaUsershield::">Полный комплект защитной экипировки. [1]</InfoItem>
                        <InfoItem icon="::FaPersonFalling::">Краткий инструктаж по управлению</InfoItem>
                        <InfoItem icon="::FaTag::">Скидка 10% на первую аренду по промокоду "ЛЕТО2025". [1]</InfoItem>
                    </CardContent>
                </Card>
            </section>

             {/* How it works Section */}
            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10">Как это работает</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StepItem num="1" title="Бронь" icon="::FaCalendarCheck::">Выберите модель и оформите бронь онлайн. Для аренды обязательна защитная экипировка.</StepItem>
                    <StepItem num="2" title="Подтверждение" icon="::FaPaperPlane::">Свяжитесь с нами для подтверждения. Возьмите с собой оригиналы документов и залог.</StepItem>
                    <StepItem num="3" title="Получение" icon="::FaKey::">Приезжайте к нам по адресу Стригинский переулок 13Б, подписываем договор и забираете байк. [1]</StepItem>
                    <StepItem num="4" title="Отдых" icon="::FaGamepad::">После поездки можно отдохнуть в нашей лаунж-зоне с кальяном и приставкой. [1]</StepItem>
                </div>
            </section>
            
            {/* FAQ Section */}
            <section className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-orbitron text-center mb-10">Частые вопросы</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Можно ли арендовать мотоцикл без опыта?</AccordionTrigger>
                        <AccordionContent>Мы требуем наличие прав категории "А". Для новичков у нас есть малокубатурные модели и мы проводим обязательный инструктаж. Ваша безопасность - наш приоритет. Также есть скутеры, не требующие категории "А". [1]</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>Что будет, если я попаду в ДТП?</AccordionTrigger>
                        <AccordionContent>Все мотоциклы застрахованы по ОСАГО. Ваша финансовая ответственность ограничена суммой залога, если нет серьезных нарушений с вашей стороны. Главное - немедленно связаться с нами.</AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="item-3">
                        <AccordionTrigger>Что входит в стоимость аренды?</AccordionTrigger>
                        <AccordionContent>В стоимость входит аренда самого мотоцикла на 24 часа, полис ОСАГО и полный комплект защитной экипировки. [1] Пробег обычно ограничен (например, 300 км/сутки), превышение оплачивается отдельно.</AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="item-4">
                        <AccordionTrigger>У вас есть свой сервис?</AccordionTrigger>
                        <AccordionContent>Да, теперь у нас новая локация со своим сервисом. Вы можете пригнать своего верного друга к нам на обслуживание или ремонт. [1]</AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>
        </div>
    </div>
  );
}