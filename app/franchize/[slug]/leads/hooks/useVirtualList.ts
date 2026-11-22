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
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan,
    scrollMargin: 0,
  });

  return {
    parentRef,
    virtualItems: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize(),
    scrollToIndex: virtualizer.scrollToIndex,
    measureElement: virtualizer.measureElement,
  };
}

