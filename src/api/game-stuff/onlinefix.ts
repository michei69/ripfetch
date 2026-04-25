import axios, { AxiosResponse } from "axios";
import { DownloadsResult, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";

const searchResultRegex = /href="([^"]*)"><span[^>]*>([^<]*)/gm
const downloadLinkRegex = /href="([^"]*)" class="btn btn-success btn-small">([^<]*)/gm
const filenamePartRegex = /part([^.]+)/gm

const textDecoder = new TextDecoder("iso-8859-1")
const getAxiosData = (response: AxiosResponse): string => {
    return textDecoder.decode(response.data)
}

const getLoginCookie = (): string => {
    return `dle_user_id=${process.env["ONLINEFIX_DLE_USER_ID"]}; dle_password=${process.env["ONLINEFIX_DLE_PASSWORD"]};`
}

const getFileName = (filename: string): string => {
    var part = ""
    for (const match of filename.matchAll(filenamePartRegex)) {
        part = match[1] ?? ""
    }
    return part != "" ? "Part " + part : filename
}


export default class Onlinefix implements IGameSource {
    displayName = "Online-Fix.me";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await axios.request({
            url: "https://online-fix.me/engine/ajax/search.php",
            validateStatus: () => true,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://online-fix.me/page/2/",
            },
            method: "post",
            data: `query=${encodeURIComponent(title)}`,
            responseType: "arraybuffer"
        })
        const data = getAxiosData(req)

        const results: SearchResult[] = []
        for (const match of data.matchAll(searchResultRegex)) {
            results.push({
                // bun does not support this encoding for some fucking reason
                // title: (match[2] ?? "").replaceAll("по сети", "").trim(),
                title: (match[2] ?? "").substring(0, (match[2] ?? "").length - 7).trim(),
                url: (match[1] ?? "").trim()
            })
        }
        return results
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await this.search(query)
        if (results.length === 0) return null
        return new Fuse(results, {
            keys: ["title"]
        }).search(query)[0]?.item ?? null
    }

    static async getDownloadsOfClosestTo(query: string): Promise<DownloadsResult | null> {
        const game = await this.getClosestTo(query)
        if (!game) return null
        return await this.getDownloads(game.url)
    }

    private static async processLink(url: string): Promise<DownloadsResult> {
        const hostname = url.split("/")[2] ?? ""
        const links: DownloadsResult = {}
        if (hostname.includes("hosters.online-fix.me")) {
            const res = await axios.get(url, {
                headers: {
                    "Referer": "https://online-fix.me/"
                }
            })
            const html: string = res.data
            
            for (const match of html.matchAll(/data-links='([^']*)/gm)) {
                const data = JSON.parse(match[1] ?? "{}")
                for (const file of data) {
                    const host: string = (file.direct_link ?? "").split("/")[2] ?? ""
                    const hostLower = host.toLowerCase()
                    if (!links[hostLower]) links[hostLower] = {}
                    if (file.file_name && file.direct_link) {
                        links[hostLower][getFileName(file.file_name)] = file.direct_link
                    }
                }
            }
        }
        return links
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!url.includes("online-fix.me")) return {}

        const req = await axios.get(url, {
            headers: {
                "Cookie": getLoginCookie()
            }
        })
        const data = req.data

        const results: DownloadsResult = {}
        for (const match of data.matchAll(downloadLinkRegex)) {
            if ((match[1] ?? "").includes("donation")) continue
            const processed = await this.processLink(match[1] ?? "")
            for (const [host, links] of Object.entries(processed)) {
                if (!results[host]) results[host] = {}
                for (const [name, link] of Object.entries(links)) {
                    results[host][name] = link
                }
            }
        }
        return results
    }

    async search(title: string): Promise<SearchResult[]> {
        return Onlinefix.search(title)
    }

    async getDownloads(url: string): Promise<DownloadsResult> {
        return Onlinefix.getDownloads(url)
    }
}
