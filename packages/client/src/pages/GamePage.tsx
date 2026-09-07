import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link } from "react-router";
import {
  ExternalLink,
  Download,
  Globe,
  Users,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  CircleAlert,
  ArrowLeft,
  Gamepad2,
  LoaderCircleIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { toast } from "react-toastify";
import { SourceWarningModal, WARNINGS } from "../components/ui/source-warning";
import { GamePageSkeleton } from "../components/skeleton";
import { cn } from "../lib/utils";
import { API_BASE_URL } from "../lib/config";
import { isJsonObject, parseEventData } from "../lib/sse";
import { isSafeExternalUrl } from "../lib/urls";

// ─── constants ────────────────────────────────────────────────────────────

const SOURCE_ORDER = [
  "online-fix.me",
  "gogto",
  "gload",
  "steamrip",
  "fitgirl",
  "ovagames",
  "dodi",
  "game3rb",
  "igg",
  "steamunlocked",
];

const TRUSTED_MARKERS = [
  "fuckingfast",
  "megaup",
  "gofile",
  "pixeldrain",
  "mega.nz",
  "vikingfile",
  "datanodes",
  "1fichier",
  "koramaup",
  "buzzheavier",
  "1cloudfile",
  "fileq",
  "torrent",
];

const SLOW_MARKERS = ["uploadhaven"];

const PROXY_MARKERS = ["uploadhaven"];

// ─── helpers ───────────────────────────────────────────────────────────────

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url.length > 30 ? `${url.slice(0, 30)}…` : url;
  }
};

const matchesAny = (domain: string, markers: string[]) =>
  markers.some((m) => domain.toLowerCase().includes(m));
const whichMatch = (domain: string, markers: string[]) =>
  markers.findIndex((m) => domain.toLowerCase().includes(m));

const parseSource = (key: string) => {
  const m = key.match(/^(.+?)\s*\((.+)\)$/);
  return m
    ? { source: m[1]!.trim(), title: m[2]!.trim() }
    : { source: key, title: null };
};

const groupByDomain = (
  links: Record<string, string>,
): Array<{ domain: string; items: Array<{ label: string; url: string }> }> => {
  const map = new Map<string, Array<{ label: string; url: string }>>();

  for (const [key, url] of Object.entries(links)) {
    const sep = key.indexOf(" - ");
    const domain = sep !== -1 ? key.slice(0, sep) : "Other";
    const label = sep !== -1 ? key.slice(sep + 3) : key;

    if (!map.has(domain)) map.set(domain, []);
    map.get(domain)!.push({ label, url });
  }

  return Array.from(map.entries())
    .map(([domain, items]) => ({
      domain,
      items: items.sort((a, b) => {
        const numRe = /(\d+)/g;
        const aParts = a.label.split(numRe);
        const bParts = b.label.split(numRe);
        for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
          if (i % 2 === 0) {
            const c = aParts[i]!.toLowerCase().localeCompare(
              bParts[i]!.toLowerCase(),
            );
            if (c !== 0) return c;
          } else {
            const an = parseInt(aParts[i]!, 10) || 0;
            const bn = parseInt(bParts[i]!, 10) || 0;
            if (an !== bn) return an - bn;
          }
        }
        return aParts.length - bParts.length;
      }),
    }))
    .sort((a, b) => {
      const aTrusted = matchesAny(a.domain, TRUSTED_MARKERS);
      const bTrusted = matchesAny(b.domain, TRUSTED_MARKERS);
      if (aTrusted && !bTrusted) return -1;
      if (!aTrusted && bTrusted) return 1;
      const aIdx = whichMatch(a.domain, TRUSTED_MARKERS);
      const bIdx = whichMatch(b.domain, TRUSTED_MARKERS);
      return aIdx === bIdx ? a.domain.localeCompare(b.domain) : aIdx - bIdx;
    });
};

// ─── types ─────────────────────────────────────────────────────────────────

type SteamInfo = {
  name: string;
  header_image: string;
  short_description: string;
  developers: string[];
  publishers: string[];
  genres: Array<{ id: number; description: string }>;
  price_overview?: { initial_formatted: string; final_formatted: string };
  is_free: boolean;
};

