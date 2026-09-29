"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MapPhotoLightbox — fullscreen photo viewer for LEAFLET POPUP photos on the
// map-riders page. Rendered through createPortal(document.body): a Leaflet
// popup is trapped inside .leaflet-pane stacking contexts (z ~700), so an
// in-popup overlay can never cover the screen. The portal also escapes the
// sliding-sheet (Vaul) and drawer layers of the page.
//
// BOSS 2026-09-29: жесты переехали в общий движок usePhotoZoomGestures —
// щипок-зум/двойной тап/пан как у лайтбокса стены, кнопка закрытия ПО ЦЕНТРУ
// сверху (углы заняты нативными кнопками Telegram), свайп вниз закрывает,
// тап вне фото закрывает. Одна фотография — стрелок нет.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { usePhotoZoomGestures } from "@/hooks/usePhotoZoomGestures";

export interface MapPhotoLightboxData {
  url: string;
  caption: string;
}

export function MapPhotoLightbox({ photo, onClose }: { photo: MapPhotoLightboxData | null; onClose: () => void }) {
  const gestures = usePhotoZoomGestures({
    count: 1, // одна фотография — свайп-навигация не нужна
    index: 0,
    onClose,
    dismissOnDragDown: true, // свайп вниз закрывает (был и раньше)
    closeOnTapOutside: true,
  });
  const {
    scale,
    offset,
    smooth,
    dragY,
    stageRef,
    imgRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
  } = gestures;

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
      {/* Кнопка закрытия ПО ЦЕНТРУ сверху: в Telegram MiniApp правый верхний
          угол занимает нативная «×» WebView, левый — «⬎»/назад. */}
      <button
        type="button"
        onClick={(event) => {
          // Не дублируем onClose через bubbling до backdrop-обработчика.
          event.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть"
        ref={closeRef}
        className="absolute left-1/2 top-3 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
      >
        <X className="h-5 w-5" />
      </button>
      {/* image stage: жестовый слой на весь экран — щипок ловится и по
          letterbox-полям; картинка следует за drag-down до закрытия. */}
      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          style={{
            transform: `translate(${offset.x}px, ${offset.y + dragY}px) scale(${scale})`,
            transition: smooth ? "transform 200ms ease-out" : "none",
            willChange: "transform",
            touchAction: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- wallpix CDN URL, same as the popup renders */}
          <img
            ref={imgRef}
            src={photo.url}
            alt={photo.caption || "Фото"}
            draggable={false}
            className="max-h-[85vh] max-w-[92vw] touch-none select-none rounded-lg object-contain shadow-2xl"
            style={{
              opacity: dragY > 0 ? Math.max(0.4, 1 - dragY / 400) : 1,
            }}
          />
        </div>
      </div>
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
