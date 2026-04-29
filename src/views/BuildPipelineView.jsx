import { useBuildPipelineState } from "../contexts/BuildPipelineContext.jsx";
import PipelineKanban from "../components/build/PipelineKanban.jsx";

export default function BuildPipelineView() {
  const { projects, loading, error, stale, lastFetched } = useBuildPipelineState();

  if (loading && projects.length === 0) {
    return (
      <main className="[grid-area:main] flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading pipeline...</div>
      </main>
    );
  }

  if (error && projects.length === 0) {
    return (
      <main className="[grid-area:main] flex flex-col items-center justify-center gap-3">
        <p className="text-red text-sm">Linear unavailable</p>
        <p className="text-text-muted text-xs">{error}</p>
      </main>
    );
  }

  if (projects.length === 0) {
    return (
      <main className="[grid-area:main] flex items-center justify-center">
        <div className="text-text-muted text-sm">No projects yet.</div>
      </main>
    );
  }

  return (
    <main className="[grid-area:main] overflow-auto py-5 px-6">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted">
          Build Pipeline
        </div>
        {lastFetched && (
          <div className="text-[10px] text-text-muted">
            Updated {new Date(lastFetched).toLocaleTimeString()}
          </div>
        )}
      </div>

      {stale && (
        <div className="bg-[#fef1ee] border border-red/20 rounded-lg px-4 py-2.5 mb-4 text-xs text-red">
          Showing cached data. Linear is unreachable.
        </div>
      )}

      <PipelineKanban projects={projects} />
      <div className="h-10" />
    </main>
  );
}
