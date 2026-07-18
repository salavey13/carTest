"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

export interface VirtualListOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useVirtualList<T>(
  items: T[],
  options: VirtualListOptions
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { itemHeight, containerHeight, overscan = 5 } = options;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
    scrollMargin: 0,
  });

  return {
    parentRef,
    virtualItems: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize(),
    scrollToIndex: virtualizer.scrollToIndex,
  };
}

export function useVirtualGrid<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  columns: number,
  overscan: number = 5
) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: Math.ceil(items.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
    scrollMargin: 0,
    horizontal: false,
  });

  return {
    parentRef,
    virtualRows: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize(),
    scrollToIndex: virtualizer.scrollToIndex,
  };
}