import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";
import { hostOf, searchPosts } from "./wordpress";

const SITE = "https://gload.to";

export default class GLoad {
    static displayName = "GLoad";

    static async search(title: string): Promise<SearchResult[]> {
        const posts = await searchPosts(SITE, title);

        return posts.map((post) => ({
            title: post.title.rendered
                .replaceAll("-ElAmigos", "")
                .replaceAll("-GOG", "")
                .replaceAll(".", " ")
                .trim(),
            url: `${SITE}/${post.slug}`,
        }));
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await GLoad.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const req = await safeGet(url, [hostOf(SITE)]);
        const data: string = typeof req?.data === "string" ? req.data : "";

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(
            /<a class="dlhoster[^"]*" href="([^"]+)"[^>]*>.*<span>([^<]+)/gm,
        )) {
            const link = match[1] ?? "";
            const host = match[2] ?? "";
            if (!isSafeExternalUrl(link) || !host) continue;
            results[host] = results[host] || {};
            results[host].Download = link;
        }

        return results;
    }
}
