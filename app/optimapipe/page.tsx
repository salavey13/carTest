// /app/optimapipe/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { toast } from "sonner";
import { getTelegramUser } from "@/lib/telegram";

// /app/optimapipe/page.tsx — оптимизированная версия
// Улучшено: адаптивность, анимации (framer-motion), accessibility, интеграция с Telegram (клиентская часть), реальная отправка формы на /api/send-contact (server handler должен быть реализован отдельно и вызывать sendComplexMessage)

const t = {
  company: "ООО \"Оптимапайп\"",
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

    // Подготовим payload. Если мы внутри Telegram WebApp — подхватим юзера для удобства.
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

  const heroImage = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.0.3&s=bd8b1c1d7f8b1b8d2a2b3c4d5e6f7a8b";
  const projects = [
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/883_original-7b7c2108-cc6f-455b-9efd-10cd65fa3c97.webp",
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/5d2ee1919380006ba715e997-4a06c39a-1b5f-4030-a66f-93100060d4ba.jpg",
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/2965769-013f70ea-5a13-479e-9baa-2a75eb972b13.jpg",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image src={heroImage} alt="optimapipe hero" fill style={{ objectFit: "cover" }} priority />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/60" />
        </div>

        <div className="container mx-auto px-4 py-24">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl text-center mx-auto">
            <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">{t.company}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t.subtitle}</p>
            <div className="mt-8 flex justify-center gap-4">
              <Button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="px-6 py-3">
                <VibeContentRenderer content="::FaPhone::" className="inline mr-2 h-4 w-4" /> {t.heroCta}
              </Button>
              <Button variant="ghost" onClick={() => window.scrollTo({ top: 700, behavior: "smooth" })}>
                Портфолио • Кейсы
              </Button>
            </div>
          </motion.div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-12">
        {/* SERVICES */}
        <section id="services" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <h2 className="col-span-3 text-3xl font-orbitron text-accent">{t.servicesTitle}</h2>

          <motion.div whileHover={{ scale: 1.02 }} className="col-span-3 md:col-span-1">
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><VibeContentRenderer content="::FaWrench::" /> Монтаж и замена трубопроводов</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Укладка и замена водопроводов, канализации и систем отопления — от частных домов до промышленных объектов.</p>
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
                <CardTitle className="flex items-center gap-2"><VibeContentRenderer content="::FaScrewdriverWrench::" /> Демонтаж и монтаж арматуры</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Снятие старых коммуникаций, установка и регулировка водозапорной арматуры, обустройство колодцев и КНС.</p>
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
                <CardTitle className="flex items-center gap-2"><VibeContentRenderer content="::FaLink::" /> Врезки, сварка и соединения</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Точные врезки в существующие сети, сварка ПНД, монтаж муфт и электро-фитингов — без остановки объекта, когда это критично.</p>
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
            <p className="mt-3 text-sm text-muted-foreground">Мы объединяем опыт монтажников, инженеров и менеджеров проектов — чтобы ваша стройка шла по плану и без сюрпризов.</p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: "::FaShieldAlt::", title: "Надёжность", body: "Сертифицированное оборудование, трассировка работ и гарантия на монтаж." },
                { icon: "::FaClock::", title: "Сроки", body: "Планируем работу так, чтобы минимизировать простой объекта и уложиться в бюджет." },
                { icon: "::FaHardHat::", title: "Безопасность", body: "Полное соблюдение техники безопасности и СНИП / ГОСТ при выполнении работ." },
                { icon: "::FaCog::", title: "Технологии", body: "Современные методы сварки, бесшовные врезки и точная исполнительная съемка." },
              ].map((it) => (
                <div key={it.title} className="p-4 bg-card border border-border rounded">
                  <h4 className="font-semibold flex items-center gap-2"><VibeContentRenderer content={it.icon} /> {it.title}</h4>
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
                  <div className="text-sm text-foreground mb-3 flex items-center gap-2"><VibeContentRenderer content="::FaPhone::" /> {t.phone}</div>
                  <div className="text-sm text-foreground mb-3 flex items-center gap-2"><VibeContentRenderer content="::FaEnvelope::" /> {t.email}</div>
                  <div className="text-sm text-foreground mb-4 flex items-center gap-2"><VibeContentRenderer content="::FaMapMarkerAlt::" /> {t.address}</div>
                  <div className="flex gap-2">
                    <Button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="w-full">Оставить заявку</Button>
                    <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(t.phone); setCopied(true); }} className="px-3">{copied ? 'Скопировано' : 'Копировать'}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </aside>
        </section>

        {/* PROJECTS */}
        <section id="projects" className="space-y-6">
          <h2 className="text-3xl font-orbitron text-accent">Кейсы и проекты</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((src, i) => (
              <motion.div key={i} whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 200 }}>
                <Card className="bg-card border-border overflow-hidden">
                  <div className="relative h-48 w-full rounded-t overflow-hidden">
                    <Image src={src} alt={`project-${i}`} fill style={{ objectFit: "cover" }} />
                  </div>
                  <CardContent>
                    <h4 className="font-semibold">Проект #{i + 1} — промышленная сеть</h4>
                    <p className="text-sm text-muted-foreground mt-2">Монтаж магистрали, врезки и пуско-наладка. Срок — 6 недель.</p>
                    <div className="mt-4 flex gap-2">
                      <Button variant="ghost">Подробнее</Button>
                      <Button onClick={() => { navigator.clipboard?.writeText("Контакт: " + t.phone); toast("Скопировано в буфер"); }}>Копировать контакт</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CONTACT FORM */}
        <section id="contact" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-orbitron text-accent">{t.contactTitle}</h2>
            <p className="text-sm text-muted-foreground">Оставьте заявку — менеджер свяжется в рабочее время и подготовит коммерческое предложение.</p>

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

              <div className="flex gap-3 items-center">
                <Button type="submit" disabled={sending}>{sending ? "Отправка..." : "Отправить"}</Button>
                <Button variant="outline" onClick={() => setForm({ name: "", phone: "", email: "", message: "" })}>Очистить</Button>
                <div className="ml-auto text-sm text-muted-foreground">Мы отвечаем в рабочие часы</div>
              </div>
            </form>
          </div>

          <aside className="lg:col-span-1">
            <Card className="bg-card border-border p-6">
              <h4 className="font-semibold">Телефон</h4>
              <div className="text-sm text-foreground mt-2 flex items-center gap-2"><VibeContentRenderer content="::FaPhone::" /> {t.phone}</div>

              <h4 className="font-semibold mt-4">Email</h4>
              <div className="text-sm text-foreground mt-2 flex items-center gap-2"><VibeContentRenderer content="::FaEnvelope::" /> {t.email}</div>

              <h4 className="font-semibold mt-4">Адрес</h4>
              <div className="text-sm text-foreground mt-2 flex items-center gap-2"><VibeContentRenderer content="::FaMapMarkerAlt::" /> {t.address}</div>

              <div className="mt-6 text-xs text-muted-foreground">Готовы подготовить смету по чертежам или выезду на объект. Работы по договору с актами приёма.</div>
            </Card>
          </aside>
        </section>

        {/* FOOTER */}
        <footer className="py-8 text-sm text-muted-foreground">
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} {t.company} — Все права защищены</div>
            <div className="flex items-center gap-4">
              <a href={`tel:${t.phone}`} className="hover:underline flex items-center gap-2"><VibeContentRenderer content="::FaPhone::" /> {t.phone}</a>
              <a href={`mailto:${t.email}`} className="hover:underline flex items-center gap-2"><VibeContentRenderer content="::FaEnvelope::" /> {t.email}</a>
            </div>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .font-orbitron { font-family: 'Orbitron', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
        @media (max-width: 640px) {
          main { padding-bottom: 120px; }
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