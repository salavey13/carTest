"use client";

// SubrenterManagerPanel
// ──────────────────────────────────────────────────────────────────────────
// Admin panel section: marks a Telegram user as the SUBRENTER (partner owner)
// of a bike by writing his chat id into cars.specs.subrenter_chat_id.
// The subrenter then sees rentals of his bike (mini admin) and gets
// exploration achievements. No DB migration — pure specs JSONB data.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  getCrewBikesSubrenterInfoAction,
  setBikeSubrenterAction,
} from "@/app/franchize/server-actions/bike-subrenter";
import { FranchizeOperatorPanel } from "./FranchizeOperatorSurface";

interface BikeSubrenterRow {
  bikeId: string;
  label: string;
  subrenterChatId: string | null;
}

export function SubrenterManagerPanel({
  slug,
  canManage,
}: {
  slug: string;
  canManage: boolean;
}) {
  const { dbUser } = useAppContext();
  const [bikes, setBikes] = useState<BikeSubrenterRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!dbUser?.user_id || !slug) return;
    setLoading(true);
    try {
      const result = await getCrewBikesSubrenterInfoAction({ slug, actorUserId: dbUser.user_id });
      if (result.success && result.data) {
        setBikes(result.data);
        setDrafts(Object.fromEntries(result.data.map((b) => [b.bikeId, b.subrenterChatId ?? ""])));
      } else if (result.error) {
        toast.error(`Не удалось загрузить список байков — ${result.error}`);
      }
    } catch (err) {
      toast.error(`Не удалось загрузить список байков — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [dbUser?.user_id, slug]);

  useEffect(() => {
    if (expanded && canManage) void load();
  }, [expanded, canManage, load]);

  const save = async (bikeId: string) => {
    if (!dbUser?.user_id) return;
    const value = (drafts[bikeId] ?? "").trim();
    setSavingId(bikeId);
    try {
      const result = await setBikeSubrenterAction({
        slug,
        actorUserId: dbUser.user_id,
        bikeId,
        subrenterChatId: value || null,
      });
      if (result.success) {
        toast.success(value ? "Субарендатор назначен" : "Субарендатор снят");
        setBikes((prev) => prev.map((b) => (b.bikeId === bikeId ? { ...b, subrenterChatId: value || null } : b)));
      } else {
        toast.error(`Не удалось сохранить — ${result.error ?? "неизвестная ошибка"}`);
      }
    } catch (err) {
      toast.error(`Не удалось сохранить — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingId(null);
    }
  };

  if (!canManage) return null;

  return (
    <FranchizeOperatorPanel className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
            Субарендаторы (мини-админы)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--fr-admin-muted)]">
            Telegram chat id партнёра-владельца байка. Субарендатор видит аренды
            своего байка на странице «Аренды» и может открыть страницу аренды.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 text-xs"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded) void load();
          }}
        >
          {expanded ? "Свернуть" : "Управлять"}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--fr-admin-muted)]">
              {loading ? "Загрузка…" : `${bikes.length} записей`}
            </span>
            <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-1 h-3 w-3" /> Обновить
            </Button>
          </div>
          {!loading && bikes.length === 0 && (
            <p className="py-2 text-center text-xs text-[var(--fr-admin-muted)]">
              В экипаже пока нет техники.
            </p>
          )}
          {bikes.map((bike) => (
            <div
              key={bike.bikeId}
              className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
              style={{ borderColor: "var(--fr-admin-border)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--fr-admin-text)]">
                  {bike.label}
                </p>
                <p className="mt-0.5 text-xs text-[var(--fr-admin-muted)]">
                  {bike.subrenterChatId
                    ? `Субарендатор: ${bike.subrenterChatId}`
                    : "Субарендатор не назначен"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={drafts[bike.bikeId] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [bike.bikeId]: e.target.value.replace(/[^\d]/g, "") }))}
                  placeholder="chat id, напр. 123456789"
                  inputMode="numeric"
                  className="h-9 w-40 rounded-lg border bg-transparent px-3 text-xs text-[var(--fr-admin-text)] outline-none focus:border-[var(--fr-admin-accent)]"
                  style={{ borderColor: "var(--fr-admin-border)" }}
                />
                <Button
                  type="button"
                  className="h-9 text-xs font-semibold"
                  disabled={savingId === bike.bikeId || (drafts[bike.bikeId] ?? "") === (bike.subrenterChatId ?? "")}
                  onClick={() => void save(bike.bikeId)}
                >
                  {savingId === bike.bikeId ? "Сохраняю…" : "Сохранить"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </FranchizeOperatorPanel>
  );
}
