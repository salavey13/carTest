import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileText, Handshake, MessageCircle, ShieldCheck } from "lucide-react";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";
import { crewPaletteForSurface, readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { SubrentFlowClient } from "./SubrentFlowClient";

interface PartnerOnboardingPageProps {
  params: Promise<{ slug: string }>;
}

const checklistIcons = [MessageCircle, ClipboardCheck, FileText, ShieldCheck] as const;

const checklistIconByName = {
  "message-circle": MessageCircle,
  "clipboard-check": ClipboardCheck,
  "file-text": FileText,
  "shield-check": ShieldCheck,
} as const;

function getChecklistIcon(iconName: string | undefined, index: number) {
  if (iconName && iconName in checklistIconByName) {
    return checklistIconByName[iconName as keyof typeof checklistIconByName];
  }

  return checklistIcons[index % checklistIcons.length];
}


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
  const activePath = `/franchize/${crewSlug}/onboarding`;
  const surface = crewPaletteForSurface(crew.theme);
  const brandName = crew.header.brandName || crew.name || "Экипаж";

  // Use crew-specific telegram handle with fallback to bot username
  const crewTelegram = crew.contacts.telegram?.replace("@", "");
  const crewBotUsername = crew.contacts.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME;
  const telegramHref = crewTelegram
    ? `https://t.me/${crewTelegram}`
    : crewBotUsername
      ? `https://t.me/${crewBotUsername}`
      : "";
  const { onboardingChecklist, onboardingReadinessRows } = crew.contentBlocks;
  const accentText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(crewSlug, activePath)} items={items} />
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-20 md:pt-24"
        style={{
          ["--onboarding-accent" as string]: crew.theme.palette.accentMain,
          ["--onboarding-border" as string]: crew.theme.palette.borderSoft,
          ["--onboarding-card" as string]: surface.subtleCard.backgroundColor,
          ["--onboarding-base-soft" as string]: withAlpha(crew.theme.palette.bgBase, 0.25),
          ["--onboarding-card-faint" as string]: withAlpha(crew.theme.palette.bgCard, 0.55),
          ["--onboarding-accent-text" as string]: accentText,
          color: crew.theme.palette.textPrimary,
        }}
      >
        <section className="overflow-hidden rounded-3xl border border-[var(--onboarding-border)] bg-[var(--onboarding-card)] p-6 shadow-2xl md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--onboarding-accent)]">FRZ-R4 • partner onboarding</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr,0.9fr] lg:items-end">
            <div>
              <h1 className="font-orbitron text-4xl leading-tight md:text-6xl">Подключение партнёра {brandName}</h1>
              <p className="mt-4 max-w-2xl text-base opacity-70 md:text-lg">
                Один понятный маршрут от первого сообщения до живой витрины: каталог, продажи, аренда, MapRiders и операционные роли без хаоса в чатах.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={telegramHref} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--onboarding-accent)] px-5 py-3 text-sm font-semibold text-[var(--onboarding-accent-text)] transition hover:brightness-110">
                  Начать в Telegram
                </a>
                <Link href={`/franchize/${crewSlug}/sales`} className="rounded-full border border-current/20 px-5 py-3 text-sm font-semibold transition hover:border-current/50">
                  Посмотреть sales vertical
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--onboarding-border)] bg-[var(--onboarding-base-soft)] p-5">
              <div className="flex items-center gap-3 text-[var(--onboarding-accent)]">
                <Handshake className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-[0.16em]">Definition of ready</span>
              </div>
              <ul className="mt-4 space-y-3 text-sm opacity-75">
                {onboardingReadinessRows.map((row) => (
                  <li key={row.label} className="grid gap-1 rounded-2xl border border-[var(--onboarding-border)] bg-[var(--onboarding-card-faint)] p-3">
                    <span className="font-semibold opacity-100">{row.label}</span>
                    <span>{row.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {onboardingChecklist.map((item, index) => {
            const Icon = getChecklistIcon(item.icon, index);
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

        <section className="rounded-3xl border border-[var(--onboarding-border)] bg-[var(--onboarding-base-soft)] p-6">
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

        {/* Subrent flow - for bike owners who want to join existing crew */}
        <SubrentFlowClient
          crew={crew}
          crewSlug={crewSlug}
          bikes={items}
          theme={crew.theme}
          accentText={accentText}
        />
      </div>
      <CrewFooter crew={crew} />
    </main>
  );
}
