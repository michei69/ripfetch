import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";
import { hostOf, postBodyUrl, postContent, searchPosts } from "./wordpress";

const SITE = "https://game3rb.com";

export default class Game3rb {
    static displayName = "Game3RB";

    static async search(title: string): Promise<SearchResult[]> {
        const posts = await searchPosts(SITE, title);

        return posts.map((post) => ({
            title: post.title.rendered
                .replaceAll("+ OnLine", "")
                .replaceAll("+ CrackFix V2", "")
                .replaceAll("&#8211;", "-")
                .replaceAll("Download", "")
                .replaceAll("Downlaod", "")
                .trim(),
            url: postBodyUrl(SITE, post.slug),
        }));
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await Game3rb.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const data = await postContent(url, hostOf(SITE));

        // The post only links to thenewscasts.com, which is where the file
        // hosts are actually listed.
        const temp: Record<string, string[]> = Object.create(null);
        for (const match of data.matchAll(
            /(thenewscasts\.com\/view\/[^"]*)/gm,
        )) {
            const req = await safeGet(`https://${match[1]}`, [
                "thenewscasts.com",
            ]);
            const data2 = typeof req?.data === "string" ? req.data : "";
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
}
