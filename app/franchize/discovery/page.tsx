import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Bike, ChevronDown, Handshake, Info, MapPin, MessagesSquare, Snowflake, Sparkles, Trophy, Users } from "lucide-react";
import { logger } from "@/lib/logger";
import { CrewDiscoveryGraph } from "./CrewDiscoveryGraph";
import { loadNetworkModel } from "./load-network-model";

// app/franchize/discovery/page.tsx — GLOBAL crew discovery (2026-10-01).
//
// The brainstorm concluded: the rider-page backward link is distribution, the
// real value is the FORWARD path — «I need winter storage» → WHO offers it?
// This page is that global surface: every crew of the network as a beautiful
// circle, sized by its people, connected to other crews through SHARED PEOPLE
// (crew_members only — the «no additional inputs» constraint).
//
// Everything on this page is derived from existing tables: crews, crew_members
// (active), users (public name/avatar), cars (fleet size), storage_bikes
// (in_storage count). No new tables, no migrations, no new user inputs at all.
//
// WIKI-DIVE ROUND (boss 2026-10-04: «more informative, more howtos and
// useful links, fullwidth circle area on mobile, less scrolling — make it
// interesting to explore, like a fucking wikipedia dive»):
//   · the header shrinks to one line and the stats chips move INTO the
//     canvas (overlay pills) — the circle area owns the first screen;
//   · a «Как это работает» strip of six howto cards (horizontal snap-scroll
//     on a phone — vertical scroll stays flat) — each card answers one real
//     question and carries a CTA deep-link into the actual surface;
//   · a «Полезные ссылки» grid maps every key destination of the network
//     (catalog / storage / live map / wall / leaderboard / about / market /
//     create-crew), anchored on the flagship crew (most people);
//   · the dive itself lives in the graph: legend card inside the canvas +
//     tappable «Рукопожатия» chips in the crew panel (see CrewDiscoveryGraph).

export const metadata: Metadata = {
  title: "Сеть экипажей — что умеют люди рядом",
  description:
    "Все экипажи сети на одной карте: круги — экипажи, размер — люди, линии — общие люди. Услуги каждого экипажа: аренда мото, зимнее хранение. Как арендовать, как сдать байк на зимовку, как создать свой экипаж.",
};

// Always render per-request: crews/_services change when the boss edits them
// and the page must show the network AS IT IS NOW (no build-time prerender,
// no stale ISR snapshot — the empty-state must never get cached either).
export const dynamic = "force-dynamic";

