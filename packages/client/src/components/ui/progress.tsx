import { cn } from "../../lib/utils";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  return (
    <div
      className={cn(
        "h-3 border border-border bg-muted overflow-hidden",
        className,
      )}
    >
      <div
        className="h-full bg-primary [background-image:repeating-linear-gradient(90deg,var(--primary)_0_8px,var(--background)_8px_10px)] transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
