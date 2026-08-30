"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  motion, AnimatePresence, useInView, useScroll, useTransform, useSpring, useMotionValue,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useTheme } from "next-themes";

/* ══ THEME PALETTES (dark: gold/black, light: dark cyan/white — WCAG AA) ══ */
const VIP_BIKE_THEMES = {
  dark: { bgBase: "#0A0A0A", bgCard: "#1A1A1A", accentMain: "#FFD700", accentMainHover: "#FFC125", textPrimary: "#FFFAF0", textSecondary: "#D4AF37", borderSoft: "#2A2A2A" },
  light: { bgBase: "#FAFAFA", bgCard: "#FFFFFF", accentMain: "#0891B2", accentMainHover: "#0E7490", textPrimary: "#1A1A1A", textSecondary: "#4A4A4A", borderSoft: "#CCFBF1" },
};

/* ══ HERO IMAGES — confirmed rental catalog models ══ */
const HERO_IMAGES = [
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/falcon-gt-2026/image_1.jpg",
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/y-volt-surge-v/image_1.jpg",
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yamaha-r7/image_1.jpg",
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/kawasaki-ex650k/image_1.jpg",
];

/* ══ CTA TARGETS ══ */
const CATALOG_HREF = "/franchize/vip-bike";
const ELECTRIC_CATALOG_HREF = "/franchize/vip-bike?propulsion=electric";
const PETROL_CATALOG_HREF = "/franchize/vip-bike?propulsion=petrol";
const BOT_HREF = "https://t.me/oneBikePlsBot/app?startapp=home";
const OPERATOR_HREF = "https://t.me/I_O_S_NN";
const INSTAGRAM_HREF = "https://www.instagram.com/vipbikerental_nn";

/* ══ SOCIAL LINKS — 7 platforms: Instagram, Telegram, VK Electro, VK, WhatsApp, Reviews, Website ══ */
type SocialLink = {
  id: string; label: string; href: string; color: string;
  gradient: string; hoverGlow: string; description: string;
  icon: React.ReactElement<{ children?: React.ReactNode }>;
  featured?: "electric" | "gold" | null;
};

/* ══ Electric loop keyframes (for VK Electro — periodic chaotic cyan burst) ══ */
const ELECTRIC_LOOP_KEYFRAMES = `
@keyframes vip-electric-glow {
  0%, 70%, 100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0), 0 0 0 0 rgba(34, 211, 238, 0); }
  72%      { box-shadow: 0 0 8px 1px rgba(34, 211, 238, 0.4), 0 0 16px 2px rgba(34, 211, 238, 0.3); }
  75%      { box-shadow: 0 0 14px 3px rgba(34, 211, 238, 0.7), 0 0 28px 6px rgba(34, 211, 238, 0.5); }
  78%      { box-shadow: 0 0 6px 1px rgba(34, 211, 238, 0.3), 0 0 12px 2px rgba(34, 211, 238, 0.2); }
  82%      { box-shadow: 0 0 18px 4px rgba(34, 211, 238, 0.8), 0 0 36px 8px rgba(34, 211, 238, 0.6); }
  86%      { box-shadow: 0 0 4px 0px rgba(34, 211, 238, 0.2), 0 0 8px 1px rgba(34, 211, 238, 0.15); }
  90%      { box-shadow: 0 0 16px 3px rgba(34, 211, 238, 0.75), 0 0 32px 7px rgba(34, 211, 238, 0.55); }
  94%      { box-shadow: 0 0 10px 2px rgba(34, 211, 238, 0.5), 0 0 20px 3px rgba(34, 211, 238, 0.35); }
}
@keyframes vip-electric-spark {
  0%, 70%, 100% { opacity: 0; transform: scale(0.8); }
  72%   { opacity: 1; transform: scale(1.1); }
  75%   { opacity: 0.3; transform: scale(0.9); }
  80%   { opacity: 0.9; transform: scale(1.05); }
  84%   { opacity: 0.1; transform: scale(0.85); }
  88%   { opacity: 1; transform: scale(1.15); }
  92%   { opacity: 0.4; transform: scale(0.95); }
  96%   { opacity: 0; transform: scale(0.8); }
}
@keyframes vip-electric-arc {
  0%, 70% { opacity: 0; transform: rotate(0deg); }
  72%     { opacity: 1; transform: rotate(60deg); }
  78%     { opacity: 0.5; transform: rotate(120deg); }
  84%     { opacity: 1; transform: rotate(180deg); }
  90%     { opacity: 0.3; transform: rotate(240deg); }
  96%     { opacity: 0.8; transform: rotate(300deg); }
  100%    { opacity: 0; transform: rotate(360deg); }
}
`;

/* ══ Gold blic keyframes (for VK — gold shine sweep, longer line + quicker) ══ */
const GOLD_BLIC_KEYFRAMES = `
@keyframes vip-gold-blic {
  0%   { transform: translateX(-300%) rotate(25deg); }
  50%  { transform: translateX(300%) rotate(25deg); }
  100% { transform: translateX(300%) rotate(25deg); }
}
@keyframes vip-gold-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4), 0 0 14px 2px rgba(255, 215, 0, 0.3); }
  50%      { box-shadow: 0 0 0 4px rgba(255, 215, 0, 0.0), 0 0 22px 5px rgba(255, 215, 0, 0.6); }
}
`;

/* ══ Scroll-snap CSS for Tesla-style duo section + JS-independent hero entrance ══ */
const SCROLL_SNAP_CSS = `
.vip-snap-container {
  scroll-snap-type: y proximity;
}
.vip-snap-section {
  scroll-snap-align: start;
  scroll-snap-stop: normal;
}
/* Hero entrance: pure CSS so text is NEVER hidden pre-hydration (fixes
   "only hero visible / only background visible" on slow or broken JS). */
@keyframes vip-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.vip-fade-up { animation: vip-fade-up 0.6s ease-out backwards; }
@keyframes vip-word-in {
  from { opacity: 0; transform: translateY(50px) rotateX(-90deg); }
  to   { opacity: 1; transform: translateY(0) rotateX(0deg); }
}
.vip-word-in { animation: vip-word-in 0.6s cubic-bezier(0.215, 0.61, 0.355, 1) backwards; }
@media (prefers-reduced-motion: reduce) {
  .vip-snap-container { scroll-snap-type: none; }
  .vip-snap-section { scroll-snap-align: none; }
  .vip-fade-up, .vip-word-in { animation: none; }
}
`;

/* ══ Cinematic duo section background (shared between Partners + Final CTA) ══ */
const DUO_SECTION_BG = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/falcon-gt-2026/image_1.jpg";

/* ══ CATALOG CARD GALLERIES — animated card backgrounds, split by propulsion type.
   Image folders verified against Supabase storage; bike/type split follows
   docs/autoreply/vip-bike-rent.csv (public.cars export: 12 Electric + 9 ICE). ══ */
const CARPIX = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix";
const img = (folder: string) => `${CARPIX}/${folder}/image_1.jpg`;

const ELECTRIC_BIKE_IMAGES = [
  img("falcon-gt-2026"),
  img("falcon-pro"),
  img("y-volt-surge-v"),
  img("sequence-zero"),
  img("livewire-one"),
  img("rerode-r1-plus"),
  img("hmd-m02"),
  img("wenbox-u2-pro"),
];

const PETROL_BIKE_IMAGES = [
  img("kawasaki-ex650k"),
  img("yamaha-r7"),
  img("suzuki-gsx-s1000f"),
  img("bmw-f800r"),
  img("aprilia-shiver"),
  img("nibbler-regumoto-4v"),
  img("motoland-breakout"),
  img("kayo-tsd110"),
  img("jilang-max-pro"),
];

/* Card 3 (Подбор) — the head-turners from both camps, alternating electro/ICE */
const SHOWSTOPPER_BIKE_IMAGES = [
  img("sequence-zero"),
  img("ducati-panigale-s-electro-gold"),
  img("y-volt-surge-v"),
  img("livewire-one"),
  img("yamaha-r7"),
  img("kawasaki-ex650k"),
  img("suzuki-gsx-s1000f"),
  img("falcon-gt-2026"),
];

/* ══ Bike name lists per card (same verified split as galleries above) ══ */
const ELECTRIC_BIKE_NAMES = [
  "Falcon GT 2026", "Falcon PRO", "Y-VOLT Surge V", "Sequence Zero", "LiveWire One",
  "Rerode R1+", "HMD M02", "Wenbox U2 Pro", "Ducati Panigale S Electro",
];
const PETROL_BIKE_NAMES = [
  "Kawasaki Ninja 650", "Yamaha R7", "Suzuki GSX-S1000F", "BMW F800R", "Aprilia Shiver 750",
  "Regulmoto Nibbler 300", "Motoland Breakout 300", "Kayo TSD 110", "Jilang Max Pro",
];
const SHOWSTOPPER_BIKE_NAMES = [
  "Sequence Zero", "Panigale S Electro Gold", "Y-VOLT Surge V", "LiveWire One",
  "Yamaha R7", "Kawasaki Ninja 650", "Suzuki GSX-S1000F", "Falcon GT 2026",
];

