import { useMemo } from "react";
import { useBuildPipelineState } from "../contexts/BuildPipelineContext.jsx";
import PipelineKanban from "../components/build/PipelineKanban.jsx";
import PipelineStats from "../components/build/PipelineStats.jsx";
import PipelineFilters from "../components/build/PipelineFilters.jsx";

function applyFilter(projects, filter) {
  if (!filter || filter.type === "all") return projects;
  if (filter.type === "owner") {
    return projects.filter((p) => p.ownerName === filter.value);
  }
  return projects;
}

export default function BuildPipelineView() {
  const { projects, loading, error, stale, lastFetched, filter } =
    useBuildPipelineState();

  const visibleProjects = useMemo(
    () => applyFilter(projects, filter),
    [projects, filter],
  );

  // Soft warning chip: count projects that fell into Idea due to no Stage line.
  // We can't tell from the client alone (the stage was already parsed server-side),
  // but if more than 80% of projects are Idea, that's a strong signal.
  const ideaCount = projects.filter((p) => p.stage === "Idea").length;
  const showStageWarning = projects.length >= 5 && ideaCount / projects.length > 0.8;

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
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <PipelineStats projects={projects} />
          <PipelineFilters />
        </div>
        {lastFetched && (
          <div className="text-[10px] text-text-muted whitespace-nowrap">
            Updated {new Date(lastFetched).toLocaleTimeString()}
          </div>
        )}
      </div>

      {stale && (
        <div className="bg-[#fef1ee] border border-red/20 rounded-lg px-4 py-2.5 mb-4 text-xs text-red">
          Showing cached data. Linear is unreachable.
        </div>
      )}

      {showStageWarning && (
        <div className="bg-surface-card border border-border-2 rounded-lg px-4 py-2 mb-4 text-[11px] text-text-muted">
          Most projects parsed as Idea — check that project descriptions include a{" "}
          <code>**Stage:**</code> line.
        </div>
      )}

      <PipelineKanban projects={visibleProjects} />
      <div className="h-10" />
    </main>
  );
}
