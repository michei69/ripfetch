import {
    byparrConfigured,
    safeGet,
    solveWithByparr,
    validateUrl,
} from "./game-stuff/NetworkRequest";
import { getFirstMatch } from "@/util";

/**
 * GET through the Byparr/FlareSolverr instance when one is configured, and
 * straight through `safeGet` when it is not. Either way the URL is validated
 * first and every failure resolves to `undefined`.
 */
export default {
    async fetch<T>(url: string): Promise<T | undefined> {
        if (!(await validateUrl(url))) return;

        if (byparrConfigured) {
            const solved = await solveWithByparr({
                cmd: "request.get",
                url: url,
            });
            return solved === null ? undefined : (solved as T);
        }

        try {
            const res = await safeGet<T>(url);
            return res?.data;
        } catch {
            return;
        }
    },

    /**
     * A WordPress REST response proxied through the solver arrives wrapped in a
     * `<pre>` block, so the JSON has to be cut back out of the HTML.
     */
    getActualJson<T>(html: string | undefined): T {
        if (!html) return [] as T;
        const actualJson = getFirstMatch(
            html,
            /<pre>([\s\S]*?)<\/pre>/gim,
        )?.[1];
        try {
            return JSON.parse(actualJson ?? "[]") as T;
        } catch {
            return [] as T;
        }
    },
};
