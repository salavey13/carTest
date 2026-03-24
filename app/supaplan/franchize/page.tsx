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
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabaseAdmin } from "@/hooks/supabase";

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
};

const STATUS_LABEL: Record<TaskStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-sky-500/15 text-sky-300 border-sky-400/30" },
  claimed: { label: "Claimed", className: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30" },
  running: { label: "Running", className: "bg-amber-500/15 text-amber-300 border-amber-400/30" },
  ready_for_pr: { label: "Ready for PR", className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30" },
  done: { label: "Done", className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" },
};

const PHASE_ORDER: IdeaRow["phase"][] = ["Апрель", "Май", "Июнь", "Лето", "2027"];

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
];

function byStatusWeight(status: string): number {
  switch (status) {
    case "done":
      return 4;
    case "ready_for_pr":
      return 3;
    case "running":
      return 2;
    case "claimed":
      return 1;
    default:
      return 0;
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

  const statusTotals = tasks.reduce(
    (acc, task) => {
      const key = task.status as TaskStatus;
      if (key in acc) {
        acc[key] += 1;
      }
      return acc;
    },
    { open: 0, claimed: 0, running: 0, ready_for_pr: 0, done: 0 }
  );

  const progressPercent = tasks.length ? Math.round((statusTotals.done / tasks.length) * 100) : 0;

  const roadmapByPhase = PHASE_ORDER.map((phase) => ({
    phase,
    items: IDEA_MAP.filter((row) => row.phase === phase),
  })).filter((phaseBlock) => phaseBlock.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
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

      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Milestone className="h-4 w-4 text-cyan-300" /> Legend — типы задач и статусов
          </CardTitle>
          <CardDescription className="text-slate-400">Легенда по слоям задач и приоритету детализации эпиков.</CardDescription>
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

      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Layers3 className="h-4 w-4 text-amber-300" /> Epic decomposition cues
          </CardTitle>
          <CardDescription className="text-slate-400">Текущие задачи в основном как эпики — при старте реализации спаунить дочерние subtasks.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm lg:grid-cols-2">
          {IDEA_MAP.map((row) => (
            <div key={`${row.capability}-decomp`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="font-medium text-slate-100">{row.capability}</p>
              <p className="mt-1 text-slate-300">{row.decompositionHint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Timer className="h-4 w-4 text-emerald-300" /> План по фазам: апрель → 2027
          </CardTitle>
          <CardDescription className="text-slate-400">Покрытие текущих идей из брифа с маршрутом в SupaPlan и деталями задач.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-sm text-slate-300">
            Выполнено: <span className="font-semibold text-emerald-300">{progressPercent}%</span> ({statusTotals.done}/{tasks.length}) franchize-задач.
          </p>
        </CardContent>
      </Card>

      {roadmapByPhase.map((phase) => (
        <section key={phase.phase} className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">{phase.phase}</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {phase.items.map((row) => {
              const related = capabilityMap.get(row.capability) ?? [];
              const sorted = [...related].sort((a, b) => byStatusWeight(b.status) - byStatusWeight(a.status));
              const bestStatus = sorted[0]?.status ?? "open";
              const isKnown = bestStatus in STATUS_LABEL;
              const meta = isKnown ? STATUS_LABEL[bestStatus as TaskStatus] : STATUS_LABEL.open;

              return (
                <Card key={`${row.capability}-${row.idea}`} className="border-slate-800/70 bg-slate-950 text-slate-100">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {row.taskType}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {row.phase}
                      </Badge>
                      <Badge variant="outline" className="border-amber-400/30 text-amber-300">
                        {row.capability}
                      </Badge>
                      <Badge className={meta.className}>{isKnown ? STATUS_LABEL[bestStatus as TaskStatus].label : bestStatus}</Badge>
                    </div>
                    <CardTitle className="text-lg">{row.idea}</CardTitle>
                    <CardDescription className="text-slate-400">{row.note}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Связанные маршруты</p>
                      <div className="flex flex-wrap gap-2">
                        {row.routes.map((route) => (
                          <code key={route} className="rounded bg-slate-900 px-2 py-1 text-xs text-cyan-300">
                            {route}
                          </code>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">SupaPlan task details</p>
                      {sorted.length === 0 ? (
                        <p className="flex items-center gap-2 text-amber-300">
                          <AlertCircle className="h-4 w-4" /> Нет задач по capability — нужно добавить в SupaPlan backlog.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {sorted.map((task) => {
                            const status = task.status in STATUS_LABEL ? STATUS_LABEL[task.status as TaskStatus] : STATUS_LABEL.open;
                            return (
                              <li key={task.id} className="rounded border border-slate-700/70 bg-slate-950/70 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-slate-200">{task.title}</p>
                                  <Badge className={status.className}>{status.label}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-slate-400">task_id: {task.id}</p>
                                {task.todo_path ? <p className="text-xs text-slate-500">todo_path: {task.todo_path}</p> : null}
                                <p className="text-xs text-slate-500">updated_at (UTC): {formatIso(task.updated_at)}</p>
                                {task.body ? <p className="text-xs text-slate-400">{task.body}</p> : null}
                                {task.pr_url ? (
                                  <a className="text-xs text-cyan-300 underline underline-offset-2" href={task.pr_url} target="_blank" rel="noreferrer">
                                    PR: {task.pr_url}
                                  </a>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wrench className="h-4 w-4 text-cyan-300" /> Runtime checks
          </CardTitle>
          <CardDescription className="text-slate-400">Текущая выборка из supaplan_tasks (фильтр capability like `franchize.%`).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          {error ? (
            <p className="flex items-center gap-2 text-rose-300">
              <AlertCircle className="h-4 w-4" /> Ошибка загрузки SupaPlan: {error.message}
            </p>
          ) : (
            <>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Задач найдено: {tasks.length}
              </p>
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-cyan-300" /> Обновлено по данным Supabase: {new Date().toISOString()}
              </p>
              <p className="flex items-center gap-2 text-amber-300">
                <AlertCircle className="h-4 w-4" /> vip-cross currently planned as separate crew stream; next step is SQL seed by analogy with vip-bike.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
