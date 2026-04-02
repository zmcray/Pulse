import { useState, useCallback, useEffect, useMemo } from "react";
import {
  TasksStateContext,
  TasksDispatchContext,
} from "../contexts/TasksContext.jsx";
import * as api from "../utils/api.js";
import { STATUSES, STATUS_CYCLE } from "../utils/constants.js";
import { todayISO } from "../utils/dates.js";

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
    setTasks((prev) => {
      const old = prev.find((t) => t.id === taskId);
      if (!old) return prev;
      return prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
    });

    try {
      await api.updateTask(taskId, { status: newStatus });
    } catch (err) {
      // Rollback
      setTasks((prev) => {
        const current = prev.find((t) => t.id === taskId);
        if (!current) return prev;
        const prevIndex = STATUS_CYCLE.indexOf(newStatus);
        const rollbackStatus =
          prevIndex > 0 ? STATUS_CYCLE[prevIndex - 1] : STATUS_CYCLE[0];
        return prev.map((t) =>
          t.id === taskId ? { ...t, status: rollbackStatus, error: err.message } : t,
        );
      });
    }
  }, []);

  const cycleStatus = useCallback(
    (taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const currentIndex = STATUS_CYCLE.indexOf(task.status);
      const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
      updateStatus(taskId, STATUS_CYCLE[nextIndex]);
    },
    [tasks, updateStatus],
  );

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
      cycleStatus,
      updateStatus,
      updateNotes,
      setMode,
      refreshTasks,
    }),
    [cycleStatus, updateStatus, updateNotes, refreshTasks],
  );

  return (
    <TasksStateContext.Provider value={stateValue}>
      <TasksDispatchContext.Provider value={dispatchValue}>
        {children}
      </TasksDispatchContext.Provider>
    </TasksStateContext.Provider>
  );
}
