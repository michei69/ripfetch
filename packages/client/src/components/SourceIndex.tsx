import { For, Show } from "solid-js";
import { SOURCES, SOURCE_COUNT, SOURCE_RANK } from "../lib/sources";

/**
 * The catalogue of sources ripfetch scrapes, ruled like an index page. It is
 * the rail's answer to "what is this thing actually searching", and it doubles
 * as the legend for the warnings that appear before an external redirect.
 */
export function SourceIndex() {
  return (
    <section>
      <p class="label mb-1">{SOURCE_COUNT} sources</p>
      <div class="border-t border-line-soft">
        <For each={SOURCES}>
          {(source) => (
            <div class="src-item">
              <span class="src-item-no">
                {String(SOURCE_RANK[source.key]! + 1).padStart(2, "0")}
              </span>
              <span class="src-item-name">{source.name}</span>
              <Show when={source.note}>
                {(note) => (
                  <span class="src-item-note" data-tone={source.tone}>
                    {note()}
                  </span>
                )}
              </Show>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
