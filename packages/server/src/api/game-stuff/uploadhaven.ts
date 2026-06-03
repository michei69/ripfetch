import axios from "axios"
import http from "http"
import https from "https"

const axiosInstance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    validateStatus: () => true,
    withCredentials: true,
    withXSRFToken: true
})

const inputTypeValueRegex = /name="([^"]*)" type="hidden" value="([^"]*)/gm

export default class Uploadhaven {
    static async getRealUrl(url: string): Promise<string> {
        let req = await axiosInstance.get(url, {
            headers: {
                Referer: "https://steamunlocked.org/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0"
            }
        })
        let downloadLink = ""
        let tries = 0
        while (!downloadLink && tries < 1) {
            const html = req.data as string
    
            const matches: Record<string, string> = {}
            for (const match of html.matchAll(inputTypeValueRegex)) {
                if (match[1]) matches[match[1]] = match[2] ?? ""
            }
            
            console.log("Waiting a few seconds so session registers...")
            await new Promise(resolve => setTimeout(resolve, 5_000))

            const token = matches["_token"] ?? ""
            const key = matches["key"] ?? ""
            const time = matches["time"] ?? ""
            const hash = matches["hash"] ?? ""
            
            const data = "_token=" + encodeURIComponent(token) +
                    "&key=" + encodeURIComponent(key) +
                    "&time=" + encodeURIComponent(time) +
                    "&hash=" + encodeURIComponent(hash) +
                    "&type=free"
    
            const cookieHeader: string[] = []
            const setCookie = req.headers["set-cookie"]
            if (setCookie) {
                for (const cookie of setCookie) {
                    cookieHeader.push(cookie.split(";")[0] ?? "")
                }
            }
    
            req = await axiosInstance.post(url, data, {
                headers: {
                    Referer: url,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
                    "Cookie": cookieHeader.join("; ")
                }
            })
            
            const html2 = req.data as string
            
            for (const match of html2.matchAll(/href="([^"]*)/gm)) {
                if (!downloadLink && match[1]?.includes("download") && match[1]?.includes("uploadhaven")) {
                    downloadLink = match[1]
                }
            }
            tries++
        }

        return downloadLink
    }
}
