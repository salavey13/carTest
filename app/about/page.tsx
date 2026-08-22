"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, ArrowUpRight, Bot, Crown, Gamepad2, Gem, Github, Inbox, Layers, MapPin, PenTool, Rocket, Send, Sparkles, Workflow, Zap } from "lucide-react";
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
  { icon: Bot, title: "Кто я", text: "13+ лет в разработке (C++/Java/TS), сегодня — AI Product Engineer.", chip: "from-[hsl(36_92%_68%/0.2)] to-[hsl(7_88%_62%/0.12)] text-[hsl(var(--primary))]" },
  { icon: Gem, title: "Что даю клиенту", text: "Не просто «страницу», а работающий продуктовый ритм.", chip: "from-[hsl(188_85%_58%/0.18)] to-[hsl(36_92%_68%/0.1)] text-[hsl(188_85%_58%)]" },
  { icon: Workflow, title: "Как работаю", text: "BOSS-mode delivery: intake → декомпозиция → выкат слайсов → полировка.", chip: "from-[hsl(275_72%_58%/0.18)] to-[hsl(340_82%_60%/0.1)] text-[hsl(275_72%_58%)]" },
];

const processSteps: { icon: IconType; n: string; title: string; text: string }[] = [
  { icon: Inbox, n: "01", title: "Intake", text: "Запрос клиента + референсы и материалы." },
  { icon: Workflow, n: "02", title: "Декомпозиция", text: "Превращаю запрос в поэтапный executable-план." },
  { icon: Rocket, n: "03", title: "Выкат слайсов", text: "Быстрые рабочие итерации." },
  { icon: PenTool, n: "04", title: "Полировка", text: "Точечная доводка под контекст." },
];

const flagship: { icon: IconType; name: string; proof: string; details: string; href: string; external?: boolean; tags: string[] }[] = [
  { icon: Layers, name: "Franchize + VIP Bike", proof: "Полноценный запуск через hydration SQL", details: "Модель, где новый бизнес-контур собирается из single SQL seed.", href: "/vipbikerental", tags: ["hydration SQL", "market-пакет"] },
  { icon: Gamepad2, name: "WBlanding", proof: "Лендинг как операционная панель", details: "Action-слои, crew, audit, referral, invoicing.", href: "/wblanding", tags: ["crew", "invoicing"] },
  { icon: Crown, name: "BOSS_QUEST.HTML", proof: "Главный протокол взаимодействия", details: "Один запрос превращаю в исполнимый квест-план.", href: "https://github.com/salavey13/carTest/blob/main/BOSS_QUEST.HTML", external: true, tags: ["BOSS-mode", "AI delivery"] },
];

const stats = [{ value: "13+", label: "лет в разработке" }, { value: "3", label: "продуктовых трека" }, { value: "7+", label: "интеграций" }, { value: "24/7", label: "AI-assisted delivery" }];

