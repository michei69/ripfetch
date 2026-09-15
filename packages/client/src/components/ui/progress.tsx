import { cn } from "../../lib/utils";

type ProgressProps = {
  value: number;
  class?: string;
  label?: string;
};

/**
 * A hairline measure of how many sources have answered. Deliberately thin: the
 * page is an index, so the progress indicator reads as a rule that fills.
 *
 * `value` is read inside the JSX, so only the transform binding re-runs as the
 * stream reports progress — the element tree is built once.
 */
export function Progress(props: ProgressProps) {
  const clamped = () => Math.max(0, Math.min(100, props.value));

  return (
    <div class={cn("progress", props.class)}>
      <div
        class="progress-track"
        role="progressbar"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped())}
      >
        <div
          class="progress-fill"
          style={{ transform: `scaleX(${clamped() / 100})` }}
        />
      </div>
      <span class="progress-num">{Math.round(clamped())}%</span>
    </div>
  );
}
