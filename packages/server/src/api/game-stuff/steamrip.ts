import {
    type DownloadsResult,
    genericClosestTo,
    type IGameSource,
    type SearchResult,
} from "./commonData";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

const searchResultRegex =
    /<a href="([^"]+)" class="all-over-thumb-link"><[^>]+>([^<]+)/gm;
const downloadLinkRegex =
    /<strong>([^<]+)<\/strong>[^<]*(?:<\/span>)?<br[^>]*>[^<]*<a href="([^"]+)/gms;

export default class Steamrip implements IGameSource {
    displayName = "SteamRIP";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await safeGet(
            `https://steamrip.com/?s=${encodeURIComponent(title)}`,
            ["steamrip.com"],
        );
        const data = typeof req?.data === "string" ? req.data : "";

        const results: SearchResult[] = [];
        for (const match of data.matchAll(searchResultRegex)) {
            results.push({
                title: (match[2] ?? "")
                    .replaceAll("Free Download", "")
                    .replaceAll("&#8217;", "'")
                    .replaceAll("  ", " ")
                    .replaceAll("&#8211;", "-")
                    .trim(),
                url: `https://steamrip.com/${(match[1] ?? "").trim()}`,
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await Steamrip.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloadsOfClosestTo(
        query: string,
    ): Promise<DownloadsResult | null> {
        const game = await Steamrip.getClosestTo(query);
        if (!game) return null;
        return await Steamrip.getDownloads(game.url);
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const req = await safeGet(url, ["steamrip.com"]);
        const data = typeof req?.data === "string" ? req.data : "";

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(downloadLinkRegex)) {
            const host = match[1] ?? "";
            if (host) {
                results[host] = results[host] || {};
                const link = `https:${match[2] ?? ""}`;
                if (isSafeExternalUrl(link)) results[host].Download = link;
            }
        }
        return results;
    }

    search(title: string): Promise<SearchResult[]> {
        return Steamrip.search(title);
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return Steamrip.getClosestTo(query);
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return Steamrip.getDownloads(url);
    }
}
