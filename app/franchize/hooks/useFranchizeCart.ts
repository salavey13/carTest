"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { saveUserFranchizeCartAction } from "@/contexts/actions";

export type FranchizeCartOptions = {
  package: string;
  duration: string;
  perk: string;
  auction: string;
};

export type FranchizeCartLine = {
  itemId: string;
  qty: number;
  options: FranchizeCartOptions;
};

export type FranchizeCartState = Record<string, FranchizeCartLine>;

const CART_STORAGE_PREFIX = "franchize-cart";
const CART_SYNC_EVENT = "franchize-cart-sync";

const DEFAULT_OPTIONS: FranchizeCartOptions = {
  package: "Base",
  duration: "1 day",
  perk: "Стандарт",
  auction: "Без аукциона",
};

export function buildCartLineId(itemId: string, options: FranchizeCartOptions) {
  const normalized = `${options.package}|${options.duration}|${options.perk}|${options.auction}`.toLowerCase().replace(/\s+/g, "-");
  return `${itemId}::${normalized}`;
}

const sanitizeCartState = (value: unknown): FranchizeCartState => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<FranchizeCartState>((acc, [lineId, entry]) => {
    // backward compatibility with old format: { [itemId]: qty }
    if (typeof entry === "number" && Number.isFinite(entry) && Math.floor(entry) > 0) {
      const itemId = lineId;
      const options = { ...DEFAULT_OPTIONS };
      const normalizedLineId = buildCartLineId(itemId, options);
      acc[normalizedLineId] = { itemId, qty: Math.floor(entry), options };
      return acc;
    }

    if (!entry || typeof entry !== "object") {
      return acc;
    }

    const line = entry as Partial<FranchizeCartLine>;
    const qty = typeof line.qty === "number" && Number.isFinite(line.qty) ? Math.floor(line.qty) : 0;
    const itemId = typeof line.itemId === "string" ? line.itemId : "";
    if (!itemId || qty <= 0) {
      return acc;
    }

    const rawOptions = line.options ?? {};
    const options: FranchizeCartOptions = {
      package: typeof rawOptions.package === "string" ? rawOptions.package : DEFAULT_OPTIONS.package,
      duration: typeof rawOptions.duration === "string" ? rawOptions.duration : DEFAULT_OPTIONS.duration,
      perk: typeof rawOptions.perk === "string" ? rawOptions.perk : DEFAULT_OPTIONS.perk,
      auction: typeof rawOptions.auction === "string" ? rawOptions.auction : DEFAULT_OPTIONS.auction,
    };

    const normalizedLineId = buildCartLineId(itemId, options);
    const prev = acc[normalizedLineId];
    if (prev) {
      prev.qty += qty;
    } else {
      acc[normalizedLineId] = { itemId, qty, options };
    }

    return acc;
  }, {});
};

export const getFranchizeCartStorageKey = (slug: string) => `${CART_STORAGE_PREFIX}:${slug}`;

