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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<{ taskId: string; message: string; kind: "ok" | "error" } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const { dbUser, user } = useAppContext();

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

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

    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
  }, [hasSupabaseEnv]);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoadError("Отсутствуют NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY");
      setTasks([]);
      setEvents([]);
      return;
    }

    const [{ data: taskData, error: taskError }, { data: eventData, error: eventError }] = await Promise.all([
      supabase
        .from("supaplan_tasks")
        .select("id,title,status,todo_path,capability,created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("supaplan_events")
        .select("id,created_at,source,type,payload")
        .order("created_at", { ascending: false })
        .limit(25),
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

  const handleNotify = useCallback((task: SupaPlanTask) => {
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
  }, [recipientChatId]);

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200">
          СупаПлан пока не подключился: {loadError}
        </div>
      )}

      <section className="grid gap-3 grid-cols-2 xl:grid-cols-5">
        {(Object.keys(STATUS_META) as KnownSupaPlanStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveFilter(status)}
            className={`rounded-xl border p-3 text-left transition hover:shadow-sm dark:bg-slate-900/30 ${STATUS_META[status].cardClass} ${
              activeFilter === status ? "ring-2 ring-offset-1 ring-indigo-500 dark:ring-indigo-400 dark:ring-offset-slate-950" : ""
            }`}
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-300">{STATUS_META[status].label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{statusCounts[status]}</div>
          </button>
        ))}
      </section>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700/80 dark:bg-slate-900/50 md:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`rounded-full px-3 py-1 text-sm transition ${
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        <select
          value={capabilityFilter}
          onChange={(event) => setCapabilityFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">Все способности</option>
          {capabilities.map((capability) => (
            <option key={capability} value={capability}>
              {capability}
            </option>
          ))}
        </select>

        <p className="self-center text-sm text-slate-600 dark:text-slate-300">
          Фильтр: <span className="font-medium text-slate-900 dark:text-slate-100">{activeFilter === "all" ? "все" : STATUS_META[activeFilter].label}</span>
        </p>
      </div>

      <section className="rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">Стартовая доска: быстрый ручной запуск</h2>
            <p className="mt-1 text-sm text-indigo-900/90 dark:text-indigo-100/90">
              Выберите задачу ниже и вставьте готовую строку в чат, чтобы запустить Кодекс вручную.
            </p>
          </div>
          <code className="max-w-full overflow-x-auto rounded-md bg-indigo-900/90 px-2 py-1 text-xs text-indigo-100">
            node scripts/supaplan-skill.mjs pick-task --capability &lt;способность&gt; --agentId &lt;айди&gt;
          </code>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {suggestedTasks.map((task) => (
            <article
              key={task.id}
              className="rounded-lg border border-indigo-200 bg-white/95 p-3 text-sm dark:border-indigo-500/40 dark:bg-slate-900/70"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                способность: <span className="font-mono">{task.capability ?? "нет"}</span>
              </p>
              <p className="mt-1 break-all text-[11px] text-slate-500 dark:text-slate-400">айди_задачи: {task.id}</p>
              <p className="mt-2 rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Кодекс, возьми задачу {task.id} ({task.title})
              </p>
            </article>
          ))}

          {suggestedTasks.length === 0 && (
            <p className="rounded-lg border border-dashed border-indigo-300 p-3 text-xs text-indigo-900 dark:border-indigo-500/40 dark:text-indigo-200">
              Сейчас нет открытых задач. Очередь чистая и ждёт новые идеи.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const badge = getStatusMeta(task.status);

            return (
              <article
                key={task.id}
                className={`rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900/50 ${badge.cardClass}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{task.title}</h3>
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="mt-2 grid gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  {task.capability && (
                    <p className="truncate" title={task.capability}>
                      <span className="text-slate-500 dark:text-slate-400">Способность:</span> {task.capability}
                    </p>
                  )}
                  <p className="break-all">
                    <span className="text-slate-500 dark:text-slate-400">ID:</span> {task.id}
                  </p>
                  {task.todo_path && (
                    <p className="sm:col-span-2 break-all">
                      <span className="text-slate-500 dark:text-slate-400">Область:</span> {task.todo_path}
                    </p>
                  )}
                  <p>
                    <span className="text-slate-500 dark:text-slate-400">Создана:</span> {new Date(task.created_at).toLocaleDateString()}
                  </p>
                </div>

                {(task.status === "open" || task.status === "ready_for_pr") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNotify(task)}
                      disabled={isPending}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Отправить в Телеграм
                    </button>
                    {notifState?.taskId === task.id && (
                      <span className={`text-xs ${notifState.kind === "ok" ? "text-emerald-500" : "text-rose-500"}`}>
                        {notifState.message}
                      </span>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              В этом фильтре задач пока нет.
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">Свежие события</h3>
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

          <div className="mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {event.type}
                  <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">#{event.id}</span>
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{formatPayload(event.payload)}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {event.source ?? "неизвестно"} • {new Date(event.created_at).toLocaleString()}
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

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Словарик русифицированных терминов:</p>
        <p className="mt-1">клейм = claim, ПР = pull request, ВебАпп = web app, айди = id, нагрузка = payload.</p>
      </section>
    </div>
  );
}
