"use client";

// /app/franchize/[slug]/storage/openStorageDoc.ts
// 2026-09-28 — boss review R2 #1: the storage contract (which carries the
// OWNER'S PASSPORT data) must never be served via a /object/public/ URL —
// `rental-contracts` is a PRIVATE bucket (20260618000001_rental_contracts_
// storage.sql). The signed URL is minted server-side, per click, inside the
// already staff/owner-gated server action (getStorageDocUrlAction), and this
// helper opens it in the Telegram-WebView-safe way (tg.openLink pops out to
// the browser; window.open is the non-TG fallback).

import { toast } from "sonner";
import { getStorageDocUrlAction } from "@/app/franchize/server-actions/storage-bikes";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";

/** tg.openLink when inside the Mini App, window.open otherwise. */
function openExternalUrl(url: string): void {
  try {
    const tg = (
      window as unknown as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }
    ).Telegram?.WebApp;
    if (tg && typeof tg.openLink === "function") {
      tg.openLink(url);
      return;
    }
  } catch {
    /* fall through to window.open */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Fetch a fresh one-hour signed URL for the bike's storage contract and open
 * it. Returns true on success (false + toast on any failure).
 */
export async function openStorageDoc(params: {
  slug: string;
  bikeId: string;
  label?: string;
}): Promise<boolean> {
  try {
    const result = await getStorageDocUrlAction({
      slug: params.slug,
      bikeId: params.bikeId,
      initData: getTelegramInitData(),
    });
    if (!result.success || !result.url) {
      toast.error(result.error || "Договор пока не готов — попробуйте позже.");
      return false;
    }
    if (!result.url) {
      toast.error("Договор ещё не сгенерирован для этой заявки.");
      return false;
    }
    openExternalUrl(result.url);
    return true;
  } catch {
    toast.error("Нет связи — попробуйте ещё раз.");
    return false;
  }
}
