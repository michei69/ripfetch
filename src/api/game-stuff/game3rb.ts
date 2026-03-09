import axios from "axios";
import { DownloadsResult, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";

export default class Game3rb implements IGameSource {
    displayName = "Game3RB";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await axios.get(`https://game3rb.com/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=100&search=${title}`)
        const data = req.data

        const results: SearchResult[] = []
        for (const result of data) {
            results.push({
                title: result.title.rendered.replaceAll("+ OnLine", "").replaceAll("+ CrackFix V2", "").replaceAll("&#8211;", "-").replaceAll("Download", "").replaceAll("Downlaod", "").trim(),
                url: `https://game3rb.com/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`
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
        if (!url.includes("game3rb.com")) return {}

        const req = await axios.get(url)
        const data = req.data[0]?.content?.rendered ?? ""

        const temp: Record<string, string[]> = {}
        for (const match of data.matchAll(/(thenewscasts\.com\/view\/[^"]*)/gm)) {
            const req2 = await axios.get("https://" + match[1])
            const data2 = req2.data
            for (const match2 of data2.matchAll(/href="(http[^"]*)/gm)) {
                const host = match2[1]?.split("/")[2] ?? ""
                if (host) {
                    temp[host] = temp[host] || []
                    temp[host].push(match2[1])
                }
            }
        }
        
        const results: DownloadsResult = {}
        for (const [host, links] of Object.entries(temp)) {
            if (host.includes("thenewscasts")) continue
            results[host] = results[host] || {}
            if (links.length > 1) {
                for (const idx in links) {
                    results[host][`Part ${Number(idx) + 1}`] = links[idx] ?? ""
                }
            } else if (links[0]) {
                results[host]["Download"] = links[0]
            }
        }

        return results
    }

    async search(title: string): Promise<SearchResult[]> {
        return Game3rb.search(title)
    }

    async getDownloads(url: string): Promise<DownloadsResult> {
        return Game3rb.getDownloads(url)
    }
}
