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
  ArrowLeft,
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
      hostname === "shared.akamai.steamstatic.com" ||
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
      <section className="game-page">
        <div className="mx-auto max-w-xl border border-destructive bg-card">
          <div className="border-b border-destructive bg-destructive/10 px-5 py-3">
            <p className="font-mono text-sm text-destructive">[ FAILED ]</p>
          </div>
          <div className="p-5 md:p-6">
            <h2 className="text-2xl text-destructive mb-2 md:text-3xl">
              Failed to Load Game
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {error}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Search
                </Link>
              </Button>
            </div>
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
          {/* terminal title bar */}
          <div className="mb-5 flex items-center gap-2 border-b border-border pb-3">
            <span aria-hidden="true" className="h-2.5 w-2.5 bg-destructive" />
            <span aria-hidden="true" className="h-2.5 w-2.5 bg-amber" />
            <span aria-hidden="true" className="h-2.5 w-2.5 bg-phosphor" />
            <span className="ml-2 min-w-0 truncate font-mono text-xs text-muted-foreground">
              game://{id ?? ""}
            </span>
          </div>
          <div>
            <Link
              to="/"
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-phosphor"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Search
            </Link>

            <div className="flex flex-col gap-6 md:flex-row">
              {steam.header_image && (
                <div className="shrink-0 md:w-72">
                  <div className="relative overflow-hidden border border-border bg-muted">
                    <img
                      src={steam.header_image}
                      alt={steam.name}
                      className="block aspect-video w-full object-cover brightness-[0.92] transition-[filter] duration-150 hover:brightness-110 md:aspect-auto"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-15 bg-[repeating-linear-gradient(to_bottom,transparent_0px,transparent_2px,rgba(0,0,0,0.8)_3px,transparent_4px)]"
                    />
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="game-title"><a
                  href={`https://store.steampowered.com/app/${encodeURIComponent(id ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 inline-block"
                >
                  {steam.name}
                </a></h1>

                {steam.short_description && (
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    {steam.short_description}
                  </p>
                )}

                <div className="mb-4 flex flex-wrap gap-1.5">
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

                <div className="flex flex-col gap-1.5 text-sm">
                  {steam.developers?.length > 0 && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Users
                        className="h-4 w-4 shrink-0 text-phosphor-dim"
                        aria-hidden="true"
                      />
                      <span className="font-medium">Dev:</span>
                      <span className="break-words text-muted-foreground">
                        {steam.developers.join(", ")}
                      </span>
                    </p>
                  )}
                  {steam.publishers?.length > 0 && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Globe
                        className="h-4 w-4 shrink-0 text-phosphor-dim"
                        aria-hidden="true"
                      />
                      <span className="font-medium">Pub:</span>
                      <span className="break-words text-muted-foreground">
                        {steam.publishers.join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Download Links ──────────────────────────────────────── */}
        <div className="download-workspace"><aside className="activity-panel" aria-label="Server activity">
          <div className="section-heading"><h2>Server activity</h2><span className="font-mono tabular-nums">{Math.floor(progress)}%</span></div>
          <Progress value={progress} />
          <p role="status" className="request-status">{requestStatus}</p>
          <ul>
            {Object.entries(activity).map(([source, message]) => (
              <li
                key={source}
                className="grid-cols-[auto_1fr] [&:nth-last-child(2)]:opacity-85 [&:nth-last-child(3)]:opacity-70 [&:nth-last-child(4)]:opacity-55 [&:nth-last-child(n+5)]:opacity-40"
              >
                <span className="text-phosphor">{`$ ${source} →`}</span>
                <span className="text-muted-foreground">{message}</span>
              </li>
            ))}
          </ul>
        </aside><div className="download-results">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-secondary">
                <Download className="h-4 w-4 text-phosphor" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl leading-none">Download Links</h3>
                <p className="mt-1 text-xs text-muted-foreground">
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
              <Card className="p-6 md:p-8">
                <p className="mb-4 text-sm text-muted-foreground">
                  <span className="text-phosphor">$</span> Searching sources for
                  download links
                  <span
                    aria-hidden="true"
                    className="cursor-blink ml-1 text-phosphor"
                  >
                    █
                  </span>
                </p>
                <Progress value={progress} className="w-full max-w-md" />
              </Card>
            )}

          {/* Error after steam loaded */}
          {error && steam && (
            <Card className="border-destructive">
              <div className="border-b border-destructive bg-destructive/10 px-5 py-2.5">
                <p className="font-mono text-xs text-destructive">[ ERROR ]</p>
              </div>
              <div className="p-5">
                <p className="mb-1 text-sm font-medium text-destructive">
                  Couldn't load downloads
                </p>
                <p className="mb-4 text-xs text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </Card>
          )}

          {/* Empty */}
          {!error &&
            Object.keys(downloads).length === 0 &&
            progress === 100 && (
              <Card>
                <div className="border-b border-border bg-muted/50 px-5 py-2.5">
                  <p className="font-mono text-xs text-muted-foreground">
                    [ NO RESULTS ]
                  </p>
                </div>
                <div className="p-5 text-center md:p-8">
                  <p className="mb-1 font-medium">No Downloads Available</p>
                  <p className="mb-5 text-xs text-muted-foreground">
                    Couldn't find any download links for this game.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/">
                      <ArrowLeft className="h-4 w-4" />
                      Search for Another Game
                    </Link>
                  </Button>
                </div>
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
                      className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/40 md:p-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-secondary">
                          <Download className="h-4 w-4 text-phosphor" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-mono text-sm font-semibold capitalize">
                              {source}
                            </h4>
                            {title && (
                              <span className="text-xs text-muted-foreground">
                                ({title})
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {linkCount} link{linkCount !== 1 ? "s" : ""}
                            {isCollapsed ? " — collapsed" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                          !isCollapsed && "rotate-180",
                        )}
                      />
                    </button>

                    {/* Domain groups */}
                    {!isCollapsed && (
                      <div className="space-y-4 px-4 pb-4 md:px-5 md:pb-5">
                        {groups.map(({ domain, items }) => {
                          const isTrusted = matchesAny(domain, TRUSTED_MARKERS);
                          const isSlow = matchesAny(domain, SLOW_MARKERS);
                          const isProxied = matchesAny(domain, PROXY_MARKERS);

                          return (
                            <div key={domain}>
                              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                                <Globe className="h-3.5 w-3.5 shrink-0 text-phosphor-dim" />
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
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                                      className="download-row group flex items-center justify-between gap-2 p-3 transition-colors hover:bg-accent"
                                    >
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={handleLinkClick}
                                        className="flex min-w-0 flex-1 items-center gap-2.5"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-phosphor" />
                                        <div className="min-w-0">
                                          <p className="truncate text-sm transition-colors group-hover:text-phosphor">
                                            {label}
                                          </p>
                                          <p className="truncate text-xs text-muted-foreground">
                                            {domain}
                                          </p>
                                        </div>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => copyLink(url, uid)}
                                        className="shrink-0 p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                        aria-label="Copy link"
                                        title="Copy link"
                                      >
                                        {isCopied ? (
                                          <Check className="h-3.5 w-3.5 text-phosphor" />
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
