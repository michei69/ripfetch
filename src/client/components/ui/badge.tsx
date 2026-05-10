import { cn } from "../../lib/utils"

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline"
  className?: string
}

const variantStyles = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25",
  warning: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/25",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25",
  outline: "border text-foreground bg-transparent",
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border border-transparent",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
