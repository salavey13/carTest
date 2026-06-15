"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/* ────────────────────────────────────────────
   Social Links Configuration (from uploaded file)
   ──────────────────────────────────────────── */
const SOCIAL_LINKS = [
  {
    id: "vk",
    label: "VK Group",
    href: "https://vk.com/vip_bike",
    color: "#4C75A3",
    gradient: "from-[#4C75A3] to-[#2A5885]",
    hoverGlow: "rgba(76, 117, 163, 0.5)",
    description: "Подписывайтесь на группу",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.49 2.27 4.675 2.85 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.49c0 .373.17.508.271.508.22 0 .407-.135.813-.542 1.254-1.406 2.152-3.574 2.152-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.253.746.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/vipbikerental_nn",
    color: "#E4405F",
    gradient: "from-[#833AB4] via-[#E4405F] to-[#FCAF45]",
    hoverGlow: "rgba(228, 64, 95, 0.5)",
    description: "Фотографии и сторис",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    id: "telegram-bot",
    label: "Telegram Бот",
    href: "https://t.me/oneBikePlsBot",
    color: "#26A5E4",
    gradient: "from-[#26A5E4] to-[#1A8BC9]",
    hoverGlow: "rgba(38, 165, 228, 0.5)",
    description: "Забронируйте байк в боте",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: "telegram-contact",
    label: "@I_O_S_NN",
    href: "https://t.me/I_O_S_NN",
    color: "#26A5E4",
    gradient: "from-[#26A5E4] to-[#1A8BC9]",
    hoverGlow: "rgba(38, 165, 228, 0.5)",
    description: "Связь с оператором",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: "https://wa.me/79200789888",
    color: "#25D366",
    gradient: "from-[#25D366] to-[#128C7E]",
    hoverGlow: "rgba(37, 211, 102, 0.5)",
    description: "Напишите нам в WhatsApp",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

const CONTACT_INFO = {
  phone: "+7 9200-789-888",
  phoneHref: "tel:+79200789888",
  address: "Н. Н. пл. Комсомольская 2",
  workingHours: "10:00 — 22:00 (ежедневно)",
};

/* ────────────────────────────────────────────
   Barrier Cards Data
   ──────────────────────────────────────────── */
const BARRIER_CARDS = [
  {
    id: "prohodimost",
    number: "01",
    title: "Поле, лес, грязь, лестницы",
    description:
      "Кочки, корни, песок, снег, подъёмы и спуски. Куда сам доберёшься — туда и заедешь. В обзорах «корни съел как нефиг нафиг», едет по кроссовой трассе наравне с бензином.",
    image:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b1-prohodimost.jpeg",
  },
  {
    id: "razgon",
    number: "02",
    title: "Выстреливает из рогатки",
    description:
      "Электро-тяга бьёт мгновенно — без сцепления и передач. Проваливаешься в кресло как в суперкаре. Открутил ручку — и поехал, на максимум сразу.",
    image:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg",
  },
  {
    id: "voda",
    number: "03",
    title: "Топили в озере — едет",
    description:
      "Влагозащита по классу IP67. На тесте погружали в ледяное озеро — завёлся, год катается. Лужи, дождь, мокрая трава — без последствий.",
    image:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b3-voda.jpeg",
  },
];

/* ────────────────────────────────────────────
   Animated Section Wrapper
   ──────────────────────────────────────────── */
function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ────────────────────────────────────────────
   Social Card Component
   ──────────────────────────────────────────── */
function SocialCard({
  social,
  index,
}: {
  social: (typeof SOCIAL_LINKS)[0];
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col items-center gap-4 p-6 rounded-2xl border border-[#2A2E3E] bg-[#141828]/60 backdrop-blur-sm transition-all duration-500 hover:border-transparent cursor-pointer overflow-hidden"
      style={{
        boxShadow: isHovered
          ? `0 0 40px ${social.hoverGlow}, 0 8px 32px rgba(0,0,0,0.4)`
          : "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {/* Background gradient on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${social.gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-500`}
      />

      {/* Animated ring behind icon */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full animate-pulse-ring"
          style={{
            background: social.color,
            opacity: 0.15,
            transform: "scale(1.4)",
          }}
        />
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${social.color}22, ${social.color}44)`,
            border: `1px solid ${social.color}55`,
            boxShadow: isHovered
              ? `0 0 20px ${social.color}33`
              : "0 0 0px transparent",
          }}
        >
          <div
            className="transition-all duration-300"
            style={{
              color: isHovered ? social.color : "#E6D8C4",
              filter: isHovered ? `drop-shadow(0 0 8px ${social.color})` : "none",
            }}
          >
            {social.icon}
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-center relative z-10">
        <h3 className="font-bold text-lg text-[#E6D8C4] group-hover:text-white transition-colors duration-300">
          {social.label}
        </h3>
        <p className="text-sm text-[#A7ABB4] mt-1 group-hover:text-[#E6D8C4]/80 transition-colors duration-300">
          {social.description}
        </p>
      </div>

      {/* Arrow indicator */}
      <div
        className="flex items-center gap-1 text-xs font-medium transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
        style={{ color: social.color }}
      >
        <span>Перейти</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </motion.a>
  );
}

/* ────────────────────────────────────────────
   Floating Social Sidebar (desktop)
   ──────────────────────────────────────────── */
function FloatingSocialBar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -80, opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3"
        >
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.id}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
              style={{
                background: `${social.color}15`,
                border: `1px solid ${social.color}30`,
              }}
            >
              <div
                className="transition-all duration-300 group-hover:scale-110"
                style={{
                  color: social.color,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  {social.icon.props.children}
                </svg>
              </div>
              {/* Tooltip */}
              <div
                className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{
                  background: social.color,
                  color: "#fff",
                }}
              >
                {social.label}
              </div>
            </a>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ────────────────────────────────────────────
   Main Landing Page
   ──────────────────────────────────────────── */
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0E18]">
      <FloatingSocialBar />

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-40 border-b border-[#2A2E3E]/50 bg-[#0B0E18]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F4BD55] to-[#FFCA60] flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0B0E18"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M5 16v-4a8 8 0 0116 0v4" />
                <circle cx="8" cy="16" r="2" />
                <circle cx="16" cy="16" r="2" />
                <path d="M10 16h4" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg text-[#E6D8C4] leading-tight">
                VIP BIKE ELECTRO
              </h1>
              <p className="text-[10px] text-[#A7ABB4] leading-tight hidden sm:block">
                Электромотоциклы без категории А
              </p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {[
              { label: "Каталог", href: "#catalog" },
              { label: "О нас", href: "#about" },
              { label: "Контакты", href: "#contacts" },
              { label: "Соцсети", href: "#social" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[#A7ABB4] hover:text-[#F4BD55] transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://t.me/oneBikePlsBot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="sm"
                className="rounded-full bg-[#F4BD55] text-[#0B0E18] hover:bg-[#FFCA60] font-semibold"
              >
                Забронировать
              </Button>
            </a>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-[#E6D8C4] p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {menuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-[#2A2E3E]/50 overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-3">
                {[
                  { label: "Каталог", href: "#catalog" },
                  { label: "О нас", href: "#about" },
                  { label: "Контакты", href: "#contacts" },
                  { label: "Соцсети", href: "#social" },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="text-[#A7ABB4] hover:text-[#F4BD55] transition-colors py-2"
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href="https://t.me/oneBikePlsBot"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="w-full rounded-full bg-[#F4BD55] text-[#0B0E18] hover:bg-[#FFCA60] font-semibold">
                    Забронировать
                  </Button>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        {/* ─── HERO ─── */}
        <section className="relative py-20 md:py-32 px-4 overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#F4BD55]/5 blur-[120px]" />
            <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-[#26A5E4]/5 blur-[100px]" />
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge
                variant="outline"
                className="mb-6 border-[#F4BD55]/40 text-[#F4BD55] bg-[#F4BD55]/10"
              >
                Электромотоциклы в Нижнем Новгороде
              </Badge>
              <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold text-[#E6D8C4] mb-6 leading-tight">
                VIP BIKE{" "}
                <span className="bg-gradient-to-r from-[#F4BD55] via-[#FFCA60] to-[#F4BD55] bg-clip-text text-transparent animate-gradient-shift">
                  ELECTRO
                </span>
              </h2>
              <p className="text-lg md:text-xl text-[#A7ABB4] max-w-2xl mx-auto mb-8 leading-relaxed">
                Электромотоциклы без категории А. Законно, по правам категории
                B. Без ОСАГО и ПТС. Мощно, быстро, экологично.
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {[
                  { text: "Быстро", detail: "мощно, тихо, экологично" },
                  { text: "10 дней", detail: "на тест-драйв, деньги обратно" },
                  { text: "0 ₽", detail: "первичный взнос, рассрочка" },
                ].map((pill) => (
                  <div
                    key={pill.text}
                    className="px-4 py-2 rounded-full border border-[#2A2E3E] bg-[#141828]/60 text-sm"
                  >
                    <span className="text-[#F4BD55] font-semibold">
                      {pill.text}
                    </span>{" "}
                    <span className="text-[#A7ABB4]">{pill.detail}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://t.me/oneBikePlsBot"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="lg"
                    className="rounded-full bg-[#F4BD55] text-[#0B0E18] hover:bg-[#FFCA60] font-bold text-lg px-8 py-6 shadow-[0_10px_30px_rgba(244,189,85,0.3)] hover:shadow-[0_10px_40px_rgba(244,189,85,0.4)] transition-all hover:scale-105"
                  >
                    Выбрать байк
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="ml-2"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Button>
                </a>
                <a href="#contacts">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-[#F4BD55]/40 text-[#F4BD55] hover:bg-[#F4BD55]/10 font-bold text-lg px-8 py-6 transition-all"
                  >
                    Контакты
                  </Button>
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── BARRIER CARDS ─── */}
        <section id="catalog" className="py-20 md:py-28 px-4">
          <div className="max-w-7xl mx-auto">
            <AnimatedSection className="text-center mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-[#F4BD55]/40 text-[#F4BD55] bg-[#F4BD55]/10"
              >
                Почему VIP BIKE ELECTRO
              </Badge>
              <h3 className="text-3xl md:text-5xl font-bold text-[#E6D8C4] mb-4">
                Три барьера,{" "}
                <span className="text-[#F4BD55]">которые мы преодолели</span>
              </h3>
              <p className="text-[#A7ABB4] text-lg max-w-2xl mx-auto">
                Мы тестировали 79bike Falcon PRO в реальных условиях. Город,
                проселок, снег, грязь, лёд — где угодно. Без пинков, без
                failures.
              </p>
            </AnimatedSection>

            <div className="grid md:grid-cols-3 gap-6">
              {BARRIER_CARDS.map((card, idx) => (
                <AnimatedSection key={card.id} delay={idx * 0.15}>
                  <Card className="border-[#2A2E3E] bg-[#141828]/60 backdrop-blur-sm overflow-hidden group transition-all duration-500 hover:border-[#F4BD55]/30">
                    <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
                      <img
                        src={card.image}
                        alt={card.title}
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-[#F4BD55]/20 border border-[#F4BD55]/30 flex items-center justify-center backdrop-blur-sm">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#F4BD55"
                            strokeWidth="2"
                            className="w-5 h-5"
                          >
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                          </svg>
                        </div>
                        <span className="text-2xl font-bold text-white drop-shadow-lg">
                          {card.number}
                        </span>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <h4 className="text-xl font-bold text-[#E6D8C4] mb-3">
                        {card.title}
                      </h4>
                      <p className="text-sm text-[#A7ABB4] leading-relaxed">
                        {card.description}
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ─── ABOUT ─── */}
        <section
          id="about"
          className="py-20 md:py-28 px-4 bg-[#141828]/40"
        >
          <div className="max-w-7xl mx-auto">
            <AnimatedSection className="text-center mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-[#F4BD55]/40 text-[#F4BD55] bg-[#F4BD55]/10"
              >
                О нас
              </Badge>
              <h3 className="text-3xl md:text-5xl font-bold text-[#E6D8C4] mb-4">
                79bike Falcon PRO —{" "}
                <span className="text-[#F4BD55]">электро без категории А</span>
              </h3>
              <p className="text-[#A7ABB4] text-lg max-w-2xl mx-auto">
                От 310 000 ₽. Законно по правам категории B. Без ОСАГО и ПТС.
              </p>
            </AnimatedSection>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Быстрая онлайн-бронь",
                  desc: "Выбирайте байк, даты и формат поездки в пару кликов",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F4BD55"
                      strokeWidth="1.5"
                      className="w-8 h-8"
                    >
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  ),
                },
                {
                  title: "Электро без категории А",
                  desc: "Законно по правам категории B — никаких дополнительных требований",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F4BD55"
                      strokeWidth="1.5"
                      className="w-8 h-8"
                    >
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                },
                {
                  title: "ОСАГО не требуется",
                  desc: "Экономия на страховке и бюрократии — просто садись и поезжай",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F4BD55"
                      strokeWidth="1.5"
                      className="w-8 h-8"
                    >
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ),
                },
                {
                  title: "Новая локация",
                  desc: "пл. Комсомольская 2 — центр Нижнего Новгорода",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F4BD55"
                      strokeWidth="1.5"
                      className="w-8 h-8"
                    >
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                },
              ].map((feature, idx) => (
                <AnimatedSection key={feature.title} delay={idx * 0.1}>
                  <div className="p-6 rounded-2xl border border-[#2A2E3E] bg-[#0B0E18]/60 text-center hover:border-[#F4BD55]/30 transition-all duration-300 group h-full">
                    <div className="w-14 h-14 rounded-2xl bg-[#F4BD55]/10 border border-[#F4BD55]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h4 className="text-lg font-bold text-[#E6D8C4] mb-2">
                      {feature.title}
                    </h4>
                    <p className="text-sm text-[#A7ABB4] leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SOCIAL MEDIA SECTION ─── */}
        <section id="social" className="py-20 md:py-28 px-4 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#26A5E4]/5 blur-[120px]" />
            <div className="absolute top-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[#F4BD55]/5 blur-[100px]" />
          </div>

          <div className="max-w-5xl mx-auto relative z-10">
            <AnimatedSection className="text-center mb-14">
              <Badge
                variant="outline"
                className="mb-4 border-[#F4BD55]/40 text-[#F4BD55] bg-[#F4BD55]/10"
              >
                Мы в соцсетях
              </Badge>
              <h3 className="text-3xl md:text-5xl font-bold text-[#E6D8C4] mb-4">
                Подписывайтесь и{" "}
                <span className="text-[#F4BD55]">будьте на связи</span>
              </h3>
              <p className="text-[#A7ABB4] text-lg max-w-2xl mx-auto">
                Мы постоянно делимся новостями, фото с покатушек и
                эксклюзивными предложениями. Выбирайте удобную платформу — мы
                везде.
              </p>
            </AnimatedSection>

            {/* Social Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {SOCIAL_LINKS.map((social, idx) => (
                <SocialCard key={social.id} social={social} index={idx} />
              ))}
            </div>

            {/* Compact social bar for mobile */}
            <AnimatedSection delay={0.5} className="mt-12">
              <div className="flex flex-wrap justify-center gap-3">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#2A2E3E] bg-[#141828]/60 text-sm text-[#A7ABB4] hover:text-[#E6D8C4] hover:border-[#F4BD55]/30 transition-all duration-300"
                  >
                    <div style={{ color: social.color }} className="w-4 h-4">
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        {social.icon.props.children}
                      </svg>
                    </div>
                    {social.label}
                  </a>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ─── CONTACTS ─── */}
        <section
          id="contacts"
          className="py-20 md:py-28 px-4 bg-[#141828]/40"
        >
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="text-center mb-14">
              <Badge
                variant="outline"
                className="mb-4 border-[#F4BD55]/40 text-[#F4BD55] bg-[#F4BD55]/10"
              >
                Контакты
              </Badge>
              <h3 className="text-3xl md:text-5xl font-bold text-[#E6D8C4] mb-4">
                Свяжитесь{" "}
                <span className="text-[#F4BD55]">с нами</span>
              </h3>
              <p className="text-[#A7ABB4] text-lg max-w-xl mx-auto">
                Мы всегда на связи — выберите удобный способ
              </p>
            </AnimatedSection>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Phone */}
              <AnimatedSection>
                <a
                  href={CONTACT_INFO.phoneHref}
                  className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-[#2A2E3E] bg-[#0B0E18]/60 hover:border-[#F4BD55]/30 transition-all duration-300 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#F4BD55]/10 border border-[#F4BD55]/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F4BD55"
                      strokeWidth="1.5"
                      className="w-7 h-7"
                    >
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#E6D8C4]">
                      {CONTACT_INFO.phone}
                    </p>
                    <p className="text-sm text-[#A7ABB4] mt-1">Позвонить</p>
                  </div>
                </a>
              </AnimatedSection>

              {/* Telegram */}
              <AnimatedSection delay={0.1}>
                <a
                  href="https://t.me/I_O_S_NN"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-[#2A2E3E] bg-[#0B0E18]/60 hover:border-[#26A5E4]/30 transition-all duration-300 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#26A5E4]/10 border border-[#26A5E4]/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg
                      viewBox="0 0 24 24"
                      fill="#26A5E4"
                      className="w-7 h-7"
                    >
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#E6D8C4]">
                      @I_O_S_NN
                    </p>
                    <p className="text-sm text-[#A7ABB4] mt-1">Telegram</p>
                  </div>
                </a>
              </AnimatedSection>

              {/* Address */}
              <AnimatedSection delay={0.2}>
                <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-[#2A2E3E] bg-[#0B0E18]/60 sm:col-span-2 lg:col-span-1">
                  <div className="w-14 h-14 rounded-2xl bg-[#F4BD55]/10 border border-[#F4BD55]/20 flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F4BD55"
                      strokeWidth="1.5"
                      className="w-7 h-7"
                    >
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#E6D8C4]">
                      {CONTACT_INFO.address}
                    </p>
                    <p className="text-sm text-[#A7ABB4] mt-1">
                      {CONTACT_INFO.workingHours}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-24 md:py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0B0E18] via-[#0B0E18]/50 to-[#0B0E18]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-[#F4BD55]/5 blur-[150px]" />
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <AnimatedSection>
              <Badge
                variant="outline"
                className="mb-6 border-[#F4BD55]/40 text-[#F4BD55] bg-[#F4BD55]/10"
              >
                Готовы к выезду?
              </Badge>
              <h3 className="text-4xl md:text-6xl font-bold text-[#E6D8C4] mb-6">
                Начни свой{" "}
                <span className="bg-gradient-to-r from-[#F4BD55] via-[#FFCA60] to-[#F4BD55] bg-clip-text text-transparent">
                  электро-путь
                </span>{" "}
                сегодня
              </h3>
              <p className="text-xl text-[#A7ABB4] max-w-2xl mx-auto mb-10">
                Выберите свой электромотоцикл, забронируйте слот и получите
                незабываемые впечатления. Законно, безопасно, экологично.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://t.me/oneBikePlsBot"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="lg"
                    className="rounded-full bg-[#F4BD55] text-[#0B0E18] hover:bg-[#FFCA60] font-bold text-lg px-10 py-6 shadow-[0_10px_30px_rgba(244,189,85,0.3)] transition-all hover:scale-105"
                  >
                    Выбрать байк
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="ml-2"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Button>
                </a>
                <a
                  href="https://t.me/I_O_S_NN"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-[#F4BD55]/40 text-[#F4BD55] hover:bg-[#F4BD55]/10 font-bold text-lg px-10 py-6 transition-all"
                  >
                    Написать оператору
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="ml-2"
                    >
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </Button>
                </a>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[#2A2E3E]/50 bg-[#0B0E18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F4BD55] to-[#FFCA60] flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0B0E18"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                  >
                    <path d="M5 16v-4a8 8 0 0116 0v4" />
                    <circle cx="8" cy="16" r="2" />
                    <circle cx="16" cy="16" r="2" />
                    <path d="M10 16h4" />
                  </svg>
                </div>
                <span className="font-bold text-lg text-[#E6D8C4]">
                  VIP BIKE ELECTRO
                </span>
              </div>
              <p className="text-sm text-[#A7ABB4] leading-relaxed">
                Электромотоциклы в Нижнем Новгороде. 79bike: мощно, быстро,
                законно, без ОСАГО.
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h4 className="font-bold text-[#E6D8C4] mb-4">Разделы</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Каталог", href: "#catalog" },
                  { label: "О нас", href: "#about" },
                  { label: "Соцсети", href: "#social" },
                  { label: "Контакты", href: "#contacts" },
                ].map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-[#A7ABB4] hover:text-[#F4BD55] transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-bold text-[#E6D8C4] mb-4">Соцсети</h4>
              <div className="space-y-3">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-[#A7ABB4] hover:text-[#E6D8C4] transition-colors duration-200 group"
                  >
                    <div
                      className="w-5 h-5 transition-colors duration-200"
                      style={{ color: social.color }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        {social.icon.props.children}
                      </svg>
                    </div>
                    {social.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-[#E6D8C4] mb-4">Связь</h4>
              <div className="space-y-3">
                <a
                  href="https://t.me/I_O_S_NN"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-[#A7ABB4] hover:text-[#26A5E4] transition-colors duration-200"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="#26A5E4"
                    className="w-4 h-4"
                  >
                    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  @I_O_S_NN
                </a>
                <a
                  href={CONTACT_INFO.phoneHref}
                  className="flex items-center gap-2.5 text-sm text-[#A7ABB4] hover:text-[#F4BD55] transition-colors duration-200"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F4BD55"
                    strokeWidth="1.5"
                    className="w-4 h-4"
                  >
                    <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {CONTACT_INFO.phone}
                </a>
                <div className="flex items-center gap-2.5 text-sm text-[#A7ABB4]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F4BD55"
                    strokeWidth="1.5"
                    className="w-4 h-4"
                  >
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {CONTACT_INFO.address}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-[#2A2E3E]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#A7ABB4]">
              &copy; {new Date().getFullYear()} VIP BIKE ELECTRO
            </p>
            <a
              href="https://t.me/oneSitePlsBot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#A7ABB4]/60 hover:text-[#A7ABB4] transition-colors"
            >
              powered by oneSitePls &middot; @SALAVEY13
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}