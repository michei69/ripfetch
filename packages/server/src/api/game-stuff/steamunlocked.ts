import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import { isAllowedHost, isSafeExternalUrl } from "./NetworkRequest";
import NetworkRequest from "./NetworkRequest";

const searchResultRegex = /<a href="([^"]+)"[^<]+<h1>([^<]+)/gms;
const downloadLinkRegex = /a class="btn-download" href="([^"]*)/gms;

export default class Steamunlocked {
    static displayName = "SteamUnlocked";

    static async search(title: string): Promise<SearchResult[]> {
        const data = await NetworkRequest.get(
            `https://steamunlocked.org/?s=${encodeURIComponent(title)}`,
            ["steamunlocked.org"],
        );

        const results: SearchResult[] = [];
        for (const match of data.matchAll(searchResultRegex)) {
            results.push({
                title: (match[2] ?? "").replaceAll("  ", " ").trim(),
                url: (match[1] ?? "").trim(),
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await Steamunlocked.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!isAllowedHost(url, ["steamunlocked.org"])) return {};

        const data = await NetworkRequest.get(url);

        // Uploadhaven links are relayed through this server, which is what
        // keeps the download working past the host's own rate limiting.
        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(downloadLinkRegex)) {
            const linkUrl = match[1] ?? "";
            if (
                isAllowedHost(linkUrl, ["uploadhaven.com"]) &&
                isSafeExternalUrl(linkUrl)
            ) {
                results.uploadhaven = {
                    Download: linkUrl.replace(
                        "https://uploadhaven.com/download/",
                        "https://games.michei.dev/api/uploadhaven/",
                    ),
                };
            }
        }
        return results;
    }
}
