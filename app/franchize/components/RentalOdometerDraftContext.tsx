"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * RentalOdometerDraftContext
 * ──────────────────────────────────────────────────────────────────────────
 * 2026-09-28 — owner report: the end-odometer typed on the rental page is
 * autosaved (debounced) by RentalOdometerInput, but the closure modal in
 * FranchizeRentalLifecycleActions pre-fills from SERVER-RENDERED props
 * (metadata.odometer_after_draft). Those two layers never talk, so the
 * «сохранено» badge on the page and the prefill inside the modal drift
 * apart — the operator opened the modal and had to re-type the value.
 *
 * This provider is the single client-side source of truth for the draft:
 *   - the inline editor REPORTS every successful save here (and registers
 *     a flush() for a still-pending debounced save);
 *   - the closure modal AWAITS the flush before pre-filling, so opening
 *     the modal right after typing always sees the freshest value.
 *
 * Server props remain the initial value (first render, SSR) — the context
 * only ever moves FORWARD from what the server knew.
 */

interface RentalOdometerDraftStore {
  /** Latest draft the client knows about (server prop or a local save). */
  draftValue: number | null;
  /** Epoch ms of the last successful save (0 = server-provided only). */
  savedAt: number;
  /** Called by the inline editor after each successful autosave. */
  reportSaved: (value: number | null) => void;
  /** Called by the inline editor on mount/register: flushes a pending
   *  debounced save and resolves with the freshest value. */
  registerFlush: (flush: (() => Promise<number | null>) | null) => void;
  /** Await any pending save, then return the freshest draft. */
  flushAndGetDraft: () => Promise<number | null>;
}

const RentalOdometerDraftContext = createContext<RentalOdometerDraftStore | null>(null);

export function RentalOdometerDraftProvider({
  initialDraft,
  children,
}: {
  initialDraft: number | null;
  children: ReactNode;
}) {
  const [draftValue, setDraftValue] = useState<number | null>(initialDraft);
  const [savedAt, setSavedAt] = useState<number>(0);
  const latestRef = useRef<number | null>(initialDraft);
  const flushRef = useRef<(() => Promise<number | null>) | null>(null);

  const reportSaved = useCallback((value: number | null) => {
    latestRef.current = value;
    setDraftValue(value);
    setSavedAt(Date.now());
  }, []);

  const registerFlush = useCallback((flush: (() => Promise<number | null>) | null) => {
    flushRef.current = flush;
  }, []);

  const flushAndGetDraft = useCallback(async () => {
    if (flushRef.current) {
      try {
        const flushed = await flushRef.current();
        if (flushed !== undefined && flushed !== latestRef.current) {
          latestRef.current = flushed;
          setDraftValue(flushed);
        }
      } catch {
        // A failed flush must never block the modal from opening — fall
        // back to whatever the client already knows.
      }
    }
    return latestRef.current;
  }, []);

  const store = useMemo(
    () => ({ draftValue, savedAt, reportSaved, registerFlush, flushAndGetDraft }),
    [draftValue, savedAt, reportSaved, registerFlush, flushAndGetDraft],
  );

  return (
    <RentalOdometerDraftContext.Provider value={store}>
      {children}
    </RentalOdometerDraftContext.Provider>
  );
}

export function useRentalOdometerDraft(): RentalOdometerDraftStore | null {
  return useContext(RentalOdometerDraftContext);
}
