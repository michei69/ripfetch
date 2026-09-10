import { useState } from "react";
import { Link } from "react-router";
import type { SearchResult } from "../hooks/useGameSearch";
import { steamCapsuleUrl, steamHeaderUrl } from "../lib/steam";

type TileGame = Pick<SearchResult, "id" | "name"> & {
  cover?: string;
  small_capsule?: string;
};

/**
 * Steam serves a header for every app, but capsule art is not guaranteed and
 * the CDN 404s without an error status, so each fallback is only spent after
 * the previous image actually fails to load.
 */
function useCover(game: TileGame) {
  const primary = game.cover || steamHeaderUrl(game.id);
  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);

  const onError = () => {
    if (src !== primary) {
      setFailed(true);
      return;
    }
    if (game.small_capsule) {
      setSrc(steamCapsuleUrl(game.id, game.small_capsule));
      return;
    }
    setFailed(true);
  };

  return { src, failed, onError };
}

type GamePosterProps = {
  game: TileGame;
  onNavigate?: () => void;
};

export function GamePoster({ game, onNavigate }: GamePosterProps) {
  const { src, failed, onError } = useCover(game);

  return (
    <Link to={`/game/${game.id}`} className="poster" onClick={onNavigate}>
      <div className="poster-art">
        {failed ? (
          <div className="poster-art-fallback" aria-hidden="true">
            {game.name.slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onError}
          />
        )}
      </div>
      <p className="poster-title" title={game.name}>
        {game.name}
      </p>
      <p className="poster-id mono">appid {game.id}</p>
    </Link>
  );
}

export function ResultRows({
  results,
  onNavigate,
}: {
  results: SearchResult[];
  onNavigate?: () => void;
}) {
  return (
    <div className="results-list">
      {results.map((game) => (
        <ResultRow key={game.id} game={game} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export function ResultRow({ game, onNavigate }: GamePosterProps) {
  const { src, failed, onError } = useCover(game);

  return (
    <Link to={`/game/${game.id}`} className="result-row" onClick={onNavigate}>
      {failed ? (
        <div className="result-fallback" aria-hidden="true">
          {game.name.slice(0, 1).toUpperCase()}
        </div>
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={onError}
        />
      )}
      <span className="result-name">{game.name}</span>
    </Link>
  );
}
