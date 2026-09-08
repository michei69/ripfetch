import axios, { type AxiosResponse } from "axios";
import {
    type ByparrResponse,
    REQUEST_TIMEOUT_MS,
    safeGet,
    validateUrl,
} from "./game-stuff/NetworkRequest";
import { getFirstMatch } from "@/util";

const byparrInst = process.env.BYPARR_INST;

export default {
    async fetch<T>(url: string): Promise<T | undefined> {
        if (!(await validateUrl(url))) return;
        if (!byparrInst) {
            try {
                const res = await safeGet<T>(url);
                return res?.data;
            } catch {}
            return;
        }

        try {
            const res = (await axios.post(`${byparrInst}/v1`, {
                cmd: "request.get",
                url: url,
            }, {
                maxContentLength: 8 * 1024 * 1024,
                maxBodyLength: 2 * 1024 * 1024,
                timeout: REQUEST_TIMEOUT_MS,
            })) as AxiosResponse<ByparrResponse>;
            if (!(await validateUrl(res?.data?.solution.url ?? ""))) return;
            return res.data?.solution?.response as T;
        } catch {}
    },
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
