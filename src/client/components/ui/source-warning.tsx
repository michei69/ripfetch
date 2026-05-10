import { useEffect, useRef, useState } from "react"
import { ExternalLink, AlertTriangle, X, Copy, Check } from "lucide-react"
import { Button } from "./button"

interface SourceWarningModalProps {
  open: boolean
  source: string
  domain: string
  onConfirm: () => void
  onDismiss: () => void
  onDismissPermanently: () => void
}

const CopyClickCode = ({ children }: { children: string }) => {
  const [ work, setWork ] = useState(false)
  const [ error, setError ] = useState(false)
  
  const timeout = useRef<NodeJS.Timeout|null>(null)
  useEffect(() => {
    if (work || error) {
      if (timeout.current) clearTimeout(timeout.current)
      timeout.current = setTimeout(() => {setWork(false); setError(false)}, 2000)
    }
    return () => {if (timeout.current) clearTimeout(timeout.current)}
  }, [work, error])

  return <code className={`cursor-pointer hover:brightness-75 inline-flex flex-row items-center ml-2 ${work ? "text-green-700 dark:text-green-300" : ""} ${error ? "text-destructive" : ""}`} onClick={async () => {
    try {
      await navigator.clipboard.writeText(children)
      setWork(true)
    } catch {
      setError(true)
    }
  }}>{children} {!work && !error && <Copy className="w-3 h-3 mr-2 ml-1"/>}{work && <Check className="w-3 h-3 mr-2 ml-1"/>}{error && <X className="w-3 h-3 mr-2 ml-1"/>}</code>
}

const WARNINGS: Record<string, { title: string; body: any }> = {
  "online-fix.me": {
    title: "Online-Fix.me zips are password protected",
    body:
      <>Use the password <CopyClickCode>online-fix.me</CopyClickCode> to decompress the zip files.</>,
  },
  "ovagames": {
    title: "OvaGames zips are password protected",
    body:
      <>Use the password <CopyClickCode>www.ovagames.com</CopyClickCode> to decompress the zip files.</>,
  },
  "igg": {
    title: "Beware of Malware!",
    body:
      <>IGG Games (and its many clones) have been caught embedding their own DRM, crypto miners, etc. into their repacked games. Please be wary of any suspicious files. This source is still available here just in case there's no other one. Just be careful and have fun!</>
  },
  "steamunlocked": {
    title: "Slow downloads",
    body:
      <>SteamUnlocked is notorious for limiting its download speeds severly. Not only that, but often times they directly reupload packs from IGG or other sources. This should be your last resort.</>
  },
  "dodirepacks": {
    title: "Use an adblocker!",
    body:
      <>Please use <a href="https://www.firefox.com/" className="inline-flex flex-row items-center hover:brightness-75">Firefox <ExternalLink className="h-3 w-3 ml-1"/></a> + <a href="https://addons.mozilla.org/en-GB/firefox/addon/ublock-origin/" className="inline-flex flex-row items-center hover:brightness-75">uBlock Origin <ExternalLink className="h-3 w-3 ml-1"/></a> + <a href="https://violentmonkey.github.io/" className="inline-flex flex-row items-center hover:brightness-75">ViolentMonkey <ExternalLink className="h-3 w-3 ml-1"/></a> + <a href="https://codeberg.org/Amm0ni4/bypass-all-shortlinks-debloated" className="inline-flex flex-row items-center hover:brightness-75">bypass-all-shortlinks-debloated <ExternalLink className="h-3 w-3 ml-1"/></a>. Dodi's download links are shoved through layers of ad-powered redirects. Trust me, you don't want to go through them manually.</>
  },
  "game3rb": {
    title: "Beware of Malware!",
    body:
      <>Game3rb sometimes embeds malicious links / ads into their webpage, which this scraper is unable to detect. Please make sure you're downloading from a legitimate file hoster. If you're unsure, try using other sources.</>
  }
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

        <p className="text-sm text-muted-foreground leading-relaxed mb-6 inline">
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
