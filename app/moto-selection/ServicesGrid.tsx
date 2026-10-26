"use client";

/**
 * MsServicesGrid — the /moto-selection services grid (7 cards, 1:1 with the
 * original artboard rec499421781) extracted into a client component.
 *
 * WHY client: the boss's unblur request is not hover-only — «unblur upon
 * ACTIVE/HOVER state ... pictures still are blurred when SELECTED/hovered».
 * PC hover is pure CSS (.ms-glass rules in the page's <style> block), but
 * touch has no hover: the FIRST tap reveals the card (glass fades away),
 * the SECOND tap follows the anchor link. Same interaction grammar as the
 * partner cards (components/partners/PartnerRevealCard.tsx).
 *
 * Ground truth (probed on moto-selection.ru, 2026-10-27): hover there does
 * NOT go «blur(5px)→blur(0) with the tint kept» — the sbs-anim fades the
 * WHOLE glass (black 60% tint + blur) to opacity 0. The old implementation
 * kept rgba(0,0,0,.6) on top of the sharpened photo, which on dark photos
 * still read as «blurred» — that's why the boss kept seeing no effect.
 * The page <style> now fades .ms-glass opacity → 0 on hover; the
 * data-active attribute below extends it to taps.
 */

import Image from "next/image";
import { Truck } from "lucide-react";
import { useRef, useState } from "react";

export interface MsServiceItem {
  id: string;
  title: string;
  img?: string;
  price?: string;
  text: string;
  anchor: string;
}

export function MsServicesGrid({
  services,
  brand,
}: {
  services: MsServiceItem[];
  brand: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastPointerWasTouch = useRef(false);

  return (
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-9">
      {services.map((s, svcIdx) => {
        const isActive = activeId === s.id;
        return (
          <a
            key={s.id}
            href={s.anchor}
            data-active={isActive ? "true" : "false"}
            className="ms-card group relative flex min-h-[320px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] transition hover:border-[var(--ms-accent)]/60"
            onPointerDown={(e) => {
              lastPointerWasTouch.current = e.pointerType === "touch";
            }}
            onClick={(e) => {
              // Touch: first tap reveals (glass fades), second tap follows
              // the anchor. Mouse/keyboard: navigate immediately.
              if (lastPointerWasTouch.current && !isActive) {
                e.preventDefault();
                setActiveId(s.id);
              }
            }}
          >
            {s.img ? (
              <Image
                src={s.img}
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              // Эвакуация — единственная услуга без фото на оригинале:
              // фирменный оранжевый блок с иконкой вместо картинки.
              <div
                className="absolute inset-0"
                aria-hidden
                style={{ background: `linear-gradient(135deg, ${brand} 0%, #c24e0d 100%)` }}
              >
                <Truck className="absolute right-5 top-5 h-14 w-14 text-black/70" aria-hidden />
                <span className="absolute right-5 top-24 rounded-full bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  24/7
                </span>
              </div>
            )}
            {/* фирменное стекло оригинала: чёрный 60% + blur(5px); ховер/тап
                снимает стекло ЦЕЛИКОМ (opacity 0 — как sbs-anim оригинала) */}
            <div className="ms-glass absolute inset-0" aria-hidden />
            <div className="relative z-10 flex flex-1 flex-col items-center p-6 text-center">
              {/* нумерал наполовину «выходит» из-под верхнего края карточки
                  (оригинал: 120px, top = card − 53px); overflow-hidden срезает
                  верхнюю часть — эффект появления из-за кромки */}
              <span
                aria-hidden
                className="pointer-events-none -mt-12 select-none text-[88px] font-bold leading-none text-white/85 transition duration-300 group-hover:text-[var(--ms-accent)] sm:text-[110px]"
              >
                {String(svcIdx + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-lg font-normal uppercase leading-snug text-white">{s.title}</h3>
              {s.price && (
                <span className="mt-2 rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white/85">
                  {s.price}
                </span>
              )}
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-white/55">{s.text}</p>
              <span
                className="mt-auto inline-flex h-12 w-[200px] items-center justify-center self-center rounded-[30px] bg-[var(--ms-accent)] text-xs font-semibold uppercase tracking-[0.08em] text-white transition group-hover:brightness-110"
                style={{ marginTop: "auto" }}
              >
                Подробнее
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
