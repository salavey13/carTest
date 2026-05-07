import type { Metadata } from "next";
import Link from "next/link";
import {
  Bike,
  CheckCircle2,
  Map,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  getFranchizeBySlug,
  type CatalogItemVM,
  type FranchizeCrewVM,
} from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeHero } from "../../components/FranchizeHero";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { getFranchizeRouteCtaPolicy } from "../../lib/route-cta-policy";
import { buildFranchizeIntentLinks } from "../../lib/section-links";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeAboutPageProps {
  params: Promise<{ slug: string }>;
}

type AboutCard = {
  title: string;
  text: string;
  icon: LucideIcon;
};

type AboutStep = {
  title: string;
  text: string;
};

type TrustStripItem = {
  label: string;
  value: string;
  copy: string;
  icon: LucideIcon;
};

const softCardClass = "rounded-2xl border p-4";
const accentTextClass = "text-[var(--franchize-shell-accent)]";
const mutedTextClass = "text-[var(--franchize-shell-muted)]";
const secondaryCtaClass =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--franchize-shell-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--franchize-shell-text)] transition hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--franchize-shell-ring)]";

const countAvailableItems = (items: CatalogItemVM[]) =>
  items.filter((item) => item.availabilityStatus === "available").length;

const buildContactAvailability = (crew: FranchizeCrewVM) => {
  if (crew.contacts.telegram) return "Telegram на связи";
  if (crew.contacts.phone) return "Телефон на связи";
  if (crew.contacts.email) return "Email на связи";
  if (crew.contacts.workingHours) return crew.contacts.workingHours;

  return "Контакты уточняются";
};

const buildCatalogTrustValue = (activeCatalogCount: number, totalCatalogCount: number) => {
  if (totalCatalogCount === 0) return "Каталог готовится";

  return `${activeCatalogCount}/${totalCatalogCount}`;
};

const buildCatalogTrustCopy = (activeCatalogCount: number, totalCatalogCount: number) => {
  if (totalCatalogCount === 0) {
    return "Позиции ещё не опубликованы — можно оставить контакт, и оператор подберёт байк вручную.";
  }

  if (activeCatalogCount === 0) {
    return "Позиции уже заведены, но доступность нужно подтвердить у оператора перед заявкой.";
  }

  return "Доступных позиций сейчас; полный список можно проверить в каталоге.";
};

const crewCapabilities = (brandName: string): AboutCard[] => [
  {
    title: "Аренды без лишнего трения",
    text: "Помогаем быстро выбрать байк, дату и формат поездки — от короткого теста до полноценного маршрута.",
    icon: Bike,
  },
  {
    title: "Продажи и конфигуратор",
    text: "Собираем заявку на покупку, custom/electric сценарии, trade-in и консультацию по подходящей модели.",
    icon: ShoppingBag,
  },
  {
    title: "MapRiders и комьюнити",
    text: "Подключаем райдеров, meetup-точки и локальные маршруты, чтобы экипаж был не просто витриной, а живой сетью.",
    icon: Map,
  },
  {
    title: "Сервис и помощь",
    text: `${brandName} держит рядом поддержку: выдача, подсказки по эксплуатации, возврат и разбор вопросов после поездки.`,
    icon: Wrench,
  },
];

const workSteps: AboutStep[] = [
  {
    title: "Выберите байк",
    text: "Откройте каталог, сравните доступные позиции и добавьте подходящий вариант в заявку.",
  },
  {
    title: "Подтвердите в Telegram",
    text: "Оператор уточнит время, документы, оплату и важные детали прямо в привычном чате.",
  },
  {
    title: "Заберите и катайтесь",
    text: "На точке выдачи проверяем состояние, правила маршрута и передаём экипировку/инструкции.",
  },
  {
    title: "Верните и оставьте отзыв",
    text: "Закрываем поездку, фиксируем опыт и улучшаем витрину по реальным отзывам райдеров.",
  },
];

export async function generateMetadata({
  params,
}: FranchizeAboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "О нас",
    sectionDescription: "О франшизе, команде, ценностях и формате работы экипажа.",
    pathSuffix: "/about",
  });
}

