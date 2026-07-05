// app/franchize/[slug]/leads/page.tsx
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import LeadsClient from "./LeadsClient";

interface LeadsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeadsPage({ params }: LeadsPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);

  // Fetch all leads:
  // 1. Callback leads (users with metadata.source = "web_callback")
  // 2. Users from rental_contract_artifacts
  // 3. Users from user_rental_secrets
  // 4. Users from franchize_intents (dashboard leads)

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
  };

  const leads: LeadRow[] = [];
  const seenIds = new Set<string>();

  // Helper to add or merge a lead
  const addLead = (row: LeadRow) => {
    const existing = leads.find((l) => l.user_id === row.user_id);
    if (existing) {
      // Merge: prefer verified, keep most recent date
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
    seenIds.add(row.user_id);
  };

  // 1. Callback leads from public.users
  const { data: callbackUsers } = await supabaseAdmin
    .from("users")
    .select("user_id, full_name, username, metadata, created_at")
    .filter("metadata->>source", "eq", "web_callback")
    .order("created_at", { ascending: false })
    .limit(100);

  if (callbackUsers) {
    for (const u of callbackUsers) {
      addLead({
        user_id: u.user_id,
        full_name: u.full_name,
        username: u.username,
        phone: u.metadata?.phone || u.user_id,
        source: "web_callback",
        bikeTitle: u.metadata?.bikeTitle || null,
        createdAt: u.created_at,
        verified: false,
      });
    }
  }

  // 2. Users from franchize_intents (dashboard leads)
  const { data: intentLeads } = await supabaseAdmin
    .from("franchize_intents")
    .select("telegram_user_id, intent_type, stage, urgency_score, created_at, metadata")
    .eq("slug", slug)
    .not("telegram_user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

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
        verified: false,
        intentType: i.intent_type,
        intentStage: i.stage,
        urgencyScore: i.urgency_score,
      });
    }
  }

  // 3. Users from rental_contract_artifacts (operator-created contracts)
  const { data: artifactUsers } = await privateSchema()
    .from("rental_contract_artifacts")
    .select("telegram_chat_id, renter_full_name, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (artifactUsers) {
    for (const a of artifactUsers) {
      const chatId = a.telegram_chat_id;
      if (!chatId) continue;
      addLead({
        user_id: chatId,
        full_name: a.renter_full_name,
        username: null,
        phone: chatId.startsWith("+") || /^\d{10,}$/.test(chatId) ? chatId : null,
        source: "rental_contract",
        bikeTitle: null,
        createdAt: a.created_at,
        verified: true,
      });
    }
  }

  // 4. Users from user_rental_secrets
  const { data: secretUsers } = await privateSchema()
    .from("user_rental_secrets")
    .select("chat_id, renter_full_name, renter_phone, verification_status, source_doc_key, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (secretUsers) {
    for (const s of secretUsers) {
      const chatId = s.chat_id;
      if (!chatId) continue;
      addLead({
        user_id: chatId,
        full_name: s.renter_full_name,
        username: null,
        phone: s.renter_phone || null,
        source: s.source_doc_key === "profile_prefill" ? "profile_prefill" : "rental_secret",
        bikeTitle: null,
        createdAt: s.created_at,
        verified: s.verification_status === "verified",
      });
    }
  }

  // Sort: verified first, then by date
  leads.sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/leads`} groupLinks={[]} items={[]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--franchize-text-primary, inherit)" }}>
          Клиенты и заявки
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
          Все, кто оставил заявку на сайте или оформлял аренду
        </p>
        <LeadsClient leads={leads} accentColor={crew.theme.palette.accentMain} />
      </div>
      <CrewFooter crew={crew} />
    </main>
  );
}
