import { Link, useLocation } from "react-router";
import { RailSearch } from "./RailSearch";
import { SourceIndex } from "./SourceIndex";
import { ThemeSwitch } from "./ThemeSwitch";
import { ResultRow } from "./GamePoster";
import { useRecents } from "../hooks/useRecents";

/**
 * One shell for both routes: a persistent rail (search, recents, sources) and
 * the content pane. Below 1080px the rail collapses into a compact top bar and
 * the rail foot collapses with it.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isGamePage = pathname.startsWith("/game/");
  const recents = useRecents();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>

      <aside className="rail" data-static={isGamePage ? "true" : undefined}>
        <div className="rail-head">
          <Link to="/" className="rail-brand" aria-label="ripfetch home">
            <span className="wordmark">ripfetch</span>
            <span className="wordmark-sub">download index</span>
          </Link>
          <ThemeSwitch />
        </div>

        <RailSearch />

        {recents.length > 0 && (
          <section className="rail-recents">
            <p className="label mb-1">Recently viewed</p>
            <div className="border-t border-line-soft">
              {recents.slice(0, 5).map((game) => (
                <ResultRow key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        <div className="rail-foot">
          <SourceIndex />
          <div className="rail-legal">
            <p className="rail-note">
              Links lead to external sources. No files are hosted here.
            </p>
          </div>
        </div>
      </aside>

      <div className="pane">
        <main id="content" className="app-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <p className="app-footer-note">
            ripfetch indexes download pages published by third parties and never
            hosts, mirrors or verifies them. Download safety is not guaranteed.
          </p>
        </footer>
      </div>
    </div>
  );
}
