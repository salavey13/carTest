"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useTheme } from "next-themes";

/* ────────────────────────────────────────────
   VIP Bike Theme Palettes (from Supabase vip-bike franchize)
   ──────────────────────────────────────────── */
const VIP_BIKE_THEMES = {
  dark: {
    bgBase: "#0A0A0A",        // Deep black
    bgCard: "#1A1A1A",        // Soft black for cards
    accentMain: "#FFD700",    // Gold
    accentMainHover: "#FFC125", // Darker gold for hover
    textPrimary: "#FFFAF0",   // Floral white
    textSecondary: "#D4AF37", // Muted gold
    borderSoft: "#2A2A2A",    // Dark gray border
  },
  light: {
    bgBase: "#FAFAFA",        // Off-white
    bgCard: "#FFFFFF",        // Pure white for cards
    accentMain: "#00FFFF",    // Electric cyan
    accentMainHover: "#00CED1", // Dark turquoise for hover
    textPrimary: "#1A1A1A",   // Near black
    textSecondary: "#4A4A4A", // Dark gray
    borderSoft: "#E0F7FA",    // Light cyan border
  },
};

/* ────────────────────────────────────────────
   Hero Image (from franchize page)
   ──────────────────────────────────────────── */
const HERO_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg";

/* ────────────────────────────────────────────
   CTA targets
   ──────────────────────────────────────────── */
const CATALOG_HREF = "/franchize/vip-bike";
const BOT_HREF = "https://t.me/oneBikePlsBot";
const OPERATOR_HREF = "https://t.me/I_O_S_NN";

/* ────────────────────────────────────────────
   Social Links Configuration
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
    href: BOT_HREF,
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
    href: OPERATOR_HREF,
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
   Pricing Tiers (static, conversion-optimised)
   ──────────────────────────────────────────── */
const PRICING_TIERS = [
  {
    id: "hour",
    label: "Час",
    emoji: "⚡️",
    price: "от 1 500 ₽",
    per: "/ час",
    note: "минимум 1 час",
    features: [
      "Шлем + перчатки в комплекте",
      "200 км/сутки включено (для ДВС)",
      "150 км/сутки включено (для электро)",
      "Страховка депозита от 20 000 ₽",
    ],
    cta: "Покататься часок",
    href: BOT_HREF,
    highlighted: false,
  },
  {
    id: "day",
    label: "Сутки",
    emoji: "🔥",
    price: "от 10 000 ₽",
    per: "/ сутки",
    note: "бронь на 18:00→10:00",
    features: [
      "Всё из тарифа «Час», но на сутки",
      "Скидка 10% от 3 суток",
      "Скидка 15% от 7 суток",
      "СТС вместо депозита — без денег в кассу",
      "Доставка по городу — 500 ₽",
    ],
    cta: "Забрать на сутки",
    href: BOT_HREF,
    highlighted: true,
  },
  {
    id: "week",
    label: "Неделя",
    emoji: "🚀",
    price: "от 60 000 ₽",
    per: "/ 7 суток",
    note: "скидка 20% от 14 суток",
    features: [
      "Всё из тарифа «Сутки», но дешевле",
      "Приоритетное бронирование",
      "Экипировка с брендированием (по запросу)",
      "Выделенный менеджер в Telegram",
      "Бесплатная доставка по городу",
    ],
    cta: "Уйти в неделю",
    href: BOT_HREF,
    highlighted: false,
  },
];

/* ────────────────────────────────────────────
   FAQ items (Gen-Z tone, conversion-killing objections)
   ──────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Так, мне правда не нужна категория А? 🤨",
    a: "Правда. Наши электромотоциклы до 4 кВт — это L1e-B, по закону категория B (или M, если есть). Права обычные, без мотоциклетной категории. Покажешь — садишься.",
  },
  {
    q: "А ОСАГО и ПТС точно не нужны?",
    a: "Точно. Электро до 4 кВт не регистрируется в ГИБДД, ПТС нет, ОСАГО нет. Никакой бюрократии. Сел — поехал.",
  },
  {
    q: "А если без прав категории B? 🙃",
    a: "Тогда никак — закон есть закон. Но если у тебя M или A1 — тоже прокатит, позвони оператору, подберём байк под твою категорию.",
  },
  {
    q: "Что за СТС вместо депозита? 🪪",
    a: "Вместо денежного залога 20 000 ₽ можно оставить оригинал СТС своего автомобиля или мотоцикла. СТС возвращаем в течение 3 рабочих дней после возврата байка. Удобно, если не хочешь замораживать кэш.",
  },
  {
    q: "Можно ли обменять/вернуть байк? 💸",
    a: "Да. Первые 10 дней — тест-драйв с возвратом денег, если что-то не зашло. Возврат — по акту приёма-передачи, деньги возвращаем в течение 3 рабочих дней.",
  },
  {
    q: "А если я уроню или утоплю? 😬",
    a: "Царапины — по прайсу (от 5 000 ₽). Глубокие повреждения — по счёту СТО. Утопление — стоимость восстановительного ремонта. Всё прозрачно, в договоре прописано до копейки. GPS-трекер на каждом байке — это не слежка, это страховка от «байк угнали».",
  },
  {
    q: "Доставка есть? 📍",
    a: "Да. По Нижнему Новгороду — 500 ₽. За пределы города — по согласованию. Привозим и забираем сами, тебе не надо никуда ехать.",
  },
  {
    q: "А экипировка? 🪖",
    a: "Шлем и перчатки — обязательно, выдаём бесплатно. Куртка/черепаха/второй шлем — по запросу. За утрату или порчу экипировки — по прайсу из приложения №3 к договору.",
  },
];

/* ────────────────────────────────────────────
   How it works — 4 steps
   ──────────────────────────────────────────── */
