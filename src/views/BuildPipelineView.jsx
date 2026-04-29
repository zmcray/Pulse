import { useBuildPipelineState } from "../contexts/BuildPipelineContext.jsx";

/**
 * Build Pipeline tab — Phase 2 stub.
 *
 * Renders the full state object as JSON so we can verify the data flow
 * end-to-end before building the kanban UI in Phase 3.
 */
export default function BuildPipelineView() {
  const state = useBuildPipelineState();

  if (state.loading && state.projects.length === 0) {
    return (
      <main className="[grid-area:main] flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading pipeline...</div>
      </main>
    );
  }

  if (state.error && state.projects.length === 0) {
    return (
      <main className="[grid-area:main] flex flex-col items-center justify-center gap-3">
        <p className="text-red text-sm">Linear unavailable</p>
        <p className="text-text-muted text-xs">{state.error}</p>
      </main>
    );
  }

  return (
    <main className="[grid-area:main] overflow-y-auto py-5 px-6">
      <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-4">
        Build Pipeline (Phase 2 stub)
      </div>
      {state.stale && (
        <div className="bg-[#fef1ee] border border-red/20 rounded-lg px-4 py-2.5 mb-4 text-xs text-red">
          Showing cached data. Linear is unreachable.
        </div>
      )}
      <pre className="text-[11px] font-mono bg-surface-card border border-border-2 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(
          {
            projectCount: state.projects.length,
            issueCount: state.issues.length,
            stages: state.projects.reduce((acc, p) => {
              acc[p.stage] = (acc[p.stage] || 0) + 1;
              return acc;
            }, {}),
            error: state.error,
            stale: state.stale,
            lastFetched: state.lastFetched
              ? new Date(state.lastFetched).toLocaleString()
              : null,
            sample: state.projects[0] || null,
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}
