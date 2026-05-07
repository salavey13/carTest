import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Handshake, MapPinned, ShieldCheck, UsersRound } from "lucide-react";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

const cityEvents = [
  {
    title: "Вечерний сбор новичков",
    time: "Пт • 19:30",
    place: "Старт у базы экипажа",
    text: "Короткий городской круг, проверка экипировки, объяснение жестов и правил колонны.",
  },
  {
    title: "MapRiders city loop",
    time: "Сб • 12:00",
    place: "Маршрут через набережную и тихие улицы",
    text: "Открываем live-карту, ставим meetup-пины и едем в темпе самого спокойного райдера.",
  },
  {
    title: "Техно-час перед покатушкой",
    time: "Вс • 11:00",
    place: "Партнёрская сервис-зона",
    text: "Давление, цепь, свет, тормоза и быстрый чек арендного или личного байка.",
  },
];

const partnerCards = [
  { name: "VIP BIKE сервис", role: "осмотр и подготовка", perk: "Экспресс-чек перед выездом для экипажа" },
  { name: "Кофе-точка райдеров", role: "место встречи", perk: "Тёплый старт, зарядка телефона, быстрый брифинг" },
  { name: "Экипировка рядом", role: "перчатки / дождевик / защита", perk: "Помощь новичку без лишнего пафоса" },
];

const cityTips = [
  "Не стартуй один, если это первый выезд на незнакомом байке.",
  "Включай MapRiders до старта: экипаж увидит скорость, stale-статус и точку встречи.",
  "Для новичков держим видимость «только экипаж» и автостоп геошеринга.",
  "Meetup-пин ставим long-press на карте или тапом по точке + кнопка «+».",
];


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Сообщество и поездки",
    sectionDescription: "События, партнёры и городские маршруты экипажа для совместных выездов.",
    pathSuffix: "/community",
  });
}

export default async function FranchizeCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const brandName = crew.header.brandName || crew.name || "VIP BIKE";
  const telegramHref = crew.contacts.telegram ? `https://t.me/${crew.contacts.telegram.replace("@", "")}` : "https://t.me/oneBikePlsBot";

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crewSlug}/community`} />

      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-20 text-white md:pt-24"
        style={{
          ["--community-accent" as string]: crew.theme.palette.accentMain,
          ["--community-border" as string]: crew.theme.palette.borderSoft,
          ["--community-card" as string]: surface.subtleCard.backgroundColor,
          color: crew.theme.palette.textPrimary,
        }}
      >
        <section className="overflow-hidden rounded-3xl border border-[var(--community-border)] bg-black/40 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--community-accent)]">FRZ-R9 • community hub</p>
              <h1 className="mt-4 font-orbitron text-4xl leading-tight md:text-6xl">
                Куда ехать с {brandName} прямо сейчас
              </h1>
              <p className="mt-4 max-w-2xl text-base text-white/68 md:text-lg">
                События, партнёры и понятные городские сценарии для тех, кто открыл MapRiders и спросил: «а что мне реально делать?»
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/franchize/${crewSlug}/map-riders`} className="rounded-full bg-[var(--community-accent)] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110">
                  Открыть live-карту
                </Link>
                <a href={telegramHref} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40">
                  Написать экипажу
                </a>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3 text-[var(--community-accent)]">
                <UsersRound className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.16em]">как это работает</span>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-white/70">
                <li><span className="text-white">1.</span> Проходишь быстрый quiz на MapRiders.</li>
                <li><span className="text-white">2.</span> Включаешь геошеринг с приватностью экипажа.</li>
                <li><span className="text-white">3.</span> Едешь к событию или meetup-пину без хаоса.</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {cityEvents.map((event) => (
            <article key={event.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <CalendarDays className="h-6 w-6 text-[var(--community-accent)]" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{event.time}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{event.title}</h2>
              <p className="mt-1 text-sm text-[var(--community-accent)]">{event.place}</p>
              <p className="mt-3 text-sm leading-6 text-white/62">{event.text}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-black/35 p-6">
            <div className="flex items-center gap-3 text-[var(--community-accent)]">
              <MapPinned className="h-6 w-6" />
              <h2 className="font-orbitron text-2xl text-white">Городской riding-гайд</h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm text-white/68">
              {cityTips.map((tip) => (
                <li key={tip} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--community-accent)]" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-3 text-[var(--community-accent)]">
              <Handshake className="h-6 w-6" />
              <h2 className="font-orbitron text-2xl text-white">Партнёры экипажа</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {partnerCards.map((partner) => (
                <article key={partner.name} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-white">{partner.name}</h3>
                    <span className="rounded-full border border-[var(--community-accent)]/35 bg-[var(--community-accent)]/10 px-3 py-1 text-xs text-[var(--community-accent)]">{partner.role}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/62">{partner.perk}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <CrewFooter crew={crew} />
    </main>
  );
}
