/**
 * Top-of-pipeline summary counts.
 *
 * Active = Building + Live (Beta). The user wants one glance to tell
 * the difference between "in motion" and "done shipping" stages.
 */
export default function PipelineStats({ projects }) {
  const counts = projects.reduce(
    (acc, p) => {
      acc.total++;
      if (p.stage === "Idea") acc.idea++;
      else if (p.stage === "Scoped") acc.scoped++;
      else if (p.stage === "Building" || p.stage === "Live (Beta)") acc.active++;
      else if (p.stage === "Stable") acc.stable++;
      return acc;
    },
    { total: 0, idea: 0, scoped: 0, active: 0, stable: 0 },
  );

  const stat = (label, value) => (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className="font-semibold text-sm tabular-nums text-text-primary">
        {value}
      </span>
    </div>
  );

  return (
    <div className="flex items-center gap-5 px-3 py-2 bg-surface-card border border-border-2 rounded-lg">
      {stat("Total", counts.total)}
      <span className="w-px h-3 bg-border" />
      {stat("Idea", counts.idea)}
      {stat("Scoped", counts.scoped)}
      {stat("Active", counts.active)}
      {stat("Stable", counts.stable)}
    </div>
  );
}
