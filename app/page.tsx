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

/* ══ HERO IMAGES — LiveWire ONE gallery + signature shot (crossfade every 5s) ══ */
const HERO_IMAGES = [
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/livewire-one/image_1.jpg",
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/livewire-one/image_2.jpg",
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/livewire-one/image_3.jpg",
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg",
];

/* ══ CTA TARGETS ══ */
const CATALOG_HREF = "/franchize/vip-bike";
const BOT_HREF = "https://t.me/oneBikePlsBot";
const OPERATOR_HREF = "https://t.me/I_O_S_NN";
const INSTAGRAM_HREF = "https://www.instagram.com/vipbikerental_nn";

/* ══ SOCIAL LINKS — 5 platforms: Instagram, Telegram, YouTube, VK, WhatsApp ══ */
type SocialLink = {
  id: string; label: string; href: string; color: string;
  gradient: string; hoverGlow: string; description: string;
  icon: React.ReactElement<{ children?: React.ReactNode }>;
};

const SOCIAL_LINKS: SocialLink[] = [
  {
    id: "instagram", label: "Instagram", href: INSTAGRAM_HREF, color: "#E4405F",
    gradient: "from-[#833AB4] via-[#E4405F] to-[#FCAF45]", hoverGlow: "rgba(228, 64, 95, 0.5)", description: "Фото и сторис",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>),
  },
  {
    id: "telegram", label: "Telegram", href: BOT_HREF, color: "#26A5E4",
    gradient: "from-[#26A5E4] to-[#1A8BC9]", hoverGlow: "rgba(38, 165, 228, 0.5)", description: "Бот для брони",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>),
  },
  {
    id: "youtube", label: "YouTube", href: "https://youtube.com/@vipbikerental", color: "#FF0000",
    gradient: "from-[#FF0000] to-[#CC0000]", hoverGlow: "rgba(255, 0, 0, 0.5)", description: "Видео покатушек",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>),
  },
  {
    id: "vk", label: "VK", href: "https://vk.com/vip_bike", color: "#4C75A3",
    gradient: "from-[#4C75A3] to-[#2A5885]", hoverGlow: "rgba(76, 117, 163, 0.5)", description: "Группа ВКонтакте",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.49 2.27 4.675 2.85 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.49c0 .373.17.508.271.508.22 0 .407-.135.813-.542 1.254-1.406 2.152-3.574 2.152-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.253.746.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" /></svg>),
  },
  {
    id: "whatsapp", label: "WhatsApp", href: "https://wa.me/79200789888", color: "#25D366",
    gradient: "from-[#25D366] to-[#128C7E]", hoverGlow: "rgba(37, 211, 102, 0.5)", description: "Напишите нам",
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>),
  },
];

/* ══ CONTACT INFO ══ */
const CONTACT_INFO = {
  phone: "+7 9200-789-888", phoneHref: "tel:+79200789888",
  address: "Н. Новгород, пл. Комсомольская 2", workingHours: "10:00 — 22:00 (ежедневно)",
};

/* ══ HERO STATS — real data: 24 байка, 18 брендов, 57 аренд, 801 990 ₽ ══ */
const HERO_STATS = [
  { value: 24, suffix: "", label: "байка в парке" },
  { value: 18, suffix: "", label: "брендов" },
  { value: 57, suffix: "", label: "завершённых аренд" },
  { value: 801990, suffix: " ₽", label: "выручки" },
];