function initialsOf(name: string): string {
  const parts = name.replace(/^@/, "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function CrewDiscoveryPage() {
  let model: Awaited<ReturnType<typeof loadNetworkModel>>;
  try {
    model = await loadNetworkModel();
  } catch (error) {
    logger.warn("[crew-discovery] network load failed:", error);
    model = { nodes: [], links: [], peopleCount: 0, connectionCount: 0 };
  }

  const { nodes, links, peopleCount, connectionCount } = model;

  // The flagship crew anchors the howtos/links: most people wins, ties keep
  // the oldest (nodes arrive ordered by created_at from the loader).
  const flagship = nodes.reduce<typeof nodes[number] | null>(
    (best, node) => (best === null || node.memberCount > best.memberCount ? node : best),
    null,
  );
  // First crew that actually runs the storage service — its /storage is the howto target.
  const storageCrew =
    nodes.find((node) => node.services.some((service) => service.key === "storage")) ?? flagship;
  const slugOf = (node: typeof flagship) => node?.slug || "";

  return (
    <main
      className="min-h-screen w-full text-white"
      style={{
        background:
          "radial-gradient(1100px 700px at 50% -12%, #1c2c50 0%, #0d1526 52%, #070b16 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-3 pb-16 pt-7 sm:px-4 md:pt-14">
        {/* ── header — one line, the graph owns the first screen ─────────── */}
        <header className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300/80">Сеть экипажей</p>
          <h1 className="mt-2 text-3xl font-black leading-tight md:text-4xl">Что умеют люди рядом</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            Круг — экипаж, размер — люди, линия — общие люди. Тапай, тащи, ныряй по рукопожатиям —{" "}
            <a href="#howto" className="underline decoration-sky-300/40 underline-offset-2 hover:text-white">
              как всё это работает
            </a>
            .
          </p>
        </header>

        {/* ── the social graph (stats live inside the canvas overlay) ────── */}
        {nodes.length > 0 ? (
          <>
            <CrewDiscoveryGraph
              nodes={nodes}
              links={links}
              peopleCount={peopleCount}
              connectionCount={connectionCount}
            />

            {/* ── howto strip — the wikipedia dive starts here ────────────────
                horizontal snap-scroll on phones (one swipe-row, no vertical
                bloat), a comfortable 3-col grid from sm up. Every card is a
                real answer + a real deep-link into the product. */}
            <section id="howto" aria-label="Как это работает" className="mt-8 scroll-mt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-black text-white/90">Как это работает</h2>
                <p className="text-[11px] font-semibold text-white/40 sm:hidden">листай вбок →</p>
              </div>
              <div className="-mx-3 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                <HowtoCard
                  icon={<Bike className="h-5 w-5" aria-hidden />}
                  accent="#7dd3fc"
                  title="Арендовать мото"
                  body="Открой каталог экипажа, выбери байк и даты, добавь шлем и экипировку в корзину — договор, депозит и напоминания бот оформит сам."
                  ctaLabel={flagship ? `Каталог · ${flagship.name}` : "Каталог экипажа"}
                  ctaHref={flagship ? `/franchize/${slugOf(flagship)}` : "/franchize/create"}
                />
                <HowtoCard
                  icon={<Snowflake className="h-5 w-5" aria-hidden />}
                  accent="#93c5fd"
                  title="Сдать байк на зимовку"
                  body="Экипажи со снежинкой принимают мото на сезон: тёплый бокс, обслуживание, фотоотчёты — весной байк ждёт тебя в полной готовности."
                  ctaLabel={storageCrew ? `Хранение · ${storageCrew.name}` : "Найти экипаж"}
                  ctaHref={storageCrew ? `/franchize/${slugOf(storageCrew)}/storage` : "/franchize/create"}
                />
                <HowtoCard
                  icon={<Sparkles className="h-5 w-5" aria-hidden />}
                  accent="#fbbf24"
                  title="Создать свой экипаж"
                  body="Название, пара строк о себе, первый байк — и твой круг появится в этой сети. Люди находят экипажи через общих друзей."
                  ctaLabel="Создать экипаж"
                  ctaHref="/franchize/create"
                />
                <HowtoCard
                  icon={<MapPin className="h-5 w-5" aria-hidden />}
                  accent="#f472b6"
                  title="Попасть на Live-карту"
                  body="Включи трансляцию в профиле экипажа — твоя точка появится на карте райдеров. Ищи, кто рядом, догоняй своих, открывай новые экипажи."
                  ctaLabel={flagship ? "Live-карта райдеров" : "Карта"}
                  ctaHref={flagship ? `/franchize/${slugOf(flagship)}/map-riders` : "/franchize/create"}
                />
                <HowtoCard
                  icon={<Handshake className="h-5 w-5" aria-hidden />}
                  accent="#a78bfa"
                  title="Рукопожатия и круги"
                  body="Линия — общие люди. Тапни по кругу: сеть перестроится кольцами «шагов» от него. Прыгай по чипам «Рукопожатия» в карточке — так находят друг друга всей сетью."
                  ctaLabel="Все экипажи сети"
                  ctaHref="#all-crews"
                />
                <HowtoCard
                  icon={<Trophy className="h-5 w-5" aria-hidden />}
                  accent="#4ade80"
                  title="Стена и рейтинг"
                  body="Знакомься в Стене сообщества, следи за рейтингом райдеров и поездками. Лучшая реклама экипажа — живая стена и люди на карте."
                  ctaLabel={flagship ? `Стена · ${flagship.name}` : "Стена сообщества"}
                  ctaHref={flagship ? `/franchize/${slugOf(flagship)}/community` : "/franchize/create"}
                />
              </div>
            </section>

            {/* ── useful links — every key destination, two taps deep max ──── */}
            {flagship && (
              <section aria-label="Полезные ссылки" className="mt-7">
                <h2 className="text-lg font-black text-white/90">Полезные ссылки</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <QuickLink href={`/franchize/${slugOf(flagship)}`} icon={<Bike className="h-4 w-4" aria-hidden />} label="Каталог мото" sub={flagship.name} />
                  {storageCrew && (
                    <QuickLink href={`/franchize/${slugOf(storageCrew)}/storage`} icon={<Snowflake className="h-4 w-4" aria-hidden />} label="Зимнее хранение" sub={storageCrew.name} />
                  )}
                  <QuickLink href={`/franchize/${slugOf(flagship)}/map-riders`} icon={<MapPin className="h-4 w-4" aria-hidden />} label="Live-карта" sub="кто где прямо сейчас" />
                  <QuickLink href={`/franchize/${slugOf(flagship)}/community`} icon={<MessagesSquare className="h-4 w-4" aria-hidden />} label="Стена" sub={flagship.name} />
                  <QuickLink href={`/franchize/${slugOf(flagship)}/leaderboard`} icon={<Trophy className="h-4 w-4" aria-hidden />} label="Рейтинг райдеров" sub="кто в топе" />
                  <QuickLink href={`/franchize/${slugOf(flagship)}/about`} icon={<Info className="h-4 w-4" aria-hidden />} label="Об экипаже" sub={flagship.name} />
                  <QuickLink href={`/franchize/create`} icon={<Sparkles className="h-4 w-4" aria-hidden />} label="Создать экипаж" sub="за пару минут" />
                  <QuickLink href="#all-crews" icon={<Users className="h-4 w-4" aria-hidden />} label="Все экипажи" sub={`${nodes.length} в сети`} />
                </div>
              </section>
            )}

            {/* ── all-crews cards — collapsible (SEO + no-JS keep the content,
                the folded summary keeps the page calm) ── */}
            <details id="all-crews" className="group mt-8 scroll-mt-4" aria-label="Все экипажи сети">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-2 [&::-webkit-details-marker]:hidden">
                <h2 className="text-lg font-black text-white/90">Все экипажи сети · {nodes.length}</h2>
                <ChevronDown className="h-5 w-5 text-white/50 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {nodes.map((node) => (
                  <article
                    key={node.crewId}
                    className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm transition hover:border-white/25"
                  >
                    <div className="flex items-center gap-3">
                      {node.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={node.logoUrl}
                          alt=""
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded-full object-cover"
                          style={{ boxShadow: `0 0 0 2px ${node.accent}55` }}
                        />
                      ) : (
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-black"
                          style={{ backgroundColor: `${node.accent}26`, color: node.accent }}
                        >
                          {initialsOf(node.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold">{node.name}</h3>
                        <p className="flex items-center gap-1 text-xs text-white/60">
                          <Users className="h-3 w-3" aria-hidden /> {node.memberCount}{" "}
                          {pluralPeople(node.memberCount)}
                        </p>
                      </div>
                    </div>

                    {node.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-snug text-white/65">{node.description}</p>
                    )}

                    {node.services.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {node.services.map((service) => (
                          <Link
                            key={service.key}
                            href={service.href}
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:brightness-125"
                            style={{
                              borderColor: `${node.accent}66`,
                              color: node.accent,
                              backgroundColor: `${node.accent}14`,
                            }}
                          >
                            {service.label}
                            {service.sub && <span className="font-medium opacity-75">· {service.sub}</span>}
                          </Link>
                        ))}
                      </div>
                    )}

                    {node.members.length > 0 && (
                      <div className="mt-3 flex items-center gap-1.5">
                        {node.members.slice(0, 6).map((member) =>
                          member.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={member.userId}
                              src={member.avatarUrl}
                              alt={member.name}
                              title={member.name}
                              width={26}
                              height={26}
                              className="h-[26px] w-[26px] rounded-full border border-white/20 object-cover"
                            />
                          ) : (
                            <span
                              key={member.userId}
                              title={member.name}
                              className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] font-bold text-white/80"
                            >
                              {initialsOf(member.name)}
                            </span>
                          ),
                        )}
                        {node.memberCount > 6 && (
                          <span className="text-[11px] font-semibold text-white/55">+{node.memberCount - 6}</span>
                        )}
                      </div>
                    )}

                    <Link
                      href={`/franchize/${node.slug}`}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
                    >
                      Открыть экипаж <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </article>
                ))}
              </div>
            </details>
          </>
        ) : (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-sm">
            <div className="text-4xl" aria-hidden>
              🛰
            </div>
            <h2 className="mt-3 text-lg font-bold">В сети пока пусто</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/65">
              Как только у экипажа появятся люди и услуги — его круг появится здесь. Создай первый.
            </p>
            <Link
              href="/franchize/create"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sky-400/90 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-sky-300"
            >
              Создать экипаж <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>
        )}

        {/* ── bottom note ────────────────────────────────────────────────── */}
        <p className="mt-10 text-center text-xs leading-relaxed text-white/40">
          Круг — экипаж · размер — люди · линия — общие люди · кольца — «рукопожатия» от выбранного
          круга. Услуги читаются из настроек экипажей: каталог и «Зимнее хранение».{" "}
          <Link
            href="/franchize/create"
            className="underline decoration-white/30 underline-offset-2 hover:text-white/70"
          >
            Создать свой экипаж
          </Link>
        </p>
      </div>
    </main>
  );
}