export default async function FranchizeAboutPage({ params }: FranchizeAboutPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("content");
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/about`;
  const brandName = crew.header.brandName || crew.name || "Экипаж OneBikePls";
  const description = crew.description?.trim();
  const hasSparseMetadata = !description || !crew.contacts.telegram || !crew.contacts.address;
  const pitch =
    description ||
    "Эта страница соберёт позиционирование, контакты и рабочий формат экипажа, как только франшиза заполнит профиль. Пока можно перейти в каталог или написать оператору — заявка не потеряется.";
  const activeCatalogCount = countAvailableItems(items);
  const totalCatalogCount = items.length;
  const contactAvailability = buildContactAvailability(crew);
  const ratingLabel =
    crew.ratingSummary.count > 0 ? `★ ${crew.ratingSummary.average.toFixed(1)}` : "Новый экипаж";
  const ratingCopy =
    crew.ratingSummary.count > 0
      ? `${crew.ratingSummary.count} отзывов после поездок`
      : "Отзывы появятся после первых заказов";
  const capabilities = crewCapabilities(brandName);
  const trustStrip: TrustStripItem[] = [
    {
      label: "Рейтинг",
      value: ratingLabel,
      copy: ratingCopy,
      icon: Star,
    },
    {
      label: "Активный каталог",
      value: buildCatalogTrustValue(activeCatalogCount, totalCatalogCount),
      copy: buildCatalogTrustCopy(activeCatalogCount, totalCatalogCount),
      icon: Bike,
    },
    {
      label: "Связь",
      value: contactAvailability,
      copy:
        crew.contacts.workingHours ||
        "Если данных мало, используйте контакты OneBikePls — оператор поможет маршрутизировать заявку.",
      icon: MessageCircle,
    },
  ];

  return (
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={items.map((item) => item.category)}
        sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)}
      />
      <FranchizePageShell theme={crew.theme} className="pb-14">
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/about · экипаж`}
          title={`${brandName}: байки, маршруты и поддержка в одном экипаже`}
          subcopy={pitch}
          primaryCta={{ label: "Смотреть каталог", href: `/franchize/${resolvedSlug}` }}
          secondaryCta={{ label: "Связаться", href: `/franchize/${resolvedSlug}/contacts` }}
        >
          <div className="rounded-2xl border px-4 py-3 text-sm" style={surface.subtleCard}>
            <div className={`flex items-center gap-2 font-bold ${accentTextClass}`}>
              <ShieldCheck className="h-5 w-5" />
              Telegram-first экипаж
            </div>
            <p className={`mt-2 leading-6 ${mutedTextClass}`}>
              Позиционирование строится вокруг быстрой заявки, прозрачного контакта и понятной точки выдачи.
            </p>
          </div>
        </FranchizeHero>

        <section className="mt-8 grid gap-3 md:grid-cols-3" aria-label="Доверие к экипажу">
          {trustStrip.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={softCardClass} style={surface.subtleCard}>
                <div className={`flex items-center gap-2 text-sm font-semibold ${accentTextClass}`}>
                  <Icon className="h-4 w-4" /> {item.label}
                </div>
                <p className="mt-3 text-2xl font-black">{item.value}</p>
                <p className={`mt-1 text-sm ${mutedTextClass}`}>{item.copy}</p>
              </div>
            );
          })}
        </section>

        {hasSparseMetadata ? (
          <section className="mt-6 rounded-3xl border border-dashed p-5" style={surface.subtleCard}>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${accentTextClass}`}>
              профиль в процессе заполнения
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Некоторые данные экипажа ещё уточняются</h2>
            <p className={`mt-2 text-sm leading-6 ${mutedTextClass}`}>
              Мы не прячем пустые места: если описания, адреса или Telegram пока нет, страница показывает безопасные
              fallback-подсказки и ведёт пользователя к каталогу или контактам поддержки.
            </p>
          </section>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${accentTextClass}`}>
                capabilities
              </p>
              <h2 className="mt-2 text-3xl font-semibold">Что умеет экипаж</h2>
            </div>
            <p className={`max-w-xl text-sm leading-6 ${mutedTextClass}`}>
              От первой идеи поездки до возврата и повторной покупки — всё завязано на понятный операторский сценарий.
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <article key={capability.title} className="rounded-3xl border p-5" style={surface.subtleCard}>
                  <Icon className={`h-7 w-7 ${accentTextClass}`} />
                  <h3 className="mt-4 text-xl font-semibold">{capability.title}</h3>
                  <p className={`mt-2 text-sm leading-6 ${mutedTextClass}`}>{capability.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${accentTextClass}`}>
            ride flow
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Как это работает</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            {workSteps.map((step, index) => (
              <article key={step.title} className="rounded-3xl border p-5" style={surface.subtleCard}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--franchize-shell-accent)] text-sm font-black text-[var(--franchize-shell-primary-contrast)]">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className={`mt-2 text-sm leading-6 ${mutedTextClass}`}>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border p-5 sm:p-6" style={surface.subtleCard}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className={`flex items-center gap-2 text-sm font-semibold ${accentTextClass}`}>
                <Sparkles className="h-5 w-5" /> Готовы выбрать следующий шаг?
              </div>
              <h2 className="mt-2 text-2xl font-semibold">
                Каталог, покупка или прямой контакт — без лишних экранов.
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 md:min-w-[32rem]">
              <Link
                href={`/franchize/${resolvedSlug}`}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--franchize-shell-accent)] bg-[var(--franchize-shell-accent)] px-4 py-3 text-center text-sm font-semibold text-[var(--franchize-shell-primary-contrast)] transition hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--franchize-shell-ring)]"
              >
                Каталог
              </Link>
              <Link href={`/franchize/${resolvedSlug}/sales`} className={secondaryCtaClass}>
                Продажи / конфигуратор
              </Link>
              <Link href={`/franchize/${resolvedSlug}/contacts`} className={`${secondaryCtaClass} gap-2`}>
                <CheckCircle2 className="h-4 w-4" /> Контакты
              </Link>
            </div>
          </div>
        </section>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
