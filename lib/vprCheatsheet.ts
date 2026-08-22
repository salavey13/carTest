export function getVprSubjectSlug(subjectName?: string): string {
  const raw = (subjectName || "").trim().toLowerCase();
  if (!raw) return "general";
  if (raw.includes("информ")) return "informatics-7";
  if (raw.includes("физ")) return "physics-7";
  if (raw.includes("географ")) return "geography-7";
  if (raw.includes("биолог")) return "biology-7";
  if (raw.includes("матем")) return "algebra-7";
  if (raw.includes("истор")) return "history-7";
  if (raw.includes("англ")) return "english-7";
  return "general";
}

export function getVprCheatsheetHref(subjectSlug: string): string {
  const map: Record<string, string> = {
    "informatics-7": "/vpr/informatics/7/cheatsheet",
    "physics-7": "/vpr/physics/7/cheatsheet",
    "geography-7": "/vpr/geography/7/cheatsheet",
    "biology-7": "/vpr/biology/7/cheatsheet",
    "algebra-7": "/vpr/algebra/7/cheatsheet",
    "history-7": "/vpr/history/7/cheatsheet",
    "english-7": "/vpr/english/7/cheatsheet",
    general: "/vpr-tests",
  };
  return map[subjectSlug] ?? "/vpr-tests";
}
