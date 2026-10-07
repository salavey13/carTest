"use client";

// app/franchize/[slug]/bikes/[bikeId]/MaintenanceChecklist.tsx
//
// Task 76 (boss 2026-10-07): «planned service checkbox list in мотопарк for
// bikes» — the «Плановый сервис» card on a bike's story page.
//
// Permissions render EXACTLY what the server enforces
// (app/franchize/lib/bike-maintenance.ts — one shared matrix):
//   • staff   — add + check + delete;
//   • subrenter of this bike — add + check (no delete button, ever);
//   • member  — check only;
//   • plan visible to crew members + the bike's subrenter (the story page is
//     already behind the motopark gate, so a rendered card IS readable).

import { useCallback, useEffect, useState } from "react";
import { Check, ListChecks, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  addBikeMaintenanceItemAction,
  deleteBikeMaintenanceItemAction,
  getBikeMaintenanceAction,
  toggleBikeMaintenanceItemAction,
} from "@/app/franchize/server-actions/bike-maintenance";
import {
  MAINTENANCE_TEXT_MAX,
  sanitizeMaintenancePlan,
  type MaintenancePerms,
  type MaintenancePlan,
} from "@/app/franchize/lib/bike-maintenance";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import type { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";

type T = ReturnType<typeof useCrewTokens>;

interface MaintenanceChecklistProps {
  slug: string;
  bikeId: string;
  /** Fresh actor id (dbUser or the password gate's owner) — may be null briefly. */
  getActorUserId: () => string | null;
  isPasswordAuth: boolean;
  T: T;
}

export function MaintenanceChecklist({ slug, bikeId, getActorUserId, isPasswordAuth, T }: MaintenanceChecklistProps) {
  const [plan, setPlan] = useState<MaintenancePlan | null>(null);
  const [perms, setPerms] = useState<MaintenancePerms | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;
    setIsLoading(true);
    try {
      const result = await getBikeMaintenanceAction({
        slug,
        bikeId,
        actorUserId,
        isPasswordAuth,
        initData: getTelegramInitData() || undefined,
      });
      if (result.success && result.data) {
        setPlan(result.data.plan);
        setPerms(result.data.perms);
      } else if (result.error && !result.error.includes("Недостаточно")) {
        // a viewer without read rights just doesn't see the card — other
        // failures deserve a quiet console line, not a toast storm
        toast.error(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [slug, bikeId, getActorUserId, isPasswordAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const result = await addBikeMaintenanceItemAction({
      slug,
      bikeId,
      text,
      actorUserId: getActorUserId() || undefined,
      isPasswordAuth,
      initData: getTelegramInitData() || undefined,
    });
    if (result.success && result.data) {
      setPlan(result.data.plan);
    } else {
      toast.error(result.error || "Не удалось добавить пункт.");
      setDraft(text); // restore the draft — the text is the user's work
    }
  }, [draft, slug, bikeId, getActorUserId, isPasswordAuth]);

  const handleToggle = useCallback(
    async (itemId: string, done: boolean) => {
      setBusyId(itemId);
      // optimistic flip — the checkbox must feel instant
      setPlan((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, done } : i)) }
          : prev,
      );
      const result = await toggleBikeMaintenanceItemAction({
        slug,
        bikeId,
        itemId,
        done,
        actorUserId: getActorUserId() || undefined,
        isPasswordAuth,
        initData: getTelegramInitData() || undefined,
      });
      if (result.success && result.data) {
        setPlan(result.data.plan);
      } else {
        toast.error(result.error || "Не удалось сохранить отметку.");
        void load(); // rollback to the server truth
      }
      setBusyId(null);
    },
    [slug, bikeId, getActorUserId, isPasswordAuth, load],
  );

  const handleDelete = useCallback(
    async (itemId: string) => {
      setBusyId(itemId);
      const result = await deleteBikeMaintenanceItemAction({
        slug,
        bikeId,
        itemId,
        actorUserId: getActorUserId() || undefined,
        isPasswordAuth,
        initData: getTelegramInitData() || undefined,
      });
      if (result.success && result.data) {
        setPlan(result.data.plan);
      } else {
        toast.error(result.error || "Не удалось удалить пункт.");
      }
      setBusyId(null);
    },
    [slug, bikeId, getActorUserId, isPasswordAuth],
  );

  if (isLoading && !plan) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border p-5" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
        <RefreshCw className="h-4 w-4 animate-spin" style={{ color: T.textFaint }} />
        <p className="text-xs" style={{ color: T.textMuted }}>Плановый сервис…</p>
      </div>
    );
  }

  // no read rights (or the plan failed to load) — the card simply doesn't exist
  if (!plan || !perms || !perms.canRead) return null;

  const open = plan.items.filter((i) => !i.done).length;

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold" style={{ color: T.text }}>
          <ListChecks className="h-4 w-4" style={{ color: T.accent }} />
          Плановый сервис
        </h2>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={
            open > 0
              ? T.styles.accentBadge
              : { backgroundColor: T.bgElevated, color: T.textMuted }
          }
        >
          {open > 0 ? `${open} из ${plan.items.length}` : plan.items.length > 0 ? "всё выполнено" : "пусто"}
        </span>
      </div>

      {plan.items.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {plan.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
              style={{ backgroundColor: T.bgElevated }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.text}
                disabled={!perms.canCheck || busyId === item.id}
                onClick={() => void handleToggle(item.id, !item.done)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition active:scale-90 disabled:opacity-40"
                style={{
                  borderColor: item.done ? T.accent : T.borderSoft,
                  backgroundColor: item.done ? T.accent : "transparent",
                  color: item.done ? "#fff" : "transparent",
                }}
              >
                <Check className="h-4 w-4" />
              </button>
              <span
                className="min-w-0 flex-1 text-sm leading-snug"
                style={{
                  color: item.done ? T.textFaint : T.text,
                  textDecoration: item.done ? "line-through" : "none",
                }}
              >
                {item.text}
                {item.done && item.doneByName ? (
                  <span className="ml-1.5 text-[10px]" style={{ color: T.textFaint }}>
                    · {item.doneByName}
                  </span>
                ) : null}
                {!item.done && item.createdByName ? (
                  <span className="ml-1.5 text-[10px]" style={{ color: T.textFaint }}>
                    · добавил {item.createdByName}
                  </span>
                ) : null}
              </span>
              {perms.canDelete ? (
                <button
                  type="button"
                  aria-label={`Удалить: ${item.text}`}
                  disabled={busyId === item.id}
                  onClick={() => void handleDelete(item.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:opacity-75 disabled:opacity-40"
                  style={{ color: T.textFaint }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs" style={{ color: T.textMuted }}>
          <Wrench className="h-3.5 w-3.5" style={{ color: T.textFaint }} />
          Плановых работ нет — добавьте первый пункт ниже.
        </p>
      )}

      {perms.canAdd ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAINTENANCE_TEXT_MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
            placeholder="Новая плановая работа…"
            maxLength={MAINTENANCE_TEXT_MAX}
            className="h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none transition focus:opacity-100"
            style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated, color: T.text }}
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!draft.trim()}
            aria-label="Добавить пункт"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-90 disabled:opacity-40"
            style={T.styles.ctaPrimary}
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Re-export for tests: the client sanitizes whatever the server sends through
// the SAME pure fn — the shape can never diverge between the two sides.
export { sanitizeMaintenancePlan };
