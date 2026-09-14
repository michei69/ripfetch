import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useParams, Link } from "react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-toastify";
import { SourceWarningModal, WARNINGS } from "../components/ui/source-warning";
import { GamePageSkeleton } from "../components/skeleton";
import { Progress } from "../components/ui/progress";
import { API_BASE_URL } from "../lib/config";
import { isJsonObject, parseEventData } from "../lib/sse";
import { isSafeExternalUrl } from "../lib/urls";
import {
  isSafeSteamImageUrl,
  steamHeaderUrl,
  steamHeroUrl,
} from "../lib/steam";
import { recordRecentGame } from "../lib/recentlyViewed";
import {
  domId,
  groupByHost,
  hostFlags,
  hostnameOf,
  parseSourceKey,
  SOURCE_COUNT,
  SOURCE_RANK,
} from "../lib/sources";

// ─── payload parsing ───────────────────────────────────────────────────────

type SteamInfo = {
  name: string;
  header_image: string;
  short_description: string;
  developers: string[];
  publishers: string[];
  genres: string[];
  is_free: boolean;
  price: string;
};

function parseSteamInfo(value: unknown): SteamInfo | null {
  if (!isJsonObject(value) || typeof value.name !== "string") return null;

  const genres = Array.isArray(value.genres)
    ? value.genres.flatMap((genre) =>
        isJsonObject(genre) && typeof genre.description === "string"
          ? [genre.description]
          : [],
      )
    : [];

  const price = isJsonObject(value.price_overview)
    ? typeof value.price_overview.final_formatted === "string"
      ? value.price_overview.final_formatted
      : typeof value.price_overview.initial_formatted === "string"
        ? value.price_overview.initial_formatted
        : ""
    : "";

  return {
    name: value.name,
    header_image:
      typeof value.header_image === "string" &&
      isSafeSteamImageUrl(value.header_image)
        ? value.header_image
        : "",
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
    is_free: value.is_free === true,
    price,
  };
}

function parseDownloads(
  value: unknown,
): Record<string, Record<string, string>> {
  if (!isJsonObject(value) || !isJsonObject(value.downloads)) return {};

  const downloads: Record<string, Record<string, string>> = Object.create(null);
  for (const [source, links] of Object.entries(value.downloads)) {
    if (!isJsonObject(links)) continue;

    const safe: Record<string, string> = Object.create(null);
    for (const [label, url] of Object.entries(links)) {
      if (isSafeExternalUrl(url)) safe[label] = url;
    }

    if (Object.keys(safe).length > 0) downloads[source] = safe;
  }

  return downloads;
}

// ─── page ──────────────────────────────────────────────────────────────────

