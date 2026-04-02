export default function TriageConfirmBar({
  total,
  assigned,
  loading,
  error,
  onConfirm,
}) {
  const allAssigned = assigned === total;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-border px-6 py-3.5">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="text-xs text-text-secondary">
          {assigned} of {total} tasks assigned
          {error && <span className="text-red ml-2">{error}</span>}
        </div>
        <button
          onClick={onConfirm}
          disabled={!allAssigned || loading}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
            allAssigned && !loading
              ? "bg-accent text-white hover:bg-accent-2"
              : "bg-surface-2 text-text-muted cursor-not-allowed"
          }`}
        >
          {loading ? "Updating..." : `Confirm ${assigned} changes`}
        </button>
      </div>
    </div>
  );
}
