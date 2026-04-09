import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "pulse:adhoc";

/**
 * localStorage-backed ad hoc list. Survives page refresh.
 *
 * Wraps reads and writes in try/catch so private/incognito browsing
 * (where localStorage exists but writes throw) degrades gracefully:
 * the list works in-session but won't persist. The sidebar still renders.
 */
export function useAdHoc() {
  const [items, setItems] = useState(() => loadItems());

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Silent degrade: items live in memory only.
    }
  }, [items]);

  const addItem = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: trimmed, checked: false },
    ]);
  }, []);

  const toggleItem = useCallback((id) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)),
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  return { items, addItem, toggleItem, removeItem };
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
