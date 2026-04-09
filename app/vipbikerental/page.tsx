"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useMemo } from "react";

import { BikeShowcase } from "@/components/BikeShowcase";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";

/* =========================================================
   SHARED COMPONENTS (ORIGINAL + CLEAN)
========================================================= */

type ServiceItem = { icon: string; text: string };

const InfoItem = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <VibeContentRenderer content={icon} className="mt-1 text-xl text-accent-text" />
    <p className="text-white/90">{children}</p>
  </div>
);

const StepItem = ({
  num,
  title,
  icon,
  children,
}: {
  num: string;
  title: string;
  icon: string;
  children: React.ReactNode;
}) => (
  <div className="relative rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/20">
    <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-orbitron">
      {num}
    </div>
    <VibeContentRenderer content={icon} className="text-4xl text-primary my-4" />
    <h4 className="font-orbitron mb-2">{title}</h4>
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
);

const ServiceCard = ({
  title,
  icon,
  items,
  imageUrl,
}: {
  title: string;
  icon: string;
  items: ServiceItem[];
  imageUrl?: string;
}) => (
  <Card className="group relative overflow-hidden border border-border/70 bg-neutral-950/80">
    {imageUrl && (
      <Image src={imageUrl} alt={title} fill className="object-cover opacity-60 group-hover:opacity-75 transition" />
    )}
    <div className="absolute inset-0 bg-black/60" />
    <div className="relative p-6">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="flex items-center gap-2 text-white text-xl">
          <VibeContentRenderer content={icon} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        {items.map((i, idx) => (
          <InfoItem key={idx} icon={i.icon}>
            {i.text}
          </InfoItem>
        ))}
      </CardContent>
    </div>
  </Card>
);

/* =========================================================
   DATA
========================================================= */

const quickActions = [
  {
    title: "Купить электромотоцикл",
    icon: "::FaCartShopping::",
    text: "Конфигуратор с выбором всего.",
    href: "/franchize/vip-bike/configurator",
    cta: "Купить",
  },
  {
    title: "Каталог",
    icon: "::FaMotorcycle::",
    text: "Подбор под стиль.",
    href: "/franchize/vip-bike",
    cta: "Открыть",
  },
];

const heroMetrics = [
  "::FaStopwatch:: Быстрая бронь",
  "::FaShieldHeart:: ОСАГО",
  "::FaMapLocationDot:: Центр",
  "::FaHeadset:: Поддержка",
];

/* =========================================================
   INVEST BLOCK (REBUILT CLEAN)
========================================================= */

const investmentPoints = [
  "::FaChartLine:: Доходность 20–60% годовых",
  "::FaCoins:: Вход от 500 000 ₽",
  "::FaFileSignature:: Договор",
  "::FaCalendar:: Выплаты ежемесячно",
  "::FaRightLeft:: Выход за 30 дней",
];

export default function HomePage() {
  const { dbUser } = useAppContext();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -90]);

  const vibeProfile = useMemo(() => {
    const style = dbUser?.metadata?.survey_results?.bike_style;

    if (!style) {
      return {
        badge: "::FaCompass::",
        title: "Подберем байк под тебя",
        note: "Пройди /start",
      };
    }

    return {
      badge: "::FaBolt::",
      title: `Твой вайб: ${style}`,
      note: "Фильтр уже активен",
    };
  }, [dbUser]);

  return (
    <div className="bg-background text-foreground">

      {/* HERO */}
      <section className="relative h-[80vh] flex items-center justify-center text-white">
        <div className="absolute inset-0">
          <video autoPlay muted loop className="w-full h-full object-cover brightness-50">
            <source src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/2_5219998213838247718.mp4" />
          </video>
        </div>

        <div className="relative text-center max-w-3xl">
          <VibeContentRenderer content={vibeProfile.badge} />
          <h1 className="text-6xl font-orbitron mt-4">{vibeProfile.title}</h1>
          <p className="mt-4 text-white/80">{vibeProfile.note}</p>

          <div className="mt-8 flex gap-3 justify-center">
            <Button asChild>
              <Link href="/franchize/vip-bike">Выбрать байк</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/rentals">Мои аренды</Link>
            </Button>
          </div>
        </div>
      </section>

      <motion.section style={{ y }}>
        <BikeShowcase />
      </motion.section>

      <div className="max-w-6xl mx-auto py-20 space-y-20 px-4">

        {/* QUICK */}
        <section className="grid md:grid-cols-2 gap-4">
          {quickActions.map((a) => (
            <Card key={a.title}>
              <CardHeader>
                <CardTitle>
                  <VibeContentRenderer content={a.icon} /> {a.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{a.text}</p>
                <Button asChild className="mt-4 w-full">
                  <Link href={a.href}>{a.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* SERVICES */}
        <section className="grid md:grid-cols-3 gap-6">
          <ServiceCard
            title="Требования"
            icon="::FaClipboardList::"
            items={[
              { icon: "::FaUserClock::", text: "23+" },
              { icon: "::FaIdCard::", text: "Документы" },
            ]}
          />
          <ServiceCard
            title="Что получаешь"
            icon="::FaGift::"
            items={[
              { icon: "::FaCheck::", text: "Готовый байк" },
              { icon: "::FaShield::", text: "ОСАГО" },
            ]}
          />
          <ServiceCard
            title="Сервис"
            icon="::FaWrench::"
            items={[
              { icon: "::FaTools::", text: "Ремонт" },
              { icon: "::FaUsers::", text: "Комьюнити" },
            ]}
          />
        </section>

        {/* INVEST */}
        <section className="relative rounded-3xl border border-primary/20 overflow-hidden bg-black/70">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />

          <div className="relative p-10 text-center">
            <h2 className="text-4xl font-orbitron mb-6">
              Инвестиции в мотопарк
            </h2>

            <div className="grid md:grid-cols-2 gap-4 text-left max-w-3xl mx-auto">
              {investmentPoints.map((p) => (
                <div key={p} className="flex gap-3">
                  <VibeContentRenderer content={p} />
                </div>
              ))}
            </div>

            <div className="mt-10">
              <Button asChild size="lg">
                <Link href="https://t.me/salavey13" target="_blank">
                  Обсудить в Telegram
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <Accordion type="single" collapsible>
            <AccordionItem value="1">
              <AccordionTrigger>Без категории А?</AccordionTrigger>
              <AccordionContent>Да, есть скутеры</AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

      </div>
    </div>
  );
}