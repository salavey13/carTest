import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileText, Handshake, MessageCircle, ShieldCheck } from "lucide-react";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface PartnerOnboardingPageProps {
  params: Promise<{ slug: string }>;
}

const checklist = [
  {
    title: "Заявка и контакт",
    text: "Фиксируем Telegram/телефон, город, формат партнёрства и ожидаемый объём байков.",
    icon: MessageCircle,
  },
  {
    title: "Парк и роли",
    text: "Описываем модели, статусы аренды/продажи, ответственных за выдачу, сервис и контент.",
    icon: ClipboardCheck,
  },
  {
    title: "Документы и правила",
    text: "Согласуем договор, депозит, чеклист выдачи, ограничения по району и страховочные сценарии.",
    icon: FileText,
  },
  {
    title: "Пилотный запуск",
    text: "Включаем витрину, тестовый заказ, MapRiders-сценарий и короткий smoke-check в Telegram WebApp.",
    icon: ShieldCheck,
  },
];

const readinessRows = [
  ["Брендинг", "лого, цвета, оффер, адрес и рабочие часы"],
  ["Каталог", "аренда, продажа, электробайки, аксессуары"],
  ["Операции", "выдача, возврат, сервис, админ-доступы"],
  ["Продажи", "новые/электро/б/у/trade-in лиды и тест-драйв"],
  ["Комьюнити", "MapRiders, события, партнёры и Telegram-канал"],
];

export async function generateMetadata({ params }: PartnerOnboardingPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Partner onboarding",
    sectionDescription: "Чеклист подключения партнёра VIP-bike к франшизной витрине.",
    pathSuffix: "/onboarding",
  });
}

export default async function PartnerOnboardingPage({ params }: PartnerOnboardingPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const brandName = crew.header.brandName || crew.name || "VIP BIKE";
  const telegramHref = crew.contacts.telegram ? `https://t.me/${crew.contacts.telegram.replace("@", "")}` : "https://t.me/oneBikePlsBot";

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crewSlug}/onboarding`} groupLinks={items.map((item) => item.category)} />
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-20 md:pt-24"
        style={{
          ["--onboarding-accent" as string]: crew.theme.palette.accentMain,
          ["--onboarding-border" as string]: crew.theme.palette.borderSoft,
          ["--onboarding-card" as string]: surface.subtleCard.backgroundColor,
          color: crew.theme.palette.textPrimary,
        }}
      >
        <section className="overflow-hidden rounded-3xl border border-[var(--onboarding-border)] bg-[var(--onboarding-card)] p-6 shadow-2xl shadow-black/20 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--onboarding-accent)]">FRZ-R4 • partner onboarding</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr,0.9fr] lg:items-end">
            <div>
              <h1 className="font-orbitron text-4xl leading-tight md:text-6xl">Подключение партнёра {brandName}</h1>
              <p className="mt-4 max-w-2xl text-base opacity-70 md:text-lg">
                Один понятный маршрут от первого сообщения до живой витрины: каталог, продажи, аренда, MapRiders и операционные роли без хаоса в чатах.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={telegramHref} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--onboarding-accent)] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110">
                  Начать в Telegram
                </a>
                <Link href={`/franchize/${crewSlug}/sales`} className="rounded-full border border-current/20 px-5 py-3 text-sm font-semibold transition hover:border-current/50">
                  Посмотреть sales vertical
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border border-current/10 bg-black/25 p-5">
              <div className="flex items-center gap-3 text-[var(--onboarding-accent)]">
                <Handshake className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-[0.16em]">Definition of ready</span>
              </div>
              <ul className="mt-4 space-y-3 text-sm opacity-75">
                {readinessRows.map(([label, text]) => (
                  <li key={label} className="grid gap-1 rounded-2xl border border-current/10 bg-white/[0.03] p-3">
                    <span className="font-semibold opacity-100">{label}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {checklist.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-3xl border border-[var(--onboarding-border)] bg-[var(--onboarding-card)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-6 w-6 text-[var(--onboarding-accent)]" />
                  <span className="rounded-full border border-[var(--onboarding-accent)]/35 px-3 py-1 text-xs text-[var(--onboarding-accent)]">шаг {index + 1}</span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 opacity-70">{item.text}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-[var(--onboarding-border)] bg-black/25 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-[var(--onboarding-accent)]" />
            <div>
              <h2 className="font-orbitron text-2xl">Готово к пилоту, когда всё отмечено</h2>
              <p className="mt-2 text-sm leading-6 opacity-70">
                После чеклиста партнёр получает рабочие ссылки на каталог, sales-страницу, аренду, MapRiders и админку. Следующий шаг — тестовый заказ и короткая проверка на реальном телефоне в Telegram WebApp.
              </p>
            </div>
          </div>
        </section>
      </div>
      <CrewFooter crew={crew} />
    </main>
  );
}
