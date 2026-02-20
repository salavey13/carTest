"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type FranchizeCartState = Record<string, number>;

const CART_STORAGE_PREFIX = "franchize-cart";

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

  useEffect(() => {
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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      if (!event.newValue) {
        setCart({});
        return;
      }

      try {
        setCart(sanitizeCartState(JSON.parse(event.newValue)));
      } catch {
        setCart({});
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

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
