import axios from "axios";
import Solverr from "../flaresolverr";
import NetworkRequest from "./NetworkRequest";
import { getFirstMatch } from "@/util";

//TODO: implement puppeteer or sth similar
export default {
    available: [
        "megaup",
        "buzzheavier",
        // "korama", // must be on client, geoblocked
        // "gofile", // ratelimit
        // "viking", // cloudflare, need puppeteer
        // "1cloud", // must be on client, geoblocked
        // "pixeldrain", // i dont even want to think about it
    ],

    async megaup(url: string, no_redirect: boolean) {
        const data = await NetworkRequest.get(url);
        const u = data.match(/(https:\/\/download\.megaup\.net[^']+)/gm)?.[0];
        if (!u) {
            console.warn(`Couldn't find download link in megaup page: ${url}`);
            return null;
        }
        const data2 = await Solverr.fetch<string>(u);
        if (!data2) {
            console.warn(`Couldn't get megaup download page: ${u}`);
            return null;
        }
        let result = getFirstMatch(
            data2,
            /href="(https:\/\/[^/]+\/download\/[^"]+)/gm,
        )?.[1];
        if (!result) {
            const match = getFirstMatch(
                data2,
                /'(https:\/\/[^?]+\?pt=[^']+)/gm,
            )?.[1];
            result = no_redirect
                ? match
                : `https://games.michei.dev/api/megaup/${match?.split("/").pop()?.split("?").shift()}`;
        }
        return no_redirect
            ? {
                  referer: u,
                  url: result,
              }
            : result;
    },

    async buzzheavier(url: string) {
        const data = await axios.get(`${url}/download`, {
            headers: {
                Referer: url,
            },
        });
        return data.headers["hx-redirect"];
    },

    async solve(url: string, no_redirect = false) {
        if (url.includes("megaup.net")) {
            return await this.megaup(url, no_redirect);
        } else if (url.includes("buzzheavier.com")) {
            return await this.buzzheavier(url);
        }
    },
};