/** Derives the next state for a set of collapsed keys. */
function toggled(key: string) {
  return (previous: Set<string>) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };
}

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
  const [requestStatus, setRequestStatus] = useState("Connecting");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  /** Collapsed source groups, keyed by group key. */
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(
    new Set(),
  );
  /** Collapsed host bands, keyed by their body element id. */
  const [collapsedHosts, setCollapsedHosts] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  /** Index into the banner art candidates; advances when one fails to load. */
  const [heroStep, setHeroStep] = useState(0);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingLink, setPendingLink] = useState<{
    url: string;
    domain: string;
    source: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;

    let active = true;
    const current = () => active;

    setLoading(true);
    setActivity({});
    setRequestStatus("Connecting");
    setError(null);
    setSteam(null);
    setDownloads({});
    setProgress(0);
    setFilter(null);
    setCollapsedSources(new Set());
    setCollapsedHosts(new Set());

    const stream = new EventSource(
      `${API_BASE_URL}/api/game/${encodeURIComponent(id)}/stream`,
    );

    stream.addEventListener("game", (event) => {
      if (!current()) return;
      const payload = parseEventData(event);
      const next = parseSteamInfo(isJsonObject(payload) ? payload.steam : null);
      if (!next) return;
      setSteam(next);
      setLoading(false);
    });

    stream.addEventListener("result", (event) => {
      if (!current()) return;
      const next = parseDownloads(parseEventData(event));
      setDownloads((previous) => ({ ...previous, ...next }));
    });

    stream.addEventListener("data", (event) => {
      if (!current()) return;
      setDownloads(parseDownloads(parseEventData(event)));
      setProgress(100);
      setRequestStatus("Complete");
      stream.close();
    });

    stream.addEventListener("search", (event) => {
      if (!current()) return;
      const data = parseEventData(event);
      if (
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
        [source]: "searching",
      }));
      setRequestStatus("Checking sources");
      setProgress(((data.sourceIdx - 1) / data.total) * 100);
    });

    stream.addEventListener("status", (event) => {
      if (!current()) return;
      const data = parseEventData(event);
      if (!isJsonObject(data) || typeof data.message !== "string") return;

      if (typeof data.source === "string") {
        const source = data.source;
        const message = data.message;
        setActivity((previous) => ({ ...previous, [source]: message }));
      } else {
        setRequestStatus(data.message);
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
      setError(
        isJsonObject(data) && typeof data.message === "string"
          ? data.message
          : "The sources did not answer.",
      );
      setLoading(false);
      setRequestStatus("Interrupted");
      stream.close();
    });

    stream.onerror = () => {
      if (!current() || stream.readyState === EventSource.CLOSED) return;
      stream.close();
      setRequestStatus("Interrupted");
      setLoading(false);
      setError("The connection dropped before every source answered.");
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

  useEffect(() => setHeroStep(0), [id]);

  useEffect(() => {
    const numericId = Number(id);
    if (!steam || !Number.isSafeInteger(numericId) || numericId <= 0) return;
    // Steam's API returns the real asset URL, which carries a per-app hash
    // segment; the synthesised path 404s for every app published since the
    // asset layout changed, so the API's copy wins whenever it is there.
    recordRecentGame({
      id: numericId,
      name: steam.name,
      cover: steam.header_image || steamHeaderUrl(numericId),
    });
  }, [steam, id]);

  const copyLink = async (url: string, uid: string) => {
    if (!isSafeExternalUrl(url)) {
      toast.error("Invalid download link");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(uid);
      toast.success("Copied");
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => {
        copyTimeout.current = null;
        setCopied(null);
      }, 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  /**
   * Gates an outgoing link behind its source warning. Both the release label
   * and the row's open button run this, so the two behave identically.
   */
  const openLink = (
    event: MouseEvent<HTMLAnchorElement>,
    url: string,
    domain: string,
    source: string,
  ) => {
    if (
      !WARNINGS[source] ||
      localStorage.getItem(`ripfetch_warning_dismissed_${source}`) === "true"
    ) {
      return;
    }
    event.preventDefault();
    setPendingLink({ url, domain, source });
  };

  /** Filtering to a source is a request to see it, so expand it. */
  const selectSource = (key: string | null) => {
    setFilter(key);
    if (!key) return;
    setCollapsedSources((previous) => {
      if (!previous.has(key)) return previous;
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
  };

  /** Sources that produced at least one link, keyed by display name. */
  const answered = useMemo(() => {
    const names = new Set<string>();
    for (const key of Object.keys(downloads)) {
      names.add(parseSourceKey(key).source.toLowerCase());
    }
    return names;
  }, [downloads]);

  const groups = useMemo(
    () =>
      Object.entries(downloads)
        .sort(([a], [b]) => {
          const rankA = SOURCE_RANK[parseSourceKey(a).source.toLowerCase()];
          const rankB = SOURCE_RANK[parseSourceKey(b).source.toLowerCase()];
          if (rankA === undefined && rankB === undefined)
            return a.localeCompare(b);
          if (rankA === undefined) return 1;
          if (rankB === undefined) return -1;
          return rankA - rankB;
        })
        .map(([key, links]) => ({
          key,
          ...parseSourceKey(key),
          hosts: groupByHost(links),
          count: Object.keys(links).length,
        })),
    [downloads],
  );

  const searched = Object.keys(activity);
  const streaming = !error && progress < 100;
  const linkCount = groups.reduce((total, group) => total + group.count, 0);
  const visible = filter
    ? groups.filter((group) => group.key === filter)
    : groups;

  const latest = Object.entries(activity).at(-1);
  const readout = error
    ? "interrupted"
    : progress >= 100
      ? "complete"
      : (latest?.[1] ?? requestStatus);

  const crumbs = (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link to="/" className="crumb-link">
        <ArrowLeft size={13} aria-hidden="true" />
        index
      </Link>
      <span className="crumb-sep">/</span>
      <span>{id ? `appid ${id}` : "game"}</span>
    </nav>
  );

  if (loading && !steam) {
    return (
      <section className="game-page">
        {crumbs}
        <GamePageSkeleton />
      </section>
    );
  }

  if (error && !steam) {
    return (
      <section className="game-page">
        {crumbs}
        <div className="notice" data-tone="danger" role="alert">
          <p className="notice-title">Couldn&apos;t load this game.</p>
          <p className="notice-body">{error}</p>
          <div className="notice-actions">
            <button
              type="button"
              className="btn"
              data-variant="solid"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Retry
            </button>
            <Link to="/" className="btn">
              Back to index
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!steam) return null;

  const steamUrl = `https://store.steampowered.com/app/${encodeURIComponent(id ?? "")}`;

  const facts: Array<{ term: string; value: ReactNode; mono?: boolean }> = [
    steam.publishers.length > 0 && {
      term: "Publisher",
      value: steam.publishers.join(", "),
    },
    (steam.is_free || steam.price) && {
      term: "Steam price",
      value: steam.is_free ? "free to play" : steam.price,
      mono: true,
    },
    {
      term: "Sources",
      value: `${answered.size} of ${SOURCE_COUNT} answering`,
      mono: true,
    },
    {
      term: "Store",
      value: (
        <a href={steamUrl} target="_blank" rel="noopener noreferrer">
          store.steampowered.com/app/{id}
        </a>
      ),
      mono: true,
    },
  ].filter(Boolean) as Array<{
    term: string;
    value: ReactNode;
    mono?: boolean;
  }>;

  // Banner art: the cinematic library hero when Steam has one, else the
  // always-present header capsule, else none at all.
  const heroCandidates = [
    id ? steamHeroUrl(id) : "",
    steam.header_image,
  ].filter((url) => url.length > 0);
  const heroArt = heroCandidates[heroStep];

  const meta = (
    <>
      {steam.developers.length > 0 && (
        <span>{steam.developers.join(", ")}</span>
      )}
      {steam.genres.length > 0 && (
        <>
          <span className="sep">/</span>
          <span>{steam.genres.join(", ")}</span>
        </>
      )}
      <span className="sep">/</span>
      <span>appid {id}</span>
    </>
  );

  return (
    <section className="game-page">
      {crumbs}

      <header className="hero">
        {heroArt ? (
          <div className="hero-banner">
            <img
              src={heroArt}
              alt=""
              onError={() => setHeroStep((step) => step + 1)}
            />
            <div className="hero-veil" aria-hidden="true" />
            <div className="hero-banner-body">
              <h1 className="hero-title">
                <a href={steamUrl} target="_blank" rel="noopener noreferrer">
                  {steam.name}
                </a>
              </h1>
              <p className="hero-meta">{meta}</p>
            </div>
          </div>
        ) : (
          <div className="hero-plain">
            <h1 className="hero-title">
              <a href={steamUrl} target="_blank" rel="noopener noreferrer">
                {steam.name}
              </a>
            </h1>
            <p className="hero-meta">{meta}</p>
          </div>
        )}

        {steam.short_description && (
          <p className="hero-desc">{steam.short_description}</p>
        )}

        <dl className="facts">
          {facts.map((fact) => (
            <div key={fact.term} className="fact">
              <dt className="fact-term">{fact.term}</dt>
              <dd
                className={
                  fact.mono ? "fact-value fact-value-mono" : "fact-value"
                }
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="mt-14" aria-labelledby="downloads-heading">
        <div className="sec-head">
          <h2 id="downloads-heading">Downloads</h2>
          <span className="sec-meta" role="status" aria-live="polite">
            {linkCount} link{linkCount === 1 ? "" : "s"} · {groups.length}{" "}
            source{groups.length === 1 ? "" : "s"}
          </span>
        </div>

        {(streaming || searched.length > 0) && (
          <div className="dl-status">
            {streaming && (
              <Progress
                value={progress}
                label={`Checking ${SOURCE_COUNT} sources`}
              />
            )}

            <p className="status-readout">
              <span className="label">status</span>
              <b>{readout}</b>
            </p>

            {searched.length > 0 && (
              <div className="state-grid">
                {searched.map((name) => {
                  const state = answered.has(name.toLowerCase())
                    ? "done"
                    : streaming
                      ? "active"
                      : "empty";
                  return (
                    <span key={name} className="state-chip" data-state={state}>
                      <span className="state-dot" aria-hidden="true" />
                      {name}
                    </span>
                  );
                })}
              </div>
            )}

            {searched.length > 0 && (
              <details className="disclosure">
                <summary>Source log</summary>
                <div className="log-list">
                  {Object.entries(activity).map(([name, message]) => (
                    <div key={name} className="log-row">
                      <span className="log-source">{name}</span>
                      <span>{message}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {error && (
          <div className="notice mt-6" data-tone="danger" role="alert">
            <p className="notice-title">Couldn&apos;t load downloads.</p>
            <p className="notice-body">{error}</p>
            <div className="notice-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Retry
              </button>
            </div>
          </div>
        )}

        {!error && groups.length === 0 && progress >= 100 && (
          <div className="notice mt-6" role="status">
            <p className="notice-title">No downloads found.</p>
            <p className="notice-body">
              Every source was checked and none of them list this game. It may
              be too new, or genuinely unavailable.
            </p>
            <div className="notice-actions">
              <Link to="/" className="btn">
                <ArrowLeft size={15} aria-hidden="true" />
                Search another game
              </Link>
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <>
            <div className="tabs" role="group" aria-label="Filter by source">
              <button
                type="button"
                className="tab"
                aria-pressed={filter === null}
                onClick={() => selectSource(null)}
              >
                All
                <span className="tab-count">{linkCount}</span>
              </button>
              {groups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className="tab"
                  aria-pressed={filter === group.key}
                  onClick={() =>
                    selectSource(filter === group.key ? null : group.key)
                  }
                >
                  {group.source}
                  <span className="tab-count">{group.count}</span>
                </button>
              ))}
            </div>

            <div className="dl-table">
              {visible.map((group) => {
                const sourceKey = group.source.toLowerCase();
                const headingId = domId("src-head", group.key);
                const bodyId = domId("src-body", group.key);
                const isCollapsed = collapsedSources.has(group.key);

                return (
                  <section
                    key={group.key}
                    className="dl-group"
                    aria-labelledby={headingId}
                  >
                    <h3 className="dl-group-head" id={headingId}>
                      <button
                        type="button"
                        className="dl-toggle"
                        aria-expanded={!isCollapsed}
                        aria-controls={bodyId}
                        onClick={() => setCollapsedSources(toggled(group.key))}
                      >
                        <ChevronDown
                          className="toggle-chevron"
                          size={15}
                          aria-hidden="true"
                        />
                        <span className="dl-group-name">{group.source}</span>
                        {group.title && (
                          <>
                            <span className="crumb-sep">/</span>
                            <span className="mono text-[12px] text-ink-mute">
                              {group.title}
                            </span>
                          </>
                        )}
                        <span className="dl-group-meta">
                          {group.count} link{group.count === 1 ? "" : "s"} ·{" "}
                          {group.hosts.length} host
                          {group.hosts.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    </h3>

                    <div id={bodyId} hidden={isCollapsed}>
                      {group.hosts.map((host) => {
                        const flags = hostFlags(host.host);
                        const tone = flags.slow
                          ? "slow"
                          : flags.trusted
                            ? "fast"
                            : flags.proxied
                              ? "proxied"
                              : undefined;
                        const hostBodyId = domId(
                          "host-body",
                          group.key,
                          host.host,
                        );
                        const hostCollapsed = collapsedHosts.has(hostBodyId);

                        return (
                          <div
                            className="host"
                            key={host.host}
                            data-tone={tone}
                          >
                            <h4 className="host-head">
                              <button
                                type="button"
                                className="host-toggle"
                                aria-expanded={!hostCollapsed}
                                aria-controls={hostBodyId}
                                onClick={() =>
                                  setCollapsedHosts(toggled(hostBodyId))
                                }
                              >
                                <ChevronDown
                                  className="toggle-chevron"
                                  size={14}
                                  aria-hidden="true"
                                />
                                <span className="host-name">{host.host}</span>
                                {flags.trusted && (
                                  <span className="tag" data-tone="fast">
                                    fast
                                  </span>
                                )}
                                {flags.slow && (
                                  <span className="tag" data-tone="slow">
                                    slow
                                  </span>
                                )}
                                {flags.proxied && (
                                  <span className="tag" data-tone="proxied">
                                    proxied
                                  </span>
                                )}
                                <span className="host-count">
                                  {host.releases.length} file
                                  {host.releases.length === 1 ? "" : "s"}
                                </span>
                              </button>
                            </h4>

                            <div id={hostBodyId} hidden={hostCollapsed}>
                              {/* Column labels only earn their row once a
                                  host actually lists more than one file. */}
                              {host.releases.length > 1 && (
                                <div
                                  className="link-head label"
                                  aria-hidden="true"
                                >
                                  <span>Release</span>
                                  <span>Resolves to</span>
                                  <span />
                                </div>
                              )}

                              <ul className="link-table">
                                {host.releases.map((release) => {
                                  const uid = `${group.key}::${release.label}`;
                                  const isCopied = copied === uid;
                                  const resolved = hostnameOf(release.url);

                                  return (
                                    <li key={uid} className="link-row">
                                      <a
                                        className="link-label"
                                        href={release.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Open ${release.label} on ${resolved}`}
                                        onClick={(event) =>
                                          openLink(
                                            event,
                                            release.url,
                                            resolved,
                                            sourceKey,
                                          )
                                        }
                                      >
                                        {release.label}
                                      </a>
                                      <p className="link-host">{resolved}</p>
                                      <div className="link-actions">
                                        <button
                                          type="button"
                                          className="btn"
                                          data-size="icon"
                                          data-variant="quiet"
                                          onClick={() =>
                                            copyLink(release.url, uid)
                                          }
                                          aria-label={`Copy ${release.label}`}
                                          title="Copy link"
                                        >
                                          {isCopied ? (
                                            <Check
                                              size={15}
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <Copy
                                              size={15}
                                              aria-hidden="true"
                                            />
                                          )}
                                        </button>
                                        <a
                                          className="btn"
                                          data-size="icon"
                                          data-variant="quiet"
                                          href={release.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          aria-label={`Open ${release.label} on ${resolved}`}
                                          title="Open link"
                                          onClick={(event) =>
                                            openLink(
                                              event,
                                              release.url,
                                              resolved,
                                              sourceKey,
                                            )
                                          }
                                        >
                                          <ExternalLink
                                            size={15}
                                            aria-hidden="true"
                                          />
                                        </a>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {streaming &&
                searched
                  .filter((name) => !answered.has(name.toLowerCase()))
                  .map((name) => (
                    <div key={name} className="pending-row">
                      <span className="state-dot" aria-hidden="true" />
                      {name}
                      <span className="ml-auto">
                        {activity[name] ?? "queued"}
                      </span>
                    </div>
                  ))}
            </div>
          </>
        )}
      </section>

      <SourceWarningModal
        open={pendingLink !== null}
        source={pendingLink?.source ?? ""}
        domain={pendingLink?.domain ?? ""}
        onConfirm={() => {
          if (pendingLink && isSafeExternalUrl(pendingLink.url)) {
            window.open(pendingLink.url, "_blank", "noopener noreferrer");
          }
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
