"use server";

import { supabaseAdmin } from "@/hooks/supabase";

export type SourceHint = {
  book?: string;
  page?: string;
  exercise?: string;
  chunkLabel?: string;
};

export type HomeworkSolutionView = {
  jobId: string;
  topic: string;
  given: string;
  steps: string[];
  answer: string;
  fullSolutionRich: string;
  rewriteForNotebook?: string;
  sourceHints: SourceHint[];
};

type UnknownRow = Record<string, unknown>;

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean) as string[];
  }

  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
};

const buildFullSolutionRich = (input: {
  given?: string;
  steps: string[];
  answer?: string;
  sourceHints?: SourceHint[];
}) => {
  const stepsBlock = input.steps.length
    ? input.steps.map((step, index) => `${index + 1}) ${step}`).join("\n")
    : "1) Шаги решения будут добавлены после обработки.";

  const sourceBlock = (input.sourceHints ?? []).length
    ? (input.sourceHints ?? [])
        .map((hint, index) => {
          const bits = [hint.book ?? "книга", hint.page ? `стр. ${hint.page}` : null, hint.exercise ? `упр. ${hint.exercise}` : null]
            .filter(Boolean)
            .join(" · ");
          return `[${index + 1}] ${bits}`;
        })
        .join("\n")
    : "Источник не указан.";

  return [
    "## Что дано",
    input.given ?? "Условие задачи не передано.",
    "",
    "## Решение по шагам",
    stepsBlock,
    "",
    "## Ответ",
    input.answer ?? "Ответ формируется.",
    "",
    "## Проверка и источник",
    sourceBlock,
  ].join("\n");
};

const parseSourceHints = (job: UnknownRow, chunks: UnknownRow[]): SourceHint[] => {
  const directHints = job.source_hints;
  const normalizedDirect = Array.isArray(directHints)
    ? directHints
        .map((hint) => {
          if (!hint || typeof hint !== "object") return null;
          const row = hint as UnknownRow;
          return {
            book: asString(row.book) ?? asString(row.book_title) ?? asString(row.source),
            page: asString(row.page) ?? asString(row.page_number),
            exercise: asString(row.exercise) ?? asString(row.exercise_number),
            chunkLabel: asString(row.chunk_label) ?? asString(row.chunk_id),
          };
        })
        .filter(Boolean) as SourceHint[]
    : [];

  const fromChunks = chunks
    .map((chunk) => ({
      book: asString(chunk.book) ?? asString(chunk.book_title) ?? asString(chunk.source_book),
      page: asString(chunk.page) ?? asString(chunk.page_number) ?? asString(chunk.source_page),
      exercise:
        asString(chunk.exercise) ?? asString(chunk.exercise_number) ?? asString(chunk.source_exercise),
      chunkLabel:
        asString(chunk.chunk_label) ?? asString(chunk.chunk_id) ?? asString(chunk.id),
    }))
    .filter((hint) => hint.book || hint.page || hint.exercise || hint.chunkLabel);

  const fallbackFromJob = {
    book: asString(job.book) ?? asString(job.book_title) ?? asString(job.source_book),
    page: asString(job.page) ?? asString(job.page_number) ?? asString(job.source_page),
    exercise:
      asString(job.exercise) ?? asString(job.exercise_number) ?? asString(job.source_exercise),
    chunkLabel: undefined,
  };

  const merged = [...normalizedDirect, ...fromChunks];
  if (merged.length === 0 && (fallbackFromJob.book || fallbackFromJob.page || fallbackFromJob.exercise)) {
    merged.push(fallbackFromJob);
  }

  return merged;
};

const makeView = (raw: {
  jobId: string;
  topic?: string;
  given?: string;
  steps?: string[];
  answer?: string;
  fullSolutionRich?: string;
  rewriteForNotebook?: string;
  sourceHints?: SourceHint[];
}): HomeworkSolutionView => {
  const steps = raw.steps && raw.steps.length > 0 ? raw.steps : ["Шаги решения пока не заполнены."];
  const sourceHints = raw.sourceHints ?? [];

  const fullSolutionRich =
    raw.fullSolutionRich ??
    buildFullSolutionRich({
      given: raw.given,
      steps,
      answer: raw.answer,
      sourceHints,
    });

  return {
    jobId: raw.jobId,
    topic: raw.topic ?? "Разбор задания",
    given: raw.given ?? "Данные не указаны.",
    steps,
    answer: raw.answer ?? "Ответ появится после генерации.",
    fullSolutionRich,
    rewriteForNotebook: raw.rewriteForNotebook,
    sourceHints,
  };
};