/* ══ BIKE TIERS — 3 experience levels (Новичок / Опытный / Профи) ══ */
const BIKE_TIERS = [
  {
    id: "beginner", tier: "Новичок", emoji: "🌱", tagline: "Лёгкие электро-эндуро",
    description: "Не нужны права категории А — садишься и едешь. Идеально для первого знакомства с мотоциклом, для города и лёгкого бездорожья. Лёгкие, тихие, экологичные.",
    licenseReq: "Без категории А — достаточно прав B", accentColor: "#22C55E",
    bikes: ["79BIKE Falcon GT", "79BIKE Falcon Lite", "79BIKE Falcon Pro", "79BIKE Falcon Lynx", "HMD M02", "Jilang Max Pro", "Sotion EM01", "Wenbox U2 Pro"],
  },
  {
    id: "intermediate", tier: "Опытный", emoji: "⚡", tagline: "Мощные электромотоциклы",
    description: "Больше скорости, больше динамики, больше эмоций. Рекомендуется категория M/AM или предыдущий опыт езды на мотоцикле. Мгновенный электро-момент на колёса.",
    licenseReq: "Категория M/AM или опыт езды", accentColor: "#F59E0B",
    bikes: ["LiveWire ONE", "Ducati Panigale S Electro", "Rerode R1+", "Y-VOLT Surge V", "Regulmoto Nibbler"],
  },
  {
    id: "pro", tier: "Профи", emoji: "🔥", tagline: "Полноразмерные мотоциклы",
    description: "Серьёзная техника для серьёзных райдеров. ДВС-спортбайки и электрические суперкары. Категория А обязательна — это уже не игрушки, а настоящая мощь.",
    licenseReq: "Категория А обязательна", accentColor: "#EF4444",
    bikes: ["Kawasaki Ninja 650", "BMW F800R", "Yamaha R7", "Suzuki GSX-S1000F", "Aprilia Shiver 750", "Sequence Zero", "Motoland Breakout 300", "Kayo TSD 110"],
  },
];

/* ══ PRICING TIERS ══ */
const PRICING_TIERS = [
  { id: "hour", label: "Час", emoji: "⚡️", price: "от 1 500 ₽", per: "/ час", note: "минимум 1 час",
    features: ["Шлем + перчатки в комплекте", "200 км/сутки включено (для ДВС)", "150 км/сутки включено (для электро)", "Страховка депозита от 20 000 ₽"],
    cta: "Покататься часок", href: BOT_HREF, highlighted: false },
  { id: "day", label: "Сутки", emoji: "🔥", price: "от 10 000 ₽", per: "/ сутки", note: "бронь на 18:00 → 10:00",
    features: ["Всё из тарифа «Час», но на сутки", "Скидка 10% от 3 суток", "Скидка 15% от 7 суток", "СТС вместо депозита — без денег в кассу", "Доставка по городу — 500 ₽"],
    cta: "Забрать на сутки", href: BOT_HREF, highlighted: true },
  { id: "week", label: "Неделя", emoji: "🚀", price: "от 60 000 ₽", per: "/ 7 суток", note: "скидка 20% от 14 суток",
    features: ["Всё из тарифа «Сутки», но дешевле", "Приоритетное бронирование", "Экипировка с брендированием (по запросу)", "Выделенный менеджер в Telegram", "Бесплатная доставка по городу"],
    cta: "Уйти в неделю", href: BOT_HREF, highlighted: false },
];

/* ══ FAQ ITEMS ══ */
const FAQ_ITEMS = [
  { q: "Так, мне правда не нужна категория А? 🤨", a: "Правда — если берёшь электро-эндуро до 4 кВт (L1e-B). По закону достаточно категории B (или M). Покажешь права — садишься. Для полноразмерных ДВС-байков (Ninja 650, R7, GSX-S1000F и т.д.) категория А обязательна." },
  { q: "А ОСАГО и ПТС точно не нужны?", a: "Для электро до 4 кВт — точно. Не регистрируется в ГИБДД, ПТС нет, ОСАГО нет. Никакой бюрократии. Сел — поехал. Для ДВС-байков ОСАГО и СТС уже оформлены на нас, тебе ничего делать не нужно." },
  { q: "А если без прав категории B? 🙃", a: "Тогда никак — закон есть закон. Но если у тебя M или A1 — тоже прокатит, позвони оператору, подберём байк под твою категорию." },
  { q: "Что за СТС вместо депозита? 🪪", a: "Вместо денежного залога 20 000 ₽ можно оставить оригинал СТС своего автомобиля или мотоцикла. СТС возвращаем в течение 3 рабочих дней после возврата байка. Удобно, если не хочешь замораживать кэш." },
  { q: "Можно ли обменять или вернуть байк? 💸", a: "Да. Первые 10 дней — тест-драйв с возвратом денег, если что-то не зашло. Возврат — по акту приёма-передачи, деньги возвращаем в течение 3 рабочих дней." },
  { q: "А если я уроню или утоплю? 😬", a: "Царапины — по прайсу (от 5 000 ₽). Глубокие повреждения — по счёту СТО. Утопление — стоимость восстановительного ремонта. Всё прозрачно, в договоре прописано до копейки. GPS-трекер на каждом байке — это страховка от «байк угнали»." },
  { q: "Доставка есть? 📍", a: "Да. По Нижнему Новгороду — 500 ₽. За пределы города — по согласованию. Привозим и забираем сами, тебе не нужно никуда ехать." },
  { q: "А экипировка? 🪖", a: "Шлем и перчатки — обязательно, выдаём бесплатно. Куртка, черепаха, второй шлем — по запросу. За утрату или порчу экипировки — по прайсу из приложения №3 к договору." },
];