const HOW_IT_WORKS_STEPS = [
  {
    n: "01",
    title: "Выбрал",
    desc: "Жмёшь «Выбрать байк» → попадаешь в каталог. Смотришь фото, читаешь спеку, выбираешь по сердцу.",
    emoji: "👆",
  },
  {
    n: "02",
    title: "Забронировал",
    desc: "В боте @oneBikePlsBot — 2 клика: даты + формат поездки. Депозит или СТС — на твой выбор.",
    emoji: "📲",
  },
  {
    n: "03",
    title: "Забрал",
    desc: "Приезжаешь на пл. Комсомольская 2. Подписываешь договор (3 минуты), получаешь байк + экипировку.",
    emoji: "🔑",
  },
  {
    n: "04",
    title: "Катался",
    desc: "Откручиваешь ручку. Возвращаешь в согласованное время — забираешь депозит/СТС. Всё.",
    emoji: "🏍️",
  },
];

/* ────────────────────────────────────────────
   Hero Stats (animated counters)
   ──────────────────────────────────────────── */
const HERO_STATS = [
  { value: 1000, suffix: "+", label: "поездок" },
  { value: 10, suffix: "+", label: "байков" },
  { value: 4.9, suffix: "★", label: "рейтинг", decimals: 1 },
  { value: 3, suffix: " года", label: "на рынке" },
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
   Scroll Progress Bar (top of page)
   ──────────────────────────────────────────── */
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{
        scaleX,
        transformOrigin: "0%",
        background: "linear-gradient(to right, var(--vip-accent-main), var(--vip-accent-main-hover))",
      }}
      className="fixed top-0 left-0 right-0 h-1 z-[60] origin-left"
    />
  );
}

/* ────────────────────────────────────────────
   Magnetic Button — attracts cursor slightly
   ──────────────────────────────────────────── */
function MagneticButton({
  children,
  href,
  primary = false,
  className = "",
  buttonClassName = "",
  style = {},
  size = "lg",
}: {
  children: React.ReactNode;
  href: string;
  primary?: boolean;
  className?: string;
  buttonClassName?: string;
  style?: React.CSSProperties;
  size?: "sm" | "lg" | "default";
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * 0.25;
    const y = (e.clientY - (rect.top + rect.height / 2)) * 0.25;
    setPos({ x, y });
  }, []);

  const handleLeave = useCallback(() => setPos({ x: 0, y: 0 }), []);

  const isInternal = href.startsWith("/");

  // For the header variant (size="sm"), we shrink padding/font so the button
  // fits in the navbar. buttonClassName can also override Tailwind classes.
  const sizeClasses =
    size === "sm"
      ? "text-sm px-5 py-2"
      : "text-lg px-8 md:px-10 py-6";

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      target={isInternal ? undefined : "_blank"}
      rel={isInternal ? undefined : "noopener noreferrer"}
      className={`inline-block ${className}`}
    >
      <Button
        size={size === "sm" ? "sm" : "lg"}
        variant={primary ? "default" : "outline"}
        className={`rounded-full font-bold transition-all hover:scale-[1.03] ${sizeClasses} ${buttonClassName}`}
        style={{
          backgroundColor: primary ? "var(--vip-accent-main)" : "transparent",
          color: primary ? "var(--vip-bg-base)" : "var(--vip-accent-main)",
          borderColor: "var(--vip-accent-main)",
          boxShadow: primary
            ? `0 10px 30px color-mix(in srgb, var(--vip-accent-main) 30%, transparent)`
            : "none",
          ...style,
        }}
      >
        {children}
      </Button>
    </motion.a>
  );
}

/* ────────────────────────────────────────────
   Animated Counter (counts up when in view)
   ──────────────────────────────────────────── */
function AnimatedCounter({
  value,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, value]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString("ru-RU");

  return (
    <span ref={ref}>
      {formatted}
      <span style={{ color: "var(--vip-accent-main)" }}>{suffix}</span>
    </span>
  );
}

/* ────────────────────────────────────────────
   Mouse-Follow Glow (hero background)
   ──────────────────────────────────────────── */
