"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MapPhotoLightbox — fullscreen photo viewer for LEAFLET POPUP photos on the
// map-riders page. Rendered through createPortal(document.body): a Leaflet
// popup is trapped inside .leaflet-pane stacking contexts (z ~700), so an
// in-popup overlay can never cover the screen. The portal also escapes the
// sliding-sheet (Vaul) and drawer layers of the page.
//
// Minimal on purpose (vs the wall's gesture-rich PhotoLightbox): popups show
// ONE photo — open/close + swipe-down-to-dismiss + ESC covers the flow. Swipe
// uses pointer events on the image only, so backdrop taps stay reserved for
// close and never fight Leaflet (the portal lives outside the map DOM).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface MapPhotoLightboxData {
  url: string;
  caption: string;
}

export function MapPhotoLightbox({ photo, onClose }: { photo: MapPhotoLightboxData | null; onClose: () => void }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  // a11y: вернуть фокус открывателю при закрытии — механика в эффекте ниже
  // (сейв ДО императивного фокуса, см. комментарий там).
  const lastFocusedRef = useRef<Element | null>(null);

  // ESC closes — keyboard parity with the wall lightbox. Mounted only while
  // open, so the listener lifecycle follows the portal lifecycle.
  useEffect(() => {
    if (!photo) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, onClose]);

  // a11y: save/restore focus around the open state (wall PhotoLightbox parity).
  // ВАЖНО: сейв ДО фокуса в том же эффекте — autoFocus (commitMount, layout
  // фаза) перебивает document.activeElement раньше пассивного эффекта, и в
  // сейв попала бы кнопка закрытия вместо открывателя. Поэтому фокус ставим
  // императивно здесь, а не через autoFocus.
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!photo) return;
    lastFocusedRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      const prev = lastFocusedRef.current;
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus();
    };
  }, [photo]);

  // Reset transient gesture state whenever the viewer opens for another photo.
  useEffect(() => {
    setDragY(0);
    setDragging(false);
  }, [photo]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    // Touch gets implicit capture; MOUSE does not — without explicit capture a
    // drag that leaves the img never sees pointerup, `dragging` freezes true
    // and the photo starts chasing the cursor (wall lightbox does the same).
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startYRef.current = event.clientY;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (!dragging) return;
      setDragY(Math.max(0, event.clientY - startYRef.current));
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (dragY > 80) onClose();
    else setDragY(0);
  }, [dragging, dragY, onClose]);

  // Static render (SSR / closed): portal target is client-only, and mounting
  // an empty portal would be dead DOM anyway.
  if (!photo || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || "Фото точки"}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(event) => {
        // Единственная фокусируемая цель + aria-modal: Tab зацикливаем на
        // кнопке закрытия, чтобы фокус не утекал на страницу под порталом.
        if (event.key === "Tab") event.preventDefault();
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          // Не дублируем onClose через bubbling до backdrop-обработчика.
          event.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть"
        ref={closeRef}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- wallpix CDN URL, same as the popup renders */}
      <img
        src={photo.url}
        alt={photo.caption || "Фото"}
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] max-w-[92vw] touch-none select-none rounded-lg object-contain shadow-2xl"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 180ms ease-out",
          opacity: dragging ? Math.max(0.4, 1 - dragY / 400) : 1,
        }}
      />
      {photo.caption ? (
        <div
          className="absolute bottom-5 left-1/2 max-w-[86vw] -translate-x-1/2 truncate rounded-full bg-black/50 px-4 py-1.5 text-xs font-medium text-white/90"
          onClick={(event) => event.stopPropagation()}
        >
          {photo.caption}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
