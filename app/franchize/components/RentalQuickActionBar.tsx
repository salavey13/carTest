"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, MessageSquare, CheckCircle2, X, LayoutGrid } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

/**
 * RentalQuickActionBar
 * ──────────────────────────────────────────────────────────────────────────
 * Idea B from PRD: Quick-action floating bar.
 *
 * A sticky bottom bar (mobile) / floating card (desktop) with the 3 key
 * actions always visible while scrolling:
 *   1. [📅 Продлить] — always visible when status === "active"
 *   2. [✅ Закрыть] — visible when status === "active" (scrolls to lifecycle actions)
 *   3. [💬 Написать] — always visible (scrolls to message input)
 *
 * Why scroll-to-section instead of callbacks?
 *   - The rental page is a Server Component (async function).
 *   - Wiring onClick callbacks from server → client requires either:
 *     (a) a shared client context provider, or
 *     (b) lifting the buttons into a client wrapper component.
 *   - Anchor-based scrolling is simpler, requires no wiring, and works
 *     even with SSR hydration.
 *
 * Mobile behavior:
 *   - Fixed bottom bar with safe-area inset padding
 *   - Tappable targets (44px min height)
 *   - Dismissible with X button → collapses to a small FAB
 *
 * Desktop behavior:
 *   - Floating card in bottom-right corner
 *
 * Persistence:
 *   - Dismissal stored in sessionStorage so refresh doesn't bring it back.
 *   - Different rentals have different storage keys (so dismissing on one
 *     rental doesn't dismiss on others).
 */
interface RentalQuickActionBarProps {
  /** Rental ID — used to namespace the dismissal state */
  rentalId: string;
  showProlong: boolean;
  /** Whether to show the "Закрыть аренду" button. The page should only pass true
   *  when status === "active". The component ALSO checks the user's role
   *  client-side (via useAppContext) — if the user is not operator/admin/owner,
   *  the button is hidden because #lifecycle-actions is role-gated and the
   *  scroll target won't exist in the DOM for renters/guests. */
  showClose: boolean;
  showMessagerent: boolean;
  /** Anchor href for "Продлить" — typically the catalog with bike filter */
  prolongHref?: string;
  /** Identity inputs for client-side role check (mirrors FranchizeRentalRoleGuard). */
  ownerId?: string;
  renterId?: string;
  renterTelegramChatId?: string;
  crewId?: string;
  accentColor: string;
  accentTextOn: string;
  borderColor: string;
  textPrimary: string;
}

