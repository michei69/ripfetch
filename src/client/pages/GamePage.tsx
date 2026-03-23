import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Moon, Sun, Gamepad2, ExternalLink, ArrowLeft, Download, Globe, Users, Sparkles } from "lucide-react"
import { useTheme } from "../components/theme-provider"
import { GameCardSkeleton, DownloadLinkSkeleton } from "../components/skeleton"
import { cn } from "../lib/utils"
import { API_BASE_URL } from "../lib/config"

// Order for download sources (lowercase for case-insensitive matching)
const SOURCE_ORDER = ["online-fix.me", "igg", "steamrip", "game3rb", "steamunlocked"]

// Trusted domains that should appear first and have special styling
const TRUSTED_DOMAINS = [
  "megaup.net",
  "gofile",
  "gofile.io", 
  "pixeldrain.com",
  "mega.nz",
  "vikingfile.com",
  "vikingfile",
  "viking file",
  "1fichier.com",
  "koramaup.com",
  "buzzheavier",
  "1cloudfile.com"
].map(d => d.toLowerCase())

const SLOW_DOMAINS = [
  "uploadhaven"
].map(d => d.toLowerCase())

const PROXY_DOMAINS = [
  "uploadhaven"
]

// Helper function to check if a domain is trusted (case-insensitive)
const isTrustedDomain = (domain: string): boolean => {
  const normalizedDomain = domain.toLowerCase()
  return TRUSTED_DOMAINS.some(trusted => 
    normalizedDomain === trusted || 
    normalizedDomain.includes(trusted) || 
    trusted.includes(normalizedDomain)
  )
}
const isSlowDomain = (domain: string): boolean => {
  const normalizedDomain = domain.toLowerCase()
  return SLOW_DOMAINS.some(trusted => 
    normalizedDomain === trusted || 
    normalizedDomain.includes(trusted) || 
    trusted.includes(normalizedDomain)
  )
}
const isProxyDomain = (domain: string): boolean => {
  const normalizedDomain = domain.toLowerCase()
  return PROXY_DOMAINS.some(trusted => 
    normalizedDomain === trusted || 
    normalizedDomain.includes(trusted) || 
    trusted.includes(normalizedDomain)
  )
}

// Helper function to get the index of a domain in TRUSTED_DOMAINS (for ordering)
const getTrustedDomainIndex = (domain: string): number => {
  const normalizedDomain = domain.toLowerCase()
  return TRUSTED_DOMAINS.findIndex(trusted => 
    normalizedDomain === trusted || 
    normalizedDomain.includes(trusted) || 
    trusted.includes(normalizedDomain)
  )
}

// Natural sort comparison for strings containing numbers
const naturalCompare = (a: string, b: string): number => {
  const numRegex = /(\d+)/g
  const aParts = a.split(numRegex)
  const bParts = b.split(numRegex)
  
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const aPart = aParts[i]!
    const bPart = bParts[i]!
    
    if (i % 2 === 0) {
      // Even indices: non-numeric parts
      const cmp = aPart.toLowerCase().localeCompare(bPart.toLowerCase())
      if (cmp !== 0) return cmp
    } else {
      // Odd indices: numeric parts
      const aNum = parseInt(aPart, 10)
      const bNum = parseInt(bPart, 10)
      if (aNum !== bNum) return aNum - bNum
    }
  }
  
  // If all compared parts equal, compare length
  return aParts.length - bParts.length
}

interface SteamInfo {
  name: string
  header_image: string
  short_description: string
  developers: string[]
  publishers: string[]
  genres: Array<{ id: number; description: string }>,
  price_overview: {
    initial_formatted: string,  
    final_formatted: string  
  },
  is_free: boolean,
}



