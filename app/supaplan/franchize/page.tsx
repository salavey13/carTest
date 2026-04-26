"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Flame,
  HelpCircle,
  Layers3,
  Milestone,
  Rocket,
  Sparkles,
  Timer,
  Wrench,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseAnon } from "@/hooks/supabase";
import { getTopPriorityTasks, PriorityTask } from "../actions";

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
  phase: string;
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

const TASK_TYPE_DESCRIPTIONS: Record<string, string> = {
  "R1 Contract": "Блокирующий слой: данные, схемы, совместимость",
  "R2 Integration": "Telegram/Bridge/API, контур callback",
  "R3 Ops UX": "Операторская витрина, админ-флоу, CTA",
  "R4 Growth": "Маркетплейс, комьюнити, геймификация",
};

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

/* -------------------------------------------------------------------------- */
/*  Page Component                                                            */
/* -------------------------------------------------------------------------- */

export default function FranchizeStatusPage() {
  const [tasks, setTasks] = useState<FranchizeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tree expansion state
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Legend visibility
  const [legendOpen, setLegendOpen] = useState(false);

  // Priority tasks state
  const [priorityTasks, setPriorityTasks] = useState<PriorityTask[]>([]);
  const [isPriorityLoading, startPriorityTransition] = useTransition();
  const [showPriority, setShowPriority] = useState(false);

  // Fetch all franchize tasks on mount
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

  // ---- Derived data ----
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

  const totalPending = tasks.length - statusTotals.done;

  const capabilityIdeaMap = useMemo(() => {
    const map = new Map<string, IdeaRow>();
    IDEA_MAP.forEach((row) => map.set(row.capability, row));
    return map;
  }, []);

  const getPhaseForCapability = (cap: string): string => {
    return capabilityIdeaMap.get(cap)?.phase ?? "Uncategorised";
  };

  // Build phase data with intelligent sorting
  const phaseData = useMemo(() => {
    const phaseMap = new Map<string, { capabilities: string[] }>();
    PHASE_ORDER.forEach((phase) => phaseMap.set(phase, { capabilities: [] }));

    const allCaps = new Set<string>();
    capabilityTaskMap.forEach((_, cap) => allCaps.add(cap));
    capabilityIdeaMap.forEach((_, cap) => allCaps.add(cap));

    allCaps.forEach((cap) => {
      const phase = getPhaseForCapability(cap);
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, { capabilities: [] });
      }
      phaseMap.get(phase)!.capabilities.push(cap);
    });

    // Sort capabilities within each phase by urgency (worst status first)
    phaseMap.forEach((value) => {
      value.capabilities.sort((a, b) => {
        const tasksA = capabilityTaskMap.get(a) || [];
        const tasksB = capabilityTaskMap.get(b) || [];
        const worstA = tasksA.reduce((min, t) => Math.min(min, statusUrgency(t.status)), 4);
        const worstB = tasksB.reduce((min, t) => Math.min(min, statusUrgency(t.status)), 4);
        if (worstA !== worstB) return worstA - worstB;
        return a.localeCompare(b);
      });
    });

    // Sort phases by total undone tasks (descending), fully done phases last
    const entries = [...phaseMap.entries()].sort(([phaseA, capsA], [phaseB, capsB]) => {
      const undoneA = capsA.capabilities.reduce((sum, cap) => {
        const tasks = capabilityTaskMap.get(cap) || [];
        return sum + tasks.filter((t) => t.status !== "done").length;
      }, 0);
      const undoneB = capsB.capabilities.reduce((sum, cap) => {
        const tasks = capabilityTaskMap.get(cap) || [];
        return sum + tasks.filter((t) => t.status !== "done").length;
      }, 0);

      if (undoneA === 0 && undoneB === 0) return phaseA.localeCompare(phaseB);
      if (undoneA === 0) return 1;
      if (undoneB === 0) return -1;
      return undoneB - undoneA;
    });

    return entries;
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

  const handleExpandAll = useCallback(() => {
    const allPhases = new Set(phaseData.map(([phase]) => phase));
    const allCaps = new Set<string>();
    phaseData.forEach(([, { capabilities }]) => capabilities.forEach((c) => allCaps.add(c)));
    const allTasks = new Set(tasks.map((t) => t.id));

    setExpandedPhases(allPhases);
    setExpandedCapabilities(allCaps);
    setExpandedTasks(allTasks);
    setAllExpanded(true);
  }, [phaseData, tasks]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPhases(new Set());
    setExpandedCapabilities(new Set());
    setExpandedTasks(new Set());
    setAllExpanded(false);
  }, []);

  const jumpToFirstCritical = useCallback(() => {
    const firstCritical = phaseData.find(([, { capabilities }]) => {
      return capabilities.some((cap) => {
        const tasks = capabilityTaskMap.get(cap) || [];
        return tasks.some((t) => t.status !== "done");
      });
    });
    if (firstCritical) {
      const [phase] = firstCritical;
      setExpandedPhases((prev) => new Set(prev).add(phase));
      document.getElementById(`phase-${phase}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phaseData, capabilityTaskMap]);

  // Load top priority tasks
  const handleLoadPriority = useCallback(() => {
    startPriorityTransition(async () => {
      const res = await getTopPriorityTasks();
      if (res.success && res.data) {
        setPriorityTasks(res.data);
        setShowPriority(true);
      } else {
        alert(res.error || "Ошибка загрузки приоритетных задач");
      }
    });
  }, []);

  // ---- Render ----
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
      {/* ---- Mobile sticky status bar ---- */}
      <div className="sticky top-16 z-30 -mx-3 -mt-4 mb-4 flex items-center justify-between gap-2 rounded-b-2xl border-b border-slate-200/40 bg-white/90 px-3 py-2 shadow backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/90 sm:hidden">
        <div className="flex items-center gap-2 text-xs">
          <Flame className="h-4 w-4 text-rose-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {totalPending} критических
          </span>
          <span className="text-slate-400 dark:text-slate-500">|</span>
          <span className="text-emerald-600 dark:text-emerald-400">{statusTotals.done} сделано</span>
        </div>
        <Button variant="ghost" size="sm" onClick={jumpToFirstCritical} className="h-7 text-xs">
          <Zap className="mr-1 h-3 w-3" /> К первому
        </Button>
      </div>

      {/* ---- Hero Banner ---- */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,#0ea5e9_0%,#111827_42%,#020617_100%)] p-5 text-white shadow-lg dark:border-slate-700/80">
        <div className="absolute -right-16 top-0 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />

        <div className="relative flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100">
          <Badge className="border border-cyan-300/40 bg-cyan-300/20 text-cyan-100">FRANCHIZE CONTROL DECK</Badge>
          <span>crew alias: vip-bike</span>
          <span>canonical slug: vip-bike</span>
        </div>

        <h1 className="relative mt-3 text-2xl font-semibold leading-tight sm:text-4xl">
          SupaPlan • Franchize status board (human-first)
        </h1>
        <p className="relative mt-3 max-w-4xl text-sm text-slate-200 sm:text-base">
          Сопоставили клиентские идеи и текущий SupaPlan. Здесь видно, какие эпики уже закрыты, какие в работе и где пора декомпозировать в более мелкие задачи во время реализации.
        </p>

        <div className="relative mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <Link
            href="/supaplan"
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" /> Назад в общий SupaPlan
          </Link>
          <Link
            href="/nexus"
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 hover:bg-white/15"
          >
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
              <CardDescription className="text-xs text-slate-400">
                {STATUS_LABEL[status].label}
              </CardDescription>
              <CardTitle className="text-2xl">{statusTotals[status]}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* ---- Progress bar ---- */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Timer className="h-4 w-4 text-emerald-300" /> Прогресс ({progressPercent}%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Выполнено: <span className="font-semibold text-emerald-300">{statusTotals.done}/{tasks.length}</span> задач. Осталось критических:{" "}
            <span className="font-semibold text-rose-400">{totalPending}</span>.
          </p>
        </CardContent>
      </Card>

      {/* 🔥 TOP-5 PRIORITY SECTION */}
      <section>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadPriority}
          disabled={isPriorityLoading}
          className="mb-2 gap-2 bg-amber-900/20 text-amber-300 border-amber-500/40 hover:bg-amber-900/30"
        >
          {isPriorityLoading ? (
            <span className="flex items-center gap-1">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              Считаю...
            </span>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Загрузить ТОП-5 приоритетных задач
            </>
          )}
        </Button>

        {showPriority && priorityTasks.length > 0 && (
          <Card className="border-amber-500/50 bg-gradient-to-br from-amber-950/60 to-slate-950 text-slate-100 shadow shadow-amber-500/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-amber-300">
                  <Flame className="h-5 w-5" /> ТОП-5 критических задач
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPriority(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Скрыть
                </Button>
              </div>
              <CardDescription className="text-slate-400">
                Умная сортировка: статус × фаза × важность способности. Обнови в любой момент.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {priorityTasks.map((pt) => {
                const taskMeta = STATUS_LABEL[pt.status as TaskStatus] || STATUS_LABEL.open;
                const fullTask = tasks.find((t) => t.id === pt.id);
                return (
                  <div key={pt.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
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
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                        {pt.score}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{pt.reasoning}</p>
                    {fullTask?.todo_path && (
                      <p className="mt-1 text-xs text-slate-500">todo_path: {fullTask.todo_path}</p>
                    )}
                    <div className="mt-2">
                      <Link
                        href={`/supaplan?task=${pt.id}`}
                        className="inline-flex items-center gap-1 text-xs text-cyan-300 underline underline-offset-2"
                      >
                        Перейти к задаче →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ---- Global expand/collapse ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExpandAll} className="text-xs">
          Развернуть всё
        </Button>
        <Button variant="outline" size="sm" onClick={handleCollapseAll} className="text-xs">
          Свернуть всё
        </Button>
        <span className="ml-auto text-xs text-slate-400">Фазы упорядочены по критичности</span>
      </div>

      {/* ---- Phase → Capability → Task tree ---- */}
      <div className="space-y-3">
        {phaseData.map(([phase, { capabilities }]) => {
          const phaseExpanded = expandedPhases.has(phase);
          // Calculate undone tasks and total tasks in this phase
          const { undone: phaseUndone, total: phaseTotal } = capabilities.reduce(
            (acc, cap) => {
              const capTasks = capabilityTaskMap.get(cap) || [];
              acc.undone += capTasks.filter((t) => t.status !== "done").length;
              acc.total += capTasks.length;
              return acc;
            },
            { undone: 0, total: 0 }
          );
          // Only show fully done badge if there are tasks and none are undone
          const isPhaseFullyDone = phaseTotal > 0 && phaseUndone === 0;
          const phaseHasAnyTasks = phaseTotal > 0;

          return (
            <Card
              key={phase}
              id={`phase-${phase}`}
              className={`border-slate-800/70 bg-slate-950 text-slate-100 scroll-mt-28 ${
                isPhaseFullyDone ? "ring-1 ring-emerald-500/30" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => togglePhase(phase)}
                className="flex w-full items-center justify-between p-3 sm:p-4 text-left"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {phaseExpanded ? (
                    <ChevronDown className="h-5 w-5 text-cyan-300 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-cyan-300 flex-shrink-0" />
                  )}
                  <h2 className="text-lg font-semibold uppercase tracking-wide">{phase}</h2>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                      {capabilities.length} идеи
                    </Badge>
                    {phaseHasAnyTasks && phaseUndone > 0 && (
                      <Badge className="bg-rose-500/20 text-rose-300 text-xs">
                        {phaseUndone} не завершено
                      </Badge>
                    )}
                    {isPhaseFullyDone && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">
                        Все сделано ✓
                      </Badge>
                    )}
                  </div>
                </div>
                {phaseHasAnyTasks && (
                  <span className="text-xs text-slate-400">
                    {phaseTotal - phaseUndone}/{phaseTotal}
                  </span>
                )}
              </button>

              {phaseExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {capabilities.map((cap) => {
                      const capTasks = capabilityTaskMap.get(cap) || [];
                      const idea = capabilityIdeaMap.get(cap);
                      const capExpanded = expandedCapabilities.has(cap);
                      const doneCount = capTasks.filter((t) => t.status === "done").length;
                      const allDone = capTasks.length > 0 && doneCount === capTasks.length;
                      const worstStatus = capTasks.length
                        ? capTasks.reduce((worst, t) =>
                            statusUrgency(t.status) < statusUrgency(worst) ? t.status : worst
                          , capTasks[0].status)
                        : "open";
                      const worstMeta = STATUS_LABEL[worstStatus as TaskStatus] || STATUS_LABEL.open;

                      return (
                        <div key={cap} className="rounded-xl border border-slate-800 bg-slate-900/70">
                          <button
                            type="button"
                            onClick={() => toggleCapability(cap)}
                            className="flex w-full items-center justify-between p-3 text-left"
                          >
                            <div className="flex items-center gap-2">
                              {capExpanded ? (
                                <ChevronDown className="h-4 w-4 text-amber-300 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-amber-300 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium">{idea?.idea || cap}</span>
                              {allDone && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={worstMeta.className}>{worstMeta.label}</Badge>
                              <span className="text-xs text-slate-400">
                                {doneCount}/{capTasks.length}
                              </span>
                            </div>
                          </button>

                          {capExpanded && (
                            <div className="border-t border-slate-800 px-3 pb-3 pt-2">
                              {idea && (
                                <div className="mb-2 text-xs text-slate-400">
                                  <p className="text-slate-300">{idea.note}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {idea.routes.map((r) => (
                                      <code
                                        key={r}
                                        className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-cyan-300"
                                      >
                                        {r}
                                      </code>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {capTasks.length === 0 ? (
                                <p className="flex items-center gap-1 text-xs text-amber-300">
                                  <AlertCircle className="h-3.5 w-3.5" /> Нет задач – нужно создать.
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {capTasks
                                    .sort((a, b) => statusUrgency(a.status) - statusUrgency(b.status))
                                    .map((task) => {
                                      const taskExpanded = expandedTasks.has(task.id);
                                      const taskMeta =
                                        STATUS_LABEL[task.status as TaskStatus] || STATUS_LABEL.open;
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
                                                <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                              ) : (
                                                <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                              )}
                                              <span className="text-sm text-slate-200">{task.title}</span>
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
                                                <p className="text-slate-300">{task.body}</p>
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

      {/* ---- Collapsible Board Legend ---- */}
      <div className="mt-8 border-t border-slate-800 pt-4">
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
            {/* Task types */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Типы задач
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(TASK_TYPE_DESCRIPTIONS).map(([type, desc]) => (
                  <div
                    key={type}
                    className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-3"
                  >
                    <strong className="text-slate-200">{type}</strong>
                    <p className="text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Statuses */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Статусы задач
              </h4>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((status) => (
                  <Badge
                    key={status}
                    className={`${STATUS_LABEL[status].className} text-xs`}
                  >
                    {STATUS_LABEL[status].label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Priority formula */}
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Приоритет (ТОП-5)
              </h4>
              <p className="text-slate-400">
                <code className="rounded bg-slate-800 px-1 text-cyan-300">статус (Open=10, …, Ready for PR=3)</code> ×{" "}
                <code className="rounded bg-slate-800 px-1 text-cyan-300">фаза (Апрель=1.5 … 2027=0.7)</code> ×{" "}
                <code className="rounded bg-slate-800 px-1 text-cyan-300">важность способности (0.7‑1.4)</code> +{" "}
                <code className="rounded bg-slate-800 px-1 text-cyan-300">бонус за возраст (+0.5 если старше 7 дней)</code>
              </p>
            </div>

            {/* Phases */}
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Фазы (дорожная карта)
              </h4>
              <p className="text-slate-400">
                {PHASE_ORDER.join(" → ")} – фазы упорядочены по количеству незавершённых задач.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ---- Runtime checks ---- */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wrench className="h-4 w-4 text-cyan-300" /> Runtime checks
          </CardTitle>
          <CardDescription className="text-slate-400">
            Текущая выборка из supaplan_tasks (capability like `franchize.%`).
          </CardDescription>
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