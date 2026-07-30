// app/franchize/[slug]/leads/page.tsx
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { LeadsClient } from "./components/LeadsClient";
import { AnalyticsLeadsNav } from "../../components/AnalyticsLeadsNav";

interface LeadsPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata = { title: "Клиенты и заявки" };

export default async function LeadsPage({ params }: LeadsPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);

  // SECURITY FIX (polish 2026-07-30): previously this page called
  // `getFranchizeLeads(slug)` on the server and passed the full leads + todos
  // arrays as props to LeadsClient. That meant ALL leads data was in the
  // HTML payload (visible via view-source) BEFORE the client-side password
  // gate kicked in. Anyone with the slug could read every lead's phone,
  // name, rental history, etc.
  //
  // Now we pass EMPTY arrays and let LeadsClient fetch the data via the
  // `getFranchizeLeads` server action AFTER the password gate passes.
  // This matches the pattern already used by RentalsListClient
  // (app/franchize/[slug]/rentals/RentalsListClient.tsx).
  //
  // The LeadsClient component already supports this — its useEffect that
  // reads ?leadId= from URL doesn't depend on the initial leads prop, and
  // the password gate renders before any leads UI.
  const leads: never[] = [];
  const todos: never[] = [];

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/leads`} groupLinks={[]} items={[]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--franchize-text-primary, inherit)" }}>
          Клиенты и заявки
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
          Все, кто оставил заявку, интересовался техникой или оформлял аренду
        </p>
        <AnalyticsLeadsNav slug={crew.slug || slug} />
        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Клиенты и заявки временно недоступны"
          fallbackHref={`/franchize/${crew.slug || slug}/leads`}
          fallbackLinkLabel="Перезагрузить"
        >
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
        </FranchizeErrorBoundary>
      </div>
    </main>
  );
}
