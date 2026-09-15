import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import Urlbluemedia, { URLBLUEMEDIA_HOSTS } from "./Urlbluemedia";
import { isAllowedHost, isSafeExternalUrl } from "./NetworkRequest";
import NetworkRequest from "./NetworkRequest";
import { getFirstMatch } from "@/util";

const searchResultRegex =
    /<a class="uk-link-reset" href="([^"]+)"[^>]*>([^<]+)/gm;
const downloadLinkRegex1 = /<p>((?:(?!<\/p>).)+)/gms;
const downloadLinkRegexTitle = /<b class[^>]+>([^<]+)/gms;
const downloadLinkRegex2 = /<a href="([^"]+)"[^>]+>([^<]+)/gms;

export default class Igg {
    static displayName = "IGG";

    static async search(title: string): Promise<SearchResult[]> {
        const data = await NetworkRequest.get(
            `https://igg-games.com/?s=${encodeURIComponent(title)}`,
            ["igg-games.com"],
        );

        const results: SearchResult[] = [];
        for (const match of data.matchAll(searchResultRegex)) {
            results.push({
                title: (match[2] ?? "").replaceAll("Free Download", "").trim(),
                url: (match[1] ?? "").trim(),
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await Igg.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    private static async solveLink(url: string): Promise<string> {
        if (isAllowedHost(url, ["pcgamestorrents.com"])) {
            const data = await NetworkRequest.get(url, ["pcgamestorrents.com"]);
            let encLink = "";
            for (const link of data.matchAll(/<a href="([^"]+)"/gms)) {
                if (
                    isSafeExternalUrl(link[1]) &&
                    link[1].includes("url-generator.php")
                ) {
                    encLink = link[1];
                }
            }
            return await Urlbluemedia.getRealUrl(encLink);
        } else if (
            isAllowedHost(url, URLBLUEMEDIA_HOSTS) &&
            url.includes("url-generator.php")
        ) {
            return await Urlbluemedia.getRealUrl(url);
        } else if (isSafeExternalUrl(url)) {
            return url;
        }
        return "";
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!isAllowedHost(url, ["igg-games.com"])) return {};

        const data = await NetworkRequest.get(url);

        const results: DownloadsResult = Object.create(null);
        for (const match of data.matchAll(downloadLinkRegex1)) {
            const host =
                getFirstMatch(match[1], downloadLinkRegexTitle)?.[1]
                    ?.toLowerCase()
                    .replaceAll("link", "")
                    .replaceAll(":", "")
                    .trim() ?? "";

            for (const match2 of match[1]?.matchAll(downloadLinkRegex2) ?? []) {
                const linkTitle = (match2[2] ?? "").toLowerCase();
                const link = await Igg.solveLink(match2[1] ?? "");
                if (linkTitle.includes("part")) {
                    if (!host) continue;
                    if (!results[host]) results[host] = {};
                    const hostLinks = results[host];
                    if (hostLinks && link) hostLinks[linkTitle] = link;
                } else if (linkTitle.includes("torrent")) {
                    if (isSafeExternalUrl(link)) {
                        results.torrent = {
                            Magnet: link,
                        };
                    }
                } else {
                    if (!results[host]) results[host] = {};
                    if (link) results[host]!.Download = link;
                }
            }
        }
        return results;
    }
}
