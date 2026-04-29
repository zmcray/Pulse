import { useMemo } from "react";
import {
  useBuildPipelineState,
  useBuildPipelineDispatch,
} from "../../contexts/BuildPipelineContext.jsx";

/**
 * Filter pills for the Build Pipeline.
 *
 * v1: All / by Owner. Category filter is deferred (Linear has no native
 * category field; see plan §11). The owner pill list is derived from
 * project.ownerName; null owners are excluded from the pill list but
 * remain visible under "All".
 */
export default function PipelineFilters() {
  const { projects, filter } = useBuildPipelineState();
  const { setFilter } = useBuildPipelineDispatch();

  const owners = useMemo(() => {
    const seen = new Map(); // name -> count
    for (const p of projects) {
      if (!p.ownerName) continue;
      seen.set(p.ownerName, (seen.get(p.ownerName) || 0) + 1);
    }
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [projects]);

  // Hide owner pills entirely if there's only one owner — pointless filter
  if (owners.length < 2) {
    return null;
  }

  const isActive = (type, value) =>
    filter.type === type && (type === "all" || filter.value === value);

  const pillClass = (active) =>
    `text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
      active
        ? "bg-surface-2 text-text-primary border border-border"
        : "text-text-muted hover:text-text-secondary border border-transparent"
    }`;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        type="button"
        onClick={() => setFilter({ type: "all", value: null })}
        aria-pressed={isActive("all")}
        className={pillClass(isActive("all"))}
      >
        All
      </button>
      {owners.map((owner) => (
        <button
          key={owner}
          type="button"
          onClick={() => setFilter({ type: "owner", value: owner })}
          aria-pressed={isActive("owner", owner)}
          className={pillClass(isActive("owner", owner))}
        >
          {owner}
        </button>
      ))}
    </div>
  );
}
