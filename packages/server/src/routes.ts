import Elysia, { t } from "elysia";
import Steam from "./api/game-stuff/Steam";
import Game3rb from "./api/game-stuff/game3rb";
import Igg from "./api/game-stuff/igg";
import Onlinefix from "./api/game-stuff/onlinefix";
import Steamrip from "./api/game-stuff/steamrip";
import Steamunlocked from "./api/game-stuff/steamunlocked";
import Uploadhaven from "./api/game-stuff/Uploadhaven";
import OvaGames from "./api/game-stuff/ovagames";
import GOGto from "./api/game-stuff/gogto";
import GLoad from "./api/game-stuff/gload";
import Dodi from "./api/game-stuff/dodi";
import FitGirl from "./api/game-stuff/fitgirl";
import {
    type DownloadsResult,
    type IGameSource,
    type SteamInfo,
    type SteamSearchResult,
} from "./api/game-stuff/commonData";
import {
    isSafeExternalUrl,
    safeFetch,
} from "./api/game-stuff/NetworkRequest";
import {
    getCache,
    setCache,
} from "./cache";
import { requestProgress } from "./requestProgress";
import { rateLimitRequest } from "./rateLimit";
import { ConcurrencyLimiter } from "./util";
import { streamResponse } from "./stream";

type GameResponse = {
    steam: SteamInfo | null;
};

type DownloadMap = Record<string, Record<string, string>>;

type SourceResult = {
    sourceName: string;
    links: Record<string, string>;
};

type DownloadLookup = {
    downloads: DownloadMap;
    failed: boolean;
};

const gameSources: IGameSource[] = [
    new Game3rb(),
    new Igg(),
    new Onlinefix(),
    new Steamrip(),
    new Steamunlocked(),
    new OvaGames(),
    new GOGto(),
    new GLoad(),
    new Dodi(),
    new FitGirl(),
];

const sourceLimiter = new ConcurrencyLimiter(3, 100);
const pendingSearches = new Map<string, Promise<SteamSearchResult>>();
const pendingDownloads = new Map<string, Promise<DownloadLookup>>();
const MAX_DOWNLOAD_LINKS = 500;

const appIdParams = t.Object({
    id: t.String({
        description: "Steam app id",
        maxLength: 12,
        pattern: "^[1-9][0-9]{0,11}$",
    }),
});

const uploadhavenParams = t.Object({
    id: t.String({
        description: "Uploadhaven download id (hex)",
        maxLength: 64,
        pattern: "^[0-9a-fA-F]{1,64}$",
    }),
});

