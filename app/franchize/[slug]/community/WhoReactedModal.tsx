"use client";

// ── WhoReactedModal (profile v1 / Chain #5 «Кому понравилось») ───────────────
// Lists the people behind a post's reactions, grouped per emoji. Rendered
// through WallOverlayPortal (the section's backdrop-blur is a containing
// block — fixed overlays MUST live in document.body, the PhotoLightbox
// lesson). Privacy mirrors the reactions migration: reactor enumeration is
// a riders-only surface — anonymous visitors get an explanatory notice, not
// the list (the server action enforces it too).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { getPostReactionsAction, type ReactionReactorGroup } from "@/app/franchize/server-actions/rider-profile";

function ReactorAvatar({ name, url }: { name: string; url: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />;
  }
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black text-[var(--community-accent-text)]"
      style={{ backgroundColor: "var(--community-accent)" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function WhoReactedModal({
  slug,
  postId,
  onClose,
}: {
  slug: string;
  postId: string;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<ReactionReactorGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getPostReactionsAction({ slug, postId, initData: getTelegramInitData() || undefined }).then((res) => {
      if (!alive) return;
      if (res.ok) setGroups(res.groups);
      else setError(res.error);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [slug, postId, onClose]);

  const total = groups?.reduce((acc, g) => acc + g.count, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Кому понравилось">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Закрыть" tabIndex={-1} />
      <div
        className="relative w-full max-w-sm rounded-t-3xl border border-[var(--community-border)] p-4 shadow-2xl sm:rounded-3xl"
        style={{ backgroundColor: "var(--community-card-soft)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-black uppercase tracking-wide text-[var(--community-text)]">
            Кому понравилось{total > 0 ? ` · ${total}` : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--community-border)] text-[var(--community-muted)] transition hover:text-[var(--community-text)]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 max-h-[52vh] space-y-3 overflow-y-auto pb-1">
          {groups === null && !error && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--community-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Загружаю…
            </div>
          )}
          {error && (
            <p className="py-6 text-center text-sm text-[var(--community-muted)]">{error}</p>
          )}
          {groups !== null && groups.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--community-muted)]">Реакции уже разлетелись — тут пока пусто.</p>
          )}
          {groups?.map((group) => (
            <div key={group.emoji}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--community-muted)]">
                {group.emoji} {group.count}
              </p>
              <ul className="mt-1 space-y-1">
                {group.reactors.map((r) => {
                  const name = r.fullName || r.username || "Райдер";
                  return (
                    <li key={`${group.emoji}-${r.userId}`}>
                      <Link
                        href={`/franchize/${slug}/rider/${r.userId}`}
                        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-[var(--community-base-soft)]"
                      >
                        <ReactorAvatar name={name} url={r.avatarUrl} />
                        <span className="truncate text-sm font-semibold text-[var(--community-text)]">{name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
