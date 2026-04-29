import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  BuildPipelineStateContext,
  BuildPipelineDispatchContext,
} from "../contexts/BuildPipelineContext.jsx";
import { useView } from "../contexts/ViewContext.jsx";
import * as api from "../utils/api.js";
import { useAutoRefresh } from "./useAutoRefresh.js";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const FILTER_STORAGE_KEY = "pulse:build-filter";

function loadInitialFilter() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return { type: "all", value: null };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.type === "string") return parsed;
  } catch {
    /* fall through */
  }
  return { type: "all", value: null };
}

/**
 * Loads Linear pipeline data from /api/linear when the user is on the Build
 * tab. Provider is eager-mounted in main.jsx (matches existing convention)
 * but defers the first fetch until view === "build". Auto-refresh also
 * pauses when the user is not on Build.
 *
 * State: projects, issues, loading, error, lastFetched, expandedCardId, filter
 * Dispatch: refresh, setExpandedCardId, setFilter
 *
 * Invariant: after each successful fetch, if expandedCardId no longer
 * matches a project in the new payload, reset to null.
 */
export default function BuildPipelineProvider({ children }) {
  const { view } = useView();
  const [projects, setProjects] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const [expandedCardId, setExpandedCardIdState] = useState(null);
  const [filter, setFilterState] = useState(loadInitialFilter);
  const hasFetchedRef = useRef(false);

  const fetchPipeline = useCallback(async ({ fresh = false } = {}) => {
    setLoading(true);
    try {
      const data = await api.fetchPipeline({ fresh });
      setProjects(data.projects || []);
      setIssues(data.issues || []);
      setError(data.error || null);
      setStale(!!data.stale);
      setLastFetched(data.fetchedAt || Date.now());

      // Invariant: collapse the expanded card if its project is gone
      setExpandedCardIdState((current) => {
        if (!current) return null;
        const stillExists = (data.projects || []).some((p) => p.id === current);
        return stillExists ? current : null;
      });
    } catch (err) {
      setError(err.message || "linear_unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch: gated on view === "build". Run once per session,
  // even if the user toggles back to Daily and returns.
  useEffect(() => {
    if (view === "build" && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPipeline();
    }
  }, [view, fetchPipeline]);

  // Auto-refresh: only ticks while the user is on Build.
  const refreshIfBuildActive = useCallback(() => {
    if (view === "build") fetchPipeline();
  }, [view, fetchPipeline]);
  useAutoRefresh(refreshIfBuildActive, REFRESH_INTERVAL_MS);

  const refresh = useCallback(() => {
    fetchPipeline({ fresh: true });
  }, [fetchPipeline]);

  const setExpandedCardId = useCallback((id) => {
    setExpandedCardIdState((current) => (current === id ? null : id));
  }, []);

  const setFilter = useCallback((nextFilter) => {
    setFilterState(nextFilter);
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(nextFilter));
    } catch {
      /* non-fatal */
    }
  }, []);

  const stateValue = useMemo(
    () => ({
      projects,
      issues,
      loading,
      error,
      stale,
      lastFetched,
      expandedCardId,
      filter,
    }),
    [projects, issues, loading, error, stale, lastFetched, expandedCardId, filter],
  );

  const dispatchValue = useMemo(
    () => ({ refresh, setExpandedCardId, setFilter }),
    [refresh, setExpandedCardId, setFilter],
  );

  return (
    <BuildPipelineStateContext.Provider value={stateValue}>
      <BuildPipelineDispatchContext.Provider value={dispatchValue}>
        {children}
      </BuildPipelineDispatchContext.Provider>
    </BuildPipelineStateContext.Provider>
  );
}