export function RentalQuickActionBar({
  rentalId,
  showProlong,
  showClose,
  showMessagerent,
  prolongHref,
  ownerId,
  renterId,
  renterTelegramChatId,
  crewId,
  accentColor,
  accentTextOn,
  borderColor,
  textPrimary,
}: RentalQuickActionBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render after mount
  useEffect(() => setMounted(true), []);

  // Persist collapsed state in sessionStorage so refresh respects the user's choice.
  // NOTE: We do NOT permanently dismiss — the FAB stays available so the operator
  // can always expand the bar back. Previously we set both `dismissed` and `collapsed`,
  // which made the FAB recovery path unreachable (dead code).
  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = window.sessionStorage.getItem(`rental-quick-bar-collapsed-${rentalId}`);
      if (stored === "1") setCollapsed(true);
    } catch {
      // ignore — sessionStorage might be unavailable
    }
  }, [rentalId, mounted]);

  const handleDismiss = () => {
    setCollapsed(true);
    try {
      window.sessionStorage.setItem(`rental-quick-bar-collapsed-${rentalId}`, "1");
    } catch {
      // ignore
    }
  };

  const handleExpand = () => {
    setCollapsed(false);
    try {
      window.sessionStorage.removeItem(`rental-quick-bar-collapsed-${rentalId}`);
    } catch {
      // ignore
    }
  };

  // Client-side role check — mirrors FranchizeRentalRoleGuard logic.
  // Required because #lifecycle-actions is wrapped in <FranchizeRentalRoleGuard>
  // on the page: for renters/guests the scroll target doesn't exist in the DOM,
  // so the "Закрыть" button would be a no-op. We hide it for non-operators.
  const { dbUser, userCrewMemberships } = useAppContext();
  const isOperator = useMemo(() => {
    if (!dbUser?.user_id) return false;
    if (ownerId && dbUser.user_id === ownerId) return true;
    if (crewId) {
      const m = userCrewMemberships.find((mem) => mem.crewId === crewId);
      if (m && ["owner", "admin", "co_owner"].includes(m.role)) return true;
    }
    const meta = (dbUser.metadata as Record<string, unknown> | null) ?? null;
    if (meta?.role === "admin" || meta?.status === "admin") return true;
    return false;
  }, [dbUser?.user_id, dbUser?.metadata, ownerId, crewId, userCrewMemberships]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Briefly highlight the section
      el.classList.add("ring-2", "ring-offset-2");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-offset-2");
      }, 1500);
    }
  };

  // RULES OF HOOKS: must call useMemo BEFORE any early returns.
  // Previously this was below `if (!mounted) return null` and `if (collapsed) return <FAB>`,
  // which caused "Rendered more hooks than during the previous render" on hydration.
  const actions = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      icon: typeof Calendar;
      primary: boolean;
      onClick?: () => void;
      href?: string;
    }> = [];

    if (showProlong) {
      list.push({
        key: "prolong",
        label: "Продлить",
        icon: Calendar,
        primary: true,
        href: prolongHref,
      });
    }
    // "Закрыть" requires operator role — the scroll target #lifecycle-actions
    // is wrapped in FranchizeRentalRoleGuard and won't exist for renters/guests.
    if (showClose && isOperator) {
      list.push({
        key: "close",
        label: "Закрыть",
        icon: CheckCircle2,
        primary: true,
        onClick: () => scrollToSection("lifecycle-actions"),
      });
    }
    if (showMessagerent) {
      list.push({
        key: "message",
        label: "Написать",
        icon: MessageSquare,
        primary: false,
        onClick: () => scrollToSection("rental-message-input"),
      });
    }
    return list;
  }, [showProlong, showClose, showMessagerent, prolongHref, isOperator]);

  // Now safe to early-return — hooks above have already been called unconditionally
  if (!mounted) return null;

  // Collapsed FAB (after X click) — small floating action button to expand back.
  // Uses LayoutGrid icon (not Calendar) — the FAB represents "show all actions", not "prolong".
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={handleExpand}
        aria-label="Показать быстрые действия"
        className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 md:bottom-6 md:right-6"
        style={{ backgroundColor: accentColor, color: accentTextOn }}
      >
        <LayoutGrid className="h-5 w-5" />
      </button>
    );
  }

  if (actions.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Быстрые действия"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur-md dark:bg-zinc-900/95 md:inset-x-auto md:bottom-4 md:right-4 md:max-w-xs md:rounded-2xl md:border"
      style={{
        borderColor,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center gap-1 p-2 md:gap-2 md:p-3">
        {actions.map(({ key, label, icon: Icon, primary, onClick, href }) => {
          const cls =
            "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition md:flex-row md:gap-2 md:px-3 md:py-2.5 md:text-sm";
          const style = primary
            ? { backgroundColor: accentColor, color: accentTextOn }
            : { color: textPrimary, border: `1px solid ${borderColor}` };
          if (href) {
            return (
              <a key={key} href={href} className={cls} style={style}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </a>
            );
          }
          return (
            <button key={key} type="button" onClick={onClick} className={cls} style={style}>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Скрыть панель действий"
          className="shrink-0 rounded-xl p-2 text-xs opacity-50 transition hover:opacity-100"
          style={{ color: textPrimary }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
