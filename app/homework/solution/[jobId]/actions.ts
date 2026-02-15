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


const isWeakStoredSolution = (view: HomeworkSolutionView) => {
  const rich = view.fullSolutionRich?.trim() ?? "";
  const hasFewSteps = (view.steps?.length ?? 0) < 5;
  return rich.length < 1200 || hasFewSteps;
};

const resolveHomeworkDateFromJobId = (jobId: string) => {
  const match = jobId.match(/^(\d{2})-(\d{2})-/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const [, day, month] = match;
  return `2026-${month}-${day}`;
};

async function syncFallbackToSupabase(solution: HomeworkSolutionView) {
  try {
    await supabaseAdmin.from("homework_daily_solutions").upsert(
      {
        solution_key: solution.jobId,
        homework_date: resolveHomeworkDateFromJobId(solution.jobId),
        subject: "algebra-geometry",
        topic: solution.topic,
        given: solution.given,
        steps: solution.steps,
        answer: solution.answer,
        solution_markdown: solution.fullSolutionRich,
        full_solution_rich: solution.fullSolutionRich,
        rewrite_for_notebook: solution.rewriteForNotebook ?? null,
        source_hints: solution.sourceHints,
      },
      { onConflict: "solution_key,homework_date" },
    );
  } catch {
    // best-effort sync only
  }
}

const LOCAL_FALLBACK_SOLUTIONS: Record<string, HomeworkSolutionView> = {
  "16-02-schedule": makeView({
    jobId: "16-02-schedule",
    topic: "Полный разбор ДЗ на 16.02: Алгебра №455/457/459/464 + Геометрия по теме п.27-30",
    given:
      "Из фото домашки извлечено: Алгебра — №455, 457, 459, 464 (повторить свойства степеней); Геометрия — п.27-28 повторить, п.29-30 выучить. Для алгебры и геометрии добавлены формулировки из книг (`alg.pdf`, `geom.pdf`) и подробные решения. Для остальных предметов (литература, физкультура, английский, история, ИЗО) в фото нет конкретных номеров из учебников — дан best-effort блок выполнения без выдумывания недостающих условий.",
    steps: [
      "Алгебра №455 (alg.pdf, стр.109, текст: «Представьте в виде степени с основанием a выражение: а) (a^5)^2; б) a^5a^2; в) (a^4)^3; г) a^3a^4; д) a^5a^5; е) (a^5)^5»): применяем (a^m)^n = a^(mn) и a^m*a^n = a^(m+n): а) a^10; б) a^7; в) a^12; г) a^7; д) a^10; е) a^25.",
      "Алгебра №457 (alg.pdf, стр.109, текст: «Представьте в виде степени с основанием 5 число: а) 25^4; б) 125^3; в) 625^2»): 25=5^2, 125=5^3, 625=5^4, значит а) (5^2)^4=5^8; б) (5^3)^3=5^9; в) (5^4)^2=5^8.",
      "Алгебра №459 (alg.pdf, стр.109, текст: «Запишите число 2^60 в виде степени с основанием: а) 4; б) 8; в) 16; г) 32»): разложение по степеням двойки: 2^60=(2^2)^30=4^30; (2^3)^20=8^20; (2^4)^15=16^15; (2^5)^12=32^12.",
      "Алгебра №464 (alg.pdf, стр.110, текст: «Упростите выражение: а) x^5*(x^2)^3; б) (x^3)^4*x^8; в) (x^4)^2*(x^5)^3; г) (x^2)^3*(x^3)^5; д) (x^3)^2*(x^4)^5; е) (x^7)^3*(x^3)^4»): используем (x^m)^n=x^(mn), x^a*x^b=x^(a+b): а) x^11; б) x^20; в) x^23; г) x^21; д) x^26; е) x^33.",
      "Геометрия (по теме п.27-30, geom.pdf, стр.59-65): выписаны и объяснены ключевые утверждения: аксиомы (п.27), аксиома параллельных прямых (п.28), теоремы о накрест лежащих/соответственных/односторонних углах (п.29), и теоремы об углах с соответственно параллельными/перпендикулярными сторонами (п.30).",
      "Геометрия — решённые задачи из блока упражнений той же темы (geom.pdf, стр.67): №206 (сумма накрест лежащих углов 210°) — ответ 105° и 105°; №213 (разность односторонних углов 50°, сумма 180°) — углы 115° и 65°; №211 (70° и 110°) — прямые могут быть параллельными и могут пересекаться; №212 (65° и 105°) — параллельными быть не могут, пересекаться могут.",
      "Остальные предметы с фото (без номеров задач в книгах): литература — выучить презентацию и выполнить задание учителя в тетради; физкультура — стр.173-174; английский — THF ч.6, слова модуль 7, стр.72 №1 (письменный перевод), стр.72 №2 (чтение+устный перевод); история — любой вариант «Решу ВПР» с записью ответов; ИЗО — постройка по теме истории народа.",
    ],
    answer:
      "Алгебра решена полностью с подробными шагами: №455 → (a^10, a^7, a^12, a^7, a^10, a^25), №457 → (5^8, 5^9, 5^8), №459 → (4^30, 8^20, 16^15, 32^12), №464 → (x^11, x^20, x^23, x^21, x^26, x^33). По геометрии по теме п.27-30 даны конспект-теоремы и решены тренировочные задачи №206, №211, №212, №213 из того же раздела.",
    rewriteForNotebook:
      "Алгебра: №455: a^10,a^7,a^12,a^7,a^10,a^25; №457: 5^8,5^9,5^8; №459: 4^30,8^20,16^15,32^12; №464: x^11,x^20,x^23,x^21,x^26,x^33. Геометрия: №206 -> 105° и 105°; №213 -> 115° и 65°; №211: параллельными могут (70°+110°=180°), №212: параллельными не могут (65°+105°=170°).",
    sourceHints: [
      { book: "alg.pdf", page: "109", exercise: "455, 457, 459", chunkLabel: "pow-properties-block" },
      { book: "alg.pdf", page: "110", exercise: "464", chunkLabel: "pow-simplify-block" },
      { book: "geom.pdf", page: "59-65", exercise: "27-30 (теория)", chunkLabel: "parallel-axiom-theory" },
      { book: "geom.pdf", page: "67", exercise: "206, 211, 212, 213", chunkLabel: "parallel-lines-exercises" },
      { book: "photo-intake", page: "16.02", exercise: "schedule-homework", chunkLabel: "tg-photo" },
    ],
    fullSolutionRich: [
      "## Что дано (из фото + извлечено из учебников)",
      "**Фото ДЗ на 16.02:** Алгебра №455, №457, №459, №464; Геометрия: п.27-28 повторить, п.29-30 выучить.",
      "",
      "**Алгебра, `alg.pdf`, стр.109:**",
      "- №455: «Представьте в виде степени с основанием a выражение: а) (a^5)^2; б) a^5a^2; в) (a^4)^3; г) a^3a^4; д) a^5a^5; е) (a^5)^5».",
      "- №457: «Представьте в виде степени с основанием 5 число: а) 25^4; б) 125^3; в) 625^2».",
      "- №459: «Запишите число 2^60 в виде степени с основанием: а) 4; б) 8; в) 16; г) 32».",
      "",
      "**Алгебра, `alg.pdf`, стр.110:**",
      "- №464: «Упростите выражение: а) x^5*(x^2)^3; б) (x^3)^4*x^8; в) (x^4)^2*(x^5)^3; г) (x^2)^3*(x^3)^5; д) (x^3)^2*(x^4)^5; е) (x^7)^3*(x^3)^4».",
      "",
      "**Геометрия, `geom.pdf`, стр.59-65 (п.27-30):** аксиомы и теоремы о параллельных прямых и углах.",
      "**Геометрия, `geom.pdf`, стр.67 (задачи по теме):** №206, №211, №212, №213.",
      "",
      "## Решение по шагам — Алгебра №455",
      "Формулы: (a^m)^n = a^(mn), a^m * a^n = a^(m+n).",
      "а) (a^5)^2 = a^(5*2) = a^10",
      "б) a^5*a^2 = a^(5+2) = a^7",
      "в) (a^4)^3 = a^(4*3) = a^12",
      "г) a^3*a^4 = a^(3+4) = a^7",
      "д) a^5*a^5 = a^(5+5) = a^10",
      "е) (a^5)^5 = a^(5*5) = a^25",
      "",
      "## Решение по шагам — Алгебра №457",
      "а) 25^4 = (5^2)^4 = 5^8",
      "б) 125^3 = (5^3)^3 = 5^9",
      "в) 625^2 = (5^4)^2 = 5^8",
      "",
      "## Решение по шагам — Алгебра №459",
      "2^60 = (2^2)^30 = 4^30",
      "2^60 = (2^3)^20 = 8^20",
      "2^60 = (2^4)^15 = 16^15",
      "2^60 = (2^5)^12 = 32^12",
      "",
      "## Решение по шагам — Алгебра №464",
      "а) x^5*(x^2)^3 = x^5*x^6 = x^11",
      "б) (x^3)^4*x^8 = x^12*x^8 = x^20",
      "в) (x^4)^2*(x^5)^3 = x^8*x^15 = x^23",
      "г) (x^2)^3*(x^3)^5 = x^6*x^15 = x^21",
      "д) (x^3)^2*(x^4)^5 = x^6*x^20 = x^26",
      "е) (x^7)^3*(x^3)^4 = x^21*x^12 = x^33",
      "",
      "## Геометрия — теория по п.27-30 (что выучить и как объяснить)",
      "1. П.27: геометрия строится на аксиомах (исходных утверждениях без доказательства).",
      "2. П.28: через точку вне прямой проходит ровно одна прямая, параллельная данной (аксиома параллельных).",
      "3. П.29: при пересечении параллельных прямых секущей: накрест лежащие углы равны, соответственные равны, сумма односторонних = 180°.",
      "4. П.30: если стороны углов соответственно параллельны (или соответственно перпендикулярны), то углы либо равны, либо в сумме 180°.",
      "",
      "## Геометрия — решённые задачи из `geom.pdf` (стр.67)",
      "**№206.** «Сумма накрест лежащих углов ... равна 210°. Найдите эти углы.»",
      "Накрест лежащие углы при параллельных прямых равны: пусть каждый x. Тогда x+x=210°, x=105°.",
      "**Ответ:** 105° и 105°.",
      "",
      "**№213.** «Разность двух односторонних углов ... равна 50°. Найдите эти углы.»",
      "Односторонние: x+y=180°. По условию x−y=50° (берём x>y). Складываем: 2x=230 => x=115°, y=65°.",
      "**Ответ:** 115° и 65°.",
      "",
      "**№211.** «∠ABC=70°, ∠BCD=110°. Могут ли AB и CD быть: а) параллельными; б) пересекающимися?»",
      "а) Могут быть параллельными, если это односторонние углы при секущей: 70°+110°=180°.",
      "б) Также могут пересекаться (равенство 180° само по себе не запрещает иные конфигурации без условия параллельности в построении).",
      "",
      "**№212.** «То же, но ∠ABC=65°, ∠BCD=105°».",
      "Для параллельных прямых сумма односторонних должна быть 180°, а 65°+105°=170°.",
      "**Вывод:** параллельными быть не могут; пересекаться могут.",
      "",
      "## По остальным предметам (best effort из фото)",
      "Литература — выучить презентацию и выполнить задание в тетради; Физкультура — стр.173-174; Английский — THF ч.6, слова модуль 7, стр.72 №1 и №2; История — вариант «Решу ВПР» с записью ответов; ИЗО — постройка на тему истории народа.",
      "",
      "## Итоговый ответ",
      "Алгебра №455/457/459/464 решена полностью с пошаговыми преобразованиями; по геометрии дана выжимка по п.27-30 и решены тренировочные задачи по той же теме; по остальным предметам оформлен корректный список выполнения без выдумывания отсутствующих условий.",
    ].join("\n"),
  }),
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
  "09-02-final": makeView({
    jobId: "09-02-final",
    topic: "Геометрия №195 (рис.114): доказать, что DE ∥ AC",
    given: "Из фото ДЗ: выучить п.24-25 (стр.53-56), доделать №195. Условие №195 из geom.pdf: AB = BC, AD = DE, ∠C = 70°, ∠EAC = 35°. Доказать: DE ∥ AC.",
    steps: [
      "Так как AB = BC, треугольник ABC равнобедренный с основанием AC, значит ∠A = ∠C = 70°.",
      "По условию ∠EAC = 35°. Тогда ∠BAE = ∠BAC − ∠EAC = 70° − 35° = 35°.",
      "По рисунку 114 точка D лежит на стороне AB, следовательно луч AD совпадает с лучом AB и ∠DAE = ∠BAE = 35°.",
      "Так как AD = DE, треугольник ADE равнобедренный (боковые AD и DE), значит углы при основании AE равны: ∠DAE = ∠AED = 35°.",
      "Получили ∠AED = ∠EAC = 35°. Это накрест лежащие (соответственные) углы при прямых DE и AC и секущей AE, значит DE ∥ AC.",
    ],
    answer: "Доказано: DE ∥ AC.",
    rewriteForNotebook:
      "AB = BC ⇒ ∠A = ∠C = 70°. ∠EAC = 35° ⇒ ∠BAE = 35°. D ∈ AB ⇒ ∠DAE = 35°. AD = DE ⇒ △ADE равнобедренный ⇒ ∠AED = ∠DAE = 35°. ∠AED = ∠EAC, значит DE ∥ AC.",
    sourceHints: [
      { book: "geom.pdf", page: "58", exercise: "195", chunkLabel: "figure-114" },
      { book: "geom.pdf", page: "53-56", exercise: "24-25", chunkLabel: "parallel-lines-theory" },
    ],
    fullSolutionRich: [
      "## Что дано",
      "№195 (рис. 114): AB = BC, AD = DE, ∠C = 70°, ∠EAC = 35°. Доказать: DE ∥ AC.",
      "",
      "## Решение",
      "1. Из AB = BC следует, что △ABC равнобедренный с основанием AC, поэтому ∠A = ∠C = 70°.",
      "2. Тогда ∠BAE = ∠BAC − ∠EAC = 70° − 35° = 35°.",
      "3. По рисунку D лежит на AB, следовательно ∠DAE = ∠BAE = 35°.",
      "4. AD = DE, значит △ADE равнобедренный, и углы при основании AE равны: ∠DAE = ∠AED = 35°.",
      "5. Получили ∠AED = ∠EAC. Эти углы образованы секущей AE с прямыми DE и AC, значит прямые параллельны.",
      "",
      "## Ответ",
      "DE ∥ AC.",
      "",
      "## Короткая проверка",
      "Сравнили углы, образованные секущей AE: они равны, значит условие параллельности выполнено.",
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
  const localFallback = LOCAL_FALLBACK_SOLUTIONS[jobId];

  if (stored) {
    if (localFallback && isWeakStoredSolution(stored)) {
      await syncFallbackToSupabase(localFallback);
      return localFallback;
    }
    return stored;
  }

  if (localFallback) {
    await syncFallbackToSupabase(localFallback);
    return localFallback;
  }

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
