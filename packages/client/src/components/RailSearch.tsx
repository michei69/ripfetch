import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useSearch } from "./SearchContext";
import { useDismiss } from "../hooks/useDismiss";
import { ResultRows } from "./GamePoster";

/**
 * The rail search field. On the search route it only drives the URL; on any
 * other route it also reveals matching results inline, so a game page never
 * needs a round trip through `/` to search again.
 */
export function RailSearch() {
  const { query, setQuery, submit, clear, search, onSearchRoute, inputRef } =
    useSearch();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const showResults = !onSearchRoute && search.searching;

  useDismiss(rootRef, clear, showResults);

  return (
    <div className="relative" ref={rootRef}>
      <form
        role="search"
        className="field"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Search size={15} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search games"
          placeholder="Search games"
          maxLength={200}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            if (query) {
              clear();
              return;
            }
            event.currentTarget.blur();
          }}
        />
        {query ? (
          <button
            type="button"
            className="field-clear"
            onClick={clear}
            aria-label="Clear search"
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : (
          // Only meaningful while the field is unfocused — focused, `/` is
          // just a character being typed.
          !focused && (
            <kbd className="field-key" aria-hidden="true">
              /
            </kbd>
          )
        )}
      </form>

      {showResults && (
        <div className="rail-pop absolute top-full left-0 z-40 mt-1.5 w-full">
          <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
            <span className="label">
              {search.results.length} result
              {search.results.length === 1 ? "" : "s"}
            </span>
            <span className="mono text-[10.5px] text-ink-faint">
              {search.loading ? search.status || "Searching" : "complete"}
            </span>
          </div>
          <div className="max-h-[52vh] overflow-y-auto">
            <ResultRows results={search.results} onNavigate={clear} />
          </div>
        </div>
      )}
    </div>
  );
}
