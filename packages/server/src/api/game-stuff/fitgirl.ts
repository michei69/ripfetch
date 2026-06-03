import axios from "axios";
import { DownloadsResult, genericClosestTo, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";
import { decode } from "he";

export default class FitGirl implements IGameSource {
    displayName = "FitGirl";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await axios.get(`https://fitgirl-repacks.site/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=100&search=${encodeURIComponent(title)}`)
        const data = req.data

        const results: SearchResult[] = []
        for (const result of data) {
            results.push({
                title: result.title.rendered.replaceAll(/MULTi\d\d-ElAmigos/gm, "").replaceAll("-GOG", "").trim(),
                url: `https://fitgirl-repacks.site/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`
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
        if (!url.includes("fitgirl-repacks.site")) return {}

        const req = await axios.get(url)
        const data = req.data[0]?.content?.rendered ?? ""

        const results: DownloadsResult = {}
        for (const match of data.matchAll(/<a href="([^"]+)" target="_blank" rel="noopener nofollow">([^<]+)/gm)) {
            const url = match[1] ?? ""
            let file = decode(match[2] ?? "").replaceAll("_–_fitgirl-repacks.site_–_", "")
            if (file.match(/part\d\d/gm)) {
                file = file.replaceAll(/.*part(\d\d).*/gm, "Part $1")
            }
            const host = url.split("/")[2]
            if (!url || !host || !file) continue
            results[host] = results[host] || {}
            results[host][file] = url
        }
        
        return results
    }

    search(title: string): Promise<SearchResult[]> {
        return FitGirl.search(title)
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return FitGirl.getClosestTo(query)
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return FitGirl.getDownloads(url)
    }
}
