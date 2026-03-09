import { DownloadsResult, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";
import NetworkRequest from "./networkRequest";

const searchResultRegex = /<a href="([^"]+)"[^<]+<h1>([^<]+)/gms
const downloadLinkRegex = /a class="btn-download" href="([^"]*)/gms

export default class Steamunlocked implements IGameSource {
    displayName = "SteamUnlocked";

    static async search(title: string): Promise<SearchResult[]> {
        const data = await NetworkRequest.get(`https://steamunlocked.net/?s=${title}`)

        const results: SearchResult[] = []
        for (const match of data.matchAll(searchResultRegex)) {
            results.push({
                title: (match[2] ?? "").replaceAll("  ", " ").trim(),
                url: (match[1] ?? "").trim()
            })
        }
        return results
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await this.search(query)
        if (results.length === 0) return null
        return new Fuse(results, {
            keys: ["title"]
        }).search(query)[0]?.item ?? null
    }

    static async getDownloadsOfClosestTo(query: string): Promise<DownloadsResult | null> {
        const game = await this.getClosestTo(query)
        if (!game) return null
        return await this.getDownloads(game.url)
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!url.includes("steamunlocked.org")) return {}

        const data = await NetworkRequest.get(url)

        const results: DownloadsResult = {}
        for (const match of data.matchAll(downloadLinkRegex)) {
            const linkUrl = match[1] ?? ""
            if (linkUrl) {
                results["uploadhaven"] = {
                    Download: linkUrl.replace("https://uploadhaven.com/download/", "https://games.michei.dev/api/uploadhaven/")
                }
            }
        }
        return results
    }

    async search(title: string): Promise<SearchResult[]> {
        return Steamunlocked.search(title)
    }

    async getDownloads(url: string): Promise<DownloadsResult> {
        return Steamunlocked.getDownloads(url)
    }
}
