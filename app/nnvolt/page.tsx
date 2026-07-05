"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Zap,
  Shield,
  Hospital,
  GraduationCap,
  Home,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Award,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Cable,
  Wrench,
  FileCheck,
  Clock,
  Users,
  ClipboardList,
  Calculator,
  Send,
  CircleDollarSign,
  Lightbulb,
  Plug,
  Cpu,
  Hammer,
  Eye,
  Truck,
  UserCheck,
  FlameKindling,
  Cable as CableIcon,
  Layers,
  List,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── Animated Section ─── */
function Anim({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ─── Counter ─── */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let s = 0;
    const inc = target / (2000 / 16);
    const t = setInterval(() => {
      s += inc;
      if (s >= target) { setCount(target); clearInterval(t); }
      else setCount(Math.floor(s));
    }, 16);
    return () => clearInterval(t);
  }, [inView, target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Header ─── */
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const links = [
    { label: "Услуги", href: "#services" },
    { label: "Портфолио", href: "#portfolio" },
    { label: "Бригада", href: "#team" },
    { label: "Калькулятор", href: "#calculator" },
    { label: "FAQ", href: "#faq" },
    { label: "Контакты", href: "#contacts" },
  ];

  // Reliable scroll: JS scrollIntoView instead of relying on hash anchor,
  // which can glitch inside framer-motion animated containers.
  const scrollTo = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const headerBlur =
    scrolled || mobileOpen
      ? "bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/30"
      : "bg-transparent";

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBlur}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="relative">
              <Zap className="w-8 h-8 text-volt group-hover:text-electric-blue transition-colors duration-300" />
              <div className="absolute inset-0 bg-volt/20 rounded-full blur-lg group-hover:bg-electric-blue/20 transition-colors duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-[0.15em] text-white leading-none">
                NN VOLT
              </span>
              <span className="text-[9px] tracking-[0.25em] text-volt font-semibold leading-none mt-0.5">
                ЭЛЕКТРОМОНТАЖ
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-0.5">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={scrollTo(l.href)}
                className="px-3.5 py-2 text-[13px] font-medium text-white/60 hover:text-volt transition-colors tracking-wide uppercase"
              >
                {l.label}
              </a>
            ))}
            <a href="#contacts" onClick={scrollTo("#contacts")}>
              <Button className="ml-3 bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wide uppercase text-xs px-5">
                Вызвать электрика
              </Button>
            </a>
          </nav>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white/60 hover:text-volt transition-colors"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a0a]/98 backdrop-blur-md border-t border-white/5"
          >
            <div className="px-4 py-4 space-y-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => {
                    setMobileOpen(false);
                    scrollTo(l.href)(e);
                  }}
                  className="block px-4 py-3 text-sm font-medium text-white/60 hover:text-volt hover:bg-white/5 rounded transition-colors tracking-wide uppercase"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="#contacts"
                onClick={(e) => {
                  setMobileOpen(false);
                  scrollTo("#contacts")(e);
                }}
              >
                <Button className="w-full mt-2 bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wide uppercase text-xs">
                  Вызвать электрика
                </Button>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/images/hero-team-nnvolt.png"
          alt="Бригада NN VOLT — профессиональные электромонтажники"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-black/30" />
      </div>
      <div className="absolute inset-0 grid-bg opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 sm:py-40">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-2 mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-volt animate-pulse" />
            <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
              СРО &bull; Допуск до 10 кВ &bull; Гарантия 1 год
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight sm:leading-[1.05] tracking-tight mb-6"
          >
            NN VOLT —{" "}
            <span className="text-volt">Электромонтаж</span>
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>
            <span className="text-white/50 text-3xl sm:text-4xl lg:text-5xl font-light tracking-wide">
              любой сложности. Под ключ.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-white/45 text-base sm:text-lg max-w-xl mb-8 leading-relaxed"
          >
            Профессиональная электромонтажная бригада из 5 сертифицированных
            специалистов. Новостройки, школы, больницы, высокое напряжение.
            Безопасно. Надёжно. По ГОСТу.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <a href="#contacts">
              <Button
                size="lg"
                className="bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wider uppercase text-sm px-8 py-6 shadow-volt-glow"
              >
                Вызвать электрика
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
            <a href="#calculator">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5 hover:border-volt/50 tracking-wider uppercase text-sm px-8 py-6"
              >
                <Calculator className="mr-2 w-4 h-4" />
                Калькулятор цен
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 1 }}
            className="flex flex-wrap gap-8 sm:gap-12 mt-12 pt-8 border-t border-white/10"
          >
            {[
              { value: 15, suffix: "+", label: "Лет опыта" },
              { value: 20, suffix: "+", label: "Объектов сдано" },
              { value: 5, suffix: "", label: "Специалистов" },
              { value: 1, suffix: " год", label: "Гарантия" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-2xl sm:text-3xl font-black text-volt">
                  <Counter target={s.value} suffix={s.suffix} />
                </div>
                <div className="text-xs text-white/35 tracking-wider uppercase mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 hazard-stripe" />
    </section>
  );
}

/* ─── Services ─── */
function Services() {
  const services = [
    {
      icon: Home,
      title: "Новостройки и квартиры",
      pitch: "Полный электромонтаж в новостройках под ключ: от щитка до розеток. Замена проводки, сборка щитов, установка розеток и освещения.",
      image: "/images/work-sockets.png",
      tags: ["Проводка под ключ", "Сборка щитов", "Розетки и свет", "Умный дом"],
      accent: "volt",
    },
    {
      icon: GraduationCap,
      title: "Школы и садики",
      pitch: "Безопасный электромонтаж для социальных объектов с соблюдением всех норм и требований к детским учреждениям.",
      image: "/images/school.png",
      tags: ["ПУЭ и СНиП", "Аварийное освещение", "Пожарная сигнализация", "ИТ-сети"],
      accent: "electric-blue",
    },
    {
      icon: Hospital,
      title: "Больницы",
      pitch: "Надёжные электрические сети для медицинских учреждений, включая резервные источники питания и ИТ-сети операционных.",
      image: "/images/medical.png",
      tags: ["Резервное питание", "ИТ-сети", "Операционные", "ИБП системы"],
      accent: "volt",
    },
    {
      icon: Zap,
      title: "Высокое напряжение",
      pitch: "Работа с кабелем высокого напряжения на промышленных объектах. Допуск к работам до 10 кВ.",
      image: "/images/work-outdoor-hv.png",
      tags: ["До 10 кВ", "Кабельные муфты", "Подстанции", "Трансформаторы"],
      accent: "electric-blue",
    },
  ];

  return (
    <section id="services" className="relative py-20 sm:py-28 grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Anim>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-volt" />
              <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
                Услуги
              </span>
              <div className="h-px w-8 bg-volt" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Направления работ
            </h2>
            <p className="text-white/35 mt-4 max-w-2xl mx-auto">
              Четыре профильных направления, где наша бригада гарантирует качество и соблюдение всех норм.
            </p>
          </div>
        </Anim>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {services.map((s, i) => (
            <Anim key={i} delay={i * 0.1}>
              <Card className="group relative overflow-hidden bg-[#111] border-white/5 hover:border-volt/20 hover:shadow-lg hover:shadow-volt/5 transition-all duration-500 h-full">
                <div className="relative h-48 sm:h-56 overflow-hidden">
                  <img
                    src={s.image}
                    alt={s.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/40 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                        s.accent === "volt"
                          ? "bg-volt/10 text-volt"
                          : "bg-electric-blue/10 text-electric-blue"
                      }`}
                    >
                      <s.icon className="w-5 h-5" />
                    </div>
                  </div>
                </div>
                <CardContent className="pt-0 pb-5 sm:pb-6 px-4 sm:px-6">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">{s.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-3 sm:mb-4">{s.pitch}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {s.tags.map((tag, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle2 className="w-3 h-3 text-volt/60 flex-shrink-0" />
                        <span>{tag}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Work Steps ─── */
function WorkSteps() {
  const steps = [
    {
      num: "01",
      icon: Phone,
      title: "Заявка и выезд",
      text: "Свяжитесь с нами. Бригадир выезжает на объект для замеров и составления точной сметы.",
    },
    {
      num: "02",
      icon: ClipboardList,
      title: "Договор и закупка",
      text: "Заключаем договор подряда, согласовываем материалы и закупаем оборудование у проверенных поставщиков.",
    },
    {
      num: "03",
      icon: Wrench,
      title: "Монтажные работы",
      text: "Прокладка кабеля, установка щитков, розеток, освещения. Строгое соблюдение техники безопасности.",
    },
    {
      num: "04",
      icon: CheckCircle2,
      title: "Сдача и гарантия",
      text: "Проверка работы всех систем, инструктаж заказчика и подписание акта сдачи-приёмки с гарантией 1 год.",
    },
  ];

  return (
    <section id="steps" className="relative py-20 sm:py-28 bg-[#0a0a0a]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-volt/15 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Anim>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-electric-blue" />
              <span className="text-electric-blue text-xs font-bold tracking-[0.25em] uppercase">
                Этапы работ
              </span>
              <div className="h-px w-8 bg-electric-blue" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Как мы работаем
            </h2>
          </div>
        </Anim>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {steps.map((s, i) => (
            <Anim key={i} delay={i * 0.12}>
              <div className="relative h-full p-5 sm:p-6 bg-[#111] border border-white/5 rounded-2xl hover:border-volt/15 hover:shadow-lg hover:shadow-volt/5 hover:-translate-y-1 transition-all duration-300 group">
                <div className="text-volt/10 text-5xl sm:text-6xl font-black absolute top-3 right-3 sm:right-4 leading-none select-none">
                  {s.num}
                </div>
                <div className="w-12 h-12 rounded-xl bg-volt/5 border border-volt/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:bg-volt/10 group-hover:scale-110 transition-all duration-300">
                  <s.icon className="w-5 h-5 text-volt/70" />
                </div>
                <h3 className="text-white font-bold text-base sm:text-lg mb-1.5 sm:mb-2">{s.title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{s.text}</p>
              </div>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Portfolio ─── */
function Portfolio() {
  const projects = [
    {
      image: "/images/portfolio-img4182.jpeg",
      title: "Сборка электрощита",
      cat: "Новостройки",
      specs: "Щит 54 модуля | ABB | 3-фазный ввод",
    },
    {
      image: "/images/portfolio-img3721.jpeg",
      title: "Распределительный щит",
      cat: "Коммерция",
      specs: "Ввод 400А | УЗО + АВ | IP54",
    },
    {
      image: "/images/portfolio-img3575.jpeg",
      title: "Прокладка кабельных трасс",
      cat: "Инфраструктура",
      specs: "ВВГнг-LS 3×2.5 | Лотки 200мм | 1.2 км",
    },
    {
      image: "/images/portfolio-img3572.jpeg",
      title: "Работы на ВЛ 10 кВ",
      cat: "Высокое напряжение",
      specs: "Кабельная муфта 10 кВ | ТП 630 кВА",
    },
    {
      image: "/images/work-ceiling-lights.png",
      title: "Монтаж точечного света",
      cat: "Новостройки",
      specs: "LED 12В | 36 точек | Диммирование",
    },
    {
      image: "/images/portfolio-wiring.png",
      title: "Монтаж точной проводки",
      cat: "Медицина",
      specs: "ИТ-сеть операционной | Изолированная нейтраль",
    },
  ];

  return (
    <section id="portfolio" className="relative py-20 sm:py-28 grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Anim>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-volt" />
              <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
                Портфолио
              </span>
              <div className="h-px w-8 bg-volt" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Наши работы
            </h2>
            <p className="text-white/35 mt-4 max-w-xl mx-auto">
              Каждый объект выполнен с одинаково высоким стандартом качества.
            </p>
          </div>
        </Anim>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {projects.map((p, i) => (
            <Anim key={i} delay={i * 0.08}>
              <Card className="group relative overflow-hidden bg-[#111] border-white/5 hover:border-volt/15 hover:shadow-lg hover:shadow-volt/5 transition-all duration-500 cursor-pointer">
                <div className="relative h-56 sm:h-60 lg:h-64 overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-3 right-3">
                    <Badge
                      variant="outline"
                      className="bg-black/60 border-volt/25 text-volt text-[10px] tracking-wider uppercase"
                    >
                      {p.cat}
                    </Badge>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-bold text-sm mb-1">{p.title}</h3>
                    <p className="text-white/35 text-[11px] font-mono">{p.specs}</p>
                  </div>
                </div>
              </Card>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Team (expandable, first open) ─── */
function TeamSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const members = [
    {
      name: "Слаботочник",
      role: "Электромонтажник 4 разряда",
      perk: "Слаботочные сети",
      description: "Специалист по слаботочным системам: видеонаблюдение, СКС, охранно-пожарная сигнализация, СКУД. Монтаж и пусконаладка.",
      photo: "/images/team-photo-2.jpeg",
      skills: ["СКС", "Видеонаблюдение", "ОПС", "СКУД"],
      icon: Cable,
    },
    {
      name: "Щиточник",
      role: "Электромонтажник 4 разряда",
      perk: "Сборка электрощитов",
      description: "Профессиональная сборка распределительных щитов любой сложности. Работает с ABB, Schneider, Legrand. Чистота монтажа — визитная карточка.",
      photo: "/images/portfolio-switchboard.png",
      skills: ["Щиты до 96 модулей", "ABB / Schneider", "УЗО + АВ", "IP54+"],
      icon: Cpu,
    },
    {
      name: "Монтажник",
      role: "Электромонтажник 3 разряда",
      perk: "Штробление и прокладка",
      description: "Мастер штробления и прокладки кабельных трасс. Работает с бетоном, кирпичом, гипсом. Быстро и аккуратно — без лишней пыли и повреждений.",
      photo: "/images/work-cable-routing.png",
      skills: ["Штробление бетона", "Прокладка в лотках", "Гофра и трубы", "Кабель-каналы"],
      icon: Hammer,
    },
    {
      name: "Контролёр",
      role: "Электромонтажник 5 разряда",
      perk: "Приёмка и проверка",
      description: "Отвечает за контроль качества выполненных работ. Проверяет соответствие ПУЭ, замеряет сопротивление изоляции, оформляет акты скрытых работ.",
      photo: "/images/work-ceiling-lights.png",
      skills: ["Проверка ПУЭ", "Замеры изоляции", "Акты скрытых работ", "Инструктаж"],
      icon: Eye,
    },
    {
      name: "Администратор",
      role: "Электромонтажник 5 разряда",
      perk: "Прием заявок и связь с клиентами",
      description: "Обрабатывает входящие заявки, координирует выезд бригады на объект. Первичная консультация и запись на замеры.",
      photo: "/images/team-photo.jpeg",
      skills: ["Обработка заявок", "Координация выезда", "Консультации", "Запись на замеры"],
      icon: Shield,
    },
  ];

  return (
    <section id="team" className="relative py-20 sm:py-28 bg-[#0a0a0a]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-volt/15 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Anim>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-volt" />
              <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
                Наша бригада
              </span>
              <div className="h-px w-8 bg-volt" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              5 специалистов —{" "}
              <span className="text-volt text-shadow-volt-glow">одна команда</span>
            </h2>
            <p className="text-white/35 mt-4 max-w-xl mx-auto">
              Каждый член бригады — сертифицированный специалист со своей зоной ответственности.
            </p>
          </div>
        </Anim>

        <div className="space-y-2 sm:space-y-3">
          {members.map((m, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer ${
                    isOpen
                      ? "bg-[#111] border-volt/25 shadow-lg shadow-volt/5"
                      : "bg-[#0e0e0e] border-white/5 hover:border-white/10"
                  }`}
                  onClick={() => setOpenIndex(isOpen ? -1 : i)}
                >
                  {/* Collapsed Header */}
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                      <img
                        src={m.photo}
                        alt={m.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-white font-bold text-sm sm:text-base">{m.name}</h4>
                        <Badge
                          variant="outline"
                          className="text-[9px] tracking-wider uppercase border-volt/20 text-volt/70"
                        >
                          {m.perk}
                        </Badge>
                      </div>
                      <p className="text-white/35 text-xs sm:text-sm mt-0.5">{m.role}</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-white/20 transition-transform duration-300 flex-shrink-0 ${
                        isOpen ? "rotate-180 text-volt/50" : ""
                      }`}
                    />
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="px-4 sm:px-5 pb-5">
                          <div className="flex flex-col sm:flex-row gap-5">
                            {/* Photo */}
                            <div className="w-full sm:w-48 aspect-square sm:aspect-auto sm:h-44 rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
                              <img
                                src={m.photo}
                                alt={m.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {/* Details */}
                            <div className="flex-1">
                              <p className="text-white/45 text-sm leading-relaxed mb-4">
                                {m.description}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {m.skills.map((sk, j) => (
                                  <div
                                    key={j}
                                    className="flex items-center gap-2 text-xs text-white/50"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-volt/60 flex-shrink-0" />
                                    <span>{sk}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Price Calculator ─── */
function PriceCalculator() {
  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const [roomType, setRoomType] = useState<"1k" | "2k" | "3k">("1k");

  const [calc, setCalc] = useState({
    sockets: 0,
    switches: 0,
    lights: 0,
    cableMeters: 0,
    panelCount: 0,
    shtrobaMeters: 0,
    shtrobaType: "brick",
    demSockets: 0,
    demSwitches: 0,
    demLights: 0,
    distBoxes: 0,
    gobaMeters: 0,
    pvhMeters: 0,
    metalTrays: 0,
    lowVoltMeters: 0,
    holeSeals: 0,
    ledStrip: 0,
  });

  // Цены из реальных смет NN VOLT (Нижний Новгород, 2024-2025)
  const prices = {
    socket: 230,       // Монтаж розетки (из данных)
    switch: 230,       // Монтаж выключателя (из данных)
    light: 300,        // Монтаж светильника (из данных)
    cablePerM: 55,     // Прокладка кабеля ВВГнг-LSLTx за м (из данных)
    panelInstall: 1600, // Монтаж щита шкафного (из данных)
    shtroba: { plaster: 200, brick: 300, concrete: 500 },
    demSocket: 150,    // Демонтаж розетки
    demSwitch: 150,    // Демонтаж выключателя
    demLight: 200,     // Демонтаж светильника
    distBox: 200,      // Монтаж распаечной коробки (из данных)
    goba: 20,          // Гофрированная труба за м (из данных)
    pvhPipe: 25,       // Труба ПВХ за м (из данных)
    metalTray: 500,    // Металлический лоток (из данных)
    lowVoltCable: 40,  // Кабель слаботочный за м (из данных)
    holeSeal: 200,     // Пробивка отверстий и заделка проходок (из данных)
    ledStrip: 150,     // LED-лента за м.п.
  };

  // Простые цены по типу квартиры
  const simplePrices = {
    "1k": 50000,
    "2k": 75000,
    "3k": 100000,
  };
  const simpleLabels = {
    "1k": "Однокомнатная квартира",
    "2k": "Двухкомнатная квартира",
    "3k": "Трёхкомнатная квартира",
  };

  const shtrobaPrice = prices.shtroba[calc.shtrobaType as keyof typeof prices.shtroba] || 300;
  const total =
    calc.sockets * prices.socket +
    calc.switches * prices.switch +
    calc.lights * prices.light +
    calc.cableMeters * prices.cablePerM +
    calc.panelCount * prices.panelInstall +
    calc.shtrobaMeters * shtrobaPrice +
    calc.demSockets * prices.demSocket +
    calc.demSwitches * prices.demSwitch +
    calc.demLights * prices.demLight +
    calc.distBoxes * prices.distBox +
    calc.gobaMeters * prices.goba +
    calc.pvhMeters * prices.pvhPipe +
    calc.metalTrays * prices.metalTray +
    calc.lowVoltMeters * prices.lowVoltCable +
    calc.holeSeals * prices.holeSeal +
    calc.ledStrip * prices.ledStrip;

  const simpleTotal = simplePrices[roomType];

  const field = (label: string, key: keyof typeof calc, unit = "шт", priceHint?: number) => (
    <div>
      <label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
        {label}
        {priceHint !== undefined && (
          <span className="text-volt/30 ml-1 normal-case tracking-normal">{priceHint}₽/{unit === "шт" ? "шт" : unit === "м" ? "м" : unit === "мод" ? "мод" : unit === "м.п." ? "м.п." : "шт"}</span>
        )}
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 border-white/10 hover:border-volt/30 text-white/40"
          onClick={() =>
            setCalc((c) => ({ ...c, [key]: Math.max(0, ((c[key] as number) || 0) - 1) }))
          }
        >
          −
        </Button>
        <Input
          type="number"
          min={0}
          value={calc[key] || 0}
          onChange={(e) =>
            setCalc((c) => ({ ...c, [key]: Math.max(0, parseInt(e.target.value) || 0) }))
          }
          className="bg-white/[0.03] border-white/10 text-white text-center w-20 placeholder:text-white/20 focus:border-volt/30"
        />
        <span className="text-xs text-white/25 w-8">{unit}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 border-white/10 hover:border-volt/30 text-white/40"
          onClick={() =>
            setCalc((c) => ({ ...c, [key]: ((c[key] as number) || 0) + 1 }))
          }
        >
          +
        </Button>
      </div>
    </div>
  );

  const hasDetailedInput = Object.values(calc).some((v) => (typeof v === "number" ? v > 0 : false));

  return (
    <section id="calculator" className="relative py-20 sm:py-28 grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Anim>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-volt" />
              <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
                Калькулятор
              </span>
              <div className="h-px w-8 bg-volt" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Рассчитайте стоимость
            </h2>
            <p className="text-white/35 mt-4 max-w-xl mx-auto">
              Ориентировочный расчёт по ценам Нижнего Новгорода. Точную смету — после выезда на объект.
            </p>
          </div>
        </Anim>

        <Anim delay={0.15}>
          <Card className="bg-[#111] border-white/5 max-w-4xl mx-auto">
            <CardContent className="p-4 sm:p-6 lg:p-8">
              {/* Mode Toggle */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <button
                  onClick={() => setMode("simple")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    mode === "simple"
                      ? "bg-volt/10 border border-volt/25 text-volt"
                      : "bg-white/[0.02] border border-white/5 text-white/35 hover:text-white/50"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Простой расчёт
                </button>
                <button
                  onClick={() => setMode("detailed")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    mode === "detailed"
                      ? "bg-volt/10 border border-volt/25 text-volt"
                      : "bg-white/[0.02] border border-white/5 text-white/35 hover:text-white/50"
                  }`}
                >
                  <List className="w-4 h-4" />
                  Подробный расчёт
                </button>
              </div>

              {/* ===== SIMPLE MODE ===== */}
              {mode === "simple" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-white/40 text-sm text-center mb-6">
                    Электромонтаж под ключ в квартире новостройки (проводка, щит, розетки, выключатели, освещение)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {(["1k", "2k", "3k"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setRoomType(k)}
                        className={`p-6 rounded-2xl border-2 text-center transition-all duration-200 ${
                          roomType === k
                            ? "bg-volt/5 border-volt/30 shadow-lg shadow-volt/5"
                            : "bg-white/[0.02] border-white/5 hover:border-white/10"
                        }`}
                      >
                        <Home className={`w-8 h-8 mx-auto mb-3 ${roomType === k ? "text-volt" : "text-white/20"}`} />
                        <div className={`text-sm font-medium mb-1 ${roomType === k ? "text-white" : "text-white/40"}`}>
                          {simpleLabels[k]}
                        </div>
                        <div className={`text-2xl font-black ${roomType === k ? "text-volt" : "text-white/20"}`}>
                          {simplePrices[k].toLocaleString("ru-RU")} ₽
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 mb-6">
                    <div className="text-xs text-white/25 space-y-1">
                      <p>✓ Полная замена проводки (ВВГнг-LS)</p>
                      <p>✓ Сборка и установка электрощита</p>
                      <p>✓ Установка розеток и выключателей</p>
                      <p>✓ Монтаж освещения</p>
                      <p>✓ Штробление стен</p>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-white/30 text-xs tracking-wider uppercase">
                        Электромонтаж под ключ — {simpleLabels[roomType].toLowerCase()}
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-volt mt-1">
                        {simpleTotal.toLocaleString("ru-RU")} ₽
                      </div>
                    </div>
                    <a href="#contacts">
                      <Button
                        size="lg"
                        className="bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wider uppercase text-sm px-6 shadow-volt-glow"
                      >
                        Получить точную смету
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </motion.div>
              )}

              {/* ===== DETAILED MODE ===== */}
              {mode === "detailed" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-white/40 text-sm text-center mb-6">
                    Укажите количество — цена за единицу по расценкам Нижнего Новгорода
                  </p>

                  {/* Монтаж */}
                  <div className="mb-6">
                    <h4 className="text-xs text-volt/60 font-bold tracking-[0.15em] uppercase mb-4 flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5" /> Монтаж
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {field("Розетки", "sockets", "шт", prices.socket)}
                      {field("Выключатели", "switches", "шт", prices.switch)}
                      {field("Светильники", "lights", "шт", prices.light)}
                      {field("Прокладка кабеля ВВГнг-LS", "cableMeters", "м", prices.cablePerM)}
                      {field("Щит шкафный (монтаж)", "panelCount", "шт", prices.panelInstall)}
                      {field("Распаечные коробки", "distBoxes", "шт", prices.distBox)}
                    </div>
                  </div>

                  {/* Штробление и трубы */}
                  <div className="mb-6">
                    <h4 className="text-xs text-volt/60 font-bold tracking-[0.15em] uppercase mb-4 flex items-center gap-2">
                      <Hammer className="w-3.5 h-3.5" /> Штробление и трубы
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                          Штробление стен
                          <span className="text-volt/30 ml-1 normal-case tracking-normal">
                            {shtrobaPrice}₽/м.п.
                          </span>
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-white/10 hover:border-volt/30 text-white/40"
                            onClick={() =>
                              setCalc((c) => ({
                                ...c,
                                shtrobaMeters: Math.max(0, c.shtrobaMeters - 1),
                              }))
                            }
                          >
                            −
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            value={calc.shtrobaMeters}
                            onChange={(e) =>
                              setCalc((c) => ({
                                ...c,
                                shtrobaMeters: Math.max(0, parseInt(e.target.value) || 0),
                              }))
                            }
                            className="bg-white/[0.03] border-white/10 text-white text-center w-20 focus:border-volt/30"
                          />
                          <span className="text-xs text-white/25 w-8">м.п.</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-white/10 hover:border-volt/30 text-white/40"
                            onClick={() =>
                              setCalc((c) => ({ ...c, shtrobaMeters: c.shtrobaMeters + 1 }))
                            }
                          >
                            +
                          </Button>
                        </div>
                        <div className="flex gap-1.5">
                          {[
                            { key: "plaster", label: "Штукатурка" },
                            { key: "brick", label: "Кирпич" },
                            { key: "concrete", label: "Бетон" },
                          ].map((t) => (
                            <button
                              key={t.key}
                              type="button"
                              onClick={() => setCalc((c) => ({ ...c, shtrobaType: t.key }))}
                              className={`px-2.5 py-1 text-[10px] rounded-md border transition-all ${
                                calc.shtrobaType === t.key
                                  ? "bg-volt/10 border-volt/25 text-volt"
                                  : "bg-white/[0.02] border-white/5 text-white/30 hover:text-white/50"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {field("Гофрированная труба", "gobaMeters", "м", prices.goba)}
                      {field("Труба ПВХ", "pvhMeters", "м", prices.pvhPipe)}
                    </div>
                  </div>

                  {/* Лотки и слаботочка */}
                  <div className="mb-6">
                    <h4 className="text-xs text-volt/60 font-bold tracking-[0.15em] uppercase mb-4 flex items-center gap-2">
                      <Cable className="w-3.5 h-3.5" /> Лотки и слаботочка
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {field("Металлический лоток", "metalTrays", "шт", prices.metalTray)}
                      {field("Кабель слаботочный", "lowVoltMeters", "м", prices.lowVoltCable)}
                      {field("Пробивка отверстий / проходки", "holeSeals", "шт", prices.holeSeal)}
                    </div>
                  </div>

                  {/* Демонтаж */}
                  <div className="mb-6">
                    <h4 className="text-xs text-volt/60 font-bold tracking-[0.15em] uppercase mb-4 flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5" /> Демонтаж
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {field("Демонтаж розеток", "demSockets", "шт", prices.demSocket)}
                      {field("Демонтаж выключателей", "demSwitches", "шт", prices.demSwitch)}
                      {field("Демонтаж светильников", "demLights", "шт", prices.demLight)}
                    </div>
                  </div>

                  {/* Доп. работы */}
                  <div className="mb-6">
                    <h4 className="text-xs text-volt/60 font-bold tracking-[0.15em] uppercase mb-4 flex items-center gap-2">
                      <Lightbulb className="w-3.5 h-3.5" /> Дополнительно
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {field("LED-лента", "ledStrip", "м.п.", prices.ledStrip)}
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  {hasDetailedInput && (
                    <div className="mt-4 pt-5 border-t border-white/5">
                      <h4 className="text-xs text-white/30 font-medium tracking-wider uppercase mb-3">
                        Расшифровка
                      </h4>
                      <div className="space-y-1.5 text-sm">
                        {calc.sockets > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Розетки × {calc.sockets}</span>
                            <span className="font-mono">{(calc.sockets * prices.socket).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.switches > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Выключатели × {calc.switches}</span>
                            <span className="font-mono">{(calc.switches * prices.switch).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.lights > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Светильники × {calc.lights}</span>
                            <span className="font-mono">{(calc.lights * prices.light).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.cableMeters > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Кабель ВВГнг-LS {calc.cableMeters} м</span>
                            <span className="font-mono">{(calc.cableMeters * prices.cablePerM).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.panelCount > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Щит шкафный × {calc.panelCount}</span>
                            <span className="font-mono">{(calc.panelCount * prices.panelInstall).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.shtrobaMeters > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Штроба {calc.shtrobaMeters} м.п. ({calc.shtrobaType === "plaster" ? "штукатурка" : calc.shtrobaType === "brick" ? "кирпич" : "бетон"})</span>
                            <span className="font-mono">{(calc.shtrobaMeters * shtrobaPrice).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.distBoxes > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Распаечные коробки × {calc.distBoxes}</span>
                            <span className="font-mono">{(calc.distBoxes * prices.distBox).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.gobaMeters > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Гофротруба {calc.gobaMeters} м</span>
                            <span className="font-mono">{(calc.gobaMeters * prices.goba).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.pvhMeters > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Труба ПВХ {calc.pvhMeters} м</span>
                            <span className="font-mono">{(calc.pvhMeters * prices.pvhPipe).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.metalTrays > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Металлический лоток × {calc.metalTrays}</span>
                            <span className="font-mono">{(calc.metalTrays * prices.metalTray).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.lowVoltMeters > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Кабель слаботочный {calc.lowVoltMeters} м</span>
                            <span className="font-mono">{(calc.lowVoltMeters * prices.lowVoltCable).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.holeSeals > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Пробивка отверстий × {calc.holeSeals}</span>
                            <span className="font-mono">{(calc.holeSeals * prices.holeSeal).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.demSockets > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Демонтаж розеток × {calc.demSockets}</span>
                            <span className="font-mono">{(calc.demSockets * prices.demSocket).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.demSwitches > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Демонтаж выключателей × {calc.demSwitches}</span>
                            <span className="font-mono">{(calc.demSwitches * prices.demSwitch).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.demLights > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>Демонтаж светильников × {calc.demLights}</span>
                            <span className="font-mono">{(calc.demLights * prices.demLight).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                        {calc.ledStrip > 0 && (
                          <div className="flex justify-between text-white/40">
                            <span>LED-лента {calc.ledStrip} м.п.</span>
                            <span className="font-mono">{(calc.ledStrip * prices.ledStrip).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-white/30 text-xs tracking-wider uppercase">
                        Ориентировочная стоимость работ
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-volt mt-1">
                        {total.toLocaleString("ru-RU")} ₽
                      </div>
                    </div>
                    <a href="#contacts">
                      <Button
                        size="lg"
                        className="bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wider uppercase text-sm px-6 shadow-volt-glow"
                      >
                        Получить точную смету
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </motion.div>
              )}

              <p className="text-[11px] text-white/15 text-center mt-4">
                * Цены из реальных смет NN VOLT (Нижний Новгород, 2024-2025). Итоговая стоимость зависит от сложности объекта и материалов. Точный расчёт — после выезда бригадира.
              </p>
            </CardContent>
          </Card>
        </Anim>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQSection() {
  const faqs = [
    {
      q: "Вы работаете с юридическими лицами?",
      a: "Да, мы заключаем договор подряда с организациями и предоставляем все закрывающие документы: акты выполненных работ, счета-фактуры, технические отчёты.",
    },
    {
      q: "Делаете ли вы электромонтаж в новостройках под ключ?",
      a: "Да, мы выполняем полный цикл работ от проектирования до сборки щитка и розеток в новостройках. Включая штробление, прокладку кабеля, установку щита, розеток, выключателей и освещения.",
    },
    {
      q: "Какие гарантии вы даёте?",
      a: "Мы предоставляем гарантию 1 год на все выполненные монтажные работы. При обнаружении дефектов в гарантийный срок — устраняем бесплатно в течение 48 часов.",
    },
    {
      q: "Вы работаете с высоким напряжением?",
      a: "Да, у нас есть соответствующие допуски для работы с кабелями высокого напряжения на промышленных и социальных объектах. Допуск до 10 кВ.",
    },
    {
      q: "Как быстро выезжает бригадир на объект?",
      a: "Выезд бригадира на замеры — в течение 24 часов после заявки в рабочие дни. Составление сметы — до 2 рабочих дней после замеров.",
    },
    {
      q: "Какие материалы вы используете?",
      a: "Работаем с проверенными поставщиками. Используем кабель ВВГнг-LS, автоматы ABB/Schneider/Legrand. Все материалы сертифицированы и соответствуют требованиям ПУЭ.",
    },
    {
      q: "Сколько стоят электромонтажные работы?",
      a: "Стоимость зависит от объёма и сложности. Ориентировочно: розетка — от 400₽, выключатель — от 350₽, сборка щита — от 600₽/модуль, прокладка кабеля — от 150₽/м.п. Воспользуйтесь нашим калькулятором для приблизительного расчёта.",
    },
  ];

  return (
    <section id="faq" className="relative py-20 sm:py-28 bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Anim>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-volt" />
              <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
                FAQ
              </span>
              <div className="h-px w-8 bg-volt" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Частые вопросы
            </h2>
          </div>
        </Anim>

        <Anim delay={0.15}>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-[#111] border border-white/5 hover:border-volt/10 rounded-2xl overflow-hidden transition-colors px-5 sm:px-6 data-[state=open]:border-volt/20"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-semibold text-white/75 hover:text-volt transition-colors py-5">
                  <span className="flex items-center gap-3">
                    <span className="text-volt/25 font-mono text-xs">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {f.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-white/40 text-sm leading-relaxed pb-5 pl-8">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Anim>
      </div>
    </section>
  );
}

/* ─── Contacts ─── */
function ContactsSection() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Format message for Telegram
      const message = `⚡ <b>НОВАЯ ЗАЯВКА — NN VOLT</b>

👤 <b>Имя:</b> ${form.name}
📱 <b>Телефон:</b> ${form.phone}
${form.message ? `💬 <b>Сообщение:</b>\n${form.message}` : ""}

🔗 <b>Источник:</b> nnvolt.рф
📅 <b>Дата:</b> ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`.trim();

      // Send via forward-telegram API (works on both Vercel and static Beget)
      const forwardUrl = process.env.NEXT_PUBLIC_FORWARD_TELEGRAM_URL || "/api/forward-telegram";
      const response = await fetch(forwardUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: "6216799537", // ADMIN_CHAT_ID
          method: "sendMessage",
          payload: {
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.ok) {
        setSubmitted(true);
        setForm({ name: "", phone: "", message: "" });
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        setError(result.error || "Failed to send message");
      }
    } catch (err) {
      setError("Failed to send message. Please try again.");
      console.error("Form submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contacts" className="relative py-20 sm:py-28 grid-bg">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-blue/15 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Anim>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-volt" />
              <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
                Контакты
              </span>
              <div className="h-px w-8 bg-volt" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Свяжитесь с нами
            </h2>
            <p className="text-white/35 mt-4 max-w-xl mx-auto">
              Оставьте заявку — бригадир свяжется в течение 2 часов в рабочее время.
            </p>
          </div>
        </Anim>

        <div className="grid lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-12">
          {/* Info */}
          <Anim className="lg:col-span-2">
            <div className="space-y-4 sm:space-y-6">
              <div className="p-4 sm:p-5 bg-volt/5 border border-volt/15 rounded-2xl">
                <h3 className="text-volt font-bold text-base sm:text-lg mb-2">Вызвать электрика</h3>
                <p className="text-white/40 text-sm">
                  Бригадир выедет на объект, сделает замеры и составит точную смету — бесплатно.
                </p>
              </div>

              <div className="p-4 sm:p-5 bg-electric-blue/5 border border-electric-blue/15 rounded-2xl">
                <h3 className="text-electric-blue font-bold text-lg mb-2">Запросить смету</h3>
                <p className="text-white/40 text-sm mb-4">
                  Отправьте описание объекта — подготовим предварительный расчёт стоимости.
                </p>
                <a
                  href="/zapros-smeti-nn-volt.txt"
                  download
                  className="inline-flex items-center gap-2 text-xs font-medium text-electric-blue hover:text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Скачать бланк заявки
                </a>
              </div>

              <div className="h-px bg-white/5" />

              <div className="space-y-4">
                {[
                  { icon: Phone, label: "+7 929 042-04-20", sub: "Пн–Сб 08:00–20:00", href: "tel:+79290420420" },
                  { icon: MapPin, label: "Нижний Новгород и область", sub: "Быстрый выезд на объект", href: null },
                  { icon: Send, label: "Telegram: @mister_x_420", sub: "Напишите в любой момент", href: "https://t.me/mister_x_420" },
                ].map((c, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center flex-shrink-0">
                      <c.icon className="w-4 h-4 text-volt/60" />
                    </div>
                    <div className="flex-1">
                      {c.href ? (
                        <a
                          href={c.href}
                          target={c.href.startsWith('http') ? '_blank' : undefined}
                          rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="text-white text-sm font-medium hover:text-volt transition-colors"
                        >
                          {c.label}
                        </a>
                      ) : (
                        <div className="text-white text-sm font-medium">{c.label}</div>
                      )}
                      {c.sub && <div className="text-white/25 text-xs mt-0.5">{c.sub}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Anim>

          {/* Form */}
          <Anim delay={0.15} className="lg:col-span-3">
            <Card className="bg-[#111] border-white/5">
              <CardContent className="p-6 sm:p-8">
                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-volt/10 border border-volt/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-volt" />
                    </div>
                    <h3 className="text-white font-bold text-xl mb-2">Заявка принята!</h3>
                    <p className="text-white/40 text-sm">
                      Бригадир свяжется с вами в течение 2 рабочих часов.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                          Имя *
                        </label>
                        <Input
                          required
                          value={form.name}
                          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                          className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          placeholder="Ваше имя"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                          Телефон *
                        </label>
                        <Input
                          required
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                          className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          placeholder="+7 (___) ___-__-__"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                        Опишите задачу
                      </label>
                      <Textarea
                        value={form.message}
                        onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                        className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30 min-h-[120px]"
                        placeholder="Тип объекта, объём работ, сроки..."
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      className="w-full bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wider uppercase text-sm shadow-volt-glow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>Отправка...</>
                      ) : (
                        <>
                          Отправить заявку
                          <ArrowRight className="ml-2 w-4 h-4" />
                        </>
                      )}
                    </Button>
                    {error && (
                      <p className="text-red-500 text-xs text-center mt-2">
                        {error}
                      </p>
                    )}
                    <p className="text-center text-[11px] text-white/15">
                      Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </Anim>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="relative bg-[#070707] border-t border-white/5 mt-auto">
      <div className="h-1 hazard-stripe" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-6 h-6 text-volt" />
              <div>
                <span className="text-lg font-black tracking-[0.15em] text-white">NN VOLT</span>
                <span className="text-[9px] tracking-[0.25em] text-volt block -mt-0.5">
                  ЭЛЕКТРОМОНТАЖ
                </span>
              </div>
            </div>
            <p className="text-white/25 text-sm leading-relaxed mb-4">
              Профессиональный электромонтаж в новостройках, соцобъектах и на промышленных объектах. Работаем с высоким напряжением.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-500/60 text-xs">Принимаем заявки</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-bold text-sm tracking-wider uppercase mb-4">Разделы</h4>
            <ul className="space-y-2">
              {[
                { label: "Услуги", href: "#services" },
                { label: "Портфолио", href: "#portfolio" },
                { label: "Бригада", href: "#team" },
                { label: "Калькулятор", href: "#calculator" },
                { label: "FAQ", href: "#faq" },
                { label: "Контакты", href: "#contacts" },
              ].map((l, i) => (
                <li key={i}>
                  <a href={l.href} className="text-white/25 text-sm hover:text-volt transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-white font-bold text-sm tracking-wider uppercase mb-4">Связь</h4>
            <ul className="space-y-2">
              <li>
                <a href="https://t.me/mister_x_420" target="_blank" rel="noopener noreferrer" className="text-white/25 text-sm hover:text-volt transition-colors flex items-center gap-2">
                  <Send className="w-3.5 h-3.5" /> Telegram: @mister_x_420
                </a>
              </li>
              <li>
                <a href="tel:+79290420420" className="text-white/25 text-sm hover:text-volt transition-colors flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> +7 929 042-04-20
                </a>
              </li>
              <li className="text-white/25 text-sm flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Нижний Новгород и область
              </li>
            </ul>
          </div>

          {/* Certs */}
          <div>
            <h4 className="text-white font-bold text-sm tracking-wider uppercase mb-4">Допуски</h4>
            <ul className="space-y-2">
              {[
                "Членство в СРО",
                "Допуск до 10 кВ",
                "Электробезопасность IV+",
                "Пожарный сертификат",
                "Договор подряда",
              ].map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-white/25 text-sm">
                  <Shield className="w-3 h-3 text-volt/30" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-white/5" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/15 text-xs">
            &copy; {new Date().getFullYear()} NN VOLT. Все права защищены.
          </p>
          <div className="flex items-center gap-3 text-white/10 text-[11px]">
            <span>Электромонтаж под ключ</span>
            <span>·</span>
            <span>Безопасно. Надёжно. По ГОСТу.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Floating Price List Button ─── */
function PriceListDrawer() {
  const [open, setOpen] = useState(false);

  const priceSections = [
    {
      title: "Розетки — монтаж по типу стены",
      icon: Plug,
      items: [
        { name: "Розетка скрытой установки в гипсокартоне", unit: "шт", price: 350 },
        { name: "Розетка скрытой установки в кирпиче", unit: "шт", price: 450 },
        { name: "Розетка скрытой установки в бетоне", unit: "шт", price: 550 },
        { name: "Розетка накладная (открытая проводка)", unit: "шт", price: 300 },
        { name: "Розетка двухместная скрытой установки", unit: "шт", price: 500 },
        { name: "Розетка с заземлением и шторками IP44", unit: "шт", price: 500 },
        { name: "Розетка силовая (для электроплиты)", unit: "шт", price: 800 },
        { name: "Розетка интернет RJ45", unit: "шт", price: 500 },
        { name: "Розетка телевизионная", unit: "шт", price: 500 },
        { name: "Розетка телефонная", unit: "шт", price: 500 },
      ],
    },
    {
      title: "Выключатели — монтаж по типу стены",
      icon: Plug,
      items: [
        { name: "Выключатель одноклавишный (гипсокартон)", unit: "шт", price: 350 },
        { name: "Выключатель одноклавишный (кирпич)", unit: "шт", price: 450 },
        { name: "Выключатель одноклавишный (бетон)", unit: "шт", price: 550 },
        { name: "Выключатель двухклавишный (гипсокартон)", unit: "шт", price: 400 },
        { name: "Выключатель двухклавишный (кирпич)", unit: "шт", price: 500 },
        { name: "Выключатель двухклавишный (бетон)", unit: "шт", price: 600 },
        { name: "Выключатель трёхклавишный", unit: "шт", price: 650 },
        { name: "Выключатель проходной", unit: "шт", price: 550 },
        { name: "Переключатель скрытой установки", unit: "шт", price: 550 },
        { name: "Диммер (реостат)", unit: "шт", price: 750 },
      ],
    },
    {
      title: "Подрозетники — бурение гнёзд",
      icon: Hammer,
      items: [
        { name: "Бурение гнезда подрозетника в гипсокартоне", unit: "шт", price: 150 },
        { name: "Бурение гнезда подрозетника в кирпиче", unit: "шт", price: 300 },
        { name: "Бурение гнезда подрозетника в бетоне", unit: "шт", price: 400 },
        { name: "Установка подрозетника", unit: "шт", price: 100 },
      ],
    },
    {
      title: "Светильники и освещение",
      icon: Lightbulb,
      items: [
        { name: "Точечный светильник (встраиваемый)", unit: "шт", price: 300 },
        { name: "Светильник накладной LED", unit: "шт", price: 300 },
        { name: "Светильник Armstrong (встроенный потолок)", unit: "шт", price: 500 },
        { name: "Светильник в натяжной потолок", unit: "шт", price: 500 },
        { name: "Люстра простая (до 5 ламп)", unit: "шт", price: 800 },
        { name: "Люстра сложная / хрустальная", unit: "шт", price: 1500 },
        { name: "Люстра на натяжной потолок", unit: "шт", price: 1900 },
        { name: "Бра / настенный светильник", unit: "шт", price: 500 },
        { name: "Трековый светильник", unit: "п.м.", price: 500 },
        { name: "Уличный светильник", unit: "шт", price: 350 },
        { name: "Облучатель бактерицидный", unit: "шт", price: 500 },
        { name: "Светодиодная лента (монтаж)", unit: "м.п.", price: 200 },
        { name: "Пиктограмма «Выход»", unit: "шт", price: 300 },
      ],
    },
    {
      title: "Штробление по материалу стены",
      icon: Hammer,
      items: [
        { name: "Штроба до 20 мм (гипс / штукатурка)", unit: "м.п.", price: 200 },
        { name: "Штроба до 20 мм (кирпич / пенобетон)", unit: "м.п.", price: 300 },
        { name: "Штроба до 20 мм (бетон)", unit: "м.п.", price: 450 },
        { name: "Штроба до 40 мм (кирпич)", unit: "м.п.", price: 450 },
        { name: "Штроба до 40 мм (бетон)", unit: "м.п.", price: 600 },
        { name: "Штроба до 70 мм (кирпич)", unit: "м.п.", price: 550 },
        { name: "Штроба до 70 мм (бетон)", unit: "м.п.", price: 800 },
        { name: "Штроба до 100 мм (кирпич)", unit: "м.п.", price: 850 },
        { name: "Штроба до 100 мм (бетон)", unit: "м.п.", price: 1000 },
        { name: "Штроба в потолке (бетон)", unit: "м.п.", price: 500 },
        { name: "Штроба в гипсолите / гипсокартоне", unit: "м.п.", price: 150 },
        { name: "Пробивка отверстий и заделка проходок", unit: "шт", price: 200 },
        { name: "Монтаж закладных гильз", unit: "шт", price: 600 },
      ],
    },
    {
      title: "Кабель и проводка",
      icon: Cable,
      items: [
        { name: "Прокладка кабеля ВВГнг-LS до 6 мм²", unit: "м", price: 70 },
        { name: "Прокладка кабеля ВВГнг-LS до 16 мм²", unit: "м", price: 90 },
        { name: "Прокладка кабеля ВВГнг-LS до 35 мм²", unit: "м", price: 120 },
        { name: "Прокладка кабеля ВВГнг-LS до 70 мм²", unit: "м", price: 180 },
        { name: "Прокладка кабеля ВВГнг-FRLSLTx (огнестойкий)", unit: "м", price: 80 },
        { name: "Кабель слаботочный (СКС, ТВ, ОПС)", unit: "м", price: 40 },
        { name: "Провод ПУГВ до 6 мм²", unit: "м", price: 40 },
        { name: "Затяжка кабеля в гофротрубу d20", unit: "м", price: 75 },
        { name: "Затяжка кабеля в гофротрубу d40", unit: "м", price: 75 },
        { name: "Прокладка кабель-канала до 40 мм", unit: "м", price: 75 },
        { name: "Прокладка кабель-канала до 100 мм", unit: "м", price: 100 },
      ],
    },
    {
      title: "Гофротруба и трубы — по материалу стены",
      icon: Wrench,
      items: [
        { name: "Гофротруба d20 в гипсокартоне", unit: "м", price: 35 },
        { name: "Гофротруба d20 в кирпичной кладке", unit: "м", price: 50 },
        { name: "Гофротруба d20 в бетоне", unit: "м", price: 70 },
        { name: "Гофротруба d25 в гипсокартоне", unit: "м", price: 40 },
        { name: "Гофротруба d25 в кирпичной кладке", unit: "м", price: 55 },
        { name: "Гофротруба d25 в бетоне", unit: "м", price: 80 },
        { name: "Гофротруба d32 в бетоне", unit: "м", price: 90 },
        { name: "Гофротруба огнестойкая d20", unit: "м", price: 50 },
        { name: "Гофротруба огнестойкая d25", unit: "м", price: 55 },
        { name: "Труба ПВХ жесткая d20", unit: "м", price: 100 },
        { name: "Труба ПВХ жесткая d25", unit: "м", price: 125 },
        { name: "Труба стальная d32", unit: "м", price: 150 },
      ],
    },
    {
      title: "Щиты и шкафы — по типу установки",
      icon: Cpu,
      items: [
        { name: "Щит накладной до 12 модулей", unit: "шт", price: 2500 },
        { name: "Щит накладной до 24 модулей", unit: "шт", price: 3500 },
        { name: "Щит накладной до 36 модулей", unit: "шт", price: 4500 },
        { name: "Щит накладной до 54 модулей", unit: "шт", price: 7000 },
        { name: "Щит встраиваемый в гипсокартон (до 12 мод.)", unit: "шт", price: 2000 },
        { name: "Щит встраиваемый в кирпич (до 12 мод.)", unit: "шт", price: 3500 },
        { name: "Щит встраиваемый в бетон (до 12 мод.)", unit: "шт", price: 5500 },
        { name: "Щит встраиваемый в кирпич (до 24 мод.)", unit: "шт", price: 5500 },
        { name: "Щит встраиваемый в бетон (до 24 мод.)", unit: "шт", price: 8500 },
        { name: "Щит шкафной монтажный (до 600×600 мм)", unit: "шт", price: 1600 },
        { name: "Ящик с понижающим трансформатором ЯТП", unit: "шт", price: 750 },
      ],
    },
    {
      title: "Автоматы, УЗО, счётчики",
      icon: Cpu,
      items: [
        { name: "Монтаж 1-полюсного автомата", unit: "шт", price: 350 },
        { name: "Монтаж 2-полюсного автомата", unit: "шт", price: 350 },
        { name: "Монтаж 3-полюсного автомата", unit: "шт", price: 400 },
        { name: "Монтаж 2-полюсного УЗО", unit: "шт", price: 600 },
        { name: "Монтаж 4-полюсного УЗО", unit: "шт", price: 700 },
        { name: "Монтаж дифавтомата", unit: "шт", price: 500 },
        { name: "Установка электросчётчика однофазного", unit: "шт", price: 1500 },
        { name: "Установка электросчётчика трёхфазного", unit: "шт", price: 2000 },
        { name: "Монтаж реле напряжения", unit: "шт", price: 500 },
        { name: "Монтаж заземляющей шины", unit: "шт", price: 500 },
        { name: "Подключение силового кабеля в щите", unit: "шт", price: 1000 },
      ],
    },
    {
      title: "Коробки и лотки",
      icon: ClipboardList,
      items: [
        { name: "Распаечная коробка скрытой установки", unit: "шт", price: 250 },
        { name: "Распаечная коробка открытой установки", unit: "шт", price: 200 },
        { name: "Распаечная коробка в гипсокартоне", unit: "шт", price: 250 },
        { name: "Распаечная коробка в кирпиче", unit: "шт", price: 300 },
        { name: "Распаечная коробка в бетоне", unit: "шт", price: 400 },
        { name: "Коробка ответвительная огнестойкая FS IP55", unit: "шт", price: 300 },
        { name: "Коробка уравнивания потенциалов", unit: "шт", price: 250 },
        { name: "Коробка КК-10 150А", unit: "шт", price: 600 },
        { name: "Прокладка лотка до 200 мм", unit: "м", price: 250 },
        { name: "Прокладка лотка до 400 мм", unit: "м", price: 350 },
        { name: "Прокладка лотка до 600 мм", unit: "м", price: 450 },
        { name: "Лоток слаботочный", unit: "м", price: 200 },
      ],
    },
    {
      title: "Демонтаж",
      icon: Wrench,
      items: [
        { name: "Демонтаж розетки / выключателя", unit: "шт", price: 200 },
        { name: "Демонтаж светильника / бра", unit: "шт", price: 300 },
        { name: "Демонтаж люстры", unit: "шт", price: 500 },
        { name: "Демонтаж автомата защиты", unit: "шт", price: 250 },
        { name: "Демонтаж распределительного щита", unit: "шт", price: 1000 },
        { name: "Демонтаж скрытой проводки", unit: "м", price: 50 },
        { name: "Демонтаж открытой проводки", unit: "м", price: 40 },
        { name: "Демонтаж кабель-канала", unit: "м", price: 40 },
      ],
    },
  ];

  return (
    <>
      {/* Floating Buttons */}
      <motion.a
        href="/pricelist-nn-volt.xlsx"
        download
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 bg-volt text-charcoal font-bold rounded-2xl shadow-lg shadow-volt/20 hover:shadow-volt/40 hover:bg-volt-hover transition-all duration-300 group"
      >
        <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span className="text-sm tracking-wide hidden sm:inline">Скачать прайс</span>
        <span className="text-sm tracking-wide sm:hidden">XLSX</span>
      </motion.a>

      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-5 py-3.5 glass-strong text-white font-bold rounded-2xl shadow-lg hover:bg-white/10 transition-all duration-300 group"
      >
        <CircleDollarSign className="w-5 h-5 text-volt group-hover:scale-110 transition-transform" />
        <span className="text-sm tracking-wide">Прайс-лист</span>
      </motion.button>

      {/* Sheet Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg bg-[#0f0f0f] border-white/5 p-0">
          <SheetHeader className="p-6 pb-4 border-b border-white/5">
            <SheetTitle className="text-white flex items-center gap-2.5">
              <CircleDollarSign className="w-5 h-5 text-volt" />
              Прайс-лист NN VOLT
            </SheetTitle>
            <p className="text-white/30 text-xs text-left mt-1">
              Цены из реальных смет. Нижний Новгород, 2024-2025
            </p>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-100px)]">
            <div className="p-4 sm:p-6 space-y-5">
              {priceSections.map((section, si) => (
                <div key={si}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-volt/10 flex items-center justify-center">
                      <section.icon className="w-3.5 h-3.5 text-volt" />
                    </div>
                    <h3 className="text-white font-bold text-sm">{section.title}</h3>
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map((item, ii) => (
                      <div
                        key={ii}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors group"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <span className="text-white/60 text-sm group-hover:text-white/80 transition-colors">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-white/20 text-[10px]">{item.unit}</span>
                          <span className="text-volt font-bold text-sm font-mono min-w-[60px] text-right">
                            {item.price.toLocaleString("ru-RU")} ₽
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {si < priceSections.length - 1 && (
                    <Separator className="mt-4 bg-white/5" />
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-white/5">
                <a href="/pricelist-nn-volt.xlsx" download>
                  <Button className="w-full bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wider uppercase text-sm shadow-volt-glow">
                    <Download className="mr-2 w-4 h-4" />
                    Скачать прайс-лист (Excel)
                  </Button>
                </a>
                <a href="/zapros-smeti-nn-volt.txt" download>
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-white/10 text-electric-blue/60 hover:text-electric-blue hover:border-electric-blue/30 tracking-wider uppercase text-sm"
                  >
                    <Download className="mr-2 w-4 h-4" />
                    Скачать бланк заявки
                  </Button>
                </a>
                <a href="#calculator" onClick={() => setOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-white/10 text-white/60 hover:text-volt hover:border-volt/30 tracking-wider uppercase text-sm"
                  >
                    <Calculator className="mr-2 w-4 h-4" />
                    Открыть калькулятор
                  </Button>
                </a>
                <a href="#contacts" onClick={() => setOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-white/10 text-white/60 hover:text-volt hover:border-volt/30 tracking-wider uppercase text-sm"
                  >
                    Запросить точную смету
                  </Button>
                </a>
                <p className="text-[10px] text-white/15 text-center mt-3">
                  * Указаны расценки на монтажные работы. Материалы рассчитываются отдельно.
                </p>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ─── Main Page ─── */
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <Services />
        <WorkSteps />
        <Portfolio />
        <TeamSection />
        <PriceCalculator />
        <FAQSection />
        <ContactsSection />
      </main>
      <Footer />
      <PriceListDrawer />
    </div>
  );
}