const SOCIAL_LINKS: SocialLink[] = [
  {
    id: "instagram", label: "Instagram", href: INSTAGRAM_HREF, color: "#E4405F",
    gradient: "from-[#833AB4] via-[#E4405F] to-[#FCAF45]", hoverGlow: "rgba(228, 64, 95, 0.5)", description: "Фото и сторис",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>),
  },
  {
    id: "telegram", label: "Telegram", href: BOT_HREF, color: "#26A5E4",
    gradient: "from-[#26A5E4] to-[#1A8BC9]", hoverGlow: "rgba(38, 165, 228, 0.5)", description: "Бот для брони",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>),
  },
  {
    id: "vk-electro", label: "VK Electro", href: "https://vk.ru/vip_bike_electro", color: "#22D3EE",
    gradient: "from-[#22D3EE] via-[#06B6D4] to-[#0E7490]", hoverGlow: "rgba(34, 211, 238, 0.6)", description: "Видео покатушек",
    featured: "electric",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.49 2.27 4.675 2.85 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.49c0 .373.17.508.271.508.22 0 .407-.135.813-.542 1.254-1.406 2.152-3.574 2.152-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.253.746.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" /></svg>),
  },
  {
    id: "vk", label: "VK", href: "https://vk.com/vip_bike", color: "#FFD700",
    gradient: "from-[#FFD700] via-[#FFC125] to-[#D4AF37]", hoverGlow: "rgba(255, 215, 0, 0.6)", description: "Группа ВКонтакте",
    featured: "gold",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.49 2.27 4.675 2.85 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.49c0 .373.17.508.271.508.22 0 .407-.135.813-.542 1.254-1.406 2.152-3.574 2.152-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.253.746.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" /></svg>),
  },
  {
    id: "whatsapp", label: "WhatsApp", href: "https://wa.me/79200789888", color: "#25D366",
    gradient: "from-[#25D366] to-[#128C7E]", hoverGlow: "rgba(37, 211, 102, 0.5)", description: "Напишите нам",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>),
  },
  {
    id: "reviews", label: "Отзывы", href: "https://yandex.ru/maps/org/vip_bike_electro/81589395232/reviews/", color: "#FFCC00",
    gradient: "from-[#FFCC00] to-[#FF9500]", hoverGlow: "rgba(255, 204, 0, 0.5)", description: "Яндекс.Карты",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>),
  },
  {
    id: "website", label: "Сайт", href: "https://vip-bike.ru", color: "#10B981",
    gradient: "from-[#10B981] to-[#059669]", hoverGlow: "rgba(16, 185, 129, 0.5)", description: "vip-bike.ru",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>),
  },
];

/* ══ CONTACT INFO ══ */
const CONTACT_INFO = {
  phone: "+7 (920) 078-98-88", phoneHref: "tel:+79200789888",
  address: "пл. Комсомольская 2", workingHours: "10:00 — 20:00 (ежедневно)",
};



/* ══ BIKE TIERS — 3 experience levels (Новичок / Опытный / Профи) ══ */
const BIKE_TIERS = [
  {
    id: "electric", tier: "Электро", marker: "01", tagline: "Электромотоциклы в аренду",
    description: "Тихая тяга и быстрый отклик. Выбирай модель по мощности, запасу хода и своему опыту.",
    licenseReq: "Требования к категории зависят от модели", accentColor: "#22C55E",
    bikes: ["Falcon GT", "Falcon PRO", "Falcon LYNX Purple", "HMD M02", "Sotion EM01", "Y-VOLT Surge V"],
  },
  {
    id: "petrol", tier: "Бензин", marker: "02", tagline: "Мотоциклы с ДВС",
    description: "Городские, дорожные и спортивные модели. Выбирай объём, посадку и характер техники.",
    licenseReq: "Для бензиновых мотоциклов обязательна категория А", accentColor: "#F59E0B",
    bikes: ["BMW F800R", "Yamaha R7", "Kawasaki Ninja 650", "Suzuki GSX-S1000F", "Motoland Breakout 300", "Kayo TSD 110"],
  },
  {
    id: "selection", tier: "Подбор", marker: "03", tagline: "Если ещё не определился",
    description: "Расскажи менеджеру про опыт, маршрут и даты. Он проверит доступность и поможет выбрать подходящую модель.",
    licenseReq: "Документы и условия менеджер подтвердит до бронирования", accentColor: "#EF4444",
    bikes: ["Подбор по опыту", "Проверка доступности", "Подтверждение условий"],
  },
];

/* ══ PRICING TIERS ══ */
const PRICING_TIERS = [
  { id: "electric", label: "Электро", marker: "Э", price: "5 000–12 000 ₽", per: "/ сутки", note: "подтверждённые суточные тарифы",
    features: ["Sotion EM01 — 5 000 ₽", "Falcon GT — 12 000 ₽", "Y-VOLT Surge V — 12 000 ₽; выходной — 15 000 ₽"],
    cta: "Выбрать электро", href: ELECTRIC_CATALOG_HREF, highlighted: true },
  { id: "petrol", label: "Бензин", marker: "ДВС", price: "4 000–14 000 ₽", per: "/ сутки", note: "подтверждённые суточные тарифы",
    features: ["Kayo TSD 110 — 4 000 ₽", "Yamaha R7 — 10 000 ₽", "Suzuki GSX-S1000F — 14 000 ₽"],
    cta: "Выбрать бензин", href: PETROL_CATALOG_HREF, highlighted: false },
  { id: "terms", label: "Условия", marker: "INFO", price: "Уточнит менеджер", per: "", note: "до подтверждения брони",
    features: ["Паспорт и водительское удостоверение", "Для бензиновых моделей — категория А", "Даты и дополнительные условия подтверждаются отдельно"],
    cta: "Написать менеджеру", href: OPERATOR_HREF, highlighted: false },
];

/* ══ FAQ ITEMS ══ */
const FAQ_ITEMS = [
  { q: "Какая категория нужна?", a: "Для бензиновых мотоциклов обязательна категория А. Для электрических требования зависят от конкретной модели — менеджер проверит их до подтверждения брони." },
  { q: "Какие документы нужны?", a: "Паспорт и водительское удостоверение. Для аренды бензинового мотоцикла в удостоверении должна быть категория А." },
  { q: "Сколько стоит аренда?", a: "Подтверждённые суточные тарифы: электро — от 5 000 до 12 000 ₽, бензин — от 4 000 до 14 000 ₽. У Y-VOLT Surge V тариф выходного дня — 15 000 ₽." },
  { q: "Как узнать условия и сумму залога?", a: "Оставь заявку на выбранную модель. Менеджер проверит даты и сообщит дополнительные условия до подтверждения брони." },
  { q: "Есть ли почасовая аренда?", a: "Почасовой тариф определяет оператор. Напиши менеджеру и укажи модель, дату и нужное время." },
  { q: "Где выдаёте мотоциклы?", a: "Нижний Новгород, пл. Комсомольская, 2. Шоурум работает ежедневно с 10:00 до 20:00." },
  { q: "Как проверить доступность?", a: "Выбери модель и даты в каталоге или оставь номер телефона. Менеджер проверит слот и свяжется с тобой." },
  { q: "Куда написать?", a: "По вопросам аренды напиши в Telegram менеджеру: @I_O_S_NN." },
];

/* ══ HOW IT WORKS — 4 STEPS (cool SVG icons instead of emojis) ══ */
const HOW_IT_WORKS_STEPS = [
  {
    n: "01", title: "Выбрал", desc: "Жмёшь «Выбрать байк» → попадаешь в каталог. Смотришь фото, читаешь спеку, выбираешь по сердцу.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>),
  },
  {
    n: "02", title: "Указал даты", desc: "Выбираешь период аренды и оставляешь заявку в каталоге или Telegram-боте.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>),
  },
  {
    n: "03", title: "Подтвердил", desc: "Менеджер проверяет доступность модели и заранее сообщает условия аренды.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>),
  },
  {
    n: "04", title: "Получил байк", desc: "Приезжаешь на пл. Комсомольскую, 2 с паспортом и водительским удостоверением, оформляешь договор и забираешь мотоцикл.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6a5 5 0 010 6l-3-3-3 3a5 5 0 010-6l3-3 3 3z" /><path d="M5.5 17.5L9 14m9.5 3.5L15 14" /></svg>),
  },
];

