export default function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="text-3xl mb-3 opacity-60">☀️</div>
      <h2 className="text-base font-medium text-text-primary mb-1.5">
        No tasks scheduled for today
      </h2>
      <p className="text-xs text-text-muted max-w-xs mx-auto">
        Load tasks via your Strategy block or Roadmap Planning workstream.
      </p>
    </div>
  );
}
