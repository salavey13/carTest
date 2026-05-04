import { supabaseAdmin } from "@/lib/supabase-server";

export async function assertCrewMembership(userId: string, crewSlug: string) {
  const { data: crew, error: crewError } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", crewSlug)
    .maybeSingle();

  if (crewError) {
    throw new Error(crewError.message);
  }

  if (!crew) {
    return false;
  }

  if (crew.owner_id === userId) {
    return true;
  }

  const { data: member, error } = await supabaseAdmin
    .from("crew_members")
    .select("id")
    .eq("user_id", userId)
    .eq("crew_id", crew.id)
    .eq("membership_status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(member);
}
