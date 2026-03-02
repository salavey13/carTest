"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
// Note: We deliberately do NOT import the save action here anymore. 
// Saving happens only on specific user interactions (Checkout).

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
  if (!value || typeof value !== "object") return {};
  
  return Object.entries(value as Record<string, unknown>).reduce<FranchizeCartState>((acc, [lineId, entry]) => {
    if (typeof entry === "number" && Number.isFinite(entry) && Math.floor(entry) > 0) {
      const itemId = lineId;
      acc[buildCartLineId(itemId, { ...DEFAULT_OPTIONS })] = { itemId, qty: Math.floor(entry), options: { ...DEFAULT_OPTIONS } };
      return acc;
    }
    if (!entry || typeof entry !== "object") return acc;
    const line = entry as Partial<FranchizeCartLine>;
    const qty = typeof line.qty === "number" ? Math.floor(line.qty) : 0;
    const itemId = typeof line.itemId === "string" ? line.itemId : "";
    if (!itemId || qty <= 0) return acc;
    const rawOptions = line.options ?? {};
    const options: FranchizeCartOptions = {
      package: typeof rawOptions.package === "string" ? rawOptions.package : DEFAULT_OPTIONS.package,
      duration: typeof rawOptions.duration === "string" ? rawOptions.duration : DEFAULT_OPTIONS.duration,
      perk: typeof rawOptions.perk === "string" ? rawOptions.perk : DEFAULT_OPTIONS.perk,
      auction: typeof rawOptions.auction === "string" ? rawOptions.auction : DEFAULT_OPTIONS.auction,
    };
    const normalizedLineId = buildCartLineId(itemId, options);
    const prev = acc[normalizedLineId];
    if (prev) prev.qty += qty; else acc[normalizedLineId] = { itemId, qty, options };
    return acc;
  }, {});
};

export const getFranchizeCartStorageKey = (slug: string) => `${CART_STORAGE_PREFIX}:${slug}`;

export function useFranchizeCart(slug: string) {
  const { dbUser } = useAppContext();
  const storageKey = useMemo(() => getFranchizeCartStorageKey(slug), [slug]);
  const [cart, setCart] = useState<FranchizeCartState>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // 1. Hydration Logic (Runs Once)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawLocal = window.localStorage.getItem(storageKey);
    let initialState: FranchizeCartState = {};

    // Priority 1: Local Storage
    if (rawLocal) {
      try {
        initialState = sanitizeCartState(JSON.parse(rawLocal));
      } catch {
        initialState = {};
      }
    } 
    // Priority 2: DB Metadata (Read-only restore)
    else if (dbUser?.metadata) {
      const meta = dbUser.metadata as Record<string, any>;
      const settings = meta.settings as Record<string, any> | undefined;
      const remoteCart = settings?.franchizeCart?.[slug];
      
      if (remoteCart) {
        initialState = sanitizeCartState(remoteCart);
        // Sync retrieved DB state to local storage immediately so it sticks
        window.localStorage.setItem(storageKey, JSON.stringify(initialState));
      }
    }

    setCart(initialState);
    setIsHydrated(true);
  }, [slug, storageKey, dbUser?.metadata]); 

  // 2. Persistence Logic (Local Only - No Server Actions Here)
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    
    // Synchronous local save - zero network latency
    window.localStorage.setItem(storageKey, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent(CART_SYNC_EVENT, { detail: { storageKey } }));
  }, [cart, storageKey, isHydrated]);

  // 3. Tab Sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      hydrate();
    };

    const onCartSync = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.storageKey === storageKey) hydrate();
    };

    const hydrate = () => {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) setCart(sanitizeCartState(JSON.parse(raw)));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(CART_SYNC_EVENT, onCartSync as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CART_SYNC_EVENT, onCartSync as EventListener);
    };
  }, [storageKey]);

  // Actions
  const setLineQty = useCallback((lineId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) { const next = { ...prev }; delete next[lineId]; return next; }
      const current = prev[lineId];
      if (!current) return prev;
      return { ...prev, [lineId]: { ...current, qty }};
    });
  }, []);

  const changeLineQty = useCallback((lineId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[lineId];
      if (!current) return prev;
      const nextQty = current.qty + delta;
      if (nextQty <= 0) { const next = { ...prev }; delete next[lineId]; return next; }
      return { ...prev, [lineId]: { ...current, qty: nextQty } };
    });
  }, []);

  const addItem = useCallback((itemId: string, options: FranchizeCartOptions, qty = 1) => {
    const lineId = buildCartLineId(itemId, options);
    setCart((prev) => {
      const current = prev[lineId];
      const nextQty = (current?.qty ?? 0) + qty;
      return { ...prev, [lineId]: { itemId, qty: nextQty, options } };
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

  const clear = useCallback(() => {
    setCart({});
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const itemCount = useMemo(() => Object.values(cart).reduce((sum, line) => sum + line.qty, 0), [cart]);

  return { cart, itemCount, addItem, setLineQty, changeLineQty, removeLine, clear, defaultOptions: DEFAULT_OPTIONS };
}