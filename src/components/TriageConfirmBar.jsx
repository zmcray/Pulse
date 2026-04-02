export default function TriageConfirmBar({
  total,
  assigned,
  loading,
  error,
  onConfirm,
}) {
  const allAssigned = assigned === total;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-border px-4 py-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="text-sm text-text-secondary">
          {assigned} of {total} tasks assigned
          {error && <span className="text-error ml-2">{error}</span>}
        </div>
        <button
          onClick={onConfirm}
          disabled={!allAssigned || loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            allAssigned && !loading
              ? "bg-status-in-progress text-white hover:bg-blue-600"
              : "bg-gray-200 text-text-muted cursor-not-allowed"
          }`}
        >
          {loading ? "Updating..." : `Confirm ${assigned} changes`}
        </button>
      </div>
    </div>
  );
}
