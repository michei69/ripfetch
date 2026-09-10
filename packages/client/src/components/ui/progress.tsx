import { cn } from "../../lib/utils";

type ProgressProps = {
  value: number;
  className?: string;
  label?: string;
};

/**
 * A hairline measure of how many sources have answered. Deliberately thin: the
 * page is an index, so the progress indicator reads as a rule that fills.
 */
export function Progress({ value, className, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("progress", className)}>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <div
          className="progress-fill"
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </div>
      <span className="progress-num">{Math.round(clamped)}%</span>
    </div>
  );
}
