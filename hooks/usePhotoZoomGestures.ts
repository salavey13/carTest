"use client";

// hooks/usePhotoZoomGestures.ts
// ─────────────────────────────────────────────────────────────────────────────
// Единый жестовый движок фуллскрин-просмотра фото (boss 2026-09-29 «Improve
// picture view in fullscreen»): щипок-зум с якорем по середине пальцев, пан,
// двойной тап/клик, свайп ← → для навигации, zoom-to-cursor колесом, опции
// «тап вне фото закрывает» (как у лайтбокса rental-страницы) и
// «свайп вниз закрывает» (map-лайтбокс).
//
// Извлечено из проверенного PhotoLightbox стены (CommunityWallClient) —
// движения pointer-ов в ref'ах (не ре-рендер на каждый move), transform на
// stage-обёртке (transform-origin = центр stage, не самой картинки), Chrome
// Android: touch-синтезированный dblclick не должен стрелять после тача.
// Зум-математика — те же чистые computeZoomOffset/zoomAtPoint из
// lib/community-wall.ts (юнит-тестированы), без дублей.
// Потребители: PhotoLightbox стены, MapPhotoLightbox, лайтбокс
// RentalPhotoGallery (ДО/ПОСЛЕ).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { computeZoomOffset, zoomAtPoint } from "@/app/franchize/lib/community-wall";

