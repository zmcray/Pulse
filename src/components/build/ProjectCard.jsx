/**
 * One project card in the Build Pipeline kanban.
 *
 * Stage drives the left border color (per Pulse design tokens). Owner badge
 * gracefully handles null lead. Progress shows X/Y or "No features yet" when
 * the project has zero issues. Click handler is wired in Phase 4 (expansion).
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
  const borderClass = STAGE_BORDER_CLASS[project.stage] || "border-l-text-muted";
  const hasIssues = project.totalCount > 0;
  const percent = hasIssues
    ? Math.round((project.doneCount / project.totalCount) * 100)
    : 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`w-full text-left bg-surface-card border border-border-2 rounded-lg px-3 py-2.5 border-l-[3px] ${borderClass} hover:border-text-muted transition-colors flex flex-col gap-1.5`}
    >
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
        <p className="text-[11px] leading-snug text-text-secondary line-clamp-2">
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
    </button>
  );
}
