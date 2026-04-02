export default function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-4">☀️</div>
      <h2 className="text-lg font-medium text-text-primary mb-2">
        No tasks scheduled for today
      </h2>
      <p className="text-sm text-text-secondary max-w-sm mx-auto">
        Load tasks via your Strategy block or Roadmap Planning workstream.
      </p>
    </div>
  );
}
