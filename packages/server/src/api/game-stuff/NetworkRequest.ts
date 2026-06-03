import axios from "axios";
import { lookup } from "node:dns/promises";
import ipRangeCheck from "ip-range-check";

export async function validateUrl(url: string): Promise<boolean> {
    if (!url?.trim()) return false;
    const { hostname, protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") {
        console.log("Invalid protocol:", protocol);
        return false;
    }

    // Allowlist
    if (
        !ALLOWED_ORIGINS.some(
            (domain) => hostname.endsWith(`.${domain}`) || hostname === domain,
        )
    ) {
        console.log("Invalid hostname:", hostname);
        return false;
    }

    // DNS resolution (optional, could be cached)
    const ips = await lookup(hostname, { all: true });
    for (const { address } of ips) {
        if (
            ipRangeCheck(address, "10.0.0.0/8") ||
            ipRangeCheck(address, "172.16.0.0/12") ||
            ipRangeCheck(address, "192.168.0.0/16") ||
            ipRangeCheck(address, "127.0.0.0/8") ||
            ipRangeCheck(address, "100.116.0.0/16") ||
            ipRangeCheck(address, "::1")
        ) {
            console.log("Invalid IP:", address);
            return false;
        }
    }
    return true;
}

const byparrInst = process.env.BYPARR_INST;
async function runCommand(
    body: Record<string, unknown>,
): Promise<ByparrResponse | null> {
    if (!byparrInst) {
        return null;
    }

    try {
        const req = await axios.post(`${byparrInst}/v1`, body, {
            validateStatus: () => true,
        });
        return req.data;
    } catch {
        return null;
    }
}

const ALLOWED_ORIGINS = [
    "igg-games.com",
    "steamunlocked.org",
    "steamdb.info",
    "game3rb.com",
    "gog-games.to",
    "dodi-repacks.site",
];

export default {
    async get(url: string): Promise<string> {
        if (!(await validateUrl(url))) return "";

        const req = await axios.get(url, { validateStatus: () => true });
        let data = req.data;
        if (
            typeof data === "string" &&
            data.toLowerCase().includes("just a moment") &&
            byparrInst != null
        ) {
            console.debug("cloudflare - running via byparr");
            const result = await runCommand({
                cmd: "request.get",
                url: url,
            });
            data = result?.solution?.response ?? "";
            if (!(await validateUrl(result?.solution.url ?? ""))) return "";
        } else if (!(await validateUrl(req.request?.requestURL))) return "";
        return data as string;
    },

    // unused
    async post(url: string, postdata: string): Promise<string> {
        if (!(await validateUrl(url))) return "";

        const req = await axios.post(url, postdata, {
            validateStatus: () => true,
        });
        let data = req.data;
        if (
            typeof data === "string" &&
            data.toLowerCase().includes("just a moment") &&
            byparrInst != null
        ) {
            console.debug("cloudflare - running via byparr");
            const result = await runCommand({
                cmd: "request.post",
                url: url,
                postData: postdata,
            });
            data = result?.solution?.response ?? "";
            if (!(await validateUrl(result?.solution.url ?? ""))) return "";
        } else if (!(await validateUrl(req.request?.requestURL))) return "";
        return data as string;
    },
};

export type ByparrResponse = {
    status: "ok" | string;
    message: "Success" | string;
    solution: ByparrSolution;
    startTimestamp: Date;
    endTimestamp: Date;
    version: unknown;
};
export type ByparrSolution = {
    url: string;
    status: number;
    cookies: Array<ByparrCookie>;
    userAgent: string;
    headers: Record<string, string>;
    response: string;
};

export type ByparrCookie = {
    domain: string;
    expiry: number;
    httpOnly: boolean;
    name: string;
    path: string;
    sameSite: "Lax" | "Strict" | "None";
    secure: boolean;
    value: string;
    size: number;
    session: boolean;
    expires: number;
};
