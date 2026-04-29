import ProjectCard from "./ProjectCard.jsx";
import {
  useBuildPipelineState,
  useBuildPipelineDispatch,
} from "../../contexts/BuildPipelineContext.jsx";

export default function PipelineColumn({ stage, projects }) {
  const { expandedCardId } = useBuildPipelineState();
  const { setExpandedCardId } = useBuildPipelineDispatch();

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-2.5 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          {stage}
        </span>
        <span className="text-[10px] font-semibold text-text-muted tabular-nums">
          {projects.length}
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="text-[11px] text-text-muted italic px-1 py-3">
          (empty)
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              expanded={expandedCardId === project.id}
              onToggle={() => setExpandedCardId(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