export function useFranchizeCart(slug: string) {
  const pathname = usePathname();
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id ?? null;
  const storageKey = useMemo(() => getFranchizeCartStorageKey(slug), [slug]);
  const [cart, setCart] = useState<FranchizeCartState>({});
  const persistInFlightRef = useRef(false);
  const queuedCartRef = useRef<FranchizeCartState | null>(null);
  const pendingPersistRef = useRef(false);
  const lastPersistedSnapshotRef = useRef<string>("{}");

  const serializeCart = useCallback((state: FranchizeCartState) => JSON.stringify(state), []);

  const persistCartSnapshot = useCallback(async (snapshot: FranchizeCartState) => {
    if (!userId) return;

    if (persistInFlightRef.current) {
      queuedCartRef.current = snapshot;
      return;
    }

    persistInFlightRef.current = true;

    try {
      const saveResult = await saveUserFranchizeCartAction(userId, slug, snapshot);
      if (!saveResult.ok) {
        pendingPersistRef.current = true;
        return;
      }
      lastPersistedSnapshotRef.current = serializeCart(snapshot);
      pendingPersistRef.current = false;
    } finally {
      persistInFlightRef.current = false;

      const queued = queuedCartRef.current;
      queuedCartRef.current = null;

      if (queued) {
        const queuedSnapshot = serializeCart(queued);
        if (queuedSnapshot !== lastPersistedSnapshotRef.current) {
          void persistCartSnapshot(queued);
        }
      }
    }
  }, [serializeCart, slug, userId]);

  const hydrateCartFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(storageKey);
    const localState = raw ? (() => {
      try {
        return sanitizeCartState(JSON.parse(raw));
      } catch {
        return {};
      }
    })() : {};

    const metadataState = (() => {
      const metadata = dbUser?.metadata;
      if (!metadata || typeof metadata !== "object") return {};
      const settings = (metadata as Record<string, unknown>).settings;
      if (!settings || typeof settings !== "object") return {};
      const franchizeCart = (settings as Record<string, unknown>).franchizeCart;
      if (!franchizeCart || typeof franchizeCart !== "object") return {};
      const slugCart = (franchizeCart as Record<string, unknown>)[slug];
      return sanitizeCartState(slugCart);
    })();

    if (Object.keys(localState).length === 0 && Object.keys(metadataState).length > 0) {
      setCart(metadataState);
      window.localStorage.setItem(storageKey, JSON.stringify(metadataState));
      return;
    }

    if (!raw) {
      setCart({});
      return;
    }

    setCart(localState);
  }, [dbUser?.metadata, slug, storageKey]);

  useEffect(() => {
    hydrateCartFromStorage();
  }, [hydrateCartFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent(CART_SYNC_EVENT, { detail: { storageKey } }));
  }, [cart, storageKey]);

  useEffect(() => {
    if (!userId) return;

    const nextSnapshot = serializeCart(cart);
    pendingPersistRef.current = nextSnapshot !== lastPersistedSnapshotRef.current;
  }, [cart, serializeCart, userId]);

  const flushPersistNow = useCallback(() => {
    if (!userId || !pendingPersistRef.current) return;
    void persistCartSnapshot(cart);
  }, [cart, persistCartSnapshot, userId]);

  useEffect(() => {
    const isCheckoutCheckpoint = pathname === `/franchize/${slug}/cart` || pathname.startsWith(`/franchize/${slug}/order/`);
    if (!isCheckoutCheckpoint) return;
    flushPersistNow();
  }, [flushPersistNow, pathname, slug]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const flushOnPageExit = () => {
      flushPersistNow();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPersistNow();
      }
    };

    window.addEventListener("beforeunload", flushOnPageExit);
    window.addEventListener("pagehide", flushOnPageExit);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flushOnPageExit);
      window.removeEventListener("pagehide", flushOnPageExit);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [flushPersistNow]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      hydrateCartFromStorage();
    };

    const onCartSync = (event: Event) => {
      const syncEvent = event as CustomEvent<{ storageKey?: string }>;
      if (syncEvent.detail?.storageKey !== storageKey) return;
      hydrateCartFromStorage();
    };

    const onPageRestore = () => hydrateCartFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener(CART_SYNC_EVENT, onCartSync as EventListener);
    window.addEventListener("pageshow", onPageRestore);
    window.addEventListener("popstate", onPageRestore);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CART_SYNC_EVENT, onCartSync as EventListener);
      window.removeEventListener("pageshow", onPageRestore);
      window.removeEventListener("popstate", onPageRestore);
    };
  }, [hydrateCartFromStorage, storageKey]);

  const setLineQty = useCallback((lineId: string, qty: number) => {
    setCart((prev) => {
      const current = prev[lineId];
      if (!current) return prev;

      const normalizedQty = Math.floor(qty);
      if (normalizedQty <= 0) {
        const next = { ...prev };
        delete next[lineId];
        return next;
      }

      return {
        ...prev,
        [lineId]: {
          ...current,
          qty: normalizedQty,
        },
      };
    });
  }, []);

  const changeLineQty = useCallback((lineId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[lineId];
      if (!current) return prev;
      const nextQty = current.qty + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[lineId];
        return next;
      }
      return { ...prev, [lineId]: { ...current, qty: nextQty } };
    });
  }, []);

  const addItem = useCallback((itemId: string, options: FranchizeCartOptions, qty = 1) => {
    const lineId = buildCartLineId(itemId, options);
    setCart((prev) => {
      const current = prev[lineId];
      const nextQty = (current?.qty ?? 0) + qty;
      return {
        ...prev,
        [lineId]: {
          itemId,
          qty: nextQty,
          options,
        },
      };
    });

    return lineId;
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setCart((prev) => {
      if (!(lineId in prev)) return prev;
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }, []);

  const clear = useCallback(() => setCart({}), []);

  const itemCount = useMemo(() => Object.values(cart).reduce((sum, line) => sum + line.qty, 0), [cart]);

  return {
    cart,
    itemCount,
    addItem,
    setLineQty,
    changeLineQty,
    removeLine,
    clear,
    defaultOptions: DEFAULT_OPTIONS,
  };
}
