"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { toast } from "sonner";

// Небольшой объект локализации — используй / вытяни в i18n позже
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

type ContactForm = {
  name: string;
  phone: string;
  email: string;
  message: string;
};

export default function OptimapipeLandingPage(): JSX.Element {
  const [form, setForm] = useState<ContactForm>({ name: "", phone: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  // Простейшая валидация — расширяй под свои API
  function validate(form: ContactForm) {
    if (!form.name.trim()) return "Введите имя";
    if (!form.phone.trim() && !form.email.trim()) return "Укажите телефон или email";
    return null;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const err = validate(form);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      setSending(true);
      // временная имитация отправки — замените на fetch('/api/contact')
      await new Promise((res) => setTimeout(res, 900));
      toast.success("Заявка отправлена — менеджер свяжется в рабочее время");
      setForm({ name: "", phone: "", email: "", message: "" });
    } catch (err) {
      console.error(err);
      toast.error("Ошибка отправки — попробуйте позже");
    } finally {
      setSending(false);
    }
  }

  const heroImage = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.0.3&s=bd8b1c1d7f8b1b8d2a2b3c4d5e6f7a8b"; // плейсхолдер — заменим
  const projectImg1 = "https://picsum.photos/seed/optimapipe-1/800/600";
  const projectImg2 = "https://picsum.photos/seed/optimapipe-2/800/600";
  const projectImg3 = "https://picsum.photos/seed/optimapipe-3/800/600";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image src={heroImage} alt="optimapipe hero" fill style={{ objectFit: "cover" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/60" />
        </div>

        <div className="container mx-auto px-4 py-24">
          <div className="max-w-4xl text-center mx-auto">
            <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">{t.company}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t.subtitle}</p>
            <div className="mt-8 flex justify-center gap-4">
              <Button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="px-6 py-3">
                <VibeContentRenderer content="::FaPhone::" className="inline mr-2 h-4 w-4" /> {t.heroCta}
              </Button>
              <Button variant="ghost" onClick={() => window.scrollTo({ top: 600, behavior: "smooth" })}>
                Портфолио • Кейсы
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-12">
        {/* SERVICE LIST */}
        <section id="services" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <h2 className="col-span-3 text-3xl font-orbitron text-accent">{t.servicesTitle}</h2>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><VibeContentRenderer content="::FaWrench::" /> Монтаж и замена трубопроводов</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Укладка и замена водопроводов, канализации и систем отопления любой сложности — от частных домов до промышленных объектов.</p>
              <ul className="list-inside list-disc mt-3 text-sm text-foreground">
                <li>Водопровод, канализация, отопление</li>
                <li>Работа с ПНД, сталью, композитами</li>
                <li>Гарантии и приём работ в строгом соответствии с нормами</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
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

          <Card className="bg-card border-border">
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
        </section>

        {/* WHY US */}
        <section id="why" className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2">
            <h2 className="text-3xl font-orbitron text-accent">{t.whyTitle}</h2>
            <p className="mt-3 text-sm text-muted-foreground">Мы объединяем опыт монтажников, инженеров и менеджеров проектов — чтобы ваша стройка шла по плану и без сюрпризов.</p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-card border border-border rounded">
                <h4 className="font-semibold flex items-center gap-2"><VibeContentRenderer content="::FaShieldAlt::" /> Надёжность</h4>
                <p className="text-sm text-muted-foreground mt-1">Сертифицированное оборудование, трассировка работ и гарантия на монтаж.</p>
              </div>
              <div className="p-4 bg-card border border-border rounded">
                <h4 className="font-semibold flex items-center gap-2"><VibeContentRenderer content="::FaClock::" /> Сроки</h4>
                <p className="text-sm text-muted-foreground mt-1">Планируем работу так, чтобы минимизировать простой объекта и уложиться в бюджет.</p>
              </div>
              <div className="p-4 bg-card border border-border rounded">
                <h4 className="font-semibold flex items-center gap-2"><VibeContentRenderer content="::FaHardHat::" /> Безопасность</h4>
                <p className="text-sm text-muted-foreground mt-1">Полное соблюдение техники безопасности и СНИП / ГОСТ при выполнении работ.</p>
              </div>
              <div className="p-4 bg-card border border-border rounded">
                <h4 className="font-semibold flex items-center gap-2"><VibeContentRenderer content="::FaCog::" /> Технологии</h4>
                <p className="text-sm text-muted-foreground mt-1">Современные методы сварки, бесшовные врезки и точная исполнительная съемка.</p>
              </div>
            </div>
          </div>

          {/* Quick contact card */}
          <aside>
            <Card className="bg-card border-border sticky top-24">
              <CardHeader>
                <CardTitle>Свяжитесь с нами</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground mb-3 flex items-center gap-2"><VibeContentRenderer content="::FaPhone::" /> {t.phone}</div>
                <div className="text-sm text-foreground mb-3 flex items-center gap-2"><VibeContentRenderer content="::FaEnvelope::" /> {t.email}</div>
                <div className="text-sm text-foreground mb-4 flex items-center gap-2"><VibeContentRenderer content="::FaMapMarkerAlt::" /> {t.address}</div>
                <Button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="w-full">Оставить заявку</Button>
              </CardContent>
            </Card>
          </aside>
        </section>

        {/* Projects / Cases */}
        <section id="projects" className="space-y-6">
          <h2 className="text-3xl font-orbitron text-accent">Кейсы и проекты</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[projectImg1, projectImg2, projectImg3].map((src, i) => (
              <Card key={i} className="bg-card border-border">
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
            ))}
          </div>
        </section>

        {/* CONTACT FORM */}
        <section id="contact" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-3xl font-orbitron text-accent">{t.contactTitle}</h2>
            <p className="text-sm text-muted-foreground">Оставьте заявку — менеджер свяжется в рабочее время и подготовит коммерческое предложение.</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <Input placeholder="Имя" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
              <Input placeholder="Телефон" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
              <Textarea placeholder="Кратко опишите задачу" value={form.message} onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))} />
              <div className="flex gap-3">
                <Button type="submit" disabled={sending}>{sending ? "Отправка..." : "Отправить"}</Button>
                <Button variant="outline" onClick={() => setForm({ name: "", phone: "", email: "", message: "" })}>Очистить</Button>
              </div>
            </form>
          </div>

          <aside>
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
      `}</style>
    </div>
  );
}