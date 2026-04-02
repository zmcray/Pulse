import { useState, useCallback, useEffect, useMemo } from "react";
import {
  TasksStateContext,
  TasksDispatchContext,
} from "../contexts/TasksContext.jsx";
import * as api from "../utils/api.js";
import { STATUSES } from "../utils/constants.js";

export default function TasksProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("normal"); // "normal" | "triage"

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchTasks();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateStatus = useCallback(async (taskId, newStatus) => {
    let previousStatus;
    setTasks((prev) => {
      const old = prev.find((t) => t.id === taskId);
      if (!old) return prev;
      previousStatus = old.status;
      return prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, error: null } : t));
    });

    try {
      await api.updateTask(taskId, { status: newStatus });
    } catch (err) {
      // Rollback to previous status
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: previousStatus, error: err.message } : t,
        ),
      );
    }
  }, []);

  const updateNotes = useCallback(async (taskId, notes) => {
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
