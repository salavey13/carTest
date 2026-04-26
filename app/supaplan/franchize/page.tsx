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

const PHASE_COLORS: Record<string, string> = {
  "launch-blocker": "border-l-red-500 text-red-300",
  "launch-quality": "border-l-amber-500 text-amber-300",
  "security": "border-l-orange-500 text-orange-300",
  "performance": "border-l-cyan-500 text-cyan-300",
  "polishing": "border-l-emerald-500 text-emerald-300",
  "ux-fix": "border-l-pink-500 text-pink-300",
  "seo": "border-l-blue-500 text-blue-300",
  "code-quality": "border-l-slate-500 text-slate-300",
  "tech-debt": "border-l-gray-500 text-gray-300",
  "post-launch": "border-l-purple-500 text-purple-300",
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

function extractPhase(task: FranchizeTask): string {
  try {
    const meta = task.metadata;
    if (!meta) return "no-phase";
    const parsed = typeof meta === "string" ? JSON.parse(meta) : meta;
    return parsed.phase || "no-phase";
  } catch {
    return "no-phase";
  }
}

/* -------------------------------------------------------------------------- */
/*  Page Component                                                            */
/* -------------------------------------------------------------------------- */

export default function FranchizeStatusPage() {
  const [tasks, setTasks] = useState<FranchizeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const [legendOpen, setLegendOpen] = useState(false);

  const [priorityTasks, setPriorityTasks] = useState<PriorityTask[]>([]);
  const [isPriorityLoading, startPriorityTransition] = useTransition();
  const [showPriority, setShowPriority] = useState(false);

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

  // Derived stats
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

  // Group tasks by phase (from metadata) then by capability
  const phaseData = useMemo(() => {
    const phaseMap = new Map<string, Map<string, FranchizeTask[]>>();
    tasks.forEach((task) => {
      const phase = extractPhase(task);
      const cap = task.capability || "unknown";
      if (!phaseMap.has(phase)) phaseMap.set(phase, new Map());
      const capMap = phaseMap.get(phase)!;
      if (!capMap.has(cap)) capMap.set(cap, []);
      capMap.get(cap)!.push(task);
    });

    // Sort phases: launch-blocker first, then by total undone tasks
    const order = [
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
      "no-phase",
    ];
    const sortedPhases = [...phaseMap.entries()].sort((a, b) => {
      const idxA = order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0]);
      const idxB = order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0]);
      if (idxA !== idxB) return idxA - idxB;
      // then by undone task count
      const undoneA = [...a[1].values()].flat().filter((t) => t.status !== "done").length;
      const undoneB = [...b[1].values()].flat().filter((t) => t.status !== "done").length;
      return undoneB - undoneA;
    });
    return sortedPhases;
  }, [tasks]);

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
      {/* ---- Mobile sticky bar ---- */}
      <div className="sticky top-16 z-30 -mx-3 -mt-4 mb-4 flex items-center justify-between gap-2 rounded-b-2xl border-b border-slate-200/40 bg-white/90 px-3 py-2 shadow backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/90 sm:hidden">
        <div className="flex items-center gap-2 text-xs">
          <Flame className="h-4 w-4 text-rose-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {totalPending} критических
          </span>
          <span className="text-slate-400 dark:text-slate-500">|</span>
          <span className="text-emerald-600 dark:text-emerald-400">{statusTotals.done} сделано</span>
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

      {/* ---- Hero Section (overhauled) ---- */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-2xl">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative z-10 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300">
              <Badge className="border-cyan-400/40 bg-cyan-400/20 text-cyan-100">FRANCHIZE CONTROL DECK</Badge>
              <span>vip-bike crew</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-cyan-400 via-amber-300 to-fuchsia-400 bg-clip-text text-transparent">
                SupaPlan • Franchize
              </span>
              <br />
              <span className="text-2xl sm:text-3xl">Live Status Board</span>
            </h1>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              Мгновенный срез по всем эпикам. Приоритеты, фазы, критические задачи — всё под рукой.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/supaplan" className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs hover:bg-white/15">
                <ArrowLeft className="h-4 w-4" /> Общий SupaPlan
              </Link>
              <Link href="/nexus" className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs hover:bg-white/15">
                <Rocket className="h-4 w-4" /> Nexus
              </Link>
              <Link href="/franchize/vip-bike/map-riders" className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs hover:bg-white/15">
                <Bike className="h-4 w-4" /> Map Riders
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-cyan-400 drop-shadow-[0_0_6px_#22d3ee]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercent}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-2xl font-bold text-cyan-300">{progressPercent}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Status cards ---- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["open", "claimed", "running", "ready_for_pr", "done"] as TaskStatusProp[]).map((status) => (
          <Card key={status} className="border-slate-800/70 bg-slate-950 text-slate-100">
            <CardHeader className="space-y-1 pb-1">
              <CardDescription className="text-xs text-slate-400">{STATUS_LABEL[status].label}</CardDescription>
              <CardTitle className="text-2xl">{statusTotals[status]}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* ---- Progress bar ---- */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardContent className="pt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Выполнено: <span className="font-semibold text-emerald-300">{statusTotals.done}/{tasks.length}</span> задач. Осталось критических:{" "}
            <span className="font-semibold text-rose-400">{totalPending}</span>.
          </p>
        </CardContent>
      </Card>

      {/* 🔥 Top-5 priority */ }
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
              ТОП-5 приоритетных задач (AI‑ранжирование)
            </>
          )}
        </Button>

        {showPriority && priorityTasks.length > 0 && (
          <Card className="border-amber-500/50 bg-gradient-to-br from-amber-950/60 to-slate-950 text-slate-100 shadow-lg shadow-amber-500/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-amber-300">
                  <Flame className="h-5 w-5" /> ТОП-5 критических задач
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowPriority(false)} className="text-slate-400 hover:text-slate-200">
                  Скрыть
                </Button>
              </div>
              <CardDescription className="text-slate-400">
                Формула: статус × фаза × важность способности × приоритет × свежесть + быстрые победы.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {priorityTasks.map((pt) => {
                const taskMeta = STATUS_LABEL[pt.status as TaskStatusProp] || STATUS_LABEL.open;
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

      {/* ---- Phase → Capability → Task tree ---- */}
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
                className="flex w-full items-center justify-between p-3 sm:p-4 text-left"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {phaseExpanded ? (
                    <ChevronDown className="h-5 w-5 text-cyan-300 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-cyan-300 flex-shrink-0" />
                  )}
                  <h2 className="text-lg font-semibold capitalize">{phase}</h2>
                  {total > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                        {capMap.size} способности
                      </Badge>
                      {undone > 0 && (
                        <Badge className="bg-rose-500/20 text-rose-300 text-xs">{undone} не завершено</Badge>
                      )}
                      {fullyDone && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">все сделано ✓</Badge>
                      )}
                    </div>
                  )}
                </div>
                {total > 0 && (
                  <span className="text-xs text-slate-400">
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
                            statusUrgency(t.status) < statusUrgency(worst) ? t.status : worst
                          , capTasks[0].status)
                        : "open";
                      const worstMeta = STATUS_LABEL[worstStatus as TaskStatusProp] || STATUS_LABEL.open;
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
                              <span className="text-sm font-medium">{cap}</span>
                              {allDone && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
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
                              {capTasks.length === 0 ? (
                                <p className="text-xs text-amber-300">Нет задач</p>
                              ) : (
                                <ul className="space-y-2">
                                  {capTasks
                                    .sort((a, b) => statusUrgency(a.status) - statusUrgency(b.status))
                                    .map((task) => {
                                      const taskExpanded = expandedTasks.has(task.id);
                                      const taskMeta = STATUS_LABEL[task.status as TaskStatusProp] || STATUS_LABEL.open;
                                      return (
                                        <li key={task.id} className="rounded border border-slate-700/70 bg-slate-950/70 p-2">
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
                                            <Badge className={taskMeta.className}>{taskMeta.label}</Badge>
                                          </button>
                                          {taskExpanded && (
                                            <div className="mt-2 space-y-1 pl-5 text-xs text-slate-400">
                                              <p>ID: {task.id}</p>
                                              {task.todo_path && <p>todo_path: {task.todo_path}</p>}
                                              <p>updated_at (UTC): {formatIso(task.updated_at)}</p>
                                              {task.body && (
                                                <p className="max-w-lg truncate text-slate-300">{task.body}</p>
                                              )}
                                              {task.pr_url && (
                                                <a className="text-cyan-300 underline underline-offset-2" href={task.pr_url} target="_blank" rel="noreferrer">
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

      {/* ---- Legend (overhauled) ---- */}
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
                {Object.entries(PHASE_COLORS).map(([p, cls]) => (
                  <Badge key={p} className={`border-l-2 bg-slate-800/50 ${cls}`}>
                    {p}
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

      {/* ---- Runtime checks ---- */}
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
    </div>
  );
}