const LOCAL_FALLBACK_SOLUTIONS: Record<string, HomeworkSolutionView> = {
  "13-02-final": makeView({
    jobId: "13-02-final",
    topic: "Алгебра 7 класс: степень с натуральным показателем (№444, №451)",
    given: "ДЗ из скрина: выучить пункт 20, решить №444 и №451.",
    steps: [
      "Пункт 20: используем свойства (ab)^n = a^n b^n и (a^m)^n = a^(mn), а также правило знака: четная степень убирает минус, нечетная сохраняет.",
      "№444: поочередно возводим в степень каждый множитель и числовой коэффициент: а) (mn)^5 = m^5n^5; б) (xyz)^2 = x^2y^2z^2; в) (-3y)^4 = 81y^4; г) (-2ax)^3 = -8a^3x^3; д) (10xy)^2 = 100x^2y^2; е) (-2abx)^4 = 16a^4b^4x^4; ж) (-am)^3 = -a^3m^3; з) (-xn)^4 = x^4n^4.",
      "№451: представляем произведение как степень: а) b^3x^3=(bx)^3; б) a^7y^7=(ay)^7; в) x^2y^2z^2=(xyz)^2; г) (-a)^3b^3=(-ab)^3; д) 2^5a^5=(2a)^5; е) 0,027m^3=(0,3m)^3.",
      "Проверка: свойства степеней применены корректно, знаки и показатели сохранены, полученные выражения эквивалентны исходным.",
    ],
    answer:
      "№444: а) m^5n^5; б) x^2y^2z^2; в) 81y^4; г) -8a^3x^3; д) 100x^2y^2; е) 16a^4b^4x^4; ж) -a^3m^3; з) x^4n^4. №451: а) (bx)^3; б) (ay)^7; в) (xyz)^2; г) (-ab)^3; д) (2a)^5; е) (0,3m)^3.",
    rewriteForNotebook:
      "Что дано: №444 и №451 (тема степеней). Решение: применили (ab)^n=a^n*b^n и (a^m)^n=a^(mn), учли знак при четной/нечетной степени. Ответ: записан по пунктам для №444 и №451.",
    sourceHints: [
      { book: "alg.pdf", page: "107", exercise: "444", chunkLabel: "near-ex-444" },
      { book: "alg.pdf", page: "108", exercise: "451", chunkLabel: "near-ex-451" },
    ],
    fullSolutionRich: [
      "## Что дано",
      "Нужно выучить пункт 20 по теме степеней и решить упражнения №444 и №451.",
      "",
      "## Решение №444",
      "а) (mn)^5 = m^5n^5",
      "б) (xyz)^2 = x^2y^2z^2",
      "в) (-3y)^4 = 81y^4",
      "г) (-2ax)^3 = -8a^3x^3",
      "д) (10xy)^2 = 100x^2y^2",
      "е) (-2abx)^4 = 16a^4b^4x^4",
      "ж) (-am)^3 = -a^3m^3",
      "з) (-xn)^4 = x^4n^4",
      "",
      "## Решение №451",
      "а) b^3x^3 = (bx)^3",
      "б) a^7y^7 = (ay)^7",
      "в) x^2y^2z^2 = (xyz)^2",
      "г) (-a)^3b^3 = (-ab)^3",
      "д) 2^5a^5 = (2a)^5",
      "е) 0,027m^3 = (0,3m)^3",
      "",
      "## Ответ",
      "Все пункты №444 и №451 решены полностью, итоговые выражения приведены в блоке «Ответ».",
    ].join("\n"),
  }),
};

