"use client";

import { useState, useRef, useCallback } from "react";

interface UseServerTableOptions<T> {
  initialItems: T[];
  initialTotal: number;
  fetchFn: (params: Record<string, string>, signal: AbortSignal) => Promise<{ items: T[]; total: number }>;
}

interface UseServerTableReturn<T> {
  items: T[];
  total: number;
  loading: boolean;
  isStale: boolean;
  fetchData: (params: Record<string, string>) => void;
  debouncedFetch: (params: Record<string, string>, delay?: number) => void;
}

export function useServerTable<T>({
  initialItems,
  initialTotal,
  fetchFn,
}: UseServerTableOptions<T>): UseServerTableReturn<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [prevData, setPrevData] = useState<T[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (params: Record<string, string>) => {
      // Cancel previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Keep previous data visible during loading
      setItems((current) => { setPrevData((prev) => prev ?? current); return current; });
      setLoading(true);

      try {
        const data = await fetchFn(params, controller.signal);
        setPrevData(null);
        setItems(data.items);
        setTotal(data.total ?? 0);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Fetch error:", err);
        setPrevData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [fetchFn]
  );

  const debouncedFetch = useCallback(
    (params: Record<string, string>, delay: number = 300) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(params), delay);
    },
    [fetchData]
  );

  // Show previous data while loading, current data otherwise
  const display = loading && prevData ? prevData : items;
  const isStale = loading && prevData !== null;

  return { items: display, total, loading, isStale, fetchData, debouncedFetch };
}
