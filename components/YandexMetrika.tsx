"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  captureBrowserMarketingAttribution,
  attributionForEvent,
} from "@/lib/marketing-attribution";
import {
  isVipBikeTrackingHost,
  VIP_BIKE_METRIKA_COUNTER_ID,
} from "@/lib/yandex-metrika";

const METRIKA_SCRIPT_ID = "vip-bike-yandex-metrika";

function installMetrikaQueue() {
  if (window.ym) return;
  const queue = function (this: unknown, ...args: unknown[]) {
    (queue.a ||= []).push(args);
  } as NonNullable<Window["ym"]>;
  queue.l = Date.now();
  window.ym = queue;
}

function installMetrikaScript() {
  if (document.getElementById(METRIKA_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = METRIKA_SCRIPT_ID;
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  document.head.appendChild(script);
}

export function YandexMetrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (!isVipBikeTrackingHost(window.location.hostname)) return;

    const attribution = captureBrowserMarketingAttribution();

    installMetrikaQueue();
    installMetrikaScript();

    if (!window.__vipBikeMetrikaInitialized) {
      window.ym?.(VIP_BIKE_METRIKA_COUNTER_ID, "init", {
        defer: true,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
      window.__vipBikeMetrikaInitialized = true;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (window.__vipBikeMetrikaLastUrl === currentUrl) return;

    window.ym?.(VIP_BIKE_METRIKA_COUNTER_ID, "hit", currentUrl, {
      title: document.title,
      referer: document.referrer || undefined,
      params: attributionForEvent(attribution),
    });
    window.__vipBikeMetrikaLastUrl = currentUrl;
  }, [pathname, search]);

  return null;
}