const toHomeworkSolutionView = (row: UnknownRow, fallbackJobId?: string): HomeworkSolutionView => {
  const sourceHints = Array.isArray(row.source_hints)
    ? ((row.source_hints as unknown[])
        .map((hint) => {
          if (!hint || typeof hint !== "object") return null;
          const parsed = hint as UnknownRow;
          return {
            book: asString(parsed.book),
            page: asString(parsed.page),
            exercise: asString(parsed.exercise),
            chunkLabel: asString(parsed.chunkLabel) ?? asString(parsed.chunk_label),
          };
        })
        .filter(Boolean) as SourceHint[])
    : [];

  const steps = [
    ...toStringArray(row.solution_steps),
    ...toStringArray(row.step_by_step_solution),
    ...toStringArray(row.steps),
    ...toStringArray(row.generated_solution_text),
    ...toStringArray(row.solution_text),
    ...toStringArray(row.generated_text),
  ];

  return makeView({
    jobId:
      asString(row.solution_key) ??
      asString(row.job_id) ??
      asString(row.id) ??
      fallbackJobId ??
      "homework-solution",
    topic: asString(row.topic) ?? asString(row.short_topic) ?? asString(row.theme),
    given: asString(row.given) ?? asString(row.problem_statement) ?? asString(row.task_text),
    steps,
    answer: asString(row.answer) ?? asString(row.final_answer) ?? asString(row.result),
    fullSolutionRich:
      asString(row.solution_markdown) ??
      asString(row.full_solution_rich) ??
      asString(row.full_solution) ??
      asString(row.solution_rich_text),
    rewriteForNotebook:
      asString(row.rewrite_for_notebook) ??
      asString(row.notebook_text) ??
      asString(row.copybook_version),
    sourceHints,
  });
};

async function fetchStoredSolution(jobId: string): Promise<HomeworkSolutionView | null> {
  try {
    const byKey = await supabaseAdmin
      .from("homework_daily_solutions")
      .select("*")
      .eq("solution_key", jobId)
      .order("homework_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byKey.error && byKey.data) {
      return toHomeworkSolutionView(byKey.data as UnknownRow, jobId);
    }

    const today = await supabaseAdmin
      .from("homework_daily_solutions")
      .select("*")
      .eq("homework_date", new Date().toISOString().slice(0, 10))
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!today.error && today.data) {
      return toHomeworkSolutionView(today.data as UnknownRow, jobId);
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchRelatedChunks(jobId: string): Promise<UnknownRow[]> {
  const candidates = [
    { table: "homework_job_chunks", column: "job_id" },
    { table: "homework_retrieved_chunks", column: "job_id" },
  ] as const;

  for (const candidate of candidates) {
    const { data, error } = await supabaseAdmin
      .from(candidate.table)
      .select("*")
      .eq(candidate.column, jobId);

    if (!error && data && data.length > 0) {
      return data as UnknownRow[];
    }
  }

  return [];
}

export async function hydrateHomeworkSolution(jobId: string): Promise<HomeworkSolutionView | null> {
  if (!jobId) return null;

  const stored = await fetchStoredSolution(jobId);
  if (stored) return stored;

  const localFallback = LOCAL_FALLBACK_SOLUTIONS[jobId];
  if (localFallback) return localFallback;

  const { data: job, error } = await supabaseAdmin
    .from("homework_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return null;
  }

  const chunks = await fetchRelatedChunks(jobId);
  const row = job as UnknownRow;
  const sourceHints = parseSourceHints(row, chunks);

  return makeView({
    jobId,
    topic: asString(row.topic) ?? asString(row.short_topic) ?? asString(row.theme),
    given: asString(row.given) ?? asString(row.problem_statement) ?? asString(row.task_text),
    steps: [
      ...toStringArray(row.solution_steps),
      ...toStringArray(row.step_by_step_solution),
      ...toStringArray(row.generated_solution_text),
      ...toStringArray(row.solution_text),
      ...toStringArray(row.generated_text),
    ],
    answer: asString(row.answer) ?? asString(row.final_answer) ?? asString(row.result),
    fullSolutionRich:
      asString(row.solution_markdown) ??
      asString(row.full_solution_rich) ??
      asString(row.full_solution) ??
      asString(row.solution_rich_text),
    rewriteForNotebook:
      asString(row.rewrite_for_notebook) ??
      asString(row.notebook_text) ??
      asString(row.copybook_version),
    sourceHints,
  });
}
