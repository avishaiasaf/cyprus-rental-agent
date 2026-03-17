'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'saved-searches';

export interface SavedSearch {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

function loadSearches(): SavedSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearches(searches: SavedSearch[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  } catch {
    // ignore
  }
}

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setSearches(loadSearches());
  }, []);

  const addSearch = useCallback((name: string, filters: Record<string, string>) => {
    setSearches((prev) => {
      const next = [
        ...prev,
        {
          id: crypto.randomUUID(),
          name,
          filters,
          createdAt: new Date().toISOString(),
        },
      ];
      saveSearches(next);
      return next;
    });
  }, []);

  const removeSearch = useCallback((id: string) => {
    setSearches((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSearches(next);
      return next;
    });
  }, []);

  return { searches, addSearch, removeSearch };
}
