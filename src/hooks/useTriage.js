import { useState, useCallback, useMemo } from "react";
import { useTasksDispatch } from "../contexts/TasksContext.jsx";
import { submitTriage } from "../utils/api.js";

export default function useTriage(incompleteTasks) {
  const [dispositions, setDispositions] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { refreshTasks, setMode } = useTasksDispatch();

  const setDisposition = useCallback((taskId, action) => {
    setDispositions((prev) => ({ ...prev, [taskId]: action }));
  }, []);

  const assignedCount = useMemo(
    () => Object.values(dispositions).filter(Boolean).length,
    [dispositions],
  );

  const confirmAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const entries = Object.entries(dispositions)
      .filter(([_, action]) => action)
      .map(([taskId, action]) => ({ taskId, action }));

    try {
      const result = await submitTriage(entries);
      if (result.errors && result.errors.length > 0) {
        setError(`${result.errors.length} tasks failed to update`);
      } else {
        refreshTasks();
        setMode("normal");
        setDispositions({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dispositions, refreshTasks, setMode]);

  return {
    dispositions,
    setDisposition,
    assignedCount,
    loading,
    error,
    confirmAll,
  };
}
