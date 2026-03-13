"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type SupaPlanStatus = "open" | "claimed" | "running" | "ready_for_pr" | "done";

type SupaPlanTask = {
  id: string;
  title: string;
  status: SupaPlanStatus;
  todo_path: string | null;
  capability: string | null;
  created_at: string;
};

const STATUS_META: Record<SupaPlanStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-slate-100 text-slate-800",
  },
  claimed: {
    label: "Claimed",
    className: "bg-blue-100 text-blue-800",
  },
  running: {
    label: "Running",
    className: "bg-amber-100 text-amber-800",
  },
  ready_for_pr: {
    label: "Ready for PR",
    className: "bg-purple-100 text-purple-800",
  },
  done: {
    label: "Done",
    className: "bg-emerald-100 text-emerald-800",
  },
};

export default function StatusClient() {
  const [tasks, setTasks] = useState<SupaPlanTask[]>([]);
  const [activeFilter, setActiveFilter] = useState<SupaPlanStatus | "all">("all");
  const [loadError, setLoadError] = useState<string | null>(null);

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
      return;
    }

    const { data, error } = await supabase
      .from("supaplan_tasks")
      .select("id,title,status,todo_path,capability,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      setLoadError(error.message);
      return;
    }

    setTasks((data as SupaPlanTask[]) || []);
    setLoadError(null);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    load();

    const channel = supabase
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

    return () => {
      channel.unsubscribe();
    };
  }, [load, supabase]);

  const statusCounts = useMemo(() => {
    return tasks.reduce<Record<SupaPlanStatus, number>>(
      (acc, task) => {
        acc[task.status] += 1;
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

  const filteredTasks = useMemo(() => {
    if (activeFilter === "all") {
      return tasks;
    }

    return tasks.filter((task) => task.status === activeFilter);
  }, [activeFilter, tasks]);

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          SupaPlan cannot connect yet: {loadError}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(STATUS_META) as SupaPlanStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveFilter(status)}
            className={`rounded-xl border p-4 text-left transition hover:shadow-sm ${
              activeFilter === status ? "border-black" : "border-slate-200"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {STATUS_META[status].label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {statusCounts[status]}
            </div>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`rounded-full px-3 py-1 text-sm transition ${
            activeFilter === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All tasks ({tasks.length})
        </button>
        <p className="text-sm text-slate-600">
          Current filter: <span className="font-medium text-slate-900">{activeFilter === "all" ? "All" : STATUS_META[activeFilter].label}</span>
        </p>
      </div>

      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <article
            key={task.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[task.status].className}`}
              >
                {STATUS_META[task.status].label}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {task.capability && <p>Capability: {task.capability}</p>}
              {task.todo_path && <p>Scope: {task.todo_path}</p>}
              <p>Created: {new Date(task.created_at).toLocaleString()}</p>
            </div>
          </article>
        ))}

        {filteredTasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
            No tasks in this status yet. Pick another filter and keep shipping ✨
          </div>
        )}
      </div>
    </div>
  );
}
