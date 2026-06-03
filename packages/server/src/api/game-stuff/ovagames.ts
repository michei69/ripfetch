import axios from "axios";
import { DownloadsResult, genericClosestTo, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";

export default class OvaGames implements IGameSource {
    displayName = "OvaGames";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await axios.get(`https://www.ovagames.com/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=100&search=${encodeURIComponent(title)}`)
        const data = req.data

        const results: SearchResult[] = []
        for (const result of data) {
            results.push({
                title: result.title.rendered.replaceAll(/MULTi\d\d-ElAmigos/gm, "").replaceAll("-GOG", "").trim(),
                url: `https://www.ovagames.com/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`
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
        if (!url.includes("www.ovagames.com")) return {}

        const req = await axios.get(url)
        const data = req.data[0]?.content?.rendered ?? ""

        const results: DownloadsResult = {}
        for (const match of data.matchAll(/<a href="([^"]+)">([^<]+)/gm)) {
            const url = match[1] ?? ""
            const host = (match[2] ?? "").toLowerCase().replaceAll("*", "").trim()
            if (!url || !host) continue
            if (!url.includes("www.filecrypt.cc")) {
                console.warn("Unknown download link: " + url)
                continue // just to be safe
            }
            results[host] = results[host] || {}
            results[host]["Download"] = url
        }
        
        return results
    }

    search(title: string): Promise<SearchResult[]> {
        return OvaGames.search(title)
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return OvaGames.getClosestTo(query)
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return OvaGames.getDownloads(url)
    }
}