function MouseFollowGlow() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 50, damping: 20 });
  const sy = useSpring(y, { stiffness: 50, damping: 20 });

  // Compute the background CSS string from the spring-tracked mouse coords.
  // Called at top-level of the component (not inside JSX) to comply with
  // React's rules-of-hooks.
  const background = useTransform(
    [sx, sy],
    ([cx, cy]: number[]) =>
      `radial-gradient(600px circle at ${cx}px ${cy}px, color-mix(in srgb, var(--vip-accent-main) 8%, transparent), transparent 70%)`
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] hidden md:block"
      style={{ background }}
    />
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
      className="group relative flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all duration-500 hover:border-transparent cursor-pointer overflow-hidden"
      style={{
        backgroundColor: "var(--vip-bg-card)",
        borderColor: "var(--vip-border-soft)",
        boxShadow: isHovered
          ? `0 0 40px ${social.hoverGlow}, 0 8px 32px rgba(0,0,0,0.4)`
          : "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${social.gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-500`}
      />
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
            boxShadow: isHovered ? `0 0 20px ${social.color}33` : "0 0 0px transparent",
          }}
        >
          <div
            className="transition-all duration-300"
            style={{
              color: isHovered ? social.color : "var(--vip-text-secondary)",
              filter: isHovered ? `drop-shadow(0 0 8px ${social.color})` : "none",
            }}
          >
            {social.icon}
          </div>
        </div>
      </div>
      <div className="text-center relative z-10">
        <h3 className="font-bold text-lg group-hover:text-white transition-colors duration-300" style={{ color: "var(--vip-text-primary)" }}>
          {social.label}
        </h3>
        <p className="text-sm mt-1 group-hover:opacity-80 transition-colors duration-300" style={{ color: "var(--vip-text-secondary)" }}>
          {social.description}
        </p>
      </div>
      <div
        className="flex items-center gap-1 text-xs font-medium transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
        style={{ color: social.color }}
      >
        <span>Перейти</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <div className="transition-all duration-300 group-hover:scale-110" style={{ color: social.color }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  {social.icon.props.children}
                </svg>
              </div>
              <div
                className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{ background: social.color, color: "#fff" }}
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
   VIP Bike Theme Style Injector
   ──────────────────────────────────────────── */
function VipBikeThemeStyles() {
  const { resolvedTheme } = useTheme();

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

    document.body.style.backgroundColor = theme.bgBase;
  }, [resolvedTheme]);

  return null;
}

/* ────────────────────────────────────────────
   FAQ Accordion Item
   ──────────────────────────────────────────── */
function FaqItem({ item, index }: { item: (typeof FAQ_ITEMS)[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="rounded-2xl border overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: "var(--vip-bg-card)",
        borderColor: open ? "var(--vip-accent-main)" : "var(--vip-border-soft)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5 md:p-6 flex items-start justify-between gap-4 cursor-pointer"
      >
        <span
          className="text-base md:text-lg font-bold pr-2 leading-snug"
          style={{ color: "var(--vip-text-primary)" }}
        >
          {item.q}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: open
              ? "var(--vip-accent-main)"
              : "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)",
            color: open ? "var(--vip-bg-base)" : "var(--vip-accent-main)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p
              className="px-5 md:px-6 pb-5 md:pb-6 text-sm md:text-base leading-relaxed"
              style={{ color: "var(--vip-text-secondary)" }}
            >
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ────────────────────────────────────────────
   Pricing Card
   ──────────────────────────────────────────── */
function PricingCard({ tier, index }: { tier: (typeof PRICING_TIERS)[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
      whileHover={{ y: -8 }}
      className="relative flex flex-col rounded-3xl border-2 p-6 md:p-8 transition-colors duration-300"
      style={{
        backgroundColor: "var(--vip-bg-card)",
        borderColor: tier.highlighted ? "var(--vip-accent-main)" : "var(--vip-border-soft)",
        boxShadow: tier.highlighted
          ? `0 20px 60px color-mix(in srgb, var(--vip-accent-main) 20%, transparent)`
          : "0 4px 16px rgba(0,0,0,0.15)",
      }}
    >
      {tier.highlighted && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{
            background: "var(--vip-accent-main)",
            color: "var(--vip-bg-base)",
          }}
        >
          🔥 Хит
        </div>
      )}

      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{tier.emoji}</div>
        <h4
          className="text-xl font-bold uppercase tracking-wide"
          style={{ color: "var(--vip-text-primary)" }}
        >
          {tier.label}
        </h4>
        <p className="text-xs mt-1" style={{ color: "var(--vip-text-secondary)" }}>
          {tier.note}
        </p>
      </div>

      <div className="text-center mb-6">
        <span
          className="text-3xl md:text-4xl font-black"
          style={{ color: "var(--vip-accent-main)" }}
        >
          {tier.price}
        </span>
        <span className="text-sm ml-1" style={{ color: "var(--vip-text-secondary)" }}>
          {tier.per}
        </span>
      </div>

      <ul className="flex-1 space-y-3 mb-6">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--vip-text-secondary)" }}>
            <svg
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--vip-accent-main)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <MagneticButton href={tier.href} primary={tier.highlighted} className="w-full">
        {tier.cta}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </MagneticButton>
    </motion.div>
  );
}

