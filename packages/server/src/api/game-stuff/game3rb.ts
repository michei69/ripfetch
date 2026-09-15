import {
    type DownloadsResult,
    genericClosestTo,
    type IGameSource,
    type SearchResult,
} from "./commonData";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

export default class Game3rb implements IGameSource {
    displayName = "Game3RB";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await safeGet(
            `https://game3rb.com/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=20&search=${encodeURIComponent(title)}`,
            ["game3rb.com"],
        );
        const data = Array.isArray(req?.data) ? req.data : [];

        const results: SearchResult[] = [];
        for (const result of data) {
            results.push({
                title: result.title.rendered
                    .replaceAll("+ OnLine", "")
                    .replaceAll("+ CrackFix V2", "")
                    .replaceAll("&#8211;", "-")
                    .replaceAll("Download", "")
                    .replaceAll("Downlaod", "")
                    .trim(),
                url: `https://game3rb.com/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`,
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await Game3rb.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloadsOfClosestTo(
        query: string,
    ): Promise<DownloadsResult | null> {
        const game = await Game3rb.getClosestTo(query);
        if (!game) return null;
        return await Game3rb.getDownloads(game.url);
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const req = await safeGet(url, ["game3rb.com"]);
        const data = Array.isArray(req?.data)
            ? (req.data[0]?.content?.rendered ?? "")
            : "";

        const temp: Record<string, string[]> = Object.create(null);
        for (const match of data.matchAll(
            /(thenewscasts\.com\/view\/[^"]*)/gm,
        )) {
            const req2 = await safeGet(`https://${match[1]}`, [
                "thenewscasts.com",
            ]);
            const data2 = typeof req2?.data === "string" ? req2.data : "";
            for (const match2 of data2.matchAll(/href="(http[^"]*)/gm)) {
                const link = match2[1] ?? "";
                if (!isSafeExternalUrl(link)) continue;

                const host = new URL(link).hostname;
                if (host) {
                    temp[host] = temp[host] || [];
                    temp[host].push(link);
                }
            }
        }

        const results: DownloadsResult = Object.create(null);
        for (const [host, links] of Object.entries(temp)) {
            if (
                host === "thenewscasts.com" ||
                host.endsWith(".thenewscasts.com")
            ) {
                continue;
            }
            results[host] = results[host] || {};
            if (links.length > 1) {
                for (const [idx, link] of links.entries()) {
                    results[host][`Part ${idx + 1}`] = link;
                }
            } else if (links[0]) {
                results[host].Download = links[0];
            }
        }

        return results;
    }

    search(title: string): Promise<SearchResult[]> {
        return Game3rb.search(title);
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return Game3rb.getClosestTo(query);
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return Game3rb.getDownloads(url);
    }
}
