/**
 * Слаг предмета для шпаргалки.
 * task215: grade-aware — класс берём из subject.grade_level (в БД имя часто
 * просто «История» без цифры; старый код искал «8» в имени и вёл
 * 8-классников на шпаргалку 7 класса). gradeLevel опционален: без него
 * сохраняется старое поведение по имени.
 * task220: полная таблица слагов по классам (6/7/8) — БД содержит предметы
 * двух контуров: «Русский язык» 6 кл (id 34) и «Русский язык» 7 кл (id 1),
 * «Обществознание» 6/7 и т.д. Слаг строится как slug-<класс>: russian-6,
 * socialstudies-7 и т.д. Дефолт — старший класс с шпаргалкой (8/7).
 */
export function getVprSubjectSlug(subjectName?: string, gradeLevel?: number | null): string {
  const raw = (subjectName || "").trim().toLowerCase();
  if (!raw) return "general";
  const g = gradeLevel === 6 || gradeLevel === 7 || gradeLevel === 8 ? gradeLevel : null;
  // task217 FIX: ранний return `isGrade8 || raw.includes(...)` отдавал
  // probability-8 для ЛЮБОГО 8-классного предмета («Алгебра» → вероятность).
  // Матчим ИМЯ предмета; класс определяет цифру суффикса.
  if (raw.includes("вероят")) return "probability-8";
  if (raw.includes("хими")) return "chemistry-8";
  if (raw.includes("алгебр") || raw.includes("матем")) {
    if (g === 6) return "math-6";
    return g ? `algebra-${g}` : "algebra-8";
  }
  if (raw.includes("геометр")) return g ? `geometry-${g}` : "geometry-8";
  if (raw.includes("литерат")) return g ? `literature-${g}` : "literature-8";
  if (raw.includes("русский")) return g ? `russian-${g}` : "russian-8";
  if (raw.includes("обществ")) return g ? `socialstudies-${g}` : "socialstudies-7";
  if (raw.includes("англ")) return g ? `english-${g}` : "english-7";
  // task219: в 8 классе ДВЕ истории: «Всеобщая история» (1-е полугодие,
  // Новое время) и «История России» (2-е полугодие). Матчим по точному
  // вхождению: «всеобщ» важнее общего «истор».
  if (raw.includes("всеобщ") && raw.includes("истор")) return "worldhistory-8";
  if (raw.includes("истор")) return g ? `history-${g}` : "history-8";
  // точные предметы без мультикласса
  if (raw.includes("информ")) return "informatics-7";
  if (raw.includes("физ")) return "physics-7";
  if (raw.includes("географ")) return g ? `geography-${g}` : "geography-7";
  if (raw.includes("биолог")) return g ? `biology-${g}` : "biology-7";
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
    "worldhistory-8": "/vpr/worldhistory/8/cheatsheet",
    "history-8": "/vpr/history/8/cheatsheet",
    "chemistry-8": "/vpr/chemistry/8/cheatsheet",
    // 7 класс
    "informatics-7": "/vpr/informatics/7/cheatsheet",
    "physics-7": "/vpr/physics/7/cheatsheet",
    "geography-7": "/vpr/geography/7/cheatsheet",
    "biology-7": "/vpr/biology/7/cheatsheet",
    "algebra-7": "/vpr/algebra/7/cheatsheet",
    "history-7": "/vpr/history/7/cheatsheet",
    "english-7": "/vpr/english/7/cheatsheet",
    "russian-7": "/vpr/russian/7/cheatsheet",
    "literature-7": "/vpr/literature/7/cheatsheet",
    "socialstudies-7": "/vpr/socialstudies/7/cheatsheet",
    // 6 класс (task220)
    "math-6": "/vpr/math/6/cheatsheet",
    "russian-6": "/vpr/russian/6/cheatsheet",
    "history-6": "/vpr/history/6/cheatsheet",
    "geography-6": "/vpr/geography/6/cheatsheet",
    "biology-6": "/vpr/biology/6/cheatsheet",
    "socialstudies-6": "/vpr/socialstudies/6/cheatsheet",
    "english-6": "/vpr/english/6/cheatsheet",
    general: "/vpr-tests",
  };
  return map[subjectSlug] ?? "/vpr-tests";
}
