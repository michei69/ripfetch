import { cn } from "../../lib/utils"

interface ProgressProps {
  value: number // 0-100
  className?: string
}

export function Progress({ value, className }: ProgressProps) {
  return (
    <div className={cn("h-1.5 bg-muted rounded-full overflow-hidden", className)}>
      <div
        className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
