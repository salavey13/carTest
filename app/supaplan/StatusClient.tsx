"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";

import { notifyTaskPickInTelegram } from "./actions";
import { useAppContext } from "@/contexts/AppContext";

type KnownSupaPlanStatus = "open" | "claimed" | "running" | "ready_for_pr" | "done";

type SupaPlanTask = {
  id: string;
  title: string;
  status: string;
  todo_path: string | null;
  capability: string | null;
  created_at: string;
};

type SupaPlanEvent = {
  id: number;
  created_at: string;
  source: string | null;
  type: string;
  payload: Record<string, unknown> | null;
};

const STATUS_META: Record<KnownSupaPlanStatus, { label: string; className: string; cardClass: string }> = {
  open: {
    label: "Открыта",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    cardClass: "border-sky-300/70 dark:border-sky-500/40",
  },
  claimed: {
    label: "Забрана",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    cardClass: "border-indigo-300/70 dark:border-indigo-500/40",
  },
  running: {
    label: "В работе",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    cardClass: "border-amber-300/70 dark:border-amber-500/40",
  },
  ready_for_pr: {
    label: "Готова к ПР",
    className: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
    cardClass: "border-fuchsia-300/70 dark:border-fuchsia-500/40",
  },
  done: {
    label: "Сделана",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    cardClass: "border-emerald-300/70 dark:border-emerald-500/40",
  },
};

const UNKNOWN_STATUS_META = {
  label: "Неизвестно",
  className: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  cardClass: "border-rose-300/70 dark:border-rose-500/40",
};

const ACTIVE_STATUSES: KnownSupaPlanStatus[] = ["open", "claimed", "running", "ready_for_pr"];

function isKnownStatus(status: string): status is KnownSupaPlanStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_META, status);
}

function getStatusMeta(status: string) {
  if (isKnownStatus(status)) {
    return STATUS_META[status];
  }

  return {
    label: `${UNKNOWN_STATUS_META.label}: ${status}`,
    className: UNKNOWN_STATUS_META.className,
    cardClass: UNKNOWN_STATUS_META.cardClass,
  };
}

function formatPayload(payload: Record<string, unknown> | null): string {
  if (!payload) {
    return "Без нагрузки";
  }

  const summary = payload.summary;
  const note = payload.note;

  if (typeof summary === "string" && summary.trim()) {
    return summary;
  }

  if (typeof note === "string" && note.trim()) {
    return note;
  }

  return JSON.stringify(payload);
}

