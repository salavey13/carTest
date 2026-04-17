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
  const touchStartRef = useRef<{ timestamp: number; lat: number; lng: number } | null>(null);

  const TOUCH_MOVE_CANCEL_METERS = 18;

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTriggeredRef.current = false;
  }, []);

  useEffect(() => {
    const handleContextMenu = (event: L.LeafletMouseEvent) => {
      event.originalEvent.preventDefault();
      onMapLongPress?.([event.latlng.lat, event.latlng.lng]);
      longPressTriggeredRef.current = true;
    };

    const handleTouchStart = (event: L.LeafletMouseEvent) => {
      clearLongPress();
      touchStartRef.current = {
        timestamp: Date.now(),
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };
      longPressTimerRef.current = setTimeout(() => {
        onMapLongPress?.([event.latlng.lat, event.latlng.lng]);
        longPressTriggeredRef.current = true;
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
        onMapLongPress?.([started.lat, started.lng]);
      }
      touchStartRef.current = null;
      clearLongPress();
    };

    map.on("contextmenu", handleContextMenu);
    map.on("touchstart", handleTouchStart);
    map.on("touchmove", handleTouchMove);
    map.on("touchend", handleTouchEnd);

    return () => {
      clearLongPress();
      map.off("contextmenu", handleContextMenu);
      map.off("touchstart", handleTouchStart);
      map.off("touchmove", handleTouchMove);
      map.off("touchend", handleTouchEnd);
    };
  }, [map, onMapClick, onMapLongPress, longPressDelay, clearLongPress]);

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
