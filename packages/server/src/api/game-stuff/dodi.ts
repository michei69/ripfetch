import { DownloadsResult, genericClosestTo, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";
import Solverr from "../flaresolverr";
import { decode } from "he";

export default class Dodi implements IGameSource {
    displayName = "DodiRepacks";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await Solverr.fetch<string>(`https://dodi-repacks.site/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=100&search=${encodeURIComponent(title)}`)
        const data = Solverr.getActualJson<any>(req as string)

        const results: SearchResult[] = []
        for (const result of data) {
            results.push({
                title: result.title.rendered.replaceAll("[DODI Repack]", "").trim(),
                url: `https://dodi-repacks.site/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`
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
        if (!url.includes("dodi-repacks.site")) return {}

        const req = await Solverr.fetch<string>(url)
        const data = decode(Solverr.getActualJson<any>(req as string)[0]?.content?.rendered ?? "")

        const results: DownloadsResult = {}
        for (const match of data.matchAll(/<p><span style="color: #ff0000;".*<\/p>/gm)) {
            if (!match[0].includes("<a")) continue
            const host = (match[0].match(/<strong>([^&]+)/)?.[1] ?? "").trim()
            if (!host) continue
            results[host] = results[host] || {}

            let i = 1
            for (const m of match[0].matchAll(/<a href="([^"]+)/gm)) {
                results[host][`Download ${i++}`] = m[1] as string
            }
        }
        
        return results
    }

    search(title: string): Promise<SearchResult[]> {
        return Dodi.search(title)
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return Dodi.getClosestTo(query)
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return Dodi.getDownloads(url)
    }
}
