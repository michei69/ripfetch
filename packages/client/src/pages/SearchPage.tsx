import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowUpRight, Search, X } from "lucide-react";
import { API_BASE_URL } from "../lib/config";
import { useDebounce } from "../hooks/useDebounce";
import { isJsonObject, parseEventData } from "../lib/sse";

type SearchResult = { name: string; id: number; objectID?: string; small_capsule?: string };
const picks: SearchResult[] = [{ id: 1245620, name: "ELDEN RING" }, { id: 1091500, name: "Cyberpunk 2077" }, { id: 1086940, name: "Baldur's Gate 3" }, { id: 1145360, name: "Hades" }];

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
      <div className="page-heading"><h1>What do you want to <em>play</em>?</h1><p>Find a game. Compare its download sources.</p></div>
      <form className="search-field" role="search" onSubmit={(event) => event.preventDefault()}>
        <Search aria-hidden="true" size={22} />
        <input aria-label="Search games" placeholder="Search games" maxLength={200} value={query} onChange={(event) => { setParams(event.target.value ? { q: event.target.value } : {}, { replace: true }); }} />
        {query && <button type="button" title="Clear search" aria-label="Clear search" onClick={() => setParams({})}><X size={19} /></button>}
      </form>
      </div>
      <div className="section-heading"><h2>{searching ? "Search results" : "Worth a look"}</h2><span role="status">{searching ? loading ? status : `${results.length} games` : "Selected games"}</span></div>
      {error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div>}
      {searching && !loading && !error && results.length === 0 && <div className="empty-state"><Search size={30} /><h3>No games found</h3><p>Try another title or check the spelling.</p></div>}
      <div className={searching ? "game-grid game-grid-search" : "game-grid"}>
        {(searching ? results : picks).map((game) => <Link key={game.id} to={`/game/${game.id}`} className="game-tile"><div className="game-art"><img src={`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.id}/header.jpg`} alt={game.name} loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /></div><div className="game-tile-title"><h3>{game.name}</h3><ArrowUpRight size={18} aria-hidden="true" /></div><span className="tile-caption">View sources</span></Link>)}
        {searching && loading && results.length === 0 && [0, 1, 2, 3].map((key) => <div key={key} className="game-tile skeleton-tile" aria-hidden="true"><div className="game-art" /><div className="skeleton-line" /></div>)}
      </div>
    </section>
  );
}
