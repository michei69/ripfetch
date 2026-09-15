import { createMemo, createSignal, For, Show } from "solid-js";
import type { SearchResult } from "../lib/gameSearch";
import { steamCapsuleUrl, steamHeaderUrl } from "../lib/steam";

type TileGame = Pick<SearchResult, "id" | "name"> & {
  cover?: string;
  small_capsule?: string;
};

const href = (id: number) => `/game/${id}`;

/**
 * Steam serves a header for every app, but capsule art is not guaranteed and
 * the CDN 404s without an error status, so each fallback is only spent after
 * the previous image actually failed to load.
 */
function useCover(game: () => TileGame) {
  const primary = createMemo(() => game().cover || steamHeaderUrl(game().id));
  const [src, setSrc] = createSignal<string>();
  const [failed, setFailed] = createSignal(false);

  const onError = () => {
    const current = src() ?? primary();
    if (current !== primary()) {
      setFailed(true);
      return;
    }
    const capsule = game().small_capsule;
    if (capsule) {
      setSrc(steamCapsuleUrl(game().id, capsule));
      return;
    }
    setFailed(true);
  };

  return { src: () => src() ?? primary(), failed, onError };
}

/**
 * The art slot both tiles share: the cover once one loads, the game's initial
 * when none does. Only the fallback's class differs between the grid tile and
 * the compact row, so the caller names it.
 */
function Cover(props: { game: TileGame; fallbackClass: string }) {
  const cover = useCover(() => props.game);

  return (
    <Show
      when={!cover.failed()}
      fallback={
        <div class={props.fallbackClass} aria-hidden="true">
          {props.game.name.slice(0, 1).toUpperCase()}
        </div>
      }
    >
      <img
        src={cover.src()}
        alt=""
        loading="lazy"
        decoding="async"
        onError={cover.onError}
      />
    </Show>
  );
}

type GamePosterProps = {
  game: TileGame;
  onNavigate?: () => void;
};

export function GamePoster(props: GamePosterProps) {
  return (
    <a href={href(props.game.id)} class="poster" onClick={props.onNavigate}>
      <div class="poster-art">
        <Cover game={props.game} fallbackClass="poster-art-fallback" />
      </div>
      <p class="poster-title" title={props.game.name}>
        {props.game.name}
      </p>
      <p class="poster-id mono">appid {props.game.id}</p>
    </a>
  );
}

export function ResultRows(props: {
  results: SearchResult[];
  onNavigate?: () => void;
}) {
  return (
    <div class="results-list">
      <For each={props.results}>
        {(game) => <ResultRow game={game} onNavigate={props.onNavigate} />}
      </For>
    </div>
  );
}

export function ResultRow(props: GamePosterProps) {
  return (
    <a href={href(props.game.id)} class="result-row" onClick={props.onNavigate}>
      <Cover game={props.game} fallbackClass="result-fallback" />
      <span class="result-name">{props.game.name}</span>
    </a>
  );
}
