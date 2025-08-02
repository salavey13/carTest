"use client";

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BikeShowcase } from '@/components/BikeShowcase';
import { cn } from "@/lib/utils"; // <-- ВОТ ОН, ИСПРАВЛЕННЫЙ ИМПОРТ

const InfoItem = ({ icon, children }: { icon: string, children: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <VibeContentRenderer content={icon} className="text-xl text-accent-text mt-1 flex-shrink-0" />
        <p className="text-foreground/90">{children}</p>
    </div>
);

const StepItem = ({ num, title, icon, children }: { num: string, title: string, icon: string, children: React.ReactNode }) => (
    <div className="bg-card/50 p-6 rounded-lg border border-border text-center relative h-full backdrop-blur-sm">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-orbitron font-bold">{num}</div>
        <VibeContentRenderer content={icon} className="text-4xl text-primary mx-auto my-4" />
        <h4 className="font-orbitron text-lg mb-2">{title}</h4>
        <p className="text-sm text-muted-foreground">{children}</p>
    </div>
);

const ServiceCard = ({ title, icon, items, imageUrl, borderColorClass }: { title: string; icon: string; items: {icon: string, text: string}[]; imageUrl?: string; borderColorClass?: string; }) => (
    <Card className={cn(`relative lg:col-span-1 overflow-hidden bg-black group border`, borderColorClass || 'border-border')}>
        {imageUrl && (
            <Image src={imageUrl} alt={title} layout="fill" objectFit="cover" className="absolute inset-0 opacity-40 group-hover:opacity-50 transition-opacity duration-300"/>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent/10"/>
        <div className="relative h-full flex flex-col p-6">
            <CardHeader className="p-0 mb-4">
                <CardTitle className={cn(`flex items-center gap-3 text-2xl`, borderColorClass?.replace('border-', 'text-'))}>
                    <VibeContentRenderer content={icon} />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4 flex-grow">
                {items.map((item, index) => (
                    <InfoItem key={index} icon={item.icon}>{item.text}</InfoItem>
                ))}
            </CardContent>
        </div>
    </Card>
);

export default function HomePage() {
  const titleText = "АРЕНДА МОТОЦИКЛОВ VIPBIKE";

  return (
    <div className="relative min-h-screen bg-background overflow-hidden text-foreground dark">
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
                {/* ==================================================================== */}
                {/* ✨ НОВЫЙ АНИМИРОВАННЫЙ ЗАГОЛОВОК ✨ */}
                {/* ==================================================================== */}
                <h1 className="text-4xl md:text-6xl text-shadow-neon title-wheelie-effect">
                  {titleText.split("").map((char, i) => (
                    <span key={i} style={{ transitionDelay: `${i * 20}ms` }}>
                      {char === " " ? "\u00A0" : char}
                    </span>
                  ))}
                </h1>
                {/* ==================================================================== */}
                <p className="max-w-2xl mx-auto mt-4 text-lg text-foreground/80">Твой байк на любой вкус: от круизеров до спортбайков. Выбери свой вайб и покори город. Лидеры проката в Нижнем Новгороде!</p>
                <div className="mt-8">
                    <Link href="/rent-bike">
                        <Button size="lg" variant="accent" className="font-orbitron text-lg shadow-lg shadow-accent/30 hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105">
                            <VibeContentRenderer content="::FaMotorcycle:: ВЫБРАТЬ БАЙК" />
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </section>

        <BikeShowcase />

        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-24 space-y-20 sm:space-y-28">
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-8 items-stretch">
                <ServiceCard 
                    title="Требования"
                    icon="::FaClipboardList::"
                    borderColorClass="border-secondary text-secondary"
                    items={[
                        { icon: "::FaUserClock::", text: "Возраст от 23 лет" },
                        { icon: "::FaIdCard::", text: "Паспорт и В/У категории 'А' (есть скутеры без 'А')" },
                        { icon: "::FaAward::", text: "Залог от 20 000 ₽" },
                        { icon: "::FaCreditCard::", text: "Оплата любым удобным способом" }
                    ]}
                />
                 <ServiceCard 
                    title="Что вы получаете"
                    icon="::FaGift::"
                    borderColorClass="border-accent text-accent"
                    imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg"
                    items={[
                        { icon: "::FaCircleCheck::", text: "Полностью обслуженный и чистый мотоцикл" },
                        { icon: "::FaFileSignature::", text: "Открытый полис ОСАГО" },
                        { icon: "::FaUserShield::", text: "Полный комплект защитной экипировки" },
                        { icon: "::FaTag::", text: "Скидка 10% на первую аренду по промокоду 'ЛЕТО2025'" }
                    ]}
                />
                <ServiceCard 
                    title="Наши Услуги"
                    icon="::FaWrench::"
                    borderColorClass="border-primary text-primary"
                    imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/servicefplaceholder.jpg"
                    items={[
                        { icon: "::FaTools::", text: "Обслуживание и ремонт вашего мотоцикла" },
                        { icon: "::FaGamepad::", text: "Лаунж-зона с кальяном и игровыми приставками" },
                        { icon: "::FaMapLocationDot::", text: "Новая удобная локация: Стригинский переулок 13Б" },
                        { icon: "::FaBeerMugEmpty::", text: "Место, где можно встретить единомышленников" }
                    ]}
                />
            </section>

            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10">Как это работает</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StepItem num="1" title="Бронь" icon="::FaCalendarCheck::">Выберите модель в нашем <Link href="/rent-bike" className="text-accent-text hover:underline">каталоге</Link> и оформите бронь онлайн.</StepItem>
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