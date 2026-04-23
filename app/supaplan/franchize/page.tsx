import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock3,
  Layers3,
  Milestone,
  Rocket,
  Timer,
  Wrench,
  AlertTriangle,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabaseAdmin } from "@/hooks/supabase";
import { Progress } from "@/components/ui/progress";

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
  phase: "Апрель" | "Май" | "Июнь" | "Лето" | "2027";
  taskType: "R1 Contract" | "R2 Integration" | "R3 Ops UX" | "R4 Growth";
  routes: string[];
  note: string;
  decompositionHint: string;
  isCritical?: boolean; // New: highlight launch blockers
};

const STATUS_LABEL: Record<TaskStatus, { label: string; className: string; icon?: React.ReactNode }> = {
  open: { label: "Открыто", className: "bg-sky-500/15 text-sky-300 border-sky-400/30" },
  claimed: { label: "В работе", className: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30" },
  running: { label: "Выполняется", className: "bg-amber-500/15 text-amber-300 border-amber-400/30" },
  ready_for_pr: { label: "Готово к PR", className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30" },
  done: { label: "Завершено", className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" },
};

const PHASE_ORDER: IdeaRow["phase"][] = ["Апрель", "Май", "Июнь", "Лето", "2027"];

const IDEA_MAP: IdeaRow[] = [
  // ... (your existing ideas remain, with critical flags added where relevant)
  {
    idea: "Аренда: каталог, доступность, календарь и договор",
    capability: "franchize.rental",
    phase: "Апрель",
    taskType: "R1 Contract",
    routes: ["/franchize/vip-bike/market", "/rent-bike"],
    note: "VIN + финализация договора + doc-verifier + календарь (P0 blockers)",
    decompositionHint: "Спаунить subtasks: availability sync, VIN CRUD, markdown-doc attach.",
    isCritical: true,
  },
  // ... keep the rest of your IDEA_MAP
  // New critical ones from audit are matched via capability or title in runtime
];

function byStatusWeight(status: string): number {
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
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

function getPriorityBadge(taskTitle: string, status: string) {
  const lower = taskTitle.toLowerCase();
  if (lower.includes("p0") || lower.includes("vin") || lower.includes("contract") || lower.includes("booking") || lower.includes("notification")) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-400/30">P0 — Блокер запуска</Badge>;
  }
  if (lower.includes("p1") || status === "running" || status === "ready_for_pr") {
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-400/30">Высокий приоритет</Badge>;
  }
  return null;
}

export default async function SupaPlanFranchizePage() {
  const { data, error } = await supabaseAdmin
    .from("supaplan_tasks")
    .select("id,title,body,capability,status,todo_path,created_at,updated_at,pr_url")
    .or("capability.like.franchize.%,capability.eq.greenbox.franchize")
    .order("updated_at", { ascending: false });

  const tasks: FranchizeTask[] = (data as FranchizeTask[] | null) ?? [];

  const capabilityMap = new Map<string, FranchizeTask[]>();
  tasks.forEach((task) => {
    if (!task.capability) return;
    const prev = capabilityMap.get(task.capability) ?? [];
    prev.push(task);
    capabilityMap.set(task.capability, prev);
  });

  const statusTotals = tasks.reduce((acc, task) => {
    const key = (task.status as TaskStatus) || "open";
    if (key in acc) acc[key as keyof typeof acc] += 1;
    return acc;
  }, { open: 0, claimed: 0, running: 0, ready_for_pr: 0, done: 0 });

  const totalTasks = tasks.length;
  const progressPercent = totalTasks ? Math.round((statusTotals.done / totalTasks) * 100) : 0;

  // Highlight critical P0 tasks from audit
  const criticalTasks = tasks.filter(t => 
    t.title.toLowerCase().includes("p0") || 
    t.title.toLowerCase().includes("vin") || 
    t.title.toLowerCase().includes("contract") ||
    t.title.toLowerCase().includes("booking") ||
    t.title.toLowerCase().includes("notification")
  );

  const roadmapByPhase = PHASE_ORDER.map((phase) => ({
    phase,
    items: IDEA_MAP.filter((row) => row.phase === phase),
  })).filter((phaseBlock) => phaseBlock.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-3 py-6 sm:px-6 lg:px-8">
      {/* Hero with strong launch warning */}
      <section className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-br from-slate-950 via-red-950/40 to-slate-950 p-8 text-white shadow-2xl">
        <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
        <Badge className="mb-4 border-red-400/50 bg-red-500/10 text-red-400">VIP BIKE — Апрель 2026 Launch</Badge>
        
        <h1 className="text-4xl font-bold tracking-tight">Franchize Control Deck • VIP Bike</h1>
        <p className="mt-3 max-w-3xl text-lg text-slate-300">
          Критические блокеры аренды (P0) выделены красным. 
          Фокус — завершить rental flow до конца апреля.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/supaplan" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 hover:bg-white/15">
            ← Общий SupaPlan
          </Link>
          <Link href="/franchize/vip-bike" className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-emerald-300 hover:bg-emerald-500/20">
            <Bike className="h-4 w-4" /> Открыть VIP Bike
          </Link>
        </div>
      </section>

      {/* Critical P0 Banner */}
      {criticalTasks.length > 0 && (
        <Card className="border-red-500/50 bg-red-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6" />
              P0 — Блокеры запуска аренды (Апрель)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {criticalTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="rounded-xl border border-red-500/30 bg-slate-950/70 p-4">
                  <p className="font-medium text-red-300">{task.title}</p>
                  <Badge className={STATUS_LABEL[task.status as TaskStatus]?.className || ""}>
                    {STATUS_LABEL[task.status as TaskStatus]?.label || task.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status KPIs */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(["open", "claimed", "running", "ready_for_pr", "done"] as TaskStatus[]).map((status) => (
          <Card key={status} className="border-slate-800/70 bg-slate-950 text-slate-100">
            <CardHeader className="pb-2">
              <CardDescription>{STATUS_LABEL[status].label}</CardDescription>
              <CardTitle className="text-4xl font-semibold">{statusTotals[status]}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* Overall Progress */}
      <Card className="border-emerald-500/30 bg-slate-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-400" /> Прогресс запуска VIP Bike
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercent} className="h-3" />
          <p className="text-center text-sm text-emerald-300">
            {progressPercent}% выполнено • {statusTotals.done} / {totalTasks} задач
          </p>
        </CardContent>
      </Card>

      {/* Roadmap by Phase with priority highlights */}
      {roadmapByPhase.map((phase) => (
        <section key={phase.phase} className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-100">{phase.phase}</h2>
            {phase.phase === "Апрель" && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Критическая фаза</Badge>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {phase.items.map((row) => {
              const related = capabilityMap.get(row.capability) ?? [];
              const sorted = [...related].sort((a, b) => byStatusWeight(b.status) - byStatusWeight(a.status));
              const bestStatus = sorted[0]?.status ?? "open";
              const meta = STATUS_LABEL[bestStatus as TaskStatus] ?? STATUS_LABEL.open;

              return (
                <Card key={row.capability} className={`border-slate-700/70 bg-slate-950 ${row.isCritical ? "border-red-500/50" : ""}`}>
                  <CardHeader>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{row.taskType}</Badge>
                      <Badge variant="outline">{row.phase}</Badge>
                      <Badge variant="outline" className="border-amber-400/30 text-amber-300">{row.capability}</Badge>
                      <Badge className={meta.className}>{meta.label}</Badge>
                      {row.isCritical && <Badge className="bg-red-500/20 text-red-400">Блокер</Badge>}
                    </div>
                    <CardTitle className="text-xl">{row.idea}</CardTitle>
                    <CardDescription>{row.note}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Related SupaPlan tasks */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                      <p className="mb-3 text-xs uppercase tracking-widest text-slate-400">Связанные задачи SupaPlan</p>
                      {sorted.length === 0 ? (
                        <p className="text-amber-300 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" /> Нет задач — добавить в backlog
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {sorted.map((task) => (
                            <div key={task.id} className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium">{task.title}</p>
                                  {task.todo_path && <p className="text-[10px] text-slate-500 mt-1">todo: {task.todo_path}</p>}
                                </div>
                                <Badge className={STATUS_LABEL[task.status as TaskStatus]?.className || ""}>
                                  {STATUS_LABEL[task.status as TaskStatus]?.label || task.status}
                                </Badge>
                              </div>
                              {getPriorityBadge(task.title, task.status)}
                              {task.pr_url && (
                                <a href={task.pr_url} target="_blank" className="text-cyan-400 text-xs underline mt-2 block">
                                  PR → {task.pr_url.split("/").pop()}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {/* Runtime info */}
      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-cyan-300" /> Статус системы
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><CheckCircle2 className="inline h-4 w-4 text-emerald-400" /> Задач: {totalTasks}</p>
          <p><Clock3 className="inline h-4 w-4 text-cyan-400" /> Обновлено: {new Date().toLocaleString("ru-RU")}</p>
          {criticalTasks.length > 0 && (
            <p className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {criticalTasks.length} критических блокеров требуют внимания
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}