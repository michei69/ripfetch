import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import {
  ExternalLink,
  Download,
  Globe,
  Users,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Gamepad2,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Card } from "../components/ui/card"
import { Progress } from "../components/ui/progress"
import { useToast } from "../components/ui/toast"
import { SourceWarningModal, WARNINGS } from "../components/ui/source-warning"
import { GamePageSkeleton } from "../components/skeleton"
import { cn } from "../lib/utils"
import { API_BASE_URL } from "../lib/config"

// ─── constants ────────────────────────────────────────────────────────────

const SOURCE_ORDER = [
  "online-fix.me", "igg", "gogto", "gload", "steamrip",
  "fitgirl", "ovagames", "dodi", "game3rb", "steamunlocked",
]

const TRUSTED_MARKERS = [
  "fuckingfast", "megaup", "gofile", "pixeldrain", "mega.nz",
  "vikingfile", "datanodes", "1fichier", "koramaup", "buzzheavier", "1cloudfile",
]

const SLOW_MARKERS = ["uploadhaven"]

const PROXY_MARKERS = ["uploadhaven"]

// ─── helpers ───────────────────────────────────────────────────────────────

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return url.length > 30 ? url.slice(0, 30) + "…" : url
  }
}

const matchesAny = (domain: string, markers: string[]) =>
  markers.some((m) => domain.includes(m))

const parseSource = (key: string) => {
  const m = key.match(/^(.+?)\s*\((.+)\)$/)
  return m
    ? { source: m[1]!.trim(), title: m[2]!.trim() }
    : { source: key, title: null }
}

const groupByDomain = (
  links: Record<string, string>
): Array<{ domain: string; items: Array<{ label: string; url: string }> }> => {
  const map = new Map<string, Array<{ label: string; url: string }>>()

  for (const [key, url] of Object.entries(links)) {
    const sep = key.indexOf(" - ")
    const domain = sep !== -1 ? key.slice(0, sep) : "Other"
    const label = sep !== -1 ? key.slice(sep + 3) : key

    if (!map.has(domain)) map.set(domain, [])
    map.get(domain)!.push({ label, url })
  }

  return Array.from(map.entries())
    .map(([domain, items]) => ({
      domain,
      items: items.sort((a, b) => {
        const numRe = /(\d+)/g
        const aParts = a.label.split(numRe)
        const bParts = b.label.split(numRe)
        for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
          if (i % 2 === 0) {
            const c = aParts[i]!.toLowerCase().localeCompare(bParts[i]!.toLowerCase())
            if (c !== 0) return c
          } else {
            const an = parseInt(aParts[i]!, 10) || 0
            const bn = parseInt(bParts[i]!, 10) || 0
            if (an !== bn) return an - bn
          }
        }
        return aParts.length - bParts.length
      }),
    }))
    .sort((a, b) => {
      const aTrusted = matchesAny(a.domain, TRUSTED_MARKERS)
      const bTrusted = matchesAny(b.domain, TRUSTED_MARKERS)
      if (aTrusted && !bTrusted) return -1
      if (!aTrusted && bTrusted) return 1
      return a.domain.localeCompare(b.domain)
    })
}

// ─── types ─────────────────────────────────────────────────────────────────

interface SteamInfo {
  name: string
  header_image: string
  short_description: string
  developers: string[]
  publishers: string[]
  genres: Array<{ id: number; description: string }>
  price_overview?: { initial_formatted: string; final_formatted: string }
  is_free: boolean
}

// ─── component ─────────────────────────────────────────────────────────────

