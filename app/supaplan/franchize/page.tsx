"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Flame,
  HelpCircle,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseAnon } from "@/hooks/supabase";
import { getTopPriorityTasks, PriorityTask } from "../actions";

/* ========================================================================== */
/*  Types & constants                                                         */
/* ========================================================================== */

type TaskStatusProp = "open" | "claimed" | "running" | "ready_for_pr" | "done";

type FranchizeTask = {
  id: string;
  title: string;
  body: string | null;
  capability: string | null;
  status: TaskStatusProp | string;
  todo_path: string | null;
  created_at: string;
  updated_at: string;
  pr_url: string | null;
  metadata?: any;
};

type IdeaRow = {
  idea: string;
  capability: string;
  phase: string;
  taskType: "R1 Contract" | "R2 Integration" | "R3 Ops UX" | "R4 Growth";
  routes: string[];
  note: string;
  decompositionHint: string;
};

const STATUS_LABEL: Record<TaskStatusProp, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-sky-500/15 text-sky-300 border-sky-400/30" },
  claimed: { label: "Claimed", className: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30" },
  running: { label: "Running", className: "bg-amber-500/15 text-amber-300 border-amber-400/30" },
  ready_for_pr: {
    label: "Ready for PR",
    className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30",
  },
  done: { label: "Done", className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" },
};

const STATUS_GLOW: Record<TaskStatusProp, string> = {
  open: "shadow-sky-500/10",
  claimed: "shadow-indigo-500/10",
  running: "shadow-amber-500/10",
  ready_for_pr: "shadow-fuchsia-500/10",
  done: "shadow-emerald-500/10",
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

/* ========================================================================== */
/*  Helpers                                                                   */
/* ========================================================================== */

function statusUrgency(status: string): number {
  switch (status) {
    case "open": return 0;
    case "claimed": return 1;
    case "running": return 2;
    case "ready_for_pr": return 3;
    case "done": return 4;
    default: return 5;
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

function buildTaskCopyText(task: PriorityTask, fullTask?: FranchizeTask): string {
  const parts = [
    `Выполни задачу: ${task.title}`,
    `ID: ${task.id}`,
    `Статус: ${task.status}`,
    `Capability: ${task.capability || "—"}`,
  ];
  if (fullTask?.todo_path) parts.push(`Файл: ${fullTask.todo_path}`);
  if (fullTask?.body) {
    const bodyPreview = fullTask.body.length > 200 ? `${fullTask.body.slice(0, 200)}...` : fullTask.body;
    parts.push(`Описание: ${bodyPreview}`);
  }
  return parts.join("\n");
}

/* ========================================================================== */
/*  Page Component                                                            */
/* ========================================================================== */

export default function FranchizeStatusPage() {
  // ----- Core data -----
  const [tasks, setTasks] = useState<FranchizeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----- Tree expansion -----
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [legendOpen, setLegendOpen] = useState(false);

  // ----- Priority engine (auto‑loaded) -----
  const [priorityTasks, setPriorityTasks] = useState<PriorityTask[]>([]);
  const [isPriorityLoading, startPriorityTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  // 1. Fetch all franchize tasks on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabaseAnon
          .from("supaplan_tasks")
          .select("id,title,body,capability,status,todo_path,created_at,updated_at,pr_url,metadata")
          .or("capability.like.franchize.%")
          .order("updated_at", { ascending: false });

        if (error) throw error;
        const filtered = (data as FranchizeTask[]).filter(
          (t) => t.capability && !t.capability.startsWith("greenbox.")
        );
        setTasks(filtered);
      } catch (err: any) {
        setError(err.message || "Не удалось загрузить задачи");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 2. Auto‑load Top‑5 once tasks are available
  useEffect(() => {
    if (tasks.length === 0 || priorityTasks.length > 0) return;
    startPriorityTransition(async () => {
      const res = await getTopPriorityTasks();
      if (res.success && res.data) {
        setPriorityTasks(res.data);
      }
    });
  }, [tasks, priorityTasks.length]);

  // ----- Derived stats -----
  const statusTotals = useMemo(() => {
    const totals: Record<TaskStatusProp, number> = { open: 0, claimed: 0, running: 0, ready_for_pr: 0, done: 0 };
    tasks.forEach((t) => {
      const key = t.status as TaskStatusProp;
      if (key in totals) totals[key] += 1;
    });
    return totals;
  }, [tasks]);

  const totalPending = tasks.length - statusTotals.done;
  const progressPercent = tasks.length ? Math.round((statusTotals.done / tasks.length) * 100) : 0;
  const circumference = 2 * Math.PI * 15.9155; // ~100

  // ----- Phase grouping -----
  const phaseData = useMemo(() => {
    const map = new Map<string, Map<string, FranchizeTask[]>>();
    PHASE_ORDER.forEach((p) => map.set(p, new Map()));

    const ideaByCap = new Map(IDEA_MAP.map((i) => [i.capability, i]));
    tasks.forEach((task) => {
      const cap = task.capability || "unknown";
      const idea = ideaByCap.get(cap);
      const phase = idea?.phase ?? "2027";
      if (!map.has(phase)) map.set(phase, new Map());
      const capMap = map.get(phase)!;
      if (!capMap.has(cap)) capMap.set(cap, []);
      capMap.get(cap)!.push(task);
    });

    const orderedPhases: [string, Map<string, FranchizeTask[]>][] = [];
    PHASE_ORDER.forEach((p) => {
      if (map.get(p)?.size) orderedPhases.push([p, map.get(p)!]);
    });
    map.forEach((capMap, phase) => {
      if (!PHASE_ORDER.includes(phase as any) && capMap.size) {
        orderedPhases.push([phase, capMap]);
      }
    });
    return orderedPhases;
  }, [tasks]);

  // ----- Toggle helpers -----
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

  // ----- Clipboard (single task & all 5) -----
  const handleCopyTask = useCallback(async (pt: PriorityTask) => {
    const fullTask = tasks.find((t) => t.id === pt.id);
    const text = buildTaskCopyText(pt, fullTask);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [tasks]);

  const handleCopyAllTop5 = useCallback(async () => {
    const texts = priorityTasks.map((pt) => {
      const fullTask = tasks.find((t) => t.id === pt.id);
      return `--- Задача ${pt.id} ---\n${buildTaskCopyText(pt, fullTask)}`;
    });
    const fullText = texts.join("\n\n");
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [priorityTasks, tasks]);

  // ----- Render states -----
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

  /* ======================================================================== */
  /*  Render                                                                   */
  /* ======================================================================== */
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 pb-20 sm:px-6 sm:py-8 lg:px-8">
      {/* ==================================================================== */}
      {/*  HERO – cyber command deck                                           */}
      {/* ==================================================================== */}
      <section className="relative rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-indigo-950/90 to-slate-900 p-5 text-white shadow-2xl sm:p-6">
        {/* Background glows – no overflow‑hidden on the parent so they render fully */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative z-10 grid gap-6 md:grid-cols-3">
          {/* Left column: title + meta */}
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300">
              <Badge className="border-cyan-400/40 bg-cyan-400/20 text-cyan-100">FRANCHIZE CONTROL DECK</Badge>
              <span className="text-slate-400">vip‑bike crew</span>
            </div>

            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-cyan-300 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                SupaPlan • Franchize
              </span>
              <br />
              <span className="text-2xl text-slate-100 sm:text-3xl">Live Status Board</span>
            </h1>

            <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              Мгновенный срез по всем эпикам. Приоритеты, фазы, критические задачи — всё под рукой.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/supaplan"
                className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs transition hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" /> Общий SupaPlan
              </Link>
              <a
                href="https://chatgpt.com/codex/cloud"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-purple-400/30 bg-purple-400/10 px-3 py-2 text-xs text-purple-200 transition hover:bg-purple-400/20"
              >
                <ExternalLink className="h-4 w-4" /> Codex Cloud
              </a>
            </div>
          </div>

          {/* Right column: progress ring */}
          <div className="flex items-center justify-center">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
                <circle
                  className="text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  cx="18" cy="18" r="15.9155"
                />
                <circle
                  className="text-cyan-400 drop-shadow-[0_0_6px_#22d3ee] transition-all duration-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercent} ${100 - progressPercent}`}
                  cx="18" cy="18" r="15.9155"
                />
              </svg>
              <span className="absolute text-2xl font-bold tabular-nums text-cyan-300">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/*  STATUS CARDS – enhanced                                             */}
      {/* ==================================================================== */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        {(["open", "claimed", "running", "ready_for_pr", "done"] as TaskStatusProp[]).map((status) => (
          <Card
            key={status}
            className={`border-slate-800/70 bg-slate-950 text-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg ${STATUS_GLOW[status]}`}
          >
            <CardHeader className="space-y-1 p-3 pb-1 sm:p-4 sm:pb-1">
              <CardDescription className="text-[11px] uppercase tracking-wide text-slate-400">
                {STATUS_LABEL[status].label}
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums tracking-tight">
                {statusTotals[status]}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* ==================================================================== */}
      {/*  PROGRESS BAR                                                        */}
      {/* ==================================================================== */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardContent className="pt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Выполнено:{" "}
            <span className="font-semibold text-emerald-300">
              {statusTotals.done}/{tasks.length}
            </span>{" "}
            задач. Осталось критических:{" "}
            <span className="font-semibold text-rose-400">{totalPending}</span>.
          </p>
        </CardContent>
      </Card>

      {/* ==================================================================== */}
      {/*  TOP‑5 PRIORITY – auto‑loaded, no hide button                        */}
      {/* ==================================================================== */}
      {isPriorityLoading && priorityTasks.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          Загружаю приоритетные задачи…
        </div>
      )}

      {priorityTasks.length > 0 && (
        <Card className="border-amber-500/50 bg-gradient-to-br from-amber-950/60 to-slate-950 text-slate-100 shadow-lg shadow-amber-500/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-300">
                <Flame className="h-5 w-5" />
                ТОП‑5 критических задач
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAllTop5}
                  className="h-auto px-2 py-1 text-xs text-amber-300 hover:text-amber-100 disabled:opacity-50"
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {copied ? "Скопировано!" : "Копировать все 5"}
                </Button>
                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-400/80">
                  авто‑обновление
                </span>
              </div>
            </div>
            <CardDescription className="text-slate-400">
              Формула: статус × фаза × важность способности × приоритет × свежесть.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {priorityTasks.map((pt) => {
              const taskMeta = STATUS_LABEL[pt.status as TaskStatusProp] || STATUS_LABEL.open;
              const fullTask = tasks.find((t) => t.id === pt.id);
              return (
                <div
                  key={pt.id}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{pt.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge className={taskMeta.className}>{taskMeta.label}</Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                          {pt.capability}
                        </Badge>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-mono font-bold tabular-nums text-amber-300">
                      {pt.score}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{pt.reasoning}</p>
                  {fullTask?.todo_path && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      todo_path: {fullTask.todo_path}
                    </p>
                  )}
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyTask(pt)}
                      className="h-auto px-2 py-1 text-xs text-cyan-300 hover:text-cyan-100"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Копировать задачу
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/*  PHASE → CAPABILITY → TASK TREE                                      */}
      {/* ==================================================================== */}
      <div className="space-y-3">
        {phaseData.map(([phase, capMap]) => {
          const phaseExpanded = expandedPhases.has(phase);
          const phaseTasks = [...capMap.values()].flat();
          const undone = phaseTasks.filter((t) => t.status !== "done").length;
          const total = phaseTasks.length;
          const fullyDone = total > 0 && undone === 0;

          return (
            <Card
              key={phase}
              data-phase={phase}
              className={`border-l-4 border-slate-800/70 bg-slate-950 text-slate-100 scroll-mt-28 ${
                fullyDone ? "ring-1 ring-emerald-500/30" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => togglePhase(phase)}
                className="flex w-full items-center justify-between p-3 text-left sm:p-4"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {phaseExpanded ? (
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-cyan-300" />
                  ) : (
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-cyan-300" />
                  )}
                  <h2 className="text-lg font-semibold capitalize">{phase}</h2>
                  {total > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="border-slate-600 text-xs text-slate-300">
                        {capMap.size} способности
                      </Badge>
                      {undone > 0 && (
                        <Badge className="bg-rose-500/20 text-xs text-rose-300">
                          {undone} не завершено
                        </Badge>
                      )}
                      {fullyDone && (
                        <Badge className="bg-emerald-500/20 text-xs text-emerald-300">
                          всё сделано ✓
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {total > 0 && (
                  <span className="text-xs tabular-nums text-slate-400">
                    {total - undone}/{total}
                  </span>
                )}
              </button>

              {phaseExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {[...capMap.entries()].map(([cap, capTasks]) => {
                      const capExpanded = expandedCapabilities.has(cap);
                      const doneCount = capTasks.filter((t) => t.status === "done").length;
                      const allDone = capTasks.length > 0 && doneCount === capTasks.length;
                      const worstStatus = capTasks.length
                        ? capTasks.reduce((worst, t) =>
                            statusUrgency(t.status) < statusUrgency(worst) ? t.status : worst,
                            capTasks[0].status
                          )
                        : "open";
                      const worstMeta =
                        STATUS_LABEL[worstStatus as TaskStatusProp] || STATUS_LABEL.open;
                      const idea = IDEA_MAP.find((i) => i.capability === cap);

                      return (
                        <div
                          key={cap}
                          className="rounded-xl border border-slate-800 bg-slate-900/70"
                        >
                          <button
                            type="button"
                            onClick={() => toggleCapability(cap)}
                            className="flex w-full items-start justify-between p-3 text-left"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {capExpanded ? (
                                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-amber-300" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-amber-300" />
                                )}
                                <span className="text-sm font-medium">
                                  {idea?.idea || cap}
                                </span>
                                {allDone && (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                )}
                              </div>
                              {idea?.note && (
                                <p className="mt-1 pl-6 text-xs text-slate-400">{idea.note}</p>
                              )}
                            </div>
                            <div className="ml-2 flex items-center gap-2">
                              <Badge className={worstMeta.className}>
                                {worstMeta.label}
                              </Badge>
                              <span className="text-xs tabular-nums text-slate-400">
                                {doneCount}/{capTasks.length}
                              </span>
                            </div>
                          </button>

                          {capExpanded && (
                            <div className="border-t border-slate-800 px-3 pb-3 pt-2">
                              {idea && (
                                <div className="mb-2 flex flex-wrap gap-1">
                                  {idea.routes.map((r) => (
                                    <code
                                      key={r}
                                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-cyan-300"
                                    >
                                      {r}
                                    </code>
                                  ))}
                                </div>
                              )}

                              {capTasks.length === 0 ? (
                                <p className="text-xs text-amber-300">Нет задач</p>
                              ) : (
                                <ul className="space-y-2">
                                  {capTasks
                                    .sort(
                                      (a, b) =>
                                        statusUrgency(a.status) - statusUrgency(b.status)
                                    )
                                    .map((task) => {
                                      const taskExpanded = expandedTasks.has(task.id);
                                      const taskMeta =
                                        STATUS_LABEL[task.status as TaskStatusProp] ||
                                        STATUS_LABEL.open;
                                      return (
                                        <li
                                          key={task.id}
                                          className="rounded border border-slate-700/70 bg-slate-950/70 p-2"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => toggleTask(task.id)}
                                            className="flex w-full items-center justify-between gap-2 text-left"
                                          >
                                            <div className="flex items-center gap-1">
                                              {taskExpanded ? (
                                                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                                              ) : (
                                                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                                              )}
                                              <span className="text-sm text-slate-200">
                                                {task.title}
                                              </span>
                                            </div>
                                            <Badge className={taskMeta.className}>
                                              {taskMeta.label}
                                            </Badge>
                                          </button>
                                          {taskExpanded && (
                                            <div className="mt-2 space-y-1 pl-5 text-xs text-slate-400">
                                              <p>ID: {task.id}</p>
                                              {task.todo_path && (
                                                <p>todo_path: {task.todo_path}</p>
                                              )}
                                              <p>updated_at (UTC): {formatIso(task.updated_at)}</p>
                                              {task.body && (
                                                <p className="max-w-lg truncate text-slate-300">
                                                  {task.body}
                                                </p>
                                              )}
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

      {/* ==================================================================== */}
      {/*  LEGEND                                                              */}
      {/* ==================================================================== */}
      <div className="border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={() => setLegendOpen(!legendOpen)}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          <HelpCircle className="h-4 w-4" />
          {legendOpen ? "Скрыть легенду" : "Показать легенду"}
        </button>

        {legendOpen && (
          <div className="mt-3 space-y-4 text-sm text-slate-300">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Приоритеты (scoring)
              </h4>
              <p className="text-slate-400">
                critical ×2.5, high ×2.0, medium ×1.5, low ×1.0. P0/p1/p2 в теле задачи действуют аналогично.
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Фазы и их множители
              </h4>
              <div className="flex flex-wrap gap-2">
                {[
                  "launch-blocker",
                  "launch-quality",
                  "security",
                  "performance",
                  "polishing",
                  "ux-fix",
                  "seo",
                  "code-quality",
                  "tech-debt",
                  "post-launch",
                ].map((p) => (
                  <Badge key={p} className="border-l-2 bg-slate-800/50 capitalize">
                    {p.replace("-", " ")}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Типы задач (capabilities)
              </h4>
              <div className="flex flex-wrap gap-2">
                {[...new Set(tasks.map((t) => t.capability))]
                  .filter(Boolean)
                  .sort()
                  .map((cap) => (
                    <Badge key={cap} variant="outline" className="text-xs">
                      {cap}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/*  RUNTIME CHECKS                                                      */}
      {/* ==================================================================== */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-cyan-300" /> Runtime checks
          </CardTitle>
          <CardDescription className="text-slate-400">
            {tasks.length} franchize‑задач загружено (greenbox исключены).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Готово: {statusTotals.done}
          </p>
          <p className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-cyan-300" /> Последнее обновление: {new Date().toISOString()}
          </p>
        </CardContent>
      </Card>

      {/* ==================================================================== */}
      {/*  BOTTOM STICKY BAR (mobile only)                                     */}
      {/* ==================================================================== */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t border-slate-200/40 bg-white/90 px-3 py-2 shadow backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/90 sm:hidden">
        <div className="flex items-center gap-2 text-xs">
          <Flame className="h-4 w-4 text-rose-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {totalPending} критических
          </span>
          <span className="text-slate-400 dark:text-slate-500">|</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            {statusTotals.done} сделано
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const first = document.querySelector("[data-phase]");
            first?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="h-7 text-xs"
        >
          <Zap className="mr-1 h-3 w-3" /> К первому
        </Button>
      </div>
    </div>
  );
}