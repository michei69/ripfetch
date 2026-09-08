import {
    isAllowedHost,
    safeGet,
    safePost,
} from "./NetworkRequest";

const inputTypeValueRegex = /name="([^"]*)" type="hidden" value="([^"]*)/gm;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
    if (!signal) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    if (signal.aborted) {
        return Promise.reject(new Error("Request aborted"));
    }

    return new Promise((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            reject(new Error("Request aborted"));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        }, ms);
        signal.addEventListener("abort", abort, { once: true });
    });
}

export default {
    async getRealUrl(url: string, signal?: AbortSignal): Promise<string> {
        if (!isAllowedHost(url, ["uploadhaven.com"])) return "";

        let req = await safeGet<string>(url, ["uploadhaven.com"], {
            signal,
            headers: {
                Referer: "https://steamunlocked.org/",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
            },
        });
        if (!req) return "";

        let downloadLink = "";
        let tries = 0;
        while (!downloadLink && tries < 1) {
            const html = typeof req.data === "string" ? req.data : "";

            const matches: Record<string, string> = Object.create(null);
            for (const match of html.matchAll(inputTypeValueRegex)) {
                if (match[1]) matches[match[1]] = match[2] ?? "";
            }

            console.log("Waiting a few seconds so session registers...");
            await wait(5_000, signal);

            const token = matches._token ?? "";
            const key = matches.key ?? "";
            const time = matches.time ?? "";
            const hash = matches.hash ?? "";

            const data =
                "_token=" +
                encodeURIComponent(token) +
                "&key=" +
                encodeURIComponent(key) +
                "&time=" +
                encodeURIComponent(time) +
                "&hash=" +
                encodeURIComponent(hash) +
                "&type=free";

            const cookieHeader: string[] = [];
            const setCookie = req.headers["set-cookie"];
            if (setCookie) {
                for (const cookie of setCookie) {
                    cookieHeader.push(cookie.split(";")[0] ?? "");
                }
            }

            const next = await safePost<string>(
                url,
                data,
                ["uploadhaven.com"],
                {
                    signal,
                    headers: {
                        Referer: url,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
                        Cookie: cookieHeader.join("; "),
                    },
                },
            );
            if (!next) return "";
            req = next;

            const html2 = typeof req.data === "string" ? req.data : "";

            for (const match of html2.matchAll(/href="([^"]*)/gm)) {
                const href = match[1] ?? "";
                if (!href.includes("download")) continue;
                try {
                    const candidate = new URL(href, url).toString();
                    if (isAllowedHost(candidate, ["uploadhaven.com"])) {
                        downloadLink = candidate;
                    }
                } catch {}
            }
            tries++;
        }

        return downloadLink;
    },
};
