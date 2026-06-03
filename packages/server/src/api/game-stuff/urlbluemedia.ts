import axios from "axios";
import http from "http";
import https from "https";

const axiosInstance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    validateStatus: () => true
})

export default class Urlbluemedia {
    static async getEncrypted(url: string): Promise<string> {
        let res = await axios.get(url)
        const html: string = res.data
        let code: string | undefined
        
        const matches = html.matchAll(/generateDownloadUrl[^']+'([^']+)/gm)
        for (const match of matches) {
            code = match[1]
        }
        
        if (!code || typeof code !== "string") {
            const matches2 = html.matchAll(/Goroi_n_Create_Button\("(.+)"\);/gm)
            for (const match of matches2) {
                code = match[1]
            }
            if (!code || typeof code !== "string") {
                console.error("Could not fetch code. Did urlbluemedia update their js again?")
                return ""
            }
            console.warn("Found code using old regex...")
        }
        
        return code
    }

    static decode(code: string): string {
        if (!code || typeof code !== "string") {
            console.error("Invalid code")
            return ""
        }
        let decrypted = '';
        for (let i = code.length / 2 - 5; i >= 0; i -= 2) {
            decrypted += code[i];
        }
        for (let i = code.length / 2 + 4; i < code.length; i += 2) {
            decrypted += code[i];
        }
        return decrypted
    }

    static async getUrl(code: string): Promise<string> {
        let dest = ""
        try {
            const data = await axiosInstance.head(`https://urlbluemedia.shop/get-url.php?url=` + encodeURIComponent(code), {
                maxRedirects: 0
            })
            const location = data.headers["location"]
            dest = location ?? ""
            return dest
        } catch (reason) {
            console.error(reason)
            return dest
        }
    }

    static async getRealUrl(url: string): Promise<string> {
        const enc = await this.getEncrypted(url)
        const dec = this.decode(enc)
        const dest = await this.getUrl(dec)
        return dest
    }
}
