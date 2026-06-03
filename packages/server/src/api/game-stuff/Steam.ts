import axios from "axios";
import type { SteamInfo, SteamSearchResult } from "./commonData";
import Solverr from "../flaresolverr";
import { getCache, setCache } from "../../cache";
import { getFirstMatch } from "@/util";

const apiKeyRegex = new RegExp(/js-search-tips" data-[^ ]* data-k="([^"]*)/gm)
const ALGOLIA_KEY_CACHE_KEY = "steam_algolia_key"
const ALGOLIA_KEY_CACHE_TTL = 24 * 60 * 60 * 1000 // 1 day

let _algoliaKey = ""
let refreshPromise: Promise<void> | undefined

export default {
    async refreshAlgoliaDebounce(forceRefresh = false): Promise<void> {
        if (refreshPromise) return refreshPromise
        refreshPromise = this.refreshAlgolia(forceRefresh)
        await refreshPromise
        refreshPromise = undefined
    },

    async refreshAlgolia(forceRefresh = false): Promise<void> {
        if (!forceRefresh) {
            if (refreshPromise) return;
            try {
                const cachedKey = await getCache(ALGOLIA_KEY_CACHE_KEY)
                if (cachedKey && typeof cachedKey === "string") {
                    _algoliaKey = cachedKey
                    console.log(`Loaded algolia key from cache: ${_algoliaKey.substring(0, 8)}...`)
                    return
                }
            } catch (error) {
                console.debug("Failed to load algolia key from cache:", error)
            }
        }
        
        const req = await Solverr.fetch<string>("https://steamdb.info/")
        if (!req) return
        
        _algoliaKey = getFirstMatch(req, apiKeyRegex)?.[1] ?? _algoliaKey
        console.log(`Got algolia key: ${_algoliaKey}`)
        
        try {
            await setCache(ALGOLIA_KEY_CACHE_KEY, _algoliaKey, ALGOLIA_KEY_CACHE_TTL)
            console.log("Saved algolia key to cache")
        } catch (error) {
            console.debug("Failed to save algolia key to cache:", error)
        }
    },

    async search(title: string): Promise<SteamSearchResult> {
        const temp = await axios.post("https://94he6yatei-dsn.algolia.net/1/indexes/all_names/query?x-algolia-agent=Algolia for JavaScript (SteamDB)", {
            query: title,
            hitsPerPage: 10,
            attributesToRetrieve: ["type", "id", "name", "small_capsule"]
        }, {
            headers: {
                "x-algolia-api-key": _algoliaKey,
                "x-algolia-application-id": "94HE6YATEI",
                Referer: "https://steamdb.info/"
            }
        })
        return (temp.data as {hits: SteamSearchResult}).hits.filter(h => h.type === "app")
    },

    async getInfo(appId: number|string): Promise<SteamInfo|null> {
        const temp = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`)
        const data = temp.data[appId]
        return data?.success ? data.data : null
    }
}
