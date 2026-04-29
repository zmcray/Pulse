import { useMemo } from "react";
import PipelineColumn from "./PipelineColumn.jsx";

const STAGES = ["Idea", "Scoped", "Building", "Live (Beta)", "Stable"];

export default function PipelineKanban({ projects }) {
  const byStage = useMemo(() => {
    const groups = Object.fromEntries(STAGES.map((s) => [s, []]));
    for (const project of projects) {
      const stage = STAGES.includes(project.stage) ? project.stage : "Idea";
      groups[stage].push(project);
    }
    return groups;
  }, [projects]);

  return (
    <div className="grid grid-cols-5 gap-4 min-w-[1100px]">
      {STAGES.map((stage) => (
        <PipelineColumn key={stage} stage={stage} projects={byStage[stage]} />
      ))}
    </div>
  );
}
