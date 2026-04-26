"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Layers3,
  Milestone,
  Rocket,
  Timer,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseAnon } from "@/hooks/supabase";

/* -------------------------------------------------------------------------- */
/*  Types & constants                                                         */
/* -------------------------------------------------------------------------- */

type TaskStatus = "open" | "claimed" | "running" | "ready_for_pr" | "done";

type FranchizeTask = {
  id: string;
  title: string;
  body: string | null;
  capability: string | null;
  status: TaskStatus | string;
  todo_path: string | null;
  created_at: string;
  updated_at: string;
  pr_url: string | null;
};

type IdeaRow = {
  idea: string;
  capability: string;
  phase: string; // we'll still use the existing phases, but allow new ones to fall into "Uncategorised"
  taskType: "R1 Contract" | "R2 Integration" | "R3 Ops UX" | "R4 Growth";
  routes: string[];
  note: string;
  decompositionHint: string;
};

const STATUS_LABEL: Record<TaskStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-sky-500/15 text-sky-300 border-sky-400/30" },
  claimed: { label: "Claimed", className: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30" },
  running: { label: "Running", className: "bg-amber-500/15 text-amber-300 border-amber-400/30" },
  ready_for_pr: { label: "Ready for PR", className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30" },
  done: { label: "Done", className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" },
};

const PHASE_ORDER = ["Апрель", "Май", "Июнь", "Лето", "2027"] as const;

const IDEA_MAP: IdeaRow[] = [
  {
    idea: "Инфо-лендинг + адреса/услуги (VIP Bike)",
    capability: "franchize.info",
    phase: "Апрель",
    taskType: "R3 Ops UX",
    routes: ["/vipbikerental", "/franchize/vip-bike/*"],
    note: "Лендинг + брендинг админка для акций и контента.",
    decompositionHint: "Разбить на дочерние задачи: контент-блоки, CTA и sync с брендинг-админкой.",
  },
  {
    idea: "Аренда: каталог, доступность, календарь и договор",
    capability: "franchize.rental",
    phase: "Апрель",
    taskType: "R1 Contract",
    routes: ["/franchize/vip-bike/market", "/rent-bike", "/markdown-doc"],
    note: "VIN через админку + финализация MD шаблона договора.",
    decompositionHint: "Спаунить subtasks: availability sync, VIN CRUD, markdown-doc attach к rental flow.",
  },
  {
    idea: "Продажа новых/БУ + трейд-ин (отложенный блок)",
    capability: "franchize.sales",
    phase: "Май",
    taskType: "R4 Growth",
    routes: ["/franchize/vip-bike/market"],
    note: "Через specs-флаги “в продаже / трейд-ин”.",
    decompositionHint: "Отдельные подзадачи на specs flags, фильтры витрины и честные обзоры.",
  },
  {
    idea: "Сервис + эндуро-направление (crew: vip-cross)",
    capability: "franchize.integration",
    phase: "Июнь",
    taskType: "R2 Integration",
    routes: ["/docs/sql/*.sql", "/franchize/vip-cross/*"],
    note: "Отдельный crew-слой и SQL-гидрация сервисных потоков.",
    decompositionHint: "Создать seed по аналогии с vip-bike: docs/sql/vip-cross-franchize-hydration.sql.",
  },
  {
    idea: "Инфоблок для новичков и safety-подсказки",
    capability: "franchize.onboarding",
    phase: "Май",
    taskType: "R3 Ops UX",
    routes: ["/start (@oneBikePlsBot)", "/franchize/vip-bike/*"],
    note: "Триггер предупреждений для новых пользователей.",
    decompositionHint: "Подзадачи на сегментацию новичков, тексты warning и ссылку на FAQ.",
  },
  {
    idea: "Мотомероприятия + партнёры + акции",
    capability: "franchize.growth",
    phase: "Май",
    taskType: "R4 Growth",
    routes: ["/franchize/vip-bike/*", "брендинг-админка"],
    note: "Управление через акционные блоки и партнёрские ссылки.",
    decompositionHint: "Отдельные задачи для партнёров, акций и ивент-ленты.",
  },
  {
    idea: "Map Riders / ивенты / челленджи / захват районов",
    capability: "franchize.gamification",
    phase: "Лето",
    taskType: "R4 Growth",
    routes: ["/franchize/vip-bike/map-riders", "/admin/map-calibrator"],
    note: "Геймификация + карты + weekly challenge-ритм.",
    decompositionHint: "Сначала telemetry contract, потом challenges и achievements.",
  },
  {
    idea: "KPI и воронка статуса франшизы для оператора",
    capability: "franchize.kpi",
    phase: "Апрель",
    taskType: "R3 Ops UX",
    routes: ["/supaplan", "/nexus", "/supaplan/franchize"],
    note: "Понятная human-first витрина статуса и прогресса.",
    decompositionHint: "Детализировать KPI в child tasks: lead->booking, conversion и SLA.",
  },
  {
    idea: "Telegram-first контур и уведомления",
    capability: "franchize.telegram",
    phase: "Апрель",
    taskType: "R2 Integration",
    routes: ["@oneBikePlsBot", "/api/codex-bridge/callback"],
    note: "Проверка callback parity + операторские уведомления.",
    decompositionHint: "Выделить подзадачи на callback schema, retry, fallback telegram post.",
  },
  {
    idea: "Аналитика и разметка SupaPlan-задач по идеям",
    capability: "franchize.analytics",
    phase: "Апрель",
    taskType: "R1 Contract",
    routes: ["/supaplan/franchize", "/nexus"],
    note: "Матчинг «идея ↔ capability ↔ task/status».",
    decompositionHint: "Регулярно спаунить детализацию эпиков при старте реализации.",
  },
  // ---- NEW CAPABILITIES ----
  {
    idea: "UI/UX-дизайн для франшизы",
    capability: "franchize.ui.ux",
    phase: "Апрель",
    taskType: "R3 Ops UX",
    routes: ["/franchize/vip-bike/*"],
    note: "Система дизайн-компонентов и UX-флоу для мобильных и веб-версий.",
    decompositionHint: "Создать дизайн-систему и сверстать ключевые экраны.",
  },
  {
    idea: "Бэкенд Supabase-инфраструктура франшизы",
    capability: "franchize.backend.supabase",
    phase: "Апрель",
    taskType: "R1 Contract",
    routes: ["/supabase", "/sql"],
    note: "Настройка RLS, миграции, функции и API-роуты.",
    decompositionHint: "Подготовить миграции схем данных, ролевую модель и хранимые процедуры.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function statusWeight(status: string): number {
  switch (status) {
    case "done": return 4;
    case "ready_for_pr": return 3;
    case "running": return 2;
    case "claimed": return 1;
    default: return 0;
  }
}

function formatIso(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/* -------------------------------------------------------------------------- */
/*  Page Component                                                            */
/* -------------------------------------------------------------------------- */

export default function FranchizeStatusPage() {
  const [tasks, setTasks] = useState<FranchizeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill‑down states: which phase / capability / task is expanded
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // ---- Fetch all franchize tasks ----
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabaseAnon
          .from("supaplan_tasks")
          .select("id,title,body,capability,status,todo_path,created_at,updated_at,pr_url")
          .or("capability.like.franchize.%,capability.eq.greenbox.franchize")
          .order("updated_at", { ascending: false });

        if (error) throw error;
        setTasks((data as FranchizeTask[]) || []);
      } catch (err: any) {
        setError(err.message || "Не удалось загрузить задачи");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ---- Group tasks by capability ----
  const capabilityTaskMap = useMemo(() => {
    const map = new Map<string, FranchizeTask[]>();
    tasks.forEach((task) => {
      if (!task.capability) return;
      const prev = map.get(task.capability) || [];
      prev.push(task);
      map.set(task.capability, prev);
    });
    return map;
  }, [tasks]);

  // ---- Stats ----
  const statusTotals = useMemo(() => {
    const totals: Record<TaskStatus, number> = { open: 0, claimed: 0, running: 0, ready_for_pr: 0, done: 0 };
    tasks.forEach((task) => {
      const key = task.status as TaskStatus;
      if (key in totals) totals[key] += 1;
    });
    return totals;
  }, [tasks]);

  const progressPercent = useMemo(() => {
    return tasks.length ? Math.round((statusTotals.done / tasks.length) * 100) : 0;
  }, [tasks, statusTotals.done]);

  // ---- Map capabilities to phases (using IDEA_MAP + fallback) ----
  const capabilityIdeaMap = useMemo(() => {
    const map = new Map<string, IdeaRow>();
    IDEA_MAP.forEach((row) => map.set(row.capability, row));
    return map;
  }, []);

  const getPhaseForCapability = (cap: string): string => {
    return capabilityIdeaMap.get(cap)?.phase ?? "Uncategorised";
  };

  // ---- Build data per phase ----
  const phaseData = useMemo(() => {
    const phaseMap = new Map<string, { capabilities: string[] }>();

    PHASE_ORDER.forEach((phase) => phaseMap.set(phase, { capabilities: [] }));

    // All capabilities present in tasks (or the map)
    const allCaps = new Set<string>();
    capabilityTaskMap.forEach((_, cap) => allCaps.add(cap));
    capabilityIdeaMap.forEach((_, cap) => allCaps.add(cap)); // even empty ideas

    allCaps.forEach((cap) => {
      const phase = getPhaseForCapability(cap);
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, { capabilities: [] });
      }
      phaseMap.get(phase)!.capabilities.push(cap);
    });

    // Sort capabilities inside each phase (alphabetically, or by some weight)
    phaseMap.forEach((value) => {
      value.capabilities.sort((a, b) => a.localeCompare(b));
    });

    return phaseMap;
  }, [capabilityTaskMap, capabilityIdeaMap]);

  // ---- Toggle helpers ----
  const togglePhase = useCallback((phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  }, []);

  const toggleCapability = useCallback((cap: string) => {
    setExpandedCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap);
      else next.add(cap);
      return next;
    });
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // ---- Rendering ----
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-rose-300">
        <AlertCircle className="mr-2 h-5 w-5" /> Ошибка: {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      {/* ---- Hero Banner (unchanged structure) ---- */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,#0ea5e9_0%,#111827_42%,#020617_100%)] p-5 text-white shadow-lg dark:border-slate-700/80">
        <div className="absolute -right-16 top-0 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />

        <div className="relative flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100">
          <Badge className="border border-cyan-300/40 bg-cyan-300/20 text-cyan-100">FRANCHIZE CONTROL DECK</Badge>
          <span>crew alias: vip-bike</span>
          <span>canonical slug: vip-bike</span>
        </div>

        <h1 className="relative mt-3 text-2xl font-semibold leading-tight sm:text-4xl">SupaPlan • Franchize status board (human-first)</h1>
        <p className="relative mt-3 max-w-4xl text-sm text-slate-200 sm:text-base">
          Сопоставили клиентские идеи и текущий SupaPlan. Здесь видно, какие эпики уже закрыты, какие в работе и где пора декомпозировать
          в более мелкие задачи во время реализации.
        </p>

        <div className="relative mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <Link href="/supaplan" className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 hover:bg-white/15">
            <ArrowLeft className="h-4 w-4" /> Назад в общий SupaPlan
          </Link>
          <Link href="/nexus" className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 hover:bg-white/15">
            <Rocket className="h-4 w-4" /> Nexus
          </Link>
          <Link
            href="/franchize/vip-bike/map-riders"
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 hover:bg-white/15"
          >
            <Bike className="h-4 w-4" /> VIP Bike Map Riders
          </Link>
        </div>
      </section>

      {/* ---- Status cards ---- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["open", "claimed", "running", "ready_for_pr", "done"] as TaskStatus[]).map((status) => (
          <Card key={status} className="border-slate-800/70 bg-slate-950 text-slate-100">
            <CardHeader className="space-y-1 pb-1">
              <CardDescription className="text-xs text-slate-400">{STATUS_LABEL[status].label}</CardDescription>
              <CardTitle className="text-2xl">{statusTotals[status]}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* ---- Progress & Legend ---- */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Timer className="h-4 w-4 text-emerald-300" /> Прогресс по всем задачам
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Выполнено: <span className="font-semibold text-emerald-300">{progressPercent}%</span> ({statusTotals.done}/{tasks.length}) задач.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Milestone className="h-4 w-4 text-cyan-300" /> Legend — типы задач и статусов
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
            <strong>R1 Contract</strong>
            <p className="text-slate-300">Блокирующий слой: данные, схемы, совместимость, правила декомпозиции.</p>
          </div>
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
            <strong>R2 Integration</strong>
            <p className="text-slate-300">Интеграции Telegram/Bridge/API, контур callback и внешние связки.</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <strong>R3 Ops UX</strong>
            <p className="text-slate-300">Операторская витрина, админ-флоу, понятные статусы и CTA.</p>
          </div>
          <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
            <strong>R4 Growth</strong>
            <p className="text-slate-300">Маркетплейс, комьюнити, геймификация и ростовые механики.</p>
          </div>
        </CardContent>
      </Card>

      {/* ---- Double-collapsible phase → capability → task ---- */}
      <div className="space-y-3">
        {[...phaseData.entries()]
          .sort(([phaseA], [phaseB]) => {
            const idxA = PHASE_ORDER.indexOf(phaseA as any);
            const idxB = PHASE_ORDER.indexOf(phaseB as any);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return phaseA.localeCompare(phaseB);
          })
          .map(([phase, { capabilities }]) => {
            const phaseExpanded = expandedPhases.has(phase);
            // Count tasks per phase for a small summary
            const phaseTaskCount = capabilities.reduce((sum, cap) => sum + (capabilityTaskMap.get(cap)?.length || 0), 0);
            return (
              <Card key={phase} className="border-slate-800/70 bg-slate-950 text-slate-100">
                {/* Phase header */}
                <button
                  type="button"
                  onClick={() => togglePhase(phase)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    {phaseExpanded ? (
                      <ChevronDown className="h-5 w-5 text-cyan-300" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-cyan-300" />
                    )}
                    <h2 className="text-lg font-semibold uppercase tracking-wide">{phase}</h2>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {capabilities.length} идеи · {phaseTaskCount} задач
                    </Badge>
                  </div>
                </button>

                {/* Collapsible content */}
                {phaseExpanded && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {capabilities.map((cap) => {
                        const capTasks = capabilityTaskMap.get(cap) || [];
                        const idea = capabilityIdeaMap.get(cap);
                        const capExpanded = expandedCapabilities.has(cap);

                        // Determine the "worst" status across tasks
                        const worstStatus = capTasks.length
                          ? capTasks.reduce((worst, t) =>
                              statusWeight(t.status) < statusWeight(worst) ? t.status : worst
                            , capTasks[0].status)
                          : "open";
                        const worstMeta = STATUS_LABEL[worstStatus as TaskStatus] || STATUS_LABEL.open;

                        return (
                          <div
                            key={cap}
                            className="rounded-xl border border-slate-800 bg-slate-900/70"
                          >
                            {/* Capability row */}
                            <button
                              type="button"
                              onClick={() => toggleCapability(cap)}
                              className="flex w-full items-center justify-between p-3 text-left"
                            >
                              <div className="flex items-center gap-2">
                                {capExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-amber-300" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-amber-300" />
                                )}
                                <span className="text-sm font-medium">{idea?.idea || cap}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={worstMeta.className}>{worstMeta.label}</Badge>
                                <span className="text-xs text-slate-400">{capTasks.length} tasks</span>
                              </div>
                            </button>

                            {/* Capability detail + tasks */}
                            {capExpanded && (
                              <div className="border-t border-slate-800 px-3 pb-3 pt-2">
                                {idea && (
                                  <div className="mb-2 text-xs text-slate-400">
                                    <p className="text-slate-300">{idea.note}</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {idea.routes.map((r) => (
                                        <code key={r} className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-cyan-300">
                                          {r}
                                        </code>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Tasks list */}
                                {capTasks.length === 0 ? (
                                  <p className="flex items-center gap-1 text-xs text-amber-300">
                                    <AlertCircle className="h-3.5 w-3.5" /> Нет задач – нужно создать.
                                  </p>
                                ) : (
                                  <ul className="space-y-2">
                                    {capTasks
                                      .sort((a, b) => statusWeight(b.status) - statusWeight(a.status))
                                      .map((task) => {
                                        const taskExpanded = expandedTasks.has(task.id);
                                        const taskMeta = STATUS_LABEL[task.status as TaskStatus] || STATUS_LABEL.open;
                                        return (
                                          <li key={task.id} className="rounded border border-slate-700/70 bg-slate-950/70 p-2">
                                            <div className="flex items-center justify-between gap-2">
                                              <button
                                                type="button"
                                                onClick={() => toggleTask(task.id)}
                                                className="flex flex-1 items-center gap-1 text-left"
                                              >
                                                {taskExpanded ? (
                                                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                                ) : (
                                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                                )}
                                                <span className="text-sm text-slate-200">{task.title}</span>
                                              </button>
                                              <Badge className={taskMeta.className}>{taskMeta.label}</Badge>
                                            </div>
                                            {/* Task details */}
                                            {taskExpanded && (
                                              <div className="mt-2 space-y-1 pl-5 text-xs text-slate-400">
                                                <p>ID: {task.id}</p>
                                                {task.todo_path && <p>todo_path: {task.todo_path}</p>}
                                                <p>updated_at (UTC): {formatIso(task.updated_at)}</p>
                                                {task.body && <p className="text-slate-300">{task.body}</p>}
                                                {task.pr_url && (
                                                  <a
                                                    className="text-cyan-300 underline underline-offset-2"
                                                    href={task.pr_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                  >
                                                    PR: {task.pr_url}
                                                  </a>
                                                )}
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
      </div>

      {/* ---- Runtime checks (compact footer) ---- */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wrench className="h-4 w-4 text-cyan-300" /> Runtime checks
          </CardTitle>
          <CardDescription className="text-slate-400">Текущая выборка из supaplan_tasks (capability like `franchize.%`).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Задач найдено: {tasks.length}
          </p>
          <p className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-cyan-300" /> Обновлено: {new Date().toISOString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}