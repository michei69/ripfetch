import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import { isSafeExternalUrl } from "./NetworkRequest";
import { hostOf, postBodyUrl, postContent, searchPosts } from "./wordpress";

const SITE = "https://www.ovagames.com";

export default class OvaGames {
    static displayName = "OvaGames";

    static async search(title: string): Promise<SearchResult[]> {
        const posts = await searchPosts(SITE, title);

        return posts.map((post) => ({
            title: post.title.rendered
                .replaceAll(/MULTi\d\d-ElAmigos/gm, "")
                .replaceAll("-GOG", "")
                .trim(),
            url: postBodyUrl(SITE, post.slug),
        }));
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await OvaGames.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const data = await postContent(url, hostOf(SITE));

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(/<a href="([^"]+)">([^<]+)/gm)) {
            const link = match[1] ?? "";
            const host = (match[2] ?? "")
                .toLowerCase()
                .replaceAll("*", "")
                .trim();
            if (!isSafeExternalUrl(link) || !host) continue;
            results[host] = results[host] || {};
            results[host].Download = link;
        }

        return results;
    }
}