export default function GamePage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [steam, setSteam] = useState<SteamInfo | null>(null)
  const [downloads, setDownloads] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pendingLink, setPendingLink] = useState<{ url: string; domain: string; source: string } | null>(null)

  // ── data fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setSteam(null)
    setDownloads({})
    setProgress(0)
    setCollapsed(new Set())

    try {
      // Fetch steam info + start SSE simultaneously
      const [steamRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/game/${id}`),
      ])

      if (!steamRes.ok) {
        const text = await steamRes.text().catch(() => "")
        throw new Error(text || `Failed to load game (${steamRes.status})`)
      }

      const data = await steamRes.json()
      setSteam(data.steam)

      // Kick off SSE for download links
      if (data.steam) {
        const es = new EventSource(`${API_BASE_URL}/api/game/${id}/links/sse`)

        es.addEventListener("data", (event) => {
          const d = JSON.parse(event.data) as { downloads: typeof downloads }
          setDownloads(d.downloads)
          setProgress(100)
          es.close()
        })

        es.addEventListener("search", (event) => {
          const d = JSON.parse(event.data) as { sourceIdx: number; total: number }
          setProgress((d.sourceIdx / d.total) * 100)
        })

        es.onerror = () => {
          es.close()
          setError("Failed to fetch download links. The search sources may be unavailable.")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── copy handler ──────────────────────────────────────────────────────

  const copyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      toast("Link copied to clipboard", "success")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast("Failed to copy link", "error")
    }
  }

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── render ────────────────────────────────────────────────────────────

  // Loading
  if (loading && !steam) {
    return <GamePageSkeleton />
  }

  // Error with no data
  if (error && !steam) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="h-14 w-14 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-destructive mb-2">Failed to Load Game</h2>
          <p className="text-muted-foreground mb-6 text-sm">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Search
              </Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  if (!steam) return null

  const sourceEntries = Object.entries(downloads).sort(([a], [b]) => {
    const sa = parseSource(a).source.toLowerCase()
    const sb = parseSource(b).source.toLowerCase()
    const ia = SOURCE_ORDER.indexOf(sa)
    const ib = SOURCE_ORDER.indexOf(sb)
    if (ia === -1 && ib === -1) return sa.localeCompare(sb)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  return (
    <section className="container mx-auto px-4 py-6 md:py-8">
      <div className="max-w-4xl mx-auto">
        {/* ── Hero card ───────────────────────────────────────────── */}
        <Card className="overflow-hidden mb-8">
          <div className="relative">
            {steam.header_image && (
              <div className="absolute inset-0">
                <img
                  src={steam.header_image}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/75" />
              </div>
            )}
            <div className="relative p-6 md:p-8">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Search
              </Link>

              <div className="flex flex-col md:flex-row gap-6">
                {steam.header_image && (
                  <div className="md:w-72 shrink-0">
                    <img
                      src={steam.header_image}
                      alt={steam.name}
                      className="w-full rounded-xl shadow-lg object-cover aspect-video md:aspect-auto"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://store.steampowered.com/app/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xl md:text-3xl font-bold hover:underline decoration-primary/30 underline-offset-4 inline-block mb-3"
                  >
                    {steam.name}
                  </a>

                  {steam.short_description && (
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {steam.short_description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <Badge
                      variant={steam.is_free ? "success" : "default"}
                    >
                      {steam.is_free
                        ? "Free"
                        : steam.price_overview?.final_formatted || steam.price_overview?.initial_formatted || "N/A"}
                    </Badge>
                    {steam.genres?.map((g) => (
                      <Badge key={g.id} variant="secondary">
                        {g.description}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {steam.developers?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Dev:</span>
                        <span className="font-medium">{steam.developers.join(", ")}</span>
                      </div>
                    )}
                    {steam.publishers?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Pub:</span>
                        <span className="font-medium">{steam.publishers.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Download Links ──────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Download Links</h3>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(downloads).length} source{Object.keys(downloads).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Progress
              value={progress}
              className={cn(
                "w-32 md:w-48 transition-opacity",
                progress <= 0 || progress >= 100 ? "opacity-0" : "opacity-100"
              )}
            />
          </div>

          {/* No downloads yet — loading */}
          {progress > 0 && progress < 100 && Object.keys(downloads).length === 0 && (
            <Card className="p-10 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <LoaderIcon />
                </div>
                <p className="text-sm text-muted-foreground">Searching sources for download links...</p>
                <Progress value={progress} className="w-48" />
              </div>
            </Card>
          )}

          {/* Error after steam loaded */}
          {error && steam && (
            <Card className="p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-sm font-medium text-destructive mb-1">Couldn't load downloads</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </Card>
          )}

          {/* Empty */}
          {!error && Object.keys(downloads).length === 0 && progress === 100 && (
            <Card className="p-10 text-center">
              <Gamepad2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium">No Downloads Available</p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                Couldn't find any download links for this game.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Search for Another Game
                </Link>
              </Button>
            </Card>
          )}

          {/* Results */}
          {sourceEntries.length > 0 && (
            <div className="space-y-3">
              {sourceEntries.map(([sourceKey, links]) => {
                const { source, title } = parseSource(sourceKey)
                const isCollapsed = collapsed.has(sourceKey)
                const groups = groupByDomain(links)
                const linkCount = Object.keys(links).length

                return (
                  <Card key={sourceKey} className="overflow-hidden">
                    {/* Source header */}
                    <button
                      onClick={() => toggleCollapse(sourceKey)}
                      className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-accent/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Download className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold capitalize">{source}</h4>
                            {title && (
                              <span className="text-xs text-muted-foreground">
                                ({title})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {linkCount} link{linkCount !== 1 ? "s" : ""}
                            {isCollapsed ? " — collapsed" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform duration-200",
                          !isCollapsed && "rotate-180"
                        )}
                      />
                    </button>

                    {/* Domain groups */}
                    {!isCollapsed && (
                      <div className="px-4 md:px-5 pb-4 md:pb-5 space-y-4">
                        {groups.map(({ domain, items }) => {
                          const isTrusted = matchesAny(domain, TRUSTED_MARKERS)
                          const isSlow = matchesAny(domain, SLOW_MARKERS)
                          const isProxied = matchesAny(domain, PROXY_MARKERS)

                          return (
                            <div key={domain}>
                              <div className="flex items-center gap-2 mb-2.5">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm font-semibold">{domain}</span>
                                <div className="flex gap-1">
                                  {isTrusted && <Badge variant="success">Recommended</Badge>}
                                  {isSlow && <Badge variant="warning">Slow</Badge>}
                                  {isProxied && <Badge variant="info">Proxied</Badge>}
                                </div>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {items.length} link{items.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {items.map(({ label, url }) => {
                                  const uid = `${sourceKey}::${label}`
                                  const isCopied = copiedId === uid
                                  const domain = hostname(url)

                                  const handleLinkClick = (e: React.MouseEvent) => {
                                    const dismissed = localStorage.getItem(`ripfetch_warning_dismissed_${domain}`)
                                    if (dismissed === "true" || !WARNINGS[domain]) return
                                    e.preventDefault()
                                    setPendingLink({ url, domain, source })
                                  }

                                  return (
                                    <div
                                      key={uid}
                                      className="group flex items-center justify-between gap-2 p-3 rounded-xl border bg-card hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
                                    >
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={handleLinkClick}
                                        className="flex items-center gap-2.5 min-w-0 flex-1"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                            {label}
                                          </p>
                                          <p className="text-xs text-muted-foreground truncate">
                                            {domain}
                                          </p>
                                        </div>
                                      </a>
                                      <button
                                        onClick={() => copyLink(url, uid)}
                                        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                                        aria-label="Copy link"
                                      >
                                        {isCopied ? (
                                          <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <SourceWarningModal
        open={pendingLink !== null}
        source={pendingLink?.source ?? ""}
        domain={pendingLink?.domain ?? ""}
        onConfirm={() => {
          if (pendingLink) window.open(pendingLink.url, "_blank", "noopener noreferrer")
          setPendingLink(null)
        }}
        onDismiss={() => setPendingLink(null)}
        onDismissPermanently={() => {
          if (pendingLink) {
            localStorage.setItem(`ripfetch_warning_dismissed_${pendingLink.domain}`, "true")
            window.open(pendingLink.url, "_blank", "noopener noreferrer")
          }
          setPendingLink(null)
        }}
      />
    </section>
  )
}

function LoaderIcon() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-muted-foreground"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
