import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { CrewDiscoveryGraph } from "./CrewDiscoveryGraph";
import {
  buildCrewNetworkModel,
  crewAccentFromMetadata,
  deriveCrewServices,
  type CrewNetworkMember,
  type CrewNetworkNodeInput,
} from "../lib/crew-network";

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

export const metadata: Metadata = {
  title: "Сеть экипажей — что умеют люди рядом",
  description:
    "Все экипажи сети на одной карте: круги — экипажи, размер — люди, линии — общие люди. Услуги каждого экипажа: аренда мото, зимнее хранение.",
};

// Always render per-request: crews/_services change when the boss edits them
// and the page must show the network AS IT IS NOW (no build-time prerender,
// no stale ISR snapshot — the empty-state must never get cached either).
export const dynamic = "force-dynamic";

const CREWS_CAP = 200;
const CARS_CAP = 2000;
const STORAGE_CAP = 2000;

interface CrewRow {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  metadata: unknown;
}

interface MemberRow {
  crew_id: string;
  user_id: string;
  membership_status: string;
}

interface UserRow {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface CarRow {
  crew_id: string | null;
  is_test_result: boolean | null;
}

interface StorageRow {
  crew_slug: string | null;
  status: string | null;
}

function publicName(row: Pick<UserRow, "username" | "full_name">): string {
  const full = (row.full_name ?? "").trim();
  if (full) return full;
  const nick = (row.username ?? "").trim();
  return nick ? `@${nick.replace(/^@/, "")}` : "Райдер";
}

function initialsOf(name: string): string {
  const parts = name.replace(/^@/, "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

async function loadNetworkModel() {
  const { data: crewRows } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, description, logo_url, owner_id, metadata")
    .not("slug", "is", null)
    .order("created_at", { ascending: true })
    .limit(CREWS_CAP);

  const crews = (crewRows ?? []) as CrewRow[];
  if (crews.length === 0) {
    return { nodes: [], links: [], peopleCount: 0, connectionCount: 0 };
  }

  const crewIds = crews.map((c) => c.id);
  const slugs = crews.map((c) => (c.slug ?? "").trim()).filter(Boolean);

  const [membersRes, carsRes, storageRes] = await Promise.all([
    supabaseAdmin
      .from("crew_members")
      .select("crew_id, user_id, membership_status")
      .in("crew_id", crewIds)
      .eq("membership_status", "active"),
    // fleet size per crew (catalog = the core service; test artifacts excluded)
    supabaseAdmin.from("cars").select("crew_id, is_test_result").in("crew_id", crewIds).limit(CARS_CAP),
    // bikes currently on season (storage_bikes is keyed by crew_slug)
    supabaseAdmin.from("storage_bikes").select("crew_slug, status").in("crew_slug", slugs).limit(STORAGE_CAP),
  ]);

  const memberRows = (membersRes.data ?? []) as MemberRow[];
  const carRows = (carsRes.data ?? []) as CarRow[];
  const storageRows = (storageRes.data ?? []) as StorageRow[];

  // Membership sets: owner first (the implicit one-man-crew member), then
  // active crew_members. This is the ONLY social signal we use.
  const membersByCrew = new Map<string, string[]>();
  for (const crew of crews) {
    membersByCrew.set(crew.id, crew.owner_id ? [crew.owner_id] : []);
  }
  for (const row of memberRows) {
    if (!row.user_id) continue;
    const list = membersByCrew.get(row.crew_id);
    if (!list) continue;
    if (!list.includes(row.user_id)) list.push(row.user_id);
  }

  const bikeCountByCrew = new Map<string, number>();
  for (const row of carRows) {
    if (!row.crew_id || row.is_test_result === true) continue;
    bikeCountByCrew.set(row.crew_id, (bikeCountByCrew.get(row.crew_id) ?? 0) + 1);
  }

  const storageCountBySlug = new Map<string, number>();
  for (const row of storageRows) {
    if (!row.crew_slug || row.status !== "in_storage") continue;
    storageCountBySlug.set(row.crew_slug, (storageCountBySlug.get(row.crew_slug) ?? 0) + 1);
  }

  const allUserIds = [...new Set([...membersByCrew.values()].flat())];
  const people = new Map<string, CrewNetworkMember>();
  if (allUserIds.length > 0) {
    const { data: userRows } = await supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url")
      .in("user_id", allUserIds);
    for (const row of (userRows ?? []) as UserRow[]) {
      people.set(row.user_id, {
        userId: row.user_id,
        name: publicName(row),
        avatarUrl: row.avatar_url ?? null,
      });
    }
  }

  const inputs: CrewNetworkNodeInput[] = crews.map((crew, index) => {
    const slug = (crew.slug ?? "").trim();
    return {
      crewId: crew.id,
      slug,
      name: (crew.name ?? "").trim() || slug,
      description: (crew.description ?? "").trim(),
      logoUrl: crew.logo_url ?? null,
      accent: crewAccentFromMetadata(crew.metadata, index),
      memberUserIds: membersByCrew.get(crew.id) ?? [],
      services: deriveCrewServices({
        slug,
        metadata: crew.metadata,
        bikeCount: bikeCountByCrew.get(crew.id) ?? 0,
        storageBikeCount: storageCountBySlug.get(slug) ?? 0,
      }),
    };
  });

  return buildCrewNetworkModel(inputs, people);
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

  return (
    <main
      className="min-h-screen w-full text-white"
      style={{
        background:
          "radial-gradient(1100px 700px at 50% -12%, #1c2c50 0%, #0d1526 52%, #070b16 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 md:pt-14">
        {/* ── header ─────────────────────────────────────────────────────── */}
        <header className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300/80">Сеть экипажей</p>
          <h1 className="mt-3 text-3xl font-black leading-tight md:text-4xl">Что умеют люди рядом</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            Каждый экипаж — это люди и их услуги. Круг — целый экипаж: размер круга — сколько в нём
            людей, линия между кругами — общие люди. Заходи в любой круг: аренда, зимнее хранение,
            стена и live-карта внутри.
          </p>
        </header>

        {/* ── stats chips ────────────────────────────────────────────────── */}
        {nodes.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-white/85">
              {nodes.length} {pluralCrews(nodes.length)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-white/85">
              {peopleCount} {pluralPeople(peopleCount)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-white/85">
              {connectionCount} {pluralLinks(connectionCount)}
            </span>
          </div>
        )}

        {/* ── the social graph ───────────────────────────────────────────── */}
        {nodes.length > 0 ? (
          <>
            <CrewDiscoveryGraph nodes={nodes} links={links} />

            {/* ── all-crews cards (server-rendered: SEO + no-JS fallback) ── */}
            <section aria-label="Все экипажи сети" className="mt-10">
              <h2 className="text-center text-lg font-black text-white/90">Все экипажи сети</h2>
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
            </section>
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
          Круг — экипаж · размер — люди · линия — общие люди между экипажами. Услуги читаются из
          настроек экипажей: каталог и «Зимнее хранение».{" "}
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

function pluralCrews(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "экипажей";
  if (last > 1 && last < 5) return "экипажа";
  if (last === 1) return "экипаж";
  return "экипажей";
}

function pluralPeople(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "людей";
  if (last > 1 && last < 5) return "человека";
  if (last === 1) return "человек";
  return "людей";
}

function pluralLinks(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "связей";
  if (last > 1 && last < 5) return "связи";
  if (last === 1) return "связь";
  return "связей";
}
