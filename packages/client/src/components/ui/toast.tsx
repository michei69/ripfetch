import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { cn } from "../../lib/utils"

interface Toast {
  id: string
  message: string
  type?: "success" | "error" | "info"
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-xl px-4 py-3 shadow-lg border backdrop-blur-sm text-sm font-medium animate-in fade-in slide-in-from-right-2",
              t.type === "success" && "bg-green-500/90 text-white border-green-400",
              t.type === "error" && "bg-destructive/90 text-destructive-foreground border-destructive/50",
              t.type === "info" && "bg-card/95 text-foreground border"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
