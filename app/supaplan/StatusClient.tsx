"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function StatusClient() {

  const [tasks, setTasks] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("supaplan_tasks")
      .select("*")
      .order("created_at");

    setTasks(data || []);
  }

  useEffect(() => {

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

  }, []);

  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="border rounded p-3"
        >
          <div className="font-medium">{t.title}</div>

          <div className="text-sm opacity-70">
            status: {t.status}
          </div>

          {t.todo_path && (
            <div className="text-xs opacity-60">
              {t.todo_path}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}