/* ══ Gradient text helper (reused across section headings) ══ */
function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--vip-accent-main), var(--vip-accent-main-hover))` }}>
      {children}
    </span>
  );
}

/* ══ SAFE SCROLL-REVEAL HOOK ══
   Reveal-by-default semantics: SSR renders content fully visible (no opacity:0
   in the server HTML). After hydration, an element is hidden ONLY if it sits
   below the viewport AND IntersectionObserver exists AND the user hasn't asked
   for reduced motion — then it reveals once on scroll. This fixes "page shows
   only the hero" reports: previously every section below the hero shipped as
   opacity:0 and stayed invisible whenever hydration was slow (weak mobile
   networks) or IntersectionObserver never fired (old Telegram WebViews).
   Returns `shown` (animate to visible?) and `everHidden` (an animation is
   actually running — callers use it to pick instant vs animated transitions). */
function useSafeReveal<T extends HTMLElement>(rootMargin = "-50px") {
  const ref = useRef<T>(null);
  const [hidden, setHidden] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    // Only arm elements fully BELOW the viewport. Anything already on screen
    // (or scrolled past before hydration) stays visible — hiding sections the
    // user already passed would recreate the "missing sections" bug when they
    // scroll back up.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    setHidden(true);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, shown: !hidden || revealed, everHidden: hidden };
}

/* ══ ANIMATED SECTION WRAPPER ══ */
function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, shown, everHidden } = useSafeReveal<HTMLDivElement>("-80px");
  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: everHidden && shown ? 0.7 : 0, delay: shown ? delay : 0, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ══ SCROLL PROGRESS BAR (top of page) ══ */
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return (
    <motion.div style={{ scaleX, transformOrigin: "0%", background: "linear-gradient(to right, var(--vip-accent-main), var(--vip-accent-main-hover))" }} className="fixed top-0 left-0 right-0 h-1 z-[60] origin-left" />
  );
}

/* ══ MAGNETIC BUTTON — attracts cursor slightly ══ */
function MagneticButton({ children, href, primary = false, className = "", buttonClassName = "", style = {}, size = "lg" }: {
  children: React.ReactNode; href: string; primary?: boolean; className?: string; buttonClassName?: string; style?: React.CSSProperties; size?: "sm" | "lg" | "default";
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: (e.clientX - (rect.left + rect.width / 2)) * 0.25, y: (e.clientY - (rect.top + rect.height / 2)) * 0.25 });
  }, []);
  const handleLeave = useCallback(() => setPos({ x: 0, y: 0 }), []);
  const isInternal = href.startsWith("/");
  const sizeClasses = size === "sm" ? "text-sm px-5 py-2" : "text-lg px-8 md:px-10 py-6";
  return (
    <motion.a ref={ref} href={href} onMouseMove={handleMove} onMouseLeave={handleLeave} animate={{ x: pos.x, y: pos.y }} transition={{ type: "spring", stiffness: 200, damping: 15 }} target={isInternal ? undefined : "_blank"} rel={isInternal ? undefined : "noopener noreferrer"} className={`inline-block ${className}`}>
      <Button size={size === "sm" ? "sm" : "lg"} variant={primary ? "default" : "outline"} className={`rounded-full font-bold transition-all hover:scale-[1.03] ${sizeClasses} ${buttonClassName}`} style={{ backgroundColor: primary ? "var(--vip-accent-main)" : "transparent", color: primary ? "var(--vip-bg-base)" : "var(--vip-accent-main)", borderColor: "var(--vip-accent-main)", boxShadow: primary ? `0 10px 30px color-mix(in srgb, var(--vip-accent-main) 30%, transparent)` : "none", ...style }}>
        {children}
      </Button>
    </motion.a>
  );
}

/* ══ ANIMATED COUNTER (counts up when in view) ══ */
function AnimatedCounter({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    const duration = 1500, start = Date.now(); let raf = 0;
    const tick = () => { const t = Math.min(1, (Date.now() - start) / duration); const eased = 1 - Math.pow(1 - t, 3); setDisplay(value * eased); if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, value]);
  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString("ru-RU");
  return (<span ref={ref}>{formatted}<span style={{ color: "var(--vip-accent-main)" }}>{suffix}</span></span>);
}

/* ══ MOUSE-FOLLOW GLOW (hero background) ══ */
function MouseFollowGlow() {
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 50, damping: 20 }), sy = useSpring(y, { stiffness: 50, damping: 20 });
  const background = useTransform([sx, sy], ([cx, cy]: number[]) => `radial-gradient(600px circle at ${cx}px ${cy}px, color-mix(in srgb, var(--vip-accent-main) 8%, transparent), transparent 70%)`);
  useEffect(() => {
    const handler = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [x, y]);
  return <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[5] hidden md:block" style={{ background }} />;
}

/* ══ HERO IMAGE CAROUSEL — crossfade between images (hero + catalog cards) ══ */
function HeroImageCarousel({ images, alt, loading = "eager", intervalMs = 5000 }: { images: string[]; alt: string; loading?: "eager" | "lazy"; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => setIndex((prev) => (prev + 1) % images.length), intervalMs);
    return () => clearInterval(interval);
  }, [images.length, intervalMs]);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.img key={index} src={images[index]} alt={alt} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.3, ease: "easeInOut" }} className="absolute inset-0 w-full h-full object-cover" loading={loading} />
      </AnimatePresence>
      {images.length > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 flex">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Слайд ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className="grid h-11 min-w-11 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i === index ? "var(--vip-accent-main)" : "rgba(255,255,255,0.35)",
                  width: i === index ? "28px" : "8px",
                }}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ SOCIAL CIRCLE BUTTON — circular icon with hover effects ══ */
function SocialCircleButton({ social, index }: { social: SocialLink; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.a href={social.href} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 24, scale: 0.8 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} whileHover={{ scale: 1.1, y: -4 }} whileTap={{ scale: 0.95 }} className="group relative flex flex-col items-center gap-3" style={{ zIndex: hovered ? 10 : 1 }} aria-label={social.label}>
      <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-300" style={{ backgroundColor: hovered ? social.color : "var(--vip-bg-card)", border: `2px solid ${social.color}`, boxShadow: hovered ? `0 12px 32px ${social.hoverGlow}` : "0 4px 14px rgba(0,0,0,0.12)" }}>
        <div className="absolute inset-0 rounded-full transition-opacity duration-300" style={{ boxShadow: `0 0 0 6px ${social.color}22`, opacity: hovered ? 1 : 0 }} />
        <div className="relative transition-all duration-300" style={{ color: hovered ? "#ffffff" : social.color, filter: hovered ? "drop-shadow(0 0 6px rgba(255,255,255,0.4))" : "none" }}>
          {social.icon}
        </div>
      </div>
      <span className="text-xs md:text-sm font-medium transition-colors duration-300" style={{ color: hovered ? social.color : "var(--vip-text-secondary)" }}>{social.label}</span>
    </motion.a>
  );
}

/* ══ FLOATING SOCIAL SIDEBAR (desktop, appears on scroll) ══ */
function FloatingSocialBar() {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 500);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -80, opacity: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3">
          {SOCIAL_LINKS.map((social) => (
            <a key={social.id} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} title={social.label} className="group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ background: `${social.color}15`, border: `1px solid ${social.color}30` }}>
              <div className="transition-all duration-300 group-hover:scale-110" style={{ color: social.color }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">{social.icon.props.children}</svg>
              </div>
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" style={{ background: social.color, color: "#fff" }}>{social.label}</div>
            </a>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══ VIP BIKE THEME STYLE INJECTOR ══ */
function VipBikeThemeStyles() {
  const { resolvedTheme, setTheme } = useTheme();
  // Force dark theme on landing page (default), but allow user to toggle after
  useEffect(() => {
    // Only force on initial mount — if user explicitly toggled, respect their choice
    const hasUserChosen = sessionStorage.getItem("vip-landing-theme-chosen");
    if (!hasUserChosen) {
      setTheme("dark");
    }
  }, [setTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = resolvedTheme === "dark" ? VIP_BIKE_THEMES.dark : VIP_BIKE_THEMES.light;
    root.style.setProperty("--vip-bg-base", theme.bgBase);
    root.style.setProperty("--vip-bg-card", theme.bgCard);
    root.style.setProperty("--vip-accent-main", theme.accentMain);
    root.style.setProperty("--vip-accent-main-hover", theme.accentMainHover);
    root.style.setProperty("--vip-text-primary", theme.textPrimary);
    root.style.setProperty("--vip-text-secondary", theme.textSecondary);
    root.style.setProperty("--vip-border-soft", theme.borderSoft);
    // Partner logos: in dark theme, invert+dim white-bg logos so they blend;
    // in light theme, keep logos as-is (they're designed for white backgrounds).
    root.style.setProperty("--partner-logo-filter", resolvedTheme === "dark" ? "brightness(0.92) contrast(1.05)" : "none");
    // Hero badge bg: white in light theme, transparent accent-tint in dark theme
    root.style.setProperty("--vip-badge-bg", resolvedTheme === "dark" ? "color-mix(in srgb, var(--vip-accent-main) 8%, transparent)" : "rgba(255, 255, 255, 0.85)");
    document.body.style.backgroundColor = theme.bgBase;

    // Track that user has a resolved theme (after initial dark-forced mount).
    // If resolvedTheme is light AFTER our forced dark, user must have toggled.
    if (resolvedTheme === "light") {
      sessionStorage.setItem("vip-landing-theme-chosen", "1");
    }

    // Footer logo: swap src based on theme (dark = local neon, light = supabase photo)
    document.querySelectorAll<HTMLImageElement>("img.footer-logo-img").forEach((img) => {
      const lightSrc = img.getAttribute("data-light-src");
      if (lightSrc) {
        img.src = resolvedTheme === "dark" ? "/logo-electro-neon.png" : lightSrc;
      }
    });

    // Inject keyframes for social link animations (electric loop + gold blic) + scroll-snap CSS
    if (!document.getElementById("vip-social-keyframes")) {
      const style = document.createElement("style");
      style.id = "vip-social-keyframes";
      style.textContent = ELECTRIC_LOOP_KEYFRAMES + GOLD_BLIC_KEYFRAMES + SCROLL_SNAP_CSS;
      document.head.appendChild(style);
    }
  }, [resolvedTheme, setTheme]);
  return null;
}

/* ══ FAQ ACCORDION ITEM ══ */
function FaqItem({ item, index }: { item: (typeof FAQ_ITEMS)[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const { ref, shown, everHidden } = useSafeReveal<HTMLDivElement>();
  return (
    <motion.div ref={ref} initial={false} animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={{ duration: everHidden && shown ? 0.5 : 0, delay: shown ? index * 0.05 : 0 }} className="rounded-2xl border overflow-hidden transition-colors duration-300" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: open ? "var(--vip-accent-main)" : "var(--vip-border-soft)" }}>
      <button onClick={() => setOpen(!open)} className="w-full text-left p-5 md:p-6 flex items-start justify-between gap-4 cursor-pointer">
        <span className="text-base md:text-lg font-bold pr-2 leading-snug" style={{ color: "var(--vip-text-primary)" }}>{item.q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }} className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: open ? "var(--vip-accent-main)" : "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)", color: open ? "var(--vip-bg-base)" : "var(--vip-accent-main)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
            <p className="px-5 md:px-6 pb-5 md:pb-6 text-sm md:text-base leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function LicenseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="11" r="2" />
      <path d="M13 10h5M13 14h4M6 16h4" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

/* ══ PRICING CARD ══ */
function PricingCard({ tier, index }: { tier: (typeof PRICING_TIERS)[0]; index: number }) {
  const { ref, shown, everHidden } = useSafeReveal<HTMLDivElement>();
  return (
    <motion.div ref={ref} initial={false} animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }} transition={{ duration: everHidden && shown ? 0.6 : 0, delay: shown ? index * 0.15 : 0, ease: "easeOut" }} whileHover={{ y: -8 }} className="relative z-10 flex flex-col rounded-3xl border-2 p-6 md:p-8 transition-colors duration-300" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: tier.highlighted ? "var(--vip-accent-main)" : "var(--vip-border-soft)", boxShadow: tier.highlighted ? `0 20px 60px color-mix(in srgb, var(--vip-accent-main) 20%, transparent)` : "0 4px 16px rgba(0,0,0,0.15)" }}>
      {tier.highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide" style={{ background: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}>Хит</div>}
      <div className="text-center mb-6">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border text-sm font-black" style={{ borderColor: "var(--vip-accent-main)", color: "var(--vip-accent-main)" }}>{tier.marker}</div>
        <h4 className="text-xl font-bold uppercase tracking-wide" style={{ color: "var(--vip-text-primary)" }}>{tier.label}</h4>
        <p className="text-xs mt-1" style={{ color: "var(--vip-text-secondary)" }}>{tier.note}</p>
      </div>
      <div className="text-center mb-6">
        <span className="text-3xl md:text-4xl font-black" style={{ color: "var(--vip-accent-main)" }}>{tier.price}</span>
        <span className="text-sm ml-1" style={{ color: "var(--vip-text-secondary)" }}>{tier.per}</span>
      </div>
      <ul className="flex-1 space-y-3 mb-6">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--vip-text-secondary)" }}>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--vip-accent-main)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <MagneticButton href={tier.href} primary={tier.highlighted} className="w-full">
        {tier.cta}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </MagneticButton>
    </motion.div>
  );
}

/* ══ BIKE TIER CARD — one of the 3 experience levels ══ */
function BikeTierCard({ tier, index }: { tier: (typeof BIKE_TIERS)[0]; index: number }) {
  const { ref, shown, everHidden } = useSafeReveal<HTMLDivElement>();
  return (
    <motion.div ref={ref} initial={false} animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }} transition={{ duration: everHidden && shown ? 0.6 : 0, delay: shown ? index * 0.15 : 0, ease: "easeOut" }} whileHover={{ y: -8 }} className="relative z-10 flex flex-col rounded-3xl border-2 p-6 md:p-8 transition-all duration-300" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: `color-mix(in srgb, ${tier.accentColor} 40%, var(--vip-border-soft))`, boxShadow: `0 10px 40px color-mix(in srgb, ${tier.accentColor} 10%, transparent)` }}>
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black leading-none flex-shrink-0" style={{ background: `linear-gradient(135deg, ${tier.accentColor}33, ${tier.accentColor}11)`, border: `1px solid ${tier.accentColor}55`, color: tier.accentColor }}>{tier.marker}</div>
        <div>
          <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: tier.accentColor }}>Уровень 0{index + 1}</div>
          <h4 className="text-2xl md:text-3xl font-black" style={{ color: "var(--vip-text-primary)" }}>{tier.tier}</h4>
        </div>
      </div>
      <p className="text-base font-semibold mb-3" style={{ color: "var(--vip-text-primary)" }}>{tier.tagline}</p>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--vip-text-secondary)" }}>{tier.description}</p>
      <div className="flex items-start gap-2 p-3 rounded-xl mb-6 text-sm font-medium" style={{ backgroundColor: `color-mix(in srgb, ${tier.accentColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${tier.accentColor} 25%, transparent)`, color: "var(--vip-text-primary)" }}>
        <LicenseIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{tier.licenseReq}</span>
      </div>
      <div className="flex-1 mb-6">
        <div className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: "var(--vip-text-secondary)" }}>Байки в этой категории</div>
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {tier.bikes.map((bike, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--vip-text-primary)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tier.accentColor }} />
              {bike}
            </li>
          ))}
        </ul>
      </div>
      <MagneticButton href={CATALOG_HREF} primary={index === 0} className="w-full">
        Выбрать байк
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </MagneticButton>
    </motion.div>
  );
}

/* ══ Reusable arrow icon for inline use ══ */
const ArrowRight = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
);

/* ══ CINEMATIC HERO — full-bleed carousel, parallax, word reveal ══ */
function CinematicHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  // Stats fade very late — visible for most of the hero scroll
  const contentOpacity = useTransform(scrollYProgress, [0.7, 0.98], [1, 0]);
  const headlineWords = ["VIP", "BIKE", "RENTAL"];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden pt-16 md:pt-20">
      {/* Background image with parallax */}
      <motion.div style={{ y: imageY, scale: imageScale }} className="absolute inset-0 z-0">
        <HeroImageCarousel images={HERO_IMAGES} alt="VIP Bike — аренда мотоциклов в Нижнем Новгороде" />
        {/* Lighter tint for better image visibility */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--vip-bg-base) 50%, transparent) 0%, color-mix(in srgb, var(--vip-bg-base) 25%, transparent) 40%, var(--vip-bg-base) 95%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 35%, transparent 0%, color-mix(in srgb, var(--vip-bg-base) 50%, transparent) 100%)" }} />
      </motion.div>

      {/* Glow accents */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[100px] z-[1] pointer-events-none" style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.06 }} />
      <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] rounded-full blur-[80px] z-[1] pointer-events-none" style={{ backgroundColor: "#26A5E4", opacity: 0.05 }} />

      {/* Main content */}
      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative z-10 max-w-5xl mx-auto px-4 text-center w-full py-8">

        {/* Badge */}
        <div className="vip-fade-up mb-5">
          <Badge variant="outline" className="px-3 py-1.5 text-xs md:text-sm" style={{ borderColor: "var(--vip-accent-main)", color: "var(--vip-accent-main)", backgroundColor: "var(--vip-badge-bg)", backdropFilter: "blur(8px)" }}>
            Электро и ДВС мотоциклы в аренду
          </Badge>
        </div>

        {/* Headline — CSS entrance (works without JS, see SCROLL_SNAP_CSS keyframes) */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-4 leading-[0.95] tracking-tighter" style={{ color: "var(--vip-text-primary)" }}>
          {headlineWords.map((word, i) => (
            <span key={i} className="vip-word-in inline-block mr-3 md:mr-4 last:mr-0" style={{ animationDelay: `${0.15 + i * 0.12}s`, backgroundImage: i === 2 ? "linear-gradient(135deg, var(--vip-accent-main), var(--vip-accent-main-hover))" : "none", WebkitBackgroundClip: i === 2 ? "text" : "unset", WebkitTextFillColor: i === 2 ? "transparent" : "var(--vip-text-primary)", backgroundClip: "text", transformOrigin: "bottom" }}>{word}</span>
          ))}
        </h2>

        {/* Subtitle */}
        <p className="vip-fade-up text-base md:text-xl max-w-xl mx-auto mb-3 leading-relaxed font-medium" style={{ animationDelay: "0.6s", color: "var(--vip-text-primary)" }}>
          Аренда мотоциклов без заморочек
        </p>
        <p className="vip-fade-up text-sm md:text-base max-w-lg mx-auto mb-6" style={{ animationDelay: "0.75s", color: "var(--vip-text-secondary)" }}>
          Выбирай электрическую или бензиновую модель. Даты, доступность и дополнительные условия менеджер подтвердит до бронирования.
        </p>

        {/* CTA Buttons */}
        <div className="vip-fade-up flex flex-col sm:flex-row gap-3 justify-center items-center mb-8" style={{ animationDelay: "0.9s" }}>
          <MagneticButton href={CATALOG_HREF} primary>Выбрать байк<ArrowRight /></MagneticButton>
          <MagneticButton href={BOT_HREF}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="mr-2 inline"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
            Бронь в боте
          </MagneticButton>
        </div>

        {/* ══ SOCIAL LINKS — MAIN FEATURE, INSIDE HERO ══ */}
        <div className="vip-fade-up mb-8" style={{ animationDelay: "1.1s" }}>
          <p className="text-xs uppercase tracking-[0.2em] mb-4 font-semibold" style={{ color: "var(--vip-text-secondary)" }}>
            Мы в соцсетях — подписывайся
          </p>
          <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4">
            {SOCIAL_LINKS.map((social, idx) => (
              <motion.a
                key={social.id}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                /* hover:z-10 — raise hovered icon above later flex-wrap rows so
                   its tooltip balloon is not overlapped by the next line of icons */
                whileHover={{ scale: 1.15, y: -3 }}
                whileTap={{ scale: 0.92 }}
                className={`vip-fade-up hover:z-10 group relative flex items-center justify-center ${social.id === "website" ? "w-full md:w-auto" : ""}`}
                style={{ animationDelay: `${1.2 + idx * 0.08}s` }}
                aria-label={social.label}
              >
                <div
                  className={`relative rounded-2xl flex items-center justify-center transition-all duration-300 overflow-hidden ${social.id === "website" ? "w-full h-12 md:w-12 md:h-12" : "w-11 h-11 md:w-12 md:h-12"}`}
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 30%, transparent)",
                    border: `1.5px solid color-mix(in srgb, ${social.color} 40%, transparent)`,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    ...(social.featured === "gold" ? { animation: "vip-gold-pulse 2.4s ease-in-out infinite" } : social.featured === "electric" ? { animation: "vip-electric-glow 5s linear infinite" } : {}),
                  }}
                >
                  {social.featured === "gold" && (
                    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                      <span className="absolute top-0 left-0 w-1/2 h-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.85) 50%, transparent)", animation: "vip-gold-blic 2s ease-in-out infinite" }} />
                    </span>
                  )}
                  {social.featured === "electric" && (
                    <>
                      {/* Rotating arc ring — chaotic electric current around border */}
                      <span className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: "conic-gradient(from 0deg, transparent 0%, rgba(34,211,238,0.6) 8%, transparent 16%, transparent 40%, rgba(34,211,238,0.4) 48%, transparent 56%, transparent 70%, rgba(34,211,238,0.7) 78%, transparent 86%)", animation: "vip-electric-arc 5s linear infinite", maskImage: "radial-gradient(circle, transparent 62%, black 64%, black 100%)", WebkitMaskImage: "radial-gradient(circle, transparent 62%, black 64%, black 100%)" }} />
                      {/* Inner spark flicker — chaotic opacity + scale */}
                      <span className="pointer-events-none absolute inset-1 rounded-2xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%)", animation: "vip-electric-spark 5s ease-in-out infinite" }} />
                    </>
                  )}
                  <div className="relative transition-all duration-300 group-hover:scale-110 flex items-center gap-2" style={{ color: social.color }}>
                    {social.icon}
                    {social.id === "website" && (
                      <span className="md:hidden text-sm font-bold whitespace-nowrap" style={{ color: social.color }}>
                        {social.label} — vip-bike.ru
                      </span>
                    )}
                  </div>
                </div>
                {/* Tooltip label on hover */}
                <span
                  className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none px-2 py-1 rounded-md"
                  style={{ backgroundColor: social.color, color: "#fff" }}
                >
                  {social.label}
                </span>
              </motion.a>
            ))}
          </div>
        </div>


      </motion.div>

      {/* Scroll indicator */}
      <div className="vip-fade-up absolute bottom-4 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-1" style={{ animationDelay: "2.2s", color: "var(--vip-text-secondary)" }}>
        <span className="text-[10px] uppercase tracking-widest opacity-60">Листай</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </motion.div>
      </div>
    </section>
  );
}

/* ══ CINEMATIC FINALE SECTION — Tesla-style scroll-snap with shared parallax background ══
   Wraps Final CTA + Footer as ONE full-screen section. Background image has smooth
   y-only parallax (no scale = no jitter), content slides up into place.
   On mobile: background is hidden (footer gets its own 100vh picture bg instead). */
function CinematicFinaleSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // Background parallax: smooth y-only movement (NO scale — scale causes jitter)
  const bgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  // Content slide-in: starts offset down, slides up as section enters viewport
  const contentY = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], ["40px", "0px", "0px", "-20px"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0.4, 1, 1, 0.6]);

  return (
    <div ref={ref} className="vip-snap-section relative min-h-screen overflow-hidden">
      {/* Shared parallax background image — y-only, no scale (prevents jitter).
          Hidden on mobile (footer gets its own 100vh picture bg on mobile). */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 z-0 hidden md:block">
        <img
          src={DUO_SECTION_BG}
          alt=""
          className="w-full h-full object-cover"
          style={{ minHeight: "120%" }}
          loading="lazy"
          aria-hidden
        />
        {/* Theme-adaptive overlay for text readability */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--vip-bg-base) 92%, transparent) 0%, color-mix(in srgb, var(--vip-bg-base) 85%, transparent) 40%, color-mix(in srgb, var(--vip-bg-base) 95%, transparent) 100%)" }} />
        {/* Accent glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.06 }} />
      </motion.div>
      {/* Content layer — slides up as section enters viewport */}
      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative z-10">
        {children}
      </motion.div>
    </div>
  );
}

/* ══ Reusable section header (badge + heading + subtitle) ══ */
function SectionHeader({ badge, title, highlight, subtitle }: { badge: string; title: string; highlight: string; subtitle?: string }) {
  return (
    <AnimatedSection className="text-center mb-16">
      <Badge variant="outline" className="mb-4" style={{ borderColor: "var(--vip-accent-main)", color: "var(--vip-accent-main)", backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)" }}>{badge}</Badge>
      <h3 className="text-3xl md:text-5xl font-black mb-4 tracking-tight" style={{ color: "var(--vip-text-primary)" }}>{title} <GradientText>{highlight}</GradientText></h3>
      {subtitle && <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>{subtitle}</p>}
    </AnimatedSection>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ════════════════════════════════════════════════════════════ */
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { label: "Каталог", href: "#catalog" },
    { label: "Тарифы", href: "#pricing" }, { label: "Как это работает", href: "#how" },
    { label: "FAQ", href: "#faq" }, { label: "Контакты", href: "#contacts" },
  ];

  return (
    <>
      <VipBikeThemeStyles />
      <ScrollProgressBar />
      <MouseFollowGlow />
      {/* Mobile safe-area top padding for Telegram WebApp native buttons */}
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--vip-bg-base)", paddingTop: "env(safe-area-inset-top, 0px)" }}>
        {/* Mobile-only spacer for Telegram native close/back buttons row */}
        <div className="h-9 md:hidden" aria-hidden="true" />
        <FloatingSocialBar />

        {/* ─── HEADER ─── */}
        <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "color-mix(in srgb, var(--vip-bg-base) 80%, transparent)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Desktop: logo on left + nav on right */}
            <div className="hidden md:flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-electro-neon.png"
                data-light-src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/1000033868-a2e57b7e-5ed8-4440-9304-f3f54f63cc46.jpg"
                alt="VIP BIKE"
                className="w-10 h-10 rounded-full object-cover footer-logo-img"
                style={{ border: "none" }}
              />
              <div>
                <h1 className="font-bold text-lg leading-tight" style={{ color: "var(--vip-text-primary)" }}>VIP BIKE</h1>
                <p className="text-[10px] leading-tight hidden sm:block" style={{ color: "var(--vip-text-secondary)" }}>Аренда мотоциклов в Нижнем</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              {navLinks.map((link) => (<a key={link.href} href={link.href} className="transition-colors duration-200 hover:opacity-80" style={{ color: "var(--vip-text-secondary)" }}>{link.label}</a>))}
              <ThemeToggleButton size="md" className="h-11 w-11" />
              <MagneticButton href={CATALOG_HREF} primary size="sm">Забронировать</MagneticButton>
            </nav>
            {/* Mobile: title + theme + hamburger grouped and centered together */}
            <div className="md:hidden flex items-center gap-2 mx-auto">
              <h1 className="font-bold text-lg leading-tight" style={{ color: "var(--vip-text-primary)" }}>VIP BIKE</h1>
              <ThemeToggleButton size="sm" className="h-11 w-11" />
              <button className="min-h-11 min-w-11 p-2" style={{ color: "var(--vip-text-primary)" }} onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{menuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</svg>
              </button>
            </div>
          </div>
          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden border-t overflow-hidden" style={{ borderColor: "var(--vip-border-soft)" }}>
                <div className="px-4 py-4 flex flex-col gap-3">
                  {navLinks.map((link) => (<a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="py-2 transition-colors" style={{ color: "var(--vip-text-secondary)" }}>{link.label}</a>))}
                  <a href={CATALOG_HREF} onClick={() => setMenuOpen(false)}>
                    <Button className="w-full rounded-full font-semibold" style={{ backgroundColor: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}>Забронировать</Button>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="flex-1 vip-snap-container">
          <CinematicHero />

          {/* ─── BIKE TIERS SHOWCASE (merged — pictures + full info from BikeTierCard) ─── */}
          <section id="catalog" className="py-20 md:py-28 px-4">
            <div className="max-w-7xl mx-auto">
              <SectionHeader badge="Каталог байков" title="Электро, бензин" highlight="или помощь с выбором" subtitle="Два отдельных каталога без смешения запросов. Выбирай по типу техники, опыту и датам." />
              <div className="grid md:grid-cols-3 gap-6">
                {/* Beginner */}
                <AnimatedSection delay={0}>
                  <Card className="relative z-10 aspect-[9/21] overflow-hidden group transition-all duration-500 hover:-translate-y-2 hover:shadow-xl" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "color-mix(in srgb, #22C55E 40%, var(--vip-border-soft))" }}>
                    <div className="absolute top-0 left-0 w-full overflow-hidden z-0" style={{ height: "76%" }}>
                      <HeroImageCarousel images={ELECTRIC_BIKE_IMAGES} alt="Электромотоциклы VIP Bike" loading="lazy" intervalMs={5000} />
                      <div className="absolute inset-0 pointer-events-none z-10" style={{ background: "linear-gradient(to bottom, transparent 30%, var(--vip-bg-card) 85%)" }} />
                    </div>
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold z-20" style={{ backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)", backdropFilter: "blur(8px)" }}>от 5 000 ₽/сутки</div>
                    <CardContent className="absolute bottom-0 left-0 right-0 p-5 md:p-6 z-30" style={{ backgroundColor: "transparent" }}>
                      <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "#22C55E" }}>Каталог 01</div>
                      <h4 className="text-xl font-black mb-1" style={{ color: "var(--vip-text-primary)" }}>Электро</h4>
                      <p className="text-sm font-semibold mb-2" style={{ color: "#22C55E" }}>Электромотоциклы в аренду</p>
                      <p className="text-sm mb-3" style={{ color: "var(--vip-text-secondary)" }}>Подтверждённые суточные тарифы — от 5 000 до 12 000 ₽. Требования к категории зависят от конкретной модели.</p>
                      <div className="flex items-start gap-2 p-2 rounded-lg mb-3 text-xs font-medium" style={{ backgroundColor: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.2)", color: "var(--vip-text-primary)" }}>
                        <LicenseIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Менеджер проверит документы и доступность до брони</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {ELECTRIC_BIKE_NAMES.map(b => (
                          <span key={b} className="px-2.5 py-1 rounded-lg text-xs" style={{ backgroundColor: "rgba(34, 197, 94, 0.08)", color: "#22c55e" }}>{b}</span>
                        ))}
                      </div>
                      <MagneticButton href={ELECTRIC_CATALOG_HREF} primary className="w-full">Выбрать электро</MagneticButton>
                    </CardContent>
                  </Card>
                </AnimatedSection>

                {/* Intermediate */}
                <AnimatedSection delay={0.15}>
                  <Card className="relative z-10 aspect-[9/21] overflow-hidden group transition-all duration-500 hover:-translate-y-2 hover:shadow-xl" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "color-mix(in srgb, #F59E0B 40%, var(--vip-border-soft))" }}>
                    <div className="absolute top-0 left-0 w-full overflow-hidden z-0" style={{ height: "76%" }}>
                      <HeroImageCarousel images={PETROL_BIKE_IMAGES} alt="Бензиновые мотоциклы VIP Bike" loading="lazy" intervalMs={5400} />
                      <div className="absolute inset-0 pointer-events-none z-10" style={{ background: "linear-gradient(to bottom, transparent 30%, var(--vip-bg-card) 85%)" }} />
                    </div>
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold z-20" style={{ backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)", backdropFilter: "blur(8px)" }}>от 4 000 ₽/сутки</div>
                    <CardContent className="absolute bottom-0 left-0 right-0 p-5 md:p-6 z-30" style={{ backgroundColor: "transparent" }}>
                      <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "#F59E0B" }}>Каталог 02</div>
                      <h4 className="text-xl font-black mb-1" style={{ color: "var(--vip-text-primary)" }}>Бензин</h4>
                      <p className="text-sm font-semibold mb-2" style={{ color: "#F59E0B" }}>Мотоциклы с ДВС</p>
                      <p className="text-sm mb-3" style={{ color: "var(--vip-text-secondary)" }}>Подтверждённые суточные тарифы — от 4 000 до 14 000 ₽. Для аренды обязательна категория А.</p>
                      <div className="flex items-start gap-2 p-2 rounded-lg mb-3 text-xs font-medium" style={{ backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", color: "var(--vip-text-primary)" }}>
                        <LicenseIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Паспорт, водительское удостоверение и категория А</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {PETROL_BIKE_NAMES.map(b => (
                          <span key={b} className="px-2.5 py-1 rounded-lg text-xs" style={{ backgroundColor: "rgba(245, 158, 11, 0.08)", color: "#f59e0b" }}>{b}</span>
                        ))}
                      </div>
                      <MagneticButton href={PETROL_CATALOG_HREF} className="w-full">Выбрать бензин</MagneticButton>
                    </CardContent>
                  </Card>
                </AnimatedSection>

                {/* Pro */}
                <AnimatedSection delay={0.3}>
                  <Card className="relative z-10 aspect-[9/21] overflow-hidden group transition-all duration-500 hover:-translate-y-2 hover:shadow-xl" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "color-mix(in srgb, #EF4444 40%, var(--vip-border-soft))" }}>
                    <div className="absolute top-0 left-0 w-full overflow-hidden z-0" style={{ height: "76%" }}>
                      <HeroImageCarousel images={SHOWSTOPPER_BIKE_IMAGES} alt="Самые эффектные мотоциклы VIP Bike" loading="lazy" intervalMs={5800} />
                      <div className="absolute inset-0 pointer-events-none z-10" style={{ background: "linear-gradient(to bottom, transparent 30%, var(--vip-bg-card) 85%)" }} />
                    </div>
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold z-20" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", backdropFilter: "blur(8px)" }}>Помощь менеджера</div>
                    <CardContent className="absolute bottom-0 left-0 right-0 p-5 md:p-6 z-30" style={{ backgroundColor: "transparent" }}>
                      <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "#EF4444" }}>Подбор 03</div>
                      <h4 className="text-xl font-black mb-1" style={{ color: "var(--vip-text-primary)" }}>Не определился?</h4>
                      <p className="text-sm font-semibold mb-2" style={{ color: "#EF4444" }}>Подберём модель под задачу</p>
                      <p className="text-sm mb-3" style={{ color: "var(--vip-text-secondary)" }}>Напиши, какой у тебя опыт, маршрут и даты. Менеджер проверит парк и предложит подходящие варианты.</p>
                      <div className="flex items-start gap-2 p-2 rounded-lg mb-3 text-xs font-medium" style={{ backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--vip-text-primary)" }}>
                        <LicenseIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Все условия подтвердим до бронирования</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {SHOWSTOPPER_BIKE_NAMES.map(b => (
                          <span key={b} className="px-2.5 py-1 rounded-lg text-xs" style={{ backgroundColor: "rgba(239, 68, 68, 0.08)", color: "#ef4444" }}>{b}</span>
                        ))}
                      </div>
                      <MagneticButton href={OPERATOR_HREF} className="w-full">Написать менеджеру</MagneticButton>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              </div>
              <AnimatedSection delay={0.4} className="text-center mt-12">
                <p className="mx-auto flex max-w-2xl items-start justify-center gap-1.5 text-sm" style={{ color: "var(--vip-text-secondary)" }}><InfoIcon className="mt-0.5 h-4 w-4 shrink-0" /> <span>Не знаешь, какой выбрать? Напиши оператору{" "}<a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>@I_O_S_NN</a>{" "}— подберём под твой опыт и задачи.</span></p>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section id="how" className="py-20 md:py-28 px-4 relative overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 40%, transparent)" }}>
            <div className="max-w-6xl mx-auto relative z-10">
              <SectionHeader badge="Как это работает" title="Выбери. Оставь заявку." highlight="Получи подтверждение." subtitle="Менеджер проверит модель и даты, затем сообщит условия аренды." />
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                {/* Connector line: behind steps. Steps have opaque bg to hide line where they overlap. */}
                <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 z-0 pointer-events-none" style={{ background: "linear-gradient(to right, transparent, var(--vip-accent-main), transparent)", opacity: 0.3 }} />
                {HOW_IT_WORKS_STEPS.map((step, idx) => (
                  <AnimatedSection key={step.n} delay={idx * 0.15} className="relative z-10">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative w-24 h-24 rounded-full flex items-center justify-center mb-5 transition-transform duration-300 hover:scale-110" style={{ backgroundColor: "var(--vip-bg-card)", backgroundImage: "linear-gradient(135deg, color-mix(in srgb, var(--vip-accent-main) 20%, transparent), color-mix(in srgb, var(--vip-accent-main) 5%, transparent))", border: "2px solid color-mix(in srgb, var(--vip-accent-main) 40%, transparent)", color: "var(--vip-accent-main)" }}>
                        {step.icon}
                        <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black" style={{ background: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}>{step.n}</span>
                      </div>
                      <h4 className="text-lg font-bold mb-2" style={{ color: "var(--vip-text-primary)" }}>{step.title}</h4>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>{step.desc}</p>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
              <AnimatedSection delay={0.6} className="text-center mt-14">
                <MagneticButton href={BOT_HREF} primary>Погнали в бот<ArrowRight /></MagneticButton>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── PRICING ─── */}
          <section id="pricing" className="py-20 md:py-28 px-4">
            <div className="max-w-6xl mx-auto">
              <SectionHeader badge="Тарифы" title="Подтверждённые цены" highlight="за сутки" subtitle="Показываем только тарифы из актуального прайса. Дополнительные условия сообщает менеджер." />
              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {PRICING_TIERS.map((tier, idx) => (<PricingCard key={tier.id} tier={tier} index={idx} />))}
              </div>
              <AnimatedSection delay={0.5} className="text-center mt-10">
                <p className="flex items-start justify-center gap-1.5 text-sm" style={{ color: "var(--vip-text-secondary)" }}><InfoIcon className="mt-0.5 h-4 w-4 shrink-0" /> <span>Не нашёл подходящий тариф? Напиши оператору{" "}<a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>@I_O_S_NN</a>{" "}— соберём индивидуальный пакет.</span></p>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── ABOUT ─── */}
          <section id="about" className="py-20 md:py-28 px-4" style={{ backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 40%, transparent)" }}>
            <div className="max-w-7xl mx-auto">
              <SectionHeader badge="О нас" title="VIP Bike —" highlight="аренда мотоциклов в Нижнем" subtitle="Электро и бензин с раздельным выбором и подтверждением условий." />
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Заявка онлайн", desc: "Выбирай модель и даты в каталоге или Telegram-боте" },
                  { title: "Раздельный каталог", desc: "Электро и бензин не смешиваются в рекламных сценариях" },
                  { title: "Условия до брони", desc: "Менеджер подтверждает доступность и дополнительные условия заранее" },
                  { title: "Центр Нижнего", desc: "пл. Комсомольская 2 — удобно добираться из любой точки города" },
                ].map((feature, idx) => (
                  <AnimatedSection key={feature.title} delay={idx * 0.1}>
                    <div className="relative z-10 p-6 rounded-2xl border text-center transition-all duration-300 group h-full hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                      <h4 className="text-lg font-bold mb-2" style={{ color: "var(--vip-text-primary)" }}>{feature.title}</h4>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>{feature.desc}</p>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section id="faq" className="py-20 md:py-28 px-4">
            <div className="max-w-3xl mx-auto">
              <SectionHeader badge="FAQ" title="Вопросы, которые" highlight="задают всегда" />
              <p className="text-lg text-center -mt-10 mb-12" style={{ color: "var(--vip-text-secondary)" }}>Коротко, честно, без воды. Если чего-то нет — пиши в{" "}<a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>@I_O_S_NN</a>.</p>
              <div className="space-y-3">
                {FAQ_ITEMS.map((item, idx) => (<FaqItem key={idx} item={item} index={idx} />))}
              </div>
            </div>
          </section>

          {/* ─── CONTACTS ─── */}
          <section id="contacts" className="py-20 md:py-28 px-4" style={{ backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 40%, transparent)" }}>
            <div className="max-w-4xl mx-auto">
              <SectionHeader badge="Контакты" title="Свяжись" highlight="с нами" subtitle="Всегда на связи — выбирай удобный способ" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatedSection>
                  <a href={CONTACT_INFO.phoneHref} className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-2xl border transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--vip-accent-main) 20%, transparent)" }}>
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-6 h-6" style={{ stroke: "var(--vip-accent-main)" }}><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>{CONTACT_INFO.phone}</p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Позвонить</p>
                    </div>
                  </a>
                </AnimatedSection>
                <AnimatedSection delay={0.1}>
                  <a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-2xl border transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: "color-mix(in srgb, #26A5E4 10%, transparent)", border: "1px solid color-mix(in srgb, #26A5E4 20%, transparent)" }}>
                      <svg viewBox="0 0 24 24" fill="#26A5E4" className="w-6 h-6"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>@I_O_S_NN</p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Telegram оператор</p>
                    </div>
                  </a>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                  <div className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-2xl border sm:col-span-2 lg:col-span-1" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--vip-accent-main) 20%, transparent)" }}>
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-6 h-6" style={{ stroke: "var(--vip-accent-main)" }}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>{CONTACT_INFO.address}</p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>{CONTACT_INFO.workingHours}</p>
                    </div>
                  </div>
                </AnimatedSection>
              </div>
            </div>
          </section>

          {/* ══ PARTNERS SECTION — strong accent-tinted background, logos not inverted ══ */}
          <section id="partners" className="py-20 md:py-28 px-4" style={{ backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 25%, var(--vip-bg-base))" }}>
            <div className="max-w-6xl mx-auto">
              <SectionHeader badge="Партнёры" title="Друзья и" highlight="партнёры" subtitle="Магазины, академия и сообщество — вместе мы делаем мото-сцену Нижнего сильнее." />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { name: "moto-selection.ru", href: "https://moto-selection.ru/", logo: "https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png", desc: "Мото-экипировка и аксессуары", darkLogo: true },
                  { name: "bikeland.ru", href: "https://bikeland.ru/", logo: "https://bikeland.ru/local/templates/2019/svg/logo.svg", desc: "Сообщество и магазин", darkLogo: false },
                  { name: "academy.cr", href: "https://academy.cr/", logo: "https://academy.cr/themes/academy/dist/img/icons/logo.svg", desc: "Мото-школа и тренировки", darkLogo: true },
                ].map((partner, idx) => (
                  <AnimatedSection key={partner.name} delay={idx * 0.1}>
                    <a
                      href={partner.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 group flex flex-col items-center gap-4 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 h-full cursor-pointer"
                      style={{ backgroundColor: "transparent" }}
                    >
                      <div
                        className="relative w-full flex items-center justify-center py-6 transition-all duration-300 group-hover:scale-[1.03]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={partner.logo}
                          alt={`Логотип ${partner.name}`}
                          className="w-full max-w-[200px] h-auto object-contain"
                          style={{
                            filter: "var(--partner-logo-filter, none)",
                            opacity: 0.9,
                          }}
                          loading="lazy"
                        />
                      </div>
                      <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <h4 className="text-lg font-bold mb-1 transition-colors duration-300" style={{ color: "var(--vip-text-primary)" }}>{partner.name}</h4>
                        <p className="text-sm" style={{ color: "var(--vip-text-secondary)" }}>{partner.desc}</p>
                      </div>
                    </a>
                  </AnimatedSection>
                ))}
              </div>
              <AnimatedSection delay={0.4} className="text-center mt-10">
                <p className="text-sm" style={{ color: "var(--vip-text-secondary)" }}>Хочешь стать партнёром? Напиши оператору{" "}<a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>@I_O_S_NN</a>{" "}— обсудим.</p>
              </AnimatedSection>
            </div>
          </section>

          {/* ══ CINEMATIC FINALE — Final CTA + Footer merged into ONE full-screen section ══ */}
          <CinematicFinaleSection>
          {/* ─── FINAL CTA ─── */}
          <section className="py-24 md:py-32 px-4 relative">
            <div className="max-w-4xl mx-auto text-center relative z-10">
              <AnimatedSection>
                <Badge variant="outline" className="mb-6" style={{ borderColor: "var(--vip-accent-main)", color: "var(--vip-accent-main)", backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)" }}>Готов к выезду?</Badge>
                <h3 className="text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tight" style={{ color: "var(--vip-text-primary)" }}>Начни свой <GradientText>путь</GradientText> сегодня</h3>
                <p className="text-xl max-w-2xl mx-auto mb-10" style={{ color: "var(--vip-text-secondary)" }}>Выбери тип техники и модель, укажи даты — менеджер подтвердит доступность и условия.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <MagneticButton href={CATALOG_HREF} primary>Выбрать байк<ArrowRight /></MagneticButton>
                  <MagneticButton href={OPERATOR_HREF}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2 inline"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                    Написать оператору
                  </MagneticButton>
                </div>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── FOOTER (inside cinematic finale; mobile gets own 100vh picture bg) ─── */}
          <footer className="relative border-t mt-auto min-h-[calc(100vh-4rem)] md:min-h-0 overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--vip-accent-main) 20%, var(--vip-border-soft))" }}>
          {/* Mobile-only picture background for footer (100vh) */}
          <div className="absolute inset-0 z-0 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DUO_SECTION_BG}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              aria-hidden
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--vip-bg-base) 90%, transparent) 0%, color-mix(in srgb, var(--vip-bg-base) 85%, transparent) 50%, color-mix(in srgb, var(--vip-bg-base) 95%, transparent) 100%)" }} />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              {/* Brand + tagline + contact */}
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-electro-neon.png"
                    data-light-src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/1000033868-a2e57b7e-5ed8-4440-9304-f3f54f63cc46.jpg"
                    alt="VIP BIKE"
                    className="w-12 h-12 rounded-full object-cover footer-logo-img"
                    style={{ border: "none" }}
                  />
                  <div>
                    <h4 className="font-black text-xl leading-tight" style={{ color: "var(--vip-text-primary)" }}>VIP BIKE</h4>
                    <p className="text-xs" style={{ color: "var(--vip-text-secondary)" }}>Аренда мотоциклов</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--vip-text-secondary)" }}>Аренда мотоциклов в Нижнем Новгороде. Электро и ДВС.</p>
                <div className="space-y-2 text-sm" style={{ color: "var(--vip-text-secondary)" }}>
                  <a href={CONTACT_INFO.phoneHref} className="flex items-center gap-2 transition-colors hover:opacity-80">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0" style={{ stroke: "var(--vip-accent-main)" }}><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {CONTACT_INFO.phone}
                  </a>
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0" style={{ stroke: "var(--vip-accent-main)" }}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {CONTACT_INFO.address}
                  </div>
                </div>
              </div>
              {/* Quick links */}
              <div>
                <h5 className="font-bold mb-4 uppercase text-xs tracking-widest" style={{ color: "var(--vip-text-secondary)" }}>Навигация</h5>
                <ul className="space-y-3">
                  {[
                    { label: "Каталог", href: CATALOG_HREF, external: false },
                    { label: "Telegram бот", href: BOT_HREF, external: true },
                    { label: "Тарифы", href: "#pricing", external: false },
                    { label: "FAQ", href: "#faq", external: false },
                    { label: "Контакты", href: "#contacts", external: false },
                  ].map((link) => (
                    <li key={link.href}>
                      <a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined} className="text-sm transition-all duration-200 hover:translate-x-1 inline-block" style={{ color: "var(--vip-text-primary)" }}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Social links as circle row */}
              <div className="sm:col-span-2 lg:col-span-1">
                <h5 className="font-bold mb-4 uppercase text-xs tracking-widest" style={{ color: "var(--vip-text-secondary)" }}>Мы в соцсетях</h5>
                <div className="flex flex-wrap gap-2 md:gap-3 md:flex-nowrap justify-center md:justify-start">
                  {SOCIAL_LINKS.map((social) => (
                    <a key={social.id} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} title={social.label} className={`group relative ${social.id === "website" ? "w-full h-12 md:w-12 md:h-12" : "w-11 h-11"} md:rounded-full rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-1 flex-shrink-0`} style={{ backgroundColor: `color-mix(in srgb, ${social.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${social.color} 30%, transparent)`, ...(social.featured === "gold" ? { animation: "vip-gold-pulse 2.4s ease-in-out infinite" } : social.featured === "electric" ? { animation: "vip-electric-glow 5s linear infinite" } : {}) }}>
                      {social.featured === "gold" && (
                        <span className="pointer-events-none absolute inset-0 overflow-hidden md:rounded-full rounded-xl">
                          <span className="absolute top-0 left-0 w-1/2 h-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.85) 50%, transparent)", animation: "vip-gold-blic 2s ease-in-out infinite" }} />
                        </span>
                      )}
                      {social.featured === "electric" && (
                        <>
                          <span className="pointer-events-none absolute inset-0 md:rounded-full rounded-xl" style={{ background: "conic-gradient(from 0deg, transparent 0%, rgba(34,211,238,0.6) 8%, transparent 16%, transparent 40%, rgba(34,211,238,0.4) 48%, transparent 56%, transparent 70%, rgba(34,211,238,0.7) 78%, transparent 86%)", animation: "vip-electric-arc 5s linear infinite", maskImage: "radial-gradient(circle, transparent 62%, black 64%, black 100%)", WebkitMaskImage: "radial-gradient(circle, transparent 62%, black 64%, black 100%)" }} />
                          <span className="pointer-events-none absolute inset-1 md:rounded-full rounded-xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%)", animation: "vip-electric-spark 5s ease-in-out infinite" }} />
                        </>
                      )}
                      <div className="relative transition-colors duration-300 flex items-center gap-2" style={{ color: social.color }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-4 md:h-4">{social.icon.props.children}</svg>
                        {social.id === "website" && (
                          <span className="md:hidden text-sm font-bold whitespace-nowrap" style={{ color: social.color }}>
                            {social.label} — vip-bike.ru
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "color-mix(in srgb, var(--vip-accent-main) 15%, var(--vip-border-soft))" }}>
              <p className="text-xs" style={{ color: "var(--vip-text-secondary)" }}>&copy; {new Date().getFullYear()} VIP BIKE — аренда мотоциклов в Нижнем Новгороде</p>
              <span className="text-xs" style={{ color: "var(--vip-text-secondary)" }}>Приходи — садись — едь.</span>
            </div>
          </div>
        </footer>
          </CinematicFinaleSection>
        </main>
      </div>
    </>
  );
}
