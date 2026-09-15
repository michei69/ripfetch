import {
    type DownloadsResult,
    genericClosestTo,
    type IGameSource,
    type SearchResult,
} from "./commonData";
import { decode } from "he";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

export default class FitGirl implements IGameSource {
    displayName = "FitGirl";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await safeGet(
            `https://fitgirl-repacks.site/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=20&search=${encodeURIComponent(title)}`,
            ["fitgirl-repacks.site"],
        );
        const data = Array.isArray(req?.data) ? req.data : [];

        const results: SearchResult[] = [];
        for (const result of data) {
            results.push({
                title: result.title.rendered
                    .replaceAll(/MULTi\d\d-ElAmigos/gm, "")
                    .replaceAll("-GOG", "")
                    .trim(),
                url: `https://fitgirl-repacks.site/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`,
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await FitGirl.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloadsOfClosestTo(
        query: string,
    ): Promise<DownloadsResult | null> {
        const game = await FitGirl.getClosestTo(query);
        if (!game) return null;
        return await FitGirl.getDownloads(game.url);
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        const req = await safeGet(url, ["fitgirl-repacks.site"]);
        const data = Array.isArray(req?.data)
            ? (req.data[0]?.content?.rendered ?? "")
            : "";

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(
            /<a href="([^"]+)" target="_blank" rel="noopener nofollow">([^<]+)/gm,
        )) {
            const url = match[1] ?? "";
            let file = decode(match[2] ?? "").replaceAll(
                "_–_fitgirl-repacks.site_–_",
                "",
            );
            if (file.match(/part\d\d/gm)) {
                file = file.replaceAll(/.*part(\d\d).*/gm, "Part $1");
            }
            const host = url.split("/")[2];
            if (!isSafeExternalUrl(url) || !host || !file) continue;
            results[host] = results[host] || {};
            results[host][file] = url;
        }

        return results;
    }

    search(title: string): Promise<SearchResult[]> {
        return FitGirl.search(title);
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return FitGirl.getClosestTo(query);
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return FitGirl.getDownloads(url);
    }
}