const parseSteamInfo = (value: unknown): SteamInfo | null => {
  if (!isJsonObject(value) || typeof value.name !== "string") return null;

  const headerImage =
    typeof value.header_image === "string" &&
    isSafeSteamImageUrl(value.header_image)
      ? value.header_image
      : "";

  const genres = Array.isArray(value.genres)
    ? value.genres.flatMap((genre) => {
        if (
          !isJsonObject(genre) ||
          typeof genre.id !== "number" ||
          typeof genre.description !== "string"
        ) {
          return [];
        }
        return [{ id: genre.id, description: genre.description }];
      })
    : [];

  const price = isJsonObject(value.price_overview)
    ? {
        initial_formatted:
          typeof value.price_overview.initial_formatted === "string"
            ? value.price_overview.initial_formatted
            : "",
        final_formatted:
          typeof value.price_overview.final_formatted === "string"
            ? value.price_overview.final_formatted
            : "",
      }
    : undefined;

  return {
    name: value.name,
    header_image: headerImage,
    short_description:
      typeof value.short_description === "string"
        ? value.short_description
        : "",
    developers: Array.isArray(value.developers)
      ? value.developers.filter(
          (developer): developer is string => typeof developer === "string",
        )
      : [],
    publishers: Array.isArray(value.publishers)
      ? value.publishers.filter(
          (publisher): publisher is string => typeof publisher === "string",
        )
      : [],
    genres,
    price_overview: price,
    is_free: value.is_free === true,
  };
};

const parseDownloads = (
  value: unknown,
): Record<string, Record<string, string>> => {
  if (!isJsonObject(value) || !isJsonObject(value.downloads)) return {};

  const downloads: Record<string, Record<string, string>> = Object.create(null);
  for (const [source, links] of Object.entries(value.downloads)) {
    if (!isJsonObject(links)) continue;

    const safeLinks: Record<string, string> = Object.create(null);
    for (const [label, url] of Object.entries(links)) {
      if (isSafeExternalUrl(url)) safeLinks[label] = url;
    }

    if (Object.keys(safeLinks).length > 0) downloads[source] = safeLinks;
  }

  return downloads;
};

const isSafeSteamImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    return (
      hostname === "shared.fastly.steamstatic.com" ||
      hostname === "cdn.akamai.steamstatic.com" ||
      hostname === "steamcdn-a.akamaihd.net"
    );
  } catch {
    return false;
  }
};

