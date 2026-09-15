import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { lookup } from "node:dns/promises";
import ipRangeCheck from "ip-range-check";
import { URLBLUEMEDIA_HOSTS } from "./commonData";

export const REQUEST_TIMEOUT_MS = 60_000;
export const MAX_REDIRECTS = 5;

export const ALLOWED_ORIGINS = [
    "igg-games.com",
    "steamunlocked.org",
    "steamdb.info",
    "game3rb.com",
    "gog-games.to",
    "dodi-repacks.site",
    "fitgirl-repacks.site",
    "steamrip.com",
    "gload.to",
    "ovagames.com",
    "online-fix.me",
    "pcgamestorrents.com",
    ...URLBLUEMEDIA_HOSTS,
    "megaup.net",
    "buzzheavier.com",
    "uploadhaven.com",
    "catalog.gog.com",
    "store.steampowered.com",
    "94he6yatei-dsn.algolia.net",
    "thenewscasts.com",
];

const BLOCKED_IP_RANGES = [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.168.0.0/16",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "224.0.0.0/4",
    "240.0.0.0/4",
    "::1/128",
    "::ffff:0:0/96",
    "fc00::/7",
    "fe80::/10",
    "ff00::/8",
];

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

export function isAllowedHost(
    url: string,
    allowedOrigins: readonly string[] = ALLOWED_ORIGINS,
): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return false;
        }
        const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
        return allowedOrigins.some((domain) => {
            const normalizedDomain = domain.toLowerCase().replace(/\.$/, "");
            return (
                hostname === normalizedDomain ||
                hostname.endsWith(`.${normalizedDomain}`)
            );
        });
    } catch {
        return false;
    }
}

export function isSafeExternalUrl(value: unknown): value is string {
    if (typeof value !== "string" || !value.trim()) return false;

    try {
        const parsed = new URL(value);
        if (parsed.username || parsed.password) return false;
        if (
            parsed.protocol !== "magnet:" &&
            parsed.port &&
            parsed.port !== "80" &&
            parsed.port !== "443"
        ) {
            return false;
        }
        return (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:" ||
            parsed.protocol === "magnet:"
        );
    } catch {
        return false;
    }
}

function isBlockedAddress(address: string): boolean {
    return BLOCKED_IP_RANGES.some((range) => ipRangeCheck(address, range));
}

export async function validateUrl(
    url: string | undefined,
    allowedOrigins: readonly string[] | null = ALLOWED_ORIGINS,
): Promise<boolean> {
    if (!url?.trim()) return false;

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
    }

    if (
        parsed.username ||
        parsed.password ||
        (parsed.port && parsed.port !== "80" && parsed.port !== "443")
    ) {
        return false;
    }

    if (allowedOrigins && !isAllowedHost(parsed.toString(), allowedOrigins)) {
        return false;
    }

    try {
        const ips = await lookup(parsed.hostname, { all: true });
        return (
            ips.length > 0 &&
            !ips.some(({ address }) => isBlockedAddress(address))
        );
    } catch {
        return false;
    }
}

export async function safeAxios<T = unknown>(
    config: AxiosRequestConfig,
    allowedOrigins: readonly string[] | null = ALLOWED_ORIGINS,
): Promise<AxiosResponse<T> | null> {
    if (!config.url) return null;

    let currentUrl = config.url;
    let method = config.method;
    let data = config.data;
    let stripSensitiveHeaders = false;
    const maxRedirects = config.maxRedirects ?? MAX_REDIRECTS;

    for (
        let redirectCount = 0;
        redirectCount <= maxRedirects;
        redirectCount++
    ) {
        if (!(await validateUrl(currentUrl, allowedOrigins))) return null;

        const headers = config.headers ? { ...config.headers } : undefined;
        if (stripSensitiveHeaders && headers) {
            for (const name of Object.keys(headers)) {
                if (
                    [
                        "authorization",
                        "cookie",
                        "proxy-authorization",
                        "host",
                        "content-length",
                        "origin",
                        "referer",
                    ].includes(name.toLowerCase())
                ) {
                    delete headers[name as keyof typeof headers];
                }
            }
        }

        let response: AxiosResponse<T>;
        try {
            response = await axios.request<T>({
                ...config,
                data,
                headers,
                auth: stripSensitiveHeaders ? undefined : config.auth,
                proxy: stripSensitiveHeaders ? undefined : config.proxy,
                method,
                url: currentUrl,
                maxRedirects: 0,
                maxContentLength: config.maxContentLength ?? MAX_RESPONSE_BYTES,
                maxBodyLength: config.maxBodyLength ?? MAX_REQUEST_BYTES,
                timeout: config.timeout ?? REQUEST_TIMEOUT_MS,
                validateStatus: () => true,
            });
        } catch {
            return null;
        }

        if (
            !REDIRECT_STATUSES.has(response.status) ||
            redirectCount === maxRedirects
        ) {
            return response;
        }

        const location = response.headers.location;
        if (!location) return response;

        try {
            const previousUrl = new URL(currentUrl);
            const nextUrl = new URL(location, previousUrl);
            stripSensitiveHeaders = previousUrl.origin !== nextUrl.origin;
            currentUrl = nextUrl.toString();
        } catch {
            return null;
        }

        if (
            response.status === 303 ||
            ((response.status === 301 || response.status === 302) &&
                method?.toUpperCase() === "POST")
        ) {
            method = "GET";
            data = undefined;
        }
    }

    return null;
}

