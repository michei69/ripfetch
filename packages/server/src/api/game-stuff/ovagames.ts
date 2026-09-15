import {
    type DownloadsResult,
    genericClosestTo,
    type IGameSource,
    type SearchResult,
} from "./commonData";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

export default class OvaGames implements IGameSource {
    displayName = "OvaGames";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await safeGet(
            `https://www.ovagames.com/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=20&search=${encodeURIComponent(title)}`,
            ["ovagames.com"],
        );
        const data = Array.isArray(req?.data) ? req.data : [];

        const results: SearchResult[] = [];
        for (const result of data) {
            results.push({
                title: result.title.rendered
                    .replaceAll(/MULTi\d\d-ElAmigos/gm, "")
                    .replaceAll("-GOG", "")
                    .trim(),
                url: `https://www.ovagames.com/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`,
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await OvaGames.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloadsOfClosestTo(
        query: string,
    ): Promise<DownloadsResult | null> {
        const game = await OvaGames.getClosestTo(query);
        if (!game) return null;
        return await OvaGames.getDownloads(game.url);
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const req = await safeGet(url, ["ovagames.com"]);
        const data = Array.isArray(req?.data)
            ? (req.data[0]?.content?.rendered ?? "")
            : "";

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(/<a href="([^"]+)">([^<]+)/gm)) {
            const url = match[1] ?? "";
            const host = (match[2] ?? "")
                .toLowerCase()
                .replaceAll("*", "")
                .trim();
            if (!isSafeExternalUrl(url) || !host) continue;
            results[host] = results[host] || {};
            results[host].Download = url;
        }

        return results;
    }

    search(title: string): Promise<SearchResult[]> {
        return OvaGames.search(title);
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return OvaGames.getClosestTo(query);
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return OvaGames.getDownloads(url);
    }
}
