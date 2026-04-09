import { createContext, useContext } from "react";

export const TasksStateContext = createContext(null);
export const TasksDispatchContext = createContext(null);

export function useTasksState() {
  const ctx = useContext(TasksStateContext);
  if (!ctx) throw new Error("useTasksState must be used within TasksProvider");
  return ctx;
}

export function useTasksDispatch() {
  const ctx = useContext(TasksDispatchContext);
  if (!ctx)
    throw new Error("useTasksDispatch must be used within TasksProvider");
  return ctx;
}

export { default as TasksProvider } from "../hooks/useTasks.jsx";
