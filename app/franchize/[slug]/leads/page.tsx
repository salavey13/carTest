// app/franchize/[slug]/leads/page.tsx
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { getFranchizeLeads, type LeadRow, type LeadTodoRow } from "../../server-actions/leads";
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

  const result = await getFranchizeLeads(slug);
  const leads: LeadRow[] = (result.leads || []).filter(Boolean) as LeadRow[];
  const todos: LeadTodoRow[] = (result.todos || []).filter(Boolean) as LeadTodoRow[];

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
