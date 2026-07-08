// app/franchize/[slug]/leads/page.tsx
import { CrewHeader } from "../../components/CrewHeader";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import { LeadsClient } from "./LeadsClient";

interface LeadsPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata = { title: "Клиенты и заявки" };

export default async function LeadsPage({ params }: LeadsPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);
  const crewId = crew.id;

  type LeadRow = {
    user_id: string;
    full_name: string | null;
    username: string | null;
    phone: string | null;
    source: string;
    bikeTitle: string | null;
    createdAt: string | null;
    verified: boolean;
    intentType?: string | null;
    intentStage?: string | null;
    urgencyScore?: number | null;
    telegramChatId?: string | null;
  };

  const leads: LeadRow[] = [];
  const addLead = (row: LeadRow) => {
    const existing = leads.find((l) => l.user_id === row.user_id);
    if (existing) {
      if (row.verified) existing.verified = true;
      if (row.intentType && !existing.intentType) existing.intentType = row.intentType;
      if (row.intentStage && !existing.intentStage) existing.intentStage = row.intentStage;
      if (row.urgencyScore && !existing.urgencyScore) existing.urgencyScore = row.urgencyScore;
      if (row.createdAt && (!existing.createdAt || row.createdAt > existing.createdAt)) {
        existing.createdAt = row.createdAt;
      }
      return;
    }
    leads.push(row);
  };

  // 1. Callback leads + contract leads from public.users (exclude dismissed)
  const { data: usersLeads } = await supabaseAdmin
    .from("users")
    .select("user_id, full_name, username, metadata, created_at")
    .in("metadata->>source", ["web_callback", "rental_contract", "sale_contract", "test_drive"])
    .neq("metadata->>is_dismissed_lead", "true")
    .order("created_at", { ascending: false })
    .limit(200);

  if (usersLeads) {
    for (const u of usersLeads) {
      addLead({
        user_id: u.user_id,
        full_name: u.full_name,
        username: u.username,
        phone: u.metadata?.phone || u.user_id,
        source: u.metadata?.source || "unknown",
        bikeTitle: u.metadata?.bikeTitle || null,
        createdAt: u.created_at,
        verified: u.metadata?.source === "rental_contract" || u.metadata?.source === "sale_contract" || u.metadata?.source === "test_drive",
        telegramChatId: u.user_id,
      });
    }
  }

  // 2. Dashboard intents (exclude dismissed)
  const { data: intentLeads } = await supabaseAdmin
    .from("franchize_intents")
    .select("telegram_user_id, intent_type, stage, urgency_score, created_at, metadata")
    .eq("slug", slug)
    .neq("stage", "dismissed")
    .not("telegram_user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (intentLeads) {
    for (const i of intentLeads) {
      if (!i.telegram_user_id) continue;
      addLead({
        user_id: i.telegram_user_id,
        full_name: i.metadata?.name || null,
        username: null,
        phone: i.metadata?.phone || null,
        source: "dashboard_intent",
        bikeTitle: null,
        createdAt: i.created_at,
        verified: i.intent_type === "rental_contract" || i.intent_type === "sale_contract" || i.intent_type === "test_drive",
        intentType: i.intent_type,
        intentStage: i.stage,
        urgencyScore: i.urgency_score,
        telegramChatId: i.telegram_user_id,
      });
    }
  }

  // 3. Contract artifacts (verified renters)
  const { data: artifactUsers } = await privateSchema()
    .from("rental_contract_artifacts")
    .select("telegram_chat_id, renter_full_name, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (artifactUsers) {
    for (const a of artifactUsers) {
      if (!a.telegram_chat_id) continue;
      addLead({
        user_id: a.telegram_chat_id,
        full_name: a.renter_full_name,
        username: null,
        phone: /^\+?\d{10,}$/.test(a.telegram_chat_id) ? a.telegram_chat_id : null,
        source: "rental_contract",
        bikeTitle: null,
        createdAt: a.created_at,
        verified: true,
        telegramChatId: a.telegram_chat_id,
      });
    }
  }

  // 4. Rental secrets
  const { data: secretUsers } = await privateSchema()
    .from("user_rental_secrets")
    .select("chat_id, renter_full_name, renter_phone, verification_status, source_doc_key, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (secretUsers) {
    for (const s of secretUsers) {
      if (!s.chat_id) continue;
      addLead({
        user_id: s.chat_id,
        full_name: s.renter_full_name,
        username: null,
        phone: s.renter_phone || null,
        source: s.source_doc_key === "profile_prefill" ? "profile_prefill" : "rental_secret",
        bikeTitle: null,
        createdAt: s.created_at,
        verified: s.verification_status === "verified",
        telegramChatId: s.chat_id,
      });
    }
  }

  // 5. Fetch all lead-linked todos for this crew
  const { data: todos } = await supabaseAdmin
    .from("crew_todos")
    .select("id, title, description, status, priority, category, created_at, completed_at, assigned_to")
    .eq("crew_id", crewId)
    .eq("category", "lead_followup")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/leads`} groupLinks={[]} items={[]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--franchize-text-primary, inherit)" }}>
          Клиенты и заявки
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
          Все, кто оставил заявку, интересовался техникой или оформлял аренду
        </p>
        <LeadsClient
          leads={leads}
          todos={todos || []}
          accentColor={crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain}
          textColor={crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary}
          bgColor={crew.theme.isAuto ? "var(--franchize-bg-base)" : crew.theme.palette.bgBase}
          isLightTheme={crew.theme.mode === "light" && !crew.theme.isAuto}
          isAuto={crew.theme.isAuto || false}
          crewId={crewId}
          slug={slug}
        />
      </div>
    </main>
  );
}