/* ────────────────────────────────────────────
   Cinematic Hero
   ──────────────────────────────────────────── */
function CinematicHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Parallax transforms
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Word-by-word headline reveal
  const headlineWords = ["VIP", "BIKE", "ELECTRO"];
  const headlineRef = useRef(null);
  const headlineInView = useInView(headlineRef, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative min-h-[92vh] flex items-center overflow-hidden pt-20">
      {/* Full-bleed hero image with parallax */}
      <motion.div
        style={{ y: imageY, scale: imageScale }}
        className="absolute inset-0 z-0"
      >
        <img
          src={HERO_IMAGE}
          alt="VIP BIKE ELECTRO — электро-кайф без заморочек"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--vip-bg-base) 70%, transparent) 0%, color-mix(in srgb, var(--vip-bg-base) 30%, transparent) 50%, var(--vip-bg-base) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, transparent 0%, color-mix(in srgb, var(--vip-bg-base) 60%, transparent) 100%)",
          }}
        />
      </motion.div>

      {/* Floating accent glows */}
      <div
        className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] z-[1] pointer-events-none"
        style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.08 }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] z-[1] pointer-events-none"
        style={{ backgroundColor: "#26A5E4", opacity: 0.06 }}
      />

      {/* Hero content */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 max-w-5xl mx-auto px-4 text-center w-full"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <Badge
            variant="outline"
            className="px-4 py-2 text-sm"
            style={{
              borderColor: "var(--vip-accent-main)",
              color: "var(--vip-accent-main)",
              backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
              backdropFilter: "blur(8px)",
            }}
          >
            ⚡️ Электромотоциклы в Нижнем Новгороде
          </Badge>
        </motion.div>

        <h2
          ref={headlineRef}
          className="text-5xl sm:text-7xl md:text-8xl font-black mb-6 leading-[0.95] tracking-tight"
          style={{ color: "var(--vip-text-primary)" }}
        >
          {headlineWords.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 60, rotateX: -90 }}
              animate={headlineInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: 0.2 + i * 0.15,
                ease: [0.215, 0.61, 0.355, 1],
              }}
              className="inline-block mr-4 last:mr-0"
              style={{
                backgroundImage: i === 2
                  ? `linear-gradient(to right, var(--vip-accent-main), var(--vip-accent-main-hover), var(--vip-accent-main))`
                  : "none",
                WebkitBackgroundClip: i === 2 ? "text" : "unset",
                WebkitTextFillColor: i === 2 ? "transparent" : "var(--vip-text-primary)",
                backgroundClip: "text",
                transformOrigin: "bottom",
              }}
            >
              {word}
            </motion.span>
          ))}
        </h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="text-lg md:text-2xl max-w-2xl mx-auto mb-4 leading-relaxed font-medium"
          style={{ color: "var(--vip-text-primary)" }}
        >
          Электро-кайф без заморочек 🏍️💨
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          className="text-base md:text-lg max-w-2xl mx-auto mb-10"
          style={{ color: "var(--vip-text-secondary)" }}
        >
          Без категории А. Без ОСАГО. Без ПТС. По правам B — сел и поехал. Мощно, тихо, экологично.
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1 }}
          className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10"
        >
          {[
            { text: "⚡️", detail: "мощно, тихо, экологично" },
            { text: "10 дней", detail: "на возврат, деньги обратно" },
            { text: "🪪 СТС", detail: "вместо депозита" },
          ].map((pill, i) => (
            <div
              key={i}
              className="px-4 py-2 rounded-full border text-sm backdrop-blur-sm"
              style={{
                borderColor: "var(--vip-border-soft)",
                backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 70%, transparent)",
              }}
            >
              <span className="font-semibold" style={{ color: "var(--vip-accent-main)" }}>
                {pill.text}
              </span>{" "}
              <span style={{ color: "var(--vip-text-secondary)" }}>{pill.detail}</span>
            </div>
          ))}
        </motion.div>

        {/* Dual CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.15 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <MagneticButton href={CATALOG_HREF} primary>
            Выбрать байк
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </MagneticButton>
          <MagneticButton href={BOT_HREF}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2 inline">
              <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Бронь в боте
          </MagneticButton>
        </motion.div>

        {/* Hero stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mt-16 pt-8 border-t"
          style={{ borderColor: "var(--vip-border-soft)" }}
        >
          {HERO_STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div
                className="text-3xl md:text-4xl font-black mb-1"
                style={{ color: "var(--vip-text-primary)" }}
              >
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  decimals={stat.decimals ?? 0}
                />
              </div>
              <div className="text-xs md:text-sm uppercase tracking-wide" style={{ color: "var(--vip-text-secondary)" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2"
        style={{ color: "var(--vip-text-secondary)" }}
      >
        <span className="text-xs uppercase tracking-widest">Листай вниз</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Main Landing Page
   ──────────────────────────────────────────── */
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <VipBikeThemeStyles />
      <ScrollProgressBar />
      <MouseFollowGlow />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--vip-bg-base)" }}>
        <FloatingSocialBar />

        {/* ─── HEADER ─── */}
        <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "color-mix(in srgb, var(--vip-bg-base) 80%, transparent)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(to-br, var(--vip-accent-main), var(--vip-accent-main-hover))` }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--vip-bg-base)"
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
                <h1 className="font-bold text-lg leading-tight" style={{ color: "var(--vip-text-primary)" }}>
                  VIP BIKE ELECTRO
                </h1>
                <p className="text-[10px] leading-tight hidden sm:block" style={{ color: "var(--vip-text-secondary)" }}>
                  Электромотоциклы без категории А
                </p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm">
              {[
                { label: "Каталог", href: "#catalog" },
                { label: "Тарифы", href: "#pricing" },
                { label: "Как это работает", href: "#how" },
                { label: "FAQ", href: "#faq" },
                { label: "Контакты", href: "#contacts" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition-colors duration-200 hover:opacity-80"
                  style={{ color: "var(--vip-text-secondary)" }}
                >
                  {link.label}
                </a>
              ))}
              <ThemeToggleButton size="md" />
              <MagneticButton href={CATALOG_HREF} primary size="sm">
                Забронировать
              </MagneticButton>
            </nav>

            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggleButton size="sm" />
              <button
                className="p-2"
                style={{ color: "var(--vip-text-primary)" }}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {menuOpen ? (
                    <path d="M18 6L6 18M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden border-t overflow-hidden"
                style={{ borderColor: "var(--vip-border-soft)" }}
              >
                <div className="px-4 py-4 flex flex-col gap-3">
                  {[
                    { label: "Каталог", href: "#catalog" },
                    { label: "Тарифы", href: "#pricing" },
                    { label: "Как это работает", href: "#how" },
                    { label: "FAQ", href: "#faq" },
                    { label: "Контакты", href: "#contacts" },
                  ].map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="py-2 transition-colors"
                      style={{ color: "var(--vip-text-secondary)" }}
                    >
                      {link.label}
                    </a>
                  ))}
                  <a href={CATALOG_HREF} onClick={() => setMenuOpen(false)}>
                    <Button className="w-full rounded-full font-semibold" style={{
                      backgroundColor: "var(--vip-accent-main)",
                      color: "var(--vip-bg-base)",
                    }}>
                      Забронировать
                    </Button>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="flex-1">
          {/* ─── CINEMATIC HERO ─── */}
          <CinematicHero />

          {/* ─── BARRIER CARDS ─── */}
          <section id="catalog" className="py-20 md:py-28 px-4">
            <div className="max-w-7xl mx-auto">
              <AnimatedSection className="text-center mb-16">
                <Badge
                  variant="outline"
                  className="mb-4"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  Почему мы, а не бензин ⛽️❌
                </Badge>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Три барьера,{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>которые мы снесли</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  Тестили 79bike Falcon PRO везде: город, просёлок, снег, грязь, лёд. Без пинков, без отказов, без драмы.
                </p>
              </AnimatedSection>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    id: "prohodimost",
                    number: "01",
                    title: "Поле, лес, грязь, лестницы 🌲",
                    description:
                      "Кочки, корни, песок, снег, подъёмы и спуски. Куда сам дошёл — туда и заехал. В обзорах «корни съел как нефиг нафиг», едет по кроссовой трассе наравне с бензином.",
                    image:
                      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b1-prohodimost.jpeg",
                  },
                  {
                    id: "razgon",
                    number: "02",
                    title: "Выстреливает из рогатки 🚀",
                    description:
                      "Электро-тяга бьёт мгновенно — без сцепления и передач. Проваливаешься в кресло как в суперкаре. Открутил ручку — и поехал, на максимум сразу.",
                    image:
                      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg",
                  },
                  {
                    id: "voda",
                    number: "03",
                    title: "Топили в озере — едет 🌊",
                    description:
                      "Влагозащита IP67. На тесте погружали в ледяное озеро — завёлся, год катается. Лужи, дождь, мокрая трава — без последствий.",
                    image:
                      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b3-voda.jpeg",
                  },
                ].map((card, idx) => (
                  <AnimatedSection key={card.id} delay={idx * 0.15}>
                    <Card className="overflow-hidden group transition-all duration-500 hover:-translate-y-2" style={{
                      backgroundColor: "var(--vip-bg-card)",
                      borderColor: "var(--vip-border-soft)",
                    }}>
                      <div className="relative aspect-video bg-gradient-to-br overflow-hidden" style={{ backgroundImage: "linear-gradient(to bottom right, #1e293b, #0f172a)" }}>
                        <motion.img
                          src={card.image}
                          alt={card.title}
                          className="object-cover w-full h-full"
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.7 }}
                        />
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{
                            backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 20%, transparent)`,
                            border: `1px solid color-mix(in srgb, var(--vip-accent-main) 30%, transparent)`,
                          }}>
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--vip-accent-main)"
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
                        <h4 className="text-xl font-bold mb-3" style={{ color: "var(--vip-text-primary)" }}>
                          {card.title}
                        </h4>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>
                          {card.description}
                        </p>
                      </CardContent>
                    </Card>
                  </AnimatedSection>
                ))}
              </div>

              {/* Inline catalog CTA */}
              <AnimatedSection delay={0.4} className="text-center mt-12">
                <MagneticButton href={CATALOG_HREF} primary>
                  Смотреть все байки в каталоге
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </MagneticButton>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section
            id="how"
            className="py-20 md:py-28 px-4 relative overflow-hidden"
            style={{ backgroundColor: `color-mix(in srgb, var(--vip-bg-card) 40%, transparent)` }}
          >
            <div className="max-w-6xl mx-auto relative z-10">
              <AnimatedSection className="text-center mb-16">
                <Badge
                  variant="outline"
                  className="mb-4"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  Как это работает 🛠️
                </Badge>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Забери. Покатайся.{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>Верни.</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  От «хочу» до «катюсь» — 15 минут. Без очередей, без бумажной волокиты, без звонков «а можно забронировать?».
                </p>
              </AnimatedSection>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                {/* Connecting line (desktop) */}
                <div
                  className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 z-0"
                  style={{
                    background: `linear-gradient(to right, transparent, var(--vip-accent-main), transparent)`,
                    opacity: 0.3,
                  }}
                />

                {HOW_IT_WORKS_STEPS.map((step, idx) => (
                  <AnimatedSection key={step.n} delay={idx * 0.15} className="relative z-10">
                    <div className="flex flex-col items-center text-center">
                      <div
                        className="relative w-24 h-24 rounded-full flex items-center justify-center mb-5 text-4xl transition-transform duration-300 hover:scale-110"
                        style={{
                          background: `linear-gradient(135deg, color-mix(in srgb, var(--vip-accent-main) 20%, transparent), color-mix(in srgb, var(--vip-accent-main) 5%, transparent))`,
                          border: `2px solid color-mix(in srgb, var(--vip-accent-main) 40%, transparent)`,
                          backdropFilter: "blur(8px)",
                        }}
                      >
                        <span>{step.emoji}</span>
                        <span
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                          style={{
                            background: "var(--vip-accent-main)",
                            color: "var(--vip-bg-base)",
                          }}
                        >
                          {step.n}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold mb-2" style={{ color: "var(--vip-text-primary)" }}>
                        {step.title}
                      </h4>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>
                        {step.desc}
                      </p>
                    </div>
                  </AnimatedSection>
                ))}
              </div>

              <AnimatedSection delay={0.6} className="text-center mt-14">
                <MagneticButton href={BOT_HREF} primary>
                  Погнали в бот
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </MagneticButton>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── PRICING ─── */}
          <section id="pricing" className="py-20 md:py-28 px-4">
            <div className="max-w-6xl mx-auto">
              <AnimatedSection className="text-center mb-16">
                <Badge
                  variant="outline"
                  className="mb-4"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  Тарифы 💰
                </Badge>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Платишь за время,{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>не за нервы</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  Никаких скрытых платежей. Депозит или СТС — на выбор. Скидки от объёма работают автоматически.
                </p>
              </AnimatedSection>

              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {PRICING_TIERS.map((tier, idx) => (
                  <PricingCard key={tier.id} tier={tier} index={idx} />
                ))}
              </div>

              <AnimatedSection delay={0.5} className="text-center mt-10">
                <p className="text-sm" style={{ color: "var(--vip-text-secondary)" }}>
                  💡 Не нашёл подходящий тариф? Напиши оператору{" "}
                  <a
                    href={OPERATOR_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                    style={{ color: "var(--vip-accent-main)" }}
                  >
                    @I_O_S_NN
                  </a>{" "}
                  — соберём индивидуальный пакет.
                </p>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── ABOUT ─── */}
          <section
            id="about"
            className="py-20 md:py-28 px-4"
            style={{ backgroundColor: `color-mix(in srgb, var(--vip-bg-card) 40%, transparent)` }}
          >
            <div className="max-w-7xl mx-auto">
              <AnimatedSection className="text-center mb-16">
                <Badge
                  variant="outline"
                  className="mb-4"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  О нас 🤙
                </Badge>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  79bike Falcon PRO —{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>электро без категории А</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  От 310 000 ₽. Законно по правам категории B. Без ОСАГО и ПТС. Доставка по городу.
                </p>
              </AnimatedSection>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    title: "⚡️ Быстрая онлайн-бронь",
                    desc: "Выбирай байк, даты и формат поездки в пару кликов в боте",
                  },
                  {
                    title: "🪪 Электро без категории А",
                    desc: "Законно по правам категории B — никаких доп. требований",
                  },
                  {
                    title: "🛡️ ОСАГО не требуется",
                    desc: "Экономия на страховке и бюрократии — просто садись и поезжай",
                  },
                  {
                    title: "📍 Центр Нижнего",
                    desc: "пл. Комсомольская 2 — удобно добираться из любой точки города",
                  },
                ].map((feature, idx) => (
                  <AnimatedSection key={feature.title} delay={idx * 0.1}>
                    <div className="p-6 rounded-2xl border text-center hover:transition-all duration-300 group h-full hover:-translate-y-1" style={{
                      backgroundColor: "var(--vip-bg-card)",
                      borderColor: "var(--vip-border-soft)",
                    }}>
                      <h4 className="text-lg font-bold mb-2" style={{ color: "var(--vip-text-primary)" }}>
                        {feature.title}
                      </h4>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>
                        {feature.desc}
                      </p>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section id="faq" className="py-20 md:py-28 px-4">
            <div className="max-w-3xl mx-auto">
              <AnimatedSection className="text-center mb-12">
                <Badge
                  variant="outline"
                  className="mb-4"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  FAQ 🤔
                </Badge>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Вопросы, которые{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>задают всегда</span>
                </h3>
                <p className="text-lg" style={{ color: "var(--vip-text-secondary)" }}>
                  Коротко, честно, без воды. Если чего-то нет — пиши в{" "}
                  <a
                    href={OPERATOR_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                    style={{ color: "var(--vip-accent-main)" }}
                  >
                    @I_O_S_NN
                  </a>
                  .
                </p>
              </AnimatedSection>

              <div className="space-y-3">
                {FAQ_ITEMS.map((item, idx) => (
                  <FaqItem key={idx} item={item} index={idx} />
                ))}
              </div>
            </div>
          </section>

          {/* ─── SOCIAL MEDIA SECTION ─── */}
          <section id="social" className="py-20 md:py-28 px-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px]" style={{ backgroundColor: "#26A5E4", opacity: 0.05 }} />
              <div className="absolute top-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px]" style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.05 }} />
            </div>

            <div className="max-w-5xl mx-auto relative z-10">
              <AnimatedSection className="text-center mb-14">
                <Badge
                  variant="outline"
                  className="mb-4"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  Мы в соцсетях 📱
                </Badge>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Подписывайся и{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>будь в теме</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  Покатушки, эксклюзивы, мемы. Выбирай платформу — мы везде.
                </p>
              </AnimatedSection>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {SOCIAL_LINKS.map((social, idx) => (
                  <SocialCard key={social.id} social={social} index={idx} />
                ))}
              </div>

              <AnimatedSection delay={0.5} className="mt-12">
                <div className="flex flex-wrap justify-center gap-3">
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm transition-all duration-300"
                      style={{
                        borderColor: "var(--vip-border-soft)",
                        backgroundColor: "var(--vip-bg-card)",
                        color: "var(--vip-text-secondary)",
                      }}
                    >
                      <div style={{ color: social.color }} className="w-4 h-4">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
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
            className="py-20 md:py-28 px-4"
            style={{ backgroundColor: `color-mix(in srgb, var(--vip-bg-card) 40%, transparent)` }}
          >
            <div className="max-w-4xl mx-auto">
              <AnimatedSection className="text-center mb-14">
                <Badge
                  variant="outline"
                  className="mb-4"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  Контакты 📞
                </Badge>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Свяжись{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>с нами</span>
                </h3>
                <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  Всегда на связи — выбирай удобный способ
                </p>
              </AnimatedSection>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatedSection>
                  <a
                    href={CONTACT_INFO.phoneHref}
                    className="flex flex-col items-center gap-4 p-8 rounded-2xl border transition-all duration-300 group hover:-translate-y-1"
                    style={{
                      backgroundColor: "var(--vip-bg-card)",
                      borderColor: "var(--vip-border-soft)",
                    }}
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{
                      backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, var(--vip-accent-main) 20%, transparent)`,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-7 h-7" style={{ stroke: "var(--vip-accent-main)" }}>
                        <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>
                        {CONTACT_INFO.phone}
                      </p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Позвонить</p>
                    </div>
                  </a>
                </AnimatedSection>

                <AnimatedSection delay={0.1}>
                  <a
                    href={OPERATOR_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-4 p-8 rounded-2xl border transition-all duration-300 group hover:-translate-y-1"
                    style={{
                      backgroundColor: "var(--vip-bg-card)",
                      borderColor: "var(--vip-border-soft)",
                    }}
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{
                      backgroundColor: "color-mix(in srgb, #26A5E4 10%, transparent)",
                      border: "1px solid color-mix(in srgb, #26A5E4 20%, transparent)",
                    }}>
                      <svg viewBox="0 0 24 24" fill="#26A5E4" className="w-7 h-7">
                        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>
                        @I_O_S_NN
                      </p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Telegram</p>
                    </div>
                  </a>
                </AnimatedSection>

                <AnimatedSection delay={0.2}>
                  <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border sm:col-span-2 lg:col-span-1" style={{
                    backgroundColor: "var(--vip-bg-card)",
                    borderColor: "var(--vip-border-soft)",
                  }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
                      backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, var(--vip-accent-main) 20%, transparent)`,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-7 h-7" style={{ stroke: "var(--vip-accent-main)" }}>
                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>
                        {CONTACT_INFO.address}
                      </p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>
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
              <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, var(--vip-bg-base), color-mix(in srgb, var(--vip-bg-base) 50%, transparent), var(--vip-bg-base))` }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[150px]" style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.08 }} />
            </div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
              <AnimatedSection>
                <Badge
                  variant="outline"
                  className="mb-6"
                  style={{
                    borderColor: "var(--vip-accent-main)",
                    color: "var(--vip-accent-main)",
                    backgroundColor: `color-mix(in srgb, var(--vip-accent-main) 10%, transparent)`,
                  }}
                >
                  Готов к выезду? 🔥
                </Badge>
                <h3 className="text-4xl md:text-6xl font-black mb-6 leading-tight" style={{ color: "var(--vip-text-primary)" }}>
                  Начни свой{" "}
                  <span className="bg-gradient-to-r bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--vip-accent-main), var(--vip-accent-main-hover), var(--vip-accent-main))` }}>
                    электро-путь
                  </span>{" "}
                  сегодня
                </h3>
                <p className="text-xl max-w-2xl mx-auto mb-10" style={{ color: "var(--vip-text-secondary)" }}>
                  Выбери байк. Забронируй слот. Покатайся. Верни. Никакой волокиты — только кайф.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <MagneticButton href={CATALOG_HREF} primary>
                    Выбрать байк
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2 inline">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </MagneticButton>
                  <MagneticButton href={OPERATOR_HREF}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2 inline">
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    Написать оператору
                  </MagneticButton>
                </div>
              </AnimatedSection>
            </div>
          </section>
        </main>

        {/* ─── FOOTER ─── */}
        <footer className="border-t" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "var(--vip-bg-base)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(to-br, var(--vip-accent-main), var(--vip-accent-main-hover))` }}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--vip-bg-base)"
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
                  <span className="font-bold text-lg" style={{ color: "var(--vip-text-primary)" }}>
                    VIP BIKE ELECTRO
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>
                  Электромотоциклы в Нижнем Новгороде. 79bike: мощно, быстро, законно, без ОСАГО. ⚡️🏍️
                </p>
              </div>

              <div>
                <h4 className="font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>Разделы</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "Каталог", href: "#catalog" },
                    { label: "Тарифы", href: "#pricing" },
                    { label: "Как это работает", href: "#how" },
                    { label: "FAQ", href: "#faq" },
                    { label: "Контакты", href: "#contacts" },
                  ].map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="text-sm transition-colors duration-200"
                        style={{ color: "var(--vip-text-secondary)" }}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>Соцсети</h4>
                <div className="space-y-3">
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm transition-colors duration-200 group"
                      style={{ color: "var(--vip-text-secondary)" }}
                    >
                      <div
                        className="w-5 h-5 transition-colors duration-200"
                        style={{ color: social.color }}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          {social.icon.props.children}
                        </svg>
                      </div>
                      {social.label}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>Связь</h4>
                <div className="space-y-3">
                  <a
                    href={OPERATOR_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm transition-colors duration-200"
                    style={{ color: "var(--vip-text-secondary)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="#26A5E4" className="w-4 h-4">
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    @I_O_S_NN
                  </a>
                  <a
                    href={CONTACT_INFO.phoneHref}
                    className="flex items-center gap-2.5 text-sm transition-colors duration-200"
                    style={{ color: "var(--vip-text-secondary)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-4 h-4" style={{ stroke: "var(--vip-accent-main)" }}>
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {CONTACT_INFO.phone}
                  </a>
                  <div className="flex items-center gap-2.5 text-sm" style={{ color: "var(--vip-text-secondary)" }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-4 h-4" style={{ stroke: "var(--vip-accent-main)" }}>
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {CONTACT_INFO.address}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--vip-border-soft)" }}>
              <p className="text-xs" style={{ color: "var(--vip-text-secondary)" }}>
                &copy; {new Date().getFullYear()} VIP BIKE ELECTRO ⚡️
              </p>
              <a
                href="https://t.me/oneSitePlsBot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs transition-colors"
                style={{ color: "var(--vip-text-secondary)" }}
              >
                powered by oneSitePls &middot; @SALAVEY13
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
