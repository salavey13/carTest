"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";

import { notifyTaskPickInTelegram } from "./actions";

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

const STATUS_META: Record<KnownSupaPlanStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-slate-100 text-slate-800 dark:bg-slate-700/60 dark:text-slate-100",
  },
  claimed: {
    label: "Claimed",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  },
  running: {
    label: "Running",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  },
  ready_for_pr: {
    label: "Ready for PR",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  },
  done: {
    label: "Done",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
};

const UNKNOWN_STATUS_META = {
  label: "Unknown",
  className: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
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
  };
}

function formatPayload(payload: Record<string, unknown> | null): string {
  if (!payload) {
    return "No payload";
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

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

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
      setLoadError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
      setLoadError(taskError?.message ?? eventError?.message ?? "Failed to load SupaPlan data");
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

  const handleNotify = useCallback((task: SupaPlanTask) => {
    setNotifState(null);

    startTransition(async () => {
      const result = await notifyTaskPickInTelegram({
        taskId: task.id,
        taskTitle: task.title,
        capability: task.capability,
        todoPath: task.todo_path,
      });

      if (!result.success) {
        setNotifState({
          taskId: task.id,
          message: result.error ?? "Could not send Telegram notification",
          kind: "error",
        });

        return;
      }

      setNotifState({
        taskId: task.id,
        message: "Sent to Telegram",
        kind: "ok",
      });
    });
  }, []);

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200">
          SupaPlan cannot connect yet: {loadError}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(STATUS_META) as KnownSupaPlanStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveFilter(status)}
            className={`rounded-xl border p-4 text-left transition hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/30 ${
              activeFilter === status ? "border-black dark:border-indigo-400" : "border-slate-200"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
              {STATUS_META[status].label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {statusCounts[status]}
            </div>
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
          All tasks ({tasks.length})
        </button>

        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by title, capability, id"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        <select
          value={capabilityFilter}
          onChange={(event) => setCapabilityFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">All capabilities</option>
          {capabilities.map((capability) => (
            <option key={capability} value={capability}>
              {capability}
            </option>
          ))}
        </select>

        <p className="self-center text-sm text-slate-600 dark:text-slate-300">
          Filter: <span className="font-medium text-slate-900 dark:text-slate-100">{activeFilter === "all" ? "All" : STATUS_META[activeFilter].label}</span>
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const badge = getStatusMeta(task.status);

            return (
              <article
                key={task.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {task.capability && <p>Capability: {task.capability}</p>}
                  {task.todo_path && <p>Scope: {task.todo_path}</p>}
                  <p>ID: {task.id}</p>
                  <p>Created: {new Date(task.created_at).toLocaleString()}</p>
                </div>

                {(task.status === "open" || task.status === "ready_for_pr") && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNotify(task)}
                      disabled={isPending}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Notify in Telegram
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
              No tasks in this filter yet. Pick another combination and keep shipping ✨
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Recent events
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{filteredEvents.length} visible</span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={eventSourceFilter}
              onChange={(event) => setEventSourceFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">All sources</option>
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
              <option value="all">All types</option>
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
                  {event.source ?? "unknown"} • {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            ))}

            {filteredEvents.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No events for this filter.
              </p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
