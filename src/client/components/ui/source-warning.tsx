import { useEffect, useRef } from "react"
import { ExternalLink, AlertTriangle, X } from "lucide-react"
import { Button } from "./button"

interface SourceWarningModalProps {
  open: boolean
  source: string
  domain: string
  onConfirm: () => void
  onDismiss: () => void
  onDismissPermanently: () => void
}

const WARNINGS: Record<string, { title: string; body: string }> = {
  "online-fix.me": {
    title: "Online-Fix.me requires an account",
    body:
      "This source may require you to sign in or create an account before downloading. Links may redirect through login pages.",
  },
}

export function SourceWarningModal({
  open,
  source,
  domain,
  onConfirm,
  onDismiss,
  onDismissPermanently,
}: SourceWarningModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const warning = WARNINGS[source]

  if (!open || !warning) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-2xl border bg-background p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-in fade-in"
      onClick={(e) => { if (e.target === dialogRef.current) onDismiss() }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/15 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{warning.title}</h3>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {warning.body}
        </p>

        <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
          Redirecting to: <span className="font-mono text-foreground">{domain}</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={onConfirm} className="flex-1">
            <ExternalLink className="h-4 w-4" />
            Continue Anyway
          </Button>
          <Button variant="outline" className="text-foreground" onClick={onDismiss}>
            Go Back
          </Button>
        </div>

        <button
          onClick={onDismissPermanently}
          className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors underline underline-offset-2"
        >
          Don&apos;t show this warning for {source} again
        </button>
      </div>
    </dialog>
  )
}

export { WARNINGS }
