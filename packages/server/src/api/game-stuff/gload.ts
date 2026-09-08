import {
    type DownloadsResult,
    genericClosestTo,
    type IGameSource,
    type SearchResult,
} from "./commonData";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

export default class GLoad implements IGameSource {
    displayName = "GLoad";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await safeGet(
            `https://gload.to/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=20&search=${encodeURIComponent(title)}`,
            ["gload.to"],
        );
        const data = Array.isArray(req?.data) ? req.data : [];

        const results: SearchResult[] = [];
        for (const result of data) {
            results.push({
                title: result.title.rendered
                    .replaceAll("-ElAmigos", "")
                    .replaceAll("-GOG", "")
                    .replaceAll(".", " ")
                    .trim(),
                url: `https://gload.to/${result.slug}`,
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await GLoad.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloadsOfClosestTo(
        query: string,
    ): Promise<DownloadsResult | null> {
        const game = await GLoad.getClosestTo(query);
        if (!game) return null;
        return await GLoad.getDownloads(game.url);
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const req = await safeGet(url, ["gload.to"]);
        const data: string = typeof req?.data === "string" ? req.data : "";

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(
            /<a class="dlhoster[^"]*" href="([^"]+)"[^>]*>.*<span>([^<]+)/gm,
        )) {
            const url = match[1] ?? "";
            const host = match[2] ?? "";
            if (!isSafeExternalUrl(url) || !host) continue;
            results[host] = results[host] || {};
            results[host].Download = url;
        }

        return results;
    }

    search(title: string): Promise<SearchResult[]> {
        return GLoad.search(title);
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return GLoad.getClosestTo(query);
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return GLoad.getDownloads(url);
    }
}
