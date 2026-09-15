import axios from "axios";
import {
    MAX_REQUEST_BYTES,
    MAX_RESPONSE_BYTES,
    REQUEST_TIMEOUT_MS,
    isSafeExternalUrl,
    validateUrl,
} from "./game-stuff/NetworkRequest";

// TODO: implement this in networkRequest, or somehow unify all of those
// TODO: its annoying having 3 different browser-based APIs

// TODO: make chrome API also bypass cloudflare itself (easy)

/**
 * The headless-browser sidecar. It renders a page and runs `actions` against
 * it, which is the only way to reach sources that build their download table
 * client-side.
 */
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
                    maxContentLength: MAX_RESPONSE_BYTES,
                    maxBodyLength: MAX_REQUEST_BYTES,
                },
            );
            return req.data as { result: string };
        } catch {
            return { result: "" };
        }
    },
};
