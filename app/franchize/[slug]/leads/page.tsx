// /app/franchize/[slug]/leads/page.tsx
// app/franchize/[slug]/leads/page.tsx
import { CrewHeader } from "../../components/CrewHeader";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { LeadsClient } from "./LeadsClient";
import { AnalyticsLeadsNav } from "../../components/AnalyticsLeadsNav";
import { AchievementExplorer } from "../../components/AchievementExplorer";

interface LeadsPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata = { title: "Клиенты и заявки" };

export default async function LeadsPage({ params }: LeadsPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);

  // SECURITY FIX: pass EMPTY arrays — LeadsClient fetches data client-side
  // AFTER the password/auth gate passes. Previously this page called
  // getFranchizeLeads(slug) on the server and passed the full leads + todos
  // arrays as props — which meant ALL leads data was in the HTML payload
  // (visible via view-source) BEFORE the client-side password gate kicked in.
  //
  // Also: importing getFranchizeLeads here (even in a Server Component) was
  // leaking the server-only import chain into the client page chunk, causing
  // "Cannot access 'eX' before initialization" runtime crash.
  const leads: never[] = [];
  const todos: never[] = [];

  return (
    <main className="min-h-screen" style={surface.page}>
      <AchievementExplorer slug={crew.slug || slug} achievementId="explorer_leads" />
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/leads`} groupLinks={[]} items={[]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-6">
        {/* СПА-ССЫЛКА НА ПЛЕЙБУК-ГАЙД прямо в шапке лидов: полный SOP
            (/docs/avito-leads-guide.html, self-contained, офлайн) доступен
            одним тапом с любого места страницы — раньше ссылка жила только
            в футере панели плейбука. Для новичков ниже — обзор-тур (кнопка «?»). */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "var(--franchize-text-primary, inherit)" }}>
              Клиенты и заявки
            </h1>
            <p className="mt-1 text-[13px] sm:text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
              Все, кто оставил заявку, интересовался техникой или оформлял аренду
            </p>
          </div>
          <a
            href="/docs/avito-leads-guide.html"
            target="_blank"
            rel="noreferrer noopener"
            title="Полный гайд по работе с лидами: очередь плейбука, правила ответов, шаблоны сообщений"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:brightness-110"
            style={{ borderColor: "var(--franchize-border, rgba(148,163,184,0.35))", color: "var(--franchize-text-primary, inherit)" }}
          >
            <span aria-hidden>📘</span>
            <span className="hidden sm:inline">Гайд по лидам</span>
            <span className="sm:hidden">Гайд</span>
          </a>
        </div>
        <AnalyticsLeadsNav slug={crew.slug || slug} />
        <LeadsClient
          leads={leads}
          todos={todos}
          accentColor={crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain}
          textColor={crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary}
          bgColor={crew.theme.isAuto ? "var(--franchize-bg-base)" : crew.theme.palette.bgBase}
          isLightTheme={crew.theme.mode === "light" && !crew.theme.isAuto}
          isAuto={crew.theme.isAuto || false}
          crewId={crew.id}
          slug={slug}
        />
      </div>
    </main>
  );
}
