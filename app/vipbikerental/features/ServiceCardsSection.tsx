/**
 * ServiceCardsSection.tsx
 * ========================
 * Service cards section with improved styling and theme integration.
 * Now uses shared data constants and VIP theme system.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { SERVICE_CARDS, type ServiceItem } from "./shared/data";
import {
  vipColorWithAlpha,
  vipCardShadow,
  vipCssVars,
  VIP_RADIUS,
} from "../lib/vip-theme";

export const InfoItem = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <VibeContentRenderer content={icon} className="mt-1 flex-shrink-0 text-xl text-accent-text" />
    <p className="text-white/90">{children}</p>
  </div>
);

export const StepItem = ({ num, title, icon, children }: { num: string; title: string; icon: string; children: React.ReactNode }) => (
  <motion.div
    whileHover={{ y: -4 }}
    className="relative h-full w-full min-w-0 rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20"
  >
    <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary font-orbitron font-bold text-primary-foreground">{num}</div>
    <VibeContentRenderer content={icon} className="mx-auto my-4 text-4xl text-primary" />
    <h4 className="mb-2 font-orbitron text-lg">{title}</h4>
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  </motion.div>
);

interface ServiceCardProps {
  title: string;
  icon: string;
  items: ServiceItem[];
  imageUrl?: string;
  borderColorClass?: string;
  index: number;
}

function ServiceCard({ title, icon, items, imageUrl, borderColorClass, index }: ServiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4 }}
    >
      <Card
        className={`group relative overflow-hidden border bg-neutral-950/80 shadow-xl shadow-black/20 ${borderColorClass || "border-border/70"}`}
        style={vipCssVars()}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="absolute inset-0 object-cover opacity-55 transition-opacity duration-300 group-hover:opacity-70"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/10" />
        <div
          className="absolute inset-0"
          style={{
            background: vipColorWithAlpha("#FFAA5A", 0.18)
              .replace("rgba", "radial-gradient(circle_at_top,")
              .replace(")", ", transparent 52%)"),
          }}
        />
        <div className="relative flex h-full flex-col p-6">
          <CardHeader className="mb-4 p-0">
            <CardTitle
              className={`flex items-center gap-3 text-2xl text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] ${
                borderColorClass?.replace("border-", "text-") || "text-accent"
              }`}
            >
              <VibeContentRenderer content={icon} />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow space-y-4 p-0">
            {items.map((item, itemIndex) => (
              <motion.div
                key={itemIndex}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 + itemIndex * 0.05 }}
              >
                <InfoItem icon={item.icon}>{item.text}</InfoItem>
              </motion.div>
            ))}
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}

export function ServiceCardsSection() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3"
    >
      {SERVICE_CARDS.map((card, index) => (
        <ServiceCard key={card.title} {...card} index={index} />
      ))}
    </motion.section>
  );
}
