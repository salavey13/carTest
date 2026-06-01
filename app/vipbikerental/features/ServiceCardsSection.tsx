/**
 * ServiceCardsSection.tsx
 * ========================
 * Requirements / What client gets / Services cards section.
 * Contains shared sub-components: InfoItem, StepItem, ServiceCard.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import type { ServiceItem } from "./shared/types";

export const InfoItem = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <VibeContentRenderer content={icon} className="mt-1 flex-shrink-0 text-xl text-accent-text" />
    <p className="text-white/90">{children}</p>
  </div>
);

export const StepItem = ({ num, title, icon, children }: { num: string; title: string; icon: string; children: React.ReactNode }) => (
  <div className="relative h-full w-full min-w-0 rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20">
    <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary font-orbitron font-bold text-primary-foreground">{num}</div>
    <VibeContentRenderer content={icon} className="mx-auto my-4 text-4xl text-primary" />
    <h4 className="mb-2 font-orbitron text-lg">{title}</h4>
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  </div>
);

export const ServiceCard = ({ title, icon, items, imageUrl, borderColorClass }: { title: string; icon: string; items: ServiceItem[]; imageUrl?: string; borderColorClass?: string }) => (
  <Card className={`group relative overflow-hidden border bg-neutral-950/80 shadow-xl shadow-black/20 ${borderColorClass || "border-border/70"}`}>
    {imageUrl && <Image src={imageUrl} alt={title} fill className="absolute inset-0 object-cover opacity-55 transition-opacity duration-300 group-hover:opacity-70" />}
    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/10" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,170,90,0.18),transparent_52%)]" />
    <div className="relative flex h-full flex-col p-6">
      <CardHeader className="mb-4 p-0">
        <CardTitle className={`flex items-center gap-3 text-2xl text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] ${borderColorClass?.replace("border-", "text-")}`}>
          <VibeContentRenderer content={icon} />{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4 p-0">
        {items.map((item, index) => <InfoItem key={index} icon={item.icon}>{item.text}</InfoItem>)}
      </CardContent>
    </div>
  </Card>
);

const serviceCards = [
  { title: "Требования", icon: "::FaClipboardList::", borderColorClass: "border-secondary text-accent", imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/fon-8f9c72b7-c622-4159-98da-64173322eae4.jpg", items: [{ icon: "::FaUserClock::", text: "Возраст от 23 лет" }, { icon: "::FaIdCard::", text: "Паспорт и В/У категории 'А' (есть скутеры без 'А')" }, { icon: "::FaAward::", text: "Залог от 20 000 ₽" }, { icon: "::FaCreditCard::", text: "Оплата любым удобным способом" }] },
  { title: "Что получает клиент", icon: "::FaGift::", borderColorClass: "border-accent text-accent", imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg", items: [{ icon: "::FaCircleCheck::", text: "Полностью обслуженный и чистый мотоцикл" }, { icon: "::FaFileSignature::", text: "Открытый полис ОСАГО" }, { icon: "::FaUserShield::", text: "Полный комплект защитной экипировки" }, { icon: "::FaTag::", text: "Минус 10% на первый выезд по промокоду VIPSTART — мягкий вход без снижения уровня сервиса" }] },
  { title: "Наши услуги", icon: "::FaWrench::", borderColorClass: "border-primary text-primary", imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg", items: [{ icon: "::FaTools::", text: "Обслуживание и ремонт вашего мотоцикла" }, { icon: "::FaGamepad::", text: "Лаунж-зона с кальяном и игровыми приставками" }, { icon: "::FaMapLocationDot::", text: "Новая удобная локация: пл. Комсомольская 2" }, { icon: "::FaBeerMugEmpty::", text: "Место, где можно встретить единомышленников" }] },
];

export function ServiceCardsSection() {
  return (
    <motion.section initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
      {serviceCards.map((card) => <ServiceCard key={card.title} {...card} />)}
    </motion.section>
  );
}
