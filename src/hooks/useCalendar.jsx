import { useState, useCallback, useEffect, useMemo } from "react";
import {
  CalendarStateContext,
  CalendarDispatchContext,
} from "../contexts/CalendarContext.jsx";
import * as api from "../utils/api.js";
import { useAutoRefresh } from "./useAutoRefresh.js";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Loads calendar data from /api/calendar on mount and re-fetches every 5 min.
 * Provides workblocks (with dynamic order) and calls to consumers.
 *
 * On error, sets state.error and leaves workblocks/calls empty.
 * App.jsx falls back to the static WORKBLOCK_ORDER from constants.js
 * when state.workblocks is empty.
 */
export default function CalendarProvider({ children }) {
  const [workblocks, setWorkblocks] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCalendar = useCallback(async () => {
    try {
      const data = await api.fetchCalendar();
      setWorkblocks(data.workblocks || []);
      setCalls(data.calls || []);
      setError(data.error || null);
    } catch (err) {
      setError(err.message || "calendar_unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useAutoRefresh(fetchCalendar, REFRESH_INTERVAL_MS);

  const refreshCalendar = useCallback(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const stateValue = useMemo(
    () => ({ workblocks, calls, loading, error }),
    [workblocks, calls, loading, error],
  );

  const dispatchValue = useMemo(
    () => ({ refreshCalendar }),
    [refreshCalendar],
  );

  return (
    <CalendarStateContext.Provider value={stateValue}>
      <CalendarDispatchContext.Provider value={dispatchValue}>
        {children}
      </CalendarDispatchContext.Provider>
    </CalendarStateContext.Provider>
  );
}
