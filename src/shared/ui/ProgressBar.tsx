export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
}: {
  value: number;
  max?: number;
  label: string;
  valueText?: string;
}) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.min(safeMax, Math.max(0, value));
  const percent = (safeValue / safeMax) * 100;
  const displayValue = valueText ?? `${Math.round(percent)}%`;
  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar__label"><span>{label}</span><strong>{displayValue}</strong></div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-valuetext={displayValue}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