const stack = ["Next.js 14", "React 18", "TypeScript", "Supabase", "Telegram Bot API", "Telegram WebApp", "Tailwind CSS", "Vercel", "GitHub Actions", "Gemini · ZAI · Claude"];

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <motion.div className="absolute -top-32 -left-32 h-[26rem] w-[26rem] rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, hsl(36 92% 68% / 0.7), transparent 65%)" }} animate={{ y: [0, 30, 0], x: [0, 18, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, hsl(228 35% 45% / 0.8), transparent 65%)" }} animate={{ y: [0, -26, 0], x: [0, -14, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
        <motion.nav initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-14 flex items-center justify-between text-sm">
          <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur">about / ru</span>
          <Link href="/about_en" className="group inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-primary">about_en · RU портфолио<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Link>
        </motion.nav>
        <motion.header variants={stagger} initial="hidden" animate="show" className="mb-16">
          <motion.div variants={fadeUp} className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              {/* Restore actual photo (was replaced with "ПС" monogram in bed06c45) */}
              <img
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png"
                alt="Павел Соловьёв"
                className="h-24 w-24 rounded-2xl border border-primary/40 object-cover shadow-[0_0_50px_-12px_hsl(var(--primary)/0.5)] sm:h-28 sm:w-28"
              />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(150_78%_48%)] opacity-60" /><span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-background bg-[hsl(150_78%_48%)]" /></span>
            </div>
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[hsl(150_78%_48%/0.35)] bg-[hsl(150_78%_48%/0.08)] px-3 py-1 text-xs font-medium text-[hsl(150_78%_48%)]"><Sparkles className="h-3.5 w-3.5" />открыт к новым проектам</p>
              <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">Павел <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, hsl(var(--primary)), hsl(7 88% 62%))" }}>Соловьёв</span></h1>
              <p className="mt-2 text-base font-medium text-muted-foreground sm:text-lg">AI Product Engineer · Telegram-first builder</p>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="mb-8 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-muted-foreground backdrop-blur"><MapPin className="h-3.5 w-3.5 text-primary" />Нижний Новгород / remote</span>
            <a href="https://t.me/salavey13" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-primary"><Send className="h-3.5 w-3.5 text-primary" />@salavey13</a>
            <a href="https://github.com/salavey13" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-primary"><Github className="h-3.5 w-3.5 text-primary" />github.com/salavey13</a>
          </motion.div>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <a href="#contact" className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.6)] transition hover:-translate-y-0.5">Обсудить задачу<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></a>
            <Link href="/about_en" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-3 text-sm font-semibold backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/50">Треки и портфолио</Link>
          </motion.div>
        </motion.header>
        <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mb-16 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (<motion.div key={s.label} variants={fadeUp} className="rounded-2xl border border-border/60 bg-card/60 p-4 text-center backdrop-blur transition hover:border-primary/40"><div className="bg-clip-text text-2xl font-black text-transparent sm:text-3xl" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(45 25% 88%))" }}>{s.value}</div><div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</div></motion.div>))}
        </motion.section>
        <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mb-16">
          <motion.p variants={fadeUp} className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">// суть</motion.p>
          <motion.h2 variants={fadeUp} className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Три блока, чтобы понять меня быстро</motion.h2>
          <div className="grid gap-4 md:grid-cols-3">{coreBlocks.map((b) => (<motion.div key={b.title} variants={fadeUp}><Card className="group h-full border-border/60 bg-card/60 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-primary/40"><CardContent className="p-6"><div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${b.chip}`}><b.icon className="h-5 w-5" /></div><h3 className="mb-2 text-lg font-bold">{b.title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{b.text}</p></CardContent></Card></motion.div>))}</div>
        </motion.section>
        <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mb-16">
          <motion.p variants={fadeUp} className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">// BOSS-mode delivery</motion.p>
          <motion.h2 variants={fadeUp} className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Как запрос становится рабочим продуктом</motion.h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{processSteps.map((step, idx) => (<motion.div key={step.n} variants={fadeUp} className="relative rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur transition hover:border-primary/40"><div className="mb-3 flex items-center justify-between"><span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><step.icon className="h-5 w-5" /></span><span className="font-mono text-xs text-muted-foreground/60">{step.n}</span></div><h3 className="mb-1.5 font-bold">{step.title}</h3><p className="text-xs leading-relaxed text-muted-foreground">{step.text}</p>{idx < processSteps.length - 1 && (<ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary/50 lg:block" />)}</motion.div>))}</div>
        </motion.section>
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.55 }} className="mb-16">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">// стек</p>
          <h2 className="mb-5 text-2xl font-bold tracking-tight sm:text-3xl">Инструменты контура</h2>
          <div className="flex flex-wrap gap-2">{stack.map((tech) => (<span key={tech} className="cursor-default rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-primary">{tech}</span>))}</div>
        </motion.section>
        <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mb-16">
          <motion.p variants={fadeUp} className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">// демо</motion.p>
          <motion.h2 variants={fadeUp} className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Ключевые интеграции и демо</motion.h2>
          <div className="grid gap-4 md:grid-cols-3">{flagship.map((item) => (<motion.div key={item.name} variants={fadeUp}><Link href={item.href} {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})} className="group flex h-full flex-col rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-primary/50"><div className="mb-4 flex items-start justify-between"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></span><ArrowUpRight className="h-5 w-5 text-muted-foreground/50 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div><CardTitle className="mb-1 text-lg font-bold">{item.name}</CardTitle><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">{item.proof}</p><p className="mb-5 flex-1 text-sm leading-relaxed text-muted-foreground">{item.details}</p><div className="mb-4 flex flex-wrap gap-1.5">{item.tags.map((tag) => (<span key={tag} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{tag}</span>))}</div><span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">Открыть<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></Link></motion.div>))}</div>
        </motion.section>
        <motion.section id="contact" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.55 }} className="scroll-mt-16">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur sm:p-8">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">// контакт</p>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">SupportForm / быстрый старт</h2>
            <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">Нужен запуск или перезапуск продукта — напишите детали.</p>
            <SupportForm />
          </div>
        </motion.section>
        <footer className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span className="font-mono">© {new Date().getFullYear()} Павел Соловьёв · salavey13</span>
          <div className="flex items-center gap-4"><Link href="/about_en" className="transition hover:text-primary">about_en · портфолио</Link><a href="https://github.com/salavey13/carTest" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition hover:text-primary"><Github className="h-3.5 w-3.5" />carTest</a></div>
        </footer>
      </div>
    </div>
  );
}
