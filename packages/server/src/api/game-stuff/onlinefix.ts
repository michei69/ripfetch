import { type AxiosResponse } from "axios";
import { type DownloadsResult, genericClosestTo, type IGameSource, type SearchResult } from "./commonData";
import { getFirstMatch } from "@/util";
import {
    isAllowedHost,
    isSafeExternalUrl,
    safeGet,
    safePost,
} from "./NetworkRequest";

const searchResultRegex = /href="([^"]*)"><span[^>]*>([^<]*)/gm
const downloadLinkRegex = /href="([^"]*)" class="btn btn-success btn-small">([^<]*)/gm
const filenamePartRegex = /part([^.]+)/gm

const textDecoder = new TextDecoder("windows-1252")
const getAxiosData = (response: AxiosResponse): string => {
    return textDecoder.decode(response.data)
}

const getLoginCookie = (): string => {
    const userId = process.env.ONLINEFIX_DLE_USER_ID;
    const password = process.env.ONLINEFIX_DLE_PASSWORD;
    if (!userId || !password) return "";
    return `dle_user_id=${userId}; dle_password=${password};`;
}

const getFileName = (filename: string): string => {
    const part = getFirstMatch(filename, filenamePartRegex)?.[1]
    return part ? `Part ${part}` : filename
}


export default class Onlinefix implements IGameSource {
    displayName = "Online-Fix.me";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await safePost<ArrayBuffer>(
            "https://online-fix.me/engine/ajax/search.php",
            `query=${encodeURIComponent(title)}`,
            ["online-fix.me"],
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": "https://online-fix.me/page/2/",
                    "X-Requested-With": "XMLHttpRequest",
                },
                responseType: "arraybuffer",
            },
        );
        if (!req) return [];
        const data = getAxiosData(req)

        const results: SearchResult[] = []
        for (const match of data.matchAll(searchResultRegex)) {
            const rawTitle = match[2] ?? "";
            const rawUrl = match[1] ?? "";
            let resultUrl = "";
            try {
                resultUrl = new URL(rawUrl, "https://online-fix.me").toString();
            } catch {
                continue;
            }
            results.push({
                title: rawTitle.replace(/\s*по сети\s*$/i, "").trim(),
                url: resultUrl,
            })
        }
        return results
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await Onlinefix.search(query)
        if (results.length === 0) return null
        return genericClosestTo(results, ["title"], query) || null
    }

    static async getDownloadsOfClosestTo(query: string): Promise<DownloadsResult | null> {
        const game = await Onlinefix.getClosestTo(query)
        if (!game) return null
        return await Onlinefix.getDownloads(game.url)
    }

    private static async processLink(url: string): Promise<DownloadsResult> {
        const links: DownloadsResult = Object.create(null);
        if (!isAllowedHost(url, ["hosters.online-fix.me"])) return links;

        const res = await safeGet<string>(url, ["hosters.online-fix.me"], {
            headers: {
                "Referer": "https://online-fix.me/",
            },
        });
        const html: string = typeof res?.data === "string" ? res.data : "";
            
        for (const match of html.matchAll(/data-links='([^']*)/gm)) {
            let data: unknown;
            try {
                data = JSON.parse(match[1] ?? "[]");
            } catch {
                continue;
            }
            if (!Array.isArray(data)) continue;

            for (const file of data) {
                if (!file || typeof file !== "object") continue;
                const directLink =
                    "direct_link" in file && typeof file.direct_link === "string"
                        ? file.direct_link
                        : "";
                const fileName =
                    "file_name" in file && typeof file.file_name === "string"
                        ? file.file_name
                        : "";
                if (!isSafeExternalUrl(directLink) || !fileName) continue;

                const hostLower = new URL(directLink).hostname.toLowerCase();
                if (!links[hostLower]) links[hostLower] = {};
                links[hostLower][getFileName(fileName)] = directLink;
            }
        }
        return links
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!isAllowedHost(url, ["online-fix.me"])) return {};

        const cookie = getLoginCookie();
        const req = await safeGet<string>(url, ["online-fix.me"], {
            headers: cookie ? { Cookie: cookie } : undefined,
        });
        const data = typeof req?.data === "string" ? req.data : "";

        const results: DownloadsResult = Object.create(null)
        for (const match of data.matchAll(downloadLinkRegex)) {
            if ((match[1] ?? "").includes("donation")) continue
            const processed = await Onlinefix.processLink(match[1] ?? "")
            for (const [host, links] of Object.entries(processed)) {
                if (!results[host]) results[host] = {}
                for (const [name, link] of Object.entries(links)) {
                    results[host][name] = link
                }
            }
        }
        return results
    }

    search(title: string): Promise<SearchResult[]> {
        return Onlinefix.search(title)
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return Onlinefix.getClosestTo(query)
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return Onlinefix.getDownloads(url)
    }
}
