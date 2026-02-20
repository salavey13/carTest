"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type FranchizeCartState = Record<string, number>;

const CART_STORAGE_PREFIX = "franchize-cart";
const CART_SYNC_EVENT = "franchize-cart-sync";

const sanitizeCartState = (value: unknown): FranchizeCartState => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<FranchizeCartState>((acc, [itemId, qty]) => {
    if (typeof qty !== "number" || !Number.isFinite(qty)) {
      return acc;
    }

    const normalizedQty = Math.floor(qty);
    if (normalizedQty > 0) {
      acc[itemId] = normalizedQty;
    }

    return acc;
  }, {});
};

export const getFranchizeCartStorageKey = (slug: string) => `${CART_STORAGE_PREFIX}:${slug}`;

export function useFranchizeCart(slug: string) {
  const storageKey = useMemo(() => getFranchizeCartStorageKey(slug), [slug]);
  const [cart, setCart] = useState<FranchizeCartState>({});

  const hydrateCartFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setCart({});
      return;
    }

    try {
      setCart(sanitizeCartState(JSON.parse(raw)));
    } catch {
      setCart({});
    }
  }, [storageKey]);

  useEffect(() => {
    hydrateCartFromStorage();
  }, [hydrateCartFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent(CART_SYNC_EVENT, { detail: { storageKey } }));
  }, [cart, storageKey]);

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

  const setItemQty = useCallback((itemId: string, qty: number) => {
    setCart((prev) => {
      const normalizedQty = Math.floor(qty);
      if (normalizedQty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: normalizedQty };
    });
  }, []);

  const changeItemQty = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      const nextQty = (prev[itemId] ?? 0) + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: nextQty };
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const clear = useCallback(() => setCart({}), []);

  const itemCount = useMemo(() => Object.values(cart).reduce((sum, qty) => sum + qty, 0), [cart]);

  return {
    cart,
    itemCount,
    setItemQty,
    changeItemQty,
    removeItem,
    clear,
  };
}
