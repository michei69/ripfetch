import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowUpRight, Search, X } from "lucide-react";
import { API_BASE_URL } from "../lib/config";
import { useDebounce } from "../hooks/useDebounce";
import { isJsonObject, parseEventData } from "../lib/sse";
import { Button } from "../components/ui/button";

type SearchResult = { name: string; id: number; objectID?: string; small_capsule?: string };
const picks: SearchResult[] = [{ id: 1245620, name: "ELDEN RING" }, { id: 1091500, name: "Cyberpunk 2077" }, { id: 1086940, name: "Baldur's Gate 3" }, { id: 1145360, name: "Hades" }];

function TileArt({ game }: { game: SearchResult }) {
  const primary = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.id}/header.jpg`;
  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={game.name}
        className="flex h-full w-full items-center justify-center border border-dashed border-border font-mono text-muted-foreground"
      >
        [ NO ARTWORK ]
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={game.name}
      loading="lazy"
      onError={() => {
        if (src === primary && game.small_capsule) {
          setSrc(
            `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.id}/${game.small_capsule}/capsule_231x87.jpg`,
          );
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

const parseSearchResult = (value: unknown): SearchResult | null => {
  if (
    !isJsonObject(value) ||
    typeof value.name !== "string" ||
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0
  ) {
    return null;
  }

  const name = value.name;
  const id = value.id;
  return {
    name,
    id,
    ...(typeof value.objectID === "string"
      ? { objectID: value.objectID }
      : {}),
    ...(typeof value.small_capsule === "string"
      ? { small_capsule: value.small_capsule }
      : {}),
  };
};

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const debounced = useDebounce(query.trim(), 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setResults([]); setError("");
    if (debounced.length < 2 || query.trim() !== debounced) { setLoading(false); setStatus(""); return; }
    setLoading(true); setStatus("Connecting to search server");
    const stream = new EventSource(`${API_BASE_URL}/api/search/sse?q=${encodeURIComponent(debounced)}`);
    stream.addEventListener("status", (event) => {
      const data = parseEventData(event);
      if (isJsonObject(data) && typeof data.message === "string") {
        setStatus(data.message);
      }
    });
    stream.addEventListener("result", (event) => {
      const result = parseSearchResult(parseEventData(event));
      if (!result) return;
      setResults((previous) => previous.some((item) => item.id === result.id) ? previous : [...previous, result]);
    });
    stream.addEventListener("complete", () => { setLoading(false); setStatus("Search complete"); stream.close(); });
    stream.addEventListener("failure", () => { setError("Search is unavailable. Please try again."); setLoading(false); stream.close(); });
    stream.onerror = () => { setError("Connection interrupted. Please try again."); setLoading(false); stream.close(); };
    return () => stream.close();
  }, [debounced, query, attempt]);
  const searching = query.trim().length >= 2;
  return (
    <section className="search-page">
      <div className="search-stage">
      <div className="page-heading">
        <h1>
          What do you want to <em>play</em>?
          <span aria-hidden="true" className="cursor-blink ml-2 inline-block h-[0.8em] w-[0.5em] bg-phosphor" />
        </h1>
        <p>Find a game. Compare its download sources.</p>
      </div>
      <form className="search-field" role="search" onSubmit={(event) => event.preventDefault()}>
        <span className="term-prompt" aria-hidden="true" />
        <Search aria-hidden="true" size={22} style={{ color: "var(--phosphor)" }} />
        <input aria-label="Search games" placeholder="Search games" maxLength={200} value={query} onChange={(event) => { setParams(event.target.value ? { q: event.target.value } : {}, { replace: true }); }} style={{ caretColor: "var(--phosphor)" }} />
        {query && <button type="button" title="Clear search" aria-label="Clear search" onClick={() => setParams({})} style={{ border: "1px solid var(--border)", borderRadius: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44 }}><X size={19} /></button>}
      </form>
      </div>
      <div className="section-heading"><h2 className="term-prompt">{searching ? "Search results" : "Worth a look"}</h2><span role="status">{searching ? loading ? status : `${results.length} games` : "Selected games"}</span></div>
      {error && <div className="inline-error" role="alert"><span className="min-w-0 flex-1"><span style={{ color: "var(--amber)" }}>[ ERROR ]</span> {error}</span><Button type="button" onClick={() => setAttempt((value) => value + 1)} style={{ background: "var(--primary)", border: "1px solid var(--primary)", color: "var(--primary-foreground)", fontWeight: 500, textDecoration: "none" }}>Retry</Button></div>}
      {searching && !loading && !error && results.length === 0 && <div className="empty-state"><Search size={30} /><h3 className="font-mono">[ NO RESULTS ]</h3><p>Try another title or check the spelling.</p></div>}
      <div className={searching ? "game-grid game-grid-search" : "game-grid"}>
        {(searching ? results : picks).map((game) => <Link key={game.id} to={`/game/${game.id}`} className="game-tile group"><div className="game-art relative border border-border transition-[filter,box-shadow] group-hover:brightness-110 group-hover:shadow-[0_0_16px_color-mix(in_srgb,var(--phosphor)_40%,transparent)]"><TileArt game={game} /><span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(to bottom, transparent 0 2px, hsl(0 0% 0% / 0.4) 3px, transparent 4px)" }} /></div><div className="game-tile-title"><h3 className="font-mono">{game.name}</h3><ArrowUpRight size={18} aria-hidden="true" style={{ color: "var(--phosphor)" }} /></div><span className="tile-caption term-prompt">View sources</span></Link>)}
        {searching && loading && results.length === 0 && [0, 1, 2, 3].map((key) => <div key={key} className="game-tile skeleton-tile" aria-hidden="true"><div className="game-art skeleton-shimmer" /><div className="skeleton-line skeleton-shimmer" /></div>)}
      </div>
    </section>
  );
}