/* ══ HOW IT WORKS — 4 STEPS ══ */
const HOW_IT_WORKS_STEPS = [
  { n: "01", title: "Выбрал", desc: "Жмёшь «Выбрать байк» → попадаешь в каталог. 24 байка от 18 брендов. Смотришь фото, читаешь спеку, выбираешь по сердцу.", emoji: "👆" },
  { n: "02", title: "Забронировал", desc: "В боте @oneBikePlsBot — 2 клика: даты + формат поездки. Депозит или СТС — на твой выбор.", emoji: "📲" },
  { n: "03", title: "Забрал", desc: "Приезжаешь на пл. Комсомольская 2. Подписываешь договор (3 минуты), получаешь байк + экипировку.", emoji: "🔑" },
  { n: "04", title: "Катался", desc: "Откручиваешь ручку. Возвращаешь в согласованное время — забираешь депозит или СТС. Всё.", emoji: "🏍️" },
];

/* ══ Gradient text helper (reused across section headings) ══ */
function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--vip-accent-main), var(--vip-accent-main-hover))` }}>
      {children}
    </span>
  );
}

/* ══ ANIMATED SECTION WRAPPER ══ */
function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }} transition={{ duration: 0.7, delay, ease: "easeOut" }} className={className}>
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

/* ══ HERO IMAGE CAROUSEL — crossfade between 4 images every 5s ══ */
function HeroImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => setIndex((prev) => (prev + 1) % images.length), 5000);
    return () => clearInterval(interval);
  }, [images.length]);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.img key={index} src={images[index]} alt={alt} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.3, ease: "easeInOut" }} className="absolute inset-0 w-full h-full object-cover" loading="eager" />
      </AnimatePresence>
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {images.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} aria-label={`Слайд ${i + 1}`} className="h-1.5 rounded-full transition-all duration-300" style={{ backgroundColor: i === index ? "var(--vip-accent-main)" : "rgba(255,255,255,0.35)", width: i === index ? "28px" : "8px" }} />
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
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">{social.icon.props.children}</svg>
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

/* ══ FAQ ACCORDION ITEM ══ */
function FaqItem({ item, index }: { item: (typeof FAQ_ITEMS)[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={{ duration: 0.5, delay: index * 0.05 }} className="rounded-2xl border overflow-hidden transition-colors duration-300" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: open ? "var(--vip-accent-main)" : "var(--vip-border-soft)" }}>
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

/* ══ PRICING CARD ══ */
function PricingCard({ tier, index }: { tier: (typeof PRICING_TIERS)[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }} transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }} whileHover={{ y: -8 }} className="relative flex flex-col rounded-3xl border-2 p-6 md:p-8 transition-colors duration-300" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: tier.highlighted ? "var(--vip-accent-main)" : "var(--vip-border-soft)", boxShadow: tier.highlighted ? `0 20px 60px color-mix(in srgb, var(--vip-accent-main) 20%, transparent)` : "0 4px 16px rgba(0,0,0,0.15)" }}>
      {tier.highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide" style={{ background: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}>🔥 Хит</div>}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{tier.emoji}</div>
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }} transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }} whileHover={{ y: -8 }} className="relative flex flex-col rounded-3xl border-2 p-6 md:p-8 transition-all duration-300" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: `color-mix(in srgb, ${tier.accentColor} 40%, var(--vip-border-soft))`, boxShadow: `0 10px 40px color-mix(in srgb, ${tier.accentColor} 10%, transparent)` }}>
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: `linear-gradient(135deg, ${tier.accentColor}33, ${tier.accentColor}11)`, border: `1px solid ${tier.accentColor}55` }}>{tier.emoji}</div>
        <div>
          <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: tier.accentColor }}>Уровень 0{index + 1}</div>
          <h4 className="text-2xl md:text-3xl font-black" style={{ color: "var(--vip-text-primary)" }}>{tier.tier}</h4>
        </div>
      </div>
      <p className="text-base font-semibold mb-3" style={{ color: "var(--vip-text-primary)" }}>{tier.tagline}</p>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--vip-text-secondary)" }}>{tier.description}</p>
      <div className="flex items-start gap-2 p-3 rounded-xl mb-6 text-sm font-medium" style={{ backgroundColor: `color-mix(in srgb, ${tier.accentColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${tier.accentColor} 25%, transparent)`, color: "var(--vip-text-primary)" }}>
        <span className="text-lg leading-none" style={{ color: tier.accentColor }}>🪪</span>
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
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  // Delayed fade: stats stay visible longer during scroll.
  const contentOpacity = useTransform(scrollYProgress, [0.3, 0.9], [1, 0]);
  const headlineWords = ["VIP", "BIKE", "RENTAL"];
  const headlineRef = useRef(null);
  const headlineInView = useInView(headlineRef, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden pt-20">
      <motion.div style={{ y: imageY, scale: imageScale }} className="absolute inset-0 z-0">
        <HeroImageCarousel images={HERO_IMAGES} alt="VIP Bike — аренда мотоциклов в Нижнем Новгороде: электро и ДВС" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--vip-bg-base) 70%, transparent) 0%, color-mix(in srgb, var(--vip-bg-base) 35%, transparent) 45%, var(--vip-bg-base) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 40%, transparent 0%, color-mix(in srgb, var(--vip-bg-base) 65%, transparent) 100%)" }} />
      </motion.div>
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] z-[1] pointer-events-none" style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.08 }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] z-[1] pointer-events-none" style={{ backgroundColor: "#26A5E4", opacity: 0.06 }} />

      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative z-10 max-w-5xl mx-auto px-4 text-center w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-6">
          <Badge variant="outline" className="px-4 py-2 text-sm" style={{ borderColor: "var(--vip-accent-main)", color: "var(--vip-accent-main)", backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)", backdropFilter: "blur(8px)" }}>⚡️ Электро и ДВС мотоциклы в аренду</Badge>
        </motion.div>
        <h2 ref={headlineRef} className="text-5xl sm:text-7xl md:text-8xl font-black mb-6 leading-[0.95] tracking-tight" style={{ color: "var(--vip-text-primary)" }}>
          {headlineWords.map((word, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 60, rotateX: -90 }} animate={headlineInView ? { opacity: 1, y: 0, rotateX: 0 } : {}} transition={{ duration: 0.7, delay: 0.2 + i * 0.15, ease: [0.215, 0.61, 0.355, 1] }} className="inline-block mr-4 last:mr-0" style={{ backgroundImage: i === 2 ? "linear-gradient(to right, var(--vip-accent-main), var(--vip-accent-main-hover), var(--vip-accent-main))" : "none", WebkitBackgroundClip: i === 2 ? "text" : "unset", WebkitTextFillColor: i === 2 ? "transparent" : "var(--vip-text-primary)", backgroundClip: "text", transformOrigin: "bottom" }}>{word}</motion.span>
          ))}
        </h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7 }} className="text-lg md:text-2xl max-w-2xl mx-auto mb-4 leading-relaxed font-medium" style={{ color: "var(--vip-text-primary)" }}>Аренда мотоциклов без заморочек 🏍️💨</motion.p>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.85 }} className="text-base md:text-lg max-w-2xl mx-auto mb-10" style={{ color: "var(--vip-text-secondary)" }}>24 байка от 18 брендов. Электро-эндуро без категории А, мощные электросуперкары и классические спортбайки. Выбери свой — садись и поезжай.</motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1 }} className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10">
          {[
            { text: "⚡️", detail: "электро и ДВС" },
            { text: "10 дней", detail: "на возврат, деньги обратно" },
            { text: "🪪 СТС", detail: "вместо депозита" },
          ].map((pill, i) => (
            <div key={i} className="px-4 py-2 rounded-full border text-sm backdrop-blur-sm" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 70%, transparent)" }}>
              <span className="font-semibold" style={{ color: "var(--vip-accent-main)" }}>{pill.text}</span>{" "}
              <span style={{ color: "var(--vip-text-secondary)" }}>{pill.detail}</span>
            </div>
          ))}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1.15 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <MagneticButton href={CATALOG_HREF} primary>Выбрать байк<ArrowRight /></MagneticButton>
          <MagneticButton href={BOT_HREF}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2 inline"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
            Бронь в боте
          </MagneticButton>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.4 }} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mt-16 pt-8 border-t" style={{ borderColor: "var(--vip-border-soft)" }}>
          {HERO_STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-black mb-1" style={{ color: "var(--vip-text-primary)" }}><AnimatedCounter value={stat.value} suffix={stat.suffix} decimals={0} /></div>
              <div className="text-xs md:text-sm uppercase tracking-wide" style={{ color: "var(--vip-text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2" style={{ color: "var(--vip-text-secondary)" }}>
        <span className="text-xs uppercase tracking-widest">Листай вниз</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </motion.div>
      </motion.div>
    </section>
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
    { label: "Каталог", href: "#catalog" }, { label: "Уровни", href: "#tiers" },
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
        <FloatingSocialBar />

        {/* ─── HEADER ─── */}
        <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "color-mix(in srgb, var(--vip-bg-base) 80%, transparent)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(to-br, var(--vip-accent-main), var(--vip-accent-main-hover))" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--vip-bg-base)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M5 16v-4a8 8 0 0116 0v4" /><circle cx="8" cy="16" r="2" /><circle cx="16" cy="16" r="2" /><path d="M10 16h4" /></svg>
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight" style={{ color: "var(--vip-text-primary)" }}>VIP BIKE</h1>
                <p className="text-[10px] leading-tight hidden sm:block" style={{ color: "var(--vip-text-secondary)" }}>Аренда мотоциклов в Нижнем</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              {navLinks.map((link) => (<a key={link.href} href={link.href} className="transition-colors duration-200 hover:opacity-80" style={{ color: "var(--vip-text-secondary)" }}>{link.label}</a>))}
              <ThemeToggleButton size="md" />
              <MagneticButton href={CATALOG_HREF} primary size="sm">Забронировать</MagneticButton>
            </nav>
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggleButton size="sm" />
              <button className="p-2" style={{ color: "var(--vip-text-primary)" }} onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
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

        <main className="flex-1">
          <CinematicHero />

          {/* ─── SOCIAL CIRCLES ROW (right after hero) ─── */}
          <section className="py-14 md:py-20 px-4 border-b" style={{ borderColor: "var(--vip-border-soft)" }}>
            <div className="max-w-4xl mx-auto">
              <SectionHeader badge="Мы в соцсетях 📱" title="Подписывайся и" highlight="будь в теме" subtitle="Покатушки, эксклюзивы, мемы. Выбирай платформу — мы везде." />
              <div className="flex flex-wrap justify-center items-start gap-6 md:gap-10">
                {SOCIAL_LINKS.map((social, idx) => (<SocialCircleButton key={social.id} social={social} index={idx} />))}
              </div>
            </div>
          </section>

          {/* ─── BARRIER CARDS (why electro) ─── */}
          <section id="catalog" className="py-20 md:py-28 px-4">
            <div className="max-w-7xl mx-auto">
              <SectionHeader badge="Почему мы, а не бензин ⛽️❌" title="Три барьера," highlight="которые мы снесли" subtitle="Тестили наши электро-эндуро везде: город, просёлок, снег, грязь, лёд. Без пинков, без отказов, без драмы." />
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { id: "prohodimost", number: "01", title: "Поле, лес, грязь, лестницы 🌲", description: "Кочки, корни, песок, снег, подъёмы и спуски. Куда сам дошёл — туда и заехал. В обзорах «корни съел как не фиг на фиг», едет по кроссовой трассе наравне с бензином.", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b1-prohodimost.jpeg" },
                  { id: "razgon", number: "02", title: "Выстреливает из рогатки 🚀", description: "Электро-тяга бьёт мгновенно — без сцепления и передач. Проваливаешься в седло как в суперкаре. Открутил ручку — и поехал, на максимум сразу.", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg" },
                  { id: "voda", number: "03", title: "Топили в озере — едет 🌊", description: "Влагозащита IP67. На тесте погружали в ледяное озеро — завёлся, год катается. Лужи, дождь, мокрая трава — без последствий.", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b3-voda.jpeg" },
                ].map((card, idx) => (
                  <AnimatedSection key={card.id} delay={idx * 0.15}>
                    <Card className="overflow-hidden group transition-all duration-500 hover:-translate-y-2 hover:shadow-xl" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                      <div className="relative aspect-video bg-gradient-to-br overflow-hidden" style={{ backgroundImage: "linear-gradient(to bottom right, #1e293b, #0f172a)" }}>
                        <motion.img src={card.image} alt={card.title} className="object-cover w-full h-full" whileHover={{ scale: 1.1 }} transition={{ duration: 0.7 }} />
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 20%, transparent)", border: "1px solid color-mix(in srgb, var(--vip-accent-main) 30%, transparent)" }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--vip-accent-main)" strokeWidth="2" className="w-5 h-5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                          </div>
                          <span className="text-2xl font-bold text-white drop-shadow-lg">{card.number}</span>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <h4 className="text-xl font-bold mb-3" style={{ color: "var(--vip-text-primary)" }}>{card.title}</h4>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>{card.description}</p>
                      </CardContent>
                    </Card>
                  </AnimatedSection>
                ))}
              </div>
              <AnimatedSection delay={0.4} className="text-center mt-12">
                <MagneticButton href={CATALOG_HREF} primary>Смотреть все 24 байка в каталоге<ArrowRight /></MagneticButton>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── BIKE TIERS (3 experience levels) ─── */}
          <section id="tiers" className="py-20 md:py-28 px-4 relative overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 40%, transparent)" }}>
            <div className="max-w-7xl mx-auto relative z-10">
              <SectionHeader badge="Каталог 24 байков 🏍️" title="Байк под" highlight="твой уровень" subtitle="От лёгких электро-эндуро для новичков до полноразмерных спортбайков для профи. Выбери категорию — покажем подходящие байки." />
              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {BIKE_TIERS.map((tier, idx) => (<BikeTierCard key={tier.id} tier={tier} index={idx} />))}
              </div>
              <AnimatedSection delay={0.4} className="text-center mt-12">
                <p className="text-sm max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>💡 Не знаешь, какой выбрать? Напиши оператору{" "}<a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>@I_O_S_NN</a>{" "}— подберём под твой опыт и задачи.</p>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section id="how" className="py-20 md:py-28 px-4 relative overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 40%, transparent)" }}>
            <div className="max-w-6xl mx-auto relative z-10">
              <SectionHeader badge="Как это работает 🛠️" title="Забери. Покатайся." highlight="Верни." subtitle="От «хочу» до «катюсь» — 15 минут. Без очередей, без бумажной волокиты, без звонков «а можно забронировать?»." />
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 z-0" style={{ background: "linear-gradient(to right, transparent, var(--vip-accent-main), transparent)", opacity: 0.3 }} />
                {HOW_IT_WORKS_STEPS.map((step, idx) => (
                  <AnimatedSection key={step.n} delay={idx * 0.15} className="relative z-10">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative w-24 h-24 rounded-full flex items-center justify-center mb-5 text-4xl transition-transform duration-300 hover:scale-110" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--vip-accent-main) 20%, transparent), color-mix(in srgb, var(--vip-accent-main) 5%, transparent))", border: "2px solid color-mix(in srgb, var(--vip-accent-main) 40%, transparent)", backdropFilter: "blur(8px)" }}>
                        <span>{step.emoji}</span>
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
              <SectionHeader badge="Тарифы 💰" title="Платишь за время," highlight="не за нервы" subtitle="Никаких скрытых платежей. Депозит или СТС — на выбор. Скидки от объёма работают автоматически." />
              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {PRICING_TIERS.map((tier, idx) => (<PricingCard key={tier.id} tier={tier} index={idx} />))}
              </div>
              <AnimatedSection delay={0.5} className="text-center mt-10">
                <p className="text-sm" style={{ color: "var(--vip-text-secondary)" }}>💡 Не нашёл подходящий тариф? Напиши оператору{" "}<a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>@I_O_S_NN</a>{" "}— соберём индивидуальный пакет.</p>
              </AnimatedSection>
            </div>
          </section>

          {/* ─── ABOUT ─── */}
          <section id="about" className="py-20 md:py-28 px-4" style={{ backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 40%, transparent)" }}>
            <div className="max-w-7xl mx-auto">
              <SectionHeader badge="О нас 🤙" title="VIP Bike —" highlight="аренда мотоциклов в Нижнем" subtitle="24 байка от 18 брендов. Электро и ДВС. Доставка по городу. Без скрытых платежей." />
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "⚡️ Быстрая онлайн-бронь", desc: "Выбирай байк, даты и формат поездки в пару кликов в боте" },
                  { title: "🪪 Электро без категории А", desc: "Лёгкие электро-эндуро законно по правам категории B" },
                  { title: "🛡️ СТС вместо депозита", desc: "Не замораживай кэш — оставь СТС своего авто" },
                  { title: "📍 Центр Нижнего", desc: "пл. Комсомольская 2 — удобно добираться из любой точки города" },
                ].map((feature, idx) => (
                  <AnimatedSection key={feature.title} delay={idx * 0.1}>
                    <div className="p-6 rounded-2xl border text-center transition-all duration-300 group h-full hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
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
              <SectionHeader badge="FAQ 🤔" title="Вопросы, которые" highlight="задают всегда" />
              <p className="text-lg text-center -mt-10 mb-12" style={{ color: "var(--vip-text-secondary)" }}>Коротко, честно, без воды. Если чего-то нет — пиши в{" "}<a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>@I_O_S_NN</a>.</p>
              <div className="space-y-3">
                {FAQ_ITEMS.map((item, idx) => (<FaqItem key={idx} item={item} index={idx} />))}
              </div>
            </div>
          </section>

          {/* ─── CONTACTS ─── */}
          <section id="contacts" className="py-20 md:py-28 px-4" style={{ backgroundColor: "color-mix(in srgb, var(--vip-bg-card) 40%, transparent)" }}>
            <div className="max-w-4xl mx-auto">
              <SectionHeader badge="Контакты 📞" title="Свяжись" highlight="с нами" subtitle="Всегда на связи — выбирай удобный способ" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatedSection>
                  <a href={CONTACT_INFO.phoneHref} className="flex flex-col items-center gap-4 p-8 rounded-2xl border transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--vip-accent-main) 20%, transparent)" }}>
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-7 h-7" style={{ stroke: "var(--vip-accent-main)" }}><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>{CONTACT_INFO.phone}</p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Позвонить</p>
                    </div>
                  </a>
                </AnimatedSection>
                <AnimatedSection delay={0.1}>
                  <a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-4 p-8 rounded-2xl border transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: "color-mix(in srgb, #26A5E4 10%, transparent)", border: "1px solid color-mix(in srgb, #26A5E4 20%, transparent)" }}>
                      <svg viewBox="0 0 24 24" fill="#26A5E4" className="w-7 h-7"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>@I_O_S_NN</p>
                      <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Telegram оператор</p>
                    </div>
                  </a>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                  <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border sm:col-span-2 lg:col-span-1" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--vip-accent-main) 20%, transparent)" }}>
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-7 h-7" style={{ stroke: "var(--vip-accent-main)" }}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
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

          {/* ─── FINAL CTA ─── */}
          <section className="py-24 md:py-32 px-4 relative overflow-hidden">
            <div className="absolute inset-0">
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, var(--vip-bg-base), color-mix(in srgb, var(--vip-bg-base) 50%, transparent), var(--vip-bg-base))" }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[150px]" style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.08 }} />
            </div>
            <div className="max-w-4xl mx-auto text-center relative z-10">
              <AnimatedSection>
                <Badge variant="outline" className="mb-6" style={{ borderColor: "var(--vip-accent-main)", color: "var(--vip-accent-main)", backgroundColor: "color-mix(in srgb, var(--vip-accent-main) 10%, transparent)" }}>Готов к выезду? 🔥</Badge>
                <h3 className="text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tight" style={{ color: "var(--vip-text-primary)" }}>Начни свой <GradientText>путь</GradientText> сегодня</h3>
                <p className="text-xl max-w-2xl mx-auto mb-10" style={{ color: "var(--vip-text-secondary)" }}>Выбери байк. Забронируй слот. Покатайся. Верни. Никакой волокиты — только кайф.</p>
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
        </main>

        {/* ─── FOOTER (redesigned) ─── */}
        <footer className="relative border-t overflow-hidden mt-auto" style={{ borderColor: "var(--vip-border-soft)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, var(--vip-bg-base), color-mix(in srgb, var(--vip-accent-main) 4%, var(--vip-bg-base)))" }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: "var(--vip-accent-main)", opacity: 0.05 }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              {/* Brand + tagline + contact */}
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(to-br, var(--vip-accent-main), var(--vip-accent-main-hover))" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--vip-bg-base)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M5 16v-4a8 8 0 0116 0v4" /><circle cx="8" cy="16" r="2" /><circle cx="16" cy="16" r="2" /><path d="M10 16h4" /></svg>
                  </div>
                  <div>
                    <h4 className="font-black text-xl leading-tight" style={{ color: "var(--vip-text-primary)" }}>VIP BIKE</h4>
                    <p className="text-xs" style={{ color: "var(--vip-text-secondary)" }}>Аренда мотоциклов</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--vip-text-secondary)" }}>Аренда мотоциклов в Нижнем Новгороде. 24 байка от 18 брендов. Электро и ДВС. Доставка по городу. ⚡️🏍️</p>
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
                    { label: "Instagram", href: INSTAGRAM_HREF, external: true },
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
                <div className="flex flex-wrap gap-3">
                  {SOCIAL_LINKS.map((social) => (
                    <a key={social.id} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} title={social.label} className="group w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-1" style={{ backgroundColor: `color-mix(in srgb, ${social.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${social.color} 30%, transparent)` }}>
                      <div className="transition-colors duration-300" style={{ color: social.color }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">{social.icon.props.children}</svg>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--vip-border-soft)" }}>
              <p className="text-xs" style={{ color: "var(--vip-text-secondary)" }}>&copy; {new Date().getFullYear()} VIP BIKE — аренда мотоциклов в Нижнем Новгороде ⚡️</p>
              <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-xs transition-colors hover:opacity-80" style={{ color: "var(--vip-text-secondary)" }}>powered by oneSitePls &middot; @SALAVEY13</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
