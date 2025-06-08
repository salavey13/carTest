"use client";
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Очистка таймера при размонтировании компонента или изменении value/delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Перезапускать эффект только если value или delay изменились

  return debouncedValue;
}