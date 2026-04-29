import { createContext, useContext, useState, useEffect, useMemo } from "react";

const ViewContext = createContext(null);

const STORAGE_KEY = "pulse:active-view";
const VIEWS = ["daily", "build"];

function loadInitialView() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VIEWS.includes(stored) ? stored : "daily";
  } catch {
    return "daily";
  }
}

export function ViewProvider({ children }) {
  const [view, setView] = useState(loadInitialView);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      /* private mode / quota — non-fatal */
    }
  }, [view]);

  const value = useMemo(() => ({ view, setView }), [view]);

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used within ViewProvider");
  return ctx;
}
