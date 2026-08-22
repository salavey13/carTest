"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import type L from "leaflet";

interface MapInteractionCaptureProps {
  onMapClick?: (coords: [number, number]) => void;
  onMapLongPress?: (coords: [number, number]) => void;
  longPressDelay?: number;
}

export function MapInteractionCapture({
  onMapClick,
  onMapLongPress,
  longPressDelay = 500,
}: MapInteractionCaptureProps) {
  const map = useMap();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const clickSuppressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ timestamp: number; lat: number; lng: number } | null>(null);

  const TOUCH_MOVE_CANCEL_METERS = 3;

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const triggerLongPress = useCallback(
    (coords: [number, number]) => {
      if (longPressTriggeredRef.current) return;
      longPressTriggeredRef.current = true;
      if (clickSuppressionTimerRef.current) clearTimeout(clickSuppressionTimerRef.current);
      clickSuppressionTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = false;
        clickSuppressionTimerRef.current = null;
      }, 700);
      onMapLongPress?.(coords);
    },
    [onMapLongPress],
  );

  useEffect(() => {
    const handleContextMenu = (event: L.LeafletMouseEvent) => {
      event.originalEvent.preventDefault();
      clearLongPress();
      triggerLongPress([event.latlng.lat, event.latlng.lng]);
    };

    const handleTouchStart = (event: L.LeafletMouseEvent) => {
      clearLongPress();
      longPressTriggeredRef.current = false;
      touchStartRef.current = {
        timestamp: Date.now(),
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };
      longPressTimerRef.current = setTimeout(() => {
        triggerLongPress([event.latlng.lat, event.latlng.lng]);
      }, longPressDelay);
    };

    const handleTouchMove = (event: L.LeafletMouseEvent) => {
      const started = touchStartRef.current;
      if (!started) return;
      const movedMeters = map.distance([started.lat, started.lng], event.latlng);
      if (movedMeters >= TOUCH_MOVE_CANCEL_METERS) {
        clearLongPress();
        touchStartRef.current = null;
      }
    };

    const handleTouchEnd = () => {
      const started = touchStartRef.current;
      const holdMs = started ? Date.now() - started.timestamp : 0;
      if (!longPressTriggeredRef.current && started && holdMs >= longPressDelay) {
        triggerLongPress([started.lat, started.lng]);
      }
      touchStartRef.current = null;
      clearLongPress();
    };

    map.on("contextmenu", handleContextMenu);
    const cancelOnMoveStart = () => {
      clearLongPress();
      touchStartRef.current = null;
      longPressTriggeredRef.current = false;
    };

    map.on("touchstart" as keyof L.LeafletEventHandlerFnMap, handleTouchStart as L.LeafletEventHandlerFn);
    map.on("touchmove" as keyof L.LeafletEventHandlerFnMap, handleTouchMove as L.LeafletEventHandlerFn);
    map.on("touchend" as keyof L.LeafletEventHandlerFnMap, handleTouchEnd as L.LeafletEventHandlerFn);
    map.on("movestart", cancelOnMoveStart);
    map.on("zoomstart", cancelOnMoveStart);

    return () => {
      clearLongPress();
      if (clickSuppressionTimerRef.current) {
        clearTimeout(clickSuppressionTimerRef.current);
        clickSuppressionTimerRef.current = null;
      }
      map.off("contextmenu", handleContextMenu);
      map.off("touchstart" as keyof L.LeafletEventHandlerFnMap, handleTouchStart as L.LeafletEventHandlerFn);
      map.off("touchmove" as keyof L.LeafletEventHandlerFnMap, handleTouchMove as L.LeafletEventHandlerFn);
      map.off("touchend" as keyof L.LeafletEventHandlerFnMap, handleTouchEnd as L.LeafletEventHandlerFn);
      map.off("movestart", cancelOnMoveStart);
      map.off("zoomstart", cancelOnMoveStart);
    };
  }, [map, triggerLongPress, longPressDelay, clearLongPress]);

  useMapEvents({
    click(event) {
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        return;
      }
      onMapClick?.([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}
