import axios from "axios";
import { DownloadsResult, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";

const searchResultRegex = /<a href="([^"]+)" class="all-over-thumb-link"><[^>]+>([^<]+)/gm
const downloadLinkRegex = /<strong>([^<]+)<\/strong>[^<]*(?:<\/span>)?<br[^>]*>[^<]*<a href="([^"]+)/gms

export default class Steamrip implements IGameSource {
    displayName = "SteamRIP";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await axios.get(`https://steamrip.com/?s=${title}`)
        const data = req.data

        const results: SearchResult[] = []
        for (const match of data.matchAll(searchResultRegex)) {
            results.push({
                title: (match[2] ?? "").replaceAll("Free Download", "").replaceAll("&#8217;", "'").replaceAll("  ", " ").replaceAll("&#8211;", "-").trim(),
                url: "https://steamrip.com/" + (match[1] ?? "").trim()
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
        if (!url.includes("steamrip.com")) return {}

        const req = await axios.get(url)
        const data = req.data

        const results: DownloadsResult = {}
        for (const match of data.matchAll(downloadLinkRegex)) {
            const host = match[1] ?? ""
            if (host) {
                results[host] = results[host] || {}
                results[host]["Download"] = "https:" + (match[2] ?? "")
            }
        }
        return results
    }

    async search(title: string): Promise<SearchResult[]> {
        return Steamrip.search(title)
    }

    async getDownloads(url: string): Promise<DownloadsResult> {
        return Steamrip.getDownloads(url)
    }
}