export default function StatusClient() {
  const [tasks, setTasks] = useState<SupaPlanTask[]>([]);
  const [events, setEvents] = useState<SupaPlanEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState<KnownSupaPlanStatus | "all">("all");
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventSourceFilter, setEventSourceFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [taskView, setTaskView] = useState<"pipeline" | "done">("pipeline");
  const [mobileStatus, setMobileStatus] = useState<KnownSupaPlanStatus>("open");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<{ taskId: string; message: string; kind: "ok" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const { dbUser, user } = useAppContext();

  const hasSupabaseEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const recipientChatId = useMemo(() => {
    const fromDb = (dbUser as { chat_id?: string | number } | null)?.chat_id;
    const fromTelegram = user?.id;
    const candidate = fromDb ?? fromTelegram;
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    return String(candidate);
  }, [dbUser, user?.id]);

  const supabase = useMemo(() => {
    if (!hasSupabaseEnv) {
      return null;
    }

    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
  }, [hasSupabaseEnv]);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoadError("Отсутствуют NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY");
      setTasks([]);
      setEvents([]);
      return;
    }

    const [{ data: taskData, error: taskError }, { data: eventData, error: eventError }] = await Promise.all([
      supabase.from("supaplan_tasks").select("id,title,status,todo_path,capability,created_at").order("created_at", { ascending: true }),
      supabase.from("supaplan_events").select("id,created_at,source,type,payload").order("created_at", { ascending: false }).limit(25),
    ]);

    if (taskError || eventError) {
      setLoadError(taskError?.message ?? eventError?.message ?? "Не удалось загрузить данные СупаПлана");
      return;
    }

    setTasks((taskData as SupaPlanTask[]) || []);
    setEvents((eventData as SupaPlanEvent[]) || []);
    setLoadError(null);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    load();

    const tasksChannel = supabase
      .channel("supaplan_tasks")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supaplan_tasks",
        },
        () => load()
      )
      .subscribe();

    const eventsChannel = supabase
      .channel("supaplan_events")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supaplan_events",
        },
        () => load()
      )
      .subscribe();

    return () => {
      tasksChannel.unsubscribe();
      eventsChannel.unsubscribe();
    };
  }, [load, supabase]);

  const statusCounts = useMemo(() => {
    return tasks.reduce<Record<KnownSupaPlanStatus, number>>(
      (acc, task) => {
        if (isKnownStatus(task.status)) {
          acc[task.status] += 1;
        }
        return acc;
      },
      {
        open: 0,
        claimed: 0,
        running: 0,
        ready_for_pr: 0,
        done: 0,
      }
    );
  }, [tasks]);

  const capabilities = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.capability).filter((cap): cap is string => Boolean(cap)))).sort();
  }, [tasks]);

  const eventSources = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.source).filter((source): source is string => Boolean(source)))).sort();
  }, [events]);

  const eventTypes = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.type).filter(Boolean))).sort();
  }, [events]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      if (activeFilter !== "all" && task.status !== activeFilter) {
        return false;
      }

      if (capabilityFilter !== "all" && task.capability !== capabilityFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [task.title, task.todo_path, task.id, task.capability]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [activeFilter, capabilityFilter, searchQuery, tasks]);

  const activeTasks = useMemo(() => filteredTasks.filter((task) => task.status !== "done"), [filteredTasks]);

  const doneTasks = useMemo(() => {
    return filteredTasks.filter((task) => task.status === "done").sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [filteredTasks]);

  const pipelineColumns = useMemo(() => {
    return ACTIVE_STATUSES.map((status) => ({
      status,
      tasks: activeTasks.filter((task) => task.status === status),
    }));
  }, [activeTasks]);

  const mobileTasks = useMemo(() => {
    return activeTasks.filter((task) => task.status === mobileStatus);
  }, [activeTasks, mobileStatus]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (eventSourceFilter !== "all" && event.source !== eventSourceFilter) {
        return false;
      }

      if (eventTypeFilter !== "all" && event.type !== eventTypeFilter) {
        return false;
      }

      return true;
    });
  }, [eventSourceFilter, eventTypeFilter, events]);

  const suggestedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === "open")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 3);
  }, [tasks]);

  const handleNotify = useCallback(
    (task: SupaPlanTask) => {
      setNotifState(null);

      startTransition(async () => {
        const result = await notifyTaskPickInTelegram({
          taskId: task.id,
          taskTitle: task.title,
          capability: task.capability,
          todoPath: task.todo_path,
          chatId: recipientChatId,
        });

        if (!result.success) {
          setNotifState({
            taskId: task.id,
            message: result.error ?? "Не удалось отправить уведомление в Телеграм",
            kind: "error",
          });

          return;
        }

        setNotifState({
          taskId: task.id,
          message: recipientChatId ? "Отправлено в чат пользователя" : "Отправлено в админ-чат",
          kind: "ok",
        });
      });
    },
    [recipientChatId]
  );

  const renderTaskCard = useCallback(
    (task: SupaPlanTask, compact = false) => {
      const badge = getStatusMeta(task.status);
      return (
        <article
          key={task.id}
          className={`rounded-xl border bg-white/95 ${compact ? "p-2.5" : "p-3"} shadow-sm transition hover:shadow-md dark:bg-slate-900/60 ${badge.cardClass}`}
        >
          <h3 className={`${compact ? "text-xs" : "text-sm"} font-semibold leading-snug text-slate-900 dark:text-slate-100`}>{task.title}</h3>

          <div className="mt-1.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            {task.capability && (
              <p className="truncate" title={task.capability}>
                <span className="text-slate-500 dark:text-slate-400">Способность:</span> {task.capability}
              </p>
            )}
            {task.todo_path && (
              <p className="break-all">
                <span className="text-slate-500 dark:text-slate-400">Область:</span> {task.todo_path}
              </p>
            )}
            <p className="break-all text-[10px] text-slate-500 dark:text-slate-400">#{task.id}</p>
          </div>

          {(task.status === "open" || task.status === "ready_for_pr") && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleNotify(task)}
                disabled={isPending}
                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отправить в Телеграм
              </button>
              {notifState?.taskId === task.id && (
                <span className={`text-[11px] ${notifState.kind === "ok" ? "text-emerald-500" : "text-rose-500"}`}>{notifState.message}</span>
              )}
            </div>
          )}
        </article>
      );
    },
    [handleNotify, isPending, notifState]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {loadError && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 sm:p-4 sm:text-sm dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200">
          СупаПлан пока не подключился: {loadError}
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {(Object.keys(STATUS_META) as KnownSupaPlanStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveFilter(status)}
            className={`rounded-xl border bg-white/95 p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl sm:p-4 dark:bg-slate-900/50 ${STATUS_META[status].cardClass} ${
              activeFilter === status ? "ring-2 ring-indigo-500 dark:ring-indigo-400" : ""
            }`}
          >
            <div className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300 sm:text-[11px]">{STATUS_META[status].label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50 sm:text-3xl">{statusCounts[status]}</div>
          </button>
        ))}
      </section>

      <section className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <article className="rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-300">Рабочий поток</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 dark:text-slate-100">{statusCounts.open + statusCounts.claimed + statusCounts.running + statusCounts.ready_for_pr}</p>
        </article>
        <article className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Сделано</p>
          <p className="mt-1.5 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{statusCounts.done}</p>
        </article>
        <article className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 p-3 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-950/20">
          <p className="text-[10px] uppercase tracking-wide text-indigo-700 dark:text-indigo-300">События</p>
          <p className="mt-1.5 text-2xl font-semibold text-indigo-900 dark:text-indigo-100">{events.length}</p>
        </article>
      </section>

      <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2.5 shadow-sm sm:gap-3 sm:p-3 dark:border-slate-700/80 dark:bg-slate-900/50 md:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`rounded-full px-3 py-1.5 text-xs transition sm:text-sm ${
            activeFilter === "all"
              ? "bg-slate-900 text-white dark:bg-indigo-500"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          Все задачи ({tasks.length})
        </button>

        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск по названию, ID, способности"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        <select
          value={capabilityFilter}
          onChange={(event) => setCapabilityFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">Все способности</option>
          {capabilities.map((capability) => (
            <option key={capability} value={capability}>
              {capability}
            </option>
          ))}
        </select>

        <p className="self-center text-xs text-slate-600 sm:text-sm dark:text-slate-300">
          Фильтр: <span className="font-medium text-slate-900 dark:text-slate-100">{activeFilter === "all" ? "все" : STATUS_META[activeFilter].label}</span>
        </p>
      </div>

      <section className="grid gap-3 lg:grid-cols-[1.45fr_minmax(0,1fr)] sm:gap-4">
        <div className="min-w-0 space-y-2.5 sm:space-y-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTaskView("pipeline")}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm ${
                  taskView === "pipeline"
                    ? "bg-slate-900 text-white dark:bg-indigo-500"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Рабочий поток
              </button>
              <button
                type="button"
                onClick={() => setTaskView("done")}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm ${
                  taskView === "done"
                    ? "bg-emerald-700 text-white dark:bg-emerald-600"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                }`}
              >
                Архив сделанного ({doneTasks.length})
              </button>
            </div>
          </div>

          {taskView === "pipeline" && (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-sm md:hidden dark:border-slate-700/80 dark:bg-slate-900/50">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {ACTIVE_STATUSES.map((status) => (
                    <button
                      key={`mobile-${status}`}
                      type="button"
                      onClick={() => setMobileStatus(status)}
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        mobileStatus === status
                          ? "bg-slate-900 text-white dark:bg-indigo-500"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {STATUS_META[status].label} ({pipelineColumns.find((column) => column.status === status)?.tasks.length ?? 0})
                    </button>
                  ))}
                </div>

                <div className="mt-2 space-y-2">
                  {mobileTasks.map((task) => renderTaskCard(task, true))}
                  {mobileTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                      В этом статусе пусто.
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden gap-3 md:grid xl:grid-cols-2">
                {pipelineColumns.map(({ status, tasks: columnTasks }) => (
                  <section key={status} className={`rounded-2xl border bg-slate-50/75 p-3 dark:bg-slate-900/30 ${STATUS_META[status].cardClass}`}>
                    <header className="mb-3 flex items-center justify-between gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_META[status].className}`}>{STATUS_META[status].label}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-300">{columnTasks.length}</span>
                    </header>

                    <div className="space-y-2">
                      {columnTasks.map((task) => renderTaskCard(task))}

                      {columnTasks.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                          Пусто.
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          {taskView === "done" && (
            <div className="space-y-2.5 sm:space-y-3">
              {doneTasks.map((task) => {
                const badge = getStatusMeta(task.status);

                return (
                  <article key={task.id} className={`rounded-2xl border bg-white/95 p-3 shadow-sm sm:p-4 dark:bg-slate-900/50 ${badge.cardClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{task.title}</h3>
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2 sm:text-xs dark:text-slate-300">
                      {task.capability && <p>Способность: {task.capability}</p>}
                      <p>Создана: {new Date(task.created_at).toLocaleDateString()}</p>
                      {task.todo_path && <p className="break-all sm:col-span-2">Область: {task.todo_path}</p>}
                      <p className="break-all sm:col-span-2">ID: {task.id}</p>
                    </div>
                  </article>
                );
              })}

              {doneTasks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  В архиве пока нет задач.
                </div>
              )}
            </div>
          )}

          {filteredTasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              В этом фильтре задач пока нет.
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm sm:p-4 dark:border-slate-700/80 dark:bg-slate-900/50">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">Лента событий</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{filteredEvents.length} шт.</span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={eventSourceFilter}
              onChange={(event) => setEventSourceFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">Все источники</option>
              {eventSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <select
              value={eventTypeFilter}
              onChange={(event) => setEventTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">Все типы</option>
              {eventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 max-h-[420px] space-y-2 overflow-x-hidden overflow-y-auto pr-1 sm:mt-4 sm:max-h-[540px]">
            {filteredEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {event.type}
                  <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">#{event.id}</span>
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  <span className="break-words">{formatPayload(event.payload)}</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="break-all">{event.source ?? "неизвестно"}</span> • {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            ))}

            {filteredEvents.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Нет событий для выбранного фильтра.
              </p>
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-violet-50 to-cyan-50 p-3 sm:p-4 dark:border-indigo-500/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-cyan-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">Как запускать задачи без CLI-магии</h2>
            <p className="mt-1 text-sm text-indigo-900/90 dark:text-indigo-100/90">Пользователю нужен только пересланный сигнал в Codex и затем кнопка Create PR, когда агент закончит.</p>
          </div>
          <span className="rounded-full border border-indigo-300/70 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-400/40 dark:bg-slate-900/60 dark:text-indigo-200">
            Ручной поток: Телеграм → Codex → ПР
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:gap-3 md:grid-cols-3">
          {suggestedTasks.map((task) => (
            <article key={task.id} className="rounded-xl border border-indigo-200 bg-white/95 p-3 text-sm dark:border-indigo-500/40 dark:bg-slate-900/70">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                способность: <span className="font-mono">{task.capability ?? "нет"}</span>
              </p>
              <p className="mt-1 break-all text-[11px] text-slate-500 dark:text-slate-400">айди_задачи: {task.id}</p>
              <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">Отправь уведомление из карточки задачи выше и перешли его в чат с Codex.</p>
            </article>
          ))}

          {suggestedTasks.length === 0 && (
            <p className="rounded-lg border border-dashed border-indigo-300 p-3 text-xs text-indigo-900 dark:border-indigo-500/40 dark:text-indigo-200">
              Сейчас нет открытых задач. Очередь чистая и ждёт новые идеи.
            </p>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-indigo-200/70 bg-indigo-950 px-3 py-2 text-xs text-indigo-50 dark:border-indigo-400/30">
          Пример сообщения для Codex (после пересылки сигнала): «возьми задачу из пересланного уведомления и сделай PR».
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Словарик русифицированных терминов:</p>
        <p className="mt-1">клейм = claim, ПР = pull request, ВебАпп = web app, айди = id, нагрузка = payload.</p>
      </section>
    </div>
  );
}
