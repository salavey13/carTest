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

  const generatedText =
    asString(row.generated_solution_text) ?? asString(row.solution_text) ?? asString(row.generated_text);

  const steps = [
    ...toStringArray(row.solution_steps),
    ...toStringArray(row.step_by_step_solution),
    ...(generatedText ? toStringArray(generatedText) : []),
  ];

  return {
    jobId,
    topic:
      asString(row.topic) ??
      asString(row.short_topic) ??
      asString(row.theme) ??
      "Разбор задания",
    given:
      asString(row.given) ?? asString(row.problem_statement) ?? asString(row.task_text) ?? "Данные не указаны.",
    steps: steps.length > 0 ? steps : ["Шаги решения пока не заполнены."],
    answer:
      asString(row.answer) ??
      asString(row.final_answer) ??
      asString(row.result) ??
      "Ответ появится после генерации.",
    rewriteForNotebook:
      asString(row.rewrite_for_notebook) ??
      asString(row.notebook_text) ??
      asString(row.copybook_version),
    sourceHints: parseSourceHints(row, chunks),
  };
}