export function clampZoom(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface PhotoZoomGesturesOptions {
  /** Всего фото (>1 включает свайп-навигацию, за пределами — no-op). */
  count: number;
  index: number;
  onIndexChange?: (next: number) => void;
  onClose?: () => void;
  /** Стольный тап ВНЕ картинки (letterbox/backdrop) закрывает просмотр. */
  closeOnTapOutside?: boolean;
  /** Свайп вниз при натуральном масштабе закрывает (map-лайтбокс). */
  dismissOnDragDown?: boolean;
  minScale?: number;
  maxScale?: number;
}

const TAP_MOVE_PX = 12;
const TAP_MAX_MS = 350;
const SWIPE_PX = 60;
const DISMISS_DRAG_PX = 80;

export function usePhotoZoomGestures({
  count,
  index,
  onIndexChange,
  onClose,
  closeOnTapOutside = false,
  dismissOnDragDown = false,
  minScale = 1,
  maxScale = 5,
}: PhotoZoomGesturesOptions) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [smooth, setSmooth] = useState(true);
  /** Follow-смещение при свайпе-вниз (dismissOnDragDown), px. */
  const [dragY, setDragY] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number; ox: number; oy: number; midX: number; midY: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const downMeta = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  // Chrome Android synthesizes dblclick from touch — the mouse-only zoom path
  // must not fire after a touch gesture (it would instantly cancel it).
  const lastPointerType = useRef<string>("mouse");
  // The stage container (NOT the transformed image — its own rect moves with
  // the transform) is the transform-origin reference for zoom anchoring.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setSmooth(true);
    setDragY(0);
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = clampZoom(index + delta, 0, count - 1);
      if (next !== index) {
        reset();
        onIndexChange?.(next);
      }
    },
    [index, count, onIndexChange, reset],
  );

  // Wheel state mirrored into a ref: the native wheel listener registers ONCE
  // (no teardown/re-add churn per zoom step) and always reads fresh values.
  const wheelState = useRef({ scale: 1, offset: { x: 0, y: 0 } });
  useEffect(() => {
    wheelState.current = { scale, offset };
  }, [scale, offset]);

  function stageCenter(): { x: number; y: number } {
    const el = stageRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  // Wheel zoom-to-cursor. Registered NATIVELY with { passive: false } —
  // React 18 attaches wheel at the root as passive, so e.preventDefault()
  // inside a React onWheel prop would be a silent no-op.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const { scale: curScale, offset: curOffset } = wheelState.current;
      const nextScale = clampZoom(curScale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), minScale, maxScale);
      if (nextScale === minScale) {
        setScale(minScale);
        setOffset({ x: 0, y: 0 });
        return;
      }
      setOffset(zoomAtPoint(curScale, curOffset, { x: e.clientX, y: e.clientY }, stageCenter(), nextScale));
      setScale(nextScale);
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [minScale, maxScale]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastPointerType.current = e.pointerType;
      setSmooth(false);
      downMeta.current = { x: e.clientX, y: e.clientY, time: Date.now() };

      if (pointers.current.size === 1) {
        // Double-tap detection — TOUCH only, at ANY scale (so a double-tap while
        // zoomed resets). For mice the native dblclick handler is the path.
        if (e.pointerType !== "mouse") {
          const now = Date.now();
          const last = lastTap.current;
          if (last && now - last.time < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
            if (scale > minScale + 0.01) {
              setScale(1);
              setOffset({ x: 0, y: 0 });
              setDragY(0);
            } else {
              setScale(2.5);
              setOffset(zoomAtPoint(1, { x: 0, y: 0 }, { x: e.clientX, y: e.clientY }, stageCenter(), 2.5));
            }
            lastTap.current = null;
            swipeStart.current = null;
            panStart.current = null;
            return;
          }
          lastTap.current = { time: now, x: e.clientX, y: e.clientY };
        }
        if (scale > 1) {
          panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        } else {
          swipeStart.current = { x: e.clientX, y: e.clientY };
        }
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchStart.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          scale,
          ox: offset.x, // preserve the pan the user already had
          oy: offset.y,
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
        };
        swipeStart.current = null;
        panStart.current = null;
      }
    },
    [minScale, offset.x, offset.y, scale],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2 && pinchStart.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const start = pinchStart.current;
        const nextScale = clampZoom((start.scale * dist) / Math.max(start.dist, 1), minScale, maxScale);
        // Anchor the pinch midpoint exactly at ANY start scale (ratio, not a
        // linear delta) and preserve the pre-pinch pan offset.
        setOffset(
          computeZoomOffset({
            startScale: start.scale,
            startOffset: { x: start.ox, y: start.oy },
            startMid: { x: start.midX, y: start.midY },
            currentMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            center: stageCenter(),
            nextScale,
          }),
        );
        setScale(nextScale);
      } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
        const start = panStart.current;
        setOffset({ x: start.ox + (e.clientX - start.x), y: start.oy + (e.clientY - start.y) });
      } else if (pointers.current.size === 1 && swipeStart.current && dismissOnDragDown && scale <= 1.01) {
        // Follow-режим свайпа вниз (map-лайтбокс): тянем палец — картинка едет.
        const startY = swipeStart.current.y;
        const dy = e.clientY - startY;
        const dx = e.clientX - swipeStart.current.x;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2) setDragY(dy);
        else setDragY(0);
      }
    },
    [minScale, maxScale, scale, dismissOnDragDown],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const hadTwo = pointers.current.size === 2;
      pointers.current.delete(e.pointerId);
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      // A pinch gesture must not leave a stale tap marker: the next single-finger
      // touch within 300ms of the pinch start would otherwise false-fire the
      // double-tap reset mid-adjustment.
      if (hadTwo) lastTap.current = null;

      if (pointers.current.size === 0) {
        const down = downMeta.current;
        downMeta.current = null;
        // swipe navigation / dismiss only at natural zoom
        const swipe = swipeStart.current;
        if (swipe && scale <= 1.01 && !hadTwo) {
          const dx = e.clientX - swipe.x;
          const dy = e.clientY - swipe.y;
          if (dismissOnDragDown && dy > DISMISS_DRAG_PX && Math.abs(dy) > Math.abs(dx) * 1.2) {
            swipeStart.current = null;
            setDragY(0);
            onClose?.();
            return;
          }
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
            swipeStart.current = null;
            go(dx < 0 ? 1 : -1);
            return;
          }
        }
        swipeStart.current = null;
        panStart.current = null;
        pinchStart.current = null;
        if (scale <= 1.05) {
          setScale(1);
          setOffset({ x: 0, y: 0 });
        }
        setDragY(0);
        setSmooth(true);

        // Тап (не жест) ВНЕ картинки → закрыть (поведение лайтбокса rental-
        // страницы: backdrop-клик закрывает, клик по фото — нет).
        if (
          closeOnTapOutside &&
          down &&
          Date.now() - down.time < TAP_MAX_MS &&
          Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MOVE_PX &&
          scale <= 1.01 &&
          !hadTwo &&
          imgRef.current &&
          e.target !== imgRef.current
        ) {
          onClose?.();
        }
      } else if (pointers.current.size === 1) {
        // two → one: re-anchor panning to the remaining finger
        const [rest] = [...pointers.current.values()];
        pinchStart.current = null;
        if (scale > 1) panStart.current = { x: rest.x, y: rest.y, ox: offset.x, oy: offset.y };
      }
    },
    [closeOnTapOutside, dismissOnDragDown, go, offset.x, offset.y, onClose, scale],
  );

  // Desktop zoom: native dblclick (guarded against touch-synthesized dblclick).
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (lastPointerType.current !== "mouse") return;
      if (scale > 1) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      } else {
        setScale(2.5);
        setOffset(zoomAtPoint(1, { x: 0, y: 0 }, { x: e.clientX, y: e.clientY }, stageCenter(), 2.5));
      }
    },
    [scale],
  );

  return {
    scale,
    offset,
    smooth,
    dragY,
    stageRef,
    imgRef,
    reset,
    go,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    canPrev: index > 0,
    canNext: index < count - 1,
  };
}
