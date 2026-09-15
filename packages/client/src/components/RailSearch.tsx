import { createSignal, Show } from "solid-js";
import { Search, X } from "./icons";
import { useSearch } from "./SearchContext";
import { onDismiss } from "../hooks/useDismiss";
import { ResultRows } from "./GamePoster";

/**
 * The rail search field. On the search route it only drives the URL; on any
 * other route it also reveals matching results inline, so a game page never
 * needs a round trip through `/` to search again.
 */
export function RailSearch() {
  const { query, setQuery, submit, clear, search, onSearchRoute, inputRef } =
    useSearch();
  const [focused, setFocused] = createSignal(false);

  const showResults = () => !onSearchRoute() && search.searching();

  return (
    <div
      class="relative"
      ref={(element) => onDismiss(element, clear, showResults)}
    >
      <form
        role="search"
        class="field"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Search size={15} />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search games"
          placeholder="Search games"
          maxlength={200}
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            if (query()) {
              clear();
              return;
            }
            event.currentTarget.blur();
          }}
        />
        <Show
          when={query()}
          fallback={
            // Only meaningful while the field is unfocused —
            // focused, `/` is just a character being typed.
            <Show when={!focused()}>
              <kbd class="field-key" aria-hidden="true">
                /
              </kbd>
            </Show>
          }
        >
          <button
            type="button"
            class="field-clear"
            onClick={clear}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        </Show>
      </form>

      <Show when={showResults()}>
        <div class="rail-pop absolute top-full left-0 z-40 mt-1.5 w-full">
          <div class="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
            <span class="label">
              {search.results().length} result
              {search.results().length === 1 ? "" : "s"}
            </span>
            <span class="mono text-[10.5px] text-ink-faint">
              {search.loading() ? search.status() || "Searching" : "complete"}
            </span>
          </div>
          <div class="max-h-[52vh] overflow-y-auto">
            <ResultRows results={search.results()} onNavigate={clear} />
          </div>
        </div>
      </Show>
    </div>
  );
}
