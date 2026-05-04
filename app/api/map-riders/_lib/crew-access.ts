import { supabaseAdmin } from "@/lib/supabase-server";

export async function assertCrewMembership(userId: string, crewSlug: string) {
  const { data: member, error } = await supabaseAdmin
    .from("crew_members")
    .select("id")
    .eq("user_id", userId)
    .eq("crew_slug", crewSlug)
    .eq("membership_status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (member) return true;

  const { data: ownedCrew, error: ownerError } = await supabaseAdmin
    .from("crews")
    .select("id")
    .eq("slug", crewSlug)
    .eq("owner_id", userId)
    .maybeSingle();

  if (ownerError) {
    throw new Error(ownerError.message);
  }

  return Boolean(ownedCrew);
}
