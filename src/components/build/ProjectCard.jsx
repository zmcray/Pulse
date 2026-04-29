import { useMemo } from "react";
import { useBuildPipelineState } from "../../contexts/BuildPipelineContext.jsx";
import ProjectFeatureList from "./ProjectFeatureList.jsx";

/**
 * One project card in the Build Pipeline kanban.
 *
 * Stage drives the left border color (per Pulse design tokens). Owner badge
 * gracefully handles null lead. Progress shows X/Y or "No features yet" when
 * the project has zero issues. Click toggles expansion; expanded state shows
 * the feature list and a deep-link to Linear.
 */

const STAGE_BORDER_CLASS = {
  Idea: "border-l-text-muted",
  Scoped: "border-l-blue",
  Building: "border-l-accent",
  "Live (Beta)": "border-l-purple",
  Stable: "border-l-green",
};

function ownerInitials(name) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProjectCard({ project, expanded, onToggle }) {
  const { issues } = useBuildPipelineState();
  const projectIssues = useMemo(
    () => issues.filter((i) => i.projectId === project.id),
    [issues, project.id],
  );

  const borderClass = STAGE_BORDER_CLASS[project.stage] || "border-l-text-muted";
  const hasIssues = project.totalCount > 0;
  const percent = hasIssues
    ? Math.round((project.doneCount / project.totalCount) * 100)
    : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={expanded}
      className={`bg-surface-card border border-border-2 rounded-lg px-3 py-2.5 border-l-[3px] ${borderClass} hover:border-text-muted transition-colors cursor-pointer ${expanded ? "ring-1 ring-border" : ""}`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          {/* Linear returns icons as :slack_shortcode: strings — only render glyph emoji until a shortcode mapping is added */}
          {project.icon && !/^:[\w_]+:$/.test(project.icon) && (
            <span className="text-[13px] leading-none" aria-hidden>
              {project.icon}
            </span>
          )}
          <span className="font-semibold text-[12.5px] leading-snug text-text-primary tracking-tight">
            {project.name}
          </span>
        </div>

        {project.summary && (
          <p
            className={`text-[11px] leading-snug text-text-secondary ${expanded ? "" : "line-clamp-2"}`}
          >
            {project.summary}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider text-text-muted"
            title={project.ownerName || "No owner"}
          >
            {ownerInitials(project.ownerName)}
          </span>

          {hasIssues ? (
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[10px] text-text-muted tabular-nums">
                {project.doneCount}/{project.totalCount}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-text-muted italic">
              No features yet
            </span>
          )}
        </div>
      </div>

      {expanded && <ProjectFeatureList project={project} issues={projectIssues} />}
    </div>
  );
}
