import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import { decode } from "he";
import { isSafeExternalUrl } from "./NetworkRequest";
import { hostOf, postBodyUrl, postContent, searchPosts } from "./wordpress";

const SITE = "https://fitgirl-repacks.site";

export default class FitGirl {
    static displayName = "FitGirl";

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
        const results = await FitGirl.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const data = await postContent(url, hostOf(SITE));

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(
            /<a href="([^"]+)" target="_blank" rel="noopener nofollow">([^<]+)/gm,
        )) {
            const link = match[1] ?? "";
            let file = decode(match[2] ?? "").replaceAll(
                "_–_fitgirl-repacks.site_–_",
                "",
            );
            if (file.match(/part\d\d/gm)) {
                file = file.replaceAll(/.*part(\d\d).*/gm, "Part $1");
            }
            const host = link.split("/")[2];
            if (!isSafeExternalUrl(link) || !host || !file) continue;
            results[host] = results[host] || {};
            results[host][file] = link;
        }

        return results;
    }
}
