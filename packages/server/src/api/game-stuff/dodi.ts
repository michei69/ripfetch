import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import Solverr from "../flaresolverr";
import { decode } from "he";
import { isAllowedHost, isSafeExternalUrl } from "./NetworkRequest";

export default class Dodi {
    static displayName = "DodiRepacks";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await Solverr.fetch<string>(
            `https://dodi-repacks.site/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=20&search=${encodeURIComponent(title)}`,
        );
        const data = Solverr.getActualJson<any>(req as string);

        const results: SearchResult[] = [];
        for (const result of data) {
            results.push({
                title: result.title.rendered
                    .replaceAll("[DODI Repack]", "")
                    .trim(),
                url: `https://dodi-repacks.site/wp-json/wp/v2/posts?_fields=content.rendered&slug=${result.slug}`,
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await Dodi.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!isAllowedHost(url, ["dodi-repacks.site"])) return {};

        const req = await Solverr.fetch<string>(url);
        const data = decode(
            Solverr.getActualJson<any>(req as string)[0]?.content?.rendered ??
                "",
        );

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(
            /<p><span style="color: #ff0000;".*<\/p>/gm,
        )) {
            if (!match[0].includes("<a")) continue;
            const host = (match[0].match(/<strong>([^&]+)/)?.[1] ?? "").trim();
            if (!host) continue;
            results[host] = results[host] || {};

            let i = 1;
            for (const m of match[0].matchAll(/<a href="([^"]+)/gm)) {
                const link = m[1] ?? "";
                if (isSafeExternalUrl(link)) {
                    results[host][`Download ${i++}`] = link;
                }
            }
        }

        return results;
    }
}
