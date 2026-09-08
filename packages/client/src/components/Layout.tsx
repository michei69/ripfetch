import { Link } from "react-router";
import { ArrowDownToLine, ChevronDown, Search } from "lucide-react";
import { useTheme } from "next-themes";

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="app-header">
        <nav className="shell header-inner flex-wrap" aria-label="Main navigation">
          <span aria-hidden="true" className="hidden items-center gap-2 xl:flex">
            <span className="size-3 rounded-full bg-destructive" />
            <span className="size-3 rounded-full bg-amber" />
            <span className="size-3 rounded-full bg-phosphor" />
          </span>
          <Link to="/" className="wordmark">
            <ArrowDownToLine aria-hidden="true" />
            ripfetch<span className="brand-dot">
              .
              <span className="cursor-blink ml-0.5 inline-block h-4 w-2 bg-phosphor" aria-hidden="true" />
            </span>
          </Link>
          <span className="header-tag term-prompt">game download index</span>
          <Link to="/" className="nav-search" style={{ minHeight: 44 }}>
            <Search size={16} className="text-phosphor" aria-hidden="true" />
            Find games
          </Link>
          <div className="relative ml-auto">
            <select
              aria-label="Color theme"
              value={theme ?? "system"}
              onChange={(event) => setTheme(event.target.value)}
              className="theme-select appearance-none"
              // scaffold .theme-select padding wins over utilities; right space is for the chevron
              style={{ paddingRight: 30, minHeight: 44 }}
            >
              <option value="system">System theme</option>
              <option value="light">Light theme</option>
              <option value="dark">Dark theme</option>
            </select>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </nav>
      </header>
      <main id="content" className="shell app-content">{children}</main>
      <footer className="shell app-footer">
        <span className="footer-wordmark">ripfetch<span className="brand-dot">.</span></span>
        <p>Links lead to external sources. No files are hosted here. Download safety is not guaranteed.</p>
      </footer>
    </div>
  );
}
