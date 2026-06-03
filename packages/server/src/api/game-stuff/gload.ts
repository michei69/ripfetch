import axios from "axios";
import { DownloadsResult, genericClosestTo, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";

export default class GLoad implements IGameSource {
    displayName = "GLoad";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await axios.get(`https://gload.to/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=100&search=${encodeURIComponent(title)}`)
        const data = req.data

        const results: SearchResult[] = []
        for (const result of data) {
            results.push({
                title: result.title.rendered.replaceAll("-ElAmigos", "").replaceAll("-GOG", "").replaceAll(".", " ").trim(),
                url: `https://gload.to/${result.slug}`
            })
        }
        return results
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await this.search(query)
        if (results.length === 0) return null
        return genericClosestTo(results, ["title"], query) || null
    }

    static async getDownloadsOfClosestTo(query: string): Promise<DownloadsResult | null> {
        const game = await this.getClosestTo(query)
        if (!game) return null
        return await this.getDownloads(game.url)
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!url.includes("gload.to")) return {}

        const req = await axios.get(url)
        const data: string = req.data

        const results: DownloadsResult = {}
        for (const match of data.matchAll(/<a class="dlhoster[^"]*" href="([^"]+)"[^>]*>.*<span>([^<]+)/gm)) {
            const url = match[1] ?? ""
            const host = match[2] ?? ""
            if (!url || !host) continue
            if (!url.includes("filecrypt.cc")) {
                console.warn("Unknown download link: " + url)
                continue // just to be safe
            }
            results[host] = results[host] || {}
            results[host]["Download"] = url
        }
        
        return results
    }

    search(title: string): Promise<SearchResult[]> {
        return GLoad.search(title)
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return GLoad.getClosestTo(query)
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return GLoad.getDownloads(url)
    }
}
