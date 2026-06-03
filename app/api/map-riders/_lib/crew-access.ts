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

  // MapRiders sharing is available to any authenticated rider.
  // Crew membership still influences visibility mode (crew/public),
  // but is no longer a hard gate for starting a session.
  return true;
}
