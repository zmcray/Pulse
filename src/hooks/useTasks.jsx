import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  TasksStateContext,
  TasksDispatchContext,
} from "../contexts/TasksContext.jsx";
import * as api from "../utils/api.js";
import { useAutoRefresh } from "./useAutoRefresh.js";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function TasksProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("normal"); // "normal" | "triage"

  // Tracks task IDs with in-flight mutations. Auto-refresh skips merging
  // these to prevent the optimistic update from flashing back when the
  // poll race-conditions with a write.
  const pendingWritesRef = useRef(new Set());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchTasks();
      setTasks((prev) => {
        const pending = pendingWritesRef.current;
        if (pending.size === 0) return data;
        // Preserve in-flight tasks from local state, merge the rest from server
        const preserved = new Map();
        for (const t of prev) {
          if (pending.has(t.id)) preserved.set(t.id, t);
        }
        return data.map((t) => preserved.get(t.id) || t);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useAutoRefresh(fetchTasks, REFRESH_INTERVAL_MS);

  const updateStatus = useCallback(async (taskId, newStatus) => {
    let previousStatus;
    pendingWritesRef.current.add(taskId);
    setTasks((prev) => {
      const old = prev.find((t) => t.id === taskId);
      if (!old) return prev;
      previousStatus = old.status;
      return prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, error: null } : t,
      );
    });

    try {
      await api.updateTask(taskId, { status: newStatus });
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: previousStatus, error: err.message }
            : t,
        ),
      );
    } finally {
      pendingWritesRef.current.delete(taskId);
    }
  }, []);

  const updateNotes = useCallback(async (taskId, notes) => {
    pendingWritesRef.current.add(taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, notes } : t)),
    );
    try {
      await api.updateTask(taskId, { notes });
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, notesError: err.message } : t,
        ),
      );
    } finally {
      pendingWritesRef.current.delete(taskId);
    }
  }, []);

  const refreshTasks = useCallback(() => {
    fetchTasks();
  }, [fetchTasks]);

  const stateValue = useMemo(
    () => ({ tasks, loading, error, mode }),
    [tasks, loading, error, mode],
  );

  const dispatchValue = useMemo(
    () => ({
      updateStatus,
      updateNotes,
      setMode,
      refreshTasks,
    }),
    [updateStatus, updateNotes, refreshTasks],
  );

  return (
    <TasksStateContext.Provider value={stateValue}>
      <TasksDispatchContext.Provider value={dispatchValue}>
        {children}
      </TasksDispatchContext.Provider>
    </TasksStateContext.Provider>
  );
}
