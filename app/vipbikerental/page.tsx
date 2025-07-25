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

const FeaturedBikeCard = ({ name, description, imageUrl }: { name: string, description: string, imageUrl: string }) => (
    <Card className="bg-card/80 backdrop-blur-sm overflow-hidden group">
        <CardHeader className="p-0">
            <div className="relative h-56 w-full">
                <Image src={imageUrl} alt={name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" />
            </div>
        </CardHeader>
        <CardContent className="p-4">
            <h3 className="text-lg font-bold font-orbitron">{name}</h3>
            <p className="text-sm text-muted-foreground font-mono my-3 min-h-[4.5rem]">{description}</p>
            <Link href="/rent-bike" className="w-full"><Button className="w-full font-semibold">Смотреть весь парк</Button></Link>
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
                <p className="max-w-2xl mx-auto mt-4 text-lg text-gray-300">Твой байк на любой вкус: от круизеров до спортбайков. Выбери свой вайб и покори город. Лидеры проката в Нижнем Новгороде!</p>
                <div className="mt-8">
                    <Link href="/rent-bike">
                        <Button size="lg" className="font-orbitron text-lg bg-brand-lime hover:bg-brand-lime/90 text-black shadow-lg shadow-brand-lime/30 hover:shadow-brand-lime/50 transition-all duration-300 transform hover:scale-105">
                            <VibeContentRenderer content="::FaMotorcycle:: ВЫБРАТЬ БАЙК" />
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </section>

        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-24 space-y-20 sm:space-y-28">
            
            <section id="featured">
                <h2 className="text-4xl font-orbitron text-center mb-10">Жемчужины Нашего Парка</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FeaturedBikeCard 
                        name="VOGE 525 ACX" 
                        description="Абсолютно новый, потрясающе удобный и маневренный мотоцикл. Доступен уже сегодня!"
                        imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/voge-525-acx-2023-a.jpg"
                    />
                    <FeaturedBikeCard 
                        name="Harley-Davidson Fat Boy" 
                        description="Байк в максимальном тюнинге для истинных ценителей. Такого в Нижнем Новгороде еще не было!"
                        imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/harley-davidson-fat-boy.jpg"
                    />
                    <FeaturedBikeCard 
                        name="Ducati X-Diavel" 
                        description="Крутейший пауэр-круизер, который дарит невероятные эмоции. Один из флагманов нашего парка."
                        imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/diavel_v4_p_01_hero.jpg"
                    />
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-8 items-start">
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaClipboardList::" className="text-brand-pink"/> Требования</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <InfoItem icon="::FaUserClock::">Возраст от 23 лет</InfoItem>
                        <InfoItem icon="::FaIdCard::">Паспорт и В/У категории "А" (есть скутеры без "А")</InfoItem>
                        <InfoItem icon="::FaAward::">Залог от 20 000 ₽</InfoItem>
                        <InfoItem icon="::FaCreditCard::">Оплата любым удобным способом</InfoItem>
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaGift::" className="text-brand-green"/> Что вы получаете</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <InfoItem icon="::FaCircleCheck::">Полностью обслуженный и чистый мотоцикл</InfoItem>
                        <InfoItem icon="::FaFileSignature::">Открытый полис ОСАГО</InfoItem>
                        <InfoItem icon="::FaUsershield::">Полный комплект защитной экипировки</InfoItem>
                        <InfoItem icon="::FaTag::">Скидка 10% на первую аренду по промокоду "ЛЕТО2025"</InfoItem>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-1 border-brand-cyan shadow-cyan-glow">
                    <CardHeader><CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaWrench::" className="text-brand-cyan"/> Наши Услуги</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <InfoItem icon="::FaTools::">Обслуживание и ремонт вашего мотоцикла</InfoItem>
                        <InfoItem icon="::FaGamepad::">Лаунж-зона с кальяном и игровыми приставками</InfoItem>
                        <InfoItem icon="::FaMapLocationDot::">Новая удобная локация: Стригинский переулок 13Б</InfoItem>
                        <InfoItem icon="::FaCoffee::">Место, где можно встретить единомышленников</InfoItem>
                    </CardContent>
                </Card>
            </section>

            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10">Как это работает</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StepItem num="1" title="Бронь" icon="::FaCalendarCheck::">Выберите модель в нашем <Link href="/rent-bike" className="text-brand-cyan hover:underline">каталоге</Link> и оформите бронь онлайн.</StepItem>
                    <StepItem num="2" title="Подтверждение" icon="::FaPaperPlane::">Свяжитесь с нами для подтверждения. Возьмите с собой оригиналы документов и залог.</StepItem>
                    <StepItem num="3" title="Получение" icon="::FaKey::">Приезжайте в наш новый дом на Стригинском переулке 13Б, подписываем договор и забираете байк.</StepItem>
                    <StepItem num="4" title="Возврат и Отдых" icon="::FaFlagCheckered::">Верните мотоцикл в срок. После поездки можно отдохнуть в нашей лаунж-зоне.</StepItem>
                </div>
            </section>
            
            <section className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-orbitron text-center mb-10">Частые вопросы</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Можно ли арендовать мотоцикл без категории "А"?</AccordionTrigger>
                        <AccordionContent>Да! У нас есть парк скутеров, для управления которыми достаточно категории "B" или "M". Для всех остальных мотоциклов категория "А" обязательна.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>Что будет, если я попаду в ДТП?</AccordionTrigger>
                        <AccordionContent>Все мотоциклы застрахованы по ОСАГО. Ваша финансовая ответственность ограничена суммой залога, если нет серьезных нарушений с вашей стороны. Главное - немедленно связаться с нами.</AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="item-3">
                        <AccordionTrigger>Что входит в стоимость аренды?</AccordionTrigger>
                        <AccordionContent>В стоимость входит аренда самого мотоцикла на 24 часа, полис ОСАГО и полный комплект защитной экипировки. Пробег обычно ограничен (например, 300 км/сутки), превышение оплачивается отдельно.</AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="item-4">
                        <AccordionTrigger>У вас есть свой сервис?</AccordionTrigger>
                        <AccordionContent>Да, на нашей новой локации работает полноценный сервис. Вы можете пригнать своего верного друга к нам на обслуживание или ремонт.</AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>
        </div>
    </div>
  );
}