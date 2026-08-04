"use client";

// app/about/page.tsx — enhanced About / CV
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Crown,
  Gamepad2,
  Gem,
  Github,
  Inbox,
  Layers,
  MapPin,
  PenTool,
  Rocket,
  Send,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";

type IconType = React.ComponentType<{ className?: string }>;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const coreBlocks: { icon: IconType; title: string; text: string; chip: string }[] = [
  {
    icon: Bot,
    title: "Кто я",
    text: "13+ лет в разработке (C++/Java/TS), сегодня — AI Product Engineer. Моя зона силы: быстро превращать бизнес-запрос в рабочий веб-контур с понятной приёмкой и дальнейшим ростом.",
    chip: "from-[hsl(36_92%_68%/0.2)] to-[hsl(7_88%_62%/0.12)] text-[hsl(var(--primary))]",
  },
  {
    icon: Gem,
    title: "Что даю клиенту",
    text: "Не просто «страницу», а работающий продуктовый ритм: архитектура, интеграции, операционный UX, быстрые итерации и контроль качества по живым результатам.",
    chip: "from-[hsl(188_85%_58%/0.18)] to-[hsl(36_92%_68%/0.1)] text-[hsl(188_85%_58%)]",
  },
  {
    icon: Workflow,
    title: "Как работаю",
    text: "BOSS-mode delivery: intake запроса → декомпозиция → быстрый выкат рабочих слайсов → полировка под реальный контекст команды и продаж.",
    chip: "from-[hsl(275_72%_58%/0.18)] to-[hsl(340_82%_60%/0.1)] text-[hsl(275_72%_58%)]",
  },
];

const processSteps: { icon: IconType; n: string; title: string; text: string }[] = [
  {
    icon: Inbox,
    n: "01",
    title: "Intake",
    text: "Запрос клиента + референсы, изображения и материалы. Минимум бюрократии — максимум контекста.",
  },
  {
    icon: Workflow,
    n: "02",
    title: "Декомпозиция",
    text: "Превращаю запрос в поэтапный executable-план с точками контроля качества и приёмки.",
  },
  {
    icon: Rocket,
    n: "03",
    title: "Выкат слайсов",
    text: "Быстрые рабочие итерации: каждый слайс видно и можно потрогать, а не «ждать релиза».",
  },
  {
    icon: PenTool,
    n: "04",
    title: "Полировка",
    text: "Точечная доводка под реальный контекст команды, продаж и живых пользователей.",
  },
];

const flagship: {
  icon: IconType;
  name: string;
  proof: string;
  details: string;
  href: string;
  external?: boolean;
  tags: string[];
}[] = [
  {
    icon: Layers,
    name: "Franchize + VIP Bike",
    proof: "Полноценный запуск через hydration SQL",
    details:
      "Модель, где новый бизнес-контур собирается из single SQL seed + market/items. /vipbikerental показывает, как быстро запустить не мокап, а живую систему.",
    href: "/vipbikerental",
    tags: ["hydration SQL", "market-пакет", "franchize"],
  },
  {
    icon: Gamepad2,
    name: "WBlanding",
    proof: "Лендинг как операционная панель",
    details:
      "Action-слои, crew, audit, referral, invoicing и коммерческая логика в одном пространстве. Это интерфейс для действий, а не «декоративная обложка».",
    href: "/wblanding",
    tags: ["crew", "invoicing", "operational UX"],
  },
  {
    icon: Crown,
    name: "BOSS_QUEST.HTML",
    proof: "Последний и главный протокол взаимодействия",
    details:
      "Один запрос + пару изображений превращаю в исполнимый квест-план: BOSS ведёт delivery end-to-end, клиент концентрируется на acceptance и polishing.",
    href: "https://github.com/salavey13/carTest/blob/main/BOSS_QUEST.HTML",
    external: true,
    tags: ["BOSS-mode", "AI delivery", "protocol"],
  },
];

const stats = [
  { value: "13+", label: "лет в разработке" },
  { value: "3", label: "продуктовых трека" },
  { value: "7+", label: "интеграций в контуре" },
  { value: "24/7", label: "AI-assisted delivery" },
];

const stack = [
  "Next.js 14",
  "React 18",
  "TypeScript",
  "Supabase",
  "Telegram Bot API",
  "Telegram WebApp",
  "Tailwind CSS",
  "Vercel",
  "GitHub Actions",
  "Gemini · ZAI · Claude",
];

export default function AboutPage() {