// ─── component ─────────────────────────────────────────────────────────────

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [steam, setSteam] = useState<SteamInfo | null>(null);
  const [downloads, setDownloads] = useState<
    Record<string, Record<string, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activity, setActivity] = useState<Record<string, string>>({});
  const [requestStatus, setRequestStatus] = useState("Connecting to server");
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingLink, setPendingLink] = useState<{
    url: string;
    domain: string;
    source: string;
  } | null>(null);

  // ── data fetching ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    let active = true;
    const current = () => active;

    setLoading(true);
    setActivity({});
    setRequestStatus("Waiting for Steam game details");
    setError(null);
    setSteam(null);
    setDownloads({});
    setProgress(0);
    setCollapsed(new Set());

    const stream = new EventSource(
      `${API_BASE_URL}/api/game/${encodeURIComponent(id)}/stream`,
    );

    setRequestStatus("Connecting to source search");
    stream.addEventListener("game", (event) => {
      if (!current()) return;
      const data = parseEventData(event);
      const nextSteam = isJsonObject(data)
        ? parseSteamInfo(data.steam)
        : null;
      if (!nextSteam) return;
      setSteam(nextSteam);
      setLoading(false);
    });
    stream.addEventListener("result", (event) => {
      if (!current()) return;
      const nextDownloads = parseDownloads(parseEventData(event));
      setDownloads((previous) => ({
        ...previous,
        ...nextDownloads,
      }));
    });
    stream.addEventListener("status", (event) => {
      if (!current()) return;
      const data = parseEventData(event);
      if (!isJsonObject(data)) return;
      const message = data.message;
      if (typeof message !== "string") return;
      const source = data.source;
      if (typeof source === "string") {
        setActivity((previous) => ({
          ...previous,
          [source]: message,
        }));
      } else {
        setRequestStatus(message);
      }
      if (
        typeof data.completed === "number" &&
        typeof data.total === "number" &&
        data.total > 0
      ) {
        setProgress(Math.min(99, (data.completed / data.total) * 100));
      }
    });
    stream.addEventListener("failure", (event) => {
      if (!current()) return;
      const data = parseEventData(event);
      const message =
        isJsonObject(data) && typeof data.message === "string"
          ? data.message
          : "Failed to fetch download links.";
      setError(message);
      setLoading(false);
      setRequestStatus("Search interrupted");
      stream.close();
    });

    stream.addEventListener("data", (event) => {
      if (!current()) return;
      setDownloads(parseDownloads(parseEventData(event)));
      setProgress(100);
      setRequestStatus("Search complete");
      stream.close();
    });

    stream.addEventListener("search", (event) => {
      const data = parseEventData(event);
      if (
        !current() ||
        !isJsonObject(data) ||
        typeof data.source !== "string" ||
        typeof data.sourceIdx !== "number" ||
        typeof data.total !== "number" ||
        data.total <= 0
      ) {
        return;
      }
      const source = data.source;
      setActivity((previous) => ({
        ...previous,
        [source]: "Waiting for source search",
      }));
      setRequestStatus("Checking download sources");
      setProgress(((data.sourceIdx - 1) / data.total) * 100);
    });

    stream.onerror = () => {
      if (!current()) return;
      // readyState CLOSED means close() was called normally
      // after receiving data — don't overwrite with an error.
      if (stream.readyState === EventSource.CLOSED) return;
      stream.close();
      setRequestStatus("Connection interrupted");
      setLoading(false);
      setError(
        "Failed to fetch download links. The search sources may be unavailable.",
      );
    };

    return () => {
      active = false;
      stream.close();
    };
  }, [id, attempt]);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    [],
  );

  // ── copy handler ──────────────────────────────────────────────────────

  const copyLink = async (url: string, id: string) => {
    if (!isSafeExternalUrl(url)) {
      toast.error("Invalid download link");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success("Link copied to clipboard");
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => {
        copyTimeout.current = null;
        setCopiedId(null);
      }, 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sourceEntries = useMemo(
    () =>
      Object.entries(downloads).sort(([a], [b]) => {
        const sa = parseSource(a).source.toLowerCase();
        const sb = parseSource(b).source.toLowerCase();
        const ia = SOURCE_ORDER.indexOf(sa);
        const ib = SOURCE_ORDER.indexOf(sb);
        if (ia === -1 && ib === -1) return sa.localeCompare(sb);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      }),
    [downloads],
  );
  const groupedSources = useMemo(
    () =>
      sourceEntries.map(([sourceKey, links]) => {
        const { source, title } = parseSource(sourceKey);
        return {
          sourceKey,
          links,
          source,
          title,
          groups: groupByDomain(links),
          linkCount: Object.keys(links).length,
        };
      }),
    [sourceEntries],
  );

  // ── render ────────────────────────────────────────────────────────────

  // Loading
  if (loading && !steam) {
    return <><p role="status" className="request-status">{requestStatus}</p><GamePageSkeleton /></>;
  }

  // Error with no data
  if (error && !steam) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="h-14 w-14 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-5">
            <CircleAlert className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-destructive mb-2">
            Failed to Load Game
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Search
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (!steam) return null;

  return (
    <section className="game-page">
      <div>
        {/* ── Hero card ───────────────────────────────────────────── */}
        <section className="game-overview">
          <div className="relative">
            <div className="relative p-6 md:p-8">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Search
              </Link>

              <div className="flex flex-col md:flex-row gap-6">
                {steam.header_image && (
                  <div className="md:w-72 shrink-0">
                    <img
                      src={steam.header_image}
                      alt={steam.name}
                      className="w-full rounded-xl shadow-lg object-cover aspect-video md:aspect-auto"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="game-title"><a
                    href={`https://store.steampowered.com/app/${encodeURIComponent(id ?? "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xl md:text-3xl font-bold hover:underline decoration-primary/30 underline-offset-4 inline-block mb-3"
                  >
                    {steam.name}
                  </a></h1>

                  {steam.short_description && (
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {steam.short_description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <Badge variant={steam.is_free ? "success" : "default"}>
                      {steam.is_free
                        ? "Free"
                        : steam.price_overview?.final_formatted ||
                          steam.price_overview?.initial_formatted ||
                          "N/A"}
                    </Badge>
                    {steam.genres?.map((g) => (
                      <Badge key={g.id} variant="secondary">
                        {g.description}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {steam.developers?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Dev:</span>
                        <span className="font-medium">
                          {steam.developers.join(", ")}
                        </span>
                      </div>
                    )}
                    {steam.publishers?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Pub:</span>
                        <span className="font-medium">
                          {steam.publishers.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Download Links ──────────────────────────────────────── */}
        <div className="download-workspace"><aside className="activity-panel" aria-label="Server activity">
          <div className="section-heading"><h2>Server activity</h2><span>{Math.floor(progress)}%</span></div>
          <Progress value={progress} />
          <p role="status" className="request-status">{requestStatus}</p>
          <ul>{Object.entries(activity).map(([source, message]) => <li key={source}><strong>{source}</strong><span>{message}</span></li>)}</ul>
        </aside><div className="download-results">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Download Links</h3>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(downloads).length} source
                  {Object.keys(downloads).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Progress
              value={progress}
              className={cn(
                "w-32 md:w-48 transition-opacity",
                progress <= 0 || progress >= 100 ? "opacity-0" : "opacity-100",
              )}
            />
          </div>

          {/* No downloads yet — loading */}
          {progress > 0 &&
            progress < 100 &&
            Object.keys(downloads).length === 0 && (
              <Card className="p-10 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <LoaderCircleIcon className="animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Searching sources for download links...
                  </p>
                  <Progress value={progress} className="w-48" />
                </div>
              </Card>
            )}

          {/* Error after steam loaded */}
          {error && steam && (
            <Card className="p-6 text-center">
              <CircleAlert className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-sm font-medium text-destructive mb-1">
                Couldn't load downloads
              </p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </Card>
          )}

          {/* Empty */}
          {!error &&
            Object.keys(downloads).length === 0 &&
            progress === 100 && (
              <Card className="p-10 text-center">
                <Gamepad2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="font-medium">No Downloads Available</p>
                <p className="text-xs text-muted-foreground mt-1 mb-5">
                  Couldn't find any download links for this game.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4" />
                    Search for Another Game
                  </Link>
                </Button>
              </Card>
            )}

          {/* Results */}
          {sourceEntries.length > 0 && (
            <div className="space-y-3">
              {groupedSources.map(
                ({ sourceKey, source, title, groups, linkCount }) => {
                const isCollapsed = collapsed.has(sourceKey);

                return (
                  <Card key={sourceKey} className="source-result overflow-hidden">
                    {/* Source header */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(sourceKey)}
                      aria-expanded={!isCollapsed}
                      className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-accent/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Download className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold capitalize">{source}</h4>
                            {title && (
                              <span className="text-xs text-muted-foreground">
                                ({title})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {linkCount} link{linkCount !== 1 ? "s" : ""}
                            {isCollapsed ? " — collapsed" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform duration-200",
                          !isCollapsed && "rotate-180",
                        )}
                      />
                    </button>

                    {/* Domain groups */}
                    {!isCollapsed && (
                      <div className="px-4 md:px-5 pb-4 md:pb-5 space-y-4">
                        {groups.map(({ domain, items }) => {
                          const isTrusted = matchesAny(domain, TRUSTED_MARKERS);
                          const isSlow = matchesAny(domain, SLOW_MARKERS);
                          const isProxied = matchesAny(domain, PROXY_MARKERS);

                          return (
                            <div key={domain}>
                              <div className="flex items-center gap-2 mb-2.5">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm font-semibold">
                                  {domain}
                                </span>
                                <div className="flex gap-1">
                                  {isTrusted && (
                                    <Badge variant="success">Recommended</Badge>
                                  )}
                                  {isSlow && (
                                    <Badge variant="warning">Slow</Badge>
                                  )}
                                  {isProxied && (
                                    <Badge variant="info">Proxied</Badge>
                                  )}
                                </div>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {items.length} link
                                  {items.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {items.map(({ label, url }) => {
                                  if (!isSafeExternalUrl(url)) return null;

                                  const uid = `${sourceKey}::${label}`;
                                  const isCopied = copiedId === uid;
                                  const domain = hostname(url);

                                  const handleLinkClick = (
                                    e: React.MouseEvent,
                                  ) => {
                                    const dismissed = localStorage.getItem(
                                      `ripfetch_warning_dismissed_${source.toLowerCase()}`,
                                    );
                                    if (
                                      dismissed === "true" ||
                                      !WARNINGS[source.toLowerCase()]
                                    )
                                      return;
                                    e.preventDefault();
                                    setPendingLink({
                                      url,
                                      domain,
                                      source: source.toLowerCase(),
                                    });
                                  };

                                  return (
                                    <div
                                      key={uid}
                                      className="download-row group flex items-center justify-between gap-2 p-3 hover:bg-accent transition-colors"
                                    >
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={handleLinkClick}
                                        className="flex items-center gap-2.5 min-w-0 flex-1"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                            {label}
                                          </p>
                                          <p className="text-xs text-muted-foreground truncate">
                                            {domain}
                                          </p>
                                        </div>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => copyLink(url, uid)}
                                        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                        aria-label="Copy link"
                                        title="Copy link"
                                      >
                                        {isCopied ? (
                                          <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              },
              )}
            </div>
          )}
        </div></div>
      </div>

      <SourceWarningModal
        open={pendingLink !== null}
        source={pendingLink?.source ?? ""}
        domain={pendingLink?.domain ?? ""}
        onConfirm={() => {
          if (pendingLink && isSafeExternalUrl(pendingLink.url))
            window.open(pendingLink.url, "_blank", "noopener noreferrer");
          setPendingLink(null);
        }}
        onDismiss={() => setPendingLink(null)}
        onDismissPermanently={() => {
          if (pendingLink) {
            localStorage.setItem(
              `ripfetch_warning_dismissed_${pendingLink.source}`,
              "true",
            );
            if (isSafeExternalUrl(pendingLink.url)) {
              window.open(pendingLink.url, "_blank", "noopener noreferrer");
            }
          }
          setPendingLink(null);
        }}
      />
    </section>
  );
}
