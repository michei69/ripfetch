import { Link } from "react-router";
import { ArrowDownToLine, Search } from "lucide-react";
import { useTheme } from "next-themes";

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="app-header">
        <nav className="shell header-inner" aria-label="Main navigation">
          <Link to="/" className="wordmark">
            <ArrowDownToLine aria-hidden="true" />
            ripfetch<span className="brand-dot">.</span>
          </Link>
          <span className="header-tag">game download index</span>
          <Link to="/" className="nav-search">
            <Search size={16} aria-hidden="true" />
            Find games
          </Link>
          <select
            aria-label="Color theme"
            value={theme ?? "system"}
            onChange={(event) => setTheme(event.target.value)}
            className="theme-select"
          >
            <option value="system">System theme</option>
            <option value="light">Light theme</option>
            <option value="dark">Dark theme</option>
          </select>
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
