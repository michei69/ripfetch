import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Download, Globe, Sparkles, X } from "lucide-react"
import { useDebounce } from "../hooks/useDebounce"
import { useClickOutside } from "../hooks/useClickOutside"
import { cn } from "../lib/utils"
import { API_BASE_URL } from "../lib/config"
import { SearchResultSkeleton } from "../components/skeleton"

interface SearchResult {
  name: string
  objectID: string
  id: number
  small_capsule?: string
}

const capsuleUrl = (id: number, capsule?: string) =>
  `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}${capsule ? "/" + capsule : ""}/capsule_231x87.jpg`

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  useClickOutside(dropdownRef, () => setShowDropdown(false), showDropdown)

  const searchGames = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    setSelectedIdx(-1)

    try {
      const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      const data: SearchResult[] = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchGames(debouncedQuery)
      setShowDropdown(true)
    } else {
      setResults([])
      setError(null)
      setShowDropdown(false)
    }
  }, [debouncedQuery, searchGames])

  // re-focus input on dropdown open
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      // don't steal focus from the input itself
    }
  }, [showDropdown])

  const handleSelect = (result: SearchResult) => {
    setQuery(result.name)
    setShowDropdown(false)
    navigate(`/game/${result.id}`)
  }

  const handleClear = () => {
    setQuery("")
    setResults([])
    setShowDropdown(false)
    setError(null)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIdx((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIdx >= 0 && selectedIdx < results.length) {
          const result = results[selectedIdx]
          if (result) handleSelect(result)
        }
        break
      case "Escape":
        setShowDropdown(false)
        inputRef.current?.blur()
        break
    }
  }

  return (
    <section className="container mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
            Find <span className="text-primary">Free Game Downloads</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Search across 5+ sources like SteamRip, IGG, OnlineFix, and more
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-10" ref={dropdownRef}>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/8 to-primary/4 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
            <div className="relative flex items-center">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for a game..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (results.length > 0 || isLoading) setShowDropdown(true)
                }}
                onKeyDown={handleKeyDown}
                className="w-full h-14 pl-14 pr-14 rounded-xl border-2 border-input/50 bg-background/80 backdrop-blur-sm text-base md:text-lg focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all"
                aria-label="Search for games"
                autoComplete="off"
                autoFocus
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50">
              <div className="bg-popover/95 backdrop-blur-md border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {isLoading ? (
                  <SearchResultSkeleton />
                ) : error ? (
                  <div className="p-8 text-center">
                    <Globe className="h-10 w-10 text-destructive mx-auto mb-3 opacity-50" />
                    <p className="text-destructive font-medium mb-1">Search failed</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                ) : results.length > 0 ? (
                  <>
                    <div className="px-4 py-2.5 border-b bg-accent/40">
                      <p className="text-xs font-medium text-muted-foreground">
                        {results.length} game{results.length !== 1 ? "s" : ""} found
                      </p>
                    </div>
                    <div
                      className="max-h-80 overflow-y-auto overscroll-contain"
                      role="listbox"
                    >
                      {results.map((result, idx) => {
                        const isSelected = idx === selectedIdx
                        return (
                          <button
                            key={result.objectID}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setSelectedIdx(idx)}
                            role="option"
                            aria-selected={isSelected}
                            className={cn(
                              "w-full px-4 py-3 text-left flex items-center gap-3 transition-colors border-b last:border-0",
                              isSelected
                                ? "bg-accent"
                                : "hover:bg-accent/60"
                            )}
                          >
                            <img
                              src={capsuleUrl(result.id, result.small_capsule)}
                              alt=""
                              className="h-9 w-auto rounded flex-shrink-0 bg-muted"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {result.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Click to view downloads
                              </p>
                            </div>
                            <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : debouncedQuery.length >= 2 ? (
                  <div className="p-10 text-center">
                    <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No games found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try a different search term
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Download,
              title: "Multiple Sources",
              desc: "Search across 5+ trusted game download sites simultaneously",
            },
            {
              icon: Globe,
              title: "Direct Links",
              desc: "Aggregated direct download links from file hosting services",
            },
            {
              icon: Sparkles,
              title: "Always Free",
              desc: "All games are completely free — no strings attached",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-card border rounded-xl p-5 text-center hover:shadow-md transition-shadow"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1 text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
