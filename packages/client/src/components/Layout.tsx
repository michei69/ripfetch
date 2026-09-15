import { For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { useLocation } from "@solidjs/router";
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
export function Layout(props: { children?: JSX.Element }) {
  const location = useLocation();
  const recents = useRecents();

  return (
    <div class="app-shell">
      <a class="skip-link" href="#content">
        Skip to content
      </a>

      <aside
        class="rail"
        data-static={location.pathname.startsWith("/game/") || undefined}
      >
        <div class="rail-head">
          <a href="/" class="rail-brand" aria-label="ripfetch home">
            <span class="wordmark">ripfetch</span>
            <span class="wordmark-sub">download index</span>
          </a>
          <ThemeSwitch />
        </div>

        <RailSearch />

        <Show when={recents().length > 0}>
          <section class="rail-recents">
            <p class="label mb-1">Recently viewed</p>
            <div class="border-t border-line-soft">
              <For each={recents().slice(0, 5)}>
                {(game) => <ResultRow game={game} />}
              </For>
            </div>
          </section>
        </Show>

        <div class="rail-foot">
          <SourceIndex />
          <div class="rail-legal">
            <p class="rail-note">
              Links lead to external sources. No files are hosted here.
            </p>
          </div>
        </div>
      </aside>

      <div class="pane">
        <main id="content" class="app-content" tabindex={-1}>
          {props.children}
        </main>
        <footer class="app-footer">
          <p class="app-footer-note">
            ripfetch indexes download pages published by third parties and never
            hosts, mirrors or verifies them. Download safety is not guaranteed.
          </p>
        </footer>
      </div>
    </div>
  );
}
