import { Link, useLocation } from "react-router-dom"
import { Gamepad2, Sparkles, Sun, Moon, Monitor, ArrowLeft } from "lucide-react"
import { useTheme, type Theme } from "./theme-provider"
import { Button } from "./ui/button"

export function Header() {
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const cycleTheme = () => {
    const order: Theme[] = ["light", "dark", "system"]
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % 3] ?? "system")
  }

  const themeIcon = theme === "dark" ? (
    <Moon className="h-5 w-5" />
  ) : theme === "light" ? (
    <Sun className="h-5 w-5" />
  ) : (
    <Monitor className="h-5 w-5" />
  )

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
        >
          {location.pathname !== "/" && <div className="flex items-center gap-1 hover:opacity-90 transition-opacity">
          <ArrowLeft className="h-5 w-5 mt-0.5" />
          Back to Search
          </div>}
          <div className="relative">
            <Gamepad2 className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            <Sparkles className="h-2.5 w-2.5 text-primary absolute -top-0.5 -right-0.5" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            RipFetch
          </h1>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}`}
          className="text-muted-foreground"
        >
          {themeIcon}
        </Button>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-6">
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse align-middle mr-1.5" />
          None of the content is hosted on this server. All links redirect to external sources.
          Use at your own discretion. We do not guarantee the safety of any downloads.
        </p>
      </div>
    </footer>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
