import axios from "axios";
import { lookup } from "dns/promises";
import ipRangeCheck from "ip-range-check";

async function runCommand(body: Record<string, unknown>): Promise<ByparrResponse | null> {
    const byparrInst = process.env["BYPARR_INST"]
    if (!byparrInst) {
        return null
    }

    try {
        const req = await axios.post(`${byparrInst}/v1`, body, { validateStatus: () => true })
        return req.data
    } catch {
        return null
    }
}

// Those are the only ones which actually use NetworkRequest, outside of direct.ts
const ALLOWED_ORIGINS = [
    "igg-games.com",
    "steamunlocked.net",
    "steamdb.info",
    "game3rb.com"
]

export async function validateUrl(url: string): Promise<boolean> {
    if (!url || !url.trim()) return false
    const { hostname, protocol } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') return console.log("Invalid protocol:", protocol),false 

    // Allowlist
    if (!ALLOWED_ORIGINS.some(domain => hostname.endsWith('.' + domain) || hostname === domain)) {
        return console.log("Invalid hostname:", hostname), false
    }

    // DNS resolution (optional, could be cached)
    const ips = await lookup(hostname, { all: true })
    for (const { address } of ips) {
        if (ipRangeCheck(address, '10.0.0.0/8') ||
            ipRangeCheck(address, '172.16.0.0/12') ||
            ipRangeCheck(address, '192.168.0.0/16') ||
            ipRangeCheck(address, '127.0.0.0/8') ||
            ipRangeCheck(address, '100.116.0.0/16') ||
            ipRangeCheck(address, '::1')) {
            return console.log("Invalid IP:", address), false
        }
    }
    return true
}

export default class NetworkRequest {
    static async get(url: string): Promise<string> {
        if (!validateUrl(url)) return ""
        const byparrInst = process.env["BYPARR_INST"]

        const req = await axios.get(url, { validateStatus: () => true })
        let data = req.data
        if (typeof data == "string" && data.toLowerCase().includes("just a moment") && byparrInst != null) {
            console.debug("cloudflare - running via byparr")
            const result = await runCommand({
                "cmd": "request.get",
                "url": url
            })
            data = result?.solution?.response ?? ""
            if (!validateUrl(result?.solution.url ?? "")) return ''
        } else if (!validateUrl(req.request?.requestURL)) return ''
        return data as string
    }

    // unused
    static async post(url: string, postdata: string): Promise<string> {
        if (!validateUrl(url)) return ""
        const byparrInst = process.env["BYPARR_INST"]

        const req = await axios.post(url, postdata, { validateStatus: () => true })
        let data = req.data
        if (typeof data == "string" && data.toLowerCase().includes("just a moment") && byparrInst != null) {
            console.debug("cloudflare - running via byparr")
            const result = await runCommand({
                "cmd": "request.post",
                "url": url,
                "postData": postdata
            })
            data = result?.solution?.response ?? ""
            if (!validateUrl(result?.solution.url ?? "")) return ''
        } else if (!validateUrl(req.request?.requestURL)) return ''
        return data as string
    }
}

export type ByparrResponse = {
    status: "ok" | string,
    message: "Success" | string,
    solution: ByparrSolution,
    startTimestamp: Date,
    endTimestamp: Date,
    version: unknown
}
export type ByparrSolution = {
    url: string,
    status: number,
    cookies: Array<ByparrCookie>,
    userAgent: string,
    headers: Record<string, string>,
    response: string
}

export type ByparrCookie = {
    domain: string,
    expiry: number,
    httpOnly: boolean,
    name: string,
    path: string,
    sameSite: "Lax" | "Strict" | "None",
    secure: boolean,
    value: string,
    size: number,
    session: boolean,
    expires: number
}
