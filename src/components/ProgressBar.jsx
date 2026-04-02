export default function ProgressBar({ completed, total }) {
  const ratio = total > 0 ? completed / total : 0;
  const percent = Math.round(ratio * 100);

  // Interpolate from blue (#3b82f6) to green (#22c55e)
  const r = Math.round(59 + (34 - 59) * ratio);
  const g = Math.round(130 + (197 - 130) * ratio);
  const b = Math.round(246 + (94 - 246) * ratio);

  return (
    <div className="h-1 w-full bg-border-light">
      <div
        className="h-full transition-all duration-500 ease-out"
        style={{
          width: `${percent}%`,
          backgroundColor: `rgb(${r}, ${g}, ${b})`,
        }}
      />
    </div>
  );
}
