export function isMockUserModeEnabled(): boolean {
  const raw = String(process.env.NEXT_PUBLIC_MOCKUSER ?? process.env.MOCKUSER ?? "").trim().toLowerCase();
  return ["1", "true", "yes"].includes(raw);
}

