"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { toast } from "sonner";
import { getTelegramUser } from "@/lib/telegram";

/**
 * /app/optimapipe/page.tsx
 * Hero color fix: subtitle and hint changed to light colors so they are readable on dark hero image.
 * Other small readability tweaks included (stronger translucent backdrop behind heading).
 */

const t = {
  company: 'ООО "Оптимапайп"',
  subtitle: "Монтаж инженерных сетей — качество и надёжность",
  heroCta: "Заказать оценку проекта",
  servicesTitle: "Наши услуги",
  whyTitle: "Почему выбирают нас",
  contactTitle: "Контакты",
  phone: "+7 (XXX) XXX-XX-XX",
  email: "info@optimapipe.ru",
  address: "г. Город, ул. Улица, дом 1",
};

type ContactForm = { name: string; phone: string; email: string; message: string };

export default function OptimapipeLandingPage(): JSX.Element {
  const [form, setForm] = useState<ContactForm>({ name: "", phone: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    let tmo: any;
    if (copied) tmo = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(tmo);
  }, [copied]);

  function validate(form: ContactForm) {
    if (!form.name.trim()) return "Укажите имя";
    if (!form.phone.trim() && !form.email.trim()) return "Укажите телефон или email";
    if (form.message.trim().length < 6) return "Короткое сообщение — опишите задачу подробнее";
    return null;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const err = validate(form);
    if (err) {
      toast.error(err);
      return;
    }

    const tg = getTelegramUser();
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      message: form.message.trim(),
      fromTelegram: !!tg,
      telegramUser: tg ? { id: tg.id, username: tg.username, first_name: tg.first_name, last_name: tg.last_name } : null,
      ts: new Date().toISOString(),
    } as const;

    try {
      setSending(true);
      const res = await fetch("/api/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || json?.message || "Server error");

      toast.success("Заявка отправлена — менеджер свяжется в рабочее время");
      setForm({ name: "", phone: "", email: "", message: "" });
    } catch (err: any) {
      console.error("send contact failed", err);
      toast.error(err?.message || "Ошибка отправки — попробуйте позже");
    } finally {
      setSending(false);
    }
  }

  const heroImage =
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/optimapipeLogo-72082dcc-f28b-4d28-aeb1-09d64569419a.jpg";

  const projects = [
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/883_original-7b7c2108-cc6f-455b-9efd-10cd65fa3c97.webp",
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/5d2ee1919380006ba715e997-4a06c39a-1b5f-4030-a66f-93100060d4ba.jpg",
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_0455-53b7a2ea-4449-401a-be76-70b786973c73.png",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* HERO */}
      <header
        role="banner"
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-transparent"
        aria-label="Hero section — Optimapipe"
      >
        {/* Фон: абсолютный блок, z-0 — картинка ниже контента */}
        <div className="absolute inset-0 z-0">
          {!imgError ? (
            <Image
              src={heroImage}
              alt="Монтаж инженерных сетей — Optimapipe"
              fill
              style={{ objectFit: "cover", objectPosition: "center" }}
              priority
              unoptimized
              onLoadingComplete={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          ) : (
            // fallback: градиент + текстура (темный, чтобы текст читался)
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(12,17,23,0.85) 0%, rgba(10,11,13,0.85) 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 6px)",
              }}
            />
          )}

          {/* overlay for contrast (pointer-events-none чтобы не блокировать интерактив) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/60 pointer-events-none" aria-hidden />
        </div>

        {/* Контент — над фоном */}
        <div className="container mx-auto px-4 py-[6vh] md:py-24 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            {/* Stronger translucent backdrop behind heading to improve contrast */}
            <div className="inline-block px-5 py-3 rounded-md bg-black/45 backdrop-blur-sm">
              <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-white drop-shadow-md">
                {t.company}
              </h1>
            </div>

            {/* subtitle: make text light so it's readable on dark hero */}
            <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">{t.subtitle}</p>

            {/* Buttons: stack on mobile, row on sm+ */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  
                  onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
                  className="w-full sm:w-auto px-6 py-3 font-semibold shadow-lg"
                  aria-label={t.heroCta}
                >
                  <VibeContentRenderer content="::FaPhone::" className="inline mr-2 h-4 w-4 align-text-bottom" />
                  {t.heroCta}
                </Button>
              </motion.div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Link href="#projects">
                  <a>
                    <Button variant="accent" className="w-full sm:w-auto px-6 py-3">
                      Портфолио • Кейсы
                    </Button>
                  </a>
                </Link>
              </motion.div>
            </div>

            {/* subtle scroll hint (small) — light color */}
            <div className="mt-6 text-xs text-white/70 opacity-95">Работаем с частными и промышленными объектами — напишите задачу и получите смету</div>
          </motion.div>
        </div>
      </header>

      {/* MAIN */}
      <main className="container mx-auto px-4 py-12 space-y-12">
        {/* SERVICES */}
        <section id="services" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <h2 className="col-span-3 text-3xl font-orbitron text-accent">{t.servicesTitle}</h2>

          <motion.div whileHover={{ scale: 1.02 }} className="col-span-3 md:col-span-1">
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <VibeContentRenderer content="::FaWrench::" /> Монтаж и замена трубопроводов
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Укладка и замена водопроводов, канализации и систем отопления — от частных домов до промышленных объектов.
                </p>
                <ul className="list-inside list-disc mt-3 text-sm text-foreground">
                  <li>Водопровод, канализация, отопление</li>
                  <li>Работа с ПНД, сталью, композитами</li>
                  <li>Гарантии и приём работ в строгом соответствии с нормами</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="col-span-3 md:col-span-1">
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <VibeContentRenderer content="::FaScrewdriverWrench::" /> Демонтаж и монтаж арматуры
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Снятие старых коммуникаций, установка и регулировка водозапорной арматуры, обустройство колодцев и КНС.
                </p>
                <ul className="list-inside list-disc mt-3 text-sm text-foreground">
                  <li>Демонтаж старых трубопроводов</li>
                  <li>Монтаж колодцев, септиков и камер</li>
                  <li>Пусконаладка и исполнительная документация</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="col-span-3 md:col-span-1">
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <VibeContentRenderer content="::FaLink::" /> Врезки, сварка и соединения
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Точные врезки в существующие сети, сварка ПНД, монтаж муфт и электро-фитингов — без остановки объекта, когда это критично.
                </p>
                <ul className="list-inside list-disc mt-3 text-sm text-foreground">
                  <li>Бесколодезные задвижки и электро-фитинги</li>
                  <li>Врезка без отключения (если проект позволяет)</li>
                  <li>Контроль качества сварных швов</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        {/* WHY + CONTACT ASIDE */}
        <section id="why" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-orbitron text-accent">{t.whyTitle}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Мы объединяем опыт монтажников, инженеров и менеджеров проектов — чтобы ваша стройка шла по плану и без сюрпризов.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: "::FaShieldHalved::", title: "Надёжность", body: "Сертифицированное оборудование, трассировка работ и гарантия на монтаж." },
                { icon: "::FaClock::", title: "Сроки", body: "Планируем работу так, чтобы минимизировать простой объекта и уложиться в бюджет." },
                { icon: "::FaHelmetSafety::", title: "Безопасность", body: "Полное соблюдение техники безопасности и СНИП / ГОСТ при выполнении работ." },
                { icon: "::FaToolbox::", title: "Технологии", body: "Современные методы сварки, бесшовные врезки и точная исполнительная съемка." },
              ].map((it) => (
                <div key={it.title} className="p-4 bg-card border border-border rounded">
                  <h4 className="font-semibold flex items-center gap-2">
                    <VibeContentRenderer content={it.icon} /> {it.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">{it.body}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="sticky top-20">
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Свяжитесь с нами</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-foreground mb-3 flex items-center gap-2">
                    <VibeContentRenderer content="::FaPhone::" /> {t.phone}
                  </div>
                  <div className="text-sm text-foreground mb-3 flex items-center gap-2">
                    <VibeContentRenderer content="::FaEnvelope::" /> {t.email}
                  </div>
                  <div className="text-sm text-foreground mb-4 flex items-center gap-2">
                    <VibeContentRenderer content="::FaMapLocation::" /> {t.address}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="w-full">
                      Оставить заявку
                    </Button>
                    <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(t.phone); setCopied(true); }} className="px-3">
                      {copied ? "Скопировано" : "Копировать"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </aside>
        </section>

        {/* PROJECTS */}
        <section id="projects" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-orbitron text-accent">Кейсы и проекты</h2>
            <Link href="/optimapipe/cases/project-1">
              <a className="text-sm underline">Все кейсы →</a>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((src, i) => {
              const slug = `project-${i + 1}`;
              return (
                <motion.div key={i} whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 200 }}>
                  <Card className="bg-card border-border overflow-hidden">
                    <div className="relative h-48 w-full rounded-t overflow-hidden">
                      <Image src={src} alt={`project-${i}`} fill style={{ objectFit: "cover" }} unoptimized />
                    </div>
                    <CardContent>
                      <h4 className="font-semibold">Проект #{i + 1} — промышленная сеть</h4>
                      <p className="text-sm text-muted-foreground mt-2">Монтаж магистрали, врезки и пуско-наладка. Срок — 6 недель.</p>
                      <div className="mt-4 flex gap-2">
                        <Link href={`/optimapipe/cases/${slug}`}>
                          <a>
                            <Button variant="ghost">Подробнее</Button>
                          </a>
                        </Link>
                        <Button
                          onClick={() => {
                            navigator.clipboard?.writeText("Контакт: " + t.phone);
                            toast.success("Скопировано в буфер обмена");
                          }}
                        >
                          Копировать контакт
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CONTACT FORM */}
        <section id="contact" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-orbitron text-accent">{t.contactTitle}</h2>
            <p className="text-sm text-muted-foreground">
              Оставьте заявку — менеджер свяжется в рабочее время и подготовит коммерческое предложение.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} aria-labelledby="contact-title">
              <label className="block">
                <span className="text-xs text-muted-foreground">Имя</span>
                <Input placeholder="Введите имя" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} aria-required />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground">Телефон</span>
                  <Input placeholder="Телефон" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} inputMode="tel" />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <Input placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} type="email" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-muted-foreground">Кратко опишите задачу</span>
                <Textarea placeholder="Например: замена магистрали 100м, врезка в действующую сеть" value={form.message} onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))} rows={6} />
              </label>

              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <Button type="submit" disabled={sending} className="w-full sm:w-auto">
                  {sending ? "Отправка..." : "Отправить"}
                </Button>
                <Button variant="outline" onClick={() => setForm({ name: "", phone: "", email: "", message: "" })} className="w-full sm:w-auto">
                  Очистить
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">Мы отвечаем в рабочие часы</div>
              </div>
            </form>
          </div>

          <aside className="lg:col-span-1">
            <Card className="bg-card border-border p-6">
              <h4 className="font-semibold">Телефон</h4>
              <div className="text-sm text-foreground mt-2 flex items-center gap-2">
                <VibeContentRenderer content="::FaPhone::" /> {t.phone}
              </div>

              <h4 className="font-semibold mt-4">Email</h4>
              <div className="text-sm text-foreground mt-2 flex items-center gap-2">
                <VibeContentRenderer content="::FaEnvelope::" /> {t.email}
              </div>

              <h4 className="font-semibold mt-4">Адрес</h4>
              <div className="text-sm text-foreground mt-2 flex items-center gap-2">
                <VibeContentRenderer content="::FaMapLocation::" /> {t.address}
              </div>

              <div className="mt-6 text-xs text-muted-foreground">Готовы подготовить смету по чертежам или выезду на объект. Работы по договору с актами приёма.</div>
            </Card>
          </aside>
        </section>

        {/* FOOTER */}
        <footer className="py-8 text-sm text-muted-foreground">
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} {t.company} — Все права защищены</div>
            <div className="flex items-center gap-4">
              <a href={`tel:${t.phone}`} className="hover:underline flex items-center gap-2">
                <VibeContentRenderer content="::FaPhone::" /> {t.phone}
              </a>
              <a href={`mailto:${t.email}`} className="hover:underline flex items-center gap-2">
                <VibeContentRenderer content="::FaEnvelope::" /> {t.email}
              </a>
            </div>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .font-orbitron {
          font-family: "Orbitron", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }
        @media (max-width: 640px) {
          main {
            padding-bottom: 120px;
          }
        }
        /* subtle focus styles for accessibility */
        :global(input:focus, textarea:focus, button:focus) {
          outline: 2px solid rgba(255,214,105,0.18);
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}