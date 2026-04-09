import { createContext, useContext } from "react";

export const CalendarStateContext = createContext(null);
export const CalendarDispatchContext = createContext(null);

export function useCalendarState() {
  const ctx = useContext(CalendarStateContext);
  if (!ctx)
    throw new Error("useCalendarState must be used within CalendarProvider");
  return ctx;
}

export function useCalendarDispatch() {
  const ctx = useContext(CalendarDispatchContext);
  if (!ctx)
    throw new Error("useCalendarDispatch must be used within CalendarProvider");
  return ctx;
}

export { default as CalendarProvider } from "../hooks/useCalendar.jsx";
