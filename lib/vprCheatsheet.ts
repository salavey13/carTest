export function getVprSubjectSlug(subjectName?: string): string {
  const raw = (subjectName || "").trim().toLowerCase();
  if (!raw) return "general";
  // 8 класс (task212): предмет дорожки 8-го класса
  if (raw.includes("вероят")) return "probability-8";
  if (raw.includes("алгебр")) return "algebra-8";
  if (raw.includes("геометр")) return "geometry-8";
  if (raw.includes("литерат")) return "literature-8";
  if (raw.includes("русский")) return "russian-8";
  if (raw.includes("истор")) return raw.includes("8") ? "history-8" : "history-7";
  // 7 класс и прочее
  if (raw.includes("информ")) return "informatics-7";
  if (raw.includes("физ")) return "physics-7";
  if (raw.includes("географ")) return "geography-7";
  if (raw.includes("биолог")) return "biology-7";
  if (raw.includes("матем")) return "algebra-7";
  if (raw.includes("англ")) return "english-7";
  return "general";
}

export function getVprCheatsheetHref(subjectSlug: string): string {
  const map: Record<string, string> = {
    // 8 класс
    "probability-8": "/vpr/probability/8/cheatsheet",
    "algebra-8": "/vpr/algebra/8/cheatsheet",
    "geometry-8": "/vpr/geometry/8/cheatsheet",
    "literature-8": "/vpr/literature/8/cheatsheet",
    "russian-8": "/vpr/russian/8/cheatsheet",
    "history-8": "/vpr/history/8/cheatsheet",
    // 7 класс
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
