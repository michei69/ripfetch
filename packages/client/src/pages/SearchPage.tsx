import { For, Show } from "solid-js";
import type { GameSearch } from "../lib/gameSearch";
import { useSearch } from "../components/SearchContext";
import { GamePoster } from "../components/GamePoster";
import { SourceIndex } from "../components/SourceIndex";
import { Notice } from "../components/ui/notice";
import { useRecents } from "../hooks/useRecents";
import { SOURCE_COUNT } from "../lib/sources";
import { plural } from "../lib/utils";

const SKELETON_COUNT = 8;

export default function SearchPage() {
  const { search, clear, query } = useSearch();

  return (
    <Show when={search.searching()} fallback={<Landing />}>
      <section aria-labelledby="results-heading">
        <div class="sec-head">
          <h2 id="results-heading">
            <span class="mono text-ink-faint">
              &ldquo;{query().trim()}&rdquo;
            </span>
          </h2>
          <SearchStatus search={search} />
        </div>

        <Show
          when={!search.error()}
          fallback={<Failure clear={clear} retry={search.retry} />}
        >
          <Show
            when={search.loading() && search.results().length === 0}
            fallback={
              <Show
                when={search.results().length > 0}
                fallback={<Empty clear={clear} />}
              >
                <Results search={search} />
              </Show>
            }
          >
            <Pending />
          </Show>
        </Show>
      </section>
    </Show>
  );
}

function Results(props: { search: GameSearch }) {
  return (
    <>
      <div class="posters mt-6">
        <For each={props.search.results()}>
          {(game) => <GamePoster game={game} />}
        </For>
      </div>
      <Show when={props.search.loading()}>
        <p class="mono mt-8 text-[11px] text-ink-faint" role="status">
          {props.search.status() || "Searching"}…
        </p>
      </Show>
    </>
  );
}

/** Idle state: what this is, what was opened last, what it searches. */
function Landing() {
  const recents = useRecents();

  return (
    <>
      <h1 class="masthead">Every download source for every game.</h1>
      <p class="lede">
        Type a title, pick a source, get a link. ripfetch queries {SOURCE_COUNT}{" "}
        repack sites at once and returns them as one list.
      </p>

      <Show when={recents().length > 0}>
        <section class="mt-14">
          <div class="sec-head">
            <h2>Continue</h2>
            <span class="sec-meta">last {recents().length} viewed</span>
          </div>
          <div class="posters mt-6">
            <For each={recents()}>{(game) => <GamePoster game={game} />}</For>
          </div>
        </section>
      </Show>

      <section class="sources-inline mt-14">
        <div class="sec-head">
          <h2>Sources</h2>
        </div>
        <div class="mt-4">
          <SourceIndex />
        </div>
      </section>
    </>
  );
}

function Pending() {
  return (
    <div class="posters mt-6" aria-hidden="true">
      <For each={Array.from({ length: SKELETON_COUNT })}>
        {() => (
          <div class="poster">
            <div class="poster-art skeleton" />
            <div class="skeleton mt-2.5 h-3.5 w-3/4" />
            <div class="skeleton mt-2 h-2.5 w-16" />
          </div>
        )}
      </For>
    </div>
  );
}

function Failure(props: { clear: () => void; retry: () => void }) {
  return (
    <Notice
      class="mt-6"
      role="alert"
      tone="danger"
      title="Couldn't load results."
      action={
        <>
          <button type="button" class="btn" onClick={props.retry}>
            Search again
          </button>
          <button type="button" class="btn" onClick={props.clear}>
            Clear
          </button>
        </>
      }
    >
      The search sources did not answer. This is usually temporary.
    </Notice>
  );
}

function Empty(props: { clear: () => void }) {
  return (
    <Notice
      class="mt-6"
      title="No games found."
      action={
        <button type="button" class="btn" onClick={props.clear}>
          Clear search
        </button>
      }
    >
      Nothing matched that spelling. Titles are matched against the Steam
      catalogue.
    </Notice>
  );
}

function SearchStatus(props: { search: GameSearch }) {
  const text = () =>
    props.search.loading()
      ? props.search.status() || "Searching"
      : plural(props.search.results().length, "result");

  return (
    <span class="sec-meta" role="status" aria-live="polite">
      {text()}
    </span>
  );
}
