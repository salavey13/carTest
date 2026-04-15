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
      longPressTimerRef.current = setTimeout(() => {
        onMapLongPress?.([event.latlng.lat, event.latlng.lng]);
        longPressTriggeredRef.current = true;
      }, longPressDelay);
    };

    const handleTouchMove = () => {
      clearLongPress();
    };

    const handleTouchEnd = () => {
      // Touch tap should not place meetup accidentally.
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
      if (typeof window !== "undefined" && !("ontouchstart" in window)) {
        onMapClick?.([event.latlng.lat, event.latlng.lng]);
      }
    },
  });

  return null;
}
