import { getFirstMatch } from "@/util";
import { URLBLUEMEDIA_HOSTS } from "./commonData";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

export { URLBLUEMEDIA_HOSTS };

const isValidUrl = (value: string): boolean => {
    try {
        const { protocol } = new URL(value);
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
};

export default {
    async getEncrypted(url: string): Promise<string> {
        const res = await safeGet<string>(url, [
            "pcgamestorrents.com",
            ...URLBLUEMEDIA_HOSTS,
        ]);
        const html: string = typeof res?.data === "string" ? res.data : "";

        // The payload is the longest base64-ish literal on the page. It sits in
        // an obfuscated array whose name, accessor and layout are renamed on
        // every deploy, so match the payload's shape instead of that code.
        // Charset seen in the wild: [A-Za-z0-9] and [A-Za-z0-9+/=].
        let code = "";
        for (const [, lit] of html.matchAll(/'([A-Za-z0-9+/=]{40,})'/g)) {
            if (typeof lit !== "string") continue;
            if (lit.length > code.length) code = lit;
        }

        if (!code || typeof code !== "string") {
            code = getFirstMatch(
                html,
                /Goroi_n_Create_Button\("(.+)"\);/gm,
            )?.[1] as string;
        }
        if (!code || typeof code !== "string") {
            console.error(
                "Could not fetch code. Did urlbluemedia update their js again?",
                url,
            );
        }

        return code;
    },

    decode(code: string): string {
        if (!code || typeof code !== "string") {
            console.error("Invalid code");
            return "";
        }
        if (isValidUrl(code)) return code;
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
                URLBLUEMEDIA_HOSTS,
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
    },
};
