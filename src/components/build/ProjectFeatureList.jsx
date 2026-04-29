/**
 * Expanded feature list for a single project.
 *
 * Status dots: done=green, in_progress=blue, backlog=text-muted, blocked=red.
 * (Avoiding orange since --color-orange == --color-accent — would clash with
 * Building stage's terracotta border.) Every dot has an aria-label so screen
 * readers don't depend on color alone.
 */

const STATUS_DOT_CLASS = {
  done: "bg-green",
  in_progress: "bg-blue",
  backlog: "bg-text-muted",
  blocked: "bg-red",
};

const STATUS_LABEL = {
  done: "Done",
  in_progress: "In Progress",
  backlog: "Backlog",
  blocked: "Blocked",
};

export default function ProjectFeatureList({ project, issues }) {
  if (issues.length === 0) {
    return (
      <div className="text-[11px] text-text-muted italic px-2 py-2">
        No features yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 mt-2 pt-2.5 border-t border-border-2">
      {issues.map((issue) => (
        <a
          key={issue.id}
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[11px] text-text-secondary hover:text-text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={`shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[issue.state] || "bg-text-muted"}`}
            aria-label={STATUS_LABEL[issue.state] || issue.state}
            title={STATUS_LABEL[issue.state] || issue.state}
          />
          <span
            className={`truncate ${issue.state === "done" ? "line-through text-text-muted" : ""}`}
          >
            {issue.title}
          </span>
        </a>
      ))}
      <a
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-accent transition-colors mt-1 self-end"
        onClick={(e) => e.stopPropagation()}
      >
        Open in Linear →
      </a>
    </div>
  );
}