function normalizeQuery(query: string): string {
    return query.trim().replace(/\s+/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsableGameResponse(value: unknown): value is GameResponse {
    if (!isRecord(value)) return false;
    if (value.steam === null) return true;
    return (
        isRecord(value.steam) &&
        typeof value.steam.name === "string" &&
        value.steam.name.length > 0 &&
        value.steam.name.length <= 500
    );
}

function sanitizeDownloadMap(value: unknown): DownloadMap {
    const downloads: DownloadMap = Object.create(null);
    if (!isRecord(value)) return downloads;
    let linkCount = 0;

    for (const [source, links] of Object.entries(value)) {
        if (!isRecord(links)) continue;
        const safeLinks: Record<string, string> = Object.create(null);

        for (const [label, url] of Object.entries(links)) {
            if (isSafeExternalUrl(url)) {
                safeLinks[label] = url;
                linkCount++;
                if (linkCount >= MAX_DOWNLOAD_LINKS * gameSources.length) {
                    break;
                }
            }
        }

        if (Object.keys(safeLinks).length > 0) {
            downloads[source] = safeLinks;
        }
        if (linkCount >= MAX_DOWNLOAD_LINKS * gameSources.length) break;
    }

    return downloads;
}

function flattenDownloads(groups: DownloadsResult): Record<string, string> {
    const links: Record<string, string> = Object.create(null);
    let linkCount = 0;

    for (const [host, items] of Object.entries(groups)) {
        if (host.length > 200 || !isRecord(items)) continue;
        for (const [name, url] of Object.entries(items)) {
            if (name.length > 500) continue;
            if (!isSafeExternalUrl(url)) continue;
            links[`${host} - ${name}`] = url;
            linkCount++;
            if (linkCount >= MAX_DOWNLOAD_LINKS) return links;
        }
    }

    return links;
}

async function saveCacheSafely(
    key: string,
    value: unknown,
    ttlMs?: number,
): Promise<void> {
    try {
        await setCache(key, value, ttlMs);
    } catch (error) {
        console.error(`Could not cache ${key}:`, error);
    }
}

async function getGame(appId: string): Promise<GameResponse> {
    const cacheKey = `game:${appId}`;
    const cached = await getCache<unknown>(cacheKey);
    if (isUsableGameResponse(cached)) {
        return cached;
    }

    const steam = await Steam.getInfo(appId);
    const response: GameResponse = isUsableGameResponse({ steam })
        ? { steam }
        : { steam: null };
    if (response.steam) await saveCacheSafely(cacheKey, response);
    return response;
}

async function getSearchResults(query: string): Promise<SteamSearchResult> {
    const normalizedQuery = normalizeQuery(query);
    const cacheKey = `search:${normalizedQuery.toLowerCase()}`;
    const cached = await getCache<SteamSearchResult>(cacheKey);
    if (Array.isArray(cached)) return cached;

    const pending = pendingSearches.get(cacheKey);
    if (pending) return pending;

    const search = (async () => {
        try {
            return await Steam.search(normalizedQuery);
        } catch (error) {
            console.error("Search failed, refreshing Algolia key:", error);
            await Steam.refreshAlgoliaDebounce(true);
            return await Steam.search(normalizedQuery);
        }
    })();
    pendingSearches.set(cacheKey, search);

    try {
        const results = await search;
        await saveCacheSafely(cacheKey, results);
        return results;
    } finally {
        pendingSearches.delete(cacheKey);
    }
}

async function collectSource(
    source: IGameSource,
    gameName: string,
    signal: AbortSignal,
    report: (message: string) => void,
): Promise<SourceResult | null> {
    if (signal.aborted) return null;

    report("Searching for matching game");
    const result = await source.getClosestTo(gameName);
    if (!result) {
        report("No matching game returned");
        return null;
    }

    report(`Fetching download links for ${result.title}`);
    const links = flattenDownloads(await source.getDownloads(result.url));
    const linkCount = Object.keys(links).length;
    report(linkCount ? `${linkCount} links received` : "No links returned");

    if (!linkCount) return null;
    const title = result.title.trim().slice(0, 300);
    return {
        links,
        sourceName: `${source.displayName} (${title})`,
    };
}

async function runSource(
    source: IGameSource,
    gameName: string,
    signal: AbortSignal,
    report: (message: string) => void,
): Promise<{ failed: boolean; result: SourceResult | null }> {
    try {
        const result = await sourceLimiter.run(signal, () =>
            requestProgress.run(
                { report, signal },
                () => collectSource(source, gameName, signal, report),
            ),
        );
        return { failed: false, result };
    } catch (error) {
        if (signal.aborted) return { failed: false, result: null };

        console.error(`Source failed: ${source.displayName}`, error);
        report("Source failed; continuing with remaining sources");
        return { failed: true, result: null };
    }
}

async function getDownloadsForGame(gameName: string): Promise<DownloadLookup> {
    const key = normalizeQuery(gameName).toLowerCase();
    const pending = pendingDownloads.get(key);
    if (pending) return pending;

    const lookup = (async (): Promise<DownloadLookup> => {
        const signal = AbortSignal.timeout(5 * 60 * 1000);
        const downloads: DownloadMap = Object.create(null);
        let failed = false;

        await Promise.all(
            gameSources.map(async (source) => {
                const report = () => {};
                const outcome = await runSource(
                    source,
                    gameName,
                    signal,
                    report,
                );
                if (outcome.result) {
                    downloads[outcome.result.sourceName] = outcome.result.links;
                }
                if (outcome.failed) failed = true;
            }),
        );

        return { downloads, failed };
    })();
    pendingDownloads.set(key, lookup);

    try {
        return await lookup;
    } finally {
        pendingDownloads.delete(key);
    }
}

async function streamDownloads(
    gameName: string,
    emit: (event: { event: string; data: unknown }) => void,
    signal: AbortSignal,
): Promise<{ downloads: DownloadMap; failed: boolean }> {
    const downloads: DownloadMap = Object.create(null);
    let completed = 0;
    let nextSource = 0;
    let failed = false;

    const worker = async () => {
        while (!signal.aborted) {
            const sourceIndex = nextSource++;
            const source = gameSources[sourceIndex];
            if (!source) return;

            const report = (message: string) => {
                emit({
                    data: {
                        completed,
                        message,
                        source: source.displayName,
                        total: gameSources.length,
                    },
                    event: "status",
                });
            };

            emit({
                data: {
                    source: source.displayName,
                    sourceIdx: sourceIndex + 1,
                    total: gameSources.length,
                },
                event: "search",
            });

            const outcome = await runSource(
                source,
                gameName,
                signal,
                report,
            );
            if (outcome.result) {
                downloads[outcome.result.sourceName] = outcome.result.links;
                emit({
                    data: {
                        downloads: {
                            [outcome.result.sourceName]: outcome.result.links,
                        },
                    },
                    event: "result",
                });
            }
            if (outcome.failed) failed = true;
            completed++;
        }
    };

    await Promise.all(
        Array.from(
            { length: Math.min(3, gameSources.length) },
            () => worker(),
        ),
    );

    return { downloads, failed };
}

async function runGameStream(
    appId: string,
    emit: (event: { event: string; data: unknown }) => void,
    signal: AbortSignal,
): Promise<void> {
    emit({ data: { message: "Checking game cache" }, event: "status" });
    const game = await getGame(appId);
    if (signal.aborted) return;

    if (!game.steam) {
        emit({
            data: { message: "Game not found on Steam" },
            event: "failure",
        });
        return;
    }

    emit({ data: game, event: "game" });

    const cacheKey = `links:${appId}`;
    emit({ data: { message: "Checking download cache" }, event: "status" });
    const cached = await getCache<unknown>(cacheKey);
    if (isRecord(cached) && isRecord(cached.downloads)) {
        emit({ data: { message: "Loading cached links" }, event: "status" });
        emit({
            data: { downloads: sanitizeDownloadMap(cached.downloads) },
            event: "data",
        });
        return;
    }

    const { downloads, failed } = await streamDownloads(
        game.steam.name,
        emit,
        signal,
    );
    if (signal.aborted) return;

    if (!failed) {
        const ttl =
            Object.keys(downloads).length > 0 ? undefined : 5 * 60 * 1000;
        await saveCacheSafely(cacheKey, { downloads }, ttl);
    }
    emit({ data: { downloads }, event: "data" });
}

async function runSearchStream(
    query: string,
    emit: (event: { event: string; data: unknown }) => void,
    signal: AbortSignal,
): Promise<void> {
    const normalizedQuery = normalizeQuery(query);
    if (normalizedQuery.length < 2) {
        emit({
            data: { message: "Search query must contain at least 2 characters" },
            event: "failure",
        });
        return;
    }

    emit({ data: { message: "Checking search cache" }, event: "status" });
    emit({
        data: { message: "Waiting for Steam catalogue search" },
        event: "status",
    });

    const results = await getSearchResults(normalizedQuery);
    for (const result of results) {
        if (signal.aborted) return;
        emit({ data: result, event: "result" });
    }
    emit({ data: {}, event: "complete" });
}

export const searchRoute = new Elysia()
    .get(
        "/game/:id/stream",
        ({ params, request }) =>
            streamResponse(request, (emit, signal) =>
                runGameStream(params.id, emit, signal),
            ),
        { params: appIdParams },
    )
    .get(
        "/search/sse",
        ({ query, request }) =>
            streamResponse(request, (emit, signal) =>
                runSearchStream(query.q, emit, signal),
            ),
        {
            query: t.Object({
                q: t.String({
                    description: "Search query",
                    maxLength: 200,
                    minLength: 2,
                }),
            }),
        },
    )
    .get(
        "/search",
        async ({ query, set }) => {
            const normalizedQuery = normalizeQuery(query.q);
            if (normalizedQuery.length < 2) {
                set.status = 400;
                return {
                    error: "Search query must contain at least 2 characters",
                };
            }

            try {
                return await getSearchResults(normalizedQuery);
            } catch (error) {
                console.error("Search error after refresh:", error);
                set.status = 502;
                return { error: "Search is unavailable" };
            }
        },
        {
            query: t.Object({
                q: t.String({
                    description: "Search query",
                    maxLength: 200,
                    minLength: 2,
                }),
            }),
        },
    )
    .get(
        "/game/:id",
        async ({ params, set }) => {
            try {
                return await getGame(params.id);
            } catch (error) {
                console.error("Game info lookup failed:", error);
                set.status = 502;
                return { error: "Game information is unavailable" };
            }
        },
        { params: appIdParams },
    )
    .get(
        "/game/:id/links",
        async ({ params, set }) => {
            try {
                const game = await getGame(params.id);
                if (!game.steam) return { downloads: {} };

                const lookup = await getDownloadsForGame(game.steam.name);
                const downloads = lookup.downloads;
                const response = { downloads };
                const ttl =
                    Object.keys(downloads).length > 0
                        ? undefined
                        : 5 * 60 * 1000;
                if (!lookup.failed) {
                    await saveCacheSafely(`links:${params.id}`, response, ttl);
                }
                return response;
            } catch (error) {
                console.error("Download lookup failed:", error);
                set.status = 502;
                return { error: "Download links are unavailable" };
            }
        },
        { params: appIdParams },
    )
    .get(
        "/game/:id/links/sse",
        ({ params, request }) =>
            streamResponse(request, (emit, signal) =>
                runGameStream(params.id, emit, signal),
            ),
        { params: appIdParams },
    )
    .get(
        "/uploadhaven/:id",
        async ({ params, request, set }) => {
            try {
                const realUrl = await Uploadhaven.getRealUrl(
                    `https://uploadhaven.com/download/${params.id}`,
                    request.signal,
                );
                if (!realUrl) {
                    set.status = 404;
                    return { error: "Not found" };
                }

                const response = await safeFetch(
                    realUrl,
                    { signal: request.signal },
                    ["uploadhaven.com"],
                    null,
                );
                if (!response || !response.ok) {
                    set.status = response?.status || 502;
                    return { error: "Failed to fetch file" };
                }

                const headers = new Headers();
                for (const name of [
                    "accept-ranges",
                    "cache-control",
                    "content-disposition",
                    "content-range",
                    "content-type",
                    "etag",
                    "last-modified",
                ]) {
                    const value = response.headers.get(name);
                    if (value) headers.set(name, value);
                }
                if (!headers.has("content-disposition")) {
                    headers.set(
                        "Content-Disposition",
                        `attachment; filename="${params.id}"`,
                    );
                }
                headers.set("Cache-Control", "no-store");
                headers.set("X-Content-Type-Options", "nosniff");

                return new Response(response.body, {
                    headers,
                    status: response.status,
                });
            } catch (error) {
                console.error("Uploadhaven proxy error:", error);
                set.status = 502;
                return { error: "Proxy error" };
            }
        },
        { params: uploadhavenParams },
    );

export const app = new Elysia({ prefix: "/api" })
    .onRequest(({ request, server }) => rateLimitRequest(request, server))
    .use(searchRoute)
    .get("/health", () => ({ status: "ok" }));

export default app;
