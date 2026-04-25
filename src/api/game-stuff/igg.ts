import { DownloadsResult, IGameSource, SearchResult } from "./commonData";
import urlbluemedia from "./urlbluemedia";
import Fuse from "fuse.js";
import NetworkRequest from "./networkRequest";

const searchResultRegex = /<a class="uk-link-reset" href="([^"]+)"[^>]*>([^<]+)/gm
const downloadLinkRegex1 = /<p>((?:(?!<\/p>).)+)/gms
const downloadLinkRegexTitle = /<b class[^>]+>([^<]+)/gms
const downloadLinkRegex2 = /<a href="([^"]+)"[^>]+>([^<]+)/gms

export default class Igg implements IGameSource {
    displayName = "IGG";

    static async search(title: string): Promise<SearchResult[]> {
        const data = await NetworkRequest.get(`https://igg-games.com/?s=${title}`)

        const results: SearchResult[] = []
        for (const match of data.matchAll(searchResultRegex)) {
            results.push({
                title: (match[2] ?? "").replaceAll("Free Download", "").trim(),
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

    private static async solveLink(url: string): Promise<string> {
        if (url.includes("pcgamestorrents.com")) {
            const data = await NetworkRequest.get(url)
            let encLink = ""
            for (const link of data.matchAll(/<a href="([^"]+)"/gms)) {
                if (link[1]?.includes("url-generator.php")) encLink = link[1] ?? ""
            }
            return await urlbluemedia.getRealUrl(encLink)
        } else if (url.includes("url-generator.php")) {
            return await urlbluemedia.getRealUrl(url)
        } else {
            return url
        }
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!url.includes("igg-games.com")) return {}

        const data = await NetworkRequest.get(url)

        const results: DownloadsResult = {}
        for (const match of data.matchAll(downloadLinkRegex1)) {
            let host = ""
            for (const match2 of match[1]?.matchAll(downloadLinkRegexTitle) ?? []) {
                host = (match2[1] ?? "").toLowerCase()
                    .replaceAll("link", "")
                    .replaceAll(":", "")
                    .trim()
            }
            for (const match2 of match[1]?.matchAll(downloadLinkRegex2) ?? []) {
                const linkTitle = (match2[2] ?? "").toLowerCase()
                const link = await this.solveLink(match2[1] ?? "")
                if (linkTitle.includes("part")) {
                    if (!results[host]) results[host] = {}
                    const hostLinks = results[host]
                    if (hostLinks && link) hostLinks[linkTitle] = link
                } else if (linkTitle.includes("torrent")) {
                    results["torrent"] = {
                        Magnet: link
                    }
                } else {
                    if (!results[host]) results[host] = {}
                    if (link) results[host]!["Download"] = link
                }
            }
        }
        return results
    }

    async search(title: string): Promise<SearchResult[]> {
        return Igg.search(title)
    }

    async getDownloads(url: string): Promise<DownloadsResult> {
        return Igg.getDownloads(url)
    }
}
