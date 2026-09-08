import { getFirstMatch } from "@/util";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

export default {
    async getEncrypted(url: string): Promise<string> {
        const res = await safeGet<string>(url, [
            "pcgamestorrents.com",
            "urlbluemedia.shop",
        ]);
        const html: string = typeof res?.data === "string" ? res.data : "";
        let code = getFirstMatch(html, /generateDownloadUrl[^']+'([^']+)/gm)?.[1]

        if (!code || typeof code !== "string") {
            code = getFirstMatch(html, /Goroi_n_Create_Button\("(.+)"\);/gm)?.[1]

            if (!code || typeof code !== "string") {
                console.error(
                    "Could not fetch code. Did urlbluemedia update their js again?",
                );
                return "";
            }
            console.warn("Found code using old regex...");
        }

        return code;
    },

    decode(code: string): string {
        if (!code || typeof code !== "string") {
            console.error("Invalid code");
            return "";
        }
        let decrypted = "";
        for (let i = code.length / 2 - 5; i >= 0; i -= 2) {
            decrypted += code[i];
        }
        for (let i = code.length / 2 + 4; i < code.length; i += 2) {
            decrypted += code[i];
        }
        return decrypted;
    },

    async getUrl(code: string): Promise<string> {
        let dest = "";
        try {
            const data = await safeGet(
                `https://urlbluemedia.shop/get-url.php?url=${encodeURIComponent(code)}`,
                ["urlbluemedia.shop"],
                { maxRedirects: 0 },
            );
            const location = data?.headers.location;
            dest = isSafeExternalUrl(location) ? location : "";
            return dest;
        } catch (error) {
            console.error("Could not resolve Urlbluemedia link:", error);
            return dest;
        }
    },

    async getRealUrl(url: string): Promise<string> {
        const enc = await this.getEncrypted(url);
        const dec = this.decode(enc);
        const dest = await this.getUrl(dec);
        return dest;
    }
}