export function safeGet<T = unknown>(
    url: string,
    allowedOrigins: readonly string[] | null = ALLOWED_ORIGINS,
    config: Omit<AxiosRequestConfig, "method" | "url"> = {},
): Promise<AxiosResponse<T> | null> {
    return safeAxios<T>({ ...config, method: "GET", url }, allowedOrigins);
}

export function safePost<T = unknown>(
    url: string,
    data: unknown,
    allowedOrigins: readonly string[] | null = ALLOWED_ORIGINS,
    config: Omit<AxiosRequestConfig, "data" | "method" | "url"> = {},
): Promise<AxiosResponse<T> | null> {
    return safeAxios<T>(
        { ...config, data, method: "POST", url },
        allowedOrigins,
    );
}

export async function safeFetch(
    url: string,
    init: RequestInit = {},
    allowedOrigins: readonly string[] | null = ALLOWED_ORIGINS,
    redirectAllowedOrigins: readonly string[] | null = allowedOrigins,
): Promise<Response | null> {
    let currentUrl = url;

    for (
        let redirectCount = 0;
        redirectCount <= MAX_REDIRECTS;
        redirectCount++
    ) {
        const currentAllowedOrigins =
            redirectCount === 0 ? allowedOrigins : redirectAllowedOrigins;
        if (!(await validateUrl(currentUrl, currentAllowedOrigins)))
            return null;

        const headers = new Headers(init.headers);
        if (redirectCount > 0) {
            headers.delete("authorization");
            headers.delete("cookie");
            headers.delete("proxy-authorization");
            headers.delete("origin");
            headers.delete("referer");
        }

        const timeoutController = new AbortController();
        const timeout = setTimeout(
            () => timeoutController.abort(),
            REQUEST_TIMEOUT_MS,
        );
        const signal = init.signal
            ? AbortSignal.any([init.signal, timeoutController.signal])
            : timeoutController.signal;

        let response: Response;
        try {
            response = await fetch(currentUrl, {
                ...init,
                headers,
                redirect: "manual",
                signal,
            });
        } catch {
            clearTimeout(timeout);
            return null;
        }
        clearTimeout(timeout);

        if (
            !REDIRECT_STATUSES.has(response.status) ||
            redirectCount === MAX_REDIRECTS
        ) {
            return response;
        }

        const location = response.headers.get("location");
        if (!location) return response;
        await response.body?.cancel().catch(() => {});

        try {
            currentUrl = new URL(location, currentUrl).toString();
        } catch {
            return null;
        }
    }

    return null;
}

const byparrInst = process.env.BYPARR_INST;
async function runCommand(
    body: Record<string, unknown>,
): Promise<ByparrResponse | null> {
    if (!byparrInst) return null;

    try {
        const req = await axios.post(`${byparrInst}/v1`, body, {
            maxContentLength: MAX_RESPONSE_BYTES,
            maxBodyLength: MAX_REQUEST_BYTES,
            timeout: REQUEST_TIMEOUT_MS,
            validateStatus: () => true,
        });
        return req.data;
    } catch {
        return null;
    }
}

export default {
    async get(
        url: string,
        allowedOrigins: readonly string[] = ALLOWED_ORIGINS,
    ): Promise<string> {
        const req = await safeAxios<string>(
            { method: "GET", url },
            allowedOrigins,
        );
        if (!req) return "";

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
            if (!(await validateUrl(result?.solution.url, allowedOrigins))) {
                return "";
            }
        }
        return data as string;
    },

    // unused
    async post(
        url: string,
        postdata: string,
        allowedOrigins: readonly string[] = ALLOWED_ORIGINS,
    ): Promise<string> {
        const req = await safeAxios<string>(
            { method: "POST", url, data: postdata },
            allowedOrigins,
        );
        if (!req) return "";

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
            if (!(await validateUrl(result?.solution.url, allowedOrigins))) {
                return "";
            }
        }
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
