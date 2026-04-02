import { useRef, useEffect, useCallback } from "react";

export default function useAutoSave(value, saveFn, delay = 500) {
  const timeoutRef = useRef(null);
  const savedRef = useRef(value);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  useEffect(() => {
    if (value === savedRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      savedRef.current = value;
      saveFnRef.current(value);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (value !== savedRef.current) {
      savedRef.current = value;
      saveFnRef.current(value);
    }
  }, [value]);

  return { flush };
}
