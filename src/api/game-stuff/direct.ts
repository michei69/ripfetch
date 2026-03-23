import axios from "axios"
import Solverr from "../flaresolverr"
import NetworkRequest from "./networkRequest"

//TODO: implement puppeteer or sth similar
export default class DirectSolver {
    static available = [
        "megaup",
        "buzzheavier",
        // "korama", // must be on client, geoblocked
        // "gofile", // ratelimit
        // "viking", // cloudflare, need puppeteer
        // "1cloud", // must be on client, geoblocked
        // "pixeldrain", // i dont even want to think about it 
    ]

    static async megaup(url: string) {
        const data = await NetworkRequest.get(url)
        const u = data.match(/(https:\/\/download\.megaup\.net[^']+)/gm)?.[0]
        if (!u) {
            console.warn("Couldn't find download link in megaup page")
            return null
        }
        const data2 = await Solverr.fetch<string>(u)
        if (!data2) {
            console.warn("Couldn't get megaup download page")
            return null
        }
        const matches = data2.matchAll(/href="(https:\/\/[^\/]+\/download\/[^"]+)/gm)
        for (const match of matches) {
            return match[1]
        }
        return null
    }
    static async buzzheavier(url: string) {
        const data = await axios.get(`${url}/download`, {
            headers: {
                "Referer": url
            }
        })
        return data.headers["hx-redirect"]
    }
    static async solve(url: string) {
        if (url.includes("megaup.net")) {
            return await this.megaup(url)
        } else if (url.includes("buzzheavier.com")) {
            return await this.buzzheavier(url)
        }
    }
}