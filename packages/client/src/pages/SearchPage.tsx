import type { GameSearch } from "../hooks/useGameSearch";
import { useSearch } from "../components/SearchContext";
import { GamePoster } from "../components/GamePoster";
import { SourceIndex } from "../components/SourceIndex";
import { useRecents } from "../hooks/useRecents";
import { SOURCE_COUNT } from "../lib/sources";

const SKELETON_COUNT = 8;

export default function SearchPage() {
  const { search, clear, query } = useSearch();
  const recents = useRecents();

  if (!search.searching) {
    return (
      <>
        <h1 className="masthead">Every download source for every game.</h1>
        <p className="lede">
          Type a title, pick a source, get a link. ripfetch queries{" "}
          {SOURCE_COUNT} repack sites at once and returns them as one list.
        </p>

        {recents.length > 0 && (
          <section className="mt-14">
            <div className="sec-head">
              <h2>Continue</h2>
              <span className="sec-meta">last {recents.length} viewed</span>
            </div>
            <div className="posters mt-6">
              {recents.map((game) => (
                <GamePoster key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        <section className="sources-inline mt-14">
          <div className="sec-head">
            <h2>Sources</h2>
          </div>
          <div className="mt-4">
            <SourceIndex />
          </div>
        </section>
      </>
    );
  }

  return (
    <section aria-labelledby="results-heading">
      <div className="sec-head">
        <h2 id="results-heading">
          <span className="mono text-ink-faint">
            &ldquo;{query.trim()}&rdquo;
          </span>
        </h2>
        <SearchStatus search={search} />
      </div>

      {search.error ? (
        <div className="notice mt-6" data-tone="danger" role="alert">
          <p className="notice-title">Couldn&apos;t load results.</p>
          <p className="notice-body">
            The search sources did not answer. This is usually temporary.
          </p>
          <div className="notice-actions">
            <button type="button" className="btn" onClick={search.retry}>
              Search again
            </button>
            <button type="button" className="btn" onClick={clear}>
              Clear
            </button>
          </div>
        </div>
      ) : search.results.length === 0 && search.loading ? (
        <div className="posters mt-6" aria-hidden="true">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div key={index} className="poster">
              <div className="poster-art skeleton" />
              <div className="skeleton mt-2.5 h-3.5 w-3/4" />
              <div className="skeleton mt-2 h-2.5 w-16" />
            </div>
          ))}
        </div>
      ) : search.results.length === 0 ? (
        <div className="notice mt-6" role="status">
          <p className="notice-title">No games found.</p>
          <p className="notice-body">
            Nothing matched that spelling. Titles are matched against the Steam
            catalogue.
          </p>
          <div className="notice-actions">
            <button type="button" className="btn" onClick={clear}>
              Clear search
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="posters mt-6">
            {search.results.map((game) => (
              <GamePoster key={game.id} game={game} />
            ))}
          </div>
          {search.loading && (
            <p className="mono mt-8 text-[11px] text-ink-faint" role="status">
              {search.status || "Searching"}…
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SearchStatus({ search }: { search: GameSearch }) {
  const text = search.loading
    ? search.status || "Searching"
    : `${search.results.length} result${search.results.length === 1 ? "" : "s"}`;

  return (
    <span className="sec-meta" role="status" aria-live="polite">
      {text}
    </span>
  );
}
