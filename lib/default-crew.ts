/**
 * Default crew ID for VIP BIKE (fallback when bike.crew_id is not set)
 */
export function getDefaultCrewId(): string {
  const crewId = process.env.DEFAULT_CREW_ID;
  if (!crewId) {
    console.warn("[default-crew] DEFAULT_CREW_ID not set in .env, using hardcoded fallback");
    return "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
  }
  return crewId;
}
