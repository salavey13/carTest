// /app/vipbikerental/page.tsx
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
import bikeFooter from "@/components/bikeFooter"; // Import bikeFooter

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
                <h1 className="text-4xl md:text-6xl font-orbitron font-bold text-shadow-neon">АРЕНДА МОТОЦИКЛОВ VIBE RIDE</h1>
                <p className="max-w-2xl mx-auto mt-4 text-lg text-gray-300">Твой байк на любой вкус: от дерзких нейкедов до спортбайков. Выбери свой вайб и покори город.</p>
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

            {/* Fleet Section */}
            <section id="fleet">
                <h2 className="text-4xl font-orbitron text-center mb-10">Наш Мотопарк</h2>
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
                        <InfoItem icon="::FaIdCard::">Паспорт и В/У категории "А"</InfoItem>
                        <InfoItem icon="::FaAward::">Залог от 20 000 ₽</InfoItem>
                        <InfoItem icon="::FaCreditCard::">Оплата любым удобным способом</InfoItem>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaGift::" className="text-brand-green"/> Что вы получаете</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <InfoItem icon="::FaCheckCircle::">Полностью обслуженный и чистый мотоцикл</InfoItem>
                        <InfoItem icon="::FaFileSignature::">Открытый полис ОСАГО</InfoItem>
                        <InfoItem icon="::FaRoad::">Безлимитный пробег в пределах города</InfoItem>
                        <InfoItem icon="::FaHandsHelping::">Краткий инструктаж по управлению</InfoItem>
                    </CardContent>
                </Card>
            </section>

             {/* How it works Section */}
            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10">Как это работает</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StepItem num="1" title="Бронь" icon="::FaCalendarCheck::">Выберите модель и оформите бронь онлайн. Для аренды обязательна защитная экипировка.</StepItem>
                    <StepItem num="2" title="Подтверждение" icon="::FaPaperPlane::">Отправьте копии документов. Возьмите с собой оригиналы и залог.</StepItem>
                    <StepItem num="3" title="Получение" icon="::FaKey::">Приезжайте к нам, подписываем договор, вносите залог и забираете свой байк.</StepItem>
                    <StepItem num="4" title="Возврат" icon="::FaFlagCheckered::">Верните мотоцикл в срок, чистым и с полным баком. Залог возвращается после проверки.</StepItem>
                </div>
            </section>
            
            {/* Equipment Teaser Section */}
            <section>
                 <h2 className="text-4xl font-orbitron text-center mb-10">Экипировка в Аренду</h2>
                 <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-card/50 p-4 rounded-lg"><VibeContentRenderer content="::FaHelmetSafety::" className="text-4xl mx-auto mb-2 text-brand-purple"/> <p>Шлемы</p></div>
                    <div className="bg-card/50 p-4 rounded-lg"><VibeContentRenderer content="::FaUserShield::" className="text-4xl mx-auto mb-2 text-brand-purple"/> <p>Куртки</p></div>
                    <div className="bg-card/50 p-4 rounded-lg"><VibeContentRenderer content="::FaGloves::" className="text-4xl mx-auto mb-2 text-brand-purple"/> <p>Перчатки</p></div>
                    <div className="bg-card/50 p-4 rounded-lg"><VibeContentRenderer content="::FaVideo::" className="text-4xl mx-auto mb-2 text-brand-purple"/> <p>Камеры</p></div>
                 </div>
                 <div className="text-center mt-8">
                     <Link href="/equipment">
                        <Button size="lg" variant="outline" className="font-orbitron">
                            Смотреть всю экипировку <VibeContentRenderer content="::FaArrowRight::" className="ml-2"/>
                        </Button>
                     </Link>
                 </div>
            </section>

            {/* FAQ Section */}
            <section className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-orbitron text-center mb-10">Частые вопросы</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Можно ли арендовать мотоцикл без опыта?</AccordionTrigger>
                        <AccordionContent>Мы требуем наличие прав категории "А". Для новичков у нас есть малокубатурные модели и мы проводим обязательный инструктаж. Ваша безопасность - наш приоритет.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>Что будет, если я попаду в ДТП?</AccordionTrigger>
                        <AccordionContent>Все мотоциклы застрахованы по ОСАГО. Ваша финансовая ответственность ограничена суммой залога, если нет серьезных нарушений с вашей стороны. Главное - немедленно связаться с нами.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                        <AccordionTrigger>Можно ли выезжать за пределы города?</AccordionTrigger>
                        <AccordionContent>Да, вы можете путешествовать. Однако, для дальних поездок (свыше 300 км от города) требуется дополнительное согласование, чтобы мы были уверены в вашей подготовке и техническом состоянии байка.</AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="item-4">
                        <AccordionTrigger>Какой лимит пробега и что входит в стоимость?</AccordionTrigger>
                        <AccordionContent>В стоимость входит аренда мотоцикла на 24 часа и полис ОСАГО. Суточный лимит пробега — 200 км, превышение оплачивается отдельно. Вся защитная экипировка, включая шлемы, предоставляется в аренду за дополнительную плату.</AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>
        </div>
        <bikeFooter/>
    </div>
  );
}