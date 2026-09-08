import axios from "axios";
import {
    REQUEST_TIMEOUT_MS,
    isSafeExternalUrl,
    validateUrl,
} from "./game-stuff/NetworkRequest";

// TODO: implement this in networkRequest, or somehow unify all of those
// TODO: its annoying having 3 different browser-based APIs

// TODO: make chrome API also bypass cloudflare itself (easy)

export default {
    async browserRequest(
        url: string,
        actions: Array<{
            instruction: string;
            arguments: Array<string | number>;
        }>,
        response: "content" | "title" | "url",
    ) {
        if (
            !process.env.CHROME_INST ||
            !isSafeExternalUrl(url) ||
            !(await validateUrl(url, ["gog-games.to"]))
        ) {
            return { result: "" };
        }

        try {
            const req = await axios.post(
                `${process.env.CHROME_INST}/browser`,
                {
                    url: url,
                    actions: actions,
                    response: response,
                },
                {
                    timeout: REQUEST_TIMEOUT_MS,
                    maxContentLength: 8 * 1024 * 1024,
                    maxBodyLength: 2 * 1024 * 1024,
                },
            );
            return req.data as { result: string };
        } catch {
            return { result: "" };
        }
    },

    async curlRequest(
        url: string,
        method = "GET",
        config?: {
            timeout?: number;
            allow_redirects?: boolean;
            verify?: boolean;
        },
        headers?: Record<string, string>,
        data?: any,
        json?: any,
    ) {
        if (
            !process.env.CHROME_INST ||
            !isSafeExternalUrl(url) ||
            !(await validateUrl(url, null))
        ) {
            return { content: "", headers: {}, status: 400 };
        }

        try {
            const req = await axios.post(
                `${process.env.CHROME_INST}/curl`,
                {
                    url: url,
                    method: method,
                    config: config,
                    headers: headers,
                    data: data,
                    json: json,
                },
                {
                    timeout: REQUEST_TIMEOUT_MS,
                    maxContentLength: 8 * 1024 * 1024,
                    maxBodyLength: 2 * 1024 * 1024,
                },
            );
            return req.data as {
                content: string;
                headers: Record<string, string>;
                status: number;
            };
        } catch {
            return { content: "", headers: {}, status: 502 };
        }
    },
};