export default function GamePage() {
  const { id } = useParams<{ id: string }>()
  const [steamInfo, setSteamInfo] = useState<SteamInfo | null>(null)
  const [downloads, setDownloads] = useState<Record<string, Record<string, string>>>({})
  const [loadingSteam, setLoadingSteam] = useState(true)
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [errorSteam, setErrorSteam] = useState<string | null>(null)
  const [errorLinks, setErrorLinks] = useState<string | null>(null)
  const [progress, setProgress] = useState(-1)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    let isMounted = true
    let eventSource: EventSource

    const fetchSteamInfo = async () => {
      if (!id) return

      setLoadingSteam(true)
      setErrorSteam(null)
      setSteamInfo(null)
      setDownloads({})
      setLoadingLinks(false)
      setErrorLinks(null)

      try {
        const res = await fetch(`${API_BASE_URL}/api/game/${id}`)
        if (!res.ok) {
          throw new Error("Failed to fetch game info")
        }
        const data = await res.json()
        if (isMounted) {
          setSteamInfo(data.steam)
          setErrorSteam(null)
          if (data.steam) {
            fetchDownloadLinks(id)
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorSteam(err instanceof Error ? err.message : "An error occurred")
        }
      } finally {
        if (isMounted) {
          setLoadingSteam(false)
        }
      }
    }

    const fetchDownloadLinks = async (gameId: string) => {
      if (!isMounted) return

      setLoadingLinks(true)
      setErrorLinks(null)

      try {
        setProgress(0)
        eventSource = new EventSource(`${API_BASE_URL}/api/game/${gameId}/links/sse`)
        eventSource.addEventListener("data", (event) => {
          eventSource.close()
          const data = JSON.parse(event.data)
          setDownloads(data.downloads)
          setProgress(101)
          setLoadingLinks(false)
        })
        eventSource.addEventListener("search", (event) => {
          const data = JSON.parse(event.data)
          setProgress(data.sourceIdx / data.total * 100)
          console.log("search", data)
        })
        eventSource.onerror = (err) => {
          console.error(err)
          throw new Error("Failed to fetch download links")
        }
      } catch (err) {
        if (isMounted) {
          setErrorLinks(err instanceof Error ? err.message : "An error occurred")
        }
      } finally {
        // if (isMounted) {
        //   setLoadingLinks(false)
        // }
      }
    }

    fetchSteamInfo()

    return () => {
      isMounted = false
    }
  }, [id])

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "")
    } catch {
      return url.length > 30 ? url.substring(0, 30) + "..." : url
    }
  }

  const groupLinksByDomain = (links: Record<string, string>) => {
    const grouped: Record<string, Array<{ name: string; displayName: string; url: string }>> = {}
    
    Object.entries(links).forEach(([key, url]) => {
      const separatorIndex = key.indexOf(" - ")
      let domain = "Other"
      let displayName = key
      
      if (separatorIndex !== -1) {
        domain = key.substring(0, separatorIndex)
        displayName = key.substring(separatorIndex + 3) // Skip " - "
      }
      
      if (!grouped[domain]) {
        grouped[domain] = []
      }
      
      grouped[domain]!.push({ name: key, displayName, url })
    })
    
    return grouped
  }

  const parseSourceName = (sourceName: string) => {
    const match = sourceName.match(/^(.+?)\s*\((.+)\)$/)
    if (match) {
       return {
        source: match[1]!.trim(),
        gameTitle: match[2]!.trim()
      }
    }
    return {
      source: sourceName,
      gameTitle: null
    }
  }

  if (loadingSteam) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
              <div className="h-7 w-24 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <GameCardSkeleton />
            <div className="mt-8">
              <div className="h-7 w-48 rounded bg-muted animate-pulse mb-4" />
              <div className="grid gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <DownloadLinkSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (errorSteam) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                RipFetch
              </h1>
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 text-center">
              <div className="h-12 w-12 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h2 className="text-xl font-bold text-destructive mb-2">Failed to Load Game</h2>
              <p className="text-muted-foreground mb-6">{errorSteam}</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Search
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!steamInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Search
            </Link>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Gamepad2 className="h-8 w-8 text-primary" />
                <Sparkles className="h-3 w-3 text-primary absolute -top-1 -right-1" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                RipFetch
              </h1>
            </div>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "p-2 rounded-lg hover:bg-accent transition-colors",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {steamInfo && (
            <div className="bg-card border rounded-2xl p-6 md:p-8 pb-2 md:pb-2 mb-8 shadow-lg">
              <div className="flex flex-col lg:flex-row gap-6">
                {steamInfo.header_image && (
                  <div className="lg:w-2/5">
                    <img
                      src={steamInfo.header_image}
                      alt={steamInfo.name}
                      className="w-full rounded-xl shadow-lg object-cover max-h-80"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <a className="text-3xl md:text-4xl font-bold hover:brightness-75 transition-all" target="_blank" rel="noopener noreferrer" href={`https://store.steampowered.com/app/${id}`}>{steamInfo.name}</a>
                    {steamInfo.header_image && (
                      <div className="hidden lg:block">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Gamepad2 className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {steamInfo.short_description && (
                    <p className="text-lg text-muted-foreground mb-6">{steamInfo.short_description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="px-3 py-1.5 bg-green-400 dark:bg-green-800 text-primary rounded-full text-sm font-medium">
                      {steamInfo.is_free ? "Free" : steamInfo.price_overview.initial_formatted || steamInfo.price_overview.final_formatted }
                    </span>
                    {steamInfo.genres?.map((genre) => (
                      <span
                        key={genre.id}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                      >
                        {genre.description}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {steamInfo.developers?.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                          <Users className="h-5 w-5 text-secondary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Developer</p>
                          <p className="font-medium">{steamInfo.developers.join(", ")}</p>
                        </div>
                      </div>
                    )}
                    {steamInfo.publishers?.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                          <Globe className="h-5 w-5 text-secondary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Publisher</p>
                          <p className="font-medium">{steamInfo.publishers.join(", ")}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Download Links</h3>
                <p className="text-muted-foreground">
                  Available from {Object.keys(downloads).length} source{Object.keys(downloads).length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className={`h-1 bg-muted rounded-full w-[50%] ml-auto transition-all duration-500 ${progress == -1 || progress > 100 ? "opacity-0": "opacity-100"}`}>
                <div className={`h-full bg-primary rounded-full transition-all duration-200`} style={{width: `${progress}%`}}></div>
              </div>
            </div>

            {loadingLinks ? (
              <div className="mt-8">
                <div className="h-7 w-48 rounded bg-muted animate-pulse mb-4" />
                <div className="grid gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <DownloadLinkSkeleton key={i} />
                  ))}
                </div>
              </div>
            ) : errorLinks ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center">
                <div className="h-12 w-12 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h4 className="text-xl font-semibold mb-2 text-destructive">Failed to Load Downloads</h4>
                <p className="text-muted-foreground mb-4">{errorLinks}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary dark:bg-primary/10 text-primary-foreground dark:text-white rounded-lg hover:bg-primary/90 dark:hover:bg-primary/20 transition-all"
                >
                  Retry
                </button>
              </div>
            ) : Object.keys(downloads).length === 0 ? (
               <div className="bg-card border rounded-2xl p-6 text-center">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h4 className="text-xl font-semibold mb-2">No Downloads Available</h4>
                <p className="text-muted-foreground mb-6">
                  We couldn't find any download links for this game.
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary dark:bg-primary/10 text-primary-foreground dark:text-white rounded-lg hover:bg-primary/90 dark:hover:bg-primary/20 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Search for Another Game
                </Link>
              </div>
            ) : (
               <div className="grid gap-5">
                  {Object.entries(downloads)
                    .sort(([hostA], [hostB]) => {
                      const sourceA = parseSourceName(hostA).source.toLowerCase()
                      const sourceB = parseSourceName(hostB).source.toLowerCase()
                      const indexA = SOURCE_ORDER.indexOf(sourceA)
                      const indexB = SOURCE_ORDER.indexOf(sourceB)
                      if (indexA === -1 && indexB === -1) return sourceA.localeCompare(sourceB)
                      if (indexA === -1) return 1
                      if (indexB === -1) return -1
                      return indexA - indexB
                    })
                    .map(([host, links]) => {
                    const parsedSource = parseSourceName(host)
                   return (
                   <div
                     key={host}
                     className="bg-card border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
                   >
                     <div className="p-5 border-b">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                             <Download className="h-5 w-5 text-primary" />
                           </div>
                           <div>
                             <div className="flex flex-row gap-1">
                               <h4 className="font-bold text-xl capitalize">{parsedSource.source}</h4>
                               {parsedSource.gameTitle && (
                                 <p className="text-sm text-muted-foreground mt-1">
                                   ({parsedSource.gameTitle})
                                 </p>
                               )}
                             </div>
                             <p className="text-sm text-muted-foreground mt-1">
                               {Object.keys(links).length} link{Object.keys(links).length !== 1 ? "s" : ""} available
                             </p>
                           </div>
                         </div>
                         <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                           Source
                         </span>
                       </div>
                     </div>
                     <div className="p-5">
                      {(() => {
                         const groupedLinks = groupLinksByDomain(links)
                           const domains = Object.keys(groupedLinks).sort((a, b) => {
                             const aIndex = getTrustedDomainIndex(a)
                             const bIndex = getTrustedDomainIndex(b)
                             
                             // Both trusted: sort by index in TRUSTED_DOMAINS
                             if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
                             // Only a trusted: a comes first
                             if (aIndex !== -1) return -1
                             // Only b trusted: b comes first  
                             if (bIndex !== -1) return 1
                             // Neither trusted: alphabetical
                             return a.localeCompare(b)
                           })
                         
                          return domains.map((domain, domainIndex) => {
                            const domainLinks = groupedLinks[domain]!.sort((a, b) => naturalCompare(a.displayName, b.displayName))
                            const isLastDomain = domainIndex === domains.length - 1
                            const isTrusted = isTrustedDomain(domain)
                            const isSlow = isSlowDomain(domain)
                            const isProxied = isProxyDomain(domain)
                           
                            return (
                              <div key={domain} className={!isLastDomain ? "mb-4 pb-4 border-b" : ""}>
                                <div className="flex items-center gap-2 mb-3">
                                 <div className="h-8 w-8 rounded-md bg-secondary/20 flex items-center justify-center">
                                   <Globe className="h-4 w-4 text-secondary-foreground" />
                                 </div>
                                 <div className="flex items-center gap-2">
                                   <h5 className={`font-semibold text-lg`}>
                                     {domain}
                                   </h5>
                                   {isTrusted && (
                                     <span className="px-2 py-0.5 text-xs bg-green-300 dark:bg-green-800 text-green-800 dark:text-green-100 rounded-full">
                                       Recommended
                                     </span>
                                   )}
                                   {isSlow && (
                                     <span className="px-2 py-0.5 text-xs bg-yellow-300 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded-full">
                                       Slow
                                     </span>
                                   )}
                                   {isProxied && (
                                     <span className="px-2 py-0.5 text-xs bg-blue-300 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full">
                                       Proxied
                                     </span>
                                   )}
                                 </div>
                                 <span className="ml-auto text-sm text-muted-foreground">
                                   {domainLinks.length} link{domainLinks.length !== 1 ? "s" : ""}
                                 </span>
                               </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {domainLinks.map(({ name, displayName, url }) => (
                                  <a
                                    key={`${host}-${name}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all"
                                  >
                                    <div className="flex items-center gap-3">
                                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                      <div>
                                        <p className="font-medium group-hover:text-primary transition-colors">{displayName}</p>
                                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                          {getHostname(url)}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                                      ↗
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                   </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-1.5" style={{transform: "translate(0, -2.5px)"}} />
              Disclaimer:
              None of the content is hosted on this server. All links redirect to external sources.
              Use at your own discretion. We do not guarantee the safety or legality of any downloads.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