/** One howto card of the «Как это работает» strip. */
function HowtoCard({
  icon,
  accent,
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  icon: ReactNode;
  accent: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const isAnchor = ctaHref.startsWith("#");
  const ctaClass =
    "mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-2 text-xs font-bold text-white/85 transition hover:border-white/35 hover:bg-white/[0.1]";
  return (
    <article className="flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm sm:w-auto sm:max-w-none sm:shrink">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${accent}1f`, color: accent }}
        aria-hidden
      >
        {icon}
      </div>
      <h3 className="mt-2.5 text-sm font-black">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-white/65">{body}</p>
      {isAnchor ? (
        <a href={ctaHref} className={ctaClass}>
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : (
        <Link href={ctaHref} className={ctaClass}>
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </article>
  );
}

/** One chip of the «Полезные ссылки» grid. */
function QuickLink({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  sub?: string;
}) {
  const isAnchor = href.startsWith("#");
  const chipClass =
    "flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 transition hover:border-white/30 hover:bg-white/[0.09]";
  const inner = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-sky-300" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-white/90">{label}</span>
        {sub && <span className="block truncate text-[11px] font-medium text-white/45">{sub}</span>}
      </span>
    </>
  );
  return isAnchor ? (
    <a href={href} className={chipClass}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={chipClass}>
      {inner}
    </Link>
  );
}

function pluralPeople(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "людей";
  if (last > 1 && last < 5) return "человека";
  if (last === 1) return "человек";
  return "людей";
}
