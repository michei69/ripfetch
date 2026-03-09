import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Moon, Sun, Gamepad2, Sparkles, Download, Globe } from "lucide-react"
import { useTheme } from "../components/theme-provider"
import { cn } from "../lib/utils"
import { API_BASE_URL } from "../lib/config"
import { SearchResultSkeleton } from "../components/skeleton"

interface SearchResult {
  name: string
  objectID: string
  id: number,
  small_capsule?: string,
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const searchGames = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setResults(data)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchGames(query)
        setShowDropdown(true)
      } else {
        setResults([])
        setShowDropdown(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchGames])

  const handleSelect = (result: SearchResult) => {
    setQuery(result.name)
    setShowDropdown(false)
    navigate(`/game/${result.id}`)
  }

  const handleClear = () => {
    setQuery("")
    setResults([])
    setShowDropdown(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <Sparkles className="h-3 w-3 text-primary absolute -top-1 -right-1" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              GameFinder
            </h1>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "p-2 rounded-lg hover:bg-accent transition-colors relative",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              theme === "dark" ? "text-yellow-400" : "text-gray-600"
            )}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Find <span className="text-primary">Free Game Downloads</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Search across multiple sources like SteamRip, IGG Games, OnlineFix, and more to find your favorite games
            </p>
          </div>

          <div className="relative mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                <input
                  type="text"
                  placeholder="Search for a game... (min. 2 characters)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query.length >= 2 && setShowDropdown(true)}
                  className="w-full h-16 pl-12 pr-4 rounded-xl border-2 border-input/50 bg-background/80 backdrop-blur-sm text-lg focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all"
                  aria-label="Search for games"
                />
                {query && (
                  <button
                    onClick={handleClear}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-3">
                <div className="bg-popover/95 backdrop-blur-md border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {isLoading ? (
                    <div className="p-4">
                      <SearchResultSkeleton />
                    </div>
                  ) : results.length > 0 ? (
                    <>
                      <div className="px-4 py-3 border-b bg-accent/50">
                        <p className="text-sm font-medium">
                          Found {results.length} game{results.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {results.map((result) => (
                          <button
                            key={result.objectID}
                            onClick={() => handleSelect(result)}
                            className="w-full px-4 py-4 text-left hover:bg-accent transition-colors flex items-center gap-4 group border-b last:border-0"
                          >
                            <div className="flex-shrink-0">
                              <div className="h-10 aspect-auto rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                {/* <Gamepad2 className="h-5 w-5 text-primary" /> */}
                                <img src={`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${result.id}${result.small_capsule ? "/" + result.small_capsule : ""}/capsule_231x87.jpg`} className="h-10 aspect-auto rounded-md"/>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {result.name}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                Click to view download links
                              </p>
                            </div>
                            <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : query.length >= 2 ? (
                    <div className="p-8 text-center">
                      <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-muted-foreground">No games found. Try a different search term.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-card border rounded-xl p-6 text-center">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Multiple Sources</h3>
              <p className="text-sm text-muted-foreground">
                Search across 5+ trusted game download sources
              </p>
            </div>
            <div className="bg-card border rounded-xl p-6 text-center">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Direct Links</h3>
              <p className="text-sm text-muted-foreground">
                Get direct download links from file hosting services
              </p>
            </div>
            <div className="bg-card border rounded-xl p-6 text-center">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Always Free</h3>
              <p className="text-sm text-muted-foreground">
                All games are completely free to download and play
              </p>
            </div>
          </div>

          <div className="text-center">
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
