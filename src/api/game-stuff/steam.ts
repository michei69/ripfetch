import axios from "axios";
import { SteamInfo, SteamSearchResult } from "./commonData";
import Solverr from "../flaresolverr";
import { getCache, setCache } from "../../server/cache";

const apiKeyRegex = new RegExp(/js-search-tips" data-[^ ]* data-k="([^"]*)/gm)
const ALGOLIA_KEY_CACHE_KEY = "steam_algolia_key"
const ALGOLIA_KEY_CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 1 month

export default class Steam {
    private static _algoliaKey = "9d194546e80e81d7e401a058b5ce5a66"

    static get algoliaKey(): string {
        return this._algoliaKey
    }

    static set algoliaKey(value: string) {
        this._algoliaKey = value
    }

    static async refreshAlgolia(forceRefresh = false): Promise<void> {
        if (!forceRefresh) {
            try {
                const cachedKey = await getCache(ALGOLIA_KEY_CACHE_KEY)
                if (cachedKey && typeof cachedKey === "string") {
                    this._algoliaKey = cachedKey
                    console.log(`Loaded algolia key from cache: ${this._algoliaKey.substring(0, 8)}...`)
                    return
                }
            } catch (error) {
                console.debug("Failed to load algolia key from cache:", error)
            }
        }
        
        const req = await Solverr.fetch<string>("https://steamdb.info/")
        if (!req) return
        
        const matches = req.matchAll(apiKeyRegex)
        for (const match of matches) {
            if (match[1]) {
                this._algoliaKey = match[1]
            }
        }
        console.log(`Got algolia key: ${this._algoliaKey}`)
        
        try {
            await setCache(ALGOLIA_KEY_CACHE_KEY, this._algoliaKey, ALGOLIA_KEY_CACHE_TTL)
            console.log("Saved algolia key to cache")
        } catch (error) {
            console.debug("Failed to save algolia key to cache:", error)
        }
    }

    static async search(title: string): Promise<SteamSearchResult> {
        const temp = await axios.post("https://94he6yatei-dsn.algolia.net/1/indexes/all_names/query?x-algolia-agent=Algolia for JavaScript (SteamDB)", {
            query: title,
            hitsPerPage: 10,
            attributesToRetrieve: ["type", "id", "name", "small_capsule"]
        }, {
            headers: {
                "x-algolia-api-key": this._algoliaKey,
                "x-algolia-application-id": "94HE6YATEI",
                Referer: "https://steamdb.info/"
            }
        })
        return (temp.data as {hits: SteamSearchResult}).hits.filter(h => h.type == "app")
    }

    static async getInfo(appId: number|string): Promise<SteamInfo|null> {
        const temp = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`)
        const data = temp.data[appId]
        return data?.success ? data.data : null
    }
}
