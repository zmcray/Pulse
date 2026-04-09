import { useEffect, useRef } from "react";

/**
 * Shared auto-refresh hook used by TasksProvider and CalendarProvider.
 *
 * Calls `fetchFn` on a setInterval. Cleans up on unmount. The interval
 * holds a ref to the latest fetchFn so consumers don't need to memoize.
 *
 * Per the design review, no Page Visibility API pause -- the cost analysis
 * showed background polling for one user is well under the Vercel free tier.
 */
export function useAutoRefresh(fetchFn, intervalMs) {
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;
    const id = setInterval(() => fnRef.current?.(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
