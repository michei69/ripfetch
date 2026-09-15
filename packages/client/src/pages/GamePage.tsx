import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  untrack,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { createStore } from "solid-js";
import { useParams } from "@solidjs/router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
} from "../components/icons";
import { toast } from "../lib/toast";
import { SourceWarningModal, WARNINGS } from "../components/ui/source-warning";
import { GamePageSkeleton } from "../components/skeleton";
import { Progress } from "../components/ui/progress";
import { Notice } from "../components/ui/notice";
import { API_BASE_URL } from "../lib/config";
import { copyToClipboard } from "../lib/clipboard";
import { isJsonObject, parseEventData } from "../lib/sse";
import { isSafeExternalUrl } from "../lib/urls";
import {
  isSafeSteamImageUrl,
  steamHeaderUrl,
  steamHeroUrl,
} from "../lib/steam";
import { recordRecentGame } from "../lib/recentlyViewed";
import { plural } from "../lib/utils";
import {
  domId,
  groupByHost,
  type HostGroup,
  hostFlags,
  hostnameOf,
  parseSourceKey,
  type Release,
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

type Downloads = Record<string, Record<string, string>>;

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

function parseDownloads(value: unknown): Downloads {
  if (!isJsonObject(value) || !isJsonObject(value.downloads)) return {};

  const downloads: Downloads = {};
  for (const [source, links] of Object.entries(value.downloads)) {
    if (!isJsonObject(links)) continue;

    const safe: Record<string, string> = {};
    for (const [label, url] of Object.entries(links)) {
      if (isSafeExternalUrl(url)) safe[label] = url;
    }

    if (Object.keys(safe).length > 0) downloads[source] = safe;
  }

  return downloads;
}

// ─── link gates ────────────────────────────────────────────────────────────

const warnedKey = (source: string) => `ripfetch_warning_dismissed_${source}`;

function warningDismissed(source: string): boolean {
  try {
    return localStorage.getItem(warnedKey(source)) === "true";
  } catch {
    return false;
  }
}

// ─── page ──────────────────────────────────────────────────────────────────

type SourceGroup = {
  key: string;
  source: string;
  title: string | null;
  hosts: HostGroup[];
  count: number;
};

type PendingLink = { url: string; domain: string; source: string };

type Fact = {
  term: string;
  value?: JSX.Element;
  mono?: boolean;
};

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const id = () => params.id;

  const [downloads, setDownloads] = createStore<Downloads>({});
  const [steam, setSteam] = createSignal<SteamInfo | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal(0);
  const [activity, setActivity] = createStore<Record<string, string>>({});
  const [requestStatus, setRequestStatus] = createSignal("Connecting");
  const [attempt, setAttempt] = createSignal(0);
  const [filter, setFilter] = createSignal<string | null>(null);
  /** Collapsed source and host rows, keyed by group key / body element id. */
  const [collapsedSources, setCollapsedSources] = createStore<string[]>([]);
  const [collapsedHosts, setCollapsedHosts] = createStore<string[]>([]);
  const [copied, setCopied] = createSignal<string | null>(null);
  /** Index into the banner art candidates; advances when one fails to load. */
  const [heroStep, setHeroStep] = createSignal(0);
  const [pendingLink, setPendingLink] = createSignal<PendingLink | null>(null);

  const numericId = () => Number(id());

  createEffect(
    () => [id(), attempt()] as const,
    ([current]) => {
      if (!current) return;

      setLoading(true);
      setSteam(null);
      setProgress(0);
      setFilter(null);
      setError(null);
      setRequestStatus("Connecting");
      setHeroStep(0);
      setActivity((state) => {
        for (const key of Object.keys(state)) delete state[key];
      });
      setDownloads((state) => {
        for (const key of Object.keys(state)) delete state[key];
      });
      setCollapsedSources((list) => list.splice(0));
      setCollapsedHosts((list) => list.splice(0));

      const stream = new EventSource(
        `${API_BASE_URL}/api/game/${encodeURIComponent(current)}/stream`,
      );

      stream.addEventListener("game", (event) => {
        const payload = parseEventData(event);
        const next = parseSteamInfo(
          isJsonObject(payload) ? payload.steam : null,
        );
        if (!next) return;
        setSteam(next);
        setLoading(false);
      });

      stream.addEventListener("result", (event) => {
        const next = parseDownloads(parseEventData(event));
        // Merged source by source so untouched sources keep identity.
        setDownloads((state) => {
          for (const [source, links] of Object.entries(next)) {
            state[source] = links;
          }
        });
      });

      stream.addEventListener("data", (event) => {
        const next = parseDownloads(parseEventData(event));
        setDownloads((state) => {
          // The apply phase is untracked on purpose: the store is read
          // once, only to learn which keys to clear.
          for (const key of untrack(() => Object.keys(state))) {
            delete state[key];
          }
          for (const [source, links] of Object.entries(next)) {
            state[source] = links;
          }
        });
        setProgress(100);
        setRequestStatus("Complete");
        stream.close();
      });

      stream.addEventListener("search", (event) => {
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
        setActivity((state) => {
          state[data.source as string] = "searching";
        });
        setRequestStatus("Checking sources");
        setProgress(((data.sourceIdx - 1) / data.total) * 100);
      });

      stream.addEventListener("status", (event) => {
        const data = parseEventData(event);
        if (!isJsonObject(data) || typeof data.message !== "string") return;

        if (typeof data.source === "string") {
          const source = data.source;
          const message = data.message;
          setActivity((state) => {
            state[source] = message;
          });
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
        if (stream.readyState === EventSource.CLOSED) return;
        stream.close();
        setRequestStatus("Interrupted");
        setLoading(false);
        setError("The connection dropped before every source answered.");
      };

      return () => stream.close();
    },
  );

  createEffect(
    () => copied(),
    (uid) => {
      if (!uid) return;
      const timer = setTimeout(() => setCopied(null), 2000);
      return () => clearTimeout(timer);
    },
  );

  createEffect(
    () => steam(),
    (info) => {
      // The app id is not a reason to re-record; only new steam data is.
      const appId = untrack(numericId);
      if (!info || !Number.isSafeInteger(appId) || appId <= 0) return;
      // Steam's API returns the real asset URL, which carries a per-app
      // hash segment; the synthesised path 404s for every app published
      // since the asset layout changed, so the API's copy wins.
      recordRecentGame({
        id: appId,
        name: info.name,
        cover: info.header_image || steamHeaderUrl(appId),
      });
    },
  );

  const copyLink = async (url: string, uid: string) => {
    if (!isSafeExternalUrl(url)) {
      toast.error("Invalid download link");
      return;
    }

    if (await copyToClipboard(url)) {
      setCopied(uid);
      toast.success("Copied");
    } else {
      toast.error("Failed to copy link");
    }
  };

  /**
   * Gates an outgoing link behind its source warning. Both the release label
   * and the row's open button run this, so the two behave identically.
   */
  const openLink = (
    event: MouseEvent,
    url: string,
    domain: string,
    source: string,
  ) => {
    if (!WARNINGS[source] || warningDismissed(source)) return;
    event.preventDefault();
    setPendingLink({ url, domain, source });
  };

  /** Filtering to a source is a request to see it, so expand it. */
  const selectSource = (key: string | null) => {
    setFilter(key);
    if (!key) return;
    const index = collapsedSources.indexOf(key);
    if (index !== -1) setCollapsedSources((list) => list.splice(index, 1));
  };

  const toggle = (list: string[], key: string) => {
    const index = list.indexOf(key);
    if (index === -1) list.push(key);
    else list.splice(index, 1);
  };

  /** Sources that produced at least one link, keyed by display name. */
  const answered = createMemo(() => {
    const names = new Set<string>();
    for (const key of Object.keys(downloads)) {
      names.add(parseSourceKey(key).source.toLowerCase());
    }
    return names;
  });

  const groups = createMemo<SourceGroup[]>(() =>
    Object.entries(downloads)
      .map(([key, links]) => {
        const { source, title } = parseSourceKey(key);
        return {
          key,
          source,
          title,
          hosts: groupByHost(links),
          count: Object.keys(links).length,
          rank: SOURCE_RANK[source.toLowerCase()],
        };
      })
      .sort((a, b) => {
        if (a.rank === undefined && b.rank === undefined)
          return a.key.localeCompare(b.key);
        if (a.rank === undefined) return 1;
        if (b.rank === undefined) return -1;
        return a.rank - b.rank;
      }),
  );

  const searched = createMemo(() => Object.keys(activity));
  const streaming = () => !error() && progress() < 100;
  const linkCount = createMemo(() =>
    groups().reduce((total, group) => total + group.count, 0),
  );
  const visible = createMemo(() => {
    const active = filter();
    return active ? groups().filter((group) => group.key === active) : groups();
  });
  const readout = () => {
    if (error()) return "interrupted";
    if (progress() >= 100) return "complete";
    const latest = Object.entries(activity).at(-1);
    return latest?.[1] ?? requestStatus();
  };

  const steamUrl = () =>
    `https://store.steampowered.com/app/${encodeURIComponent(id() ?? "")}`;

  // Banner art: the cinematic library hero when Steam has one, else the
  // always-present header capsule, else none at all.
  const heroArt = createMemo(() => {
    const info = steam();
    if (!info) return "";
    const candidates = [
      id() ? steamHeroUrl(id()) : "",
      info.header_image,
    ].filter((url) => url.length > 0);
    return candidates[heroStep()] ?? "";
  });

  const meta = () => {
    const info = steam();
    if (!info) return null;
    const parts: JSX.Element[] = [];
    if (info.developers.length > 0) {
      parts.push(<span>{info.developers.join(", ")}</span>);
    }
    if (info.genres.length > 0) {
      parts.push(
        <span class="sep">/</span>,
        <span>{info.genres.join(", ")}</span>,
      );
    }
    parts.push(<span class="sep">/</span>, <span>appid {id()}</span>);
    return parts;
  };

  /**
   * Fact rows. Only the two slots whose absence depends on the payload are
   * optional, so the JSX can hide them without rebuilding the list.
   */
  const facts = () => {
    const info = steam();
    if (!info) return [];
    return [
      {
        term: "Publisher",
        value:
          info.publishers.length > 0 ? info.publishers.join(", ") : undefined,
      },
      {
        term: "Steam price",
        value: info.is_free ? "free to play" : info.price || undefined,
        mono: true,
      },
      {
        term: "Sources",
        value: `${answered().size} of ${SOURCE_COUNT} answering`,
        mono: true,
      },
      {
        term: "Store",
        value: (
          <a href={steamUrl()} target="_blank" rel="noopener noreferrer">
            store.steampowered.com/app/{id()}
          </a>
        ),
        mono: true,
      },
    ] satisfies Fact[];
  };

  return (
    <Show
      when={steam()}
      fallback={
        <Fallback
          loading={loading()}
          error={error()}
          id={id()}
          retry={() => setAttempt((value) => value + 1)}
        />
      }
    >
      {(info) => (
        <section class="game-page">
          <Crumbs id={id()} />

          <header class="hero">
            <Show
              when={heroArt()}
              fallback={
                <div class="hero-plain">
                  <h1 class="hero-title">
                    <a
                      href={steamUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {info().name}
                    </a>
                  </h1>
                  <p class="hero-meta">{meta()}</p>
                </div>
              }
            >
              <div class="hero-banner">
                <img
                  src={heroArt()}
                  alt=""
                  onError={() => setHeroStep((step) => step + 1)}
                />
                <div class="hero-veil" aria-hidden="true" />
                <div class="hero-banner-body">
                  <h1 class="hero-title">
                    <a
                      href={steamUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {info().name}
                    </a>
                  </h1>
                  <p class="hero-meta">{meta()}</p>
                </div>
              </div>
            </Show>

            <Show when={info().short_description}>
              <p class="hero-desc">{info().short_description}</p>
            </Show>

            <dl class="facts">
              <For each={facts()}>
                {(fact) => (
                  <Show when={fact.value !== undefined}>
                    <div class="fact">
                      <dt class="fact-term">{fact.term}</dt>
                      <dd
                        class={
                          fact.mono
                            ? "fact-value fact-value-mono"
                            : "fact-value"
                        }
                      >
                        {fact.value}
                      </dd>
                    </div>
                  </Show>
                )}
              </For>
            </dl>
          </header>

          <section class="mt-14" aria-labelledby="downloads-heading">
            <div class="sec-head">
              <h2 id="downloads-heading">Downloads</h2>
              <span class="sec-meta" role="status" aria-live="polite">
                {plural(linkCount(), "link")} ·{" "}
                {plural(groups().length, "source")}
              </span>
            </div>

            <Show when={streaming() || searched().length > 0}>
              <div class="dl-status">
                <Show when={streaming()}>
                  <Progress
                    value={progress()}
                    label={`Checking ${SOURCE_COUNT} sources`}
                  />
                </Show>

                <p class="status-readout">
                  <span class="label">status</span>
                  <b>{readout()}</b>
                </p>

                <Show when={searched().length > 0}>
                  <div class="state-grid">
                    <For each={searched()}>
                      {(name) => (
                        <span
                          class="state-chip"
                          data-state={
                            answered().has(name.toLowerCase())
                              ? "done"
                              : streaming()
                                ? "active"
                                : "empty"
                          }
                        >
                          <span class="state-dot" aria-hidden="true" />
                          {name}
                        </span>
                      )}
                    </For>
                  </div>

                  <details class="disclosure">
                    <summary>Source log</summary>
                    <div class="log-list">
                      <For each={Object.entries(activity)}>
                        {([name, message]) => (
                          <div class="log-row">
                            <span class="log-source">{name}</span>
                            <span>{message}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </details>
                </Show>
              </div>
            </Show>

            <Show when={error()}>
              <Notice
                class="mt-6"
                role="alert"
                tone="danger"
                title="Couldn't load downloads."
                action={
                  <button
                    type="button"
                    class="btn"
                    data-variant="solid"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    <RefreshCw size={15} />
                    Retry
                  </button>
                }
              >
                {error()}
              </Notice>
            </Show>

            <Show when={!error() && groups().length === 0 && progress() >= 100}>
              <Notice
                class="mt-6"
                title="No downloads found."
                action={
                  <a href="/" class="btn">
                    <ArrowLeft size={15} />
                    Search another game
                  </a>
                }
              >
                Every source was checked and none of them list this game. It may
                be too new, or genuinely unavailable.
              </Notice>
            </Show>

            <Show when={groups().length > 0}>
              <div class="tabs" role="group" aria-label="Filter by source">
                <button
                  type="button"
                  class="tab"
                  aria-pressed={filter() === null ? "true" : "false"}
                  onClick={() => selectSource(null)}
                >
                  All
                  <span class="tab-count">{linkCount()}</span>
                </button>
                <For each={groups()}>
                  {(group) => (
                    <button
                      type="button"
                      class="tab"
                      aria-pressed={filter() === group.key ? "true" : "false"}
                      onClick={() =>
                        selectSource(filter() === group.key ? null : group.key)
                      }
                    >
                      {group.source}
                      <span class="tab-count">{group.count}</span>
                    </button>
                  )}
                </For>
              </div>

              <div class="dl-table">
                <For each={visible()}>
                  {(group) => (
                    <SourceSection
                      group={group}
                      collapsedSources={collapsedSources}
                      toggleSource={(key) =>
                        setCollapsedSources((list) => toggle(list, key))
                      }
                      collapsedHosts={collapsedHosts}
                      toggleHost={(key) =>
                        setCollapsedHosts((list) => toggle(list, key))
                      }
                      copied={copied}
                      onCopy={copyLink}
                      onOpen={openLink}
                    />
                  )}
                </For>

                <Show when={streaming()}>
                  <For
                    each={searched().filter(
                      (name) => !answered().has(name.toLowerCase()),
                    )}
                  >
                    {(name) => (
                      <div class="pending-row">
                        <span class="state-dot" aria-hidden="true" />
                        {name}
                        <span class="ml-auto">
                          {activity[name] ?? "queued"}
                        </span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </Show>
          </section>

          <SourceWarningModal
            open={pendingLink() !== null}
            source={pendingLink()?.source ?? ""}
            domain={pendingLink()?.domain ?? ""}
            onConfirm={() => {
              const link = pendingLink();
              if (link && isSafeExternalUrl(link.url)) {
                window.open(link.url, "_blank", "noopener noreferrer");
              }
              setPendingLink(null);
            }}
            onDismiss={() => setPendingLink(null)}
            onDismissPermanently={() => {
              const link = pendingLink();
              if (link) {
                try {
                  localStorage.setItem(warnedKey(link.source), "true");
                } catch {
                  // A warning that cannot be remembered is
                  // still worth showing once.
                }
                if (isSafeExternalUrl(link.url)) {
                  window.open(link.url, "_blank", "noopener noreferrer");
                }
              }
              setPendingLink(null);
            }}
          />
        </section>
      )}
    </Show>
  );
}

function Crumbs(props: { id?: string }) {
  return (
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/" class="crumb-link">
        <ArrowLeft size={13} />
        index
      </a>
      <span class="crumb-sep">/</span>
      <span>{props.id ? `appid ${props.id}` : "game"}</span>
    </nav>
  );
}

/** The skeleton or the error card, depending on how far the stream got. */
function Fallback(props: {
  loading: boolean;
  error: string | null;
  id?: string;
  retry: () => void;
}) {
  // The error only displaces the skeleton once the request has given up;
  // while it is still connecting there is nothing to report.
  const failed = () => (props.loading ? null : props.error);

  return (
    <section class="game-page">
      <Crumbs id={props.id} />
      <Show when={failed()} fallback={<GamePageSkeleton />}>
        {(message) => (
          <Notice
            role="alert"
            tone="danger"
            title="Couldn't load this game."
            action={
              <>
                <button
                  type="button"
                  class="btn"
                  data-variant="solid"
                  onClick={props.retry}
                >
                  <RefreshCw size={15} />
                  Retry
                </button>
                <a href="/" class="btn">
                  Back to index
                </a>
              </>
            }
          >
            {message()}
          </Notice>
        )}
      </Show>
    </section>
  );
}

type SourceSectionProps = {
  group: SourceGroup;
  collapsedSources: string[];
  toggleSource: (key: string) => void;
  collapsedHosts: string[];
  toggleHost: (key: string) => void;
  copied: () => string | null;
  onCopy: (url: string, uid: string) => void;
  onOpen: (
    event: MouseEvent,
    url: string,
    domain: string,
    source: string,
  ) => void;
};

function SourceSection(props: SourceSectionProps) {
  const headingId = domId("src-head", props.group.key);
  const bodyId = domId("src-body", props.group.key);
  const sourceKey = props.group.source.toLowerCase();
  const isCollapsed = () => props.collapsedSources.includes(props.group.key);

  return (
    <section class="dl-group" aria-labelledby={headingId}>
      <h3 class="dl-group-head" id={headingId}>
        <button
          type="button"
          class="dl-toggle"
          aria-expanded={!isCollapsed() ? "true" : "false"}
          aria-controls={bodyId}
          onClick={() => props.toggleSource(props.group.key)}
        >
          <ChevronDown class="toggle-chevron" size={15} />
          <span class="dl-group-name">{props.group.source}</span>
          <Show when={props.group.title}>
            {(title) => (
              <>
                <span class="crumb-sep">/</span>
                <span class="mono text-[12px] text-ink-mute">{title()}</span>
              </>
            )}
          </Show>
          <span class="dl-group-meta">
            {plural(props.group.count, "link")} ·{" "}
            {plural(props.group.hosts.length, "host")}
          </span>
        </button>
      </h3>

      <div id={bodyId} hidden={isCollapsed()}>
        <For each={props.group.hosts}>
          {(host) => (
            <HostSection
              host={host}
              groupKey={props.group.key}
              sourceKey={sourceKey}
              collapsedHosts={props.collapsedHosts}
              toggleHost={props.toggleHost}
              copied={props.copied}
              onCopy={props.onCopy}
              onOpen={props.onOpen}
            />
          )}
        </For>
      </div>
    </section>
  );
}

type HostSectionProps = {
  host: HostGroup;
  groupKey: string;
  sourceKey: string;
  collapsedHosts: string[];
  toggleHost: (key: string) => void;
  copied: () => string | null;
  onCopy: (url: string, uid: string) => void;
  onOpen: (
    event: MouseEvent,
    url: string,
    domain: string,
    source: string,
  ) => void;
};

function HostSection(props: HostSectionProps) {
  const bodyId = domId("host-body", props.groupKey, props.host.host);
  const flags = hostFlags(props.host.host);
  const collapsed = () => props.collapsedHosts.includes(bodyId);

  return (
    <div
      class="host"
      data-tone={
        flags.slow
          ? "slow"
          : flags.trusted
            ? "fast"
            : flags.proxied
              ? "proxied"
              : undefined
      }
    >
      <h4 class="host-head">
        <button
          type="button"
          class="host-toggle"
          aria-expanded={!collapsed() ? "true" : "false"}
          aria-controls={bodyId}
          onClick={() => props.toggleHost(bodyId)}
        >
          <ChevronDown class="toggle-chevron" size={14} />
          <span class="host-name">{props.host.host}</span>
          <Show when={flags.trusted}>
            <span class="tag" data-tone="fast">
              fast
            </span>
          </Show>
          <Show when={flags.slow}>
            <span class="tag" data-tone="slow">
              slow
            </span>
          </Show>
          <Show when={flags.proxied}>
            <span class="tag" data-tone="proxied">
              proxied
            </span>
          </Show>
          <span class="host-count">
            {plural(props.host.releases.length, "file")}
          </span>
        </button>
      </h4>

      <div id={bodyId} hidden={collapsed()}>
        {/* Column labels only earn their row once a host actually
                    lists more than one file. */}
        <Show when={props.host.releases.length > 1}>
          <div class="link-head label" aria-hidden="true">
            <span>Release</span>
            <span>Resolves to</span>
            <span />
          </div>
        </Show>

        <ul class="link-table">
          <For each={props.host.releases}>
            {(release: Release) => (
              <LinkRow
                release={release}
                uid={`${props.groupKey}::${release.label}`}
                sourceKey={props.sourceKey}
                copied={props.copied}
                onCopy={props.onCopy}
                onOpen={props.onOpen}
              />
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}

type LinkRowProps = {
  release: Release;
  uid: string;
  sourceKey: string;
  copied: () => string | null;
  onCopy: (url: string, uid: string) => void;
  onOpen: (
    event: MouseEvent,
    url: string,
    domain: string,
    source: string,
  ) => void;
};

function LinkRow(props: LinkRowProps) {
  const resolved = hostnameOf(props.release.url);

  return (
    <li class="link-row">
      <a
        class="link-label"
        href={props.release.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${props.release.label} on ${resolved}`}
        onClick={(event) =>
          props.onOpen(event, props.release.url, resolved, props.sourceKey)
        }
      >
        {props.release.label}
      </a>
      <p class="link-host">{resolved}</p>
      <div class="link-actions">
        <button
          type="button"
          class="btn"
          data-size="icon"
          data-variant="quiet"
          onClick={() => props.onCopy(props.release.url, props.uid)}
          aria-label={`Copy ${props.release.label}`}
          title="Copy link"
        >
          <Show
            when={props.copied() === props.uid}
            fallback={<Copy size={15} />}
          >
            <Check size={15} />
          </Show>
        </button>
        <a
          class="btn"
          data-size="icon"
          data-variant="quiet"
          href={props.release.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${props.release.label} on ${resolved}`}
          title="Open link"
          onClick={(event) =>
            props.onOpen(event, props.release.url, resolved, props.sourceKey)
          }
        >
          <ExternalLink size={15} />
        </a>
      </div>
    </li>
  );
}
