import type { SteamInfo, SteamSearchResult } from "./commonData";
import Solverr from "../flaresolverr";
import { getCache, setCache } from "../../cache";
import { getFirstMatch } from "@/util";
import { safeGet, safePost } from "./NetworkRequest";

const apiKeyRegex = new RegExp(/js-search-tips" data-[^ ]* data-k="([^"]*)/gm);
const ALGOLIA_KEY_CACHE_KEY = "steam_algolia_key";
const ALGOLIA_KEY_CACHE_TTL = 24 * 60 * 60 * 1000;

let algoliaKey = "";
let refreshPromise: Promise<void> | undefined;
const pendingSearches = new Map<string, Promise<SteamSearchResult>>();
const pendingGameInfo = new Map<string, Promise<SteamInfo | null>>();

function isSearchHit(value: unknown): value is SteamSearchResult[number] {
    if (!value || typeof value !== "object") return false;
    return (
        "type" in value &&
        value.type === "app" &&
        "id" in value &&
        typeof value.id === "number" &&
        "name" in value &&
        typeof value.name === "string" &&
        "objectID" in value &&
        typeof value.objectID === "string"
    );
}

export default {
    async refreshAlgoliaDebounce(forceRefresh = false): Promise<void> {
        if (refreshPromise) return refreshPromise;

        refreshPromise = this.refreshAlgolia(forceRefresh).finally(() => {
            refreshPromise = undefined;
        });
        return refreshPromise;
    },

    async refreshAlgolia(forceRefresh = false): Promise<void> {
        if (!forceRefresh) {
            try {
                const cachedKey = await getCache(ALGOLIA_KEY_CACHE_KEY);
                if (cachedKey && typeof cachedKey === "string") {
                    algoliaKey = cachedKey;
                    console.log("Loaded Algolia key from cache");
                    return;
                }
            } catch (error) {
                console.debug("Failed to load algolia key from cache:", error);
            }
        }

        const req = await Solverr.fetch<string>("https://steamdb.info/");
        if (!req) return;

        const nextKey = getFirstMatch(req, apiKeyRegex)?.[1];
        if (!nextKey) return;
        algoliaKey = nextKey;
        console.log("Got Algolia key");

        try {
            await setCache(
                ALGOLIA_KEY_CACHE_KEY,
                algoliaKey,
                ALGOLIA_KEY_CACHE_TTL,
            );
            console.log("Saved algolia key to cache");
        } catch (error) {
            console.debug("Failed to save algolia key to cache:", error);
        }
    },

    async search(title: string): Promise<SteamSearchResult> {
        const key = title.trim().toLowerCase();
        const pending = pendingSearches.get(key);
        if (pending) return pending;

        const search = (async () => {
            if (!algoliaKey) await this.refreshAlgoliaDebounce();

            const response = await safePost<{
                hits?: unknown[];
            }>(
                "https://94he6yatei-dsn.algolia.net/1/indexes/all_names/query?x-algolia-agent=Algolia%20for%20JavaScript%20(SteamDB)",
                {
                    attributesToRetrieve: [
                        "type",
                        "id",
                        "name",
                        "small_capsule",
                    ],
                    hitsPerPage: 10,
                    query: title,
                },
                ["94he6yatei-dsn.algolia.net"],
                {
                    headers: {
                        "x-algolia-api-key": algoliaKey,
                        "x-algolia-application-id": "94HE6YATEI",
                        Referer: "https://steamdb.info/",
                    },
                },
            );
            const hits = response?.data.hits;
            if (!Array.isArray(hits)) {
                throw new Error("Invalid Steam search response");
            }
            return hits.filter(isSearchHit);
        })();
        pendingSearches.set(key, search);

        try {
            return await search;
        } finally {
            pendingSearches.delete(key);
        }
    },

    async getInfo(appId: number | string): Promise<SteamInfo | null> {
        const key = String(appId);
        const pending = pendingGameInfo.get(key);
        if (pending) return pending;

        const request = (async () => {
            try {
                const response = await safeGet<
                    Record<string, { success?: boolean; data?: SteamInfo }>
                >(
                    `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(key)}`,
                    ["store.steampowered.com"],
                );
                const data = response?.data?.[key];
                return data?.success && data.data ? data.data : null;
            } catch (error) {
                console.error("Steam game info lookup failed:", error);
                return null;
            }
        })();
        pendingGameInfo.set(key, request);

        try {
            return await request;
        } finally {
            pendingGameInfo.delete(key);
        }
    },
};
